# SmartGeometryLab

An interactive geometry manipulative for Malaysian primary-school learners in SK and SJKC, covering Years 2–6 in Bahasa Melayu, Chinese and English.

## Teaching approach

This is a classroom tool, not a question-and-answer exercise site. Learners move, draw, fold, measure, resize and construct geometric objects while values and relationships update immediately.

- No quiz, marking or “next question” flow
- No listening or text-to-speech controls
- Click feedback sounds can be switched off
- Random examples and contextual teacher settings
- Mouse, touch and keyboard-friendly controls
- Three visible usage steps for every tool
- Values and face numbers labelled directly on diagrams
- Angle and rotation tools begin at 0°; angle rays support 1° adjustment
- Solid models can be dragged directly in true 3D; numbered faces, colour-coded numbered edges and numbered vertices remain identifiable while rotating
- The point-grid drawing board accepts individual clicks or a continuous drag across grid points, then extrudes any closed outline into a draggable 3D solid
- The Year 3 prism lab uses a draggable 3D model whose base sides and depth can be changed independently
- Cube, cuboid, pyramid and cylinder nets are available; polygonal nets keep every face connected while numbered faces fold along their shared edges
- Symmetry offers draggable everyday shapes with a live mirror as well as the optional square-grid model
- Triangle perimeter diagrams physically reshape when any side length changes
- Unit-block length, width and height guides sit beside the matching rows, columns and layers
- Maximum-size area shapes scale to stay inside the board; unit-block layers use stable back-to-front drawing order
- Composite cut-outs may leave a one-centimetre strip, including an 11 cm cut from a 12 cm outer width
- Lines and the compass pencil can be dragged directly on their diagrams
- Every range control remains continuously draggable while its diagram updates
- Responsive desktop, tablet and mobile layout

## Textbook-aligned progression

- **Year 2:** 2D/3D shape explorer, solid nets and a point-grid drawing board
- **Year 3:** prisms, regular polygon bases, symmetry and shape patterns
- **Year 4:** protractor, parallel/perpendicular lines, perimeter, grid area and unit-block volume
- **Year 5:** regular polygons, composite perimeter/area and composite volume
- **Year 6:** construction of 50°, 90° and 108° angles, polygon interior angles, circles, radius and diameter

The Year 5 and Year 6 polygon content shares one tool at different depths to avoid duplicated activities.

## Run locally

Open index.html directly in a modern browser, or serve the directory with any static HTTP server.

## Validation

tests/smoke.mjs checks:

- all 15 distinct tools and their Year 2–6 navigation
- random examples and direct manipulation of solids, lines, rays, compass arms and sliders
- click-or-drag point drawing, closed-outline 3D extrusion and the draggable Year 3 prism model
- 0° defaults, 1° protractor adjustment and continuous angle dragging
- connected step-by-step cube, cuboid and pyramid folding into draggable 3D solids
- direct numbered labels on 2D sides and corners, 3D faces, edges and vertices
- draggable stamp symmetry and the square-grid alternative
- triangle reshaping, maximum-size area containment, correctly layered unit blocks and full-sphere surface grids
- the 11 cm composite cut-out boundary case
- compass needle/pencil alignment and a traced circle that ends at the draggable pencil tip
- centred symmetry axes, visible perimeter labels, and line, area, volume, polygon and circle interactions
- contextual teacher settings
- three-language switching
- absent listening controls
- mobile overflow and background asset loading

