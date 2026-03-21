import type { TableObject } from '@/domain/types'

/** Find the highest numeric label among all tables and return next number. */
export function getNextLabelNumber(tables: Record<string, TableObject>): number {
  let max = 0
  for (const t of Object.values(tables)) {
    const n = parseInt(t.label.replace(/[^0-9]/g, ''))
    if (!isNaN(n) && n > max) max = n
  }
  return max + 1
}
