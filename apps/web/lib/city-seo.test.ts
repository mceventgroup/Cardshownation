import test from "node:test";
import assert from "node:assert/strict";
import { isIndexableCityCount, MIN_INDEXABLE_CITY_SHOWS } from "./city-seo";

test("city pages need at least two upcoming shows to be indexed", () => {
  assert.equal(MIN_INDEXABLE_CITY_SHOWS, 2);
  assert.equal(isIndexableCityCount(0), false);
  assert.equal(isIndexableCityCount(1), false);
  assert.equal(isIndexableCityCount(2), true);
  assert.equal(isIndexableCityCount(8), true);
});
