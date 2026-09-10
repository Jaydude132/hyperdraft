import { TABLE_CSS_PROPERTIES, TABLE_DATA_ATTRIBUTES } from './extensions/TableStyle';

/**
 * Built-in table styles.
 *
 * A preset is a *complete* appearance, never a patch: every attribute the
 * table understands appears, with `null` meaning "follow the theme". That is
 * what makes the gallery behave the way a gallery should — picking a style
 * replaces the last one instead of layering on top of it, so the cards stay
 * honest no matter what order they are clicked in.
 *
 * The set is deliberately small. These are starting points; every one of them
 * can be taken apart with the controls below the gallery.
 */

export type TableAppearanceAttrs = Record<string, unknown>;

/** Every appearance key, blank. Derived, so a new property joins it for free. */
export const EMPTY_APPEARANCE: TableAppearanceAttrs = Object.fromEntries(
  [
    ...TABLE_CSS_PROPERTIES.map((entry) => entry.attribute),
    ...TABLE_DATA_ATTRIBUTES.map((entry) => entry.attribute),
  ].map((attribute) => [attribute, null]),
);

export type TablePreset = { id: string; label: string; appearance: TableAppearanceAttrs };

const preset = (id: string, label: string, overrides: TableAppearanceAttrs): TablePreset => ({
  id,
  label,
  appearance: { ...EMPTY_APPEARANCE, ...overrides },
});

export const TABLE_PRESETS: TablePreset[] = [
  preset('theme', 'Theme', {}),

  preset('grid', 'Grid', {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#c2c8d2',
    innerBorders: 'all',
    radius: 0,
    headerFill: '#e7ebf2',
    headerWeight: '700',
  }),

  preset('banded', 'Banded', {
    borderColor: '#d9dde4',
    innerBorders: 'horizontal',
    stripe: true,
    bandFill: '#f4f6fa',
    headerFill: '#e7ebf2',
    headerRule: true,
    radius: 10,
  }),

  preset('minimal', 'Minimal', {
    borderWidth: 1,
    borderColor: '#e5e8ee',
    innerBorders: 'horizontal',
    headerFill: '#ffffff',
    headerCase: 'upper',
    headerRule: true,
    radius: 0,
  }),

  preset('ledger', 'Ledger', {
    borderColor: '#d9dde4',
    innerBorders: 'all',
    stripe: true,
    bandFill: '#f7f9fc',
    headerFill: '#eef2f9',
    headerWeight: '700',
    radius: 4,
  }),

  preset('ink', 'Ink', {
    borderColor: '#d9dde4',
    innerBorders: 'horizontal',
    stripe: true,
    bandFill: '#f4f6fa',
    headerFill: '#16181d',
    headerInk: '#ffffff',
    headerWeight: '700',
    headerCase: 'upper',
    radius: 12,
  }),

  preset('accent', 'Accent', {
    borderColor: '#c8d6f5',
    innerBorders: 'horizontal',
    stripe: true,
    bandFill: '#eef3fd',
    headerFill: '#2f5fd0',
    headerInk: '#ffffff',
    headerWeight: '700',
    radius: 12,
  }),

  /* The one that exists to show what per-corner radii are for. */
  preset('flair', 'Flair', {
    borderColor: '#c2c8d2',
    innerBorders: 'horizontal',
    stripe: true,
    bandFill: '#f7f9fc',
    headerFill: '#e7ebf2',
    headerWeight: '700',
    cornerTl: 22,
    cornerTr: 0,
    cornerBr: 22,
    cornerBl: 0,
  }),
];

/** `false`, `''` and `undefined` all mean "not set" once a document round-trips. */
function blank(value: unknown): unknown {
  return value === false || value === '' || value === undefined ? null : value;
}

/** Which preset a table currently matches, if any. */
export function activePreset(attrs: TableAppearanceAttrs): string | null {
  const match = TABLE_PRESETS.find((entry) =>
    Object.entries(entry.appearance).every(([key, value]) => blank(attrs[key]) === blank(value)),
  );
  return match?.id ?? null;
}
