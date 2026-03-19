import { geometry } from '../geometry.impl'
import type { TableObject } from '../types'

function makeTable(overrides: Partial<TableObject> = {}): TableObject {
  return {
    id:              'test-id' as any,
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
    ...overrides,
  }
}

describe('geometry.getBounds', () => {
  it('returns exact rect for unrotated table', () => {
    const t = makeTable({ x: 10, y: 20, width: 60, height: 30 })
    const { bounds } = geometry.getBounds(t)
    expect(bounds).toEqual({ x: 10, y: 20, width: 60, height: 30 })
  })

  it('AABB is larger than original for rotated table', () => {
    const t = makeTable({ x: 0, y: 0, width: 60, height: 30, rotation: 45 })
    const { bounds } = geometry.getBounds(t)
    expect(bounds.width).toBeGreaterThan(60)
    expect(bounds.height).toBeGreaterThan(30)
  })

  it('returns 4 rotated corners', () => {
    const t = makeTable({ x: 0, y: 0, width: 60, height: 30, rotation: 0 })
    const { rotatedCorners } = geometry.getBounds(t)
    expect(rotatedCorners).toHaveLength(4)
    // TL should be at (0, 0) for unrotated
    expect(rotatedCorners[0].x).toBeCloseTo(0)
    expect(rotatedCorners[0].y).toBeCloseTo(0)
  })
})

describe('geometry.checkOverlap', () => {
  it('returns false for tables with a clear gap', () => {
    const a = makeTable({ x: 0,   y: 0, width: 60, height: 30 })
    const b = makeTable({ x: 100, y: 0, width: 60, height: 30 })
    expect(geometry.checkOverlap(a, b).overlaps).toBe(false)
  })

  it('returns true for overlapping tables', () => {
    const a = makeTable({ x: 0,  y: 0, width: 60, height: 30 })
    const b = makeTable({ x: 30, y: 0, width: 60, height: 30 })
    expect(geometry.checkOverlap(a, b).overlaps).toBe(true)
  })

  it('returns false for tables that share only an edge (touching)', () => {
    const a = makeTable({ x: 0,  y: 0, width: 60, height: 30 })
    const b = makeTable({ x: 60, y: 0, width: 60, height: 30 })
    // Edge-touching: max of a == min of b; SAT uses strict inequality
    expect(geometry.checkOverlap(a, b).overlaps).toBe(false)
  })

  it('returns false for tables that are vertically separated', () => {
    const a = makeTable({ x: 0, y: 0,   width: 60, height: 30 })
    const b = makeTable({ x: 0, y: 100, width: 60, height: 30 })
    expect(geometry.checkOverlap(a, b).overlaps).toBe(false)
  })

  it('handles rotated non-overlapping tables', () => {
    const a = makeTable({ x: 0,   y: 0, width: 60, height: 10, rotation: 45 })
    const b = makeTable({ x: 200, y: 0, width: 60, height: 10, rotation: 45 })
    expect(geometry.checkOverlap(a, b).overlaps).toBe(false)
  })
})

describe('geometry.findAllOverlaps', () => {
  it('returns empty array when no tables overlap', () => {
    const tables = [
      makeTable({ id: 'a' as any, x: 0   }),
      makeTable({ id: 'b' as any, x: 100 }),
      makeTable({ id: 'c' as any, x: 200 }),
    ]
    expect(geometry.findAllOverlaps(tables)).toHaveLength(0)
  })

  it('finds one pair when two tables overlap', () => {
    const tables = [
      makeTable({ id: 'a' as any, x: 0  }),
      makeTable({ id: 'b' as any, x: 30 }),   // overlaps a
      makeTable({ id: 'c' as any, x: 200 }),  // clear of both
    ]
    expect(geometry.findAllOverlaps(tables)).toHaveLength(1)
  })

  it('does not double-count pairs', () => {
    const tables = [
      makeTable({ id: 'a' as any, x: 0 }),
      makeTable({ id: 'b' as any, x: 0 }),  // overlaps a
    ]
    const overlaps = geometry.findAllOverlaps(tables)
    expect(overlaps).toHaveLength(1)
    // Should be (a, b) not (a,b) AND (b,a)
  })
})

describe('geometry.normalizeRect', () => {
  it('normalizes a rect with negative width/height', () => {
    const result = geometry.normalizeRect({ x: 100, y: 100, width: -60, height: -30 })
    expect(result).toEqual({ x: 40, y: 70, width: 60, height: 30 })
  })

  it('passes through a positive rect unchanged', () => {
    const rect = { x: 10, y: 20, width: 60, height: 30 }
    expect(geometry.normalizeRect(rect)).toEqual(rect)
  })
})

describe('geometry.unionBounds', () => {
  it('returns a zero rect for empty input', () => {
    expect(geometry.unionBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('returns the union of multiple rects', () => {
    const result = geometry.unionBounds([
      { x: 0, y: 0, width: 60, height: 30 },
      { x: 100, y: 50, width: 60, height: 30 },
    ])
    expect(result).toEqual({ x: 0, y: 0, width: 160, height: 80 })
  })
})
