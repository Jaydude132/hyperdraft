import { useMemo } from 'react';
import type { ChangeEvent, RefObject, UIEvent } from 'react';
import { toHtml } from 'hast-util-to-html';
import { lowlight } from '../editor/highlighting';

/**
 * The markup editor: a textarea with the same text painted behind it, coloured.
 *
 * A `<textarea>` cannot draw coloured text, and replacing it with a
 * contenteditable would trade a reliable editing surface for a pile of
 * selection bugs. So the textarea stays, its own text turned transparent, and
 * a highlighted copy is painted underneath in exactly the same metrics. The
 * two must agree on font, size, line height and padding or the illusion comes
 * apart — which is why those live in one rule in the stylesheet rather than
 * being set twice.
 *
 * The highlighter is the one the document already uses for code blocks, so no
 * second library and no second palette.
 */

type MarkupEditorProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export function MarkupEditor({ value, onChange, inputRef }: MarkupEditorProps) {
  const painted = useMemo(() => {
    try {
      return toHtml(lowlight.highlight('xml', value));
    } catch {
      // Half-typed markup is the normal state of this box, so a highlighter
      // that gives up must not take the text with it.
      return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }
  }, [value]);

  /** Keep the paint under the text when either scrolls. */
  const sync = (event: UIEvent<HTMLTextAreaElement>) => {
    const paint = event.currentTarget.previousElementSibling as HTMLElement | null;
    if (!paint) return;
    paint.scrollTop = event.currentTarget.scrollTop;
    paint.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div className="markup-editor">
      <pre className="markup-paint" aria-hidden>
        {/* The trailing newline keeps the last line's height, so the caret at
            the end of the text has painted text to sit against. */}
        <code dangerouslySetInnerHTML={{ __html: `${painted}\n` }} />
      </pre>

      <textarea
        ref={inputRef}
        className="markup-input"
        value={value}
        spellCheck={false}
        onScroll={sync}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Tab indents markup; it does not leave the box you are editing in.
          if (event.key !== 'Tab' || event.metaKey || event.ctrlKey) return;
          event.preventDefault();
          const field = event.currentTarget;
          const { selectionStart: start, selectionEnd: end } = field;
          const next = `${value.slice(0, start)}  ${value.slice(end)}`;
          onChange(next);
          requestAnimationFrame(() => field.setSelectionRange(start + 2, start + 2));
        }}
      />
    </div>
  );
}
