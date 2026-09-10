import type { CSSProperties } from 'react';

/**
 * Per-corner radii, shared by tables, sections and code blocks.
 *
 * A block's roundness is four numbers, not one. Rounding the top left and
 * bottom right while leaving the other two square is a deliberate look, and
 * CSS has always been able to draw it — nothing about a word processor's
 * single "corner radius" slider was ever a real constraint.
 *
 * The four values reach the page as custom properties on the element, under a
 * prefix per element type:
 *
 *   <section class="hwp-callout" style="--sec-r-tl: 20px; --sec-r-tr: 0px; …">
 *
 * The prefix matters because custom properties inherit: a table inside a
 * rounded section would otherwise read the section's corners as its own.
 * Every property has a theme fallback in the stylesheet, so a block that has
 * never been styled carries no properties at all and follows the document.
 */

export const CORNERS = ['tl', 'tr', 'br', 'bl'] as const;
export type Corner = (typeof CORNERS)[number];
export type CornerRadii = Record<Corner, number>;

/** Clockwise from the top left — the order `border-radius` itself uses. */
export const CORNER_LABELS: Record<Corner, string> = {
  tl: 'Top left',
  tr: 'Top right',
  br: 'Bottom right',
  bl: 'Bottom left',
};

/** The radius a corner returns to when it is rounded again after being squared. */
export const DEFAULT_ROUNDING = 12;

export function uniformCorners(radius: number): CornerRadii {
  return { tl: radius, tr: radius, br: radius, bl: radius };
}

export function isUniform(radii: CornerRadii): boolean {
  return CORNERS.every((corner) => radii[corner] === radii.tl);
}

export function cornersEqual(a: CornerRadii, b: CornerRadii): boolean {
  return CORNERS.every((corner) => a[corner] === b[corner]);
}

/** The stored form: "20 0 20 0", clockwise from the top left. */
export function formatCorners(radii: CornerRadii): string {
  return CORNERS.map((corner) => radii[corner]).join(' ');
}

export function parseCorners(value: unknown): CornerRadii | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value.trim().split(/\s+/).map((part) => Number.parseFloat(part));
  if (parts.length !== CORNERS.length || parts.some((part) => !Number.isFinite(part))) return null;
  return { tl: parts[0], tr: parts[1], br: parts[2], bl: parts[3] };
}

/** `--sec-r-tl: 20px; --sec-r-tr: 0px; …` — an inline style declaration. */
export function cornerStyle(radii: CornerRadii, prefix: string): string {
  return CORNERS.map((corner) => `--${prefix}-r-${corner}: ${radii[corner]}px`).join('; ');
}

/** The same four properties as a React style object, for hand-written JSX. */
export function cornerStyleObject(value: unknown, prefix: string): CSSProperties | undefined {
  const radii = parseCorners(value);
  if (!radii) return undefined;
  return Object.fromEntries(
    CORNERS.map((corner) => [`--${prefix}-r-${corner}`, `${radii[corner]}px`]),
  ) as CSSProperties;
}

function cornersFromElement(element: HTMLElement, prefix: string): string | null {
  const radii = {} as CornerRadii;
  for (const corner of CORNERS) {
    const raw = element.style.getPropertyValue(`--${prefix}-r-${corner}`).trim();
    if (!raw) return null;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return null;
    radii[corner] = value;
  }
  return formatCorners(radii);
}

/**
 * A Tiptap attribute holding all four radii, for nodes that keep them in one
 * place. Tables are the exception: their appearance is already a list of
 * attribute-to-property mappings, so their corners join that list instead.
 */
export function cornersAttribute(prefix: string) {
  return {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => cornersFromElement(element, prefix),
    renderHTML: (attributes: Record<string, unknown>) => {
      const radii = parseCorners(attributes.corners);
      return radii ? { style: cornerStyle(radii, prefix) } : ({} as Record<string, string>);
    },
  };
}
