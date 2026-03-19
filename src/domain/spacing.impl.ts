// ─────────────────────────────────────────────────────────────────────────────
// SPACING MODULE IMPLEMENTATION
//
// Checks aisle widths and door clearances using geometry primitives.
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Door, Rect } from './types'
import type { SpacingModule, AisleViolation, DoorViolation } from './spacing'
import { geometry } from './geometry.impl'

/**
 * Determine which axis the "length side" (long side) of a table faces.
 * For a horizontal table (width > height), the length sides are top/bottom
 * edges → the aisle gap is measured in the Y direction.
 * For a vertical table (height > width), the length sides are left/right
 * edges → the aisle gap is measured in the X direction.
 */
function lengthSideAxis(t: TableObject): 'y' | 'x' {
  return t.width >= t.height ? 'y' : 'x'
}

function findNarrowAisles(
  tables: ReadonlyArray<TableObject>,
  minAisleWidth: number,
): AisleViolation[] {
  const violations: AisleViolation[] = []

  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = tables[i]
      const b = tables[j]

      // Quick AABB distance check — skip pairs that are far apart
      const boundsA = geometry.getBounds(a).bounds
      const boundsB = geometry.getBounds(b).bounds
      const hGap = Math.max(boundsB.x - (boundsA.x + boundsA.width), boundsA.x - (boundsB.x + boundsB.width))
      const vGap = Math.max(boundsB.y - (boundsA.y + boundsA.height), boundsA.y - (boundsB.y + boundsB.height))

      // If both gaps exceed minAisleWidth, tables are too far apart to matter
      if (hGap > minAisleWidth && vGap > minAisleWidth) continue

      // Only measure aisles between the LENGTH sides (long sides) of tables.
      // Two tables facing each other across an aisle have their length sides
      // parallel. We measure the gap perpendicular to those length sides.
      const axisA = lengthSideAxis(a)
      const axisB = lengthSideAxis(b)

      // Both tables must share the same length-side orientation to form an aisle
      if (axisA !== axisB) continue

      // Measure the gap along the length-side axis only
      const gap = axisA === 'y'
        ? Math.max(boundsB.y - (boundsA.y + boundsA.height), boundsA.y - (boundsB.y + boundsB.height))
        : Math.max(boundsB.x - (boundsA.x + boundsA.width), boundsA.x - (boundsB.x + boundsB.width))

      // Overlapping or not facing each other
      if (gap < 0) continue

      // Check that tables overlap in the perpendicular direction (actually side-by-side)
      if (axisA === 'y') {
        // Tables must overlap horizontally to be across an aisle from each other
        if (boundsA.x + boundsA.width <= boundsB.x || boundsB.x + boundsB.width <= boundsA.x) continue
      } else {
        // Tables must overlap vertically
        if (boundsA.y + boundsA.height <= boundsB.y || boundsB.y + boundsB.height <= boundsA.y) continue
      }

      if (gap < minAisleWidth) {
        violations.push({
          tableA: a,
          tableB: b,
          measuredWidth: gap,
          minimumWidth: minAisleWidth,
          severity: gap < minAisleWidth / 2 ? 'error' : 'warning',
        })
      }
    }
  }

  return violations
}

function findDoorViolations(
  tables: ReadonlyArray<TableObject>,
  doors: ReadonlyArray<Door>,
  minClearance: number,
): DoorViolation[] {
  const violations: DoorViolation[] = []

  for (const door of doors) {
    // Build the clearance zone rectangle projected inward from the door
    const zone = buildClearanceZone(door, minClearance)
    const blockingTables: TableObject[] = []
    let smallestClearance = Infinity

    for (const table of tables) {
      const tableBounds = geometry.getBounds(table).bounds
      // Check if table AABB intersects door clearance zone
      if (rectsOverlap(tableBounds, zone)) {
        blockingTables.push(table)
        const gap = measureRectGap(tableBounds, zone)
        if (gap < smallestClearance) smallestClearance = gap
      }
    }

    if (blockingTables.length > 0) {
      violations.push({
        door,
        blockingTables,
        measuredClearance: Math.max(0, smallestClearance),
        requiredClearance: minClearance,
      })
    }
  }

  return violations
}

function measureAisleBetween(a: TableObject, b: TableObject): number {
  return geometry.measureGap(a, b).minimum
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildClearanceZone(door: Door, clearance: number): Rect {
  switch (door.side) {
    case 'top':
      return { x: door.x, y: door.y, width: door.width, height: clearance }
    case 'bottom':
      return { x: door.x, y: door.y - clearance, width: door.width, height: clearance }
    case 'left':
      return { x: door.x, y: door.y, width: clearance, height: door.width }
    case 'right':
      return { x: door.x - clearance, y: door.y, width: clearance, height: door.width }
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  )
}

function measureRectGap(a: Rect, b: Rect): number {
  const hGap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width))
  const vGap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height))
  return Math.max(hGap, vGap)
}

export const spacingModule: SpacingModule = {
  findNarrowAisles,
  findDoorViolations,
  measureAisleBetween,
}
