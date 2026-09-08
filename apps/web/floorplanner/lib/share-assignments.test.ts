import test from 'node:test'
import assert from 'node:assert/strict'
import type { DocumentSlice } from './persistence'
import { DEFAULT_SETTINGS } from './defaults'
import type { TableId, VendorId, VendorAssignmentId, LayoutId } from '../domain/types'
import { buildShareDocument, assignedVendors, assignmentText } from './share-assignments'
function makeProject(): DocumentSlice {
  const tableId = 'table-1' as TableId
  const vendorId = 'vendor-1' as VendorId
  return {
    tables: {
      [tableId]: {
        id: tableId,
        roomId: 'R1',
        tableNumber: 1,
        displayId: '1',
        x: 48,
        y: 48,
        width: 72,
        height: 30,
        rotation: 0,
        shape: 'rectangle',
        label: '1',
        labelOverridden: false,
        rowId: null,
        sectionId: null,
        order: 0,
        premium: false,
      },
    },
    rows: {},
    sections: {},
    vendors: {
      [vendorId]: {
        id: vendorId,
        name: 'Test Vendor',
        firstName: null,
        lastName: null,
        companyName: 'Test Vendor Co.',
        email: 'vendor@example.com',
        tablesNeeded: 1,
        tableSize: '6 ft',
        inventory: 'Sports cards',
        category: 'Standard',
        paymentStatus: 'paid',
        notes: null,
        premium: false,
        cases: 0,
      },
    },
    vendorAssignments: {},
    room: null,
    doors: {},
    settings: { ...DEFAULT_SETTINGS, eventName: 'Workflow Test Show' },
    backgroundImages: {},
  }
}


test('shared vendor pages escape display text and exclude private data', () => {
  const data = makeProject()
  const vendor = data.vendors['vendor-1']
  vendor.companyName = '<Alpha & Cards>'
  vendor.notes = 'private-note-never-share'
  data.vendorAssignments['table-1'] = {
    id: 'a1' as VendorAssignmentId, layoutId: 'layout' as LayoutId, tableId: 'table-1' as TableId,
    vendorId: vendor.id, vendorName: vendor.companyName, vendorCategory: null,
    importSessionId: null, paymentStatus: 'unpaid', notes: 'private-assignment-note', colorOverride: null,
  }
  data.vendorAssignments['table-1'].colorOverride = '#aabbcc'
  const full = buildShareDocument(data)
  assert.ok(full.svg.includes('Vendor directory'))
  assert.ok(full.svg.includes('&lt;Alpha &amp; Cards&gt;'))
  assert.ok(full.svg.includes('Tables: 1'))
  assert.equal(full.svg.match(/fill="#aabbcc"/g)?.length, 2)
  for (const privateValue of [vendor.email!, vendor.notes, 'private-assignment-note', 'unpaid']) assert.ok(!full.svg.includes(privateValue))
  const doc = buildShareDocument(data, vendor.id)
  assert.ok(doc.svg.includes('&lt;Alpha &amp; Cards&gt;'))
  for (const privateValue of [vendor.email!, vendor.notes, 'private-assignment-note', 'unpaid']) assert.ok(!doc.svg.includes(privateValue))
  assert.ok(assignmentText(data, vendor.id).includes('Tables: 1'))
  assert.equal(assignedVendors(data).length, 1)
  assert.throws(() => buildShareDocument(data, 'missing'), /no assigned tables/)
})
