'use client'

import { useMemo } from 'react'
import {
  useEditorStore,
  selectTables,
  selectVendorAssignments,
  selectSettings,
  selectDoors,
  selectRoom,
} from '@/store/index'
import { warningsModule } from '@/domain/warnings.impl'
import { EMPTY_WARNING_RESULT } from '@/domain/warnings'
import type { WarningResult } from '@/domain/warnings'

/**
 * Computes layout warnings derived from current document state.
 * Recomputes when tables, assignments, doors, room, or settings change.
 *
 * checkUnassigned: pass true only when in "finalized" mode.
 */
export function useWarnings(checkUnassigned = false): WarningResult {
  const tables = useEditorStore(selectTables)
  const vendorAssignments = useEditorStore(selectVendorAssignments)
  const settings = useEditorStore(selectSettings)
  const doors = useEditorStore(selectDoors)
  const room = useEditorStore(selectRoom)

  return useMemo(() => {
    const tableList = Object.values(tables)
    if (tableList.length === 0) return EMPTY_WARNING_RESULT

    const assignmentList = Object.values(vendorAssignments)
    const doorList = Object.values(doors)

    return warningsModule.computeWarnings(
      tableList,
      doorList,
      assignmentList,
      settings,
      checkUnassigned,
      room,
    )
  }, [tables, vendorAssignments, settings, doors, room, checkUnassigned])
}
