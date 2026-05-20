'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '@/store/index'
import type { FieldMapping, ConflictResolution } from '@/domain/document'
import { csvImportModule } from '@/domain/csv-import.impl'

interface Props {
  onClose: () => void
}

const FIELD_LABELS: Record<keyof FieldMapping, string> = {
  tableNumber: 'Table Number',
  vendorName: 'First Name',
  vendorLastName: 'Last Name',
  companyName: 'Company (Billing)',
  email: 'Email',
  vendorCategory: 'Category',
  quantity: 'Quantity',
  color: 'Color',
  notes: 'Notes',
  paymentStatus: 'Payment Status',
  section: 'Section',
}

const STRUCTURED_IMPORT_COLUMNS: Array<{ key: keyof FieldMapping; placeholder: string }> = [
  { key: 'tableNumber', placeholder: '1-2' },
  { key: 'vendorName', placeholder: 'Jane' },
  { key: 'vendorLastName', placeholder: 'Doe' },
  { key: 'companyName', placeholder: 'Card Castle' },
  { key: 'email', placeholder: 'jane@example.com' },
  { key: 'vendorCategory', placeholder: 'Premium' },
  { key: 'quantity', placeholder: '2' },
  { key: 'color', placeholder: '#ff0000' },
  { key: 'notes', placeholder: 'Corner booth' },
  { key: 'paymentStatus', placeholder: 'paid' },
  { key: 'section', placeholder: 'Main Hall' },
]

type StructuredImportRow = Record<keyof FieldMapping, string>

function createEmptyStructuredRow(): StructuredImportRow {
  return {
    tableNumber: '',
    vendorName: '',
    vendorLastName: '',
    companyName: '',
    email: '',
    vendorCategory: '',
    quantity: '',
    color: '',
    notes: '',
    paymentStatus: '',
    section: '',
  }
}

function csvEscape(value: string): string {
  const trimmed = value.trim()
  if (!/[",\n]/.test(trimmed)) return trimmed
  return `"${trimmed.replace(/"/g, '""')}"`
}

function structuredRowsToCsv(rows: StructuredImportRow[]): string {
  const nonEmptyRows = rows.filter(row =>
    STRUCTURED_IMPORT_COLUMNS.some(col => row[col.key].trim() !== ''),
  )
  if (nonEmptyRows.length === 0) return ''

  const header = STRUCTURED_IMPORT_COLUMNS.map(col => FIELD_LABELS[col.key]).join(',')
  const body = nonEmptyRows.map(row =>
    STRUCTURED_IMPORT_COLUMNS.map(col => csvEscape(row[col.key])).join(','),
  )
  return [header, ...body].join('\n')
}

function parseStructuredPaste(text: string): StructuredImportRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean)

  return lines.map(line => {
    const parts = line.split('\t')
    const row = createEmptyStructuredRow()
    STRUCTURED_IMPORT_COLUMNS.forEach((col, idx) => {
      row[col.key] = parts[idx] ?? ''
    })
    return row
  })
}

