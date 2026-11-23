// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE ALIGN ANCHOR POINT v1.0.0
// =============================================================================
//
// PURPOSE:
//   Aligns the anchor point of any comp, text box (point or paragraph), shape/vector
//   layer, solid, footage, or null to the Left, Center, or Right edge (X) and
//   Top, Center, or Bottom edge (Y) WITHOUT shifting the layer's visual content on screen.
//
// KEY MECHANICS:
//   1. Zero-Shift Content Invariance:
//      - Keeps layer content visually locked in place using scale-safe and rotation-safe
//        position compensation formulas.
//   2. Dynamic Expression Linking (Universal Compatibility):
//      - Uses sourceRectAtTime(time, false) on Anchor Point and Position.
//      - Anchor Point Expression:
//          const r = sourceRectAtTime(time, false);
//          [r.left, r.top]; // for Top-Left
//      - Position Expression (Scale-Safe):
//          const r = sourceRectAtTime(time, false);
//          const s = transform.scale / 100;
//          const target = [r.left, r.top];
//          const origA = transform.anchorPoint.value;
//          value + [(target[0] - origA[0]) * s[0], (target[1] - origA[1]) * s[1]];
//   3. One-Time Static Bake Mode:
//      - Evaluates the offset and sets numeric values directly without expressions.
//   4. Vector Cross Indicator Child Layer:
//      - Creates a vector crosshair shape layer linked as a child layer.
//      - Position is ALWAYS locked to [0, 0] so it dynamically indicates the anchor
//        point pivot across rotations, scales, animations, and text updates.
//      - Marked as Guide Layer so it never renders in final exports.
//   5. ScriptUI Panel & 3x3 Visual Matrix:
//      - Quick 9-point preset grid, individual X/Y radio controls, and demo comp generator.
//
// REPOSITORY:
//   https://github.com/work2survive/AE_JS_builder
//
// DOCUMENTATION & MECHANICS:
//   samples/AE_Align_Anchor_Point_README.md
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_NAME = "AE Align Anchor Point";
    var SCRIPT_VERSION = "v1.0.0";
    var REPO_URL = "https://github.com/work2survive/AE_JS_builder";
    var README_URL = "https://github.com/work2survive/AE_JS_builder/blob/main/samples/AE_Align_Anchor_Point_README.md";

    // -------------------------------------------------------------------------
    // 1. Safe Environment & Console Logging
    // -------------------------------------------------------------------------
    var globalObj = (typeof $ !== "undefined" && typeof $.global !== "undefined")
        ? $.global
        : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));

    if (typeof $ === "undefined") {
        globalObj.$ = { global: globalObj, writeln: function(msg) { if (typeof console !== "undefined") console.log(msg); } };
    } else if (typeof $.global === "undefined") {
        $.global = globalObj;
    }
    var $root = (typeof $ !== "undefined") ? $ : globalObj.$;

    // -------------------------------------------------------------------------
    // 2. Geometry & Bounding Box Helpers
    // -------------------------------------------------------------------------

    /**
     * Obtains the local bounding rectangle of any layer via sourceRectAtTime
     * with robust fallbacks for precomps, solids, shapes, and text.
     */
    function getLayerBounds(layer, compTime) {
        if (!layer) return { left: 0, top: 0, width: 100, height: 100 };
        var t = (compTime !== undefined) ? compTime : 0;

        // 1. Standard sourceRectAtTime
        if (typeof layer.sourceRectAtTime === "function") {
            try {
                var sr = layer.sourceRectAtTime(t, false);
                if (sr && (sr.width !== 0 || sr.height !== 0 || sr.left !== 0 || sr.top !== 0)) {
                    return {
                        left: sr.left,
                        top: sr.top,
                        width: sr.width,
                        height: sr.height
                    };
                }
            } catch (eSR) {}
        }

        // 2. Text Layer Property Document Fallback
        try {
            var textProp = layer.property("ADBE Text Properties") || layer.property("Text");
            if (textProp) {
                var docProp = textProp.property("ADBE Text Document") || layer.property("Source Text");
                if (docProp && docProp.value) {
                    var doc = docProp.value;
                    if (doc.boxText && doc.boxTextSize) {
                        var bPos = doc.boxTextPos || [0, 0];
                        return {
                            left: bPos[0],
                            top: bPos[1],
                            width: doc.boxTextSize[0],
                            height: doc.boxTextSize[1]
                        };
                    }
                }
            }
        } catch (eText) {}

        // 3. Shape Layer Vector Contents Fallback
        try {
            var contents = layer.property("Contents") || layer.property("ADBE Root Vectors Group");
            if (contents) {
                var sb = scanShapeGroupBounds(contents, t);
                if (sb && (sb.width > 0 || sb.height > 0)) {
                    return sb;
                }
            }
        } catch (eShape) {}

        // 4. Precomp, Solid, Footage dimensions
        var w = 0, h = 0;
        if (layer.source && typeof layer.source.width === "number" && typeof layer.source.height === "number") {
            w = layer.source.width;
            h = layer.source.height;
        } else if (typeof layer.width === "number" && typeof layer.height === "number") {
            w = layer.width;
            h = layer.height;
        }

        if (w > 0 && h > 0) {
            return { left: 0, top: 0, width: w, height: h };
        }

        // 5. Fallback to containing composition size
        var cW = (layer.containingComp && layer.containingComp.width) ? layer.containingComp.width : 1920;
        var cH = (layer.containingComp && layer.containingComp.height) ? layer.containingComp.height : 1080;
        return { left: 0, top: 0, width: cW, height: cH };
    }

    /**
     * Recursively computes the combined bounding box of vector shapes in a shape group
     */
    function scanShapeGroupBounds(grp, t) {
        if (!grp || typeof grp.numProperties !== "number") return null;
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var found = false;

        function traverse(cur) {
            if (!cur || !cur.numProperties) return;
            for (var i = 1; i <= cur.numProperties; i++) {
                var prop = cur.property(i);
                if (!prop) continue;
                var mn = prop.matchName || "";

                if (mn === "ADBE Vector Shape - Rect") {
                    var szP = prop.property("ADBE Vector Rect Size") || prop.property("Size");
                    var posP = prop.property("ADBE Vector Rect Position") || prop.property("Position");
                    var sz = szP ? szP.value : [100, 100];
                    var pos = posP ? posP.value : [0, 0];
                    var hw = sz[0] / 2, hh = sz[1] / 2;
                    minX = Math.min(minX, pos[0] - hw); maxX = Math.max(maxX, pos[0] + hw);
                    minY = Math.min(minY, pos[1] - hh); maxY = Math.max(maxY, pos[1] + hh);
                    found = true;
                } else if (mn === "ADBE Vector Shape - Ellipse") {
                    var eSzP = prop.property("ADBE Vector Ellipse Size") || prop.property("Size");
                    var ePosP = prop.property("ADBE Vector Ellipse Position") || prop.property("Position");
                    var eSz = eSzP ? eSzP.value : [100, 100];
                    var ePos = ePosP ? ePosP.value : [0, 0];
                    var ehw = eSz[0] / 2, ehh = eSz[1] / 2;
                    minX = Math.min(minX, ePos[0] - ehw); maxX = Math.max(maxX, ePos[0] + ehw);
                    minY = Math.min(minY, ePos[1] - ehh); maxY = Math.max(maxY, ePos[1] + ehh);
                    found = true;
                } else if (mn === "ADBE Vector Shape - Group") {
                    var pathP = prop.property("ADBE Vector Shape") || prop.property("Path");
                    if (pathP && pathP.value && pathP.value.vertices) {
                        var verts = pathP.value.vertices;
                        for (var v = 0; v < verts.length; v++) {
                            minX = Math.min(minX, verts[v][0]); maxX = Math.max(maxX, verts[v][0]);
                            minY = Math.min(minY, verts[v][1]); maxY = Math.max(maxY, verts[v][1]);
                            found = true;
                        }
                    }
                } else if (prop.numProperties > 0) {
                    traverse(prop);
                }
            }
        }

        traverse(grp);
        if (!found) return null;
        return {
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Computes the target [X, Y] anchor coordinates based on bounds and alignment modes
     */
    function computeTargetAnchor(bounds, xMode, yMode) {
        var tx = bounds.left;
        if (xMode === "center") {
            tx = bounds.left + bounds.width / 2;
        } else if (xMode === "right") {
            tx = bounds.left + bounds.width;
        }

        var ty = bounds.top;
        if (yMode === "center") {
            ty = bounds.top + bounds.height / 2;
        } else if (yMode === "bottom") {
            ty = bounds.top + bounds.height;
        }

        return [tx, ty];
    }

    // -------------------------------------------------------------------------
    // 3. Expression Generator Engine
    // -------------------------------------------------------------------------

    function getTargetXExpression(xMode) {
        if (xMode === "left") return "r.left";
        if (xMode === "right") return "r.left + r.width";
        return "r.left + r.width / 2";
    }

    function getTargetYExpression(yMode) {
        if (yMode === "top") return "r.top";
        if (yMode === "bottom") return "r.top + r.height";
        return "r.top + r.height / 2";
    }

    function buildAnchorExpression(xMode, yMode, is3D) {
        var exprX = getTargetXExpression(xMode);
        var exprY = getTargetYExpression(yMode);
        var zPart = is3D ? ", value[2]" : "";
        return "// AE Align Anchor Point (Dynamic Expression)\n" +
               "const r = sourceRectAtTime(time, false);\n" +
               "const targetX = " + exprX + ";\n" +
               "const targetY = " + exprY + ";\n" +
               "[targetX, targetY" + zPart + "];";
    }

    function buildPositionExpression(xMode, yMode, is3D) {
        var exprX = getTargetXExpression(xMode);
        var exprY = getTargetYExpression(yMode);
        var zPart = is3D ? ", (value.length > 2 ? value[2] : 0)" : "";

        return "// AE Align Anchor Point (Scale & Rotation Safe Compensator)\n" +
               "const r = sourceRectAtTime(time, false);\n" +
               "const s = [transform.scale[0] / 100, transform.scale[1] / 100];\n" +
               "const targetX = " + exprX + ";\n" +
               "const targetY = " + exprY + ";\n" +
               "const origA = transform.anchorPoint.value;\n" +
               "const dx = (targetX - origA[0]) * s[0];\n" +
               "const dy = (targetY - origA[1]) * s[1];\n" +
               "const rot = transform.rotation;\n" +
               "if (rot && Math.abs(rot) > 0.0001) {\n" +
               "    const rad = rot * (Math.PI / 180);\n" +
               "    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);\n" +
               "    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);\n" +
               "    value + [rx, ry" + zPart + "];\n" +
               "} else {\n" +
               "    value + [dx, dy" + zPart + "];\n" +
               "}";
    }

    // -------------------------------------------------------------------------
    // 4. Vector Crosshair Child Indicator Builder
    // -------------------------------------------------------------------------

    var COLOR_PRESETS = {
        "Cyan":   [0.0, 0.95, 0.95],
        "Red":    [1.0, 0.25, 0.25],
        "Yellow": [1.0, 0.85, 0.15],
        "Green":  [0.2, 0.90, 0.40],
        "White":  [1.0, 1.0, 1.0]
    };

    /**
     * Creates or updates a vector cross shape layer parented to targetLayer at [0, 0]
     */
    function attachAnchorCross(comp, targetLayer, crossSize, isGuide, colorName) {
        if (!comp || !targetLayer) return null;
        crossSize = Number(crossSize) || 30;
        var strokeW = Math.max(2, Math.round(crossSize / 15));
        var col = COLOR_PRESETS[colorName] || COLOR_PRESETS["Cyan"];
        var crossName = "Anchor_Cross_" + targetLayer.name;

        // Check if an anchor cross already exists for this layer
        var crossLayer = null;
        var numL = (typeof comp.numLayers === "number") ? comp.numLayers : comp.layers.length;
        for (var i = 1; i <= numL; i++) {
            var candidate = (typeof comp.layer === "function") ? comp.layer(i) : (comp.layers[i] || comp.layers[i - 1]);
            if (candidate && candidate.parent === targetLayer &&
               (candidate.name === crossName || candidate.name === "Anchor_Cross" || candidate.name.indexOf("Anchor_Cross_") === 0)) {
                crossLayer = candidate;
                break;
            }
        }

        if (!crossLayer) {
            crossLayer = comp.layers.addShape();
            crossLayer.name = crossName;
        }

        crossLayer.parent = null; // Unparent momentarily during setup

        // Clear previous vector contents
        var contents = crossLayer.property("Contents") || crossLayer.property("ADBE Root Vectors Group");
        while (contents && contents.numProperties > 0) {
            contents.property(1).remove();
        }

        // Build procedural crosshair vector group
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Crosshair Shapes";
        var grpContents = grp.property("Contents");

        // 1. Horizontal Bar
        var rectH = grpContents.addProperty("ADBE Vector Shape - Rect");
        rectH.name = "Horizontal Bar";
        rectH.property("Size").setValue([crossSize, strokeW]);
        rectH.property("Position").setValue([0, 0]);

        // 2. Vertical Bar
        var rectV = grpContents.addProperty("ADBE Vector Shape - Rect");
        rectV.name = "Vertical Bar";
        rectV.property("Size").setValue([strokeW, crossSize]);
        rectV.property("Position").setValue([0, 0]);

        // 3. Center Dot Ring
        var dot = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        dot.name = "Center Pivot Dot";
        dot.property("Size").setValue([strokeW * 2.8, strokeW * 2.8]);
        dot.property("Position").setValue([0, 0]);

        // 4. Fill Color
        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(col);

        // Properties & Transform
        crossLayer.guideLayer = Boolean(isGuide);
        crossLayer.threeDLayer = Boolean(targetLayer.threeDLayer);
        crossLayer.label = 14; // Cyan label in AE

        // Child position is ALWAYS locked to [0, 0]
        var is3D = targetLayer.threeDLayer;
        crossLayer.transform.anchorPoint.setValue(is3D ? [0, 0, 0] : [0, 0]);
        crossLayer.transform.position.setValue(is3D ? [0, 0, 0] : [0, 0]);
        crossLayer.transform.scale.setValue(is3D ? [100, 100, 100] : [100, 100]);
        if (crossLayer.transform.rotation) crossLayer.transform.rotation.setValue(0);

        // Link as child layer!
        crossLayer.parent = targetLayer;
        crossLayer.moveBefore(targetLayer); // Place visually right above target in timeline

        return crossLayer;
    }

    /**
     * Removes any existing anchor cross layers linked to targetLayer
     */
    function removeAnchorCross(comp, targetLayer) {
        if (!comp || !targetLayer) return 0;
        var removed = 0;
        var numL = (typeof comp.numLayers === "number") ? comp.numLayers : comp.layers.length;
        for (var i = numL; i >= 1; i--) {
            var lyr = (typeof comp.layer === "function") ? comp.layer(i) : (comp.layers[i] || comp.layers[i - 1]);
            if (lyr && lyr.parent === targetLayer &&
               (lyr.name.indexOf("Anchor_Cross_") === 0 || lyr.name === "Anchor_Cross")) {
                lyr.remove();
                removed++;
            }
        }
        return removed;
    }

    // -------------------------------------------------------------------------
    // 5. Core Alignment Execution Logic
    // -------------------------------------------------------------------------

    function alignLayerAnchorPoint(layer, xMode, yMode, useExpressions, createCross, isGuide, crossSize, crossColor) {
        if (!layer) return false;
        var comp = layer.containingComp;
        var curTime = comp ? comp.time : 0;
        var is3D = Boolean(layer.threeDLayer);

        var bounds = getLayerBounds(layer, curTime);
        var targetA = computeTargetAnchor(bounds, xMode, yMode);

        var apProp = layer.property("Transform").property("Anchor Point");
        var posProp = layer.property("Transform").property("Position");
        var scaleProp = layer.property("Transform").property("Scale");
        var rotProp = layer.property("Transform").property("Rotation") || layer.property("Transform").property("Z Rotation");

        var curA = apProp.value;
        var curPos = posProp.value;
        var curScale = scaleProp ? scaleProp.value : [100, 100];
        var curRot = rotProp ? (rotProp.value || 0) : 0;

        var sx = (curScale[0] || 100) / 100;
        var sy = (curScale[1] || 100) / 100;
        var deltaAx = targetA[0] - curA[0];
        var deltaAy = targetA[1] - curA[1];

        if (useExpressions) {
            // --- Dynamic Expression Mode ---
            var aExpr = buildAnchorExpression(xMode, yMode, is3D);
            var pExpr = buildPositionExpression(xMode, yMode, is3D);

            apProp.expression = aExpr;
            posProp.expression = pExpr;
        } else {
            // --- One-Time Static Bake Mode ---
            // Calculate exact position compensation: R * S * deltaA
            var sdx = deltaAx * sx;
            var sdy = deltaAy * sy;
            var pDeltaX = sdx;
            var pDeltaY = sdy;

            if (curRot && Math.abs(curRot) > 0.0001) {
                var rad = curRot * (Math.PI / 180);
                pDeltaX = sdx * Math.cos(rad) - sdy * Math.sin(rad);
                pDeltaY = sdx * Math.sin(rad) + sdy * Math.cos(rad);
            }

            // Remove expressions if any existed previously
            try { apProp.expression = ""; } catch (eAE) {}
            try { posProp.expression = ""; } catch (ePE) {}

            // Set new anchor point
            if (is3D) {
                apProp.setValue([targetA[0], targetA[1], curA[2] || 0]);
            } else {
                apProp.setValue([targetA[0], targetA[1]]);
            }

            // Set compensated position
            if (posProp.dimensionsSeparated) {
                var xP = layer.property("Transform").property("X Position");
                var yP = layer.property("Transform").property("Y Position");
                if (xP) xP.setValue(xP.value + pDeltaX);
                if (yP) yP.setValue(yP.value + pDeltaY);
            } else {
                if (is3D) {
                    posProp.setValue([curPos[0] + pDeltaX, curPos[1] + pDeltaY, curPos[2] || 0]);
                } else {
                    posProp.setValue([curPos[0] + pDeltaX, curPos[1] + pDeltaY]);
                }
            }
        }

        // Handle Anchor Cross Indicator Child Layer
        if (createCross) {
            attachAnchorCross(comp, layer, crossSize, isGuide, crossColor);
        }

        return true;
    }

    // -------------------------------------------------------------------------
    // 6. Interactive Demo Composition Generator
    // -------------------------------------------------------------------------

    function createDemoComposition() {
        var comp = app.project.items.addComp("Anchor Point Demo", 1920, 1080, 1, 10, 30);
        if (typeof comp.openInViewer === "function") {
            comp.openInViewer();
        }

        // 1. Dark Background Plate
        var bg = comp.layers.addShape();
        bg.name = "Background_Plate";
        var bgGrp = bg.property("Contents").addProperty("ADBE Vector Group");
        var bgRect = bgGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
        bgRect.property("Size").setValue([1920, 1080]);
        var bgFill = bgGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
        bgFill.property("Color").setValue([0.07, 0.08, 0.11]);

        // 2. Demo Box Text Layer
        var sampleText = "AE ALIGN ANCHOR POINT\nZero-shift live expressions dynamically anchor text to bounding boxes.";
        var textLayer;
        if (typeof comp.layers.addBoxText === "function") {
            try {
                textLayer = comp.layers.addBoxText([540, 160], sampleText);
            } catch (eB) {
                textLayer = comp.layers.addText(sampleText);
            }
        } else {
            textLayer = comp.layers.addText(sampleText);
        }
        textLayer.name = "Demo_Box_Text";
        textLayer.transform.position.setValue([250, 220, 0]);
        var tDoc = textLayer.property("Source Text").value;
        if (tDoc) {
            tDoc.fontSize = 24;
            tDoc.font = "Arial-BoldMT";
            tDoc.fillColor = [1.0, 1.0, 1.0];
            textLayer.property("Source Text").setValue(tDoc);
        }

        // 3. Demo Vector Shape Layer (Rounded Card)
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = "Demo_Vector_Shape";
        shapeLayer.transform.position.setValue([1100, 280, 0]);
        var sGrp = shapeLayer.property("Contents").addProperty("ADBE Vector Group");
        var sRect = sGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
        sRect.property("Size").setValue([420, 240]);
        sRect.property("Roundness").setValue(28);
        var sFill = sGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
        sFill.property("Color").setValue([0.18, 0.45, 0.90]);
        var sStroke = sGrp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
        sStroke.property("Color").setValue([1.0, 1.0, 1.0]);
        sStroke.property("Stroke Width").setValue(3);

        // 4. Demo Solid / AVLayer
        var solidLayer = comp.layers.addSolid([0.95, 0.40, 0.15], "Demo_Solid_Card", 360, 220, 1);
        solidLayer.transform.position.setValue([450, 680, 0]);

        // 5. Demo Nested Precomposition
        var precompItem = app.project.items.addComp("Inner Precomp Item", 400, 220, 1, 10, 30);
        var pBg = precompItem.layers.addShape();
        pBg.name = "Precomp_Bg";
        var pGrp = pBg.property("Contents").addProperty("ADBE Vector Group");
        var pRect = pGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
        pRect.property("Size").setValue([380, 200]);
        pRect.property("Roundness").setValue(16);
        var pFill = pGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
        pFill.property("Color").setValue([0.16, 0.70, 0.50]);

        var precompLayer = comp.layers.add(precompItem);
        precompLayer.name = "Demo_Precomp_Layer";
        precompLayer.transform.position.setValue([1100, 680, 0]);

        // Select the text layer by default
        textLayer.selected = true;

        if (typeof comp.openInViewer === "function") {
            comp.openInViewer();
        }

        return comp;
    }

    // -------------------------------------------------------------------------
    // 7. ScriptUI Panel Architecture (matching AE_Text_Precomp.jsx)
    // -------------------------------------------------------------------------

    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, { resizeable: true });

    if (!(thisObj instanceof Panel)) {
        win.text = SCRIPT_NAME + " " + SCRIPT_VERSION;
    }

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 12;

    // --- Header Panel ---
    var pnlHeader = win.add("panel", undefined, SCRIPT_NAME + " " + SCRIPT_VERSION);
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.spacing = 4;
    pnlHeader.margins = [12, 10, 12, 10];

    var lblSubTitle = pnlHeader.add("statictext", undefined, "Zero-Shift Anchor Point Aligner with Dynamic Expressions & Vector Crosshair");
    try {
        lblSubTitle.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.70, 0.95, 1], 1);
    } catch (ePen) {}

    var lblRef = pnlHeader.add("statictext", undefined, "Mechanics: sourceRectAtTime scale-safe expression linking");
    lblRef.helpTip = README_URL;

    // --- Layer Detection & Status Panel ---
    var pnlDetect = win.add("panel", undefined, "Target Selection");
    pnlDetect.orientation = "column";
    pnlDetect.alignChildren = ["fill", "top"];
    pnlDetect.spacing = 6;
    pnlDetect.margins = 10;

    var grpStatus = pnlDetect.add("group");
    grpStatus.orientation = "row";
    grpStatus.alignment = ["fill", "top"];
    var lblStatusIcon = grpStatus.add("statictext", undefined, "[Layer]:");
    lblStatusIcon.preferredSize = [55, -1];
    var lblStatusText = grpStatus.add("statictext", undefined, "Scanning active selection...");
    lblStatusText.alignment = ["fill", "center"];

    var btnRefresh = grpStatus.add("button", undefined, "Refresh");
    btnRefresh.preferredSize = [70, 22];

    // --- Horizontal Alignment (X) Panel ---
    var pnlAlignX = win.add("panel", undefined, "Horizontal Alignment (X)");
    pnlAlignX.orientation = "row";
    pnlAlignX.alignChildren = ["center", "center"];
    pnlAlignX.spacing = 15;
    pnlAlignX.margins = [10, 10, 10, 10];

    var rbXLeft = pnlAlignX.add("radiobutton", undefined, "Left Edge");
    var rbXCenter = pnlAlignX.add("radiobutton", undefined, "Center");
    var rbXRight = pnlAlignX.add("radiobutton", undefined, "Right Edge");
    rbXLeft.value = true; // Default to Left

    // --- Vertical Alignment (Y) Panel ---
    var pnlAlignY = win.add("panel", undefined, "Vertical Alignment (Y)");
    pnlAlignY.orientation = "row";
    pnlAlignY.alignChildren = ["center", "center"];
    pnlAlignY.spacing = 15;
    pnlAlignY.margins = [10, 10, 10, 10];

    var rbYTop = pnlAlignY.add("radiobutton", undefined, "Top Edge");
    var rbYCenter = pnlAlignY.add("radiobutton", undefined, "Center");
    var rbYBottom = pnlAlignY.add("radiobutton", undefined, "Bottom Edge");
    rbYTop.value = true; // Default to Top

    // --- 3x3 Visual Preset Grid Panel ---
    var pnlGrid = win.add("panel", undefined, "Quick 9-Point Presets (Visual Matrix)");
    pnlGrid.orientation = "column";
    pnlGrid.alignChildren = ["center", "center"];
    pnlGrid.spacing = 4;
    pnlGrid.margins = [10, 8, 10, 8];

    var gridRow1 = pnlGrid.add("group");
    gridRow1.orientation = "row";
    gridRow1.spacing = 4;
    var btnTL = gridRow1.add("button", undefined, "Top-Left");
    var btnTC = gridRow1.add("button", undefined, "Top-Center");
    var btnTR = gridRow1.add("button", undefined, "Top-Right");
    btnTL.preferredSize = [100, 24]; btnTC.preferredSize = [100, 24]; btnTR.preferredSize = [100, 24];

    var gridRow2 = pnlGrid.add("group");
    gridRow2.orientation = "row";
    gridRow2.spacing = 4;
    var btnML = gridRow2.add("button", undefined, "Mid-Left");
    var btnMC = gridRow2.add("button", undefined, "Center");
    var btnMR = gridRow2.add("button", undefined, "Mid-Right");
    btnML.preferredSize = [100, 24]; btnMC.preferredSize = [100, 24]; btnMR.preferredSize = [100, 24];

    var gridRow3 = pnlGrid.add("group");
    gridRow3.orientation = "row";
    gridRow3.spacing = 4;
    var btnBL = gridRow3.add("button", undefined, "Bot-Left");
    var btnBC = gridRow3.add("button", undefined, "Bot-Center");
    var btnBR = gridRow3.add("button", undefined, "Bot-Right");
    btnBL.preferredSize = [100, 24]; btnBC.preferredSize = [100, 24]; btnBR.preferredSize = [100, 24];

    function setAlignSelection(xMode, yMode) {
        rbXLeft.value = (xMode === "left");
        rbXCenter.value = (xMode === "center");
        rbXRight.value = (xMode === "right");

        rbYTop.value = (yMode === "top");
        rbYCenter.value = (yMode === "center");
        rbYBottom.value = (yMode === "bottom");
    }

    btnTL.onClick = function() { setAlignSelection("left", "top"); executeAlignment(); };
    btnTC.onClick = function() { setAlignSelection("center", "top"); executeAlignment(); };
    btnTR.onClick = function() { setAlignSelection("right", "top"); executeAlignment(); };

    btnML.onClick = function() { setAlignSelection("left", "center"); executeAlignment(); };
    btnMC.onClick = function() { setAlignSelection("center", "center"); executeAlignment(); };
    btnMR.onClick = function() { setAlignSelection("right", "center"); executeAlignment(); };

    btnBL.onClick = function() { setAlignSelection("left", "bottom"); executeAlignment(); };
    btnBC.onClick = function() { setAlignSelection("center", "bottom"); executeAlignment(); };
    btnBR.onClick = function() { setAlignSelection("right", "bottom"); executeAlignment(); };

    // --- Vector Cross Indicator Options Panel ---
    var pnlCross = win.add("panel", undefined, "Anchor Cross Indicator (Child Layer at [0, 0])");
    pnlCross.orientation = "column";
    pnlCross.alignChildren = ["fill", "top"];
    pnlCross.spacing = 6;
    pnlCross.margins = 10;

    var grpCrossChecks = pnlCross.add("group");
    grpCrossChecks.orientation = "row";
    grpCrossChecks.alignment = ["fill", "top"];
    var chkAddCross = grpCrossChecks.add("checkbox", undefined, "Add Vector Cross Child at [0, 0]");
    chkAddCross.value = true;
    chkAddCross.helpTip = "Creates a vector crosshair parented to the target layer locked at position [0, 0] to indicate the anchor point.";

    var chkGuide = grpCrossChecks.add("checkbox", undefined, "Guide Layer (Exclude from Render)");
    chkGuide.value = true;
    chkGuide.helpTip = "Sets the indicator layer as an AE Guide Layer so it never appears in output renders.";

    var grpCrossProps = pnlCross.add("group");
    grpCrossProps.orientation = "row";
    grpCrossProps.alignment = ["fill", "top"];
    grpCrossProps.spacing = 10;

    grpCrossProps.add("statictext", undefined, "Cross Size (px):");
    var txtCrossSize = grpCrossProps.add("edittext", undefined, "30");
    txtCrossSize.preferredSize = [45, 20];

    grpCrossProps.add("statictext", undefined, "Color:");
    var ddlColor = grpCrossProps.add("dropdownlist", undefined, ["Cyan", "Red", "Yellow", "Green", "White"]);
    ddlColor.selection = 0;
    ddlColor.preferredSize = [90, 20];

    // --- Execution Mode Panel ---
    var pnlMode = win.add("panel", undefined, "Execution Engine");
    pnlMode.orientation = "row";
    pnlMode.alignChildren = ["center", "center"];
    pnlMode.spacing = 20;
    pnlMode.margins = [10, 8, 10, 8];

    var rbModeExpr = pnlMode.add("radiobutton", undefined, "Dynamic Expressions (Live Updates)");
    rbModeExpr.value = true;
    rbModeExpr.helpTip = "Applies linked sourceRectAtTime expressions so resizing, typing text, or scaling dynamically maintains anchor point alignment.";

    var rbModeBake = pnlMode.add("radiobutton", undefined, "One-Time Static Bake (No Expressions)");
    rbModeBake.helpTip = "Calculates exact compensation once and sets static numeric values on Anchor Point and Position without running expressions.";

    // --- Main Action Buttons ---
    var grpActions = win.add("group");
    grpActions.orientation = "column";
    grpActions.alignChildren = ["fill", "top"];
    grpActions.spacing = 6;

    var btnAlign = grpActions.add("button", undefined, "⚓ Align Anchor Point (Zero Visual Shift)");
    btnAlign.preferredSize = [-1, 34];

    var grpSecondary = grpActions.add("group");
    grpSecondary.orientation = "row";
    grpSecondary.alignment = ["fill", "top"];
    grpSecondary.spacing = 6;

    var btnRemove = grpSecondary.add("button", undefined, "✕ Remove Crosshairs & Expressions");
    btnRemove.alignment = ["fill", "center"];

    var btnDemo = grpSecondary.add("button", undefined, "➕ Create Demo Comp");
    btnDemo.alignment = ["fill", "center"];

    // --- Feedback Label ---
    var lblFeedback = win.add("statictext", undefined, "Ready. Select a layer or click 'Create Demo Comp'.");
    lblFeedback.alignment = ["fill", "bottom"];

    // --- Link Footer (matching AE_Text_Precomp.jsx) ---
    var grpFooter = win.add("group");
    grpFooter.orientation = "row";
    grpFooter.alignment = ["fill", "bottom"];
    grpFooter.alignChildren = ["center", "center"];
    grpFooter.margins = [0, 4, 0, 0];

    var lblRepo = grpFooter.add("statictext", undefined, "GitHub: work2survive/AE_JS_builder");
    lblRepo.helpTip = REPO_URL;
    lblRepo.onClick = function() {
        if (typeof window !== "undefined" && window.open) {
            window.open(REPO_URL, "_blank");
        } else if ($.os && $.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + REPO_URL + '"');
        } else if (typeof system !== "undefined" && system.callSystem) {
            system.callSystem('open "' + REPO_URL + '"');
        }
    };

    // -------------------------------------------------------------------------
    // 8. Event Handlers & Orchestration
    // -------------------------------------------------------------------------

    function getSelectedXMode() {
        if (rbXRight.value) return "right";
        if (rbXCenter.value) return "center";
        return "left";
    }

    function getSelectedYMode() {
        if (rbYBottom.value) return "bottom";
        if (rbYCenter.value) return "center";
        return "top";
    }

    function syncLayerDetection() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            lblStatusText.text = "No active composition found.";
            return;
        }

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            lblStatusText.text = "No layer selected in '" + comp.name + "' (" + comp.layers.length + " layers total).";
            return;
        }

        if (sel.length === 1) {
            var lyr = sel[0];
            var typeName = "Layer";
            if (lyr instanceof TextLayer || lyr.property("ADBE Text Properties")) typeName = "Text Layer";
            else if (lyr instanceof ShapeLayer || lyr.property("Contents")) typeName = "Shape Layer";
            else if (lyr.source && lyr.source instanceof CompItem) typeName = "Precomp Layer";
            else if (lyr.source) typeName = "Solid / Footage";

            var curA = lyr.transform.anchorPoint.value || [0, 0];
            var ax = Math.round(curA[0] * 10) / 10;
            var ay = Math.round(curA[1] * 10) / 10;
            lblStatusText.text = "'" + lyr.name + "' [" + typeName + ", Anchor: " + ax + ", " + ay + "]";
        } else {
            lblStatusText.text = sel.length + " layers selected in '" + comp.name + "'.";
        }
    }

    function executeAlignment() {
        if (app.beginUndoGroup) app.beginUndoGroup("AE Align Anchor Point");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                // If no active comp, automatically create demo composition
                comp = createDemoComposition();
                syncLayerDetection();
            }

            var sel = comp.selectedLayers;
            if (!sel || sel.length === 0) {
                // If nothing selected, align the first non-cross layer
                var numL = (typeof comp.numLayers === "number") ? comp.numLayers : comp.layers.length;
                for (var l = 1; l <= numL; l++) {
                    var candidate = (typeof comp.layer === "function") ? comp.layer(l) : (comp.layers[l] || comp.layers[l - 1]);
                    if (candidate && candidate.name.indexOf("Anchor_Cross_") !== 0 && candidate.name !== "Background_Plate") {
                        candidate.selected = true;
                        sel = [candidate];
                        break;
                    }
                }
            }

            if (!sel || sel.length === 0) {
                alert("Please select at least one layer to align its anchor point.");
                return;
            }

            var xMode = getSelectedXMode();
            var yMode = getSelectedYMode();
            var useExpr = rbModeExpr.value;
            var addCross = chkAddCross.value;
            var isGuide = chkGuide.value;
            var crossSz = parseFloat(txtCrossSize.text) || 30;
            var crossCol = ddlColor.selection ? ddlColor.selection.text : "Cyan";

            var count = 0;
            for (var i = 0; i < sel.length; i++) {
                var layer = sel[i];
                if (!layer || layer.name.indexOf("Anchor_Cross_") === 0) continue;
                alignLayerAnchorPoint(layer, xMode, yMode, useExpr, addCross, isGuide, crossSz, crossCol);
                count++;
            }

            syncLayerDetection();
            var alignStr = xMode.toUpperCase() + "-" + yMode.toUpperCase();
            var modeStr = useExpr ? "Dynamic Expressions" : "Static Bake";
            lblFeedback.text = "Aligned " + count + " layer(s) to " + alignStr + " via " + modeStr + ". Cross locked at [0, 0].";
        } catch (err) {
            alert("Error aligning anchor point:\n" + (err.message || err.toString()));
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    }

    btnAlign.onClick = function() {
        executeAlignment();
    };

    btnRefresh.onClick = function() {
        syncLayerDetection();
    };

    btnDemo.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("Create Demo Comp");
        try {
            createDemoComposition();
            syncLayerDetection();
            lblFeedback.text = "Created 'Anchor Point Demo' comp with Box Text, Vector Shape, Solid, and Precomp.";
        } catch (eDemo) {
            alert("Error creating demo comp:\n" + eDemo.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    btnRemove.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("Remove Anchor Crosshairs & Expressions");
        try {
            var comp = app.project.activeItem;
            if (!comp) return;
            var sel = comp.selectedLayers;
            var removedCount = 0;

            if (sel && sel.length > 0) {
                for (var s = 0; s < sel.length; s++) {
                    var sLyr = sel[s];
                    if (!sLyr) continue;
                    removedCount += removeAnchorCross(comp, sLyr);
                    try { sLyr.transform.anchorPoint.expression = ""; } catch (eA) {}
                    try { sLyr.transform.position.expression = ""; } catch (eP) {}
                }
            } else {
                var totalL = (typeof comp.numLayers === "number") ? comp.numLayers : comp.layers.length;
                for (var i = totalL; i >= 1; i--) {
                    var lyr = (typeof comp.layer === "function") ? comp.layer(i) : (comp.layers[i] || comp.layers[i - 1]);
                    if (!lyr) continue;
                    removedCount += removeAnchorCross(comp, lyr);
                    try { lyr.transform.anchorPoint.expression = ""; } catch (eA2) {}
                    try { lyr.transform.position.expression = ""; } catch (eP2) {}
                }
            }

            lblFeedback.text = "Cleaned up " + removedCount + " crosshair layer(s) and cleared expressions.";
        } catch (eRem) {
            alert("Error removing crosshairs:\n" + eRem.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    // Initial check
    syncLayerDetection();

    // Expose programmatic hooks on win object
    win.btnDemo = btnDemo;
    win.btnAlign = btnAlign;
    win.btnTL = btnTL;
    win.btnTC = btnTC;
    win.btnTR = btnTR;
    win.btnML = btnML;
    win.btnMC = btnMC;
    win.btnMR = btnMR;
    win.btnBL = btnBL;
    win.btnBC = btnBC;
    win.btnBR = btnBR;
    win.btnRemove = btnRemove;
    win.executeAlignment = executeAlignment;
    win.createDemoComposition = createDemoComposition;
    win.syncLayerDetection = syncLayerDetection;

    win.layout.layout(true);
    win.onResizing = win.onResize = function() { this.layout.resize(); };

    if (win instanceof Window) {
        win.center();
        win.show();
    }
    return win;
})(this);
