// Import: links rewritten onto the new ids.
const { remapRelationship, relationshipKey } = require('./importRemap');

const maps = { person: { 1: 101, 2: 102 }, business: { 7: 207 }, crypto_wallet: { 9: 309 } };

describe('remapRelationship', () => {
  test('both ends in the file: new ids', () => {
    expect(remapRelationship({ source_type: 'person', source_id: 1, target_type: 'person', target_id: 2, relationship_type: 'family' }, maps))
      .toEqual({ ok: true, source_type: 'person', source_id: 101, target_type: 'person', target_id: 102 });
    expect(remapRelationship({ source_type: 'business', source_id: 7, target_type: 'crypto_wallet', target_id: 9 }, maps))
      .toMatchObject({ ok: true, source_id: 207, target_id: 309 });
  });

  test('an end outside the file or an unknown type is skipped with a reason', () => {
    expect(remapRelationship({ source_type: 'person', source_id: 1, target_type: 'person', target_id: 3 }, maps))
      .toEqual({ ok: false, reason: expect.stringMatching(/not in the file/) });
    expect(remapRelationship({ source_type: 'asset', source_id: 1, target_type: 'person', target_id: 1 }, maps).ok).toBe(false);
    expect(remapRelationship(null, maps).ok).toBe(false);
  });

  test('identical rows share a key', () => {
    const a = remapRelationship({ source_type: 'person', source_id: 1, target_type: 'person', target_id: 2 }, maps);
    expect(relationshipKey(a, 'friend', 'met in Bree')).toBe(relationshipKey({ ...a }, 'friend', 'met in Bree'));
    expect(relationshipKey(a, 'friend', null)).not.toBe(relationshipKey(a, 'family', null));
    expect(relationshipKey(a, 'friend', null)).not.toBe(relationshipKey(a, 'friend', 'x'));
  });
});
