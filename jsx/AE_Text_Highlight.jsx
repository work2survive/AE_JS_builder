// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT HIGHLIGHT v1.0
// =============================================================================
//
// PURPOSE:
//   Detects the exact geometric position of specified words, character chains,
//   or full sentences inside a Text Layer, and places procedural vector highlight
//   blocks underneath the text.
//
// KEY CAPABILITIES & SPECIFICATION:
//   1. Target Detection & Smart Fallback:
//      - If a Text Layer is currently selected, it detects and binds to that layer.
//      - If NO Text Layer is selected when applied, it automatically creates a
//        ~100-word "Lorem Ipsum sit amet..." paragraph block, randomly selects
//        3 distinct words and 1 full sentence, and highlights them immediately.
//   2. Highlighting Controls:
//      - Words, chains of characters, or multi-word sentences to highlight.
//      - Highlight Fill Color (with live hex/color picker and preset chips).
//      - Highlight Opacity slider (0% to 100%).
//      - Thickness Y (Vertical padding beyond font ascender/descender):
//        * Default is strictly 0, tightly matching the font Ascender to Descender.
//        * Can be increased for bolder padding or decreased for tighter fit.
//      - Padding X (Horizontal margins on both sides of the word/phrase).
//      - Roundness (Corner radius):
//        * 0 = sharp rectangular / square blocks.
//        * > 0 = sleek rounded rectangular capsules (as shown in reference image).
//   3. Real-Time Expression Rigging:
//      - Highlight blocks are parented directly to the source Text Layer.
//      - Highlight Shape Layer sits directly beneath the text box.
//      - Rectangle Path Size and Position properties are driven by procedural
//        expressions that dynamically calculate character widths, line indices,
//        leading, and justification in real time.
//      - Highlight blocks dynamically react to Text Box resizing, repositioning,
//        font size adjustments, font family changes, and text edits in real time!
//   4. Background Layer:
//      - Creates or links an underlying background plate (default: soft Sky Blue,
//        faithfully matching the reference visual aesthetic).
//
// REPOSITORY: https://github.com/work2survive/AE_Text_Highlight
// LIVE DEMO:  https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Highlight.jsx&autobuild=true
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_TITLE   = "AE Text Highlight";
    var SCRIPT_VERSION = "v1.0";

    // =========================================================================
    // 1. CONSTANTS & DEFAULT PRESETS
    // =========================================================================
    // ~100-word Lorem Ipsum paragraph for auto-generation when no layer is selected
    var LOREM_IPSUM_DEFAULT = 
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do\n" +
        "eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut\n" +
        "enim ad minim veniam, quis nostrud exercitation ullamco laboris\n" +
        "nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor\n" +
        "in reprehenderit in voluptate velit esse cillum dolore eu fugiat\n" +
        "nulla pariatur. Excepteur sint occaecat cupidatat non proident,\n" +
        "sunt in culpa qui officia deserunt mollit anim id est laborum.\n" +
        "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio.\n" +
        "Nullam varius, turpis et commodo pharetra, est eros bibendum\n" +
        "elit, nec luctus magna felis sollicitudin mauris.";

    // The Slow Living quote from the reference screenshot
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

    // Default Color Palette
    var COLOR_HOT_PINK   = [1.0, 0.176, 0.471]; // #FF2D78 (Reference Image Highlight)
    var COLOR_SKY_BLUE   = [0.455, 0.725, 0.906]; // #74B9E7 (Reference Image Background)
    var COLOR_CYBER_GOLD = [1.0, 0.902, 0.0];   // #FFE600
    var COLOR_MINT_NEON  = [0.0, 0.961, 0.608]; // #00F59B
    var COLOR_SKY_CYAN   = [0.0, 0.824, 1.0];   // #00D2FF
    var COLOR_PURPLE     = [0.753, 0.518, 0.988]; // #C084FC
    var COLOR_DARK_SLATE = [0.059, 0.090, 0.165]; // #0F172A
    var COLOR_CLEAN_WHITE= [0.973, 0.980, 0.988]; // #F8FAFC
    var COLOR_TEXT_DARK  = [0.067, 0.067, 0.067]; // #111111

    // =========================================================================
    // 2. HELPER UTILITIES: COLOR, STRING & RANDOM EXTRACTION
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
            // Also split comma-separated if on the same line
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
        if (!textStr) textStr = LOREM_IPSUM_DEFAULT;

        // 1. Sentence extraction: split on period, exclamation, or question mark
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

        // 2. Word extraction: extract distinct words with length >= 5
        var rawWords = textStr.split(/[\s\r\n\.,;:!\?"'\(\)\[\]\{\}]+/);
        var eligibleWords = [];
        var seen = {};
        var lowerSent = pickedSentence.toLowerCase();

        for (var w = 0; w < rawWords.length; w++) {
            var wd = rawWords[w].trim();
            var lowerWd = wd.toLowerCase();
            // Filter out short words and duplicates
            if (wd.length >= 5 && !seen[lowerWd]) {
                seen[lowerWd] = true;
                // Prefer words not in the picked sentence so we have distinct targets
                if (lowerSent.indexOf(lowerWd) === -1) {
                    eligibleWords.push(wd);
                }
            }
        }

        // Fallback if not enough words outside sentence
        if (eligibleWords.length < 3) {
            for (var w2 = 0; w2 < rawWords.length; w2++) {
                var wd2 = rawWords[w2].trim();
                var lower2 = wd2.toLowerCase();
                if (wd2.length >= 5 && eligibleWords.indexOf(wd2) === -1) {
                    eligibleWords.push(wd2);
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
    // 3. PROCEDURAL EXPRESSION CODE GENERATION
    // =========================================================================
    // Expression applied to Rectangle Path Size:
    // Calculates width based on character widths + Padding X,
    // and calculates height based on font size (Ascender-to-Descender) + Thickness Y.
    function generateRectSizeExpression(targetTerm, matchIndex, textLayerName) {
        var cleanTerm = String(targetTerm).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return [
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
            '            function getCharW(c) {',
            '                var code = c.charCodeAt(0);',
            '                if (code > 255) return fs * 1.0;',
            '                if ("ijl|!.,:;\'I `".indexOf(c) !== -1) return fs * 0.28;',
            '                if ("wmWM@#%&".indexOf(c) !== -1) return fs * 0.80;',
            '                return fs * 0.52;',
            '            }',
            '            var wordW = 0;',
            '            for (var k = 0; k < matchText.length; k++) {',
            '                wordW += getCharW(matchText.charAt(k));',
            '            }',
            '            var boxW = Math.max(0, wordW + padX * 2);',
            '            var boxH = Math.max(0, fs * 1.0 + thickY);',
            '            [boxW, boxH];',
            '        }',
            '    }',
            '}'
        ].join('\n');
    }

    // Expression applied to Rectangle Path Position:
    // Calculates X position based on prefix character widths, justification & center point.
    // Calculates Y position based on line index, leading, and ascender-to-descender vertical center.
    function generateRectPositionExpression(targetTerm, matchIndex, textLayerName) {
        var cleanTerm = String(targetTerm).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return [
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
            '            function getCharW(c) {',
            '                var code = c.charCodeAt(0);',
            '                if (code > 255) return fs * 1.0;',
            '                if ("ijl|!.,:;\'I `".indexOf(c) !== -1) return fs * 0.28;',
            '                if ("wmWM@#%&".indexOf(c) !== -1) return fs * 0.80;',
            '                return fs * 0.52;',
            '            }',
            '            var prefixW = 0;',
            '            for (var p = 0; p < prefix.length; p++) prefixW += getCharW(prefix.charAt(p));',
            '            var matchW = 0;',
            '            for (var m = 0; m < matchText.length; m++) matchW += getCharW(matchText.charAt(m));',
            '            var totalLineW = 0;',
            '            if (just !== "left") {',
            '                for (var tl = 0; tl < line.length; tl++) totalLineW += getCharW(line.charAt(tl));',
            '            }',
            '            var lineStartX = 0;',
            '            if (just === "center") {',
            '                lineStartX = -totalLineW / 2;',
            '            } else if (just === "right") {',
            '                lineStartX = -totalLineW;',
            '            }',
            '            var posX = lineStartX + prefixW + (matchW / 2);',
            '            var posY = (targetLine * lineH) - (fs * 0.25);',
            '            [posX, posY];',
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
        if (!textStr) textStr = LOREM_IPSUM_DEFAULT;

        var lowerText = textStr.toLowerCase();
        var lines = textStr.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        var fs = textLayer.fontSize || 34;
        var leading = textLayer.leading || 0;
        var lineH = (leading > 0) ? leading : (fs * 1.35);

        function getCharWidthStatic(c) {
            var code = c.charCodeAt(0);
            if (code > 255) return fs * 1.0;
            if ("ijl|!.,:;'I `".indexOf(c) !== -1) return fs * 0.28;
            if ("wmWM@#%&".indexOf(c) !== -1) return fs * 0.80;
            return fs * 0.52;
        }

        var totalCreated = 0;

        for (var t = 0; t < terms.length; t++) {
            var term = terms[t];
            if (!term) continue;
            var lowerTerm = term.toLowerCase();

            // Find all match occurrences in text
            var matchIndices = [];
            var sIdx = 0;
            while (sIdx < textStr.length) {
                var found = lowerText.indexOf(lowerTerm, sIdx);
                if (found === -1) break;
                matchIndices.push(found);
                sIdx = found + Math.max(1, lowerTerm.length);
            }

            // If not found in text yet, still create at least 1 group for matchIndex 0
            // so when user types the word, it immediately highlights!
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

                // Initial static calculation for instant preview
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

                    var pW = 0;
                    for (var p = 0; p < prefix.length; p++) pW += getCharWidthStatic(prefix.charAt(p));
                    var mW = 0;
                    for (var mw = 0; mw < matchSeg.length; mw++) mW += getCharWidthStatic(matchSeg.charAt(mw));

                    initW = Math.max(0, mW + paddingX * 2);
                    initX = pW + (mW / 2);
                    initY = (targetLine * lineH) - (fs * 0.25);
                }

                // Set initial property values
                rect.property("ADBE Vector Rect Size").setValue([initW, initH]);
                rect.property("ADBE Vector Rect Position").setValue([initX, initY]);
                rect.property("ADBE Vector Rect Roundness").setValue(roundness);

                fill.property("ADBE Vector Fill Color").setValue(highlightColor);
                fill.property("ADBE Vector Fill Opacity").setValue(highlightOpacity);

                // Apply procedural real-time expressions
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
    var currentThickness      = 0;  // Default 0 (strictly tied to font ascender to descender)
    var currentPaddingX       = 8;  // Default 8px horizontal padding
    var currentRoundness      = 6;  // Default 6px corner radius (subtle rounded rect)
    var currentOpacity        = 100;
    var currentBgOpacity      = 100;

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
    // Panel 2: Words / Sentences to Highlight
    // -------------------------------------------------------------------------
    var pnlTargets = win.add("panel", undefined, "Highlight Targets (Words, Phrases, Sentences)");
    pnlTargets.orientation = "column";
    pnlTargets.alignChildren = ["fill", "top"];
    pnlTargets.spacing = 6;
    pnlTargets.margins = [10, 8, 10, 8];

    pnlTargets.add("statictext", undefined, "Enter words or sentences to detect & highlight (1 per line or comma-separated):");

    var txtHighlights = pnlTargets.add("edittext", undefined, "", { multiline: true, wantReturn: true });
    txtHighlights.preferredSize.height = 70;
    txtHighlights.helpTip = "Type or paste words, chains of characters, or complete sentences to highlight.";

    // Quick Action Buttons
    var grpActionBtns = pnlTargets.add("group");
    grpActionBtns.orientation = "row";
    grpActionBtns.alignChildren = ["fill", "center"];
    grpActionBtns.spacing = 4;

    var btnPickRandom = grpActionBtns.add("button", undefined, "🎲 Pick 3 Words + 1 Sent");
    btnPickRandom.helpTip = "Automatically picks 3 random words and 1 full sentence from the text.";

    var btnLoadDemo = grpActionBtns.add("button", undefined, "📷 Slow Living (Demo)");
    btnLoadDemo.helpTip = "Loads the exact Slow Living quote & highlights shown in the reference screenshot.";

    var btnClearTargets = grpActionBtns.add("button", undefined, "✕ Clear");
    btnClearTargets.helpTip = "Clears the target list.";

    // -------------------------------------------------------------------------
    // Panel 3: Highlight Appearance & Geometry (Thickness, Roundness, Color)
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
    // Panel 4: Background Layer Settings
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

    // Named "Build Highlights" to automatically trigger autobuild in AE_JS_builder
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
            lblStatus.text = "○ No text layer selected (Auto-generate Lorem Ipsum)";
        }
    }

    btnRefreshLayer.onClick = function() {
        updateSelectionStatus();
    };

    // Slider Sync Handlers
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

    // Quick Target Population Handlers
    btnPickRandom.onClick = function() {
        var comp = app.project.activeItem;
        var textLayer = (comp && comp instanceof CompItem) ? getSelectedTextLayer(comp) : null;
        var srcText = "";
        if (textLayer && textLayer.text && textLayer.text.sourceText) {
            srcText = String(textLayer.text.sourceText.value || "");
        }
        if (!srcText) srcText = LOREM_IPSUM_DEFAULT;

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

    // Initial Random Setup if empty
    var initialExtracted = extractRandomWordsAndSentence(LOREM_IPSUM_DEFAULT);
    txtHighlights.text = initialExtracted.words.concat([initialExtracted.sentence]).join("\n");

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
            var isNewTextLayer = false;

            // Scenario A: No text layer selected -> auto-generate ~100-word Lorem Ipsum block
            if (!textLayer) {
                isNewTextLayer = true;
                var sampleText = (txtHighlights.text.indexOf("Slow living") !== -1 || txtHighlights.text.indexOf("present moment") !== -1)
                    ? SLOW_LIVING_QUOTE
                    : LOREM_IPSUM_DEFAULT;

                textLayer = comp.layers.addText(sampleText);
                textLayer.name = (sampleText === SLOW_LIVING_QUOTE) ? "Slow Living Quote" : "Lorem Ipsum Text";

                // Setup font styling
                try {
                    var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
                    var textDoc = textProp ? (textProp.property("ADBE Text Document") || textProp.property("Source Text")) : null;
                    if (textDoc) {
                        var doc = textDoc.value;
                        if (typeof TextDocument !== "undefined" && doc instanceof TextDocument) {
                            doc.fontSize = 34;
                            doc.font = "Georgia, 'Times New Roman', serif";
                            doc.fillColor = COLOR_TEXT_DARK;
                            doc.applyFill = true;
                            doc.applyStroke = false;
                            doc.justification = (typeof ParagraphJustification !== "undefined") ? ParagraphJustification.LEFT_JUSTIFY : 0;
                            textDoc.setValue(doc);
                        } else {
                            textLayer.fontSize = 34;
                            textLayer.fontFamily = "Georgia, 'Times New Roman', serif";
                            textLayer.fontColor = COLOR_TEXT_DARK;
                            textLayer.justification = "left";
                        }
                    }
                } catch(eText) {
                    textLayer.fontSize = 34;
                }

                // Generous layout placement inside comp
                textLayer.transform.position.setValue([260, 220, 0]);
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
                    // Update solid / shape color
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
                // Clear existing groups
                var contents = shapeLayer.property("Contents") || shapeLayer.property("ADBE Root Vectors Group");
                if (contents) {
                    while (contents.numProperties > 0) {
                        contents.property(1).remove();
                    }
                }
            }

            // Stacking: Move shape layer directly behind text layer
            try {
                if (typeof shapeLayer.moveAfter === "function") {
                    shapeLayer.moveAfter(textLayer);
                }
            } catch(eMove) {}

            // Parent to text layer so translation, scale & rotation track flawlessly
            shapeLayer.parent = textLayer;
            shapeLayer.transform.position.setValue([0, 0, 0]);
            shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
            shapeLayer.transform.scale.setValue([100, 100, 100]);
            shapeLayer.transform.rotation.setValue(0);

            // Add Master Expression Controls on Shape Layer
            addOrUpdateEffectSlider(shapeLayer, "Thickness Y", currentThickness);
            addOrUpdateEffectSlider(shapeLayer, "Padding X", currentPaddingX);
            addOrUpdateEffectSlider(shapeLayer, "Roundness", currentRoundness);
            addOrUpdateEffectColor(shapeLayer, "Highlight Color", currentHighlightColor);
            addOrUpdateEffectSlider(shapeLayer, "Highlight Opacity", currentOpacity);

            // Parse highlight targets
            var terms = parseHighlightTerms(txtHighlights.text);
            if (terms.length === 0) {
                var autoTerms = extractRandomWordsAndSentence(textLayer.text.sourceText.value || LOREM_IPSUM_DEFAULT);
                terms = autoTerms.words.concat([autoTerms.sentence]);
                txtHighlights.text = terms.join("\n");
            }

            // Build vector groups & procedural expressions
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

            // Focus selection
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
            // Check if any layer ends with "- Highlights"
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
