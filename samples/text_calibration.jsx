// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL:
// TEXT CALIBRATION MATRIX (8x5 = 40 TEXT BOXES) v1.0
// =============================================================================
//
// PURPOSE:
//   Creates a comprehensive 8x5 matrix of 40 distinct paragraph text boxes in
//   a 1920x1080 composition to benchmark, calibrate, and compare the visual
//   and geometric outcome between native Adobe After Effects and the Web AE
//   JSX Emulator.
//
// MATRIX ARCHITECTURE (8 Columns x 5 Rows = 40 Cells):
//   - 8 Columns (Font Families & Metrics):
//     Col 0: Arial / Helvetica (Standard Neo-grotesque Sans)
//     Col 1: Georgia (Transitional Serif with tall ascenders/descenders)
//     Col 2: Times New Roman (Classic Compact Serif)
//     Col 3: Courier New (Uniform Monospace advance width)
//     Col 4: Verdana (Wide Sans-Serif with high x-height)
//     Col 5: Trebuchet MS (Humanist Sans-Serif with geometric open counters)
//     Col 6: Impact (Heavy Condensed Display Sans)
//     Col 7: Segoe UI / Myriad Pro (Contemporary UI Sans-Serif)
//
//   - 5 Rows (Alignments, Indents & Typographic Variations):
//     Row 0: Left Justified (LEFT_JUSTIFY) + Zero Indents (0px) + Auto Leading
//     Row 1: Center Justified (CENTER_JUSTIFY) + Symmetric Margins (8px) + Tracking (+10)
//     Row 2: Right Justified (RIGHT_JUSTIFY) + Right Margin Indent (14px) + Fixed Leading
//     Row 3: First-Line Indents (+24px) & Hanging Outdents (leftIndent: 18px, firstLineIndent: -18px)
//     Row 4: Advanced Synthesis (Faux Bold, Faux Italic, All Caps, Outlines, Tracking, Baseline Shift)
//
// CALIBRATION & COMPARISON GUIDES PER CELL:
//   1. Reference Bounding Card (Shape Layer): Shows exact boxTextSize [w, h].
//   2. Origin Marker [0, 0]: Small crosshair at layer anchor point.
//   3. Header Badge: Shows [Col, Row], Font Name, Alignment, and Indent values.
//   4. Dynamic sourceRectAtTime Outline (Cyan): Live expression-linked bounding box
//      measuring sourceRectAtTime(time, false) in both AE and the Emulator.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6 through CC 2026+ (ExtendScript ES3 engine).
//   - Web AE JSX & ScriptUI Simulator runtime (with AETextCalibration engine).
//   - Dockable ScriptUI panel or standalone script execution.
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_NAME = "AE Text Calibration Matrix";
    var SCRIPT_VERSION = "v1.0";
    var COMP_WIDTH = 1920;
    var COMP_HEIGHT = 1080;
    var COMP_FPS = 30;
    var COMP_DURATION = 10.0;

    var NUM_COLS = 8;
    var NUM_ROWS = 5;

    // Grid layout parameters within 1920x1080
    var GRID_LEFT = 40;
    var GRID_TOP = 88;
    var GRID_WIDTH = 1840;
    var GRID_HEIGHT = 940;

    var COL_WIDTH = Math.floor(GRID_WIDTH / NUM_COLS); // 230px
    var BOX_WIDTH = 214;
    var GAP_X = COL_WIDTH - BOX_WIDTH; // 16px

    var ROW_HEIGHT = Math.floor(GRID_HEIGHT / NUM_ROWS); // 188px
    var BOX_HEIGHT = 164;
    var GAP_Y = ROW_HEIGHT - BOX_HEIGHT; // 24px

    // -------------------------------------------------------------------------
    // 1. Column Font Definitions (8 System Fonts)
    // -------------------------------------------------------------------------
    var FONT_COLUMNS = [
        { id: "arial",     name: "Arial",          postScript: "ArialMT",          label: "Arial",       category: "Sans" },
        { id: "georgia",   name: "Georgia",        postScript: "Georgia",          label: "Georgia",     category: "Serif" },
        { id: "times",     name: "Times New Roman",postScript: "TimesNewRomanPSMT", label: "Times NR",   category: "Serif" },
        { id: "courier",   name: "Courier New",    postScript: "CourierNewPSMT",   label: "Courier",     category: "Mono" },
        { id: "verdana",   name: "Verdana",        postScript: "Verdana",          label: "Verdana",     category: "Sans" },
        { id: "trebuchet", name: "Trebuchet MS",   postScript: "TrebuchetMS",      label: "Trebuchet",   category: "Humanist" },
        { id: "impact",    name: "Impact",         postScript: "Impact",           label: "Impact",      category: "Display" },
        { id: "segoe",     name: "Segoe UI",       postScript: "SegoeUI",          label: "Segoe UI",    category: "Modern" }
    ];

    // -------------------------------------------------------------------------
    // 2. Row Specification Definitions (5 Alignment & Indent Modes)
    // -------------------------------------------------------------------------
    var ROW_SPECS = [
        {
            row: 0,
            title: "Row 0: Left Justify • Indent 0px • Regular",
            shortTitle: "Left (0px Indent)",
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.LEFT_JUSTIFY !== undefined)
                ? ParagraphJustification.LEFT_JUSTIFY : 7412,
            justName: "Left",
            firstLineIndent: 0,
            leftIndent: 0,
            rightIndent: 0,
            fontSize: 12.5,
            leading: 0, // Auto leading
            tracking: 0,
            textColor: [0.90, 0.93, 0.97],
            badgeColor: [0.35, 0.55, 0.85]
        },
        {
            row: 1,
            title: "Row 1: Center Justify • Margins 8px • Tracking +10",
            shortTitle: "Center (8px Margins)",
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.CENTER_JUSTIFY !== undefined)
                ? ParagraphJustification.CENTER_JUSTIFY : 7414,
            justName: "Center",
            firstLineIndent: 0,
            leftIndent: 8,
            rightIndent: 8,
            fontSize: 12.5,
            leading: 16,
            tracking: 10,
            textColor: [0.45, 0.75, 1.0],
            badgeColor: [0.25, 0.65, 0.95]
        },
        {
            row: 2,
            title: "Row 2: Right Justify • Right Indent 14px",
            shortTitle: "Right (14px Right Ind)",
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.RIGHT_JUSTIFY !== undefined)
                ? ParagraphJustification.RIGHT_JUSTIFY : 7413,
            justName: "Right",
            firstLineIndent: 0,
            leftIndent: 0,
            rightIndent: 14,
            fontSize: 12.0,
            leading: 15.5,
            tracking: 0,
            textColor: [0.55, 0.88, 0.65],
            badgeColor: [0.35, 0.75, 0.45]
        },
        {
            row: 3,
            title: "Row 3: Paragraph Indent (+24px) / Hanging Indent (-18px)",
            shortTitle: "Paragraph & Hanging Indents",
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.LEFT_JUSTIFY !== undefined)
                ? ParagraphJustification.LEFT_JUSTIFY : 7412,
            justName: "Left",
            firstLineIndent: 24, // Modified per-column below
            leftIndent: 0,
            rightIndent: 0,
            fontSize: 12.0,
            leading: 15.0,
            tracking: 0,
            textColor: [1.0, 0.75, 0.35],
            badgeColor: [0.95, 0.60, 0.20]
        },
        {
            row: 4,
            title: "Row 4: Advanced Synthesis (Bold, Italic, Outline, AllCaps)",
            shortTitle: "Styles & Typo Synthesis",
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.LEFT_JUSTIFY !== undefined)
                ? ParagraphJustification.LEFT_JUSTIFY : 7412,
            justName: "Style Mix",
            firstLineIndent: 0,
            leftIndent: 0,
            rightIndent: 0,
            fontSize: 12.0,
            leading: 16.0,
            tracking: 0,
            textColor: [0.95, 0.50, 0.75],
            badgeColor: [0.85, 0.35, 0.65]
        }
    ];

    // Standard high-efficiency pangram containing all 26 alphabetic letters,
    // ascenders (h, b, d, k, l, t, f), descenders (g, j, p, q, y), caps, and numerals:
    var CALIBRATION_TEXT = "The quick brown fox jumps over the lazy dog. Calibration: Q,g,y,j,f,t. 0123456789.";

    // -------------------------------------------------------------------------
    // 3. Main Calibration Environment Builder
    // -------------------------------------------------------------------------
    function buildCalibrationMatrix(options) {
        options = options || {};
        var showOutlines = (options.showOutlines !== undefined) ? options.showOutlines : true;

        app.beginUndoGroup("Build AE Text Calibration Matrix");

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            comp = app.project.items.addComp("AE_Text_Calibration_Matrix_8x5", COMP_WIDTH, COMP_HEIGHT, 1.0, COMP_DURATION, COMP_FPS);
        }

        // 1. Background Solid Plate
        var bgPlate = comp.layers.addShape();
        bgPlate.name = "CALIB_Background_Plate";
        bgPlate.transform.position.setValue([COMP_WIDTH / 2, COMP_HEIGHT / 2, 0]);
        var bgVectors = bgPlate.property("Contents") || bgPlate.property("ADBE Root Vectors Group");
        var bgGroup = bgVectors.addProperty("ADBE Vector Group");
        bgGroup.name = "Dark Backdrop";
        var bgContents = bgGroup.property("Contents") || bgGroup.property("ADBE Vectors Group");
        var bgRect = bgContents.addProperty("ADBE Vector Shape - Rect");
        bgRect.property("Size").setValue([COMP_WIDTH, COMP_HEIGHT]);
        var bgFill = bgContents.addProperty("ADBE Vector Graphic - Fill");
        bgFill.property("Color").setValue([0.06, 0.07, 0.09]);

        // 2. Header Title and Legend
        var titleLayer = comp.layers.addText("ADOBE AFTER EFFECTS / EMULATOR TEXT CALIBRATION MATRIX (8x5 = 40 BOXES)");
        titleLayer.name = "CALIB_00_Header_Title";
        titleLayer.transform.position.setValue([GRID_LEFT, 36, 0]);
        setupSimpleText(titleLayer, "ADOBE AFTER EFFECTS / EMULATOR TEXT CALIBRATION MATRIX (8x5 = 40 BOXES)", "Segoe UI", 16, [1.0, 1.0, 1.0], "left");

        var subTitleLayer = comp.layers.addText("Compare native AE font rendering vs Emulator | Cyan outline = sourceRectAtTime() bounds | Gray card = boxTextSize");
        subTitleLayer.name = "CALIB_00_Header_Subtitle";
        subTitleLayer.transform.position.setValue([GRID_LEFT, 56, 0]);
        setupSimpleText(subTitleLayer, "Compare native AE font rendering vs Emulator | Cyan outline = sourceRectAtTime() bounds | Gray card = boxTextSize", "Segoe UI", 11, [0.55, 0.65, 0.78], "left");

        // Top Column Headers (Font Names)
        for (var col = 0; col < NUM_COLS; col++) {
            var colX = GRID_LEFT + (col * COL_WIDTH) + (BOX_WIDTH / 2);
            var colInfo = FONT_COLUMNS[col];
            var colHeadLyr = comp.layers.addText("[" + col + "] " + colInfo.label);
            colHeadLyr.name = "CALIB_ColHead_" + col + "_" + colInfo.id;
            colHeadLyr.transform.position.setValue([colX, 74, 0]);
            setupSimpleText(colHeadLyr, "[" + col + "] " + colInfo.label, "Segoe UI", 11, [0.45, 0.80, 1.0], "center");
        }

        // Store cell information for inspection
        var cellsRegistry = [];

        // 3. Iterate 8 Columns x 5 Rows to construct the 40 calibration cells
        for (var row = 0; row < NUM_ROWS; row++) {
            var rowSpec = ROW_SPECS[row];
            var cellY = GRID_TOP + (row * ROW_HEIGHT);

            for (var c = 0; c < NUM_COLS; c++) {
                var cellX = GRID_LEFT + (c * COL_WIDTH);
                var fontInfo = FONT_COLUMNS[c];
                var cellKey = "C" + c + "_R" + row;
                var cellPrefix = "CALIB_" + cellKey;

                // Adjust specific parameters per cell
                var cellFirstLineIndent = rowSpec.firstLineIndent;
                var cellLeftIndent = rowSpec.leftIndent;
                var cellRightIndent = rowSpec.rightIndent;
                var cellFauxBold = false;
                var cellFauxItalic = false;
                var cellAllCaps = false;
                var cellApplyStroke = false;
                var cellStrokeWidth = 1;
                var cellStrokeColor = [0.3, 0.85, 1.0];
                var cellBaselineShift = 0;
                var cellTracking = rowSpec.tracking;
                var cellFontSize = rowSpec.fontSize;
                var cellLeading = rowSpec.leading;

                // Row 3 variations: alternate paragraph indent (+24px) and hanging outdent (-18px / leftIndent: 18px)
                if (row === 3) {
                    if (c % 2 === 0) {
                        cellFirstLineIndent = 24;
                        cellLeftIndent = 0;
                    } else {
                        cellFirstLineIndent = -18;
                        cellLeftIndent = 18;
                    }
                }

                // Row 4 variations: advanced typography synthesis
                if (row === 4) {
                    if (c === 0) { // Arial: Faux Bold + Tracking
                        cellFauxBold = true;
                        cellTracking = 35;
                    } else if (c === 1) { // Georgia: Faux Italic
                        cellFauxItalic = true;
                        cellTracking = 15;
                    } else if (c === 2) { // Times: All Caps
                        cellAllCaps = true;
                        cellTracking = 40;
                        cellFontSize = 10.5;
                        cellLeading = 14.5;
                    } else if (c === 3) { // Courier: Outline stroke
                        cellApplyStroke = true;
                        cellStrokeWidth = 0.8;
                        cellStrokeColor = [0.35, 0.90, 1.0];
                    } else if (c === 4) { // Verdana: Faux Bold + Negative tracking
                        cellFauxBold = true;
                        cellTracking = -15;
                    } else if (c === 5) { // Trebuchet: Baseline shift + Loose leading
                        cellBaselineShift = 2.5;
                        cellLeading = 17.5;
                    } else if (c === 6) { // Impact: Heavy display
                        cellTracking = 25;
                        cellFontSize = 13.0;
                    } else if (c === 7) { // Segoe UI: Bold + Italic synthesis
                        cellFauxBold = true;
                        cellFauxItalic = true;
                    }
                }

                // A. Background Reference Card for this cell
                var cardLayer = comp.layers.addShape();
                cardLayer.name = cellPrefix + "_Card";
                cardLayer.transform.position.setValue([cellX + BOX_WIDTH / 2, cellY + BOX_HEIGHT / 2, 0]);

                var cardVectors = cardLayer.property("Contents") || cardLayer.property("ADBE Root Vectors Group");
                var cardGroup = cardVectors.addProperty("ADBE Vector Group");
                cardGroup.name = "Cell Box Card";

                var cardContents = cardGroup.property("Contents") || cardGroup.property("ADBE Vectors Group");
                var cardRect = cardContents.addProperty("ADBE Vector Shape - Rect");
                cardRect.property("Size").setValue([BOX_WIDTH, BOX_HEIGHT]);

                var cardFill = cardContents.addProperty("ADBE Vector Graphic - Fill");
                cardFill.property("Color").setValue([0.10, 0.12, 0.16]);

                var cardStroke = cardContents.addProperty("ADBE Vector Graphic - Stroke");
                cardStroke.property("Color").setValue([0.18, 0.22, 0.30]);
                cardStroke.property("Stroke Width").setValue(1);

                // Origin tick indicator [0, 0] of the text box
                var tickGroup = cardVectors.addProperty("ADBE Vector Group");
                tickGroup.name = "Origin Crosshair";
                var tickContents = tickGroup.property("Contents") || tickGroup.property("ADBE Vectors Group");
                var tickRect = tickContents.addProperty("ADBE Vector Shape - Rect");
                tickRect.property("Size").setValue([4, 4]);
                tickRect.property("Position").setValue([-BOX_WIDTH / 2, -BOX_HEIGHT / 2]);
                var tickFill = tickContents.addProperty("ADBE Vector Graphic - Fill");
                tickFill.property("Color").setValue(rowSpec.badgeColor);

                // B. Cell Header Badge (Small indicator text)
                var badgeLayer = comp.layers.addText("[" + cellKey + "] " + fontInfo.label);
                badgeLayer.name = cellPrefix + "_Badge";
                badgeLayer.transform.position.setValue([cellX + 4, cellY + 12, 0]);
                setupSimpleText(badgeLayer, "[" + cellKey + "] " + fontInfo.label + " | " + rowSpec.justName, "Segoe UI", 9.0, rowSpec.badgeColor, "left");

                // C. Paragraph Box Text Layer (The core calibration subject)
                var textBoxHeight = BOX_HEIGHT - 20; // Room for top badge
                var textLayer = comp.layers.addText(CALIBRATION_TEXT);
                textLayer.name = cellPrefix + "_Text";
                textLayer.transform.position.setValue([cellX, cellY + 18, 0]);

                // Apply comprehensive text document attributes
                setupCalibratedTextDocument(textLayer, {
                    text: CALIBRATION_TEXT,
                    fontName: fontInfo.name,
                    postScript: fontInfo.postScript,
                    fontSize: cellFontSize,
                    fontColor: rowSpec.textColor,
                    justification: rowSpec.justification,
                    boxWidth: BOX_WIDTH,
                    boxHeight: textBoxHeight,
                    firstLineIndent: cellFirstLineIndent,
                    leftIndent: cellLeftIndent,
                    rightIndent: cellRightIndent,
                    leading: cellLeading,
                    tracking: cellTracking,
                    baselineShift: cellBaselineShift,
                    fauxBold: cellFauxBold,
                    fauxItalic: cellFauxItalic,
                    allCaps: cellAllCaps,
                    applyStroke: cellApplyStroke,
                    strokeWidth: cellStrokeWidth,
                    strokeColor: cellStrokeColor
                });

                // D. Dynamic sourceRectAtTime Bounding Outline (Cyan)
                if (showOutlines) {
                    var boundLayer = comp.layers.addShape();
                    boundLayer.name = cellPrefix + "_SourceRect_Bound";

                    var boundVectors = boundLayer.property("Contents") || boundLayer.property("ADBE Root Vectors Group");
                    var boundGroup = boundVectors.addProperty("ADBE Vector Group");
                    boundGroup.name = "sourceRect Bounds";

                    var boundContents = boundGroup.property("Contents") || boundGroup.property("ADBE Vectors Group");
                    var boundRect = boundContents.addProperty("ADBE Vector Shape - Rect");
                    var boundStroke = boundContents.addProperty("ADBE Vector Graphic - Stroke");

                    boundStroke.property("Color").setValue([0.0, 0.90, 1.0]); // Vivid cyan
                    boundStroke.property("Stroke Width").setValue(1.0);
                    boundStroke.property("Opacity").setValue(65);

                    // Link Size to dynamic sourceRectAtTime().width & height
                    var targetNameEscaped = textLayer.name.replace(/"/g, '\\"');
                    var sizeExpr = [
                        'var target = thisComp.layer("' + targetNameEscaped + '");',
                        'var r = target.sourceRectAtTime(time, false);',
                        '[Math.max(2, r.width), Math.max(2, r.height)];'
                    ].join("\n");
                    boundRect.property("Size").expression = sizeExpr;

                    // Link Position to dynamic visual center
                    var posExpr = [
                        'var target = thisComp.layer("' + targetNameEscaped + '");',
                        'var r = target.sourceRectAtTime(time, false);',
                        'target.toComp([r.left + r.width / 2, r.top + r.height / 2]);'
                    ].join("\n");
                    boundLayer.property("Transform").property("Position").expression = posExpr;
                }

                // Register cell metadata
                cellsRegistry.push({
                    key: cellKey,
                    col: c,
                    row: row,
                    font: fontInfo.name,
                    alignment: rowSpec.justName,
                    firstLineIndent: cellFirstLineIndent,
                    leftIndent: cellLeftIndent,
                    rightIndent: cellRightIndent,
                    boxWidth: BOX_WIDTH,
                    boxHeight: textBoxHeight
                });
            }
        }

        app.endUndoGroup();

        return {
            success: true,
            compName: comp.name,
            totalBoxes: cellsRegistry.length,
            cells: cellsRegistry
        };
    }

    // -------------------------------------------------------------------------
    // 4. Helper Text Document Setup Functions
    // -------------------------------------------------------------------------
    function setupSimpleText(textLayer, textStr, fontName, fontSize, fontColor, justification) {
        try {
            var prop = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
            var docProp = prop ? (prop.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
            if (docProp) {
                var doc = docProp.value;
                if (doc) {
                    doc.text = textStr;
                    doc.fontSize = fontSize;
                    if (fontName) {
                        try { doc.font = fontName; } catch (eF) {}
                    }
                    doc.fillColor = fontColor || [1, 1, 1];
                    doc.applyFill = true;
                    doc.applyStroke = false;
                    if (justification === "center") {
                        try { doc.justification = (typeof ParagraphJustification !== "undefined" && ParagraphJustification.CENTER_JUSTIFY !== undefined) ? ParagraphJustification.CENTER_JUSTIFY : 7414; } catch (eJ) {}
                    } else if (justification === "right") {
                        try { doc.justification = (typeof ParagraphJustification !== "undefined" && ParagraphJustification.RIGHT_JUSTIFY !== undefined) ? ParagraphJustification.RIGHT_JUSTIFY : 7413; } catch (eJ) {}
                    } else {
                        try { doc.justification = (typeof ParagraphJustification !== "undefined" && ParagraphJustification.LEFT_JUSTIFY !== undefined) ? ParagraphJustification.LEFT_JUSTIFY : 7412; } catch (eJ) {}
                    }
                    docProp.setValue(doc);
                }
            }
        } catch (err) {}
    }

    function setupCalibratedTextDocument(textLayer, params) {
        try {
            var prop = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
            var docProp = prop ? (prop.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
            if (!docProp) return;

            var doc = docProp.value;
            if (!doc) return;

            doc.text = params.text;
            doc.fontSize = params.fontSize;

            // Set font with PostScript name fallback
            if (params.fontName) {
                try {
                    doc.font = params.fontName;
                } catch (eF1) {
                    if (params.postScript) {
                        try { doc.font = params.postScript; } catch (eF2) {}
                    }
                }
            }

            doc.fillColor = params.fontColor || [1, 1, 1];
            doc.applyFill = true;

            // Strokes
            if (params.applyStroke) {
                doc.applyStroke = true;
                doc.strokeColor = params.strokeColor || [0, 0, 0];
                doc.strokeWidth = params.strokeWidth || 1;
            } else {
                doc.applyStroke = false;
            }

            // Justification
            if (params.justification !== undefined) {
                try { doc.justification = params.justification; } catch (eJ) {}
            }

            // Paragraph Box Dimensions
            if (params.boxWidth > 0 && params.boxHeight > 0) {
                try {
                    if (typeof doc.setBoxTextSize === "function") {
                        doc.setBoxTextSize([params.boxWidth, params.boxHeight]);
                    } else {
                        doc.boxTextSize = [params.boxWidth, params.boxHeight];
                        doc.boxText = true;
                    }
                } catch (eBox) {}
            }

            // Paragraph Indents
            if (params.firstLineIndent !== undefined) {
                try { doc.firstLineIndent = params.firstLineIndent; } catch (eInd) {}
            }
            if (params.leftIndent !== undefined) {
                try { doc.leftIndent = params.leftIndent; } catch (eInd) {}
            }
            if (params.rightIndent !== undefined) {
                try { doc.rightIndent = params.rightIndent; } catch (eInd) {}
            }

            // Typography Metrics & Synthesis
            if (params.leading > 0) {
                try {
                    doc.leading = params.leading;
                    doc.autoLeading = false;
                } catch (eL) {}
            } else {
                try { doc.autoLeading = true; } catch (eL) {}
            }

            if (params.tracking !== undefined) {
                try { doc.tracking = params.tracking; } catch (eT) {}
            }
            if (params.baselineShift !== undefined) {
                try { doc.baselineShift = params.baselineShift; } catch (eBs) {}
            }
            if (params.fauxBold !== undefined) {
                try { doc.fauxBold = params.fauxBold; } catch (eFb) {}
            }
            if (params.fauxItalic !== undefined) {
                try { doc.fauxItalic = params.fauxItalic; } catch (eFi) {}
            }
            if (params.allCaps !== undefined) {
                try { doc.allCaps = params.allCaps; } catch (eAc) {}
            }

            // Set back to TextDocument property
            docProp.setValue(doc);

            // Also mirror directly onto layer if layer supports direct properties
            try {
                if (typeof textLayer.setBoxTextSize === "function") {
                    textLayer.setBoxTextSize([params.boxWidth, params.boxHeight]);
                }
                if (params.firstLineIndent !== undefined) textLayer.firstLineIndent = params.firstLineIndent;
                if (params.leftIndent !== undefined) textLayer.leftIndent = params.leftIndent;
                if (params.rightIndent !== undefined) textLayer.rightIndent = params.rightIndent;
                if (params.tracking !== undefined) textLayer.tracking = params.tracking;
                if (params.leading !== undefined) textLayer.leading = params.leading;
                if (params.fauxBold !== undefined) textLayer.fauxBold = params.fauxBold;
                if (params.fauxItalic !== undefined) textLayer.fauxItalic = params.fauxItalic;
                if (params.allCaps !== undefined) textLayer.allCaps = params.allCaps;
            } catch (eLProps) {}

        } catch (err) {}
    }

    // -------------------------------------------------------------------------
    // 5. ScriptUI Dialog / Panel Interface
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, { resizeable: true });

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 10;

    // Header Panel
    var pnlHead = win.add("panel", undefined, "Benchmark Rig");
    pnlHead.orientation = "column";
    pnlHead.alignChildren = ["fill", "top"];
    pnlHead.spacing = 3;

    var lblTitle = pnlHead.add("statictext", undefined, "📐 AE Text Offset Calibration Suite");
    try { lblTitle.graphics.font = ScriptUI.newFont("Verdana", "Bold", 12); } catch (eF) {}

    var lblDesc = pnlHead.add("statictext", undefined, "Creates 8x5 matrix of 40 text boxes comparing AE vs Emulator.");
    var lblParity = pnlHead.add("statictext", undefined, "Verifies sourceRectAtTime(), baseline, descent, and indents.");

    // Options Group
    var pnlOpts = win.add("panel", undefined, "Calibration Options");
    pnlOpts.orientation = "column";
    pnlOpts.alignChildren = ["left", "top"];
    pnlOpts.spacing = 4;

    var chkOutlines = pnlOpts.add("checkbox", undefined, "Draw Live sourceRectAtTime() Cyan Bounds");
    chkOutlines.value = true;
    chkOutlines.helpTip = "Adds expression-linked cyan rectangle to visualize exact bounding box differences.";

    var chkCards = pnlOpts.add("checkbox", undefined, "Include Background Box Cards & Origin Crosshairs");
    chkCards.value = true;

    // Action Buttons
    var grpBtns = win.add("group");
    grpBtns.orientation = "row";
    grpBtns.alignChildren = ["fill", "center"];
    grpBtns.spacing = 6;

    var btnBuild = grpBtns.add("button", undefined, "🚀 Build 8x5 Matrix");
    btnBuild.preferredSize = [170, 32];
    btnBuild.helpTip = "Generates the complete 40-box calibration matrix in a 1920x1080 composition.";

    var btnToggleOutlines = grpBtns.add("button", undefined, "👁️ Toggle Bounds");
    btnToggleOutlines.preferredSize = [120, 32];
    btnToggleOutlines.helpTip = "Toggles visibility of sourceRect bounding outline layers.";

    // Status Label
    var lblStatus = win.add("statictext", undefined, "Ready. Click 'Build 8x5 Matrix' to start.");
    lblStatus.alignment = ["fill", "top"];

    // -------------------------------------------------------------------------
    // 6. Event Handlers
    // -------------------------------------------------------------------------
    btnBuild.onClick = function () {
        lblStatus.text = "Building 40-cell matrix...";
        try {
            var res = buildCalibrationMatrix({
                showOutlines: chkOutlines.value,
                showCards: chkCards.value
            });
            lblStatus.text = "✓ Built " + res.totalBoxes + " text boxes in '" + res.compName + "'.";
        } catch (err) {
            lblStatus.text = "Error: " + err.toString();
        }
    };

    btnToggleOutlines.onClick = function () {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            lblStatus.text = "No active composition found.";
            return;
        }
        var count = 0;
        var newState = null;
        for (var i = 1; i <= comp.layers.length; i++) {
            var lyr = comp.layers[i];
            if (lyr.name && lyr.name.indexOf("SourceRect_Bound") !== -1) {
                if (newState === null) newState = !lyr.enabled;
                lyr.enabled = newState;
                count++;
            }
        }
        lblStatus.text = (newState ? "Revealed " : "Hidden ") + count + " bounding outlines.";
    };

    // Auto-Build Detection: If URL contains autobuild=true or auto-triggered, build immediately
    var shouldAutoBuild = false;
    try {
        if (typeof window !== "undefined" && window.location && window.location.search) {
            if (window.location.search.indexOf("autobuild=true") !== -1) {
                shouldAutoBuild = true;
            }
        }
    } catch (eAuto) {}

    // Show window if floating palette
    if (win instanceof Window) {
        win.center();
        win.show();
    }

    if (shouldAutoBuild) {
        try {
            buildCalibrationMatrix({ showOutlines: true, showCards: true });
            lblStatus.text = "✓ Auto-built 40 text calibration boxes.";
        } catch (eBuild) {}
    }

    return win;

})(this);
