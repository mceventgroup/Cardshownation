import { warningsModule } from '@/domain/warnings.impl'
import type { LayoutSettings, TableId, TableObject, VendorAssignment } from '@/domain/types'
import { DEFAULT_SETTINGS } from '@/lib/defaults'

function makeTable(id: string, overrides: Partial<TableObject> = {}): TableObject {
  return {
    id: id as TableId,
    roomId: 'R1',
    tableNumber: 1,
    displayId: `R1-${id}`,
    x: 0,
    y: 0,
    width: 72,
    height: 30,
    rotation: 0,
    shape: 'rectangle',
    label: id,
    labelOverridden: false,
    rowId: null,
    sectionId: null,
    order: 0,
    premium: false,
    ...overrides,
  }
}

describe('warningsModule.computeWarnings', () => {
  const settings: LayoutSettings = {
    ...DEFAULT_SETTINGS,
    minAisleWidth: 36,
    doorClearance: 48,
  }

  it('includes narrow-aisle warnings when tables are too close', () => {
    const top = makeTable('A', { x: 0, y: 0, width: 72, height: 30, label: 'A' })
    const bottom = makeTable('B', { x: 0, y: 50, width: 72, height: 30, label: 'B' })

    const result = warningsModule.computeWarnings([top, bottom], [], [], settings, false, null)
    const aisleWarning = result.warnings.find(w => w.type === 'narrow-aisle')

    expect(aisleWarning).toBeDefined()
    expect(aisleWarning?.severity).toBe('warning')
    expect(result.affectedTableIds.has(top.id)).toBe(true)
    expect(result.affectedTableIds.has(bottom.id)).toBe(true)
  })

  it('includes unassigned-table warnings only when review mode is enabled', () => {
    const table = makeTable('A', { label: 'A' })

    const withoutReview = warningsModule.computeWarnings([table], [], [], settings, false, null)
    const withReview = warningsModule.computeWarnings([table], [], [], settings, true, null)

    expect(withoutReview.warnings.some(w => w.type === 'unassigned-table')).toBe(false)
    expect(withReview.warnings.some(w => w.type === 'unassigned-table')).toBe(true)
  })

  it('does not flag assigned tables as unassigned during review mode', () => {
    const table = makeTable('A', { label: 'A' })
    const assignments: VendorAssignment[] = [{
      id: 'assign-1' as any,
      tableId: table.id,
      layoutId: 'layout-1' as any,
      vendorId: 'vendor-1' as any,
      vendorName: 'Acme',
      vendorCategory: null,
      colorOverride: null,
      notes: null,
      paymentStatus: 'unknown',
      importSessionId: null,
    }]

    const result = warningsModule.computeWarnings([table], [], assignments, settings, true, null)
    expect(result.warnings.some(w => w.type === 'unassigned-table')).toBe(false)
  })
})
