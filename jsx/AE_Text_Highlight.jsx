// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT HIGHLIGHT v1.4.0
// =============================================================================
//
// PURPOSE:
//   Detects the exact geometric position of specified words, character chains,
//   or full sentences inside any Text Layer, and places procedural vector highlight
//   blocks directly underneath the text with ZERO cumulative offset.
//
// ARCHITECTURAL REFERENCE & TEXT PROPERTY EXTRACTION ENGINE:
//   Built with deep reference to Text & Box Properties to Effects:
//   https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx
//   Extracts complete typography metrics, paragraph box boundaries (boxText, boxTextSize),
//   glyph bounding boundaries (sourceRectAtTime), justification enums (Left, Center, Right),
//   indents, spare margins, and live in-memory word/line metrics store.
//
// ARCHITECTURAL REFERENCES:
//   - Text & Box Properties to Effects:
//     https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx
//   - AE Text Precomp Engine (Zero-Shift Precomposition):
//     https://github.com/work2survive/AE_JS_builder/blob/main/jsx/AE_Text_Precomp.jsx
//     https://github.com/work2survive/AE-text-precomp
//   - Interactive Color Picker:
//     https://github.com/work2survive/AE_JS_builder/blob/main/jsx/custom_rounded_rect.jsx
//
// NEW IN v1.4.0:
//   1. "Make Precomp Out of Text Box" Option:
//      - Added checkbox in Text Box tab powered by the AE_Text_Precomp engine.
//      - Precomposes text layer and highlight shapes into a neatly-sized composition with
//        zero visual jump/shift on screen.
//   2. Dedicated "Dummy Text" Tab:
//      - Moved dummy text generator and randomizer into a dedicated "🎲 Dummy Text" tab.
//      - Prominent notice explains dummy generation only applies when no text layer is selected.
//   3. Interactive Swatch Color Picker:
//      - Integrated custom_rounded_rect.jsx color picker with live swatch drawing,
//        native $.colorPicker, Windows OS color picker, and hex edit synchronization.
//   4. Integrated Text_Properties_To_Effects engine:
//      - Exact typography metrics, justification enums (7412/7413/7414), and in-memory store.
//
// REPOSITORY: https://github.com/work2survive/AE-Text-Highlight
// LIVE DEMO:  https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Highlight.jsx&autobuild=true
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_TITLE    = "AE Text Highlight";
    var SCRIPT_VERSION  = "v1.4.1";
    var GITHUB_REPO_URL = "https://github.com/work2survive/AE-Text-Highlight";

    // Global in-memory cache initialization (matching Text_Properties_To_Effects.jsx)
    var globalObj = (typeof $ !== "undefined" && typeof $.global !== "undefined")
        ? $.global
        : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));

    if (typeof $ === "undefined") {
        $ = { global: globalObj, writeln: function (msg) { if (typeof console !== "undefined") console.log(msg); } };
    } else if (typeof $.global === "undefined") {
        $.global = globalObj;
    }

    if (typeof $.global.AE_TEXT_BOX_MEMORY === "undefined") {
        $.global.AE_TEXT_BOX_MEMORY = {
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

    // =========================================================================
    // 0. EXTENDSCRIPT ES3 SAFE POLYFILLS & STRING HELPERS
    // =========================================================================
    function trimStr(s) {
        if (s === null || s === undefined) return "";
        return String(s).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    }

    if (typeof String.prototype.trim !== "function") {
        String.prototype.trim = function() {
            return trimStr(this);
        };
    }

    if (typeof Array.prototype.indexOf !== "function") {
        Array.prototype.indexOf = function(item, fromIndex) {
            var len = this.length >>> 0;
            var from = Number(fromIndex) || 0;
            from = (from < 0) ? Math.ceil(from) : Math.floor(from);
            if (from < 0) from += len;
            for (; from < len; from++) {
                if (from in this && this[from] === item) return from;
            }
            return -1;
        };
    }

    // =========================================================================
    // 1. CONSTANTS, TYPICAL FONTS & DEFAULT DATA
    // =========================================================================
    // ~100-word standard Lorem Ipsum paragraph (98 words)
    var LOREM_IPSUM_RAW = 
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do " +
        "eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut " +
        "enim ad minim veniam, quis nostrud exercitation ullamco laboris " +
        "nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor " +
        "in reprehenderit in voluptate velit esse cillum dolore eu fugiat " +
        "nulla pariatur. Excepteur sint occaecat cupidatat non proident, " +
        "sunt in culpa qui officia deserunt mollit anim id est laborum. " +
        "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. " +
        "Nullam varius, turpis et commodo pharetra, est eros bibendum " +
        "elit, nec luctus magna felis sollicitudin mauris.";

    // Typical fonts installed on virtually every computer (Windows, macOS, Linux, Web)
    var TYPICAL_FONTS = [
        "Georgia",
        "Arial",
        "Times New Roman",
        "Verdana",
        "Trebuchet MS",
        "Courier New",
        "Impact"
    ];

    var TYPICAL_ALIGNMENTS = ["left", "center", "right"];
    var TYPICAL_BOX_WIDTHS = [720, 850, 960, 1100, 1200];
    var TYPICAL_INDENTS    = [0, 24, 48, 72];

    // Reference screenshot quote & target terms
    var SLOW_LIVING_QUOTE = 
        "In our pursuit of success and productivity, we\n" +
        "often forget to cherish the present moment. It's\n" +
        "about savoring a home-cooked meal, feeling the\n" +
        "sand between our toes, or losing ourselves in a\n" +
        "captivating book. Slow living reminds us to\n" +
        "Slow down, to appreciate the small joys that\n" +
        "often go unnoticed. Let's make a conscious\n" +
        "effort to immerse ourselves in the beauty of the\n" +
        "present...moment.";

    var SLOW_LIVING_HIGHLIGHTS = [
        "present moment",
        "Slow living",
        "Slow down",
        "present...moment"
    ];

    // Color Palette
    var COLOR_HOT_PINK   = [1.0, 0.176, 0.471]; // #FF2D78 (Reference Highlight)
    var COLOR_SKY_BLUE   = [0.455, 0.725, 0.906]; // #74B9E7 (Reference Background)
    var COLOR_CYBER_GOLD = [1.0, 0.902, 0.0];   // #FFE600
    var COLOR_MINT_NEON  = [0.0, 0.961, 0.608]; // #00F59B
    var COLOR_SKY_CYAN   = [0.0, 0.824, 1.0];   // #00D2FF
    var COLOR_PURPLE     = [0.753, 0.518, 0.988]; // #C084FC
    var COLOR_DARK_SLATE = [0.059, 0.090, 0.165]; // #0F172A
    var COLOR_CLEAN_WHITE= [0.973, 0.980, 0.988]; // #F8FAFC
    var COLOR_TEXT_DARK  = [0.067, 0.067, 0.067]; // #111111

    // Curated Styling Presets
    var PRESETS = {
        "Hot Pink (Default)": {
            highlight: COLOR_HOT_PINK,
            thickness: 0,
            paddingX: 8,
            roundness: 6,
            opacity: 100,
            offX: 0,
            offY: 0
        },
        "Neon Mint": {
            highlight: COLOR_MINT_NEON,
            thickness: 2,
            paddingX: 10,
            roundness: 8,
            opacity: 100,
            offX: 0,
            offY: 0
        },
        "Golden Glow": {
            highlight: COLOR_CYBER_GOLD,
            thickness: 0,
            paddingX: 6,
            roundness: 4,
            opacity: 100,
            offX: 0,
            offY: 0
        },
        "Electric Cyan": {
            highlight: COLOR_SKY_CYAN,
            thickness: 2,
            paddingX: 8,
            roundness: 6,
            opacity: 100,
            offX: 0,
            offY: 0
        },
        "Lavender Dream": {
            highlight: COLOR_PURPLE,
            thickness: 4,
            paddingX: 12,
            roundness: 10,
            opacity: 95,
            offX: 0,
            offY: 0
        },
        "Slow Living (Demo)": {
            highlight: COLOR_HOT_PINK,
            thickness: 0,
            paddingX: 8,
            roundness: 6,
            opacity: 100,
            offX: 0,
            offY: 0,
            targets: SLOW_LIVING_HIGHLIGHTS
        }
    };

    var PRESET_NAMES = [
        "Hot Pink (Default)",
        "Neon Mint",
        "Golden Glow",
        "Electric Cyan",
        "Lavender Dream",
        "Slow Living (Demo)"
    ];

    // =========================================================================
    // 2. HELPER UTILITIES: COLOR, STRING, WORD WRAP & PRECISE MEASURE
    // =========================================================================
    function hexToRgb(hex) {
        if (!hex) return [1, 1, 1];
        hex = trimStr(String(hex).replace("#", ""));
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var num = parseInt(hex, 16);
        if (isNaN(num)) return [1, 1, 1];
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#ffffff";
        var r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
        var g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
        var b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
        var rStr = (r < 16 ? "0" : "") + r.toString(16);
        var gStr = (g < 16 ? "0" : "") + g.toString(16);
        var bStr = (b < 16 ? "0" : "") + b.toString(16);
        return ("#" + rStr + gStr + bStr).toUpperCase();
    }

    // High-precision measurement engine matching the browser SVG engine
    function measureTextExact(str, fontSize, fontName) {
        if (!str) return 0;
        var fs = Number(fontSize) || 34;
        var cleanFont = trimStr(String(fontName || "Georgia").replace(/['"]/g, ""));

        // 1. If in browser / simulator environment, use Canvas 2D font metric
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
                } else if (fontLower.indexOf("times") !== -1 || fontLower.indexOf("georgia") !== -1 || fontLower.indexOf("serif") !== -1) {
                    fontStack = "'" + cleanFont + "', Georgia, 'Times New Roman', serif";
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
            } catch(e) {}
        }

        // 2. Calibrated typographic metric engine for ExtendScript desktop fallback
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

    // Word wraps text so that lines do not exceed maxBoxWidth
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

        // 1. Sentences: split on period, exclamation, or question mark
        var rawSentences = textStr.split(/[\.\!\?]+/);
        var cleanSentences = [];
        for (var s = 0; s < rawSentences.length; s++) {
            var sent = trimStr(rawSentences[s].replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""));
            if (sent.split(/\s+/).length >= 3) {
                cleanSentences.push(sent);
            }
        }

        var pickedSentence = "";
        if (cleanSentences.length > 0) {
            var sIdx = Math.floor(Math.random() * cleanSentences.length);
            pickedSentence = cleanSentences[sIdx];
        } else {
            pickedSentence = "Curabitur pretium tincidunt lacus";
        }

        // 2. Words: distinct words with length >= 5
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

        // Shuffle
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

        return {
            words: pickedWords,
            sentence: pickedSentence
        };
    }

    function getSelectedTextLayer(comp) {
        if (!comp) return null;
        try {
            if (!comp.selectedLayers || comp.selectedLayers.length === 0) return null;
            for (var i = 0; i < comp.selectedLayers.length; i++) {
                var l = comp.selectedLayers[i];
                if (!l) continue;
                if (typeof TextLayer !== "undefined" && l instanceof TextLayer) return l;
                try {
                    if (l.property("ADBE Text Properties") || l.property("Source Text")) return l;
                } catch(eProp) {}
            }
        } catch(e) {}
        return null;
    }

    function findLayerByName(comp, name) {
        if (!comp) return null;
        try {
            var total = comp.numLayers;
            if (typeof total !== "number" && comp.layers) total = comp.layers.length;
            for (var i = 1; i <= total; i++) {
                var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
                if (l && l.name === name) return l;
            }
        } catch(e) {}
        return null;
    }

    // =========================================================================
    // 2. TEXT LAYER & BOX PROPERTY INSPECTOR (FROM Text_Properties_To_Effects.jsx)
    // Reference: https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx
    // =========================================================================

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
        if (!layer) return null;
        try {
            var prop = layer.property("ADBE Text Properties") || layer.property("Text");
            var docProp = prop ? (prop.property("ADBE Text Document") || prop.property("Source Text")) : layer.property("Source Text");
            if (docProp && docProp.value) return docProp.value;
        } catch(e) {}
        try {
            if (layer.text && layer.text.sourceText && layer.text.sourceText.value) {
                return layer.text.sourceText.value;
            }
        } catch(e2) {}
        return null;
    }

    function getTextLayerDocument(layer) {
        return getTextDocument(layer);
    }

    function getTextLayerString(layer) {
        if (!layer) return "";
        try {
            var doc = getTextDocument(layer);
            if (doc) {
                if (typeof doc.text === "string") return doc.text;
                if (typeof doc === "string") return doc;
            }
        } catch(e) {}
        try {
            if (typeof layer.text === "string") return layer.text;
        } catch(e2) {}
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
            // AE ExtendScript numeric constants (7414 = Center, 7413 = Right, 7412 = Left)
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

    /**
     * Measures and stores in memory words, word widths, lines, line widths, and typography metrics.
     * Architectural reference: Text_Properties_To_Effects.jsx
     * (https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx)
     */
    function measureAndStoreTextMetrics(comp, layer) {
        if (!comp || !layer || !isTextLayer(layer)) return null;

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
                fontSize: textDoc.fontSize || 34,
                font: textDoc.font || "Georgia",
                boxWidth: 0,
                boxHeight: 0,
                totalWords: 0,
                totalLines: 0,
                maxLineWidth: 0,
                maxWordWidth: 0,
                timestamp: (new Date()).getTime()
            };
            $.global.AE_TEXT_BOX_MEMORY = emptyStore;
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

        var tempLayer = null;
        try {
            tempLayer = comp.layers.addText("");
            tempLayer.enabled = false;
            var tempDoc = tempLayer.property("Source Text").value;
            tempDoc.fontSize = textDoc.fontSize || 34;
            if (textDoc.font) {
                try { tempDoc.font = textDoc.font; } catch (eFont) {}
            }
            tempDoc.tracking = textDoc.tracking || 0;
            tempDoc.applyStroke = textDoc.applyStroke || false;
            tempDoc.strokeWidth = textDoc.strokeWidth || 0;
            tempDoc.applyFill = true;
            tempDoc.fillColor = [1, 1, 1];
            tempLayer.property("Source Text").setValue(tempDoc);

            // 1. Measure width in pixels of each word
            for (var w = 0; w < words.length; w++) {
                tempDoc.text = words[w];
                tempLayer.property("Source Text").setValue(tempDoc);
                var rW = tempLayer.sourceRectAtTime(0, false);
                var ww = rW ? (Math.round(rW.width * 100) / 100) : 0;
                wordWidths.push(ww);
            }

            // 2. Measure space width in pixels
            tempDoc.text = "A A";
            tempLayer.property("Source Text").setValue(tempDoc);
            var rPair = tempLayer.sourceRectAtTime(0, false);
            tempDoc.text = "AA";
            tempLayer.property("Source Text").setValue(tempDoc);
            var rSingle = tempLayer.sourceRectAtTime(0, false);
            if (rPair && rSingle) {
                spaceWidth = Math.max(0, Math.round((rPair.width - rSingle.width) * 100) / 100);
            }
            if (spaceWidth <= 0) {
                spaceWidth = Math.round(((textDoc.fontSize || 34) * 0.28) * 100) / 100;
            }

            // 3. Measure lines and width in pixels of each text line
            var paragraphs = fullText.split(/\r\n|\r|\n/);
            for (var p = 0; p < paragraphs.length; p++) {
                var para = paragraphs[p];
                if (!isBox || boxWidth <= 0) {
                    tempDoc.text = para;
                    tempLayer.property("Source Text").setValue(tempDoc);
                    var rL = tempLayer.sourceRectAtTime(0, false);
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
                    tempDoc.text = curLine;
                    tempLayer.property("Source Text").setValue(tempDoc);
                    var curW = tempLayer.sourceRectAtTime(0, false).width;

                    for (var pw = 1; pw < pWords.length; pw++) {
                        var testLine = curLine + " " + pWords[pw];
                        tempDoc.text = testLine;
                        tempLayer.property("Source Text").setValue(tempDoc);
                        var testW = tempLayer.sourceRectAtTime(0, false).width;

                        if (testW > boxWidth && curLine.length > 0) {
                            lines.push(curLine);
                            lineWidths.push(Math.round(curW * 100) / 100);
                            curLine = pWords[pw];
                            tempDoc.text = curLine;
                            tempLayer.property("Source Text").setValue(tempDoc);
                            curW = tempLayer.sourceRectAtTime(0, false).width;
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
                if (!isBox || boxWidth <= 0) {
                    for (var rpi = 0; rpi < rawParas.length; rpi++) {
                        lines.push(rawParas[rpi]);
                        lineWidths.push(measureTextExact(rawParas[rpi], fsz, fn));
                    }
                } else {
                    for (var rpi2 = 0; rpi2 < rawParas.length; rpi2++) {
                        var pwList = rawParas[rpi2].match(/\S+/g) || [];
                        if (pwList.length === 0) { lines.push(""); lineWidths.push(0); continue; }
                        var cLine = pwList[0];
                        for (var pwi = 1; pwi < pwList.length; pwi++) {
                            var tLine = cLine + " " + pwList[pwi];
                            if (measureTextExact(tLine, fsz, fn) > boxWidth && cLine.length > 0) {
                                lines.push(cLine);
                                lineWidths.push(measureTextExact(cLine, fsz, fn));
                                cLine = pwList[pwi];
                            } else {
                                cLine = tLine;
                            }
                        }
                        lines.push(cLine);
                        lineWidths.push(measureTextExact(cLine, fsz, fn));
                    }
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
            fontSize: textDoc.fontSize || 34,
            font: textDoc.font || "Georgia",
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            totalWords: words.length,
            totalLines: lines.length,
            maxLineWidth: maxLW,
            maxWordWidth: maxWW,
            timestamp: (new Date()).getTime()
        };

        $.global.AE_TEXT_BOX_MEMORY = memoryStore;
        try { layer._textMetrics = memoryStore; } catch (eMem) {}
        return memoryStore;
    }

    /**
     * Comprehensive Text & Paragraph Box Properties Extractor.
     * Architectural reference: Text_Properties_To_Effects.jsx
     * (https://github.com/work2survive/AE_JS_builder/blob/main/samples/Text_Properties_To_Effects.jsx)
     */
    function getTextBoxProperties(comp, layer) {
        if (!comp || !layer || !isTextLayer(layer)) return null;

        var textDoc = getTextDocument(layer);
        var sRect = getSourceRect(layer);
        var fullText = textDoc ? String(textDoc.text || "") : "";

        var isBox = false;
        var boxWidth = 0;
        var boxHeight = 0;
        try {
            if (textDoc && textDoc.boxText && textDoc.boxTextSize) {
                isBox = true;
                boxWidth = textDoc.boxTextSize[0];
                boxHeight = textDoc.boxTextSize[1];
            }
        } catch (eBox) {}

        if (!sRect || sRect.width === 0 || sRect.height === 0) {
            sRect = { left: 0, top: 0, width: (boxWidth > 0 ? boxWidth : 950), height: (textDoc ? textDoc.fontSize * 1.5 : 50) };
        }
        if (boxWidth <= 0) boxWidth = sRect.width;
        if (boxHeight <= 0) boxHeight = sRect.height;

        var fontSize = (textDoc && textDoc.fontSize) ? textDoc.fontSize : 34;
        var font = (textDoc && textDoc.font) ? textDoc.font : "Georgia";
        var leading = (textDoc && textDoc.leading && !textDoc.autoLeading) ? textDoc.leading : (fontSize * 1.2);
        var tracking = (textDoc && textDoc.tracking) ? textDoc.tracking : 0;
        var baselineShift = (textDoc && textDoc.baselineShift) ? textDoc.baselineShift : 0;
        var strokeWidth = (textDoc && textDoc.applyStroke && textDoc.strokeWidth) ? textDoc.strokeWidth : 0;

        var justification = getJustificationName(textDoc, layer);
        var alignIndex = (justification === "center") ? 1 : ((justification === "right") ? 2 : 0);
        var alignRatio = (justification === "center") ? 0.5 : ((justification === "right") ? 1.0 : 0.0);

        var indentLeft = sRect.left;
        var indentRightSpare = (isBox && sRect) ? Math.max(0, boxWidth - (sRect.left + sRect.width)) : 0;
        var baselineOffset = sRect.top;

        var metrics = measureAndStoreTextMetrics(comp, layer);

        return {
            isText: true,
            layerName: layer.name,
            textDoc: textDoc,
            fullText: fullText,
            isBox: isBox,
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            sRect: sRect,
            fontSize: fontSize,
            font: font,
            leading: leading,
            tracking: tracking,
            baselineShift: baselineShift,
            strokeWidth: strokeWidth,
            justification: justification,
            alignIndex: alignIndex,
            alignRatio: alignRatio,
            indentLeft: indentLeft,
            indentRightSpare: indentRightSpare,
            baselineOffset: baselineOffset,
            metrics: metrics
        };
    }

    function addOrUpdateEffectSlider(layer, effectName, defaultVal) {
        if (!layer) return null;
        var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
        if (!parade) return null;
        var eff = parade.property(effectName);
        if (!eff) {
            eff = parade.addProperty("ADBE Slider Control");
            eff.name = effectName;
        }
        var p = eff.property(1) || eff.property("Slider");
        if (p && defaultVal !== undefined) p.setValue(Number(defaultVal));
        return eff;
    }

    function addOrUpdateEffectColor(layer, effectName, defaultColorRgb) {
        if (!layer) return null;
        var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
        if (!parade) return null;
        var eff = parade.property(effectName);
        if (!eff) {
            eff = parade.addProperty("ADBE Color Control");
            eff.name = effectName;
        }
        var p = eff.property(1) || eff.property("Color");
        if (p && defaultColorRgb !== undefined) p.setValue(defaultColorRgb);
        return eff;
    }

    // =========================================================================
    // 3. PROCEDURAL REAL-TIME EXPRESSIONS
    // =========================================================================
    function generateRectSizeExpression(baseW, baseH) {
        return [
            'var padX = 0;',
            'try { padX = thisLayer.effect("Padding X")(1).value; } catch(e) {}',
            'var thickY = 0;',
            'try { thickY = thisLayer.effect("Thickness Y")(1).value; } catch(e) {}',
            '[Math.max(0, ' + Number(baseW || 0).toFixed(2) + ' + padX * 2), Math.max(0, ' + Number(baseH || 0).toFixed(2) + ' + thickY)];'
        ].join('\n');
    }

    function generateRectPositionExpression(baseX, baseY, targetTextLayerName) {
        return [
            'var offX = 0, offY = 0;',
            'try { offX = thisLayer.effect("Offset X")(1).value; } catch(e) {}',
            'try { offY = thisLayer.effect("Offset Y")(1).value; } catch(e) {}',
            'var basePos = [' + Number(baseX || 0).toFixed(2) + ', ' + Number(baseY || 0).toFixed(2) + '];',
            'try {',
            '    if (thisLayer.parent) {',
            '        [basePos[0] + offX, basePos[1] + offY];',
            '    } else {',
            '        var txtLayer = thisComp.layer("' + String(targetTextLayerName || "").replace(/"/g, '\\"') + '");',
            '        var compPt = txtLayer.toComp(basePos);',
            '        var localPt = thisLayer.fromComp(compPt);',
            '        [localPt[0] + offX, localPt[1] + offY];',
            '    }',
            '} catch(e) {',
            '    [basePos[0] + offX, basePos[1] + offY];',
            '}'
        ].join('\n');
    }

    // =========================================================================
    // 4. MAIN BUILD & RIGGING ENGINE
    // =========================================================================
    function createHighlightGroups(shapeLayer, textLayer, targetTextLayerName, terms, paddingX, thicknessY, roundness, highlightColor, highlightOpacity, offsetX, offsetY) {
        var contents = shapeLayer.property("ADBE Root Vectors Group") || shapeLayer.property("Contents");
        if (!contents) return 0;

        var offX = (typeof offsetX === "number") ? offsetX : 0;
        var offY = (typeof offsetY === "number") ? offsetY : 0;

        var comp = textLayer.containingComp || (app.project && app.project.activeItem);
        var props = getTextBoxProperties(comp, textLayer);
        if (!props || !props.metrics) return 0;

        var lines = props.metrics.lines;
        var lineWidths = props.metrics.lineWidths;
        var totalLines = Math.max(1, lines.length);
        var sRect = props.sRect;
        var just = props.justification;
        var fs = props.fontSize;

        // Temporary measurement helper for exact After Effects sub-string widths
        var measureLayer = null;
        if (comp && typeof comp.layers.addText === "function") {
            try {
                measureLayer = comp.layers.addText("");
                measureLayer.enabled = false;
                if (props.textDoc && measureLayer.sourceText) {
                    measureLayer.sourceText.setValue(props.textDoc);
                }
            } catch (eM) {
                measureLayer = null;
            }
        }

        function measureString(str) {
            if (!str || str.length === 0) return 0;
            if (measureLayer) {
                try {
                    var doc = measureLayer.sourceText.value;
                    doc.text = str;
                    measureLayer.sourceText.setValue(doc);
                    return measureLayer.sourceRectAtTime(0, false).width;
                } catch (e) {}
            }
            return measureTextExact(str, fs, props.font);
        }

        var totalCreated = 0;

        function createVectorHighlightGroup(segText, pW, mW, curLineW, vl) {
            var lineStartX = sRect.left;
            if (just === "center") {
                lineStartX = sRect.left + (sRect.width - curLineW) / 2;
            } else if (just === "right") {
                lineStartX = sRect.left + sRect.width - curLineW;
            }

            var wordCenterX = lineStartX + pW + (mW / 2);
            var wordCenterY = (totalLines === 1)
                ? (sRect.top + sRect.height / 2)
                : ((sRect.top + fs * 0.5) + vl * ((sRect.height - fs) / (totalLines - 1)));

            var baseW = Math.max(0, mW);
            var baseH = Math.max(0, fs);
            var initW = Math.max(0, baseW + paddingX * 2);
            var initH = Math.max(0, baseH + thicknessY);
            var initX = wordCenterX + offX;
            var initY = wordCenterY + offY;

            totalCreated++;
            var grp = contents.addProperty("ADBE Vector Group");
            grp.name = "Highlight " + totalCreated + " - " + segText.substr(0, 20);
            var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents");

            var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
            rect.name = "Box Path";

            var propSize = rect.property("ADBE Vector Rect Size") || rect.property("Size");
            if (propSize) {
                propSize.setValue([initW, initH]);
                propSize.expression = generateRectSizeExpression(baseW, baseH);
            }
            var propPos = rect.property("ADBE Vector Rect Position") || rect.property("Position");
            if (propPos) {
                propPos.setValue([initX, initY]);
                propPos.expression = generateRectPositionExpression(wordCenterX, wordCenterY, targetTextLayerName);
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
                propOp.setValue(highlightOpacity);
                propOp.expression = 'try { thisLayer.effect("Highlight Opacity")(1); } catch(e) { value; }';
            }
        }

        for (var t = 0; t < terms.length; t++) {
            var rawTerm = terms[t];
            if (!rawTerm) continue;
            var term = trimStr(rawTerm);
            if (term.length === 0) continue;
            var lowerTerm = term.toLowerCase();

            var matchedSingleLine = false;

            // 1. Direct search within each visual line
            for (var vl = 0; vl < lines.length; vl++) {
                var lineStr = lines[vl];
                if (!lineStr || lineStr.length === 0) continue;
                var lowerLine = lineStr.toLowerCase();
                var searchIdx = 0;

                while (searchIdx < lineStr.length) {
                    var found = lowerLine.indexOf(lowerTerm, searchIdx);
                    if (found === -1) break;

                    var colStart = found;
                    var segText = lineStr.substr(colStart, term.length);
                    var prefix = lineStr.substr(0, colStart);

                    var pW = measureString(prefix);
                    var mW = measureString(segText);
                    var curLineW = lineWidths[vl] || measureString(lineStr);

                    createVectorHighlightGroup(segText, pW, mW, curLineW, vl);

                    matchedSingleLine = true;
                    searchIdx = found + Math.max(1, term.length);
                }
            }

            // 2. If term contains spaces and didn't match on a single line, check across line wraps
            if (!matchedSingleLine && term.indexOf(" ") !== -1) {
                var termWords = term.split(/\s+/);
                var allWords = [];
                var lineWordRanges = [];
                var curWIdx = 0;

                for (var rvl = 0; rvl < lines.length; rvl++) {
                    var lWords = lines[rvl].match(/\S+/g) || [];
                    lineWordRanges.push({ start: curWIdx, end: curWIdx + lWords.length, vl: rvl, words: lWords });
                    for (var lwi = 0; lwi < lWords.length; lwi++) {
                        allWords.push(lWords[lwi]);
                    }
                    curWIdx += lWords.length;
                }

                var termLen = termWords.length;
                for (var wStart = 0; wStart <= allWords.length - termLen; wStart++) {
                    var matchSequence = true;
                    for (var twi = 0; twi < termLen; twi++) {
                        if (allWords[wStart + twi].toLowerCase() !== termWords[twi].toLowerCase()) {
                            matchSequence = false;
                            break;
                        }
                    }

                    if (matchSequence) {
                        var wEnd = wStart + termLen;
                        for (var lri = 0; lri < lineWordRanges.length; lri++) {
                            var rng = lineWordRanges[lri];
                            var oStart = Math.max(wStart, rng.start);
                            var oEnd = Math.min(wEnd, rng.end);
                            if (oStart < oEnd) {
                                var subWords = allWords.slice(oStart, oEnd);
                                var phraseSeg = subWords.join(" ");
                                var targetLine = lines[rng.vl];
                                var fIdx = targetLine.toLowerCase().indexOf(phraseSeg.toLowerCase());
                                if (fIdx !== -1) {
                                    var preStr = targetLine.substr(0, fIdx);
                                    var pW2 = measureString(preStr);
                                    var mW2 = measureString(targetLine.substr(fIdx, phraseSeg.length));
                                    var curLW2 = lineWidths[rng.vl] || measureString(targetLine);
                                    createVectorHighlightGroup(phraseSeg, pW2, mW2, curLW2, rng.vl);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (measureLayer) {
            try { measureLayer.remove(); } catch (eClean) {}
        }

        return totalCreated;
    }

    /**
     * Precomposes text layer and highlight shape layer with ZERO visual shift.
     * Architectural reference: AE_Text_Precomp.jsx (https://github.com/work2survive/AE-text-precomp)
     */
    function precomposeTextBoxAndHighlights(comp, textLayer, shapeLayer) {
        if (!comp || !textLayer || !shapeLayer) return null;

        var props = getTextBoxProperties(comp, textLayer);
        if (!props) return null;

        var origPos = textLayer.transform.position.value;
        var origAnchor = textLayer.transform.anchorPoint.value;
        var origScale = textLayer.transform.scale.value;
        var origRot = 0;
        try {
            if (textLayer.transform.rotation) origRot = textLayer.transform.rotation.value;
            else if (textLayer.transform.zRotation) origRot = textLayer.transform.zRotation.value;
        } catch(eRot) {}
        var origParent = textLayer.parent;
        var origName = textLayer.name;

        var sRect = props.sRect;
        var isBox = props.isBox;
        var boxWidth = props.boxWidth;
        var boxHeight = props.boxHeight;
        var just = props.justification;

        var precompW = Math.max(40, Math.round(isBox && boxWidth > 0 ? boxWidth : sRect.width));
        var precompH = Math.max(40, Math.round(isBox && boxHeight > 0 ? Math.max(boxHeight, sRect.height) : sRect.height));

        // Anchor point on the text box
        var ax = 0;
        var ay = 0;
        if (isBox) {
            ay = 0;
            if (just === "left") ax = 0;
            else if (just === "center") ax = precompW / 2;
            else if (just === "right") ax = precompW;
        } else {
            ay = sRect.top;
            if (just === "left") ax = sRect.left;
            else if (just === "center") ax = sRect.left + sRect.width / 2;
            else if (just === "right") ax = sRect.left + sRect.width;
        }

        // Zero visual shift calculation from AE_Text_Precomp.jsx
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

        var precompName = origName + " Precomp";
        var newComp = comp.layers.precompose([shapeLayer.index, textLayer.index], precompName, true);
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
        if (!newComp) return null;

        newComp.width = precompW;
        newComp.height = precompH;

        // Locate precompLayer in comp
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

        if (precompLayer) {
            precompLayer.transform.anchorPoint.setValue([ax, ay, 0]);
            precompLayer.transform.position.setValue([compPosX, compPosY, compPosZ]);
            precompLayer.transform.scale.setValue(origScale);
            try {
                if (precompLayer.transform.rotation) precompLayer.transform.rotation.setValue(origRot);
            } catch(eR) {}
            precompLayer.parent = origParent;
        }

        // Inside newComp, center inner text layer at [ax, ay] so local parenting remains intact
        var innerTextLayer = null;
        for (var j = 1; j <= newComp.numLayers; j++) {
            var jl = (typeof newComp.layer === "function") ? newComp.layer(j) : newComp.layers[j - 1];
            if (jl && isTextLayer(jl)) {
                innerTextLayer = jl;
                break;
            }
        }

        if (innerTextLayer) {
            innerTextLayer.transform.anchorPoint.setValue([ax, ay]);
            innerTextLayer.transform.position.setValue([ax, ay, 0]);
            innerTextLayer.transform.scale.setValue([100, 100, 100]);
            try {
                if (innerTextLayer.transform.rotation) innerTextLayer.transform.rotation.setValue(0);
                if (innerTextLayer.transform.zRotation) innerTextLayer.transform.zRotation.setValue(0);
            } catch(eZero) {}
        }

        return precompLayer;
    }

    // =========================================================================
    // 5. SCRIPTUI USER INTERFACE BUILDER
    // =========================================================================
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true });
        if (!(thisObj instanceof Panel)) {
            win.text = SCRIPT_TITLE + " " + SCRIPT_VERSION;
        }

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;
        try {
            win.minimumSize = [280, 420];
        } catch(eMin) {}

        // Current State Variables
        var currentHighlightColor = COLOR_HOT_PINK.slice(0);
        var currentThickness      = 0;  // Default 0 (tied to font ascender to descender)
        var currentPaddingX       = 8;  // Default 8px horizontal padding
        var currentRoundness      = 6;  // Default 6px corner radius
        var currentOpacity        = 100;
        var currentOffsetX        = 0;  // Fine-tuning position offset X
        var currentOffsetY        = 0;  // Fine-tuning position offset Y

        // Dummy Text Randomization State
        var dummyFont      = "Georgia";
        var dummyAlignment = "left";
        var dummyBoxWidth  = 950;
        var dummyIndent    = 0;

        // ---------------------------------------------------------------------
        // 1. HEADER (Title, Version & Description Note)
        // ---------------------------------------------------------------------
        var pnlHeader = win.add("panel", undefined, "");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.spacing = 2;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblTitle = pnlHeader.add("statictext", undefined, "🖊️ AE TEXT HIGHLIGHT " + SCRIPT_VERSION);
        lblTitle.alignment = ["fill", "top"];
        try {
            lblTitle.graphics.font = ScriptUI.newFont("Verdana", "Bold", 13);
        } catch(eF) {}

        var lblDesc = pnlHeader.add("statictext", undefined, "Procedural Vector Text Highlights with Real-Time Bounding & Sync.");
        lblDesc.alignment = ["fill", "top"];
        var lblInspired = pnlHeader.add("statictext", undefined, "Zero-drift token engine & AE_Text_Precomp integration.");
        lblInspired.alignment = ["fill", "top"];

        // ---------------------------------------------------------------------
        // 2. PRESETS BAR
        // ---------------------------------------------------------------------
        var grpPreset = win.add("group");
        grpPreset.orientation = "row";
        grpPreset.alignChildren = ["left", "center"];
        grpPreset.alignment = ["fill", "top"];
        grpPreset.spacing = 6;

        grpPreset.add("statictext", undefined, "Preset:");
        var dropPreset = grpPreset.add("dropdownlist", undefined, PRESET_NAMES);
        dropPreset.alignment = ["fill", "center"];
        dropPreset.preferredSize = [-1, 24];
        dropPreset.selection = 0;
        dropPreset.helpTip = "Choose from curated styling presets (Hot Pink, Neon Mint, Golden Glow, etc.)";

        var btnReloadPresets = grpPreset.add("button", undefined, "🔄");
        btnReloadPresets.maximumSize = [28, 24];
        btnReloadPresets.preferredSize = [28, 24];
        btnReloadPresets.helpTip = "Reset preset parameters to defaults";

        // ---------------------------------------------------------------------
        // 3. TABBED CONTROLS
        // ---------------------------------------------------------------------
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.alignment = ["fill", "fill"];
        tpanel.spacing = 4;
        tpanel.margins = 4;

        // ==========================================
        // TAB 1: TEXT BOX (Main Setup Tab)
        // ==========================================
        var tabText = tpanel.add("tab", undefined, "📝 Text Box");
        tabText.orientation = "column";
        tabText.alignChildren = ["fill", "top"];
        tabText.alignment = ["fill", "fill"];
        tabText.spacing = 6;
        tabText.margins = [8, 8, 8, 8];

        // 1.1 Target Text Layer Status & Precomp Option
        var pnlStatus = tabText.add("panel", undefined, "Target Text Layer & Precomposition");
        pnlStatus.orientation = "column";
        pnlStatus.alignChildren = ["fill", "top"];
        pnlStatus.alignment = ["fill", "top"];
        pnlStatus.spacing = 6;
        pnlStatus.margins = [10, 8, 10, 8];

        var lblStatus = pnlStatus.add("statictext", undefined, "Checking active selection...");
        lblStatus.alignment = ["fill", "top"];
        try {
            lblStatus.graphics.foregroundColor = lblStatus.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.4, 0.75, 1.0, 1.0], 1);
        } catch(e) {}

        var grpStatusActions = pnlStatus.add("group");
        grpStatusActions.orientation = "row";
        grpStatusActions.alignChildren = ["left", "center"];
        grpStatusActions.alignment = ["fill", "top"];
        grpStatusActions.spacing = 10;

        var btnRefreshLayer = grpStatusActions.add("button", undefined, "Detect Selection");
        btnRefreshLayer.preferredSize = [-1, 24];
        btnRefreshLayer.alignment = ["left", "center"];
        btnRefreshLayer.helpTip = "Re-scan active composition to detect any newly selected Text Layer.";

        var chkPrecomp = grpStatusActions.add("checkbox", undefined, "Make Precomp Out of Text Box");
        chkPrecomp.value = false;
        chkPrecomp.alignment = ["fill", "center"];
        chkPrecomp.helpTip = "If checked, precomposes the text box and its highlight layer with zero visual shift (based on AE_Text_Precomp).";

        // 1.2 Highlight Targets
        var pnlTargets = tabText.add("panel", undefined, "Highlight Targets (Words, Phrases, Sentences)");
        pnlTargets.orientation = "column";
        pnlTargets.alignChildren = ["fill", "top"];
        pnlTargets.alignment = ["fill", "top"];
        pnlTargets.spacing = 6;
        pnlTargets.margins = [10, 8, 10, 8];

        var lblTargetsNote = pnlTargets.add("statictext", undefined, "Words or sentences to detect & highlight (1 per line or comma-separated):");
        lblTargetsNote.alignment = ["fill", "top"];

        var txtHighlights = pnlTargets.add("edittext", undefined, "", { multiline: true, wantReturn: true });
        txtHighlights.alignment = ["fill", "top"];
        txtHighlights.preferredSize = [-1, 70];
        txtHighlights.helpTip = "Type or paste words, chains of characters, or complete sentences to highlight.";

        var grpActionBtns = pnlTargets.add("group");
        grpActionBtns.orientation = "row";
        grpActionBtns.alignChildren = ["fill", "center"];
        grpActionBtns.alignment = ["fill", "top"];
        grpActionBtns.spacing = 4;

        var btnPickRandom = grpActionBtns.add("button", undefined, "🎲 Re-Pick 3 Words + 1 Sent");
        btnPickRandom.alignment = ["fill", "center"];
        btnPickRandom.preferredSize = [-1, 24];
        btnPickRandom.helpTip = "Re-picks 3 random words and 1 full sentence from the current text.";

        var btnLoadDemo = grpActionBtns.add("button", undefined, "📷 Slow Living (Demo)");
        btnLoadDemo.alignment = ["fill", "center"];
        btnLoadDemo.preferredSize = [-1, 24];
        btnLoadDemo.helpTip = "Loads the exact Slow Living quote & highlights shown in the reference screenshot.";

        var btnClearTargets = grpActionBtns.add("button", undefined, "✕ Clear");
        btnClearTargets.alignment = ["fill", "center"];
        btnClearTargets.preferredSize = [-1, 24];
        btnClearTargets.helpTip = "Clears the target list.";

        // ==========================================
        // TAB 2: DUMMY TEXT (Dedicated Generator Tab)
        // ==========================================
        var tabDummy = tpanel.add("tab", undefined, "🎲 Dummy Text");
        tabDummy.orientation = "column";
        tabDummy.alignChildren = ["fill", "top"];
        tabDummy.alignment = ["fill", "fill"];
        tabDummy.spacing = 6;
        tabDummy.margins = [8, 8, 8, 8];

        // 2.1 Usage Notice
        var pnlNotice = tabDummy.add("panel", undefined, "ℹ️ Notice");
        pnlNotice.orientation = "column";
        pnlNotice.alignChildren = ["fill", "top"];
        pnlNotice.alignment = ["fill", "top"];
        pnlNotice.spacing = 4;
        pnlNotice.margins = [10, 8, 10, 8];

        var lblNotice1 = pnlNotice.add("statictext", undefined, "⚠️ Dummy Text Generator ONLY applies when NO text layer is selected.");
        lblNotice1.alignment = ["fill", "top"];
        try {
            lblNotice1.graphics.foregroundColor = lblNotice1.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.95, 0.7, 0.2, 1.0], 1);
        } catch(eN1) {}
        var lblNotice2 = pnlNotice.add("statictext", undefined, "If a text layer is selected in After Effects, your selected layer is highlighted directly.");
        lblNotice2.alignment = ["fill", "top"];

        // 2.2 Dummy Generator Controls
        var pnlRandom = tabDummy.add("panel", undefined, "Dummy Text Generator & Multi-Attribute Randomization (~100 Words)");
        pnlRandom.orientation = "column";
        pnlRandom.alignChildren = ["fill", "top"];
        pnlRandom.alignment = ["fill", "top"];
        pnlRandom.spacing = 6;
        pnlRandom.margins = [10, 8, 10, 8];

        var lblRandomSummary = pnlRandom.add("statictext", undefined, "Font: " + dummyFont + " | Align: " + dummyAlignment + " | Width: " + dummyBoxWidth + "px | Indent: " + dummyIndent + "px");
        lblRandomSummary.alignment = ["fill", "top"];
        try {
            lblRandomSummary.graphics.foregroundColor = lblRandomSummary.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.95, 0.75, 0.3, 1.0], 1);
        } catch(e) {}

        var grpRandBtns = pnlRandom.add("group");
        grpRandBtns.orientation = "row";
        grpRandBtns.alignChildren = ["fill", "center"];
        grpRandBtns.alignment = ["fill", "top"];
        grpRandBtns.spacing = 4;

        var btnRandomizeAll = grpRandBtns.add("button", undefined, "🎲 Randomize Dummy & Layout");
        btnRandomizeAll.alignment = ["fill", "center"];
        btnRandomizeAll.preferredSize = [-1, 26];
        btnRandomizeAll.helpTip = "Randomizes font, alignment, text box width, indent, and picks 3 random words + 1 sentence.";

        // Font selection row
        var grpFontRow = pnlRandom.add("group");
        grpFontRow.orientation = "row";
        grpFontRow.alignChildren = ["left", "center"];
        grpFontRow.alignment = ["fill", "top"];
        grpFontRow.spacing = 6;

        grpFontRow.add("statictext", undefined, "Font:");
        var ddFont = grpFontRow.add("dropdownlist", undefined, TYPICAL_FONTS);
        ddFont.selection = 0;
        ddFont.alignment = ["fill", "center"];
        ddFont.preferredSize = [-1, 24];

        grpFontRow.add("statictext", undefined, "Align:");
        var ddAlign = grpFontRow.add("dropdownlist", undefined, ["Left", "Center", "Right"]);
        ddAlign.selection = 0;
        ddAlign.preferredSize = [75, 24];

        // Box width & indent row
        var grpBoxRow = pnlRandom.add("group");
        grpBoxRow.orientation = "row";
        grpBoxRow.alignChildren = ["left", "center"];
        grpBoxRow.alignment = ["fill", "top"];
        grpBoxRow.spacing = 6;

        grpBoxRow.add("statictext", undefined, "Box Width:");
        var sldBoxW = grpBoxRow.add("slider", undefined, 950, 600, 1300);
        sldBoxW.alignment = ["fill", "center"];
        sldBoxW.preferredSize = [-1, -1];
        var txtBoxW = grpBoxRow.add("edittext", undefined, "950");
        txtBoxW.preferredSize = [45, 22];
        grpBoxRow.add("statictext", undefined, "px");

        grpBoxRow.add("statictext", undefined, "Indent:");
        var sldInd = grpBoxRow.add("slider", undefined, 0, 0, 80);
        sldInd.preferredSize = [50, -1];
        var txtInd = grpBoxRow.add("edittext", undefined, "0");
        txtInd.preferredSize = [30, 22];
        grpBoxRow.add("statictext", undefined, "px");

        // ==========================================
        // TAB 3: APPEARANCE (Color Picker & Styling)
        // ==========================================
        var tabApp = tpanel.add("tab", undefined, "🎨 Appearance");
        tabApp.orientation = "column";
        tabApp.alignChildren = ["fill", "top"];
        tabApp.alignment = ["fill", "fill"];
        tabApp.spacing = 6;
        tabApp.margins = [8, 8, 8, 8];

        // 3.1 Highlight Geometry & Offsets
        var pnlGeometry = tabApp.add("panel", undefined, "Highlight Geometry & Offsets");
        pnlGeometry.orientation = "column";
        pnlGeometry.alignChildren = ["fill", "top"];
        pnlGeometry.alignment = ["fill", "top"];
        pnlGeometry.spacing = 5;
        pnlGeometry.margins = [10, 8, 10, 8];

        // Thickness Y (Ascender to Descender)
        var grpThick = pnlGeometry.add("group");
        grpThick.orientation = "row";
        grpThick.alignChildren = ["left", "center"];
        grpThick.alignment = ["fill", "top"];
        var lblThick = grpThick.add("statictext", undefined, "Thickness Y:");
        lblThick.preferredSize = [85, -1];
        var sldThick = grpThick.add("slider", undefined, 0, -20, 60);
        sldThick.alignment = ["fill", "center"];
        sldThick.preferredSize = [-1, -1];
        var txtThick = grpThick.add("edittext", undefined, "0");
        txtThick.preferredSize = [42, 22];
        grpThick.add("statictext", undefined, "px (0 = Font Height)");

        // Horizontal Padding X
        var grpPadX = pnlGeometry.add("group");
        grpPadX.orientation = "row";
        grpPadX.alignChildren = ["left", "center"];
        grpPadX.alignment = ["fill", "top"];
        var lblPadX = grpPadX.add("statictext", undefined, "Padding X:");
        lblPadX.preferredSize = [85, -1];
        var sldPadX = grpPadX.add("slider", undefined, 8, 0, 40);
        sldPadX.alignment = ["fill", "center"];
        sldPadX.preferredSize = [-1, -1];
        var txtPadX = grpPadX.add("edittext", undefined, "8");
        txtPadX.preferredSize = [42, 22];
        grpPadX.add("statictext", undefined, "px");

        // Roundness
        var grpRound = pnlGeometry.add("group");
        grpRound.orientation = "row";
        grpRound.alignChildren = ["left", "center"];
        grpRound.alignment = ["fill", "top"];
        var lblRound = grpRound.add("statictext", undefined, "Roundness:");
        lblRound.preferredSize = [85, -1];
        var sldRound = grpRound.add("slider", undefined, 6, 0, 40);
        sldRound.alignment = ["fill", "center"];
        sldRound.preferredSize = [-1, -1];
        var txtRound = grpRound.add("edittext", undefined, "6");
        txtRound.preferredSize = [42, 22];
        grpRound.add("statictext", undefined, "px (0 = Square)");

        // Position Offset (X / Y)
        var grpOffset = pnlGeometry.add("group");
        grpOffset.orientation = "row";
        grpOffset.alignChildren = ["left", "center"];
        grpOffset.alignment = ["fill", "top"];
        var lblOff = grpOffset.add("statictext", undefined, "Offset X / Y:");
        lblOff.preferredSize = [85, -1];

        var sldOffX = grpOffset.add("slider", undefined, 0, -100, 100);
        sldOffX.alignment = ["fill", "center"];
        sldOffX.preferredSize = [-1, -1];
        var txtOffX = grpOffset.add("edittext", undefined, "0");
        txtOffX.preferredSize = [35, 22];

        var sldOffY = grpOffset.add("slider", undefined, 0, -100, 100);
        sldOffY.alignment = ["fill", "center"];
        sldOffY.preferredSize = [-1, -1];
        var txtOffY = grpOffset.add("edittext", undefined, "0");
        txtOffY.preferredSize = [35, 22];
        grpOffset.add("statictext", undefined, "px");

        // 3.2 Highlight Color & Interactive Color Picker
        // Reference: custom_rounded_rect.jsx (https://github.com/work2survive/AE_JS_builder/blob/main/jsx/custom_rounded_rect.jsx)
        var pnlColor = tabApp.add("panel", undefined, "Highlight Color & Opacity");
        pnlColor.orientation = "column";
        pnlColor.alignChildren = ["fill", "top"];
        pnlColor.alignment = ["fill", "top"];
        pnlColor.spacing = 6;
        pnlColor.margins = [10, 8, 10, 8];

        // Color Picker Function
        function createColorPicker(parent, defaultHex) {
            var grp = parent.add("group");
            grp.orientation = "row";
            grp.spacing = 6;
            grp.alignChildren = ["left", "center"];

            var btnSwatch = grp.add("button", undefined, "");
            btnSwatch.preferredSize = [36, 22];
            btnSwatch.helpTip = "Click to open Color Picker";

            var txtHex = grp.add("edittext", undefined, defaultHex);
            txtHex.preferredSize = [70, 22];
            txtHex.characters = 7;

            var picker = {
                group: grp,
                button: btnSwatch,
                edittext: txtHex,
                _color: defaultHex,
                value: defaultHex,
                onChange: null,
                setColor: function(newHex, triggerChange) {
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

            btnSwatch.onClick = function() {
                var curHex = picker._color || "#FF1493";
                if (typeof window !== "undefined" && typeof window.openWindowsColorPicker === "function") {
                    window.openWindowsColorPicker(curHex, function(selectedHex) {
                        picker.setColor(selectedHex, true);
                    });
                    return;
                }

                var hexNum = parseInt(curHex.replace("#", ""), 16);
                var result = -1;
                if (typeof $.colorPicker === "function") {
                    result = $.colorPicker(hexNum, function(selectedHex) {
                        picker.setColor(selectedHex, true);
                    });
                }
                if (result !== -1 && result !== undefined && result !== null) {
                    var hexStr = Number(result).toString(16);
                    while (hexStr.length < 6) hexStr = "0" + hexStr;
                    picker.setColor("#" + hexStr, true);
                }
            };

            txtHex.onChange = function() {
                var val = txtHex.text.replace(/^\s+|\s+$/g, "");
                if (val.indexOf("#") !== 0) val = "#" + val;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    picker.setColor(val, true);
                } else {
                    txtHex.text = picker._color.toUpperCase();
                }
            };

            picker.setColor(defaultHex, false);
            return picker;
        }

        var grpCol = pnlColor.add("group");
        grpCol.orientation = "row";
        grpCol.alignChildren = ["left", "center"];
        grpCol.alignment = ["fill", "top"];
        grpCol.spacing = 8;

        var lblCol = grpCol.add("statictext", undefined, "Highlight Color:");
        lblCol.preferredSize = [95, -1];

        var cpHighlight = createColorPicker(grpCol, rgbToHex(currentHighlightColor));

        var lblOp = grpCol.add("statictext", undefined, "Opacity:");
        lblOp.preferredSize = [48, -1];
        var sldOp = grpCol.add("slider", undefined, 100, 0, 100);
        sldOp.alignment = ["fill", "center"];
        sldOp.preferredSize = [-1, -1];
        var txtOp = grpCol.add("edittext", undefined, "100");
        txtOp.preferredSize = [35, 22];
        grpCol.add("statictext", undefined, "%");

        // Color Swatches
        var grpSwatches = pnlColor.add("group");
        grpSwatches.orientation = "row";
        grpSwatches.alignChildren = ["left", "center"];
        grpSwatches.alignment = ["fill", "top"];
        grpSwatches.spacing = 4;
        grpSwatches.add("statictext", undefined, "Presets:");

        var btnSwPink   = grpSwatches.add("button", undefined, "Pink");
        btnSwPink.alignment = ["fill", "center"];
        btnSwPink.preferredSize = [-1, 24];
        var btnSwYellow = grpSwatches.add("button", undefined, "Gold");
        btnSwYellow.alignment = ["fill", "center"];
        btnSwYellow.preferredSize = [-1, 24];
        var btnSwMint   = grpSwatches.add("button", undefined, "Mint");
        btnSwMint.alignment = ["fill", "center"];
        btnSwMint.preferredSize = [-1, 24];
        var btnSwCyan   = grpSwatches.add("button", undefined, "Cyan");
        btnSwCyan.alignment = ["fill", "center"];
        btnSwCyan.preferredSize = [-1, 24];
        var btnSwPurple = grpSwatches.add("button", undefined, "Purple");
        btnSwPurple.alignment = ["fill", "center"];
        btnSwPurple.preferredSize = [-1, 24];

        // Set Default Active Tab to Text Box
        tpanel.selection = 0;

        // ---------------------------------------------------------------------
        // 4. MAIN ACTION BUTTONS (Full Width, At Bottom)
        // ---------------------------------------------------------------------
        var btnBuild = win.add("button", undefined, "🖊️ Create Highlight Layer");
        btnBuild.alignment = ["fill", "top"];
        btnBuild.preferredSize = [-1, 36];
        btnBuild.helpTip = "Generates procedural vector highlight shape layer parented to the text layer.";

        var btnUpdate = win.add("button", undefined, "⟳ Update Selected Highlight Layer");
        btnUpdate.alignment = ["fill", "top"];
        btnUpdate.preferredSize = [-1, 32];
        btnUpdate.helpTip = "Updates effects and styling on existing highlight layer in real time.";

        // ---------------------------------------------------------------------
        // 5. FOOTER LINK
        // ---------------------------------------------------------------------
        var grpRepoLink = win.add("group");
        grpRepoLink.orientation = "row";
        grpRepoLink.alignment = ["fill", "bottom"];
        grpRepoLink.alignChildren = ["center", "center"];
        grpRepoLink.margins = [0, 4, 0, 0];

        var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE-Text-Highlight");
        lblRepoLink.helpTip = GITHUB_REPO_URL;
        lblRepoLink.onClick = function() {
            var url = GITHUB_REPO_URL;
            if (typeof window !== "undefined" && window.open) {
                window.open(url, "_blank");
            } else if ($.os.indexOf("Windows") !== -1) {
                system.callSystem('explorer "' + url + '"');
            } else {
                system.callSystem('open "' + url + '"');
            }
        };

        // ---------------------------------------------------------------------
        // 6. UI INTERACTION & EVENT HANDLERS
        // ---------------------------------------------------------------------
        function applyPreset(name) {
            var p = PRESETS[name];
            if (!p) return;
            currentHighlightColor = p.highlight.slice(0);
            currentThickness = p.thickness;
            currentPaddingX = p.paddingX;
            currentRoundness = p.roundness;
            currentOpacity = p.opacity;
            currentOffsetX = p.offX || 0;
            currentOffsetY = p.offY || 0;

            cpHighlight.setColor(rgbToHex(currentHighlightColor), false);

            sldThick.value = currentThickness;
            txtThick.text = String(currentThickness);

            sldPadX.value = currentPaddingX;
            txtPadX.text = String(currentPaddingX);

            sldRound.value = currentRoundness;
            txtRound.text = String(currentRoundness);

            sldOp.value = currentOpacity;
            txtOp.text = String(currentOpacity);

            sldOffX.value = currentOffsetX;
            txtOffX.text = String(currentOffsetX);

            sldOffY.value = currentOffsetY;
            txtOffY.text = String(currentOffsetY);
        }

        dropPreset.onChange = function() {
            if (dropPreset.selection) {
                applyPreset(dropPreset.selection.text);
            }
        };

        btnReloadPresets.onClick = function() {
            if (dropPreset.selection) {
                applyPreset(dropPreset.selection.text);
            }
        };

        sldThick.onChanging = sldThick.onChange = function() {
            var v = Math.round(sldThick.value);
            txtThick.text = String(v);
            currentThickness = v;
        };
        txtThick.onChange = function() {
            var v = parseInt(txtThick.text, 10);
            if (isNaN(v)) v = 0;
            sldThick.value = v;
            currentThickness = v;
        };

        sldPadX.onChanging = sldPadX.onChange = function() {
            var v = Math.round(sldPadX.value);
            txtPadX.text = String(v);
            currentPaddingX = v;
        };
        txtPadX.onChange = function() {
            var v = parseInt(txtPadX.text, 10);
            if (isNaN(v)) v = 8;
            sldPadX.value = v;
            currentPaddingX = v;
        };

        sldRound.onChanging = sldRound.onChange = function() {
            var v = Math.round(sldRound.value);
            txtRound.text = String(v);
            currentRoundness = v;
        };
        txtRound.onChange = function() {
            var v = parseInt(txtRound.text, 10);
            if (isNaN(v)) v = 6;
            sldRound.value = v;
            currentRoundness = v;
        };

        sldOffX.onChanging = sldOffX.onChange = function() {
            var v = Math.round(sldOffX.value);
            txtOffX.text = String(v);
            currentOffsetX = v;
        };
        txtOffX.onChange = function() {
            var v = parseInt(txtOffX.text, 10);
            if (isNaN(v)) v = 0;
            sldOffX.value = v;
            currentOffsetX = v;
        };

        sldOffY.onChanging = sldOffY.onChange = function() {
            var v = Math.round(sldOffY.value);
            txtOffY.text = String(v);
            currentOffsetY = v;
        };
        txtOffY.onChange = function() {
            var v = parseInt(txtOffY.text, 10);
            if (isNaN(v)) v = 0;
            sldOffY.value = v;
            currentOffsetY = v;
        };

        sldOp.onChanging = sldOp.onChange = function() {
            var v = Math.round(sldOp.value);
            txtOp.text = String(v);
            currentOpacity = v;
        };
        txtOp.onChange = function() {
            var v = parseInt(txtOp.text, 10);
            if (isNaN(v)) v = 100;
            v = Math.max(0, Math.min(100, v));
            sldOp.value = v;
            currentOpacity = v;
        };

        cpHighlight.onChange = function() {
            currentHighlightColor = hexToRgb(cpHighlight.value);
        };

        btnSwPink.onClick = function() {
            currentHighlightColor = COLOR_HOT_PINK.slice(0);
            cpHighlight.setColor(rgbToHex(currentHighlightColor), true);
        };
        btnSwYellow.onClick = function() {
            currentHighlightColor = COLOR_CYBER_GOLD.slice(0);
            cpHighlight.setColor(rgbToHex(currentHighlightColor), true);
        };
        btnSwMint.onClick = function() {
            currentHighlightColor = COLOR_MINT_NEON.slice(0);
            cpHighlight.setColor(rgbToHex(currentHighlightColor), true);
        };
        btnSwCyan.onClick = function() {
            currentHighlightColor = COLOR_SKY_CYAN.slice(0);
            cpHighlight.setColor(rgbToHex(currentHighlightColor), true);
        };
        btnSwPurple.onClick = function() {
            currentHighlightColor = COLOR_PURPLE.slice(0);
            cpHighlight.setColor(rgbToHex(currentHighlightColor), true);
        };

        btnPickRandom.onClick = function() {
            var comp = app.project.activeItem;
            var textLayer = (comp && comp instanceof CompItem) ? getSelectedTextLayer(comp) : null;
            var srcText = "";
            if (textLayer && textLayer.text && textLayer.text.sourceText) {
                srcText = String(textLayer.text.sourceText.value || "");
            }
            if (!srcText) {
                srcText = wordWrapToBoxWidth(LOREM_IPSUM_RAW, dummyBoxWidth, 34, dummyFont, dummyIndent);
            }

            var extracted = extractRandomWordsAndSentence(srcText);
            var combined = extracted.words.concat([extracted.sentence]);
            txtHighlights.text = combined.join("\n");
        };

        btnLoadDemo.onClick = function() {
            for (var i = 0; i < PRESET_NAMES.length; i++) {
                if (PRESET_NAMES[i] === "Slow Living (Demo)") {
                    dropPreset.selection = i;
                    applyPreset("Slow Living (Demo)");
                    break;
                }
            }
        };

        btnClearTargets.onClick = function() {
            txtHighlights.text = "";
        };

        btnRefreshLayer.onClick = function() {
            updateSelectionStatus();
        };

        function updateSelectionStatus() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                lblStatus.text = "○ No active composition (Will auto-create HD comp)";
                return;
            }
            var sel = getSelectedTextLayer(comp);
            if (sel) {
                lblStatus.text = "● Target: \"" + sel.name + "\" (Selected Text Layer)";
            } else {
                lblStatus.text = "○ No text layer selected (Auto-generate randomized Lorem Ipsum)";
            }
        }

        function updateRandomSummaryLabel() {
            lblRandomSummary.text = "Font: " + dummyFont + " | Align: " + dummyAlignment + " | Width: " + dummyBoxWidth + "px | Indent: " + dummyIndent + "px";
        }

        function applyRandomization() {
            dummyFont = TYPICAL_FONTS[Math.floor(Math.random() * TYPICAL_FONTS.length)];
            dummyAlignment = TYPICAL_ALIGNMENTS[Math.floor(Math.random() * TYPICAL_ALIGNMENTS.length)];
            dummyBoxWidth = TYPICAL_BOX_WIDTHS[Math.floor(Math.random() * TYPICAL_BOX_WIDTHS.length)];
            dummyIndent = TYPICAL_INDENTS[Math.floor(Math.random() * TYPICAL_INDENTS.length)];

            for (var f = 0; f < TYPICAL_FONTS.length; f++) {
                if (TYPICAL_FONTS[f] === dummyFont) {
                    ddFont.selection = f;
                    break;
                }
            }
            var alignIdx = (dummyAlignment === "center") ? 1 : ((dummyAlignment === "right") ? 2 : 0);
            ddAlign.selection = alignIdx;

            sldBoxW.value = dummyBoxWidth;
            txtBoxW.text = String(dummyBoxWidth);

            sldInd.value = dummyIndent;
            txtInd.text = String(dummyIndent);

            updateRandomSummaryLabel();

            var wrapped = wordWrapToBoxWidth(LOREM_IPSUM_RAW, dummyBoxWidth, 34, dummyFont, dummyIndent);
            var extracted = extractRandomWordsAndSentence(wrapped);
            txtHighlights.text = extracted.words.concat([extracted.sentence]).join("\n");
        }

        btnRandomizeAll.onClick = function() {
            applyRandomization();
        };

        ddFont.onChange = function() {
            if (ddFont.selection) {
                dummyFont = ddFont.selection.text;
                updateRandomSummaryLabel();
            }
        };

        ddAlign.onChange = function() {
            if (ddAlign.selection) {
                dummyAlignment = ddAlign.selection.text.toLowerCase();
                updateRandomSummaryLabel();
            }
        };

        sldBoxW.onChanging = sldBoxW.onChange = function() {
            dummyBoxWidth = Math.round(sldBoxW.value);
            txtBoxW.text = String(dummyBoxWidth);
            updateRandomSummaryLabel();
        };
        txtBoxW.onChange = function() {
            var v = parseInt(txtBoxW.text, 10);
            if (isNaN(v)) v = 950;
            sldBoxW.value = v;
            dummyBoxWidth = v;
            updateRandomSummaryLabel();
        };

        sldInd.onChanging = sldInd.onChange = function() {
            dummyIndent = Math.round(sldInd.value);
            txtInd.text = String(dummyIndent);
            updateRandomSummaryLabel();
        };
        txtInd.onChange = function() {
            var v = parseInt(txtInd.text, 10);
            if (isNaN(v)) v = 0;
            sldInd.value = v;
            dummyIndent = v;
            updateRandomSummaryLabel();
        };

        // ---------------------------------------------------------------------
        // 7. MAIN BUILD LOGIC (Execute Pipeline)
        // ---------------------------------------------------------------------
        btnBuild.onClick = function() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("AE Text Highlight Comp", 1920, 1080, 1, 10, 30);
            }
            if (!comp) return;

            if (comp && typeof comp.openInViewer === "function") {
                try { comp.openInViewer(); } catch(eOpen) {}
            }

            if (app.beginUndoGroup) app.beginUndoGroup("AE Text Highlight Build");
            try {
                var textLayer = getSelectedTextLayer(comp);
                var textLayerName = "";

                // Scenario A: No text layer selected -> auto-generate randomized ~100-word dummy text layer
                if (!textLayer) {
                    var isDemo = (txtHighlights.text.indexOf("Slow living") !== -1 || txtHighlights.text.indexOf("present moment") !== -1);
                    var sampleText = isDemo
                        ? SLOW_LIVING_QUOTE
                        : wordWrapToBoxWidth(LOREM_IPSUM_RAW, dummyBoxWidth, 34, dummyFont, dummyIndent);

                    var activeFont = isDemo ? "Georgia" : dummyFont;
                    var activeAlign = isDemo ? "left" : dummyAlignment;

                    textLayerName = isDemo ? "Slow Living Quote" : ("Dummy Text - " + activeFont + " (" + activeAlign + ")");
                    textLayer = comp.layers.addText(sampleText);
                    textLayer.name = textLayerName;

                    // Setup font styling
                    try {
                        var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
                        var textDocProp = textProp ? (textProp.property("ADBE Text Document") || textProp.property("Source Text")) : textLayer.property("Source Text");
                        if (textDocProp) {
                            var doc = textDocProp.value;
                            if (typeof TextDocument !== "undefined" && doc instanceof TextDocument) {
                                doc.fontSize = 34;
                                doc.font = activeFont;
                                doc.fillColor = COLOR_TEXT_DARK;
                                doc.applyFill = true;
                                doc.applyStroke = false;
                                if (typeof ParagraphJustification !== "undefined") {
                                    doc.justification = (activeAlign === "center")
                                        ? ParagraphJustification.CENTER_JUSTIFY
                                        : ((activeAlign === "right") ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
                                } else {
                                    doc.justification = (activeAlign === "center") ? 7414 : ((activeAlign === "right") ? 7413 : 7412);
                                }
                                try {
                                    if (typeof doc.setBoxTextSize === "function") {
                                        doc.setBoxTextSize([dummyBoxWidth, 450]);
                                    }
                                } catch (eBox) {}
                                textDocProp.setValue(doc);
                            } else {
                                textLayer.fontSize = 34;
                                textLayer.fontFamily = activeFont;
                                textLayer.fontColor = COLOR_TEXT_DARK;
                                textLayer.justification = activeAlign;
                            }
                        }
                    } catch(eText) {
                        textLayer.fontSize = 34;
                        textLayer.fontFamily = activeFont;
                    }

                    // Center composition placement based on alignment & box width
                    var posX = 260;
                    if (activeAlign === "center") {
                        posX = comp.width / 2;
                    } else if (activeAlign === "right") {
                        posX = comp.width / 2 + (dummyBoxWidth / 2);
                    } else {
                        posX = Math.max(120, (comp.width - dummyBoxWidth) / 2);
                    }
                    textLayer.transform.position.setValue([posX, 200, 0]);
                } else {
                    textLayerName = textLayer.name;
                }

                // Scenario B: Vector Highlight Shape Layer Creation
                var shapeLayerName = textLayerName + " - Highlights";
                var oldShape = findLayerByName(comp, shapeLayerName);
                if (oldShape) {
                    try { oldShape.remove(); } catch(eRem) {}
                }

                var shapeLayer = comp.layers.addShape();
                shapeLayer.name = shapeLayerName;

                // Add Master Expression Controls ON THE SHAPE LAYER
                addOrUpdateEffectSlider(shapeLayer, "Thickness Y", currentThickness);
                addOrUpdateEffectSlider(shapeLayer, "Padding X", currentPaddingX);
                addOrUpdateEffectSlider(shapeLayer, "Roundness", currentRoundness);
                addOrUpdateEffectSlider(shapeLayer, "Offset X", currentOffsetX);
                addOrUpdateEffectSlider(shapeLayer, "Offset Y", currentOffsetY);
                addOrUpdateEffectColor(shapeLayer, "Highlight Color", currentHighlightColor);
                addOrUpdateEffectSlider(shapeLayer, "Highlight Opacity", currentOpacity);

                // Parse highlight targets
                var terms = parseHighlightTerms(txtHighlights.text);
                if (terms.length === 0) {
                    var rawStr = getTextLayerString(textLayer) || LOREM_IPSUM_RAW;
                    var autoTerms = extractRandomWordsAndSentence(rawStr);
                    terms = autoTerms.words.concat([autoTerms.sentence]);
                    txtHighlights.text = terms.join("\n");
                }

                // Build vector groups & zero-drift procedural expressions
                createHighlightGroups(
                    shapeLayer,
                    textLayer,
                    textLayerName,
                    terms,
                    currentPaddingX,
                    currentThickness,
                    currentRoundness,
                    currentHighlightColor,
                    currentOpacity,
                    currentOffsetX,
                    currentOffsetY
                );

                // Parent to text layer
                shapeLayer.parent = textLayer;
                shapeLayer.transform.position.setValue([0, 0, 0]);
                shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
                shapeLayer.transform.scale.setValue([100, 100, 100]);
                shapeLayer.transform.rotation.setValue(0);

                // Stacking: Place shape layer directly behind text layer
                try {
                    if (typeof shapeLayer.moveAfter === "function") {
                        shapeLayer.moveAfter(textLayer);
                    }
                } catch(eMove) {}

                // Optional: Make Precomp Out of Text Box (AE_Text_Precomp logic)
                var resultingLayer = textLayer;
                if (chkPrecomp && chkPrecomp.value) {
                    try {
                        var preLayer = precomposeTextBoxAndHighlights(comp, textLayer, shapeLayer);
                        if (preLayer) resultingLayer = preLayer;
                    } catch(ePre) {
                        alert("Precomp creation error: " + ePre.toString());
                    }
                }

                // Fresh UI selection & status refresh
                if (resultingLayer) {
                    try { resultingLayer.selected = true; } catch(eSel1) {}
                }
                updateSelectionStatus();

            } catch(err) {
                alert("Error building highlights at line " + (err.line || "unknown") + ":\n" + (err.message || err.toString()));
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        };

        btnUpdate.onClick = function() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return;

            var shapeLayer = null;
            var textLayer = getSelectedTextLayer(comp);
            if (textLayer) {
                shapeLayer = findLayerByName(comp, textLayer.name + " - Highlights");
            } else if (comp.selectedLayers && comp.selectedLayers.length > 0) {
                for (var s = 0; s < comp.selectedLayers.length; s++) {
                    var sl = comp.selectedLayers[s];
                    if (sl && sl.name && sl.name.indexOf(" - Highlights") !== -1) {
                        shapeLayer = sl;
                        break;
                    }
                }
            }
            if (!shapeLayer) {
                for (var i = 1; i <= comp.numLayers; i++) {
                    var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
                    if (l && l.name && l.name.indexOf(" - Highlights") !== -1) {
                        shapeLayer = l;
                        break;
                    }
                }
            }
            if (!shapeLayer) {
                alert("No highlight layer found in active composition.", SCRIPT_TITLE);
                return;
            }

            if (app.beginUndoGroup) app.beginUndoGroup("Update Highlight Layer Properties");
            try {
                addOrUpdateEffectSlider(shapeLayer, "Thickness Y", currentThickness);
                addOrUpdateEffectSlider(shapeLayer, "Padding X", currentPaddingX);
                addOrUpdateEffectSlider(shapeLayer, "Roundness", currentRoundness);
                addOrUpdateEffectSlider(shapeLayer, "Offset X", currentOffsetX);
                addOrUpdateEffectSlider(shapeLayer, "Offset Y", currentOffsetY);
                addOrUpdateEffectColor(shapeLayer, "Highlight Color", currentHighlightColor);
                addOrUpdateEffectSlider(shapeLayer, "Highlight Opacity", currentOpacity);
            } catch(e) {
                alert("Could not update Highlight Layer:\n" + e.toString(), SCRIPT_TITLE);
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        };

        // ---------------------------------------------------------------------
        // 8. INITIAL LAYOUT & WINDOW PRESENTATION
        // ---------------------------------------------------------------------
        updateSelectionStatus();
        updateRandomSummaryLabel();
        applyPreset("Hot Pink (Default)");

        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        }

        return win;
    }

    var scriptPanel = buildUI(thisObj);
    if (scriptPanel !== null) {
        if (scriptPanel instanceof Window) {
            scriptPanel.center();
            scriptPanel.show();
        } else {
            scriptPanel.layout.layout(true);
            scriptPanel.layout.resize();
        }
    }

})(this);
