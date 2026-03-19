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
  TableObject,
  Row,
  Section,
  VendorAssignment,
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
    prev: Pick<TableObject, 'label' | 'labelOverridden'>
    next: Pick<TableObject, 'label' | 'labelOverridden'>
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
 * Apply an import session. One undo step for the entire batch.
 * replacedAssignments: assignments that existed before and were overwritten.
 * createdAssignments: new assignments created by this import.
 * Undo removes createdAssignments and restores replacedAssignments.
 */
export interface ApplyImportCommand extends CommandBase {
  readonly type: 'APPLY_IMPORT'
  readonly importSessionId: ImportSessionId
  readonly replacedAssignments: ReadonlyArray<VendorAssignment>
  readonly createdAssignments: ReadonlyArray<VendorAssignment>
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
  | DeleteTablesCommand
  | RelabelTableCommand
  | PlaceRowCommand
  | DeleteRowCommand
  | CreateSectionCommand
  | UpdateSectionCommand
  | DeleteSectionCommand
  | AssignToSectionCommand
  | RenumberCommand
  | AssignVendorCommand
  | UpdateVendorAssignmentCommand
  | ClearVendorAssignmentCommand
  | ApplyImportCommand
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
