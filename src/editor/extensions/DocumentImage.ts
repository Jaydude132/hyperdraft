import Image from '@tiptap/extension-image';
import { cornersAttribute } from '../corners';
import { shadowAttribute } from '../shadow';

/**
 * An image, styled like everything else in the document.
 *
 * The packaged extension carries a source and an alt text, which is all a
 * markdown image needs. A document wants more: an image is a block on a page,
 * so it takes the same corner radii and elevation as a table or a section, and
 * a matte — padding in a fill colour, the frame a photograph gets when it is
 * mounted rather than pasted.
 */
export const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),

      /** Per-corner radii, "tl tr br bl" in px. See `editor/corners.ts`. */
      corners: cornersAttribute('img'),

      /** Elevation. See `editor/shadow.ts`. */
      shadow: shadowAttribute(),

      /** The matte colour, or null for none. */
      fill: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) =>
          element.hasAttribute('data-fill') ? element.style.getPropertyValue('--img-fill') || '#f4f6fa' : null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.fill
            ? { 'data-fill': 'true', style: `--img-fill: ${attributes.fill}` }
            : ({} as Record<string, string>),
      },

      align: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-align'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.align ? { 'data-align': String(attributes.align) } : ({} as Record<string, string>),
      },
    };
  },
});
