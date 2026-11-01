const { visibilityCondition, canManageTool, allowedVisibilities } = require('./toolAccess');

const admin = { userId: 1, isAdmin: true };
const user = { userId: 7, isAdmin: false };

describe('canManageTool', () => {
  test('admins manage everything', () => {
    expect(canManageTool(admin, { owner_user_id: null })).toBe(true);
    expect(canManageTool(admin, { owner_user_id: 7 })).toBe(true);
  });
  test('users manage only their own tools', () => {
    expect(canManageTool(user, { owner_user_id: 7 })).toBe(true);
    expect(canManageTool(user, { owner_user_id: '7' })).toBe(true);
    expect(canManageTool(user, { owner_user_id: 8 })).toBe(false);
    expect(canManageTool(user, { owner_user_id: null })).toBe(false);
  });
});

test('allowedVisibilities: central tools are never private, user tools never "all"', () => {
  expect(allowedVisibilities({ owner_user_id: null })).toEqual(['all', 'projects']);
  expect(allowedVisibilities({ owner_user_id: 7 })).toEqual(['private', 'projects']);
});

describe('visibilityCondition', () => {
  test('admin full list is unfiltered and takes no params', () => {
    const params = [];
    expect(visibilityCondition(admin, { all: true }, params)).toBe('TRUE');
    expect(params).toEqual([]);
  });

  test('non-admins only see enabled tools (or their own) and need membership for project tools', () => {
    const params = [];
    const sql = visibilityCondition(user, {}, params);
    expect(params).toEqual([7]);
    expect(sql).toMatch(/t\.enabled OR t\.owner_user_id = \$1/);
    expect(sql).toMatch(/project_members pm/);
    expect(sql).toMatch(/t\.owner_user_id IS NULL AND t\.visibility = 'all'/);
  });

  test('a project context narrows project tools to that project', () => {
    const params = [99];
    const sql = visibilityCondition(user, { projectId: 5 }, params);
    expect(params).toEqual([99, 7, 5]);
    expect(sql).toMatch(/tp\.project_id = \$3/);
    expect(sql).not.toMatch(/project_members/);
  });

  test('other users\' private tools never match: visibility "private" only through ownership', () => {
    const sql = visibilityCondition(user, {}, []);
    expect(sql).not.toMatch(/visibility = 'private'/);
  });
});
