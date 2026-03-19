'use client'

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR LIST PANEL
//
// Scrollable list of all vendor assignments with search and filter.
// Click a row to select that table on canvas.
// Toggle via G key.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { useEditorStore, selectTables, selectVendorAssignments } from '@/store/index'
import type { PaymentStatus, VendorAssignment } from '@/domain/types'

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; bg: string }> = {
  unknown: { label: '?',      bg: '#9ca3af' },
  unpaid:  { label: 'Unpaid', bg: '#ef4444' },
  partial: { label: 'Partial',bg: '#f59e0b' },
  paid:    { label: 'Paid',   bg: '#10b981' },
  comped:  { label: 'Comped', bg: '#8b5cf6' },
}

interface VendorListPanelProps {
  onClose: () => void
}

export default function VendorListPanel({ onClose }: VendorListPanelProps) {
  const tables      = useEditorStore(selectTables)
  const assignments = useEditorStore(selectVendorAssignments)
  const setSelected = useEditorStore(s => s.setSelected)

  const [search, setSearch]       = useState('')
  const [filterPayment, setFilterPayment] = useState<PaymentStatus | 'all'>('all')

  const assignmentList = useMemo(() =>
    Object.values(assignments).sort((a, b) =>
      a.vendorName.localeCompare(b.vendorName)
    ),
    [assignments],
  )

  const filtered = useMemo(() => {
    let list = assignmentList
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.vendorName.toLowerCase().includes(q) ||
        (a.vendorCategory?.toLowerCase().includes(q))
      )
    }
    if (filterPayment !== 'all') {
      list = list.filter(a => a.paymentStatus === filterPayment)
    }
    return list
  }, [assignmentList, search, filterPayment])

  const totalTables = Object.keys(tables).length
  const assignedCount = assignmentList.length
  const unassignedCount = totalTables - assignedCount

  return (
    <div className="absolute top-2 left-2 z-10 w-80 bg-white rounded-lg shadow-lg border border-gray-200 text-sm flex flex-col" style={{ maxHeight: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100 shrink-0">
        <h3 className="font-semibold text-gray-800">Vendors</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{assignedCount}/{totalTables} assigned</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="px-3 py-2 border-b border-gray-100 space-y-1.5 shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          placeholder="Search vendors..."
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <select
          value={filterPayment}
          onChange={e => setFilterPayment(e.target.value as PaymentStatus | 'all')}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="comped">Comped</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            {search ? 'No matching vendors' : 'No vendors assigned yet'}
          </p>
        )}
        {filtered.map(a => {
          const table = tables[a.tableId]
          const badge = PAYMENT_BADGE[a.paymentStatus]
          return (
            <button
              key={a.id}
              onClick={() => setSelected([a.tableId])}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-blue-50 text-left border-b border-gray-50 transition-colors"
            >
              <span className="text-xs font-mono text-gray-500 w-10 shrink-0">
                {table?.label ?? '?'}
              </span>
              <span className="flex-1 truncate text-gray-800 text-sm">
                {a.vendorName}
              </span>
              {a.vendorCategory && (
                <span className="text-xs text-gray-400 truncate max-w-20">
                  {a.vendorCategory}
                </span>
              )}
              <span
                className="text-xs px-1.5 py-0.5 rounded text-white font-medium shrink-0"
                style={{ backgroundColor: badge.bg }}
              >
                {badge.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 shrink-0">
        {unassignedCount > 0 && `${unassignedCount} table${unassignedCount !== 1 ? 's' : ''} unassigned`}
        {unassignedCount === 0 && 'All tables assigned'}
      </div>
    </div>
  )
}
