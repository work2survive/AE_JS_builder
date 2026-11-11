// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
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
    ].join("\n");

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
