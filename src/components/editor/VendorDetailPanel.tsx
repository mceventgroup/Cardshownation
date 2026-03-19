'use client'

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR DETAIL PANEL
//
// Shown when exactly one table is selected. Quick-assign for unassigned tables,
// full edit form for assigned tables. All changes are undoable.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditorStore, selectTables, selectAssignmentMap } from '@/store/index'
import { createAssignmentId } from '@/lib/id'
import { DRAFT_LAYOUT_ID } from '@/lib/defaults'
import type { TableId, VendorAssignment, PaymentStatus, VendorAssignmentId } from '@/domain/types'

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'unknown', label: 'Unknown', color: '#9ca3af' },
  { value: 'unpaid',  label: 'Unpaid',  color: '#ef4444' },
  { value: 'partial', label: 'Partial', color: '#f59e0b' },
  { value: 'paid',    label: 'Paid',    color: '#10b981' },
  { value: 'comped',  label: 'Comped',  color: '#8b5cf6' },
]

interface VendorDetailPanelProps {
  tableId: string
}

export default function VendorDetailPanel({ tableId }: VendorDetailPanelProps) {
  const tables        = useEditorStore(selectTables)
  const assignmentMap = useEditorStore(selectAssignmentMap)
  const dispatch      = useEditorStore(s => s.dispatch)

  const table = tables[tableId]
  const assignment = assignmentMap.get(tableId)

  const nameRef = useRef<HTMLInputElement>(null)

  // Quick-assign state
  const [quickName, setQuickName] = useState('')

  // Edit state
  const [editName, setEditName]         = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editNotes, setEditNotes]       = useState('')
  const [editPayment, setEditPayment]   = useState<PaymentStatus>('unknown')

  // Sync edit fields when assignment changes
  useEffect(() => {
    if (assignment) {
      setEditName(assignment.vendorName)
      setEditCategory(assignment.vendorCategory ?? '')
      setEditNotes(assignment.notes ?? '')
      setEditPayment(assignment.paymentStatus)
    } else {
      setQuickName('')
    }
  }, [assignment?.id, tableId])

  // Auto-focus the name input
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [tableId, !!assignment])

  const handleQuickAssign = useCallback(() => {
    const name = quickName.trim()
    if (!name) return

    const newAssignment: VendorAssignment = {
      id: createAssignmentId(),
      tableId: tableId as TableId,
      layoutId: DRAFT_LAYOUT_ID,
      vendorName: name,
      vendorCategory: null,
      colorOverride: null,
      notes: null,
      paymentStatus: 'unknown',
      importSessionId: null,
    }

    dispatch({
      type: 'ASSIGN_VENDOR',
      assignment: newAssignment,
      prevAssignment: null,
      timestamp: Date.now(),
    })

    setQuickName('')
  }, [quickName, tableId, dispatch])

  const handleUpdateField = useCallback((
    field: keyof Pick<VendorAssignment, 'vendorName' | 'vendorCategory' | 'notes' | 'paymentStatus'>,
    value: string,
  ) => {
    if (!assignment) return
    const current = assignment[field]
    const next = value || null
    if (current === next || (current === null && value === '')) return

    dispatch({
      type: 'UPDATE_VENDOR_ASSIGNMENT',
      assignmentId: assignment.id as VendorAssignmentId,
      prev: { [field]: current },
      next: { [field]: next },
      timestamp: Date.now(),
    })
  }, [assignment, dispatch])

  const handleClear = useCallback(() => {
    if (!assignment) return
    dispatch({
      type: 'CLEAR_VENDOR_ASSIGNMENT',
      assignment,
      timestamp: Date.now(),
    })
  }, [assignment, dispatch])

  if (!table) return null

  const paymentColor = PAYMENT_OPTIONS.find(p => p.value === (assignment?.paymentStatus ?? 'unknown'))?.color ?? '#9ca3af'

  return (
    <div className="absolute bottom-2 left-2 z-10 w-72 bg-white rounded-lg shadow-lg border border-gray-200 text-sm">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Table {table.label}</h3>
          {assignment && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium text-white"
              style={{ backgroundColor: paymentColor }}
            >
              {PAYMENT_OPTIONS.find(p => p.value === assignment.paymentStatus)?.label}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {!assignment ? (
          /* ── Unassigned: quick-assign ─────────────────────────────────── */
          <div>
            <p className="text-xs text-gray-400 mb-2">No vendor assigned</p>
            <div className="flex gap-1.5">
              <input
                ref={nameRef}
                value={quickName}
                onChange={e => setQuickName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleQuickAssign()
                  e.stopPropagation()
                }}
                placeholder="Vendor name"
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              />
              <button
                onClick={handleQuickAssign}
                disabled={!quickName.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded text-xs transition-colors whitespace-nowrap"
              >
                Assign
              </button>
            </div>
          </div>
        ) : (
          /* ── Assigned: edit form ──────────────────────────────────────── */
          <div className="space-y-2.5">
            <label className="block">
              <span className="text-gray-600 text-xs">Vendor Name</span>
              <input
                ref={nameRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => handleUpdateField('vendorName', editName)}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  e.stopPropagation()
                }}
                className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>

            <label className="block">
              <span className="text-gray-600 text-xs">Category</span>
              <input
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                onBlur={() => handleUpdateField('vendorCategory', editCategory)}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  e.stopPropagation()
                }}
                placeholder="e.g. Sports Cards, Pokemon, Vintage"
                className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>

            <label className="block">
              <span className="text-gray-600 text-xs">Payment Status</span>
              <select
                value={editPayment}
                onChange={e => {
                  const val = e.target.value as PaymentStatus
                  setEditPayment(val)
                  handleUpdateField('paymentStatus', val)
                }}
                className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {PAYMENT_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-gray-600 text-xs">Notes</span>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                onBlur={() => handleUpdateField('notes', editNotes)}
                onKeyDown={e => e.stopPropagation()}
                rows={2}
                placeholder="Internal notes..."
                className="mt-0.5 w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>

            <button
              onClick={handleClear}
              className="w-full px-2 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded text-xs font-medium transition-colors"
            >
              Clear Assignment
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
