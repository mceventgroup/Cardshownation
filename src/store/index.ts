// ─────────────────────────────────────────────────────────────────────────────
// EDITOR STORE
//
// Single Zustand store with immer middleware.
// Sections and rows will be added as slices in later phases.
//
// State split:
//   canvas   — serializable document state (tables, settings)
//   history  — undo/redo stack (not serialized)
//   ui       — ephemeral view state (selection, tool, zoom, pan)
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

enableMapSet()
import type { TableObject, Row, Section, Vendor, VendorAssignment, Door, CompositeRoom, LayoutSettings, Point, SectionId, VendorId, RoomSegmentId, RowId, UserId, BackgroundImage, BackgroundImageId } from '@/domain/types'
import type { LayoutCommand, CommandHistory } from '@/domain/commands'
import { EMPTY_HISTORY } from '@/domain/commands'
import type { ImportSession, FieldMapping, ConflictResolution } from '@/domain/document'
import { DEFAULT_SETTINGS, DRAFT_LAYOUT_ID } from '@/lib/defaults'
import {
  loadFromLocalStorage, extractDocumentSlice, saveToLocalStorage, clearLocalStorage,
  saveLayoutAs, loadLayout, restoreBackgroundImagePayloads, saveToFile as saveToFileLib, parseFilePayload,
  type DocumentSlice,
} from '@/lib/persistence'
import { csvImportModule, expandTableNumbers } from '@/domain/csv-import.impl'
import { getDefaultRoomId, syncRoomFieldsForTables } from '@/domain/room-numbering'
import { createImportSessionId, createAssignmentId, createVendorId } from '@/lib/id'
import { applyCommand, reverseCommand } from './executor'

const DEFAULT_COLLAPSED_PANELS = new Set<string>([
  'tools',
  'room',
  'doors',
  'sections',
  'warnings',
  'settings-canvas',
  'settings-spacing',
  'settings-table-defaults',
])

// Load persisted document state (client-only — avoids SSR/client hydration mismatch)
function safeAssignDefined<T extends object>(target: T, updates: Partial<T>): void {
  const blocked = new Set(['__proto__', 'constructor', 'prototype'])
  for (const key of Object.keys(updates) as Array<keyof T>) {
    if (blocked.has(key as string)) continue
    const value = updates[key]
    if (value !== undefined) {
      target[key] = value
    }
  }
}

