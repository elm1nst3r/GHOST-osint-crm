const { reverseConnectionType } = require('./connectionTypes');
const { removeEntityLinks, sweepOrphanedLinks, SWEEP_STATEMENTS } = require('./entityLinks');
const { addReverseConnections } = require('../routes/relationships');

// Fake db: answers by SQL shape, records every call.
function fakeDb({ people = {}, existing = [] } = {}) {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params = []) => {
      calls.push({ sql, params });
      if (/SELECT id, project_id, case_id FROM people/.test(sql)) return { rows: people[params[0]] ? [{ id: params[0], ...people[params[0]] }] : [] };
      if (/SELECT project_id FROM people/.test(sql)) return { rows: people[params[0]] ? [{ project_id: people[params[0]].project_id }] : [] };
      if (/SELECT 1 FROM relationships/.test(sql)) return { rows: existing.some(([a, b]) => a === params[0] && b === params[1]) ? [{}] : [] };
      if (/SELECT allow_cross_linking/.test(sql)) return { rows: [{ allow_cross_linking: true }] };
      return { rows: [] };
    }),
  };
}
const inserts = (db) => db.calls.filter((c) => /INSERT INTO relationships/.test(c.sql));

describe('connection types read from the other side (#112)', () => {
  test('employer and employee swap; the rest read the same', () => {
    expect(reverseConnectionType('employer')).toBe('employee');
    expect(reverseConnectionType('employee')).toBe('employer');
    expect(reverseConnectionType('family')).toBe('family');
    expect(reverseConnectionType(undefined)).toBe('other');
  });
});

describe('two-way connections (#112)', () => {
  const people = { 1: { project_id: 10, case_id: null }, 2: { project_id: 10, case_id: 5 }, 3: { project_id: 20, case_id: null } };
  const allow = async () => null;

  test('adds the connection back on the other person, from their side', async () => {
    const db = fakeDb({ people });
    const added = await addReverseConnections(1, [{ person_id: 2, type: 'employer', note: 'pays her', two_way: true }], allow, db);
    expect(added).toEqual([{ person_id: 2, type: 'employee', note: 'pays her' }]);
    expect(inserts(db)[0].params).toEqual([10, 5, 2, 1, 'employee', 'pays her']); // their project and case
  });

  test('only when asked, and never over a connection they already have', async () => {
    const db = fakeDb({ people, existing: [[2, 1]] });
    expect(await addReverseConnections(1, [{ person_id: 2, type: 'friend', two_way: true }, { person_id: 3, type: 'friend' }], allow, db)).toEqual([]);
    expect(inserts(db)).toHaveLength(0);
  });

  test('needs access to the other person\'s project', async () => {
    const db = fakeDb({ people });
    const deny = async (projectId) => (projectId === 20 ? 'You are not a member of project 20' : null);
    await expect(addReverseConnections(1, [{ person_id: 3, type: 'friend', two_way: true }], deny, db)).rejects.toMatchObject({ statusCode: 403 });
    expect(inserts(db)).toHaveLength(0);
  });

  test('a missing person is a 404; a connection to yourself is ignored', async () => {
    await expect(addReverseConnections(1, [{ person_id: 99, two_way: true }], allow, fakeDb({ people }))).rejects.toMatchObject({ statusCode: 404 });
    expect(await addReverseConnections(1, [{ person_id: 1, two_way: true }], allow, fakeDb({ people }))).toEqual([]);
  });
});

describe('deleting removes links without a foreign key (#112)', () => {
  test('a person: relationships at either end, employee links, wireless links', async () => {
    const db = fakeDb();
    await removeEntityLinks(db, 'person', 7);
    const sql = db.calls.map((c) => c.sql).join('\n');
    expect(sql).toMatch(/DELETE FROM relationships[\s\S]*source_type = \$1 AND source_id = \$2\) OR \(target_type = \$1 AND target_id = \$2/);
    expect(sql).toMatch(/UPDATE businesses SET employees/);
    expect(sql).toMatch(/associated_person_ids = array_remove/);
    expect(db.calls.every((c) => c.params.includes(7))).toBe(true);
  });

  test('a business: relationships and wireless links; a wallet: relationships', async () => {
    const biz = fakeDb();
    await removeEntityLinks(biz, 'business', 3);
    expect(biz.calls.map((c) => c.sql).join('\n')).toMatch(/associated_business_ids = array_remove/);
    const wallet = fakeDb();
    await removeEntityLinks(wallet, 'crypto_wallet', 4);
    expect(wallet.calls).toHaveLength(1);
    await expect(removeEntityLinks(wallet, 'project', 1)).rejects.toThrow();
  });

  test('the sweep runs every statement', async () => {
    const db = fakeDb();
    await sweepOrphanedLinks(db);
    expect(db.calls.map((c) => c.sql)).toEqual(SWEEP_STATEMENTS);
  });
});
