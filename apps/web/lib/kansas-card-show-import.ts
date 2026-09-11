import { fetchKansasCardShowSheet, KANSAS_SHEET_LABEL, KANSAS_SHEET_SOURCE } from "@/lib/kansas-card-show-sheet";
import { ingestImportedShows, recordImportFailure } from "@/lib/show-import-ingest";

export async function runKansasCardShowImport(dependencies = {
  fetchSheet: fetchKansasCardShowSheet,
  ingest: ingestImportedShows,
  recordFailure: recordImportFailure,
}) {
  try {
    const result = await dependencies.fetchSheet();
    if (!result.rowsRead) throw new Error("Published sheet contains no show rows. Check the source tab before retrying.");
    return await dependencies.ingest({
      source: KANSAS_SHEET_SOURCE,
      label: KANSAS_SHEET_LABEL,
      submitterName: `${KANSAS_SHEET_LABEL} Import`,
      submitterEmail: "import@cardshownation.com",
      shows: result.shows,
      sourceErrors: result.errors,
    });
  } catch (error) {
    return dependencies.recordFailure({
      source: KANSAS_SHEET_SOURCE,
      label: KANSAS_SHEET_LABEL,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
