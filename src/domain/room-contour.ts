// ─────────────────────────────────────────────────────────────────────────────
// ROOM CONTOUR
//
// Computes the outer polygon contour from a set of axis-aligned rectangular
// segments. Internal walls between touching/overlapping rectangles disappear.
//
// Algorithm:
//   1. Coordinate compression — collect unique X/Y from all rectangle edges
//   2. Build a compressed boolean grid of filled cells
//   3. Collect directed boundary edges (clockwise around filled regions)
//   4. Chain edges into closed polygons using right-turn preference
//   5. Simplify by removing collinear intermediate vertices
//
// Returns Point[][] — one polygon per connected component (most rooms = 1).
// ─────────────────────────────────────────────────────────────────────────────

import type { Point, RoomSegment, CompositeRoom, Rect } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DirectedEdge {
  x1: number; y1: number
  x2: number; y2: number
}

// Direction enum: 0=right, 1=down, 2=left, 3=up
type Dir = 0 | 1 | 2 | 3

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the outer contour polygon(s) for a composite room.
 * If freehandVertices is set, returns those directly.
 * Otherwise computes from rectangular segments.
 */
export function computeRoomContour(room: CompositeRoom): Point[][] {
  if (room.freehandVertices && room.freehandVertices.length >= 3) {
    return [room.freehandVertices]
  }
  return computeSegmentContour(room.segments)
}

/**
 * Compute the bounding box of the entire composite room.
 */
export function computeRoomBounds(room: CompositeRoom): Rect | null {
  if (room.freehandVertices && room.freehandVertices.length >= 3) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of room.freehandVertices) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  if (room.segments.length === 0) return null

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const seg of room.segments) {
    if (seg.x < minX) minX = seg.x
    if (seg.y < minY) minY = seg.y
    if (seg.x + seg.width > maxX) maxX = seg.x + seg.width
    if (seg.y + seg.height > maxY) maxY = seg.y + seg.height
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Check if a point is inside the composite room.
 * Uses bounding box of each segment (fast) or point-in-polygon for freehand.
 */
export function isPointInRoom(room: CompositeRoom, p: Point): boolean {
  if (room.freehandVertices && room.freehandVertices.length >= 3) {
    return pointInPolygon(p, room.freehandVertices)
  }
  return room.segments.some(s =>
    p.x >= s.x && p.x <= s.x + s.width &&
    p.y >= s.y && p.y <= s.y + s.height
  )
}

/**
 * Check if a rect is fully inside the composite room (union of segments).
 * For segments: the rect must be fully inside at least one segment.
 * For freehand: all 4 corners must be inside the polygon.
 */
export function isRectInRoom(room: CompositeRoom, rect: Rect): boolean {
  if (room.freehandVertices && room.freehandVertices.length >= 3) {
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ]
    return corners.every(c => pointInPolygon(c, room.freehandVertices!))
  }
  // For segments: every corner must be inside the union of segments
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
  return corners.every(c => isPointInRoom(room, c))
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT CONTOUR ALGORITHM
// ─────────────────────────────────────────────────────────────────────────────

function computeSegmentContour(segments: RoomSegment[]): Point[][] {
  if (segments.length === 0) return []

  // 1. Coordinate compression (skip degenerate segments)
  const xSet = new Set<number>()
  const ySet = new Set<number>()
  for (const seg of segments) {
    if (seg.width <= 0 || seg.height <= 0) continue
    xSet.add(seg.x)
    xSet.add(seg.x + seg.width)
    ySet.add(seg.y)
    ySet.add(seg.y + seg.height)
  }
  if (xSet.size === 0) return []
  const xs = [...xSet].sort((a, b) => a - b)
  const ys = [...ySet].sort((a, b) => a - b)

  const xIdx = new Map<number, number>()
  const yIdx = new Map<number, number>()
  xs.forEach((v, i) => xIdx.set(v, i))
  ys.forEach((v, i) => yIdx.set(v, i))

  const cols = xs.length - 1
  const rows = ys.length - 1
  if (cols <= 0 || rows <= 0) return []

  // 2. Fill grid
  const grid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))
  for (const seg of segments) {
    if (seg.width <= 0 || seg.height <= 0) continue
    const c1 = xIdx.get(seg.x)!
    const c2 = xIdx.get(seg.x + seg.width)!
    const r1 = yIdx.get(seg.y)!
    const r2 = yIdx.get(seg.y + seg.height)!
    for (let r = r1; r < r2; r++) {
      for (let c = c1; c < c2; c++) {
        grid[r][c] = true
      }
    }
  }

  // 3. Collect directed boundary edges (clockwise around filled cells)
  const edges: DirectedEdge[] = []

  function isFilled(r: number, c: number): boolean {
    return r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c]
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue
      const l = xs[c], ri = xs[c + 1], t = ys[r], b = ys[r + 1]

      // Top edge: no filled cell above → left-to-right (clockwise)
      if (!isFilled(r - 1, c)) edges.push({ x1: l, y1: t, x2: ri, y2: t })
      // Bottom edge: no filled cell below → right-to-left (clockwise)
      if (!isFilled(r + 1, c)) edges.push({ x1: ri, y1: b, x2: l, y2: b })
      // Left edge: no filled cell to left → bottom-to-top (clockwise)
      if (!isFilled(r, c - 1)) edges.push({ x1: l, y1: b, x2: l, y2: t })
      // Right edge: no filled cell to right → top-to-bottom (clockwise)
      if (!isFilled(r, c + 1)) edges.push({ x1: ri, y1: t, x2: ri, y2: b })
    }
  }

  if (edges.length === 0) return []

  // 4. Chain edges into closed polygons
  // Build adjacency: startPoint → list of edge indices
  const adjMap = new Map<string, number[]>()
  const edgeKey = (x: number, y: number) => `${x},${y}`

  for (let i = 0; i < edges.length; i++) {
    const k = edgeKey(edges[i].x1, edges[i].y1)
    if (!adjMap.has(k)) adjMap.set(k, [])
    adjMap.get(k)!.push(i)
  }

  function edgeDir(e: DirectedEdge): Dir {
    if (e.x2 > e.x1) return 0 // right
    if (e.y2 > e.y1) return 1 // down
    if (e.x2 < e.x1) return 2 // left
    return 3 // up
  }

  // At each vertex, pick the outgoing edge with tightest right turn
  // from the incoming direction. This traces outer boundaries clockwise.
  function pickNext(fromDir: Dir, endX: number, endY: number, used: boolean[]): number {
    const k = edgeKey(endX, endY)
    const candidates = adjMap.get(k)
    if (!candidates) return -1

    // Preference: right turn (+1), straight (0), left turn (+3), U-turn (+2)
    const preference: Dir[] = [
      ((fromDir + 1) % 4) as Dir,
      fromDir,
      ((fromDir + 3) % 4) as Dir,
      ((fromDir + 2) % 4) as Dir,
    ]

    for (const pref of preference) {
      for (const idx of candidates) {
        if (!used[idx] && edgeDir(edges[idx]) === pref) return idx
      }
    }
    return -1
  }

  const used = new Array(edges.length).fill(false)
  const polygons: Point[][] = []

  for (let startIdx = 0; startIdx < edges.length; startIdx++) {
    if (used[startIdx]) continue

    const polygon: Point[] = []
    let idx = startIdx

    while (idx !== -1 && !used[idx]) {
      used[idx] = true
      const e = edges[idx]
      polygon.push({ x: e.x1, y: e.y1 })

      const dir = edgeDir(e)
      idx = pickNext(dir, e.x2, e.y2, used)
    }

    if (polygon.length >= 3) {
      polygons.push(simplifyPolygon(polygon))
    }
  }

  return polygons
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Remove collinear intermediate vertices from a polygon. */
function simplifyPolygon(pts: Point[]): Point[] {
  if (pts.length < 3) return pts
  const result: Point[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const curr = pts[i]
    const next = pts[(i + 1) % n]
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x)
    if (cross !== 0) {
      result.push(curr)
    }
  }
  return result.length >= 3 ? result : pts
}

