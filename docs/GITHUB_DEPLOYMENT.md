# GitHub repository and deployment guide

## Repository creation

Create a private GitHub repository named `ib-operations-platform` without adding generated README, license, or `.gitignore` files. From this project directory:

```bash
git remote add origin git@github.com:YOUR_ORGANIZATION/ib-operations-platform.git
git push -u origin main
```

Use an HTTPS remote instead if required by organizational policy. Never embed a personal access token in the remote URL.

## Required repository settings

Protect `main` with pull requests, at least one approval, resolved conversations, and the `verify` and CodeQL checks. Prevent force pushes and deletion. Enable private vulnerability reporting, Dependabot alerts, secret scanning, and push protection.

Set the Actions variable `NEXT_PUBLIC_API_URL` to the public versioned API URL. Tagged releases such as `v1.0.0` publish API and web images to GitHub Container Registry:

```text
ghcr.io/<repository-owner>/ib-operations-api:<tag>
ghcr.io/<repository-owner>/ib-operations-web:<tag>
```

## Runtime hosting

GitHub Pages cannot host this application because the platform requires a NestJS server, MongoDB, Redis, background workers, and secrets. Deploy the GHCR images to a container runtime such as Google Cloud Run/GKE, AWS ECS/EKS, Azure Container Apps/AKS, or an equivalent internal Kubernetes platform.

Provide runtime environment variables from a secret manager. At minimum configure MongoDB, Redis, both JWT secrets, scheduler secret, web/API URLs, and permitted CORS origin. Configure Google OAuth and BigQuery/Sheets credentials only in environments where those integrations are enabled.

Run `npm run migrate` as a controlled pre-deployment job and `npm run seed` only during first-environment initialization. Deploy the API before the web image when API contracts change compatibly. Use health checks, gradual rollout, and a rollback to the prior immutable image tag.

## Releases

After CI is green on `main`:

```bash
git tag -a v1.0.0 -m "IB Operations Platform v1.0.0"
git push origin v1.0.0
```

The container publication workflow signs into GHCR using the repository-scoped `GITHUB_TOKEN`; no registry password is required.
