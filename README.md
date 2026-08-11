# IB Operations Platform — GitHub Pages Edition

A credential-free static operations dashboard built with Next.js, React, TypeScript, TailwindCSS, TanStack Query, TanStack Table, React Hook Form, Zod, and Recharts.

This edition is designed for plain GitHub Pages deployment. It has no backend, database, Docker, Redis, cloud account, environment file, API key, or login requirement. Demonstration data is seeded automatically and stored in the visitor's browser using `localStorage`.

## Included modules

- Operations overview and trends
- Executive master with automatically derived M0/M1/M1+ tenurity
- Effective-dated target versions
- Weekly and monthly planning snapshots
- Versioned incentive calculations
- Analytics charts
- Browser-data export and reset

## Important data limitation

GitHub Pages is static hosting. Data is private to each browser and is not shared between users or devices. Clearing browser storage removes local changes. This edition is suitable for demonstrations, prototypes, and UI validation—not authoritative enterprise record keeping.

## Run locally

Install Node.js 20 or later, then run:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. No credentials or environment configuration are needed.

Validate the production export:

```bash
npm run lint
npm test
npm run build
```

The deployable static site is generated in `apps/web/out`.

## Deploy to GitHub Pages

1. Push the project to a GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions**.
4. Push to `main` or manually run **Deploy GitHub Pages** from the Actions tab.
5. Open the URL shown in the completed deployment job.

The workflow automatically handles project-repository base paths such as `/ib-operations-platform/`. No GitHub secrets or repository variables are required.

See [GitHub deployment instructions](docs/GITHUB_DEPLOYMENT.md), [contribution standards](CONTRIBUTING.md), and [security policy](SECURITY.md).
