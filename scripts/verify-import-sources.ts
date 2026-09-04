import { getBuiltInPublicImportSources } from "../apps/web/lib/auto-import-sources";
import { extractDedicatedSourceShows } from "../apps/web/lib/public-source-adapters";

async function main() {
  const sources = getBuiltInPublicImportSources().filter(
    (source) => source.adapter && source.adapter !== "beckett"
  );
  let failures = 0;

  for (const source of sources) {
    try {
      const response = await fetch(source.fetchUrl ?? source.url, {
        headers: {
          "user-agent": "Card Show Nation Import Bot/1.0 (+https://cardshownation.com)",
          accept: "text/html,text/calendar,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      const shows = extractDedicatedSourceShows(content, source) ?? [];
      console.log(`${source.name}: ${shows.length} show${shows.length === 1 ? "" : "s"}`);
      if (shows.length === 0) failures++;
    } catch (error) {
      failures++;
      console.error(`${source.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures > 0) process.exitCode = 1;
}

void main();
