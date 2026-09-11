import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { DOMParser as PMDOMParser, Fragment } from '@tiptap/pm/model';
import { documentToMarkdown } from '../markdown';
import { markdownToHtml } from './MarkdownPaste';

/**
 * Edit a block as markdown, in place.
 *
 * Ctrl- or Cmd-click a table, a code block, a list or a section and it turns
 * back into the markdown it would be written as; apply, and it renders again.
 * For anyone who thinks in markdown, this is faster than any amount of
 * ribbon: retyping a table's row is a line of pipes, not eight cell edits.
 *
 * The block is not replaced while it is being edited — it is hidden by a
 * decoration, with the source shown in a widget beside it. Nothing enters the
 * document until Apply, so an abandoned edit costs nothing and the undo
 * history sees one change rather than every keystroke.
 *
 * The conversion is the same pair the rest of the editor uses: out through
 * `documentToMarkdown`, back in through the paste path. A block that survives
 * a round trip through those is a block the markdown export can represent, so
 * this doubles as the honest answer to "what will this look like as markdown?"
 */

export const sourceModeKey = new PluginKey<SourceModeState>('hwp-source-mode');

type SourceModeState = {
  /** Position of the block being edited, or null when nothing is. */
  pos: number | null;
  text: string;
};

/**
 * What can be edited as markdown. Paragraphs and headings are in the list even
 * though they are already text: their *marks* are markdown too, and a
 * shortcut that does nothing where the caret happens to be is a shortcut
 * people stop reaching for.
 */
const EDITABLE = new Set([
  'paragraph',
  'heading',
  'table',
  'codeBlock',
  'bulletList',
  'orderedList',
  'taskList',
  'callout',
  'blockquote',
]);

/** The top-level block containing a position, if it is one of ours. */
function blockAt(state: EditorState, pos: number): { pos: number; size: number } | null {
  const $pos = state.doc.resolve(pos);

  // Clicked in the space between blocks rather than inside one.
  if ($pos.depth === 0) {
    const after = $pos.nodeAfter;
    return after && EDITABLE.has(after.type.name) ? { pos, size: after.nodeSize } : null;
  }

  /* Always the outermost block. A table inside a section edited on its own
     would come back at the wrong depth, and the section is the thing the
     markdown describes anyway. */
  const node = $pos.node(1);
  return EDITABLE.has(node.type.name) ? { pos: $pos.before(1), size: node.nodeSize } : null;
}

function sourceOf(state: EditorState, pos: number): string {
  const node = state.doc.nodeAt(pos);
  if (!node) return '';
  // documentToMarkdown walks a parent's children, so the block is wrapped in a
  // one-node document rather than special-cased.
  return documentToMarkdown(state.schema.topNodeType.create(null, node)).trim();
}

function open(state: EditorState, pos: number): Transaction {
  return state.tr.setMeta(sourceModeKey, { pos, text: sourceOf(state, pos) });
}

function close(state: EditorState): Transaction {
  return state.tr.setMeta(sourceModeKey, { pos: null, text: '' });
}

/**
 * Replace the block with whatever the markdown now says it is.
 *
 * One transaction, so the whole edit is one step in the undo history — the
 * point of keeping the source in a widget rather than in the document.
 */
function apply(view: EditorView, text: string): void {
  const current = sourceModeKey.getState(view.state);
  if (!current || current.pos === null) return;

  const node = view.state.doc.nodeAt(current.pos);
  if (!node) {
    view.dispatch(close(view.state));
    return;
  }

  const holder = document.createElement('div');
  holder.innerHTML = markdownToHtml(text.trim());
  const parsed = PMDOMParser.fromSchema(view.state.schema).parse(holder);

  const from = current.pos;
  const to = from + node.nodeSize;
  const replacement = parsed.content.childCount
    ? parsed.content
    : // Emptying a block leaves a paragraph rather than a hole: a document
      // whose last block was deleted has nowhere to put the caret.
      Fragment.from(view.state.schema.nodes.paragraph.create());

  const tr = view.state.tr.replaceWith(from, to, replacement);
  tr.setMeta(sourceModeKey, { pos: null, text: '' });
  // The caret belongs in what was just written, not wherever it was before —
  // otherwise a second ⌘⇧M edits some other block entirely.
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(from + 1, tr.doc.content.size))));
  view.dispatch(tr);
  view.focus();
}

