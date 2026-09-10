import { Extension } from '@tiptap/core';
import { setCellAttr } from '@tiptap/pm/tables';
import type { CSSProperties } from 'react';

/**
 * Borders and shading for tables.
 *
 * Appearance is carried as CSS custom properties on the `<table>` element
 * rather than as a wall of inline declarations on every cell. The document
 * stylesheet reads those properties with sensible fallbacks, so a table with
 * no styling of its own inherits the theme, a styled table overrides only what
 * it names, and the saved file stays legible:
 *
 *   <table style="--tbl-bw: 2px; --tbl-radius: 16px">
 *
 * Cell shading is the exception and lands as a real `background-color`,
 * because it is per-cell rather than per-table.
 */

export type TableAppearance = {
  borderWidth: number | null;
  borderStyle: string | null;
  borderColor: string | null;
  radius: number | null;
  cornerTl: number | null;
  cornerTr: number | null;
  cornerBr: number | null;
  cornerBl: number | null;
  headerFill: string | null;
  headerInk: string | null;
  headerWeight: string | null;
  headerAlign: 'left' | 'center' | 'right' | null;
  headerCase: 'upper' | 'small' | null;
  headerRule: boolean | null;
  bandFill: string | null;
  innerBorders: 'all' | 'horizontal' | 'vertical' | 'none' | null;
  stripe: boolean | null;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableStyle: {
      setTableAppearance: (appearance: Partial<TableAppearance>) => ReturnType;
      setCellShading: (color: string | null) => ReturnType;
    };
  }
}


/**
 * The single mapping from table attribute to CSS custom property. Both the
 * schema attributes below and the node view in TableView.ts read this, so a
 * property added here is picked up by saving and by live rendering at once.
 */
type CssProperty = { attribute: string; property: string; unit?: 'px' };

export const TABLE_CSS_PROPERTIES: readonly CssProperty[] = [
  { attribute: 'borderWidth', property: '--tbl-bw', unit: 'px' },
  { attribute: 'borderStyle', property: '--tbl-bs' },
  { attribute: 'borderColor', property: '--tbl-bc' },
  { attribute: 'radius', property: '--tbl-radius', unit: 'px' },
  { attribute: 'cornerTl', property: '--tbl-r-tl', unit: 'px' },
  { attribute: 'cornerTr', property: '--tbl-r-tr', unit: 'px' },
  { attribute: 'cornerBr', property: '--tbl-r-br', unit: 'px' },
  { attribute: 'cornerBl', property: '--tbl-r-bl', unit: 'px' },
  { attribute: 'headerFill', property: '--tbl-header-fill' },
  { attribute: 'headerInk', property: '--tbl-header-ink' },
  { attribute: 'headerWeight', property: '--tbl-header-weight' },
  { attribute: 'headerAlign', property: '--tbl-header-align' },
  { attribute: 'bandFill', property: '--tbl-band' },
];

export const TABLE_DATA_ATTRIBUTES = [
  { attribute: 'innerBorders', name: 'data-inner' },
  { attribute: 'stripe', name: 'data-stripe' },
  { attribute: 'headerCase', name: 'data-header-case' },
  { attribute: 'headerRule', name: 'data-header-rule' },
] as const;

/** The appearance as a React style object — for previews and gallery cards. */
export function tableStyleObject(attrs: Record<string, unknown>): CSSProperties {
  const style: Record<string, string> = {};
  for (const { attribute, property, unit } of TABLE_CSS_PROPERTIES) {
    const value = attrs[attribute];
    if (value == null || value === '') continue;
    style[property] = unit === 'px' ? `${value}px` : String(value);
  }
  return style as CSSProperties;
}

/** The data-* half of the same mapping, ready to spread onto an element. */
export function tableDataAttributes(attrs: Record<string, unknown>): Record<string, string> {
  const data: Record<string, string> = {};
  for (const { attribute, name } of TABLE_DATA_ATTRIBUTES) {
    const value = attrs[attribute];
    if (value == null || value === '' || value === false) continue;
    data[name] = String(value);
  }
  return data;
}

/**
 * Write a table's appearance onto a live DOM element.
 *
 * Individual properties are set rather than `cssText` being replaced, because
 * prosemirror-tables writes the resized column total into `min-width` on the
 * same element and clobbering it would break column resizing.
 */
export function applyTableAppearance(table: HTMLElement, attrs: Record<string, unknown>): void {
  for (const { attribute, property, unit } of TABLE_CSS_PROPERTIES) {
    const value = attrs[attribute];
    if (value == null || value === '') table.style.removeProperty(property);
    else table.style.setProperty(property, unit === 'px' ? `${value}px` : String(value));
  }
  for (const { attribute, name } of TABLE_DATA_ATTRIBUTES) {
    const value = attrs[attribute];
    if (value == null || value === '' || value === false) table.removeAttribute(name);
    else table.setAttribute(name, String(value));
  }
}

