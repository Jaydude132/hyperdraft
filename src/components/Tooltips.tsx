import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Tooltips for anything carrying `data-tip`.
 *
 * The browser's own `title` tooltip waits about a second before appearing and
 * the delay cannot be changed, which makes a dense toolbar of icon buttons
 * slow to learn. This shows after a beat instead.
 */

const DELAY = 110;
const GAP = 7;
/** Keep this much clear of the window edge. */
const EDGE = 6;

type Tip = { text: string; x: number; y: number; above: boolean };

export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const node = useRef<HTMLDivElement>(null);

  /**
   * The tip is centred on its button, which pushes it off screen for the
   * buttons at either end of the toolbar — the leftmost one lost its label
   * entirely. Nudge it back inside once it has been laid out and its width is
   * known; the arrow-less design means a shifted tip still reads correctly.
   */
  useLayoutEffect(() => {
    const element = node.current;
    if (!tip || !element) return;
    const half = element.offsetWidth / 2;
    const limit = window.innerWidth - EDGE - half;
    element.style.left = `${Math.min(Math.max(tip.x, EDGE + half), Math.max(limit, EDGE + half))}px`;
  }, [tip]);

  useEffect(() => {
    let timer = 0;
    let anchor: HTMLElement | null = null;

    const hide = () => {
      window.clearTimeout(timer);
      anchor = null;
      setTip(null);
    };

    const onOver = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (!target || target === anchor) return;
      window.clearTimeout(timer);
      anchor = target;
      timer = window.setTimeout(() => {
        const text = target.getAttribute('data-tip');
        if (!text || !target.isConnected) return;
        const rect = target.getBoundingClientRect();
        // Flip above when there is no room below.
        const above = rect.bottom + 40 > window.innerHeight;
        setTip({
          text,
          x: rect.left + rect.width / 2,
          y: above ? rect.top - GAP : rect.bottom + GAP,
          above,
        });
      }, DELAY);
    };

    const onOut = (event: MouseEvent) => {
      const to = event.relatedTarget as Node | null;
      if (anchor && to && anchor.contains(to)) return;
      hide();
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('keydown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mousedown', hide, true);
      document.removeEventListener('keydown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;

  return (
    <div
      ref={node}
      className={`tip${tip.above ? ' tip--above' : ''}`}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>
  );
}
