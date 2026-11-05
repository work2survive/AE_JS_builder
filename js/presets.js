/**
 * presets.js
 * Predefined JSX scripts for After Effects testing and ScriptUI panels
 */

(function(global) {
    'use strict';

    const PRESETS = {
        cubeMaker: {
            name: "★ Cube Maker (X,Y,Z, Link to Z, Colors & Stroke)",
            code: `// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: CUBE MAKER
// =============================================================================
//
// PURPOSE:
//   An interactive ScriptUI panel for After Effects that creates and controls
//   a parametric 3D Cube built out of 6 native Shape Layers parented to a
//   master 3D controller layer.
//
// ARCHITECTURE & WORKFLOW:
//   1. ScriptUI UI Window / Dockable Panel (2 Distinct Tabs):
//      - [1] Geometry Tab:
//        * Dimensions controls (X, Y, Z scrubbable sliders & numeric text fields).
//        * "Link all sizes to Z" checkbox (drives an AE Checkbox Control effect).
//        * 3D topology structure and Build / Rebuild button.
//      - [2] Appearance Tab:
//        * Live color pickers for faces (Fill) and edges (Stroke).
//        * Stroke width slider and numeric input.
//        * Corner roundness slider and numeric input.
//        * Gap slider (edge inset) and numeric input.
//
//   2. Color-Coding System:
//      - BLUE: Animatable properties in the AE Timeline (can be keyframed or animated).
//      - RED: Structural / setup properties defined only once upon layer creation.
//
//   3. 3D Spatial Geometry:
//      - 6 rectangular Shape Layers oriented in 3D Euclidean space:
//        Front, Back, Left, Right, Top, Bottom.
//      - Parented to a single "Cube_Master_Controller" layer so the whole cube
//        moves, rotates, and scales as a single rigid body.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript engine).
//   - Works both as a dockable panel (in ScriptUI Panels folder) and as a floating palette.
// =============================================================================

(function(thisObj) {
    "use strict";

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    // In After Effects:
    // - If placed inside "Scripts/ScriptUI Panels", After Effects passes a Panel
    //   instance into thisObj, making the panel dockable alongside native panels.
    // - If launched from "File > Scripts > Run Script File", thisObj is the global
    //   scope, so we create a floating "palette" Window.
    var win = (thisObj instanceof Panel) 
        ? thisObj 
        : new Window("palette", "Cube Maker 3D - v1.2", undefined, { resizeable: true });
    win.text = "Cube Maker 3D - v1.2";

    // Track active precomp name across sessions / live slider updates
    var currentPrecompName = "";

    // Set top-level layout properties
    win.orientation = "column";          // Stack child controls vertically
    win.alignChildren = ["fill", "top"]; // Stretch children horizontally to fill width
    win.spacing = 10;                    // 10px vertical gap between panel sections
    win.margins = 14;                    // 14px outer margin padding around the window

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
            ((num >> 16) & 255) / 255, // Red channel   (0.0 to 1.0)
            ((num >> 8) & 255) / 255,  // Green channel (0.0 to 1.0)
            (num & 255) / 255          // Blue channel  (0.0 to 1.0)
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

    // -------------------------------------------------------------------------
    // 3. UI Section: Add-on Name, Version & Description Header
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Cube Maker 3D - v1.2");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "Parametric 3D Shape Layer Cube generator and live controller rig.");

    // -------------------------------------------------------------------------
    // 4. UI Section: Tabbed Panel Container (Geometry vs. Appearance)
    // -------------------------------------------------------------------------
    var tpanel = win.add("tabbedpanel", undefined, undefined);
    tpanel.alignChildren = ["fill", "top"];
    tpanel.alignment = ["fill", "fill"];

    // =========================================================================
    // TAB 1: GEOMETRY & TOPOLOGY
    // =========================================================================
    var tabGeometry = tpanel.add("tab", undefined, "Geometry");
    tabGeometry.orientation = "column";
    tabGeometry.alignChildren = ["fill", "top"];
    tabGeometry.alignment = ["fill", "fill"];
    tabGeometry.spacing = 8;
    tabGeometry.margins = 8;

    // --- Sub-panel: Dimensions (X, Y, Z Size) ---
    var pnlDim = tabGeometry.add("panel", undefined, "Dimensions (X, Y, Z)");
    pnlDim.orientation = "column";
    pnlDim.spacing = 8;
    pnlDim.alignChildren = ["fill", "top"];
    pnlDim.alignment = ["fill", "top"];

    // --- Dimension X Row ---
    var grpX = pnlDim.add("group");
    grpX.orientation = "row";
    grpX.alignment = ["fill", "top"];
    var lblX = grpX.add("statictext", undefined, "Size X:");
    lblX.preferredSize = [80, -1];
    var sldX = grpX.add("slider", undefined, 200, { minvalue: 50, maxvalue: 500 });
    sldX.alignment = ["fill", "center"];
    var txtX = grpX.add("edittext", undefined, "200");
    txtX.characters = 4;

    // --- Dimension Y Row ---
    var grpY = pnlDim.add("group");
    grpY.orientation = "row";
    grpY.alignment = ["fill", "top"];
    var lblY = grpY.add("statictext", undefined, "Size Y:");
    lblY.preferredSize = [80, -1];
    var sldY = grpY.add("slider", undefined, 200, { minvalue: 50, maxvalue: 500 });
    sldY.alignment = ["fill", "center"];
    var txtY = grpY.add("edittext", undefined, "200");
    txtY.characters = 4;

    // --- Dimension Z Row ---
    var grpZ = pnlDim.add("group");
    grpZ.orientation = "row";
    grpZ.alignment = ["fill", "top"];
    var lblZ = grpZ.add("statictext", undefined, "Size Z:");
    lblZ.preferredSize = [80, -1];
    var sldZ = grpZ.add("slider", undefined, 200, { minvalue: 50, maxvalue: 500 });
    sldZ.alignment = ["fill", "center"];
    var txtZ = grpZ.add("edittext", undefined, "200");
    txtZ.characters = 4;

    // --- Checkbox: Link all sizes to Z ---
    var chkLinkZ = pnlDim.add("checkbox", undefined, "Link all sizes to Z");
    chkLinkZ.value = false;

    // -------------------------------------------------------------------------
    // 5. Two-Way Slider & EditText Synchronization Logic
    // -------------------------------------------------------------------------
    function syncDimension(source) {
        if (chkLinkZ.value) {
            var valZ = (source === "txtZ") 
                ? (parseFloat(txtZ.text) || 200) 
                : Math.round(sldZ.value);
            
            sldX.value = valZ;
            sldY.value = valZ;
            sldZ.value = valZ;
            txtX.text = String(valZ);
            txtY.text = String(valZ);
            txtZ.text = String(valZ);
        } else {
            if (source === "sldX") txtX.text = String(Math.round(sldX.value));
            if (source === "sldY") txtY.text = String(Math.round(sldY.value));
            if (source === "sldZ") txtZ.text = String(Math.round(sldZ.value));

            if (source === "txtX") sldX.value = Math.max(10, parseFloat(txtX.text) || 200);
            if (source === "txtY") sldY.value = Math.max(10, parseFloat(txtY.text) || 200);
            if (source === "txtZ") sldZ.value = Math.max(10, parseFloat(txtZ.text) || 200);
        }

        buildOrUpdateCube();
    }

    sldX.onChanging = function() { syncDimension("sldX"); };
    sldY.onChanging = function() { syncDimension("sldY"); };
    sldZ.onChanging = function() { syncDimension("sldZ"); };

    txtX.onChange = function() { syncDimension("txtX"); };
    txtY.onChange = function() { syncDimension("txtY"); };
    txtZ.onChange = function() { syncDimension("txtZ"); };

    chkLinkZ.onClick = function() {
        if (chkLinkZ.value) {
            syncDimension("sldZ");
        }
        var parentComp = app.project ? app.project.activeItem : null;
        var master = getLayer(parentComp, "Cube_Master_Controller");
        if (master) {
            var linkEff = master.effect("Link all sizes to Z");
            if (linkEff) {
                linkEff.property("Checkbox").setValue(chkLinkZ.value ? 1 : 0);
            }
        }
    };

    // --- Sub-panel: Structure & Topology - [Defined Once on Creation] ---
    var pnlStruct = tabGeometry.add("panel", undefined, "3D Cube Structure & Topology - [Defined Once]");
    pnlStruct.orientation = "column";
    pnlStruct.spacing = 8;
    pnlStruct.alignChildren = ["fill", "top"];
    pnlStruct.alignment = ["fill", "top"];

    pnlStruct.add("statictext", undefined, "Topology: 6 Faces parented to Controller (Defined Once)");

    var btnBuild = pnlStruct.add("button", undefined, "Build / Rebuild 3D Structure");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.onClick = function() {
        buildOrUpdateCube(true); // Pass true to force structural recreation
    };

    // =========================================================================
    // TAB 2: APPEARANCE & STYLING
    // =========================================================================
    var tabAppearance = tpanel.add("tab", undefined, "Appearance");
    tabAppearance.orientation = "column";
    tabAppearance.alignChildren = ["fill", "top"];
    tabAppearance.alignment = ["fill", "fill"];
    tabAppearance.spacing = 8;
    tabAppearance.margins = 8;

    // -------------------------------------------------------------------------
    // 6. UI Section: Colors & Stroke Styling - [Animatable]
    // -------------------------------------------------------------------------
    var pnlStyle = tabAppearance.add("panel", undefined, "Colors & Stroke - [Animatable]");
    pnlStyle.orientation = "column";
    pnlStyle.spacing = 10;
    pnlStyle.alignChildren = ["fill", "top"];
    pnlStyle.alignment = ["fill", "top"];

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
        txtHex.helpTip = "Direct hex color input (e.g. #2288EE)";

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
            var val = txtHex.text.replace(/^\\s+|\\s+$/g, "");
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

    // --- Face (Sides) Fill Color ---
    var grpFill = pnlStyle.add("group");
    grpFill.orientation = "row";
    grpFill.alignment = ["fill", "top"];
    var lblFill = grpFill.add("statictext", undefined, "Sides Color:");
    lblFill.preferredSize = [115, -1];
    var cpSides = createColorPicker(grpFill, "#2288ee");
    cpSides.onChange = function() {
        buildOrUpdateCube();
    };

    // --- Face (Sides) Opacity Slider ---
    var grpSidesOp = pnlStyle.add("group");
    grpSidesOp.orientation = "row";
    grpSidesOp.alignment = ["fill", "top"];
    var lblSidesOp = grpSidesOp.add("statictext", undefined, "Sides Opacity:");
    lblSidesOp.preferredSize = [115, -1];
    var sldSidesOp = grpSidesOp.add("slider", undefined, 85, { minvalue: 0, maxvalue: 100 });
    sldSidesOp.alignment = ["fill", "center"];
    var txtSidesOp = grpSidesOp.add("edittext", undefined, "85");
    txtSidesOp.characters = 3;

    sldSidesOp.onChanging = function() {
        txtSidesOp.text = String(Math.round(sldSidesOp.value));
        buildOrUpdateCube();
    };
    txtSidesOp.onChange = function() {
        sldSidesOp.value = Math.max(0, Math.min(100, parseFloat(txtSidesOp.text) || 0));
        buildOrUpdateCube();
    };

    // --- Edge Stroke Color ---
    var grpStroke = pnlStyle.add("group");
    grpStroke.orientation = "row";
    grpStroke.alignment = ["fill", "top"];
    var lblStroke = grpStroke.add("statictext", undefined, "Stroke Color:");
    lblStroke.preferredSize = [115, -1];
    var cpStroke = createColorPicker(grpStroke, "#ffffff");
    cpStroke.onChange = function() {
        buildOrUpdateCube();
    };

    // --- Edge Stroke Opacity Slider ---
    var grpStrokeOp = pnlStyle.add("group");
    grpStrokeOp.orientation = "row";
    grpStrokeOp.alignment = ["fill", "top"];
    var lblStrokeOp = grpStrokeOp.add("statictext", undefined, "Stroke Opacity:");
    lblStrokeOp.preferredSize = [115, -1];
    var sldStrokeOp = grpStrokeOp.add("slider", undefined, 100, { minvalue: 0, maxvalue: 100 });
    sldStrokeOp.alignment = ["fill", "center"];
    var txtStrokeOp = grpStrokeOp.add("edittext", undefined, "100");
    txtStrokeOp.characters = 3;

    sldStrokeOp.onChanging = function() {
        txtStrokeOp.text = String(Math.round(sldStrokeOp.value));
        buildOrUpdateCube();
    };
    txtStrokeOp.onChange = function() {
        sldStrokeOp.value = Math.max(0, Math.min(100, parseFloat(txtStrokeOp.text) || 0));
        buildOrUpdateCube();
    };

    // --- Stroke Thickness Slider ---
    var grpThick = pnlStyle.add("group");
    grpThick.orientation = "row";
    grpThick.alignment = ["fill", "top"];
    var lblThick = grpThick.add("statictext", undefined, "Stroke Width:");
    lblThick.preferredSize = [115, -1];
    var sldThick = grpThick.add("slider", undefined, 3, { minvalue: 1, maxvalue: 20 });
    sldThick.alignment = ["fill", "center"];
    var txtThick = grpThick.add("edittext", undefined, "3");
    txtThick.characters = 3;

    sldThick.onChanging = function() {
        txtThick.text = String(Math.round(sldThick.value));
        buildOrUpdateCube();
    };
    txtThick.onChange = function() {
        sldThick.value = Math.max(0, parseFloat(txtThick.text) || 1);
        buildOrUpdateCube();
    };

    // --- Corner Roundness Slider ---
    var grpRound = pnlStyle.add("group");
    grpRound.orientation = "row";
    grpRound.alignment = ["fill", "top"];
    var lblRound = grpRound.add("statictext", undefined, "Corner Roundness:");
    lblRound.preferredSize = [115, -1];
    var sldRound = grpRound.add("slider", undefined, 10, { minvalue: 0, maxvalue: 80 });
    sldRound.alignment = ["fill", "center"];
    var txtRound = grpRound.add("edittext", undefined, "10");
    txtRound.characters = 3;

    sldRound.onChanging = function() {
        txtRound.text = String(Math.round(sldRound.value));
        buildOrUpdateCube();
    };
    txtRound.onChange = function() {
        sldRound.value = Math.max(0, parseFloat(txtRound.text) || 0);
        buildOrUpdateCube();
    };

    // --- Face Edge Gap Slider (Inset removed from all sides x2) ---
    var grpGap = pnlStyle.add("group");
    grpGap.orientation = "row";
    grpGap.alignment = ["fill", "top"];
    var lblGap = grpGap.add("statictext", undefined, "Gap:");
    lblGap.preferredSize = [115, -1];
    var sldGap = grpGap.add("slider", undefined, 0, { minvalue: 0, maxvalue: 40 });
    sldGap.alignment = ["fill", "center"];
    var txtGap = grpGap.add("edittext", undefined, "0");
    txtGap.characters = 3;

    sldGap.onChanging = function() {
        txtGap.text = String(Math.round(sldGap.value));
        buildOrUpdateCube();
    };
    txtGap.onChange = function() {
        sldGap.value = Math.max(0, parseFloat(txtGap.text) || 0);
        buildOrUpdateCube();
    };

    // Set initial active tab (index 0: Geometry)
    tpanel.selection = 0;

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
    // 7. Core Engine: Build or Live-Update the 3D Cube in After Effects
    // -------------------------------------------------------------------------
    function buildOrUpdateCube(forceRebuild) {
        var parentComp = app.project ? app.project.activeItem : null;
        if (!parentComp || !(parentComp instanceof CompItem)) {
            if (forceRebuild) {
                alert("Please select or open an active composition first.");
            }
            return;
        }

        // Only build or update if forceRebuild (Build button pressed) or if a cube precomp already exists
        if (!forceRebuild && !currentPrecompName) {
            return;
        }

        // Read current parameters from UI inputs
        var sizeX = parseFloat(txtX.text) || 200;
        var sizeY = parseFloat(txtY.text) || 200;
        var sizeZ = parseFloat(txtZ.text) || 200;

        // Apply linkage to Z if active
        if (chkLinkZ.value) {
            sizeX = sizeZ;
            sizeY = sizeZ;
        }

        var halfX = sizeX / 2;
        var halfY = sizeY / 2;
        var halfZ = sizeZ / 2;
        var center = [parentComp.width / 2, parentComp.height / 2, 0];

        // Parse colors from hex to AE float arrays
        var fillColor = hexToRgb(cpSides.value);
        var strokeColor = hexToRgb(cpStroke.value);
        var strokeWidth = parseFloat(txtThick.text) || 3;
        var roundness = parseFloat(txtRound.text) || 0;
        var gap = parseFloat(txtGap.text) || 0;
        var sidesOpacity = Math.max(0, Math.min(100, parseFloat(txtSidesOp.text) || 85));
        var strokeOpacity = Math.max(0, Math.min(100, parseFloat(txtStrokeOp.text) || 100));
        var linkToZ = chkLinkZ.value;

        // ---------------------------------------------------------------------
        // Case A: Structural Build / Rebuild (Precomposition Workflow)
        // ---------------------------------------------------------------------
        if (forceRebuild) {
            if (app.beginUndoGroup) {
                app.beginUndoGroup("Build Cube Precomp");
            }

            try {
                // Generate random 4-digit number: 1000 - 9999
                var randNum = Math.floor(1000 + Math.random() * 9000);
                var precompName = "cube_maker_" + randNum;
                currentPrecompName = precompName;

                // Clean up previous cube_maker layers from parent composition
                for (var p = parentComp.layers.length; p >= 1; p--) {
                    var oldL = getLayer(parentComp, p);
                    if (oldL && oldL.name && (oldL.name === "Cube_Master_Controller" || oldL.name.indexOf("cube_maker_") === 0 || oldL.name.indexOf("Face_") === 0)) {
                        removeLayer(parentComp, oldL);
                    }
                }

                // 1. Create Master Controller Layer FIRST at comp center
                var master = parentComp.layers.addShape();
                master.name = "Cube_Master_Controller";
                master.threeDLayer = true;
                master.shy = false;
                master.notShyable = true;
                master.label = 1;               // RED label in After Effects (Label 1 = Red)
                master.colorLabel = "#ff3b30";  // RED label in emulator
                setTransformVal(master, "Anchor Point", [0, 0, 0]);
                setTransformVal(master, "Position", center);

                // Ensure controller layer is ALWAYS on top (Layer 1)
                if (master.moveToBeginning) {
                    master.moveToBeginning();
                }

                // 2. Spatial Configurations for the 6 Cube Faces
                var faceConfigs = [
                    { name: "Front",  pos: [0, 0, -halfZ], rot: [0, 0, 0],   w: sizeX, h: sizeY },
                    { name: "Back",   pos: [0, 0, halfZ],  rot: [0, 180, 0], w: sizeX, h: sizeY },
                    { name: "Left",   pos: [-halfX, 0, 0], rot: [0, -90, 0], w: sizeZ, h: sizeY },
                    { name: "Right",  pos: [halfX, 0, 0],  rot: [0, 90, 0],  w: sizeZ, h: sizeY },
                    { name: "Top",    pos: [0, -halfY, 0], rot: [90, 0, 0],  w: sizeX, h: sizeZ },
                    { name: "Bottom", pos: [0, halfY, 0],  rot: [-90, 0, 0], w: sizeX, h: sizeZ }
                ];

                var faceLayers = [];
                for (var i = 0; i < faceConfigs.length; i++) {
                    var cfg = faceConfigs[i];
                    var face = parentComp.layers.addShape();
                    face.name = "Face_" + cfg.name;
                    face.threeDLayer = true;
                    face.shy = true;

                    var grp = face.property("Contents").addProperty("ADBE Vector Group");
                    grp.name = "Face Vector";

                    var rw = Math.max(1, cfg.w - gap * 2);
                    var rh = Math.max(1, cfg.h - gap * 2);
                    var rect = grp.property("Contents").addProperty("ADBE Vector Shape - Rect");
                    rect.property("Size").setValue([rw, rh]);
                    rect.property("Roundness").setValue(roundness);

                    var fill = grp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                    fill.property("Color").setValue(fillColor);
                    fill.property("Opacity").setValue(sidesOpacity);

                    var stroke = grp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
                    stroke.property("Color").setValue(strokeColor);
                    stroke.property("Stroke Width").setValue(strokeWidth);
                    stroke.property("Opacity").setValue(strokeOpacity);

                    // Parent to Master FIRST so position is relative to Master Controller center
                    face.parent = master;
                    setTransformVal(face, "Anchor Point", [0, 0, 0]);
                    setTransformVal(face, "Position", cfg.pos);
                    setTransformVal(face, "Orientation", cfg.rot);

                    faceLayers.push(face);
                }

                // 3. Precompose: Deduplicate and sort indices ascending (required by AE ExtendScript)
                var indicesMap = {};
                if (master && master.index) indicesMap[master.index] = true;
                for (var fi = 0; fi < faceLayers.length; fi++) {
                    if (faceLayers[fi] && faceLayers[fi].index) indicesMap[faceLayers[fi].index] = true;
                }
                var indices = [];
                for (var kIdx in indicesMap) {
                    if (indicesMap.hasOwnProperty(kIdx)) indices.push(parseInt(kIdx, 10));
                }
                indices.sort(function(a, b) { return a - b; });
                var preComp = parentComp.layers.precompose(indices, precompName, true);

                // Ensure controller inside precomp is on top, red, and precisely in the CENTER of the precomp
                var preCenter = [preComp.width / 2, preComp.height / 2, 0];
                var preMaster = getLayer(preComp, "Cube_Master_Controller") || (preComp.layers && preComp.layers[0]);
                if (preMaster) {
                    preMaster.label = 1;
                    preMaster.colorLabel = "#ff3b30";
                    preMaster.notShyable = true;
                    if (preMaster.moveToBeginning) {
                        preMaster.moveToBeginning();
                    }
                    // Explicitly center master controller in the precomp coordinates
                    setTransformVal(preMaster, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preMaster, "Position", preCenter);
                }

                // 4. In parent composition: target the resulting cube_maker layer
                var cubeLayer = getLayer(parentComp, precompName) || getLayer(parentComp, 1);
                cubeLayer.name = precompName;
                cubeLayer.threeDLayer = true;
                if ("collapseTransformation" in cubeLayer) {
                    cubeLayer.collapseTransformation = true; // Continuous 3D rasterization in AE
                }
                cubeLayer.label = 1;              // RED color in After Effects
                cubeLayer.colorLabel = "#ff3b30"; // RED color in emulator
                cubeLayer.notShyable = true;

                // Center the precomp layer in parent composition
                setTransformVal(cubeLayer, "Anchor Point", preCenter);
                setTransformVal(cubeLayer, "Position", center);

                // Ensure cube_maker layer is on top in parent comp
                if (cubeLayer.moveToBeginning) {
                    cubeLayer.moveToBeginning();
                }

                // 5. MASTER CONTROLS ON PARENT COMPOSITION:
                // Create user-facing Effect Controls on cubeLayer in the parent composition.
                // Modifying these parameters directly alters the cube inside the precomp.
                function addMasterProp(type, name, val) {
                    var parade = cubeLayer.property("ADBE Effect Parade") || cubeLayer.property("Effects");
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    eff.property(1).setValue(val);
                    return eff;
                }

                addMasterProp("ADBE Slider Control", "Size X", sizeX);
                addMasterProp("ADBE Slider Control", "Size Y", sizeY);
                addMasterProp("ADBE Slider Control", "Size Z", sizeZ);
                addMasterProp("ADBE Checkbox Control", "Link all sizes to Z", linkToZ ? 1 : 0);
                addMasterProp("ADBE Color Control", "Sides Color", fillColor);
                addMasterProp("ADBE Slider Control", "Sides Opacity", sidesOpacity);
                addMasterProp("ADBE Color Control", "Stroke Color", strokeColor);
                addMasterProp("ADBE Slider Control", "Stroke Opacity", strokeOpacity);
                addMasterProp("ADBE Slider Control", "Stroke Width", strokeWidth);
                addMasterProp("ADBE Slider Control", "Corner Roundness", roundness);
                addMasterProp("ADBE Slider Control", "Gap", gap);

                // 6. PRECOMP CONTROLLER LINKED EXPRESSIONS:
                // Add matching effects on preMaster inside precomp, driven by expressions linked OUT to parent comp!
                function addPrecompLinkedEffect(type, name, effTarget, defaultVal) {
                    var parade = preMaster.property("ADBE Effect Parade") || preMaster.property("Effects");
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    eff.property(1).setValue(defaultVal);
                    eff.property(1).expression = 'try { comp("' + parentComp.name + '").layer("' + precompName + '").effect("' + effTarget + '")(1).value; } catch (err) { value; }';
                    return eff;
                }

                if (preMaster) {
                    addPrecompLinkedEffect("ADBE Slider Control", "Size X", "Size X", sizeX);
                    addPrecompLinkedEffect("ADBE Slider Control", "Size Y", "Size Y", sizeY);
                    addPrecompLinkedEffect("ADBE Slider Control", "Size Z", "Size Z", sizeZ);
                    addPrecompLinkedEffect("ADBE Checkbox Control", "Link all sizes to Z", "Link all sizes to Z", linkToZ ? 1 : 0);
                    addPrecompLinkedEffect("ADBE Color Control", "Sides Color", "Sides Color", fillColor);
                    addPrecompLinkedEffect("ADBE Slider Control", "Sides Opacity", "Sides Opacity", sidesOpacity);
                    addPrecompLinkedEffect("ADBE Color Control", "Stroke Color", "Stroke Color", strokeColor);
                    addPrecompLinkedEffect("ADBE Slider Control", "Stroke Opacity", "Stroke Opacity", strokeOpacity);
                    addPrecompLinkedEffect("ADBE Slider Control", "Stroke Width", "Stroke Width", strokeWidth);
                    addPrecompLinkedEffect("ADBE Slider Control", "Corner Roundness", "Corner Roundness", roundness);
                    addPrecompLinkedEffect("ADBE Slider Control", "Gap", "Gap", gap);
                }

                // 7. EXPRESSIONS ON CUBE FACES:
                // Faces inside precomp dynamically evaluate their 3D position, rectangle size,
                // corner roundness, fill, and stroke from the controller effects.
                var exprSidesColor = 'try { thisComp.layer("Cube_Master_Controller").effect("Sides Color")("Color").value; } catch (e) { value; }';
                var exprSidesOpacity = 'try { thisComp.layer("Cube_Master_Controller").effect("Sides Opacity")("Slider").value; } catch (e) { value; }';
                var exprStrokeColor = 'try { thisComp.layer("Cube_Master_Controller").effect("Stroke Color")("Color").value; } catch (e) { value; }';
                var exprStrokeOpacity = 'try { thisComp.layer("Cube_Master_Controller").effect("Stroke Opacity")("Slider").value; } catch (e) { value; }';
                var exprStrokeWidth = 'try { thisComp.layer("Cube_Master_Controller").effect("Stroke Width")("Slider").value; } catch (e) { value; }';
                var exprRoundness = 'try { thisComp.layer("Cube_Master_Controller").effect("Corner Roundness")("Slider").value; } catch (e) { value; }';

                var faceExprs = {
                    "Front": {
                        pos: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sz = m.effect("Size Z")("Slider").value; [0, 0, -sz / 2];',
                        size: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sx = link ? m.effect("Size Z")("Slider").value : m.effect("Size X")("Slider").value; var sy = link ? m.effect("Size Z")("Slider").value : m.effect("Size Y")("Slider").value; var gap = m.effect("Gap")("Slider").value; [Math.max(1, sx - gap * 2), Math.max(1, sy - gap * 2)];'
                    },
                    "Back": {
                        pos: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sz = m.effect("Size Z")("Slider").value; [0, 0, sz / 2];',
                        size: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sx = link ? m.effect("Size Z")("Slider").value : m.effect("Size X")("Slider").value; var sy = link ? m.effect("Size Z")("Slider").value : m.effect("Size Y")("Slider").value; var gap = m.effect("Gap")("Slider").value; [Math.max(1, sx - gap * 2), Math.max(1, sy - gap * 2)];'
                    },
                    "Left": {
                        pos: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sx = link ? m.effect("Size Z")("Slider").value : m.effect("Size X")("Slider").value; [-sx / 2, 0, 0];',
                        size: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sz = m.effect("Size Z")("Slider").value; var sy = link ? sz : m.effect("Size Y")("Slider").value; var gap = m.effect("Gap")("Slider").value; [Math.max(1, sz - gap * 2), Math.max(1, sy - gap * 2)];'
                    },
                    "Right": {
                        pos: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sx = link ? m.effect("Size Z")("Slider").value : m.effect("Size X")("Slider").value; [sx / 2, 0, 0];',
                        size: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sz = m.effect("Size Z")("Slider").value; var sy = link ? sz : m.effect("Size Y")("Slider").value; var gap = m.effect("Gap")("Slider").value; [Math.max(1, sz - gap * 2), Math.max(1, sy - gap * 2)];'
                    },
                    "Top": {
                        pos: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sy = link ? m.effect("Size Z")("Slider").value : m.effect("Size Y")("Slider").value; [0, -sy / 2, 0];',
                        size: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sx = link ? m.effect("Size Z")("Slider").value : m.effect("Size X")("Slider").value; var sz = m.effect("Size Z")("Slider").value; var gap = m.effect("Gap")("Slider").value; [Math.max(1, sx - gap * 2), Math.max(1, sz - gap * 2)];'
                    },
                    "Bottom": {
                        pos: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sy = link ? m.effect("Size Z")("Slider").value : m.effect("Size Y")("Slider").value; [0, sy / 2, 0];',
                        size: 'var m = thisComp.layer("Cube_Master_Controller"); var link = m.effect("Link all sizes to Z")("Checkbox").value > 0; var sx = link ? m.effect("Size Z")("Slider").value : m.effect("Size X")("Slider").value; var sz = m.effect("Size Z")("Slider").value; var gap = m.effect("Gap")("Slider").value; [Math.max(1, sx - gap * 2), Math.max(1, sz - gap * 2)];'
                    }
                };

                for (var fIdx = 0; fIdx < faceConfigs.length; fIdx++) {
                    var fCfg = faceConfigs[fIdx];
                    var fLayer = getLayer(preComp, "Face_" + fCfg.name);
                    if (fLayer && preMaster) {
                        fLayer.parent = preMaster;
                        setTransformVal(fLayer, "Anchor Point", [0, 0, 0]);
                        setTransformVal(fLayer, "Position", fCfg.pos);
                        setTransformVal(fLayer, "Orientation", fCfg.rot);

                        var fGrp = fLayer.property("Contents") ? (fLayer.property("Contents").property("Face Vector") || fLayer.property("Contents").property(1)) : null;
                        if (fGrp) {
                            var fRect = fGrp.property("Contents").property("ADBE Vector Shape - Rect");
                            if (fRect) {
                                fRect.property("Roundness").expression = exprRoundness;
                                if (faceExprs[fCfg.name]) {
                                    fRect.property("Size").expression = faceExprs[fCfg.name].size;
                                }
                            }
                            var fFill = fGrp.property("Contents").property("ADBE Vector Graphic - Fill");
                            if (fFill) {
                                fFill.property("Color").expression = exprSidesColor;
                                fFill.property("Opacity").expression = exprSidesOpacity;
                            }
                            var fStroke = fGrp.property("Contents").property("ADBE Vector Graphic - Stroke");
                            if (fStroke) {
                                fStroke.property("Color").expression = exprStrokeColor;
                                fStroke.property("Stroke Width").expression = exprStrokeWidth;
                                fStroke.property("Opacity").expression = exprStrokeOpacity;
                            }
                        }

                        if (faceExprs[fCfg.name]) {
                            setTransformExpr(fLayer, "Position", faceExprs[fCfg.name].pos);
                        }
                    }
                }

                cubeLayer.selected = true;

                $.writeln("Cube Maker: Successfully created 3D cube with master parent controls on [" + precompName + "] linked to precomp.");
            } catch (err) {
                alert("Cube Maker Error: " + err.toString());
            } finally {
                if (app.endUndoGroup) {
                    app.endUndoGroup();
                }
            }
        }
        // ---------------------------------------------------------------------
        // Case B: Live Property Update on Existing Layers inside Precomp
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

            // 1. Update Master Effect Controls on the parent comp's cube_maker layer
            var cubeLayer = getLayer(parentComp, currentPrecompName) || getLayer(parentComp, 1);
            if (cubeLayer) {
                var effSX = cubeLayer.effect("Size X"); if (effSX) effSX.property("Slider").setValue(sizeX);
                var effSY = cubeLayer.effect("Size Y"); if (effSY) effSY.property("Slider").setValue(sizeY);
                var effSZ = cubeLayer.effect("Size Z"); if (effSZ) effSZ.property("Slider").setValue(sizeZ);
                var linkEff = cubeLayer.effect("Link all sizes to Z"); if (linkEff) linkEff.property("Checkbox").setValue(linkToZ ? 1 : 0);
                var effSC = cubeLayer.effect("Sides Color"); if (effSC) effSC.property("Color").setValue(fillColor);
                var effSOp = cubeLayer.effect("Sides Opacity"); if (effSOp) effSOp.property("Slider").setValue(sidesOpacity);
                var effStC = cubeLayer.effect("Stroke Color"); if (effStC) effStC.property("Color").setValue(strokeColor);
                var effStOp = cubeLayer.effect("Stroke Opacity"); if (effStOp) effStOp.property("Slider").setValue(strokeOpacity);
                var effSW = cubeLayer.effect("Stroke Width"); if (effSW) effSW.property("Slider").setValue(strokeWidth);
                var effR = cubeLayer.effect("Corner Roundness"); if (effR) effR.property("Slider").setValue(roundness);
                var effG = cubeLayer.effect("Gap"); if (effG) effG.property("Slider").setValue(gap);
            }

            // 2. Also update targetComp base values directly for immediate viewport response
            var targetComp = preComp || parentComp;
            var master = getLayer(targetComp, "Cube_Master_Controller");

            if (master) {
                var preCenter = [targetComp.width / 2, targetComp.height / 2, 0];
                setTransformVal(master, "Anchor Point", [0, 0, 0]);
                setTransformVal(master, "Position", preCenter);

                // Update Effect Controls on Master Controller
                var effSX = master.effect("Size X");
                if (effSX) effSX.property("Slider").setValue(sizeX);

                var effSY = master.effect("Size Y");
                if (effSY) effSY.property("Slider").setValue(sizeY);

                var effSZ = master.effect("Size Z");
                if (effSZ) effSZ.property("Slider").setValue(sizeZ);

                var linkEff = master.effect("Link all sizes to Z");
                if (linkEff) linkEff.property("Checkbox").setValue(linkToZ ? 1 : 0);

                var effSC = master.effect("Sides Color");
                if (effSC) effSC.property("Color").setValue(fillColor);

                var effSOp = master.effect("Sides Opacity");
                if (effSOp) effSOp.property("Slider").setValue(sidesOpacity);

                var effStC = master.effect("Stroke Color");
                if (effStC) effStC.property("Color").setValue(strokeColor);

                var effStOp = master.effect("Stroke Opacity");
                if (effStOp) effStOp.property("Slider").setValue(strokeOpacity);

                var effSW = master.effect("Stroke Width");
                if (effSW) effSW.property("Slider").setValue(strokeWidth);

                var effR = master.effect("Corner Roundness");
                if (effR) effR.property("Slider").setValue(roundness);

                var effG = master.effect("Gap");
                if (effG) effG.property("Slider").setValue(gap);

                // Update dimensions, positions, fill, and stroke on all 6 faces
                var faceUpdates = [
                    { name: "Face_Front",  pos: [0, 0, -halfZ], w: sizeX, h: sizeY },
                    { name: "Face_Back",   pos: [0, 0, halfZ],  w: sizeX, h: sizeY },
                    { name: "Face_Left",   pos: [-halfX, 0, 0], w: sizeZ, h: sizeY },
                    { name: "Face_Right",  pos: [halfX, 0, 0],  w: sizeZ, h: sizeY },
                    { name: "Face_Top",    pos: [0, -halfY, 0], w: sizeX, h: sizeZ },
                    { name: "Face_Bottom", pos: [0, halfY, 0],  w: sizeX, h: sizeZ }
                ];

                for (var j = 0; j < faceUpdates.length; j++) {
                    var u = faceUpdates[j];
                    var l = getLayer(targetComp, u.name);
                    if (l) {
                        setTransformVal(l, "Position", u.pos);
                        var grp = l.property("Contents") ? (l.property("Contents").property("Face Vector") || l.property("Contents").property(1)) : null;
                        if (grp) {
                            var r = grp.property("Contents").property("ADBE Vector Shape - Rect");
                            if (r) {
                                var rw = Math.max(1, u.w - gap * 2);
                                var rh = Math.max(1, u.h - gap * 2);
                                r.property("Size").setValue([rw, rh]);
                                r.property("Roundness").setValue(roundness);
                            }
                            var fl = grp.property("Contents").property("ADBE Vector Graphic - Fill");
                            if (fl) {
                                fl.property("Color").setValue(fillColor);
                                fl.property("Opacity").setValue(sidesOpacity);
                            }

                            var st = grp.property("Contents").property("ADBE Vector Graphic - Stroke");
                            if (st) {
                                st.property("Color").setValue(strokeColor);
                                st.property("Stroke Width").setValue(strokeWidth);
                                st.property("Opacity").setValue(strokeOpacity);
                            }
                        }
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 8. Layout, Display & Initial Execution
    // -------------------------------------------------------------------------
    if (win) {
        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };

        // Show window if running as a standalone floating palette dialog
        if (win instanceof Window) {
            win.center();
            win.show();
        }
    }

    return win;
})(this);
`
        },

        cylinderMaker: {
            name: "⚙️ Cylinder Maker 3D (Radius, Extrude, Segments, Slice, Colors)",
            code: `// =============================================================================
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
        : new Window("palette", "Cylinder Maker 3D - v1.0", undefined, { resizeable: true });
    win.text = "Cylinder Maker 3D - v1.0";

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
            var val = txtHex.text.replace(/^\\s+|\\s+$/g, "");
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
                        if (fsOp && fsOp.setValue) fsOp.setValue(opacityVal);
                    }

                    var strokeS = grpSContents.property("ADBE Vector Graphic - Stroke") || grpSContents.property(3);
                    if (strokeS) {
                        var ssCol = strokeS.property("ADBE Vector Stroke Color") || strokeS.property("Color") || strokeS.property(1);
                        if (ssCol && ssCol.setValue) ssCol.setValue(strokeColor);
                        var ssW = strokeS.property("ADBE Vector Stroke Width") || strokeS.property("Stroke Width") || strokeS.property(2);
                        if (ssW && ssW.setValue) ssW.setValue(strokeWidth);
                        var ssOp = strokeS.property("ADBE Vector Stroke Opacity") || strokeS.property("Opacity") || strokeS.property(3);
                        if (ssOp && ssOp.setValue) ssOp.setValue(strokeWidth <= 0.0001 ? 0 : opacityVal);
                    }

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
                        if (feOp && feOp.setValue) feOp.setValue(opacityVal);
                    }

                    var strokeE = grpEContents.property("ADBE Vector Graphic - Stroke") || grpEContents.property(3);
                    if (strokeE) {
                        var seCol = strokeE.property("ADBE Vector Stroke Color") || strokeE.property("Color") || strokeE.property(1);
                        if (seCol && seCol.setValue) seCol.setValue(strokeColor);
                        var seW = strokeE.property("ADBE Vector Stroke Width") || strokeE.property("Stroke Width") || strokeE.property(2);
                        if (seW && seW.setValue) seW.setValue(strokeWidth);
                        var seOp = strokeE.property("ADBE Vector Stroke Opacity") || strokeE.property("Opacity") || strokeE.property(3);
                        if (seOp && seOp.setValue) seOp.setValue(strokeWidth <= 0.0001 ? 0 : opacityVal);
                    }

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
                var cylLayer = getLayer(parentComp, precompName) || getLayer(parentComp, 1);
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
                var exprStrokeWidth = 'try { Math.max(0, thisComp.layer("Cylinder_Master_Controller").effect("Stroke Width")("Slider").value); } catch(e) { value; }';
                var exprStrokeOpacity = 'try { var sw = thisComp.layer("Cylinder_Master_Controller").effect("Stroke Width")("Slider").value; var op = thisComp.layer("Cylinder_Master_Controller").effect("Opacity")("Slider").value; (sw <= 0.0001) ? 0 : op; } catch(e) { value; }';

                // Expressions on Wall segments
                for (var wi = 0; wi < segCount; wi++) {
                    var wLayer = getLayer(preComp, "Wall_" + (wi + 1));
                    if (wLayer && preMaster) {
                        wLayer.parent = preMaster;

                        var wExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")("Slider").value;\\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\\n' +
                            'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\\n' +
                            'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\\n' +
                            'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\\n' +
                            'var span = a1 - a0;\\n' +
                            'var alpha = (Math.abs(span) / n) * (Math.PI / 180);\\n' +
                            'var rMid = r * Math.cos(alpha / 2);\\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\\n' +
                            'var rad = theta * (Math.PI / 180);\\n' +
                            '[rMid * Math.sin(rad), 0, -rMid * Math.cos(rad)];';

                        var wExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\\n' +
                            'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\\n' +
                            'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\\n' +
                            'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\\n' +
                            'var span = a1 - a0;\\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\\n' +
                            '[0, -theta, 0];';

                        var wExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")("Slider").value;\\n' +
                            'var h = m.effect("Extrude Distance")("Slider").value;\\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\\n' +
                            'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\\n' +
                            'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\\n' +
                            'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\\n' +
                            'var alpha = (Math.abs(a1 - a0) / n) * (Math.PI / 180);\\n' +
                            'var chord = Math.max(1, 2 * r * Math.sin(alpha / 2));\\n' +
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

                // Expressions on Slice Start & End walls
                if (sliceStartLayer) {
                    var sLayer = getLayer(preComp, "Slice_Start");
                    if (sLayer && preMaster) {
                        sLayer.parent = preMaster;
                        setTransformVal(sLayer, "Anchor Point", [0, 0, 0]);
                        var sRad = startAngle * (Math.PI / 180);
                        setTransformVal(sLayer, "Position", [(radius / 2) * Math.sin(sRad), 0, -(radius / 2) * Math.cos(sRad)]);
                        setTransformVal(sLayer, "Orientation", [0, 90 - startAngle, 0]);

                        var sExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")("Slider").value;\\n' +
                            'var a0 = m.effect("Start Angle")("Slider").value * (Math.PI / 180);\\n' +
                            '[(r / 2) * Math.sin(a0), 0, -(r / 2) * Math.cos(a0)];';
                        var sExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var a0 = m.effect("Start Angle")("Slider").value;\\n' +
                            '[0, 90 - a0, 0];';
                        var sExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")("Slider").value;\\n' +
                            'var h = m.effect("Extrude Distance")("Slider").value;\\n' +
                            '[r, h];';

                        setTransformExpr(sLayer, "Position", sExprPos);
                        setTransformExpr(sLayer, "Orientation", sExprRot);
                        var sRoot = sLayer.property("ADBE Root Vectors Group") || sLayer.property("Contents") || (sLayer.property && sLayer.property(1));
                        var sGrp = sRoot ? (sRoot.property("Slice Vector") || sRoot.property(1)) : null;
                        if (sGrp) {
                            var sContents = sGrp.property("ADBE Vectors Group") || sGrp.property("Contents") || (grp && grp.property(2)) || (sGrp.property && sGrp.property(1));
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
                                    if (sfOp) sfOp.expression = exprOpacity;
                                }
                                var sSt = sContents.property("ADBE Vector Graphic - Stroke") || sContents.property(3);
                                if (sSt) {
                                    var ssCol = sSt.property("ADBE Vector Stroke Color") || sSt.property("Color") || sSt.property(1);
                                    if (ssCol) ssCol.expression = exprStrokeColor;
                                    var ssW = sSt.property("ADBE Vector Stroke Width") || sSt.property("Stroke Width") || sSt.property(2);
                                    if (ssW) ssW.expression = exprStrokeWidth;
                                    var ssOp = sSt.property("ADBE Vector Stroke Opacity") || sSt.property("Opacity") || sSt.property(3);
                                    if (ssOp) ssOp.expression = exprStrokeOpacity;
                                }
                            }
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

                        var eExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")("Slider").value;\\n' +
                            'var a1 = m.effect("End Angle")("Slider").value * (Math.PI / 180);\\n' +
                            '[(r / 2) * Math.sin(a1), 0, -(r / 2) * Math.cos(a1)];';
                        var eExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var a1 = m.effect("End Angle")("Slider").value;\\n' +
                            '[0, 90 - a1, 0];';
                        var eExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")("Slider").value;\\n' +
                            'var h = m.effect("Extrude Distance")("Slider").value;\\n' +
                            '[r, h];';

                        setTransformExpr(eLayer, "Position", eExprPos);
                        setTransformExpr(eLayer, "Orientation", eExprRot);
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
                                    if (efOp) efOp.expression = exprOpacity;
                                }
                                var eSt = eContents.property("ADBE Vector Graphic - Stroke") || eContents.property(3);
                                if (eSt) {
                                    var esCol = eSt.property("ADBE Vector Stroke Color") || eSt.property("Color") || eSt.property(1);
                                    if (esCol) esCol.expression = exprStrokeColor;
                                    var esW = eSt.property("ADBE Vector Stroke Width") || eSt.property("Stroke Width") || eSt.property(2);
                                    if (esW) esW.expression = exprStrokeWidth;
                                    var esOp = eSt.property("ADBE Vector Stroke Opacity") || eSt.property("Opacity") || eSt.property(3);
                                    if (esOp) esOp.expression = exprStrokeOpacity;
                                }
                            }
                        }
                    }
                }

                // Cap Generator Expression (Dynamic Pie Slice or Circle Path)
                var exprCapPath = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                    'var r = Math.max(0.001, m.effect("Radius")("Slider").value);\\n' +
                    'var n = Math.max(3, Math.round(m.effect("Rotation Segments")("Slider").value));\\n' +
                    'var slice = m.effect("Enable Slice")("Checkbox").value > 0;\\n' +
                    'var a0 = slice ? m.effect("Start Angle")("Slider").value : 0;\\n' +
                    'var a1 = slice ? m.effect("End Angle")("Slider").value : 360;\\n' +
                    'var span = a1 - a0;\\n' +
                    'var isFull = !slice || Math.abs(span) >= 359.99;\\n' +
                    'var verts = [];\\n' +
                    'var ins = [];\\n' +
                    'var outs = [];\\n' +
                    'if (isFull) {\\n' +
                    '  for (var j = 0; j < n; j++) {\\n' +
                    '    var phi = (j / n) * 2 * Math.PI;\\n' +
                    '    verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\\n' +
                    '    ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '  }\\n' +
                    '} else {\\n' +
                    '  verts.push([0, 0]); ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '  for (var j = 0; j <= n; j++) {\\n' +
                    '    var phi = (a0 + j * (span / n)) * (Math.PI / 180);\\n' +
                    '    verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\\n' +
                    '    ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '  }\\n' +
                    '}\\n' +
                    'createPath(verts, ins, outs, true);';

                // Expressions on Cap_Top
                var preCapTop = getLayer(preComp, "Cap_Top");
                if (preCapTop && preMaster) {
                    preCapTop.parent = preMaster;
                    setTransformVal(preCapTop, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preCapTop, "Position", [0, -height / 2, 0]);
                    setTransformVal(preCapTop, "Orientation", [90, 0, 0]);

                    var exprTopPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var h = m.effect("Extrude Distance")("Slider").value;\\n' +
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

                    var exprBotPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var h = m.effect("Extrude Distance")("Slider").value;\\n' +
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
`
        },

        cube200: {
            name: "Test 1: 3D Cube (200x200px) with Wiggle",
            code: `// ==========================================
// After Effects JSX Script: 200x200 3D Cube
// Built with 6 Shape Layers & Master Controller
// ==========================================

var comp = app.project.activeItem;
if (!comp) {
    comp = app.project.items.addComp("Cube Comp", 1280, 720, 1, 10, 30);
}

// Clear any existing layers
while (comp.layers.length > 0) {
    comp.layers.remove(comp.layers[0]);
}

var size = 200;
var half = size / 2;
var center = [comp.width / 2, comp.height / 2, 0];

$.writeln("Creating 200x200 px 3D Cube at comp center: " + center.join(", "));

// 1. Create Master Controller Layer
var master = comp.layers.addShape();
master.name = "Cube_Master_Controller";
master.threeDLayer = true;
master.shy = false;
master.transform.position.setValue(center);

// Apply AE wiggle expressions on rotations
master.transform.yRotation.expression = "wiggle(0.4, 45)";
master.transform.xRotation.expression = "wiggle(0.3, 30)";
master.transform.zRotation.expression = "wiggle(0.2, 15)";

// 2. Define 6 Faces of the 3D Cube
var faces = [
    { name: "Face_Front",  pos: [0, 0, -half], rot: [0, 0, 0],     color: [0.95, 0.25, 0.30] }, // Red
    { name: "Face_Back",   pos: [0, 0, half],  rot: [0, 180, 0],   color: [0.20, 0.85, 0.40] }, // Green
    { name: "Face_Left",   pos: [-half, 0, 0], rot: [0, -90, 0],   color: [0.25, 0.50, 0.95] }, // Blue
    { name: "Face_Right",  pos: [half, 0, 0],  rot: [0, 90, 0],    color: [0.95, 0.80, 0.20] }, // Yellow
    { name: "Face_Top",    pos: [0, -half, 0], rot: [90, 0, 0],    color: [0.85, 0.30, 0.90] }, // Magenta
    { name: "Face_Bottom", pos: [0, half, 0],  rot: [-90, 0, 0],   color: [0.20, 0.90, 0.90] }  // Cyan
];

for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    var faceLayer = comp.layers.addShape();
    faceLayer.name = f.name;
    faceLayer.threeDLayer = true;
    faceLayer.shy = true;

    // Vector Contents: Group -> Rect + Fill + Stroke
    var contents = faceLayer.property("Contents");
    var group = contents.addProperty("ADBE Vector Group");
    group.name = "Face Shape";

    var rect = group.property("Contents").addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([size, size]);
    rect.property("Position").setValue([0, 0]);
    rect.property("Roundness").setValue(12); // Slightly rounded edges

    var fill = group.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    fill.property("Color").setValue(f.color);
    fill.property("Opacity").setValue(85); // Semi-transparent for 3D visibility

    var stroke = group.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("Color").setValue([1, 1, 1]);
    stroke.property("Stroke Width").setValue(3);
    stroke.property("Opacity").setValue(100);

    // Transform setup: Since parent = master, position is relative to master!
    faceLayer.transform.position.setValue(f.pos);
    faceLayer.transform.orientation.setValue(f.rot);

    // Parent to Master Controller
    faceLayer.parent = master;
}

$.writeln("3D Cube successfully generated! Rotate camera with mouse drag, zoom with wheel.");
`
        },

        scriptUIPanel: {
            name: "Test 2: ScriptUI Cube Builder Panel",
            code: `// ==========================================
// After Effects ScriptUI UI Panel Tester
// ==========================================

(function(thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "AE Cube Generator", undefined, {resizeable: true});
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 14;

    // Size Group
    var pnlSize = win.add("panel", undefined, "Cube Dimensions");
    pnlSize.orientation = "column";
    pnlSize.spacing = 8;
    
    var grpRow = pnlSize.add("group");
    grpRow.orientation = "row";
    grpRow.add("statictext", undefined, "Size (px):");
    var txtSize = grpRow.add("edittext", undefined, "200");
    txtSize.characters = 5;

    var sldSize = pnlSize.add("slider", undefined, 200, {minvalue: 50, maxvalue: 500});
    sldSize.onChanging = function() {
        txtSize.text = Math.round(sldSize.value);
    };
    txtSize.onChange = function() {
        sldSize.value = parseFloat(txtSize.text) || 200;
    };

    // Animation Group
    var pnlAnim = win.add("panel", undefined, "Animation / Wiggle");
    var chkWiggle = pnlAnim.add("checkbox", undefined, "Enable 3D Wiggle");
    chkWiggle.value = true;

    var grpWiggle = pnlAnim.add("group");
    grpWiggle.add("statictext", undefined, "Wiggle Freq:");
    var txtFreq = grpWiggle.add("edittext", undefined, "0.5");
    txtFreq.characters = 4;
    grpWiggle.add("statictext", undefined, "Amp:");
    var txtAmp = grpWiggle.add("edittext", undefined, "45");
    txtAmp.characters = 4;

    // Build Button
    var btnBuild = win.add("button", undefined, "Generate Cube In Comp");
    btnBuild.onClick = function() {
        var comp = app.project.activeItem;
        if (!comp) return;

        var size = parseFloat(txtSize.text) || 200;
        var half = size / 2;
        var center = [comp.width / 2, comp.height / 2, 0];

        // Clear existing
        while (comp.layers.length > 0) comp.layers.remove(comp.layers[0]);

        var master = comp.layers.addShape();
        master.name = "Cube_Master";
        master.threeDLayer = true;
        master.transform.position.setValue(center);

        if (chkWiggle.value) {
            var f = parseFloat(txtFreq.text) || 0.5;
            var a = parseFloat(txtAmp.text) || 45;
            master.transform.yRotation.expression = "wiggle(" + f + ", " + a + ")";
            master.transform.xRotation.expression = "wiggle(" + (f * 0.7) + ", " + (a * 0.6) + ")";
        }

        var faces = [
            { name: "Front",  pos: [0, 0, -half], rot: [0, 0, 0],   color: [0.9, 0.2, 0.3] },
            { name: "Back",   pos: [0, 0, half],  rot: [0, 180, 0], color: [0.2, 0.8, 0.4] },
            { name: "Left",   pos: [-half, 0, 0], rot: [0, -90, 0], color: [0.3, 0.5, 0.9] },
            { name: "Right",  pos: [half, 0, 0],  rot: [0, 90, 0],  color: [0.9, 0.8, 0.2] },
            { name: "Top",    pos: [0, -half, 0], rot: [90, 0, 0],  color: [0.8, 0.3, 0.8] },
            { name: "Bottom", pos: [0, half, 0],  rot: [-90, 0, 0], color: [0.2, 0.8, 0.8] }
        ];

        for (var i = 0; i < faces.length; i++) {
            var f = faces[i];
            var layer = comp.layers.addShape();
            layer.name = "Face_" + f.name;
            layer.threeDLayer = true;

            var group = layer.property("Contents").addProperty("ADBE Vector Group");
            var rect = group.property("Contents").addProperty("ADBE Vector Shape - Rect");
            rect.property("Size").setValue([size, size]);
            rect.property("Roundness").setValue(10);

            var fill = group.property("Contents").addProperty("ADBE Vector Graphic - Fill");
            fill.property("Color").setValue(f.color);
            fill.property("Opacity").setValue(80);

            var stroke = group.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue([1, 1, 1]);
            stroke.property("Stroke Width").setValue(2);

            layer.transform.position.setValue(f.pos);
            layer.transform.orientation.setValue(f.rot);
            layer.parent = master;
        }

        $.writeln("Generated Cube with size: " + size + "px!");
    };

    if (win instanceof Window) {
        win.show();
    }
    return win;
})(this);
`
        },

        shapesShowcase: {
            name: "Test 3: Squares, Circles & Bézier Paths",
            code: `// ==========================================
// After Effects Shapes Showcase:
// Squares, Circles, and Custom Bézier Paths
// ==========================================

var comp = app.project.activeItem;
while (comp.layers.length > 0) comp.layers.remove(comp.layers[0]);

var center = [comp.width / 2, comp.height / 2, 0];

// 1. Rounded Square Layer
var sqLayer = comp.layers.addShape();
sqLayer.name = "Square_Shape";
sqLayer.threeDLayer = true;
sqLayer.transform.position.setValue([center[0] - 250, center[1], 0]);
sqLayer.transform.zRotation.expression = "wiggle(0.5, 40)";

var sqGroup = sqLayer.property("Contents").addProperty("ADBE Vector Group");
var rect = sqGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
rect.property("Size").setValue([180, 180]);
rect.property("Roundness").setValue(24);

var sqFill = sqGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
sqFill.property("Color").setValue([0.9, 0.4, 0.1]);
var sqStroke = sqGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
sqStroke.property("Color").setValue([1, 1, 1]);
sqStroke.property("Stroke Width").setValue(3);

// 2. Circle / Ellipse Layer
var circleLayer = comp.layers.addShape();
circleLayer.name = "Circle_Shape";
circleLayer.threeDLayer = true;
circleLayer.transform.position.setValue([center[0], center[1], 0]);
circleLayer.transform.position.expression = "wiggle(0.8, 30)";

var cGroup = circleLayer.property("Contents").addProperty("ADBE Vector Group");
var ellipse = cGroup.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
ellipse.property("Size").setValue([180, 180]);

var cFill = cGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
cFill.property("Color").setValue([0.15, 0.65, 0.95]);
var cStroke = cGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
cStroke.property("Color").setValue([1, 1, 1]);
cStroke.property("Stroke Width").setValue(3);

// 3. Custom Bézier Star Path Layer
var starLayer = comp.layers.addShape();
starLayer.name = "Star_Path_Shape";
starLayer.threeDLayer = true;
starLayer.transform.position.setValue([center[0] + 250, center[1], 0]);
starLayer.transform.yRotation.expression = "wiggle(0.5, 60)";

var starGroup = starLayer.property("Contents").addProperty("ADBE Vector Group");
var pathProp = starGroup.property("Contents").addProperty("ADBE Vector Shape - Path");

// Construct 5-point star path
var star = new Shape();
var points = 5;
var rOuter = 100;
var rInner = 45;
star.vertices = [];
star.inTangents = [];
star.outTangents = [];

for (var i = 0; i < points * 2; i++) {
    var angle = (i * Math.PI) / points - Math.PI / 2;
    var r = (i % 2 === 0) ? rOuter : rInner;
    var x = Math.cos(angle) * r;
    var y = Math.sin(angle) * r;
    star.vertices.push([x, y]);
    // Smooth tangents on outer points
    if (i % 2 === 0) {
        star.inTangents.push([-Math.sin(angle) * 12, Math.cos(angle) * 12]);
        star.outTangents.push([Math.sin(angle) * 12, -Math.cos(angle) * 12]);
    } else {
        star.inTangents.push([0, 0]);
        star.outTangents.push([0, 0]);
    }
}
star.closed = true;
pathProp.property("Path").setValue(star);

var starFill = starGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
starFill.property("Color").setValue([0.9, 0.8, 0.2]);
var starStroke = starGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
starStroke.property("Color").setValue([1, 1, 1]);
starStroke.property("Stroke Width").setValue(3);

$.writeln("Shapes showcase created: Square, Circle, and Bézier Star!");
`
        },
        pieSlice: {
            name: "Pie / Slice Generator (Path Expression & Geometry)",
            code: `/*
    Pie / Circular Sector Generator for Adobe After Effects  (v4)
    Creates a native Shape Layer with an expression-driven Path.

    Vertices:
      A = centre of the pie
      B = start-angle corner (where the arc begins)
      C = end-angle corner   (where the arc ends)

    "Round Corners" checkbox enables independent rounding radii for A, B and C.
    Overlap protection: A has the highest priority, then C, then B.
    B (and C) are automatically reduced if their rounding would collide
    with A's rounding or with each other.
*/
(function (thisObj) {
    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Pie / Slice Generator", undefined, { resizeable: true });

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 8;
        panel.margins = 12;

        // ---------- Dimensions ----------
        var grpRadius = panel.add("panel", undefined, "Dimensions");
        grpRadius.orientation = "column";
        grpRadius.alignChildren = ["fill", "top"];

        var chkEllipse = grpRadius.add("checkbox", undefined, "Enable Ellipse (separate X / Y)");
        var grpRX = grpRadius.add("group");
        grpRX.add("statictext", undefined, "Radius X:");
        var txtRadX = grpRX.add("edittext", undefined, "200");
        txtRadX.characters = 7;

        var grpRY = grpRadius.add("group");
        grpRY.add("statictext", undefined, "Radius Y:");
        var txtRadY = grpRY.add("edittext", undefined, "200");
        txtRadY.characters = 7;
        grpRY.enabled = false;

        chkEllipse.onClick = function () {
            grpRY.enabled = chkEllipse.value;
        };

        // ---------- Angles ----------
        var grpAngles = panel.add("panel", undefined, "Angles (degrees)");
        grpAngles.orientation = "column";
        grpAngles.alignChildren = ["fill", "top"];

        var grpStart = grpAngles.add("group");
        grpStart.add("statictext", undefined, "Start angle (B):");
        var txtStart = grpStart.add("edittext", undefined, "0");
        txtStart.characters = 7;

        var grpEnd = grpAngles.add("group");
        grpEnd.add("statictext", undefined, "End angle (C):");
        var txtEnd = grpEnd.add("edittext", undefined, "90");
        txtEnd.characters = 7;

        // ---------- Corner rounding ----------
        var grpRound = panel.add("panel", undefined, "Corner Rounding");
        grpRound.orientation = "column";
        grpRound.alignChildren = ["fill", "top"];

        var chkRound = grpRound.add("checkbox", undefined, "Round Corners");

        var grpCorners = grpRound.add("group");
        grpCorners.orientation = "column";
        grpCorners.alignChildren = ["fill", "top"];

        var grpCA = grpCorners.add("group");
        grpCA.add("statictext", undefined, "Radius A (centre):");
        var txtCornerA = grpCA.add("edittext", undefined, "20");
        txtCornerA.characters = 7;

        var grpCB = grpCorners.add("group");
        grpCB.add("statictext", undefined, "Radius B (start):");
        var txtCornerB = grpCB.add("edittext", undefined, "20");
        txtCornerB.characters = 7;

        var grpCC = grpCorners.add("group");
        grpCC.add("statictext", undefined, "Radius C (end):");
        var txtCornerC = grpCC.add("edittext", undefined, "20");
        txtCornerC.characters = 7;

        grpCorners.enabled = false;

        chkRound.onClick = function () {
            grpCorners.enabled = chkRound.value;
        };

        var btnCreate = panel.add("button", undefined, "Create Pie Slice Shape Layer");

        function numberFromField(field, fallback) {
            var n = parseFloat(field.text);
            return isFinite(n) ? n : fallback;
        }

        // ---------- Path expression ----------
        // All geometry is solved on a unit circle and scaled by (rx, ry) at the end,
        // so tangent continuity is kept for ellipses as well.
        var PATH_EXPR = [
            'var rx = Math.max(0.001, effect("Radius X")("Slider"));',
            'var ry = effect("Use Ellipse")("Checkbox") == 1 ? Math.max(0.001, effect("Radius Y")("Slider")) : rx;',
            'var R = (rx + ry) / 2;',
            'var PI = Math.PI;',
            'var a0 = degreesToRadians(effect("Start Angle")("Slider"));',
            'var a1 = degreesToRadians(effect("End Angle")("Slider"));',
            'var sweep = a1 - a0;',
            'var full = Math.abs(sweep) >= 2 * PI - 0.0001;',
            'if (full) { sweep = (sweep < 0 ? -1 : 1) * 2 * PI; a1 = a0 + sweep; }',
            'var s = sweep < 0 ? -1 : 1;',
            'var sw = Math.abs(sweep);',
            '',
            '// requested radii, in unit-circle space',
            'var useRound = effect("Round Corners")("Checkbox") == 1 && !full && sw > 0.001;',
            'var rA = 0, rB = 0, rC = 0;',
            'if (useRound) {',
            '  rA = Math.max(0, effect("Corner Radius A")("Slider")) / R;',
            '  rB = Math.max(0, effect("Corner Radius B")("Slider")) / R;',
            '  rC = Math.max(0, effect("Corner Radius C")("Slider")) / R;',
            '}',
            '',
            'function rOf(d) { var sd = Math.sin(d); return sd / (1 + sd); }',
            'function dOf(r) { return Math.asin(Math.min(1, r / (1 - r))); }',
            'function sc(v, k) { return [v[0] * k, v[1] * k]; }',
            '',
            '// ---- overlap protection: priority A > C > B ----',
            'var ang = sw <= PI ? sw : 2 * PI - sw;          // opening angle at A',
            'var tanH = Math.tan(ang / 2);',
            'rA = Math.min(rA, tanH);                         // A tangent length <= 1',
            'var tA = tanH > 1e-9 ? rA / tanH : 0;            // A tangent length along both edges',
            'var dm = Math.min(sw / 2, PI / 2);',
            'var room = Math.max(0, (1 - tA * tA) / 2);       // edge length left for B / C',
            'rC = Math.min(rC, 0.5, room, rOf(dm));',
            'var dC = rC > 0 ? dOf(rC) : 0;',
            'rB = Math.min(rB, 0.5, room, rOf(Math.max(0, Math.min(dm, sw - dC))));',
            'var dB = rB > 0 ? dOf(rB) : 0;',
            '',
            'var kA = (4 / 3) * Math.tan((PI - ang) / 4) * rA;',
            'var kB = (4 / 3) * Math.tan((dB + PI / 2) / 4) * rB;',
            'var kC = (4 / 3) * Math.tan((dC + PI / 2) / 4) * rC;',
            '',
            'var verts = [], ins = [], outs = [];',
            'function add(p, i, o) {',
            '  verts.push([p[0] * rx, p[1] * ry]);',
            '  ins.push([i[0] * rx, i[1] * ry]);',
            '  outs.push([o[0] * rx, o[1] * ry]);',
            '}',
            'var Z = [0, 0];',
            'var uB = [Math.cos(a0), Math.sin(a0)];',
            'var uC = [Math.cos(a1), Math.sin(a1)];',
            'var hasB = rB > 1e-6, hasC = rC > 1e-6, hasA = tA > 1e-6;',
            '',
            '// A (start of path; its rounding closes the path)',
            'if (hasA) add(sc(uB, tA), sc(uB, -kA), Z); else add(Z, Z, Z);',
            '',
            '// B',
            'if (hasB) add(sc(uB, Math.sqrt(1 - 2 * rB)), Z, sc(uB, kB));',
            '',
            '// arc between B and C',
            'var startAng = a0 + s * dB;',
            'var endAng = a1 - s * dC;',
            'var span = endAng - startAng;',
            'var count = Math.max(1, Math.ceil(Math.abs(span) / (PI / 2) - 1e-9));',
            'var step = span / count;',
            'var h = (4 / 3) * Math.tan(step / 4);',
            'for (var i = 0; i <= count; i++) {',
            '  var a = startAng + i * step;',
            '  var p = [Math.cos(a), Math.sin(a)];',
            '  var t = [-Math.sin(a), Math.cos(a)];',
            '  var vin = sc(t, -h);',
            '  var vout = sc(t, h);',
            '  if (i === 0) vin = hasB ? sc(t, -s * kB) : Z;',
            '  if (i === count) vout = hasC ? sc(t, s * kC) : Z;',
            '  add(p, vin, vout);',
            '}',
            '',
            '// C',
            'if (hasC) add(sc(uC, Math.sqrt(1 - 2 * rC)), sc(uC, kC), Z);',
            '',
            '// A (end side)',
            'if (hasA) add(sc(uC, tA), Z, sc(uC, -kA));',
            '',
            'createPath(verts, ins, outs, true);'
        ].join("\\n");

        btnCreate.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please open or select a composition first.");
                return;
            }

            app.beginUndoGroup("Create Pie / Slice Shape");

            try {
                var layer = comp.layers.addShape();
                layer.name = "Pie Slice Shape";
                layer.notShyable = true;

                function addSlider(name, value) {
                    var parade = layer.property("ADBE Effect Parade");
                    var effect = parade.addProperty("ADBE Slider Control");
                    effect.name = name;
                    effect.property(1).setValue(value);
                }

                function addCheckbox(name, value) {
                    var parade = layer.property("ADBE Effect Parade");
                    var effect = parade.addProperty("ADBE Checkbox Control");
                    effect.name = name;
                    effect.property(1).setValue(value ? 1 : 0);
                }

                addSlider("Radius X", numberFromField(txtRadX, 200));
                addSlider("Radius Y", numberFromField(txtRadY, 200));
                addCheckbox("Use Ellipse", chkEllipse.value);
                addSlider("Start Angle", numberFromField(txtStart, 0));
                addSlider("End Angle", numberFromField(txtEnd, 90));
                addCheckbox("Round Corners", chkRound.value);
                addSlider("Corner Radius A", numberFromField(txtCornerA, 20));
                addSlider("Corner Radius B", numberFromField(txtCornerB, 20));
                addSlider("Corner Radius C", numberFromField(txtCornerC, 20));

                var root = layer.property("ADBE Root Vectors Group");
                var pieGroup = root.addProperty("ADBE Vector Group");
                pieGroup.name = "Pie Group";

                var groupContents = pieGroup.property("ADBE Vectors Group");
                groupContents.addProperty("ADBE Vector Shape - Group");

                groupContents = pieGroup.property("ADBE Vectors Group");
                groupContents.addProperty("ADBE Vector Graphic - Fill");

                // Rounding is built into the path itself (no Round Corners
                // vector filter), so each vertex can have its own radius.
                groupContents = pieGroup.property("ADBE Vectors Group");
                var pathGroup = groupContents.property("ADBE Vector Shape - Group");
                var pathProperty = pathGroup.property("ADBE Vector Shape");
                pathProperty.expression = PATH_EXPR;

                layer.selected = true;
            } catch (err) {
                alert("Could not create Pie Slice Shape:\\n" + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        // --- Bottom Subtle Repository Link ---
        var grpRepoLink = panel.add("group");
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

        panel.layout.layout(true);
        panel.onResizing = panel.onResize = function () { this.layout.resize(); };
        return panel;
    }

    var scriptPanel = buildUI(thisObj);
    if (scriptPanel !== null && scriptPanel instanceof Window) {
        scriptPanel.center();
        scriptPanel.show();
    }
})(this);
`
        }
    };

    global.PRESETS = PRESETS;

})(typeof window !== 'undefined' ? window : global);
