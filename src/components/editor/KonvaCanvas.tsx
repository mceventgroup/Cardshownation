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
import { Stage, Layer, Rect, Line } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Point, TableId, DoorId } from '@/domain/types'
import { useEditorStore, selectTables, selectSelectedIds, selectSettings, selectActiveTool, selectSections, selectDuplicateTableIds, selectAssignmentMap, selectActiveVendorId, selectVendors, selectVendorAssignments, selectRoom, selectDoors, selectSelectedDoorId } from '@/store/index'
import { snapping } from '@/domain/snapping.impl'
import { geometry } from '@/domain/geometry.impl'
import { rowModule } from '@/domain/rows.impl'
import { DEFAULT_NUMBERING_SCHEME } from '@/domain/numbering'
import { createTableId, createRowId, createAssignmentId, createRoomSegmentId } from '@/lib/id'
import { DRAG_THRESHOLD, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, DRAFT_LAYOUT_ID } from '@/lib/defaults'
import { registerStage } from '@/lib/stage'
import GridLayer from './GridLayer'
import RoomLayer from './RoomLayer'
import DoorNode from './DoorNode'
import TableNode from './TableNode'
import SelectionRect from './SelectionRect'
import TransformerControl from './TransformerControl'
import InlineLabelEditor from './InlineLabelEditor'
import ShortcutsLegend from './ShortcutsLegend'
import { clampToWallSetback, pushOutOfDoorZones, computeRoomBounds } from '@/domain/room-contour'
import { useWarnings } from '@/hooks/useWarnings'
import { warningsModule } from '@/domain/warnings.impl'
import type { WarningSeverity } from '@/domain/warnings'

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

