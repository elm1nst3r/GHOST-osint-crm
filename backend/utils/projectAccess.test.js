jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
const { memberChangeError } = require('./projectAccess');

// Issue #95: a project manager may only manage investigators.
const manager = { isAdmin: false, actorId: 5 };
const admin = { isAdmin: true, actorId: 1 };

describe('memberChangeError', () => {
  test('manager may add an investigator', () => {
    expect(memberChangeError({ ...manager, targetUserId: 9, action: 'add', targetRole: null, newRole: 'investigator' })).toBeNull();
  });

  test('manager may not add a manager', () => {
    expect(memberChangeError({ ...manager, targetUserId: 9, action: 'add', targetRole: null, newRole: 'manager' })).toMatch(/administrator/);
  });

  test('manager may not promote an investigator to manager', () => {
    expect(memberChangeError({ ...manager, targetUserId: 9, action: 'update', targetRole: 'investigator', newRole: 'manager' })).toMatch(/administrator/);
  });

  test('manager may not demote or remove another manager', () => {
    expect(memberChangeError({ ...manager, targetUserId: 9, action: 'update', targetRole: 'manager', newRole: 'investigator' })).toMatch(/administrator/);
    expect(memberChangeError({ ...manager, targetUserId: 9, action: 'remove', targetRole: 'manager', newRole: null })).toMatch(/administrator/);
  });

  test('manager may remove an investigator', () => {
    expect(memberChangeError({ ...manager, targetUserId: 9, action: 'remove', targetRole: 'investigator', newRole: null })).toBeNull();
  });

  test('manager may not change or remove their own membership', () => {
    expect(memberChangeError({ ...manager, targetUserId: 5, action: 'remove', targetRole: 'manager', newRole: null })).toMatch(/your own/);
    expect(memberChangeError({ ...manager, targetUserId: '5', action: 'update', targetRole: 'manager', newRole: 'investigator' })).toMatch(/your own/);
  });

  test('admin may do anything', () => {
    expect(memberChangeError({ ...admin, targetUserId: 9, action: 'add', targetRole: null, newRole: 'manager' })).toBeNull();
    expect(memberChangeError({ ...admin, targetUserId: 9, action: 'remove', targetRole: 'manager', newRole: null })).toBeNull();
    expect(memberChangeError({ ...admin, targetUserId: 9, action: 'update', targetRole: 'manager', newRole: 'investigator' })).toBeNull();
  });
});
