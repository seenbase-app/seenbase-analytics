# Contributing to SeenBase Analytics

Thank you for your interest in contributing to **SeenBase Analytics**!

## Repository Structure

- `apps/tracker`: High-performance pixel ingestion Worker and scheduled cron aggregator.
- `apps/dashboard`: Single-workspace Astro dashboard Worker with server-rendered UI.
- `packages/db`: D1 schema, migrations, and shared data model types.

## Local Workflow

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variable examples:
   ```bash
   cp apps/tracker/.dev.vars.example apps/tracker/.dev.vars
   cp apps/dashboard/.dev.vars.example apps/dashboard/.dev.vars
   ```

3. Run local database migrations and seed preview data:
   ```bash
   npm run db:migrate:local
   npm run db:seed:local
   ```

4. Start local development servers:
   ```bash
   npm run dev
   ```
   - Tracker runs at `http://127.0.0.1:8787`
   - Dashboard runs at `http://127.0.0.1:4321`

## Pull Request Checks

Before submitting a pull request, ensure all checks pass:

```bash
npm run typecheck
npm run build
npm test
```