import { getNextLabelNumber } from '@/lib/labels'

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
  const vendors         = useEditorStore(selectVendors)
  const vendorAssignments = useEditorStore(selectVendorAssignments)
  const room              = useEditorStore(selectRoom)
  const doorsRecord       = useEditorStore(selectDoors)
  const selectedDoorId    = useEditorStore(selectSelectedDoorId)
  const setSelectedDoor   = useEditorStore(s => s.setSelectedDoor)

  // Store actions
  const dispatch      = useEditorStore(s => s.dispatch)
  const setSelected   = useEditorStore(s => s.setSelected)
  const addSelected   = useEditorStore(s => s.addSelected)
  const toggleSelected = useEditorStore(s => s.toggleSelected)
  const clearSelected = useEditorStore(s => s.clearSelected)
  const setStageTransform = useEditorStore(s => s.setStageTransform)

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
  }, [])

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

  function updateRoomDrawPreview(r: { x: number; y: number; width: number; height: number } | null) {
    roomDrawPreviewRef.current = r
    setRoomDrawPreview(r)
  }

  // Room drawing state (rectangle segments)
  const roomDrawRef = useRef<{ startX: number; startY: number } | null>(null)
  const [roomDrawPreview, setRoomDrawPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const roomDrawPreviewRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)

  // Freehand room drawing state
  const freehandPointsRef = useRef<Point[] | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<Point[] | null>(null)

  // Space-key pan tracking
  const isPanningRef  = useRef(false)
  const spaceHeldRef  = useRef(false)
  const panStartRef   = useRef<{ pointer: Point; stagePos: Point } | null>(null)


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

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  /** Convert a screen-space pointer position to canvas coordinates. */
  const toCanvas = useCallback((screenPos: Point): Point => {
    return {
      x: (screenPos.x - stagePos.x) / stageScale,
      y: (screenPos.y - stagePos.y) / stageScale,
    }
  }, [stagePos, stageScale])

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

    const snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
    const rowId = createRowId()

    const nextStart = getNextLabelNumber(tables)

    const { row, tables: rowTables } = rowModule.buildRow(
      {
        tableCount: cfg.tableCount,
        tableWidth: cfg.tableWidth,
        tableHeight: cfg.tableHeight,
        spacing: cfg.spacing,
        orientation: cfg.orientation,
        origin: snapped,
        sectionId: cfg.sectionId,
        numberingScheme: { ...DEFAULT_NUMBERING_SCHEME, startNumber: nextStart },
        startLabel: String(nextStart),
      },
      rowId,
    )

    dispatch({ type: 'PLACE_ROW', row, tables: rowTables, timestamp: Date.now() })
    setSelected(rowTables.map(t => t.id))
  }, [settings, tables, dispatch, setSelected])

  // ── Place table helper ─────────────────────────────────────────────────────
  // Defined before handleMouseDown so it can be listed in its dep array.

  const placeTableAt = useCallback((canvasPos: Point) => {
    const cfg = useEditorStore.getState().tableBuilderConfig
    const w = cfg?.tableWidth ?? settings.defaultTableWidth
    const h = cfg?.tableHeight ?? settings.defaultTableHeight
    let snapped = snapping.snapToGrid(
      { x: canvasPos.x - w / 2, y: canvasPos.y - h / 2 },
      settings.gridSize,
    )
    // Enforce wall setback and door clearance
    const currentRoom = useEditorStore.getState().room
    if (currentRoom) {
      if (settings.wallSetback > 0) {
        const clamped = clampToWallSetback(currentRoom, { ...snapped, width: w, height: h }, settings.wallSetback)
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
    const nextLabel = String(getNextLabelNumber(tables))
    const id = createTableId()
    dispatch({
      type: 'PLACE_TABLE',
      table: {
        id,
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
      },
      timestamp: Date.now(),
    })
    setSelected([id])
  }, [settings, tables, dispatch, setSelected])

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
      isPanningRef.current = true
      panStartRef.current  = { pointer, stagePos }
      return
    }

    // Only handle left clicks from here on
    if (e.evt.button !== 0) return

    const canvasPos = toCanvas(pointer)
    const target    = e.target
    const isTable   = target.hasName('table-rect')
    const tableId   = isTable ? (target.id() as string) : null

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

    if (activeTool === 'draw-room') {
      const snapped = snapping.snapToGrid(canvasPos, settings.gridSize)
      roomDrawRef.current = { startX: snapped.x, startY: snapped.y }
      updateRoomDrawPreview({ x: snapped.x, y: snapped.y, width: 0, height: 0 })
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

    // ── Active vendor assignment: click table to assign ──────────────────
    if (activeVendorRef.current && isTable && tableId) {
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
          // Assign (replace any existing assignment)
          const newAssignment = {
            id: createAssignmentId(),
            tableId: tableId as TableId,
            layoutId: DRAFT_LAYOUT_ID,
            vendorId: vid,
            vendorName: vendor.name,
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
        }
      }
      return
    }

    // Select tool
    if (isTable && tableId) {
      // Start potential drag on a table
      const isSelected = selectedIds.has(tableId)

      if (!e.evt.shiftKey) {
        if (!isSelected) {
          // Replace selection with just this table
          setSelected([tableId])
        }
        // If already selected (possibly multi), keep selection so the whole
        // group can be dragged. A click without drag will not change selection.
      } else {
        // Shift+click: range-select within a row, or toggle
        const clickedTable = tables[tableId]
        // Find an anchor table from current selection
        const anchorId = [...selectedIds].find(id => tables[id])
        const anchorTable = anchorId ? tables[anchorId] : null

        if (
          clickedTable && anchorTable &&
          clickedTable.rowId && anchorTable.rowId &&
          clickedTable.rowId === anchorTable.rowId
        ) {
          // Same row — select all tables between anchor and clicked (by order)
          const rowId = clickedTable.rowId
          const rowTables = Object.values(tables)
            .filter(t => t.rowId === rowId)
            .sort((a, b) => a.order - b.order)
          const anchorOrder = anchorTable.order
          const clickedOrder = clickedTable.order
          const minOrder = Math.min(anchorOrder, clickedOrder)
          const maxOrder = Math.max(anchorOrder, clickedOrder)
          const rangeIds = rowTables
            .filter(t => t.order >= minOrder && t.order <= maxOrder)
            .map(t => t.id)
          setSelected(rangeIds)
        } else {
          toggleSelected(tableId)
        }
      }

      // Drag tracks either the full current selection (no-shift) or just the
      // clicked table (shift), because the shift selection isn't committed yet.
      const dragIds = e.evt.shiftKey
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
      // Clicked on something that is not a table (empty canvas, transformer
      // anchor, grid, etc.).  Only start a fresh drag-select when shift is NOT
      // held; with shift held we leave the existing selection intact and just
      // don't start a drag-select (future: shift-drag could extend selection).
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
  }, [activeTool, selectedIds, tables, settings, toCanvas, setSelected, toggleSelected, clearSelected, stagePos, placeTableAt, placeRowAt])

  // ── Mouse move ─────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
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
      updateRoomDrawPreview({
        x: Math.min(startX, snapped.x),
        y: Math.min(startY, snapped.y),
        width: Math.abs(snapped.x - startX),
        height: Math.abs(snapped.y - startY),
      })
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
        if (settings.wallSetback > 0) {
          const clamped = clampToWallSetback(
            currentRoom,
            { x: snappedPos.x, y: snappedPos.y, width: primaryTable.width, height: primaryTable.height },
            settings.wallSetback,
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

    // Selection rect update — read from ref to avoid stale closure
    if (selectionStateRef.current) {
      updateSelectionState({ ...selectionStateRef.current, currentX: canvasPos.x, currentY: canvasPos.y })
    }
  }, [toCanvas, tables, settings, stageScale, setStageTransform])

  // ── Mouse up ───────────────────────────────────────────────────────────────

  const handleMouseUp = useCallback(() => {
    // End panning
    if (isPanningRef.current) {
      isPanningRef.current = false
      panStartRef.current  = null
      return
    }

    // Commit room draw — adds a rectangular segment to the composite room
    const drawPreview = roomDrawPreviewRef.current
    if (roomDrawRef.current && drawPreview) {
      roomDrawRef.current = null
      if (drawPreview.width >= 24 && drawPreview.height >= 24) {
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
  }, [draftPositions, tables, dispatch, setSelected])

  // ── Cursor style ───────────────────────────────────────────────────────────

  const cursorClass = isPanningRef.current
    ? 'canvas-panning'
    : spaceHeldRef.current
      ? 'canvas-pan'
      : (activeTool === 'place-table' || activeTool === 'place-row')
        ? 'canvas-place'
        : (activeTool === 'draw-room' || activeTool === 'draw-room-freehand')
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

  const handleStageDblClick = useCallback((_e: KonvaEventObject<MouseEvent>) => {
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

  const doorList = useMemo(() => Object.values(doorsRecord), [doorsRecord])

  // ── Room bounds for door positioning ─────────────────────────────────────

  const roomBounds = useMemo(() => {
    if (!room) return null
    return computeRoomBounds(room)
  }, [room])

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

  // ── Table list for rendering ───────────────────────────────────────────────

  const tableList = Object.values(tables)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${cursorClass}`}
      style={{ background: '#e2e8f0' }}
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
        <GridLayer
          width={settings.canvasWidth}
          height={settings.canvasHeight}
          gridSize={settings.gridSize}
        />

        {/* Room boundary, doors, and clearance zones */}
        <Layer listening={false}>
          <RoomLayer
            room={room}
            doors={doorList}
            doorClearance={settings.doorClearance}
            wallSetback={settings.wallSetback}
            showWallSetback={settings.showWallSetback}
          />
        </Layer>

        {/* Tables */}
        <Layer>
          {tableList.map(table => {
            const assignment = assignmentMap.get(table.id)
            const sectionColor = table.sectionId ? sections[table.sectionId]?.color : undefined
            const assignedColor = assignment ? '#d1fae5' : undefined  // light green when vendor assigned
            const fillColor = assignment?.colorOverride ?? sectionColor ?? assignedColor

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
                isDuplicate={duplicateIds.has(table.id)}
                warningSeverity={warningSeverity}
                draftPos={draftPositions[table.id] ?? null}
                fillColor={fillColor}
                vendorName={undefined}
                onRegister={registerNode}
                onDoubleClick={handleTableDoubleClick}
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
        {roomBounds && doorList.length > 0 && (
          <Layer>
            {doorList.map(door => (
              <DoorNode
                key={door.id}
                door={door}
                bounds={roomBounds}
                isSelected={selectedDoorId === door.id}
                gridSize={settings.gridSize}
                unitLabel={settings.unitLabel}
                onDragEnd={handleDoorDragEnd}
                onClick={setSelectedDoor}
              />
            ))}
          </Layer>
        )}

        {/* Overlay: selection rect */}
        {selectionState && (
          <Layer listening={false}>
            <SelectionRect selectionState={selectionState} />
          </Layer>
        )}

        {/* Overlay: room draw preview (rectangle segment) */}
        {roomDrawPreview && roomDrawPreview.width > 0 && roomDrawPreview.height > 0 && (
          <Layer listening={false}>
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
      </Stage>

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
    </div>
  )
}

