const IPT_LIVE_API = Object.freeze({
  sessionPrefix: 'ipt-session:',
  sessionSeconds: 6 * 60 * 60
});

function doPost(e) {
  let request = {};
  try {
    request = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    const payload = request.payload || {};
    if (request.action === 'ipt.authorize') return liveJson_({ ok: true, data: authorizeIptUser_(payload) });
    if (request.action === 'ipt.performance') return liveJson_({ ok: true, data: getIptPerformance_(payload) });
    throw liveError_(404, 'Unknown IPT API action.');
  } catch (error) {
    const status = error.status || 500;
    console.error(error.stack || error);
    return liveJson_({ ok: false, error: { status, message: status === 500 ? 'The IPT data service encountered an unexpected error.' : String(error.message) } });
  }
}

function authorizeIptUser_(payload) {
  const requestedEmail = normalizeEmail_(payload.email);
  const domain = requestedEmail.split('@')[1] || '';
  if (!requestedEmail || IPT_DASHBOARD.allowedDomains.indexOf(domain) < 0) throw liveError_(403, 'Enter a valid Vyapar work email.');
  const access = resolveIptAccess_(requestedEmail);
  if (!access) throw liveError_(403, 'This email is not present in the IPT Users sheet. Ask an administrator to add it.');

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(iptSessionKey_(token), JSON.stringify({ email: requestedEmail, role: access.role }), IPT_LIVE_API.sessionSeconds);
  return { sessionToken: token, user: { email: requestedEmail, role: access.role }, expiresInSeconds: IPT_LIVE_API.sessionSeconds };
}

function getIptPerformance_(payload) {
  const user = readIptSession_(payload.sessionToken);
  const dataset = readHistoricalDataset_();
  const visible = scopeRowsForUser_(dataset.rows, user);
  const periodType = normalizePeriodType_(payload.periodType || 'MONTH');
  const periods = periodOptions_(visible);
  const periodChoices = periods[periodType] || [];
  const requestedPeriod = dateText_(payload.periodStart);
  const selectedPeriod = periodChoices.indexOf(requestedPeriod) >= 0 ? requestedPeriod : periodChoices[0] || '';
  const level = String(payload.level || 'AGENT').toUpperCase() === 'TEAM_LEAD' ? 'TEAM_LEAD' : 'AGENT';
  const agents = Array.from(new Set(visible.map(row => row.agentEmail).filter(Boolean))).sort();
  const teamLeads = Array.from(new Set(visible.map(row => row.teamLead).filter(Boolean))).sort();
  const allowedIdentities = level === 'TEAM_LEAD' ? teamLeads : agents;
  const requestedIdentity = normalizeEmail_(payload.identity);
  const identity = requestedIdentity && allowedIdentities.indexOf(requestedIdentity) >= 0 ? requestedIdentity : '';
  if (requestedIdentity && !identity) throw liveError_(403, 'You do not have access to the selected scope.');

  const scope = row => !identity || (level === 'TEAM_LEAD' ? row.teamLead === identity : row.agentEmail === identity);
  const currentRows = visible.filter(row => row.periodType === periodType && row.period === selectedPeriod && scope(row));
  const periodIndex = periodChoices.indexOf(selectedPeriod);
  const previousPeriod = periodIndex >= 0 && periodIndex < periodChoices.length - 1 ? periodChoices[periodIndex + 1] : '';
  const previousRows = previousPeriod ? visible.filter(row => row.periodType === periodType && row.period === previousPeriod && scope(row)) : [];
  const history = periodChoices.slice().reverse().map(period => Object.assign(
    { period },
    sumMetrics_(visible.filter(row => row.periodType === periodType && row.period === period && scope(row)))
  ));

  return {
    user,
    periodType,
    selectedPeriod,
    previousPeriod,
    periods,
    agents,
    teamLeads,
    identity,
    level,
    metrics: sumMetrics_(currentRows),
    previousMetrics: previousPeriod ? sumMetrics_(previousRows) : null,
    history,
    distribution: aggregateByAgent_(currentRows),
    generatedAt: dataset.updatedAt,
    cacheHit: dataset.cacheHit
  };
}

function resolveIptAccess_(email) {
  const users = readIptUsers_();
  const existing = users.find(user => user.email === email);
  if (existing && existing.role === 'ADMIN') return existing;
  if (users.some(user => user.managerEmail === email)) return { email, role: 'TL', managerEmail: existing ? existing.managerEmail : '' };
  if (existing) return { email, role: existing.role === 'TL' ? 'TL' : 'AGENT', managerEmail: existing.managerEmail };
  return null;
}

function readIptUsers_() {
  const sheet = SpreadsheetApp.openById(IPT_DASHBOARD.spreadsheetId).getSheetByName(IPT_DASHBOARD.usersSheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  const emailColumn = headerIndex_(headers, ['email', 'user_email', 'agent_email', 'employee_email'], 0);
  const roleColumn = headerIndex_(headers, ['role', 'user_role'], 1);
  const managerColumn = headerIndex_(headers, ['manageremail', 'manager_email', 'manager', 'team_lead', 'team_lead_email'], 2);
  return values.slice(1).map(row => ({
    email: normalizeEmail_(row[emailColumn]),
    role: normalizeIptUserRole_(row[roleColumn]),
    managerEmail: normalizeEmail_(row[managerColumn])
  })).filter(user => user.email);
}

function normalizeIptUserRole_(value) {
  const role = String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'TL' || role === 'TEAMLEAD' || role === 'MANAGER') return 'TL';
  return role === 'AGENT' ? 'AGENT' : '';
}

function scopeRowsForUser_(rows, user) {
  if (user.role === 'ADMIN') return rows;
  if (user.role === 'TL') {
    const agentEmails = new Set(readIptUsers_().filter(entry => entry.managerEmail === user.email || entry.email === user.email).map(entry => entry.email));
    return rows.filter(row => agentEmails.has(row.agentEmail));
  }
  return rows.filter(row => row.agentEmail === user.email);
}

function readIptSession_(token) {
  if (!token) throw liveError_(401, 'Sign in to view the IPT dashboard.');
  const value = CacheService.getScriptCache().get(iptSessionKey_(token));
  if (!value) throw liveError_(401, 'Your dashboard session expired. Sign in again.');
  return JSON.parse(value);
}

function iptSessionKey_(token) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  return IPT_LIVE_API.sessionPrefix + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}

function getIptConfigurationStatus() {
  return {
    accessSource: IPT_DASHBOARD.usersSheet,
    refreshHours: IPT_DASHBOARD.refreshHours,
    timeZone: IPT_DASHBOARD.timeZone,
    cache: getDashboardCacheStatus()
  };
}

function liveError_(status, message) { const error = new Error(message); error.status = status; return error; }
function liveJson_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
