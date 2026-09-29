import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentSlice } from "./persistence";
import { configureFloorplannerRuntime } from "./runtime";
import {
  CloudRevisionConflictError,
  listCloudLayouts,
  loadCloudLayout,
  saveCloudLayout,
} from "./cloud-layouts";

const emptyDocument = {
  tables: {},
  rows: {},
  sections: {},
  vendors: {},
  vendorAssignments: {},
  room: null,
  doors: {},
  settings: {},
  backgroundImages: {},
} as DocumentSlice;

const accountRow = {
  id: "account-layout",
  name: "Main Hall",
  revision: 4,
  saved_at: "2026-09-29T12:00:00.000Z",
  table_count: 121,
  vendor_count: 32,
};
const accountSummary = {
  id: accountRow.id,
  name: accountRow.name,
  revision: accountRow.revision,
  savedAt: accountRow.saved_at,
  tableCount: accountRow.table_count,
  vendorCount: accountRow.vendor_count,
};

test("account saves expose the same metadata as show-specific saves when listing, loading, and saving", async () => {
  const originalFetch = global.fetch;
  configureFloorplannerRuntime({ cloudBasePath: "/api/floorplanner" });
  try {
    global.fetch = async () => Response.json({ layouts: [accountRow, { ...accountSummary, id: 'show-layout' }] });
    assert.deepEqual(await listCloudLayouts(), [accountSummary, { ...accountSummary, id: 'show-layout' }]);

    global.fetch = async () => Response.json({ layout: { ...accountRow, data: emptyDocument } });
    assert.deepEqual(await loadCloudLayout(accountRow.id), { ...accountSummary, data: emptyDocument });
    assert.deepEqual(await saveCloudLayout({ name: accountRow.name, data: emptyDocument }), accountSummary);

    global.fetch = async () => Response.json({
      error: 'Changed on another device', code: 'revision-conflict', currentLayout: accountRow,
    }, { status: 409 });
    await assert.rejects(() => saveCloudLayout({ name: accountRow.name, data: emptyDocument }), error => {
      assert.ok(error instanceof CloudRevisionConflictError);
      assert.deepEqual(error.currentLayout, accountSummary);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
    configureFloorplannerRuntime({ cloudBasePath: "" });
  }
});

test("saveCloudLayout sends the selected id and revision when overwriting", async () => {
  const originalFetch = global.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  configureFloorplannerRuntime({ cloudBasePath: "/api/floorplanner" });

  global.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return Response.json({
      layout: {
        id: "layout-1",
        name: "Main floor",
        revision: 5,
        savedAt: "2026-07-28T12:00:00.000Z",
        tableCount: 0,
        vendorCount: 0,
      },
    });
  };

  try {
    const saved = await saveCloudLayout({
      id: "layout-1",
      name: "Main floor",
      data: emptyDocument,
      expectedRevision: 4,
    });

    assert.equal(saved.revision, 5);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "/api/floorplanner/cloud-layouts");
    assert.equal(requests[0]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      id: "layout-1",
      name: "Main floor",
      data: emptyDocument,
      expectedRevision: 4,
    });
  } finally {
    global.fetch = originalFetch;
    configureFloorplannerRuntime({ cloudBasePath: "" });
  }
});

test("saveCloudLayout preserves revision-conflict details", async () => {
  const originalFetch = global.fetch;
  configureFloorplannerRuntime({ cloudBasePath: "/api/floorplanner" });

  global.fetch = async () => Response.json(
    {
      error: "This cloud layout changed since you loaded it.",
      code: "revision-conflict",
      currentLayout: {
        id: "layout-1",
        name: "Main floor",
        revision: 8,
        savedAt: "2026-07-28T12:00:00.000Z",
        tableCount: 20,
        vendorCount: 4,
      },
    },
    { status: 409 },
  );

  try {
    await assert.rejects(
      () => saveCloudLayout({
        id: "layout-1",
        name: "Main floor",
        data: emptyDocument,
        expectedRevision: 7,
      }),
      (error) => {
        assert.ok(error instanceof CloudRevisionConflictError);
        assert.equal(error.currentLayout?.revision, 8);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
    configureFloorplannerRuntime({ cloudBasePath: "" });
  }
});
