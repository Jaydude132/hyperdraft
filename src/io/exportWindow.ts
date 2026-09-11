import { PAGE_SIZES } from '../editor/geometry';
import type { PageSizeName } from '../editor/geometry';
import type { DocumentLayout } from './documentFile';

/**
 * Export a PDF through a window of its own.
 *
 * The editor used to be restyled in place for the length of a print: a class
 * on `<html>`, a stylesheet appended, the geometry re-paginated, and all of it
 * undone afterwards. That works, but it puts the print dialog on top of a live
 * React application with a resize observer, a measurement loop and, in
 * development, a hot-reload socket — any of which can move the page while the
 * preview is being rendered, and a preview whose page moves is a preview that
 * closes.
 *
 * So the document is copied into a blank window instead. The copy is the live
 * DOM, not a re-render: the measured spacers, the row breaks and the mask are
 * all real elements in the clone, so a paged export still lands on exactly the
 * boundaries the screen shows. Nothing in the editor is touched, there is
 * nothing to restore, and the only thing the dialog can see is the document.
 */

/** PDF's own ceiling: 200 inches on a side. Beyond it, pages are the only way. */
const MAX_PDF_EDGE = 200 * 96;

/** Give the copy time to lay out and its fonts time to arrive. */
const SETTLE_MS = 250;

export type WindowExport = {
  title: string;
  pageSize: PageSizeName;
  layout: DocumentLayout;
};

function styleSheets(): string {
  return [...document.querySelectorAll('style, link[rel="stylesheet"]')]
    .map((node) => node.outerHTML)
    .join('\n');
}

/** Chrome for the editor that has no business on paper. */
function stripEditorChrome(stack: HTMLElement): void {
  stack.querySelector('.hwp-grip-layer')?.remove();
  for (const bar of stack.querySelectorAll('.hwp-codeblock-bar')) bar.remove();
  for (const handle of stack.querySelectorAll('.column-resize-handle')) handle.remove();
  for (const editable of stack.querySelectorAll('[contenteditable]')) {
    editable.removeAttribute('contenteditable');
  }
  stack.removeAttribute('style-nonce');
}

function layoutStyles(layout: DocumentLayout, pageSize: PageSizeName, height: number): string {
  const { width } = PAGE_SIZES[pageSize];

  const shared = `
  html, body { margin: 0; padding: 0; background: #fff; }
  body { display: block; }
  .hwp-page-stack { position: relative; }
  .hwp-sheet { box-shadow: none !important; border-radius: 0 !important; }

  /* The layout is already decided; leave nothing a reason to break anywhere
     except where this page box cuts. */
  .hwp-doc *, .hwp-doc *::before, .hwp-doc *::after {
    break-inside: auto !important;
    break-before: auto !important;
    break-after: auto !important;
    orphans: 1 !important;
    widows: 1 !important;
  }

  /* The code block's live controls are gone; the stylesheet's labels take
     their place, as they do in any saved file. */
  .hwp-doc .hwp-codeblock pre[data-language]::before { content: attr(data-language); }
  .hwp-doc .hwp-codeblock pre[data-filename]::after { content: attr(data-filename); }
`;

  if (layout === 'continuous') {
    return `
@page { size: ${width}px ${height}px; margin: 0; }
${shared}
  .hwp-page-stack {
    width: ${width}px;
    margin: 0;
    padding: var(--margin);
    box-shadow: none;
    border-radius: 0;
  }
  .hwp-page-stack .ProseMirror { width: 100%; min-height: 0; }
  .hwp-sheet-layer, .hwp-mask-layer { display: none; }
`;
  }

  return `
@page { size: ${pageSize}; margin: 0; }
${shared}
  /* Inset by one page margin: every later page's margins are already in the
     flow, as the spacers the measurement pass computed. */
  .hwp-page-stack {
    width: var(--content-w);
    margin: var(--margin) 0 0 var(--margin);
    padding: 0;
  }
  .hwp-page-spacer { display: block !important; }
  /* A block split across a boundary is one element spanning the break, so the
     mask is what stops its background painting through the margin. */
  .hwp-mask-layer { display: block !important; }
  .hwp-sheet-layer { display: none; }
`;
}

export async function exportThroughWindow({ title, pageSize, layout }: WindowExport): Promise<null> {
  const stack = document.querySelector<HTMLElement>('.hwp-page-stack');
  if (!stack) throw new Error('There is no document to export.');

  // Opened before anything is awaited, while the click that asked for it is
  // still the reason the browser is doing anything.
  const target = window.open('', '_blank', 'width=980,height=1100');
  if (!target) {
    throw new Error('The export window was blocked. Allow pop-ups for this page and try again.');
  }

  const clone = stack.cloneNode(true) as HTMLElement;
  stripEditorChrome(clone);

  const height = Math.ceil(stack.getBoundingClientRect().height);
  if (layout === 'continuous' && height > MAX_PDF_EDGE) {
    target.close();
    throw new RangeError(
      'This document is too long for a single continuous page. Switch the layout to Pages and export again.',
    );
  }

  target.document.write(
    `<!doctype html><html><head><meta charset="utf-8">` +
      // Relative stylesheet and font URLs are resolved against the app, not
      // about:blank, which is where this document actually lives.
      `<base href="${document.baseURI}">` +
      styleSheets() +
      `<style>${layoutStyles(layout, pageSize, height)}</style>` +
      // The browser offers this as the PDF's filename.
      `<title>${title.replace(/[<&]/g, '')}</title>` +
      `</head><body>${clone.outerHTML}</body></html>`,
  );
  target.document.close();

  await new Promise<void>((resolve) => {
    const ready = () => window.setTimeout(resolve, SETTLE_MS);
    if (target.document.readyState === 'complete') ready();
    else target.addEventListener('load', ready, { once: true });
  });
  await target.document.fonts?.ready;

  target.focus();
  target.print();
  // Closing immediately would take the preview with it in browsers where
  // print() does not block, so the window closes when printing is done — or
  // when the person closes it themselves.
  target.addEventListener('afterprint', () => target.close());
  return null;
}
