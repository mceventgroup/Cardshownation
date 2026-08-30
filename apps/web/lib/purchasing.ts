export const PURCHASING_PAUSED_MESSAGE =
  "New purchases are temporarily unavailable. Existing subscribers can continue using the Floor Planner and manage their current subscription.";

export function isPurchasingEnabled() {
  return process.env.PURCHASING_ENABLED === "true";
}
