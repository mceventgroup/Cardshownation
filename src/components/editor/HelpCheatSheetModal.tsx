'use client'

import { useEffect } from 'react'

interface Props {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'Quick Start',
    items: [
      'Use `Place Table` to drop single tables and `Place Row` to lay out repeated runs fast.',
      'Use `Ctrl+A` to select every table in the layout.',
      'With 2 or more tables selected, use the bulk edit panel in the left sidebar to change dimensions.',
      'Use `Show Mode` when you want a clean event-floor view without editing controls.',
    ],
  },
  {
    title: 'Vendor Import',
    items: [
      'Recommended column order: `Vendor Name, Company Name, Category, Table Number, Contact Name, Email, Phone, Payment Status, Notes`.',
      '`Category` means vendor type, such as `Sports Cards`, `TCG`, `Memorabilia`, `Comics`, or `Food`.',
      '`Table Number` must match table labels on the floor exactly.',
      'After importing, assign vendors by dragging from the vendor list onto tables or by selecting tables first and using bulk assign.',
    ],
  },
  {
    title: 'Selection And Resizing',
    items: [
      'Click a table to select it.',
      'Use `Shift+Click` to extend selection in a row or column lane.',
      'Use drag-select on empty canvas to select groups of tables.',
      'Bulk width/length changes preserve each table’s current orientation.',
    ],
  },
  {
    title: 'Room, Doors, And Spacing',
    items: [
      'Use `Add Room` to create separate rooms and halls, and `Add Attached Area` when you want to extend an existing room footprint.',
      'Use `Circle Room` or press `C` when the venue has round or oval rooms.',
      'You can also draw room rectangles repeatedly on the canvas to create multiple disconnected spaces.',
      'After the room layout is in place, use `Doors` to place openings on actual wall edges.',
      'Wall setback is in `Settings -> Spacing`.',
      'Turn on `Show Wall Setback` to see the setback band on the gray background outside the room.',
      'Grid size is also in `Settings -> Spacing` and affects snapping.',
    ],
  },
  {
    title: 'Navigation',
    items: [
      'Pan with `Space + Drag`.',
      'Use the `+`, `-`, and `Reset` controls for zoom.',
      'Use the mini-map in the top right to understand where you are in large layouts.',
      'Use the `Measure` tool to click two points and read the distance.',
    ],
  },
]

export default function HelpCheatSheetModal({ onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Floorplanner Cheat Sheet</h2>
            <p className="mt-1 text-sm text-slate-500">Operator notes for layout building, vendor assignment, and event setup.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          {SECTIONS.map(section => (
            <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{section.title}</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {section.items.map(item => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
