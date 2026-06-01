// ─────────────────────────────────────────────────────────────────────────────
// ROW-BUILDING MODULE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

import type { Rect, TableObject, Row, RowId } from './types'
import type { RowModule, RowConfig, BuiltRow, RepositionedTable } from './rows'
import { numberingModule } from './numbering.impl'
import { formatDisplayId } from '@/domain/room-numbering'
import { createTableId } from '@/lib/id'

function buildRow(config: RowConfig, rowId: RowId): BuiltRow {
  if (config.orientation === 'curved') {
    return buildCurvedRow(config, rowId)
  }

  const tables: TableObject[] = []

  // Vertical rows: swap width/height so narrow ends stack top-to-bottom.
  // This avoids Konva rotation offset issues — the table is simply taller
  // than it is wide, and stacking math uses the visual dimensions directly.
  const isVertical = config.orientation === 'vertical'
  const vizWidth  = isVertical ? config.tableHeight : config.tableWidth
  const vizHeight = isVertical ? config.tableWidth  : config.tableHeight

  for (let i = 0; i < config.tableCount; i++) {
    const x = isVertical
      ? config.origin.x
      : config.origin.x + i * (vizWidth + config.spacing)
    const y = isVertical
      ? config.origin.y + i * (vizHeight + config.spacing)
      : config.origin.y

    const label = numberingModule.generateLabel(config.numberingScheme, i)
    const tableNumber = config.numberingScheme.startNumber + i
    const displayId = formatDisplayId(config.roomId, tableNumber)

    tables.push({
      id: createTableId(),
      roomId: config.roomId,
      tableNumber,
      displayId,
      x,
      y,
      width: vizWidth,
      height: vizHeight,
      rotation: 0,
      shape: 'rectangle',
      label: label === String(tableNumber) ? displayId : label,
      labelOverridden: false,
      rowId,
      sectionId: config.sectionId,
      order: i,
      premium: false,
    })
  }

  const row: Row = {
    id: rowId,
    sectionId: config.sectionId,
    orientation: config.orientation,
    tableCount: config.tableCount,
    tableWidth: config.tableWidth,
    tableHeight: config.tableHeight,
    spacing: config.spacing,
    createdAt: new Date().toISOString(),
  }

  return { row, tables }
}

function buildCurvedRow(config: RowConfig, rowId: RowId): BuiltRow {
  const tables: TableObject[] = []
  const radius = Math.max(24, config.curveRadius ?? 120)
  const curveCenter = config.curveCenter ?? { x: config.origin.x, y: config.origin.y + radius }
  const midAngle = config.curveMidAngle ?? Math.atan2(config.origin.y - curveCenter.y, config.origin.x - curveCenter.x)
  const curveDirection = config.curveDirection ?? 'counterclockwise'
  const directionSign = curveDirection === 'clockwise' ? -1 : 1
  const angularStep = (config.tableWidth + config.spacing) / radius

  for (let i = 0; i < config.tableCount; i++) {
    const centeredIndex = i - (config.tableCount - 1) / 2
    const angle = midAngle + centeredIndex * angularStep * directionSign
    const centerX = curveCenter.x + Math.cos(angle) * radius
    const centerY = curveCenter.y + Math.sin(angle) * radius
    const rotation = Math.round((((angle * 180) / Math.PI + 90) % 360 + 360) % 360 * 10) / 10
    const topLeft = getRotatedTopLeft(centerX, centerY, config.tableWidth, config.tableHeight, rotation)

    const label = numberingModule.generateLabel(config.numberingScheme, i)
    const tableNumber = config.numberingScheme.startNumber + i
    const displayId = formatDisplayId(config.roomId, tableNumber)

    tables.push({
      id: createTableId(),
      roomId: config.roomId,
      tableNumber,
      displayId,
      x: topLeft.x,
      y: topLeft.y,
      width: config.tableWidth,
      height: config.tableHeight,
      rotation,
      shape: 'rectangle',
      label: label === String(tableNumber) ? displayId : label,
      labelOverridden: false,
      rowId,
      sectionId: config.sectionId,
      order: i,
      premium: false,
    })
  }

  const row: Row = {
    id: rowId,
    sectionId: config.sectionId,
    orientation: 'curved',
    tableCount: config.tableCount,
    tableWidth: config.tableWidth,
    tableHeight: config.tableHeight,
    spacing: config.spacing,
    curveRadius: radius,
    curveCenterX: curveCenter.x,
    curveCenterY: curveCenter.y,
    curveMidAngle: midAngle,
    curveDirection,
    createdAt: new Date().toISOString(),
  }

  return { row, tables }
}

