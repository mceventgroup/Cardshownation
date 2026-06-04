import { computeRoomContour } from '@/domain/room-contour'
import type { CompositeRoom, Point, Rect, Section, TableId, TableObject } from '@/domain/types'

export type TableNumberingDirection = 'ltr' | 'rtl' | 'ttb' | 'btt' | 'cw' | 'ccw'

export interface TableRenumberChange {
  tableId: TableId
  prev: Pick<TableObject, 'label' | 'labelOverridden' | 'displayId' | 'tableNumber'>
  next: Pick<TableObject, 'label' | 'labelOverridden' | 'displayId' | 'tableNumber'>
}

export interface RoomZone {
  id: string
  label: string
  bounds: Rect
  polygon: Point[]
}

function pointOnSegment(point: Point, a: Point, b: Point, epsilon = 0.5): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y)
  if (Math.abs(cross) > epsilon) return false

  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)
  if (dot < -epsilon) return false

  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (dot - squaredLength > epsilon) return false

  return true
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegment(point, polygon[j], polygon[i])) return true
  }

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function computeBounds(points: Point[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function compareZones(a: RoomZone, b: RoomZone): number {
  if (a.bounds.y !== b.bounds.y) return a.bounds.y - b.bounds.y
  return a.bounds.x - b.bounds.x
}

export function getRoomZones(room: CompositeRoom | null): RoomZone[] {
  if (!room) return []

  return computeRoomContour(room)
    .map(polygon => {
      const bounds = computeBounds(polygon)
      return {
        id: '',
        label: '',
        bounds,
        polygon,
      }
    })
    .sort(compareZones)
    .map((zone, index) => {
      const roomId = `R${index + 1}`
      const roomLabel = room?.roomLabels?.[roomId]?.trim() || roomId
      return {
        ...zone,
        id: roomId,
        label: roomLabel,
      }
    })
}

export function getDefaultRoomId(room: CompositeRoom | null): string | null {
  return getRoomZones(room)[0]?.id ?? null
}

export function formatDisplayId(roomId: string, tableNumber: number): string {
  return `${roomId}-${tableNumber}`
}

export function getSectionPrefix(sectionName: string): string {
  const tokens = (sectionName.toUpperCase().match(/[A-Z0-9]+/g) ?? []).filter(Boolean)
  if (tokens.length === 0) return 'T'

  const meaningful = tokens.filter(token => token !== 'SECTION')
  const singleToken = meaningful.find(token => token.length === 1)
  if (singleToken) return singleToken

  if (tokens[0] === 'SECTION' && meaningful[0]) return meaningful[0][0]
  return (meaningful[0] ?? tokens[0])[0]
}

export function formatScopedDisplayId(prefix: string, tableNumber: number, padToDigits = 2): string {
  const numberText = String(tableNumber).padStart(Math.max(padToDigits, 1), '0')
  return prefix ? `${prefix}${numberText}` : numberText
}

export function getRoomLabel(room: CompositeRoom | null, roomId: string): string {
  return getRoomZones(room).find(zone => zone.id === roomId)?.label ?? roomId
}

export function getTableCenter(table: Pick<TableObject, 'x' | 'y' | 'width' | 'height'>): Point {
  return {
    x: table.x + table.width / 2,
    y: table.y + table.height / 2,
  }
}

export function getRoomIdForPoint(room: CompositeRoom | null, point: Point): string | null {
  for (const zone of getRoomZones(room)) {
    if (pointInPolygon(point, zone.polygon)) return zone.id
  }
  return null
}

export function getRoomIdForTable(table: Pick<TableObject, 'x' | 'y' | 'width' | 'height'>, room: CompositeRoom | null): string | null {
  return getRoomIdForPoint(room, getTableCenter(table))
}

export function getNextRoomTableNumber(
  tables: Record<string, TableObject>,
  roomId: string,
): number {
  let max = 0
  for (const table of Object.values(tables)) {
    if (table.roomId !== roomId) continue
    if (table.tableNumber > max) max = table.tableNumber
  }
  return max + 1
}

function getDistanceBetweenPoints(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function getTableBounds(tables: Array<Pick<TableObject, 'x' | 'y' | 'width' | 'height'>>): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const table of tables) {
    minX = Math.min(minX, table.x)
    minY = Math.min(minY, table.y)
    maxX = Math.max(maxX, table.x + table.width)
    maxY = Math.max(maxY, table.y + table.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function projectPointToSegment(point: Point, a: Point, b: Point): { distance: number; progress: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { distance: getDistanceBetweenPoints(point, a), progress: 0 }

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  const projected = { x: a.x + t * dx, y: a.y + t * dy }
  return {
    distance: getDistanceBetweenPoints(point, projected),
    progress: t,
  }
}

function compareClockwiseAroundCenter(
  a: Pick<TableObject, 'x' | 'y' | 'width' | 'height'>,
  b: Pick<TableObject, 'x' | 'y' | 'width' | 'height'>,
  center: Point,
): number {
  const angleA = Math.atan2(a.y + a.height / 2 - center.y, a.x + a.width / 2 - center.x)
  const angleB = Math.atan2(b.y + b.height / 2 - center.y, b.x + b.width / 2 - center.x)
  const normalizedA = angleA < -Math.PI / 2 ? angleA + Math.PI * 2 : angleA
  const normalizedB = angleB < -Math.PI / 2 ? angleB + Math.PI * 2 : angleB
  if (normalizedA !== normalizedB) return normalizedA - normalizedB

  const distA = Math.hypot(a.x + a.width / 2 - center.x, a.y + a.height / 2 - center.y)
  const distB = Math.hypot(b.x + b.width / 2 - center.x, b.y + b.height / 2 - center.y)
  return distA - distB
}

function getPolygonStartIndex(polygon: Point[]): number {
  let startIndex = 0
  for (let i = 1; i < polygon.length; i++) {
    if (polygon[i].y < polygon[startIndex].y) {
      startIndex = i
      continue
    }
    if (polygon[i].y === polygon[startIndex].y && polygon[i].x < polygon[startIndex].x) {
      startIndex = i
    }
  }
  return startIndex
}

function getPerimeterMetrics(
  table: Pick<TableObject, 'x' | 'y' | 'width' | 'height'>,
  polygon: Point[],
): { distance: number; perimeterOffset: number } {
  const center = getTableCenter(table)
  const startIndex = getPolygonStartIndex(polygon)
  const ordered = [...polygon.slice(startIndex), ...polygon.slice(0, startIndex), polygon[startIndex]]

  let total = 0
  let bestDistance = Infinity
  let bestOffset = 0

  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i]
    const b = ordered[i + 1]
    const segmentLength = getDistanceBetweenPoints(a, b)
    const projection = projectPointToSegment(center, a, b)
    if (projection.distance < bestDistance) {
      bestDistance = projection.distance
      bestOffset = total + projection.progress * segmentLength
    }
    total += segmentLength
  }

  return {
    distance: bestDistance,
    perimeterOffset: bestOffset,
  }
}

export function sortTablesInSnakeOrder<T extends Pick<TableObject, 'x' | 'y' | 'width' | 'height'>>(
  tables: T[],
): T[] {
  if (tables.length === 0) return []

  const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x)
  const tolerance = Math.max(24, Math.min(...sorted.map(table => table.height)) * 0.8)
  const rows: T[][] = []
  let currentRow: T[] = [sorted[0]]
  let rowY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    const table = sorted[i]
    if (Math.abs(table.y - rowY) <= tolerance) {
      currentRow.push(table)
      continue
    }
    rows.push(currentRow)
    currentRow = [table]
    rowY = table.y
  }

  rows.push(currentRow)

  return rows.flatMap((row, index) => {
    const ordered = [...row].sort((a, b) => a.x - b.x)
    return index % 2 === 0 ? ordered : ordered.reverse()
  })
}

