import assert from "node:assert/strict";
import test from "node:test";
import { mergeMissingImportedDetails } from "./show-import-ingest";

test("duplicate enrichment fills missing details without replacing trusted values", () => {
  const result = mergeMissingImportedDetails(
    {
      description: "Organizer-confirmed description",
      venueName: "",
      websiteUrl: null,
      categories: ["Sports Cards"],
      isFree: false,
    },
    {
      description: "Imported description",
      venueName: "Civic Center",
      websiteUrl: "https://example.com/show",
      categories: ["Sports Cards", "Pokemon"],
      isFree: true,
    }
  );

  assert.equal(result.merged.description, "Organizer-confirmed description");
  assert.equal(result.merged.venueName, "Civic Center");
  assert.equal(result.merged.websiteUrl, "https://example.com/show");
  assert.deepEqual(result.merged.categories, ["Sports Cards", "Pokemon"]);
  assert.equal(result.merged.isFree, true);
  assert.deepEqual(result.changedFields.sort(), ["categories", "isFree", "venueName", "websiteUrl"]);
});
