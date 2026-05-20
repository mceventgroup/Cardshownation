'use client'

// ─────────────────────────────────────────────────────────────────────────────
// DOOR NODE
//
// Interactive door on the canvas. Renders:
//   - Solid colored bar in the wall gap (the door panel)
//   - Subtle dotted arc showing swing direction
//   - Draggable along its wall axis
//   - Distance labels from each wall end while dragging
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, useCallback, useState } from 'react'
import { Group, Line, Rect, Shape } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Door } from '@/domain/types'
import type { RoomBoundaryEdge } from '@/domain/room-contour'

interface DoorNodeProps {
  door: Door
  edge: RoomBoundaryEdge
  isSelected: boolean
  gridSize: number    // canvas units per grid cell (e.g. 12 = 1 foot)
  unitLabel: string   // 'in' | 'ft' | 'px'
  onDragEnd: (doorId: string, newX: number, newY: number) => void
  onClick: (doorId: string) => void
}

const DOOR_COLOR = '#2563eb'
const ENTRANCE_COLOR = '#7c3aed'

/** Format a distance in canvas units (inches) as a readable string. */
function fmtDist(units: number, gridSize: number, unitLabel: string): string {
  if (unitLabel === 'px') return `${Math.round(units)}px`
  if (unitLabel === 'ft' || unitLabel === 'in') {
    // gridSize canvas units = 1 foot
    const totalInches = Math.round((units / gridSize) * 12)
    const feet  = Math.floor(totalInches / 12)
    const inches = totalInches % 12
    if (feet === 0) return `${inches}"`
    if (inches === 0) return `${feet}'`
    return `${feet}'${inches}"`
  }
  return `${Math.round(units)}`
}

