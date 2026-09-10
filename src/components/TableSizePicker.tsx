import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

const MAX_ROWS = 8;
const MAX_COLS = 10;

type TableSizePickerProps = {
  /** The control this hangs from; the grid is positioned against its rect. */
  anchor: HTMLElement | null;
  onPick: (rows: number, cols: number, withHeaderRow: boolean) => void;
};

/**
 * Word's insert-table grid: hover to size, click to place.
 *
 * Portalled for the same reason as AttributePicker — the ribbon scrolls
 * horizontally, so anything drawn inside it is clipped at its edge.
 */
export function TableSizePicker({ anchor, onPick }: TableSizePickerProps) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  const [withHeaderRow, setWithHeaderRow] = useState(true);
  const [box, setBox] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setBox({
      position: 'fixed',
      top: rect.bottom + 5,
      left: Math.min(rect.left, window.innerWidth - 232),
    });
  }, [anchor]);

  if (!box) return null;

  return createPortal(
    <div className="grid-picker" style={box}>
      <div
        className="grid-picker-grid"
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
        role="grid"
        aria-label="Table size"
      >
        {Array.from({ length: MAX_ROWS }, (_, row) =>
          Array.from({ length: MAX_COLS }, (_, col) => {
            const active = row < hover.rows && col < hover.cols;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                className={`grid-cell${active ? ' grid-cell--on' : ''}`}
                aria-label={`${row + 1} by ${col + 1}`}
                onMouseEnter={() => setHover({ rows: row + 1, cols: col + 1 })}
                onClick={() => onPick(row + 1, col + 1, withHeaderRow)}
              />
            );
          }),
        )}
      </div>
      <div className="grid-picker-foot">
        <span>{hover.rows ? `${hover.rows} × ${hover.cols}` : 'Drag to size'}</span>
        <label className="grid-picker-toggle">
          <input
            type="checkbox"
            checked={withHeaderRow}
            onChange={(event) => setWithHeaderRow(event.target.checked)}
          />
          Header row
        </label>
      </div>
    </div>,
    document.body,
  );
}
