# Production Follow-Ups

## Completed: Shared Production Rate Limiting

Production rate limiting is stored in the `RateLimitBucket` Postgres table and
is shared across application instances. Fixture mode intentionally retains the
in-memory implementation so local development does not require Postgres.

Covered scopes include show submission, member/promoter signup and login,
password recovery, moderator/admin login, admin setup, and geo-IP lookup.
Regression tests cover allow, block, retry, and reset behavior.

## Ticket: Track Next.js Bundled PostCSS and Sharp Advisories

- **Priority:** Medium
- **Owner:** Frontend / Platform
- **Target areas:** `apps/web/package.json`, `package-lock.json`

### Problem

The app is on `next@15.5.22`, which fixes the current framework-level server
action, SSRF, cache-confusion, and endpoint-disclosure advisories. `npm audit
--omit=dev` still reports high-severity findings because that Next release
bundles `postcss@8.4.31` and `sharp@0.34.5`.

The application pins its own CSS processing to patched `postcss@8.5.24` and
its flyer normalization to patched `sharp@0.35.3`. PostCSS runs only during
trusted application builds. Next image optimization is disabled, so untrusted
flyer bytes are not processed by Next's internally bundled Sharp version.

### Scope

- Track upstream Next.js releases for dependency bumps to patched PostCSS and
  Sharp versions.
- Re-run `npm audit --omit=dev` after each framework upgrade attempt.
- Keep Next image optimization disabled until its bundled Sharp version is
  patched.
- Remove this follow-up once a stable Next release clears the advisory.

### Acceptance Criteria

- A stable Next.js release is available that no longer bundles vulnerable
  PostCSS or Sharp.
- The app upgrades to that release without regressions.
- `npm audit --omit=dev` no longer reports the `next/postcss` or `next/sharp`
  advisories.
