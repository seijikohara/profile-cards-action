/** Minimal XML well-formedness check for generated SVG (no DOM in the test env). */

const TAG = /<(\/?)([A-Za-z][\w-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/y;

/** Throws when `svg` is not a single well-formed element tree. */
export function assertWellFormed(svg: string): void {
  const stack: string[] = [];
  let index = 0;
  while (index < svg.length) {
    const lt = svg.indexOf('<', index);
    if (lt === -1) {
      checkText(svg.slice(index));
      break;
    }
    checkText(svg.slice(index, lt));
    TAG.lastIndex = lt;
    const match = TAG.exec(svg);
    if (!match || match.index !== lt) {
      throw new Error(`malformed tag at offset ${lt}: ${svg.slice(lt, lt + 60)}`);
    }
    const [, closing, name, , selfClosing] = match;
    if (closing === '/') {
      const open = stack.pop();
      if (open !== name) throw new Error(`mismatched </${name}>, expected </${open ?? 'nothing'}>`);
    } else if (selfClosing !== '/') {
      stack.push(name ?? '');
    }
    index = TAG.lastIndex;
  }
  if (stack.length > 0) throw new Error(`unclosed elements: ${stack.join(', ')}`);
}

function checkText(text: string): void {
  if (text.includes('>') || text.includes('<')) {
    throw new Error(`stray angle bracket in text: ${text.slice(0, 60)}`);
  }
  const badAmp = /&(?!(amp|lt|gt|quot|#39|#x?[0-9a-fA-F]+);)/.exec(text);
  if (badAmp) throw new Error(`unescaped ampersand near: ${text.slice(badAmp.index, badAmp.index + 40)}`);
}
