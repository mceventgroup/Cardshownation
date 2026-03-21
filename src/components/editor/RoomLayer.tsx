// ─────────────────────────────────────────────────────────────────────────────
// ROOM LAYER
//
// Renders the composite room boundary: filled interior, outer wall lines with
// door gaps, door opening markers, and door clearance zones.
// Supports both multi-segment (rectangle union) and freehand polygon rooms.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, useMemo } from 'react'
import { Group, Line, Rect, Shape } from 'react-konva'
import type { CompositeRoom, Door, Point, RoomSegment, RoomSegmentId } from '@/domain/types'
import { computeRoomContour, computeRoomBounds } from '@/domain/room-contour'

interface RoomLayerProps {
  room: CompositeRoom | null
  doors: Door[]
  doorClearance: number
  wallSetback: number
  showWallSetback: boolean
  selectedSegmentId?: RoomSegmentId | null
}

const RoomLayer = memo(function RoomLayer({ room, doors, doorClearance, wallSetback, showWallSetback, selectedSegmentId }: RoomLayerProps) {
  if (!room) return null

  const contours = useMemo(() => computeRoomContour(room), [room])
  const bounds = useMemo(() => computeRoomBounds(room), [room])

  if (contours.length === 0) return null

  return (
    <Group listening={false}>
      {/* Room fill — one shape per contour polygon */}
      {contours.map((polygon, i) => (
        <Line
          key={`fill-${i}`}
          points={polygon.flatMap(p => [p.x, p.y])}
          closed
          fill="#f8fafc"
          opacity={0.6}
          listening={false}
        />
      ))}

      {/* Outer walls — draw each polygon edge, splitting at door openings */}
      {contours.map((polygon, ci) => (
        <WallEdges
          key={`walls-${ci}`}
          polygon={polygon}
          doors={doors}
          room={room}
          bounds={bounds}
        />
      ))}

      {/* Door openings and clearance zones */}
      {doors.map(door => (
        <DoorElement
          key={door.id}
          door={door}
          room={room}
          bounds={bounds}
          clearance={doorClearance}
        />
      ))}

      {/* Wall setback zone — yellow overlay inset from room boundary */}
      {showWallSetback && wallSetback > 0 && (
        <WallSetbackOverlay
          contours={contours}
          room={room}
          wallSetback={wallSetback}
        />
      )}

      {/* Highlight selected segment */}
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

// ─────────────────────────────────────────────────────────────────────────────
// WALL EDGES — contour edges split at door positions
// ─────────────────────────────────────────────────────────────────────────────

interface WallEdgesProps {
  polygon: Point[]
  doors: Door[]
  room: CompositeRoom
  bounds: { x: number; y: number; width: number; height: number } | null
}

function WallEdges({ polygon, doors, room, bounds }: WallEdgesProps) {
  const segments: React.ReactNode[] = []

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i]
    const p2 = polygon[(i + 1) % polygon.length]

    // Determine if this edge is horizontal or vertical
    const isHorizontal = p1.y === p2.y
    const isVertical = p1.x === p2.x

    if (!isHorizontal && !isVertical) {
      // Diagonal edge (freehand polygon) — draw as-is, no door splitting
      segments.push(
        <Line
          key={`wall-${i}`}
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#334155"
          strokeWidth={3}
          listening={false}
        />,
      )
      continue
    }

    // Find doors that overlap this edge
    const edgeDoorGaps = findDoorGapsOnEdge(p1, p2, doors, bounds)

    if (edgeDoorGaps.length === 0) {
      segments.push(
        <Line
          key={`wall-${i}`}
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#334155"
          strokeWidth={3}
          listening={false}
        />,
      )
    } else {
      // Split wall at door gaps
      const axis = isHorizontal ? 'x' : 'y'
      const start = axis === 'x' ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y)
      const end = axis === 'x' ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y)
      const fixedCoord = axis === 'x' ? p1.y : p1.x

      // Sort gaps by start position
      const sortedGaps = [...edgeDoorGaps].sort((a, b) => a.start - b.start)

      let cursor = start
      for (const gap of sortedGaps) {
        if (cursor < gap.start) {
          const pts = axis === 'x'
            ? [cursor, fixedCoord, gap.start, fixedCoord]
            : [fixedCoord, cursor, fixedCoord, gap.start]
          segments.push(
            <Line
              key={`wall-${i}-${cursor}`}
              points={pts}
              stroke="#334155"
              strokeWidth={3}
              listening={false}
            />,
          )
        }
        cursor = Math.max(cursor, gap.end)
      }
      if (cursor < end) {
        const pts = axis === 'x'
          ? [cursor, fixedCoord, end, fixedCoord]
          : [fixedCoord, cursor, fixedCoord, end]
        segments.push(
          <Line
            key={`wall-${i}-${cursor}-end`}
            points={pts}
            stroke="#334155"
            strokeWidth={3}
            listening={false}
          />,
        )
      }
    }
  }

  return <>{segments}</>
}

