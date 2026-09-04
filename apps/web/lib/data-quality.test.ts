import assert from "node:assert/strict";
import test from "node:test";
import { findDuplicateQualityGroups, inspectShowQuality, type QualityShowRecord } from "./data-quality";

function qualityShow(overrides: Partial<QualityShowRecord> = {}): QualityShowRecord {
  return {
    id: "show-1",
    title: "The Flint Hills Card Show",
    slug: "flint-hills-card-show",
    status: "APPROVED",
    sourceType: "MANUAL",
    startDate: new Date("2026-09-05T12:00:00.000Z"),
    endDate: new Date("2026-09-05T21:00:00.000Z"),
    expiresAt: null,
    startTimeLabel: "9:00 AM",
    endTimeLabel: "4:00 PM",
    city: "Manhattan",
    state: "KS",
    isFree: false,
    admissionPrice: "$5",
    description: "Sports card and collectible show.",
    tableCount: 80,
    vendorDetails: "Vendor tables available.",
    websiteUrl: "https://example.com/show",
    facebookUrl: null,
    ticketUrl: null,
    parkingInfo: "Free parking",
    flyerImageUrl: null,
    categories: ["Sports Cards"],
    organizerId: "organizer-1",
    lastVerifiedAt: new Date("2026-08-30T12:00:00.000Z"),
    updatedAt: new Date("2026-08-30T12:00:00.000Z"),
    venueId: "venue-1",
    venue: { name: "Peace Memorial Auditorium", address1: "101 S 4th St", city: "Manhattan", state: "KS" },
    organizer: { name: "Kansas Card Show" },
    _count: { savedBy: 2, reports: 0, floorplans: 0 },
    ...overrides,
  };
}

test("groups same-date title aliases and recommends the richer listing", () => {
  const sparse = qualityShow({
    id: "show-2",
    title: "Flint Hills Card Show",
    description: null,
    websiteUrl: null,
    organizerId: null,
    organizer: null,
    startTimeLabel: null,
  });
  const groups = findDuplicateQualityGroups([sparse, qualityShow()]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].recommendedKeepId, "show-1");
});

test("does not group a different date or a pair an admin marked separate", () => {
  const otherDate = qualityShow({ id: "show-2", startDate: new Date("2026-09-06T12:00:00.000Z"), endDate: new Date("2026-09-06T21:00:00.000Z") });
  assert.equal(findDuplicateQualityGroups([qualityShow(), otherDate]).length, 0);

  const alias = qualityShow({ id: "show-2", title: "Flint Hills Card Show" });
  assert.equal(findDuplicateQualityGroups([qualityShow(), alias], new Set(["show-1::show-2"])).length, 0);
});

test("flags missing details, conflicting locations, prohibited links, and approved past shows", () => {
  const result = inspectShowQuality(qualityShow({
    startTimeLabel: null,
    description: null,
    categories: [],
    organizerId: null,
    organizer: null,
    websiteUrl: "https://www.tcdb.com/CardShows.cfm",
    admissionPrice: null,
    venue: { name: "Wrong Venue", address1: "1 Main St", city: "Omaha", state: "NE" },
  }), new Date("2026-09-06T00:00:00.000Z"));

  assert.ok(result.missing.includes("Hours"));
  assert.ok(result.missing.includes("Promoter"));
  assert.ok(result.conflicts.includes("Venue location conflicts with show location"));
  assert.equal(result.suspiciousLinks[0]?.problem, "TCDB links are not allowed on listings");
  assert.equal(result.approvedPast, true);
});

test("does not mark a show expired during its final calendar day", () => {
  const result = inspectShowQuality(qualityShow({
    startDate: new Date("2026-09-05T00:00:00.000Z"),
    endDate: new Date("2026-09-05T00:00:00.000Z"),
  }), new Date("2026-09-05T20:00:00.000Z"));
  assert.equal(result.approvedPast, false);
});
