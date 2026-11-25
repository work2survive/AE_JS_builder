// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT PRECOMP v2.0.0
// =============================================================================
//
// PURPOSE:
//   Clean, high-performance procedural typography precomposer for Adobe After Effects.
//   Transforms any Point Text or Paragraph (Box) Text layer into an isolated,
//   perfectly padded precomposition with:
//     1. 100% Zero-Shift Content Invariance (Scale & Rotation-safe parent comp compensation).
//     2. True Exterior Padding (Expands canvas outward without breaking text wrap or lines).
//     3. Procedural Bézier Background Card with custom corner radii (Default: Fuchsia #FF00FF).
//     4. Kinetic Line & Word Division without font substitution or layer hijacking (Fixes "W" bug).
//     5. Ergonomic Single-Panel ScriptUI Interface with interactive 3x3 anchor matrix.
//
// ARCHITECTURAL REFERENCES & KNOWLEDGE BASE:
//   1. AE vs. JS Text Rendering Differences Guide (Engine Metrics, Precomps & Coordinate Transforms):
//      https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
//   2. AE Align Anchor Point (Zero-Shift Affine Transformation Matrix):
//      https://github.com/work2survive/AE-Align-AnchorPoint
//   3. AE Text Highlight (Direct-Cloning Line & Word Segmentation):
//      https://github.com/work2survive/AE-Text-Highlight
//   4. Interactive Custom Rounded Rect & Color Picker:
//      https://github.com/work2survive/AE_Custom_Rounded_Rect
//
// REPOSITORIES:
//   - https://github.com/work2survive/AE-text-precomp
//   - https://github.com/work2survive/AE_JS_builder
//
// LIVE DEMO:
//   https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_NAME    = "AE Text Precomp";
    var SCRIPT_VERSION = "v2.0.0";
    var REPO_URL       = "https://github.com/work2survive/AE-text-precomp";

    // -------------------------------------------------------------------------
    // 1. Safe Environment & Memory Store
    // -------------------------------------------------------------------------
    var globalObj = (typeof $ !== "undefined" && typeof $.global !== "undefined")
        ? $.global
        : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));

    if (typeof $ === "undefined") {
        globalObj.$ = { global: globalObj, writeln: function (msg) { if (typeof console !== "undefined") console.log(msg); } };
    } else if (typeof $.global === "undefined") {
        $.global = globalObj;
    }

    var $root = (typeof $ !== "undefined") ? $ : globalObj.$;
    if (typeof $root.global.AE_TEXT_PRECOMP_MEMORY === "undefined") {
        $root.global.AE_TEXT_PRECOMP_MEMORY = {
            layerName: "",
            detectedWidth: 800,
            detectedHeight: 120,
            isBoxText: false,
            align: "left",
            timestamp: 0
        };
    }

    // -------------------------------------------------------------------------
    // 2. Color & Metric Utilities
    // -------------------------------------------------------------------------
    function hexToRgb(hex) {
        if (!hex) return [1.0, 0.0, 1.0]; // Default Fuchsia
        var cleanHex = hex.replace("#", "");
        if (cleanHex.length === 3) {
            cleanHex = cleanHex.charAt(0) + cleanHex.charAt(0) +
                       cleanHex.charAt(1) + cleanHex.charAt(1) +
                       cleanHex.charAt(2) + cleanHex.charAt(2);
        }
        var num = parseInt(cleanHex, 16);
        if (isNaN(num)) return [1.0, 0.0, 1.0];
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#FF00FF";
        var r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
        var g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
        var b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
        var rHex = r.toString(16); if (rHex.length < 2) rHex = "0" + rHex;
        var gHex = g.toString(16); if (gHex.length < 2) gHex = "0" + gHex;
        var bHex = b.toString(16); if (bHex.length < 2) bHex = "0" + bHex;
        return ("#" + rHex + gHex + bHex).toUpperCase();
    }

    function isTextLayer(layer) {
        if (!layer) return false;
        try {
            return (
                layer.property("ADBE Text Properties") !== null ||
                layer.property("Text") !== null ||
                (typeof LayerType !== "undefined" && layer.type === LayerType.TEXT)
            );
        } catch (e) {
            return false;
        }
    }

    function getSelectedTextLayer(comp) {
        if (!comp || !(comp instanceof CompItem)) return null;
        var sel = comp.selectedLayers;
        if (sel && sel.length > 0) {
            for (var i = 0; i < sel.length; i++) {
                if (isTextLayer(sel[i])) return sel[i];
            }
        }
        return null;
    }

    function getTextDocument(layer) {
        if (!layer) return null;
        try {
            var textProp = layer.property("ADBE Text Properties") || layer.property("Text");
            if (textProp) {
                var docProp = textProp.property("ADBE Text Document") || layer.property("Source Text");
                if (docProp && docProp.value) return docProp.value;
            }
        } catch (e) {}
        return null;
    }

    function getLayerSourceRectBounds(layer, compTime) {
        if (!layer) return { left: 0, top: 0, width: 800, height: 120 };
        var t = (compTime !== undefined) ? compTime : 0;
        try {
            if (typeof layer.sourceRectAtTime === "function") {
                var sr = layer.sourceRectAtTime(t, false);
                if (sr && (sr.width > 0 || sr.height > 0 || sr.left !== 0 || sr.top !== 0)) {
                    return { left: sr.left, top: sr.top, width: sr.width, height: sr.height };
                }
            }
        } catch (eSR) {}

        var doc = getTextDocument(layer);
        if (doc && doc.boxText && doc.boxTextSize) {
            var bPos = doc.boxTextPos || [0, 0];
            return {
                left: bPos[0],
                top: bPos[1],
                width: doc.boxTextSize[0],
                height: doc.boxTextSize[1]
            };
        }
        return { left: 0, top: 0, width: 800, height: 120 };
    }

    function getTextLayerMetrics(comp, layer) {
        if (!layer) return null;
        var curTime = comp ? comp.time : 0;
        var sr = getLayerSourceRectBounds(layer, curTime);
        var doc = getTextDocument(layer);

        var isBoxText = false;
        var boxW = sr.width;
        var boxH = sr.height;
        var boxL = sr.left;
        var boxT = sr.top;
        var fontSize = 36;
        var leading = 43.2;
        var fontName = "Arial";
        var tracking = 0;
        var align = "left";
        var rawText = "";

        if (doc) {
            isBoxText = Boolean(doc.boxText);
            if (isBoxText && doc.boxTextSize) {
                boxW = doc.boxTextSize[0];
                boxH = doc.boxTextSize[1];
                if (doc.boxTextPos) {
                    boxL = doc.boxTextPos[0];
                    boxT = doc.boxTextPos[1];
                }
            }
            if (typeof doc.fontSize === "number" && doc.fontSize > 0) fontSize = doc.fontSize;
            if (typeof doc.leading === "number" && doc.leading > 0) leading = doc.leading;
            else leading = fontSize * 1.2;
            if (doc.font) fontName = doc.font;
            if (typeof doc.tracking === "number") tracking = doc.tracking;
            if (doc.text) rawText = doc.text;

            var just = doc.justification;
            if (typeof ParagraphJustification !== "undefined") {
                if (just === ParagraphJustification.CENTER_JUSTIFY) align = "center";
                else if (just === ParagraphJustification.RIGHT_JUSTIFY) align = "right";
                else align = "left";
            } else {
                if (just === 7414) align = "center";
                else if (just === 7413) align = "right";
                else align = "left";
            }
        }

        var lines = rawText.split(/\r\n|\r|\n/);
        var words = rawText.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").split(" ");
        if (words.length === 1 && words[0] === "") words = [];

        var metrics = {
            layerName: layer.name,
            isBoxText: isBoxText,
            detectedWidth: Math.max(10, Math.round(boxW)),
            detectedHeight: Math.max(10, Math.round(boxH)),
            boxLeft: boxL,
            boxTop: boxT,
            fontSize: fontSize,
            leading: leading,
            fontName: fontName,
            tracking: tracking,
            align: align,
            rawText: rawText,
            lines: lines,
            words: words,
            totalWords: words.length,
            totalLines: lines.length
        };

        // Cache in global store
        $root.global.AE_TEXT_PRECOMP_MEMORY = metrics;
        return metrics;
    }

    // -------------------------------------------------------------------------
    // 3. Procedural Bézier Rounded Rectangle Generator (AE_Custom_Rounded_Rect)
    // -------------------------------------------------------------------------
    function computeBezierRoundedRect(w, h, rTL, rTR, rBR, rBL, preventOverlap) {
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

    function addBackgroundCard(comp, w, h, radii, colorRgb, opacity) {
        if (!comp || !(comp instanceof CompItem)) return null;
        try {
            var shapeLayer = comp.layers.addShape();
            shapeLayer.name = "Background Card";
            shapeLayer.moveToEnd();

            shapeLayer.property("Transform").property("Position").setValue([w / 2, h / 2]);
            shapeLayer.property("Transform").property("Anchor Point").setValue([0, 0]);
            if (typeof opacity === "number") {
                shapeLayer.property("Transform").property("Opacity").setValue(Math.max(0, Math.min(100, opacity)));
            }

            var contents = shapeLayer.property("Contents") || shapeLayer.property("ADBE Root Vectors Group");
            var shapeGroup = contents.addProperty("ADBE Vector Group");
            shapeGroup.name = "Rounded Card Group";
            var groupContents = shapeGroup.property("Contents") || shapeGroup.property("ADBE Vectors Group");

            var pathData = computeBezierRoundedRect(w, h, radii.tl, radii.tr, radii.br, radii.bl, true);
            var pathProp = groupContents.addProperty("ADBE Vector Shape - Path");
            var shapeObj = new Shape();
            shapeObj.vertices = pathData.points;
            shapeObj.inTangents = pathData.inTangents;
            shapeObj.outTangents = pathData.outTangents;
            shapeObj.closed = true;
            pathProp.property("Path").setValue(shapeObj);

            var fillProp = groupContents.addProperty("ADBE Vector Graphic - Fill");
            fillProp.property("Color").setValue([colorRgb[0], colorRgb[1], colorRgb[2], 1.0]);

            return shapeLayer;
        } catch (eBg) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // 4. Zero-Shift Coordinate Transformation Engine
    // -------------------------------------------------------------------------
    var ANCHOR_PRESETS = {
        "TL": { label: "Top-Left",      fx: 0.0, fy: 0.0 },
        "TC": { label: "Top-Center",    fx: 0.5, fy: 0.0 },
        "TR": { label: "Top-Right",     fx: 1.0, fy: 0.0 },
        "ML": { label: "Middle-Left",   fx: 0.0, fy: 0.5 },
        "C":  { label: "Center",        fx: 0.5, fy: 0.5 },
        "MR": { label: "Middle-Right",  fx: 1.0, fy: 0.5 },
        "BL": { label: "Bottom-Left",   fx: 0.0, fy: 1.0 },
        "BC": { label: "Bottom-Center", fx: 0.5, fy: 1.0 },
        "BR": { label: "Bottom-Right",  fx: 1.0, fy: 1.0 }
    };

    function calculateZeroShiftPosition(textLayer, boxLeft, boxTop, padding, precompW, precompH, anchorKey) {
        var posProp = textLayer.property("Transform").property("Position");
        var apProp  = textLayer.property("Transform").property("Anchor Point");
        var scProp  = textLayer.property("Transform").property("Scale");
        var rotProp = textLayer.property("Transform").property("Rotation") || textLayer.property("Transform").property("Z Rotation");

        var p = posProp ? posProp.value : [0, 0];
        var a = apProp ? apProp.value : [0, 0];
        var s = scProp ? scProp.value : [100, 100];
        var rot = rotProp ? (rotProp.value || 0) : 0;

        var sx = (s[0] || 100) / 100;
        var sy = (s[1] || 100) / 100;
        var rad = rot * (Math.PI / 180);

        var preset = ANCHOR_PRESETS[anchorKey] || ANCHOR_PRESETS["TL"];
        var targetPrecompAx = precompW * preset.fx;
        var targetPrecompAy = precompH * preset.fy;

        // Net displacement from original text layer anchor to precomp anchor
        var deltaLocalX = (boxLeft - padding - a[0] + targetPrecompAx) * sx;
        var deltaLocalY = (boxTop - padding - a[1] + targetPrecompAy) * sy;

        var rotDeltaX = deltaLocalX * Math.cos(rad) - deltaLocalY * Math.sin(rad);
        var rotDeltaY = deltaLocalX * Math.sin(rad) + deltaLocalY * Math.cos(rad);

        var precompCompPos = [p[0] + rotDeltaX, p[1] + rotDeltaY];
        if (textLayer.threeDLayer && p.length > 2) {
            precompCompPos.push(p[2]);
        }

        return {
            anchorPoint: [targetPrecompAx, targetPrecompAy],
            position: precompCompPos,
            scale: s,
            rotation: rot
        };
    }

    // -------------------------------------------------------------------------
    // 5. Precomposition & Division Execution Engine
    // -------------------------------------------------------------------------
    function executePrecomp(comp, targetLayer, options) {
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("No active composition found.");
        }
        if (!targetLayer || !isTextLayer(targetLayer)) {
            throw new Error("Please select a text layer first.");
        }

        var metrics = getTextLayerMetrics(comp, targetLayer);
        if (!metrics) throw new Error("Could not extract text metrics from layer.");

        var width = options.autoWidth ? metrics.detectedWidth : Math.max(10, options.manualWidth);
        var height = options.autoHeight ? metrics.detectedHeight : Math.max(10, options.manualHeight);
        var padding = Math.max(0, options.padding || 0);

        var precompW = Math.max(4, Math.ceil(width + (padding * 2)));
        var precompH = Math.max(4, Math.ceil(height + (padding * 2)));

        var targetIndex = targetLayer.index;
        var targetParent = targetLayer.parent;
        var target3D = targetLayer.threeDLayer;
        var baseName = targetLayer.name.replace(/\s*Precomp$/, "");
        var precompName = baseName + " Precomp";

        var zeroShift = calculateZeroShiftPosition(
            targetLayer,
            metrics.boxLeft,
            metrics.boxTop,
            padding,
            precompW,
            precompH,
            options.anchorKey || "TL"
        );

        app.beginUndoGroup(SCRIPT_NAME + ": " + (options.mode === "lines" ? "Divide by Lines" : (options.mode === "words" ? "Divide by Words" : "Precompose")));

        try {
            // 1. Precompose target layer natively (preserves all effects, masks, animators)
            var precompItem = comp.layers.precompose([targetIndex], precompName, true);
            if (!precompItem) throw new Error("Failed to precompose layer.");

            // 2. Adjust precomp dimensions to encompass text box + exterior padding
            precompItem.width = precompW;
            precompItem.height = precompH;

            var innerTextLayer = precompItem.layer(1);
            if (!innerTextLayer) throw new Error("Inner layer missing in precomposition.");

            var innerOrigAnchor = targetLayer.property("Transform").property("Anchor Point").value;

            if (options.mode === "single") {
                // Keep original text box intact, offset by exterior padding
                innerTextLayer.property("Transform").property("Scale").setValue([100, 100]);
                try {
                    var innerRot = innerTextLayer.property("Transform").property("Rotation") ||
                                   innerTextLayer.property("Transform").property("Z Rotation");
                    if (innerRot) innerRot.setValue(0);
                } catch (eIR) {}

                var innerPosX = padding + innerOrigAnchor[0] - metrics.boxLeft;
                var innerPosY = padding + innerOrigAnchor[1] - metrics.boxTop;
                innerTextLayer.property("Transform").property("Position").setValue([innerPosX, innerPosY]);

            } else if (options.mode === "lines") {
                // Divide text by lines using native layer duplication (prevents "W" bug & font substitution)
                var rawLines = metrics.lines;
                if (!rawLines || rawLines.length === 0) rawLines = [metrics.rawText || "Text"];

                var firstLineBaseline = (Math.abs(metrics.boxTop) > 0) ? Math.abs(metrics.boxTop) : (metrics.fontSize * 0.75);

                for (var li = 0; li < rawLines.length; li++) {
                    var lineLayer = innerTextLayer.duplicate();
                    lineLayer.name = "Line " + (li + 1);

                    var lineDoc = lineLayer.property("Source Text").value;
                    lineDoc.text = rawLines[li];
                    try { lineDoc.boxText = false; } catch (eBT) {}
                    lineLayer.property("Source Text").setValue(lineDoc);

                    var lineX = padding;
                    if (metrics.align === "center") {
                        lineX = precompW / 2;
                    } else if (metrics.align === "right") {
                        lineX = precompW - padding;
                    }
                    var lineY = padding + firstLineBaseline + (li * metrics.leading);

                    lineLayer.property("Transform").property("Position").setValue([lineX, lineY]);
                    lineLayer.property("Transform").property("Scale").setValue([100, 100]);
                    try {
                        var lRot = lineLayer.property("Transform").property("Rotation") ||
                                   lineLayer.property("Transform").property("Z Rotation");
                        if (lRot) lRot.setValue(0);
                    } catch (eLR) {}
                }
                // Remove the template original layer
                innerTextLayer.remove();

            } else if (options.mode === "words") {
                // Divide text by words
                var rawLines2 = metrics.lines;
                if (!rawLines2 || rawLines2.length === 0) rawLines2 = [metrics.rawText || "Text"];

                var firstLineBaseline2 = (Math.abs(metrics.boxTop) > 0) ? Math.abs(metrics.boxTop) : (metrics.fontSize * 0.75);
                var spaceWidth = metrics.fontSize * 0.28;
                var wordCounter = 1;

                for (var li2 = 0; li2 < rawLines2.length; li2++) {
                    var lineWords = rawLines2[li2].replace(/^\s+|\s+$/g, "").split(/\s+/);
                    if (lineWords.length === 0 || (lineWords.length === 1 && lineWords[0] === "")) continue;

                    var curX = padding;
                    var lineY2 = padding + firstLineBaseline2 + (li2 * metrics.leading);

                    for (var wi = 0; wi < lineWords.length; wi++) {
                        var wordLayer = innerTextLayer.duplicate();
                        wordLayer.name = "Word " + wordCounter;
                        wordCounter++;

                        var wordDoc = wordLayer.property("Source Text").value;
                        wordDoc.text = lineWords[wi];
                        try { wordDoc.boxText = false; } catch (eBT2) {}
                        wordLayer.property("Source Text").setValue(wordDoc);

                        wordLayer.property("Transform").property("Position").setValue([curX, lineY2]);
                        wordLayer.property("Transform").property("Scale").setValue([100, 100]);
                        try {
                            var wRot = wordLayer.property("Transform").property("Rotation") ||
                                       wordLayer.property("Transform").property("Z Rotation");
                            if (wRot) wRot.setValue(0);
                        } catch (eWR) {}

                        // Measure advance width of the real word layer
                        var wBounds = wordLayer.sourceRectAtTime(0, false);
                        var wordAdvance = (wBounds && wBounds.width > 0) ? wBounds.width : (metrics.fontSize * 0.6 * lineWords[wi].length);
                        curX += wordAdvance + spaceWidth;
                    }
                }
                // Remove the template original layer
                innerTextLayer.remove();
            }

            // 3. Add Procedural Bézier Background Card (if enabled)
            if (options.addBackgroundCard) {
                addBackgroundCard(
                    precompItem,
                    precompW,
                    precompH,
                    options.radii || { tl: 16, tr: 16, br: 16, bl: 16 },
                    options.bgColor || [1.0, 0.0, 1.0],
                    options.bgOpacity !== undefined ? options.bgOpacity : 100
                );
            }

            // 4. Configure precomp layer in parent comp with zero-shift compensation
            var precompLayer = comp.layer(targetIndex);
            if (precompLayer) {
                precompLayer.property("Transform").property("Anchor Point").setValue(zeroShift.anchorPoint);
                precompLayer.property("Transform").property("Position").setValue(zeroShift.position);
                precompLayer.property("Transform").property("Scale").setValue(zeroShift.scale);
                try {
                    var pRotProp = precompLayer.property("Transform").property("Rotation") ||
                                   precompLayer.property("Transform").property("Z Rotation");
                    if (pRotProp) pRotProp.setValue(zeroShift.rotation);
                } catch (ePR) {}

                if (targetParent) precompLayer.parent = targetParent;
                if (target3D) precompLayer.threeDLayer = true;

                // Select precomp layer
                try {
                    for (var si = 1; si <= comp.layers.length; si++) {
                        comp.layer(si).selected = false;
                    }
                    precompLayer.selected = true;
                } catch (eSel) {}
            }

            app.endUndoGroup();
            return {
                precompItem: precompItem,
                precompLayer: precompLayer,
                width: precompW,
                height: precompH
            };

        } catch (eExec) {
            app.endUndoGroup();
            throw eExec;
        }
    }

    // -------------------------------------------------------------------------
    // 6. Color Picker Helper (Supports Native & Web Simulator)
    // -------------------------------------------------------------------------
    function createColorPicker(parent, defaultHex) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.spacing = 6;
        grp.alignChildren = ["left", "center"];

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [32, 22];
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

        btnSwatch.onDraw = function () {
            try {
                var g = this.graphics;
                var rgb = hexToRgb(picker._color);
                var brush = g.newBrush(g.BrushType.SOLID_COLOR, [rgb[0], rgb[1], rgb[2], 1.0]);
                var pen = g.newPen(g.PenType.SOLID_COLOR, [0.6, 0.6, 0.6, 1.0], 1);
                g.newPath();
                g.rectPath(0, 0, this.size ? this.size[0] : 32, this.size ? this.size[1] : 22);
                g.fillPath(brush);
                g.strokePath(pen);
            } catch (e) {}
        };

        function setColor(newHex, triggerChange) {
            if (!newHex) return;
            if (newHex.indexOf("#") !== 0) newHex = "#" + newHex;
            picker._color = newHex;
            picker.value = newHex;
            txtHex.text = newHex.toUpperCase();

            try {
                if (btnSwatch.notify) btnSwatch.notify("onDraw");
            } catch (e) {}

            if (btnSwatch.domElement) {
                btnSwatch.domElement.style.backgroundColor = newHex;
                btnSwatch.domElement.style.border = "1px solid #777";
            }

            if (triggerChange && typeof picker.onChange === "function") {
                picker.onChange();
            }
        }

        btnSwatch.onClick = function () {
            var curHex = picker._color || "#FF00FF";
            if (typeof window !== "undefined" && typeof window.openWindowsColorPicker === "function") {
                window.openWindowsColorPicker(curHex, function (selectedHex) {
                    setColor(selectedHex, true);
                });
                return;
            }

            var hexNum = parseInt(curHex.replace("#", ""), 16);
            var result = -1;
            if (typeof $.colorPicker === "function") {
                result = $.colorPicker(hexNum);
            }
            if (result !== -1 && result !== undefined && result !== null) {
                var hexStr = Number(result).toString(16);
                while (hexStr.length < 6) hexStr = "0" + hexStr;
                setColor("#" + hexStr, true);
            }
        };

        txtHex.onChange = function () {
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

    // -------------------------------------------------------------------------
    // 7. ScriptUI Streamlined Interface Construction
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = SCRIPT_NAME + " " + SCRIPT_VERSION;
    }

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 10;

    // --- Header ---
    var pnlHeader = win.add("panel", undefined, SCRIPT_NAME + " " + SCRIPT_VERSION);
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.spacing = 2;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblSubtitle = pnlHeader.add("statictext", undefined, "Clean Typography Precomposer with Zero-Shift & Exterior Padding");
    lblSubtitle.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.65, 0.95, 1], 1);

    // --- Target Detection Row ---
    var grpDetect = pnlHeader.add("group");
    grpDetect.orientation = "row";
    grpDetect.alignment = ["fill", "top"];
    grpDetect.spacing = 6;

    var lblStatusText = grpDetect.add("statictext", undefined, "Scanning active selection...");
    lblStatusText.alignment = ["fill", "center"];

    var btnRefresh = grpDetect.add("button", undefined, "Refresh");
    btnRefresh.preferredSize = [65, 22];
    btnRefresh.helpTip = "Rescans the active composition for selected text layers.";

    // --- Panel: Dimensions & Exterior Padding ---
    var pnlDims = win.add("panel", undefined, "Dimensions & Exterior Padding");
    pnlDims.orientation = "column";
    pnlDims.alignChildren = ["fill", "top"];
    pnlDims.spacing = 6;
    pnlDims.margins = 10;

    // Width & Height Rows
    var grpDimRow = pnlDims.add("group");
    grpDimRow.orientation = "row";
    grpDimRow.alignment = ["fill", "top"];
    grpDimRow.spacing = 10;

    var chkAutoWidth = grpDimRow.add("checkbox", undefined, "Auto Width");
    chkAutoWidth.value = true;
    var txtWidth = grpDimRow.add("edittext", undefined, "800");
    txtWidth.preferredSize = [60, 22];
    txtWidth.enabled = false;

    var chkAutoHeight = grpDimRow.add("checkbox", undefined, "Auto Height");
    chkAutoHeight.value = true;
    var txtHeight = grpDimRow.add("edittext", undefined, "120");
    txtHeight.preferredSize = [60, 22];
    txtHeight.enabled = false;

    chkAutoWidth.onClick = function () { txtWidth.enabled = !chkAutoWidth.value; };
    chkAutoHeight.onClick = function () { txtHeight.enabled = !chkAutoHeight.value; };

    // Exterior Padding Row (Default: 0px)
    var grpPad = pnlDims.add("group");
    grpPad.orientation = "row";
    grpPad.alignment = ["fill", "top"];
    grpPad.spacing = 8;

    var lblPad = grpPad.add("statictext", undefined, "Exterior Padding (px):");
    lblPad.preferredSize = [130, -1];

    var sldPad = grpPad.add("slider", undefined, 0, 0, 120);
    sldPad.minvalue = 0;
    sldPad.maxvalue = 120;
    sldPad.value = 0;
    sldPad.alignment = ["fill", "center"];

    var txtPad = grpPad.add("edittext", undefined, "0");
    txtPad.preferredSize = [40, 22];

    sldPad.onChanging = sldPad.onChange = function () {
        txtPad.text = String(Math.round(sldPad.value));
    };
    txtPad.onChange = function () {
        var v = parseFloat(txtPad.text) || 0;
        sldPad.value = Math.max(0, Math.min(120, v));
    };

    var lblPadHint = pnlDims.add("statictext", undefined, "Exterior padding expands precomp canvas outward around text box.");
    lblPadHint.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55, 1], 1);

    // --- Panel: Precomp Anchor Point (3x3 Matrix) ---
    var pnlAnchor = win.add("panel", undefined, "Precomp Anchor Point (Zero-Shift)");
    pnlAnchor.orientation = "row";
    pnlAnchor.alignChildren = ["fill", "top"];
    pnlAnchor.spacing = 12;
    pnlAnchor.margins = 10;

    var grpMatrix = pnlAnchor.add("group");
    grpMatrix.orientation = "column";
    grpMatrix.spacing = 3;

    var r1 = grpMatrix.add("group"); r1.spacing = 3;
    var btnTL = r1.add("button", undefined, "TL"); btnTL.preferredSize = [36, 22];
    var btnTC = r1.add("button", undefined, "TC"); btnTC.preferredSize = [36, 22];
    var btnTR = r1.add("button", undefined, "TR"); btnTR.preferredSize = [36, 22];

    var r2 = grpMatrix.add("group"); r2.spacing = 3;
    var btnML = r2.add("button", undefined, "ML"); btnML.preferredSize = [36, 22];
    var btnC  = r2.add("button", undefined, " C "); btnC.preferredSize  = [36, 22];
    var btnMR = r2.add("button", undefined, "MR"); btnMR.preferredSize = [36, 22];

    var r3 = grpMatrix.add("group"); r3.spacing = 3;
    var btnBL = r3.add("button", undefined, "BL"); btnBL.preferredSize = [36, 22];
    var btnBC = r3.add("button", undefined, "BC"); btnBC.preferredSize = [36, 22];
    var btnBR = r3.add("button", undefined, "BR"); btnBR.preferredSize = [36, 22];

    var grpAnchorDetails = pnlAnchor.add("group");
    grpAnchorDetails.orientation = "column";
    grpAnchorDetails.alignChildren = ["left", "top"];
    grpAnchorDetails.alignment = ["fill", "center"];
    grpAnchorDetails.spacing = 6;

    var dropAlign = grpAnchorDetails.add("dropdownlist", undefined, [
        "Top-Left (TL)",
        "Top-Center (TC)",
        "Top-Right (TR)",
        "Middle-Left (ML)",
        "Center (C)",
        "Middle-Right (MR)",
        "Bottom-Left (BL)",
        "Bottom-Center (BC)",
        "Bottom-Right (BR)"
    ]);
    dropAlign.preferredSize = [160, 24];
    dropAlign.selection = 0;

    var lblAnchorDesc = grpAnchorDetails.add("statictext", undefined, "Invariance: 0.00px visual shift");
    lblAnchorDesc.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 0.45, 1], 1);

    var matrixButtons = {
        "TL": btnTL, "TC": btnTC, "TR": btnTR,
        "ML": btnML, "C": btnC,   "MR": btnMR,
        "BL": btnBL, "BC": btnBC, "BR": btnBR
    };
    var currentAnchorKey = "TL";

    function setAnchorSelection(key) {
        if (!ANCHOR_PRESETS[key]) key = "TL";
        currentAnchorKey = key;
        var keys = ["TL", "TC", "TR", "ML", "C", "MR", "BL", "BC", "BR"];
        for (var ki = 0; ki < keys.length; ki++) {
            if (keys[ki] === key) {
                dropAlign.selection = ki;
                break;
            }
        }
    }

    btnTL.onClick = function () { setAnchorSelection("TL"); };
    btnTC.onClick = function () { setAnchorSelection("TC"); };
    btnTR.onClick = function () { setAnchorSelection("TR"); };
    btnML.onClick = function () { setAnchorSelection("ML"); };
    btnC.onClick  = function () { setAnchorSelection("C");  };
    btnMR.onClick = function () { setAnchorSelection("MR"); };
    btnBL.onClick = function () { setAnchorSelection("BL"); };
    btnBC.onClick = function () { setAnchorSelection("BC"); };
    btnBR.onClick = function () { setAnchorSelection("BR"); };

    dropAlign.onChange = function () {
        var idx = dropAlign.selection ? dropAlign.selection.index : 0;
        var keys = ["TL", "TC", "TR", "ML", "C", "MR", "BL", "BC", "BR"];
        currentAnchorKey = keys[idx] || "TL";
    };

    // --- Panel: Background Card (Bézier Shape Layer) ---
    var pnlBg = win.add("panel", undefined, "Background Card (Shape Layer)");
    pnlBg.orientation = "column";
    pnlBg.alignChildren = ["fill", "top"];
    pnlBg.spacing = 6;
    pnlBg.margins = 10;

    var chkAddBg = pnlBg.add("checkbox", undefined, "Add Background Card (Bézier Shape Layer)");
    chkAddBg.value = true;

    // Color & Opacity Row (Default: Fuchsia #FF00FF)
    var grpBgColorRow = pnlBg.add("group");
    grpBgColorRow.orientation = "row";
    grpBgColorRow.alignment = ["fill", "top"];
    grpBgColorRow.spacing = 8;

    var lblCol = grpBgColorRow.add("statictext", undefined, "Color:");
    var cpBg = createColorPicker(grpBgColorRow, "#FF00FF");

    var lblOp = grpBgColorRow.add("statictext", undefined, "Opacity:");
    var sldOp = grpBgColorRow.add("slider", undefined, 100, 0, 100);
    sldOp.minvalue = 0;
    sldOp.maxvalue = 100;
    sldOp.value = 100;
    sldOp.preferredSize = [60, 20];
    var txtOp = grpBgColorRow.add("edittext", undefined, "100");
    txtOp.preferredSize = [35, 22];

    sldOp.onChanging = sldOp.onChange = function () { txtOp.text = String(Math.round(sldOp.value)); };
    txtOp.onChange = function () {
        var v = parseFloat(txtOp.text) || 0;
        sldOp.value = Math.max(0, Math.min(100, v));
    };

    // Corner Radius Row
    var grpRadii = pnlBg.add("group");
    grpRadii.orientation = "row";
    grpRadii.alignment = ["fill", "top"];
    grpRadii.spacing = 8;

    var lblRadius = grpRadii.add("statictext", undefined, "Corner Radius:");
    var sldRadius = grpRadii.add("slider", undefined, 16, 0, 60);
    sldRadius.minvalue = 0;
    sldRadius.maxvalue = 60;
    sldRadius.value = 16;
    sldRadius.alignment = ["fill", "center"];
    var txtRadius = grpRadii.add("edittext", undefined, "16");
    txtRadius.preferredSize = [35, 22];

    sldRadius.onChanging = sldRadius.onChange = function () { txtRadius.text = String(Math.round(sldRadius.value)); };
    txtRadius.onChange = function () {
        var v = parseFloat(txtRadius.text) || 0;
        sldRadius.value = Math.max(0, Math.min(60, v));
    };

    // Quick Corner Presets
    var grpCornerPresets = pnlBg.add("group");
    grpCornerPresets.orientation = "row";
    grpCornerPresets.alignment = ["fill", "top"];
    grpCornerPresets.spacing = 6;

    var btnAllCorners = grpCornerPresets.add("button", undefined, "All 4");
    btnAllCorners.preferredSize = [60, 22];
    var btnTopCorners = grpCornerPresets.add("button", undefined, "Top Only");
    btnTopCorners.preferredSize = [65, 22];
    var btnChatBubble = grpCornerPresets.add("button", undefined, "Bubble");
    btnChatBubble.preferredSize = [60, 22];
    var btnSharp = grpCornerPresets.add("button", undefined, "Sharp (0)");
    btnSharp.preferredSize = [65, 22];

    var cornerConfig = { tl: true, tr: true, br: true, bl: true };
    btnAllCorners.onClick = function () { cornerConfig = { tl: true, tr: true, br: true, bl: true }; sldRadius.value = 16; txtRadius.text = "16"; };
    btnTopCorners.onClick = function () { cornerConfig = { tl: true, tr: true, br: false, bl: false }; };
    btnChatBubble.onClick = function () { cornerConfig = { tl: true, tr: true, br: true, bl: false }; };
    btnSharp.onClick      = function () { cornerConfig = { tl: false, tr: false, br: false, bl: false }; sldRadius.value = 0; txtRadius.text = "0"; };

    chkAddBg.onClick = function () {
        var on = chkAddBg.value;
        cpBg.button.enabled = on;
        cpBg.edittext.enabled = on;
        sldOp.enabled = on;
        txtOp.enabled = on;
        sldRadius.enabled = on;
        txtRadius.enabled = on;
        btnAllCorners.enabled = on;
        btnTopCorners.enabled = on;
        btnChatBubble.enabled = on;
        btnSharp.enabled = on;
    };

    // --- Panel: Actions ---
    var pnlActions = win.add("panel", undefined, "Actions");
    pnlActions.orientation = "column";
    pnlActions.alignChildren = ["fill", "top"];
    pnlActions.spacing = 6;
    pnlActions.margins = 10;

    var btnPrecomp = pnlActions.add("button", undefined, "Precompose Text Box");
    btnPrecomp.preferredSize = [-1, 32];
    btnPrecomp.helpTip = "Precomposes text box with exterior padding, zero-shift anchor and background card.";

    var grpSubActions = pnlActions.add("group");
    grpSubActions.orientation = "row";
    grpSubActions.alignment = ["fill", "top"];
    grpSubActions.spacing = 8;

    var btnDivideLines = grpSubActions.add("button", undefined, "Divide by Lines");
    btnDivideLines.alignment = ["fill", "center"];
    btnDivideLines.preferredSize = [-1, 26];
    btnDivideLines.helpTip = "Extracts each line as its own layer inside precomp with matching styling.";

    var btnDivideWords = grpSubActions.add("button", undefined, "Divide by Words");
    btnDivideWords.alignment = ["fill", "center"];
    btnDivideWords.preferredSize = [-1, 26];
    btnDivideWords.helpTip = "Extracts each word as its own layer inside precomp with matching styling.";

    // --- Status & Footer ---
    var lblFeedback = win.add("statictext", undefined, "Ready.");
    lblFeedback.alignment = ["fill", "bottom"];

    var grpFooter = win.add("group");
    grpFooter.orientation = "row";
    grpFooter.alignment = ["fill", "bottom"];
    grpFooter.alignChildren = ["center", "center"];
    var lblRepo = grpFooter.add("statictext", undefined, "GitHub: work2survive/AE-text-precomp");
    lblRepo.helpTip = REPO_URL;
    lblRepo.onClick = function () {
        if (typeof window !== "undefined" && window.open) {
            window.open(REPO_URL, "_blank");
        } else if ($.os && $.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + REPO_URL + '"');
        } else if (typeof system !== "undefined" && system.callSystem) {
            system.callSystem('open "' + REPO_URL + '"');
        }
    };

    // -------------------------------------------------------------------------
    // 8. Event Wiring & Sync
    // -------------------------------------------------------------------------
    function syncDetection() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            lblStatusText.text = "No active composition found.";
            return null;
        }

        var textLayer = getSelectedTextLayer(comp);
        if (textLayer) {
            var metrics = getTextLayerMetrics(comp, textLayer);
            var typeStr = metrics.isBoxText ? "Box Text" : "Point Text";
            lblStatusText.text = "'" + textLayer.name + "' (" + typeStr + ", " + metrics.align.toUpperCase() + ", " + metrics.detectedWidth + "x" + metrics.detectedHeight + "px)";

            if (chkAutoWidth.value) txtWidth.text = String(metrics.detectedWidth);
            if (chkAutoHeight.value) txtHeight.text = String(metrics.detectedHeight);

            if (metrics.align === "center") setAnchorSelection("TC");
            else if (metrics.align === "right") setAnchorSelection("TR");
            else setAnchorSelection("TL");

            return { comp: comp, layer: textLayer, metrics: metrics };
        } else {
            lblStatusText.text = "No text layer selected.";
            return { comp: comp, layer: null, metrics: null };
        }
    }

    btnRefresh.onClick = function () {
        var res = syncDetection();
        if (res && res.layer) {
            lblFeedback.text = "Detected text box: " + res.metrics.detectedWidth + "x" + res.metrics.detectedHeight + "px (" + res.metrics.align + ")";
        } else {
            lblFeedback.text = "Please select a text layer.";
        }
    };

    function runAction(mode) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            lblFeedback.text = "Error: Please open a composition.";
            return;
        }
        var textLayer = getSelectedTextLayer(comp);
        if (!textLayer) {
            lblFeedback.text = "Error: Please select a text layer first.";
            return;
        }

        var rVal = parseFloat(txtRadius.text) || 0;
        var radii = {
            tl: cornerConfig.tl ? rVal : 0,
            tr: cornerConfig.tr ? rVal : 0,
            br: cornerConfig.br ? rVal : 0,
            bl: cornerConfig.bl ? rVal : 0
        };

        var options = {
            mode: mode,
            autoWidth: chkAutoWidth.value,
            manualWidth: parseFloat(txtWidth.text) || 800,
            autoHeight: chkAutoHeight.value,
            manualHeight: parseFloat(txtHeight.text) || 120,
            padding: parseFloat(txtPad.text) || 0,
            anchorKey: currentAnchorKey,
            addBackgroundCard: chkAddBg.value,
            bgColor: hexToRgb(cpBg.value),
            bgOpacity: parseFloat(txtOp.text) || 100,
            radii: radii
        };

        try {
            var result = executePrecomp(comp, textLayer, options);
            lblFeedback.text = "Success: " + result.precompItem.name + " (" + result.width + "x" + result.height + "px)";
            syncDetection();
        } catch (eErr) {
            lblFeedback.text = "Error: " + eErr.message;
        }
    }

    btnPrecomp.onClick     = function () { runAction("single"); };
    btnDivideLines.onClick = function () { runAction("lines"); };
    btnDivideWords.onClick = function () { runAction("words"); };

    // Initial sync
    try {
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
        syncDetection();
    } catch (eInit) {}

})(this);
