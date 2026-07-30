import { NextRequest, NextResponse } from "next/server";
import {
  deleteCloudLayout,
  ensureCloudLayoutsTable,
  getCloudLayout,
  isCloudSaveConfigured,
} from "@floorplanner/lib/server/cloud-layout-store";
import { authorizeCloudRequest, isCloudSessionConfigured } from "@floorplanner/lib/server/cloud-auth";
import { getFloorplannerWorkspaceSession } from "@/lib/floorplanner-workspace-auth";

function unavailableResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function notFoundResponse() {
  return NextResponse.json({ error: "Floorplan not found." }, { status: 404 });
}

function isStandaloneCloudConfigured() {
  return isCloudSessionConfigured() && isCloudSaveConfigured();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getFloorplannerWorkspaceSession();
  if (!session) {
    return unauthorizedResponse();
  }

  if (!isStandaloneCloudConfigured()) {
    return unavailableResponse("Cloud save is not configured.");
  }
  if (!authorizeCloudRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;

  await ensureCloudLayoutsTable();
  const layout = await getCloudLayout(id, {
    userId: session.user.id,
    role: session.role,
    maxCloudProjects: session.maxCloudProjects,
  });
  if (!layout) {
    return notFoundResponse();
  }

  return NextResponse.json({ layout });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getFloorplannerWorkspaceSession();
  if (!session) {
    return unauthorizedResponse();
  }

  if (!isStandaloneCloudConfigured()) {
    return unavailableResponse("Cloud save is not configured.");
  }
  if (!authorizeCloudRequest(request)) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  await ensureCloudLayoutsTable();
  await deleteCloudLayout(id, {
    userId: session.user.id,
    role: session.role,
    maxCloudProjects: session.maxCloudProjects,
  });
  return NextResponse.json({ ok: true });
}
