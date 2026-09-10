import { Extension, InputRule } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * The markdown input rules Tiptap does not ship.
 *
 * Headings, lists, quotes, rules, emphasis and code spans all arrive with the
 * starter kit; links and images do not, and a link is the one piece of
 * markdown nobody is willing to reach for a toolbar to write.
 *
 * Both rules fire on the closing parenthesis, which is the moment the syntax
 * becomes unambiguous — waiting for a space would leave `](url)` sitting in
 * the document looking like a mistake.
 */

/** `[label](https://example.com "title")` — the title is optional. */
const LINK = /\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/;

/** `![alt](https://example.com/a.png)` — the leading `!` is what separates it. */
const IMAGE = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/;

export const MarkdownRules = Extension.create({
  name: 'markdownRules',

  addInputRules() {
    const { schema } = this.editor;
    const rules: InputRule[] = [];

    if (schema.nodes.image) {
      rules.push(
        new InputRule({
          find: IMAGE,
          handler: ({ state, range, match }) => {
            const [, alt, src, title] = match;
            const image = schema.nodes.image.create({ src, alt: alt || null, title: title || null });
            const { $from } = state.selection;

            // An image is a block. Dropped into a paragraph it splits it and
            // leaves an empty one behind, so when the markup is the entire
            // line the paragraph itself is what gets replaced.
            const alone = range.from === $from.start() && range.to >= $from.end();
            const from = alone ? $from.before() : range.from;
            const to = alone ? $from.after() : range.to;

            const tr = state.tr.replaceWith(from, to, image);

            // Somewhere to stand afterwards. Without it the selection lands on
            // the image itself and the next character typed replaces it — and
            // an image at the very end of a document would leave the caret
            // with nowhere to go at all.
            const after = from + image.nodeSize;
            const next = tr.doc.nodeAt(after);
            if (!next?.isTextblock) tr.insert(after, schema.nodes.paragraph.create());
            tr.setSelection(TextSelection.near(tr.doc.resolve(after), 1));
          },
        }),
      );
    }

    if (schema.nodes.taskList && schema.nodes.taskItem) {
      rules.push(
        new InputRule({
          // GitHub's `- [ ] ` — by the time the box is typed the bullet list
          // rule has already run, so this converts the list rather than
          // wrapping a paragraph the way the packaged rule does.
          find: /^\[([ xX])\]\s$/,
          handler: ({ state, range, match }) => {
            const { $from } = state.selection;
            const itemDepth = $from.depth - 1;
            if (itemDepth < 1) return;
            const item = $from.node(itemDepth);
            const list = $from.node(itemDepth - 1);
            if (item.type.name !== 'listItem' || list.type.name !== 'bulletList') return;

            // Order matters. The marker text goes first, while this is
            // still an ordinary list and the step is valid; the list is then
            // retyped in a single replacement, because a task list holding
            // list items — or the reverse — is not a document ProseMirror
            // will let exist even for one step.
            const { tr } = state;
            tr.delete(range.from, range.to);

            const listPos = $from.before(itemDepth - 1);
            const updated = tr.doc.nodeAt(listPos);
            if (!updated) return;

            const index = $from.index(itemDepth - 1);
            const items: ProseMirrorNode[] = [];
            updated.forEach((child, _offset, at) =>
              items.push(
                schema.nodes.taskItem.create(
                  { checked: at === index && match[1].toLowerCase() === 'x' },
                  child.content,
                ),
              ),
            );

            tr.replaceWith(listPos, listPos + updated.nodeSize, schema.nodes.taskList.create(null, items));
            tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(range.from, tr.doc.content.size))));
          },
        }),
      );
    }

    if (schema.marks.link) {
      rules.push(
        new InputRule({
          // `![alt](src)` also matches the link shape, so an image that has
          // just been handled above must not be turned into a link too.
          find: LINK,
          handler: ({ state, range, match }) => {
            const [whole, text, href, title] = match;
            if (whole.startsWith('!')) return;
            const label = text || href;
            const mark = schema.marks.link.create({ href, title: title || null });
            state.tr
              .replaceWith(range.from, range.to, schema.text(label, [mark]))
              .removeStoredMark(schema.marks.link);
          },
        }),
      );
    }

    return rules;
  },
});
