'use client'

// ─────────────────────────────────────────────────────────────────────────────
// KONVA CANVAS
//
// This file is the dynamic() boundary — it must be the first file in the tree
// that imports from 'react-konva'. Never re-export from a server-rendered file.
//
// Interaction model:
//   - All mouse events are handled at the Stage level (not on individual nodes).
//   - During drag, draftPositions (React local state) overrides store positions
//     for rendering. The store is only updated on drag commit (mouseup).
//   - Transformer (resize) is attached to the single selected node via a nodeRef
//     map that TableNode populates via a callback prop.
//   - Pan state (isPanning) is local to this component, never goes to the store.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Line, Ellipse } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Point, TableId, DoorId, DoorSide, DoorKind } from '@/domain/types'
import { useEditorStore, selectTables, selectSelectedIds, selectSettings, selectActiveTool, selectSections, selectDuplicateTableIds, selectAssignmentMap, selectActiveVendorId, selectHoveredVendorId, selectVendorAssignments, selectVendors, selectRoom, selectDoors, selectSelectedDoorId, selectSelectedSegmentId, selectBackgroundImages, selectGridVisible, selectShowMode, selectShowCaseHighlights, selectShowSectionColors, selectActiveRoomId } from '@/store/index'
import { snapping } from '@/domain/snapping.impl'
import { geometry } from '@/domain/geometry.impl'
import { rowModule } from '@/domain/rows.impl'
import { DEFAULT_NUMBERING_SCHEME } from '@/domain/numbering'
import { createTableId, createRowId, createAssignmentId, createRoomCircleId, createRoomSegmentId, createDoorId } from '@/lib/id'
import { DRAG_THRESHOLD, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, DRAFT_LAYOUT_ID, OPEN_TABLE_FILL, vendorColor } from '@/lib/defaults'
import { registerStage } from '@/lib/stage'
import GridLayer from './GridLayer'
import RoomLayer from './RoomLayer'
import DoorNode from './DoorNode'
import TableNode from './TableNode'
import SelectionRect from './SelectionRect'
import TransformerControl from './TransformerControl'
import InlineLabelEditor from './InlineLabelEditor'
import ShortcutsLegend from './ShortcutsLegend'
import BackgroundImageLayer from './BackgroundImageLayer'
import TableContextMenu, { type ContextMenuAction } from './TableContextMenu'
import { clampToWallSetback, pushOutOfDoorZones, computeRoomBounds, getRoomBoundaryEdges, findBoundaryEdgeForDoor, findNearestBoundarySample, isRectWithinWallSetback } from '@/domain/room-contour'
import { isPointInRoom } from '@/domain/room-contour'
import { useWarnings } from '@/hooks/useWarnings'
import { warningsModule } from '@/domain/warnings.impl'
import type { WarningSeverity } from '@/domain/warnings'
import { getDefaultRoomId, getRoomIdForPoint, getRoomZones } from '@/domain/room-numbering'
import { applyRoomSplit, buildRoomSplitPreview, findRoomSegmentAtPoint } from '@/domain/room-splitting'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DragState {
  /** ID of the table the user initially pressed on */
  primaryId: string
  /** Pointer position at drag start in canvas coordinates */
  startPointer: Point
  /** Committed positions of all dragged tables at drag start */
  startPositions: Record<string, Point>
  /** Whether we've moved past the drag threshold */
  isDragging: boolean
}

interface SelectionState {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

import { getNextLabelNumberForRoom } from '@/lib/labels'

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function KonvaCanvas() {
  const stageRef    = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Node ref map: populated by TableNode via registerNode callback
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map())

  // Store state
  const tables      = useEditorStore(selectTables)
  const selectedIds = useEditorStore(selectSelectedIds)
  const settings    = useEditorStore(selectSettings)
  const activeTool  = useEditorStore(selectActiveTool)
  const sections      = useEditorStore(selectSections)
  const duplicateIds    = useEditorStore(selectDuplicateTableIds)
  const assignmentMap   = useEditorStore(selectAssignmentMap)
  const activeVendorId  = useEditorStore(selectActiveVendorId)
  const hoveredVendorId = useEditorStore(selectHoveredVendorId)
  const setActiveVendor = useEditorStore(s => s.setActiveVendor)
  const setHoveredVendor = useEditorStore(s => s.setHoveredVendor)
  const vendorAssignments = useEditorStore(selectVendorAssignments)
  const vendorsRecord     = useEditorStore(selectVendors)
  const room              = useEditorStore(selectRoom)
  const activeRoomId      = useEditorStore(selectActiveRoomId)
  const doorsRecord       = useEditorStore(selectDoors)
  const selectedDoorId    = useEditorStore(selectSelectedDoorId)
  const setSelectedDoor   = useEditorStore(s => s.setSelectedDoor)
  const selectedSegmentId = useEditorStore(selectSelectedSegmentId)
  const setSelectedSegmentId = useEditorStore(s => s.setSelectedSegmentId)
  const bgImagesRecord    = useEditorStore(selectBackgroundImages)
  const updateBgImage     = useEditorStore(s => s.updateBackgroundImage)
  const gridVisible       = useEditorStore(selectGridVisible)
  const showMode          = useEditorStore(selectShowMode)
  const showCaseHighlights = useEditorStore(selectShowCaseHighlights)
  const showSectionColors = useEditorStore(selectShowSectionColors)

  // Store actions
  const dispatch      = useEditorStore(s => s.dispatch)
  const setSelected   = useEditorStore(s => s.setSelected)
  const toggleSelected = useEditorStore(s => s.toggleSelected)
  const clearSelected = useEditorStore(s => s.clearSelected)
  const setStageTransform = useEditorStore(s => s.setStageTransform)
  const setGridVisible    = useEditorStore(s => s.setGridVisible)
  const setActiveRoomId   = useEditorStore(s => s.setActiveRoomId)

  // Stage size — tracks container element dimensions
  const [stageSize, setStageSize] = useState({ width: 1200, height: 800 })

  // Zoom/pan state stored locally (not in Zustand) since it's pure view state
  const [stageScale, setStageScaleLocal] = useState(1)
  const [stagePos, setStagePosLocal]     = useState<Point>({ x: 0, y: 0 })

