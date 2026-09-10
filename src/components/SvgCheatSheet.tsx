/**
 * A reference for writing SVG by hand, folded into the markup editor.
 *
 * The block markup dialog accepts any HTML, but SVG is the part nobody
 * remembers: the coordinate space, the one-letter path grammar, and which
 * attributes are painted rather than styled. Everything here is what someone
 * actually reaches for while drawing a diagram — and the snippets go in at the
 * caret, because a working shape to edit beats an empty box every time.
 */

/** Backticks in a note become code chips, the way they would in markdown. */
function withCode(note: string) {
  return note.split('`').map((part, index) =>
    index % 2 ? <code key={index}>{part}</code> : <span key={index}>{part}</span>,
  );
}

type Entry = { code: string; note: string };
type Group = { title: string; entries: Entry[] };

const GROUPS: Group[] = [
  {
    title: 'Canvas',
    entries: [
      { code: '<svg viewBox="0 0 320 120">', note: 'The coordinate space. Everything inside is drawn in these units, whatever size it ends up.' },
      { code: 'width="320"', note: 'Drawn size. Leave it off and the graphic fills the column, scaling by the viewBox.' },
    ],
  },
  {
    title: 'Shapes',
    entries: [
      { code: '<rect x y width height rx>', note: '`rx` rounds the corners.' },
      { code: '<circle cx cy r>', note: 'Centre and radius.' },
      { code: '<ellipse cx cy rx ry>', note: 'Two radii.' },
      { code: '<line x1 y1 x2 y2>', note: 'Needs a stroke to be visible.' },
      { code: '<polygon points="0,0 10,0 5,9">', note: 'Closed. `<polyline>` is the open version.' },
      { code: '<path d="…">', note: 'Anything else.' },
      { code: '<text x y>Label</text>', note: 'Add `text-anchor="middle"` to centre on x.' },
    ],
  },
  {
    title: 'Path commands (d)',
    entries: [
      { code: 'M x y', note: 'Move to, without drawing.' },
      { code: 'L x y   H x   V y', note: 'Line to, horizontal, vertical.' },
      { code: 'C x1 y1 x2 y2 x y', note: 'Cubic curve with two control points.' },
      { code: 'Q x1 y1 x y', note: 'Quadratic curve, one control point.' },
      { code: 'A rx ry rot large sweep x y', note: 'Arc. `large` and `sweep` are 0 or 1 and pick which of the four arcs you meant.' },
      { code: 'Z', note: 'Close the shape.' },
      { code: 'm l c q a z', note: 'Lowercase is relative to where the pen is.' },
    ],
  },
  {
    title: 'Painting',
    entries: [
      { code: 'fill="#2f5fd0"   fill="none"', note: 'Shapes fill by default — `none` for outlines.' },
      { code: 'stroke stroke-width', note: 'The outline and its thickness.' },
      { code: 'stroke-linecap="round"', note: 'Also `stroke-linejoin` for corners.' },
      { code: 'stroke-dasharray="4 3"', note: 'Dashes: 4 on, 3 off.' },
      { code: 'opacity="0.6"', note: '`fill-opacity` and `stroke-opacity` do one each.' },
      { code: 'currentColor', note: 'Follows the document text colour, so the drawing restyles with the theme.' },
    ],
  },
  {
    title: 'Arranging',
    entries: [
      { code: '<g transform="translate(20,10)">', note: 'Groups children and shares attributes. Also `rotate(15)` and `scale(1.2)`.' },
      { code: '<defs><marker id="…">', note: 'Arrowheads and other reusables. Ids must be unique across the whole document.' },
    ],
  },
];

const SNIPPETS: { label: string; note: string; code: string }[] = [
  {
    label: 'Titled panel',
    note: 'Rounded box with two lines of text',
    code: `<svg viewBox="0 0 320 110" width="320" role="img" aria-label="Panel">
  <rect x="1" y="1" width="318" height="108" rx="14" fill="#f4f6fa" stroke="#d9dde4"/>
  <text x="22" y="46" font-family="Inter, sans-serif" font-size="16" fill="#16181d">Title</text>
  <text x="22" y="72" font-family="Inter, sans-serif" font-size="13" fill="#4a5160">Supporting line</text>
</svg>`,
  },
  {
    label: 'Flow with arrow',
    note: 'Two boxes joined by a marker',
    code: `<svg viewBox="0 0 360 90" width="360" role="img" aria-label="Draft to review">
  <defs>
    <marker id="hwp-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10z" fill="#4a5160"/>
    </marker>
  </defs>
  <rect x="1" y="20" width="130" height="50" rx="10" fill="#eef2f9" stroke="#c2c8d2"/>
  <text x="66" y="50" text-anchor="middle" font-size="13" fill="#16181d">Draft</text>
  <line x1="140" y1="45" x2="220" y2="45" stroke="#4a5160" stroke-width="1.5" marker-end="url(#hwp-arrow)"/>
  <rect x="229" y="20" width="130" height="50" rx="10" fill="#eef2f9" stroke="#c2c8d2"/>
  <text x="294" y="50" text-anchor="middle" font-size="13" fill="#16181d">Review</text>
</svg>`,
  },
  {
    label: 'Bar chart',
    note: 'Baseline, three bars, labels',
    code: `<svg viewBox="0 0 320 140" width="320" role="img" aria-label="Quarterly totals">
  <line x1="24" y1="114" x2="304" y2="114" stroke="#c2c8d2"/>
  <rect x="48" y="44" width="42" height="70" rx="4" fill="#2f5fd0"/>
  <rect x="128" y="70" width="42" height="44" rx="4" fill="#5b86e0"/>
  <rect x="208" y="30" width="42" height="84" rx="4" fill="#2f5fd0"/>
  <text x="69" y="131" text-anchor="middle" font-size="11" fill="#4a5160">Q1</text>
  <text x="149" y="131" text-anchor="middle" font-size="11" fill="#4a5160">Q2</text>
  <text x="229" y="131" text-anchor="middle" font-size="11" fill="#4a5160">Q3</text>
</svg>`,
  },
  {
    label: 'Inline icon',
    note: 'Small, and takes the text colour',
    code: `<svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor"
     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Done">
  <circle cx="12" cy="12" r="9"/>
  <path d="M8 12.4l2.6 2.6L16 9.6"/>
</svg>`,
  },
];

export function SvgCheatSheet({ onInsert }: { onInsert: (snippet: string) => void }) {
  return (
    <aside className="cheat" aria-label="SVG cheat sheet">
      <h3>Paste a starting point</h3>
      <div className="cheat-snippets">
        {SNIPPETS.map((snippet) => (
          <button
            key={snippet.label}
            type="button"
            className="cheat-snippet"
            onClick={() => onInsert(snippet.code)}
          >
            {snippet.label}
            <span>{snippet.note}</span>
          </button>
        ))}
      </div>

      {GROUPS.map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          {group.entries.map((entry) => (
            <div className="cheat-row" key={entry.code}>
              <code>{entry.code}</code>
              <span>{withCode(entry.note)}</span>
            </div>
          ))}
        </div>
      ))}

      <h3>On paper</h3>
      <div className="cheat-row">
        <span>
          {withCode(
            'Colours print as written, and the graphic scales with the column rather than the screen. Keep words in `<text>` rather than converting them to outlines, so they stay searchable on paper.',
          )}
        </span>
      </div>
    </aside>
  );
}