function sortTablesHorizontally<T extends Pick<TableObject, 'x' | 'y' | 'width' | 'height'>>(
  tables: T[],
  rowDirection: 'asc' | 'desc',
): T[] {
  if (tables.length === 0) return []

  const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x)
  const tolerance = Math.max(24, Math.min(...sorted.map(table => table.height)) * 0.8)
  const rows: T[][] = []
  let currentRow: T[] = [sorted[0]]
  let rowY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    const table = sorted[i]
    if (Math.abs(table.y - rowY) <= tolerance) {
      currentRow.push(table)
      continue
    }
    rows.push(currentRow)
    currentRow = [table]
    rowY = table.y
  }
  rows.push(currentRow)

  return rows.flatMap(row => [...row].sort((a, b) => (
    rowDirection === 'asc' ? a.x - b.x || a.y - b.y : b.x - a.x || a.y - b.y
  )))
}

function sortTablesVertically<T extends Pick<TableObject, 'x' | 'y' | 'width' | 'height'>>(
  tables: T[],
  columnDirection: 'asc' | 'desc',
): T[] {
  if (tables.length === 0) return []

  const sorted = [...tables].sort((a, b) => a.x - b.x || a.y - b.y)
  const tolerance = Math.max(24, Math.min(...sorted.map(table => table.width)) * 0.8)
  const columns: T[][] = []
  let currentColumn: T[] = [sorted[0]]
  let columnX = sorted[0].x

  for (let i = 1; i < sorted.length; i++) {
    const table = sorted[i]
    if (Math.abs(table.x - columnX) <= tolerance) {
      currentColumn.push(table)
      continue
    }
    columns.push(currentColumn)
    currentColumn = [table]
    columnX = table.x
  }
  columns.push(currentColumn)

  return columns.flatMap(column => [...column].sort((a, b) => (
    columnDirection === 'asc' ? a.y - b.y || a.x - b.x : b.y - a.y || a.x - b.x
  )))
}

