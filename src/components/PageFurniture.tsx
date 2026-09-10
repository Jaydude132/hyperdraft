import type { CSSProperties } from 'react';
import { FURNITURE_FIELDS, SLOT_NAMES, hasFurniture, resolveFields, slotsUsed, today } from '../editor/furniture';
import type { Furniture, FurnitureSlots } from '../editor/furniture';

/**
 * The running header and footer, drawn per page.
 *
 * It sits above the mask rather than behind it. The mask paints every page's
 * margins to clip blocks that straddle a break, so furniture drawn underneath
 * would be painted out — the margins are exactly where this belongs.
 *
 * Positioned in the same coordinates as the sheets: each page box starts at
 * `index * stride`, which is why this survives the switch to export geometry
 * untouched. The pass re-paginates with no gutter, the stride becomes one page
 * tall, and the same rule puts page four's footer on page four of the paper.
 */

type PageFurnitureProps = {
  pageCount: number;
  furniture: Furniture;
  title: string;
};

function Row({
  kind,
  slots,
  page,
  pages,
  title,
}: {
  kind: 'header' | 'footer';
  slots: FurnitureSlots;
  page: number;
  pages: number;
  title: string;
}) {
  if (!slotsUsed(slots)) return null;
  const context = { page, pages, title, date: today() };
  return (
    <div className={`hwp-furniture-row hwp-furniture-row--${kind}`}>
      {SLOT_NAMES.map((slot) => (
        <span key={slot} className={`hwp-furniture-slot hwp-furniture-slot--${slot}`}>
          {resolveFields(slots[slot], context)}
        </span>
      ))}
    </div>
  );
}

export function PageFurniture({ pageCount, furniture, title }: PageFurnitureProps) {
  if (!hasFurniture(furniture)) return null;

  return (
    <div className="hwp-furniture-layer" aria-hidden="true">
      {Array.from({ length: pageCount }, (_, index) => {
        if (furniture.skipFirstPage && index === 0) return null;
        return (
          <div
            key={index}
            className="hwp-furniture"
            style={{ '--sheet-index': index } as CSSProperties}
          >
            <Row kind="header" slots={furniture.header} page={index + 1} pages={pageCount} title={title} />
            <Row kind="footer" slots={furniture.footer} page={index + 1} pages={pageCount} title={title} />
          </div>
        );
      })}
    </div>
  );
}

export { FURNITURE_FIELDS };
