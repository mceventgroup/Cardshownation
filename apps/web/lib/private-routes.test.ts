import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateBrowserRoute } from "./private-routes";

test("identifies authenticated and floorplanner workspace routes", () => {
  for (const pathname of [
    "/account",
    "/account/settings",
    "/admin/floorplanner",
    "/moderator/floorplanner",
    "/promoter/shows/show-1/floorplan",
    "/floorplanner/billing",
    "/floorplanner/workspace",
    "/login",
  ]) {
    assert.equal(isPrivateBrowserRoute(pathname), true, pathname);
  }
});

test("keeps analytics eligible only on public routes", () => {
  for (const pathname of [
    "/",
    "/card-shows",
    "/floorplanner",
    "/floorplanner/workspace-preview",
    "/shows/show-1",
  ]) {
    assert.equal(isPrivateBrowserRoute(pathname), false, pathname);
  }
});
