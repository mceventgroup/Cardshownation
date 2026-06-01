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
    expect(sample?.kind).toBe('circle')
    expect(sample?.center).toEqual({ x: 120, y: 120 })
    expect(sample?.radius).toBe(80)
    expect(sample?.inwardNormal.x).toBeLessThan(0)

    const original = { x: 170, y: 110, width: 20, height: 20 }
    expect(isRectWithinWallSetback(room, original, 24)).toBe(false)

    const clamped = clampToWallSetback(room, original, 24)
    expect(isRectWithinWallSetback(room, { ...original, ...clamped }, 24)).toBe(true)
  })

  it('accepts rotated tables in circular rooms when they satisfy wall setback', () => {
    const room: CompositeRoom = {
      segments: [],
      circles: [
        {
          id: 'circle-1' as never,
          x: 120,
          y: 120,
          radiusX: 240,
          radiusY: 240,
        },
      ],
      freehandVertices: null,
      roomLabels: {},
    }

    expect(isRectWithinWallSetback(room, {
      x: 84,
      y: -10,
      width: 72,
      height: 30,
      rotation: 35,
    }, 24)).toBe(true)
  })

  it('clamps within the local circle instead of pulling toward the overall room center', () => {
    const room: CompositeRoom = {
      segments: [],
      circles: [
        { id: 'circle-1' as never, x: 120, y: 160, radiusX: 120, radiusY: 120 },
        { id: 'circle-2' as never, x: 260, y: 160, radiusX: 120, radiusY: 120 },
        { id: 'circle-3' as never, x: 400, y: 160, radiusX: 120, radiusY: 120 },
      ],
      freehandVertices: null,
      roomLabels: {},
    }

    const original = { x: 200, y: 145, width: 30, height: 30 }
    const clamped = clampToWallSetback(room, original, 24)

    expect(clamped.x).toBeLessThan(300)
    expect(isRectWithinWallSetback(room, { ...original, ...clamped }, 24)).toBe(true)
  })
})
