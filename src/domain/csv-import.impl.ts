// ─────────────────────────────────────────────────────────────────────────────
// CSV IMPORT MODULE — IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, LayoutId, UserId, ImportSessionId, VendorAssignmentId } from './types'
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

// ─────────────────────────────────────────────────────────────────────────────
// MODULE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export const csvImportModule: CSVImportModule = {
  parseCSV(csvText: string): ParsedCSV {
    const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n')
    // strip trailing empty lines
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()

    if (lines.length === 0) {
      return { headers: [], rows: [], rowCount: 0, parseErrors: [] }
    }

    const MAX_COLUMNS = 50
    const MAX_HEADER_LEN = 100
    const rawHeaders = parseCSVLine(lines[0]).map(h => h.trim().slice(0, MAX_HEADER_LEN))
    const headers = rawHeaders.slice(0, MAX_COLUMNS)
    const parseErrors: string[] = []
    const rows: Array<Record<string, string>> = []

    const MAX_ROWS = 5000
    for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
      if (!lines[i].trim()) continue
      const cells = parseCSVLine(lines[i])
      if (cells.length !== headers.length) {
        parseErrors.push(
          `Row ${i}: expected ${headers.length} columns, got ${cells.length}`,
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
        /^table[\s_]?no\.?$/i, /^booth[\s_]?#?$/i, /^table$/i, /^#$/,
      ],
      vendorName: [
        /^vendor[\s_]?name$/i, /^vendor$/i, /^name$/i,
        /^exhibitor[\s_]?name$/i, /^exhibitor$/i, /^company$/i, /^business[\s_]?name$/i,
      ],
      vendorCategory: [
        /^vendor[\s_]?cat(egory)?$/i, /^category$/i, /^cat$/i, /^type$/i,
      ],
      color: [/^color$/i, /^colour$/i, /^table[\s_]?color$/i],
      notes: [/^notes?$/i, /^comments?$/i, /^remarks?$/i, /^memo$/i],
      paymentStatus: [
        /^payment[\s_]?status$/i, /^pay[\s_]?status$/i, /^payment$/i, /^paid[\s_]?status$/i,
      ],
      section: [/^section$/i, /^zone$/i, /^area$/i, /^section[\s_]?name$/i],
    }

    const fieldMapping: FieldMapping = {
      tableNumber: null, vendorName: null, vendorCategory: null,
      color: null, notes: null, paymentStatus: null, section: null,
    }
    const confidence: Record<Field, number> = {
      tableNumber: 0, vendorName: 0, vendorCategory: 0,
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

    if (mapping.vendorName !== null) {
      const val = (row[mapping.vendorName] ?? '').trim()
      if (!val) errors.push({ field: 'vendorName', value: val, message: 'Vendor name is required' })
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

    const rows: ImportRow[] = parsed.rows.map((rawData, rowIndex) => {
      const tableNumber = (mapping.tableNumber ? rawData[mapping.tableNumber] ?? '' : '').trim()
      const vendorName  = (mapping.vendorName  ? rawData[mapping.vendorName]  ?? '' : '').trim()

      const rawPayStatus = mapping.paymentStatus ? rawData[mapping.paymentStatus] ?? '' : ''
      const normStatus   = normalizePaymentStatus(rawPayStatus)

      const mapped: MappedImportRow = {
        tableNumber,
        vendorName,
        vendorCategory: mapping.vendorCategory ? (rawData[mapping.vendorCategory] ?? '').trim() || null : null,
        color:          mapping.color          ? (rawData[mapping.color]          ?? '').trim() || null : null,
        notes:          mapping.notes          ? (rawData[mapping.notes]          ?? '').trim() || null : null,
        paymentStatus:  normStatus,
        section:        mapping.section        ? (rawData[mapping.section]        ?? '').trim() || null : null,
      }

      // invalid-field
      const valErrors = csvImportModule.validateRow(rawData, mapping)
      if (valErrors.length > 0) {
        return {
          rowIndex, rawData, mapped,
          status: 'conflict' as ImportRowStatus,
          conflict: {
            type: 'invalid-field',
            message: valErrors.map(e => e.message).join('; '),
            affectedTableId: null,
            resolution: null,
          },
        }
      }

      // duplicate-in-import
      const labelKey = tableNumber.toLowerCase()
      if (seenLabels.has(labelKey)) {
        const firstRow = seenLabels.get(labelKey)!
        return {
          rowIndex, rawData, mapped,
          status: 'conflict' as ImportRowStatus,
          conflict: {
            type: 'duplicate-in-import',
            message: `Table "${tableNumber}" appears more than once in this CSV (first at row ${firstRow + 1})`,
            affectedTableId: null,
            resolution: null,
          },
        }
      }
      seenLabels.set(labelKey, rowIndex)

      // table-not-found
      const table = tablesByLabel.get(labelKey)
      if (!table) {
        return {
          rowIndex, rawData, mapped,
          status: 'conflict' as ImportRowStatus,
          conflict: {
            type: 'table-not-found',
            message: `No table labeled "${tableNumber}" found on the floor plan`,
            affectedTableId: null,
            resolution: null,
          },
        }
      }

      // already-assigned
      if (assignedTableIds.has(table.id)) {
        return {
          rowIndex, rawData, mapped,
          status: 'conflict' as ImportRowStatus,
          conflict: {
            type: 'already-assigned',
            message: `Table "${tableNumber}" already has a vendor assigned`,
            affectedTableId: table.id,
            resolution: null,
          },
        }
      }

      return { rowIndex, rawData, mapped, status: 'valid' as ImportRowStatus, conflict: null }
    })

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
