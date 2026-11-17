// Searching saved records across the CRM (issue #120).
import { describe, test, expect } from 'vitest';
import { phonePattern, matchedFields, highlightParts } from './recordMatch';

const record = {
  name: 'Frodo Baggins',
  contacts: [{ type: 'phone', value: '+1 (555) 012-3456' }, { type: 'email', value: 'frodo@shire.me' }],
  address: { city: 'Hobbiton', zip: '5550' },
};

describe('record search matching', () => {
  test('same phone rule as the server', () => {
    // backend/utils/osintRecords.test.js checks the same output.
    expect(phonePattern('020 7946')).toBe('2[ ().+/-]{0,3}0[ ().+/-]{0,3}7[ ().+/-]{0,3}9[ ().+/-]{0,3}4[ ().+/-]{0,3}6');
    expect(phonePattern('+44 20 7946')).toBe('(?:4[ ().+/-]{0,3}4[ ().+/-]{0,3}2[ ().+/-]{0,3}0[ ().+/-]{0,3}7[ ().+/-]{0,3}9[ ().+/-]{0,3}4[ ().+/-]{0,3}6|0[ ().+/-]{0,3}4[ ().+/-]{0,3}2[ ().+/-]{0,3}0[ ().+/-]{0,3}7[ ().+/-]{0,3}9[ ().+/-]{0,3}4[ ().+/-]{0,3}6)');
    expect(phonePattern('frodo@shire.me')).toBeNull();
    expect(phonePattern('12345')).toBeNull();
  });

  test('fields that matched, by value or by name, ignoring case', () => {
    expect(matchedFields(record, 'SHIRE')).toEqual([{ path: 'contacts[2].value', value: 'frodo@shire.me' }]);
    expect(matchedFields(record, 'city')).toEqual([{ path: 'address.city', value: 'Hobbiton' }]);
    expect(matchedFields(record, '')).toEqual([]);
  });

  test('a phone number written differently still finds its field', () => {
    expect(matchedFields(record, '15550123456')).toEqual([{ path: 'contacts[1].value', value: '+1 (555) 012-3456' }]);
    expect(matchedFields(record, '555.012.3456').map((f) => f.path)).toEqual(['contacts[1].value']);
    expect(matchedFields({ tel: '020 7946 0958' }, '+44 20 7946 0958')).toEqual([{ path: 'tel', value: '020 7946 0958' }]);
    expect(matchedFields({ tel: '+44 (20) 7946-0958' }, '020 7946 0958')).toEqual([{ path: 'tel', value: '+44 (20) 7946-0958' }]);
  });

  test('highlighting', () => {
    expect(highlightParts('frodo@shire.me', 'shire')).toEqual([
      { text: 'frodo@', hit: false }, { text: 'shire', hit: true }, { text: '.me', hit: false },
    ]);
    expect(highlightParts('+1 (555) 012-3456', '5550123456')).toEqual([
      { text: '+1 (', hit: false }, { text: '555) 012-3456', hit: true },
    ]);
    expect(highlightParts('a.b', '.')).toEqual([{ text: 'a', hit: false }, { text: '.', hit: true }, { text: 'b', hit: false }]);
    expect(highlightParts('plain', '')).toEqual([{ text: 'plain', hit: false }]);
  });
});
