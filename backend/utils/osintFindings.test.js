const { mergeOsintFindings, MAX_SOURCES } = require('./osintFindings');

const finding = (over = {}) => ({
  tool_id: 1, tool_name: 'Breach search', integration_id: 'breaches', operation: 'by-email',
  query: 'vovk@yandex.ru', retrieved_at: '2026-11-05T10:00:00Z', ...over,
});

describe('mergeOsintFindings (#96)', () => {
  test('a new value becomes an entry with its finding, unverified', () => {
    const r = mergeOsintFindings([], [{ type: 'Email', value: ' vovk@yandex.ru ', source: finding({ occurrences: 27 }) }], 7);
    expect(r).toMatchObject({ added: 1, updated: 0, unchanged: 0 });
    expect(r.osintData[0]).toMatchObject({ type: 'Email', value: 'vovk@yandex.ru', verified: false });
    expect(r.osintData[0].source).toMatchObject({ occurrences: 27, added_by: 7 });
    expect(r.osintData[0].sources).toHaveLength(1);
  });

  test('the same value from another tool is added to the existing entry, not dropped', () => {
    const first = mergeOsintFindings([], [{ type: 'Email', value: 'vovk@yandex.ru', source: finding({ occurrences: 27 }) }]).osintData;
    const r = mergeOsintFindings(first, [{ type: 'email', value: 'VOVK@yandex.ru', source: finding({ integration_id: 'leaks', tool_name: 'Leak index', occurrences: 3 }) }]);
    expect(r).toMatchObject({ added: 0, updated: 1, unchanged: 0 });
    expect(r.osintData).toHaveLength(1);
    expect(r.osintData[0].sources.map((s) => [s.tool_name, s.occurrences])).toEqual([['Breach search', 27], ['Leak index', 3]]);
    expect(r.osintData[0].source.tool_name).toBe('Breach search'); // first finding stays `source`
  });

  test('running the same search again updates its count and date instead of repeating it', () => {
    const first = mergeOsintFindings([], [{ type: 'Email', value: 'vovk@yandex.ru', source: finding({ occurrences: 27 }) }]).osintData;
    const r = mergeOsintFindings(first, [{ type: 'Email', value: 'vovk@yandex.ru', source: finding({ occurrences: 31, retrieved_at: '2026-11-06T09:00:00Z' }) }]);
    expect(r).toMatchObject({ added: 0, updated: 1 });
    expect(r.osintData[0].sources).toHaveLength(1);
    expect(r.osintData[0].sources[0]).toMatchObject({ occurrences: 31, retrieved_at: '2026-11-06T09:00:00Z' });
    expect(r.osintData[0].source.occurrences).toBe(31);
    const again = mergeOsintFindings(r.osintData, [{ type: 'Email', value: 'vovk@yandex.ru', source: finding({ occurrences: 31, retrieved_at: '2026-11-06T09:00:00Z' }) }]);
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });

  test('a value typed in by hand records the tool finding but keeps its own status', () => {
    const manual = [{ type: 'Email', value: 'vovk@yandex.ru', notes: 'from the client' }];
    const r = mergeOsintFindings(manual, [{ type: 'Email', value: 'vovk@yandex.ru', source: finding({ occurrences: 2 }) }]);
    expect(r).toMatchObject({ added: 0, updated: 1 });
    expect(r.osintData[0]).toEqual({ type: 'Email', value: 'vovk@yandex.ru', notes: 'from the client', sources: [expect.objectContaining({ occurrences: 2 })] });
  });

  test('entries saved before sources existed (only `source`) are upgraded on the next finding', () => {
    const old = [{ type: 'Email', value: 'a@x.co', source: finding({ query: 'a@x.co' }), verified: false }];
    const r = mergeOsintFindings(old, [{ type: 'Email', value: 'a@x.co', source: finding({ integration_id: 'other', query: 'a@x.co' }) }]);
    expect(r.osintData[0].sources.map((s) => s.integration_id)).toEqual(['breaches', 'other']);
  });

  test('duplicates inside one batch end up in one entry', () => {
    const r = mergeOsintFindings([], [
      { type: 'Email', value: 'a@x.co', source: finding({ occurrences: 4 }) },
      { type: 'Email', value: 'a@x.co', source: finding({ integration_id: 'other', occurrences: 2 }) },
      { type: 'Email', value: 'b@x.co' },
    ]);
    expect(r).toMatchObject({ added: 2, updated: 1 });
    expect(r.osintData.find((e) => e.value === 'a@x.co').sources).toHaveLength(2);
  });

  test('a manual entry added twice is left alone', () => {
    const r = mergeOsintFindings([{ type: 'Email', value: 'a@x.co' }], [{ type: 'Email', value: 'a@x.co' }]);
    expect(r).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });

  test('sources are capped, keeping the first one', () => {
    let data = mergeOsintFindings([], [{ type: 'Email', value: 'a@x.co', source: finding({ integration_id: 'first' }) }]).osintData;
    for (let i = 0; i < MAX_SOURCES + 5; i++) data = mergeOsintFindings(data, [{ type: 'Email', value: 'a@x.co', source: finding({ integration_id: `t${i}` }) }]).osintData;
    expect(data[0].sources).toHaveLength(MAX_SOURCES);
    expect(data[0].sources[0].integration_id).toBe('first');
    expect(data[0].sources.at(-1).integration_id).toBe(`t${MAX_SOURCES + 4}`);
  });
});

describe('findings from saved records (#96)', () => {
  test('a value taken from a saved record is its own finding, even for the same search', () => {
    const first = mergeOsintFindings([], [{ type: 'Phone', value: '+10000000001', source: finding({ occurrences: 4 }) }]).osintData;
    const r = mergeOsintFindings(first, [{ type: 'Phone', value: '+10000000001', source: finding({ record_id: 12, record_path: 'PHONE' }) }]);
    expect(r).toMatchObject({ updated: 1 });
    expect(r.osintData[0].sources).toHaveLength(2);
    expect(r.osintData[0].sources[1]).toMatchObject({ record_id: 12, record_path: 'PHONE' });
  });

  test('record sources are kept and refreshed with the search', () => {
    const first = mergeOsintFindings([], [{ type: 'Phone', value: 'p', source: finding({ occurrences: 2, record_sources: ['A'] }) }]).osintData;
    expect(first[0].sources[0].record_sources).toEqual(['A']);
    const r = mergeOsintFindings(first, [{ type: 'Phone', value: 'p', source: finding({ occurrences: 2, record_sources: ['A', 'B'] }) }]);
    expect(r).toMatchObject({ updated: 1 });
    expect(r.osintData[0].sources[0].record_sources).toEqual(['A', 'B']);
  });
});
