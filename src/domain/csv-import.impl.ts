// ─────────────────────────────────────────────────────────────────────────────
// CSV IMPORT MODULE — IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject } from './types'
import type {
  ImportSession,
  ImportRow,
  ImportRowStatus,
  FieldMapping,
  MappedImportRow,
  ConflictSummary,
} from './document'
import type { CSVImportModule, ParsedCSV, DetectedMapping, RowValidationError } from './csv-import'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Parse one line of CSV, handling quoted fields and escaped quotes. */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i <= line.length) {
    if (i === line.length) {
      // trailing comma produced an empty field
      if (fields.length > 0) fields.push('')
      break
    }
    if (line[i] === '"') {
      i++ // skip opening quote
      let field = ''
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            field += '"'
            i += 2
          } else {
            i++ // skip closing quote
            break
          }
        } else {
          field += line[i++]
        }
      }
      fields.push(field)
      if (i < line.length && line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) {
        fields.push(line.slice(i).trim())
        break
      } else {
        fields.push(line.slice(i, end).trim())
        i = end + 1
      }
    }
  }
  return fields
}

const VALID_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const CSS_COLOR_NAMES = new Set([
  'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown',
  'black', 'white', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'maroon',
  'navy', 'olive', 'teal', 'aqua', 'silver', 'coral', 'salmon', 'gold',
  'violet', 'indigo', 'turquoise', 'crimson', 'khaki', 'lavender', 'tan',
])

function isValidColor(value: string): boolean {
  return VALID_HEX.test(value) || CSS_COLOR_NAMES.has(value.toLowerCase())
}

/**
 * Expand a table number string that may contain ranges and/or comma-separated
 * values into an array of individual table numbers.
 * Examples:
 *   "1,2,3,4"  → ["1","2","3","4"]
 *   "1-5"      → ["1","2","3","4","5"]
 *   "1,3-5,8"  → ["1","3","4","5","8"]
 *   "42"       → ["42"]
 */
export function expandTableNumbers(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  // If the value has no commas and no dash-between-digits, it's a single table
  if (!/[,]/.test(trimmed) && !/\d\s*-\s*\d/.test(trimmed)) return [trimmed]

  const results: string[] = []
  const parts = trimmed.split(',')

  for (const part of parts) {
    const p = part.trim()
    if (!p) continue

    // Check for range pattern like "1-5" or "1 - 5"
    const rangeMatch = p.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      if (!isNaN(start) && !isNaN(end) && end >= start && end - start < 1000) {
        for (let n = start; n <= end; n++) {
          results.push(String(n))
        }
      } else {
        // Invalid range, keep as-is
        results.push(p)
      }
    } else {
      results.push(p)
    }
  }

  return results
}

type PaymentStatusValue = 'unpaid' | 'partial' | 'paid' | 'comped' | 'unknown'

const PAYMENT_STATUS_ALIASES: Record<string, PaymentStatusValue> = {
  unpaid: 'unpaid', 'not paid': 'unpaid', 'no': 'unpaid', '0': 'unpaid',
  partial: 'partial', 'partially paid': 'partial', 'part': 'partial',
  paid: 'paid', 'yes': 'paid', 'full': 'paid', '1': 'paid', 'fully paid': 'paid',
  comped: 'comped', 'comp': 'comped', 'free': 'comped', 'complimentary': 'comped',
  unknown: 'unknown', '': 'unknown',
}

function normalizePaymentStatus(value: string): PaymentStatusValue | null {
  return PAYMENT_STATUS_ALIASES[value.toLowerCase().trim()] ?? null
}

function normalizeEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export const csvImportModule: CSVImportModule = {
  parseCSV(csvText: string, options?: { noHeaders?: boolean }): ParsedCSV {
    let normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // Auto-detect tab-separated data (pasted from spreadsheets):
    // If the first line has tabs but no commas outside quotes, treat as TSV
    const firstLine = normalized.split('\n')[0] ?? ''
    if (firstLine.includes('\t') && !firstLine.includes(',')) {
      normalized = normalized.split('\n').map(line => {
        // Convert tabs to commas, quoting any fields that contain commas
        return line.split('\t').map(field => {
          const trimmed = field.trim()
          return trimmed.includes(',') ? `"${trimmed.replace(/"/g, '""')}"` : trimmed
        }).join(',')
      }).join('\n')
    }

    const lines = normalized.split('\n')
    // strip trailing empty lines
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()

    if (lines.length === 0) {
      return { headers: [], rows: [], rowCount: 0, parseErrors: [] }
    }

    const MAX_COLUMNS = 50
    const MAX_HEADER_LEN = 100

    // Auto-detect headerless data: if first row's last field looks like a
    // table number (digits, ranges, commas), it's probably data, not a header.
    const firstCells = parseCSVLine(lines[0])
    const lastCell = (firstCells[firstCells.length - 1] ?? '').trim()
    const looksLikeTableNumber = /^\d[\d,\s-]*$/.test(lastCell)
    const hasNoHeaders = options?.noHeaders ?? looksLikeTableNumber

    let headers: string[]
    let dataStartLine: number

    if (hasNoHeaders) {
      // Generate generic column headers: Column A, Column B, ...
      const colCount = Math.min(firstCells.length, MAX_COLUMNS)
      headers = Array.from({ length: colCount }, (_, i) =>
        `Column ${String.fromCharCode(65 + i)}`,
      )
      dataStartLine = 0 // first line IS data
    } else {
      const rawHeaders = firstCells.map(h => h.trim().slice(0, MAX_HEADER_LEN))
      headers = rawHeaders.slice(0, MAX_COLUMNS)
      dataStartLine = 1
    }

    const parseErrors: string[] = []
    const rows: Array<Record<string, string>> = []

    const MAX_ROWS = 5000
    for (let i = dataStartLine; i < lines.length && rows.length < MAX_ROWS; i++) {
      if (!lines[i].trim()) continue
      const cells = parseCSVLine(lines[i])
      if (cells.length !== headers.length) {
        parseErrors.push(
          `Row ${i + 1}: expected ${headers.length} columns, got ${cells.length}`,
        )
      }
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = cells[idx] ?? '' })
      rows.push(row)
    }

    return { headers, rows, rowCount: rows.length, parseErrors }
  },

  detectColumns(headers: string[]): DetectedMapping {
    type Field = keyof FieldMapping
    const patterns: Record<Field, RegExp[]> = {
      tableNumber: [
        /^table\s*#$/i, /^table[\s_]?num(ber)?$/i, /^tbl[\s_]?#?$/i,
        /^table[\s_]?no\.?$/i, /^booth[\s_]?#?$/i, /^#$/,
      ],
      vendorName: [
        /^vendor[\s_]?name$/i, /^vendor$/i, /^name$/i,
        /^exhibitor[\s_]?name$/i, /^exhibitor$/i, /^company$/i, /^business[\s_]?name$/i,
        /^first[\s_]?name$/i, /^first$/i,
      ],
      vendorLastName: [
        /^last[\s_]?name$/i, /^last$/i, /^surname$/i,
      ],
      companyName: [
        /^company$/i, /^company[\s_\(]?billing\)?$/i, /^business[\s_]?name$/i,
        /^billing[\s_]?company$/i, /^organization$/i, /^organisation$/i,
      ],
      email: [
        /^email$/i, /^e-?mail$/i, /^email[\s_]?address$/i, /^contact[\s_]?email$/i,
      ],
      vendorCategory: [
        /^vendor[\s_]?cat(egory)?$/i, /^category$/i, /^cat$/i, /^type$/i,
      ],
      quantity: [
        /^quantity$/i, /^qty$/i, /^tables?$/i, /^table[\s_]?count$/i,
        /^count$/i, /^booths?$/i,
      ],
      tableSize: [
        /^table[\s_]?size$/i, /^size$/i, /^booth[\s_]?size$/i, /^space[\s_]?size$/i,
        /^length$/i,
      ],
      color: [/^color$/i, /^colour$/i, /^table[\s_]?color$/i],
      notes: [/^notes?$/i, /^comments?$/i, /^remarks?$/i, /^memo$/i],
      paymentStatus: [
        /^payment[\s_]?status$/i, /^pay[\s_]?status$/i, /^payment$/i, /^paid[\s_]?status$/i,
      ],
      section: [/^section$/i, /^zone$/i, /^area$/i, /^section[\s_]?name$/i],
    }

    const fieldMapping: FieldMapping = {
      tableNumber: null, vendorName: null, vendorLastName: null, companyName: null, email: null, vendorCategory: null,
      quantity: null,
      tableSize: null,
      color: null, notes: null, paymentStatus: null, section: null,
    }
    const confidence: Record<Field, number> = {
      tableNumber: 0, vendorName: 0, vendorLastName: 0, companyName: 0, email: 0, vendorCategory: 0,
      quantity: 0,
      tableSize: 0,
      color: 0, notes: 0, paymentStatus: 0, section: 0,
    }
    const unmappedHeaders: string[] = []
    const usedFields = new Set<Field>()

    for (const header of headers) {
      let bestField: Field | null = null
      let bestConf = 0

      for (const [field, pats] of Object.entries(patterns) as Array<[Field, RegExp[]]>) {
        if (usedFields.has(field)) continue
        for (let i = 0; i < pats.length; i++) {
          if (pats[i].test(header.trim())) {
            const conf = Math.max(0.5, 1 - i * 0.08)
            if (conf > bestConf) { bestConf = conf; bestField = field }
            break
          }
        }
      }

      if (bestField && bestConf >= 0.5) {
        fieldMapping[bestField] = header
        confidence[bestField] = bestConf
        usedFields.add(bestField)
      } else {
        unmappedHeaders.push(header)
      }
    }

    return { fieldMapping, confidence, unmappedHeaders }
  },

  validateRow(row: Record<string, string>, mapping: FieldMapping): RowValidationError[] {
    const errors: RowValidationError[] = []

    if (mapping.tableNumber !== null) {
      const val = (row[mapping.tableNumber] ?? '').trim()
      if (!val) errors.push({ field: 'tableNumber', value: val, message: 'Table number is required' })
    }

    const firstName = mapping.vendorName !== null ? (row[mapping.vendorName] ?? '').trim() : ''
    const companyName = mapping.companyName !== null ? (row[mapping.companyName] ?? '').trim() : ''
    if (!firstName && !companyName) {
      errors.push({ field: 'vendorName', value: '', message: 'Vendor first name or company is required' })
    }

    if (mapping.quantity !== null) {
      const val = (row[mapping.quantity] ?? '').trim()
      const parsed = parseInt(val, 10)
      if (!val || isNaN(parsed) || parsed < 1) {
        errors.push({ field: 'quantity', value: val, message: 'Quantity must be a whole number of at least 1' })
      }
    }

    if (mapping.color !== null) {
      const val = (row[mapping.color] ?? '').trim()
      if (val && !isValidColor(val)) {
        errors.push({ field: 'color', value: val, message: `Invalid color: "${val}" — use hex (#ff0000) or a CSS color name` })
      }
    }

    if (mapping.paymentStatus !== null) {
      const val = (row[mapping.paymentStatus] ?? '').trim()
      if (val && normalizePaymentStatus(val) === null) {
        errors.push({
          field: 'paymentStatus',
          value: val,
          message: `Unknown payment status: "${val}" — use unpaid, partial, paid, comped, or unknown`,
        })
      }
    }

    return errors
  },

  buildSession(
    parsed, mapping, existingTables, existingAssignments, layoutId, createdBy, sessionId,
  ): ImportSession {
    const now = new Date().toISOString()

    const tablesByLabel = new Map<string, TableObject>()
    for (const t of existingTables) {
      tablesByLabel.set(t.label.toLowerCase().trim(), t)
    }

    const assignedTableIds = new Set(existingAssignments.map(a => a.tableId))
    const seenLabels = new Map<string, number>() // label → first rowIndex

    const rows: ImportRow[] = []

    for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex++) {
      const rawData = parsed.rows[rowIndex]
      const rawTableNumber = (mapping.tableNumber ? rawData[mapping.tableNumber] ?? '' : '').trim()
      const firstName = (mapping.vendorName ? rawData[mapping.vendorName] ?? '' : '').trim()
      const lastName = (mapping.vendorLastName ? rawData[mapping.vendorLastName] ?? '' : '').trim()
      const companyName = (mapping.companyName ? rawData[mapping.companyName] ?? '' : '').trim()
      const email = normalizeEmail(mapping.email ? rawData[mapping.email] ?? '' : '')
      const fullName = [firstName, lastName].filter(Boolean).join(' ')
      const vendorName = companyName || fullName
      const expandedTables = expandTableNumbers(rawTableNumber)
      const quantity = mapping.quantity
        ? Math.max(1, parseInt(rawData[mapping.quantity] ?? '', 10) || 1)
        : Math.max(1, expandedTables.length || 1)
      const tableSize = mapping.tableSize
        ? (rawData[mapping.tableSize] ?? '').trim() || null
        : null

      const rawPayStatus = mapping.paymentStatus ? rawData[mapping.paymentStatus] ?? '' : ''
      const normStatus   = normalizePaymentStatus(rawPayStatus)

      const sharedFields = {
        firstName,
        lastName,
        companyName: companyName || null,
        email,
        vendorCategory: mapping.vendorCategory ? (rawData[mapping.vendorCategory] ?? '').trim() || null : null,
        quantity,
        tableSize,
        color:          mapping.color          ? (rawData[mapping.color]          ?? '').trim() || null : null,
        notes:          mapping.notes          ? (rawData[mapping.notes]          ?? '').trim() || null : null,
        paymentStatus:  normStatus,
        section:        mapping.section        ? (rawData[mapping.section]        ?? '').trim() || null : null,
      }

      // invalid-field check (on the original row)
      const valErrors = csvImportModule.validateRow(rawData, mapping)
      if (valErrors.length > 0) {
        const mapped: MappedImportRow = { tableNumber: rawTableNumber, vendorName, ...sharedFields }
        rows.push({
          rowIndex, rawData, mapped,
          status: 'conflict' as ImportRowStatus,
          conflict: {
            type: 'invalid-field',
            message: valErrors.map(e => e.message).join('; '),
            affectedTableId: null,
            resolution: null,
          },
        })
        continue
      }

      // Expand table numbers: "1,2,3" or "1-5" → multiple entries
      const mapped: MappedImportRow = { tableNumber: rawTableNumber, vendorName, ...sharedFields }

      if (expandedTables.length === 0) {
        rows.push({ rowIndex, rawData, mapped, status: 'valid' as ImportRowStatus, conflict: null })
        continue
      }

      let conflict: ImportRow['conflict'] = null
      for (const tableNumber of expandedTables) {
        const labelKey = tableNumber.toLowerCase()
        if (seenLabels.has(labelKey)) {
          const firstRow = seenLabels.get(labelKey)!
          conflict = {
            type: 'duplicate-in-import',
            message: `Table "${tableNumber}" appears more than once (first at row ${firstRow + 1})`,
            affectedTableId: null,
            resolution: null,
          }
          break
        }

        const table = tablesByLabel.get(labelKey)
        if (!table) {
          conflict = {
            type: 'table-not-found',
            message: `No table labeled "${tableNumber}" found on the floor plan`,
            affectedTableId: null,
            resolution: null,
          }
          break
        }

        if (assignedTableIds.has(table.id)) {
          conflict = {
            type: 'already-assigned',
            message: `Table "${tableNumber}" already has a vendor assigned`,
            affectedTableId: table.id,
            resolution: null,
          }
          break
        }
      }

      if (conflict) {
        rows.push({
          rowIndex,
          rawData,
          mapped,
          status: 'conflict' as ImportRowStatus,
          conflict,
        })
        continue
      }

      for (const tableNumber of expandedTables) {
        seenLabels.set(tableNumber.toLowerCase(), rowIndex)
      }

      rows.push({ rowIndex, rawData, mapped, status: 'valid' as ImportRowStatus, conflict: null })
    }

    return {
      id: sessionId,
      layoutId,
      createdBy,
      createdAt: now,
      status: 'reviewing',
      fieldMapping: mapping,
      rows,
      conflictSummary: csvImportModule.recomputeSummary(rows),
      appliedAt: null,
      revertedAt: null,
      snapshotIdBeforeApply: null,
    }
  },

  recomputeSummary(rows): ConflictSummary {
    let validRows = 0, conflictRows = 0, skippedRows = 0
    let tablesNotFound = 0, alreadyAssigned = 0

    for (const row of rows) {
      if (row.status === 'valid' || row.status === 'applied') {
        validRows++
      } else if (row.status === 'skipped') {
        skippedRows++
      } else if (row.status === 'conflict') {
        if (row.conflict?.resolution === 'skip') {
          skippedRows++
        } else if (row.conflict?.resolution !== null && row.conflict?.resolution !== undefined) {
          // resolved (overwrite / create-unplaced) — counts as valid
          validRows++
        } else {
          // unresolved
          conflictRows++
          if (row.conflict?.type === 'table-not-found')  tablesNotFound++
          if (row.conflict?.type === 'already-assigned') alreadyAssigned++
        }
      }
    }

    return {
      totalRows: rows.length,
      validRows,
      conflictRows,
      skippedRows,
      tablesNotFound,
      alreadyAssigned,
    }
  },

  isReadyToApply(session): boolean {
    if (session.conflictSummary.conflictRows > 0) return false
    return session.rows.some(r =>
      r.status === 'valid' ||
      (r.status === 'conflict' && r.conflict?.resolution === 'overwrite') ||
      (r.status === 'conflict' && r.conflict?.resolution === 'create-unplaced'),
    )
  },
}
