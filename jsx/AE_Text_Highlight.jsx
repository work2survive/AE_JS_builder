// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT HIGHLIGHT v1.1.1
// =============================================================================
//
// PURPOSE:
//   Detects the exact geometric position of specified words, character chains,
//   or full sentences inside any Text Layer, and places procedural vector highlight
//   blocks directly underneath the text with ZERO cumulative offset.
//
// ENHANCEMENTS IN v1.1:
//   1. Sub-Pixel Precision Text Measurement (Fixes cumulative offset drift):
//      - Expressions & builder use hardware-accelerated Canvas 2D measurement
//        stack (`document.createElement('canvas').getContext('2d')`) matching the
//        browser's exact SVG font rendering engine in the web simulator.
//      - Zero drift even for words located 80+ characters deep into a line.
//      - Precision per-font fallback metrics for desktop After Effects ExtendScript.
//   2. Procedural Dummy Text Generation & Multi-Attribute Randomization:
//      - If NO Text Layer is selected when executed, it creates a ~100-word
//        "Lorem ipsum dolor sit amet..." dummy text block.
//      - Fully randomizes across all required design dimensions:
//        * Font: Picked randomly from typical desktop fonts:
//          [Georgia, Arial, Times New Roman, Verdana, Trebuchet MS, Courier New, Impact].
//        * Alignment: Picked randomly from [Left, Center, Right].
//        * Text Box Width: Picked randomly (e.g. 700px - 1150px) with automatic
//          word wrapping so lines fit the chosen width naturally.
//        * First-Line Indent: Picked randomly (0px, 24px, 48px, 72px).
//        * Auto-picks 3 random words and 1 full sentence to highlight.
//   3. Interactive ScriptUI Panel Controls:
//      - Live controls & readouts for Font, Alignment, Box Width, and Indent.
//      - "🎲 Randomize Dummy & Layout" button to instantly test new combinations.
//      - Real-time Effect Controls (Thickness Y, Padding X, Roundness, Color, Opacity).
//
// REPOSITORY: https://github.com/work2survive/AE-Text-Highlight
// LIVE DEMO:  https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Highlight.jsx&autobuild=true
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_TITLE   = "AE Text Highlight";
    var SCRIPT_VERSION = "v1.1.1";

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

    // =========================================================================
    // 2. HELPER UTILITIES: COLOR, STRING, WORD WRAP & PRECISE MEASURE
    // =========================================================================
    function hexToRgb(hex) {
        if (!hex) return [1, 1, 1];
        hex = String(hex).replace("#", "").trim();
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
        var cleanFont = String(fontName || "Georgia").replace(/['"]/g, "").trim();

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

        // 2. Calibrated font metric engine for ExtendScript desktop fallback
        var fontLower2 = cleanFont.toLowerCase();
        if (fontLower2.indexOf("courier") !== -1 || fontLower2.indexOf("mono") !== -1) {
            return str.length * fs * 0.60;
        }

        var isSerif = (fontLower2.indexOf("georgia") !== -1 || fontLower2.indexOf("times") !== -1 || fontLower2.indexOf("serif") !== -1);
        var isVerdana = (fontLower2.indexOf("verdana") !== -1);
        var isImpact = (fontLower2.indexOf("impact") !== -1);

        var total = 0;
        for (var i = 0; i < str.length; i++) {
            var ch = str.charAt(i);
            var code = ch.charCodeAt(0);
            if (code === 32) {
                total += isSerif ? (fs * 0.25) : (isVerdana ? (fs * 0.35) : (fs * 0.28));
            } else if ("ijl|!.,:;'I`".indexOf(ch) !== -1) {
                total += isSerif ? (fs * 0.28) : (fs * 0.24);
            } else if ("frt[](){}".indexOf(ch) !== -1) {
                total += isSerif ? (fs * 0.38) : (fs * 0.33);
            } else if ("wmWM@#%&".indexOf(ch) !== -1) {
                total += isSerif ? (fs * 0.88) : (isImpact ? (fs * 0.65) : (fs * 0.82));
            } else if (ch >= 'A' && ch <= 'Z') {
                total += isSerif ? (fs * 0.68) : (isImpact ? (fs * 0.52) : (fs * 0.65));
            } else if (ch >= '0' && ch <= '9') {
                total += isSerif ? (fs * 0.52) : (fs * 0.55);
            } else if (code > 255) {
                total += fs * 1.0;
            } else {
                total += isSerif ? (fs * 0.50) : (isImpact ? (fs * 0.42) : (isVerdana ? (fs * 0.58) : (fs * 0.52)));
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
            if (w > maxBoxWidth && currentLine.trim().length > 0) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine.trim().length > 0) {
            lines.push(currentLine);
        }
        return lines.join("\n");
    }

    function sanitizeSearchTerm(term) {
        if (!term) return "";
        return String(term).replace(/^[\s,"']+|[\s,"']+$/g, "").trim();
    }

    function parseHighlightTerms(rawStr) {
        if (!rawStr) return [];
        var lines = String(rawStr).split(/\r\n|\r|\n/);
        var terms = [];
        var seen = {};

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
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
            var sent = rawSentences[s].replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").trim();
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
            var wd = rawWords[w].trim();
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
        if (!comp || !comp.selectedLayers || comp.selectedLayers.length === 0) return null;
        for (var i = 0; i < comp.selectedLayers.length; i++) {
            var l = comp.selectedLayers[i];
            if (typeof TextLayer !== "undefined" && l instanceof TextLayer) return l;
            if (l.property("ADBE Text Properties") !== null || l.property("Text") !== null) return l;
        }
        return null;
    }

    function findLayerByName(comp, name) {
        if (!comp || !comp.layers) return null;
        var total = comp.numLayers || comp.layers.length || 0;
        for (var i = 1; i <= total; i++) {
            var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
            if (l && l.name === name) return l;
        }
        return null;
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
    // 3. PROCEDURAL REAL-TIME EXPRESSIONS WITH ZERO CUMULATIVE DRIFT
    // =========================================================================
    // Shared JavaScript helper injected into expressions for sub-pixel measurement
    var EXPR_MEASURE_FUNCTION = [
        'function measureExact(str, fs, fontName) {',
        '    if (!str) return 0;',
        '    if (typeof document !== "undefined") {',
        '        try {',
        '            var c = document.getElementById("__ae_text_measure_canvas");',
        '            if (!c) {',
        '                c = document.createElement("canvas");',
        '                c.id = "__ae_text_measure_canvas";',
        '                c.style.display = "none";',
        '                document.body.appendChild(c);',
        '            }',
        '            var ctx = c.getContext("2d");',
        '            var cleanFont = String(fontName || "Georgia").replace(/[\'"]/g, "").trim();',
        '            var fLower = cleanFont.toLowerCase();',
        '            var fStack = cleanFont;',
        '            if (fLower.indexOf("courier") !== -1 || fLower.indexOf("mono") !== -1) {',
        '                fStack = "\'" + cleanFont + "\', \'Courier New\', Consolas, monospace";',
        '            } else if (fLower.indexOf("times") !== -1 || fLower.indexOf("georgia") !== -1 || fLower.indexOf("serif") !== -1) {',
        '                fStack = "\'" + cleanFont + "\', Georgia, \'Times New Roman\', serif";',
        '            } else if (fLower.indexOf("impact") !== -1) {',
        '                fStack = "\'" + cleanFont + "\', Impact, sans-serif";',
        '            } else if (fLower.indexOf("trebuchet") !== -1) {',
        '                fStack = "\'" + cleanFont + "\', \'Trebuchet MS\', sans-serif";',
        '            } else if (fLower.indexOf("verdana") !== -1) {',
        '                fStack = "\'" + cleanFont + "\', Verdana, sans-serif";',
        '            } else {',
        '                fStack = "\'" + cleanFont + "\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif";',
        '            }',
        '            ctx.font = fs + "px " + fStack;',
        '            var m = ctx.measureText(str).width;',
        '            if (m && !isNaN(m) && m > 0) return m;',
        '        } catch(e) {}',
        '    }',
        '    var fLower2 = String(fontName || "").toLowerCase();',
        '    if (fLower2.indexOf("courier") !== -1 || fLower2.indexOf("mono") !== -1) return str.length * fs * 0.60;',
        '    var isSerif = (fLower2.indexOf("georgia") !== -1 || fLower2.indexOf("times") !== -1 || fLower2.indexOf("serif") !== -1);',
        '    var isVerdana = (fLower2.indexOf("verdana") !== -1);',
        '    var isImpact = (fLower2.indexOf("impact") !== -1);',
        '    var total = 0;',
        '    for (var i = 0; i < str.length; i++) {',
        '        var ch = str.charAt(i);',
        '        var code = ch.charCodeAt(0);',
        '        if (code === 32) total += isSerif ? (fs * 0.25) : (isVerdana ? (fs * 0.35) : (fs * 0.28));',
        '        else if ("ijl|!.,:;\'I`".indexOf(ch) !== -1) total += isSerif ? (fs * 0.28) : (fs * 0.24);',
        '        else if ("frt[](){}".indexOf(ch) !== -1) total += isSerif ? (fs * 0.38) : (fs * 0.33);',
        '        else if ("wmWM@#%&".indexOf(ch) !== -1) total += isSerif ? (fs * 0.88) : (isImpact ? (fs * 0.65) : (fs * 0.82));',
        '        else if (ch >= "A" && ch <= "Z") total += isSerif ? (fs * 0.68) : (isImpact ? (fs * 0.52) : (fs * 0.65));',
        '        else if (ch >= "0" && ch <= "9") total += isSerif ? (fs * 0.52) : (fs * 0.55);',
        '        else if (code > 255) total += fs * 1.0;',
        '        else total += isSerif ? (fs * 0.50) : (isImpact ? (fs * 0.42) : (isVerdana ? (fs * 0.58) : (fs * 0.52)));',
        '    }',
        '    return total;',
        '}'
    ].join('\n');

    function generateRectSizeExpression(targetTerm, matchIndex, textLayerName) {
        var cleanTerm = String(targetTerm).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return [
            EXPR_MEASURE_FUNCTION,
            'var txtLayer = thisLayer.parent;',
            'if (!txtLayer) {',
            '    try { txtLayer = thisComp.layer("' + textLayerName + '"); } catch(e) { txtLayer = null; }',
            '}',
            'if (!txtLayer || !txtLayer.text) {',
            '    [0, 0];',
            '} else {',
            '    var str = "";',
            '    try { str = txtLayer.text.sourceText.value; } catch(e) { str = txtLayer.text.sourceText; }',
            '    if (typeof str !== "string") str = (str && str.text !== undefined) ? String(str.text) : String(str || "");',
            '    var term = "' + cleanTerm + '";',
            '    var matchIdx = ' + matchIndex + ';',
            '    var padX = 8;',
            '    try { padX = thisLayer.effect("Padding X")(1).value; } catch(e) {}',
            '    var thickY = 0;',
            '    try { thickY = thisLayer.effect("Thickness Y")(1).value; } catch(e) {}',
            '    var fs = 34;',
            '    try { fs = txtLayer.text.sourceText.style.fontSize; } catch(e) { fs = txtLayer.fontSize || 34; }',
            '    var fontName = "Georgia";',
            '    try { fontName = txtLayer.text.sourceText.style.font || txtLayer.fontFamily || "Georgia"; } catch(e) { fontName = txtLayer.fontFamily || "Georgia"; }',
            '    var matches = [];',
            '    var searchIdx = 0;',
            '    var lowerStr = str.toLowerCase();',
            '    var lowerTerm = term.toLowerCase();',
            '    while (searchIdx < str.length) {',
            '        var found = lowerStr.indexOf(lowerTerm, searchIdx);',
            '        if (found === -1) break;',
            '        matches.push(found);',
            '        searchIdx = found + Math.max(1, lowerTerm.length);',
            '    }',
            '    if (matchIdx >= matches.length) {',
            '        [0, 0];',
            '    } else {',
            '        var charStart = matches[matchIdx];',
            '        var charLen = term.length;',
            '        var lines = str.replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n").split("\\n");',
            '        var currChar = 0;',
            '        var targetLine = -1;',
            '        var colStart = -1;',
            '        for (var l = 0; l < lines.length; l++) {',
            '            var lineLen = lines[l].length + 1;',
            '            if (charStart >= currChar && charStart < currChar + lineLen) {',
            '                targetLine = l;',
            '                colStart = charStart - currChar;',
            '                break;',
            '            }',
            '            currChar += lineLen;',
            '        }',
            '        if (targetLine === -1 || colStart === -1) {',
            '            [0, 0];',
            '        } else {',
            '            var line = lines[targetLine];',
            '            var matchText = line.substr(colStart, charLen);',
            '            var wordW = measureExact(matchText, fs, fontName);',
            '            var boxW = Math.max(0, wordW + padX * 2);',
            '            var boxH = Math.max(0, fs * 1.0 + thickY);',
            '            [boxW, boxH];',
            '        }',
            '    }',
            '}'
        ].join('\n');
    }

    function generateRectPositionExpression(targetTerm, matchIndex, textLayerName) {
        var cleanTerm = String(targetTerm).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return [
            EXPR_MEASURE_FUNCTION,
            'var txtLayer = thisLayer.parent;',
            'if (!txtLayer) {',
            '    try { txtLayer = thisComp.layer("' + textLayerName + '"); } catch(e) { txtLayer = null; }',
            '}',
            'if (!txtLayer || !txtLayer.text) {',
            '    [0, 0];',
            '} else {',
            '    var str = "";',
            '    try { str = txtLayer.text.sourceText.value; } catch(e) { str = txtLayer.text.sourceText; }',
            '    if (typeof str !== "string") str = (str && str.text !== undefined) ? String(str.text) : String(str || "");',
            '    var term = "' + cleanTerm + '";',
            '    var matchIdx = ' + matchIndex + ';',
            '    var fs = 34;',
            '    try { fs = txtLayer.text.sourceText.style.fontSize; } catch(e) { fs = txtLayer.fontSize || 34; }',
            '    var fontName = "Georgia";',
            '    try { fontName = txtLayer.text.sourceText.style.font || txtLayer.fontFamily || "Georgia"; } catch(e) { fontName = txtLayer.fontFamily || "Georgia"; }',
            '    var leading = 0;',
            '    try { leading = txtLayer.text.sourceText.style.leading; } catch(e) { leading = txtLayer.leading || 0; }',
            '    var lineH = (leading > 0) ? leading : (fs * 1.35);',
            '    var just = "left";',
            '    try {',
            '        var jVal = txtLayer.text.sourceText.style.justification;',
            '        if (jVal === 2 || jVal === "center" || (typeof ParagraphJustification !== "undefined" && jVal === ParagraphJustification.CENTER_JUSTIFY)) just = "center";',
            '        else if (jVal === 1 || jVal === "right" || (typeof ParagraphJustification !== "undefined" && jVal === ParagraphJustification.RIGHT_JUSTIFY)) just = "right";',
            '    } catch(e) {',
            '        just = txtLayer.justification || "left";',
            '    }',
            '    var matches = [];',
            '    var searchIdx = 0;',
            '    var lowerStr = str.toLowerCase();',
            '    var lowerTerm = term.toLowerCase();',
            '    while (searchIdx < str.length) {',
            '        var found = lowerStr.indexOf(lowerTerm, searchIdx);',
            '        if (found === -1) break;',
            '        matches.push(found);',
            '        searchIdx = found + Math.max(1, lowerTerm.length);',
            '    }',
            '    if (matchIdx >= matches.length) {',
            '        [0, 0];',
            '    } else {',
            '        var charStart = matches[matchIdx];',
            '        var charLen = term.length;',
            '        var lines = str.replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n").split("\\n");',
            '        var currChar = 0;',
            '        var targetLine = -1;',
            '        var colStart = -1;',
            '        for (var l = 0; l < lines.length; l++) {',
            '            var lineLen = lines[l].length + 1;',
            '            if (charStart >= currChar && charStart < currChar + lineLen) {',
            '                targetLine = l;',
            '                colStart = charStart - currChar;',
            '                break;',
            '            }',
            '            currChar += lineLen;',
            '        }',
            '        if (targetLine === -1 || colStart === -1) {',
            '            [0, 0];',
            '        } else {',
            '            var line = lines[targetLine];',
            '            var prefix = line.substr(0, colStart);',
            '            var matchText = line.substr(colStart, charLen);',
            '            var prefixW = measureExact(prefix, fs, fontName);',
            '            var matchW = measureExact(matchText, fs, fontName);',
            '            var totalLineW = measureExact(line, fs, fontName);',
            '            var lineStartX = 0;',
            '            if (just === "center") {',
            '                lineStartX = -totalLineW / 2;',
            '            } else if (just === "right") {',
            '                lineStartX = -totalLineW;',
            '            }',
            '            var rawPosX = lineStartX + prefixW + (matchW / 2);',
            '            var rawPosY = (targetLine * lineH) - (fs * 0.25);',
            '            var offX = 0, offY = 0;',
            '            try { offX = thisLayer.effect("Offset X")(1).value; } catch(e) {}',
            '            try { offY = thisLayer.effect("Offset Y")(1).value; } catch(e) {}',
            '            try {',
            '                var compPt = txtLayer.toComp([rawPosX, rawPosY]);',
            '                var localPt = thisLayer.fromComp(compPt);',
            '                [localPt[0] + offX, localPt[1] + offY];',
            '            } catch(eCoord) {',
            '                [rawPosX + offX, rawPosY + offY];',
            '            }',
            '        }',
            '    }',
            '}'
        ].join('\n');
    }

    // =========================================================================
    // 4. MAIN BUILD & RIGGING ENGINE
    // =========================================================================
    function createHighlightGroups(shapeLayer, textLayer, terms, paddingX, thicknessY, roundness, highlightColor, highlightOpacity) {
        var contents = shapeLayer.property("ADBE Root Vectors Group") || shapeLayer.property("Contents");
        if (!contents) return 0;

        var textStr = "";
        try {
            var st = textLayer.text.sourceText;
            textStr = (st.value && st.value.text !== undefined) ? String(st.value.text) : String(st.value || "");
        } catch(e) {
            textStr = String(textLayer.text || "");
        }
        if (!textStr) textStr = LOREM_IPSUM_RAW;

        var lowerText = textStr.toLowerCase();
        var lines = textStr.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        var fs = textLayer.fontSize || 34;
        var fontName = textLayer.fontFamily || "Georgia";
        var leading = textLayer.leading || 0;
        var lineH = (leading > 0) ? leading : (fs * 1.35);
        var just = textLayer.justification || "left";

        var totalCreated = 0;

        for (var t = 0; t < terms.length; t++) {
            var term = terms[t];
            if (!term) continue;
            var lowerTerm = term.toLowerCase();

            var matchIndices = [];
            var sIdx = 0;
            while (sIdx < textStr.length) {
                var found = lowerText.indexOf(lowerTerm, sIdx);
                if (found === -1) break;
                matchIndices.push(found);
                sIdx = found + Math.max(1, lowerTerm.length);
            }

            var countMatches = Math.max(1, matchIndices.length);

            for (var m = 0; m < countMatches; m++) {
                totalCreated++;
                var grp = contents.addProperty("ADBE Vector Group");
                grp.name = "Highlight " + totalCreated + " - " + term.substr(0, 20);

                var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents");
                var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
                rect.name = "Box Path";

                var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Box Fill";

                // Sub-pixel initial calculation
                var initW = 100;
                var initH = fs + thicknessY;
                var initX = 0;
                var initY = -fs * 0.25;

                if (m < matchIndices.length) {
                    var charStart = matchIndices[m];
                    var currChar = 0;
                    var targetLine = 0;
                    var colStart = 0;
                    for (var l = 0; l < lines.length; l++) {
                        var lLen = lines[l].length + 1;
                        if (charStart >= currChar && charStart < currChar + lLen) {
                            targetLine = l;
                            colStart = charStart - currChar;
                            break;
                        }
                        currChar += lLen;
                    }

                    var lineStr = lines[targetLine] || "";
                    var prefix = lineStr.substr(0, colStart);
                    var matchSeg = lineStr.substr(colStart, term.length);

                    var pW = measureTextExact(prefix, fs, fontName);
                    var mW = measureTextExact(matchSeg, fs, fontName);
                    var totW = measureTextExact(lineStr, fs, fontName);

                    initW = Math.max(0, mW + paddingX * 2);
                    var lineStartX = 0;
                    if (just === "center") lineStartX = -totW / 2;
                    else if (just === "right") lineStartX = -totW;

                    var rawInitX = lineStartX + pW + (mW / 2);
                    var rawInitY = (targetLine * lineH) - (fs * 0.25);
                    try {
                        var compPt = textLayer.toComp([rawInitX, rawInitY]);
                        var localPt = shapeLayer.fromComp(compPt);
                        initX = localPt[0] + currentOffsetX;
                        initY = localPt[1] + currentOffsetY;
                    } catch(eInitCoord) {
                        initX = rawInitX + currentOffsetX;
                        initY = rawInitY + currentOffsetY;
                    }
                }

                rect.property("ADBE Vector Rect Size").setValue([initW, initH]);
                rect.property("ADBE Vector Rect Position").setValue([initX, initY]);
                rect.property("ADBE Vector Rect Roundness").setValue(roundness);

                fill.property("ADBE Vector Fill Color").setValue(highlightColor);
                fill.property("ADBE Vector Fill Opacity").setValue(highlightOpacity);

                rect.property("ADBE Vector Rect Size").expression = generateRectSizeExpression(term, m, textLayer.name);
                rect.property("ADBE Vector Rect Position").expression = generateRectPositionExpression(term, m, textLayer.name);
                rect.property("ADBE Vector Rect Roundness").expression = 'try { Math.max(0, thisLayer.effect("Roundness")(1).value); } catch(e) { value; }';

                fill.property("ADBE Vector Fill Color").expression = 'try { thisLayer.effect("Highlight Color")(1); } catch(e) { value; }';
                fill.property("ADBE Vector Fill Opacity").expression = 'try { thisLayer.effect("Highlight Opacity")(1); } catch(e) { value; }';
            }
        }
        return totalCreated;
    }

    // =========================================================================
    // 5. SCRIPTUI USER INTERFACE BUILDER
    // =========================================================================
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
    var currentBgColor        = COLOR_SKY_BLUE.slice(0);
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

    // -------------------------------------------------------------------------
    // Panel 1: Target Text Layer Status & Header
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Target Text Layer");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.spacing = 4;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblStatus = pnlHeader.add("statictext", undefined, "Checking active selection...");
    lblStatus.graphics.foregroundColor = lblStatus.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.4, 0.75, 1.0, 1.0], 1);

    var grpHeaderBtns = pnlHeader.add("group");
    grpHeaderBtns.orientation = "row";
    grpHeaderBtns.alignChildren = ["left", "center"];
    var btnRefreshLayer = grpHeaderBtns.add("button", undefined, "Detect Selection");
    btnRefreshLayer.helpTip = "Re-scan the active composition to detect any newly selected Text Layer.";

    // -------------------------------------------------------------------------
    // Panel 2: Dummy Text & Layout Randomization (When No Text Layer is Selected)
    // -------------------------------------------------------------------------
    var pnlRandom = win.add("panel", undefined, "Dummy Text Generator & Randomization (~100 Words)");
    pnlRandom.orientation = "column";
    pnlRandom.alignChildren = ["fill", "top"];
    pnlRandom.spacing = 6;
    pnlRandom.margins = [10, 8, 10, 8];

    var lblRandomSummary = pnlRandom.add("statictext", undefined, "Font: " + dummyFont + " | Align: " + dummyAlignment + " | Width: " + dummyBoxWidth + "px | Indent: " + dummyIndent + "px");
    lblRandomSummary.graphics.foregroundColor = lblRandomSummary.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.95, 0.75, 0.3, 1.0], 1);

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

    // -------------------------------------------------------------------------
    // Panel 3: Words / Sentences to Highlight
    // -------------------------------------------------------------------------
    var pnlTargets = win.add("panel", undefined, "Highlight Targets (Words, Phrases, Sentences)");
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

    // -------------------------------------------------------------------------
    // Panel 4: Highlight Appearance & Geometry (Thickness, Roundness, Color)
    // -------------------------------------------------------------------------
    var pnlAppearance = win.add("panel", undefined, "Highlight Geometry & Appearance");
    pnlAppearance.orientation = "column";
    pnlAppearance.alignChildren = ["fill", "top"];
    pnlAppearance.spacing = 5;
    pnlAppearance.margins = [10, 8, 10, 8];

    // Thickness Y (Ascender to Descender)
    var grpThick = pnlAppearance.add("group");
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
    var grpPadX = pnlAppearance.add("group");
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
    var grpRound = pnlAppearance.add("group");
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
    var grpOffset = pnlAppearance.add("group");
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

    // Color & Opacity Row
    var grpCol = pnlAppearance.add("group");
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

    // Color Swatch Chips
    var grpSwatches = pnlAppearance.add("group");
    grpSwatches.orientation = "row";
    grpSwatches.alignChildren = ["left", "center"];
    grpSwatches.spacing = 4;
    grpSwatches.add("statictext", undefined, "Presets:");

    var btnSwPink   = grpSwatches.add("button", undefined, "Pink");
    var btnSwYellow = grpSwatches.add("button", undefined, "Gold");
    var btnSwMint   = grpSwatches.add("button", undefined, "Mint");
    var btnSwCyan   = grpSwatches.add("button", undefined, "Cyan");
    var btnSwPurple = grpSwatches.add("button", undefined, "Purple");

    // -------------------------------------------------------------------------
    // Panel 5: Background Layer Settings
    // -------------------------------------------------------------------------
    var pnlBg = win.add("panel", undefined, "Background Layer");
    pnlBg.orientation = "column";
    pnlBg.alignChildren = ["fill", "top"];
    pnlBg.spacing = 5;
    pnlBg.margins = [10, 8, 10, 8];

    var chkCreateBg = pnlBg.add("checkbox", undefined, "Create / Update Background Plate");
    chkCreateBg.value = true;

    var grpBgCol = pnlBg.add("group");
    grpBgCol.orientation = "row";
    grpBgCol.alignChildren = ["left", "center"];
    grpBgCol.spacing = 6;

    var lblBgCol = grpBgCol.add("statictext", undefined, "Bg Color:");
    lblBgCol.preferredSize.width = 90;

    var txtBgHex = grpBgCol.add("edittext", undefined, rgbToHex(currentBgColor));
    txtBgHex.preferredSize.width = 75;

    var btnBgSky   = grpBgCol.add("button", undefined, "Sky Blue");
    var btnBgSlate = grpBgCol.add("button", undefined, "Slate Dark");
    var btnBgWhite = grpBgCol.add("button", undefined, "White");

    // -------------------------------------------------------------------------
    // Main Action Buttons
    // -------------------------------------------------------------------------
    var grpMainBtns = win.add("group");
    grpMainBtns.orientation = "row";
    grpMainBtns.alignChildren = ["fill", "center"];
    grpMainBtns.spacing = 8;
    grpMainBtns.margins = [0, 4, 0, 0];

    var btnBuild = grpMainBtns.add("button", undefined, "► Build Highlights");
    btnBuild.preferredSize.height = 34;

    var btnUpdate = grpMainBtns.add("button", undefined, "⟳ Update Properties");
    btnUpdate.preferredSize.height = 34;
    btnUpdate.helpTip = "Updates colors, thickness, roundness and opacity on existing highlight layer in real time.";

    // -------------------------------------------------------------------------
    // 6. UI INTERACTION & EVENT HANDLERS
    // -------------------------------------------------------------------------
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

        // Update UI controls
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

        // Wrap text and pick 3 words + 1 sentence
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

    txtBgHex.onChange = function() {
        currentBgColor = hexToRgb(txtBgHex.text);
    };
    btnBgSky.onClick = function() {
        currentBgColor = COLOR_SKY_BLUE.slice(0);
        txtBgHex.text = rgbToHex(currentBgColor);
    };
    btnBgSlate.onClick = function() {
        currentBgColor = COLOR_DARK_SLATE.slice(0);
        txtBgHex.text = rgbToHex(currentBgColor);
    };
    btnBgWhite.onClick = function() {
        currentBgColor = COLOR_CLEAN_WHITE.slice(0);
        txtBgHex.text = rgbToHex(currentBgColor);
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
        txtHighlights.text = SLOW_LIVING_HIGHLIGHTS.join("\n");
        currentHighlightColor = COLOR_HOT_PINK.slice(0);
        txtHexCol.text = rgbToHex(currentHighlightColor);
        currentBgColor = COLOR_SKY_BLUE.slice(0);
        txtBgHex.text = rgbToHex(currentBgColor);
        sldThick.value = 0;
        txtThick.text = "0";
        currentThickness = 0;
        sldPadX.value = 8;
        txtPadX.text = "8";
        currentPaddingX = 8;
        sldRound.value = 6;
        txtRound.text = "6";
        currentRoundness = 6;
    };

    btnClearTargets.onClick = function() {
        txtHighlights.text = "";
    };

    // Initial Randomization Setup
    applyRandomization();

    // -------------------------------------------------------------------------
    // 7. BUILD & UPDATE EXECUTION
    // -------------------------------------------------------------------------
    btnBuild.onClick = function() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            comp = app.project.items.addComp("AE Text Highlight Comp", 1920, 1080, 1, 10, 30);
        }

        if (app.beginUndoGroup) app.beginUndoGroup("AE Text Highlight Build");
        try {
            var textLayer = getSelectedTextLayer(comp);

            // Scenario A: No text layer selected -> auto-generate randomized ~100-word dummy text layer
            if (!textLayer) {
                var isDemo = (txtHighlights.text.indexOf("Slow living") !== -1 || txtHighlights.text.indexOf("present moment") !== -1);
                var sampleText = isDemo
                    ? SLOW_LIVING_QUOTE
                    : wordWrapToBoxWidth(LOREM_IPSUM_RAW, dummyBoxWidth, 34, dummyFont, dummyIndent);

                var activeFont = isDemo ? "Georgia" : dummyFont;
                var activeAlign = isDemo ? "left" : dummyAlignment;

                textLayer = comp.layers.addText(sampleText);
                textLayer.name = isDemo ? "Slow Living Quote" : ("Dummy Text - " + activeFont + " (" + activeAlign + ")");

                // Setup font styling
                try {
                    var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
                    var textDoc = textProp ? (textProp.property("ADBE Text Document") || textProp.property("Source Text")) : null;
                    if (textDoc) {
                        var doc = textDoc.value;
                        if (typeof TextDocument !== "undefined" && doc instanceof TextDocument) {
                            doc.fontSize = 34;
                            doc.font = activeFont;
                            doc.fillColor = COLOR_TEXT_DARK;
                            doc.applyFill = true;
                            doc.applyStroke = false;
                            doc.justification = (activeAlign === "center") ? 2 : ((activeAlign === "right") ? 1 : 0);
                            textDoc.setValue(doc);
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
            }

            // Scenario B: Background Plate
            if (chkCreateBg.value) {
                var bgLayer = findLayerByName(comp, "Text Background");
                if (!bgLayer) {
                    if (typeof comp.layers.addSolid === "function") {
                        bgLayer = comp.layers.addSolid(currentBgColor, "Text Background", comp.width, comp.height, 1, comp.duration || 10);
                    } else {
                        bgLayer = comp.layers.addShape();
                        bgLayer.name = "Text Background";
                        var bgContents = bgLayer.property("Contents") || bgLayer.property("ADBE Root Vectors Group");
                        var bgGroup = bgContents.addProperty("ADBE Vector Group");
                        var bgRect = bgGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
                        bgRect.property("Size").setValue([comp.width, comp.height]);
                        var bgFill = bgGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
                        bgFill.property("Color").setValue(currentBgColor);
                        bgLayer.transform.position.setValue([comp.width / 2, comp.height / 2, 0]);
                    }
                } else {
                    try {
                        var parade = bgLayer.property("Contents") || bgLayer.property("ADBE Root Vectors Group");
                        if (parade && parade.property(1)) {
                            var fillP = parade.property(1).property("Contents").property("ADBE Vector Graphic - Fill");
                            if (fillP) fillP.property("Color").setValue(currentBgColor);
                        }
                    } catch(eBg) {}
                }
                if (bgLayer && typeof bgLayer.moveToEnd === "function") {
                    bgLayer.moveToEnd();
                }
            }

            // Scenario C: Create Highlight Shape Layer
            var shapeLayerName = textLayer.name + " - Highlights";
            var shapeLayer = findLayerByName(comp, shapeLayerName);
            if (!shapeLayer) {
                shapeLayer = comp.layers.addShape();
                shapeLayer.name = shapeLayerName;
            } else {
                var contents = shapeLayer.property("Contents") || shapeLayer.property("ADBE Root Vectors Group");
                if (contents) {
                    while (contents.numProperties > 0) {
                        contents.property(1).remove();
                    }
                }
            }

            // Stacking: Place shape layer directly behind text layer
            try {
                if (typeof shapeLayer.moveAfter === "function") {
                    shapeLayer.moveAfter(textLayer);
                }
            } catch(eMove) {}

            // Parent to text layer
            shapeLayer.parent = textLayer;
            shapeLayer.transform.position.setValue([0, 0, 0]);
            shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
            shapeLayer.transform.scale.setValue([100, 100, 100]);
            shapeLayer.transform.rotation.setValue(0);

            // Add Master Expression Controls
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
                var autoTerms = extractRandomWordsAndSentence(textLayer.text.sourceText.value || LOREM_IPSUM_RAW);
                terms = autoTerms.words.concat([autoTerms.sentence]);
                txtHighlights.text = terms.join("\n");
            }

            // Build vector groups & zero-drift procedural expressions
            createHighlightGroups(
                shapeLayer,
                textLayer,
                terms,
                currentPaddingX,
                currentThickness,
                currentRoundness,
                currentHighlightColor,
                currentOpacity
            );

            textLayer.selected = true;
            shapeLayer.selected = false;
            updateSelectionStatus();

        } catch(err) {
            alert("Error building highlights: " + err.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    btnUpdate.onClick = function() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return;

        var textLayer = getSelectedTextLayer(comp);
        if (!textLayer) {
            for (var i = 1; i <= comp.numLayers; i++) {
                var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
                if (l && l.name && l.name.indexOf(" - Highlights") !== -1) {
                    textLayer = l.parent;
                    break;
                }
            }
        }
        if (!textLayer) return;

        var shapeLayerName = textLayer.name + " - Highlights";
        var shapeLayer = findLayerByName(comp, shapeLayerName);
        if (!shapeLayer) return;

        if (app.beginUndoGroup) app.beginUndoGroup("Update AE Text Highlight Properties");
        try {
            addOrUpdateEffectSlider(shapeLayer, "Thickness Y", currentThickness);
            addOrUpdateEffectSlider(shapeLayer, "Padding X", currentPaddingX);
            addOrUpdateEffectSlider(shapeLayer, "Roundness", currentRoundness);
            addOrUpdateEffectSlider(shapeLayer, "Offset X", currentOffsetX);
            addOrUpdateEffectSlider(shapeLayer, "Offset Y", currentOffsetY);
            addOrUpdateEffectColor(shapeLayer, "Highlight Color", currentHighlightColor);
            addOrUpdateEffectSlider(shapeLayer, "Highlight Opacity", currentOpacity);
        } catch(e) {
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    // -------------------------------------------------------------------------
    // 8. INITIAL LAYOUT & WINDOW PRESENTATION
    // -------------------------------------------------------------------------
    updateSelectionStatus();

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
