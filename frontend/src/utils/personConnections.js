// Person-to-person connections are stored one-way (A -> B lives on A). These
// helpers give every view the same reading of them: one entry per connected
// person, marked outgoing, incoming or two-way.

// The type B gets when "two-way" adds the connection back from B to A.
const REVERSE_TYPE = { employer: 'employee', employee: 'employer' };

// Types that read the same from either side (or have a clear opposite above)
// start with "two-way" ticked; for the rest (witness, victim, ...) the other
// person's side is a different statement, so it is left to the user.
const TWO_WAY_BY_DEFAULT = new Set(['family', 'friend', 'enemy', 'associate', 'other', 'employer', 'employee']);

export const reverseConnectionType = (type) => REVERSE_TYPE[type] || type;

export const isTwoWayByDefault = (type) => TWO_WAY_BY_DEFAULT.has(type);

const connectionsOf = (person) => (Array.isArray(person?.connections) ? person.connections : []);

// [{ personId, outgoing, incoming, direction }] -- outgoing/incoming are the
// stored connection entries (or null), direction is 'mutual' when both exist.
// `subject` is the person, or their id when they are in `people`; the
// person's own `connections` may be passed to read unsaved form edits.
export function connectionLinks(subject, people, ownConnections) {
  const personId = typeof subject === 'object' && subject ? subject.id : subject;
  const own = ownConnections
    ?? connectionsOf(typeof subject === 'object' ? subject : people.find((p) => p.id === personId));
  const links = new Map();
  const entry = (id) => {
    if (!links.has(id)) links.set(id, { personId: id, outgoing: null, incoming: null });
    return links.get(id);
  };
  own.forEach((c) => {
    if (c.person_id != null && c.person_id !== personId) entry(c.person_id).outgoing ??= c;
  });
  people.forEach((p) => {
    if (p.id === personId) return;
    const back = connectionsOf(p).find((c) => c.person_id === personId);
    if (back) entry(p.id).incoming = back;
  });
  return [...links.values()].map((l) => ({
    ...l,
    direction: l.outgoing && l.incoming ? 'mutual' : l.outgoing ? 'outgoing' : 'incoming',
  }));
}

// Number of distinct people connected to this one, in either direction.
export const connectionCount = (personId, people) => connectionLinks(personId, people).length;
