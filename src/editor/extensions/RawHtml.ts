import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    rawHtml: {
      insertRawHtml: (html: string) => ReturnType;
      updateRawHtml: (html: string) => ReturnType;
    };
  }
}

/**
 * An escape hatch for markup the schema doesn't model — inline SVG, an
 * embedded chart, a hand-written table. The content is stored verbatim and
 * written straight back out when the document is saved.
 *
 * NOTE: the markup is rendered unsanitized, which is fine for text you author
 * yourself but is a hole if this ever opens untrusted documents. Sanitizing on
 * the parse path is the fix, and it is not done yet.
 */
export const RawHtml = Node.create({
  name: 'rawHtml',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      html: {
        default: '',
        /* A matched <svg> *is* the markup; anything else is a wrapper around
           it, so the content is what lives inside. */
        parseHTML: (element) =>
          element.tagName.toLowerCase() === 'svg' ? element.outerHTML : element.innerHTML,
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div.hwp-raw' },
      /* A bare <svg> — pasted from a drawing tool, or arriving back from a
         markdown export, where inline HTML is how a figure survives at all.
         Without this the schema has no node for it and it is dropped. */
      {
        tag: 'svg',
        getAttrs: (element: HTMLElement) => ({ html: element.outerHTML }),
        priority: 60,
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const dom = document.createElement('div');
    const attrs = mergeAttributes(HTMLAttributes, { class: 'hwp-raw' });
    for (const [key, value] of Object.entries(attrs)) {
      if (key !== 'html' && value != null) dom.setAttribute(key, String(value));
    }
    dom.innerHTML = String(node.attrs.html ?? '');
    return dom;
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'hwp-raw';
      dom.contentEditable = 'false';
      dom.innerHTML = String(node.attrs.html ?? '');
      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== 'rawHtml') return false;
          dom.innerHTML = String(updated.attrs.html ?? '');
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      insertRawHtml:
        (html: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { html } }),
      updateRawHtml:
        (html: string) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { html }),
    };
  },
});
