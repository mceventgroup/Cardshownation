// ─────────────────────────────────────────────────────────────────────────────
// ROOM LAYER
//
// Renders room boundary walls, door openings, and door clearance zones.
// listening={false} prevents interference with table interactions.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react'
import { Group, Line, Rect } from 'react-konva'
import type { Room, Door } from '@/domain/types'

interface RoomLayerProps {
  room: Room | null
  doors: Door[]
  doorClearance: number
}

/** Build the clearance zone rectangle projected inward from the door. */
function buildClearanceZone(door: Door, room: Room, clearance: number) {
  switch (door.side) {
    case 'top':
      return { x: door.x, y: room.y, width: door.width, height: clearance }
    case 'bottom':
      return { x: door.x, y: room.y + room.height - clearance, width: door.width, height: clearance }
    case 'left':
      return { x: room.x, y: door.y, width: clearance, height: door.width }
    case 'right':
      return { x: room.x + room.width - clearance, y: door.y, width: clearance, height: door.width }
  }
}

const RoomLayer = memo(function RoomLayer({ room, doors, doorClearance }: RoomLayerProps) {
  if (!room) return null

  const { x, y, width, height } = room

  // Build wall segments with gaps for doors
  const wallSegments: React.ReactNode[] = []

  // For each side, split the wall line at door openings
  const sides: Array<{
    side: Door['side']
    p1: [number, number]
    p2: [number, number]
    axis: 'x' | 'y'
  }> = [
    { side: 'top',    p1: [x, y],              p2: [x + width, y],              axis: 'x' },
    { side: 'bottom', p1: [x, y + height],     p2: [x + width, y + height],     axis: 'x' },
    { side: 'left',   p1: [x, y],              p2: [x, y + height],             axis: 'y' },
    { side: 'right',  p1: [x + width, y],      p2: [x + width, y + height],     axis: 'y' },
  ]

  for (const { side, p1, p2, axis } of sides) {
    const sideDoors = doors
      .filter(d => d.side === side)
      .map(d => {
        if (axis === 'x') {
          return { start: d.x, end: d.x + d.width, door: d }
        } else {
          return { start: d.y, end: d.y + d.width, door: d }
        }
      })
      .sort((a, b) => a.start - b.start)

    // Walk along the wall, drawing segments between door gaps
    let cursor = axis === 'x' ? p1[0] : p1[1]
    const wallEnd = axis === 'x' ? p2[0] : p2[1]
    const fixedCoord = axis === 'x' ? p1[1] : p1[0]

    for (const { start, end } of sideDoors) {
      if (cursor < start) {
        // Wall segment before this door
        const points = axis === 'x'
          ? [cursor, fixedCoord, start, fixedCoord]
          : [fixedCoord, cursor, fixedCoord, start]
        wallSegments.push(
          <Line
            key={`wall-${side}-${cursor}`}
            points={points}
            stroke="#334155"
            strokeWidth={3}
            listening={false}
          />,
        )
      }
      cursor = Math.max(cursor, end)
    }

    // Remaining wall after last door
    if (cursor < wallEnd) {
      const points = axis === 'x'
        ? [cursor, fixedCoord, wallEnd, fixedCoord]
        : [fixedCoord, cursor, fixedCoord, wallEnd]
      wallSegments.push(
        <Line
          key={`wall-${side}-${cursor}-end`}
          points={points}
          stroke="#334155"
          strokeWidth={3}
          listening={false}
        />,
      )
    }
  }

  // Door openings and clearance zones
  const doorElements: React.ReactNode[] = []
  for (const door of doors) {
    // Door opening marker (colored line segment)
    let doorPoints: number[]
    switch (door.side) {
      case 'top':
        doorPoints = [door.x, y, door.x + door.width, y]
        break
      case 'bottom':
        doorPoints = [door.x, y + height, door.x + door.width, y + height]
        break
      case 'left':
        doorPoints = [x, door.y, x, door.y + door.width]
        break
      case 'right':
        doorPoints = [x + width, door.y, x + width, door.y + door.width]
        break
    }
    doorElements.push(
      <Line
        key={`door-${door.id}`}
        points={doorPoints}
        stroke="#2563eb"
        strokeWidth={4}
        dash={[6, 4]}
        listening={false}
      />,
    )

    // Clearance zone
    const zone = buildClearanceZone(door, room, doorClearance)
    doorElements.push(
      <Rect
        key={`clearance-${door.id}`}
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        fill="#ef4444"
        opacity={0.08}
        listening={false}
      />,
    )

    // Clearance zone border (subtle dashed line)
    doorElements.push(
      <Rect
        key={`clearance-border-${door.id}`}
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        stroke="#ef4444"
        strokeWidth={0.5}
        dash={[4, 4]}
        listening={false}
      />,
    )
  }

  return (
    <Group listening={false}>
      {wallSegments}
      {doorElements}
    </Group>
  )
})

export default RoomLayer
