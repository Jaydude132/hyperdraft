import type { Editor } from '@tiptap/react';
import { TABLE_CSS_PROPERTIES, TABLE_DATA_ATTRIBUTES } from './extensions/TableStyle';

/**
 * A record of every styled block, so the styles panel can offer Cancel.
 *
 * Only appearance attributes are captured — never text — so cancelling undoes
 * the styling without touching anything typed while the panel was open. Each
 * entry is checked against the node type at its position before being written
 * back; if the document has been restructured under it, that entry is skipped
 * rather than corrupting the document.
 *
 * The one structural change it does undo is the header row toggle. A header
 * cell and a body cell occupy the same span, so a cell whose type no longer
 * matches its snapshot can be changed back in place without moving a single
 * position — which is what lets Cancel put back a header row the panel turned
 * off.
 */

/* Derived from the appearance mapping itself: a property added there is
   captured here without anyone having to remember this file. */
const TABLE_ATTRS = [
  ...TABLE_CSS_PROPERTIES.map((entry) => entry.attribute),
  ...TABLE_DATA_ATTRIBUTES.map((entry) => entry.attribute),
];

const CELL_ATTRS = ['background', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft'] as const;

/* Sections and code blocks carry only their corners, but Cancel has to put
   those back too now that the same panel styles them. */
const CORNER_ATTRS = ['corners'] as const;

const ATTRS_FOR: Record<string, readonly string[]> = {
  table: TABLE_ATTRS,
  tableCell: CELL_ATTRS,
  tableHeader: CELL_ATTRS,
  callout: CORNER_ATTRS,
  codeBlock: CORNER_ATTRS,
};

/** Cell types that can stand in for one another, position for position. */
const CELL_TYPES = new Set(['tableCell', 'tableHeader']);

export type TableStyleSnapshot = { pos: number; type: string; attrs: Record<string, unknown> }[];

export function snapshotTableStyles(editor: Editor): TableStyleSnapshot {
  const snapshot: TableStyleSnapshot = [];
  editor.state.doc.descendants((node, pos) => {
    const keys = ATTRS_FOR[node.type.name];
    if (!keys) return;
    const attrs: Record<string, unknown> = {};
    for (const key of keys) attrs[key] = node.attrs[key];
    snapshot.push({ pos, type: node.type.name, attrs });
  });
  return snapshot;
}

export function restoreTableStyles(editor: Editor, snapshot: TableStyleSnapshot): void {
  const { state } = editor;
  const tr = state.tr;

  for (const entry of snapshot) {
    if (entry.pos > state.doc.content.size) continue;
    const node = state.doc.nodeAt(entry.pos);
    if (!node) continue;

    if (node.type.name !== entry.type) {
      const swappable = CELL_TYPES.has(node.type.name) && CELL_TYPES.has(entry.type);
      const type = state.schema.nodes[entry.type];
      if (!swappable || !type) continue;
      tr.setNodeMarkup(entry.pos, type, { ...node.attrs });
    }

    for (const [key, value] of Object.entries(entry.attrs)) {
      tr.setNodeAttribute(entry.pos, key, value);
    }
  }

  if (tr.docChanged) editor.view.dispatch(tr);
}
