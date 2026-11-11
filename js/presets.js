/**
 * presets.js
 * Predefined JSX scripts for After Effects testing and ScriptUI panels
 */

(function(global) {
    'use strict';

    const PRESETS = {
        cubeMaker: {
        name: "★ Cube Maker 3D (X,Y,Z, Link to Z, Colors & Stroke)",
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
        : new Window("palette", "Cube Maker 3D", undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Cube Maker 3D";
    }

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

    // -------------------------------------------------------------------------
    // 3. UI Section: Header (Panel Title + Version & Description)
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Cube Maker 3D");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "v1.3 - Parametric 3D Shape Layer Cube generator and live controller rig.");

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
    var sldX = grpX.add("slider", undefined, 200, 50, 500);
    sldX.alignment = ["fill", "center"];
    var txtX = grpX.add("edittext", undefined, "200");
    txtX.characters = 4;

    // --- Dimension Y Row ---
    var grpY = pnlDim.add("group");
    grpY.orientation = "row";
    grpY.alignment = ["fill", "top"];
    var lblY = grpY.add("statictext", undefined, "Size Y:");
    lblY.preferredSize = [80, -1];
    var sldY = grpY.add("slider", undefined, 200, 50, 500);
    sldY.alignment = ["fill", "center"];
    var txtY = grpY.add("edittext", undefined, "200");
    txtY.characters = 4;

    // --- Dimension Z Row ---
    var grpZ = pnlDim.add("group");
    grpZ.orientation = "row";
    grpZ.alignment = ["fill", "top"];
    var lblZ = grpZ.add("statictext", undefined, "Size Z:");
    lblZ.preferredSize = [80, -1];
    var sldZ = grpZ.add("slider", undefined, 200, 50, 500);
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
    var sldSidesOp = grpSidesOp.add("slider", undefined, 85, 0, 100);
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
    var sldStrokeOp = grpStrokeOp.add("slider", undefined, 100, 0, 100);
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
    var sldThick = grpThick.add("slider", undefined, 3, 1, 20);
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
    var sldRound = grpRound.add("slider", undefined, 10, 0, 80);
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
    var sldGap = grpGap.add("slider", undefined, 0, 0, 40);
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

    // --- Build Button (Always at bottom, outside of tabs) ---
    var btnBuild = win.add("button", undefined, "Build / Rebuild 3D Cube");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.preferredSize = [-1, 36];
    btnBuild.onClick = function() {
        buildOrUpdateCube(true);
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

                // Clean up all previous layers from parent composition on build
                for (var p = parentComp.layers.length; p >= 1; p--) {
                    var oldL = getLayer(parentComp, p);
                    if (oldL) {
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
                var cubeLayer = null;
                if (parentComp.layers) {
                    for (var pli = 1; pli <= parentComp.layers.length; pli++) {
                        var testL = parentComp.layer(pli);
                        if (testL && testL.source === preComp) {
                            cubeLayer = testL;
                            break;
                        }
                    }
                }
                if (!cubeLayer) {
                    cubeLayer = getLayer(parentComp, precompName) || getLayer(parentComp, 1);
                }
                if (cubeLayer) {
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
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: CYLINDER MAKER 3D v1.4
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

    var SCRIPT_VERSION = "v1.4";

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Cylinder Maker 3D " + SCRIPT_VERSION, undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Cylinder Maker 3D " + SCRIPT_VERSION;
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

    function computeCapShape(r, n, isSlice, a0, a1, imitateSegments) {
        if (typeof Shape === "undefined") return null;
        var s = new Shape();
        var span = a1 - a0;
        var isFull = !isSlice || Math.abs(span) >= 359.99;
        var verts = [];
        var ins = [];
        var outs = [];

        var isSeg = (typeof imitateSegments === "undefined") ? true : imitateSegments;
        if (isSeg) {
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
        } else {
            var K = 0.5522847498307936;
            if (isFull) {
                verts = [
                    [0, -r],
                    [r, 0],
                    [0, r],
                    [-r, 0]
                ];
                ins = [
                    [-r * K, 0],
                    [0, -r * K],
                    [r * K, 0],
                    [0, r * K]
                ];
                outs = [
                    [r * K, 0],
                    [0, r * K],
                    [-r * K, 0],
                    [0, -r * K]
                ];
            } else {
                verts.push([0, 0]); ins.push([0, 0]); outs.push([0, 0]);
                for (var j = 0; j <= n; j++) {
                    var phi = (a0 + j * (span / n)) * (Math.PI / 180);
                    verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);
                    ins.push([0, 0]); outs.push([0, 0]);
                }
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
    var pnlHeader = win.add("panel", undefined, "Cylinder Maker 3D " + SCRIPT_VERSION);
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "v1.4 - Parametric 3D Shape Layer Cylinder & Slice generator with live master rig.");

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

    // Inner Sides Checkbox (Non-animatable, paints inner sides using edge/walls color)
    var grpInnerSides = pnlStyle.add("group");
    grpInnerSides.orientation = "row";
    grpInnerSides.alignment = ["fill", "top"];
    var chkInnerSides = grpInnerSides.add("checkbox", undefined, "Paint inner sides with edge color");
    chkInnerSides.value = true;
    chkInnerSides.helpTip = "Adds internal cap faces colored with the edge/walls color to avoid front/back colors leaking through edges at acute angles.";
    chkInnerSides.onClick = function() {
        buildOrUpdateCylinder(true);
    };

    // Imitate Wall Segments Checkbox (Non-animatable, matches cap segments to extruded wall facets)
    var grpSegmentCaps = pnlStyle.add("group");
    grpSegmentCaps.orientation = "row";
    grpSegmentCaps.alignment = ["fill", "top"];
    var chkSegmentCaps = grpSegmentCaps.add("checkbox", undefined, "Imitate segments of extruded walls");
    chkSegmentCaps.value = true;
    chkSegmentCaps.helpTip = "Generates faceted caps that match the extruded wall segments vertex-for-vertex, preventing cap colors from leaking through edge facets.";
    chkSegmentCaps.onClick = function() {
        buildOrUpdateCylinder(true);
    };

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
        var imitateSegments = (typeof chkSegmentCaps !== "undefined") ? chkSegmentCaps.value : true;

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

                // Clean up all previous layers from parent composition on build
                for (var p = parentComp.layers.length; p >= 1; p--) {
                    var oldL = getLayer(parentComp, p);
                    if (oldL) {
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
                function createCapLayer(capName, yPos, xRot, capColor, isInner) {
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
                    if (!isInner) {
                        grpContents.addProperty("ADBE Vector Graphic - Stroke");
                    }

                    // Re-query grpContents fresh after all additions to prevent stale references in ExtendScript
                    grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                    var shapeGroup = grpContents.property("ADBE Vector Shape - Group") || grpContents.property(1);
                    if (shapeGroup) {
                        var pProp = shapeGroup.property("ADBE Vector Shape") || shapeGroup.property("Path") || shapeGroup.property(1);
                        if (pProp && typeof Shape !== "undefined") {
                            try {
                                var initCapShape = computeCapShape(radius, segCount, enableSlice, startAngle, endAngle, imitateSegments);
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

                    if (!isInner) {
                        var stroke = grpContents.property("ADBE Vector Graphic - Stroke") || grpContents.property(3);
                        if (stroke) {
                            var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                            if (sCol && sCol.setValue) sCol.setValue(strokeColor);
                            var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                            if (sW && sW.setValue) sW.setValue(strokeWidth);
                            var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                            if (sOp && sOp.setValue) sOp.setValue(strokeWidth <= 0.0001 ? 0 : opacityVal);
                        }
                    }

                    cap.parent = master;
                    setTransformVal(cap, "Anchor Point", [0, 0, 0]);
                    setTransformVal(cap, "Position", [0, yPos, 0]);
                    setTransformVal(cap, "Orientation", [xRot, 0, 0]);

                    createdLayers.push(cap);
                    return cap;
                }

                var capTop = createCapLayer("Cap_Top", -height / 2, 90, topColor, false);
                var capBottom = createCapLayer("Cap_Bottom", height / 2, 90, bottomColor, false);
                var paintInnerSides = (typeof chkInnerSides !== "undefined") ? chkInnerSides.value : true;
                if (paintInnerSides) {
                    var capTopInner = createCapLayer("Cap_Top_Inner", -height / 2 + 0.15, 90, wallsColor, true);
                    var capBottomInner = createCapLayer("Cap_Bottom_Inner", height / 2 - 0.15, 90, wallsColor, true);
                }

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
                    eff.property(1).expression = 'try { comp("' + parentComp.name.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '").layer("' + precompName + '").effect("' + effTarget + '")(1).value; } catch (err) { value; }';
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

                var exprSliceVisibility = 'try {\\n' +
                    '    var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                    '    var en = m.effect("Enable Slice")(1).value > 0;\\n' +
                    '    var a0 = m.effect("Start Angle")(1).value;\\n' +
                    '    var a1 = m.effect("End Angle")(1).value;\\n' +
                    '    var op = m.effect("Opacity")(1).value;\\n' +
                    '    (en && Math.abs(a1 - a0) < 359.99) ? op : 0;\\n' +
                    '} catch(e) { value; }';

                var exprSliceStrokeVisibility = 'try {\\n' +
                    '    var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                    '    var en = m.effect("Enable Slice")(1).value > 0;\\n' +
                    '    var a0 = m.effect("Start Angle")(1).value;\\n' +
                    '    var a1 = m.effect("End Angle")(1).value;\\n' +
                    '    var sw = m.effect("Stroke Width")(1).value;\\n' +
                    '    var op = m.effect("Opacity")(1).value;\\n' +
                    '    (en && Math.abs(a1 - a0) < 359.99 && sw > 0.0001) ? op : 0;\\n' +
                    '} catch(e) { value; }';

                // Expressions on Wall segments
                for (var wi = 0; wi < segCount; wi++) {
                    var wLayer = getLayer(preComp, "Wall_" + (wi + 1));
                    if (wLayer && preMaster) {
                        wLayer.parent = preMaster;

                        var wExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")(1).value;\\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\\n' +
                            'var slice = m.effect("Enable Slice")(1).value > 0;\\n' +
                            'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\\n' +
                            'var a1 = slice ? m.effect("End Angle")(1).value : 360;\\n' +
                            'var span = a1 - a0;\\n' +
                            'var alpha = (Math.abs(span) / n) * (Math.PI / 180);\\n' +
                            'var rMid = r * Math.cos(alpha / 2);\\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\\n' +
                            'var rad = theta * (Math.PI / 180);\\n' +
                            '[rMid * Math.sin(rad), 0, -rMid * Math.cos(rad)];';

                        var wExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\\n' +
                            'var slice = m.effect("Enable Slice")(1).value > 0;\\n' +
                            'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\\n' +
                            'var a1 = slice ? m.effect("End Angle")(1).value : 360;\\n' +
                            'var span = a1 - a0;\\n' +
                            'var theta = a0 + (' + wi + ' + 0.5) * (span / n);\\n' +
                            '[0, -theta, 0];';

                        var wExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                            'var r = m.effect("Radius")(1).value;\\n' +
                            'var h = m.effect("Extrude Distance")(1).value;\\n' +
                            'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\\n' +
                            'var slice = m.effect("Enable Slice")(1).value > 0;\\n' +
                            'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\\n' +
                            'var a1 = slice ? m.effect("End Angle")(1).value : 360;\\n' +
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

                // Expressions on Slice Start & End walls (Always present and reactive)
                var sLayer = getLayer(preComp, "Slice_Start");
                if (sLayer && preMaster) {
                    sLayer.parent = preMaster;
                    setTransformVal(sLayer, "Anchor Point", [0, 0, 0]);
                    var sRad = startAngle * (Math.PI / 180);
                    setTransformVal(sLayer, "Position", [(radius / 2) * Math.sin(sRad), 0, -(radius / 2) * Math.cos(sRad)]);
                    setTransformVal(sLayer, "Orientation", [0, 90 - startAngle, 0]);

                    var sExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var r = m.effect("Radius")(1).value;\\n' +
                        'var a0 = m.effect("Start Angle")(1).value * (Math.PI / 180);\\n' +
                        '[(r / 2) * Math.sin(a0), 0, -(r / 2) * Math.cos(a0)];';
                    var sExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var a0 = m.effect("Start Angle")(1).value;\\n' +
                        '[0, 90 - a0, 0];';
                    var sExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var r = m.effect("Radius")(1).value;\\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\\n' +
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

                    var eExprPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var r = m.effect("Radius")(1).value;\\n' +
                        'var a1 = m.effect("End Angle")(1).value * (Math.PI / 180);\\n' +
                        '[(r / 2) * Math.sin(a1), 0, -(r / 2) * Math.cos(a1)];';
                    var eExprRot = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var a1 = m.effect("End Angle")(1).value;\\n' +
                        '[0, 90 - a1, 0];';
                    var eExprSize = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var r = m.effect("Radius")(1).value;\\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\\n' +
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
                var exprCapPath = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                    'var r = Math.max(0.001, m.effect("Radius")(1).value);\\n' +
                    'var n = Math.max(3, Math.round(m.effect("Rotation Segments")(1).value));\\n' +
                    'var slice = m.effect("Enable Slice")(1).value > 0;\\n' +
                    'var a0 = slice ? m.effect("Start Angle")(1).value : 0;\\n' +
                    'var a1 = slice ? m.effect("End Angle")(1).value : 360;\\n' +
                    'var span = a1 - a0;\\n' +
                    'var isFull = !slice || Math.abs(span) >= 359.99;\\n' +
                    'var isSeg = ' + (imitateSegments ? 'true' : 'false') + ';\\n' +
                    'var verts = [];\\n' +
                    'var ins = [];\\n' +
                    'var outs = [];\\n' +
                    'if (isSeg) {\\n' +
                    '  if (isFull) {\\n' +
                    '    for (var j = 0; j < n; j++) {\\n' +
                    '      var phi = (j / n) * 2 * Math.PI;\\n' +
                    '      verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\\n' +
                    '      ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '    }\\n' +
                    '  } else {\\n' +
                    '    verts.push([0, 0]); ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '    for (var j = 0; j <= n; j++) {\\n' +
                    '      var phi = (a0 + j * (span / n)) * (Math.PI / 180);\\n' +
                    '      verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\\n' +
                    '      ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '    }\\n' +
                    '  }\\n' +
                    '} else {\\n' +
                    '  var K = 0.5522847498307936;\\n' +
                    '  if (isFull) {\\n' +
                    '    verts = [[0, -r], [r, 0], [0, r], [-r, 0]];\\n' +
                    '    ins = [[-r * K, 0], [0, -r * K], [r * K, 0], [0, r * K]];\\n' +
                    '    outs = [[r * K, 0], [0, r * K], [-r * K, 0], [0, -r * K]];\\n' +
                    '  } else {\\n' +
                    '    verts.push([0, 0]); ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '    for (var j = 0; j <= n; j++) {\\n' +
                    '      var phi = (a0 + j * (span / n)) * (Math.PI / 180);\\n' +
                    '      verts.push([r * Math.sin(phi), -r * Math.cos(phi)]);\\n' +
                    '      ins.push([0, 0]); outs.push([0, 0]);\\n' +
                    '    }\\n' +
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
                        'var h = m.effect("Extrude Distance")(1).value;\\n' +
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
                        'var h = m.effect("Extrude Distance")(1).value;\\n' +
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

                // Expressions on Cap_Top_Inner
                var preCapTopInner = getLayer(preComp, "Cap_Top_Inner");
                if (preCapTopInner && preMaster) {
                    preCapTopInner.parent = preMaster;
                    setTransformVal(preCapTopInner, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preCapTopInner, "Position", [0, -height / 2 + 0.15, 0]);
                    setTransformVal(preCapTopInner, "Orientation", [90, 0, 0]);

                    var exprTopInPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\\n' +
                        '[0, -h / 2 + 0.15, 0];';
                    setTransformExpr(preCapTopInner, "Position", exprTopInPos);

                    var topInRoot = preCapTopInner.property("ADBE Root Vectors Group") || preCapTopInner.property("Contents") || (preCapTopInner.property && preCapTopInner.property(1));
                    var topInGrp = topInRoot ? (topInRoot.property("Cap Vector") || topInRoot.property(1)) : null;
                    if (topInGrp) {
                        var topInContents = topInGrp.property("ADBE Vectors Group") || topInGrp.property("Contents") || (topInGrp.property && topInGrp.property(2)) || (topInGrp.property && topInGrp.property(1));
                        if (topInContents) {
                            var topInShape = topInContents.property("ADBE Vector Shape - Group") || topInContents.property(1);
                            if (topInShape) {
                                var pPropTI = topInShape.property("ADBE Vector Shape") || topInShape.property("Path") || topInShape.property(1);
                                if (pPropTI) {
                                    try {
                                        var initTIShape = computeCapShape(radius, segCount, enableSlice, startAngle, endAngle);
                                        if (initTIShape) pPropTI.setValue(initTIShape);
                                    } catch (eTIS) {}
                                    pPropTI.expression = exprCapPath;
                                }
                            }
                            var topInFl = topInContents.property("ADBE Vector Graphic - Fill") || topInContents.property(2);
                            if (topInFl) {
                                var tiCol = topInFl.property("ADBE Vector Fill Color") || topInFl.property("Color") || topInFl.property(1);
                                if (tiCol) tiCol.expression = exprWallsColor;
                                var tiOp = topInFl.property("ADBE Vector Fill Opacity") || topInFl.property("Opacity") || topInFl.property(2);
                                if (tiOp) tiOp.expression = exprOpacity;
                            }
                        }
                    }
                }

                // Expressions on Cap_Bottom_Inner
                var preCapBotInner = getLayer(preComp, "Cap_Bottom_Inner");
                if (preCapBotInner && preMaster) {
                    preCapBotInner.parent = preMaster;
                    setTransformVal(preCapBotInner, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preCapBotInner, "Position", [0, height / 2 - 0.15, 0]);
                    setTransformVal(preCapBotInner, "Orientation", [90, 0, 0]);

                    var exprBotInPos = 'var m = thisComp.layer("Cylinder_Master_Controller");\\n' +
                        'var h = m.effect("Extrude Distance")(1).value;\\n' +
                        '[0, h / 2 - 0.15, 0];';
                    setTransformExpr(preCapBotInner, "Position", exprBotInPos);

                    var botInRoot = preCapBotInner.property("ADBE Root Vectors Group") || preCapBotInner.property("Contents") || (preCapBotInner.property && preCapBotInner.property(1));
                    var botInGrp = botInRoot ? (botInRoot.property("Cap Vector") || botInRoot.property(1)) : null;
                    if (botInGrp) {
                        var botInContents = botInGrp.property("ADBE Vectors Group") || botInGrp.property("Contents") || (botInGrp.property && botInGrp.property(2)) || (botInGrp.property && botInGrp.property(1));
                        if (botInContents) {
                            var botInShape = botInContents.property("ADBE Vector Shape - Group") || botInContents.property(1);
                            if (botInShape) {
                                var pPropBI = botInShape.property("ADBE Vector Shape") || botInShape.property("Path") || botInShape.property(1);
                                if (pPropBI) {
                                    try {
                                        var initBIShape = computeCapShape(radius, segCount, enableSlice, startAngle, endAngle);
                                        if (initBIShape) pPropBI.setValue(initBIShape);
                                    } catch (eBIS) {}
                                    pPropBI.expression = exprCapPath;
                                }
                            }
                            var botInFl = botInContents.property("ADBE Vector Graphic - Fill") || botInContents.property(2);
                            if (botInFl) {
                                var biCol = botInFl.property("ADBE Vector Fill Color") || botInFl.property("Color") || botInFl.property(1);
                                if (biCol) biCol.expression = exprWallsColor;
                                var biOp = botInFl.property("ADBE Vector Fill Opacity") || botInFl.property("Opacity") || botInFl.property(2);
                                if (biOp) biOp.expression = exprOpacity;
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
        extrudedRoundRectangle: {
        name: "📦 Extruded Round Rectangle (3D Caps, Walls & Cylindrical Corners)",
        code: `// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: EXTRUDED ROUND RECTANGLE v1.3
// =============================================================================
//
// PURPOSE:
//   An interactive ScriptUI panel for After Effects that creates a parametric 3D
//   Extruded Rounded Rectangle built out of native Shape Layers inside a dedicated
//   precomposition with continuous rasterization.
//
// TOPOLOGY & GEOMETRY:
//   1. Front & Back Faces:
//      - Two 3D Shape Layers (Cap_Front at -Z/2, Cap_Back at +Z/2).
//      - Native procedural Bézier paths with 4 independent corner radii
//        (Top-Left, Top-Right, Bottom-Right, Bottom-Left) and W3C CSS
//        proportional overlap protection (§5.5).
//   2. Side Walls & Corners:
//      - 4 Straight Wall 3D Shape Layers (Top, Bottom, Left, Right) positioned
//        between the corner arcs.
//      - 4 Curved Corner Quadrants built from cylindrical sector wall facets
//        (Corner_TR, Corner_BR, Corner_BL, Corner_TL) with customizable segments.
//   3. Composition Hierarchy:
//      - Master Controller Layer (Extruded_Rect_Master_Controller) inside precomp.
//      - Precomp layer in parent comp with collapseTransformation = true.
//      - 17 Master Effect Controls driving geometry, corners, colors, and stroke.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript engine).
//   - Web AE JS & ScriptUI Emulator (ae-core.js, ae-renderer.js, app.js).
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_VERSION = "v1.3";

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Extruded Round Rectangle " + SCRIPT_VERSION, undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Extruded Round Rectangle " + SCRIPT_VERSION;
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

    // -------------------------------------------------------------------------
    // 3. UI Header (Panel Title + Version & Description)
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Extruded Round Rectangle " + SCRIPT_VERSION);
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "v1.3 - Parametric 3D extruded rounded rectangle with procedural front/back caps and cylindrical corners.");

    // -------------------------------------------------------------------------
    // 4. Tabbed Panel (Geometry vs. Appearance)
    // -------------------------------------------------------------------------
    var tabs = win.add("tabbedpanel");
    tabs.alignChildren = ["fill", "top"];
    tabs.alignment = ["fill", "top"];

    // =========================================================================
    // TAB 1: GEOMETRY
    // =========================================================================
    var tabGeometry = tabs.add("tab", undefined, "Geometry");
    tabGeometry.orientation = "column";
    tabGeometry.alignChildren = ["fill", "top"];
    tabGeometry.spacing = 10;
    tabGeometry.margins = 10;

    // --- Dimensions Section ---
    var pnlDim = tabGeometry.add("panel", undefined, "Dimensions (Width, Height, Extrude Depth)");
    pnlDim.orientation = "column";
    pnlDim.spacing = 8;
    pnlDim.alignChildren = ["fill", "top"];
    pnlDim.alignment = ["fill", "top"];

    // Width
    var grpW = pnlDim.add("group");
    grpW.orientation = "row";
    grpW.alignment = ["fill", "top"];
    var lblW = grpW.add("statictext", undefined, "Width (X):");
    lblW.preferredSize = [70, -1];
    var sldW = grpW.add("slider", undefined, 500, 20, 1920);
    sldW.minvalue = 20; sldW.maxvalue = 1920; sldW.value = 500;
    sldW.alignment = ["fill", "center"];
    var txtW = grpW.add("edittext", undefined, "500");
    txtW.characters = 4;

    // Height
    var grpH = pnlDim.add("group");
    grpH.orientation = "row";
    grpH.alignment = ["fill", "top"];
    var lblH = grpH.add("statictext", undefined, "Height (Y):");
    lblH.preferredSize = [70, -1];
    var sldH = grpH.add("slider", undefined, 300, 20, 1080);
    sldH.minvalue = 20; sldH.maxvalue = 1080; sldH.value = 300;
    sldH.alignment = ["fill", "center"];
    var txtH = grpH.add("edittext", undefined, "300");
    txtH.characters = 4;

    // Extrude Depth
    var grpD = pnlDim.add("group");
    grpD.orientation = "row";
    grpD.alignment = ["fill", "top"];
    var lblD = grpD.add("statictext", undefined, "Depth (Z):");
    lblD.preferredSize = [70, -1];
    var sldD = grpD.add("slider", undefined, 120, 10, 800);
    sldD.minvalue = 10; sldD.maxvalue = 800; sldD.value = 120;
    sldD.alignment = ["fill", "center"];
    var txtD = grpD.add("edittext", undefined, "120");
    txtD.characters = 4;

    // Quick Dimension Presets
    var grpDimPresets = pnlDim.add("group");
    grpDimPresets.orientation = "row";
    grpDimPresets.spacing = 4;
    var btnDimCard = grpDimPresets.add("button", undefined, "Card");
    btnDimCard.helpTip = "Card: 500 x 300 x 120";
    var btnDimSquare = grpDimPresets.add("button", undefined, "Cube");
    btnDimSquare.helpTip = "Cube: 350 x 350 x 350";
    var btnDimPill = grpDimPresets.add("button", undefined, "Pill");
    btnDimPill.helpTip = "Pill: 600 x 200 x 80";
    var btnDimTile = grpDimPresets.add("button", undefined, "Tile");
    btnDimTile.helpTip = "Tile: 400 x 400 x 30";

    btnDimCard.onClick = function() { setDim(500, 300, 120); };
    btnDimSquare.onClick = function() { setDim(350, 350, 350); };
    btnDimPill.onClick = function() { setDim(600, 200, 80); };
    btnDimTile.onClick = function() { setDim(400, 400, 30); };

    function setDim(w, h, d) {
        sldW.value = w; txtW.text = String(w);
        sldH.value = h; txtH.text = String(h);
        sldD.value = d; txtD.text = String(d);
        buildOrUpdateExtruded(false);
    }

    // --- Corner Radii Section ---
    var pnlCorners = tabGeometry.add("panel", undefined, "Corner Radii & Resolution");
    pnlCorners.orientation = "column";
    pnlCorners.spacing = 6;
    pnlCorners.alignChildren = ["fill", "top"];
    pnlCorners.alignment = ["fill", "top"];

    var chkLink = pnlCorners.add("checkbox", undefined, "Link All Corners");
    chkLink.value = true;

    // Master Radius Row
    var grpMaster = pnlCorners.add("group");
    grpMaster.orientation = "row";
    grpMaster.alignment = ["fill", "top"];
    var lblMaster = grpMaster.add("statictext", undefined, "Radius:");
    lblMaster.preferredSize = [65, -1];
    var sldMaster = grpMaster.add("slider", undefined, 60, 0, 400);
    sldMaster.minvalue = 0; sldMaster.maxvalue = 400; sldMaster.value = 60;
    sldMaster.alignment = ["fill", "center"];
    var txtMaster = grpMaster.add("edittext", undefined, "60");
    txtMaster.characters = 4;

    // Individual Corner Radii (2x2 Grid with compact labels TL/TR/BL/BR)
    var grpGrid = pnlCorners.add("group");
    grpGrid.orientation = "column";
    grpGrid.spacing = 5;
    grpGrid.alignment = ["fill", "top"];
    grpGrid.enabled = false;

    // Row Top: TL and TR
    var grpRowTop = grpGrid.add("group");
    grpRowTop.orientation = "row";
    grpRowTop.alignment = ["fill", "top"];

    var lblTL = grpRowTop.add("statictext", undefined, "TL:");
    lblTL.preferredSize = [24, -1];
    var sldTL = grpRowTop.add("slider", undefined, 60, 0, 400);
    sldTL.minvalue = 0; sldTL.maxvalue = 400; sldTL.value = 60;
    sldTL.alignment = ["fill", "center"];
    var txtTL = grpRowTop.add("edittext", undefined, "60");
    txtTL.characters = 3;

    var lblTR = grpRowTop.add("statictext", undefined, "TR:");
    lblTR.preferredSize = [24, -1];
    var sldTR = grpRowTop.add("slider", undefined, 60, 0, 400);
    sldTR.minvalue = 0; sldTR.maxvalue = 400; sldTR.value = 60;
    sldTR.alignment = ["fill", "center"];
    var txtTR = grpRowTop.add("edittext", undefined, "60");
    txtTR.characters = 3;

    // Row Bottom: BL and BR
    var grpRowBottom = grpGrid.add("group");
    grpRowBottom.orientation = "row";
    grpRowBottom.alignment = ["fill", "top"];

    var lblBL = grpRowBottom.add("statictext", undefined, "BL:");
    lblBL.preferredSize = [24, -1];
    var sldBL = grpRowBottom.add("slider", undefined, 60, 0, 400);
    sldBL.minvalue = 0; sldBL.maxvalue = 400; sldBL.value = 60;
    sldBL.alignment = ["fill", "center"];
    var txtBL = grpRowBottom.add("edittext", undefined, "60");
    txtBL.characters = 3;

    var lblBR = grpRowBottom.add("statictext", undefined, "BR:");
    lblBR.preferredSize = [24, -1];
    var sldBR = grpRowBottom.add("slider", undefined, 60, 0, 400);
    sldBR.minvalue = 0; sldBR.maxvalue = 400; sldBR.value = 60;
    sldBR.alignment = ["fill", "center"];
    var txtBR = grpRowBottom.add("edittext", undefined, "60");
    txtBR.characters = 3;

    // Corner Segments Row (Cylindrical Resolution)
    var grpSeg = pnlCorners.add("group");
    grpSeg.orientation = "row";
    grpSeg.alignment = ["fill", "top"];
    var lblSeg = grpSeg.add("statictext", undefined, "Segments:");
    lblSeg.preferredSize = [65, -1];
    var sldSeg = grpSeg.add("slider", undefined, 6, 2, 16);
    sldSeg.minvalue = 2; sldSeg.maxvalue = 16; sldSeg.value = 6;
    sldSeg.alignment = ["fill", "center"];
    var txtSeg = grpSeg.add("edittext", undefined, "6");
    txtSeg.characters = 3;

    // Quick Corner Presets (2 Rows of 2 Buttons for compact resilience)
    var grpCornerPresets = pnlCorners.add("group");
    grpCornerPresets.orientation = "column";
    grpCornerPresets.alignChildren = ["fill", "top"];
    grpCornerPresets.spacing = 3;

    var rowCP1 = grpCornerPresets.add("group");
    rowCP1.orientation = "row";
    rowCP1.spacing = 4;
    var btnPreCapsule = rowCP1.add("button", undefined, "Capsule");
    var btnPreTabs = rowCP1.add("button", undefined, "Top Tab");

    var rowCP2 = grpCornerPresets.add("group");
    rowCP2.orientation = "row";
    rowCP2.spacing = 4;
    var btnPreDiag = rowCP2.add("button", undefined, "Diagonal");
    var btnPreSharp = rowCP2.add("button", undefined, "Sharp (0px)");

    btnPreCapsule.onClick = function() {
        chkLink.value = true;
        grpMaster.enabled = true;
        grpGrid.enabled = false;
        var r = Math.min(sldW.value, sldH.value) / 2;
        sldMaster.value = r; txtMaster.text = String(Math.round(r));
        setAllRadii(r, r, r, r);
    };

    btnPreTabs.onClick = function() {
        chkLink.value = false;
        grpMaster.enabled = false;
        grpGrid.enabled = true;
        setAllRadii(60, 60, 0, 0);
    };

    btnPreDiag.onClick = function() {
        chkLink.value = false;
        grpMaster.enabled = false;
        grpGrid.enabled = true;
        setAllRadii(80, 0, 80, 0);
    };

    btnPreSharp.onClick = function() {
        chkLink.value = true;
        grpMaster.enabled = true;
        grpGrid.enabled = false;
        sldMaster.value = 0; txtMaster.text = "0";
        setAllRadii(0, 0, 0, 0);
    };

    function setAllRadii(tl, tr, bl, br) {
        sldTL.value = tl; txtTL.text = String(Math.round(tl));
        sldTR.value = tr; txtTR.text = String(Math.round(tr));
        sldBL.value = bl; txtBL.text = String(Math.round(bl));
        sldBR.value = br; txtBR.text = String(Math.round(br));
        buildOrUpdateExtruded(false);
    }

    // Overlap Protection
    var chkOverlap = pnlCorners.add("checkbox", undefined, "Prevent Overlap (W3C CSS Proportional Scaling)");
    chkOverlap.value = true;
    chkOverlap.onClick = function() { buildOrUpdateExtruded(false); };

    // =========================================================================
    // TAB 2: APPEARANCE & STYLING
    // =========================================================================
    var tabAppearance = tabs.add("tab", undefined, "Appearance");
    tabAppearance.orientation = "column";
    tabAppearance.alignChildren = ["fill", "top"];
    tabAppearance.spacing = 10;
    tabAppearance.margins = 10;

    var pnlStyle = tabAppearance.add("panel", undefined, "Materials & Colors");
    pnlStyle.orientation = "column";
    pnlStyle.spacing = 8;
    pnlStyle.alignChildren = ["fill", "top"];
    pnlStyle.alignment = ["fill", "top"];

    // Color Picker Helper Function
    function createColorPicker(parent, defaultHex) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.spacing = 6;
        grp.alignChildren = ["left", "center"];

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [36, 22];
        btnSwatch.helpTip = "Click to pick color";

        var txtHex = grp.add("edittext", undefined, defaultHex.toUpperCase());
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

    // Front Face Color
    var grpFrontCol = pnlStyle.add("group");
    grpFrontCol.orientation = "row";
    grpFrontCol.alignment = ["fill", "top"];
    var lblFrontCol = grpFrontCol.add("statictext", undefined, "Front Color:");
    lblFrontCol.preferredSize = [135, -1];
    var cpFront = createColorPicker(grpFrontCol, "#2288ee");
    cpFront.onChange = function() { buildOrUpdateExtruded(false); };

    // Back Face Color
    var grpBackCol = pnlStyle.add("group");
    grpBackCol.orientation = "row";
    grpBackCol.alignment = ["fill", "top"];
    var lblBackCol = grpBackCol.add("statictext", undefined, "Back Color:");
    lblBackCol.preferredSize = [135, -1];
    var cpBack = createColorPicker(grpBackCol, "#ee8822");
    cpBack.onChange = function() { buildOrUpdateExtruded(false); };

    // Front / Back Caps Opacity
    var grpCapOp = pnlStyle.add("group");
    grpCapOp.orientation = "row";
    grpCapOp.alignment = ["fill", "top"];
    var lblCapOp = grpCapOp.add("statictext", undefined, "Caps Opacity:");
    lblCapOp.preferredSize = [135, -1];
    var sldCapOp = grpCapOp.add("slider", undefined, 100, 0, 100);
    sldCapOp.alignment = ["fill", "center"];
    var txtCapOp = grpCapOp.add("edittext", undefined, "100");
    txtCapOp.characters = 3;

    // Sides / Walls Color
    var grpSidesCol = pnlStyle.add("group");
    grpSidesCol.orientation = "row";
    grpSidesCol.alignment = ["fill", "top"];
    var lblSidesCol = grpSidesCol.add("statictext", undefined, "Sides Color:");
    lblSidesCol.preferredSize = [135, -1];
    var cpSides = createColorPicker(grpSidesCol, "#1166cc");
    cpSides.onChange = function() { buildOrUpdateExtruded(false); };

    // Sides / Walls Opacity
    var grpSidesOp = pnlStyle.add("group");
    grpSidesOp.orientation = "row";
    grpSidesOp.alignment = ["fill", "top"];
    var lblSidesOp = grpSidesOp.add("statictext", undefined, "Sides Opacity:");
    lblSidesOp.preferredSize = [135, -1];
    var sldSidesOp = grpSidesOp.add("slider", undefined, 90, 0, 100);
    sldSidesOp.alignment = ["fill", "center"];
    var txtSidesOp = grpSidesOp.add("edittext", undefined, "90");
    txtSidesOp.characters = 3;

    // Stroke Color
    var grpStroke = pnlStyle.add("group");
    grpStroke.orientation = "row";
    grpStroke.alignment = ["fill", "top"];
    var lblStroke = grpStroke.add("statictext", undefined, "Stroke Color:");
    lblStroke.preferredSize = [135, -1];
    var cpStroke = createColorPicker(grpStroke, "#ffffff");
    cpStroke.onChange = function() { buildOrUpdateExtruded(false); };

    // Stroke Width
    var grpThick = pnlStyle.add("group");
    grpThick.orientation = "row";
    grpThick.alignment = ["fill", "top"];
    var lblThick = grpThick.add("statictext", undefined, "Stroke Width:");
    lblThick.preferredSize = [135, -1];
    var sldThick = grpThick.add("slider", undefined, 2, 0, 30);
    sldThick.alignment = ["fill", "center"];
    var txtThick = grpThick.add("edittext", undefined, "2");
    txtThick.characters = 3;

    // Stroke Opacity
    var grpStrokeOp = pnlStyle.add("group");
    grpStrokeOp.orientation = "row";
    grpStrokeOp.alignment = ["fill", "top"];
    var lblStrokeOp = grpStrokeOp.add("statictext", undefined, "Stroke Opacity:");
    lblStrokeOp.preferredSize = [135, -1];
    var sldStrokeOp = grpStrokeOp.add("slider", undefined, 100, 0, 100);
    sldStrokeOp.alignment = ["fill", "center"];
    var txtStrokeOp = grpStrokeOp.add("edittext", undefined, "100");
    txtStrokeOp.characters = 3;

    // Inner Sides Checkbox (Non-animatable, paints inner sides using edge color)
    var grpInnerSides = pnlStyle.add("group");
    grpInnerSides.orientation = "row";
    grpInnerSides.alignment = ["fill", "top"];
    var chkInnerSides = grpInnerSides.add("checkbox", undefined, "Paint inner sides using edge color");
    chkInnerSides.value = true;
    chkInnerSides.helpTip = "Adds internal cap faces colored with the edge/sides color to avoid front/back colors leaking through edges at acute angles.";
    chkInnerSides.onClick = function() {
        buildOrUpdateExtruded(true);
    };

    // Imitate Corner Segments Checkbox (Non-animatable, matches cap corners to extruded wall facets)
    var grpSegmentCorners = pnlStyle.add("group");
    grpSegmentCorners.orientation = "row";
    grpSegmentCorners.alignment = ["fill", "top"];
    var chkSegmentCorners = grpSegmentCorners.add("checkbox", undefined, "Imitate segments of extruded round corners");
    chkSegmentCorners.value = true;
    chkSegmentCorners.helpTip = "Generates faceted cap corners that match the extruded wall segments vertex-for-vertex, preventing cap colors from leaking through edge facets.";
    chkSegmentCorners.onClick = function() {
        buildOrUpdateExtruded(true);
    };

    // Two-way slider hook helper
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

    var onLiveUpdate = function() { buildOrUpdateExtruded(false); };
    hookSliderText(sldW, txtW, onLiveUpdate, true);
    hookSliderText(sldH, txtH, onLiveUpdate, true);
    hookSliderText(sldD, txtD, onLiveUpdate, true);
    hookSliderText(sldMaster, txtMaster, function() {
        if (chkLink.value) {
            var v = sldMaster.value;
            sldTL.value = v; txtTL.text = String(Math.round(v));
            sldTR.value = v; txtTR.text = String(Math.round(v));
            sldBL.value = v; txtBL.text = String(Math.round(v));
            sldBR.value = v; txtBR.text = String(Math.round(v));
        }
        onLiveUpdate();
    }, true);
    hookSliderText(sldTL, txtTL, onLiveUpdate, true);
    hookSliderText(sldTR, txtTR, onLiveUpdate, true);
    hookSliderText(sldBL, txtBL, onLiveUpdate, true);
    hookSliderText(sldBR, txtBR, onLiveUpdate, true);
    hookSliderText(sldSeg, txtSeg, onLiveUpdate, true);
    hookSliderText(sldCapOp, txtCapOp, onLiveUpdate, true);
    hookSliderText(sldSidesOp, txtSidesOp, onLiveUpdate, true);
    hookSliderText(sldThick, txtThick, onLiveUpdate, true);
    hookSliderText(sldStrokeOp, txtStrokeOp, onLiveUpdate, true);

    chkLink.onClick = function() {
        var linked = chkLink.value;
        grpMaster.enabled = linked;
        grpGrid.enabled = !linked;
        if (linked) {
            var v = sldMaster.value;
            sldTL.value = v; txtTL.text = String(Math.round(v));
            sldTR.value = v; txtTR.text = String(Math.round(v));
            sldBL.value = v; txtBL.text = String(Math.round(v));
            sldBR.value = v; txtBR.text = String(Math.round(v));
        }
        buildOrUpdateExtruded(false);
    };

    tabs.selection = 0;

    // --- Action Button (Anchored at the bottom outside of tabs) ---
    var btnBuild = win.add("button", undefined, "Build / Rebuild Extruded Rectangle");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.preferredSize = [-1, 36];
    btnBuild.onClick = function() {
        buildOrUpdateExtruded(true);
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
    // 5. Procedural Geometry & Expression Generation
    // -------------------------------------------------------------------------
    function computeCapShapeData(w, h, rTL, rTR, rBR, rBL, preventOverlap, imitateSegments, segCount) {
        w = Math.max(0, w);
        h = Math.max(0, h);
        rTL = Math.max(0, rTL);
        rTR = Math.max(0, rTR);
        rBR = Math.max(0, rBR);
        rBL = Math.max(0, rBL);

        if (preventOverlap) {
            var topSum    = rTL + rTR;
            var bottomSum = rBL + rBR;
            var leftSum   = rTL + rBL;
            var rightSum  = rTR + rBR;

            var f = 1.0;
            if (topSum > w && topSum > 0)       f = Math.min(f, w / topSum);
            if (bottomSum > w && bottomSum > 0) f = Math.min(f, w / bottomSum);
            if (leftSum > h && leftSum > 0)     f = Math.min(f, h / leftSum);
            if (rightSum > h && rightSum > 0)   f = Math.min(f, h / rightSum);

            rTL *= f;
            rTR *= f;
            rBR *= f;
            rBL *= f;
        }

        var halfW = w / 2;
        var halfH = h / 2;
        var xMin = -halfW;
        var xMax =  halfW;
        var yMin = -halfH;
        var yMax =  halfH;

        var isSeg = (typeof imitateSegments === "undefined") ? true : imitateSegments;
        if (isSeg) {
            var S = Math.max(1, segCount || 6);
            var verts = [];
            var ins = [];
            var outs = [];

            function addV(x, y) {
                if (verts.length > 0) {
                    var last = verts[verts.length - 1];
                    if (Math.abs(last[0] - x) < 0.0001 && Math.abs(last[1] - y) < 0.0001) return;
                }
                verts.push([x, y]);
                ins.push([0, 0]);
                outs.push([0, 0]);
            }

            addV(xMin + rTL, yMin);
            addV(xMax - rTR, yMin);

            if (rTR > 0 && S >= 1) {
                var cX = xMax - rTR, cY = yMin + rTR;
                for (var s = 1; s <= S; s++) {
                    var rad = (-90 + s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rTR * Math.cos(rad), cY + rTR * Math.sin(rad));
                }
            } else {
                addV(xMax, yMin);
            }

            addV(xMax, yMax - rBR);

            if (rBR > 0 && S >= 1) {
                var cX = xMax - rBR, cY = yMax - rBR;
                for (var s = 1; s <= S; s++) {
                    var rad = (s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rBR * Math.cos(rad), cY + rBR * Math.sin(rad));
                }
            } else {
                addV(xMax, yMax);
            }

            addV(xMin + rBL, yMax);

            if (rBL > 0 && S >= 1) {
                var cX = xMin + rBL, cY = yMax - rBL;
                for (var s = 1; s <= S; s++) {
                    var rad = (90 + s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rBL * Math.cos(rad), cY + rBL * Math.sin(rad));
                }
            } else {
                addV(xMin, yMax);
            }

            addV(xMin, yMin + rTL);

            if (rTL > 0 && S >= 1) {
                var cX = xMin + rTL, cY = yMin + rTL;
                for (var s = 1; s < S; s++) {
                    var rad = (180 + s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rTL * Math.cos(rad), cY + rTL * Math.sin(rad));
                }
            } else {
                addV(xMin, yMin);
            }

            return {
                points: verts,
                inTangents: ins,
                outTangents: outs
            };
        }

        var K = 0.5522847498307936;
        var points = [
            [xMin + rTL, yMin],
            [xMax - rTR, yMin],
            [xMax, yMin + rTR],
            [xMax, yMax - rBR],
            [xMax - rBR, yMax],
            [xMin + rBL, yMax],
            [xMin, yMax - rBL],
            [xMin, yMin + rTL]
        ];

        var inTangents = [
            [-rTL * K, 0],
            [0, 0],
            [0, -rTR * K],
            [0, 0],
            [rBR * K, 0],
            [0, 0],
            [0, rBL * K],
            [0, 0]
        ];

        var outTangents = [
            [0, 0],
            [rTR * K, 0],
            [0, 0],
            [0, rBR * K],
            [0, 0],
            [-rBL * K, 0],
            [0, 0],
            [0, -rTL * K]
        ];

        return {
            points: points,
            inTangents: inTangents,
            outTangents: outTangents
        };
    }

    function getCapPathExpr(imitateSegments) {
        return [
            "// Procedural Path for Extruded Rounded Rectangle Caps",
            "(function() {",
            "    function getVal(name, fallback) {",
            "        try {",
            "            var p = thisComp.layer('Extruded_Rect_Master_Controller').effect(name)(1);",
            "            return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
            "        } catch(e) {",
            "            return fallback;",
            "        }",
            "    }",
            "",
            "    var w = Math.max(0, getVal('Width', 500));",
            "    var h = Math.max(0, getVal('Height', 300));",
            "    var linkAll = getVal('Link All Corners', 0);",
            "    var masterR = Math.max(0, getVal('Radius All', 60));",
            "",
            "    var rTL = linkAll ? masterR : Math.max(0, getVal('Radius Top-Left', 60));",
            "    var rTR = linkAll ? masterR : Math.max(0, getVal('Radius Top-Right', 60));",
            "    var rBR = linkAll ? masterR : Math.max(0, getVal('Radius Bottom-Right', 60));",
            "    var rBL = linkAll ? masterR : Math.max(0, getVal('Radius Bottom-Left', 60));",
            "",
            "    var preventOverlap = getVal('Prevent Overlap', 1);",
            "",
            "    if (preventOverlap > 0) {",
            "        var topSum    = rTL + rTR;",
            "        var bottomSum = rBL + rBR;",
            "        var leftSum   = rTL + rBL;",
            "        var rightSum  = rTR + rBR;",
            "",
            "        var f = 1.0;",
            "        if (topSum > w && topSum > 0)       f = Math.min(f, w / topSum);",
            "        if (bottomSum > w && bottomSum > 0) f = Math.min(f, w / bottomSum);",
            "        if (leftSum > h && leftSum > 0)     f = Math.min(f, h / leftSum);",
            "        if (rightSum > h && rightSum > 0)   f = Math.min(f, h / rightSum);",
            "",
            "        rTL *= f;",
            "        rTR *= f;",
            "        rBR *= f;",
            "        rBL *= f;",
            "    }",
            "",
            "    var halfW = w / 2;",
            "    var halfH = h / 2;",
            "    var xMin = -halfW;",
            "    var xMax =  halfW;",
            "    var yMin = -halfH;",
            "    var yMax =  halfH;",
            "",
            imitateSegments ? [
            "    var S = Math.max(1, Math.round(getVal('Corner Segments', 6)));",
            "    var verts = [];",
            "    var ins = [];",
            "    var outs = [];",
            "    function addV(x, y) {",
            "        if (verts.length > 0) {",
            "            var last = verts[verts.length - 1];",
            "            if (Math.abs(last[0] - x) < 0.0001 && Math.abs(last[1] - y) < 0.0001) return;",
            "        }",
            "        verts.push([x, y]);",
            "        ins.push([0, 0]);",
            "        outs.push([0, 0]);",
            "    }",
            "    addV(xMin + rTL, yMin);",
            "    addV(xMax - rTR, yMin);",
            "    if (rTR > 0 && S >= 1) {",
            "        var cX = xMax - rTR, cY = yMin + rTR;",
            "        for (var s = 1; s <= S; s++) {",
            "            var rad = (-90 + s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rTR * Math.cos(rad), cY + rTR * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMax, yMin);",
            "    }",
            "    addV(xMax, yMax - rBR);",
            "    if (rBR > 0 && S >= 1) {",
            "        var cX = xMax - rBR, cY = yMax - rBR;",
            "        for (var s = 1; s <= S; s++) {",
            "            var rad = (s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rBR * Math.cos(rad), cY + rBR * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMax, yMax);",
            "    }",
            "    addV(xMin + rBL, yMax);",
            "    if (rBL > 0 && S >= 1) {",
            "        var cX = xMin + rBL, cY = yMax - rBL;",
            "        for (var s = 1; s <= S; s++) {",
            "            var rad = (90 + s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rBL * Math.cos(rad), cY + rBL * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMin, yMax);",
            "    }",
            "    addV(xMin, yMin + rTL);",
            "    if (rTL > 0 && S >= 1) {",
            "        var cX = xMin + rTL, cY = yMin + rTL;",
            "        for (var s = 1; s < S; s++) {",
            "            var rad = (180 + s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rTL * Math.cos(rad), cY + rTL * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMin, yMin);",
            "    }",
            "    return createPath(verts, ins, outs, true);"
            ].join("\\n") : [
            "    var K = 0.5522847498307936;",
            "    var points = [",
            "        [xMin + rTL, yMin],",
            "        [xMax - rTR, yMin],",
            "        [xMax, yMin + rTR],",
            "        [xMax, yMax - rBR],",
            "        [xMax - rBR, yMax],",
            "        [xMin + rBL, yMax],",
            "        [xMin, yMax - rBL],",
            "        [xMin, yMin + rTL]",
            "    ];",
            "    var inTangents = [",
            "        [-rTL * K, 0], [0, 0],",
            "        [0, -rTR * K], [0, 0],",
            "        [rBR * K, 0], [0, 0],",
            "        [0, rBL * K], [0, 0]",
            "    ];",
            "    var outTangents = [",
            "        [0, 0], [rTR * K, 0],",
            "        [0, 0], [0, rBR * K],",
            "        [0, 0], [-rBL * K, 0],",
            "        [0, 0], [0, -rTL * K]",
            "    ];",
            "    return createPath(points, inTangents, outTangents, true);"
            ].join("\\n"),
            "",
            "})();"
        ].join("\\n");
    }

    // -------------------------------------------------------------------------
    // 6. Core Engine: Build & Live-Update the Extruded Shape
    // -------------------------------------------------------------------------
    function buildOrUpdateExtruded(forceRebuild) {
        var parentComp = app.project ? app.project.activeItem : null;
        if (!parentComp || !(parentComp instanceof CompItem)) {
            if (forceRebuild) alert("Please select or open an active composition first.");
            return;
        }

        if (!forceRebuild && !currentPrecompName) return;

        var w = parseFloat(txtW.text) || 500;
        var h = parseFloat(txtH.text) || 300;
        var d = parseFloat(txtD.text) || 120;
        var linkAll = chkLink.value;
        var rAll = parseFloat(txtMaster.text) || 60;
        var rTL = linkAll ? rAll : (parseFloat(txtTL.text) || 0);
        var rTR = linkAll ? rAll : (parseFloat(txtTR.text) || 0);
        var rBR = linkAll ? rAll : (parseFloat(txtBR.text) || 0);
        var rBL = linkAll ? rAll : (parseFloat(txtBL.text) || 0);
        var segCount = Math.max(2, Math.min(16, parseInt(txtSeg.text, 10) || 6));
        var preventOverlap = chkOverlap.value;
        var imitateSegments = (typeof chkSegmentCorners !== "undefined") ? chkSegmentCorners.value : true;

        var frontColor = hexToRgb(cpFront._color);
        var backColor = hexToRgb(cpBack._color);
        var capsOpacity = Math.max(0, Math.min(100, parseFloat(txtCapOp.text) || 100));
        var sidesColor = hexToRgb(cpSides._color);
        var sidesOpacity = Math.max(0, Math.min(100, parseFloat(txtSidesOp.text) || 90));
        var strokeColor = hexToRgb(cpStroke._color);
        var strokeWidth = Math.max(0, parseFloat(txtThick.text) || 0);
        var strokeOpacity = Math.max(0, Math.min(100, parseFloat(txtStrokeOp.text) || 100));

        var center = [parentComp.width / 2, parentComp.height / 2, 0];

        // ---------------------------------------------------------------------
        // Case A: Structural Recreation
        // ---------------------------------------------------------------------
        if (forceRebuild) {
            if (app.beginUndoGroup) app.beginUndoGroup("Build Extruded Rounded Rectangle Precomp");

            try {
                var randNum = Math.floor(1000 + Math.random() * 9000);
                var precompName = "extruded_rect_" + randNum;
                currentPrecompName = precompName;

                // Clean up all previous layers from parent composition on build
                for (var p = parentComp.layers.length; p >= 1; p--) {
                    var oldL = getLayer(parentComp, p);
                    if (oldL) {
                        removeLayer(parentComp, oldL);
                    }
                }

                // 1. Create Master Controller Layer
                var master = parentComp.layers.addShape();
                master.name = "Extruded_Rect_Master_Controller";
                master.threeDLayer = true;
                master.shy = false;
                master.notShyable = true;
                master.label = 1;              // Red label
                master.colorLabel = "#ff3b30";
                setTransformVal(master, "Anchor Point", [0, 0, 0]);
                setTransformVal(master, "Position", center);

                var createdLayers = [];

                // Common function to configure Rect Vector Group
                function setupRectVector(layer, size, fillCol, fillOp, strCol, strW, strOp) {
                    var root = layer.property("ADBE Root Vectors Group") || layer.property("Contents") || (layer.property && layer.property(1));
                    var grp = root.addProperty("ADBE Vector Group");
                    grp.name = "Vector Group";

                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    contents.addProperty("ADBE Vector Shape - Rect");
                    contents.addProperty("ADBE Vector Graphic - Fill");
                    contents.addProperty("ADBE Vector Graphic - Stroke");

                    contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                    var rect = contents.property("ADBE Vector Shape - Rect") || contents.property(1);
                    if (rect) {
                        var rSize = rect.property("ADBE Vector Rect Size") || rect.property("Size") || rect.property(2) || rect.property(1);
                        if (rSize && rSize.setValue) rSize.setValue(size);
                    }

                    var fill = contents.property("ADBE Vector Graphic - Fill") || contents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol && fCol.setValue) fCol.setValue(fillCol);
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp && fOp.setValue) fOp.setValue(fillOp);
                    }

                    var stroke = contents.property("ADBE Vector Graphic - Stroke") || contents.property(3);
                    if (stroke) {
                        var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                        if (sCol && sCol.setValue) sCol.setValue(strCol);
                        var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                        if (sW && sW.setValue) sW.setValue(strW);
                        var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                        if (sOp && sOp.setValue) sOp.setValue(strW <= 0.0001 ? 0 : strOp);
                    }
                }

                // 2. Create 4 Straight Side Walls
                // Top Wall (Between TL and TR corners)
                var wallTop = parentComp.layers.addShape();
                wallTop.name = "Wall_Top";
                wallTop.threeDLayer = true;
                wallTop.shy = true;
                setupRectVector(wallTop, [Math.max(0.1, w - rTL - rTR), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallTop.parent = master;
                setTransformVal(wallTop, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallTop, "Position", [(-rTR + rTL) / 2, -h / 2, 0]);
                setTransformVal(wallTop, "Orientation", [90, 0, 0]);
                createdLayers.push(wallTop);

                // Bottom Wall (Between BL and BR corners)
                var wallBottom = parentComp.layers.addShape();
                wallBottom.name = "Wall_Bottom";
                wallBottom.threeDLayer = true;
                wallBottom.shy = true;
                setupRectVector(wallBottom, [Math.max(0.1, w - rBL - rBR), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallBottom.parent = master;
                setTransformVal(wallBottom, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallBottom, "Position", [(-rBR + rBL) / 2, h / 2, 0]);
                setTransformVal(wallBottom, "Orientation", [90, 180, 0]);
                createdLayers.push(wallBottom);

                // Left Wall (Between TL and BL corners)
                var wallLeft = parentComp.layers.addShape();
                wallLeft.name = "Wall_Left";
                wallLeft.threeDLayer = true;
                wallLeft.shy = true;
                setupRectVector(wallLeft, [Math.max(0.1, h - rTL - rBL), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallLeft.parent = master;
                setTransformVal(wallLeft, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallLeft, "Position", [-w / 2, (-rBL + rTL) / 2, 0]);
                setTransformVal(wallLeft, "Orientation", [90, -90, 0]);
                createdLayers.push(wallLeft);

                // Right Wall (Between TR and BR corners)
                var wallRight = parentComp.layers.addShape();
                wallRight.name = "Wall_Right";
                wallRight.threeDLayer = true;
                wallRight.shy = true;
                setupRectVector(wallRight, [Math.max(0.1, h - rTR - rBR), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallRight.parent = master;
                setTransformVal(wallRight, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallRight, "Position", [w / 2, (-rBR + rTR) / 2, 0]);
                setTransformVal(wallRight, "Orientation", [90, 90, 0]);
                createdLayers.push(wallRight);

                // 3. Create 4 Cylindrical Corner Quadrants
                function createCornerQuadrant(cornerId, centerFn, startDeg, endDeg, rVal) {
                    var sweep = endDeg - startDeg;
                    var alpha = (Math.abs(sweep) / segCount) * (Math.PI / 180);
                    var chord = Math.max(0.1, 2 * rVal * Math.sin(alpha / 2));
                    var rMid = rVal * Math.cos(alpha / 2);

                    for (var s = 0; s < segCount; s++) {
                        var theta = startDeg + (s + 0.5) * (sweep / segCount);
                        var rad = theta * (Math.PI / 180);
                        var cCenter = centerFn();
                        var posX = cCenter[0] + rMid * Math.cos(rad);
                        var posY = cCenter[1] + rMid * Math.sin(rad);

                        var cWall = parentComp.layers.addShape();
                        cWall.name = "Corner_" + cornerId + "_Wall_" + (s + 1);
                        cWall.threeDLayer = true;
                        cWall.shy = true;
                        setupRectVector(cWall, [chord, d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                        cWall.parent = master;
                        setTransformVal(cWall, "Anchor Point", [0, 0, 0]);
                        setTransformVal(cWall, "Position", [posX, posY, 0]);
                        setTransformVal(cWall, "Orientation", [90, theta + 90, 0]);
                        createdLayers.push(cWall);
                    }
                }

                // TR Corner (from -90° to 0°)
                createCornerQuadrant("TR", function() { return [w / 2 - rTR, -h / 2 + rTR]; }, -90, 0, rTR);
                // BR Corner (from 0° to 90°)
                createCornerQuadrant("BR", function() { return [w / 2 - rBR, h / 2 - rBR]; }, 0, 90, rBR);
                // BL Corner (from 90° to 180°)
                createCornerQuadrant("BL", function() { return [-w / 2 + rBL, h / 2 - rBL]; }, 90, 180, rBL);
                // TL Corner (from 180° to 270°)
                createCornerQuadrant("TL", function() { return [-w / 2 + rTL, -h / 2 + rTL]; }, 180, 270, rTL);

                // 4. Create Front and Back Caps (Procedural Bézier Geometry)
                function createCap(capName, zPos, xRot, capColor, isInner) {
                    var cap = parentComp.layers.addShape();
                    cap.name = capName;
                    cap.threeDLayer = true;
                    cap.shy = true;

                    var root = cap.property("ADBE Root Vectors Group") || cap.property("Contents") || (cap.property && cap.property(1));
                    var grp = root.addProperty("ADBE Vector Group");
                    grp.name = "Cap Vector";

                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    contents.addProperty("ADBE Vector Shape - Group");
                    contents.addProperty("ADBE Vector Graphic - Fill");
                    if (!isInner) {
                        contents.addProperty("ADBE Vector Graphic - Stroke");
                    }

                    contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                    var shapeGroup = contents.property("ADBE Vector Shape - Group") || contents.property(1);
                    if (shapeGroup) {
                        var pProp = shapeGroup.property("ADBE Vector Shape") || shapeGroup.property("Path") || (shapeGroup.numProperties >= 2 ? shapeGroup.property(2) : shapeGroup.property(1));
                        if (pProp) {
                            var capData = computeCapShapeData(w, h, rTL, rTR, rBR, rBL, preventOverlap, imitateSegments, segCount);
                            if (typeof Shape !== "undefined") {
                                try {
                                    var sObj = new Shape();
                                    sObj.vertices = capData.points;
                                    sObj.inTangents = capData.inTangents;
                                    sObj.outTangents = capData.outTangents;
                                    sObj.closed = true;
                                    pProp.setValue(sObj);
                                } catch(eS) {}
                            }
                        }
                    }

                    var fill = contents.property("ADBE Vector Graphic - Fill") || contents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol && fCol.setValue) fCol.setValue(capColor);
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp && fOp.setValue) fOp.setValue(capsOpacity);
                    }

                    if (!isInner) {
                        var stroke = contents.property("ADBE Vector Graphic - Stroke") || contents.property(3);
                        if (stroke) {
                            var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                            if (sCol && sCol.setValue) sCol.setValue(strokeColor);
                            var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                            if (sW && sW.setValue) sW.setValue(strokeWidth);
                            var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                            if (sOp && sOp.setValue) sOp.setValue(strokeWidth <= 0.0001 ? 0 : strokeOpacity);
                        }
                    }

                    cap.parent = master;
                    setTransformVal(cap, "Anchor Point", [0, 0, 0]);
                    setTransformVal(cap, "Position", [0, 0, zPos]);
                    setTransformVal(cap, "Orientation", [xRot, 0, 0]);
                    createdLayers.push(cap);
                    return cap;
                }

                var capFront = createCap("Cap_Front", -d / 2, 0, frontColor, false);
                var capBack = createCap("Cap_Back", d / 2, 0, backColor, false);
                var paintInnerSides = (typeof chkInnerSides !== "undefined") ? chkInnerSides.value : true;
                if (paintInnerSides) {
                    var capFrontInner = createCap("Cap_Front_Inner", -d / 2 + 0.15, 0, sidesColor, true);
                    var capBackInner = createCap("Cap_Back_Inner", d / 2 - 0.15, 0, sidesColor, true);
                }

                // 5. Precompose All Sub-Layers
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
                var preMaster = getLayer(preComp, "Extruded_Rect_Master_Controller") || (preComp.layer ? preComp.layer(1) : (preComp.layers && preComp.layers[0]));
                if (preMaster) {
                    preMaster.label = 1;
                    preMaster.colorLabel = "#ff3b30";
                    preMaster.notShyable = true;
                    if (preMaster.moveToBeginning) preMaster.moveToBeginning();
                    setTransformVal(preMaster, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preMaster, "Position", preCenter);
                }

                // Target precomp layer in parent comp
                var extLayer = null;
                if (parentComp.layers) {
                    for (var pli = 1; pli <= parentComp.layers.length; pli++) {
                        var testL = parentComp.layer(pli);
                        if (testL && testL.source === preComp) {
                            extLayer = testL;
                            break;
                        }
                    }
                }
                if (!extLayer) {
                    extLayer = getLayer(parentComp, precompName) || getLayer(parentComp, 1);
                }
                if (extLayer) {
                    extLayer.name = precompName;
                    extLayer.threeDLayer = true;
                    if ("collapseTransformation" in extLayer) {
                        extLayer.collapseTransformation = true;
                    }
                    extLayer.label = 1;
                    extLayer.colorLabel = "#ff3b30";
                    extLayer.notShyable = true;
                    setTransformVal(extLayer, "Anchor Point", preCenter);
                    setTransformVal(extLayer, "Position", center);
                    if (extLayer.moveToBeginning) extLayer.moveToBeginning();
                }

                // 6. Master Controls on Parent Layer
                function addMasterProp(type, name, val) {
                    if (!extLayer) return null;
                    var parade = extLayer.property("ADBE Effect Parade") || extLayer.property("Effects");
                    if (!parade) return null;
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    if (eff.property(1) && typeof eff.property(1).setValue === "function") {
                        eff.property(1).setValue(val);
                    }
                    return eff;
                }

                addMasterProp("ADBE Slider Control",   "Width",                w);
                addMasterProp("ADBE Slider Control",   "Height",               h);
                addMasterProp("ADBE Slider Control",   "Extrude Depth",        d);
                addMasterProp("ADBE Checkbox Control", "Link All Corners",     linkAll ? 1 : 0);
                addMasterProp("ADBE Slider Control",   "Radius All",           rAll);
                addMasterProp("ADBE Slider Control",   "Radius Top-Left",      rTL);
                addMasterProp("ADBE Slider Control",   "Radius Top-Right",     rTR);
                addMasterProp("ADBE Slider Control",   "Radius Bottom-Right",  rBR);
                addMasterProp("ADBE Slider Control",   "Radius Bottom-Left",   rBL);
                addMasterProp("ADBE Slider Control",   "Corner Segments",      segCount);
                addMasterProp("ADBE Checkbox Control", "Prevent Overlap",      preventOverlap ? 1 : 0);
                addMasterProp("ADBE Color Control",    "Front Color",          frontColor);
                addMasterProp("ADBE Color Control",    "Back Color",           backColor);
                addMasterProp("ADBE Slider Control",   "Caps Opacity",         capsOpacity);
                addMasterProp("ADBE Color Control",    "Sides Color",          sidesColor);
                addMasterProp("ADBE Slider Control",   "Sides Opacity",        sidesOpacity);
                addMasterProp("ADBE Color Control",    "Stroke Color",         strokeColor);
                addMasterProp("ADBE Slider Control",   "Stroke Width",         strokeWidth);
                addMasterProp("ADBE Slider Control",   "Stroke Opacity",       strokeOpacity);

                // 7. Expressions on Master Controller inside Subcomp
                if (preMaster) {
                    function linkControllerProp(effName, effTarget, defaultVal) {
                        var parade = preMaster.property("ADBE Effect Parade") || preMaster.property("Effects");
                        if (!parade) return null;
                        var eff = parade.addProperty(
                            effName.indexOf("Color") !== -1 ? "ADBE Color Control" :
                            (effName.indexOf("Link") !== -1 || effName.indexOf("Overlap") !== -1 ? "ADBE Checkbox Control" : "ADBE Slider Control")
                        );
                        eff.name = effName;
                        if (typeof defaultVal !== "undefined" && eff.property(1) && typeof eff.property(1).setValue === "function") {
                            eff.property(1).setValue(defaultVal);
                        }
                        eff.property(1).expression = 'try { comp("' + parentComp.name.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '").layer("' + precompName + '").effect("' + effTarget + '")(1).value; } catch(e) { value; }';
                        return eff;
                    }

                    linkControllerProp("Width", "Width", w);
                    linkControllerProp("Height", "Height", h);
                    linkControllerProp("Extrude Depth", "Extrude Depth", d);
                    linkControllerProp("Link All Corners", "Link All Corners", linkAll ? 1 : 0);
                    linkControllerProp("Radius All", "Radius All", rAll);
                    linkControllerProp("Radius Top-Left", "Radius Top-Left", rTL);
                    linkControllerProp("Radius Top-Right", "Radius Top-Right", rTR);
                    linkControllerProp("Radius Bottom-Right", "Radius Bottom-Right", rBR);
                    linkControllerProp("Radius Bottom-Left", "Radius Bottom-Left", rBL);
                    linkControllerProp("Corner Segments", "Corner Segments", segCount);
                    linkControllerProp("Prevent Overlap", "Prevent Overlap", preventOverlap ? 1 : 0);
                    linkControllerProp("Front Color", "Front Color", frontColor);
                    linkControllerProp("Back Color", "Back Color", backColor);
                    linkControllerProp("Caps Opacity", "Caps Opacity", capsOpacity);
                    linkControllerProp("Sides Color", "Sides Color", sidesColor);
                    linkControllerProp("Sides Opacity", "Sides Opacity", sidesOpacity);
                    linkControllerProp("Stroke Color", "Stroke Color", strokeColor);
                    linkControllerProp("Stroke Width", "Stroke Width", strokeWidth);
                    linkControllerProp("Stroke Opacity", "Stroke Opacity", strokeOpacity);
                }

                // 8. Dynamic Expressions on Subcomp Layers
                // Shared expression snippets
                var exprFrontCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Front Color")(1).value; } catch(e) { value; }';
                var exprBackCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Back Color")(1).value; } catch(e) { value; }';
                var exprCapsOp = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Caps Opacity")(1).value; } catch(e) { try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Front/Back Opacity")(1).value; } catch(e2) { value; } }';
                var exprSidesCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Sides Color")(1).value; } catch(e) { value; }';
                var exprSidesOp = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Sides Opacity")(1).value; } catch(e) { value; }';
                var exprStrokeCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Color")(1).value; } catch(e) { value; }';
                var exprStrokeWidth = 'try { Math.max(0, thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Width")(1).value); } catch(e) { value; }';
                var exprStrokeOp = 'try { var sw = thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Width")(1).value; var op = thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Opacity")(1).value; (sw <= 0.0001) ? 0 : op; } catch(e) { value; }';

                // Setup layer expressions helper
                function applyCommonMaterialExprs(lay, faceType) {
                    if (!lay) return;
                    var root = lay.property("ADBE Root Vectors Group") || lay.property("Contents") || (lay.property && lay.property(1));
                    if (!root) return;
                    var grp = root.property(1);
                    if (!grp) return;
                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    if (!contents) return;

                    var fill = contents.property("ADBE Vector Graphic - Fill") || contents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol) {
                            if (faceType === "front") fCol.expression = exprFrontCol;
                            else if (faceType === "back") fCol.expression = exprBackCol;
                            else fCol.expression = exprSidesCol;
                        }
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp) fOp.expression = (faceType === "front" || faceType === "back") ? exprCapsOp : exprSidesOp;
                    }

                    var stroke = contents.property("ADBE Vector Graphic - Stroke") || contents.property(3);
                    if (stroke) {
                        var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                        if (sCol) sCol.expression = exprStrokeCol;
                        var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                        if (sW) sW.expression = exprStrokeWidth;
                        var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                        if (sOp) sOp.expression = exprStrokeOp;
                    }
                }

                // Front & Back Caps expressions
                var capPathExpr = getCapPathExpr(imitateSegments);

                var preCapFront = getLayer(preComp, "Cap_Front");
                if (preCapFront) {
                    setTransformExpr(preCapFront, "Position", 'try { [0, 0, -thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2]; } catch(e) { [0, 0, -' + (d / 2) + ']; }');
                    applyCommonMaterialExprs(preCapFront, "front");
                    var rootF = preCapFront.property("ADBE Root Vectors Group") || preCapFront.property("Contents") || (preCapFront.property && preCapFront.property(1));
                    var grpF = rootF.property(1);
                    var contF = grpF.property("ADBE Vectors Group") || grpF.property("Contents") || (grpF.property && grpF.property(2)) || (grpF.property && grpF.property(1));
                    var shpF = contF.property("ADBE Vector Shape - Group") || contF.property(1);
                    var pF = shpF.property("ADBE Vector Shape") || shpF.property("Path") || (shpF.numProperties >= 2 ? shpF.property(2) : shpF.property(1));
                    if (pF) pF.expression = capPathExpr;
                }

                var preCapFrontInner = getLayer(preComp, "Cap_Front_Inner");
                if (preCapFrontInner) {
                    setTransformExpr(preCapFrontInner, "Position", 'try { [0, 0, -thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2 + 0.15]; } catch(e) { [0, 0, -' + (d / 2 - 0.15) + ']; }');
                    applyCommonMaterialExprs(preCapFrontInner, "sides");
                    var rootFI = preCapFrontInner.property("ADBE Root Vectors Group") || preCapFrontInner.property("Contents") || (preCapFrontInner.property && preCapFrontInner.property(1));
                    var grpFI = rootFI.property(1);
                    var contFI = grpFI.property("ADBE Vectors Group") || grpFI.property("Contents") || (grpFI.property && grpFI.property(2)) || (grpFI.property && grpFI.property(1));
                    var shpFI = contFI.property("ADBE Vector Shape - Group") || contFI.property(1);
                    var pFI = shpFI.property("ADBE Vector Shape") || shpFI.property("Path") || (shpFI.numProperties >= 2 ? shpFI.property(2) : shpFI.property(1));
                    if (pFI) pFI.expression = capPathExpr;
                }

                var preCapBack = getLayer(preComp, "Cap_Back");
                if (preCapBack) {
                    setTransformExpr(preCapBack, "Position", 'try { [0, 0, thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2]; } catch(e) { [0, 0, ' + (d / 2) + ']; }');
                    applyCommonMaterialExprs(preCapBack, "back");
                    var rootB = preCapBack.property("ADBE Root Vectors Group") || preCapBack.property("Contents") || (preCapBack.property && preCapBack.property(1));
                    var grpB = rootB.property(1);
                    var contB = grpB.property("ADBE Vectors Group") || grpB.property("Contents") || (grpB.property && grpB.property(2)) || (grpB.property && grpB.property(1));
                    var shpB = contB.property("ADBE Vector Shape - Group") || contB.property(1);
                    var pB = shpB.property("ADBE Vector Shape") || shpB.property("Path") || (shpB.numProperties >= 2 ? shpB.property(2) : shpB.property(1));
                    if (pB) pB.expression = capPathExpr;
                }

                var preCapBackInner = getLayer(preComp, "Cap_Back_Inner");
                if (preCapBackInner) {
                    setTransformExpr(preCapBackInner, "Position", 'try { [0, 0, thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2 - 0.15]; } catch(e) { [0, 0, ' + (d / 2 - 0.15) + ']; }');
                    applyCommonMaterialExprs(preCapBackInner, "sides");
                    var rootBI = preCapBackInner.property("ADBE Root Vectors Group") || preCapBackInner.property("Contents") || (preCapBackInner.property && preCapBackInner.property(1));
                    var grpBI = rootBI.property(1);
                    var contBI = grpBI.property("ADBE Vectors Group") || grpBI.property("Contents") || (grpBI.property && grpBI.property(2)) || (grpBI.property && grpBI.property(1));
                    var shpBI = contBI.property("ADBE Vector Shape - Group") || contBI.property(1);
                    var pBI = shpBI.property("ADBE Vector Shape") || shpBI.property("Path") || (shpBI.numProperties >= 2 ? shpBI.property(2) : shpBI.property(1));
                    if (pBI) pBI.expression = capPathExpr;
                }

                // Helper for wall dimensions & positions
                var exprSolverHeader = [
                    'var m = thisComp.layer("Extruded_Rect_Master_Controller");',
                    'function _gv(n, fb) { try { var eff = m.effect(n); return (eff && eff(1)) ? eff(1).value : fb; } catch(e) { return fb; } }',
                    'var w = Math.max(0, _gv("Width", ' + w + '));',
                    'var h = Math.max(0, _gv("Height", ' + h + '));',
                    'var d = Math.max(0, _gv("Extrude Depth", ' + d + '));',
                    'var link = _gv("Link All Corners", ' + (linkAll ? 1 : 0) + ') > 0;',
                    'var rAll = Math.max(0, _gv("Radius All", ' + rAll + '));',
                    'var rTL = link ? rAll : Math.max(0, _gv("Radius Top-Left", ' + rTL + '));',
                    'var rTR = link ? rAll : Math.max(0, _gv("Radius Top-Right", ' + rTR + '));',
                    'var rBR = link ? rAll : Math.max(0, _gv("Radius Bottom-Right", ' + rBR + '));',
                    'var rBL = link ? rAll : Math.max(0, _gv("Radius Bottom-Left", ' + rBL + '));',
                    'if (_gv("Prevent Overlap", ' + (preventOverlap ? 1 : 0) + ') > 0) {',
                    '    var tS = rTL + rTR, bS = rBL + rBR, lS = rTL + rBL, rS = rTR + rBR;',
                    '    var f = 1.0;',
                    '    if (tS > w && tS > 0) f = Math.min(f, w / tS);',
                    '    if (bS > w && bS > 0) f = Math.min(f, w / bS);',
                    '    if (lS > h && lS > 0) f = Math.min(f, h / lS);',
                    '    if (rS > h && rS > 0) f = Math.min(f, h / rS);',
                    '    rTL *= f; rTR *= f; rBR *= f; rBL *= f;',
                    '}'
                ].join('\\n');

                function applyRectSizeExpr(lay, sizeExpr) {
                    if (!lay) return;
                    var root = lay.property("ADBE Root Vectors Group") || lay.property("Contents") || (lay.property && lay.property(1));
                    var grp = root.property(1);
                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    var rect = contents.property("ADBE Vector Shape - Rect") || contents.property(1);
                    var rSize = rect.property("ADBE Vector Rect Size") || rect.property("Size") || rect.property(2) || rect.property(1);
                    if (rSize) rSize.expression = sizeExpr;
                }

                // Apply expressions to straight walls
                var preWallTop = getLayer(preComp, "Wall_Top");
                if (preWallTop) {
                    setTransformExpr(preWallTop, "Position", exprSolverHeader + '\\n[(-rTR + rTL) / 2, -h / 2, 0];');
                    applyRectSizeExpr(preWallTop, exprSolverHeader + '\\n[Math.max(0.1, w - rTL - rTR), d];');
                    applyCommonMaterialExprs(preWallTop, false);
                }

                var preWallBottom = getLayer(preComp, "Wall_Bottom");
                if (preWallBottom) {
                    setTransformExpr(preWallBottom, "Position", exprSolverHeader + '\\n[(-rBR + rBL) / 2, h / 2, 0];');
                    applyRectSizeExpr(preWallBottom, exprSolverHeader + '\\n[Math.max(0.1, w - rBL - rBR), d];');
                    applyCommonMaterialExprs(preWallBottom, false);
                }

                var preWallLeft = getLayer(preComp, "Wall_Left");
                if (preWallLeft) {
                    setTransformExpr(preWallLeft, "Position", exprSolverHeader + '\\n[-w / 2, (-rBL + rTL) / 2, 0];');
                    applyRectSizeExpr(preWallLeft, exprSolverHeader + '\\n[Math.max(0.1, h - rTL - rBL), d];');
                    applyCommonMaterialExprs(preWallLeft, false);
                }

                var preWallRight = getLayer(preComp, "Wall_Right");
                if (preWallRight) {
                    setTransformExpr(preWallRight, "Position", exprSolverHeader + '\\n[w / 2, (-rBR + rTR) / 2, 0];');
                    applyRectSizeExpr(preWallRight, exprSolverHeader + '\\n[Math.max(0.1, h - rTR - rBR), d];');
                    applyCommonMaterialExprs(preWallRight, false);
                }

                // Corner wall facet expressions
                function applyCornerWallExprs(cornerId, startDeg, endDeg, radiusVar, centerExpr) {
                    var sweep = endDeg - startDeg;
                    for (var s = 0; s < segCount; s++) {
                        var wName = "Corner_" + cornerId + "_Wall_" + (s + 1);
                        var lay = getLayer(preComp, wName);
                        if (lay) {
                            var tFormula = startDeg + ' + (' + s + ' + 0.5) * (' + sweep + ' / Math.max(1, Math.round(_gv("Corner Segments", ' + segCount + '))))';
                            var posExpr = [
                                exprSolverHeader,
                                'var r = ' + radiusVar + ';',
                                'var segs = Math.max(1, Math.round(_gv("Corner Segments", ' + segCount + ')));',
                                'var alpha = (' + Math.abs(sweep) + ' / segs) * (Math.PI / 180);',
                                'var rMid = r * Math.cos(alpha / 2);',
                                'var theta = ' + tFormula + ';',
                                'var rad = theta * (Math.PI / 180);',
                                'var c = ' + centerExpr + ';',
                                '[c[0] + rMid * Math.cos(rad), c[1] + rMid * Math.sin(rad), 0];'
                            ].join('\\n');

                            var sizeExpr = [
                                exprSolverHeader,
                                'var r = ' + radiusVar + ';',
                                'var segs = Math.max(1, Math.round(_gv("Corner Segments", ' + segCount + ')));',
                                'var alpha = (' + Math.abs(sweep) + ' / segs) * (Math.PI / 180);',
                                'var chord = Math.max(0.1, 2 * r * Math.sin(alpha / 2));',
                                '[chord, d];'
                            ].join('\\n');

                            var orientExpr = [
                                exprSolverHeader,
                                'var theta = ' + tFormula + ';',
                                '[90, theta + 90, 0];'
                            ].join('\\n');

                            setTransformExpr(lay, "Position", posExpr);
                            setTransformExpr(lay, "Orientation", orientExpr);
                            applyRectSizeExpr(lay, sizeExpr);
                            applyCommonMaterialExprs(lay, false);
                        }
                    }
                }

                applyCornerWallExprs("TR", -90, 0, "rTR", '[w / 2 - rTR, -h / 2 + rTR]');
                applyCornerWallExprs("BR", 0, 90, "rBR", '[w / 2 - rBR, h / 2 - rBR]');
                applyCornerWallExprs("BL", 90, 180, "rBL", '[-w / 2 + rBL, h / 2 - rBL]');
                applyCornerWallExprs("TL", 180, 270, "rTL", '[-w / 2 + rTL, -h / 2 + rTL]');

                if (extLayer) extLayer.selected = true;

            } catch (err) {
                alert("Error building Extruded Rounded Rectangle: " + err.toString());
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        }
        // ---------------------------------------------------------------------
        // Case B: Live Updating Existing Composition
        // ---------------------------------------------------------------------
        else {
            var existingLayer = getLayer(parentComp, currentPrecompName);
            if (!existingLayer) return;

            function setEffectVal(layer, effName, val) {
                if (!layer) return;
                var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
                if (parade) {
                    var eff = parade.property(effName);
                    if (eff) {
                        var p = eff.property(1);
                        if (p && typeof p.setValue === "function") p.setValue(val);
                    }
                }
            }

            setEffectVal(existingLayer, "Width",                w);
            setEffectVal(existingLayer, "Height",               h);
            setEffectVal(existingLayer, "Extrude Depth",        d);
            setEffectVal(existingLayer, "Link All Corners",     linkAll ? 1 : 0);
            setEffectVal(existingLayer, "Radius All",           rAll);
            setEffectVal(existingLayer, "Radius Top-Left",      rTL);
            setEffectVal(existingLayer, "Radius Top-Right",     rTR);
            setEffectVal(existingLayer, "Radius Bottom-Right",  rBR);
            setEffectVal(existingLayer, "Radius Bottom-Left",   rBL);
            setEffectVal(existingLayer, "Corner Segments",      segCount);
            setEffectVal(existingLayer, "Prevent Overlap",      preventOverlap ? 1 : 0);
            setEffectVal(existingLayer, "Front Color",          frontColor);
            setEffectVal(existingLayer, "Back Color",           backColor);
            setEffectVal(existingLayer, "Caps Opacity",         capsOpacity);
            setEffectVal(existingLayer, "Front/Back Color",     frontColor);
            setEffectVal(existingLayer, "Front/Back Opacity",   capsOpacity);
            setEffectVal(existingLayer, "Sides Color",          sidesColor);
            setEffectVal(existingLayer, "Sides Opacity",        sidesOpacity);
            setEffectVal(existingLayer, "Stroke Color",         strokeColor);
            setEffectVal(existingLayer, "Stroke Width",         strokeWidth);
            setEffectVal(existingLayer, "Stroke Opacity",       strokeOpacity);
        }
    }

    // -------------------------------------------------------------------------
    // 7. Layout & Show Window
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
    customRoundedRect: {
        name: "🔲 Custom Rounded Rect (Individual Radii & Overlap Protection)",
        code: `// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: CUSTOM ROUNDED RECTANGLE v1.1
// =============================================================================
//
// PURPOSE:
//   Creates a parametric vector Shape Layer rectangle with independently
//   customizable corner radii (Top-Left, Top-Right, Bottom-Right, Bottom-Left)
//   and mathematical proportional scaling to prevent overlapping corner curves
//   when radii exceed width or height (adhering to W3C CSS border-radius standard).
//
// ARCHITECTURE & WORKFLOW:
//   1. ScriptUI UI Window / Dockable Panel (2 Distinct Tabs):
//      - [1] Geometry Tab:
//        * Width & Height scrubbable sliders + numeric text inputs.
//        * Quick dimension presets (Card, Square, HD 1080p, Banner).
//        * "Link All Corners" checkbox + Master Radius slider.
//        * 2x2 Corner grid: Top-Left, Top-Right, Bottom-Left, Bottom-Right.
//        * Quick corner presets (Pill/Capsule, Top Tab, Bottom Tab, Diagonal, Card, Sharp).
//        * "Prevent Overlap" checkbox (proportional scaling).
//      - [2] Appearance Tab:
//        * Live color pickers for Fill and Stroke.
//        * Fill Opacity, Stroke Width, and Stroke Opacity sliders.
//        * Automatic stroke suppression when stroke width is 0.
//
//   2. Live Rigging:
//      - All parameters drive Effect Controls on the Shape Layer.
//      - The procedural Bézier path expression recalculates dynamically in real time.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript engine).
//   - Works both as a dockable panel and as a floating palette.
//   - Full web emulator runtime compatibility.
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_VERSION = "v1.1";

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Custom Rounded Rect " + SCRIPT_VERSION, undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Custom Rounded Rect " + SCRIPT_VERSION;
    }

    var currentLayerName = "Custom_Rounded_Rect";

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 12;

    // -------------------------------------------------------------------------
    // 2. Helper Functions: Colors & Transforms
    // -------------------------------------------------------------------------
    function hexToRgb(hex) {
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var num = parseInt(hex, 16);
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
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

    // -------------------------------------------------------------------------
    // 3. UI Header (Panel Title + Version & Description)
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Custom Rounded Rect " + SCRIPT_VERSION);
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "v1.1 - Parametric 2D Shape Layer with independent corner radii & W3C overlap protection.");

    // -------------------------------------------------------------------------
    // 4. Tabbed Panel (Geometry vs. Appearance)
    // -------------------------------------------------------------------------
    var tpanel = win.add("tabbedpanel", undefined, undefined);
    tpanel.alignChildren = ["fill", "top"];
    tpanel.alignment = ["fill", "fill"];

    // =========================================================================
    // TAB 1: GEOMETRY
    // =========================================================================
    var tabGeometry = tpanel.add("tab", undefined, "Geometry");
    tabGeometry.orientation = "column";
    tabGeometry.alignChildren = ["fill", "top"];
    tabGeometry.alignment = ["fill", "fill"];
    tabGeometry.spacing = 8;
    tabGeometry.margins = 8;

    // --- Sub-panel: Dimensions (Width, Height) ---
    var pnlDim = tabGeometry.add("panel", undefined, "Dimensions (px)");
    pnlDim.orientation = "column";
    pnlDim.spacing = 6;
    pnlDim.alignChildren = ["fill", "top"];

    // Width Row
    var grpW = pnlDim.add("group");
    grpW.orientation = "row";
    grpW.alignment = ["fill", "top"];
    var lblW = grpW.add("statictext", undefined, "Width:");
    lblW.preferredSize = [60, -1];
    var sldW = grpW.add("slider", undefined, 500, 10, 1920);
    sldW.alignment = ["fill", "center"];
    var txtW = grpW.add("edittext", undefined, "500");
    txtW.characters = 5;

    // Height Row
    var grpH = pnlDim.add("group");
    grpH.orientation = "row";
    grpH.alignment = ["fill", "top"];
    var lblH = grpH.add("statictext", undefined, "Height:");
    lblH.preferredSize = [60, -1];
    var sldH = grpH.add("slider", undefined, 300, 10, 1080);
    sldH.alignment = ["fill", "center"];
    var txtH = grpH.add("edittext", undefined, "300");
    txtH.characters = 5;

    // Quick Dimension Presets
    var grpDimPresets = pnlDim.add("group");
    grpDimPresets.orientation = "row";
    grpDimPresets.spacing = 4;
    var btnDimCard = grpDimPresets.add("button", undefined, "Card");
    btnDimCard.helpTip = "Card: 500 x 300";
    var btnDimSquare = grpDimPresets.add("button", undefined, "Square");
    btnDimSquare.helpTip = "Square: 400 x 400";
    var btnDimHD = grpDimPresets.add("button", undefined, "HD");
    btnDimHD.helpTip = "HD: 1920 x 1080";
    var btnDimBanner = grpDimPresets.add("button", undefined, "Banner");
    btnDimBanner.helpTip = "Banner: 728 x 90";

    btnDimCard.onClick = function() { setDim(500, 300); };
    btnDimSquare.onClick = function() { setDim(400, 400); };
    btnDimHD.onClick = function() { setDim(1920, 1080); };
    btnDimBanner.onClick = function() { setDim(728, 90); };

    function setDim(w, h) {
        sldW.value = w; txtW.text = String(w);
        sldH.value = h; txtH.text = String(h);
        buildOrUpdateRect(false);
    }

    // --- Sub-panel: Corner Radii ---
    var pnlCorners = tabGeometry.add("panel", undefined, "Corner Radii (px)");
    pnlCorners.orientation = "column";
    pnlCorners.spacing = 6;
    pnlCorners.alignChildren = ["fill", "top"];

    // Link All Checkbox
    var chkLink = pnlCorners.add("checkbox", undefined, "Link All Corners");
    chkLink.value = false;

    // Master Radius Row
    var grpMaster = pnlCorners.add("group");
    grpMaster.orientation = "row";
    grpMaster.alignment = ["fill", "top"];
    var lblMaster = grpMaster.add("statictext", undefined, "All:");
    lblMaster.preferredSize = [60, -1];
    var sldMaster = grpMaster.add("slider", undefined, 50, 0, 500);
    sldMaster.alignment = ["fill", "center"];
    var txtMaster = grpMaster.add("edittext", undefined, "50");
    txtMaster.characters = 4;
    grpMaster.enabled = false;

    // 2x2 Individual Corner Radii Grid:
    // [ Top-Left ]      [ Top-Right ]
    // [ Bottom-Left ]   [ Bottom-Right ]
    var grpGrid = pnlCorners.add("group");
    grpGrid.orientation = "column";
    grpGrid.alignChildren = ["fill", "top"];
    grpGrid.spacing = 6;

    // Top Row: TL and TR
    var grpRowTop = grpGrid.add("group");
    grpRowTop.orientation = "row";
    grpRowTop.alignment = ["fill", "top"];

    var lblTL = grpRowTop.add("statictext", undefined, "TL:");
    lblTL.preferredSize = [25, -1];
    var sldTL = grpRowTop.add("slider", undefined, 50, 0, 500);
    sldTL.alignment = ["fill", "center"];
    var txtTL = grpRowTop.add("edittext", undefined, "50");
    txtTL.characters = 4;

    var lblTR = grpRowTop.add("statictext", undefined, "TR:");
    lblTR.preferredSize = [25, -1];
    var sldTR = grpRowTop.add("slider", undefined, 50, 0, 500);
    sldTR.alignment = ["fill", "center"];
    var txtTR = grpRowTop.add("edittext", undefined, "50");
    txtTR.characters = 4;

    // Bottom Row: BL and BR
    var grpRowBot = grpGrid.add("group");
    grpRowBot.orientation = "row";
    grpRowBot.alignment = ["fill", "top"];

    var lblBL = grpRowBot.add("statictext", undefined, "BL:");
    lblBL.preferredSize = [25, -1];
    var sldBL = grpRowBot.add("slider", undefined, 50, 0, 500);
    sldBL.alignment = ["fill", "center"];
    var txtBL = grpRowBot.add("edittext", undefined, "50");
    txtBL.characters = 4;

    var lblBR = grpRowBot.add("statictext", undefined, "BR:");
    lblBR.preferredSize = [25, -1];
    var sldBR = grpRowBot.add("slider", undefined, 50, 0, 500);
    sldBR.alignment = ["fill", "center"];
    var txtBR = grpRowBot.add("edittext", undefined, "50");
    txtBR.characters = 4;

    // Corner Presets
    var grpPresets = pnlCorners.add("group");
    grpPresets.orientation = "column";
    grpPresets.alignChildren = ["fill", "top"];
    grpPresets.spacing = 4;

    var rowPreset1 = grpPresets.add("group");
    rowPreset1.orientation = "row";
    rowPreset1.spacing = 4;
    var btnPill = rowPreset1.add("button", undefined, "Capsule / Pill");
    var btnTopTab = rowPreset1.add("button", undefined, "Top Tab");
    var btnBotTab = rowPreset1.add("button", undefined, "Bottom Tab");

    var rowPreset2 = grpPresets.add("group");
    rowPreset2.orientation = "row";
    rowPreset2.spacing = 4;
    var btnDiag = rowPreset2.add("button", undefined, "Diagonal");
    var btnCard = rowPreset2.add("button", undefined, "Card (30px)");
    var btnSharp = rowPreset2.add("button", undefined, "Sharp (0px)");

    function setCorners(tl, tr, br, bl, link) {
        chkLink.value = Boolean(link);
        grpMaster.enabled = Boolean(link);
        grpGrid.enabled = !link;
        if (link) {
            sldMaster.value = tl; txtMaster.text = String(tl);
        }
        sldTL.value = tl; txtTL.text = String(tl);
        sldTR.value = tr; txtTR.text = String(tr);
        sldBR.value = br; txtBR.text = String(br);
        sldBL.value = bl; txtBL.text = String(bl);
        buildOrUpdateRect(false);
    }

    btnPill.onClick = function() { setCorners(999, 999, 999, 999, true); };
    btnTopTab.onClick = function() { setCorners(40, 40, 0, 0, false); };
    btnBotTab.onClick = function() { setCorners(0, 0, 40, 40, false); };
    btnDiag.onClick = function() { setCorners(60, 0, 60, 0, false); };
    btnCard.onClick = function() { setCorners(30, 30, 30, 30, true); };
    btnSharp.onClick = function() { setCorners(0, 0, 0, 0, true); };

    // Prevent Overlap Checkbox
    var chkOverlap = tabGeometry.add("checkbox", undefined, "Prevent Overlap (W3C CSS Proportional Scaling)");
    chkOverlap.value = true;
    chkOverlap.helpTip = "Scales radii proportionally if sum of adjacent corners exceeds width or height (CSS standard).";
    chkOverlap.onClick = function() { buildOrUpdateRect(false); };

    // =========================================================================
    // TAB 2: APPEARANCE
    // =========================================================================
    var tabAppearance = tpanel.add("tab", undefined, "Appearance");
    tabAppearance.orientation = "column";
    tabAppearance.alignChildren = ["fill", "top"];
    tabAppearance.alignment = ["fill", "fill"];
    tabAppearance.spacing = 8;
    tabAppearance.margins = 8;

    var pnlStyle = tabAppearance.add("panel", undefined, "Fill & Stroke Styling");
    pnlStyle.orientation = "column";
    pnlStyle.spacing = 10;
    pnlStyle.alignChildren = ["fill", "top"];

    // Color Picker Creator
    function createColorPicker(parent, defaultHex) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.spacing = 6;
        grp.alignChildren = ["left", "center"];

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [36, 22];
        btnSwatch.helpTip = "Click to pick color";

        var txtHex = grp.add("edittext", undefined, defaultHex);
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

    // Fill Color
    var grpFill = pnlStyle.add("group");
    grpFill.orientation = "row";
    grpFill.alignment = ["fill", "top"];
    var lblFill = grpFill.add("statictext", undefined, "Fill Color:");
    lblFill.preferredSize = [100, -1];
    var cpFill = createColorPicker(grpFill, "#2288ee");
    cpFill.onChange = function() { buildOrUpdateRect(false); };

    // Fill Opacity
    var grpFillOp = pnlStyle.add("group");
    grpFillOp.orientation = "row";
    grpFillOp.alignment = ["fill", "top"];
    var lblFillOp = grpFillOp.add("statictext", undefined, "Fill Opacity:");
    lblFillOp.preferredSize = [100, -1];
    var sldFillOp = grpFillOp.add("slider", undefined, 100, 0, 100);
    sldFillOp.alignment = ["fill", "center"];
    var txtFillOp = grpFillOp.add("edittext", undefined, "100");
    txtFillOp.characters = 3;

    // Stroke Color
    var grpStroke = pnlStyle.add("group");
    grpStroke.orientation = "row";
    grpStroke.alignment = ["fill", "top"];
    var lblStroke = grpStroke.add("statictext", undefined, "Stroke Color:");
    lblStroke.preferredSize = [100, -1];
    var cpStroke = createColorPicker(grpStroke, "#ffffff");
    cpStroke.onChange = function() { buildOrUpdateRect(false); };

    // Stroke Width
    var grpThick = pnlStyle.add("group");
    grpThick.orientation = "row";
    grpThick.alignment = ["fill", "top"];
    var lblThick = grpThick.add("statictext", undefined, "Stroke Width:");
    lblThick.preferredSize = [100, -1];
    var sldThick = grpThick.add("slider", undefined, 4, 0, 40);
    sldThick.alignment = ["fill", "center"];
    var txtThick = grpThick.add("edittext", undefined, "4");
    txtThick.characters = 3;

    // Stroke Opacity
    var grpStrokeOp = pnlStyle.add("group");
    grpStrokeOp.orientation = "row";
    grpStrokeOp.alignment = ["fill", "top"];
    var lblStrokeOp = grpStrokeOp.add("statictext", undefined, "Stroke Opacity:");
    lblStrokeOp.preferredSize = [100, -1];
    var sldStrokeOp = grpStrokeOp.add("slider", undefined, 100, 0, 100);
    sldStrokeOp.alignment = ["fill", "center"];
    var txtStrokeOp = grpStrokeOp.add("edittext", undefined, "100");
    txtStrokeOp.characters = 3;

    // Two-way slider hook helper
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

    var onLiveUpdate = function() { buildOrUpdateRect(false); };
    hookSliderText(sldW, txtW, onLiveUpdate, true);
    hookSliderText(sldH, txtH, onLiveUpdate, true);
    hookSliderText(sldMaster, txtMaster, function() {
        if (chkLink.value) {
            var v = sldMaster.value;
            sldTL.value = v; txtTL.text = String(Math.round(v));
            sldTR.value = v; txtTR.text = String(Math.round(v));
            sldBR.value = v; txtBR.text = String(Math.round(v));
            sldBL.value = v; txtBL.text = String(Math.round(v));
        }
        onLiveUpdate();
    }, true);
    hookSliderText(sldTL, txtTL, onLiveUpdate, true);
    hookSliderText(sldTR, txtTR, onLiveUpdate, true);
    hookSliderText(sldBR, txtBR, onLiveUpdate, true);
    hookSliderText(sldBL, txtBL, onLiveUpdate, true);
    hookSliderText(sldFillOp, txtFillOp, onLiveUpdate, true);
    hookSliderText(sldThick, txtThick, onLiveUpdate, true);
    hookSliderText(sldStrokeOp, txtStrokeOp, onLiveUpdate, true);

    chkLink.onClick = function() {
        var linked = chkLink.value;
        grpMaster.enabled = linked;
        grpGrid.enabled = !linked;
        if (linked) {
            var v = sldMaster.value;
            sldTL.value = v; txtTL.text = String(Math.round(v));
            sldTR.value = v; txtTR.text = String(Math.round(v));
            sldBR.value = v; txtBR.text = String(Math.round(v));
            sldBL.value = v; txtBL.text = String(Math.round(v));
        }
        buildOrUpdateRect(false);
    };

    tpanel.selection = 0;

    // --- Action Button ---
    var btnBuild = win.add("button", undefined, "Build / Rebuild Rounded Rectangle");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.preferredSize = [-1, 36];
    btnBuild.onClick = function() {
        buildOrUpdateRect(true);
    };

    // --- Bottom Subtle Repository Link ---
    var grpRepoLink = win.add("group");
    grpRepoLink.orientation = "row";
    grpRepoLink.alignment = ["fill", "bottom"];
    grpRepoLink.alignChildren = ["center", "center"];
    grpRepoLink.margins = [0, 4, 0, 0];
    var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AECustomRoundedRect");
    lblRepoLink.helpTip = "https://github.com/work2survive/AECustomRoundedRect";
    lblRepoLink.onClick = function() {
        var url = "https://github.com/work2survive/AECustomRoundedRect";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else {
            system.callSystem('open "' + url + '"');
        }
    };

    // -------------------------------------------------------------------------
    // 5. Core Geometry & Expression Architecture
    // -------------------------------------------------------------------------
    function computeShapeData(w, h, rTL, rTR, rBR, rBL, preventOverlap) {
        w = Math.max(0, w);
        h = Math.max(0, h);
        rTL = Math.max(0, rTL);
        rTR = Math.max(0, rTR);
        rBR = Math.max(0, rBR);
        rBL = Math.max(0, rBL);

        if (preventOverlap) {
            var topSum    = rTL + rTR;
            var bottomSum = rBL + rBR;
            var leftSum   = rTL + rBL;
            var rightSum  = rTR + rBR;

            var f = 1.0;
            if (topSum > w && topSum > 0)       f = Math.min(f, w / topSum);
            if (bottomSum > w && bottomSum > 0) f = Math.min(f, w / bottomSum);
            if (leftSum > h && leftSum > 0)     f = Math.min(f, h / leftSum);
            if (rightSum > h && rightSum > 0)   f = Math.min(f, h / rightSum);

            rTL *= f;
            rTR *= f;
            rBR *= f;
            rBL *= f;
        }

        var K = 0.5522847498307936;
        var halfW = w / 2;
        var halfH = h / 2;
        var xMin = -halfW;
        var xMax =  halfW;
        var yMin = -halfH;
        var yMax =  halfH;

        var points = [
            [xMin + rTL, yMin],        // P0: Top edge, TL curve end
            [xMax - rTR, yMin],        // P1: Top edge, TR curve start
            [xMax, yMin + rTR],        // P2: Right edge, TR curve end
            [xMax, yMax - rBR],        // P3: Right edge, BR curve start
            [xMax - rBR, yMax],        // P4: Bottom edge, BR curve end
            [xMin + rBL, yMax],        // P5: Bottom edge, BL curve start
            [xMin, yMax - rBL],        // P6: Left edge, BL curve end
            [xMin, yMin + rTL]         // P7: Left edge, TL curve start
        ];

        var inTangents = [
            [-rTL * K, 0],
            [0, 0],
            [0, -rTR * K],
            [0, 0],
            [rBR * K, 0],
            [0, 0],
            [0, rBL * K],
            [0, 0]
        ];

        var outTangents = [
            [0, 0],
            [rTR * K, 0],
            [0, 0],
            [0, rBR * K],
            [0, 0],
            [-rBL * K, 0],
            [0, 0],
            [0, -rTL * K]
        ];

        return {
            points: points,
            inTangents: inTangents,
            outTangents: outTangents
        };
    }

    var PATH_EXPR = [
        "// Custom Rounded Rectangle Expression (W3C CSS Proportional Overlap)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            var p = effect(name)(1);",
        "            return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "        } catch(e) {",
        "            return fallback;",
        "        }",
        "    }",
        "",
        "    var w = Math.max(0, getVal('Width', 500));",
        "    var h = Math.max(0, getVal('Height', 300));",
        "    var linkAll = getVal('Link All Corners', 0);",
        "    var masterR = Math.max(0, getVal('Radius All', 50));",
        "",
        "    var rTL = linkAll ? masterR : Math.max(0, getVal('Radius Top-Left', 50));",
        "    var rTR = linkAll ? masterR : Math.max(0, getVal('Radius Top-Right', 50));",
        "    var rBR = linkAll ? masterR : Math.max(0, getVal('Radius Bottom-Right', 50));",
        "    var rBL = linkAll ? masterR : Math.max(0, getVal('Radius Bottom-Left', 50));",
        "",
        "    var preventOverlap = getVal('Prevent Overlap', 1);",
        "",
        "    // Proportional scaling (W3C CSS Backgrounds & Borders Level 3, §5.5)",
        "    if (preventOverlap > 0) {",
        "        var topSum    = rTL + rTR;",
        "        var bottomSum = rBL + rBR;",
        "        var leftSum   = rTL + rBL;",
        "        var rightSum  = rTR + rBR;",
        "",
        "        var f = 1.0;",
        "        if (topSum > w && topSum > 0)       f = Math.min(f, w / topSum);",
        "        if (bottomSum > w && bottomSum > 0) f = Math.min(f, w / bottomSum);",
        "        if (leftSum > h && leftSum > 0)     f = Math.min(f, h / leftSum);",
        "        if (rightSum > h && rightSum > 0)   f = Math.min(f, h / rightSum);",
        "",
        "        rTL *= f;",
        "        rTR *= f;",
        "        rBR *= f;",
        "        rBL *= f;",
        "    }",
        "",
        "    // Bezier circle constant K = 4/3 * (sqrt(2) - 1)",
        "    var K = 0.5522847498307936;",
        "    var halfW = w / 2;",
        "    var halfH = h / 2;",
        "    var xMin = -halfW;",
        "    var xMax =  halfW;",
        "    var yMin = -halfH;",
        "    var yMax =  halfH;",
        "",
        "    var points = [",
        "        [xMin + rTL, yMin],",
        "        [xMax - rTR, yMin],",
        "        [xMax, yMin + rTR],",
        "        [xMax, yMax - rBR],",
        "        [xMax - rBR, yMax],",
        "        [xMin + rBL, yMax],",
        "        [xMin, yMax - rBL],",
        "        [xMin, yMin + rTL]",
        "    ];",
        "",
        "    var inTangents = [",
        "        [-rTL * K, 0],",
        "        [0, 0],",
        "        [0, -rTR * K],",
        "        [0, 0],",
        "        [rBR * K, 0],",
        "        [0, 0],",
        "        [0, rBL * K],",
        "        [0, 0]",
        "    ];",
        "",
        "    var outTangents = [",
        "        [0, 0],",
        "        [rTR * K, 0],",
        "        [0, 0],",
        "        [0, rBR * K],",
        "        [0, 0],",
        "        [-rBL * K, 0],",
        "        [0, 0],",
        "        [0, -rTL * K]",
        "    ];",
        "",
        "    return createPath(points, inTangents, outTangents, true);",
        "})();"
    ].join("\\n");

    // -------------------------------------------------------------------------
    // 6. Layer Creation & Live Updating
    // -------------------------------------------------------------------------
    function buildOrUpdateRect(forceRebuild) {
        var comp = app.project ? app.project.activeItem : null;
        if (!comp || !(comp instanceof CompItem)) {
            if (forceRebuild) alert("Please select or open an active composition first.");
            return;
        }

        var w = parseFloat(txtW.text) || 500;
        var h = parseFloat(txtH.text) || 300;
        var linkAll = chkLink.value;
        var rAll = parseFloat(txtMaster.text) || 50;
        var rTL = linkAll ? rAll : (parseFloat(txtTL.text) || 0);
        var rTR = linkAll ? rAll : (parseFloat(txtTR.text) || 0);
        var rBR = linkAll ? rAll : (parseFloat(txtBR.text) || 0);
        var rBL = linkAll ? rAll : (parseFloat(txtBL.text) || 0);
        var preventOverlap = chkOverlap.value;

        var fillColor = hexToRgb(cpFill.value);
        var fillOpacity = Math.max(0, Math.min(100, parseFloat(txtFillOp.text) || 100));
        var strokeColor = hexToRgb(cpStroke.value);
        var strokeWidth = Math.max(0, parseFloat(txtThick.text) || 0);
        var strokeOpacity = Math.max(0, Math.min(100, parseFloat(txtStrokeOp.text) || 100));

        var existingLayer = getLayer(comp, currentLayerName);

        // Case A: Structural Creation
        if (forceRebuild || !existingLayer) {
            if (app.beginUndoGroup) app.beginUndoGroup("Create Custom Rounded Rectangle");
            try {
                // Clean up all previous layers from composition on build
                for (var p = comp.layers.length; p >= 1; p--) {
                    var oldL = getLayer(comp, p);
                    if (oldL) {
                        removeLayer(comp, oldL);
                    }
                }

                var layer = comp.layers.addShape();
                layer.name = currentLayerName;
                layer.notShyable = true;
                layer.label = 1;
                layer.colorLabel = "#ff3b30";

                var center = [comp.width / 2, comp.height / 2, 0];
                if (layer.transform && layer.transform.position) {
                    layer.transform.position.setValue(center);
                }

                // 1. Add Effect Controls
                function addControl(type, name, val) {
                    var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    eff.property(1).setValue(val);
                    return eff;
                }

                addControl("ADBE Slider Control",   "Width",                w);
                addControl("ADBE Slider Control",   "Height",               h);
                addControl("ADBE Checkbox Control", "Link All Corners",     linkAll ? 1 : 0);
                addControl("ADBE Slider Control",   "Radius All",           rAll);
                addControl("ADBE Slider Control",   "Radius Top-Left",      rTL);
                addControl("ADBE Slider Control",   "Radius Top-Right",     rTR);
                addControl("ADBE Slider Control",   "Radius Bottom-Right",  rBR);
                addControl("ADBE Slider Control",   "Radius Bottom-Left",   rBL);
                addControl("ADBE Checkbox Control", "Prevent Overlap",      preventOverlap ? 1 : 0);
                addControl("ADBE Color Control",    "Fill Color",           fillColor);
                addControl("ADBE Slider Control",   "Fill Opacity",         fillOpacity);
                addControl("ADBE Color Control",    "Stroke Color",         strokeColor);
                addControl("ADBE Slider Control",   "Stroke Width",         strokeWidth);
                addControl("ADBE Slider Control",   "Stroke Opacity",       strokeOpacity);

                // 2. Add Shape Group with Path, Fill and Stroke
                var root = layer.property("ADBE Root Vectors Group") || layer.property("Contents") || (layer.property && layer.property(1));
                var grp = root.addProperty("ADBE Vector Group");
                grp.name = "Rounded Rect Vector";

                var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                grpContents.addProperty("ADBE Vector Shape - Group");
                grpContents.addProperty("ADBE Vector Graphic - Fill");
                grpContents.addProperty("ADBE Vector Graphic - Stroke");

                // Re-query grpContents fresh after all additions to prevent stale references
                grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                var shapeGroup = grpContents.property("ADBE Vector Shape - Group") || grpContents.property(1);
                if (shapeGroup) {
                    var pathProp = shapeGroup.property("ADBE Vector Shape") || shapeGroup.property("Path") || (shapeGroup.numProperties >= 2 ? shapeGroup.property(2) : shapeGroup.property(1));
                    if (pathProp) {
                        var shapeData = computeShapeData(w, h, rTL, rTR, rBR, rBL, preventOverlap);
                        if (typeof Shape !== "undefined") {
                            try {
                                var sObj = new Shape();
                                sObj.vertices = shapeData.points;
                                sObj.inTangents = shapeData.inTangents;
                                sObj.outTangents = shapeData.outTangents;
                                sObj.closed = true;
                                pathProp.setValue(sObj);
                            } catch(eS) {}
                        }
                        pathProp.expression = PATH_EXPR;
                    }
                }

                var fill = grpContents.property("ADBE Vector Graphic - Fill") || grpContents.property(2);
                if (fill) {
                    var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                    if (fCol) {
                        fCol.setValue(fillColor);
                        fCol.expression = 'try { effect("Fill Color")(1).value; } catch(e) { value; }';
                    }
                    var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                    if (fOp) {
                        fOp.setValue(fillOpacity);
                        fOp.expression = 'try { effect("Fill Opacity")(1).value; } catch(e) { value; }';
                    }
                }

                var stroke = grpContents.property("ADBE Vector Graphic - Stroke") || grpContents.property(3);
                if (stroke) {
                    var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                    if (sCol) {
                        sCol.setValue(strokeColor);
                        sCol.expression = 'try { effect("Stroke Color")(1).value; } catch(e) { value; }';
                    }
                    var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                    if (sW) {
                        sW.setValue(strokeWidth);
                        sW.expression = 'try { Math.max(0, effect("Stroke Width")(1).value); } catch(e) { value; }';
                    }
                    var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                    if (sOp) {
                        sOp.setValue(strokeWidth <= 0.0001 ? 0 : strokeOpacity);
                        sOp.expression = 'try { var sw = effect("Stroke Width")(1).value; var op = effect("Stroke Opacity")(1).value; (sw <= 0.0001) ? 0 : op; } catch(e) { value; }';
                    }
                }

                layer.selected = true;
            } catch(err) {
                alert("Error building Custom Rounded Rectangle: " + err.toString());
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        }
        // Case B: Live Property Updating
        else {
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

            setLayerEffectVal(existingLayer, "Width",                w);
            setLayerEffectVal(existingLayer, "Height",               h);
            setLayerEffectVal(existingLayer, "Link All Corners",     linkAll ? 1 : 0);
            setLayerEffectVal(existingLayer, "Radius All",           rAll);
            setLayerEffectVal(existingLayer, "Radius Top-Left",      rTL);
            setLayerEffectVal(existingLayer, "Radius Top-Right",     rTR);
            setLayerEffectVal(existingLayer, "Radius Bottom-Right",  rBR);
            setLayerEffectVal(existingLayer, "Radius Bottom-Left",   rBL);
            setLayerEffectVal(existingLayer, "Prevent Overlap",      preventOverlap ? 1 : 0);
            setLayerEffectVal(existingLayer, "Fill Color",           fillColor);
            setLayerEffectVal(existingLayer, "Fill Opacity",         fillOpacity);
            setLayerEffectVal(existingLayer, "Stroke Color",         strokeColor);
            setLayerEffectVal(existingLayer, "Stroke Width",         strokeWidth);
            setLayerEffectVal(existingLayer, "Stroke Opacity",       strokeWidth <= 0.0001 ? 0 : strokeOpacity);
        }
    }

    // -------------------------------------------------------------------------
    // 7. Layout & Show Window
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

})(this);
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
        if (!(thisObj instanceof Panel)) {
            panel.text = "Pie / Slice Generator";
        }

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 8;
        panel.margins = 12;

        // ---------------------------------------------------------------------
        // UI Header (Panel Title + Version & Description)
        // ---------------------------------------------------------------------
        var pnlHeader = panel.add("panel", undefined, "Pie / Slice Generator");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.spacing = 3;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblDesc = pnlHeader.add("statictext", undefined, "v4.1 - Procedural Bézier Shape Layer pie & slice sector generator.");

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
        btnCreate.alignment = ["fill", "top"];
        btnCreate.preferredSize = [-1, 36];

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
