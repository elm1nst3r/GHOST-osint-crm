const { deleteProjectCascade, getProjectStats, PROJECT_SCOPED_TABLES } = require('./deleteProjectCascade');

// Fake pg client that records every query it's handed.
const makeClient = (counts = {}) => {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (/^SELECT COUNT/.test(sql)) {
        const table = sql.match(/FROM (\w+)/)[1];
        return { rows: [{ n: counts[table] || 0 }] };
      }
      if (/DELETE FROM projects/.test(sql)) return { rows: [{ id: params[0], name: 'X' }] };
      return { rows: [] };
    }),
  };
};

describe('deleteProjectCascade', () => {
  test('table list is unique and covers the key entities', () => {
    expect(new Set(PROJECT_SCOPED_TABLES).size).toBe(PROJECT_SCOPED_TABLES.length);
    for (const t of ['people', 'businesses', 'relationships', 'cases', 'crypto_wallets', 'transactions']) {
      expect(PROJECT_SCOPED_TABLES).toContain(t);
    }
  });

  test('deletes every scoped table then the project, all scoped to the id', async () => {
    const client = makeClient();
    await deleteProjectCascade(client, 42);

    const deletes = client.calls.filter((c) => /^DELETE/.test(c.sql));
    // one per scoped table + the projects row
    expect(deletes).toHaveLength(PROJECT_SCOPED_TABLES.length + 1);
    for (const c of deletes) expect(c.params).toEqual([42]);

    // projects row goes last
    expect(deletes[deletes.length - 1].sql).toMatch(/DELETE FROM projects/);
    // cases is cleared before the projects row
    const tableOrder = deletes.map((c) => c.sql.match(/DELETE FROM (\w+)/)[1]);
    expect(tableOrder.indexOf('cases')).toBeLessThan(tableOrder.indexOf('projects'));
  });

  test('getProjectStats sums per-table counts', async () => {
    const client = makeClient({ people: 3, businesses: 2 });
    const { counts, total } = await getProjectStats(client, 1);
    expect(counts.people).toBe(3);
    expect(counts.businesses).toBe(2);
    expect(total).toBe(5);
  });
});
