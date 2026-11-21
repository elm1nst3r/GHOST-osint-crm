// Full-text search (search-and-command-palette plan): what a typed search
// becomes, and the snippet shown under a result.
const { buildSearch, snippet } = require('./searchQuery');

describe('buildSearch', () => {
  test('every word as a prefix, ANDed; ILIKE patterns escaped', () => {
    expect(buildSearch('  Frodo   Bag ')).toMatchObject({
      terms: ['Frodo', 'Bag'], tsquery: "'Frodo':* & 'Bag':*", likes: ['%Frodo%', '%Bag%'], phone: null,
    });
    expect(buildSearch('100%_off\\').likes).toEqual(['%100\\%\\_off\\\\%']);
  });

  test("to_tsquery's own syntax can't get in", () => {
    expect(buildSearch("o'neil & !(x|y):*").tsquery).toBe("'o':* & 'neil':* & 'x':* & 'y':*");
    expect(buildSearch('&&& |||')).toMatchObject({ tsquery: null, likes: ['%&&&%', '%|||%'] });
  });

  test('non-Latin scripts pass through unchanged', () => {
    expect(buildSearch('Иванов').tsquery).toBe("'Иванов':*");
    expect(buildSearch('علی رضایی').terms).toEqual(['علی', 'رضایی']);
    expect(buildSearch('甘道夫').likes).toEqual(['%甘道夫%']);
  });

  test('a phone number also gets the phone pattern; nothing typed gives null', () => {
    expect(buildSearch('+98 912 345').phone).toMatch(/^\(\?:/);
    expect(buildSearch('frodo@shire.me').phone).toBeNull();
    expect(buildSearch('   ')).toBeNull();
    expect(buildSearch(undefined)).toBeNull();
  });

  test('long input is capped', () => {
    const s = buildSearch(`${'a'.repeat(200)} ${Array.from({ length: 20 }, (_, i) => `w${i}`).join(' ')}`);
    expect(s.terms).toHaveLength(8);
    expect(s.terms[0]).toHaveLength(64);
  });
});

describe('snippet', () => {
  const body = 'Lives in the Shire with his gardener. Carries a ring that he inherited from his uncle Bilbo. '
    + 'Contact: +44 (20) 7946-0958, frodo@bagend.example. Last seen leaving Bree with three companions.';

  test('around the first match, cut at word boundaries', () => {
    const s = snippet(body, buildSearch('bilbo'), 60);
    expect(s).toContain('Bilbo');
    expect(s.startsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(62);
    expect(s).not.toMatch(/^…\S*[a-z]Bilbo/);
  });

  test('a phone number written differently is found', () => {
    expect(snippet(body, buildSearch('020 7946 0958'), 60)).toContain('7946-0958');
  });

  test('the start of the text needs no ellipsis; no match in the body gives ""', () => {
    expect(snippet(body, buildSearch('lives'), 40)).toMatch(/^Lives in the Shire/);
    expect(snippet(body, buildSearch('Gandalf'))).toBe('');
    expect(snippet('', buildSearch('x'))).toBe('');
  });
});
