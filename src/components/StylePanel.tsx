import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { tableScope } from '../editor/tableScope';
import { innermostNode } from '../editor/selection';
import { NodeSelection } from '@tiptap/pm/state';
import { restoreTableStyles, snapshotTableStyles } from '../editor/tableSnapshot';
import {
  cornersEqual,
  cornerStyleObject,
  formatCorners,
  parseCorners,
  uniformCorners,
} from '../editor/corners';
import type { CornerRadii } from '../editor/corners';
import { EMPTY_APPEARANCE, TABLE_PRESETS, activePreset } from '../editor/tablePresets';
import { tableDataAttributes, tableStyleObject } from '../editor/extensions/TableStyle';
import type { BorderTarget } from '../editor/extensions/TableSelection';
import { CornerPicker } from './CornerPicker';
import { AttributePicker } from './AttributePicker';
import { CODE_THEMES } from '../editor/highlighting';
import { ALERT_KINDS, defaultAlertLabel } from '../editor/extensions/Callout';
import { SHADOW_LEVELS } from '../editor/shadow';
import type { AlertKind } from '../editor/extensions/Callout';

/**
 * The styles panel — Word's "Borders and Shading", backed by CSS instead of a
 * binary format, and no longer only about tables.
 *
 * It follows the caret: in a table it offers the table's styling, in a code
 * block or a bordered section it offers that block's. What the three have in
 * common is corners, which is the whole reason this is one panel and not
 * three — a document's roundness should be set the same way everywhere.
 *
 * Within a table, what a control acts on follows the selection, the rule
 * people already have from Word: highlight some cells and the styling lands on
 * those cells; put the caret anywhere in a table without picking particular
 * cells — or select the whole table — and it lands on the table. The banner at
 * the top says which is in force, because silently doing the other thing is
 * indistinguishable from doing nothing.
 *
 * Changes apply immediately and deliberately do not call `.focus()`: the panel
 * is non-modal, and stealing focus back to the editor on every keystroke would
 * collapse the cell selection being edited.
 */

const BORDER_COLORS = ['#d9dde4', '#c2c8d2', '#8a919e', '#4a5160', '#16181d', '#2f5fd0', '#c0392b', '#1e8449'];
const FILL_COLORS = ['#f4f6fa', '#eef2f9', '#e5ecfb', '#fdf5e8', '#eaf6ee', '#fdeceb', '#f3eefb', '#ffffff'];

/** Header fills run darker than body fills, including two for reversed text. */
const HEADER_FILLS = ['#e7ebf2', '#dde3ec', '#ccd4e2', '#e5ecfb', '#eaf6ee', '#fdf5e8', '#3a4356', '#16181d'];
const HEADER_INKS = ['#16181d', '#3a4150', '#5b6371', '#ffffff', '#2f5fd0', '#1e8449', '#c0392b', '#8a5a12'];

const BORDER_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'none', label: 'None' },
];

const INNER_BORDERS = [
  { value: 'all', label: 'All' },
  { value: 'horizontal', label: 'Rows' },
  { value: 'vertical', label: 'Cols' },
  { value: 'none', label: 'None' },
];

const HEADER_WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '620', label: 'Medium' },
  { value: '700', label: 'Bold' },
];

const HEADER_ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

const HEADER_CASES = [
  { value: 'normal', label: 'Normal' },
  { value: 'upper', label: 'CAPS' },
  { value: 'small', label: 'Small' },
];

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

/**
 * One group of controls at a time.
 *
 * The panel used to be a single column of every control the block had, which
 * made it tall enough to cover the document it was styling — and the thing
 * being styled is the thing you need to see. Tabs cost one click and give the
 * page back.
 */
const TABS: Record<string, { id: string; label: string }[]> = {
  table: [
    { id: 'style', label: 'Style' },
    { id: 'borders', label: 'Borders' },
    { id: 'header', label: 'Header' },
    { id: 'rows', label: 'Rows' },
    { id: 'shape', label: 'Shape' },
  ],
  callout: [
    { id: 'section', label: 'Section' },
    { id: 'shape', label: 'Shape' },
  ],
  codeBlock: [
    { id: 'code', label: 'Code' },
    { id: 'shape', label: 'Shape' },
  ],
  image: [
    { id: 'image', label: 'Image' },
    { id: 'shape', label: 'Shape' },
  ],
};

