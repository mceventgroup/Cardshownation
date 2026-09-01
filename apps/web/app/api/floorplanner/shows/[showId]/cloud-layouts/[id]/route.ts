import { NextRequest, NextResponse } from "next/server";
import { deleteShowFloorplan, getShowFloorplan } from "@/lib/floorplans";
import { enforceFloorplannerMutationRateLimit } from "@/lib/floorplanner-rate-limit";
import { getFloorplanAccess, unauthorizedResponse } from "../../shared";

function notFoundResponse() {
  return NextResponse.json({ error: "Floorplan not found." }, { status: 404 });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ showId: string; id: string }> }
) {
  const { showId, id } = await context.params;
  const access = await getFloorplanAccess(showId);
  if (!access) {
    return unauthorizedResponse();
  }

  const layout = await getShowFloorplan(showId, id);
  if (!layout) {
    return notFoundResponse();
  }

  return NextResponse.json({ layout });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ showId: string; id: string }> }
) {
  const { showId, id } = await context.params;
  const access = await getFloorplanAccess(showId);
  if (!access) {
    return unauthorizedResponse();
  }

  const rateLimitResponse = await enforceFloorplannerMutationRateLimit(access.actorUserId);
  if (rateLimitResponse) return rateLimitResponse;

  await deleteShowFloorplan(showId, id);
  return NextResponse.json({ ok: true });
}
