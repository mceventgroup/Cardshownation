// ─────────────────────────────────────────────────────────────────────────────
// MEASUREMENT MODULE INTERFACE
//
// On-demand spatial measurements displayed as canvas overlays.
// ALL results are DERIVED — nothing here is ever stored in the document.
//
// Measurements are computed when the user activates the measure tool or when
// the editor needs to display aisle width indicators. They are recalculated
// on each relevant state change and discarded when no longer needed.
//
// v1 note: unit conversion (canvas units → real-world feet/meters) is not
// implemented. All measurements are in canvas units. The unitLabel from
// LayoutSettings is displayed as a suffix for user-facing strings but no
// actual conversion factor is applied.
// ─────────────────────────────────────────────────────────────────────────────

import type { Point, Rect, TableObject } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES — all DERIVED, never stored
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A straight-line distance measurement between two canvas points.
 * DERIVED — never stored.
 */
export interface DistanceMeasurement {
  from: Point
  to: Point
  distance: number        // canvas units
  label: string           // formatted for display, e.g. "42 ft"
}

/**
 * The measured aisle between two specific tables.
 * Includes anchor points so the canvas can draw the measurement line.
 * DERIVED — never stored.
 */
export interface AisleMeasurement {
  tableAId: string
  tableBId: string
  from: Point             // midpoint of the closest edge of tableA
  to: Point               // midpoint of the closest edge of tableB
  width: number           // clear gap in canvas units
  labelPosition: Point    // midpoint of from→to; where to render the label
  label: string           // formatted, e.g. "6 ft"
  belowMinimum: boolean   // true if width < minAisleWidth (drives warning color)
}

/**
 * Bounds and dimension labels for the current selection.
 * DERIVED — never stored.
 */
export interface SelectionMeasurement {
  bounds: Rect
  widthLabel: string
  heightLabel: string
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface MeasurementModule {
  /**
   * Measure the straight-line distance between two canvas points.
   * Used by the manual measure tool.
   */
  measureDistance(from: Point, to: Point, unitLabel: string): DistanceMeasurement

  /**
   * Measure the clear aisle between two specific tables.
   * Used by the spacing overlay and by the warnings engine display.
   */
  measureAisle(
    a: TableObject,
    b: TableObject,
    minAisleWidth: number,
    unitLabel: string,
  ): AisleMeasurement

  /**
   * Compute the bounding rect and dimension labels for a set of selected tables.
   * Used to show selection size in the properties panel.
   */
  measureSelection(tables: ReadonlyArray<TableObject>, unitLabel: string): SelectionMeasurement

  /**
   * Format a raw canvas unit value as a display string.
   * v1: returns `${value} ${unitLabel}` — no real-world conversion.
   */
  formatUnits(value: number, unitLabel: string): string
}