  // Inline label editing state
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingPos, setEditingPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Shortcuts legend visibility (stays as overlay)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tableId: string } | null>(null)
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null)
  const [controlsCollapsed, setControlsCollapsed] = useState(false)
  const [controlsPos, setControlsPos] = useState<Point>({ x: 16, y: 16 })
  const controlsDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [recentlyAssignedTableIds, setRecentlyAssignedTableIds] = useState<Set<string>>(new Set())
  const [assignmentHint, setAssignmentHint] = useState<string | null>(null)
  const placementClickHandledRef = useRef(false)

  // Computed warnings (derived, never stored)
  const warningResult = useWarnings()

  // Active vendor ref for mouse handler (avoids stale closure)
  const activeVendorRef = useRef(activeVendorId)
  activeVendorRef.current = activeVendorId

  // Zoom/shortcut keys that stay in canvas
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        activeVendorRef.current = null
        setActiveVendor(null)
        setHoveredVendor(null)
        return
      }
      if (e.key === '?') {
        setShowShortcuts(prev => !prev)
      }
      if (e.key === '+' || e.key === '=') {
        setStageScaleLocal(prev => Math.min(MAX_ZOOM, prev * ZOOM_STEP))
      }
      if (e.key === '-') {
        setStageScaleLocal(prev => Math.max(MIN_ZOOM, prev / ZOOM_STEP))
      }
      if (e.key === '0') {
        setStageScaleLocal(1)
        setStagePosLocal({ x: 0, y: 0 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveVendor, setHoveredVendor])

  useEffect(() => {
    setStageTransform(stageScale, stagePos)
  }, [stageScale, stagePos, setStageTransform])

  // Draft positions during drag (overrides store positions for rendering)
  const [draftPositions, setDraftPositions] = useState<Record<string, Point>>({})

  // Active drag state (ref so event handlers always have fresh data)
  const dragStateRef = useRef<DragState | null>(null)

  // Selection rect during drag-select.
  // The ref holds the authoritative value so event handlers never see a stale
  // closure — updating the ref is synchronous, while React state is batched.
  // The state copy exists only to trigger re-renders for visual feedback.
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null)
  const selectionStateRef = useRef<SelectionState | null>(null)

  function updateSelectionState(s: SelectionState | null) {
    selectionStateRef.current = s
    setSelectionState(s)
  }

  function updateRoomDrawPreview(r: { x: number; y: number; width: number; height: number; shape: 'rect' | 'circle' } | null) {
    roomDrawPreviewRef.current = r
    setRoomDrawPreview(r)
  }

  // Door placement preview (ghost door while in place-door mode)
  const [doorPlacementPreview, setDoorPlacementPreview] = useState<
    { side: DoorSide; x: number; y: number; width: number; kind: DoorKind } | null
  >(null)

  // Room drawing state (rectangle segments)
  const roomDrawRef = useRef<{ startX: number; startY: number; shape: 'rect' | 'circle' } | null>(null)
  const [roomDrawPreview, setRoomDrawPreview] = useState<{ x: number; y: number; width: number; height: number; shape: 'rect' | 'circle' } | null>(null)
  const roomDrawPreviewRef = useRef<{ x: number; y: number; width: number; height: number; shape: 'rect' | 'circle' } | null>(null)

  // Freehand room drawing state
  const freehandPointsRef = useRef<Point[] | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<Point[] | null>(null)
  const roomSplitRef = useRef<{ segmentId: string; startPoint: Point } | null>(null)
  const [roomSplitPreview, setRoomSplitPreview] = useState<{
    lineStart: Point
    lineEnd: Point
    segmentId: string
  } | null>(null)
  const roomSplitPreviewRef = useRef<{
    lineStart: Point
    lineEnd: Point
    segmentId: string
  } | null>(null)

  // Room segment drag state
  const segmentDragRef = useRef<{ segmentId: string; startPointer: Point; startPos: Point } | null>(null)
  const [segmentDraftPos, setSegmentDraftPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const segmentDraftPosRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const roomDragRef = useRef<{
    startPointer: Point
    startRoom: NonNullable<typeof room>
    zoneId: string
    segmentIds: Set<string>
    circleIds: Set<string>
    moveFreehand: boolean
    doorIds: Set<string>
  } | null>(null)
  const [roomDraftOffset, setRoomDraftOffset] = useState<Point | null>(null)
  const roomDraftOffsetRef = useRef<Point | null>(null)

  // Space-key pan tracking
  const isPanningRef  = useRef(false)
  const spaceHeldRef  = useRef(false)
  const panStartRef   = useRef<{ pointer: Point; stagePos: Point } | null>(null)


  // ── Clear door ghost when leaving place-door mode ────────────────────────

  useEffect(() => {
    if (activeTool !== 'place-door' && doorPlacementPreview !== null) {
      setDoorPlacementPreview(null)
    }
  }, [activeTool, doorPlacementPreview])

  useEffect(() => {
    if (activeTool === 'split-room') return
    roomSplitRef.current = null
    roomSplitPreviewRef.current = null
    setRoomSplitPreview(null)
  }, [activeTool])

  // ── Container resize observer ──────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({
        width:  entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // ── Stage registry (for PNG export) ───────────────────────────────────────

  useEffect(() => {
    registerStage(stageRef.current)
    return () => registerStage(null)
  }, [])

  // ── Space key pan tracking ─────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        spaceHeldRef.current = true
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        isPanningRef.current = false
        panStartRef.current  = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ── Display room — applies live segment drag offset for preview ───────────

  const displayRoom = useMemo(() => {
    if (!room) return room
    if (roomDraftOffset) {
      return {
        ...room,
        segments: room.segments.map(segment => ({
          ...segment,
          x: roomDragRef.current?.segmentIds.has(segment.id) ? segment.x + roomDraftOffset.x : segment.x,
          y: roomDragRef.current?.segmentIds.has(segment.id) ? segment.y + roomDraftOffset.y : segment.y,
        })),
        circles: (room.circles ?? []).map(circle => ({
          ...circle,
          x: roomDragRef.current?.circleIds.has(circle.id) ? circle.x + roomDraftOffset.x : circle.x,
          y: roomDragRef.current?.circleIds.has(circle.id) ? circle.y + roomDraftOffset.y : circle.y,
        })),
        freehandVertices: roomDragRef.current?.moveFreehand
          ? room.freehandVertices?.map(vertex => ({
              x: vertex.x + roomDraftOffset.x,
              y: vertex.y + roomDraftOffset.y,
            })) ?? null
          : room.freehandVertices,
      }
    }
    if (!segmentDraftPos) return room
    return {
      ...room,
      segments: room.segments.map(s =>
        s.id === segmentDraftPos.id ? { ...s, x: segmentDraftPos.x, y: segmentDraftPos.y } : s
      ),
    }
  }, [room, segmentDraftPos, roomDraftOffset])

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  /** Convert a screen-space pointer position to canvas coordinates. */
  const toCanvas = useCallback((screenPos: Point): Point => {
    return {
      x: (screenPos.x - stagePos.x) / stageScale,
      y: (screenPos.y - stagePos.y) / stageScale,
    }
  }, [stagePos, stageScale])

  const findContainingCircleId = useCallback((point: Point): string | null => {
    if (!room?.circles?.length) return null

    let match: { id: string; area: number } | null = null
    for (const circle of room.circles) {
      if (circle.radiusX <= 0 || circle.radiusY <= 0) continue
      const nx = (point.x - circle.x) / circle.radiusX
      const ny = (point.y - circle.y) / circle.radiusY
      if (nx * nx + ny * ny > 1) continue

      const area = circle.radiusX * circle.radiusY
      if (!match || area < match.area) {
        match = { id: circle.id, area }
      }
    }

    return match?.id ?? null
  }, [room])

  // ── Node ref registration (given to each TableNode) ────────────────────────

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) {
      nodeRefs.current.set(id, node)
    } else {
      nodeRefs.current.delete(id)
    }
  }, [])

  // ── Row config callback (given to RowBuilderPanel) ────────────────────────


  // ── Place row helper ──────────────────────────────────────────────────────

  const placeRowAt = useCallback((canvasPos: Point) => {
    const cfg = useEditorStore.getState().rowBuilderConfig
    if (!cfg) return
    placementClickHandledRef.current = true
    dragStateRef.current = null
    setDraftPositions({})
    updateSelectionState(null)
    const currentRoom = useEditorStore.getState().room
    const roomId = getRoomIdForPoint(currentRoom, canvasPos) ?? activeRoomId ?? getDefaultRoomId(currentRoom) ?? 'R1'
    if (roomId !== activeRoomId) setActiveRoomId(roomId)

    const snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
    const rowId = createRowId()

    const nextStart = getNextLabelNumberForRoom(tables, roomId)

    const effectiveWallSetback = settings.wallSetback + settings.wallThickness / 2
    let origin = snapped
    let curveCenter: Point | undefined
    let curveMidAngle: number | undefined
    let curveRadius = cfg.curveRadius
    let autoFitSpacing = false

    if (cfg.orientation === 'curved') {
      const boundary = currentRoom ? findNearestBoundarySample(currentRoom, snapped) : null
      if (boundary) {
        const midpoint = {
          x: boundary.point.x + boundary.inwardNormal.x * (effectiveWallSetback + cfg.tableHeight / 2),
          y: boundary.point.y + boundary.inwardNormal.y * (effectiveWallSetback + cfg.tableHeight / 2),
        }
        origin = snapping.snapToGrid(midpoint, settings.gridSize)
        if (boundary.kind === 'circle' && boundary.center && boundary.radius) {
          curveCenter = boundary.center
          autoFitSpacing = true
          const clearanceRadius = Math.max(0, boundary.radius - effectiveWallSetback)
          const halfWidth = cfg.tableWidth / 2
          const halfHeight = cfg.tableHeight / 2
          const maxCurveRadius = Math.sqrt(Math.max(0, clearanceRadius * clearanceRadius - halfWidth * halfWidth)) - halfHeight
          curveRadius = Math.max(24, maxCurveRadius - 1)
          origin = snapping.snapToGrid({
            x: curveCenter.x - boundary.inwardNormal.x * curveRadius,
            y: curveCenter.y - boundary.inwardNormal.y * curveRadius,
          }, settings.gridSize)
        } else {
          curveCenter = {
            x: origin.x + boundary.inwardNormal.x * cfg.curveRadius,
            y: origin.y + boundary.inwardNormal.y * cfg.curveRadius,
          }
        }
        curveMidAngle = Math.atan2(origin.y - curveCenter.y, origin.x - curveCenter.x)
      } else {
        curveCenter = { x: origin.x, y: origin.y + cfg.curveRadius }
        curveMidAngle = Math.atan2(origin.y - curveCenter.y, origin.x - curveCenter.x)
      }
    }

    const buildRowWithSpacing = (spacing: number) => rowModule.buildRow(
      {
        roomId,
        tableCount: cfg.tableCount,
        tableWidth: cfg.tableWidth,
        tableHeight: cfg.tableHeight,
        spacing,
        orientation: cfg.orientation,
        origin,
        curveRadius: cfg.orientation === 'curved' ? curveRadius : undefined,
        curveCenter,
        curveMidAngle,
        curveDirection: cfg.orientation === 'curved' ? cfg.curveDirection : undefined,
        sectionId: cfg.sectionId,
        numberingScheme: { ...DEFAULT_NUMBERING_SCHEME, startNumber: nextStart },
        startLabel: String(nextStart),
      },
      rowId,
    )

    const rowFitsSetback = (rowTables: ReturnType<typeof buildRowWithSpacing>['tables']) => (
      !currentRoom ||
      effectiveWallSetback <= 0 ||
      rowTables.every(table =>
        isRectWithinWallSetback(
          currentRoom,
          { x: table.x, y: table.y, width: table.width, height: table.height, rotation: table.rotation },
          effectiveWallSetback,
        ),
      )
    )

    let built = buildRowWithSpacing(cfg.spacing)
    if (!rowFitsSetback(built.tables) && autoFitSpacing && cfg.orientation === 'curved') {
      const spacingStep = Math.max(1, settings.gridSize)
      for (let spacing = cfg.spacing - spacingStep; spacing >= 0; spacing -= spacingStep) {
        built = buildRowWithSpacing(spacing)
        if (rowFitsSetback(built.tables)) break
      }
    }

    if (!rowFitsSetback(built.tables)) {
      return
    }

    dispatch({ type: 'PLACE_ROW', row: built.row, tables: built.tables, timestamp: Date.now() })
    setSelected(built.tables.map(t => t.id))
  }, [activeRoomId, settings, tables, dispatch, setSelected, setActiveRoomId])

  // ── Place table helper ─────────────────────────────────────────────────────
  // Defined before handleMouseDown so it can be listed in its dep array.

  const placeTableAt = useCallback((canvasPos: Point) => {
    const cfg = useEditorStore.getState().tableBuilderConfig
    placementClickHandledRef.current = true
    dragStateRef.current = null
    setDraftPositions({})
    updateSelectionState(null)
    const currentRoom = useEditorStore.getState().room
    const roomId = getRoomIdForPoint(currentRoom, canvasPos) ?? activeRoomId ?? getDefaultRoomId(currentRoom) ?? 'R1'
    if (roomId !== activeRoomId) setActiveRoomId(roomId)
    const w = cfg?.tableWidth ?? settings.defaultTableWidth
    const h = cfg?.tableHeight ?? settings.defaultTableHeight
    let snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
    // Enforce wall setback and door clearance
    if (currentRoom) {
      if (settings.wallSetback > 0 || settings.wallThickness > 0) {
          const clamped = clampToWallSetback(
            currentRoom,
            { ...snapped, width: w, height: h, rotation: 0 },
            settings.wallSetback + settings.wallThickness / 2,
          )
        snapped = snapping.snapToGrid(clamped, settings.gridSize)
      }
      const roomBoundsForDoors = computeRoomBounds(currentRoom)
      if (roomBoundsForDoors && settings.doorClearance > 0) {
        const currentDoors = Object.values(useEditorStore.getState().doors)
        if (currentDoors.length > 0) {
          const pushed = pushOutOfDoorZones({ ...snapped, width: w, height: h }, currentDoors, roomBoundsForDoors, settings.doorClearance)
          snapped = snapping.snapToGrid(pushed, settings.gridSize)
        }
      }
    }
    const nextTableNumber = getNextLabelNumberForRoom(tables, roomId)
    const nextLabel = `${roomId}-${nextTableNumber}`
    const id = createTableId()
    dispatch({
      type: 'PLACE_TABLE',
      table: {
        id,
        roomId,
        tableNumber: nextTableNumber,
        displayId: nextLabel,
        x:               snapped.x,
        y:               snapped.y,
        width:           w,
        height:          h,
        rotation:        0,
        shape:           settings.defaultTableShape,
        label:           nextLabel,
        labelOverridden: false,
        rowId:           null,
        sectionId:       null,
        order:           0,
        premium:         false,
      },
      timestamp: Date.now(),
    })
    setSelected([id])
  }, [activeRoomId, settings, tables, dispatch, setSelected, setActiveRoomId])

  // ── Door placement helpers ─────────────────────────────────────────────────

  /**
   * Given a pointer in canvas coords, pick the nearest actual room boundary
   * edge and return a snapped door position on that edge.
   */
  const computeDoorSnap = useCallback((
    canvasPos: Point,
    doorWidthIn: number,
  ): { side: DoorSide; x: number; y: number; width: number } | null => {
    const currentRoom = useEditorStore.getState().room
    if (!currentRoom) return null
    const edges = getRoomBoundaryEdges(currentRoom).filter(edge => {
      if (edge.side === 'top' || edge.side === 'bottom') {
        return Math.abs(edge.x2 - edge.x1) >= doorWidthIn
      }
      return Math.abs(edge.y2 - edge.y1) >= doorWidthIn
    })
    if (edges.length === 0) return null

    let best: { side: DoorSide; x: number; y: number; width: number } | null = null
    let bestDistance = Infinity

    for (const edge of edges) {
      if (edge.side === 'top' || edge.side === 'bottom') {
        const minX = Math.min(edge.x1, edge.x2)
        const maxX = Math.max(edge.x1, edge.x2) - doorWidthIn
        if (maxX < minX) continue
        const rawX = canvasPos.x - doorWidthIn / 2
        const snappedX = Math.round(snapping.snapToGrid({ x: rawX, y: 0 }, settings.gridSize).x)
        const x = Math.max(minX, Math.min(maxX, snappedX))
        const y = edge.y1
        const centerX = x + doorWidthIn / 2
        const distance = Math.hypot(canvasPos.x - centerX, canvasPos.y - y)
        if (distance < bestDistance) {
          bestDistance = distance
          best = { side: edge.side, x, y, width: doorWidthIn }
        }
      } else {
        const minY = Math.min(edge.y1, edge.y2)
        const maxY = Math.max(edge.y1, edge.y2) - doorWidthIn
        if (maxY < minY) continue
        const rawY = canvasPos.y - doorWidthIn / 2
        const snappedY = Math.round(snapping.snapToGrid({ x: 0, y: rawY }, settings.gridSize).y)
        const y = Math.max(minY, Math.min(maxY, snappedY))
        const x = edge.x1
        const centerY = y + doorWidthIn / 2
        const distance = Math.hypot(canvasPos.x - x, canvasPos.y - centerY)
        if (distance < bestDistance) {
          bestDistance = distance
          best = { side: edge.side, x, y, width: doorWidthIn }
        }
      }
    }

    return best
  }, [settings.gridSize])

  const placeDoorAt = useCallback((canvasPos: Point) => {
    const cfg = useEditorStore.getState().doorPlacementConfig
    const widthIn = cfg?.widthIn ?? 72
    const kind = cfg?.kind ?? 'door'
    const snap = computeDoorSnap(canvasPos, widthIn)
    if (!snap) return
    const existingCount = Object.values(useEditorStore.getState().doors).filter(door => door.kind === kind).length
    dispatch({
      type: 'PLACE_DOOR',
      door: {
        id: createDoorId(),
        label: kind === 'entrance' ? `Entrance ${existingCount + 1}` : `Door ${existingCount + 1}`,
        x: snap.x,
        y: snap.y,
        width: snap.width,
        side: snap.side,
        kind,
      },
      timestamp: Date.now(),
    })
  }, [computeDoorSnap, dispatch])

  function pulseAssignedTables(tableIds: string[]) {
    if (tableIds.length === 0) return
    setRecentlyAssignedTableIds(new Set(tableIds))
    window.setTimeout(() => {
      setRecentlyAssignedTableIds(current => {
        let changed = false
        const next = new Set(current)
        for (const tableId of tableIds) {
          if (next.delete(tableId)) changed = true
        }
        return changed ? next : current
      })
    }, 450)
  }

  const assignVendorToTableIds = useCallback((vendorId: string, tableIds: string[]) => {
    const state = useEditorStore.getState()
    const vendor = state.vendors[vendorId as import('@/domain/types').VendorId]
    const currentActiveRoomId = state.activeRoomId
    const currentVisibleTableIds = new Set<string>(
      Object.values(state.tables)
        .filter(table => !currentActiveRoomId || table.roomId === currentActiveRoomId)
        .map(table => table.id),
    )
    if (!vendor || tableIds.length === 0) return

    const prioritizedTableIds = [...tableIds].sort((a, b) => {
      const aVisible = currentVisibleTableIds.has(a) ? 1 : 0
      const bVisible = currentVisibleTableIds.has(b) ? 1 : 0
      if (aVisible !== bVisible) return bVisible - aVisible
      const aPremium = tables[a]?.premium ? 1 : 0
      const bPremium = tables[b]?.premium ? 1 : 0
      if (aPremium !== bPremium) return bPremium - aPremium
      return (tables[a]?.displayId ?? tables[a]?.label ?? '').localeCompare(
        tables[b]?.displayId ?? tables[b]?.label ?? '',
        undefined,
        { numeric: true },
      )
    }).filter(tableId => currentVisibleTableIds.has(tableId))

    for (const tableId of prioritizedTableIds) {
      const existing = Object.values(useEditorStore.getState().vendorAssignments).find(a => a.tableId === tableId)
      dispatch({
        type: 'ASSIGN_VENDOR',
        assignment: {
          id: createAssignmentId(),
          tableId: tableId as TableId,
          layoutId: DRAFT_LAYOUT_ID,
          vendorId: vendorId as import('@/domain/types').VendorId,
          vendorName: vendor.companyName || vendor.name,
          vendorCategory: vendor.category,
          colorOverride: null,
          notes: null,
          paymentStatus: vendor.paymentStatus,
          importSessionId: null,
        },
        prevAssignment: existing ?? null,
        timestamp: Date.now(),
      })
    }
    pulseAssignedTables(prioritizedTableIds)
  }, [dispatch, tables])

  // ── Wheel zoom ─────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return

    const oldScale = stageScale
    const pointer  = stage.getPointerPosition()
    if (!pointer) return

    const factor    = e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    const newScale  = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldScale * factor))

    // Zoom toward cursor
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    }
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }

    setStageScaleLocal(newScale)
    setStagePosLocal(newPos)
    setStageTransform(newScale, newPos)
  }, [stageScale, stagePos, setStageTransform])

  // ── Mouse down ─────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return

    const pointer = stage.getPointerPosition()
    if (!pointer) return

    // Middle mouse button or space+drag = pan
    if (e.evt.button === 1 || spaceHeldRef.current) {
      e.evt.preventDefault()
      isPanningRef.current = true
      panStartRef.current  = { pointer, stagePos }
      return
    }

    // Right-click → context menu
    if (e.evt.button === 2) {
      e.evt.preventDefault()
      const target = e.target
      const isTable = target.hasName('table-rect')
      if (isTable) {
        const tableId = target.id() as string
        if (!selectedIds.has(tableId)) {
          setSelected([tableId])
        }
        setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, tableId })
      }
      return
    }

    // Only handle left clicks from here on
    if (e.evt.button !== 0) return

    const canvasPos = toCanvas(pointer)
    const target    = e.target
    const isTable   = target.hasName('table-rect')
    const tableId   = isTable ? (target.id() as string) : null
    const currentVisibleTableIds = new Set<string>(
      Object.values(useEditorStore.getState().tables)
        .filter(table => !activeRoomId || table.roomId === activeRoomId)
        .map(table => table.id),
    )

    if (activeTool === 'place-table') {
      if (!isTable) {
        placeTableAt(canvasPos)
      }
      return
    }

    if (activeTool === 'place-row') {
      if (!isTable) {
        placeRowAt(canvasPos)
      }
      return
    }

    if (activeTool === 'place-door') {
      placeDoorAt(canvasPos)
      return
    }

    if (activeTool === 'draw-room') {
      const snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
      roomDrawRef.current = { startX: snapped.x, startY: snapped.y, shape: 'rect' }
      updateRoomDrawPreview({ x: snapped.x, y: snapped.y, width: 0, height: 0, shape: 'rect' })
      return
    }

    if (activeTool === 'draw-room-circle') {
      const snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
      roomDrawRef.current = { startX: snapped.x, startY: snapped.y, shape: 'circle' }
      updateRoomDrawPreview({ x: snapped.x, y: snapped.y, width: 0, height: 0, shape: 'circle' })
      return
    }

    if (activeTool === 'draw-room-freehand') {
      const snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
      const prev = freehandPointsRef.current ?? []
      const pts = [...prev, snapped]
      freehandPointsRef.current = pts
      setFreehandPoints(pts)
      return
    }

    if (activeTool === 'split-room') {
      const segment = findRoomSegmentAtPoint(room, canvasPos)
      if (!segment) return
      roomSplitRef.current = {
        segmentId: segment.id,
        startPoint: snapping.snapToGrid(canvasPos, settings.gridSize),
      }
      roomSplitPreviewRef.current = null
      setRoomSplitPreview(null)
      setSelectedSegmentId(segment.id)
      clearSelected()
      return
    }

    // ── Active vendor assignment: click table to assign ──────────────────
    if (activeVendorRef.current && isTable && tableId) {
      if (!currentVisibleTableIds.has(tableId)) return
      const vid = activeVendorRef.current
      const vendor = useEditorStore.getState().vendors[vid]
      if (vendor) {
        const allAssignments = useEditorStore.getState().vendorAssignments
        const existing = Object.values(allAssignments).find(a => a.tableId === tableId)
        if (existing && existing.vendorId === vid) {
          // Already assigned to this vendor — unassign (toggle)
          dispatch({
            type: 'CLEAR_VENDOR_ASSIGNMENT',
            assignment: existing,
            timestamp: Date.now(),
          })
        } else {
          // Assign (replace any existing assignment). We keep this centralized
          // here so canvas click assignment stays predictable for the roster.
          const newAssignment = {
            id: createAssignmentId(),
            tableId: tableId as TableId,
            layoutId: DRAFT_LAYOUT_ID,
            vendorId: vid,
            vendorName: vendor.companyName || [vendor.firstName, vendor.lastName].filter(Boolean).join(' ') || vendor.name,
            vendorCategory: vendor.category,
            colorOverride: null,
            notes: null,
            paymentStatus: vendor.paymentStatus,
            importSessionId: null,
          }
          dispatch({
            type: 'ASSIGN_VENDOR',
            assignment: newAssignment,
            prevAssignment: existing ?? null,
            timestamp: Date.now(),
          })
          pulseAssignedTables([tableId])
        }
      }
      return
    }

    if (!activeVendorRef.current && isTable && tableId && currentVisibleTableIds.has(tableId) && !assignmentMap.has(tableId)) {
      setAssignmentHint(`Select a vendor from the roster, then click open tables in ${activeRoomId ?? 'this room'} to assign.`)
      window.setTimeout(() => setAssignmentHint(current =>
        current === `Select a vendor from the roster, then click open tables in ${activeRoomId ?? 'this room'} to assign.` ? null : current,
      ), 1800)
    }

    if (
      activeTool === 'select' &&
      !isTable &&
      room &&
      !settings.roomLocked &&
      isPointInRoom(room, canvasPos)
    ) {
      const clickedCircleId = findContainingCircleId(canvasPos)
      const zoneId = getRoomIdForPoint(room, canvasPos)
      if (zoneId) {
        const segmentIds = new Set(
          room.segments
            .filter(segment => getRoomIdForPoint(room, {
              x: segment.x + segment.width / 2,
              y: segment.y + segment.height / 2,
            }) === zoneId)
            .map(segment => segment.id),
        )
        const circleIds = clickedCircleId
          ? new Set([clickedCircleId])
          : new Set(
              (room.circles ?? [])
                .filter(circle => getRoomIdForPoint(room, { x: circle.x, y: circle.y }) === zoneId)
                .map(circle => circle.id),
            )
        const zones = getRoomZones(room)
        const moveFreehand = clickedCircleId
          ? false
          : Boolean(room.freehandVertices && zones.length === 1 && zones[0]?.id === zoneId)
        const doorIds = clickedCircleId
          ? new Set<string>()
          : new Set(
              Object.values(doorsRecord)
                .filter(door => {
                  const midpoint = door.side === 'top' || door.side === 'bottom'
                    ? { x: door.x + door.width / 2, y: door.y }
                    : { x: door.x, y: door.y + door.width / 2 }
                  return getRoomIdForPoint(room, midpoint) === zoneId
                })
                .map(door => door.id),
            )

        roomDragRef.current = {
          startPointer: canvasPos,
          startRoom: room,
          zoneId: clickedCircleId ? `circle:${clickedCircleId}` : zoneId,
          segmentIds,
          circleIds,
          moveFreehand,
          doorIds,
        }
        setSelectedSegmentId(null)
        clearSelected()
        return
      }
    }

    // Select tool
    if (isTable && tableId) {
      // Start potential drag on a table
      const isSelected = selectedIds.has(tableId)

      if (e.evt.ctrlKey || e.evt.metaKey) {
        // Ctrl/Cmd+click: toggle this table without affecting others
        toggleSelected(tableId)
      } else if (!e.evt.shiftKey) {
        if (!isSelected) {
          // Replace selection with just this table
          setSelected([tableId])
        }
        // If already selected (possibly multi), keep selection so the whole
        // group can be dragged. A click without drag will not change selection.
      } else {
        // Shift+click: range-select along the dominant axis between anchor and clicked table
        const anchorId = [...selectedIds].find(id => tables[id])
        if (!anchorId) {
          setSelected([tableId])
        } else {
          setSelected(selectRangeBetweenTables(anchorId, tableId, Object.values(tables)).map(t => t.id))
        }
      }

      // Drag tracks either the full current selection (no-shift/ctrl) or just the
      // clicked table (shift/ctrl), because the toggle isn't committed yet.
      const dragIds = (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey)
        ? [tableId]
        : isSelected
          ? [...selectedIds]
          : [tableId]

      const startPositions: Record<string, Point> = {}
      for (const id of dragIds) {
        const t = tables[id]
        if (t) startPositions[id] = { x: t.x, y: t.y }
      }

      dragStateRef.current = {
        primaryId:      tableId,
        startPointer:   canvasPos,
        startPositions,
        isDragging:     false,
      }
    } else {
      // Clicked on empty canvas — clear segment selection and start drag-select.
      // Room segments are edited from the Room panel so canvas marquee selection
      // is never blocked by room dragging.
      setSelectedSegmentId(null)
      if (!e.evt.shiftKey) {
        clearSelected()
      }
      updateSelectionState({
        startX:   canvasPos.x,
        startY:   canvasPos.y,
        currentX: canvasPos.x,
        currentY: canvasPos.y,
      })
    }
  }, [activeRoomId, activeTool, assignmentMap, selectedIds, tables, settings, toCanvas, findContainingCircleId, setSelected, toggleSelected, clearSelected, setSelectedSegmentId, stagePos, placeTableAt, placeRowAt, placeDoorAt, dispatch, room, doorsRecord])

  // ── Mouse move ─────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return

    const pointer = stage.getPointerPosition()
    if (!pointer) return

    // Panning
    if (isPanningRef.current && panStartRef.current) {
      const dx = pointer.x - panStartRef.current.pointer.x
      const dy = pointer.y - panStartRef.current.pointer.y
      const newPos = {
        x: panStartRef.current.stagePos.x + dx,
        y: panStartRef.current.stagePos.y + dy,
      }
      setStagePosLocal(newPos)
      setStageTransform(stageScale, newPos)
      return
    }

    const canvasPos = toCanvas(pointer)

    // Room drawing
    if (roomDrawRef.current) {
      const snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
      const startX = roomDrawRef.current.startX
      const startY = roomDrawRef.current.startY
      if (roomDrawRef.current.shape === 'circle') {
        const radiusX = Math.abs(snapped.x - startX)
        const radiusY = Math.abs(snapped.y - startY)
        updateRoomDrawPreview({
          x: startX - radiusX,
          y: startY - radiusY,
          width: radiusX * 2,
          height: radiusY * 2,
          shape: 'circle',
        })
        return
      }
      updateRoomDrawPreview({
        x: Math.min(startX, snapped.x),
        y: Math.min(startY, snapped.y),
        width: Math.abs(snapped.x - startX),
        height: Math.abs(snapped.y - startY),
        shape: roomDrawRef.current.shape,
      })
      return
    }

    if (roomSplitRef.current) {
      const currentRoom = useEditorStore.getState().room
      const segment = currentRoom?.segments.find(entry => entry.id === roomSplitRef.current?.segmentId)
      if (!segment) {
        roomSplitRef.current = null
        roomSplitPreviewRef.current = null
        setRoomSplitPreview(null)
        return
      }

      const preview = buildRoomSplitPreview(
        segment,
        roomSplitRef.current.startPoint,
        snapping.snapToGrid(canvasPos, settings.gridSize),
        settings.gridSize,
        settings.wallThickness,
      )

      if (!preview) {
        roomSplitPreviewRef.current = null
        setRoomSplitPreview(null)
        return
      }

      const nextPreview = {
        lineStart: preview.lineStart,
        lineEnd: preview.lineEnd,
        segmentId: preview.segmentId,
      }
      roomSplitPreviewRef.current = nextPreview
      setRoomSplitPreview(nextPreview)
      return
    }

    if (roomDragRef.current) {
      const drag = roomDragRef.current
      const dx = canvasPos.x - drag.startPointer.x
      const dy = canvasPos.y - drag.startPointer.y
      const snapped = snapping.snapToGrid({ x: dx, y: dy }, settings.gridSize)
      roomDraftOffsetRef.current = snapped
      setRoomDraftOffset(snapped)
      return
    }

    // Room segment drag
    if (segmentDragRef.current) {
      const seg = segmentDragRef.current
      const dx = canvasPos.x - seg.startPointer.x
      const dy = canvasPos.y - seg.startPointer.y
      const snapped = snapping.snapToGrid(
        { x: seg.startPos.x + dx, y: seg.startPos.y + dy },
        settings.gridSize,
      )
      const draft = { id: seg.segmentId, x: snapped.x, y: snapped.y }
      segmentDraftPosRef.current = draft
      setSegmentDraftPos(draft)
      return
    }

    // Table drag
    if (dragStateRef.current) {
      const drag = dragStateRef.current
      const dx = canvasPos.x - drag.startPointer.x
      const dy = canvasPos.y - drag.startPointer.y

      // Check drag threshold
      if (!drag.isDragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD / stageScale && Math.abs(dy) < DRAG_THRESHOLD / stageScale) return
        drag.isDragging = true
      }

      // Compute snap for the primary table, apply same delta to all dragged tables
      const primaryTable = tables[drag.primaryId]
      if (!primaryTable) return

      const rawX = drag.startPositions[drag.primaryId].x + dx
      const rawY = drag.startPositions[drag.primaryId].y + dy

      // Targets = all tables NOT being dragged (for object snap)
      const draggingIds = new Set(Object.keys(drag.startPositions))
      const targetRects = Object.values(tables)
        .filter(t => !draggingIds.has(t.id))
        .map(t => ({ x: t.x, y: t.y, width: t.width, height: t.height }))

      const snapResult = snapping.snap(
        { x: rawX, y: rawY, width: primaryTable.width, height: primaryTable.height },
        targetRects,
        {
          gridSize:      settings.gridSize,
          snapToGrid:    settings.snapToGrid,
          snapToObjects: settings.snapToObjects,
          threshold:     settings.gridSize / 2,
        },
      )

      // Enforce wall setback and door clearance
      let snappedPos = snapResult.point
      const currentRoom = useEditorStore.getState().room
      if (currentRoom) {
        if (settings.wallSetback > 0 || settings.wallThickness > 0) {
          const clamped = clampToWallSetback(
            currentRoom,
            { x: snappedPos.x, y: snappedPos.y, width: primaryTable.width, height: primaryTable.height, rotation: primaryTable.rotation },
            settings.wallSetback + settings.wallThickness / 2,
          )
          snappedPos = { x: clamped.x, y: clamped.y }
        }
        const roomBoundsForDoors = computeRoomBounds(currentRoom)
        if (roomBoundsForDoors && settings.doorClearance > 0) {
          const currentDoors = Object.values(useEditorStore.getState().doors)
          if (currentDoors.length > 0) {
            const pushed = pushOutOfDoorZones(
              { x: snappedPos.x, y: snappedPos.y, width: primaryTable.width, height: primaryTable.height },
              currentDoors, roomBoundsForDoors, settings.doorClearance,
            )
            snappedPos = { x: pushed.x, y: pushed.y }
          }
        }
      }

      // Delta after snap
      const snappedDx = snappedPos.x - drag.startPositions[drag.primaryId].x
      const snappedDy = snappedPos.y - drag.startPositions[drag.primaryId].y

      const newDraft: Record<string, Point> = {}
      for (const [id, startPos] of Object.entries(drag.startPositions)) {
        newDraft[id] = { x: startPos.x + snappedDx, y: startPos.y + snappedDy }
      }
      setDraftPositions(newDraft)
      return
    }

    // Door placement ghost preview
    if (activeTool === 'place-door') {
      const cfg = useEditorStore.getState().doorPlacementConfig
      const widthIn = cfg?.widthIn ?? 72
      const snap = computeDoorSnap(canvasPos, widthIn)
      setDoorPlacementPreview(snap ? { ...snap, kind: cfg?.kind ?? 'door' } : null)
      return
    }

    // Selection rect update — read from ref to avoid stale closure
    if (selectionStateRef.current) {
      updateSelectionState({ ...selectionStateRef.current, currentX: canvasPos.x, currentY: canvasPos.y })
    }
  }, [toCanvas, tables, settings, stageScale, setStageTransform, activeTool, computeDoorSnap])

  // ── Mouse up ───────────────────────────────────────────────────────────────

  const handleMouseUp = useCallback(() => {
    if (placementClickHandledRef.current) {
      placementClickHandledRef.current = false
      dragStateRef.current = null
      setDraftPositions({})
      updateSelectionState(null)
      return
    }

    // End panning
    if (isPanningRef.current) {
      isPanningRef.current = false
      panStartRef.current  = null
      return
    }

    if (roomDragRef.current) {
      const roomDrag = roomDragRef.current
      const { startRoom } = roomDrag
      const draftOffset = roomDraftOffsetRef.current
      roomDragRef.current = null
      roomDraftOffsetRef.current = null
      setRoomDraftOffset(null)

      if (draftOffset && (draftOffset.x !== 0 || draftOffset.y !== 0)) {
        dispatch({
          type: 'SET_ROOM',
          prevRoom: startRoom,
          nextRoom: {
            ...startRoom,
            segments: startRoom.segments.map(segment => ({
              ...segment,
              x: roomDrag.segmentIds.has(segment.id) ? segment.x + draftOffset.x : segment.x,
              y: roomDrag.segmentIds.has(segment.id) ? segment.y + draftOffset.y : segment.y,
            })),
            circles: (startRoom.circles ?? []).map(circle => ({
              ...circle,
              x: roomDrag.circleIds.has(circle.id) ? circle.x + draftOffset.x : circle.x,
              y: roomDrag.circleIds.has(circle.id) ? circle.y + draftOffset.y : circle.y,
            })),
            freehandVertices: roomDrag.moveFreehand
              ? startRoom.freehandVertices?.map(vertex => ({
                  x: vertex.x + draftOffset.x,
                  y: vertex.y + draftOffset.y,
                })) ?? null
              : startRoom.freehandVertices,
          },
          timestamp: Date.now(),
        })
        const movedDoors = Object.values(useEditorStore.getState().doors).filter(door => roomDrag.doorIds.has(door.id))
        for (const door of movedDoors) {
          dispatch({
            type: 'MOVE_DOOR',
            doorId: door.id as DoorId,
            prev: { x: door.x, y: door.y, side: door.side },
            next: { x: door.x + draftOffset.x, y: door.y + draftOffset.y, side: door.side },
            timestamp: Date.now(),
          })
        }
      }
      return
    }

    // Commit segment drag
    if (segmentDragRef.current) {
      const { segmentId, startPos } = segmentDragRef.current
      const draft = segmentDraftPosRef.current
      segmentDragRef.current = null
      segmentDraftPosRef.current = null
      setSegmentDraftPos(null)
      if (draft && (draft.x !== startPos.x || draft.y !== startPos.y)) {
        const currentRoom = useEditorStore.getState().room
        const seg = currentRoom?.segments.find(s => s.id === segmentId)
        if (seg) {
          dispatch({
            type: 'UPDATE_ROOM_SEGMENT',
            segmentId: segmentId as import('@/domain/types').RoomSegmentId,
            prev: { x: seg.x, y: seg.y, width: seg.width, height: seg.height },
            next: { x: draft.x, y: draft.y, width: seg.width, height: seg.height },
            timestamp: Date.now(),
          })
        }
      }
      return
    }

    // Commit room draw — adds a rectangular segment to the composite room
    if (roomSplitRef.current) {
      const splitState = roomSplitRef.current
      const currentRoom = useEditorStore.getState().room
      const segment = currentRoom?.segments.find(entry => entry.id === splitState.segmentId)
      const previewLine = roomSplitPreviewRef.current

      roomSplitRef.current = null
      roomSplitPreviewRef.current = null
      setRoomSplitPreview(null)

      if (currentRoom && segment && previewLine) {
        const preview = buildRoomSplitPreview(
          segment,
          splitState.startPoint,
          previewLine.lineEnd,
          settings.gridSize,
          settings.wallThickness,
        )

        if (preview) {
          dispatch({
            type: 'SET_ROOM',
            prevRoom: currentRoom,
            nextRoom: applyRoomSplit(currentRoom, preview, createRoomSegmentId),
            timestamp: Date.now(),
          })
          setSelectedSegmentId(null)
        }
      }
      return
    }

    const drawPreview = roomDrawPreviewRef.current
    if (roomDrawRef.current && drawPreview) {
      roomDrawRef.current = null
      if (drawPreview.width >= 24 && drawPreview.height >= 24) {
        if (drawPreview.shape === 'circle') {
          const currentRoom = useEditorStore.getState().room
          dispatch({
            type: 'SET_ROOM',
            prevRoom: currentRoom,
            nextRoom: {
              segments: currentRoom?.segments ?? [],
              circles: [
                ...(currentRoom?.circles ?? []),
                {
                  id: createRoomCircleId(),
                  x: drawPreview.x + drawPreview.width / 2,
                  y: drawPreview.y + drawPreview.height / 2,
                  radiusX: drawPreview.width / 2,
                  radiusY: drawPreview.height / 2,
                },
              ],
              freehandVertices: null,
              roomLabels: currentRoom?.roomLabels ?? {},
            },
            timestamp: Date.now(),
          })
        } else {
          dispatch({
            type: 'ADD_ROOM_SEGMENT',
            segment: {
              id: createRoomSegmentId(),
              x: drawPreview.x,
              y: drawPreview.y,
              width: drawPreview.width,
              height: drawPreview.height,
            },
            prevRoom: useEditorStore.getState().room,
            timestamp: Date.now(),
          })
        }
      }
      updateRoomDrawPreview(null)
      return
    }

    // Commit freehand room draw
    if (freehandPointsRef.current && freehandPointsRef.current.length >= 3) {
      dispatch({
        type: 'SET_FREEHAND_ROOM',
        prevRoom: useEditorStore.getState().room,
        vertices: freehandPointsRef.current,
        timestamp: Date.now(),
      })
      freehandPointsRef.current = null
      setFreehandPoints(null)
      return
    }

    // Commit drag
    if (dragStateRef.current) {
      const drag = dragStateRef.current

      if (drag.isDragging && Object.keys(draftPositions).length > 0) {
        const moves = Object.entries(drag.startPositions)
          .map(([id, startPos]) => {
            const next = draftPositions[id] ?? startPos
            return {
              tableId: id as TableId,
              prevX: startPos.x,
              prevY: startPos.y,
              nextX: next.x,
              nextY: next.y,
            }
          })
          .filter(m => m.prevX !== m.nextX || m.prevY !== m.nextY)

        if (moves.length > 0) {
          dispatch({ type: 'MOVE_TABLES', moves, timestamp: Date.now() })
        }
      }

      dragStateRef.current = null
      setDraftPositions({})
      return
    }

    // Commit selection rect — read from ref to avoid stale closure
    const sel = selectionStateRef.current
    if (sel) {
      const selRect = geometry.normalizeRect({
        x:      sel.startX,
        y:      sel.startY,
        width:  sel.currentX - sel.startX,
        height: sel.currentY - sel.startY,
      })

      // Select all tables whose AABB center falls within the selection rect
      const hits: string[] = []
      for (const table of Object.values(tables)) {
        const cx = table.x + table.width / 2
        const cy = table.y + table.height / 2
        if (geometry.containsPoint(selRect, { x: cx, y: cy })) {
          hits.push(table.id)
        }
      }
      if (hits.length > 0) setSelected(hits)

      updateSelectionState(null)
    }
  }, [draftPositions, tables, dispatch, setSelected, setSelectedSegmentId, settings])

  // ── Cursor style ───────────────────────────────────────────────────────────

  const cursorClass = isPanningRef.current
    ? 'canvas-panning'
    : spaceHeldRef.current
      ? 'canvas-pan'
      : (activeTool === 'place-table' || activeTool === 'place-row' || activeTool === 'place-door')
        ? 'canvas-place'
        : (activeTool === 'draw-room' || activeTool === 'draw-room-circle' || activeTool === 'draw-room-freehand' || activeTool === 'split-room')
          ? 'canvas-place'
          : 'canvas-select'

  // ── Double-click to rename ─────────────────────────────────────────────────

  const handleTableDoubleClick = useCallback((tableId: string) => {
    const table = tables[tableId]
    if (!table) return

    const stage = stageRef.current
    if (!stage) return

    // Calculate screen position of the table
    const screenX = table.x * stageScale + stagePos.x
    const screenY = table.y * stageScale + stagePos.y
    const screenW = table.width * stageScale
    const screenH = table.height * stageScale

    setEditingTableId(tableId)
    setEditingPos({ x: screenX, y: screenY, width: screenW, height: screenH })
  }, [tables, stageScale, stagePos])

  const handleLabelCommit = useCallback((tableId: string, newLabel: string) => {
    const table = tables[tableId]
    if (!table) return

    dispatch({
      type: 'RELABEL_TABLE',
      tableId: tableId as TableId,
      prev: { label: table.label, labelOverridden: table.labelOverridden },
      next: { label: newLabel, labelOverridden: true },
      timestamp: Date.now(),
    })

    setEditingTableId(null)
    setEditingPos(null)
  }, [tables, dispatch])

  const handleLabelCancel = useCallback(() => {
    setEditingTableId(null)
    setEditingPos(null)
  }, [])

  // ── Double-click to close freehand polygon ────────────────────────────────

  const handleStageDblClick = useCallback(() => {
    if (activeTool === 'draw-room-freehand' && freehandPointsRef.current && freehandPointsRef.current.length >= 3) {
      // Close and commit the freehand polygon
      dispatch({
        type: 'SET_FREEHAND_ROOM',
        prevRoom: useEditorStore.getState().room,
        vertices: freehandPointsRef.current,
        timestamp: Date.now(),
      })
      freehandPointsRef.current = null
      setFreehandPoints(null)
    }
  }, [activeTool, dispatch])

  // ── Door list for rendering ────────────────────────────────────────────────

  const displayDoorList = useMemo(() => {
    const doors = Object.values(doorsRecord)
    if (!roomDraftOffset || !roomDragRef.current) return doors
    return doors.map(door => (
      roomDragRef.current?.doorIds.has(door.id)
        ? { ...door, x: door.x + roomDraftOffset.x, y: door.y + roomDraftOffset.y }
        : door
    ))
  }, [doorsRecord, roomDraftOffset])
  const displayRoomBoundaryEdges = useMemo(() => (displayRoom ? getRoomBoundaryEdges(displayRoom) : []), [displayRoom])

  // ── Door drag handler ───────────────────────────────────────────────────

  const handleDoorDragEnd = useCallback((doorId: string, newX: number, newY: number) => {
    const door = doorsRecord[doorId]
    if (!door) return
    dispatch({
      type: 'MOVE_DOOR',
      doorId: doorId as DoorId,
      prev: { x: door.x, y: door.y, side: door.side },
      next: { x: newX, y: newY, side: door.side },
      timestamp: Date.now(),
    })
  }, [doorsRecord, dispatch])

  // ── Background image list ──────────────────────────────────────────────────

  const bgImageList = useMemo(() => Object.values(bgImagesRecord), [bgImagesRecord])
  const vendorRemainingMap = useMemo(() => {
    const currentRoomTableIds = new Set<string>(
      Object.values(tables)
        .filter(table => !activeRoomId || table.roomId === activeRoomId)
        .map(table => table.id),
    )
    const assignedCounts = new Map<string, number>()
    for (const assignment of Object.values(vendorAssignments)) {
      if (!currentRoomTableIds.has(assignment.tableId)) continue
      assignedCounts.set(assignment.vendorId, (assignedCounts.get(assignment.vendorId) ?? 0) + 1)
    }
    const remaining = new Map<string, number>()
    for (const vendor of Object.values(vendorsRecord)) {
      remaining.set(vendor.id, Math.max(vendor.tablesNeeded - (assignedCounts.get(vendor.id) ?? 0), 0))
    }
    return remaining
  }, [activeRoomId, tables, vendorAssignments, vendorsRecord])

  const handleBgImageDragEnd = useCallback((id: import('@/domain/types').BackgroundImageId, x: number, y: number) => {
    updateBgImage(id, { x, y })
  }, [updateBgImage])

  // ── Table list for rendering ───────────────────────────────────────────────

  const tableList = useMemo(() => Object.values(tables), [tables])
  const activeRoomTableIds = useMemo(
    () => new Set<string>(
      tableList
        .filter(table => !activeRoomId || table.roomId === activeRoomId)
        .map(table => table.id),
    ),
    [activeRoomId, tableList],
  )
  const hoveredAssignment = hoveredTableId ? assignmentMap.get(hoveredTableId) ?? null : null
  const hoveredTable = hoveredTableId ? tables[hoveredTableId] ?? null : null

  const zoomBy = useCallback((factor: number) => {
    const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stageScale * factor))
    setStageScaleLocal(nextScale)
  }, [stageScale])

  const resetView = useCallback(() => {
    setStageScaleLocal(1)
    setStagePosLocal({ x: 0, y: 0 })
  }, [])

  const miniMap = useMemo(() => {
    const canvasWidth = settings.canvasWidth
    const canvasHeight = settings.canvasHeight
    const width = 170
    const height = Math.max(110, Math.round((canvasHeight / canvasWidth) * width))
    const scale = width / canvasWidth
    const viewport = {
      x: Math.max(0, (-stagePos.x / stageScale) * scale),
      y: Math.max(0, (-stagePos.y / stageScale) * scale),
      width: Math.min(width, (stageSize.width / stageScale) * scale),
      height: Math.min(height, (stageSize.height / stageScale) * scale),
    }
    return { width, height, scale, viewport }
  }, [settings.canvasWidth, settings.canvasHeight, stagePos.x, stagePos.y, stageScale, stageSize.width, stageSize.height])

  const handleVendorDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const vendorId = e.dataTransfer.getData('application/x-floorplanner-vendor')
    if (!vendorId || showMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const canvasPos = toCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      const droppedTable = tableList.find(table =>
        canvasPos.x >= table.x &&
        canvasPos.x <= table.x + table.width &&
        canvasPos.y >= table.y &&
        canvasPos.y <= table.y + table.height,
      )
      if (!droppedTable) return
      if (!activeRoomTableIds.has(droppedTable.id)) return
      const targetIds = selectedIds.has(droppedTable.id) && selectedIds.size > 0
        ? [...selectedIds].filter(tableId => activeRoomTableIds.has(tableId))
        : [droppedTable.id]
      assignVendorToTableIds(vendorId, targetIds)
  }, [activeRoomTableIds, assignVendorToTableIds, selectedIds, showMode, tableList, toCanvas])

  const handleControlsDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    controlsDragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left - controlsPos.x,
      offsetY: e.clientY - rect.top - controlsPos.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [controlsPos.x, controlsPos.y])

  const handleControlsDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = controlsDragRef.current
    const rect = containerRef.current?.getBoundingClientRect()
    if (!drag || drag.pointerId !== e.pointerId || !rect) return
    setControlsPos({
      x: Math.max(0, e.clientX - rect.left - drag.offsetX),
      y: Math.max(0, e.clientY - rect.top - drag.offsetY),
    })
  }, [])

  const handleControlsDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = controlsDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    controlsDragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${cursorClass}`}
      style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)' }}
      onContextMenu={e => e.preventDefault()}
      onAuxClick={e => e.preventDefault()}
      onDragOver={e => e.preventDefault()}
      onDrop={handleVendorDrop}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleStageDblClick}
      >
        {/* Grid — static, no events */}
        {gridVisible && (
          <GridLayer
            width={settings.canvasWidth}
            height={settings.canvasHeight}
            gridSize={settings.gridSize}
          />
        )}

        {/* Background images — behind everything */}
        {bgImageList.length > 0 && (
          <BackgroundImageLayer images={bgImageList} onDragEnd={handleBgImageDragEnd} />
        )}

        {/* Room boundary, doors, and clearance zones */}
        <Layer listening={false}>
          <RoomLayer
            room={displayRoom}
            doors={displayDoorList}
            doorClearance={settings.doorClearance}
            wallThickness={settings.wallThickness}
            wallSetback={settings.wallSetback}
            showWallSetback={settings.showWallSetback}
            selectedSegmentId={selectedSegmentId}
          />
        </Layer>

        {/* Tables */}
        <Layer>
          {tableList.map(table => {
            const assignment = assignmentMap.get(table.id)
            const sectionColor = table.sectionId ? sections[table.sectionId]?.color : undefined
            const isHoveredVendorTable = assignment?.vendorId === hoveredVendorId
            const isActiveVendorTable = assignment?.vendorId === activeVendorId
            const hoveredVendorNeedsTables = hoveredVendorId ? (vendorRemainingMap.get(hoveredVendorId) ?? 0) > 0 : false
            const isSuggestedTarget = !assignment && hoveredVendorNeedsTables
            const isSuggestedPremiumTarget = isSuggestedTarget && table.premium
            const assignedVendor = assignment ? vendorsRecord[assignment.vendorId] : null
            const isCaseHighlighted = Boolean(showMode && showCaseHighlights && (assignedVendor?.cases ?? 0) > 0)
            const caseCount = assignedVendor?.cases ?? 0
            const caseHighlightColor = showMode && showSectionColors ? '#ea580c' : '#2563eb'
            const fillColor = showMode
              ? assignment
                ? showSectionColors
                  ? sectionColor ?? OPEN_TABLE_FILL
                  : settings.vendorColorCoding
                    ? assignment.colorOverride ?? vendorColor(assignment.vendorId)
                    : sectionColor ?? OPEN_TABLE_FILL
                : '#fca5a5'
              : assignment
                ? settings.vendorColorCoding
                  ? assignment.colorOverride ?? vendorColor(assignment.vendorId)
                  : sectionColor ?? OPEN_TABLE_FILL
                : sectionColor ?? OPEN_TABLE_FILL

            // Compute highest warning severity for this table
            let warningSeverity: WarningSeverity | null = null
            if (warningResult.affectedTableIds.has(table.id)) {
              const tw = warningsModule.warningsForTable(warningResult, table.id)
              for (const w of tw) {
                if (w.severity === 'error') { warningSeverity = 'error'; break }
                if (w.severity === 'warning') warningSeverity = 'warning'
                else if (w.severity === 'info' && !warningSeverity) warningSeverity = 'info'
              }
            }

            return (
              <TableNode
                key={table.id}
                table={table}
                isSelected={selectedIds.has(table.id)}
                isPremium={table.premium}
                isDuplicate={duplicateIds.has(table.id)}
                warningSeverity={warningSeverity}
                draftPos={draftPositions[table.id] ?? null}
                fillColor={fillColor}
                vendorName={assignmentMap.get(table.id)?.vendorName}
                vendorCategory={assignmentMap.get(table.id)?.vendorCategory ?? null}
                isHoveredVendor={isHoveredVendorTable}
                isActiveVendor={isActiveVendorTable}
                isRecentlyAssigned={recentlyAssignedTableIds.has(table.id)}
                isSuggestedTarget={isSuggestedTarget}
                isSuggestedPremiumTarget={isSuggestedPremiumTarget}
                isCaseHighlighted={isCaseHighlighted}
                caseCount={caseCount}
                caseHighlightColor={caseHighlightColor}
                onRegister={registerNode}
                onDoubleClick={handleTableDoubleClick}
                onHoverStart={setHoveredTableId}
                onHoverEnd={() => setHoveredTableId(null)}
              />
            )
          })}
          <TransformerControl
            selectedIds={selectedIds}
            nodeRefs={nodeRefs}
            tables={tables}
            dispatch={dispatch}
          />
        </Layer>

        {/* Interactive door layer */}
        {displayDoorList.length > 0 && (
          <Layer>
            {displayDoorList.map(door => {
              const edge = findBoundaryEdgeForDoor(door, displayRoomBoundaryEdges)
              if (!edge) return null
              return (
                <DoorNode
                  key={door.id}
                  door={door}
                  edge={edge}
                  isSelected={selectedDoorId === door.id}
                  gridSize={settings.gridSize}
                  unitLabel={settings.unitLabel}
                  onDragEnd={handleDoorDragEnd}
                  onClick={setSelectedDoor}
                />
              )
            })}
          </Layer>
        )}

        {/* Overlay: door placement ghost */}
        {doorPlacementPreview && (() => {
          const p = doorPlacementPreview
          const thickness = 6
          const isHoriz = p.side === 'top' || p.side === 'bottom'
          const gx = isHoriz ? p.x : p.x - thickness / 2
          const gy = isHoriz ? p.y - thickness / 2 : p.y
          const gw = isHoriz ? p.width : thickness
          const gh = isHoriz ? thickness : p.width
          return (
            <Layer listening={false}>
              <Rect
                x={gx}
                y={gy}
                width={gw}
                height={gh}
                fill={p.kind === 'entrance' ? '#7c3aed' : '#2563eb'}
                opacity={0.55}
                cornerRadius={1}
              />
            </Layer>
          )
        })()}

        {/* Overlay: selection rect */}
        {selectionState && (
          <Layer listening={false}>
            <SelectionRect selectionState={selectionState} />
          </Layer>
        )}

        {/* Overlay: room draw preview (rectangle segment) */}
        {roomDrawPreview && roomDrawPreview.width > 0 && roomDrawPreview.height > 0 && (
          <Layer listening={false}>
            {roomDrawPreview.shape === 'circle' ? (
              <Ellipse
                x={roomDrawPreview.x + roomDrawPreview.width / 2}
                y={roomDrawPreview.y + roomDrawPreview.height / 2}
                radiusX={roomDrawPreview.width / 2}
                radiusY={roomDrawPreview.height / 2}
                stroke="#334155"
                strokeWidth={2}
                dash={[8, 4]}
                fill="#334155"
                opacity={0.05}
                listening={false}
              />
            ) : (
              <Rect
                x={roomDrawPreview.x}
                y={roomDrawPreview.y}
                width={roomDrawPreview.width}
                height={roomDrawPreview.height}
                stroke="#334155"
                strokeWidth={2}
                dash={[8, 4]}
                fill="#334155"
                opacity={0.05}
                listening={false}
              />
            )}
          </Layer>
        )}

        {/* Overlay: freehand room preview */}
        {freehandPoints && freehandPoints.length >= 2 && (
          <Layer listening={false}>
            <Line
              points={freehandPoints.flatMap(p => [p.x, p.y])}
              stroke="#334155"
              strokeWidth={2}
              dash={[8, 4]}
              closed={false}
              listening={false}
            />
          </Layer>
        )}

        {roomSplitPreview && (
          <Layer listening={false}>
            <Line
              points={[
                roomSplitPreview.lineStart.x,
                roomSplitPreview.lineStart.y,
                roomSplitPreview.lineEnd.x,
                roomSplitPreview.lineEnd.y,
              ]}
              stroke="#f59e0b"
              strokeWidth={3}
              dash={[10, 6]}
              lineCap="round"
              listening={false}
            />
          </Layer>
        )}
      </Stage>

      {!showMode && (
        <>
          <div
            className="absolute z-20 w-[320px] rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm"
            style={{ left: controlsPos.x, top: controlsPos.y }}
          >
            <div
              className="flex cursor-move items-center gap-2 border-b border-slate-200 px-3 py-2"
              onPointerDown={handleControlsDragStart}
              onPointerMove={handleControlsDragMove}
              onPointerUp={handleControlsDragEnd}
              onPointerCancel={handleControlsDragEnd}
            >
              <div className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Canvas Controls
              </div>
              <button
                onClick={() => setControlsCollapsed(prev => !prev)}
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                {controlsCollapsed ? 'Expand' : 'Collapse'}
              </button>
            </div>

            {!controlsCollapsed && (
              <div className="p-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => zoomBy(ZOOM_STEP)} className="h-10 w-10 rounded-xl bg-slate-100 text-lg font-semibold text-slate-700 hover:bg-slate-200">+</button>
                  <button onClick={() => zoomBy(1 / ZOOM_STEP)} className="h-10 w-10 rounded-xl bg-slate-100 text-lg font-semibold text-slate-700 hover:bg-slate-200">-</button>
                  <button onClick={resetView} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">Reset</button>
                  <button
                    onClick={() => setGridVisible(!gridVisible)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${gridVisible ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    Grid
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Pan with space + drag. Drag a box to multi-select. Drop vendors directly on tables to assign.
                </div>
                {assignmentHint && (
                  <div className="mt-2 rounded-xl bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700">
                    {assignmentHint}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="absolute right-4 top-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Mini Map</div>
            <div className="relative overflow-hidden rounded-xl bg-slate-100" style={{ width: miniMap.width, height: miniMap.height }}>
              {tableList.map(table => (
                <div
                  key={`mini-${table.id}`}
                  className="absolute rounded-sm"
                  style={{
                    left: table.x * miniMap.scale,
                    top: table.y * miniMap.scale,
                    width: Math.max(2, table.width * miniMap.scale),
                    height: Math.max(2, table.height * miniMap.scale),
                    backgroundColor: table.premium ? '#d97706' : assignmentMap.has(table.id) ? '#16a34a' : '#94a3b8',
                  }}
                />
              ))}
              <div
                className="absolute rounded-md border-2 border-blue-500/90 bg-blue-500/10"
                style={{
                  left: miniMap.viewport.x,
                  top: miniMap.viewport.y,
                  width: miniMap.viewport.width,
                  height: miniMap.viewport.height,
                }}
              />
            </div>
          </div>
        </>
      )}

      {hoveredTable && (
        <div className="pointer-events-none absolute z-20 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-lg backdrop-blur-sm" style={{ left: hoveredTable.x * stageScale + stagePos.x + 28, top: hoveredTable.y * stageScale + stagePos.y - 32 }}>
          <div className="font-semibold text-slate-900">{hoveredAssignment?.vendorName ?? 'Open table'}</div>
          <div>Table {hoveredTable.displayId}</div>
          <div>{hoveredTable.shape === 'round' ? 'Round' : 'Rectangle'}{hoveredTable.premium ? ' · Premium' : ''}</div>
        </div>
      )}

      {/* Inline label editor — HTML overlay on top of Konva canvas */}
      {editingTableId && editingPos && (
        <InlineLabelEditor
          tableId={editingTableId}
          currentLabel={tables[editingTableId]?.label ?? ''}
          position={editingPos}
          onCommit={handleLabelCommit}
          onCancel={handleLabelCancel}
        />
      )}

      {/* Shortcuts legend */}
      {showShortcuts && (
        <ShortcutsLegend onClose={() => setShowShortcuts(false)} />
      )}

      {/* Right-click context menu */}
      {contextMenu && (() => {
        const table = tables[contextMenu.tableId]
        if (!table) return null
        const assignment = assignmentMap.get(table.id)
        const actions: ContextMenuAction[] = [
          {
            label: 'Rename Table',
            action: () => {
              const node = nodeRefs.current.get(table.id)
              if (node) {
                const stage = stageRef.current
                if (stage) {
                  const absPos = node.getAbsolutePosition()
                  setEditingTableId(table.id)
                  setEditingPos({
                    x: absPos.x,
                    y: absPos.y,
                    width: table.width * stageScale,
                    height: table.height * stageScale,
                  })
                }
              }
            },
          },
          {
            label: assignment ? `Clear Vendor (${assignment.vendorName})` : 'Assign Vendor…',
            action: () => {
              if (assignment) {
                dispatch({
                  type: 'CLEAR_VENDOR_ASSIGNMENT',
                  timestamp: Date.now(),
                  assignment,
                })
              }
            },
            disabled: !assignment,
          },
          {
            label: table.premium
              ? `Remove Premium${selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}`
              : `Mark as Premium${selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}`,
            action: () => {
              const ids = selectedIds.size > 1 ? [...selectedIds] : [table.id]
              const prev: Record<string, boolean> = {}
              for (const id of ids) prev[id] = tables[id]?.premium ?? false
              dispatch({
                type: 'SET_TABLE_PREMIUM',
                tableIds: ids as import('@/domain/types').TableId[],
                premium: !table.premium,
                prev,
                timestamp: Date.now(),
              })
            },
          },
          {
            label: 'Resize → 6ft',
            action: () => dispatch({ type: 'RESIZE_TABLE', timestamp: Date.now(), tableId: table.id as TableId, prev: { x: table.x, y: table.y, width: table.width, height: table.height }, next: { x: table.x, y: table.y, width: 72, height: 30 } }),
          },
          {
            label: 'Resize → 8ft',
            action: () => dispatch({ type: 'RESIZE_TABLE', timestamp: Date.now(), tableId: table.id as TableId, prev: { x: table.x, y: table.y, width: table.width, height: table.height }, next: { x: table.x, y: table.y, width: 96, height: 30 } }),
          },
          {
            label: `Delete${selectedIds.size > 1 ? ` (${selectedIds.size} tables)` : ''}`,
            danger: true,
            action: () => {
              const idsToDelete = selectedIds.size > 1 ? [...selectedIds] : [table.id]
              const tablesToDelete = idsToDelete.map(id => tables[id]).filter(Boolean)
              const affectedAssignments = Object.values(vendorAssignments).filter(a => idsToDelete.includes(a.tableId))
              dispatch({
                type: 'DELETE_TABLES',
                timestamp: Date.now(),
                tables: tablesToDelete,
                affectedAssignments,
              })
              clearSelected()
            },
          },
        ]
        return (
          <TableContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={actions}
            onClose={() => setContextMenu(null)}
          />
        )
      })()}
    </div>
  )
}

function spatialSort(tables: import('@/domain/types').TableObject[]): import('@/domain/types').TableObject[] {
  if (tables.length === 0) return []
  const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x)
  const tolerance = sorted[0].height * 0.8
  const bands: typeof sorted[] = []
  let band: typeof sorted = [sorted[0]]
  let bandY = sorted[0].y
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - bandY) <= tolerance) {
      band.push(sorted[i])
    } else {
      bands.push(band)
      band = [sorted[i]]
      bandY = sorted[i].y
    }
  }
  bands.push(band)
  return bands.flatMap(b => b.sort((a, c) => a.x - c.x))
}

function selectRangeBetweenTables(
  anchorId: string,
  clickedId: string,
  tables: import('@/domain/types').TableObject[],
): import('@/domain/types').TableObject[] {
  const anchor = tables.find(t => t.id === anchorId)
  const clicked = tables.find(t => t.id === clickedId)
  if (!anchor || !clicked) return []

  const anchorCenter = { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 }
  const clickedCenter = { x: clicked.x + clicked.width / 2, y: clicked.y + clicked.height / 2 }
  const dx = clickedCenter.x - anchorCenter.x
  const dy = clickedCenter.y - anchorCenter.y
  const vertical = Math.abs(dy) >= Math.abs(dx)

  const orthogonalTolerance = vertical
    ? Math.max(anchor.width, clicked.width) * 0.75
    : Math.max(anchor.height, clicked.height) * 0.75

  const axisMin = vertical
    ? Math.min(anchorCenter.y, clickedCenter.y)
    : Math.min(anchorCenter.x, clickedCenter.x)
  const axisMax = vertical
    ? Math.max(anchorCenter.y, clickedCenter.y)
    : Math.max(anchorCenter.x, clickedCenter.x)

  const orthogonalMid = vertical
    ? (anchorCenter.x + clickedCenter.x) / 2
    : (anchorCenter.y + clickedCenter.y) / 2

  const aligned = tables.filter(table => {
    const center = { x: table.x + table.width / 2, y: table.y + table.height / 2 }
    const primary = vertical ? center.y : center.x
    const secondary = vertical ? center.x : center.y
    return (
      primary >= axisMin - 1 &&
      primary <= axisMax + 1 &&
      Math.abs(secondary - orthogonalMid) <= orthogonalTolerance
    )
  })

  const sorted = vertical
    ? [...aligned].sort((a, b) => (a.y + a.height / 2) - (b.y + b.height / 2) || a.x - b.x)
    : [...aligned].sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2) || a.y - b.y)

  const anchorIdx = sorted.findIndex(t => t.id === anchorId)
  const clickedIdx = sorted.findIndex(t => t.id === clickedId)
  if (anchorIdx >= 0 && clickedIdx >= 0) {
    const lo = Math.min(anchorIdx, clickedIdx)
    const hi = Math.max(anchorIdx, clickedIdx)
    return sorted.slice(lo, hi + 1)
  }

  const fallback = spatialSort(tables)
  const fallbackAnchorIdx = fallback.findIndex(t => t.id === anchorId)
  const fallbackClickedIdx = fallback.findIndex(t => t.id === clickedId)
  const lo = Math.min(fallbackAnchorIdx, fallbackClickedIdx)
  const hi = Math.max(fallbackAnchorIdx, fallbackClickedIdx)
  return fallback.slice(lo, hi + 1)
}

