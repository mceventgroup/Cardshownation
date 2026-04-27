import type {
  TableObject,
  Row,
  Section,
  Vendor,
  VendorAssignment,
  CompositeRoom,
  Door,
  LayoutSettings,
  BackgroundImage,
} from '@/domain/types'

const STORAGE_KEY = 'floorplanner:layout'
const MANIFEST_KEY = 'floorplanner:manifest'
const LAYOUT_PREFIX = 'floorplanner:layouts:'
const CURRENT_VERSION = 1
const FILE_APP_TAG = 'floorplanner-1'

export interface DocumentSlice {
  tables: Record<string, TableObject>
  rows: Record<string, Row>
  sections: Record<string, Section>
  vendors: Record<string, Vendor>
  vendorAssignments: Record<string, VendorAssignment>
  room: CompositeRoom | null
  doors: Record<string, Door>
  settings: LayoutSettings
  backgroundImages: Record<string, BackgroundImage>
}

interface PersistedPayload {
  version: number
  data: DocumentSlice
  savedAt: string
}

export interface LayoutEntry {
  id: string
  name: string
  savedAt: string
  tableCount: number
  vendorCount: number
}

interface LayoutManifest {
  activeLayoutId: string | null
  layouts: LayoutEntry[]
}

export function extractDocumentSlice(state: {
  tables: Record<string, TableObject>
  rows: Record<string, Row>
  sections: Record<string, Section>
  vendors: Record<string, Vendor>
  vendorAssignments: Record<string, VendorAssignment>
  room: CompositeRoom | null
  doors: Record<string, Door>
  settings: LayoutSettings
  backgroundImages: Record<string, BackgroundImage>
}): DocumentSlice {
  return {
    tables: state.tables,
    rows: state.rows,
    sections: state.sections,
    vendors: state.vendors,
    vendorAssignments: state.vendorAssignments,
    room: state.room,
    doors: state.doors,
    settings: state.settings,
    backgroundImages: state.backgroundImages,
  }
}

export type SaveError = 'quota-exceeded' | 'unknown'

export function saveToLocalStorage(slice: DocumentSlice): SaveError | null {
  try {
    const payload: PersistedPayload = {
      version: CURRENT_VERSION,
      data: slice,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

    const manifest = loadManifest()
    if (manifest.activeLayoutId) {
      localStorage.setItem(LAYOUT_PREFIX + manifest.activeLayoutId, JSON.stringify(payload))
      const entry = manifest.layouts.find(l => l.id === manifest.activeLayoutId)
      if (entry) {
        entry.savedAt = payload.savedAt
        entry.tableCount = Object.keys(slice.tables).length
        entry.vendorCount = Object.keys(slice.vendors).length
        saveManifest(manifest)
      }
    }

    return null
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') return 'quota-exceeded'
    return 'unknown'
  }
}

export function loadFromLocalStorage(): DocumentSlice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const payload: PersistedPayload = JSON.parse(raw)
    if (!payload || typeof payload.version !== 'number' || !payload.data) {
      return null
    }

    const migrated = migrate(payload)
    migrateToMultiLayout(migrated.data)
    return migrated.data
  } catch {
    return null
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

function loadManifest(): LayoutManifest {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore malformed manifest
  }
  return { activeLayoutId: null, layouts: [] }
}

function saveManifest(manifest: LayoutManifest): void {
  localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest))
}

export function listLayouts(): LayoutEntry[] {
  return loadManifest().layouts
}

export function getActiveLayoutId(): string | null {
  return loadManifest().activeLayoutId
}

export function recoverLayoutsFromStorage(): number {
  const existingManifest = loadManifest()
  const recoveredLayouts: LayoutEntry[] = []
  const seenIds = new Set<string>()

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(LAYOUT_PREFIX)) continue

    const id = key.slice(LAYOUT_PREFIX.length)
    if (!id || seenIds.has(id)) continue

    const raw = localStorage.getItem(key)
    if (!raw) continue

    try {
      const payload = migrate(JSON.parse(raw) as PersistedPayload)
      if (!payload?.data) continue

      const existingEntry = existingManifest.layouts.find(layout => layout.id === id)
      recoveredLayouts.push({
        id,
        name: existingEntry?.name ?? `Recovered Layout ${recoveredLayouts.length + 1}`,
        savedAt: payload.savedAt,
        tableCount: Object.keys(payload.data.tables ?? {}).length,
        vendorCount: Object.keys(payload.data.vendors ?? {}).length,
      })
      seenIds.add(id)
    } catch {
      // Ignore malformed layout payloads during recovery.
    }
  }

  recoveredLayouts.sort((a, b) => b.savedAt.localeCompare(a.savedAt))

  const activeLayoutId =
    existingManifest.activeLayoutId && seenIds.has(existingManifest.activeLayoutId)
      ? existingManifest.activeLayoutId
      : recoveredLayouts[0]?.id ?? null

  saveManifest({
    activeLayoutId,
    layouts: recoveredLayouts,
  })

  if (activeLayoutId) {
    const raw = localStorage.getItem(LAYOUT_PREFIX + activeLayoutId)
    if (raw) {
      try {
        const payload = migrate(JSON.parse(raw) as PersistedPayload)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // Ignore malformed active payload during recovery.
      }
    }
  }

  return recoveredLayouts.length
}

