// Unit tests for the person-connection write helpers, with the database
// mocked: which statements run, in which order, and what is refused before
// anything is written.
const mockClient = { query: jest.fn(), release: jest.fn() };
jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
const { pool } = require('../config/database');
const { syncPersonConnections, removeEntityRelationships } = require('./relationships');

// People 1 (project 1, case 7) and 2 (project 1), so no cross-project rules apply.
const PEOPLE = { 1: { project_id: 1, case_id: 7 }, 2: { project_id: 1, case_id: null } };

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM people WHERE id')) return { rows: PEOPLE[params[0]] ? [PEOPLE[params[0]]] : [] };
    throw new Error(`unexpected pool query: ${sql}`);
  });
  pool.connect.mockResolvedValue(mockClient);
  mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 });
});

const statements = () => mockClient.query.mock.calls.map(([sql]) => sql.trim().split(/\s+/).slice(0, 2).join(' '));
const reverseInserts = () => mockClient.query.mock.calls.filter(([sql]) => sql.includes('WHERE NOT EXISTS'));

describe('syncPersonConnections', () => {
  test('a one-way connection writes only this person\'s row, in one transaction', async () => {
    const added = await syncPersonConnections(2, 1, null, [{ person_id: 1, type: 'friend' }]);
    expect(statements()).toEqual(['BEGIN', 'DELETE FROM', 'INSERT INTO', 'COMMIT']);
    expect(reverseInserts()).toHaveLength(0);
    expect(added).toEqual([]);
  });

  test('two-way adds the connection back with the reversed type, in the other person\'s case', async () => {
    const added = await syncPersonConnections(2, 1, null, [
      { person_id: 1, type: 'employer', note: 'n', mutual: true, reverse_type: 'employee' },
    ]);
    const [[, params]] = reverseInserts();
    expect(params).toEqual([1, 7, 1, 2, 'employee', 'n']);
    expect(added).toEqual([{ person_id: 1, connection: { person_id: 2, type: 'employee', note: 'n' } }]);
  });

  test('no audit entry when the other person already connects back', async () => {
    mockClient.query.mockImplementation(async (sql) => ({ rows: [], rowCount: sql.includes('WHERE NOT EXISTS') ? 0 : 1 }));
    const added = await syncPersonConnections(2, 1, null, [{ person_id: 1, type: 'friend', mutual: true }]);
    expect(added).toEqual([]);
  });

  test('a refused membership check writes nothing', async () => {
    const assertMember = jest.fn().mockRejectedValue(Object.assign(new Error('not a member'), { statusCode: 403 }));
    await expect(syncPersonConnections(2, 1, null, [{ person_id: 1, type: 'friend', mutual: true }], { assertMember }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(assertMember).toHaveBeenCalledWith(1);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test('membership is only checked for two-way connections', async () => {
    const assertMember = jest.fn();
    await syncPersonConnections(2, 1, null, [{ person_id: 1, type: 'friend' }], { assertMember });
    expect(assertMember).not.toHaveBeenCalled();
  });

  test('a failed insert rolls back, keeping the old connections', async () => {
    mockClient.query.mockImplementation(async (sql) => {
      if (sql.includes('WHERE NOT EXISTS')) throw new Error('value too long');
      return { rows: [], rowCount: 1 };
    });
    await expect(syncPersonConnections(2, 1, null, [{ person_id: 1, type: 'friend', mutual: true }]))
      .rejects.toThrow('value too long');
    expect(statements()).toContain('ROLLBACK');
    expect(statements()).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('an unknown person is refused before anything is written', async () => {
    await expect(syncPersonConnections(2, 1, null, [{ person_id: 99, type: 'friend' }]))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test('reverse_type that is not a usable string falls back to the type', async () => {
    await syncPersonConnections(2, 1, null, [{ person_id: 1, type: 'friend', mutual: true, reverse_type: { x: 1 } }]);
    expect(reverseInserts()[0][1][4]).toBe('friend');
  });
});

describe('removeEntityRelationships', () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  beforeEach(() => db.query.mockClear());

  test('removes rows at either end, and unlinks business employees for a person', async () => {
    await removeEntityRelationships(db, 'person', 5);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][1]).toEqual(['person', 5]);
    expect(db.query.mock.calls[1][0]).toMatch(/UPDATE businesses/);
    expect(db.query.mock.calls[1][1]).toEqual(['5']);
  });

  test('a business or wallet only removes its rows', async () => {
    await removeEntityRelationships(db, 'business', 3);
    await removeEntityRelationships(db, 'crypto_wallet', 4);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls.map(([sql]) => sql)).toEqual([expect.stringMatching(/DELETE FROM relationships/), expect.stringMatching(/DELETE FROM relationships/)]);
  });
});
