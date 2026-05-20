'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useEditorStore,
  selectActiveRoomId,
  selectActiveVendorId,
  selectRoom,
  selectSelectedIds,
  selectTables,
  selectVendorAssignments,
  selectVendors,
} from '@/store/index'
import { createAssignmentId, createVendorId } from '@/lib/id'
import { expandTableNumbers } from '@/domain/csv-import.impl'
import { autoAssignVendors, type AutoAssignResult } from '@/domain/auto-assign'
import { getRoomZones } from '@/domain/room-numbering'
import { vendorColor } from '@/lib/defaults'
import { DRAFT_LAYOUT_ID } from '@/lib/defaults'
import type { TableId, Vendor, VendorId } from '@/domain/types'
import { resolveVendorBuckets, vendorDisplayName } from '@/lib/vendor-resolution'

type VendorFilter = 'all' | 'unassigned' | 'partial' | 'assigned' | 'premium' | 'large'
type VendorStatus = 'unassigned' | 'partial' | 'assigned'

interface VendorSummary {
  vendor: Vendor | null
  key: string
  displayName: string
  assigned: number
  remaining: number
  status: VendorStatus
  tableLabels: string[]
  isSynthetic: boolean
}

const FILTERS: Array<{ id: VendorFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'partial', label: 'Partially Assigned' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'premium', label: 'Premium' },
  { id: 'large', label: '3+ Tables' },
]

function normalizeVendor(input: Partial<Vendor> & Pick<Vendor, 'id' | 'name' | 'tablesNeeded' | 'category' | 'paymentStatus' | 'notes' | 'premium'>): Vendor {
  return {
    ...input,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    companyName: input.companyName ?? null,
    email: input.email ?? null,
  }
}

function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' })
}

function compareVendors(a: Vendor, b: Vendor): number {
  const firstNameResult = compareText(a.firstName, b.firstName)
  if (firstNameResult !== 0) return firstNameResult

  const lastNameResult = compareText(a.lastName, b.lastName)
  if (lastNameResult !== 0) return lastNameResult

  const tableCountResult = b.tablesNeeded - a.tablesNeeded
  if (tableCountResult !== 0) return tableCountResult

  const premiumResult = Number(b.premium) - Number(a.premium)
  if (premiumResult !== 0) return premiumResult

  const companyNameResult = compareText(a.companyName, b.companyName)
  if (companyNameResult !== 0) return companyNameResult

  return vendorDisplayName(a).localeCompare(vendorDisplayName(b), undefined, { sensitivity: 'base' })
}

function getVendorStatus(vendor: Vendor, assigned: number): VendorStatus {
  if (assigned <= 0) return 'unassigned'
  if (assigned >= vendor.tablesNeeded) return 'assigned'
  return 'partial'
}

function statusRank(status: VendorStatus): number {
  if (status === 'unassigned') return 0
  if (status === 'partial') return 1
  return 2
}

