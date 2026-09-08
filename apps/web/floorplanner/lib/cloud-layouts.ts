import type { DocumentSlice } from '@floorplanner/lib/persistence'
import { getFloorplannerCloudBasePath } from '@floorplanner/lib/runtime'

export interface CloudLayoutSummary {
  id: string
  name: string
  savedAt: string
  revision: number
  tableCount: number
  vendorCount: number
}

export interface CloudLayoutRecord extends CloudLayoutSummary {
  data: DocumentSlice
}

interface ErrorPayload {
  error?: string
  code?: string
  currentLayout?: CloudLayoutSummary | null
  limit?: number
}

export interface CloudSessionStatus {
  available: boolean
  authenticated: boolean
}

export class CloudRevisionConflictError extends Error {
  currentLayout: CloudLayoutSummary | null

  constructor(message: string, currentLayout: CloudLayoutSummary | null) {
    super(message)
    this.name = 'CloudRevisionConflictError'
    this.currentLayout = currentLayout
  }
}

export class CloudRequestError extends Error {
  constructor(message: string, public status: number, public retryAfterMs: number) { super(message) }
}

export class CloudQuotaExceededError extends Error {
  limit: number | null

  constructor(message: string, limit: number | null) {
    super(message)
    this.name = 'CloudQuotaExceededError'
    this.limit = limit
  }
}

async function readError(response: Response): Promise<ErrorPayload> {
  try {
    const payload = await response.json() as ErrorPayload
    if (payload?.error) return payload
  } catch {
    // Ignore malformed error payloads.
  }
  return { error: `Request failed (${response.status})` }
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) return

  const payload = await readError(response)
  if (response.status === 409 && payload.code === 'revision-conflict') {
    throw new CloudRevisionConflictError(
      payload.error ?? `Request failed (${response.status})`,
      payload.currentLayout ?? null,
    )
  }
  if (response.status === 409 && payload.code === 'quota-exceeded') {
    throw new CloudQuotaExceededError(
      payload.error ?? `Request failed (${response.status})`,
      typeof payload.limit === 'number' ? payload.limit : null,
    )
  }
  const retryAfter = response.headers.get('Retry-After')
  const seconds = Number(retryAfter)
  const retryAfterMs = retryAfter && Number.isFinite(seconds) ? seconds * 1000 : 0
  throw new CloudRequestError(payload.error ?? `Request failed (${response.status})`, response.status, retryAfterMs)
}

function getCloudUrl(pathname: string): string {
  const basePath = getFloorplannerCloudBasePath()
  if (!basePath) {
    throw new Error('Cloud save is not configured for this floorplanner route.')
  }
  return `${basePath}${pathname}`
}

export async function getCloudSession(): Promise<CloudSessionStatus> {
  const response = await fetch(getCloudUrl('/cloud-session'), {
    credentials: 'same-origin',
  })
  await assertOk(response)
  return await response.json() as CloudSessionStatus
}

export async function loginCloudSession(password: string): Promise<void> {
  const response = await fetch(getCloudUrl('/cloud-session'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password }),
  })
  await assertOk(response)
}

export async function logoutCloudSession(): Promise<void> {
  const response = await fetch(getCloudUrl('/cloud-session'), {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  await assertOk(response)
}

export async function listCloudLayouts(): Promise<CloudLayoutSummary[]> {
  const response = await fetch(getCloudUrl('/cloud-layouts'), {
    credentials: 'same-origin',
  })
  await assertOk(response)

  const payload = await response.json() as { layouts: CloudLayoutSummary[] }
  return payload.layouts
}

export async function saveCloudLayout(input: {
  id?: string | null
  name: string
  data: DocumentSlice
  expectedRevision?: number | null
}): Promise<CloudLayoutSummary> {
  const response = await fetch(getCloudUrl('/cloud-layouts'), {
    signal: AbortSignal.timeout(20000),
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: input.id ?? null,
      name: input.name,
      data: input.data,
      expectedRevision: input.expectedRevision ?? null,
    }),
  })
  await assertOk(response)

  const payload = await response.json() as { layout: CloudLayoutSummary }
  return payload.layout
}

export async function loadCloudLayout(id: string): Promise<CloudLayoutRecord> {
  const response = await fetch(getCloudUrl(`/cloud-layouts/${encodeURIComponent(id)}`), {
    credentials: 'same-origin',
  })
  await assertOk(response)

  const payload = await response.json() as { layout: CloudLayoutRecord }
  return payload.layout
}

export async function deleteCloudLayout(id: string): Promise<void> {
  const response = await fetch(getCloudUrl(`/cloud-layouts/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  await assertOk(response)
}
