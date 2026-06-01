// ─────────────────────────────────────────────────────────────────────────────
// ROW-BUILDING MODULE INTERFACE
//
// Row building is the primary table placement workflow.
// The row builder takes a config and produces a fully-formed Row record
// plus all its TableObjects in a single operation.
//
// Key design decisions:
//   - buildRow is pure: same config always produces the same geometry.
//   - Tables are positioned relative to the origin point in the config.
//   - Numbering is applied as part of row creation via the NumberingScheme.
//   - The caller is responsible for dispatching PlaceRowCommand with the result.
//   - distributeEvenly and alignToAxis are non-destructive: they return new
//     position data and never mutate input arrays.
// ─────────────────────────────────────────────────────────────────────────────

import type { Point, Rect, TableObject, Row, SectionId, RowCurveDirection, RowId } from './types'
import type { NumberingScheme } from './numbering'

// ─────────────────────────────────────────────────────────────────────────────
// ROW CONFIG
// Everything needed to build a row from scratch.
// ─────────────────────────────────────────────────────────────────────────────

export interface RowConfig {
  roomId: string
  tableCount: number
  tableWidth: number
  tableHeight: number
  spacing: number             // gap between tables in canvas units
  orientation: 'horizontal' | 'vertical' | 'curved'
  origin: Point               // first-table anchor for straight rows; curve midpoint for curved rows
  curveRadius?: number
  curveCenter?: Point
  curveMidAngle?: number
  curveDirection?: RowCurveDirection
  sectionId: SectionId | null
  numberingScheme: NumberingScheme
  startLabel: string          // the first label in the sequence (e.g. "A-1", "1")
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The complete output of buildRow — a Row record and all its TableObjects. */
export interface BuiltRow {
  row: Row
  tables: TableObject[]
}

/**
 * Repositioned tables from distributeEvenly or alignToAxis.
 * Only position fields change — labels, IDs, section membership are unchanged.
 */
export type RepositionedTable = Pick<TableObject, 'id' | 'x' | 'y'> & {
  rotation?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface RowModule {
  /**
   * Build a complete row from config.
   * Generates a Row record and all TableObjects with correct positions,
   * labels, sectionId, rowId, and order values.
   * The caller provides rowId so it can be pre-generated (e.g., by the store).
   */
  buildRow(config: RowConfig, rowId: RowId): BuiltRow

  /**
   * Redistribute existing row tables with even spacing between them,
   * keeping the first table's position as the anchor.
   * Returns repositioned coordinates only — does not mutate input.
   */
  distributeEvenly(
    tables: ReadonlyArray<TableObject>,
    spacing: number,
  ): RepositionedTable[]

  /**
   * Align all tables in a row to share the same x (vertical align)
   * or y (horizontal align) value.
   * Uses the first table's coordinate as the alignment target.
   * Returns repositioned coordinates only — does not mutate input.
   */
  alignToAxis(
    tables: ReadonlyArray<TableObject>,
    axis: 'x' | 'y',
  ): RepositionedTable[]

  /**
   * Compute the smallest bounding rect that contains all tables in the row.
   * DERIVED — used by the canvas to draw row selection handles.
   */
  getRowBounds(tables: ReadonlyArray<TableObject>): Rect

  /**
   * Recalculate table positions given updated row parameters.
   * Used when the user edits spacing or table size on an existing row.
   * Anchors to the first table's top-left position.
   * Returns repositioned coordinates only — does not mutate input.
   */
  recalculateRowPositions(
    row: Row,
    tables: ReadonlyArray<TableObject>,
    updates: Partial<Pick<RowConfig, 'tableWidth' | 'tableHeight' | 'spacing' | 'curveRadius'>>,
  ): RepositionedTable[]
}
