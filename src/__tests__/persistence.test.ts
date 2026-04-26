import { saveToLocalStorage, loadFromLocalStorage, clearLocalStorage, extractDocumentSlice } from '@/lib/persistence'
import type { DocumentSlice } from '@/lib/persistence'
import type { TableId, RowId, SectionId } from '@/domain/types'
import { DEFAULT_SETTINGS } from '@/lib/defaults'

// ── Mock localStorage ───────────────────────────────────────────────────────

const store: Record<string, string> = {}

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]

  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    },
    writable: true,
    configurable: true,
  })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSlice(overrides: Partial<DocumentSlice> = {}): DocumentSlice {
  return {
    tables: {},
    rows: {},
    sections: {},
    vendors: {},
    vendorAssignments: {},
    room: null,
    doors: {},
    settings: { ...DEFAULT_SETTINGS },
    backgroundImages: {},
    ...overrides,
  }
}

// ── Round-trip ──────────────────────────────────────────────────────────────

describe('persistence round-trip', () => {
  it('saves and loads an empty layout', () => {
    const slice = makeSlice()
    const err = saveToLocalStorage(slice)
    expect(err).toBeNull()

    const loaded = loadFromLocalStorage()
    expect(loaded).not.toBeNull()
    expect(loaded!.tables).toEqual({})
    expect(loaded!.settings.gridSize).toBe(DEFAULT_SETTINGS.gridSize)
  })

  it('preserves tables through save/load', () => {
    const slice = makeSlice({
      tables: {
        't1': {
          id: 't1' as TableId, x: 100, y: 200, width: 72, height: 30,
          rotation: 0, shape: 'rectangle', label: '1', labelOverridden: false,
          rowId: null as RowId | null, sectionId: null as SectionId | null, order: 0, premium: false,
        },
      },
    })
    saveToLocalStorage(slice)
    const loaded = loadFromLocalStorage()!
    expect(loaded.tables['t1'].label).toBe('1')
    expect(loaded.tables['t1'].x).toBe(100)
  })

  it('preserves backgroundImages through save/load', () => {
    const slice = makeSlice({
      backgroundImages: {
        'bg1': {
          id: 'bg1' as any, name: 'plan.png', dataUrl: 'data:image/png;base64,abc',
          x: 0, y: 0, width: 800, height: 600, opacity: 0.5,
          locked: false, visible: true, order: 0,
        },
      },
    })
    saveToLocalStorage(slice)
    const loaded = loadFromLocalStorage()!
    expect(loaded.backgroundImages['bg1'].name).toBe('plan.png')
    expect(loaded.backgroundImages['bg1'].opacity).toBe(0.5)
  })
})

// ── clearLocalStorage ───────────────────────────────────────────────────────

describe('clearLocalStorage', () => {
  it('removes saved data', () => {
    saveToLocalStorage(makeSlice())
    expect(loadFromLocalStorage()).not.toBeNull()

    clearLocalStorage()
    expect(loadFromLocalStorage()).toBeNull()
  })
})

// ── Error handling ──────────────────────────────────────────────────────────

describe('error handling', () => {
  it('returns quota-exceeded on QuotaExceededError', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {
          const err = new DOMException('quota exceeded', 'QuotaExceededError')
          throw err
        },
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    })
    const err = saveToLocalStorage(makeSlice())
    expect(err).toBe('quota-exceeded')
  })

  it('returns null for corrupted data', () => {
    store['floorplanner:layout'] = 'not valid json'
    const loaded = loadFromLocalStorage()
    expect(loaded).toBeNull()
  })

  it('returns null for missing version', () => {
    store['floorplanner:layout'] = JSON.stringify({ data: {} })
    const loaded = loadFromLocalStorage()
    expect(loaded).toBeNull()
  })
})

// ── extractDocumentSlice ────────────────────────────────────────────────────

describe('extractDocumentSlice', () => {
  it('picks only document fields', () => {
    const fullState = {
      tables: { 't1': {} as any },
      rows: {},
      sections: {},
      vendors: {},
      vendorAssignments: {},
      room: null,
      doors: {},
      settings: { ...DEFAULT_SETTINGS },
      backgroundImages: {},
      // extra fields that should NOT appear in slice
      selectedIds: new Set(['t1']),
      activeTool: 'select',
    }
    const slice = extractDocumentSlice(fullState as any)
    expect(slice.tables).toBeDefined()
    expect((slice as any).selectedIds).toBeUndefined()
    expect((slice as any).activeTool).toBeUndefined()
  })
})
