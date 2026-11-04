# IPT Agent Performance Apps Script web app

This standalone web app reads the live `AgentData` and `Users` tabs from the IPT dashboard spreadsheet. It expects the historical query output to include:

- `month_agent_email`, `month_agent_id`, `month_team_lead`
- `period_type`, `period_start`
- `leads_created`, `logins`, `demos`, `conversions`

Optional agent metadata columns are `month_agent_designation`, `month_cluster_name`, and `month_ipt_team`.

## Publish to the linked Apps Script project

From this directory, authenticate and push with clasp:

```sh
npx @google/clasp login
npx @google/clasp push
```

In Apps Script, create a new web-app deployment with **Execute as: User accessing the web app** and restrict access to the Vyapar Google Workspace organization. This is required for `Session.getActiveUser().getEmail()` to enforce the `Users` sheet access list.

## Four-hour cache and refresh schedule

The web app stores the historical dataset in a chunked Apps Script `CacheService` cache. This avoids rereading all `AgentData` rows whenever a user changes a filter.

The configured cache lifetime is four hours. Run this function once from the Apps Script editor after deploying or changing the schedule:

```javascript
installDashboardCacheTriggers()
```

It installs daily refresh triggers at **10:00, 14:00, 18:00, and 22:00 Asia/Kolkata**. Apps Script time triggers are approximate and can execute within the selected hour. Schedule the Connected Sheets refresh to finish before each cache refresh.

Each refresh:

1. Reads the required `AgentData` columns.
2. Validates the historical schema.
3. Splits the reviewed rows into cache-safe chunks.
4. Publishes a cache manifest only after every chunk is written.
5. Exposes the cache refresh timestamp as `generatedAt`.

The dashboard displays this timestamp as **Latest data update**. Filter changes served from the cache retain the same timestamp instead of showing the browser request time.

### Operations and recovery

- Check cache metadata with `getDashboardCacheStatus()`.
- Force an immediate refresh with `refreshDashboardCache()`.
- Reinstall the four scheduled triggers with `installDashboardCacheTriggers()`.
- Remove only these dashboard triggers with `removeDashboardCacheTriggers()`.
- If Apps Script evicts a chunk early, the next dashboard request performs one synchronous Sheet refresh and rebuilds the cache.

`CacheService` is an acceleration layer, not the system of record. `AgentData` remains authoritative. Access filtering is applied after the shared dataset is read, so cached data does not bypass the `Users` sheet authorization rules.

## Static local and GitHub builds

The React/GitHub Pages dashboard is a reviewed static snapshot. Its `src/data.json` must be regenerated and rebuilt to reflect a newer Sheet refresh. The Apps Script cache schedule does not modify a Git repository or GitHub Pages deployment. Automating that static publication requires a separate authenticated build workflow.

## Deployment checklist

1. Push `Code.gs`, `Index.html`, and `appsscript.json` to the linked Apps Script project.
2. Deploy a new web-app version.
3. Run `installDashboardCacheTriggers()` once and authorize trigger creation.
4. Run `getDashboardCacheStatus()` and confirm `status: READY`.
5. Open the `/exec` URL and confirm **Latest data update** appears.