/**
 * Cell border sides. A cell's own border is a plain inline declaration rather
 * than a custom property, because it has to outrank the table-wide rule in
 * document.css that gives every cell its right and bottom line.
 */
export const CELL_BORDER_SIDES = [
  { attribute: 'borderTop', property: 'border-top', side: 'top' },
  { attribute: 'borderRight', property: 'border-right', side: 'right' },
  { attribute: 'borderBottom', property: 'border-bottom', side: 'bottom' },
  { attribute: 'borderLeft', property: 'border-left', side: 'left' },
] as const;

export type CellBorderSide = (typeof CELL_BORDER_SIDES)[number]['side'];

type AttributeSpec = {
  default: unknown;
  parseHTML: (element: HTMLElement) => unknown;
  renderHTML: (attributes: Record<string, unknown>) => Record<string, string>;
};

/** An attribute stored as a CSS custom property on the element itself. */
function cssVariable(name: string, variable: string, unit?: 'px'): AttributeSpec {
  return {
    default: null,
    parseHTML: (element) => {
      const raw = element.style.getPropertyValue(variable).trim();
      if (!raw) return null;
      return unit === 'px' ? Number.parseFloat(raw) : raw;
    },
    renderHTML: (attributes) => {
      const value = attributes[name];
      if (value == null || value === '') return {} as Record<string, string>;
      return { style: `${variable}: ${unit === 'px' ? `${value}px` : value}` };
    },
  };
}

/** A boolean stored as `data-x="true"`, present only when it is on. */
function flag(name: string, attribute: string): AttributeSpec {
  return {
    default: null,
    parseHTML: (element) => element.getAttribute(attribute) === 'true',
    renderHTML: (attributes) =>
      attributes[name] ? { [attribute]: 'true' } : ({} as Record<string, string>),
  };
}

/** An attribute stored as a data-* attribute, for things CSS selects on. */
function dataAttribute(name: string, attribute: string): AttributeSpec {
  return {
    default: null,
    parseHTML: (element) => element.getAttribute(attribute),
    renderHTML: (attributes) => {
      const value = attributes[name];
      if (value == null || value === '' || value === false) return {};
      return { [attribute]: String(value) };
    },
  };
}

/**
 * Fold `rgb(47, 95, 208)` back to `#2f5fd0`.
 *
 * The browser canonicalises real CSS properties when it parses inline styles,
 * so a colour written as hex reads back as `rgb()`. Left alone, every
 * save-open-save cycle rewrites those declarations and a document's git diff
 * fills with noise that changes nothing. Custom properties are stored
 * verbatim and need no such treatment.
 */
function normalizeColors(value: string): string {
  return value.replace(/rgba?\(([^)]+)\)/g, (whole, channels: string) => {
    const parts = channels.split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return whole;
    if (parts.length > 3 && parts[3] !== 1) return whole; // keep real transparency as-is
    return `#${parts.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
  });
}

/** A cell border stored as a CSS shorthand, e.g. "2px solid #2f5fd0". */
function cellBorder(name: string, property: string): AttributeSpec {
  return {
    default: null,
    parseHTML: (element) => {
      const raw = element.style.getPropertyValue(property);
      return raw ? normalizeColors(raw) : null;
    },
    renderHTML: (attributes) => {
      const value = attributes[name];
      if (value == null || value === '') return {} as Record<string, string>;
      return { style: `${property}: ${value}` };
    },
  };
}

export const TableStyle = Extension.create({
  name: 'tableStyle',

  addGlobalAttributes() {
    const tableAttributes: Record<string, AttributeSpec> = {};

    for (const { attribute, property, unit } of TABLE_CSS_PROPERTIES) {
      tableAttributes[attribute] = cssVariable(attribute, property, unit);
    }

    tableAttributes.innerBorders = dataAttribute('innerBorders', 'data-inner');
    tableAttributes.headerCase = dataAttribute('headerCase', 'data-header-case');
    tableAttributes.stripe = flag('stripe', 'data-stripe');
    tableAttributes.headerRule = flag('headerRule', 'data-header-rule');

    return [
      { types: ['table'], attributes: tableAttributes },
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          background: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.backgroundColor ? normalizeColors(element.style.backgroundColor) : null,
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.background
                ? { style: `background-color: ${attributes.background}` }
                : ({} as Record<string, string>),
          },
          ...Object.fromEntries(
            CELL_BORDER_SIDES.map(({ attribute, property }) => [attribute, cellBorder(attribute, property)]),
          ),
        },
      },
    ];
  },

  addCommands() {
    return {
      setTableAppearance:
        (appearance) =>
        ({ commands }) =>
          commands.updateAttributes('table', appearance),

      // Routed through prosemirror-tables rather than `updateAttributes` so a
      // multi-cell selection shades every cell in it, not just the anchor.
      setCellShading:
        (color) =>
        ({ state, dispatch }) =>
          setCellAttr('background', color)(state, dispatch),
    };
  },
});
