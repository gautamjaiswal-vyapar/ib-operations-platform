const IPT_DASHBOARD = Object.freeze({
  spreadsheetId: '1_FnDwWgxEk8c-G8nb-BiTSrqXKGaDJqxGBecgbr6ml4',
  dataSheet: 'AgentData',
  usersSheet: 'Users',
  timeZone: 'Asia/Kolkata',
  allowedDomains: ['vyapar.com', 'vyaparapp.in'],
  periodTypes: ['DAY', 'WEEK', 'MONTH'],
  cachePrefix: 'ipt-agent-dashboard-v2',
  cacheSeconds: 4 * 60 * 60,
  cacheChunkBytes: 70 * 1024,
  cacheChunkRows: 200,
  refreshHours: [10, 14, 18, 22]
});

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('IPT Performance Dashboard')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getDashboardBootstrap() {
  const context = getUserContext_();
  const dataset = readHistoricalDataset_();
  const rows = dataset.rows;
  const visible = rows.filter(row => context.accessibleEmails.has(row.agentEmail));
  return {
    userRole: context.role,
    userEmail: context.email,
    accessibleAgents: context.accessibleAgents,
    periods: periodOptions_(visible),
    defaultAgentEmail: context.role === 'AGENT' ? context.email : '',
    generatedAt: dataset.updatedAt,
    cacheHit: dataset.cacheHit
  };
}

function getDashboardData(selectedAgentEmail, periodType, periodStart) {
  const context = getUserContext_();
  const type = normalizePeriodType_(periodType || 'MONTH');
  const dataset = readHistoricalDataset_();
  const rows = dataset.rows;
  const visible = rows.filter(row => context.accessibleEmails.has(row.agentEmail));
  const periods = periodOptions_(visible);
  const choices = periods[type] || [];
  const selectedPeriod = choices.indexOf(dateText_(periodStart)) >= 0 ? dateText_(periodStart) : choices[0] || '';
  const requestedAgent = normalizeEmail_(selectedAgentEmail);
  const selectedAgent = context.role === 'AGENT' ? context.email : requestedAgent;
  if (selectedAgent && !context.accessibleEmails.has(selectedAgent)) throw new Error('You do not have access to the selected agent.');

  const periodRows = visible.filter(row => row.periodType === type && row.period === selectedPeriod);
  const scopedRows = selectedAgent ? periodRows.filter(row => row.agentEmail === selectedAgent) : periodRows;
  const metrics = sumMetrics_(scopedRows);
  const periodIndex = choices.indexOf(selectedPeriod);
  const previousPeriod = periodIndex >= 0 && periodIndex < choices.length - 1 ? choices[periodIndex + 1] : '';
  const previousRows = previousPeriod ? visible.filter(row => row.periodType === type && row.period === previousPeriod && (!selectedAgent || row.agentEmail === selectedAgent)) : [];
  const previousMetrics = previousPeriod ? sumMetrics_(previousRows) : null;
  const history = choices.slice().reverse().map(period => {
    const historicalRows = visible.filter(row => row.periodType === type && row.period === period && (!selectedAgent || row.agentEmail === selectedAgent));
    return Object.assign({ period }, sumMetrics_(historicalRows));
  });
  const distribution = aggregateByAgent_(periodRows).filter(row => !selectedAgent || row.agentEmail === selectedAgent);

  return {
    userRole: context.role,
    userEmail: context.email,
    selectedAgentEmail: selectedAgent,
    isAggregate: !selectedAgent,
    periodType: type,
    selectedPeriod,
    previousPeriod,
    periods,
    accessibleAgents: context.accessibleAgents,
    metrics,
    previousMetrics,
    history,
    distribution,
    generatedAt: dataset.updatedAt,
    cacheHit: dataset.cacheHit
  };
}

/** Run once after deployment. Installs four daily refreshes in Asia/Kolkata. */
function installDashboardCacheTriggers() {
  removeDashboardCacheTriggers();
  IPT_DASHBOARD.refreshHours.forEach(hour => {
    ScriptApp.newTrigger('refreshDashboardCache')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(0)
      .inTimezone(IPT_DASHBOARD.timeZone)
      .create();
  });
  const refreshed = refreshDashboardCache();
  return { status: 'INSTALLED', hours: IPT_DASHBOARD.refreshHours, timeZone: IPT_DASHBOARD.timeZone, cache: refreshed };
}

function removeDashboardCacheTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'refreshDashboardCache') ScriptApp.deleteTrigger(trigger);
  });
}

/** Trigger/manual entry point. Connected Sheets should finish before these hours. */
function refreshDashboardCache() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return writeHistoricalDatasetCache_(loadHistoricalRowsFromSheet_());
  } finally {
    lock.releaseLock();
  }
}

