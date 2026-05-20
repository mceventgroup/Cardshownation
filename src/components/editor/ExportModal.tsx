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
import { useEditorStore } from '@/store/index'
import { exportFloorplanImage, exportVendorAssignmentsCsv, printLayout, printVendorManifest } from '@/lib/export'

interface Props {
  onClose: () => void
}

export default function ExportModal({ onClose }: Props) {
  const tables      = useEditorStore(s => s.tables)
  const sections    = useEditorStore(s => s.sections)
  const vendors     = useEditorStore(s => s.vendors)
  const assignments = useEditorStore(s => s.vendorAssignments)
  const room        = useEditorStore(s => s.room)
  const doors       = useEditorStore(s => s.doors)
  const bgImages    = useEditorStore(s => s.backgroundImages)

  const [view, setView]              = useState<'organizer' | 'public'>('organizer')
  const [showPayment, setShowPayment] = useState(true)
  const [title, setTitle]            = useState('Floor Plan')
  const [eventName, setEventName]    = useState('Floor Plan')
  const [venue, setVenue]            = useState('')
  const [eventDate, setEventDate]    = useState('')
  const [colorMode, setColorMode]    = useState<'color' | 'bw'>('color')
  const [includeAssignmentsPage, setIncludeAssignmentsPage] = useState(false)

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
    exportFloorplanImage(
      tables,
      sections,
      assignments,
      room,
      doors,
      {
        showVendorNames: view === 'organizer',
        showPaymentStatus: view === 'organizer' && showPayment,
        title,
        colorMode,
        metadata: {
          eventName,
          venue,
          date: eventDate,
        },
        includeVendorAssignmentsPage: includeAssignmentsPage,
      },
      bgImages,
      `${title || 'floorplan'}.png`,
    )
    onClose()
  }

  function handlePrint() {
    printLayout(tables, sections, assignments, room, doors, {
      showVendorNames:   view === 'organizer',
      showPaymentStatus: view === 'organizer' && showPayment,
      title,
      colorMode,
      metadata: {
        eventName,
        venue,
        date: eventDate,
      },
      includeVendorAssignmentsPage: includeAssignmentsPage,
    }, bgImages)
    onClose()
  }

  function handleVendorCsv() {
    exportVendorAssignmentsCsv(tables, vendors, assignments, room, title || 'vendor-assignments')
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Event Name</label>
              <input
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                placeholder="Card Show"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Venue</label>
              <input
                value={venue}
                onChange={e => setVenue(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                placeholder="Convention Center"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-gray-400 text-xs">Event Date</label>
            <input
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
              placeholder="2026-05-01"
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

          <div className="flex flex-col gap-2">
            <label className="text-gray-400 text-xs">Export Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setColorMode('color')}
                className={`flex-1 py-2 text-sm rounded border transition-colors ${
                  colorMode === 'color'
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                Full Color
              </button>
              <button
                onClick={() => setColorMode('bw')}
                className={`flex-1 py-2 text-sm rounded border transition-colors ${
                  colorMode === 'bw'
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                    : 'border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                Print Friendly
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAssignmentsPage}
                onChange={e => setIncludeAssignmentsPage(e.target.checked)}
                className="accent-blue-500"
              />
              Include vendor assignment page in PDF export
            </label>
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
              Save Floorplan Image
            </button>
          </div>

          <button
              onClick={() => { printVendorManifest(tables, vendors, assignments, title); onClose() }}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
              </svg>
              Print Vendor Checklist
            </button>

          <button
            onClick={handleVendorCsv}
            className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm3 2v8h8V6H6zm1 1h2v2H7V7zm0 3h2v3H7v-3zm4-3h2v2h-2V7zm0 3h2v3h-2v-3z" />
            </svg>
            Export Vendor Assignments CSV
          </button>

          <p className="text-gray-600 text-xs">
            Print/PDF exports rooms as separate labeled sections with global consecutive numbering.
            Floorplan image export creates a readable multi-room PNG.
            Vendor Checklist prints a sortable list with check-in column.
          </p>
        </div>
      </div>
    </div>
  )
}
