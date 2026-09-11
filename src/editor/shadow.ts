/**
 * Elevation — a shadow that lifts a block off the page.
 *
 * Four steps rather than a free-form CSS box-shadow. A shadow is a physical
 * claim about how far something floats, and a document where every table
 * floats at a slightly different height looks like an accident rather than a
 * design. The steps are shared by tables, sections, code blocks and images, so
 * two elevated things on the same page agree with each other.
 */

export const SHADOW_LEVELS = [
  { value: '', label: 'None' },
  { value: 'soft', label: 'Soft' },
  { value: 'lift', label: 'Lifted' },
  { value: 'float', label: 'Floating' },
] as const;

export type ShadowLevel = (typeof SHADOW_LEVELS)[number]['value'];

/** A Tiptap attribute storing the level as `data-shadow`. */
export function shadowAttribute() {
  return {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.getAttribute('data-shadow'),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.shadow ? { 'data-shadow': String(attributes.shadow) } : ({} as Record<string, string>),
  };
}
