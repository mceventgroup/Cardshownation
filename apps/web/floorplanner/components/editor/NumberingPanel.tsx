'use client'

// ─────────────────────────────────────────────────────────────────────────────
// NUMBERING PANEL
//
// Bulk renumber selected tables. Appears when 2+ tables are selected and
// the user presses N or clicks "Renumber" in toolbar.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useMemo } from 'react'
import { useEditorStore, selectTables, selectSelectedIds, selectRows, selectSections } from '@floorplanner/store/index'
import { numberingModule } from '@floorplanner/domain/numbering.impl'
import type { NumberingScheme, NumberingStyle } from '@floorplanner/domain/numbering'
import type { TableId, TableObject, RowId, SectionId } from '@floorplanner/domain/types'

type Scope = 'selected' | 'row' | 'section' | 'all'


/** Sort tables spatially: group by y-band (row tolerance), then left-to-right. */
function sortSpatially(tables: TableObject[]): TableObject[] {
  if (tables.length === 0) return []
  const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x)

  // Group into row bands using first table's height as tolerance
  const tolerance = sorted[0].height * 0.8
  const bands: TableObject[][] = []
  let currentBand: TableObject[] = [sorted[0]]
  let bandY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - bandY) <= tolerance) {
      currentBand.push(sorted[i])
    } else {
      bands.push(currentBand)
      currentBand = [sorted[i]]
      bandY = sorted[i].y
    }
  }
  bands.push(currentBand)

  // Sort each band left-to-right, then flatten
  return bands.flatMap(band => band.sort((a, b) => a.x - b.x))
}