function applyDocumentSliceToState(state: EditorState, slice: DocumentSlice): void {
  state.tables = syncRoomFieldsForTables(slice.tables, slice.room, slice.sections)
  state.rows = slice.rows
  state.sections = slice.sections
  state.vendors = slice.vendors
  state.vendorAssignments = slice.vendorAssignments
  state.room = slice.room
  state.activeRoomId = getDefaultRoomId(slice.room)
  state.doors = slice.doors
  state.backgroundImages = slice.backgroundImages
  state.settings = slice.settings
  state.selectedIds = new Set()
  state.activeTool = 'select'
  state.activeVendorId = null
  state.hoveredVendorId = null
  state.selectedDoorId = null
  state.selectedSegmentId = null
  state.showMode = false
  state.showCaseHighlights = false
  state.showSectionColors = false
  state.reviewUnassignedTables = false
  state.history = { ...EMPTY_HISTORY, past: [], future: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ActiveTool = 'select' | 'place-table' | 'place-row' | 'draw-room' | 'draw-room-circle' | 'draw-room-freehand' | 'split-room' | 'place-door' | 'measure'

type RowBuilderState = {
  tableCount: number
  tableWidth: number
  tableHeight: number
  spacing: number
  orientation: 'horizontal' | 'vertical' | 'curved'
  curveRadius: number
  curveDirection: 'clockwise' | 'counterclockwise'
  sectionId: SectionId | null
}

export interface EditorState {
  // ── Canvas (document) state ─────────────────────────────────────────────
  tables: Record<string, TableObject>
  rows: Record<string, Row>
  sections: Record<string, Section>
  vendors: Record<string, Vendor>
  vendorAssignments: Record<string, VendorAssignment>
  room: CompositeRoom | null
  selectedSegmentId: RoomSegmentId | null
  activeRoomId: string | null
  doors: Record<string, Door>
  backgroundImages: Record<string, BackgroundImage>
  settings: LayoutSettings

  // ── History ─────────────────────────────────────────────────────────────
  history: CommandHistory

  // ── UI state (ephemeral) ────────────────────────────────────────────────
  selectedIds: Set<string>
  activeTool: ActiveTool
  activeVendorId: VendorId | null   // vendor being assigned to tables
  hoveredVendorId: VendorId | null  // vendor hovered in roster for canvas emphasis
  selectedDoorId: string | null     // door selected for editing
  collapsedPanels: Set<string>      // sidebar sections that are collapsed
  gridVisible: boolean
  showMode: boolean
  showCaseHighlights: boolean
  showSectionColors: boolean
  reviewUnassignedTables: boolean
  stageScale: number
  stagePosition: Point

  // ── Builder configs (read by canvas mouse handlers) ────────────────────
  tableBuilderConfig: { tableWidth: number; tableHeight: number } | null
  rowBuilderConfig: RowBuilderState | null
  doorPlacementConfig: { widthIn: number; kind: 'door' | 'entrance' } | null

  // ── Canvas actions ───────────────────────────────────────────────────────
  dispatch: (command: LayoutCommand) => void
  undo: () => void
  redo: () => void

  // ── Selection actions ────────────────────────────────────────────────────
  setSelected:    (ids: Iterable<string>) => void
  addSelected:    (id: string) => void
  toggleSelected: (id: string) => void
  clearSelected:  () => void

  // ── Tool actions ─────────────────────────────────────────────────────────
  setActiveTool: (tool: ActiveTool) => void

  // ── Panel actions ──────────────────────────────────────────────────────
  togglePanelCollapsed: (panelId: string) => void
  setGridVisible: (visible: boolean) => void
  setShowMode: (visible: boolean) => void
  setShowCaseHighlights: (visible: boolean) => void
  setShowSectionColors: (visible: boolean) => void
  setReviewUnassignedTables: (visible: boolean) => void

  // ── Builder config actions ─────────────────────────────────────────────
  setTableBuilderConfig: (config: { tableWidth: number; tableHeight: number } | null) => void
  setRowBuilderConfig: (config: RowBuilderState | null) => void
  setDoorPlacementConfig: (config: { widthIn: number; kind: 'door' | 'entrance' } | null) => void

  // ── Stage transform actions ──────────────────────────────────────────────
  setStageTransform: (scale: number, position: Point) => void

  // ── Section helpers ─────────────────────────────────────────────────────
  selectBySection: (sectionId: SectionId) => void

  // ── Vendor roster actions (not undoable — roster is metadata, not layout) ─
  addVendor: (vendor: Vendor) => void
  updateVendor: (id: VendorId, updates: Partial<Omit<Vendor, 'id'>>) => void
  removeVendor: (id: VendorId) => void
  setActiveVendor: (id: VendorId | null) => void
  setHoveredVendor: (id: VendorId | null) => void
  setSelectedDoor: (id: string | null) => void
  setSelectedSegmentId: (id: RoomSegmentId | null) => void
  setActiveRoomId: (id: string | null) => void
  clearVendors: () => void
  clearLayout: () => void
  saveCurrentLayoutAs: (name: string) => string
  switchToLayout: (layoutId: string) => boolean
  saveLayoutToFile: () => void
  loadLayoutFromFile: (file: File) => Promise<string | null>
  loadDocumentSlice: (slice: DocumentSlice) => void
  activeCloudLayoutId: string | null
  activeCloudLayoutName: string | null
  activeCloudLayoutRevision: number | null
  setActiveCloudLayout: (layout: { id: string; name: string; revision?: number | null } | null) => void

  // ── CSV Import actions ─────────────────────────────────────────────────
  importSession: ImportSession | null
  startImportSession: (csvText: string) => void
  updateImportMapping: (mapping: FieldMapping) => void
  resolveImportConflict: (rowIndex: number, resolution: ConflictResolution) => void
  applyImport: () => void
  cancelImport: () => void

  // ── Background image actions ────────────────────────────────────────────
  addBackgroundImage: (image: BackgroundImage) => void
  updateBackgroundImage: (id: BackgroundImageId, updates: Partial<Omit<BackgroundImage, 'id'>>) => void
  removeBackgroundImage: (id: BackgroundImageId) => void

  // ── Persistence status (autosave feedback) ─────────────────────────────
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  saveError: 'quota-exceeded' | 'unknown' | null
  hasHydratedFromStorage: boolean
  hydrateFromStorage: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    // ── Initial state (hydrated from localStorage if available) ────────────
    tables:        {},
    rows:          {},
    sections:      {},
    vendors:       {},
    vendorAssignments: {},
    room:          null,
    selectedSegmentId: null,
    activeRoomId: null,
    doors:         {},
    backgroundImages: {},
    settings:      DEFAULT_SETTINGS,
    history:       EMPTY_HISTORY,
    selectedIds:   new Set<string>(),
    activeTool:    'select',
    activeVendorId: null,
    hoveredVendorId: null,
    selectedDoorId: null,
    collapsedPanels: new Set<string>(DEFAULT_COLLAPSED_PANELS),
    gridVisible: true,
    showMode: false,
    showCaseHighlights: false,
    showSectionColors: false,
    reviewUnassignedTables: false,
    stageScale:    1,
    stagePosition: { x: 0, y: 0 },
    tableBuilderConfig: null,
    rowBuilderConfig: null,
    doorPlacementConfig: null,
    importSession: null,
    saveStatus: 'idle' as const,
    saveError: null,
    hasHydratedFromStorage: false,
    activeCloudLayoutId: null,
    activeCloudLayoutName: null,
    activeCloudLayoutRevision: null,

    // ── Canvas actions ─────────────────────────────────────────────────────

    hydrateFromStorage() {
      if (get().hasHydratedFromStorage || typeof window === 'undefined') return

      const slice = loadFromLocalStorage()
      set(state => {
        state.hasHydratedFromStorage = true
        if (!slice) return
        applyDocumentSliceToState(state, slice)
      })
      if (slice) {
        void restoreBackgroundImagePayloads(slice).then(restored => {
          set(state => {
            state.backgroundImages = restored.backgroundImages
          })
        })
      }
    },

    dispatch(command) {
      set(state => {
        // Apply the command to document state
        applyCommand(state, command)
        state.tables = syncRoomFieldsForTables(state.tables, state.room, state.sections)
        if (!state.activeRoomId || !Object.values(state.tables).some(table => table.roomId === state.activeRoomId)) {
          state.activeRoomId = getDefaultRoomId(state.room)
        }

        // Mutate history arrays directly — avoids WritableDraft<ReadonlyArray> conflict
        // that arises from immer trying to make readonly command properties writable.
        const past   = state.history.past   as unknown as LayoutCommand[]
        const future = state.history.future as unknown as LayoutCommand[]

        past.push(command)
        if (past.length > state.history.maxSize) past.shift()
        future.length = 0  // always clear future on new action
      })
    },

    undo() {
      set(state => {
        const past   = state.history.past   as unknown as LayoutCommand[]
        const future = state.history.future as unknown as LayoutCommand[]

        if (past.length === 0) return
        const command = past[past.length - 1]

        reverseCommand(state, command)

        past.pop()
        future.push(command)
      })
    },

    redo() {
      set(state => {
        const past   = state.history.past   as unknown as LayoutCommand[]
        const future = state.history.future as unknown as LayoutCommand[]

        if (future.length === 0) return
        const command = future[future.length - 1]

        applyCommand(state, command)

        future.pop()
        past.push(command)
        if (past.length > state.history.maxSize) past.shift()
      })
    },

    // ── Selection actions ──────────────────────────────────────────────────

    setSelected(ids) {
      set(state => {
        state.selectedIds = new Set(ids)
      })
    },

    addSelected(id) {
      set(state => {
        state.selectedIds = new Set([...state.selectedIds, id])
      })
    },

    toggleSelected(id) {
      set(state => {
        const next = new Set(state.selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        state.selectedIds = next
      })
    },

    clearSelected() {
      set(state => {
        state.selectedIds = new Set()
      })
    },

    setActiveRoomId(id) {
      set(state => {
        state.activeRoomId = id
        if (!id) return
        state.selectedIds = new Set(
          [...state.selectedIds].filter(selectedId => state.tables[selectedId]?.roomId === id),
        )
      })
    },

    // ── Tool actions ───────────────────────────────────────────────────────

    setActiveTool(tool) {
      set(state => {
        state.activeTool = tool
      })
    },

    // ── Panel actions ─────────────────────────────────────────────────────

    togglePanelCollapsed(panelId) {
      set(state => {
        if (state.collapsedPanels.has(panelId)) {
          state.collapsedPanels.delete(panelId)
        } else {
          state.collapsedPanels.add(panelId)
        }
      })
    },

    setGridVisible(visible) {
      set(state => {
        state.gridVisible = visible
      })
    },

    setShowMode(visible) {
      set(state => {
        state.showMode = visible
        if (visible) {
          state.activeTool = 'select'
          state.activeVendorId = null
          state.hoveredVendorId = null
        } else {
          state.showCaseHighlights = false
          state.showSectionColors = false
        }
      })
    },

    setShowCaseHighlights(visible) {
      set(state => {
        state.showCaseHighlights = visible
      })
    },

    setShowSectionColors(visible) {
      set(state => {
        state.showSectionColors = visible
      })
    },

    setReviewUnassignedTables(visible) {
      set(state => {
        state.reviewUnassignedTables = visible
      })
    },

    // ── Builder config actions ────────────────────────────────────────────

    setTableBuilderConfig(config) {
      set(state => { state.tableBuilderConfig = config })
    },

    setRowBuilderConfig(config) {
      set(state => { state.rowBuilderConfig = config })
    },

    setDoorPlacementConfig(config) {
      set(state => { state.doorPlacementConfig = config })
    },

    // ── Stage transform ────────────────────────────────────────────────────

    setStageTransform(scale, position) {
      set(state => {
        state.stageScale    = scale
        state.stagePosition = position
      })
    },

    // ── Section helpers ──────────────────────────────────────────────────

    selectBySection(sectionId) {
      set(state => {
        const ids: string[] = []
        for (const t of Object.values(state.tables)) {
          if (t.sectionId === sectionId) ids.push(t.id)
        }
        state.selectedIds = new Set(ids)
      })
    },

    // ── Vendor roster actions ──────────────────────────────────────────────

    addVendor(vendor) {
      set(state => { state.vendors[vendor.id] = vendor })
    },

    updateVendor(id, updates) {
      set(state => {
        const v = state.vendors[id]
        if (v) {
          safeAssignDefined(v, updates)
        }
      })
    },

    removeVendor(id) {
      set(state => {
        delete state.vendors[id]
        // Also clear any assignments for this vendor (by vendorId, not name)
        for (const [aid, a] of Object.entries(state.vendorAssignments)) {
          if (a.vendorId === id) {
            delete state.vendorAssignments[aid]
          }
        }
        if (state.activeVendorId === id) state.activeVendorId = null
        if (state.hoveredVendorId === id) state.hoveredVendorId = null
      })
    },

    setActiveVendor(id) {
      set(state => { state.activeVendorId = id })
    },

    setHoveredVendor(id) {
      set(state => { state.hoveredVendorId = id })
    },

    setSelectedDoor(id) {
      set(state => { state.selectedDoorId = id })
    },

    setSelectedSegmentId(id) {
      set(state => { state.selectedSegmentId = id })
    },

    // ── Background image actions ─────────────────────────────────────────

    addBackgroundImage(image) {
      set(state => { state.backgroundImages[image.id] = image })
    },

    updateBackgroundImage(id, updates) {
      set(state => {
        const img = state.backgroundImages[id]
        if (img) {
          safeAssignDefined(img, updates)
        }
      })
    },

    removeBackgroundImage(id) {
      set(state => { delete state.backgroundImages[id] })
    },

    // ── CSV Import actions ────────────────────────────────────────────────

    startImportSession(csvText) {
      const state = get()
      const parsed = csvImportModule.parseCSV(csvText)
      const detected = csvImportModule.detectColumns(parsed.headers)
      const existingTables = Object.values(state.tables)
      const existingAssignments = Object.values(state.vendorAssignments)
      const session = csvImportModule.buildSession(
        parsed,
        detected.fieldMapping,
        existingTables,
        existingAssignments,
        DRAFT_LAYOUT_ID,
        'user' as UserId,
        createImportSessionId(),
      )
      set(s => { s.importSession = session })
    },

    updateImportMapping(mapping) {
      const state = get()
      if (!state.importSession) return
      const existingTables = Object.values(state.tables)
      const existingAssignments = Object.values(state.vendorAssignments)
      // Rebuild session from the already-stored raw rows with the new mapping
      const rawRows = state.importSession.rows.map(r => r.rawData)
      const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : []
      const newSession = csvImportModule.buildSession(
        { headers, rows: rawRows, rowCount: rawRows.length, parseErrors: [] },
        mapping,
        existingTables,
        existingAssignments,
        state.importSession.layoutId,
        state.importSession.createdBy,
        state.importSession.id,
      )
      set(s => { s.importSession = newSession })
    },

    resolveImportConflict(rowIndex, resolution) {
      set(s => {
        if (!s.importSession) return
        const row = s.importSession.rows.find(r => r.rowIndex === rowIndex)
        if (row?.conflict) {
          row.conflict.resolution = resolution
          row.status = resolution === 'skip' ? 'skipped' : 'conflict'
        }
        s.importSession.conflictSummary = csvImportModule.recomputeSummary(s.importSession.rows)
      })
    },

    applyImport() {
      const state = get()
      if (!state.importSession) return
      if (!csvImportModule.isReadyToApply(state.importSession)) return

      const tablesByLabel = new Map(
        Object.values(state.tables).map(t => [t.label.toLowerCase().trim(), t]),
      )
      // Build once — avoids O(n²) .find() per row
      const assignmentByTableId = new Map(
        Object.values(state.vendorAssignments).map(a => [a.tableId, a]),
      )
      const vendorIdByEmail = new Map(
        Object.values(state.vendors)
          .filter(v => v.email?.trim())
          .map(v => [v.email!.trim().toLowerCase(), v.id]),
      )

      const createdVendors: Vendor[] = []
      const createdAssignments: VendorAssignment[] = []
      const replacedAssignments: VendorAssignment[] = []
      const createdVendorByKey = new Map<string, Vendor>()
      const existingVendorTableDeltas = new Map<Vendor['id'], number>()

      for (const row of state.importSession.rows) {
        const willApply =
          row.status === 'valid' ||
          (
            row.status === 'conflict' &&
            (row.conflict?.resolution === 'overwrite' || row.conflict?.resolution === 'create-unplaced')
          )
        if (!willApply) continue

        const normalizedEmail = row.mapped.email?.trim().toLowerCase() || null
        const vendorKey = normalizedEmail ? `email:${normalizedEmail}` : `row:${row.rowIndex}`
        const tableNumbers = expandTableNumbers(row.mapped.tableNumber)
        const importedTableCount = Math.max(
          1,
          tableNumbers.length > 0 ? tableNumbers.length : (row.mapped.quantity || 1),
        )

        let vendorId: Vendor['id']
        let createdVendor = createdVendorByKey.get(vendorKey)

        if (createdVendor) {
          createdVendor.tablesNeeded += importedTableCount
          if (!createdVendor.notes && row.mapped.notes) createdVendor.notes = row.mapped.notes
          if (!createdVendor.category && row.mapped.vendorCategory) createdVendor.category = row.mapped.vendorCategory
          if (!createdVendor.tableSize && row.mapped.tableSize) createdVendor.tableSize = row.mapped.tableSize
          if (createdVendor.paymentStatus === 'unknown' && row.mapped.paymentStatus) {
            createdVendor.paymentStatus = row.mapped.paymentStatus as Vendor['paymentStatus']
          }
          createdVendor.premium ||= (row.mapped.vendorCategory ?? '').toLowerCase() === 'premium'
          vendorId = createdVendor.id
        } else if (normalizedEmail && vendorIdByEmail.has(normalizedEmail)) {
          vendorId = vendorIdByEmail.get(normalizedEmail)!
          existingVendorTableDeltas.set(vendorId, (existingVendorTableDeltas.get(vendorId) ?? 0) + importedTableCount)
        } else {
          vendorId = createVendorId()
          createdVendor = {
            id: vendorId,
            name: row.mapped.vendorName,
            firstName: row.mapped.firstName || null,
            lastName: row.mapped.lastName || null,
            companyName: row.mapped.companyName ?? null,
            email: normalizedEmail,
            tablesNeeded: importedTableCount,
            tableSize: row.mapped.tableSize ?? null,
            category: row.mapped.vendorCategory,
            paymentStatus: (row.mapped.paymentStatus ?? 'unknown') as Vendor['paymentStatus'],
            notes: row.mapped.notes,
            premium: (row.mapped.vendorCategory ?? '').toLowerCase() === 'premium',
            cases: 0,
          }
          createdVendors.push(createdVendor)
          createdVendorByKey.set(vendorKey, createdVendor)
          if (normalizedEmail) vendorIdByEmail.set(normalizedEmail, vendorId)
        }

        for (const tableNumber of tableNumbers) {
          const table = tablesByLabel.get(tableNumber.toLowerCase().trim())
          if (!table) continue

          const existing = assignmentByTableId.get(table.id)
          if (existing) replacedAssignments.push(existing)

          const newAssignment: VendorAssignment = {
            id: createAssignmentId(),
            tableId: table.id,
            layoutId: DRAFT_LAYOUT_ID,
            vendorId,
            vendorName: row.mapped.vendorName,
            vendorCategory: row.mapped.vendorCategory,
            colorOverride: row.mapped.color,
            notes: row.mapped.notes,
            paymentStatus: (row.mapped.paymentStatus ?? 'unknown') as VendorAssignment['paymentStatus'],
            importSessionId: state.importSession.id,
          }
          createdAssignments.push(newAssignment)
        }
      }

      get().dispatch({
        type: 'APPLY_IMPORT',
        timestamp: Date.now(),
        importSessionId: state.importSession.id,
        createdVendors,
        replacedAssignments,
        createdAssignments,
        vendorTableCountDeltas: Array.from(existingVendorTableDeltas, ([vendorId, delta]) => ({ vendorId, delta })),
      })

      set(s => { s.importSession = null })
    },

    cancelImport() {
      set(s => { s.importSession = null })
    },

    clearVendors() {
      set(state => {
        state.vendors = {}
        state.vendorAssignments = {}
        state.activeVendorId = null
      })
    },

    clearLayout() {
      set(state => {
        state.tables = {}
        state.rows = {}
        state.sections = {}
        state.vendors = {}
        state.vendorAssignments = {}
        state.room = null
        state.activeRoomId = null
        state.doors = {}
        state.backgroundImages = {}
        state.settings = DEFAULT_SETTINGS
        state.selectedIds = new Set()
        state.activeTool = 'select'
        state.activeVendorId = null
        state.hoveredVendorId = null
        state.selectedDoorId = null
        state.selectedSegmentId = null
        state.showMode = false
        state.showCaseHighlights = false
        state.showSectionColors = false
        state.reviewUnassignedTables = false
        state.history = { ...EMPTY_HISTORY, past: [], future: [] }
        state.activeCloudLayoutId = null
        state.activeCloudLayoutName = null
        state.activeCloudLayoutRevision = null
      })
      clearLocalStorage()
    },

    saveCurrentLayoutAs(name) {
      const state = get()
      const slice = extractDocumentSlice(state)
      return saveLayoutAs(name, slice)
    },

    saveLayoutToFile() {
      const state = get()
      const slice = extractDocumentSlice(state)
      const manifest = typeof window !== 'undefined'
        ? ((): string => {
            try {
              const raw = localStorage.getItem('floorplanner:manifest')
              if (raw) {
                const m = JSON.parse(raw)
                const active = m?.layouts?.find((l: { id: string; name: string }) => l.id === m.activeLayoutId)
                if (active?.name) return active.name
              }
            } catch { /* ignore */ }
            return 'floorplan'
          })()
        : 'floorplan'
      saveToFileLib(slice, manifest)
    },

    async loadLayoutFromFile(file) {
      const text = await file.text()
      let slice: ReturnType<typeof parseFilePayload>
      try {
        slice = parseFilePayload(text)
      } catch (err) {
        return err instanceof Error ? err.message : 'Failed to load file.'
      }
      set(state => {
        applyDocumentSliceToState(state, slice)
        state.activeCloudLayoutId = null
        state.activeCloudLayoutName = null
        state.activeCloudLayoutRevision = null
      })
      return null
    },

    loadDocumentSlice(slice) {
      set(state => {
        applyDocumentSliceToState(state, slice)
      })
    },

    setActiveCloudLayout(layout) {
      set(state => {
        state.activeCloudLayoutId = layout?.id ?? null
        state.activeCloudLayoutName = layout?.name ?? null
        state.activeCloudLayoutRevision = layout?.revision ?? null
      })
    },

    switchToLayout(layoutId) {
      const slice = loadLayout(layoutId)
      if (!slice) return false
      set(state => {
        applyDocumentSliceToState(state, slice)
        state.activeCloudLayoutId = null
        state.activeCloudLayoutName = null
        state.activeCloudLayoutRevision = null
      })
      void restoreBackgroundImagePayloads(slice).then(restored => {
        set(state => {
          state.backgroundImages = restored.backgroundImages
        })
      })
      return true
    },
  })),
)

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SAVE — debounced write to localStorage on every state change
// ─────────────────────────────────────────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _savedClearTimer: ReturnType<typeof setTimeout> | null = null

