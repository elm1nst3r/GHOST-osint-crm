// A person's connections seen from their side (#112). A connection is stored
// once, on the person who made it: `connections` are the ones this person
// made, `incoming_connections` (from the API) the ones others made to them.
// Merged per connected person, with the direction:
//   both     — each has a connection to the other (two-way)
//   outgoing — only this person connects to them
//   incoming — only they connect to this person
// Counting connected people this way fixes the old count, which took the
// larger of "made" and "received" (A → B plus B → A counted once, but A → B
// plus C → A counted once too) and only saw people loaded in the browser.

const nameOf = (p) => [p.first_name, p.patronymic, p.last_name].filter(Boolean).join(' ');

export function connectedPeople(person) {
  const byId = new Map();
  const entry = (id) => {
    if (!byId.has(id)) byId.set(id, { person_id: id, outgoing: [], incoming: [], name: null, project_id: null });
    return byId.get(id);
  };
  for (const c of person?.connections || []) {
    if (c?.person_id == null || c.person_id === person.id) continue;
    entry(c.person_id).outgoing.push({ type: c.type, note: c.note || '' });
  }
  for (const c of person?.incoming_connections || []) {
    if (c?.person_id == null || c.person_id === person.id) continue;
    const e = entry(c.person_id);
    e.incoming.push({ type: c.type, note: c.note || '' });
    e.name = nameOf(c) || null;
    e.project_id = c.project_id ?? null;
  }
  return [...byId.values()].map((e) => ({
    ...e,
    direction: e.outgoing.length && e.incoming.length ? 'both' : e.outgoing.length ? 'outgoing' : 'incoming',
  }));
}

export const connectionCount = (person) => connectedPeople(person).length;

export function connectionSummary(list) {
  return {
    total: list.length,
    both: list.filter((c) => c.direction === 'both').length,
    outgoing: list.filter((c) => c.direction === 'outgoing').length,
    incoming: list.filter((c) => c.direction === 'incoming').length,
  };
}

// Does `other` already have a connection to this person? (Then a two-way
// tick has nothing to add.)
export const linksBack = (person, otherId) =>
  (person?.incoming_connections || []).some((c) => c.person_id === Number(otherId));
