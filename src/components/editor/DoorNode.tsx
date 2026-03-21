// ─────────────────────────────────────────────────────────────────────────────
// DOOR NODE
//
// Interactive door on the canvas. Renders:
//   - Solid colored bar in the wall gap (the door panel)
//   - Subtle dotted arc showing swing direction
//   - Draggable along its wall axis
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, useCallback } from 'react'
import { Group, Line, Rect, Shape } from 'react-konva'
import type { Door, Rect as RectType } from '@/domain/types'

interface DoorNodeProps {
  door: Door
  bounds: RectType
  isSelected: boolean
  onDragEnd: (doorId: string, newX: number, newY: number) => void
  onClick: (doorId: string) => void
}

const DOOR_COLOR = '#2563eb'

const DoorNode = memo(function DoorNode({ door, bounds, isSelected, onDragEnd, onClick }: DoorNodeProps) {
  const { side, width: doorWidth } = door

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
      groupY = bounds.y
      dragAxis = 'x'
      barX = 0; barY = -panelThickness / 2; barW = doorWidth; barH = panelThickness
      hingeX = 0; hingeY = 0
      arcStart = 0; arcEnd = Math.PI / 2
      break
    case 'bottom':
      groupX = door.x
      groupY = bounds.y + bounds.height
      dragAxis = 'x'
      barX = 0; barY = -panelThickness / 2; barW = doorWidth; barH = panelThickness
      hingeX = 0; hingeY = 0
      arcStart = -Math.PI / 2; arcEnd = 0
      break
    case 'left':
      groupX = bounds.x
      groupY = door.y
      dragAxis = 'y'
      barX = -panelThickness / 2; barY = 0; barW = panelThickness; barH = doorWidth
      hingeX = 0; hingeY = 0
      arcStart = 0; arcEnd = Math.PI / 2
      break
    case 'right':
      groupX = bounds.x + bounds.width
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

  const handleDragMove = useCallback((e: any) => {
    const node = e.target
    if (dragAxis === 'x') {
      node.y(groupY)
      node.x(Math.max(bounds.x, Math.min(bounds.x + bounds.width - doorWidth, node.x())))
    } else {
      node.x(groupX)
      node.y(Math.max(bounds.y, Math.min(bounds.y + bounds.height - doorWidth, node.y())))
    }
  }, [dragAxis, groupX, groupY, bounds, doorWidth])

  const handleDragEnd = useCallback((e: any) => {
    const node = e.target
    if (dragAxis === 'x') {
      onDragEnd(door.id, node.x(), door.y)
    } else {
      onDragEnd(door.id, door.x, node.y())
    }
  }, [door.id, door.x, door.y, dragAxis, onDragEnd])

  return (
    <Group
      x={groupX}
      y={groupY}
      draggable
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
        fill={isSelected ? '#1d4ed8' : DOOR_COLOR}
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
        stroke={DOOR_COLOR}
        strokeWidth={0.75}
        dash={[3, 3]}
        opacity={0.4}
        listening={false}
      />

      {/* Door label */}
      <Shape
        sceneFunc={(ctx) => {
          ctx.font = '10px sans-serif'
          ctx.fillStyle = DOOR_COLOR
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
          ctx.fillText(door.label, lx, ly)
        }}
        listening={false}
      />
    </Group>
  )
})

export default DoorNode
