import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';

import { Toolbar } from './components/Toolbar';
import { ContextRibbon } from './components/ContextRibbon';
import { Tooltips } from './components/Tooltips';
import { ContextMenu } from './components/ContextMenu';
import type { MenuAnchor, MenuEntry } from './components/ContextMenu';
import { buildContextMenu } from './components/documentMenu';
import { StylePanel } from './components/StylePanel';
import { TableGrips } from './components/TableGrips';
import { PageSheets } from './components/PageSheets';
import { IconInfo, IconMark } from './components/icons';
import { SvgCheatSheet } from './components/SvgCheatSheet';
import { Callout } from './editor/extensions/Callout';
import { MarkdownPaste } from './editor/extensions/MarkdownPaste';
import { MarkdownRules } from './editor/extensions/MarkdownRules';
import { MarkdownTable } from './editor/extensions/MarkdownTable';
import { CodeBlock } from './editor/extensions/CodeBlock';
import { StyledTableView } from './editor/extensions/StyledTableView';
import { TableSelection } from './editor/extensions/TableSelection';
import { TableStyle } from './editor/extensions/TableStyle';
import { PageBreak } from './editor/extensions/PageBreak';
import { RawHtml } from './editor/extensions/RawHtml';
import { Pagination } from './editor/pagination';
import { geometryFor, type PageSizeName } from './editor/geometry';
import { STARTER_DOCUMENT } from './editor/starterDocument';
import { openDocument, saveDocument } from './io/documentFile';
import type { DocumentHandle } from './io/documentFile';
import { desktop } from './io/desktop';
import { setPageBox } from './io/pageBox';
import { exportPdf } from './io/exportPdf';

import './styles/document.css';
import './styles/print.css';

const THEMES = [
  { value: 'report', label: 'Report' },
  { value: 'manuscript', label: 'Manuscript' },
];

