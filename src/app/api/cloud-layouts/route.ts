import { NextRequest, NextResponse } from 'next/server'
import { createLayoutId } from '@/lib/id'
import {
  authorizeCloudRequest,
  ensureCloudLayoutsTable,
  isCloudSaveConfigured,
  listCloudLayouts,
  upsertCloudLayout,
} from '@/lib/server/cloud-layout-store'
import type { DocumentSlice } from '@/lib/persistence'

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Invalid save key.' }, { status: 401 })
}

function unavailableResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 503 })
}

function summaryFromRow(row: {
  id: string
  name: string
  saved_at: string
  table_count: number
  vendor_count: number
}) {
  return {
    id: row.id,
    name: row.name,
    savedAt: row.saved_at,
    tableCount: row.table_count,
    vendorCount: row.vendor_count,
  }
}

export async function GET(request: NextRequest) {
  if (!isCloudSaveConfigured()) {
    return unavailableResponse('Cloud save is not configured on this deployment.')
  }
  if (!authorizeCloudRequest(request.headers.get('x-floorplanner-key'))) {
    return unauthorizedResponse()
  }

  try {
    await ensureCloudLayoutsTable()
    const layouts = await listCloudLayouts()
    return NextResponse.json({
      layouts: layouts.map(summaryFromRow),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list cloud layouts.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isCloudSaveConfigured()) {
    return unavailableResponse('Cloud save is not configured on this deployment.')
  }
  if (!authorizeCloudRequest(request.headers.get('x-floorplanner-key'))) {
    return unauthorizedResponse()
  }

  let body: { id?: string | null; name?: string; data?: DocumentSlice }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Layout name is required.' }, { status: 400 })
  }
  if (!body.data) {
    return NextResponse.json({ error: 'Layout data is required.' }, { status: 400 })
  }

  try {
    await ensureCloudLayoutsTable()
    const layout = await upsertCloudLayout({
      id: body.id?.trim() || createLayoutId(),
      name,
      data: body.data,
    })
    return NextResponse.json({
      layout: summaryFromRow(layout),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save cloud layout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