// Find door gaps that lie on a given polygon edge
function findDoorGapsOnEdge(
  p1: Point, p2: Point, doors: Door[],
  bounds: { x: number; y: number; width: number; height: number } | null,
): { start: number; end: number }[] {
  if (!bounds) return []

  const isHorizontal = p1.y === p2.y
  const gaps: { start: number; end: number }[] = []

  for (const door of doors) {
    // Map door side + position to edge matching
    if (isHorizontal) {
      const edgeY = p1.y
      const edgeMinX = Math.min(p1.x, p2.x)
      const edgeMaxX = Math.max(p1.x, p2.x)

      // Door on top wall
      if (door.side === 'top' && Math.abs(edgeY - bounds.y) < 1) {
        const dStart = door.x
        const dEnd = door.x + door.width
        if (dStart < edgeMaxX && dEnd > edgeMinX) {
          gaps.push({ start: Math.max(dStart, edgeMinX), end: Math.min(dEnd, edgeMaxX) })
        }
      }
      // Door on bottom wall
      if (door.side === 'bottom' && Math.abs(edgeY - (bounds.y + bounds.height)) < 1) {
        const dStart = door.x
        const dEnd = door.x + door.width
        if (dStart < edgeMaxX && dEnd > edgeMinX) {
          gaps.push({ start: Math.max(dStart, edgeMinX), end: Math.min(dEnd, edgeMaxX) })
        }
      }
    } else {
      // Vertical edge
      const edgeX = p1.x
      const edgeMinY = Math.min(p1.y, p2.y)
      const edgeMaxY = Math.max(p1.y, p2.y)

      // Door on left wall
      if (door.side === 'left' && Math.abs(edgeX - bounds.x) < 1) {
        const dStart = door.y
        const dEnd = door.y + door.width
        if (dStart < edgeMaxY && dEnd > edgeMinY) {
          gaps.push({ start: Math.max(dStart, edgeMinY), end: Math.min(dEnd, edgeMaxY) })
        }
      }
      // Door on right wall
      if (door.side === 'right' && Math.abs(edgeX - (bounds.x + bounds.width)) < 1) {
        const dStart = door.y
        const dEnd = door.y + door.width
        if (dStart < edgeMaxY && dEnd > edgeMinY) {
          gaps.push({ start: Math.max(dStart, edgeMinY), end: Math.min(dEnd, edgeMaxY) })
        }
      }
    }
  }

  return gaps
}

// ─────────────────────────────────────────────────────────────────────────────
// WALL SETBACK OVERLAY
//
// Renders a yellow band along the inside of every wall edge showing the
// no-table zone. Uses the difference between outer contour and an inset
// contour — drawn as a filled strip along each polygon edge.
// ─────────────────────────────────────────────────────────────────────────────

interface WallSetbackOverlayProps {
  contours: Point[][]
  room: CompositeRoom
  wallSetback: number
}

function WallSetbackOverlay({ contours, room, wallSetback }: WallSetbackOverlayProps) {
  // For each contour polygon, draw a setback strip on each edge.
  // Each strip is a quad: the original edge + a parallel edge inset by wallSetback.
  return (
    <>
      {contours.map((polygon, ci) => {
        const strips: React.ReactNode[] = []
        for (let i = 0; i < polygon.length; i++) {
          const p1 = polygon[i]
          const p2 = polygon[(i + 1) % polygon.length]

          // Compute inward normal (for clockwise polygon, inward = right of edge direction)
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len === 0) continue

          // Right-hand normal (inward for CW polygon)
          const nx = dy / len
          const ny = -dx / len

          const inset = wallSetback
          const q1 = { x: p1.x + nx * inset, y: p1.y + ny * inset }
          const q2 = { x: p2.x + nx * inset, y: p2.y + ny * inset }

          strips.push(
            <Line
              key={`setback-${ci}-${i}`}
              points={[p1.x, p1.y, p2.x, p2.y, q2.x, q2.y, q1.x, q1.y]}
              closed
              fill="#fbbf24"
              opacity={0.15}
              listening={false}
            />,
          )

          // Dashed inner boundary line
          strips.push(
            <Line
              key={`setback-line-${ci}-${i}`}
              points={[q1.x, q1.y, q2.x, q2.y]}
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

// ─────────────────────────────────────────────────────────────────────────────
// DOOR ELEMENT
// ─────────────────────────────────────────────────────────────────────────────

interface DoorElementProps {
  door: Door
  room: CompositeRoom
  bounds: { x: number; y: number; width: number; height: number } | null
  clearance: number
}

function DoorElement({ door, room, bounds, clearance }: DoorElementProps) {
  if (!bounds) return null

  // Clearance zone only — interactive door line + swing are rendered by DoorNode
  let zone: { x: number; y: number; width: number; height: number }
  switch (door.side) {
    case 'top':
      zone = { x: door.x, y: bounds.y, width: door.width, height: clearance }
      break
    case 'bottom':
      zone = { x: door.x, y: bounds.y + bounds.height - clearance, width: door.width, height: clearance }
      break
    case 'left':
      zone = { x: bounds.x, y: door.y, width: clearance, height: door.width }
      break
    case 'right':
      zone = { x: bounds.x + bounds.width - clearance, y: door.y, width: clearance, height: door.width }
      break
  }

  return (
    <>
      <Rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        fill="#ef4444"
        opacity={0.08}
        listening={false}
      />
      <Rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        stroke="#ef4444"
        strokeWidth={0.5}
        dash={[4, 4]}
        listening={false}
      />
    </>
  )
}
