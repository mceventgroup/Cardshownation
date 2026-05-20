import type { DocumentSlice } from '@/lib/persistence'

export interface CloudLayoutSummary {
  id: string
  name: string
  savedAt: string
  tableCount: number
  vendorCount: number
}

export interface CloudLayoutRecord extends CloudLayoutSummary {
  data: DocumentSlice
}

interface ErrorPayload {
  error?: string
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as ErrorPayload
    if (payload?.error) return payload.error
  } catch {
    // Ignore malformed error payloads.
  }
  return `Request failed (${response.status})`
}

export async function listCloudLayouts(saveKey: string): Promise<CloudLayoutSummary[]> {
  const response = await fetch('/api/cloud-layouts', {
    headers: {
      'x-floorplanner-key': saveKey,
    },
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  const payload = await response.json() as { layouts: CloudLayoutSummary[] }
  return payload.layouts
}

export async function saveCloudLayout(input: {
  id?: string | null
  name: string
  data: DocumentSlice
  saveKey: string
}): Promise<CloudLayoutSummary> {
  const response = await fetch('/api/cloud-layouts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-floorplanner-key': input.saveKey,
    },
    body: JSON.stringify({
      id: input.id ?? null,
      name: input.name,
      data: input.data,
    }),
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  const payload = await response.json() as { layout: CloudLayoutSummary }
  return payload.layout
}

export async function loadCloudLayout(id: string, saveKey: string): Promise<CloudLayoutRecord> {
  const response = await fetch(`/api/cloud-layouts/${encodeURIComponent(id)}`, {
    headers: {
      'x-floorplanner-key': saveKey,
    },
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  const payload = await response.json() as { layout: CloudLayoutRecord }
  return payload.layout
}

export async function deleteCloudLayout(id: string, saveKey: string): Promise<void> {
  const response = await fetch(`/api/cloud-layouts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-floorplanner-key': saveKey,
    },
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }
}
