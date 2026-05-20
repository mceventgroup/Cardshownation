import { computeRoomBounds, computeRoomContour, isPointInRoom } from '@/domain/room-contour'
import type { CompositeRoom } from '@/domain/types'

describe('room contour circles', () => {
  it('includes circular rooms in contour and bounds calculations', () => {
    const room: CompositeRoom = {
      segments: [],
      circles: [
        {
          id: 'circle-1' as never,
          x: 120,
          y: 180,
          radiusX: 60,
          radiusY: 48,
        },
      ],
      freehandVertices: null,
      roomLabels: {},
    }

    const contours = computeRoomContour(room)
    const bounds = computeRoomBounds(room)

    expect(contours).toHaveLength(1)
    expect(contours[0].length).toBeGreaterThanOrEqual(12)
    expect(bounds).toEqual({ x: 60, y: 132, width: 120, height: 96 })
    expect(isPointInRoom(room, { x: 120, y: 180 })).toBe(true)
    expect(isPointInRoom(room, { x: 10, y: 10 })).toBe(false)
  })
})
