import test from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

import { autoAssignVendors } from './auto-assign'
import { geometry } from './geometry.impl'
import { warningsModule } from './warnings.impl'
import type { TableId, TableObject, Vendor, VendorId } from './types'
import { DEFAULT_SETTINGS } from '@floorplanner/lib/defaults'

function makeTable(index: number, columns = 20): TableObject {
  const row = Math.floor(index / columns)
  const column = index % columns
  const id = `table-${index + 1}` as TableId
  return {
    id,
    roomId: 'R1',
    tableNumber: index + 1,
    displayId: String(index + 1),
    x: column * 120,
    y: row * 96,
    width: 72,
    height: 30,
    rotation: 0,
    shape: 'rectangle',
    label: String(index + 1),
    labelOverridden: false,
    rowId: null,
    sectionId: null,
    order: index,
    premium: index % 20 === 0,
  }
}

function makeVendor(index: number): Vendor {
  const id = `vendor-${index + 1}` as VendorId
  return {
    id,
    name: `Vendor ${index + 1}`,
    firstName: null,
    lastName: null,
    companyName: `Booth Company ${index + 1}`,
    email: `vendor${index + 1}@example.com`,
    tablesNeeded: 2,
    tableSize: '6 ft',
    inventory: index % 2 === 0 ? 'Sports cards' : 'TCG',
    category: index % 10 === 0 ? 'Premium' : 'Standard',
    paymentStatus: 'paid',
    notes: null,
    premium: index % 10 === 0,
    cases: index % 3,
  }
}

test('overlap sweep keeps real collisions and ignores distant tables', () => {
  const tables = Array.from({ length: 300 }, (_, index) => makeTable(index))
  tables[1] = { ...tables[1], x: tables[0].x + 36, y: tables[0].y }
  tables[42] = { ...tables[42], x: tables[41].x + 30, y: tables[41].y }

  const overlaps = geometry.findAllOverlaps(tables)
  assert.deepEqual(
    overlaps.map(([a, b]) => [a.id, b.id]),
    [
      ['table-1', 'table-2'],
      ['table-42', 'table-43'],
    ],
  )
})

test('a realistic 400-table show can auto-assign every vendor need', () => {
  const tables = Object.fromEntries(
    Array.from({ length: 400 }, (_, index) => {
      const table = makeTable(index)
      return [table.id, table]
    }),
  )
  const vendors = Object.fromEntries(
    Array.from({ length: 200 }, (_, index) => {
      const vendor = makeVendor(index)
      return [vendor.id, vendor]
    }),
  )

  const result = autoAssignVendors(tables, vendors, {})
  assert.equal(result.assignments.length, 400)
  assert.equal(result.unassignedVendors.length, 0)
  assert.equal(result.unassignedTables.length, 0)
  assert.equal(new Set(result.assignments.map(assignment => assignment.tableId)).size, 400)
})

test('warning analysis remains responsive for a 500-table show', () => {
  const tables = Array.from({ length: 500 }, (_, index) => makeTable(index, 25))
  const startedAt = performance.now()
  const result = warningsModule.computeWarnings(
    tables,
    [],
    [],
    { ...DEFAULT_SETTINGS, minAisleWidth: 24 },
    false,
    null,
  )
  const durationMs = performance.now() - startedAt

  assert.equal(result.errorCount, 0)
  assert.equal(result.warningCount, 0)
  assert.ok(durationMs < 750, `Expected warning analysis under 750ms, received ${durationMs.toFixed(1)}ms`)
})
