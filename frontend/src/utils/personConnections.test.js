import { describe, it, expect } from 'vitest';
import { connectionLinks, connectionCount, reverseConnectionType, isTwoWayByDefault } from './personConnections';

const people = [
  { id: 1, connections: [{ person_id: 2, type: 'friend' }, { person_id: 3, type: 'employer' }] },
  { id: 2, connections: [{ person_id: 1, type: 'friend' }] },
  { id: 3, connections: [] },
  { id: 4, connections: [{ person_id: 1, type: 'witness' }] },
];

describe('connectionLinks', () => {
  it('merges A -> B and B -> A into one two-way link', () => {
    const links = connectionLinks(1, people);
    expect(links.map(l => [l.personId, l.direction])).toEqual([[2, 'mutual'], [3, 'outgoing'], [4, 'incoming']]);
  });

  it('counts distinct connected people in either direction', () => {
    expect(connectionCount(1, people)).toBe(3);
    expect(connectionCount(2, people)).toBe(1);
    expect(connectionCount(3, people)).toBe(1);
  });

  it('accepts a person outside the list and unsaved connections', () => {
    expect(connectionLinks({ id: 9, connections: [{ person_id: 3 }] }, people).map(l => l.direction)).toEqual(['outgoing']);
    expect(connectionLinks(1, people, []).map(l => [l.personId, l.direction])).toEqual([[2, 'incoming'], [4, 'incoming']]);
  });
});

describe('reverse types', () => {
  it('swaps employer and employee, keeps symmetric types', () => {
    expect(reverseConnectionType('employer')).toBe('employee');
    expect(reverseConnectionType('friend')).toBe('friend');
    expect(isTwoWayByDefault('friend')).toBe(true);
    expect(isTwoWayByDefault('witness')).toBe(false);
  });
});
