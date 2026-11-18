jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
const { pool } = require('../config/database');
const { resolvePersonCase } = require('./projectConsistency');

// Issue #118: a person's case_id and case_name must describe the same case,
// whichever of the two the client sent.
describe('resolvePersonCase', () => {
  beforeEach(() => pool.query.mockReset());

  test('case_id wins and brings the case name', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ case_name: 'Operation Ring' }] });
    await expect(resolvePersonCase({ case_id: 7, caseName: 'something else' }, 1))
      .resolves.toEqual({ case_id: 7, case_name: 'Operation Ring' });
  });

  test('a name is matched to a case of the project', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, case_name: 'Operation Ring' }] });
    await expect(resolvePersonCase({ caseName: '  operation ring ' }, 1))
      .resolves.toEqual({ case_id: 7, case_name: 'Operation Ring' });
    expect(pool.query.mock.calls[0][1]).toEqual([1, 'operation ring']);
  });

  test('an unmatched name stays as free text', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await expect(resolvePersonCase({ caseName: 'Unfiled' }, 1))
      .resolves.toEqual({ case_id: null, case_name: 'Unfiled' });
  });

  test('neither clears the case', async () => {
    await expect(resolvePersonCase({ caseName: '' }, 1)).resolves.toEqual({ case_id: null, case_name: null });
    await expect(resolvePersonCase({}, 1)).resolves.toEqual({ case_id: null, case_name: null });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
