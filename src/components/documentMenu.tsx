import type { Editor } from '@tiptap/react';
import type { MenuEntry } from './ContextMenu';
import { isInsideNode } from '../editor/selection';
import {
  IconBorders,
  IconCallout,
  IconCodeBlock,
  IconColumnDelete,
  IconColumnLeft,
  IconColumnRight,
  IconCopy,
  IconCut,
  IconHeaderRow,
  IconMergeCells,
  IconPageBreak,
  IconPaste,
  IconRowAbove,
  IconRowBelow,
  IconRowDelete,
  IconSelectColumn,
  IconSelectRow,
  IconSelectTable,
  IconSplitCell,
  IconSvgBlock,
  IconTable,
  IconTableDelete,
} from './icons';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

async function pasteFromClipboard(editor: Editor) {
  try {
    if (navigator.clipboard?.read) {
      for (const item of await navigator.clipboard.read()) {
        if (item.types.includes('text/html')) {
          const html = await (await item.getType('text/html')).text();
          editor.chain().focus().insertContent(html).run();
          return;
        }
      }
    }
    const text = await navigator.clipboard.readText();
    if (text) editor.chain().focus().insertContent(text).run();
  } catch {
    // Reading the clipboard needs a permission the user may refuse. Nothing
    // useful to say here — the keyboard shortcut still works.
  }
}

export type MenuActions = {
  openStyles: () => void;
  openMarkup: () => void;
};

export function buildContextMenu(editor: Editor, actions: MenuActions): MenuEntry[] {
  const entries: MenuEntry[] = [];
  const inTable = isInsideNode(editor, 'table');
  const can = editor.can();

  entries.push(
    {
      kind: 'item',
      label: 'Cut',
      hint: `${MOD}X`,
      icon: <IconCut size={14} />,
      disabled: editor.state.selection.empty,
      run: () => {
        editor.commands.focus();
        document.execCommand('cut');
      },
    },
    {
      kind: 'item',
      label: 'Copy',
      hint: `${MOD}C`,
      icon: <IconCopy size={14} />,
      disabled: editor.state.selection.empty,
      run: () => {
        editor.commands.focus();
        document.execCommand('copy');
      },
    },
    {
      kind: 'item',
      label: 'Paste',
      hint: `${MOD}V`,
      icon: <IconPaste size={14} />,
      run: () => void pasteFromClipboard(editor),
    },
  );

  if (inTable) {
    entries.push(
      { kind: 'separator' },
      { kind: 'heading', label: 'Table' },
      {
        kind: 'item',
        label: 'Select row',
        icon: <IconSelectRow size={14} />,
        run: () => editor.chain().focus().selectRowAt(editor.state.selection.from).run(),
      },
      {
        kind: 'item',
        label: 'Select column',
        icon: <IconSelectColumn size={14} />,
        run: () => editor.chain().focus().selectColumnAt(editor.state.selection.from).run(),
      },
      {
        kind: 'item',
        label: 'Select table',
        icon: <IconSelectTable size={14} />,
        run: () => editor.chain().focus().selectTableAt(editor.state.selection.from).run(),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Insert row above',
        icon: <IconRowAbove size={14} />,
        disabled: !can.addRowBefore(),
        run: () => editor.chain().focus().addRowBefore().run(),
      },
      {
        kind: 'item',
        label: 'Insert row below',
        icon: <IconRowBelow size={14} />,
        disabled: !can.addRowAfter(),
        run: () => editor.chain().focus().addRowAfter().run(),
      },
      {
        kind: 'item',
        label: 'Insert column left',
        icon: <IconColumnLeft size={14} />,
        disabled: !can.addColumnBefore(),
        run: () => editor.chain().focus().addColumnBefore().run(),
      },
      {
        kind: 'item',
        label: 'Insert column right',
        icon: <IconColumnRight size={14} />,
        disabled: !can.addColumnAfter(),
        run: () => editor.chain().focus().addColumnAfter().run(),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Merge cells',
        icon: <IconMergeCells size={14} />,
        disabled: !can.mergeCells(),
        run: () => editor.chain().focus().mergeCells().run(),
      },
      {
        kind: 'item',
        label: 'Split cell',
        icon: <IconSplitCell size={14} />,
        disabled: !can.splitCell(),
        run: () => editor.chain().focus().splitCell().run(),
      },
      {
        kind: 'item',
        label: 'Toggle header row',
        icon: <IconHeaderRow size={14} />,
        disabled: !can.toggleHeaderRow(),
        run: () => editor.chain().focus().toggleHeaderRow().run(),
      },
      {
        kind: 'item',
        label: 'Table styles…',
        icon: <IconBorders size={14} />,
        run: actions.openStyles,
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Delete row',
        icon: <IconRowDelete size={14} />,
        danger: true,
        disabled: !can.deleteRow(),
        run: () => editor.chain().focus().deleteRow().run(),
      },
      {
        kind: 'item',
        label: 'Delete column',
        icon: <IconColumnDelete size={14} />,
        danger: true,
        disabled: !can.deleteColumn(),
        run: () => editor.chain().focus().deleteColumn().run(),
      },
      {
        kind: 'item',
        label: 'Delete table',
        icon: <IconTableDelete size={14} />,
        danger: true,
        disabled: !can.deleteTable(),
        run: () => editor.chain().focus().deleteTable().run(),
      },
    );
  }

  if (isInsideNode(editor, 'codeBlock')) {
    const dark = (editor.getAttributes('codeBlock').codeTheme ?? 'dark') !== 'light';
    entries.push(
      { kind: 'separator' },
      { kind: 'heading', label: 'Code block' },
      {
        kind: 'item',
        label: dark ? 'Use light theme' : 'Use dark theme',
        icon: <IconCodeBlock size={14} />,
        run: () =>
          editor
            .chain()
            .focus()
            .updateAttributes('codeBlock', { codeTheme: dark ? 'light' : 'dark' })
            .run(),
      },
      {
        kind: 'item',
        label: 'Code block styles…',
        icon: <IconBorders size={14} />,
        run: actions.openStyles,
      },
    );
  }

  if (isInsideNode(editor, 'callout') && !isInsideNode(editor, 'codeBlock')) {
    entries.push(
      { kind: 'separator' },
      { kind: 'heading', label: 'Section' },
      {
        kind: 'item',
        label: 'Section styles…',
        icon: <IconBorders size={14} />,
        run: actions.openStyles,
      },
    );
  }

  if (editor.isActive('rawHtml')) {
    entries.push(
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Edit markup…',
        icon: <IconSvgBlock size={14} />,
        run: actions.openMarkup,
      },
    );
  }

  if (!inTable) {
    entries.push(
      { kind: 'separator' },
      { kind: 'heading', label: 'Insert' },
      {
        kind: 'item',
        label: 'Bordered section',
        icon: <IconCallout size={14} />,
        run: () => editor.chain().focus().toggleCallout('plain').run(),
      },
      {
        kind: 'item',
        label: 'Code block',
        icon: <IconCodeBlock size={14} />,
        run: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        kind: 'item',
        label: 'Table',
        icon: <IconTable size={14} />,
        run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        kind: 'item',
        label: 'Page break',
        hint: `${MOD}⏎`,
        icon: <IconPageBreak size={14} />,
        run: () => editor.chain().focus().insertPageBreak().run(),
      },
    );
  }

  return entries;
}
