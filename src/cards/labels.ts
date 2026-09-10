/** Repository labels shared by the cards that list repositories. */

import { el, textNode } from '../svg/dsl.js';

/** Ellipsize a label so it cannot run under the column to its right. */
export function truncate(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
}

/**
 * Two-tone owner/name label.
 *
 * The owner prefix repeats down a list of one person's repositories, so it
 * wears the muted ink while the repository name carries the row's identity in
 * the foreground color.
 */
export function repoLabelSpans(nameWithOwner: string, fg: string, maxChars: number): string[] {
  const label = truncate(nameWithOwner, maxChars);
  const slash = label.indexOf('/');
  if (slash < 0) return [el('tspan', { fill: fg }, textNode(label))];
  return [textNode(label.slice(0, slash + 1)), el('tspan', { fill: fg }, textNode(label.slice(slash + 1)))];
}
