// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: CYLINDER MAKER 3D
// =============================================================================
//
// PURPOSE:
//   An interactive ScriptUI panel for After Effects that creates and controls
//   a parametric 3D Cylinder / Circular Sector built out of native Shape Layers
//   parented to a master 3D controller layer inside a dedicated precomposition.
//
// GEOMETRY & ARCHITECTURE:
//   1. Geometry Parameters:
//      - Radius Distance (radius of the circular base).
//      - Extrude Distance (height / length along the extrusion axis).
//      - Rotation Segments (number of polygonal rectangle walls, e.g. 3 to 64).
//      - Slice Toggle & Angles (if slice is enabled, specify Start & End angle).
//
//   2. Appearance Parameters:
//      - Top / Front Cap Color.
//      - Walls Color.
//      - Bottom / Back Cap Color.
//      - Opacity (Fill & Stroke Opacity).
//      - Edge Stroke Color & Thickness.
//
//   3. Composition Hierarchy:
//      - Automatically creates a precomp named "cylinder_maker_XXXX".
//      - Cylinder_Master_Controller is Layer 1 on top with RED label.
//      - All walls, caps, and radial slice walls are parented to Master Controller.
//      - Master Effect Controls reside on the parent composition layer and dynamically
//        drive the geometry and appearance inside the precomp.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript engine).
//   - Web AE JS & ScriptUI Emulator (ae-core.js, ae-renderer.js, app.js).
// =============================================================================

