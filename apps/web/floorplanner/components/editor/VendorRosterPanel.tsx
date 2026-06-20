'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useEditorStore,
  selectActiveVendorId,
  selectSettings,
  selectTables,
  selectVendorAssignments,
  selectVendors,
} from '@floorplanner/store/index'
import type { Vendor } from '@floorplanner/domain/types'
import { resolveVendorBuckets, vendorDisplayName } from '@floorplanner/lib/vendor-resolution'

type VendorFilter = 'all' | 'open' | 'complete' | 'premium'
type VendorSortKey = 'company' | 'premium' | 'cases' | 'need' | 'assigned' | 'open' | 'tables' | 'tableSize'
type SortDirection = 'asc' | 'desc'
type ColumnKey = 'select' | VendorSortKey | 'delete'

interface VendorSummary {
  key: string
  vendor: Vendor | null
  company: string
  cases: number
  need: number
  assigned: number
  open: number
  tables: string[]
  tableSize: string
  isPremium: boolean
}

interface VendorRosterPanelProps {
  search: string
  onSearchChange: (value: string) => void
  filter: VendorFilter
  onFilterChange: (value: VendorFilter) => void
}

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  select: 52,
  company: 220,
  premium: 72,
  cases: 72,
  need: 64,
  assigned: 72,
  open: 64,
  tables: 180,
  tableSize: 120,
  delete: 72,
}

const MIN_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  select: 44,
  company: 120,
  premium: 60,
  cases: 60,
  need: 44,
  assigned: 52,
  open: 44,
  tables: 90,
  tableSize: 84,
  delete: 64,
}

const COLUMN_DEFS: Array<{ key: ColumnKey; label: string; align: 'text-left' | 'text-right'; sortable?: boolean }> = [
  { key: 'select', label: 'Select', align: 'text-left', sortable: false },
  { key: 'company', label: 'Company', align: 'text-left' },
  { key: 'premium', label: 'Premium', align: 'text-left' },
  { key: 'cases', label: 'Cases', align: 'text-left' },
  { key: 'need', label: 'Need', align: 'text-right' },
  { key: 'assigned', label: 'Assigned', align: 'text-right' },
  { key: 'open', label: 'Open', align: 'text-right' },
  { key: 'tables', label: 'Assigned Tables', align: 'text-left' },
  { key: 'tableSize', label: 'Table Size', align: 'text-left' },
  { key: 'delete', label: 'Delete', align: 'text-left', sortable: false },
]

export const VENDOR_FILTERS: Array<{ id: VendorFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'complete', label: 'Complete' },
  { id: 'premium', label: 'Premium' },
]

function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' })
}

function compareVendors(a: Vendor, b: Vendor): number {
  const companyResult = compareText(a.companyName, b.companyName)
  if (companyResult !== 0) return companyResult

  const displayResult = vendorDisplayName(a).localeCompare(vendorDisplayName(b), undefined, { sensitivity: 'base' })
  if (displayResult !== 0) return displayResult

  return b.tablesNeeded - a.tablesNeeded
}

function abbreviateTablePrefix(value: string): string {
  return value
    .replace(/Main Room-/gi, 'MR-')
    .replace(/Main Room /gi, 'MR-')
    .replace(/Room /gi, 'R-')
}

function summarizeTableSizes(values: string[]): string {
  if (values.length === 0) return ''

  const unique = Array.from(new Set(values))
  if (unique.length === 1) return unique[0]
  if (unique.length === 2) return `${unique[0]} / ${unique[1]}`
  return `${unique[0]} +${unique.length - 1}`
}

