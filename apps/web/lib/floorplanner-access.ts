export const FLOORPLANNER_ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);

type SubscriptionAccessRecord = {
  status: string;
  currentPeriodEnd: Date | null;
};

type ManualAccessRecord = {
  floorplannerAccessGranted?: unknown;
  user?: {
    floorplannerAccessGranted?: unknown;
  } | null;
  organizer?: {
    floorplanEnabled?: unknown;
  } | null;
};

export function hasManualFloorplannerAccess(account: ManualAccessRecord | null | undefined) {
  return Boolean(
    account?.floorplannerAccessGranted ||
      account?.user?.floorplannerAccessGranted ||
      account?.organizer?.floorplanEnabled,
  );
}

export function isFloorplannerSubscriptionActive(
  subscription: SubscriptionAccessRecord | null | undefined,
  now = new Date(),
) {
  if (!subscription || !FLOORPLANNER_ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return false;
  }

  return (
    subscription.currentPeriodEnd === null ||
    subscription.currentPeriodEnd.getTime() > now.getTime()
  );
}

export function isPromoterPro(
  role: string,
  subscription: SubscriptionAccessRecord | null | undefined,
  now = new Date(),
) {
  return role === "ORGANIZER" && isFloorplannerSubscriptionActive(subscription, now);
}

export function isFloorplannerSubscriptionTerminal(status: string) {
  return status === "canceled" || status === "incomplete_expired";
}
