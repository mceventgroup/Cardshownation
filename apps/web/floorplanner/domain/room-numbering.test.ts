import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAllSectionRenumberChanges, buildSectionRenumberChanges, getNextSectionName, getRoomIdForTable, getSectionPrefix, getTableCenter, getNumberingStartTables, sortTablesForRoom } from './room-numbering'
import type { CompositeRoom, RoomSegmentId, Section, SectionId, TableId, TableObject } from './types'

function tableId(value: string): TableId {
  return value as TableId
}

function sectionId(value: string): SectionId {
  return value as SectionId
}

function roomSegmentId(value: string): RoomSegmentId {
  return value as RoomSegmentId
}

function createTable(
  id: string,
  x: number,
  y: number,
  roomId: string,
  currentLabel = id,
): TableObject {
  return {
    id: tableId(id),
    roomId,
    tableNumber: 0,
    displayId: currentLabel,
    x,
    y,
    width: 20,
    height: 20,
    rotation: 0,
    shape: 'rectangle',
    label: currentLabel,
    labelOverridden: false,
    rowId: null,
    sectionId: sectionId('section-a'),
    order: 0,
    premium: false,
  }
}

test('section renumbering keeps separate room zones grouped in room order', () => {
  const room: CompositeRoom = {
    segments: [
      { id: roomSegmentId('room-left'), x: 0, y: 0, width: 120, height: 200 },
      { id: roomSegmentId('room-right'), x: 260, y: 0, width: 120, height: 200 },
    ],
    circles: [],
    freehandVertices: null,
    roomLabels: { R1: 'Left', R2: 'Right' },
  }

  const section: Section = {
    id: sectionId('section-a'),
    name: 'Alpha',
    color: '#22c55e',
    order: 0,
  }

  const tables: Record<string, TableObject> = {
    leftTop: createTable('leftTop', 10, 10, 'R1'),
    leftBottom: createTable('leftBottom', 10, 150, 'R1'),
    rightTop: createTable('rightTop', 270, 10, 'R2'),
    rightBottom: createTable('rightBottom', 270, 150, 'R2'),
  }

  const changes = buildSectionRenumberChanges(
    tables,
    { [section.id]: section },
    section.id,
    'cw',
    room,
  )

  assert.deepEqual(
    changes.map(change => [change.tableId, change.next.displayId]),
    [
      [tableId('leftTop'), 'A01'],
      [tableId('leftBottom'), 'A02'],
      [tableId('rightTop'), 'A03'],
      [tableId('rightBottom'), 'A04'],
    ],
  )
})


test('unassigned tables use unique plain numbers across rooms and area assignments keep prefixes', async () => {
  const { syncRoomFieldsForTables } = await import('./room-numbering')
  const a = { ...createTable('a', 0, 0, 'R1', 'Main Room01'), sectionId: null }
  const b = { ...createTable('b', 200, 0, 'R2', 'Side Room01'), sectionId: null }
  const result = syncRoomFieldsForTables({ a, b }, null)
  assert.deepEqual(Object.values(result).map(table => table.displayId).sort(), ['1', '2'])
})

const squareZone = {
  bounds: { x: 0, y: 0, width: 600, height: 600 },
  polygon: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }, { x: 0, y: 600 }],
}

test('a chosen outer starting table rotates only the first ring and inner starts are ignored', () => {
  const tables = Array.from({ length: 9 }, (_, index) => createTable(String(index), 50 + index % 3 * 100, 50 + Math.floor(index / 3) * 100, 'R1'))
  assert.deepEqual(sortTablesForRoom(tables, squareZone, 'cw', tables[2]).map(table => table.id), ['2', '5', '8', '7', '6', '3', '0', '1', '4'])
  assert.deepEqual(sortTablesForRoom(tables, squareZone, 'ccw', tables[2]).map(table => table.id), ['2', '1', '0', '3', '6', '7', '8', '5', '4'])
  assert.deepEqual(sortTablesForRoom(tables, squareZone, 'cw', tables[4]), sortTablesForRoom(tables, squareZone))
  assert.equal(getNumberingStartTables(tables, null).some(table => table.id === '4'), false)
  assert.equal(getNumberingStartTables(tables, null).length, 8)
})

