'use client'

import { useMemo } from 'react'
import { useEditorStore, selectShowInventoryKey, selectTables, selectVendorAssignments, selectVendors } from '@floorplanner/store/index'
import { resolveVendorBuckets } from '@floorplanner/lib/vendor-resolution'
import { compressTableLabels } from '@floorplanner/lib/table-ranges'
import { buildShowInventoryOptions, parseInventoryTags, vendorHasInventory } from '@floorplanner/lib/show-inventory'

export default function ShowModeVendorList() {
  const vendors = useEditorStore(selectVendors)
  const tables = useEditorStore(selectTables)
  const assignments = useEditorStore(selectVendorAssignments)
  const selectedInventoryKey = useEditorStore(selectShowInventoryKey)
  const inventoryColorMap = useMemo(
    () => new Map(buildShowInventoryOptions(vendors).map(option => [option.key, option.color])),
    [vendors],
  )

  const rows = useMemo(() => {
    return resolveVendorBuckets(vendors, assignments)
      .map(bucket => ({
        id: bucket.key,
        name: bucket.displayName,
        inventory: parseInventoryTags(bucket.vendor?.inventory),
        cases: bucket.vendor?.cases ?? 0,
        inventoryMatch: vendorHasInventory(bucket.vendor, selectedInventoryKey),
        labels: bucket.assignments
          .map(assignment => tables[assignment.tableId]?.displayId ?? tables[assignment.tableId]?.label ?? assignment.tableId)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      }))
      .filter(row => row.labels.length > 0)
      .filter(row => !selectedInventoryKey || row.inventoryMatch)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [assignments, selectedInventoryKey, tables, vendors])

  const selectedInventoryColor = selectedInventoryKey ? inventoryColorMap.get(selectedInventoryKey) ?? '#2563eb' : null

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor List</div>
        <div className="mt-1 text-sm text-slate-600">
          {rows.length} vendor{rows.length === 1 ? '' : 's'}
          {selectedInventoryKey ? ' matching this inventory' : ''}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">
            No vendors have tables assigned yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.map(row => (
              <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 px-4 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  {selectedInventoryColor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedInventoryColor }} />}
                  <div className="truncate text-slate-900">{row.name}</div>
                  {row.cases > 0 && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">Cases {row.cases}</span>}
                </div>
                <div className="text-right font-medium text-slate-600">{compressTableLabels(row.labels)}</div>
                {!selectedInventoryKey && row.inventory.length > 0 && (
                  <div className="col-span-2 flex flex-wrap gap-1 pb-1">
                    {row.inventory.slice(0, 3).map(label => {
                      const color = inventoryColorMap.get(label.toLowerCase()) ?? '#94a3b8'
                      return (
                        <span
                          key={label}
                          className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          style={{ boxShadow: `inset 0 0 0 1px ${color}33` }}
                        >
                          {label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
