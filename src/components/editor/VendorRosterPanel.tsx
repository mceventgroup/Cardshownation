'use client'

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR ROSTER PANEL
//
// Left-side panel for managing vendor roster and assigning vendors to tables.
// Workflow: add vendors → click a vendor to activate → click tables to assign.
// Shows assigned/needed count per vendor.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  useEditorStore,
  selectVendors,
  selectActiveVendorId,
  selectVendorAssignments,
  selectTables,
} from '@/store/index'
import { createVendorId, createAssignmentId } from '@/lib/id'
import { expandTableNumbers } from '@/domain/csv-import.impl'
import { vendorColor } from '@/lib/defaults'
import type { Vendor, VendorId, PaymentStatus, TableId } from '@/domain/types'
import { autoAssignVendors } from '@/domain/auto-assign'
import { DRAFT_LAYOUT_ID } from '@/lib/defaults'

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; bg: string }> = {
  unknown: { label: '?',      bg: '#9ca3af' },
  unpaid:  { label: 'Unpaid', bg: '#ef4444' },
  partial: { label: 'Partial',bg: '#f59e0b' },
  paid:    { label: 'Paid',   bg: '#10b981' },
  comped:  { label: 'Comped', bg: '#8b5cf6' },
}

export default function VendorRosterPanel() {
  const vendors        = useEditorStore(selectVendors)
  const activeVendorId = useEditorStore(selectActiveVendorId)
  const assignments    = useEditorStore(selectVendorAssignments)
  const tables         = useEditorStore(selectTables)
  const dispatch       = useEditorStore(s => s.dispatch)
  const addVendor      = useEditorStore(s => s.addVendor)
  const updateVendor   = useEditorStore(s => s.updateVendor)
  const removeVendor   = useEditorStore(s => s.removeVendor)
  const setActiveVendor = useEditorStore(s => s.setActiveVendor)

  const [autoAssignMsg, setAutoAssignMsg] = useState<string | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [newName, setNewName] = useState('')
  const [newCount, setNewCount] = useState('1')
  const [search, setSearch]   = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCount, setEditCount] = useState('')
  const setSelected = useEditorStore(s => s.setSelected)

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addMode) setTimeout(() => nameRef.current?.focus(), 50)
  }, [addMode])

  // Count assigned tables per vendor (by ID) and collect their table labels
  const vendorTableInfo = useMemo(() => {
    const counts = new Map<string, number>()
    const tableLabels = new Map<string, string[]>()
    for (const a of Object.values(assignments)) {
      const key = a.vendorId
      counts.set(key, (counts.get(key) ?? 0) + 1)
      const t = tables[a.tableId]
      const label = t?.label ?? a.tableId
      const existing = tableLabels.get(key)
      if (existing) existing.push(label)
      else tableLabels.set(key, [label])
    }
    return { counts, tableLabels }
  }, [assignments, tables])

  const vendorList = useMemo(() =>
    Object.values(vendors).sort((a, b) => a.name.localeCompare(b.name)),
    [vendors],
  )

  const filtered = useMemo(() => {
    if (!search) return vendorList
    const q = search.toLowerCase()
    return vendorList.filter(v => v.name.toLowerCase().includes(q))
  }, [vendorList, search])

  const totalTables = Object.keys(tables).length
  const totalAssigned = Object.keys(assignments).length

  function handleAddSingle() {
    const name = newName.trim()
    if (!name) return
    const vendor: Vendor = {
      id: createVendorId(),
      name,
      tablesNeeded: Math.max(1, parseInt(newCount) || 1),
      category: null,
      paymentStatus: 'unknown',
      notes: null,
    }
    addVendor(vendor)
    setNewName('')
    setNewCount('1')
    nameRef.current?.focus()
  }

  function handleBulkAdd() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    // Detect if data is tab-separated (e.g. pasted from spreadsheet)
    const isTabSeparated = lines.some(l => l.includes('\t'))

    // Build table lookup by label for direct assignment
    const tablesByLabel = new Map<string, TableId>()
    for (const t of Object.values(tables)) {
      tablesByLabel.set(t.label.toLowerCase().trim(), t.id)
    }
    const existingAssignments = Object.values(
      useEditorStore.getState().vendorAssignments,
    )
    const assignedTableIds = new Set(existingAssignments.map(a => a.tableId))

    // Collect all assignments for a single batch undo step
    const batchCreated: import('@/domain/types').VendorAssignment[] = []
    const batchReplaced: import('@/domain/types').VendorAssignment[] = []

    for (const line of lines) {
      if (isTabSeparated) {
        // Tab-separated: FirstName\tLastName\tTableNumbers
        // or: Name\tTableNumbers
        const cols = line.split('\t').map(c => c.trim())
        let name: string
        let tableStr: string

        if (cols.length >= 3) {
          // FirstName, LastName, Tables
          name = `${cols[0]} ${cols[1]}`
          tableStr = cols[2]
        } else if (cols.length === 2) {
          // Name, Tables (or Name, Count)
          name = cols[0]
          tableStr = cols[1]
        } else {
          name = cols[0]
          tableStr = ''
        }

        if (!name) continue

        // Expand table numbers (e.g. "33-34" → ["33","34"])
        const expanded = expandTableNumbers(tableStr)
        const count = expanded.length > 0 ? expanded.length : (parseInt(tableStr) || 1)

        const vendorId = createVendorId()
        addVendor({
          id: vendorId,
          name,
          tablesNeeded: count,
          category: null,
          paymentStatus: 'unknown',
          notes: null,
        })

        // Collect assignments to matching tables on the floor plan
        if (expanded.length > 0) {
          for (const tableLabel of expanded) {
            const tableId = tablesByLabel.get(tableLabel.toLowerCase().trim())
            if (tableId && !assignedTableIds.has(tableId)) {
              const prev = existingAssignments.find(a => a.tableId === tableId)
              if (prev) batchReplaced.push(prev)
              batchCreated.push({
                id: createAssignmentId(),
                tableId,
                layoutId: DRAFT_LAYOUT_ID,
                vendorId,
                vendorName: name,
                vendorCategory: null,
                colorOverride: null,
                notes: null,
                paymentStatus: 'unknown',
                importSessionId: null,
              })
              assignedTableIds.add(tableId)
            }
          }
        }
      } else {
        // Comma-separated: "Name, count" or just "Name"
        const parts = line.split(',').map(p => p.trim())
        const name = parts[0]
        const count = parts[1] ? parseInt(parts[1]) || 1 : 1
        if (name) {
          addVendor({
            id: createVendorId(),
            name,
            tablesNeeded: count,
            category: null,
            paymentStatus: 'unknown',
            notes: null,
          })
        }
      }
    }

    // Dispatch all assignments as a single undoable action
    if (batchCreated.length > 0) {
      dispatch({
        type: 'BATCH_ASSIGN_VENDORS',
        timestamp: Date.now(),
        createdAssignments: batchCreated,
        replacedAssignments: batchReplaced,
      })
    }

    setBulkText('')
    setAddMode(false)
  }

  function handleActivate(vendorId: VendorId) {
    if (activeVendorId === vendorId) {
      setActiveVendor(null)
    } else {
      setActiveVendor(vendorId)
    }
  }

  function handleRemove(vendorId: VendorId) {
    if (activeVendorId === vendorId) setActiveVendor(null)
    removeVendor(vendorId)
  }

  function handleAutoAssign() {
    const result = autoAssignVendors(tables, vendors, assignments)
    if (result.assignments.length === 0) {
      setAutoAssignMsg('No tables could be assigned. Add vendors and unassigned tables first.')
      setTimeout(() => setAutoAssignMsg(null), 4000)
      return
    }

    // Dispatch each assignment
    for (const a of result.assignments) {
      const existing = Object.values(assignments).find(x => x.tableId === a.tableId)
      dispatch({
        type: 'ASSIGN_VENDOR',
        assignment: {
          id: createAssignmentId(),
          tableId: a.tableId,
          layoutId: DRAFT_LAYOUT_ID,
          vendorId: a.vendorId,
          vendorName: a.vendorName,
          vendorCategory: a.vendorCategory,
          colorOverride: null,
          notes: null,
          paymentStatus: a.paymentStatus,
          importSessionId: null,
        },
        prevAssignment: existing ?? null,
        timestamp: Date.now(),
      })
    }

    const msgs: string[] = [`Assigned ${result.assignments.length} tables.`]
    if (result.unassignedVendors.length > 0) {
      msgs.push(`${result.unassignedVendors.length} vendor(s) couldn't be fully placed.`)
    }
    setAutoAssignMsg(msgs.join(' '))
    setTimeout(() => setAutoAssignMsg(null), 5000)
  }

  return (
    <div className="text-sm flex flex-col">
      {/* Summary stats */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0 space-y-1.5">
        <div className="flex gap-3 text-xs">
          <span><span className="font-semibold text-gray-800">{vendorList.length}</span> <span className="text-gray-400">vendors</span></span>
          <span><span className="font-semibold text-gray-800">{totalAssigned}</span><span className="text-gray-400">/{totalTables} tables</span></span>
          <span className={`font-medium ${totalAssigned === totalTables && totalTables > 0 ? 'text-green-600' : 'text-amber-600'}`}>
            {totalTables > 0 ? Math.round((totalAssigned / totalTables) * 100) : 0}%
          </span>
        </div>
        {vendorList.length > 0 && totalTables > totalAssigned && (
          <button
            onClick={handleAutoAssign}
            className="w-full px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            Auto Assign Remaining
          </button>
        )}
      </div>
      {autoAssignMsg && (
        <div className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-700 shrink-0">
          {autoAssignMsg}
        </div>
      )}

      {/* Active vendor indicator */}
      {activeVendorId && vendors[activeVendorId] && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 shrink-0">
          <p className="text-xs text-blue-600 font-medium">
            Assigning: <strong>{vendors[activeVendorId].name}</strong>
          </p>
          <p className="text-xs text-blue-400">Click tables on canvas to assign</p>
        </div>
      )}

      {/* Search */}
      {vendorList.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Search vendors..."
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}

      {/* Vendor list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && vendorList.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No vendors yet. Add vendors below.</p>
        )}
        {filtered.length === 0 && vendorList.length > 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No matching vendors</p>
        )}
        {filtered.map(v => {
          const assigned = vendorTableInfo.counts.get(v.id) ?? 0
          const isActive = activeVendorId === v.id
          const isFull = assigned >= v.tablesNeeded
          const badge = PAYMENT_BADGE[v.paymentStatus]

          return (
            <div
              key={v.id}
              className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 cursor-pointer transition-colors group ${
                isActive ? 'bg-blue-100 border-blue-200' : 'hover:bg-gray-50'
              }`}
              onClick={() => handleActivate(v.id)}
            >
              {/* Color swatch */}
              <div
                className="w-3 h-3 rounded-sm shrink-0 border border-gray-200"
                style={{ backgroundColor: vendorColor(v.id) }}
              />

              {/* Name + count */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`font-medium truncate ${isActive ? 'text-blue-800' : 'text-gray-800'}`}>
                    {v.name}
                  </span>
                  <span
                    className="text-xs px-1 py-0.5 rounded text-white shrink-0"
                    style={{ backgroundColor: badge.bg }}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-xs ${isFull ? 'text-green-600' : assigned > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {assigned} of {v.tablesNeeded} tables assigned
                  </span>
                  {isFull && assigned === v.tablesNeeded && <span className="text-green-500 text-xs">✓</span>}
                  {assigned > v.tablesNeeded && <span className="text-red-500 text-xs font-bold">over!</span>}
                </div>
                {assigned > 0 && (
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    Tables: {(vendorTableInfo.tableLabels.get(v.id) ?? []).sort((a, b) => {
                      const na = parseInt(a), nb = parseInt(b)
                      if (!isNaN(na) && !isNaN(nb)) return na - nb
                      return a.localeCompare(b)
                    }).join(', ')}
                  </div>
                )}
              </div>

              {/* Select tables on canvas */}
              {assigned > 0 && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    // Find all table IDs assigned to this vendor
                    const tableIds = Object.values(assignments)
                      .filter(a => a.vendorId === v.id)
                      .map(a => a.tableId)
                    setSelected(tableIds)
                  }}
                  title="Select tables on canvas"
                  className="text-xs text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  find
                </button>
              )}

              {/* Edit table count */}
              {editingId === v.id ? (
                <input
                  autoFocus
                  type="number"
                  min={1}
                  value={editCount}
                  onChange={e => setEditCount(e.target.value)}
                  onBlur={() => {
                    const n = Math.max(1, parseInt(editCount) || 1)
                    updateVendor(v.id, { tablesNeeded: n })
                    setEditingId(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingId(null)
                    e.stopPropagation()
                  }}
                  onClick={e => e.stopPropagation()}
                  className="w-12 px-1 py-0.5 border border-blue-400 rounded text-xs text-center"
                />
              ) : (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setEditingId(v.id)
                    setEditCount(String(v.tablesNeeded))
                  }}
                  title="Edit table count"
                  className="text-xs text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  edit
                </button>
              )}

              {/* Remove */}
              <button
                onClick={e => { e.stopPropagation(); handleRemove(v.id) }}
                title="Remove vendor"
                className="text-gray-300 hover:text-red-500 text-base leading-none opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
            </div>
          )
        })}
      </div>

      {/* Add vendor section */}
      <div className="px-3 py-3 border-t border-gray-100 shrink-0 space-y-2">
        {!addMode ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => setAddMode(true)}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs transition-colors"
            >
              + Add Vendor
            </button>
            <button
              onClick={() => setAddMode(true)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md text-xs transition-colors"
              title="Paste multiple vendors"
            >
              Paste List
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Single add */}
            <div className="flex gap-1.5 items-end">
              <label className="flex-1">
                <span className="text-xs text-gray-500">Vendor name</span>
                <input
                  ref={nameRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddSingle()
                    if (e.key === 'Escape') setAddMode(false)
                    e.stopPropagation()
                  }}
                  placeholder="Name"
                  className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </label>
              <label className="w-16">
                <span className="text-xs text-gray-500">Tables</span>
                <input
                  type="number"
                  min={1}
                  value={newCount}
                  onChange={e => setNewCount(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddSingle()
                    e.stopPropagation()
                  }}
                  className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                title="Tables needed"
              />
              </label>
              <button
                onClick={handleAddSingle}
                disabled={!newName.trim()}
                className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded text-xs"
              >
                Add
              </button>
            </div>

            {/* Bulk paste */}
            <div>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                rows={3}
                placeholder={"Paste vendor list:\nJohn Smith, 2\nJane Doe, 1\n\nOr paste from spreadsheet:\nFirst\tLast\tTables\nAaron\tWilson\t33-34"}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
              />
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={handleBulkAdd}
                  disabled={!bulkText.trim()}
                  className="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded text-xs"
                >
                  Add All
                </button>
                <button
                  onClick={() => { setAddMode(false); setBulkText(''); setNewName('') }}
                  className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
