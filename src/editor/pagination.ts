import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Geometry } from './geometry';

/**
 * Screen pagination.
 *
 * The document model never contains page information — pages are a pure view
 * concern. A measurement pass walks the top-level blocks, tracks where each
 * one lands in the rendered flow, and inserts spacers that push content across
 * sheet boundaries. Spacers are ProseMirror widget decorations, so they never
 * dirty the document, enter the undo history, or reach the saved file.
 *
 * Blocks break in one of two ways:
 *
 *   - Whole-block. A table, section or heading that will not fit moves to the
 *     next page intact, with the spacer sitting before it.
 *   - Line-level. A paragraph splits at a real line box: the pass reads the
 *     paragraph's line geometry, finds the line that crosses the boundary,
 *     resolves that line's start to a document position, and inserts a
 *     block-level spacer there. Text after it reflows in a fresh anonymous
 *     block, which is why the wrapping either side of the break is unchanged.
 */

export type BreakKind = 'spacer' | 'row';

/**
 * One page break.
 *
 * `spacer` breaks insert an empty block widget and are used between blocks and
 * inside runs of text. `row` breaks cannot: a `<div>` between two `<tr>`s is
 * invalid and browsers hoist it out of the table, and inserting any element
 * would renumber `nth-child` and shift the banded-row pattern at every page
 * boundary. Instead a row break decorates the row itself, and the padding it
 * adds to that row's cells opens the gap.
 */
export type PageBreak = { pos: number; to?: number; height: number; kind: BreakKind };

export type PaginationState = {
  breaks: PageBreak[];
  pageCount: number;
  decorations: DecorationSet;
};

export const paginationKey = new PluginKey<PaginationState>('hwp-pagination');

/** Float slop, in px. Sub-pixel layout noise must not trigger a break. */
const EPS = 0.5;

/**
 * Guard against a measure/apply cycle that never settles. Each pass should
 * converge in one or two iterations; more than this means block heights are
 * responding to the spacers themselves and we would loop forever.
 */
const MAX_PASSES = 8;

/**
 * Minimum lines left on either side of a line-level break. Mirrors the
 * `orphans`/`widows` values in the print stylesheet — if the two disagree, a
 * paragraph breaks in a different place on paper than it does on screen.
 */
const MIN_LINES = 2;

/**
 * Minimum rows either side of a table break. One, because the print engine
 * applies no row orphan control either and the two must agree.
 */
const MIN_ROWS = 1;

/**
 * Breathing room above a code block continued on the next page.
 *
 * Without it the first line of the continuation sits hard against the top of
 * the page, which reads as clipped rather than continued. Screen only: the
 * print engine fragments the box itself and has no equivalent hook, and a
 * dozen pixels at a seam is below the threshold that would move a page break.
 */
const CODE_CONTINUATION_PAD = 12;

/**
 * Node types whose content is a run of text that may break at a line box.
 *
 * A code block is included even though it draws a visible box: the page mask
 * (see PageSheets.tsx) paints over the gutter, so the box is cut off cleanly
 * at the page edge rather than bleeding across the gap. Bordered sections stay
 * out on purpose — a callout is a semantic unit and should travel whole, which
 * is also what `break-inside: avoid` gives it on paper.
 */
const SPLITTABLE = new Set(['paragraph', 'codeBlock']);

/** Space this pass has already injected, in viewport coordinates. */
type InjectedBox = { top: number; bottom: number; height: number };

type LineBox = {
  /** Offset from the block's own top with injected space factored out. */
  naturalTop: number;
  naturalBottom: number;
  /** Live viewport coordinates, valid only within this measurement pass. */
  clientTop: number;
  clientBottom: number;
  clientLeft: number;
};

/** A unit a block can be broken between: one line of text, or one table row. */
type Fragment = {
  naturalTop: number;
  naturalBottom: number;
  /** Build the break that pushes this fragment onto the next page. */
  breakAt: (gap: number) => PageBreak | null;
};

