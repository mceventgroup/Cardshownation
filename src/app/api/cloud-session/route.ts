import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateCloudPassword,
  authorizeCloudRequest,
  clearCloudSessionCookie,
  isCloudAuthConfigured,
  setCloudSessionCookie,
} from '@/lib/server/cloud-auth'

function unavailableResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 503 })
}

export async function GET(request: NextRequest) {
  const available = isCloudAuthConfigured()
  return NextResponse.json({
    available,
    authenticated: available && authorizeCloudRequest(request),
  })
}

export async function POST(request: NextRequest) {
  if (!isCloudAuthConfigured()) {
    return unavailableResponse('Cloud save is not configured on this deployment.')
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  if (!authenticateCloudPassword(body.password)) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 })
  }

  const response = NextResponse.json({ authenticated: true })
  setCloudSessionCookie(response)
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  clearCloudSessionCookie(response)
  return response
}
