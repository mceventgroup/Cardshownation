import { clampToWallSetback, computeRoomBounds, computeRoomContour, findNearestBoundarySample, isPointInRoom, isRectWithinWallSetback } from '@/domain/room-contour'
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

  it('finds inward normals for circular boundaries and clamps setback against them', () => {
    const room: CompositeRoom = {
      segments: [],
      circles: [
        {
          id: 'circle-1' as never,
          x: 120,
          y: 120,
          radiusX: 80,
          radiusY: 80,
        },
      ],
      freehandVertices: null,
      roomLabels: {},
    }

    const sample = findNearestBoundarySample(room, { x: 195, y: 120 })
    expect(sample).not.toBeNull()
    expect(sample?.inwardNormal.x).toBeLessThan(0)

    const original = { x: 170, y: 110, width: 20, height: 20 }
    expect(isRectWithinWallSetback(room, original, 24)).toBe(false)

    const clamped = clampToWallSetback(room, original, 24)
    expect(isRectWithinWallSetback(room, { ...original, ...clamped }, 24)).toBe(true)
  })
})
