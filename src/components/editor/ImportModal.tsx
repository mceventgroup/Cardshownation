'use client'
// ─────────────────────────────────────────────────────────────────────────────
// IMPORT MODAL
//
// 3-step CSV import flow:
//   Step 1 — Paste / upload CSV
//   Step 2 — Map CSV columns to fields
//   Step 3 — Review rows, resolve conflicts, apply
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react'
import { useEditorStore } from '@/store'
import type { FieldMapping, ConflictResolution } from '@/domain/document'

interface Props {
  onClose: () => void
}

const FIELD_LABELS: Record<keyof FieldMapping, string> = {
  tableNumber:    'Table Number *',
  vendorName:     'Vendor Name *',
  vendorCategory: 'Category',
  color:          'Color',
  notes:          'Notes',
  paymentStatus:  'Payment Status',
  section:        'Section',
}

export default function ImportModal({ onClose }: Props) {
  const importSession   = useEditorStore(s => s.importSession)
  const startImport     = useEditorStore(s => s.startImportSession)
  const updateMapping   = useEditorStore(s => s.updateImportMapping)
  const resolveConflict = useEditorStore(s => s.resolveImportConflict)
  const applyImport     = useEditorStore(s => s.applyImport)
  const cancelImport    = useEditorStore(s => s.cancelImport)

  const [step, setStep]       = useState<1 | 2 | 3>(1)
  const [csvText, setCsvText] = useState('')
  const [parseError, setParseError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // handleClose is stable (no deps) — no need to re-register
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Step 1: upload / paste ───────────────────────────────────────────────

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setParseError('File is too large (max 10 MB).')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setCsvText((ev.target?.result as string) ?? '')
    reader.readAsText(file)
  }

  function handleParse() {
    if (!csvText.trim()) { setParseError('Paste CSV content or choose a file.'); return }
    setParseError('')
    startImport(csvText)
    setStep(2)
  }

  // ── Step 2: field mapping ────────────────────────────────────────────────

  function handleMappingChange(field: keyof FieldMapping, value: string) {
    if (!importSession) return
    const mapping = { ...importSession.fieldMapping, [field]: value || null }
    updateMapping(mapping)
  }

  // ── Step 3: review ───────────────────────────────────────────────────────

  function handleResolve(rowIndex: number, resolution: ConflictResolution) {
    resolveConflict(rowIndex, resolution)
  }

  function handleApply() {
    applyImport()
    onClose()
  }

  function handleClose() {
    cancelImport()
    onClose()
  }

  const headers = importSession?.rows[0]
    ? Object.keys(importSession.rows[0].rawData)
    : []

  const summary = importSession?.conflictSummary

  const canApply = importSession
    ? importSession.conflictSummary.conflictRows === 0 &&
      (importSession.conflictSummary.validRows > 0)
    : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-base">Import Vendors from CSV</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-0 border-b border-gray-700 text-xs">
          {(['Upload', 'Map Fields', 'Review & Apply'] as const).map((label, i) => (
            <div
              key={label}
              className={`px-5 py-2 border-b-2 ${step === i + 1 ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500'}`}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step 1 ─────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-400 text-sm">
                Upload a .csv file or paste your CSV content below. The first row must be column headers.
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
                >
                  Choose File
                </button>
                <span className="text-gray-500 text-sm">or paste below</span>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              </div>

              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={'Table #,Vendor Name,Category,Payment Status\n1,Acme Comics,Comics,paid\n2,Star Cards,Trading Cards,unpaid'}
                className="w-full h-48 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs font-mono p-3 resize-none focus:outline-none focus:border-blue-500"
              />

              {parseError && step === 1 && <p className="text-red-400 text-sm">{parseError}</p>}
            </div>
          )}

          {/* ── Step 2 ─────────────────────────────────────────────────── */}
          {step === 2 && importSession && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-400 text-sm">
                Match your CSV columns to the expected fields. Fields marked * are required.
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {(Object.keys(FIELD_LABELS) as Array<keyof FieldMapping>).map(field => (
                  <div key={field} className="flex flex-col gap-1">
                    <label className="text-gray-400 text-xs">{FIELD_LABELS[field]}</label>
                    <select
                      value={importSession.fieldMapping[field] ?? ''}
                      onChange={e => handleMappingChange(field, e.target.value)}
                      className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">(not mapped)</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="bg-gray-800 rounded p-3 text-sm text-gray-400">
                <span className="text-white">{importSession.rows.length}</span> rows parsed
                {importSession.rows[0] && (
                  <> &mdash; columns: {headers.join(', ')}</>
                )}
              </div>
              {parseError && <p className="text-red-400 text-sm">{parseError}</p>}
            </div>
          )}

          {/* ── Step 3 ─────────────────────────────────────────────────── */}
          {step === 3 && importSession && (
            <div className="flex flex-col gap-4">
              {/* Summary bar */}
              {summary && (
                <div className="flex gap-4 text-sm bg-gray-800 rounded p-3">
                  <span><span className="text-green-400 font-semibold">{summary.validRows}</span> <span className="text-gray-400">will apply</span></span>
                  <span><span className="text-yellow-400 font-semibold">{summary.conflictRows}</span> <span className="text-gray-400">unresolved</span></span>
                  <span><span className="text-gray-500 font-semibold">{summary.skippedRows}</span> <span className="text-gray-400">skipped</span></span>
                </div>
              )}

              {/* Rows table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-gray-300">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-1 pr-3 w-6">#</th>
                      <th className="text-left py-1 pr-3">Table</th>
                      <th className="text-left py-1 pr-3">Vendor</th>
                      <th className="text-left py-1 pr-3">Status</th>
                      <th className="text-left py-1">Resolve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSession.rows.map(row => {
                      const isConflict = row.status === 'conflict' && row.conflict?.resolution == null
                      const isResolved = row.status === 'conflict' && row.conflict?.resolution != null
                      return (
                        <tr key={row.rowIndex} className="border-b border-gray-800">
                          <td className="py-1 pr-3 text-gray-600">{row.rowIndex + 1}</td>
                          <td className="py-1 pr-3">{row.mapped.tableNumber || <span className="text-red-400">—</span>}</td>
                          <td className="py-1 pr-3">{row.mapped.vendorName || <span className="text-gray-600">—</span>}</td>
                          <td className="py-1 pr-3">
                            {row.status === 'valid' && <span className="text-green-400">Valid</span>}
                            {row.status === 'skipped' && <span className="text-gray-500">Skipped</span>}
                            {row.status === 'applied' && <span className="text-blue-400">Applied</span>}
                            {row.status === 'conflict' && (
                              <span className={isConflict ? 'text-yellow-400' : 'text-gray-400'} title={row.conflict?.message ?? ''}>
                                {isConflict ? `⚠ ${row.conflict?.type}` : `✓ ${row.conflict?.resolution}`}
                              </span>
                            )}
                          </td>
                          <td className="py-1">
                            {row.status === 'conflict' && (
                              <select
                                value={row.conflict?.resolution ?? ''}
                                onChange={e => handleResolve(row.rowIndex, e.target.value as ConflictResolution)}
                                className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-1 py-0.5 focus:outline-none focus:border-blue-500"
                              >
                                <option value="">— choose —</option>
                                {row.conflict?.type === 'already-assigned' && (
                                  <option value="overwrite">Overwrite</option>
                                )}
                                {row.conflict?.type === 'table-not-found' && (
                                  <option value="create-unplaced">Skip (table not found)</option>
                                )}
                                <option value="skip">Skip this row</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-sm">
            Cancel
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button
                onClick={() => {
                  if (step === 1) {
                    handleParse()
                  } else {
                    // Step 2: require tableNumber and vendorName before proceeding
                    if (!importSession?.fieldMapping.tableNumber || !importSession?.fieldMapping.vendorName) {
                      setParseError('Map at least "Table Number" and "Vendor Name" before continuing.')
                      return
                    }
                    setParseError('')
                    setStep(3)
                  }
                }}
                disabled={step === 1 && !csvText.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded"
              >
                Next
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleApply}
                disabled={!canApply}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm rounded"
              >
                Apply Import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
