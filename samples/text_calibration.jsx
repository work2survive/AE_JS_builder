// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL:
// TEXT CALIBRATION MATRIX (8x5 = 40 TEXT BOXES) v1.1
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
//   - Works both as a dockable panel (ScriptUI Panels) and via File > Scripts > Run.
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_NAME = "AE Text Calibration Matrix";
    var SCRIPT_VERSION = "v1.2.1";
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

    // Global in-memory cache initialization
    var $global;
    try {
        $global = (typeof $ !== "undefined" && typeof $.global !== "undefined")
            ? $.global
            : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
    } catch (eG) {
        $global = this;
    }

    if (typeof $ === "undefined") {
        try {
            $global.$ = { global: $global, writeln: function (msg) { if (typeof console !== "undefined") console.log(msg); } };
        } catch (eDol) {}
    } else {
        try {
            if (typeof $.global === "undefined") $.global = $global;
        } catch (eDol2) {}
    }

    // -------------------------------------------------------------------------
    // 1. Column Font Definitions (8 System Fonts)
    // -------------------------------------------------------------------------
    var FONT_COLUMNS = [
        { id: "arial",     name: "Arial",           postScript: "ArialMT",           label: "Arial",       category: "Sans" },
        { id: "georgia",   name: "Georgia",         postScript: "Georgia",           label: "Georgia",     category: "Serif" },
        { id: "times",     name: "Times New Roman", postScript: "TimesNewRomanPSMT", label: "Times NR",   category: "Serif" },
        { id: "courier",   name: "Courier New",     postScript: "CourierNewPSMT",    label: "Courier",     category: "Mono" },
        { id: "verdana",   name: "Verdana",         postScript: "Verdana",           label: "Verdana",     category: "Sans" },
        { id: "trebuchet", name: "Trebuchet MS",    postScript: "TrebuchetMS",       label: "Trebuchet",   category: "Humanist" },
        { id: "impact",    name: "Impact",          postScript: "Impact",            label: "Impact",      category: "Display" },
        { id: "segoe",     name: "Segoe UI",        postScript: "SegoeUI",           label: "Segoe UI",    category: "Modern" }
    ];

    // -------------------------------------------------------------------------
    // 2. Row Specification Definitions (5 Alignment & Indent Modes)
    // -------------------------------------------------------------------------
    var ROW_SPECS = [
        {
            row: 0,
            title: "Row 0: Point Text • Left Justify • Indent 0px • Regular",
            shortTitle: "Point • Left (0px)",
            isBox: false,
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.LEFT_JUSTIFY !== undefined)
                ? ParagraphJustification.LEFT_JUSTIFY : 7412,
            justName: "Left",
            firstLineIndent: 0,
            leftIndent: 0,
            rightIndent: 0,
            fontSize: 16.25,
            leading: 0, // Auto leading
            tracking: 0,
            textColor: [0.90, 0.93, 0.97],
            badgeColor: [0.35, 0.55, 0.85]
        },
        {
            row: 1,
            title: "Row 1: Box Text • Center Justify • Margins 8px • Tracking +10",
            shortTitle: "Box • Center (8px Margins)",
            isBox: true,
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.CENTER_JUSTIFY !== undefined)
                ? ParagraphJustification.CENTER_JUSTIFY : 7414,
            justName: "Center",
            firstLineIndent: 0,
            leftIndent: 8,
            rightIndent: 8,
            fontSize: 16.25,
            leading: 20.8,
            tracking: 10,
            textColor: [0.45, 0.75, 1.0],
            badgeColor: [0.25, 0.65, 0.95]
        },
        {
            row: 2,
            title: "Row 2: Box Text • Right Justify • Right Indent 14px",
            shortTitle: "Box • Right (14px Right Ind)",
            isBox: true,
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.RIGHT_JUSTIFY !== undefined)
                ? ParagraphJustification.RIGHT_JUSTIFY : 7413,
            justName: "Right",
            firstLineIndent: 0,
            leftIndent: 0,
            rightIndent: 14,
            fontSize: 15.6,
            leading: 20.15,
            tracking: 0,
            textColor: [0.55, 0.88, 0.65],
            badgeColor: [0.35, 0.75, 0.45]
        },
        {
            row: 3,
            title: "Row 3: Point Text • Paragraph Indent (+24px) / Hanging Indent (-18px)",
            shortTitle: "Point • Paragraph & Hanging Indents",
            isBox: false,
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.LEFT_JUSTIFY !== undefined)
                ? ParagraphJustification.LEFT_JUSTIFY : 7412,
            justName: "Left",
            firstLineIndent: 24, // Modified per-column below
            leftIndent: 0,
            rightIndent: 0,
            fontSize: 15.6,
            leading: 19.5,
            tracking: 0,
            textColor: [1.0, 0.75, 0.35],
            badgeColor: [0.95, 0.60, 0.20]
        },
        {
            row: 4,
            title: "Row 4: Box Text • Advanced Synthesis (Bold, Italic, Outline, AllCaps)",
            shortTitle: "Box • Styles & Typo Synthesis",
            isBox: true,
            justification: (typeof ParagraphJustification !== "undefined" && ParagraphJustification.LEFT_JUSTIFY !== undefined)
                ? ParagraphJustification.LEFT_JUSTIFY : 7412,
            justName: "Style Mix",
            firstLineIndent: 0,
            leftIndent: 0,
            rightIndent: 0,
            fontSize: 15.6,
            leading: 20.8,
            tracking: 0,
            textColor: [0.95, 0.50, 0.75],
            badgeColor: [0.85, 0.35, 0.65]
        }
    ];

    // Standard high-efficiency pangram containing all 26 alphabetic letters,
    // ascenders (h, b, d, k, l, t, f), descenders (g, j, p, q, y), caps, and numerals:
    var CALIBRATION_TEXT = "The quick brown fox jumps over the lazy dog. Calibration: Q,g,y,j,f,t. 0123456789.";

    // -------------------------------------------------------------------------
    // 3. Multi-version Text Wrapping Fallback Helper
    // -------------------------------------------------------------------------
    function wrapTextToWidth(rawText, maxW, fontSize, fontName, indentPx) {
        var words = String(rawText).replace(/\r\n|\r|\n/g, " ").split(/\s+/);
        var lines = [];
        var charRatio = 0.52;
        var fn = String(fontName || "").toLowerCase();
        if (fn.indexOf("courier") !== -1) charRatio = 0.60;
        else if (fn.indexOf("verdana") !== -1) charRatio = 0.58;
        else if (fn.indexOf("times") !== -1) charRatio = 0.46;
        else if (fn.indexOf("impact") !== -1) charRatio = 0.47;

        var curLine = "";
        var curLimit = maxW - (indentPx || 0);

        for (var i = 0; i < words.length; i++) {
            var testLine = curLine ? (curLine + " " + words[i]) : words[i];
            var testW = testLine.length * (fontSize * charRatio);
            if (testW > curLimit && curLine) {
                lines.push(curLine);
                curLine = words[i];
                curLimit = maxW;
            } else {
                curLine = testLine;
            }
        }
        if (curLine) lines.push(curLine);
        return lines.join("\r");
    }

    // -------------------------------------------------------------------------
    // 4. Safe Shape Layer Builder Helpers
    // -------------------------------------------------------------------------
    function addShapeRectangle(shapeLayer, groupName, width, height, posX, posY, fillColor, strokeColor, strokeWidth, strokeOpacity) {
        var rootVectors = shapeLayer.property("ADBE Root Vectors Group") || shapeLayer.property("Contents");
        if (!rootVectors) return null;
        var group = rootVectors.addProperty("ADBE Vector Group");
        if (groupName && group) group.name = groupName;
        var contents = group ? (group.property("ADBE Vectors Group") || group.property("Contents")) : null;
        if (!contents) return null;

        var rect = contents.addProperty("ADBE Vector Shape - Rect");
        if (rect) {
            var sizeProp = rect.property("ADBE Vector Rect Size") || rect.property("Size");
            if (sizeProp) sizeProp.setValue([width, height]);
            if (posX !== 0 || posY !== 0) {
                var posProp = rect.property("ADBE Vector Position") || rect.property("Position");
                if (posProp) posProp.setValue([posX, posY]);
            }
        }

        if (fillColor) {
            var fill = contents.addProperty("ADBE Vector Graphic - Fill");
            if (fill) {
                var fillColProp = fill.property("ADBE Vector Fill Color") || fill.property("Color");
                if (fillColProp) fillColProp.setValue(fillColor);
            }
        }

        if (strokeColor) {
            var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
            if (stroke) {
                var strokeColProp = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color");
                if (strokeColProp) strokeColProp.setValue(strokeColor);
                var swProp = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width");
                if (swProp) swProp.setValue(strokeWidth || 1);
                if (strokeOpacity !== undefined) {
                    var soProp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Stroke Opacity");
                    if (soProp) soProp.setValue(strokeOpacity);
                }
            }
        }
        return rect;
    }

    function addDynamicBoundingBox(comp, textLayer, cellPrefix) {
        try {
            var boundLayer = comp.layers.addShape();
            boundLayer.name = cellPrefix + "_SourceRect_Bound";

            var rootVectors = boundLayer.property("ADBE Root Vectors Group") || boundLayer.property("Contents");
            if (!rootVectors) return boundLayer;
            var group = rootVectors.addProperty("ADBE Vector Group");
            group.name = "sourceRect Bounds";
            var contents = group.property("ADBE Vectors Group") || group.property("Contents");
            if (!contents) return boundLayer;

            var rect = contents.addProperty("ADBE Vector Shape - Rect");
            var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");

            if (stroke) {
                var strokeColProp = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color");
                if (strokeColProp) strokeColProp.setValue([0.0, 0.90, 1.0]); // Vivid cyan
                var swProp = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width");
                if (swProp) swProp.setValue(1.0);
                var soProp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Stroke Opacity");
                if (soProp) soProp.setValue(65);
            }

            var targetNameEscaped = textLayer.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            if (rect) {
                var sizeProp = rect.property("ADBE Vector Rect Size") || rect.property("Size");
                if (sizeProp) {
                    sizeProp.expression = [
                        'try {',
                        '    var target = thisComp.layer("' + targetNameEscaped + '");',
                        '    var r = target.sourceRectAtTime(time, false);',
                        '    [Math.max(2, r.width), Math.max(2, r.height)];',
                        '} catch (err) {',
                        '    value;',
                        '}'
                    ].join("\n");
                }
            }

            var posProp = boundLayer.transform.position || (boundLayer.property("ADBE Transform Group") ? boundLayer.property("ADBE Transform Group").property("ADBE Position") : null);
            if (posProp) {
                posProp.expression = [
                    'try {',
                    '    var target = thisComp.layer("' + targetNameEscaped + '");',
                    '    var r = target.sourceRectAtTime(time, false);',
                    '    var p = target.toComp([r.left + r.width / 2, r.top + r.height / 2]);',
                    '    [p[0], p[1]];',
                    '} catch (err) {',
                    '    value;',
                    '}'
                ].join("\n");
            }

            return boundLayer;
        } catch (eBound) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // 5. Main Calibration Environment Builder
    // -------------------------------------------------------------------------
    function buildCalibrationMatrix(options) {
        options = options || {};
        var showOutlines = (options.showOutlines !== undefined) ? options.showOutlines : true;

        if (!app.project) {
            app.newProject();
        }

        var undoStarted = false;
        if (app.beginUndoGroup) {
            app.beginUndoGroup("Build AE Text Calibration Matrix");
            undoStarted = true;
        }

        try {
            var comp = null;
            if (app.project.activeItem && (app.project.activeItem instanceof CompItem)) {
                if (app.project.activeItem.name === "AE_Text_Calibration_Matrix_8x5") {
                    comp = app.project.activeItem;
                }
            }
            if (!comp) {
                var numItems = app.project.numItems || (app.project.items ? app.project.items.length : 0);
                for (var itmIdx = 1; itmIdx <= numItems; itmIdx++) {
                    var item = (typeof app.project.item === "function") ? app.project.item(itmIdx) : app.project.items[itmIdx - 1];
                    if (item && (item instanceof CompItem) && item.name === "AE_Text_Calibration_Matrix_8x5") {
                        comp = item;
                        break;
                    }
                }
            }
            if (!comp) {
                comp = app.project.items.addComp("AE_Text_Calibration_Matrix_8x5", COMP_WIDTH, COMP_HEIGHT, 1.0, COMP_DURATION, COMP_FPS);
            }

            if (comp && typeof comp.openInViewer === "function") {
                try { comp.openInViewer(); } catch (eOpen) {}
            }

            // Clear previous calibration layers if rebuilding
            for (var l = comp.layers.length; l >= 1; l--) {
                var lyr = comp.layers[l];
                if (lyr && lyr.name && lyr.name.indexOf("CALIB_") === 0) {
                    try { lyr.remove(); } catch (eRem) {}
                }
            }

            // 1. Background Solid Plate
            var bgPlate = comp.layers.addShape();
            bgPlate.name = "CALIB_Background_Plate";
            bgPlate.transform.position.setValue([COMP_WIDTH / 2, COMP_HEIGHT / 2, 0]);
            addShapeRectangle(bgPlate, "Dark Backdrop", COMP_WIDTH, COMP_HEIGHT, 0, 0, [0.06, 0.07, 0.09], null, 0);

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
                            cellFontSize = 13.65;
                            cellLeading = 18.85;
                        } else if (c === 3) { // Courier: Outline stroke
                            cellApplyStroke = true;
                            cellStrokeWidth = 0.8;
                            cellStrokeColor = [0.35, 0.90, 1.0];
                        } else if (c === 4) { // Verdana: Faux Bold + Negative tracking
                            cellFauxBold = true;
                            cellTracking = -15;
                        } else if (c === 5) { // Trebuchet: Baseline shift + Loose leading
                            cellBaselineShift = 2.5;
                            cellLeading = 22.75;
                        } else if (c === 6) { // Impact: Heavy display
                            cellTracking = 25;
                            cellFontSize = 16.9;
                        } else if (c === 7) { // Segoe UI: Bold + Italic synthesis
                            cellFauxBold = true;
                            cellFauxItalic = true;
                        }
                    }

                    // A. Background Reference Card for this cell
                    var cardLayer = comp.layers.addShape();
                    cardLayer.name = cellPrefix + "_Card";
                    cardLayer.transform.position.setValue([cellX + BOX_WIDTH / 2, cellY + BOX_HEIGHT / 2, 0]);

                    addShapeRectangle(cardLayer, "Cell Box Card", BOX_WIDTH, BOX_HEIGHT, 0, 0, [0.10, 0.12, 0.16], [0.18, 0.22, 0.30], 1);
                    // Origin crosshair tick at top-left [0, 0] of the text box
                    addShapeRectangle(cardLayer, "Origin Crosshair", 4, 4, -BOX_WIDTH / 2, -BOX_HEIGHT / 2, rowSpec.badgeColor, null, 0);

                    // B. Cell Header Badge (Small indicator text)
                    var typeLabel = rowSpec.isBox ? "Box" : "Point";
                    var badgeLayer = comp.layers.addText("[" + cellKey + "] " + fontInfo.label);
                    badgeLayer.name = cellPrefix + "_Badge";
                    badgeLayer.transform.position.setValue([cellX + 4, cellY + 12, 0]);
                    setupSimpleText(badgeLayer, "[" + cellKey + "] " + fontInfo.label + " | " + rowSpec.justName + " (" + typeLabel + ")", "Segoe UI", 8.5, rowSpec.badgeColor, "left");

                    // C. Text Layer (Point Text or Paragraph Box Text based on row specification)
                    var textBoxHeight = BOX_HEIGHT - 20; // Room for top badge
                    var textLayer;
                    if (rowSpec.isBox) {
                        if (typeof comp.layers.addBoxText === "function") {
                            try {
                                textLayer = comp.layers.addBoxText([BOX_WIDTH, textBoxHeight], CALIBRATION_TEXT);
                            } catch (eBox) {
                                textLayer = comp.layers.addText(CALIBRATION_TEXT);
                            }
                        } else {
                            textLayer = comp.layers.addText(CALIBRATION_TEXT);
                        }
                    } else {
                        // Native Point Text
                        textLayer = comp.layers.addText(CALIBRATION_TEXT);
                    }
                    textLayer.name = cellPrefix + "_Text";

                    // 1. First apply all text document attributes (fonts, sizes, justification, box dimensions, indents)
                    setupCalibratedTextDocument(textLayer, {
                        text: CALIBRATION_TEXT,
                        isBox: rowSpec.isBox,
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

                    // 2. Query applied TextDocument to get native geometry metrics
                    var docProp = (textLayer.property("ADBE Text Properties") || textLayer.property("Text"));
                    var textDocProp = docProp ? (docProp.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
                    var currentDoc = textDocProp ? textDocProp.value : null;

                    var isNativeBoxLayer = false;
                    try {
                        isNativeBoxLayer = (currentDoc && currentDoc.boxText === true) || (textLayer.boxText === true);
                    } catch (eBoxCheck) {
                        isNativeBoxLayer = false;
                    }

                    if (rowSpec.isBox && isNativeBoxLayer) {
                        // -------------------------------------------------------------
                        // Paragraph (Box) Text Placement (Rows 1, 2, 4)
                        // -------------------------------------------------------------
                        // In Adobe After Effects Box Text:
                        // - Justification (Left, Center, Right) formats text INSIDE the box [0..BOX_WIDTH].
                        // - It does NOT displace the box or the layer anchor point!
                        // - currentDoc.boxTextPos returns the layer-space coordinates of the box top-left
                        //   corner relative to the layer's default anchor point (typically [0, -baseline]).
                        // - By setting layer.anchorPoint to boxTextPos:
                        //     anchorPoint = [bPos[0], bPos[1], 0]
                        //   the layer transform origin is pinned exactly to the box's top-left corner.
                        // - Setting position to [cellX, cellY + 20, 0] ensures the top-left of the box
                        //   sits perfectly at [cellX, cellY + 20] in composition coordinates, matching the
                        //   gray card bounds exactly across all AE versions and justification modes.
                        var bPos = [0, 0];
                        try {
                            if (currentDoc && currentDoc.boxTextPos) {
                                bPos = currentDoc.boxTextPos;
                            }
                        } catch (eBPos) {}

                        try {
                            textLayer.transform.anchorPoint.setValue([bPos[0], bPos[1], 0]);
                        } catch (eAnc) {}
                        textLayer.transform.position.setValue([cellX, cellY + 20, 0]);

                    } else if (rowSpec.isBox && !isNativeBoxLayer) {
                        // -------------------------------------------------------------
                        // Fallback: Box Text on legacy AE versions without addBoxText
                        // (Soft-wrapped Point Text)
                        // -------------------------------------------------------------
                        var textPosX = cellX + cellLeftIndent;
                        if (rowSpec.justName === "Center") {
                            textPosX = cellX + (BOX_WIDTH + cellLeftIndent - cellRightIndent) / 2;
                        } else if (rowSpec.justName === "Right") {
                            textPosX = cellX + BOX_WIDTH - cellRightIndent;
                        }
                        var textPosY = cellY + 34;

                        try {
                            textLayer.transform.anchorPoint.setValue([0, 0, 0]);
                        } catch (eAnc) {}
                        textLayer.transform.position.setValue([textPosX, textPosY, 0]);

                    } else {
                        // -------------------------------------------------------------
                        // Point Text Placement (Rows 0 and 3)
                        // -------------------------------------------------------------
                        // In AE Point Text, anchor point [0, 0] is on the baseline of the first line.
                        // Horizontal coordinate shifts with justification:
                        // - Left Justify: line starts at textPosX (x = cellX + leftIndent)
                        // - Center Justify: line centers around textPosX (x = cellX + (BOX_WIDTH + leftIndent - rightIndent)/2)
                        // - Right Justify: line ends at textPosX (x = cellX + BOX_WIDTH - rightIndent)
                        var textPosX = cellX + cellLeftIndent;
                        if (rowSpec.justName === "Center") {
                            textPosX = cellX + (BOX_WIDTH + cellLeftIndent - cellRightIndent) / 2;
                        } else if (rowSpec.justName === "Right") {
                            textPosX = cellX + BOX_WIDTH - cellRightIndent;
                        }
                        var textPosY = cellY + 34; // Baseline offset leaving clean headroom below badge

                        try {
                            textLayer.transform.anchorPoint.setValue([0, 0, 0]);
                        } catch (eAnc) {}
                        textLayer.transform.position.setValue([textPosX, textPosY, 0]);
                    }

                    // D. Dynamic sourceRectAtTime Bounding Outline (Cyan)
                    if (showOutlines) {
                        addDynamicBoundingBox(comp, textLayer, cellPrefix);
                    }

                    // Register cell metadata
                    cellsRegistry.push({
                        key: cellKey,
                        col: c,
                        row: row,
                        font: fontInfo.name,
                        type: rowSpec.isBox ? "Box Text" : "Point Text",
                        alignment: rowSpec.justName,
                        firstLineIndent: cellFirstLineIndent,
                        leftIndent: cellLeftIndent,
                        rightIndent: cellRightIndent,
                        boxWidth: BOX_WIDTH,
                        boxHeight: textBoxHeight
                    });
                }
            }

            return {
                success: true,
                compName: comp.name,
                totalBoxes: cellsRegistry.length,
                cells: cellsRegistry
            };
        } finally {
            if (undoStarted && app.endUndoGroup) {
                app.endUndoGroup();
            }
        }
    }

    // -------------------------------------------------------------------------
    // 6. Helper Text Document Setup Functions
    // -------------------------------------------------------------------------
    function applyDocumentWithFontFallback(docProp, doc, candidates) {
        var applied = false;
        if (candidates && candidates.length > 0) {
            for (var i = 0; i < candidates.length; i++) {
                try {
                    doc.font = candidates[i];
                    docProp.setValue(doc);
                    applied = true;
                    break;
                } catch (eCandidate) {
                    // Font candidate not recognized by AE FontServer, try next candidate
                }
            }
        }
        if (!applied) {
            try {
                doc.font = "ArialMT";
                docProp.setValue(doc);
                applied = true;
            } catch (eArialMT) {
                try {
                    doc.font = "Arial";
                    docProp.setValue(doc);
                    applied = true;
                } catch (eArial) {
                    try {
                        docProp.setValue(doc);
                    } catch (eFinal) {}
                }
            }
        }
    }

    function setupSimpleText(textLayer, textStr, fontName, fontSize, fontColor, justification) {
        try {
            var prop = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
            var docProp = prop ? (prop.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
            if (docProp) {
                var doc = docProp.value;
                if (doc) {
                    doc.text = textStr;
                    doc.fontSize = fontSize;
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

                    var candidates = [];
                    if (fontName === "Segoe UI") {
                        candidates = ["SegoeUI", "Segoe UI", "ArialMT", "Arial"];
                    } else if (fontName) {
                        candidates = [fontName, "ArialMT", "Arial"];
                    }
                    applyDocumentWithFontFallback(docProp, doc, candidates);
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

            doc.fontSize = params.fontSize;
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

            // Detect if this is a box text (paragraph) layer or point text layer
            // Note: In After Effects ExtendScript, doc.pointText and doc.boxText are strictly READ-ONLY!
            var isBox = false;
            if (typeof params.isBox === "boolean") {
                isBox = params.isBox;
            } else {
                try {
                    isBox = (doc.boxText === true || textLayer.boxText === true);
                } catch (eB) {
                    isBox = false;
                }
            }

            if (isBox) {
                // Paragraph text layer: AE automatically wraps lines within the bounding box
                doc.text = params.text;
                try {
                    if (typeof doc.setBoxTextSize === "function") {
                        doc.setBoxTextSize([params.boxWidth, params.boxHeight]);
                    } else if (doc.boxTextSize !== undefined) {
                        doc.boxTextSize = [params.boxWidth, params.boxHeight];
                    }
                } catch (eBoxSize) {}
            } else {
                // Point text layer fallback: wrap text with soft carriage returns
                doc.text = wrapTextToWidth(params.text, params.boxWidth - 10, params.fontSize, params.fontName, params.firstLineIndent);
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

            // Build prioritized font candidate list: PostScript name must be tried first!
            var fontCandidates = [];
            if (params.postScript) {
                fontCandidates.push(params.postScript);
            }
            if (params.fontName && params.fontName !== params.postScript) {
                fontCandidates.push(params.fontName);
            }
            if (params.fontName === "Times New Roman") {
                fontCandidates.push("TimesNewRomanPS-RegularMT", "TimesNewRoman", "Times-Roman");
            } else if (params.fontName === "Courier New") {
                fontCandidates.push("CourierNewPS-RegularMT", "CourierNew", "Courier");
            } else if (params.fontName === "Trebuchet MS") {
                fontCandidates.push("Trebuchet-MS", "Trebuchet");
            } else if (params.fontName === "Segoe UI") {
                fontCandidates.push("SegoeUI-Regular", "SegoeUI", "Segoe UI");
            } else if (params.fontName === "Impact") {
                fontCandidates.push("ImpactMT");
            } else if (params.fontName === "Arial") {
                fontCandidates.push("ArialMT", "Arial");
            }

            applyDocumentWithFontFallback(docProp, doc, fontCandidates);

            // Also mirror directly onto layer if layer supports direct properties
            try {
                if (params.fontName) textLayer.font = params.fontName;
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
    // 7. ScriptUI Dialog / Panel Interface Builder
    // -------------------------------------------------------------------------
    function buildUI(thisObj) {
        var isPanel = (typeof Panel !== "undefined" && thisObj instanceof Panel);
        var win = isPanel
            ? thisObj
            : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, { resizeable: true });

        if (!isPanel) {
            win.text = SCRIPT_NAME + " " + SCRIPT_VERSION;
        }

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

        var btnBuild = grpBtns.add("button", undefined, "🚀 Rebuild 8x5 Matrix");
        btnBuild.preferredSize = [170, 32];
        btnBuild.helpTip = "Generates the complete 40-box calibration matrix in a 1920x1080 composition.";

        var btnToggleOutlines = grpBtns.add("button", undefined, "👁️ Toggle Bounds");
        btnToggleOutlines.preferredSize = [120, 32];
        btnToggleOutlines.helpTip = "Toggles visibility of sourceRect bounding outline layers.";

        // Status Label
        var lblStatus = win.add("statictext", undefined, "✓ Matrix generated (40 text boxes in 'AE_Text_Calibration_Matrix_8x5').");
        lblStatus.alignment = ["fill", "top"];

        // Event Handlers
        btnBuild.onClick = function () {
            lblStatus.text = "Building 40-cell matrix...";
            try {
                var res = buildCalibrationMatrix({
                    showOutlines: chkOutlines.value,
                    showCards: chkCards.value
                });
                lblStatus.text = "✓ Built " + res.totalBoxes + " text boxes in '" + res.compName + "'.";
            } catch (err) {
                lblStatus.text = "Error: " + (err.message || err.toString());
                if (typeof alert === "function") alert("Build Error:\n" + (err.message || err.toString()));
            }
        };

        btnToggleOutlines.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
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

        // Layout evaluation
        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        return win;
    }

    // -------------------------------------------------------------------------
    // 8. Execution Entry Point
    // -------------------------------------------------------------------------
    // 1. Auto-build calibration matrix immediately so it is ready upon script launch
    try {
        buildCalibrationMatrix({ showOutlines: true, showCards: true });
    } catch (eBuild) {
        if (typeof alert === "function") {
            alert("Notice during Text Calibration auto-build:\n" + (eBuild.message || eBuild.toString()));
        }
    }

    // 2. Build and display UI panel / window
    var panel = buildUI(thisObj);
    if (panel) {
        // Prevent ExtendScript garbage collection when run via File > Scripts > Run Script File...
        try {
            if (typeof $ !== "undefined" && typeof $.global !== "undefined") {
                $.global.aeTextCalibrationPal = panel;
            } else if (typeof $global !== "undefined") {
                $global.aeTextCalibrationPal = panel;
            }
        } catch (eGlobal) {}

        if (panel instanceof Window) {
            panel.center();
            panel.show();
        } else {
            panel.layout.layout(true);
            panel.layout.resize();
        }
    }

    return panel;

})(this);
