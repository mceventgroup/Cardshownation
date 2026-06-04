// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT SCHEMA
//
// LayoutDocument is the canonical stored representation of a floor plan.
// It contains only stored state — no derived data, no warnings, no UI state.
//
// Versioning:
//   - CURRENT_DOCUMENT_VERSION bumps whenever the schema changes in a
//     breaking way. Migration functions will live in domain/migrations.ts.
//   - Every persisted document carries its version so the loader can apply
//     the right migrations before handing it to the editor.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TableObject,
  Row,
  Section,
  VendorAssignment,
  Obstacle,
  Door,
  LayoutSettings,
  LayoutId,
  EventId,
  UserId,
  TemplateId,
  ImportSessionId,
  TableId,
} from './types'

export const CURRENT_DOCUMENT_VERSION = 1

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT DOCUMENT
// The complete stored state of one event's floor plan.
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutDocument {
  /** Schema version — used for migrations. Always set to CURRENT_DOCUMENT_VERSION when writing. */
  version: number

  // Identity
  id: LayoutId
  eventId: EventId
  name: string
  createdBy: UserId
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601

  // Canvas geometry (stored state)
  tables: TableObject[]
  rows: Row[]
  sections: Section[]
  obstacles: Obstacle[]
  doors: Door[]

  // Vendor assignments (stored separately from table geometry)
  vendorAssignments: VendorAssignment[]

  // Configuration
  settings: LayoutSettings
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SNAPSHOT
//
// A point-in-time capture of a LayoutDocument. Used for:
//   - Version history (manual saves, named saves)
//   - Autosave recovery
//   - "Before import" safety checkpoint
//
// Snapshots are immutable once written. They are never mutated, only created
// or deleted. They are not the undo stack — they are coarse-grained recovery
// points, not fine-grained action history.
// ─────────────────────────────────────────────────────────────────────────────

export type SnapshotTrigger =
  | 'autosave'
  | 'manual-save'
  | 'before-import'    // taken automatically before an import is applied
  | 'template-create'  // taken when the user saves this layout as a template

export interface LayoutSnapshot {
  id: string
  layoutId: LayoutId
  version: number           // incrementing integer scoped to this layoutId
  document: LayoutDocument  // full document at this point in time
  savedAt: string           // ISO 8601
  savedBy: UserId
  trigger: SnapshotTrigger
  description: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// VENUE TEMPLATE
//
// A reusable geometry blueprint with no vendor data and no event binding.
// When a new layout is created from a template, all IDs are regenerated.
// Vendor assignments are never included in a template.
//
// The Omit<..., 'id'> pattern signals that IDs are not preserved — the
// instantiation step always generates fresh IDs.
// ─────────────────────────────────────────────────────────────────────────────

export interface VenueTemplate {
  id: TemplateId
  name: string
  description: string | null
  createdBy: UserId
  createdAt: string
  updatedAt: string
  tableCount: number  // denormalized for list display

  // Geometry only — IDs will be regenerated on instantiation
  tables: Array<Omit<TableObject, 'id'>>
  rows: Array<Omit<Row, 'id'>>
  sections: Array<Omit<Section, 'id'>>
  obstacles: Array<Omit<Obstacle, 'id'>>
  doors: Array<Omit<Door, 'id'>>
  settings: LayoutSettings
}

/**
 * Result of creating a new LayoutDocument from a VenueTemplate.
 * idMap lets the caller trace which new ID corresponds to which template slot
 * (useful for debugging or future template diffing).
 */
export interface TemplateInstantiationResult {
  document: LayoutDocument
  idMap: Record<string, string>  // templateSlotIndex → newId
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV IMPORT SESSION
//
// Imports are always staged. The workflow:
//   1. Upload CSV → create ImportSession (status: pending)
//   2. Map fields → update fieldMapping (status: pending → reviewing)
//   3. Review rows and resolve conflicts (status: reviewing)
//   4. Confirm → status: ready
//   5. Apply → upsert VendorAssignments; status: applied
//   6. Optional revert → restore pre-import assignments; status: reverted
//
// A 'before-import' LayoutSnapshot is created automatically at step 5
// before any assignments are written, enabling revert.
// ─────────────────────────────────────────────────────────────────────────────

export type ImportSessionStatus =
  | 'pending'    // CSV uploaded, field mapping not yet confirmed
  | 'reviewing'  // field mapping set, user reviewing rows
  | 'ready'      // all conflicts resolved, safe to apply
  | 'applied'    // vendor assignments written to layout
  | 'reverted'   // assignments rolled back to pre-import state
  | 'cancelled'

export interface ImportSession {
  id: ImportSessionId
  layoutId: LayoutId
  createdBy: UserId
  createdAt: string
  status: ImportSessionStatus
  fieldMapping: FieldMapping
  rows: ImportRow[]
  conflictSummary: ConflictSummary
  appliedAt: string | null
  revertedAt: string | null
  snapshotIdBeforeApply: string | null  // set when status transitions to 'applied'
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD MAPPING
//
// Maps CSV column names to the expected import fields.
// Null means "not mapped" — the field will be absent from MappedImportRow.
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldMapping {
  tableNumber: string | null
  vendorName: string | null
  vendorLastName: string | null  // optional — concatenated with vendorName as "First Last"
  companyName: string | null
  email: string | null
  vendorCategory: string | null
  quantity: string | null
  tableSize: string | null
  color: string | null
  notes: string | null
  paymentStatus: string | null
  section: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT ROW
// ─────────────────────────────────────────────────────────────────────────────

export type ImportRowStatus =
  | 'valid'      // clean row, no conflicts
  | 'conflict'   // has a conflict — must be resolved or skipped before apply
  | 'skipped'    // user chose to skip this row
  | 'applied'    // this row has been written to the layout

export interface ImportRow {
  rowIndex: number                   // 0-based position in original CSV
  rawData: Record<string, string>    // original CSV values, keyed by column name
  mapped: MappedImportRow            // values after field mapping
  status: ImportRowStatus
  conflict: ImportConflict | null
}

export interface MappedImportRow {
  tableNumber: string
  vendorName: string
  firstName: string
  lastName: string
  companyName: string | null
  email: string | null
  vendorCategory: string | null
  quantity: number
  tableSize: string | null
  color: string | null
  notes: string | null
  paymentStatus: string | null
  section: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT CONFLICTS
// ─────────────────────────────────────────────────────────────────────────────

export type ImportConflictType =
  | 'table-not-found'      // no table with this label exists in the layout
  | 'already-assigned'     // table already has a VendorAssignment
  | 'duplicate-in-import'  // same table number appears more than once in this CSV
  | 'invalid-field'        // unparseable value (bad color, bad payment status, etc.)

export type ConflictResolution =
  | 'overwrite'         // replace the existing assignment
  | 'skip'              // keep existing assignment, do not apply this row
  | 'create-unplaced'   // record the vendor in the session but do not link to a table

export interface ImportConflict {
  type: ImportConflictType
  message: string
  affectedTableId: TableId | null  // null for table-not-found
  resolution: ConflictResolution | null
}

export interface ConflictSummary {
  totalRows: number
  validRows: number
  conflictRows: number
  skippedRows: number
  tablesNotFound: number
  alreadyAssigned: number
}
