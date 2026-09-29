function savedTime(value: string | null | undefined): number {
  return value ? Date.parse(value) : NaN
}

export function compareSavedLayouts(
  a: { savedAt?: string | null },
  b: { savedAt?: string | null },
): number {
  const aTime = savedTime(a.savedAt)
  const bTime = savedTime(b.savedAt)
  if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0
  if (!Number.isFinite(bTime)) return -1
  return bTime - aTime
}

export function formatSavedLayoutDate(value: string | null | undefined): string {
  const time = savedTime(value)
  return Number.isFinite(time) ? new Date(time).toLocaleDateString() : 'Unknown date'
}
