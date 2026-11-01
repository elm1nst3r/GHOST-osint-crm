const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghost-files-test-'));
process.env.FILES_DIR = root;
const storage = require('./fileStorage');

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const writeTmp = (content) => {
  const p = path.join(storage.TMP_DIR, `${crypto.randomBytes(4).toString('hex')}.part`);
  fs.writeFileSync(p, content);
  return p;
};

const age = (p, ms) => {
  const t = new Date(Date.now() - ms);
  fs.utimesSync(p, t, t);
};

beforeAll(() => storage.ensureDirs());

test('uses FILES_DIR and keeps tmp/ and store/ inside it', () => {
  expect(storage.ROOT).toBe(path.resolve(root));
  expect(storage.TMP_DIR.startsWith(storage.ROOT)).toBe(true);
  expect(storage.STORE_DIR.startsWith(storage.ROOT)).toBe(true);
});

test('storeUpload moves the file into store/ and returns its SHA-256 and size', async () => {
  const tmp = writeTmp('hello evidence');
  const { storedName, sha256, size } = await storage.storeUpload(tmp);

  expect(storedName).toMatch(/^[a-f0-9]{32}$/);
  expect(sha256).toBe(crypto.createHash('sha256').update('hello evidence').digest('hex'));
  expect(size).toBe(14);
  expect(fs.existsSync(tmp)).toBe(false);
  expect(fs.readFileSync(storage.storedPath(storedName), 'utf8')).toBe('hello evidence');
});

test('storedPath rejects anything but a generated name', () => {
  expect(() => storage.storedPath('../../etc/passwd')).toThrow();
  expect(() => storage.storedPath('ABCDEF0123456789abcdef0123456789')).toThrow();
  expect(() => storage.storedPath('')).toThrow();
});

test('removeStored ignores a file that is already gone', async () => {
  await expect(storage.removeStored('0'.repeat(32))).resolves.toBeUndefined();
});

describe('sweepOrphans', () => {
  test('removes old files with no row, keeps known and recent ones', async () => {
    const known = await storage.storeUpload(writeTmp('known'));
    const orphan = await storage.storeUpload(writeTmp('orphan'));
    const fresh = await storage.storeUpload(writeTmp('fresh, upload in flight'));
    age(storage.storedPath(known.storedName), 2 * 3600e3);
    age(storage.storedPath(orphan.storedName), 2 * 3600e3);

    const pool = { query: async () => ({ rows: [{ stored_name: known.storedName }] }) };
    await storage.sweepOrphans(pool);

    expect(fs.existsSync(storage.storedPath(known.storedName))).toBe(true);
    expect(fs.existsSync(storage.storedPath(orphan.storedName))).toBe(false);
    expect(fs.existsSync(storage.storedPath(fresh.storedName))).toBe(true);
  });

  test('removes abandoned temp uploads older than a day only', async () => {
    const stale = writeTmp('stale');
    const recent = writeTmp('recent');
    age(stale, 25 * 3600e3);

    await storage.sweepOrphans({ query: async () => ({ rows: [] }) });

    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(recent)).toBe(true);
  });
});
