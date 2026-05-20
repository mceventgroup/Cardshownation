import type { Vendor, VendorAssignment } from '@/domain/types'
import { resolveVendorBuckets } from '@/lib/vendor-resolution'

function makeVendor(id: string, overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: id as any,
    name: id,
    firstName: null,
    lastName: null,
    companyName: null,
    email: null,
    tablesNeeded: 1,
    category: null,
    paymentStatus: 'unknown',
    notes: null,
    premium: false,
    ...overrides,
  }
}

function makeAssignment(id: string, vendorId: string, vendorName: string): VendorAssignment {
  return {
    id: id as any,
    tableId: `${id}-table` as any,
    layoutId: 'draft' as any,
    vendorId: vendorId as any,
    vendorName,
    vendorCategory: null,
    colorOverride: null,
    notes: null,
    paymentStatus: 'unknown',
    importSessionId: null,
  }
}

describe('resolveVendorBuckets', () => {
  it('groups assignments by vendor id when the roster entry exists', () => {
    const buckets = resolveVendorBuckets(
      { v1: makeVendor('v1', { companyName: 'Acme Cards' }) },
      { a1: makeAssignment('a1', 'v1', 'Wrong Name') },
    )

    expect(buckets).toHaveLength(1)
    expect(buckets[0].vendor?.id).toBe('v1')
    expect(buckets[0].assignments).toHaveLength(1)
  })

  it('falls back to a unique vendor name match when the assignment vendor id is stale', () => {
    const buckets = resolveVendorBuckets(
      { v1: makeVendor('v1', { companyName: 'Acme Cards' }) },
      { a1: makeAssignment('a1', 'missing-id', 'Acme Cards') },
    )

    expect(buckets).toHaveLength(1)
    expect(buckets[0].vendor?.id).toBe('v1')
    expect(buckets[0].assignments).toHaveLength(1)
  })

  it('keeps orphaned assigned vendors visible as synthetic buckets', () => {
    const buckets = resolveVendorBuckets(
      {},
      { a1: makeAssignment('a1', 'missing-id', 'Ghost Vendor') },
    )

    expect(buckets).toHaveLength(1)
    expect(buckets[0].vendor).toBeNull()
    expect(buckets[0].isSynthetic).toBe(true)
    expect(buckets[0].displayName).toBe('Ghost Vendor')
  })
})