function getDashboardCacheStatus() {
  const manifest = readCacheManifest_();
  return manifest || { status: 'EMPTY', nextAction: 'Run installDashboardCacheTriggers or refreshDashboardCache.' };
}

function getUserContext_() {
  const email = normalizeEmail_(Session.getActiveUser().getEmail());
  if (!email) throw new Error('Sign in with your Vyapar Google Workspace account.');
  const domain = email.split('@')[1] || '';
  if (IPT_DASHBOARD.allowedDomains.indexOf(domain) < 0) throw new Error('Only approved Vyapar accounts can access this dashboard.');
  const sheet = SpreadsheetApp.openById(IPT_DASHBOARD.spreadsheetId).getSheetByName(IPT_DASHBOARD.usersSheet);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('The Users access list is not configured.');
  const headerRow = sheet.getRange(1, 1, 1, Math.max(3, sheet.getLastColumn())).getValues()[0];
  const headers = headerMap_(headerRow);
  const emailColumn = headerIndex_(headers, ['email', 'user_email'], 0);
  const roleColumn = headerIndex_(headers, ['role', 'user_role'], 1);
  const managerColumn = headerIndex_(headers, ['manageremail', 'manager_email', 'team_lead'], 2);
  const lastAccessColumn = Math.max(emailColumn, roleColumn, managerColumn) + 1;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastAccessColumn).getValues();
  const users = values.map(row => ({
    email: normalizeEmail_(row[emailColumn]),
    role: normalizeRole_(row[roleColumn]),
    managerEmail: normalizeEmail_(row[managerColumn])
  })).filter(user => user.email);
  const current = users.find(user => user.email === email);
  if (!current) throw new Error('Your account is not present in the Users access list.');
  let accessibleAgents;
  if (current.role === 'ADMIN') accessibleAgents = users.map(user => user.email);
  else if (current.role === 'TL') accessibleAgents = users.filter(user => user.email === current.email || user.managerEmail === current.email).map(user => user.email);
  else accessibleAgents = [current.email];
  accessibleAgents = Array.from(new Set(accessibleAgents)).sort();
  return { email, role: current.role, accessibleAgents, accessibleEmails: new Set(accessibleAgents) };
}

function readHistoricalDataset_() {
  const cache = CacheService.getScriptCache();
  const manifest = readCacheManifest_();
  if (manifest && manifest.chunkCount > 0) {
    const keys = Array.from({ length: manifest.chunkCount }, (_, index) => cacheChunkKey_(manifest.version, index));
    const chunks = cache.getAll(keys);
    if (keys.every(key => chunks[key])) {
      const rows = [];
      keys.forEach(key => Array.prototype.push.apply(rows, JSON.parse(chunks[key])));
      return { rows, updatedAt: manifest.updatedAt, cacheHit: true };
    }
  }
  const refreshed = refreshDashboardCache();
  return { rows: refreshed.rows, updatedAt: refreshed.updatedAt, cacheHit: false };
}

function writeHistoricalDatasetCache_(rows) {
  const cache = CacheService.getScriptCache();
  const version = String(Date.now());
  const chunks = [];
  for (let start = 0; start < rows.length || (start === 0 && !rows.length); start += IPT_DASHBOARD.cacheChunkRows) {
    const queue = [rows.slice(start, start + IPT_DASHBOARD.cacheChunkRows)];
    while (queue.length) {
      const candidate = queue.shift();
      const serialized = JSON.stringify(candidate);
      if (Utilities.newBlob(serialized).getBytes().length <= IPT_DASHBOARD.cacheChunkBytes || candidate.length <= 1) {
        chunks.push(serialized);
      } else {
        const midpoint = Math.ceil(candidate.length / 2);
        queue.unshift(candidate.slice(midpoint));
        queue.unshift(candidate.slice(0, midpoint));
      }
    }
  }
  const entries = {};
  chunks.forEach((chunk, index) => { entries[cacheChunkKey_(version, index)] = chunk; });
  cache.putAll(entries, IPT_DASHBOARD.cacheSeconds);
  const updatedAt = new Date().toISOString();
  const manifest = { status: 'READY', version, updatedAt, rowCount: rows.length, chunkCount: chunks.length, expiresInSeconds: IPT_DASHBOARD.cacheSeconds };
  cache.put(cacheManifestKey_(), JSON.stringify(manifest), IPT_DASHBOARD.cacheSeconds);
  return Object.assign({ rows, cacheHit: false }, manifest);
}