function makeSpacer(height: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hwp-page-spacer';
  el.style.height = `${Math.max(0, height)}px`;
  el.setAttribute('contenteditable', 'false');
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function buildDecorations(breaks: PageBreak[], doc: PMNode): DecorationSet {
  const decorations = breaks
    .filter((b) => b.pos >= 0 && b.pos <= doc.content.size)
    .map((b) =>
      b.kind === 'row' && b.to != null
        ? Decoration.node(b.pos, Math.min(b.to, doc.content.size), {
            class: 'hwp-row-break',
            style: `--row-pad: ${Math.max(0, b.height)}px`,
          })
        : Decoration.widget(b.pos, () => makeSpacer(b.height), {
            // side -1 places the spacer before the content it is pushing down.
            side: -1,
            key: `hwp-break-${b.pos}-${Math.round(b.height)}`,
            ignoreSelection: true,
          }),
    );
  return DecorationSet.create(doc, decorations);
}

function sameBreaks(a: PageBreak[], b: PageBreak[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (x, i) => x.pos === b[i].pos && x.kind === b[i].kind && Math.abs(x.height - b[i].height) < EPS,
  );
}

/** Space this pass previously injected inside a block, in viewport coords. */
function injectedInside(el: HTMLElement): InjectedBox[] {
  const boxes: InjectedBox[] = [];

  for (const node of Array.from(el.querySelectorAll('.hwp-page-spacer'))) {
    const rect = node.getBoundingClientRect();
    boxes.push({ top: rect.top, bottom: rect.bottom, height: rect.height });
  }

  // A row break adds padding rather than an element, so its height has to be
  // read back from the custom property that put it there.
  for (const row of Array.from(el.querySelectorAll('tr.hwp-row-break'))) {
    const height = parseFloat(getComputedStyle(row).getPropertyValue('--row-pad')) || 0;
    if (!height) continue;
    const rect = row.getBoundingClientRect();
    boxes.push({ top: rect.top, bottom: rect.top + height, height });
  }

  return boxes;
}

/** How much injected space sits above a given viewport position. */
function shiftAbove(boxes: InjectedBox[], clientTop: number): number {
  return boxes.reduce((total, box) => (box.bottom <= clientTop + EPS ? total + box.height : total), 0);
}

/**
 * Reconstruct a block's line boxes.
 *
 * Only text nodes are measured, so injected spacers (empty divs) contribute no
 * rects of their own. Their heights are then subtracted from each line's
 * offset, which recovers the geometry the block would have with no pagination
 * applied — the coordinate space the break math needs.
 */
function lineBoxesOf(el: HTMLElement, injected: InjectedBox[]): LineBox[] {
  const elTop = el.getBoundingClientRect().top;
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const rects: DOMRect[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.height > 0 && rect.width > 0) rects.push(rect);
    }
  }

  rects.sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: LineBox[] = [];
  for (const rect of rects) {
    const last = lines[lines.length - 1];
    // Rects on one visual line overlap vertically; a new line begins when a
    // rect's midpoint clears the line currently being built. Comparing
    // midpoints rather than edges keeps taller inline runs (code, images) on
    // the line they belong to.
    if (last && rect.top + rect.height / 2 < last.clientBottom) {
      last.clientTop = Math.min(last.clientTop, rect.top);
      last.clientBottom = Math.max(last.clientBottom, rect.bottom);
      last.clientLeft = Math.min(last.clientLeft, rect.left);
      continue;
    }
    lines.push({
      clientTop: rect.top,
      clientBottom: rect.bottom,
      clientLeft: rect.left,
      naturalTop: 0,
      naturalBottom: 0,
    });
  }

  for (const line of lines) {
    const shift = shiftAbove(injected, line.clientTop);
    line.naturalTop = line.clientTop - elTop - shift;
    line.naturalBottom = line.clientBottom - elTop - shift;
  }

  return lines;
}

/**
 * Document position of the first character on a given line.
 *
 * Deliberately not `posAtCoords`: that resolves a viewport point via
 * `elementFromPoint`, which returns nothing for content scrolled out of view,
 * so pagination would silently stop splitting below the fold. Range rects are
 * valid regardless of scroll position, so the line's start is found by binary
 * searching the text nodes for the first character whose box sits on it.
 */
function positionAtLineStart(view: EditorView, el: HTMLElement, line: LineBox): number | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!text.length) continue;

    range.selectNodeContents(text);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.height > 0);
    if (!rects.length) continue;

    const nodeBottom = Math.max(...rects.map((rect) => rect.bottom));
    if (nodeBottom <= line.clientTop + EPS) continue; // entirely above this line
    const nodeTop = Math.min(...rects.map((rect) => rect.top));
    if (nodeTop >= line.clientBottom - EPS) return null; // we have passed the line

    // Character boxes advance monotonically down the block, so the first
    // character on the line is a binary search away.
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      range.setStart(text, mid);
      range.setEnd(text, mid + 1);
      const rect = range.getBoundingClientRect();
      if (rect.height === 0) low = mid + 1;
      else if (rect.top + rect.height / 2 < line.clientTop) low = mid + 1;
      else high = mid;
    }

    if (low < text.length) return view.posAtDOM(text, low);
  }

  return null;
}

/** The lines of a text block, as breakable fragments. */
function lineFragments(view: EditorView, dom: HTMLElement, injected: InjectedBox[]): Fragment[] {
  return lineBoxesOf(dom, injected).map((line) => ({
    naturalTop: line.naturalTop,
    naturalBottom: line.naturalBottom,
    breakAt: (gap: number) => {
      const pos = positionAtLineStart(view, dom, line);
      return pos === null ? null : { pos, height: gap, kind: 'spacer' as const };
    },
  }));
}

