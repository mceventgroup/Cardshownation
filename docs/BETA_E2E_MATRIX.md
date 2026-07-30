# Beta end-to-end test matrix

Run this matrix against a preview deployment connected to an isolated Postgres database and test email inbox. Never use production customer accounts.

| Flow | Required assertions |
| --- | --- |
| Member signup | IP and email limits apply; verification token is emailed and stored hashed; unverified login is rejected; verification starts a session. |
| Password reset | Unknown and known emails receive the same UI; token is single-use; password change invalidates older sessions. |
| Admin approval | Unauthenticated requests fail; approval writes reviewer and audit data; already-reviewed submissions cannot be changed twice. |
| Promoter ownership | Promoter cannot copy, view, save, or delete another organizer's floor plan; disabled promoters receive no floor-planner access. |
| Floor-planner authorization | Admin can access any show; promoter only owned shows; oversized and malformed layouts return 413/400; stale revisions return 409. |
| Privacy controls | Optional scripts are absent before consent and after essential-only choice; optional choice enables them; unsubscribe disables all state email. |
| Account deletion | Wrong password and missing DELETE confirmation fail; correct confirmation deletes account data, clears session, and preserves public organizer/show records where required. |

## Automation status

- `npm run test:e2e:public` runs public discovery, account-entry, and privacy-consent
  smoke tests in fixture mode. CI runs these tests in Chromium.
- `npm run test:e2e` also includes opt-in verified-member login and promoter
  ownership-isolation checks. Point `E2E_BASE_URL` at an isolated preview and set
  the `E2E_FAN_*`, `E2E_PROMOTER_*`, and `E2E_FOREIGN_SHOW_ID` variables.
- Signup verification, password-reset token consumption, admin approval, account
  deletion, and email delivery still require an isolated seeded database plus a
  test inbox API. Do not run those destructive scenarios against production.

Fixture mode cannot exercise database-backed authentication and must not be
represented as full auth E2E coverage.
