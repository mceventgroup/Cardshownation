import type { TableObject } from '@/domain/types'
import { getNextRoomTableNumber } from '@/domain/room-numbering'

/** Find the highest numeric label among all tables and return next number. */
export function getNextLabelNumber(tables: Record<string, TableObject>): number {
  let max = 0
  for (const t of Object.values(tables)) {
    const n = parseInt(t.label.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return max + 1
}

export function getNextLabelNumberForRoom(
  tables: Record<string, TableObject>,
  roomId: string,
): number {
  return getNextRoomTableNumber(tables, roomId)
}
