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
export type RoomSegmentId     = string & { readonly __brand: 'RoomSegmentId' }
export type RoomCircleId      = string & { readonly __brand: 'RoomCircleId' }
export type LayoutId          = string & { readonly __brand: 'LayoutId' }
export type EventId           = string & { readonly __brand: 'EventId' }
export type UserId            = string & { readonly __brand: 'UserId' }
export type ImportSessionId   = string & { readonly __brand: 'ImportSessionId' }
export type TemplateId        = string & { readonly __brand: 'TemplateId' }
export type BackgroundImageId = string & { readonly __brand: 'BackgroundImageId' }

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
  roomId: string
  tableNumber: number
  displayId: string
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
  premium: boolean          // true = prime spot, preferred for premium vendors
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW
// A logical grouping of tables placed together via the row builder.
// Stores the config used to create it so the row can be re-distributed or
// resized later without losing intent.
// ─────────────────────────────────────────────────────────────────────────────

export type RowOrientation = 'horizontal' | 'vertical' | 'curved'
export type RowCurveDirection = 'clockwise' | 'counterclockwise'

export interface Row {
  id: RowId
  sectionId: SectionId | null
  orientation: RowOrientation
  tableCount: number
  tableWidth: number
  tableHeight: number
  spacing: number           // gap between tables in canvas units
  curveRadius?: number
  curveCenterX?: number
  curveCenterY?: number
  curveMidAngle?: number
  curveDirection?: RowCurveDirection
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
  vendorId: VendorId              // primary key link to Vendor roster
  vendorName: string              // denormalized for display convenience
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
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
  email?: string | null
  tablesNeeded: number          // how many tables this vendor purchased
  tableSize?: string | null
  category: string | null
  paymentStatus: PaymentStatus
  notes: string | null
  premium: boolean              // true = preferred for premium table spots
  cases: number                 // number of cases; values > 0 can be highlighted in show mode
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
export type DoorKind = 'door' | 'entrance'

export interface Door {
  id: DoorId
  label: string
  x: number                 // position along the wall
  y: number
  width: number             // opening width in canvas units
  side: DoorSide
  kind: DoorKind
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM (COMPOSITE)
// A venue boundary composed of one or more axis-aligned rectangular segments.
// Multiple segments merge visually — internal walls between touching/overlapping
// segments disappear. Supports L-shaped, T-shaped, U-shaped rooms, etc.
//
// When freehandVertices is set, the room boundary is defined by an arbitrary
// polygon (drawn freehand) instead of by rectangular segments.
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomSegment {
  id: RoomSegmentId
  x: number
  y: number
  width: number
  height: number
}

export interface RoomCircle {
  id: RoomCircleId
  x: number
  y: number
  radiusX: number
  radiusY: number
}

export interface CompositeRoom {
  segments: RoomSegment[]
  circles?: RoomCircle[]
  freehandVertices: Point[] | null  // null = use segments; non-null = freehand polygon
  roomLabels?: Record<string, string>
}

/** @deprecated Use CompositeRoom. Kept as alias for migration convenience. */
export type Room = CompositeRoom

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
  wallThickness: number         // physical wall thickness rendered outside room boundary
  wallSetback: number           // minimum distance from wall to nearest table edge (canvas units)
  showWallSetback: boolean      // render yellow setback zone overlay
  vendorColorCoding: boolean    // color-code vendor grid status and premium markers
  roomLocked: boolean           // when true, room segments cannot be dragged on canvas
  defaultTableWidth: number
  defaultTableHeight: number
  defaultTableShape: TableShape
  unitLabel: string             // "ft" or "px" — display only in v1, no real conversion
  eventName: string
  eventDate: string
  upcomingShow1Date: string
  upcomingShow1Location: string
  upcomingShow2Date: string
  upcomingShow2Location: string
  upcomingShow3Date: string
  upcomingShow3Location: string
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED: TABLE DISPLAY COLOR
// Not stored. Computed at render time from the precedence chain.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedTableColor {
  color: string
  source: 'assignment' | 'section' | 'default'
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND IMAGE
// A floor plan image placed on the canvas as a reference layer behind tables.
// dataUrl stores the image as a base64 data URL so it persists with the layout.
// ─────────────────────────────────────────────────────────────────────────────

export interface BackgroundImage {
  id: BackgroundImageId
  name: string              // original file name
  dataUrl: string           // base64 data URL
  x: number                 // position on canvas
  y: number
  width: number             // display size on canvas
  height: number
  opacity: number           // 0–1
  locked: boolean           // when true, image can't be moved
  visible: boolean
  order: number             // z-order for multiple images (lower = behind)
}
