// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY MODULE INTERFACE
//
// Pure functions operating on stored canvas data.
// No side effects. No React dependency. Fully testable in isolation.
//
// All coordinates are in canvas units (not pixels; the canvas scale
// is controlled by Konva's stage transform).
//
// Rotation handling:
//   TableObject stores rotation in degrees. The geometry module works with
//   rotated tables by computing actual corner positions. All overlap and gap
//   calculations use the rotated geometry, not the AABB, for correctness.
//   The AABB is provided separately for broad-phase checks (e.g., spatial index).
// ─────────────────────────────────────────────────────────────────────────────

import type { Point, Rect, TableObject } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bounding box result for a single table.
 * rotatedCorners: the four actual corners after rotation (clockwise from top-left).
 * bounds: axis-aligned bounding box — useful for broad-phase spatial checks.
 *
 * DERIVED — never stored in the document.
 */
export interface BoundsResult {
  bounds: Rect
  rotatedCorners: [Point, Point, Point, Point]
}

/**
 * Result of checking two tables for overlap.
 * DERIVED — never stored.
 */
export interface OverlapResult {
  overlaps: boolean
  overlapArea: number     // 0 if no overlap
}

/**
 * The clear gap between two tables in each axis direction.
 * negative gap means they overlap in that axis.
 * DERIVED — never stored.
 */
export interface GapResult {
  horizontal: number | null   // null if tables are not roughly side-by-side
  vertical: number | null     // null if tables are not roughly stacked
  minimum: number             // smallest clear gap in any direction
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface GeometryModule {
  /**
   * Compute the axis-aligned bounding box and rotated corner positions for a table.
   * All downstream geometry calculations start here.
   */
  getBounds(table: TableObject): BoundsResult

  /**
   * Check if two tables overlap using the Separating Axis Theorem.
   * Handles rotated tables correctly.
   */
  checkOverlap(a: TableObject, b: TableObject): OverlapResult

  /**
   * Find all overlapping pairs in a list of tables.
   * Returns only distinct pairs — (a,b) will not also appear as (b,a).
   * O(n²) — acceptable for up to 300 tables; optimize with spatial index if needed.
   */
  findAllOverlaps(tables: TableObject[]): Array<[TableObject, TableObject]>

  /**
   * Measure the clear gap between two tables in each axis direction.
   * Uses AABB for v1 — sufficient for axis-aligned and lightly-rotated layouts.
   */
  measureGap(a: TableObject, b: TableObject): GapResult

  /** True if the point lies within the given rect. */
  containsPoint(rect: Rect, point: Point): boolean

  /** True if inner is fully contained by outer. */
  containedBy(inner: Rect, outer: Rect): boolean

  /** Smallest rect that contains all given rects. */
  unionBounds(rects: Rect[]): Rect

  /**
   * Expand a rect outward by a uniform margin.
   * Used to compute clearance zones around doors and obstacles.
   */
  expandRect(rect: Rect, margin: number): Rect

  /** Ensure rect has positive width and height (normalizes drag-selection rects). */
  normalizeRect(rect: Rect): Rect
}
