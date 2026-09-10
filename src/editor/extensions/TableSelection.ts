import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { CellSelection, TableMap, cellAround, isInTable, selectedRect } from '@tiptap/pm/tables';
import type { Rect } from '@tiptap/pm/tables';
import { CELL_BORDER_SIDES } from './TableStyle';
import type { CellBorderSide } from './TableStyle';

/**
 * Selecting whole rows and columns, and applying borders to just that
 * selection.
 *
 * prosemirror-tables already models a rectangular cell selection; what is
 * missing is a way to make one without dragging across every cell, and a way
 * to write a border onto only part of a table. Both live here.
 */

/** Which edges of a selection a border operation touches. */
export type BorderTarget = 'all' | 'outside' | 'inside' | 'top' | 'right' | 'bottom' | 'left';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableSelection: {
      /** Select the whole row containing the given document position. */
      selectRowAt: (pos: number, extend?: boolean) => ReturnType;
      /** Select the whole column containing the given document position. */
      selectColumnAt: (pos: number, extend?: boolean) => ReturnType;
      /** Select every cell of the table containing the given position. */
      selectTableAt: (pos: number) => ReturnType;
      /**
       * Write a border onto the selected cells, or onto every cell in the
       * table when `wholeTable` is set. `null` clears it.
       */
      setSelectionBorder: (target: BorderTarget, value: string | null, wholeTable?: boolean) => ReturnType;
      /** Shade the selected cells, or every cell in the table. */
      setSelectionShading: (color: string | null, wholeTable?: boolean) => ReturnType;
    };
  }
}

type CellRect = { left: number; top: number; right: number; bottom: number };

/**
 * Which sides of one cell a border operation should write.
 *
 * `outside` and `inside` are relative to the *selection*, not the table — that
 * is what makes "put a right border on this column" mean the column's outer
 * right edge rather than every cell's right edge.
 */
function sidesFor(target: BorderTarget, cell: CellRect, rect: Rect): Set<CellBorderSide> {
  const onTop = cell.top === rect.top;
  const onBottom = cell.bottom === rect.bottom;
  const onLeft = cell.left === rect.left;
  const onRight = cell.right === rect.right;
  const sides = new Set<CellBorderSide>();

  const add = (side: CellBorderSide, on: boolean) => {
    if (on) sides.add(side);
  };

  switch (target) {
    case 'all':
      add('top', true);
      add('right', true);
      add('bottom', true);
      add('left', true);
      break;
    case 'outside':
      add('top', onTop);
      add('right', onRight);
      add('bottom', onBottom);
      add('left', onLeft);
      break;
    case 'inside':
      add('top', !onTop);
      add('right', !onRight);
      add('bottom', !onBottom);
      add('left', !onLeft);
      break;
    case 'top':
      add('top', onTop);
      break;
    case 'right':
      add('right', onRight);
      break;
    case 'bottom':
      add('bottom', onBottom);
      break;
    case 'left':
      add('left', onLeft);
      break;
  }

  return sides;
}

/** The selected cells, or every cell in the table when `wholeTable` is set. */
function rectFor(state: import('@tiptap/pm/state').EditorState, wholeTable: boolean): Rect & {
  map: TableMap;
  tableStart: number;
} {
  const rect = selectedRect(state);
  if (!wholeTable) return rect;
  return { ...rect, left: 0, top: 0, right: rect.map.width, bottom: rect.map.height };
}

