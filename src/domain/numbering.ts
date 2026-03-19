// ─────────────────────────────────────────────────────────────────────────────
// NUMBERING MODULE INTERFACE
//
// Handles label generation, bulk renumbering, duplicate detection, and
// label conflict checks.
//
// Labels are stored strings (e.g., "A-1", "42"). This module does not
// interpret them as numbers — it generates and compares them as strings.
//
// IMPORTANT: tables with labelOverridden = true are included in renumber
// operations by default. The caller must decide whether to exclude them
// (the RenumberCommand stores prev state so the override is always recoverable
// via undo regardless of which path the caller takes).
// ─────────────────────────────────────────────────────────────────────────────

import type { TableObject } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// NUMBERING SCHEME
//
// Used by both this module and the row builder.
// ─────────────────────────────────────────────────────────────────────────────

export type NumberingStyle =
  | 'sequential'   // 1, 2, 3, 4
  | 'prefixed'     // A-1, A-2, B-1
  | 'custom'       // user provides a labelPattern

export interface NumberingScheme {
  style: NumberingStyle
  prefix: string           // e.g. "A" for prefixed, "" for sequential
  separator: string        // e.g. "-" → "A-1"; used only for prefixed style
  startNumber: number      // first numeric value (usually 1)
  padToDigits: number      // 0 = no padding; 2 = "01", "02"
  direction: 'ltr' | 'rtl' // left-to-right or right-to-left through the table list
}

export const DEFAULT_NUMBERING_SCHEME: NumberingScheme = {
  style: 'sequential',
  prefix: '',
  separator: '-',
  startNumber: 1,
  padToDigits: 0,
  direction: 'ltr',
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A set of tables sharing the same label — represents one duplicate conflict. */
export interface DuplicateLabelGroup {
  label: string
  tableIds: string[]
}

/**
 * The result of a numbering operation.
 * Returns only the label-related fields — caller applies these to TableObjects.
 * Does not mutate input.
 */
export type LabelChange = Pick<TableObject, 'id' | 'label' | 'labelOverridden'>

// ─────────────────────────────────────────────────────────────────────────────
// MODULE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface NumberingModule {
  /**
   * Generate a single label for a given position in a numbering sequence.
   * index is 0-based. Respects scheme.direction.
   * Examples:
   *   sequential, startNumber=1, index=0 → "1"
   *   prefixed, prefix="A", separator="-", startNumber=1, index=2 → "A-3"
   *   padToDigits=2, index=0 → "01"
   */
  generateLabel(scheme: NumberingScheme, index: number): string

  /**
   * Apply numbering to an ordered list of tables.
   * Tables are numbered in array order (after applying scheme.direction).
   * Tables with labelOverridden = true are renumbered unless skipOverrides is true.
   * Returns LabelChange records — does not mutate input.
   */
  numberTables(
    tables: ReadonlyArray<TableObject>,
    scheme: NumberingScheme,
    options?: { skipOverrides?: boolean },
  ): LabelChange[]

  /**
   * Find all groups of tables sharing the same label.
   * Returns only groups with 2+ members (actual duplicates).
   */
  findDuplicateLabels(tables: ReadonlyArray<TableObject>): DuplicateLabelGroup[]

  /**
   * Check if a proposed label would conflict with any existing table.
   * Pass excludeTableId to exclude the table being renamed from the check.
   */
  isLabelConflict(
    proposedLabel: string,
    existingTables: ReadonlyArray<TableObject>,
    excludeTableId?: string,
  ): boolean

  /**
   * Sort tables by their current label for display in lists and panels.
   * Sorts numerically where possible (so "10" sorts after "9", not after "1").
   * Returns a new sorted array — does not mutate input.
   */
  sortByLabel(tables: ReadonlyArray<TableObject>): TableObject[]
}
