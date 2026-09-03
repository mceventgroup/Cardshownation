import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";

export async function GET(request: NextRequest) {
  if (isFixtureMode()) return NextResponse.json({ venues: [] });
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const state = request.nextUrl.searchParams.get("state")?.trim().toUpperCase() ?? "";
  if (q.length < 2) return NextResponse.json({ venues: [] });
  try {
    const venues = await db.venue.findMany({ where: { name: { contains: q, mode: "insensitive" }, ...(state ? { state } : {}) }, select: { id: true, name: true, address1: true, city: true, state: true }, orderBy: { name: "asc" }, take: 6 });
    return NextResponse.json({ venues });
  } catch {
    return NextResponse.json({ venues: [] });
  }
}
