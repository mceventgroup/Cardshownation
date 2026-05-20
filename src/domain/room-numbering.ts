import { computeRoomContour } from '@/domain/room-contour'
import type { CompositeRoom, Point, Rect, TableObject } from '@/domain/types'

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
  void roomId
  let max = 0
  for (const table of Object.values(tables)) {
    if (table.tableNumber > max) max = table.tableNumber
  }
  return max + 1
}

function getDistanceBetweenPoints(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
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

export function syncRoomFieldsForTables(
  tables: Record<string, TableObject>,
  room: CompositeRoom | null,
): Record<string, TableObject> {
  const next: Record<string, TableObject> = {}
  const roomZones = getRoomZones(room)
  const roomIds = roomZones.map(zone => zone.id)
  const firstRoomId = roomIds[0] ?? 'R1'

  for (const table of Object.values(tables)) {
    next[table.id] = { ...table }
  }

  if (roomZones.length === 0) {
    const ordered = sortTablesInSnakeOrder(Object.values(next))
    ordered.forEach((table, index) => {
      const roomId = table.roomId || firstRoomId
      const tableNumber = index + 1
      const displayId = formatDisplayId(getRoomLabel(room, roomId), tableNumber)
      table.roomId = roomId
      table.tableNumber = tableNumber
      table.displayId = displayId
      if (!table.labelOverridden) table.label = displayId
    })
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

  let globalTableNumber = 1

  for (const roomId of roomIds) {
    const roomTables = tablesByResolvedRoom.get(roomId) ?? []
    const zone = roomZones.find(candidate => candidate.id === roomId) ?? null

    sortTablesForRoom(roomTables, zone).forEach(table => {
      const tableNumber = globalTableNumber++
      const displayId = formatDisplayId(zone?.label ?? roomId, tableNumber)
      table.roomId = roomId
      table.tableNumber = tableNumber
      table.displayId = displayId
      if (!table.labelOverridden) table.label = displayId
    })
  }

  return next
}
