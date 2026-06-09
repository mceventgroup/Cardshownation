import { syncRoomFieldsForTables } from '@/domain/room-numbering'
import type { CompositeRoom, TableId, TableObject } from '@/domain/types'

function makeTable(id: string, overrides: Partial<TableObject> = {}): TableObject {
  return {
    id: id as TableId,
    roomId: 'R1',
    tableNumber: 1,
    displayId: 'R1-1',
    x: 20,
    y: 20,
    width: 40,
    height: 20,
    rotation: 0,
    shape: 'rectangle',
    label: 'R1-1',
    labelOverridden: false,
    rowId: null,
    sectionId: null,
    order: 0,
    premium: false,
    ...overrides,
  }
}

describe('syncRoomFieldsForTables', () => {
  it('updates roomId when a table moves into a different room zone', () => {
    const room: CompositeRoom = {
      segments: [
        { id: 'seg-1' as any, x: 0, y: 0, width: 100, height: 100 },
        { id: 'seg-2' as any, x: 200, y: 0, width: 100, height: 100 },
      ],
      circles: [],
      freehandVertices: null,
      roomLabels: {},
    }

    const tables = {
      t1: makeTable('t1', {
        roomId: 'R1',
        x: 220,
        y: 20,
      }),
    }

    const synced = syncRoomFieldsForTables(tables, room, {})
    expect(synced.t1.roomId).toBe('R2')
    expect(synced.t1.displayId.startsWith('R2')).toBe(true)
  })
})
