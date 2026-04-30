// ─────────────────────────────────────────────────────────────────────────────
// WARNINGS MODULE IMPLEMENTATION
//
// Computes all layout warnings from current document state.
// Pure functions — same input always produces the same output.
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Door, CompositeRoom, LayoutSettings, VendorAssignment } from './types'
import type {
  WarningsModule,
  WarningResult,
  LayoutWarning,
  OverlapWarning,
  DoorBlockedWarning,
  DuplicateLabelWarning,
  UnassignedTableWarning,
  OutOfBoundsWarning,
  WallSetbackWarning,
} from './warnings'
import { geometry } from './geometry.impl'
import { spacingModule } from './spacing.impl'
import { isRectInRoom, computeRoomBounds } from './room-contour'
import { formatDimension } from '@/lib/units'

function computeWarnings(
  tables: ReadonlyArray<TableObject>,
  doors: ReadonlyArray<Door>,
  vendorAssignments: ReadonlyArray<VendorAssignment>,
  settings: LayoutSettings,
  checkUnassigned: boolean,
  room?: CompositeRoom | null,
): WarningResult {
  const warnings: LayoutWarning[] = []

  // 1. Overlaps
  const overlaps = geometry.findAllOverlaps([...tables])
  for (const [a, b] of overlaps) {
    warnings.push({
      type: 'overlap',
      severity: 'error',
      tableIds: [a.id, b.id],
      message: `Tables ${a.label} and ${b.label} overlap`,
    } satisfies OverlapWarning)
  }

  // 2. Door violations
  const doorViolations = spacingModule.findDoorViolations(tables, doors, settings.doorClearance)
  for (const v of doorViolations) {
    warnings.push({
      type: 'door-blocked',
      severity: 'error',
      doorId: v.door.id,
      blockingTableIds: v.blockingTables.map(t => t.id),
      message: `${v.door.label} clearance blocked by ${v.blockingTables.map(t => t.label).join(', ')}`,
    } satisfies DoorBlockedWarning)
  }

  // 3. Duplicate labels
  const labelMap = new Map<string, TableObject[]>()
  for (const t of tables) {
    const existing = labelMap.get(t.label)
    if (existing) existing.push(t)
    else labelMap.set(t.label, [t])
  }
  for (const [label, group] of labelMap) {
    if (group.length >= 2) {
      warnings.push({
        type: 'duplicate-label',
        severity: 'error',
        label,
        tableIds: group.map(t => t.id),
        message: `${group.length} tables share label "${label}"`,
      } satisfies DuplicateLabelWarning)
    }
  }

  // 4. Unassigned tables (only when requested)
  if (checkUnassigned) {
    const assignedTableIds = new Set(vendorAssignments.map(a => a.tableId))
    for (const t of tables) {
      if (!assignedTableIds.has(t.id)) {
        warnings.push({
          type: 'unassigned-table',
          severity: 'info',
          tableId: t.id,
          tableLabel: t.label,
          message: `Table ${t.label} has no vendor assigned`,
        } satisfies UnassignedTableWarning)
      }
    }
  }

  // 5. Out-of-bounds (only when a room is defined)
  if (room && (room.segments.length > 0 || room.freehandVertices)) {
    for (const t of tables) {
      const b = geometry.getBounds(t).bounds
      if (!isRectInRoom(room, b)) {
        warnings.push({
          type: 'out-of-bounds',
          severity: 'warning',
          tableId: t.id,
          tableLabel: t.label,
          message: `Table ${t.label} is outside the room boundary`,
        } satisfies OutOfBoundsWarning)
      }
    }
  }

  // 6. Wall setback violations
  if (room && settings.wallSetback > 0 && (room.segments.length > 0 || room.freehandVertices)) {
    const roomBounds = computeRoomBounds(room)
    if (roomBounds) {
      const sb = settings.wallSetback
      for (const t of tables) {
        const b = geometry.getBounds(t).bounds
        const tooClose =
          b.x < roomBounds.x + sb ||
          b.y < roomBounds.y + sb ||
          b.x + b.width > roomBounds.x + roomBounds.width - sb ||
          b.y + b.height > roomBounds.y + roomBounds.height - sb
        if (tooClose) {
          warnings.push({
            type: 'wall-setback',
            severity: 'warning',
            tableId: t.id,
            tableLabel: t.label,
            message: `Table ${t.label} is within the ${formatDimension(sb)} wall setback zone`,
          } satisfies WallSetbackWarning)
        }
      }
    }
  }

  // Build result
  const affectedTableIds = new Set<string>()
  let errorCount = 0
  let warningCount = 0
  let infoCount = 0

  for (const w of warnings) {
    switch (w.severity) {
      case 'error':   errorCount++;   break
      case 'warning': warningCount++; break
      case 'info':    infoCount++;    break
    }

    // Collect affected table IDs
    switch (w.type) {
      case 'overlap':
        for (const id of w.tableIds) affectedTableIds.add(id)
        break
      case 'door-blocked':
        for (const id of w.blockingTableIds) affectedTableIds.add(id)
        break
      case 'duplicate-label':
        for (const id of w.tableIds) affectedTableIds.add(id)
        break
      case 'unassigned-table':
      case 'out-of-bounds':
      case 'wall-setback':
        affectedTableIds.add(w.tableId)
        break
    }
  }

  return { warnings, errorCount, warningCount, infoCount, affectedTableIds }
}

function tableHasWarning(result: WarningResult, tableId: string): boolean {
  return result.affectedTableIds.has(tableId)
}

function warningsForTable(result: WarningResult, tableId: string): LayoutWarning[] {
  return result.warnings.filter(w => {
    switch (w.type) {
      case 'overlap':
        return w.tableIds.includes(tableId)
      case 'door-blocked':
        return w.blockingTableIds.includes(tableId)
      case 'duplicate-label':
        return w.tableIds.includes(tableId)
      case 'unassigned-table':
      case 'out-of-bounds':
      case 'wall-setback':
        return w.tableId === tableId
    }
  })
}

export const warningsModule: WarningsModule = {
  computeWarnings,
  tableHasWarning,
  warningsForTable,
}
