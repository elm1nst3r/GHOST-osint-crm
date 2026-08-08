import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { formatPersonName } from './personName';

// Shared helpers

export const getFullName = (person) => formatPersonName(person, 'Unknown');

// A person-profile report is about one subject, but the surrounding roster is
// still needed to resolve connection targets by id — so narrow the *subjects*
// rather than the people array itself (issue #63).
export const subjectsOf = (people, options, selectedPerson) =>
  options.reportType === 'person-profile' && selectedPerson
    ? people.filter(p => p.id === selectedPerson.id)
    : people;

export const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// ── Report type → effective options ───────────────────────────────────────

const REPORT_TYPE_OVERRIDES = {
  // Executive Summary: high-level only — no detailed profiles or connections
  summary: {
    includeSummary: true,
    includePeople: false,
    includeConnections: false,
    includeLocations: false,
    includeOsintData: false,
    includeBusinesses: false,
    includeTodos: true,
    includeAuditLog: false,
    includeCharts: true,
  },
  // Person Profile: deep dive on one person — skip broad overviews and tasks
  'person-profile': {
    includeSummary: false,
    includePeople: true,
    includeConnections: true,
    includeLocations: true,
    includeOsintData: true,
    includeBusinesses: true,
    includeTodos: false,
    includeAuditLog: false,
    includeCharts: false,
  },
  // Comprehensive: respect user-selected checkboxes as-is
  comprehensive: null,
};

export const resolveOptions = (options) => {
  const overrides = REPORT_TYPE_OVERRIDES[options.reportType];
  return overrides ? { ...options, ...overrides } : options;
};

// ── Markdown generator ──────────────────────────────────────────────────────

