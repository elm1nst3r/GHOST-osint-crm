// What a record may point at (#116).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
const { checkRefs, refsFrom, alreadyStored, TRANSACTION_REFS } = require('./projectRefs');

// people 1 (project 10), 2 (project 20), 3 (project 30); project 10 allows
// cross-project links when `cross` is set.
const fakeDb = ({ cross = false } = {}) => ({
  query: jest.fn(async (sql, [id]) => {
    if (sql.includes('FROM projects')) return { rows: [{ allow_cross_linking: cross }] };
    const project = { 1: 10, 2: 20, 3: 30 }[id];
    return { rows: project ? [{ project_id: project }] : [] };
  }),
});
const memberOf = (...projects) => async (pid) => (projects.includes(pid) ? null : `You are not a member of project ${pid}`);
const ref = (id, field = 'from_person_id') => ({ field, type: 'person', id });

describe('checkRefs (#116)', () => {
  test('something in the same project is fine; nothing to check is fine', async () => {
    expect(await checkRefs({}, 10, [ref(1)], { db: fakeDb(), canSee: memberOf(10) })).toBeNull();
    expect(await checkRefs({}, 10, [ref(null), ref('')], { db: fakeDb(), canSee: memberOf(10) })).toBeNull();
  });

  test("a project the caller isn't in reads exactly like a missing record", async () => {
    const hidden = await checkRefs({}, 10, [ref(2)], { db: fakeDb({ cross: true }), canSee: memberOf(10) });
    const missing = await checkRefs({}, 10, [ref(99)], { db: fakeDb({ cross: true }), canSee: memberOf(10) });
    expect(hidden).toEqual({ status: 400, error: 'from_person_id: person 2 not found' });
    expect(missing).toEqual({ status: 400, error: 'from_person_id: person 99 not found' });
    expect(await checkRefs({}, 10, [ref('abc')], { db: fakeDb(), canSee: memberOf(10) })).toMatchObject({ status: 400 });
  });

  test('another project the caller is in: only when this project allows cross-project links', async () => {
    const off = await checkRefs({}, 10, [ref(2)], { db: fakeDb({ cross: false }), canSee: memberOf(10, 20) });
    expect(off.error).toMatch(/another project/);
    expect(await checkRefs({}, 10, [ref(2)], { db: fakeDb({ cross: true }), canSee: memberOf(10, 20) })).toBeNull();
  });

  test('on an edit, what the record already points at is not checked again', async () => {
    const canSee = memberOf(10);
    expect(await checkRefs({}, 10, [ref(3)], { db: fakeDb(), canSee, existing: { from_person_id: 3 } })).toBeNull();
    expect(await checkRefs({}, 10, [ref(3, 'associated_person_ids')], { db: fakeDb(), canSee, existing: { associated_person_ids: [3] } })).toBeNull();
    expect(await checkRefs({}, 10, [ref(2)], { db: fakeDb(), canSee, existing: { from_person_id: 3 } })).toMatchObject({ status: 400 });
  });

  test('helpers', () => {
    expect(refsFrom({ from_person_id: 1, to_business_id: '', subject_asset_id: 5 }, TRANSACTION_REFS)).toEqual([
      { field: 'from_person_id', type: 'person', id: 1 },
      { field: 'subject_asset_id', type: 'asset', id: 5 },
    ]);
    expect(alreadyStored(null, 'x', 1)).toBe(false);
    expect(alreadyStored({ x: '7' }, 'x', 7)).toBe(true);
  });
});
