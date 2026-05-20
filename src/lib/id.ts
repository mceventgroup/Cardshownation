import type {
  TableId,
  RowId,
  SectionId,
  VendorId,
  VendorAssignmentId,
  ObstacleId,
  DoorId,
  RoomSegmentId,
  RoomCircleId,
  LayoutId,
  EventId,
  ImportSessionId,
  TemplateId,
  BackgroundImageId,
} from '@/domain/types'

// All IDs use crypto.randomUUID(), which is available in all modern browsers
// and Node 18.7+. In Jest tests, mock this in jest.setup.ts if needed.
function uuid(): string {
  return crypto.randomUUID()
}

export const createTableId         = (): TableId          => uuid() as TableId
export const createRowId           = (): RowId             => uuid() as RowId
export const createSectionId       = (): SectionId         => uuid() as SectionId
export const createVendorId        = (): VendorId            => uuid() as VendorId
export const createAssignmentId    = (): VendorAssignmentId => uuid() as VendorAssignmentId
export const createObstacleId      = (): ObstacleId        => uuid() as ObstacleId
export const createDoorId          = (): DoorId            => uuid() as DoorId
export const createRoomSegmentId   = (): RoomSegmentId     => uuid() as RoomSegmentId
export const createRoomCircleId    = (): RoomCircleId      => uuid() as RoomCircleId
export const createLayoutId        = (): LayoutId          => uuid() as LayoutId
export const createEventId         = (): EventId           => uuid() as EventId
export const createImportSessionId = (): ImportSessionId   => uuid() as ImportSessionId
export const createTemplateId      = (): TemplateId        => uuid() as TemplateId
export const createBackgroundImageId = (): BackgroundImageId => uuid() as BackgroundImageId
