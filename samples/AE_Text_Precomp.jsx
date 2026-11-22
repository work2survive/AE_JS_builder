// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT PRECOMP v1.1
// =============================================================================
//
// PURPOSE:
//   Precomposes a selected text box (paragraph or point text) into a neatly-sized
//   composition with customizable padding, dynamic top anchor point rigger, and
//   a procedural 2D rounded rectangle background card featuring 4 independent
//   corner radii (based on AE_Extruded_Round_corners).
//
// KEY FEATURES:
//   1. Padding & Textbox Reduction:
//      - Padding option that reduces the textbox width to fit inside the precomp.
//      - When "automatic precomp height" is active, precomp height expands to fit
//        the wrapped textbox vertical size plus top and bottom padding.
//      - Anchor point automatically accounts for padding, resting cleanly at the
//        top of the text box (Top-Left, Top-Center, or Top-Right based on alignment).
//   2. Procedural Rounded Background Card (AE_Extruded_Round_corners):
//      - Creates an individual 4-corner rounded rectangle shape layer behind the text.
//      - Interactive UI asks which corners will react to the padding to round.
//      - 8-vertex Bézier path with W3C CSS proportional overlap protection.
//      - Master Effect Controls (Radius Top-Left, Top-Right, Bottom-Right, Bottom-Left,
//        Width, Height) with live parametric expressions on the Path property.
//   3. Integrated Color Picker & Opacity:
//      - Interactive swatch button + hex input (#RRGGBB) compatible with AE's native
//        color picker, Windows OS color picker, and the AE_JS_builder web emulator.
//      - Opacity slider with live value sync.
//   4. Dummy Text Generation:
//      - If no text layer is selected, generates a 100-word Lorem Ipsum layer using
//        a system font (ArialMT) and formatted to the padded textbox dimensions.
//   5. Zero Visual Shift:
//      - Mathematically compensates position so that the text does not jump on screen.
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_NAME = "AE Text Precomp";
    var SCRIPT_VERSION = "v1.1";

    // -------------------------------------------------------------------------
    // 1. ES3 Helpers & Polyfills
    // -------------------------------------------------------------------------
    function trimStr(str) {
        if (!str) return "";
        return String(str).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    }

    function hexToRgb(hex) {
        hex = String(hex).replace("#", "");
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var num = parseInt(hex, 16);
        return [
            ((num >> 16) & 255) / 255, // Red (0.0 to 1.0)
            ((num >> 8) & 255) / 255,  // Green (0.0 to 1.0)
            (num & 255) / 255,         // Blue (0.0 to 1.0)
            1.0                        // Alpha
        ];
    }

    // 100 Words of Lorem Ipsum
    var LOREM_IPSUM_100 =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut " +
        "labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris " +
        "nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit " +
        "esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in " +
        "culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error " +
        "sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore " +
        "veritatis et quasi architecto beatae vitae dicta sunt explicabo.";

    function wrapTextToWidth(text, maxWidth, fontSize) {
        var charWidth = (fontSize || 28) * 0.52;
        var maxCharsPerLine = Math.max(15, Math.floor(maxWidth / charWidth));
        var words = text.split(/\s+/);
        var lines = [];
        var currentLine = "";
        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (currentLine.length === 0) {
                currentLine = word;
            } else if ((currentLine.length + 1 + word.length) <= maxCharsPerLine) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        return lines.join("\n");
    }

    // -------------------------------------------------------------------------
    // 2. Bézier Rounded Rectangle Path Computation (AE_Extruded_Round_corners)
    // -------------------------------------------------------------------------
    function computeRoundRectPathData(w, h, rTL, rTR, rBR, rBL) {
        // W3C CSS Backgrounds and Borders Module Level 3 (§5.5 Corner Overlapping)
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

        var halfW = w / 2;
        var halfH = h / 2;
        var xMin = -halfW;
        var xMax =  halfW;
        var yMin = -halfH;
        var yMax =  halfH;

        var K = 0.5522847498307936; // 4 * (Math.sqrt(2) - 1) / 3
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

    // -------------------------------------------------------------------------
    // 3. Text Layer Detection & Metrics
    // -------------------------------------------------------------------------
    function isTextLayer(layer) {
        if (!layer) return false;
        try {
            if (typeof TextLayer !== "undefined" && layer instanceof TextLayer) return true;
        } catch (e) {}
        try {
            if (layer.property("ADBE Text Properties") !== null) return true;
            if (layer.property("Source Text") !== null) return true;
        } catch (e) {}
        return false;
    }

    function getSelectedTextLayer(comp) {
        if (!comp) {
            comp = app.project.activeItem;
        }
        if (!comp || !(comp instanceof CompItem)) return null;

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) return null;

        for (var i = 0; i < sel.length; i++) {
            if (isTextLayer(sel[i])) {
                return sel[i];
            }
        }
        return null;
    }

    function getTextLayerMetrics(comp, layer) {
        if (!layer) return null;

        var t = (comp && typeof comp.time !== "undefined") ? comp.time : 0;
        var rect = null;
        try {
            if (typeof layer.sourceRectAtTime === "function") {
                rect = layer.sourceRectAtTime(t, false);
            }
        } catch (eRect) {}

        if (!rect || typeof rect.width === "undefined") {
            rect = { left: 0, top: 0, width: 800, height: 200 };
        }

        var textProp = layer.property("Source Text");
        var textDoc = textProp ? textProp.value : null;

        var isBoxText = false;
        var boxWidth = 0;
        var boxHeight = 0;
        var justification = 7412; // LEFT_JUSTIFY default
        var align = "left";
        var font = "ArialMT";
        var fontSize = 28;

        if (textDoc) {
            try {
                if (textDoc.font) font = textDoc.font;
                if (textDoc.fontSize) fontSize = textDoc.fontSize;
                if (typeof textDoc.justification !== "undefined") {
                    justification = textDoc.justification;
                }
                if (textDoc.boxText && textDoc.boxTextSize) {
                    isBoxText = true;
                    boxWidth = textDoc.boxTextSize[0];
                    boxHeight = textDoc.boxTextSize[1];
                }
            } catch (eDoc) {}
        }

        if (typeof ParagraphJustification !== "undefined") {
            if (justification === ParagraphJustification.CENTER_JUSTIFY ||
                justification === ParagraphJustification.FULL_JUSTIFY_LASTCENTER) {
                align = "center";
            } else if (justification === ParagraphJustification.RIGHT_JUSTIFY ||
                       justification === ParagraphJustification.FULL_JUSTIFY_LASTRIGHT) {
                align = "right";
            } else {
                align = "left";
            }
        } else {
            if (justification == 7414 || justification == 7417) {
                align = "center";
            } else if (justification == 7413 || justification == 7416) {
                align = "right";
            } else {
                align = "left";
            }
        }

        var detW = isBoxText && boxWidth > 0 ? Math.round(boxWidth) : Math.ceil(rect.width);
        var detH = isBoxText && boxHeight > 0 ? Math.max(Math.round(boxHeight), Math.ceil(rect.height)) : Math.ceil(rect.height);

        return {
            layer: layer,
            name: layer.name,
            rect: rect,
            isBoxText: isBoxText,
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            detectedWidth: Math.max(10, detW),
            detectedHeight: Math.max(10, detH),
            justification: justification,
            align: align,
            font: font,
            fontSize: fontSize
        };
    }

    // -------------------------------------------------------------------------
    // 4. Create Dummy 100-Word Lorem Ipsum Text Layer
    // -------------------------------------------------------------------------
    function createDummyTextLayer(comp, targetW, targetH, autoHeight, pad) {
        if (!comp) {
            comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("AE Text Precomp Demo", 1920, 1080, 1.0, 10.0, 30.0);
                if (comp.openInViewer) comp.openInViewer();
            }
        }

        var padVal = (typeof pad === "number") ? pad : 30;
        var totalW = targetW || 800;
        var textW = Math.max(20, totalW - (padVal * 2));
        var textH = (autoHeight || !targetH) ? 360 : Math.max(20, targetH - (padVal * 2));

        var dummyLayer = comp.layers.addText(LOREM_IPSUM_100);
        dummyLayer.name = "Lorem Ipsum Text Box";

        // Center initially in composition
        dummyLayer.transform.position.setValue([comp.width / 2, comp.height / 2, 0]);

        var textProp = dummyLayer.property("Source Text");
        var doc = null;
        if (textProp) {
            try {
                doc = textProp.value;
            } catch (eVal) {}
        }

        if (doc) {
            doc.text = LOREM_IPSUM_100;
            doc.fontSize = 28;
            doc.font = "ArialMT"; // System font
            doc.fillColor = [0.95, 0.95, 0.95];
            doc.applyFill = true;
            doc.applyStroke = false;
            doc.leading = 40;
            doc.justification = (typeof ParagraphJustification !== "undefined")
                ? ParagraphJustification.LEFT_JUSTIFY
                : 7412;

            try {
                if (typeof doc.setBoxTextSize === "function") {
                    doc.setBoxTextSize([textW, textH]);
                } else if (typeof doc.boxText !== "undefined") {
                    doc.boxText = true;
                    doc.boxTextSize = [textW, textH];
                }
            } catch (eBox) {}

            try {
                textProp.setValue(doc);
            } catch (eSet) {}
        }

        // If box text is not supported by host engine, word wrap to fit width
        try {
            var r = dummyLayer.sourceRectAtTime(0, false);
            if (!r || r.width > (textW * 1.4)) {
                var wrapped = wrapTextToWidth(LOREM_IPSUM_100, textW, 28);
                if (doc) {
                    doc.text = wrapped;
                    textProp.setValue(doc);
                }
            }
        } catch (eWrap) {}

        // Select dummy layer
        var totalL = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
        for (var i = 1; i <= totalL; i++) {
            var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
            if (l) l.selected = false;
        }
        dummyLayer.selected = true;

        return dummyLayer;
    }

    // -------------------------------------------------------------------------
    // 5. Create Background Card Layer (Procedural Bézier Rounded Rectangle)
    // -------------------------------------------------------------------------
    function createBackgroundShapeLayer(comp, precompW, precompH, radii, hexColor, opacity) {
        var bgLayer = comp.layers.addShape();
        bgLayer.name = "Background Card";

        // Place at center of precomposition
        bgLayer.transform.position.setValue([precompW / 2, precompH / 2, 0]);
        bgLayer.transform.anchorPoint.setValue([0, 0, 0]);

        var rootVectors = bgLayer.property("Contents") || bgLayer.property("ADBE Root Vectors Group");
        var group = rootVectors.addProperty("ADBE Vector Group");
        group.name = "Rounded Card";

        var groupContents = group.property("Contents") || group.property("ADBE Vectors Group");
        var pathProp = groupContents.addProperty("ADBE Vector Shape - Path");
        pathProp.name = "Rounded Path";

        var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
        var rgb = hexToRgb(hexColor || "#1E222D");
        fill.property("Color").setValue([rgb[0], rgb[1], rgb[2]]);
        if (fill.property("Opacity")) {
            fill.property("Opacity").setValue(opacity !== undefined ? opacity : 100);
        }

        // Static shape computation
        var pathData = computeRoundRectPathData(precompW, precompH, radii.rTL, radii.rTR, radii.rBR, radii.rBL);
        var aeShape = null;
        try {
            aeShape = new Shape();
            aeShape.vertices = pathData.points;
            aeShape.inTangents = pathData.inTangents;
            aeShape.outTangents = pathData.outTangents;
            aeShape.closed = true;
            pathProp.property("Path").setValue(aeShape);
        } catch (eShape) {}

        // Master Effect Controls driving the 4 corners independently
        var fxGroup = bgLayer.property("ADBE Effect Parade") || bgLayer.property("Effects");
        if (fxGroup) {
            try {
                var fxW = fxGroup.addProperty("ADBE Slider Control");
                fxW.name = "Card Width";
                fxW.property(1).setValue(precompW);

                var fxH = fxGroup.addProperty("ADBE Slider Control");
                fxH.name = "Card Height";
                fxH.property(1).setValue(precompH);

                var fxTL = fxGroup.addProperty("ADBE Slider Control");
                fxTL.name = "Radius Top-Left";
                fxTL.property(1).setValue(radii.rTL);

                var fxTR = fxGroup.addProperty("ADBE Slider Control");
                fxTR.name = "Radius Top-Right";
                fxTR.property(1).setValue(radii.rTR);

                var fxBR = fxGroup.addProperty("ADBE Slider Control");
                fxBR.name = "Radius Bottom-Right";
                fxBR.property(1).setValue(radii.rBR);

                var fxBL = fxGroup.addProperty("ADBE Slider Control");
                fxBL.name = "Radius Bottom-Left";
                fxBL.property(1).setValue(radii.rBL);

                // Parametric Bézier path expression
                var exprLines = [
                    "// Parametric Rounded Rectangle Path (Individual Corners)",
                    "var w = Math.max(0, effect('Card Width')(1).value);",
                    "var h = Math.max(0, effect('Card Height')(1).value);",
                    "var rTL = Math.max(0, effect('Radius Top-Left')(1).value);",
                    "var rTR = Math.max(0, effect('Radius Top-Right')(1).value);",
                    "var rBR = Math.max(0, effect('Radius Bottom-Right')(1).value);",
                    "var rBL = Math.max(0, effect('Radius Bottom-Left')(1).value);",
                    "var topSum = rTL + rTR; var botSum = rBL + rBR; var leftSum = rTL + rBL; var rgtSum = rTR + rBR;",
                    "var f = 1.0;",
                    "if (topSum > w && topSum > 0) f = Math.min(f, w / topSum);",
                    "if (botSum > w && botSum > 0) f = Math.min(f, w / botSum);",
                    "if (leftSum > h && leftSum > 0) f = Math.min(f, h / leftSum);",
                    "if (rgtSum > h && rgtSum > 0) f = Math.min(f, h / rgtSum);",
                    "rTL *= f; rTR *= f; rBR *= f; rBL *= f;",
                    "var halfW = w / 2; var halfH = h / 2;",
                    "var xMin = -halfW; var xMax = halfW; var yMin = -halfH; var yMax = halfH;",
                    "var K = 0.5522847498307936;",
                    "var pts = [",
                    "    [xMin + rTL, yMin], [xMax - rTR, yMin],",
                    "    [xMax, yMin + rTR], [xMax, yMax - rBR],",
                    "    [xMax - rBR, yMax], [xMin + rBL, yMax],",
                    "    [xMin, yMax - rBL], [xMin, yMin + rTL]",
                    "];",
                    "var inT = [",
                    "    [-rTL * K, 0], [0, 0], [0, -rTR * K], [0, 0],",
                    "    [rBR * K, 0], [0, 0], [0, rBL * K], [0, 0]",
                    "];",
                    "var outT = [",
                    "    [0, 0], [rTR * K, 0], [0, 0], [0, rBR * K],",
                    "    [0, 0], [-rBL * K, 0], [0, 0], [0, -rTL * K]",
                    "];",
                    "createPath(pts, inT, outT, true);"
                ];
                pathProp.property("Path").expression = exprLines.join("\n");
            } catch (eExpr) {}
        }

        return bgLayer;
    }

    // -------------------------------------------------------------------------
    // 6. Core Precompose Engine
    // -------------------------------------------------------------------------
    function precompTextLayer(options) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            comp = app.project.items.addComp("AE Text Precomp Demo", 1920, 1080, 1.0, 10.0, 30.0);
            if (comp.openInViewer) comp.openInViewer();
        }

        var textLayer = getSelectedTextLayer(comp);
        var createdDummy = false;
        var padding = (typeof options.padding === "number") ? Math.max(0, options.padding) : 30;

        if (!textLayer) {
            textLayer = createDummyTextLayer(comp, options.width, options.height, options.autoHeight, padding);
            createdDummy = true;
        }

        var metrics = getTextLayerMetrics(comp, textLayer);

        // Store original transforms and parenting before precompose
        var origPos = textLayer.transform.position.value;
        var origAnchor = textLayer.transform.anchorPoint.value;
        var origScale = textLayer.transform.scale.value;
        var origRot = 0;
        try {
            if (textLayer.transform.rotation) {
                origRot = textLayer.transform.rotation.value;
            } else if (textLayer.transform.zRotation) {
                origRot = textLayer.transform.zRotation.value;
            }
        } catch (eRot) {}

        var origParent = textLayer.parent;
        var origName = textLayer.name;
        var is3D = textLayer.threeDLayer;

        // Alignment (auto-detected or overridden)
        var align = metrics.align;
        if (options.forceAlign && options.forceAlign !== "auto") {
            align = options.forceAlign;
        }

        // Width calculations:
        // Precomp Width = specified width or detected width
        // Textbox Width = Precomp Width reduced by padding on both sides
        var precompW = Math.max(40, Math.round(options.width || metrics.detectedWidth || 800));
        var textboxW = Math.max(20, precompW - (padding * 2));

        // Adjust original layer's boxTextSize to the reduced textbox width if it is a paragraph box
        if (metrics.isBoxText) {
            try {
                var srcProp = textLayer.property("Source Text");
                var sDoc = srcProp ? srcProp.value : null;
                if (sDoc) {
                    if (typeof sDoc.setBoxTextSize === "function") {
                        sDoc.setBoxTextSize([textboxW, metrics.boxHeight || 300]);
                        srcProp.setValue(sDoc);
                    } else if (sDoc.boxTextSize) {
                        sDoc.boxTextSize = [textboxW, metrics.boxHeight || 300];
                        srcProp.setValue(sDoc);
                    }
                }
            } catch (eResizeBox) {}
        }

        // Re-query metrics after resizing textbox to get exact wrapped height
        metrics = getTextLayerMetrics(comp, textLayer);

        var precompH = 0;
        var textboxH = 0;

        if (options.autoHeight) {
            // Expand precomp height to fit the textbox vertical size plus padding
            var rawH = metrics.detectedHeight;
            if (metrics.rect && metrics.rect.height) {
                rawH = Math.max(rawH, Math.ceil(metrics.rect.height));
            }
            textboxH = Math.max(20, Math.round(rawH));
            precompH = Math.max(20, Math.round(textboxH + (padding * 2)));
        } else {
            precompH = Math.max(20, Math.round(options.height || 400));
            textboxH = Math.max(20, precompH - (padding * 2));
        }

        // Calculate Anchor Point on the text box
        // Automatic Anchor Point: Top of the text box (Top-Left, Top-Center, or Top-Right)
        var ax = 0;
        var ay = 0;

        if (options.autoAnchor) {
            if (metrics.isBoxText) {
                ay = 0;
                if (align === "left") {
                    ax = 0;
                } else if (align === "center") {
                    ax = textboxW / 2;
                } else if (align === "right") {
                    ax = textboxW;
                }
            } else {
                ay = metrics.rect.top;
                if (align === "left") {
                    ax = metrics.rect.left;
                } else if (align === "center") {
                    ax = metrics.rect.left + (metrics.rect.width / 2);
                } else if (align === "right") {
                    ax = metrics.rect.left + metrics.rect.width;
                }
            }
        } else {
            // Standard Center Anchor Point
            ax = metrics.rect.left + (metrics.rect.width / 2);
            ay = metrics.rect.top + (metrics.rect.height / 2);
        }

        // Calculate exact Main Comp coordinates where [ax, ay] is located
        var sx = origScale[0] / 100.0;
        var sy = origScale[1] / 100.0;
        var dx = (ax - origAnchor[0]) * sx;
        var dy = (ay - origAnchor[1]) * sy;
        var rad = (origRot || 0) * Math.PI / 180.0;
        var cosA = Math.cos(rad);
        var sinA = Math.sin(rad);

        var compPosX = origPos[0] + (dx * cosA - dy * sinA);
        var compPosY = origPos[1] + (dx * sinA + dy * cosA);
        var compPosZ = (origPos.length > 2) ? origPos[2] : 0;

        // Precomposition Name
        var precompName = trimStr(options.precompName);
        if (!precompName) {
            precompName = origName + " Comp";
        }

        // Execute Precompose
        var newComp = comp.layers.precompose([textLayer.index], precompName, true);
        if (!newComp) {
            var numItems = (typeof app.project.numItems !== "undefined") ? app.project.numItems : app.project.items.length;
            for (var p = 1; p <= numItems; p++) {
                var it = (typeof app.project.item === "function") ? app.project.item(p) : app.project.items[p - 1];
                if (it && it.name === precompName && (it instanceof CompItem)) {
                    newComp = it;
                    break;
                }
            }
        }

        if (!newComp) {
            throw new Error("Unable to create precomposition.");
        }

        // Set Precomposition Dimensions
        newComp.width = precompW;
        newComp.height = precompH;

        // Find the resulting precomp layer in the parent comp
        var precompLayer = null;
        var totalL = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
        for (var i = 1; i <= totalL; i++) {
            var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
            if (l && l.source === newComp) {
                precompLayer = l;
                break;
            }
        }
        if (!precompLayer && comp.selectedLayers && comp.selectedLayers.length > 0) {
            precompLayer = comp.selectedLayers[0];
        }

        // Inside newComp: configure inner text layer
        var innerTextLayer = (typeof newComp.layer === "function") ? newComp.layer(1) : newComp.layers[0];
        if (innerTextLayer) {
            // Update boxText size to the reduced textbox width
            if (metrics.isBoxText) {
                try {
                    var inProp = innerTextLayer.property("Source Text");
                    var inDoc = inProp ? inProp.value : null;
                    if (inDoc) {
                        if (typeof inDoc.setBoxTextSize === "function") {
                            inDoc.setBoxTextSize([textboxW, textboxH]);
                            inProp.setValue(inDoc);
                        } else if (inDoc.boxTextSize) {
                            inDoc.boxTextSize = [textboxW, textboxH];
                            inProp.setValue(inDoc);
                        }
                    }
                } catch (eInBox) {}
            }

            // Position and Anchor Point inside newComp:
            // Text is offset by padding inward from edges
            if (options.autoAnchor) {
                innerTextLayer.transform.anchorPoint.setValue([ax, ay]);

                var innerX = padding;
                if (align === "center") {
                    innerX = precompW / 2;
                } else if (align === "right") {
                    innerX = precompW - padding;
                }
                var innerY = padding;
                innerTextLayer.transform.position.setValue([innerX, innerY, 0]);
            } else {
                innerTextLayer.transform.anchorPoint.setValue([ax, ay]);
                innerTextLayer.transform.position.setValue([precompW / 2, precompH / 2, 0]);
            }

            innerTextLayer.transform.scale.setValue([100, 100, 100]);
            try {
                if (innerTextLayer.transform.rotation) innerTextLayer.transform.rotation.setValue(0);
                if (innerTextLayer.transform.zRotation) innerTextLayer.transform.zRotation.setValue(0);
            } catch (eZeroRot) {}
        }

        // Inside newComp: Add Background Card if requested
        if (options.addBackground) {
            var radii = {
                rTL: options.corners.TL ? padding : 0,
                rTR: options.corners.TR ? padding : 0,
                rBR: options.corners.BR ? padding : 0,
                rBL: options.corners.BL ? padding : 0
            };
            var bgLayer = createBackgroundShapeLayer(
                newComp,
                precompW,
                precompH,
                radii,
                options.bgColor,
                options.bgOpacity
            );

            // Move background shape layer behind the text layer
            try {
                if (typeof bgLayer.moveAfter === "function" && innerTextLayer) {
                    bgLayer.moveAfter(innerTextLayer);
                } else if (typeof bgLayer.moveToEnd === "function") {
                    bgLayer.moveToEnd();
                }
            } catch (eMove) {}
        }

        // In parent comp: configure precompLayer
        if (precompLayer) {
            var precompAnchorX = 0;
            var precompAnchorY = 0;

            if (options.autoAnchor) {
                // Precomp anchor point matches top of the text box (offset by padding)
                precompAnchorY = padding;
                if (align === "left") {
                    precompAnchorX = padding;
                } else if (align === "center") {
                    precompAnchorX = precompW / 2;
                } else if (align === "right") {
                    precompAnchorX = precompW - padding;
                }
            } else {
                precompAnchorX = precompW / 2;
                precompAnchorY = precompH / 2;
            }

            precompLayer.transform.anchorPoint.setValue([precompAnchorX, precompAnchorY, 0]);
            precompLayer.transform.position.setValue([compPosX, compPosY, compPosZ]);
            precompLayer.transform.scale.setValue(origScale);
            try {
                if (precompLayer.transform.rotation) precompLayer.transform.rotation.setValue(origRot);
                if (precompLayer.transform.zRotation) precompLayer.transform.zRotation.setValue(origRot);
            } catch (eSetRot) {}

            if (origParent) {
                try { precompLayer.parent = origParent; } catch (ePar) {}
            }
            if (is3D) {
                try { precompLayer.threeDLayer = true; } catch (e3D) {}
            }

            precompLayer.selected = true;
        }

        return {
            success: true,
            newComp: newComp,
            precompLayer: precompLayer,
            width: precompW,
            height: precompH,
            textboxWidth: textboxW,
            padding: padding,
            align: align,
            createdDummy: createdDummy,
            name: precompName
        };
    }

    // -------------------------------------------------------------------------
    // 7. ScriptUI Color Picker (AE_Extruded_Round_corners pattern)
    // -------------------------------------------------------------------------
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
        txtHex.helpTip = "Direct hex color input (e.g. #1E222D)";

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
                btnSwatch.domElement.style.background = newHex;
                btnSwatch.domElement.style.border = "1px solid #777";
            }

            if (triggerChange && typeof picker.onChange === "function") {
                picker.onChange();
            }
        }

        btnSwatch.onClick = function() {
            var curHex = picker._color || "#1E222D";
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

        picker.setColor = setColor;
        setColor(defaultHex, false);
        return picker;
    }

    // -------------------------------------------------------------------------
    // 8. ScriptUI Window & Interface Panels
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

    // --- Header ---
    var pnlHeader = win.add("panel", undefined, SCRIPT_NAME + " " + SCRIPT_VERSION);
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblSubTitle = pnlHeader.add("statictext", undefined, "Text Box Precomposer with Padding, Auto Anchor & Rounded Background");
    lblSubTitle.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.65, 0.95, 1], 1);

    // --- Detection & Status Panel ---
    var pnlDetect = win.add("panel", undefined, "Text Layer Detection");
    pnlDetect.orientation = "column";
    pnlDetect.alignChildren = ["fill", "top"];
    pnlDetect.spacing = 6;
    pnlDetect.margins = 10;

    var grpStatus = pnlDetect.add("group");
    grpStatus.orientation = "row";
    grpStatus.alignment = ["fill", "top"];
    var lblStatusIcon = grpStatus.add("statictext", undefined, "[Layer]:");
    lblStatusIcon.preferredSize = [60, -1];
    var lblStatusText = grpStatus.add("statictext", undefined, "Scanning active selection...");
    lblStatusText.alignment = ["fill", "center"];

    var btnAutoDetect = pnlDetect.add("button", undefined, "Auto-Detect Selected Text Size");
    btnAutoDetect.helpTip = "Detects dimensions and justification from the currently selected text layer.";

    // --- Dimensions & Padding Panel ---
    var pnlDims = win.add("panel", undefined, "Precomp Dimensions & Padding");
    pnlDims.orientation = "column";
    pnlDims.alignChildren = ["fill", "top"];
    pnlDims.spacing = 8;
    pnlDims.margins = 10;

    // Width Row
    var grpWidth = pnlDims.add("group");
    grpWidth.orientation = "row";
    grpWidth.alignment = ["fill", "top"];
    var lblWidth = grpWidth.add("statictext", undefined, "Precomp Width (px):");
    lblWidth.preferredSize = [135, -1];
    var txtWidth = grpWidth.add("edittext", undefined, "800");
    txtWidth.alignment = ["fill", "center"];

    // Quick Width Buttons
    var grpQuickW = pnlDims.add("group");
    grpQuickW.orientation = "row";
    grpQuickW.alignment = ["fill", "top"];
    var lblPresets = grpQuickW.add("statictext", undefined, "Quick Widths:");
    lblPresets.preferredSize = [135, -1];
    var btnW600 = grpQuickW.add("button", undefined, "600");
    btnW600.preferredSize = [48, 22];
    var btnW800 = grpQuickW.add("button", undefined, "800");
    btnW800.preferredSize = [48, 22];
    var btnW1080 = grpQuickW.add("button", undefined, "1080");
    btnW1080.preferredSize = [48, 22];
    var btnW1920 = grpQuickW.add("button", undefined, "1920");
    btnW1920.preferredSize = [48, 22];

    btnW600.onClick = function() { txtWidth.text = "600"; };
    btnW800.onClick = function() { txtWidth.text = "800"; };
    btnW1080.onClick = function() { txtWidth.text = "1080"; };
    btnW1920.onClick = function() { txtWidth.text = "1920"; };

    // Padding Row
    var grpPad = pnlDims.add("group");
    grpPad.orientation = "row";
    grpPad.alignment = ["fill", "top"];
    var lblPad = grpPad.add("statictext", undefined, "Padding (px):");
    lblPad.preferredSize = [135, -1];
    var sldPad = grpPad.add("slider", undefined, 30, 0, 120);
    sldPad.minvalue = 0;
    sldPad.maxvalue = 120;
    sldPad.value = 30;
    sldPad.alignment = ["fill", "center"];
    var txtPad = grpPad.add("edittext", undefined, "30");
    txtPad.characters = 4;

    sldPad.onChanging = sldPad.onChange = function() {
        txtPad.text = String(Math.round(sldPad.value));
    };
    txtPad.onChange = function() {
        var v = parseFloat(txtPad.text) || 0;
        sldPad.value = Math.max(0, Math.min(120, v));
    };

    // Quick Padding Buttons
    var grpQuickPad = pnlDims.add("group");
    grpQuickPad.orientation = "row";
    grpQuickPad.alignment = ["fill", "top"];
    var lblQuickP = grpQuickPad.add("statictext", undefined, "Quick Padding:");
    lblQuickP.preferredSize = [135, -1];
    var btnP0 = grpQuickPad.add("button", undefined, "0");
    btnP0.preferredSize = [48, 22];
    var btnP16 = grpQuickPad.add("button", undefined, "16");
    btnP16.preferredSize = [48, 22];
    var btnP30 = grpQuickPad.add("button", undefined, "30");
    btnP30.preferredSize = [48, 22];
    var btnP48 = grpQuickPad.add("button", undefined, "48");
    btnP48.preferredSize = [48, 22];

    btnP0.onClick = function() { sldPad.value = 0; txtPad.text = "0"; };
    btnP16.onClick = function() { sldPad.value = 16; txtPad.text = "16"; };
    btnP30.onClick = function() { sldPad.value = 30; txtPad.text = "30"; };
    btnP48.onClick = function() { sldPad.value = 48; txtPad.text = "48"; };

    // Automatic Precomp Height Checkbox
    var chkAutoHeight = pnlDims.add("checkbox", undefined, "automatic precomp height");
    chkAutoHeight.value = true;
    chkAutoHeight.helpTip = "Expands the height of the precomp to fit the textbox vertical size plus padding.";

    // Manual Height Row
    var grpHeight = pnlDims.add("group");
    grpHeight.orientation = "row";
    grpHeight.alignment = ["fill", "top"];
    var lblHeight = grpHeight.add("statictext", undefined, "Manual Height (px):");
    lblHeight.preferredSize = [135, -1];
    var txtHeight = grpHeight.add("edittext", undefined, "400");
    txtHeight.alignment = ["fill", "center"];
    txtHeight.enabled = false;

    chkAutoHeight.onClick = function() {
        txtHeight.enabled = !chkAutoHeight.value;
    };

    // --- Anchor Point Options Panel ---
    var pnlAnchor = win.add("panel", undefined, "Anchor Point & Alignment");
    pnlAnchor.orientation = "column";
    pnlAnchor.alignChildren = ["fill", "top"];
    pnlAnchor.spacing = 8;
    pnlAnchor.margins = 10;

    var chkAutoAnchor = pnlAnchor.add("checkbox", undefined, "automatic anchor point");
    chkAutoAnchor.value = true;
    chkAutoAnchor.helpTip = "Moves anchor point to the top of the text box (Top-Left, Top-Center, or Top-Right depending on alignment), offset by padding.";

    var grpAlign = pnlAnchor.add("group");
    grpAlign.orientation = "row";
    grpAlign.alignment = ["fill", "top"];
    var lblAlign = grpAlign.add("statictext", undefined, "Anchor Alignment:");
    lblAlign.preferredSize = [135, -1];
    var dropAlign = grpAlign.add("dropdownlist", undefined, [
        "Auto-detect from Alignment",
        "Force Top-Left",
        "Force Top-Center",
        "Force Top-Right"
    ]);
    dropAlign.selection = 0;
    dropAlign.alignment = ["fill", "center"];

    // --- Background Card & Rounded Corners Panel ---
    var pnlBg = win.add("panel", undefined, "Background Card (Custom Rounded Corners)");
    pnlBg.orientation = "column";
    pnlBg.alignChildren = ["fill", "top"];
    pnlBg.spacing = 8;
    pnlBg.margins = 10;

    var chkAddBg = pnlBg.add("checkbox", undefined, "Add Background Card (Bézier Shape Layer)");
    chkAddBg.value = true;
    chkAddBg.helpTip = "Creates a shape layer behind the text with 4 independent corner radii (AE_Extruded_Round_corners).";

    // Corners Selection Section
    var grpCornerTitle = pnlBg.add("group");
    grpCornerTitle.orientation = "row";
    grpCornerTitle.alignment = ["fill", "top"];
    var lblWhichCorners = grpCornerTitle.add("statictext", undefined, "Corners reacting to padding:");
    lblWhichCorners.preferredSize = [180, -1];

    // 2x2 Grid of Corners
    var grpCornerGrid = pnlBg.add("group");
    grpCornerGrid.orientation = "column";
    grpCornerGrid.alignChildren = ["fill", "top"];
    grpCornerGrid.spacing = 4;
    grpCornerGrid.margins = [10, 0, 0, 0];

    var grpCornersRow1 = grpCornerGrid.add("group");
    grpCornersRow1.orientation = "row";
    grpCornersRow1.spacing = 20;
    var chkTL = grpCornersRow1.add("checkbox", undefined, "Top-Left (TL)");
    chkTL.value = true;
    var chkTR = grpCornersRow1.add("checkbox", undefined, "Top-Right (TR)");
    chkTR.value = true;

    var grpCornersRow2 = grpCornerGrid.add("group");
    grpCornersRow2.orientation = "row";
    grpCornersRow2.spacing = 20;
    var chkBL = grpCornersRow2.add("checkbox", undefined, "Bottom-Left (BL)");
    chkBL.value = true;
    var chkBR = grpCornersRow2.add("checkbox", undefined, "Bottom-Right (BR)");
    chkBR.value = true;

    // Quick Corner Presets
    var grpQuickCorners = pnlBg.add("group");
    grpQuickCorners.orientation = "row";
    grpQuickCorners.alignment = ["fill", "top"];
    var btnAllCorners = grpQuickCorners.add("button", undefined, "All 4");
    btnAllCorners.preferredSize = [60, 20];
    var btnTopCorners = grpQuickCorners.add("button", undefined, "Top Only");
    btnTopCorners.preferredSize = [65, 20];
    var btnChatBubble = grpQuickCorners.add("button", undefined, "Chat Bubble");
    btnChatBubble.preferredSize = [75, 20];
    var btnNoCorners = grpQuickCorners.add("button", undefined, "Sharp (0)");
    btnNoCorners.preferredSize = [65, 20];

    btnAllCorners.onClick = function() { chkTL.value = true; chkTR.value = true; chkBL.value = true; chkBR.value = true; };
    btnTopCorners.onClick = function() { chkTL.value = true; chkTR.value = true; chkBL.value = false; chkBR.value = false; };
    btnChatBubble.onClick = function() { chkTL.value = true; chkTR.value = true; chkBR.value = true; chkBL.value = false; };
    btnNoCorners.onClick = function() { chkTL.value = false; chkTR.value = false; chkBL.value = false; chkBR.value = false; };

    // Background Color & Opacity
    var grpBgColor = pnlBg.add("group");
    grpBgColor.orientation = "row";
    grpBgColor.alignment = ["fill", "top"];
    var lblBgCol = grpBgColor.add("statictext", undefined, "Background Color:");
    lblBgCol.preferredSize = [135, -1];
    var cpBgColor = createColorPicker(grpBgColor, "#1E222D");

    var grpBgOp = pnlBg.add("group");
    grpBgOp.orientation = "row";
    grpBgOp.alignment = ["fill", "top"];
    var lblBgOp = grpBgOp.add("statictext", undefined, "Opacity (%):");
    lblBgOp.preferredSize = [135, -1];
    var sldBgOp = grpBgOp.add("slider", undefined, 100, 0, 100);
    sldBgOp.minvalue = 0;
    sldBgOp.maxvalue = 100;
    sldBgOp.value = 100;
    sldBgOp.alignment = ["fill", "center"];
    var txtBgOp = grpBgOp.add("edittext", undefined, "100");
    txtBgOp.characters = 4;

    sldBgOp.onChanging = sldBgOp.onChange = function() {
        txtBgOp.text = String(Math.round(sldBgOp.value));
    };
    txtBgOp.onChange = function() {
        var v = parseFloat(txtBgOp.text) || 0;
        sldBgOp.value = Math.max(0, Math.min(100, v));
    };

    chkAddBg.onClick = function() {
        var on = chkAddBg.value;
        chkTL.enabled = on;
        chkTR.enabled = on;
        chkBL.enabled = on;
        chkBR.enabled = on;
        btnAllCorners.enabled = on;
        btnTopCorners.enabled = on;
        btnChatBubble.enabled = on;
        btnNoCorners.enabled = on;
        cpBgColor.button.enabled = on;
        cpBgColor.edittext.enabled = on;
        sldBgOp.enabled = on;
        txtBgOp.enabled = on;
    };

    // --- Action Buttons ---
    var pnlActions = win.add("panel", undefined, "Actions");
    pnlActions.orientation = "column";
    pnlActions.alignChildren = ["fill", "top"];
    pnlActions.spacing = 8;
    pnlActions.margins = 10;

    var btnPrecomp = pnlActions.add("button", undefined, "Precomp Selected Text Box");
    btnPrecomp.preferredSize = [-1, 32];
    btnPrecomp.helpTip = "Precompose selected text box with padding, auto anchor & rounded background.";

    var btnDummyOnly = pnlActions.add("button", undefined, "Create 100-Word Dummy Layer Only");
    btnDummyOnly.helpTip = "Creates a 100-word Lorem Ipsum text layer in the active composition without precomposing.";

    var lblFeedback = win.add("statictext", undefined, "Ready.");
    lblFeedback.alignment = ["fill", "bottom"];

    // --- Link Footer ---
    var grpFooter = win.add("group");
    grpFooter.orientation = "row";
    grpFooter.alignment = ["fill", "bottom"];
    grpFooter.alignChildren = ["center", "center"];
    grpFooter.margins = [0, 4, 0, 0];
    var lblRepo = grpFooter.add("statictext", undefined, "GitHub: work2survive/AE_JS_builder");
    lblRepo.helpTip = "https://github.com/work2survive/AE_JS_builder";
    lblRepo.onClick = function() {
        var url = "https://github.com/work2survive/AE_JS_builder";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os && $.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else if (typeof system !== "undefined" && system.callSystem) {
            system.callSystem('open "' + url + '"');
        }
    };

    // -------------------------------------------------------------------------
    // 9. UI Event Handlers & State Sync
    // -------------------------------------------------------------------------
    function syncLayerDetection() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            lblStatusText.text = "No active composition found.";
            btnAutoDetect.enabled = false;
            return null;
        }

        var textLayer = getSelectedTextLayer(comp);
        if (textLayer) {
            var metrics = getTextLayerMetrics(comp, textLayer);
            var typeStr = metrics.isBoxText ? "Paragraph Box" : "Point Text";
            var alignStr = metrics.align.toUpperCase();
            lblStatusText.text = "'" + textLayer.name + "' (" + typeStr + ", " + alignStr + ")";
            btnAutoDetect.enabled = true;
            return metrics;
        } else {
            lblStatusText.text = "None selected (will create 100-word dummy layer)";
            btnAutoDetect.enabled = false;
            return null;
        }
    }

    btnAutoDetect.onClick = function() {
        var metrics = syncLayerDetection();
        if (metrics) {
            var padVal = parseFloat(txtPad.text) || 30;
            // Proposed precomp width = text width + padding on both sides
            var proposedPrecompW = metrics.detectedWidth + (padVal * 2);
            txtWidth.text = String(proposedPrecompW);
            txtHeight.text = String(metrics.detectedHeight + (padVal * 2));

            if (metrics.align === "center") {
                dropAlign.selection = 2; // Top-Center
            } else if (metrics.align === "right") {
                dropAlign.selection = 3; // Top-Right
            } else {
                dropAlign.selection = 1; // Top-Left
            }

            lblFeedback.text = "Auto-detected: Text " + metrics.detectedWidth + "x" + metrics.detectedHeight + "px -> Precomp " + proposedPrecompW + "px (" + metrics.align + ")";
        } else {
            alert("Please select a text layer in your active composition first.");
        }
    };

    btnDummyOnly.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("Create 100-Word Dummy Layer");
        try {
            var comp = app.project.activeItem;
            var w = parseFloat(txtWidth.text) || 800;
            var h = parseFloat(txtHeight.text) || 400;
            var autoH = chkAutoHeight.value;
            var padVal = parseFloat(txtPad.text) || 30;

            var dummy = createDummyTextLayer(comp, w, h, autoH, padVal);
            syncLayerDetection();
            lblFeedback.text = "Created dummy layer: '" + dummy.name + "' with 100 words of Lorem Ipsum.";
        } catch (err) {
            alert("Error creating dummy text layer:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    btnPrecomp.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("AE Text Precomp");
        try {
            var w = parseFloat(txtWidth.text) || 800;
            var h = parseFloat(txtHeight.text) || 400;
            var autoH = chkAutoHeight.value;
            var autoAnc = chkAutoAnchor.value;
            var padVal = parseFloat(txtPad.text) || 0;

            var forceAlign = "auto";
            if (dropAlign.selection) {
                var selIdx = dropAlign.selection.index;
                if (selIdx === 1) forceAlign = "left";
                else if (selIdx === 2) forceAlign = "center";
                else if (selIdx === 3) forceAlign = "right";
            }

            var addBg = chkAddBg.value;
            var corners = {
                TL: chkTL.value,
                TR: chkTR.value,
                BR: chkBR.value,
                BL: chkBL.value
            };
            var bgColor = cpBgColor._color || "#1E222D";
            var bgOpacity = parseFloat(txtBgOp.text) || 100;

            var res = precompTextLayer({
                width: w,
                height: h,
                padding: padVal,
                autoHeight: autoH,
                autoAnchor: autoAnc,
                forceAlign: forceAlign,
                addBackground: addBg,
                corners: corners,
                bgColor: bgColor,
                bgOpacity: bgOpacity
            });

            syncLayerDetection();
            var msg = "Precomposed '" + res.name + "' [" + res.width + "x" + res.height + "px, Padding: " + res.padding + "px, Textbox: " + res.textboxWidth + "px]";
            if (res.createdDummy) {
                msg += " (Generated 100-word dummy layer)";
            }
            lblFeedback.text = msg;
        } catch (err) {
            alert("Error precomposing text box:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    // Initial check
    syncLayerDetection();

    win.layout.layout(true);
    win.onResizing = win.onResize = function() { this.layout.resize(); };

    if (win instanceof Window) {
        win.center();
        win.show();
    }
})(this);
