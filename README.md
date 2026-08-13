# IB Operations Platform

Enterprise operations dashboard with a static Next.js frontend, Google Apps Script API, and Google Sheets as the source of truth. Supabase, MongoDB, Docker, and a separate Node server are not required.

## Architecture

- **Frontend:** Next.js, React, TypeScript, TailwindCSS, TanStack Query/Table, Recharts
- **Authentication:** sheet-backed accounts with salted password hashes, account lockout, activation codes, and hashed eight-hour sessions
- **Authorization:** OWNER, ADMIN, EDITOR, and VIEWER roles stored in the `users` sheet
- **Backend:** Google Apps Script web app in [`apps-script`](./apps-script)
- **Datastore:** one Google spreadsheet with purpose-specific sheets
- **Connected ingestion:** header-driven Google Sheet connections with discovery/configuration overrides, preview, validation, audit history, and bulk upserts
- **Hosting:** GitHub Pages for the frontend and an Apps Script web-app deployment for the API

Plaintext passwords and raw reusable session tokens are never stored in Google Sheets or committed to GitHub. The workbook stores salted password hashes and one-way session-token hashes in `users` and `sessions`.

## Sheet structure

Running `setupPlatform()` creates and formats these sheets automatically:

| Area | Sheets |
|---|---|
| Identity | `users`, `sessions`, `loginEvents`, `accessRequests` |
| Master data | `sources`, `executives`, `managerMappings`, `configuration` |
| Planning | `monthlyMappings`, `weeklyMappings`, `weeklyTargets`, `monthlyTargets`, `weeklySnapshots`, `monthlySnapshots` |
| Targets and performance | `targetVersions`, `performance`, `bonusRules`, `weeklyIncentives`, `incentives` |
| Integration and governance | `agentDataDump`, `sheetImports`, `notifications`, `auditLogs` |

Headers are centrally defined in `apps-script/Config.gs`. Repositories read those definitions and all multi-row changes use `getValues()`/`setValues()` operations. Writes use `LockService`; verified sessions use `CacheService` for short-lived lookup acceleration; mutations create audit records.

## 1. Create the Google backend

