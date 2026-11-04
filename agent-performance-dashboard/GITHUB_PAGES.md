# GitHub Pages deployment

The workflow at `.github/workflows/deploy-agent-performance-pages.yml` builds and deploys this dashboard whenever dashboard files reach `main`. It can also be run manually from GitHub Actions.

## Repository settings

1. Open **Settings → Pages** in the GitHub repository.
2. Set **Source** to **GitHub Actions**.
3. Merge the dashboard and workflow changes into `main`, or run **Deploy agent performance dashboard** manually.

The build is a self-contained static `dist/index.html`, so it works under the repository's GitHub Pages subpath without a hard-coded root asset path.

## Secure live data and Google authentication

GitHub Pages is a public static host. It cannot safely hold a Google service-account key, OAuth client secret, or unrestricted Sheets credential. Use this production boundary:

1. GitHub Pages hosts the dashboard frontend.
2. Google Identity Services signs the user in with the browser OAuth client.
3. A Cloud Run service or Firebase HTTPS Function receives the Google ID token.
4. The service verifies the token signature, issuer, audience, expiry, `email_verified`, and the allowed Workspace domain/email policy.
5. Only after verification, the service reads the approved Google Sheet with its server-side service account and returns the minimum dashboard fields.

Do not use the OAuth `hd` request hint as authorization. The backend must validate the verified token's email/domain. Vyapar currently has data containing both `@vyapar.com` and `@vyaparapp.in`; confirm whether one or both domains should be allowed before enforcing the production policy.

### Required Google Cloud setup

- A Google Cloud project owned by Vyapar.
- OAuth consent screen configured as **Internal** for the Workspace organization.
- A Web OAuth client with the final GitHub Pages origin in **Authorized JavaScript origins**.
- A Cloud Run or Firebase Functions deployment for the authenticated data API.
- A service account with Viewer access only to the required spreadsheet.
- Secret Manager for any server-only configuration; never commit credentials.
- CORS restricted to the final GitHub Pages origin.
- API authorization that verifies the ID token on every request.
- Short cache headers, request logging without tokens, rate limiting, and an explicit 401/403 response path.

The current checked-in dataset remains a reviewed build snapshot. Connecting the frontend to the authenticated API is the remaining step for true live data on GitHub Pages.

## Historical performance refresh flow

The connected `AgentData` query must return `period_type`, `period_start`, agent dimensions, and `leads_created`, `logins`, `demos`, and `conversions`. After changing or refreshing that query:

1. Run `syncIptAgentPerformanceHistory()` in Apps Script to upsert the slim historical table.
2. The authenticated Apps Script action `analytics.ipt.performance` can read all DAY, WEEK, and MONTH rows directly from the refreshed `AgentData` source; optional `periodType`, `from`, and `to` payload fields constrain the response.
3. Refresh the dashboard's reviewed `agent_performance` or `agent_performance_history` query and rebuild before deploying a static GitHub Pages snapshot.

The dashboard accepts either the BigQuery/Sheets snake-case fields (`period_type`, `period_start`, `month_agent_email`, `leads_created`) or the normalized API fields (`periodType`, `period`, `agentEmail`, `leads`).
