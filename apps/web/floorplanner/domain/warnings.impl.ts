import { planPoint } from '@floorplanner/lib/plan-editing'
// ─────────────────────────────────────────────────────────────────────────────
// WARNINGS MODULE IMPLEMENTATION
//
// Computes all layout warnings from current document state.
// Pure functions — same input always produces the same output.
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, Door, CompositeRoom, LayoutSettings, VendorAssignment, BackgroundImage } from './types'
import { polygonsOverlap, structurePolygon } from '../lib/plan-structure'
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
import { isRectInRoom, isRectWithinWallSetback } from './room-contour'
import { formatDimension } from '@floorplanner/lib/units'

function computeWarnings(
  tables: ReadonlyArray<TableObject>,
  doors: ReadonlyArray<Door>,
  vendorAssignments: ReadonlyArray<VendorAssignment>,
  settings: LayoutSettings,
  checkUnassigned: boolean,
  room?: CompositeRoom | null,
  buildings: ReadonlyArray<BackgroundImage> = [],
): WarningResult {
  const warnings: LayoutWarning[] = []
  const structures = buildings.flatMap(image => (image.plan?.structures ?? []).map(item => ({ kind: item.kind, polygon: structurePolygon(image, item) })))
  for (const table of tables) {
    const corners = geometry.getBounds(table).rotatedCorners
    const hit = structures.find(item => polygonsOverlap(corners, item.polygon))
    if (hit) warnings.push({ type: 'structure-overlap', severity: 'error', tableId: table.id, message: `Table ${table.label} overlaps an imported ${hit.kind}.` })
  }

  for (const image of buildings) for (const opening of image.plan?.openings || []) {
    const a = planPoint(image, opening.start), b = planPoint(image, opening.end), length = Math.hypot(b.x - a.x, b.y - a.y)
    const depth = Math.max(settings.doorClearance, opening.kind === 'opening' ? 0 : length)
    if (!length || !depth) continue
    const nx = -(b.y - a.y) / length * depth, ny = (b.x - a.x) / length * depth
    const polygon = [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }]
    const blocking = tables.filter(t => polygonsOverlap(geometry.getBounds(t).rotatedCorners, polygon))
    if (blocking.length) warnings.push({ type: 'door-blocked', severity: 'error', doorId: opening.id, blockingTableIds: blocking.map(t => t.id), message: 'Imported ' + opening.kind + ' clearance is blocked by ' + blocking.map(t => t.label).join(', ') + '.' })
  }
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

  // 2. Narrow aisles
  const narrowAisles = spacingModule.findNarrowAisles(tables, settings.minAisleWidth)
  for (const violation of narrowAisles) {
    warnings.push({
      type: 'narrow-aisle',
      severity: violation.severity,
      tableIds: [violation.tableA.id, violation.tableB.id],
      measuredWidth: violation.measuredWidth,
      minimumWidth: violation.minimumWidth,
      message: `Aisle between ${violation.tableA.label} and ${violation.tableB.label} is ${formatDimension(violation.measuredWidth)}; minimum is ${formatDimension(violation.minimumWidth)}`,
    })
  }

  // 3. Door violations
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

  // 4. Duplicate labels
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

  // 5. Unassigned tables (only when requested)
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

  // 6. Out-of-bounds (only when a room is defined)
  if (room && (room.segments.length > 0 || (room.circles?.length ?? 0) > 0 || room.freehandVertices || (room.importedPolygons?.length ?? 0) > 0)) {
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

  // 7. Wall setback violations
  if (room && (settings.wallSetback > 0 || settings.wallThickness > 0) && (room.segments.length > 0 || (room.circles?.length ?? 0) > 0 || room.freehandVertices)) {
    const sb = settings.wallSetback + settings.wallThickness / 2
    for (const t of tables) {
      const b = geometry.getBounds(t).bounds
      if (!isRectWithinWallSetback(room, b, sb)) {
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
      case 'narrow-aisle':
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
      case 'structure-overlap':
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
      case 'narrow-aisle':
        return w.tableIds.includes(tableId)
      case 'door-blocked':
        return w.blockingTableIds.includes(tableId)
      case 'duplicate-label':
        return w.tableIds.includes(tableId)
      case 'unassigned-table':
      case 'out-of-bounds':
      case 'wall-setback':
      case 'structure-overlap':
        return w.tableId === tableId
    }
  })
}

export const warningsModule: WarningsModule = {
  computeWarnings,
  tableHasWarning,
  warningsForTable,
}
