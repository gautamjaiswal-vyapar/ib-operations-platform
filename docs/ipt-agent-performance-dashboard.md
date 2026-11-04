# IPT agent performance dashboard

## Purpose

The dashboard reports IPT agent and team-lead performance across historical day, week, and month periods. It supports agent-level inspection, team-lead aggregation, administrator-wide aggregation, previous-period comparison, funnels, historical charts, and agent distribution.

## Source and grain

The system of record is the `AgentData` tab in spreadsheet `1_FnDwWgxEk8c-G8nb-BiTSrqXKGaDJqxGBecgbr6ml4`.

Required query columns:

| Field | Meaning |
|---|---|
| `month_agent_email` | Agent identity and access join key |
| `month_agent_id` | Stable agent identifier |
| `month_team_lead` | Team-lead ownership |
| `period_type` | `DAY`, `WEEK`, or `MONTH` |
| `period_start` | Start date of the period |
| `leads_created` | Additive lead count |
| `logins` | Additive login count |
| `demos` | Additive demo count |
| `conversions` | Additive conversion count |

Optional descriptive columns are `month_agent_designation`, `month_cluster_name`, and `month_ipt_team`.

Rows are aggregated to one agent × period type × period start before display. Rates shown in the detail table are recalculated from the displayed additive counts.

## Views and filters

- Month is the default time level.
- Day, week, and month period lists are sorted newest first.
- Every chart, scorecard, funnel, comparison, and detail table follows the selected time level and period.
- Previous-period change compares the selected period with the immediately preceding available period of the same type.
- Team-lead mode aggregates agents mapped to that lead and can reveal the ranked agent distribution.

## Authorization

The Apps Script web app reads the signed-in Google Workspace email and resolves access from the `Users` tab:

- `ADMIN`: all users in the access list.
- `TL`: the team lead plus users whose manager email is the lead's email.
- `AGENT`: only the signed-in agent.

Only `vyapar.com` and `vyaparapp.in` accounts are accepted. Shared cached rows are filtered on the server after the signed-in user's authorized email set is established.

## Runtime data flow

```text
Connected Sheets query
        ↓
Google Sheet · AgentData
        ↓
Scheduled Apps Script cache refresh
10:00 / 14:00 / 18:00 / 22:00 IST
        ↓
Chunked Script Cache (four-hour TTL)
        ↓
Role-scoped aggregation
        ↓
Apps Script HTML dashboard
```

The cache manifest is written after every data chunk. If any cached chunk is unavailable, the next request rereads `AgentData` and restores the cache. The dashboard's **Latest data update** timestamp is the successful cache refresh time, not the time of each filter click.

## Cache operations

Run once after deploying a new script version:

```javascript
installDashboardCacheTriggers()
```

Operational functions:

```javascript
getDashboardCacheStatus()       // Inspect cache version, row count, and timestamp
refreshDashboardCache()         // Refresh immediately
installDashboardCacheTriggers() // Recreate the four daily triggers
removeDashboardCacheTriggers()  // Remove only dashboard cache triggers
```

Apps Script time-driven triggers execute approximately within the selected hour. The Connected Sheets refresh should complete before the dashboard cache trigger begins.

## Deployment surfaces

### Apps Script web app

Source: `agent-performance-dashboard/apps-script-webapp/`

This is the automatically refreshed surface. Push with clasp, deploy a new web-app version, and install the cache triggers.

### Local and GitHub Pages dashboard

Source: `agent-performance-dashboard/`

This is a reviewed static build. The local/GitHub artifact embeds a captured dataset and does not automatically receive the Apps Script cache. Refreshing it requires importing a new Sheet export into `src/data.json`, rebuilding, and republishing.

## Troubleshooting

| Symptom | Check |
|---|---|
| Only one week appears | Confirm the query returns multiple `WEEK` values in `period_type` and `period_start`. |
| Day or month lists are empty | Confirm exact `DAY` and `MONTH` values and valid dates. |
| Latest data update is old | Run `getDashboardCacheStatus()` and then `refreshDashboardCache()`. |
| Dashboard shows an older design or dataset | Deploy a **new Apps Script version**, then hard-refresh the `/exec` URL. |
| User sees an authorization error | Confirm domain, `Users` row, role, manager email, and web-app execution settings. |
| Local dashboard differs from Apps Script | Rebuild the static reviewed dataset; the two surfaces have separate refresh lifecycles. |

## Production checklist

1. Connected Sheets refresh completes before 10:00, 14:00, 18:00, and 22:00 IST.
2. Cache status is `READY` and reports a non-zero row count.
3. Day, week, and month contain the expected historical periods.
4. Current and previous-period totals reconcile with the Sheet.
5. Admin, team-lead, and agent access scopes are tested separately.
6. The latest update timestamp changes after a forced refresh.
7. A new Apps Script deployment version is active.
