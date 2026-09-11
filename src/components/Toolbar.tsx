import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { isInsideNode } from '../editor/selection';
import { TableSizePicker } from './TableSizePicker';
import { AttributePicker } from './AttributePicker';
import {
  IconBulletList,
  IconCallout,
  IconCode,
  IconCodeBlock,
  IconHighlight,
  IconLink,
  IconOpen,
  IconImage,
  IconNewDoc,
  IconOrderedList,
  IconTaskList,
  IconPageBreak,
  IconExport,
  IconQuote,
  IconRedo,
  IconRule,
  IconSave,
  IconSvgBlock,
  IconTable,
  IconUndo,
} from './icons';

const STARTER_SVG = `<svg viewBox="0 0 420 120" role="img" aria-label="Diagram" style="width:100%;max-width:420px">
  <rect x="6" y="26" width="120" height="68" rx="12" fill="#f4f6fa" stroke="#c2c8d2"/>
  <rect x="150" y="26" width="120" height="68" rx="12" fill="#f4f6fa" stroke="#c2c8d2"/>
  <rect x="294" y="26" width="120" height="68" rx="12" fill="#e5ecfb" stroke="#2f5fd0"/>
  <path d="M126 60h24M270 60h24" stroke="#8a919e" stroke-width="1.5"/>
  <path d="M144 56l6 4-6 4M288 56l6 4-6 4" fill="none" stroke="#8a919e" stroke-width="1.5"/>
  <text x="66" y="65" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#4a5160">Draft</text>
  <text x="210" y="65" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#4a5160">Review</text>
  <text x="354" y="65" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#2f5fd0">Print</text>
</svg>`;

type ToolbarProps = {
  editor: Editor;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: (anchor: { x: number; y: number }) => void;
  onEditMarkup: () => void;
  /** Only to re-read the theme's own font when the document theme changes. */
  theme: string;
};

type ButtonProps = {
  title: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
};

