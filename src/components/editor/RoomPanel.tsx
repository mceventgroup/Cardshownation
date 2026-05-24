import { useMemo, useState } from 'react'
import {
  useEditorStore,
  selectRoom,
  selectSettings,
  selectSelectedSegmentId,
  selectActiveTool,
} from '@/store/index'
import type { CompositeRoom, RoomCircle, RoomSegment, RoomSegmentId } from '@/domain/types'
import { createRoomCircleId, createRoomSegmentId } from '@/lib/id'
import { formatDimension } from '@/lib/units'
import { computeRoomBounds, computeRoomContour } from '@/domain/room-contour'
import { getRoomZones } from '@/domain/room-numbering'

export default function RoomPanel() {
  const room = useEditorStore(selectRoom)
  const settings = useEditorStore(selectSettings)
  const dispatch = useEditorStore(s => s.dispatch)
  const selectedSegmentId = useEditorStore(selectSelectedSegmentId)
  const activeTool = useEditorStore(selectActiveTool)
  const setActiveTool = useEditorStore(s => s.setActiveTool)

  const [roomWidthFt, setRoomWidthFt] = useState(80)
  const [roomHeightFt, setRoomHeightFt] = useState(60)
  const [editingSegId, setEditingSegId] = useState<string | null>(null)
  const [editW, setEditW] = useState(0)
  const [editH, setEditH] = useState(0)
  const [editX, setEditX] = useState(0)
  const [editY, setEditY] = useState(0)
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set())

  const bounds = room ? computeRoomBounds(room) : null
  const roomCount = room ? computeRoomContour(room).length : 0
  const roomZones = useMemo(() => getRoomZones(room), [room])

  function handleAddAttachedSegment() {
    const w = roomWidthFt * 12
    const h = roomHeightFt * 12
    let x: number
    let y: number

    if (room && room.segments.length > 0) {
      const b = computeRoomBounds(room)!
      x = b.x + b.width
      y = b.y
    } else {
      x = Math.round((settings.canvasWidth - w) / 2)
      y = Math.round((settings.canvasHeight - h) / 2)
    }

    const segment: RoomSegment = {
      id: createRoomSegmentId(),
      x,
      y,
      width: w,
      height: h,
    }

    dispatch({
      type: 'ADD_ROOM_SEGMENT',
      segment,
      prevRoom: room,
      timestamp: Date.now(),
    })

    const maxX = x + w
    const maxY = y + h
    const padding = Math.round(Math.max(w, h) * 0.2)
    const neededW = maxX + padding
    const neededH = maxY + padding
    if (neededW > settings.canvasWidth || neededH > settings.canvasHeight) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        prev: { canvasWidth: settings.canvasWidth, canvasHeight: settings.canvasHeight },
        next: {
          canvasWidth: Math.max(settings.canvasWidth, neededW),
          canvasHeight: Math.max(settings.canvasHeight, neededH),
        },
        timestamp: Date.now(),
      })
    }
  }

  function handleAddSeparateRoom() {
    const w = roomWidthFt * 12
    const h = roomHeightFt * 12
    const { x, y } = findSeparateRoomPlacement(room, settings.canvasWidth, settings.canvasHeight, w, h)

    const segment: RoomSegment = {
      id: createRoomSegmentId(),
      x,
      y,
      width: w,
      height: h,
    }

    dispatch({
      type: 'ADD_ROOM_SEGMENT',
      segment,
      prevRoom: room,
      timestamp: Date.now(),
    })

    const padding = Math.round(Math.max(w, h) * 0.2)
    const neededW = x + w + padding
    const neededH = y + h + padding
    if (neededW > settings.canvasWidth || neededH > settings.canvasHeight) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        prev: { canvasWidth: settings.canvasWidth, canvasHeight: settings.canvasHeight },
        next: {
          canvasWidth: Math.max(settings.canvasWidth, neededW),
          canvasHeight: Math.max(settings.canvasHeight, neededH),
        },
        timestamp: Date.now(),
      })
    }
  }

  function handleCreateFirstRoom() {
    const w = roomWidthFt * 12
    const h = roomHeightFt * 12
    const padding = 0.2
    const canvasW = Math.round(w * (1 + padding * 2))
    const canvasH = Math.round(h * (1 + padding * 2))
    const x = Math.round(w * padding)
    const y = Math.round(h * padding)

    dispatch({
      type: 'UPDATE_SETTINGS',
      prev: { canvasWidth: settings.canvasWidth, canvasHeight: settings.canvasHeight },
      next: { canvasWidth: canvasW, canvasHeight: canvasH },
      timestamp: Date.now(),
    })

    const nextRoom: CompositeRoom = {
      segments: [{
        id: createRoomSegmentId(),
        x,
        y,
        width: w,
        height: h,
      }],
      circles: [],
      freehandVertices: null,
      roomLabels: { R1: 'Main Room' },
    }

    dispatch({
      type: 'SET_ROOM',
      prevRoom: room,
      nextRoom,
      timestamp: Date.now(),
    })
  }

  function handleClearRoom() {
    dispatch({
      type: 'SET_ROOM',
      prevRoom: room,
      nextRoom: null,
      timestamp: Date.now(),
    })
    setMergeSelection(new Set())
  }

  function handleDeleteSegment(seg: RoomSegment) {
    dispatch({
      type: 'DELETE_ROOM_SEGMENT',
      segment: seg,
      timestamp: Date.now(),
    })
    setMergeSelection(prev => {
      const next = new Set(prev)
      next.delete(seg.id)
      return next
    })
  }

  function handleAddCircularRoom() {
    const width = roomWidthFt * 12
    const height = roomHeightFt * 12
    const radiusX = width / 2
    const radiusY = height / 2

    if (!room || (room.segments.length === 0 && (room.circles?.length ?? 0) === 0 && !room.freehandVertices)) {
      const padding = 0.2
      const canvasW = Math.round(width * (1 + padding * 2))
      const canvasH = Math.round(height * (1 + padding * 2))
      const circle: RoomCircle = {
        id: createRoomCircleId(),
        x: Math.round(width * padding) + radiusX,
        y: Math.round(height * padding) + radiusY,
        radiusX,
        radiusY,
      }

      dispatch({
        type: 'UPDATE_SETTINGS',
        prev: { canvasWidth: settings.canvasWidth, canvasHeight: settings.canvasHeight },
        next: { canvasWidth: canvasW, canvasHeight: canvasH },
        timestamp: Date.now(),
      })

      dispatch({
        type: 'SET_ROOM',
        prevRoom: room,
        nextRoom: {
          segments: [],
          circles: [circle],
          freehandVertices: null,
          roomLabels: { R1: 'Main Room' },
        },
        timestamp: Date.now(),
      })
      return
    }

    const { x, y } = findSeparateRoomPlacement(room, settings.canvasWidth, settings.canvasHeight, width, height)
    const circle: RoomCircle = {
      id: createRoomCircleId(),
      x: x + radiusX,
      y: y + radiusY,
      radiusX,
      radiusY,
    }

    dispatch({
      type: 'SET_ROOM',
      prevRoom: room,
        nextRoom: {
          segments: room.segments,
          circles: [...(room.circles ?? []), circle],
          freehandVertices: null,
          roomLabels: room.roomLabels,
        },
        timestamp: Date.now(),
    })
  }

  function handleRenameRoom(roomId: string, label: string) {
    if (!room) return
    dispatch({
      type: 'SET_ROOM',
      prevRoom: room,
      nextRoom: {
        ...room,
        roomLabels: {
          ...(room.roomLabels ?? {}),
          [roomId]: label.trim() || roomId,
        },
      },
      timestamp: Date.now(),
    })
  }

  function startEditSegment(seg: RoomSegment) {
    setEditingSegId(seg.id)
    setEditW(Math.round(seg.width / 12))
    setEditH(Math.round(seg.height / 12))
    setEditX(Math.round(seg.x / 12))
    setEditY(Math.round(seg.y / 12))
  }

  function commitEditSegment(seg: RoomSegment) {
    const newW = editW * 12
    const newH = editH * 12
    const newX = editX * 12
    const newY = editY * 12
    if (newW !== seg.width || newH !== seg.height || newX !== seg.x || newY !== seg.y) {
      dispatch({
        type: 'UPDATE_ROOM_SEGMENT',
        segmentId: seg.id as RoomSegmentId,
        prev: { x: seg.x, y: seg.y, width: seg.width, height: seg.height },
        next: { x: newX, y: newY, width: newW, height: newH },
        timestamp: Date.now(),
      })
    }
    setEditingSegId(null)
  }

  function toggleMergeSelection(segId: string) {
    setMergeSelection(prev => {
      const next = new Set(prev)
      if (next.has(segId)) next.delete(segId)
      else next.add(segId)
      return next
    })
  }

  function handleMergeSelected() {
    if (!room) return
    const selected = room.segments.filter(seg => mergeSelection.has(seg.id))
    if (selected.length < 2) return

    const minX = Math.min(...selected.map(seg => seg.x))
    const minY = Math.min(...selected.map(seg => seg.y))
    const maxX = Math.max(...selected.map(seg => seg.x + seg.width))
    const maxY = Math.max(...selected.map(seg => seg.y + seg.height))

    const mergedSegment: RoomSegment = {
      id: createRoomSegmentId(),
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }

    dispatch({
      type: 'SET_ROOM',
      prevRoom: room,
      nextRoom: {
        segments: [
          ...room.segments.filter(seg => !mergeSelection.has(seg.id)),
          mergedSegment,
        ],
        freehandVertices: room.freehandVertices,
        roomLabels: room.roomLabels,
      },
      timestamp: Date.now(),
    })

    setMergeSelection(new Set([mergedSegment.id]))
  }

  return (
    <div className="px-3 py-2 space-y-3 text-sm">
      <div>
        <div className="font-medium text-gray-700 mb-1">Room Builder</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-8">W</label>
          <input
            type="number"
            min={10}
            max={500}
            value={roomWidthFt}
            onChange={e => setRoomWidthFt(Number(e.target.value))}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <label className="text-xs text-gray-500 w-8">D</label>
          <input
            type="number"
            min={10}
            max={500}
            value={roomHeightFt}
            onChange={e => setRoomHeightFt(Number(e.target.value))}
            className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
          />
          <span className="text-xs text-gray-400">ft</span>
        </div>
        <div className="flex gap-2 mt-1.5">
          {!room || (room.segments.length === 0 && (room.circles?.length ?? 0) === 0 && !room.freehandVertices) ? (
            <>
              <button
                onClick={handleCreateFirstRoom}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create First Room
              </button>
              <button
                onClick={handleAddCircularRoom}
                className="flex-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
              >
                Create Circle Room
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAddSeparateRoom}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Room
              </button>
              <button
                onClick={handleAddAttachedSegment}
                className="flex-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
              >
                Add Attached Area
              </button>
              <button
                onClick={handleAddCircularRoom}
                className="flex-1 px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
              >
                Add Circle Room
              </button>
            </>
          )}
          {room && (
            <button
              onClick={handleClearRoom}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>
        {roomCount > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            Connected rooms: {roomCount}
          </div>
        )}
        {roomZones.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-gray-600">Room Names</div>
            {roomZones.map(zone => (
              <label key={zone.id} className="flex items-center gap-2">
                <span className="w-12 text-xs text-gray-500">{zone.id}</span>
                <input
                  type="text"
                  value={zone.label}
                  onChange={e => handleRenameRoom(zone.id, e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                  placeholder={zone.id}
                />
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <label className="flex items-center gap-1 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={settings.roomLocked}
              onChange={e => {
                dispatch({
                  type: 'UPDATE_SETTINGS',
                  prev: { roomLocked: settings.roomLocked },
                  next: { roomLocked: e.target.checked },
                  timestamp: Date.now(),
                })
              }}
              className="w-3.5 h-3.5 rounded border-gray-300"
            />
            <span className="text-xs text-gray-500">Lock Layout</span>
          </label>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Draw on canvas: <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-0.5">B</kbd> rectangle, <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-0.5">C</kbd> circle, <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-0.5">F</kbd> freehand. Use <span className="font-medium text-gray-500">Add Room</span> for separate spaces, <span className="font-medium text-gray-500">Add Attached Area</span> to extend an existing footprint, and <span className="font-medium text-gray-500">Add Circle Room</span> for round halls or arenas.
        </div>
        <button
          onClick={() => setActiveTool(activeTool === 'split-room' ? 'select' : 'split-room')}
          disabled={!room || room.segments.length === 0}
          className={`mt-2 w-full rounded px-2 py-1.5 text-xs font-medium ${
            activeTool === 'split-room'
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          } disabled:bg-gray-100 disabled:text-gray-400`}
        >
          {activeTool === 'split-room' ? 'Exit Split Mode' : 'Split Room on Canvas'}
        </button>
        <div className="text-xs text-gray-400 mt-1">
          When <span className="font-medium text-gray-500">Lock Layout</span> is off, drag inside a room to move the whole room.
        </div>
        <div className="text-xs text-gray-400 mt-1">
          In <span className="font-medium text-gray-500">Split Room</span> mode, click inside a rectangular segment where you want the divider and drag vertically or horizontally to connect it to the opposite walls.
        </div>
      </div>

      {room && room.segments.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="font-medium text-gray-700">Segments ({room.segments.length})</div>
            <button
              onClick={handleMergeSelected}
              disabled={mergeSelection.size < 2}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
            >
              Merge Selected
            </button>
          </div>
          <div className="space-y-1">
            {room.segments.map((seg, idx) => (
              <div key={seg.id} className={`rounded px-2 py-1 ${seg.id === selectedSegmentId ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-gray-50'}`}>
                {editingSegId === seg.id ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 w-3">W</span>
                      <input
                        type="number"
                        min={5}
                        max={500}
                        value={editW}
                        onChange={e => setEditW(Number(e.target.value))}
                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      />
                      <span className="text-xs text-gray-400 w-3">D</span>
                      <input
                        type="number"
                        min={5}
                        max={500}
                        value={editH}
                        onChange={e => setEditH(Number(e.target.value))}
                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      />
                      <span className="text-xs text-gray-400">ft</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 w-3">X</span>
                      <input
                        type="number"
                        value={editX}
                        onChange={e => setEditX(Number(e.target.value))}
                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      />
                      <span className="text-xs text-gray-400 w-3">Y</span>
                      <input
                        type="number"
                        value={editY}
                        onChange={e => setEditY(Number(e.target.value))}
                        className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs"
                      />
                      <span className="text-xs text-gray-400">ft</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => commitEditSegment(seg)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingSegId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={mergeSelection.has(seg.id)}
                        onChange={() => toggleMergeSelection(seg.id)}
                      />
                      <div>
                        <span className="text-xs font-medium">Rect {idx + 1}</span>
                        <span className="text-xs text-gray-400 ml-1.5">
                          {formatDimension(seg.width)} x {formatDimension(seg.height)}
                        </span>
                        <div className="text-xs text-gray-400">
                          at ({formatDimension(seg.x)}, {formatDimension(seg.y)})
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEditSegment(seg)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSegment(seg)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {bounds && (
            <div className="text-xs text-gray-400 mt-1">
              Overall: {formatDimension(bounds.width)} x {formatDimension(bounds.height)}
            </div>
          )}
        </div>
      )}

      {room && room.freehandVertices && (
        <div>
          <div className="font-medium text-gray-700 mb-1">Freehand Room</div>
          <div className="text-xs text-gray-500">
            {room.freehandVertices.length} vertices
            {bounds && <> &middot; {formatDimension(bounds.width)} x {formatDimension(bounds.height)}</>}
          </div>
        </div>
      )}

      {room && (room.circles?.length ?? 0) > 0 && (
        <div>
          <div className="font-medium text-gray-700 mb-1">Circular Rooms ({room.circles?.length ?? 0})</div>
          <div className="space-y-1">
            {(room.circles ?? []).map((circle, idx) => (
              <div key={circle.id} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                <div>
                  <div className="text-xs font-medium">Circle {idx + 1}</div>
                  <div className="text-xs text-gray-400">
                    {formatDimension(circle.radiusX * 2)} x {formatDimension(circle.radiusY * 2)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    dispatch({
                      type: 'SET_ROOM',
                      prevRoom: room,
                      nextRoom: {
                        segments: room.segments,
                        circles: (room.circles ?? []).filter(entry => entry.id !== circle.id),
                        freehandVertices: room.freehandVertices,
                        roomLabels: room.roomLabels,
                      },
                      timestamp: Date.now(),
                    })
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function findSeparateRoomPlacement(
  room: CompositeRoom | null,
  canvasWidth: number,
  canvasHeight: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!room || (room.segments.length === 0 && (room.circles?.length ?? 0) === 0)) {
    return {
      x: Math.round((canvasWidth - width) / 2),
      y: Math.round((canvasHeight - height) / 2),
    }
  }

  const gap = 96
  const padding = 96
  const maxX = Math.max(canvasWidth + width * 4, width + padding * 2)
  const maxY = Math.max(canvasHeight + height * 4, height + padding * 2)

  for (let y = padding; y <= maxY; y += height + gap) {
    for (let x = padding; x <= maxX; x += width + gap) {
      const candidate = { x, y, width, height }
      const occupied = [
        ...room.segments.map(seg => ({ x: seg.x, y: seg.y, width: seg.width, height: seg.height })),
        ...(room.circles ?? []).map(circle => ({
          x: circle.x - circle.radiusX,
          y: circle.y - circle.radiusY,
          width: circle.radiusX * 2,
          height: circle.radiusY * 2,
        })),
      ]
      const overlaps = occupied.some(seg => rectsOverlap(candidate, seg, gap))
      if (!overlaps) return { x, y }
    }
  }

  const bounds = computeRoomBounds(room)
  return bounds
    ? { x: bounds.x + bounds.width + gap, y: bounds.y }
    : { x: padding, y: padding }
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  minGap: number,
): boolean {
  return !(
    a.x + a.width + minGap <= b.x ||
    b.x + b.width + minGap <= a.x ||
    a.y + a.height + minGap <= b.y ||
    b.y + b.height + minGap <= a.y
  )
}