1. Create an empty Google Spreadsheet and copy its ID from the URL.
2. Open [script.google.com](https://script.google.com), create a standalone Apps Script project, and open **Project Settings**.
3. Copy every file from `apps-script/` into the project. Keep `appsscript.json` as the manifest. Alternatively, upload the directory with `clasp` as shown below.
4. From the Apps Script editor, run this once with your spreadsheet ID:

```javascript
configurePlatform('GOOGLE_SPREADSHEET_ID');
```

The function creates every required tab inside that one workbook and seeds `gautam.jaiswal@vyapar.com` as OWNER. Next, set the OWNER password interactively in the Apps Script editor; do not add it to source code or GitHub:

```javascript
setOwnerPassword('enter-a-strong-password-here-at-runtime');
```

After the run, clear the editor’s execution input/history as required by your organization. The workbook stores only the resulting salted password hash.

6. Run `installPlatformTriggers()` once to install:
   - user-defined tenurity preserved in immutable planning snapshots
   - Monday weekly snapshot
   - first-day monthly snapshot
7. Select **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Authorize the deployment and copy its `/exec` URL.

The web app is publicly reachable, but protected operations require a valid sheet-backed session. Five failed logins lock an account for 15 minutes. ADMIN/OWNER approvals produce an eight-digit activation code that expires after 48 hours; only its hash is stored.

### Upload Apps Script without a ZIP

Install and authenticate the official Apps Script CLI:

```bash
npm install --global @google/clasp
clasp login
cd apps-script
clasp create --type standalone --title "IB Operations Platform API"
clasp push
```

If the Apps Script project already exists, create `apps-script/.clasp.json` containing its script ID, then run `clasp push` from that directory. Do not commit `.clasp.json` if it contains organization-specific identifiers.

## 2. Run locally

```bash
npm ci
cp .env.example apps/web/.env.local
```

Set the public integration value in `apps/web/.env.local`:

```env
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Then run:

```bash
npm run dev
```

Open `http://localhost:3000` and sign in as `gautam.jaiswal@vyapar.com` with the runtime password configured through `setOwnerPassword(...)`. Other users request access first; an OWNER/ADMIN approves a role and securely shares the one-time activation code.

## 3. Deploy the frontend to GitHub Pages

In the GitHub repository:

1. Open **Settings → Secrets and variables → Actions → Variables**.
2. Add `APPS_SCRIPT_URL`.
3. Open **Settings → Pages** and select **GitHub Actions** as the source.
4. Run the **Deploy GitHub Pages** workflow or push to `main`.

The deployment workflow builds a static site and injects only the browser-facing Apps Script deployment URL.

## Validation

```bash
npm run lint
npm test
npm run build
npm audit
```

## Role behavior

- **OWNER:** unrestricted platform access; initially assigned to `gautam.jaiswal@vyapar.com`
- **VIEWER:** dashboards, mappings, targets, planning results, incentives, and analytics
- **EDITOR:** VIEWER permissions plus batch mappings, target versions, snapshots, and incentive calculation
- **ADMIN:** all permissions plus access approvals, source configuration, and agent dump preview/import

Target history is append-versioned. Creating a newer source/tenurity target closes the previous version one day before the new effective date and marks it inactive. Monthly and weekly mapping records preserve their own source, manager, and tenurity values for historical reporting.

## Executive identity connection

The platform auto-discovers a populated Google Sheet connection using these headers:

`data_month`, `employee_id`, `executive_name`, `email`, `doj`, `manager`

The supplied query is stored at `sql/agent_latest.sql` and runs through Google Connected Sheets. BigQuery refresh is owned and scheduled in Google Sheets (recommended at 01:00 Asia/Kolkata); Apps Script never requests BigQuery permission. On preview/import and by its 02:00 daily trigger, Apps Script reads the cached named data-source columns and batch-copies them into the standard `agentDataDump` grid. If the Connected Sheet is temporarily unavailable, the last successful mirror is retained. An ADMIN can pin a different spreadsheet/tab under **Sources & integrations**, while missing or invalid configuration falls back to header-driven discovery.

From **Executives → Batch add → Connected sheet**, **Fetch active agents** reads the query result without modifying master data. The mapping Month is user-selected; query `data_month` is freshness metadata. Connected Manager values are used unless the user supplies a batch override. Source, Status, and Updated At remain explicit user inputs. Tenurity is never derived from DOJ: an explicit `M0`, `M1`, or `M1+` selection changes it, while leaving the selector blank preserves the existing value. A selection is required for new executives or records without a valid stored tenurity. After confirmation, selected rows are bulk-upserted into `executives` and selected for the chosen `monthlyMappings` snapshot. Imports are recorded in `sheetImports` and `auditLogs`. The application does not query BigQuery directly, enable the BigQuery advanced service, or store BigQuery credentials.

## Revenue sheet connection

From **Sources & integrations**, an OWNER/ADMIN can save the external revenue spreadsheet ID or URL and its tab name. The source tab must contain `Employee ID`, `Period Type`, `Period`, and `Revenue`; optional metric headers are `Login`, `Demo`, `License`, `Pro Platform`, and `Manual Revenue`. Preview is read-only. Import validates every employee and bulk-upserts the rows into the backend workbook’s `performance` tab, with an entry in `sheetImports` and `auditLogs`.

Use `WEEK` (or `WEEKLY`) as Period Type and a Monday in `YYYY-MM-DD` format as Period for week-pivoted incentives. Each calculation stores versioned weekly results in `weeklyIncentives` and their monthly sums in `incentives`. Monthly achievement is calculated from summed monthly revenue divided by summed monthly target; weekly achievement percentages are not added together.
