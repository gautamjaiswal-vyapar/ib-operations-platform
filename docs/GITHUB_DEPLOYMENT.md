# Plain GitHub Pages deployment

## Create the repository

Create an empty GitHub repository, then run from the project directory:

```bash
git add .
git commit -m "Publish static IB Operations Platform"
git remote add origin git@github.com:YOUR_ORGANIZATION/ib-operations-platform.git
git push -u origin main
```

You may use an HTTPS remote if required by your organization. Do not place access tokens in the remote URL.

## Enable Pages

In the GitHub repository:

1. Open **Settings → Pages**.
2. Select **GitHub Actions** as the source.
3. Open **Actions → Deploy GitHub Pages** and run the workflow, or push to `main`.
4. After the workflow completes, open its deployment URL.

The workflow installs dependencies, creates the Next.js static export, uploads `apps/web/out`, and publishes it with GitHub's official Pages actions.

## Apps Script variable

Create these Actions repository variables:

- `APPS_SCRIPT_URL` for the main operations API.
- `IPT_API_URL` for the independent IPT data API deployment in `agent-performance-dashboard/apps-script-webapp/`. Do not point this variable at the IB Operations API.

The variables are injected into the static build. The IPT API issues a short-lived dashboard session after matching the entered email in the IPT `Users` sheet.

The current isolated IPT API deployment is:

```text
https://script.google.com/macros/s/AKfycbxhGsGcj35_gidMS2uXvS6CFmVvK20xUKNpPKi6FaLRdkXgCmFaJQDTR829j8xijRWY/exec
```

The IPT Agent Performance dashboard is deployed under `/agent-performance/` but remains independent of the IB Operations Platform's sheet-based authentication. The `Users` sheet is authoritative: `ADMIN` sees all rows, `TL` sees users whose `managerEmail` matches the team lead, and `AGENT` sees only rows matching the entered email. Because this temporary flow does not verify email ownership, anyone who knows another listed address could impersonate it; do not use it for confidential data. The shared cache refreshes four times daily at 10:00, 14:00, 18:00, and 22:00 IST; open dashboards poll every five minutes. Deploy the dedicated script and run `installDashboardCacheTriggers()` once.

Before deploying the frontend, upload `apps-script/`, run `configurePlatform('GOOGLE_SPREADSHEET_ID')`, run `setOwnerPassword(...)` interactively, and deploy the Apps Script project as a web app. Without `APPS_SCRIPT_URL`, protected platform operations remain unavailable. Executive identities are discovered or configured from a Google Sheet grid with `data_month`, `employee_id`, `executive_name`, `email`, `doj`, and `manager`; operational Source, Status, and Updated At values are supplied during the audited import. The Connected Sheets SQL lives in `sql/agent_latest.sql`, but the application itself has no direct BigQuery runtime dependency.

## Repository protection

Protect `main` with pull requests and require the CI and CodeQL checks. Enable Dependabot, secret scanning, push protection, and private vulnerability reporting where available.

In **Settings → Environments → github-pages → Deployment branches and tags**, allow only the `main` branch. Keep a single workflow responsible for the Pages environment to avoid competing deployments.

## Custom domains

Configure a custom domain in **Settings → Pages** and follow GitHub's DNS instructions. Enforce HTTPS after DNS validation completes.
