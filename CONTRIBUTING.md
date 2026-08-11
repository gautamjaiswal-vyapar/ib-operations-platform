# Contributing

## Workflow

1. Branch from an up-to-date `main` using `feature/<description>`, `fix/<description>`, or `chore/<description>`.
2. Keep changes inside the owning domain boundary. Cross-domain writes must go through an application service or event/queue contract.
3. Add tests for business rules, repository constraints, authorization changes, and historical-data behavior.
4. Run the validation gate before opening a pull request:

   ```bash
   npm ci
   npm run lint
   npm test
   npm run build
   ```

5. Complete the pull request checklist and document persistent-data or rollback impact.

## Engineering standards

- MongoDB remains the source of truth. Integrations cannot silently overwrite protected historical data.
- Tenurity must be derived from DOJ; never accept it from public write DTOs.
- Historical target versions and planning snapshots are immutable.
- Mutations require explicit permissions and auditable actor/reason context.
- Use bulk writes for batch operations and compound indexes for recurring query patterns.
- Do not commit credentials, `.env` files, service-account JSON, production exports, employee PII, or access tokens.

## Commit and review guidance

Use concise imperative commit subjects. Prefer independently reviewable commits that keep schema, migration, tests, and documentation together. At least one reviewer familiar with the affected domain should approve changes involving calculations, permissions, migrations, or integration watermarks.
