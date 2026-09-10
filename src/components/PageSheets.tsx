import type { CSSProperties } from 'react';

/**
 * The paper.
 *
 * Two layers, deliberately: sheets *behind* the text, and a mask *in front* of
 * it. The mask paints each page's four margins in the sheet colour and each
 * gutter in the canvas colour, so anything that reaches past a page's content
 * box — a table mid-split, a code block crossing a boundary — is visually cut
 * off at the page edge instead of bleeding across the gap.
 *
 * That is what makes splitting a bordered block possible at all. The block's
 * own border and background are drawn by one continuous element spanning the
 * break; without something painted over the gutter, they would run straight
 * through it.
 */

type PageSheetsProps = { pageCount: number };

export function PageSheets({ pageCount }: PageSheetsProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index);

  return (
    <>
      <div className="hwp-sheet-layer" aria-hidden="true">
        {pages.map((index) => (
          <div
            key={index}
            className="hwp-sheet"
            data-page={index + 1}
            style={{ '--sheet-index': index } as CSSProperties}
          />
        ))}
      </div>

      <div className="hwp-mask-layer" aria-hidden="true">
        {pages.map((index) => {
          const page = { '--sheet-index': index } as CSSProperties;
          return (
            <div key={index} className="hwp-mask" style={page}>
              <div className="hwp-mask-band hwp-mask-band--top" />
              <div className="hwp-mask-band hwp-mask-band--bottom" />
              <div className="hwp-mask-band hwp-mask-band--left" />
              <div className="hwp-mask-band hwp-mask-band--right" />
              {index < pageCount - 1 ? <div className="hwp-mask-gutter" /> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
