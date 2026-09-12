import { computeRoomContour } from '@floorplanner/domain/room-contour'
import type { CompositeRoom, Point, Rect, Section, TableId, TableObject, TableNumberingDirection } from '@floorplanner/domain/types'

export type { TableNumberingDirection } from '@floorplanner/domain/types'
type TableGeometry = Pick<TableObject, 'x' | 'y' | 'width' | 'height'> & Partial<Pick<TableObject, 'rotation'>>

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
  if (a.x === b.x && a.y === b.y) return Math.hypot(point.x - a.x, point.y - a.y) <= epsilon
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

  const native = computeRoomContour({ ...room, importedPolygons: [] })
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
  return [...native, ...(room.importedPolygons || []).map(p => ({ id: p.id, label: room.roomLabels?.[p.id] || p.label, polygon: p.vertices, bounds: computeBounds(p.vertices) }))]
}

export function getDefaultRoomId(room: CompositeRoom | null): string | null {
  return getRoomZones(room)[0]?.id ?? null
}

export function formatDisplayId(roomId: string, tableNumber: number): string {
  return String(tableNumber)
}

export function getSectionPrefix(sectionName: string): string {
  const tokens = (sectionName.toUpperCase().match(/[A-Z0-9]+/g) ?? []).filter(Boolean)
  if (tokens.length === 0) return 'T'

  const meaningful = tokens.filter(token => token !== 'SECTION')
  const singleToken = meaningful.find(token => token.length === 1)
  if (singleToken) return singleToken

  if (tokens[0] === 'SECTION' && meaningful[0]) return meaningful[0]
  return (meaningful[0] ?? tokens[0])[0]
}

export function formatScopedDisplayId(prefix: string, tableNumber: number, padToDigits = 2): string {
  const numberText = String(tableNumber).padStart(Math.max(padToDigits, 1), '0')
  return prefix ? `${prefix}${numberText}` : numberText
}

export function getNextSectionName(sections: Record<string, Section>): string {
  const used = new Set(Object.values(sections).map(section => getSectionPrefix(section.name)))
  for (let index = 0; ; index++) {
    let number = index + 1
    let suffix = ''
    while (number > 0) {
      number--
      suffix = String.fromCharCode(65 + number % 26) + suffix
      number = Math.floor(number / 26)
    }
    if (!used.has(suffix)) return `Section ${suffix}`
  }
}

/** Reserve natural prefixes before resolving collisions, keeping IDs distinct. */
export function getSectionPrefixes(sections: Record<string, Section>): Map<string, string> {
  const ordered = Object.values(sections).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const basePrefix = (section: Section) => {
    const prefix = getSectionPrefix(section.name)
    return /\d$/.test(prefix) ? `${prefix}-` : prefix
  }
  const reserved = new Set(ordered.map(basePrefix))
  const used = new Set<string>()
  return new Map(ordered.map(section => {
    const base = basePrefix(section)
    let prefix = base
    if (used.has(prefix)) {
      let suffix = 2
      do { prefix = `${base}${suffix++}-` } while (used.has(prefix) || reserved.has(prefix))
    }
    used.add(prefix)
    return [section.id, prefix]
  }))
}

export function getRoomLabel(room: CompositeRoom | null, roomId: string): string {
  return getRoomZones(room).find(zone => zone.id === roomId)?.label ?? roomId
}

export function getTableCenter(table: TableGeometry): Point {
  const angle = (table.rotation ?? 0) * Math.PI / 180
  return {
    x: table.x + table.width / 2 * Math.cos(angle) - table.height / 2 * Math.sin(angle),
    y: table.y + table.width / 2 * Math.sin(angle) + table.height / 2 * Math.cos(angle),
  }
}

export function getRoomIdForPoint(room: CompositeRoom | null, point: Point): string | null {
  for (const zone of getRoomZones(room)) {
    if (pointInPolygon(point, zone.polygon)) return zone.id
  }
  return null
}

