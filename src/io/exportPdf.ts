/**
 * PDF export.
 *
 * Not "print, then choose Save as PDF": that route lets the browser stamp the
 * filename, date and URL into the page corners, and a page cannot switch those
 * off. They exist because `@page` reserves a margin for the browser to draw
 * them in — so this export gives the page *no* margin at all and supplies the
 * document's own margins from inside the flow instead. With nowhere to put
 * them, the browser omits them entirely.
 *
 * That works because the editor has already paginated exactly. Drop the
 * on-screen gutter and the flow's stride becomes precisely one page tall, with
 * the page margins already sitting inside it as the spacers this pass
 * computed. The browser then cuts every 11in and lands on the same boundaries
 * the screen shows — so the PDF is the screen, page for page.
 */

import { desktop } from './desktop';
import { exportThroughWindow } from './exportWindow';
import { pageBoxCss } from './pageBox';
import { PAGE_SIZES } from '../editor/geometry';
import type { PageSizeName } from '../editor/geometry';
import type { DocumentLayout } from './documentFile';

const STYLE_ID = 'hwp-export-styles';

/** Long enough for pagination to re-settle after the gutter is dropped. */
const SETTLE_MS = 400;

/** How long to hold the export layout if `afterprint` never arrives. */
const PRINT_TIMEOUT_MS = 120000;

/** Exported so the pagination checks can put a page into export state. */
export function exportStyles(pageSize: PageSizeName): string {
  return `
${pageBoxCss(pageSize, '0')}

@media print {
  html.hwp-exporting .app-canvas {
    padding: 0 !important;
    display: block !important;
  }

  /* Inset the content column by one page margin from the paper's left edge,
     and open the first page's top margin. Every later page gets its margins
     from the spacers already in the flow. */
  html.hwp-exporting .hwp-page-stack {
    width: var(--content-w) !important;
    margin: var(--margin) 0 0 var(--margin) !important;
    padding: 0 !important;
  }
  html.hwp-exporting .hwp-doc .ProseMirror {
    width: var(--content-w) !important;
  }

  /* The spacers ARE the page margins here, so they must survive. */
  html.hwp-exporting .hwp-page-spacer { display: block !important; }

  /* And so must the mask. A block split across pages is one element spanning
     the break, so its background and border would otherwise paint straight
     through the margin at the top of the continuation page. */
  html.hwp-exporting .hwp-mask-layer { display: block !important; }

  /* The layout is already decided; leave the browser no reason to break
     anywhere except at the page boundary it is cutting on. */
  html.hwp-exporting .hwp-doc *,
  html.hwp-exporting .hwp-doc *::before,
  html.hwp-exporting .hwp-doc *::after {
    break-inside: auto !important;
    break-before: auto !important;
    break-after: auto !important;
    orphans: 1 !important;
    widows: 1 !important;
  }
  html.hwp-exporting .hwp-doc .hwp-hard-break { break-after: auto !important; }
}
`;
}

/** PDF's own ceiling: 200 inches on a side. Beyond it, pages are the only way. */
const MAX_PDF_EDGE = 200 * 96;

/**
 * A continuous document exports as a single page as tall as itself.
 *
 * The paper is sized to the content rather than the content cut to the paper,
 * so there are no breaks to place and nothing to split — which is the whole
 * reason the mode exists. Width and padding are restated here because the
 * print stylesheet collapses the editing column, and the height measured on
 * screen would not survive that.
 */
function continuousStyles(width: number, height: number): string {
  return `
@page { size: ${width}px ${height}px; margin: 0; }

@media print {
  html.hwp-exporting .app-canvas { padding: 0 !important; display: block !important; }
  html.hwp-exporting .hwp-page-stack {
    width: ${width}px !important;
    padding: var(--margin) !important;
    margin: 0 !important;
    background: #fff !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  html.hwp-exporting .hwp-doc .ProseMirror { width: 100% !important; min-height: 0 !important; }

  /* One page, so nothing may decide to start a new one. */
  html.hwp-exporting .hwp-doc *,
  html.hwp-exporting .hwp-doc *::before,
  html.hwp-exporting .hwp-doc *::after {
    break-inside: auto !important;
    break-before: auto !important;
    break-after: auto !important;
    orphans: 1 !important;
    widows: 1 !important;
  }
  html.hwp-exporting .hwp-doc .hwp-hard-break { break-after: auto !important; }
}
`;
}