function TbButton({ title, onClick, active, disabled, children }: ButtonProps) {
  return (
    <button
      type="button"
      className="tb-btn"
      data-tip={title}
      aria-label={title}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Offered typefaces. System stacks only, so a document needs no network. */
const FONT_FAMILIES = [
  { value: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif', label: 'Inter' },
  { value: 'Charter, "Iowan Old Style", "Palatino Linotype", Georgia, serif', label: 'Charter' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: '"SF Mono", ui-monospace, Menlo, monospace', label: 'SF Mono' },
].map((font) => ({ ...font, style: font.value ? { fontFamily: font.value } : undefined }));

const FONT_SIZES = ['8', '9', '10', '10.5', '11', '12', '14', '16', '18', '24', '30', '36', '48', '60', '72'].map(
  (size) => ({ value: `${size}pt`, label: size }),
);

const BLOCK_STYLES: { value: string; label: string }[] = [
  { value: 'paragraph', label: 'Body' },
  { value: 'h1', label: 'Title' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Eyebrow' },
  { value: 'blockquote', label: 'Quote' },
  { value: 'codeBlock', label: 'Code' },
];

export function Toolbar({ editor, onNew, onOpen, onSave, onExport, onEditMarkup, theme }: ToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerHost = useRef<HTMLSpanElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      codeBlock: isInsideNode(e, 'codeBlock'),
      callout: e.isActive('callout'),
      rawSelected: e.isActive('rawHtml'),
      taskList: e.isActive('taskList'),
      fontFamily: (e.getAttributes('textStyle').fontFamily as string) || '',
      fontSize: (e.getAttributes('textStyle').fontSize as string) || '',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      block: e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : e.isActive('heading', { level: 4 })
              ? 'h4'
              : e.isActive('heading', { level: 5 })
                ? 'h5'
                : e.isActive('heading', { level: 6 })
                  ? 'h6'
                  : e.isActive('blockquote')
                ? 'blockquote'
                : e.isActive('codeBlock')
                  ? 'codeBlock'
                  : 'paragraph',
    }),
  });

  /**
   * What the pickers show when nothing is set: the theme's actual font and
   * size, read off the rendered document. Naming them here instead would put
   * a second copy of the stylesheet's values in the code, free to drift.
   */
  const [themeDefaults, setThemeDefaults] = useState({ family: 'Default', size: '' });

  /**
   * What the pickers show when nothing is set: the theme's actual font and
   * size, read off the rendered document. Naming them here instead would put
   * a second copy of the stylesheet's values in the code, free to drift.
   * Read after paint, not during render — the editor's styles are not
   * resolved yet at render time and the family comes back empty.
   */
  useEffect(() => {
    const styles = getComputedStyle(editor.view.dom);
    const stack = styles.fontFamily || '';
    const known = FONT_FAMILIES.find(
      (font) => font.value && stack.replace(/["']/g, '') === font.value.replace(/["']/g, ''),
    );
    const firstFamily = stack.split(',')[0].replace(/["']/g, '').trim();
    const points = (Number.parseFloat(styles.fontSize) || 14) * (72 / 96);
    setThemeDefaults({
      family: known?.label || firstFamily || 'Default',
      size: `${Math.round(points * 10) / 10}`,
    });
  }, [editor, theme]);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (event: MouseEvent) => {
      if (!pickerHost.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setPickerOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [pickerOpen]);

  const applyBlockStyle = (value: string) => {
    const chain = editor.chain().focus();
    if (value === 'paragraph') chain.clearNodes().setParagraph().run();
    else if (value === 'blockquote') chain.clearNodes().toggleBlockquote().run();
    else if (value === 'codeBlock') chain.clearNodes().toggleCodeBlock().run();
    else chain.clearNodes().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };

  const insertImage = () => {
    const src = window.prompt('Image URL');
    if (!src) return;
    editor.chain().focus().setImage({ src }).run();
  };

  const setLink = () => {
    const previous = (editor.getAttributes('link').href as string) || '';
    const href = window.prompt('Link URL', previous);
    if (href === null) return;
    if (href === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="app-toolbar" role="toolbar" aria-label="Formatting">
      <div className="tb-row">
      <TbButton title="New document — ⌘N" onClick={onNew}>
        <IconNewDoc />
      </TbButton>
      <TbButton title="Open document" onClick={onOpen}>
        <IconOpen />
      </TbButton>
      <TbButton title="Save document" onClick={onSave}>
        <IconSave />
      </TbButton>
      <TbButton
        title="Export — PDF or Markdown"
        onClick={(event) => {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          onExport({ x: rect.left, y: rect.bottom + 4 });
        }}
      >
        <IconExport />
      </TbButton>

      <div className="tb-sep" />

      <TbButton title="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <IconUndo />
      </TbButton>
      <TbButton title="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <IconRedo />
      </TbButton>

      <div className="tb-sep" />

      <div className="tb-group">
      <AttributePicker
        options={BLOCK_STYLES.map((style) => ({ value: style.value, label: style.label }))}
        value={state.block}
        label="Paragraph style"
        width={124}
        menuWidth={150}
        onSelect={applyBlockStyle}
      />

      <AttributePicker
        options={FONT_FAMILIES}
        value={state.fontFamily}
        label="Font"
        placeholder={themeDefaults.family}
        width={140}
        menuWidth={210}
        onSelect={(value) =>
          value
            ? editor.chain().focus().setFontFamily(value).run()
            : editor.chain().focus().unsetFontFamily().run()
        }
      />

      <AttributePicker
        options={FONT_SIZES}
        value={state.fontSize}
        label="Font size"
        placeholder={themeDefaults.size}
        width={76}
        menuWidth={110}
        onSelect={(value) =>
          value
            ? editor.chain().focus().setFontSize(value).run()
            : editor.chain().focus().unsetFontSize().run()
        }
      />

      </div>

      <div className="tb-sep" />

      <TbButton title="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="tb-glyph tb-glyph--b">B</span>
      </TbButton>
      <TbButton title="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="tb-glyph tb-glyph--i">I</span>
      </TbButton>
      <TbButton title="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="tb-glyph tb-glyph--u">U</span>
      </TbButton>
      <TbButton title="Highlight" active={state.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <IconHighlight />
      </TbButton>
      <TbButton title="Inline code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}>
        <IconCode />
      </TbButton>
      <TbButton title="Link" active={state.link} onClick={setLink}>
        <IconLink />
      </TbButton>

      </div>

      <div className="tb-row">
      <TbButton title="Bulleted list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <IconBulletList />
      </TbButton>
      <TbButton title="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <IconOrderedList />
      </TbButton>
      <TbButton title="Task list" active={state.taskList} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <IconTaskList />
      </TbButton>
      <TbButton title="Block quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <IconQuote />
      </TbButton>
      <TbButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <IconRule />
      </TbButton>

      <div className="tb-sep" />

      <TbButton title="Bordered section" active={state.callout} onClick={() => editor.chain().focus().toggleCallout('plain').run()}>
        <IconCallout />
      </TbButton>

      <TbButton title="Insert image" onClick={insertImage}>
        <IconImage />
      </TbButton>

      <TbButton title="Code block" active={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <IconCodeBlock />
      </TbButton>

      <span className="tb-popover-host" ref={pickerHost}>
        <TbButton title="Insert table" onClick={() => setPickerOpen((open) => !open)}>
          <IconTable />
        </TbButton>
        {pickerOpen ? (
          <TableSizePicker
            anchor={pickerHost.current}
            onPick={(rows, cols, withHeaderRow) => {
              setPickerOpen(false);
              editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run();
            }}
          />
        ) : null}
      </span>

      <TbButton title="Insert SVG or raw HTML" onClick={() => editor.chain().focus().insertRawHtml(STARTER_SVG).run()}>
        <IconSvgBlock />
      </TbButton>

      <TbButton title="Edit block markup" disabled={!state.rawSelected} onClick={onEditMarkup}>
        <span className="tb-glyph" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          {'</>'}
        </span>
      </TbButton>

      <TbButton title="Page break (Cmd+Enter)" onClick={() => editor.chain().focus().insertPageBreak().run()}>
        <IconPageBreak />
      </TbButton>
      </div>

    </div>
  );
}
