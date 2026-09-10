import { useEffect, useRef, useState } from 'react';
import { FURNITURE_FIELDS, SLOT_NAMES } from '../editor/furniture';
import type { Furniture, SlotName } from '../editor/furniture';

/**
 * Where the page furniture is written.
 *
 * Three slots per row, which is Word's model and the one the tab stops in
 * every other word processor imply: left, centre, right. The fields are chips
 * rather than a syntax to memorise — clicking one drops its token into
 * whichever box you were last typing in.
 */

type HeaderFooterDialogProps = {
  open: boolean;
  furniture: Furniture;
  onChange: (furniture: Furniture) => void;
  onClose: () => void;
};

const SLOT_LABELS: Record<SlotName, string> = {
  left: 'Left',
  center: 'Centre',
  right: 'Right',
};

export function HeaderFooterDialog({ open, furniture, onChange, onClose }: HeaderFooterDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fields = useRef(new Map<string, HTMLInputElement>());
  const [focused, setFocused] = useState<string>('header.center');

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      fields.current.get(focused)?.focus();
    }
    if (!open && element.open) element.close();
    // Only the open flag should reopen this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (row: 'header' | 'footer', slot: SlotName, value: string) =>
    onChange({ ...furniture, [row]: { ...furniture[row], [slot]: value } });

  /** Drop a field where the caret was, not at the end of the box. */
  const insert = (token: string) => {
    const [row, slot] = focused.split('.') as ['header' | 'footer', SlotName];
    const input = fields.current.get(focused);
    const value = furniture[row][slot];
    const at = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? at;
    set(row, slot, value.slice(0, at) + token + value.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const rows: { key: 'header' | 'footer'; label: string }[] = [
    { key: 'header', label: 'Header' },
    { key: 'footer', label: 'Footer' },
  ];

  return (
    <dialog className="app-dialog furniture-dialog" ref={dialog} onClose={onClose}>
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <div className="app-dialog-head">
          <div>
            <h2>Header and footer</h2>
            <p>Repeated in the margin of every page, on screen and on paper.</p>
          </div>
        </div>

        {rows.map((row) => (
          <div className="furniture-row" key={row.key}>
            <span className="panel-label">{row.label}</span>
            <div className="furniture-slots">
              {SLOT_NAMES.map((slot) => (
                <label key={slot} className="furniture-slot">
                  <span>{SLOT_LABELS[slot]}</span>
                  <input
                    ref={(element) => {
                      if (element) fields.current.set(`${row.key}.${slot}`, element);
                      else fields.current.delete(`${row.key}.${slot}`);
                    }}
                    className="tb-input panel-input"
                    value={furniture[row.key][slot]}
                    spellCheck={false}
                    onFocus={() => setFocused(`${row.key}.${slot}`)}
                    onChange={(event) => set(row.key, slot, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="furniture-fields">
          <span className="panel-label">Insert</span>
          <div className="furniture-chips">
            {FURNITURE_FIELDS.map((field) => (
              <button
                key={field.token}
                type="button"
                className="furniture-chip"
                data-tip={field.token}
                onClick={() => insert(field.token)}
              >
                {field.label}
              </button>
            ))}
          </div>
          <p className="panel-note panel-note--tight">
            Fields resolve per page: <code>{'{page}'}</code> and <code>{'{pages}'}</code> number
            the sheets, <code>{'{title}'}</code> and <code>{'{date}'}</code> come from the document.
          </p>
        </div>

        <label className="panel-check">
          <input
            type="checkbox"
            checked={furniture.skipFirstPage}
            onChange={(event) => onChange({ ...furniture, skipFirstPage: event.target.checked })}
          />
          Leave the first page bare
        </label>

        <div className="app-dialog-actions">
          <button type="button" className="tb-btn tb-btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </form>
    </dialog>
  );
}
