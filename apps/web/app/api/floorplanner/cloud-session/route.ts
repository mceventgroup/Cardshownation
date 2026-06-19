import { NextRequest, NextResponse } from "next/server";
import {
  authenticateCloudPassword,
  authorizeCloudRequest,
  clearCloudSessionCookie,
  isCloudAuthConfigured,
  setCloudSessionCookie,
} from "@floorplanner/lib/server/cloud-auth";
import { isCloudSaveConfigured } from "@floorplanner/lib/server/cloud-layout-store";
import { getFloorplannerOperatorSession } from "@/lib/floorplanner-operator-auth";

function getAvailability() {
  return isCloudAuthConfigured() && isCloudSaveConfigured();
}

export async function GET(request: NextRequest) {
  const session = await getFloorplannerOperatorSession();
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
  const session = await getFloorplannerOperatorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!getAvailability()) {
    return NextResponse.json(
      { error: "Cloud save is not configured." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!authenticateCloudPassword(body.password?.trim())) {
    return NextResponse.json({ error: "Invalid cloud admin password." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  setCloudSessionCookie(response);
  return response;
}

export async function DELETE() {
  const session = await getFloorplannerOperatorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: false });
  clearCloudSessionCookie(response);
  return response;
}
