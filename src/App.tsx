import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
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
import { TabStrip } from './components/TabStrip';
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

const EMPTY_DOCUMENT = '<p></p>';

/**
 * One open document.
 *
 * The active one lives in the editor and its `html` is stale until it is
 * switched away from; the rest keep their content here. One editor rather than
 * one per tab is a deliberate trade: switching is instant and the pagination
 * pass only ever measures one document, at the cost of a per-tab undo history,
 * which `setContent` resets.
 */
type OpenDocument = {
  id: string;
  title: string;
  theme: string;
  pageSize: PageSizeName;
  handle: DocumentHandle | null;
  html: string;
  dirty: boolean;
};

let documentSerial = 0;
const nextDocumentId = () => `doc-${(documentSerial += 1)}`;

function countWords(instance: Editor): number {
  return instance.state.doc
    .textBetween(0, instance.state.doc.content.size, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function App() {
  const [tabs, setTabs] = useState<OpenDocument[]>(() => [
    {
      id: nextDocumentId(),
      title: 'Quarterly Field Report',
      theme: 'report',
      pageSize: 'Letter',
      handle: null,
      html: STARTER_DOCUMENT,
      dirty: false,
    },
  ]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [pageCount, setPageCount] = useState(1);
  const [words, setWords] = useState(0);

  /* The editor's own callbacks outlive any given render, so the document they
     should be writing to is read from a ref rather than captured. */
  const activeRef = useRef(activeId);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const { title, theme, pageSize, dirty } = active;

  const patchActive = useCallback((patch: Partial<OpenDocument>) => {
    setTabs((list) => list.map((tab) => (tab.id === activeRef.current ? { ...tab, ...patch } : tab)));
  }, []);
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
      setTabs((list) =>
        list.map((tab) =>
          tab.id === activeRef.current && !tab.dirty ? { ...tab, dirty: true } : tab,
        ),
      );
      setWords(countWords(instance));
    },
    onCreate: ({ editor: instance }) => {
      setWords(countWords(instance));
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
        active.handle,
      );
      patchActive({ handle, dirty: false });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') console.error(error);
    }
  }, [editor, title, theme, pageSize, active.handle, patchActive]);

  const handleOpen = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await openDocument();
      if (!result) return;
      openInTab({
        title: result.doc.title,
        theme: result.doc.theme,
        pageSize: result.doc.pageSize,
        handle: result.handle,
        html: result.doc.bodyHtml,
      });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') console.error(error);
    }
  }, [editor]);

  /** Park the editor's content back on its own tab before leaving it. */
  const stashActive = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    setTabs((list) => list.map((tab) => (tab.id === activeRef.current ? { ...tab, html } : tab)));
  }, [editor]);

  /** Load a document into the editor without marking it as edited. */
  const load = useCallback(
    (html: string) => {
      if (!editor) return;
      editor.commands.setContent(html, { emitUpdate: false });
      setWords(countWords(editor));
    },
    [editor],
  );

  const openInTab = useCallback(
    (document: Omit<OpenDocument, 'id' | 'dirty'>) => {
      if (!editor) return;
      stashActive();
      const opened: OpenDocument = { ...document, id: nextDocumentId(), dirty: false };
      setTabs((list) => [...list, opened]);
      setActiveId(opened.id);
      activeRef.current = opened.id;
      load(opened.html);
    },
    [editor, stashActive, load],
  );

  const newDocument = useCallback(() => {
    // A new document inherits the look of the one being worked on, which is
    // nearly always right when writing a set of them.
    openInTab({
      title: 'Untitled document',
      theme,
      pageSize,
      handle: null,
      html: EMPTY_DOCUMENT,
    });
  }, [openInTab, theme, pageSize]);

  const selectDocument = useCallback(
    (id: string) => {
      if (!editor || id === activeRef.current) return;
      const next = tabs.find((tab) => tab.id === id);
      if (!next) return;
      stashActive();
      setActiveId(id);
      activeRef.current = id;
      load(next.html);
    },
    [editor, tabs, stashActive, load],
  );

  const closeDocument = useCallback(
    (id: string) => {
      const doomed = tabs.find((tab) => tab.id === id);
      if (!editor || !doomed) return;
      if (doomed.dirty && !window.confirm(`“${doomed.title}” has unsaved changes. Close it anyway?`)) {
        return;
      }

      const remaining = tabs.filter((tab) => tab.id !== id);
      const closingActive = id === activeRef.current;

      // Closing the last one leaves a blank document rather than no document:
      // an editor with nothing to edit is a broken-looking window.
      if (remaining.length === 0) {
        const fresh: OpenDocument = {
          id: nextDocumentId(),
          title: 'Untitled document',
          theme,
          pageSize,
          handle: null,
          html: EMPTY_DOCUMENT,
          dirty: false,
        };
        setTabs([fresh]);
        setActiveId(fresh.id);
        activeRef.current = fresh.id;
        load(EMPTY_DOCUMENT);
        return;
      }

      if (closingActive) {
        const index = tabs.findIndex((tab) => tab.id === id);
        const next = remaining[Math.min(index, remaining.length - 1)];
        setActiveId(next.id);
        activeRef.current = next.id;
        load(next.html);
      }
      setTabs(remaining);
    },
    [editor, tabs, theme, pageSize, load],
  );

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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        newDocument();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        closeDocument(activeRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, handleOpen, handlePrint, newDocument, closeDocument]);

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
          onChange={(event) => patchActive({ title: event.target.value, dirty: true })}
        />
        <div className="app-titlebar-spacer" />
        <select
          className="tb-select"
          value={theme}
          aria-label="Document theme"
          onChange={(event) => patchActive({ theme: event.target.value, dirty: true })}
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
          onChange={(event) => patchActive({ pageSize: event.target.value as PageSizeName })}
        >
          <option value="Letter">Letter</option>
          <option value="A4">A4</option>
        </select>
      </div>

      {tabs.length > 1 ? (
        <TabStrip
          tabs={tabs}
          activeId={activeId}
          onSelect={selectDocument}
          onClose={closeDocument}
          onNew={newDocument}
        />
      ) : null}

      {editor ? (
        <div className="app-ribbon">
          <Toolbar
            editor={editor}
            onNew={newDocument}
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
