// Runs once before the harness: checks the built app can be driven, then
// seeds the fixture account into the template home every test copies.
import {
	builtAppPath,
	checkBuiltApp,
	seedTemplate,
	templateHome,
} from "./app.mjs";

export default async function globalSetup() {
	const executable = await checkBuiltApp(builtAppPath());
	const counts = await seedTemplate(executable);
	console.log(
		`Seeded ${templateHome}: ${counts.threads} threads, ${counts.messages} messages (checkpoint: ${counts.checkpoint})`,
	);
}