function readCacheManifest_() {
  const value = CacheService.getScriptCache().get(cacheManifestKey_());
  if (!value) return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function cacheManifestKey_() { return IPT_DASHBOARD.cachePrefix + ':manifest'; }
function cacheChunkKey_(version, index) { return IPT_DASHBOARD.cachePrefix + ':' + version + ':' + index; }

function loadHistoricalRowsFromSheet_() {
  const sheet = SpreadsheetApp.openById(IPT_DASHBOARD.spreadsheetId).getSheetByName(IPT_DASHBOARD.dataSheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headers = headerMap_(headerRow);
  const required = ['month_agent_email', 'month_agent_id', 'month_team_lead', 'period_type', 'period_start', 'leads_created', 'logins', 'demos', 'conversions'];
  required.forEach(name => { if (headers[name] === undefined) throw new Error('AgentData is missing required historical column: ' + name); });
  const usedColumns = required.concat(['month_agent_designation', 'month_cluster_name', 'month_ipt_team'])
    .map(name => headers[name])
    .filter(index => index !== undefined);
  const lastRequiredColumn = Math.max.apply(null, usedColumns) + 1;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastRequiredColumn).getValues();
  return values.map(row => ({
    agentEmail: normalizeEmail_(row[headers.month_agent_email]),
    agentId: String(row[headers.month_agent_id] || ''),
    teamLead: normalizeEmail_(row[headers.month_team_lead]),
    designation: String(row[headers.month_agent_designation] || ''),
    cluster: String(row[headers.month_cluster_name] || ''),
    iptTeam: String(row[headers.month_ipt_team] || ''),
    periodType: String(row[headers.period_type] || '').toUpperCase(),
    period: dateText_(row[headers.period_start]),
    leads: numeric_(row[headers.leads_created]),
    logins: numeric_(row[headers.logins]),
    demos: numeric_(row[headers.demos]),
    conversions: numeric_(row[headers.conversions])
  })).filter(row => row.agentEmail && row.period && IPT_DASHBOARD.periodTypes.indexOf(row.periodType) >= 0);
}

function periodOptions_(rows) {
  const result = { DAY: {}, WEEK: {}, MONTH: {} };
  rows.forEach(row => { if (result[row.periodType]) result[row.periodType][row.period] = true; });
  return {
    DAY: Object.keys(result.DAY).sort().reverse(),
    WEEK: Object.keys(result.WEEK).sort().reverse(),
    MONTH: Object.keys(result.MONTH).sort().reverse()
  };
}

function sumMetrics_(rows) {
  return rows.reduce((sum, row) => {
    sum.leads += row.leads; sum.logins += row.logins; sum.demos += row.demos; sum.conversions += row.conversions;
    return sum;
  }, { leads: 0, logins: 0, demos: 0, conversions: 0 });
}

function aggregateByAgent_(rows) {
  const agents = {};
  rows.forEach(row => {
    if (!agents[row.agentEmail]) agents[row.agentEmail] = { agentEmail: row.agentEmail, agentId: row.agentId, teamLead: row.teamLead, designation: row.designation, cluster: row.cluster, iptTeam: row.iptTeam, leads: 0, logins: 0, demos: 0, conversions: 0 };
    agents[row.agentEmail].leads += row.leads; agents[row.agentEmail].logins += row.logins; agents[row.agentEmail].demos += row.demos; agents[row.agentEmail].conversions += row.conversions;
  });
  return Object.keys(agents).map(key => agents[key]).sort((a, b) => b.conversions - a.conversions || b.logins - a.logins || a.agentEmail.localeCompare(b.agentEmail));
}

function headerMap_(row) { const map = {}; row.forEach((value, index) => { map[String(value || '').trim().toLowerCase()] = index; }); return map; }
function headerIndex_(headers, aliases, fallback) { for (let i = 0; i < aliases.length; i++) if (headers[aliases[i]] !== undefined) return headers[aliases[i]]; return fallback; }
function normalizeEmail_(value) { return String(value || '').trim().toLowerCase(); }
function normalizeRole_(value) { const role = String(value || 'AGENT').trim().toUpperCase().replace(/[^A-Z]/g, ''); return role === 'ADMIN' ? 'ADMIN' : role === 'TL' || role === 'TEAMLEAD' ? 'TL' : 'AGENT'; }
function normalizePeriodType_(value) { const type = String(value || '').toUpperCase(); if (IPT_DASHBOARD.periodTypes.indexOf(type) < 0) throw new Error('Period type must be DAY, WEEK, or MONTH.'); return type; }
function numeric_(value) { const number = Number(String(value === null || value === undefined ? '' : value).replace(/,/g, '').trim() || 0); return isFinite(number) ? number : 0; }
function dateText_(value) { if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, IPT_DASHBOARD.timeZone, 'yyyy-MM-dd'); const text = String(value || '').trim(); if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10); const date = new Date(value); return isNaN(date.getTime()) ? '' : Utilities.formatDate(date, IPT_DASHBOARD.timeZone, 'yyyy-MM-dd'); }
