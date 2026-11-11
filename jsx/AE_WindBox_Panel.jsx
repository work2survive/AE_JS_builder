// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE WINDBOX v1.1
// =============================================================================
//
// PURPOSE:
//   A procedural 3D Wind Volume Particle System for Adobe After Effects,
//   featuring a virtual 3D bounding box (Guide Layer) and preset physics
//   for organic elements (Leaves, Clouds, Stars, Mountains, Shapes, and Custom Comps).
//
// KEY CAPABILITIES:
//   1. Virtual 3D Cube (Guide Layer):
//      - Visible in After Effects working composition viewport for precise volume framing.
//      - Flagged as Guide Layer (`guideLayer = true`) by default so it never renders to exports.
//      - 6 parametric faces parented to the Master Controller with dynamic expressions.
//   2. Wind-Driven Particle Motion & Rotation:
//      - Particles travel along normalized 3D wind vector [X, Y, Z] at animatable speed.
//      - 3D spatial wrapping keeps particles in continuous flow within the box volume.
//      - "Align to Wind" option dynamically rotates particles to face and orient with the wind.
//      - 3-axis positional turbulence & independent 3-axis rotational tumbling wiggle.
//   3. Rich Preset System:
//      - 🍃 Leaves: Procedural Bézier teardrop leaves with multi-hue autumn tones & organic tumbling.
//      - ☁️ Clouds: Multi-puff soft cloud vector clusters with gentle horizontal drift.
//      - ⭐ Stars: 5-pointed twinkling stars with cosmic shimmering float.
//      - ⛰️ Mountains: Low-poly geometric mountain silhouettes with majestic parallax glide.
//      - ⚪ 3D Circles: Snow, dust, spores, or bubbles.
//      - ⬛ 3D Squares: Confetti, debris, or pixel particles.
//      - 🎬 Project Composition: Instantiate any existing CompItem from the project!
//      - 🎯 Selected Layer(s): Duplicate any selected timeline layer as particle source.
//   4. Master 3D Controller:
//      - Single 3D null layer containing Slider, Color, and Checkbox Effect Controls.
//      - Moving or rotating the controller transforms and reorients the entire wind volume.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6 through CC 2026+ (ExtendScript engine)
//   - Works both as a dockable panel (ScriptUI Panels) and as a floating palette.
// =============================================================================

