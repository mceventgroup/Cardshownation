'use client'

import React, { memo, useMemo } from 'react'
import { Group, Line, Rect } from 'react-konva/lib/ReactKonvaCore'
import type { CompositeRoom, Door, Point, RoomSegmentId } from '@floorplanner/domain/types'
import { computeRoomContour } from '@floorplanner/domain/room-contour'
import { getRoomZones } from '@floorplanner/domain/room-numbering'

interface RoomLayerProps {
  room: CompositeRoom | null
  doors: Door[]
  doorClearance: number
  wallThickness: number
  wallSetback: number
  showWallSetback: boolean
  activeRoomId?: string | null
  selectedSegmentId?: RoomSegmentId | null
}

const RoomLayer = memo(function RoomLayer({
  room,
  doors,
  doorClearance,
  wallThickness,
  wallSetback,
  showWallSetback,
  activeRoomId,
  selectedSegmentId,
}: RoomLayerProps) {
  const contours = useMemo(() => (room ? computeRoomContour(room) : []), [room])
  const roomZones = useMemo(() => getRoomZones(room), [room])
  const activeRoomZone = useMemo(
    () => roomZones.find(zone => zone.id === activeRoomId) ?? null,
    [activeRoomId, roomZones],
  )

  if (!room || contours.length === 0) return null

  return (
    <Group listening={false}>
      {contours.map((polygon, index) => (
        <Line
          key={`fill-${index}`}
          points={polygon.flatMap(point => [point.x, point.y])}
          closed
          fill="#f1f5f9"
          opacity={0.95}
          listening={false}
        />
      ))}

      {contours.map((polygon, index) => (
        <WallEdges
          key={`walls-${index}`}
          polygon={polygon}
          doors={doors}
          wallThickness={wallThickness}
        />
      ))}

      {doors.map(door => (
        <DoorElement
          key={door.id}
          door={door}
          clearance={doorClearance}
        />
      ))}

      {showWallSetback && wallSetback > 0 && (
        <WallSetbackOverlay
          contours={contours}
          wallThickness={wallThickness}
          wallSetback={wallSetback}
        />
      )}

      {activeRoomZone && (
        <Line
          points={activeRoomZone.polygon.flatMap(point => [point.x, point.y])}
          closed
          stroke="#2563eb"
          strokeWidth={3}
          dash={[10, 6]}
          opacity={0.85}
          listening={false}
        />
      )}

      {selectedSegmentId && room.segments.map(seg => {
        if (seg.id !== selectedSegmentId) return null
        return (
          <Rect
            key={`seg-highlight-${seg.id}`}
            x={seg.x}
            y={seg.y}
            width={seg.width}
            height={seg.height}
            stroke="#3b82f6"
            strokeWidth={2}
            dash={[6, 3]}
            listening={false}
          />
        )
      })}
    </Group>
  )
})

export default RoomLayer

interface WallEdgesProps {
  polygon: Point[]
  doors: Door[]
  wallThickness: number
}

function WallEdges({ polygon, doors, wallThickness }: WallEdgesProps) {
  const strips: React.ReactNode[] = []

  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const runs = splitEdgeAroundDoors(start, end, doors)

    for (const [runIndex, [runStart, runEnd]] of runs.entries()) {
      strips.push(
        <WallStrip
          key={`wall-${index}-${runIndex}`}
          start={runStart}
          end={runEnd}
          wallThickness={wallThickness}
        />,
      )
    }
  }

  return <>{strips}</>
}

function WallStrip({ start, end, wallThickness }: { start: Point; end: Point; wallThickness: number }) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return null

  const nx = -dy / length
  const ny = dx / length
  const halfThickness = wallThickness / 2
  const inner1 = { x: start.x + nx * halfThickness, y: start.y + ny * halfThickness }
  const inner2 = { x: end.x + nx * halfThickness, y: end.y + ny * halfThickness }
  const outer1 = { x: start.x - nx * halfThickness, y: start.y - ny * halfThickness }
  const outer2 = { x: end.x - nx * halfThickness, y: end.y - ny * halfThickness }

  return (
    <>
      <Line
        points={[outer1.x, outer1.y, outer2.x, outer2.y, inner2.x, inner2.y, inner1.x, inner1.y]}
        closed
        fill="#1e293b"
        opacity={0.94}
        listening={false}
      />
      <Line
        points={[inner1.x, inner1.y, inner2.x, inner2.y]}
        stroke="#64748b"
        strokeWidth={1}
        opacity={0.45}
        listening={false}
      />
    </>
  )
}

function splitEdgeAroundDoors(
  p1: Point,
  p2: Point,
  doors: Door[],
): [Point, Point][] {
  const isHorizontal = p1.y === p2.y
  const isVertical = p1.x === p2.x
  if (!isHorizontal && !isVertical) return [[p1, p2]]

  const gaps = findDoorGapsOnEdge(p1, p2, doors)
  if (gaps.length === 0) return [[p1, p2]]

  const axis = isHorizontal ? 'x' : 'y'
  const start = axis === 'x' ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y)
  const end = axis === 'x' ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y)
  const fixedCoord = axis === 'x' ? p1.y : p1.x
  const sortedGaps = [...gaps].sort((a, b) => a.start - b.start)
  const runs: [Point, Point][] = []

  let cursor = start
  for (const gap of sortedGaps) {
    if (cursor < gap.start) {
      runs.push(axis === 'x'
        ? [{ x: cursor, y: fixedCoord }, { x: gap.start, y: fixedCoord }]
        : [{ x: fixedCoord, y: cursor }, { x: fixedCoord, y: gap.start }])
    }
    cursor = Math.max(cursor, gap.end)
  }

  if (cursor < end) {
    runs.push(axis === 'x'
      ? [{ x: cursor, y: fixedCoord }, { x: end, y: fixedCoord }]
      : [{ x: fixedCoord, y: cursor }, { x: fixedCoord, y: end }])
  }

  const forward = isHorizontal ? p2.x >= p1.x : p2.y >= p1.y
  return runs.map(([startPoint, endPoint]) => (forward ? [startPoint, endPoint] : [endPoint, startPoint]))
}

