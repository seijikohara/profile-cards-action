/**
 * Fail when any `let` declaration exists in the scanned trees — the source is
 * const-only by policy (see docs/design.md, v1 design pass addendum). oxlint
 * has no `no-restricted-syntax`, so this small checker guards the invariant.
 * Comments are blanked offset-preserving before matching, so prose mentioning
 * "let" never trips it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const targets = process.argv.length > 2 ? process.argv.slice(2) : ['src', 'scripts'];

function walk(path: string): readonly string[] {
  if (statSync(path).isDirectory()) {
    return readdirSync(path).flatMap((name) => walk(join(path, name)));
  }
  return path.endsWith('.ts') ? [path] : [];
}

const offenders = targets.flatMap(walk).flatMap((path) => {
  const blanked = readFileSync(path, 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, (comment) => comment.replaceAll(/[^\n]/g, ' '))
    .replaceAll(/\/\/[^\n]*/g, (comment) => ' '.repeat(comment.length));
  return [...blanked.matchAll(/\blet\s+[A-Za-z_${[]/g)].map(
    (match) => `${path}:${blanked.slice(0, match.index).split('\n').length}: \`let\` declaration`
  );
});

if (offenders.length > 0) {
  console.error(offenders.join('\n'));
  console.error(
    `\n${offenders.length} \`let\` declaration(s) found — use const; restructure reassignment into expressions.`
  );
  process.exit(1);
}
console.log(`const-only: ${targets.join(', ')} clean`);
