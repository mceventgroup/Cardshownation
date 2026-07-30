import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export const FLOORPLANNER_MONTHLY_PRICE_CENTS = 1999;
export const FLOORPLANNER_MONTHLY_PRICE_LABEL = "$19.99";

export function getStripeConfigStatus() {
  const missing = [
    !process.env.STRIPE_SECRET_KEY?.trim() ? "STRIPE_SECRET_KEY" : null,
    !process.env.STRIPE_WEBHOOK_SECRET?.trim() ? "STRIPE_WEBHOOK_SECRET" : null,
    !process.env.STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID?.trim()
      ? "STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID"
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    ready: missing.length === 0,
    missing,
  };
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getFloorplannerMonthlyPriceId() {
  const priceId = process.env.STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID?.trim();
  if (!priceId) {
    throw new Error("The floor-planner Stripe price is not configured.");
  }
  return priceId;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("The Stripe webhook secret is not configured.");
  }
  return secret;
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}
