import type { DocumentSlice } from "@floorplanner/lib/persistence";

export const MAX_FLOORPLAN_REQUEST_BYTES = 8 * 1024 * 1024;
export const MAX_FLOORPLAN_NAME_LENGTH = 120;

export function assertDocumentLimits(data: DocumentSlice) {
  const limits: Array<[string, Record<string, unknown>, number]> = [
    ["tables", data.tables, 5_000],
    ["rows", data.rows, 1_000],
    ["sections", data.sections, 250],
    ["vendors", data.vendors, 5_000],
    ["vendor assignments", data.vendorAssignments, 10_000],
    ["doors", data.doors, 500],
    ["background images", data.backgroundImages, 25],
  ];
  for (const [label, entries, max] of limits) {
    if (Object.keys(entries).length > max) throw new Error(`Layout has too many ${label}. Maximum: ${max}.`);
  }
}
