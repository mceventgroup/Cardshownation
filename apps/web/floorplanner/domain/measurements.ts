import type { CompositeRoom, Point, TableObject } from './types'
import { geometry } from './geometry.impl'
import { findNearestBoundarySample } from './room-contour'

export function formatMeasurement(start: Point, end: Point): string {
  const inches = Math.round(Math.hypot(end.x - start.x, end.y - start.y))
  return `${Math.floor(inches / 12)}′${inches % 12 ? ` ${inches % 12}″` : ''}`
}

export function measurementEnd(start: Point, pointer: Point, length: number | null, constrain: boolean): Point {
  let dx = pointer.x - start.x
  let dy = pointer.y - start.y
  if (constrain) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0
    else dx = 0
  }
  const distance = Math.hypot(dx, dy)
  if (length !== null && length > 0 && distance > 0) {
    dx *= length / distance
    dy *= length / distance
  }
  return { x: start.x + dx, y: start.y + dy }
}

/** Snap to the actual wall or table edge, not the center of the object. */
export function snapMeasurementPoint(point: Point, room: CompositeRoom | null, tables: TableObject[], tolerance: number): Point {
  let result = point
  let nearest = tolerance
  const boundary = room ? findNearestBoundarySample(room, point) : null
  if (boundary && boundary.distance <= nearest) {
    result = boundary.point
    nearest = boundary.distance
  }
  for (const table of tables) {
    const corners = geometry.getBounds(table).rotatedCorners
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], b = corners[(i + 1) % corners.length]
      const dx = b.x - a.x, dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      const candidate = { x: a.x + t * dx, y: a.y + t * dy }
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y)
      if (distance <= nearest) { nearest = distance; result = candidate }
    }
  }
  return result
}