export default function NumberingPanel() {
  const fieldClassName =
    'bg-white border border-gray-300 text-slate-900 placeholder:text-slate-400 rounded'
  const tables      = useEditorStore(selectTables)
  const selectedIds = useEditorStore(selectSelectedIds)
  const rows        = useEditorStore(selectRows)
  const sections    = useEditorStore(selectSections)
  const dispatch    = useEditorStore(s => s.dispatch)

  const [style, setStyle]           = useState<NumberingStyle>('sequential')
  const [prefix, setPrefix]         = useState('')
  const [separator, setSeparator]   = useState('-')
  const [startNumber, setStartNumber] = useState(1)
  const [padToDigits, setPadToDigits] = useState(0)
  const [direction, setDirection]   = useState<'ltr' | 'rtl'>('ltr')
  const [scope, setScope]           = useState<Scope>('selected')

  // Detect if selected tables share a row or section
  const selectedTables = useMemo(() =>
    [...selectedIds].map(id => tables[id]).filter(Boolean) as TableObject[],
    [selectedIds, tables],
  )

  const sharedRowId = useMemo((): RowId | null => {
    if (selectedTables.length === 0) return null
    const rid = selectedTables[0].rowId
    if (!rid) return null
    return selectedTables.every(t => t.rowId === rid) ? rid : null
  }, [selectedTables])

  const sharedSectionId = useMemo((): SectionId | null => {
    if (selectedTables.length === 0) return null
    const sid = selectedTables[0].sectionId
    if (!sid) return null
    return selectedTables.every(t => t.sectionId === sid) ? sid : null
  }, [selectedTables])

  // Build the target table list based on scope
  const targetTables = useMemo((): TableObject[] => {
    const allTables = Object.values(tables)
    switch (scope) {
      case 'selected':
        return sortSpatially(selectedTables)
      case 'row':
        if (!sharedRowId) return sortSpatially(selectedTables)
        return allTables
          .filter(t => t.rowId === sharedRowId)
          .sort((a, b) => a.order - b.order)
      case 'section':
        if (!sharedSectionId) return sortSpatially(selectedTables)
        return sortSpatially(allTables.filter(t => t.sectionId === sharedSectionId))
      case 'all':
        return sortSpatially(allTables)
    }
  }, [scope, selectedTables, sharedRowId, sharedSectionId, tables])

  const scheme = useMemo<NumberingScheme>(() => ({
    style, prefix, separator, startNumber, padToDigits, direction,
  }), [style, prefix, separator, startNumber, padToDigits, direction])

  // Preview: first 5 labels
  const preview = useMemo(() => {
    const labels: string[] = []
    const count = Math.min(5, targetTables.length)
    for (let i = 0; i < count; i++) {
      labels.push(numberingModule.generateLabel(scheme, i))
    }
    if (targetTables.length > 5) labels.push('...')
    return labels
  }, [scheme, targetTables.length])

  const handleApply = useCallback(() => {
    if (targetTables.length === 0) return

    const labelChanges = numberingModule.numberTables(targetTables, scheme)
    const changes = labelChanges.map(lc => ({
      tableId: lc.id as TableId,
      prev: {
        label: tables[lc.id]?.label ?? '',
        labelOverridden: tables[lc.id]?.labelOverridden ?? false,
      },
      next: {
        label: lc.label,
        labelOverridden: lc.labelOverridden,
      },
    }))

    const scopeId = scope === 'row' ? sharedRowId
                  : scope === 'section' ? sharedSectionId
                  : null

    dispatch({
      type: 'RENUMBER',
      scope: scope === 'selected' ? 'layout' : scope === 'all' ? 'layout' : scope,
      scopeId,
      changes,
      timestamp: Date.now(),
    })

  }, [targetTables, scheme, tables, scope, sharedRowId, sharedSectionId, dispatch])

  return (
    <div className="text-sm">
      <div className="px-3 py-3 space-y-3">
        {/* Scope */}
        <label className="block">
          <span className="text-gray-600 text-xs">Scope</span>
          <select
            value={scope}
            onChange={e => setScope(e.target.value as Scope)}
            className={`mt-0.5 w-full px-2 py-1 text-sm ${fieldClassName}`}
          >
            <option value="selected">Selected ({selectedTables.length})</option>
            {sharedRowId && <option value="row">Row ({rows[sharedRowId]?.tableCount ?? '?'} tables)</option>}
            {sharedSectionId && <option value="section">Section: {sections[sharedSectionId]?.name}</option>}
            <option value="all">All Tables</option>
          </select>
        </label>

        {/* Style */}
        <label className="block">
          <span className="text-gray-600 text-xs">Style</span>
          <select
            value={style}
            onChange={e => setStyle(e.target.value as NumberingStyle)}
            className={`mt-0.5 w-full px-2 py-1 text-sm ${fieldClassName}`}
          >
            <option value="sequential">Sequential (1, 2, 3)</option>
            <option value="prefixed">Prefixed (A-1, A-2)</option>
          </select>
        </label>

        {/* Prefix + separator (only for prefixed style) */}
        {style === 'prefixed' && (
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-gray-600 text-xs">Prefix</span>
              <input
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                placeholder="A"
                className={`mt-0.5 w-full px-2 py-1 text-sm ${fieldClassName}`}
              />
            </label>
            <label className="w-14">
              <span className="text-gray-600 text-xs">Sep</span>
              <input
                value={separator}
                onChange={e => setSeparator(e.target.value)}
                className={`mt-0.5 w-full px-2 py-1 text-sm ${fieldClassName}`}
              />
            </label>
          </div>
        )}

        {/* Start number + padding */}
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-gray-600 text-xs">Start #</span>
            <input
              type="number"
              min={0}
              value={startNumber}
              onChange={e => setStartNumber(parseInt(e.target.value) || 1)}
              className={`mt-0.5 w-full px-2 py-1 text-sm ${fieldClassName}`}
            />
          </label>
          <label className="flex-1">
            <span className="text-gray-600 text-xs">Pad digits</span>
            <input
              type="number"
              min={0}
              max={4}
              value={padToDigits}
              onChange={e => setPadToDigits(parseInt(e.target.value) || 0)}
              className={`mt-0.5 w-full px-2 py-1 text-sm ${fieldClassName}`}
            />
          </label>
        </div>

        {/* Direction */}
        <label className="block">
          <span className="text-gray-600 text-xs">Direction</span>
          <select
            value={direction}
            onChange={e => setDirection(e.target.value as 'ltr' | 'rtl')}
            className={`mt-0.5 w-full px-2 py-1 text-sm ${fieldClassName}`}
          >
            <option value="ltr">Left → Right</option>
            <option value="rtl">Right → Left</option>
          </select>
        </label>

        {/* Preview */}
        <div className="bg-gray-50 rounded px-2 py-1.5">
          <span className="text-gray-500 text-xs">Preview: </span>
          <span className="text-gray-800 text-xs font-mono">
            {preview.join(', ')}
          </span>
        </div>

        {/* Apply */}
        <button
          onClick={handleApply}
          disabled={targetTables.length === 0}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-md text-sm transition-colors"
        >
          Apply to {targetTables.length} table{targetTables.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
