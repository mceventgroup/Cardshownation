import type {
  BackgroundImage,
  CompositeRoom,
  Door,
  LayoutSettings,
  Point,
  Row,
  Section,
  TableObject,
  Vendor,
  VendorAssignment,
} from '@floorplanner/domain/types'
import type { DocumentSlice } from '@floorplanner/lib/persistence'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as UnknownRecord
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  return value
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`)
  }
  return value
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`)
  return value
}

function expectNullableString(value: unknown, label: string): string | null {
  if (value === null) return null
  return expectString(value, label)
}

function expectPoint(value: unknown, label: string): Point {
  const record = asRecord(value, label)
  return {
    x: expectNumber(record.x, `${label}.x`),
    y: expectNumber(record.y, `${label}.y`),
  }
}

function validateMap<T>(
  value: unknown,
  label: string,
  parse: (entry: unknown, entryLabel: string) => T,
): Record<string, T> {
  const record = asRecord(value, label)
  const next: Record<string, T> = {}
  for (const [key, entry] of Object.entries(record)) {
    next[key] = parse(entry, `${label}.${key}`)
  }
  return next
}

function parseTable(value: unknown, label: string): TableObject {
  const record = asRecord(value, label)
  return {
    id: expectString(record.id, `${label}.id`) as TableObject['id'],
    roomId: expectString(record.roomId, `${label}.roomId`),
    tableNumber: expectNumber(record.tableNumber, `${label}.tableNumber`),
    displayId: expectString(record.displayId, `${label}.displayId`),
    x: expectNumber(record.x, `${label}.x`),
    y: expectNumber(record.y, `${label}.y`),
    width: expectNumber(record.width, `${label}.width`),
    height: expectNumber(record.height, `${label}.height`),
    rotation: expectNumber(record.rotation, `${label}.rotation`),
    shape: expectString(record.shape, `${label}.shape`) as TableObject['shape'],
    label: expectString(record.label, `${label}.label`),
    labelOverridden: expectBoolean(record.labelOverridden, `${label}.labelOverridden`),
    rowId: record.rowId === null ? null : expectString(record.rowId, `${label}.rowId`) as TableObject['rowId'],
    sectionId: record.sectionId === null ? null : expectString(record.sectionId, `${label}.sectionId`) as TableObject['sectionId'],
    order: expectNumber(record.order, `${label}.order`),
    premium: expectBoolean(record.premium, `${label}.premium`),
  }
}

function parseRow(value: unknown, label: string): Row {
  const record = asRecord(value, label)
  return {
    id: expectString(record.id, `${label}.id`) as Row['id'],
    sectionId: record.sectionId === null ? null : expectString(record.sectionId, `${label}.sectionId`) as Row['sectionId'],
    orientation: expectString(record.orientation, `${label}.orientation`) as Row['orientation'],
    tableCount: expectNumber(record.tableCount, `${label}.tableCount`),
    tableWidth: expectNumber(record.tableWidth, `${label}.tableWidth`),
    tableHeight: expectNumber(record.tableHeight, `${label}.tableHeight`),
    spacing: expectNumber(record.spacing, `${label}.spacing`),
    curveRadius: record.curveRadius === undefined ? undefined : expectNumber(record.curveRadius, `${label}.curveRadius`),
    curveCenterX: record.curveCenterX === undefined ? undefined : expectNumber(record.curveCenterX, `${label}.curveCenterX`),
    curveCenterY: record.curveCenterY === undefined ? undefined : expectNumber(record.curveCenterY, `${label}.curveCenterY`),
    curveMidAngle: record.curveMidAngle === undefined ? undefined : expectNumber(record.curveMidAngle, `${label}.curveMidAngle`),
    curveDirection: record.curveDirection === undefined ? undefined : expectString(record.curveDirection, `${label}.curveDirection`) as Row['curveDirection'],
    createdAt: expectString(record.createdAt, `${label}.createdAt`),
  }
}

function parseSection(value: unknown, label: string): Section {
  const record = asRecord(value, label)
  return {
    id: expectString(record.id, `${label}.id`) as Section['id'],
    name: expectString(record.name, `${label}.name`),
    color: expectString(record.color, `${label}.color`),
    order: expectNumber(record.order, `${label}.order`),
  }
}