export function saveLayoutAs(name: string, slice: DocumentSlice): string {
  const id = 'layout-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const payload: PersistedPayload = {
    version: CURRENT_VERSION,
    data: slice,
    savedAt: now,
  }

  localStorage.setItem(LAYOUT_PREFIX + id, JSON.stringify(payload))

  const manifest = loadManifest()
  manifest.layouts.push({
    id,
    name,
    savedAt: now,
    tableCount: Object.keys(slice.tables).length,
    vendorCount: Object.keys(slice.vendors).length,
  })
  manifest.activeLayoutId = id
  saveManifest(manifest)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  return id
}

export function loadLayout(id: string): DocumentSlice | null {
  try {
    const raw = localStorage.getItem(LAYOUT_PREFIX + id)
    if (!raw) return null

    const payload: PersistedPayload = JSON.parse(raw)
    if (!payload?.data) return null

    const migrated = migrate(payload)
    const manifest = loadManifest()
    manifest.activeLayoutId = id
    saveManifest(manifest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    return migrated.data
  } catch {
    return null
  }
}

export function renameLayout(id: string, newName: string): void {
  const manifest = loadManifest()
  const entry = manifest.layouts.find(l => l.id === id)
  if (entry) {
    entry.name = newName
    saveManifest(manifest)
  }
}

export function clearAllLayouts(): void {
  const manifest = loadManifest()
  for (const layout of manifest.layouts) {
    localStorage.removeItem(LAYOUT_PREFIX + layout.id)
  }
  localStorage.removeItem(MANIFEST_KEY)
  localStorage.removeItem(STORAGE_KEY)
}

export function deleteLayout(id: string): void {
  localStorage.removeItem(LAYOUT_PREFIX + id)
  const manifest = loadManifest()
  manifest.layouts = manifest.layouts.filter(l => l.id !== id)
  if (manifest.activeLayoutId === id) {
    manifest.activeLayoutId = manifest.layouts[0]?.id ?? null
  }
  saveManifest(manifest)
}

export function migrateToMultiLayout(legacySlice?: DocumentSlice | null): void {
  const manifest = loadManifest()
  if (manifest.layouts.length > 0) return

  const slice = legacySlice
  if (!slice) return

  const hasContent = Object.keys(slice.tables).length > 0 || slice.room !== null
  if (!hasContent) return

  saveLayoutAs('Default Layout', slice)
}

export function saveToFile(slice: DocumentSlice, layoutName: string): void {
  const payload = {
    appVersion: FILE_APP_TAG,
    version: CURRENT_VERSION,
    savedAt: new Date().toISOString(),
    data: slice,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(layoutName || 'floorplan').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseFilePayload(jsonText: string): DocumentSlice {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(jsonText)
  } catch {
    throw new Error('File is not valid JSON.')
  }

  if (!payload || typeof payload.version !== 'number' || !payload.data) {
    throw new Error('File does not look like a Floorplanner layout.')
  }

  const migrated = migrate(payload as unknown as PersistedPayload)
  return migrated.data
}

function migrate(payload: PersistedPayload): PersistedPayload {
  if (payload.version > CURRENT_VERSION) {
    throw new Error(`Unsupported layout version: ${payload.version}`)
  }
  if (!payload.data.backgroundImages) {
    payload.data.backgroundImages = {}
  }
  // Backfill premium flag on existing tables and vendors
  for (const t of Object.values(payload.data.tables)) {
    if ((t as { premium?: boolean }).premium === undefined) {
      (t as { premium: boolean }).premium = false
    }
  }
  for (const v of Object.values(payload.data.vendors)) {
    if ((v as { premium?: boolean }).premium === undefined) {
      (v as { premium: boolean }).premium = false
    }
  }

  payload.version = CURRENT_VERSION
  return payload
}