function statusBadge(status: VendorStatus): { label: string; className: string } {
  switch (status) {
    case 'assigned':
      return { label: 'Assigned', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
    case 'partial':
      return { label: 'Partially Assigned', className: 'bg-amber-50 text-amber-700 ring-amber-200' }
    default:
      return { label: 'Unassigned', className: 'bg-slate-100 text-slate-700 ring-slate-200' }
  }
}

function matchesFilter(summary: VendorSummary, filter: VendorFilter): boolean {
  switch (filter) {
    case 'unassigned':
      return summary.status === 'unassigned'
    case 'partial':
      return summary.status === 'partial'
    case 'assigned':
      return summary.status === 'assigned'
    case 'premium':
      return summary.vendor?.premium ?? false
    case 'large':
      return (summary.vendor?.tablesNeeded ?? summary.assigned) >= 3
    default:
      return true
  }
}

function formatAutoAssignPreview(result: AutoAssignResult): string {
  if (result.assignments.length === 0) return 'No preview available.'
  return `Previewing ${result.assignments.length} table assignment${result.assignments.length === 1 ? '' : 's'}`
}

export default function VendorRosterPanel() {
  const vendors = useEditorStore(selectVendors)
  const activeVendorId = useEditorStore(selectActiveVendorId)
  const activeRoomId = useEditorStore(selectActiveRoomId)
  const selectedIds = useEditorStore(selectSelectedIds)
  const assignments = useEditorStore(selectVendorAssignments)
  const tables = useEditorStore(selectTables)
  const room = useEditorStore(selectRoom)
  const dispatch = useEditorStore(s => s.dispatch)
  const addVendor = useEditorStore(s => s.addVendor)
  const updateVendor = useEditorStore(s => s.updateVendor)
  const removeVendor = useEditorStore(s => s.removeVendor)
  const setActiveVendor = useEditorStore(s => s.setActiveVendor)
  const setHoveredVendor = useEditorStore(s => s.setHoveredVendor)
  const setActiveRoomId = useEditorStore(s => s.setActiveRoomId)
  const setSelected = useEditorStore(s => s.setSelected)

  const [addMode, setAddMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [newName, setNewName] = useState('')
  const [newCount, setNewCount] = useState('1')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<VendorFilter>('all')
  const [sortLargestFirst, setSortLargestFirst] = useState(true)
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set())
  const [keyboardIndex, setKeyboardIndex] = useState(0)
  const [autoAssignPreview, setAutoAssignPreview] = useState<AutoAssignResult | null>(null)
  const [panelMessage, setPanelMessage] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const keyboardScopeRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (addMode) setTimeout(() => nameRef.current?.focus(), 50)
  }, [addMode])

  useEffect(() => () => setHoveredVendor(null), [setHoveredVendor])

  const roomZones = useMemo(() => getRoomZones(room), [room])
  const visibleTables = useMemo(
    () => Object.values(tables).filter(table => !activeRoomId || table.roomId === activeRoomId),
    [activeRoomId, tables],
  )
  const visibleTableIds = useMemo(
    () => new Set<string>(visibleTables.map(table => table.id)),
    [visibleTables],
  )
  const roomLabel = roomZones.find(zone => zone.id === activeRoomId)?.label ?? activeRoomId ?? 'All Rooms'

  const vendorSummaries = useMemo(() => {
    return resolveVendorBuckets(vendors, assignments)
      .map(bucket => {
        const assignedLabels = bucket.assignments
          .filter(assignment => visibleTableIds.has(assignment.tableId))
          .map(assignment => tables[assignment.tableId]?.displayId ?? tables[assignment.tableId]?.label ?? assignment.tableId)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        const assigned = assignedLabels.length
        const tablesNeeded = bucket.vendor?.tablesNeeded ?? assigned
        return {
          vendor: bucket.vendor,
          key: bucket.key,
          displayName: bucket.displayName,
          assigned,
          remaining: Math.max(tablesNeeded - assigned, 0),
          status: bucket.vendor ? getVendorStatus(bucket.vendor, assigned) : (assigned > 0 ? 'assigned' : 'unassigned'),
          tableLabels: assignedLabels,
          isSynthetic: bucket.isSynthetic,
        } satisfies VendorSummary
      })
      .sort((a, b) => {
        if (sortLargestFirst) {
          const remainingResult = b.remaining - a.remaining
          if (remainingResult !== 0) return remainingResult
        }
        const statusResult = statusRank(a.status) - statusRank(b.status)
        if (statusResult !== 0) return statusResult
        if (a.vendor && b.vendor) return compareVendors(a.vendor, b.vendor)
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
      })
  }, [assignments, sortLargestFirst, tables, vendors, visibleTableIds])

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vendorSummaries.filter(summary => {
      if (!matchesFilter(summary, filter)) return false
      if (!q) return true
      return [
        summary.displayName,
        summary.vendor?.firstName ?? '',
        summary.vendor?.lastName ?? '',
        summary.vendor?.companyName ?? '',
        summary.vendor?.email ?? '',
        summary.vendor?.category ?? '',
        summary.tableLabels.join(' '),
      ].some(value => value.toLowerCase().includes(q))
    })
  }, [filter, search, vendorSummaries])

  useEffect(() => {
    setKeyboardIndex(prev => {
      if (filteredSummaries.length === 0) return 0
      return Math.min(prev, filteredSummaries.length - 1)
    })
  }, [filteredSummaries])

  const totalTables = visibleTables.length
  const totalAssigned = Object.values(assignments).filter(assignment => visibleTableIds.has(assignment.tableId)).length
  const selectedVendorList = useMemo(
    () => filteredSummaries.filter(summary => selectedVendorIds.has(summary.key)),
    [filteredSummaries, selectedVendorIds],
  )
  const nextUnassigned = useMemo(
    () => vendorSummaries.find(summary => summary.remaining > 0) ?? null,
    [vendorSummaries],
  )

  function assignVendorToTables(vendorId: VendorId, tableIds: string[]) {
    const vendor = vendors[vendorId]
    if (!vendor || tableIds.length === 0) return

    const prioritizedTableIds = [...tableIds].sort((a, b) => {
      const aVisible = visibleTableIds.has(a) ? 1 : 0
      const bVisible = visibleTableIds.has(b) ? 1 : 0
      if (aVisible !== bVisible) return bVisible - aVisible
      const aPremium = tables[a]?.premium ? 1 : 0
      const bPremium = tables[b]?.premium ? 1 : 0
      if (aPremium !== bPremium) return bPremium - aPremium
      return (tables[a]?.displayId ?? tables[a]?.label ?? '').localeCompare(
        tables[b]?.displayId ?? tables[b]?.label ?? '',
        undefined,
        { numeric: true },
      )
    }).filter(tableId => visibleTableIds.has(tableId))

    for (const tableId of prioritizedTableIds) {
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

  function toggleVendorSelection(vendorId: string) {
    setSelectedVendorIds(current => {
      const next = new Set(current)
      if (next.has(vendorId)) next.delete(vendorId)
      else next.add(vendorId)
      return next
    })
  }

  function clearVendorSelection() {
    setSelectedVendorIds(new Set())
  }

  function focusVendor(summary: VendorSummary | null) {
    if (!summary) return
    if (summary.vendor) {
      setActiveVendor(summary.vendor.id)
    }
    rowRefs.current[summary.key]?.scrollIntoView({ block: 'nearest' })
  }

  function handleNextUnassigned() {
    if (!nextUnassigned) return
    focusVendor(nextUnassigned)
    const nextIndex = filteredSummaries.findIndex(summary => summary.key === nextUnassigned.key)
    if (nextIndex >= 0) setKeyboardIndex(nextIndex)
  }

  function previewAutoAssign() {
    const roomTables = Object.fromEntries(visibleTables.map(table => [table.id, table]))
    const roomAssignments = Object.fromEntries(
      Object.values(assignments)
        .filter(assignment => visibleTableIds.has(assignment.tableId))
        .map(assignment => [assignment.id, assignment]),
    )
    const result = autoAssignVendors(roomTables, vendors, roomAssignments)
    setAutoAssignPreview(result)
    setPanelMessage(result.assignments.length === 0 ? 'No open tables or vendors available to auto-assign.' : formatAutoAssignPreview(result))
  }

  function applyAutoAssignPreview() {
    if (!autoAssignPreview || autoAssignPreview.assignments.length === 0) return

    for (const assignment of autoAssignPreview.assignments) {
      const existing = Object.values(useEditorStore.getState().vendorAssignments).find(current => current.tableId === assignment.tableId)
      dispatch({
        type: 'ASSIGN_VENDOR',
        assignment: {
          id: createAssignmentId(),
          tableId: assignment.tableId,
          layoutId: DRAFT_LAYOUT_ID,
          vendorId: assignment.vendorId,
          vendorName: assignment.vendorName,
          vendorCategory: assignment.vendorCategory,
          colorOverride: null,
          notes: null,
          paymentStatus: assignment.paymentStatus,
          importSessionId: null,
        },
        prevAssignment: existing ?? null,
        timestamp: Date.now(),
      })
    }

    setPanelMessage(`Applied ${autoAssignPreview.assignments.length} auto-assigned table${autoAssignPreview.assignments.length === 1 ? '' : 's'}.`)
    setAutoAssignPreview(null)
  }

  function bulkTogglePremium(nextPremium: boolean) {
    for (const summary of selectedVendorList) {
      if (!summary.vendor) continue
      updateVendor(summary.vendor.id, { premium: nextPremium })
    }
  }

  function bulkRemoveVendors() {
    for (const summary of selectedVendorList) {
      if (!summary.vendor) continue
      removeVendor(summary.vendor.id)
    }
    clearVendorSelection()
  }

  function handleKeyboard(e: React.KeyboardEvent<HTMLDivElement>) {
    if (filteredSummaries.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setKeyboardIndex(index => Math.min(index + 1, filteredSummaries.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setKeyboardIndex(index => Math.max(index - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      focusVendor(filteredSummaries[keyboardIndex] ?? null)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      clearVendorSelection()
      setActiveVendor(null)
      setHoveredVendor(null)
    }
  }

  const keyboardVendor = filteredSummaries[keyboardIndex] ?? null

  useEffect(() => {
    if (!keyboardVendor) return
    rowRefs.current[keyboardVendor.key]?.scrollIntoView({ block: 'nearest' })
  }, [keyboardVendor])

  return (
    <div
      ref={keyboardScopeRef}
      tabIndex={0}
      onKeyDown={handleKeyboard}
      className="flex h-full flex-col bg-slate-50 outline-none"
    >
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-2 px-4 py-3 text-xs">
          <div className="rounded-2xl bg-slate-100 px-3 py-2">
            <div className="text-slate-500">Vendors</div>
            <div className="text-lg font-semibold text-slate-900">{vendorSummaries.length}</div>
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

        <div className="px-4 pb-3">
          <div className="flex gap-2">
            {roomZones.length > 0 && (
              <select
                value={activeRoomId ?? roomZones[0]?.id ?? ''}
                onChange={e => setActiveRoomId(e.target.value || null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {roomZones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
              </select>
            )}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors..."
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => setAddMode(v => !v)}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {addMode ? 'Close' : 'Add'}
            </button>
          </div>

            <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSortLargestFirst(prev => !prev)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sortLargestFirst ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sort by Largest First
            </button>
            {FILTERS.map(item => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {selectedVendorList.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
              <span className="font-semibold text-blue-900">{selectedVendorList.length} selected</span>
              <button
                onClick={() => {
                  const target = selectedVendorList[0] ?? null
                  if (!target) return
                  if (selectedVendorList.length === 1 && selectedIds.size > 0 && target.vendor) {
                    assignVendorToTables(target.vendor.id, [...selectedIds])
                  } else {
                    focusVendor(target)
                  }
                }}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100"
              >
                Assign
              </button>
              <button
                onClick={() => bulkTogglePremium(true)}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100"
              >
                Mark Premium
              </button>
              <button
                onClick={() => bulkTogglePremium(false)}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100"
              >
                Unmark Premium
              </button>
              <button
                onClick={bulkRemoveVendors}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
              <button
                onClick={clearVendorSelection}
                className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
              >
                Clear Selection
              </button>
            </div>
          )}

          {activeVendorId && vendors[activeVendorId] && (
            <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Assigning: {vendorDisplayName(vendors[activeVendorId])}</div>
                  <div className="mt-1 text-xs text-blue-700">Active room: {roomLabel}. Click open tables in this room to assign.</div>
                </div>
                <button
                  onClick={() => setActiveVendor(null)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Clear Active
                </button>
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => assignVendorToTables(activeVendorId, [...selectedIds])}
                  className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Assign to {[...selectedIds].filter(tableId => visibleTableIds.has(tableId)).length} selected table{[...selectedIds].filter(tableId => visibleTableIds.has(tableId)).length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleNextUnassigned}
              disabled={!nextUnassigned}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Next Unassigned
            </button>
            <button
              onClick={previewAutoAssign}
              disabled={vendorSummaries.length === 0 || totalTables <= totalAssigned}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Preview Auto Assign
            </button>
          </div>

          {autoAssignPreview && (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
              <div className="font-semibold">{formatAutoAssignPreview(autoAssignPreview)}</div>
              <div className="mt-1">
                {autoAssignPreview.unassignedVendors.length} vendor{autoAssignPreview.unassignedVendors.length === 1 ? '' : 's'} would still need placement.
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={applyAutoAssignPreview}
                  className="rounded-full bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                >
                  Apply Preview
                </button>
                <button
                  onClick={() => setAutoAssignPreview(null)}
                  className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {panelMessage && (
            <div className="mt-3 text-xs text-slate-500">{panelMessage}</div>
          )}

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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredSummaries.length === 0 ? (
          <div className="px-4 py-10">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              {vendorSummaries.length === 0
                ? 'Add vendors to start assigning tables.'
                : vendorSummaries.every(summary => summary.status === 'assigned')
                  ? 'All vendors assigned.'
                  : 'No vendors found.'}
            </div>
          </div>
        ) : (
          <div className="px-2 pb-3 pt-2">
            <div className="sticky top-0 z-10 grid grid-cols-[28px_minmax(0,1fr)_90px_120px_96px] gap-2 bg-slate-50/95 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
              <div />
              <div>Vendor</div>
              <div>Assigned</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            <div className="space-y-1">
              {filteredSummaries.map((summary, index) => {
                const { vendor, assigned, status, tableLabels } = summary
                const statusUi = statusBadge(status)
                const vendorId = vendor?.id ?? null
                const tablesNeeded = vendor?.tablesNeeded ?? assigned
                const isActive = vendorId !== null && activeVendorId === vendorId
                const isSelected = selectedVendorIds.has(summary.key)
                const isKeyboardTarget = keyboardVendor?.key === summary.key
                const needsMultiTableWarning = tablesNeeded > 1 && assigned === 0
                const isLargeVendor = tablesNeeded >= 3
                const rowColor = vendorId ? vendorColor(vendorId) : '#64748b'

                return (
                  <div
                    key={summary.key}
                    ref={node => { rowRefs.current[summary.key] = node }}
                    draggable={Boolean(vendorId)}
                    onDragStart={e => {
                      if (!vendorId) {
                        e.preventDefault()
                        return
                      }
                      e.dataTransfer.setData('application/x-floorplanner-vendor', vendorId)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onMouseEnter={() => {
                      if (vendorId) setHoveredVendor(vendorId)
                    }}
                    onMouseLeave={() => setHoveredVendor(null)}
                    onClick={() => {
                      if (vendorId) setActiveVendor(vendorId)
                      setKeyboardIndex(index)
                    }}
                    className={`grid min-h-[56px] cursor-pointer grid-cols-[28px_minmax(0,1fr)_90px_120px_96px] items-center gap-2 rounded-2xl border px-2 py-2 transition-colors ${
                      isActive
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : isSelected
                          ? 'border-slate-300 bg-slate-100'
                          : isKeyboardTarget
                            ? 'border-slate-300 bg-white'
                            : isLargeVendor
                              ? 'border-transparent bg-amber-50/60 hover:border-amber-200 hover:bg-amber-50'
                              : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVendorSelection(summary.key)}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: rowColor }} />
                        <span className="truncate text-sm font-semibold text-slate-900">{summary.displayName}</span>
                        {summary.isSynthetic && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            Imported
                          </span>
                        )}
                        {vendor?.premium && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Premium
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {vendor?.category ? `${vendor.category} · ` : ''}
                        {tableLabels.length > 0 ? `${roomLabel} tables ${tableLabels.join(', ')}` : `No tables assigned in ${roomLabel}`}
                        {needsMultiTableWarning && ` · Needs ${tablesNeeded} tables`}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-slate-700">
                      {assigned}/{tablesNeeded}
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Needs {summary.remaining}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${statusUi.className}`}>
                        {statusUi.label}
                      </span>
                      {needsMultiTableWarning && (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                          Multi
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      {tableLabels.length > 0 && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setSelected(
                              Object.values(assignments)
                                .filter(a => {
                                  if (summary.key === a.vendorId) return true
                                  const tableLabel = tables[a.tableId]?.displayId ?? tables[a.tableId]?.label ?? a.tableId
                                  return tableLabels.includes(tableLabel) && a.vendorName === summary.displayName
                                })
                                .map(a => a.tableId),
                            )
                          }}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Find
                        </button>
                      )}
                      {vendor && (
                        <>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              updateVendor(vendor.id, { premium: !vendor.premium })
                            }}
                            className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                          >
                            {vendor.premium ? 'Std' : 'Pro'}
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              removeVendor(vendor.id)
                            }}
                            className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                          >
                            Del
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
