# Weekly imports and Neon usage

The weekly Codex task scans public sources on the local computer, takes one authenticated snapshot of shows/submissions/source settings, compares candidates locally, and posts only new or enrichable records. The server validates candidates again and uses the existing submission and approval functions. Rejected source identities remain rejected. Ambiguous pairs and distinct sessions are reported for review.

## Run

Use Node 24 and installed repository dependencies, from the repository root:

```powershell
npx tsx --tsconfig apps/web/tsconfig.json scripts/weekly-local-import.ts
```

The default is a dry run. Credentials come from the ignored `apps/web/.vercel/prod.env` file (or `--env-file PATH`). Only CRON_SECRET and an optional EVENTBRITE_API_KEY are used locally. Database credentials are removed before scanning. Never print or commit credentials.

Inspect the saved report under `.local-import/`, then publish the same saved scan using a fresh live snapshot:

```powershell
npx tsx --tsconfig apps/web/tsconfig.json scripts/weekly-local-import.ts --publish --scan-file .local-import/RUN-scan.json
```

For routine weekly runs, use `--publish` without `--scan-file`. Source failures are reported without stopping other sources. TCDB stops after a 403/429 and records incomplete coverage. Eventbrite requires its API key and reports API errors/pagination limits. No absence of listings is treated as proof of successful coverage.

The server accepts up to 25 changed shows per request and one summary report per source. Exact successful batch retries replay recorded results. Failed approvals remain pending and can resume. A final snapshot verifies the saved scan locally; it does not repeat website crawling or import every existing listing. Do not run two publishing processes concurrently. This path requires no schema migration.

`.local-import/` holds scan files and reports, not secrets, and is ignored by Git. Keep the latest successful report for recovery and comparison. The computer must be on, the Codex app running, and network access available for Monday's task.

## Monitoring

`/api/health/app` checks application liveness without querying Neon. GitHub checks it every 30 minutes. `/api/health` retains the existing database readiness probe and is checked once daily at 12:17 UTC. Manual health workflow dispatch checks both.

Keep hosted weekly import schedules until the replacement endpoint is deployed, a saved scan publishes successfully, and the Codex task has been updated. Then remove only `/api/cron/eventbrite` and `/api/cron/kansas-card-shows` from Vercel schedules. Daily moderation, import-health notifications and expiration remain hosted.

## Usage baseline

Observed October 2, 2026 in Neon Console, project `card-show-nation` (`shy-queen-41932971`), production branch:

- Dashboard period: **Since Sep 30, 2026** (as displayed).
- Compute: **8.21 CU-hours**.
- Storage: **56.52 MB**; history: **2.2 MB**; transfer: **12.43 MB**.
- Compute range: **0.25 to 1 CU**; endpoint inactive when observed.

This is project usage, not the organization's 19.27 CU-hours. Dashboard metrics can lag. Record the actual cutover time and use comparable complete daily/weekly periods before claiming savings; do not compare a partial monthly total directly with a full month. Expected reductions: database probes fall from 48/day to 1/day, hosted overlapping weekly imports are removed, and unchanged candidates produce no per-record import calls. Traffic, daily jobs and account/floorplanner use continue to consume Neon.
