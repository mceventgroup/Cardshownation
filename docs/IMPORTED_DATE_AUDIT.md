# Imported date audit — October 2, 2026

Reviewed 5,453 shows and 5,324 submission records. All records were checked for reversed dates and ranges longer than seven days. Source comparison used the saved October 2 scan, stored leading source date headers, and a freshly fetched SCD calendar containing 380 listings.

Kansas spreadsheet Published row 15 contains August 1–July 2, 2026 for the Wichita Kansas card show at Drury Inn. The matching spreadsheet row and archived listings support **August 1–2, 2026**. Card Show Nation already contains the correctly dated event as EXPIRED. Do not create a duplicate or revive the event. The external spreadsheet remains incorrect; its table count of 2 also conflicts with the matching row's 170.

Found 30 distinct shows whose stored end dates disagree with their source description's leading date header. **26 also agree with the current SCD calendar** and are included in the repair manifest. Four historical discrepancies have only stored evidence and remain for review. Another 16 source disagreements need individual review, including TCDB day-specific entries and Kansas conflicts. All 19 reversed ranges belong to rejected submissions; no published show has a reversed range. Preserve rejected records.

The repair changes only the 26 verified shows' end dates and corresponding expiration dates, expires corrected past events when appropriate, and records each correction in AuditLog. It retains original submission payloads as historical provenance. Snapshot-approved submissions reflect linked show dates, so they are not additional events to repair.

Run from the repository root:

```powershell
node node_modules/tsx/dist/cli.mjs scripts/repair-audited-import-dates.ts --offline
node node_modules/tsx/dist/cli.mjs scripts/repair-audited-import-dates.ts
node node_modules/tsx/dist/cli.mjs scripts/repair-audited-import-dates.ts --apply
```

Default is a live read-only preview. Credentials are read from the ignored `apps/web/.vercel/prod.env`; do not print them. The script verifies audited identity, description, dates and status before writing, repeats those guards during updates, saves a before-image locally, and verifies dates and expiration afterward. Successful retries make no additional writes. Full audit evidence and verification are retained under the ignored `.local-import/` folder in the dedicated checkout.

Sources: [Kansas spreadsheet](https://docs.google.com/spreadsheets/d/1_hjAwVfAQE03i9tH9be9DHlmQbjEnEl-XEL0YG91UJc/edit#gid=1567922315), [archived Wichita event](https://www.cardshowatlas.com/past-shows.php), [SCD calendar](https://sportscollectorsdigest.com/collecting-101/show-calendar).

## Applied repair

All 26 manifest corrections were applied to the live database. The subsequent read verified every corrected end date and corresponding expiration date; zero manifest corrections remain. Each updated show has an audit entry and a local before-image. Offline manifest validation and repository lint passed.
