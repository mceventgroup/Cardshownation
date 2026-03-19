// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRIC PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANDED ID TYPES
// All IDs are strings. Branding prevents accidental cross-assignment.
// ─────────────────────────────────────────────────────────────────────────────

export type TableId           = string & { readonly __brand: 'TableId' }
export type RowId             = string & { readonly __brand: 'RowId' }
export type SectionId         = string & { readonly __brand: 'SectionId' }
export type VendorAssignmentId= string & { readonly __brand: 'VendorAssignmentId' }
export type VendorId          = string & { readonly __brand: 'VendorId' }
export type ObstacleId        = string & { readonly __brand: 'ObstacleId' }
export type DoorId            = string & { readonly __brand: 'DoorId' }
export type LayoutId          = string & { readonly __brand: 'LayoutId' }
export type EventId           = string & { readonly __brand: 'EventId' }
export type UserId            = string & { readonly __brand: 'UserId' }
export type ImportSessionId   = string & { readonly __brand: 'ImportSessionId' }
export type TemplateId        = string & { readonly __brand: 'TemplateId' }

// ─────────────────────────────────────────────────────────────────────────────
// TABLE OBJECT
// Represents one physical table on the canvas floor plan.
// All geometry is in canvas units. Rotation is in degrees.
//
// STORED: all fields below
// NOT STORED HERE: vendor name, vendor category, notes — those live in
//   VendorAssignment to keep geometry and assignment concerns separate.
// ─────────────────────────────────────────────────────────────────────────────

export type TableShape = 'rectangle' | 'round'

export interface TableObject {
  id: TableId
  x: number
  y: number
  width: number
  height: number
  rotation: number          // degrees, 0–359
  shape: TableShape
  label: string             // display label, e.g. "A-1" or "42"
  labelOverridden: boolean  // true if user manually edited the label
  rowId: RowId | null       // null if not part of a row
  sectionId: SectionId | null
  order: number             // sort position within row (0-based); used for numbering
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW
// A logical grouping of tables placed together via the row builder.
// Stores the config used to create it so the row can be re-distributed or
// resized later without losing intent.
// ─────────────────────────────────────────────────────────────────────────────

export type RowOrientation = 'horizontal' | 'vertical'

export interface Row {
  id: RowId
  sectionId: SectionId | null
  orientation: RowOrientation
  tableCount: number
  tableWidth: number
  tableHeight: number
  spacing: number           // gap between tables in canvas units
  createdAt: string         // ISO 8601
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION
// A named, colored organizational group. Tables and rows belong to sections.
// Color is applied to all member tables unless overridden by a VendorAssignment.
// ─────────────────────────────────────────────────────────────────────────────

export interface Section {
  id: SectionId
  name: string
  color: string             // hex, e.g. "#3B82F6"
  order: number             // display order in section list
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR ASSIGNMENT
// Connects a vendor to a specific table in a specific layout.
// Intentionally separate from TableObject — clearing all vendor data does not
// touch table geometry.
//
// Color precedence (resolved at render time, not stored):
//   colorOverride (assignment) > section color > application default
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'comped' | 'unknown'

export interface VendorAssignment {
  id: VendorAssignmentId
  tableId: TableId
  layoutId: LayoutId
  vendorName: string
  vendorCategory: string | null
  colorOverride: string | null    // overrides section color if set
  notes: string | null            // organizer-only, not shown in public view
  paymentStatus: PaymentStatus
  importSessionId: ImportSessionId | null  // null if manually assigned
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR ROSTER ENTRY
// Represents a vendor in the roster before/after table assignment.
// ─────────────────────────────────────────────────────────────────────────────

export interface Vendor {
  id: VendorId
  name: string
  tablesNeeded: number          // how many tables this vendor purchased
  category: string | null
  paymentStatus: PaymentStatus
  notes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// OBSTACLE
// Fixed physical structure in the venue: pillar, wall segment, stage, etc.
// Used in overlap and clearance checks.
// ─────────────────────────────────────────────────────────────────────────────

export interface Obstacle {
  id: ObstacleId
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

// ─────────────────────────────────────────────────────────────────────────────
// DOOR
// A marked entry/exit point on the venue perimeter.
// Used to compute clearance zones that must not be blocked by tables.
// ─────────────────────────────────────────────────────────────────────────────

export type DoorSide = 'top' | 'bottom' | 'left' | 'right'

export interface Door {
  id: DoorId
  label: string
  x: number                 // position along the wall
  y: number
  width: number             // opening width in canvas units
  side: DoorSide
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SETTINGS
// Stored per-layout. Controls canvas dimensions, snapping, and default sizes.
// minAisleWidth and doorClearance drive the warnings engine.
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutSettings {
  canvasWidth: number
  canvasHeight: number
  gridSize: number              // canvas units per grid cell
  snapToGrid: boolean
  snapToObjects: boolean
  minAisleWidth: number         // minimum aisle in canvas units; drives warnings
  doorClearance: number         // minimum clearance in front of any door
  defaultTableWidth: number
  defaultTableHeight: number
  defaultTableShape: TableShape
  unitLabel: string             // "ft" or "px" — display only in v1, no real conversion
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED: TABLE DISPLAY COLOR
// Not stored. Computed at render time from the precedence chain.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedTableColor {
  color: string
  source: 'assignment' | 'section' | 'default'
}
