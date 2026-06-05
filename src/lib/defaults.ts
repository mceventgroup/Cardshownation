import type { LayoutSettings, LayoutId } from '@/domain/types'

// 1 canvas unit = 1 inch
export const DEFAULT_SETTINGS: LayoutSettings = {
  canvasWidth: 2400,    // 200 ft — auto-resized when room is set
  canvasHeight: 2400,   // 200 ft — auto-resized when room is set
  gridSize: 12,         // snap every 12 inches (1 foot)
  snapToGrid: true,
  snapToObjects: false,
  minAisleWidth: 84,    // 84 in = 7 ft default aisle
  doorClearance: 48,    // 48 in = 4 ft door clearance
  wallThickness: 6,     // 6 in exterior/interior wall thickness is a sensible default
  wallSetback: 36,      // 36 in = 3 ft from wall to nearest table
  showWallSetback: false,
  vendorColorCoding: true,
  roomLocked: false,
  defaultTableWidth: 72,  // 6 ft table length
  defaultTableHeight: 30, // 30 in table width
  defaultTableShape: 'rectangle',
  unitLabel: 'in',      // base unit is inches
}

// Default stage zoom levels
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4.0
export const ZOOM_STEP = 1.1

// Pixel threshold to differentiate a click from a drag
export const DRAG_THRESHOLD = 4

// Row builder defaults
export const DEFAULT_ROW_SPACING = 0        // no gap between tables by default
export const DEFAULT_ROW_TABLE_COUNT = 10

// Section color palette — broader spread for large events and show-mode clarity
export const SECTION_COLORS = [
  '#2563EB', // royal blue
  '#0EA5E9', // sky
  '#06B6D4', // cyan
  '#14B8A6', // teal
  '#10B981', // emerald
  '#84CC16', // lime
  '#EAB308', // yellow
  '#F59E0B', // amber
  '#F97316', // orange
  '#EF4444', // red
  '#F43F5E', // rose
  '#EC4899', // pink
  '#D946EF', // fuchsia
  '#A855F7', // purple
  '#8B5CF6', // violet
  '#6366F1', // indigo
] as const

// Vendor color palette — soft pastel fills so table labels remain readable
export const VENDOR_COLORS = [
  '#fed7aa', // orange-200
  '#d1fae5', // emerald-100
  '#fef3c7', // amber-100
  '#fce7f3', // pink-100
  '#ede9fe', // violet-100
  '#ccfbf1', // teal-100
  '#fee2e2', // red-100
  '#ffedd5', // orange-100
  '#e0e7ff', // indigo-100
  '#fae8ff', // fuchsia-100
  '#cffafe', // cyan-100
  '#fef9c3', // yellow-100
  '#dcfce7', // green-100
  '#fde68a', // amber-200
  '#fecdd3', // rose-200
] as const

/** Deterministic color for a vendor based on vendorId hash. */
export function vendorColor(vendorId: string): string {
  let hash = 0
  for (let i = 0; i < vendorId.length; i++) {
    hash = ((hash << 5) - hash + vendorId.charCodeAt(i)) | 0
  }
  return VENDOR_COLORS[Math.abs(hash) % VENDOR_COLORS.length]
}

// Default table fill / stroke colors
export const DEFAULT_TABLE_FILL = '#f8fafc'
export const DEFAULT_TABLE_STROKE = '#94a3b8'
export const SELECTED_TABLE_STROKE = '#2563eb'
export const WARNING_TABLE_STROKE = '#ef4444'
export const CAUTION_TABLE_STROKE = '#f59e0b'
export const SELECTED_STROKE_WIDTH = 2
export const DEFAULT_STROKE_WIDTH = 1
export const OPEN_TABLE_FILL = '#e5e7eb'
export const ASSIGNED_TABLE_FILL = '#86efac'
export const PREMIUM_TABLE_FILL = '#fcd34d'

// Placeholder layout ID until persistence (Phase 6)
export const DRAFT_LAYOUT_ID = 'draft' as LayoutId