export const generateMarkdown = (data, options) => {
  options = resolveOptions(options);
  const { people, businesses, locations, todos, selectedCase, selectedPerson } = data;
  const subjects = subjectsOf(people, options, selectedPerson);
  const totalConnections = subjects.reduce((sum, p) => sum + (p.connections?.length || 0), 0);
  const reportTitle = selectedCase ? selectedCase.case_name
    : selectedPerson ? getFullName(selectedPerson) : 'General Report';

  let md = '';

  md += `# INVESTIGATION REPORT\n\n`;
  md += `## ${reportTitle}\n\n`;
  md += `**Generated:** ${formatDateTime(new Date())}  \n`;
  md += `**Report ID:** RPT-${Date.now()}  \n`;
  md += `**Classification:** CONFIDENTIAL\n\n---\n\n`;

  // Summary statistics
  const activeTasks = todos.filter(t => t.status !== 'done').length;
  md += `## SUMMARY STATISTICS\n\n`;
  md += `| Metric | Count |\n|--------|-------|\n`;
  md += `| People | ${subjects.length} |\n`;
  md += `| Businesses | ${businesses.length} |\n`;
  md += `| Locations | ${locations.length} |\n`;
  md += `| Connections | ${totalConnections} |\n`;
  md += `| Active Tasks | ${activeTasks} |\n\n`;

  // Executive summary
  if (options.includeSummary) {
    md += `## EXECUTIVE SUMMARY\n\n`;
    if (selectedCase) {
      md += `This report covers the investigation case **"${selectedCase.case_name}"**.  \n`;
      md += `**Status:** ${selectedCase.status || 'Active'}  \n\n`;
      md += `The case involves ${people.length} individuals with ${totalConnections} documented connections.\n\n`;
    } else {
      md += `This comprehensive report includes ${subjects.length} individuals and ${totalConnections} documented relationships.\n\n`;
    }
    md += `### Key Insights\n\n`;
    if (people.length > 0) {
      const categories = [...new Set(subjects.map(p => p.category).filter(Boolean))];
      md += `- **${categories.length}** different person categories tracked\n`;
    }
    if (totalConnections > 0) {
      md += `- **${(totalConnections / people.length).toFixed(1)}** average connections per person\n`;
    }
    if (businesses.length > 0) {
      md += `- **${businesses.length}** business entities in scope\n`;
    }
    md += `\n`;
  }

  // People profiles
  if (options.includePeople && subjects.length > 0) {
    md += `## PEOPLE PROFILES\n\n### Overview\n\n`;
    md += `| Name | Category | Status | Connections | Case |\n`;
    md += `|------|----------|--------|-------------|------|\n`;
    subjects.forEach(p => {
      md += `| ${getFullName(p)} | ${p.category || 'N/A'} | ${p.status || 'N/A'} | ${p.connections?.length || 0} | ${p.case_name || 'N/A'} |\n`;
    });
    md += `\n### Detailed Profiles\n\n`;
    subjects.forEach((p, i) => {
      md += `#### ${i + 1}. ${getFullName(p)}\n\n`;
      md += `**Basic Information:**\n`;
      md += `- **Category:** ${p.category || 'N/A'}\n`;
      md += `- **Status:** ${p.status || 'N/A'}\n`;
      md += `- **Case:** ${p.case_name || 'N/A'}\n`;
      if (p.date_of_birth) md += `- **Date of Birth:** ${formatDate(p.date_of_birth)}\n`;
      if (p.aliases?.length > 0) md += `- **Known Aliases:** ${p.aliases.join(', ')}\n`;
      md += `- **Connections:** ${p.connections?.length || 0}\n\n`;
      if (p.notes) md += `**Notes:**\n> ${p.notes}\n\n`;
    });
  }

  // Business profiles
  if (options.includeBusinesses !== false && businesses.length > 0) {
    md += `## BUSINESS PROFILES\n\n`;
    md += `| Name | Industry | Address | Website |\n|------|----------|---------|----------|\n`;
    businesses.forEach(b => {
      md += `| ${b.name || 'Unknown'} | ${b.industry || 'N/A'} | ${b.address || 'N/A'} | ${b.website || 'N/A'} |\n`;
    });
    md += `\n### Detailed Business Information\n\n`;
    businesses.forEach((b, i) => {
      md += `#### ${i + 1}. ${b.name || 'Unknown Business'}\n\n`;
      if (b.industry) md += `**Industry:** ${b.industry}  \n`;
      if (b.address) md += `**Address:** ${b.address}  \n`;
      if (b.website) md += `**Website:** [${b.website}](${b.website})  \n`;
      if (b.description) md += `\n**Description:**\n${b.description}\n\n`;
      else md += `\n`;
    });
  }

  // Connections analysis
  if (options.includeConnections && totalConnections > 0) {
    md += `## CONNECTIONS ANALYSIS\n\n`;
    md += `**Total Documented Connections:** ${totalConnections}\n\n`;
    md += `### Connection Details\n\n`;
    md += `| From | To | Relationship | Notes |\n|------|----|--------------|----- |\n`;
    subjects.forEach(p => {
      p.connections?.forEach(conn => {
        const target = people.find(t => t.id === conn.person_id);
        if (target) {
          md += `| ${getFullName(p)} | ${getFullName(target)} | ${conn.type || 'Unknown'} | ${conn.note || ''} |\n`;
        }
      });
    });
    md += `\n`;
  }

  // Location analysis
  if (options.includeLocations && locations.length > 0) {
    md += `## LOCATION ANALYSIS\n\n`;
    md += `**Total Locations Tracked:** ${locations.length}\n\n`;
    const byType = {};
    locations.forEach(loc => {
      const t = loc.type || 'Unknown';
      (byType[t] = byType[t] || []).push(loc);
    });
    Object.entries(byType).forEach(([type, locs]) => {
      md += `### ${type} (${locs.length} locations)\n\n`;
      md += `| Location | Coordinates | Details |\n|----------|-------------|----------|\n`;
      locs.slice(0, 10).forEach(loc => {
        const name = loc.address || loc.name || 'Unknown Location';
        const coords = loc.coordinates ? `${loc.coordinates.lat}, ${loc.coordinates.lng}` : 'N/A';
        md += `| ${name} | ${coords} | ${loc.description || ''} |\n`;
      });
      if (locs.length > 10) md += `\n*... and ${locs.length - 10} more locations*\n`;
      md += `\n`;
    });
  }

  // Tasks
  if (options.includeTodos && todos.length > 0) {
    const open = todos.filter(t => t.status === 'open').length;
    const inProg = todos.filter(t => t.status === 'in_progress').length;
    const done = todos.filter(t => t.status === 'done').length;
    md += `## INVESTIGATION TASKS\n\n`;
    md += `**Task Summary:** Open: ${open} | In Progress: ${inProg} | Completed: ${done}\n\n`;
    [['open', '[open]'], ['in_progress', '[in progress]'], ['done', '[done]']].forEach(([status, label]) => {
      const tasks = todos.filter(t => t.status === status);
      if (!tasks.length) return;
      md += `### ${label} ${status.replace('_', ' ').toUpperCase()} (${tasks.length})\n\n`;
      tasks.forEach((todo, i) => {
        md += `${i + 1}. **${todo.text}**  \n   *Created: ${formatDate(todo.created_at)}*\n\n`;
      });
    });
  }

  // Statistical analysis
  if (options.includeCharts) {
    md += `## STATISTICAL ANALYSIS\n\n`;
    const byCategory = {};
    people.forEach(p => {
      const c = p.category || 'Unknown';
      byCategory[c] = (byCategory[c] || 0) + 1;
    });
    md += `### People by Category\n\n| Category | Count | Percentage |\n|----------|-------|------------|\n`;
    Object.entries(byCategory).forEach(([cat, count]) => {
      md += `| ${cat} | ${count} | ${((count / people.length) * 100).toFixed(1)}% |\n`;
    });
    md += `\n`;

    if (todos.length > 0) {
      const open = todos.filter(t => t.status === 'open').length;
      const inProg = todos.filter(t => t.status === 'in_progress').length;
      const done = todos.filter(t => t.status === 'done').length;
      const rate = ((done / todos.length) * 100).toFixed(1);
      md += `### Task Progress\n\n**Overall Completion Rate:** ${rate}%\n\n`;
      md += `\`\`\`\nTask Distribution:\n`;
      md += `├─ Open: ${open} (${((open / todos.length) * 100).toFixed(1)}%)\n`;
      md += `├─ In Progress: ${inProg} (${((inProg / todos.length) * 100).toFixed(1)}%)\n`;
      md += `└─ Completed: ${done} (${((done / todos.length) * 100).toFixed(1)}%)\n\`\`\`\n\n`;
    }

    if (totalConnections > 0) {
      md += `### Network Analysis\n\n`;
      md += `**Average connections per person:** ${(totalConnections / people.length).toFixed(2)}\n\n`;
      md += `**Most Connected Individuals:**\n\n`;
      people
        .map(p => ({ name: getFullName(p), connections: p.connections?.length || 0 }))
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 5)
        .forEach((p, i) => { md += `${i + 1}. **${p.name}** - ${p.connections} connections\n`; });
      md += `\n`;
    }
  }

  md += `---\n\n## REPORT INFORMATION\n\n`;
  md += `**Generated By:** GHOST OSINT Investigation CRM  \n`;
  md += `**Generation Date:** ${formatDateTime(new Date())}  \n`;
  md += `**Report ID:** RPT-${Date.now()}  \n`;
  md += `**Classification:** CONFIDENTIAL\n\n`;
  md += `> This report contains confidential information and is intended solely for authorized personnel.\n\n---\n*End of Report*`;

  return md;
};

