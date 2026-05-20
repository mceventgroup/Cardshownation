'use client'

import { useCallback, useEffect, useState } from 'react'
import { useEditorStore, selectAssignmentMap, selectTables, selectSelectedIds, selectActiveVendorId } from '@/store/index'
import { formatDimension } from '@/lib/units'
import type { LayoutCommand } from '@/domain/commands'
import type { TableId } from '@/domain/types'
import { createAssignmentId } from '@/lib/id'
import { DRAFT_LAYOUT_ID } from '@/lib/defaults'

function clamp(raw: string, min: number, max: number, def: number): number {
  const n = parseInt(raw, 10)
  if (isNaN(n)) return def
  return Math.max(min, Math.min(max, n))
}

function normalizeRotation(raw: string, def: number): number {
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return def
  const normalized = ((n % 360) + 360) % 360
  return Math.round(normalized * 10) / 10
}

function stepRotation(value: number, delta: number): number {
  return Math.round(((((value + delta) % 360) + 360) % 360) * 10) / 10
}

export default function TablePropertiesPanel() {
  const tables = useEditorStore(selectTables)
  const selectedIds = useEditorStore(selectSelectedIds)
  const assignmentMap = useEditorStore(selectAssignmentMap)
  const activeVendorId = useEditorStore(selectActiveVendorId)
  const vendors = useEditorStore(s => s.vendors)
  const dispatch = useEditorStore(s => s.dispatch)

  const tableId = selectedIds.size === 1 ? [...selectedIds][0] : null
  const table = tableId ? tables[tableId] : null
  const assignment = table ? assignmentMap.get(table.id) ?? null : null
  const activeVendor = activeVendorId ? vendors[activeVendorId] : null

  if (!table || table.rowId) return null

  return (
    <TablePropertiesForm
      key={table.id}
      tableId={table.id}
      width={table.width}
      height={table.height}
      x={table.x}
      y={table.y}
      rotation={table.rotation}
      label={table.displayId}
      isVertical={table.height > table.width}
      isPremium={table.premium}
      vendorName={assignment?.vendorName ?? null}
      vendorCategory={assignment?.vendorCategory ?? null}
      hasAssignment={Boolean(assignment)}
      activeVendorName={activeVendor ? (activeVendor.companyName || activeVendor.name) : null}
      onAssignActiveVendor={() => {
        if (!activeVendorId || !activeVendor) return
        dispatch({
          type: 'ASSIGN_VENDOR',
          assignment: {
            id: createAssignmentId(),
            tableId: table.id as TableId,
            layoutId: DRAFT_LAYOUT_ID,
            vendorId: activeVendorId,
            vendorName: activeVendor.companyName || activeVendor.name,
            vendorCategory: activeVendor.category,
            colorOverride: null,
            notes: null,
            paymentStatus: activeVendor.paymentStatus,
            importSessionId: null,
          },
          prevAssignment: assignment,
          timestamp: Date.now(),
        })
      }}
      onClearAssignment={() => {
        if (!assignment) return
        dispatch({ type: 'CLEAR_VENDOR_ASSIGNMENT', assignment, timestamp: Date.now() })
      }}
      onTogglePremium={() => {
        dispatch({
          type: 'SET_TABLE_PREMIUM',
          tableIds: [table.id as TableId],
          premium: !table.premium,
          prev: { [table.id]: table.premium },
          timestamp: Date.now(),
        })
      }}
      dispatch={dispatch}
    />
  )
}

interface FormProps {
  tableId: string
  width: number
  height: number
  x: number
  y: number
  rotation: number
  label: string
  isVertical: boolean
  isPremium: boolean
  vendorName: string | null
  vendorCategory: string | null
  hasAssignment: boolean
  activeVendorName: string | null
  onAssignActiveVendor: () => void
  onClearAssignment: () => void
  onTogglePremium: () => void
  dispatch: (cmd: LayoutCommand) => void
}