export const TableSelection = Extension.create({
  name: 'tableSelection',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('hwp-table-right-click'),

        /**
         * Keep a cell selection alive through a right-click.
         *
         * `mousedown` fires before `contextmenu`, and both ProseMirror and
         * prosemirror-tables collapse the selection to the clicked point in
         * their own mousedown handlers — so by the time the menu is built the
         * row or column the user selected is gone, and the menu acts on a
         * single cell instead.
         *
         * Stopping propagation is not enough on its own: the browser moves
         * the caret to the clicked point as the mousedown default, and
         * ProseMirror's DOM observer then reads that back and replaces the
         * cell selection with a text one — after `contextmenu` has already
         * fired, so the menu is built correctly and then quietly invalidated.
         * Preventing the default stops the caret moving at all. The
         * `contextmenu` event is a separate gesture-driven event and still
         * fires, so the menu opens as normal.
         */
        view(view) {
          const onMouseDown = (event: MouseEvent) => {
            if (event.button !== 2) return;
            const { selection } = view.state;
            if (!(selection instanceof CellSelection)) return;
            const cell = (event.target as HTMLElement | null)?.closest?.('td, th');
            if (!cell?.classList.contains('selectedCell')) return;
            event.stopPropagation();
            event.preventDefault();
          };

          view.dom.addEventListener('mousedown', onMouseDown, true);
          return {
            destroy: () => view.dom.removeEventListener('mousedown', onMouseDown, true),
          };
        },
      }),
    ];
  },

  addCommands() {
    /** Resolve a position inside a cell to the position *before* that cell. */
    const cellAt = (doc: import('@tiptap/pm/model').Node, pos: number) => {
      if (pos < 0 || pos > doc.content.size) return null;
      return cellAround(doc.resolve(pos));
    };

    return {
      selectRowAt:
        (pos, extend = false) =>
        ({ state, dispatch }) => {
          const $cell = cellAt(state.doc, pos);
          if (!$cell) return false;
          if (dispatch) {
            const anchor =
              extend && state.selection instanceof CellSelection ? state.selection.$anchorCell : $cell;
            dispatch(state.tr.setSelection(CellSelection.rowSelection(anchor, $cell)));
          }
          return true;
        },

      selectColumnAt:
        (pos, extend = false) =>
        ({ state, dispatch }) => {
          const $cell = cellAt(state.doc, pos);
          if (!$cell) return false;
          if (dispatch) {
            const anchor =
              extend && state.selection instanceof CellSelection ? state.selection.$anchorCell : $cell;
            dispatch(state.tr.setSelection(CellSelection.colSelection(anchor, $cell)));
          }
          return true;
        },

      selectTableAt:
        (pos) =>
        ({ state, dispatch }) => {
          const $cell = cellAt(state.doc, pos);
          if (!$cell) return false;
          // $cell points before a cell, so its parent is the row and the node
          // one level up is the table.
          const table = $cell.node(-1);
          const tableStart = $cell.start(-1);
          const map = TableMap.get(table);
          if (!map.map.length) return false;
          if (dispatch) {
            dispatch(
              state.tr.setSelection(
                CellSelection.create(
                  state.doc,
                  tableStart + map.map[0],
                  tableStart + map.map[map.map.length - 1],
                ),
              ),
            );
          }
          return true;
        },

      setSelectionBorder:
        (target, value, wholeTable = false) =>
        ({ state, dispatch }) => {
          if (!isInTable(state)) return false;
          const rect = rectFor(state, wholeTable);
          if (dispatch) {
            const tr = state.tr;
            // Only attributes change, so positions stay valid throughout.
            for (const relativePos of rect.map.cellsInRect(rect)) {
              const cell = rect.map.findCell(relativePos);
              const sides = sidesFor(target, cell, rect);
              for (const { attribute, side } of CELL_BORDER_SIDES) {
                if (sides.has(side)) tr.setNodeAttribute(rect.tableStart + relativePos, attribute, value);
              }
            }
            dispatch(tr);
          }
          return true;
        },

      setSelectionShading:
        (color, wholeTable = false) =>
        ({ state, dispatch }) => {
          if (!isInTable(state)) return false;
          const rect = rectFor(state, wholeTable);
          if (dispatch) {
            const tr = state.tr;
            for (const relativePos of rect.map.cellsInRect(rect)) {
              tr.setNodeAttribute(rect.tableStart + relativePos, 'background', color);
            }
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
