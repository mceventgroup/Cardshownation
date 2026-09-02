import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearAllLayouts,
  deleteLayout,
  duplicateLayout,
  listLayouts,
  loadLayout,
  renameLayout,
  saveLayoutAs,
  type DocumentSlice,
} from './persistence'
import { DEFAULT_SETTINGS } from './defaults'
import type { TableId, VendorId } from '../domain/types'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

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

test('device project workflow saves, duplicates, renames, opens, and deletes safely', () => {
  const previousStorage = globalThis.localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  })

  try {
    const originalId = saveLayoutAs('Main Hall', makeProject())
    const copyId = duplicateLayout(originalId)
    assert.ok(copyId)

    renameLayout(copyId, 'Main Hall - Saturday')
    const layouts = listLayouts()
    assert.deepEqual(layouts.map(layout => layout.name), ['Main Hall', 'Main Hall - Saturday'])

    const reopened = loadLayout(copyId)
    assert.equal(reopened?.settings.eventName, 'Workflow Test Show')
    assert.equal(Object.keys(reopened?.tables ?? {}).length, 1)

    deleteLayout(originalId)
    assert.deepEqual(listLayouts().map(layout => layout.name), ['Main Hall - Saturday'])
    assert.ok(loadLayout(copyId))
  } finally {
    clearAllLayouts()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previousStorage,
    })
  }
})
