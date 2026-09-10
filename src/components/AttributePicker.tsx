import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

export type PickerOption = { value: string; label: string; style?: CSSProperties };

type AttributePickerProps = {
  options: PickerOption[];
  value: string;
  label: string;
  /** Shown when the value is empty — the theme's own setting, spelled out. */
  placeholder?: string;
  width?: number;
  menuWidth?: number;
  /** `field` is the boxed ribbon control; `inline` is bare clickable text. */
  variant?: 'field' | 'inline';
  onSelect: (value: string) => void;
};

const GAP = 4;
const EDGE = 8;
/** Roughly ten options. A 30-item list should not take over the screen. */
const OPTION_HEIGHT = 26;
const MAX_MENU_HEIGHT = OPTION_HEIGHT * 10 + 8;

/**
 * A dropdown that writes one value.
 *
 * The menu is rendered through a portal and positioned against the viewport,
 * not nested under the button. The ribbon scrolls horizontally, which makes it
 * an `overflow` container — anything drawn inside it is clipped at its edge,
 * so a menu that lived in the DOM next to its button would simply be cut off
 * rather than merely stacked behind something.
 *
 * Deliberately not a native `<select>`: options can be previewed in their own
 * typeface, and a native select paints a platform arrow that has no place in
 * a document surface.
 */
export function AttributePicker({
  options,
  value,
  label,
  placeholder,
  width,
  menuWidth,
  variant = 'field',
  onSelect,
}: AttributePickerProps) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<CSSProperties | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !host.current) return;
    const rect = host.current.getBoundingClientRect();
    const width = menuWidth ?? Math.max(rect.width, 140);
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const flip = below < 180 && rect.top > below;

    setBox({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - width - EDGE),
      width,
      maxHeight: Math.min(MAX_MENU_HEIGHT, Math.max(140, flip ? rect.top - GAP - EDGE : below)),
      ...(flip ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    });
  }, [open, menuWidth]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (host.current?.contains(target) || menu.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    // The menu is positioned against the viewport, so any movement stales it.
    // Scrolling the page moves the anchor, so the menu must close — but
    // scrolling *inside* the menu is how a long list is read. Closing on that
    // dismissed the menu mid-gesture and let the wheel fall through to the
    // page behind it.
    const onScroll = (event: Event) => {
      if (menu.current?.contains(event.target as Node)) return;
      close();
    };

    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const current = options.find((option) => option.value === value);

  const inline = variant === 'inline';

  return (
    <div className={inline ? 'hwp-codeblock-picker' : 'tb-picker'} ref={host}>
      <button
        type="button"
        className={inline ? 'hwp-codeblock-language' : 'tb-select tb-select--button'}
        style={width && !inline ? { width } : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        data-tip={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {inline ? (
          current?.label ?? placeholder ?? value
        ) : (
          <>
            <span className="tb-select-value">{current?.label ?? placeholder ?? value}</span>
            <span className="tb-select-caret" aria-hidden>
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none">
                <path d="M1 1.2 4.5 4.7 8 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </>
        )}
      </button>

      {open && box
        ? createPortal(
            <div className="tb-picker-menu" role="listbox" ref={menu} style={box}>
              {options.map((option) => (
                <button
                  key={option.value || 'default'}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`tb-picker-option${option.value === value ? ' is-current' : ''}`}
                  style={option.style}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
