// ─────────────────────────────────────────────────────────────────────────────
// NUMBERING MODULE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject } from './types'
import type {
  NumberingModule,
  NumberingScheme,
  DuplicateLabelGroup,
  LabelChange,
} from './numbering'

function padNumber(n: number, digits: number): string {
  if (digits <= 0) return String(n)
  return String(n).padStart(digits, '0')
}

function generateLabel(scheme: NumberingScheme, index: number): string {
  const num = scheme.startNumber + index
  const formatted = padNumber(num, scheme.padToDigits)

  switch (scheme.style) {
    case 'sequential':
      return formatted
    case 'prefixed':
      return `${scheme.prefix}${scheme.separator}${formatted}`
    case 'custom':
      return formatted
    default:
      return formatted
  }
}

function numberTables(
  tables: ReadonlyArray<TableObject>,
  scheme: NumberingScheme,
  options?: { skipOverrides?: boolean },
): LabelChange[] {
  const ordered = scheme.direction === 'rtl' ? [...tables].reverse() : [...tables]

  let labelIndex = 0
  return ordered.map(table => {
    if (options?.skipOverrides && table.labelOverridden) {
      return { id: table.id, label: table.label, labelOverridden: table.labelOverridden }
    }
    const label = generateLabel(scheme, labelIndex)
    labelIndex++
    return { id: table.id, label, labelOverridden: false }
  })
}

function findDuplicateLabels(tables: ReadonlyArray<TableObject>): DuplicateLabelGroup[] {
  const groups = new Map<string, string[]>()
  for (const t of tables) {
    const existing = groups.get(t.label)
    if (existing) {
      existing.push(t.id)
    } else {
      groups.set(t.label, [t.id])
    }
  }

  const result: DuplicateLabelGroup[] = []
  for (const [label, tableIds] of groups) {
    if (tableIds.length >= 2) {
      result.push({ label, tableIds })
    }
  }
  return result
}

function isLabelConflict(
  proposedLabel: string,
  existingTables: ReadonlyArray<TableObject>,
  excludeTableId?: string,
): boolean {
  return existingTables.some(
    t => t.label === proposedLabel && t.id !== excludeTableId,
  )
}

function sortByLabel(tables: ReadonlyArray<TableObject>): TableObject[] {
  return [...tables].sort((a, b) => {
    // Extract numeric portions for natural sort
    const aNum = parseFloat(a.label.replace(/[^0-9.]/g, ''))
    const bNum = parseFloat(b.label.replace(/[^0-9.]/g, ''))

    // If both have numeric parts, compare numerically
    if (!isNaN(aNum) && !isNaN(bNum)) {
      // First compare prefix (non-numeric part)
      const aPrefix = a.label.replace(/[0-9.]/g, '')
      const bPrefix = b.label.replace(/[0-9.]/g, '')
      if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix)
      return aNum - bNum
    }

    // Fall back to string comparison
    return a.label.localeCompare(b.label)
  })
}

export const numberingModule: NumberingModule = {
  generateLabel,
  numberTables,
  findDuplicateLabels,
  isLabelConflict,
  sortByLabel,
}
