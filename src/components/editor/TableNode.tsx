'use client'

import React, { memo, useEffect, useRef } from 'react'
import { Ellipse, Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { Point, TableObject } from '@/domain/types'
import type { WarningSeverity } from '@/domain/warnings'
import {
  CAUTION_TABLE_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TABLE_FILL,
  DEFAULT_TABLE_STROKE,
  SELECTED_STROKE_WIDTH,
  SELECTED_TABLE_STROKE,
  WARNING_TABLE_STROKE,
} from '@/lib/defaults'

interface TableNodeProps {
  table: TableObject
  isSelected: boolean
  isPremium?: boolean
  isDuplicate?: boolean
  warningSeverity?: WarningSeverity | null
  draftPos: Point | null
  fillColor?: string
  vendorName?: string
  vendorCategory?: string | null
  isHoveredVendor?: boolean
  isActiveVendor?: boolean
  isRecentlyAssigned?: boolean
  isSuggestedTarget?: boolean
  isSuggestedPremiumTarget?: boolean
  onRegister: (id: string, node: Konva.Node | null) => void
  onDoubleClick: (tableId: string) => void
  onHoverStart?: (tableId: string) => void
  onHoverEnd?: () => void
}

function getContrastText(fill: string, selected: boolean): string {
  if (selected) return '#0f172a'
  const hex = fill.trim()
  if (!hex.startsWith('#')) return '#0f172a'
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex
  if (normalized.length !== 7) return '#0f172a'
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.58 ? '#0f172a' : '#ffffff'
}

function vendorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
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
  vendorCategory,
  isHoveredVendor,
  isActiveVendor,
  isRecentlyAssigned,
  isSuggestedTarget,
  isSuggestedPremiumTarget,
  onRegister,
  onDoubleClick,
  onHoverStart,
  onHoverEnd,
}: TableNodeProps) {
  const shapeRef = useRef<Konva.Rect | Konva.Ellipse>(null)

  useEffect(() => {
    const node = shapeRef.current
    if (node) onRegister(table.id, node)
    return () => onRegister(table.id, null)
  }, [table.id, onRegister])

  const x = draftPos?.x ?? table.x
  const y = draftPos?.y ?? table.y
  const w = table.width
  const h = table.height
  const effectiveFill = fillColor ?? DEFAULT_TABLE_FILL
  const hasWarning = warningSeverity === 'error' || warningSeverity === 'warning' || isDuplicate
  const candidateHighlight = isSuggestedPremiumTarget ? '#f59e0b' : isSuggestedTarget ? '#94a3b8' : null
  const vendorHighlight = isActiveVendor ? '#0f766e' : isHoveredVendor ? '#14b8a6' : candidateHighlight
  const strokeColor = hasWarning
    ? (warningSeverity === 'warning' ? CAUTION_TABLE_STROKE : WARNING_TABLE_STROKE)
    : vendorHighlight ?? (isSelected ? SELECTED_TABLE_STROKE : DEFAULT_TABLE_STROKE)
  const strokeWidth = hasWarning
    ? SELECTED_STROKE_WIDTH
    : isActiveVendor
      ? 3
      : isSuggestedPremiumTarget
        ? 2.5
        : isHoveredVendor || isSelected || isSuggestedTarget
        ? SELECTED_STROKE_WIDTH
        : DEFAULT_STROKE_WIDTH
  const labelColor = getContrastText(effectiveFill, isSelected)
  const vendorBadgeColor = labelColor === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.08)'

  const shapeProps = {
    id: table.id,
    name: 'table-rect',
    fill: effectiveFill,
    stroke: strokeColor,
    strokeWidth,
    shadowEnabled: isSelected || isHoveredVendor || isActiveVendor || isRecentlyAssigned || isSuggestedTarget || isSuggestedPremiumTarget,
    shadowColor: isRecentlyAssigned ? '#22c55e' : isActiveVendor ? '#0f766e' : isHoveredVendor ? '#14b8a6' : isSuggestedPremiumTarget ? '#f59e0b' : '#64748b',
    shadowBlur: isRecentlyAssigned ? 12 : isActiveVendor ? 10 : isHoveredVendor ? 7 : isSuggestedPremiumTarget ? 8 : isSuggestedTarget ? 5 : 4,
    shadowOpacity: isRecentlyAssigned ? 0.55 : isActiveVendor ? 0.4 : isHoveredVendor ? 0.3 : isSuggestedPremiumTarget ? 0.35 : isSuggestedTarget ? 0.2 : 0.25,
    onDblClick: () => onDoubleClick(table.id),
    onMouseEnter: () => onHoverStart?.(table.id),
    onMouseLeave: () => onHoverEnd?.(),
  }

  const hasVendorDetails = Boolean(vendorName)
  const categoryText = vendorCategory?.trim() || null
  const showVendorDetails = hasVendorDetails && w >= 72 && h >= 44
  const showVendorInitials = hasVendorDetails && !showVendorDetails && w >= 52 && h >= 34
  const topInset = 3
  const numberBandHeight = showVendorDetails
    ? Math.max(11, Math.min(18, h * 0.24))
    : Math.max(10, h - (showVendorInitials ? 15 : 4))
  const detailsTop = topInset + numberBandHeight
  const bottomInset = showVendorDetails ? 4 : showVendorInitials ? 15 : 2
  const detailsHeight = Math.max(0, h - detailsTop - bottomInset)
  const labelFontSize = showVendorDetails
    ? Math.min(14, Math.max(9, numberBandHeight * 0.72))
    : Math.min(22, Math.max(11, Math.min(w, Math.max(10, h - topInset - bottomInset)) / 1.9))
  const vendorNameFontSize = Math.min(13, Math.max(8, Math.min(w / 7.2, Math.max(10, detailsHeight) / 2.4)))
  const categoryFontSize = Math.min(10, Math.max(7, vendorNameFontSize - 1))

  return (
    <Group x={x} y={y} rotation={table.rotation}>
      {table.shape === 'round' ? (
        <Ellipse
          ref={shapeRef as React.RefObject<Konva.Ellipse>}
          radiusX={w / 2}
          radiusY={h / 2}
          offsetX={-w / 2}
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

      <Text
        text={table.displayId || String(table.tableNumber)}
        width={w}
        height={numberBandHeight}
        y={topInset}
        align="center"
        verticalAlign="middle"
        fontSize={labelFontSize}
        fontFamily="system-ui, sans-serif"
        fill={labelColor}
        fontStyle="bold"
        listening={false}
      />

      {showVendorDetails && vendorName && (
        <>
          <Text
            text={vendorName}
            x={4}
            y={detailsTop}
            width={Math.max(0, w - 8)}
            height={categoryText ? Math.max(10, detailsHeight - 12) : detailsHeight}
            align="center"
            verticalAlign="middle"
            fontSize={vendorNameFontSize}
            lineHeight={1.05}
            fontFamily="system-ui, sans-serif"
            fill={labelColor}
            fontStyle="bold"
            wrap="word"
            ellipsis
            listening={false}
          />
          {categoryText && (
            <Text
              text={categoryText}
              x={4}
              y={Math.max(detailsTop + detailsHeight - 11, detailsTop)}
              width={Math.max(0, w - 8)}
              height={10}
              align="center"
              verticalAlign="middle"
              fontSize={categoryFontSize}
              fontFamily="system-ui, sans-serif"
              fill={labelColor}
              opacity={0.82}
              wrap="none"
              ellipsis
              listening={false}
            />
          )}
        </>
      )}

      {showVendorInitials && vendorName && (
        <>
          <Rect
            x={4}
            y={h - 13}
            width={Math.min(20, w - 8)}
            height={9}
            cornerRadius={4}
            fill={vendorBadgeColor}
            listening={false}
          />
          <Text
            text={vendorInitials(vendorName)}
            width={Math.min(20, w - 8)}
            height={9}
            x={4}
            y={h - 13}
            align="center"
            verticalAlign="middle"
            fontSize={7}
            fontFamily="system-ui, sans-serif"
            fill={labelColor}
            fontStyle="bold"
            listening={false}
          />
        </>
      )}

      {isPremium && (
        <>
          <Line
            points={[w - 16, 0, w, 0, w, 16]}
            fill="#f59e0b"
            closed
            listening={false}
          />
          <Text
            text="P"
            x={w - 12}
            y={1}
            width={10}
            height={10}
            align="center"
            verticalAlign="middle"
            fontSize={7}
            fontFamily="system-ui, sans-serif"
            fill="#ffffff"
            fontStyle="bold"
            listening={false}
          />
        </>
      )}
    </Group>
  )
})

export default TableNode
