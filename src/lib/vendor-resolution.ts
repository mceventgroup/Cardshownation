import type { Vendor, VendorAssignment } from '@/domain/types'

export interface ResolvedVendorBucket {
  key: string
  vendor: Vendor | null
  displayName: string
  assignments: VendorAssignment[]
  isSynthetic: boolean
}

export function vendorDisplayName(vendor: Vendor): string {
  return vendor.companyName?.trim() || [vendor.firstName, vendor.lastName].filter(Boolean).join(' ') || vendor.name
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveVendorBuckets(
  vendors: Record<string, Vendor>,
  assignments: Record<string, VendorAssignment>,
): ResolvedVendorBucket[] {
  const buckets = new Map<string, ResolvedVendorBucket>()
  const vendorNameToId = new Map<string, string | null>()

  for (const vendor of Object.values(vendors)) {
    buckets.set(vendor.id, {
      key: vendor.id,
      vendor,
      displayName: vendorDisplayName(vendor),
      assignments: [],
      isSynthetic: false,
    })

    const normalized = normalizeName(vendorDisplayName(vendor))
    if (!normalized) continue
    const existing = vendorNameToId.get(normalized)
    if (existing === undefined) vendorNameToId.set(normalized, vendor.id)
    else if (existing !== vendor.id) vendorNameToId.set(normalized, null)
  }

  for (const assignment of Object.values(assignments)) {
    let bucket = buckets.get(assignment.vendorId)

    if (!bucket) {
      const normalizedAssignmentName = normalizeName(assignment.vendorName)
      const matchedVendorId = normalizedAssignmentName ? vendorNameToId.get(normalizedAssignmentName) : null
      if (matchedVendorId) {
        bucket = buckets.get(matchedVendorId)
      }
    }

    if (!bucket) {
      const syntheticKey = `synthetic:${assignment.vendorId}`
      bucket = buckets.get(syntheticKey)
      if (!bucket) {
        bucket = {
          key: syntheticKey,
          vendor: null,
          displayName: assignment.vendorName.trim() || 'Assigned Vendor',
          assignments: [],
          isSynthetic: true,
        }
        buckets.set(syntheticKey, bucket)
      }
    }

    bucket.assignments.push(assignment)
  }

  return [...buckets.values()]
}
