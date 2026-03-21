// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN MODULE — PUBLIC API
//
// All types and interfaces exported from one entry point.
// Implementations live alongside their interface files (e.g., geometry.impl.ts)
// and are NOT exported here — consumers depend on interfaces, not implementations.
// ─────────────────────────────────────────────────────────────────────────────

// Core entity types and geometric primitives
export type {
  Point,
  Size,
  Rect,
  TableId,
  RowId,
  SectionId,
  VendorAssignmentId,
  ObstacleId,
  DoorId,
  RoomSegmentId,
  LayoutId,
  EventId,
  UserId,
  ImportSessionId,
  TemplateId,
  TableShape,
  TableObject,
  RowOrientation,
  Row,
  Section,
  PaymentStatus,
  VendorAssignment,
  Obstacle,
  DoorSide,
  Door,
  RoomSegment,
  CompositeRoom,
  Room,
  LayoutSettings,
  ResolvedTableColor,
} from './types'

// Command model and undo/redo
export type {
  LayoutCommand,
  CommandHistory,
  PlaceTableCommand,
  MoveTablesCommand,
  ResizeTableCommand,
  RotateTablesCommand,
  DeleteTablesCommand,
  RelabelTableCommand,
  PlaceRowCommand,
  DeleteRowCommand,
  CreateSectionCommand,
  UpdateSectionCommand,
  DeleteSectionCommand,
  AssignToSectionCommand,
  RenumberCommand,
  AssignVendorCommand,
  UpdateVendorAssignmentCommand,
  ClearVendorAssignmentCommand,
  ApplyImportCommand,
  SetRoomCommand,
  AddRoomSegmentCommand,
  UpdateRoomSegmentCommand,
  DeleteRoomSegmentCommand,
  SetFreehandRoomCommand,
  PlaceDoorCommand,
  MoveDoorCommand,
  ResizeDoorCommand,
  DeleteDoorCommand,
  UpdateSettingsCommand,
} from './commands'
export { EMPTY_HISTORY } from './commands'

// Document schema
export type {
  LayoutDocument,
  LayoutSnapshot,
  SnapshotTrigger,
  VenueTemplate,
  TemplateInstantiationResult,
  ImportSession,
  ImportSessionStatus,
  FieldMapping,
  ImportRow,
  MappedImportRow,
  ImportRowStatus,
  ImportConflict,
  ImportConflictType,
  ConflictResolution,
  ConflictSummary,
} from './document'
export { CURRENT_DOCUMENT_VERSION } from './document'

// Module interfaces
export type { BoundsResult, OverlapResult, GapResult, GeometryModule } from './geometry'
export type { SnapGuide, SnapGuideAxis, SnapGuideSource, SnapResult, SnappingModule } from './snapping'
export type { AisleViolation, DoorViolation, SpacingModule } from './spacing'
export type { RowConfig, BuiltRow, RepositionedTable, RowModule } from './rows'
export type { NumberingStyle, NumberingScheme, DuplicateLabelGroup, LabelChange, NumberingModule } from './numbering'
export { DEFAULT_NUMBERING_SCHEME } from './numbering'
export type { DistanceMeasurement, AisleMeasurement, SelectionMeasurement, MeasurementModule } from './measurement'
export type { WarningSeverity, OverlapWarning, NarrowAisleWarning, DoorBlockedWarning, DuplicateLabelWarning, UnassignedTableWarning, OutOfBoundsWarning, LayoutWarning, WarningResult, WarningsModule } from './warnings'
export { EMPTY_WARNING_RESULT } from './warnings'
export type { ParsedCSV, DetectedMapping, RowValidationError, CSVImportModule } from './csv-import'
