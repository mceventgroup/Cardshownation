export const FLOORPLANNER_ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);

type SubscriptionAccessRecord = {
  status: string;
  currentPeriodEnd: Date | null;
};

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

export function isFloorplannerSubscriptionTerminal(status: string) {
  return status === "canceled" || status === "incomplete_expired";
}
