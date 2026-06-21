'use client'

import { useState } from 'react'
import type { Vendor } from '@floorplanner/domain/types'
import { createVendorId } from '@floorplanner/lib/id'
import { vendorDisplayName } from '@floorplanner/lib/vendor-resolution'
import { selectVendors, useEditorStore } from '@floorplanner/store/index'

export default function VendorQuickAdd() {
  const fieldClassName =
    'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400'
  const vendors = useEditorStore(selectVendors)
  const addVendor = useEditorStore(s => s.addVendor)
  const updateVendor = useEditorStore(s => s.updateVendor)
  const [name, setName] = useState('')
  const [tablesNeeded, setTablesNeeded] = useState('1')
  const [premium, setPremium] = useState(false)
  const [cases, setCases] = useState('0')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    const trimmedName = name.trim()
    const parsedCount = Number.parseInt(tablesNeeded, 10)
    const parsedCases = Number.parseInt(cases, 10)
    if (!trimmedName) {
      setError('Enter a vendor name.')
      return
    }
    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      setError('Count must be 1 or more.')
      return
    }
    if (!Number.isFinite(parsedCases) || parsedCases < 0) {
      setError('Cases must be 0 or more.')
      return
    }

    const normalizedName = trimmedName.toLowerCase()
    const existing = Object.values(vendors).find(v => (
      (v.companyName?.trim() || vendorDisplayName(v)).toLowerCase() === normalizedName
    ))

    if (existing) {
      updateVendor(existing.id, {
        tablesNeeded: existing.tablesNeeded + parsedCount,
        premium: existing.premium || premium,
        cases: existing.cases + parsedCases,
      })
    } else {
      const vendor: Vendor = {
        id: createVendorId(),
        name: trimmedName,
        companyName: trimmedName,
        firstName: null,
        lastName: null,
        email: null,
        tablesNeeded: parsedCount,
        tableSize: null,
        inventory: null,
        category: null,
        paymentStatus: 'unknown',
        notes: null,
        premium,
        cases: parsedCases,
      }
      addVendor(vendor)
    }

    setName('')
    setTablesNeeded('1')
    setPremium(false)
    setCases('0')
    setError(null)
  }

  return (
    <div className="border-b border-slate-200 bg-white px-3 py-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Add Vendor
      </div>
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={e => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit()
          }}
          placeholder="Vendor name"
          className={`min-w-0 flex-1 ${fieldClassName}`}
        />
        <input
          type="number"
          min={1}
          value={tablesNeeded}
          onChange={e => {
            setTablesNeeded(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit()
          }}
          aria-label="Tables needed"
          className={`w-16 text-right ${fieldClassName}`}
        />
        <button
          onClick={handleSubmit}
          className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add
        </button>
      </div>
      <div className="mt-2 flex items-center gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={premium}
            onChange={e => setPremium(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>Premium</span>
        </label>
        <label className="flex items-center gap-2">
          <span>Cases</span>
          <input
            type="number"
            min={0}
            value={cases}
            onChange={e => setCases(e.target.value)}
            className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 placeholder:text-slate-400"
            aria-label="Number of cases"
          />
        </label>
      </div>
      {error && <div className="mt-2 text-xs font-medium text-red-700">{error}</div>}
    </div>
  )
}
