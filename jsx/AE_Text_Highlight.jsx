// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT HIGHLIGHT v1.2.2
// =============================================================================
//
// PURPOSE:
//   Detects the exact geometric position of specified words, character chains,
//   or full sentences inside any Text Layer, and places procedural vector highlight
//   blocks directly underneath the text with ZERO cumulative offset.
//
// NEW IN v1.2.2:
//   1. Fixed Misplaced Highlight Coordinates:
//      - Added automatic Paragraph (Area / Box) Text detection and visual line wrapping.
//      - Integrated native sourceRectAtTime() origin tracking (sRect.left / sRect.top),
//        eliminating coordinate drift for text boxes with centered or custom anchor points.
//      - Implemented temporary hidden measurement layer for 100% exact sub-pixel After Effects
//        typography engine matching (resolves runaway horizontal offsets).
//      - Streamlined runtime expressions to evaluate instantly without frame-by-frame overhead.
//   2. Removed All Background Options:
//      - Completely removed Background Plate controls, presets, and layer generation logic.
//
// REPOSITORY: https://github.com/work2survive/AE-Text-Highlight
// LIVE DEMO:  https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Highlight.jsx&autobuild=true
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_TITLE    = "AE Text Highlight";
    var SCRIPT_VERSION  = "v1.2.2";
    var GITHUB_REPO_URL = "https://github.com/work2survive/AE-Text-Highlight";

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

    function getTextLayerDocument(layer) {
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

    function getTextLayerString(layer) {
        if (!layer) return "";
        try {
            var doc = getTextLayerDocument(layer);
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

        var textDoc = getTextLayerDocument(textLayer);
        var textStr = getTextLayerString(textLayer) || LOREM_IPSUM_RAW;

        var cleanTextStr = textStr.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        var lowerText = cleanTextStr.toLowerCase();

        var fs = 34;
        if (textDoc && textDoc.fontSize) fs = textDoc.fontSize;
        else if (textLayer.fontSize) fs = textLayer.fontSize;

        var fontName = "Georgia";
        if (textDoc && textDoc.font) fontName = textDoc.font;
        else if (textLayer.fontFamily) fontName = textLayer.fontFamily;

        var leading = 0;
        if (textDoc && textDoc.leading) leading = textDoc.leading;
        else if (textLayer.leading) leading = textLayer.leading;

        var just = "left";
        if (textDoc && textDoc.justification !== undefined) {
            var j = textDoc.justification;
            if (j === 2 || j === "center" || (typeof ParagraphJustification !== "undefined" && j === ParagraphJustification.CENTER_JUSTIFY)) just = "center";
            else if (j === 1 || j === "right" || (typeof ParagraphJustification !== "undefined" && j === ParagraphJustification.RIGHT_JUSTIFY)) just = "right";
        } else if (textLayer.justification) {
            just = textLayer.justification;
        }

        var sRect = null;
        try {
            sRect = textLayer.sourceRectAtTime(0, false);
        } catch(eRect) {}
        if (!sRect || sRect.width === 0 || sRect.height === 0) {
            sRect = { left: 0, top: 0, width: 1000, height: fs * 1.5 };
        }

        // Set up temporary hidden Point Text layer for 100% exact After Effects measurement
        var comp = textLayer.containingComp || (app.project && app.project.activeItem);
        var measureLayer = null;
        if (comp && typeof comp.layers.addText === "function") {
            try {
                measureLayer = comp.layers.addText("");
                measureLayer.enabled = false;
                if (textDoc && measureLayer.sourceText) {
                    measureLayer.sourceText.setValue(textDoc);
                }
            } catch(eMeas) {
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
                } catch(e) {}
            }
            return measureTextExact(str, fs, fontName);
        }

        // Decompose text into visual lines (handles both Point Text and Paragraph/Box Text)
        var visualLines = [];
        var explicitParagraphs = cleanTextStr.split("\n");
        var isBoxText = (textDoc && textDoc.boxText);
        var isMultiLine = (sRect.height > fs * 1.5 && explicitParagraphs.length <= 1);
        var wrapW = (textDoc && textDoc.boxTextSize && textDoc.boxTextSize[0] > 0)
            ? textDoc.boxTextSize[0]
            : (sRect ? sRect.width : 0);

        if ((isBoxText || isMultiLine) && wrapW > 0) {
            for (var p = 0; p < explicitParagraphs.length; p++) {
                var para = explicitParagraphs[p];
                if (!para || trimStr(para).length === 0) {
                    visualLines.push("");
                    continue;
                }
                var paraW = measureString(para);
                if (paraW <= wrapW) {
                    visualLines.push(para);
                    continue;
                }
                var words = para.split(/\s+/);
                var curLine = "";
                for (var w = 0; w < words.length; w++) {
                    var wd = words[w];
                    if (!wd) continue;
                    var testLine = (curLine.length === 0) ? wd : (curLine + " " + wd);
                    var testW = measureString(testLine);
                    if (testW > wrapW && curLine.length > 0) {
                        visualLines.push(curLine);
                        curLine = wd;
                    } else {
                        curLine = testLine;
                    }
                }
                if (curLine.length > 0) {
                    visualLines.push(curLine);
                }
            }
        } else {
            visualLines = explicitParagraphs;
        }

        // Map character positions of each visual line
        var lineStartIndices = [];
        var curIdx = 0;
        for (var l = 0; l < visualLines.length; l++) {
            lineStartIndices.push(curIdx);
            curIdx += visualLines[l].length + 1;
        }

        var totalLines = Math.max(1, visualLines.length);
        var linePitch = (leading > 0) ? leading : ((totalLines > 1) ? (sRect.height / totalLines) : (fs * 1.35));
        var topOrigin = sRect.top;
        var leftOrigin = sRect.left;
        var totalBoxW = sRect.width;

        var totalCreated = 0;

        for (var t = 0; t < terms.length; t++) {
            var term = terms[t];
            if (!term) continue;
            var lowerTerm = term.toLowerCase();

            var matchIndices = [];
            var sIdx = 0;
            while (sIdx < cleanTextStr.length) {
                var found = lowerText.indexOf(lowerTerm, sIdx);
                if (found === -1) break;
                matchIndices.push(found);
                sIdx = found + Math.max(1, lowerTerm.length);
            }

            var countMatches = Math.max(1, matchIndices.length);

            for (var m = 0; m < countMatches; m++) {
                if (m >= matchIndices.length) continue;
                var charStart = matchIndices[m];
                var matchEnd = charStart + term.length;

                // Decompose match across all intersecting visual lines
                for (var vl = 0; vl < visualLines.length; vl++) {
                    var lStart = lineStartIndices[vl];
                    var lEnd = lStart + visualLines[vl].length;
                    var oStart = Math.max(charStart, lStart);
                    var oEnd = Math.min(matchEnd, lEnd);
                    if (oStart >= oEnd) continue;

                    var colStart = oStart - lStart;
                    var segText = visualLines[vl].substr(colStart, oEnd - oStart);
                    if (trimStr(segText).length === 0) continue;

                    totalCreated++;
                    var grp = contents.addProperty("ADBE Vector Group");
                    grp.name = "Highlight " + totalCreated + " - " + segText.substr(0, 20);
                    var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents");

                    var lineStr = visualLines[vl];
                    var prefix = lineStr.substr(0, colStart);

                    var pW = measureString(prefix);
                    var mW = measureString(segText);
                    var totW = measureString(lineStr);

                    var lineStartX = leftOrigin;
                    if (just === "center") {
                        lineStartX = leftOrigin + (totalBoxW - totW) / 2;
                    } else if (just === "right") {
                        lineStartX = leftOrigin + totalBoxW - totW;
                    }

                    var wordCenterX = lineStartX + pW + (mW / 2);
                    var wordCenterY = topOrigin + (vl + 0.5) * linePitch;

                    var baseW = Math.max(0, mW);
                    var baseH = Math.max(0, fs);
                    var initW = Math.max(0, baseW + paddingX * 2);
                    var initH = Math.max(0, baseH + thicknessY);
                    var initX = wordCenterX + offX;
                    var initY = wordCenterY + offY;

                    // Add Rect and fully configure it
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

                    // Add Fill graphic
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
            }
        }

        // Clean up temporary measurement layer
        if (measureLayer) {
            try { measureLayer.remove(); } catch(eClean) {}
        }

        return totalCreated;
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
        pnlHeader.spacing = 2;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblTitle = pnlHeader.add("statictext", undefined, "🖊️ AE TEXT HIGHLIGHT " + SCRIPT_VERSION);
        try {
            lblTitle.graphics.font = ScriptUI.newFont("Verdana", "Bold", 13);
        } catch(eF) {}

        var lblDesc = pnlHeader.add("statictext", undefined, "Procedural Vector Text Highlights with Real-Time Bounding & Sync.");
        var lblInspired = pnlHeader.add("statictext", undefined, "Detects words & phrases with zero-drift procedural rigging.");

        // ---------------------------------------------------------------------
        // 2. PRESETS BAR
        // ---------------------------------------------------------------------
        var grpPreset = win.add("group");
        grpPreset.orientation = "row";
        grpPreset.alignChildren = ["left", "center"];
        grpPreset.spacing = 6;

        grpPreset.add("statictext", undefined, "Preset:");
        var dropPreset = grpPreset.add("dropdownlist", undefined, PRESET_NAMES);
        dropPreset.preferredSize = [230, 24];
        dropPreset.selection = 0;
        dropPreset.helpTip = "Choose from curated styling presets (Hot Pink, Neon Mint, Golden Glow, etc.)";

        var btnReloadPresets = grpPreset.add("button", undefined, "🔄");
        btnReloadPresets.maximumSize = [28, 24];
        btnReloadPresets.helpTip = "Reset preset parameters to defaults";

        // ---------------------------------------------------------------------
        // 3. TABBED CONTROLS
        // ---------------------------------------------------------------------
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.spacing = 4;
        tpanel.margins = 4;

        // ==========================================
        // TAB 1: TEXT BOX (Main Tab)
        // ==========================================
        var tabText = tpanel.add("tab", undefined, "📝 Text Box");
        tabText.orientation = "column";
        tabText.alignChildren = ["fill", "top"];
        tabText.spacing = 6;
        tabText.margins = [8, 8, 8, 8];

        // 1.1 Target Text Layer Status
        var pnlStatus = tabText.add("panel", undefined, "Target Text Layer");
        pnlStatus.orientation = "column";
        pnlStatus.alignChildren = ["fill", "top"];
        pnlStatus.spacing = 4;
        pnlStatus.margins = [10, 8, 10, 8];

        var lblStatus = pnlStatus.add("statictext", undefined, "Checking active selection...");
        try {
            lblStatus.graphics.foregroundColor = lblStatus.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.4, 0.75, 1.0, 1.0], 1);
        } catch(e) {}

        var grpHeaderBtns = pnlStatus.add("group");
        grpHeaderBtns.orientation = "row";
        grpHeaderBtns.alignChildren = ["left", "center"];
        var btnRefreshLayer = grpHeaderBtns.add("button", undefined, "Detect Selection");
        btnRefreshLayer.helpTip = "Re-scan active composition to detect any newly selected Text Layer.";

        // 1.2 Dummy Text Generator & Randomization
        var pnlRandom = tabText.add("panel", undefined, "Dummy Text Generator & Randomization (~100 Words)");
        pnlRandom.orientation = "column";
        pnlRandom.alignChildren = ["fill", "top"];
        pnlRandom.spacing = 6;
        pnlRandom.margins = [10, 8, 10, 8];

        var lblRandomSummary = pnlRandom.add("statictext", undefined, "Font: " + dummyFont + " | Align: " + dummyAlignment + " | Width: " + dummyBoxWidth + "px | Indent: " + dummyIndent + "px");
        try {
            lblRandomSummary.graphics.foregroundColor = lblRandomSummary.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.95, 0.75, 0.3, 1.0], 1);
        } catch(e) {}

        var grpRandBtns = pnlRandom.add("group");
        grpRandBtns.orientation = "row";
        grpRandBtns.alignChildren = ["fill", "center"];
        grpRandBtns.spacing = 4;

        var btnRandomizeAll = grpRandBtns.add("button", undefined, "🎲 Randomize Dummy & Layout");
        btnRandomizeAll.helpTip = "Randomizes font, alignment, text box width, indent, and picks 3 random words + 1 sentence.";

        // Font selection row
        var grpFontRow = pnlRandom.add("group");
        grpFontRow.orientation = "row";
        grpFontRow.alignChildren = ["left", "center"];
        grpFontRow.add("statictext", undefined, "Font:");
        var ddFont = grpFontRow.add("dropdownlist", undefined, TYPICAL_FONTS);
        ddFont.selection = 0;
        ddFont.preferredSize.width = 130;

        grpFontRow.add("statictext", undefined, "Align:");
        var ddAlign = grpFontRow.add("dropdownlist", undefined, ["Left", "Center", "Right"]);
        ddAlign.selection = 0;
        ddAlign.preferredSize.width = 80;

        // Box width & indent row
        var grpBoxRow = pnlRandom.add("group");
        grpBoxRow.orientation = "row";
        grpBoxRow.alignChildren = ["left", "center"];
        grpBoxRow.add("statictext", undefined, "Box Width:");
        var sldBoxW = grpBoxRow.add("slider", undefined, 950, 600, 1300);
        sldBoxW.preferredSize.width = 85;
        var txtBoxW = grpBoxRow.add("edittext", undefined, "950");
        txtBoxW.preferredSize.width = 45;
        grpBoxRow.add("statictext", undefined, "px");

        grpBoxRow.add("statictext", undefined, "Indent:");
        var sldInd = grpBoxRow.add("slider", undefined, 0, 0, 80);
        sldInd.preferredSize.width = 50;
        var txtInd = grpBoxRow.add("edittext", undefined, "0");
        txtInd.preferredSize.width = 30;
        grpBoxRow.add("statictext", undefined, "px");

        // 1.3 Highlight Targets
        var pnlTargets = tabText.add("panel", undefined, "Highlight Targets (Words, Phrases, Sentences)");
        pnlTargets.orientation = "column";
        pnlTargets.alignChildren = ["fill", "top"];
        pnlTargets.spacing = 6;
        pnlTargets.margins = [10, 8, 10, 8];

        pnlTargets.add("statictext", undefined, "Words or sentences to detect & highlight (1 per line or comma-separated):");

        var txtHighlights = pnlTargets.add("edittext", undefined, "", { multiline: true, wantReturn: true });
        txtHighlights.preferredSize.height = 65;
        txtHighlights.helpTip = "Type or paste words, chains of characters, or complete sentences to highlight.";

        var grpActionBtns = pnlTargets.add("group");
        grpActionBtns.orientation = "row";
        grpActionBtns.alignChildren = ["fill", "center"];
        grpActionBtns.spacing = 4;

        var btnPickRandom = grpActionBtns.add("button", undefined, "🎲 Re-Pick 3 Words + 1 Sent");
        btnPickRandom.helpTip = "Re-picks 3 random words and 1 full sentence from the current text.";

        var btnLoadDemo = grpActionBtns.add("button", undefined, "📷 Slow Living (Demo)");
        btnLoadDemo.helpTip = "Loads the exact Slow Living quote & highlights shown in the reference screenshot.";

        var btnClearTargets = grpActionBtns.add("button", undefined, "✕ Clear");
        btnClearTargets.helpTip = "Clears the target list.";

        // ==========================================
        // TAB 2: APPEARANCE
        // ==========================================
        var tabApp = tpanel.add("tab", undefined, "🎨 Appearance");
        tabApp.orientation = "column";
        tabApp.alignChildren = ["fill", "top"];
        tabApp.spacing = 6;
        tabApp.margins = [8, 8, 8, 8];

        // 2.1 Highlight Geometry & Offsets
        var pnlGeometry = tabApp.add("panel", undefined, "Highlight Geometry & Offsets");
        pnlGeometry.orientation = "column";
        pnlGeometry.alignChildren = ["fill", "top"];
        pnlGeometry.spacing = 5;
        pnlGeometry.margins = [10, 8, 10, 8];

        // Thickness Y (Ascender to Descender)
        var grpThick = pnlGeometry.add("group");
        grpThick.orientation = "row";
        grpThick.alignChildren = ["left", "center"];
        var lblThick = grpThick.add("statictext", undefined, "Thickness Y:");
        lblThick.preferredSize.width = 90;
        var sldThick = grpThick.add("slider", undefined, 0, -20, 60);
        sldThick.preferredSize.width = 110;
        var txtThick = grpThick.add("edittext", undefined, "0");
        txtThick.preferredSize.width = 45;
        grpThick.add("statictext", undefined, "px (0 = Ascender to Descender)");

        // Horizontal Padding X
        var grpPadX = pnlGeometry.add("group");
        grpPadX.orientation = "row";
        grpPadX.alignChildren = ["left", "center"];
        var lblPadX = grpPadX.add("statictext", undefined, "Padding X:");
        lblPadX.preferredSize.width = 90;
        var sldPadX = grpPadX.add("slider", undefined, 8, 0, 40);
        sldPadX.preferredSize.width = 110;
        var txtPadX = grpPadX.add("edittext", undefined, "8");
        txtPadX.preferredSize.width = 45;
        grpPadX.add("statictext", undefined, "px");

        // Roundness
        var grpRound = pnlGeometry.add("group");
        grpRound.orientation = "row";
        grpRound.alignChildren = ["left", "center"];
        var lblRound = grpRound.add("statictext", undefined, "Roundness:");
        lblRound.preferredSize.width = 90;
        var sldRound = grpRound.add("slider", undefined, 6, 0, 40);
        sldRound.preferredSize.width = 110;
        var txtRound = grpRound.add("edittext", undefined, "6");
        txtRound.preferredSize.width = 45;
        grpRound.add("statictext", undefined, "px (0 = Square blocks)");

        // Position Offset (X / Y)
        var grpOffset = pnlGeometry.add("group");
        grpOffset.orientation = "row";
        grpOffset.alignChildren = ["left", "center"];
        var lblOff = grpOffset.add("statictext", undefined, "Offset X / Y:");
        lblOff.preferredSize.width = 90;

        var sldOffX = grpOffset.add("slider", undefined, 0, -100, 100);
        sldOffX.preferredSize.width = 50;
        var txtOffX = grpOffset.add("edittext", undefined, "0");
        txtOffX.preferredSize.width = 32;

        var sldOffY = grpOffset.add("slider", undefined, 0, -100, 100);
        sldOffY.preferredSize.width = 50;
        var txtOffY = grpOffset.add("edittext", undefined, "0");
        txtOffY.preferredSize.width = 32;
        grpOffset.add("statictext", undefined, "px");

        // 2.2 Highlight Color & Opacity
        var pnlColor = tabApp.add("panel", undefined, "Highlight Color & Opacity");
        pnlColor.orientation = "column";
        pnlColor.alignChildren = ["fill", "top"];
        pnlColor.spacing = 5;
        pnlColor.margins = [10, 8, 10, 8];

        var grpCol = pnlColor.add("group");
        grpCol.orientation = "row";
        grpCol.alignChildren = ["left", "center"];
        grpCol.spacing = 6;

        var lblCol = grpCol.add("statictext", undefined, "Color / Opacity:");
        lblCol.preferredSize.width = 90;

        var txtHexCol = grpCol.add("edittext", undefined, rgbToHex(currentHighlightColor));
        txtHexCol.preferredSize.width = 75;

        var sldOp = grpCol.add("slider", undefined, 100, 0, 100);
        sldOp.preferredSize.width = 70;
        var txtOp = grpCol.add("edittext", undefined, "100");
        txtOp.preferredSize.width = 38;
        grpCol.add("statictext", undefined, "%");

        // Color Swatches
        var grpSwatches = pnlColor.add("group");
        grpSwatches.orientation = "row";
        grpSwatches.alignChildren = ["left", "center"];
        grpSwatches.spacing = 4;
        grpSwatches.add("statictext", undefined, "Presets:");

        var btnSwPink   = grpSwatches.add("button", undefined, "Pink");
        var btnSwYellow = grpSwatches.add("button", undefined, "Gold");
        var btnSwMint   = grpSwatches.add("button", undefined, "Mint");
        var btnSwCyan   = grpSwatches.add("button", undefined, "Cyan");
        var btnSwPurple = grpSwatches.add("button", undefined, "Purple");

        // Set Default Active Tab
        tpanel.selection = 0;

        // ---------------------------------------------------------------------
        // 4. MAIN ACTION BUTTONS (Full Width, At Bottom)
        // ---------------------------------------------------------------------
        var btnBuild = win.add("button", undefined, "🖊️ Create Highlight Layer");
        btnBuild.preferredSize.height = 36;
        btnBuild.helpTip = "Generates procedural vector highlight shape layer parented to the text layer.";

        var btnUpdate = win.add("button", undefined, "⟳ Update Selected Highlight Layer");
        btnUpdate.preferredSize.height = 28;
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

            txtHexCol.text = rgbToHex(currentHighlightColor);

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

            if (p.targets) {
                txtHighlights.text = p.targets.join("\n");
            }
        }

        dropPreset.onChange = function() {
            if (dropPreset.selection) {
                applyPreset(dropPreset.selection.text);
            }
        };

        btnReloadPresets.onClick = function() {
            dropPreset.selection = 0;
            applyPreset(PRESET_NAMES[0]);
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

        btnRefreshLayer.onClick = function() {
            updateSelectionStatus();
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

        txtHexCol.onChange = function() {
            currentHighlightColor = hexToRgb(txtHexCol.text);
        };

        btnSwPink.onClick = function() {
            currentHighlightColor = COLOR_HOT_PINK.slice(0);
            txtHexCol.text = rgbToHex(currentHighlightColor);
        };
        btnSwYellow.onClick = function() {
            currentHighlightColor = COLOR_CYBER_GOLD.slice(0);
            txtHexCol.text = rgbToHex(currentHighlightColor);
        };
        btnSwMint.onClick = function() {
            currentHighlightColor = COLOR_MINT_NEON.slice(0);
            txtHexCol.text = rgbToHex(currentHighlightColor);
        };
        btnSwCyan.onClick = function() {
            currentHighlightColor = COLOR_SKY_CYAN.slice(0);
            txtHexCol.text = rgbToHex(currentHighlightColor);
        };
        btnSwPurple.onClick = function() {
            currentHighlightColor = COLOR_PURPLE.slice(0);
            txtHexCol.text = rgbToHex(currentHighlightColor);
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

        // Initial Randomization Setup
        applyRandomization();

        // ---------------------------------------------------------------------
        // 7. BUILD & UPDATE EXECUTION
        // ---------------------------------------------------------------------
        btnBuild.onClick = function() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("AE Text Highlight Comp", 1920, 1080, 1, 10, 30);
            }
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
                                doc.justification = (activeAlign === "center") ? 2 : ((activeAlign === "right") ? 1 : 0);
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

                // Always ensure textLayer reference is fresh
                textLayer = findLayerByName(comp, textLayerName);
                if (!textLayer) {
                    throw new Error("Unable to locate Text Layer: " + textLayerName);
                }

                // Scenario C: Create Highlight Shape Layer
                var shapeLayerName = textLayerName + " - Highlights";
                var existingShape = findLayerByName(comp, shapeLayerName);
                if (existingShape) {
                    try { existingShape.remove(); } catch(eRem) {}
                    textLayer = findLayerByName(comp, textLayerName);
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

                // Fresh UI selection & status refresh
                var finalTxt = findLayerByName(comp, textLayerName);
                if (finalTxt) {
                    try { finalTxt.selected = true; } catch(eSel1) {}
                }
                var finalShape = findLayerByName(comp, shapeLayerName);
                if (finalShape) {
                    try { finalShape.selected = false; } catch(eSel2) {}
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

        if (win) {
            win.layout.layout(true);
            win.layout.resize();
            win.onResizing = win.onResize = function() {
                this.layout.resize();
            };
        }

        return win;
    }

    var scriptPanel = buildUI(thisObj);
    if (scriptPanel !== null && scriptPanel instanceof Window) {
        scriptPanel.center();
        scriptPanel.show();
    }

})(this);
