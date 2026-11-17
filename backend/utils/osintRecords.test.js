const { canonicalJson, recordHash, recordProblem, MAX_RECORD_BYTES, phonePattern } = require('./osintRecords');

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

// Issue #120: a phone number is found however it was written.
describe('phonePattern', () => {
  const matches = (q, text) => new RegExp(phonePattern(q)).test(text);

  test('only phone-like text with at least 6 digits', () => {
    expect(phonePattern('frodo@shire.me')).toBeNull();
    expect(phonePattern('12345')).toBeNull();
    expect(phonePattern('Bag End 1')).toBeNull();
    // frontend/src/utils/recordMatch.test.js checks the same output.
    expect(phonePattern('020 7946')).toBe('2[ ().+/-]{0,3}0[ ().+/-]{0,3}7[ ().+/-]{0,3}9[ ().+/-]{0,3}4[ ().+/-]{0,3}6');
    expect(phonePattern('+44 20 7946')).toBe('(?:4[ ().+/-]{0,3}4[ ().+/-]{0,3}2[ ().+/-]{0,3}0[ ().+/-]{0,3}7[ ().+/-]{0,3}9[ ().+/-]{0,3}4[ ().+/-]{0,3}6|0[ ().+/-]{0,3}4[ ().+/-]{0,3}2[ ().+/-]{0,3}0[ ().+/-]{0,3}7[ ().+/-]{0,3}9[ ().+/-]{0,3}4[ ().+/-]{0,3}6)');
  });

  test('any spelling finds the others', () => {
    const stored = '{"phone": "+1 (555) 012-3456"}';
    for (const q of ['15550123456', '1.555.012.3456', '555-012-3456', '+1 555 012 3456']) expect(matches(q, stored)).toBe(true);
    expect(matches('+1 (555) 012-3456', '{"tel": 15550123456}')).toBe(true);
  });

  test('national and international forms find each other', () => {
    const intl = '{"phone": "+44 (20) 7946-0958"}';
    const national = '{"phone": "020 7946 0958"}';
    for (const q of ['020 7946 0958', '(020) 7946-0958']) { expect(matches(q, intl)).toBe(true); expect(matches(q, national)).toBe(true); }
    for (const q of ['+44 20 7946 0958', '0044 20 7946 0958']) { expect(matches(q, intl)).toBe(true); expect(matches(q, national)).toBe(true); }
    expect(matches('+44 20 7946 0958', '{"phone": "+33 20 7946 0958"}')).toBe(false);
  });

  test('digits from different fields do not join up', () => {
    expect(matches('555 0123', '{"a": "555", "b": "0123"}')).toBe(false);
    expect(matches('555 0123', '{"zip": "5550", "n": 123}')).toBe(false);
  });
});
