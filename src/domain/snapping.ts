// ─────────────────────────────────────────────────────────────────────────────
// SNAPPING MODULE INTERFACE
//
// All snap results are DERIVED — snap guides are visual feedback only and
// are never stored in the document.
//
// Snap priority (applied in order):
//   1. Object edge snap (if snapToObjects is enabled)
//   2. Object center snap (if snapToObjects is enabled)
//   3. Grid snap (if snapToGrid is enabled)
//   4. No snap (return unmodified position)
//
// Threshold: maximum canvas-unit distance from a snap target before the
// snap activates. Recommended default: half of gridSize.
// ─────────────────────────────────────────────────────────────────────────────

import type { Point, Rect } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES — all DERIVED, never stored
// ─────────────────────────────────────────────────────────────────────────────

export type SnapGuideAxis = 'vertical' | 'horizontal'
export type SnapGuideSource = 'grid' | 'object-edge' | 'object-center'

/**
 * A single alignment guide line to render on the canvas during a drag.
 * DERIVED — never stored.
 */
export interface SnapGuide {
  axis: SnapGuideAxis
  position: number       // canvas coordinate (x for vertical, y for horizontal)
  source: SnapGuideSource
  sourceId: string | null  // ID of the object that produced this guide, if any
}

/**
 * The result of a snap calculation for a drag operation.
 * DERIVED — never stored.
 */
export interface SnapResult {
  point: Point           // snapped top-left position for the moving rect
  snapped: boolean       // true if any snap was applied
  guides: SnapGuide[]    // active guides to render on canvas
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface SnappingModule {
  /**
   * Snap a point to the nearest grid intersection.
   * Returns the unmodified point if gridSize is 0 or snapping is disabled.
   */
  snapToGrid(point: Point, gridSize: number): Point

  /**
   * Snap a moving rect's edges and center to the edges and centers of
   * stationary target rects.
   * Returns the adjusted top-left position and the guides that are active.
   */
  snapToObjects(
    movingRect: Rect,
    targets: ReadonlyArray<Rect>,
    threshold: number,
  ): SnapResult

  /**
   * Combined snap: runs object snap first, then grid snap on the result.
   * This is the primary method called during drag operations.
   */
  snap(
    movingRect: Rect,
    targets: ReadonlyArray<Rect>,
    options: {
      gridSize: number
      snapToGrid: boolean
      snapToObjects: boolean
      threshold: number
    },
  ): SnapResult

  /**
   * Return all snap guides that would be active for the current position,
   * without actually snapping the rect.
   * Used to preview alignment guides before the user commits to a position.
   */
  getActiveGuides(
    movingRect: Rect,
    targets: ReadonlyArray<Rect>,
    threshold: number,
  ): SnapGuide[]
}
