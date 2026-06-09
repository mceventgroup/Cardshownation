import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const CLOUD_SESSION_COOKIE = 'floorplanner_cloud_session'
const CLOUD_SESSION_TTL_SECONDS = 60 * 60 * 12

type SessionPayload = {
  scope: 'cloud'
  exp: number
}

function getCloudPassword(): string {
  const value = process.env.FLOORPLANNER_ADMIN_PASSWORD ?? process.env.FLOORPLANNER_SAVE_KEY
  if (!value) {
    throw new Error('FLOORPLANNER_ADMIN_PASSWORD is not configured.')
  }
  return value
}

function getSessionSecret(): string {
  const value = process.env.FLOORPLANNER_SESSION_SECRET
  if (!value) {
    throw new Error('FLOORPLANNER_SESSION_SECRET is not configured.')
  }
  return value
}

function sign(payloadBase64: string): string {
  return createHmac('sha256', getSessionSecret())
    .update(payloadBase64)
    .digest('base64url')
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SessionPayload
    if (parsed.scope !== 'cloud' || typeof parsed.exp !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function isCloudAuthConfigured(): boolean {
  return Boolean((process.env.FLOORPLANNER_ADMIN_PASSWORD ?? process.env.FLOORPLANNER_SAVE_KEY) && process.env.FLOORPLANNER_SESSION_SECRET)
}

export function authenticateCloudPassword(providedPassword: string | null | undefined): boolean {
  if (!providedPassword) return false

  const expected = Buffer.from(getCloudPassword())
  const received = Buffer.from(providedPassword)
  if (expected.length !== received.length) return false

  return timingSafeEqual(expected, received)
}

export function createCloudSessionToken(now = Date.now()): string {
  const payloadBase64 = encodePayload({
    scope: 'cloud',
    exp: now + CLOUD_SESSION_TTL_SECONDS * 1000,
  })
  return `${payloadBase64}.${sign(payloadBase64)}`
}

export function isCloudSessionAuthorized(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false

  const [payloadBase64, signature] = token.split('.')
  if (!payloadBase64 || !signature) return false

  const expectedSignature = Buffer.from(sign(payloadBase64))
  const receivedSignature = Buffer.from(signature)
  if (expectedSignature.length !== receivedSignature.length) return false
  if (!timingSafeEqual(expectedSignature, receivedSignature)) return false

  const payload = decodePayload(payloadBase64)
  if (!payload) return false

  return payload.exp > now
}

export function authorizeCloudRequest(request: Pick<NextRequest, 'cookies'>): boolean {
  return isCloudSessionAuthorized(request.cookies.get(CLOUD_SESSION_COOKIE)?.value)
}

export function setCloudSessionCookie(response: NextResponse, now = Date.now()): void {
  response.cookies.set(CLOUD_SESSION_COOKIE, createCloudSessionToken(now), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CLOUD_SESSION_TTL_SECONDS,
  })
}

export function clearCloudSessionCookie(response: NextResponse): void {
  response.cookies.set(CLOUD_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