const IMAGE_FILLS = ['#f4f6fa', '#eef2f9', '#e5ecfb', '#fdf5e8', '#eaf6ee', '#f3eefb', '#16181d', '#ffffff'];

const ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

/** The theme's own roundness for each block, mirrored from document.css. */
const THEME_RADIUS = { table: 10, callout: 12, codeBlock: 10, image: 0 } as const;

const TARGETS: { target: BorderTarget | 'clear'; label: string; edges: string[] }[] = [
  { target: 'all', label: 'All borders', edges: ['top', 'right', 'bottom', 'left', 'inside'] },
  { target: 'outside', label: 'Outside border', edges: ['top', 'right', 'bottom', 'left'] },
  { target: 'inside', label: 'Inside borders', edges: ['inside'] },
  { target: 'clear', label: 'Clear borders', edges: [] },
  { target: 'top', label: 'Top border', edges: ['top'] },
  { target: 'right', label: 'Right border', edges: ['right'] },
  { target: 'bottom', label: 'Bottom border', edges: ['bottom'] },
  { target: 'left', label: 'Left border', edges: ['left'] },
];

const EDGE_PATHS: Record<string, string> = {
  top: 'M2.5 2.5H13.5',
  right: 'M13.5 2.5V13.5',
  bottom: 'M2.5 13.5H13.5',
  left: 'M2.5 2.5V13.5',
  inside: 'M2.5 8H13.5M8 2.5V13.5',
};

function BorderTargetIcon({ edges, cleared }: { edges: string[]; cleared: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="11" height="11" stroke="currentColor" strokeOpacity="0.28" strokeDasharray="2 2" />
      <path d="M2.5 8H13.5M8 2.5V13.5" stroke="currentColor" strokeOpacity="0.18" strokeDasharray="2 2" />
      {edges.map((edge) => (
        <path key={edge} d={EDGE_PATHS[edge]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ))}
      {cleared ? <path d="M3.4 12.6 12.6 3.4" stroke="#c0392b" strokeWidth="1.6" strokeLinecap="round" /> : null}
    </svg>
  );
}

type ColorFieldProps = {
  label: string;
  value: string | null;
  swatches: string[];
  disabled?: boolean;
  onChange: (value: string | null) => void;
};

function ColorField({ label, value, swatches, disabled, onChange }: ColorFieldProps) {
  return (
    <div className={`panel-field${disabled ? ' panel-field--off' : ''}`}>
      <span className="panel-label">{label}</span>
      <div className="swatches">
        <button
          type="button"
          className={`swatch swatch--none${value ? '' : ' swatch--on'}`}
          data-tip="Theme default"
          aria-label={`${label}: theme default`}
          disabled={disabled}
          onClick={() => onChange(null)}
        />
        {swatches.map((color) => (
          <button
            key={color}
            type="button"
            className={`swatch${value?.toLowerCase() === color ? ' swatch--on' : ''}`}
            style={{ background: color }}
            data-tip={color}
            aria-label={`${label}: ${color}`}
            disabled={disabled}
            onClick={() => onChange(color)}
          />
        ))}
        <label className="swatch swatch--custom" data-tip="Custom colour">
          <input
            type="color"
            value={value || '#888888'}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`${label}: custom colour`}
          />
        </label>
      </div>
    </div>
  );
}

type SegmentedProps<T extends string> = {
  label: string;
  value: T | null;
  fallback: T;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
};

