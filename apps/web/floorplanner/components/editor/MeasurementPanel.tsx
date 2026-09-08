'use client'

import { useState } from 'react'
import { useEditorStore } from '@floorplanner/store/index'
import { formatMeasurement } from '@floorplanner/domain/measurements'

export default function MeasurementPanel() {
  const measurements = useEditorStore(s => s.measurements)
  const setLength = useEditorStore(s => s.setMeasurementLength)
  const dispatch = useEditorStore(s => s.dispatch)
  const [feet, setFeet] = useState(() => { const length = useEditorStore.getState().measurementLength; return length ? String(length / 12) : '' })
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
      <p>Click two points to leave a distance on the map. Points snap to nearby walls and table edges.</p>
      <label className="block">Exact distance (feet, optional)
        <input type="number" min="0.1" step="0.1" value={feet} placeholder="e.g. 20 or 4" className="mt-1 w-full rounded border border-slate-300 p-2" onChange={event => {
          setFeet(event.target.value)
          const value = Number(event.target.value)
          setLength(Number.isFinite(value) && value > 0 ? value * 12 : null)
        }} />
      </label>
      <p className="text-xs text-slate-500">For an exact mark, click a start point, then click in the direction you want. Hold Shift for a horizontal or vertical line. Esc cancels an unfinished line.</p>
      <p className="text-xs text-slate-500">Marks stay in place when tables move. Saved with your plan and included in floor plan exports.</p>
      <ul className="space-y-2" aria-label="Saved measurements">
        {Object.values(measurements).map((measurement, index) => (
          <li key={measurement.id} className="flex items-center justify-between gap-2">
            <span>Mark {index + 1}: {formatMeasurement(measurement.start, measurement.end)}</span>
            <button className="rounded px-2 py-1 text-red-700 hover:bg-red-50" aria-label={`Remove measurement ${index + 1}`} onClick={() => {
              const next = { ...measurements }
              delete next[measurement.id]
              dispatch({ type: 'UPDATE_MEASUREMENTS', prev: measurements, next, timestamp: Date.now() })
            }}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
