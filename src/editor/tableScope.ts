import type { Editor } from '@tiptap/react';
import { CellSelection, selectedRect } from '@tiptap/pm/tables';
import { isInsideNode } from './selection';

/**
 * What a table styling control should act on.
 *
 * The rule is the one people already expect from Word: highlight some cells
 * and styling applies to those cells; put the caret anywhere in a table
 * without selecting particular cells — or select the whole table — and it
 * applies to the table as a whole.
 */
export type TableScope = 'none' | 'table' | 'cells';

export function tableScope(editor: Editor): { scope: TableScope; cells: number } {
  if (!isInsideNode(editor, 'table')) return { scope: 'none', cells: 0 };

  const { state } = editor;
  if (!(state.selection instanceof CellSelection)) return { scope: 'table', cells: 0 };

  try {
    const rect = selectedRect(state);
    const coversTable =
      rect.left === 0 &&
      rect.top === 0 &&
      rect.right === rect.map.width &&
      rect.bottom === rect.map.height;
    const cells = rect.map.cellsInRect(rect).length;
    return { scope: coversTable ? 'table' : 'cells', cells };
  } catch {
    return { scope: 'table', cells: 0 };
  }
}
