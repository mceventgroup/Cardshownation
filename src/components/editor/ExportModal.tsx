'use client'
// ─────────────────────────────────────────────────────────────────────────────
// EXPORT MODAL
//
// Options:
//   PNG  — Konva stage screenshot at 2× resolution
//   Print/PDF — SVG floor-plan in a new print window (browser PDF dialog)
//
// View toggle:
//   Organizer — shows vendor names + payment status
//   Public — table labels and section colors only
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useEditorStore } from '@/store'
import { exportPNG, printLayout } from '@/lib/export'

interface Props {
  onClose: () => void
}

export default function ExportModal({ onClose }: Props) {
  const tables      = useEditorStore(s => s.tables)
  const sections    = useEditorStore(s => s.sections)
  const assignments = useEditorStore(s => s.vendorAssignments)
  const room        = useEditorStore(s => s.room)
  const bgImages    = useEditorStore(s => s.backgroundImages)

  const [view, setView]              = useState<'organizer' | 'public'>('organizer')
  const [showPayment, setShowPayment] = useState(true)
  const [title, setTitle]            = useState('Floor Plan')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // onClose is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePNG() {
    exportPNG(`${title || 'floorplan'}.png`)
    onClose()
  }

  function handlePrint() {
    printLayout(tables, sections, assignments, room, {
      showVendorNames:   view === 'organizer',
      showPaymentStatus: view === 'organizer' && showPayment,
      title,
    }, bgImages)
    onClose()
  }

  const tableCount = Object.keys(tables).length
  const assignedCount = Object.keys(assignments).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-base">Export Floor Plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
              placeholder="Floor Plan"
            />
          </div>

          {/* View */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-xs">View</label>
            <div className="flex gap-2">
              {(['organizer', 'public'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 py-2 text-sm rounded border transition-colors ${
                    view === v
                      ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {v === 'organizer' ? 'Organizer (with vendor info)' : 'Public (tables only)'}
                </button>
              ))}
            </div>
            {view === 'organizer' && (
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPayment}
                  onChange={e => setShowPayment(e.target.checked)}
                  className="accent-blue-500"
                />
                Show payment status
              </label>
            )}
          </div>

          {/* Stats */}
          <div className="bg-gray-800 rounded p-3 text-xs text-gray-400 flex gap-4">
            <span><span className="text-white">{tableCount}</span> tables</span>
            <span><span className="text-white">{assignedCount}</span> assigned</span>
            <span><span className="text-white">{Object.keys(sections).length}</span> sections</span>
          </div>

          {/* Export buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePrint}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9h8v4H6v-4zm8-4a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd" />
              </svg>
              Print / Save as PDF
            </button>
            <button
              onClick={handlePNG}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download PNG (current view)
            </button>
          </div>

          <p className="text-gray-600 text-xs">
            Print/PDF exports a clean SVG floor plan scaled to fit the page.
            PNG exports exactly what is currently visible on the canvas.
          </p>
        </div>
      </div>
    </div>
  )
}
