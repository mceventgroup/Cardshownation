import assert from "node:assert/strict";
import test from "node:test";
import {
  hasManualFloorplannerAccess,
  isFloorplannerSubscriptionActive,
  isFloorplannerSubscriptionTerminal,
  isPromoterPro,
} from "@/lib/floorplanner-access";

const NOW = new Date("2026-07-29T12:00:00.000Z");

test("active and trialing subscriptions grant access before period end", () => {
  for (const status of ["active", "trialing"]) {
    assert.equal(
      isFloorplannerSubscriptionActive(
        {
          status,
          currentPeriodEnd: new Date("2026-08-29T12:00:00.000Z"),
        },
        NOW,
      ),
      true,
    );
  }
});

test("expired active subscriptions do not grant access", () => {
  assert.equal(
    isFloorplannerSubscriptionActive(
      {
        status: "active",
        currentPeriodEnd: new Date("2026-07-29T11:59:59.000Z"),
      },
      NOW,
    ),
    false,
  );
});

test("delinquent and canceled subscriptions do not grant access", () => {
  for (const status of ["past_due", "unpaid", "paused", "canceled", "incomplete"]) {
    assert.equal(
      isFloorplannerSubscriptionActive(
        {
          status,
          currentPeriodEnd: new Date("2026-08-29T12:00:00.000Z"),
        },
        NOW,
      ),
      false,
    );
  }
});

test("an active subscription without a known period end remains usable", () => {
  assert.equal(
    isFloorplannerSubscriptionActive(
      {
        status: "active",
        currentPeriodEnd: null,
      },
      NOW,
    ),
    true,
  );
});

test("only fully ended Stripe states permit account deletion", () => {
  assert.equal(isFloorplannerSubscriptionTerminal("canceled"), true);
  assert.equal(isFloorplannerSubscriptionTerminal("incomplete_expired"), true);
  assert.equal(isFloorplannerSubscriptionTerminal("active"), false);
  assert.equal(isFloorplannerSubscriptionTerminal("past_due"), false);
  assert.equal(isFloorplannerSubscriptionTerminal("unpaid"), false);
});

test("manual floor-planner access accepts account grants and legacy organizer grants", () => {
  assert.equal(hasManualFloorplannerAccess({ floorplannerAccessGranted: true }), true);
  assert.equal(
    hasManualFloorplannerAccess({
      floorplannerAccessGranted: false,
      organizer: { floorplanEnabled: true },
    }),
    true,
  );
  assert.equal(
    hasManualFloorplannerAccess({
      user: { floorplannerAccessGranted: true },
      organizer: null,
    }),
    true,
  );
  assert.equal(
    hasManualFloorplannerAccess({
      floorplannerAccessGranted: false,
      organizer: { floorplanEnabled: false },
    }),
    false,
  );
});

test("Promoter Pro is a paid organizer tier", () => {
  const activeSubscription = {
    status: "active",
    currentPeriodEnd: new Date("2026-08-29T12:00:00.000Z"),
  };

  assert.equal(isPromoterPro("ORGANIZER", activeSubscription, NOW), true);
  assert.equal(isPromoterPro("FAN", activeSubscription, NOW), false);
  assert.equal(
    isPromoterPro(
      "ORGANIZER",
      { status: "canceled", currentPeriodEnd: activeSubscription.currentPeriodEnd },
      NOW,
    ),
    false,
  );
});
