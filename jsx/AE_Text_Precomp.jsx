// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT PRECOMP v1.6.0
// =============================================================================
//
// PURPOSE:
//   Precomposes a selected text box (paragraph or point text) into a neatly-sized
//   composition with customizable padding, dynamic top anchor point rigger,
//   a procedural 2D rounded rectangle background card featuring 4 independent
//   corner radii (based on AE_Extruded_Round_corners), and kinetic division actions:
//   "Divide by Words" and "Divide by Lines".
//
// REPOSITORY:
//   https://github.com/work2survive/AE-text-precomp
//
// COHERENCE & COMPATIBILITY REFERENCES:
//   - Text Properties Extraction & In-Memory Store:
//     https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx
//   - Procedural Rounded Corner Background Card & Color Picker:
//     https://github.com/work2survive/AE_Extruded_Round_corners
//   - Web Emulator Live Demo:
//     https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true
//
// KEY FEATURES:
//   1. "Divide by Words" Action:
//      - Creates an individual text layer for each word placed at its exact matching
//        visual position with sub-pixel typographic kerning, then encapsulates inside precomp.
//   2. "Divide by Lines" Action:
//      - Creates an individual text layer for each line placed at its exact matching
//        position with proper leading and justification, then encapsulates inside precomp.
//   3. Zero-Shift Text Box Positioning:
//      - The exact visual position of the original text box on screen is preserved
//        pixel-for-pixel when precomposed, regardless of anchor point placement.
//      - Whenever an anchor point is changed, position is automatically compensated
//        using the layer's rotation and scale transformation matrix.
//   4. Padding & Textbox Width Reduction:
//      - Reduces the textbox width by (2 * padding) to accommodate padding inside the precomp.
//      - When "automatic precomp height" is active, precomp height expands to fit
//        the wrapped textbox vertical size plus top and bottom padding.
//      - Anchor point automatically accounts for padding, resting cleanly at the
//        top of the text box (Top-Left, Top-Center, or Top-Right based on alignment).
//   5. Coherent Text Properties Extraction Engine:
//      - Follows Text_Properties_To_Effects.jsx for robust typography metrics,
//        paragraph justification, box text detection, sourceRect bounds, and
//        in-memory $.global.AE_TEXT_BOX_MEMORY caching.
//   6. Procedural Rounded Background Card (AE_Extruded_Round_corners):
//      - Creates an individual 4-corner rounded rectangle shape layer behind the text.
//      - Interactive UI asks which corners will react to the padding to round.
//      - 8-vertex Bézier path with W3C CSS proportional overlap protection.
//      - Master Effect Controls (Radius Top-Left, Top-Right, Bottom-Right, Bottom-Left,
//        Card Width, Card Height) with live parametric expressions on the Path property.
//   7. Integrated Interactive Color Picker:
//      - Custom swatch button + hex input (#RRGGBB) compatible with AE native
//        $.colorPicker, Windows OS color picker, and AE_JS_builder web emulator.
//   8. 100-Word Lorem Ipsum Dummy Layer:
//      - If no text layer is selected, creates a 100-word dummy layer with a system font (ArialMT).
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_NAME = "AE Text Precomp";
    var SCRIPT_VERSION = "v1.6.0";
    var TEXT_PROP_REF_URL = "https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx";
    var EXTRUDED_CORNERS_REF_URL = "https://github.com/work2survive/AE_Extruded_Round_corners";

    // -------------------------------------------------------------------------
    // 1. Global In-Memory Cache Initialization (from Text_Properties_To_Effects.jsx)
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

    if (typeof $root.global.AE_TEXT_BOX_MEMORY === "undefined") {
        $root.global.AE_TEXT_BOX_MEMORY = {
            layerName: "",
            words: [],
            wordWidths: [],
            lines: [],
            lineWidths: [],
            spaceWidth: 0,
            fontSize: 0,
            boxWidth: 0,
            boxHeight: 0,
            totalWords: 0,
            totalLines: 0,
            maxLineWidth: 0,
            maxWordWidth: 0,
            timestamp: 0
        };
    }

    // -------------------------------------------------------------------------
    // 2. ES3 Helpers & Polyfills
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

    // High-precision measurement engine matching the browser SVG engine and AE calibrated tables
    function measureTextExact(str, fontSize, fontName) {
        if (!str) return 0;
        var fs = Number(fontSize) || 28;
        var cleanFont = trimStr(String(fontName || "Arial").replace(/['"]/g, ""));

        // 1. If in browser / simulator environment, use Canvas 2D font metric
        if (typeof document !== "undefined") {
            try {
                var c = document.getElementById("__ae_precomp_measure_canvas");
                if (!c) {
                    c = document.createElement("canvas");
                    c.id = "__ae_precomp_measure_canvas";
                    c.style.display = "none";
                    document.body.appendChild(c);
                }
                var ctx = c.getContext("2d");
                var fontLower = cleanFont.toLowerCase();
                var fontStack = cleanFont;
                if (fontLower.indexOf("courier") !== -1 || fontLower.indexOf("mono") !== -1) {
                    fontStack = "'" + cleanFont + "', 'Courier New', monospace";
                } else if (fontLower.indexOf("times") !== -1 || fontLower.indexOf("georgia") !== -1 || fontLower.indexOf("serif") !== -1) {
                    fontStack = "'" + cleanFont + "', Georgia, 'Times New Roman', serif";
                } else {
                    fontStack = "'" + cleanFont + "', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                }
                ctx.font = fs + "px " + fontStack;
                var m = ctx.measureText(str).width;
                if (m && !isNaN(m) && m > 0) return m;
            } catch (e) {}
        }

        // 2. Calibrated typographic metric table for ExtendScript desktop fallback
        var fontLower2 = cleanFont.toLowerCase();
        if (fontLower2.indexOf("courier") !== -1 || fontLower2.indexOf("mono") !== -1) {
            return str.length * fs * 0.60;
        }

        var isTrebuchet = (fontLower2.indexOf("trebuchet") !== -1);
        var isVerdana   = (fontLower2.indexOf("verdana") !== -1);
        var isImpact    = (fontLower2.indexOf("impact") !== -1);
        var isTimes     = (fontLower2.indexOf("times") !== -1);
        var isGeorgia   = (fontLower2.indexOf("georgia") !== -1 || fontLower2.indexOf("serif") !== -1);

        var total = 0;
        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            var code = ch.charCodeAt(0);
            if (code === 32) {
                total += isTrebuchet ? (fs * 0.30) : (isVerdana ? (fs * 0.35) : (isImpact ? (fs * 0.18) : (isGeorgia ? (fs * 0.24) : (isTimes ? (fs * 0.25) : (fs * 0.28)))));
            } else if ("ijl|!.,:;'I`".indexOf(ch) !== -1) {
                total += isTrebuchet ? (fs * 0.29) : (isVerdana ? (fs * 0.27) : (isImpact ? (fs * 0.27) : (isGeorgia ? (fs * 0.29) : (isTimes ? (fs * 0.28) : (fs * 0.22)))));
            } else if ("frt[](){}".indexOf(ch) !== -1) {
                total += isTrebuchet ? (fs * 0.35) : (isVerdana ? (fs * 0.38) : (isImpact ? (fs * 0.32) : (isGeorgia ? (fs * 0.38) : (isTimes ? (fs * 0.34) : (fs * 0.33)))));
            } else if ("wmWM@#%&".indexOf(ch) !== -1) {
                total += isTrebuchet ? (fs * 0.78) : (isVerdana ? (fs * 0.90) : (isImpact ? (fs * 0.75) : (isGeorgia ? (fs * 0.90) : (isTimes ? (fs * 0.85) : (fs * 0.83)))));
            } else if (ch >= 'A' && ch <= 'Z') {
                total += isTrebuchet ? (fs * 0.60) : (isVerdana ? (fs * 0.68) : (isImpact ? (fs * 0.52) : (isGeorgia ? (fs * 0.67) : (isTimes ? (fs * 0.70) : (fs * 0.67)))));
            } else if (ch >= '0' && ch <= '9') {
                total += isTrebuchet ? (fs * 0.54) : (isVerdana ? (fs * 0.60) : (isImpact ? (fs * 0.51) : (isGeorgia ? (fs * 0.52) : (isTimes ? (fs * 0.50) : (fs * 0.56)))));
            } else if (code > 255) {
                total += fs * 1.0;
            } else {
                total += isTrebuchet ? (fs * 0.54) : (isVerdana ? (fs * 0.60) : (isImpact ? (fs * 0.51) : (isGeorgia ? (fs * 0.50) : (isTimes ? (fs * 0.44) : (fs * 0.56)))));
            }
        }
        return total;
    }

    function applyTextDocStyling(targetLayer, sampleDoc, textContent, sourceLayer) {
        if (!targetLayer) return;
        try {
            var prop = targetLayer.property("Source Text");
            if (!prop) return;

            // Strategy 1: Direct native TextDocument assignment from source text layer
            // Setting a cloned TextDocument directly preserves 100% font identity, fontObject,
            // kerning, tracking, faux styles, and fills without triggering AE's font substitution.
            var directDone = false;
            try {
                var docToSet = null;
                if (sourceLayer && isTextLayer(sourceLayer)) {
                    var sProp = sourceLayer.property("Source Text");
                    if (sProp && sProp.value) {
                        docToSet = sProp.value;
                    }
                } else if (sampleDoc && !sampleDoc.boxText) {
                    docToSet = sampleDoc;
                }

                if (docToSet && !docToSet.boxText) {
                    docToSet.text = textContent;
                    prop.setValue(docToSet);
                    var vCheck = prop.value;
                    if (vCheck && vCheck.text === textContent) {
                        directDone = true;
                    }
                }
            } catch (eDir) {
                directDone = false;
            }

            if (directDone) return;

            // Strategy 2: Robust attribute-by-attribute transfer with FontObject priority
            var doc = prop.value;
            doc.text = textContent;

            if (sampleDoc) {
                // 1. Font Object Assignment (AE 24+ - highest priority, avoids substitute proxies)
                var fontApplied = false;
                if (sampleDoc.fontObject) {
                    try {
                        doc.fontObject = sampleDoc.fontObject;
                        fontApplied = true;
                    } catch (eFO) {
                        fontApplied = false;
                    }
                }

                // 2. Query Font Server via app.fonts if available (AE 24+)
                if (!fontApplied && typeof app !== "undefined" && app.fonts) {
                    try {
                        if (sampleDoc.font && typeof app.fonts.getFontsByPostScriptName === "function") {
                            var matchedFonts = app.fonts.getFontsByPostScriptName(sampleDoc.font);
                            if (matchedFonts && matchedFonts.length > 0) {
                                doc.fontObject = matchedFonts[0];
                                fontApplied = true;
                            }
                        }
                    } catch (eFMatch) {}

                    if (!fontApplied && sampleDoc.fontFamily && typeof app.fonts.getFontsByFamilyNameAndStyleName === "function") {
                        try {
                            var matchedFonts2 = app.fonts.getFontsByFamilyNameAndStyleName(sampleDoc.fontFamily, sampleDoc.fontStyle || "Regular");
                            if (matchedFonts2 && matchedFonts2.length > 0) {
                                doc.fontObject = matchedFonts2[0];
                                fontApplied = true;
                            }
                        } catch (eFMatch2) {}
                    }
                }

                // 3. PostScript font name assignment (Standard across all AE versions)
                if (!fontApplied && sampleDoc.font) {
                    try {
                        doc.font = sampleDoc.font;
                        fontApplied = true;
                    } catch (eF) {}
                }

                // 4. Font Size
                if (typeof sampleDoc.fontSize === "number" && sampleDoc.fontSize > 0) {
                    doc.fontSize = sampleDoc.fontSize;
                }

                // 5. Fill properties
                if (typeof sampleDoc.applyFill !== "undefined") {
                    doc.applyFill = sampleDoc.applyFill;
                }
                if (sampleDoc.applyFill && sampleDoc.fillColor) {
                    try { doc.fillColor = sampleDoc.fillColor; } catch (eFC) {}
                }

                // 6. Stroke properties
                if (typeof sampleDoc.applyStroke !== "undefined") {
                    doc.applyStroke = sampleDoc.applyStroke;
                }
                if (sampleDoc.applyStroke && sampleDoc.strokeColor) {
                    try { doc.strokeColor = sampleDoc.strokeColor; } catch (eSC) {}
                    if (typeof sampleDoc.strokeWidth === "number") {
                        doc.strokeWidth = sampleDoc.strokeWidth;
                    }
                }
                if (typeof sampleDoc.strokeOverFill !== "undefined") {
                    try { doc.strokeOverFill = sampleDoc.strokeOverFill; } catch (eSOF) {}
                }

                // 7. Typography spacing & scale
                if (typeof sampleDoc.tracking !== "undefined") {
                    try { doc.tracking = sampleDoc.tracking; } catch (eTr) {}
                }
                if (typeof sampleDoc.leading !== "undefined") {
                    try { doc.leading = sampleDoc.leading; } catch (eLd) {}
                }
                if (typeof sampleDoc.autoLeading !== "undefined") {
                    try { doc.autoLeading = sampleDoc.autoLeading; } catch (eAL) {}
                }
                if (typeof sampleDoc.baselineShift !== "undefined") {
                    try { doc.baselineShift = sampleDoc.baselineShift; } catch (eBS) {}
                }
                if (typeof sampleDoc.horizontalScale !== "undefined") {
                    try { doc.horizontalScale = sampleDoc.horizontalScale; } catch (eHS) {}
                }
                if (typeof sampleDoc.verticalScale !== "undefined") {
                    try { doc.verticalScale = sampleDoc.verticalScale; } catch (eVS) {}
                }
                if (typeof sampleDoc.tsume !== "undefined") {
                    try { doc.tsume = sampleDoc.tsume; } catch (eTs) {}
                }

                // 8. Faux styles & Caps options
                if (typeof sampleDoc.fontCapsOption !== "undefined") {
                    try { doc.fontCapsOption = sampleDoc.fontCapsOption; } catch (eFCO) {}
                } else if (typeof sampleDoc.allCaps !== "undefined") {
                    try { doc.allCaps = sampleDoc.allCaps; } catch (eAC) {}
                }
                if (typeof sampleDoc.smallCaps !== "undefined") {
                    try { doc.smallCaps = sampleDoc.smallCaps; } catch (eSmC) {}
                }
                if (typeof sampleDoc.fauxBold !== "undefined") {
                    try { doc.fauxBold = sampleDoc.fauxBold; } catch (eFB) {}
                }
                if (typeof sampleDoc.fauxItalic !== "undefined") {
                    try { doc.fauxItalic = sampleDoc.fauxItalic; } catch (eFI) {}
                }
                if (typeof sampleDoc.fontBaselineOption !== "undefined") {
                    try { doc.fontBaselineOption = sampleDoc.fontBaselineOption; } catch (eFBO) {}
                }

                // 9. Kerning & Ligatures
                if (typeof sampleDoc.autoKernType !== "undefined") {
                    try { doc.autoKernType = sampleDoc.autoKernType; } catch (eAKT) {}
                }
                if (typeof sampleDoc.ligature !== "undefined") {
                    try { doc.ligature = sampleDoc.ligature; } catch (eLig) {}
                }
            }

            prop.setValue(doc);
        } catch (eStyle) {}
    }

    // -------------------------------------------------------------------------
    // 3. TEXT PROPERTIES EXTRACTION ENGINE
    //    Referenced from & coherent with:
    //    https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx
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

    function getTextDocument(layer) {
        if (!isTextLayer(layer)) return null;
        try {
            var srcText = layer.property("Source Text");
            if (srcText) return srcText.value;
        } catch (e) {}
        return null;
    }

    function getTextLayerString(layer) {
        if (!layer) return "";
        try {
            var doc = getTextDocument(layer);
            if (doc) {
                if (typeof doc.text === "string") return doc.text;
                if (typeof doc === "string") return doc;
            }
        } catch (e) {}
        try {
            if (typeof layer.text === "string") return layer.text;
        } catch (e2) {}
        try {
            var prop = layer.property("Source Text");
            if (prop && prop.value) {
                var v = prop.value;
                if (typeof v.text === "string") return v.text;
                return String(v);
            }
        } catch (e3) {}
        return "";
    }

    function getSourceRect(layer) {
        if (!layer || typeof layer.sourceRectAtTime !== "function") return null;
        try {
            var t = (typeof layer.time !== "undefined") ? layer.time : 0;
            return layer.sourceRectAtTime(t, false);
        } catch (e) {
            return null;
        }
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

    /**
     * Measures and stores in memory (from Text_Properties_To_Effects.jsx):
     *   1. Array with each word detected in the text box.
     *   2. Array with the width in pixels of each word.
     *   3. Array with the width in pixels of each text line.
     */
    function measureAndStoreTextMetrics(comp, layer) {
        if (!comp || !layer) return null;
        if (!isTextLayer(layer)) return null;

        var textDoc = getTextDocument(layer);
        if (!textDoc) return null;

        var fullText = String(textDoc.text || "");
        if (fullText.length === 0) {
            var emptyStore = {
                layerName: layer.name,
                layerIndex: layer.index,
                fullText: "",
                words: [],
                wordWidths: [],
                lines: [],
                lineWidths: [],
                spaceWidth: 0,
                fontSize: textDoc.fontSize || 0,
                font: textDoc.font || "",
                boxWidth: 0,
                boxHeight: 0,
                totalWords: 0,
                totalLines: 0,
                maxLineWidth: 0,
                maxWordWidth: 0,
                timestamp: (new Date()).getTime()
            };
            $root.global.AE_TEXT_BOX_MEMORY = emptyStore;
            try { layer._textMetrics = emptyStore; } catch (e) {}
            return emptyStore;
        }

        var words = fullText.match(/\S+/g) || [];
        var wordWidths = [];
        var lines = [];
        var lineWidths = [];
        var spaceWidth = 0;

        var isBox = false;
        var boxWidth = 0;
        var boxHeight = 0;
        try {
            if (textDoc.boxText && textDoc.boxTextSize) {
                isBox = true;
                boxWidth = textDoc.boxTextSize[0];
                boxHeight = textDoc.boxTextSize[1];
            }
        } catch (eBox) {}

        // Measure metrics safely and non-destructively without altering composition layers
        var fontSize = textDoc.fontSize || 28;
        var charRatio = fontSize * 0.52;
        spaceWidth = Math.round((fontSize * 0.28) * 100) / 100;

        for (var w = 0; w < words.length; w++) {
            var ww = Math.round(words[w].length * charRatio * 100) / 100;
            wordWidths.push(ww);
        }

        var paragraphs = fullText.split(/\r\n|\r|\n/);
        for (var p = 0; p < paragraphs.length; p++) {
            var para = paragraphs[p];
            if (!isBox || boxWidth <= 0) {
                lines.push(para);
                lineWidths.push(Math.round(para.length * charRatio * 100) / 100);
            } else {
                var pWords = para.match(/\S+/g) || [];
                if (pWords.length === 0) {
                    lines.push("");
                    lineWidths.push(0);
                    continue;
                }
                var curLine = pWords[0];
                var curW = curLine.length * charRatio;

                for (var pw = 1; pw < pWords.length; pw++) {
                    var testLine = curLine + " " + pWords[pw];
                    var testW = testLine.length * charRatio;

                    if (testW > boxWidth && curLine.length > 0) {
                        lines.push(curLine);
                        lineWidths.push(Math.round(curW * 100) / 100);
                        curLine = pWords[pw];
                        curW = curLine.length * charRatio;
                    } else {
                        curLine = testLine;
                        curW = testW;
                    }
                }
                lines.push(curLine);
                lineWidths.push(Math.round(curW * 100) / 100);
            }
        }

        var maxLW = 0;
        for (var ml = 0; ml < lineWidths.length; ml++) {
            if (lineWidths[ml] > maxLW) maxLW = lineWidths[ml];
        }

        var maxWW = 0;
        for (var mw = 0; mw < wordWidths.length; mw++) {
            if (wordWidths[mw] > maxWW) maxWW = wordWidths[mw];
        }

        var memoryStore = {
            layerName: layer.name,
            layerIndex: layer.index,
            fullText: fullText,
            words: words,
            wordWidths: wordWidths,
            lines: lines,
            lineWidths: lineWidths,
            spaceWidth: spaceWidth,
            fontSize: textDoc.fontSize,
            font: textDoc.font || "",
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            totalWords: words.length,
            totalLines: lines.length,
            maxLineWidth: maxLW,
            maxWordWidth: maxWW,
            timestamp: (new Date()).getTime()
        };

        $root.global.AE_TEXT_BOX_MEMORY = memoryStore;
        try { layer._textMetrics = memoryStore; } catch (eMem) {}
        return memoryStore;
    }

    /**
     * High-level text metrics extractor coherent with Text_Properties_To_Effects.jsx
     */
    function getTextLayerMetrics(comp, layer) {
        if (!layer) return null;

        var rect = getSourceRect(layer);
        if (!rect || typeof rect.width === "undefined") {
            rect = { left: 0, top: 0, width: 800, height: 200 };
        }

        var textDoc = getTextDocument(layer);

        // Store comprehensive metrics in memory
        var metricsStore = null;
        if (comp) {
            try {
                metricsStore = measureAndStoreTextMetrics(comp, layer);
            } catch (eMeas) {}
        }

        var isBoxText = false;
        var boxWidth = 0;
        var boxHeight = 0;
        var justification = 7412; // LEFT_JUSTIFY default
        var align = "left";
        var alignIndex = 0;       // 0: Left, 1: Center, 2: Right, 3: Justified
        var alignRatio = 0.0;     // 0.0 (Left), 0.5 (Center), 1.0 (Right)
        var font = "ArialMT";
        var fontSize = 28;
        var leading = 0;
        var tracking = 0;
        var baselineShift = 0;
        var fillColor = [1, 1, 1, 1];
        var strokeColor = [0, 0, 0, 1];
        var strokeWidth = 0;

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
                leading = textDoc.autoLeading ? (textDoc.fontSize * 1.2) : (textDoc.leading || 0);
                tracking = textDoc.tracking || 0;
                baselineShift = textDoc.baselineShift || 0;
                if (textDoc.applyFill && textDoc.fillColor) {
                    var fc = textDoc.fillColor;
                    fillColor = [fc[0], fc[1], fc[2], 1.0];
                }
                if (textDoc.applyStroke && textDoc.strokeColor) {
                    var sc = textDoc.strokeColor;
                    strokeColor = [sc[0], sc[1], sc[2], 1.0];
                    strokeWidth = textDoc.strokeWidth || 0;
                }
            } catch (eDoc) {}
        }

        // Justification evaluation coherent with Text_Properties_To_Effects.jsx
        if (typeof ParagraphJustification !== "undefined") {
            if (justification === ParagraphJustification.CENTER_JUSTIFY ||
                justification === ParagraphJustification.FULL_JUSTIFY_LASTCENTER) {
                align = "center";
                alignIndex = 1;
                alignRatio = 0.5;
            } else if (justification === ParagraphJustification.RIGHT_JUSTIFY ||
                       justification === ParagraphJustification.FULL_JUSTIFY_LASTRIGHT) {
                align = "right";
                alignIndex = 2;
                alignRatio = 1.0;
            } else if (justification === ParagraphJustification.LEFT_JUSTIFY ||
                       justification === ParagraphJustification.FULL_JUSTIFY_LASTLEFT) {
                align = "left";
                alignIndex = 0;
                alignRatio = 0.0;
            } else {
                align = "left";
                alignIndex = 3;
                alignRatio = 0.0;
            }
        } else {
            if (justification == 7414 || justification == 7417) {
                align = "center";
                alignIndex = 1;
                alignRatio = 0.5;
            } else if (justification == 7413 || justification == 7416) {
                align = "right";
                alignIndex = 2;
                alignRatio = 1.0;
            } else {
                align = "left";
                alignIndex = 0;
                alignRatio = 0.0;
            }
        }

        var contentW = (metricsStore && metricsStore.maxLineWidth > 0) ? metricsStore.maxLineWidth : Math.ceil(rect.width);
        var detW = (isBoxText && boxWidth > 0) ? Math.round(boxWidth) : (contentW > 0 ? Math.ceil(contentW) : Math.ceil(rect.width));
        var detH = Math.ceil(rect.height);
        if (metricsStore && metricsStore.totalLines && metricsStore.totalLines > 0) {
            var fsVal = fontSize || 28;
            var lVal = leading || (fsVal * 1.2);
            var typoH = (fsVal * 1.0) + ((metricsStore.totalLines - 1) * lVal);
            if (typoH > detH) detH = Math.ceil(typoH);
        }

        return {
            layer: layer,
            name: layer.name,
            rect: rect,
            isBoxText: isBoxText,
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            contentWidth: contentW,
            detectedWidth: Math.max(10, detW),
            detectedHeight: Math.max(10, detH),
            justification: justification,
            align: align,
            alignIndex: alignIndex,
            alignRatio: alignRatio,
            font: font,
            fontSize: fontSize,
            leading: leading,
            tracking: tracking,
            baselineShift: baselineShift,
            fillColor: fillColor,
            strokeColor: strokeColor,
            strokeWidth: strokeWidth,
            memoryStore: metricsStore || $root.global.AE_TEXT_BOX_MEMORY
        };
    }

    // -------------------------------------------------------------------------
    // 4. Geometry & Anchor Point Helpers (AE_Align_Anchor_Point coherent)
    // -------------------------------------------------------------------------
    var COLOR_PRESETS = {
        "Cyan":   [0.0, 0.95, 0.95],
        "Red":    [1.0, 0.25, 0.25],
        "Yellow": [1.0, 0.85, 0.15],
        "Green":  [0.2, 0.90, 0.40],
        "White":  [1.0, 1.0, 1.0]
    };

    var ALIGN_X_INDICES = { "left": 0, "center": 1, "right": 2 };
    var ALIGN_Y_INDICES = { "top": 0, "center": 1, "bottom": 2 };
    var BOUNDS_MODE_INDICES = { "sourceRect": 0, "stated": 1, "content": 0, "canvas": 1 };

    /**
     * Obtains the dynamic bounding box via sourceRectAtTime(time, false) with Box Text fallback
     */
    function getLayerSourceRectBounds(layer, compTime) {
        if (!layer) return { left: 0, top: 0, width: 100, height: 100 };
        var t = (compTime !== undefined) ? compTime : 0;

        if (typeof layer.sourceRectAtTime === "function") {
            try {
                var sr = layer.sourceRectAtTime(t, false);
                if (sr && (sr.width !== 0 || sr.height !== 0 || sr.left !== 0 || sr.top !== 0)) {
                    return { left: sr.left, top: sr.top, width: sr.width, height: sr.height };
                }
            } catch (eSR) {}
        }

        try {
            var textProp = layer.property("ADBE Text Properties") || layer.property("Text");
            if (textProp) {
                var docProp = textProp.property("ADBE Text Document") || layer.property("Source Text");
                if (docProp && docProp.value) {
                    var doc = docProp.value;
                    if (doc.boxText && doc.boxTextSize) {
                        var bPos = doc.boxTextPos || [0, 0];
                        return { left: bPos[0], top: bPos[1], width: doc.boxTextSize[0], height: doc.boxTextSize[1] };
                    }
                }
            }
        } catch (eText) {}

        var w = 0, h = 0;
        if (layer.source && typeof layer.source.width === "number" && typeof layer.source.height === "number") {
            w = layer.source.width; h = layer.source.height;
        } else if (typeof layer.width === "number" && typeof layer.height === "number") {
            w = layer.width; h = layer.height;
        }
        if (w > 0 && h > 0) return { left: 0, top: 0, width: w, height: h };

        var cW = (layer.containingComp && layer.containingComp.width) ? layer.containingComp.width : 1920;
        var cH = (layer.containingComp && layer.containingComp.height) ? layer.containingComp.height : 1080;
        return { left: 0, top: 0, width: cW, height: cH };
    }

    /**
     * Obtains stated / nominal dimensions (declared box text width/height, solid size, or precomp dimensions)
     */
    function getLayerStatedBounds(layer) {
        if (!layer) return { left: 0, top: 0, width: 100, height: 100 };

        try {
            var textProp = layer.property("ADBE Text Properties") || layer.property("Text");
            if (textProp) {
                var docProp = textProp.property("ADBE Text Document") || layer.property("Source Text");
                if (docProp && docProp.value) {
                    var doc = docProp.value;
                    if (doc.boxText && doc.boxTextSize) {
                        var bPos = doc.boxTextPos || [0, 0];
                        return { left: bPos[0], top: bPos[1], width: doc.boxTextSize[0], height: doc.boxTextSize[1] };
                    }
                }
            }
        } catch (eBox) {}

        if (layer.source && typeof layer.source.width === "number" && typeof layer.source.height === "number") {
            return { left: 0, top: 0, width: layer.source.width, height: layer.source.height };
        }
        if (typeof layer.width === "number" && typeof layer.height === "number" && layer.width > 0 && layer.height > 0) {
            return { left: 0, top: 0, width: layer.width, height: layer.height };
        }

        return getLayerSourceRectBounds(layer, 0);
    }

    /**
     * Computes the target [X, Y] anchor coordinates based on bounds and alignment modes (AE_Align_Anchor_Point)
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

    /**
     * Creates or updates a vector cross shape layer parented to targetLayer at [0, 0] (Guide Layer)
     */
    function attachAnchorCross(comp, targetLayer, crossSize, isGuide, colorName) {
        if (!comp || !targetLayer) return null;
        crossSize = Number(crossSize) || 30;
        var strokeW = Math.max(2, Math.round(crossSize / 15));
        var col = COLOR_PRESETS[colorName] || COLOR_PRESETS["Cyan"];
        var crossName = "Anchor_Cross_" + targetLayer.name;

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

        crossLayer.parent = null;

        var contents = crossLayer.property("Contents") || crossLayer.property("ADBE Root Vectors Group");
        while (contents && contents.numProperties > 0) {
            contents.property(1).remove();
        }

        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Crosshair Shapes";
        var grpContents = grp.property("Contents");

        var rectH = grpContents.addProperty("ADBE Vector Shape - Rect");
        rectH.name = "Horizontal Bar";
        rectH.property("Size").setValue([crossSize, strokeW]);
        rectH.property("Position").setValue([0, 0]);

        var rectV = grpContents.addProperty("ADBE Vector Shape - Rect");
        rectV.name = "Vertical Bar";
        rectV.property("Size").setValue([strokeW, crossSize]);
        rectV.property("Position").setValue([0, 0]);

        var dot = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        dot.name = "Center Pivot Dot";
        dot.property("Size").setValue([strokeW * 3.0, strokeW * 3.0]);
        dot.property("Position").setValue([0, 0]);

        var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("Color").setValue(col);

        var ring = grpContents.addProperty("ADBE Vector Shape - Ellipse");
        ring.name = "Reticle Outer Ring";
        ring.property("Size").setValue([crossSize * 0.72, crossSize * 0.72]);
        ring.property("Position").setValue([0, 0]);

        var ringStroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
        ringStroke.property("Color").setValue(col);
        ringStroke.property("Stroke Width").setValue(1.5);

        crossLayer.guideLayer = Boolean(isGuide);
        crossLayer.threeDLayer = Boolean(targetLayer.threeDLayer);
        crossLayer.label = 14;

        var is3D = targetLayer.threeDLayer;
        crossLayer.transform.anchorPoint.setValue(is3D ? [0, 0, 0] : [0, 0]);
        crossLayer.transform.position.setValue(is3D ? [0, 0, 0] : [0, 0]);
        crossLayer.transform.scale.setValue(is3D ? [100, 100, 100] : [100, 100]);
        if (crossLayer.transform.rotation) crossLayer.transform.rotation.setValue(0);

        crossLayer.parent = targetLayer;
        try { crossLayer.moveBefore(targetLayer); } catch (eMB) {}

        return crossLayer;
    }

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

            var effX = fxParade.property("Anchor Align X") || fxParade.addProperty("ADBE Slider Control");
            if (effX) {
                effX.name = "Anchor Align X";
                var pX = effX.property("ADBE Slider Control-0001") || effX.property(1);
                if (pX) pX.setValue(xVal);
            }

            var effY = fxParade.property("Anchor Align Y") || fxParade.addProperty("ADBE Slider Control");
            if (effY) {
                effY.name = "Anchor Align Y";
                var pY = effY.property("ADBE Slider Control-0001") || effY.property(1);
                if (pY) pY.setValue(yVal);
            }

            var effB = fxParade.property("Anchor Bounds Mode") || fxParade.addProperty("ADBE Slider Control");
            if (effB) {
                effB.name = "Anchor Bounds Mode";
                var pB = effB.property("ADBE Slider Control-0001") || effB.property(1);
                if (pB) pB.setValue(bVal);
            }

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

    // -------------------------------------------------------------------------
    // 5. Bézier Rounded Rectangle Path Computation (AE_Extruded_Round_corners)
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

        // In AE 24+, verify if font object exists in app.fonts environment
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

    function getRandomJustification() {
        var aligns = [
            { key: "left", name: "Left", val: (typeof ParagraphJustification !== "undefined" && typeof ParagraphJustification.LEFT_JUSTIFY !== "undefined" ? ParagraphJustification.LEFT_JUSTIFY : 7412) },
            { key: "center", name: "Center", val: (typeof ParagraphJustification !== "undefined" && typeof ParagraphJustification.CENTER_JUSTIFY !== "undefined" ? ParagraphJustification.CENTER_JUSTIFY : 7414) },
            { key: "right", name: "Right", val: (typeof ParagraphJustification !== "undefined" && typeof ParagraphJustification.RIGHT_JUSTIFY !== "undefined" ? ParagraphJustification.RIGHT_JUSTIFY : 7413) }
        ];
        return aligns[Math.floor(Math.random() * aligns.length)];
    }

    // -------------------------------------------------------------------------
    // 5. Create Dummy 100-Word Lorem Ipsum Text Layer (Randomized Font & Alignment)
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

        // Randomize typography font and paragraph alignment
        var fontPick = getRandomFontInfo();
        var alignPick = getRandomJustification();

        var dummyLayer = comp.layers.addText(LOREM_IPSUM_100);
        dummyLayer.name = "Dummy Text - " + fontPick.name + " (" + alignPick.name + ")";

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
            if (fontPick.fontObject) {
                try { doc.fontObject = fontPick.fontObject; } catch (eFO) {}
            }
            if (fontPick.font) {
                try { doc.font = fontPick.font; } catch (eF) {}
            }
            doc.fillColor = [0.95, 0.95, 0.95];
            doc.applyFill = true;
            doc.applyStroke = false;
            doc.leading = 40;
            try {
                doc.justification = alignPick.val;
            } catch (eJ) {}

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
                var wrapped = wrapTextToWidth(LOREM_IPSUM_100, textW, 28, fontPick.font);
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
    // 6. Create Background Card Layer (Procedural Bézier Rounded Rectangle)
    // -------------------------------------------------------------------------
    function createBackgroundShapeLayer(comp, precompW, precompH, radii, hexColor, opacity) {
        var bgLayer = null;
        try {
            bgLayer = comp.layers.addShape();
            bgLayer.name = "Background Card";
        } catch (eAddShape) {
            return null;
        }

        try {
            // Place at center of precomposition (2D safe)
            try {
                bgLayer.transform.position.setValue([precompW / 2, precompH / 2]);
                bgLayer.transform.anchorPoint.setValue([0, 0]);
            } catch (eTf2D) {
                try {
                    bgLayer.transform.position.setValue([precompW / 2, precompH / 2, 0]);
                    bgLayer.transform.anchorPoint.setValue([0, 0, 0]);
                } catch (eTf3D) {}
            }

            // 1. Add Master Effect Controls first to prevent invalidating shape references later
            try {
                var fxGroup = bgLayer.property("ADBE Effect Parade") || bgLayer.property("Effects");
                if (fxGroup) {
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
                }
            } catch (eFx) {}

            // Helper to get fresh groupContents starting from bgLayer
            function getFreshGrpContents() {
                try {
                    var r = bgLayer.property("ADBE Root Vectors Group") || bgLayer.property("Contents") || (bgLayer.property && bgLayer.property(1));
                    if (!r) return null;
                    var g = r.property("Rounded Card") || (r.numProperties >= 1 ? r.property(1) : null);
                    if (!g) return null;
                    return g.property("ADBE Vectors Group") || g.property("Contents") || (g.property && g.property(2)) || (g.property && g.property(1));
                } catch (eFresh) {
                    return null;
                }
            }

            // 2. Add Shape Group with Path and Fill
            try {
                var rootVectors = bgLayer.property("ADBE Root Vectors Group") || bgLayer.property("Contents") || (bgLayer.property && bgLayer.property(1));
                if (rootVectors) {
                    var group = rootVectors.addProperty("ADBE Vector Group");
                    try { group.name = "Rounded Card"; } catch (eGrpName) {}
                }
            } catch (eAddGrp) {}

            var groupContents = getFreshGrpContents();
            if (groupContents) {
                try {
                    groupContents.addProperty("ADBE Vector Shape - Group");
                } catch (eG1) {
                    try { groupContents.addProperty("Path"); } catch (eG2) {}
                }
            }

            groupContents = getFreshGrpContents();
            if (groupContents) {
                try {
                    groupContents.addProperty("ADBE Vector Graphic - Fill");
                } catch (eF1) {
                    try { groupContents.addProperty("Fill"); } catch (eF2) {}
                }
            }

            // Re-query groupContents fresh after all additions to prevent stale references in AE C++ DOM
            groupContents = getFreshGrpContents();

            // 3. Configure Path
            var shapeGroup = null;
            if (groupContents) {
                try {
                    shapeGroup = groupContents.property("ADBE Vector Shape - Group") ||
                                 groupContents.property("Rounded Path") ||
                                 groupContents.property("Path 1") ||
                                 (groupContents.numProperties >= 1 ? groupContents.property(1) : null);
                } catch (eSG) {}
            }

            var pathProp = null;
            if (shapeGroup) {
                try { shapeGroup.name = "Rounded Path"; } catch (eName) {}
                try {
                    pathProp = shapeGroup.property("ADBE Vector Shape") ||
                               shapeGroup.property("Path") ||
                               shapeGroup.path ||
                               (shapeGroup.numProperties >= 2 ? shapeGroup.property(2) : shapeGroup.property(1));
                } catch (ePP) {}
            }

            // Static shape computation
            var pathData = computeRoundRectPathData(precompW, precompH, radii.rTL, radii.rTR, radii.rBR, radii.rBL);
            if (pathProp) {
                try {
                    var aeShape = new Shape();
                    aeShape.vertices = pathData.points;
                    aeShape.inTangents = pathData.inTangents;
                    aeShape.outTangents = pathData.outTangents;
                    aeShape.closed = true;
                    pathProp.setValue(aeShape);
                } catch (eShape) {}

                var exprLines = [
                    "// Parametric Rounded Rectangle Path (Individual Corners)",
                    "try {",
                    "    var w = Math.max(0, effect('Card Width')(1).value);",
                    "    var h = Math.max(0, effect('Card Height')(1).value);",
                    "    var rTL = Math.max(0, effect('Radius Top-Left')(1).value);",
                    "    var rTR = Math.max(0, effect('Radius Top-Right')(1).value);",
                    "    var rBR = Math.max(0, effect('Radius Bottom-Right')(1).value);",
                    "    var rBL = Math.max(0, effect('Radius Bottom-Left')(1).value);",
                    "    var topSum = rTL + rTR; var botSum = rBL + rBR; var leftSum = rTL + rBL; var rgtSum = rTR + rBR;",
                    "    var f = 1.0;",
                    "    if (topSum > w && topSum > 0) f = Math.min(f, w / topSum);",
                    "    if (botSum > w && botSum > 0) f = Math.min(f, w / botSum);",
                    "    if (leftSum > h && leftSum > 0) f = Math.min(f, h / leftSum);",
                    "    if (rgtSum > h && rgtSum > 0) f = Math.min(f, h / rgtSum);",
                    "    rTL *= f; rTR *= f; rBR *= f; rBL *= f;",
                    "    var halfW = w / 2; var halfH = h / 2;",
                    "    var xMin = -halfW; var xMax = halfW; var yMin = -halfH; var yMax = halfH;",
                    "    var K = 0.5522847498307936;",
                    "    var pts = [",
                    "        [xMin + rTL, yMin], [xMax - rTR, yMin],",
                    "        [xMax, yMin + rTR], [xMax, yMax - rBR],",
                    "        [xMax - rBR, yMax], [xMin + rBL, yMax],",
                    "        [xMin, yMax - rBL], [xMin, yMin + rTL]",
                    "    ];",
                    "    var inT = [",
                    "        [-rTL * K, 0], [0, 0], [0, -rTR * K], [0, 0],",
                    "        [rBR * K, 0], [0, 0], [0, rBL * K], [0, 0]",
                    "    ];",
                    "    var outT = [",
                    "        [0, 0], [rTR * K, 0], [0, 0], [0, rBR * K],",
                    "        [0, 0], [-rBL * K, 0], [0, 0], [0, -rTL * K]",
                    "    ];",
                    "    createPath(pts, inT, outT, true);",
                    "} catch (err) {",
                    "    value;",
                    "}"
                ];
                try {
                    pathProp.expression = exprLines.join("\n");
                } catch (eExpr) {}
            }

            // 4. Configure Fill
            groupContents = getFreshGrpContents();
            var fill = null;
            if (groupContents) {
                try {
                    fill = groupContents.property("ADBE Vector Graphic - Fill") ||
                           groupContents.property("Fill 1") ||
                           groupContents.property("Fill") ||
                           (groupContents.numProperties >= 2 ? groupContents.property(2) : null);
                } catch (eFG) {}
            }

            if (fill) {
                var rgb = hexToRgb(hexColor || "#1E222D");
                try {
                    fill.property("Color").setValue([rgb[0], rgb[1], rgb[2]]);
                } catch (eCol) {
                    try { fill.property("ADBE Vector Fill Color").setValue([rgb[0], rgb[1], rgb[2]]); } catch (eCol2) {}
                }
                try {
                    if (fill.property("Opacity")) {
                        fill.property("Opacity").setValue(opacity !== undefined ? opacity : 100);
                    } else if (fill.property("ADBE Vector Fill Opacity")) {
                        fill.property("ADBE Vector Fill Opacity").setValue(opacity !== undefined ? opacity : 100);
                    }
                } catch (eOp) {}
            }
        } catch (eAllCard) {}

        return bgLayer;
    }

    // -------------------------------------------------------------------------
    // 7. Core Precompose Engine
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

        // ---------------------------------------------------------------------
        // 1. Capture Original Layer Geometry & Reference Point (AE_Align_Anchor_Point)
        // ---------------------------------------------------------------------
        var origFs = metrics.fontSize || 28;
        var ascenderHeightInit = Math.round((origFs * 0.78) * 100) / 100;

        var boundsMethod = options.boundsMethod || (metrics.isBoxText ? "stated" : "sourceRect");
        var origBounds = (boundsMethod === "stated") ? getLayerStatedBounds(textLayer) : getLayerSourceRectBounds(textLayer, comp.time);

        var sx = (origScale && origScale.length > 0) ? (origScale[0] / 100.0) : 1.0;
        var sy = (origScale && origScale.length > 1) ? (origScale[1] / 100.0) : 1.0;
        var rad = (origRot || 0) * Math.PI / 180.0;
        var cosA = Math.cos(rad);
        var sinA = Math.sin(rad);

        // Exact composition-space coordinate of the visual top-left corner of the content:
        var pContentTopLeft = null;
        try {
            if (typeof textLayer.toComp === "function") {
                pContentTopLeft = textLayer.toComp([origBounds.left, origBounds.top, 0]);
                if (!pContentTopLeft || pContentTopLeft.length < 2) {
                    pContentTopLeft = textLayer.toComp([origBounds.left, origBounds.top]);
                }
            }
        } catch (eTC) {}

        if (!pContentTopLeft || isNaN(pContentTopLeft[0]) || isNaN(pContentTopLeft[1])) {
            var dxOrig = (origBounds.left - origAnchor[0]) * sx;
            var dyOrig = (origBounds.top - origAnchor[1]) * sy;
            pContentTopLeft = [
                origPos[0] + (dxOrig * cosA - dyOrig * sinA),
                origPos[1] + (dxOrig * sinA + dyOrig * cosA),
                (origPos.length > 2 ? origPos[2] : 0)
            ];
        }

        // ---------------------------------------------------------------------
        // 2. Precomp Dimensions & Textbox Sizing
        // ---------------------------------------------------------------------
        var precompW = 800;
        if (options.autoDetectWidth && metrics && metrics.detectedWidth) {
            precompW = Math.max(40, Math.round(metrics.detectedWidth + (padding * 2)));
        } else {
            precompW = Math.max(40, Math.round(options.width || (metrics ? metrics.detectedWidth : 800) || 800));
        }
        var textboxW = Math.max(20, precompW - (padding * 2));

        var precompH = 0;
        var textboxH = 0;

        if (options.autoHeight) {
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

        // Precomposition Name
        var precompName = trimStr(options.precompName);
        if (!precompName) {
            precompName = origName + " Comp";
        }

        // Capture pristine TextDocument before precomposing
        var precompOrigDoc = getTextDocument(textLayer);

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

        // Find the resulting precomp layer in the parent comp safely
        var precompLayer = null;
        try {
            precompLayer = comp.layer(precompName);
        } catch (eFind1) {}

        if (!precompLayer) {
            try {
                if (comp.selectedLayers && comp.selectedLayers.length > 0) {
                    var s0 = comp.selectedLayers[0];
                    if (s0 && s0.name === precompName) {
                        precompLayer = s0;
                    }
                }
            } catch (eFind2) {}
        }

        if (!precompLayer) {
            try {
                var totalL = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
                for (var i = 1; i <= totalL; i++) {
                    try {
                        var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
                        if (l && l.name === precompName) {
                            precompLayer = l;
                            break;
                        }
                        if (l && typeof l.source !== "undefined" && l.source === newComp) {
                            precompLayer = l;
                            break;
                        }
                    } catch (eLCheck) {}
                }
            } catch (eFind3) {}
        }

        if (!precompLayer && comp.selectedLayers && comp.selectedLayers.length > 0) {
            try { precompLayer = comp.selectedLayers[0]; } catch (eFind4) {}
        }

        // ---------------------------------------------------------------------
        // 3. Inside newComp: Configure Inner Text Layer
        // ---------------------------------------------------------------------
        var innerTextLayer = null;
        try {
            innerTextLayer = (typeof newComp.layer === "function") ? newComp.layer(1) : newComp.layers[0];
        } catch (eGetInner) {}

        var divideMode = options.divideMode || "none";
        var totalWordCount = 0;
        var totalLineCount = 1;

        if (innerTextLayer) {
            var origDoc = getTextDocument(innerTextLayer) || precompOrigDoc;
            var fs = (origDoc && origDoc.fontSize) ? origDoc.fontSize : (metrics.fontSize || 28);
            var fn = (origDoc && origDoc.font) ? origDoc.font : (metrics.font || "ArialMT");
            var lineStep = (origDoc && origDoc.autoLeading) ? (fs * 1.2) : ((origDoc && origDoc.leading) ? origDoc.leading : (fs * 1.2));
            if (!lineStep || lineStep <= 0) lineStep = fs * 1.2;

            if (divideMode === "words" || divideMode === "lines") {
                // Temporary hidden text layer to measure exact sub-string widths in newComp
                var measureLayer = null;
                try {
                    measureLayer = newComp.layers.addText("");
                    measureLayer.enabled = false;
                    applyTextDocStyling(measureLayer, origDoc, "W", innerTextLayer);
                } catch (eML) {
                    measureLayer = null;
                }

                // Calculate space character width for consistent inter-word spacing
                var spaceWidth = 0;
                if (measureLayer) {
                    try {
                        var dSp = measureLayer.property("Source Text").value;
                        dSp.text = "A A";
                        measureLayer.property("Source Text").setValue(dSp);
                        var rSp1 = measureLayer.sourceRectAtTime(0, false);

                        dSp.text = "AA";
                        measureLayer.property("Source Text").setValue(dSp);
                        var rSp2 = measureLayer.sourceRectAtTime(0, false);

                        if (rSp1 && rSp2 && typeof rSp1.width === "number" && typeof rSp2.width === "number") {
                            var diffSp = rSp1.width - rSp2.width;
                            if (diffSp > 0) spaceWidth = Math.round(diffSp * 100) / 100;
                        }
                    } catch (eSpace) {}
                }
                if (!spaceWidth || spaceWidth <= 0) {
                    spaceWidth = Math.round((fs * 0.28) * 100) / 100;
                }

                function measureSingleWord(w) {
                    if (!w || w.length === 0) return 0;
                    if (measureLayer) {
                        try {
                            var dW = measureLayer.property("Source Text").value;
                            dW.text = w;
                            measureLayer.property("Source Text").setValue(dW);
                            var r = measureLayer.sourceRectAtTime(0, false);
                            if (r && typeof r.width === "number" && r.width > 0) return r.width;
                        } catch (eMW) {}
                    }
                    return measureTextExact(w, fs, fn);
                }

                var fullText = "";
                try {
                    fullText = getTextLayerString(innerTextLayer);
                } catch (eGTLS) {}
                if (!fullText || fullText.length === 0) {
                    if (origDoc && typeof origDoc.text === "string" && origDoc.text.length > 0) {
                        fullText = origDoc.text;
                    } else if (metrics && metrics.fullText) {
                        fullText = metrics.fullText;
                    } else if (metrics && metrics.memoryStore && metrics.memoryStore.fullText) {
                        fullText = metrics.memoryStore.fullText;
                    }
                }

                var visualLines = [];
                var rawParas = String(fullText).split(/\r\n|\r|\n/);
                for (var p = 0; p < rawParas.length; p++) {
                    var para = rawParas[p];
                    if (!metrics.isBoxText || textboxW <= 0) {
                        visualLines.push(para);
                    } else {
                        var pWords = para.match(/\S+/g) || [];
                        if (pWords.length === 0) {
                            visualLines.push("");
                            continue;
                        }
                        var curLineWords = [pWords[0]];
                        var curLineW = measureSingleWord(pWords[0]);
                        for (var pw = 1; pw < pWords.length; pw++) {
                            var wW = measureSingleWord(pWords[pw]);
                            if ((curLineW + spaceWidth + wW) > textboxW && curLineWords.length > 0) {
                                visualLines.push(curLineWords.join(" "));
                                curLineWords = [pWords[pw]];
                                curLineW = wW;
                            } else {
                                curLineWords.push(pWords[pw]);
                                curLineW += spaceWidth + wW;
                            }
                        }
                        if (curLineWords.length > 0) {
                            visualLines.push(curLineWords.join(" "));
                        }
                    }
                }
                if (visualLines.length === 0) visualLines.push(fullText || "");
                totalLineCount = visualLines.length;

                // Measure exact width of each visual line and find maximum line width
                var measuredLineWidths = [];
                var maxLineContentW = 0;
                for (var vIdx = 0; vIdx < visualLines.length; vIdx++) {
                    var vStr = visualLines[vIdx];
                    var vWords = vStr.match(/\S+/g) || [];
                    var vW = 0;
                    for (var vw = 0; vw < vWords.length; vw++) {
                        vW += measureSingleWord(vWords[vw]);
                    }
                    vW += Math.max(0, vWords.length - 1) * spaceWidth;
                    measuredLineWidths.push(vW);
                    if (vW > maxLineContentW) maxLineContentW = vW;
                }
                if (maxLineContentW <= 0) maxLineContentW = (metrics && metrics.detectedWidth) ? metrics.detectedWidth : 200;

                // Calibrate horizontal padding and width:
                if (options.autoDetectWidth) {
                    if (metrics && metrics.isBoxText && metrics.boxWidth > 0) {
                        textboxW = Math.max(20, Math.round(metrics.boxWidth));
                    } else {
                        textboxW = Math.max(20, Math.round(maxLineContentW));
                    }
                    precompW = Math.max(40, Math.round(textboxW + (padding * 2)));
                    newComp.width = precompW;
                } else if (!options.width || options.width <= 0) {
                    textboxW = Math.max(20, Math.round(maxLineContentW));
                    precompW = Math.max(40, Math.round(textboxW + (padding * 2)));
                    newComp.width = precompW;
                }

                // Calibrate symmetric vertical padding: measured from typographic ascender line to descender line
                // (do not measure individual glyphs so that ascenders/descenders never shift padding)
                var ascenderHeight = Math.round((fs * 0.78) * 100) / 100;
                var descenderHeight = Math.round((fs * 0.22) * 100) / 100;
                var lineCount = Math.max(1, visualLines.length);
                var textTypoHeight = ascenderHeight + ((lineCount - 1) * lineStep) + descenderHeight;

                if (options.autoHeight) {
                    textboxH = Math.max(20, Math.round(textTypoHeight));
                    precompH = Math.max(20, Math.round(textboxH + (padding * 2)));
                    newComp.height = precompH;
                }

                // Baseline of first line is strictly top padding + ascenderHeight
                var firstBaselineY = padding + ascenderHeight;

                if (divideMode === "lines") {
                    for (var li = 0; li < visualLines.length; li++) {
                        var lineStr = visualLines[li];
                        if (trimStr(lineStr).length === 0) continue;

                        var lineW = (measuredLineWidths.length > li) ? measuredLineWidths[li] : 0;

                        var lineLayer = newComp.layers.addText(lineStr);
                        applyTextDocStyling(lineLayer, origDoc, lineStr, innerTextLayer);
                        lineLayer.name = "Line " + (li + 1) + ": " + (lineStr.length > 25 ? (lineStr.substr(0, 25) + "...") : lineStr);

                        var rLine = lineLayer.sourceRectAtTime(0, false);
                        var rLeftLine = (rLine && typeof rLine.left === "number") ? rLine.left : 0;

                        var lineLeftX = padding;
                        if (align === "center") {
                            lineLeftX = padding + (textboxW - lineW) / 2;
                        } else if (align === "right") {
                            lineLeftX = padding + (textboxW - lineW);
                        }
                        var lineBaselineY = firstBaselineY + (li * lineStep);

                        try {
                            lineLayer.transform.anchorPoint.setValue([rLeftLine, 0]);
                            lineLayer.transform.position.setValue([lineLeftX, lineBaselineY]);
                        } catch (eLPos) {
                            try {
                                lineLayer.transform.anchorPoint.setValue([rLeftLine, 0, 0]);
                                lineLayer.transform.position.setValue([lineLeftX, lineBaselineY, 0]);
                            } catch (eLPos2) {}
                        }
                    }
                } else if (divideMode === "words") {
                    for (var li2 = 0; li2 < visualLines.length; li2++) {
                        var lineStr2 = visualLines[li2];
                        if (trimStr(lineStr2).length === 0) continue;

                        var lineWords = lineStr2.match(/\S+/g) || [];
                        if (lineWords.length === 0) continue;

                        // Create word layers and measure their exact bounding boxes
                        var lineLayers = [];
                        var wordsWidths = [];
                        var wordsLefts = [];
                        var lineTotalW = 0;

                        for (var wi = 0; wi < lineWords.length; wi++) {
                            var wordText = lineWords[wi];
                            var wordLayer = newComp.layers.addText(wordText);
                            applyTextDocStyling(wordLayer, origDoc, wordText, innerTextLayer);
                            totalWordCount++;
                            wordLayer.name = "Word " + totalWordCount + ": " + wordText;

                            var rWord = wordLayer.sourceRectAtTime(0, false);
                            var wWidth = (rWord && typeof rWord.width === "number" && rWord.width > 0)
                                ? rWord.width
                                : measureSingleWord(wordText);
                            var wLeft = (rWord && typeof rWord.left === "number") ? rWord.left : 0;

                            lineLayers.push(wordLayer);
                            wordsWidths.push(wWidth);
                            wordsLefts.push(wLeft);
                            lineTotalW += wWidth;
                        }

                        lineTotalW += (lineWords.length - 1) * spaceWidth;

                        var lineStartX = padding;
                        if (align === "center") {
                            lineStartX = padding + (textboxW - lineTotalW) / 2;
                        } else if (align === "right") {
                            lineStartX = padding + (textboxW - lineTotalW);
                        }
                        var lineBaselineY2 = firstBaselineY + (li2 * lineStep);

                        var curX = lineStartX;
                        for (var wi2 = 0; wi2 < lineLayers.length; wi2++) {
                            var wLyr = lineLayers[wi2];
                            var ww = wordsWidths[wi2];
                            var wl = wordsLefts[wi2];

                            try {
                                wLyr.transform.anchorPoint.setValue([wl, 0]);
                                wLyr.transform.position.setValue([curX, lineBaselineY2]);
                            } catch (eWPos) {
                                try {
                                    wLyr.transform.anchorPoint.setValue([wl, 0, 0]);
                                    wLyr.transform.position.setValue([curX, lineBaselineY2, 0]);
                                } catch (eWPos2) {}
                            }

                            curX += ww + spaceWidth;
                        }
                    }
                }

                if (measureLayer) {
                    try { measureLayer.remove(); } catch (eRemM) {}
                }

                // Remove the undivided single text layer
                try { innerTextLayer.remove(); } catch (eRemInner) {}
                innerTextLayer = null;

            } else {
                // Standard single layer precomp
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

                var isInner3D = false;
                try { isInner3D = !!innerTextLayer.threeDLayer; } catch (eInner3D) {}

                var innerAnchorX = origBounds.left;
                var innerAnchorY = origBounds.top;
                var innerPosX = padding;
                var innerPosY = padding;

                if (!metrics.isBoxText) {
                    if (align === "center") {
                        innerPosX = padding + (textboxW - origBounds.width) / 2;
                    } else if (align === "right") {
                        innerPosX = precompW - padding - origBounds.width;
                    }
                }

                try {
                    if (isInner3D) {
                        innerTextLayer.transform.anchorPoint.setValue([innerAnchorX, innerAnchorY, 0]);
                        innerTextLayer.transform.position.setValue([innerPosX, innerPosY, 0]);
                    } else {
                        innerTextLayer.transform.anchorPoint.setValue([innerAnchorX, innerAnchorY]);
                        innerTextLayer.transform.position.setValue([innerPosX, innerPosY]);
                    }
                } catch (eInPos) {
                    try {
                        innerTextLayer.transform.anchorPoint.setValue([innerAnchorX, innerAnchorY]);
                        innerTextLayer.transform.position.setValue([innerPosX, innerPosY]);
                    } catch (eInPos2) {}
                }

                try {
                    if (isInner3D) {
                        innerTextLayer.transform.scale.setValue([100, 100, 100]);
                    } else {
                        innerTextLayer.transform.scale.setValue([100, 100]);
                    }
                } catch (eInScale) {
                    try { innerTextLayer.transform.scale.setValue([100, 100]); } catch (eInScale2) {}
                }

                try {
                    if (innerTextLayer.transform.rotation) innerTextLayer.transform.rotation.setValue(0);
                    if (innerTextLayer.transform.zRotation) innerTextLayer.transform.zRotation.setValue(0);
                } catch (eZeroRot) {}
            }
        }

        // Inside newComp: Add Background Card if requested
        if (options.addBackground) {
            try {
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

                // Move background shape layer behind the text layer (moveToEnd is native AE ExtendScript)
                if (bgLayer) {
                    try {
                        if (typeof bgLayer.moveToEnd === "function") {
                            bgLayer.moveToEnd();
                        } else if (typeof bgLayer.moveAfter === "function" && innerTextLayer) {
                            bgLayer.moveAfter(innerTextLayer);
                        }
                    } catch (eMove) {}
                }
            } catch (eCard) {}
        }

        // ---------------------------------------------------------------------
        // 4. In parent comp: Configure Precomp Layer (Zero-Shift Anchor & Pos)
        // ---------------------------------------------------------------------
        if (precompLayer) {
            // Restore parenting FIRST so transforms operate in the exact original coordinate space
            if (origParent) {
                try { precompLayer.parent = origParent; } catch (ePar) {}
            }

            var anchorAlignPreset = options.anchorAlign || "auto";
            if (anchorAlignPreset === "auto") {
                if (align === "center") anchorAlignPreset = "top-center";
                else if (align === "right") anchorAlignPreset = "top-right";
                else anchorAlignPreset = "top-left";
            }
            if (!options.autoAnchor) {
                anchorAlignPreset = "center";
            }

            var alignPresetMap = {
                "top-left":   { x: "left",   y: "top" },
                "top-center": { x: "center", y: "top" },
                "top-right":  { x: "right",  y: "top" },
                "mid-left":   { x: "left",   y: "center" },
                "center":     { x: "center", y: "center" },
                "mid-right":  { x: "right",  y: "center" },
                "bot-left":   { x: "left",   y: "bottom" },
                "bot-center": { x: "center", y: "bottom" },
                "bot-right":  { x: "right",  y: "bottom" }
            };
            var alignMode = alignPresetMap[anchorAlignPreset] || { x: "left", y: "top" };

            var anchorRefBounds;
            if (options.anchorReference === "canvas") {
                anchorRefBounds = { left: 0, top: 0, width: precompW, height: precompH };
            } else {
                anchorRefBounds = { left: padding, top: padding, width: textboxW, height: textboxH };
            }

            var targetA = computeTargetAnchor(anchorRefBounds, alignMode.x, alignMode.y);

            // Zero-Shift affine transformation:
            // Inside newComp, the text content's top-left is at [padding, padding].
            // In the parent composition, that content point was at pContentTopLeft.
            // When precompLayer has anchor point targetA, its position in parent comp must be:
            var deltaAx = (targetA[0] - padding) * sx;
            var deltaAy = (targetA[1] - padding) * sy;
            var pDeltaX = deltaAx * cosA - deltaAy * sinA;
            var pDeltaY = deltaAx * sinA + deltaAy * cosA;

            var finalPosX = pContentTopLeft[0] + pDeltaX;
            var finalPosY = pContentTopLeft[1] + pDeltaY;
            var finalPosZ = (pContentTopLeft.length > 2) ? pContentTopLeft[2] : 0;

            if (origParent && typeof origParent.fromComp === "function") {
                try {
                    var pPt = origParent.fromComp([finalPosX, finalPosY, finalPosZ]);
                    if (pPt && pPt.length >= 2 && !isNaN(pPt[0]) && !isNaN(pPt[1])) {
                        finalPosX = pPt[0];
                        finalPosY = pPt[1];
                        if (pPt.length > 2) finalPosZ = pPt[2];
                    }
                } catch (eFC) {}
            }

            if (is3D) {
                try { precompLayer.threeDLayer = true; } catch (e3D) {}
            }

            try {
                if (is3D) {
                    precompLayer.transform.anchorPoint.setValue([targetA[0], targetA[1], 0]);
                    precompLayer.transform.position.setValue([finalPosX, finalPosY, finalPosZ]);
                } else {
                    precompLayer.transform.anchorPoint.setValue([targetA[0], targetA[1]]);
                    precompLayer.transform.position.setValue([finalPosX, finalPosY]);
                }
            } catch (ePrePos) {
                try {
                    precompLayer.transform.anchorPoint.setValue([targetA[0], targetA[1]]);
                    precompLayer.transform.position.setValue([finalPosX, finalPosY]);
                } catch (ePrePos2) {}
            }

            try {
                precompLayer.transform.scale.setValue(origScale);
            } catch (eScale) {}

            try {
                if (precompLayer.transform.rotation) precompLayer.transform.rotation.setValue(origRot);
                if (precompLayer.transform.zRotation) precompLayer.transform.zRotation.setValue(origRot);
            } catch (eSetRot) {}

            // Attach Guide Crosshair Reticle if requested
            if (options.createCross) {
                try {
                    attachAnchorCross(comp, precompLayer, options.crossSize || 30, true, options.crossColor || "Cyan");
                } catch (eCross) {}
            }

            // Store Alignment State Effect Controls on the precomp layer
            try {
                storeAlignmentEffect(precompLayer, alignMode.x, alignMode.y, options.anchorReference || "content", targetA);
            } catch (eStoreEff) {}

            try { precompLayer.selected = true; } catch (eSel) {}
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
            name: precompName,
            divideMode: divideMode,
            wordCount: totalWordCount,
            lineCount: totalLineCount,
            metrics: metrics
        };
    }

    // -------------------------------------------------------------------------
    // 8. ScriptUI Color Picker (AE_Extruded_Round_corners pattern)
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
    // 9. ScriptUI Window & Interface Panels
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

    var lblRef = pnlHeader.add("statictext", undefined, "Metrics Engine: Text_Properties_To_Effects.jsx coherent");
    lblRef.helpTip = TEXT_PROP_REF_URL;

    // --- Main Tabbed Panel ---
    var tpanel = win.add("tabbedpanel");
    tpanel.alignChildren = ["fill", "top"];
    tpanel.alignment = ["fill", "top"];

    // =========================================================================
    // TAB 1: PRECOMP
    // =========================================================================
    var tabPrecomp = tpanel.add("tab", undefined, "Precomp");
    tabPrecomp.orientation = "column";
    tabPrecomp.alignChildren = ["fill", "top"];
    tabPrecomp.spacing = 8;
    tabPrecomp.margins = 8;

    // --- Detection & Status Panel ---
    var pnlDetect = tabPrecomp.add("panel", undefined, "Text Layer Detection");
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

    // --- Section 1: Dimensions Panel ---
    var pnlDims = tabPrecomp.add("panel", undefined, "Dimensions");
    pnlDims.orientation = "column";
    pnlDims.alignChildren = ["fill", "top"];
    pnlDims.spacing = 8;
    pnlDims.margins = 10;

    // Checkbox Option Before Width: Get Precomp Width From Selected Text Box
    var grpAutoDetect = pnlDims.add("group");
    grpAutoDetect.orientation = "row";
    grpAutoDetect.alignment = ["fill", "top"];
    var chkAutoDetectWidth = grpAutoDetect.add("checkbox", undefined, "get precomp width from selected text box");
    chkAutoDetectWidth.value = true;
    chkAutoDetectWidth.alignment = ["fill", "center"];
    chkAutoDetectWidth.helpTip = "Automatically detects width from the selected text box/layer and computes precomp width plus padding.";

    var btnAutoDetect = grpAutoDetect.add("button", undefined, "Detect Now");
    btnAutoDetect.preferredSize = [85, 22];
    btnAutoDetect.alignment = ["right", "center"];
    btnAutoDetect.helpTip = "Detects dimensions and justification from the currently selected text layer.";

    // Width Row
    var grpWidth = pnlDims.add("group");
    grpWidth.orientation = "row";
    grpWidth.alignment = ["fill", "top"];
    var lblWidth = grpWidth.add("statictext", undefined, "Precomp Width (px):");
    lblWidth.preferredSize = [135, -1];
    var txtWidth = grpWidth.add("edittext", undefined, "800");
    txtWidth.alignment = ["fill", "center"];

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

    // --- Section 2: Padding Panel ---
    var pnlPad = tabPrecomp.add("panel", undefined, "Padding");
    pnlPad.orientation = "column";
    pnlPad.alignChildren = ["fill", "top"];
    pnlPad.spacing = 8;
    pnlPad.margins = 10;

    // Padding Slider & Text Row
    var grpPadRow = pnlPad.add("group");
    grpPadRow.orientation = "row";
    grpPadRow.alignment = ["fill", "top"];
    var lblPad = grpPadRow.add("statictext", undefined, "Padding (px):");
    lblPad.preferredSize = [135, -1];
    var sldPad = grpPadRow.add("slider", undefined, 30, 0, 120);
    sldPad.minvalue = 0;
    sldPad.maxvalue = 120;
    sldPad.value = 30;
    sldPad.alignment = ["fill", "center"];
    var txtPad = grpPadRow.add("edittext", undefined, "30");
    txtPad.characters = 4;

    function syncAutoDetectedWidth() {
        if (!chkAutoDetectWidth.value) return;
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return;
        var textLayer = getSelectedTextLayer(comp);
        if (textLayer) {
            var metrics = getTextLayerMetrics(comp, textLayer);
            if (metrics && metrics.detectedWidth) {
                var padVal = parseFloat(txtPad.text) || 0;
                var proposedPrecompW = Math.max(40, Math.round(metrics.detectedWidth + (padVal * 2)));
                txtWidth.text = String(proposedPrecompW);
            }
        }
    }

    sldPad.onChanging = sldPad.onChange = function() {
        txtPad.text = String(Math.round(sldPad.value));
        syncAutoDetectedWidth();
    };
    txtPad.onChange = function() {
        var v = parseFloat(txtPad.text) || 0;
        sldPad.value = Math.max(0, Math.min(120, v));
        syncAutoDetectedWidth();
    };

    chkAutoDetectWidth.onClick = function() {
        if (chkAutoDetectWidth.value) {
            syncAutoDetectedWidth();
        }
    };
    txtWidth.onChange = function() {
        if (chkAutoDetectWidth) {
            chkAutoDetectWidth.value = false;
        }
    };

    // --- Anchor Point Options Panel ---
    var pnlAnchor = tabPrecomp.add("panel", undefined, "Anchor Point & Alignment (Zero-Shift Engine)");
    pnlAnchor.orientation = "column";
    pnlAnchor.alignChildren = ["fill", "top"];
    pnlAnchor.spacing = 8;
    pnlAnchor.margins = 10;

    var chkAutoAnchor = pnlAnchor.add("checkbox", undefined, "Automatic Anchor Point Alignment");
    chkAutoAnchor.value = true;
    chkAutoAnchor.helpTip = "Enables zero-shift anchor point positioning using the AE_Align_Anchor_Point engine.";

    var grpAlign = pnlAnchor.add("group");
    grpAlign.orientation = "row";
    grpAlign.alignment = ["fill", "top"];
    var lblAlign = grpAlign.add("statictext", undefined, "Preset Alignment:");
    lblAlign.preferredSize = [135, -1];
    var dropAlign = grpAlign.add("dropdownlist", undefined, [
        "Auto-detect from Text Justification",
        "Top-Left",
        "Top-Center",
        "Top-Right",
        "Middle-Left",
        "Center",
        "Middle-Right",
        "Bottom-Left",
        "Bottom-Center",
        "Bottom-Right"
    ]);
    dropAlign.selection = 0;
    dropAlign.alignment = ["fill", "center"];

    // Reference Bounds (Text Content Box vs Precomp Canvas / Background Card)
    var grpRef = pnlAnchor.add("group");
    grpRef.orientation = "row";
    grpRef.alignment = ["fill", "top"];
    var lblRef = grpRef.add("statictext", undefined, "Anchor Reference:");
    lblRef.preferredSize = [135, -1];
    var radRefContent = grpRef.add("radiobutton", undefined, "Text Content Box");
    var radRefCanvas = grpRef.add("radiobutton", undefined, "Precomp Canvas / Card");
    radRefContent.value = true;
    radRefContent.helpTip = "Aligns anchor relative to the text bounding box (offset by padding inside precomp).";
    radRefCanvas.helpTip = "Aligns anchor relative to the overall precomp composition / card boundary [0, 0, W, H].";

    // Reticle Crosshair Guide Layer
    var grpCross = pnlAnchor.add("group");
    grpCross.orientation = "row";
    grpCross.alignment = ["fill", "top"];
    var chkShowCross = grpCross.add("checkbox", undefined, "Anchor Reticle Guide Layer");
    chkShowCross.value = false;
    chkShowCross.helpTip = "Creates a guide-layer reticle crosshair pinned exactly to the anchor point.";
    var lblCrossCol = grpCross.add("statictext", undefined, "Color:");
    lblCrossCol.preferredSize = [45, -1];
    var dropCrossCol = grpCross.add("dropdownlist", undefined, ["Cyan", "Red", "Yellow", "Green", "White"]);
    dropCrossCol.selection = 0;
    dropCrossCol.alignment = ["fill", "center"];

    chkAutoAnchor.onClick = function() {
        var en = chkAutoAnchor.value;
        grpAlign.enabled = en;
        grpRef.enabled = en;
    };

    // =========================================================================
    // TAB 2: BACKGROUND
    // =========================================================================
    var tabBg = tpanel.add("tab", undefined, "Background");
    tabBg.orientation = "column";
    tabBg.alignChildren = ["fill", "top"];
    tabBg.spacing = 8;
    tabBg.margins = 8;

    // --- Background Card & Rounded Corners Panel ---
    var pnlBg = tabBg.add("panel", undefined, "Background Card (Custom Rounded Corners)");
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

    try {
        tpanel.selection = tabPrecomp;
    } catch(eTab) {
        try { tpanel.selection = 0; } catch(eTab2) {}
    }

    // --- Action Buttons ---
    var pnlActions = win.add("panel", undefined, "Actions");
    pnlActions.orientation = "column";
    pnlActions.alignChildren = ["fill", "top"];
    pnlActions.spacing = 8;
    pnlActions.margins = 10;

    var btnPrecomp = pnlActions.add("button", undefined, "Precomp Selected Text Box");
    btnPrecomp.preferredSize = [-1, 32];
    btnPrecomp.helpTip = "Precompose selected text box as a single layer with padding, auto anchor & rounded background.";

    var grpDivide = pnlActions.add("group");
    grpDivide.orientation = "row";
    grpDivide.alignment = ["fill", "top"];
    grpDivide.spacing = 8;

    var btnDivideWords = grpDivide.add("button", undefined, "Divide by Words");
    btnDivideWords.alignment = ["fill", "center"];
    btnDivideWords.preferredSize = [-1, 30];
    btnDivideWords.helpTip = "Creates a text layer for each word in matching position, then precomposes.";

    var btnDivideLines = grpDivide.add("button", undefined, "Divide by Lines");
    btnDivideLines.alignment = ["fill", "center"];
    btnDivideLines.preferredSize = [-1, 30];
    btnDivideLines.helpTip = "Creates a text layer for each line in matching position, then precomposes.";

    var btnDummyOnly = pnlActions.add("button", undefined, "Create 100-Word Dummy Layer Only");
    btnDummyOnly.preferredSize = [-1, 24];
    btnDummyOnly.helpTip = "Creates a 100-word Lorem Ipsum text layer in the active composition without precomposing.";

    var lblFeedback = win.add("statictext", undefined, "Ready.");
    lblFeedback.alignment = ["fill", "bottom"];

    // --- Link Footer ---
    var grpFooter = win.add("group");
    grpFooter.orientation = "row";
    grpFooter.alignment = ["fill", "bottom"];
    grpFooter.alignChildren = ["center", "center"];
    grpFooter.margins = [0, 4, 0, 0];
    var lblRepo = grpFooter.add("statictext", undefined, "GitHub: work2survive/AE-text-precomp");
    lblRepo.helpTip = "https://github.com/work2survive/AE-text-precomp";
    lblRepo.onClick = function() {
        var url = "https://github.com/work2survive/AE-text-precomp";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os && $.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else if (typeof system !== "undefined" && system.callSystem) {
            system.callSystem('open "' + url + '"');
        }
    };

    // -------------------------------------------------------------------------
    // 10. UI Event Handlers & State Sync
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
            var wordCount = (metrics.memoryStore && metrics.memoryStore.totalWords) ? (" | " + metrics.memoryStore.totalWords + " words") : "";
            lblStatusText.text = "'" + textLayer.name + "' (" + typeStr + ", " + alignStr + wordCount + ")";
            btnAutoDetect.enabled = true;

            // Automatically update Precomp Width if option is checked
            if (chkAutoDetectWidth && chkAutoDetectWidth.value && metrics && metrics.detectedWidth) {
                var padVal = parseFloat(txtPad.text) || 0;
                var proposedPrecompW = Math.max(40, Math.round(metrics.detectedWidth + (padVal * 2)));
                txtWidth.text = String(proposedPrecompW);
            }
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
            var proposedPrecompW = Math.max(40, Math.round(metrics.detectedWidth + (padVal * 2)));
            txtWidth.text = String(proposedPrecompW);
            txtHeight.text = String(Math.round(metrics.detectedHeight + (padVal * 2)));

            if (metrics.align === "center") {
                dropAlign.selection = 2; // Top-Center
            } else if (metrics.align === "right") {
                dropAlign.selection = 3; // Top-Right
            } else {
                dropAlign.selection = 1; // Top-Left
            }

            lblFeedback.text = "Auto-detected: Text " + metrics.detectedWidth + "x" + metrics.detectedHeight + "px (" + metrics.align + ") -> Precomp " + proposedPrecompW + "px";
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

    function executePrecomp(divideMode) {
        var actionName = "AE Text Precomp";
        if (divideMode === "words") actionName = "AE Text Precomp (Divide by Words)";
        else if (divideMode === "lines") actionName = "AE Text Precomp (Divide by Lines)";

        if (app.beginUndoGroup) app.beginUndoGroup(actionName);
        try {
            var w = parseFloat(txtWidth.text) || 800;
            var h = parseFloat(txtHeight.text) || 400;
            var autoH = chkAutoHeight.value;
            var autoAnc = chkAutoAnchor.value;
            var padVal = parseFloat(txtPad.text) || 0;

            var anchorAlign = "auto";
            if (dropAlign.selection) {
                var selIdx = dropAlign.selection.index;
                var presetNames = [
                    "auto",
                    "top-left",
                    "top-center",
                    "top-right",
                    "mid-left",
                    "center",
                    "mid-right",
                    "bot-left",
                    "bot-center",
                    "bot-right"
                ];
                if (selIdx >= 0 && selIdx < presetNames.length) {
                    anchorAlign = presetNames[selIdx];
                }
            }

            var anchorRef = (radRefCanvas && radRefCanvas.value) ? "canvas" : "content";
            var createCross = chkShowCross ? chkShowCross.value : false;
            var crossColor = (dropCrossCol && dropCrossCol.selection) ? dropCrossCol.selection.text : "Cyan";

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
                anchorAlign: anchorAlign,
                anchorReference: anchorRef,
                createCross: createCross,
                crossColor: crossColor,
                autoDetectWidth: chkAutoDetectWidth.value,
                forceAlign: "auto",
                addBackground: addBg,
                corners: corners,
                bgColor: bgColor,
                bgOpacity: bgOpacity,
                divideMode: divideMode || "none"
            });

            try {
                syncLayerDetection();
            } catch (eSync) {}

            var msg = "";
            if (divideMode === "words") {
                msg = "Precomposed '" + res.name + "' divided into " + (res.wordCount || 0) + " word layers [" + res.width + "x" + res.height + "px]";
            } else if (divideMode === "lines") {
                msg = "Precomposed '" + res.name + "' divided into " + (res.lineCount || 0) + " line layers [" + res.width + "x" + res.height + "px]";
            } else {
                msg = "Precomposed '" + res.name + "' [" + res.width + "x" + res.height + "px, Padding: " + res.padding + "px, Textbox: " + res.textboxWidth + "px]";
            }
            if (res.createdDummy) {
                msg += " (Generated 100-word dummy layer)";
            }
            lblFeedback.text = msg;
        } catch (err) {
            alert("Error precomposing text box" + (err.line ? (" at line " + err.line) : "") + ":\n" + (err.message || err.toString()));
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    }

    btnPrecomp.onClick = function() {
        executePrecomp("none");
    };

    btnDivideWords.onClick = function() {
        executePrecomp("words");
    };

    btnDivideLines.onClick = function() {
        executePrecomp("lines");
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
