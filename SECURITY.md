# Security policy

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities. Use the repository's **Security → Report a vulnerability** flow to create a private GitHub Security Advisory. Include affected versions, reproduction details, impact, and any proposed mitigation. Remove employee PII, live credentials, access tokens, and production data from the report.

## Supported versions

Security fixes are applied to the current `main` branch and the latest tagged release. Older releases should be upgraded before requesting a backport.

## Operational expectations

- Enable GitHub secret scanning, push protection, Dependabot alerts, and required CodeQL checks.
- Protect `main`; require pull requests, successful CI, review approval, conversation resolution, and signed commits where organizational policy requires them.
- Store deployment credentials in environment-scoped GitHub secrets or the deployment platform's secret manager.
- Use workload identity federation instead of long-lived Google Cloud service-account keys when possible.
- Treat MongoDB backups, BigQuery exports, Sheets imports, logs, and audit records as sensitive operational data.
