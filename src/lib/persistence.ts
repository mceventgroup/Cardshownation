// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
//
// Auto-saves document state to localStorage. Only the document fields are
// persisted — UI state (selection, tool, zoom, history) is session-scoped.
//
// Supports multiple named layouts via a manifest + per-layout storage keys.
// ─────────────────────────────────────────────────────────────────────────────

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

const STORAGE_KEY = 'floorplanner:layout'           // legacy single layout
const MANIFEST_KEY = 'floorplanner:manifest'         // layout index
const LAYOUT_PREFIX = 'floorplanner:layouts:'        // per-layout prefix
const CURRENT_VERSION = 1

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The subset of EditorState that gets persisted. */
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

/** Entry in the layout manifest. */
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

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT
// ─────────────────────────────────────────────────────────────────────────────

/** Pick only the document fields from the full store state. */
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

// ─────────────────────────────────────────────────────────────────────────────
// SAVE / LOAD — active layout (autosave target)
// ─────────────────────────────────────────────────────────────────────────────

export type SaveError = 'quota-exceeded' | 'unknown'

export function saveToLocalStorage(slice: DocumentSlice): SaveError | null {
  try {
    const payload: PersistedPayload = {
      version: CURRENT_VERSION,
      data: slice,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

    // Also update the active layout in multi-layout storage
    const manifest = loadManifest()
    if (manifest.activeLayoutId) {
      localStorage.setItem(
        LAYOUT_PREFIX + manifest.activeLayoutId,
        JSON.stringify(payload),
      )
      // Update manifest entry stats
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
    // Migrate legacy single-layout to multi-layout on first load
    migrateToMultiLayout()
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

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-LAYOUT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function loadManifest(): LayoutManifest {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { activeLayoutId: null, layouts: [] }
}

function saveManifest(manifest: LayoutManifest): void {
  localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest))
}

/** List all saved layouts. */
export function listLayouts(): LayoutEntry[] {
  return loadManifest().layouts
}

/** Get the active layout ID. */
export function getActiveLayoutId(): string | null {
  return loadManifest().activeLayoutId
}

/** Save current data as a new named layout. Returns the new layout ID. */
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

  // Also set as the active autosave target
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

  return id
}

/** Load a specific layout by ID. Returns null if not found. */
export function loadLayout(id: string): DocumentSlice | null {
  try {
    const raw = localStorage.getItem(LAYOUT_PREFIX + id)
    if (!raw) return null
    const payload: PersistedPayload = JSON.parse(raw)
    if (!payload?.data) return null
    const migrated = migrate(payload)

    // Set as active
    const manifest = loadManifest()
    manifest.activeLayoutId = id
    saveManifest(manifest)

    // Also update the main autosave key
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))

    return migrated.data
  } catch {
    return null
  }
}

/** Rename a saved layout. */
export function renameLayout(id: string, newName: string): void {
  const manifest = loadManifest()
  const entry = manifest.layouts.find(l => l.id === id)
  if (entry) {
    entry.name = newName
    saveManifest(manifest)
  }
}

/** Delete a saved layout. */
export function deleteLayout(id: string): void {
  localStorage.removeItem(LAYOUT_PREFIX + id)
  const manifest = loadManifest()
  manifest.layouts = manifest.layouts.filter(l => l.id !== id)
  if (manifest.activeLayoutId === id) {
    manifest.activeLayoutId = manifest.layouts[0]?.id ?? null
  }
  saveManifest(manifest)
}

/** Migrate legacy single-layout storage to multi-layout if needed. */
export function migrateToMultiLayout(): void {
  const manifest = loadManifest()
  // Already migrated or has layouts
  if (manifest.layouts.length > 0) return

  // Check if legacy data exists
  const slice = loadFromLocalStorage()
  if (!slice) return

  // Only migrate if there's actual content
  const hasContent = Object.keys(slice.tables).length > 0 || slice.room !== null
  if (!hasContent) return

  saveLayoutAs('Default Layout', slice)
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE SAVE / LOAD (download + upload JSON)
// ─────────────────────────────────────────────────────────────────────────────

const FILE_APP_TAG = 'floorplanner-1'

/** Trigger a JSON file download of the current layout. */
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

/** Parse a JSON file string back into a DocumentSlice. Throws on invalid input. */
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

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS
// ─────────────────────────────────────────────────────────────────────────────

function migrate(payload: PersistedPayload): PersistedPayload {
  if (payload.version > CURRENT_VERSION) {
    throw new Error(`Unsupported layout version: ${payload.version}`)
  }
  if (!payload.data.backgroundImages) {
    payload.data.backgroundImages = {}
  }

  payload.version = CURRENT_VERSION
  return payload
}
