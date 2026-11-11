// =============================================================================
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
    var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE-Cube-Maker-3D");
    lblRepoLink.helpTip = "https://github.com/work2survive/AE-Cube-Maker-3D";
    lblRepoLink.onClick = function() {
        var url = "https://github.com/work2survive/AE-Cube-Maker-3D";
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
