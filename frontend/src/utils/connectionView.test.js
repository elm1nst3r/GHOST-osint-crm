import { describe, expect, test } from 'vitest';
import { connectedPeople, connectionCount, connectionSummary, linksBack } from './connectionView';
import { reverseConnectionType } from './connectionTypes';

const anna = {
  id: 1,
  connections: [{ person_id: 2, type: 'friend' }, { person_id: 3, type: 'employer', note: 'pays her' }],
  incoming_connections: [
    { person_id: 2, type: 'friend', first_name: 'Ben', last_name: 'B', project_id: 10 },
    { person_id: 4, type: 'family', first_name: 'Cara', patronymic: 'D', last_name: 'C', project_id: 20 },
  ],
};

describe('connections from both sides (#112)', () => {
  test('one entry per connected person, with the direction', () => {
    const list = connectedPeople(anna);
    expect(list.map((c) => [c.person_id, c.direction])).toEqual([[2, 'both'], [3, 'outgoing'], [4, 'incoming']]);
    expect(list.find((c) => c.person_id === 4)).toMatchObject({ name: 'Cara D C', project_id: 20, incoming: [{ type: 'family', note: '' }] });
  });

  test('counts connected people, not rows', () => {
    expect(connectionCount(anna)).toBe(3); // the old max(made, received) said 2
    expect(connectionSummary(connectedPeople(anna))).toEqual({ total: 3, both: 1, outgoing: 1, incoming: 1 });
    expect(connectionCount({ id: 9 })).toBe(0);
  });

  test('two connections to the same person count once; self-links are ignored', () => {
    const p = { id: 1, connections: [{ person_id: 2, type: 'friend' }, { person_id: 2, type: 'employer' }, { person_id: 1, type: 'other' }] };
    expect(connectedPeople(p)).toHaveLength(1);
    expect(connectedPeople(p)[0].outgoing).toHaveLength(2);
  });

  test('who links back; types read from the other side', () => {
    expect(linksBack(anna, 2)).toBe(true);
    expect(linksBack(anna, '4')).toBe(true);
    expect(linksBack(anna, 3)).toBe(false);
    expect(reverseConnectionType('employer')).toBe('employee');
    expect(reverseConnectionType('friend')).toBe('friend');
  });
});