/**
 * Clamp a rectangle so it respects the wall setback distance.
 * For segment-based rooms, ensures every edge of the rect is at least
 * `setback` canvas-units inside the nearest wall.
 * Returns adjusted { x, y } or the original if no room / no clamp needed.
 */
export function clampToWallSetback(
  room: CompositeRoom,
  rect: Rect,
  setback: number,
): { x: number; y: number } {
  if (setback <= 0) return { x: rect.x, y: rect.y }

  const bounds = computeRoomBounds(room)
  if (!bounds) return { x: rect.x, y: rect.y }

  // Simple approach: clamp within bounds inset by setback
  const minX = bounds.x + setback
  const minY = bounds.y + setback
  const maxX = bounds.x + bounds.width - setback - rect.width
  const maxY = bounds.y + bounds.height - setback - rect.height

  return {
    x: Math.max(minX, Math.min(maxX, rect.x)),
    y: Math.max(minY, Math.min(maxY, rect.y)),
  }
}

/**
 * Compute the clearance zone rect for a door given room bounds.
 */
export function getDoorClearanceZone(
  door: { x: number; y: number; width: number; side: 'top' | 'bottom' | 'left' | 'right' },
  bounds: Rect,
  clearance: number,
): Rect {
  switch (door.side) {
    case 'top':
      return { x: door.x, y: bounds.y, width: door.width, height: clearance }
    case 'bottom':
      return { x: door.x, y: bounds.y + bounds.height - clearance, width: door.width, height: clearance }
    case 'left':
      return { x: bounds.x, y: door.y, width: clearance, height: door.width }
    case 'right':
      return { x: bounds.x + bounds.width - clearance, y: door.y, width: clearance, height: door.width }
  }
}

/**
 * Push a table rect out of all door clearance zones.
 * Returns adjusted { x, y }.
 */
export function pushOutOfDoorZones(
  tableRect: Rect,
  doors: ReadonlyArray<{ x: number; y: number; width: number; side: 'top' | 'bottom' | 'left' | 'right' }>,
  bounds: Rect,
  clearance: number,
): { x: number; y: number } {
  let { x, y } = tableRect
  const { width: tw, height: th } = tableRect

  for (const door of doors) {
    const zone = getDoorClearanceZone(door, bounds, clearance)

    // Check overlap between table and zone
    const overlapX = x < zone.x + zone.width && x + tw > zone.x
    const overlapY = y < zone.y + zone.height && y + th > zone.y
    if (!overlapX || !overlapY) continue

    // Push table away from the wall into the room interior
    if (door.side === 'top' || door.side === 'bottom') {
      // Prefer pushing away from the wall (into room interior)
      if (door.side === 'top') {
        y = zone.y + zone.height  // push below zone
      } else {
        y = zone.y - th           // push above zone
      }
    } else {
      if (door.side === 'left') {
        x = zone.x + zone.width   // push right of zone
      } else {
        x = zone.x - tw           // push left of zone
      }
    }
  }

  return { x, y }
}

/** Ray-casting point-in-polygon test. */
function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i], pj = polygon[j]
    if ((pi.y > p.y) !== (pj.y > p.y) &&
        p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y) + pi.x) {
      inside = !inside
    }
  }
  return inside
}
