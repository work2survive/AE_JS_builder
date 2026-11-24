// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT HIGHLIGHT v2.2.0
// =============================================================================
//
// PURPOSE:
//   Advanced procedural typography highlighter for Adobe After Effects.
//   Supports two swappable highlight generation methods selectable at the top of the UI:
//     1. "Split Method": Aligns anchor point to Top-Left with zero visual shift,
//        marks original as guideline layer, splits target lines & words into independent
//        text boxes with top-left anchor points, and rigs matching vector highlight boxes.
//     2. "Calculation Method": Keeps the original text box intact without splitting,
//        calculating exact highlight box positions and dimensions in-place using all
//        available font metrics, leading, tracking, boxTextPos, and delimiter-anchored advance.
//
// ARCHITECTURAL REFERENCES & KNOWLEDGE BASE:
//   1. AE vs. JS Text Rendering Differences Guide (Engine Metrics, Delimiter Advance & Justification):
//      https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
//   2. AE Align Anchor Point (Mandatory First-Action Zero-Shift Anchor Alignment):
//      https://github.com/work2survive/AE-Align-AnchorPoint
//   3. Text & Box Properties to Effects (Typography & Inspector Engine):
//      https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx
//   4. AE Text Precomp (Zero-Shift Precomposition & Line/Word Splitting):
//      https://github.com/work2survive/AE_JS_builder/blob/main/samples/AE_Text_Precomp.jsx
//      https://github.com/work2survive/AE-text-precomp
//   5. Interactive Custom Rounded Rect & Color Picker:
//      https://github.com/work2survive/AE_JS_builder/blob/main/jsx/custom_rounded_rect.jsx
//   6. AE Text Highlight Repository:
//      https://github.com/work2survive/AE-Text-Highlight
//
// NEW IN v2.1.1:
//   - Selective Highlight Text Coloring: Highlight box fill strictly changes only the color of the
//     font related to the highlights (via range selectors in Calculation Method and segment targets in Split Method).
//   - Checkbox Toggle for Highlighted Text Color: Added a toggle checkbox before "Highlighted Text Color:"
//     to disable this option when needed; when disabled, the original font color remains 100% untouched.
//
// NEW IN v2.1.0:
//   - Mandatory First-Action Anchor Alignment: Always aligns the text box anchor point to Top-Left
//     using AE_Align_Anchor_Point.jsx logic with 0.00px visual shift, regardless of method selected.
//   - Eliminated Upward Shift in Split Method: Line 1 baseline is strictly calibrated from typographic
//     ascender (matching AE_Text_Precomp), preventing glyphs from ascending into negative space.
//   - Precomp Anchor Point & Size Normalization: Precomp layer anchor point is pinned strictly to
//     Top-Left ([0, 0, 0]) and dimensions match the text box dimensions, eliminating baseline offsets.
//
// REPOSITORY: https://github.com/work2survive/AE-Text-Highlight
// LIVE DEMO:  https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Highlight.jsx&autobuild=true
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_TITLE    = "AE Text Highlight";
    var SCRIPT_VERSION  = "v2.1.1";
    var GITHUB_REPO_URL = "https://github.com/work2survive/AE-Text-Highlight";

    // -------------------------------------------------------------------------
    // 1. Safe Environment & Global In-Memory Store
    // -------------------------------------------------------------------------
    var globalObj = (typeof $ !== "undefined" && typeof $.global !== "undefined")
        ? $.global
        : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));

    if (typeof $ === "undefined") {
        globalObj.$ = { global: globalObj, writeln: function (msg) { if (typeof console !== "undefined") console.log(msg); } };
    } else if (typeof $.global === "undefined") {
        $.global = globalObj;
    }

    var $memGlobal = (typeof $ !== "undefined" && typeof $.global !== "undefined") ? $.global : globalObj.$;
    if (typeof $memGlobal.AE_TEXT_BOX_MEMORY === "undefined") {
        $memGlobal.AE_TEXT_BOX_MEMORY = {
            layerName: "",
            words: [],
            wordWidths: [],
            lines: [],
            lineWidths: [],
            spaceWidth: 0,
            fontSize: 34,
            font: "Georgia",
            boxWidth: 0,
            boxHeight: 0,
            totalWords: 0,
            totalLines: 0,
            timestamp: 0
        };
    }

    // -------------------------------------------------------------------------
    // 2. Constants & Presets
    // -------------------------------------------------------------------------
    var LOREM_IPSUM_RAW =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. " +
        "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. " +
        "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. " +
        "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, " +
        "nec luctus magna felis sollicitudin mauris.";

    var SLOW_LIVING_QUOTE =
        "Slow living is not about doing everything at a snail's pace; " +
        "it is about doing everything at the right speed. " +
        "Savoring the hours and minutes rather than merely counting them. " +
        "Living mindfully in the present moment with intention, balance, and calm.";

    var COLOR_PRESETS = {
        "Hot Pink": {
            highlight: [1.0, 0.16, 0.43],    // #FF2A6D
            highlightHex: "#FF2A6D",
            text: [1.0, 1.0, 1.0],           // #FFFFFF
            textHex: "#FFFFFF"
        },
        "Golden Glow": {
            highlight: [1.0, 0.82, 0.40],    // #FFD166
            highlightHex: "#FFD166",
            text: [0.10, 0.10, 0.10],        // #1A1A1A
            textHex: "#1A1A1A"
        },
        "Neon Mint": {
            highlight: [0.02, 0.84, 0.63],    // #06D6A0
            highlightHex: "#06D6A0",
            text: [0.07, 0.07, 0.07],        // #111111
            textHex: "#111111"
        },
        "Electric Cyan": {
            highlight: [0.02, 0.85, 0.91],    // #05D9E8
            highlightHex: "#05D9E8",
            text: [0.05, 0.07, 0.09],        // #0D1117
            textHex: "#0D1117"
        },
        "Lavender Dream": {
            highlight: [0.70, 0.53, 1.00],    // #B388FF
            highlightHex: "#B388FF",
            text: [0.12, 0.11, 0.14],        // #1F1B24
            textHex: "#1F1B24"
        },
        "Dark Mode Minimal": {
            highlight: [0.95, 0.95, 0.95],    // #F2F2F2
            highlightHex: "#F2F2F2",
            text: [0.05, 0.05, 0.05],        // #0D0D0D
            textHex: "#0D0D0D"
        },
        "Slow Living Demo": {
            highlight: [1.00, 0.25, 0.51],    // #FF4081
            highlightHex: "#FF4081",
            text: [1.00, 1.00, 1.00],        // #FFFFFF
            textHex: "#FFFFFF"
        }
    };

    var TYPICAL_FONTS = ["Georgia", "Cambria", "Arial", "Helvetica", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New"];

    // -------------------------------------------------------------------------
    // 3. String & Color Helpers
    // -------------------------------------------------------------------------
    function trimStr(str) {
        if (!str) return "";
        return String(str).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    }

    function hexToRgb(hex) {
        if (!hex) return [1, 1, 1];
        var clean = String(hex).replace(/[^0-9A-Fa-f]/g, "");
        if (clean.length === 3) {
            clean = clean.charAt(0) + clean.charAt(0) +
                    clean.charAt(1) + clean.charAt(1) +
                    clean.charAt(2) + clean.charAt(2);
        }
        if (clean.length < 6) return [1, 1, 1];
        var num = parseInt(clean.substr(0, 6), 16);
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#FFFFFF";
        var r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
        var g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
        var b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
        var rStr = (r < 16 ? "0" : "") + r.toString(16);
        var gStr = (g < 16 ? "0" : "") + g.toString(16);
        var bStr = (b < 16 ? "0" : "") + b.toString(16);
        return ("#" + rStr + gStr + bStr).toUpperCase();
    }

    function sanitizeSearchTerm(term) {
        if (!term) return "";
        return trimStr(String(term).replace(/^[\s,"']+|[\s,"']+$/g, ""));
    }

    function parseHighlightTerms(rawStr) {
        if (!rawStr) return [];
        var lines = String(rawStr).split(/\r\n|\r|\n/);
        var terms = [];
        var seen = {};

        for (var i = 0; i < lines.length; i++) {
            var line = trimStr(lines[i]);
            if (!line) continue;
            var chunks = line.split(/,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/);
            for (var c = 0; c < chunks.length; c++) {
                var clean = sanitizeSearchTerm(chunks[c]);
                if (clean.length > 0 && !seen[clean.toLowerCase()]) {
                    seen[clean.toLowerCase()] = true;
                    terms.push(clean);
                }
            }
        }
        return terms;
    }

    function extractRandomWordsAndSentence(textStr) {
        if (!textStr) textStr = LOREM_IPSUM_RAW;

        var rawSentences = textStr.split(/[\.\!\?]+/);
        var cleanSentences = [];
        for (var s = 0; s < rawSentences.length; s++) {
            var sent = trimStr(rawSentences[s].replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""));
            if (sent.split(/\s+/).length >= 3) {
                cleanSentences.push(sent);
            }
        }

        var pickedSentence = cleanSentences.length > 0
            ? cleanSentences[Math.floor(Math.random() * cleanSentences.length)]
            : "Curabitur pretium tincidunt lacus";

        var rawWords = textStr.split(/[\s\r\n\.,;:!\?"'\(\)\[\]\{\}]+/);
        var eligibleWords = [];
        var seen = {};
        var lowerSent = pickedSentence.toLowerCase();

        for (var w = 0; w < rawWords.length; w++) {
            var wd = trimStr(rawWords[w]);
            var lowerWd = wd.toLowerCase();
            if (wd.length >= 5 && !seen[lowerWd]) {
                seen[lowerWd] = true;
                if (lowerSent.indexOf(lowerWd) === -1) {
                    eligibleWords.push(wd);
                }
            }
        }

        for (var i = eligibleWords.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = eligibleWords[i];
            eligibleWords[i] = eligibleWords[j];
            eligibleWords[j] = tmp;
        }

        var pickedWords = eligibleWords.slice(0, 3);
        if (pickedWords.length < 3) {
            pickedWords = ["consectetur", "reprehenderit", "cupidatat"];
        }

        return { words: pickedWords, sentence: pickedSentence };
    }

    // -------------------------------------------------------------------------
    // 4. ExtendScript & Web Typographic Metric Fallbacks
    // -------------------------------------------------------------------------
    function measureTextExact(str, fontSize, fontName) {
        if (!str) return 0;
        var fs = Number(fontSize) || 34;
        var cleanFont = trimStr(String(fontName || "Georgia").replace(/['"]/g, ""));

        if (typeof document !== "undefined") {
            try {
                var c = document.getElementById("__ae_text_measure_canvas");
                if (!c) {
                    c = document.createElement("canvas");
                    c.id = "__ae_text_measure_canvas";
                    c.style.display = "none";
                    document.body.appendChild(c);
                }
                var ctx = c.getContext("2d");
                var fontLower = cleanFont.toLowerCase();
                var fontStack = cleanFont;
                if (fontLower.indexOf("courier") !== -1 || fontLower.indexOf("consolas") !== -1 || fontLower.indexOf("mono") !== -1) {
                    fontStack = "'" + cleanFont + "', 'Courier New', Consolas, monospace";
                } else if (fontLower.indexOf("times") !== -1 || fontLower.indexOf("georgia") !== -1 || fontLower.indexOf("cambria") !== -1 || fontLower.indexOf("serif") !== -1) {
                    fontStack = "'" + cleanFont + "', Georgia, Cambria, 'Times New Roman', serif";
                } else if (fontLower.indexOf("impact") !== -1) {
                    fontStack = "'" + cleanFont + "', Impact, sans-serif";
                } else if (fontLower.indexOf("trebuchet") !== -1) {
                    fontStack = "'" + cleanFont + "', 'Trebuchet MS', sans-serif";
                } else if (fontLower.indexOf("verdana") !== -1) {
                    fontStack = "'" + cleanFont + "', Verdana, sans-serif";
                } else {
                    fontStack = "'" + cleanFont + "', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                }
                ctx.font = fs + "px " + fontStack;
                var m = ctx.measureText(str).width;
                if (m && !isNaN(m) && m > 0) return m;
            } catch (e) {}
        }

        var fontLower2 = cleanFont.toLowerCase();
        if (fontLower2.indexOf("courier") !== -1 || fontLower2.indexOf("mono") !== -1) {
            return str.length * fs * 0.60;
        }

        var isTrebuchet = (fontLower2.indexOf("trebuchet") !== -1);
        var isVerdana   = (fontLower2.indexOf("verdana") !== -1);
        var isImpact    = (fontLower2.indexOf("impact") !== -1);
        var isTimes     = (fontLower2.indexOf("times") !== -1);
        var isCambria   = (fontLower2.indexOf("cambria") !== -1);
        var isGeorgia   = (fontLower2.indexOf("georgia") !== -1 || (!isCambria && !isTimes && fontLower2.indexOf("serif") !== -1));

        var total = 0;
        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            var code = ch.charCodeAt(0);
            if (code === 32) {
                total += isTrebuchet ? (fs * 0.30) : (isVerdana ? (fs * 0.35) : (isImpact ? (fs * 0.18) : (isGeorgia ? (fs * 0.24) : (isCambria ? (fs * 0.26) : (isTimes ? (fs * 0.25) : (fs * 0.28))))));
            } else if ("ijl|!.,:;'I`".indexOf(ch) !== -1) {
                total += isTrebuchet ? (fs * 0.29) : (isVerdana ? (fs * 0.27) : (isImpact ? (fs * 0.27) : (isGeorgia ? (fs * 0.29) : (isCambria ? (fs * 0.27) : (isTimes ? (fs * 0.28) : (fs * 0.22))))));
            } else if ("frt[](){}".indexOf(ch) !== -1) {
                total += isTrebuchet ? (fs * 0.35) : (isVerdana ? (fs * 0.38) : (isImpact ? (fs * 0.32) : (isGeorgia ? (fs * 0.38) : (isCambria ? (fs * 0.35) : (isTimes ? (fs * 0.34) : (fs * 0.33))))));
            } else if ("wmWM@#%&".indexOf(ch) !== -1) {
                total += isTrebuchet ? (fs * 0.78) : (isVerdana ? (fs * 0.90) : (isImpact ? (fs * 0.75) : (isGeorgia ? (fs * 0.90) : (isCambria ? (fs * 0.86) : (isTimes ? (fs * 0.85) : (fs * 0.83))))));
            } else if (ch >= 'A' && ch <= 'Z') {
                total += isTrebuchet ? (fs * 0.60) : (isVerdana ? (fs * 0.68) : (isImpact ? (fs * 0.52) : (isGeorgia ? (fs * 0.67) : (isCambria ? (fs * 0.68) : (isTimes ? (fs * 0.70) : (fs * 0.67))))));
            } else if (ch >= '0' && ch <= '9') {
                total += isTrebuchet ? (fs * 0.54) : (isVerdana ? (fs * 0.60) : (isImpact ? (fs * 0.51) : (isGeorgia ? (fs * 0.52) : (isCambria ? (fs * 0.53) : (isTimes ? (fs * 0.50) : (fs * 0.56))))));
            } else if (code > 255) {
                total += fs * 1.0;
            } else {
                total += isTrebuchet ? (fs * 0.54) : (isVerdana ? (fs * 0.60) : (isImpact ? (fs * 0.51) : (isGeorgia ? (fs * 0.50) : (isCambria ? (fs * 0.51) : (isTimes ? (fs * 0.44) : (fs * 0.56))))));
            }
        }
        return total;
    }

    function wordWrapToBoxWidth(rawText, maxBoxWidth, fontSize, fontName, indentPx) {
        var words = String(rawText).replace(/\r\n|\r|\n/g, " ").split(/\s+/);
        var lines = [];
        var indentSpaces = "";
        if (indentPx >= 70) indentSpaces = "         ";
        else if (indentPx >= 45) indentSpaces = "      ";
        else if (indentPx >= 20) indentSpaces = "   ";

        var currentLine = indentSpaces;

        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (!word) continue;
            var testLine = (currentLine.length === 0 || currentLine === indentSpaces)
                ? (currentLine + word)
                : (currentLine + " " + word);

            var w = measureTextExact(testLine, fontSize, fontName);
            if (w > maxBoxWidth && trimStr(currentLine).length > 0) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (trimStr(currentLine).length > 0) {
            lines.push(currentLine);
        }
        return lines.join("\n");
    }

    // -------------------------------------------------------------------------
    // 5. Layer Detection & Document Property Extraction
    // -------------------------------------------------------------------------
    function isTextLayer(layer) {
        if (!layer) return false;
        try {
            if (typeof layer.property === "function") {
                if (layer.property("ADBE Text Properties") !== null) return true;
                if (layer.property("Source Text") !== null) return true;
                if (layer.property("Text") !== null) return true;
            }
        } catch (e) {}
        try {
            if (layer.text && layer.text.sourceText) return true;
        } catch (e2) {}
        return false;
    }

    function getTextDocument(layer) {
        if (!layer) return null;
        try {
            var prop = layer.property("ADBE Text Properties") || layer.property("Text");
            var docProp = prop ? (prop.property("ADBE Text Document") || prop.property("Source Text")) : layer.property("Source Text");
            if (docProp && docProp.value) return docProp.value;
        } catch (e) {}
        try {
            if (layer.text && layer.text.sourceText && layer.text.sourceText.value) {
                return layer.text.sourceText.value;
            }
        } catch (e2) {}
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
        return "";
    }

    function getSourceRect(layer, compTime) {
        if (!layer || typeof layer.sourceRectAtTime !== "function") return { left: 0, top: 0, width: 0, height: 0 };
        try {
            var t = (compTime !== undefined) ? compTime : ((typeof layer.time !== "undefined") ? layer.time : 0);
            var r = layer.sourceRectAtTime(t, false);
            if (r) return r;
        } catch (e) {}
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    function getSelectedTextLayer(comp) {
        if (!comp) return null;
        var sel = comp.selectedLayers;
        if (sel && sel.length > 0) {
            for (var i = 0; i < sel.length; i++) {
                if (isTextLayer(sel[i])) return sel[i];
            }
        }
        var total = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
        for (var j = 1; j <= total; j++) {
            var l = (typeof comp.layer === "function") ? comp.layer(j) : (comp.layers[j] || comp.layers[j - 1]);
            if (l && isTextLayer(l) && l.enabled && !l.guideLayer) return l;
        }
        return null;
    }

    function getJustificationName(textDoc, textLayer) {
        if (textDoc && typeof textDoc.justification !== "undefined") {
            var j = textDoc.justification;
            if (typeof ParagraphJustification !== "undefined") {
                if (j === ParagraphJustification.CENTER_JUSTIFY ||
                    j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER) {
                    return "center";
                }
                if (j === ParagraphJustification.RIGHT_JUSTIFY ||
                    j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT) {
                    return "right";
                }
                if (j === ParagraphJustification.LEFT_JUSTIFY ||
                    j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT ||
                    j === ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL) {
                    return "left";
                }
            }
            if (j == 7414 || j == 7417) return "center";
            if (j == 7413 || j == 7416) return "right";
            if (j == 7412 || j == 7415 || j == 7418) return "left";
            if (j === 1 || j === "center") return "center";
            if (j === 2 || j === "right") return "right";
        }
        if (textLayer && textLayer.justification) {
            var lj = String(textLayer.justification).toLowerCase();
            if (lj.indexOf("center") !== -1) return "center";
            if (lj.indexOf("right") !== -1) return "right";
        }
        return "left";
    }

    // -------------------------------------------------------------------------
    // 6. Text Properties to Effects (Inspector & In-Memory Store)
    // Reference: Text_Properties_To_Effects.jsx
    // -------------------------------------------------------------------------
    function measureAndStoreTextMetrics(comp, layer) {
        if (!comp || !layer || !isTextLayer(layer)) return null;

        var textDoc = getTextDocument(layer);
        if (!textDoc) return null;

        var fullText = String(textDoc.text || "");
        var sRect = getSourceRect(layer);

        var isBox = false;
        var boxWidth = 0;
        var boxHeight = 0;
        var boxPos = [0, 0];
        try {
            if (textDoc.boxText && textDoc.boxTextSize) {
                isBox = true;
                boxWidth = textDoc.boxTextSize[0];
                boxHeight = textDoc.boxTextSize[1];
                if (textDoc.boxTextPos) boxPos = textDoc.boxTextPos;
            }
        } catch (eBox) {}

        if (boxWidth <= 0 && sRect && sRect.width > 0) boxWidth = sRect.width;
        if (boxHeight <= 0 && sRect && sRect.height > 0) boxHeight = sRect.height;

        var words = fullText.match(/\S+/g) || [];
        var wordWidths = [];
        var lines = [];
        var lineWidths = [];
        var spaceWidth = 0;

        var tempLayer = null;
        try {
            tempLayer = comp.layers.addText("");
            tempLayer.enabled = true;
            tempLayer.transform.position.setValue([-9999, -9999, 0]);
            tempLayer.startTime = 0;
            tempLayer.inPoint = 0;
            tempLayer.outPoint = (comp && comp.duration && comp.duration > 0) ? comp.duration : 1000;
            var sampleTime = tempLayer.inPoint;

            var tempDocProp = tempLayer.property("Source Text");
            if (!tempDocProp) {
                try { tempDocProp = tempLayer.property("ADBE Text Properties").property("ADBE Text Document"); } catch (eTP) {}
            }
            if (!tempDocProp && tempLayer.sourceText) tempDocProp = tempLayer.sourceText;

            var tempDoc = tempDocProp ? tempDocProp.value : null;
            if (tempDoc) {
                tempDoc.fontSize = textDoc.fontSize || 34;
                if (textDoc.font) {
                    try { tempDoc.font = textDoc.font; } catch (eFont) {}
                }
                tempDoc.tracking = textDoc.tracking || 0;
                tempDoc.applyStroke = textDoc.applyStroke || false;
                tempDoc.strokeWidth = textDoc.strokeWidth || 0;
                tempDoc.applyFill = true;
                tempDoc.fillColor = [1, 1, 1];
                try { tempDoc.boxText = false; } catch (eBT) {}
                try {
                    if (typeof ParagraphJustification !== "undefined") {
                        tempDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
                    } else {
                        tempDoc.justification = 7412;
                    }
                } catch (eJ) {}
                try { tempDocProp.setValue(tempDoc); } catch (eDocSet) {}
            }

            function sampleTempRect(str) {
                if (tempDocProp) {
                    if (tempDoc) {
                        tempDoc.text = str;
                        tempDocProp.setValue(tempDoc);
                    } else {
                        tempDocProp.setValue(str);
                    }
                }
                return tempLayer.sourceRectAtTime(sampleTime, false);
            }

            for (var w = 0; w < words.length; w++) {
                var rW = sampleTempRect(words[w]);
                var ww = rW ? (Math.round(rW.width * 100) / 100) : 0;
                wordWidths.push(ww);
            }

            var rPair = sampleTempRect("A A");
            var rSingle = sampleTempRect("AA");
            if (rPair && rSingle) {
                spaceWidth = Math.max(0, Math.round((rPair.width - rSingle.width) * 100) / 100);
            }
            if (spaceWidth <= 0) {
                spaceWidth = Math.round(((textDoc.fontSize || 34) * 0.28) * 100) / 100;
            }

            var paragraphs = fullText.split(/\r\n|\r|\n/);
            for (var p = 0; p < paragraphs.length; p++) {
                var para = paragraphs[p];
                if (!isBox || boxWidth <= 0) {
                    var rL = sampleTempRect(para);
                    var lw = rL ? (Math.round(rL.width * 100) / 100) : 0;
                    lines.push(para);
                    lineWidths.push(lw);
                } else {
                    var pWords = para.match(/\S+/g) || [];
                    if (pWords.length === 0) {
                        lines.push("");
                        lineWidths.push(0);
                        continue;
                    }
                    var curLine = pWords[0];
                    var rCur = sampleTempRect(curLine);
                    var curW = rCur ? rCur.width : 0;

                    for (var pw = 1; pw < pWords.length; pw++) {
                        var testLine = curLine + " " + pWords[pw];
                        var rTest = sampleTempRect(testLine);
                        var testW = rTest ? rTest.width : 0;

                        if (testW > boxWidth && curLine.length > 0) {
                            lines.push(curLine);
                            lineWidths.push(Math.round(curW * 100) / 100);
                            curLine = pWords[pw];
                            var rNext = sampleTempRect(curLine);
                            curW = rNext ? rNext.width : 0;
                        } else {
                            curLine = testLine;
                            curW = testW;
                        }
                    }
                    lines.push(curLine);
                    lineWidths.push(Math.round(curW * 100) / 100);
                }
            }
        } catch (measErr) {
            var fn = textDoc.font || "Georgia";
            var fsz = textDoc.fontSize || 34;
            if (wordWidths.length === 0) {
                for (var fw = 0; fw < words.length; fw++) {
                    wordWidths.push(measureTextExact(words[fw], fsz, fn));
                }
            }
            if (lines.length === 0) {
                var rawParas = fullText.split(/\r\n|\r|\n/);
                for (var rp = 0; rp < rawParas.length; rp++) {
                    lines.push(rawParas[rp]);
                    lineWidths.push(measureTextExact(rawParas[rp], fsz, fn));
                }
            }
        } finally {
            if (tempLayer) {
                try { tempLayer.remove(); } catch (remErr) {}
            }
        }

        var maxLW = 0;
        for (var ml = 0; ml < lineWidths.length; ml++) {
            if (lineWidths[ml] > maxLW) maxLW = lineWidths[ml];
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
            fontSize: textDoc.fontSize || 34,
            font: textDoc.font || "Georgia",
            isBox: isBox,
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            boxPos: boxPos,
            totalWords: words.length,
            totalLines: lines.length,
            maxLineWidth: maxLW,
            timestamp: (new Date()).getTime()
        };

        $memGlobal.AE_TEXT_BOX_MEMORY = memoryStore;
        try { layer._textMetrics = memoryStore; } catch (eMem) {}
        return memoryStore;
    }

    function getTextBoxProperties(comp, layer) {
        if (!comp || !layer || !isTextLayer(layer)) return null;

        var textDoc = getTextDocument(layer);
        var sRect = getSourceRect(layer);
        var fullText = textDoc ? String(textDoc.text || "") : "";

        var isBox = false;
        var boxWidth = 0;
        var boxHeight = 0;
        var boxPos = [0, 0];
        try {
            if (textDoc && textDoc.boxText && textDoc.boxTextSize) {
                isBox = true;
                boxWidth = textDoc.boxTextSize[0];
                boxHeight = textDoc.boxTextSize[1];
                if (textDoc.boxTextPos) boxPos = textDoc.boxTextPos;
            }
        } catch (eBox) {}

        if (!sRect || (sRect.width === 0 && sRect.height === 0)) {
            sRect = { left: 0, top: 0, width: (boxWidth > 0 ? boxWidth : 800), height: (textDoc ? textDoc.fontSize * 1.5 : 50) };
        }
        if (boxWidth <= 0) boxWidth = sRect.width;
        if (boxHeight <= 0) boxHeight = sRect.height;

        var fontSize = (textDoc && textDoc.fontSize) ? textDoc.fontSize : 34;
        var font = (textDoc && textDoc.font) ? textDoc.font : "Georgia";
        var leading = (textDoc && textDoc.leading && !textDoc.autoLeading) ? textDoc.leading : (fontSize * 1.2);
        var tracking = (textDoc && textDoc.tracking) ? textDoc.tracking : 0;
        var justification = getJustificationName(textDoc, layer);
        var fillColor = (textDoc && textDoc.fillColor) ? textDoc.fillColor : [1, 1, 1];

        var metrics = measureAndStoreTextMetrics(comp, layer);

        return {
            isText: true,
            layerName: layer.name,
            textDoc: textDoc,
            fullText: fullText,
            isBox: isBox,
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            boxPos: boxPos,
            sRect: sRect,
            fontSize: fontSize,
            font: font,
            leading: leading,
            tracking: tracking,
            justification: justification,
            fillColor: fillColor,
            metrics: metrics
        };
    }

    // Attaches live effect controls on the layer based on Text_Properties_To_Effects.jsx
    function attachTextPropertiesEffects(layer, props) {
        if (!layer) return;
        try {
            var fxGroup = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!fxGroup) return;

            function addSlider(name, val, expr) {
                var eff = fxGroup.property(name) || fxGroup.addProperty("ADBE Slider Control");
                if (eff) {
                    eff.name = name;
                    var p = eff.property(1);
                    if (p) {
                        p.setValue(Number(val));
                        if (expr) {
                            try { p.expression = expr; } catch (eExp) {}
                        }
                    }
                }
            }

            function addPoint(name, val, expr) {
                var eff = fxGroup.property(name) || fxGroup.addProperty("ADBE Point Control");
                if (eff) {
                    eff.name = name;
                    var p = eff.property(1);
                    if (p) {
                        p.setValue(val);
                        if (expr) {
                            try { p.expression = expr; } catch (eExp) {}
                        }
                    }
                }
            }

            addSlider("Box Text Width", props.boxWidth, "try { var st = text.sourceText; st.style.boxTextSize[0]; } catch(e) { sourceRectAtTime(time, false).width; }");
            addSlider("Box Text Height", props.boxHeight, "try { var st = text.sourceText; st.style.boxTextSize[1]; } catch(e) { sourceRectAtTime(time, false).height; }");
            addSlider("Text Width (sourceRect)", props.sRect.width, "sourceRectAtTime(time, false).width;");
            addSlider("Text Height (sourceRect)", props.sRect.height, "sourceRectAtTime(time, false).height;");
            addPoint("Visual Center Offset", [props.sRect.left + props.sRect.width / 2, props.sRect.top + props.sRect.height / 2], "var r = sourceRectAtTime(time, false);\n[r.left + r.width / 2, r.top + r.height / 2];");

            var alignIdx = (props.justification === "center") ? 1 : ((props.justification === "right") ? 2 : 0);
            addSlider("Alignment Index", alignIdx, "try { var j = text.sourceText.style.justification; if (j == 7414) 1; else if (j == 7413) 2; else 0; } catch(e) { 0; }");
            addSlider("Is Paragraph Box Text", props.isBox ? 1 : 0, "try { text.sourceText.style.boxText ? 1 : 0; } catch(e) { 0; }");
        } catch (eFx) {}
    }

    // -------------------------------------------------------------------------
    // 7. Anchor Point Alignment Engine (Zero-Shift Anchor Alignment)
    // Reference: AE-Align-AnchorPoint
    // -------------------------------------------------------------------------
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

    function applyZeroShiftAnchor(layer, targetAnchor) {
        if (!layer) return;
        var curA = layer.transform.anchorPoint.value;
        var curP = layer.transform.position.value;
        var curS = layer.transform.scale.value;
        var sx = (curS[0] || 100) / 100;
        var sy = (curS[1] || 100) / 100;

        var dx = (targetAnchor[0] - curA[0]) * sx;
        var dy = (targetAnchor[1] - curA[1]) * sy;

        var rot = (layer.transform.rotation && typeof layer.transform.rotation.value === "number")
            ? layer.transform.rotation.value : 0;

        var is3D = Boolean(layer.threeDLayer);
        if (rot && Math.abs(rot) > 0.0001) {
            var rad = rot * (Math.PI / 180);
            var rx = dx * Math.cos(rad) - dy * Math.sin(rad);
            var ry = dx * Math.sin(rad) + dy * Math.cos(rad);
            layer.transform.position.setValue(is3D ? [curP[0] + rx, curP[1] + ry, curP[2] || 0] : [curP[0] + rx, curP[1] + ry]);
        } else {
            layer.transform.position.setValue(is3D ? [curP[0] + dx, curP[1] + dy, curP[2] || 0] : [curP[0] + dx, curP[1] + dy]);
        }
        layer.transform.anchorPoint.setValue(is3D ? [targetAnchor[0], targetAnchor[1], curA[2] || 0] : [targetAnchor[0], targetAnchor[1]]);
    }

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

        try {
            var comp = layer.containingComp;
            var t = comp ? comp.time : 0;
            var r = layer.sourceRectAtTime(t, false);
            return {
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height
            };
        } catch (eSR) {
            return { left: 0, top: 0, width: 100, height: 100 };
        }
    }

    /**
     * Mandatory first-action anchor alignment:
     * Aligns the text layer anchor point strictly to the Top-Left of the text box
     * using AE_Align_Anchor_Point.jsx logic with 0.00px visual shift.
     * Works identically on both Point Text and Paragraph Box Text.
     */
    function alignLayerAnchorPointTopLeft(targetLayer) {
        if (!targetLayer) return false;
        var comp = targetLayer.containingComp;
        var is3D = Boolean(targetLayer.threeDLayer);

        var bounds = getLayerStatedBounds(targetLayer);
        var targetA = [bounds.left, bounds.top];

        var apProp = (targetLayer.transform && targetLayer.transform.anchorPoint) ? targetLayer.transform.anchorPoint : (targetLayer.property("ADBE Transform Group") ? targetLayer.property("ADBE Transform Group").property("ADBE Anchor Point") : null);
        var posProp = (targetLayer.transform && targetLayer.transform.position) ? targetLayer.transform.position : (targetLayer.property("ADBE Transform Group") ? targetLayer.property("ADBE Transform Group").property("ADBE Position") : null);
        var scaleProp = (targetLayer.transform && targetLayer.transform.scale) ? targetLayer.transform.scale : (targetLayer.property("ADBE Transform Group") ? targetLayer.property("ADBE Transform Group").property("ADBE Scale") : null);
        var rotProp = (targetLayer.transform && (targetLayer.transform.rotation || targetLayer.transform.zRotation)) ? (targetLayer.transform.rotation || targetLayer.transform.zRotation) : (targetLayer.property("ADBE Transform Group") ? (targetLayer.property("ADBE Transform Group").property("ADBE Rotate Z") || targetLayer.property("ADBE Transform Group").property("ADBE Rotation")) : null);

        if (!apProp || !posProp) return false;

        var curA = apProp.value;
        var curPos = posProp.value;
        var curScale = scaleProp ? scaleProp.value : [100, 100];
        var curRot = rotProp ? (rotProp.value || 0) : 0;

        var sx = (curScale[0] || 100) / 100;
        var sy = (curScale[1] || 100) / 100;
        var deltaAx = targetA[0] - curA[0];
        var deltaAy = targetA[1] - curA[1];

        var sdx = deltaAx * sx;
        var sdy = deltaAy * sy;
        var pDeltaX = sdx;
        var pDeltaY = sdy;

        if (curRot && Math.abs(curRot) > 0.0001) {
            var rad = curRot * (Math.PI / 180);
            pDeltaX = sdx * Math.cos(rad) - sdy * Math.sin(rad);
            pDeltaY = sdx * Math.sin(rad) + sdy * Math.cos(rad);
        }

        try { apProp.expression = ""; } catch (eAE) {}
        try { posProp.expression = ""; } catch (ePE) {}

        if (is3D) {
            apProp.setValue([targetA[0], targetA[1], curA[2] || 0]);
        } else {
            apProp.setValue([targetA[0], targetA[1]]);
        }

        if (posProp.dimensionsSeparated) {
            var xP = targetLayer.property("Transform").property("X Position");
            var yP = targetLayer.property("Transform").property("Y Position");
            if (xP) xP.setValue(xP.value + pDeltaX);
            if (yP) yP.setValue(yP.value + pDeltaY);
        } else {
            if (is3D) {
                posProp.setValue([curPos[0] + pDeltaX, curPos[1] + pDeltaY, curPos[2] || 0]);
            } else {
                posProp.setValue([curPos[0] + pDeltaX, curPos[1] + pDeltaY]);
            }
        }

        try {
            var fx = targetLayer.property("ADBE Effect Parade") || targetLayer.property("Effects");
            if (fx) {
                var effX = fx.property("Anchor Align X") || fx.addProperty("ADBE Slider Control");
                if (effX) { effX.name = "Anchor Align X"; effX.property(1).setValue(0); } // 0 = left
                var effY = fx.property("Anchor Align Y") || fx.addProperty("ADBE Slider Control");
                if (effY) { effY.name = "Anchor Align Y"; effY.property(1).setValue(0); } // 0 = top
            }
        } catch (eState) {}

        return true;
    }

    function alignAnchorPointToJustification(targetLayer, props) {
        return alignLayerAnchorPointTopLeft(targetLayer);
    }

    // -------------------------------------------------------------------------
    // 8. Guideline & Restoration Engine
    // -------------------------------------------------------------------------
    var GUIDELINE_TAG = "[Highlight Guideline]";

    function markOriginalAsGuideline(layer) {
        if (!layer) return;
        layer.guideLayer = true;
        layer.enabled = false;
        try {
            layer.comment = "AE_HIGHLIGHT_GUIDELINE_ORIGINAL";
        } catch (eC) {}
    }

    function removeHighlightsAndRestoreOriginal(comp) {
        if (!comp) return 0;
        var total = 0;
        if (typeof comp.numLayers === "number") {
            total = comp.numLayers;
        } else if (comp.layers && typeof comp.layers.length === "number") {
            total = comp.layers.length;
        }

        var toRemove = [];
        var restoredLayers = [];

        for (var i = 1; i <= total; i++) {
            var l = (typeof comp.layer === "function") ? comp.layer(i) : (comp.layers[i] || comp.layers[i - 1]);
            if (!l) continue;

            var isGuideline = false;
            try {
                if (l.comment && l.comment.indexOf("AE_HIGHLIGHT_GUIDELINE_ORIGINAL") !== -1) isGuideline = true;
            } catch (eC2) {}
            if (!isGuideline && l.guideLayer && !l.enabled && isTextLayer(l)) {
                isGuideline = true;
            }

            if (isGuideline) {
                restoredLayers.push(l);
                continue;
            }

            var isChild = false;
            try {
                if (l.comment && l.comment.indexOf("AE_HIGHLIGHT_CHILD") !== -1) isChild = true;
            } catch (eC1) {}
            if (!isChild && l.name && (
                l.name.indexOf(" - Highlights") !== -1 ||
                l.name.indexOf(" [HL-") !== -1 ||
                l.name.indexOf(" [Line ") !== -1 ||
                l.name.indexOf("Highlight Precomp") !== -1
            )) {
                isChild = true;
            }
            if (!isChild && l.parent && (
                l.parent.guideLayer === true ||
                (l.parent.comment && l.parent.comment.indexOf("AE_HIGHLIGHT_GUIDELINE_ORIGINAL") !== -1)
            )) {
                isChild = true;
            }

            if (isChild) {
                toRemove.push(l);
            }
        }

        for (var r = 0; r < toRemove.length; r++) {
            var lyr = toRemove[r];
            var srcComp = (lyr && lyr.source && (lyr.source instanceof CompItem)) ? lyr.source : null;
            try { lyr.remove(); } catch (eRem) {}
            if (srcComp && srcComp.name && srcComp.name.indexOf("Highlight Precomp") !== -1) {
                try { srcComp.remove(); } catch (eSrcRem) {}
            }
        }

        for (var rl = 0; rl < restoredLayers.length; rl++) {
            var gl = restoredLayers[rl];
            try {
                gl.guideLayer = false;
                gl.enabled = true;
                gl.comment = "";
                gl.selected = true;
            } catch (eRest) {}
        }

        // Clean up any text animators added by Calculation Method on text layers in the comp
        for (var t = 1; t <= total; t++) {
            var tl = (typeof comp.layer === "function") ? comp.layer(t) : (comp.layers[t] || comp.layers[t - 1]);
            if (tl && isTextLayer(tl)) {
                try {
                    var animGroup = tl.property("ADBE Text Properties");
                    var animators = animGroup ? animGroup.property("ADBE Text Animators") : null;
                    if (animators) {
                        var hAnim = animators.property("Highlight Text Color");
                        if (hAnim) hAnim.remove();
                    }
                } catch (eAnimRem) {}
            }
        }

        return toRemove.length;
    }

    // -------------------------------------------------------------------------
    // 9. Sub-Pixel Delimiter-Anchored Measurement Engine
    // Reference: AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
    // -------------------------------------------------------------------------
    function createMeasureHelper(comp, props) {
        var measureLayer = null;
        var measureProp = null;
        var pipeRight = 0;
        var sampleTime = 0;

        if (comp && typeof comp.layers.addText === "function") {
            try {
                measureLayer = comp.layers.addText("");
                measureLayer.enabled = true;
                measureLayer.transform.position.setValue([-9999, -9999, 0]);
                measureLayer.startTime = 0;
                measureLayer.inPoint = 0;
                measureLayer.outPoint = (comp.duration && comp.duration > 0) ? comp.duration : 1000;
                sampleTime = measureLayer.inPoint;

                try { measureProp = measureLayer.property("Source Text"); } catch (eP1) {}
                if (!measureProp) {
                    try { measureProp = measureLayer.property("ADBE Text Properties").property("ADBE Text Document"); } catch (eP2) {}
                }
                if (!measureProp && measureLayer.sourceText) measureProp = measureLayer.sourceText;

                if (measureProp) {
                    var doc = measureProp.value;
                    if (doc) {
                        doc.fontSize = props.fontSize || 34;
                        if (props.font) {
                            try { doc.font = props.font; } catch (eF) {}
                        }
                        doc.tracking = props.tracking || 0;
                        doc.applyFill = true;
                        doc.fillColor = [1, 1, 1];
                        try { doc.boxText = false; } catch (eBT) {}
                        try {
                            if (typeof ParagraphJustification !== "undefined") {
                                doc.justification = ParagraphJustification.LEFT_JUSTIFY;
                            } else {
                                doc.justification = 7412;
                            }
                        } catch (eJ) {}
                        measureProp.setValue(doc);
                    }

                    // Measure delimiter anchor "|"
                    try {
                        var dP = measureProp.value;
                        if (dP) { dP.text = "|"; measureProp.setValue(dP); }
                        else { measureProp.setValue("|"); }
                        var rP = measureLayer.sourceRectAtTime(sampleTime, false);
                        if (rP && typeof rP.width === "number") {
                            pipeRight = rP.left + rP.width;
                        }
                    } catch (ePipe) {}
                }
            } catch (eM) {
                measureLayer = null;
                measureProp = null;
            }
        }

        function measureRect(str) {
            if (!str || str.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
            if (measureLayer && measureProp) {
                try {
                    var d = measureProp.value;
                    if (d) { d.text = str; measureProp.setValue(d); }
                    else { measureProp.setValue(str); }
                    var r = measureLayer.sourceRectAtTime(sampleTime, false);
                    if (r && typeof r.width === "number" && r.width >= 0) {
                        return { left: r.left, top: r.top, width: r.width, height: r.height };
                    }
                } catch (eR) {}
            }
            var w = measureTextExact(str, props.fontSize, props.font);
            return { left: 0, top: 0, width: w, height: props.fontSize };
        }

        function measurePrefixAdvance(prefix) {
            if (!prefix || prefix.length === 0) return 0;
            if (measureLayer && measureProp && pipeRight > 0) {
                try {
                    var rPrePipe = measureRect(prefix + "|");
                    return Math.max(0, (rPrePipe.left + rPrePipe.width) - pipeRight);
                } catch (eAdv) {}
            }
            return measureTextExact(prefix, props.fontSize, props.font);
        }

        function cleanup() {
            if (measureLayer) {
                try { measureLayer.remove(); } catch (eClean) {}
                measureLayer = null;
                measureProp = null;
            }
        }

        return {
            measureRect: measureRect,
            measurePrefixAdvance: measurePrefixAdvance,
            cleanup: cleanup
        };
    }

    // -------------------------------------------------------------------------
    // 10. Split Line & Word Rigging Engine
    // -------------------------------------------------------------------------
    function applyTextDocCopy(targetLayer, origDoc, textContent, customFillColor) {
        if (!targetLayer) return;
        try {
            var prop = targetLayer.property("Source Text");
            if (!prop) {
                try { prop = targetLayer.property("ADBE Text Properties").property("ADBE Text Document"); } catch (eP) {}
            }
            if (!prop && targetLayer.sourceText) prop = targetLayer.sourceText;
            if (!prop) return;

            var d = prop.value;
            if (d && typeof TextDocument !== "undefined" && (d instanceof TextDocument || typeof d.fontSize !== "undefined")) {
                d.text = textContent;
                if (origDoc) {
                    d.fontSize = origDoc.fontSize || 34;
                    if (origDoc.font) {
                        try { d.font = origDoc.font; } catch (eF) {}
                    }
                    d.tracking = origDoc.tracking || 0;
                    d.applyFill = true;
                    d.fillColor = customFillColor || (origDoc.fillColor || [1, 1, 1]);
                    d.applyStroke = origDoc.applyStroke || false;
                    d.strokeWidth = origDoc.strokeWidth || 0;
                    if (origDoc.strokeColor) d.strokeColor = origDoc.strokeColor;
                }
                try { d.boxText = false; } catch (eBT) {}
                try {
                    if (typeof ParagraphJustification !== "undefined") {
                        d.justification = ParagraphJustification.LEFT_JUSTIFY;
                    } else {
                        d.justification = 7412;
                    }
                } catch (eJ) {}
                prop.setValue(d);
            } else {
                prop.setValue(textContent);
            }
        } catch (eStyling) {}
    }

    // -------------------------------------------------------------------------
    // 10. Zero-Shift Precomposition Engine
    // Reference: https://github.com/work2survive/AE-text-precomp
    // -------------------------------------------------------------------------
    /**
     * Executes zero-shift precomposition of text & highlight layers.
     * Captures pContentTopLeft via origLayer.toComp(), sizes newComp with margin,
     * normalizes inner layer origins, and positions precompLayer with exact affine
     * compensation so the content does not shift visually on screen by even 0.00px.
     * Mirrors all master effect controls and expression-links inner shape effects.
     */
    function precomposeWithZeroShift(comp, origLayer, props, layersToPrecompose, precompName, shapeLayer, options) {
        if (!comp || !origLayer || !layersToPrecompose || layersToPrecompose.length === 0) return null;

        // 1. Capture original layer transforms and parenting before precompose
        var origPos = origLayer.transform.position.value;
        var origAnchor = origLayer.transform.anchorPoint.value;
        var origScale = origLayer.transform.scale.value;
        var origRot = 0;
        try {
            if (origLayer.transform.rotation) origRot = origLayer.transform.rotation.value;
            else if (origLayer.transform.zRotation) origRot = origLayer.transform.zRotation.value;
        } catch (eRot) {}
        var origParent = origLayer.parent;
        var is3D = !!origLayer.threeDLayer;

        var origBounds = props.isBox
            ? { left: props.boxPos[0], top: props.boxPos[1], width: props.boxWidth, height: props.boxHeight }
            : { left: props.sRect.left, top: props.sRect.top, width: props.sRect.width, height: props.sRect.height };

        var sx = (origScale && origScale.length > 0) ? (origScale[0] / 100.0) : 1.0;
        var sy = (origScale && origScale.length > 1) ? (origScale[1] / 100.0) : 1.0;
        var rad = (origRot || 0) * Math.PI / 180.0;
        var cosA = Math.cos(rad);
        var sinA = Math.sin(rad);

        // Exact composition-space coordinate of the visual top-left corner of the content:
        var pContentTopLeft = null;
        try {
            if (typeof origLayer.toComp === "function") {
                pContentTopLeft = origLayer.toComp([origBounds.left, origBounds.top, 0]);
                if (!pContentTopLeft || pContentTopLeft.length < 2) {
                    pContentTopLeft = origLayer.toComp([origBounds.left, origBounds.top]);
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

        // 2. Precomposition dimensions: exactly matching original text box dimensions
        var precompW = Math.max(4, Math.round(origBounds.width));
        var precompH = Math.max(4, Math.round(origBounds.height));

        var precompIndices = [];
        for (var i = 0; i < layersToPrecompose.length; i++) {
            precompIndices.push(layersToPrecompose[i].index);
        }

        // 3. Execute Precompose
        var newComp = comp.layers.precompose(precompIndices, precompName, true);
        if (!newComp) {
            var nItems = (typeof app.project.numItems !== "undefined") ? app.project.numItems : app.project.items.length;
            for (var it = 1; it <= nItems; it++) {
                var candidate = (typeof app.project.item === "function") ? app.project.item(it) : app.project.items[it - 1];
                if (candidate && candidate.name === precompName && (candidate instanceof CompItem)) {
                    newComp = candidate;
                    break;
                }
            }
        }
        if (!newComp) return null;

        // Set precomp size strictly to original text box dimensions
        newComp.width = precompW;
        newComp.height = precompH;

        // 4. Inside newComp: Adjust inner layers so content visual top-left is placed at [0, 0]
        var shiftX = -origBounds.left;
        var shiftY = -origBounds.top;

        var numInner = (typeof newComp.numLayers !== "undefined") ? newComp.numLayers : newComp.layers.length;
        for (var ni = 1; ni <= numInner; ni++) {
            var inL = (typeof newComp.layer === "function") ? newComp.layer(ni) : newComp.layers[ni - 1];
            if (!inL) continue;
            try {
                if (shapeLayer && inL.name === shapeLayer.name) {
                    inL.transform.position.setValue([shiftX, shiftY, 0]);
                    inL.transform.anchorPoint.setValue([0, 0, 0]);
                    inL.transform.scale.setValue([100, 100, 100]);
                    if (inL.transform.rotation) inL.transform.rotation.setValue(0);
                } else {
                    var inP = inL.transform.position.value;
                    inL.transform.position.setValue([inP[0] + shiftX, inP[1] + shiftY, (inP.length > 2 ? inP[2] : 0)]);
                    inL.transform.scale.setValue([100, 100, 100]);
                    if (inL.transform.rotation) inL.transform.rotation.setValue(0);
                }
            } catch (eInShift) {}
        }

        // 5. In parent comp: Find and configure precompLayer with zero-shift compensation
        var precompLayer = null;
        try { precompLayer = comp.layer(precompName); } catch (ePL) {}
        if (!precompLayer) {
            try {
                var totalL = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
                for (var li = 1; li <= totalL; li++) {
                    var candL = (typeof comp.layer === "function") ? comp.layer(li) : comp.layers[li - 1];
                    if (candL && (candL.name === precompName || (candL.source && candL.source === newComp))) {
                        precompLayer = candL;
                        break;
                    }
                }
            } catch (eFindPL) {}
        }

        if (precompLayer) {
            try { precompLayer.comment = "AE_HIGHLIGHT_CHILD"; } catch (ePC) {}
            // Enable continuous rasterization/collapse transformation to prevent highlight clipping
            try { precompLayer.collapseTransformation = true; } catch (eCT) {}

            // Precomp layer anchor point is pinned strictly to Top-Left [0, 0] of the text box
            var targetA = [0, 0];
            var deltaAx = 0;
            var deltaAy = 0;
            var pDeltaX = 0;
            var pDeltaY = 0;

            var finalPosX = pContentTopLeft[0];
            var finalPosY = pContentTopLeft[1];
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
                    precompLayer.transform.anchorPoint.setValue([targetA[0], targetA[1], 0]);
                    precompLayer.transform.position.setValue([finalPosX, finalPosY, 0]);
                } catch (ePrePos2) {}
            }

            try {
                if (is3D) {
                    precompLayer.transform.scale.setValue([origScale[0], origScale[1], (origScale.length > 2 ? origScale[2] : 100)]);
                } else {
                    precompLayer.transform.scale.setValue([origScale[0], origScale[1]]);
                }
            } catch (ePreScale) {
                try { precompLayer.transform.scale.setValue(origScale); } catch (ePreScale2) {}
            }

            try {
                if (precompLayer.transform.rotation) precompLayer.transform.rotation.setValue(origRot);
                if (precompLayer.transform.zRotation) precompLayer.transform.zRotation.setValue(origRot);
            } catch (ePreRot) {}

            if (origParent) {
                try { precompLayer.parent = origParent; } catch (ePar) {}
            }

            // 6. Mirror master controls on precompLayer
            var pFx = precompLayer.property("ADBE Effect Parade") || precompLayer.property("Effects");
            if (pFx) {
                function addMirrorControl(type, name, val) {
                    var eff = pFx.property(name) || pFx.addProperty(type);
                    if (eff) {
                        eff.name = name;
                        var p = eff.property(1);
                        if (p) p.setValue(val);
                    }
                }
                addMirrorControl("ADBE Color Control", "Highlight Color", options.highlightColor);
                addMirrorControl("ADBE Color Control", "Highlighted Text Color", options.highlightedTextColor);
                addMirrorControl("ADBE Checkbox Control", "Change Highlighted Text Color", (options.changeTextColor !== false) ? 1 : 0);
                addMirrorControl("ADBE Slider Control", "Highlight Opacity", options.opacity);
                addMirrorControl("ADBE Slider Control", "Padding X", options.paddingX);
                addMirrorControl("ADBE Slider Control", "Thickness Y", options.thicknessY);
                addMirrorControl("ADBE Slider Control", "Roundness", options.roundness);
                addMirrorControl("ADBE Slider Control", "Offset X", options.offsetX);
                addMirrorControl("ADBE Slider Control", "Offset Y", options.offsetY);
            }

            // 7. Reference inner effects to parent precompLayer
            try {
                var innerShape = newComp.layer(shapeLayer.name);
                if (innerShape) {
                    var innerFx = innerShape.property("ADBE Effect Parade") || innerShape.property("Effects");
                    var effectNames = [
                        "Highlight Color", "Highlighted Text Color", "Change Highlighted Text Color",
                        "Highlight Opacity", "Padding X", "Thickness Y", "Roundness", "Offset X", "Offset Y"
                    ];
                    for (var en = 0; en < effectNames.length; en++) {
                        var eName = effectNames[en];
                        var eProp = innerFx ? innerFx.property(eName) : null;
                        if (eProp && eProp.property(1)) {
                            var pCompRef = 'comp("' + comp.name.replace(/"/g, '\\"') + '").layer("' + precompLayer.name.replace(/"/g, '\\"') + '")';
                            eProp.property(1).expression = [
                                'try {',
                                '    ' + pCompRef + '.effect("' + eName + '")(1).value;',
                                '} catch(e) {',
                                '    value;',
                                '}'
                            ].join('\n');
                        }
                    }
                }
            } catch (eInner) {}

            try { precompLayer.selected = true; } catch (eSel) {}
        }

        return { newComp: newComp, precompLayer: precompLayer };
    }

    /**
     * Rebuilds the text layer into split text boxes with top-left anchor points
     * and rigs matching procedural vector highlight boxes parented to the original.
     */
    function buildSplitHighlightsRig(comp, origLayer, options) {
        if (!comp || !origLayer || !isTextLayer(origLayer)) return null;

        var props = getTextBoxProperties(comp, origLayer);
        if (!props || !props.metrics) return null;

        // 1. First align original text layer anchor point based on text box justification
        alignAnchorPointToJustification(origLayer, props);

        // 2. Attach comprehensive typography inspector effect controls
        attachTextPropertiesEffects(origLayer, props);

        var terms = options.terms || [];
        var highlightColor = options.highlightColor || [1.0, 0.16, 0.43];
        var highlightedTextColor = options.highlightedTextColor || [1.0, 1.0, 1.0];
        var changeTextColor = (options.changeTextColor !== false);
        var padX = (typeof options.paddingX === "number") ? options.paddingX : 6;
        var thickY = (typeof options.thicknessY === "number") ? options.thicknessY : 4;
        var roundness = (typeof options.roundness === "number") ? options.roundness : 6;
        var opacity = (typeof options.opacity === "number") ? options.opacity : 100;
        var offX = (typeof options.offsetX === "number") ? options.offsetX : 0;
        var offY = (typeof options.offsetY === "number") ? options.offsetY : 0;

        var lines = props.metrics.lines;
        var lineStep = props.leading || (props.fontSize * 1.2);
        var just = props.justification || "left";

        var measurer = createMeasureHelper(comp, props);

        // Determine first line baseline relative to original text layer local origin:
        var rFirst = measurer.measureRect(lines.length > 0 ? lines[0] : "A");
        var ascender = Math.abs(rFirst.top) || (props.fontSize * 0.78);
        var firstBaselineY = (props.isBox ? props.boxPos[1] : props.sRect.top) + ascender;

        var createdLayers = [];
        var highlightBoxes = [];

        try {
            // Iterate visual lines
            for (var vl = 0; vl < lines.length; vl++) {
                var lineStr = lines[vl];
                if (trimStr(lineStr).length === 0) continue;

                var lineW = measurer.measureRect(lineStr).width;
                var lineBaselineY = firstBaselineY + (vl * lineStep);

                var lineLeftX = 0;
                if (props.isBox) {
                    if (just === "center") {
                        lineLeftX = props.boxPos[0] + (props.boxWidth - lineW) / 2;
                    } else if (just === "right") {
                        lineLeftX = props.boxPos[0] + props.boxWidth - lineW;
                    } else {
                        lineLeftX = props.boxPos[0];
                    }
                } else {
                    if (just === "center") {
                        lineLeftX = -lineW / 2;
                    } else if (just === "right") {
                        lineLeftX = -lineW;
                    } else {
                        lineLeftX = 0;
                    }
                }

                // Check which target terms appear on this visual line
                var lineMatches = [];
                var lowerLine = lineStr.toLowerCase();

                for (var t = 0; t < terms.length; t++) {
                    var term = terms[t];
                    if (!term || term.length === 0) continue;
                    var lowerTerm = term.toLowerCase();
                    var sIdx = 0;
                    while (sIdx < lineStr.length) {
                        var fIdx = lowerLine.indexOf(lowerTerm, sIdx);
                        if (fIdx === -1) break;
                        lineMatches.push({
                            start: fIdx,
                            end: fIdx + term.length,
                            term: lineStr.substr(fIdx, term.length)
                        });
                        sIdx = fIdx + Math.max(1, term.length);
                    }
                }

                // Sort matches by start position
                lineMatches.sort(function (a, b) { return a.start - b.start; });

                // Remove overlapping matches
                var cleanMatches = [];
                var lastEnd = 0;
                for (var m = 0; m < lineMatches.length; m++) {
                    var match = lineMatches[m];
                    if (match.start >= lastEnd) {
                        cleanMatches.push(match);
                        lastEnd = match.end;
                    }
                }

                // Scenario A: Line has NO highlights -> keep line as single independent text box
                if (cleanMatches.length === 0) {
                    var fullLineLayer = comp.layers.addText(lineStr);
                    applyTextDocCopy(fullLineLayer, props.textDoc, lineStr, props.fillColor);
                    fullLineLayer.name = origLayer.name + " [Line " + (vl + 1) + "]";

                    var rFL = fullLineLayer.sourceRectAtTime(comp.time, false);
                    fullLineLayer.transform.anchorPoint.setValue([rFL.left, rFL.top, 0]);
                    fullLineLayer.transform.position.setValue([lineLeftX + rFL.left, lineBaselineY + rFL.top, 0]);

                    fullLineLayer.parent = origLayer;
                    try { fullLineLayer.comment = "AE_HIGHLIGHT_CHILD"; } catch (eC) {}
                    createdLayers.push(fullLineLayer);
                    continue;
                }

                // Scenario B: Line HAS highlights -> split line into segments
                var segments = [];
                var curPos = 0;
                for (var cm = 0; cm < cleanMatches.length; cm++) {
                    var cMatch = cleanMatches[cm];
                    if (cMatch.start > curPos) {
                        segments.push({
                            text: lineStr.substring(curPos, cMatch.start),
                            isHighlight: false,
                            colStart: curPos
                        });
                    }
                    segments.push({
                        text: cMatch.term,
                        isHighlight: true,
                        colStart: cMatch.start
                    });
                    curPos = cMatch.end;
                }
                if (curPos < lineStr.length) {
                    segments.push({
                        text: lineStr.substring(curPos),
                        isHighlight: false,
                        colStart: curPos
                    });
                }

                // Create text boxes for each segment
                for (var segIdx = 0; segIdx < segments.length; segIdx++) {
                    var seg = segments[segIdx];
                    if (seg.text.length === 0) continue;

                    var prefix = lineStr.substring(0, seg.colStart);
                    var prefixAdv = measurer.measurePrefixAdvance(prefix);
                    var segX = lineLeftX + prefixAdv;

                    var segLayer = comp.layers.addText(seg.text);
                    var segColor = (seg.isHighlight && changeTextColor) ? highlightedTextColor : props.fillColor;
                    applyTextDocCopy(segLayer, props.textDoc, seg.text, segColor);

                    segLayer.name = origLayer.name + " " + (seg.isHighlight ? "[HL-Target] " : "[HL-Text] ") + seg.text.substr(0, 16);

                    var rSeg = segLayer.sourceRectAtTime(comp.time, false);
                    // Pin anchor point strictly to Top-Left
                    segLayer.transform.anchorPoint.setValue([rSeg.left, rSeg.top, 0]);
                    // Position at exact visual coordinates
                    segLayer.transform.position.setValue([segX + rSeg.left, lineBaselineY + rSeg.top, 0]);

                    segLayer.parent = origLayer;
                    try { segLayer.comment = "AE_HIGHLIGHT_CHILD"; } catch (eC2) {}
                    createdLayers.push(segLayer);

                    if (seg.isHighlight) {
                        highlightBoxes.push({
                            text: seg.text,
                            layer: segLayer,
                            width: Math.max(4, rSeg.width),
                            height: Math.max(props.fontSize, rSeg.height),
                            posX: segX + rSeg.left,
                            posY: lineBaselineY + rSeg.top
                        });
                    }
                }
            }

            // -----------------------------------------------------------------
            // 11. Create Procedural Vector Highlight Shapes Layer
            // -----------------------------------------------------------------
            var shapeLayer = comp.layers.addShape();
            shapeLayer.name = origLayer.name + " - Highlights";
            try { shapeLayer.comment = "AE_HIGHLIGHT_CHILD"; } catch (eC3) {}

            // Attach Master Expression Controls on Shape Layer
            var fxParade = shapeLayer.property("ADBE Effect Parade") || shapeLayer.property("Effects");
            function addMasterControl(type, name, val) {
                var eff = fxParade.property(name) || fxParade.addProperty(type);
                if (eff) {
                    eff.name = name;
                    var p = eff.property(1);
                    if (p) p.setValue(val);
                }
                return eff;
            }

            addMasterControl("ADBE Color Control", "Highlight Color", highlightColor);
            addMasterControl("ADBE Color Control", "Highlighted Text Color", highlightedTextColor);
            addMasterControl("ADBE Checkbox Control", "Change Highlighted Text Color", changeTextColor ? 1 : 0);
            addMasterControl("ADBE Slider Control", "Highlight Opacity", opacity);
            addMasterControl("ADBE Slider Control", "Padding X", padX);
            addMasterControl("ADBE Slider Control", "Thickness Y", thickY);
            addMasterControl("ADBE Slider Control", "Roundness", roundness);
            addMasterControl("ADBE Slider Control", "Offset X", offX);
            addMasterControl("ADBE Slider Control", "Offset Y", offY);

            var rootVectors = shapeLayer.property("ADBE Root Vectors Group") || shapeLayer.property("Contents");

            for (var hb = 0; hb < highlightBoxes.length; hb++) {
                var box = highlightBoxes[hb];
                var grp = rootVectors.addProperty("ADBE Vector Group");
                grp.name = "Highlight " + (hb + 1) + " - " + box.text.substr(0, 16);
                var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents");

                var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
                rect.name = "Box Path";

                var propSize = rect.property("ADBE Vector Rect Size") || rect.property("Size");
                var baseW = box.width;
                var baseH = box.height;
                var initW = baseW + (padX * 2);
                var initH = baseH + thickY;

                if (propSize) {
                    propSize.setValue([initW, initH]);
                    propSize.expression = [
                        'var padX = 0, thickY = 0;',
                        'try { padX = thisLayer.effect("Padding X")(1).value; } catch(e) {}',
                        'try { thickY = thisLayer.effect("Thickness Y")(1).value; } catch(e) {}',
                        '[Math.max(0, ' + baseW.toFixed(2) + ' + padX * 2), Math.max(0, ' + baseH.toFixed(2) + ' + thickY)];'
                    ].join('\n');
                }

                var propPos = rect.property("ADBE Vector Rect Position") || rect.property("Position");
                var boxCenterX = box.posX + (baseW / 2);
                var boxCenterY = box.posY + (baseH / 2);

                if (propPos) {
                    propPos.setValue([boxCenterX + offX, boxCenterY + offY]);
                    propPos.expression = [
                        'var offX = 0, offY = 0;',
                        'try { offX = thisLayer.effect("Offset X")(1).value; } catch(e) {}',
                        'try { offY = thisLayer.effect("Offset Y")(1).value; } catch(e) {}',
                        '[' + boxCenterX.toFixed(2) + ' + offX, ' + boxCenterY.toFixed(2) + ' + offY];'
                    ].join('\n');
                }

                var propRound = rect.property("ADBE Vector Rect Roundness") || rect.property("Roundness");
                if (propRound) {
                    propRound.setValue(roundness);
                    propRound.expression = 'try { Math.max(0, thisLayer.effect("Roundness")(1).value); } catch(e) { value; }';
                }

                var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Highlight Fill";
                var propCol = fill.property("ADBE Vector Fill Color") || fill.property("Color");
                if (propCol) {
                    propCol.setValue(highlightColor);
                    propCol.expression = 'try { thisLayer.effect("Highlight Color")(1).value; } catch(e) { value; }';
                }
                var propOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity");
                if (propOp) {
                    propOp.setValue(opacity);
                    propOp.expression = 'try { thisLayer.effect("Highlight Opacity")(1); } catch(e) { value; }';
                }

                // Link highlighted text box color to master control via expression
                try {
                    var txtProp = box.layer.property("Source Text");
                    if (txtProp) {
                        var shapeRef = 'thisComp.layer("' + shapeLayer.name.replace(/"/g, '\\"') + '")';
                        var origColorStr = '[' + props.fillColor.join(', ') + ']';
                        txtProp.expression = [
                            'var doc = value;',
                            'try {',
                            '    var en = ' + shapeRef + '.effect("Change Highlighted Text Color")(1).value;',
                            '    if (en > 0) {',
                            '        doc.fillColor = ' + shapeRef + '.effect("Highlighted Text Color")(1).value;',
                            '    } else {',
                            '        doc.fillColor = ' + origColorStr + ';',
                            '    }',
                            '} catch(e) {}',
                            'doc;'
                        ].join('\n');
                    }
                } catch (eDocExp) {}
            }

            // Parent highlight shape layer to original text layer
            shapeLayer.parent = origLayer;
            shapeLayer.transform.position.setValue([0, 0, 0]);
            shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
            shapeLayer.transform.scale.setValue([100, 100, 100]);
            if (shapeLayer.transform.rotation) shapeLayer.transform.rotation.setValue(0);

            // Stacking: place shape layer behind split text layers
            try {
                if (typeof shapeLayer.moveAfter === "function") {
                    shapeLayer.moveAfter(origLayer);
                }
            } catch (eMove) {}

            createdLayers.push(shapeLayer);

            // -----------------------------------------------------------------
            // 12. Mark Original Text Layer as Hidden Guideline
            // -----------------------------------------------------------------
            markOriginalAsGuideline(origLayer);

            // -----------------------------------------------------------------
            // 13. Precomposition Option (Zero-Shift, based on AE-text-precomp)
            // -----------------------------------------------------------------
            if (options.makePrecomp) {
                var precompName = origLayer.name + " Highlight Precomp";
                precomposeWithZeroShift(comp, origLayer, props, createdLayers, precompName, shapeLayer, {
                    highlightColor: highlightColor,
                    highlightedTextColor: highlightedTextColor,
                    changeTextColor: changeTextColor,
                    opacity: opacity,
                    paddingX: padX,
                    thicknessY: thickY,
                    roundness: roundness,
                    offsetX: offX,
                    offsetY: offY
                });
            }

            return {
                createdCount: createdLayers.length,
                highlightCount: highlightBoxes.length,
                guidelineLayer: origLayer
            };

        } finally {
            measurer.cleanup();
        }
    }

    // -------------------------------------------------------------------------
    // 12. In-Place Font Metric Calculation Engine (Calculation Method)
    // Reference: https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
    // -------------------------------------------------------------------------
    /**
     * Builds highlights WITHOUT splitting the text box.
     * Calculates the exact position and dimensions of highlight boxes in-place using
     * all available typography parameters (fontSize, leading, tracking, boxTextPos,
     * sourceRectAtTime, and delimiter-anchored advance).
     *
     * References:
     * - Engine guide: https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
     * - Anchor alignment: https://github.com/work2survive/AE-Align-AnchorPoint
     * - Typography effects: https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx
     */
    function buildCalculationHighlightsRig(comp, origLayer, options) {
        if (!comp || !origLayer || !isTextLayer(origLayer)) return null;

        var props = getTextBoxProperties(comp, origLayer);
        if (!props || !props.metrics) return null;

        // 1. Align original text layer anchor point based on text box justification (zero visual shift)
        alignAnchorPointToJustification(origLayer, props);

        // 2. Attach comprehensive typography inspector effect controls
        attachTextPropertiesEffects(origLayer, props);

        var terms = options.terms || [];
        var highlightColor = options.highlightColor || [1.0, 0.16, 0.43];
        var highlightedTextColor = options.highlightedTextColor || [1.0, 1.0, 1.0];
        var changeTextColor = (options.changeTextColor !== false);
        var padX = (typeof options.paddingX === "number") ? options.paddingX : 6;
        var thickY = (typeof options.thicknessY === "number") ? options.thicknessY : 4;
        var roundness = (typeof options.roundness === "number") ? options.roundness : 6;
        var opacity = (typeof options.opacity === "number") ? options.opacity : 100;
        var offX = (typeof options.offsetX === "number") ? options.offsetX : 0;
        var offY = (typeof options.offsetY === "number") ? options.offsetY : 0;

        var lines = props.metrics.lines;
        var lineStep = props.leading || (props.fontSize * 1.2);
        var just = props.justification || "left";

        var measurer = createMeasureHelper(comp, props);

        // Determine first line baseline relative to original text layer local origin:
        var rFirst = measurer.measureRect(lines.length > 0 ? lines[0] : "A");
        var ascender = Math.abs(rFirst.top) || (props.fontSize * 0.78);
        var firstBaselineY = (props.isBox ? props.boxPos[1] : props.sRect.top) + ascender;

        var highlightBoxes = [];

        try {
            // Iterate visual lines and calculate highlight coordinates
            for (var vl = 0; vl < lines.length; vl++) {
                var lineStr = lines[vl];
                if (trimStr(lineStr).length === 0) continue;

                var lineW = measurer.measureRect(lineStr).width;
                var lineBaselineY = firstBaselineY + (vl * lineStep);

                var lineLeftX = 0;
                if (props.isBox) {
                    if (just === "center") {
                        lineLeftX = props.boxPos[0] + (props.boxWidth - lineW) / 2;
                    } else if (just === "right") {
                        lineLeftX = props.boxPos[0] + props.boxWidth - lineW;
                    } else {
                        lineLeftX = props.boxPos[0];
                    }
                } else {
                    if (just === "center") {
                        lineLeftX = -lineW / 2;
                    } else if (just === "right") {
                        lineLeftX = -lineW;
                    } else {
                        lineLeftX = 0;
                    }
                }

                // Check which target terms appear on this visual line
                var lineMatches = [];
                var lowerLine = lineStr.toLowerCase();

                for (var t = 0; t < terms.length; t++) {
                    var term = terms[t];
                    if (!term || term.length === 0) continue;
                    var lowerTerm = term.toLowerCase();
                    var sIdx = 0;
                    while (sIdx < lineStr.length) {
                        var fIdx = lowerLine.indexOf(lowerTerm, sIdx);
                        if (fIdx === -1) break;
                        lineMatches.push({
                            start: fIdx,
                            end: fIdx + term.length,
                            term: lineStr.substr(fIdx, term.length)
                        });
                        sIdx = fIdx + Math.max(1, term.length);
                    }
                }

                lineMatches.sort(function (a, b) { return a.start - b.start; });

                var cleanMatches = [];
                var lastEnd = 0;
                for (var m = 0; m < lineMatches.length; m++) {
                    var match = lineMatches[m];
                    if (match.start >= lastEnd) {
                        cleanMatches.push(match);
                        lastEnd = match.end;
                    }
                }

                for (var cm = 0; cm < cleanMatches.length; cm++) {
                    var cMatch = cleanMatches[cm];
                    var prefix = lineStr.substring(0, cMatch.start);
                    var prefixAdv = measurer.measurePrefixAdvance(prefix);
                    var segX = lineLeftX + prefixAdv;
                    var rSeg = measurer.measureRect(cMatch.term);

                    var boxW = Math.max(4, rSeg.width);
                    var boxH = Math.max(props.fontSize, rSeg.height);
                    var boxPosX = segX + rSeg.left;
                    var boxPosY = lineBaselineY + rSeg.top;

                    highlightBoxes.push({
                        text: cMatch.term,
                        width: boxW,
                        height: boxH,
                        posX: boxPosX,
                        posY: boxPosY
                    });
                }
            }

            // Create Procedural Vector Highlight Shapes Layer
            var shapeLayer = comp.layers.addShape();
            shapeLayer.name = origLayer.name + " - Highlights";
            try { shapeLayer.comment = "AE_HIGHLIGHT_CHILD"; } catch (eC3) {}

            // Attach Master Expression Controls on Shape Layer
            var fxParade = shapeLayer.property("ADBE Effect Parade") || shapeLayer.property("Effects");
            function addMasterControl(type, name, val) {
                var eff = fxParade.property(name) || fxParade.addProperty(type);
                if (eff) {
                    eff.name = name;
                    var p = eff.property(1);
                    if (p) p.setValue(val);
                }
                return eff;
            }

            addMasterControl("ADBE Color Control", "Highlight Color", highlightColor);
            addMasterControl("ADBE Color Control", "Highlighted Text Color", highlightedTextColor);
            addMasterControl("ADBE Checkbox Control", "Change Highlighted Text Color", changeTextColor ? 1 : 0);
            addMasterControl("ADBE Slider Control", "Highlight Opacity", opacity);
            addMasterControl("ADBE Slider Control", "Padding X", padX);
            addMasterControl("ADBE Slider Control", "Thickness Y", thickY);
            addMasterControl("ADBE Slider Control", "Roundness", roundness);
            addMasterControl("ADBE Slider Control", "Offset X", offX);
            addMasterControl("ADBE Slider Control", "Offset Y", offY);

            var rootVectors = shapeLayer.property("ADBE Root Vectors Group") || shapeLayer.property("Contents");

            for (var hb = 0; hb < highlightBoxes.length; hb++) {
                var box = highlightBoxes[hb];
                var grp = rootVectors.addProperty("ADBE Vector Group");
                grp.name = "Highlight " + (hb + 1) + " - " + box.text.substr(0, 16);
                var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents");

                var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
                rect.name = "Box Path";

                var propSize = rect.property("ADBE Vector Rect Size") || rect.property("Size");
                var baseW = box.width;
                var baseH = box.height;
                var initW = baseW + (padX * 2);
                var initH = baseH + thickY;

                if (propSize) {
                    propSize.setValue([initW, initH]);
                    propSize.expression = [
                        'var padX = 0, thickY = 0;',
                        'try { padX = thisLayer.effect("Padding X")(1).value; } catch(e) {}',
                        'try { thickY = thisLayer.effect("Thickness Y")(1).value; } catch(e) {}',
                        '[Math.max(0, ' + baseW.toFixed(2) + ' + padX * 2), Math.max(0, ' + baseH.toFixed(2) + ' + thickY)];'
                    ].join('\n');
                }

                var propPos = rect.property("ADBE Vector Rect Position") || rect.property("Position");
                var boxCenterX = box.posX + (baseW / 2);
                var boxCenterY = box.posY + (baseH / 2);

                if (propPos) {
                    propPos.setValue([boxCenterX + offX, boxCenterY + offY]);
                    propPos.expression = [
                        'var offX = 0, offY = 0;',
                        'try { offX = thisLayer.effect("Offset X")(1).value; } catch(e) {}',
                        'try { offY = thisLayer.effect("Offset Y")(1).value; } catch(e) {}',
                        '[' + boxCenterX.toFixed(2) + ' + offX, ' + boxCenterY.toFixed(2) + ' + offY];'
                    ].join('\n');
                }

                var propRound = rect.property("ADBE Vector Rect Roundness") || rect.property("Roundness");
                if (propRound) {
                    propRound.setValue(roundness);
                    propRound.expression = 'try { Math.max(0, thisLayer.effect("Roundness")(1).value); } catch(e) { value; }';
                }

                var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Highlight Fill";
                var propCol = fill.property("ADBE Vector Fill Color") || fill.property("Color");
                if (propCol) {
                    propCol.setValue(highlightColor);
                    propCol.expression = 'try { thisLayer.effect("Highlight Color")(1).value; } catch(e) { value; }';
                }
                var propOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity");
                if (propOp) {
                    propOp.setValue(opacity);
                    propOp.expression = 'try { thisLayer.effect("Highlight Opacity")(1); } catch(e) { value; }';
                }
            }

            // Parent highlight shape layer to original text layer
            shapeLayer.parent = origLayer;
            shapeLayer.transform.position.setValue([0, 0, 0]);
            shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
            shapeLayer.transform.scale.setValue([100, 100, 100]);
            if (shapeLayer.transform.rotation) shapeLayer.transform.rotation.setValue(0);

            // Stacking: place shape layer directly behind original text layer
            try {
                if (typeof shapeLayer.moveAfter === "function") {
                    shapeLayer.moveAfter(origLayer);
                }
            } catch (eMove) {}

            // Color highlight on intact text layer via Text Animator (targeting strictly matched character ranges)
            try {
                var textPropGroup = origLayer.property("ADBE Text Properties");
                var animators = textPropGroup ? textPropGroup.property("ADBE Text Animators") : null;
                if (animators) {
                    var existingAnim = animators.property("Highlight Text Color");
                    if (existingAnim) {
                        try { existingAnim.remove(); } catch (eER) {}
                    }
                    if (changeTextColor && terms.length > 0) {
                        var fullText = getTextLayerString(origLayer);
                        var lowerFull = fullText.toLowerCase();
                        var targetRanges = [];

                        for (var tIdx = 0; tIdx < terms.length; tIdx++) {
                            var tTerm = terms[tIdx];
                            if (!tTerm || tTerm.length === 0) continue;
                            var lowerTerm = tTerm.toLowerCase();
                            var searchStart = 0;
                            while (searchStart < fullText.length) {
                                var matchIdx = lowerFull.indexOf(lowerTerm, searchStart);
                                if (matchIdx === -1) break;
                                targetRanges.push({
                                    start: matchIdx,
                                    end: matchIdx + tTerm.length
                                });
                                searchStart = matchIdx + Math.max(1, tTerm.length);
                            }
                        }

                        if (targetRanges.length > 0) {
                            // Merge overlapping or adjacent ranges
                            targetRanges.sort(function (a, b) { return a.start - b.start; });
                            var mergedRanges = [];
                            var currR = { start: targetRanges[0].start, end: targetRanges[0].end };
                            for (var rIdx = 1; rIdx < targetRanges.length; rIdx++) {
                                var nxtR = targetRanges[rIdx];
                                if (nxtR.start <= currR.end) {
                                    currR.end = Math.max(currR.end, nxtR.end);
                                } else {
                                    mergedRanges.push(currR);
                                    currR = { start: nxtR.start, end: nxtR.end };
                                }
                            }
                            mergedRanges.push(currR);

                            var anim = animators.addProperty("ADBE Text Animator");
                            if (anim) {
                                anim.name = "Highlight Text Color";
                                var animProps = anim.property("ADBE Text Animator Properties");
                                var fillProp = animProps ? animProps.addProperty("ADBE Text Fill Color") : null;
                                if (fillProp) {
                                    fillProp.setValue(highlightedTextColor);
                                    var shapeRef = 'thisComp.layer("' + shapeLayer.name.replace(/"/g, '\\"') + '")';
                                    var origColorStr = '[' + props.fillColor.join(', ') + ']';
                                    fillProp.expression = [
                                        'var en = 1;',
                                        'try { en = ' + shapeRef + '.effect("Change Highlighted Text Color")(1).value; } catch(e) {}',
                                        'if (en > 0) {',
                                        '    try { ' + shapeRef + '.effect("Highlighted Text Color")(1).value; } catch(e2) { value; }',
                                        '} else {',
                                        '    ' + origColorStr + ';',
                                        '}'
                                    ].join('\n');
                                }

                                var selectors = anim.property("ADBE Text Selectors") || anim.property("Selectors");
                                if (selectors) {
                                    var totalChars = Math.max(1, fullText.length);
                                    for (var rg = 0; rg < mergedRanges.length; rg++) {
                                        var mRange = mergedRanges[rg];
                                        var sel = (rg === 0 && selectors.numProperties > 0)
                                            ? selectors.property(1)
                                            : selectors.addProperty("ADBE Text Selector");
                                        if (sel) {
                                            sel.name = "Range " + (rg + 1) + " (" + mRange.start + "-" + mRange.end + ")";
                                            var adv = sel.property("ADBE Text Range Advanced");
                                            var usedIndex = false;
                                            if (adv) {
                                                var uProp = adv.property("ADBE Text Range Units2");
                                                if (uProp) {
                                                    try {
                                                        uProp.setValue(2); // 2 = Index
                                                        usedIndex = true;
                                                    } catch (eU) {}
                                                }
                                            }

                                            var pStart = sel.property("ADBE Text Index Start") || sel.property("ADBE Text Percent Start") || sel.property("Start");
                                            var pEnd = sel.property("ADBE Text Index End") || sel.property("ADBE Text Percent End") || sel.property("End");

                                            if (usedIndex) {
                                                if (pStart) pStart.setValue(mRange.start);
                                                if (pEnd) pEnd.setValue(mRange.end);
                                            } else {
                                                if (pStart) pStart.setValue((mRange.start / totalChars) * 100);
                                                if (pEnd) pEnd.setValue((mRange.end / totalChars) * 100);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (eAnim) {}

            // Precomposition Option for Calculation Method (Zero-Shift, based on AE-text-precomp)
            if (options.makePrecomp) {
                var textCopy = origLayer.duplicate ? origLayer.duplicate() : null;
                var precompLayers = [shapeLayer];
                if (textCopy) {
                    textCopy.enabled = true;
                    textCopy.guideLayer = false;
                    precompLayers.push(textCopy);
                    markOriginalAsGuideline(origLayer);
                }
                var precompName = origLayer.name + " Highlight Precomp";
                precomposeWithZeroShift(comp, origLayer, props, precompLayers, precompName, shapeLayer, {
                    highlightColor: highlightColor,
                    highlightedTextColor: highlightedTextColor,
                    changeTextColor: changeTextColor,
                    opacity: opacity,
                    paddingX: padX,
                    thicknessY: thickY,
                    roundness: roundness,
                    offsetX: offX,
                    offsetY: offY
                });
            }

            return {
                createdCount: 1,
                highlightCount: highlightBoxes.length,
                guidelineLayer: null,
                shapeLayer: shapeLayer
            };

        } finally {
            measurer.cleanup();
        }
    }

    // -------------------------------------------------------------------------
    // 13. Dummy Text Layer Generator
    // -------------------------------------------------------------------------
    var DUMMY_TEXT_COLORS = [
        [0.96, 0.96, 0.96], // Crisp White
        [1.00, 0.88, 0.40], // Warm Goldenrod / Amber
        [0.40, 0.88, 1.00], // Electric Sky Blue
        [1.00, 0.58, 0.70], // Soft Coral Rose
        [0.50, 0.95, 0.70], // Mint Green
        [0.85, 0.70, 1.00], // Lavender Purple
        [1.00, 0.72, 0.45], // Peach Coral
        [0.90, 0.96, 0.50], // Lime Yellow
        [0.65, 0.92, 0.98], // Ice Blue
        [1.00, 0.48, 0.52], // Watermelon Pink
        [0.95, 0.85, 0.75]  // Warm Sand / Cream
    ];

    function getRandomTextColor() {
        if (Math.random() < 0.75) {
            return DUMMY_TEXT_COLORS[Math.floor(Math.random() * DUMMY_TEXT_COLORS.length)];
        }
        // Random bright visible color: R, G, B in range [0.45, 1.00]
        return [
            Math.round((0.45 + Math.random() * 0.55) * 100) / 100,
            Math.round((0.45 + Math.random() * 0.55) * 100) / 100,
            Math.round((0.45 + Math.random() * 0.55) * 100) / 100
        ];
    }

    function formatPointTextWithLineBreaks(text, maxChars) {
        var limit = maxChars || 42;
        var words = text.replace(/[\r\n]+/g, " ").split(/\s+/);
        var lines = [];
        var cur = "";
        for (var i = 0; i < words.length; i++) {
            var w = words[i];
            if (!w || w.length === 0) continue;
            if (cur.length === 0) {
                cur = w;
            } else if ((cur.length + 1 + w.length) <= limit) {
                cur += " " + w;
            } else {
                lines.push(cur);
                cur = w;
            }
        }
        if (cur.length > 0) lines.push(cur);
        return lines.join("\r");
    }

    // Word pool for random 20-30 words dummy text
    var LOREM_IPSUM_WORDS = [
        "Lorem", "ipsum", "dolor", "sit", "amet,", "consectetur", "adipiscing", "elit,", "sed", "do",
        "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua.", "Ut",
        "enim", "ad", "minim", "veniam,", "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi",
        "ut", "aliquip", "ex", "ea", "commodo", "consequat.", "Duis", "aute", "irure", "dolor",
        "in", "reprehenderit", "in", "voluptate", "velit", "esse", "cillum", "dolore", "eu", "fugiat",
        "nulla", "pariatur.", "Excepteur", "sint", "occaecat", "cupidatat", "non", "proident,", "sunt", "in",
        "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id", "est", "laborum."
    ];

    function getRandomDummyText(minWords, maxWords) {
        var min = (typeof minWords === "number") ? minWords : 20;
        var max = (typeof maxWords === "number") ? maxWords : 30;
        var count = Math.floor(min + Math.random() * (max - min + 1));
        var start = Math.floor(Math.random() * Math.max(1, LOREM_IPSUM_WORDS.length - count));
        var words = [];
        for (var i = 0; i < count; i++) {
            words.push(LOREM_IPSUM_WORDS[(start + i) % LOREM_IPSUM_WORDS.length]);
        }
        var text = words.join(" ");
        var lastChar = text.charAt(text.length - 1);
        if (lastChar === ",") {
            text = text.substring(0, text.length - 1) + ".";
        } else if (lastChar !== "." && lastChar !== "!" && lastChar !== "?") {
            text += ".";
        }
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function createDummyTextBoxLayer(comp, fontName, align, boxW, boxH) {
        if (!comp) {
            comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("AE Text Highlight Demo", 1920, 1080, 1.0, 10.0, 30.0);
                if (comp.openInViewer) comp.openInViewer();
            }
        }

        var compW = (comp && typeof comp.width === "number") ? comp.width : 1920;
        var compH = (comp && typeof comp.height === "number") ? comp.height : 1080;

        // 1. Make the random dummy text wider: spans 76% to 88% of the composition viewport
        var widthRatio = 0.76 + (Math.random() * 0.12); // [0.76, 0.88]
        var w = boxW ? Math.max(boxW, Math.round(compW * widthRatio)) : Math.round(compW * widthRatio);
        w = Math.min(compW - 120, Math.max(900, w));
        var h = boxH || Math.max(380, Math.round(compH * 0.45));

        // 2. Randomize whether created as Point Text or Paragraph (Box) Text (50/50 probability)
        var isBox = (Math.random() < 0.5);

        // 3. Randomize Font (or resolve specified font)
        var f = fontName;
        if (!f || typeof f !== "string" || f === "random" || f.indexOf("random") !== -1 || f.indexOf("Shuffle") !== -1 || f === "") {
            f = TYPICAL_FONTS[Math.floor(Math.random() * TYPICAL_FONTS.length)];
        }

        // 4. Randomize Alignment
        var alignOptions = ["left", "center", "right"];
        var a = (align && typeof align === "string") ? align.toLowerCase() : "random";
        if (a === "random" || a.indexOf("random") !== -1 || a.indexOf("shuffle") !== -1 || a === "") {
            a = alignOptions[Math.floor(Math.random() * alignOptions.length)];
        }

        // 5. Randomize Size (±15% from base 34pt: range [29pt, 39pt])
        var baseFontSize = 34;
        var sizeVariation = 1.0 + (Math.random() * 0.30 - 0.15); // [0.85, 1.15] (±15%)
        var fontSize = Math.max(18, Math.round(baseFontSize * sizeVariation));

        // 6. Randomize Leading (±15% from default fontSize * 1.25)
        var baseLeading = fontSize * 1.25;
        var leadingVariation = 1.0 + (Math.random() * 0.30 - 0.15); // [0.85, 1.15] (±15%)
        var leading = Math.round(baseLeading * leadingVariation * 10) / 10;

        // 7. Randomize Text Color
        var textColor = getRandomTextColor();

        // 8. Random dummy text (20 to 30 words)
        var rawDummy = getRandomDummyText(20, 30);

        // 9. If Point Text: add line breaks formatted so it doesn't stick out of the viewport
        var approxCharW = fontSize * 0.54;
        var maxCharsPerLine = Math.max(35, Math.min(55, Math.floor((w * 0.85) / approxCharW)));

        var formattedText = isBox
            ? wordWrapToBoxWidth(rawDummy, w, fontSize, f, 0)
            : formatPointTextWithLineBreaks(rawDummy, maxCharsPerLine);

        var dummy = comp.layers.addText(formattedText);
        var typeLabel = isBox ? "Box Text" : "Point Text";
        dummy.name = "Dummy Text - " + f + " " + fontSize + "pt (" + typeLabel + ", " + a + ")";

        // Setup typography document
        try {
            var prop = dummy.property("Source Text");
            if (!prop) {
                try { prop = dummy.property("ADBE Text Properties").property("ADBE Text Document"); } catch (eP) {}
            }
            if (prop) {
                var doc = prop.value;
                if (doc) {
                    doc.text = formattedText;
                    doc.fontSize = fontSize;
                    doc.font = f;
                    doc.leading = leading;
                    doc.autoLeading = false;
                    doc.fillColor = textColor;
                    doc.applyFill = true;
                    doc.applyStroke = false;
                    if (typeof ParagraphJustification !== "undefined") {
                        doc.justification = (a === "center")
                            ? ParagraphJustification.CENTER_JUSTIFY
                            : ((a === "right") ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
                    } else {
                        doc.justification = (a === "center") ? 7414 : ((a === "right") ? 7413 : 7412);
                    }

                    if (isBox) {
                        try {
                            if (typeof doc.setBoxTextSize === "function") {
                                doc.setBoxTextSize([w, h]);
                            } else if (typeof doc.boxText !== "undefined") {
                                doc.boxText = true;
                                doc.boxTextSize = [w, h];
                            }
                        } catch (eBox) {}
                    } else {
                        try {
                            if (typeof doc.boxText !== "undefined") {
                                doc.boxText = false;
                            }
                        } catch (ePt) {}
                    }

                    prop.setValue(doc);
                }
            }
        } catch (eStyling) {}

        // Place text in the middle of the viewport
        var centerPos = [comp.width / 2, comp.height / 2, 0];
        try {
            var propST = dummy.property("Source Text");
            var isActuallyBox = false;
            if (propST && propST.value && propST.value.boxText) isActuallyBox = true;

            if (isActuallyBox) {
                dummy.transform.anchorPoint.setValue([w / 2, h / 2, 0]);
                dummy.transform.position.setValue(centerPos);
            } else {
                var rSR = dummy.sourceRectAtTime(0, false);
                if (rSR && rSR.width > 0 && rSR.height > 0) {
                    dummy.transform.anchorPoint.setValue([rSR.left + rSR.width / 2, rSR.top + rSR.height / 2, 0]);
                    dummy.transform.position.setValue(centerPos);
                } else {
                    dummy.transform.anchorPoint.setValue([w / 2, h / 2, 0]);
                    dummy.transform.position.setValue(centerPos);
                }
            }
        } catch (ePos) {
            dummy.transform.position.setValue(centerPos);
        }

        // Deselect others and select dummy
        var total = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
        for (var i = 1; i <= total; i++) {
            var l = (typeof comp.layer === "function") ? comp.layer(i) : (comp.layers[i] || comp.layers[i - 1]);
            if (l) l.selected = false;
        }
        dummy.selected = true;

        return dummy;
    }

    // -------------------------------------------------------------------------
    // 15. Interactive Color Picker Component
    // Reference: custom_rounded_rect.jsx & windows-color-picker.js
    // -------------------------------------------------------------------------
    function createColorPickerGroup(parent, labelText, defaultHex, onChangeCallback, withCheckbox, defaultChecked) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.alignChildren = ["left", "center"];
        grp.alignment = ["fill", "top"];
        grp.spacing = 8;

        var chkBox = null;
        var lbl = null;
        if (withCheckbox) {
            chkBox = grp.add("checkbox", undefined, labelText);
            chkBox.preferredSize = [165, 22];
            chkBox.value = (defaultChecked !== false);
        } else {
            lbl = grp.add("statictext", undefined, labelText);
            lbl.preferredSize = [165, 22];
        }

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [40, 22];
        btnSwatch.helpTip = "Click to pick color";

        var txtHex = grp.add("edittext", undefined, defaultHex);
        txtHex.preferredSize = [75, 22];
        txtHex.characters = 7;

        var curHex = defaultHex || "#FF2A6D";
        var curRgb = hexToRgb(curHex);

        function updateEnabledState() {
            var isEn = chkBox ? chkBox.value : true;
            btnSwatch.enabled = isEn;
            txtHex.enabled = isEn;
            refresh();
        }

        if (chkBox) {
            chkBox.onClick = function () {
                updateEnabledState();
                if (typeof onChangeCallback === "function") {
                    onChangeCallback(curRgb, curHex, chkBox.value);
                }
            };
        }

        btnSwatch.onDraw = function () {
            try {
                var g = this.graphics;
                var isEn = chkBox ? chkBox.value : true;
                var rgb = hexToRgb(curHex);
                var alpha = isEn ? 1.0 : 0.4;
                var brush = g.newBrush(g.BrushType.SOLID_COLOR, [rgb[0], rgb[1], rgb[2], alpha]);
                var pen = g.newPen(g.PenType.SOLID_COLOR, isEn ? [0.3, 0.3, 0.3, 1.0] : [0.5, 0.5, 0.5, 0.5], 1);
                g.newPath();
                g.rectPath(0, 0, this.size ? this.size[0] : 40, this.size ? this.size[1] : 22);
                g.fillPath(brush);
                g.strokePath(pen);
            } catch (eDraw) {}
        };

        function refresh() {
            try {
                if (typeof btnSwatch.notify === "function") btnSwatch.notify("onDraw");
            } catch (eN) {}

            try {
                if (btnSwatch.domElement) {
                    var isEn = chkBox ? chkBox.value : true;
                    btnSwatch.domElement.style.backgroundColor = curHex;
                    btnSwatch.domElement.style.border = isEn ? "1px solid #555" : "1px dashed #444";
                    btnSwatch.domElement.style.opacity = isEn ? "1.0" : "0.45";
                    btnSwatch.domElement.style.cursor = isEn ? "pointer" : "not-allowed";
                }
            } catch (eDOM) {}
        }

        function setHex(newHex, triggerChange) {
            if (!newHex) return;
            var clean = String(newHex).replace(/^\s+|\s+$/g, "");
            if (clean.indexOf("#") !== 0) clean = "#" + clean;
            curHex = clean.toUpperCase();
            curRgb = hexToRgb(curHex);
            txtHex.text = curHex;

            refresh();

            if (triggerChange !== false && typeof onChangeCallback === "function") {
                onChangeCallback(curRgb, curHex, chkBox ? chkBox.value : true);
            }
        }

        btnSwatch.onClick = function () {
            if (chkBox && !chkBox.value) return;

            // 1. Direct browser emulator Windows Color Picker support
            var fnPicker = null;
            if (typeof window !== "undefined" && typeof window.openWindowsColorPicker === "function") {
                fnPicker = window.openWindowsColorPicker;
            } else if (typeof global !== "undefined" && typeof global.openWindowsColorPicker === "function") {
                fnPicker = global.openWindowsColorPicker;
            } else if (typeof $.global !== "undefined" && typeof $.global.openWindowsColorPicker === "function") {
                fnPicker = $.global.openWindowsColorPicker;
            } else if (typeof openWindowsColorPicker === "function") {
                fnPicker = openWindowsColorPicker;
            }

            if (fnPicker) {
                fnPicker(curHex, function (selectedHex) {
                    setHex(selectedHex, true);
                });
                return;
            }

            // 2. ExtendScript native $.colorPicker API with callback support
            var hexNum = parseInt(curHex.replace("#", ""), 16);
            var result = -1;
            if (typeof $.colorPicker === "function") {
                try {
                    result = $.colorPicker(hexNum, function (selectedHex) {
                        setHex(selectedHex, true);
                    });
                } catch (eCP) {
                    try { result = $.colorPicker(hexNum); } catch (eCP2) {}
                }
            }

            // Handle synchronous return in native After Effects
            if (result !== -1 && result !== undefined && result !== null) {
                var hexStr = Number(result).toString(16);
                while (hexStr.length < 6) hexStr = "0" + hexStr;
                setHex("#" + hexStr, true);
                return;
            }

            // 3. Browser HTML5 input[type=color] fallback
            if (typeof document !== "undefined" && typeof document.createElement === "function") {
                try {
                    var inp = document.createElement("input");
                    inp.type = "color";
                    inp.value = curHex;
                    inp.onchange = function () {
                        setHex(this.value, true);
                    };
                    inp.click();
                    return;
                } catch (eDOM) {}
            }
        };

        txtHex.onChange = function () {
            if (chkBox && !chkBox.value) return;
            var val = this.text.replace(/^\s+|\s+$/g, "");
            if (val.indexOf("#") !== 0) val = "#" + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                setHex(val, true);
            }
        };

        // Initialize swatch appearance and enabled state without triggering onChange
        setHex(defaultHex, false);
        updateEnabledState();

        return {
            group: grp,
            button: btnSwatch,
            edittext: txtHex,
            checkbox: chkBox,
            refresh: refresh,
            isChecked: function () { return chkBox ? !!chkBox.value : true; },
            setChecked: function (val) {
                if (chkBox) {
                    chkBox.value = !!val;
                    updateEnabledState();
                }
            },
            getRgb: function () { return curRgb; },
            getHex: function () { return curHex; },
            setHex: function (h) { setHex(h, true); }
        };
    }

    // -------------------------------------------------------------------------
    // 16. ScriptUI Dialog / Dockable Panel Builder
    // -------------------------------------------------------------------------
    function buildUI(thisObj) {
        var isDockable = (thisObj instanceof Panel);
        var win = isDockable
            ? thisObj
            : new Window("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;
        win.minimumSize = [320, 520];

        // Ensure responsive dockable panel layout
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        // ---------------------------------------------------------------------
        // Header Banner
        // ---------------------------------------------------------------------
        var pnlHeader = win.add("panel");
        pnlHeader.orientation = "row";
        pnlHeader.alignChildren = ["fill", "center"];
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.spacing = 8;
        pnlHeader.margins = [8, 6, 8, 6];

        var lblTitle = pnlHeader.add("statictext", undefined, "✨ " + SCRIPT_TITLE + " " + SCRIPT_VERSION);
        lblTitle.alignment = ["left", "center"];
        try {
            lblTitle.graphics.foregroundColor = lblTitle.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [1.0, 0.45, 0.65, 1.0], 1);
        } catch (eG1) {}

        var btnHelp = pnlHeader.add("button", undefined, "GitHub ↗");
        btnHelp.preferredSize = [70, 22];
        btnHelp.alignment = ["right", "center"];
        btnHelp.onClick = function () {
            try {
                if (typeof File !== "undefined") {
                    File.openDialog || (new File(GITHUB_REPO_URL)).execute();
                }
            } catch (eOpen) {}
        };

        // ---------------------------------------------------------------------
        // Highlight Engine Method Switch (Top of UI)
        // ---------------------------------------------------------------------
        var pnlMethod = win.add("panel", undefined, "Highlight Engine Method");
        pnlMethod.orientation = "column";
        pnlMethod.alignChildren = ["fill", "top"];
        pnlMethod.alignment = ["fill", "top"];
        pnlMethod.spacing = 4;
        pnlMethod.margins = [8, 6, 8, 6];

        var grpMethodRow = pnlMethod.add("group");
        grpMethodRow.orientation = "row";
        grpMethodRow.alignChildren = ["left", "center"];
        grpMethodRow.alignment = ["fill", "top"];
        grpMethodRow.spacing = 8;

        grpMethodRow.add("statictext", undefined, "Method:");
        var ddMethod = grpMethodRow.add("dropdownlist", undefined, [
            "✂️ Split Method (Decompose Lines & Words)",
            "📐 Calculation Method (Intact Text Box)"
        ]);
        ddMethod.selection = 0;
        ddMethod.preferredSize = [240, 24];
        ddMethod.alignment = ["fill", "center"];

        var lblMethodDesc = pnlMethod.add("statictext", undefined, "Splits target lines and words into independent text boxes with top-left anchor points.");
        lblMethodDesc.alignment = ["fill", "top"];
        try {
            lblMethodDesc.graphics.foregroundColor = lblMethodDesc.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.75, 0.75, 0.75, 1.0], 1);
        } catch (eGDesc) {}

        // ---------------------------------------------------------------------
        // Tabbed Panel
        // ---------------------------------------------------------------------
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.alignment = ["fill", "fill"];
        tpanel.spacing = 4;
        tpanel.margins = 4;

        // =====================================================================
        // TAB 1: 📝 SETUP & HIGHLIGHTS
        // =====================================================================
        var tabSetup = tpanel.add("tab", undefined, "📝 Setup & Rig");
        tabSetup.orientation = "column";
        tabSetup.alignChildren = ["fill", "top"];
        tabSetup.alignment = ["fill", "fill"];
        tabSetup.spacing = 6;
        tabSetup.margins = [8, 8, 8, 8];

        // 1.1 Target Selection Panel
        var pnlTarget = tabSetup.add("panel", undefined, "Target Text Layer & Alignment");
        pnlTarget.orientation = "column";
        pnlTarget.alignChildren = ["fill", "top"];
        pnlTarget.alignment = ["fill", "top"];
        pnlTarget.spacing = 4;
        pnlTarget.margins = [8, 6, 8, 6];

        var lblStatus = pnlTarget.add("statictext", undefined, "Detecting active selection...");
        lblStatus.alignment = ["fill", "top"];
        try {
            lblStatus.graphics.foregroundColor = lblStatus.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 1.0, 1.0], 1);
        } catch (eG2) {}

        var grpTargetActions = pnlTarget.add("group");
        grpTargetActions.orientation = "row";
        grpTargetActions.alignChildren = ["left", "center"];
        grpTargetActions.alignment = ["fill", "top"];
        grpTargetActions.spacing = 8;

        var btnRefresh = grpTargetActions.add("button", undefined, "🔄 Detect Selection");
        btnRefresh.preferredSize = [130, 24];

        var chkPrecomp = grpTargetActions.add("checkbox", undefined, "Make Precomp Out of Rig");
        chkPrecomp.value = false;
        chkPrecomp.helpTip = "If checked, precomposes the split text boxes and highlight layer with mirrored master controls.";

        // 1.2 Target Words / Phrases Input
        var pnlTargets = tabSetup.add("panel", undefined, "Highlight Targets (Words, Phrases, Sentences)");
        pnlTargets.orientation = "column";
        pnlTargets.alignChildren = ["fill", "top"];
        pnlTargets.alignment = ["fill", "top"];
        pnlTargets.spacing = 4;
        pnlTargets.margins = [8, 6, 8, 6];

        var lblTargetHelp = pnlTargets.add("statictext", undefined, "Enter words or phrases to highlight (1 per line or comma-separated):");
        lblTargetHelp.alignment = ["fill", "top"];

        var txtTargets = pnlTargets.add("edittext", undefined, "commodo consequat\nmauris", { multiline: true, wantReturn: true });
        txtTargets.alignment = ["fill", "top"];
        txtTargets.preferredSize = [-1, 75];

        var grpTargetHelpers = pnlTargets.add("group");
        grpTargetHelpers.orientation = "row";
        grpTargetHelpers.alignChildren = ["fill", "center"];
        grpTargetHelpers.alignment = ["fill", "top"];
        grpTargetHelpers.spacing = 6;

        var btnRepick = grpTargetHelpers.add("button", undefined, "🎲 Re-Pick 3 Words + 1 Sent");
        btnRepick.alignment = ["fill", "center"];
        btnRepick.preferredSize = [-1, 24];

        var btnDemo = grpTargetHelpers.add("button", undefined, "📷 Slow Living (Demo)");
        btnDemo.preferredSize = [-1, 24];

        var btnClear = grpTargetHelpers.add("button", undefined, "✕ Clear");
        btnClear.preferredSize = [65, 24];

        // 1.3 Master Execution & Management Buttons
        var pnlActions = tabSetup.add("panel", undefined, "Execution & Actions");
        pnlActions.orientation = "column";
        pnlActions.alignChildren = ["fill", "top"];
        pnlActions.alignment = ["fill", "top"];
        pnlActions.spacing = 6;
        pnlActions.margins = [8, 8, 8, 8];

        var btnBuild = pnlActions.add("button", undefined, "✨ Build Highlights (Split Method)");
        btnBuild.preferredSize = [-1, 32];
        btnBuild.helpTip = "Executes the selected highlight method: Split Method (decomposes text layers) or Calculation Method (intact text box).";

        var grpSubActions = pnlActions.add("group");
        grpSubActions.orientation = "row";
        grpSubActions.alignChildren = ["fill", "center"];
        grpSubActions.alignment = ["fill", "top"];
        grpSubActions.spacing = 6;

        var btnRemove = grpSubActions.add("button", undefined, "🗑️ Remove Highlights & Restore");
        btnRemove.alignment = ["fill", "center"];
        btnRemove.preferredSize = [-1, 26];
        btnRemove.helpTip = "Deletes created split layers/shapes/precomps and restores the original text box.";

        var btnCreateDummy = grpSubActions.add("button", undefined, "🎲 Create Random Dummy Text");
        btnCreateDummy.alignment = ["fill", "center"];
        btnCreateDummy.preferredSize = [-1, 26];
        btnCreateDummy.helpTip = "Generates a random dummy text (20-30 words) in the composition for immediate testing.";

        // =====================================================================
        // TAB 2: 🎨 APPEARANCE & COLORS
        // =====================================================================
        var tabApp = tpanel.add("tab", undefined, "🎨 Appearance & Colors");
        tabApp.orientation = "column";
        tabApp.alignChildren = ["fill", "top"];
        tabApp.alignment = ["fill", "fill"];
        tabApp.spacing = 6;
        tabApp.margins = [8, 8, 8, 8];

        // 2.1 Color Management Panel
        var pnlColors = tabApp.add("panel", undefined, "Interactive Color Pickers");
        pnlColors.orientation = "column";
        pnlColors.alignChildren = ["fill", "top"];
        pnlColors.alignment = ["fill", "top"];
        pnlColors.spacing = 6;
        pnlColors.margins = [8, 6, 8, 6];

        var pickerHighlight = createColorPickerGroup(pnlColors, "Highlight Box Fill:", "#FF2A6D", null, false);
        var pickerText = createColorPickerGroup(pnlColors, "Highlighted Text Color:", "#FFFFFF", null, true, true);

        // Curated Presets Row
        var grpPresetRow = pnlColors.add("group");
        grpPresetRow.orientation = "row";
        grpPresetRow.alignChildren = ["left", "center"];
        grpPresetRow.alignment = ["fill", "top"];
        grpPresetRow.spacing = 8;

        grpPresetRow.add("statictext", undefined, "Color Style Presets:");
        var presetNames = ["Hot Pink", "Golden Glow", "Neon Mint", "Electric Cyan", "Lavender Dream", "Dark Mode Minimal", "Slow Living Demo"];
        var ddPresets = grpPresetRow.add("dropdownlist", undefined, presetNames);
        ddPresets.selection = 0;
        ddPresets.preferredSize = [-1, 24];
        ddPresets.alignment = ["fill", "center"];

        ddPresets.onChange = function () {
            if (!this.selection) return;
            var pData = COLOR_PRESETS[this.selection.text];
            if (pData) {
                pickerHighlight.setHex(pData.highlightHex);
                pickerText.setHex(pData.textHex);
            }
        };

        // 2.2 Geometry & Offsets
        var pnlGeometry = tabApp.add("panel", undefined, "Geometry & Padding");
        pnlGeometry.orientation = "column";
        pnlGeometry.alignChildren = ["fill", "top"];
        pnlGeometry.alignment = ["fill", "top"];
        pnlGeometry.spacing = 4;
        pnlGeometry.margins = [8, 6, 8, 6];

        function addSliderRow(parent, label, min, max, defaultVal, unit) {
            var g = parent.add("group");
            g.orientation = "row";
            g.alignChildren = ["left", "center"];
            g.alignment = ["fill", "top"];
            g.spacing = 6;

            var lblS = g.add("statictext", undefined, label);
            lblS.preferredSize = [100, 20];

            var sld = g.add("slider", undefined, defaultVal, min, max);
            sld.alignment = ["fill", "center"];
            sld.preferredSize = [-1, -1];

            var txt = g.add("edittext", undefined, String(defaultVal));
            txt.preferredSize = [45, 20];

            if (unit) g.add("statictext", undefined, unit);

            sld.onChanging = function () { txt.text = String(Math.round(this.value)); };
            txt.onChange = function () {
                var v = Number(this.text);
                if (!isNaN(v)) sld.value = Math.max(min, Math.min(max, v));
            };

            return {
                getValue: function () { return Number(txt.text) || sld.value; },
                setValue: function (v) { sld.value = v; txt.text = String(v); }
            };
        }

        var sldPadX = addSliderRow(pnlGeometry, "Padding X:", 0, 40, 6, "px");
        var sldThickY = addSliderRow(pnlGeometry, "Thickness Y:", 0, 40, 4, "px");
        var sldRound = addSliderRow(pnlGeometry, "Roundness:", 0, 40, 6, "px");
        var sldOffX = addSliderRow(pnlGeometry, "Offset X:", -50, 50, 0, "px");
        var sldOffY = addSliderRow(pnlGeometry, "Offset Y:", -50, 50, 0, "px");
        var sldOpacity = addSliderRow(pnlGeometry, "Opacity:", 0, 100, 100, "%");

        // =====================================================================
        // TAB 3: ⚙️ PRECOMP & ADVANCED
        // =====================================================================
        var tabAdv = tpanel.add("tab", undefined, "⚙️ Precomp & Advanced");
        tabAdv.orientation = "column";
        tabAdv.alignChildren = ["fill", "top"];
        tabAdv.alignment = ["fill", "fill"];
        tabAdv.spacing = 6;
        tabAdv.margins = [8, 8, 8, 8];

        var pnlAdvInfo = tabAdv.add("panel", undefined, "Architectural Specs");
        pnlAdvInfo.orientation = "column";
        pnlAdvInfo.alignChildren = ["fill", "top"];
        pnlAdvInfo.alignment = ["fill", "top"];
        pnlAdvInfo.spacing = 4;
        pnlAdvInfo.margins = [8, 6, 8, 6];

        var txtSpecs = pnlAdvInfo.add("statictext", undefined,
            "• Anchor Point Alignment: Aligns anchor to Top-Left/Center/Right based on text justification with 0.00px visual shift.\n" +
            "• Non-Destructive Guideline: Original layer is preserved as hidden Guide Layer.\n" +
            "• Independent Split Text Boxes: Pinned to Top-Left anchor for 100% font rendering fidelity.\n" +
            "• Delimiter-Anchored Advance: Captures all kerning and trailing space advance with sub-pixel precision.\n" +
            "• Mirrored Precomp Effects: Master controls mirrored to Precomp layer driving inner expressions.",
            { multiline: true }
        );
        txtSpecs.alignment = ["fill", "top"];
        txtSpecs.preferredSize = [-1, 100];

        // Dummy Generator Controls in Advanced Tab
        var pnlDummyOpt = tabAdv.add("panel", undefined, "Dummy Text Generator Options");
        pnlDummyOpt.orientation = "column";
        pnlDummyOpt.alignChildren = ["fill", "top"];
        pnlDummyOpt.alignment = ["fill", "top"];
        pnlDummyOpt.spacing = 6;
        pnlDummyOpt.margins = [8, 6, 8, 6];

        var grpDummyRow1 = pnlDummyOpt.add("group");
        grpDummyRow1.orientation = "row";
        grpDummyRow1.alignChildren = ["left", "center"];
        grpDummyRow1.alignment = ["fill", "top"];
        grpDummyRow1.spacing = 8;

        grpDummyRow1.add("statictext", undefined, "Font:");
        var ddDummyFont = grpDummyRow1.add("dropdownlist", undefined, ["Random (Shuffle)"].concat(TYPICAL_FONTS));
        ddDummyFont.selection = 0;
        ddDummyFont.preferredSize = [130, 24];

        grpDummyRow1.add("statictext", undefined, "Align:");
        var ddDummyAlign = grpDummyRow1.add("dropdownlist", undefined, ["Random (Shuffle)", "Left", "Center", "Right"]);
        ddDummyAlign.selection = 0;
        ddDummyAlign.preferredSize = [120, 24];

        // Knowledge Base & Architectural References Panel
        var pnlRefs = tabAdv.add("panel", undefined, "Knowledge Base & References");
        pnlRefs.orientation = "column";
        pnlRefs.alignChildren = ["fill", "top"];
        pnlRefs.alignment = ["fill", "top"];
        pnlRefs.spacing = 3;
        pnlRefs.margins = [8, 6, 8, 6];

        pnlRefs.add("statictext", undefined, "1. AE vs JS Text Rendering Differences Guide:\n   https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md", { multiline: true });
        pnlRefs.add("statictext", undefined, "2. AE Align Anchor Point (Zero-Shift Alignment):\n   https://github.com/work2survive/AE-Align-AnchorPoint", { multiline: true });
        pnlRefs.add("statictext", undefined, "3. Text & Box Properties to Effects Controls:\n   https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx", { multiline: true });
        pnlRefs.add("statictext", undefined, "4. AE Text Precomp (Zero-Shift Splitting):\n   https://github.com/work2survive/AE_JS_builder/blob/main/samples/AE_Text_Precomp.jsx", { multiline: true });
        pnlRefs.add("statictext", undefined, "5. Custom Rounded Rect & Color Pickers:\n   https://github.com/work2survive/AE_JS_builder/blob/main/jsx/custom_rounded_rect.jsx", { multiline: true });
        pnlRefs.add("statictext", undefined, "6. AE Text Highlight Repository:\n   https://github.com/work2survive/AE-Text-Highlight", { multiline: true });

        // ---------------------------------------------------------------------
        // Interactive Logic & Event Listeners
        // ---------------------------------------------------------------------
        function updateSelectionStatus() {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                lblStatus.text = "⚠️ No active composition open.";
                return null;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                lblStatus.text = "ℹ️ No Text Layer selected. (Click 'Create Dummy Text Box' to test)";
                return null;
            }
            var props = getTextBoxProperties(comp, textLayer);
            var justName = props ? props.justification : "left";
            var typeName = (props && props.isBox) ? ("Box Text " + Math.round(props.boxWidth) + "px") : "Point Text";
            lblStatus.text = "🎯 Target: \"" + textLayer.name + "\" (" + typeName + ", " + justName + " justified)";
            return textLayer;
        }

        ddMethod.onChange = function () {
            var idx = ddMethod.selection ? ddMethod.selection.index : 0;
            if (idx === 0) {
                lblMethodDesc.text = "Splits target lines and words into independent text boxes with top-left anchor points.";
                btnBuild.text = "✨ Build Highlights (Split Method)";
                chkPrecomp.helpTip = "If checked, precomposes the split text boxes and highlight layer with mirrored master controls.";
            } else {
                lblMethodDesc.text = "Keeps original text box intact; calculates highlight positions via full font metrics.";
                btnBuild.text = "✨ Build Highlights (Calculation Method)";
                chkPrecomp.helpTip = "If checked, precomposes the intact text box and highlight layer with mirrored master controls.";
            }
        };

        btnRefresh.onClick = function () {
            updateSelectionStatus();
        };

        btnRepick.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            var textLayer = comp ? getSelectedTextLayer(comp) : null;
            var raw = textLayer ? getTextLayerString(textLayer) : LOREM_IPSUM_RAW;
            var auto = extractRandomWordsAndSentence(raw);
            txtTargets.text = auto.words.concat([auto.sentence]).join("\n");
        };

        btnDemo.onClick = function () {
            txtTargets.text = "Slow living\npresent moment\nbalance";
        };

        btnClear.onClick = function () {
            txtTargets.text = "";
        };

        btnCreateDummy.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (app.beginUndoGroup) app.beginUndoGroup("Create Dummy Text Box");
            try {
                var f = ddDummyFont.selection ? ddDummyFont.selection.text : "Georgia";
                var a = ddDummyAlign.selection ? ddDummyAlign.selection.text.toLowerCase() : "random";
                var dummy = createDummyTextBoxLayer(comp, f, a);
                updateSelectionStatus();
            } catch (eD) {
                alert("Error creating dummy text: " + eD.toString());
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        };

        btnRemove.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please open an active composition.");
                return;
            }
            if (app.beginUndoGroup) app.beginUndoGroup("Remove Highlights");
            try {
                var count = removeHighlightsAndRestoreOriginal(comp);
                alert("Removed " + count + " highlight layer(s). Original text box restored!");
                updateSelectionStatus();
            } catch (eRem) {
                alert("Error removing highlights: " + eRem.toString());
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        };

        btnBuild.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please open an active composition first.");
                return;
            }

            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                alert("Please select a text layer first, or click '🎲 Create Dummy Text Box' to generate one.");
                return;
            }

            var rawTerms = txtTargets.text;
            var terms = parseHighlightTerms(rawTerms);
            if (terms.length === 0) {
                alert("Please enter target words or sentences to highlight, or click '🎲 Auto-Pick Terms'.");
                return;
            }

            if (app.beginUndoGroup) app.beginUndoGroup("Build Highlights");

            try {
                var options = {
                    terms: terms,
                    highlightColor: pickerHighlight.getRgb(),
                    highlightedTextColor: pickerText.getRgb(),
                    changeTextColor: pickerText.isChecked(),
                    paddingX: sldPadX.getValue(),
                    thicknessY: sldThickY.getValue(),
                    roundness: sldRound.getValue(),
                    opacity: sldOpacity.getValue(),
                    offsetX: sldOffX.getValue(),
                    offsetY: sldOffY.getValue(),
                    makePrecomp: chkPrecomp.value
                };

                // 1. Mandatory First Action: Always move the anchor point to Top-Left using AE_Align_Anchor_Point.jsx logic,
                // no matter the method selected (Split Method or Calculation Method).
                alignLayerAnchorPointTopLeft(textLayer);

                var isSplitMethod = (!ddMethod.selection || ddMethod.selection.index === 0);
                var result = null;
                if (isSplitMethod) {
                    result = buildSplitHighlightsRig(comp, textLayer, options);
                } else {
                    result = buildCalculationHighlightsRig(comp, textLayer, options);
                }
                if (result) {
                    updateSelectionStatus();
                }
            } catch (err) {
                alert("Error building highlights:\n" + (err.message || err.toString()));
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        };

        // Initial state sync
        updateSelectionStatus();

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
            win.layout.resize();
        }

        try {
            pickerHighlight.refresh();
            pickerText.refresh();
        } catch (eRef) {}

        // Expose public API methods on panel for automation and testing
        win.alignLayerAnchorPointTopLeft = alignLayerAnchorPointTopLeft;
        win.buildSplitHighlightsRig = buildSplitHighlightsRig;
        win.buildCalculationHighlightsRig = buildCalculationHighlightsRig;
        win.createDummyTextBoxLayer = createDummyTextBoxLayer;
        win.removeHighlightsAndRestoreOriginal = removeHighlightsAndRestoreOriginal;
        win.createColorPickerGroup = createColorPickerGroup;
        win.pickerHighlight = pickerHighlight;
        win.pickerText = pickerText;
        win.btnBuild = btnBuild;
        win.btnCreateDummy = btnCreateDummy;
        win.txtTargets = txtTargets;

        return win;
    }

    var scriptPanel = buildUI(thisObj);
    return scriptPanel;

})(this);
