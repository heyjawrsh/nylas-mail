// Builds an offline fixture NYLAS_HOME: one account in config.json and an
// edgehill.db holding a few folders, contacts, threads and messages.
//
//   node packages/client-app/scripts/seed-fixture-account.mjs [dir]
//
// `dir` defaults to <repo>/.nylas-fixture-home and is rebuilt on every run.
// The script only replaces a directory that is missing, empty, or one it
// seeded before (it holds a .nylas-fixture marker), so a typo or a real
// NYLAS_HOME is refused, not wiped. Then launch the dev app on it:
//
//   NYLAS_HOME=<dir> pnpm --filter nylas-mail start
//
// The data lives in spec/fixtures/account/ as JSON. The script launches the
// dev app on the new folder so the work window creates the schema itself,
// then writes the models through DatabaseStore over the DevTools protocol,
// so the rows (join tables, message bodies, counts) are exactly what the app
// writes. Nothing is sent: there are no credentials and no Nylas identity,
// so sync logs "Can't start sync" and stops.
import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electronPath from "electron";

import { waitForWindow } from "./lib/cdp.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const repoRoot = path.resolve(appDir, "..", "..");
export const fixtureDir = path.join(appDir, "spec", "fixtures", "account");
export const defaultHome = path.join(repoRoot, ".nylas-fixture-home");
export const MARKER = ".nylas-fixture";

// Empties `home` for a new seed, refusing anything that might hold real data.
export function prepareHome(home) {
	if (existsSync(home)) {
		if (!statSync(home).isDirectory()) {
			throw new Error(`Refusing to seed ${home}: it is not a directory.`);
		}
		const entries = readdirSync(home);
		if (entries.length > 0 && !entries.includes(MARKER)) {
			throw new Error(
				`Refusing to replace ${home}: it isn't empty and has no ${MARKER} marker, so it may be a real NYLAS_HOME. Pass a new or empty directory.`,
			);
		}
		rmSync(home, { recursive: true, force: true });
	}
	mkdirSync(home, { recursive: true });
	writeFileSync(
		path.join(home, MARKER),
		"Seeded by packages/client-app/scripts/seed-fixture-account.mjs; safe to replace.\n",
	);
}

// A port nothing is listening on, so the seed can't attach to another app.
export function freePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});
}

const readJSON = (name) =>
	JSON.parse(readFileSync(path.join(fixtureDir, name), "utf8"));

export function fixtureData() {
	return {
		account: readJSON("account.json"),
		mailbox: readJSON("mailbox.json"),
	};
}

// The config.json the app reads. With an account in it the app opens the
// main window instead of onboarding. asksAboutAppMove at 5 means a mac build
// run from outside /Applications never shows the move-to-Applications dialog,
// which would block the app (and a test run) until someone answers it.
export function fixtureConfig(account) {
	const config = { asksAboutAppMove: 5 };
	if (account) config.nylas = { accounts: [account], accountsVersion: 1 };
	return { "*": config };
}

// Folds the WAL back into edgehill.db so the seeded file stands on its own.
// The app's other connections may hold a lock for a moment, and TRUNCATE then
// throws "database table is locked" or reports busy (#13), so retry with
// backoff and fall back to a PASSIVE checkpoint, which never waits on a
// reader. Returns the mode that ran. Kept free of closures: the seed sends it
// to the renderer as source.
export async function checkpointWal(
	db,
	{ attempts = 6, delayMs = 50, sleep } = {},
) {
	const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
	const isLock = (err) => /locked|busy/i.test(String(err?.message));
	for (let i = 0; i < attempts; i++) {
		try {
			const [row] = db.pragma("wal_checkpoint(TRUNCATE)") || [];
			if (!row?.busy) return "truncate";
		} catch (err) {
			if (!isLock(err)) throw err;
		}
		if (i < attempts - 1) await wait(delayMs * 2 ** i);
	}
	db.pragma("wal_checkpoint(PASSIVE)");
	return "passive";
}

