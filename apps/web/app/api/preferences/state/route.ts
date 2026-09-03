import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import {
  normalizePreferredState,
  PREFERRED_STATE_COOKIE_NAME,
  PREFERRED_STATE_MAX_AGE_SECONDS,
} from "@/lib/preferred-state";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const state = normalizePreferredState(
    body && typeof body === "object" && "state" in body
      ? String((body as { state?: unknown }).state ?? "")
      : null,
  );
  if (!state) {
    return NextResponse.json({ error: "Choose a valid state." }, { status: 400 });
  }

  const session = await getUserSession();
  if (session) {
    await db.user.update({
      where: { id: session.user.id },
      data: { state },
    });
  }

  const response = NextResponse.json({ savedToAccount: Boolean(session) });
  response.cookies.set(PREFERRED_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    maxAge: PREFERRED_STATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
