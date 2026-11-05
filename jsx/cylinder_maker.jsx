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
            return comp.layer(nameOrIndex);
        }
        if (comp.layers) {
            if (typeof nameOrIndex === "number") return comp.layers[nameOrIndex - 1];
            if (typeof comp.layers.byName === "function") return comp.layers.byName(nameOrIndex);
            if (typeof comp.layers.find === "function") {
                return comp.layers.find(function(l) { return l.name === nameOrIndex; }) || null;
            }
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
        var Z = [0, 0];
        if (isFull) {
            for (var j = 0; j < n; j++) {
                var phi = (j / n) * 2 * Math.PI;
                verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);
                ins.push(Z); outs.push(Z);
            }
        } else {
            verts.push([0, 0]); ins.push(Z); outs.push(Z);
            for (var j = 0; j <= n; j++) {
                var phi = (a0 + j * (span / n)) * (Math.PI / 180);
                verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);
                ins.push(Z); outs.push(Z);
            }
        }
        s.vertices = verts;
        s.inTangents = ins;
        s.outTangents = outs;
        s.closed = true;
        return s;
    }

    // -------------------------------------------------------------------------
    // 3. UI Header
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Cylinder Maker 3D - v1.0");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "Parametric 3D Shape Layer Cylinder & Slice generator with live master rig.");

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
    var sldRad = grpRad.add("slider", undefined, 150, { minvalue: 20, maxvalue: 500 });
    sldRad.alignment = ["fill", "center"];
    var txtRad = grpRad.add("edittext", undefined, "150");
    txtRad.characters = 4;

    // Extrude Distance Row
    var grpH = pnlDim.add("group");
    grpH.orientation = "row";
    grpH.alignment = ["fill", "top"];
    var lblH = grpH.add("statictext", undefined, "Extrude (Height):");
    lblH.preferredSize = [100, -1];
    var sldH = grpH.add("slider", undefined, 250, { minvalue: 20, maxvalue: 800 });
    sldH.alignment = ["fill", "center"];
    var txtH = grpH.add("edittext", undefined, "250");
    txtH.characters = 4;

    // Rotation Segments Row
    var grpSeg = pnlDim.add("group");
    grpSeg.orientation = "row";
    grpSeg.alignment = ["fill", "top"];
    var lblSeg = grpSeg.add("statictext", undefined, "Wall Segments:");
    lblSeg.preferredSize = [100, -1];
    var sldSeg = grpSeg.add("slider", undefined, 16, { minvalue: 3, maxvalue: 48 });
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
    var sldStart = grpStart.add("slider", undefined, 0, { minvalue: -360, maxvalue: 360 });
    sldStart.alignment = ["fill", "center"];
    var txtStart = grpStart.add("edittext", undefined, "0");
    txtStart.characters = 5;

    // End Angle Row
    var grpEnd = pnlSlice.add("group");
    grpEnd.orientation = "row";
    grpEnd.alignment = ["fill", "top"];
    var lblEnd = grpEnd.add("statictext", undefined, "End Angle:");
    lblEnd.preferredSize = [100, -1];
    var sldEnd = grpEnd.add("slider", undefined, 270, { minvalue: -360, maxvalue: 360 });
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
            if (typeof document !== "undefined") {
                var input = document.createElement("input");
                input.type = "color";
                input.value = picker._color;
                input.oninput = function() {
                    setColor(input.value, true);
                };
                input.click();
                return;
            }

            var hexNum = parseInt(picker._color.replace("#", ""), 16);
            var result = -1;
            if (typeof $.colorPicker === "function") {
                result = $.colorPicker(hexNum);
            }
            if (result !== -1 && result !== undefined && result !== null) {
                var hexStr = result.toString(16);
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
    var sldOp = grpOp.add("slider", undefined, 90, { minvalue: 0, maxvalue: 100 });
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
    var sldThick = grpThick.add("slider", undefined, 2, { minvalue: 0, maxvalue: 20 });
    sldThick.alignment = ["fill", "center"];
    var txtThick = grpThick.add("edittext", undefined, "2");
    txtThick.characters = 3;

    // Two-Way Sync for UI sliders
    function hookSliderText(sld, txt, onChangeFn, isInt) {
        sld.onChanging = function() {
            txt.text = String(isInt ? Math.round(sld.value) : Math.round(sld.value * 10) / 10);
            onChangeFn();
        };
        txt.onChange = function() {
            var val = parseFloat(txt.text) || 0;
            sld.value = Math.max(sld.minvalue, Math.min(sld.maxvalue, val));
            onChangeFn();
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

                    var grp = wall.property("Contents").addProperty("ADBE Vector Group");
                    grp.name = "Wall Vector";

                    var rect = grp.property("Contents").addProperty("ADBE Vector Shape - Rect");
                    rect.property("Size").setValue([chordWidth, height]);

                    var fill = grp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fill.property("Color").setValue(wallsColor);
                    fill.property("Opacity").setValue(opacityVal);

                    var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    stroke.property("Color").setValue(strokeColor);
                    stroke.property("Stroke Width").setValue(strokeWidth);
                    stroke.property("Opacity").setValue(opacityVal);

                    wall.parent = master;
                    setTransformVal(wall, "Anchor Point", [0, 0, 0]);
                    setTransformVal(wall, "Position", segPos);
                    setTransformVal(wall, "Orientation", segRot);

                    createdLayers.push(wall);
                }

                // 3. Create Slice Radial Walls (if slice is enabled and not full 360)
                var hasSliceWalls = enableSlice && Math.abs(sweepAngle) < 359.99;
                var sliceStartLayer = null;
                var sliceEndLayer = null;

                if (hasSliceWalls) {
                    // Start Slice Wall
                    var sRad = startAngle * (Math.PI / 180);
                    var sPos = [(radius / 2) * Math.sin(sRad), 0, -(radius / 2) * Math.cos(sRad)];
                    var sRot = [0, 90 - startAngle, 0];

                    sliceStartLayer = parentComp.layers.addShape();
                    sliceStartLayer.name = "Slice_Start";
                    sliceStartLayer.threeDLayer = true;
                    sliceStartLayer.shy = true;

                    var grpS = sliceStartLayer.property("Contents").addProperty("ADBE Vector Group");
                    grpS.name = "Slice Vector";
                    var rectS = grpS.property("Contents").addProperty("ADBE Vector Shape - Rect");
                    rectS.property("Size").setValue([radius, height]);
                    var fillS = grpS.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fillS.property("Color").setValue(wallsColor);
                    fillS.property("Opacity").setValue(opacityVal);
                    var strokeS = grpS.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    strokeS.property("Color").setValue(strokeColor);
                    strokeS.property("Stroke Width").setValue(strokeWidth);
                    strokeS.property("Opacity").setValue(opacityVal);

                    sliceStartLayer.parent = master;
                    setTransformVal(sliceStartLayer, "Anchor Point", [0, 0, 0]);
                    setTransformVal(sliceStartLayer, "Position", sPos);
                    setTransformVal(sliceStartLayer, "Orientation", sRot);

                    createdLayers.push(sliceStartLayer);

                    // End Slice Wall
                    var eRad = endAngle * (Math.PI / 180);
                    var ePos = [(radius / 2) * Math.sin(eRad), 0, -(radius / 2) * Math.cos(eRad)];
                    var eRot = [0, 90 - endAngle, 0];

                    sliceEndLayer = parentComp.layers.addShape();
                    sliceEndLayer.name = "Slice_End";
                    sliceEndLayer.threeDLayer = true;
                    sliceEndLayer.shy = true;

                    var grpE = sliceEndLayer.property("Contents").addProperty("ADBE Vector Group");
                    grpE.name = "Slice Vector";
                    var rectE = grpE.property("Contents").addProperty("ADBE Vector Shape - Rect");
                    rectE.property("Size").setValue([radius, height]);
                    var fillE = grpE.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fillE.property("Color").setValue(wallsColor);
                    fillE.property("Opacity").setValue(opacityVal);
                    var strokeE = grpE.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    strokeE.property("Color").setValue(strokeColor);
                    strokeE.property("Stroke Width").setValue(strokeWidth);
                    strokeE.property("Opacity").setValue(opacityVal);

                    sliceEndLayer.parent = master;
                    setTransformVal(sliceEndLayer, "Anchor Point", [0, 0, 0]);
                    setTransformVal(sliceEndLayer, "Position", ePos);
                    setTransformVal(sliceEndLayer, "Orientation", eRot);

                    createdLayers.push(sliceEndLayer);
                }

                // 4. Create Top and Bottom Caps (using Path generator)
                function createCapLayer(capName, yPos, xRot, capColor) {
                    var cap = parentComp.layers.addShape();
                    cap.name = capName;
                    cap.threeDLayer = true;
                    cap.shy = true;

                    var grp = cap.property("Contents").addProperty("ADBE Vector Group");
                    grp.name = "Cap Vector";

                    var shapeGroup = grp.property("Contents").addProperty("ADBE Vector Shape - Group");
                    var fill = grp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fill.property("Color").setValue(capColor);
                    fill.property("Opacity").setValue(opacityVal);

                    var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    stroke.property("Color").setValue(strokeColor);
                    stroke.property("Stroke Width").setValue(strokeWidth);
                    stroke.property("Opacity").setValue(opacityVal);

                    var pProp = shapeGroup.property("ADBE Vector Shape") || shapeGroup.property("Path") || shapeGroup.property(1);
                    if (pProp) {
                        try {
                            var initCapShape = computeCapShape(radius, segCount, enableSlice, startAngle, endAngle);
                            if (initCapShape) pProp.setValue(initCapShape);
                        } catch (eShape) {}
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

                // 5. Precompose: Controller is Layer 1, followed by walls & caps
                var indices = [master.index];
                for (var ci = 0; ci < createdLayers.length; ci++) {
                    indices.push(createdLayers[ci].index);
                }
                var preComp = parentComp.layers.precompose(indices, precompName, true);

                // Center preMaster inside precomp
                var preCenter = [preComp.width / 2, preComp.height / 2, 0];
                var preMaster = getLayer(preComp, "Cylinder_Master_Controller") || (preComp.layers && preComp.layers[0]);
                if (preMaster) {
                    preMaster.label = 1;
                    preMaster.colorLabel = "#ff3b30";
                    preMaster.notShyable = true;
                    if (preMaster.moveToBeginning) preMaster.moveToBeginning();
                    setTransformVal(preMaster, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preMaster, "Position", preCenter);
                }

                // Target precomp layer in parent composition
                var cylLayer = getLayer(parentComp, precompName) || getLayer(parentComp, 1);
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

                // 6. MASTER CONTROLS ON PARENT COMPOSITION:
                function addMasterProp(type, name, val) {
                    var parade = cylLayer.property("ADBE Effect Parade") || cylLayer.property("Effects");
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    eff.property(1).setValue(val);
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
                    var parade = preMaster.property("ADBE Effect Parade") || preMaster.property("Effects");
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    eff.property(1).setValue(defaultVal);
                    eff.property(1).expression = 'try { comp("' + parentComp.name + '").layer("' + precompName + '").effect("' + effTarget + '")(1).value; } catch (err) { value; }';
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

                // 8. EXPRESSIONS ON WALLS & CAPS:
                var exprWallsColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Walls Color")("Color").value; } catch(e) { value; }';
                var exprTopColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Top Color")("Color").value; } catch(e) { value; }';
                var exprBottomColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Bottom Color")("Color").value; } catch(e) { value; }';
                var exprOpacity = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Opacity")("Slider").value; } catch(e) { value; }';
                var exprStrokeColor = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Stroke Color")("Color").value; } catch(e) { value; }';
                var exprStrokeWidth = 'try { thisComp.layer("Cylinder_Master_Controller").effect("Stroke Width")("Slider").value; } catch(e) { value; }';

                // Expressions on Wall segments
                for (var wi = 0; wi < segCount; wi++) {
                    var wLayer = getLayer(preComp, "Wall_" + (wi + 1));
                    if (wLayer && preMaster) {
                        wLayer.parent = preMaster;

                        var wExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")("Slider").value;\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\n' +
                            'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\n' +
                            'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\n' +
                            'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\n' +
                            'var span = a1 - a0;\n' +
                            'var alpha = (Math.abs(span) / n) * (Math.PI / 180);\n' +
                            'var rMid = r * Math.cos(alpha / 2);\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\n' +
                            'var rad = theta * (Math.PI / 180);\n' +
                            '[rMid * Math.sin(rad), 0, -rMid * Math.cos(rad)];';

                        var wExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\n' +
                            'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\n' +
                            'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\n' +
                            'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\n' +
                            'var span = a1 - a0;\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\n' +
                            '[0, -theta, 0];';

                        var wExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")("Slider").value;\n' +
                            'var h = m.effect("Extrude Distance")("Slider").value;\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\n' +
                            'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\n' +
                            'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\n' +
                            'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\n' +
                            'var alpha = (Math.abs(a1 - a0) / n) * (Math.PI / 180);\n' +
                            'var chord = Math.max(1, 2 * r * Math.sin(alpha / 2));\n' +
                            '[chord, h];';

                        setTransformExpr(wLayer, "Position", wExprPos);
                        setTransformExpr(wLayer, "Orientation", wExprRot);

                        var wGrp = wLayer.property("Contents") ? (wLayer.property("Contents").property("Wall Vector") || wLayer.property("Contents").property(1)) : null;
                        if (wGrp) {
                            var wRect = wGrp.property("Contents").property("ADBE Vector Shape - Rect");
                            if (wRect) wRect.property("Size").expression = wExprSize;
                            var wFill = wGrp.property("Contents").property("ADBE Vector Graphic - Fill");
                            if (wFill) {
                                wFill.property("Color").expression = exprWallsColor;
                                wFill.property("Opacity").expression = exprOpacity;
                            }
                            var wStroke = wGrp.property("Contents").property("ADBE Vector Graphic - Stroke");
                            if (wStroke) {
                                wStroke.property("Color").expression = exprStrokeColor;
                                wStroke.property("Stroke Width").expression = exprStrokeWidth;
                                wStroke.property("Opacity").expression = exprOpacity;
                            }
                        }
                    }
                }

                // Expressions on Slice Start & End walls
                if (sliceStartLayer) {
                    var sLayer = getLayer(preComp, "Slice_Start");
                    if (sLayer && preMaster) {
                        sLayer.parent = preMaster;
                        setTransformVal(sLayer, "Anchor Point", [0, 0, 0]);
                        var sRad = startAngle * (Math.PI / 180);
                        setTransformVal(sLayer, "Position", [(radius / 2) * Math.sin(sRad), 0, -(radius / 2) * Math.cos(sRad)]);
                        setTransformVal(sLayer, "Orientation", [0, 90 - startAngle, 0]);

                        var sExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")("Slider").value;\n' +
                            'var a0 = m.effect("Start Angle")("Slider").value * (Math.PI / 180);\n' +
                            '[(r / 2) * Math.sin(a0), 0, -(r / 2) * Math.cos(a0)];';
                        var sExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var a0 = m.effect("Start Angle")("Slider").value;\n' +
                            '[0, 90 - a0, 0];';
                        var sExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")("Slider").value;\n' +
                            'var h = m.effect("Extrude Distance")("Slider").value;\n' +
                            '[r, h];';

                        setTransformExpr(sLayer, "Position", sExprPos);
                        setTransformExpr(sLayer, "Orientation", sExprRot);
                        var sGrp = sLayer.property("Contents") ? (sLayer.property("Contents").property("Slice Vector") || sLayer.property("Contents").property(1)) : null;
                        if (sGrp) {
                            var sR = sGrp.property("Contents").property("ADBE Vector Shape - Rect");
                            if (sR) sR.property("Size").expression = sExprSize;
                            var sFl = sGrp.property("Contents").property("ADBE Vector Graphic - Fill");
                            if (sFl) { sFl.property("Color").expression = exprWallsColor; sFl.property("Opacity").expression = exprOpacity; }
                            var sSt = sGrp.property("Contents").property("ADBE Vector Graphic - Stroke");
                            if (sSt) { sSt.property("Color").expression = exprStrokeColor; sSt.property("Stroke Width").expression = exprStrokeWidth; sSt.property("Opacity").expression = exprOpacity; }
                        }
                    }
                }

                if (sliceEndLayer) {
                    var eLayer = getLayer(preComp, "Slice_End");
                    if (eLayer && preMaster) {
                        eLayer.parent = preMaster;
                        setTransformVal(eLayer, "Anchor Point", [0, 0, 0]);
                        var eRad = endAngle * (Math.PI / 180);
                        setTransformVal(eLayer, "Position", [(radius / 2) * Math.sin(eRad), 0, -(radius / 2) * Math.cos(eRad)]);
                        setTransformVal(eLayer, "Orientation", [0, 90 - endAngle, 0]);

                        var eExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")("Slider").value;\n' +
                            'var a1 = m.effect("End Angle")("Slider").value * (Math.PI / 180);\n' +
                            '[(r / 2) * Math.sin(a1), 0, -(r / 2) * Math.cos(a1)];';
                        var eExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var a1 = m.effect("End Angle")("Slider").value;\n' +
                            '[0, 90 - a1, 0];';
                        var eExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                            'var r = m.effect("Radius")("Slider").value;\n' +
                            'var h = m.effect("Extrude Distance")("Slider").value;\n' +
                            '[r, h];';

                        setTransformExpr(eLayer, "Position", eExprPos);
                        setTransformExpr(eLayer, "Orientation", eExprRot);
                        var eGrp = eLayer.property("Contents") ? (eLayer.property("Contents").property("Slice Vector") || eLayer.property("Contents").property(1)) : null;
                        if (eGrp) {
                            var eR = eGrp.property("Contents").property("ADBE Vector Shape - Rect");
                            if (eR) eR.property("Size").expression = eExprSize;
                            var eFl = eGrp.property("Contents").property("ADBE Vector Graphic - Fill");
                            if (eFl) { eFl.property("Color").expression = exprWallsColor; eFl.property("Opacity").expression = exprOpacity; }
                            var eSt = eGrp.property("Contents").property("ADBE Vector Graphic - Stroke");
                            if (eSt) { eSt.property("Color").expression = exprStrokeColor; eSt.property("Stroke Width").expression = exprStrokeWidth; eSt.property("Opacity").expression = exprOpacity; }
                        }
                    }
                }

                // Cap Generator Expression (Dynamic Pie Slice or Circle Path)
                var exprCapPath = 'var m = thisComp.layer("Cylinder_Master_Controller");\n' +
                    'var r = Math.max(0.001, m.effect("Radius")("Slider").value);\n' +
                    'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\n' +
                    'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\n' +
                    'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\n' +
                    'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\n' +
                    'var span = a1 - a0;\n' +
                    'var isFull = !slice || Math.abs(span) >= 359.99;\n' +
                    'var verts = [];\n' +
                    'var ins = [];\n' +
                    'var outs = [];\n' +
                    'var Z = [0, 0];\n' +
                    'if (isFull) {\n' +
                    '  for (var j = 0; j < n; j++) {\n' +
                    '    var phi = (j / n) * 2 * Math.PI;\n' +
                    '    verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\n' +
                    '    ins.push(Z); outs.push(Z);\n' +
                    '  }\n' +
                    '} else {\n' +
                    '  verts.push([0, 0]); ins.push(Z); outs.push(Z);\n' +
                    '  for (var j = 0; j <= n; j++) {\n' +
                    '    var phi = (a0 + j * (span / n)) * (Math.PI / 180);\n' +
                    '    verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\n' +
                    '    ins.push(Z); outs.push(Z);\n' +
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
                        'var h = m.effect("Extrude Distance")("Slider").value;\n' +
                        '[0, -h / 2, 0];';
                    setTransformExpr(preCapTop, "Position", exprTopPos);

                    var topGrp = preCapTop.property("Contents") ? (preCapTop.property("Contents").property("Cap Vector") || preCapTop.property("Contents").property(1)) : null;
                    if (topGrp) {
                        var topShape = topGrp.property("Contents").property("ADBE Vector Shape - Group") || topGrp.property("Contents").property(1);
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
                        var topFl = topGrp.property("Contents").property("ADBE Vector Graphic - Fill");
                        if (topFl) { topFl.property("Color").expression = exprTopColor; topFl.property("Opacity").expression = exprOpacity; }
                        var topSt = topGrp.property("Contents").property("ADBE Vector Graphic - Stroke");
                        if (topSt) { topSt.property("Color").expression = exprStrokeColor; topSt.property("Stroke Width").expression = exprStrokeWidth; topSt.property("Opacity").expression = exprOpacity; }
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
                        'var h = m.effect("Extrude Distance")("Slider").value;\n' +
                        '[0, h / 2, 0];';
                    setTransformExpr(preCapBot, "Position", exprBotPos);

                    var botGrp = preCapBot.property("Contents") ? (preCapBot.property("Contents").property("Cap Vector") || preCapBot.property("Contents").property(1)) : null;
                    if (botGrp) {
                        var botShape = botGrp.property("Contents").property("ADBE Vector Shape - Group") || botGrp.property("Contents").property(1);
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
                        var botFl = botGrp.property("Contents").property("ADBE Vector Graphic - Fill");
                        if (botFl) { botFl.property("Color").expression = exprBottomColor; botFl.property("Opacity").expression = exprOpacity; }
                        var botSt = botGrp.property("Contents").property("ADBE Vector Graphic - Stroke");
                        if (botSt) { botSt.property("Color").expression = exprStrokeColor; botSt.property("Stroke Width").expression = exprStrokeWidth; botSt.property("Opacity").expression = exprOpacity; }
                    }
                }

                cylLayer.selected = true;
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

            // 1. Update Master Effect Controls on the parent comp's cylinder_maker layer
            var cylLayer = getLayer(parentComp, currentPrecompName) || getLayer(parentComp, 1);
            if (cylLayer) {
                var effR = cylLayer.effect("Radius"); if (effR) effR.property("Slider").setValue(radius);
                var effH = cylLayer.effect("Extrude Distance"); if (effH) effH.property("Slider").setValue(height);
                var effSeg = cylLayer.effect("Rotation Segments"); if (effSeg) effSeg.property("Slider").setValue(segCount);
                var effSl = cylLayer.effect("Enable Slice"); if (effSl) effSl.property("Checkbox").setValue(enableSlice ? 1 : 0);
                var effS0 = cylLayer.effect("Start Angle"); if (effS0) effS0.property("Slider").setValue(startAngle);
                var effS1 = cylLayer.effect("End Angle"); if (effS1) effS1.property("Slider").setValue(endAngle);
                var effTC = cylLayer.effect("Top Color"); if (effTC) effTC.property("Color").setValue(topColor);
                var effWC = cylLayer.effect("Walls Color"); if (effWC) effWC.property("Color").setValue(wallsColor);
                var effBC = cylLayer.effect("Bottom Color"); if (effBC) effBC.property("Color").setValue(bottomColor);
                var effOp = cylLayer.effect("Opacity"); if (effOp) effOp.property("Slider").setValue(opacityVal);
                var effStC = cylLayer.effect("Stroke Color"); if (effStC) effStC.property("Color").setValue(strokeColor);
                var effSW = cylLayer.effect("Stroke Width"); if (effSW) effSW.property("Slider").setValue(strokeWidth);
            }

            var targetComp = preComp || parentComp;
            var master = getLayer(targetComp, "Cylinder_Master_Controller");
            if (master) {
                var effR = master.effect("Radius"); if (effR) effR.property("Slider").setValue(radius);
                var effH = master.effect("Extrude Distance"); if (effH) effH.property("Slider").setValue(height);
                var effSeg = master.effect("Rotation Segments"); if (effSeg) effSeg.property("Slider").setValue(segCount);
                var effSl = master.effect("Enable Slice"); if (effSl) effSl.property("Checkbox").setValue(enableSlice ? 1 : 0);
                var effS0 = master.effect("Start Angle"); if (effS0) effS0.property("Slider").setValue(startAngle);
                var effS1 = master.effect("End Angle"); if (effS1) effS1.property("Slider").setValue(endAngle);
                var effTC = master.effect("Top Color"); if (effTC) effTC.property("Color").setValue(topColor);
                var effWC = master.effect("Walls Color"); if (effWC) effWC.property("Color").setValue(wallsColor);
                var effBC = master.effect("Bottom Color"); if (effBC) effBC.property("Color").setValue(bottomColor);
                var effOp = master.effect("Opacity"); if (effOp) effOp.property("Slider").setValue(opacityVal);
                var effStC = master.effect("Stroke Color"); if (effStC) effStC.property("Color").setValue(strokeColor);
                var effSW = master.effect("Stroke Width"); if (effSW) effSW.property("Slider").setValue(strokeWidth);
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
