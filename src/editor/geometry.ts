/**
 * Page geometry, in CSS pixels at the standard 96px-per-inch.
 *
 * These constants are the single source of truth shared by the two
 * pagination engines: the measurement pass that draws page breaks while
 * editing (see pagination.ts) and the `@page` rules that produce the real
 * pages at print time (see styles/print.css). If they ever disagree, the
 * screen stops predicting the paper.
 */
export const PX_PER_IN = 96;

export type PageSizeName = 'Letter' | 'A4';

export const PAGE_SIZES: Record<PageSizeName, { width: number; height: number }> = {
  Letter: { width: 8.5 * PX_PER_IN, height: 11 * PX_PER_IN },
  A4: { width: 8.27 * PX_PER_IN, height: 11.69 * PX_PER_IN },
};

/** Page margin, uniform on all four sides. 1in matches the print stylesheet. */
export const MARGIN = PX_PER_IN;

/** Visual gutter drawn between sheets on screen. Has no print equivalent. */
export const SHEET_GAP = 36;

export type Geometry = {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  contentHeight: number;
  /** On-screen gutter between sheets. Has no print equivalent. */
  gap: number;
  /**
   * Distance in the editing flow from the top of one page's content box to
   * the top of the next. Because the flow is a single continuous column, the
   * pagination pass "skips" this much space to jump a sheet boundary.
   */
  stride: number;
};

/**
 * @param gap On-screen gutter between sheets. Export passes 0, which makes the
 *   stride exactly one page tall so the browser's own page breaks land on the
 *   boundaries this pass already computed.
 */
export function geometryFor(size: PageSizeName, gap: number = SHEET_GAP): Geometry {
  const { width, height } = PAGE_SIZES[size];
  const contentHeight = height - MARGIN * 2;
  return {
    pageWidth: width,
    pageHeight: height,
    margin: MARGIN,
    contentWidth: width - MARGIN * 2,
    contentHeight,
    gap,
    stride: contentHeight + MARGIN + gap + MARGIN,
  };
}
