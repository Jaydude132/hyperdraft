import { PAGE_SIZES } from '../editor/geometry';
import type { PageSizeName } from '../editor/geometry';
import type { DocumentLayout } from './documentFile';

/**
 * Export a PDF through a frame.
 *
 * Two earlier arrangements failed in ways worth recording. Restyling the
 * editor in place put the print dialog on top of a live React application
 * whose resize observer and measurement loop kept moving the page underneath
 * it. Copying the document into a popup window fixed that, but a popup is not
 * a document the browser will print on request: Chrome opened the dialog and
 * dismissed it again, which is the flash — `print()` was called, and declined.
 *
 * A hidden frame is the arrangement that works. The dialog belongs to the
 * window the person is actually using, so nothing about focus or activation is
 * in question, and the frame's own document is what gets printed: its styles,
 * its `@page`, and nothing of the application around it. No popup to block, no
 * second window to leave behind.
 *
 * The copy is of the live DOM rather than a re-render, so the measured
 * spacers, the row breaks and the mask come with it and a paged export lands
 * exactly where the screen says it will.
 */

/** PDF's own ceiling: 200 inches on a side. Beyond it, pages are the only way. */
const MAX_PDF_EDGE = 200 * 96;

/** Give the copy time to lay out and its fonts time to arrive. */
const SETTLE_MS = 300;

/** Wide enough that the copy lays out at its real width, and out of sight. */
const FRAME_ID = 'hwp-export-frame';

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
  const pageHeight = layout === 'continuous' ? `${height}px` : null;

  /* Everything here is `!important` on purpose. These rules are overriding the
     application's own screen styling of the very same elements — and losing
     that fight silently is what put a drop shadow and a rounded corner on the
     exported page, jammed against the left edge of the window. */
  return `
@page { size: ${pageHeight ? `${width}px ${pageHeight}` : pageSize}; margin: 0; }

html, body { margin: 0 !important; padding: 0 !important; }

/* On screen this is a preview, so it sits on a desk like the editor does. On
   paper the page box is exactly the sheet, so the same element is flush. */
@media screen {
  body {
    display: flex !important;
    justify-content: center !important;
    padding: 28px 0 60px !important;
    background: #eceef2 !important;
  }
  .hwp-page-stack {
    box-shadow: 0 2px 6px rgba(20, 24, 33, 0.1), 0 12px 40px rgba(20, 24, 33, 0.14) !important;
  }
}
@media print {
  body { display: block !important; background: #fff !important; }
  .hwp-page-stack { box-shadow: none !important; }
}

.hwp-page-stack {
  position: relative !important;
  flex: none !important;
  border-radius: 0 !important;
  background: #fff !important;
  ${
    layout === 'continuous'
      ? `width: ${width}px !important;
  margin: 0 !important;
  padding: var(--margin) !important;`
      : `width: var(--content-w) !important;
  /* Inset by one page margin: every later page's margins are already in the
     flow, as the spacers the measurement pass computed. */
  margin: var(--margin) 0 0 var(--margin) !important;
  padding: 0 !important;`
  }
}
.hwp-page-stack .ProseMirror { width: 100% !important; min-height: 0 !important; }
.hwp-sheet-layer { display: none !important; }
${
  layout === 'continuous'
    ? `.hwp-mask-layer { display: none !important; }`
    : `.hwp-page-spacer { display: block !important; }
/* A block split across a boundary is one element spanning the break, so the
   mask is what stops its background painting through the margin. */
.hwp-mask-layer { display: block !important; }`
}

/* The layout is already decided; leave nothing a reason to break anywhere
   except where this page box cuts.

   print-color-adjust is the important one: Chrome's print dialog defaults
   "Background graphics" to off, which silently drops every fill, tint and
   shadow in the document — a styled table arrives as bare text. Declaring it
   "exact" overrides that default, and an export that loses the styling is not
   an export of the document. */
.hwp-page-stack, .hwp-page-stack *, .hwp-page-stack *::before, .hwp-page-stack *::after {
  print-color-adjust: exact !important;
  -webkit-print-color-adjust: exact !important;
}
.hwp-doc *, .hwp-doc *::before, .hwp-doc *::after {
  break-inside: auto !important;
  break-before: auto !important;
  break-after: auto !important;
  orphans: 1 !important;
  widows: 1 !important;
}

/* The code block's live controls are gone; the stylesheet's labels take their
   place, as they do in any saved file. */
.hwp-doc .hwp-codeblock pre[data-language]::before { content: attr(data-language); }
.hwp-doc .hwp-codeblock pre[data-filename]::after { content: attr(data-filename); }

/* The window's own controls, which are not part of the document. */
.hwp-export-bar {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 10;
  display: flex;
  gap: 8px;
  font: 500 12.5px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
.hwp-export-bar button {
  height: 30px;
  padding: 0 14px;
  border: 1px solid #d5d9e0;
  border-radius: 7px;
  background: #fff;
  color: #1c1f26;
  cursor: pointer;
}
.hwp-export-bar button.primary { background: #2f5fd0; border-color: #2f5fd0; color: #fff; }
@media print { .hwp-export-bar { display: none !important; } }
`;
}

export async function exportThroughWindow({ title, pageSize, layout }: WindowExport): Promise<null> {
  const stack = document.querySelector<HTMLElement>('.hwp-page-stack');
  if (!stack) throw new Error('There is no document to export.');

  const height = Math.ceil(stack.getBoundingClientRect().height);
  if (layout === 'continuous' && height > MAX_PDF_EDGE) {
    throw new RangeError(
      'This document is too long for a single continuous page. Switch the layout to Pages and export again.',
    );
  }

  const clone = stack.cloneNode(true) as HTMLElement;
  stripEditorChrome(clone);

  document.getElementById(FRAME_ID)?.remove();
  const frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  // Off-screen rather than tiny: a one-pixel viewport would lay the copy out
  // at one pixel, and the height measured here has to be the height printed.
  frame.style.cssText =
    `position: fixed; left: -20000px; top: 0; width: ${PAGE_SIZES[pageSize].width + 40}px;` +
    ' height: 1200px; border: 0; opacity: 0; pointer-events: none;';
  document.body.appendChild(frame);

  const inner = frame.contentDocument;
  const view = frame.contentWindow;
  if (!inner || !view) {
    frame.remove();
    throw new Error('The export frame could not be created.');
  }

  inner.open();
  inner.write(
    `<!doctype html><html><head><meta charset="utf-8">` +
      // Relative stylesheet and font URLs resolve against the application, not
      // against the blank document this frame starts as.
      `<base href="${document.baseURI}">` +
      styleSheets() +
      `<style>${layoutStyles(layout, pageSize, height)}</style>` +
      `<title>${title.replace(/[<&]/g, '')}</title>` +
      `</head><body>${clone.outerHTML}</body></html>`,
  );
  inner.close();

  await new Promise<void>((resolve) => {
    const ready = () => window.setTimeout(resolve, SETTLE_MS);
    if (inner.readyState === 'complete') ready();
    else view.addEventListener('load', ready, { once: true });
  });
  await inner.fonts?.ready;

  /* The browser names the file after the *top* document, not the frame's, so
     the title is borrowed for the length of the dialog. */
  const previousTitle = document.title;
  document.title = title;

  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    document.title = previousTitle;
    frame.remove();
  };
  window.addEventListener('afterprint', cleanup);
  // A browser that never fires afterprint must not leave the frame behind.
  window.setTimeout(cleanup, 120000);

  view.focus();
  view.print();
  return null;
}
