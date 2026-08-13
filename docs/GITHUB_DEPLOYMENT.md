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

Create an Actions repository variable named `APPS_SCRIPT_URL`. It is injected into the static build as the browser-facing web-app endpoint. Authentication credentials, password hashes, role mappings, session-token hashes, and business data remain in the configured backend Google Spreadsheet.

Before deploying the frontend, upload `apps-script/`, run `configurePlatform('GOOGLE_SPREADSHEET_ID')`, run `setOwnerPassword(...)` interactively, and deploy the Apps Script project as a web app. Without `APPS_SCRIPT_URL`, protected platform operations remain unavailable. Executive identities are discovered or configured from a Google Sheet grid with `data_month`, `employee_id`, `executive_name`, `email`, `doj`, and `manager`; operational Source, Status, and Updated At values are supplied during the audited import. The Connected Sheets SQL lives in `sql/agent_latest.sql`, but the application itself has no direct BigQuery runtime dependency.

## Repository protection

Protect `main` with pull requests and require the CI and CodeQL checks. Enable Dependabot, secret scanning, push protection, and private vulnerability reporting where available.

## Custom domains

Configure a custom domain in **Settings → Pages** and follow GitHub's DNS instructions. Enforce HTTPS after DNS validation completes.
