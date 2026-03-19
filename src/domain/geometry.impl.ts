// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY MODULE IMPLEMENTATION
//
// Uses the Separating Axis Theorem (SAT) for overlap detection.
// All calculations are in canvas units.
// ─────────────────────────────────────────────────────────────────────────────

import type { Point, Rect, TableObject } from './types'
import type { BoundsResult, OverlapResult, GapResult, GeometryModule } from './geometry'

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Get the 4 corners of a (possibly rotated) table, in clockwise order: TL, TR, BR, BL. */
function getCorners(table: TableObject): [Point, Point, Point, Point] {
  const cx = table.x + table.width / 2
  const cy = table.y + table.height / 2
  const rad = (table.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hw = table.width / 2
  const hh = table.height / 2

  const rotate = (px: number, py: number): Point => ({
    x: cx + px * cos - py * sin,
    y: cy + px * sin + py * cos,
  })

  return [
    rotate(-hw, -hh), // TL
    rotate(+hw, -hh), // TR
    rotate(+hw, +hh), // BR
    rotate(-hw, +hh), // BL
  ]
}

/** Project all corners onto an axis vector and return [min, max] scalar values. */
function projectOnAxis(
  corners: readonly Point[],
  axisX: number,
  axisY: number,
): { min: number; max: number } {
  // Normalize axis to avoid scaling the projection values
  const len = Math.sqrt(axisX * axisX + axisY * axisY)
  if (len === 0) return { min: 0, max: 0 }
  const nx = axisX / len
  const ny = axisY / len

  let min = Infinity
  let max = -Infinity
  for (const c of corners) {
    const d = c.x * nx + c.y * ny
    if (d < min) min = d
    if (d > max) max = d
  }
  return { min, max }
}

/**
 * SAT overlap test for two convex polygons (both rectangles here).
 * Returns false if any separating axis is found.
 */
function satOverlap(
  cornersA: readonly Point[],
  cornersB: readonly Point[],
): boolean {
  const allGroups = [cornersA, cornersB]
  for (const corners of allGroups) {
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i]
      const b = corners[(i + 1) % corners.length]
      // Edge vector → perpendicular normal
      const nx = -(b.y - a.y)
      const ny = b.x - a.x

      const projA = projectOnAxis(cornersA, nx, ny)
      const projB = projectOnAxis(cornersB, nx, ny)

      // Strict separation: if max of one < min of other, no overlap
      if (projA.max < projB.min || projB.max < projA.min) {
        return false
      }
    }
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

function getBounds(table: TableObject): BoundsResult {
  const corners = getCorners(table)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of corners) {
    if (c.x < minX) minX = c.x
    if (c.y < minY) minY = c.y
    if (c.x > maxX) maxX = c.x
    if (c.y > maxY) maxY = c.y
  }
  return {
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    rotatedCorners: corners,
  }
}

function checkOverlap(a: TableObject, b: TableObject): OverlapResult {
  // Fast AABB rejection before SAT
  const ba = getBounds(a).bounds
  const bb = getBounds(b).bounds
  if (
    ba.x + ba.width <= bb.x ||
    bb.x + bb.width <= ba.x ||
    ba.y + ba.height <= bb.y ||
    bb.y + bb.height <= ba.y
  ) {
    return { overlaps: false, overlapArea: 0 }
  }

  const cornersA = getCorners(a)
  const cornersB = getCorners(b)
  const overlaps = satOverlap(cornersA, cornersB)

  if (!overlaps) return { overlaps: false, overlapArea: 0 }

  // Approximate overlap area using AABB intersection (sufficient for warnings display)
  const ix = Math.max(0, Math.min(ba.x + ba.width, bb.x + bb.width) - Math.max(ba.x, bb.x))
  const iy = Math.max(0, Math.min(ba.y + ba.height, bb.y + bb.height) - Math.max(ba.y, bb.y))
  return { overlaps: true, overlapArea: ix * iy }
}

function findAllOverlaps(tables: TableObject[]): Array<[TableObject, TableObject]> {
  const result: Array<[TableObject, TableObject]> = []
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      if (checkOverlap(tables[i], tables[j]).overlaps) {
        result.push([tables[i], tables[j]])
      }
    }
  }
  return result
}

function measureGap(a: TableObject, b: TableObject): GapResult {
  const ba = getBounds(a).bounds
  const bb = getBounds(b).bounds

  // Signed gaps in each cardinal direction (positive = clear space)
  const rightOf  = bb.x - (ba.x + ba.width)   // b is right of a
  const leftOf   = ba.x - (bb.x + bb.width)   // b is left of a
  const belowOf  = bb.y - (ba.y + ba.height)  // b is below a
  const aboveOf  = ba.y - (bb.y + bb.height)  // b is above a

  // The "horizontal gap" is the separation in the dominant horizontal direction
  const horizontal = Math.max(rightOf, leftOf)
  const vertical   = Math.max(belowOf, aboveOf)

  // Minimum clear gap: smallest positive gap in any direction
  // If all are negative, minimum is the least negative (closest to touching)
  const candidates = [rightOf, leftOf, belowOf, aboveOf]
  const positiveCandidates = candidates.filter(v => v >= 0)
  const minimum = positiveCandidates.length > 0
    ? Math.min(...positiveCandidates)
    : Math.max(...candidates)

  return { horizontal, vertical, minimum }
}

function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

function containedBy(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

function unionBounds(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const r of rects) {
    if (r.x < minX) minX = r.x
    if (r.y < minY) minY = r.y
    if (r.x + r.width > maxX) maxX = r.x + r.width
    if (r.y + r.height > maxY) maxY = r.y + r.height
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function normalizeRect(rect: Rect): Rect {
  return {
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  }
}

export const geometry: GeometryModule = {
  getBounds,
  checkOverlap,
  findAllOverlaps,
  measureGap,
  containsPoint,
  containedBy,
  unionBounds,
  expandRect,
  normalizeRect,
}
