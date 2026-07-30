import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  syncFloorplannerCheckoutSession,
  syncFloorplannerSubscription,
} from "@/lib/floorplanner-billing";
import { db } from "@/lib/db";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function processStripeEvent(event: Stripe.Event) {
  let userId: string | null = null;

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object;
    const record = await syncFloorplannerCheckoutSession(
      checkoutSession.id,
      checkoutSession.client_reference_id ?? undefined,
    );
    userId = record?.userId ?? null;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const record = await syncFloorplannerSubscription(event.data.object);
    userId = record?.userId ?? null;
  }

  await db.billingWebhookEvent.create({
    data: {
      id: event.id,
      type: event.type,
      userId,
    },
  });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook." }, { status: 400 });
  }

  const existing = await db.billingWebhookEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await processStripeEvent(event);
  } catch (error) {
    console.error("[stripe webhook] processing failed", {
      eventId: event.id,
      eventType: event.type,
      error,
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
