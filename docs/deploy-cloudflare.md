# Deploying SeenBase Analytics to Cloudflare Workers & D1

This guide covers step-by-step deployment of **SeenBase Analytics** to Cloudflare Workers and D1 database.

---

## Prerequisites

- Node.js `>=22.12.0`
- A Cloudflare account
- Wrangler CLI authenticated (`npx wrangler login`)

---

## 1. Create Cloudflare D1 Database

Run the following command to create a D1 database instance:

```bash
npx wrangler d1 create seenbase-analytics
```

*(Optional EU Jurisdiction: add `--jurisdiction eu` if you require data residency in the European Union).*

Wrangler will output a database configuration block containing a unique `database_id` UUID, for example:

```json
{
  "binding": "DB",
  "database_name": "seenbase-analytics",
  "database_id": "12345678-abcd-1234-abcd-123456789abc"
}
```

---

## 2. Update Wrangler Configurations

Replace the `seenbase-analytics-local` database UUID sentinel with your returned `database_id` UUID in all three configuration locations:

1. `apps/tracker/wrangler.jsonc`:
   ```json
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "seenbase-analytics",
       "database_id": "<YOUR_D1_DATABASE_ID>"
     }
   ]
   ```

2. `apps/dashboard/wrangler.jsonc`:
   ```json
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "seenbase-analytics",
       "database_id": "<YOUR_D1_DATABASE_ID>"
     }
   ]
   ```

3. `packages/db/package.json`:
   Update `migrate:remote` to target your database name:
   ```json
   "migrate:remote": "wrangler d1 migrations apply seenbase-analytics --remote"
   ```

---

## 3. Apply Remote Database Migrations

From the repository root, run:

```bash
npm run db:migrate:remote
```

This applies `packages/db/migrations/0001_initial.sql` to your production Cloudflare D1 database.

---

## 4. Deploy Tracker Worker

1. Generate a 32-byte hex secret key for pseudonymous visitor hashing:
   ```bash
   openssl rand -hex 32
   ```

2. Set the `IP_HASH_KEY` secret interactively on the tracker Worker:
   ```bash
   cd apps/tracker
   npx wrangler secret put IP_HASH_KEY
   ```

3. Deploy the tracker Worker:
   ```bash
   npx wrangler deploy
   ```

Wrangler will output your tracker Worker URL, for example:
`https://seenbase-analytics-tracker.<your-subdomain>.workers.dev`

---

## 5. Deploy Dashboard Worker

1. Update `TRACKER_BASE_URL` in `apps/dashboard/wrangler.jsonc` with your emitted tracker Worker URL:
   ```json
   "vars": {
     "TRACKER_BASE_URL": "https://seenbase-analytics-tracker.<your-subdomain>.workers.dev"
   }
   ```

2. Set the interactive secrets for dashboard authentication:
   ```bash
   cd apps/dashboard
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```
   - `ADMIN_PASSWORD`: At least 12 characters.
   - `SESSION_SECRET`: At least 32 characters (`openssl rand -hex 32`).

3. Build and deploy the dashboard Worker:
   ```bash
   npm run deploy
   ```

---

## 6. Verification & Cron Schedule

1. Open your deployed dashboard URL (`https://seenbase-analytics-dashboard.<your-subdomain>.workers.dev`).
2. Log in using your `ADMIN_PASSWORD`.
3. Create your first tracking pixel and copy the image snippet.
4. Embedded pixels immediately send hits to your tracker Worker.
5. The scheduled aggregator cron (`*/2 * * * *`) runs every 2 minutes to calculate hourly metrics.

---

## Optional: Cloudflare WAF & Rate Limiting

To protect public tracker endpoints (`/p/*.gif`) against high-volume flood attacks:
- Configure a Cloudflare Rate Limiting rule on `/p/*.gif` (e.g. max 100 requests per minute per IP).
- Configure Cloudflare Bot Management / Challenge rules if needed.
