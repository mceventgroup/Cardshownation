import test from 'node:test'
import assert from 'node:assert/strict'
import type { DocumentSlice } from './persistence'
import { DEFAULT_SETTINGS } from './defaults'
import type { TableId, VendorId, VendorAssignmentId, LayoutId } from '../domain/types'
import { buildShareDocument, assignedVendors, assignmentText } from './share-assignments'
import { buildDirectoryPages, buildFloorImage, buildSocialImage, buildTableFlyers } from './show-kit'

test('show kit separates public floor and vendor images and creates one sign per table', () => {
  const data = makeProject()
  const original = Object.values(data.tables)[0]
  const assignment = Object.values(data.vendorAssignments)[0]
  const secondId = 'table-2' as TableId
  data.tables[secondId] = { ...original, id: secondId, tableNumber: 2, displayId: '2' }
  data.vendorAssignments['assignment-2'] = { ...assignment, id: 'assignment-2' as VendorAssignmentId, tableId: secondId }
  const floor = buildFloorImage(data)
  assert.ok(!floor.svg.includes('Vendor directory'))
  const directory = buildDirectoryPages(data)
  assert.equal(directory.length, 1)
  assert.ok(directory[0].svg.includes('Test Vendor'))
  const flyers = buildTableFlyers(data)
  assert.equal(flyers.length, 2)
  assert.ok(flyers.every(f => f.svg.includes('THIS TABLE BELONGS TO')))
  const social = buildSocialImage(data, '<Show & shop>', 'Come visit')
  assert.equal(social.width / social.height, 4 / 5)
  assert.ok(social.svg.includes('&lt;Show &amp; shop&gt;'))
  for (const doc of [floor, ...directory, ...flyers, social]) {
    assert.ok(!doc.svg.includes('private-note'))
    assert.ok(!doc.svg.includes('private@example.com'))
  }
})

test('large vendor directories paginate instead of shrinking onto one page', () => {
  const data = makeProject()
  const vendor = Object.values(data.vendors)[0]
  const assignment = Object.values(data.vendorAssignments)[0]
  const table = Object.values(data.tables)[0]
  for (let i = 2; i <= 80; i++) {
    const id = `vendor-${i}` as VendorId, tid = `table-${i}` as TableId
    data.vendors[id] = { ...vendor, id, name: `Vendor ${i}`, companyName: null }
    data.tables[tid] = { ...table, id: tid, displayId: String(i) }
    data.vendorAssignments[`a-${i}`] = { ...assignment, id: `a-${i}` as VendorAssignmentId, vendorId: id, tableId: tid, vendorName: `Vendor ${i}` }
  }
  const pages = buildDirectoryPages(data)
  assert.ok(pages.length > 1)
  assert.ok(pages.every(p => p.height <= 1294))
  assert.ok(pages.some(p => p.svg.includes('Vendor 80')))
})
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
    vendorAssignments: { 'table-1': {
      id: 'a1' as VendorAssignmentId, layoutId: 'layout' as LayoutId, tableId,
      vendorId, vendorName: 'Test Vendor', vendorCategory: null,
      importSessionId: null, paymentStatus: 'paid', notes: 'private-note', colorOverride: null,
    } },
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
