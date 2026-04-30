'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useEditorStore,
  selectActiveVendorId,
  selectSelectedIds,
  selectTables,
  selectVendorAssignments,
  selectVendors,
} from '@/store/index'
import { createAssignmentId, createVendorId } from '@/lib/id'
import { expandTableNumbers } from '@/domain/csv-import.impl'
import { vendorColor, PREMIUM_TABLE_FILL } from '@/lib/defaults'
import { autoAssignVendors } from '@/domain/auto-assign'
import { DRAFT_LAYOUT_ID } from '@/lib/defaults'
import type { TableId, Vendor, VendorId } from '@/domain/types'

function vendorDisplayName(vendor: Vendor): string {
  return vendor.companyName || [vendor.firstName, vendor.lastName].filter(Boolean).join(' ') || vendor.name
}

function normalizeVendor(input: Partial<Vendor> & Pick<Vendor, 'id' | 'name' | 'tablesNeeded' | 'category' | 'paymentStatus' | 'notes' | 'premium'>): Vendor {
  return {
    ...input,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    companyName: input.companyName ?? null,
    email: input.email ?? null,
  }
}

export default function VendorRosterPanel() {
  const vendors = useEditorStore(selectVendors)
  const activeVendorId = useEditorStore(selectActiveVendorId)
  const selectedIds = useEditorStore(selectSelectedIds)
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
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addMode) setTimeout(() => nameRef.current?.focus(), 50)
  }, [addMode])

  const vendorTableInfo = useMemo(() => {
    const counts = new Map<string, number>()
    const tableLabels = new Map<string, string[]>()
    for (const a of Object.values(assignments)) {
      counts.set(a.vendorId, (counts.get(a.vendorId) ?? 0) + 1)
      const existing = tableLabels.get(a.vendorId) ?? []
      existing.push(tables[a.tableId]?.label ?? a.tableId)
      tableLabels.set(a.vendorId, existing)
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
      [vendorDisplayName(v), v.firstName ?? '', v.lastName ?? '', v.companyName ?? '', v.email ?? '', v.category ?? '']
        .some(value => value.toLowerCase().includes(q)),
    )
  }, [vendorList, search])

  const totalTables = Object.keys(tables).length
  const totalAssigned = Object.keys(assignments).length

  function assignVendorToTables(vendorId: VendorId, tableIds: string[]) {
    const vendor = vendors[vendorId]
    if (!vendor || tableIds.length === 0) return

    for (const tableId of tableIds) {
      const existing = Object.values(useEditorStore.getState().vendorAssignments).find(a => a.tableId === tableId)
      dispatch({
        type: 'ASSIGN_VENDOR',
        assignment: {
          id: createAssignmentId(),
          tableId: tableId as TableId,
          layoutId: DRAFT_LAYOUT_ID,
          vendorId,
          vendorName: vendorDisplayName(vendor),
          vendorCategory: vendor.category,
          colorOverride: null,
          notes: null,
          paymentStatus: vendor.paymentStatus,
          importSessionId: null,
        },
        prevAssignment: existing ?? null,
        timestamp: Date.now(),
      })
    }
  }

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
  }

  function handleBulkAdd() {
    const lines = bulkText.split('\n').map(line => line.trim()).filter(Boolean)
    for (const line of lines) {
      const parts = line.includes('\t') ? line.split('\t').map(part => part.trim()) : line.split(',').map(part => part.trim())
      const firstName = parts[0] ?? ''
      const lastName = parts[1] ?? ''
      const companyName = parts[2] ?? ''
      const category = parts.length > 3 ? parts[3] || null : null
      const qtyRaw = parts[parts.length - 1] ?? '1'
      const displayName = companyName || [firstName, lastName].filter(Boolean).join(' ') || parts[0]
      if (!displayName) continue
      addVendor(normalizeVendor({
        id: createVendorId(),
        name: displayName,
        firstName: firstName || null,
        lastName: lastName || null,
        companyName: companyName || null,
        tablesNeeded: Math.max(1, expandTableNumbers(qtyRaw).length || parseInt(qtyRaw, 10) || 1),
        category,
        paymentStatus: 'unknown',
        notes: null,
        premium: (category ?? '').toLowerCase() === 'premium',
      }))
    }
    setBulkText('')
    setAddMode(false)
  }

  function handleAutoAssign() {
    const result = autoAssignVendors(tables, vendors, assignments)
    if (result.assignments.length === 0) {
      setAutoAssignMsg('No open tables or vendors available to auto-assign.')
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
    setAutoAssignMsg(`Assigned ${result.assignments.length} table${result.assignments.length === 1 ? '' : 's'}.`)
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-2xl bg-slate-100 px-3 py-2">
            <div className="text-slate-500">Vendors</div>
            <div className="text-lg font-semibold text-slate-900">{vendorList.length}</div>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-3 py-2">
            <div className="text-emerald-600">Assigned</div>
            <div className="text-lg font-semibold text-emerald-700">{totalAssigned}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 px-3 py-2">
            <div className="text-amber-600">Open</div>
            <div className="text-lg font-semibold text-amber-700">{Math.max(0, totalTables - totalAssigned)}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => setAddMode(v => !v)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {addMode ? 'Close' : 'Add'}
          </button>
        </div>

        {activeVendorId && vendors[activeVendorId] && (
          <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-800">
            <div className="font-medium">Assign mode: {vendorDisplayName(vendors[activeVendorId])}</div>
            <div className="mt-1 text-xs text-blue-700">Click tables on the canvas or drag this vendor card onto a table.</div>
            {selectedIds.size > 0 && (
              <button
                onClick={() => assignVendorToTables(activeVendorId, [...selectedIds])}
                className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Assign to {selectedIds.size} selected table{selectedIds.size === 1 ? '' : 's'}
              </button>
            )}
          </div>
        )}

        {vendorList.length > 0 && totalTables > totalAssigned && (
          <button
            onClick={handleAutoAssign}
            className="mt-3 w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Auto Assign Remaining
          </button>
        )}
        {autoAssignMsg && <div className="mt-2 text-xs text-emerald-700">{autoAssignMsg}</div>}

        {addMode && (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex gap-2">
              <input
                ref={nameRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Vendor or company"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                value={newCount}
                onChange={e => setNewCount(e.target.value)}
                className="w-20 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <button onClick={handleAddSingle} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save</button>
            </div>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={4}
              placeholder={'Paste multiple vendors\nAcme Cards, 2\nFirst\tLast\tCompany\tPremium\t1'}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs"
            />
            <button onClick={handleBulkAdd} className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
              Import Pasted List
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              {vendorList.length === 0 ? 'Add vendors to start assigning tables.' : 'No matching vendors.'}
            </div>
          )}

          {filtered.map(v => {
            const assigned = vendorTableInfo.counts.get(v.id) ?? 0
            const unassigned = Math.max(v.tablesNeeded - assigned, 0)
            const labels = (vendorTableInfo.tableLabels.get(v.id) ?? []).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            const isActive = activeVendorId === v.id
            return (
              <div
                key={v.id}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-floorplanner-vendor', v.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className={`rounded-2xl border px-4 py-4 shadow-sm transition-colors ${
                  isActive ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: v.premium ? PREMIUM_TABLE_FILL : vendorColor(v.id) }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{vendorDisplayName(v)}</h3>
                      {v.premium && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800">Premium</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {assigned}/{unassigned} assigned/unassigned
                      {v.category ? ` · ${v.category}` : ''}
                    </div>
                    {labels.length > 0 && (
                      <div className="mt-2 text-xs text-slate-600">Tables: {labels.join(', ')}</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveVendor(isActive ? null : v.id)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isActive ? 'Cancel Assign' : 'Assign'}
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => assignVendorToTables(v.id, [...selectedIds])}
                      className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                    >
                      Assign Selected
                    </button>
                  )}
                  {labels.length > 0 && (
                    <button
                      onClick={() => setSelected(Object.values(assignments).filter(a => a.vendorId === v.id).map(a => a.tableId))}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      Find Tables
                    </button>
                  )}
                  <button
                    onClick={() => updateVendor(v.id, { premium: !v.premium })}
                    className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    {v.premium ? 'Standard' : 'Mark Premium'}
                  </button>
                  <button
                    onClick={() => removeVendor(v.id)}
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
