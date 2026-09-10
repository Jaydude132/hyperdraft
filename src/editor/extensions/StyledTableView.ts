import { TableView } from '@tiptap/extension-table';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { applyTableAppearance } from './TableStyle';

/**
 * A table node view that keeps the element's appearance in sync.
 *
 * With `resizable: true`, prosemirror-tables installs its own table node view
 * through `columnResizing` and constructs it as `new View(node, cellMinWidth)`
 * — without Tiptap's rendered attributes. The result is that a table's own
 * styling reaches `getHTML()` and the saved file, but never the editor: the
 * borders panel appears to do nothing.
 *
 * Reading straight from `node.attrs` sidesteps that entirely, and applying on
 * `update` is what makes the panel's controls feel live.
 */
export class StyledTableView extends TableView {
  constructor(
    node: PMNode,
    cellMinWidth: number,
    view?: EditorView,
    htmlAttributes?: Record<string, unknown>,
  ) {
    super(node, cellMinWidth, view, htmlAttributes);
    applyTableAppearance(this.table, node.attrs);
  }

  update(node: PMNode): boolean {
    const handled = super.update(node);
    if (handled) applyTableAppearance(this.table, node.attrs);
    return handled;
  }
}