export default function ImportModal({ onClose }: Props) {
  const importSession = useEditorStore(s => s.importSession)
  const startImport = useEditorStore(s => s.startImportSession)
  const updateMapping = useEditorStore(s => s.updateImportMapping)
  const resolveConflict = useEditorStore(s => s.resolveImportConflict)
  const applyImport = useEditorStore(s => s.applyImport)
  const cancelImport = useEditorStore(s => s.cancelImport)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [inputMode, setInputMode] = useState<'raw' | 'structured'>('raw')
  const [csvText, setCsvText] = useState('')
  const [parseError, setParseError] = useState('')
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [structuredRows, setStructuredRows] = useState<StructuredImportRow[]>(
    () => Array.from({ length: 8 }, () => createEmptyStructuredRow()),
  )
  const fileRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    cancelImport()
    onClose()
  }, [cancelImport, onClose])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  const MAX_FILE_SIZE = 10 * 1024 * 1024

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setParseError('File is too large (max 10 MB).')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      setInputMode('raw')
      setCsvText((ev.target?.result as string) ?? '')
    }
    reader.readAsText(file)
  }

  function handleParse() {
    const sourceText = inputMode === 'structured'
      ? structuredRowsToCsv(structuredRows)
      : csvText

    if (!sourceText.trim()) {
      setParseError(inputMode === 'structured'
        ? 'Paste spreadsheet rows or type into the grid before continuing.'
        : 'Paste CSV content or choose a file.')
      return
    }
    setParseError('')
    const preParsed = csvImportModule.parseCSV(sourceText)
    setParseWarnings(preParsed.parseErrors)
    startImport(sourceText)
    setStep(2)
  }

  function handleStructuredCellChange(rowIndex: number, field: keyof FieldMapping, value: string) {
    setStructuredRows(rows => rows.map((row, idx) =>
      idx === rowIndex ? { ...row, [field]: value } : row,
    ))
  }

  function handleStructuredPaste(e: React.ClipboardEvent<HTMLTableSectionElement>) {
    const active = document.activeElement
    if (!(active instanceof HTMLInputElement)) return

    const rowIndex = Number(active.dataset.rowIndex ?? '-1')
    const colIndex = Number(active.dataset.colIndex ?? '-1')
    if (rowIndex < 0 || colIndex < 0) return

    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return

    e.preventDefault()
    const pastedRows = parseStructuredPaste(text)
    if (pastedRows.length === 0) return

    setStructuredRows(current => {
      const next = [...current]
      const neededRows = rowIndex + pastedRows.length
      while (next.length < neededRows) next.push(createEmptyStructuredRow())

      pastedRows.forEach((pastedRow, pastedRowIndex) => {
        const targetIndex = rowIndex + pastedRowIndex
        const merged = { ...next[targetIndex] }

        STRUCTURED_IMPORT_COLUMNS.forEach((col, pastedColIndex) => {
          const targetColIndex = colIndex + pastedColIndex
          if (targetColIndex >= STRUCTURED_IMPORT_COLUMNS.length) return
          const targetKey = STRUCTURED_IMPORT_COLUMNS[targetColIndex].key
          merged[targetKey] = pastedRow[col.key]
        })

        next[targetIndex] = merged
      })

      return next
    })
  }

  function handleMappingChange(field: keyof FieldMapping, value: string) {
    if (!importSession) return
    const mapping = { ...importSession.fieldMapping, [field]: value || null }
    updateMapping(mapping)
  }

  function handleResolve(rowIndex: number, resolution: ConflictResolution) {
    resolveConflict(rowIndex, resolution)
  }

  function handleApply() {
    applyImport()
    onClose()
  }

  const headers = importSession?.rows[0]
    ? Object.keys(importSession.rows[0].rawData)
    : []

  const summary = importSession?.conflictSummary
  const canApply = importSession
    ? importSession.conflictSummary.conflictRows === 0 &&
      importSession.conflictSummary.validRows > 0
    : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-base">Import Vendors</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

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

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-400 text-sm">
                Paste from a spreadsheet, upload a .csv file, or type data below.
                This importer supports first name, last name, company, category, and quantity.
                Table numbers are optional.
              </p>

              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => setInputMode('raw')}
                  className={`px-3 py-1.5 rounded ${inputMode === 'raw' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  Raw CSV / TSV
                </button>
                <button
                  onClick={() => setInputMode('structured')}
                  className={`px-3 py-1.5 rounded ${inputMode === 'structured' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  Spreadsheet View
                </button>
              </div>

              {inputMode === 'raw' ? (
                <>
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
                    placeholder={'Paste tab-separated data or CSV:\n\nFirst Name\tLast Name\tCompany (Billing)\tCategory\tQuantity\nAaron\tMursch\tSenpai Nation\tPremium\t1\nAlex\tSeyler\t\tPremium\t2\n\nOr with table assignments:\nTable #,First Name,Last Name,Company,Quantity\n1-2,Jane,Doe,Card Castle,2'}
                    className="w-full h-48 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs font-mono p-3 resize-none focus:outline-none focus:border-blue-500"
                  />
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                      Paste directly from Excel or Google Sheets into the grid. Columns stay aligned with the importer fields.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStructuredRows(rows => [...rows, createEmptyStructuredRow(), createEmptyStructuredRow()])}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                      >
                        Add Rows
                      </button>
                      <button
                        onClick={() => setStructuredRows(Array.from({ length: 8 }, () => createEmptyStructuredRow()))}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="overflow-auto border border-gray-700 rounded">
                    <table className="min-w-full text-xs text-gray-200">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="px-2 py-2 text-left text-gray-500 w-10">#</th>
                          {STRUCTURED_IMPORT_COLUMNS.map(col => (
                            <th key={col.key} className="px-2 py-2 text-left text-gray-400 whitespace-nowrap">
                              {FIELD_LABELS[col.key]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody onPaste={handleStructuredPaste}>
                        {structuredRows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t border-gray-800">
                            <td className="px-2 py-1 text-gray-500 align-top">{rowIndex + 1}</td>
                            {STRUCTURED_IMPORT_COLUMNS.map((col, colIndex) => (
                              <td key={col.key} className="p-1">
                                <input
                                  data-row-index={rowIndex}
                                  data-col-index={colIndex}
                                  value={row[col.key]}
                                  onChange={e => handleStructuredCellChange(rowIndex, col.key, e.target.value)}
                                  placeholder={col.placeholder}
                                  className="w-36 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {parseError && <p className="text-red-400 text-sm">{parseError}</p>}
            </div>
          )}

          {step === 2 && importSession && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-400 text-sm">
                Match your CSV columns to the expected fields. Map either a person name, a company, or both. Quantity defaults to 1 if omitted.
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
                {importSession.rows[0] && <> - columns: {headers.join(', ')}</>}
              </div>
              {parseWarnings.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-3 text-sm">
                  <p className="text-yellow-400 font-medium text-xs mb-1">Parse warnings ({parseWarnings.length})</p>
                  <ul className="text-yellow-300/80 text-xs space-y-0.5 max-h-24 overflow-y-auto">
                    {parseWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {parseError && <p className="text-red-400 text-sm">{parseError}</p>}
            </div>
          )}

          {step === 3 && importSession && (
            <div className="flex flex-col gap-4">
              {summary && (
                <div className="flex gap-4 text-sm bg-gray-800 rounded p-3">
                  <span><span className="text-green-400 font-semibold">{summary.validRows}</span> <span className="text-gray-400">will apply</span></span>
                  <span><span className="text-yellow-400 font-semibold">{summary.conflictRows}</span> <span className="text-gray-400">unresolved</span></span>
                  <span><span className="text-gray-500 font-semibold">{summary.skippedRows}</span> <span className="text-gray-400">skipped</span></span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-gray-300">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left py-1 pr-3 w-6">#</th>
                      <th className="text-left py-1 pr-3">Table</th>
                      <th className="text-left py-1 pr-3">Vendor</th>
                      <th className="text-left py-1 pr-3">Qty</th>
                      <th className="text-left py-1 pr-3">Category</th>
                      <th className="text-left py-1 pr-3">Status</th>
                      <th className="text-left py-1">Resolve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSession.rows.map(row => {
                      const isConflict = row.status === 'conflict' && row.conflict?.resolution == null
                      return (
                        <tr key={row.rowIndex} className="border-b border-gray-800">
                          <td className="py-1 pr-3 text-gray-600">{row.rowIndex + 1}</td>
                          <td className="py-1 pr-3">{row.mapped.tableNumber || <span className="text-red-400">-</span>}</td>
                          <td className="py-1 pr-3">{row.mapped.vendorName || <span className="text-gray-600">-</span>}</td>
                          <td className="py-1 pr-3">{row.mapped.quantity}</td>
                          <td className="py-1 pr-3">{row.mapped.vendorCategory || <span className="text-gray-600">-</span>}</td>
                          <td className="py-1 pr-3">
                            {row.status === 'valid' && <span className="text-green-400">Valid</span>}
                            {row.status === 'skipped' && <span className="text-gray-500">Skipped</span>}
                            {row.status === 'applied' && <span className="text-blue-400">Applied</span>}
                            {row.status === 'conflict' && (
                              <span className={isConflict ? 'text-yellow-400' : 'text-gray-400'} title={row.conflict?.message ?? ''}>
                                {isConflict ? `! ${row.conflict?.type}` : `OK ${row.conflict?.resolution}`}
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
                                <option value="">- choose -</option>
                                {row.conflict?.type === 'already-assigned' && (
                                  <option value="overwrite">Overwrite</option>
                                )}
                                {row.conflict?.type === 'table-not-found' && (
                                  <option value="create-unplaced">Create vendor only</option>
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
                    if (!importSession) return
                    if (!importSession.fieldMapping.vendorName && !importSession.fieldMapping.companyName) {
                      setParseError('Map at least "First Name" or "Company (Billing)" before continuing.')
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
