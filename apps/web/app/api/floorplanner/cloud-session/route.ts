import { NextRequest, NextResponse } from "next/server";
import {
  authorizeCloudRequest,
  clearCloudSessionCookie,
  isCloudSessionConfigured,
  setCloudSessionCookie,
} from "@floorplanner/lib/server/cloud-auth";
import { isCloudSaveConfigured } from "@floorplanner/lib/server/cloud-layout-store";
import { getFloorplannerWorkspaceSession } from "@/lib/floorplanner-workspace-auth";

function getAvailability() {
  return isCloudSessionConfigured() && isCloudSaveConfigured();
}

export async function GET(request: NextRequest) {
  const session = await getFloorplannerWorkspaceSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const available = getAvailability();
  const authenticated = available ? authorizeCloudRequest(request) : false;
  const response = NextResponse.json({
    available,
    authenticated: available,
  });

  if (available && !authenticated) {
    setCloudSessionCookie(response);
  }

  return response;
}

export async function POST(request: NextRequest) {
  const session = await getFloorplannerWorkspaceSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!getAvailability()) {
    return NextResponse.json(
      { error: "Cloud save is not configured." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ authenticated: true });
  setCloudSessionCookie(response);
  return response;
}

export async function DELETE() {
  const session = await getFloorplannerWorkspaceSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: false });
  clearCloudSessionCookie(response);
  return response;
}
