import { computeRoomContour } from '@/domain/room-contour'
import { getRoomZones } from '@/domain/room-numbering'
import { applyRoomSplit, buildRoomSplitPreview, findRoomSegmentAtPoint, getRoomSplitGap } from '@/domain/room-splitting'
import type { CompositeRoom } from '@/domain/types'

describe('room splitting', () => {
  const room: CompositeRoom = {
    segments: [
      {
        id: 'segment-1' as never,
        x: 0,
        y: 0,
        width: 120,
        height: 72,
      },
    ],
    circles: [],
    freehandVertices: null,
    roomLabels: { R1: 'Main Room' },
  }

  it('finds the topmost rectangular segment under the pointer', () => {
    expect(findRoomSegmentAtPoint(room, { x: 60, y: 36 })?.id).toBe('segment-1')
    expect(findRoomSegmentAtPoint(room, { x: 240, y: 36 })).toBeNull()
  })

  it('builds a vertical split preview snapped to opposite walls', () => {
    const preview = buildRoomSplitPreview(
      room.segments[0],
      { x: 60, y: 20 },
      { x: 62, y: 70 },
      6,
      6,
    )

    expect(preview).not.toBeNull()
    expect(preview?.orientation).toBe('vertical')
    expect(preview?.lineStart).toEqual({ x: 60, y: 0 })
    expect(preview?.lineEnd).toEqual({ x: 60, y: 72 })
    expect(preview?.nextSegments).toEqual([
      { x: 0, y: 0, width: 58, height: 72 },
      { x: 62, y: 0, width: 58, height: 72 },
    ])
  })

  it('turns one room segment into two movable room zones', () => {
    const preview = buildRoomSplitPreview(
      room.segments[0],
      { x: 60, y: 20 },
      { x: 62, y: 70 },
      6,
      6,
    )
    expect(preview).not.toBeNull()

    let nextId = 0
    const nextRoom = applyRoomSplit(room, preview!, () => `split-${++nextId}` as never)

    expect(nextRoom.segments).toHaveLength(2)
    expect(computeRoomContour(nextRoom)).toHaveLength(2)
    expect(getRoomZones(nextRoom).map(zone => zone.id)).toEqual(['R1', 'R2'])
  })

  it('rejects splits for segments that are too narrow to divide', () => {
    const narrowRoom = {
      ...room,
      segments: [
        {
          id: 'segment-narrow' as never,
          x: 0,
          y: 0,
          width: 40,
          height: 72,
        },
      ],
    }

    const preview = buildRoomSplitPreview(
      narrowRoom.segments[0],
      { x: 6, y: 36 },
      { x: 6, y: 66 },
      6,
      getRoomSplitGap(6),
    )

    expect(preview).toBeNull()
  })
})