useEditorStore.subscribe((state, prev) => {
  // Only react when document data changes — not when saveStatus/saveError update.
  // With immer, unchanged sub-trees keep their reference, so identity checks work.
  const docChanged =
    state.tables          !== prev.tables          ||
    state.rows            !== prev.rows            ||
    state.sections        !== prev.sections        ||
    state.vendors         !== prev.vendors         ||
    state.vendorAssignments !== prev.vendorAssignments ||
    state.room            !== prev.room            ||
    state.doors           !== prev.doors           ||
    state.backgroundImages !== prev.backgroundImages ||
    state.settings        !== prev.settings
  if (!docChanged) return

  if (_saveTimer) clearTimeout(_saveTimer)
  useEditorStore.setState({ saveStatus: 'saving', saveError: null })
  _saveTimer = setTimeout(() => {
    const err = saveToLocalStorage(extractDocumentSlice(state))
    if (err) {
      useEditorStore.setState({ saveStatus: 'error', saveError: err })
    } else {
      useEditorStore.setState({ saveStatus: 'saved', saveError: null })
      if (_savedClearTimer) clearTimeout(_savedClearTimer)
      _savedClearTimer = setTimeout(() => {
        useEditorStore.setState({ saveStatus: 'idle' })
      }, 2000)
    }
  }, 500)
})

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// Kept separate so components subscribe only to what they need.
// ─────────────────────────────────────────────────────────────────────────────

