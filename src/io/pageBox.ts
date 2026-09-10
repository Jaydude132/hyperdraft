import type { PageSizeName } from '../editor/geometry';

/**
 * The `@page` box, kept in step with the page size on screen.
 *
 * `print.css` cannot do this on its own: `@page` accepts no custom properties,
 * so the rule has to be rewritten whenever the size changes. Left alone it
 * said `Letter` forever, and choosing A4 gave you a document measured for one
 * paper and cut on another — the flow drifting further out of step with every
 * page until lines were sliced in half.
 *
 * The rule is appended to the head, so it lands after the bundled stylesheet
 * and wins on document order. The export pass appends its own later still.
 */

const STYLE_ID = 'hwp-page-box';

export function pageBoxCss(size: PageSizeName, margin: string): string {
  return `@media print { @page { size: ${size}; margin: ${margin}; } }`;
}

export function setPageBox(size: PageSizeName, margin = '1in'): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = pageBoxCss(size, margin);
}