function normalizeAngleFromTop(angle: number): number {
  let normalized = angle + Math.PI / 2
  while (normalized < 0) normalized += Math.PI * 2
  while (normalized >= Math.PI * 2) normalized -= Math.PI * 2
  return normalized
}

export function sortTablesByDirection<T extends Pick<TableObject, 'x' | 'y' | 'width' | 'height'>>(
  tables: T[],
  direction: TableNumberingDirection,
): T[] {
  if (tables.length === 0) return []

  switch (direction) {
    case 'rtl':
      return sortTablesHorizontally(tables, 'desc')
    case 'ttb':
      return sortTablesVertically(tables, 'asc')
    case 'btt':
      return sortTablesVertically(tables, 'desc')
    case 'cw':
    case 'ccw': {
      const bounds = getTableBounds(tables)
      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      }
      return [...tables].sort((a, b) => {
        const angleA = normalizeAngleFromTop(Math.atan2(a.y + a.height / 2 - center.y, a.x + a.width / 2 - center.x))
        const angleB = normalizeAngleFromTop(Math.atan2(b.y + b.height / 2 - center.y, b.x + b.width / 2 - center.x))
        const metricA = direction === 'cw' ? angleA : (Math.PI * 2 - angleA) % (Math.PI * 2)
        const metricB = direction === 'cw' ? angleB : (Math.PI * 2 - angleB) % (Math.PI * 2)
        if (metricA !== metricB) return metricA - metricB

        const distA = Math.hypot(a.x + a.width / 2 - center.x, a.y + a.height / 2 - center.y)
        const distB = Math.hypot(b.x + b.width / 2 - center.x, b.y + b.height / 2 - center.y)
        return distA - distB
      })
    }
    case 'ltr':
    default:
      return sortTablesHorizontally(tables, 'asc')
  }
}

export function sortTablesForRoom<T extends Pick<TableObject, 'x' | 'y' | 'width' | 'height'>>(
  tables: T[],
  zone?: Pick<RoomZone, 'bounds' | 'polygon'> | null,
): T[] {
  if (tables.length === 0) return []
  if (!zone) return sortTablesInSnakeOrder(tables)

  const polygon = ('polygon' in zone && Array.isArray(zone.polygon) ? zone.polygon : null) ?? [
    { x: zone.bounds.x, y: zone.bounds.y },
    { x: zone.bounds.x + zone.bounds.width, y: zone.bounds.y },
    { x: zone.bounds.x + zone.bounds.width, y: zone.bounds.y + zone.bounds.height },
    { x: zone.bounds.x, y: zone.bounds.y + zone.bounds.height },
  ]
  const edgeThreshold = Math.max(36, Math.min(zone.bounds.width, zone.bounds.height) * 0.1)

  const perimeter: Array<{ table: T; distance: number; perimeterOffset: number }> = []
  const interior: Array<{ table: T; distance: number; perimeterOffset: number }> = []

  for (const table of tables) {
    const metrics = getPerimeterMetrics(table, polygon)
    if (metrics.distance <= edgeThreshold) {
      perimeter.push({ table, ...metrics })
    } else {
      interior.push({ table, ...metrics })
    }
  }

  const clockwisePerimeter = [...perimeter]
    .sort((a, b) => a.perimeterOffset - b.perimeterOffset || a.distance - b.distance)
    .map(entry => entry.table)

  const center = {
    x: zone.bounds.x + zone.bounds.width / 2,
    y: zone.bounds.y + zone.bounds.height / 2,
  }
  const clockwiseInterior = [...interior]
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance
      return compareClockwiseAroundCenter(a.table, b.table, center)
    })
    .map(entry => entry.table)

  return [...clockwisePerimeter, ...clockwiseInterior]
}

function createRenumberChange(
  table: TableObject,
  nextDisplayId: string,
  nextTableNumber: number,
  preserveLabelOverride: boolean,
): TableRenumberChange {
  return {
    tableId: table.id as TableId,
    prev: {
      label: table.label,
      labelOverridden: table.labelOverridden,
      displayId: table.displayId,
      tableNumber: table.tableNumber,
    },
    next: {
      label: preserveLabelOverride && table.labelOverridden ? table.label : nextDisplayId,
      labelOverridden: preserveLabelOverride ? table.labelOverridden : false,
      displayId: nextDisplayId,
      tableNumber: nextTableNumber,
    },
  }
}

