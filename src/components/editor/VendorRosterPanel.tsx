'use client'

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
  unknown: { label: '?', bg: '#9ca3af' },
  unpaid: { label: 'Unpaid', bg: '#ef4444' },
  partial: { label: 'Partial', bg: '#f59e0b' },
  paid: { label: 'Paid', bg: '#10b981' },
  comped: { label: 'Comped', bg: '#8b5cf6' },
}

function vendorDisplayName(vendor: Vendor): string {
  return vendor.companyName || [vendor.firstName, vendor.lastName].filter(Boolean).join(' ') || vendor.name
}

function normalizeVendor(input: Partial<Vendor> & Pick<Vendor, 'id' | 'name' | 'tablesNeeded' | 'category' | 'paymentStatus' | 'notes' | 'premium'>): Vendor {
  return {
    ...input,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    companyName: input.companyName ?? null,
  }
}

export default function VendorRosterPanel() {
  const vendors = useEditorStore(selectVendors)
  const activeVendorId = useEditorStore(selectActiveVendorId)
  const assignments = useEditorStore(selectVendorAssignments)
  const tables = useEditorStore(selectTables)
  const dispatch = useEditorStore(s => s.dispatch)
  const addVendor = useEditorStore(s => s.addVendor)
  const updateVendor = useEditorStore(s => s.updateVendor)
  const removeVendor = useEditorStore(s => s.removeVendor)
  const setActiveVendor = useEditorStore(s => s.setActiveVendor)
  const setSelected = useEditorStore(s => s.setSelected)

  const [autoAssignMsg, setAutoAssignMsg] = useState<string | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [newName, setNewName] = useState('')
  const [newCount, setNewCount] = useState('1')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCount, setEditCount] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addMode) setTimeout(() => nameRef.current?.focus(), 50)
  }, [addMode])

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

  const vendorList = useMemo(
    () => Object.values(vendors).sort((a, b) => vendorDisplayName(a).localeCompare(vendorDisplayName(b))),
    [vendors],
  )

  const filtered = useMemo(() => {
    if (!search) return vendorList
    const q = search.toLowerCase()
    return vendorList.filter(v =>
      [
        vendorDisplayName(v),
        v.firstName ?? '',
        v.lastName ?? '',
        v.companyName ?? '',
        v.category ?? '',
      ].some(value => value.toLowerCase().includes(q)),
    )
  }, [vendorList, search])

  const totalTables = Object.keys(tables).length
  const totalAssigned = Object.keys(assignments).length

  function handleAddSingle() {
    const name = newName.trim()
    if (!name) return
    addVendor(normalizeVendor({
      id: createVendorId(),
      name,
      tablesNeeded: Math.max(1, parseInt(newCount, 10) || 1),
      category: null,
      paymentStatus: 'unknown',
      notes: null,
      premium: false,
    }))
    setNewName('')
    setNewCount('1')
    nameRef.current?.focus()
  }

  function handleBulkAdd() {
    const lines = bulkText.split('\n').map(line => line.trim()).filter(Boolean)
    const isTabSeparated = lines.some(line => line.includes('\t'))

    const tablesByLabel = new Map<string, TableId>()
    for (const t of Object.values(tables)) {
      tablesByLabel.set(t.label.toLowerCase().trim(), t.id)
    }

    const existingAssignments = Object.values(useEditorStore.getState().vendorAssignments)
    const assignedTableIds = new Set(existingAssignments.map(a => a.tableId))
    const batchCreated: import('@/domain/types').VendorAssignment[] = []
    const batchReplaced: import('@/domain/types').VendorAssignment[] = []

    for (const line of lines) {
      if (isTabSeparated) {
        const cols = line.split('\t').map(c => c.trim())
        const firstName = cols[0] ?? ''
        const lastName = cols[1] ?? ''
        const companyName = cols[2] ?? ''
        const category = cols[3] || null
        const qtyOrTables = cols[4] ?? ''
        const tableValues = expandTableNumbers(qtyOrTables)
        const displayName = companyName || [firstName, lastName].filter(Boolean).join(' ') || cols[0] || ''
        if (!displayName) continue

        const vendorId = createVendorId()
        addVendor(normalizeVendor({
          id: vendorId,
          name: displayName,
          firstName: firstName || null,
          lastName: lastName || null,
          companyName: companyName || null,
          tablesNeeded: Math.max(1, tableValues.length || parseInt(qtyOrTables, 10) || 1),
          category,
          paymentStatus: 'unknown',
          notes: null,
          premium: (category ?? '').toLowerCase() === 'premium',
        }))

        for (const tableLabel of tableValues) {
          const tableId = tablesByLabel.get(tableLabel.toLowerCase().trim())
          if (tableId && !assignedTableIds.has(tableId)) {
            const prev = existingAssignments.find(a => a.tableId === tableId)
            if (prev) batchReplaced.push(prev)
            batchCreated.push({
              id: createAssignmentId(),
              tableId,
              layoutId: DRAFT_LAYOUT_ID,
              vendorId,
              vendorName: displayName,
              vendorCategory: category,
              colorOverride: null,
              notes: null,
              paymentStatus: 'unknown',
              importSessionId: null,
            })
            assignedTableIds.add(tableId)
          }
        }
        continue
      }

      const parts = line.split(',').map(part => part.trim())
      const name = parts[0]
      const count = parts[1] ? parseInt(parts[1], 10) || 1 : 1
      if (!name) continue
      addVendor(normalizeVendor({
        id: createVendorId(),
        name,
        tablesNeeded: count,
        category: null,
        paymentStatus: 'unknown',
        notes: null,
        premium: false,
      }))
    }

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
    setActiveVendor(activeVendorId === vendorId ? null : vendorId)
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
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
          <span><span className="font-semibold text-gray-900">{vendorList.length}</span> vendors</span>
          <span><span className="font-semibold text-gray-900">{totalAssigned}</span>/{totalTables} tables assigned</span>
          <span className={totalAssigned === totalTables && totalTables > 0 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
            {totalTables > 0 ? Math.round((totalAssigned / totalTables) * 100) : 0}% filled
          </span>
          {vendorList.length > 0 && totalTables > totalAssigned && (
            <button
              onClick={handleAutoAssign}
              className="px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              Auto Assign Remaining
            </button>
          )}
        </div>
        {activeVendorId && vendors[activeVendorId] && (
          <div className="mt-2 text-xs text-blue-700">
            Assigning <strong>{vendorDisplayName(vendors[activeVendorId])}</strong>. Click tables on the canvas to assign.
          </div>
        )}
        {autoAssignMsg && (
          <div className="mt-2 text-xs text-emerald-700">{autoAssignMsg}</div>
        )}
      </div>

      <div className="px-4 py-2 border-b border-gray-200 shrink-0 flex items-center gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          placeholder="Search vendors, company, category..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={() => setAddMode(v => !v)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          {addMode ? 'Close' : 'Add Vendors'}
        </button>
      </div>

      {addMode && (
        <div className="px-4 py-3 border-b border-gray-200 shrink-0 space-y-3 bg-gray-50">
          <div className="flex gap-2 items-end">
            <label className="flex-1">
              <span className="text-xs text-gray-500">Display name</span>
              <input
                ref={nameRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddSingle()
                  if (e.key === 'Escape') setAddMode(false)
                  e.stopPropagation()
                }}
                placeholder="Name or company"
                className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
            <label className="w-24">
              <span className="text-xs text-gray-500">Quantity</span>
              <input
                type="number"
                min={1}
                value={newCount}
                onChange={e => setNewCount(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </label>
            <button
              onClick={handleAddSingle}
              disabled={!newName.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded text-sm"
            >
              Add
            </button>
          </div>

          <div>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              rows={4}
              placeholder={'Paste vendor list:\nFirst\tLast\tCompany\tCategory\tQuantity\nAaron\tMursch\tSenpai Nation\tPremium\t1\n\nOr simple:\nCard Castle, 2'}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleBulkAdd}
                disabled={!bulkText.trim()}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded text-sm"
              >
                Add All
              </button>
              <button
                onClick={() => {
                  setAddMode(false)
                  setBulkText('')
                  setNewName('')
                }}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Vendor</th>
              <th className="text-left px-3 py-2">First</th>
              <th className="text-left px-3 py-2">Last</th>
              <th className="text-left px-3 py-2">Company</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Qty</th>
              <th className="text-left px-3 py-2">Assigned</th>
              <th className="text-left px-3 py-2">Tables</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400">
                  {vendorList.length === 0 ? 'No vendors yet. Import or add vendors to start.' : 'No matching vendors.'}
                </td>
              </tr>
            )}
            {filtered.map(v => {
              const assigned = vendorTableInfo.counts.get(v.id) ?? 0
              const badge = PAYMENT_BADGE[v.paymentStatus]
              const labels = (vendorTableInfo.tableLabels.get(v.id) ?? []).sort((a, b) => {
                const na = parseInt(a, 10)
                const nb = parseInt(b, 10)
                if (!isNaN(na) && !isNaN(nb)) return na - nb
                return a.localeCompare(b)
              })
              const isActive = activeVendorId === v.id

              return (
                <tr
                  key={v.id}
                  className={`border-b border-gray-100 ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-3 py-2">
                    <button className="flex items-center gap-2 text-left" onClick={() => handleActivate(v.id)}>
                      <span className="w-3 h-3 rounded-sm border border-gray-200 shrink-0" style={{ backgroundColor: vendorColor(v.id) }} />
                      <span className="font-medium text-gray-900">{vendorDisplayName(v)}</span>
                      {v.premium && <span className="text-amber-500">★</span>}
                      <span className="text-[11px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: badge.bg }}>
                        {badge.label}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{v.firstName || '-'}</td>
                  <td className="px-3 py-2 text-gray-700">{v.lastName || '-'}</td>
                  <td className="px-3 py-2 text-gray-700">{v.companyName || '-'}</td>
                  <td className="px-3 py-2 text-gray-700">{v.category || '-'}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {editingId === v.id ? (
                      <input
                        autoFocus
                        type="number"
                        min={1}
                        value={editCount}
                        onChange={e => setEditCount(e.target.value)}
                        onBlur={() => {
                          updateVendor(v.id, { tablesNeeded: Math.max(1, parseInt(editCount, 10) || 1) })
                          setEditingId(null)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') setEditingId(null)
                          e.stopPropagation()
                        }}
                        className="w-16 px-1 py-0.5 border border-blue-400 rounded text-xs text-center"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(v.id)
                          setEditCount(String(v.tablesNeeded))
                        }}
                        className="text-gray-900 hover:text-blue-700"
                      >
                        {v.tablesNeeded}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={assigned >= v.tablesNeeded ? 'text-green-600' : assigned > 0 ? 'text-amber-600' : 'text-gray-400'}>
                      {assigned} / {v.tablesNeeded}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{labels.length > 0 ? labels.join(', ') : '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2 text-xs">
                      {labels.length > 0 && (
                        <button
                          onClick={() => {
                            const tableIds = Object.values(assignments).filter(a => a.vendorId === v.id).map(a => a.tableId)
                            setSelected(tableIds)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Find
                        </button>
                      )}
                      <button
                        onClick={() => updateVendor(v.id, { premium: !v.premium })}
                        className={v.premium ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}
                      >
                        Premium
                      </button>
                      <button
                        onClick={() => handleRemove(v.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
