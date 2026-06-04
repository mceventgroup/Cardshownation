import { csvImportModule } from '@/domain/csv-import.impl'
import type { TableObject, TableId, RowId, SectionId, LayoutId, UserId, ImportSessionId, VendorAssignment, VendorAssignmentId, VendorId } from '@/domain/types'
import type { FieldMapping } from '@/domain/document'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTable(label: string, id = `t-${label}` as TableId): TableObject {
  const tableNumber = Number(label.replace(/[^0-9]/g, '')) || 1
  return {
    id,
    roomId: 'R1',
    tableNumber,
    displayId: `R1-${tableNumber}`,
    x: 0, y: 0, width: 72, height: 30,
    rotation: 0, shape: 'rectangle',
    label, labelOverridden: false,
    rowId: null as RowId | null,
    sectionId: null as SectionId | null,
    order: 0, premium: false,
  }
}

function makeAssignment(tableId: TableId, name: string): VendorAssignment {
  return {
    id: `a-${tableId}` as VendorAssignmentId,
    tableId,
    layoutId: 'layout-1' as LayoutId,
    vendorId: `v-${name}` as VendorId,
    vendorName: name,
    vendorCategory: null,
    colorOverride: null,
    notes: null,
    paymentStatus: 'unknown',
    importSessionId: null,
  }
}

function makeMapping(overrides: Partial<FieldMapping>): FieldMapping {
  return {
    tableNumber: null,
    vendorName: null,
    vendorLastName: null,
    companyName: null,
    email: null,
    vendorCategory: null,
    quantity: null,
    tableSize: null,
    color: null,
    notes: null,
    paymentStatus: null,
    section: null,
    ...overrides,
  }
}

// ── parseCSV ────────────────────────────────────────────────────────────────

describe('csvImportModule.parseCSV', () => {
  it('parses simple CSV with headers and rows', () => {
    const result = csvImportModule.parseCSV('Table,Vendor\n1,Acme\n2,Beta')
    expect(result.headers).toEqual(['Table', 'Vendor'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ Table: '1', Vendor: 'Acme' })
    expect(result.rows[1]).toEqual({ Table: '2', Vendor: 'Beta' })
    expect(result.parseErrors).toHaveLength(0)
  })

  it('handles quoted fields with commas', () => {
    const result = csvImportModule.parseCSV('Name,Notes\n"Doe, Jane","Some ""quoted"" text"')
    expect(result.rows[0].Name).toBe('Doe, Jane')
    expect(result.rows[0].Notes).toBe('Some "quoted" text')
  })

  it('reports column count mismatches', () => {
    const result = csvImportModule.parseCSV('A,B\n1,2,3')
    expect(result.parseErrors).toHaveLength(1)
    expect(result.parseErrors[0]).toContain('expected 2 columns, got 3')
  })

  it('returns empty for blank input', () => {
    const result = csvImportModule.parseCSV('')
    expect(result.headers).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
  })

  it('enforces MAX_COLUMNS (50) and MAX_HEADER_LEN (100)', () => {
    const manyHeaders = Array.from({ length: 60 }, (_, i) => `Col${i}`).join(',')
    const result = csvImportModule.parseCSV(manyHeaders + '\n' + Array(60).fill('x').join(','))
    expect(result.headers).toHaveLength(50)

    const longHeader = 'X'.repeat(200)
    const result2 = csvImportModule.parseCSV(longHeader + '\nval')
    expect(result2.headers[0]).toHaveLength(100)
  })

  it('enforces MAX_ROWS (5000)', () => {
    const lines = ['H']
    for (let i = 0; i < 6000; i++) lines.push(`${i}`)
    const result = csvImportModule.parseCSV(lines.join('\n'))
    expect(result.rows).toHaveLength(5000)
  })

  it('handles CRLF line endings', () => {
    const result = csvImportModule.parseCSV('A,B\r\n1,2\r\n3,4')
    expect(result.rows).toHaveLength(2)
  })
})

// ── detectColumns ───────────────────────────────────────────────────────────

describe('csvImportModule.detectColumns', () => {
  it('detects standard header names', () => {
    const { fieldMapping } = csvImportModule.detectColumns(['Table #', 'Vendor Name', 'Payment Status'])
    expect(fieldMapping.tableNumber).toBe('Table #')
    expect(fieldMapping.vendorName).toBe('Vendor Name')
    expect(fieldMapping.paymentStatus).toBe('Payment Status')
  })

  it('treats an exact "Table" header as quantity, not a table label', () => {
    const { fieldMapping } = csvImportModule.detectColumns(['Table', 'Vendor'])
    expect(fieldMapping.quantity).toBe('Table')
    expect(fieldMapping.tableNumber).toBeNull()
  })

  it('reports unmapped headers', () => {
    const { unmappedHeaders } = csvImportModule.detectColumns(['Table', 'Vendor', 'FooBar'])
    expect(unmappedHeaders).toContain('FooBar')
  })
})

