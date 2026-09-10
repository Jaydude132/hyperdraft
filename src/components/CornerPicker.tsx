import { useState } from 'react';
import { CORNERS, CORNER_LABELS, DEFAULT_ROUNDING, uniformCorners } from '../editor/corners';
import type { Corner, CornerRadii } from '../editor/corners';

/**
 * Four corners you can aim at individually.
 *
 * The direct manipulation is the point: click a corner on the little shape and
 * it rounds or squares, so the control looks like the thing it produces. The
 * slider then sets how far the rounded ones bend, which covers every symmetric
 * case and the deliberately lopsided ones — top left and bottom right rounded,
 * the other two square — with two clicks and a drag.
 *
 * Corners with *different* radii are a step further than most documents need,
 * so they live behind "Values", where each corner gets a number. Nothing about
 * the model changes: the panel always writes four numbers.
 */

type CornerPickerProps = {
  value: CornerRadii;
  disabled?: boolean;
  /** Ceiling for the slider. Tables want less than a section does. */
  max?: number;
  onChange: (next: CornerRadii) => void;
};

/** Drawn for the top left; the other three are the same path, rotated. */
const ROUND_PATH = 'M2.5 12.5V7.5A5 5 0 0 1 7.5 2.5H12.5';
const SQUARE_PATH = 'M2.5 12.5V2.5H12.5';

export function CornerPicker({ value, disabled, max = 32, onChange }: CornerPickerProps) {
  const [advanced, setAdvanced] = useState(false);

  const rounded = CORNERS.filter((corner) => value[corner] > 0);
  const sizes = new Set(rounded.map((corner) => value[corner]));
  const mixed = sizes.size > 1;
  const size = rounded.length ? Math.max(...rounded.map((corner) => value[corner])) : 0;

  /** The slider bends every rounded corner; with none rounded it rounds all. */
  const slide = (radius: number) => {
    const squared = rounded.length === 0;
    onChange(
      Object.fromEntries(
        CORNERS.map((corner) => [corner, squared || value[corner] > 0 ? radius : 0]),
      ) as CornerRadii,
    );
  };

  const toggle = (corner: Corner) =>
    onChange({ ...value, [corner]: value[corner] > 0 ? 0 : size || DEFAULT_ROUNDING });

  const set = (corner: Corner, radius: number) =>
    onChange({ ...value, [corner]: Math.max(0, Math.min(max * 2, radius)) });

  const flair = size || DEFAULT_ROUNDING;

  return (
    <div className={`corner-picker${disabled ? ' panel-field--off' : ''}`}>
      <div className="corner-stage">
        <div
          className="corner-shape"
          style={{
            borderRadius: CORNERS.map((corner) => `${Math.min(value[corner], 26)}px`).join(' '),
          }}
        />
        {CORNERS.map((corner) => (
          <button
            key={corner}
            type="button"
            className={`corner-hit corner-hit--${corner}${value[corner] > 0 ? ' is-round' : ''}`}
            data-tip={`${CORNER_LABELS[corner]} — ${value[corner]}px`}
            aria-label={`${CORNER_LABELS[corner]}: ${value[corner]} pixels`}
            aria-pressed={value[corner] > 0}
            disabled={disabled}
            onClick={() => toggle(corner)}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <path
                d={value[corner] > 0 ? ROUND_PATH : SQUARE_PATH}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ))}
      </div>

      <div className="panel-slider">
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          disabled={disabled}
          value={Math.min(size, max)}
          onChange={(event) => slide(Number(event.target.value))}
        />
        <output>{mixed ? 'Mixed' : `${size}px`}</output>
      </div>

      <div className="corner-links">
        <button type="button" disabled={disabled} onClick={() => onChange(uniformCorners(flair))}>
          All
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange(uniformCorners(0))}>
          Square
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ tl: flair, tr: 0, br: flair, bl: 0 })}
        >
          Diagonal
        </button>
        <button
          type="button"
          className={advanced ? 'is-on' : undefined}
          disabled={disabled}
          aria-expanded={advanced}
          onClick={() => setAdvanced((open) => !open)}
        >
          Values
        </button>
      </div>

      {advanced ? (
        <div className="corner-values">
          {(['tl', 'tr', 'bl', 'br'] as Corner[]).map((corner) => (
            <label key={corner} className="corner-value">
              <span>{CORNER_LABELS[corner]}</span>
              <input
                type="number"
                min={0}
                max={max * 2}
                step={1}
                disabled={disabled}
                value={value[corner]}
                onChange={(event) => set(corner, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
