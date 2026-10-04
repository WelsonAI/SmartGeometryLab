# SmartGeometryLab

An interactive geometry manipulative for Malaysian primary-school learners in SK and SJKC, covering Years 2–6 in Bahasa Melayu, Chinese and English.

## Teaching approach

This is a classroom tool, not a question-and-answer exercise site. Learners move, draw, fold, measure, resize and construct geometric objects while values and relationships update immediately.

- No quiz, marking or “next question” flow
- No listening or text-to-speech controls
- Click feedback sounds can be switched off
- Random examples and contextual teacher settings
- Mouse, touch and keyboard-friendly controls
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
- random and direct manipulation
- protractor, symmetry, line, area, volume, polygon and circle interactions
- contextual teacher settings
- three-language switching
- absent listening controls
- mobile overflow and background asset loading

