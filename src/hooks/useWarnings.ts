'use client'

import { useMemo } from 'react'
import {
  useEditorStore,
  selectTables,
  selectVendorAssignments,
  selectSettings,
} from '@/store/index'
import { warningsModule } from '@/domain/warnings.impl'
import { EMPTY_WARNING_RESULT } from '@/domain/warnings'
import type { WarningResult } from '@/domain/warnings'

/**
 * Computes layout warnings derived from current document state.
 * Recomputes when tables, assignments, or settings change.
 *
 * checkUnassigned: pass true only when in "finalized" mode.
 */
export function useWarnings(checkUnassigned = false): WarningResult {
  const tables = useEditorStore(selectTables)
  const vendorAssignments = useEditorStore(selectVendorAssignments)
  const settings = useEditorStore(selectSettings)

  return useMemo(() => {
    const tableList = Object.values(tables)
    if (tableList.length === 0) return EMPTY_WARNING_RESULT

    const assignmentList = Object.values(vendorAssignments)

    // No doors yet — pass empty array. Doors will be added in a later phase.
    return warningsModule.computeWarnings(
      tableList,
      [],
      assignmentList,
      settings,
      checkUnassigned,
    )
  }, [tables, vendorAssignments, settings, checkUnassigned])
}
