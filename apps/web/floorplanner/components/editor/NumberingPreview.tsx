'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '@floorplanner/store/index'
import { buildAllSectionRenumberChanges, buildSectionRenumberChanges, getNumberingStartTables, getRoomZones, getTableCenter } from '@floorplanner/domain/room-numbering'
import type { SectionId, TableId, TableNumberingDirection } from '@floorplanner/domain/types'

export const NUMBERING_DIRECTION_LABELS: Record<TableNumberingDirection, string> = {
  cw: 'Clockwise', ccw: 'Counter clockwise', ltr: 'Left to right', rtl: 'Right to left', ttb: 'Top to bottom', btt: 'Bottom to top',
}

export default function NumberingPreview({ sectionId, initialDirection, onClose }: {
  sectionId: SectionId | null; initialDirection: TableNumberingDirection; onClose: () => void
}) {
  const tables = useEditorStore(state => state.tables)
  const sections = useEditorStore(state => state.sections)
  const settings = useEditorStore(state => state.settings)
  const room = useEditorStore(state => state.room)
  const dispatch = useEditorStore(state => state.dispatch)
  const section = sectionId ? sections[sectionId] : null
  const [direction, setDirection] = useState(initialDirection)
  const [startId, setStartId] = useState<TableId | null>((sectionId ? section?.numberingStartTableId : settings.numberingStartTableId) ?? null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const markerId = useId().replace(/:/g, '')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])
  const circular = direction === 'cw' || direction === 'ccw'
  const candidates = useMemo(() => {
    const all = Object.values(tables)
    if (sectionId) return getNumberingStartTables(all.filter(table => table.sectionId === sectionId), room)
    const scopes = new Map<string, typeof all>()
    for (const table of all) {
      const key = table.sectionId ?? ''
      scopes.set(key, [...(scopes.get(key) ?? []), table])
    }
    return [...scopes.values()].flatMap(scope => getNumberingStartTables(scope, room))
  }, [tables, sectionId, room])
  const effectiveStart = circular && candidates.some(table => table.id === startId) ? startId : null
  const changes = useMemo(() => sectionId
    ? buildSectionRenumberChanges(tables, sections, sectionId, direction, room, effectiveStart)
    : buildAllSectionRenumberChanges(tables, sections, room, direction, false, false, effectiveStart),
  [tables, sections, sectionId, direction, room, effectiveStart])
  const changedCount = changes.filter(change => change.prev.displayId !== change.next.displayId || change.prev.label !== change.next.label).length
  const selected = new Map(changes.map(change => [change.tableId, change]))
  const roomZones = getRoomZones(room)
  const points = [...roomZones.flatMap(zone => zone.polygon), ...Object.values(tables).flatMap(table => {
    const center = getTableCenter(table)
    const radius = Math.hypot(table.width, table.height) / 2
    return [{ x: center.x - radius, y: center.y - radius }, { x: center.x + radius, y: center.y + radius }]
  })]
  const minX = Math.min(0, ...points.map(point => point.x)) - 30
  const minY = Math.min(0, ...points.map(point => point.y)) - 30
  const width = Math.max(100, ...points.map(point => point.x)) - minX + 30
  const height = Math.max(100, ...points.map(point => point.y)) - minY + 30
  const routes = new Map<string, typeof changes>()
  for (const change of changes) {
    const table = tables[change.tableId]
    const roomId = roomZones.find(zone => zone.id === table.roomId)?.id ?? table.roomId
    const key = `${table.sectionId ?? ''}:${roomId}`
    routes.set(key, [...(routes.get(key) ?? []), change])
  }
  const missingSection = sectionId !== null && !section
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${markerId}-title`} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white text-slate-900 shadow-2xl"
        onKeyDown={event => {
          event.stopPropagation()
          if (event.key === 'Escape') onClose()
          if (event.key === 'Tab') {
            const elements = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])]
            const first = elements[0], last = elements[elements.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
          }
        }}>
        <div className="flex items-center justify-between border-b p-4">
          <div><h2 id={`${markerId}-title`} className="font-semibold">Numbering preview — {section?.name ?? 'All sections'}</h2><p className="text-xs text-slate-600">Arrows show the proposed route. Nothing changes until you apply.</p></div>
          <button ref={closeRef} onClick={onClose} aria-label="Close numbering preview" className="rounded px-3 py-2 hover:bg-slate-100">✕</button>
        </div>
        <div className="flex flex-wrap gap-4 border-b p-4">
          <label className="text-sm">Direction<select aria-label="Preview direction" value={direction} onChange={event => setDirection(event.target.value as TableNumberingDirection)} className="ml-2 rounded border bg-white p-2">
            {Object.entries(NUMBERING_DIRECTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="text-sm">Starting table<select aria-label="Starting table" disabled={!circular} value={effectiveStart ?? ''} onChange={event => setStartId(event.target.value as TableId || null)} className="ml-2 max-w-64 rounded border bg-white p-2 disabled:opacity-50">
            <option value="">Automatic (top of outer ring)</option>
            {candidates.map(table => <option key={table.id} value={table.id}>{table.displayId} — {table.sectionId ? sections[table.sectionId]?.name ?? 'Unassigned' : 'Unassigned'}</option>)}
          </select></label>
          <p className="w-full text-xs text-slate-600">{circular ? 'Choose an outer table near the entrance. Each section starts at 01; outer rings finish before inner rings.' : 'Straight numbering follows the selected direction.'}</p>
        </div>
        <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[1fr_220px]">
          <svg role="img" aria-label="Proposed table numbering path" viewBox={`${minX} ${minY} ${width} ${height}`} className="min-h-72 w-full bg-slate-50 md:h-[52vh]">
            <defs><marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" /></marker></defs>
            {roomZones.map(zone => <polygon key={zone.id} points={zone.polygon.map(point => `${point.x},${point.y}`).join(' ')} fill="white" stroke="#94a3b8" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
            {[...routes.entries()].map(([key, route]) => <g key={key}>{route.slice(1).map((change, index) => {
              const a = getTableCenter(tables[route[index].tableId]), b = getTableCenter(tables[change.tableId])
              const target = tables[change.tableId]
              const distance = Math.hypot(b.x - a.x, b.y - a.y)
              const inset = Math.min(distance / 3, Math.hypot(target.width, target.height) / 2 + 3)
              const factor = distance > 0 ? inset / distance : 0
              return <line key={change.tableId} x1={a.x} y1={a.y} x2={b.x - (b.x - a.x) * factor} y2={b.y - (b.y - a.y) * factor} stroke="#2563eb" strokeWidth="2" opacity="0.7" vectorEffect="non-scaling-stroke" markerEnd={`url(#${markerId})`} />
            })}</g>)}
            {Object.values(tables).map(table => {
              const change = selected.get(table.id)
              const center = getTableCenter(table)
              return <g key={table.id} opacity={change ? 1 : 0.25}>
                <rect x={table.x} y={table.y} width={table.width} height={table.height} transform={`rotate(${table.rotation} ${table.x} ${table.y})`} fill={change?.next.tableNumber === 1 ? '#dcfce7' : '#eff6ff'} stroke={change?.next.tableNumber === 1 ? '#16a34a' : '#334155'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                <text x={center.x} y={center.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(6, Math.min(table.width, table.height) * 0.38)} fill="#0f172a">{change?.next.displayId ?? table.displayId}</text>
              </g>
            })}
          </svg>
          <div className="max-h-[52vh] overflow-auto border-l p-3 text-xs" tabIndex={0} aria-label="Numbering changes">
            <p className="mb-2 font-semibold">{changedCount} IDs change · {changes.length} tables</p>
            <ol className="space-y-1">{changes.map(change => <li key={change.tableId}>{change.prev.displayId} → <strong>{change.next.displayId}</strong></li>)}</ol>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t p-4">
          {settings.numberingLocked && <span className="mr-auto text-sm">Numbers are locked. Unlock them in Zones to apply.</span>}
          <button onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
          <button disabled={settings.numberingLocked || changes.length === 0 || missingSection} className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-40" onClick={() => {
            dispatch({ type: 'RENUMBER', scope: sectionId ? 'section' : 'layout', scopeId: sectionId, direction,
              startTableId: effectiveStart, changes, timestamp: Date.now() })
            onClose()
          }}>Apply numbering</button>
        </div>
      </div>
    </div>, document.body,
  )
}