function Segmented<T extends string>({ label, value, fallback, options, disabled, onChange }: SegmentedProps<T>) {
  const active = value ?? fallback;
  return (
    <div className={`panel-field${disabled ? ' panel-field--off' : ''}`}>
      <span className="panel-label">{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`segment${active === option.value ? ' segment--on' : ''}`}
            disabled={disabled}
            onClick={() => onChange(option.value as T)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The gallery of built-in table styles.
 *
 * Each card is a real table rendered through the document stylesheet with the
 * preset's own properties, so a card cannot promise a look the table will not
 * deliver — the preview and the document read one mapping.
 */
function PresetGallery({
  current,
  disabled,
  onPick,
}: {
  current: string | null;
  disabled?: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="preset-gallery">
      {TABLE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`preset-card${current === preset.id ? ' is-on' : ''}`}
          data-tip={preset.label}
          aria-pressed={current === preset.id}
          disabled={disabled}
          onClick={() => onPick(preset.id)}
        >
          <span className="preset-thumb hwp-doc">
            <table style={tableStyleObject(preset.appearance)} {...tableDataAttributes(preset.appearance)}>
              <tbody>
                <tr><th /><th /></tr>
                <tr><td /><td /></tr>
                <tr><td /><td /></tr>
              </tbody>
            </table>
          </span>
          <span className="preset-name">{preset.label}</span>
        </button>
      ))}
    </div>
  );
}

