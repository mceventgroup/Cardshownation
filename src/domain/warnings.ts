// ─────────────────────────────────────────────────────────────────────────────
// WARNINGS MODULE INTERFACE
//
// Computes all layout warnings from current document state.
// ALL results are DERIVED — warnings are never stored in the document.
//
// Warnings are recomputed whenever the relevant document state changes.
// The store determines when to call computeWarnings (e.g., on every
// canvas mutation, or debounced for performance).
//
// Warning types and their data sources:
//   overlap         → tables array (geometry check)
//   narrow-aisle    → tables array + settings.minAisleWidth
//   door-blocked    → tables array + doors array + settings.doorClearance
//   duplicate-label → tables array (label check)
//   unassigned      → tables array + vendorAssignments array
//
// The checkUnassigned flag exists because "unassigned table" is only a
// meaningful warning when the event is considered finalized. Before that,
// it creates noise for every table placed during layout design.
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Door, CompositeRoom, LayoutSettings } from './types'
import type { VendorAssignment } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// WARNING TYPES — all DERIVED, never stored
// ─────────────────────────────────────────────────────────────────────────────

export type WarningSeverity = 'info' | 'warning' | 'error'

/** Two tables whose geometry overlaps. Severity: error. */
export interface OverlapWarning {
  type: 'overlap'
  severity: 'error'
  tableIds: [string, string]
  message: string
}

/** Two adjacent tables with a clear gap below minAisleWidth. Severity: warning. */
export interface NarrowAisleWarning {
  type: 'narrow-aisle'
  severity: WarningSeverity
  tableIds: [string, string]
  measuredWidth: number
  minimumWidth: number
  message: string
}

/** One or more tables blocking a door clearance zone. Severity: error. */
export interface DoorBlockedWarning {
  type: 'door-blocked'
  severity: 'error'
  doorId: string
  blockingTableIds: string[]
  message: string
}

/** Two or more tables share the same label. Severity: error. */
export interface DuplicateLabelWarning {
  type: 'duplicate-label'
  severity: 'error'
  label: string
  tableIds: string[]
  message: string
}

/** A table has no vendor assigned (only when checkUnassigned is true). Severity: info. */
export interface UnassignedTableWarning {
  type: 'unassigned-table'
  severity: 'info'
  tableId: string
  tableLabel: string
  message: string
}

/** A table is placed outside the room boundary. Severity: warning. */
export interface OutOfBoundsWarning {
  type: 'out-of-bounds'
  severity: 'warning'
  tableId: string
  tableLabel: string
  message: string
}

/** A table is within the wall setback zone. Severity: warning. */
export interface WallSetbackWarning {
  type: 'wall-setback'
  severity: 'warning'
  tableId: string
  tableLabel: string
  message: string
}

export type LayoutWarning =
  | OverlapWarning
  | NarrowAisleWarning
  | DoorBlockedWarning
  | DuplicateLabelWarning
  | UnassignedTableWarning
  | OutOfBoundsWarning
  | WallSetbackWarning

// ─────────────────────────────────────────────────────────────────────────────
// WARNING RESULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete set of computed warnings for a layout.
 * affectedTableIds is a pre-built set for O(1) lookup during canvas rendering
 * (to decide which tables need a warning indicator).
 *
 * DERIVED — never stored. Recomputed from document state on demand.
 */
export interface WarningResult {
  warnings: LayoutWarning[]
  errorCount: number
  warningCount: number
  infoCount: number
  affectedTableIds: Set<string>  // union of all tableIds across all warnings
}

export const EMPTY_WARNING_RESULT: WarningResult = {
  warnings: [],
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,
  affectedTableIds: new Set(),
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface WarningsModule {
  /**
   * Compute all active warnings from the current document state.
   * Pure function — same input always produces the same output.
   *
   * checkUnassigned: pass true only when the event is in a "finalized" state
   * where all tables should have vendors. False during active layout design.
   */
  computeWarnings(
    tables: ReadonlyArray<TableObject>,
    doors: ReadonlyArray<Door>,
    vendorAssignments: ReadonlyArray<VendorAssignment>,
    settings: LayoutSettings,
    checkUnassigned: boolean,
    room?: CompositeRoom | null,
  ): WarningResult

  /**
   * Check if a specific table has any active warnings.
   * Convenience method for per-table canvas rendering.
   * Equivalent to result.affectedTableIds.has(tableId).
   */
  tableHasWarning(result: WarningResult, tableId: string): boolean

  /**
   * Filter warnings to only those affecting a specific table.
   * Used when the user clicks a table to show its specific issues.
   */
  warningsForTable(result: WarningResult, tableId: string): LayoutWarning[]
}
