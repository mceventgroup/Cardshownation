// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE
//
// Auto-saves document state to localStorage. Only the 8 document fields are
// persisted — UI state (selection, tool, zoom, history) is session-scoped.
//
// localStorage is synchronous so there is no hydration flash. The store reads
// on creation and writes via a debounced subscription.
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

const STORAGE_KEY = 'floorplanner:layout'
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
// SAVE
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
    return null
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') return 'quota-exceeded'
    return 'unknown'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────────────────────────────────────

export function loadFromLocalStorage(): DocumentSlice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const payload: PersistedPayload = JSON.parse(raw)
    if (!payload || typeof payload.version !== 'number' || !payload.data) {
      return null
    }

    const migrated = migrate(payload)
    return migrated.data
  } catch {
    // Corrupted data — start fresh
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEAR
// ─────────────────────────────────────────────────────────────────────────────

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS
// ─────────────────────────────────────────────────────────────────────────────

function migrate(payload: PersistedPayload): PersistedPayload {
  if (payload.version > CURRENT_VERSION) {
    // Data was saved by a newer version of the app — do not corrupt it
    throw new Error(`Unsupported layout version: ${payload.version}`)
  }
  // Backfill backgroundImages for older persisted data
  if (!payload.data.backgroundImages) {
    payload.data.backgroundImages = {}
  }

  payload.version = CURRENT_VERSION
  return payload
}
