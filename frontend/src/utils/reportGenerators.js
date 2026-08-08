import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import i18n from '../i18n';
import { formatPersonName } from './personName';

// Report *output* was the last thing still hardcoded in English after the i18n
// pass (issue #63 — hunterghoul1 offered to translate it). These are plain
// functions rather than components, so they read i18n directly instead of
// taking a `t` prop; personName.js does the same. Markdown syntax stays in the
// code, never inside a catalog string, so translators only ever see prose.
const t = (key, opts) => i18n.t(`report.${key}`, opts);
const NA = () => t('notAvailable');

// Shared helpers

export const getFullName = (person) => formatPersonName(person, t('unknown'));

// A person-profile report is about one subject, but the surrounding roster is
// still needed to resolve connection targets by id — so narrow the *subjects*
// rather than the people array itself (issue #63).
export const subjectsOf = (people, options, selectedPerson) =>
  options.reportType === 'person-profile' && selectedPerson
    ? people.filter(p => p.id === selectedPerson.id)
    : people;

export const formatDate = (date) => {
  if (!date) return NA();
  // Follow the report's language, not a pinned locale — a Russian report with
  // "January 15, 2024" in it would be half-translated (issue #63).
  return new Date(date).toLocaleDateString(i18n.language || 'en', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatDateTime = (date) => {
  if (!date) return NA();
  return new Date(date).toLocaleString(i18n.language || 'en', {
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
    : selectedPerson ? getFullName(selectedPerson) : t('generalReport');

  let md = '';

  md += `# ${t('investigationReport')}\n\n`;
  md += `## ${reportTitle}\n\n`;
  md += `**${t('generatedLabel')}:** ${formatDateTime(new Date())}  \n`;
  md += `**${t('reportIdLabel')}:** RPT-${Date.now()}  \n`;
  md += `**${t('classificationLabel')}:** ${t('confidential')}\n\n---\n\n`;

  // Summary statistics
  const activeTasks = todos.filter(t => t.status !== 'done').length;
  md += `## ${t('summaryStatistics')}\n\n`;
  md += `| ${t('colMetric')} | ${t('colCount')} |\n|--------|-------|\n`;
  md += `| ${t('statPeople')} | ${subjects.length} |\n`;
  md += `| ${t('statBusinesses')} | ${businesses.length} |\n`;
  md += `| ${t('statLocations')} | ${locations.length} |\n`;
  md += `| ${t('statConnections')} | ${totalConnections} |\n`;
  md += `| ${t('statActiveTasks')} | ${activeTasks} |\n\n`;

  // Executive summary
  if (options.includeSummary) {
    md += `## ${t('executiveSummary')}\n\n`;
    if (selectedCase) {
      md += `${t('caseCoverage', { case: selectedCase.case_name })}  \n`;
      md += `**${t('statusLabel')}:** ${selectedCase.status || t('statusActive')}  \n\n`;
      md += `${t('caseInvolves', { people: people.length, connections: totalConnections })}\n\n`;
    } else {
      md += `${t('comprehensiveIncludes', { people: subjects.length, connections: totalConnections })}\n\n`;
    }
    md += `### ${t('keyInsights')}\n\n`;
    if (people.length > 0) {
      const categories = [...new Set(subjects.map(p => p.category).filter(Boolean))];
      md += `- ${t('insightCategories', { count: categories.length })}\n`;
    }
    if (totalConnections > 0) {
      md += `- ${t('insightAvgConnections', { value: (totalConnections / people.length).toFixed(1) })}\n`;
    }
    if (businesses.length > 0) {
      md += `- ${t('insightBusinesses', { count: businesses.length })}\n`;
    }
    md += `\n`;
  }

  // People profiles
  if (options.includePeople && subjects.length > 0) {
    md += `## ${t('peopleProfiles')}\n\n### ${t('overview')}\n\n`;
    md += `| ${t('colName')} | ${t('colCategory')} | ${t('colStatus')} | ${t('colConnections')} | ${t('colCase')} |\n`;
    md += `|------|----------|--------|-------------|------|\n`;
    subjects.forEach(p => {
      md += `| ${getFullName(p)} | ${p.category || NA()} | ${p.status || NA()} | ${p.connections?.length || 0} | ${p.case_name || NA()} |\n`;
    });
    md += `\n### ${t('detailedProfiles')}\n\n`;
    subjects.forEach((p, i) => {
      md += `#### ${i + 1}. ${getFullName(p)}\n\n`;
      md += `**${t('basicInformation')}:**\n`;
      md += `- **${t('colCategory')}:** ${p.category || NA()}\n`;
      md += `- **${t('colStatus')}:** ${p.status || NA()}\n`;
      md += `- **${t('colCase')}:** ${p.case_name || NA()}\n`;
      if (p.date_of_birth) md += `- **${t('dateOfBirthLabel')}:** ${formatDate(p.date_of_birth)}\n`;
      if (p.aliases?.length > 0) md += `- **${t('knownAliasesLabel')}:** ${p.aliases.join(', ')}\n`;
      md += `- **${t('colConnections')}:** ${p.connections?.length || 0}\n\n`;
      if (p.notes) md += `**${t('notesLabel')}:**\n> ${p.notes}\n\n`;
    });
  }

  // Business profiles
  if (options.includeBusinesses !== false && businesses.length > 0) {
    md += `## ${t('businessProfiles')}\n\n`;
    md += `| ${t('colName')} | ${t('colIndustry')} | ${t('colAddress')} | ${t('colWebsite')} |\n|------|----------|---------|----------|\n`;
    businesses.forEach(b => {
      md += `| ${b.name || t('unknown')} | ${b.industry || NA()} | ${b.address || NA()} | ${b.website || NA()} |\n`;
    });
    md += `\n### ${t('detailedBusinessInformation')}\n\n`;
    businesses.forEach((b, i) => {
      md += `#### ${i + 1}. ${b.name || t('unknownBusiness')}\n\n`;
      if (b.industry) md += `**${t('colIndustry')}:** ${b.industry}  \n`;
      if (b.address) md += `**${t('colAddress')}:** ${b.address}  \n`;
      if (b.website) md += `**${t('colWebsite')}:** [${b.website}](${b.website})  \n`;
      if (b.description) md += `\n**${t('descriptionLabel')}:**\n${b.description}\n\n`;
      else md += `\n`;
    });
  }

  // Connections analysis
  if (options.includeConnections && totalConnections > 0) {
    md += `## ${t('connectionsAnalysis')}\n\n`;
    md += `**${t('totalDocumentedConnections')}:** ${totalConnections}\n\n`;
    md += `### ${t('connectionDetails')}\n\n`;
    md += `| ${t('colFrom')} | ${t('colTo')} | ${t('colRelationship')} | ${t('colNotes')} |\n|------|----|--------------|----- |\n`;
    subjects.forEach(p => {
      p.connections?.forEach(conn => {
        const target = people.find(t => t.id === conn.person_id);
        if (target) {
          md += `| ${getFullName(p)} | ${getFullName(target)} | ${conn.type || t('unknown')} | ${conn.note || ''} |\n`;
        }
      });
    });
    md += `\n`;
  }

  // Location analysis
  if (options.includeLocations && locations.length > 0) {
    md += `## ${t('locationAnalysis')}\n\n`;
    md += `**${t('totalLocationsTracked')}:** ${locations.length}\n\n`;
    const byType = {};
    locations.forEach(loc => {
      const key = loc.type || t('unknown');
      (byType[key] = byType[key] || []).push(loc);
    });
    Object.entries(byType).forEach(([type, locs]) => {
      md += `### ${t('locationGroup', { type, count: locs.length })}\n\n`;
      md += `| ${t('colLocation')} | ${t('colCoordinates')} | ${t('colDetails')} |\n|----------|-------------|----------|\n`;
      locs.slice(0, 10).forEach(loc => {
        const name = loc.address || loc.name || t('unknownLocation');
        const coords = loc.coordinates ? `${loc.coordinates.lat}, ${loc.coordinates.lng}` : NA();
        md += `| ${name} | ${coords} | ${loc.description || ''} |\n`;
      });
      if (locs.length > 10) md += `\n*${t('andMoreLocations', { count: locs.length - 10 })}*\n`;
      md += `\n`;
    });
  }

  // Tasks
  if (options.includeTodos && todos.length > 0) {
    const open = todos.filter(t => t.status === 'open').length;
    const inProg = todos.filter(t => t.status === 'in_progress').length;
    const done = todos.filter(t => t.status === 'done').length;
    md += `## ${t('investigationTasks')}\n\n`;
    md += `**${t('taskSummary')}:** ${t('taskOpen')}: ${open} | ${t('taskInProgress')}: ${inProg} | ${t('taskCompleted')}: ${done}\n\n`;
    [['open', 'taskOpen'], ['in_progress', 'taskInProgress'], ['done', 'taskCompleted']].forEach(([status, labelKey]) => {
      const tasks = todos.filter(x => x.status === status);
      if (!tasks.length) return;
      md += `### ${t(labelKey)} (${tasks.length})\n\n`;
      tasks.forEach((todo, i) => {
        md += `${i + 1}. **${todo.text}**  \n   *${t('taskCreated')}: ${formatDate(todo.created_at)}*\n\n`;
      });
    });
  }

  // Statistical analysis
  if (options.includeCharts) {
    md += `## ${t('statisticalAnalysis')}\n\n`;
    const byCategory = {};
    people.forEach(p => {
      const c = p.category || t('unknown');
      byCategory[c] = (byCategory[c] || 0) + 1;
    });
    md += `### ${t('peopleByCategory')}\n\n| ${t('colCategory')} | ${t('colCount')} | ${t('colPercentage')} |\n|----------|-------|------------|\n`;
    Object.entries(byCategory).forEach(([cat, count]) => {
      md += `| ${cat} | ${count} | ${((count / people.length) * 100).toFixed(1)}% |\n`;
    });
    md += `\n`;

    if (todos.length > 0) {
      const open = todos.filter(t => t.status === 'open').length;
      const inProg = todos.filter(t => t.status === 'in_progress').length;
      const done = todos.filter(t => t.status === 'done').length;
      const rate = ((done / todos.length) * 100).toFixed(1);
      md += `### ${t('taskProgress')}\n\n**${t('overallCompletionRate')}:** ${rate}%\n\n`;
      md += `\`\`\`\n${t('taskDistribution')}:\n`;
      md += `├─ ${t('taskOpen')}: ${open} (${((open / todos.length) * 100).toFixed(1)}%)\n`;
      md += `├─ ${t('taskInProgress')}: ${inProg} (${((inProg / todos.length) * 100).toFixed(1)}%)\n`;
      md += `└─ ${t('taskCompleted')}: ${done} (${((done / todos.length) * 100).toFixed(1)}%)\n\`\`\`\n\n`;
    }

    if (totalConnections > 0) {
      md += `### ${t('networkAnalysis')}\n\n`;
      md += `**${t('avgConnectionsPerPerson')}:** ${(totalConnections / people.length).toFixed(2)}\n\n`;
      md += `**${t('mostConnectedIndividuals')}:**\n\n`;
      people
        .map(p => ({ name: getFullName(p), connections: p.connections?.length || 0 }))
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 5)
        .forEach((p, i) => { md += `${i + 1}. **${p.name}** - ${t('connectionsCount', { count: p.connections })}\n`; });
      md += `\n`;
    }
  }

  md += `---\n\n## ${t('reportInformation')}\n\n`;
  md += `**${t('generatedByLabel')}:** ${t('generatedByValue')}  \n`;
  md += `**${t('generationDateLabel')}:** ${formatDateTime(new Date())}  \n`;
  md += `**${t('reportIdLabel')}:** RPT-${Date.now()}  \n`;
  md += `**${t('classificationLabel')}:** ${t('confidential')}\n\n`;
  md += `> ${t('confidentialityNotice')}\n\n---\n*${t('endOfReport')}*`;

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
    : selectedPerson ? getFullName(selectedPerson) : t('generalReport');

  const children = [];

  children.push(p(t('investigationReport'), HeadingLevel.TITLE, AlignmentType.CENTER));
  children.push(p(reportTitle, HeadingLevel.HEADING_1, AlignmentType.CENTER));
  children.push(p(`${t('generatedLabel')}: ${formatDateTime(new Date())}`, null, AlignmentType.CENTER));
  children.push(blank());

  children.push(p(t('summaryStatistics'), HeadingLevel.HEADING_2, AlignmentType.CENTER));
  children.push(p(`${t('totalPeople')}: ${people.length}`));
  children.push(p(`${t('totalBusinesses')}: ${businesses.length}`));
  children.push(p(`${t('totalLocations')}: ${locations.length}`));
  children.push(p(`${t('totalConnectionsLabel')}: ${totalConnections}`));
  children.push(p(`${t('statActiveTasks')}: ${todos.filter(x => x.status !== 'done').length}`));
  children.push(blank());

  if (options.includeSummary) {
    children.push(p(t('executiveSummaryHeading'), HeadingLevel.HEADING_1));
    if (selectedCase) {
      children.push(p(t('caseCoverage', { case: selectedCase.case_name })));
      children.push(p(`${t('statusLabel')}: ${selectedCase.status || t('statusActive')}`));
      children.push(p(t('caseInvolves', { people: people.length, connections: totalConnections })));
    } else {
      children.push(p(t('comprehensiveIncludes', { people: subjects.length, connections: totalConnections })));
    }
    children.push(blank());
  }

  if (options.includePeople && subjects.length > 0) {
    children.push(p(t('peopleProfilesHeading'), HeadingLevel.HEADING_1));
    subjects.forEach((person, i) => {
      children.push(p(`${i + 1}. ${getFullName(person)}`, HeadingLevel.HEADING_2));
      children.push(p(`${t('colCategory')}: ${person.category || NA()}`));
      children.push(p(`${t('colStatus')}: ${person.status || NA()}`));
      children.push(p(`${t('colCase')}: ${person.case_name || NA()}`));
      if (person.date_of_birth) children.push(p(`${t('dateOfBirthLabel')}: ${formatDate(person.date_of_birth)}`));
      if (person.aliases?.length > 0) children.push(p(`${t('knownAliasesLabel')}: ${person.aliases.join(', ')}`));
      children.push(p(`${t('colConnections')}: ${person.connections?.length || 0}`));
      if (person.notes) children.push(p(`${t('notesLabel')}: ${person.notes}`));
      children.push(blank());
    });
  }

  // The .docx export had no connections section at all, so `includeConnections`
  // was silently ignored here — and person-profile turns it on by default.
  if (options.includeConnections && totalConnections > 0) {
    children.push(p(t('connectionsAnalysisHeading'), HeadingLevel.HEADING_1));
    children.push(p(`${t('totalDocumentedConnections')}: ${totalConnections}`));
    children.push(blank());
    subjects.forEach(person => {
      person.connections?.forEach(conn => {
        const target = people.find(t => t.id === conn.person_id);
        if (!target) return;
        const note = conn.note ? ` — ${conn.note}` : '';
        children.push(p(`${getFullName(person)} → ${getFullName(target)} (${conn.type || t('unknown')})${note}`));
      });
    });
    children.push(blank());
  }

  if (options.includeBusinesses !== false && businesses.length > 0) {
    children.push(p(t('businessProfilesHeading'), HeadingLevel.HEADING_1));
    businesses.forEach((b, i) => {
      children.push(p(`${i + 1}. ${b.name || t('unknownBusiness')}`, HeadingLevel.HEADING_2));
      if (b.industry) children.push(p(`${t('colIndustry')}: ${b.industry}`));
      if (b.address) children.push(p(`${t('colAddress')}: ${b.address}`));
      if (b.website) children.push(p(`${t('colWebsite')}: ${b.website}`));
      if (b.description) children.push(p(b.description));
      children.push(blank());
    });
  }

  if (options.includeLocations && locations.length > 0) {
    children.push(p(t('locationAnalysisHeading'), HeadingLevel.HEADING_1));
    children.push(p(`${t('totalLocationsTracked')}: ${locations.length}`));
    const byType = {};
    locations.forEach(loc => {
      const key = loc.type || t('unknown');
      (byType[key] = byType[key] || []).push(loc);
    });
    Object.entries(byType).forEach(([type, locs]) => {
      children.push(p(`${type} (${locs.length})`, HeadingLevel.HEADING_2));
      locs.slice(0, 10).forEach(loc => {
        const name = loc.address || loc.name || t('unknown');
        const coords = loc.coordinates ? `${loc.coordinates.lat}, ${loc.coordinates.lng}` : NA();
        children.push(p(`${name} — ${coords}`));
      });
      if (locs.length > 10) children.push(p(t('andMore', { count: locs.length - 10 })));
      children.push(blank());
    });
  }

  if (options.includeTodos && todos.length > 0) {
    const open = todos.filter(t => t.status === 'open').length;
    const inProg = todos.filter(t => t.status === 'in_progress').length;
    const done = todos.filter(t => t.status === 'done').length;
    children.push(p(t('investigationTasksHeading'), HeadingLevel.HEADING_1));
    children.push(p(`${t('taskOpen')}: ${open} | ${t('taskInProgress')}: ${inProg} | ${t('taskCompleted')}: ${done}`));
    todos.forEach((todo, i) => {
      children.push(p(`${i + 1}. ${todo.text}`));
      children.push(p(`   ${t('colStatus')}: ${(todo.status || t('unknown')).replace('_', ' ')} | ${t('taskCreated')}: ${formatDate(todo.created_at)}`));
    });
    children.push(blank());
  }

  if (options.includeCharts) {
    children.push(p(t('statisticalAnalysisHeading'), HeadingLevel.HEADING_1));
    const byCategory = {};
    people.forEach(x => { const c = x.category || t('unknown'); byCategory[c] = (byCategory[c] || 0) + 1; });
    children.push(p(`${t('peopleByCategory')}:`, HeadingLevel.HEADING_2));
    Object.entries(byCategory).forEach(([cat, count]) => {
      children.push(p(`   ${cat}: ${count} (${((count / people.length) * 100).toFixed(1)}%)`));
    });
    children.push(blank());

    if (todos.length > 0) {
      const done = todos.filter(t => t.status === 'done').length;
      children.push(p(`${t('taskProgress')}:`, HeadingLevel.HEADING_2));
      children.push(p(`${t('overallCompletionRate')}: ${((done / todos.length) * 100).toFixed(1)}%`));
      children.push(blank());
    }

    if (totalConnections > 0) {
      children.push(p(`${t('networkAnalysis')}:`, HeadingLevel.HEADING_2));
      children.push(p(`${t('avgConnectionsPerPerson')}: ${(totalConnections / people.length).toFixed(2)}`));
      people
        .map(p => ({ name: getFullName(p), connections: p.connections?.length || 0 }))
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 5)
        .forEach((person, i) => {
          children.push(p(`   ${i + 1}. ${person.name}: ${t('connectionsCount', { count: person.connections })}`));
        });
      children.push(blank());
    }
  }

  children.push(p(t('reportInformationHeading'), HeadingLevel.HEADING_1));
  children.push(p(`${t('generatedByLabel')}: ${t('generatedByValue')}`));
  children.push(p(`${t('generationDateLabel')}: ${formatDateTime(new Date())}`));
  children.push(p(`${t('reportIdLabel')}: RPT-${Date.now()}`));
  children.push(p(`${t('classificationLabel')}: ${t('confidential')}`));
  children.push(p(t('confidentialityNotice')));
  children.push(p(t('endOfReport'), null, AlignmentType.CENTER));

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
  md += `# ${t('ledgerTitle')}\n\n`;
  md += `## ${entity.label || t('ledgerEntity')} (${entity.type})\n\n`;
  md += `**${t('generatedLabel')}:** ${formatDateTime(new Date())}  \n`;
  md += `**${t('classificationLabel')}:** ${t('confidential')}\n\n---\n\n`;

  md += `## ${t('ledgerSummary')}\n\n`;
  md += `| ${t('colMetric')} | ${t('colValue')} |\n|--------|-------|\n`;
  md += `| ${t('valueIn')} | ${summary.value_in != null ? money(summary.value_in) : t('mixedCurrencies')} |\n`;
  md += `| ${t('valueOut')} | ${summary.value_out != null ? money(summary.value_out) : t('mixedCurrencies')} |\n`;
  md += `| ${t('net')} | ${summary.net != null ? money(summary.net) : t('seePerCurrency')} |\n`;
  md += `| ${t('distinctCounterparties')} | ${summary.distinct_counterparties} |\n\n`;

  if (summary.by_currency && summary.by_currency.length) {
    md += `### ${t('perCurrency')}\n\n| ${t('colCurrency')} | ${t('colIn')} | ${t('colOut')} | ${t('colNet')} |\n|----------|----|----|-----|\n`;
    summary.by_currency.forEach(c => {
      md += `| ${c.currency || t('unspecified')} | ${money(c.value_in)} | ${money(c.value_out)} | ${money(c.net)} |\n`;
    });
    md += `\n`;
  }

  if (summary.count_by_type && Object.keys(summary.count_by_type).length) {
    md += `### ${t('countByType')}\n\n`;
    Object.entries(summary.count_by_type).forEach(([type, c]) => { md += `- **${pretty(type)}:** ${c}\n`; });
    md += `\n`;
  }

  if (summary.assets_currently_held && summary.assets_currently_held.length) {
    md += `### ${t('currentlyHeldAssets')}\n\n`;
    summary.assets_currently_held.forEach(a => { md += `- ${a.name}${a.since ? ` (${t('heldSince', { date: formatDate(a.since) })})` : ''}\n`; });
    md += `\n`;
  }

  md += `## ${t('ledgerEntries')}\n\n`;
  md += `| ${t('colDate')} | ${t('colType')} | ${t('colRole')} | ${t('colCounterparty')} | ${t('colSubject')} | ${t('colDirection')} | ${t('colValue')} |\n`;
  md += `|------|------|------|--------------|---------|-----------|-------|\n`;
  entries.forEach(e => {
    md += `| ${formatDate(e.occurred_on)} | ${pretty(e.transaction_type)} | ${pretty(e.role)} | ${e.counterparty?.label || '—'} | ${e.subject?.label || '—'} | ${e.value_direction} | ${e.value != null ? money(e.value, e.currency) : '—'} |\n`;
  });
  md += `\n---\n*${t('endOfLedgerReport')}*`;
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
  children.push(p(t('ledgerTitle'), HeadingLevel.TITLE, AlignmentType.CENTER));
  children.push(p(`${entity.label || t('ledgerEntity')} (${entity.type})`, HeadingLevel.HEADING_1, AlignmentType.CENTER));
  children.push(p(`${t('generatedLabel')}: ${formatDateTime(new Date())}`, null, AlignmentType.CENTER));
  children.push(blank());

  children.push(p(t('ledgerSummaryHeading'), HeadingLevel.HEADING_1));
  children.push(p(`${t('valueIn')}: ${summary.value_in != null ? money(summary.value_in) : t('mixedCurrencies')}`));
  children.push(p(`${t('valueOut')}: ${summary.value_out != null ? money(summary.value_out) : t('mixedCurrencies')}`));
  children.push(p(`${t('net')}: ${summary.net != null ? money(summary.net) : t('seePerCurrency')}`));
  children.push(p(`${t('distinctCounterparties')}: ${summary.distinct_counterparties}`));
  children.push(blank());

  if (summary.assets_currently_held && summary.assets_currently_held.length) {
    children.push(p(t('currentlyHeldAssets'), HeadingLevel.HEADING_2));
    summary.assets_currently_held.forEach(a => children.push(p(`${a.name}${a.since ? ` (${t('heldSince', { date: formatDate(a.since) })})` : ''}`)));
    children.push(blank());
  }

  children.push(p(t('ledgerEntriesHeading'), HeadingLevel.HEADING_1));
  entries.forEach(e => {
    children.push(p(`${formatDate(e.occurred_on)} — ${pretty(e.transaction_type)} (${pretty(e.role)})`, HeadingLevel.HEADING_2));
    children.push(p(`${t('counterpartyLabel')}: ${e.counterparty?.label || '—'} | ${t('subjectLabel')}: ${e.subject?.label || '—'}`));
    children.push(p(`${t('directionLabel')}: ${e.value_direction} | ${t('colValue')}: ${e.value != null ? money(e.value, e.currency) : '—'}`));
    children.push(blank());
  });

  children.push(p(`${t('classificationLabel')}: ${t('confidential')}`, null, AlignmentType.CENTER));
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `entity-ledger-${entity?.type || 'entity'}-${entity?.id || ''}-${Date.now()}.docx`);
};
