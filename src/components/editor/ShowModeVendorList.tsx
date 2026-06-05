'use client'

import { useMemo } from 'react'
import { useEditorStore, selectTables, selectVendorAssignments, selectVendors } from '@/store/index'
import { resolveVendorBuckets } from '@/lib/vendor-resolution'
import { compressTableLabels } from '@/lib/table-ranges'

export default function ShowModeVendorList() {
  const vendors = useEditorStore(selectVendors)
  const tables = useEditorStore(selectTables)
  const assignments = useEditorStore(selectVendorAssignments)

  const rows = useMemo(() => {
    return resolveVendorBuckets(vendors, assignments)
      .map(bucket => ({
        id: bucket.key,
        name: bucket.displayName,
        cases: bucket.vendor?.cases ?? 0,
        labels: bucket.assignments
          .map(assignment => tables[assignment.tableId]?.displayId ?? tables[assignment.tableId]?.label ?? assignment.tableId)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      }))
      .filter(row => row.labels.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [assignments, tables, vendors])

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor List</div>
        <div className="mt-1 text-sm text-slate-600">
          {rows.length} vendor{rows.length === 1 ? '' : 's'}
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
                  <div className="truncate text-slate-900">{row.name}</div>
                  {row.cases > 0 && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">Cases {row.cases}</span>}
                </div>
                <div className="text-right font-medium text-slate-600">{compressTableLabels(row.labels)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
