'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SECTIONS PANEL
//
// Right-side panel for managing sections and assigning tables.
// When tables are selected, large colored assign buttons appear at the top.
// Click section name to bulk-select all its tables.
// Double-click section name to rename.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useEditorStore, selectSections, selectSelectedIds } from '@floorplanner/store/index'
import { SECTION_COLORS } from '@floorplanner/lib/defaults'
import { createSectionId } from '@floorplanner/lib/id'
import { buildAllSectionRenumberChanges, buildSectionRenumberChanges, type TableNumberingDirection } from '@floorplanner/domain/room-numbering'
import type { Section, SectionId, TableId } from '@floorplanner/domain/types'

export default function SectionsPanel() {
  const fieldClassName =
    'bg-white text-slate-900 placeholder:text-slate-400'
  const sections     = useEditorStore(selectSections)
  const selectedIds  = useEditorStore(selectSelectedIds)
  const dispatch     = useEditorStore(s => s.dispatch)
  const selectBySec  = useEditorStore(s => s.selectBySection)
  const tables       = useEditorStore(s => s.tables)
  const room         = useEditorStore(s => s.room)

  const [editingId, setEditingId]    = useState<string | null>(null)
  const [editName, setEditName]      = useState('')
  const [numberingDirection, setNumberingDirection] = useState<TableNumberingDirection>('cw')

  const sectionList = Object.values(sections).sort((a, b) => a.order - b.order)
  const hasSelection = selectedIds.size > 0

  function handleCreate() {
    const order = sectionList.length
    const color = SECTION_COLORS[order % SECTION_COLORS.length]
    const section: Section = {
      id: createSectionId(),
      name: `Section ${String.fromCharCode(65 + order)}`,
      color,
      order,
    }
    dispatch({ type: 'CREATE_SECTION', section, timestamp: Date.now() })
  }

  function handleDelete(section: Section) {
    const affectedTableIds: TableId[] = []
    for (const t of Object.values(tables)) {
      if (t.sectionId === section.id) affectedTableIds.push(t.id)
    }
    dispatch({
      type: 'DELETE_SECTION',
      section,
      affectedTableIds,
      timestamp: Date.now(),
    })
  }

  function handleRename(sectionId: SectionId) {
    if (!editName.trim()) return
    dispatch({
      type: 'UPDATE_SECTION',
      sectionId,
      prev: { name: sections[sectionId]?.name },
      next: { name: editName.trim() },
      timestamp: Date.now(),
    })
    setEditingId(null)
  }

  function handleColorChange(sectionId: SectionId, nextColor: string) {
    const current = sections[sectionId]
    if (!current || current.color === nextColor) return
    dispatch({
      type: 'UPDATE_SECTION',
      sectionId,
      prev: { color: current.color },
      next: { color: nextColor },
      timestamp: Date.now(),
    })
  }

  function handleAssign(sectionId: SectionId | null) {
    if (selectedIds.size === 0) return
    const tableIds = [...selectedIds] as TableId[]
    const prevSectionIds = tableIds.map(id => tables[id]?.sectionId ?? null)
    dispatch({
      type: 'ASSIGN_TO_SECTION',
      tableIds,
      prevSectionIds,
      nextSectionId: sectionId,
      timestamp: Date.now(),
    })
  }

  function countTablesInSection(sectionId: SectionId): number {
    let count = 0
    for (const t of Object.values(tables)) {
      if (t.sectionId === sectionId) count++
    }
    return count
  }

  function dispatchRenumberChanges(scope: 'section' | 'layout', scopeId: SectionId | null, changes: ReturnType<typeof buildSectionRenumberChanges>) {
    const filtered = changes.filter(change => (
      change.prev.label !== change.next.label ||
      change.prev.labelOverridden !== change.next.labelOverridden ||
      change.prev.displayId !== change.next.displayId ||
      change.prev.tableNumber !== change.next.tableNumber
    ))
    if (filtered.length === 0) return

    dispatch({
      type: 'RENUMBER',
      scope,
      scopeId,
      changes: filtered,
      timestamp: Date.now(),
    })
  }

  function handleRenumberSection(sectionId: SectionId) {
    dispatchRenumberChanges(
      'section',
      sectionId,
      buildSectionRenumberChanges(tables, sections, sectionId, numberingDirection),
    )
  }

  function handleRenumberAll() {
    dispatchRenumberChanges(
      'layout',
      null,
      buildAllSectionRenumberChanges(tables, sections, room, numberingDirection),
    )
  }

  return (
    <div className="text-sm">
      <div className="px-3 py-3 border-b border-gray-100 bg-white">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Numbering Direction</span>
          <select
            value={numberingDirection}
            onChange={e => setNumberingDirection(e.target.value as TableNumberingDirection)}
            className={`w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs ${fieldClassName}`}
          >
            <option value="ltr">Left to Right</option>
            <option value="rtl">Right to Left</option>
            <option value="ttb">Top to Bottom</option>
            <option value="btt">Bottom to Top</option>
            <option value="cw">Clockwise</option>
            <option value="ccw">Counter Clockwise</option>
          </select>
        </label>
        <button
          onClick={handleRenumberAll}
          className="mt-2 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Renumber All Sections
        </button>
      </div>

      {/* ── Assign buttons — shown when tables are selected ────────────── */}
      {hasSelection && sectionList.length > 0 && (
        <div className="px-3 py-3 border-b border-gray-100 bg-blue-50/50">
          <p className="text-xs text-gray-500 mb-2 font-medium">
            Assign {selectedIds.size} selected table{selectedIds.size !== 1 ? 's' : ''} to:
          </p>
          <div className="space-y-1.5">
            {sectionList.map(s => (
              <button
                key={s.id}
                onClick={() => handleAssign(s.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-white font-medium text-sm hover:opacity-90 active:opacity-80 transition-opacity shadow-sm"
                style={{ backgroundColor: s.color }}
              >
                <span className="truncate">{s.name}</span>
                <span className="ml-auto text-xs opacity-80">
                  ({countTablesInSection(s.id)})
                </span>
              </button>
            ))}
            <button
              onClick={() => handleAssign(null)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-sm border-2 border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              Unassign
            </button>
          </div>
        </div>
      )}

      {/* ── Section list ──────────────────────────────────────────────── */}
      <div className="px-3 py-2 max-h-60 overflow-y-auto">
        {sectionList.length === 0 && (
          <p className="text-xs text-gray-400 py-2 text-center">No sections yet</p>
        )}

        <div className="space-y-0.5">
          {sectionList.map(s => {
            const tableCount = countTablesInSection(s.id)
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 group"
              >
                {/* Color swatch */}
                <label className="shrink-0 cursor-pointer" title={`Change color for ${s.name}`}>
                  <input
                    type="color"
                    value={s.color}
                    onChange={e => handleColorChange(s.id, e.target.value)}
                    className="sr-only"
                    aria-label={`Change color for ${s.name}`}
                  />
                  <span
                    className="block h-4 w-4 rounded border border-black/10"
                    style={{ backgroundColor: s.color }}
                  />
                </label>

                {/* Name (editable on double-click) */}
                {editingId === s.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(s.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => handleRename(s.id)}
                    className={`flex-1 min-w-0 px-1.5 py-0.5 border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 ${fieldClassName}`}
                  />
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      className="min-w-0 flex-1 text-left text-xs text-gray-700 truncate hover:text-blue-600"
                      onClick={() => selectBySec(s.id)}
                      onDoubleClick={() => {
                        setEditingId(s.id)
                        setEditName(s.name)
                      }}
                      title="Click: select all · Double-click: rename"
                    >
                      {s.name}
                      <span className="text-gray-400 ml-1">({tableCount})</span>
                    </button>
                    <button
                      onClick={() => handleRenumberSection(s.id)}
                      className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                      title={`Renumber ${s.name}`}
                    >
                      Renumber
                    </button>
                  </div>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDelete(s)}
                  title={`Delete ${s.name}`}
                  className="text-gray-300 hover:text-red-500 text-base leading-none px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  &times;
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── New section button ────────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-1">
        <button
          onClick={handleCreate}
          className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-md text-xs font-medium text-gray-700 transition-colors"
        >
          + New Section
        </button>
      </div>
    </div>
  )
}
