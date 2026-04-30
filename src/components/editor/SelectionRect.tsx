'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SELECTION RECT
//
// Rubber-band selection rectangle drawn during drag-select.
// Rendered in a non-listening overlay layer so it never intercepts events.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { Rect } from 'react-konva'

interface SelectionState {
  startX:   number
  startY:   number
  currentX: number
  currentY: number
}

interface SelectionRectProps {
  selectionState: SelectionState
}

export default function SelectionRect({ selectionState }: SelectionRectProps) {
  const x = Math.min(selectionState.startX, selectionState.currentX)
  const y = Math.min(selectionState.startY, selectionState.currentY)
  const w = Math.abs(selectionState.currentX - selectionState.startX)
  const h = Math.abs(selectionState.currentY - selectionState.startY)

  if (w < 1 || h < 1) return null

  return (
    <Rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="rgba(37, 99, 235, 0.08)"
      stroke="#2563eb"
      strokeWidth={1}
      dash={[4, 3]}
      listening={false}
    />
  )
}