/**
 * Print, and wait for the dialog to close.
 *
 * `window.print()` does not reliably block — called from a promise
 * continuation, Chrome returns immediately — so anything that undoes the print
 * layout on the next line pulls the page out from under the preview while it
 * is still rendering. The dialog flashes up and vanishes.
 */
export async function printAndWait(): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('afterprint', done);
      window.clearTimeout(timer);
      resolve();
    };
    // A browser that never fires afterprint must not strand the document in
    // export layout for the rest of the session.
    const timer = window.setTimeout(done, PRINT_TIMEOUT_MS);
    window.addEventListener('afterprint', done);
    window.print();
  });
}

export type ExportHooks = {
  /** Switch the document into export geometry (no gutter) and re-paginate. */
  prepare: () => void;
  /** Put the on-screen geometry back. */
  restore: () => void;
  title: string;
  /** The paper the document is measured for; the page box must agree. */
  pageSize: PageSizeName;
  /** Continuous exports one tall page; paged exports the pages as measured. */
  layout: DocumentLayout;
};

/** The saved path in the desktop shell; null in a browser, which cannot know. */
export async function exportPdf({
  prepare,
  restore,
  title,
  pageSize,
  layout,
}: ExportHooks): Promise<string | null> {
  /* In a browser the document is copied into a window of its own rather than
     the editor being restyled around the print dialog. The shell has no dialog
     to protect — it renders the page it is already showing straight to bytes —
     so it keeps the in-place path, which is also the one the pagination checks
     drive. */
  if (!desktop()) return exportThroughWindow({ title, pageSize, layout });

  const style = document.createElement('style');
  style.id = STYLE_ID;

  const continuous = layout === 'continuous';
  const previousTitle = document.title;

  try {
    // Paged export re-paginates with no gutter so the flow's stride is exactly
    // one page. A continuous document has no gutter to drop.
    if (!continuous) prepare();
    document.documentElement.classList.add('hwp-exporting');

    if (continuous) {
      const stack = document.querySelector<HTMLElement>('.hwp-page-stack');
      const width = PAGE_SIZES[pageSize].width;
      // Measured with the export width already in force, so the height cannot
      // drift between what is measured and what is rendered.
      style.textContent = continuousStyles(width, 0);
      document.head.appendChild(style);
      await new Promise((resolve) => window.setTimeout(resolve, 60));

      const height = Math.ceil(stack?.getBoundingClientRect().height ?? PAGE_SIZES[pageSize].height);
      if (height > MAX_PDF_EDGE) {
        // Too tall for a PDF page to exist. Say so rather than writing a file
        // that quietly ends early.
        throw new RangeError(
          'This document is too long for a single continuous page. Switch the layout to Pages and export again.',
        );
      }
      style.textContent = continuousStyles(width, height);
    } else {
      style.textContent = exportStyles(pageSize);
      document.head.appendChild(style);
    }

    // The browser offers this as the PDF's filename.
    document.title = title;
    await new Promise((resolve) => window.setTimeout(resolve, SETTLE_MS));

    /**
     * In the shell this is the whole interaction: Chromium renders the page it
     * is already showing — export styles and all — and the bytes are written
     * where the save dialog said. No print dialog, and nothing to remember to
     * choose. In a tab there is no such API, so the print pipeline is the
     * renderer and the person at the keyboard is the last step.
     */
    const shell = desktop();
    if (shell) {
      const saved = await shell.exportPdf({ suggestedName: `${title}.pdf` });
      return saved?.path ?? null;
    }

    await printAndWait();
    return null;
  } finally {
    document.title = previousTitle;
    document.documentElement.classList.remove('hwp-exporting');
    style.remove();
    restore();
  }
}