test('straight wall subdivisions, duplicate endpoints and reversed outlines preserve numbering', () => {
  const tables = Array.from({ length: 25 }, (_, index) => createTable(String(index), 40 + index % 5 * 110, 40 + Math.floor(index / 5) * 80, 'R1'))
  const polygon = [
    { x: 0, y: 0 }, { x: 150, y: 0 }, { x: 300, y: 0 }, { x: 600, y: 0 },
    { x: 600, y: 300 }, { x: 600, y: 600 }, { x: 300, y: 600 }, { x: 0, y: 600 },
    { x: 0, y: 300 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ]
  for (const direction of ['cw', 'ccw'] as const) {
    const expected = sortTablesForRoom(tables, squareZone, direction).map(table => table.id)
    for (const outline of [polygon, [...polygon].reverse()]) {
      assert.deepEqual(sortTablesForRoom([...tables].reverse(), { ...squareZone, polygon: outline }, direction).map(table => table.id), expected)
    }
  }
})

test('curved rows inside a rectangular room follow adjacent tables and finish outer rings first', () => {
  for (const radiusYScale of [1, 0.65]) {
    const tables = [240, 140, 60].flatMap((radius, layer) => Array.from({ length: 8 }, (_, index) => {
      const angle = index * Math.PI / 4 - Math.PI / 2
      return createTable(`${layer}-${index}`, 290 + radius * Math.cos(angle), 290 + radiusYScale * radius * Math.sin(angle), 'R1')
    }))
    const expected = tables.map(table => table.id)
    assert.deepEqual(sortTablesForRoom([...tables].reverse(), squareZone).map(table => table.id), expected)
    assert.deepEqual(sortTablesForRoom(tables).map(table => table.id), expected)
    const ccw = [0, 1, 2].flatMap(layer => [0, 7, 6, 5, 4, 3, 2, 1].map(index => `${layer}-${index}`))
    assert.deepEqual(sortTablesForRoom(tables, squareZone, 'ccw').map(table => table.id), ccw)
  }
})

test('straight outer rows finish before curved inner rows and a final center table', () => {
  const outer = [[30, 30], [290, 30], [550, 30], [550, 290], [550, 550], [290, 550], [30, 550], [30, 290]]
    .map(([x, y], index) => createTable(`outer-${index}`, x, y, 'R1'))
  const inner = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4 - Math.PI / 2
    return createTable(`inner-${index}`, 290 + 150 * Math.cos(angle), 290 + 150 * Math.sin(angle), 'R1')
  })
  const tables = [...outer, ...inner, createTable('center', 290, 290, 'R1')]
  assert.deepEqual(sortTablesForRoom([...tables].reverse(), squareZone).map(table => table.id), tables.map(table => table.id))
})

test('simplifying extra wall points preserves an L-shaped room indentation', () => {
  const polygon = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 200 }, { x: 200, y: 200 }, { x: 200, y: 600 }, { x: 0, y: 600 }]
  const subdivided = polygon.flatMap((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return [point, { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }]
  })
  const tables = [[30, 30], [300, 30], [570, 100], [400, 170], [170, 300], [100, 570], [30, 300]]
    .map(([x, y], index) => createTable(String(index), x - 10, y - 10, 'R1'))
  for (const outline of [polygon, subdivided, [...subdivided].reverse()]) {
    assert.deepEqual(sortTablesForRoom([...tables].reverse(), { ...squareZone, polygon: outline }).map(table => table.id), tables.map(table => table.id))
  }
})

test('clockwise numbering completes each rectangular ring despite uneven aisle spacing and small offsets', () => {
  const tables = Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5)
    const col = index % 5
    return createTable(`${row},${col}`, 40 + col * 110, 40 + row * 80 + (col === 2 ? 3 : 0), 'R1')
  })
  const expected = [
    '0,0', '0,1', '0,2', '0,3', '0,4', '1,4', '2,4', '3,4', '4,4', '4,3', '4,2', '4,1', '4,0', '3,0', '2,0', '1,0',
    '1,1', '1,2', '1,3', '2,3', '3,3', '3,2', '3,1', '2,1', '2,2',
  ]
  assert.deepEqual(sortTablesForRoom([...tables].reverse(), squareZone).map(table => table.id), expected)
  assert.deepEqual(sortTablesForRoom(tables, { ...squareZone, polygon: [...squareZone.polygon].reverse() }).map(table => table.id), expected)
  assert.deepEqual(sortTablesForRoom(tables).map(table => table.id), expected)
  const counterclockwise = [expected[0], ...expected.slice(1, 16).reverse(), expected[16], ...expected.slice(17, 24).reverse(), expected[24]]
  assert.deepEqual(sortTablesForRoom(tables, squareZone, 'ccw').map(table => table.id), counterclockwise)
})

