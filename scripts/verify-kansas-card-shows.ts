import { fetchKansasCardShowSheet } from "../apps/web/lib/kansas-card-show-sheet";

// Read-only: exercises the production fetch/parser without database writes.
async function main() {
  const result = await fetchKansasCardShowSheet();
  const states: Record<string, number> = {};
  for (const show of result.shows) states[show.state] = (states[show.state] ?? 0) + 1;
  console.log(JSON.stringify({
    rowsRead: result.rowsRead,
    validRows: result.shows.length,
    uniqueListings: new Set(result.shows.map((show) => show.externalId)).size,
    states,
    errors: result.errors,
  }, null, 2));
  if (!result.shows.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
