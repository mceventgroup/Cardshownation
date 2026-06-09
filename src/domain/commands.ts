// ─────────────────────────────────────────────────────────────────────────────
// COMMAND MODEL AND UNDO/REDO
//
// Every mutation to a LayoutDocument is expressed as a Command.
// Each Command stores enough before/after data to execute and reverse itself.
// No full document snapshots needed in the undo stack.
//
// UNDO BOUNDARY — what enters the history stack:
//   ✓ All canvas mutations: place, move, resize, rotate, delete
//   ✓ Row operations (as a single command, not N table commands)
//   ✓ Section create/update/delete
//   ✓ Table label changes and bulk renumbering
//   ✓ Vendor assignment add/update/clear
//   ✓ Apply import session
//   ✓ Settings changes
//
//   ✗ UI state: panel open/closed, selected tool, hover state
//   ✗ Selection state
//   ✗ Autosave events
//   ✗ Zoom/pan position
//
// COMPOSITE COMMANDS: row placement, bulk renumber, and import apply are each
// one undo step regardless of how many tables they affect. The command captures
// the full before/after state for all affected entities.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TableId,
  RowId,
  SectionId,
  VendorAssignmentId,
  ImportSessionId,
  DoorId,
  RoomSegmentId,
  TableObject,
  Row,
  Section,
  Door,
  RoomSegment,
  CompositeRoom,
  Point,
  VendorAssignment,
  Vendor,
  VendorId,
  LayoutSettings,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// BASE
// ─────────────────────────────────────────────────────────────────────────────

