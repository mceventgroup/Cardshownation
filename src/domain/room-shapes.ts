import type { Point, RoomCircle } from '@/domain/types'

const ELLIPSE_SEGMENTS = 48

export function buildEllipseVertices(circle: Pick<RoomCircle, 'x' | 'y' | 'radiusX' | 'radiusY'>, segments = ELLIPSE_SEGMENTS): Point[] {
  const safeSegments = Math.max(12, segments)
  const vertices: Point[] = []

  for (let index = 0; index < safeSegments; index++) {
    const theta = (index / safeSegments) * Math.PI * 2
    vertices.push({
      x: circle.x + Math.cos(theta) * circle.radiusX,
      y: circle.y + Math.sin(theta) * circle.radiusY,
    })
  }

  return vertices
}
