/**
 * Pretty-print HTML and SVG for the markup editor.
 *
 * A raw block is usually a hand-written figure, and it arrives back from the
 * document as one unbroken line — the editor stores markup, not formatting.
 * Editing that is miserable, so it is laid out again on the way into the
 * dialog: one element per line, indented by depth, with short text kept on the
 * line that opens it.
 *
 * It formats by walking the parsed DOM rather than by matching angle brackets,
 * so it cannot produce markup that differs from what it was given. Content
 * whose whitespace is meaningful — `pre`, `script`, `style` — is passed
 * through untouched, because reindenting it would change what it says.
 */

const INDENT = '  ';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Tags with no closing tag in HTML. */
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Tags whose contents are text, exactly as written. */
const VERBATIM = new Set(['pre', 'script', 'style', 'textarea']);

/** Keep a line to something a person can read across. */
const LINE_BUDGET = 96;

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attributesOf(element: Element): string {
  return [...element.attributes]
    .map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
    .join('');
}

function serialize(node: Node, depth: number): string {
  const pad = INDENT.repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    return text ? pad + escapeText(text) : '';
  }

  if (node.nodeType === Node.COMMENT_NODE) return `${pad}<!--${node.nodeValue ?? ''}-->`;
  if (!(node instanceof Element)) return '';

  const tag = node.tagName.toLowerCase();
  const attributes = attributesOf(node);

  if (VERBATIM.has(tag)) return `${pad}<${tag}${attributes}>${node.innerHTML}</${tag}>`;

  if (!node.firstChild) {
    // SVG closes its own empty elements; HTML has a fixed list that may not.
    if (node.namespaceURI === SVG_NS || VOID.has(tag)) return `${pad}<${tag}${attributes} />`;
    return `${pad}<${tag}${attributes}></${tag}>`;
  }

  const onlyText =
    node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE;
  if (onlyText) {
    const text = escapeText((node.textContent ?? '').replace(/\s+/g, ' ').trim());
    const line = `${pad}<${tag}${attributes}>${text}</${tag}>`;
    if (line.length <= LINE_BUDGET) return line;
  }

  const children = [...node.childNodes]
    .map((child) => serialize(child, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `${pad}<${tag}${attributes}>\n${children}\n${pad}</${tag}>`;
}

export function formatMarkup(markup: string): string {
  const trimmed = markup.trim();
  if (!trimmed) return '';

  const parsed = new DOMParser().parseFromString(`<div id="hwp-format">${trimmed}</div>`, 'text/html');
  const root = parsed.getElementById('hwp-format');
  if (!root || !root.firstChild) return trimmed;

  const formatted = [...root.childNodes]
    .map((child) => serialize(child, 0))
    .filter(Boolean)
    .join('\n');

  // Anything that cannot be laid out is returned as it came, rather than
  // replaced by an empty box.
  return formatted.trim() || trimmed;
}
