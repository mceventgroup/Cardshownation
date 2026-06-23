# Beta Operations Runbook

## Deployment

- Vercel must use `npm run vercel-build` from `apps/web`; it runs `prisma migrate deploy` before the build.
- Deploy previews against a non-production database. Never run preview migrations against production.
- Configure an uptime monitor for `https://www.cardshownation.com/api/health` every five minutes and alert after two failures.
- Connect Vercel logs to an error-monitoring provider and alert on `[request-error]`, `[health]`, and repeated `503` responses.

## Database backup and restore

- Enable the database provider's point-in-time recovery and daily logical backups with at least 30 days retention.
- Before each schema migration, take an on-demand snapshot.
- Monthly, restore the newest backup into an isolated database, run `npm run db:deploy`, then verify user, show, organizer, and floor-plan counts.
- Record restore date, backup timestamp, row-count comparison, operator, and elapsed recovery time.
- Never restore a production backup into a developer-accessible or public database without removing personal data.

## Email deliverability

- In Resend, verify `cardshownation.com` and publish the exact SPF and DKIM records it supplies.
- Publish DMARC initially as `v=DMARC1; p=none; rua=mailto:dmarc@cardshownation.com; adkim=s; aspf=s; pct=100`, review reports, then move to `quarantine` and finally `reject`.
- Configure Resend webhook events for delivered, bounced, complained, and suppressed messages before weekly alerts launch.
- Do not send alert or marketing mail to bounced, complained, or unsubscribed recipients. Keep transactional verification and security mail separate.

## Incident and beta checks

- Test signup, verification, password reset, admin approval, promoter ownership, floor-plan access, deletion, and unsubscribe in production preview before release.
- Keep a documented support address and revoke affected sessions by incrementing `User.sessionVersion`.
- Review admin audit logs, failed logins, rate-limit fallback logs, storage growth, and email complaints weekly during beta.
