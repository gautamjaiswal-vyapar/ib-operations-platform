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

## Supabase variables

Create Actions repository variables named `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. These are injected into the static build as public browser configuration. Row Level Security—not secrecy of the publishable key—protects database rows. Never configure a service-role or secret key in GitHub Pages.

Before deployment, run `supabase/migrations/202608110001_initial_operations.sql` in the Supabase SQL Editor and enable Anonymous Sign-Ins. Without the variables, the site continues in browser-local fallback mode.

## Repository protection

Protect `main` with pull requests and require the CI and CodeQL checks. Enable Dependabot, secret scanning, push protection, and private vulnerability reporting where available.

## Custom domains

Configure a custom domain in **Settings → Pages** and follow GitHub's DNS instructions. Enforce HTTPS after DNS validation completes.
