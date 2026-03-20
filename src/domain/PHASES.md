# Domain Model → Implementation Phase Mapping

This document maps each domain file to the implementation phase that first
requires it, and calls out any cross-phase dependencies.

---

## Phase 0 — Domain Contracts (this directory)

All files in `src/domain/` are defined here.
No implementation code exists yet. Every phase below consumes these types.

| File | What it defines |
|---|---|
| `types.ts` | All core entity types and geometric primitives |
| `commands.ts` | Command union, CommandHistory, undo boundary rules |
| `document.ts` | LayoutDocument, Snapshot, VenueTemplate, ImportSession |
| `geometry.ts` | GeometryModule interface |
| `snapping.ts` | SnappingModule interface |
| `spacing.ts` | SpacingModule interface |
| `rows.ts` | RowModule interface |
| `numbering.ts` | NumberingModule interface + NumberingScheme type |
| `measurement.ts` | MeasurementModule interface (all derived) |
| `warnings.ts` | WarningsModule interface + LayoutWarning union |
| `csv-import.ts` | CSVImportModule interface |

---

## Phase 1 — Canvas Foundation

**Implements:**
- `GeometryModule` → `geometry.impl.ts`
- `SnappingModule` → `snapping.impl.ts`
- Zustand store: canvas slice (tables, selection, history)
- Command executor: handles `PLACE_TABLE`, `MOVE_TABLES`, `RESIZE_TABLE`,
  `ROTATE_TABLES`, `DELETE_TABLES`, `RELABEL_TABLE`

**Consumes from domain:**
- `types.ts` — TableObject, Point, Rect
- `commands.ts` — PlaceTableCommand, MoveTablesCommand, ResizeTableCommand,
  RotateTablesCommand, DeleteTablesCommand, RelabelTableCommand, CommandHistory
- `geometry.ts` — GeometryModule (broad-phase overlap for hit detection)
- `snapping.ts` — SnappingModule (grid and object snap during drag)

**Does NOT need yet:**
- Row/section/numbering/warnings/vendor/import types

---

## Phase 2 — Rows and Sections

**Implements:**
- `RowModule` → `rows.impl.ts`
- Command executor: adds `PLACE_ROW`, `DELETE_ROW`, `CREATE_SECTION`,
  `UPDATE_SECTION`, `DELETE_SECTION`, `ASSIGN_TO_SECTION`
- Row builder UI calls `RowModule.buildRow` and dispatches `PlaceRowCommand`

**Consumes from domain:**
- `types.ts` — Row, Section, SectionId, RowId
- `commands.ts` — PlaceRowCommand, DeleteRowCommand, CreateSectionCommand,
  UpdateSectionCommand, DeleteSectionCommand, AssignToSectionCommand
- `rows.ts` — RowModule (full interface)
- `numbering.ts` — NumberingScheme (used in RowConfig for initial labels)

**Does NOT need yet:**
- Warnings, vendor assignment, import

---

## Phase 3 — Numbering

**Implements:**
- `NumberingModule` → `numbering.impl.ts`
- Command executor: adds `RENUMBER`, `RELABEL_TABLE`
- Auto-number fires when a row is placed (wired into RowModule.buildRow)
- Bulk renumber available from section panel and layout panel

**Consumes from domain:**
- `types.ts` — TableObject label fields
- `commands.ts` — RenumberCommand, RelabelTableCommand
- `numbering.ts` — NumberingModule (full interface)

**Depends on Phase 2:** Row and section context needed for scoped renumber.

---

## Phase 4 — Vendor Assignment Model

**Implements:**
- Command executor: adds `ASSIGN_VENDOR`, `UPDATE_VENDOR_ASSIGNMENT`,
  `CLEAR_VENDOR_ASSIGNMENT`
- Vendor panel (list view of all tables, assignment status)
- Color resolution: `ResolvedTableColor` computed at render time from
  `colorOverride` → section color → default

**Consumes from domain:**
- `types.ts` — VendorAssignment, PaymentStatus, ResolvedTableColor
- `commands.ts` — AssignVendorCommand, UpdateVendorAssignmentCommand,
  ClearVendorAssignmentCommand

**Depends on Phase 3:** Tables must have stable labels before assignment
  is meaningful (vendor-to-label mapping is what makes assignments persistent).

---

## Phase 5 — Warnings Engine

**Implements:**
- `SpacingModule` → `spacing.impl.ts`
- `WarningsModule` → `warnings.impl.ts`
- `MeasurementModule` → `measurement.impl.ts`
- Warnings computed reactively in Zustand store after every canvas mutation
- Warning panel and per-table indicators on canvas

**Consumes from domain:**
- `types.ts` — TableObject, Door, LayoutSettings
- `spacing.ts` — SpacingModule
- `measurement.ts` — MeasurementModule (aisle display overlays)
- `warnings.ts` — WarningsModule, WarningResult, all warning types

