# Security policy

Report vulnerabilities privately through **Security → Report a vulnerability** in the GitHub repository. Never include production employee data, passwords, raw session tokens, activation codes, or exports in an issue.

The static frontend calls a Google Apps Script backend. Authentication accounts, salted password hashes, hashed session tokens, roles, activation-code hashes, business data, and audit history are held in one access-controlled Google Spreadsheet. Plaintext passwords and raw session tokens are never persisted in the workbook.

Restrict workbook access to platform administrators and the Apps Script deployment owner. Protect the Apps Script project and deployment, review `users` and `sessions`, expire old sessions, and keep the external revenue source private. Enable GitHub CodeQL, Dependabot alerts, secret scanning, push protection, required pull-request reviews, and required CI checks on `main`.
