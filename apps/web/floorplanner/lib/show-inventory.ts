import type { Vendor } from '@floorplanner/domain/types'

export type ShowInventoryOption = {
  key: string
  label: string
  count: number
  color: string
}

const INVENTORY_COLORS = [
  '#dc2626',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#4f46e5',
]

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function parseInventoryTags(inventory: string | null | undefined): string[] {
  if (!inventory) return []

  return inventory
    .split(/[,\n/|;&+]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.replace(/\s+/g, ' '))
    .map(part => ({
      key: part.toLowerCase(),
      label: toTitleCase(part),
    }))
    .filter((part, index, parts) => parts.findIndex(entry => entry.key === part.key) === index)
    .map(part => part.label)
}

export function buildShowInventoryOptions(vendors: Record<string, Vendor>): ShowInventoryOption[] {
  const counts = new Map<string, { label: string; count: number }>()

  for (const vendor of Object.values(vendors)) {
    for (const label of parseInventoryTags(vendor.inventory)) {
      const key = label.toLowerCase()
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { label, count: 1 })
    }
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count
      return a[1].label.localeCompare(b[1].label, undefined, { sensitivity: 'base' })
    })
    .map(([key, value], index) => ({
      key,
      label: value.label,
      count: value.count,
      color: INVENTORY_COLORS[index % INVENTORY_COLORS.length],
    }))
}

export function vendorHasInventory(vendor: Vendor | null | undefined, inventoryKey: string | null): boolean {
  if (!vendor || !inventoryKey) return false
  return parseInventoryTags(vendor.inventory).some(label => label.toLowerCase() === inventoryKey)
}