interface CommandBase {
  readonly timestamp: number  // Date.now() at creation
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/** Place a single table. Undo deletes it. */
export interface PlaceTableCommand extends CommandBase {
  readonly type: 'PLACE_TABLE'
  readonly table: TableObject
}

/**
 * Move one or more tables. Stores prev and next position for each.
 * Multi-table drag is one undo step.
 */
export interface MoveTablesCommand extends CommandBase {
  readonly type: 'MOVE_TABLES'
  readonly moves: ReadonlyArray<{
    tableId: TableId
    prevX: number
    prevY: number
    nextX: number
    nextY: number
  }>
}

/** Resize a single table. Stores full prev/next geometry (position may shift during resize). */
export interface ResizeTableCommand extends CommandBase {
  readonly type: 'RESIZE_TABLE'
  readonly tableId: TableId
  readonly prev: Pick<TableObject, 'x' | 'y' | 'width' | 'height'>
  readonly next: Pick<TableObject, 'x' | 'y' | 'width' | 'height'>
}

/** Rotate one or more tables. */
export interface RotateTablesCommand extends CommandBase {
  readonly type: 'ROTATE_TABLES'
  readonly rotations: ReadonlyArray<{
    tableId: TableId
    prevRotation: number
    nextRotation: number
  }>
}

/** Toggle premium flag on one or more tables. */
export interface SetTablePremiumCommand extends CommandBase {
  readonly type: 'SET_TABLE_PREMIUM'
  readonly tableIds: ReadonlyArray<TableId>
  readonly premium: boolean
  readonly prev: Readonly<Record<string, boolean>>  // tableId → previous premium value
}

/**
 * Delete one or more tables. Stores full table snapshots and their vendor
 * assignments so undo can fully restore them.
 */
export interface DeleteTablesCommand extends CommandBase {
  readonly type: 'DELETE_TABLES'
  readonly tables: ReadonlyArray<TableObject>
  readonly affectedAssignments: ReadonlyArray<VendorAssignment>
}

/** User manually changes a single table label. */
export interface RelabelTableCommand extends CommandBase {
  readonly type: 'RELABEL_TABLE'
  readonly tableId: TableId
  readonly prev: Pick<TableObject, 'label' | 'labelOverridden'>
  readonly next: Pick<TableObject, 'label' | 'labelOverridden'>
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Place an entire row. One undo step regardless of table count.
 * Stores the Row record and all generated TableObjects.
 */
export interface PlaceRowCommand extends CommandBase {
  readonly type: 'PLACE_ROW'
  readonly row: Row
  readonly tables: ReadonlyArray<TableObject>
}

/** Delete an entire row and its tables. */
export interface DeleteRowCommand extends CommandBase {
  readonly type: 'DELETE_ROW'
  readonly row: Row
  readonly tables: ReadonlyArray<TableObject>
  readonly affectedAssignments: ReadonlyArray<VendorAssignment>
}

/** Update row metadata and reposition its tables in one undoable step. */
export interface UpdateRowCommand extends CommandBase {
  readonly type: 'UPDATE_ROW'
  readonly rowId: RowId
  readonly prev: Partial<Omit<Row, 'id' | 'createdAt'>>
  readonly next: Partial<Omit<Row, 'id' | 'createdAt'>>
  readonly tableChanges: ReadonlyArray<{
    tableId: TableId
    prev: Pick<TableObject, 'x' | 'y' | 'rotation'>
    next: Pick<TableObject, 'x' | 'y' | 'rotation'>
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSectionCommand extends CommandBase {
  readonly type: 'CREATE_SECTION'
  readonly section: Section
}

export interface UpdateSectionCommand extends CommandBase {
  readonly type: 'UPDATE_SECTION'
  readonly sectionId: SectionId
  readonly prev: Partial<Omit<Section, 'id'>>
  readonly next: Partial<Omit<Section, 'id'>>
}

/**
 * Delete a section. Tables that belonged to it are unassigned (sectionId → null).
 * Stores the prev sectionId for each affected table so undo can restore membership.
 */
export interface DeleteSectionCommand extends CommandBase {
  readonly type: 'DELETE_SECTION'
  readonly section: Section
  readonly affectedTableIds: ReadonlyArray<TableId>
}

/** Assign (or unassign) tables to a section. */
export interface AssignToSectionCommand extends CommandBase {
  readonly type: 'ASSIGN_TO_SECTION'
  readonly tableIds: ReadonlyArray<TableId>
  readonly prevSectionIds: ReadonlyArray<SectionId | null>
  readonly nextSectionId: SectionId | null
}

// ─────────────────────────────────────────────────────────────────────────────
// NUMBERING COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bulk renumber: row, section, or full layout.
 * One undo step. Stores prev/next label for every affected table.
 * Tables with labelOverridden = true are included in prev so undo restores
 * the override correctly.
 */
export interface RenumberCommand extends CommandBase {
  readonly type: 'RENUMBER'
  readonly scope: 'row' | 'section' | 'layout'
  readonly scopeId: RowId | SectionId | null  // null for layout scope
  readonly changes: ReadonlyArray<{
    tableId: TableId
    prev: Pick<TableObject, 'label' | 'labelOverridden'> & Partial<Pick<TableObject, 'displayId' | 'tableNumber'>>
    next: Pick<TableObject, 'label' | 'labelOverridden'> & Partial<Pick<TableObject, 'displayId' | 'tableNumber'>>
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR ASSIGNMENT COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/** Assign a vendor to a table. prevAssignment is null if the table was unassigned. */
export interface AssignVendorCommand extends CommandBase {
  readonly type: 'ASSIGN_VENDOR'
  readonly assignment: VendorAssignment
  readonly prevAssignment: VendorAssignment | null
}

/** Edit fields on an existing assignment. */
export interface UpdateVendorAssignmentCommand extends CommandBase {
  readonly type: 'UPDATE_VENDOR_ASSIGNMENT'
  readonly assignmentId: VendorAssignmentId
  readonly prev: Partial<Omit<VendorAssignment, 'id' | 'tableId' | 'layoutId'>>
  readonly next: Partial<Omit<VendorAssignment, 'id' | 'tableId' | 'layoutId'>>
}

/** Remove vendor from a table. Stores the full assignment for undo. */
export interface ClearVendorAssignmentCommand extends CommandBase {
  readonly type: 'CLEAR_VENDOR_ASSIGNMENT'
  readonly assignment: VendorAssignment
}

/**
 * Batch-assign multiple vendors to tables. One undo step for the entire batch.
 * Used by bulk paste in the Vendor Roster panel.
 */
export interface BatchAssignVendorsCommand extends CommandBase {
  readonly type: 'BATCH_ASSIGN_VENDORS'
  readonly createdAssignments: ReadonlyArray<VendorAssignment>
  readonly replacedAssignments: ReadonlyArray<VendorAssignment>
}

/**
 * Apply an import session. One undo step for the entire batch.
 * replacedAssignments: assignments that existed before and were overwritten.
 * createdAssignments: new assignments created by this import.
 * Undo removes createdAssignments and restores replacedAssignments.
 */
export interface ApplyImportCommand extends CommandBase {
  readonly type: 'APPLY_IMPORT'
  readonly importSessionId: ImportSessionId
  readonly createdVendors: ReadonlyArray<Vendor>
  readonly replacedAssignments: ReadonlyArray<VendorAssignment>
  readonly createdAssignments: ReadonlyArray<VendorAssignment>
  readonly vendorTableCountDeltas: ReadonlyArray<{
    vendorId: VendorId
    delta: number
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM & DOOR COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

/** Set or replace the entire composite room. null means "delete room". */
export interface SetRoomCommand extends CommandBase {
  readonly type: 'SET_ROOM'
  readonly prevRoom: CompositeRoom | null
  readonly nextRoom: CompositeRoom | null
}

/** Add a rectangular segment to the composite room. */
export interface AddRoomSegmentCommand extends CommandBase {
  readonly type: 'ADD_ROOM_SEGMENT'
  readonly segment: RoomSegment
  readonly prevRoom: CompositeRoom | null  // snapshot for undo
}

/** Update a segment's geometry (resize/reposition). */
export interface UpdateRoomSegmentCommand extends CommandBase {
  readonly type: 'UPDATE_ROOM_SEGMENT'
  readonly segmentId: RoomSegmentId
  readonly prev: Pick<RoomSegment, 'x' | 'y' | 'width' | 'height'>
  readonly next: Pick<RoomSegment, 'x' | 'y' | 'width' | 'height'>
}

/** Delete a segment from the composite room. */
export interface DeleteRoomSegmentCommand extends CommandBase {
  readonly type: 'DELETE_ROOM_SEGMENT'
  readonly segment: RoomSegment
}

/** Set a freehand polygon room. */
export interface SetFreehandRoomCommand extends CommandBase {
  readonly type: 'SET_FREEHAND_ROOM'
  readonly prevRoom: CompositeRoom | null
  readonly vertices: Point[]
}

/** Place a door on a wall. */
export interface PlaceDoorCommand extends CommandBase {
  readonly type: 'PLACE_DOOR'
  readonly door: Door
}

/** Move a door along its wall or to a different wall. */
export interface MoveDoorCommand extends CommandBase {
  readonly type: 'MOVE_DOOR'
  readonly doorId: DoorId
  readonly prev: Pick<Door, 'x' | 'y' | 'side'>
  readonly next: Pick<Door, 'x' | 'y' | 'side'>
}

/** Resize a door opening width. */
export interface ResizeDoorCommand extends CommandBase {
  readonly type: 'RESIZE_DOOR'
  readonly doorId: DoorId
  readonly prevWidth: number
  readonly nextWidth: number
}

/** Delete a door. Stores full snapshot for undo. */
export interface DeleteDoorCommand extends CommandBase {
  readonly type: 'DELETE_DOOR'
  readonly door: Door
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS COMMAND
// ─────────────────────────────────────────────────────────────────────────────

export interface UpdateSettingsCommand extends CommandBase {
  readonly type: 'UPDATE_SETTINGS'
  readonly prev: Partial<LayoutSettings>
  readonly next: Partial<LayoutSettings>
}

// ─────────────────────────────────────────────────────────────────────────────
// UNION TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type LayoutCommand =
  | PlaceTableCommand
  | MoveTablesCommand
  | ResizeTableCommand
  | RotateTablesCommand
  | SetTablePremiumCommand
  | DeleteTablesCommand
  | RelabelTableCommand
  | PlaceRowCommand
  | DeleteRowCommand
  | UpdateRowCommand
  | CreateSectionCommand
  | UpdateSectionCommand
  | DeleteSectionCommand
  | AssignToSectionCommand
  | RenumberCommand
  | AssignVendorCommand
  | UpdateVendorAssignmentCommand
  | ClearVendorAssignmentCommand
  | BatchAssignVendorsCommand
  | ApplyImportCommand
  | SetRoomCommand
  | AddRoomSegmentCommand
  | UpdateRoomSegmentCommand
  | DeleteRoomSegmentCommand
  | SetFreehandRoomCommand
  | PlaceDoorCommand
  | MoveDoorCommand
  | ResizeDoorCommand
  | DeleteDoorCommand
  | UpdateSettingsCommand

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY STACK
//
// past:   executed commands, oldest → newest. Undo pops from the end.
// future: undone commands, most recent → oldest. Redo pops from the end.
// maxSize: once past exceeds this, the oldest entry is dropped.
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandHistory {
  readonly past: ReadonlyArray<LayoutCommand>
  readonly future: ReadonlyArray<LayoutCommand>
  readonly maxSize: number
}

export const EMPTY_HISTORY: CommandHistory = {
  past: [],
  future: [],
  maxSize: 100,
}
