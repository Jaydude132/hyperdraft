import { desktop } from './desktop';
import { pageBoxCss } from './pageBox';
import { PAGE_SIZES } from '../editor/geometry';
import type { PageSizeName } from '../editor/geometry';
import { highlightCodeBlocks } from '../editor/highlighting';
import documentCss from '../styles/document.css?raw';
import printCss from '../styles/print.css?raw';

/**
 * The native format is a single self-contained .html file: the document's own
 * stylesheet plus semantic body markup. It opens in any browser, prints
 * correctly with no application installed, and diffs in git.
 */

export type DocumentFile = {
  title: string;
  theme: string;
  bodyHtml: string;
  /** The paper it was written for. A saved A4 file must print as A4. */
  pageSize: PageSizeName;
};

/* Screen presentation for a saved file opened directly in a browser. The print
   rules in printCss take over for paper. */
const STANDALONE_CSS = `
@media screen {
  html { background: #e4e7ec; }
  body.hwp-doc {
    max-width: 6.5in;
    margin: 0.75in auto;
    padding: 0.9in 1in;
    background: #fff;
    border-radius: 3px;
    box-shadow: 0 1px 2px rgba(20,24,33,.09), 0 6px 22px rgba(20,24,33,.08);
  }
}
@media print { body.hwp-doc { max-width: none; margin: 0; padding: 0; box-shadow: none; } }
`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function serializeDocument(doc: DocumentFile): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="hyperdraft">
<title>${escapeHtml(doc.title)}</title>
<style>
${documentCss.trim()}
${STANDALONE_CSS.trim()}
${printCss.trim()}
${pageBoxCss(doc.pageSize ?? 'Letter', '1in')}
</style>
</head>
<body class="hwp-doc" data-theme="${escapeHtml(doc.theme)}" data-page-size="${escapeHtml(doc.pageSize ?? 'Letter')}">
${highlightCodeBlocks(doc.bodyHtml)}
</body>
</html>
`;
}

export function parseDocument(html: string): DocumentFile {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const body = parsed.body;
  // Older saves put the code language in a real element inside <pre>, where it
  // reads back as part of the code. Drop it before the editor sees it.
  body?.querySelectorAll('.hwp-code-lang').forEach((node) => node.remove());
  const size = body?.getAttribute('data-page-size') ?? '';
  return {
    title: parsed.title || 'Untitled document',
    theme: body?.getAttribute('data-theme') || 'report',
    pageSize: (size in PAGE_SIZES ? size : 'Letter') as PageSizeName,
    bodyHtml: body?.innerHTML.trim() ?? '',
  };
}

/**
 * Documents are HTML, and are saved as such.
 *
 * The bytes were always self-contained HTML; a private extension only made
 * that harder to act on — a file you cannot double-click into a browser is
 * worth less than one you can, and the stylesheet travels inside either way.
 */
export const DOCUMENT_EXTENSION = '.html';

/** Extensions this has written before. They still open; they are not written. */
export const LEGACY_EXTENSIONS = ['.hyd', '.hwpd'];

function safeFileName(title: string, extension = DOCUMENT_EXTENSION): string {
  const base = title.trim().replace(/[^\w\s.-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  return `${base || 'document'}${extension}`;
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>;
};

const DOCUMENT_FILE_TYPE = {
  description: 'HTML document',
  accept: { 'text/html': ['.html', '.htm'] },
};

/** Only offered when opening: these are read, never written. */
const LEGACY_FILE_TYPE = {
  description: 'Hyperdraft document (older)',
  accept: { 'text/html': LEGACY_EXTENSIONS },
};

const MARKDOWN_FILE_TYPE = {
  description: 'Markdown',
  accept: { 'text/markdown': ['.md', '.markdown'] },
};

/**
 * A place a document came from. In a browser that is a file handle; in the
 * desktop shell it is a path. Callers only ever hand it back, so the two can
 * share one opaque type.
 */
export type DocumentHandle = FileSystemFileHandle | { desktopPath: string };

const pathOf = (handle?: DocumentHandle | null) =>
  handle && 'desktopPath' in handle ? handle.desktopPath : null;

const SAVE_TYPES = [DOCUMENT_FILE_TYPE];
const OPEN_TYPES = [DOCUMENT_FILE_TYPE, LEGACY_FILE_TYPE];

/** Returns the handle when the browser supports writing back to the same file. */
export async function saveDocument(
  doc: DocumentFile,
  handle?: DocumentHandle | null,
): Promise<DocumentHandle | null> {
  const html = serializeDocument(doc);
  const picker = window as FilePickerWindow;

  const shell = desktop();
  if (shell) {
    const saved = await shell.saveDocument({
      contents: html,
      suggestedName: safeFileName(doc.title),
      path: pathOf(handle),
    });
    // Cancelling must leave the document exactly as dirty as it was, which is
    // what the browser path signals by throwing.
    if (!saved) throw new DOMException('Save cancelled', 'AbortError');
    return { desktopPath: saved.path };
  }

  if (picker.showSaveFilePicker) {
    const target =
      handle ??
      (await picker.showSaveFilePicker({
        suggestedName: safeFileName(doc.title),
        types: SAVE_TYPES,
      }));
    const writable = await (target as FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
    await writable.write(html);
    await writable.close();
    return target;
  }

  // Fallback: download. There is no handle to write back to.
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName(doc.title);
  anchor.click();
  URL.revokeObjectURL(url);
  return null;
}

/**
 * Write the document out as markdown.
 *
 * Everything the styling model knows is dropped rather than smuggled out as
 * HTML — that is what makes it markdown. See `editor/markdown.ts`.
 */
export async function saveMarkdown(title: string, markdown: string): Promise<string | null> {
  const suggestedName = safeFileName(title, '.md');

  const shell = desktop();
  if (shell) {
    const saved = await shell.saveDocument({ contents: markdown, suggestedName, kind: 'markdown' });
    return saved?.path ?? null;
  }

  const picker = window as FilePickerWindow;
  if (picker.showSaveFilePicker) {
    const handle = await picker.showSaveFilePicker({ suggestedName, types: [MARKDOWN_FILE_TYPE] });
    const writable = await (
      handle as FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }
    ).createWritable();
    await writable.write(markdown);
    await writable.close();
    return suggestedName;
  }

  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return suggestedName;
}

export async function openDocument(): Promise<{ doc: DocumentFile; handle: DocumentHandle | null } | null> {
  const picker = window as FilePickerWindow;

  const shell = desktop();
  if (shell) {
    const file = await shell.openDocument();
    return file ? { doc: parseDocument(file.contents), handle: { desktopPath: file.path } } : null;
  }

  if (picker.showOpenFilePicker) {
    const [handle] = await picker.showOpenFilePicker({ types: OPEN_TYPES, multiple: false });
    if (!handle) return null;
    const file = await handle.getFile();
    return { doc: parseDocument(await file.text()), handle };
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${DOCUMENT_EXTENSION},.htm,${LEGACY_EXTENSIONS.join(',')},text/html`;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { doc: parseDocument(await file.text()), handle: null } : null);
    };
    input.click();
  });
}
