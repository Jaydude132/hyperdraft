/**
 * Running headers and footers — the page furniture.
 *
 * Word puts them in the page margins, repeated on every sheet, with fields
 * that resolve per page. This does the same, and the fields are the reason it
 * cannot simply be text in the document: `{page}` has a different answer on
 * every page, so the furniture has to be drawn by whoever knows which page is
 * being drawn.
 *
 * It is document-level state rather than editor content. Nothing here enters
 * the ProseMirror document, the undo history, or the flow the pagination pass
 * measures — a header that changed the height of the text would move the very
 * page breaks it is numbering.
 */

export type FurnitureSlots = { left: string; center: string; right: string };

export type Furniture = {
  header: FurnitureSlots;
  footer: FurnitureSlots;
  /** Word's "different first page", in the form people actually use it. */
  skipFirstPage: boolean;
};

export const SLOT_NAMES = ['left', 'center', 'right'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

const EMPTY: FurnitureSlots = { left: '', center: '', right: '' };

export const EMPTY_FURNITURE: Furniture = {
  header: { ...EMPTY },
  footer: { ...EMPTY },
  skipFirstPage: false,
};

/** The fields, and what they stand for. Shown in the dialog, click to insert. */
export const FURNITURE_FIELDS = [
  { token: '{page}', label: 'Page' },
  { token: '{pages}', label: 'Total' },
  { token: '{title}', label: 'Title' },
  { token: '{date}', label: 'Date' },
] as const;

export type FurnitureContext = {
  page: number;
  pages: number;
  title: string;
  date: string;
};

export function resolveFields(text: string, context: FurnitureContext): string {
  return text
    .replace(/\{page\}/g, String(context.page))
    .replace(/\{pages\}/g, String(context.pages))
    .replace(/\{title\}/g, context.title)
    .replace(/\{date\}/g, context.date);
}

export function slotsUsed(slots: FurnitureSlots): boolean {
  return SLOT_NAMES.some((slot) => slots[slot].trim() !== '');
}

export function hasFurniture(furniture: Furniture): boolean {
  return slotsUsed(furniture.header) || slotsUsed(furniture.footer);
}

/** The date as the document shows it. One place, so screen and paper agree. */
export function today(): string {
  return new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* --- Persistence ----------------------------------------------------------
   Stored as JSON in a `<meta>`, which keeps it out of the body: a saved file
   is still a document, not a document plus a configuration block. */

export function serializeFurniture(furniture: Furniture): string {
  return JSON.stringify(furniture);
}

export function parseFurniture(value: string | null | undefined): Furniture {
  if (!value) return EMPTY_FURNITURE;
  try {
    const parsed = JSON.parse(value) as Partial<Furniture>;
    return {
      header: { ...EMPTY, ...(parsed.header ?? {}) },
      footer: { ...EMPTY, ...(parsed.footer ?? {}) },
      skipFirstPage: Boolean(parsed.skipFirstPage),
    };
  } catch {
    return EMPTY_FURNITURE;
  }
}
