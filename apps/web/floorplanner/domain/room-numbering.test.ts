import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSectionRenumberChanges } from './room-numbering'
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
