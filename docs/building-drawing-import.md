# Building drawing import

Open **Space → Plan → Import building drawing** (also available in the Project menu).

1. Choose a PDF, JPG/JPEG, PNG, WebP, or supported ASCII DXF.
2. Set each page's scale by clicking two endpoints and entering a known distance in feet, inches, meters, centimeters, or millimeters. Recognizable PDF text dimensions can populate the distance field; the user still selects the corresponding endpoints.
3. Review wall and pillar candidates. Trace wall centerlines (including diagonals), rectangular or round pillar footprints, and remove incorrect marks. Zoom or pan for precision.
4. Use **Room boundary** to trace inside corners and close a named room, or build rooms from connected walls. Inspect the suggested boundary before accepting it. Branching or incomplete wall networks require manual tracing.
5. Use **Edit mark** to select a wall and cut a door, exit, or open passage at a specified width and position. Choose the swing direction; flip it later in Doors and openings.
6. Confirm the review and import. No tables are detected or created.

Multi-page drawings are reviewed one page at a time. The page navigator shows which pages still need scale, and preserves each page's in-progress edits when switching pages.

Review controls include:

- **Detection area:** drag around the relevant building area, then detect again to exclude sheet borders and title blocks. It limits detection without cropping or rescaling the saved drawing.
- **Drawing contrast:** choose Faint / gray scan for lighter linework, then run detection again.
- **Edit mark:** select a wall or pillar and change its type, length, thickness, or angle. Confirm numeric changes by leaving the field. Edited marks are retained as manual corrections during redetection.
- **Wall endpoints:** drag blue handles and snap to adjoining walls. Split a wall or join adjoining straight pieces. Opening cuts split solid geometry, so the opening is not treated as a solid wall.
- **Rejected marks:** deleted, split, and corrected candidates are remembered so matching detections do not return on the next detection pass.
- **Scale verification:** after applying scale, select a second known span in another direction and choose Verify second distance. Both references persist with the drawing. Differences over 2% are flagged for review; this does not correct distorted scans.
- **Draft recovery:** review pages, geometry, measurements, detection settings, and page arrangement save to IndexedDB on this device, scoped to the show/layout. Reopen the importer to resume or discard an unfinished review. Successful import clears its draft. Browser storage errors are shown explicitly.
- **Undo/redo:** reverse scale, mark, contrast, area, deletion, clearing, and redetection changes during review (up to 30 changes per page).
- **Pan:** drag the zoomed drawing to reach details without accidentally adding marks.

Known distances also accept explicit units and fractions, including `40' 6 1/2"`, `6½ in`, and `1/2 in`.

Scale uses inches internally and a uniform transform in both axes. Each PDF page is calibrated independently. Another two-point span can be checked against the current scale. The page dimensions displayed are the entire drawing/page, including margins, not the venue's usable floor area. Photograph perspective distortion is not corrected; use a flat scan or CAD PDF.

The drawing, structures, and reviewed room polygons are saved together. Imported room boundaries participate in room selection, table numbering, placement, and boundary warnings. Their IDs remain stable as the drawing moves or changes scale. Removing the drawing removes its room polygons. Boundary area is gross area, not usable capacity after pillars, aisles, or door clearance. Room polygons are separately reviewed boundaries: if wall edits change a room shape, rebuild or retrace its boundary.

Space → Plan allows reopening the traces and scale. Drawing opacity can be set to zero while retaining structures and opening symbols in the canvas and exports. Changing scale resizes the drawing and its geometry; recheck existing table placement afterward. Table overlaps with walls/pillars and blocked opening clearance appear in layout warnings. Opening clearance checks both sides using the layout clearance setting and door width. Hiding a drawing does not remove these physical checks; remove its marks or the drawing to remove the constraints.

## Detection limits

Raster detection is a local heuristic for long horizontal/vertical dark runs and compact solid column candidates. It does not run the previous table detector. Short walls, faint linework, hollow pillars, and unusual symbols may need manual tracing. Dimension lines, page borders, and dark furniture can resemble structure: candidates must be reviewed. Round pillars use ellipse footprints, approximated with 32 vertices for collision checks and exports. Curved walls can be approximated with multiple short manual segments. Doors and exits are added manually; symbol recognition is not automated.

PDF measurement suggestions use embedded text, not OCR. Scanned PDFs and image labels require typed measurements. Supported labels include decimal feet/inches, feet-and-inches such as `40'-6"`, and metric units; unsupported labels can be entered numerically using the unit selector.

## CAD support

Native support is deliberately limited to flat ASCII DXF model-space LINE, straight LWPOLYLINE, and CIRCLE entities. Recognized wall/column layers supply structure candidates. Furniture-named layers are excluded. Unlabeled drawings use raster detection when there are no recognized structure layers. Common DXF drawing units are used when present (inches, feet, millimeters, centimeters, meters); missing/unsupported units require calibration.

DWG, binary DXF, blocks, curved polylines, other unsupported geometry, and non-planar coordinates require a dimensioned PDF export or a flattened supported 2D DXF. Unsupported entities are reported rather than silently dropped. PDF is the preferred way to retain complex architectural drawings and printed dimensions.

Files are processed in the browser. Limits: 20 MB per source file, 20 pages per PDF, 25 saved drawing pages per show, and 2,000 structure marks per page.

## Validation

- Synthetic raster fixture: four walls, one pillar, and repeated outlined tables; only structures detected.
- Browser PNG import: known 40-foot span, scale persisted through backup/save/reload, no tables created.
- Browser two-page PDF: measurement selection and independent scale requirement.
- Browser DXF: drawing units, wall/column layers, excluded furniture, no tables created.
- Schema round-trip, invalid calibration, unsupported DXF rejection, and monochrome structure export.
- Browser recovery after reload: verified scale, connected room, round pillar, exit cut, redetection without restoring the wall gap, and backup persistence.
- Unit checks for closed loops, rejected crossing/branching boundaries, split/join geometry, stable room IDs, page movement/removal, and imported opening/boundary warnings.

Real venue drawings should be used to evaluate detection quality before claiming broad accuracy.

References: [PDF.js page text API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html), [Autodesk DXF entities](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-7D07C886-FD1D-4A0C-A7AB-B4D21F18E484.htm), [Autodesk drawing units](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-A58A87BB-482B-4042-A00A-EEF55A2B4FD8.htm).
