import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type MenuEntry =
  | {
      kind: 'item';
      label: string;
      icon?: ReactNode;
      hint?: string;
      disabled?: boolean;
      danger?: boolean;
      run: () => void;
    }
  | { kind: 'separator' }
  | { kind: 'heading'; label: string };

export type MenuAnchor = { x: number; y: number };

type ContextMenuProps = {
  anchor: MenuAnchor;
  entries: MenuEntry[];
  onClose: () => void;
};

const EDGE_PADDING = 8;

export function ContextMenu({ anchor, entries, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(anchor);

  // Flip the menu back inside the viewport once its real size is known.
  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      x: Math.min(anchor.x, window.innerWidth - rect.width - EDGE_PADDING),
      y: Math.min(anchor.y, window.innerHeight - rect.height - EDGE_PADDING),
    });
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menu}
      className="ctx-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {entries.map((entry, index) => {
        if (entry.kind === 'separator') return <div key={index} className="ctx-sep" />;
        if (entry.kind === 'heading')
          return (
            <div key={index} className="ctx-heading">
              {entry.label}
            </div>
          );
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            className={`ctx-item${entry.danger ? ' ctx-item--danger' : ''}`}
            disabled={entry.disabled}
            onClick={() => {
              entry.run();
              onClose();
            }}
          >
            <span className="ctx-icon">{entry.icon}</span>
            <span className="ctx-label">{entry.label}</span>
            {entry.hint ? <span className="ctx-hint">{entry.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