/** The rows of a table, as breakable fragments. */
function rowFragments(view: EditorView, dom: HTMLElement, injected: InjectedBox[]): Fragment[] {
  const table = dom.matches('table') ? dom : dom.querySelector('table');
  if (!table) return [];
  const tableTop = table.getBoundingClientRect().top;

  const fragments: Fragment[] = [];
  for (const row of Array.from(table.rows)) {
    const rect = row.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(row).getPropertyValue('--row-pad')) || 0;
    const shift = shiftAbove(injected, rect.top + pad);

    let position: number | null = null;
    try {
      // posAtDOM lands inside the row; one back is the position before it,
      // which is what a node decoration needs to address.
      const inside = view.posAtDOM(row, 0);
      const candidate = inside - 1;
      if (view.state.doc.nodeAt(candidate)?.type.name === 'tableRow') position = candidate;
    } catch {
      position = null;
    }

    const nodeSize = position === null ? 0 : (view.state.doc.nodeAt(position)?.nodeSize ?? 0);

    fragments.push({
      // The row's own injected padding is part of the gap, not of the row.
      naturalTop: rect.top + pad - tableTop - shift,
      naturalBottom: rect.bottom - tableTop - shift,
      breakAt: (gap: number) =>
        position === null || !nodeSize
          ? null
          : { pos: position, to: position + nodeSize, height: gap, kind: 'row' as const },
    });
  }

  return fragments;
}

/**
 * Walk a block's fragments and break it across pages.
 *
 * Returns the total space injected inside the block, which the caller adds to
 * the block's natural height to get its rendered height.
 */
function splitBlock(
  fragments: Fragment[],
  startY: number,
  geo: Geometry,
  minKeep: number,
  breaks: PageBreak[],
  continuationPad = 0,
): number {
  const { stride, contentHeight } = geo;
  const pageOf = (at: number) => Math.max(0, Math.floor((at + EPS) / stride));
  let injected = 0;
  let from = 0;

  while (from < fragments.length) {
    const bandBottom = pageOf(startY + injected + fragments[from].naturalTop) * stride + contentHeight;

    let split = from;
    while (split < fragments.length && startY + injected + fragments[split].naturalBottom <= bandBottom + EPS) {
      split += 1;
    }
    if (split >= fragments.length) break;

    // Never strand fewer than minKeep on the next page, nor leave fewer behind.
    if (fragments.length - split < minKeep) split = fragments.length - minKeep;
    if (split - from < minKeep) split = from + minKeep;
    if (split <= from || split >= fragments.length) break;

    const fragmentTop = startY + injected + fragments[split].naturalTop;
    const gap = (pageOf(fragmentTop) + 1) * stride - fragmentTop + continuationPad;
    const pageBreak = fragments[split].breakAt(gap);
    if (!pageBreak) break;

    breaks.push(pageBreak);
    injected += gap;
    from = split;
  }

  return injected;
}

/**
 * Walk the top-level blocks and decide where the sheet boundaries fall.
 *
 * `y` tracks the current position in *rendered* flow coordinates — with the
 * spacers being computed already accounted for. Page `p` owns the band
 * [p*stride, p*stride + contentHeight]; the space after it is the bottom
 * margin, the on-screen gutter, and the next page's top margin.
 */