function getRoomBuckets(
  tables: TableObject[],
  room: CompositeRoom | null,
): Array<{ id: string; prefix: string; tables: TableObject[] }> {
  const roomZones = getRoomZones(room)
  const roomIds = roomZones.map(zone => zone.id)
  const firstRoomId = roomIds[0] ?? 'R1'
  const grouped = new Map<string, TableObject[]>()

  for (const roomId of roomIds) grouped.set(roomId, [])
  if (grouped.size === 0) grouped.set(firstRoomId, [])

  for (const table of tables) {
    const resolvedRoomId =
      (table.roomId && grouped.has(table.roomId) ? table.roomId : null) ??
      getRoomIdForTable(table, room) ??
      firstRoomId
    const bucket = grouped.get(resolvedRoomId) ?? []
    bucket.push(table)
    grouped.set(resolvedRoomId, bucket)
  }

  return Array.from(grouped.entries()).map(([id, roomTables]) => ({
    id,
    prefix: getRoomLabel(room, id),
    tables: roomTables,
  }))
}

export function buildSectionRenumberChanges(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  sectionId: string,
  direction: TableNumberingDirection,
): TableRenumberChange[] {
  const section = sections[sectionId]
  if (!section) return []

  const sectionTables = Object.values(tables).filter(table => table.sectionId === sectionId)
  const ordered = sortTablesByDirection(sectionTables, direction)
  const prefix = getSectionPrefix(section.name)

  return ordered.map((table, index) =>
    createRenumberChange(table, formatScopedDisplayId(prefix, index + 1), index + 1, false),
  )
}

export function buildAllSectionRenumberChanges(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  room: CompositeRoom | null,
  direction: TableNumberingDirection,
  preserveLabelOverride = false,
): TableRenumberChange[] {
  const changes: TableRenumberChange[] = []
  const allTables = Object.values(tables)
  const sectionList = Object.values(sections).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const sectionIds = new Set(sectionList.map(section => section.id))

  for (const section of sectionList) {
    const sectionTables = allTables.filter(table => table.sectionId === section.id)
    const ordered = sortTablesByDirection(sectionTables, direction)
    const prefix = getSectionPrefix(section.name)
    ordered.forEach((table, index) => {
      changes.push(createRenumberChange(table, formatScopedDisplayId(prefix, index + 1), index + 1, preserveLabelOverride))
    })
  }

  const unsectioned = allTables.filter(table => !table.sectionId || !sectionIds.has(table.sectionId))
  for (const bucket of getRoomBuckets(unsectioned, room)) {
    const ordered = sortTablesByDirection(bucket.tables, direction)
    ordered.forEach((table, index) => {
      changes.push(createRenumberChange(table, formatScopedDisplayId(bucket.prefix, index + 1), index + 1, preserveLabelOverride))
    })
  }

  return changes
}

export function syncRoomFieldsForTables(
  tables: Record<string, TableObject>,
  room: CompositeRoom | null,
  sections: Record<string, Section> = {},
): Record<string, TableObject> {
  const next: Record<string, TableObject> = {}
  const roomZones = getRoomZones(room)
  const roomIds = roomZones.map(zone => zone.id)
  const firstRoomId = roomIds[0] ?? 'R1'

  for (const table of Object.values(tables)) {
    next[table.id] = { ...table }
  }

  if (roomZones.length === 0) {
    const changes = buildAllSectionRenumberChanges(next, sections, room, 'cw', true)
    for (const change of changes) {
      const table = next[change.tableId]
      if (!table) continue
      table.tableNumber = change.next.tableNumber
      table.displayId = change.next.displayId
      if (!table.labelOverridden) table.label = change.next.displayId
    }
    return next
  }

  const tablesByResolvedRoom = new Map<string, TableObject[]>()
  for (const roomId of roomIds) {
    tablesByResolvedRoom.set(roomId, [])
  }

  for (const table of Object.values(next)) {
    const existingRoomId = table.roomId
    const detectedRoomId = getRoomIdForTable(table, room)
    const resolvedRoomId =
      (existingRoomId && roomIds.includes(existingRoomId) ? existingRoomId : null) ??
      detectedRoomId ??
      firstRoomId

    tablesByResolvedRoom.get(resolvedRoomId)?.push(table)
  }

  const changes = buildAllSectionRenumberChanges(next, sections, room, 'cw', true)
  for (const change of changes) {
    const table = next[change.tableId]
    if (!table) continue
    table.tableNumber = change.next.tableNumber
    table.displayId = change.next.displayId
    if (!table.labelOverridden) table.label = change.next.displayId
  }

  return next
}