// Runs inside the work window (NylasEnv and $n are its globals). Kept free of
// closures so it can be sent as source.
async function seedInRenderer(account, mailbox, checkpoint) {
	const { DatabaseStore, Thread, Message, Contact, Folder } = $n;
	const accountId = account.id;
	const contacts = {};
	for (const c of mailbox.contacts) {
		contacts[c.id.replace("fixture-contact-", "")] = new Contact({
			id: c.id,
			clientId: c.id,
			accountId,
			name: c.name,
			email: c.email,
		});
	}
	const folders = {};
	for (const f of mailbox.folders) {
		folders[f.name] = new Folder({
			id: f.id,
			clientId: f.id,
			accountId,
			name: f.name,
			displayName: f.display_name,
		});
	}
	const textOf = (html) =>
		html
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	const people = (keys) => keys.map((k) => contacts[k]);

	const messages = [];
	const threads = [];
	for (const t of mailbox.threads) {
		const threadMessages = t.messages.map(
			(m) =>
				new Message({
					id: m.id,
					clientId: m.id,
					accountId,
					threadId: t.id,
					subject: t.subject,
					from: people([m.from]),
					to: people(m.to),
					cc: people(m.cc),
					bcc: [],
					replyTo: [],
					date: new Date(m.date),
					unread: m.unread,
					starred: t.starred,
					draft: false,
					version: 1,
					body: m.body,
					snippet: textOf(m.body).slice(0, 190),
					messageIdHeader: `<${m.id}@fixture.test>`,
					categories: (m.folders || t.folders).map((n) => folders[n]),
					files: [],
					events: [],
				}),
		);
		messages.push(...threadMessages);

		const participants = [];
		for (const m of threadMessages) {
			for (const c of [...m.from, ...m.to, ...m.cc]) {
				if (!participants.includes(c)) participants.push(c);
			}
		}
		const latest = (list) =>
			list.length ? new Date(Math.max(...list.map((m) => m.date))) : null;
		const fromMe = (m) => m.from[0].email === account.email_address;
		const folderNames = new Set(t.folders);
		for (const m of t.messages)
			for (const n of m.folders || []) folderNames.add(n);

		threads.push(
			new Thread({
				id: t.id,
				clientId: t.id,
				accountId,
				subject: t.subject,
				snippet: threadMessages[threadMessages.length - 1].snippet,
				unread: t.unread,
				starred: t.starred,
				version: 1,
				categories: [...folderNames].map((n) => folders[n]),
				categoriesType: "folders",
				participants,
				hasAttachments: false,
				lastMessageReceivedTimestamp: latest(
					threadMessages.filter((m) => !fromMe(m)),
				),
				lastMessageSentTimestamp: latest(threadMessages.filter(fromMe)),
			}),
		);
	}

	await DatabaseStore.inTransaction(async (t) => {
		await t.persistModels(Object.values(folders));
		await t.persistModels(Object.values(contacts));
		await t.persistModels(messages);
		await t.persistModels(threads);
	});

	const count = async (klass) => DatabaseStore.count(klass);
	const result = {
		folders: await count(Folder),
		contacts: await count(Contact),
		threads: await count(Thread),
		messages: await count(Message),
	};
	result.checkpoint = await checkpoint(DatabaseStore._db);
	return result;
}

export async function seedFixtureAccount(home = defaultHome, options = {}) {
	const port = options.port ?? (await freePort());
	const { account, mailbox } = fixtureData();
	prepareHome(home);
	writeFileSync(
		path.join(home, "config.json"),
		`${JSON.stringify(fixtureConfig(account), null, 2)}\n`,
	);

	// Options: `executable` runs a built app instead of the dev app, `args`
	// adds launch flags (the e2e harness passes its container flags), and
	// `userDataDir` keeps Chromium's profile, and the single-instance lock, out
	// of the real one.
	const args = options.executable ? [] : [appDir, "--dev"];
	args.push(`--remote-debugging-port=${port}`);
	if (options.userDataDir) args.push(`--user-data-dir=${options.userDataDir}`);
	args.push(...(options.args ?? []));
	const proc = spawn(options.executable ?? String(electronPath), args, {
		env: { ...process.env, NYLAS_HOME: home },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let log = "";
	proc.stdout.on("data", (chunk) => {
		log += chunk;
	});
	proc.stderr.on("data", (chunk) => {
		log += chunk;
	});
	const exited = new Promise((resolve) => proc.on("exit", resolve));

	let page;
	try {
		page = await waitForWindow(port, "work", {
			ready: "$n.DatabaseStore._open",
			// Refuse to write into any app but the one launched on `home`.
			configDirPath: home,
			timeout: 90_000,
		});
		const counts = await page.evaluate(
			`(${seedInRenderer.toString()})(${JSON.stringify(account)}, ${JSON.stringify(mailbox)}, ${checkpointWal.toString()})`,
		);
		// The page goes away mid-call, so the evaluate itself may reject.
		await page.evaluate("NylasEnv.quit()").catch(() => {});
		return counts;
	} catch (err) {
		err.message += `\n--- app log (tail) ---\n${log.slice(-4000)}`;
		proc.kill("SIGTERM");
		throw err;
	} finally {
		page?.close();
		const timer = setTimeout(() => proc.kill("SIGKILL"), 15_000);
		await exited;
		clearTimeout(timer);
	}
}

const runAsScript =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (runAsScript) {
	const home = path.resolve(process.argv[2] || defaultHome);
	seedFixtureAccount(home).then(
		(counts) => {
			console.log(`Fixture NYLAS_HOME ready at ${home}`);
			console.log(
				`  ${counts.threads} threads, ${counts.messages} messages, ${counts.contacts} contacts, ${counts.folders} folders`,
			);
			console.log(`Launch: NYLAS_HOME=${home} pnpm --filter nylas-mail start`);
		},
		(err) => {
			console.error(`Seeding failed: ${err.message}`);
			process.exit(1);
		},
	);
}
