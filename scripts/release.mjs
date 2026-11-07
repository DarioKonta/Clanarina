#!/usr/bin/env node
/**
 * Publishes an Android APK as a GitHub Release, so phones running Obtainium get the update.
 *
 *   npm run release                      build + publish the version currently in app.json
 *   npm run release -- patch             bump 1.0.0 → 1.0.1 (or minor / major), commit, push, build, publish
 *   npm run release -- --build <id>      publish an already finished EAS build as the current version
 *   add  --notes "Šta je novo"           release notes shown in Obtainium
 *
 * Needs: GitHub CLI logged in (`gh auth login`), EAS logged in (`npx eas-cli@latest login`),
 * and a clean, committed working tree. The release tag is `v<version>` and must match
 * app.json's `expo.version`, which Obtainium compares with the installed app's version.
 */
import { Buffer } from 'node:buffer';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const APP_JSON = new URL('app.json', ROOT);
const PKG_JSON = new URL('package.json', ROOT);
const cwd = fileURLToPath(ROOT);

// ---------- args ----------
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const bump = args.find((a) => ['patch', 'minor', 'major'].includes(a));
const buildId = opt('--build');
const notesArg = opt('--notes');

// ---------- helpers ----------
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};
const step = (msg) => console.log(`\n▶ ${msg}`);

function findGh() {
  const candidates = [
    'gh',
    'C:\\Program Files\\GitHub CLI\\gh.exe',
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'GitHub CLI', 'gh.exe'),
  ];
  for (const c of candidates) {
    if (c !== 'gh' && !existsSync(c)) continue;
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  return fail('GitHub CLI (gh) not found. Install it: winget install GitHub.cli, then run: gh auth login');
}

const run = (cmd, cmdArgs, opts = {}) => execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8', ...opts }).trim();
const git = (...a) => run('git', a);

/** Runs `npx eas-cli ...` with progress on screen and returns parsed JSON from stdout. */
function easJson(easArgs) {
  const r = spawnSync('npx', ['eas-cli@latest', ...easArgs, '--json'], {
    cwd,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) fail(`EAS command failed: eas ${easArgs.join(' ')}`);
  try {
    return JSON.parse(r.stdout);
  } catch {
    return fail(`Could not read EAS output:\n${r.stdout}`);
  }
}

function bumpVersion(v, kind) {
  const [maj, min, pat] = v.split('.').map(Number);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

// ---------- main ----------
const gh = findGh();
if (spawnSync(gh, ['auth', 'status'], { encoding: 'utf8' }).status !== 0) fail('Not logged in to GitHub. Run: gh auth login');

if (git('status', '--porcelain')) fail('There are uncommitted changes. Commit them first, so the APK matches the code on GitHub.');

const app = JSON.parse(readFileSync(APP_JSON, 'utf8'));
let version = app.expo.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`app.json version "${version}" must look like 1.2.3`);

if (bump) {
  if (buildId) fail('Use either a version bump or --build, not both.');
  version = bumpVersion(version, bump);
  step(`Version ${app.expo.version} → ${version}`);
  app.expo.version = version;
  writeFileSync(APP_JSON, JSON.stringify(app, null, 2) + '\n');
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  pkg.version = version;
  writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + '\n');
  git('add', 'app.json', 'package.json');
  git('commit', '-m', `Release v${version}`);
}

const tag = `v${version}`;
const existing = spawnSync(gh, ['release', 'view', tag], { cwd, encoding: 'utf8' });
if (existing.status === 0) fail(`Release ${tag} already exists. Bump the version: npm run release -- patch`);

step('Pushing to GitHub');
git('push', '--quiet');

let build;
if (buildId) {
  step(`Using existing EAS build ${buildId}`);
  build = easJson(['build:view', buildId]);
} else {
  step('Building the APK on EAS (this can take a while on the free plan; leave it running)');
  const builds = easJson(['build', '-p', 'android', '--profile', 'preview', '--non-interactive', '--wait']);
  build = Array.isArray(builds) ? builds[0] : builds;
}

if (build.status !== 'FINISHED') fail(`EAS build is "${build.status}", not finished. Logs: https://expo.dev (build ${build.id})`);
if (build.appVersion && build.appVersion !== version) {
  fail(`That build is version ${build.appVersion}, but app.json says ${version}. They must match for Obtainium.`);
}
const apkUrl = build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;
if (!apkUrl) fail('The build has no APK download link.');

step('Downloading the APK');
const res = await fetch(apkUrl);
if (!res.ok) fail(`Download failed: HTTP ${res.status}`);
const apk = join(mkdtempSync(join(tmpdir(), 'clanarina-')), `clanarina-${tag}.apk`);
writeFileSync(apk, Buffer.from(await res.arrayBuffer()));

step(`Publishing GitHub release ${tag}`);
const notes = notesArg ?? `Članarina ${version}`;
const url = run(gh, ['release', 'create', tag, apk, '--title', `Članarina ${version}`, '--notes', notes, '--target', git('rev-parse', 'HEAD')]);
git('fetch', '--tags', '--quiet');

console.log(`\n✔ Done: ${url}`);
console.log('  Phones with Obtainium will see the update the next time it checks (or pull down to refresh in Obtainium).');
