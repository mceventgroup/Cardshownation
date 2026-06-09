import { NextRequest, NextResponse } from 'next/server'
import { createLayoutId } from '@/lib/id'
import { validateDocumentSlice } from '@/lib/document-schema'
import { authorizeCloudRequest, isCloudAuthConfigured } from '@/lib/server/cloud-auth'
import {
  CloudLayoutConflictError,
  ensureCloudLayoutsTable,
  isCloudSaveConfigured,
  listCloudLayouts,
  upsertCloudLayout,
} from '@/lib/server/cloud-layout-store'
import type { DocumentSlice } from '@/lib/persistence'

const MAX_REQUEST_BYTES = 10 * 1024 * 1024
const LAYOUT_ID_PATTERN = /^layout-[a-z0-9]+$/

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
}

function unavailableResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 503 })
}

function summaryFromRow(row: {
  id: string
  name: string
  saved_at: string
  revision: number
  table_count: number
  vendor_count: number
}) {
  return {
    id: row.id,
    name: row.name,
    savedAt: row.saved_at,
    revision: row.revision,
    tableCount: row.table_count,
    vendorCount: row.vendor_count,
  }
}

export async function GET(request: NextRequest) {
  if (!isCloudSaveConfigured() || !isCloudAuthConfigured()) {
    return unavailableResponse('Cloud save is not configured on this deployment.')
  }
  if (!authorizeCloudRequest(request)) {
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
  if (!isCloudSaveConfigured() || !isCloudAuthConfigured()) {
    return unavailableResponse('Cloud save is not configured on this deployment.')
  }
  if (!authorizeCloudRequest(request)) {
    return unauthorizedResponse()
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const size = Number(contentLength)
    if (Number.isFinite(size) && size > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
    }
  }

  let body: { id?: string | null; name?: string; data?: unknown; expectedRevision?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const name = body.name?.trim()
  const layoutId = body.id?.trim() || null
  if (!name) {
    return NextResponse.json({ error: 'Layout name is required.' }, { status: 400 })
  }
  if (name.length > 200) {
    return NextResponse.json({ error: 'Layout name must be 200 characters or fewer.' }, { status: 400 })
  }
  if (layoutId && !LAYOUT_ID_PATTERN.test(layoutId)) {
    return NextResponse.json({ error: 'Invalid layout ID format.' }, { status: 400 })
  }
  if (!body.data) {
    return NextResponse.json({ error: 'Layout data is required.' }, { status: 400 })
  }
  if (body.expectedRevision !== undefined && body.expectedRevision !== null && (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 1)) {
    return NextResponse.json({ error: 'expectedRevision must be a positive integer or null.' }, { status: 400 })
  }

  let data: DocumentSlice
  try {
    data = validateDocumentSlice(body.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Layout data is invalid.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    await ensureCloudLayoutsTable()
    const layout = await upsertCloudLayout({
      id: layoutId || createLayoutId(),
      name,
      data,
      expectedRevision: body.expectedRevision ?? null,
    })
    return NextResponse.json({
      layout: summaryFromRow(layout),
    })
  } catch (error) {
    if (error instanceof CloudLayoutConflictError) {
      return NextResponse.json({
        error: error.message,
        code: 'revision-conflict',
        currentLayout: error.currentLayout ? summaryFromRow(error.currentLayout) : null,
      }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to save cloud layout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