export const downloadMarkdown = (data, options) => {
  const md = generateMarkdown(data, options);
  const blob = new Blob([md], { type: 'text/markdown' });
  saveAs(blob, `investigation-report-${Date.now()}.md`);
};

// ── Word generator ──────────────────────────────────────────────────────────

const p = (text, heading, alignment) => new Paragraph({
  text,
  ...(heading && { heading }),
  ...(alignment && { alignment })
});
const blank = () => p('');

export const downloadWord = async (data, options) => {
  options = resolveOptions(options);
  const { people, businesses, locations, todos, selectedCase, selectedPerson } = data;
  const subjects = subjectsOf(people, options, selectedPerson);
  const totalConnections = subjects.reduce((sum, p) => sum + (p.connections?.length || 0), 0);
  const reportTitle = selectedCase ? selectedCase.case_name
    : selectedPerson ? getFullName(selectedPerson) : 'General Report';

  const children = [];

  children.push(p('INVESTIGATION REPORT', HeadingLevel.TITLE, AlignmentType.CENTER));
  children.push(p(reportTitle, HeadingLevel.HEADING_1, AlignmentType.CENTER));
  children.push(p(`Generated: ${formatDateTime(new Date())}`, null, AlignmentType.CENTER));
  children.push(blank());

  children.push(p('SUMMARY STATISTICS', HeadingLevel.HEADING_2, AlignmentType.CENTER));
  children.push(p(`Total People: ${people.length}`));
  children.push(p(`Total Businesses: ${businesses.length}`));
  children.push(p(`Total Locations: ${locations.length}`));
  children.push(p(`Total Connections: ${totalConnections}`));
  children.push(p(`Active Tasks: ${todos.filter(t => t.status !== 'done').length}`));
  children.push(blank());

  if (options.includeSummary) {
    children.push(p('Executive Summary', HeadingLevel.HEADING_1));
    if (selectedCase) {
      children.push(p(`This report covers the investigation case "${selectedCase.case_name}".`));
      children.push(p(`Status: ${selectedCase.status || 'Active'}`));
      children.push(p(`The case involves ${people.length} individuals with ${totalConnections} documented connections.`));
    } else {
      children.push(p(`This comprehensive report includes ${subjects.length} individuals and ${totalConnections} documented relationships.`));
    }
    children.push(blank());
  }

  if (options.includePeople && subjects.length > 0) {
    children.push(p('People Profiles', HeadingLevel.HEADING_1));
    subjects.forEach((person, i) => {
      children.push(p(`${i + 1}. ${getFullName(person)}`, HeadingLevel.HEADING_2));
      children.push(p(`Category: ${person.category || 'N/A'}`));
      children.push(p(`Status: ${person.status || 'N/A'}`));
      children.push(p(`Case: ${person.case_name || 'N/A'}`));
      if (person.date_of_birth) children.push(p(`Date of Birth: ${formatDate(person.date_of_birth)}`));
      if (person.aliases?.length > 0) children.push(p(`Known Aliases: ${person.aliases.join(', ')}`));
      children.push(p(`Connections: ${person.connections?.length || 0}`));
      if (person.notes) children.push(p(`Notes: ${person.notes}`));
      children.push(blank());
    });
  }

  // The .docx export had no connections section at all, so `includeConnections`
  // was silently ignored here — and person-profile turns it on by default.
  if (options.includeConnections && totalConnections > 0) {
    children.push(p('Connections Analysis', HeadingLevel.HEADING_1));
    children.push(p(`Total Documented Connections: ${totalConnections}`));
    children.push(blank());
    subjects.forEach(person => {
      person.connections?.forEach(conn => {
        const target = people.find(t => t.id === conn.person_id);
        if (!target) return;
        const note = conn.note ? ` — ${conn.note}` : '';
        children.push(p(`${getFullName(person)} → ${getFullName(target)} (${conn.type || 'Unknown'})${note}`));
      });
    });
    children.push(blank());
  }

  if (options.includeBusinesses !== false && businesses.length > 0) {
    children.push(p('Business Profiles', HeadingLevel.HEADING_1));
    businesses.forEach((b, i) => {
      children.push(p(`${i + 1}. ${b.name || 'Unknown Business'}`, HeadingLevel.HEADING_2));
      if (b.industry) children.push(p(`Industry: ${b.industry}`));
      if (b.address) children.push(p(`Address: ${b.address}`));
      if (b.website) children.push(p(`Website: ${b.website}`));
      if (b.description) children.push(p(b.description));
      children.push(blank());
    });
  }

  if (options.includeLocations && locations.length > 0) {
    children.push(p('Location Analysis', HeadingLevel.HEADING_1));
    children.push(p(`Total Locations Tracked: ${locations.length}`));
    const byType = {};
    locations.forEach(loc => {
      const t = loc.type || 'Unknown';
      (byType[t] = byType[t] || []).push(loc);
    });
    Object.entries(byType).forEach(([type, locs]) => {
      children.push(p(`${type} (${locs.length})`, HeadingLevel.HEADING_2));
      locs.slice(0, 10).forEach(loc => {
        const name = loc.address || loc.name || 'Unknown';
        const coords = loc.coordinates ? `${loc.coordinates.lat}, ${loc.coordinates.lng}` : 'N/A';
        children.push(p(`${name} — ${coords}`));
      });
      if (locs.length > 10) children.push(p(`...and ${locs.length - 10} more`));
      children.push(blank());
    });
  }

  if (options.includeTodos && todos.length > 0) {
    const open = todos.filter(t => t.status === 'open').length;
    const inProg = todos.filter(t => t.status === 'in_progress').length;
    const done = todos.filter(t => t.status === 'done').length;
    children.push(p('Investigation Tasks', HeadingLevel.HEADING_1));
    children.push(p(`Open: ${open} | In Progress: ${inProg} | Completed: ${done}`));
    todos.forEach((todo, i) => {
      children.push(p(`${i + 1}. ${todo.text}`));
      children.push(p(`   Status: ${(todo.status || 'unknown').replace('_', ' ').toUpperCase()} | Created: ${formatDate(todo.created_at)}`));
    });
    children.push(blank());
  }

  if (options.includeCharts) {
    children.push(p('Statistical Analysis', HeadingLevel.HEADING_1));
    const byCategory = {};
    people.forEach(p => { const c = p.category || 'Unknown'; byCategory[c] = (byCategory[c] || 0) + 1; });
    children.push(p('People by Category:', HeadingLevel.HEADING_2));
    Object.entries(byCategory).forEach(([cat, count]) => {
      children.push(p(`   ${cat}: ${count} (${((count / people.length) * 100).toFixed(1)}%)`));
    });
    children.push(blank());

    if (todos.length > 0) {
      const done = todos.filter(t => t.status === 'done').length;
      children.push(p('Task Progress:', HeadingLevel.HEADING_2));
      children.push(p(`Overall Completion Rate: ${((done / todos.length) * 100).toFixed(1)}%`));
      children.push(blank());
    }

    if (totalConnections > 0) {
      children.push(p('Network Analysis:', HeadingLevel.HEADING_2));
      children.push(p(`Average connections per person: ${(totalConnections / people.length).toFixed(2)}`));
      people
        .map(p => ({ name: getFullName(p), connections: p.connections?.length || 0 }))
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 5)
        .forEach((person, i) => {
          children.push(p(`   ${i + 1}. ${person.name}: ${person.connections} connections`));
        });
      children.push(blank());
    }
  }

  children.push(p('Report Information', HeadingLevel.HEADING_1));
  children.push(p('Generated By: GHOST OSINT Investigation CRM'));
  children.push(p(`Generation Date: ${formatDateTime(new Date())}`));
  children.push(p(`Report ID: RPT-${Date.now()}`));
  children.push(p('Classification: CONFIDENTIAL'));
  children.push(p('This report contains confidential information and is intended solely for authorized personnel.'));
  children.push(p('End of Report', null, AlignmentType.CENTER));

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `investigation-report-${Date.now()}.docx`);
};

