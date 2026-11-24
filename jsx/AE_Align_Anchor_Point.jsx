// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE ALIGN ANCHOR POINT v1.2.0
// =============================================================================
//
// PURPOSE:
//   Aligns the anchor point of any comp, text box (point or paragraph), shape/vector
//   layer, solid, footage, or null to Left, Center, or Right (X) and
//   Top, Center, or Bottom (Y) WITHOUT shifting the layer's visual content on screen.
//
// KEY MECHANICS:
//   1. Zero-Shift Content Invariance:
//      - Keeps layer content visually locked in place using scale-safe and rotation-safe
//        position compensation formulas.
//   2. Dynamic Expression Linking (Universal Compatibility):
//      - Supports both sourceRectAtTime(time, false) and Stated Width & Height methods.
//      - Anchor Point Expression:
//          const r = sourceRectAtTime(time, false);
//          [r.left, r.top]; // for Top-Left
//      - Position Expression (Scale-Safe):
//          const r = sourceRectAtTime(time, false);
//          const s = [transform.scale[0] / 100, transform.scale[1] / 100];
//          const targetX = r.left;
//          const targetY = r.top;
//          const origA = transform.anchorPoint.value;
//          value + [(targetX - origA[0]) * s[0], (targetY - origA[1]) * s[1]];
//   3. Stated Width & Height Option:
//      - Uses declared box text width/height, solid size, or precomp dimensions.
//   4. Vector Cross Indicator Child Layer:
//      - Shape layer linked as a child layer with position [0, 0] and anchor point [0, 0].
//      - Guideline layer (guideLayer = true) visible in working viewport, non-renderable in exports.
//   5. State Storage Effect:
//      - Attaches "Anchor Alignment State" effect controls (Align X, Align Y, Bounds Mode)
//        on the target layer storing exact alignment status.
//   6. Intelligent Dummy Text Box Creation & Live Updating:
//      - If nothing is selected, creates a dummy text box in the center of the viewport.
//      - If a layer is already selected, immediately updates it with the new alignment.
//
// REPOSITORY:
//   https://github.com/work2survive/AE-Align-AnchorPoint
//
// LIVE DEMO:
//   https://work2survive.github.io/AE_JS_builder/?jsx=AE_Align_Anchor_Point.jsx&autobuild=true
//
// DOCUMENTATION & MECHANICS:
//   https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_NAME = "AE Align Anchor Point";
    var SCRIPT_VERSION = "v1.2.0";
    var REPO_URL = "https://github.com/work2survive/AE-Align-AnchorPoint";
    var README_URL = "https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md";

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
     * Obtains the dynamic bounding box via sourceRectAtTime(time, false)
     */
    function getLayerSourceRectBounds(layer, compTime) {
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

        // 4. Precomp, Solid, Footage fallback
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

        var cW = (layer.containingComp && layer.containingComp.width) ? layer.containingComp.width : 1920;
        var cH = (layer.containingComp && layer.containingComp.height) ? layer.containingComp.height : 1080;
        return { left: 0, top: 0, width: cW, height: cH };
    }

    /**
     * Obtains stated / nominal dimensions (declared box text width/height, solid size, or precomp dimensions)
     */
    function getLayerStatedBounds(layer) {
        if (!layer) return { left: 0, top: 0, width: 100, height: 100 };

        // 1. Text Layer (Box Text stated size)
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
        } catch (eBox) {}

        // 2. Precomp or Footage
        if (layer.source && typeof layer.source.width === "number" && typeof layer.source.height === "number") {
            return {
                left: 0,
                top: 0,
                width: layer.source.width,
                height: layer.source.height
            };
        }

        // 3. Solid or Stated Layer Width/Height
        if (typeof layer.width === "number" && typeof layer.height === "number" && layer.width > 0 && layer.height > 0) {
            return {
                left: 0,
                top: 0,
                width: layer.width,
                height: layer.height
            };
        }

        // 4. Shape Layer Stated Rectangle Size
        try {
            var contents = layer.property("Contents") || layer.property("ADBE Root Vectors Group");
            if (contents && contents.numProperties > 0) {
                for (var i = 1; i <= contents.numProperties; i++) {
                    var grp = contents.property(i);
                    var gContents = grp.property ? (grp.property("Contents") || grp) : null;
                    if (gContents) {
                        for (var j = 1; j <= gContents.numProperties; j++) {
                            var p = gContents.property(j);
                            if (p && (p.matchName === "ADBE Vector Shape - Rect" || p.name === "Rectangle Path 1")) {
                                var szP = p.property("Size") || p.property("ADBE Vector Rect Size");
                                if (szP && szP.value) {
                                    return {
                                        left: -szP.value[0] / 2,
                                        top: -szP.value[1] / 2,
                                        width: szP.value[0],
                                        height: szP.value[1]
                                    };
                                }
                            }
                        }
                    }
                }
            }
        } catch (eShp) {}

        // 5. Fallback to sourceRectAtTime
        return getLayerSourceRectBounds(layer, 0);
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
    // 3. Expression Generator Engine (sourceRect vs Stated Dimensions)
    // -------------------------------------------------------------------------

    function getTargetXExpression(xMode, boundsMethod) {
        if (boundsMethod === "stated") {
            if (xMode === "left") return "bLeft";
            if (xMode === "right") return "bLeft + bW";
            return "bLeft + bW / 2";
        }
        if (xMode === "left") return "r.left";
        if (xMode === "right") return "r.left + r.width";
        return "r.left + r.width / 2";
    }

    function getTargetYExpression(yMode, boundsMethod) {
        if (boundsMethod === "stated") {
            if (yMode === "top") return "bTop";
            if (yMode === "bottom") return "bTop + bH";
            return "bTop + bH / 2";
        }
        if (yMode === "top") return "r.top";
        if (yMode === "bottom") return "r.top + r.height";
        return "r.top + r.height / 2";
    }

    function buildAnchorExpression(xMode, yMode, boundsMethod, is3D) {
        var zPart = is3D ? ", value[2]" : "";
        if (boundsMethod === "stated") {
            var exprXStated = getTargetXExpression(xMode, "stated");
            var exprYStated = getTargetYExpression(yMode, "stated");
            return "// AE Align Anchor Point (Stated Dimensions)\n" +
                   "let bLeft = 0, bTop = 0, bW = thisLayer.width, bH = thisLayer.height;\n" +
                   "try {\n" +
                   "    const rawDoc = thisLayer.text ? thisLayer.text.sourceText : thisLayer.sourceText;\n" +
                   "    const sDoc = (rawDoc && rawDoc.value) ? rawDoc.value : rawDoc;\n" +
                   "    if (sDoc && sDoc.boxText && sDoc.boxTextSize) {\n" +
                   "        bW = sDoc.boxTextSize[0];\n" +
                   "        bH = sDoc.boxTextSize[1];\n" +
                   "        if (sDoc.boxTextPos) { bLeft = sDoc.boxTextPos[0]; bTop = sDoc.boxTextPos[1]; }\n" +
                   "    } else if (thisLayer.boxTextSize) {\n" +
                   "        bW = thisLayer.boxTextSize[0];\n" +
                   "        bH = thisLayer.boxTextSize[1];\n" +
                   "    }\n" +
                   "} catch(e) {}\n" +
                   "const targetX = " + exprXStated + ";\n" +
                   "const targetY = " + exprYStated + ";\n" +
                   "[targetX, targetY" + zPart + "];";
        }

        var exprX = getTargetXExpression(xMode, "sourceRect");
        var exprY = getTargetYExpression(yMode, "sourceRect");
        return "// AE Align Anchor Point (Dynamic sourceRectAtTime)\n" +
               "const r = sourceRectAtTime(time, false);\n" +
               "const targetX = " + exprX + ";\n" +
               "const targetY = " + exprY + ";\n" +
               "[targetX, targetY" + zPart + "];";
    }

    function buildPositionExpression(xMode, yMode, boundsMethod, is3D, baseA) {
        var zPart = is3D ? ", (value.length > 2 ? value[2] : 0)" : "";
        var baseAx = (baseA && typeof baseA[0] === "number") ? baseA[0] : 0;
        var baseAy = (baseA && typeof baseA[1] === "number") ? baseA[1] : 0;

        if (boundsMethod === "stated") {
            var exprXStated = getTargetXExpression(xMode, "stated");
            var exprYStated = getTargetYExpression(yMode, "stated");
            return "// AE Align Anchor Point (Stated Dimensions Scale-Safe Compensator)\n" +
                   "let bLeft = 0, bTop = 0, bW = thisLayer.width, bH = thisLayer.height;\n" +
                   "try {\n" +
                   "    const rawDoc = thisLayer.text ? thisLayer.text.sourceText : thisLayer.sourceText;\n" +
                   "    const sDoc = (rawDoc && rawDoc.value) ? rawDoc.value : rawDoc;\n" +
                   "    if (sDoc && sDoc.boxText && sDoc.boxTextSize) {\n" +
                   "        bW = sDoc.boxTextSize[0];\n" +
                   "        bH = sDoc.boxTextSize[1];\n" +
                   "        if (sDoc.boxTextPos) { bLeft = sDoc.boxTextPos[0]; bTop = sDoc.boxTextPos[1]; }\n" +
                   "    } else if (thisLayer.boxTextSize) {\n" +
                   "        bW = thisLayer.boxTextSize[0];\n" +
                   "        bH = thisLayer.boxTextSize[1];\n" +
                   "    }\n" +
                   "} catch(e) {}\n" +
                   "const s = [transform.scale[0] / 100, transform.scale[1] / 100];\n" +
                   "const targetX = " + exprXStated + ";\n" +
                   "const targetY = " + exprYStated + ";\n" +
                   "const origA = [" + baseAx + ", " + baseAy + "];\n" +
                   "const dx = (targetX - origA[0]) * s[0];\n" +
                   "const dy = (targetY - origA[1]) * s[1];\n" +
                   "const rot = transform.rotation;\n" +
                   "if (rot && Math.abs(rot) > 0.0001) {\n" +
                   "    const rad = rot * (Math.PI / 180);\n" +
                   "    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);\n" +
                   "    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);\n" +
                   "    [value[0] + rx, value[1] + ry" + zPart + "];\n" +
                   "} else {\n" +
                   "    [value[0] + dx, value[1] + dy" + zPart + "];\n" +
                   "}";
        }

        var exprX = getTargetXExpression(xMode, "sourceRect");
        var exprY = getTargetYExpression(yMode, "sourceRect");
        return "// AE Align Anchor Point (sourceRectAtTime Scale-Safe Compensator)\n" +
               "const r = sourceRectAtTime(time, false);\n" +
               "const s = [transform.scale[0] / 100, transform.scale[1] / 100];\n" +
               "const targetX = " + exprX + ";\n" +
               "const targetY = " + exprY + ";\n" +
               "const origA = [" + baseAx + ", " + baseAy + "];\n" +
               "const dx = (targetX - origA[0]) * s[0];\n" +
               "const dy = (targetY - origA[1]) * s[1];\n" +
               "const rot = transform.rotation;\n" +
               "if (rot && Math.abs(rot) > 0.0001) {\n" +
               "    const rad = rot * (Math.PI / 180);\n" +
               "    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);\n" +
               "    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);\n" +
               "    [value[0] + rx, value[1] + ry" + zPart + "];\n" +
               "} else {\n" +
               "    [value[0] + dx, value[1] + dy" + zPart + "];\n" +
               "}";
    }

    // -------------------------------------------------------------------------
    // 4. Alignment State Storage Effect
    // -------------------------------------------------------------------------

    var ALIGN_X_INDICES = { "left": 0, "center": 1, "right": 2 };
    var ALIGN_Y_INDICES = { "top": 0, "center": 1, "bottom": 2 };
    var BOUNDS_MODE_INDICES = { "sourceRect": 0, "stated": 1 };

    /**
     * Stores alignment state directly on targetLayer as effect slider controls
     */
    function storeAlignmentEffect(layer, xMode, yMode, boundsMethod, baseA) {
        if (!layer) return;
        try {
            var fxParade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!fxParade) return;

            var xVal = ALIGN_X_INDICES[xMode] !== undefined ? ALIGN_X_INDICES[xMode] : 0;
            var yVal = ALIGN_Y_INDICES[yMode] !== undefined ? ALIGN_Y_INDICES[yMode] : 0;
            var bVal = BOUNDS_MODE_INDICES[boundsMethod] !== undefined ? BOUNDS_MODE_INDICES[boundsMethod] : 0;

            // 1. Slider: Anchor Align X
            var effX = fxParade.property("Anchor Align X") || fxParade.addProperty("ADBE Slider Control");
            if (effX) {
                effX.name = "Anchor Align X";
                var pX = effX.property("ADBE Slider Control-0001") || effX.property(1);
                if (pX) pX.setValue(xVal);
            }

            // 2. Slider: Anchor Align Y
            var effY = fxParade.property("Anchor Align Y") || fxParade.addProperty("ADBE Slider Control");
            if (effY) {
                effY.name = "Anchor Align Y";
                var pY = effY.property("ADBE Slider Control-0001") || effY.property(1);
                if (pY) pY.setValue(yVal);
            }

            // 3. Slider: Anchor Bounds Mode
            var effB = fxParade.property("Anchor Bounds Mode") || fxParade.addProperty("ADBE Slider Control");
            if (effB) {
                effB.name = "Anchor Bounds Mode";
                var pB = effB.property("ADBE Slider Control-0001") || effB.property(1);
                if (pB) pB.setValue(bVal);
            }

            // 4. Optional Point Control: Anchor Align [X, Y]
            try {
                var effPt = fxParade.property("Anchor Align [X, Y]") || fxParade.addProperty("ADBE Point Control");
                if (effPt) {
                    effPt.name = "Anchor Align [X, Y]";
                    var pPt = effPt.property("ADBE Point Control-0001") || effPt.property(1);
                    if (pPt) pPt.setValue([xVal, yVal]);
                }
            } catch (ePt) {}

            // 5. Point Control: Anchor Base Point
            try {
                if (baseA && typeof baseA[0] === "number") {
                    var effBasePt = fxParade.property("Anchor Base Point") || fxParade.addProperty("ADBE Point Control");
                    if (effBasePt) {
                        effBasePt.name = "Anchor Base Point";
                        var pBasePt = effBasePt.property("ADBE Point Control-0001") || effBasePt.property(1);
                        if (pBasePt) pBasePt.setValue([baseA[0], baseA[1]]);
                    }
                }
            } catch (eBasePt) {}
        } catch (eStore) {}
    }

    /**
     * Reads alignment state from stored effect sliders on the layer (if present)
     */
    function readAlignmentEffect(layer) {
        if (!layer) return null;
        try {
            var fxParade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!fxParade) return null;

            var effX = fxParade.property("Anchor Align X");
            var effY = fxParade.property("Anchor Align Y");
            if (!effX || !effY) return null;

            var pX = effX.property("ADBE Slider Control-0001") || effX.property(1);
            var pY = effY.property("ADBE Slider Control-0001") || effY.property(1);
            var xVal = Math.round(pX ? pX.value : 0);
            var yVal = Math.round(pY ? pY.value : 0);

            var xModes = ["left", "center", "right"];
            var yModes = ["top", "center", "bottom"];

            var effB = fxParade.property("Anchor Bounds Mode");
            var pB = effB ? (effB.property("ADBE Slider Control-0001") || effB.property(1)) : null;
            var bVal = Math.round(pB ? pB.value : 0);
            var bModes = ["sourceRect", "stated"];

            return {
                xMode: xModes[xVal] || "left",
                yMode: yModes[yVal] || "top",
                boundsMethod: bModes[bVal] || "sourceRect"
            };
        } catch (eRead) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // 5. Vector Crosshair Child Indicator Builder
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
     * with anchor point [0, 0], marked as a guide layer (non-renderable).
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

        crossLayer.parent = null; // Unparent momentarily during vector setup

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

        // 3. Center Optical Dot
        var dot = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        dot.name = "Center Pivot Dot";
        dot.property("Size").setValue([strokeW * 3.0, strokeW * 3.0]);
        dot.property("Position").setValue([0, 0]);

        // 4. Fill Color
        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(col);

        // 5. Outer Reticle Ring Stroke (for high visibility on any background)
        var ring = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        ring.name = "Reticle Outer Ring";
        ring.property("Size").setValue([crossSize * 0.72, crossSize * 0.72]);
        ring.property("Position").setValue([0, 0]);

        var ringStroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
        ringStroke.property("Color").setValue(col);
        ringStroke.property("Stroke Width").setValue(1.5);

        // Properties & Transform
        crossLayer.guideLayer = Boolean(isGuide);
        crossLayer.threeDLayer = Boolean(targetLayer.threeDLayer);
        crossLayer.label = 14; // Cyan label in AE

        // Child position AND anchor point are ALWAYS locked to [0, 0]
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
    // 6. Core Alignment Execution Logic
    // -------------------------------------------------------------------------

    function alignLayerAnchorPoint(layer, xMode, yMode, boundsMethod, useExpressions, createCross, isGuide, crossSize, crossColor) {
        if (!layer) return false;
        var comp = layer.containingComp;
        var curTime = comp ? comp.time : 0;
        var is3D = Boolean(layer.threeDLayer);

        var bounds = (boundsMethod === "stated") ? getLayerStatedBounds(layer) : getLayerSourceRectBounds(layer, curTime);
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

        var fxParade = layer.property("ADBE Effect Parade") || layer.property("Effects");
        var effBase = fxParade ? fxParade.property("Anchor Base Point") : null;
        var baseA;
        if (effBase && effBase.property(1) && effBase.property(1).value) {
            baseA = effBase.property(1).value;
        } else if (apProp._baseValue && Array.isArray(apProp._baseValue)) {
            baseA = [apProp._baseValue[0], apProp._baseValue[1]];
        } else {
            baseA = [curA[0], curA[1]];
        }

        if (useExpressions) {
            // --- Dynamic Expression Mode ---
            var aExpr = buildAnchorExpression(xMode, yMode, boundsMethod, is3D);
            var pExpr = buildPositionExpression(xMode, yMode, boundsMethod, is3D, baseA);

            apProp.expression = aExpr;
            posProp.expression = pExpr;
        } else {
            // --- One-Time Static Bake Mode ---
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

            baseA = [targetA[0], targetA[1]];
        }

        // Store alignment status effect directly on the layer
        storeAlignmentEffect(layer, xMode, yMode, boundsMethod, baseA);

        // Handle Anchor Cross Indicator Child Layer
        if (createCross) {
            attachAnchorCross(comp, layer, crossSize, isGuide, crossColor);
        }

        return true;
    }

    // Curated diverse fonts spanning Sans-Serif, Serif, Display, Monospace, and Modern
    var DUMMY_FONTS_POOL = [
        { ps: "ArialMT", name: "Arial" },
        { ps: "Georgia", name: "Georgia" },
        { ps: "TimesNewRomanPSMT", name: "Times New Roman" },
        { ps: "TrebuchetMS", name: "Trebuchet MS" },
        { ps: "Verdana", name: "Verdana" },
        { ps: "CourierNewPSMT", name: "Courier New" },
        { ps: "Impact", name: "Impact" },
        { ps: "Tahoma", name: "Tahoma" },
        { ps: "HelveticaNeue", name: "Helvetica Neue" },
        { ps: "Helvetica", name: "Helvetica" },
        { ps: "Palatino-Roman", name: "Palatino" },
        { ps: "CenturyGothic", name: "Century Gothic" },
        { ps: "Futura-Medium", name: "Futura" },
        { ps: "GillSans", name: "Gill Sans" },
        { ps: "Avenir-Medium", name: "Avenir" }
    ];

    function getRandomFontInfo() {
        var pool = DUMMY_FONTS_POOL.slice(0);
        for (var i = pool.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = pool[i];
            pool[i] = pool[j];
            pool[j] = temp;
        }

        if (typeof app !== "undefined" && app.fonts && typeof app.fonts.getFontsByPostScriptName === "function") {
            for (var k = 0; k < pool.length; k++) {
                try {
                    var found = app.fonts.getFontsByPostScriptName(pool[k].ps);
                    if (found && found.length > 0) {
                        return { fontObject: found[0], font: pool[k].ps, name: pool[k].name };
                    }
                } catch (eFCheck) {}
            }
        }

        var pick = pool[0];
        return { fontObject: null, font: pick.ps, name: pick.name };
    }

    // Curated high-visibility, aesthetic colors for dummy text
    var DUMMY_COLORS_POOL = [
        { name: "Snow White", rgb: [0.96, 0.96, 0.98] },
        { name: "Warm Cream", rgb: [0.98, 0.94, 0.86] },
        { name: "Electric Cyan", rgb: [0.35, 0.82, 0.98] },
        { name: "Mint Aqua", rgb: [0.38, 0.94, 0.74] },
        { name: "Sun Gold", rgb: [0.98, 0.86, 0.22] },
        { name: "Pastel Coral", rgb: [0.98, 0.58, 0.50] },
        { name: "Neon Lavender", rgb: [0.76, 0.62, 0.98] },
        { name: "Spring Lime", rgb: [0.70, 0.94, 0.35] },
        { name: "Bright Amber", rgb: [0.98, 0.65, 0.25] },
        { name: "Rose Quartz", rgb: [0.98, 0.48, 0.72] }
    ];

    function getRandomTextColor() {
        return DUMMY_COLORS_POOL[Math.floor(Math.random() * DUMMY_COLORS_POOL.length)];
    }

    function getRandomJustification() {
        var aligns = [
            { key: "left", name: "Left", val: (typeof ParagraphJustification !== "undefined" && typeof ParagraphJustification.LEFT_JUSTIFY !== "undefined" ? ParagraphJustification.LEFT_JUSTIFY : 7412) },
            { key: "center", name: "Center", val: (typeof ParagraphJustification !== "undefined" && typeof ParagraphJustification.CENTER_JUSTIFY !== "undefined" ? ParagraphJustification.CENTER_JUSTIFY : 7414) },
            { key: "right", name: "Right", val: (typeof ParagraphJustification !== "undefined" && typeof ParagraphJustification.RIGHT_JUSTIFY !== "undefined" ? ParagraphJustification.RIGHT_JUSTIFY : 7413) }
        ];
        return aligns[Math.floor(Math.random() * aligns.length)];
    }

    // -------------------------------------------------------------------------
    // 7. Dummy Text Box & Demo Composition Generator
    // -------------------------------------------------------------------------

    /**
     * Creates a dummy text box centered in the viewport with randomized font, alignment, size, leading & color
     */
    function createDummyTextBox(comp) {
        if (!comp) return null;
        var centerPos = [comp.width / 2, comp.height / 2, 0];
        var baseBoxW = 460;
        var widthVariation = 0.70 + (Math.random() * 0.60); // ±30% variation (0.70 to 1.30)
        var boxW = Math.max(100, Math.round(baseBoxW * widthVariation));
        var boxH = 180;
        var dummyText = "Lorem ipsum dolor sit amet, consectetur adipiscing".substring(0, 50);

        var textLayer;
        if (typeof comp.layers.addBoxText === "function") {
            try {
                textLayer = comp.layers.addBoxText([boxW, boxH], dummyText);
            } catch (eB) {
                textLayer = comp.layers.addText(dummyText);
            }
        } else {
            textLayer = comp.layers.addText(dummyText);
        }

        // Randomize typography: font, alignment, font size (±15%), leading (±15%), and color
        var fontPick = getRandomFontInfo();
        var alignPick = getRandomJustification();
        var colorPick = getRandomTextColor();

        var baseFontSize = 24;
        var sizeFactor = 0.85 + (Math.random() * 0.30); // ±15% variation
        var randomizedFontSize = Math.round(baseFontSize * sizeFactor);

        var baseLeading = randomizedFontSize * 1.35;
        var leadingFactor = 0.85 + (Math.random() * 0.30); // ±15% variation
        var randomizedLeading = Math.round(baseLeading * leadingFactor * 10) / 10;

        textLayer.name = "Dummy Text - " + fontPick.name + " (" + alignPick.name + ", " + randomizedFontSize + "px, " + colorPick.name + ")";

        var doc = textLayer.property("Source Text").value;
        if (doc) {
            doc.fontSize = randomizedFontSize;
            if (fontPick.fontObject) {
                try { doc.fontObject = fontPick.fontObject; } catch (eFO) {}
            }
            if (fontPick.font) {
                try { doc.font = fontPick.font; } catch (eF) {}
            }
            doc.fillColor = colorPick.rgb;
            doc.applyFill = true;
            doc.applyStroke = false;
            doc.leading = randomizedLeading;
            try {
                doc.justification = alignPick.val;
            } catch (eJ) {}
            textLayer.property("Source Text").setValue(doc);
        }

        // Place in the middle of the viewport
        try {
            var sr = textLayer.sourceRectAtTime(0, false);
            var isBox = false;
            try {
                var dVal = textLayer.property("Source Text").value;
                if (dVal && dVal.boxText) isBox = true;
            } catch (eB2) {}
            if (isBox) {
                textLayer.transform.anchorPoint.setValue([boxW / 2, boxH / 2, 0]);
            } else if (sr && sr.width > 0 && sr.height > 0) {
                textLayer.transform.anchorPoint.setValue([sr.left + sr.width / 2, sr.top + sr.height / 2, 0]);
            } else {
                textLayer.transform.anchorPoint.setValue([boxW / 2, boxH / 2, 0]);
            }
        } catch (eSr) {
            textLayer.transform.anchorPoint.setValue([boxW / 2, boxH / 2, 0]);
        }
        textLayer.transform.position.setValue(centerPos);

        // Unselect all other layers, select dummy text layer
        var numL = (typeof comp.numLayers === "number") ? comp.numLayers : comp.layers.length;
        for (var i = 1; i <= numL; i++) {
            var lyr = (typeof comp.layer === "function") ? comp.layer(i) : (comp.layers[i] || comp.layers[i - 1]);
            if (lyr && lyr !== textLayer) lyr.selected = false;
        }
        textLayer.selected = true;

        return textLayer;
    }

    function createDemoComposition() {
        var comp = app.project.items.addComp("Anchor Point Demo", 1920, 1080, 1, 10, 30);

        // 1. Dark Background Plate
        var bg = comp.layers.addShape();
        bg.name = "Background_Plate";
        var bgGrp = bg.property("Contents").addProperty("ADBE Vector Group");
        var bgRect = bgGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
        bgRect.property("Size").setValue([1920, 1080]);
        var bgFill = bgGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
        bgFill.property("Color").setValue([0.07, 0.08, 0.11]);

        // 2. Demo Box Text Layer in Center of Viewport
        var textLayer = createDummyTextBox(comp);

        // 3. Demo Vector Shape Layer (Rounded Card)
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = "Demo_Vector_Shape";
        shapeLayer.transform.position.setValue([1350, 320, 0]);
        var sGrp = shapeLayer.property("Contents").addProperty("ADBE Vector Group");
        var sRect = sGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
        sRect.property("Size").setValue([380, 220]);
        sRect.property("Roundness").setValue(28);
        var sFill = sGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
        sFill.property("Color").setValue([0.18, 0.45, 0.90]);
        var sStroke = sGrp.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
        sStroke.property("Color").setValue([1.0, 1.0, 1.0]);
        sStroke.property("Stroke Width").setValue(3);

        // 4. Demo Solid / AVLayer
        var solidLayer = comp.layers.addSolid([0.95, 0.40, 0.15], "Demo_Solid_Card", 340, 200, 1);
        solidLayer.transform.position.setValue([320, 720, 0]);

        // 5. Demo Nested Precomposition
        var precompItem = app.project.items.addComp("Inner Precomp Item", 380, 200, 1, 10, 30);
        var pBg = precompItem.layers.addShape();
        pBg.name = "Precomp_Bg";
        var pGrp = pBg.property("Contents").addProperty("ADBE Vector Group");
        var pRect = pGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
        pRect.property("Size").setValue([360, 180]);
        pRect.property("Roundness").setValue(16);
        var pFill = pGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
        pFill.property("Color").setValue([0.16, 0.70, 0.50]);

        var precompLayer = comp.layers.add(precompItem);
        precompLayer.name = "Demo_Precomp_Layer";
        precompLayer.transform.position.setValue([1350, 720, 0]);

        // Keep text layer selected in center
        textLayer.selected = true;

        if (typeof comp.openInViewer === "function") {
            comp.openInViewer();
        }

        return comp;
    }

    // -------------------------------------------------------------------------
    // 8. ScriptUI Panel Architecture (matching AE_Text_Precomp.jsx)
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

    var lblSubTitle = pnlHeader.add("statictext", undefined, "Zero-Shift Anchor Aligner with State Effect, Crosshair Reticle & Auto Text Box");
    try {
        lblSubTitle.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.70, 0.95, 1], 1);
    } catch (ePen) {}

    var lblRef = pnlHeader.add("statictext", undefined, "Mechanics: sourceRectAtTime vs Stated Dimensions scale-safe linking");
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
    var lblStatusIcon = grpStatus.add("statictext", undefined, "[Target]:");
    lblStatusIcon.preferredSize = [60, -1];
    var lblStatusText = grpStatus.add("statictext", undefined, "Scanning active selection...");
    lblStatusText.alignment = ["fill", "center"];

    var btnRefresh = grpStatus.add("button", undefined, "Refresh");
    btnRefresh.preferredSize = [70, 22];

    // --- Bounds Calculation Engine Panel ---
    var pnlBoundsMethod = win.add("panel", undefined, "Bounds Calculation Method");
    pnlBoundsMethod.orientation = "row";
    pnlBoundsMethod.alignChildren = ["center", "center"];
    pnlBoundsMethod.spacing = 20;
    pnlBoundsMethod.margins = [10, 8, 10, 8];

    var rbBoundsSourceRect = pnlBoundsMethod.add("radiobutton", undefined, "sourceRectAtTime() (Dynamic Content)");
    rbBoundsSourceRect.value = true;
    rbBoundsSourceRect.helpTip = "Measures exact rendered bounding box including letter ascenders, descenders, and vector paths.";

    var rbBoundsStated = pnlBoundsMethod.add("radiobutton", undefined, "Stated Width & Height (Box / Layer Size)");
    rbBoundsStated.helpTip = "Uses declared box text dimensions, solid size, or precomp dimensions rooted at [0, 0].";

    // --- Horizontal Alignment (X) Panel ---
    var pnlAlignX = win.add("panel", undefined, "Horizontal Alignment (X)");
    pnlAlignX.orientation = "row";
    pnlAlignX.alignChildren = ["center", "center"];
    pnlAlignX.spacing = 15;
    pnlAlignX.margins = [10, 10, 10, 10];

    var rbXLeft = pnlAlignX.add("radiobutton", undefined, "Left Edge");
    var rbXCenter = pnlAlignX.add("radiobutton", undefined, "Center");
    var rbXRight = pnlAlignX.add("radiobutton", undefined, "Right Edge");
    rbXCenter.value = true; // Default to Center

    // --- Vertical Alignment (Y) Panel ---
    var pnlAlignY = win.add("panel", undefined, "Vertical Alignment (Y)");
    pnlAlignY.orientation = "row";
    pnlAlignY.alignChildren = ["center", "center"];
    pnlAlignY.spacing = 15;
    pnlAlignY.margins = [10, 10, 10, 10];

    var rbYTop = pnlAlignY.add("radiobutton", undefined, "Top Edge");
    var rbYCenter = pnlAlignY.add("radiobutton", undefined, "Center");
    var rbYBottom = pnlAlignY.add("radiobutton", undefined, "Bottom Edge");
    rbYCenter.value = true; // Default to Center

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
    chkGuide.helpTip = "Sets the indicator layer as an AE Guide Layer so it is visible in the viewport but never appears in output renders.";

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
    rbModeExpr.helpTip = "Applies linked expressions so resizing, typing text, or scaling dynamically maintains anchor point alignment.";

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

    var btnCreateTextBox = grpSecondary.add("button", undefined, "📝 New Centered Text Box");
    btnCreateTextBox.alignment = ["fill", "center"];
    btnCreateTextBox.helpTip = "Creates a fresh dummy text box in the center of the viewport.";

    var btnRemove = grpSecondary.add("button", undefined, "✕ Remove Crosshairs & Expressions");
    btnRemove.alignment = ["fill", "center"];

    var btnDemo = grpSecondary.add("button", undefined, "➕ Create Demo Comp");
    btnDemo.alignment = ["fill", "center"];

    // --- Feedback Label ---
    var lblFeedback = win.add("statictext", undefined, "Ready. Select a layer or click 'Align Anchor Point'.");
    lblFeedback.alignment = ["fill", "bottom"];

    // --- Link Footer (matching AE_Text_Precomp.jsx) ---
    var grpFooter = win.add("group");
    grpFooter.orientation = "row";
    grpFooter.alignment = ["fill", "bottom"];
    grpFooter.alignChildren = ["center", "center"];
    grpFooter.margins = [0, 4, 0, 0];

    var lblRepo = grpFooter.add("statictext", undefined, "GitHub: work2survive/AE-Align-AnchorPoint");
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
    // 9. Event Handlers & Orchestration
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

    function getSelectedBoundsMethod() {
        return rbBoundsStated.value ? "stated" : "sourceRect";
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

            // Check if layer has stored alignment effect
            var stored = readAlignmentEffect(lyr);
            var statusSuffix = "";
            if (stored) {
                setAlignSelection(stored.xMode, stored.yMode);
                rbBoundsSourceRect.value = (stored.boundsMethod === "sourceRect");
                rbBoundsStated.value = (stored.boundsMethod === "stated");
                statusSuffix = " • Stored Align: " + stored.xMode.toUpperCase() + "-" + stored.yMode.toUpperCase() + " (" + stored.boundsMethod + ")";
            }

            var curA = lyr.transform.anchorPoint.value || [0, 0];
            var ax = Math.round(curA[0] * 10) / 10;
            var ay = Math.round(curA[1] * 10) / 10;
            lblStatusText.text = "'" + lyr.name + "' [" + typeName + ", Anchor: " + ax + ", " + ay + "]" + statusSuffix;
        } else {
            lblStatusText.text = sel.length + " layers selected in '" + comp.name + "'.";
        }
    }

    function executeAlignment() {
        if (app.beginUndoGroup) app.beginUndoGroup("AE Align Anchor Point");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("Anchor Point Workspace", 1920, 1080, 1, 10, 30);
                if (typeof comp.openInViewer === "function") comp.openInViewer();
            }

            var sel = comp.selectedLayers;
            var createdDummy = false;

            // If nothing is selected, create a dummy text box in the center of the viewport!
            if (!sel || sel.length === 0) {
                var dummyLyr = createDummyTextBox(comp);
                sel = [dummyLyr];
                createdDummy = true;
            }

            var xMode = getSelectedXMode();
            var yMode = getSelectedYMode();
            var boundsMethod = getSelectedBoundsMethod();
            var useExpr = rbModeExpr.value;
            var addCross = chkAddCross.value;
            var isGuide = chkGuide.value;
            var crossSz = parseFloat(txtCrossSize.text) || 30;
            var crossCol = ddlColor.selection ? ddlColor.selection.text : "Cyan";

            var count = 0;
            for (var i = 0; i < sel.length; i++) {
                var layer = sel[i];
                if (!layer || layer.name.indexOf("Anchor_Cross_") === 0) continue;
                alignLayerAnchorPoint(layer, xMode, yMode, boundsMethod, useExpr, addCross, isGuide, crossSz, crossCol);
                count++;
            }

            syncLayerDetection();
            var alignStr = xMode.toUpperCase() + "-" + yMode.toUpperCase();
            var modeStr = useExpr ? "Dynamic Expressions" : "Static Bake";
            var boundsStr = (boundsMethod === "stated") ? "Stated Dimensions" : "sourceRectAtTime()";

            if (createdDummy) {
                lblFeedback.text = "Created dummy text box in viewport center & aligned to " + alignStr + " (" + boundsStr + ").";
            } else {
                lblFeedback.text = "Updated " + count + " layer(s) to " + alignStr + " via " + modeStr + " (" + boundsStr + ").";
            }
        } catch (err) {
            alert("Error aligning anchor point:\n" + (err.message || err.toString()));
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    }

    btnAlign.onClick = function() {
        executeAlignment();
    };

    btnCreateTextBox.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("Create Centered Text Box");
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("Anchor Point Workspace", 1920, 1080, 1, 10, 30);
                if (typeof comp.openInViewer === "function") comp.openInViewer();
            }
            var textLayer = createDummyTextBox(comp);
            var xMode = getSelectedXMode();
            var yMode = getSelectedYMode();
            var boundsMethod = getSelectedBoundsMethod();
            var useExpr = rbModeExpr.value;
            var addCross = chkAddCross.value;
            var isGuide = chkGuide.value;
            var crossSz = parseFloat(txtCrossSize.text) || 30;
            var crossCol = ddlColor.selection ? ddlColor.selection.text : "Cyan";

            alignLayerAnchorPoint(textLayer, xMode, yMode, boundsMethod, useExpr, addCross, isGuide, crossSz, crossCol);
            syncLayerDetection();
            lblFeedback.text = "Created new dummy text box at viewport center with anchor aligned.";
        } catch (eTxt) {
            alert("Error creating text box:\n" + eTxt.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    btnRefresh.onClick = function() {
        syncLayerDetection();
    };

    btnDemo.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("Create Demo Comp");
        try {
            createDemoComposition();
            syncLayerDetection();
            lblFeedback.text = "Created 'Anchor Point Demo' comp with Box Text in viewport center, Shape, Solid, and Precomp.";
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

    // Initial check: if comp is empty, create dummy text box in center automatically
    (function initialSetup() {
        var comp = app.project.activeItem;
        if (comp && comp instanceof CompItem) {
            if (comp.layers.length === 0) {
                createDummyTextBox(comp);
            }
        }
        syncLayerDetection();
    })();

    // Expose programmatic hooks on win object
    win.btnDemo = btnDemo;
    win.btnAlign = btnAlign;
    win.btnCreateTextBox = btnCreateTextBox;
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
    win.rbBoundsSourceRect = rbBoundsSourceRect;
    win.rbBoundsStated = rbBoundsStated;
    win.executeAlignment = executeAlignment;
    win.createDemoComposition = createDemoComposition;
    win.createDummyTextBox = createDummyTextBox;
    win.syncLayerDetection = syncLayerDetection;
    win.storeAlignmentEffect = storeAlignmentEffect;
    win.readAlignmentEffect = readAlignmentEffect;

    win.layout.layout(true);
    win.onResizing = win.onResize = function() { this.layout.resize(); };

    if (win instanceof Window) {
        win.center();
        win.show();
    }
    return win;
})(this);
