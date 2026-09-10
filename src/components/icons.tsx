/**
 * Hand-drawn toolbar icons. 16x16 grid, 1.5px stroke, round joins — one
 * optical weight across the set so the toolbar reads as a single row.
 */
type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconBulletList = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="3" cy="4" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="3" cy="8" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="3" cy="12" r="1.15" fill="currentColor" stroke="none" />
    <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
  </svg>
);

export const IconOrderedList = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.2 2.6h.9v3M2.1 8.1c.15-.5.6-.75 1-.7.85.1.95 1 .35 1.45L2.1 10.1h1.95M2.1 12.3c.7-.55 1.9-.2 1.75.6-.1.5-.7.6-.95.55.35-.05.95.1 1 .65.1.85-1.15 1.15-1.85.55" strokeWidth="1.2" />
    <path d="M6.5 4h7M6.5 8.5h7M6.5 13h7" />
  </svg>
);

export const IconTable = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2" y="3" width="12" height="10" rx="2" />
    <path d="M2 6.4h12M6.6 6.4V13" />
  </svg>
);

export const IconCallout = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2" y="3.5" width="12" height="9" rx="2.6" />
    <path d="M4.7 7h4.6M4.7 9.4h6.6" strokeWidth="1.3" />
  </svg>
);

export const IconPageBreak = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 5.2V3.6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1.6M4 10.8v1.6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.6" />
    <path d="M1.6 8h1.7M5.5 8h1.6M9.3 8h1.6M13.1 8h1.4" strokeWidth="1.3" />
  </svg>
);

/* A bezier with its anchor points: vector artwork, not a photograph. The
   picture frame belongs to IconImage, and two of them in one row is one too
   many. */
export const IconSvgBlock = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3.2 11.6C5.6 4.9 10.4 4.9 12.8 11.6" />
    <rect x="1.7" y="10.4" width="2.9" height="2.9" rx="0.7" />
    <rect x="11.4" y="10.4" width="2.9" height="2.9" rx="0.7" />
    <circle cx="8" cy="5.6" r="1.05" fill="currentColor" stroke="none" />
  </svg>
);

export const IconQuote = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 4v8" strokeWidth="2" />
    <path d="M6.5 5.5h7M6.5 8h7M6.5 10.5h4.5" strokeWidth="1.3" />
  </svg>
);

export const IconCode = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5.6 4.6 2.4 8l3.2 3.4M10.4 4.6 13.6 8l-3.2 3.4" />
  </svg>
);

export const IconRule = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 8h12" />
    <path d="M4 4.4h8M4 11.6h8" strokeWidth="1.1" opacity="0.42" />
  </svg>
);

export const IconHighlight = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9.6 3.4 12.8 6.6l-5 5-3.2-3.2z" />
    <path d="M4.6 8.4 3 10v1.8h1.9l.9-.9" />
    <path d="M2.6 14h10.8" strokeWidth="1.8" />
  </svg>
);

export const IconLink = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-1 1" />
    <path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l1-1" />
  </svg>
);

export const IconUndo = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 6.2h5.6a3.7 3.7 0 0 1 0 7.4H5.4" />
    <path d="M5.4 3.4 2.6 6.2l2.8 2.8" />
  </svg>
);

export const IconRedo = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M13 6.2H7.4a3.7 3.7 0 0 0 0 7.4h3.2" />
    <path d="M10.6 3.4l2.8 2.8-2.8 2.8" />
  </svg>
);

export const IconPrint = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4.6 6V2.9h6.8V6" />
    <path d="M4.6 11.6H3.2A1.2 1.2 0 0 1 2 10.4V7.2A1.2 1.2 0 0 1 3.2 6h9.6A1.2 1.2 0 0 1 14 7.2v3.2a1.2 1.2 0 0 1-1.2 1.2h-1.4" />
    <rect x="4.6" y="9.6" width="6.8" height="4.4" rx="0.9" />
  </svg>
);

export const IconSave = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.6 4a1.4 1.4 0 0 1 1.4-1.4h6.3L13.4 5.3V12a1.4 1.4 0 0 1-1.4 1.4H4A1.4 1.4 0 0 1 2.6 12z" />
    <path d="M5.4 2.6v3.2h5V2.6M5.4 13.4v-3.6h5.2v3.6" strokeWidth="1.3" />
  </svg>
);

