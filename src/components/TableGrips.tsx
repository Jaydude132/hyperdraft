import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * Word's row and column selection handles.
 *
 * Strips are drawn in the page margin alongside a table whenever the pointer
 * comes near it. Clicking one selects that whole row or column; dragging along
 * them extends the selection; the corner selects the table. With a row or
 * column selected, the borders panel and the right-click menu act on just that
 * band, which is what makes "give this column a right border" possible.
 *
 * The strips live in an absolutely positioned layer rather than inside the
 * document flow — anything in the flow would be measured by the pagination
 * pass and would change where pages break.
 */

/**
 * Row grips sit in the page's left margin and can afford to be chunky. Column
 * grips have only the paragraph gap above the table to live in — roughly 9px
 * at the body's rhythm — so they are sized to fit it rather than covering the
 * line of text above.
 */
const ROW_GRIP = 13;
const ROW_GAP = 4;
const COLUMN_GRIP = 8;
const COLUMN_GAP = 1;
/** How far outside a table the grips stay live, so the pointer can reach them. */
const REACH = ROW_GRIP + ROW_GAP + 10;

type GripRect = {
  key: string;
  kind: 'row' | 'column' | 'table';
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  pos: number;
  selected: boolean;
};

type GripSet = { rows: GripRect[]; columns: GripRect[]; corner: GripRect | null };

const EMPTY: GripSet = { rows: [], columns: [], corner: null };

