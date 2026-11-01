const { fixMultipartFilename, sanitizeFilename, MAX_NAME_LENGTH } = require('./fileNames');

// What busboy hands multer for a UTF-8 filename: each byte read as Latin-1.
const asLatin1 = (s) => Buffer.from(s, 'utf8').toString('latin1');

describe('fixMultipartFilename', () => {
  test('recovers a Cyrillic name decoded as Latin-1', () => {
    expect(fixMultipartFilename(asLatin1('Выписка по счёту.pdf'))).toBe('Выписка по счёту.pdf');
  });

  test('recovers CJK and accented names', () => {
    expect(fixMultipartFilename(asLatin1('報告書.docx'))).toBe('報告書.docx');
    expect(fixMultipartFilename(asLatin1('relevé.csv'))).toBe('relevé.csv');
  });

  test('leaves plain ASCII alone', () => {
    expect(fixMultipartFilename('report-2026.pdf')).toBe('report-2026.pdf');
  });

  test('leaves a name that was already decoded correctly alone', () => {
    expect(fixMultipartFilename('Выписка.pdf')).toBe('Выписка.pdf');
  });

  test('leaves a genuine Latin-1 name alone when it is not valid UTF-8', () => {
    expect(fixMultipartFilename('caf\u00e9.txt')).toBe('caf\u00e9.txt');
  });

  test('passes through empty and non-string values', () => {
    expect(fixMultipartFilename('')).toBe('');
    expect(fixMultipartFilename(undefined)).toBe(undefined);
  });
});

describe('sanitizeFilename', () => {
  test('drops path components', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\Users\\x\\evidence.png')).toBe('evidence.png');
  });

  test('strips control characters and leading dots', () => {
    expect(sanitizeFilename('a\r\nb.txt')).toBe('ab.txt');
    expect(sanitizeFilename('.htaccess')).toBe('htaccess');
  });

  test('falls back to "file" for an empty result', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('...')).toBe('file');
  });

  test('truncates long names but keeps the extension', () => {
    const out = sanitizeFilename(`${'x'.repeat(400)}.pdf`);
    expect(out.length).toBe(MAX_NAME_LENGTH);
    expect(out.endsWith('.pdf')).toBe(true);
  });
});
