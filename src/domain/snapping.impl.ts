// ─────────────────────────────────────────────────────────────────────────────
// SNAPPING MODULE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

import type { Point, Rect } from './types'
import type { SnapGuide, SnapResult, SnappingModule } from './snapping'
import { roundTo } from '@/lib/math'

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Key positions of a rect: its edges and center axes. */
function rectKeyPositions(r: Rect) {
  return {
    left:    r.x,
    right:   r.x + r.width,
    centerX: r.x + r.width / 2,
    top:     r.y,
    bottom:  r.y + r.height,
    centerY: r.y + r.height / 2,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

function snapToGrid(point: Point, gridSize: number): Point {
  if (gridSize <= 0) return point
  return {
    x: roundTo(point.x, gridSize),
    y: roundTo(point.y, gridSize),
  }
}

function snapToObjects(
  movingRect: Rect,
  targets: ReadonlyArray<Rect>,
  threshold: number,
): SnapResult {
  const moving = rectKeyPositions(movingRect)
  const guides: SnapGuide[] = []

  let snappedX = movingRect.x
  let snappedY = movingRect.y
  let snappedHorizontally = false
  let snappedVertically = false

  for (const target of targets) {
    const t = rectKeyPositions(target)

    // Horizontal snap: moving's left/right/center aligns with target's left/right/center
    if (!snappedHorizontally) {
      const xCandidates: Array<{ movingPos: number; targetPos: number; sourceId?: string }> = [
        { movingPos: moving.left,    targetPos: t.left    },
        { movingPos: moving.left,    targetPos: t.right   },
        { movingPos: moving.right,   targetPos: t.left    },
        { movingPos: moving.right,   targetPos: t.right   },
        { movingPos: moving.centerX, targetPos: t.centerX },
      ]
      for (const c of xCandidates) {
        if (Math.abs(c.movingPos - c.targetPos) <= threshold) {
          // Adjust snappedX so movingPos aligns with targetPos
          snappedX = movingRect.x + (c.targetPos - c.movingPos)
          snappedHorizontally = true
          guides.push({
            axis: 'vertical',
            position: c.targetPos,
            source: 'object-edge',
            sourceId: null,
          })
          break
        }
      }
    }

    // Vertical snap: moving's top/bottom/center aligns with target's top/bottom/center
    if (!snappedVertically) {
      const yCandidates: Array<{ movingPos: number; targetPos: number }> = [
        { movingPos: moving.top,     targetPos: t.top     },
        { movingPos: moving.top,     targetPos: t.bottom  },
        { movingPos: moving.bottom,  targetPos: t.top     },
        { movingPos: moving.bottom,  targetPos: t.bottom  },
        { movingPos: moving.centerY, targetPos: t.centerY },
      ]
      for (const c of yCandidates) {
        if (Math.abs(c.movingPos - c.targetPos) <= threshold) {
          snappedY = movingRect.y + (c.targetPos - c.movingPos)
          snappedVertically = true
          guides.push({
            axis: 'horizontal',
            position: c.targetPos,
            source: 'object-edge',
            sourceId: null,
          })
          break
        }
      }
    }

    if (snappedHorizontally && snappedVertically) break
  }

  const snapped = snappedHorizontally || snappedVertically
  return {
    point: { x: snappedX, y: snappedY },
    snapped,
    guides,
  }
}

function snap(
  movingRect: Rect,
  targets: ReadonlyArray<Rect>,
  options: {
    gridSize: number
    snapToGrid: boolean
    snapToObjects: boolean
    threshold: number
  },
): SnapResult {
  // Object snap takes priority over grid snap
  if (options.snapToObjects && targets.length > 0) {
    const objResult = snapToObjects(movingRect, targets, options.threshold)
    if (objResult.snapped) return objResult
  }

  if (options.snapToGrid && options.gridSize > 0) {
    const snappedPt = snapToGrid({ x: movingRect.x, y: movingRect.y }, options.gridSize)
    const didSnap = snappedPt.x !== movingRect.x || snappedPt.y !== movingRect.y
    return {
      point: snappedPt,
      snapped: didSnap,
      guides: [],
    }
  }

  return {
    point: { x: movingRect.x, y: movingRect.y },
    snapped: false,
    guides: [],
  }
}

function getActiveGuides(
  movingRect: Rect,
  targets: ReadonlyArray<Rect>,
  threshold: number,
): SnapGuide[] {
  return snapToObjects(movingRect, targets, threshold).guides
}

export const snapping: SnappingModule = {
  snapToGrid,
  snapToObjects,
  snap,
  getActiveGuides,
}
