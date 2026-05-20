'use client'

import { useState } from 'react'

interface Props {
  onStart: (skipNextTime: boolean) => void
  onOpenHelp: (skipNextTime: boolean) => void
}

const STEPS = [
  'Build the floor outline first in `Layout -> Room Builder`, using `Add Room` for separate spaces and `Add Attached Area` for connected expansions.',
  'Set grid size and wall setback in `Settings -> Spacing`.',
  'Add tables with `Place Table` or `Place Row`.',
  'Use `Ctrl+A` to select all tables and bulk-resize them from the sidebar.',
  'Import vendors after table labels are in place and match the floor.',
]

export default function FirstRunModal({ onStart, onOpenHelp }: Props) {
  const [skipNextTime, setSkipNextTime] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-900">Start Here</h2>
          <p className="mt-2 text-sm text-slate-500">
            This tool works best when you set up the room, spacing, and table labels in the right order.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-700">Recommended First-Time Flow</div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {STEPS.map(step => (
                <p key={step}>{step}</p>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={skipNextTime}
              onChange={e => setSkipNextTime(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>Don&apos;t show this again on startup.</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={() => onOpenHelp(skipNextTime)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Cheat Sheet
          </button>
          <button
            onClick={() => onStart(skipNextTime)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Start Editing
          </button>
        </div>
      </div>
    </div>
  )
}
