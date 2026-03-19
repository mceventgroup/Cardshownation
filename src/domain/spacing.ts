// ─────────────────────────────────────────────────────────────────────────────
// SPACING MODULE INTERFACE
//
// Checks aisle widths and door clearances. All results are DERIVED from
// document state — nothing here is stored in the document.
//
// These functions feed directly into the warnings engine. They are split into
// a separate module because they are independently testable and may be called
// in isolation (e.g., measuring a specific aisle during layout editing).
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Door } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES — all DERIVED, never stored
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A pair of tables with a measured aisle below the minimum threshold.
 * DERIVED — never stored.
 */
export interface AisleViolation {
  tableA: TableObject
  tableB: TableObject
  measuredWidth: number    // actual clear gap in canvas units
  minimumWidth: number     // the threshold that was violated
  severity: 'warning' | 'error'
}

/**
 * A door whose required clearance zone is blocked by one or more tables.
 * DERIVED — never stored.
 */
export interface DoorViolation {
  door: Door
  blockingTables: TableObject[]
  measuredClearance: number   // smallest measured clearance from any blocking table
  requiredClearance: number
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface SpacingModule {
  /**
   * Find all adjacent table pairs whose clear gap is below minAisleWidth.
   *
   * "Adjacent" means the AABB gap is below the check threshold — tables
   * that are far apart are skipped for performance. This is O(n²) in the
   * worst case but early-exits on distance for the common case.
   */
  findNarrowAisles(
    tables: ReadonlyArray<TableObject>,
    minAisleWidth: number,
  ): AisleViolation[]

  /**
   * Find tables that intrude into the required clearance zone in front of
   * any door. The clearance zone is a rect projected from the door opening
   * inward by the required clearance distance.
   */
  findDoorViolations(
    tables: ReadonlyArray<TableObject>,
    doors: ReadonlyArray<Door>,
    minClearance: number,
  ): DoorViolation[]

  /**
   * Measure the clear aisle between two specific tables.
   * Returns the minimum gap in canvas units (negative means overlap).
   * Used for on-demand measurement overlays during editing.
   */
  measureAisleBetween(a: TableObject, b: TableObject): number
}
