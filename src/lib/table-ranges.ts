export function compressTableLabels(labels: string[]): string {
  const normalized = [...new Set(labels.map(label => label.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  const groups = new Map<string, number[]>()
  const passthrough: string[] = []

  for (const label of normalized) {
    const match = label.match(/^(.*?)(\d+)$/)
    if (!match) {
      passthrough.push(label)
      continue
    }

    const prefix = match[1]
    const value = Number(match[2])
    if (!Number.isFinite(value)) {
      passthrough.push(label)
      continue
    }

    const existing = groups.get(prefix)
    if (existing) existing.push(value)
    else groups.set(prefix, [value])
  }

  const ranged: string[] = []
  for (const [prefix, values] of groups) {
    values.sort((a, b) => a - b)
    let start = values[0]
    let end = values[0]

    for (let index = 1; index <= values.length; index++) {
      const current = values[index]
      if (current === end + 1) {
        end = current
        continue
      }

      ranged.push(start === end ? `${prefix}${start}` : `${prefix}${start}-${end}`)
      start = current
      end = current
    }
  }

  return [...ranged, ...passthrough]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .join(', ')
}
