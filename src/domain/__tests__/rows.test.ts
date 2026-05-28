import { rowModule } from '@/domain/rows.impl'

describe('row module curved rows', () => {
  it('builds a curved row with tangent rotations and centered placement', () => {
    const result = rowModule.buildRow(
      {
        roomId: 'R1',
        tableCount: 3,
        tableWidth: 72,
        tableHeight: 30,
        spacing: 12,
        orientation: 'curved',
        origin: { x: 120, y: 40 },
        curveRadius: 120,
        curveCenter: { x: 120, y: 160 },
        curveMidAngle: -Math.PI / 2,
        curveDirection: 'counterclockwise',
        sectionId: null,
        numberingScheme: { style: 'sequential', prefix: '', separator: '-', startNumber: 1, padToDigits: 0, direction: 'ltr' },
        startLabel: '1',
      },
      'row-1' as never,
    )

    expect(result.row.orientation).toBe('curved')
    expect(result.row.curveRadius).toBe(120)
    expect(result.tables).toHaveLength(3)
    expect(result.tables[1].rotation).toBe(0)
    expect(result.tables[0].rotation).toBeGreaterThan(300)
    expect(result.tables[2].rotation).toBeGreaterThan(result.tables[1].rotation)
    expect(result.tables[1].x).toBeCloseTo(84, 0)
  })
})
