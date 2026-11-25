// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT HIGHLIGHT v3.0.2
// =============================================================================
//
// PURPOSE:
//   A lightweight, rock-solid procedural typography highlighter for Adobe After Effects.
//   Creates a non-destructive vector shape layer parented directly to your text layer,
//   pinpointing target words, multi-word phrases, or clauses with sub-pixel precision.
//
// KEY DESIGN PRINCIPLES (v3.0.2):
//   1. 100% Deterministic & Idempotent:
//      Running the script multiple times on the same layer cleanly updates the highlights.
//      No stacked duplicate layers, no orphaned helper layers.
//   2. Contextual Sample Words Picker:
//      Clicking "Sample Targets" dynamically inspects the selected text layer and picks
//      a couple of random words directly from its source text.
//   3. Zero Premature Layer Creation:
//      Zero layers or temp items are created on startup, window focus, or selection check.
//      Layers are created ONLY when the user explicitly clicks "Build Highlights".
//   4. Non-Destructive to Original Text:
//      Never mutates the original text layer's anchor point, position, scale, or orientation.
//      Highlights are parented to the text layer and compensate for the text's local anchor point.
//   5. Robust Multi-Word & Comma Support:
//      Highlights full sentences and phrases with internal commas (e.g. "peace of mind, body, and soul").
//
// REPOSITORY: https://github.com/work2survive/AE-Text-Highlight
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_TITLE   = "AE Text Highlight";
    var SCRIPT_VERSION = "v3.0.2";
    var GITHUB_URL     = "https://github.com/work2survive/AE-Text-Highlight";

    // Default target words (deterministic across all runs)
    var DEFAULT_TARGETS = [
        "Slow living",
        "peace of mind, body, and soul",
        "present moment",
        "balance"
    ];

    // -------------------------------------------------------------------------
    // 1. Core Composition & Layer Utilities
    // -------------------------------------------------------------------------

    function getActiveComposition() {
        if (app.project && app.project.activeItem && (app.project.activeItem instanceof CompItem || app.project.activeItem.layers)) {
            return app.project.activeItem;
        }
        if (app.project && app.project.items) {
            for (var i = 1; i <= app.project.items.length; i++) {
                var it = app.project.items[i];
                if (it && (it instanceof CompItem || it.layers)) {
                    if (it.selectedLayers && it.selectedLayers.length > 0) return it;
                }
            }
            for (var j = 1; j <= app.project.items.length; j++) {
                var it2 = app.project.items[j];
                if (it2 && (it2 instanceof CompItem || it2.layers)) return it2;
            }
        }
        return null;
    }

    function isTextLayer(layer) {
        if (!layer) return false;
        if (typeof TextLayer !== "undefined" && layer instanceof TextLayer) return true;
        if (layer.matchName === "ADBE Text Layer") return true;
        try {
            return Boolean(layer.property("ADBE Text Properties") || layer.property("Source Text"));
        } catch (e) {
            return false;
        }
    }

    function getSelectedTextLayer(comp) {
        if (!comp || !comp.selectedLayers || comp.selectedLayers.length === 0) return null;

        for (var i = 0; i < comp.selectedLayers.length; i++) {
            var l = comp.selectedLayers[i];
            if (isTextLayer(l)) return l;

            // If user clicked the highlight shape layer, resolve to its parent text layer
            if (l && l.parent && isTextLayer(l.parent)) {
                return l.parent;
            }
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // 2. Target Text Parsing
    // -------------------------------------------------------------------------

    function parseTargets(rawText) {
        if (!rawText || !rawText.length) return [];
        var lines = rawText.split(/\r\n|\r|\n|\|/);
        var list = [];
        for (var i = 0; i < lines.length; i++) {
            var str = lines[i];
            if (!str) continue;
            str = str.replace(/^\s+|\s+$/g, "");
            if (str.length === 0) continue;

            // If the user pasted a single comma-separated line without quotes or newlines
            if (lines.length === 1 && str.indexOf(",") !== -1 && str.indexOf('"') === -1) {
                var sub = str.split(",");
                for (var s = 0; s < sub.length; s++) {
                    var item = sub[s].replace(/^\s+|\s+$/g, "");
                    if (item.length > 0 && !containsString(list, item)) list.push(item);
                }
            } else {
                var clean = str.replace(/^["']|["']$/g, "").replace(/^\s+|\s+$/g, "");
                if (clean.length > 0 && !containsString(list, clean)) list.push(clean);
            }
        }
        return list;
    }

    function containsString(arr, val) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].toLowerCase() === val.toLowerCase()) return true;
        }
        return false;
    }

    /**
     * Extracts a couple of random distinct words from the source text
     */
    function pickRandomWordsFromText(fullText, count) {
        if (!fullText) return [];
        var allWords = fullText.match(/[A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF'-]{3,}/g);
        if (!allWords || allWords.length === 0) {
            allWords = fullText.match(/\S+/g) || [];
        }
        if (allWords.length === 0) return [];

        var unique = [];
        var seen = {};
        for (var i = 0; i < allWords.length; i++) {
            var w = allWords[i].replace(/^[^\w]+|[^\w]+$/g, "");
            var low = w.toLowerCase();
            if (w.length >= 2 && !seen[low]) {
                seen[low] = true;
                unique.push(w);
            }
        }
        if (unique.length === 0) unique = allWords;

        var targetCount = Math.min(count || 3, unique.length);
        var chosen = [];
        var copy = unique.slice(0);
        for (var c = 0; c < targetCount; c++) {
            var rIdx = Math.floor(Math.random() * copy.length);
            chosen.push(copy[rIdx]);
            copy.splice(rIdx, 1);
        }
        return chosen;
    }

    // -------------------------------------------------------------------------
    // 3. Highlight Clean-Up Engine (Idempotency)
    // -------------------------------------------------------------------------

    function removeExistingHighlights(comp, textLayer) {
        if (!comp || !textLayer) return 0;
        var count = 0;
        var total = comp.numLayers || (comp.layers ? comp.layers.length : 0);

        for (var i = total; i >= 1; i--) {
            var lyr = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
            if (!lyr) continue;

            var isChildHighlight = (lyr.parent === textLayer && (lyr.comment === "AE_TEXT_HIGHLIGHT" || lyr.name === (textLayer.name + " - Highlights")));
            if (isChildHighlight) {
                try {
                    lyr.remove();
                    count++;
                } catch (eR) {}
            }
        }

        // Clean up Text Animator if present
        try {
            var animators = textLayer.property("ADBE Text Properties").property("ADBE Text Animators");
            if (animators) {
                var colorAnim = animators.property("Highlight Text Color");
                if (colorAnim) colorAnim.remove();
            }
        } catch (eA) {}

        return count;
    }

    // -------------------------------------------------------------------------
    // 4. Sub-Pixel Word Bounding & Advance Calculation
    // -------------------------------------------------------------------------

    function calculateLineMatches(lineStr, terms) {
        var matches = [];
        var lowerLine = lineStr.toLowerCase();

        for (var t = 0; t < terms.length; t++) {
            var term = terms[t];
            if (!term || term.length === 0) continue;
            var lowerTerm = term.toLowerCase();
            var searchStart = 0;

            while (searchStart < lineStr.length) {
                var foundIdx = lowerLine.indexOf(lowerTerm, searchStart);
                if (foundIdx === -1) break;

                matches.push({
                    start: foundIdx,
                    end: foundIdx + term.length,
                    term: lineStr.substr(foundIdx, term.length)
                });
                searchStart = foundIdx + Math.max(1, term.length);
            }
        }

        matches.sort(function (a, b) { return a.start - b.start; });

        // Eliminate overlapping matches
        var clean = [];
        var lastEnd = 0;
        for (var m = 0; m < matches.length; m++) {
            if (matches[m].start >= lastEnd) {
                clean.push(matches[m]);
                lastEnd = matches[m].end;
            }
        }
        return clean;
    }

    function buildHighlightsRig(comp, textLayer, options) {
        if (!comp || !textLayer || !isTextLayer(textLayer)) return null;

        // Step 1: Clean up any prior highlight shapes for 100% consistent re-runs
        removeExistingHighlights(comp, textLayer);

        var terms = options.terms || [];
        if (terms.length === 0) {
            terms = DEFAULT_TARGETS;
        }

        var textDocProp = textLayer.property("Source Text");
        if (!textDocProp) {
            try { textDocProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document"); } catch (eTP) {}
        }
        var textDoc = textDocProp ? textDocProp.value : null;
        if (!textDoc) throw new Error("Could not access TextDocument on target layer.");

        var fullText = String(textDoc.text || "");
        var fontSize = Number(textDoc.fontSize) || 36;
        var leading = (textDoc.leading && !textDoc.autoLeading) ? Number(textDoc.leading) : (fontSize * 1.2);
        var sRect = textLayer.sourceRectAtTime(comp.time, false);

        var isBox = Boolean(textDoc.boxText && textDoc.boxTextSize);
        var boxWidth = isBox ? textDoc.boxTextSize[0] : sRect.width;
        var boxPos = (isBox && textDoc.boxTextPos) ? textDoc.boxTextPos : [0, 0];

        // Justification
        var just = "left";
        try {
            var jVal = textDoc.justification;
            if (jVal === 7414 || (typeof ParagraphJustification !== "undefined" && jVal === ParagraphJustification.CENTER_JUSTIFY)) {
                just = "center";
            } else if (jVal === 7413 || (typeof ParagraphJustification !== "undefined" && jVal === ParagraphJustification.RIGHT_JUSTIFY)) {
                just = "right";
            }
        } catch (eJ) {}

        // Original anchor point to compensate child position without moving textLayer
        var curA = [0, 0, 0];
        try {
            curA = textLayer.transform.anchorPoint.value;
        } catch (eA) {}
        var curAx = (curA && typeof curA[0] === "number") ? curA[0] : 0;
        var curAy = (curA && typeof curA[1] === "number") ? curA[1] : 0;

        // Step 2: Use ONE temporary measuring layer to measure word advances
        var measLayer = null;
        var measureAdvance = null;

        try {
            measLayer = comp.layers.addText("");
            measLayer.enabled = true;
            measLayer.transform.position.setValue([-9999, -9999, 0]);

            var mDocProp = measLayer.property("Source Text");
            var mDoc = mDocProp ? mDocProp.value : null;
            if (mDoc) {
                mDoc.fontSize = fontSize;
                if (textDoc.font) {
                    try { mDoc.font = textDoc.font; } catch (eF) {}
                }
                mDoc.tracking = textDoc.tracking || 0;
                mDoc.applyStroke = false;
                mDoc.applyFill = true;
                try { mDoc.boxText = false; } catch (eBT) {}
                try { mDocProp.setValue(mDoc); } catch (eDS) {}
            }

            measureAdvance = function (str) {
                if (!str || str.length === 0) return 0;
                if (mDoc && mDocProp) {
                    mDoc.text = str;
                    mDocProp.setValue(mDoc);
                } else if (mDocProp) {
                    mDocProp.setValue(str);
                }
                var r = measLayer.sourceRectAtTime(comp.time, false);
                return r ? r.width : 0;
            };

            // Measure isolated pipe for trailing-space-safe advance
            var pipeW = measureAdvance("|");

            var measurePrefix = function (prefixStr) {
                if (!prefixStr || prefixStr.length === 0) return 0;
                var totalW = measureAdvance(prefixStr + "|");
                return Math.max(0, totalW - pipeW);
            };

            // Step 3: Find visual lines and calculate highlight coordinates
            var rawLines = fullText.split(/\r\n|\r|\n/);
            var lines = [];

            if (!isBox || boxWidth <= 0) {
                lines = rawLines;
            } else {
                // Wrap words according to box width
                for (var p = 0; p < rawLines.length; p++) {
                    var pWords = rawLines[p].match(/\S+/g) || [];
                    if (pWords.length === 0) {
                        lines.push("");
                        continue;
                    }
                    var curLine = pWords[0];
                    var curW = measurePrefix(curLine);
                    for (var w = 1; w < pWords.length; w++) {
                        var testLine = curLine + " " + pWords[w];
                        var testW = measurePrefix(testLine);
                        if (testW > boxWidth && curLine.length > 0) {
                            lines.push(curLine);
                            curLine = pWords[w];
                            curW = measurePrefix(curLine);
                        } else {
                            curLine = testLine;
                            curW = testW;
                        }
                    }
                    lines.push(curLine);
                }
            }

            var highlightBoxes = [];

            for (var vl = 0; vl < lines.length; vl++) {
                var lineStr = lines[vl];
                if (!lineStr || lineStr.replace(/^\s+|\s+$/g, "").length === 0) continue;

                var lineTop = sRect.top + (vl * leading);
                var lineW = measurePrefix(lineStr);

                var lineLeft = 0;
                if (isBox) {
                    var bX = (boxPos && typeof boxPos[0] === "number") ? boxPos[0] : 0;
                    if (just === "center") {
                        lineLeft = bX + (boxWidth - lineW) / 2;
                    } else if (just === "right") {
                        lineLeft = bX + boxWidth - lineW;
                    } else {
                        lineLeft = bX;
                    }
                } else {
                    if (just === "center") {
                        lineLeft = -lineW / 2;
                    } else if (just === "right") {
                        lineLeft = -lineW;
                    } else {
                        lineLeft = 0;
                    }
                }

                var lineMatches = calculateLineMatches(lineStr, terms);

                for (var m = 0; m < lineMatches.length; m++) {
                    var match = lineMatches[m];
                    var prefix = lineStr.substring(0, match.start);
                    var prefixAdv = measurePrefix(prefix);
                    var fullAdv = measurePrefix(lineStr.substring(0, match.end));
                    var termW = Math.max(4, fullAdv - prefixAdv);

                    var centerXInText = lineLeft + prefixAdv + (termW / 2);
                    var centerYInText = lineTop + (fontSize / 2);

                    highlightBoxes.push({
                        term: match.term,
                        width: termW,
                        height: fontSize,
                        centerX: centerXInText - curAx,
                        centerY: centerYInText - curAy
                    });
                }
            }

        } finally {
            if (measLayer) {
                try { measLayer.remove(); } catch (eRem) {}
            }
        }

        if (highlightBoxes.length === 0) {
            return { shapeLayer: null, count: 0 };
        }

        // Step 4: Create Procedural Vector Shape Layer
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = textLayer.name + " - Highlights";
        shapeLayer.comment = "AE_TEXT_HIGHLIGHT";

        // Parent shape layer directly to original text layer with zero shift
        var is3D = Boolean(textLayer.threeDLayer);
        if (is3D) {
            try { shapeLayer.threeDLayer = true; } catch (e3D) {}
        }
        shapeLayer.parent = textLayer;
        shapeLayer.transform.position.setValue(is3D ? [0, 0, 0] : [0, 0]);
        shapeLayer.transform.anchorPoint.setValue(is3D ? [0, 0, 0] : [0, 0]);
        shapeLayer.transform.scale.setValue(is3D ? [100, 100, 100] : [100, 100]);
        if (shapeLayer.transform.rotation) shapeLayer.transform.rotation.setValue(0);

        // Add Master Slider Controls on Shape Layer
        var fxParade = shapeLayer.property("ADBE Effect Parade") || shapeLayer.property("Effects");
        function addCtrl(type, name, val) {
            var eff = fxParade.property(name) || fxParade.addProperty(type);
            if (eff) {
                eff.name = name;
                var p = eff.property(1);
                if (p) p.setValue(val);
            }
            return eff;
        }

        var hlColor = options.highlightColor || [1.0, 0.165, 0.427];
        var padX = (typeof options.paddingX === "number") ? options.paddingX : 8;
        var padY = (typeof options.paddingY === "number") ? options.paddingY : 4;
        var roundness = (typeof options.roundness === "number") ? options.roundness : 6;
        var opacity = (typeof options.opacity === "number") ? options.opacity : 100;

        addCtrl("ADBE Color Control", "Highlight Color", hlColor);
        addCtrl("ADBE Slider Control", "Padding X", padX);
        addCtrl("ADBE Slider Control", "Padding Y", padY);
        addCtrl("ADBE Slider Control", "Roundness", roundness);
        addCtrl("ADBE Slider Control", "Opacity", opacity);

        // Add Vector Shapes for each matched term
        var rootVectors = shapeLayer.property("ADBE Root Vectors Group") || shapeLayer.property("Contents");

        for (var b = 0; b < highlightBoxes.length; b++) {
            var box = highlightBoxes[b];
            var grp = rootVectors.addProperty("ADBE Vector Group");
            grp.name = "Highlight " + (b + 1) + " - " + box.term;

            var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents");
            var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
            rect.name = "Box Path";

            var baseW = box.width;
            var baseH = box.height;

            var propSize = rect.property("ADBE Vector Rect Size") || rect.property("Size");
            if (propSize) {
                propSize.setValue([baseW + (padX * 2), baseH + padY]);
                propSize.expression = [
                    'var px = 0, py = 0;',
                    'try { px = thisLayer.effect("Padding X")(1).value; } catch(e) {}',
                    'try { py = thisLayer.effect("Padding Y")(1).value; } catch(e) {}',
                    '[Math.max(0, ' + baseW.toFixed(2) + ' + px * 2), Math.max(0, ' + baseH.toFixed(2) + ' + py)];'
                ].join('\n');
            }

            var propPos = rect.property("ADBE Vector Rect Position") || rect.property("Position");
            if (propPos) {
                propPos.setValue([box.centerX, box.centerY]);
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
                propCol.setValue(hlColor);
                propCol.expression = 'try { thisLayer.effect("Highlight Color")(1).value; } catch(e) { value; }';
            }

            var propOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity");
            if (propOp) {
                propOp.setValue(opacity);
                propOp.expression = 'try { thisLayer.effect("Opacity")(1).value; } catch(e) { value; }';
            }
        }

        // Move highlight shape layer behind text layer
        try {
            if (typeof shapeLayer.moveAfter === "function") {
                shapeLayer.moveAfter(textLayer);
            }
        } catch (eM) {}

        // Step 5: Optional Text Color Tint via native AE Text Animator
        if (options.tintText) {
            try {
                var textPropGroup = textLayer.property("ADBE Text Properties");
                var animators = textPropGroup ? textPropGroup.property("ADBE Text Animators") : null;
                if (animators) {
                    var anim = animators.addProperty("ADBE Text Animator");
                    anim.name = "Highlight Text Color";

                    var animProps = anim.property("ADBE Text Animator Properties");
                    var fillProp = animProps ? animProps.addProperty("ADBE Text Fill Color") : null;
                    if (fillProp) {
                        fillProp.setValue(options.textColor || [1, 1, 1]);
                    }

                    var selectors = anim.property("ADBE Text Selectors");
                    if (selectors) {
                        for (var tIdx = 0; tIdx < terms.length; tIdx++) {
                            var tWord = terms[tIdx].toLowerCase();
                            var searchPos = 0;
                            var lowerFull = fullText.toLowerCase();

                            while (searchPos < fullText.length) {
                                var found = lowerFull.indexOf(tWord, searchPos);
                                if (found === -1) break;

                                var sel = selectors.addProperty("ADBE Text Selector");
                                sel.name = "Target: " + terms[tIdx];

                                var pStart = sel.property("ADBE Text Percent Start") || sel.property("Start");
                                var pEnd = sel.property("ADBE Text Percent End") || sel.property("End");
                                var pUnits = sel.property("ADBE Text Range Type2") || sel.property("Units");

                                if (pUnits) {
                                    try { pUnits.setValue(2); } catch (eU) {} // 2 = Index (characters)
                                }
                                if (pStart) pStart.setValue(found);
                                if (pEnd) pEnd.setValue(found + tWord.length);

                                searchPos = found + Math.max(1, tWord.length);
                            }
                        }
                    }
                }
            } catch (eTint) {}
        }

        return {
            shapeLayer: shapeLayer,
            count: highlightBoxes.length
        };
    }

    // -------------------------------------------------------------------------
    // 5. ScriptUI User Interface
    // -------------------------------------------------------------------------

    function buildUI(thisObj) {
        var isDockable = (thisObj instanceof Panel);
        var win = isDockable ? thisObj : new Window("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 12;

        // --- Status Header ---
        var grpStatus = win.add("group");
        grpStatus.orientation = "row";
        grpStatus.alignChildren = ["fill", "center"];

        var lblStatus = grpStatus.add("statictext", undefined, "🎯 Target: Checking selection...");
        lblStatus.alignment = ["fill", "center"];

        var btnRefresh = grpStatus.add("button", undefined, "🔄 Refresh");
        btnRefresh.alignment = ["right", "center"];
        btnRefresh.preferredSize.width = 75;

        // --- Targets Section ---
        var lblTargets = win.add("statictext", undefined, "Words or phrases to highlight (1 per line):");
        var txtTargets = win.add("edittext", undefined, DEFAULT_TARGETS.join("\n"), { multiline: true, wantReturn: true });
        txtTargets.preferredSize.height = 80;

        var grpQuick = win.add("group");
        grpQuick.orientation = "row";
        grpQuick.alignChildren = ["left", "center"];
        var btnSample = grpQuick.add("button", undefined, "Sample Targets");
        var btnClear = grpQuick.add("button", undefined, "Clear");

        btnSample.onClick = function () {
            var comp = getActiveComposition();
            var textLayer = comp ? getSelectedTextLayer(comp) : null;
            var fullText = "";
            if (textLayer) {
                var docProp = textLayer.property("Source Text");
                if (!docProp) {
                    try { docProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document"); } catch (eTP) {}
                }
                if (docProp && docProp.value) {
                    fullText = String(docProp.value.text || "");
                }
            }

            var picked = pickRandomWordsFromText(fullText, 3);
            if (picked.length > 0) {
                txtTargets.text = picked.join("\n");
            } else {
                txtTargets.text = DEFAULT_TARGETS.join("\n");
            }
        };
        btnClear.onClick = function () {
            txtTargets.text = "";
        };

        // --- Settings Panel ---
        var pnlSettings = win.add("panel", undefined, "Highlight Appearance");
        pnlSettings.orientation = "column";
        pnlSettings.alignChildren = ["fill", "top"];
        pnlSettings.spacing = 6;
        pnlSettings.margins = 10;

        function addSliderRow(parent, label, min, max, defaultVal, unit) {
            var grp = parent.add("group");
            grp.orientation = "row";
            grp.alignChildren = ["fill", "center"];

            var lbl = grp.add("statictext", undefined, label);
            lbl.preferredSize.width = 85;

            var sld = grp.add("slider", undefined, defaultVal, min, max);
            sld.alignment = ["fill", "center"];

            var txt = grp.add("edittext", undefined, String(defaultVal));
            txt.preferredSize.width = 45;

            sld.onChanging = function () {
                txt.text = Math.round(sld.value) + (unit || "");
            };
            txt.onChange = function () {
                var v = parseFloat(txt.text) || 0;
                sld.value = Math.max(min, Math.min(max, v));
                txt.text = Math.round(sld.value) + (unit || "");
            };
            return sld;
        }

        var sldPadX = addSliderRow(pnlSettings, "Padding X:", 0, 50, 8, "px");
        var sldPadY = addSliderRow(pnlSettings, "Padding Y:", 0, 50, 4, "px");
        var sldRound = addSliderRow(pnlSettings, "Roundness:", 0, 50, 6, "px");
        var sldOpacity = addSliderRow(pnlSettings, "Opacity:", 0, 100, 100, "%");

        // Colors Row
        var grpColors = pnlSettings.add("group");
        grpColors.orientation = "row";
        grpColors.alignChildren = ["left", "center"];

        var currentHighlightColor = [1.0, 0.165, 0.427]; // #FF2A6D
        var currentTextColor = [1.0, 1.0, 1.0];

        var btnColorHl = grpColors.add("button", undefined, "🎨 Highlight Color");
        btnColorHl.helpTip = "Click to pick highlight color";
        btnColorHl.onClick = function () {
            if (typeof $.colorPicker === "function") {
                var hex = ((Math.round(currentHighlightColor[0] * 255) << 16) | (Math.round(currentHighlightColor[1] * 255) << 8) | Math.round(currentHighlightColor[2] * 255));
                var res = $.colorPicker(hex);
                if (res !== -1) {
                    currentHighlightColor = [
                        ((res >> 16) & 0xFF) / 255,
                        ((res >> 8) & 0xFF) / 255,
                        (res & 0xFF) / 255
                    ];
                }
            } else {
                var userHex = prompt("Enter Highlight Color Hex (e.g. #FF2A6D):", "#FF2A6D");
                if (userHex) {
                    userHex = userHex.replace("#", "");
                    if (userHex.length === 6) {
                        currentHighlightColor = [
                            parseInt(userHex.substr(0, 2), 16) / 255,
                            parseInt(userHex.substr(2, 2), 16) / 255,
                            parseInt(userHex.substr(4, 2), 16) / 255
                        ];
                    }
                }
            }
        };

        var chkTextTint = grpColors.add("checkbox", undefined, "Tint Text");
        chkTextTint.value = false;

        var btnColorText = grpColors.add("button", undefined, "Text Color");
        btnColorText.enabled = false;
        chkTextTint.onClick = function () {
            btnColorText.enabled = chkTextTint.value;
        };
        btnColorText.onClick = function () {
            if (typeof $.colorPicker === "function") {
                var res = $.colorPicker(0xFFFFFF);
                if (res !== -1) {
                    currentTextColor = [
                        ((res >> 16) & 0xFF) / 255,
                        ((res >> 8) & 0xFF) / 255,
                        (res & 0xFF) / 255
                    ];
                }
            }
        };

        // --- Action Buttons ---
        var btnBuild = win.add("button", undefined, "✨ Build Highlights");
        btnBuild.preferredSize.height = 36;

        var btnRemove = win.add("button", undefined, "🗑️ Remove Highlights");

        // --- Footer ---
        var lblFooter = win.add("statictext", undefined, "GitHub: work2survive/AE-Text-Highlight");
        lblFooter.alignment = ["center", "bottom"];
        lblFooter.helpTip = GITHUB_URL;

        // ---------------------------------------------------------------------
        // Events & Interactive Logic
        // ---------------------------------------------------------------------

        function updateStatus() {
            var comp = getActiveComposition();
            if (!comp) {
                lblStatus.text = "⚠️ No active composition open.";
                return null;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                lblStatus.text = "ℹ️ Please select a text layer.";
                return null;
            }
            lblStatus.text = "🎯 Target: \"" + textLayer.name + "\"";
            return textLayer;
        }

        btnRefresh.onClick = function () {
            updateStatus();
        };

        btnBuild.onClick = function () {
            var comp = getActiveComposition();
            if (!comp) {
                alert("Please open an active composition first.");
                return;
            }

            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                alert("Please select a text layer in your active composition.");
                return;
            }

            var targets = parseTargets(txtTargets.text);
            if (targets.length === 0) {
                targets = DEFAULT_TARGETS;
                txtTargets.text = DEFAULT_TARGETS.join("\n");
            }

            if (app.beginUndoGroup) app.beginUndoGroup("Build Text Highlights");
            try {
                var result = buildHighlightsRig(comp, textLayer, {
                    terms: targets,
                    highlightColor: currentHighlightColor,
                    textColor: currentTextColor,
                    tintText: chkTextTint.value,
                    paddingX: sldPadX.value,
                    paddingY: sldPadY.value,
                    roundness: sldRound.value,
                    opacity: sldOpacity.value
                });

                if (result && result.count > 0) {
                    updateStatus();
                } else {
                    alert("No matching target words were found on layer \"" + textLayer.name + "\".");
                }
            } catch (err) {
                alert("Error building highlights:\n" + (err.message || err.toString()));
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        };

        btnRemove.onClick = function () {
            var comp = getActiveComposition();
            if (!comp) return;

            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                alert("Please select the text layer whose highlights you want to remove.");
                return;
            }

            if (app.beginUndoGroup) app.beginUndoGroup("Remove Text Highlights");
            try {
                var count = removeExistingHighlights(comp, textLayer);
                alert("Removed " + count + " highlight layer(s).");
                updateStatus();
            } catch (eR) {
                alert("Error removing highlights:\n" + (eR.message || eR.toString()));
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        };

        // Window activate & layer selection events
        if (win) {
            win.onActivate = function () { updateStatus(); };
        }
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("ae-layer-selection-changed", function () {
                updateStatus();
            });
        }

        // Initial status update (strictly read-only, 0 layers created)
        updateStatus();

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
            win.layout.resize();
        }

        // Expose public API methods on win for test suites
        win.buildHighlightsRig = buildHighlightsRig;
        win.removeExistingHighlights = removeExistingHighlights;
        win.parseTargets = parseTargets;
        win.pickRandomWordsFromText = pickRandomWordsFromText;
        win.updateStatus = updateStatus;
        win.getSelectedTextLayer = getSelectedTextLayer;
        win.btnBuild = btnBuild;
        win.btnRemove = btnRemove;
        win.btnSample = btnSample;
        win.txtTargets = txtTargets;

        return win;
    }

    var scriptPanel = buildUI(thisObj);
    return scriptPanel;

})(this);
