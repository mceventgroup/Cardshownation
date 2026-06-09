import type {
  BackgroundImage,
  CompositeRoom,
  Door,
  LayoutSettings,
  Point,
  Rect,
  Section,
  TableObject,
  Vendor,
  VendorAssignment,
} from '@/domain/types'
import { getRoomLabel, getRoomZones } from '@/domain/room-numbering'
import { getStage } from './stage'
import { vendorColor } from './defaults'
import { resolveVendorBuckets, vendorDisplayName } from './vendor-resolution'
import { compressTableLabels } from './table-ranges'

function abbreviateAssignedTablePrefix(value: string): string {
  return value
    .replace(/Main Room-/gi, 'MR-')
    .replace(/Main Room /gi, 'MR-')
    .replace(/Room /gi, 'R-')
}

function formatAssignedTableList(labels: string[]): string {
  if (labels.length === 0) return ''

  const normalized = [...new Set(labels.map(label => label.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  const grouped = new Map<string, string[]>()
  const passthrough: string[] = []

  for (const label of normalized) {
    const match = label.match(/^(.*?)(\d+)$/)
    if (!match) {
      passthrough.push(abbreviateAssignedTablePrefix(label))
      continue
    }

    const prefix = abbreviateAssignedTablePrefix(match[1])
    const number = match[2]
    const existing = grouped.get(prefix)
    if (existing) existing.push(number)
    else grouped.set(prefix, [number])
  }

  const groupedLabels = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(([prefix, numbers]) => `${prefix}${numbers.join(',')}`)

  return [...groupedLabels, ...passthrough].join(', ')
}

export interface ExportMetadata {
  eventName?: string
  venue?: string
  date?: string
}

export type ExportColorMode = 'color' | 'bw'

export interface PrintOptions {
  showVendorNames: boolean
  showPaymentStatus: boolean
  title: string
  colorMode?: ExportColorMode
  metadata?: ExportMetadata
  includeVendorAssignmentsPage?: boolean
}

const OUTER_PAD = 28
const HEADER_HEIGHT = 92
const FOOTER_HEIGHT = 18
const LEGEND_ITEM_WIDTH = 104
const EXPORT_BASE_SCALE = 1
const EXPORT_MIN_TABLE_WIDTH = 44
const EXPORT_MIN_TABLE_HEIGHT = 28
const ROOM_LABEL_HEIGHT = 28
const ROOM_LABEL_OFFSET = 10
const PNG_EXPORT_MAX_AREA_FOR_3X = 18_000_000
const PNG_EXPORT_MAX_CANVAS_DIMENSION = 16_384
const PNG_EXPORT_MAX_CANVAS_AREA = 268_000_000
const PRINT_PAGE_LANDSCAPE_WIDTH = 1100
const PRINT_PAGE_LANDSCAPE_HEIGHT = 760
const PRINT_PAGE_PORTRAIT_WIDTH = 820
const PRINT_PAGE_PORTRAIT_HEIGHT = 1060

interface RoomSection {
  roomId: string
  roomLabel: string
  bounds: Rect
  polygon: Point[]
  tables: TableObject[]
  backgroundImages: BackgroundImage[]
}

interface ExportDocument {
  svg: string
  content: string
  width: number
  height: number
  orientation: 'landscape' | 'portrait'
}

interface ExportRenderContext {
  scale: number
  sourceBounds: Rect
  offsetX: number
  offsetY: number
}

function buildRectPolygon(bounds: Rect): Point[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
}

function expandBounds(bounds: Rect, amount: number): Rect {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  }
}

function unionBounds(current: Rect | null, next: Rect): Rect {
  if (!current) return { ...next }
  const minX = Math.min(current.x, next.x)
  const minY = Math.min(current.y, next.y)
  const maxX = Math.max(current.x + current.width, next.x + next.width)
  const maxY = Math.max(current.y + current.height, next.y + next.height)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function boundsFromTable(table: TableObject): Rect {
  return { x: table.x, y: table.y, width: table.width, height: table.height }
}

function boundsFromImage(image: BackgroundImage): Rect {
  return { x: image.x, y: image.y, width: image.width, height: image.height }
}

function boundsFromDoor(door: Door): Rect {
  if (door.side === 'top' || door.side === 'bottom') {
    return { x: door.x, y: door.y - 14, width: door.width, height: 28 }
  }
  return { x: door.x - 14, y: door.y, width: 28, height: door.width }
}

function boundsFromPolygon(points: Point[]): Rect {
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

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function getContrastingTextColor(fill: string): string {
  const normalized = fill.trim()
  if (!normalized.startsWith('#')) return '#111827'
  const hex = normalized.length === 4
    ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized
  if (hex.length !== 7) return '#111827'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.58 ? '#111827' : '#ffffff'
}

function getEffectiveMetadata(options: PrintOptions): Required<ExportMetadata> {
  return {
    eventName: options.metadata?.eventName?.trim() || options.title || 'Floor Plan',
    venue: options.metadata?.venue?.trim() || 'Venue TBD',
    date: options.metadata?.date?.trim() || new Date().toLocaleDateString(),
  }
}

function computeGlobalSourceBounds(roomSections: RoomSection[], doors: Door[]): Rect {
  let bounds: Rect | null = null

  for (const section of roomSections) {
    bounds = unionBounds(bounds, section.bounds)
    if (section.polygon.length > 0) {
      bounds = unionBounds(bounds, boundsFromPolygon(section.polygon))
    }
    for (const table of section.tables) {
      bounds = unionBounds(bounds, boundsFromTable(table))
    }
    for (const image of section.backgroundImages) {
      bounds = unionBounds(bounds, boundsFromImage(image))
    }
  }

  for (const door of doors) {
    bounds = unionBounds(bounds, boundsFromDoor(door))
  }

  return bounds ?? { x: 0, y: 0, width: 0, height: 0 }
}

function createRenderContext(roomSections: RoomSection[], doors: Door[]): ExportRenderContext {
  const allTables = roomSections.flatMap(section => section.tables)
  const smallestTableWidth = allTables.length > 0
    ? Math.min(...allTables.map(table => Math.max(1, table.width)))
    : EXPORT_MIN_TABLE_WIDTH
  const smallestTableHeight = allTables.length > 0
    ? Math.min(...allTables.map(table => Math.max(1, table.height)))
    : EXPORT_MIN_TABLE_HEIGHT
  const scale = Math.max(
    EXPORT_BASE_SCALE,
    EXPORT_MIN_TABLE_WIDTH / smallestTableWidth,
    EXPORT_MIN_TABLE_HEIGHT / smallestTableHeight,
  )
  const sourceBounds = computeGlobalSourceBounds(roomSections, doors)

  return {
    scale,
    sourceBounds,
    offsetX: OUTER_PAD - sourceBounds.x * scale,
    offsetY: HEADER_HEIGHT + OUTER_PAD - sourceBounds.y * scale,
  }
}

function buildDoorSvg(door: Door, context: ExportRenderContext): string {
  const isEntrance = door.kind === 'entrance'
  const accentColor = isEntrance ? '#7c3aed' : '#2563eb'
  const panelThickness = 4
  const width = door.width * context.scale
  const x = transformX(context, door.x)
  const y = transformY(context, door.y)
  const labelFontSize = 10

  if (door.side === 'top' || door.side === 'bottom') {
    const barY = y - panelThickness / 2
    const labelY = door.side === 'top' ? y - 12 : y + 16
    const swingY = door.side === 'top' ? y + width * 0.45 : y - width * 0.45
    const arrow = isEntrance
      ? (door.side === 'top'
        ? `<path d="M ${(x + width / 2).toFixed(2)} ${(y - 14).toFixed(2)} L ${(x + width / 2).toFixed(2)} ${(y + 8).toFixed(2)} M ${(x + width / 2 - 5).toFixed(2)} ${(y + 3).toFixed(2)} L ${(x + width / 2).toFixed(2)} ${(y + 8).toFixed(2)} L ${(x + width / 2 + 5).toFixed(2)} ${(y + 3).toFixed(2)}" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
        : `<path d="M ${(x + width / 2).toFixed(2)} ${(y + 14).toFixed(2)} L ${(x + width / 2).toFixed(2)} ${(y - 8).toFixed(2)} M ${(x + width / 2 - 5).toFixed(2)} ${(y - 3).toFixed(2)} L ${(x + width / 2).toFixed(2)} ${(y - 8).toFixed(2)} L ${(x + width / 2 + 5).toFixed(2)} ${(y - 3).toFixed(2)}" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />`)
      : ''
    const sweep = door.side === 'top' ? 1 : 0

    return [
      `<rect x="${x.toFixed(2)}" y="${barY.toFixed(2)}" width="${width.toFixed(2)}" height="${panelThickness}" fill="${accentColor}" rx="1" />`,
      `<path d="M ${x.toFixed(2)} ${y.toFixed(2)} A ${(width * 0.8).toFixed(2)} ${(width * 0.8).toFixed(2)} 0 0 ${sweep} ${(x + width * 0.8).toFixed(2)} ${swingY.toFixed(2)}" stroke="${accentColor}" stroke-width="0.75" stroke-dasharray="3 3" opacity="0.45" fill="none" />`,
      arrow,
      `<text x="${(x + width / 2).toFixed(2)}" y="${labelY.toFixed(2)}" text-anchor="middle" font-size="${labelFontSize}" font-family="system-ui, sans-serif" fill="#111827" stroke="rgba(255,255,255,0.95)" stroke-width="3" paint-order="stroke" stroke-linejoin="round" font-weight="700">${esc(door.label)}</text>`,
    ].join('')
  }

  const barX = x - panelThickness / 2
  const labelX = door.side === 'left' ? x - 12 : x + 12
  const labelY = y + width / 2 + 4
  const swingX = door.side === 'left' ? x + width * 0.45 : x - width * 0.45
  const arrow = isEntrance
    ? (door.side === 'left'
      ? `<path d="M ${(x - 14).toFixed(2)} ${(y + width / 2).toFixed(2)} L ${(x + 8).toFixed(2)} ${(y + width / 2).toFixed(2)} M ${(x + 3).toFixed(2)} ${(y + width / 2 - 5).toFixed(2)} L ${(x + 8).toFixed(2)} ${(y + width / 2).toFixed(2)} L ${(x + 3).toFixed(2)} ${(y + width / 2 + 5).toFixed(2)}" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
      : `<path d="M ${(x + 14).toFixed(2)} ${(y + width / 2).toFixed(2)} L ${(x - 8).toFixed(2)} ${(y + width / 2).toFixed(2)} M ${(x - 3).toFixed(2)} ${(y + width / 2 - 5).toFixed(2)} L ${(x - 8).toFixed(2)} ${(y + width / 2).toFixed(2)} L ${(x - 3).toFixed(2)} ${(y + width / 2 + 5).toFixed(2)}" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />`)
    : ''
  const sweep = door.side === 'left' ? 1 : 0

  return [
    `<rect x="${barX.toFixed(2)}" y="${y.toFixed(2)}" width="${panelThickness}" height="${width.toFixed(2)}" fill="${accentColor}" rx="1" />`,
    `<path d="M ${x.toFixed(2)} ${y.toFixed(2)} A ${(width * 0.8).toFixed(2)} ${(width * 0.8).toFixed(2)} 0 0 ${sweep} ${swingX.toFixed(2)} ${(y + width * 0.8).toFixed(2)}" stroke="${accentColor}" stroke-width="0.75" stroke-dasharray="3 3" opacity="0.45" fill="none" />`,
    arrow,
    `<text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" text-anchor="middle" font-size="${labelFontSize}" font-family="system-ui, sans-serif" fill="#111827" stroke="rgba(255,255,255,0.95)" stroke-width="3" paint-order="stroke" stroke-linejoin="round" font-weight="700">${esc(door.label)}</text>`,
  ].join('')
}

function transformX(context: ExportRenderContext, x: number): number {
  return context.offsetX + x * context.scale
}

function transformY(context: ExportRenderContext, y: number): number {
  return context.offsetY + y * context.scale
}

function transformRect(context: ExportRenderContext, rect: Rect): Rect {
  return {
    x: transformX(context, rect.x),
    y: transformY(context, rect.y),
    width: rect.width * context.scale,
    height: rect.height * context.scale,
  }
}

function polygonToPath(points: Point[], context: ExportRenderContext): string {
  if (points.length === 0) return ''
  return points.map((point, index) => {
    const x = transformX(context, point.x).toFixed(2)
    const y = transformY(context, point.y).toFixed(2)
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ') + ' Z'
}

function vendorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}

function verifyLayoutFidelity(roomSections: RoomSection[], context: ExportRenderContext): void {
  const tolerance = 0.01
  const tables = roomSections.flatMap(section => section.tables)

  for (const table of tables) {
    const rect = transformRect(context, boundsFromTable(table))
    if (Math.abs(rect.width - table.width * context.scale) > tolerance) {
      throw new Error('Export width scale drift detected.')
    }
    if (Math.abs(rect.height - table.height * context.scale) > tolerance) {
      throw new Error('Export height scale drift detected.')
    }
  }

  for (let index = 1; index < tables.length; index++) {
    const previous = tables[index - 1]
    const current = tables[index]
    const sourceDx = (current.x - previous.x) * context.scale
    const sourceDy = (current.y - previous.y) * context.scale
    const exportDx = transformX(context, current.x) - transformX(context, previous.x)
    const exportDy = transformY(context, current.y) - transformY(context, previous.y)

    if (Math.abs(sourceDx - exportDx) > tolerance || Math.abs(sourceDy - exportDy) > tolerance) {
      throw new Error('Export position fidelity drift detected.')
    }
  }
}

function getRoomSections(
  tables: TableObject[],
  room: CompositeRoom | null,
  backgroundImages?: Record<string, BackgroundImage>,
): RoomSection[] {
  const roomZones = getRoomZones(room)
  const images = Object.values(backgroundImages ?? {}).filter(image => image.visible).sort((a, b) => a.order - b.order)
  const sectionMap = new Map<string, RoomSection>()

  for (const zone of roomZones) {
    sectionMap.set(zone.id, {
      roomId: zone.id,
      roomLabel: zone.label,
      bounds: { ...zone.bounds },
      polygon: zone.polygon,
      tables: [],
      backgroundImages: [],
    })
  }

  for (const table of tables) {
    const roomId = table.roomId || roomZones[0]?.id || 'R1'
    const existing = sectionMap.get(roomId)
    if (existing) {
      existing.tables.push(table)
      existing.bounds = unionBounds(existing.bounds, boundsFromTable(table))
      continue
    }
    const fallbackBounds = boundsFromTable(table)
    sectionMap.set(roomId, {
      roomId,
      roomLabel: getRoomLabel(room, roomId),
      bounds: fallbackBounds,
      polygon: buildRectPolygon(fallbackBounds),
      tables: [table],
      backgroundImages: [],
    })
  }

  for (const section of sectionMap.values()) {
    const expanded = expandBounds(section.bounds, 12)
    section.backgroundImages = images.filter(image => intersects(boundsFromImage(image), expanded))
    for (const image of section.backgroundImages) {
      section.bounds = unionBounds(section.bounds, boundsFromImage(image))
    }
  }

  return [...sectionMap.values()]
    .filter(section => section.tables.length > 0 || section.polygon.length > 0)
    .sort((a, b) => a.roomLabel.localeCompare(b.roomLabel, undefined, { numeric: true, sensitivity: 'base' }))
}

export function exportPNG(filename = 'floorplan.png'): void {
  const stage = getStage()
  if (!stage) {
    alert('Canvas not ready.')
    return
  }

  const dataURL = stage.toDataURL({ pixelRatio: 2 })
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  link.click()
}

export function exportFloorplanImage(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  doors: Record<string, Door>,
  options: PrintOptions,
  backgroundImages?: Record<string, BackgroundImage>,
  filename = 'floorplan.png',
): void {
  const tableList = Object.values(tables)
  if (tableList.length === 0 && !room) {
    alert('Nothing to export - add some tables first.')
    return
  }

  const document = buildSVG(tableList, sections, vendors, assignments, room, Object.values(doors), options, backgroundImages)
  void downloadSvgAsPng(document.svg, document.width, document.height, filename)
}

export function exportVendorListImage(
  tables: Record<string, TableObject>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  title: string,
  filename = 'vendor-list.png',
): void {
  const svg = buildVendorListSVG(tables, vendors, assignments, title)
  const heightMatch = svg.match(/height="(\d+)"/)
  const widthMatch = svg.match(/width="(\d+)"/)
  const width = widthMatch ? Number(widthMatch[1]) : 1200
  const height = heightMatch ? Number(heightMatch[1]) : 900
  void downloadSvgAsPng(svg, width, height, filename)
}

export function exportVendorAssignmentsCsv(
  tables: Record<string, TableObject>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  title: string,
): void {
  const rows = resolveVendorBuckets(vendors, assignments)
    .map(bucket => {
      const tablesForVendor = bucket.assignments
        .map(assignment => {
          const table = tables[assignment.tableId]
          if (!table) return null
          return {
            room: getRoomLabel(room, table.roomId),
            tableNumber: table.displayId || table.label || assignment.tableId,
            premium: table.premium ? 'Yes' : 'No',
            notes: assignment.notes ?? bucket.vendor?.notes ?? '',
          }
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
      if (tablesForVendor.length === 0) return null

      const uniqueRooms = [...new Set(tablesForVendor.map(row => row.room))]
      return {
        vendorName: bucket.displayName,
        room: uniqueRooms.join(' | '),
        tableNumbers: tablesForVendor.map(row => row.tableNumber).join(', '),
        premium: tablesForVendor.some(row => row.premium === 'Yes') ? 'Yes' : 'No',
        notes: tablesForVendor.map(row => row.notes).filter(Boolean).join(' | '),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName, undefined, { sensitivity: 'base' }))

  const csvRows = [
    ['Vendor Name', 'Room', 'Table Number(s)', 'Premium', 'Notes'],
    ...rows.map(row => [row.vendorName, row.room, row.tableNumbers, row.premium, row.notes]),
  ]

  const csv = csvRows
    .map(row => row.map(value => `"${sanitizeCsvCell(String(value ?? '')).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(title || 'vendor-assignments').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function printLayout(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  doors: Record<string, Door>,
  options: PrintOptions,
  backgroundImages?: Record<string, BackgroundImage>,
): void {
  const tableList = Object.values(tables)
  if (tableList.length === 0 && !room) {
    alert('Nothing to export - add some tables first.')
    return
  }

  const document = buildSVG(tableList, sections, {}, assignments, room, Object.values(doors), options, backgroundImages)
  openPrintWindow(
    buildPrintHTML(document, tables, assignments, room, options),
    document.orientation === 'landscape' ? 1200 : 900,
    document.orientation === 'landscape' ? 850 : 1100,
    true,
  )
}

export function printShowModeSheet(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  title: string,
  doors: Record<string, Door>,
  backgroundImages?: Record<string, BackgroundImage>,
): void {
  const tableList = Object.values(tables)
  if (tableList.length === 0 && !room) {
    alert('Nothing to export - add some tables first.')
    return
  }

  const document = buildSVG(
    tableList,
    sections,
    vendors,
    assignments,
    room,
    Object.values(doors),
    { showVendorNames: false, showPaymentStatus: false, title },
    backgroundImages,
  )

  const rows = resolveVendorBuckets(vendors, assignments)
    .map(bucket => ({
      name: bucket.displayName,
      labels: bucket.assignments
        .map(assignment => tables[assignment.tableId]?.displayId ?? tables[assignment.tableId]?.label ?? assignment.tableId)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    }))
    .filter(row => row.labels.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const listMarkup = rows.length === 0
    ? '<div class="empty">No vendors have tables assigned yet.</div>'
    : rows.map(row => `
      <div class="vendor-row">
        <div class="vendor-name">${esc(row.name)}</div>
        <div class="vendor-tables">${esc(formatAssignedTableList(row.labels))}</div>
      </div>
    `).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:;" />
  <title>${esc(title || 'Show Sheet')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a; }
    .page { padding: 20px 24px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; }
    .subtitle { margin-top: 4px; font-size: 12px; color: #64748b; }
    .actions { display: flex; gap: 8px; }
    .print-btn {
      padding: 8px 14px; background: #2563eb; color: white; border: none; border-radius: 999px;
      cursor: pointer; font-size: 13px; font-weight: 600;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2.15fr) minmax(260px, 1fr);
      gap: 18px;
      align-items: start;
    }
    .map-panel, .list-panel {
      border: 1px solid #cbd5e1;
      border-radius: 18px;
      overflow: hidden;
      background: #fff;
    }
    .panel-head {
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      background: #f8fafc;
    }
    .map-wrap { padding: 12px; }
    .map-wrap svg { width: 100%; height: auto; display: block; }
    .list-wrap { max-height: 920px; overflow: hidden; }
    .vendor-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
      gap: 12px;
      padding: 8px 14px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .vendor-row:last-child { border-bottom: none; }
    .vendor-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vendor-tables { text-align: right; font-weight: 600; color: #334155; overflow-wrap: anywhere; }
    .empty { padding: 18px 14px; font-size: 13px; color: #64748b; }
    @media print {
      .no-print { display: none !important; }
      @page { size: landscape; margin: 0.35in; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">${esc(title || 'Show Sheet')}</div>
        <div class="subtitle">${rows.length} vendors | ${Object.keys(assignments).length} assigned tables | ${new Date().toLocaleDateString()}</div>
      </div>
      <div class="actions no-print">
        <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>
    <div class="layout">
      <section class="map-panel">
        <div class="panel-head">Map</div>
        <div class="map-wrap">${document.svg}</div>
      </section>
      <section class="list-panel">
        <div class="panel-head">Vendor List</div>
        <div class="list-wrap">${listMarkup}</div>
      </section>
    </div>
  </div>
</body>
</html>`

  openPrintWindow(html, 1200, 850, true)
}

export function printVendorManifest(
  tables: Record<string, TableObject>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  title: string,
  options?: { casesOnly?: boolean },
): void {
  const vendorTableMap = new Map<string, { name: string; tables: string[]; payment: string; category: string; cases: number }>()

  for (const assignment of Object.values(assignments)) {
    const table = tables[assignment.tableId]
    const label = table?.displayId ?? table?.label ?? assignment.tableId
    const existing = vendorTableMap.get(assignment.vendorId)
    if (existing) {
      existing.tables.push(label)
    } else {
      vendorTableMap.set(assignment.vendorId, {
        name: assignment.vendorName,
        tables: [label],
        payment: assignment.paymentStatus,
        category: assignment.vendorCategory ?? '',
        cases: vendors[assignment.vendorId]?.cases ?? 0,
      })
    }
  }

  for (const vendor of Object.values(vendors)) {
    if (!vendorTableMap.has(vendor.id)) {
      vendorTableMap.set(vendor.id, {
        name: vendor.name,
        tables: [],
        payment: vendor.paymentStatus,
        category: vendor.category ?? '',
        cases: vendor.cases,
      })
    }
  }

  const rows = [...vendorTableMap.values()]
    .filter(row => !options?.casesOnly || row.cases > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  const tableRows = rows.map((row, index) => {
    const sortedTables = row.tables.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return `<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 12px;font-size:13px;color:#374151">${index + 1}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b">${esc(row.name)}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151">${esc(row.category)}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;text-align:center;font-weight:700">${row.cases}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151">${sortedTables.length > 0 ? esc(compressTableLabels(sortedTables)) : '<span style="color:#9ca3af">-</span>'}</td>
      <td style="padding:8px 12px;font-size:12px;text-align:center"><span style="background:${paymentBackground(row.payment)};padding:2px 8px;border-radius:4px">${paymentBadge(row.payment)}</span></td>
      <td style="padding:8px 24px;width:80px;border-left:1px solid #e2e8f0"></td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>${esc(title)} - ${options?.casesOnly ? 'Case Rental Checklist' : 'Vendor Checklist'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; }
    @media print {
      .no-print { display: none !important; }
      @page { margin: 0.5in; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-bottom:2px solid #1e293b">
    <div>
      <div style="font-size:20px;font-weight:700;color:#1e293b">${esc(title || 'Floor Plan')} - ${options?.casesOnly ? 'Case Rental Checklist' : 'Vendor Checklist'}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px">${new Date().toLocaleDateString()}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save PDF</button>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-top:8px">
    <thead>
      <tr style="border-bottom:2px solid #cbd5e1;background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">#</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Vendor</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Category</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Cases</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tables</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Payment</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-left:1px solid #e2e8f0">Check-in</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`

  openPrintWindow(html, 900, 700, true)
}

function getUpcomingShows(settings: LayoutSettings): Array<{ date: string; label: string }> {
  const entries = [
    { date: settings.upcomingShow1Date.trim(), label: settings.upcomingShow1Location.trim() },
    { date: settings.upcomingShow2Date.trim(), label: settings.upcomingShow2Location.trim() },
    { date: settings.upcomingShow3Date.trim(), label: settings.upcomingShow3Location.trim() },
  ]

  return entries.filter(entry => entry.date || entry.label)
}

function compareAssignedTablesForPrint(
  a: TableObject,
  b: TableObject,
  sections: Record<string, Section>,
): number {
  const aSectionOrder = a.sectionId ? (sections[a.sectionId]?.order ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
  const bSectionOrder = b.sectionId ? (sections[b.sectionId]?.order ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
  if (aSectionOrder !== bSectionOrder) return aSectionOrder - bSectionOrder

  const aSectionName = a.sectionId ? sections[a.sectionId]?.name ?? '' : ''
  const bSectionName = b.sectionId ? sections[b.sectionId]?.name ?? '' : ''
  const sectionNameCmp = aSectionName.localeCompare(bSectionName, undefined, { numeric: true, sensitivity: 'base' })
  if (sectionNameCmp !== 0) return sectionNameCmp

  return (a.displayId || a.label || String(a.tableNumber)).localeCompare(
    b.displayId || b.label || String(b.tableNumber),
    undefined,
    { numeric: true, sensitivity: 'base' },
  )
}

export function printVendorTableAssignments(
  tables: Record<string, TableObject>,
  sections: Record<string, Section>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  settings: LayoutSettings,
): void {
  const grouped = resolveVendorBuckets(vendors, assignments)
    .map(bucket => {
      const assignedTables = bucket.assignments
        .map(assignment => tables[assignment.tableId])
        .filter((table): table is TableObject => Boolean(table))
        .sort((a, b) => compareAssignedTablesForPrint(a, b, sections))

      if (assignedTables.length === 0) return null

      return {
        key: bucket.key,
        vendorName: bucket.vendor ? vendorDisplayName(bucket.vendor) : bucket.displayName,
        tableLabels: assignedTables.map(table => table.displayId || table.label || String(table.tableNumber)),
        sortTable: assignedTables[0],
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => compareAssignedTablesForPrint(a.sortTable, b.sortTable, sections))

  if (grouped.length === 0) {
    alert('No vendor assignments available to print.')
    return
  }

  const upcomingShows = getUpcomingShows(settings)
  const pages = grouped.map(row => `
    <section class="assignment-page">
      <div class="sheet">
        <div class="sheet-head">
          <div class="event-name">${esc(settings.eventName.trim() || 'Kansas Card Show')}</div>
          <div class="event-date">${esc(settings.eventDate.trim() || 'Date TBD')}</div>
        </div>
        <div class="vendor-block">
          <div class="label">Vendor</div>
          <div class="vendor-name">${esc(row.vendorName)}</div>
        </div>
        <div class="assignment-block">
          <div class="label">Table Assignment</div>
          <div class="assignment-value">${esc(compressTableLabels(row.tableLabels))}</div>
        </div>
        <div class="footer-block">
          <div class="shows">
            <div class="shows-title">Upcoming Shows</div>
            ${upcomingShows.length === 0
              ? '<div class="show-line muted">No upcoming shows listed</div>'
              : upcomingShows.map(show => `<div class="show-line">${esc(show.date)} - ${esc(show.label)}</div>`).join('')}
          </div>
          <div class="website">kansascardshow.com</div>
        </div>
      </div>
    </section>
  `).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>Vendor Table Assignments</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f5f5; font-family: "Helvetica Neue", Arial, sans-serif; color: #111827; }
    .header { padding: 12px 24px; border-bottom: 1px solid #d1d5db; display: flex; justify-content: space-between; align-items: center; background: #fff; position: sticky; top: 0; }
    .title { font-size: 18px; font-weight: 700; }
    .assignment-page { min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 24px; page-break-after: always; }
    .assignment-page:last-child { page-break-after: auto; }
    .sheet { width: 100%; max-width: 850px; min-height: 1040px; border: 2px solid #111827; background: #fff; padding: 40px 44px; display: flex; flex-direction: column; }
    .sheet-head { border-bottom: 1px solid #d1d5db; padding-bottom: 18px; }
    .event-name { font-size: 28px; font-weight: 700; letter-spacing: 0.02em; }
    .event-date { margin-top: 6px; font-size: 18px; color: #374151; }
    .vendor-block { margin-top: 56px; }
    .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: #6b7280; }
    .vendor-name { margin-top: 10px; font-size: 34px; font-weight: 700; line-height: 1.08; }
    .assignment-block { margin-top: 70px; border: 3px solid #111827; padding: 30px 26px; text-align: center; }
    .assignment-value { margin-top: 16px; font-size: 72px; font-weight: 800; letter-spacing: 0.04em; line-height: 1; }
    .footer-block { margin-top: auto; padding-top: 48px; border-top: 1px solid #d1d5db; display: flex; justify-content: space-between; gap: 24px; align-items: end; }
    .shows-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #4b5563; }
    .show-line { margin-top: 8px; font-size: 18px; }
    .muted { color: #9ca3af; }
    .website { font-size: 18px; font-weight: 700; }
    @media print {
      .no-print { display: none !important; }
      @page { margin: 0.45in; }
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .assignment-page { padding: 0; min-height: auto; }
      .sheet { min-height: 9.8in; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Vendor Table Assignments</div>
    <button class="no-print" onclick="window.print()" style="padding:8px 16px;background:#111827;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save PDF</button>
  </div>
  ${pages}
</body>
</html>`

  openPrintWindow(html, 1000, 900, true)
}

function buildSVG(
  tables: TableObject[],
  sections: Record<string, Section>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  doors: Door[],
  options: PrintOptions,
  backgroundImages?: Record<string, BackgroundImage>,
): ExportDocument {
  const colorMode = options.colorMode ?? 'color'
  const metadata = getEffectiveMetadata(options)
  const byTable = new Map<string, VendorAssignment>()
  for (const assignment of Object.values(assignments)) byTable.set(assignment.tableId, assignment)

  const roomSections = getRoomSections(tables, room, backgroundImages)
  const context = createRenderContext(roomSections, doors)
  verifyLayoutFidelity(roomSections, context)

  const pageWidth = Math.max(
    760,
    Math.ceil(context.sourceBounds.width * context.scale + OUTER_PAD * 2),
  )
  const pageHeight = Math.max(
    540,
    Math.ceil(HEADER_HEIGHT + context.sourceBounds.height * context.scale + OUTER_PAD + FOOTER_HEIGHT),
  )
  const orientation = pageWidth >= pageHeight ? 'landscape' : 'portrait'
  const parts: string[] = [
    `<rect width="${pageWidth}" height="${pageHeight}" fill="#ffffff" />`,
    `<text x="${OUTER_PAD}" y="38" font-size="28" font-family="system-ui, sans-serif" font-weight="700" fill="#0f172a">${esc(metadata.eventName)}</text>`,
    `<text x="${OUTER_PAD}" y="62" font-size="14" font-family="system-ui, sans-serif" fill="#475569">${esc(metadata.venue)} | ${esc(metadata.date)} | Exported ${esc(new Date().toLocaleString())}</text>`,
    `<text x="${OUTER_PAD}" y="82" font-size="12" font-family="system-ui, sans-serif" fill="#64748b">${esc(options.title || 'Floor Plan')} | ${tables.length} tables | ${Object.keys(assignments).length} assigned</text>`,
  ]

  const legendX = pageWidth - OUTER_PAD - LEGEND_ITEM_WIDTH * 3
  const legendItems = [
    { label: 'Assigned', fill: colorMode === 'bw' ? '#d1d5db' : '#dbeafe', stroke: '#334155' },
    { label: 'Available', fill: colorMode === 'bw' ? '#ffffff' : '#f3f4f6', stroke: '#64748b' },
    { label: 'Premium', fill: colorMode === 'bw' ? '#ffffff' : '#fef3c7', stroke: '#92400e' },
  ]
  legendItems.forEach((item, index) => {
    const x = legendX + index * LEGEND_ITEM_WIDTH
    parts.push(`<rect x="${x}" y="26" width="18" height="18" rx="4" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${index === 2 ? 2 : 1.2}" />`)
    if (index === 2) {
      parts.push(`<text x="${x + 9}" y="39" text-anchor="middle" font-size="10" font-family="system-ui, sans-serif" fill="${item.stroke}" font-weight="700">P</text>`)
    }
    parts.push(`<text x="${x + 26}" y="39" font-size="12" font-family="system-ui, sans-serif" fill="#334155">${esc(item.label)}</text>`)
  })

  for (const section of roomSections) {
    const roomBounds = transformRect(context, section.bounds)

    parts.push(`<rect x="${roomBounds.x.toFixed(2)}" y="${roomBounds.y.toFixed(2)}" width="${roomBounds.width.toFixed(2)}" height="${roomBounds.height.toFixed(2)}" rx="12" fill="none" stroke="#cbd5e1" stroke-width="1.5" />`)
    const boundary = section.polygon.length > 2 ? section.polygon : buildRectPolygon(section.bounds)
    parts.push(`<path d="${polygonToPath(boundary, context)}" fill="#f1f5f9" stroke="#1e293b" stroke-width="3" />`)

    if (colorMode === 'color') {
      for (const image of section.backgroundImages) {
        const imageRect = transformRect(context, boundsFromImage(image))
        parts.push(`<image href="${esc(image.dataUrl)}" x="${imageRect.x.toFixed(2)}" y="${imageRect.y.toFixed(2)}" width="${imageRect.width.toFixed(2)}" height="${imageRect.height.toFixed(2)}" opacity="${Math.min(image.opacity, 0.5)}" />`)
      }
    }
  }

  for (const section of roomSections) {
    const roomBounds = transformRect(context, section.bounds)
    const titleWidth = Math.max(120, Math.min(260, section.roomLabel.length * 10 + 36))
    const titleX = roomBounds.x + 12
    const titleY = Math.max(HEADER_HEIGHT - 2, roomBounds.y - ROOM_LABEL_OFFSET - ROOM_LABEL_HEIGHT)

    parts.push(`<rect x="${titleX.toFixed(2)}" y="${titleY.toFixed(2)}" width="${titleWidth.toFixed(2)}" height="${ROOM_LABEL_HEIGHT}" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" />`)
    parts.push(`<text x="${(titleX + 14).toFixed(2)}" y="${(titleY + 19).toFixed(2)}" font-size="15" font-family="system-ui, sans-serif" font-weight="700" fill="#0f172a">${esc(section.roomLabel)}</text>`)
  }

  for (const section of roomSections) {
    for (const table of section.tables) {
      const assignment = byTable.get(table.id)
      const vendor = assignment ? vendors[assignment.vendorId] : null
      const caseCount = vendor?.cases ?? 0
      const isCaseHighlighted = caseCount > 0
      const sectionColor = table.sectionId ? sections[table.sectionId]?.color : null
      const baseFill = assignment?.colorOverride ?? sectionColor ?? (assignment ? vendorColor(assignment.vendorId) : '#e5e7eb')
      const fill = colorMode === 'bw'
        ? (assignment ? '#d1d5db' : '#ffffff')
        : sanitizeColor(baseFill)
      const stroke = colorMode === 'bw'
        ? '#111827'
        : table.premium
          ? '#92400e'
          : '#475569'
      const textColor = colorMode === 'bw' ? '#111827' : getContrastingTextColor(fill)
      const width = table.width * context.scale
      const height = table.height * context.scale
      const groupX = transformX(context, table.x)
      const groupY = transformY(context, table.y)
      const topInset = 2
      const showVendorInitials = options.showVendorNames && assignment && width >= 52 && height >= 34
      const bottomInset = showVendorInitials ? 15 : 2
      const centerHeight = Math.max(10, height - topInset - bottomInset)
      const fontSize = Math.min(32, Math.max(12, Math.min(width, centerHeight) / 1.9))
      const premiumFold = Math.min(16, Math.max(10, Math.min(width, height) * 0.28))
      const badgeWidth = Math.min(20, width - 8)

      parts.push(`<g transform="translate(${groupX.toFixed(2)} ${groupY.toFixed(2)}) rotate(${table.rotation.toFixed(2)})">`)
      if (table.shape === 'round') {
        parts.push(`<ellipse cx="${(width / 2).toFixed(2)}" cy="${(height / 2).toFixed(2)}" rx="${(width / 2).toFixed(2)}" ry="${(height / 2).toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${table.premium ? 2.4 : 1.4}" />`)
      } else {
        parts.push(`<rect width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${table.premium ? 2.4 : 1.4}" />`)
      }

      if (isCaseHighlighted && colorMode !== 'bw') {
        if (table.shape === 'round') {
          parts.push(`<ellipse cx="${(width / 2).toFixed(2)}" cy="${(height / 2).toFixed(2)}" rx="${Math.max(0, width / 2 - 2).toFixed(2)}" ry="${Math.max(0, height / 2 - 2).toFixed(2)}" fill="rgba(234,88,12,0.14)" stroke="#ea580c" stroke-width="2" stroke-dasharray="6 4" />`)
        } else {
          parts.push(`<rect x="2" y="2" width="${Math.max(0, width - 4).toFixed(2)}" height="${Math.max(0, height - 4).toFixed(2)}" rx="4" fill="rgba(234,88,12,0.14)" stroke="#ea580c" stroke-width="2" stroke-dasharray="6 4" />`)
        }
      }

      parts.push(`<text x="${(width / 2).toFixed(2)}" y="${(topInset + centerHeight / 2 + fontSize * 0.32).toFixed(2)}" text-anchor="middle" font-size="${fontSize.toFixed(1)}" font-family="system-ui, sans-serif" fill="${textColor}" font-weight="800">${esc(table.displayId || table.label || String(table.tableNumber))}</text>`)

      if (showVendorInitials && assignment) {
        const badgeFill = textColor === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.08)'
        parts.push(`<rect x="4" y="${(height - 13).toFixed(2)}" width="${badgeWidth.toFixed(2)}" height="9" rx="4" fill="${badgeFill}" />`)
        parts.push(`<text x="${(4 + badgeWidth / 2).toFixed(2)}" y="${(height - 6.2).toFixed(2)}" text-anchor="middle" font-size="7" font-family="system-ui, sans-serif" fill="${textColor}" font-weight="800">${esc(vendorInitials(assignment.vendorName))}</text>`)
      }

      if (table.premium) {
        parts.push(`<path d="M ${(width - premiumFold).toFixed(2)} 0 L ${width.toFixed(2)} 0 L ${width.toFixed(2)} ${premiumFold.toFixed(2)} Z" fill="${colorMode === 'bw' ? '#ffffff' : '#f59e0b'}" />`)
        parts.push(`<text x="${(width - premiumFold * 0.55).toFixed(2)}" y="${(premiumFold * 0.58).toFixed(2)}" text-anchor="middle" font-size="7" font-family="system-ui, sans-serif" fill="${colorMode === 'bw' ? '#111827' : '#ffffff'}" font-weight="800">P</text>`)
      }

      if (isCaseHighlighted && colorMode !== 'bw') {
        const caseBadgeText = `C${caseCount}`
        const caseBadgeWidth = Math.min(Math.max(18, caseBadgeText.length * 7 + 6), Math.max(18, width - 8))
        parts.push(`<rect x="4" y="4" width="${caseBadgeWidth.toFixed(2)}" height="14" rx="7" fill="#ea580c" />`)
        parts.push(`<text x="${(4 + caseBadgeWidth / 2).toFixed(2)}" y="14.2" text-anchor="middle" font-size="8" font-family="system-ui, sans-serif" fill="#ffffff" font-weight="800">${esc(caseBadgeText)}</text>`)
      }

      parts.push(`</g>`)
    }
  }

  for (const door of doors) {
    parts.push(buildDoorSvg(door, context))
  }

  const content = parts.join('')
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">${content}</svg>`,
    content,
    width: pageWidth,
    height: pageHeight,
    orientation,
  }
}

function buildVendorListSVG(
  tables: Record<string, TableObject>,
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
  title: string,
): string {
  const rows = resolveVendorBuckets(vendors, assignments)
    .map(bucket => ({
      name: bucket.displayName,
      tables: bucket.assignments
        .map(assignment => tables[assignment.tableId]?.displayId ?? tables[assignment.tableId]?.label ?? assignment.tableId)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    }))
    .filter(row => row.tables.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const width = 1200
  const rowHeight = 34
  const headerHeight = 86
  const footerPad = 24
  const height = Math.max(220, headerHeight + rows.length * rowHeight + footerPad)
  const parts: string[] = [
    `<rect width="${width}" height="${height}" fill="#ffffff" />`,
    `<text x="48" y="42" font-size="30" font-family="system-ui, sans-serif" font-weight="700" fill="#0f172a">${esc(title || 'Vendor List')}</text>`,
    `<text x="48" y="68" font-size="16" font-family="system-ui, sans-serif" fill="#64748b">${rows.length} vendors with assigned tables</text>`,
    `<line x1="48" y1="${headerHeight}" x2="${width - 48}" y2="${headerHeight}" stroke="#cbd5e1" stroke-width="1" />`,
    `<text x="48" y="${headerHeight - 14}" font-size="13" font-family="system-ui, sans-serif" font-weight="700" fill="#64748b">Vendor</text>`,
    `<text x="${width - 48}" y="${headerHeight - 14}" text-anchor="end" font-size="13" font-family="system-ui, sans-serif" font-weight="700" fill="#64748b">Tables</text>`,
  ]

  rows.forEach((row, index) => {
    const y = headerHeight + index * rowHeight
    parts.push(`<line x1="48" y1="${y + rowHeight}" x2="${width - 48}" y2="${y + rowHeight}" stroke="#e2e8f0" stroke-width="1" />`)
    parts.push(`<text x="48" y="${y + 22}" font-size="18" font-family="system-ui, sans-serif" font-weight="600" fill="#0f172a">${esc(row.name)}</text>`)
    parts.push(`<text x="${width - 48}" y="${y + 22}" text-anchor="end" font-size="18" font-family="system-ui, sans-serif" font-weight="600" fill="#334155">${esc(formatAssignedTableList(row.tables))}</text>`)
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}

function buildVendorAssignmentsPage(
  tables: Record<string, TableObject>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  title: string,
): string {
  const grouped = new Map<string, { vendorName: string; room: string; tableNumbers: string[]; premium: boolean; notes: string[] }>()

  for (const assignment of Object.values(assignments)) {
    const table = tables[assignment.tableId]
    if (!table) continue
    const key = `${assignment.vendorId}:${assignment.vendorName}`
    const existing = grouped.get(key) ?? {
      vendorName: assignment.vendorName,
      room: getRoomLabel(room, table.roomId),
      tableNumbers: [],
      premium: false,
      notes: [],
    }
    existing.tableNumbers.push(table.displayId || table.label || assignment.tableId)
    existing.premium ||= table.premium
    if (assignment.notes) existing.notes.push(assignment.notes)
    grouped.set(key, existing)
  }

  const rows = [...grouped.values()].sort((a, b) => a.vendorName.localeCompare(b.vendorName, undefined, { sensitivity: 'base' }))
  const body = rows.map(row => `
    <tr>
      <td>${esc(row.vendorName)}</td>
      <td>${esc(row.room)}</td>
      <td>${esc(compressTableLabels(row.tableNumbers))}</td>
      <td>${row.premium ? 'Yes' : 'No'}</td>
      <td>${esc(row.notes.join(' | '))}</td>
    </tr>
  `).join('')

  return `
    <section class="print-page assignments-page">
      <div class="page-title">${esc(title || 'Floor Plan')} Vendor Assignments</div>
      <table class="assignment-table">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Room</th>
            <th>Table Number(s)</th>
            <th>Premium</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `
}

function buildPrintHTML(
  document: ExportDocument,
  tables: Record<string, TableObject>,
  assignments: Record<string, VendorAssignment>,
  room: CompositeRoom | null,
  options: PrintOptions,
): string {
  const assignmentPage = options.includeVendorAssignmentsPage
    ? buildVendorAssignmentsPage(tables, assignments, room, options.title)
    : ''
  const pageViewportWidth = document.orientation === 'landscape' ? PRINT_PAGE_LANDSCAPE_WIDTH : PRINT_PAGE_PORTRAIT_WIDTH
  const pageViewportHeight = document.orientation === 'landscape' ? PRINT_PAGE_LANDSCAPE_HEIGHT : PRINT_PAGE_PORTRAIT_HEIGHT
  const pageColumns = Math.max(1, Math.ceil(document.width / pageViewportWidth))
  const pageRows = Math.max(1, Math.ceil(document.height / pageViewportHeight))
  const pages: string[] = []

  for (let row = 0; row < pageRows; row++) {
    for (let column = 0; column < pageColumns; column++) {
      const viewX = column * pageViewportWidth
      const viewY = row * pageViewportHeight
      const viewWidth = Math.min(pageViewportWidth, document.width - viewX)
      const viewHeight = Math.min(pageViewportHeight, document.height - viewY)
      pages.push(`
        <section class="print-page">
          <div class="page-shell">
            <svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="${viewX} ${viewY} ${viewWidth} ${viewHeight}">
              ${document.content}
            </svg>
          </div>
        </section>
      `)
    }
  }
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:;" />
  <title>${esc(options.title || 'Floor Plan')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f8fafc; font-family: system-ui, sans-serif; color: #0f172a; }
    .header { padding: 12px 24px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; background: #fff; position: sticky; top: 0; }
    .title { font-size: 18px; font-weight: 700; color: #1e293b; }
    .subtitle { font-size: 12px; color: #94a3b8; }
    .print-page { padding: 16px; display: flex; justify-content: center; page-break-after: always; }
    .print-page:last-child { page-break-after: auto; }
    .page-shell { background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
    svg { display: block; width: 100%; height: auto; max-width: ${pageViewportWidth}px; background: #fff; }
    .assignments-page { display: block; background: #fff; }
    .page-title { font-size: 22px; font-weight: 700; margin-bottom: 14px; }
    .assignment-table { width: 100%; border-collapse: collapse; }
    .assignment-table th, .assignment-table td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; text-align: left; vertical-align: top; }
    .assignment-table th { background: #f8fafc; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; color: #475569; }
    @media print {
      .no-print { display: none !important; }
      @page { size: ${document.orientation}; margin: 0.4in; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${esc(options.title || 'Floor Plan')}</div>
      <div class="subtitle">Generated ${new Date().toLocaleDateString()}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:6px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save PDF</button>
  </div>
  ${pages.join('')}
  ${assignmentPage}
</body>
</html>`
}

function openPrintWindow(html: string, width: number, height: number, autoPrint: boolean): void {
  const printHtml = autoPrint
    ? html.replace('</body>', '<script>window.addEventListener("load", function () { setTimeout(function () { try { window.focus(); window.print(); } catch (error) {} }, 300); });</script></body>')
    : html
  const blob = new Blob([printHtml], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', `width=${width},height=${height}`)
  if (!win) {
    alert('Popup blocked - please allow popups for this site.')
    URL.revokeObjectURL(url)
    return
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function sanitizeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) || /^[a-zA-Z]{2,30}$/.test(color) ? color : '#e2e8f0'
}

function paymentBadge(status: string): string {
  const labels: Record<string, string> = {
    paid: 'Paid',
    partial: 'Partial',
    unpaid: 'Unpaid',
    comped: 'Comped',
    unknown: '',
  }
  return labels[status] ?? ''
}

function paymentBackground(status: string): string {
  const colors: Record<string, string> = {
    paid: '#dcfce7',
    partial: '#fef3c7',
    unpaid: '#fee2e2',
    comped: '#ede9fe',
    unknown: '#f1f5f9',
  }
  return colors[status] ?? '#f1f5f9'
}

async function downloadSvgAsPng(svg: string, width: number, height: number, filename: string): Promise<void> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await loadImage(url)
    const preferredPixelRatio = width * height <= PNG_EXPORT_MAX_AREA_FOR_3X ? 3 : 2
    const dimensionRatioLimit = Math.min(
      PNG_EXPORT_MAX_CANVAS_DIMENSION / Math.max(width, 1),
      PNG_EXPORT_MAX_CANVAS_DIMENSION / Math.max(height, 1),
    )
    const areaRatioLimit = Math.sqrt(PNG_EXPORT_MAX_CANVAS_AREA / Math.max(width * height, 1))
    const pixelRatio = Math.max(1, Math.min(preferredPixelRatio, dimensionRatioLimit, areaRatioLimit))
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * pixelRatio)
    canvas.height = Math.ceil(height * pixelRatio)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  } catch {
    alert('Image export failed. Please try again.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}