export default function App() {
  const [title, setTitle] = useState('Quarterly Field Report');
  const [theme, setTheme] = useState('report');
  const [pageSize, setPageSize] = useState<PageSizeName>('Letter');
  const [pageCount, setPageCount] = useState(1);
  const [words, setWords] = useState(0);
  const [dirty, setDirty] = useState(false);

  const fileHandle = useRef<DocumentHandle | null>(null);
  const markupDialog = useRef<HTMLDialogElement>(null);
  const [markupDraft, setMarkupDraft] = useState('');
  const [cheatOpen, setCheatOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const markupField = useRef<HTMLTextAreaElement>(null);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; entries: MenuEntry[] } | null>(null);

  /**
   * Geometry is a stable object the pagination plugin reads on every measure.
   * Changing the page size mutates it in place and nudges the view, which is
   * cheaper and less disruptive than rebuilding the editor.
   */
  const geometry = useRef(geometryFor('Letter'));
  const [geometryVersion, setGeometryVersion] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: { openOnClick: false, autolink: true },
        // Replaced by the lowlight-backed block with a language picker.
        codeBlock: false,
      }),
      CodeBlock,
      Highlight,
      TextStyleKit.configure({
        color: false,
        backgroundColor: false,
        lineHeight: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({ table: { resizable: true, View: StyledTableView } }),
      TableStyle,
      TableSelection,
      Callout,
      Image.configure({ inline: false, allowBase64: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      MarkdownRules,
      MarkdownTable,
      MarkdownPaste,
      PageBreak,
      RawHtml,
      Pagination.configure({
        geometry: geometry.current,
        onPageCount: setPageCount,
      }),
    ],
    content: STARTER_DOCUMENT,
    editorProps: {
      attributes: { class: 'hwp-doc-flow', spellcheck: 'true' },
    },
    onUpdate: ({ editor: instance }) => {
      setDirty(true);
      setWords(instance.state.doc.textBetween(0, instance.state.doc.content.size, ' ').trim().split(/\s+/).filter(Boolean).length);
    },
    onCreate: ({ editor: instance }) => {
      setWords(instance.state.doc.textBetween(0, instance.state.doc.content.size, ' ').trim().split(/\s+/).filter(Boolean).length);
    },
  });

  /**
   * Export bypasses the print dialog's page margins so the browser has nowhere
   * to stamp a filename, date or URL. See io/exportPdf.ts.
   */
  const applyGeometry = useCallback(
    (gutter?: number) => {
      Object.assign(geometry.current, geometryFor(pageSize, gutter));
      // Geometry lives in a ref so the pagination plugin can read it without
      // re-creating the editor — but the CSS custom properties below are
      // rendered, so they need a nudge or the stylesheet keeps the old stride
      // while the measurement pass uses the new one.
      setGeometryVersion((version) => version + 1);
      if (editor) editor.view.dispatch(editor.state.tr);
    },
    [editor, pageSize],
  );

  useEffect(() => {
    applyGeometry();
  }, [applyGeometry]);

  // Handle for scripts/check-pagination.mjs, which drives stress documents
  // through a real browser. Development only.
  useEffect(() => {
    if (!import.meta.env.DEV || !editor) return;
    const dev = window as unknown as Record<string, unknown>;
    dev.hwpEditor = editor;
    dev.hwpSetGutter = (gutter?: number) => applyGeometry(gutter);
  }, [editor, applyGeometry]);

  const stackStyle = useMemo(() => {
    const geo = geometry.current;
    return {
      '--page-w': `${geo.pageWidth}px`,
      '--page-h': `${geo.pageHeight}px`,
      '--margin': `${geo.margin}px`,
      '--content-w': `${geo.contentWidth}px`,
      '--content-h': `${geo.contentHeight}px`,
      '--stride': `${geo.stride}px`,
      '--sheet-gap': `${geo.gap}px`,
    } as CSSProperties;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, geometryVersion]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    try {
      const handle = await saveDocument(
        { title, theme, pageSize, bodyHtml: editor.getHTML() },
        fileHandle.current,
      );
      fileHandle.current = handle;
      setDirty(false);
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') console.error(error);
    }
  }, [editor, title, theme]);

  const handleOpen = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await openDocument();
      if (!result) return;
      fileHandle.current = result.handle;
      setTitle(result.doc.title);
      setTheme(result.doc.theme);
      setPageSize(result.doc.pageSize);
      editor.commands.setContent(result.doc.bodyHtml, { emitUpdate: true });
      setDirty(false);
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') console.error(error);
    }
  }, [editor]);

  const handlePrint = useCallback(() => {
    const shell = desktop();
    if (shell) {
      void shell.print();
      return;
    }
    const previous = document.title;
    document.title = title;
    window.print();
    document.title = previous;
  }, [title]);

  const handleExportPdf = useCallback(async () => {
    const saved = await exportPdf({
      title,
      pageSize,
      prepare: () => applyGeometry(0),
      restore: () => applyGeometry(),
    });
    // Only the shell knows where the file went; a tab hands off to the browser
    // and never hears the outcome.
    if (saved) setNotice(`Exported ${saved.split('/').pop()}`);
  }, [applyGeometry, title, pageSize]);

  /** The `@page` box has to be rewritten whenever the paper changes. */
  useEffect(() => {
    setPageBox(pageSize);
  }, [pageSize]);

  /** Transient status-bar messages clear themselves. */
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openMarkupEditor = useCallback(() => {
    if (!editor) return;
    setMarkupDraft(String(editor.getAttributes('rawHtml').html ?? ''));
    markupDialog.current?.showModal();
  }, [editor]);

  // Right-clicking inside the document replaces the browser menu with one
  // built from what is actually under the caret. The caret is moved to the
  // click first, so the entries describe the cell or block being pointed at
  // rather than wherever the selection happened to be.
  const handleContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      if (!editor) return;
      const target = event.target as HTMLElement;
      if (!editor.view.dom.contains(target)) return;
      event.preventDefault();

      const at = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (at && editor.state.selection.empty) editor.commands.setTextSelection(at.pos);

      setMenu({
        anchor: { x: event.clientX, y: event.clientY },
        entries: buildContextMenu(editor, {
          openStyles: () => setStylesOpen(true),
          openMarkup: () => {
            setMarkupDraft(String(editor.getAttributes('rawHtml').html ?? ''));
            markupDialog.current?.showModal();
          },
        }),
      });
    },
    [editor],
  );

  /** Drop a snippet in where the caret is, not at the end of whatever is there. */
  const insertMarkup = useCallback((snippet: string) => {
    const field = markupField.current;
    if (!field) {
      setMarkupDraft((draft) => draft + snippet);
      return;
    }
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    setMarkupDraft((draft) => draft.slice(0, start) + snippet + draft.slice(end));
    // After React has written the new value, put the caret past what was added.
    requestAnimationFrame(() => {
      field.focus();
      const at = start + snippet.length;
      field.setSelectionRange(at, at);
    });
  }, []);

  const commitMarkup = useCallback(() => {
    editor?.chain().focus().updateRawHtml(markupDraft).run();
    markupDialog.current?.close();
  }, [editor, markupDraft]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void handleOpen();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, handleOpen, handlePrint]);

  return (
    <div className="app">
      <div className="app-titlebar">
        <span className="app-mark">
          <IconMark />
        </span>
        <input
          className="app-title"
          value={title}
          spellCheck={false}
          aria-label="Document title"
          onChange={(event) => {
            setTitle(event.target.value);
            setDirty(true);
          }}
        />
        <div className="app-titlebar-spacer" />
        <select
          className="tb-select"
          value={theme}
          aria-label="Document theme"
          onChange={(event) => {
            setTheme(event.target.value);
            setDirty(true);
          }}
        >
          {THEMES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="tb-select"
          value={pageSize}
          aria-label="Page size"
          onChange={(event) => setPageSize(event.target.value as PageSizeName)}
        >
          <option value="Letter">Letter</option>
          <option value="A4">A4</option>
        </select>
      </div>

      {editor ? (
        <div className="app-ribbon">
          <Toolbar
            editor={editor}
            onOpen={handleOpen}
            onSave={handleSave}
            onExport={() => void handleExportPdf()}
            onEditMarkup={openMarkupEditor}
            theme={theme}
          />
          <ContextRibbon editor={editor} onOpenStyles={() => setStylesOpen(true)} />
        </div>
      ) : (
        <div className="app-ribbon">
          <div className="app-toolbar" />
        </div>
      )}

      <div className="app-canvas" onContextMenu={handleContextMenu}>
        <div className="hwp-page-stack hwp-doc" data-theme={theme} style={stackStyle}>
          <PageSheets pageCount={pageCount} />
          <EditorContent editor={editor} />
          {editor ? <TableGrips editor={editor} /> : null}
        </div>
      </div>

      <div className="app-statusbar">
        <span>
          <strong>{pageCount}</strong> {pageCount === 1 ? 'page' : 'pages'}
        </span>
        <span>
          <strong>{words.toLocaleString()}</strong> words
        </span>
        <div className="app-statusbar-spacer" />
        <span>{notice ?? (dirty ? 'Unsaved changes' : 'Saved')}</span>
      </div>

      {editor && stylesOpen ? (
        <StylePanel editor={editor} onClose={() => setStylesOpen(false)} />
      ) : null}

      {menu ? (
        <ContextMenu anchor={menu.anchor} entries={menu.entries} onClose={() => setMenu(null)} />
      ) : null}

      <Tooltips />

      <dialog className={`app-dialog${cheatOpen ? ' app-dialog--wide' : ''}`} ref={markupDialog}>
        <form method="dialog" onSubmit={(event) => event.preventDefault()}>
          <div className="app-dialog-head">
            <div>
              <h2>Block markup</h2>
              <p>HTML or SVG, written into the document verbatim.</p>
            </div>
            <button
              type="button"
              className={`tb-btn${cheatOpen ? ' is-on' : ''}`}
              aria-pressed={cheatOpen}
              data-tip="SVG reference and starting points"
              onClick={() => setCheatOpen((open) => !open)}
            >
              <IconInfo />
              <span className="tb-label">SVG help</span>
            </button>
          </div>

          <div className="app-dialog-body">
            <textarea
              ref={markupField}
              value={markupDraft}
              spellCheck={false}
              onChange={(event) => setMarkupDraft(event.target.value)}
            />
            {cheatOpen ? <SvgCheatSheet onInsert={insertMarkup} /> : null}
          </div>

          <div className="app-dialog-actions">
            <button type="button" className="tb-btn" onClick={() => markupDialog.current?.close()}>
              Cancel
            </button>
            <button type="button" className="tb-btn tb-btn--primary" onClick={commitMarkup}>
              Apply
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