(function(thisObj) {
    "use strict";

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Cylinder Maker 3D", undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Cylinder Maker 3D";
    }

    var currentPrecompName = "";

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 14;

    // -------------------------------------------------------------------------
    // 2. Helper Functions: Colors, Transforms & Cross-Platform Layer Access
    // -------------------------------------------------------------------------
    function hexToRgb(hex) {
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var num = parseInt(hex, 16);
        return [
            ((num >> 16) & 255) / 255, // Red (0.0 to 1.0)
            ((num >> 8) & 255) / 255,  // Green (0.0 to 1.0)
            (num & 255) / 255          // Blue (0.0 to 1.0)
        ];
    }

    function getTransformProp(layer, propName) {
        if (!layer) return null;
        var p = null;
        if (layer.transform && typeof layer.transform.property === "function") {
            p = layer.transform.property(propName);
        }
        if (!p && typeof layer.property === "function") {
            var tg = layer.property("ADBE Transform Group") || layer.property("Transform");
            if (tg && typeof tg.property === "function") {
                p = tg.property(propName);
            }
        }
        if (!p && layer.transform) {
            if (propName === "X Rotation") p = layer.transform.xRotation;
            else if (propName === "Y Rotation") p = layer.transform.yRotation;
            else if (propName === "Z Rotation") p = layer.transform.zRotation || layer.transform.rotation;
            else if (propName === "Scale") p = layer.transform.scale;
            else if (propName === "Orientation") p = layer.transform.orientation;
            else if (propName === "Position") p = layer.transform.position;
            else if (propName === "Anchor Point") p = layer.transform.anchorPoint;
            else if (propName === "Opacity") p = layer.transform.opacity;
        }
        if (!p) {
            if (propName === "X Rotation") p = layer.xRotation;
            else if (propName === "Y Rotation") p = layer.yRotation;
            else if (propName === "Z Rotation") p = layer.zRotation || layer.rotation;
            else if (propName === "Scale") p = layer.scale;
            else if (propName === "Orientation") p = layer.orientation;
            else if (propName === "Position") p = layer.position;
            else if (propName === "Anchor Point") p = layer.anchorPoint;
            else if (propName === "Opacity") p = layer.opacity;
        }
        return p;
    }

    function setTransformVal(layer, propName, val) {
        var p = getTransformProp(layer, propName);
        if (p && typeof p.setValue === "function") {
            p.setValue(val);
        }
    }

    function setTransformExpr(layer, propName, expr) {
        var p = getTransformProp(layer, propName);
        if (p) {
            p.expression = expr;
        }
    }

    function getLayer(comp, nameOrIndex) {
        if (!comp) return null;
        if (typeof comp.layer === "function") {
            try {
                return comp.layer(nameOrIndex);
            } catch (e) {}
        }
        if (comp.layers) {
            try {
                if (typeof nameOrIndex === "number") return comp.layers[nameOrIndex - 1] || comp.layers[nameOrIndex];
                if (typeof comp.layers.byName === "function") return comp.layers.byName(nameOrIndex);
                if (typeof comp.layers.find === "function") {
                    return comp.layers.find(function(l) { return l.name === nameOrIndex; }) || null;
                }
                for (var li = 1; li <= comp.layers.length; li++) {
                    var l = comp.layers[li];
                    if (l && l.name === nameOrIndex) return l;
                }
            } catch (e2) {}
        }
        return null;
    }

    function removeLayer(comp, layer) {
        if (!layer) return;
        if (typeof layer.remove === "function") {
            layer.remove();
        } else if (comp && comp.layers && typeof comp.layers.remove === "function") {
            comp.layers.remove(layer);
        }
    }

    function computeCapShape(r, n, isSlice, a0, a1) {
        if (typeof Shape === "undefined") return null;
        var s = new Shape();
        var span = a1 - a0;
        var isFull = !isSlice || Math.abs(span) >= 359.99;
        var verts = [];
        var ins = [];
        var outs = [];
        if (isFull) {
            for (var j = 0; j < n; j++) {
                var phi = (j / n) * 2 * Math.PI;
                verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);
                ins.push([0, 0]); outs.push([0, 0]);
            }
        } else {
            verts.push([0, 0]); ins.push([0, 0]); outs.push([0, 0]);
            for (var j = 0; j <= n; j++) {
                var phi = (a0 + j * (span / n)) * (Math.PI / 180);
                verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);
                ins.push([0, 0]); outs.push([0, 0]);
            }
        }
        s.vertices = verts;
        s.inTangents = ins;
        s.outTangents = outs;
        s.closed = true;
        return s;
    }

    // -------------------------------------------------------------------------
    // 3. UI Header (Panel Title + Version & Description)
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Cylinder Maker 3D");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "v1.2 - Parametric 3D Shape Layer Cylinder & Slice generator with live master rig.");

    // -------------------------------------------------------------------------
    // 4. Tabbed Panel: Geometry vs. Appearance
    // -------------------------------------------------------------------------
    var tabs = win.add("tabbedpanel");
    tabs.alignChildren = ["fill", "top"];
    tabs.alignment = ["fill", "top"];

    var tabGeometry = tabs.add("tab", undefined, "Geometry");
    tabGeometry.orientation = "column";
    tabGeometry.alignChildren = ["fill", "top"];
    tabGeometry.spacing = 10;
    tabGeometry.margins = 10;

    var tabAppearance = tabs.add("tab", undefined, "Appearance");
    tabAppearance.orientation = "column";
    tabAppearance.alignChildren = ["fill", "top"];
    tabAppearance.spacing = 10;
    tabAppearance.margins = 10;

    // --- Tab 1: Geometry Section ---
    var pnlDim = tabGeometry.add("panel", undefined, "Cylinder Dimensions");
    pnlDim.orientation = "column";
    pnlDim.spacing = 8;
    pnlDim.alignChildren = ["fill", "top"];
    pnlDim.alignment = ["fill", "top"];

    // Radius Distance Row
    var grpRad = pnlDim.add("group");
    grpRad.orientation = "row";
    grpRad.alignment = ["fill", "top"];
    var lblRad = grpRad.add("statictext", undefined, "Radius:");
    lblRad.preferredSize = [100, -1];
    var sldRad = grpRad.add("slider", undefined, 150, 20, 500);
    sldRad.alignment = ["fill", "center"];
    var txtRad = grpRad.add("edittext", undefined, "150");
    txtRad.characters = 4;

    // Extrude Distance Row
    var grpH = pnlDim.add("group");
    grpH.orientation = "row";
    grpH.alignment = ["fill", "top"];
    var lblH = grpH.add("statictext", undefined, "Extrude (Height):");
    lblH.preferredSize = [100, -1];
    var sldH = grpH.add("slider", undefined, 250, 20, 800);
    sldH.alignment = ["fill", "center"];
    var txtH = grpH.add("edittext", undefined, "250");
    txtH.characters = 4;

    // Rotation Segments Row
    var grpSeg = pnlDim.add("group");
    grpSeg.orientation = "row";
    grpSeg.alignment = ["fill", "top"];
    var lblSeg = grpSeg.add("statictext", undefined, "Wall Segments:");
    lblSeg.preferredSize = [100, -1];
    var sldSeg = grpSeg.add("slider", undefined, 16, 3, 48);
    sldSeg.alignment = ["fill", "center"];
    var txtSeg = grpSeg.add("edittext", undefined, "16");
    txtSeg.characters = 3;

    // --- Slice Options Panel ---
    var pnlSlice = tabGeometry.add("panel", undefined, "Slice Options (Sector)");
    pnlSlice.orientation = "column";
    pnlSlice.spacing = 8;
    pnlSlice.alignChildren = ["fill", "top"];
    pnlSlice.alignment = ["fill", "top"];

    var chkSlice = pnlSlice.add("checkbox", undefined, "Enable Slice");
    chkSlice.value = false;

    // Start Angle Row
    var grpStart = pnlSlice.add("group");
    grpStart.orientation = "row";
    grpStart.alignment = ["fill", "top"];
    var lblStart = grpStart.add("statictext", undefined, "Start Angle:");
    lblStart.preferredSize = [100, -1];
    var sldStart = grpStart.add("slider", undefined, 0, -360, 360);
    sldStart.alignment = ["fill", "center"];
    var txtStart = grpStart.add("edittext", undefined, "0");
    txtStart.characters = 5;

    // End Angle Row
    var grpEnd = pnlSlice.add("group");
    grpEnd.orientation = "row";
    grpEnd.alignment = ["fill", "top"];
    var lblEnd = grpEnd.add("statictext", undefined, "End Angle:");
    lblEnd.preferredSize = [100, -1];
    var sldEnd = grpEnd.add("slider", undefined, 270, -360, 360);
    sldEnd.alignment = ["fill", "center"];
    var txtEnd = grpEnd.add("edittext", undefined, "270");
    txtEnd.characters = 5;

    grpStart.enabled = false;
    grpEnd.enabled = false;

    chkSlice.onClick = function() {
        grpStart.enabled = chkSlice.value;
        grpEnd.enabled = chkSlice.value;
        buildOrUpdateCylinder(false);
    };

    // --- Tab 2: Appearance Section ---
    var pnlStyle = tabAppearance.add("panel", undefined, "Material & Colors");
    pnlStyle.orientation = "column";
    pnlStyle.spacing = 8;
    pnlStyle.alignChildren = ["fill", "top"];
    pnlStyle.alignment = ["fill", "top"];

    // Color Picker Helper
    function createColorPicker(parentGroup, defaultHex) {
        var grp = parentGroup.add("group");
        grp.orientation = "row";
        grp.alignment = ["fill", "center"];
        grp.spacing = 6;

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [36, 22];

        var txtHex = grp.add("edittext", undefined, defaultHex.toUpperCase());
        txtHex.preferredSize = [70, 22];
        txtHex.characters = 7;

        var picker = {
            group: grp,
            button: btnSwatch,
            edittext: txtHex,
            _color: defaultHex,
            value: defaultHex,
            onChange: null
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
                if (btnSwatch.notify) btnSwatch.notify("onDraw");
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
            var curHex = picker._color || "#2288EE";
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

    // Top / Front Cap Color
    var grpTopCol = pnlStyle.add("group");
    grpTopCol.orientation = "row";
    grpTopCol.alignment = ["fill", "top"];
    var lblTopCol = grpTopCol.add("statictext", undefined, "Top / Front Color:");
    lblTopCol.preferredSize = [120, -1];
    var cpTop = createColorPicker(grpTopCol, "#2288ee");
    cpTop.onChange = function() { buildOrUpdateCylinder(false); };

    // Walls Color
    var grpWallsCol = pnlStyle.add("group");
    grpWallsCol.orientation = "row";
    grpWallsCol.alignment = ["fill", "top"];
    var lblWallsCol = grpWallsCol.add("statictext", undefined, "Walls Color:");
    lblWallsCol.preferredSize = [120, -1];
    var cpWalls = createColorPicker(grpWallsCol, "#33aa55");
    cpWalls.onChange = function() { buildOrUpdateCylinder(false); };

    // Bottom / Back Cap Color
    var grpBotCol = pnlStyle.add("group");
    grpBotCol.orientation = "row";
    grpBotCol.alignment = ["fill", "top"];
    var lblBotCol = grpBotCol.add("statictext", undefined, "Bottom / Back Color:");
    lblBotCol.preferredSize = [120, -1];
    var cpBottom = createColorPicker(grpBotCol, "#ee8822");
    cpBottom.onChange = function() { buildOrUpdateCylinder(false); };

    // Opacity Slider
    var grpOp = pnlStyle.add("group");
    grpOp.orientation = "row";
    grpOp.alignment = ["fill", "top"];
    var lblOp = grpOp.add("statictext", undefined, "Opacity (%):");
    lblOp.preferredSize = [120, -1];
    var sldOp = grpOp.add("slider", undefined, 90, 0, 100);
    sldOp.alignment = ["fill", "center"];
    var txtOp = grpOp.add("edittext", undefined, "90");
    txtOp.characters = 3;

    // Stroke Color
    var grpStrokeCol = pnlStyle.add("group");
    grpStrokeCol.orientation = "row";
    grpStrokeCol.alignment = ["fill", "top"];
    var lblStrokeCol = grpStrokeCol.add("statictext", undefined, "Stroke Color:");
    lblStrokeCol.preferredSize = [120, -1];
    var cpStroke = createColorPicker(grpStrokeCol, "#ffffff");
    cpStroke.onChange = function() { buildOrUpdateCylinder(false); };

    // Stroke Thickness
    var grpThick = pnlStyle.add("group");
    grpThick.orientation = "row";
    grpThick.alignment = ["fill", "top"];
    var lblThick = grpThick.add("statictext", undefined, "Stroke Width:");
    lblThick.preferredSize = [120, -1];
    var sldThick = grpThick.add("slider", undefined, 2, 0, 20);
    sldThick.alignment = ["fill", "center"];
    var txtThick = grpThick.add("edittext", undefined, "2");
    txtThick.characters = 3;

    // Two-Way Sync for UI sliders
    function hookSliderText(sld, txt, onChangeFn, isInt) {
        function updateFromSlider() {
            var val = isInt ? Math.round(sld.value) : Math.round(sld.value * 10) / 10;
            if (isNaN(val)) val = isInt ? Math.round(sld.minvalue || 0) : 0;
            txt.text = String(val);
            if (typeof onChangeFn === "function") onChangeFn();
        }
        sld.onChanging = updateFromSlider;
        sld.onChange = updateFromSlider;

        txt.onChange = function() {
            var val = parseFloat(txt.text);
            if (isNaN(val)) val = (typeof sld.minvalue === "number") ? sld.minvalue : 0;
            var minV = (typeof sld.minvalue === "number") ? sld.minvalue : 0;
            var maxV = (typeof sld.maxvalue === "number") ? sld.maxvalue : 10000;
            val = Math.max(minV, Math.min(maxV, val));
            sld.value = val;
            txt.text = String(isInt ? Math.round(val) : Math.round(val * 10) / 10);
            if (typeof onChangeFn === "function") onChangeFn();
        };
    }

    var onLiveUpdate = function() { buildOrUpdateCylinder(false); };
    hookSliderText(sldRad, txtRad, onLiveUpdate, true);
    hookSliderText(sldH, txtH, onLiveUpdate, true);
    hookSliderText(sldSeg, txtSeg, onLiveUpdate, true);
    hookSliderText(sldStart, txtStart, onLiveUpdate, true);
    hookSliderText(sldEnd, txtEnd, onLiveUpdate, true);
    hookSliderText(sldOp, txtOp, onLiveUpdate, true);
    hookSliderText(sldThick, txtThick, onLiveUpdate, true);

    // Build Button
    var btnBuild = win.add("button", undefined, "Build / Rebuild 3D Cylinder");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.preferredSize = [-1, 36];
    btnBuild.onClick = function() {
        buildOrUpdateCylinder(true);
    };

    // --- Bottom Subtle Repository Link ---
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
    // 5. Core Generator & Dynamic Linking Logic
    // -------------------------------------------------------------------------
    function buildOrUpdateCylinder(forceRebuild) {
        if (!forceRebuild && !currentPrecompName) {
            return;
        }

        var parentComp = app.project ? app.project.activeItem : null;
        if (!parentComp || !(parentComp instanceof CompItem)) {
            alert("Please select or create an active Composition first.");
            return;
        }

        var radius = Math.max(1, parseFloat(txtRad.text) || 150);
        var height = Math.max(1, parseFloat(txtH.text) || 250);
        var segCount = Math.max(3, Math.min(64, Math.round(parseFloat(txtSeg.text) || 16)));
        var enableSlice = chkSlice.value;
        var startAngle = parseFloat(txtStart.text) || 0;
        var endAngle = parseFloat(txtEnd.text) || 270;

        var topColor = hexToRgb(cpTop.value);
        var wallsColor = hexToRgb(cpWalls.value);
        var bottomColor = hexToRgb(cpBottom.value);
        var strokeColor = hexToRgb(cpStroke.value);
        var strokeWidth = Math.max(0, parseFloat(txtThick.text) || 0);
        var opacityVal = Math.max(0, Math.min(100, parseFloat(txtOp.text) || 90));

        var center = [parentComp.width / 2, parentComp.height / 2, 0];

        // ---------------------------------------------------------------------
        // Case A: Structural Build / Rebuild
        // ---------------------------------------------------------------------
        if (forceRebuild) {
            if (app.beginUndoGroup) {
                app.beginUndoGroup("Build 3D Cylinder Precomp");
            }

            try {
                var randNum = Math.floor(1000 + Math.random() * 9000);
                var precompName = "cylinder_maker_" + randNum;
                currentPrecompName = precompName;

                // Clean up previous cylinder_maker and cube_maker layers from parent composition
                for (var p = parentComp.layers.length; p >= 1; p--) {
                    var oldL = getLayer(parentComp, p);
                    if (oldL && oldL.name && (
                        oldL.name === "Cylinder_Master_Controller" ||
                        oldL.name === "Cube_Master_Controller" ||
                        oldL.name.indexOf("cylinder_maker_") === 0 ||
                        oldL.name.indexOf("cube_maker_") === 0 ||
                        oldL.name.indexOf("Wall_") === 0 ||
                        oldL.name.indexOf("Cap_") === 0 ||
                        oldL.name.indexOf("Slice_") === 0 ||
                        oldL.name.indexOf("Face_") === 0
                    )) {
                        removeLayer(parentComp, oldL);
                    }
                }

                // 1. Create Master Controller Layer
                var master = parentComp.layers.addShape();
                master.name = "Cylinder_Master_Controller";
                master.threeDLayer = true;
                master.shy = false;
                master.notShyable = true;
                master.label = 1;               // RED label in AE
                master.colorLabel = "#ff3b30";  // RED label in emulator
                setTransformVal(master, "Anchor Point", [0, 0, 0]);
                setTransformVal(master, "Position", center);

                if (master.moveToBeginning) master.moveToBeginning();

                var sweepAngle = enableSlice ? (endAngle - startAngle) : 360;
                var alphaRad = (Math.abs(sweepAngle) / segCount) * (Math.PI / 180);
                var chordWidth = Math.max(1, 2 * radius * Math.sin(alphaRad / 2));
                var rMid = radius * Math.cos(alphaRad / 2);

                var createdLayers = [];

                // 2. Create Wall Segment Layers
                for (var i = 0; i < segCount; i++) {
                    var thetaDeg = startAngle + (i + 0.5) * (sweepAngle / segCount);
                    var rad = thetaDeg * (Math.PI / 180);
                    var segPos = [rMid * Math.sin(rad), 0, -rMid * Math.cos(rad)];
                    var segRot = [0, -thetaDeg, 0];

                    var wall = parentComp.layers.addShape();
                    wall.name = "Wall_" + (i + 1);
                    wall.threeDLayer = true;
                    wall.shy = true;

                    var rootW = wall.property("ADBE Root Vectors Group") || wall.property("Contents") || (wall.property && wall.property(1));
                    var grp = rootW.addProperty("ADBE Vector Group");
                    grp.name = "Wall Vector";

                    var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    grpContents.addProperty("ADBE Vector Shape - Rect");
                    grpContents.addProperty("ADBE Vector Graphic - Fill");
                    grpContents.addProperty("ADBE Vector Graphic - Stroke");

                    grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                    var rect = grpContents.property("ADBE Vector Shape - Rect") || grpContents.property(1);
                    if (rect) {
                        var rSize = rect.property("ADBE Vector Rect Size") || rect.property("Size") || rect.property(2) || rect.property(1);
                        if (rSize && rSize.setValue) rSize.setValue([chordWidth, height]);
                    }

                    var fill = grpContents.property("ADBE Vector Graphic - Fill") || grpContents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol && fCol.setValue) fCol.setValue(wallsColor);
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp && fOp.setValue) fOp.setValue(opacityVal);
                    }

                    var stroke = grpContents.property("ADBE Vector Graphic - Stroke") || grpContents.property(3);
                    if (stroke) {
                        var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                        if (sCol && sCol.setValue) sCol.setValue(strokeColor);
                        var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                        if (sW && sW.setValue) sW.setValue(strokeWidth);
                        var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                        if (sOp && sOp.setValue) sOp.setValue(strokeWidth <= 0.0001 ? 0 : opacityVal);
                    }

                    wall.parent = master;
                    setTransformVal(wall, "Anchor Point", [0, 0, 0]);
                    setTransformVal(wall, "Position", segPos);
                    setTransformVal(wall, "Orientation", segRot);

                    createdLayers.push(wall);
                }

                // 3. Create Slice Radial Walls (Always created so toggling Enable Slice dynamically in AE reveals them)
                var isSliceInitiallyActive = enableSlice && Math.abs(sweepAngle) < 359.99;
                var initialSliceOp = isSliceInitiallyActive ? opacityVal : 0;
                var initialSliceStrokeOp = (isSliceInitiallyActive && strokeWidth > 0.0001) ? opacityVal : 0;

                // Start Slice Wall
                var sRad = startAngle * (Math.PI / 180);
                var sPos = [(radius / 2) * Math.sin(sRad), 0, -(radius / 2) * Math.cos(sRad)];
                var sRot = [0, 90 - startAngle, 0];

                var sliceStartLayer = parentComp.layers.addShape();
                sliceStartLayer.name = "Slice_Start";
                sliceStartLayer.threeDLayer = true;
                sliceStartLayer.shy = true;

                var rootS = sliceStartLayer.property("ADBE Root Vectors Group") || sliceStartLayer.property("Contents") || (sliceStartLayer.property && sliceStartLayer.property(1));
                var grpS = rootS.addProperty("ADBE Vector Group");
                grpS.name = "Slice Vector";

                var grpSContents = grpS.property("ADBE Vectors Group") || grpS.property("Contents") || (grpS.property && grpS.property(2)) || (grpS.property && grpS.property(1));
                grpSContents.addProperty("ADBE Vector Shape - Rect");
                grpSContents.addProperty("ADBE Vector Graphic - Fill");
                grpSContents.addProperty("ADBE Vector Graphic - Stroke");

                grpSContents = grpS.property("ADBE Vectors Group") || grpS.property("Contents") || (grpS.property && grpS.property(2)) || (grpS.property && grpS.property(1));

                var rectS = grpSContents.property("ADBE Vector Shape - Rect") || grpSContents.property(1);
                if (rectS) {
                    var rsSize = rectS.property("ADBE Vector Rect Size") || rectS.property("Size") || rectS.property(2) || rectS.property(1);
                    if (rsSize && rsSize.setValue) rsSize.setValue([radius, height]);
                }

                var fillS = grpSContents.property("ADBE Vector Graphic - Fill") || grpSContents.property(2);
                if (fillS) {
                    var fsCol = fillS.property("ADBE Vector Fill Color") || fillS.property("Color") || fillS.property(1);
                    if (fsCol && fsCol.setValue) fsCol.setValue(wallsColor);
                    var fsOp = fillS.property("ADBE Vector Fill Opacity") || fillS.property("Opacity") || fillS.property(2);
                    if (fsOp && fsOp.setValue) fsOp.setValue(initialSliceOp);
                }

                var strokeS = grpSContents.property("ADBE Vector Graphic - Stroke") || grpSContents.property(3);
                if (strokeS) {
                    var ssCol = strokeS.property("ADBE Vector Stroke Color") || strokeS.property("Color") || strokeS.property(1);
                    if (ssCol && ssCol.setValue) ssCol.setValue(strokeColor);
                    var ssW = strokeS.property("ADBE Vector Stroke Width") || strokeS.property("Stroke Width") || strokeS.property(2);
                    if (ssW && ssW.setValue) ssW.setValue(strokeWidth);
                    var ssOp = strokeS.property("ADBE Vector Stroke Opacity") || strokeS.property("Opacity") || strokeS.property(3);
                    if (ssOp && ssOp.setValue) ssOp.setValue(initialSliceStrokeOp);
                }

                sliceStartLayer.parent = master;
                setTransformVal(sliceStartLayer, "Anchor Point", [0, 0, 0]);
                setTransformVal(sliceStartLayer, "Position", sPos);
                setTransformVal(sliceStartLayer, "Orientation", sRot);
                setTransformVal(sliceStartLayer, "Opacity", isSliceInitiallyActive ? 100 : 0);

                createdLayers.push(sliceStartLayer);

                // End Slice Wall
                var eRad = endAngle * (Math.PI / 180);
                var ePos = [(radius / 2) * Math.sin(eRad), 0, -(radius / 2) * Math.cos(eRad)];
                var eRot = [0, 90 - endAngle, 0];

                var sliceEndLayer = parentComp.layers.addShape();
                sliceEndLayer.name = "Slice_End";
                sliceEndLayer.threeDLayer = true;
                sliceEndLayer.shy = true;

                var rootE = sliceEndLayer.property("ADBE Root Vectors Group") || sliceEndLayer.property("Contents") || (sliceEndLayer.property && sliceEndLayer.property(1));
                var grpE = rootE.addProperty("ADBE Vector Group");
                grpE.name = "Slice Vector";

                var grpEContents = grpE.property("ADBE Vectors Group") || grpE.property("Contents") || (grpE.property && grpE.property(2)) || (grpE.property && grpE.property(1));
                grpEContents.addProperty("ADBE Vector Shape - Rect");
                grpEContents.addProperty("ADBE Vector Graphic - Fill");
                grpEContents.addProperty("ADBE Vector Graphic - Stroke");

                grpEContents = grpE.property("ADBE Vectors Group") || grpE.property("Contents") || (grpE.property && grpE.property(2)) || (grpE.property && grpE.property(1));

                var rectE = grpEContents.property("ADBE Vector Shape - Rect") || grpEContents.property(1);
                if (rectE) {
                    var reSize = rectE.property("ADBE Vector Rect Size") || rectE.property("Size") || rectE.property(2) || rectE.property(1);
                    if (reSize && reSize.setValue) reSize.setValue([radius, height]);
                }

                var fillE = grpEContents.property("ADBE Vector Graphic - Fill") || grpEContents.property(2);
                if (fillE) {
                    var feCol = fillE.property("ADBE Vector Fill Color") || fillE.property("Color") || fillE.property(1);
                    if (feCol && feCol.setValue) feCol.setValue(wallsColor);
                    var feOp = fillE.property("ADBE Vector Fill Opacity") || fillE.property("Opacity") || fillE.property(2);
                    if (feOp && feOp.setValue) feOp.setValue(initialSliceOp);
                }

                var strokeE = grpEContents.property("ADBE Vector Graphic - Stroke") || grpEContents.property(3);
                if (strokeE) {
                    var seCol = strokeE.property("ADBE Vector Stroke Color") || strokeE.property("Color") || strokeE.property(1);
                    if (seCol && seCol.setValue) seCol.setValue(strokeColor);
                    var seW = strokeE.property("ADBE Vector Stroke Width") || strokeE.property("Stroke Width") || strokeE.property(2);
                    if (seW && seW.setValue) seW.setValue(strokeWidth);
                    var seOp = strokeE.property("ADBE Vector Stroke Opacity") || strokeE.property("Opacity") || strokeE.property(3);
                    if (seOp && seOp.setValue) seOp.setValue(initialSliceStrokeOp);
                }

                sliceEndLayer.parent = master;
                setTransformVal(sliceEndLayer, "Anchor Point", [0, 0, 0]);
                setTransformVal(sliceEndLayer, "Position", ePos);
                setTransformVal(sliceEndLayer, "Orientation", eRot);
                setTransformVal(sliceEndLayer, "Opacity", isSliceInitiallyActive ? 100 : 0);

                createdLayers.push(sliceEndLayer);

                // 4. Create Top and Bottom Caps (using Path generator)
                function createCapLayer(capName, yPos, xRot, capColor) {
                    var cap = parentComp.layers.addShape();
                    cap.name = capName;
                    cap.threeDLayer = true;
                    cap.shy = true;

                    var rootVectors = cap.property("ADBE Root Vectors Group") || cap.property("Contents") || (cap.property && cap.property(1));
                    var grp = rootVectors.addProperty("ADBE Vector Group");
                    grp.name = "Cap Vector";

                    var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    grpContents.addProperty("ADBE Vector Shape - Group");
                    grpContents.addProperty("ADBE Vector Graphic - Fill");
                    grpContents.addProperty("ADBE Vector Graphic - Stroke");

                    // Re-query grpContents fresh after all additions to prevent stale references in ExtendScript
                    grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                    var shapeGroup = grpContents.property("ADBE Vector Shape - Group") || grpContents.property(1);
                    if (shapeGroup) {
                        var pProp = shapeGroup.property("ADBE Vector Shape") || shapeGroup.property("Path") || shapeGroup.property(1);
                        if (pProp && typeof Shape !== "undefined") {
                            try {
                                var initCapShape = computeCapShape(radius, segCount, enableSlice, startAngle, endAngle);
                                if (initCapShape) pProp.setValue(initCapShape);
                            } catch (eShape) {}
                        }
                    }

                    var fill = grpContents.property("ADBE Vector Graphic - Fill") || grpContents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol && fCol.setValue) fCol.setValue(capColor);
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp && fOp.setValue) fOp.setValue(opacityVal);
                    }

                    var stroke = grpContents.property("ADBE Vector Graphic - Stroke") || grpContents.property(3);
                    if (stroke) {
                        var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                        if (sCol && sCol.setValue) sCol.setValue(strokeColor);
                        var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                        if (sW && sW.setValue) sW.setValue(strokeWidth);
                        var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                        if (sOp && sOp.setValue) sOp.setValue(strokeWidth <= 0.0001 ? 0 : opacityVal);
                    }

                    cap.parent = master;
                    setTransformVal(cap, "Anchor Point", [0, 0, 0]);
                    setTransformVal(cap, "Position", [0, yPos, 0]);
                    setTransformVal(cap, "Orientation", [xRot, 0, 0]);

                    createdLayers.push(cap);
                    return cap;
                }

                var capTop = createCapLayer("Cap_Top", -height / 2, 90, topColor);
                var capBottom = createCapLayer("Cap_Bottom", height / 2, 90, bottomColor);

                // 5. Precompose: Deduplicate and sort indices ascending (required by AE ExtendScript)
                var indicesMap = {};
                if (master && master.index) indicesMap[master.index] = true;
                for (var ci = 0; ci < createdLayers.length; ci++) {
                    if (createdLayers[ci] && createdLayers[ci].index) {
                        indicesMap[createdLayers[ci].index] = true;
                    }
                }
                var indices = [];
                for (var kIdx in indicesMap) {
                    if (indicesMap.hasOwnProperty(kIdx)) {
                        indices.push(parseInt(kIdx, 10));
                    }
                }
                indices.sort(function(a, b) { return a - b; });

                var preComp = parentComp.layers.precompose(indices, precompName, true);

                // Center preMaster inside precomp
                var preCenter = [preComp.width / 2, preComp.height / 2, 0];
                var preMaster = getLayer(preComp, "Cylinder_Master_Controller") || (preComp.layer ? preComp.layer(1) : (preComp.layers && preComp.layers[0]));
                if (preMaster) {
                    preMaster.label = 1;
                    preMaster.colorLabel = "#ff3b30";
                    preMaster.notShyable = true;
                    if (preMaster.moveToBeginning) preMaster.moveToBeginning();
                    setTransformVal(preMaster, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preMaster, "Position", preCenter);
                }

                // Target precomp layer in parent composition
                var cylLayer = null;
                if (parentComp.layers) {
                    for (var pli = 1; pli <= parentComp.layers.length; pli++) {
                        var testL = parentComp.layer(pli);
                        if (testL && testL.source === preComp) {
                            cylLayer = testL;
                            break;
                        }
                    }
                }
                if (!cylLayer) {
                    cylLayer = getLayer(parentComp, precompName) || getLayer(parentComp, 1);
                }
                if (cylLayer) {
                    cylLayer.name = precompName;
                    cylLayer.threeDLayer = true;
                    if ("collapseTransformation" in cylLayer) {
                        cylLayer.collapseTransformation = true;
                    }
                    cylLayer.label = 1;
                    cylLayer.colorLabel = "#ff3b30";
                    cylLayer.notShyable = true;
                    setTransformVal(cylLayer, "Anchor Point", preCenter);
                    setTransformVal(cylLayer, "Position", center);
                    if (cylLayer.moveToBeginning) cylLayer.moveToBeginning();
                }

                // 6. MASTER CONTROLS ON PARENT COMPOSITION:
                function addMasterProp(type, name, val) {
                    if (!cylLayer) return null;
                    var parade = cylLayer.property("ADBE Effect Parade") || cylLayer.property("Effects");
                    if (!parade) return null;
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    if (eff.property(1) && typeof eff.property(1).setValue === "function") {
                        eff.property(1).setValue(val);
                    }
                    return eff;
                }

                addMasterProp("ADBE Slider Control", "Radius", radius);
                addMasterProp("ADBE Slider Control", "Extrude Distance", height);
                addMasterProp("ADBE Slider Control", "Rotation Segments", segCount);
                addMasterProp("ADBE Checkbox Control", "Enable Slice", enableSlice ? 1 : 0);
                addMasterProp("ADBE Slider Control", "Start Angle", startAngle);
                addMasterProp("ADBE Slider Control", "End Angle", endAngle);
                addMasterProp("ADBE Color Control", "Top Color", topColor);
                addMasterProp("ADBE Color Control", "Walls Color", wallsColor);
                addMasterProp("ADBE Color Control", "Bottom Color", bottomColor);
                addMasterProp("ADBE Slider Control", "Opacity", opacityVal);
                addMasterProp("ADBE Color Control", "Stroke Color", strokeColor);
                addMasterProp("ADBE Slider Control", "Stroke Width", strokeWidth);

                // 7. PRECOMP CONTROLLER LINKED EXPRESSIONS:
                function addPrecompLinkedEffect(type, name, effTarget, defaultVal) {
                    if (!preMaster) return null;
                    var parade = preMaster.property("ADBE Effect Parade") || preMaster.property("Effects");
                    if (!parade) return null;
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    if (eff.property(1) && typeof eff.property(1).setValue === "function") {
                        eff.property(1).setValue(defaultVal);
                    }
                    eff.property(1).expression = 'try { comp("' + parentComp.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '").layer("' + precompName + '").effect("' + effTarget + '")(1).value; } catch (err) { value; }';
                    return eff;
                }

                if (preMaster) {
                    addPrecompLinkedEffect("ADBE Slider Control", "Radius", "Radius", radius);
                    addPrecompLinkedEffect("ADBE Slider Control", "Extrude Distance", "Extrude Distance", height);
                    addPrecompLinkedEffect("ADBE Slider Control", "Rotation Segments", "Rotation Segments", segCount);
                    addPrecompLinkedEffect("ADBE Checkbox Control", "Enable Slice", "Enable Slice", enableSlice ? 1 : 0);
                    addPrecompLinkedEffect("ADBE Slider Control", "Start Angle", "Start Angle", startAngle);
                    addPrecompLinkedEffect("ADBE Slider Control", "End Angle", "End Angle", endAngle);
                    addPrecompLinkedEffect("ADBE Color Control", "Top Color", "Top Color", topColor);
                    addPrecompLinkedEffect("ADBE Color Control", "Walls Color", "Walls Color", wallsColor);
                    addPrecompLinkedEffect("ADBE Color Control", "Bottom Color", "Bottom Color", bottomColor);
                    addPrecompLinkedEffect("ADBE Slider Control", "Opacity", "Opacity", opacityVal);
                    addPrecompLinkedEffect("ADBE Color Control", "Stroke Color", "Stroke Color", strokeColor);
                    addPrecompLinkedEffect("ADBE Slider Control", "Stroke Width", "Stroke Width", strokeWidth);
                }

                // 8. EXPRESSIONS ON WALLS, SLICE WALLS & CAPS:
                var exprWallsColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Walls Color")(1).value; } catch(e) { value; }';
                var exprTopColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Top Color")(1).value; } catch(e) { value; }';
                var exprBottomColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Bottom Color")(1).value; } catch(e) { value; }';
                var exprOpacity = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Opacity")(1).value; } catch(e) { value; }';
                var exprStrokeColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Stroke Color")(1).value; } catch(e) { value; }';
                var exprStrokeWidth = 'try { Math.max(0, thisComp.layer("Cylinder_Master_Controller").effect("Stroke Width")(1).value); } catch(e) { value; }';
                var exprStrokeOpacity = 'try { var sw = thisComp.layer("Cylinder_Master_Controller").effect("Stroke Width")(1).value; var op = thisComp.layer("Cylinder_Master_Controller").effect("Opacity")(1).value; (sw <= 0.0001) ? 0 : op; } catch(e) { value; }';

                var exprSliceVisibility = 'try {\n' +
                    '    var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                    '    var en = m.effect("Enable Slice")(1).value > 0;\n' +
                    '    var a0 = m.effect("Start Angle")(1).value;\n' +
                    '    var a1 = m.effect("End Angle")(1).value;\n' +
                    '    var op = m.effect("Opacity")(1).value;\n' +
                    '    (en && Math.abs(a1 - a0) < 359.99) ? op : 0;\n' +
                    '} catch(e) { value; }';

                var exprSliceStrokeVisibility = 'try {\n' +
                    '    var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                    '    var en = m.effect("Enable Slice")(1).value > 0;\n' +
                    '    var a0 = m.effect("Start Angle")(1).value;\n' +
                    '    var a1 = m.effect("End Angle")(1).value;\n' +
                    '    var sw = m.effect("Stroke Width")(1).value;\n' +
                    '    var op = m.effect("Opacity")(1).value;\n' +
                    '    (en && Math.abs(a1 - a0) < 359.99 && sw > 0.0001) ? op : 0;\n' +
                    '} catch(e) { value; }';

                // Expressions on Wall segments
                for (var wi = 0; wi < segCount; wi++) {
                    var wLayer = getLayer(preComp, "Wall_" + (wi + 1));
                    if (wLayer && preMaster) {
                        wLayer.parent = preMaster;

                        var wExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")(1).value;\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\n' +
                            'var slice = m.effect("Enable Slice")(1).value > 0;\n' +
                            'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\n' +
                            'var a1 = slice ? m.effect("End Angle")(1).value : 360;\n' +
                            'var span = a1 - a0;\n' +
                            'var alpha = (Math.abs(span) / n) * (Math.PI / 180);\n' +
                            'var rMid = r * Math.cos(alpha / 2);\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\n' +
                            'var rad = theta * (Math.PI / 180);\n' +
                            '[rMid * Math.sin(rad), 0, -rMid * Math.cos(rad)];';

                        var wExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\n' +
                            'var slice = m.effect("Enable Slice")(1).value > 0;\n' +
                            'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\n' +
                            'var a1 = slice ? m.effect("End Angle")(1).value : 360;\n' +
                            'var span = a1 - a0;\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\n' +
                            '[0, -theta, 0];';

                        var wExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")(1).value;\n' +
                            'var h = m.effect("Extrude Distance")(1).value;\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\n' +
                            'var slice = m.effect("Enable Slice")(1).value > 0;\n' +
                            'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\n' +
                            'var a1 = slice ? m.effect("End Angle")(1).value : 360;\n' +
                            'var alpha = (Math.abs(a1 - a0) / n) * (Math.PI / 180);\n' +
                            'var chord = Math.max(1, 2 * r * Math.sin(alpha / 2));\n' +
                            '[chord, h];';

                        setTransformExpr(wLayer, "Position", wExprPos);
                        setTransformExpr(wLayer, "Orientation", wExprRot);

                        var wRoot = wLayer.property("ADBE Root Vectors Group") || wLayer.property("Contents") || (wLayer.property && wLayer.property(1));
                        var wGrp = wRoot ? (wRoot.property("Wall Vector") || wRoot.property(1)) : null;
                        if (wGrp) {
                            var wContents = wGrp.property("ADBE Vectors Group") || wGrp.property("Contents") || (wGrp.property && wGrp.property(2)) || (wGrp.property && wGrp.property(1));
                            if (wContents) {
                                var wRect = wContents.property("ADBE Vector Shape - Rect") || wContents.property(1);
                                if (wRect) {
                                    var wrSize = wRect.property("ADBE Vector Rect Size") || wRect.property("Size") || wRect.property(2) || wRect.property(1);
                                    if (wrSize) wrSize.expression = wExprSize;
                                }
                                var wFill = wContents.property("ADBE Vector Graphic - Fill") || wContents.property(2);
                                if (wFill) {
                                    var wfCol = wFill.property("ADBE Vector Fill Color") || wFill.property("Color") || wFill.property(1);
                                    if (wfCol) wfCol.expression = exprWallsColor;
                                    var wfOp = wFill.property("ADBE Vector Fill Opacity") || wFill.property("Opacity") || wFill.property(2);
                                    if (wfOp) wfOp.expression = exprOpacity;
                                }
                                var wStroke = wContents.property("ADBE Vector Graphic - Stroke") || wContents.property(3);
                                if (wStroke) {
                                    var wsCol = wStroke.property("ADBE Vector Stroke Color") || wStroke.property("Color") || wStroke.property(1);
                                    if (wsCol) wsCol.expression = exprStrokeColor;
                                    var wsW = wStroke.property("ADBE Vector Stroke Width") || wStroke.property("Stroke Width") || wStroke.property(2);
                                    if (wsW) wsW.expression = exprStrokeWidth;
                                    var wsOp = wStroke.property("ADBE Vector Stroke Opacity") || wStroke.property("Opacity") || wStroke.property(3);
                                    if (wsOp) wsOp.expression = exprStrokeOpacity;
                                }
                            }
                        }
                    }
                }

                // Expressions on Slice Start & End walls (Always present and reactive)
                var sLayer = getLayer(preComp, "Slice_Start");
                if (sLayer && preMaster) {
                    sLayer.parent = preMaster;
                    setTransformVal(sLayer, "Anchor Point", [0, 0, 0]);
                    var sRad = startAngle * (Math.PI / 180);
                    setTransformVal(sLayer, "Position", [(radius / 2) * Math.sin(sRad), 0, -(radius / 2) * Math.cos(sRad)]);
                    setTransformVal(sLayer, "Orientation", [0, 90 - startAngle, 0]);

                    var sExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var r = m.effect("Radius")(1).value;\n' +
                        'var a0 = m.effect("Start Angle")(1).value * (Math.PI / 180);\n' +
                        '[(r / 2) * Math.sin(a0), 0, -(r / 2) * Math.cos(a0)];';
                    var sExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var a0 = m.effect("Start Angle")(1).value;\n' +
                        '[0, 90 - a0, 0];';
                    var sExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var r = m.effect("Radius")(1).value;\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\n' +
                        '[r, h];';

                    setTransformExpr(sLayer, "Position", sExprPos);
                    setTransformExpr(sLayer, "Orientation", sExprRot);
                    setTransformExpr(sLayer, "Opacity", 'try { (thisComp.layer("Cylinder_Master_Controller").effect("Enable Slice")(1).value > 0 && Math.abs(thisComp.layer("Cylinder_Master_Controller").effect("End Angle")(1).value - thisComp.layer("Cylinder_Master_Controller").effect("Start Angle")(1).value) < 359.99) ? 100 : 0; } catch(e) { value; }');

                    var sRoot = sLayer.property("ADBE Root Vectors Group") || sLayer.property("Contents") || (sLayer.property && sLayer.property(1));
                    var sGrp = sRoot ? (sRoot.property("Slice Vector") || sRoot.property(1)) : null;
                    if (sGrp) {
                        var sContents = sGrp.property("ADBE Vectors Group") || sGrp.property("Contents") || (sGrp.property && sGrp.property(2)) || (sGrp.property && sGrp.property(1));
                        if (sContents) {
                            var sR = sContents.property("ADBE Vector Shape - Rect") || sContents.property(1);
                            if (sR) {
                                var srSize = sR.property("ADBE Vector Rect Size") || sR.property("Size") || sR.property(2) || sR.property(1);
                                if (srSize) srSize.expression = sExprSize;
                            }
                            var sFl = sContents.property("ADBE Vector Graphic - Fill") || sContents.property(2);
                            if (sFl) {
                                var sfCol = sFl.property("ADBE Vector Fill Color") || sFl.property("Color") || sFl.property(1);
                                if (sfCol) sfCol.expression = exprWallsColor;
                                var sfOp = sFl.property("ADBE Vector Fill Opacity") || sFl.property("Opacity") || sFl.property(2);
                                if (sfOp) sfOp.expression = exprSliceVisibility;
                            }
                            var sSt = sContents.property("ADBE Vector Graphic - Stroke") || sContents.property(3);
                            if (sSt) {
                                var ssCol = sSt.property("ADBE Vector Stroke Color") || sSt.property("Color") || sSt.property(1);
                                if (ssCol) ssCol.expression = exprStrokeColor;
                                var ssW = sSt.property("ADBE Vector Stroke Width") || sSt.property("Stroke Width") || sSt.property(2);
                                if (ssW) ssW.expression = exprStrokeWidth;
                                var ssOp = sSt.property("ADBE Vector Stroke Opacity") || sSt.property("Opacity") || sSt.property(3);
                                if (ssOp) ssOp.expression = exprSliceStrokeVisibility;
                            }
                        }
                    }
                }

                var eLayer = getLayer(preComp, "Slice_End");
                if (eLayer && preMaster) {
                    eLayer.parent = preMaster;
                    setTransformVal(eLayer, "Anchor Point", [0, 0, 0]);
                    var eRad = endAngle * (Math.PI / 180);
                    setTransformVal(eLayer, "Position", [(radius / 2) * Math.sin(eRad), 0, -(radius / 2) * Math.cos(eRad)]);
                    setTransformVal(eLayer, "Orientation", [0, 90 - endAngle, 0]);

                    var eExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var r = m.effect("Radius")(1).value;\n' +
                        'var a1 = m.effect("End Angle")(1).value * (Math.PI / 180);\n' +
                        '[(r / 2) * Math.sin(a1), 0, -(r / 2) * Math.cos(a1)];';
                    var eExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var a1 = m.effect("End Angle")(1).value;\n' +
                        '[0, 90 - a1, 0];';
                    var eExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var r = m.effect("Radius")(1).value;\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\n' +
                        '[r, h];';

                    setTransformExpr(eLayer, "Position", eExprPos);
                    setTransformExpr(eLayer, "Orientation", eExprRot);
                    setTransformExpr(eLayer, "Opacity", 'try { (thisComp.layer("Cylinder_Master_Controller").effect("Enable Slice")(1).value > 0 && Math.abs(thisComp.layer("Cylinder_Master_Controller").effect("End Angle")(1).value - thisComp.layer("Cylinder_Master_Controller").effect("Start Angle")(1).value) < 359.99) ? 100 : 0; } catch(e) { value; }');

                    var eRoot = eLayer.property("ADBE Root Vectors Group") || eLayer.property("Contents") || (eLayer.property && eLayer.property(1));
                    var eGrp = eRoot ? (eRoot.property("Slice Vector") || eRoot.property(1)) : null;
                    if (eGrp) {
                        var eContents = eGrp.property("ADBE Vectors Group") || eGrp.property("Contents") || (eGrp.property && eGrp.property(2)) || (eGrp.property && eGrp.property(1));
                        if (eContents) {
                            var eR = eContents.property("ADBE Vector Shape - Rect") || eContents.property(1);
                            if (eR) {
                                var erSize = eR.property("ADBE Vector Rect Size") || eR.property("Size") || eR.property(2) || eR.property(1);
                                if (erSize) erSize.expression = eExprSize;
                            }
                            var eFl = eContents.property("ADBE Vector Graphic - Fill") || eContents.property(2);
                            if (eFl) {
                                var efCol = eFl.property("ADBE Vector Fill Color") || eFl.property("Color") || eFl.property(1);
                                if (efCol) efCol.expression = exprWallsColor;
                                var efOp = eFl.property("ADBE Vector Fill Opacity") || eFl.property("Opacity") || eFl.property(2);
                                if (efOp) efOp.expression = exprSliceVisibility;
                            }
                            var eSt = eContents.property("ADBE Vector Graphic - Stroke") || eContents.property(3);
                            if (eSt) {
                                var esCol = eSt.property("ADBE Vector Stroke Color") || eSt.property("Color") || eSt.property(1);
                                if (esCol) esCol.expression = exprStrokeColor;
                                var esW = eSt.property("ADBE Vector Stroke Width") || eSt.property("Stroke Width") || eSt.property(2);
                                if (esW) esW.expression = exprStrokeWidth;
                                var esOp = eSt.property("ADBE Vector Stroke Opacity") || eSt.property("Opacity") || eSt.property(3);
                                if (esOp) esOp.expression = exprSliceStrokeVisibility;
                            }
                        }
                    }
                }

                // Cap Generator Expression (Dynamic Pie Slice or Circle Path)
                var exprCapPath = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                    'var r = Math.max(0.001, m.effect("Radius")(1).value);\n' +
                    'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\n' +
                    'var slice = m.effect("Enable Slice")(1).value > 0;\n' +
                    'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\n' +
                    'var a1 = slice ? m.effect("End Angle")(1).value : 360;\n' +
                    'var span = a1 - a0;\n' +
                    'var isFull = !slice || Math.abs(span) >= 359.99;\n' +
                    'var verts = [];\n' +
                    'var ins = [];\n' +
                    'var outs = [];\n' +
                    'if (isFull) {\n' +
                    '  for (var j = 0; j < n; j++) {\n' +
                    '    var phi = (j / n) * 2 * Math.PI;\n' +
                    '    verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\n' +
                    '    ins.push([0, 0]); outs.push([0, 0]);\n' +
                    '  }\n' +
                    '} else {\n' +
                    '  verts.push([0, 0]); ins.push([0, 0]); outs.push([0, 0]);\n' +
                    '  for (var j = 0; j <= n; j++) {\n' +
                    '    var phi = (a0 + j * (span / n)) * (Math.PI / 180);\n' +
                    '    verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\n' +
                    '    ins.push([0, 0]); outs.push([0, 0]);\n' +
                    '  }\n' +
                    '}\n' +
                    'createPath(verts, ins, outs, true);';

                // Expressions on Cap_Top
                var preCapTop = getLayer(preComp, "Cap_Top");
                if (preCapTop && preMaster) {
                    preCapTop.parent = preMaster;
                    setTransformVal(preCapTop, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preCapTop, "Position", [0, -height / 2, 0]);
                    setTransformVal(preCapTop, "Orientation", [90, 0, 0]);

                    var exprTopPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\n' +
                        '[0, -h / 2, 0];';
                    setTransformExpr(preCapTop, "Position", exprTopPos);

                    var topRoot = preCapTop.property("ADBE Root Vectors Group") || preCapTop.property("Contents") || (preCapTop.property && preCapTop.property(1));
                    var topGrp = topRoot ? (topRoot.property("Cap Vector") || topRoot.property(1)) : null;
                    if (topGrp) {
                        var topContents = topGrp.property("ADBE Vectors Group") || topGrp.property("Contents") || (topGrp.property && topGrp.property(2)) || (topGrp.property && topGrp.property(1));
                        if (topContents) {
                            var topShape = topContents.property("ADBE Vector Shape - Group") || topContents.property(1);
                            if (topShape) {
                                var pProp = topShape.property("ADBE Vector Shape") || topShape.property("Path") || topShape.property(1);
                                if (pProp) {
                                    try {
                                        var initTShape = computeCapShape(radius, segCount, enableSlice, startAngle, endAngle);
                                        if (initTShape) pProp.setValue(initTShape);
                                    } catch (eTopS) {}
                                    pProp.expression = exprCapPath;
                                }
                            }
                            var topFl = topContents.property("ADBE Vector Graphic - Fill") || topContents.property(2);
                            if (topFl) {
                                var tfCol = topFl.property("ADBE Vector Fill Color") || topFl.property("Color") || topFl.property(1);
                                if (tfCol) tfCol.expression = exprTopColor;
                                var tfOp = topFl.property("ADBE Vector Fill Opacity") || topFl.property("Opacity") || topFl.property(2);
                                if (tfOp) tfOp.expression = exprOpacity;
                            }
                            var topSt = topContents.property("ADBE Vector Graphic - Stroke") || topContents.property(3);
                            if (topSt) {
                                var tsCol = topSt.property("ADBE Vector Stroke Color") || topSt.property("Color") || topSt.property(1);
                                if (tsCol) tsCol.expression = exprStrokeColor;
                                var tsW = topSt.property("ADBE Vector Stroke Width") || topSt.property("Stroke Width") || topSt.property(2);
                                if (tsW) tsW.expression = exprStrokeWidth;
                                var tsOp = topSt.property("ADBE Vector Stroke Opacity") || topSt.property("Opacity") || topSt.property(3);
                                if (tsOp) tsOp.expression = exprStrokeOpacity;
                            }
                        }
                    }
                }

                // Expressions on Cap_Bottom
                var preCapBot = getLayer(preComp, "Cap_Bottom");
                if (preCapBot && preMaster) {
                    preCapBot.parent = preMaster;
                    setTransformVal(preCapBot, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preCapBot, "Position", [0, height / 2, 0]);
                    setTransformVal(preCapBot, "Orientation", [90, 0, 0]);

                    var exprBotPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\n' +
                        '[0, h / 2, 0];';
                    setTransformExpr(preCapBot, "Position", exprBotPos);

                    var botRoot = preCapBot.property("ADBE Root Vectors Group") || preCapBot.property("Contents") || (preCapBot.property && preCapBot.property(1));
                    var botGrp = botRoot ? (botRoot.property("Cap Vector") || botRoot.property(1)) : null;
                    if (botGrp) {
                        var botContents = botGrp.property("ADBE Vectors Group") || botGrp.property("Contents") || (botGrp.property && botGrp.property(2)) || (botGrp.property && botGrp.property(1));
                        if (botContents) {
                            var botShape = botContents.property("ADBE Vector Shape - Group") || botContents.property(1);
                            if (botShape) {
                                var bpProp = botShape.property("ADBE Vector Shape") || botShape.property("Path") || botShape.property(1);
                                if (bpProp) {
                                    try {
                                        var initBShape = computeCapShape(radius, segCount, enableSlice, startAngle, endAngle);
                                        if (initBShape) bpProp.setValue(initBShape);
                                    } catch (eBotS) {}
                                    bpProp.expression = exprCapPath;
                                }
                            }
                            var botFl = botContents.property("ADBE Vector Graphic - Fill") || botContents.property(2);
                            if (botFl) {
                                var bfCol = botFl.property("ADBE Vector Fill Color") || botFl.property("Color") || botFl.property(1);
                                if (bfCol) bfCol.expression = exprBottomColor;
                                var bfOp = botFl.property("ADBE Vector Fill Opacity") || botFl.property("Opacity") || botFl.property(2);
                                if (bfOp) bfOp.expression = exprOpacity;
                            }
                            var botSt = botContents.property("ADBE Vector Graphic - Stroke") || botContents.property(3);
                            if (botSt) {
                                var bsCol = botSt.property("ADBE Vector Stroke Color") || botSt.property("Color") || botSt.property(1);
                                if (bsCol) bsCol.expression = exprStrokeColor;
                                var bsW = botSt.property("ADBE Vector Stroke Width") || botSt.property("Stroke Width") || botSt.property(2);
                                if (bsW) bsW.expression = exprStrokeWidth;
                                var bsOp = botSt.property("ADBE Vector Stroke Opacity") || botSt.property("Opacity") || botSt.property(3);
                                if (bsOp) bsOp.expression = exprStrokeOpacity;
                            }
                        }
                    }
                }

                if (cylLayer) cylLayer.selected = true;
                $.writeln("Cylinder Maker: Successfully created 3D cylinder on [" + precompName + "] linked to precomp.");
            } catch (err) {
                alert("Cylinder Maker Error: " + err.toString());
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        }
        // ---------------------------------------------------------------------
        // Case B: Live Property Update on Existing Layers
        // ---------------------------------------------------------------------
        else {
            var preComp = null;
            if (app.project && app.project.items) {
                for (var k = 0; k < app.project.items.length; k++) {
                    var item = app.project.items[k];
                    if (item && item.name === currentPrecompName) {
                        preComp = item;
                        break;
                    }
                }
            }

            function setLayerEffectVal(layer, effName, val) {
                if (!layer) return;
                var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
                if (parade) {
                    var eff = parade.property(effName);
                    if (eff) {
                        var p = eff.property(1) || eff.property("Slider") || eff.property("Checkbox") || eff.property("Color");
                        if (p && p.setValue) p.setValue(val);
                    }
                }
            }

            // 1. Update Master Effect Controls on the parent comp's cylinder_maker layer
            var cylLayer = getLayer(parentComp, currentPrecompName) || getLayer(parentComp, 1);
            if (cylLayer) {
                setLayerEffectVal(cylLayer, "Radius", radius);
                setLayerEffectVal(cylLayer, "Extrude Distance", height);
                setLayerEffectVal(cylLayer, "Rotation Segments", segCount);
                setLayerEffectVal(cylLayer, "Enable Slice", enableSlice ? 1 : 0);
                setLayerEffectVal(cylLayer, "Start Angle", startAngle);
                setLayerEffectVal(cylLayer, "End Angle", endAngle);
                setLayerEffectVal(cylLayer, "Top Color", topColor);
                setLayerEffectVal(cylLayer, "Walls Color", wallsColor);
                setLayerEffectVal(cylLayer, "Bottom Color", bottomColor);
                setLayerEffectVal(cylLayer, "Opacity", opacityVal);
                setLayerEffectVal(cylLayer, "Stroke Color", strokeColor);
                setLayerEffectVal(cylLayer, "Stroke Width", strokeWidth);
            }

            var targetComp = preComp || parentComp;
            var master = getLayer(targetComp, "Cylinder_Master_Controller");
            if (master) {
                setLayerEffectVal(master, "Radius", radius);
                setLayerEffectVal(master, "Extrude Distance", height);
                setLayerEffectVal(master, "Rotation Segments", segCount);
                setLayerEffectVal(master, "Enable Slice", enableSlice ? 1 : 0);
                setLayerEffectVal(master, "Start Angle", startAngle);
                setLayerEffectVal(master, "End Angle", endAngle);
                setLayerEffectVal(master, "Top Color", topColor);
                setLayerEffectVal(master, "Walls Color", wallsColor);
                setLayerEffectVal(master, "Bottom Color", bottomColor);
                setLayerEffectVal(master, "Opacity", opacityVal);
                setLayerEffectVal(master, "Stroke Color", strokeColor);
                setLayerEffectVal(master, "Stroke Width", strokeWidth);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 6. Layout & Show Window
    // -------------------------------------------------------------------------
    if (win) {
        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        }
    }

    return win;
})(this);