function editorFor(view: EditorView, text: string, onApply: (value: string) => void, onCancel: () => void) {
  const wrap = document.createElement('div');
  wrap.className = 'hwp-source';
  wrap.contentEditable = 'false';

  const area = document.createElement('textarea');
  area.className = 'hwp-source-text';
  area.value = text;
  area.spellcheck = false;
  area.rows = Math.min(20, Math.max(3, text.split('\n').length + 1));

  const bar = document.createElement('div');
  bar.className = 'hwp-source-bar';

  const hint = document.createElement('span');
  hint.className = 'hwp-source-hint';
  hint.textContent = 'Editing as markdown — ⌘↵ to apply, Esc to cancel';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'hwp-source-btn';
  cancel.textContent = 'Cancel';

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'hwp-source-btn hwp-source-btn--primary';
  done.textContent = 'Apply';

  bar.append(hint, cancel, done);
  wrap.append(area, bar);

  cancel.addEventListener('mousedown', (event) => event.preventDefault());
  cancel.addEventListener('click', onCancel);
  done.addEventListener('mousedown', (event) => event.preventDefault());
  done.addEventListener('click', () => onApply(area.value));

  // ProseMirror's keymap runs before anything React or the DOM would give us,
  // so these have to be native listeners on the field itself.
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      onApply(area.value);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const { selectionStart: start, selectionEnd: end } = area;
      area.value = `${area.value.slice(0, start)}  ${area.value.slice(end)}`;
      area.setSelectionRange(start + 2, start + 2);
    }
    event.stopPropagation();
  });
  area.addEventListener('keypress', (event) => event.stopPropagation());
  area.addEventListener('keyup', (event) => event.stopPropagation());

  window.setTimeout(() => {
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }, 0);

  void view;
  return wrap;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sourceMode: {
      /** Show the block under the caret as markdown, or put it back. */
      toggleMarkdownSource: () => ReturnType;
    };
  }
}

export const SourceMode = Extension.create({
  name: 'sourceMode',

  addCommands() {
    return {
      toggleMarkdownSource:
        () =>
        ({ state, dispatch }) => {
          const current = sourceModeKey.getState(state);
          if (current && current.pos !== null) {
            dispatch?.(close(state));
            return true;
          }
          const block = blockAt(state, state.selection.from);
          if (!block) return false;
          dispatch?.(open(state, block.pos));
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => this.editor.commands.toggleMarkdownSource(),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SourceModeState>({
        key: sourceModeKey,

        state: {
          init: () => ({ pos: null, text: '' }),
          apply(tr, value) {
            const meta = tr.getMeta(sourceModeKey) as SourceModeState | undefined;
            if (meta) return meta;
            if (value.pos === null || !tr.docChanged) return value;
            const mapped = tr.mapping.mapResult(value.pos);
            return mapped.deleted ? { pos: null, text: '' } : { ...value, pos: mapped.pos };
          },
        },

        props: {
          decorations(state) {
            const current = sourceModeKey.getState(state);
            if (!current || current.pos === null) return DecorationSet.empty;
            const node = state.doc.nodeAt(current.pos);
            if (!node) return DecorationSet.empty;

            return DecorationSet.create(state.doc, [
              // The block stays in the document while it is edited; it is just
              // not shown. Replacing it up front would put an unfinished edit
              // into the undo history.
              Decoration.node(current.pos, current.pos + node.nodeSize, {
                class: 'hwp-source-hidden',
              }),
              Decoration.widget(
                current.pos,
                (view) =>
                  editorFor(
                    view,
                    current.text,
                    (value) => apply(view, value),
                    () => {
                      view.dispatch(close(view.state));
                      view.focus();
                    },
                  ),
                { side: -1, key: `source-${current.pos}` },
              ),
            ]);
          },

          handleClick(view, pos, event) {
            if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return false;
            const block = blockAt(view.state, pos);
            if (!block) return false;
            event.preventDefault();
            view.dispatch(open(view.state, block.pos));
            return true;
          },
        },
      }),
    ];
  },
});
