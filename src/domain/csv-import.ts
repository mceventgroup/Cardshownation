// ─────────────────────────────────────────────────────────────────────────────
// CSV IMPORT MODULE INTERFACE
//
// Handles the full import pipeline from raw CSV text to a staged ImportSession.
// No writes to the document happen here — the caller dispatches
// ApplyImportCommand when the user confirms.
//
// Pipeline:
//   parseCSV → detectColumns → buildSession → validateRows → (caller reviews)
//   → resolveConflicts → (caller confirms) → [ApplyImportCommand dispatched]
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject, LayoutId, UserId, ImportSessionId } from './types'
import type {
  ImportSession,
  ImportRow,
  FieldMapping,
  ConflictSummary,
} from './document'

// ─────────────────────────────────────────────────────────────────────────────
// PARSE RESULT
// ─────────────────────────────────────────────────────────────────────────────

/** Raw parsed CSV output — column headers and row data, no domain logic yet. */
export interface ParsedCSV {
  headers: string[]
  rows: Array<Record<string, string>>
  rowCount: number
  parseErrors: string[]   // non-fatal parse issues (e.g., inconsistent column count)
}

/**
 * Column detection result.
 * The module tries to auto-detect field mappings using common naming patterns.
 * confidence: 0–1; below 0.5 = no auto-map, show blank and let user pick.
 */
export interface DetectedMapping {
  fieldMapping: FieldMapping
  confidence: Record<keyof FieldMapping, number>
  unmappedHeaders: string[]   // CSV columns that couldn't be auto-mapped
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT (per-row, pre-conflict-check)
// ─────────────────────────────────────────────────────────────────────────────

export interface RowValidationError {
  field: keyof FieldMapping
  value: string
  message: string
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface CSVImportModule {
  /**
   * Parse raw CSV text into headers and rows.
   * Handles quoted fields, Windows/Unix line endings, and trailing commas.
   * Returns parse errors for display but does not throw — partial results
   * are returned so the user can see what was parsed.
   */
  parseCSV(csvText: string, options?: { noHeaders?: boolean }): ParsedCSV

  /**
   * Attempt to auto-detect field mappings from column headers.
   * Matches common variations:
   *   "Table #", "table_number", "Table No", "Tbl" → tableNumber
   *   "Vendor", "vendor_name", "Name", "Exhibitor" → vendorName
   *   etc.
   */
  detectColumns(headers: string[]): DetectedMapping

  /**
   * Validate a single mapped row's values.
   * Checks: required fields present, color is valid hex or named color,
   * paymentStatus is a known value.
   * Returns empty array if valid.
   */
  validateRow(row: Record<string, string>, mapping: FieldMapping): RowValidationError[]

  /**
   * Build an ImportSession from parsed CSV data and a confirmed field mapping.
   * Runs conflict detection against existing tables and vendor assignments.
   *
   * Conflict rules checked:
   *   - table-not-found: no table with this label exists
   *   - already-assigned: table already has a VendorAssignment
   *   - duplicate-in-import: same table number appears twice in this CSV
   *   - invalid-field: row fails validateRow
   *
   * Does NOT write anything to the document. Returns a staged ImportSession
   * in 'reviewing' status that the caller can present to the user.
   */
  buildSession(
    parsed: ParsedCSV,
    mapping: FieldMapping,
    existingTables: ReadonlyArray<TableObject>,
    existingAssignments: ReadonlyArray<{ tableId: string }>,
    layoutId: LayoutId,
    createdBy: UserId,
    sessionId: ImportSessionId,
  ): ImportSession

  /**
   * Recompute the ConflictSummary for a session after the user has
   * resolved or skipped conflicts. Called when the user changes a resolution.
   */
  recomputeSummary(rows: ReadonlyArray<ImportRow>): ConflictSummary

  /**
   * Check whether all conflicts are resolved (each has a resolution or is skipped).
   * Returns true when the session can safely transition to 'ready'.
   */
  isReadyToApply(session: ImportSession): boolean
}
