'use client'

import { useState } from 'react'
import { useEditorStore } from '@floorplanner/store/index'
import { printVendorManifest } from '@floorplanner/lib/export'
import { vendorDisplayName } from '@floorplanner/lib/vendor-resolution'

export default function CaseRentalsPanel() {
  const vendors = useEditorStore(s => s.vendors)
  const updateVendor = useEditorStore(s => s.updateVendor)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const all = Object.values(vendors)
  const renters = all.filter(v => v.cases > 0)
  return <div className="space-y-4 p-3">
    <div className="rounded-xl bg-blue-50 p-3"><strong className="block text-lg text-blue-900">{renters.reduce((sum, v) => sum + v.cases, 0)} cases reserved</strong><span className="text-sm text-blue-800">Across {renters.length} vendors</span></div>
    <p className="text-sm text-slate-600">Set each vendor’s case quantity here. Changes save with your show and appear in the vendor roster.</p>
    <input aria-label="Search case rentals" placeholder="Find a vendor…" value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border p-2 text-sm" />
    {!all.length && <p className="text-sm text-slate-500">Add your vendors in the Vendors tab first.</p>}
    {all.filter(v => vendorDisplayName(v).toLowerCase().includes(search.toLowerCase())).sort((a, b) => vendorDisplayName(a).localeCompare(vendorDisplayName(b))).map(v => <label key={v.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"><span className="break-words text-sm font-medium">{vendorDisplayName(v)}</span><input aria-label={`Cases for ${vendorDisplayName(v)}`} type="number" min={0} max={9999} step={1} value={v.cases} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 0 && value <= 9999) updateVendor(v.id, { cases: value }) }} className="w-20 shrink-0 rounded-lg border p-2 text-sm" /></label>)}
    <button disabled={!renters.length} onClick={() => { try { setError(''); const s = useEditorStore.getState(); printVendorManifest(s.tables, s.vendors, s.vendorAssignments, s.settings.eventName, { casesOnly: true }) } catch (e) { setError(e instanceof Error ? e.message : 'Could not open printing.') } }} className="w-full rounded-xl bg-slate-900 p-3 text-sm font-semibold text-white disabled:opacity-40">Print case rental checklist</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>
}
