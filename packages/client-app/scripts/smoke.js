// Electron boot smoke: launches the real app entry, waits for the main
// window + sync backend to come up, then exits 0. Any uncaught error in the
// main process fails the run.
//
// Run via `pnpm --filter nylas-mail run smoke`.
import {spawn} from 'node:child_process';
import electronPath from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');

const SMOKE_TIMEOUT_MS = 60_000;

const proc = spawn(String(electronPath), [appDir, '--smoke', '--enable-logging'], {
  env: {
    ...process.env,
    NYLAS_SMoke: '1',
    NYLAS_HOME: path.join(appDir, '..', '..', '.nylas-smoke-home'),
    NODE_ENV: 'development',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
const record = (chunk) => { output += chunk.toString(); };
proc.stdout.on('data', record);
proc.stderr.on('data', record);

const timer = setTimeout(() => {
  console.error('SMOKE FAIL: timed out waiting for boot markers');
  console.error(output.slice(-4000));
  proc.kill('SIGKILL');
  process.exit(1);
}, SMOKE_TIMEOUT_MS);

proc.on('exit', (code) => {
  clearTimeout(timer);
  if (code === 0) {
    console.log('SMOKE PASS: app booted, window ready, sync backend initialized');
    process.exit(0);
  }
  console.error(`SMOKE FAIL: exited ${code}`);
  console.error(output.slice(-4000));
  process.exit(1);
});