export const selectTables    = (s: EditorState) => s.tables
// CAUTION: this selector creates a new array on every call.
// Only use it with useShallow() or inside event/effect handlers — never as a
// bare useEditorStore(selectTableList) subscription, or you will get an
// infinite render loop via useSyncExternalStore snapshot tearing.
export const selectTableList = (s: EditorState) => Object.values(s.tables)
export const selectSettings  = (s: EditorState) => s.settings
export const selectHistory   = (s: EditorState) => s.history
export const selectSelectedIds = (s: EditorState) => s.selectedIds
export const selectActiveTool  = (s: EditorState) => s.activeTool
export const selectRows      = (s: EditorState) => s.rows
export const selectSections  = (s: EditorState) => s.sections
export const selectVendors  = (s: EditorState) => s.vendors
export const selectActiveVendorId = (s: EditorState) => s.activeVendorId
export const selectHoveredVendorId = (s: EditorState) => s.hoveredVendorId
export const selectVendorAssignments = (s: EditorState) => s.vendorAssignments
export const selectRoom      = (s: EditorState) => s.room
export const selectActiveRoomId = (s: EditorState) => s.activeRoomId
export const selectDoors     = (s: EditorState) => s.doors
export const selectSelectedDoorId = (s: EditorState) => s.selectedDoorId
export const selectSelectedSegmentId = (s: EditorState) => s.selectedSegmentId
// CAUTION: this selector creates a new array on every call.
// Only use it with useShallow() or inside event/effect handlers — never as a
// bare useEditorStore(selectDoorList) subscription, or you will get an
// infinite render loop via useSyncExternalStore snapshot tearing.
export const selectDoorList  = (s: EditorState) => Object.values(s.doors)
export const selectBackgroundImages = (s: EditorState) => s.backgroundImages
export const selectCanUndo = (s: EditorState) => s.history.past.length > 0
export const selectCanRedo = (s: EditorState) => s.history.future.length > 0
export const selectCollapsedPanels = (s: EditorState) => s.collapsedPanels
export const selectGridVisible = (s: EditorState) => s.gridVisible
export const selectShowMode = (s: EditorState) => s.showMode
export const selectShowCaseHighlights = (s: EditorState) => s.showCaseHighlights
export const selectShowSectionColors = (s: EditorState) => s.showSectionColors
export const selectReviewUnassignedTables = (s: EditorState) => s.reviewUnassignedTables