export function compressTableLabels(labels: string[]): string {
  if (labels.length === 0) return ''

  const normalized = [...new Set(labels.map(label => label.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  const grouped = new Map<string, string[]>()
  const passthrough: string[] = []

  for (const label of normalized) {
    const match = label.match(/^(.*?)(\d+)$/)
    if (!match) {
      passthrough.push(abbreviateTablePrefix(label))
      continue
    }

    const prefix = abbreviateTablePrefix(match[1])
    const number = match[2]
    const existing = grouped.get(prefix)
    if (existing) existing.push(number)
    else grouped.set(prefix, [number])
  }

  const groupedLabels = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(([prefix, numbers]) => `${prefix}${numbers.join(',')}`)

  return [...groupedLabels, ...passthrough].join(', ')
}

function matchesFilter(summary: VendorSummary, filter: VendorFilter): boolean {
  switch (filter) {
    case 'open':
      return summary.open > 0
    case 'complete':
      return summary.open === 0
    case 'premium':
      return summary.isPremium
    default:
      return true
  }
}

function compareSummaries(a: VendorSummary, b: VendorSummary, sortKey: VendorSortKey, direction: SortDirection): number {
  const multiplier = direction === 'asc' ? 1 : -1

  let result = 0
  switch (sortKey) {
    case 'company':
      result = a.company.localeCompare(b.company, undefined, { sensitivity: 'base' })
      break
    case 'premium':
      result = Number(a.isPremium) - Number(b.isPremium)
      break
    case 'cases':
      result = a.cases - b.cases
      break
    case 'need':
      result = a.need - b.need
      break
    case 'assigned':
      result = a.assigned - b.assigned
      break
    case 'open':
      result = a.open - b.open
      break
    case 'tables':
      result = compressTableLabels(a.tables).localeCompare(
        compressTableLabels(b.tables),
        undefined,
        { numeric: true, sensitivity: 'base' },
      )
      break
    case 'tableSize':
      result = a.tableSize.localeCompare(b.tableSize, undefined, { numeric: true, sensitivity: 'base' })
      break
  }

  if (result !== 0) return result * multiplier
  if (a.isPremium !== b.isPremium) return (Number(b.isPremium) - Number(a.isPremium)) * multiplier
  if (a.vendor && b.vendor) return compareVendors(a.vendor, b.vendor)
  return a.company.localeCompare(b.company, undefined, { sensitivity: 'base' })
}

export function useVendorGridData(
  search: string,
  filter: VendorFilter,
  sortKey: VendorSortKey = 'open',
  sortDirection: SortDirection = 'desc',
) {
  const vendors = useEditorStore(selectVendors)
  const assignments = useEditorStore(selectVendorAssignments)
  const tables = useEditorStore(selectTables)

  const vendorSummaries = useMemo(() => {
    return resolveVendorBuckets(vendors, assignments).map(bucket => {
      const assignedTableObjects = bucket.assignments
        .map(assignment => tables[assignment.tableId])
        .filter((table): table is NonNullable<typeof table> => Boolean(table))

      const assignedLabels = assignedTableObjects
        .map(table => table.displayId ?? table.label ?? table.id)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      const need = bucket.vendor?.tablesNeeded ?? assignedLabels.length
      const assigned = assignedLabels.length

      return {
        key: bucket.key,
        vendor: bucket.vendor,
        company: bucket.vendor?.companyName?.trim() || bucket.displayName,
        cases: bucket.vendor?.cases ?? 0,
        need,
        assigned,
        open: need - assigned,
        tables: assignedLabels,
        tableSize: summarizeTableSizes(
          [bucket.vendor?.tableSize?.trim() ?? ''].filter(Boolean),
        ),
        isPremium: bucket.vendor?.premium ?? false,
      } satisfies VendorSummary
    })
  }, [assignments, tables, vendors])

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase()

    return vendorSummaries
      .filter(summary => {
        if (!matchesFilter(summary, filter)) return false
        if (!q) return true

        return [
          summary.company,
          summary.vendor?.name ?? '',
          summary.tables.join(' '),
          summary.tableSize,
        ].some(value => value.toLowerCase().includes(q))
      })
      .sort((a, b) => compareSummaries(a, b, sortKey, sortDirection))
  }, [filter, search, sortDirection, sortKey, vendorSummaries])

  const totals = useMemo(() => {
    const vendorsCount = vendorSummaries.length
    const assignedCount = vendorSummaries.reduce((sum, summary) => sum + summary.assigned, 0)
    const openCount = vendorSummaries.reduce((sum, summary) => sum + summary.open, 0)
    const needCount = vendorSummaries.reduce((sum, summary) => sum + summary.need, 0)
    const completion = needCount === 0 ? 100 : Math.round((assignedCount / needCount) * 100)

    return { vendorsCount, assignedCount, openCount, completion }
  }, [vendorSummaries])

  return { filteredSummaries, totals }
}

export default function VendorRosterPanel({ search, onSearchChange, filter, onFilterChange }: VendorRosterPanelProps) {
  const activeVendorId = useEditorStore(selectActiveVendorId)
  const settings = useEditorStore(selectSettings)
  const vendors = useEditorStore(selectVendors)
  const setActiveVendor = useEditorStore(s => s.setActiveVendor)
  const setHoveredVendor = useEditorStore(s => s.setHoveredVendor)
  const updateVendor = useEditorStore(s => s.updateVendor)
  const removeVendor = useEditorStore(s => s.removeVendor)
  const [sortKey, setSortKey] = useState<VendorSortKey>('open')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS)
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set())
  const { filteredSummaries } = useVendorGridData(search, filter, sortKey, sortDirection)

  const [keyboardIndex, setKeyboardIndex] = useState(0)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const resizeStateRef = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null)

  useEffect(() => () => setHoveredVendor(null), [setHoveredVendor])

  useEffect(() => {
    const existingVendorIds = new Set(Object.keys(vendors))
    setSelectedVendorIds(current => {
      const next = new Set([...current].filter(id => existingVendorIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [vendors])

  useEffect(() => {
    setKeyboardIndex(prev => {
      if (filteredSummaries.length === 0) return 0
      return Math.min(prev, filteredSummaries.length - 1)
    })
  }, [filteredSummaries])

  function focusVendor(summary: VendorSummary | null) {
    if (!summary?.vendor) return
    setActiveVendor(summary.vendor.id)
    rowRefs.current[summary.key]?.scrollIntoView({ block: 'nearest' })
  }

  function toggleSort(nextKey: VendorSortKey) {
    if (sortKey === nextKey) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(nextKey)
    setSortDirection(nextKey === 'company' || nextKey === 'tables' || nextKey === 'tableSize' ? 'asc' : 'desc')
  }

  function handleNeedChange(vendorId: Vendor['id'], rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(parsed)) return
    updateVendor(vendorId, { tablesNeeded: Math.max(0, parsed) })
  }

  function handleVendorFlagChange(vendorId: Vendor['id'], checked: boolean) {
    updateVendor(vendorId, { premium: checked })
  }

  function handleCasesChange(vendorId: Vendor['id'], rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(parsed)) return
    updateVendor(vendorId, { cases: Math.max(0, parsed) })
  }

  function handleDeleteVendor(vendor: Vendor) {
    const confirmed = window.confirm(`Delete vendor "${vendorDisplayName(vendor)}"? This also clears any assigned tables.`)
    if (!confirmed) return
    removeVendor(vendor.id)
    setSelectedVendorIds(current => {
      if (!current.has(vendor.id)) return current
      const next = new Set(current)
      next.delete(vendor.id)
      return next
    })
  }

  function toggleVendorSelection(vendorId: string) {
    setSelectedVendorIds(current => {
      const next = new Set(current)
      if (next.has(vendorId)) next.delete(vendorId)
      else next.add(vendorId)
      return next
    })
  }

  function toggleSelectAllVisible() {
    const visibleVendorIds = filteredSummaries.flatMap(summary => (
      summary.vendor ? [summary.vendor.id] : []
    ))

    if (visibleVendorIds.length === 0) return

    setSelectedVendorIds(current => {
      const allSelected = visibleVendorIds.every(id => current.has(id))
      const next = new Set(current)
      if (allSelected) {
        for (const id of visibleVendorIds) next.delete(id)
      } else {
        for (const id of visibleVendorIds) next.add(id)
      }
      return next
    })
  }

  function deleteSelectedVendors() {
    if (selectedVendorIds.size === 0) return
    const selectedVendors = [...selectedVendorIds]
      .map(id => vendors[id])
      .filter((vendor): vendor is Vendor => Boolean(vendor))

    if (selectedVendors.length === 0) return

    const confirmed = window.confirm(
      `Delete ${selectedVendors.length} selected vendor${selectedVendors.length === 1 ? '' : 's'}? This also clears their assigned tables.`,
    )
    if (!confirmed) return

    for (const vendor of selectedVendors) {
      removeVendor(vendor.id)
    }
    setSelectedVendorIds(new Set())
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
      setActiveVendor(null)
      setHoveredVendor(null)
    }
  }

  function updateColumnWidth(key: ColumnKey, width: number) {
    setColumnWidths(current => ({
      ...current,
      [key]: Math.max(MIN_COLUMN_WIDTHS[key], Math.round(width)),
    }))
  }

  function handleResizeStart(key: ColumnKey, e: React.PointerEvent<HTMLDivElement>) {
    resizeStateRef.current = {
      key,
      startX: e.clientX,
      startWidth: columnWidths[key],
    }
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeStateRef.current) return
    const delta = e.clientX - resizeStateRef.current.startX
    updateColumnWidth(resizeStateRef.current.key, resizeStateRef.current.startWidth + delta)
  }

  function handleResizeEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeStateRef.current) return
    resizeStateRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function cellClass(align: 'text-left' | 'text-right', isLast = false) {
    return `${align} min-w-0 px-2 ${isLast ? '' : 'border-r border-slate-200'}`
  }

  const keyboardVendor = filteredSummaries[keyboardIndex] ?? null
  const keyboardVendorKey = keyboardVendor?.key ?? null
  const gridTemplateColumns = [
    `${columnWidths.select}px`,
    `minmax(${columnWidths.company}px, 1fr)`,
    `${columnWidths.premium}px`,
    `${columnWidths.cases}px`,
    `${columnWidths.need}px`,
    `${columnWidths.assigned}px`,
    `${columnWidths.open}px`,
    `${columnWidths.tables}px`,
    `${columnWidths.tableSize}px`,
    `${columnWidths.delete}px`,
  ].join(' ')
  const minGridWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0) + 32
  const visibleVendorIds = filteredSummaries.flatMap(summary => (
    summary.vendor ? [summary.vendor.id] : []
  ))
  const visibleSelectedCount = visibleVendorIds.filter(id => selectedVendorIds.has(id)).length
  const allVisibleSelected = visibleVendorIds.length > 0 && visibleSelectedCount === visibleVendorIds.length

  useEffect(() => {
    if (!keyboardVendorKey) return
    rowRefs.current[keyboardVendorKey]?.scrollIntoView({ block: 'nearest' })
  }, [keyboardIndex, keyboardVendorKey])

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyboard}
      className="flex h-full min-h-0 flex-col bg-white outline-none"
    >
      <div className="border-b border-slate-300 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search company or tables"
            className="min-w-0 flex-1 border border-slate-300 px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-1">
            {VENDOR_FILTERS.map(item => (
              <button
                key={item.id}
                onClick={() => onFilterChange(item.id)}
                className={`border px-2 py-1 text-xs font-medium ${
                  filter === item.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {selectedVendorIds.size > 0
              ? `${selectedVendorIds.size} vendor${selectedVendorIds.size === 1 ? '' : 's'} selected`
              : 'Select vendors to delete them in bulk.'}
          </div>
          <button
            onClick={deleteSelectedVendors}
            disabled={selectedVendorIds.size === 0}
            className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Delete Selected
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {filteredSummaries.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">
            No vendors found.
          </div>
        ) : (
          <div style={{ minWidth: `${minGridWidth}px` }}>
            <div
              className="sticky top-0 z-10 grid border-b border-slate-300 bg-slate-100 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600"
              style={{ gridTemplateColumns }}
            >
              {COLUMN_DEFS.map(({ key, label, align, sortable = true }, index) => {
                const isLast = index === COLUMN_DEFS.length - 1
                return (
                  <div key={key} className={`${cellClass(align, isLast)} relative py-2`}>
                    {key === 'select' ? (
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label="Select all visible vendors"
                        />
                      </label>
                    ) : sortable ? (
                    <button
                      onClick={() => toggleSort(key as VendorSortKey)}
                      className={`${align} w-full truncate pr-3 hover:text-slate-900`}
                    >
                      {label}
                      {sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                    ) : (
                      <div className={`${align} w-full truncate pr-3`}>{label}</div>
                    )}
                    <div
                      role="separator"
                      aria-label={`Resize ${label} column`}
                      onPointerDown={e => handleResizeStart(key, e)}
                      onPointerMove={handleResizeMove}
                      onPointerUp={handleResizeEnd}
                      onPointerCancel={handleResizeEnd}
                      className="absolute inset-y-0 right-0 z-20 flex w-3 translate-x-1/2 cursor-col-resize touch-none items-stretch justify-center"
                    >
                      <span className="w-px bg-slate-400" />
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredSummaries.map(summary => {
              const isActive = summary.vendor?.id === activeVendorId
              const isKeyboardTarget = keyboardVendor?.key === summary.key
              const compressedTables = compressTableLabels(summary.tables)
              const openColorClass = !settings.vendorColorCoding
                ? 'text-slate-700'
                : summary.assigned > summary.need
                  ? 'text-amber-700'
                  : summary.open > 0
                    ? 'text-red-700'
                    : 'text-emerald-700'

              return (
                <div
                  key={summary.key}
                  ref={node => {
                    rowRefs.current[summary.key] = node
                  }}
                  onClick={() => focusVendor(summary)}
                  onMouseEnter={() => {
                    if (summary.vendor) setHoveredVendor(summary.vendor.id)
                  }}
                  onMouseLeave={() => setHoveredVendor(null)}
                  className={`grid border-b border-slate-200 text-sm ${
                    isActive
                      ? 'bg-blue-50'
                      : isKeyboardTarget
                        ? 'bg-slate-50'
                        : 'bg-white hover:bg-slate-50'
                  }`}
                  style={{ gridTemplateColumns }}
                >
                  <div className={`${cellClass('text-left')} flex items-center justify-center py-1`}>
                    {summary.vendor ? (
                      <input
                        type="checkbox"
                        checked={selectedVendorIds.has(summary.vendor.id)}
                        onChange={() => toggleVendorSelection(summary.vendor!.id)}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Select vendor ${summary.company}`}
                      />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className={`${cellClass('text-left')} flex min-w-0 items-center gap-2 py-1`}>
                    {settings.vendorColorCoding && summary.isPremium && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                    <div className="truncate font-medium text-slate-900">{summary.company}</div>
                  </div>
                  <div className={`${cellClass('text-left')} py-1 text-slate-700`}>
                    {summary.vendor ? (
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={summary.isPremium}
                          onChange={e => handleVendorFlagChange(summary.vendor!.id, e.target.checked)}
                          onClick={e => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label={`Premium vendor ${summary.company}`}
                        />
                      </label>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className={`${cellClass('text-left')} py-1 text-slate-700`}>
                    {summary.vendor ? (
                      <input
                        type="number"
                        min={0}
                        value={summary.cases}
                        onChange={e => handleCasesChange(summary.vendor!.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onFocus={() => setActiveVendor(summary.vendor!.id)}
                        className="w-14 border border-slate-300 bg-white px-1 py-0.5 text-right tabular-nums text-slate-900"
                        aria-label={`Cases for ${summary.company}`}
                      />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                  <div className={`${cellClass('text-right')} py-1 tabular-nums text-slate-700`}>
                    {summary.vendor ? (
                      <input
                        type="number"
                        min={0}
                        value={summary.need}
                        onChange={e => handleNeedChange(summary.vendor!.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onFocus={() => setActiveVendor(summary.vendor!.id)}
                        className="w-14 border border-slate-300 bg-white px-1 py-0.5 text-right tabular-nums text-slate-900"
                        aria-label={`Tables needed for ${summary.company}`}
                      />
                    ) : (
                      summary.need
                    )}
                  </div>
                  <div className={`${cellClass('text-right')} py-1 tabular-nums text-slate-700`}>{summary.assigned}</div>
                  <div className={`${cellClass('text-right')} py-1 tabular-nums font-semibold ${openColorClass}`}>{summary.open}</div>
                  <div className={`${cellClass('text-left')} py-1 text-slate-600`}>{compressedTables || '—'}</div>
                  <div className={`${cellClass('text-left')} py-1 text-slate-600`}>{summary.tableSize || '—'}</div>
                  <div className={`${cellClass('text-left', true)} py-1`}>
                    {summary.vendor ? (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleDeleteVendor(summary.vendor!)
                        }}
                        className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
