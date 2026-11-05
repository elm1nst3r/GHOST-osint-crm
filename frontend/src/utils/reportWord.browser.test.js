// Word report export in a real Chromium: builds the .docx with the real
// `docx` library (only the save dialog is replaced) and reads it back with
// mammoth, the library behind the file preview. Catches bundling problems a
// Node test can't, such as docx reaching for Node's Buffer in the browser.
import { vi, test, expect, beforeAll } from 'vitest';
import mammoth from 'mammoth/mammoth.browser';
import i18n from '../i18n';
import { downloadWord } from './reportGenerators';

const saved = vi.hoisted(() => []);
vi.mock('file-saver', () => ({ saveAs: (blob, name) => saved.push({ blob, name }) }));

beforeAll(() => i18n.changeLanguage('en'));

test('a case report downloads as a Word file that opens', async () => {
  const person = {
    id: 1,
    first_name: 'Иван',
    patronymic: 'Петрович',
    last_name: 'Иванов',
    category: 'Suspect',
    connections: [],
    locations: [],
  };
  await downloadWord(
    { people: [person], businesses: [], locations: [], todos: [], selectedCase: { case_name: 'Operation Lantern', status: 'Active' }, selectedPerson: null },
    { includeSummary: true, includePeople: true, includeConnections: true, includeLocations: true, includeTodos: true, includeCharts: false },
  );

  expect(saved).toHaveLength(1);
  expect(saved[0].name).toMatch(/^investigation-report-\d+\.docx$/);
  const bytes = new Uint8Array(await saved[0].blob.arrayBuffer());
  expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK'); // a zip, like every .docx

  const { value: text } = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
  expect(text).toContain('Operation Lantern');
  expect(text).toContain('Иван Петрович Иванов');
});