/** Derives the RowId when all selected tables share the same row, else null. */
export const selectSelectedRowId = (s: EditorState): RowId | null => {
  if (s.selectedIds.size === 0) return null
  let rowId: RowId | null = null
  for (const id of s.selectedIds) {
    const t = s.tables[id]
    if (!t || !t.rowId) return null
    if (rowId === null) rowId = t.rowId
    else if (t.rowId !== rowId) return null
  }
  return rowId
}

// Derived: reverse lookup from TableId → VendorAssignment
let _prevAssignmentsRef: Record<string, VendorAssignment> | null = null
let _cachedAssignmentMap: Map<string, VendorAssignment> = new Map()

export const selectAssignmentMap = (s: EditorState): Map<string, VendorAssignment> => {
  if (s.vendorAssignments === _prevAssignmentsRef) return _cachedAssignmentMap
  _prevAssignmentsRef = s.vendorAssignments
  const map = new Map<string, VendorAssignment>()
  for (const a of Object.values(s.vendorAssignments)) {
    map.set(a.tableId, a)
  }
  _cachedAssignmentMap = map
  return map
}

// Derived: set of table IDs that share a label with another table.
// Recomputed when tables record reference changes (every mutation).
// O(n) and table count target is 300-500, so no memoization needed.
let _prevTablesRef: Record<string, TableObject> | null = null
let _cachedDuplicateIds: Set<string> = new Set()

export const selectDuplicateTableIds = (s: EditorState): Set<string> => {
  if (s.tables === _prevTablesRef) return _cachedDuplicateIds
  _prevTablesRef = s.tables

  const labelMap = new Map<string, string[]>()
  for (const t of Object.values(s.tables)) {
    const existing = labelMap.get(t.label)
    if (existing) existing.push(t.id)
    else labelMap.set(t.label, [t.id])
  }

  const ids = new Set<string>()
  for (const group of labelMap.values()) {
    if (group.length >= 2) {
      for (const id of group) ids.add(id)
    }
  }
  _cachedDuplicateIds = ids
  return ids
}