export const IconOpen = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.2 12V4.2a1.2 1.2 0 0 1 1.2-1.2h2.7l1.4 1.7h3.9a1.2 1.2 0 0 1 1.2 1.2v.7" />
    <path d="m2.2 12 1.7-4.6a1.1 1.1 0 0 1 1-.7h9a.8.8 0 0 1 .76 1.06L13.2 12a1.2 1.2 0 0 1-1.13.8H3.4A1.2 1.2 0 0 1 2.2 12z" />
  </svg>
);

export const IconMark = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
    <rect x="2.5" y="1.8" width="11.5" height="15" rx="2.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 6.4h5M6 9.2h4M6 12h2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
    <rect x="6" y="4.6" width="11.5" height="15" rx="2.4" stroke="currentColor" strokeWidth="1.5" fill="var(--chrome)" />
    <path d="M9.5 9.2h5M9.5 12h4M9.5 14.8h2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

/* --- Table structure icons ------------------------------------------------
   All built on the same 3x2 grid glyph so the row and column operations read
   as one family: the affected band is filled, and a +/- marker says what
   happens to it. */

const gridFrame = (
  <>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.8" />
    <path d="M1.8 6.6h12.4M6.4 6.6V13" strokeWidth="1.2" />
  </>
);

const Plus = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x - 2.1} ${y}h4.2M${x} ${y - 2.1}v4.2`} strokeWidth="1.5" />
);

/* Delete is a cross, not a minus: a minus reads as "one fewer" while a cross
   reads as "this one, gone" — and the delete-table icon already used one. */
const Cross = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x - 1.9} ${y - 1.9}l3.8 3.8M${x + 1.9} ${y - 1.9}l-3.8 3.8`} strokeWidth="1.5" />
);

export const IconRowAbove = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="7" width="12.4" height="6" rx="1.8" />
    <path d="M6.4 7v6" strokeWidth="1.2" />
    <Plus x={8} y={3.4} />
  </svg>
);

export const IconRowBelow = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="3" width="12.4" height="6" rx="1.8" />
    <path d="M6.4 3v6" strokeWidth="1.2" />
    <Plus x={8} y={12.6} />
  </svg>
);

export const IconColumnLeft = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="7" y="1.8" width="7.2" height="12.4" rx="1.8" />
    <path d="M7 8h7.2" strokeWidth="1.2" />
    <Plus x={3.4} y={8} />
  </svg>
);

export const IconColumnRight = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="1.8" width="7.2" height="12.4" rx="1.8" />
    <path d="M1.8 8H9" strokeWidth="1.2" />
    <Plus x={12.6} y={8} />
  </svg>
);

export const IconRowDelete = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="7" width="12.4" height="6" rx="1.8" />
    <path d="M6.4 7v6" strokeWidth="1.2" />
    <Cross x={8} y={3.6} />
  </svg>
);

export const IconColumnDelete = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="7" y="1.8" width="7.2" height="12.4" rx="1.8" />
    <path d="M7 8h7.2" strokeWidth="1.2" />
    <Cross x={3.6} y={8} />
  </svg>
);

export const IconTableDelete = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    {gridFrame}
    <path d="M9.4 9.4l3.6 3.6M13 9.4l-3.6 3.6" strokeWidth="1.5" />
  </svg>
);

export const IconMergeCells = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.8" />
    <path d="M8 3v2.4M8 10.6V13" strokeWidth="1.2" />
    <path d="M5.4 8h5.2M8.8 6.2 10.6 8 8.8 9.8M7.2 6.2 5.4 8l1.8 1.8" strokeWidth="1.3" />
  </svg>
);

export const IconSplitCell = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.8" />
    <path d="M8 3v10" strokeWidth="1.3" />
    <path d="M4.2 8h1.9M9.9 8h1.9" strokeWidth="1.2" />
  </svg>
);

export const IconHeaderRow = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    {gridFrame}
    <path d="M2.6 4.8h10.8" strokeWidth="2.4" opacity="0.5" />
  </svg>
);

