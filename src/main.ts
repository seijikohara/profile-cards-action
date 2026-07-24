/**
 * @fileoverview Entry point for the Profile Cards GitHub Action.
 *
 * Skeleton stub: it reads a subset of action inputs, echoes the non-secret
 * configuration to the Actions log, and writes empty outputs. Card rendering is
 * not implemented yet; this file exists so the project type-checks, lints, and
 * bundles into dist/index.js.
 */

import * as core from '@actions/core';

/**
 * Read action inputs, log the resolved configuration, and set placeholder outputs.
 */
export async function run(): Promise<void> {
  const githubToken = core.getInput('github-token', { required: true });
  // Mask the token so no later log line can accidentally surface it.
  core.setSecret(githubToken);

  const username = core.getInput('username') || process.env['GITHUB_REPOSITORY_OWNER'] || '';
  const cards = core.getInput('cards');
  const outputDir = core.getInput('output-dir');

  core.info(`Rendering profile cards for "${username || '(repository owner)'}"`);
  core.info(`Requested cards: ${cards}`);
  core.info(`Output directory: ${outputDir}`);

  // Rendering is not implemented yet; report a no-op result so downstream steps
  // (and the committer) treat this run as "nothing changed".
  core.setOutput('changed', 'false');
  core.setOutput('files', '[]');
}

// `run` reports its own failures once wired up, but keep a catch here so a stray
// rejection surfaces as an action failure instead of an unhandled rejection the
// runner only logs.
run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  core.setFailed(message);
});
