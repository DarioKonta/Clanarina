// Starts Expo on the Android emulator. Finds the Android SDK by itself, so it works even in a
// terminal that was opened before ANDROID_HOME / PATH were set (e.g. VS Code not restarted).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import process from 'node:process';

const candidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  process.env.HOME && join(process.env.HOME, 'Library', 'Android', 'sdk'),
  process.env.HOME && join(process.env.HOME, 'Android', 'Sdk'),
].filter(Boolean);

const sdk = candidates.find((dir) => existsSync(join(dir, 'platform-tools')));
if (!sdk) {
  console.error('Android SDK not found. See README → "Run on the computer (Android emulator)".');
  process.exit(1);
}

const env = { ...process.env, ANDROID_HOME: sdk };
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] = [join(sdk, 'emulator'), join(sdk, 'platform-tools'), env[pathKey]].join(delimiter);

// Run the Expo CLI with this Node directly (no shell needed on Windows).
const expoCli = join(process.cwd(), 'node_modules', 'expo', 'bin', 'cli');
const child = spawn(process.execPath, [expoCli, 'start', '--android', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
