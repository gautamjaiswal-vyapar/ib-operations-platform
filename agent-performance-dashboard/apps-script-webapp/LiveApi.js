const IPT_LIVE_API = Object.freeze({
  clientIdProperty: 'IPT_GOOGLE_CLIENT_ID',
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
  const identity = verifyGoogleCredential_(payload.credential);
  if (!requestedEmail || requestedEmail !== identity.email) throw liveError_(403, 'Verify the same Google account as the email you entered.');

  const dataset = readHistoricalDataset_();
  const access = resolveIptAccess_(requestedEmail, dataset.rows);
  saveIptAccess_(requestedEmail, access.role, access.managerEmail);
  if (access.role === 'PENDING') throw liveError_(403, 'Your email was saved, but it is not present as an agent or team lead. Ask an administrator to assign a role in the Users sheet.');

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

function verifyGoogleCredential_(credential) {
  if (!credential) throw liveError_(401, 'Google verification is required.');
  const clientId = PropertiesService.getScriptProperties().getProperty(IPT_LIVE_API.clientIdProperty);
  if (!clientId) throw liveError_(503, 'Google sign-in is not configured for the IPT dashboard.');
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(credential)), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw liveError_(401, 'Google could not verify this sign-in. Please try again.');
  const token = JSON.parse(response.getContentText());
  const email = normalizeEmail_(token.email);
  const domain = email.split('@')[1] || '';
  if (token.aud !== clientId || !(token.email_verified === true || token.email_verified === 'true')) throw liveError_(401, 'The Google identity token is not valid for this dashboard.');
  if (IPT_DASHBOARD.allowedDomains.indexOf(domain) < 0) throw liveError_(403, 'Only approved Vyapar accounts can access this dashboard.');
  return { email };
}

function resolveIptAccess_(email, rows) {
  const users = readIptUsers_();
  const existing = users.find(user => user.email === email);
  if (existing && existing.role === 'ADMIN') return existing;
  if (existing && (existing.role === 'TL' || existing.role === 'AGENT')) return existing;
  const managesRows = rows.some(row => row.teamLead === email);
  const ownRow = rows.find(row => row.agentEmail === email);
  if (managesRows) return { email, role: 'TL', managerEmail: existing ? existing.managerEmail : '' };
  if (ownRow) return { email, role: 'AGENT', managerEmail: ownRow.teamLead || (existing ? existing.managerEmail : '') };
  return { email, role: 'PENDING', managerEmail: existing ? existing.managerEmail : '' };
}

function readIptUsers_() {
  const sheet = SpreadsheetApp.openById(IPT_DASHBOARD.spreadsheetId).getSheetByName(IPT_DASHBOARD.usersSheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  const emailColumn = headerIndex_(headers, ['email', 'user_email'], 0);
  const roleColumn = headerIndex_(headers, ['role', 'user_role'], 1);
  const managerColumn = headerIndex_(headers, ['manageremail', 'manager_email', 'team_lead'], 2);
  return values.slice(1).map(row => ({
    email: normalizeEmail_(row[emailColumn]),
    role: String(row[roleColumn] || '').trim().toUpperCase().replace(/[^A-Z]/g, ''),
    managerEmail: normalizeEmail_(row[managerColumn])
  })).filter(user => user.email);
}

function saveIptAccess_(email, role, managerEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.openById(IPT_DASHBOARD.spreadsheetId);
    let sheet = spreadsheet.getSheetByName(IPT_DASHBOARD.usersSheet);
    if (!sheet) sheet = spreadsheet.insertSheet(IPT_DASHBOARD.usersSheet);
    if (sheet.getLastRow() === 0) sheet.appendRow(['email', 'role', 'managerEmail', 'updatedAt']);
    const values = sheet.getDataRange().getValues();
    const headers = headerMap_(values[0]);
    const emailColumn = headerIndex_(headers, ['email', 'user_email'], 0);
    const roleColumn = headerIndex_(headers, ['role', 'user_role'], 1);
    const managerColumn = headerIndex_(headers, ['manageremail', 'manager_email', 'team_lead'], 2);
    let updatedColumn = headers.updatedat;
    if (updatedColumn === undefined) {
      updatedColumn = sheet.getLastColumn();
      sheet.getRange(1, updatedColumn + 1).setValue('updatedAt');
    }
    const existingIndex = values.slice(1).findIndex(row => normalizeEmail_(row[emailColumn]) === email);
    const rowNumber = existingIndex >= 0 ? existingIndex + 2 : sheet.getLastRow() + 1;
    const existingRole = existingIndex >= 0 ? String(values[existingIndex + 1][roleColumn] || '').trim().toUpperCase() : '';
    sheet.getRange(rowNumber, emailColumn + 1).setValue(email);
    if (existingRole !== 'ADMIN') sheet.getRange(rowNumber, roleColumn + 1).setValue(role);
    sheet.getRange(rowNumber, managerColumn + 1).setValue(managerEmail || '');
    sheet.getRange(rowNumber, updatedColumn + 1).setValue(new Date());
  } finally {
    lock.releaseLock();
  }
}

function scopeRowsForUser_(rows, user) {
  if (user.role === 'ADMIN') return rows;
  if (user.role === 'TL') return rows.filter(row => row.teamLead === user.email || row.agentEmail === user.email);
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

function setIptGoogleClientId(clientId) {
  const value = String(clientId || '').trim();
  if (!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(value)) throw new Error('Provide a valid Google OAuth web client ID.');
  PropertiesService.getScriptProperties().setProperty(IPT_LIVE_API.clientIdProperty, value);
  return getIptConfigurationStatus();
}

function getIptConfigurationStatus() {
  return {
    googleClientConfigured: Boolean(PropertiesService.getScriptProperties().getProperty(IPT_LIVE_API.clientIdProperty)),
    refreshHours: IPT_DASHBOARD.refreshHours,
    timeZone: IPT_DASHBOARD.timeZone,
    cache: getDashboardCacheStatus()
  };
}

function liveError_(status, message) { const error = new Error(message); error.status = status; return error; }
function liveJson_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
