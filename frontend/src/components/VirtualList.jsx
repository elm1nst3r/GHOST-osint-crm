// Long lists (150+ records): only the rows on screen are in the page.
//
// react-window 2 measures each row, so a card that wraps onto more lines on
// a narrow screen gets the height it needs instead of being clipped at a
// fixed pixel height (issue #64, stage 3). The list scrolls with the page's
// main content area (marked data-scroll-root in App) rather than inside a
// box of its own, so there's one scrollbar and touch scrolling isn't trapped.
import { useCallback, useState } from 'react';
import { List, useDynamicRowHeight } from 'react-window';

function Row({ index, style, ariaAttributes, items, renderItem, gap }) {
  return (
    <div style={{ ...style, paddingBottom: gap }} {...ariaAttributes}>
      {renderItem(items[index], index)}
    </div>
  );
}

// Rows are keyed by record id, so measured heights and row state follow the
// record when the list is filtered or re-sorted.
const rowKey = (index, { items }) => items[index]?.id ?? index;

export default function VirtualList({ items, renderItem, estimatedHeight, gap = 16, overscanCount = 3 }) {
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: estimatedHeight + gap });
  const [scrollElement, setScrollElement] = useState(null);
  const anchor = useCallback((el) => {
    setScrollElement(el?.closest('[data-scroll-root]') ?? null);
  }, []);

  return (
    <div ref={anchor}>
      <List
        rowComponent={Row}
        rowCount={items.length}
        rowHeight={rowHeight}
        rowKey={rowKey}
        rowProps={{ items, renderItem, gap }}
        scrollElement={scrollElement}
        overscanCount={overscanCount}
      />
    </div>
  );
}
