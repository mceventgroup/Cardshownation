// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ASSIGN
//
// Assigns vendors to unassigned tables, ensuring no vendor gets a mix of
// horizontal and vertical tables. All tables assigned to a single vendor
// share the same orientation.
//
// Algorithm:
//   1. Sort unassigned tables spatially (top-to-bottom, left-to-right)
//   2. Group into runs of consecutive same-orientation tables
//   3. Sort vendors by tablesNeeded descending (fill big vendors first)
//   4. For each vendor, find the first run that can satisfy their need
//      (or combine adjacent same-orientation runs if needed)
//   5. Assign tables from that run to the vendor
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TableObject,
  TableId,
  Vendor,
  VendorAssignment,
  VendorId,
} from './types'

export type TableOrientation = 'horizontal' | 'vertical' | 'square'

/**
 * Determine the effective orientation of a table.
 * Takes rotation into account: 90° or 270° rotation flips width/height.
 */
export function getTableOrientation(table: TableObject): TableOrientation {
  const rot = ((table.rotation % 360) + 360) % 360
  const isRotated = (rot >= 45 && rot < 135) || (rot >= 225 && rot < 315)
  const effectiveW = isRotated ? table.height : table.width
  const effectiveH = isRotated ? table.width : table.height
  if (effectiveW > effectiveH) return 'horizontal'
  if (effectiveH > effectiveW) return 'vertical'
  return 'square' // square tables can go with either
}

export interface AutoAssignResult {
  assignments: {
    vendorId: VendorId
    vendorName: string
    vendorCategory: string | null
    paymentStatus: Vendor['paymentStatus']
    tableId: TableId
  }[]
  unassignedVendors: Vendor[]  // vendors that couldn't be fully assigned
  unassignedTables: TableId[]   // tables that remain unassigned
}

/**
 * Auto-assign vendors to unassigned tables.
 *
 * @param tables       All tables in the layout
 * @param vendors      All vendors in the roster
 * @param existingAssignments  Current assignments (these tables are skipped)
 * @param layoutId     The layout ID for new assignments
 */
export function autoAssignVendors(
  tables: Record<string, TableObject>,
  vendors: Record<string, Vendor>,
  existingAssignments: Record<string, VendorAssignment>,
): AutoAssignResult {
  // Find already-assigned table IDs and vendor assignment counts
  const assignedTableIds = new Set<string>()
  const vendorAssignedCount = new Map<string, number>()
  for (const a of Object.values(existingAssignments)) {
    assignedTableIds.add(a.tableId)
    vendorAssignedCount.set(a.vendorId, (vendorAssignedCount.get(a.vendorId) ?? 0) + 1)
  }

  // Get unassigned tables, sorted spatially
  const unassignedTables = Object.values(tables)
    .filter(t => !assignedTableIds.has(t.id))
    .sort((a, b) => {
      // Group by y-band (tolerance = half a table height), then left-to-right
      const tolerance = Math.min(a.height, b.height) * 0.5
      if (Math.abs(a.y - b.y) > tolerance) return a.y - b.y
      return a.x - b.x
    })

  if (unassignedTables.length === 0) {
    return { assignments: [], unassignedVendors: [], unassignedTables: [] }
  }

  // Tag each table with orientation
  const tableOrientations = new Map<string, TableOrientation>()
  for (const t of unassignedTables) {
    tableOrientations.set(t.id, getTableOrientation(t))
  }

  // Get vendors still needing tables, sorted by largest remaining need first.
  // This keeps the biggest placement problems at the top of the queue.
  const vendorsNeedingTables = Object.values(vendors)
    .map(v => ({
      ...v,
      remaining: v.tablesNeeded - (vendorAssignedCount.get(v.id) ?? 0),
    }))
    .filter(v => v.remaining > 0)
    .sort((a, b) => {
      return b.remaining - a.remaining
    })

  // Track which unassigned tables are still available
  const availableSet = new Set(unassignedTables.map(t => t.id))
  const availableList = [...unassignedTables] // ordered copy

  // Premium tables form a reserved pool — premium vendors draw from it first
  const premiumTableIds = new Set(unassignedTables.filter(t => t.premium).map(t => t.id))

  const result: AutoAssignResult = {
    assignments: [],
    unassignedVendors: [],
    unassignedTables: [],
  }

  for (const vendor of vendorsNeedingTables) {
    const needed = vendor.remaining

    let candidateList = availableList.filter(t => availableSet.has(t.id))
    if (premiumTableIds.size > 0) {
      const premiumAvailable = candidateList.filter(t => premiumTableIds.has(t.id))
      const standardAvailable = candidateList.filter(t => !premiumTableIds.has(t.id))
      candidateList = [...premiumAvailable, ...standardAvailable]
    }

    const candidateSet = new Set(candidateList.map(t => t.id))
    const assigned = findConsecutiveSameOrientation(
      candidateList, candidateSet, tableOrientations, needed,
    )

    if (assigned.length > 0) {
      for (const tableId of assigned) {
        result.assignments.push({
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorCategory: vendor.category,
          paymentStatus: vendor.paymentStatus,
          tableId: tableId as TableId,
        })
        availableSet.delete(tableId as TableId)
        premiumTableIds.delete(tableId as TableId)
      }
    } else {
      result.unassignedVendors.push(vendor)
    }
  }

  result.unassignedTables = [...availableSet].map(id => id as TableId)
  return result
}

/**
 * Find `count` consecutive tables in the available list that all share
 * the same orientation. "Square" tables are compatible with either.
 * Returns the table IDs to assign, or empty array if not possible.
 */
function findConsecutiveSameOrientation(
  orderedTables: TableObject[],
  availableSet: Set<string>,
  orientations: Map<string, TableOrientation>,
  count: number,
): string[] {
  if (count <= 0) return []

  // Build list of available tables in order
  const available = orderedTables.filter(t => availableSet.has(t.id))
  if (available.length < count) return []

  // Single table — just take the first available
  if (count === 1) {
    return [available[0].id]
  }

  // Sliding window: find a window of `count` tables that are all compatible
  for (let start = 0; start <= available.length - count; start++) {
    const window = available.slice(start, start + count)
    const windowOrientations = window.map(t => orientations.get(t.id)!)

    // Determine the dominant non-square orientation in the window
    const nonSquare = windowOrientations.filter(o => o !== 'square')
    if (nonSquare.length === 0) {
      // All square — compatible
      return window.map(t => t.id)
    }

    const dominant = nonSquare[0]
    const allCompatible = windowOrientations.every(
      o => o === dominant || o === 'square',
    )

    if (allCompatible) {
      return window.map(t => t.id)
    }
  }

  // Fallback: couldn't find a consecutive same-orientation run.
  // Try non-consecutive same-orientation tables.
  for (const targetOrientation of ['horizontal', 'vertical'] as const) {
    const compatible = available.filter(t => {
      const o = orientations.get(t.id)!
      return o === targetOrientation || o === 'square'
    })
    if (compatible.length >= count) {
      return compatible.slice(0, count).map(t => t.id)
    }
  }

  return []
}