// ── Entity Ledger report (issue #43) ────────────────────────────────────────

const money = (v, currency) => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  const f = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${f} ${currency}` : f;
};
const pretty = (t) => (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const generateLedgerMarkdown = (ledger) => {
  const { entity, entries, summary } = ledger;
  let md = '';
  md += `# ENTITY LEDGER\n\n`;
  md += `## ${entity.label || 'Entity'} (${entity.type})\n\n`;
  md += `**Generated:** ${formatDateTime(new Date())}  \n`;
  md += `**Classification:** CONFIDENTIAL\n\n---\n\n`;

  md += `## SUMMARY\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Value In | ${summary.value_in != null ? money(summary.value_in) : 'mixed currencies'} |\n`;
  md += `| Value Out | ${summary.value_out != null ? money(summary.value_out) : 'mixed currencies'} |\n`;
  md += `| Net | ${summary.net != null ? money(summary.net) : 'see per-currency'} |\n`;
  md += `| Distinct Counterparties | ${summary.distinct_counterparties} |\n\n`;

  if (summary.by_currency && summary.by_currency.length) {
    md += `### Per Currency\n\n| Currency | In | Out | Net |\n|----------|----|----|-----|\n`;
    summary.by_currency.forEach(c => {
      md += `| ${c.currency || 'unspecified'} | ${money(c.value_in)} | ${money(c.value_out)} | ${money(c.net)} |\n`;
    });
    md += `\n`;
  }

  if (summary.count_by_type && Object.keys(summary.count_by_type).length) {
    md += `### Count by Type\n\n`;
    Object.entries(summary.count_by_type).forEach(([t, c]) => { md += `- **${pretty(t)}:** ${c}\n`; });
    md += `\n`;
  }

  if (summary.assets_currently_held && summary.assets_currently_held.length) {
    md += `### Currently Held Assets\n\n`;
    summary.assets_currently_held.forEach(a => { md += `- ${a.name}${a.since ? ` (since ${formatDate(a.since)})` : ''}\n`; });
    md += `\n`;
  }

  md += `## LEDGER ENTRIES\n\n`;
  md += `| Date | Type | Role | Counterparty | Subject | Direction | Value |\n`;
  md += `|------|------|------|--------------|---------|-----------|-------|\n`;
  entries.forEach(e => {
    md += `| ${formatDate(e.occurred_on)} | ${pretty(e.transaction_type)} | ${pretty(e.role)} | ${e.counterparty?.label || '—'} | ${e.subject?.label || '—'} | ${e.value_direction} | ${e.value != null ? money(e.value, e.currency) : '—'} |\n`;
  });
  md += `\n---\n*End of Ledger Report*`;
  return md;
};