function TablePropertiesForm({
  tableId,
  width,
  height,
  x,
  y,
  rotation,
  label,
  isVertical,
  isPremium,
  vendorName,
  vendorCategory,
  hasAssignment,
  activeVendorName,
  onAssignActiveVendor,
  onClearAssignment,
  onTogglePremium,
  dispatch,
}: FormProps) {
  const length = Math.max(width, height)
  const tableWidth = Math.min(width, height)

  const [lengthStr, setLengthStr] = useState(String(length))
  const [widthStr, setWidthStr] = useState(String(tableWidth))
  const [rotationStr, setRotationStr] = useState(String(rotation))

  useEffect(() => {
    setLengthStr(String(Math.max(width, height)))
    setWidthStr(String(Math.min(width, height)))
    setRotationStr(String(rotation))
  }, [width, height, rotation])

  const applySize = useCallback((newLength: number, newWidth: number, vertical: boolean) => {
    const nextW = vertical ? newWidth : newLength
    const nextH = vertical ? newLength : newWidth
    if (nextW === width && nextH === height) return
    dispatch({
      type: 'RESIZE_TABLE',
      tableId: tableId as TableId,
      prev: { x, y, width, height },
      next: { x, y, width: nextW, height: nextH },
      timestamp: Date.now(),
    })
  }, [tableId, x, y, width, height, dispatch])

  const rotateTo = useCallback((nextRotation: number) => {
    if (nextRotation === rotation) return
    dispatch({
      type: 'ROTATE_TABLES',
      rotations: [{
        tableId: tableId as TableId,
        prevRotation: rotation,
        nextRotation,
      }],
      timestamp: Date.now(),
    })
  }, [dispatch, rotation, tableId])

  const handleLengthBlur = useCallback(() => {
    const val = clamp(lengthStr, 12, 240, length)
    setLengthStr(String(val))
    applySize(val, Math.min(width, height), isVertical)
  }, [lengthStr, length, width, height, isVertical, applySize])

  const handleWidthBlur = useCallback(() => {
    const val = clamp(widthStr, 6, 120, tableWidth)
    setWidthStr(String(val))
    applySize(Math.max(width, height), val, isVertical)
  }, [widthStr, tableWidth, width, height, isVertical, applySize])

  const handleRotationBlur = useCallback(() => {
    const nextRotation = normalizeRotation(rotationStr, rotation)
    setRotationStr(String(nextRotation))
    rotateTo(nextRotation)
  }, [rotationStr, rotation, rotateTo])

  const nudgeRotation = useCallback((delta: number) => {
    const currentRotation = normalizeRotation(rotationStr, rotation)
    const nextRotation = stepRotation(currentRotation, delta)
    setRotationStr(String(nextRotation))
    rotateTo(nextRotation)
  }, [rotationStr, rotation, rotateTo])

  return (
    <div className="space-y-4 px-4 py-4 text-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Table {label}</h3>
            <p className="text-xs text-slate-500">{tableWidth === 60 && length === 60 ? 'Round table' : 'Rectangle table'}</p>
          </div>
          {isPremium && <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">Premium</span>}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Vendor</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{vendorName ?? 'Open table'}</div>
          <div className="mt-1 text-xs text-slate-500">{vendorCategory ?? 'Notes ready when vendor notes ship'}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeVendorName && (
              <button onClick={onAssignActiveVendor} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                Assign {activeVendorName}
              </button>
            )}
            {hasAssignment && (
              <button onClick={onClearAssignment} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                Clear Vendor
              </button>
            )}
            <button onClick={onTogglePremium} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100">
              {isPremium ? 'Remove Premium' : 'Mark Premium'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">Dimensions</h4>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Length ({formatDimension(clamp(lengthStr, 12, 240, length))})
            </span>
            <input
              type="number"
              min={12}
              max={240}
              value={lengthStr}
              onChange={e => setLengthStr(e.target.value)}
              onBlur={handleLengthBlur}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Width ({formatDimension(clamp(widthStr, 6, 120, tableWidth))})
            </span>
            <input
              type="number"
              min={6}
              max={120}
              value={widthStr}
              onChange={e => setWidthStr(e.target.value)}
              onBlur={handleWidthBlur}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Rotation ({normalizeRotation(rotationStr, rotation)} deg)
            </span>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => nudgeRotation(-1)}
                className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                -1
              </button>
              <input
                type="number"
                step="0.1"
                value={rotationStr}
                onChange={e => setRotationStr(e.target.value)}
                onBlur={handleRotationBlur}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => nudgeRotation(1)}
                className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                +1
              </button>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
