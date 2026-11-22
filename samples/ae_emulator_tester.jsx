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
//        the lazy dog" pangram, numerics, and glyphs (Myriad Pro [Adobe CC default],
//        Segoe UI [Windows default] / Helvetica Neue [Apple macOS default], Arial,
//        Verdana, Georgia, Times New Roman, Courier New, Impact).
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
    var SCRIPT_VERSION = "v1.3.0";

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

    var chkTextProps = pnlModules.add("checkbox", undefined, "Text Properties & Box Metrics (Words, Lines & Effects)");
    chkTextProps.value = true;

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

    // Word Count & Line Count Sliders & Text Box Metrics Panel
    var pnlAmounts = tabTextInputs.add("panel", undefined, "Text Metrics & Word/Line Count Sliders");
    pnlAmounts.orientation = "column";
    pnlAmounts.alignChildren = ["fill", "top"];
    pnlAmounts.spacing = 6;

    // Word Count Slider + Checkbox
    var grpWords = pnlAmounts.add("group");
    grpWords.orientation = "row";
    grpWords.alignment = ["fill", "top"];
    var chkWords = grpWords.add("checkbox", undefined, "Amount of Words:");
    chkWords.value = true;
    chkWords.preferredSize = [130, -1];
    var sldWords = grpWords.add("slider", undefined, 14, 1, 50);
    sldWords.minvalue = 1;
    sldWords.maxvalue = 50;
    sldWords.value = 14;
    sldWords.alignment = ["fill", "center"];
    var txtWords = grpWords.add("edittext", undefined, "14");
    txtWords.characters = 3;

    // Line Count Slider + Checkbox
    var grpLines = pnlAmounts.add("group");
    grpLines.orientation = "row";
    grpLines.alignment = ["fill", "top"];
    var chkLines = grpLines.add("checkbox", undefined, "Amount of Text Lines:");
    chkLines.value = true;
    chkLines.preferredSize = [130, -1];
    var sldLines = grpLines.add("slider", undefined, 3, 1, 20);
    sldLines.minvalue = 1;
    sldLines.maxvalue = 20;
    sldLines.value = 3;
    sldLines.alignment = ["fill", "center"];
    var txtLines = grpLines.add("edittext", undefined, "3");
    txtLines.characters = 3;

    hookSliderText(sldWords, txtWords, 1, 50);
    hookSliderText(sldLines, txtLines, 1, 20);

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
    try {
        if (app.project && app.project.activeItem instanceof CompItem) {
            var actC = app.project.activeItem;
            if (actC.width === 3840 && actC.height === 2160) {
                dropPresets.selection = 1;
            } else if (actC.width === 1080 && actC.height === 1080) {
                dropPresets.selection = 2;
            } else if (actC.width === 1080 && actC.height === 1920) {
                dropPresets.selection = 3;
            }
        }
    } catch(ePreset) {}
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
            subComp.add("item", "Layer: TEST_00_Comp_Resolution_Badge");
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
            var w = 1920;
            var h = 1080;
            try {
                if (typeof dropPresets !== "undefined" && dropPresets && dropPresets.selection) {
                    var sIdx = dropPresets.selection.index;
                    if (sIdx === 1) { w = 3840; h = 2160; }
                    else if (sIdx === 2) { w = 1080; h = 1080; }
                    else if (sIdx === 3) { w = 1080; h = 1920; }
                }
            } catch(ePresetIdx) {}
            comp = app.project.items.addComp("AE_Emulator_Tester_Comp", w, h, 1, 10, 30);
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

    function setupTextDocument(textLayer, textStr, fontName, fontSize, fontColor, justification, altFontName) {
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
                        if (fontName) {
                            try {
                                doc.font = fontName;
                            } catch (eF1) {
                                if (altFontName) {
                                    try { doc.font = altFontName; } catch (eF2) {}
                                }
                            }
                        }
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
        textLayer.fontFamily = fontName || "sans-serif";
        textLayer.font = fontName || "sans-serif";
        textLayer.fontColor = cleanColor;
        textLayer.justification = cleanJust;
    }

    function makeLineShape(x1, y1, x2, y2) {
        var s = new Shape();
        s.vertices = [[x1, y1], [x2, y2]];
        s.inTangents = [[0, 0], [0, 0]];
        s.outTangents = [[0, 0], [0, 0]];
        s.closed = false;
        return s;
    }

    function addVectorPath(containerGroup, shapeObj) {
        if (!shapeObj || !shapeObj.vertices || shapeObj.vertices.length === 0) return null;
        var contents = containerGroup.property("Contents") || containerGroup;
        var pathGroup = contents.addProperty("ADBE Vector Shape - Group");
        var pathProp = pathGroup.property("ADBE Vector Shape") || pathGroup.property("Path") || pathGroup;
        pathProp.setValue(shapeObj);
        return pathGroup;
    }

    function setGradientColors(gradProp, colorStops) {
        if (!gradProp) return;
        try {
            var cProp = gradProp.property("ADBE Vector Grad Colors") || gradProp.property("Colors");
            if (cProp) {
                // In native AE ExtendScript, ADBE Vector Grad Colors has PropertyValueType.NO_VALUE and throws.
                // In our web emulator runtime, it is a custom gradient property that accepts the color stops array.
                if (typeof PropertyValueType !== "undefined" && cProp.propertyValueType === PropertyValueType.NO_VALUE) {
                    return;
                }
                cProp.setValue(colorStops);
            }
        } catch (eGrad) {}
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
            var doTextProps = chkTextProps.value;
            var doWiggle = chkWiggle.value;

            var baseFontSize = parseInt(txtFontSize.text, 10) || 15;
            var baseStrokeWidth = parseInt(txtStroke.text, 10) || 3;

            clearTesterLayers(comp);
            progBar.value = 25;

            var compW = comp.width;
            var compH = comp.height;
            var centerX = compW / 2;
            var centerY = compH / 2;

            // Global scale factor relative to 1920x1080 design reference (e.g. 2.0 on 4K)
            var sF = Math.min(compW / 1920, compH / 1080);
            if (sF < 0.2) sF = 0.2;

            var scaledFontSize = Math.max(9, Math.round(baseFontSize * sF));
            var scaledStrokeWidth = Math.max(1, Math.round(baseStrokeWidth * sF));

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

                // Dynamic grid steps proportional to resolution
                var minorStep = Math.round(50 * sF);
                var majorStep = Math.round(100 * sF);
                if (minorStep < 20) minorStep = 20;
                if (majorStep < 40) majorStep = 40;

                // Minor Grid Lines
                var minorGroup = gridContents.addProperty("ADBE Vector Group");
                minorGroup.name = "Minor Grid (" + minorStep + "px)";

                for (var gx = minorStep; gx < compW; gx += minorStep) {
                    if (gx % majorStep !== 0) {
                        addVectorPath(minorGroup, makeLineShape(gx, 0, gx, compH));
                    }
                }
                for (var gy = minorStep; gy < compH; gy += minorStep) {
                    if (gy % majorStep !== 0) {
                        addVectorPath(minorGroup, makeLineShape(0, gy, compW, gy));
                    }
                }

                var minorStroke = minorGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                minorStroke.property("Color").setValue([0.25, 0.35, 0.50]);
                minorStroke.property("Stroke Width").setValue(Math.max(1, Math.round(1 * sF)));
                minorStroke.property("Opacity").setValue(18);

                // Major Grid Lines
                var majorGroup = gridContents.addProperty("ADBE Vector Group");
                majorGroup.name = "Major Grid (" + majorStep + "px)";

                for (var mx = majorStep; mx < compW; mx += majorStep) {
                    addVectorPath(majorGroup, makeLineShape(mx, 0, mx, compH));
                }
                for (var my = majorStep; my < compH; my += majorStep) {
                    addVectorPath(majorGroup, makeLineShape(0, my, compW, my));
                }

                var majorStroke = majorGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                majorStroke.property("Color").setValue([0.35, 0.55, 0.85]);
                majorStroke.property("Stroke Width").setValue(Math.max(1, Math.round(1 * sF)));
                majorStroke.property("Opacity").setValue(35);

                // Origin Center Crosshairs (at centerX, centerY)
                var centerGroup = gridContents.addProperty("ADBE Vector Group");
                centerGroup.name = "Center Origin Crosshairs";
                addVectorPath(centerGroup, makeLineShape(centerX, 0, centerX, compH));
                addVectorPath(centerGroup, makeLineShape(0, centerY, compW, centerY));

                var centerStroke = centerGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                centerStroke.property("Color").setValue([1.0, 0.65, 0.1]); // Amber gold
                centerStroke.property("Stroke Width").setValue(Math.max(1, Math.round(2 * sF)));
                centerStroke.property("Opacity").setValue(70);

                // 4 Corner Reference Boxes
                var cornerOffset = Math.round(50 * sF);
                var cornerBoxSize = Math.round(90 * sF);
                var corners = [
                    [cornerOffset, cornerOffset],
                    [compW - cornerOffset, cornerOffset],
                    [cornerOffset, compH - cornerOffset],
                    [compW - cornerOffset, compH - cornerOffset]
                ];
                for (var ci = 0; ci < corners.length; ci++) {
                    var cPos = corners[ci];
                    var boxGroup = gridContents.addProperty("ADBE Vector Group");
                    boxGroup.name = "Corner Box " + (ci + 1);
                    var bRect = boxGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
                    bRect.property("Size").setValue([cornerBoxSize, cornerBoxSize]);
                    bRect.property("Position").setValue(cPos);
                    bRect.property("Roundness").setValue(Math.max(2, Math.round(4 * sF)));

                    var bStroke = boxGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    bStroke.property("Color").setValue([0.2, 0.8, 1.0]);
                    bStroke.property("Stroke Width").setValue(Math.max(1, Math.round(2 * sF)));
                    bStroke.property("Opacity").setValue(60);
                }

                // Composition Resolution Header (at the top of the grid)
                var resTag = compW + " × " + compH;
                if (compW === 3840 && compH === 2160) {
                    resTag += " (4K UHD)";
                } else if (compW === 1920 && compH === 1080) {
                    resTag += " (Full HD 1080p)";
                } else if (compW === 1280 && compH === 720) {
                    resTag += " (HD 720p)";
                } else if (compW === 2560 && compH === 1440) {
                    resTag += " (QHD 1440p)";
                } else if (compW === 1080 && compH === 1080) {
                    resTag += " (Square 1:1)";
                } else if (compW === 1080 && compH === 1920) {
                    resTag += " (Vertical 9:16)";
                }

                var resTitleText = "COMP RESOLUTION: " + resTag;
                var resBadgeLayer = comp.layers.addText(resTitleText);
                resBadgeLayer.name = "TEST_00_Comp_Resolution_Badge";
                resBadgeLayer.transform.position.setValue([centerX, Math.round(48 * sF), 0]);
                setupTextDocument(resBadgeLayer, resTitleText, "Segoe UI", Math.round(14 * sF), [0.35, 0.80, 1.0], "center");
            }
            progBar.value = 45;

            // =================================================================
            // MODULE 2: SYSTEM FONTS & TYPOGRAPHY ("LAZY FOX")
            // =================================================================
            if (doFonts) {
                var isMac = false;
                try {
                    if (typeof $.os !== "undefined" && $.os.indexOf("Mac") !== -1) {
                        isMac = true;
                    } else if (typeof navigator !== "undefined" && navigator.platform && navigator.platform.indexOf("Mac") !== -1) {
                        isMac = true;
                    }
                } catch(eOs) {}

                var osSansName  = isMac ? "HelveticaNeue" : "SegoeUI";
                var osSansAlt   = isMac ? "Helvetica Neue" : "Segoe UI";
                var osSansLabel = isMac ? "Helvetica Neue (Apple macOS System Sans)" : "Segoe UI (Windows System Sans)";

                var fontColX = Math.round(110 * sF);
                var txtHead = comp.layers.addText("SYSTEM & ADOBE TYPOGRAPHY HARNESS (WIN, MAC & ADOBE DEFAULTS)");
                txtHead.name = "TEST_02_Font_Section_Title";
                txtHead.transform.position.setValue([fontColX, Math.round(95 * sF), 0]);
                setupTextDocument(txtHead, "SYSTEM & ADOBE TYPOGRAPHY (WIN, MAC & AE DEFAULTS)", osSansAlt, Math.round(14 * sF), [0.4, 0.8, 1.0], "left", "Arial");

                var fontsToTest = [
                    { name: "MyriadPro-Regular", alt: "Myriad Pro",        label: "Myriad Pro (Adobe CC Default Sans)",       color: [0.35, 0.85, 1.0] },
                    { name: osSansName,          alt: osSansAlt,           label: osSansLabel,                               color: [1.0, 1.0, 1.0] },
                    { name: "ArialMT",           alt: "Arial",             label: "Arial (Universal Core Sans-Serif)",       color: [0.95, 0.95, 0.95] },
                    { name: "Verdana",           alt: "Verdana",           label: "Verdana (Universal Screen Sans)",         color: [1.0, 0.80, 0.40] },
                    { name: "Georgia",           alt: "Georgia",           label: "Georgia (Universal Transitional Serif)",  color: [1.0, 0.88, 0.70] },
                    { name: "TimesNewRomanPSMT", alt: "Times New Roman",   label: "Times New Roman (Classic Book Serif)",     color: [0.90, 0.80, 0.95] },
                    { name: "CourierNewPSMT",    alt: "Courier New",       label: "Courier New (Universal Monospaced)",       color: [0.65, 0.95, 0.75] },
                    { name: "Impact",            alt: "Impact",            label: "Impact (Universal Condensed Display)",     color: [1.0, 0.45, 0.45] }
                ];

                var startY = Math.round(135 * sF);
                var rowSpacing = Math.round(82 * sF);
                var pangramSentence = "The quick brown fox jumps over the lazy dog.";
                var numberSymbols = "0123456789 - [!@#$%&*+-=]";

                for (var fi = 0; fi < fontsToTest.length; fi++) {
                    var fInfo = fontsToTest[fi];
                    var posY = startY + (fi * rowSpacing);

                    var lblLyr = comp.layers.addText(fInfo.label);
                    lblLyr.name = "TEST_03_Font_" + (fi + 1) + "_Label";
                    lblLyr.transform.position.setValue([fontColX, posY, 0]);
                    setupTextDocument(lblLyr, "[" + (fi + 1) + "] " + fInfo.label, osSansAlt, Math.round(11 * sF), [0.55, 0.65, 0.80], "left", "Arial");

                    var panLyr = comp.layers.addText(pangramSentence);
                    panLyr.name = "TEST_03_Font_" + (fi + 1) + "_Pangram";
                    panLyr.transform.position.setValue([fontColX, posY + Math.round(20 * sF), 0]);
                    setupTextDocument(panLyr, pangramSentence, fInfo.name, scaledFontSize, fInfo.color, "left", fInfo.alt);

                    var numLyr = comp.layers.addText(numberSymbols);
                    numLyr.name = "TEST_03_Font_" + (fi + 1) + "_Numbers";
                    numLyr.transform.position.setValue([fontColX, posY + Math.round(39 * sF), 0]);
                    setupTextDocument(numLyr, numberSymbols, fInfo.name, Math.max(7, Math.round(scaledFontSize * 0.75)), [0.70, 0.75, 0.85], "left", fInfo.alt);
                }
            }
            progBar.value = 65;

            // =================================================================
            // MODULE 3: GEOMETRIC SHAPES (ELLIPTICAL & POLYGONAL)
            // =================================================================
            if (doShapes) {
                var shapeColX = Math.round(1040 * sF);

                var shapeHead = comp.layers.addText("GEOMETRIC SHAPES: ELLIPSES & POLYGONS (AE POSSIBILITIES)");
                shapeHead.name = "TEST_04_Shapes_Section_Title";
                shapeHead.transform.position.setValue([shapeColX, Math.round(95 * sF), 0]);
                setupTextDocument(shapeHead, "GEOMETRIC SHAPES: ELLIPSES & POLYGONS", "Segoe UI", Math.round(14 * sF), [0.4, 0.8, 1.0], "left");

                var shapeLayer = comp.layers.addShape();
                shapeLayer.name = "TEST_05_Geometric_Shapes";
                shapeLayer.transform.position.setValue([0, 0, 0]);
                if (doWiggle) {
                    shapeLayer.threeDLayer = true;
                    shapeLayer.transform.yRotation.expression = "wiggle(0.4, 15)";
                }

                var sContents = shapeLayer.property("Contents");

                var row1Y = Math.round(175 * sF);
                var row2Y = Math.round(285 * sF);

                // Row 1 (5 shapes): Circle, Oval, Triangle, Pentagon, Hexagon
                // 1. Regular Circle with Radial Gradient Fill
                var grpCircle = sContents.addProperty("ADBE Vector Group");
                grpCircle.name = "1_Circle_Radial_Gradient";
                var ell1 = grpCircle.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
                ell1.property("Size").setValue([Math.round(76 * sF), Math.round(76 * sF)]);
                ell1.property("Position").setValue([Math.round(1110 * sF), row1Y]);

                if (doGradients) {
                    try {
                        var gFill1 = grpCircle.property("Contents").addProperty("ADBE Vector Graphic - G-Fill");
                        gFill1.property("Type").setValue(2);
                        gFill1.property("Start Point").setValue([Math.round(1100 * sF), row1Y - Math.round(10 * sF)]);
                        gFill1.property("End Point").setValue([Math.round(1145 * sF), row1Y + Math.round(35 * sF)]);
                        setGradientColors(gFill1, [
                            [0.0, [1.0, 0.85, 0.1]],
                            [1.0, [0.95, 0.25, 0.1]]
                        ]);
                    } catch(eGF1) {
                        var fFill1 = grpCircle.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                        fFill1.property("Color").setValue([1.0, 0.7, 0.1]);
                    }
                } else {
                    var fFill1 = grpCircle.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fFill1.property("Color").setValue([1.0, 0.7, 0.1]);
                }
                var sStrk1 = grpCircle.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrk1.property("Color").setValue([1.0, 1.0, 1.0]);
                sStrk1.property("Stroke Width").setValue(scaledStrokeWidth);

                // 2. Stretched Ellipse with Linear Gradient Fill
                var grpOval = sContents.addProperty("ADBE Vector Group");
                grpOval.name = "2_Oval_Linear_Gradient";
                var ell2 = grpOval.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
                ell2.property("Size").setValue([Math.round(104 * sF), Math.round(56 * sF)]);
                ell2.property("Position").setValue([Math.round(1245 * sF), row1Y]);

                if (doGradients) {
                    try {
                        var gFill2 = grpOval.property("Contents").addProperty("ADBE Vector Graphic - G-Fill");
                        gFill2.property("Type").setValue(1);
                        gFill2.property("Start Point").setValue([Math.round(1195 * sF), row1Y]);
                        gFill2.property("End Point").setValue([Math.round(1295 * sF), row1Y]);
                        setGradientColors(gFill2, [
                            [0.0, [0.0, 0.85, 1.0]],
                            [1.0, [0.85, 0.1, 0.95]]
                        ]);
                    } catch(eGF2) {
                        var fFill2 = grpOval.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                        fFill2.property("Color").setValue([0.2, 0.7, 0.9]);
                    }
                } else {
                    var fFill2 = grpOval.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fFill2.property("Color").setValue([0.2, 0.7, 0.9]);
                }
                var sStrk2 = grpOval.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrk2.property("Color").setValue([1.0, 1.0, 1.0]);
                sStrk2.property("Stroke Width").setValue(scaledStrokeWidth);

                // 3. Regular Triangle (3-Sided Polygon)
                var grpTri = sContents.addProperty("ADBE Vector Group");
                grpTri.name = "3_Triangle_Polygon";
                var polyTri = grpTri.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyTri.property("Type").setValue(2);
                polyTri.property("Points").setValue(3);
                polyTri.property("Position").setValue([Math.round(1380 * sF), row1Y]);
                polyTri.property("Outer Radius").setValue(Math.round(40 * sF));

                var fFillTri = grpTri.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillTri.property("Color").setValue([0.95, 0.35, 0.25]);
                var sStrkTri = grpTri.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkTri.property("Color").setValue([1, 1, 1]);
                sStrkTri.property("Stroke Width").setValue(scaledStrokeWidth);

                // 4. Pentagon (5-Sided Polygon)
                var grpPent = sContents.addProperty("ADBE Vector Group");
                grpPent.name = "4_Pentagon_Polygon";
                var polyPent = grpPent.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyPent.property("Type").setValue(2);
                polyPent.property("Points").setValue(5);
                polyPent.property("Position").setValue([Math.round(1515 * sF), row1Y]);
                polyPent.property("Outer Radius").setValue(Math.round(40 * sF));

                var fFillPent = grpPent.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillPent.property("Color").setValue([0.15, 0.75, 0.45]);
                var sStrkPent = grpPent.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkPent.property("Color").setValue([1, 1, 1]);
                sStrkPent.property("Stroke Width").setValue(scaledStrokeWidth);

                // 5. Hexagon (6-Sided Polygon) with Gradient Stroke
                var grpHex = sContents.addProperty("ADBE Vector Group");
                grpHex.name = "5_Hexagon_Gradient_Stroke";
                var polyHex = grpHex.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyHex.property("Type").setValue(2);
                polyHex.property("Points").setValue(6);
                polyHex.property("Position").setValue([Math.round(1650 * sF), row1Y]);
                polyHex.property("Outer Radius").setValue(Math.round(40 * sF));

                var fFillHex = grpHex.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillHex.property("Color").setValue([0.15, 0.20, 0.30]);
                fFillHex.property("Opacity").setValue(85);

                if (doGradients) {
                    try {
                        var gStrkHex = grpHex.property("Contents").addProperty("ADBE Vector Graphic - G-Stroke");
                        gStrkHex.property("Type").setValue(1);
                        gStrkHex.property("Start Point").setValue([Math.round(1610 * sF), row1Y]);
                        gStrkHex.property("End Point").setValue([Math.round(1690 * sF), row1Y]);
                        setGradientColors(gStrkHex, [
                            [0.0, [0.0, 1.0, 0.85]],
                            [1.0, [1.0, 0.9, 0.1]]
                        ]);
                        gStrkHex.property("Stroke Width").setValue(scaledStrokeWidth + Math.round(1.5 * sF));
                    } catch(eGS) {
                        var sStrkHex = grpHex.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                        sStrkHex.property("Color").setValue([0.0, 1.0, 0.85]);
                        sStrkHex.property("Stroke Width").setValue(scaledStrokeWidth);
                    }
                } else {
                    var sStrkHex = grpHex.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    sStrkHex.property("Color").setValue([0.0, 1.0, 0.85]);
                    sStrkHex.property("Stroke Width").setValue(scaledStrokeWidth);
                }

                // Row 2 (4 shapes): Octagon, Star, Starburst, Concentric Rings
                // 6. Octagon (8-Sided Polygon)
                var grpOct = sContents.addProperty("ADBE Vector Group");
                grpOct.name = "6_Octagon_Polygon";
                var polyOct = grpOct.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyOct.property("Type").setValue(2);
                polyOct.property("Points").setValue(8);
                polyOct.property("Position").setValue([Math.round(1110 * sF), row2Y]);
                polyOct.property("Outer Radius").setValue(Math.round(40 * sF));

                var fFillOct = grpOct.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillOct.property("Color").setValue([0.65, 0.25, 0.85]);
                var sStrkOct = grpOct.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkOct.property("Color").setValue([1, 1, 1]);
                sStrkOct.property("Stroke Width").setValue(scaledStrokeWidth);

                // 7. 5-Point Star
                var grpStar = sContents.addProperty("ADBE Vector Group");
                grpStar.name = "7_5Point_Star";
                var polyStar = grpStar.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyStar.property("Type").setValue(1);
                polyStar.property("Points").setValue(5);
                polyStar.property("Position").setValue([Math.round(1245 * sF), row2Y]);
                polyStar.property("Outer Radius").setValue(Math.round(44 * sF));
                polyStar.property("Inner Radius").setValue(Math.round(19 * sF));

                var fFillStar = grpStar.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillStar.property("Color").setValue([1.0, 0.80, 0.05]);
                var sStrkStar = grpStar.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkStar.property("Color").setValue([1, 1, 1]);
                sStrkStar.property("Stroke Width").setValue(scaledStrokeWidth);

                // 8. 8-Point Starburst
                var grpBurst = sContents.addProperty("ADBE Vector Group");
                grpBurst.name = "8_8Point_Starburst";
                var polyBurst = grpBurst.property("Contents").addProperty("ADBE Vector Shape - Star");
                polyBurst.property("Type").setValue(1);
                polyBurst.property("Points").setValue(8);
                polyBurst.property("Position").setValue([Math.round(1380 * sF), row2Y]);
                polyBurst.property("Outer Radius").setValue(Math.round(44 * sF));
                polyBurst.property("Inner Radius").setValue(Math.round(25 * sF));

                var fFillBurst = grpBurst.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                fFillBurst.property("Color").setValue([0.95, 0.20, 0.50]);
                var sStrkBurst = grpBurst.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkBurst.property("Color").setValue([1, 1, 1]);
                sStrkBurst.property("Stroke Width").setValue(scaledStrokeWidth);

                // 9. Concentric Elliptical Rings
                var grpRings = sContents.addProperty("ADBE Vector Group");
                grpRings.name = "9_Concentric_Rings";
                for (var rIdx = 1; rIdx <= 3; rIdx++) {
                    var rRad = Math.round(rIdx * 14 * sF);
                    var cRing = grpRings.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
                    cRing.property("Size").setValue([rRad * 2, rRad * 2]);
                    cRing.property("Position").setValue([Math.round(1515 * sF), row2Y]);
                }
                var sStrkRings = grpRings.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                sStrkRings.property("Color").setValue([0.2, 0.8, 1.0]);
                sStrkRings.property("Stroke Width").setValue(Math.max(1, Math.round(2 * sF)));
            }
            progBar.value = 85;

            // =================================================================
            // MODULE 4: STROKE STYLES (CAPS, JOINS, DASHES & GAPS)
            // =================================================================
            if (doStrokes) {
                var strokeColX = Math.round(1040 * sF);
                var strokeTopY = Math.round(380 * sF);

                var strkHead = comp.layers.addText("STROKE STYLES SHOWCASE (LINE CAPS, JOINS, DASHES & GAPS)");
                strkHead.name = "TEST_06_Strokes_Section_Title";
                strkHead.transform.position.setValue([strokeColX, strokeTopY, 0]);
                setupTextDocument(strkHead, "STROKE STYLES SHOWCASE (CAPS, JOINS, DASHES)", "Segoe UI", Math.round(14 * sF), [0.4, 0.8, 1.0], "left");

                var strokeLayer = comp.layers.addShape();
                strokeLayer.name = "TEST_07_Stroke_Styles_Showcase";
                strokeLayer.transform.position.setValue([0, 0, 0]);

                var strkContents = strokeLayer.property("Contents");

                // Line Caps (Butt vs Round vs Projecting)
                var capLabels = [
                    { cap: 1, name: "Butt Cap (1)",        y: strokeTopY + Math.round(45 * sF),  col: [0.95, 0.4, 0.3] },
                    { cap: 2, name: "Round Cap (2)",       y: strokeTopY + Math.round(80 * sF),  col: [0.3, 0.85, 0.5] },
                    { cap: 3, name: "Projecting Cap (3)",  y: strokeTopY + Math.round(115 * sF), col: [0.3, 0.65, 1.0] }
                ];

                for (var cIdx = 0; cIdx < capLabels.length; cIdx++) {
                    var capInfo = capLabels[cIdx];

                    var cLbl = comp.layers.addText(capInfo.name);
                    cLbl.name = "TEST_08_Cap_" + (cIdx + 1) + "_Label";
                    cLbl.transform.position.setValue([strokeColX, capInfo.y - Math.round(10 * sF), 0]);
                    setupTextDocument(cLbl, capInfo.name, "Segoe UI", Math.round(11 * sF), [0.75, 0.80, 0.90], "left");

                    var capGroup = strkContents.addProperty("ADBE Vector Group");
                    capGroup.name = "Cap_Line_" + capInfo.name;
                    addVectorPath(capGroup, makeLineShape(strokeColX + Math.round(140 * sF), capInfo.y, strokeColX + Math.round(320 * sF), capInfo.y));

                    var cStroke = capGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    cStroke.property("Color").setValue(capInfo.col);
                    cStroke.property("Stroke Width").setValue(Math.round(11 * sF));
                    cStroke.property("Line Cap").setValue(capInfo.cap);
                }

                // Line Joins (Miter vs Round vs Bevel)
                var joinLabels = [
                    { join: 1, name: "Miter Join (1)", y: strokeTopY + Math.round(45 * sF),  xOff: Math.round(360 * sF), col: [1.0, 0.75, 0.2] },
                    { join: 2, name: "Round Join (2)", y: strokeTopY + Math.round(80 * sF),  xOff: Math.round(360 * sF), col: [0.85, 0.35, 0.9] },
                    { join: 3, name: "Bevel Join (3)", y: strokeTopY + Math.round(115 * sF), xOff: Math.round(360 * sF), col: [0.2, 0.9, 0.85] }
                ];

                for (var jIdx = 0; jIdx < joinLabels.length; jIdx++) {
                    var joinInfo = joinLabels[jIdx];

                    var jLbl = comp.layers.addText(joinInfo.name);
                    jLbl.name = "TEST_09_Join_" + (jIdx + 1) + "_Label";
                    jLbl.transform.position.setValue([strokeColX + joinInfo.xOff, joinInfo.y - Math.round(10 * sF), 0]);
                    setupTextDocument(jLbl, joinInfo.name, "Segoe UI", Math.round(11 * sF), [0.75, 0.80, 0.90], "left");

                    var jGroup = strkContents.addProperty("ADBE Vector Group");
                    jGroup.name = "Join_Path_" + joinInfo.name;
                    var jShape = new Shape();
                    var jBaseX = strokeColX + joinInfo.xOff + Math.round(115 * sF);
                    jShape.vertices = [
                        [jBaseX, joinInfo.y + Math.round(10 * sF)],
                        [jBaseX + Math.round(30 * sF), joinInfo.y - Math.round(10 * sF)],
                        [jBaseX + Math.round(60 * sF), joinInfo.y + Math.round(10 * sF)],
                        [jBaseX + Math.round(90 * sF), joinInfo.y - Math.round(10 * sF)]
                    ];
                    jShape.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
                    jShape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
                    jShape.closed = false;
                    addVectorPath(jGroup, jShape);

                    var jStroke = jGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    jStroke.property("Color").setValue(joinInfo.col);
                    jStroke.property("Stroke Width").setValue(Math.round(8 * sF));
                    jStroke.property("Line Join").setValue(joinInfo.join);
                    // Crucial: In native AE, Miter Limit is hidden when Line Join != 1 (Miter).
                    // Calling setValue on a hidden property throws PropertyValueType error.
                    if (joinInfo.join === 1) {
                        try {
                            jStroke.property("Miter Limit").setValue(4);
                        } catch(eMiter) {}
                    }
                }

                // Dashes & Gaps Patterns
                var dashTopY = strokeTopY + Math.round(160 * sF);
                var dashPatterns = [
                    { name: "Solid Line (No Dash)",           dash: null,       cap: 1, col: [1.0, 1.0, 1.0] },
                    { name: "Standard Dash (16px / 8px Gap)", dash: [16, 8],    cap: 1, col: [0.2, 0.8, 1.0] },
                    { name: "Dotted Pearls (Round + 0 Dash)", dash: [0, 16],    cap: 2, col: [1.0, 0.85, 0.2] },
                    { name: "Dual Rhythm (24/8/6/8 Pattern)", dash: [24, 8, 6, 8], cap: 1, col: [0.95, 0.35, 0.7] }
                ];

                for (var dIdx = 0; dIdx < dashPatterns.length; dIdx++) {
                    var dPat = dashPatterns[dIdx];
                    var dY = dashTopY + (dIdx * Math.round(42 * sF));

                    var dLbl = comp.layers.addText(dPat.name);
                    dLbl.name = "TEST_10_Dash_" + (dIdx + 1) + "_Label";
                    dLbl.transform.position.setValue([strokeColX, dY - Math.round(8 * sF), 0]);
                    setupTextDocument(dLbl, dPat.name, "Segoe UI", Math.round(11 * sF), [0.70, 0.75, 0.85], "left");

                    var dGroup = strkContents.addProperty("ADBE Vector Group");
                    dGroup.name = "Dash_Pattern_" + (dIdx + 1);
                    addVectorPath(dGroup, makeLineShape(strokeColX + Math.round(220 * sF), dY, strokeColX + Math.round(660 * sF), dY));

                    var dStroke = dGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    dStroke.property("Color").setValue(dPat.col);
                    dStroke.property("Stroke Width").setValue(scaledStrokeWidth + Math.round(1.5 * sF));
                    dStroke.property("Line Cap").setValue(dPat.cap);

                    if (dPat.dash) {
                        try {
                            var dashesGroup = dStroke.property("ADBE Vector Stroke Dashes") || dStroke.property("Dashes");
                            if (dashesGroup) {
                                var d1 = dashesGroup.addProperty("ADBE Vector Stroke Dash 1");
                                if (d1) d1.setValue(dPat.dash[0] * sF);
                                var g1 = dashesGroup.addProperty("ADBE Vector Stroke Gap 1");
                                if (g1) g1.setValue(dPat.dash[1] * sF);

                                if (dPat.dash.length >= 4) {
                                    var d2 = dashesGroup.addProperty("ADBE Vector Stroke Dash 2");
                                    if (d2) d2.setValue(dPat.dash[2] * sF);
                                    var g2 = dashesGroup.addProperty("ADBE Vector Stroke Gap 2");
                                    if (g2) g2.setValue(dPat.dash[3] * sF);
                                }
                            }
                        } catch(eDash) {}
                        dStroke.dashArray = [
                            dPat.dash[0] * sF,
                            dPat.dash[1] * sF,
                            dPat.dash.length >= 4 ? dPat.dash[2] * sF : 0,
                            dPat.dash.length >= 4 ? dPat.dash[3] * sF : 0
                        ];
                    }
                }

                // Tapered Strokes (ADBE Vector Taper)
                var taperTopY = dashTopY + (4 * Math.round(42 * sF)) + Math.round(10 * sF);
                var tLblHead = comp.layers.addText("Tapered Strokes (ADBE Vector Taper)");
                tLblHead.name = "TEST_11_Taper_Section_Title";
                tLblHead.transform.position.setValue([strokeColX, taperTopY - Math.round(8 * sF), 0]);
                setupTextDocument(tLblHead, "TAPERED STROKES (VARIABLE WIDTH)", "Segoe UI", Math.round(14 * sF), [0.23, 0.83, 0.70], "left");

                var taperCurves = [
                    { name: "Flourish (Double Sharp: 45% S/E)", startL: 45, endL: 45, startW: 0, endW: 0, col: [0.23, 0.83, 0.70], w: Math.round(16 * sF) },
                    { name: "Comet Tail (Single Sharp: 85% S)", startL: 85, endL: 0, startW: 0, endW: 100, col: [1.0, 0.45, 0.20], w: Math.round(18 * sF) }
                ];

                for (var tIdx = 0; tIdx < taperCurves.length; tIdx++) {
                    var tInfo = taperCurves[tIdx];
                    var tY = taperTopY + Math.round(28 * sF) + (tIdx * Math.round(42 * sF));

                    var tRowLbl = comp.layers.addText(tInfo.name);
                    tRowLbl.name = "TEST_11_Taper_" + (tIdx + 1) + "_Label";
                    tRowLbl.transform.position.setValue([strokeColX, tY - Math.round(6 * sF), 0]);
                    setupTextDocument(tRowLbl, tInfo.name, "Segoe UI", Math.round(10 * sF), [0.70, 0.75, 0.85], "left");

                    var tGroup = strkContents.addProperty("ADBE Vector Group");
                    tGroup.name = "Taper_Curve_" + (tIdx + 1);

                    var tShape = new Shape();
                    var xStart = strokeColX + Math.round(220 * sF);
                    var xEnd = strokeColX + Math.round(660 * sF);
                    tShape.vertices = [[xStart, tY], [xEnd, tY]];
                    tShape.inTangents = [[0, 0], [0, 0]];
                    tShape.outTangents = [[0, 0], [0, 0]];
                    tShape.closed = false;
                    addVectorPath(tGroup, tShape);

                    var tStroke = tGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    tStroke.property("Color").setValue(tInfo.col);
                    tStroke.property("Stroke Width").setValue(tInfo.w);
                    tStroke.property("Line Cap").setValue(2); // Round Cap

                    var tProp = tStroke.property("ADBE Vector Taper") || tStroke.property("Taper");
                    if (tProp) {
                        try {
                            tProp.property("Start Length").setValue(tInfo.startL);
                            tProp.property("End Length").setValue(tInfo.endL);
                            tProp.property("Start Width").setValue(tInfo.startW);
                            tProp.property("End Width").setValue(tInfo.endW);
                            tProp.property("Start Ease").setValue(20);
                            tProp.property("End Ease").setValue(20);
                        } catch(eTap) {}
                    }
                }
            }

            // =================================================================
            // MODULE 5: TEXT BOX METRICS, WORDS, LINES & EFFECTS HARNESS
            // =================================================================
            if (doTextProps) {
                var tpColX = Math.round(110 * sF);
                var tpY = Math.round(825 * sF);

                // Section Label
                var lblTp = comp.layers.addText("MODULE 5: TEXT BOX METRICS, WORDS, LINES & TIMELINE EFFECTS");
                lblTp.name = "TEST_12_Text_Props_Section_Title";
                lblTp.transform.position.setValue([tpColX, tpY, 0]);
                setupTextDocument(lblTp, "MODULE 5: TEXT BOX METRICS, WORDS, LINES & EFFECTS (IN-MEMORY)", "Segoe UI", Math.round(13 * sF), [0.38, 0.70, 1.0], "left");

                // Sample multi-line paragraph text for metrics and effect generation
                var sampleText = "Antigravity Dynamic Text Engine\nMeasuring words, line metrics, and bounding dimensions\nStoring live arrays directly in ExtendScript global memory";
                var tpLayer;
                var boxW = Math.round(520 * sF);
                var boxH = Math.round(75 * sF);
                if (typeof comp.layers.addBoxText === "function") {
                    try {
                        tpLayer = comp.layers.addBoxText([boxW, boxH], sampleText);
                    } catch (eBox) {
                        tpLayer = comp.layers.addText(sampleText);
                    }
                } else {
                    tpLayer = comp.layers.addText(sampleText);
                }
                tpLayer.name = "TEST_13_Paragraph_Box_Text";
                tpLayer.transform.position.setValue([tpColX, tpY + Math.round(28 * sF), 0]);
                setupTextDocument(tpLayer, sampleText, "Segoe UI", Math.round(13 * sF), [1.0, 1.0, 1.0], "left");

                // Word and Line detection
                var words = sampleText.match(/\S+/g) || [];
                var rawLines = sampleText.split(/\r\n|\r|\n/);
                var wordWidths = [];
                var lineWidths = [];

                // Accurate width measurements using offscreen text probe
                try {
                    var probeLayer = comp.layers.addText("");
                    probeLayer.enabled = false;
                    for (var wIdx = 0; wIdx < words.length; wIdx++) {
                        setupTextDocument(probeLayer, words[wIdx], "Segoe UI", Math.round(13 * sF), [1, 1, 1], "left");
                        var wRect = probeLayer.sourceRectAtTime(0, false);
                        wordWidths.push(Math.round(wRect.width * 10) / 10);
                    }
                    for (var lIdx = 0; lIdx < rawLines.length; lIdx++) {
                        setupTextDocument(probeLayer, rawLines[lIdx], "Segoe UI", Math.round(13 * sF), [1, 1, 1], "left");
                        var lRect = probeLayer.sourceRectAtTime(0, false);
                        lineWidths.push(Math.round(lRect.width * 10) / 10);
                    }
                    probeLayer.remove();
                } catch(eProbe) {
                    for (var ew = 0; ew < words.length; ew++) { wordWidths.push(words[ew].length * 8); }
                    for (var el = 0; el < rawLines.length; el++) { lineWidths.push(rawLines[el].length * 8); }
                }

                // Store in memory
                $.global.AE_TEXT_BOX_MEMORY = {
                    lastUpdated: new Date().toString(),
                    layerName: tpLayer.name,
                    fullText: sampleText,
                    totalWords: words.length,
                    totalLines: rawLines.length,
                    words: words,
                    wordWidths: wordWidths,
                    lineWidths: lineWidths
                };

                // Sync UI sliders in Tab 2
                try {
                    if (typeof sldWords !== "undefined" && typeof txtWords !== "undefined") {
                        sldWords.value = words.length;
                        txtWords.text = String(words.length);
                    }
                    if (typeof sldLines !== "undefined" && typeof txtLines !== "undefined") {
                        sldLines.value = rawLines.length;
                        txtLines.text = String(rawLines.length);
                    }
                } catch(eSync) {}

                // Add Timeline Slider & Checkbox Effects to tpLayer
                var fxGroup = tpLayer.property("ADBE Effect Parade") || tpLayer.property("Effects");
                if (fxGroup) {
                    // Amount of Words Slider
                    var fxWords = fxGroup.addProperty("ADBE Slider Control");
                    fxWords.name = "Amount of Words";
                    fxWords.property("Slider").setValue(words.length);

                    // Amount of Text Lines Slider
                    var fxLines = fxGroup.addProperty("ADBE Slider Control");
                    fxLines.name = "Amount of Text Lines";
                    fxLines.property("Slider").setValue(rawLines.length);

                    // Box Width (sourceRect) Slider
                    var fxW = fxGroup.addProperty("ADBE Slider Control");
                    fxW.name = "Box Width (sourceRect)";
                    try {
                        fxW.property("Slider").expression = "Math.round(sourceRectAtTime(time, false).width);";
                    } catch(eExpW) {
                        fxW.property("Slider").setValue(Math.round(tpLayer.sourceRectAtTime(0, false).width));
                    }

                    // Box Height (sourceRect) Slider
                    var fxH = fxGroup.addProperty("ADBE Slider Control");
                    fxH.name = "Box Height (sourceRect)";
                    try {
                        fxH.property("Slider").expression = "Math.round(sourceRectAtTime(time, false).height);";
                    } catch(eExpH) {
                        fxH.property("Slider").setValue(Math.round(tpLayer.sourceRectAtTime(0, false).height));
                    }

                    // Word & Line Memory Cache Active Checkbox
                    var fxChk = fxGroup.addProperty("ADBE Checkbox Control");
                    fxChk.name = "Word & Line Memory Cache Active";
                    fxChk.property("Checkbox").setValue(1);
                }

                // Dynamic background card behind the text
                try {
                    var cardLayer = comp.layers.addShape();
                    cardLayer.name = "TEST_14_Text_Dynamic_Card";
                    cardLayer.moveAfter(tpLayer);
                    var cardContents = cardLayer.property("Contents");
                    var cardGroup = cardContents.addProperty("ADBE Vector Group");
                    cardGroup.name = "Card_Base";
                    var cardRect = cardGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
                    cardRect.property("Size").setValue([Math.round(620 * sF), Math.round(85 * sF)]);
                    cardRect.property("Roundness").setValue(Math.round(8 * sF));
                    var cardFill = cardGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    cardFill.property("Color").setValue([0.08, 0.12, 0.18]);
                    cardFill.property("Opacity").setValue(85);
                    var cardStroke = cardGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    cardStroke.property("Color").setValue([0.22, 0.48, 0.85]);
                    cardStroke.property("Stroke Width").setValue(1.5);
                    cardLayer.transform.position.setValue([tpColX + Math.round(300 * sF), tpY + Math.round(52 * sF), 0]);
                } catch(eCard) {}
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
