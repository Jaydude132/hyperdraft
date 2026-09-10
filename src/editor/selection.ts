import type { Editor } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * The nearest ancestor of this type, or null.
 *
 * Not `editor.isActive(name)`. That answers a different question — roughly
 * "does this node cover the selection" — and returns false for a range
 * selection spanning a whole code block or table, which is exactly when a
 * contextual ribbon or a Tab handler most needs to say yes. Walking the
 * resolved position's ancestors answers the question actually being asked,
 * and hands back the node itself for callers that need to read its content —
 * the styles panel asks the table whether its first row is a header row.
 */
export function ancestorNode(editor: Editor, typeName: string): ProseMirrorNode | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === typeName) return node;
  }
  return null;
}

/**
 * The innermost ancestor whose type is one of `typeNames`.
 *
 * Blocks nest — a code block inside a bordered section, a table inside one
 * too — and a contextual control should describe the block the caret is
 * actually in, which is always the innermost match.
 */
export function innermostNode(editor: Editor, typeNames: string[]): ProseMirrorNode | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (typeNames.includes(node.type.name)) return node;
  }
  return null;
}

/** Is the caret inside a node of this type? */
export function isInsideNode(editor: Editor, typeName: string): boolean {
  return ancestorNode(editor, typeName) !== null;
}
