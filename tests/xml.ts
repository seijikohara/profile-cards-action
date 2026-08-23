/** Minimal XML well-formedness check for generated SVG (no DOM in the test env). */

const TAG = /<(\/?)([A-Za-z][\w-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/y;

/** Throws when `svg` is not a single well-formed element tree. */
export function assertWellFormed(svg: string): void {
  const open = walk(svg, 0, []);
  if (open.length > 0) throw new Error(`unclosed elements: ${open.join(', ')}`);
}

/** Consume from `index`, returning the still-open element names. Depth = tag count, well within stack limits. */
function walk(svg: string, index: number, stack: readonly string[]): readonly string[] {
  if (index >= svg.length) return stack;
  const lt = svg.indexOf('<', index);
  if (lt === -1) {
    checkText(svg.slice(index));
    return stack;
  }
  checkText(svg.slice(index, lt));
  TAG.lastIndex = lt;
  const match = TAG.exec(svg);
  if (!match || match.index !== lt) {
    throw new Error(`malformed tag at offset ${lt}: ${svg.slice(lt, lt + 60)}`);
  }
  const [, closing, name, , selfClosing] = match;
  if (closing === '/') {
    const openName = stack.at(-1);
    if (openName !== name) throw new Error(`mismatched </${name}>, expected </${openName ?? 'nothing'}>`);
    return walk(svg, TAG.lastIndex, stack.slice(0, -1));
  }
  return walk(svg, TAG.lastIndex, selfClosing === '/' ? stack : [...stack, name ?? '']);
}

function checkText(text: string): void {
  if (text.includes('>') || text.includes('<')) {
    throw new Error(`stray angle bracket in text: ${text.slice(0, 60)}`);
  }
  const badAmp = /&(?!(amp|lt|gt|quot|#39|#x?[0-9a-fA-F]+);)/.exec(text);
  if (badAmp) throw new Error(`unescaped ampersand near: ${text.slice(badAmp.index, badAmp.index + 40)}`);
}