export function TableGrips({ editor }: { editor: Editor }) {
  const layer = useRef<HTMLDivElement>(null);
  const activeTable = useRef<HTMLTableElement | null>(null);
  /**
   * Drag state. A click is not a drag: the pointer has to travel past a
   * threshold *and* reach a different grip before the selection extends.
   * Without that, the pixel of movement in any real click extended a
   * one-row selection to two, so clicking a grip appeared to do the wrong
   * thing every single time.
   */
  const drag = useRef<{ kind: 'row' | 'column'; key: string; x: number; y: number } | null>(null);
  const frame = useRef(0);
  const signature = useRef('');
  const [grips, setGrips] = useState<GripSet>(EMPTY);
  const gripsRef = useRef<GripSet>(EMPTY);
  gripsRef.current = grips;

  const measure = useCallback((): GripSet => {
    const host = layer.current;
    const table = activeTable.current;
    if (!host || !table || !table.isConnected) return EMPTY;

    const hostRect = host.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const posOf = (cell: HTMLElement) => {
      try {
        return editor.view.posAtDOM(cell, 0);
      } catch {
        return -1;
      }
    };

    const rows: GripRect[] = [];
    Array.from(table.rows).forEach((row, index) => {
      const cell = row.cells[0];
      if (!cell) return;
      const rect = row.getBoundingClientRect();
      rows.push({
        key: `r${index}`,
        kind: 'row',
        index,
        left: tableRect.left - hostRect.left - ROW_GRIP - ROW_GAP,
        top: rect.top - hostRect.top,
        width: ROW_GRIP,
        height: rect.height,
        pos: posOf(cell),
        selected: cell.classList.contains('selectedCell'),
      });
    });

    const columns: GripRect[] = Array.from(table.rows[0]?.cells ?? []).map((cell, index) => {
      const rect = cell.getBoundingClientRect();
      return {
        key: `c${index}`,
        kind: 'column',
        index,
        left: rect.left - hostRect.left,
        top: tableRect.top - hostRect.top - COLUMN_GRIP - COLUMN_GAP,
        width: rect.width,
        height: COLUMN_GRIP,
        pos: posOf(cell),
        selected: cell.classList.contains('selectedCell'),
      };
    });

    const corner: GripRect | null = rows.length
      ? {
          key: 'corner',
          kind: 'table',
          index: 0,
          left: tableRect.left - hostRect.left - ROW_GRIP - ROW_GAP,
          top: tableRect.top - hostRect.top - COLUMN_GRIP - COLUMN_GAP,
          width: ROW_GRIP,
          height: COLUMN_GRIP,
          pos: rows[0].pos,
          selected: rows.every((row) => row.selected) && rows.length > 0,
        }
      : null;

    return { rows: rows.filter((row) => row.pos >= 0), columns: columns.filter((c) => c.pos >= 0), corner };
  }, [editor]);

  /**
   * A measurement loop that runs only while a table is in reach, and stops
   * itself once there is nothing left to draw. Rows move as you type, so this
   * has to track layout rather than fire once on hover.
   */
  const pump = useCallback(() => {
    if (frame.current) return;
    const tick = () => {
      const next = measure();
      const stamp = JSON.stringify(next);
      if (stamp !== signature.current) {
        signature.current = stamp;
        setGrips(next);
      }
      if (!activeTable.current && !next.rows.length) {
        frame.current = 0;
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [measure]);

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      if (drag.current) return;
      const tables = Array.from(editor.view.dom.querySelectorAll('table'));
      activeTable.current =
        tables.find((table) => {
          const rect = table.getBoundingClientRect();
          return (
            event.clientX >= rect.left - REACH &&
            event.clientX <= rect.right + 2 &&
            event.clientY >= rect.top - REACH &&
            event.clientY <= rect.bottom + 2
          );
        }) ?? null;
      pump();
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [editor, pump]);

  // Dragging along the strips extends the selection band by band.
  useEffect(() => {
    const DRAG_THRESHOLD = 5;

    const onMove = (event: globalThis.MouseEvent) => {
      const active = drag.current;
      const host = layer.current;
      if (!active || !host) return;

      const travelled = Math.hypot(event.clientX - active.x, event.clientY - active.y);
      if (travelled < DRAG_THRESHOLD) return;

      const hostRect = host.getBoundingClientRect();
      const list = active.kind === 'row' ? gripsRef.current.rows : gripsRef.current.columns;
      const over =
        active.kind === 'row'
          ? list.find((grip) => {
              const y = event.clientY - hostRect.top;
              return y >= grip.top && y <= grip.top + grip.height;
            })
          : list.find((grip) => {
              const x = event.clientX - hostRect.left;
              return x >= grip.left && x <= grip.left + grip.width;
            });

      if (!over || over.key === active.key) return;
      active.key = over.key;
      if (active.kind === 'row') editor.chain().selectRowAt(over.pos, true).run();
      else editor.chain().selectColumnAt(over.pos, true).run();
    };

    const onUp = () => {
      drag.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [editor]);

  /**
   * Tint the row or column a grip refers to while the pointer is over it.
   * A bare strip in the margin does not explain itself; showing what it is
   * about to select does.
   */
  const preview = (grip: GripRect, on: boolean) => {
    const table = activeTable.current;
    if (!table) return;
    const cells =
      grip.kind === 'row'
        ? Array.from(table.rows[grip.index]?.cells ?? [])
        : grip.kind === 'column'
          ? Array.from(table.rows).map((row) => row.cells[grip.index]).filter(Boolean)
          : Array.from(table.rows).flatMap((row) => Array.from(row.cells));
    for (const cell of cells) cell.classList.toggle('hwp-grip-preview', on);
  };

  // A grip can vanish mid-hover (the table scrolls away, the document
  // changes); leaving the tint behind would be a stain on the page.
  useEffect(
    () => () => {
      document
        .querySelectorAll('.hwp-grip-preview')
        .forEach((cell) => cell.classList.remove('hwp-grip-preview'));
    },
    [],
  );

  const beginRow = (grip: GripRect) => (event: ReactMouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { kind: 'row', key: grip.key, x: event.clientX, y: event.clientY };
    editor.chain().focus().selectRowAt(grip.pos, event.shiftKey).run();
  };

  const beginColumn = (grip: GripRect) => (event: ReactMouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { kind: 'column', key: grip.key, x: event.clientX, y: event.clientY };
    editor.chain().focus().selectColumnAt(grip.pos, event.shiftKey).run();
  };

  const selectAll = (grip: GripRect) => (event: ReactMouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    editor.chain().focus().selectTableAt(grip.pos).run();
  };

  /** One pixel of air on the long axis, so adjacent grips read as separate
      segments instead of a single continuous bar. */
  const style = (grip: GripRect, axis: 'x' | 'y' | null) => ({
    left: axis === 'x' ? grip.left + 1 : grip.left,
    top: axis === 'y' ? grip.top + 1 : grip.top,
    width: axis === 'x' ? Math.max(2, grip.width - 2) : grip.width,
    height: axis === 'y' ? Math.max(2, grip.height - 2) : grip.height,
  });

  return (
    <div className="hwp-grip-layer" ref={layer} aria-hidden="true">
      {grips.rows.map((grip) => (
        <button
          key={grip.key}
          type="button"
          tabIndex={-1}
          className={`hwp-grip hwp-grip--row${grip.selected ? ' hwp-grip--on' : ''}`}
          style={style(grip, 'y')}
          data-tip="Select row"
          onMouseDown={beginRow(grip)}
          onMouseEnter={() => preview(grip, true)}
          onMouseLeave={() => preview(grip, false)}
        />
      ))}
      {grips.columns.map((grip) => (
        <button
          key={grip.key}
          type="button"
          tabIndex={-1}
          className={`hwp-grip hwp-grip--column${grip.selected ? ' hwp-grip--on' : ''}`}
          style={style(grip, 'x')}
          data-tip="Select column"
          onMouseDown={beginColumn(grip)}
          onMouseEnter={() => preview(grip, true)}
          onMouseLeave={() => preview(grip, false)}
        />
      ))}
      {grips.corner ? (
        <button
          type="button"
          tabIndex={-1}
          className={`hwp-grip hwp-grip--corner${grips.corner.selected ? ' hwp-grip--on' : ''}`}
          style={style(grips.corner, null)}
          data-tip="Select table"
          onMouseDown={selectAll(grips.corner)}
          onMouseEnter={() => preview(grips.corner!, true)}
          onMouseLeave={() => preview(grips.corner!, false)}
        />
      ) : null}
    </div>
  );
}
