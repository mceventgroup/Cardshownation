import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateDocumentSlice } from "@floorplanner/lib/document-schema";
import { assertDocumentLimits, MAX_FLOORPLAN_NAME_LENGTH, MAX_FLOORPLAN_REQUEST_BYTES } from "@floorplanner/lib/document-limits";
import { readJsonBodyLimited, RequestTooLargeError } from "@/lib/request-json";
import {
  CloudLayoutConflictError,
  CloudLayoutQuotaError,
  ensureCloudLayoutsTable,
  isCloudSaveConfigured,
  listCloudLayouts,
  upsertCloudLayout,
} from "@floorplanner/lib/server/cloud-layout-store";
import { authorizeCloudRequest, isCloudAuthConfigured } from "@floorplanner/lib/server/cloud-auth";
import { getFloorplannerOperatorSession } from "@/lib/floorplanner-operator-auth";

function unavailableResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

function isStandaloneCloudConfigured() {
  return isCloudAuthConfigured() && isCloudSaveConfigured();
}

export async function GET(request: NextRequest) {
  const session = await getFloorplannerOperatorSession();
  if (!session) {
    return unauthorizedResponse();
  }

  if (!isStandaloneCloudConfigured()) {
    return unavailableResponse("Cloud save is not configured.");
  }
  if (!authorizeCloudRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    await ensureCloudLayoutsTable();
    const layouts = await listCloudLayouts({
      userId: session.user.id,
      role: session.role,
    });
    return NextResponse.json({ layouts });
  } catch {
    return unavailableResponse("Failed to list floorplans.");
  }
}

export async function POST(request: NextRequest) {
  const session = await getFloorplannerOperatorSession();
  if (!session) {
    return unauthorizedResponse();
  }

  if (!isStandaloneCloudConfigured()) {
    return unavailableResponse("Cloud save is not configured.");
  }
  if (!authorizeCloudRequest(request)) {
    return unauthorizedResponse();
  }

  let body: {
    id?: string | null;
    name?: string;
    data?: unknown;
    expectedRevision?: number | null;
  };

  try {
    body = await readJsonBodyLimited<typeof body>(request, MAX_FLOORPLAN_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    return badRequest("Invalid JSON body.");
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return badRequest("Layout name is required.");
  }
  if (body.name.trim().length > MAX_FLOORPLAN_NAME_LENGTH) return badRequest("Layout name is too long.");

  let data;
  try {
    data = validateDocumentSlice(body.data);
    assertDocumentLimits(data);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid floorplan data.");
  }

  try {
    await ensureCloudLayoutsTable();
    const layout = await upsertCloudLayout({
      id: body.id ?? randomUUID(),
      name: body.name.trim(),
      data,
      owner: {
        userId: session.user.id,
        role: session.role,
      },
      expectedRevision:
        typeof body.expectedRevision === "number" ? body.expectedRevision : null,
    });

    return NextResponse.json({ layout });
  } catch (error) {
    if (error instanceof CloudLayoutConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "revision-conflict",
          currentLayout: error.currentLayout,
        },
        { status: 409 },
      );
    }

    if (error instanceof CloudLayoutQuotaError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "quota-exceeded",
          limit: error.limit,
        },
        { status: 409 },
      );
    }

    return unavailableResponse("Failed to save floorplan.");
  }
}
