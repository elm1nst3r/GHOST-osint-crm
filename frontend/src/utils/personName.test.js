import { formatPersonName, personNameOrder, isFamilyNameFirst } from './personName';

describe('name order by language', () => {
  test('English leads with the given name', () => {
    expect(personNameOrder('en')).toEqual(['first_name', 'patronymic', 'last_name']);
    expect(isFamilyNameFirst('en')).toBe(false);
  });

  test('Russian and neighbours lead with the family name (issue #61)', () => {
    ['ru', 'uk', 'be', 'bg', 'kk'].forEach((lang) => {
      expect(isFamilyNameFirst(lang)).toBe(true);
      expect(personNameOrder(lang)).toEqual(['last_name', 'first_name', 'patronymic']);
    });
  });

  test('handles regional tags and unknown languages', () => {
    expect(isFamilyNameFirst('ru-RU')).toBe(true);
    expect(isFamilyNameFirst('de')).toBe(false);
    expect(isFamilyNameFirst(undefined)).toBe(false);
  });

  test('formats Russian as Фамилия Имя Отчество', () => {
    expect(formatPersonName({ first_name: 'Иван', patronymic: 'Петрович', last_name: 'Сидоров' }, '', 'ru'))
      .toBe('Сидоров Иван Петрович');
  });
});

describe('formatPersonName', () => {
  test('renders given · patronymic · family in order', () => {
    expect(formatPersonName({ first_name: 'Иван', patronymic: 'Петрович', last_name: 'Сидоров' }, '', 'en'))
      .toBe('Иван Петрович Сидоров');
  });

  test('skips the patronymic when absent, with no double space', () => {
    expect(formatPersonName({ first_name: 'John', last_name: 'Doe' }, '', 'en')).toBe('John Doe');
    expect(formatPersonName({ first_name: 'John', patronymic: '', last_name: 'Doe' }, '', 'en')).toBe('John Doe');
    expect(formatPersonName({ first_name: 'John', patronymic: null, last_name: 'Doe' }, '', 'en')).toBe('John Doe');
  });

  test('handles a person with only one name part', () => {
    expect(formatPersonName({ first_name: 'Madonna' })).toBe('Madonna');
    expect(formatPersonName({ last_name: 'Prince' })).toBe('Prince');
    expect(formatPersonName({ patronymic: 'Петрович' })).toBe('Петрович');
  });

  test('trims stray whitespace on the parts', () => {
    expect(formatPersonName({ first_name: '  Jane ', patronymic: ' ', last_name: ' Smith' }, '', 'en'))
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
