import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import type { AlertKind } from '../editor/extensions/Callout';
import { useEditorState } from '@tiptap/react';
import { CODE_LANGUAGES, CODE_THEMES } from '../editor/highlighting';
import { innermostNode } from '../editor/selection';
import { ALERT_KINDS, defaultAlertLabel } from '../editor/extensions/Callout';
import { AttributePicker } from './AttributePicker';
import {
  IconBorders,
  IconColumnDelete,
  IconColumnLeft,
  IconColumnRight,
  IconHeaderRow,
  IconMergeCells,
  IconRowAbove,
  IconRowBelow,
  IconRowDelete,
  IconSelectColumn,
  IconSelectRow,
  IconSelectTable,
  IconSplitCell,
  IconTableDelete,
} from './icons';

/**
 * Contextual ribbons.
 *
 * These always occupy their own row beneath the main toolbar rather than
 * wrapping into it. A control that moves position depending on the window
 * width is a control you have to hunt for, and the main ribbon's layout should
 * not shift just because the caret entered a table.
 */

type RibbonButtonProps = {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label?: string;
  children: ReactNode;
};

function RibbonButton({ title, onClick, disabled, active, label, children }: RibbonButtonProps) {
  return (
    <button
      type="button"
      className="tb-btn"
      data-tip={title}
      aria-label={title}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
      {label ? <span className="tb-label">{label}</span> : null}
    </button>
  );
}

const ALERT_OPTIONS = [
  { value: '', label: 'Plain section' },
  ...ALERT_KINDS.map((kind) => ({ value: kind.value, label: kind.label })),
];

const SECTION_VARIANTS = [
  { value: 'plain', label: 'Outline' },
  { value: 'note', label: 'Tinted' },
  { value: 'warning', label: 'Caution' },
  { value: 'quiet', label: 'Quiet' },
];

export function ContextRibbon({ editor, onOpenStyles }: { editor: Editor; onOpenStyles: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      // Blocks nest, so the ribbon describes the innermost one: a code block
      // inside a bordered section is a code block, not a section.
      context: innermostNode(instance, ['table', 'codeBlock', 'callout'])?.type.name ?? null,
      variant: (instance.getAttributes('callout').variant as string) || 'plain',
      alert: (instance.getAttributes('callout').alert as string) || '',
      alertLabel: (instance.getAttributes('callout').label as string) || '',
      language: (instance.getAttributes('codeBlock').language as string) || 'plaintext',
      filename: (instance.getAttributes('codeBlock').filename as string) || '',
      codeTheme: (instance.getAttributes('codeBlock').codeTheme as string) || 'dark',
      canMerge: instance.can().mergeCells(),
      canSplit: instance.can().splitCell(),
    }),
  });

  if (!state.context) return null;

  const at = () => editor.state.selection.from;
  const label =
    state.context === 'table' ? 'Table' : state.context === 'codeBlock' ? 'Code block' : 'Section';

  return (
    <div className="app-subribbon" role="toolbar" aria-label={label}>
      {state.context === 'table' ? (
        <>
          <span className="tb-group-label">Table</span>

          <RibbonButton title="Select row" onClick={() => editor.chain().focus().selectRowAt(at()).run()}>
            <IconSelectRow />
          </RibbonButton>
          <RibbonButton title="Select column" onClick={() => editor.chain().focus().selectColumnAt(at()).run()}>
            <IconSelectColumn />
          </RibbonButton>
          <RibbonButton title="Select table" onClick={() => editor.chain().focus().selectTableAt(at()).run()}>
            <IconSelectTable />
          </RibbonButton>

          <div className="tb-sep" />

          <RibbonButton title="Insert row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
            <IconRowAbove />
          </RibbonButton>
          <RibbonButton title="Insert row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <IconRowBelow />
          </RibbonButton>
          <RibbonButton title="Insert column left" onClick={() => editor.chain().focus().addColumnBefore().run()}>
            <IconColumnLeft />
          </RibbonButton>
          <RibbonButton title="Insert column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <IconColumnRight />
          </RibbonButton>

          <div className="tb-sep" />

          <RibbonButton title="Merge cells" disabled={!state.canMerge} onClick={() => editor.chain().focus().mergeCells().run()}>
            <IconMergeCells />
          </RibbonButton>
          <RibbonButton title="Split cell" disabled={!state.canSplit} onClick={() => editor.chain().focus().splitCell().run()}>
            <IconSplitCell />
          </RibbonButton>
          <RibbonButton title="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
            <IconHeaderRow />
          </RibbonButton>

          <div className="tb-sep" />

          <RibbonButton title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
            <IconRowDelete />
          </RibbonButton>
          <RibbonButton title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <IconColumnDelete />
          </RibbonButton>
          <RibbonButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <IconTableDelete />
          </RibbonButton>

          <div className="tb-sep" />

          <RibbonButton title="Table styles" label="Table styles" onClick={onOpenStyles}>
            <IconBorders />
          </RibbonButton>
        </>
      ) : state.context === 'callout' ? (
        <>
          <span className="tb-group-label">Section</span>

          <AttributePicker
            options={ALERT_OPTIONS}
            value={state.alert}
            label="Alert"
            placeholder="Plain section"
            width={132}
            menuWidth={160}
            onSelect={(value) =>
              editor.chain().focus().setAlert((value || null) as AlertKind | null).run()
            }
          />

          {state.alert ? (
            <>
              <span className="tb-field-label">Label</span>
              <input
                className="tb-input"
                value={state.alertLabel}
                spellCheck={false}
                placeholder={defaultAlertLabel(state.alert)}
                aria-label="Alert label"
                data-tip="Alert label — blank for the default"
                // No .focus(): typing here must not hand focus back to the editor.
                onChange={(event) =>
                  editor.commands.updateAttributes('callout', { label: event.target.value || null })
                }
              />
            </>
          ) : (
            <AttributePicker
              options={SECTION_VARIANTS}
              value={state.variant}
              label="Section style"
              width={132}
              menuWidth={150}
              onSelect={(value) =>
                editor.chain().focus().updateAttributes('callout', { variant: value }).run()
              }
            />
          )}

          <div className="tb-sep" />

          <RibbonButton title="Section styles" label="Section styles" onClick={onOpenStyles}>
            <IconBorders />
          </RibbonButton>
        </>
      ) : (
        <>
          <span className="tb-group-label">Code</span>

          <AttributePicker
            options={CODE_LANGUAGES}
            value={state.language}
            label="Code language"
            width={152}
            menuWidth={200}
            onSelect={(value) =>
              editor.chain().focus().updateAttributes('codeBlock', { language: value }).run()
            }
          />

          <AttributePicker
            options={CODE_THEMES}
            value={state.codeTheme}
            label="Code block theme"
            width={100}
            menuWidth={120}
            onSelect={(value) =>
              editor.chain().focus().updateAttributes('codeBlock', { codeTheme: value }).run()
            }
          />

          <div className="tb-sep" />

          <span className="tb-field-label">File</span>
          <input
            className="tb-input"
            value={state.filename}
            spellCheck={false}
            placeholder="filename"
            aria-label="Code block filename"
            data-tip="Code block filename"
            // No .focus(): typing here must not hand focus back to the editor.
            onChange={(event) =>
              editor.commands.updateAttributes('codeBlock', { filename: event.target.value })
            }
          />

          <div className="tb-sep" />

          <RibbonButton title="Code block styles" label="Code styles" onClick={onOpenStyles}>
            <IconBorders />
          </RibbonButton>
        </>
      )}
    </div>
  );
}
