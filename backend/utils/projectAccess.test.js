jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
const { memberChangeError } = require('./projectAccess');

// Issue #95: owner > manager > investigator. A non-admin may only act on
// members ranked below themselves, grant roles below their own, and never
// change their own membership.
const owner = { isAdmin: false, actorId: 4, actorRole: 'owner' };
const manager = { isAdmin: false, actorId: 5, actorRole: 'manager' };
const admin = { isAdmin: true, actorId: 1, actorRole: null };

const add = (actor, newRole) => memberChangeError({ ...actor, targetUserId: 9, action: 'add', targetRole: null, newRole });
const update = (actor, targetRole, newRole, targetUserId = 9) =>
  memberChangeError({ ...actor, targetUserId, action: 'update', targetRole, newRole });
const remove = (actor, targetRole, targetUserId = 9) =>
  memberChangeError({ ...actor, targetUserId, action: 'remove', targetRole, newRole: null });

describe('memberChangeError — manager', () => {
  test('may add and remove investigators', () => {
    expect(add(manager, 'investigator')).toBeNull();
    expect(remove(manager, 'investigator')).toBeNull();
  });

  test('may not grant manager or owner', () => {
    expect(add(manager, 'manager')).toMatch(/manager role/);
    expect(add(manager, 'owner')).toMatch(/owner role/);
    expect(update(manager, 'investigator', 'manager')).toMatch(/manager role/);
  });

  test('may not change or remove managers or owners', () => {
    expect(update(manager, 'manager', 'investigator')).toMatch(/project manager/);
    expect(remove(manager, 'manager')).toMatch(/project manager/);
    expect(remove(manager, 'owner')).toMatch(/project owner/);
  });

  test('may not change or remove their own membership', () => {
    expect(remove(manager, 'manager', 5)).toMatch(/your own/);
    expect(update(manager, 'manager', 'investigator', '5')).toMatch(/your own/);
  });
});

describe('memberChangeError — owner', () => {
  test('may add, promote, demote and remove managers and investigators', () => {
    expect(add(owner, 'manager')).toBeNull();
    expect(add(owner, 'investigator')).toBeNull();
    expect(update(owner, 'investigator', 'manager')).toBeNull();
    expect(update(owner, 'manager', 'investigator')).toBeNull();
    expect(remove(owner, 'manager')).toBeNull();
    expect(remove(owner, 'investigator')).toBeNull();
  });

  test('may not appoint, change or remove owners', () => {
    expect(add(owner, 'owner')).toMatch(/owner role/);
    expect(update(owner, 'manager', 'owner')).toMatch(/owner role/);
    expect(update(owner, 'owner', 'manager')).toMatch(/project owner/);
    expect(remove(owner, 'owner')).toMatch(/project owner/);
  });

  test('may not change or remove their own membership', () => {
    expect(remove(owner, 'owner', 4)).toMatch(/your own/);
    expect(update(owner, 'owner', 'manager', 4)).toMatch(/your own/);
  });
});

describe('memberChangeError — admin and investigator', () => {
  test('admin may do anything, including to owners', () => {
    expect(add(admin, 'owner')).toBeNull();
    expect(update(admin, 'owner', 'investigator')).toBeNull();
    expect(remove(admin, 'owner')).toBeNull();
  });

  test('investigator (or no role) may do nothing', () => {
    const investigator = { isAdmin: false, actorId: 6, actorRole: 'investigator' };
    expect(add(investigator, 'investigator')).not.toBeNull();
    expect(add({ isAdmin: false, actorId: 7, actorRole: null }, 'investigator')).not.toBeNull();
  });
});
