// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE WINDBOX v1.0
// =============================================================================
//
// PURPOSE:
//   A procedural 3D Wind Volume Particle System for Adobe After Effects,
//   integrated with the parametric 3D Cube Maker architecture from:
//   https://github.com/work2survive/AE-Cube-Maker-3D
//
// ARCHITECTURE & WORKFLOW:
//   1. 3D Cube Bounding Box (6 Parametric Shape Faces):
//      - Front, Back, Left, Right, Top, Bottom
//      - White outline strokes and semitransparent grey sides (animatable fill & stroke)
//      - Expressions dynamically link face positions & sizes to Master Controller
//   2. Procedural Wind Particles:
//      - Speed, 3D Direction vector [X, Y, Z] with auto-normalization
//      - 3D spatial wrapping within the cube volume
//      - 3-axis positional turbulence & independent 3-axis rotational turbulence
//      - Particle count control with seamless active culling
//   3. Master 3D Controller:
//      - Single null layer with Expression Slider & Color Controls
//      - Moving or rotating the controller transforms the entire wind volume in 3D
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript engine)
//   - Works both as a dockable panel (in ScriptUI Panels folder) and as a floating palette.
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
    // UI BUILDER
    // ==========================================
    function buildWindBoxUI(thisObj) {
        var isPanel = (thisObj instanceof Panel);
        var win = isPanel ? thisObj : new Window("palette", "AE WindBox v1.0", undefined, {
            resizeable: true
        });
        if (!(thisObj instanceof Panel)) {
            win.text = "AE WindBox v1.0";
        }

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        // ---------------------------------------------------------------------
        // UI Header (Panel Title + Version & Description)
        // ---------------------------------------------------------------------
        var pnlHeader = win.add("panel", undefined, "AE WindBox");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.spacing = 3;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblDesc = pnlHeader.add("statictext", undefined, "v1.0 - Procedural 3D Wind Volume Particle System with 3D Cube Bounding Box.");

        // ---------- SYSTEM NAME & HELP ----------
        var headerGroup = win.add("group");
        headerGroup.orientation = "row";
        headerGroup.alignChildren = ["left", "center"];
        headerGroup.spacing = 6;

        headerGroup.add("statictext", undefined, "System Name:");
        var txtSysName = headerGroup.add("edittext", undefined, "WindBox");
        txtSysName.characters = 12;

        var btnHelp = headerGroup.add("button", undefined, "?");
        btnHelp.maximumSize = [24, 22];
        btnHelp.onClick = function () {
            alert(
                "AE WindBox + 3D Cube Maker (v1.0)\n" +
                "=================================\n" +
                "1. Set Box Dimensions (Size X, Y, Z), Wind Speed, Direction & Wiggle.\n" +
                "2. The 3D Cube is constructed from 6 shape layers based on AE-Cube-Maker-3D architecture.\n" +
                "3. Features customizable stroke lines and semitransparent sides with live color pickers.\n" +
                "4. All parameters are rigged to the Master Controller as Expression Sliders & Color Controls,\n" +
                "   making both particles and the 3D cube 100% keyframeable in the timeline!\n\n" +
                "Tip: Moving or rotating the Controller null transforms the entire wind volume in 3D world space.",
                "About AE WindBox"
            );
        };

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
        var editSizeX = pnlSize.add("edittext", undefined, "1200");
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
        var editSpeed = grpSpeed.add("edittext", undefined, "300");
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
        var editDirY = grpDir.add("edittext", undefined, "0.0");
        editDirY.characters = 4;

        grpDir.add("statictext", undefined, "Z:");
        var editDirZ = grpDir.add("edittext", undefined, "0.0");
        editDirZ.characters = 4;

        // Particle Count Panel
        var pnlCount = tabFlow.add("panel", undefined, "Particles Count - Animatable");
        pnlCount.orientation = "row";
        pnlCount.alignChildren = ["left", "center"];
        pnlCount.spacing = 6;

        pnlCount.add("statictext", undefined, "Number of Particles:");
        var editCount = pnlCount.add("edittext", undefined, "60");
        editCount.characters = 5;

        // ==========================================
        // TAB 2: 3D CUBE (AE-CUBE-MAKER-3D)
        // ==========================================
        var tabCube = tpanel.add("tab", undefined, "3D Cube");
        tabCube.orientation = "column";
        tabCube.alignChildren = ["fill", "top"];
        tabCube.spacing = 6;
        tabCube.margins = 6;

        var chkCreateCube = tabCube.add("checkbox", undefined, "Build 3D Cube (AE-Cube-Maker-3D Architecture)");
        chkCreateCube.value = true;

        var chkCubeGuide = tabCube.add("checkbox", undefined, "Set Cube as Guide Layer (Viewport only)");
        chkCubeGuide.value = false;

        var pnlCubeStyle = tabCube.add("panel", undefined, "Cube Appearance");
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
        var editCubeSidesOp = grpCubeSidesOp.add("edittext", undefined, "12");
        editCubeSidesOp.characters = 4;
        grpCubeSidesOp.add("statictext", undefined, "(Semitransparent sides)");

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
        var editCubeStrokeW = grpCubeStrokeW.add("edittext", undefined, "2");
        editCubeStrokeW.characters = 4;

        // Stroke Opacity
        var grpCubeStrokeOp = pnlCubeStyle.add("group");
        grpCubeStrokeOp.orientation = "row";
        grpCubeStrokeOp.alignChildren = ["left", "center"];
        var lblStrokeOp = grpCubeStrokeOp.add("statictext", undefined, "Stroke Opacity (%):");
        lblStrokeOp.preferredSize = [135, -1];
        var editCubeStrokeOp = grpCubeStrokeOp.add("edittext", undefined, "90");
        editCubeStrokeOp.characters = 4;

        // ==========================================
        // TAB 3: POSITION WIGGLE
        // ==========================================
        var tabPosWiggle = tpanel.add("tab", undefined, "Pos Wiggle");
        tabPosWiggle.orientation = "column";
        tabPosWiggle.alignChildren = ["fill", "top"];
        tabPosWiggle.spacing = 6;
        tabPosWiggle.margins = 6;

        var pnlPosWig = tabPosWiggle.add("panel", undefined, "Particle Position Wiggle");
        pnlPosWig.orientation = "column";
        pnlPosWig.alignChildren = ["fill", "top"];
        pnlPosWig.spacing = 4;

        var grpPosFreq = pnlPosWig.add("group");
        grpPosFreq.orientation = "row";
        grpPosFreq.alignChildren = ["left", "center"];
        grpPosFreq.add("statictext", undefined, "Frequency (Hz):");
        var editPosFreq = grpPosFreq.add("edittext", undefined, "1.5");
        editPosFreq.characters = 5;

        var grpPosAmp = pnlPosWig.add("group");
        grpPosAmp.orientation = "row";
        grpPosAmp.alignChildren = ["fill", "center"];
        grpPosAmp.spacing = 4;

        grpPosAmp.add("statictext", undefined, "Amount (px):");
        grpPosAmp.add("statictext", undefined, "X:");
        var editPosAmpX = grpPosAmp.add("edittext", undefined, "60");
        editPosAmpX.characters = 4;

        grpPosAmp.add("statictext", undefined, "Y:");
        var editPosAmpY = grpPosAmp.add("edittext", undefined, "60");
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

        // X Rotation
        var pnlRotX = tabRotWiggle.add("panel", undefined, "X Rotation Wiggle");
        pnlRotX.orientation = "row";
        pnlRotX.alignChildren = ["fill", "center"];
        pnlRotX.spacing = 4;
        pnlRotX.add("statictext", undefined, "Amount (°):");
        var editRotXAmp = pnlRotX.add("edittext", undefined, "45");
        editRotXAmp.characters = 4;
        pnlRotX.add("statictext", undefined, "Freq (Hz):");
        var editRotXFreq = pnlRotX.add("edittext", undefined, "1.0");
        editRotXFreq.characters = 4;

        // Y Rotation
        var pnlRotY = tabRotWiggle.add("panel", undefined, "Y Rotation Wiggle");
        pnlRotY.orientation = "row";
        pnlRotY.alignChildren = ["fill", "center"];
        pnlRotY.spacing = 4;
        pnlRotY.add("statictext", undefined, "Amount (°):");
        var editRotYAmp = pnlRotY.add("edittext", undefined, "45");
        editRotYAmp.characters = 4;
        pnlRotY.add("statictext", undefined, "Freq (Hz):");
        var editRotYFreq = pnlRotY.add("edittext", undefined, "1.0");
        editRotYFreq.characters = 4;

        // Z Rotation
        var pnlRotZ = tabRotWiggle.add("panel", undefined, "Z Rotation Wiggle");
        pnlRotZ.orientation = "row";
        pnlRotZ.alignChildren = ["fill", "center"];
        pnlRotZ.spacing = 4;
        pnlRotZ.add("statictext", undefined, "Amount (°):");
        var editRotZAmp = pnlRotZ.add("edittext", undefined, "45");
        editRotZAmp.characters = 4;
        pnlRotZ.add("statictext", undefined, "Freq (Hz):");
        var editRotZFreq = pnlRotZ.add("edittext", undefined, "1.0");
        editRotZFreq.characters = 4;

        // ==========================================
        // TAB 5: PARTICLE SOURCE
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
            "Built-in 3D Circle (Vector)",
            "Built-in 3D Square (Vector)",
            "Use Selected Layer(s)"
        ]);
        dropSource.selection = 0;

        var grpPartSize = tabSource.add("group");
        grpPartSize.orientation = "row";
        grpPartSize.alignChildren = ["left", "center"];
        grpPartSize.add("statictext", undefined, "Shape Size (px):");
        var editPartSize = grpPartSize.add("edittext", undefined, "12");
        editPartSize.characters = 5;

        dropSource.onChange = function () {
            grpPartSize.enabled = (dropSource.selection.index !== 2);
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

            var sizeX = Math.max(10, getNum(editSizeX, 1200));
            var sizeY = Math.max(10, getNum(editSizeY, 800));
            var sizeZ = Math.max(10, getNum(editSizeZ, 1000));
            var windSpd = getNum(editSpeed, 300);
            var dirX = getNum(editDirX, 1.0);
            var dirY = getNum(editDirY, 0.0);
            var dirZ = getNum(editDirZ, 0.0);
            var numParticles = Math.max(1, Math.round(getNum(editCount, 60)));

            var posFreq = Math.max(0, getNum(editPosFreq, 1.5));
            var posAmpX = Math.max(0, getNum(editPosAmpX, 60));
            var posAmpY = Math.max(0, getNum(editPosAmpY, 60));
            var posAmpZ = Math.max(0, getNum(editPosAmpZ, 60));

            var rotXAmp = getNum(editRotXAmp, 45);
            var rotXFreq = Math.max(0, getNum(editRotXFreq, 1.0));
            var rotYAmp = getNum(editRotYAmp, 45);
            var rotYFreq = Math.max(0, getNum(editRotYFreq, 1.0));
            var rotZAmp = getNum(editRotZAmp, 45);
            var rotZFreq = Math.max(0, getNum(editRotZFreq, 1.0));

            var shouldBuildCube = chkCreateCube.value;
            var isCubeGuide = chkCubeGuide.value;
            var cubeFillColor = hexToRgb(cpCubeFill.value);
            var cubeStrokeColor = hexToRgb(cpCubeStroke.value);
            var cubeSidesOp = Math.max(0, Math.min(100, getNum(editCubeSidesOp, 12)));
            var cubeStrokeWidth = Math.max(0.5, getNum(editCubeStrokeW, 2));
            var cubeStrokeOp = Math.max(0, Math.min(100, getNum(editCubeStrokeOp, 90)));

            var particleType = dropSource.selection.index;
            var shapeSize = Math.max(1, getNum(editPartSize, 12));

            // Handle custom source layer selection
            var templateLayers = [];
            if (particleType === 2) {
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
                // 1. Create WindBox Controller Null
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

                // Cube appearance controls
                addColor(ctrlLayer, "WindBox - Cube Fill Color", cubeFillColor);
                addSlider(ctrlLayer, "WindBox - Cube Fill Opacity", cubeSidesOp);
                addColor(ctrlLayer, "WindBox - Cube Stroke Color", cubeStrokeColor);
                addSlider(ctrlLayer, "WindBox - Cube Stroke Width", cubeStrokeWidth);
                addSlider(ctrlLayer, "WindBox - Cube Stroke Opacity", cubeStrokeOp);

                // Wind Flow controls
                addSlider(ctrlLayer, "WindBox - Wind Speed", windSpd);
                addSlider(ctrlLayer, "WindBox - Number of Particles", numParticles);
                addSlider(ctrlLayer, "WindBox - Direction X", dirX);
                addSlider(ctrlLayer, "WindBox - Direction Y", dirY);
                addSlider(ctrlLayer, "WindBox - Direction Z", dirZ);

                // Wiggle controls
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

                // 3. 3D CUBE MAKER INTEGRATION (work2survive/AE-Cube-Maker-3D architecture)
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
                    var exprSidesOp   = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Fill Opacity")(1).value; } catch (e) { 12; }';
                    var exprStrokeCol = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Color")(1).value; } catch (e) { [1, 1, 1, 1]; }';
                    var exprStrokeW   = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Width")(1).value; } catch (e) { 2; }';
                    var exprStrokeOp  = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Opacity")(1).value; } catch (e) { 90; }';

                    for (var f = 0; f < faceConfigs.length; f++) {
                        var cfg = faceConfigs[f];
                        var faceLayer = comp.layers.addShape();
                        faceLayer.name = sysName + "_Cube_Face_" + cfg.name;
                        faceLayer.threeDLayer = true;
                        faceLayer.shy = true;
                        faceLayer.guideLayer = isCubeGuide;
                        faceLayer.label = 13; // Grey label

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

                // 4. Particle Expressions
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
                    'var f = ctrl.effect("WindBox - Rot X Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot X Wiggle Amp")(1).value;',
                    '(f > 0 && a > 0) ? wiggle(f, a) : value;'
                ].join("\n");

                var rotYExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var f = ctrl.effect("WindBox - Rot Y Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot Y Wiggle Amp")(1).value;',
                    '(f > 0 && a > 0) ? wiggle(f, a) : value;'
                ].join("\n");

                var rotZExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var f = ctrl.effect("WindBox - Rot Z Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot Z Wiggle Amp")(1).value;',
                    '(f > 0 && a > 0) ? wiggle(f, a) : value;'
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

                // 5. Generate Particle Layers
                for (var p = 1; p <= numParticles; p++) {
                    var pLayer;

                    if (particleType === 2) {
                        var src = templateLayers[(p - 1) % templateLayers.length];
                        pLayer = src.duplicate();
                    } else {
                        pLayer = comp.layers.addShape();
                        var shapeGroup = pLayer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
                        var shapeContents = shapeGroup.property("ADBE Vectors Group");

                        if (particleType === 0) {
                            var ellipse = shapeContents.addProperty("ADBE Vector Shape - Ellipse");
                            ellipse.property("ADBE Vector Ellipse Size").setValue([shapeSize, shapeSize]);
                        } else {
                            var rect = shapeContents.addProperty("ADBE Vector Shape - Rect");
                            rect.property("ADBE Vector Rect Size").setValue([shapeSize, shapeSize]);
                        }

                        var fill = shapeContents.addProperty("ADBE Vector Graphic - Fill");
                        fill.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);
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

                setSliderVal("WindBox - Size X", Math.max(10, getNum(editSizeX, 1200)));
                setSliderVal("WindBox - Size Y", Math.max(10, getNum(editSizeY, 800)));
                setSliderVal("WindBox - Size Z", Math.max(10, getNum(editSizeZ, 1000)));
                setColorVal("WindBox - Cube Fill Color", hexToRgb(cpCubeFill.value));
                setSliderVal("WindBox - Cube Fill Opacity", Math.max(0, Math.min(100, getNum(editCubeSidesOp, 12))));
                setColorVal("WindBox - Cube Stroke Color", hexToRgb(cpCubeStroke.value));
                setSliderVal("WindBox - Cube Stroke Width", Math.max(0.5, getNum(editCubeStrokeW, 2)));
                setSliderVal("WindBox - Cube Stroke Opacity", Math.max(0, Math.min(100, getNum(editCubeStrokeOp, 90))));
                setSliderVal("WindBox - Wind Speed", getNum(editSpeed, 300));
                setSliderVal("WindBox - Number of Particles", Math.max(1, getNum(editCount, 60)));
                setSliderVal("WindBox - Direction X", getNum(editDirX, 1.0));
                setSliderVal("WindBox - Direction Y", getNum(editDirY, 0.0));
                setSliderVal("WindBox - Direction Z", getNum(editDirZ, 0.0));
                setSliderVal("WindBox - Pos Wiggle Freq", Math.max(0, getNum(editPosFreq, 1.5)));
                setSliderVal("WindBox - Pos Wiggle Amp X", Math.max(0, getNum(editPosAmpX, 60)));
                setSliderVal("WindBox - Pos Wiggle Amp Y", Math.max(0, getNum(editPosAmpY, 60)));
                setSliderVal("WindBox - Pos Wiggle Amp Z", Math.max(0, getNum(editPosAmpZ, 60)));
                setSliderVal("WindBox - Rot X Wiggle Freq", Math.max(0, getNum(editRotXFreq, 1.0)));
                setSliderVal("WindBox - Rot X Wiggle Amp", getNum(editRotXAmp, 45));
                setSliderVal("WindBox - Rot Y Wiggle Freq", Math.max(0, getNum(editRotYFreq, 1.0)));
                setSliderVal("WindBox - Rot Y Wiggle Amp", getNum(editRotYAmp, 45));
                setSliderVal("WindBox - Rot Z Wiggle Freq", Math.max(0, getNum(editRotZFreq, 1.0)));
                setSliderVal("WindBox - Rot Z Wiggle Amp", getNum(editRotZAmp, 45));
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

            editSizeX.text = getSliderVal("WindBox - Size X", 1200).toString();
            editSizeY.text = getSliderVal("WindBox - Size Y", 800).toString();
            editSizeZ.text = getSliderVal("WindBox - Size Z", 1000).toString();
            cpCubeFill.setColor(getColorVal("WindBox - Cube Fill Color", "#8C8C8C"), false);
            editCubeSidesOp.text = Math.round(getSliderVal("WindBox - Cube Fill Opacity", 12)).toString();
            cpCubeStroke.setColor(getColorVal("WindBox - Cube Stroke Color", "#FFFFFF"), false);
            editCubeStrokeW.text = getSliderVal("WindBox - Cube Stroke Width", 2).toString();
            editCubeStrokeOp.text = Math.round(getSliderVal("WindBox - Cube Stroke Opacity", 90)).toString();
            editSpeed.text = getSliderVal("WindBox - Wind Speed", 300).toString();
            editCount.text = Math.round(getSliderVal("WindBox - Number of Particles", 60)).toString();
            editDirX.text = getSliderVal("WindBox - Direction X", 1.0).toString();
            editDirY.text = getSliderVal("WindBox - Direction Y", 0.0).toString();
            editDirZ.text = getSliderVal("WindBox - Direction Z", 0.0).toString();
            editPosFreq.text = getSliderVal("WindBox - Pos Wiggle Freq", 1.5).toString();
            editPosAmpX.text = getSliderVal("WindBox - Pos Wiggle Amp X", 60).toString();
            editPosAmpY.text = getSliderVal("WindBox - Pos Wiggle Amp Y", 60).toString();
            editPosAmpZ.text = getSliderVal("WindBox - Pos Wiggle Amp Z", 60).toString();
            editRotXFreq.text = getSliderVal("WindBox - Rot X Wiggle Freq", 1.0).toString();
            editRotXAmp.text = getSliderVal("WindBox - Rot X Wiggle Amp", 45).toString();
            editRotYFreq.text = getSliderVal("WindBox - Rot Y Wiggle Freq", 1.0).toString();
            editRotYAmp.text = getSliderVal("WindBox - Rot Y Wiggle Amp", 45).toString();
            editRotZFreq.text = getSliderVal("WindBox - Rot Z Wiggle Freq", 1.0).toString();
            editRotZAmp.text = getSliderVal("WindBox - Rot Z Wiggle Amp", 45).toString();
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
