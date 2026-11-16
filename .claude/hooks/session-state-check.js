#!/usr/bin/env node
// Stop hook: if this turn changed the project but SESSION_STATE.md was not
// updated, block the stop once and ask Claude to update it (CLAUDE.md session rule).
// Changes = uncommitted edits, or unpushed commits, that don't include SESSION_STATE.md.
const { execSync } = require('child_process');

const STATE = 'SESSION_STATE.md';

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let payload = {};
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    /* ignore */
  }
  // Already nudged once this stop cycle: let Claude finish (no loops).
  if (payload.stop_hook_active) return;

  const status = git('status --porcelain') ?? '';
  const dirty = status
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''));
  const stateDirty = dirty.includes(STATE);
  const otherDirty = dirty.some((p) => p !== STATE);

  // Unpushed commits; a branch with no upstream is compared to origin/main.
  const range = git('rev-parse --abbrev-ref @{u}') ? '@{u}..HEAD' : 'origin/main...HEAD';
  const unpushedFiles = (git(`diff --name-only ${range}`) ?? '').split('\n').filter(Boolean);
  const stateCommitted = unpushedFiles.includes(STATE);
  const otherCommitted = unpushedFiles.some((p) => p !== STATE);

  const changedWork = otherDirty || otherCommitted;
  const stateUpdated = stateDirty || stateCommitted;

  if (changedWork && !stateUpdated) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          'Project files changed but SESSION_STATE.md was not updated. Per CLAUDE.md, update it now ' +
          '(_Last updated_ date, what was done, decisions, next step). If the task is not finished yet ' +
          'or the change is trivial and needs no entry, say so briefly and stop.',
      }),
    );
  }
});