export const IconBorders = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2" y="2.6" width="12" height="10.8" rx="2.4" strokeWidth="1.9" />
    <path d="M5.2 8h5.6" strokeWidth="1.1" opacity="0.55" />
    <path d="M8 5.4v5.2" strokeWidth="1.1" opacity="0.55" />
  </svg>
);

export const IconCodeBlock = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2.2" />
    <path d="M6.2 6.6 4.4 8.4l1.8 1.8M9.8 6.6l1.8 1.8-1.8 1.8" strokeWidth="1.3" />
  </svg>
);

export const IconCut = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="4.4" cy="11.6" r="1.9" />
    <circle cx="11.6" cy="11.6" r="1.9" />
    <path d="M5.6 10.2 11 2.6M10.4 10.2 5 2.6" />
  </svg>
);

export const IconCopy = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="5.4" y="5.4" width="8.2" height="8.2" rx="1.9" />
    <path d="M10.6 5.4V4.2a1.8 1.8 0 0 0-1.8-1.8H4.2a1.8 1.8 0 0 0-1.8 1.8v4.6a1.8 1.8 0 0 0 1.8 1.8h1.2" />
  </svg>
);

export const IconPaste = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6 3.2H4.4a1.6 1.6 0 0 0-1.6 1.6v7.8a1.6 1.6 0 0 0 1.6 1.6h7.2a1.6 1.6 0 0 0 1.6-1.6V4.8a1.6 1.6 0 0 0-1.6-1.6H10" />
    <rect x="5.9" y="1.6" width="4.2" height="3.1" rx="1.1" />
  </svg>
);

/* Selection glyphs: the same grid with the selected band filled in. */

export const IconSelectRow = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.8" />
    <path d="M1.8 6.6h12.4M6.4 6.6V13" strokeWidth="1.1" opacity="0.5" />
    <rect x="2.4" y="3.6" width="11.2" height="2.4" rx="0.8" fill="currentColor" stroke="none" opacity="0.55" />
  </svg>
);

export const IconSelectColumn = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.8" />
    <path d="M1.8 6.6h12.4M6.4 3V13" strokeWidth="1.1" opacity="0.5" />
    <rect x="2.4" y="3.6" width="3.4" height="8.8" rx="0.8" fill="currentColor" stroke="none" opacity="0.55" />
  </svg>
);

export const IconSelectTable = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.8" />
    <rect x="2.4" y="3.6" width="11.2" height="8.8" rx="1.2" fill="currentColor" stroke="none" opacity="0.4" />
  </svg>
);

/* The arrow points up, out of the tray. Down into a tray is a download — a
   thing arriving from somewhere else — and this sends a document out. */
export const IconExport = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 10.3V2.2" />
    <path d="M5.2 5 8 2.2l2.8 2.8" />
    <path d="M2.6 10.6v1.9a1.6 1.6 0 0 0 1.6 1.6h7.6a1.6 1.6 0 0 0 1.6-1.6v-1.9" />
  </svg>
);

export const IconTaskList = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.8" y="2.6" width="3.6" height="3.6" rx="1" />
    <path d="M2.3 11.3l1.1 1.1 2-2.3" />
    <path d="M7.8 4.4h6.2M7.8 11.6h6.2" />
  </svg>
);

export const IconImage = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.9" y="3.2" width="12.2" height="9.6" rx="1.7" />
    <circle cx="5.7" cy="6.6" r="1.1" />
    <path d="M2.4 11.4l3.1-3 2.2 2.1 2.3-2.5 3.7 3.8" />
  </svg>
);

export const IconInfo = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 7.4v3.4" />
    <circle cx="8" cy="4.9" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export const IconNewDoc = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8.8 1.9H4.4a1.6 1.6 0 0 0-1.6 1.6v9a1.6 1.6 0 0 0 1.6 1.6h5.4a1.6 1.6 0 0 0 1.6-1.6V4.6Z" />
    <path d="M8.8 1.9v2.7h2.6" />
    <path d="M7.1 7.6v3.6M5.3 9.4h3.6" />
  </svg>
);

export const IconClose = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" />
  </svg>
);
