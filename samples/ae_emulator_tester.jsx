// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE / EMULATOR TESTER v1.0
// =============================================================================
//
// PURPOSE:
//   A comprehensive test suite and calibration harness designed to verify 100%
//   visual, geometric, and interactive parity between Adobe After Effects
//   (native desktop) and the Web AE JS & ScriptUI Simulator runtime.
//
// INCLUDES:
//   1. Full Composition Test Harness:
//      - Position Calibration Grid (100px major, 50px minor, center origin crosshair).
//      - System Fonts Showcase with the classic "The quick brown fox jumps over
//        the lazy dog" pangram, numerics, and glyphs (Segoe UI, Arial, Georgia,
//        Times New Roman, Courier New, Trebuchet MS, Impact).
//      - Geometric Primitives: Ellipses, circles, concentric rings, triangles,
//        pentagons, hexagons, octagons, 5-point stars, and starbursts.
//      - All AE Stroke Styles: Line Caps (Butt, Round, Square), Line Joins (Miter,
//        Round, Bevel), Dashes & Gaps (Solid, Standard Dash, Dotted Pearls, Dual Rhythm).
//      - Fill Styles & Gradients: Solid flat RGB, semi-transparent opacities,
//        multi-stop Linear Gradients and Radial Gradients.
//
//   2. Complete ScriptUI UI Elements Showcase:
//      - TabbedPanel & Tab containers.
//      - Panel (titled and borderless groups).
//      - Group (row, column, margins, spacing, alignments).
//      - Button & IconButton.
//      - StaticText (normal, header, and clickable hyperlinks).
//      - EditText (single-line, numeric limit, multiline textarea, password mask, read-only).
//      - Slider (scrubbable horizontal range).
//      - Scrollbar (range control with step and jump deltas).
//      - ProgressBar (progress value indicator).
//      - Checkbox (checked, unchecked).
//      - RadioButton (mutually exclusive radio groups).
//      - DropDownList (dropdown popup selector).
//      - ListBox (scrollable item list with selection).
//      - TreeView (hierarchical expandable node tree).
//      - Color Swatches & Pickers (Windows ChooseColor / $.colorPicker emulation).
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript ES3 engine).
//   - AE JS & ScriptUI Simulator (Web Emulator).
//   - Works both as a dockable panel and as a floating palette.
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_TITLE = "AE / Emulator Tester";
    var SCRIPT_VERSION = "v1.1.1";

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true });

    if (!(thisObj instanceof Panel)) {
        win.text = SCRIPT_TITLE + " " + SCRIPT_VERSION;
    }

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 10;

    // -------------------------------------------------------------------------
    // 2. TabbedPanel Container (Showcasing all ScriptUI UI Element Types)
    // -------------------------------------------------------------------------
    var tabbedPanel = win.add("tabbedpanel");
    tabbedPanel.alignChildren = ["fill", "top"];
    tabbedPanel.alignment = ["fill", "top"];

    // =========================================================================
    // TAB 1: 🚀 TEST HARNESS CONTROLS
    // =========================================================================
    var tabHarness = tabbedPanel.add("tab", undefined, "🚀 Test Harness");
    tabHarness.orientation = "column";
    tabHarness.alignChildren = ["fill", "top"];
    tabHarness.spacing = 8;
    tabHarness.margins = 10;

    var pnlModules = tabHarness.add("panel", undefined, "Active Test Modules");
    pnlModules.orientation = "column";
    pnlModules.alignChildren = ["fill", "top"];
    pnlModules.spacing = 5;

    var chkGrid = pnlModules.add("checkbox", undefined, "Position Calibration Grid & Origin (100px / 50px)");
    chkGrid.value = true;

    var chkFonts = pnlModules.add("checkbox", undefined, "Typography: System Fonts ('Lazy Fox' Pangram)");
    chkFonts.value = true;

    var chkShapes = pnlModules.add("checkbox", undefined, "Geometric Shapes: Polygons & Ellipses");
    chkShapes.value = true;

    var chkStrokes = pnlModules.add("checkbox", undefined, "Stroke Styles: Caps, Joins, Dashes & Gaps");
    chkStrokes.value = true;

    var chkGradients = pnlModules.add("checkbox", undefined, "Fill Styles: Solid Colors & Linear/Radial Gradients");
    chkGradients.value = true;

    var chkWiggle = pnlModules.add("checkbox", undefined, "Enable Subtle 3D Animation / Wiggle");
    chkWiggle.value = false;

    // Parameters Group
    var pnlParams = tabHarness.add("panel", undefined, "Live Comp Parameters");
    pnlParams.orientation = "column";
    pnlParams.alignChildren = ["fill", "top"];
    pnlParams.spacing = 6;

    // Font Size Slider + EditText
    var grpFontSize = pnlParams.add("group");
    grpFontSize.orientation = "row";
    grpFontSize.alignment = ["fill", "top"];
    var lblFontSize = grpFontSize.add("statictext", undefined, "Font Size (px):");
    lblFontSize.preferredSize = [105, -1];
    var sldFontSize = grpFontSize.add("slider", undefined, 15, 10, 28);
    sldFontSize.minvalue = 10;
    sldFontSize.maxvalue = 28;
    sldFontSize.value = 15;
    sldFontSize.alignment = ["fill", "center"];
    var txtFontSize = grpFontSize.add("edittext", undefined, "15");
    txtFontSize.characters = 3;

    // Stroke Width Slider + EditText
    var grpStroke = pnlParams.add("group");
    grpStroke.orientation = "row";
    grpStroke.alignment = ["fill", "top"];
    var lblStroke = grpStroke.add("statictext", undefined, "Stroke Width (px):");
    lblStroke.preferredSize = [105, -1];
    var sldStroke = grpStroke.add("slider", undefined, 3, 1, 12);
    sldStroke.minvalue = 1;
    sldStroke.maxvalue = 12;
    sldStroke.value = 3;
    sldStroke.alignment = ["fill", "center"];
    var txtStroke = grpStroke.add("edittext", undefined, "3");
    txtStroke.characters = 3;

    // Synchronize slider and text inputs
    function hookSliderText(sld, txt, minV, maxV) {
        sld.onChanging = function() {
            txt.text = String(Math.round(sld.value));
        };
        txt.onChange = function() {
            var v = parseInt(txt.text, 10);
            if (isNaN(v)) v = minV;
            v = Math.max(minV, Math.min(maxV, v));
            sld.value = v;
            txt.text = String(v);
        };
    }
    hookSliderText(sldFontSize, txtFontSize, 10, 28);
    hookSliderText(sldStroke, txtStroke, 1, 12);

    // Progress Bar Indicator
    var grpProgress = tabHarness.add("group");
    grpProgress.orientation = "column";
    grpProgress.alignChildren = ["fill", "top"];
    grpProgress.spacing = 2;
    var lblProg = grpProgress.add("statictext", undefined, "Harness Execution Status:");
    var progBar = grpProgress.add("progressbar", undefined, 0, 100);
    progBar.preferredSize = [-1, 10];
    progBar.value = 100;

    // Action Buttons
    var grpActions = tabHarness.add("group");
    grpActions.orientation = "row";
    grpActions.alignment = ["fill", "top"];
    grpActions.spacing = 6;

    var btnBuild = grpActions.add("button", undefined, "🚀 Build / Rebuild Tester Comp");
    btnBuild.alignment = ["fill", "center"];
    btnBuild.preferredSize = [-1, 36];

    var btnClear = grpActions.add("button", undefined, "Clear Tester Layers");
    btnClear.preferredSize = [120, 36];

    // =========================================================================
    // TAB 2: 📝 TEXT & INPUT CONTROLS SHOWCASE
    // =========================================================================
    var tabTextInputs = tabbedPanel.add("tab", undefined, "📝 Text & Inputs");
    tabTextInputs.orientation = "column";
    tabTextInputs.alignChildren = ["fill", "top"];
    tabTextInputs.spacing = 8;
    tabTextInputs.margins = 10;

    // Single-line & Masked Inputs Panel
    var pnlSingle = tabTextInputs.add("panel", undefined, "StaticText & Single-line EditText");
    pnlSingle.orientation = "column";
    pnlSingle.alignChildren = ["fill", "top"];
    pnlSingle.spacing = 6;

    // StaticText header + normal
    var lblInfo1 = pnlSingle.add("statictext", undefined, "StaticText Label (Standard):");
    var txtSingle = pnlSingle.add("edittext", undefined, "The quick brown fox jumps over the lazy dog");
    txtSingle.helpTip = "Standard single-line text input field.";

    // Password / Masked input
    var grpPass = pnlSingle.add("group");
    grpPass.orientation = "row";
    grpPass.alignment = ["fill", "top"];
    var lblPass = grpPass.add("statictext", undefined, "Password Mask:");
    lblPass.preferredSize = [105, -1];
    var txtPass = grpPass.add("edittext", undefined, "SuperSecret2026", { password: true });
    txtPass.alignment = ["fill", "center"];

    // Read-only input
    var grpReadOnly = pnlSingle.add("group");
    grpReadOnly.orientation = "row";
    grpReadOnly.alignment = ["fill", "top"];
    var lblReadOnly = grpReadOnly.add("statictext", undefined, "Read-Only Text:");
    lblReadOnly.preferredSize = [105, -1];
    var txtReadOnly = grpReadOnly.add("edittext", undefined, "Locked / Non-Editable Content", { readonly: true });
    txtReadOnly.alignment = ["fill", "center"];

    // Numeric Limit input
    var grpNum = pnlSingle.add("group");
    grpNum.orientation = "row";
    grpNum.alignment = ["fill", "top"];
    var lblNum = grpNum.add("statictext", undefined, "Numeric Limit (5 char):");
    lblNum.preferredSize = [140, -1];
    var txtNum = grpNum.add("edittext", undefined, "1920");
    txtNum.characters = 5;

    // Multiline Text Area Panel
    var pnlMulti = tabTextInputs.add("panel", undefined, "Multiline EditText (Text Area)");
    pnlMulti.orientation = "column";
    pnlMulti.alignChildren = ["fill", "top"];
    pnlMulti.spacing = 4;

    var txtMulti = pnlMulti.add("edittext", undefined,
        "// Multiline ExtendScript ScriptUI Text Area\n" +
        "var comp = app.project.activeItem;\n" +
        "var layer = comp.layers.addShape();\n" +
        "$.writeln('Testing multiline text editor parity!');",
        { multiline: true }
    );
    txtMulti.preferredSize = [-1, 70];

    // =========================================================================
    // TAB 3: 🔘 SELECTORS, BUTTONS & LISTS SHOWCASE
    // =========================================================================
    var tabSelectors = tabbedPanel.add("tab", undefined, "🔘 Selectors & Lists");
    tabSelectors.orientation = "column";
    tabSelectors.alignChildren = ["fill", "top"];
    tabSelectors.spacing = 8;
    tabSelectors.margins = 10;

    // Buttons Panel
    var pnlButtons = tabSelectors.add("panel", undefined, "Button & IconButton Variations");
    pnlButtons.orientation = "row";
    pnlButtons.alignment = ["fill", "top"];
    pnlButtons.spacing = 6;

    var btnNormal = pnlButtons.add("button", undefined, "Push Button");
    btnNormal.alignment = ["fill", "center"];

    var btnIcon = pnlButtons.add("iconbutton", undefined, undefined);
    btnIcon.text = "⚙️ Settings";
    btnIcon.alignment = ["fill", "center"];

    var btnDisabled = pnlButtons.add("button", undefined, "Disabled");
    btnDisabled.enabled = false;
    btnDisabled.alignment = ["fill", "center"];

    // Checkboxes & Radio Buttons Group
    var pnlChecks = tabSelectors.add("panel", undefined, "Checkboxes & Mutually Exclusive Radio Buttons");
    pnlChecks.orientation = "column";
    pnlChecks.alignChildren = ["fill", "top"];
    pnlChecks.spacing = 6;

    var grpCheckRow = pnlChecks.add("group");
    grpCheckRow.orientation = "row";
    grpCheckRow.alignment = ["fill", "top"];
    var chkDemoA = grpCheckRow.add("checkbox", undefined, "Checkbox Alpha (Checked)");
    chkDemoA.value = true;
    var chkDemoB = grpCheckRow.add("checkbox", undefined, "Checkbox Beta");
    chkDemoB.value = false;

    // Radio button group
    var grpRadio = pnlChecks.add("group");
    grpRadio.orientation = "row";
    grpRadio.alignment = ["fill", "top"];
    grpRadio.spacing = 14;
    var rad1 = grpRadio.add("radiobutton", undefined, "Linear");
    rad1.value = true;
    var rad2 = grpRadio.add("radiobutton", undefined, "Radial");
    var rad3 = grpRadio.add("radiobutton", undefined, "Conic");

    // DropDownList & ListBox Panel
    var pnlLists = tabSelectors.add("panel", undefined, "DropDownList & ListBox Selectors");
    pnlLists.orientation = "column";
    pnlLists.alignChildren = ["fill", "top"];
    pnlLists.spacing = 6;

    // DropDownList
    var grpDrop = pnlLists.add("group");
    grpDrop.orientation = "row";
    grpDrop.alignment = ["fill", "top"];
    var lblDrop = grpDrop.add("statictext", undefined, "DropDownList:");
    lblDrop.preferredSize = [100, -1];
    var dropPresets = grpDrop.add("dropdownlist", undefined, [
        "Full HD 1080p (1920x1080)",
        "Ultra HD 4K (3840x2160)",
        "Square Instagram (1080x1080)",
        "Vertical Reel/Story (1080x1920)",
        "Custom Calibration Bounds"
    ]);
    dropPresets.selection = 0;
    dropPresets.alignment = ["fill", "center"];

    // ListBox
    var lblListBox = pnlLists.add("statictext", undefined, "ListBox (Scrollable Item Collection):");
    var lstLayers = pnlLists.add("listbox", undefined, [
        "Layer 1: [Shape] Calibration Grid",
        "Layer 2: [Text] Segoe UI Pangram",
        "Layer 3: [Text] Arial Pangram",
        "Layer 4: [Text] Georgia Pangram",
        "Layer 5: [Text] Times New Roman",
        "Layer 6: [Text] Courier New",
        "Layer 7: [Shape] Geometric Polygons",
        "Layer 8: [Shape] Stroke Styles Showcase"
    ]);
    lstLayers.preferredSize = [-1, 75];
    lstLayers.selection = 0;

    // =========================================================================
    // TAB 4: 📊 RANGE, SCROLLBARS, TREES & COLOR SWATCHES
    // =========================================================================
    var tabMisc = tabbedPanel.add("tab", undefined, "📊 Range, Trees & Colors");
    tabMisc.orientation = "column";
    tabMisc.alignChildren = ["fill", "top"];
    tabMisc.spacing = 8;
    tabMisc.margins = 10;

    // Color Swatches & Pickers Panel
    var pnlColors = tabMisc.add("panel", undefined, "Color Swatches (Windows ChooseColor & $.colorPicker)");
    pnlColors.orientation = "row";
    pnlColors.alignment = ["fill", "top"];
    pnlColors.spacing = 10;

    // Swatch 1: Primary Fill Color
    var grpCol1 = pnlColors.add("group");
    grpCol1.orientation = "row";
    grpCol1.alignment = ["fill", "center"];
    var lblCol1 = grpCol1.add("statictext", undefined, "Fill:");
    var btnSwatch1 = grpCol1.add("button", undefined, "");
    btnSwatch1.preferredSize = [24, 20];
    btnSwatch1.helpTip = "Click to pick color";
    var txtHex1 = grpCol1.add("edittext", undefined, "#2288EE");
    txtHex1.characters = 7;

    // Swatch 2: Stroke Color
    var grpCol2 = pnlColors.add("group");
    grpCol2.orientation = "row";
    grpCol2.alignment = ["fill", "center"];
    var lblCol2 = grpCol2.add("statictext", undefined, "Stroke:");
    var btnSwatch2 = grpCol2.add("button", undefined, "");
    btnSwatch2.preferredSize = [24, 20];
    btnSwatch2.helpTip = "Click to pick color";
    var txtHex2 = grpCol2.add("edittext", undefined, "#FFFFFF");
    txtHex2.characters = 7;

    // Hook color swatches
    btnSwatch1.onClick = function() {
        if ($.colorPicker) {
            $.colorPicker(txtHex1.text, function(hex) {
                txtHex1.text = hex;
            });
        }
    };
    btnSwatch2.onClick = function() {
        if ($.colorPicker) {
            $.colorPicker(txtHex2.text, function(hex) {
                txtHex2.text = hex;
            });
        }
    };

    // Scrollbar & Range Controls Panel
    var pnlRange = tabMisc.add("panel", undefined, "Scrollbar & Dynamic Range Controls");
    pnlRange.orientation = "column";
    pnlRange.alignChildren = ["fill", "top"];
    pnlRange.spacing = 6;

    var grpScroll = pnlRange.add("group");
    grpScroll.orientation = "row";
    grpScroll.alignment = ["fill", "top"];
    var lblScroll = grpScroll.add("statictext", undefined, "Scrollbar:");
    lblScroll.preferredSize = [70, -1];
    var scrBar = grpScroll.add("scrollbar", undefined, 50, 0, 100);
    scrBar.alignment = ["fill", "center"];
    var txtScroll = grpScroll.add("edittext", undefined, "50");
    txtScroll.characters = 3;

    scrBar.onChanging = function() {
        txtScroll.text = String(Math.round(scrBar.value));
    };
    txtScroll.onChange = function() {
        var v = parseInt(txtScroll.text, 10) || 0;
        scrBar.value = Math.max(0, Math.min(100, v));
    };

    // TreeView Control Panel
    var pnlTree = tabMisc.add("panel", undefined, "Hierarchical TreeView Outline");
    pnlTree.orientation = "column";
    pnlTree.alignChildren = ["fill", "top"];
    pnlTree.spacing = 4;

    var treeControl = pnlTree.add("treeview");
    treeControl.preferredSize = [-1, 95];

    var nodeRoot = treeControl.add("node", "Project: AE Calibration Suite");
    if (nodeRoot && typeof nodeRoot.add === "function") {
        var subComp = nodeRoot.add("node", "Comp: AE_Emulator_Tester_Comp (1920x1080)");
        if (subComp && typeof subComp.add === "function") {
            subComp.add("item", "Layer: TEST_00_Grid_Background");
            subComp.add("item", "Layer: TEST_01_Calibration_Grid");
            subComp.add("item", "Layer: TEST_02_Font_Section_Title");
            subComp.add("item", "Layer: TEST_05_Geometric_Shapes");
            subComp.add("item", "Layer: TEST_07_Stroke_Styles_Showcase");
        }
        var subAssets = nodeRoot.add("node", "Typography Palettes");
        if (subAssets && typeof subAssets.add === "function") {
            subAssets.add("item", "Font: Segoe UI (Clean Modern)");
            subAssets.add("item", "Font: Georgia (Classic Serif)");
            subAssets.add("item", "Font: Courier New (Fixed Width)");
        }
    }

    // -------------------------------------------------------------------------
    // 3. Bottom Subtle Repository Link
    // -------------------------------------------------------------------------
    var grpRepoLink = win.add("group");
    grpRepoLink.orientation = "row";
    grpRepoLink.alignment = ["fill", "bottom"];
    grpRepoLink.alignChildren = ["center", "center"];
    grpRepoLink.margins = [0, 4, 0, 0];
    var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE_JS_builder");
    lblRepoLink.helpTip = "https://github.com/work2survive/AE_JS_builder";
    lblRepoLink.onClick = function() {
        var url = "https://github.com/work2survive/AE_JS_builder";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else {
            system.callSystem('open "' + url + '"');
        }
    };

    // -------------------------------------------------------------------------
    // 4. Composition Builder Engine (All Test Primitives)
    // -------------------------------------------------------------------------
    function ensureActiveComp() {
        var comp = (app.project && app.project.activeItem instanceof CompItem)
            ? app.project.activeItem
            : null;

        if (!comp) {
            comp = app.project.items.addComp("AE_Emulator_Tester_Comp", 1920, 1080, 1, 10, 30);
            if (comp && comp.openInViewer) {
                try { comp.openInViewer(); } catch(e) {}
            }
        }
        return comp;
    }

    function clearTesterLayers(comp) {
        for (var i = comp.layers.length; i >= 1; i--) {
            var lyr = comp.layers[i];
            if (lyr && lyr.name && lyr.name.indexOf("TEST_") === 0) {
                lyr.remove();
            }
        }
    }

    function setupTextDocument(textLayer, textStr, fontName, fontSize, fontColor, justification) {
        var cleanJust = justification || "left";
        var cleanColor = fontColor || [1, 1, 1];
        var cleanSize = fontSize || 20;

        try {
            var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
            if (textProp) {
                var docProp = textProp.property("ADBE Text Document") || textLayer.property("Source Text");
                if (docProp) {
                    var doc = docProp.value;
                    if (doc) {
                        doc.text = textStr;
                        doc.fontSize = cleanSize;
                        doc.font = fontName;
                        doc.fillColor = cleanColor;
                        doc.applyFill = true;
                        doc.applyStroke = false;
                        if (cleanJust === "center") {
                            try { doc.justification = ParagraphJustification.CENTER_JUSTIFY; } catch(e1) {}
                        } else if (cleanJust === "right") {
                            try { doc.justification = ParagraphJustification.RIGHT_JUSTIFY; } catch(e2) {}
                        } else {
                            try { doc.justification = ParagraphJustification.LEFT_JUSTIFY; } catch(e3) {}
                        }
                        docProp.setValue(doc);
                    }
                }
            }
        } catch(eDoc) {}

        // Direct emulator fallbacks
        textLayer.fontSize = cleanSize;
        textLayer.fontFamily = fontName;
        textLayer.font = fontName;
        textLayer.fontColor = cleanColor;
        textLayer.justification = cleanJust;
    }

    function addVectorPath(containerGroup, shapeObj) {
        var pathGroup = containerGroup.property("Contents").addProperty("ADBE Vector Shape - Group");
        var pathProp = pathGroup.property("ADBE Vector Shape") || pathGroup.property("Path") || pathGroup;
        pathProp.setValue(shapeObj);
        return pathGroup;
    }

    function runHarnessBuild() {
        var comp = ensureActiveComp();
        if (!comp) {
            alert("No active composition available.");
            return;
        }

        if (app.beginUndoGroup) {
            app.beginUndoGroup("Build AE Emulator Tester");
        }

        try {
            progBar.value = 10;
            var doGrid = chkGrid.value;
            var doFonts = chkFonts.value;
            var doShapes = chkShapes.value;
            var doStrokes = chkStrokes.value;
            var doGradients = chkGradients.value;
            var doWiggle = chkWiggle.value;

            var baseFontSize = parseInt(txtFontSize.text, 10) || 20;
            var baseStrokeWidth = parseInt(txtStroke.text, 10) || 4;

            clearTesterLayers(comp);
            progBar.value = 25;

            var compW = comp.width;
            var compH = comp.height;
            var centerX = compW / 2;
            var centerY = compH / 2;

            // =================================================================
            // MODULE 1: POSITION CALIBRATION GRID & ORIGIN
            // =================================================================
            if (doGrid) {
                // Background Dark Plate Layer
                var bgLayer = comp.layers.addShape();
                bgLayer.name = "TEST_00_Grid_Background";
                bgLayer.shy = false;
                bgLayer.transform.position.setValue([centerX, centerY, 0]);

                var bgContents = bgLayer.property("Contents");
                var bgGroup = bgContents.addProperty("ADBE Vector Group");
                bgGroup.name = "Dark Canvas Plate";

                var bgRect = bgGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
                bgRect.property("Size").setValue([compW, compH]);
                bgRect.property("Position").setValue([0, 0]);

                var bgFill = bgGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                bgFill.property("Color").setValue([0.08, 0.08, 0.11]); // Deep space dark #14141c
                bgFill.property("Opacity").setValue(100);

                // Grid Lines Shape Layer
                var gridLayer = comp.layers.addShape();
                gridLayer.name = "TEST_01_Calibration_Grid";
                gridLayer.transform.position.setValue([0, 0, 0]);

                var gridContents = gridLayer.property("Contents");

                // Minor Grid Lines (every 50px)
                var minorGroup = gridContents.addProperty("ADBE Vector Group");
                minorGroup.name = "Minor Grid (50px)";
                var minorShape = new Shape();
                minorShape.vertices = [];
                minorShape.inTangents = [];
                minorShape.outTangents = [];

                for (var gx = 50; gx < compW; gx += 50) {
                    if (gx % 100 !== 0) {
                        minorShape.vertices.push([gx, 0]);
                        minorShape.vertices.push([gx, compH]);
                        minorShape.inTangents.push([0, 0]);
                        minorShape.inTangents.push([0, 0]);
                        minorShape.outTangents.push([0, 0]);
                        minorShape.outTangents.push([0, 0]);
                    }
                }
                for (var gy = 50; gy < compH; gy += 50) {
                    if (gy % 100 !== 0) {
                        minorShape.vertices.push([0, gy]);
                        minorShape.vertices.push([compW, gy]);
                        minorShape.inTangents.push([0, 0]);
                        minorShape.inTangents.push([0, 0]);
                        minorShape.outTangents.push([0, 0]);
                        minorShape.outTangents.push([0, 0]);
                    }
                }
                minorShape.closed = false;
                addVectorPath(minorGroup, minorShape);

                var minorStroke = minorGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                minorStroke.property("Color").setValue([0.25, 0.35, 0.50]);
                minorStroke.property("Stroke Width").setValue(1);
                minorStroke.property("Opacity").setValue(18);

                // Major Grid Lines (every 100px)
                var majorGroup = gridContents.addProperty("ADBE Vector Group");
                majorGroup.name = "Major Grid (100px)";
                var majorShape = new Shape();
                majorShape.vertices = [];
                majorShape.inTangents = [];
                majorShape.outTangents = [];

                for (var mx = 100; mx < compW; mx += 100) {
                    majorShape.vertices.push([mx, 0]);
                    majorShape.vertices.push([mx, compH]);
                    majorShape.inTangents.push([0, 0]);
                    majorShape.inTangents.push([0, 0]);
                    majorShape.outTangents.push([0, 0]);
                    majorShape.outTangents.push([0, 0]);
                }
                for (var my = 100; my < compH; my += 100) {
                    majorShape.vertices.push([0, my]);
                    majorShape.vertices.push([compW, my]);
                    majorShape.inTangents.push([0, 0]);
                    majorShape.inTangents.push([0, 0]);
                    majorShape.outTangents.push([0, 0]);
                    majorShape.outTangents.push([0, 0]);
                }
                majorShape.closed = false;
                addVectorPath(majorGroup, majorShape);

                var majorStroke = majorGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                majorStroke.property("Color").setValue([0.35, 0.55, 0.85]);
                majorStroke.property("Stroke Width").setValue(1);
                majorStroke.property("Opacity").setValue(35);

                // Origin Center Crosshairs (at centerX, centerY)
                var centerGroup = gridContents.addProperty("ADBE Vector Group");
                centerGroup.name = "Center Origin Crosshairs";
                var centerShape = new Shape();
                centerShape.vertices = [
                    [centerX, 0], [centerX, compH],
                    [0, centerY], [compW, centerY]
                ];
                centerShape.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
                centerShape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
                centerShape.closed = false;
                addVectorPath(centerGroup, centerShape);

                var centerStroke = centerGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                centerStroke.property("Color").setValue([1.0, 0.65, 0.1]); // Amber gold
                centerStroke.property("Stroke Width").setValue(2);
                centerStroke.property("Opacity").setValue(70);

                // 4 Corner Reference Boxes
                var corners = [
                    [50, 50],
                    [compW - 50, 50],
                    [50, compH - 50],
                    [compW - 50, compH - 50]
                ];
                for (var ci = 0; ci < corners.length; ci++) {
                    var cPos = corners[ci];
                    var boxGroup = gridContents.addProperty("ADBE Vector Group");
                    boxGroup.name = "Corner Box " + (ci + 1);
                    var bRect = boxGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
                    bRect.property("Size").setValue([90, 90]);
                    bRect.property("Position").setValue(cPos);
                    bRect.property("Roundness").setValue(4);

                    var bStroke = boxGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    bStroke.property("Color").setValue([0.2, 0.8, 1.0]);
                    bStroke.property("Stroke Width").setValue(2);
                    bStroke.property("Opacity").setValue(60);
                }
            }
            progBar.value = 45;

            // =================================================================
            // MODULE 2: SYSTEM FONTS & TYPOGRAPHY ("LAZY FOX")
            // =================================================================
            if (doFonts) {
                var txtHead = comp.layers.addText("SYSTEM FONTS & TYPOGRAPHY HARNESS (POSITION & METRICS)");
                txtHead.name = "TEST_02_Font_Section_Title";
                txtHead.transform.position.setValue([110, 95, 0]);
                setupTextDocument(txtHead, "SYSTEM FONTS & TYPOGRAPHY HARNESS (POSITION & METRICS)", "Segoe UI", 14, [0.4, 0.8, 1.0], "left");

                var fontsToTest = [
                    { name: "Segoe UI",        label: "Segoe UI (Standard UI Sans)",      color: [1.0, 1.0, 1.0] },
                    { name: "Arial",           label: "Arial (Universal Sans-Serif)",     color: [0.95, 0.95, 0.95] },
                    { name: "Georgia",         label: "Georgia (Transitional Serif)",     color: [1.0, 0.88, 0.70] },
                    { name: "Times New Roman", label: "Times New Roman (Classic Serif)",  color: [0.90, 0.80, 0.95] },
                    { name: "Courier New",     label: "Courier New (Monospaced)",         color: [0.65, 0.95, 0.75] },
                    { name: "Trebuchet MS",    label: "Trebuchet MS (Humanist Sans)",     color: [1.0, 0.75, 0.40] },
                    { name: "Impact",          label: "Impact (Condensed Display)",       color: [1.0, 0.45, 0.45] }
                ];

                var startY = 145;
                var rowSpacing = 90;
                var pangramSentence = "The quick brown fox jumps over the lazy dog.";
                var numberSymbols = "0123456789 - [!@#$%&*+-=]";

                for (var fi = 0; fi < fontsToTest.length; fi++) {
                    var fInfo = fontsToTest[fi];
                    var posY = startY + (fi * rowSpacing);

                    var lblLyr = comp.layers.addText(fInfo.label);
                    lblLyr.name = "TEST_03_Font_" + (fi + 1) + "_Label";
                    lblLyr.transform.position.setValue([110, posY, 0]);
                    setupTextDocument(lblLyr, "[" + (fi + 1) + "] " + fInfo.label, "Segoe UI", 11, [0.55, 0.65, 0.80], "left");

                    var panLyr = comp.layers.addText(pangramSentence);
                    panLyr.name = "TEST_03_Font_" + (fi + 1) + "_Pangram";
                    panLyr.transform.position.setValue([110, posY + 22, 0]);
                    setupTextDocument(panLyr, pangramSentence, fInfo.name, baseFontSize, fInfo.color, "left");

                    var numLyr = comp.layers.addText(numberSymbols);
                    numLyr.name = "TEST_03_Font_" + (fi + 1) + "_Numbers";
                    numLyr.transform.position.setValue([110, posY + 43, 0]);
                    setupTextDocument(numLyr, numberSymbols, fInfo.name, Math.round(baseFontSize * 0.75), [0.70, 0.75, 0.85], "left");
                }
            }
            progBar.value = 65;

            // =================================================================
            // MODULE 3: GEOMETRIC SHAPES (ELLIPTICAL & POLYGONAL)
            // =================================================================
            if (doShapes) {
                var shapeColX = 1040;

                var shapeHead = comp.layers.addText("GEOMETRIC SHAPES: ELLIPSES & POLYGONS (AE POSSIBILITIES)");
                shapeHead.name = "TEST_04_Shapes_Section_Title";
                shapeHead.transform.position.setValue([shapeColX, 95, 0]);
                setupTextDocument(shapeHead, "GEOMETRIC SHAPES: ELLIPSES & POLYGONS", "Segoe UI", 14, [0.4, 0.8, 1.0], "left");

                var shapeLayer = comp.layers.addShape();
                shapeLayer.name = "TEST_05_Geometric_Shapes";
                shapeLayer.transform.position.setValue([0, 0, 0]);
                if (doWiggle) {
                    shapeLayer.threeDLayer = true;
                    shapeLayer.transform.yRotation.expression = "wiggle(0.4, 15)";
                }

                var sContents = shapeLayer.property("Contents");

                // Row 1 (Y = 175): 5 shapes (Circle, Oval, Triangle, Pentagon, Hexagon)
                // 1. Regular Circle with Radial Gradient Fill
                var grpCircle = sContents.addProperty("ADBE Vector Group");
                grpCircle.name = "1_Circle_Radial_Gradient";
                var ell1 = grpCircle.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
                ell1.property("Size").setValue([76, 76]);
                ell1.property("Position").setValue([1110, 175]);

                if (doGradients) {
                    var gFill1 = grpCircle.property("Contents").addProperty("ADBE Vector Graphic - G-Fill");
                    gFill1.property("Type").setValue(2);
                    gFill1.property("Start Point").setValue([1100, 165]);
                    gFill1.property("End Point").setValue([1145, 210]);
                    gFill1.property("Colors").setValue([
                        [0.0, [1.0, 0.85, 0.1]],
                        [1.0, [0.95, 0.25, 0.1]]
                    ]);
                } else {
                    var fFill1 = grpCircle.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fFill1.property("Color").setValue([1.0, 0.7, 0.1]);
                }
                var sStrk1 = grpCircle.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrk1.property("Color").setValue([1.0, 1.0, 1.0]);
                sStrk1.property("Stroke Width").setValue(baseStrokeWidth);

                // 2. Stretched Ellipse (104x56) with Linear Gradient Fill
                var grpOval = sContents.addProperty("ADBE Vector Group");
                grpOval.name = "2_Oval_Linear_Gradient";
                var ell2 = grpOval.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
                ell2.property("Size").setValue([104, 56]);
                ell2.property("Position").setValue([1245, 175]);

                if (doGradients) {
                    var gFill2 = grpOval.property("Contents").addProperty("ADBE Vector Graphic - G-Fill");
                    gFill2.property("Type").setValue(1);
                    gFill2.property("Start Point").setValue([1195, 175]);
                    gFill2.property("End Point").setValue([1295, 175]);
                    gFill2.property("Colors").setValue([
                        [0.0, [0.0, 0.85, 1.0]],
                        [1.0, [0.85, 0.1, 0.95]]
                    ]);
                } else {
                    var fFill2 = grpOval.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fFill2.property("Color").setValue([0.2, 0.7, 0.9]);
                }
                var sStrk2 = grpOval.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrk2.property("Color").setValue([1.0, 1.0, 1.0]);
                sStrk2.property("Stroke Width").setValue(baseStrokeWidth);

                // 3. Regular Triangle (3-Sided Polygon)
                var grpTri = sContents.addProperty("ADBE Vector Group");
                grpTri.name = "3_Triangle_Polygon";
                var polyTri = grpTri.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyTri.property("Type").setValue(2);
                polyTri.property("Points").setValue(3);
                polyTri.property("Position").setValue([1380, 175]);
                polyTri.property("Outer Radius").setValue(40);

                var fFillTri = grpTri.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillTri.property("Color").setValue([0.95, 0.35, 0.25]);
                var sStrkTri = grpTri.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkTri.property("Color").setValue([1, 1, 1]);
                sStrkTri.property("Stroke Width").setValue(baseStrokeWidth);

                // 4. Pentagon (5-Sided Polygon)
                var grpPent = sContents.addProperty("ADBE Vector Group");
                grpPent.name = "4_Pentagon_Polygon";
                var polyPent = grpPent.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyPent.property("Type").setValue(2);
                polyPent.property("Points").setValue(5);
                polyPent.property("Position").setValue([1515, 175]);
                polyPent.property("Outer Radius").setValue(40);

                var fFillPent = grpPent.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillPent.property("Color").setValue([0.15, 0.75, 0.45]);
                var sStrkPent = grpPent.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkPent.property("Color").setValue([1, 1, 1]);
                sStrkPent.property("Stroke Width").setValue(baseStrokeWidth);

                // 5. Hexagon (6-Sided Polygon) with Gradient Stroke
                var grpHex = sContents.addProperty("ADBE Vector Group");
                grpHex.name = "5_Hexagon_Gradient_Stroke";
                var polyHex = grpHex.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyHex.property("Type").setValue(2);
                polyHex.property("Points").setValue(6);
                polyHex.property("Position").setValue([1650, 175]);
                polyHex.property("Outer Radius").setValue(40);

                var fFillHex = grpHex.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillHex.property("Color").setValue([0.15, 0.20, 0.30]);
                fFillHex.property("Opacity").setValue(85);

                if (doGradients) {
                    var gStrkHex = grpHex.property("Contents").addProperty("ADBE Vector Graphic - G-Stroke");
                    gStrkHex.property("Type").setValue(1);
                    gStrkHex.property("Start Point").setValue([1610, 175]);
                    gStrkHex.property("End Point").setValue([1690, 175]);
                    gStrkHex.property("Colors").setValue([
                        [0.0, [0.0, 1.0, 0.85]],
                        [1.0, [1.0, 0.9, 0.1]]
                    ]);
                    gStrkHex.property("Stroke Width").setValue(baseStrokeWidth + 1.5);
                } else {
                    var sStrkHex = grpHex.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    sStrkHex.property("Color").setValue([0.0, 1.0, 0.85]);
                    sStrkHex.property("Stroke Width").setValue(baseStrokeWidth);
                }

                // Row 2 (Y = 285): 4 shapes (Octagon, Star, Starburst, Concentric Rings)
                // 6. Octagon (8-Sided Polygon)
                var grpOct = sContents.addProperty("ADBE Vector Group");
                grpOct.name = "6_Octagon_Polygon";
                var polyOct = grpOct.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyOct.property("Type").setValue(2);
                polyOct.property("Points").setValue(8);
                polyOct.property("Position").setValue([1110, 285]);
                polyOct.property("Outer Radius").setValue(40);

                var fFillOct = grpOct.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillOct.property("Color").setValue([0.65, 0.25, 0.85]);
                var sStrkOct = grpOct.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkOct.property("Color").setValue([1, 1, 1]);
                sStrkOct.property("Stroke Width").setValue(baseStrokeWidth);

                // 7. 5-Point Star
                var grpStar = sContents.addProperty("ADBE Vector Group");
                grpStar.name = "7_5Point_Star";
                var polyStar = grpStar.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyStar.property("Type").setValue(1);
                polyStar.property("Points").setValue(5);
                polyStar.property("Position").setValue([1245, 285]);
                polyStar.property("Outer Radius").setValue(44);
                polyStar.property("Inner Radius").setValue(19);

                var fFillStar = grpStar.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillStar.property("Color").setValue([1.0, 0.80, 0.05]);
                var sStrkStar = grpStar.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkStar.property("Color").setValue([1, 1, 1]);
                sStrkStar.property("Stroke Width").setValue(baseStrokeWidth);

                // 8. 8-Point Starburst
                var grpBurst = sContents.addProperty("ADBE Vector Group");
                grpBurst.name = "8_8Point_Starburst";
                var polyBurst = grpBurst.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyBurst.property("Type").setValue(1);
                polyBurst.property("Points").setValue(8);
                polyBurst.property("Position").setValue([1380, 285]);
                polyBurst.property("Outer Radius").setValue(44);
                polyBurst.property("Inner Radius").setValue(25);

                var fFillBurst = grpBurst.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillBurst.property("Color").setValue([0.95, 0.20, 0.50]);
                var sStrkBurst = grpBurst.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkBurst.property("Color").setValue([1, 1, 1]);
                sStrkBurst.property("Stroke Width").setValue(baseStrokeWidth);

                // 9. Concentric Elliptical Rings
                var grpRings = sContents.addProperty("ADBE Vector Group");
                grpRings.name = "9_Concentric_Rings";
                for (var rIdx = 1; rIdx <= 3; rIdx++) {
                    var rRad = rIdx * 14;
                    var cRing = grpRings.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
                    cRing.property("Size").setValue([rRad * 2, rRad * 2]);
                    cRing.property("Position").setValue([1515, 285]);
                }
                var sStrkRings = grpRings.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkRings.property("Color").setValue([0.2, 0.8, 1.0]);
                sStrkRings.property("Stroke Width").setValue(2);
            }
            progBar.value = 85;

            // =================================================================
            // MODULE 4: STROKE STYLES (CAPS, JOINS, DASHES & GAPS)
            // =================================================================
            if (doStrokes) {
                var strokeColX = 1040;
                var strokeTopY = 380;

                var strkHead = comp.layers.addText("STROKE STYLES SHOWCASE (LINE CAPS, JOINS, DASHES & GAPS)");
                strkHead.name = "TEST_06_Strokes_Section_Title";
                strkHead.transform.position.setValue([strokeColX, strokeTopY, 0]);
                setupTextDocument(strkHead, "STROKE STYLES SHOWCASE (CAPS, JOINS, DASHES)", "Segoe UI", 14, [0.4, 0.8, 1.0], "left");

                var strokeLayer = comp.layers.addShape();
                strokeLayer.name = "TEST_07_Stroke_Styles_Showcase";
                strokeLayer.transform.position.setValue([0, 0, 0]);

                var strkContents = strokeLayer.property("Contents");

                // Line Caps (Butt vs Round vs Projecting)
                var capLabels = [
                    { cap: 1, name: "Butt Cap (1)",        y: strokeTopY + 45,  col: [0.95, 0.4, 0.3] },
                    { cap: 2, name: "Round Cap (2)",       y: strokeTopY + 80,  col: [0.3, 0.85, 0.5] },
                    { cap: 3, name: "Projecting Cap (3)",  y: strokeTopY + 115, col: [0.3, 0.65, 1.0] }
                ];

                for (var cIdx = 0; cIdx < capLabels.length; cIdx++) {
                    var capInfo = capLabels[cIdx];

                    var cLbl = comp.layers.addText(capInfo.name);
                    cLbl.name = "TEST_08_Cap_" + (cIdx + 1) + "_Label";
                    cLbl.transform.position.setValue([strokeColX, capInfo.y - 10, 0]);
                    setupTextDocument(cLbl, capInfo.name, "Segoe UI", 11, [0.75, 0.80, 0.90], "left");

                    var capGroup = strkContents.addProperty("ADBE Vector Group");
                    capGroup.name = "Cap_Line_" + capInfo.name;
                    var cShape = new Shape();
                    cShape.vertices = [[strokeColX + 140, capInfo.y], [strokeColX + 320, capInfo.y]];
                    cShape.inTangents = [[0, 0], [0, 0]];
                    cShape.outTangents = [[0, 0], [0, 0]];
                    cShape.closed = false;
                    addVectorPath(capGroup, cShape);

                    var cStroke = capGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    cStroke.property("Color").setValue(capInfo.col);
                    cStroke.property("Stroke Width").setValue(11);
                    cStroke.property("Line Cap").setValue(capInfo.cap);
                }

                // Line Joins (Miter vs Round vs Bevel)
                var joinLabels = [
                    { join: 1, name: "Miter Join (1)", y: strokeTopY + 45,  xOff: 360, col: [1.0, 0.75, 0.2] },
                    { join: 2, name: "Round Join (2)", y: strokeTopY + 80,  xOff: 360, col: [0.85, 0.35, 0.9] },
                    { join: 3, name: "Bevel Join (3)", y: strokeTopY + 115, xOff: 360, col: [0.2, 0.9, 0.85] }
                ];

                for (var jIdx = 0; jIdx < joinLabels.length; jIdx++) {
                    var joinInfo = joinLabels[jIdx];

                    var jLbl = comp.layers.addText(joinInfo.name);
                    jLbl.name = "TEST_09_Join_" + (jIdx + 1) + "_Label";
                    jLbl.transform.position.setValue([strokeColX + joinInfo.xOff, joinInfo.y - 10, 0]);
                    setupTextDocument(jLbl, joinInfo.name, "Segoe UI", 11, [0.75, 0.80, 0.90], "left");

                    var jGroup = strkContents.addProperty("ADBE Vector Group");
                    jGroup.name = "Join_Path_" + joinInfo.name;
                    var jShape = new Shape();
                    var jBaseX = strokeColX + joinInfo.xOff + 115;
                    jShape.vertices = [
                        [jBaseX, joinInfo.y + 10],
                        [jBaseX + 30, joinInfo.y - 10],
                        [jBaseX + 60, joinInfo.y + 10],
                        [jBaseX + 90, joinInfo.y - 10]
                    ];
                    jShape.inTangents = [[0, 0], [0, 0]];
                    jShape.outTangents = [[0, 0], [0, 0]];
                    jShape.closed = false;
                    addVectorPath(jGroup, jShape);

                    var jStroke = jGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    jStroke.property("Color").setValue(joinInfo.col);
                    jStroke.property("Stroke Width").setValue(8);
                    jStroke.property("Line Join").setValue(joinInfo.join);
                    jStroke.property("Miter Limit").setValue(4);
                }

                // Dashes & Gaps Patterns
                var dashTopY = strokeTopY + 160;
                var dashPatterns = [
                    { name: "Solid Line (No Dash)",           dash: null,       cap: 1, col: [1.0, 1.0, 1.0] },
                    { name: "Standard Dash (16px / 8px Gap)", dash: [16, 8],    cap: 1, col: [0.2, 0.8, 1.0] },
                    { name: "Dotted Pearls (Round + 0 Dash)", dash: [0, 16],    cap: 2, col: [1.0, 0.85, 0.2] },
                    { name: "Dual Rhythm (24/8/6/8 Pattern)", dash: [24, 8, 6, 8], cap: 1, col: [0.95, 0.35, 0.7] }
                ];

                for (var dIdx = 0; dIdx < dashPatterns.length; dIdx++) {
                    var dPat = dashPatterns[dIdx];
                    var dY = dashTopY + (dIdx * 42);

                    var dLbl = comp.layers.addText(dPat.name);
                    dLbl.name = "TEST_10_Dash_" + (dIdx + 1) + "_Label";
                    dLbl.transform.position.setValue([strokeColX, dY - 8, 0]);
                    setupTextDocument(dLbl, dPat.name, "Segoe UI", 11, [0.70, 0.75, 0.85], "left");

                    var dGroup = strkContents.addProperty("ADBE Vector Group");
                    dGroup.name = "Dash_Pattern_" + (dIdx + 1);
                    var dShape = new Shape();
                    dShape.vertices = [[strokeColX + 220, dY], [strokeColX + 660, dY]];
                    dShape.inTangents = [[0, 0], [0, 0]];
                    dShape.outTangents = [[0, 0], [0, 0]];
                    dShape.closed = false;
                    addVectorPath(dGroup, dShape);

                    var dStroke = dGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    dStroke.property("Color").setValue(dPat.col);
                    dStroke.property("Stroke Width").setValue(baseStrokeWidth + 1.5);
                    dStroke.property("Line Cap").setValue(dPat.cap);

                    if (dPat.dash) {
                        try {
                            var dashesGroup = dStroke.property("ADBE Vector Stroke Dashes") || dStroke.property("Dashes");
                            if (dashesGroup) {
                                var d1 = dashesGroup.addProperty("ADBE Vector Stroke Dash 1");
                                if (d1) d1.setValue(dPat.dash[0]);
                                var g1 = dashesGroup.addProperty("ADBE Vector Stroke Gap 1");
                                if (g1) g1.setValue(dPat.dash[1]);

                                if (dPat.dash.length >= 4) {
                                    var d2 = dashesGroup.addProperty("ADBE Vector Stroke Dash 2");
                                    if (d2) d2.setValue(dPat.dash[2]);
                                    var g2 = dashesGroup.addProperty("ADBE Vector Stroke Gap 2");
                                    if (g2) g2.setValue(dPat.dash[3]);
                                }
                            }
                        } catch(eDash) {}
                        dStroke.dashArray = dPat.dash;
                    }
                }
            }

            progBar.value = 100;
            $.writeln("Success: AE Emulator Tester harness built with all test modules!");

        } catch (err) {
            alert("Error building tester comp:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) {
                app.endUndoGroup();
            }
        }
    }

    btnBuild.onClick = function() {
        runHarnessBuild();
    };

    btnClear.onClick = function() {
        var comp = app.project ? app.project.activeItem : null;
        if (comp && comp instanceof CompItem) {
            clearTesterLayers(comp);
            progBar.value = 0;
            $.writeln("Tester layers cleared.");
        }
    };

    // Auto-run build immediately when executed or loaded
    runHarnessBuild();

    win.layout.layout(true);
    win.onResizing = win.onResize = function() { this.layout.resize(); };

    if (win instanceof Window) {
        win.center();
        win.show();
    }

})(this);
