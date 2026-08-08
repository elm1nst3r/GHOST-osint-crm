import i18n from 'i18next';
import en from '../locales/en/translation.json';
import { optionKeySegment, optionLabel, translateOptions } from './optionLabels';

// A tiny stand-in locale so the tests don't depend on how complete ru/ is.
const xx = {
  dataModel: {
    optionLabels: {
      person_category: { suspect: 'ПОДОЗРЕВАЕМЫЙ', client: 'КЛИЕНТ' },
      person_status: { open: 'ОТКРЫТО' },
    },
  },
};

beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en }, xx: { translation: xx } },
    lng: 'xx',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
);

const t = (...args) => i18n.t(...args);

describe('optionKeySegment', () => {
  it('slugifies spaced and punctuated values', () => {
    expect(optionKeySegment('Person of Interest')).toBe('person_of_interest');
    expect(optionKeySegment('IP Address')).toBe('ip_address');
    expect(optionKeySegment('Benefit / Hospitality')).toBe('benefit_hospitality');
    expect(optionKeySegment('already_snake')).toBe('already_snake');
  });

  it('survives junk without throwing', () => {
    expect(optionKeySegment(null)).toBe('');
    expect(optionKeySegment('   ')).toBe('');
    expect(optionKeySegment('///')).toBe('');
  });
});

describe('optionLabel', () => {
  it('translates a shipped option whose label is untouched', () => {
    expect(optionLabel(t, 'person_category', 'Suspect', 'Suspect')).toBe('ПОДОЗРЕВАЕМЫЙ');
  });

  it('translates when no stored label is supplied (raw persisted values)', () => {
    expect(optionLabel(t, 'person_status', 'Open')).toBe('ОТКРЫТО');
  });

  it('keeps a user-renamed label instead of overriding it', () => {
    expect(optionLabel(t, 'person_category', 'Client', 'Key Account')).toBe('Key Account');
  });

  it('falls back to the stored label for user-created options', () => {
    expect(optionLabel(t, 'person_category', 'Informant', 'Informant')).toBe('Informant');
  });

  it('falls back to English when the active language lacks the key', () => {
    // present in en/translation.json, absent from xx
    expect(optionLabel(t, 'person_category', 'Witness', 'Witness')).toBe('Witness');
  });

  it('returns the raw value when there is nothing else to show', () => {
    expect(optionLabel(t, 'person_category', 'Unmapped')).toBe('Unmapped');
    expect(optionLabel(t, null, 'Suspect', 'Suspect')).toBe('Suspect');
    expect(optionLabel(t, 'person_category', '', '')).toBe('');
  });
});

describe('translateOptions', () => {
  it('normalises model_options rows and preserves their other fields', () => {
    const rows = [
      { id: 7, model_type: 'person_category', option_value: 'Suspect', option_label: 'Suspect', display_order: 5 },
    ];
    expect(translateOptions(t, 'person_category', rows)[0]).toMatchObject({
      id: 7,
      value: 'Suspect',
      label: 'ПОДОЗРЕВАЕМЫЙ',
      display_order: 5,
    });
  });

  it('handles constants.js entries and keeps extras like color', () => {
    const entries = [{ value: 'Open', label: 'Open', color: 'green' }];
    expect(translateOptions(t, 'person_status', entries)[0]).toMatchObject({
      value: 'Open',
      label: 'ОТКРЫТО',
      color: 'green',
    });
  });

  it('never rewrites the stored value', () => {
    const out = translateOptions(t, 'person_category', [{ value: 'Suspect', label: 'Suspect' }]);
    expect(out[0].value).toBe('Suspect');
  });

  it('defaults to an empty list', () => {
    expect(translateOptions(t, 'person_category')).toEqual([]);
  });
});
