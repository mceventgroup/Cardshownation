import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function verifyWebhook(body: string, id: string, timestamp: string, signatures: string, secret: string) {
  const unixSeconds = Number(timestamp);
  if (!Number.isFinite(unixSeconds) || Math.abs(Date.now() / 1000 - unixSeconds) > 300) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(" ").some((entry) => {
    const encoded = entry.startsWith("v1,") ? entry.slice(3) : "";
    if (!encoded) return false;
    const received = Buffer.from(encoded, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhook unavailable." }, { status: 503 });
  const body = await request.text();
  const id = request.headers.get("svix-id") ?? "";
  const timestamp = request.headers.get("svix-timestamp") ?? "";
  const signature = request.headers.get("svix-signature") ?? "";
  if (!verifyWebhook(body, id, timestamp, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = JSON.parse(body) as { type?: string; data?: { to?: string | string[] } };
  if (event.type === "email.bounced" || event.type === "email.complained") {
    const recipients = Array.isArray(event.data?.to) ? event.data.to : event.data?.to ? [event.data.to] : [];
    for (const value of recipients) {
      const email = value.trim().toLowerCase();
      if (!email) continue;
      await db.emailSuppression.upsert({
        where: { email },
        create: { email, reason: event.type },
        update: { reason: event.type },
      });
    }
  }
  return NextResponse.json({ received: true });
}