// ── validateRow ─────────────────────────────────────────────────────────────

describe('csvImportModule.validateRow', () => {
  it('passes valid rows', () => {
    const errors = csvImportModule.validateRow(
      { 'Table': '1', 'Vendor': 'Acme' },
      makeMapping({ tableNumber: 'Table', vendorName: 'Vendor' }),
    )
    expect(errors).toHaveLength(0)
  })

  it('rejects missing table number', () => {
    const errors = csvImportModule.validateRow(
      { 'Table': '', 'Vendor': 'Acme' },
      makeMapping({ tableNumber: 'Table', vendorName: 'Vendor' }),
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('tableNumber')
  })

  it('rejects invalid color', () => {
    const errors = csvImportModule.validateRow(
      { 'Vendor': 'Acme', 'Color': 'notacolor123' },
      makeMapping({ vendorName: 'Vendor', color: 'Color' }),
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('color')
  })

  it('accepts valid hex color', () => {
    const errors = csvImportModule.validateRow(
      { 'Vendor': 'Acme', 'Color': '#ff0000' },
      makeMapping({ vendorName: 'Vendor', color: 'Color' }),
    )
    expect(errors).toHaveLength(0)
  })

  it('rejects invalid payment status', () => {
    const errors = csvImportModule.validateRow(
      { 'Vendor': 'Acme', 'Pay': 'banana' },
      makeMapping({ vendorName: 'Vendor', paymentStatus: 'Pay' }),
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].field).toBe('paymentStatus')
  })
})

// ── buildSession ────────────────────────────────────────────────────────────

describe('csvImportModule.buildSession', () => {
  const tables = [makeTable('1'), makeTable('2'), makeTable('3')]
  const mapping = makeMapping({ tableNumber: 'Table', vendorName: 'Vendor' })

  it('marks valid rows as valid', () => {
    const parsed = csvImportModule.parseCSV('Table,Vendor\n1,Acme\n2,Beta')
    const session = csvImportModule.buildSession(
      parsed, mapping, tables, [],
      'layout-1' as LayoutId, 'user' as UserId, 'sess-1' as ImportSessionId,
    )
    expect(session.rows[0].status).toBe('valid')
    expect(session.rows[1].status).toBe('valid')
    expect(session.conflictSummary.validRows).toBe(2)
    expect(session.conflictSummary.conflictRows).toBe(0)
  })

  it('flags table-not-found conflicts', () => {
    const parsed = csvImportModule.parseCSV('Table,Vendor\n99,Ghost')
    const session = csvImportModule.buildSession(
      parsed, mapping, tables, [],
      'layout-1' as LayoutId, 'user' as UserId, 'sess-1' as ImportSessionId,
    )
    expect(session.rows[0].status).toBe('conflict')
    expect(session.rows[0].conflict?.type).toBe('table-not-found')
  })

  it('flags already-assigned conflicts', () => {
    const existing = [makeAssignment('t-1' as TableId, 'Old Vendor')]
    const parsed = csvImportModule.parseCSV('Table,Vendor\n1,New Vendor')
    const session = csvImportModule.buildSession(
      parsed, mapping, tables, existing,
      'layout-1' as LayoutId, 'user' as UserId, 'sess-1' as ImportSessionId,
    )
    expect(session.rows[0].status).toBe('conflict')
    expect(session.rows[0].conflict?.type).toBe('already-assigned')
  })

  it('flags duplicate-in-import conflicts', () => {
    const parsed = csvImportModule.parseCSV('Table,Vendor\n1,Acme\n1,Beta')
    const session = csvImportModule.buildSession(
      parsed, mapping, tables, [],
      'layout-1' as LayoutId, 'user' as UserId, 'sess-1' as ImportSessionId,
    )
    expect(session.rows[0].status).toBe('valid')
    expect(session.rows[1].status).toBe('conflict')
    expect(session.rows[1].conflict?.type).toBe('duplicate-in-import')
  })
})

// ── isReadyToApply ──────────────────────────────────────────────────────────

describe('csvImportModule.isReadyToApply', () => {
  const tables = [makeTable('1')]
  const mapping = makeMapping({ tableNumber: 'Table', vendorName: 'Vendor' })

  it('returns true when all rows are valid', () => {
    const parsed = csvImportModule.parseCSV('Table,Vendor\n1,Acme')
    const session = csvImportModule.buildSession(
      parsed, mapping, tables, [],
      'layout-1' as LayoutId, 'user' as UserId, 'sess-1' as ImportSessionId,
    )
    expect(csvImportModule.isReadyToApply(session)).toBe(true)
  })

  it('returns false when unresolved conflicts exist', () => {
    const parsed = csvImportModule.parseCSV('Table,Vendor\n99,Ghost')
    const session = csvImportModule.buildSession(
      parsed, mapping, tables, [],
      'layout-1' as LayoutId, 'user' as UserId, 'sess-1' as ImportSessionId,
    )
    expect(csvImportModule.isReadyToApply(session)).toBe(false)
  })
})
