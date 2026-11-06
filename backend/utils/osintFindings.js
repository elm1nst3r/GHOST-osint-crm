// Merging tool findings into a person's OSINT data (issues #96).
//
// An entry is one value of one type ("Email: vovk@yandex.ru"). A finding is
// where a tool found it: tool, integration, search, query, date, and how many
// times the value occurred in that search's results. One entry can carry
// several findings, so the same email found by two tools, or found again
// later, adds to the entry instead of being dropped:
//
//   { type, value, notes, verified, source, sources: [finding, …] }
//
// `source` stays the first finding, as before, so everything that reads it
// (exports, the MCP server, older code) keeps working; `sources` holds all
// of them. Entries typed in by hand have no `source`; a tool finding the same
// value is recorded in `sources` only and doesn't mark the entry unverified.

const MAX_SOURCES = 50;

const norm = (s) => String(s ?? '').trim().toLowerCase();
const entryKey = (e) => `${norm(e.type)}\u0000${norm(e.value)}`;

// The same search: same integration, operation and query (and, for a value
// taken from a saved record, the same record). Running it again refreshes its
// count and date instead of adding another finding.
const sameSearch = (a, b) => a.integration_id === b.integration_id
  && a.operation === b.operation
  && norm(a.query) === norm(b.query)
  && (a.record_id ?? null) === (b.record_id ?? null);

const findingsOf = (entry) => {
  if (Array.isArray(entry.sources)) return entry.sources;
  return entry.source ? [entry.source] : [];
};

/**
 * @param {object[]} current  the person's osint_data
 * @param {object[]} entries  [{ type, value, notes?, source? }] to add
 * @param {number|null} userId who adds them
 * @returns {{ osintData: object[], added: number, updated: number, unchanged: number }}
 */
function mergeOsintFindings(current, entries, userId = null) {
  const list = (Array.isArray(current) ? current : []).map((e) => ({ ...e }));
  const index = new Map(list.map((e, i) => [entryKey(e), i]));
  let added = 0; let updated = 0; let unchanged = 0;

  for (const e of entries) {
    const finding = e.source ? { ...e.source, added_by: userId } : null;
    const key = entryKey(e);
    const i = index.get(key);

    if (i === undefined) {
      index.set(key, list.length);
      list.push({
        type: e.type.trim(),
        value: e.value.trim(),
        notes: e.notes || '',
        ...(finding ? { source: finding, sources: [finding], verified: false } : {}),
      });
      added += 1;
      continue;
    }

    if (!finding) { unchanged += 1; continue; }

    const target = list[i];
    const sources = findingsOf(target).map((s) => ({ ...s }));
    const j = sources.findIndex((s) => sameSearch(s, finding));
    if (j >= 0) {
      const s = sources[j];
      if (s.occurrences === finding.occurrences && s.retrieved_at === finding.retrieved_at
        && JSON.stringify(s.record_sources) === JSON.stringify(finding.record_sources)) { unchanged += 1; continue; }
      sources[j] = { ...s, occurrences: finding.occurrences, retrieved_at: finding.retrieved_at, record_sources: finding.record_sources };
      if (sources[j].record_sources === undefined) delete sources[j].record_sources;
    } else {
      sources.push(finding);
      if (sources.length > MAX_SOURCES) sources.splice(1, sources.length - MAX_SOURCES); // keep the first, drop the oldest after it
    }
    const next = { ...target, sources };
    // Keep `source` (the first finding) in step when that same search ran again.
    if (target.source && sameSearch(target.source, finding)) next.source = sources.find((s) => sameSearch(s, finding));
    list[i] = next;
    updated += 1;
  }

  return { osintData: list, added, updated, unchanged };
}

module.exports = { mergeOsintFindings, entryKey, MAX_SOURCES };