const DoorNode = memo(function DoorNode({ door, edge, isSelected, gridSize, unitLabel, onDragEnd, onClick }: DoorNodeProps) {
  const { side, width: doorWidth } = door
  const isEntrance = door.kind === 'entrance'
  const accentColor = isEntrance ? ENTRANCE_COLOR : DOOR_COLOR

  let groupX: number
  let groupY: number
  let dragAxis: 'x' | 'y'

  // Door panel bar dimensions (relative to group)
  let barX: number, barY: number, barW: number, barH: number

  // Swing arc
  let hingeX: number, hingeY: number
  let arcStart: number, arcEnd: number

  const panelThickness = 4

  switch (side) {
    case 'top':
      groupX = door.x
      groupY = door.y
      dragAxis = 'x'
      barX = 0; barY = -panelThickness / 2; barW = doorWidth; barH = panelThickness
      hingeX = 0; hingeY = 0
      arcStart = 0; arcEnd = Math.PI / 2
      break
    case 'bottom':
      groupX = door.x
      groupY = door.y
      dragAxis = 'x'
      barX = 0; barY = -panelThickness / 2; barW = doorWidth; barH = panelThickness
      hingeX = 0; hingeY = 0
      arcStart = -Math.PI / 2; arcEnd = 0
      break
    case 'left':
      groupX = door.x
      groupY = door.y
      dragAxis = 'y'
      barX = -panelThickness / 2; barY = 0; barW = panelThickness; barH = doorWidth
      hingeX = 0; hingeY = 0
      arcStart = 0; arcEnd = Math.PI / 2
      break
    case 'right':
      groupX = door.x
      groupY = door.y
      dragAxis = 'y'
      barX = -panelThickness / 2; barY = 0; barW = panelThickness; barH = doorWidth
      hingeX = 0; hingeY = 0
      arcStart = Math.PI / 2; arcEnd = Math.PI
      break
  }

  // Hit area along the wall opening
  let hitPoints: number[]
  switch (side) {
    case 'top':
    case 'bottom':
      hitPoints = [0, 0, doorWidth, 0]
      break
    case 'left':
    case 'right':
      hitPoints = [0, 0, 0, doorWidth]
      break
  }

  // Track dragging state so we can show distance labels
  const [isDragging, setIsDragging] = useState(false)
  const [liveX, setLiveX] = useState(groupX)
  const [liveY, setLiveY] = useState(groupY)

  const handleDragStart = useCallback(() => {
    setIsDragging(true)
    setLiveX(groupX)
    setLiveY(groupY)
  }, [groupX, groupY])

  const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
    const node = e.target
    if (dragAxis === 'x') {
      node.y(groupY)
      const minX = Math.min(edge.x1, edge.x2)
      const maxX = Math.max(edge.x1, edge.x2) - doorWidth
      const clampedX = Math.max(minX, Math.min(maxX, node.x()))
      node.x(clampedX)
      setLiveX(clampedX)
    } else {
      node.x(groupX)
      const minY = Math.min(edge.y1, edge.y2)
      const maxY = Math.max(edge.y1, edge.y2) - doorWidth
      const clampedY = Math.max(minY, Math.min(maxY, node.y()))
      node.y(clampedY)
      setLiveY(clampedY)
    }
  }, [dragAxis, groupX, groupY, edge, doorWidth])

  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    setIsDragging(false)
    const node = e.target
    if (dragAxis === 'x') {
      onDragEnd(door.id, node.x(), door.y)
    } else {
      onDragEnd(door.id, door.x, node.y())
    }
  }, [door.id, door.x, door.y, dragAxis, onDragEnd])

  // Distance from each wall end to the door edges (in canvas units = inches)
  const distA = dragAxis === 'x'
    ? liveX - Math.min(edge.x1, edge.x2)                  // left gap (horizontal doors)
    : liveY - Math.min(edge.y1, edge.y2)                  // top gap (vertical doors)
  const distB = dragAxis === 'x'
    ? Math.max(edge.x1, edge.x2) - (liveX + doorWidth)    // right gap
    : Math.max(edge.y1, edge.y2) - (liveY + doorWidth)   // bottom gap

  const labelA = fmtDist(distA, gridSize, unitLabel)
  const labelB = fmtDist(distB, gridSize, unitLabel)

  // Pill background padding
  const PILL_PAD_X = 5
  const PILL_PAD_Y = 3
  const FONT_SIZE  = 11

  return (
    <Group
      x={groupX}
      y={groupY}
      draggable
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={() => onClick(door.id)}
    >
      {/* Wide invisible hit area */}
      <Line
        points={hitPoints}
        stroke="transparent"
        strokeWidth={20}
        hitStrokeWidth={20}
      />

      {/* Door panel bar */}
      <Rect
        x={barX}
        y={barY}
        width={barW}
        height={barH}
        fill={isSelected ? (isEntrance ? '#6d28d9' : '#1d4ed8') : accentColor}
        stroke={isSelected ? '#fbbf24' : undefined}
        strokeWidth={isSelected ? 2 : 0}
        cornerRadius={1}
        listening={false}
      />

      {/* Subtle swing arc */}
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath()
          ctx.arc(hingeX, hingeY, doorWidth * 0.8, arcStart, arcEnd, false)
          ctx.strokeShape(shape)
        }}
        stroke={accentColor}
        strokeWidth={0.75}
        dash={[3, 3]}
        opacity={0.4}
        listening={false}
      />

      {isEntrance && (
        <Line
          points={
            side === 'top' ? [doorWidth / 2, -14, doorWidth / 2, 8, doorWidth / 2 - 5, 3, doorWidth / 2, 8, doorWidth / 2 + 5, 3]
            : side === 'bottom' ? [doorWidth / 2, 14, doorWidth / 2, -8, doorWidth / 2 - 5, -3, doorWidth / 2, -8, doorWidth / 2 + 5, -3]
            : side === 'left' ? [-14, doorWidth / 2, 8, doorWidth / 2, 3, doorWidth / 2 - 5, 8, doorWidth / 2, 3, doorWidth / 2 + 5]
            : [14, doorWidth / 2, -8, doorWidth / 2, -3, doorWidth / 2 - 5, -8, doorWidth / 2, -3, doorWidth / 2 + 5]
          }
          stroke={accentColor}
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}

      {/* Door label */}
      <Shape
        sceneFunc={(ctx) => {
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          let lx: number, ly: number
          switch (side) {
            case 'top':
              lx = doorWidth / 2; ly = -12
              break
            case 'bottom':
              lx = doorWidth / 2; ly = 12
              break
            case 'left':
              lx = -12; ly = doorWidth / 2
              break
            case 'right':
              lx = 12; ly = doorWidth / 2
              break
          }
          // Keep entrance labels readable against walls and background artwork.
          ctx.lineWidth = 3
          ctx.strokeStyle = 'rgba(255,255,255,0.95)'
          ctx.strokeText(door.label, lx, ly)
          ctx.fillStyle = '#111827'
          ctx.fillText(door.label, lx, ly)
        }}
        listening={false}
      />

      {/* Distance labels — shown while dragging */}
      {isDragging && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            ctx.font = `bold ${FONT_SIZE}px sans-serif`
            ctx.textBaseline = 'middle'

            function drawPill(text: string, cx: number, cy: number) {
              const tw = ctx.measureText(text).width
              const pw = tw + PILL_PAD_X * 2
              const ph = FONT_SIZE + PILL_PAD_Y * 2
              const rx = pw / 2

              // Pill background
              ctx.fillStyle = 'rgba(15,23,42,0.82)'
              ctx.beginPath()
              ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, rx)
              ctx.fill()

              // Text
              ctx.fillStyle = '#f8fafc'
              ctx.textAlign = 'center'
              ctx.fillText(text, cx, cy)
            }

            // In group-local coords, door occupies 0..doorWidth (horizontal)
            // or 0..doorWidth (vertical). The wall ends are at:
            const wallStart = dragAxis === 'x' ? Math.min(edge.x1, edge.x2) - liveX : Math.min(edge.y1, edge.y2) - liveY
            const wallEnd   = dragAxis === 'x'
              ? Math.max(edge.x1, edge.x2) - liveX
              : Math.max(edge.y1, edge.y2) - liveY

            const OFFSET = side === 'top' ? -22 : side === 'bottom' ? 22 : 0
            const OFFSET_V = side === 'left' ? -22 : side === 'right' ? 22 : 0

            if (dragAxis === 'x') {
              // Left gap: wallStart → 0
              if (distA > 0) {
                const midX = (wallStart + 0) / 2
                drawPill(labelA, midX, OFFSET)
              }
              // Right gap: doorWidth → wallEnd
              if (distB > 0) {
                const midX = (doorWidth + wallEnd) / 2
                drawPill(labelB, midX, OFFSET)
              }
            } else {
              // Top gap: wallStart → 0
              if (distA > 0) {
                const midY = (wallStart + 0) / 2
                drawPill(labelA, OFFSET_V, midY)
              }
              // Bottom gap: doorWidth → wallEnd
              if (distB > 0) {
                const midY = (doorWidth + wallEnd) / 2
                drawPill(labelB, OFFSET_V, midY)
              }
            }
          }}
        />
      )}
    </Group>
  )
})

export default DoorNode
