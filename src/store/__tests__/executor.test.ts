import { applyCommand, reverseCommand, type MutableCanvasState } from '../executor'
import type { CompositeRoom, Row, TableObject } from '@/domain/types'
import type { LayoutCommand } from '@/domain/commands'

function makeState(tables: Record<string, TableObject>): MutableCanvasState {
  return { tables, rows: {}, sections: {}, vendors: {}, vendorAssignments: {}, room: null, doors: {}, settings: { canvasWidth: 6000, canvasHeight: 4800, gridSize: 6, snapToGrid: true, snapToObjects: false, minAisleWidth: 36, doorClearance: 48, wallThickness: 6, wallSetback: 36, showWallSetback: false, defaultTableWidth: 72, defaultTableHeight: 30, defaultTableShape: 'rectangle', unitLabel: 'in', roomLocked: false } }
}

function makeTable(id: string, overrides: Partial<TableObject> = {}): TableObject {
  return {
    id:              id as any,
    roomId:          'R1',
    tableNumber:     1,
    displayId:       'R1-1',
    x:               0,
    y:               0,
    width:           60,
    height:          30,
    rotation:        0,
    shape:           'rectangle',
    label:           '1',
    labelOverridden: false,
    rowId:           null,
    sectionId:       null,
    order:           0,
    premium:         false,
    ...overrides,
  }
}

describe('executor — PLACE_TABLE', () => {
  it('apply adds the table', () => {
    const state = makeState({})
    const table = makeTable('t1')
    applyCommand(state, { type: 'PLACE_TABLE', table, timestamp: 0 })
    expect(state.tables['t1']).toEqual(table)
  })

  it('reverse removes the table', () => {
    const table = makeTable('t1')
    const state = makeState({ t1: table })
    reverseCommand(state, { type: 'PLACE_TABLE', table, timestamp: 0 })
    expect(state.tables['t1']).toBeUndefined()
  })
})

describe('executor — MOVE_TABLES', () => {
  it('apply moves tables to next position', () => {
    const table = makeTable('t1', { x: 0, y: 0 })
    const state = makeState({ t1: { ...table } })
    const cmd: LayoutCommand = {
      type: 'MOVE_TABLES',
      moves: [{ tableId: 't1' as any, prevX: 0, prevY: 0, nextX: 100, nextY: 50 }],
      timestamp: 0,
    }
    applyCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(100)
    expect(state.tables['t1'].y).toBe(50)
  })

  it('reverse restores previous position', () => {
    const table = makeTable('t1', { x: 100, y: 50 })
    const state = makeState({ t1: { ...table } })
    const cmd: LayoutCommand = {
      type: 'MOVE_TABLES',
      moves: [{ tableId: 't1' as any, prevX: 0, prevY: 0, nextX: 100, nextY: 50 }],
      timestamp: 0,
    }
    reverseCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(0)
    expect(state.tables['t1'].y).toBe(0)
  })
})

describe('executor — DELETE_TABLES', () => {
  it('apply removes tables', () => {
    const table = makeTable('t1')
    const state = makeState({ t1: { ...table } })
    applyCommand(state, { type: 'DELETE_TABLES', tables: [table], affectedAssignments: [], timestamp: 0 })
    expect(state.tables['t1']).toBeUndefined()
  })

  it('reverse restores deleted tables', () => {
    const table = makeTable('t1')
    const state = makeState({})
    reverseCommand(state, { type: 'DELETE_TABLES', tables: [table], affectedAssignments: [], timestamp: 0 })
    expect(state.tables['t1']).toEqual(table)
  })
})

