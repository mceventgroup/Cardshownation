// ─────────────────────────────────────────────────────────────────────────────
// UNIT FORMATTING
//
// Canvas units are inches. Display helpers convert to human-readable formats.
// ─────────────────────────────────────────────────────────────────────────────

/** Format inches as feet + inches. Examples: 72 → "6ft", 30 → "2ft 6in", 18 → "18in" */
export function formatDimension(inches: number): string {
  const ft = Math.floor(inches / 12)
  const rem = Math.round(inches % 12)
  if (ft === 0) return `${rem}in`
  if (rem === 0) return `${ft}ft`
  return `${ft}ft ${rem}in`
}

/** Format a length × width pair. Example: "6ft × 30in" */
export function formatTableSize(length: number, width: number): string {
  return `${formatDimension(length)} × ${formatDimension(width)}`
}