function distributeEvenly(
  tables: ReadonlyArray<TableObject>,
  spacing: number,
): RepositionedTable[] {
  if (tables.length === 0) return []

  const sorted = [...tables].sort((a, b) => a.order - b.order)
  const anchor = sorted[0]

  // Detect orientation from existing layout
  const isHorizontal =
    tables.length < 2 ||
    Math.abs(sorted[1].x - sorted[0].x) >= Math.abs(sorted[1].y - sorted[0].y)

  return sorted.map((t, i) => ({
    id: t.id,
    x: isHorizontal ? anchor.x + i * (t.width + spacing) : anchor.x,
    y: isHorizontal ? anchor.y : anchor.y + i * (t.height + spacing),
  }))
}

function alignToAxis(
  tables: ReadonlyArray<TableObject>,
  axis: 'x' | 'y',
): RepositionedTable[] {
  if (tables.length === 0) return []

  const sorted = [...tables].sort((a, b) => a.order - b.order)
  const target = sorted[0][axis]

  return sorted.map(t => ({
    id: t.id,
    x: axis === 'x' ? target : t.x,
    y: axis === 'y' ? target : t.y,
  }))
}

function getRowBounds(tables: ReadonlyArray<TableObject>): Rect {
  if (tables.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const t of tables) {
    minX = Math.min(minX, t.x)
    minY = Math.min(minY, t.y)
    maxX = Math.max(maxX, t.x + t.width)
    maxY = Math.max(maxY, t.y + t.height)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function recalculateRowPositions(
  row: Row,
  tables: ReadonlyArray<TableObject>,
  updates: Partial<Pick<RowConfig, 'tableWidth' | 'tableHeight' | 'spacing' | 'curveRadius'>>,
): RepositionedTable[] {
  if (tables.length === 0) return []

  const sorted = [...tables].sort((a, b) => a.order - b.order)
  if (row.orientation === 'curved') {
    const radius = Math.max(24, updates.curveRadius ?? row.curveRadius ?? 120)
    const curveCenter = { x: row.curveCenterX ?? sorted[0].x, y: row.curveCenterY ?? sorted[0].y + radius }
    const midAngle = row.curveMidAngle ?? 0
    const directionSign = row.curveDirection === 'clockwise' ? -1 : 1
    const width = updates.tableWidth ?? row.tableWidth
    const height = updates.tableHeight ?? row.tableHeight
    const spacing = updates.spacing ?? row.spacing
    const angularStep = (width + spacing) / radius

    return sorted.map((table, index) => {
      const centeredIndex = index - (sorted.length - 1) / 2
      const angle = midAngle + centeredIndex * angularStep * directionSign
      const centerX = curveCenter.x + Math.cos(angle) * radius
      const centerY = curveCenter.y + Math.sin(angle) * radius
      const rotation = Math.round((((angle * 180) / Math.PI + 90) % 360 + 360) % 360 * 10) / 10
      const topLeft = getRotatedTopLeft(
        centerX,
        centerY,
        updates.tableWidth ?? table.width,
        updates.tableHeight ?? table.height,
        rotation,
      )
      return {
        id: table.id,
        x: topLeft.x,
        y: topLeft.y,
        rotation,
      }
    })
  }

  const anchor = sorted[0]
  const s = updates.spacing ?? row.spacing

  // Use actual table dimensions (already swapped for vertical rows at build time)
  const stepW = updates.tableWidth ?? anchor.width
  const stepH = updates.tableHeight ?? anchor.height

  return sorted.map((t, i) => ({
    id: t.id,
    x: row.orientation === 'horizontal' ? anchor.x + i * (stepW + s) : anchor.x,
    y: row.orientation === 'vertical' ? anchor.y + i * (stepH + s) : anchor.y,
  }))
}

function getRotatedTopLeft(centerX: number, centerY: number, width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180
  const offsetX = width / 2
  const offsetY = height / 2
  return {
    x: centerX - (offsetX * Math.cos(radians) - offsetY * Math.sin(radians)),
    y: centerY - (offsetX * Math.sin(radians) + offsetY * Math.cos(radians)),
  }
}

export const rowModule: RowModule = {
  buildRow,
  distributeEvenly,
  alignToAxis,
  getRowBounds,
  recalculateRowPositions,
}
