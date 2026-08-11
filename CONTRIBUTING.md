# Contributing

1. Branch from `main` using `feature/<description>`, `fix/<description>`, or `chore/<description>`.
2. Keep the application compatible with static export and credential-free GitHub Pages hosting.
3. Do not introduce server APIs, databases, Docker services, runtime secrets, or filesystem writes.
4. Keep browser persistence behind the local repository in `apps/web/src/lib/api.ts`.
5. Run the full validation gate:

   ```bash
   npm ci
   npm run lint
   npm test
   npm run build
   ```

6. Verify navigation under a repository base path and test with an empty browser storage state.

Do not commit credentials, employee PII, production exports, access tokens, `.env` files, or proprietary operational data.
