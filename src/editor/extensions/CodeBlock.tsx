import { useEffect, useRef } from 'react';
import { mergeAttributes, textblockTypeInputRule } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { AttributePicker } from '../../components/AttributePicker';
import { cornersAttribute, cornerStyleObject } from '../corners';
import { shadowAttribute } from '../shadow';
import { CODE_LANGUAGES, languageLabel, lowlight } from '../highlighting';

/**
 * A syntax-highlighted code block with a language picker and an optional
 * filename.
 *
 * Two constraints shape this:
 *
 *   - Nothing here may print. The header controls are chrome; on paper the
 *     same information is drawn from `data-` attributes by the document
 *     stylesheet, so the block reads identically without a single control.
 *   - The controls are positioned inside padding that `<pre>` reserves, never
 *     stacked above it, so the block is exactly as tall in the editor, in
 *     print, and in a saved file opened on its own. A block whose height
 *     changed between those would desynchronize the pagination engines.
 *
 * The language is a plain button rather than a `<select>`: a native select
 * paints its own dropdown arrow that has no business on a printed page, and
 * inside a ProseMirror node view it does not reliably repaint after a choice.
 */
function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string) || 'plaintext';
  const filename = (node.attrs.filename as string) || '';
  const codeTheme = (node.attrs.codeTheme as string) || 'dark';
  const editable = editor.isEditable;
  const filenameInput = useRef<HTMLInputElement>(null);

  /**
   * ProseMirror listens for keys on an ancestor of this input, and its handler
   * runs before React's delegated one — so React's `stopPropagation` is too
   * late and every keystroke is swallowed as an editor command. A native
   * listener on the input itself runs first and lets the field be typed in.
   */
  useEffect(() => {
    const input = filenameInput.current;
    if (!input) return;
    const swallow = (event: Event) => event.stopPropagation();
    for (const type of ['keydown', 'keypress', 'keyup'] as const) {
      input.addEventListener(type, swallow);
    }
    return () => {
      for (const type of ['keydown', 'keypress', 'keyup'] as const) {
        input.removeEventListener(type, swallow);
      }
    };
  }, []);

  return (
    <NodeViewWrapper className="hwp-codeblock">
      <div className="hwp-codeblock-bar" contentEditable={false}>
        <AttributePicker
          options={CODE_LANGUAGES}
          value={language}
          label="Change language"
          variant="inline"
          menuWidth={180}
          onSelect={(next) => updateAttributes({ language: next })}
        />

        <input
          ref={filenameInput}
          className="hwp-codeblock-filename"
          value={filename}
          disabled={!editable}
          spellCheck={false}
          placeholder="filename"
          aria-label="Code block filename"
          onChange={(event) => updateAttributes({ filename: event.target.value })}
        />
      </div>

      {/* The same attributes renderHTML writes, so print and a saved file read
          one contract rather than two. */}
      {/* The corner properties are applied here by hand: this `<pre>` is
          written in JSX and never sees what `renderHTML` produces, so an
          attribute that only rode along with the saved markup would style the
          file and not the editor. */}
      <pre
        data-language={languageLabel(language)}
        data-filename={filename || undefined}
        data-code-theme={codeTheme}
        data-shadow={(node.attrs.shadow as string) || undefined}
        style={cornerStyleObject(node.attrs.corners, 'code')}
      >
        <NodeViewContent<'code'> as="code" className={`language-${language}`} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),

      /** Shown in the block's header; useful when the code *is* a file. */
      filename: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-filename') || null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.filename ? { 'data-filename': String(attributes.filename) } : {},
      },

      /** Per-corner radii, "tl tr br bl" in px. See `editor/corners.ts`. */
      corners: cornersAttribute('code'),

      /** Elevation. See `editor/shadow.ts`. */
      shadow: shadowAttribute(),

      /** Code reads better dark, so that is the default; per block it can flip. */
      codeTheme: {
        default: 'dark',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-code-theme') || 'dark',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-code-theme': String(attributes.codeTheme ?? 'dark'),
        }),
      },
    };
  },

  /**
   * Three backticks open a block immediately, rather than waiting for a space
   * or a newline the way the packaged rule does. The language is chosen from
   * the picker in the block's own corner, which is a better place for it than
   * a fence nobody can see once the block exists.
   */
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      textblockTypeInputRule({ find: /^```$/, type: this.type }),
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const language = (node.attrs.language as string) || 'plaintext';
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-language': languageLabel(language),
      }),
      ['code', { class: `${this.options.languageClassPrefix}${language}` }, 0],
    ];
  },

  addKeyboardShortcuts() {
    /**
     * Inside a code block Tab is indentation, not focus movement — anything
     * else makes the block unusable for actually writing code. A real tab
     * character is inserted rather than spaces, so the saved file keeps
     * whatever the author typed; `tab-size` decides how wide it looks.
     */
    const indent = (outdent: boolean) => () => {
      const { state } = this.editor;
      const { $from, from, to, empty } = state.selection;

      // Not `isActive`: for a range selection covering the whole block that
      // reports false, and Tab would fall through to focus movement exactly
      // when the user is trying to indent several lines at once.
      if ($from.parent.type.name !== this.name) return false;

      if (empty && !outdent) return this.editor.commands.insertContent('\t');

      const blockStart = $from.start();
      const text = $from.parent.textContent;

      // Every line the selection touches, by offset within the block.
      const lineStarts: number[] = [];
      let cursor = 0;
      for (const line of text.split('\n')) {
        const start = cursor;
        const end = cursor + line.length;
        if (end >= from - blockStart && start <= to - blockStart) lineStarts.push(start);
        cursor = end + 1;
      }
      if (!lineStarts.length) return false;

      const tr = state.tr;
      // Applied back to front so earlier edits cannot shift later positions.
      for (const start of [...lineStarts].reverse()) {
        const at = blockStart + start;
        if (!outdent) {
          tr.insertText('\t', at);
          continue;
        }
        const rest = text.slice(start);
        const width = rest.startsWith('\t') ? 1 : Math.min(4, rest.length - rest.trimStart().length);
        if (width > 0) tr.delete(at, at + width);
      }
      if (!tr.docChanged) return true;
      this.editor.view.dispatch(tr);
      return true;
    };

    return {
      ...this.parent?.(),
      Tab: indent(false),
      'Shift-Tab': indent(true),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView, {
      // Everything in the header bar is chrome, not document content — the
      // editor must keep its hands off those events entirely.
      stopEvent: ({ event }) =>
        Boolean((event.target as HTMLElement | null)?.closest?.('.hwp-codeblock-bar')),
    });
  },
}).configure({
  lowlight,
  defaultLanguage: 'plaintext',
});