function parseVendor(value: unknown, label: string): Vendor {
  const record = asRecord(value, label)
  return {
    id: expectString(record.id, `${label}.id`) as Vendor['id'],
    name: expectString(record.name, `${label}.name`),
    firstName: record.firstName === undefined ? undefined : expectNullableString(record.firstName, `${label}.firstName`),
    lastName: record.lastName === undefined ? undefined : expectNullableString(record.lastName, `${label}.lastName`),
    companyName: record.companyName === undefined ? undefined : expectNullableString(record.companyName, `${label}.companyName`),
    email: record.email === undefined ? undefined : expectNullableString(record.email, `${label}.email`),
    tablesNeeded: expectNumber(record.tablesNeeded, `${label}.tablesNeeded`),
    tableSize: record.tableSize === undefined ? undefined : expectNullableString(record.tableSize, `${label}.tableSize`),
    inventory: record.inventory === undefined ? undefined : expectNullableString(record.inventory, `${label}.inventory`),
    category: expectNullableString(record.category, `${label}.category`),
    paymentStatus: expectString(record.paymentStatus, `${label}.paymentStatus`) as Vendor['paymentStatus'],
    notes: expectNullableString(record.notes, `${label}.notes`),
    premium: expectBoolean(record.premium, `${label}.premium`),
    cases: expectNumber(record.cases, `${label}.cases`),
  }
}

function parseVendorAssignment(value: unknown, label: string): VendorAssignment {
  const record = asRecord(value, label)
  return {
    id: expectString(record.id, `${label}.id`) as VendorAssignment['id'],
    tableId: expectString(record.tableId, `${label}.tableId`) as VendorAssignment['tableId'],
    layoutId: expectString(record.layoutId, `${label}.layoutId`) as VendorAssignment['layoutId'],
    vendorId: expectString(record.vendorId, `${label}.vendorId`) as VendorAssignment['vendorId'],
    vendorName: expectString(record.vendorName, `${label}.vendorName`),
    vendorCategory: expectNullableString(record.vendorCategory, `${label}.vendorCategory`),
    colorOverride: expectNullableString(record.colorOverride, `${label}.colorOverride`),
    notes: expectNullableString(record.notes, `${label}.notes`),
    paymentStatus: expectString(record.paymentStatus, `${label}.paymentStatus`) as VendorAssignment['paymentStatus'],
    importSessionId: record.importSessionId === null ? null : expectString(record.importSessionId, `${label}.importSessionId`) as VendorAssignment['importSessionId'],
  }
}

function parseDoor(value: unknown, label: string): Door {
  const record = asRecord(value, label)
  return {
    id: expectString(record.id, `${label}.id`) as Door['id'],
    label: expectString(record.label, `${label}.label`),
    x: expectNumber(record.x, `${label}.x`),
    y: expectNumber(record.y, `${label}.y`),
    width: expectNumber(record.width, `${label}.width`),
    side: expectString(record.side, `${label}.side`) as Door['side'],
    kind: expectString(record.kind, `${label}.kind`) as Door['kind'],
  }
}

function parseBackgroundImage(value: unknown, label: string): BackgroundImage {
  const record = asRecord(value, label)
  return {
    id: expectString(record.id, `${label}.id`) as BackgroundImage['id'],
    name: expectString(record.name, `${label}.name`),
    dataUrl: expectString(record.dataUrl, `${label}.dataUrl`),
    x: expectNumber(record.x, `${label}.x`),
    y: expectNumber(record.y, `${label}.y`),
    width: expectNumber(record.width, `${label}.width`),
    height: expectNumber(record.height, `${label}.height`),
    opacity: expectNumber(record.opacity, `${label}.opacity`),
    locked: expectBoolean(record.locked, `${label}.locked`),
    visible: expectBoolean(record.visible, `${label}.visible`),
    order: expectNumber(record.order, `${label}.order`),
  }
}