(function (thisObj) {
    "use strict";

    // ==========================================
    // COLOR HELPERS & SCRIPTUI COLOR PICKER
    // ==========================================
    function hexToRgb(hex) {
        hex = String(hex).replace("#", "");
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var num = parseInt(hex, 16);
        return [
            ((num >> 16) & 255) / 255, // Red channel   (0.0 to 1.0)
            ((num >> 8) & 255) / 255,  // Green channel (0.0 to 1.0)
            (num & 255) / 255          // Blue channel  (0.0 to 1.0)
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#8C8C8C";
        var r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255).toString(16);
        var g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255).toString(16);
        var b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255).toString(16);
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        return "#" + r + g + b;
    }

    function createColorPicker(parent, defaultHex) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.spacing = 6;
        grp.alignChildren = ["left", "center"];

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [36, 22];
        btnSwatch.helpTip = "Click to pick color (After Effects native Color Picker)";

        var txtHex = grp.add("edittext", undefined, defaultHex);
        txtHex.preferredSize = [70, 22];
        txtHex.characters = 7;
        txtHex.helpTip = "Direct hex color input (e.g. #8C8C8C)";

        var picker = {
            group: grp,
            button: btnSwatch,
            edittext: txtHex,
            _color: defaultHex,
            value: defaultHex,
            onChange: null,
            setColor: function(newHex, triggerChange) {
                setColor(newHex, triggerChange);
            }
        };

        btnSwatch.onDraw = function() {
            try {
                var g = this.graphics;
                var rgb = hexToRgb(picker._color);
                var brush = g.newBrush(g.BrushType.SOLID_COLOR, [rgb[0], rgb[1], rgb[2], 1.0]);
                var pen = g.newPen(g.PenType.SOLID_COLOR, [0.7, 0.7, 0.7, 1.0], 1);
                g.newPath();
                g.rectPath(0, 0, this.size ? this.size[0] : 36, this.size ? this.size[1] : 22);
                g.fillPath(brush);
                g.strokePath(pen);
            } catch(e) {}
        };

        function setColor(newHex, triggerChange) {
            if (!newHex) return;
            if (newHex.indexOf("#") !== 0) newHex = "#" + newHex;
            picker._color = newHex;
            picker.value = newHex;
            txtHex.text = newHex.toUpperCase();

            try {
                if (btnSwatch.notify) {
                    btnSwatch.notify("onDraw");
                }
            } catch(e) {}

            if (btnSwatch.domElement) {
                btnSwatch.domElement.style.backgroundColor = newHex;
                btnSwatch.domElement.style.border = "1px solid #777";
            }

            if (triggerChange && typeof picker.onChange === "function") {
                picker.onChange();
            }
        }

        btnSwatch.onClick = function() {
            var curHex = picker._color || "#8C8C8C";
            if (typeof window !== "undefined" && typeof window.openWindowsColorPicker === "function") {
                window.openWindowsColorPicker(curHex, function(selectedHex) {
                    setColor(selectedHex, true);
                });
                return;
            }

            var hexNum = parseInt(curHex.replace("#", ""), 16);
            var result = -1;
            if (typeof $.colorPicker === "function") {
                result = $.colorPicker(hexNum, function(selectedHex) {
                    setColor(selectedHex, true);
                });
            }
            if (result !== -1 && result !== undefined && result !== null) {
                var hexStr = Number(result).toString(16);
                while (hexStr.length < 6) hexStr = "0" + hexStr;
                setColor("#" + hexStr, true);
            }
        };

        txtHex.onChange = function() {
            var val = txtHex.text.replace(/^\s+|\s+$/g, "");
            if (val.indexOf("#") !== 0) val = "#" + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                setColor(val, true);
            } else {
                txtHex.text = picker._color.toUpperCase();
            }
        };

        setColor(defaultHex, false);
        return picker;
    }

    // ==========================================
    // PROCEDURAL VECTOR SHAPE BUILDER
    // ==========================================
    function buildParticleShape(pLayer, sourceIndex, shapeSize, defaultColor, pIndex) {
        var root = pLayer.property("ADBE Root Vectors Group");
        var shapeGroup = root.addProperty("ADBE Vector Group");
        shapeGroup.name = "Particle Shape";
        var contents = shapeGroup.property("ADBE Vectors Group");

        // Curated multi-tone palettes for rich natural particle fields
        var autumnLeafPalette = [
            [0.32, 0.68, 0.22, 1], // Fresh Green
            [0.88, 0.68, 0.12, 1], // Golden Amber
            [0.92, 0.44, 0.10, 1], // Vivid Autumn Orange
            [0.82, 0.22, 0.16, 1], // Crimson
            [0.55, 0.72, 0.20, 1]  // Bright Lime
        ];

        var starPalette = [
            [1.0, 0.95, 0.45, 1], // Warm Golden Star
            [1.0, 1.0, 1.0, 1],    // Pure White Diamond
            [0.75, 0.88, 1.0, 1],  // Celestial Blue
            [1.0, 0.85, 0.6, 1]   // Peach Starlight
        ];

        var finalColor = defaultColor;

        if (sourceIndex === 0) { // 🍃 Leaves (Procedural Teardrop Bézier)
            var pathGroup = contents.addProperty("ADBE Vector Shape - Group");
            var pathProp = pathGroup.property("ADBE Vector Shape");
            var leafShape = new Shape();
            var r = shapeSize / 2;
            leafShape.vertices = [[0, -r], [r * 0.65, 0], [0, r * 0.9], [-r * 0.65, 0]];
            var k = r * 0.45;
            leafShape.inTangents = [[-k * 0.4, 0], [0, -k], [k * 0.4, 0], [0, k]];
            leafShape.outTangents = [[k * 0.4, 0], [0, k], [-k * 0.4, 0], [0, -k]];
            leafShape.closed = true;
            pathProp.setValue(leafShape);
            finalColor = autumnLeafPalette[(pIndex - 1) % autumnLeafPalette.length];

        } else if (sourceIndex === 1) { // ☁️ Clouds (Soft 6-Node Bubble Puff)
            var pathGroupCloud = contents.addProperty("ADBE Vector Shape - Group");
            var pathPropCloud = pathGroupCloud.property("ADBE Vector Shape");
            var cloudShape = new Shape();
            var cw = shapeSize, ch = shapeSize * 0.6;
            cloudShape.vertices = [
                [-cw * 0.4, ch * 0.25],
                [cw * 0.4, ch * 0.25],
                [cw * 0.45, 0],
                [cw * 0.18, -ch * 0.38],
                [-cw * 0.18, -ch * 0.42],
                [-cw * 0.45, 0]
            ];
            var cc = shapeSize * 0.16;
            cloudShape.inTangents = [[0, 0], [cc, 0], [0, cc], [cc, 0], [-cc, 0], [0, -cc]];
            cloudShape.outTangents = [[-cc, 0], [0, -cc], [-cc, 0], [cc, 0], [0, cc], [0, 0]];
            cloudShape.closed = true;
            pathPropCloud.setValue(cloudShape);
            finalColor = [0.94, 0.96, 0.98, 1]; // Puffy white cloud

        } else if (sourceIndex === 2) { // ⭐ Stars (5-Point Vector Star)
            var pathGroupStar = contents.addProperty("ADBE Vector Shape - Group");
            var pathPropStar = pathGroupStar.property("ADBE Vector Shape");
            var starShape = new Shape();
            var rOut = shapeSize / 2;
            var rIn = rOut * 0.42;
            var sVerts = [], sIns = [], sOuts = [];
            for (var st = 0; st < 10; st++) {
                var ang = (st * Math.PI) / 5 - Math.PI / 2;
                var rad = (st % 2 === 0) ? rOut : rIn;
                sVerts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
                sIns.push([0, 0]);
                sOuts.push([0, 0]);
            }
            starShape.vertices = sVerts;
            starShape.inTangents = sIns;
            starShape.outTangents = sOuts;
            starShape.closed = true;
            pathPropStar.setValue(starShape);
            finalColor = starPalette[(pIndex - 1) % starPalette.length];

        } else if (sourceIndex === 3) { // ⛰️ Mountains (Low-Poly Peak Silhouette)
            var pathGroupMnt = contents.addProperty("ADBE Vector Shape - Group");
            var pathPropMnt = pathGroupMnt.property("ADBE Vector Shape");
            var mntShape = new Shape();
            var mw = shapeSize, mh = shapeSize * 0.7;
            mntShape.vertices = [
                [-mw * 0.5, mh * 0.35],
                [-mw * 0.22, -mh * 0.1],
                [-mw * 0.08, mh * 0.05],
                [0, -mh * 0.45],
                [mw * 0.2, -mh * 0.08],
                [mw * 0.5, mh * 0.35]
            ];
            mntShape.inTangents = [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
            mntShape.outTangents = [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
            mntShape.closed = true;
            pathPropMnt.setValue(mntShape);
            finalColor = [0.32, 0.38, 0.46, 1]; // Slate mountain silhouette

        } else if (sourceIndex === 4) { // ⚪ 3D Circles
            var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
            ellipse.property("ADBE Vector Ellipse Size").setValue([shapeSize, shapeSize]);

        } else if (sourceIndex === 5) { // ⬛ 3D Squares
            var rect = contents.addProperty("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Size").setValue([shapeSize, shapeSize]);
        }

        // Add Vector Fill Graphic
        var fill = contents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue(finalColor);
    }

    // ==========================================
    // UI BUILDER
    // ==========================================
    function buildWindBoxUI(thisObj) {
        var isPanel = (thisObj instanceof Panel);
        var win = isPanel ? thisObj : new Window("palette", "AE WindBox v1.1", undefined, {
            resizeable: true
        });
        if (!(thisObj instanceof Panel)) {
            win.text = "AE WindBox v1.1";
        }

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        // ---------------------------------------------------------------------
        // 1. UI Header (Panel Title + Version & Description)
        // ---------------------------------------------------------------------
        var pnlHeader = win.add("panel", undefined, "AE WindBox");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.spacing = 3;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblDesc = pnlHeader.add("statictext", undefined, "v1.1 - Procedural 3D Wind Volume Particle System with Virtual Guide Cube.");

        // ---------- SYSTEM NAME & PRESETS ----------
        var headerGroup = win.add("group");
        headerGroup.orientation = "row";
        headerGroup.alignChildren = ["left", "center"];
        headerGroup.alignment = ["fill", "top"];
        headerGroup.spacing = 6;

        headerGroup.add("statictext", undefined, "System Name:");
        var txtSysName = headerGroup.add("edittext", undefined, "WindBox");
        txtSysName.characters = 10;

        var btnHelp = headerGroup.add("button", undefined, "?");
        btnHelp.maximumSize = [24, 22];
        btnHelp.onClick = function () {
            alert(
                "AE WindBox + 3D Cube Maker (v1.1)\n" +
                "=================================\n" +
                "1. Virtual 3D Cube (Guide Layer):\n" +
                "   Defines the 3D wind boundary. Marked as Guide Layer by default so it stays\n" +
                "   visible in the working viewport for reference, but never renders to exports!\n\n" +
                "2. Wind Physics & Flow Direction:\n" +
                "   Particles wrap seamlessly in 3D volume space. Enable 'Align to Wind' so\n" +
                "   elements naturally steer and orient in the direction of the wind vector!\n\n" +
                "3. Presets & Custom Comps:\n" +
                "   Quickly switch between Leaves, Clouds, Stars, Mountains, Shapes, or pick\n" +
                "   any composition from your project to instantiate as 3D wind particles.\n\n" +
                "Tip: Moving or rotating the Controller null transforms the entire wind volume in 3D world space.",
                "About AE WindBox"
            );
        };

        // ---------- PRESET QUICK-LOADER ROW ----------
        var grpPreset = win.add("group");
        grpPreset.orientation = "row";
        grpPreset.alignChildren = ["left", "center"];
        grpPreset.alignment = ["fill", "top"];
        grpPreset.spacing = 6;

        grpPreset.add("statictext", undefined, "Preset:");
        var dropPreset = grpPreset.add("dropdownlist", undefined, [
            "🍃 Falling Leaves (Organic Flutter & Tumble)",
            "☁️ Drifting Clouds (Soft Gentle Float)",
            "⭐ Cosmic Stars (Twinkle & Shimmer)",
            "⛰️ Parallax Mountains (Horizon Glide)",
            "⚪ 3D Circles (Snow / Spores)",
            "⬛ 3D Squares (Confetti / Debris)",
            "🎬 Project Composition...",
            "🎯 Selected Layer(s)"
        ]);
        dropPreset.selection = 0; // Default to Leaves!

        // ---------- TABBED PANEL ----------
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.spacing = 4;
        tpanel.margins = 4;

        // ==========================================
        // TAB 1: BOX & WIND FLOW
        // ==========================================
        var tabFlow = tpanel.add("tab", undefined, "Box & Wind");
        tabFlow.orientation = "column";
        tabFlow.alignChildren = ["fill", "top"];
        tabFlow.spacing = 6;
        tabFlow.margins = 6;

        // Box Size Panel
        var pnlSize = tabFlow.add("panel", undefined, "Cube Dimensions (X, Y, Z) - Animatable");
        pnlSize.orientation = "row";
        pnlSize.alignChildren = ["fill", "center"];
        pnlSize.spacing = 4;

        pnlSize.add("statictext", undefined, "X:");
        var editSizeX = pnlSize.add("edittext", undefined, "1400");
        editSizeX.characters = 5;

        pnlSize.add("statictext", undefined, "Y:");
        var editSizeY = pnlSize.add("edittext", undefined, "800");
        editSizeY.characters = 5;

        pnlSize.add("statictext", undefined, "Z:");
        var editSizeZ = pnlSize.add("edittext", undefined, "1000");
        editSizeZ.characters = 5;

        // Wind Flow Panel
        var pnlWind = tabFlow.add("panel", undefined, "Wind Flow - Animatable");
        pnlWind.orientation = "column";
        pnlWind.alignChildren = ["fill", "top"];
        pnlWind.spacing = 4;

        // Speed row
        var grpSpeed = pnlWind.add("group");
        grpSpeed.orientation = "row";
        grpSpeed.alignChildren = ["left", "center"];
        grpSpeed.add("statictext", undefined, "Wind Speed (px/s):");
        var editSpeed = grpSpeed.add("edittext", undefined, "260");
        editSpeed.characters = 6;

        // Direction row
        var grpDir = pnlWind.add("group");
        grpDir.orientation = "row";
        grpDir.alignChildren = ["fill", "center"];
        grpDir.spacing = 4;

        grpDir.add("statictext", undefined, "Direction:");
        grpDir.add("statictext", undefined, "X:");
        var editDirX = grpDir.add("edittext", undefined, "1.0");
        editDirX.characters = 4;

        grpDir.add("statictext", undefined, "Y:");
        var editDirY = grpDir.add("edittext", undefined, "0.3");
        editDirY.characters = 4;

        grpDir.add("statictext", undefined, "Z:");
        var editDirZ = grpDir.add("edittext", undefined, "0.2");
        editDirZ.characters = 4;

        // Align rotation to wind checkbox
        var chkAlignWind = pnlWind.add("checkbox", undefined, "Align Particle Rotation to Wind Vector");
        chkAlignWind.value = true;
        chkAlignWind.helpTip = "Automatically rotates particles towards the wind direction vector with aerodynamic tumble";

        // Particle Count Panel
        var pnlCount = tabFlow.add("panel", undefined, "Particles Count - Animatable");
        pnlCount.orientation = "row";
        pnlCount.alignChildren = ["left", "center"];
        pnlCount.spacing = 6;

        pnlCount.add("statictext", undefined, "Number of Particles:");
        var editCount = pnlCount.add("edittext", undefined, "50");
        editCount.characters = 5;

        // ==========================================
        // TAB 2: VIRTUAL CUBE (GUIDE LAYER)
        // ==========================================
        var tabCube = tpanel.add("tab", undefined, "Virtual Cube");
        tabCube.orientation = "column";
        tabCube.alignChildren = ["fill", "top"];
        tabCube.spacing = 6;
        tabCube.margins = 6;

        var chkCreateCube = tabCube.add("checkbox", undefined, "Build Virtual 3D Cube (AE-Cube-Maker-3D)");
        chkCreateCube.value = true;

        var chkCubeGuide = tabCube.add("checkbox", undefined, "Set as Guide Layer (Viewport only, invisible in render)");
        chkCubeGuide.value = true; // Default: Guide layer!

        var lblGuideTip = tabCube.add("statictext", undefined, "Guide Layers frame the volume in working viewport and do NOT render out.", { multiline: true });
        lblGuideTip.alignment = ["fill", "top"];

        var pnlCubeStyle = tabCube.add("panel", undefined, "Cube Visualizer Appearance");
        pnlCubeStyle.orientation = "column";
        pnlCubeStyle.alignChildren = ["fill", "top"];
        pnlCubeStyle.spacing = 6;

        // Sides (Face) Color Picker
        var grpCubeFill = pnlCubeStyle.add("group");
        grpCubeFill.orientation = "row";
        grpCubeFill.alignment = ["fill", "top"];
        var lblCubeFill = grpCubeFill.add("statictext", undefined, "Sides Fill Color:");
        lblCubeFill.preferredSize = [135, -1];
        var cpCubeFill = createColorPicker(grpCubeFill, "#8c8c8c");

        // Sides Opacity
        var grpCubeSidesOp = pnlCubeStyle.add("group");
        grpCubeSidesOp.orientation = "row";
        grpCubeSidesOp.alignChildren = ["left", "center"];
        var lblSidesOp = grpCubeSidesOp.add("statictext", undefined, "Sides Opacity (%):");
        lblSidesOp.preferredSize = [135, -1];
        var editCubeSidesOp = grpCubeSidesOp.add("edittext", undefined, "10");
        editCubeSidesOp.characters = 4;
        grpCubeSidesOp.add("statictext", undefined, "(Subtle holographic volume)");

        // Stroke Color Picker
        var grpCubeStroke = pnlCubeStyle.add("group");
        grpCubeStroke.orientation = "row";
        grpCubeStroke.alignment = ["fill", "top"];
        var lblCubeStroke = grpCubeStroke.add("statictext", undefined, "Stroke Color:");
        lblCubeStroke.preferredSize = [135, -1];
        var cpCubeStroke = createColorPicker(grpCubeStroke, "#ffffff");

        // Stroke Width
        var grpCubeStrokeW = pnlCubeStyle.add("group");
        grpCubeStrokeW.orientation = "row";
        grpCubeStrokeW.alignChildren = ["left", "center"];
        var lblStrokeW = grpCubeStrokeW.add("statictext", undefined, "Stroke Width (px):");
        lblStrokeW.preferredSize = [135, -1];
        var editCubeStrokeW = grpCubeStrokeW.add("edittext", undefined, "1.5");
        editCubeStrokeW.characters = 4;

        // Stroke Opacity
        var grpCubeStrokeOp = pnlCubeStyle.add("group");
        grpCubeStrokeOp.orientation = "row";
        grpCubeStrokeOp.alignChildren = ["left", "center"];
        var lblStrokeOp = grpCubeStrokeOp.add("statictext", undefined, "Stroke Opacity (%):");
        lblStrokeOp.preferredSize = [135, -1];
        var editCubeStrokeOp = grpCubeStrokeOp.add("edittext", undefined, "85");
        editCubeStrokeOp.characters = 4;

        // ==========================================
        // TAB 3: POSITION WIGGLE
        // ==========================================
        var tabPosWiggle = tpanel.add("tab", undefined, "Pos Wiggle");
        tabPosWiggle.orientation = "column";
        tabPosWiggle.alignChildren = ["fill", "top"];
        tabPosWiggle.spacing = 6;
        tabPosWiggle.margins = 6;

        var pnlPosWig = tabPosWiggle.add("panel", undefined, "Particle Position Turbulence");
        pnlPosWig.orientation = "column";
        pnlPosWig.alignChildren = ["fill", "top"];
        pnlPosWig.spacing = 4;

        var grpPosFreq = pnlPosWig.add("group");
        grpPosFreq.orientation = "row";
        grpPosFreq.alignChildren = ["left", "center"];
        grpPosFreq.add("statictext", undefined, "Frequency (Hz):");
        var editPosFreq = grpPosFreq.add("edittext", undefined, "1.6");
        editPosFreq.characters = 5;

        var grpPosAmp = pnlPosWig.add("group");
        grpPosAmp.orientation = "row";
        grpPosAmp.alignChildren = ["fill", "center"];
        grpPosAmp.spacing = 4;

        grpPosAmp.add("statictext", undefined, "Amount (px):");
        grpPosAmp.add("statictext", undefined, "X:");
        var editPosAmpX = grpPosAmp.add("edittext", undefined, "70");
        editPosAmpX.characters = 4;

        grpPosAmp.add("statictext", undefined, "Y:");
        var editPosAmpY = grpPosAmp.add("edittext", undefined, "50");
        editPosAmpY.characters = 4;

        grpPosAmp.add("statictext", undefined, "Z:");
        var editPosAmpZ = grpPosAmp.add("edittext", undefined, "60");
        editPosAmpZ.characters = 4;

        // ==========================================
        // TAB 4: ROTATION WIGGLE
        // ==========================================
        var tabRotWiggle = tpanel.add("tab", undefined, "Rot Wiggle");
        tabRotWiggle.orientation = "column";
        tabRotWiggle.alignChildren = ["fill", "top"];
        tabRotWiggle.spacing = 6;
        tabRotWiggle.margins = 6;

        // X Rotation (Pitch)
        var pnlRotX = tabRotWiggle.add("panel", undefined, "X Rotation Turbulence (Pitch)");
        pnlRotX.orientation = "row";
        pnlRotX.alignChildren = ["fill", "center"];
        pnlRotX.spacing = 4;
        pnlRotX.add("statictext", undefined, "Amount (°):");
        var editRotXAmp = pnlRotX.add("edittext", undefined, "60");
        editRotXAmp.characters = 4;
        pnlRotX.add("statictext", undefined, "Freq (Hz):");
        var editRotXFreq = pnlRotX.add("edittext", undefined, "1.2");
        editRotXFreq.characters = 4;

        // Y Rotation (Yaw)
        var pnlRotY = tabRotWiggle.add("panel", undefined, "Y Rotation Turbulence (Yaw)");
        pnlRotY.orientation = "row";
        pnlRotY.alignChildren = ["fill", "center"];
        pnlRotY.spacing = 4;
        pnlRotY.add("statictext", undefined, "Amount (°):");
        var editRotYAmp = pnlRotY.add("edittext", undefined, "60");
        editRotYAmp.characters = 4;
        pnlRotY.add("statictext", undefined, "Freq (Hz):");
        var editRotYFreq = pnlRotY.add("edittext", undefined, "1.2");
        editRotYFreq.characters = 4;

        // Z Rotation (Roll)
        var pnlRotZ = tabRotWiggle.add("panel", undefined, "Z Rotation Turbulence (Roll)");
        pnlRotZ.orientation = "row";
        pnlRotZ.alignChildren = ["fill", "center"];
        pnlRotZ.spacing = 4;
        pnlRotZ.add("statictext", undefined, "Amount (°):");
        var editRotZAmp = pnlRotZ.add("edittext", undefined, "75");
        editRotZAmp.characters = 4;
        pnlRotZ.add("statictext", undefined, "Freq (Hz):");
        var editRotZFreq = pnlRotZ.add("edittext", undefined, "1.5");
        editRotZFreq.characters = 4;

        // ==========================================
        // TAB 5: PARTICLE SOURCE & APPEARANCE
        // ==========================================
        var tabSource = tpanel.add("tab", undefined, "Particles");
        tabSource.orientation = "column";
        tabSource.alignChildren = ["fill", "top"];
        tabSource.spacing = 6;
        tabSource.margins = 6;

        var grpSource = tabSource.add("group");
        grpSource.orientation = "row";
        grpSource.alignChildren = ["left", "center"];
        grpSource.add("statictext", undefined, "Source:");
        var dropSource = grpSource.add("dropdownlist", undefined, [
            "🍃 Built-in Leaves (Bézier Vector)",
            "☁️ Built-in Clouds (Soft Vector)",
            "⭐ Built-in Stars (5-Point Vector)",
            "⛰️ Built-in Mountains (Silhouette)",
            "⚪ Built-in 3D Circle (Vector)",
            "⬛ Built-in 3D Square (Vector)",
            "🎬 Project Composition...",
            "🎯 Use Selected Timeline Layer(s)"
        ]);
        dropSource.selection = 0; // Default to Leaves!

        // Project Comp Selector row (visible when source == 6)
        var grpProjComp = tabSource.add("group");
        grpProjComp.orientation = "row";
        grpProjComp.alignChildren = ["left", "center"];
        grpProjComp.visible = false;

        grpProjComp.add("statictext", undefined, "Comp:");
        var dropProjectComp = grpProjComp.add("dropdownlist", undefined, ["(Scan Project Comps)"]);
        dropProjectComp.preferredSize = [160, -1];
        dropProjectComp.selection = 0;

        var btnRefreshComps = grpProjComp.add("button", undefined, "🔄");
        btnRefreshComps.maximumSize = [28, 22];
        btnRefreshComps.helpTip = "Scan project for available Compositions";

        var projectCompItems = [];
        function updateProjectCompsList() {
            dropProjectComp.removeAll();
            projectCompItems = [];
            var proj = app.project;
            if (proj && proj.items) {
                for (var ci = 1; ci <= proj.items.length; ci++) {
                    var item = proj.items[ci];
                    if (item && item instanceof CompItem) {
                        dropProjectComp.add("item", item.name);
                        projectCompItems.push(item);
                    }
                }
            }
            if (dropProjectComp.items.length === 0) {
                dropProjectComp.add("item", "(No comps found)");
            }
            dropProjectComp.selection = 0;
        }

        btnRefreshComps.onClick = function() {
            updateProjectCompsList();
        };

        var grpPartSize = tabSource.add("group");
        grpPartSize.orientation = "row";
        grpPartSize.alignChildren = ["left", "center"];
        grpPartSize.add("statictext", undefined, "Particle Size (px):");
        var editPartSize = grpPartSize.add("edittext", undefined, "28");
        editPartSize.characters = 5;

        // Custom particle base color
        var grpPartCol = tabSource.add("group");
        grpPartCol.orientation = "row";
        grpPartCol.alignChildren = ["left", "center"];
        grpPartCol.add("statictext", undefined, "Base Color:");
        var cpPartColor = createColorPicker(grpPartCol, "#44aa33");

        function handleSourceChange() {
            var idx = dropSource.selection.index;
            grpProjComp.visible = (idx === 6);
            grpPartSize.enabled = (idx <= 5);
            grpPartCol.enabled = (idx <= 5);
            if (idx === 6) {
                updateProjectCompsList();
            }
        }

        dropSource.onChange = handleSourceChange;

        // Preset synchronization logic
        dropPreset.onChange = function () {
            var pIdx = dropPreset.selection.index;
            if (pIdx === 0) { // 🍃 Leaves
                dropSource.selection = 0;
                editSizeX.text = "1400"; editSizeY.text = "800"; editSizeZ.text = "1000";
                editSpeed.text = "260"; editDirX.text = "1.0"; editDirY.text = "0.3"; editDirZ.text = "0.2";
                chkAlignWind.value = true;
                editCount.text = "50";
                editPartSize.text = "28";
                cpPartColor.setColor("#44aa33", false);
                editPosFreq.text = "1.6"; editPosAmpX.text = "70"; editPosAmpY.text = "50"; editPosAmpZ.text = "60";
                editRotXAmp.text = "60"; editRotXFreq.text = "1.2";
                editRotYAmp.text = "60"; editRotYFreq.text = "1.2";
                editRotZAmp.text = "75"; editRotZFreq.text = "1.5";

            } else if (pIdx === 1) { // ☁️ Clouds
                dropSource.selection = 1;
                editSizeX.text = "1800"; editSizeY.text = "600"; editSizeZ.text = "1200";
                editSpeed.text = "80"; editDirX.text = "1.0"; editDirY.text = "0.05"; editDirZ.text = "0.0";
                chkAlignWind.value = false;
                editCount.text = "18";
                editPartSize.text = "85";
                cpPartColor.setColor("#f0f4f8", false);
                editPosFreq.text = "0.4"; editPosAmpX.text = "30"; editPosAmpY.text = "20"; editPosAmpZ.text = "20";
                editRotXAmp.text = "5"; editRotXFreq.text = "0.2";
                editRotYAmp.text = "5"; editRotYFreq.text = "0.2";
                editRotZAmp.text = "8"; editRotZFreq.text = "0.3";

            } else if (pIdx === 2) { // ⭐ Stars
                dropSource.selection = 2;
                editSizeX.text = "1500"; editSizeY.text = "1000"; editSizeZ.text = "1500";
                editSpeed.text = "40"; editDirX.text = "0.4"; editDirY.text = "-0.2"; editDirZ.text = "0.4";
                chkAlignWind.value = false;
                editCount.text = "70";
                editPartSize.text = "18";
                cpPartColor.setColor("#ffea00", false);
                editPosFreq.text = "0.8"; editPosAmpX.text = "40"; editPosAmpY.text = "40"; editPosAmpZ.text = "40";
                editRotXAmp.text = "20"; editRotXFreq.text = "0.5";
                editRotYAmp.text = "20"; editRotYFreq.text = "0.5";
                editRotZAmp.text = "45"; editRotZFreq.text = "0.8";

            } else if (pIdx === 3) { // ⛰️ Mountains
                dropSource.selection = 3;
                editSizeX.text = "2000"; editSizeY.text = "700"; editSizeZ.text = "1600";
                editSpeed.text = "60"; editDirX.text = "-1.0"; editDirY.text = "0.0"; editDirZ.text = "0.0";
                chkAlignWind.value = false;
                editCount.text = "12";
                editPartSize.text = "120";
                cpPartColor.setColor("#4a5568", false);
                editPosFreq.text = "0.2"; editPosAmpX.text = "20"; editPosAmpY.text = "10"; editPosAmpZ.text = "20";
                editRotXAmp.text = "0"; editRotXFreq.text = "0.1";
                editRotYAmp.text = "5"; editRotYFreq.text = "0.1";
                editRotZAmp.text = "0"; editRotZFreq.text = "0.1";

            } else if (pIdx === 4) { // ⚪ 3D Circles
                dropSource.selection = 4;
                editSizeX.text = "1200"; editSizeY.text = "800"; editSizeZ.text = "1000";
                editSpeed.text = "200"; editDirX.text = "1.0"; editDirY.text = "0.0"; editDirZ.text = "0.0";
                chkAlignWind.value = false;
                editCount.text = "60";
                editPartSize.text = "14";
                cpPartColor.setColor("#ffffff", false);

            } else if (pIdx === 5) { // ⬛ 3D Squares
                dropSource.selection = 5;
                editSizeX.text = "1200"; editSizeY.text = "800"; editSizeZ.text = "1000";
                editSpeed.text = "250"; editDirX.text = "1.0"; editDirY.text = "0.2"; editDirZ.text = "0.1";
                chkAlignWind.value = true;
                editCount.text = "60";
                editPartSize.text = "14";
                cpPartColor.setColor("#ff3b30", false);

            } else if (pIdx === 6) { // 🎬 Project Comp
                dropSource.selection = 6;
                chkAlignWind.value = true;

            } else if (pIdx === 7) { // 🎯 Selected Layers
                dropSource.selection = 7;
                chkAlignWind.value = true;
            }
            handleSourceChange();
        };

        // Select first tab
        tpanel.selection = 0;

        // ==========================================
        // ACTION BUTTONS
        // ==========================================
        var grpActions = win.add("group");
        grpActions.orientation = "column";
        grpActions.alignChildren = ["fill", "center"];
        grpActions.spacing = 4;

        var btnCreate = grpActions.add("button", undefined, "Build / Create WindBox + Cube");
        btnCreate.preferredSize.height = 34;

        var grpSubActions = grpActions.add("group");
        grpSubActions.orientation = "row";
        grpSubActions.alignChildren = ["fill", "center"];
        grpSubActions.spacing = 4;

        var btnUpdateUI = grpSubActions.add("button", undefined, "Sync to Controller");
        var btnLoadUI = grpSubActions.add("button", undefined, "Read Controller");
        var btnSelectSystem = grpSubActions.add("button", undefined, "Select System");

        // ---------- REPOSITORY FOOTER LINK ----------
        var grpRepoLink = win.add("group");
        grpRepoLink.orientation = "row";
        grpRepoLink.alignment = ["fill", "bottom"];
        grpRepoLink.alignChildren = ["center", "center"];
        grpRepoLink.margins = [0, 4, 0, 0];
        var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE_windBox");
        lblRepoLink.helpTip = "https://github.com/work2survive/AE_windBox";
        lblRepoLink.onClick = function () {
            var url = "https://github.com/work2survive/AE_windBox";
            if (typeof window !== "undefined" && window.open) {
                window.open(url, "_blank");
            } else if ($.os.indexOf("Windows") !== -1) {
                system.callSystem('explorer "' + url + '"');
            } else {
                system.callSystem('open "' + url + '"');
            }
        };

        // ---------- HELPER: NUMERIC PARSER ----------
        function getNum(editField, defaultVal) {
            var val = parseFloat(editField.text);
            return isNaN(val) ? defaultVal : val;
        }

        // ---------- HELPER: ADD SLIDER CONTROL ----------
        function addSlider(layer, effectName, defaultValue) {
            var slider = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            slider.name = effectName;
            slider.property("ADBE Slider Control-0001").setValue(defaultValue);
            return slider;
        }

        // ---------- HELPER: ADD COLOR CONTROL ----------
        function addColor(layer, effectName, defaultColorArray) {
            var colorProp = layer.property("ADBE Effect Parade").addProperty("ADBE Color Control");
            colorProp.name = effectName;
            colorProp.property("ADBE Color Control-0001").setValue(defaultColorArray);
            return colorProp;
        }

        // ---------- HELPER: ADD CHECKBOX CONTROL ----------
        function addCheckbox(layer, effectName, defaultValue) {
            var chk = layer.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
            chk.name = effectName;
            chk.property("ADBE Checkbox Control-0001").setValue(defaultValue ? 1 : 0);
            return chk;
        }

        // ---------- HELPER: SET TRANSFORM PROPERTY ----------
        function setTransformVal(layer, propName, val) {
            var xform = layer.property("ADBE Transform Group") || layer.property("Transform") || layer.transform;
            if (xform) {
                var p = null;
                if (propName === "Position") p = xform.property("ADBE Position") || xform.position;
                else if (propName === "Anchor Point") p = xform.property("ADBE Anchor Point") || xform.anchorPoint;
                else if (propName === "Orientation") p = xform.property("ADBE Orientation") || xform.orientation;
                else p = xform.property(propName);

                if (p && typeof p.setValue === "function") {
                    p.setValue(val);
                }
            }
        }

        // ==========================================
        // CREATE WINDBOX + 3D CUBE LOGIC
        // ==========================================
        btnCreate.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please select or open an active Composition first.", "AE WindBox");
                return;
            }

            var sysName = txtSysName.text.replace(/^\s+|\s+$/g, "");
            if (sysName.length === 0) sysName = "WindBox";

            var sizeX = Math.max(10, getNum(editSizeX, 1400));
            var sizeY = Math.max(10, getNum(editSizeY, 800));
            var sizeZ = Math.max(10, getNum(editSizeZ, 1000));
            var windSpd = getNum(editSpeed, 260);
            var dirX = getNum(editDirX, 1.0);
            var dirY = getNum(editDirY, 0.3);
            var dirZ = getNum(editDirZ, 0.2);
            var alignToWind = chkAlignWind.value;
            var numParticles = Math.max(1, Math.round(getNum(editCount, 50)));

            var posFreq = Math.max(0, getNum(editPosFreq, 1.6));
            var posAmpX = Math.max(0, getNum(editPosAmpX, 70));
            var posAmpY = Math.max(0, getNum(editPosAmpY, 50));
            var posAmpZ = Math.max(0, getNum(editPosAmpZ, 60));

            var rotXAmp = getNum(editRotXAmp, 60);
            var rotXFreq = Math.max(0, getNum(editRotXFreq, 1.2));
            var rotYAmp = getNum(editRotYAmp, 60);
            var rotYFreq = Math.max(0, getNum(editRotYFreq, 1.2));
            var rotZAmp = getNum(editRotZAmp, 75);
            var rotZFreq = Math.max(0, getNum(editRotZFreq, 1.5));

            var shouldBuildCube = chkCreateCube.value;
            var isCubeGuide = chkCubeGuide.value;
            var cubeFillColor = hexToRgb(cpCubeFill.value);
            var cubeStrokeColor = hexToRgb(cpCubeStroke.value);
            var cubeSidesOp = Math.max(0, Math.min(100, getNum(editCubeSidesOp, 10)));
            var cubeStrokeWidth = Math.max(0.5, getNum(editCubeStrokeW, 1.5));
            var cubeStrokeOp = Math.max(0, Math.min(100, getNum(editCubeStrokeOp, 85)));

            var particleType = dropSource.selection.index;
            var shapeSize = Math.max(1, getNum(editPartSize, 28));
            var partBaseColor = hexToRgb(cpPartColor.value);

            // Handle Project Comp or Custom Source Layer
            var chosenComp = null;
            if (particleType === 6) { // Project Composition
                if (projectCompItems.length > 0 && dropProjectComp.selection) {
                    chosenComp = projectCompItems[dropProjectComp.selection.index];
                }
                if (!chosenComp) {
                    alert("Please select a valid Project Composition from the dropdown.", "AE WindBox");
                    return;
                }
            }

            var templateLayers = [];
            if (particleType === 7) { // Selected Layer(s)
                if (!comp.selectedLayers || comp.selectedLayers.length === 0) {
                    alert("Please select at least one layer in the composition to use as the particle source.", "AE WindBox");
                    return;
                }
                for (var i = 0; i < comp.selectedLayers.length; i++) {
                    templateLayers.push(comp.selectedLayers[i]);
                }
            }

            if (app.beginUndoGroup) {
                app.beginUndoGroup("Create WindBox (" + sysName + ")");
            }

            try {
                // 1. Create WindBox Master Controller Null
                var ctrlName = sysName + "_Controller";
                var ctrlLayer = comp.layers.addNull();
                ctrlLayer.name = ctrlName;
                ctrlLayer.threeDLayer = true;
                ctrlLayer.shy = false;
                ctrlLayer.notShyable = true;
                ctrlLayer.label = 1; // Red label in After Effects (Label 1 = Red)
                ctrlLayer.colorLabel = "#ff3b30"; // Red label in emulator
                setTransformVal(ctrlLayer, "Position", [comp.width / 2, comp.height / 2, 0]);
                setTransformVal(ctrlLayer, "Anchor Point", [0, 0, 0]);

                // 2. Add Expression Controls to Controller
                // Size controls
                addSlider(ctrlLayer, "WindBox - Size X", sizeX);
                addSlider(ctrlLayer, "WindBox - Size Y", sizeY);
                addSlider(ctrlLayer, "WindBox - Size Z", sizeZ);

                // Wind & Dynamic Controls
                addSlider(ctrlLayer, "WindBox - Wind Speed", windSpd);
                addSlider(ctrlLayer, "WindBox - Number of Particles", numParticles);
                addSlider(ctrlLayer, "WindBox - Direction X", dirX);
                addSlider(ctrlLayer, "WindBox - Direction Y", dirY);
                addSlider(ctrlLayer, "WindBox - Direction Z", dirZ);
                addCheckbox(ctrlLayer, "WindBox - Align to Wind", alignToWind ? 1 : 0);

                // Cube appearance & Guide layer controls
                addCheckbox(ctrlLayer, "WindBox - Cube Guide Layer", isCubeGuide ? 1 : 0);
                addColor(ctrlLayer, "WindBox - Cube Fill Color", cubeFillColor);
                addSlider(ctrlLayer, "WindBox - Cube Fill Opacity", cubeSidesOp);
                addColor(ctrlLayer, "WindBox - Cube Stroke Color", cubeStrokeColor);
                addSlider(ctrlLayer, "WindBox - Cube Stroke Width", cubeStrokeWidth);
                addSlider(ctrlLayer, "WindBox - Cube Stroke Opacity", cubeStrokeOp);

                // Turbulence Wiggle controls
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Freq", posFreq);
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Amp X", posAmpX);
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Amp Y", posAmpY);
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Amp Z", posAmpZ);
                addSlider(ctrlLayer, "WindBox - Rot X Wiggle Freq", rotXFreq);
                addSlider(ctrlLayer, "WindBox - Rot X Wiggle Amp", rotXAmp);
                addSlider(ctrlLayer, "WindBox - Rot Y Wiggle Freq", rotYFreq);
                addSlider(ctrlLayer, "WindBox - Rot Y Wiggle Amp", rotYAmp);
                addSlider(ctrlLayer, "WindBox - Rot Z Wiggle Freq", rotZFreq);
                addSlider(ctrlLayer, "WindBox - Rot Z Wiggle Amp", rotZAmp);

                // 3. VIRTUAL 3D CUBE BOUNDING BOX (Guide Layer)
                if (shouldBuildCube) {
                    var halfX = sizeX / 2;
                    var halfY = sizeY / 2;
                    var halfZ = sizeZ / 2;

                    var faceConfigs = [
                        { name: "Front",  pos: [0, 0, -halfZ], rot: [0, 0, 0],   w: sizeX, h: sizeY },
                        { name: "Back",   pos: [0, 0, halfZ],  rot: [0, 180, 0], w: sizeX, h: sizeY },
                        { name: "Left",   pos: [-halfX, 0, 0], rot: [0, -90, 0], w: sizeZ, h: sizeY },
                        { name: "Right",  pos: [halfX, 0, 0],  rot: [0, 90, 0],  w: sizeZ, h: sizeY },
                        { name: "Top",    pos: [0, -halfY, 0], rot: [90, 0, 0],  w: sizeX, h: sizeZ },
                        { name: "Bottom", pos: [0, halfY, 0],  rot: [-90, 0, 0], w: sizeX, h: sizeZ }
                    ];

                    var faceExprs = {
                        "Front": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; [0, 0, -sz / 2];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sx), Math.max(1, sy)];'
                        },
                        "Back": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; [0, 0, sz / 2];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sx), Math.max(1, sy)];'
                        },
                        "Left": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; [-sx / 2, 0, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sz), Math.max(1, sy)];'
                        },
                        "Right": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; [sx / 2, 0, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sz), Math.max(1, sy)];'
                        },
                        "Top": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sy = m.effect("WindBox - Size Y")(1).value; [0, -sy / 2, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sz = m.effect("WindBox - Size Z")(1).value; [Math.max(1, sx), Math.max(1, sz)];'
                        },
                        "Bottom": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sy = m.effect("WindBox - Size Y")(1).value; [0, sy / 2, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sz = m.effect("WindBox - Size Z")(1).value; [Math.max(1, sx), Math.max(1, sz)];'
                        }
                    };

                    var exprSidesFill = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Fill Color")(1).value; } catch (e) { [0.55, 0.55, 0.55, 1]; }';
                    var exprSidesOp   = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Fill Opacity")(1).value; } catch (e) { 10; }';
                    var exprStrokeCol = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Color")(1).value; } catch (e) { [1, 1, 1, 1]; }';
                    var exprStrokeW   = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Width")(1).value; } catch (e) { 1.5; }';
                    var exprStrokeOp  = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Opacity")(1).value; } catch (e) { 85; }';

                    for (var f = 0; f < faceConfigs.length; f++) {
                        var cfg = faceConfigs[f];
                        var faceLayer = comp.layers.addShape();
                        faceLayer.name = sysName + "_Cube_Face_" + cfg.name;
                        faceLayer.threeDLayer = true;
                        faceLayer.shy = true;
                        faceLayer.guideLayer = isCubeGuide; // Virtual Guide Layer (Viewport only)
                        faceLayer.label = isCubeGuide ? 14 : 13; // Blue Guide / Grey
                        faceLayer.colorLabel = isCubeGuide ? "#5ac8fa" : "#8e8e93";

                        var faceGroup = faceLayer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
                        faceGroup.name = "Face Vector";

                        var faceContents = faceGroup.property("ADBE Vectors Group");

                        // Rectangle Shape
                        var faceRect = faceContents.addProperty("ADBE Vector Shape - Rect");
                        faceRect.property("ADBE Vector Rect Size").setValue([cfg.w, cfg.h]);
                        faceRect.property("ADBE Vector Rect Size").expression = faceExprs[cfg.name].size;

                        // Semitransparent Fill
                        var faceFill = faceContents.addProperty("ADBE Vector Graphic - Fill");
                        faceFill.property("ADBE Vector Fill Color").setValue(cubeFillColor);
                        faceFill.property("ADBE Vector Fill Color").expression = exprSidesFill;
                        faceFill.property("ADBE Vector Fill Opacity").setValue(cubeSidesOp);
                        faceFill.property("ADBE Vector Fill Opacity").expression = exprSidesOp;

                        // Stroke Lines
                        var faceStroke = faceContents.addProperty("ADBE Vector Graphic - Stroke");
                        faceStroke.property("ADBE Vector Stroke Color").setValue(cubeStrokeColor);
                        faceStroke.property("ADBE Vector Stroke Color").expression = exprStrokeCol;
                        faceStroke.property("ADBE Vector Stroke Width").setValue(cubeStrokeWidth);
                        faceStroke.property("ADBE Vector Stroke Width").expression = exprStrokeW;
                        faceStroke.property("ADBE Vector Stroke Opacity").setValue(cubeStrokeOp);
                        faceStroke.property("ADBE Vector Stroke Opacity").expression = exprStrokeOp;

                        // Parent Face directly to Master Controller
                        faceLayer.parent = ctrlLayer;
                        setTransformVal(faceLayer, "Anchor Point", [0, 0, 0]);
                        setTransformVal(faceLayer, "Position", cfg.pos);
                        setTransformVal(faceLayer, "Orientation", cfg.rot);

                        var xf = faceLayer.property("ADBE Transform Group") || faceLayer.transform;
                        var pProp = xf ? (xf.property("ADBE Position") || xf.position) : faceLayer.property("ADBE Position");
                        if (pProp && faceExprs[cfg.name]) {
                            pProp.expression = faceExprs[cfg.name].pos;
                        }
                    }
                }

                // 4. PARTICLE EXPRESSIONS (Motion, Alignment, Turbulence)
                var posExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var sX = Math.max(1, ctrl.effect("WindBox - Size X")(1).value);',
                    'var sY = Math.max(1, ctrl.effect("WindBox - Size Y")(1).value);',
                    'var sZ = Math.max(1, ctrl.effect("WindBox - Size Z")(1).value);',
                    'var spd = ctrl.effect("WindBox - Wind Speed")(1).value;',
                    'var dX = ctrl.effect("WindBox - Direction X")(1).value;',
                    'var dY = ctrl.effect("WindBox - Direction Y")(1).value;',
                    'var dZ = ctrl.effect("WindBox - Direction Z")(1).value;',
                    '',
                    'var len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);',
                    'var dir = (len > 0.0001) ? [dX / len, dY / len, dZ / len] : [1, 0, 0];',
                    '',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'seedRandom(pIndex * 9973 + 17, true);',
                    'var initPos = [',
                    '    (random() - 0.5) * sX,',
                    '    (random() - 0.5) * sY,',
                    '    (random() - 0.5) * sZ',
                    '];',
                    '',
                    'var dist = spd * time;',
                    'var curX = initPos[0] + dir[0] * dist;',
                    'var curY = initPos[1] + dir[1] * dist;',
                    'var curZ = initPos[2] + dir[2] * dist;',
                    '',
                    'function wrapAxis(val, size) {',
                    '    var shifted = val + size * 0.5;',
                    '    var m = shifted % size;',
                    '    if (m < 0) m += size;',
                    '    return m - size * 0.5;',
                    '}',
                    '',
                    'var bx = wrapAxis(curX, sX);',
                    'var by = wrapAxis(curY, sY);',
                    'var bz = wrapAxis(curZ, sZ);',
                    '',
                    'var pFreq = ctrl.effect("WindBox - Pos Wiggle Freq")(1).value;',
                    'var pAmpX = ctrl.effect("WindBox - Pos Wiggle Amp X")(1).value;',
                    'var pAmpY = ctrl.effect("WindBox - Pos Wiggle Amp Y")(1).value;',
                    'var pAmpZ = ctrl.effect("WindBox - Pos Wiggle Amp Z")(1).value;',
                    '',
                    'var wX = (pFreq > 0 && pAmpX > 0) ? (wiggle(pFreq, pAmpX)[0] - value[0]) : 0;',
                    'var wY = (pFreq > 0 && pAmpY > 0) ? (wiggle(pFreq, pAmpY, 1, 0.5, time + 11.3)[1] - value[1]) : 0;',
                    'var wZ = (pFreq > 0 && pAmpZ > 0) ? (wiggle(pFreq, pAmpZ, 1, 0.5, time + 23.7)[2] - value[2]) : 0;',
                    '',
                    'ctrl.toWorld([bx + wX, by + wY, bz + wZ]);'
                ].join("\n");

                var rotXExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var dY = ctrl.effect("WindBox - Direction Y")(1).value;',
                    'var dZ = ctrl.effect("WindBox - Direction Z")(1).value;',
                    'var alignWind = 0;',
                    'try { alignWind = ctrl.effect("WindBox - Align to Wind")(1).value; } catch(e) {}',
                    'var pitchAng = (alignWind == 1 && (dY != 0 || dZ != 0)) ? (-Math.atan2(dY, dZ) * 180 / Math.PI) : 0;',
                    'var f = ctrl.effect("WindBox - Rot X Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot X Wiggle Amp")(1).value;',
                    'var w = (f > 0 && a > 0) ? (wiggle(f, a)[0] - value[0] || wiggle(f, a) - value) : 0;',
                    'value + pitchAng + w;'
                ].join("\n");

                var rotYExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var dX = ctrl.effect("WindBox - Direction X")(1).value;',
                    'var dZ = ctrl.effect("WindBox - Direction Z")(1).value;',
                    'var alignWind = 0;',
                    'try { alignWind = ctrl.effect("WindBox - Align to Wind")(1).value; } catch(e) {}',
                    'var yawAng = (alignWind == 1 && (dX != 0 || dZ != 0)) ? (Math.atan2(dZ, dX) * 180 / Math.PI) : 0;',
                    'var f = ctrl.effect("WindBox - Rot Y Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot Y Wiggle Amp")(1).value;',
                    'var w = (f > 0 && a > 0) ? (wiggle(f, a)[0] - value[0] || wiggle(f, a) - value) : 0;',
                    'value + yawAng + w;'
                ].join("\n");

                var rotZExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var dX = ctrl.effect("WindBox - Direction X")(1).value;',
                    'var dY = ctrl.effect("WindBox - Direction Y")(1).value;',
                    'var spd = ctrl.effect("WindBox - Wind Speed")(1).value;',
                    'var alignWind = 0;',
                    'try { alignWind = ctrl.effect("WindBox - Align to Wind")(1).value; } catch(e) {}',
                    'var windAng = (alignWind == 1 && (dX != 0 || dY != 0)) ? (Math.atan2(dY, dX) * 180 / Math.PI) : 0;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'var spinDir = ((pIndex % 3) - 1);',
                    'var windSpin = (alignWind == 1) ? (spd * time * 0.15 * spinDir) : 0;',
                    'var f = ctrl.effect("WindBox - Rot Z Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot Z Wiggle Amp")(1).value;',
                    'var w = (f > 0 && a > 0) ? (wiggle(f, a)[0] - value[0] || wiggle(f, a) - value) : 0;',
                    'value + windAng + windSpin + w;'
                ].join("\n");

                var opacityExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var activeCount = ctrl.effect("WindBox - Number of Particles")(1).value;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    '(pIndex <= activeCount) ? value : 0;'
                ].join("\n");

                var scaleExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var activeCount = ctrl.effect("WindBox - Number of Particles")(1).value;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    '(pIndex <= activeCount) ? value : [0, 0, 0];'
                ].join("\n");

                // 5. GENERATE PARTICLE LAYERS
                for (var p = 1; p <= numParticles; p++) {
                    var pLayer;

                    if (particleType === 6) { // Project Composition
                        pLayer = comp.layers.add(chosenComp);
                    } else if (particleType === 7) { // Selected Timeline Layers
                        var src = templateLayers[(p - 1) % templateLayers.length];
                        pLayer = src.duplicate();
                    } else { // Procedural Vector Shapes: Leaves, Clouds, Stars, Mountains, Circle, Square
                        pLayer = comp.layers.addShape();
                        buildParticleShape(pLayer, particleType, shapeSize, partBaseColor, p);
                    }

                    pLayer.name = sysName + "_Particle_" + (p < 10 ? "0" + p : p);
                    pLayer.threeDLayer = true;
                    pLayer.shy = true;
                    pLayer.label = 9; // Green label

                    // Add Particle Index Slider
                    var idxSlider = pLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
                    idxSlider.name = "WindBox Particle Index";
                    idxSlider.property("ADBE Slider Control-0001").setValue(p);

                    // Attach Expressions to Transform properties
                    var xform = pLayer.property("ADBE Transform Group") || pLayer.transform;

                    var posProp = xform.property("ADBE Position") || xform.position;
                    if (posProp) posProp.expression = posExpr;

                    var rotXProp = xform.property("ADBE Rotate X") || xform.property("X Rotation") || xform.xRotation;
                    var rotYProp = xform.property("ADBE Rotate Y") || xform.property("Y Rotation") || xform.yRotation;
                    var rotZProp = xform.property("ADBE Rotate Z") || xform.property("Z Rotation") || xform.zRotation;

                    if (rotXProp) rotXProp.expression = rotXExpr;
                    if (rotYProp) rotYProp.expression = rotYExpr;
                    if (rotZProp) rotZProp.expression = rotZExpr;

                    var opacProp = xform.property("ADBE Opacity") || xform.opacity;
                    if (opacProp) opacProp.expression = opacityExpr;

                    var scaleProp = xform.property("ADBE Scale") || xform.scale;
                    if (scaleProp) scaleProp.expression = scaleExpr;
                }

                // Select the Controller layer so user can immediately animate it
                if (comp.selectedLayers) {
                    for (var sel = 0; sel < comp.selectedLayers.length; sel++) {
                        comp.selectedLayers[sel].selected = false;
                    }
                }
                ctrlLayer.selected = true;

            } catch (err) {
                alert("Error building WindBox:\n" + err.toString(), "AE WindBox Error");
            } finally {
                if (app.endUndoGroup) {
                    app.endUndoGroup();
                }
            }
        };

        // ==========================================
        // SYNC TO CONTROLLER (Push UI -> Controller)
        // ==========================================
        btnUpdateUI.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) return;

            var sysName = txtSysName.text.replace(/^\s+|\s+$/g, "");
            var ctrlLayer = null;

            if (comp.selectedLayers && comp.selectedLayers.length > 0 && comp.selectedLayers[0].name.indexOf("Controller") !== -1) {
                ctrlLayer = comp.selectedLayers[0];
            } else {
                try {
                    ctrlLayer = comp.layer(sysName + "_Controller");
                } catch (e) {
                    ctrlLayer = null;
                }
            }

            if (!ctrlLayer) {
                alert("Could not find a WindBox Controller layer. Please select it or match the System Name.", "AE WindBox");
                return;
            }

            if (app.beginUndoGroup) {
                app.beginUndoGroup("Sync WindBox UI to Controller");
            }
            try {
                function setSliderVal(effName, val) {
                    var fx = ctrlLayer.property("ADBE Effect Parade").property(effName);
                    if (fx) fx.property("ADBE Slider Control-0001").setValue(val);
                }

                function setColorVal(effName, rgbArr) {
                    var fx = ctrlLayer.property("ADBE Effect Parade").property(effName);
                    if (fx) fx.property("ADBE Color Control-0001").setValue(rgbArr);
                }

                function setCheckboxVal(effName, boolVal) {
                    var fx = ctrlLayer.property("ADBE Effect Parade").property(effName);
                    if (fx) fx.property("ADBE Checkbox Control-0001").setValue(boolVal ? 1 : 0);
                }

                setSliderVal("WindBox - Size X", Math.max(10, getNum(editSizeX, 1400)));
                setSliderVal("WindBox - Size Y", Math.max(10, getNum(editSizeY, 800)));
                setSliderVal("WindBox - Size Z", Math.max(10, getNum(editSizeZ, 1000)));
                setCheckboxVal("WindBox - Align to Wind", chkAlignWind.value);
                setCheckboxVal("WindBox - Cube Guide Layer", chkCubeGuide.value);
                setColorVal("WindBox - Cube Fill Color", hexToRgb(cpCubeFill.value));
                setSliderVal("WindBox - Cube Fill Opacity", Math.max(0, Math.min(100, getNum(editCubeSidesOp, 10))));
                setColorVal("WindBox - Cube Stroke Color", hexToRgb(cpCubeStroke.value));
                setSliderVal("WindBox - Cube Stroke Width", Math.max(0.5, getNum(editCubeStrokeW, 1.5)));
                setSliderVal("WindBox - Cube Stroke Opacity", Math.max(0, Math.min(100, getNum(editCubeStrokeOp, 85))));
                setSliderVal("WindBox - Wind Speed", getNum(editSpeed, 260));
                setSliderVal("WindBox - Number of Particles", Math.max(1, getNum(editCount, 50)));
                setSliderVal("WindBox - Direction X", getNum(editDirX, 1.0));
                setSliderVal("WindBox - Direction Y", getNum(editDirY, 0.3));
                setSliderVal("WindBox - Direction Z", getNum(editDirZ, 0.2));
                setSliderVal("WindBox - Pos Wiggle Freq", Math.max(0, getNum(editPosFreq, 1.6)));
                setSliderVal("WindBox - Pos Wiggle Amp X", Math.max(0, getNum(editPosAmpX, 70)));
                setSliderVal("WindBox - Pos Wiggle Amp Y", Math.max(0, getNum(editPosAmpY, 50)));
                setSliderVal("WindBox - Pos Wiggle Amp Z", Math.max(0, getNum(editPosAmpZ, 60)));
                setSliderVal("WindBox - Rot X Wiggle Freq", Math.max(0, getNum(editRotXFreq, 1.2)));
                setSliderVal("WindBox - Rot X Wiggle Amp", getNum(editRotXAmp, 60));
                setSliderVal("WindBox - Rot Y Wiggle Freq", Math.max(0, getNum(editRotYFreq, 1.2)));
                setSliderVal("WindBox - Rot Y Wiggle Amp", getNum(editRotYAmp, 60));
                setSliderVal("WindBox - Rot Z Wiggle Freq", Math.max(0, getNum(editRotZFreq, 1.5)));
                setSliderVal("WindBox - Rot Z Wiggle Amp", getNum(editRotZAmp, 75));
            } catch (err) {
                alert("Error syncing to Controller:\n" + err.toString(), "AE WindBox");
            } finally {
                if (app.endUndoGroup) {
                    app.endUndoGroup();
                }
            }
        };

        // ==========================================
        // READ FROM CONTROLLER (Pull Controller -> UI)
        // ==========================================
        btnLoadUI.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) return;

            var sysName = txtSysName.text.replace(/^\s+|\s+$/g, "");
            var ctrlLayer = null;

            if (comp.selectedLayers && comp.selectedLayers.length > 0 && comp.selectedLayers[0].name.indexOf("Controller") !== -1) {
                ctrlLayer = comp.selectedLayers[0];
            } else {
                try {
                    ctrlLayer = comp.layer(sysName + "_Controller");
                } catch (e) {
                    ctrlLayer = null;
                }
            }

            if (!ctrlLayer) {
                alert("Could not find a WindBox Controller layer. Please select it in the timeline.", "AE WindBox");
                return;
            }

            function getSliderVal(effName, fallback) {
                var fx = ctrlLayer.property("ADBE Effect Parade").property(effName);
                if (fx) return fx.property("ADBE Slider Control-0001").value;
                return fallback;
            }

            function getColorVal(effName, fallbackHex) {
                var fx = ctrlLayer.property("ADBE Effect Parade").property(effName);
                if (fx) {
                    var c = fx.property("ADBE Color Control-0001").value;
                    return rgbToHex(c);
                }
                return fallbackHex;
            }

            function getCheckboxVal(effName, fallbackBool) {
                var fx = ctrlLayer.property("ADBE Effect Parade").property(effName);
                if (fx) {
                    var v = fx.property("ADBE Checkbox Control-0001").value;
                    return (v === 1 || v === true);
                }
                return fallbackBool;
            }

            editSizeX.text = getSliderVal("WindBox - Size X", 1400).toString();
            editSizeY.text = getSliderVal("WindBox - Size Y", 800).toString();
            editSizeZ.text = getSliderVal("WindBox - Size Z", 1000).toString();
            chkAlignWind.value = getCheckboxVal("WindBox - Align to Wind", true);
            chkCubeGuide.value = getCheckboxVal("WindBox - Cube Guide Layer", true);
            cpCubeFill.setColor(getColorVal("WindBox - Cube Fill Color", "#8C8C8C"), false);
            editCubeSidesOp.text = Math.round(getSliderVal("WindBox - Cube Fill Opacity", 10)).toString();
            cpCubeStroke.setColor(getColorVal("WindBox - Cube Stroke Color", "#FFFFFF"), false);
            editCubeStrokeW.text = getSliderVal("WindBox - Cube Stroke Width", 1.5).toString();
            editCubeStrokeOp.text = Math.round(getSliderVal("WindBox - Cube Stroke Opacity", 85)).toString();
            editSpeed.text = getSliderVal("WindBox - Wind Speed", 260).toString();
            editCount.text = Math.round(getSliderVal("WindBox - Number of Particles", 50)).toString();
            editDirX.text = getSliderVal("WindBox - Direction X", 1.0).toString();
            editDirY.text = getSliderVal("WindBox - Direction Y", 0.3).toString();
            editDirZ.text = getSliderVal("WindBox - Direction Z", 0.2).toString();
            editPosFreq.text = getSliderVal("WindBox - Pos Wiggle Freq", 1.6).toString();
            editPosAmpX.text = getSliderVal("WindBox - Pos Wiggle Amp X", 70).toString();
            editPosAmpY.text = getSliderVal("WindBox - Pos Wiggle Amp Y", 50).toString();
            editPosAmpZ.text = getSliderVal("WindBox - Pos Wiggle Amp Z", 60).toString();
            editRotXFreq.text = getSliderVal("WindBox - Rot X Wiggle Freq", 1.2).toString();
            editRotXAmp.text = getSliderVal("WindBox - Rot X Wiggle Amp", 60).toString();
            editRotYFreq.text = getSliderVal("WindBox - Rot Y Wiggle Freq", 1.2).toString();
            editRotYAmp.text = getSliderVal("WindBox - Rot Y Wiggle Amp", 60).toString();
            editRotZFreq.text = getSliderVal("WindBox - Rot Z Wiggle Freq", 1.5).toString();
            editRotZAmp.text = getSliderVal("WindBox - Rot Z Wiggle Amp", 75).toString();
        };

        // ==========================================
        // SELECT ALL SYSTEM LAYERS
        // ==========================================
        btnSelectSystem.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) return;

            var sysName = txtSysName.text.replace(/^\s+|\s+$/g, "");
            for (var i = 1; i <= comp.numLayers; i++) {
                var lyr = comp.layer(i);
                if (lyr.name.indexOf(sysName) === 0) {
                    lyr.selected = true;
                } else {
                    lyr.selected = false;
                }
            }
        };

        // Resize layout handling
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        return win;
    }

    // Launch UI
    var windBoxPanel = buildWindBoxUI(thisObj);
    if (windBoxPanel instanceof Window) {
        windBoxPanel.center();
        windBoxPanel.show();
    } else {
        windBoxPanel.layout.layout(true);
    }

})(this);
