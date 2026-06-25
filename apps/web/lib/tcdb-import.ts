import { getSeenTcdbExternalIdsByState, updateSeenTcdbExternalIdsForState } from "@/lib/import-cursors";
import { fetchTcdbShowsByState, getTcdbImportStateCodes } from "@/lib/tcdb";
import { ingestImportedShows, type ImportedShow } from "@/lib/show-import-ingest";

export async function runTcdbImport() {
  const stateCodes = getTcdbImportStateCodes();
  const seenByState = await getSeenTcdbExternalIdsByState(stateCodes);
  const shows: ImportedShow[] = [];

  for (const stateCode of stateCodes) {
    const stateShows = await fetchTcdbShowsByState(stateCode);
    const seenExternalIds = seenByState.get(stateCode) ?? new Set<string>();
    const unseenShows = stateShows.filter((show) => !seenExternalIds.has(show.externalId));

    shows.push(...unseenShows);
    await updateSeenTcdbExternalIdsForState(
      stateCode,
      stateShows.map((show) => show.externalId)
    );
  }

  return ingestImportedShows({
    source: "tcdb",
    label: "Trading Card Database",
    submitterName: "Trading Card Database Import",
    submitterEmail: "import@cardshownation.com",
    shows,
  });
}