export function StylePanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      /* An image is a leaf: you select it rather than put the caret inside it,
         so it is found in the selection rather than among the ancestors. */
      const selection = instance.state.selection;
      const selectedNode =
        selection instanceof NodeSelection && selection.node.type.name === 'image'
          ? selection.node
          : null;
      const found = selectedNode ?? innermostNode(instance, ['table', 'codeBlock', 'callout']);
      const target = found?.type.name ?? null;
      const table = instance.getAttributes('table');
      const cell = instance.isActive('tableHeader')
        ? instance.getAttributes('tableHeader')
        : instance.getAttributes('tableCell');
      const { scope, cells } = tableScope(instance);
      // A table's first row is its header row when its cells are header cells.
      const node = innermostNode(instance, ['table']);
      return {
        target,
        scope,
        cells,
        hasHeaderRow: node?.firstChild?.firstChild?.type.name === 'tableHeader',
        preset: activePreset(table),
        corners: (found?.attrs.corners as string | null) ?? null,
        shadow: (found?.attrs.shadow as string | null) ?? '',
        imageFill: (found?.attrs.fill as string | null) ?? null,
        imageSrc: (found?.attrs.src as string | null) ?? null,
        imageAlign: (found?.attrs.align as string | null) ?? null,
        tableShadow: (table.shadow as string | null) ?? '',
        variant: (instance.getAttributes('callout').variant as string) ?? 'plain',
        alert: (instance.getAttributes('callout').alert as string) || '',
        alertLabel: (instance.getAttributes('callout').label as string) || '',
        codeTheme: (instance.getAttributes('codeBlock').codeTheme as string) || 'dark',
        radius: (table.radius as number | null) ?? null,
        cornerTl: (table.cornerTl as number | null) ?? null,
        cornerTr: (table.cornerTr as number | null) ?? null,
        cornerBr: (table.cornerBr as number | null) ?? null,
        cornerBl: (table.cornerBl as number | null) ?? null,
        headerFill: (table.headerFill as string | null) ?? null,
        headerInk: (table.headerInk as string | null) ?? null,
        headerWeight: (table.headerWeight as string | null) ?? null,
        headerAlign: (table.headerAlign as string | null) ?? null,
        headerCase: (table.headerCase as string | null) ?? null,
        headerRule: Boolean(table.headerRule),
        bandFill: (table.bandFill as string | null) ?? null,
        innerBorders: (table.innerBorders as string | null) ?? null,
        stripe: Boolean(table.stripe),
        borderWidth: (table.borderWidth as number | null) ?? null,
        borderStyle: (table.borderStyle as string | null) ?? null,
        borderColor: (table.borderColor as string | null) ?? null,
        shading: (cell.background as string | null) ?? null,
      };
    },
  });

  const inTable = state.target === 'table';
  const inCode = state.target === 'codeBlock';
  const inSection = state.target === 'callout';
  const inImage = state.target === 'image';
  const wholeTable = inTable && state.scope === 'table';
  const cellsOnly = inTable && state.scope === 'cells';
  const idle = state.target === null;

  /**
   * Styling as it stood when the panel opened. Cancel puts it back, which is
   * what makes experimenting here feel safe: the controls apply live, so
   * without a way out the only undo would be Cmd+Z, repeatedly.
   */
  const opened = useRef(snapshotTableStyles(editor));

  const tabs = TABS[state.target ?? ''] ?? [];
  const [tab, setTab] = useState(tabs[0]?.id ?? 'style');
  useEffect(() => {
    // Pointing the panel at a different kind of block starts it at that
    // block's first group rather than on a tab that no longer exists.
    setTab((current) => (tabs.some((entry) => entry.id === current) ? current : tabs[0]?.id ?? ''));
  }, [state.target, tabs]);

  /** The line these controls draw with. A tool setting, kept in the panel. */
  const [pen, setPen] = useState({ width: 1, style: 'solid', color: '#8a919e' });
  const line = (next = pen) => `${next.width}px ${next.style} ${next.color}`;

  const applyPen = (patch: Partial<typeof pen>) => {
    const next = { ...pen, ...patch };
    setPen(next);
    if (cellsOnly) editor.chain().setSelectionBorder('all', line(next)).run();
    else {
      editor
        .chain()
        .setTableAppearance({ borderWidth: next.width, borderStyle: next.style, borderColor: next.color })
        .run();
    }
  };

  const apply = (appearance: Record<string, unknown>) =>
    editor.chain().setTableAppearance(appearance).run();

  const stamp = (target: BorderTarget | 'clear') =>
    target === 'clear'
      ? editor.chain().setSelectionBorder('all', null, wholeTable).run()
      : editor.chain().setSelectionBorder(target, line(), wholeTable).run();

  /** A preset replaces the styling rather than layering onto it, so per-cell
   *  overrides go first — otherwise a shaded cell would survive every choice
   *  in the gallery and the card would be telling the truth about a table
   *  nobody has. */
  const pickPreset = (id: string) => {
    const preset = TABLE_PRESETS.find((entry) => entry.id === id);
    if (!preset) return;
    editor
      .chain()
      .setSelectionBorder('all', null, true)
      .setSelectionShading(null, true)
      .setTableAppearance(preset.appearance)
      .run();
  };

  /* --- Corners ------------------------------------------------------------
     Tables keep a single `radius` while all four corners agree, because that
     is what a table saved before any of this existed carries, and because one
     number is a tidier thing to store than four identical ones. */
  const tableCorners: CornerRadii = {
    tl: state.cornerTl ?? state.radius ?? THEME_RADIUS.table,
    tr: state.cornerTr ?? state.radius ?? THEME_RADIUS.table,
    br: state.cornerBr ?? state.radius ?? THEME_RADIUS.table,
    bl: state.cornerBl ?? state.radius ?? THEME_RADIUS.table,
  };

  /* Keyed by target rather than guessed: an image is square by default, and
     treating its corners as a section's made "All" a no-op — the value it
     wrote matched what it thought the default was. */
  const blockRadius = THEME_RADIUS[state.target as keyof typeof THEME_RADIUS] ?? THEME_RADIUS.callout;
  const blockCorners = parseCorners(state.corners) ?? uniformCorners(blockRadius);

  const setShadow = (level: string) => {
    const value = level || null;
    if (inTable) apply({ shadow: value });
    else if (state.target) editor.commands.updateAttributes(state.target, { shadow: value });
  };

  const setCorners = (next: CornerRadii) => {
    if (inTable) {
      const uniform = next.tl === next.tr && next.tr === next.br && next.br === next.bl;
      apply(
        uniform
          ? { radius: next.tl, cornerTl: null, cornerTr: null, cornerBr: null, cornerBl: null }
          : { radius: null, cornerTl: next.tl, cornerTr: next.tr, cornerBr: next.br, cornerBl: next.bl },
      );
      return;
    }
    if (!state.target) return;
    editor.commands.updateAttributes(state.target, {
      corners: cornersEqual(next, uniformCorners(blockRadius)) ? null : formatCorners(next),
    });
  };

  const previewStyle = {
    ...tableStyleObject({
      borderWidth: state.borderWidth ?? 1,
      borderStyle: state.borderStyle ?? 'solid',
      borderColor: state.borderColor ?? '#d9dde4',
      headerFill: state.headerFill ?? '#e7ebf2',
      headerInk: state.headerInk,
      headerWeight: state.headerWeight,
      headerAlign: state.headerAlign,
      bandFill: state.bandFill,
      cornerTl: tableCorners.tl,
      cornerTr: tableCorners.tr,
      cornerBr: tableCorners.br,
      cornerBl: tableCorners.bl,
    }),
  } as CSSProperties;

  const title = inCode
    ? 'Code block styles'
    : inSection
      ? 'Section styles'
      : inImage
        ? 'Image styles'
        : 'Table styles';

  const scopeText = idle
    ? 'Nothing selected'
    : inCode
      ? 'This code block'
      : inSection
        ? 'This section'
        : cellsOnly
          ? `${state.cells} selected ${state.cells === 1 ? 'cell' : 'cells'}`
          : 'The whole table';

  const HeaderCell = state.hasHeaderRow ? 'th' : 'td';

  return (
    <aside className="panel" aria-label="Styles">
      <header className="panel-head">
        <h2>{title}</h2>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
          </svg>
        </button>
      </header>

      <div className={`panel-scope${idle ? ' panel-scope--idle' : ''}`}>
        Applying to <strong>{scopeText}</strong>
        {idle ? (
          <span className="panel-scope-hint">
            Put the cursor in a table, a section or a code block. In a table, the grips beside it
            select a row or column.
          </span>
        ) : null}
      </div>

      <div className="panel-preview hwp-doc">
        {inImage ? (
          <img
            src={state.imageSrc ?? ''}
            alt=""
            data-shadow={state.shadow || undefined}
            data-fill={state.imageFill ? 'true' : undefined}
            data-align={state.imageAlign ?? undefined}
            style={{
              ...cornerStyleObject(state.corners, 'img'),
              ...(state.imageFill ? { '--img-fill': state.imageFill } : {}),
              maxHeight: 92,
            } as CSSProperties}
          />
        ) : inCode ? (
          <pre
            data-code-theme={state.codeTheme}
            data-shadow={state.shadow || undefined}
            style={cornerStyleObject(state.corners, 'code')}
          >
            <code>{'const shape = "corners";'}</code>
          </pre>
        ) : inSection ? (
          <section
            className="hwp-callout"
            data-variant={state.variant}
            data-alert={state.alert || undefined}
            data-label={state.alert ? state.alertLabel || defaultAlertLabel(state.alert) : undefined}
            data-shadow={state.shadow || undefined}
            style={cornerStyleObject(state.corners, 'sec')}
          >
            <p>A bordered section, rounded exactly as far as you like.</p>
          </section>
        ) : (
          <table
            data-inner={state.innerBorders ?? 'all'}
            data-stripe={state.stripe ? 'true' : undefined}
            data-header-case={state.headerCase ?? undefined}
            data-header-rule={state.headerRule ? 'true' : undefined}
            data-shadow={state.tableShadow || undefined}
            style={previewStyle}
          >
            <tbody>
              <tr><HeaderCell>Region</HeaderCell><HeaderCell>Q3</HeaderCell></tr>
              <tr><td>Northwest</td><td>1,284</td></tr>
              <tr><td>Gulf Coast</td><td>962</td></tr>
            </tbody>
          </table>
        )}
      </div>

      {tabs.length > 1 ? (
        <div className="panel-tabs" role="tablist" aria-label="Style groups">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`panel-tab${tab === entry.id ? ' is-active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`panel-body${idle ? ' panel-body--idle' : ''}`}>
        {cellsOnly && tab !== 'borders' ? (
          <p className="panel-note panel-note--wide">
            These style the table as a whole — clear the cell selection to use them.
          </p>
        ) : null}

        {inTable && tab === 'style' ? (
          <>
            <PresetGallery current={state.preset} disabled={cellsOnly} onPick={pickPreset} />
            <p className="panel-note panel-note--tight">
              A style replaces the whole look, including anything set on single cells.
            </p>
          </>
        ) : null}

        {inTable && tab === 'borders' ? (
          <>
            <Segmented
              label="Line"
              value={pen.style}
              fallback="solid"
              options={BORDER_STYLES}
              onChange={(value) => applyPen({ style: value })}
            />

            <div className="panel-field">
              <span className="panel-label">Thickness</span>
              <div className="panel-slider">
                <input
                  type="range"
                  min={0.5}
                  max={6}
                  step={0.5}
                  value={pen.width}
                  onChange={(event) => applyPen({ width: Number(event.target.value) })}
                />
                <output>{pen.width}px</output>
              </div>
            </div>

            <ColorField
              label="Line colour"
              value={pen.color}
              swatches={BORDER_COLORS}
              onChange={(value) => applyPen({ color: value ?? '#8a919e' })}
            />

            <div className="panel-field">
              <span className="panel-label">Draw on</span>
              <div className="border-targets">
                {TARGETS.map(({ target, label, edges }) => (
                  <button
                    key={target}
                    type="button"
                    className="border-target"
                    data-tip={label}
                    aria-label={label}
                    onClick={() => stamp(target)}
                  >
                    <BorderTargetIcon edges={edges} cleared={target === 'clear'} />
                  </button>
                ))}
              </div>
            </div>

            <ColorField
              label="Shading"
              value={state.shading}
              swatches={FILL_COLORS}
              onChange={(value) => editor.chain().setSelectionShading(value, wholeTable).run()}
            />
          </>
        ) : null}

        {inTable && tab === 'header' ? (
          <>
            <label className={`panel-check${cellsOnly ? ' panel-field--off' : ''}`}>
              <input
                type="checkbox"
                checked={state.hasHeaderRow}
                disabled={cellsOnly}
                onChange={() => editor.chain().toggleHeaderRow().run()}
              />
              First row is a header
            </label>

            <ColorField
              label="Fill"
              value={state.headerFill}
              swatches={HEADER_FILLS}
              disabled={cellsOnly}
              onChange={(value) => apply({ headerFill: value })}
            />

            <ColorField
              label="Text"
              value={state.headerInk}
              swatches={HEADER_INKS}
              disabled={cellsOnly}
              onChange={(value) => apply({ headerInk: value })}
            />

            <Segmented
              label="Weight"
              value={state.headerWeight}
              fallback="620"
              options={HEADER_WEIGHTS}
              disabled={cellsOnly}
              onChange={(value) => apply({ headerWeight: value === '620' ? null : value })}
            />

            <Segmented
              label="Alignment"
              value={state.headerAlign}
              fallback="left"
              options={HEADER_ALIGNMENTS}
              disabled={cellsOnly}
              onChange={(value) => apply({ headerAlign: value === 'left' ? null : value })}
            />

            <Segmented
              label="Letter case"
              value={state.headerCase}
              fallback="normal"
              options={HEADER_CASES}
              disabled={cellsOnly}
              onChange={(value) => apply({ headerCase: value === 'normal' ? null : value })}
            />

            <label className={`panel-check${cellsOnly ? ' panel-field--off' : ''}`}>
              <input
                type="checkbox"
                checked={state.headerRule}
                disabled={cellsOnly}
                onChange={(event) => apply({ headerRule: event.target.checked || null })}
              />
              Heavier rule under header
            </label>
          </>
        ) : null}

        {inTable && tab === 'rows' ? (
          <>
            <label className={`panel-check${cellsOnly ? ' panel-field--off' : ''}`}>
              <input
                type="checkbox"
                checked={state.stripe}
                disabled={cellsOnly}
                onChange={(event) => apply({ stripe: event.target.checked })}
              />
              Banded rows
            </label>

            {state.stripe ? (
              <ColorField
                label="Band colour"
                value={state.bandFill}
                swatches={FILL_COLORS}
                disabled={cellsOnly}
                onChange={(value) => apply({ bandFill: value })}
              />
            ) : null}

            <Segmented
              label="Inner lines"
              value={state.innerBorders}
              fallback="all"
              options={INNER_BORDERS}
              disabled={cellsOnly}
              onChange={(value) => apply({ innerBorders: value })}
            />
          </>
        ) : null}

        {inSection && tab === 'section' ? (
          <>
            <div className="panel-field">
              <span className="panel-label">Alert</span>
              <AttributePicker
                options={ALERT_OPTIONS}
                value={state.alert}
                label="Alert"
                placeholder="Plain section"
                width={150}
                menuWidth={170}
                onSelect={(value) => editor.commands.setAlert((value || null) as AlertKind | null)}
              />
            </div>

            {state.alert ? (
              <div className="panel-field">
                <span className="panel-label">Label</span>
                <input
                  className="tb-input panel-input"
                  value={state.alertLabel}
                  spellCheck={false}
                  placeholder={defaultAlertLabel(state.alert)}
                  aria-label="Alert label"
                  onChange={(event) =>
                    editor.commands.updateAttributes('callout', {
                      label: event.target.value || null,
                    })
                  }
                />
              </div>
            ) : null}

            <Segmented
              label="Style"
              value={state.variant}
              fallback="plain"
              options={SECTION_VARIANTS}
              disabled={Boolean(state.alert)}
              onChange={(value) => editor.commands.updateAttributes('callout', { variant: value })}
            />
            {state.alert ? (
              <p className="panel-note panel-note--tight">An alert brings its own colours.</p>
            ) : null}
          </>
        ) : null}

        {inCode && tab === 'code' ? (
          <div className="panel-field">
            <span className="panel-label">Theme</span>
            <AttributePicker
              options={CODE_THEMES}
              value={state.codeTheme}
              label="Code block theme"
              width={150}
              menuWidth={170}
              onSelect={(value) => editor.commands.updateAttributes('codeBlock', { codeTheme: value })}
            />
          </div>
        ) : null}

        {inImage && tab === 'image' ? (
          <>
            <Segmented
              label="Alignment"
              value={state.imageAlign}
              fallback="left"
              options={ALIGNMENTS}
              onChange={(value) =>
                editor.commands.updateAttributes('image', { align: value === 'left' ? null : value })
              }
            />

            <ColorField
              label="Matte"
              value={state.imageFill}
              swatches={IMAGE_FILLS}
              onChange={(value) => editor.commands.updateAttributes('image', { fill: value })}
            />
            <p className="panel-note panel-note--tight">
              A matte pads the image in a colour, the way a mounted photograph is framed.
            </p>
          </>
        ) : null}

        {tab === 'shape' ? (
          <>
            <div className="panel-field">
              <span className={`panel-label${cellsOnly ? ' panel-label--off' : ''}`}>Corners</span>
              <CornerPicker
                value={inTable ? tableCorners : blockCorners}
                max={inSection ? 40 : 32}
                disabled={cellsOnly}
                onChange={setCorners}
              />
            </div>

            <Segmented
              label="Elevation"
              value={inTable ? state.tableShadow : state.shadow}
              fallback=""
              options={SHADOW_LEVELS.map((level) => ({ value: level.value, label: level.label }))}
              disabled={cellsOnly}
              onChange={setShadow}
            />
            <p className="panel-note panel-note--tight">
              A shadow lifts the block off the page, on screen and on paper.
            </p>
          </>
        ) : null}

        <button
          type="button"
          className="tb-btn panel-reset"
          onClick={() =>
            editor
              .chain()
              .setSelectionBorder('all', null, true)
              .setSelectionShading(null, true)
              .setTableAppearance(EMPTY_APPEARANCE)
              .run()
          }
          hidden={!inTable}
        >
          Reset table to theme
        </button>
      </div>

      <footer className="panel-foot">
        <button
          type="button"
          className="tb-btn"
          onClick={() => {
            restoreTableStyles(editor, opened.current);
            onClose();
          }}
        >
          Cancel
        </button>
        <button type="button" className="tb-btn tb-btn--primary" onClick={onClose}>
          OK
        </button>
      </footer>
    </aside>
  );
}