export const downloadLedgerMarkdown = (ledger) => {
  const md = generateLedgerMarkdown(ledger);
  const blob = new Blob([md], { type: 'text/markdown' });
  saveAs(blob, `entity-ledger-${ledger.entity?.type || 'entity'}-${ledger.entity?.id || ''}-${Date.now()}.md`);
};

export const downloadLedgerWord = async (ledger) => {
  const { entity, entries, summary } = ledger;
  const children = [];
  children.push(p('ENTITY LEDGER', HeadingLevel.TITLE, AlignmentType.CENTER));
  children.push(p(`${entity.label || 'Entity'} (${entity.type})`, HeadingLevel.HEADING_1, AlignmentType.CENTER));
  children.push(p(`Generated: ${formatDateTime(new Date())}`, null, AlignmentType.CENTER));
  children.push(blank());

  children.push(p('Summary', HeadingLevel.HEADING_1));
  children.push(p(`Value In: ${summary.value_in != null ? money(summary.value_in) : 'mixed currencies'}`));
  children.push(p(`Value Out: ${summary.value_out != null ? money(summary.value_out) : 'mixed currencies'}`));
  children.push(p(`Net: ${summary.net != null ? money(summary.net) : 'see per-currency'}`));
  children.push(p(`Distinct Counterparties: ${summary.distinct_counterparties}`));
  children.push(blank());

  if (summary.assets_currently_held && summary.assets_currently_held.length) {
    children.push(p('Currently Held Assets', HeadingLevel.HEADING_2));
    summary.assets_currently_held.forEach(a => children.push(p(`${a.name}${a.since ? ` (since ${formatDate(a.since)})` : ''}`)));
    children.push(blank());
  }

  children.push(p('Ledger Entries', HeadingLevel.HEADING_1));
  entries.forEach(e => {
    children.push(p(`${formatDate(e.occurred_on)} — ${pretty(e.transaction_type)} (${pretty(e.role)})`, HeadingLevel.HEADING_2));
    children.push(p(`Counterparty: ${e.counterparty?.label || '—'} | Subject: ${e.subject?.label || '—'}`));
    children.push(p(`Direction: ${e.value_direction} | Value: ${e.value != null ? money(e.value, e.currency) : '—'}`));
    children.push(blank());
  });

  children.push(p('Classification: CONFIDENTIAL', null, AlignmentType.CENTER));
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `entity-ledger-${entity?.type || 'entity'}-${entity?.id || ''}-${Date.now()}.docx`);
};
