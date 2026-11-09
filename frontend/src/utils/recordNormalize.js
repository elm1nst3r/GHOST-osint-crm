// Saved records in reports (issue #96): provider data is any JSON, and records
// from aggregating providers rarely share a shape (one has FULL_NAME and
// PHONE, the next adds EMAIL, IP and a source database). For a report they
// are normalized:
//   - nested values become named fields: address.city, phones[1].number;
//     a list of plain values becomes one comma-separated field;
//   - fields that differ only in letter case are one field (EMAIL / email);
//   - records of the same tool and search line up under the union of their
//     fields, blank where a record doesn't have one.
// Pure: the generators render the result as tables or field lists.

// Up to this many columns (fields + "Found") a group is a table; wider ones
// are listed record by record, which stays readable in a Word page.
export const MAX_TABLE_COLUMNS = 8;

export function flattenRecord(value, prefix = '', out = []) {
  if (value === null || value === undefined) {
    if (prefix) out.push([prefix, '']);
    return out;
  }
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== 'object')) {
      out.push([prefix || 'value', value.filter((v) => v !== null && v !== undefined && v !== '').map(String).join(', ')]);
    } else {
      value.forEach((v, i) => flattenRecord(v, `${prefix || 'item'}[${i + 1}]`, out));
    }
    return out;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0 && prefix) out.push([prefix, '']);
    keys.forEach((k) => flattenRecord(value[k], prefix ? `${prefix}.${k}` : k, out));
    return out;
  }
  out.push([prefix || 'value', String(value)]);
  return out;
}

// → { columns: [field, …], rows: [{ values: { field: text }, record }] }
// Columns empty in every record go.
export function normalizeRecords(records) {
  // Fields are discovered oldest record first (by id), so the same records
  // always give the same columns and spellings, whatever order they come in.
  const columns = [];
  const label = new Map(); // lower-case field → the spelling first seen
  const discovery = records.map((r, i) => ({ r, i })).sort((a, b) => (a.r.id ?? a.i) - (b.r.id ?? b.i));
  for (const { r } of discovery) {
    for (const [path] of flattenRecord(r.data)) {
      const key = path.toLowerCase();
      if (!label.has(key)) { label.set(key, path); columns.push(path); }
    }
  }
  const rows = records.map((record) => {
    const values = {};
    for (const [path, v] of flattenRecord(record.data)) {
      const col = label.get(path.toLowerCase());
      if (v === '') continue;
      values[col] = values[col] && values[col] !== v ? `${values[col]}, ${v}` : v;
    }
    return { values, record };
  });
  // Fields most records share first (name, phone, …), rarer ones after;
  // ties keep the order they were discovered in.
  const present = (c) => rows.filter((r) => r.values[c]).length;
  const used = columns.filter((c) => present(c) > 0);
  const order = new Map(used.map((c, i) => [c, i]));
  used.sort((a, b) => present(b) - present(a) || order.get(a) - order.get(b));
  return { columns: used, rows };
}

const groupKey = (r) => `${r.integration_id || ''}\u0000${r.tool_name || ''}\u0000${r.operation || ''}`;

// The records of the report's subjects, per person, then per tool + search.
// → [{ person, groups: [{ tool, queries, layout, columns, rows }] }]
export function recordSections(subjects, records) {
  const byPerson = new Map();
  for (const r of records) {
    if (!byPerson.has(r.person_id)) byPerson.set(r.person_id, []);
    byPerson.get(r.person_id).push(r);
  }
  return subjects
    .filter((person) => byPerson.has(person.id))
    .map((person) => {
      const groups = new Map();
      for (const r of byPerson.get(person.id)) {
        const k = groupKey(r);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      return {
        person,
        groups: [...groups.values()].map((list) => {
          const { columns, rows } = normalizeRecords(list);
          return {
            tool: list[0].tool_name || null,
            queries: [...new Set(list.map((r) => r.query).filter(Boolean))],
            layout: columns.length + 1 <= MAX_TABLE_COLUMNS ? 'table' : 'list',
            columns,
            rows,
          };
        }),
      };
    });
}
