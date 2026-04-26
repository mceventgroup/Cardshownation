// ─────────────────────────────────────────────────────────────────────────────
// TABLE NODE
//
// Renders a single table as a Konva Group containing:
//   - A Rect (or Ellipse for round tables)
//   - A Text label centered in the shape
//
// Position is driven by draftPos (during drag) or table.x/y (committed).
// The Konva node is registered with the parent via onRegister so the
// Transformer can attach to it.
//
// Note: This component does NOT handle drag internally. All drag logic lives
// in KonvaCanvas to allow multi-table selection drags.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, useRef, useEffect } from 'react'
import { Group, Rect, Ellipse, Text } from 'react-konva'
import type Konva from 'konva'
import type { TableObject } from '@/domain/types'
import type { Point } from '@/domain/types'
import type { WarningSeverity } from '@/domain/warnings'
import {
  DEFAULT_TABLE_FILL,
  DEFAULT_TABLE_STROKE,
  SELECTED_TABLE_STROKE,
  WARNING_TABLE_STROKE,
  CAUTION_TABLE_STROKE,
  DEFAULT_STROKE_WIDTH,
  SELECTED_STROKE_WIDTH,
} from '@/lib/defaults'

interface TableNodeProps {
  table:        TableObject
  isSelected:   boolean
  isPremium?:   boolean
  isDuplicate?: boolean              // kept for backward compat, superseded by warningSeverity
  warningSeverity?: WarningSeverity | null  // highest severity warning on this table
  draftPos:     Point | null
  fillColor?:   string          // section or assignment color override
  vendorName?:  string          // shown as secondary label on assigned tables
  onRegister:   (id: string, node: Konva.Node | null) => void
  onDoubleClick: (tableId: string) => void
}

const TableNode = memo(function TableNode({
  table,
  isSelected,
  isPremium,
  isDuplicate,
  warningSeverity,
  draftPos,
  fillColor,
  vendorName,
  onRegister,
  onDoubleClick,
}: TableNodeProps) {
  const shapeRef = useRef<Konva.Rect | Konva.Ellipse>(null)

  // Register/unregister the shape node so TransformerControl can attach to it
  useEffect(() => {
    const node = shapeRef.current
    if (node) onRegister(table.id, node)
    return () => onRegister(table.id, null)
  }, [table.id, onRegister])

  const x         = draftPos?.x ?? table.x
  const y         = draftPos?.y ?? table.y
  const w         = table.width
  const h         = table.height
  const hasWarning = warningSeverity === 'error' || warningSeverity === 'warning' || isDuplicate
  const strokeColor  = hasWarning
    ? (warningSeverity === 'warning' ? CAUTION_TABLE_STROKE : WARNING_TABLE_STROKE)
    : isSelected ? SELECTED_TABLE_STROKE : DEFAULT_TABLE_STROKE
  const strokeWidth  = hasWarning ? SELECTED_STROKE_WIDTH : isSelected ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH

  const shapeProps = {
    id:          table.id,
    name:        'table-rect',       // used for hit detection in KonvaCanvas
    fill:        fillColor ?? DEFAULT_TABLE_FILL,
    stroke:      strokeColor,
    strokeWidth,
    shadowEnabled: isSelected,
    shadowColor:   '#2563eb',
    shadowBlur:    4,
    shadowOpacity: 0.3,
    onDblClick:  () => onDoubleClick(table.id),
  }

  const labelFontSize = Math.min(11, Math.max(7, Math.min(w, h) / 3.5))

  return (
    <Group
      x={x}
      y={y}
      rotation={table.rotation}
    >
      {table.shape === 'round' ? (
        <Ellipse
          ref={shapeRef as React.RefObject<Konva.Ellipse>}
          radiusX={w / 2}
          radiusY={h / 2}
          offsetX={-w / 2}  // Ellipse center is at 0,0; shift so top-left is 0,0
          offsetY={-h / 2}
          {...shapeProps}
        />
      ) : (
        <Rect
          ref={shapeRef as React.RefObject<Konva.Rect>}
          width={w}
          height={h}
          cornerRadius={2}
          {...shapeProps}
        />
      )}

      {/* Label + vendor name */}
      <Text
        text={table.label}
        width={w}
        height={vendorName ? h * 0.5 : h}
        y={vendorName ? 1 : 0}
        align="center"
        verticalAlign={vendorName ? 'bottom' : 'middle'}
        fontSize={labelFontSize}
        fontFamily="system-ui, sans-serif"
        fill={isSelected ? '#1e40af' : '#334155'}
        fontStyle="bold"
        listening={false}
      />
      {vendorName && (
        <Text
          text={vendorName}
          width={w}
          height={h * 0.5}
          y={h * 0.5 - 1}
          align="center"
          verticalAlign="top"
          fontSize={Math.max(5, labelFontSize - 2)}
          fontFamily="system-ui, sans-serif"
          fill={isSelected ? '#3b82f6' : '#64748b'}
          listening={false}
          ellipsis={true}
          wrap="none"
        />
      )}

      {/* Gold star badge for premium tables */}
      {isPremium && (
        <Text
          text="★"
          x={w - Math.min(w, h) * 0.28 - 1}
          y={1}
          width={Math.min(w, h) * 0.28}
          height={Math.min(w, h) * 0.28}
          align="center"
          verticalAlign="middle"
          fontSize={Math.min(10, Math.max(5, Math.min(w, h) * 0.22))}
          fontFamily="system-ui, sans-serif"
          fill="#d97706"
          listening={false}
        />
      )}
    </Group>
  )
})

export default TableNode
