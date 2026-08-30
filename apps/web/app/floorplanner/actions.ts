"use server";

import { redirect } from "next/navigation";
import {
  getFloorplannerSubscription,
  isFloorplannerSubscriptionActive,
  validateConfiguredFloorplannerPrice,
} from "@/lib/floorplanner-billing";
import { getFloorplannerCustomerSession } from "@/lib/floorplanner-workspace-auth";
import {
  getAppUrl,
  getFloorplannerMonthlyPriceId,
  getStripe,
} from "@/lib/stripe";
import { isPurchasingEnabled } from "@/lib/purchasing";

const REUSABLE_SUBSCRIPTION_STATUSES = new Set([
  "incomplete",
  "past_due",
  "unpaid",
  "paused",
]);

export async function startFloorplannerCheckout() {
  if (!isPurchasingEnabled()) {
    redirect("/floorplanner?billing=paused");
  }

  const customerSession = await getFloorplannerCustomerSession();
  if (!customerSession) {
    redirect("/login?from=%2Ffloorplanner");
  }

  const existing = await getFloorplannerSubscription(customerSession.user.id);
  if (isFloorplannerSubscriptionActive(existing)) {
    redirect("/floorplanner/workspace");
  }

  if (existing && REUSABLE_SUBSCRIPTION_STATUSES.has(existing.status)) {
    let portalUrl: string;
    try {
      const portal = await getStripe().billingPortal.sessions.create({
        customer: existing.stripeCustomerId,
        return_url: `${getAppUrl()}/floorplanner`,
      });
      portalUrl = portal.url;
    } catch (error) {
      console.error("[floorplanner billing] portal creation failed", error);
      redirect("/floorplanner?billing=unavailable");
    }
    redirect(portalUrl);
  }

  let checkoutUrl: string | null;
  try {
    await validateConfiguredFloorplannerPrice();

    const checkout = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: existing?.stripeCustomerId,
      customer_email: existing ? undefined : customerSession.user.email,
      client_reference_id: customerSession.user.id,
      line_items: [
        {
          price: getFloorplannerMonthlyPriceId(),
          quantity: 1,
        },
      ],
      metadata: {
        csnUserId: customerSession.user.id,
        csnProduct: "floorplanner",
      },
      subscription_data: {
        metadata: {
          csnUserId: customerSession.user.id,
          csnProduct: "floorplanner",
        },
      },
      allow_promotion_codes: true,
      success_url: `${getAppUrl()}/floorplanner?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getAppUrl()}/floorplanner?checkout=cancelled`,
    });
    checkoutUrl = checkout.url;
  } catch (error) {
    console.error("[floorplanner billing] checkout creation failed", error);
    redirect("/floorplanner?billing=unavailable");
  }

  if (!checkoutUrl) {
    redirect("/floorplanner?billing=unavailable");
  }

  redirect(checkoutUrl);
}

export async function openFloorplannerBillingPortal() {
  const customerSession = await getFloorplannerCustomerSession();
  if (!customerSession) {
    redirect("/login?from=%2Ffloorplanner%2Fbilling");
  }

  const subscription = await getFloorplannerSubscription(customerSession.user.id);
  if (!subscription) {
    redirect("/floorplanner");
  }

  let portalUrl: string;
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getAppUrl()}/floorplanner/billing`,
    });
    portalUrl = portal.url;
  } catch (error) {
    console.error("[floorplanner billing] portal creation failed", error);
    redirect("/floorplanner?billing=unavailable");
  }
  redirect(portalUrl);
}
