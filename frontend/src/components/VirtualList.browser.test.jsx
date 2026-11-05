// VirtualList in a real Chromium: rows of different heights, scrolling with
// the page's scroll area (data-scroll-root) the way the record lists do.
import { render } from 'vitest-browser-react';
import { test, expect } from 'vitest';
import '../index.css';
import VirtualList from './VirtualList';

// Every 7th record has a long description that wraps onto several lines.
const items = Array.from({ length: 400 }, (_, i) => ({
  id: 1000 + i,
  name: `Record ${i}`,
  text: i % 7 === 0 ? 'A long description that wraps. '.repeat(12) : 'Short',
}));

const Card = ({ item }) => (
  <div data-testid="card" className="border p-3">
    <strong>{item.name}</strong>
    <p>{item.text}</p>
  </div>
);

const renderList = () => render(
  <div data-scroll-root style={{ height: 600, width: 320, overflow: 'auto' }}>
    <h1 style={{ height: 120 }}>Header above the list</h1>
    <VirtualList items={items} estimatedHeight={60} gap={8} renderItem={(item) => <Card item={item} />} />
  </div>,
);

const settle = () => new Promise((r) => setTimeout(r, 100));

test('renders only the rows near the visible area', async () => {
  const screen = await renderList();
  await expect.element(screen.getByText('Record 0', { exact: true })).toBeVisible();
  const rendered = document.querySelectorAll('[data-testid="card"]').length;
  expect(rendered).toBeGreaterThan(3);
  expect(rendered).toBeLessThan(40);
});

test('scrolls with the surrounding scroll area and reaches the last record', async () => {
  const screen = await renderList();
  const root = document.querySelector('[data-scroll-root]');
  // Scroll in steps so rows get measured on the way down.
  for (let i = 0; i < 80 && !document.body.textContent.includes('Record 399'); i++) {
    root.scrollTop = root.scrollHeight;
    await settle();
  }
  await expect.element(screen.getByText('Record 399', { exact: true })).toBeVisible();
  expect(screen.getByText('Record 0', { exact: true }).query()).toBeNull();
});

test('a wrapped card gets its full height instead of being clipped', async () => {
  const screen = await renderList();
  const tall = screen.getByText('Record 0', { exact: true }).element().closest('[data-testid="card"]');
  const short = screen.getByText('Record 1', { exact: true }).element().closest('[data-testid="card"]');
  await settle();
  const tallRow = tall.parentElement.getBoundingClientRect();
  const shortRow = short.parentElement.getBoundingClientRect();
  // The rows don't overlap: the short one starts below the tall one's card.
  expect(tall.getBoundingClientRect().height).toBeGreaterThan(short.getBoundingClientRect().height * 2);
  expect(shortRow.top).toBeGreaterThanOrEqual(tallRow.top + tall.getBoundingClientRect().height);
});