test('circular outlines keep each ring together regardless of outline winding', () => {
  const polygon = Array.from({ length: 64 }, (_, index) => {
    const angle = index * Math.PI / 32 - Math.PI / 2
    return { x: 300 + 300 * Math.cos(angle), y: 300 + 300 * Math.sin(angle) }
  })
  const tables = [260, 160, 60].flatMap((radius, layer) => Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4 - Math.PI / 2
    return createTable(`${layer}-${index}`, 290 + radius * Math.cos(angle), 290 + radius * Math.sin(angle), 'R1')
  }))
  const zone = { ...squareZone, polygon }
  const expected = tables.map(table => table.id)
  assert.deepEqual(sortTablesForRoom(tables, zone).map(table => table.id), expected)
  assert.deepEqual(sortTablesForRoom(tables, { ...zone, polygon: [...polygon].reverse() }).map(table => table.id), expected)
})

test('rotated tables use their rendered centers for room membership and ordering', () => {
  const table = { ...createTable('rotated', 110, 20, 'R1'), width: 80, rotation: 90 }
  assert.deepEqual(getTableCenter(table), { x: 100, y: 60 })
  assert.equal(getRoomIdForTable(table, { segments: [{ id: roomSegmentId('hall'), x: 0, y: 0, width: 120, height: 120 }], circles: [], freehandVertices: null }), 'R1')
})

test('new section names avoid existing prefixes after deletion and continue beyond Z', () => {
  const section = { id: sectionId('b'), name: 'Section B', color: '#000000', order: 1 }
  assert.equal(getNextSectionName({ b: section }), 'Section A')
  const sections = Object.fromEntries(Array.from({ length: 26 }, (_, index) => [String(index), { ...section, name: `Section ${String.fromCharCode(65 + index)}` }]))
  assert.equal(getNextSectionName(sections), 'Section AA')
  assert.equal(getSectionPrefix('Section AA'), 'AA')
})

test('different table sizes do not move the first corner table to the end of its ring', () => {
  const tables = [createTable('tl', 40, 10, 'R1'), createTable('tr', 440, 40, 'R1'),
    createTable('br', 440, 440, 'R1'), createTable('bl', 40, 440, 'R1')]
  tables[0].height = 80
  assert.deepEqual(sortTablesForRoom(tables, squareZone).map(table => table.id), ['tl', 'tr', 'br', 'bl'])
})

test('closed outlines do not assign every table to the first room', () => {
  const room: CompositeRoom = { segments: [], circles: [], freehandVertices: [...squareZone.polygon, squareZone.polygon[0]] }
  assert.equal(getRoomIdForTable(createTable('outside', 700, 700, 'R1'), room), null)
  assert.equal(getRoomIdForTable(createTable('inside', 30, 30, 'R1'), room), 'R1')
})

test('duplicate section initials and numerical section names keep display IDs unique', () => {
  const sections: Record<string, Section> = Object.fromEntries(['Alpha', 'Art', 'Section 1'].map((name, order) => [String(order), { id: sectionId(String(order)), name, order, color: '#000000' }]))
  const tables = Object.fromEntries(Object.keys(sections).map(id => [id, { ...createTable(id, 30, 30, 'R1'), sectionId: sectionId(id) }]))
  const changes = buildAllSectionRenumberChanges(tables, sections, null, 'cw')
  assert.deepEqual(changes.map(change => change.next.displayId), ['A01', 'A2-01', '1-01'])
  const sectionChanges = buildSectionRenumberChanges(tables, sections, '1', 'cw')
  assert.equal(sectionChanges[0].next.displayId, 'A2-01')
})

test('numbered section names cannot collide with three-digit table numbers in another section', () => {
  const sections: Record<string, Section> = {
    a: { id: sectionId('a'), name: 'Section A', order: 0, color: '#000000' },
    a1: { id: sectionId('a1'), name: 'Section A1', order: 1, color: '#000000' },
  }
  const tables = Object.fromEntries(Array.from({ length: 101 }, (_, index) => {
    const table = { ...createTable(`a${index}`, index * 30, 0, 'R1'), sectionId: sectionId('a') }
    return [table.id, table]
  }))
  tables.extra = { ...createTable('extra', 0, 60, 'R1'), sectionId: sectionId('a1') }
  const labels = buildAllSectionRenumberChanges(tables, sections, null, 'cw').map(change => change.next.displayId)
  assert.ok(labels.includes('A101'))
  assert.ok(labels.includes('A1-01'))
  assert.equal(new Set(labels).size, 102)
})
