const { canonicalJson, recordHash, recordProblem, MAX_RECORD_BYTES } = require('./osintRecords');

describe('saved record helpers (#96)', () => {
  test('the hash does not depend on key order', () => {
    expect(recordHash({ a: 1, b: { c: [1, { d: 2, e: 3 }] } })).toBe(recordHash({ b: { c: [1, { e: 3, d: 2 }] }, a: 1 }));
    expect(recordHash({ a: 1 })).not.toBe(recordHash({ a: '1' }));
    expect(canonicalJson({ b: 1, a: [null, 'x'] })).toBe('{"a":[null,"x"],"b":1}');
  });

  test('records must be objects or lists of a sane size and depth', () => {
    expect(recordProblem({ a: 1 })).toBeNull();
    expect(recordProblem([1, 2])).toBeNull();
    expect(recordProblem('text')).toMatch(/object or list/);
    expect(recordProblem(null)).toMatch(/empty/);
    expect(recordProblem({ s: 'x'.repeat(MAX_RECORD_BYTES) })).toMatch(/larger/);
    let deep = {}; const top = deep;
    for (let i = 0; i < 40; i++) { deep.n = {}; deep = deep.n; }
    expect(recordProblem(top)).toMatch(/nested/);
  });
});
