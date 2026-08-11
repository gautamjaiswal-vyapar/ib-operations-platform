# IB Operations Platform

MongoDB-first enterprise operations platform for executive management, planning, immutable targets, incentives, analytics, integrations, audit, configuration, and role administration. Google Sheets is an optional import/export adapter and is never the system of record.

## GitHub

The repository includes pull-request CI, CodeQL analysis, Dependabot configuration, issue and pull-request templates, and tagged container publication to GitHub Container Registry. See [GitHub repository and deployment guide](docs/GITHUB_DEPLOYMENT.md), [contribution standards](CONTRIBUTING.md), and [security policy](SECURITY.md).

## Architecture

The repository is an npm-workspaces monorepo:

- `apps/api`: NestJS REST API, domain services, Mongoose models, BullMQ workers, JWT/Google authentication, RBAC, Swagger, BigQuery and Sheets adapters.
- `apps/web`: Next.js App Router console using TypeScript, TailwindCSS, shadcn-style primitives, TanStack Query/Table, React Hook Form, Zod and Recharts.
- `scripts`: repeatable seed and index migration utilities.

```text
Next.js console -> NestJS v1 API -> domain/application services -> repositories -> MongoDB
                                      |              |
                                      |              +-> immutable snapshots/audit
                                      +-> BullMQ/Redis -> BigQuery and optional Sheets adapters
Cloud Scheduler -> authenticated job dispatcher -> BullMQ workers
```

Domain boundaries are Executive, Manager, Target, Planning, Version, Snapshot, Incentive, Analytics, BigQuery, Google Sheets, Import, Export, Audit, Configuration, Notification, and Jobs. New modules publish work through services/queues and persist through dedicated repositories, so lead allocation, attendance, forecasting, calling analytics, and performance management do not need to modify existing domain internals.

## Data guarantees

- MongoDB is authoritative. All required collections and compound indexes are defined in `domain.schemas.ts`.
- Tenurity is derived from DOJ only. API DTOs do not accept tenurity; the daily worker repairs drift with a bulk operation.
- Target versions have unique `(source, tenurity, version)` identity and effective date windows. Only new versions are exposed by the API.
- Weekly and monthly plans have unique period/executive keys plus checksum-protected immutable snapshot documents.
- Incentive runs are append-only by calculation version and reference the exact bonus rule used.
- Every successful mutating API call creates a redacted audit event with actor and correlation context.

## Local startup

1. Copy `.env.example` to `.env` and replace both JWT secrets. Add Google Cloud credentials only for integrations you enable.
2. Install and initialize:

   ```bash
   npm install
   npm run migrate
   SEED_ADMIN_EMAIL=admin@company.com SEED_ADMIN_PASSWORD='a-strong-password' npm run seed
   ```

3. Run `npm run dev`, or run the complete stack with `docker compose up --build`.
4. Open `http://localhost:3000`. Swagger UI is at `http://localhost:4000/docs`; OpenAPI JSON is at `/docs/openapi.json`.

The default seed credentials are intentionally usable only for local bootstrap and must be overridden outside a disposable development environment.

## Scheduler

Configure Cloud Scheduler to `POST /api/v1/jobs/dispatch?name=<job>` with `x-scheduler-secret`. Supported idempotent jobs are:

- `tenurity.daily` every day
- `planning.weekly` every Monday
- `planning.monthly` on day one
- `bigquery.daily` every day

Set `SCHEDULER_SECRET` in the API environment. BullMQ retries transient failures exponentially and de-duplicates jobs by name/date.

## BigQuery and Google Sheets

BigQuery uses Application Default Credentials, parameterized watermarks, job status records, and bulk upserts. Grant the runtime service account BigQuery Job User and dataset-level Data Viewer. Sheets requires `GOOGLE_SHEETS_ENABLED=true`; grant its service account access only to explicitly imported spreadsheets. Exports should be added as a separate adapter command when enabled by policy so operational writes cannot accidentally target Sheets.

## Production deployment

- Run MongoDB as a replica set with point-in-time backups, encryption, TLS, and least-privilege database users.
- Run Redis with persistence, authentication, TLS, and an eviction policy that does not remove BullMQ keys.
- Store secrets in the platform secret manager. Never place service-account JSON or `.env` files in an image.
- Terminate TLS at the ingress, restrict CORS, configure Google OAuth redirect URIs, and rotate JWT signing secrets.
- Run `npm run migrate`, `npm test`, and `npm run build` in CI before deploying immutable API and web images.
- Scale API and workers independently. Keep one queue scheduler responsibility per environment and monitor failed BullMQ jobs, MongoDB index usage, API latency, and integration watermarks.

## API highlights

- `/api/v1/auth/*`: password, refresh and Google OAuth flows
- `/api/v1/executives`: master data with derived tenurity
- `/api/v1/targets/versions`: append-only target version creation
- `/api/v1/planning/weekly|monthly`: immutable planning generation
- `/api/v1/incentives`: versioned slab calculation and reporting
- `/api/v1/analytics/dashboard`: aggregation-backed operational KPIs
- `/api/v1/integrations/*`: BigQuery and optional Sheets adapters
- `/api/v1/platform/*`: configuration, roles, user-role mapping, and audit

Permissions are resolved into JWT claims from MongoDB roles. The seed creates `admin`, `operations`, and `viewer` roles; revise them to match organizational separation-of-duties policy before go-live.
