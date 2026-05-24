import type { CompositeRoom, Point, RoomSegment } from '@/domain/types'

export type RoomSplitOrientation = 'horizontal' | 'vertical'

export interface RoomSplitPreview {
  orientation: RoomSplitOrientation
  segmentId: RoomSegment['id']
  lineStart: Point
  lineEnd: Point
  nextSegments: [
    Omit<RoomSegment, 'id'>,
    Omit<RoomSegment, 'id'>,
  ]
}

const MIN_SPLIT_SEGMENT_SIZE = 24

export function findRoomSegmentAtPoint(room: CompositeRoom | null, point: Point): RoomSegment | null {
  if (!room) return null

  for (let index = room.segments.length - 1; index >= 0; index--) {
    const segment = room.segments[index]
    if (
      point.x >= segment.x &&
      point.x <= segment.x + segment.width &&
      point.y >= segment.y &&
      point.y <= segment.y + segment.height
    ) {
      return segment
    }
  }

  return null
}

export function buildRoomSplitPreview(
  segment: RoomSegment,
  start: Point,
  current: Point,
  gridSize: number,
  wallThickness: number,
): RoomSplitPreview | null {
  const dx = current.x - start.x
  const dy = current.y - start.y
  const threshold = Math.max(1, gridSize / 2)

  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null

  const orientation: RoomSplitOrientation = Math.abs(dy) >= Math.abs(dx) ? 'vertical' : 'horizontal'
  const splitGap = getRoomSplitGap(wallThickness)

  if (orientation === 'vertical') {
    const halfGap = splitGap / 2
    const minX = segment.x + MIN_SPLIT_SEGMENT_SIZE + halfGap
    const maxX = segment.x + segment.width - MIN_SPLIT_SEGMENT_SIZE - halfGap
    if (minX > maxX) return null

    const splitX = clamp(snapToGrid(start.x, gridSize), minX, maxX)
    const left: Omit<RoomSegment, 'id'> = {
      x: segment.x,
      y: segment.y,
      width: splitX - halfGap - segment.x,
      height: segment.height,
    }
    const rightX = splitX + halfGap
    const right: Omit<RoomSegment, 'id'> = {
      x: rightX,
      y: segment.y,
      width: segment.x + segment.width - rightX,
      height: segment.height,
    }

    if (left.width < MIN_SPLIT_SEGMENT_SIZE || right.width < MIN_SPLIT_SEGMENT_SIZE) return null

    return {
      orientation,
      segmentId: segment.id,
      lineStart: { x: splitX, y: segment.y },
      lineEnd: { x: splitX, y: segment.y + segment.height },
      nextSegments: [left, right],
    }
  }

  const halfGap = splitGap / 2
  const minY = segment.y + MIN_SPLIT_SEGMENT_SIZE + halfGap
  const maxY = segment.y + segment.height - MIN_SPLIT_SEGMENT_SIZE - halfGap
  if (minY > maxY) return null

  const splitY = clamp(snapToGrid(start.y, gridSize), minY, maxY)
  const top: Omit<RoomSegment, 'id'> = {
    x: segment.x,
    y: segment.y,
    width: segment.width,
    height: splitY - halfGap - segment.y,
  }
  const bottomY = splitY + halfGap
  const bottom: Omit<RoomSegment, 'id'> = {
    x: segment.x,
    y: bottomY,
    width: segment.width,
    height: segment.y + segment.height - bottomY,
  }

  if (top.height < MIN_SPLIT_SEGMENT_SIZE || bottom.height < MIN_SPLIT_SEGMENT_SIZE) return null

  return {
    orientation,
    segmentId: segment.id,
    lineStart: { x: segment.x, y: splitY },
    lineEnd: { x: segment.x + segment.width, y: splitY },
    nextSegments: [top, bottom],
  }
}

export function applyRoomSplit(
  room: CompositeRoom,
  preview: RoomSplitPreview,
  createSegmentId: () => RoomSegment['id'],
): CompositeRoom {
  return {
    ...room,
    segments: room.segments.flatMap(segment => {
      if (segment.id !== preview.segmentId) return [segment]
      return preview.nextSegments.map(nextSegment => ({
        id: createSegmentId(),
        ...nextSegment,
      }))
    }),
  }
}

export function getRoomSplitGap(wallThickness: number): number {
  const rawGap = Math.max(2, Math.round(wallThickness / 2))
  return rawGap % 2 === 0 ? rawGap : rawGap + 1
}

function snapToGrid(value: number, gridSize: number): number {
  const safeGrid = Math.max(1, gridSize)
  return Math.round(value / safeGrid) * safeGrid
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
