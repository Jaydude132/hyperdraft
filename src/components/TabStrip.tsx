import { IconClose, IconNewDoc } from './icons';

/**
 * Open documents, one tab each.
 *
 * The strip only appears once there is more than one document to choose
 * between: a row of chrome that always says the same thing is a row of
 * chrome that could have been page. New documents come from the toolbar
 * button (and ⌘N) until then.
 *
 * A document with unsaved changes is set in italic and carries an asterisk —
 * two signals rather than one, because italic alone is easy to miss in a row
 * of names and the asterisk survives a glance.
 */

export type TabView = { id: string; title: string; dirty: boolean };

type TabStripProps = {
  tabs: TabView[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
};

export function TabStrip({ tabs, activeId, onSelect, onClose, onNew }: TabStripProps) {
  return (
    <div className="app-tabs" role="tablist" aria-label="Open documents">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          tabIndex={0}
          aria-selected={tab.id === activeId}
          className={`app-tab${tab.id === activeId ? ' is-active' : ''}${tab.dirty ? ' is-dirty' : ''}`}
          title={tab.title}
          // mousedown, not click: switching should feel immediate, and the
          // close button below stops propagation so it never selects first.
          onMouseDown={() => onSelect(tab.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onSelect(tab.id);
          }}
        >
          <span className="app-tab-name">
            {tab.title.trim() || 'Untitled document'}
            {tab.dirty ? ' *' : ''}
          </span>
          <button
            type="button"
            className="app-tab-close"
            aria-label={`Close ${tab.title}`}
            data-tip="Close"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onClose(tab.id);
            }}
          >
            <IconClose size={11} />
          </button>
        </div>
      ))}

      <button type="button" className="app-tab-new" data-tip="New document — ⌘N" onClick={onNew}>
        <IconNewDoc size={14} />
      </button>
    </div>
  );
}
