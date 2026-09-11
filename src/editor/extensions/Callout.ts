import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { cornersAttribute } from '../corners';
import { shadowAttribute } from '../shadow';

export type CalloutVariant = 'plain' | 'note' | 'warning' | 'quiet';

/**
 * GitHub's alert kinds. The label is what the block says above its content;
 * it is stored only when it differs from the default, so a document that uses
 * the ordinary wording carries no label at all.
 */
export const ALERT_KINDS = [
  { value: 'note', label: 'Note' },
  { value: 'tip', label: 'Tip' },
  { value: 'important', label: 'Important' },
  { value: 'warning', label: 'Warning' },
  { value: 'caution', label: 'Caution' },
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number]['value'];

export function defaultAlertLabel(kind: string): string {
  return ALERT_KINDS.find((entry) => entry.value === kind)?.label ?? kind;
}

/** `> [!NOTE]`, or `> [!IMPORTANT] LOOK AT THIS!` with a label of your own. */
const ALERT_LINE = /^\[!(note|tip|important|warning|caution)\]\s*(.*)$/i;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (variant?: CalloutVariant) => ReturnType;
      toggleCallout: (variant?: CalloutVariant) => ReturnType;
      unsetCallout: () => ReturnType;
      /** Make the section an alert — or, with `null`, an ordinary section. */
      setAlert: (kind: AlertKind | null, label?: string | null) => ReturnType;
    };
  }
}

/**
 * A bordered, rounded section — the block that motivates the whole project.
 * It is a real container node, so it can hold headings, lists and tables, and
 * it renders to a plain `<section class="hwp-callout">` in the saved file.
 *
 * It doubles as GitHub's alert: typing `> [!NOTE]` and pressing Enter turns
 * the quote into a note, and everything typed afterwards lands inside it. The
 * label is drawn by the stylesheet from `data-label`, the same trick the code
 * block uses for its language, so an alert needs no chrome to read correctly
 * in the editor, on paper, or in a saved file opened on its own.
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'plain' as CalloutVariant,
        parseHTML: (element) => element.getAttribute('data-variant') || 'plain',
        renderHTML: (attributes) => ({ 'data-variant': attributes.variant }),
      },

      /** One of GitHub's five alert kinds, or null for a plain section. */
      alert: {
        default: null as AlertKind | null,
        parseHTML: (element) => element.getAttribute('data-alert'),
        renderHTML: (attributes) =>
          attributes.alert ? { 'data-alert': String(attributes.alert) } : {},
      },

      /**
       * The heading the block shows. Stored only when it is not the default
       * for the kind, but always rendered, because the stylesheet draws it
       * with `content: attr(data-label)` and cannot fall back on its own.
       */
      label: {
        default: null as string | null,
        parseHTML: (element) => {
          const kind = element.getAttribute('data-alert');
          const label = element.getAttribute('data-label');
          if (!kind || !label || label === defaultAlertLabel(kind)) return null;
          return label;
        },
        renderHTML: (attributes) =>
          attributes.alert
            ? {
                'data-label':
                  (attributes.label as string) || defaultAlertLabel(String(attributes.alert)),
              }
            : {},
      },

      /** Per-corner radii, "tl tr br bl" in px. See `editor/corners.ts`. */
      corners: cornersAttribute('sec'),

      /** Elevation. See `editor/shadow.ts`. */
      shadow: shadowAttribute(),
    };
  },

  parseHTML() {
    return [{ tag: 'section.hwp-callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { class: 'hwp-callout' }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (variant = 'plain') =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant }),
      toggleCallout:
        (variant = 'plain') =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { variant }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),

      setAlert:
        (kind, label = null) =>
        ({ editor, commands }) => {
          const attributes = { alert: kind, label: kind ? label : null };
          if (editor.isActive(this.name)) return commands.updateAttributes(this.name, attributes);
          return commands.wrapIn(this.name, { variant: 'plain', ...attributes });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      /**
       * `[!NOTE]` on its own line commits on Enter rather than as it is typed,
       * because the rest of that line is the custom label — converting at the
       * closing bracket would leave nowhere to write it.
       */
      Enter: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parent.type.name !== 'paragraph') return false;

        const match = ALERT_LINE.exec($from.parent.textContent.trim());
        if (!match) return false;

        const kind = match[1].toLowerCase() as AlertKind;
        const label = match[2].trim() || null;
        const type = state.schema.nodes[this.name];
        const paragraph = state.schema.nodes.paragraph;
        if (!type || !paragraph) return false;

        const depth = $from.depth;
        const container = depth >= 1 ? $from.node(depth - 1) : null;
        const name = container?.type.name;
        // A quote is what `>` produced a moment ago, and a section may already
        // be here; either way the marker line is consumed and its siblings
        // move into the alert. Anything else: just this paragraph.
        const absorb = name === 'blockquote' || name === this.name;

        let content: ProseMirrorNode[] = [];
        if (absorb && container) {
          const index = $from.index(depth - 1);
          container.forEach((child, _offset, position) => {
            if (position !== index) content.push(child);
          });
        }
        if (content.length === 0) content = [paragraph.create()];

        const attrs = {
          ...(name === this.name ? container?.attrs : {}),
          variant: (container?.attrs.variant as CalloutVariant) ?? 'plain',
          alert: kind,
          label,
        };

        const from = absorb ? $from.before(depth - 1) : $from.before(depth);
        const to = absorb ? $from.after(depth - 1) : $from.after(depth);

        const tr = state.tr.replaceWith(from, to, type.create(attrs, content));
        tr.setSelection(TextSelection.near(tr.doc.resolve(from + 2)));
        view.dispatch(tr.scrollIntoView());
        return true;
      },
    };
  },

  addInputRules() {
    // Typing ":::" at the start of a line opens a callout, mirroring the
    // fenced-container convention used by most markdown extensions.
    return [
      wrappingInputRule({
        find: /^:::\s$/,
        type: this.type,
        getAttributes: () => ({ variant: 'plain' }),
      }),
    ];
  },
});
