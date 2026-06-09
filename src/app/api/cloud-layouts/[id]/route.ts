import { NextRequest, NextResponse } from 'next/server'
import { authorizeCloudRequest, isCloudAuthConfigured } from '@/lib/server/cloud-auth'
import {
  deleteCloudLayout,
  ensureCloudLayoutsTable,
  getCloudLayout,
  isCloudSaveConfigured,
} from '@/lib/server/cloud-layout-store'

const LAYOUT_ID_PATTERN = /^layout-[a-z0-9]+$/

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
}

function unavailableResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 503 })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isCloudSaveConfigured() || !isCloudAuthConfigured()) {
    return unavailableResponse('Cloud save is not configured on this deployment.')
  }
  if (!authorizeCloudRequest(request)) {
    return unauthorizedResponse()
  }

  try {
    await ensureCloudLayoutsTable()
    const { id } = await context.params
    if (!LAYOUT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Invalid layout ID.' }, { status: 400 })
    }
    const layout = await getCloudLayout(id)
    if (!layout || !layout.data) {
      return NextResponse.json({ error: 'Cloud layout not found.' }, { status: 404 })
    }

    return NextResponse.json({
      layout: {
        id: layout.id,
        name: layout.name,
        savedAt: layout.saved_at,
        revision: layout.revision,
        tableCount: layout.table_count,
        vendorCount: layout.vendor_count,
        data: layout.data,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load cloud layout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isCloudSaveConfigured() || !isCloudAuthConfigured()) {
    return unavailableResponse('Cloud save is not configured on this deployment.')
  }
  if (!authorizeCloudRequest(request)) {
    return unauthorizedResponse()
  }

  try {
    await ensureCloudLayoutsTable()
    const { id } = await context.params
    if (!LAYOUT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Invalid layout ID.' }, { status: 400 })
    }
    await deleteCloudLayout(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete cloud layout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
