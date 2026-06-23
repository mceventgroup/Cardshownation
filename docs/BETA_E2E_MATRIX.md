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

Automate the matrix with Playwright once `E2E_DATABASE_URL`, `E2E_BASE_URL`, admin credentials, and a test inbox API are available in CI. The current fixture mode cannot exercise database-backed authentication, so it must not be represented as full auth E2E coverage.
