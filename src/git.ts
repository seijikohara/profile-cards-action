/**
 * Commit and push generated files back to the repository.
 *
 * Ports the scheduled profile workflow's shell steps into code: stage the output
 * directory, skip when nothing changed, otherwise commit as github-actions[bot]
 * and push, re-committing onto the tip when the branch advanced mid-run.
 */

import * as exec from '@actions/exec';

export interface CommitResult {
  readonly changed: boolean;
  readonly files: readonly string[];
}

const BOT_NAME = 'github-actions[bot]';
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';
const PUSH_ATTEMPTS = 3;

/** Read a required environment variable, or throw a clear error. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Environment variable ${name} is required.`);
  }
  return value;
}

/**
 * Parse `git status --porcelain` output into a list of paths.
 *
 * Each line is "XY <path>" (status code, then the path at column 4). Renames
 * read "XY <old> -> <new>"; keep the destination path.
 */
function parsePorcelain(stdout: string): string[] {
  return stdout
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const path = line.slice(3);
      const arrow = path.indexOf(' -> ');
      return arrow === -1 ? path : path.slice(arrow + 4);
    });
}

/**
 * Return the paths under `dir` that differ from HEAD.
 *
 * `--intent-to-add` records brand-new files in the index so `status --porcelain`
 * reports them; without it, untracked files would be invisible to the diff.
 */
export async function changedPaths(dir: string): Promise<string[]> {
  await exec.exec('git', ['add', '--intent-to-add', dir]);
  const status = await exec.getExecOutput('git', ['status', '--porcelain', '--', dir], {
    silent: true,
  });
  return parsePorcelain(status.stdout);
}

/** Stage everything under `dir` and report whether the index now differs from HEAD. */
async function stage(dir: string): Promise<boolean> {
  await exec.exec('git', ['add', dir]);
  const diff = await exec.getExecOutput('git', ['diff', '--cached', '--quiet'], {
    ignoreReturnCode: true,
    silent: true,
  });
  return diff.exitCode !== 0;
}

/**
 * Stage `dir`, commit any changes as github-actions[bot], and push them.
 *
 * Returns `{ changed: false, files: [] }` when nothing is staged. Otherwise
 * commits and pushes to the current branch, re-committing onto the remote tip
 * and retrying when the push is rejected because the branch advanced.
 */
export async function commitAndPush(options: { dir: string; message: string; token: string }): Promise<CommitResult> {
  const { dir, message, token } = options;

  // Capture the paths before committing so the result reports what shipped.
  const files = await changedPaths(dir);

  if (!(await stage(dir))) {
    return { changed: false, files: [] };
  }

  await exec.exec('git', ['config', 'user.name', BOT_NAME]);
  await exec.exec('git', ['config', 'user.email', BOT_EMAIL]);
  await exec.exec('git', ['commit', '-m', message]);

  const repository = requireEnv('GITHUB_REPOSITORY');
  const branch = requireEnv('GITHUB_REF_NAME');

  // x-access-token is the documented username for the installation token. Set it
  // silently so @actions/exec never echoes the token in the command line.
  const pushUrl = `https://x-access-token:${token}@github.com/${repository}.git`;
  await exec.exec('git', ['remote', 'set-url', '--push', 'origin', pushUrl], { silent: true });

  for (let attempt = 1; attempt <= PUSH_ATTEMPTS; attempt += 1) {
    const push = await exec.getExecOutput('git', ['push', 'origin', `HEAD:${branch}`], {
      ignoreReturnCode: true,
    });
    if (push.exitCode === 0) {
      return { changed: true, files };
    }
    if (attempt === PUSH_ATTEMPTS) break;

    // The branch can advance while the cards render, which rejects the push as
    // non-fast-forward. Rebasing is the wrong recovery: the other side wrote the
    // same generated files, and cards that stamp a render timestamp differ on
    // every run, so the two commits touch identical lines and the rebase
    // conflicts on essentially every race — leaving the tree mid-rebase. There
    // is nothing to merge either way, because the freshly rendered output is the
    // answer regardless of what landed meanwhile. Drop the commit, move onto the
    // new tip with the working tree untouched, and commit that output again.
    await exec.exec('git', ['fetch', 'origin', branch]);
    await exec.exec('git', ['reset', '--mixed', 'FETCH_HEAD']);
    if (!(await stage(dir))) {
      // The new tip already carries byte-identical output; nothing left to push.
      return { changed: false, files: [] };
    }
    await exec.exec('git', ['commit', '-m', message]);
  }

  throw new Error(`Failed to push to origin/${branch} after ${PUSH_ATTEMPTS} attempts.`);
}
