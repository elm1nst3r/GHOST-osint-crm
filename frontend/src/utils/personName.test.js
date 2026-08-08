import { formatPersonName } from './personName';

describe('formatPersonName', () => {
  test('renders given · patronymic · family in order', () => {
    expect(formatPersonName({ first_name: 'Иван', patronymic: 'Петрович', last_name: 'Сидоров' }))
      .toBe('Иван Петрович Сидоров');
  });

  test('skips the patronymic when absent, with no double space', () => {
    expect(formatPersonName({ first_name: 'John', last_name: 'Doe' })).toBe('John Doe');
    expect(formatPersonName({ first_name: 'John', patronymic: '', last_name: 'Doe' })).toBe('John Doe');
    expect(formatPersonName({ first_name: 'John', patronymic: null, last_name: 'Doe' })).toBe('John Doe');
  });

  test('handles a person with only one name part', () => {
    expect(formatPersonName({ first_name: 'Madonna' })).toBe('Madonna');
    expect(formatPersonName({ last_name: 'Prince' })).toBe('Prince');
    expect(formatPersonName({ patronymic: 'Петрович' })).toBe('Петрович');
  });

  test('trims stray whitespace on the parts', () => {
    expect(formatPersonName({ first_name: '  Jane ', patronymic: ' ', last_name: ' Smith' }))
      .toBe('Jane Smith');
  });

  test('returns the fallback when nothing is set', () => {
    expect(formatPersonName({}, 'Unknown')).toBe('Unknown');
    expect(formatPersonName(null, 'Unknown')).toBe('Unknown');
    expect(formatPersonName({ first_name: null, patronymic: null, last_name: null }, 'Unknown'))
      .toBe('Unknown');
  });

  test('defaults the fallback to an empty string', () => {
    expect(formatPersonName({})).toBe('');
  });
});
