# IB Operations Platform

GitHub Pages frontend with an optional Supabase backend. The platform uses Next.js, React, TypeScript, TailwindCSS, TanStack Query/Table, Recharts, and Supabase Postgres/Auth.

## Implemented operations

- Monthly executive mappings with month-specific immutable details
- Batch-select multiple existing agents and paste new-agent rows from Sheets/Excel
- Copyable agent and target templates with row-level paste validation
- DOJ-derived M0/M1/M1+ tenurity calculated for the selected month
- Effective-dated target versions by source and tenurity
- Automatic closing and deactivation of the prior active target version
- Atomic batch target version creation through PostgreSQL functions
- Planning, incentives, and analytics demonstration modules
- Browser-local fallback when Supabase is not configured

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor → New query**.
3. Run every SQL file in `supabase/migrations` in timestamp order. Existing projects must also run `202608110002_batch_operations.sql`.
4. Open **Authentication → Providers → Anonymous Sign-Ins** and enable anonymous sign-ins.
5. Copy the project URL and publishable key from **Project Settings → API**.

For local development:

```bash
cp .env.example apps/web/.env.local
```

Fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The publishable key is designed for browser use when RLS is enabled. Never place a Supabase secret/service-role key in this application.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Validate before publishing:

```bash
npm run lint
npm test
npm run build
npm audit
```

## GitHub Pages deployment

In the GitHub repository, create these **Settings → Secrets and variables → Actions → Variables**:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Then select **Settings → Pages → GitHub Actions** and run the **Deploy GitHub Pages** workflow. The workflow injects the public Supabase configuration during the static build.

## Security model

Supabase tables use Row Level Security. The application signs a visitor in with Supabase Anonymous Auth and bootstraps an isolated workspace. Workspace membership policies protect executives, monthly mappings, and target versions. Add permanent authentication and an administrator-controlled invitation flow before using the system for organization-wide production data.

When Supabase variables are absent, the application clearly shows **Browser-local fallback** and stores demonstration data in `localStorage`.