export function getRoomIdForTable(table: TableGeometry, room: CompositeRoom | null): string | null {
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

function getTableBounds(tables: TableGeometry[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const table of tables) {
    const center = getTableCenter(table)
    const angle = (table.rotation ?? 0) * Math.PI / 180
    const halfWidth = (Math.abs(table.width * Math.cos(angle)) + Math.abs(table.height * Math.sin(angle))) / 2
    const halfHeight = (Math.abs(table.width * Math.sin(angle)) + Math.abs(table.height * Math.cos(angle))) / 2
    minX = Math.min(minX, center.x - halfWidth)
    minY = Math.min(minY, center.y - halfHeight)
    maxX = Math.max(maxX, center.x + halfWidth)
    maxY = Math.max(maxY, center.y + halfHeight)
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
  table: TableGeometry,
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
    if (projection.distance < bestDistance - 1e-7) {
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

export function sortTablesInSnakeOrder<T extends TableGeometry>(
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

function sortTablesHorizontally<T extends TableGeometry>(
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

function sortTablesVertically<T extends TableGeometry>(
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

export function sortTablesByDirection<T extends TableGeometry>(
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
    case 'ccw':
      return sortTablesForRoom(tables, null, direction)
    case 'ltr':
    default:
      return sortTablesHorizontally(tables, 'asc')
  }
}

function simplifyNumberingOutline(polygon: Point[]): Point[] {
  const distinct = polygon.filter((point, index, points) => {
    const previous = points[(index + points.length - 1) % points.length]
    return point.x !== previous.x || point.y !== previous.y
  })
  // A vertex on a straight wall does not change the room's geometry. Remove
  // only points between their neighbors, preserving corners and indentations.
  return distinct.filter((point, index, points) => {
    const previous = points[(index + points.length - 1) % points.length]
    const next = points[(index + 1) % points.length]
    return projectPointToSegment(point, previous, next).distance > 1e-7
  })
}

/** Clockwise convex boundary of the occupied table centers. */
function getTableCenterHull(tables: TableGeometry[]): Point[] {
  const sorted = tables.map(getTableCenter).sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((point, index, points) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y)
  if (sorted.length <= 2) return sorted
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const halfHull = (points: Point[]) => {
    const half: Point[] = []
    for (const point of points) {
      while (half.length >= 2 && cross(half[half.length - 2], half[half.length - 1], point) <= 0) half.pop()
      half.push(point)
    }
    return half.slice(0, -1)
  }
  return [...halfHull(sorted), ...halfHull([...sorted].reverse())]
}

/** Finish each outer ring before moving inward, retaining concave room contours. */
export function sortTablesForRoom<T extends TableGeometry>(
  tables: T[],
  zone?: Pick<RoomZone, 'bounds' | 'polygon'> | null,
  direction: 'cw' | 'ccw' = 'cw',
  startTable: T | null = null,
  outerRingOnly = false,
): T[] {
  if (tables.length === 0) return []
  const resolvedZone = zone ?? buildRectZoneFromTables(tables)!
  const polygon = simplifyNumberingOutline(resolvedZone.polygon)
  // Freehand and imported outlines can have either winding. Positive signed
  // area means clockwise in canvas coordinates.
  const signedArea = polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return area + point.x * next.y - next.x * point.y
  }, 0)
  if (signedArea < 0) polygon.reverse()

  const tolerance = Math.max(1, Math.min(...tables.map(table => Math.min(table.width, table.height))) * 0.75)
  const walkRing = (ring: T[], firstRing: boolean) => {
    const ordered = direction === 'ccw' ? [ring[0], ...ring.slice(1).reverse()] : ring
    const start = firstRing && startTable ? ordered.indexOf(startTable) : -1
    return start > 0 ? [...ordered.slice(start), ...ordered.slice(0, start)] : ordered
  }
  const isRectangle = polygon.length === 4 && polygon.every((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return point.x === next.x || point.y === next.y
  })
  if (isRectangle) {
    // Follow the occupied boundary, which can be rectangular, circular or a
    // mixture of straight and curved rows, independently of the room's walls.
    let remaining = [...tables]
    const ordered: T[] = []
    while (remaining.length) {
      const ringPolygon = getTableCenterHull(remaining)
      if (ringPolygon.length <= 2) {
        const line = remaining.sort((a, b) => getTableCenter(a).y - getTableCenter(b).y || getTableCenter(a).x - getTableCenter(b).x)
        // A straight row can start at either endpoint without jumping mid-row.
        if (ordered.length === 0 && startTable === line[line.length - 1]) line.reverse()
        ordered.push(...line)
        break
      }
      const ring: T[] = []
      const interior: T[] = []
      const offsets = new Map<T, number>()
      for (const table of remaining) {
        const metrics = getPerimeterMetrics(table, ringPolygon)
        if (metrics.distance <= tolerance) {
          ring.push(table)
          offsets.set(table, metrics.perimeterOffset)
        } else {
          interior.push(table)
        }
      }
      ring.sort((a, b) => offsets.get(a)! - offsets.get(b)! ||
        getTableCenter(a).y - getTableCenter(b).y || getTableCenter(a).x - getTableCenter(b).x)
      ordered.push(...walkRing(ring, ordered.length === 0))
      if (outerRingOnly) return ordered
      remaining = interior
    }
    return ordered
  }

  const entries = tables.map(table => ({ table, ...getPerimeterMetrics(table, polygon) }))
    .sort((a, b) => a.distance - b.distance)
  // Anchor each band at its shallowest table so small differences cannot chain
  // together and accidentally pull an inner row into the outer ring.
  const ordered: T[] = []
  for (let start = 0; start < entries.length;) {
    let end = start + 1
    while (end < entries.length && entries[end].distance - entries[start].distance <= tolerance) end++
    const ring = entries.slice(start, end).sort((a, b) => (
      a.perimeterOffset - b.perimeterOffset || a.distance - b.distance ||
      getTableCenter(a.table).y - getTableCenter(b.table).y ||
      getTableCenter(a.table).x - getTableCenter(b.table).x
    )).map(entry => entry.table)
    // Reverse only this ring, keeping its starting table and outside-in order.
    ordered.push(...walkRing(ring, ordered.length === 0))
    if (outerRingOnly) return ordered
    start = end
  }
  return ordered
}

function buildRectZoneFromTables<T extends TableGeometry>(
  tables: T[],
): Pick<RoomZone, 'bounds' | 'polygon'> | null {
  if (tables.length === 0) return null

  const bounds = getTableBounds(tables)
  return {
    bounds,
    polygon: [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ],
  }
}

function sortTablesForRenumbering<T extends TableGeometry>(
  tables: T[],
  direction: TableNumberingDirection,
  zone?: Pick<RoomZone, 'bounds' | 'polygon'> | null,
  startTable: T | null = null,
): T[] {
  if (direction === 'cw' || direction === 'ccw') {
    return sortTablesForRoom(tables, zone, direction, startTable)
  }

  return sortTablesByDirection(tables, direction)
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
): Array<{ id: string; prefix: string; tables: TableObject[]; zone: RoomZone | null }> {
  const roomZones = getRoomZones(room)
  const roomZonesById = new Map(roomZones.map(zone => [zone.id, zone]))
  const roomIds = roomZones.map(zone => zone.id)
  const firstRoomId = roomIds[0] ?? 'R1'
  const grouped = new Map<string, TableObject[]>()

  for (const roomId of roomIds) grouped.set(roomId, [])
  if (grouped.size === 0) grouped.set(firstRoomId, [])

  for (const table of tables) {
    const resolvedRoomId =
      getRoomIdForTable(table, room) ??
      (table.roomId && grouped.has(table.roomId) ? table.roomId : null) ??
      firstRoomId
    const bucket = grouped.get(resolvedRoomId) ?? []
    bucket.push(table)
    grouped.set(resolvedRoomId, bucket)
  }

  return Array.from(grouped.entries()).map(([id, roomTables]) => ({
    id,
    prefix: getRoomLabel(room, id),
    tables: roomTables,
    zone: roomZonesById.get(id) ?? null,
  }))
}

export function buildSectionRenumberChanges(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  sectionId: string,
  direction: TableNumberingDirection,
  room: CompositeRoom | null = null,
  startTableId: TableId | null | undefined = sections[sectionId]?.numberingStartTableId,
): TableRenumberChange[] {
  const section = sections[sectionId]
  if (!section) return []

  const sectionTables = Object.values(tables).filter(table => table.sectionId === sectionId)
  const prefix = getSectionPrefixes(sections).get(section.id)!
  const changes: TableRenumberChange[] = []
  let nextTableNumber = 1

  for (const bucket of getRoomBuckets(sectionTables, room)) {
    const ordered = sortTablesForRenumbering(
      bucket.tables,
      direction,
      bucket.zone ?? buildRectZoneFromTables(bucket.tables),
      nextTableNumber === 1 ? bucket.tables.find(table => table.id === startTableId) ?? null : null,
    )
    ordered.forEach(table => {
      changes.push(
        createRenumberChange(
          table,
          formatScopedDisplayId(prefix, nextTableNumber),
          nextTableNumber,
          false,
        ),
      )
      nextTableNumber++
    })
  }

  return changes
}

export function buildAllSectionRenumberChanges(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  room: CompositeRoom | null,
  direction: TableNumberingDirection,
  preserveLabelOverride = false,
  useSavedDirections = false,
  startTableId?: TableId | null,
): TableRenumberChange[] {
  const changes: TableRenumberChange[] = []
  const allTables = Object.values(tables)
  const sectionList = Object.values(sections).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  const sectionIds = new Set(sectionList.map(section => section.id))
  const prefixes = getSectionPrefixes(sections)

  for (const section of sectionList) {
    const sectionTables = allTables.filter(table => table.sectionId === section.id)
    const prefix = prefixes.get(section.id)!
    let nextTableNumber = 1
    for (const bucket of getRoomBuckets(sectionTables, room)) {
      const ordered = sortTablesForRenumbering(
        bucket.tables,
        useSavedDirections ? section.numberingDirection ?? direction : direction,
        bucket.zone ?? buildRectZoneFromTables(bucket.tables),
        nextTableNumber === 1 ? bucket.tables.find(table => table.id === (useSavedDirections || startTableId === undefined ? section.numberingStartTableId : startTableId)) ?? null : null,
      )
      ordered.forEach(table => {
        changes.push(
          createRenumberChange(
            table,
            formatScopedDisplayId(prefix, nextTableNumber),
            nextTableNumber,
            preserveLabelOverride,
          ),
        )
        nextTableNumber++
      })
    }
  }

  const unsectioned = allTables.filter(table => !table.sectionId || !sectionIds.has(table.sectionId))
  let nextUnsectionedNumber = 1
  for (const bucket of getRoomBuckets(unsectioned, room)) {
    const ordered = sortTablesForRenumbering(bucket.tables, direction, bucket.zone,
      nextUnsectionedNumber === 1 ? bucket.tables.find(table => table.id === startTableId) ?? null : null)
    ordered.forEach(table => {
      const number = nextUnsectionedNumber++
      changes.push(createRenumberChange(table, String(number), number, preserveLabelOverride))
    })
  }

  return changes
}

export function syncRoomFieldsForTables(
  tables: Record<string, TableObject>,
  room: CompositeRoom | null,
  sections: Record<string, Section> = {},
  renumber = true,
  direction: TableNumberingDirection = 'cw',
  startTableId?: TableId | null,
): Record<string, TableObject> {
  const next: Record<string, TableObject> = {}
  const roomZones = getRoomZones(room)
  const roomIds = roomZones.map(zone => zone.id)
  const firstRoomId = roomIds[0] ?? 'R1'

  for (const table of Object.values(tables)) {
    next[table.id] = { ...table }
  }

  if (roomZones.length === 0) {
    if (!renumber) return next
    const changes = buildAllSectionRenumberChanges(next, sections, room, direction, true, true, startTableId)
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
      detectedRoomId ??
      (existingRoomId && roomIds.includes(existingRoomId) ? existingRoomId : null) ??
      firstRoomId

    table.roomId = resolvedRoomId
    tablesByResolvedRoom.get(resolvedRoomId)?.push(table)
  }

  if (!renumber) return next
  const changes = buildAllSectionRenumberChanges(next, sections, room, direction, true, true, startTableId)
  for (const change of changes) {
    const table = next[change.tableId]
    if (!table) continue
    table.tableNumber = change.next.tableNumber
    table.displayId = change.next.displayId
    if (!table.labelOverridden) table.label = change.next.displayId
  }

  return next
}

/** Only offer starts in the first room's outer ring, preserving outside-in order. */
export function getNumberingStartTables(tables: TableObject[], room: CompositeRoom | null): TableObject[] {
  const bucket = getRoomBuckets(tables, room).find(bucket => bucket.tables.length > 0)
  if (!bucket) return []
  const outer = sortTablesForRoom(bucket.tables, bucket.zone, 'cw', null, true)
  const hull = getTableCenterHull(outer)
  return hull.length <= 2 && outer.length > 1 ? [outer[0], outer[outer.length - 1]] : outer
}

/** Keep established IDs frozen and append unused IDs only for newly placed tables. */
export function numberNewTablesWhileLocked(
  tables: Record<string, TableObject>, previousIds: ReadonlySet<string>, sections: Record<string, Section>,
): Record<string, TableObject> {
  const next = Object.fromEntries(Object.values(tables).map(table => [table.id, { ...table }]))
  const existing = Object.values(next).filter(table => previousIds.has(table.id))
  const used = new Set(existing.flatMap(table => [table.displayId, table.label]))
  const prefixes = getSectionPrefixes(sections)
  for (const table of Object.values(next)) {
    if (previousIds.has(table.id)) continue
    const prefix = table.sectionId ? prefixes.get(table.sectionId) ?? '' : ''
    let number = existing.reduce((max, other) => {
      const suffix = other.displayId.startsWith(prefix) ? other.displayId.slice(prefix.length) : ''
      return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max
    }, 0) + 1
    let displayId = prefix ? formatScopedDisplayId(prefix, number) : String(number)
    while (used.has(displayId)) {
      number++
      displayId = prefix ? formatScopedDisplayId(prefix, number) : String(number)
    }
    Object.assign(table, { tableNumber: number, displayId, label: displayId, labelOverridden: false })
    existing.push(table)
    used.add(displayId)
  }
  return next
}