describe('executor — UPDATE_ROW', () => {
  it('apply updates row metadata and table geometry', () => {
    const table = makeTable('t1', { x: 0, y: 0, rotation: 10, rowId: 'row-1' as any })
    const state = makeState({ t1: { ...table } })
    state.rows['row-1'] = {
      id: 'row-1' as any,
      sectionId: null,
      orientation: 'curved',
      tableCount: 1,
      tableWidth: 60,
      tableHeight: 30,
      spacing: 12,
      curveRadius: 120,
      curveCenterX: 100,
      curveCenterY: 100,
      curveMidAngle: 0,
      curveDirection: 'counterclockwise',
      createdAt: '2026-01-01T00:00:00.000Z',
    } satisfies Row

    applyCommand(state, {
      type: 'UPDATE_ROW',
      rowId: 'row-1' as any,
      prev: { spacing: 12, curveRadius: 120 },
      next: { spacing: 24, curveRadius: 180 },
      tableChanges: [{
        tableId: 't1' as any,
        prev: { x: 0, y: 0, rotation: 10 },
        next: { x: 40, y: 50, rotation: 25 },
      }],
      timestamp: 0,
    })

    expect(state.rows['row-1']).toMatchObject({ spacing: 24, curveRadius: 180 })
    expect(state.tables['t1']).toMatchObject({ x: 40, y: 50, rotation: 25 })
  })

  it('reverse restores row metadata and table geometry', () => {
    const table = makeTable('t1', { x: 40, y: 50, rotation: 25, rowId: 'row-1' as any })
    const state = makeState({ t1: { ...table } })
    state.rows['row-1'] = {
      id: 'row-1' as any,
      sectionId: null,
      orientation: 'curved',
      tableCount: 1,
      tableWidth: 60,
      tableHeight: 30,
      spacing: 24,
      curveRadius: 180,
      curveCenterX: 100,
      curveCenterY: 100,
      curveMidAngle: 0,
      curveDirection: 'counterclockwise',
      createdAt: '2026-01-01T00:00:00.000Z',
    } satisfies Row

    reverseCommand(state, {
      type: 'UPDATE_ROW',
      rowId: 'row-1' as any,
      prev: { spacing: 12, curveRadius: 120 },
      next: { spacing: 24, curveRadius: 180 },
      tableChanges: [{
        tableId: 't1' as any,
        prev: { x: 0, y: 0, rotation: 10 },
        next: { x: 40, y: 50, rotation: 25 },
      }],
      timestamp: 0,
    })

    expect(state.rows['row-1']).toMatchObject({ spacing: 12, curveRadius: 120 })
    expect(state.tables['t1']).toMatchObject({ x: 0, y: 0, rotation: 10 })
  })
})

describe('executor — RESIZE_TABLE', () => {
  it('apply sets next geometry', () => {
    const table = makeTable('t1', { x: 0, y: 0, width: 60, height: 30 })
    const state = makeState({ t1: { ...table } })
    applyCommand(state, {
      type: 'RESIZE_TABLE',
      tableId: 't1' as any,
      prev: { x: 0, y: 0, width: 60, height: 30 },
      next: { x: 5, y: 5, width: 80, height: 40 },
      timestamp: 0,
    })
    expect(state.tables['t1']).toMatchObject({ x: 5, y: 5, width: 80, height: 40 })
  })

  it('reverse restores prev geometry', () => {
    const table = makeTable('t1', { x: 5, y: 5, width: 80, height: 40 })
    const state = makeState({ t1: { ...table } })
    reverseCommand(state, {
      type: 'RESIZE_TABLE',
      tableId: 't1' as any,
      prev: { x: 0, y: 0, width: 60, height: 30 },
      next: { x: 5, y: 5, width: 80, height: 40 },
      timestamp: 0,
    })
    expect(state.tables['t1']).toMatchObject({ x: 0, y: 0, width: 60, height: 30 })
  })
})

describe('executor — DELETE_ROOM_SEGMENT', () => {
  it('keeps circular rooms when deleting the last rectangular segment', () => {
    const state = makeState({})
    const segment = { id: 'seg-1' as any, x: 0, y: 0, width: 120, height: 120 }
    const circle = { id: 'circle-1' as any, x: 240, y: 240, radiusX: 60, radiusY: 60 }
    state.room = {
      segments: [{ ...segment }],
      circles: [{ ...circle }],
      freehandVertices: null,
      roomLabels: { R1: 'Circle Hall' },
    } satisfies CompositeRoom

    applyCommand(state, {
      type: 'DELETE_ROOM_SEGMENT',
      segment,
      timestamp: 0,
    })

    expect(state.room).not.toBeNull()
    expect(state.room?.segments).toEqual([])
    expect(state.room?.circles).toEqual([{ ...circle }])
  })
})

describe('undo/redo integration', () => {
  it('apply then reverse restores original state exactly', () => {
    const table = makeTable('t1', { x: 0, y: 0 })
    const state = makeState({ t1: { ...table } })
    const cmd: LayoutCommand = {
      type: 'MOVE_TABLES',
      moves: [{ tableId: 't1' as any, prevX: 0, prevY: 0, nextX: 100, nextY: 50 }],
      timestamp: 0,
    }
    applyCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(100)
    reverseCommand(state, cmd)
    expect(state.tables['t1'].x).toBe(0)
    expect(state.tables['t1'].y).toBe(0)
  })
})