**Depends on Phase 4:** UnassignedTableWarning requires VendorAssignment data.

---

## Phase 6 — Room Border & Doors

**Implements:**
- Room boundary: drawable/resizable rectangular room outline (walls)
- Door placement: position door openings along walls with configurable width
- Door clearance zones: rectangular keep-clear area extending inward from each door
- `DoorBlocked` warning: fires when a table overlaps a door clearance zone
- Room bounds constraint: optional snap/warn when tables are placed outside the room
- Canvas rendering: wall lines, door openings, clearance zone overlays
- Command executor: adds `SET_ROOM`, `PLACE_DOOR`, `MOVE_DOOR`, `RESIZE_DOOR`,
  `DELETE_DOOR`

**Consumes from domain:**
- `types.ts` — Door, Room (new), Point, Rect
- `commands.ts` — Room/door commands (new)
- `warnings.ts` — `DoorBlocked` warning type (already defined)
- `geometry.ts` — GeometryModule (overlap detection for clearance zones)

**Depends on Phase 5:** DoorBlocked warning needs the warnings engine in place.

---

## Phase 7 — Persistence and Templates

**Implements:**
- localStorage save/load (first pass, no backend)
- LayoutDocument serializer/deserializer
- Autosave: debounced 2s after last mutation, serializes LayoutDocument
- Later: Database schema (Prisma), API routes, VenueTemplate, LayoutSnapshot

**Consumes from domain:**
- `document.ts` — LayoutDocument (serialized), LayoutSnapshot,
  VenueTemplate, TemplateInstantiationResult, CURRENT_DOCUMENT_VERSION

**NOTE:** localStorage first, backend later. Phases 1–6 can
run entirely in memory. Phase 7 adds the persistence layer underneath.

---

## Phase 8 — CSV Import

**Implements:**
- `CSVImportModule` → `csv-import.impl.ts`
- API route: create ImportSession, update field mapping, apply, revert
- Database schema: ImportSession, ImportRow
- Import flow UI: upload → field map → review → apply
- Command executor: adds `APPLY_IMPORT`

**Consumes from domain:**
- `document.ts` — ImportSession, ImportRow, FieldMapping, ConflictSummary,
  ImportSessionStatus, ConflictResolution, all conflict types
- `csv-import.ts` — CSVImportModule (full interface)
- `commands.ts` — ApplyImportCommand

**Depends on Phase 4:** VendorAssignment must exist before import can write to it.
**Depends on Phase 7:** ImportSession is persisted; the 'before-import' snapshot
  requires persistence to be in place for revert to work.

---

## Phase 9 — Export

**Implements:**
- Print route: `/print/[layoutId]` — HTML/CSS render of layout (no canvas)
- Export API route: Puppeteer renders print route → PDF
- PNG export: html2canvas on print route, client-side
- Organizer vs public view switch

**Consumes from domain:**
- `document.ts` — LayoutDocument (read from DB for print route)
- `types.ts` — TableObject, VendorAssignment, Section (render in print view)

**Depends on Phase 7:** Must be able to load a saved document to render it.
**Depends on Phase 4:** Vendor assignments render in the print view.

---

## Stored vs Derived: Quick Reference

| Data | Stored in document? | Where it comes from |
|---|---|---|
| Table geometry | Yes | `TableObject` in LayoutDocument |
| Table label | Yes | `TableObject.label` |
| Row config | Yes | `Row` in LayoutDocument |
| Section color | Yes | `Section.color` in LayoutDocument |
| Vendor assignment | Yes | `VendorAssignment` in LayoutDocument |
| Door/obstacle positions | Yes | `Door[]`, `Obstacle[]` in LayoutDocument |
| Layout settings | Yes | `LayoutSettings` in LayoutDocument |
| Overlap warnings | **No** | `WarningsModule.computeWarnings()` |
| Aisle warnings | **No** | `WarningsModule.computeWarnings()` |
| Door blocked warnings | **No** | `WarningsModule.computeWarnings()` |
| Duplicate label warnings | **No** | `WarningsModule.computeWarnings()` |
| Unassigned table warnings | **No** | `WarningsModule.computeWarnings()` |
| Snap guides | **No** | `SnappingModule.snap()` during drag |
| Aisle measurement overlay | **No** | `MeasurementModule.measureAisle()` |
| Selection bounds | **No** | `MeasurementModule.measureSelection()` |
| Table display color | **No** | Resolved from assignment → section → default |
| AABB / rotated corners | **No** | `GeometryModule.getBounds()` |
| Import conflict summary | Partially | `ConflictSummary` in `ImportSession` (summary stored; not re-derived from rows to avoid recomputing on load) |
