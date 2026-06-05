'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import VendorRosterPanel, { useVendorGridData } from './VendorRosterPanel'

type VendorFilter = 'all' | 'open' | 'complete' | 'premium'
type DrawerState = 'collapsed' | 'medium' | 'expanded'

const COLLAPSED_HEIGHT = 56
const MEDIUM_RATIO = 0.36
const EXPANDED_RATIO = 0.64
const MAX_RATIO = 0.7
const MIN_RATIO = 0.3

interface VendorDrawerProps {
  active: boolean
}

function magnifierIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16L21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function VendorDrawer({ active }: VendorDrawerProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<VendorFilter>('all')
  const [drawerHeight, setDrawerHeight] = useState(COLLAPSED_HEIGHT)
  const [viewportHeight, setViewportHeight] = useState(0)
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const { totals } = useVendorGridData(search, filter)

  const mediumHeight = useMemo(
    () => Math.max(COLLAPSED_HEIGHT, Math.round(viewportHeight * MEDIUM_RATIO)),
    [viewportHeight],
  )
  const expandedHeight = useMemo(
    () => Math.max(COLLAPSED_HEIGHT, Math.round(viewportHeight * EXPANDED_RATIO)),
    [viewportHeight],
  )

  useEffect(() => {
    function syncViewportHeight() {
      setViewportHeight(window.innerHeight)
    }

    syncViewportHeight()
    window.addEventListener('resize', syncViewportHeight)
    return () => window.removeEventListener('resize', syncViewportHeight)
  }, [])

  useEffect(() => {
    if (!active) {
      setDrawerHeight(COLLAPSED_HEIGHT)
      return
    }
    setDrawerHeight(mediumHeight)
  }, [active, mediumHeight])

  useEffect(() => {
    function handleResize() {
      if (!active) return
      setDrawerHeight(current => {
        if (current <= COLLAPSED_HEIGHT + 4) return COLLAPSED_HEIGHT
        const next = Math.min(
          Math.round(viewportHeight * MAX_RATIO),
          Math.max(Math.round(viewportHeight * MIN_RATIO), current),
        )
        return next
      })
    }

    handleResize()
  }, [active, viewportHeight])

  const drawerState: DrawerState = drawerHeight <= COLLAPSED_HEIGHT + 4
    ? 'collapsed'
    : drawerHeight >= Math.round(viewportHeight * 0.5)
      ? 'expanded'
      : 'medium'

  function clampHeight(height: number) {
    const maxHeight = Math.round(viewportHeight * MAX_RATIO)
    const minHeight = Math.round(viewportHeight * MIN_RATIO)
    if (height <= COLLAPSED_HEIGHT + 8) return COLLAPSED_HEIGHT
    return Math.max(minHeight, Math.min(maxHeight, height))
  }

  function snapHeight(height: number) {
    const candidates = [COLLAPSED_HEIGHT, mediumHeight, expandedHeight]
    return candidates.reduce((closest, candidate) => (
      Math.abs(candidate - height) < Math.abs(closest - height) ? candidate : closest
    ), candidates[0])
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = { startY: e.clientY, startHeight: drawerHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return
    const delta = dragStateRef.current.startY - e.clientY
    setDrawerHeight(clampHeight(dragStateRef.current.startHeight + delta))
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return
    dragStateRef.current = null
    setDrawerHeight(current => snapHeight(current))
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function setCollapsed() {
    setDrawerHeight(COLLAPSED_HEIGHT)
  }

  function setMedium() {
    setDrawerHeight(mediumHeight)
  }

  function setExpanded() {
    setDrawerHeight(expandedHeight)
  }

  if (!active) return null

  return (
    <div
      className="shrink-0 border-t border-slate-300 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
      style={{ height: drawerHeight }}
    >
      <div
        className="flex cursor-row-resize items-center gap-3 border-b border-slate-300 bg-slate-50 px-4 py-2"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300" />
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-slate-300 px-4 py-2">
        <div className="min-w-0 text-xs font-medium text-slate-600">
          {totals.vendorsCount} Vendors • {totals.assignedCount} Assigned • {totals.openCount} Open • {totals.completion}% Complete
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={setMedium}
            className="border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
            title="Search and work in medium view"
          >
            {magnifierIcon()}
          </button>
          <button
            onClick={drawerState === 'expanded' ? setMedium : setExpanded}
            className="border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {drawerState === 'expanded' ? 'Medium' : 'Expand'}
          </button>
          <button
            onClick={setCollapsed}
            className="border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Collapse
          </button>
        </div>
      </div>

      {drawerState !== 'collapsed' && (
        <div className="min-h-0 h-[calc(100%-81px)]">
          <VendorRosterPanel
            search={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>
      )}
    </div>
  )
}
