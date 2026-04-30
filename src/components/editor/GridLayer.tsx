'use client'

// ─────────────────────────────────────────────────────────────────────────────
// GRID LAYER
//
// Renders horizontal and vertical grid lines across the entire canvas area.
// listening={false} prevents the grid from intercepting mouse events.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react'
import { Layer, Line, Rect } from 'react-konva'

interface GridLayerProps {
  width:    number
  height:   number
  gridSize: number
}

const GridLayer = memo(function GridLayer({ width, height, gridSize }: GridLayerProps) {
  if (gridSize <= 0) return null

  const verticalLines: React.ReactNode[] = []
  const horizontalLines: React.ReactNode[] = []

  for (let x = 0; x <= width; x += gridSize) {
    verticalLines.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, height]}
        stroke="#cbd5e1"
        strokeWidth={0.5}
        listening={false}
      />,
    )
  }

  for (let y = 0; y <= height; y += gridSize) {
    horizontalLines.push(
      <Line
        key={`h${y}`}
        points={[0, y, width, y]}
        stroke="#cbd5e1"
        strokeWidth={0.5}
        listening={false}
      />,
    )
  }

  return (
    <Layer listening={false}>
      {/* Canvas background */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#ffffff"
        listening={false}
      />
      {verticalLines}
      {horizontalLines}
    </Layer>
  )
})

export default GridLayer
