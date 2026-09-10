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
import { pageBoxCss } from './pageBox';
import type { PageSizeName } from '../editor/geometry';

const STYLE_ID = 'hwp-export-styles';

/** Long enough for pagination to re-settle after the gutter is dropped. */
const SETTLE_MS = 400;

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

export type ExportHooks = {
  /** Switch the document into export geometry (no gutter) and re-paginate. */
  prepare: () => void;
  /** Put the on-screen geometry back. */
  restore: () => void;
  title: string;
  /** The paper the document is measured for; the page box must agree. */
  pageSize: PageSizeName;
};

/** The saved path in the desktop shell; null in a browser, which cannot know. */
export async function exportPdf({ prepare, restore, title, pageSize }: ExportHooks): Promise<string | null> {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = exportStyles(pageSize);

  const previousTitle = document.title;

  try {
    prepare();
    document.head.appendChild(style);
    document.documentElement.classList.add('hwp-exporting');

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

    window.print();
    return null;
  } finally {
    document.title = previousTitle;
    document.documentElement.classList.remove('hwp-exporting');
    style.remove();
    restore();
  }
}