function parseRoom(value: unknown, label: string): CompositeRoom | null {
  if (value === null) return null
  const record = asRecord(value, label)
  const segmentsRaw = record.segments
  if (!Array.isArray(segmentsRaw)) throw new Error(`${label}.segments must be an array.`)
  const segments = segmentsRaw.map((segment, index) => {
    const entry = asRecord(segment, `${label}.segments[${index}]`)
    return {
      id: expectString(entry.id, `${label}.segments[${index}].id`) as CompositeRoom['segments'][number]['id'],
      x: expectNumber(entry.x, `${label}.segments[${index}].x`),
      y: expectNumber(entry.y, `${label}.segments[${index}].y`),
      width: expectNumber(entry.width, `${label}.segments[${index}].width`),
      height: expectNumber(entry.height, `${label}.segments[${index}].height`),
    }
  })

  const circlesRaw = record.circles
  const circles = circlesRaw === undefined
    ? undefined
    : Array.isArray(circlesRaw)
      ? circlesRaw.map((circle, index) => {
        const entry = asRecord(circle, `${label}.circles[${index}]`)
        return {
          id: expectString(entry.id, `${label}.circles[${index}].id`) as never,
          x: expectNumber(entry.x, `${label}.circles[${index}].x`),
          y: expectNumber(entry.y, `${label}.circles[${index}].y`),
          radiusX: expectNumber(entry.radiusX, `${label}.circles[${index}].radiusX`),
          radiusY: expectNumber(entry.radiusY, `${label}.circles[${index}].radiusY`),
        }
      })
      : (() => { throw new Error(`${label}.circles must be an array.`) })()

  const freehandVerticesRaw = record.freehandVertices
  const freehandVertices = freehandVerticesRaw === null
    ? null
    : Array.isArray(freehandVerticesRaw)
      ? freehandVerticesRaw.map((point, index) => expectPoint(point, `${label}.freehandVertices[${index}]`))
      : (() => { throw new Error(`${label}.freehandVertices must be null or an array.`) })()

  let roomLabels: Record<string, string> | undefined
  if (record.roomLabels !== undefined) {
    roomLabels = {}
    for (const [key, roomLabel] of Object.entries(asRecord(record.roomLabels, `${label}.roomLabels`))) {
      roomLabels[key] = expectString(roomLabel, `${label}.roomLabels.${key}`)
    }
  }

  return {
    segments,
    circles,
    freehandVertices,
    roomLabels,
  }
}

function parseSettings(value: unknown, label: string): LayoutSettings {
  const record = asRecord(value, label)
  return {
    canvasWidth: expectNumber(record.canvasWidth, `${label}.canvasWidth`),
    canvasHeight: expectNumber(record.canvasHeight, `${label}.canvasHeight`),
    gridSize: expectNumber(record.gridSize, `${label}.gridSize`),
    snapToGrid: expectBoolean(record.snapToGrid, `${label}.snapToGrid`),
    snapToObjects: expectBoolean(record.snapToObjects, `${label}.snapToObjects`),
    minAisleWidth: expectNumber(record.minAisleWidth, `${label}.minAisleWidth`),
    doorClearance: expectNumber(record.doorClearance, `${label}.doorClearance`),
    wallThickness: expectNumber(record.wallThickness, `${label}.wallThickness`),
    wallSetback: expectNumber(record.wallSetback, `${label}.wallSetback`),
    showWallSetback: expectBoolean(record.showWallSetback, `${label}.showWallSetback`),
    vendorColorCoding: expectBoolean(record.vendorColorCoding, `${label}.vendorColorCoding`),
    roomLocked: expectBoolean(record.roomLocked, `${label}.roomLocked`),
    defaultTableWidth: expectNumber(record.defaultTableWidth, `${label}.defaultTableWidth`),
    defaultTableHeight: expectNumber(record.defaultTableHeight, `${label}.defaultTableHeight`),
    defaultTableShape: expectString(record.defaultTableShape, `${label}.defaultTableShape`) as LayoutSettings['defaultTableShape'],
    unitLabel: expectString(record.unitLabel, `${label}.unitLabel`),
    eventName: expectString(record.eventName, `${label}.eventName`),
    eventDate: expectString(record.eventDate, `${label}.eventDate`),
    upcomingShow1Date: expectString(record.upcomingShow1Date, `${label}.upcomingShow1Date`),
    upcomingShow1Location: expectString(record.upcomingShow1Location, `${label}.upcomingShow1Location`),
    upcomingShow2Date: expectString(record.upcomingShow2Date, `${label}.upcomingShow2Date`),
    upcomingShow2Location: expectString(record.upcomingShow2Location, `${label}.upcomingShow2Location`),
    upcomingShow3Date: expectString(record.upcomingShow3Date, `${label}.upcomingShow3Date`),
    upcomingShow3Location: expectString(record.upcomingShow3Location, `${label}.upcomingShow3Location`),
  }
}

export function validateDocumentSlice(value: unknown): DocumentSlice {
  const record = asRecord(value, 'Layout data')
  return {
    tables: validateMap(record.tables, 'Layout data.tables', parseTable),
    rows: validateMap(record.rows, 'Layout data.rows', parseRow),
    sections: validateMap(record.sections, 'Layout data.sections', parseSection),
    vendors: validateMap(record.vendors, 'Layout data.vendors', parseVendor),
    vendorAssignments: validateMap(record.vendorAssignments, 'Layout data.vendorAssignments', parseVendorAssignment),
    room: parseRoom(record.room, 'Layout data.room'),
    doors: validateMap(record.doors, 'Layout data.doors', parseDoor),
    settings: parseSettings(record.settings, 'Layout data.settings'),
    backgroundImages: validateMap(record.backgroundImages, 'Layout data.backgroundImages', parseBackgroundImage),
  }
}
