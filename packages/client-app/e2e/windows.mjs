// Every window type the harness opens: how to open it from a running app and
// when it counts as rendered. `ready` and the openers run in the page through
// evaluate(), so they must be free of closures.
import { evaluate, waitForUrl, waitForWindowType } from "./app.mjs";

const mainReady = () =>
	["Welcome to the fixture inbox", "Lunch on Thursday?", "Meeting notes"].every(
		(subject) => document.body.innerText.includes(subject),
	);

// The main window, once it lists the fixture threads. Other windows are
// opened from it.
export const mainWindow = (run) =>
	waitForWindowType(run, "default", { ready: mainReady, timeout: 90_000 });

const inMain = async (run, fn, arg) => evaluate(await mainWindow(run), fn, arg);

export const WINDOWS = [
	{
		type: "default",
		open: mainWindow,
	},
	{
		type: "work",
		open: (run) =>
			waitForWindowType(run, "work", {
				ready: () => !!$n.DatabaseStore._open && !!document.body.innerText,
				timeout: 90_000,
			}),
	},
	{
		type: "composer",
		async open(run) {
			await inMain(run, () => {
				$n.Actions.composeNewBlankDraft();
			});
			return waitForWindowType(run, "composer", {
				ready: () =>
					!!document.querySelector(".composer-inner-wrap") &&
					document.body.innerText.includes("me@fixture.test"),
			});
		},
	},
	{
		type: "thread-popout",
		async open(run) {
			await inMain(run, async () => {
				const thread = await $n.DatabaseStore.find(
					$n.Thread,
					"fixture-thread-lunch",
				);
				$n.Actions.popoutThread(thread);
			});
			return waitForWindowType(run, "thread-popout", {
				ready: () =>
					document.body.innerText.includes("Lunch on Thursday?") &&
					document.body.innerText.includes("Write a reply"),
			});
		},
	},
	{
		// No account in config.json, so the app opens onboarding itself.
		type: "onboarding",
		seeded: false,
		open: (run) =>
			waitForWindowType(run, "onboarding", {
				ready: () => document.body.innerText.includes("Welcome to Nylas Mail"),
				timeout: 90_000,
			}),
	},
	{
		// A plain BrowserWindow (no NylasEnv) that loads a temp print.html.
		type: "print",
		async open(run) {
			await inMain(run, async () => {
				const thread = await $n.DatabaseStore.find(
					$n.Thread,
					"fixture-thread-lunch",
				);
				$n.Actions.printThread(
					thread,
					'<div class="message-item-area"><span></span></div>',
				);
			});
			const page = await waitForUrl(run, /print\.html$/, "print");
			await page.getByText("Lunch on Thursday?").first().waitFor();
			return page;
		},
	},
	{
		type: "calendar",
		async open(run) {
			await inMain(run, () => {
				NylasEnv.newWindow({ title: "Calendar", windowType: "calendar" });
			});
			return waitForWindowType(run, "calendar", {
				ready: () => document.body.innerText.includes("Calendar"),
			});
		},
	},
	{
		// The composer opens it for a draft; here it's opened shown for the
		// draft of a new composer.
		type: "scheduler-calendar",
		async open(run) {
			await inMain(run, () => {
				$n.Actions.composeNewBlankDraft();
			});
			const composer = await waitForWindowType(run, "composer", {
				ready: () => !!NylasEnv.getWindowProps().draftClientId,
			});
			const { draftClientId } = await evaluate(composer, () =>
				NylasEnv.getWindowProps(),
			);
			await inMain(
				run,
				(id) => {
					NylasEnv.newWindow({
						title: "Calendar",
						windowType: "scheduler-calendar",
						windowKey: `scheduler-calendar-${id}`,
						windowProps: { draftClientId: id },
					});
				},
				draftClientId,
			);
			return waitForWindowType(run, "scheduler-calendar", {
				ready: () => document.body.innerText.includes("Calendar"),
			});
		},
	},
	{
		type: "SalesforceObjectForm",
		async open(run) {
			await inMain(run, () => {
				NylasEnv.newWindow({
					title: "Create New Opportunity",
					windowType: "SalesforceObjectForm",
					windowProps: { objectType: "Opportunity" },
				});
			});
			return waitForWindowType(run, "SalesforceObjectForm", {
				ready: () => document.body.innerText.includes("Create New Opportunity"),
			});
		},
	},
];
