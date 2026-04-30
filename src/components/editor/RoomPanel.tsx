import { useState } from 'react'
import {
  useEditorStore,
  selectRoom,
  selectSettings,
  selectSelectedSegmentId,
} from '@/store/index'
import type { CompositeRoom, RoomSegment, RoomSegmentId } from '@/domain/types'
import { createRoomSegmentId } from '@/lib/id'
import { formatDimension } from '@/lib/units'
import { computeRoomBounds } from '@/domain/room-contour'

export default function RoomPanel() {
  const room = useEditorStore(selectRoom)
  const settings = useEditorStore(selectSettings)
  const dispatch = useEditorStore(s => s.dispatch)
  const selectedSegmentId = useEditorStore(selectSelectedSegmentId)

  const [roomWidthFt, setRoomWidthFt] = useState(80)
  const [roomHeightFt, setRoomHeightFt] = useState(60)
  const [editingSegId, setEditingSegId] = useState<string | null>(null)
  const [editW, setEditW] = useState(0)
  const [editH, setEditH] = useState(0)
  const [editX, setEditX] = useState(0)
  const [editY, setEditY] = useState(0)
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set())

  const bounds = room ? computeRoomBounds(room) : null

  function handleAddRectSegment() {
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

  function handleSetSingleRoom() {
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
      freehandVertices: null,
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
      },
      timestamp: Date.now(),
    })

    setMergeSelection(new Set([mergedSegment.id]))
  }

  return (
    <div className="px-3 py-2 space-y-3 text-sm">
      <div>
        <div className="font-medium text-gray-700 mb-1">Add Room / Add Wall</div>
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
          {!room || room.segments.length === 0 ? (
            <button
              onClick={handleSetSingleRoom}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Set Layout
            </button>
          ) : (
            <button
              onClick={handleAddRectSegment}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Wall
            </button>
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
          Draw on canvas: <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-0.5">B</kbd> rectangle, <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-0.5">F</kbd> freehand. Lock the room to prevent accidental dragging and allow box-select over the room.
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
    </div>
  )
}
