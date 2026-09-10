import { Extension } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * Markdown's pipe tables, recognised as they are typed.
 *
 * A table is the one markdown construct that cannot be spotted from a single
 * line: `| a | b |` is only a table once the row of dashes underneath it says
 * so. So this watches for that second line and, when it lines up with the row
 * above, replaces both with a real table — the header text carried over, one
 * empty body row ready to type in, and the caret already in its first cell.
 *
 * Two moments trigger it, and the difference is about intent. A row that is
 * explicitly closed — `| --- | --- |` — converts the instant the last pipe is
 * typed, because there is nothing else it could become. A row left open —
 * `| --- | ---` — waits for Enter, so that someone still adding columns is not
 * interrupted halfway.
 */

/** `| --- | --- |`: opened and closed, nothing left to add. */
const CLOSED = /^\|(?:\s*:?-+:?\s*\|)+$/;

/** The same row with either outer pipe missing. Committed on Enter. */
const LOOSE = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?$/;

function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** `:---` left, `---:` right, `:---:` centre — markdown's column alignment. */
function alignOf(cell: string): string | null {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return null;
}

function buildTable(
  state: EditorState,
  headers: string[],
  aligns: (string | null)[],
): ProseMirrorNode | null {
  const { table, tableRow, tableCell, tableHeader, paragraph } = state.schema.nodes;
  if (!table || !tableRow || !tableCell || !tableHeader || !paragraph) return null;

  const alignable = Boolean(paragraph.spec.attrs?.textAlign);
  const cell = (text: string, align: string | null) =>
    paragraph.create(
      alignable && align ? { textAlign: align } : null,
      text ? state.schema.text(text) : null,
    );

  const header = tableRow.create(
    null,
    headers.map((text, column) => tableHeader.create(null, cell(text, aligns[column]))),
  );
  const body = tableRow.create(
    null,
    headers.map((_, column) => tableCell.create(null, cell('', aligns[column]))),
  );

  return table.create(null, [header, body]);
}

/**
 * Build the transaction that swaps the two markdown lines for a table, or
 * `null` if what is under the caret is not one.
 */
function convert(state: EditorState, closed: boolean): Transaction | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== 'paragraph' || $from.depth < 1) return null;

  const container = $from.node($from.depth - 1);
  // A table inside a table cell is almost never what someone means by typing
  // pipes, and prosemirror-tables has no way to draw it well.
  if (container.type.name === 'tableCell' || container.type.name === 'tableHeader') return null;

  const index = $from.index($from.depth - 1);
  if (index === 0) return null;
  const previous = container.child(index - 1);
  if (previous.type.name !== 'paragraph') return null;

  const delimiter = $from.parent.textContent.trim();
  if (!(closed ? CLOSED : LOOSE).test(delimiter)) return null;

  const headerLine = previous.textContent.trim();
  if (!headerLine.includes('|')) return null;

  const headers = cellsOf(headerLine);
  const aligns = cellsOf(delimiter).map(alignOf);
  if (headers.length === 0 || headers.length !== aligns.length) return null;

  const node = buildTable(state, headers, aligns);
  if (!node) return null;

  const from = $from.before($from.depth) - previous.nodeSize;
  const to = $from.after($from.depth);
  const tr = state.tr.replaceWith(from, to, node);

  // Into the first cell of the body row: past the table, past the header row,
  // then into the cell's paragraph.
  const caret = from + 1 + (node.firstChild?.nodeSize ?? 0) + 3;
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(caret, tr.doc.content.size))));
  return tr.scrollIntoView();
}

export const MarkdownTable = Extension.create({
  name: 'markdownTable',

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const tr = convert(this.editor.state, false);
        if (!tr) return false;
        this.editor.view.dispatch(tr);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        // Not an input rule: a rule matches text that has not been inserted
        // yet, and this decision depends on the finished line together with
        // the one above it. Reading the document after the change is both
        // simpler and catches the row however it arrived.
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          return convert(newState, true);
        },
      }),
    ];
  },
});
