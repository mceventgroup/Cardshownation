import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { isFloorplannerSubscriptionActive } from "@/lib/floorplanner-access";
import {
  FLOORPLANNER_MONTHLY_PRICE_CENTS,
  getFloorplannerMonthlyPriceId,
  getStripe,
} from "@/lib/stripe";

export { isFloorplannerSubscriptionActive } from "@/lib/floorplanner-access";

export async function getFloorplannerSubscription(userId: string) {
  return db.floorplannerSubscription.findUnique({
    where: { userId },
  });
}

export async function hasActiveFloorplannerSubscription(userId: string) {
  return isFloorplannerSubscriptionActive(await getFloorplannerSubscription(userId));
}

function readStripeId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  if (periodEnds.length === 0) return null;
  return new Date(Math.max(...periodEnds) * 1000);
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price.id ?? null;
}

export async function syncFloorplannerSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null,
) {
  const existing = await db.floorplannerSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { userId: true },
  });
  const userId =
    subscription.metadata.csnUserId?.trim() ||
    fallbackUserId?.trim() ||
    existing?.userId ||
    null;
  const stripeCustomerId = readStripeId(subscription.customer);
  const stripePriceId = getSubscriptionPriceId(subscription);
  const configuredPriceId = process.env.STRIPE_FLOORPLANNER_MONTHLY_PRICE_ID?.trim();
  const isFloorplannerSubscription =
    subscription.metadata.csnProduct === "floorplanner" ||
    Boolean(existing) ||
    (Boolean(configuredPriceId) && stripePriceId === configuredPriceId);

  if (!isFloorplannerSubscription || !userId || !stripeCustomerId || !stripePriceId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return null;
  }

  return db.floorplannerSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    },
  });
}

export async function syncFloorplannerCheckoutSession(
  checkoutSessionId: string,
  expectedUserId?: string,
) {
  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription"],
  });

  const checkoutUserId =
    checkoutSession.client_reference_id?.trim() ||
    checkoutSession.metadata?.csnUserId?.trim() ||
    null;
  if (expectedUserId && checkoutUserId !== expectedUserId) {
    throw new Error("This checkout session belongs to a different account.");
  }

  const subscription = checkoutSession.subscription;
  if (!subscription || typeof subscription === "string") {
    return null;
  }

  return syncFloorplannerSubscription(subscription, checkoutUserId);
}

export async function validateConfiguredFloorplannerPrice() {
  const price = await getStripe().prices.retrieve(getFloorplannerMonthlyPriceId());
  const isMonthly =
    price.active &&
    price.currency.toLowerCase() === "usd" &&
    price.unit_amount === FLOORPLANNER_MONTHLY_PRICE_CENTS &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1;

  if (!isMonthly) {
    throw new Error(
      "The configured Stripe price must be an active $19.99 USD monthly recurring price.",
    );
  }

  return price;
}