function measure(view: EditorView, geo: Geometry): { breaks: PageBreak[]; pageCount: number } {
  const breaks: PageBreak[] = [];
  const { stride, contentHeight } = geo;
  // Biased by EPS, not by a token 1e-6: a break lands the flow within a
  // fraction of a pixel of a stride multiple, and a position of 1091.99 on a
  // 1092 stride must read as the top of the next page, not the foot of the
  // previous one. Getting this wrong inserts a spurious full-page spacer.
  const pageOf = (at: number) => Math.max(0, Math.floor((at + EPS) / stride));
  let y = 0;

  view.state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;

    // An explicit page break jumps to the next sheet. If we are already at the
    // top of a fresh page it is a no-op rather than a blank page.
    if (node.type.name === 'pageBreak') {
      const page = pageOf(y);
      if (y > page * stride + EPS) {
        breaks.push({ pos: offset, height: (page + 1) * stride - y, kind: 'spacer' });
        y = (page + 1) * stride;
      }
      return;
    }

    const injected = injectedInside(dom);
    const alreadyInjected = injected.reduce((total, box) => total + box.height, 0);
    const naturalHeight = dom.getBoundingClientRect().height - alreadyInjected;
    // Document blocks carry bottom margins only (see document.css), so no
    // margin collapsing happens between siblings and the advance is exact.
    const marginBottom = parseFloat(getComputedStyle(dom).marginBottom) || 0;

    // Fragments are only needed for a block that actually crosses a boundary,
    // and reconstructing them is the expensive part of the pass — so they are
    // built lazily rather than for every block in the document.
    const pageBottom = pageOf(y) * stride + contentHeight;
    const overflows = y + naturalHeight > pageBottom + EPS;
    const isTable = node.type.name === 'table';
    const minKeep = isTable ? MIN_ROWS : MIN_LINES;

    let fragments: Fragment[] = [];
    if (overflows) {
      if (isTable) fragments = rowFragments(view, dom, injected);
      else if (SPLITTABLE.has(node.type.name)) fragments = lineFragments(view, dom, injected);
    }
    const splittable = fragments.length >= minKeep * 2;

    /** How many of this block's fragments fit on the page that `from` sits on. */
    const fittingFrom = (from: number) => {
      const bottom = pageOf(from) * stride + contentHeight;
      let count = 0;
      while (count < fragments.length && from + fragments[count].naturalBottom <= bottom + EPS) count += 1;
      return count;
    };

    // Leading break: the block as a whole does not fit, and either it cannot
    // split or too little of it would be left behind to be worth splitting.
    const startsMidPage = y > pageOf(y) * stride + EPS;
    if (overflows && startsMidPage && (!splittable || fittingFrom(y) < minKeep)) {
      const nextTop = (pageOf(y) + 1) * stride;
      breaks.push({ pos: offset, height: nextTop - y, kind: 'spacer' });
      y = nextTop;
    }

    const injectedHere = splittable
      ? splitBlock(
          fragments,
          y,
          geo,
          minKeep,
          breaks,
          node.type.name === 'codeBlock' ? CODE_CONTINUATION_PAD : 0,
        )
      : 0;

    y += naturalHeight + injectedHere + marginBottom;
  });

  return { breaks, pageCount: Math.floor(Math.max(0, y - EPS) / stride) + 1 };
}

export type PaginationOptions = {
  geometry: Geometry;
  onPageCount?: (count: number) => void;
};

export const Pagination = Extension.create<PaginationOptions>({
  name: 'hwpPagination',

  addOptions() {
    return {
      geometry: null as unknown as Geometry,
      onPageCount: undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin<PaginationState>({
        key: paginationKey,

        state: {
          init: () => ({ breaks: [], pageCount: 1, decorations: DecorationSet.empty }),

          apply(tr, value) {
            const meta = tr.getMeta(paginationKey) as PaginationState | undefined;
            if (meta) return meta;
            if (!tr.docChanged) return value;
            // Keep the existing spacers roughly in place until the next
            // measurement lands, so the page doesn't flash while typing.
            return {
              ...value,
              breaks: value.breaks.map((b) => ({
                ...b,
                pos: tr.mapping.map(b.pos, -1),
                to: b.to == null ? undefined : tr.mapping.map(b.to, 1),
              })),
              decorations: value.decorations.map(tr.mapping, tr.doc),
            };
          },
        },

        props: {
          decorations(state) {
            return paginationKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },

        view(editorView) {
          let frame = 0;
          let passes = 0;
          let destroyed = false;

          const run = () => {
            frame = 0;
            // A torn-down view can still have a frame in flight. Reporting from
            // one lets a dead editor's page count overwrite the live one's.
            if (destroyed) return;

            const current = paginationKey.getState(editorView.state);
            if (!current) return;

            const next = measure(editorView, options.geometry);

            // Reported every pass rather than deduped here: the consumer owns
            // this value, and a local cache of it goes stale across remounts.
            options.onPageCount?.(next.pageCount);

            if (sameBreaks(next.breaks, current.breaks) && next.pageCount === current.pageCount) {
              passes = 0;
              return;
            }

            editorView.dispatch(
              editorView.state.tr
                .setMeta(paginationKey, {
                  breaks: next.breaks,
                  pageCount: next.pageCount,
                  decorations: buildDecorations(next.breaks, editorView.state.doc),
                })
                .setMeta('addToHistory', false)
                .setMeta('preventUpdate', true),
            );

            // Inserting spacers changes layout; re-measure until it settles.
            if (++passes < MAX_PASSES) schedule();
            else passes = 0;
          };

          const schedule = () => {
            if (frame) return;
            frame = requestAnimationFrame(run);
          };

          const resizeObserver = new ResizeObserver(() => {
            passes = 0;
            schedule();
          });
          resizeObserver.observe(editorView.dom);

          // Web fonts land after first paint and change every block height.
          if (document.fonts?.ready) {
            document.fonts.ready.then(() => {
              passes = 0;
              schedule();
            });
          }

          schedule();

          return {
            update: () => {
              passes = 0;
              schedule();
            },
            destroy: () => {
              destroyed = true;
              if (frame) cancelAnimationFrame(frame);
              resizeObserver.disconnect();
            },
          };
        },
      }),
    ];
  },
});