function findDoorGapsOnEdge(
  p1: Point,
  p2: Point,
  doors: Door[],
): { start: number; end: number }[] {
  const isHorizontal = p1.y === p2.y
  const gaps: { start: number; end: number }[] = []

  for (const door of doors) {
    if (isHorizontal) {
      const edgeY = p1.y
      const edgeMinX = Math.min(p1.x, p2.x)
      const edgeMaxX = Math.max(p1.x, p2.x)

      if ((door.side === 'top' || door.side === 'bottom') && Math.abs(edgeY - door.y) < 1) {
        const doorStart = door.x
        const doorEnd = door.x + door.width
        if (doorStart < edgeMaxX && doorEnd > edgeMinX) {
          gaps.push({ start: Math.max(doorStart, edgeMinX), end: Math.min(doorEnd, edgeMaxX) })
        }
      }
    } else {
      const edgeX = p1.x
      const edgeMinY = Math.min(p1.y, p2.y)
      const edgeMaxY = Math.max(p1.y, p2.y)

      if ((door.side === 'left' || door.side === 'right') && Math.abs(edgeX - door.x) < 1) {
        const doorStart = door.y
        const doorEnd = door.y + door.width
        if (doorStart < edgeMaxY && doorEnd > edgeMinY) {
          gaps.push({ start: Math.max(doorStart, edgeMinY), end: Math.min(doorEnd, edgeMaxY) })
        }
      }
    }
  }

  return gaps
}

interface WallSetbackOverlayProps {
  contours: Point[][]
  wallThickness: number
  wallSetback: number
}

function WallSetbackOverlay({ contours, wallThickness, wallSetback }: WallSetbackOverlayProps) {
  return (
    <>
      {contours.map((polygon, ci) => {
        const strips: React.ReactNode[] = []
        for (let i = 0; i < polygon.length; i++) {
          const p1 = polygon[i]
          const p2 = polygon[(i + 1) % polygon.length]
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len === 0) continue

          const nx = -dy / len
          const ny = dx / len
          const halfThickness = wallThickness / 2
          const innerWall1 = { x: p1.x + nx * halfThickness, y: p1.y + ny * halfThickness }
          const innerWall2 = { x: p2.x + nx * halfThickness, y: p2.y + ny * halfThickness }
          const innerSetback1 = { x: p1.x + nx * (halfThickness + wallSetback), y: p1.y + ny * (halfThickness + wallSetback) }
          const innerSetback2 = { x: p2.x + nx * (halfThickness + wallSetback), y: p2.y + ny * (halfThickness + wallSetback) }
          const outerWall1 = { x: p1.x - nx * halfThickness, y: p1.y - ny * halfThickness }
          const outerWall2 = { x: p2.x - nx * halfThickness, y: p2.y - ny * halfThickness }
          const outerSetback1 = { x: p1.x - nx * (halfThickness + wallSetback), y: p1.y - ny * (halfThickness + wallSetback) }
          const outerSetback2 = { x: p2.x - nx * (halfThickness + wallSetback), y: p2.y - ny * (halfThickness + wallSetback) }

          strips.push(
            <Line
              key={`setback-inner-${ci}-${i}`}
              points={[innerWall1.x, innerWall1.y, innerWall2.x, innerWall2.y, innerSetback2.x, innerSetback2.y, innerSetback1.x, innerSetback1.y]}
              closed
              fill="#fbbf24"
              opacity={0.15}
              listening={false}
            />,
          )

          strips.push(
            <Line
              key={`setback-outer-${ci}-${i}`}
              points={[outerSetback1.x, outerSetback1.y, outerSetback2.x, outerSetback2.y, outerWall2.x, outerWall2.y, outerWall1.x, outerWall1.y]}
              closed
              fill="#fbbf24"
              opacity={0.15}
              listening={false}
            />,
          )

          strips.push(
            <Line
              key={`setback-line-inner-${ci}-${i}`}
              points={[innerSetback1.x, innerSetback1.y, innerSetback2.x, innerSetback2.y]}
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 4]}
              opacity={0.5}
              listening={false}
            />,
          )

          strips.push(
            <Line
              key={`setback-line-outer-${ci}-${i}`}
              points={[outerSetback1.x, outerSetback1.y, outerSetback2.x, outerSetback2.y]}
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 4]}
              opacity={0.5}
              listening={false}
            />,
          )
        }
        return <React.Fragment key={`setback-group-${ci}`}>{strips}</React.Fragment>
      })}
    </>
  )
}

interface DoorElementProps {
  door: Door
  clearance: number
}

function DoorElement({ door, clearance }: DoorElementProps) {
  let zone: { x: number; y: number; width: number; height: number }
  switch (door.side) {
    case 'top':
      zone = { x: door.x, y: door.y, width: door.width, height: clearance }
      break
    case 'bottom':
      zone = { x: door.x, y: door.y - clearance, width: door.width, height: clearance }
      break
    case 'left':
      zone = { x: door.x, y: door.y, width: clearance, height: door.width }
      break
    case 'right':
      zone = { x: door.x - clearance, y: door.y, width: clearance, height: door.width }
      break
  }

  return (
    <>
      <Rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        fill="#f97316"
        opacity={0.12}
        listening={false}
      />
      <Rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        stroke="#ea580c"
        strokeWidth={1}
        dash={[4, 4]}
        listening={false}
      />
    </>
  )
}
