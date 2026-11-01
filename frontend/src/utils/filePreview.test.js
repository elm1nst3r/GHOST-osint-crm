import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { previewKind, previewBlobType, guessEncoding, decodeText, formatBytes } from './filePreview';

// jsdom (CRA's test environment) has no TextDecoder; every browser does.
global.TextDecoder = global.TextDecoder || NodeTextDecoder;
global.TextEncoder = global.TextEncoder || NodeTextEncoder;

const f = (original_name, mime_type = '', size_bytes = 1000) => ({ original_name, mime_type, size_bytes });

describe('previewKind', () => {
  test.each([
    ['report.pdf', 'application/pdf', 'pdf'],
    ['scan.JPG', 'image/jpeg', 'image'],
    ['photo.webp', '', 'image'],
    ['calls.csv', 'application/vnd.ms-excel', 'table'],
    ['export.tsv', '', 'table'],
    ['statement.docx', 'application/octet-stream', 'docx'],
    ['notes.txt', 'text/plain', 'text'],
    ['dump.json', '', 'text'],
    ['page.html', 'text/html', 'text'],
  ])('%s → %s', (name, mime, kind) => {
    expect(previewKind(f(name, mime))).toBe(kind);
  });

  test.each([
    ['archive.zip', 'application/zip'],
    ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['old.doc', 'application/msword'],
    ['logo.svg', 'image/svg+xml'],
    ['binary.exe', 'application/octet-stream'],
  ])('%s is download-only', (name, mime) => {
    expect(previewKind(f(name, mime))).toBeNull();
  });

  test('falls back to the reported type for an unknown extension', () => {
    expect(previewKind(f('readme.dat', 'text/plain'))).toBe('text');
    expect(previewKind(f('noext', 'application/pdf'))).toBe('pdf');
  });

  test('skips previews of very large files', () => {
    expect(previewKind(f('huge.txt', 'text/plain', 500 * 1024 * 1024))).toBeNull();
  });

  test('handles a missing file', () => {
    expect(previewKind(null)).toBeNull();
  });
});

describe('previewBlobType', () => {
  test('ignores what the uploader claimed', () => {
    expect(previewBlobType(f('evil.pdf', 'text/html'))).toBe('application/pdf');
    expect(previewBlobType(f('x.png', 'text/html'))).toBe('image/png');
  });

  test('text-like kinds become text/plain', () => {
    expect(previewBlobType(f('page.html', 'text/html'))).toBe('text/plain');
  });
});

describe('guessEncoding', () => {
  test('valid UTF-8 stays UTF-8', () => {
    expect(guessEncoding(new TextEncoder().encode('Звонки, März'), 'en')).toBe('utf-8');
  });

  // "Привет, Иван" in Windows-1251
  const cp1251 = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x2c, 0x20, 0xc8, 0xe2, 0xe0, 0xed]);
  // "Grüße aus Köln, café" in Windows-1252
  const cp1252 = new Uint8Array([...'Gr'].map((c) => c.charCodeAt(0)).concat(
    [0xfc, 0xdf], [...'e aus K'].map((c) => c.charCodeAt(0)), [0xf6], [...'ln, caf'].map((c) => c.charCodeAt(0)), [0xe9]));

  test('Windows-1251 Cyrillic is recognised whatever the UI language', () => {
    expect(guessEncoding(cp1251, 'en')).toBe('windows-1251');
    expect(guessEncoding(cp1251, 'ru')).toBe('windows-1251');
    expect(decodeText(cp1251, 'windows-1251')).toBe('Привет, Иван');
  });

  test('Western text falls back to the UI language code page', () => {
    expect(guessEncoding(cp1252, 'en')).toBe('windows-1252');
    expect(decodeText(cp1252, 'windows-1252')).toBe('Grüße aus Köln, café');
  });

  test('detects a UTF-16 LE byte-order mark', () => {
    expect(guessEncoding(new Uint8Array([0xff, 0xfe, 0x41, 0x00]))).toBe('utf-16le');
  });
});

test('formatBytes', () => {
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
  expect(formatBytes(undefined)).toBe('');
});
