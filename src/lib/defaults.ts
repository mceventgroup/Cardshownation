import type { LayoutSettings, LayoutId } from '@/domain/types'

// 1 canvas unit = 1 inch
export const DEFAULT_SETTINGS: LayoutSettings = {
  canvasWidth: 2400,    // 200 ft — auto-resized when room is set
  canvasHeight: 2400,   // 200 ft — auto-resized when room is set
  gridSize: 12,         // snap every 12 inches (1 foot)
  snapToGrid: true,
  snapToObjects: false,
  minAisleWidth: 36,    // 36 in = 3 ft minimum aisle
  doorClearance: 48,    // 48 in = 4 ft door clearance
  wallSetback: 36,      // 36 in = 3 ft from wall to nearest table
  showWallSetback: false,
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

// Section color palette — 8 distinct colors for visual grouping
export const SECTION_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
] as const

// Default table fill / stroke colors
export const DEFAULT_TABLE_FILL    = '#f8fafc'
export const DEFAULT_TABLE_STROKE  = '#94a3b8'
export const SELECTED_TABLE_STROKE = '#2563eb'
export const WARNING_TABLE_STROKE  = '#ef4444'   // error (red)
export const CAUTION_TABLE_STROKE = '#f59e0b'   // warning (amber)
export const SELECTED_STROKE_WIDTH = 2
export const DEFAULT_STROKE_WIDTH  = 1

// Placeholder layout ID until persistence (Phase 6)
export const DRAFT_LAYOUT_ID = 'draft' as LayoutId
