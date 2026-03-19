// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMER CONTROL
//
// Attaches Konva's Transformer to the single selected table when exactly
// one table is selected. Handles resize commits via ResizeTableCommand.
//
// IMPORTANT: After onTransformEnd, we must bake scaleX/scaleY into
// width/height and reset the scale to 1. Konva does NOT do this automatically.
// Failure to do this causes widths to compound on each subsequent resize.
//
// Rotation via the Transformer is disabled for v1 — use a dedicated rotation
// control in a later phase.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { TableObject, TableId } from '@/domain/types'
import type { LayoutCommand } from '@/domain/commands'

interface TransformerControlProps {
  selectedIds: Set<string>
  nodeRefs:    React.RefObject<Map<string, Konva.Node>>
  tables:      Record<string, TableObject>
  dispatch:    (command: LayoutCommand) => void
}

export default function TransformerControl({
  selectedIds,
  nodeRefs,
  tables,
  dispatch,
}: TransformerControlProps) {
  const transformerRef = useRef<Konva.Transformer>(null)

  // Attach transformer to the single selected node whenever selection changes
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return

    if (selectedIds.size === 1) {
      const [id] = selectedIds
      const node = nodeRefs.current?.get(id)
      if (node) {
        tr.nodes([node])
        tr.getLayer()?.batchDraw()
      }
    } else {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
    }
  }, [selectedIds, nodeRefs])

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = e.target as Konva.Rect

    // Bake scale into width/height, then reset scale to 1
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    const newWidth  = Math.max(10, node.width() * scaleX)
    const newHeight = Math.max(10, node.height() * scaleY)

    // Reset BEFORE reading position, so position is correct
    node.scaleX(1)
    node.scaleY(1)

    const tableId = node.id() as TableId
    const table   = tables[tableId]
    if (!table) return

    const prev = { x: table.x, y: table.y, width: table.width, height: table.height }
    const next = { x: node.x() + (node.parent?.x() ?? 0), y: node.y() + (node.parent?.y() ?? 0), width: newWidth, height: newHeight }

    // Skip if no change
    if (
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
    ) return

    dispatch({
      type:     'RESIZE_TABLE',
      tableId,
      prev,
      next,
      timestamp: Date.now(),
    })
  }

  if (selectedIds.size !== 1) return null

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled={false}       // rotation via dedicated control in later phase
      keepRatio={false}
      boundBoxFunc={(oldBox, newBox) => {
        // Prevent resize below a minimum size
        if (newBox.width < 10 || newBox.height < 10) return oldBox
        return newBox
      }}
      onTransformEnd={handleTransformEnd}
      anchorStroke="#2563eb"
      anchorFill="#ffffff"
      anchorSize={8}
      borderStroke="#2563eb"
      borderDash={[3, 3]}
    />
  )
}
