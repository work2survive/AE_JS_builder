// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL:
// TEXT & BOX PROPERTIES TO EFFECTS (INSPECTOR & RIGGER) v1.2
// =============================================================================
//
// PURPOSE:
//   Exposes hidden After Effects text properties, paragraph box dimensions,
//   sourceRectAtTime() boundaries, alignment, indent, typography metrics, and
//   content counters as live, interactive Effect Controls (Sliders, Points,
//   Checkboxes, Colors) on the layer.
//
// IN-MEMORY METRICS STORE:
//   Automatically analyzes and stores in memory:
//     - Array with each word detected in the text box.
//     - Array with the width in pixels of each word.
//     - Array with the width in pixels of each text line.
//   Stored in:
//     - $.global.AE_TEXT_BOX_MEMORY
//     - win.textMemoryStore
//     - layer._textMetrics
//
// COMPATIBILITY:
//   - Adobe After Effects CS6 through CC 2026+ (ExtendScript & JS Expression Engines).
//   - Native dockable ScriptUI panel or floating window.
//   - Web AE JSX Emulator compatible.
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_NAME = "Text & Box Properties to Effects";
    var SCRIPT_VERSION = "v1.2";

    // Global in-memory cache initialization
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
    // 1. PROPERTY DEFINITIONS CATALOG
    // =========================================================================
    var PROPERTY_DEFS = [
        // --- Category 1: sourceRect Dimensions & Bounds ---
        {
            id: "sr_width",
            category: "bounds",
            label: "Text Width (sourceRect)",
            effectName: "Text Width (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "sourceRectAtTime(time, false).width — Dynamic width of text glyphs / bounds",
            expression: "sourceRectAtTime(time, false).width;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.width : 0; }
        },
        {
            id: "sr_height",
            category: "bounds",
            label: "Text Height (sourceRect)",
            effectName: "Text Height (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "sourceRectAtTime(time, false).height — Dynamic height of text glyphs / bounds",
            expression: "sourceRectAtTime(time, false).height;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.height : 0; }
        },
        {
            id: "sr_size",
            category: "bounds",
            label: "Visual Size [W, H]",
            effectName: "Visual Size [W, H]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: true,
            tooltip: "2D Point with [width, height] from sourceRectAtTime",
            expression: "var r = sourceRectAtTime(time, false);\n[r.width, r.height];",
            evalStatic: function (layer, textDoc, rect) { return rect ? [rect.width, rect.height] : [0, 0]; }
        },
        {
            id: "sr_left",
            category: "bounds",
            label: "Text Left Offset (X Min)",
            effectName: "Text Left (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "sourceRectAtTime(time, false).left — Horizontal distance from origin to text start",
            expression: "sourceRectAtTime(time, false).left;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.left : 0; }
        },
        {
            id: "sr_top",
            category: "bounds",
            label: "Text Top Offset (Y Min / Baseline)",
            effectName: "Text Top (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "sourceRectAtTime(time, false).top — Vertical distance from origin to top of text",
            expression: "sourceRectAtTime(time, false).top;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.top : 0; }
        },
        {
            id: "sr_center",
            category: "bounds",
            label: "Visual Center Offset [X, Y]",
            effectName: "Visual Center Offset",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: true,
            tooltip: "Visual center point coordinates [left + width/2, top + height/2]",
            expression: "var r = sourceRectAtTime(time, false);\n[r.left + r.width / 2, r.top + r.height / 2];",
            evalStatic: function (layer, textDoc, rect) {
                return rect ? [rect.left + rect.width / 2, rect.top + rect.height / 2] : [0, 0];
            }
        },
        {
            id: "sr_min_corner",
            category: "bounds",
            label: "Min Corner [Left, Top]",
            effectName: "Min Corner [Left, Top]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            tooltip: "Top-Left boundary coordinate [left, top]",
            expression: "var r = sourceRectAtTime(time, false);\n[r.left, r.top];",
            evalStatic: function (layer, textDoc, rect) { return rect ? [rect.left, rect.top] : [0, 0]; }
        },
        {
            id: "sr_max_corner",
            category: "bounds",
            label: "Max Corner [Right, Bottom]",
            effectName: "Max Corner [Right, Bottom]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            tooltip: "Bottom-Right boundary coordinate [left + width, top + height]",
            expression: "var r = sourceRectAtTime(time, false);\n[r.left + r.width, r.top + r.height];",
            evalStatic: function (layer, textDoc, rect) {
                return rect ? [rect.left + rect.width, rect.top + rect.height] : [0, 0];
            }
        },

        // --- Category 2: Paragraph Box & Indents ---
        {
            id: "box_width",
            category: "box",
            label: "Paragraph Box Width",
            effectName: "Box Text Width",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "boxTextSize[0] for paragraph box text, with fallback to sourceRect width",
            expression: "try {\n    var st = text.sourceText;\n    if (st && st.style && st.style.boxText && st.style.boxTextSize) {\n        st.style.boxTextSize[0];\n    } else {\n        sourceRectAtTime(time, false).width;\n    }\n} catch (err) {\n    sourceRectAtTime(time, false).width;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && textDoc.boxText && textDoc.boxTextSize) return textDoc.boxTextSize[0];
                return rect ? rect.width : 0;
            }
        },
        {
            id: "box_height",
            category: "box",
            label: "Paragraph Box Height",
            effectName: "Box Text Height",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "boxTextSize[1] for paragraph box text, with fallback to sourceRect height",
            expression: "try {\n    var st = text.sourceText;\n    if (st && st.style && st.style.boxText && st.style.boxTextSize) {\n        st.style.boxTextSize[1];\n    } else {\n        sourceRectAtTime(time, false).height;\n    }\n} catch (err) {\n    sourceRectAtTime(time, false).height;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && textDoc.boxText && textDoc.boxTextSize) return textDoc.boxTextSize[1];
                return rect ? rect.height : 0;
            }
        },
        {
            id: "box_size",
            category: "box",
            label: "Paragraph Box Size [W, H]",
            effectName: "Box Text Size [W, H]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: true,
            tooltip: "boxTextSize [width, height] 2D point for paragraph box text",
            expression: "try {\n    var st = text.sourceText;\n    if (st && st.style && st.style.boxText && st.style.boxTextSize) {\n        st.style.boxTextSize;\n    } else {\n        var r = sourceRectAtTime(time, false);\n        [r.width, r.height];\n    }\n} catch (err) {\n    var r = sourceRectAtTime(time, false);\n    [r.width, r.height];\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && textDoc.boxText && textDoc.boxTextSize) return textDoc.boxTextSize;
                return rect ? [rect.width, rect.height] : [0, 0];
            }
        },
        {
            id: "box_is_box",
            category: "box",
            label: "Is Paragraph Box Text (0/1)",
            effectName: "Is Paragraph Box Text",
            matchName: "ADBE Checkbox Control",
            type: "checkbox",
            defaultChecked: true,
            tooltip: "1 if layer is Paragraph (Box) text; 0 if Point text",
            expression: "try {\n    (text.sourceText.style && text.sourceText.style.boxText) ? 1 : 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                return (textDoc && textDoc.boxText) ? 1 : 0;
            }
        },
        {
            id: "align_index",
            category: "box",
            label: "Alignment (0:Left, 1:Ctr, 2:Rgt, 3:Full)",
            effectName: "Alignment Index",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "Paragraph justification index (0 = Left, 1 = Center, 2 = Right, 3 = Justified)",
            expression: "try {\n    var j = text.sourceText.style.justification;\n    if (typeof ParagraphJustification !== 'undefined') {\n        if (j === ParagraphJustification.CENTER_JUSTIFY) 1;\n        else if (j === ParagraphJustification.RIGHT_JUSTIFY) 2;\n        else if (j === ParagraphJustification.LEFT_JUSTIFY) 0;\n        else 3;\n    } else {\n        if (j == 7414) 1; else if (j == 7413) 2; else 0;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (!textDoc || typeof textDoc.justification === "undefined") return 0;
                var j = textDoc.justification;
                if (typeof ParagraphJustification !== "undefined") {
                    if (j === ParagraphJustification.CENTER_JUSTIFY) return 1;
                    if (j === ParagraphJustification.RIGHT_JUSTIFY) return 2;
                    if (j === ParagraphJustification.LEFT_JUSTIFY) return 0;
                    return 3;
                }
                return (j == 7414) ? 1 : ((j == 7413) ? 2 : 0);
            }
        },
        {
            id: "align_ratio",
            category: "box",
            label: "Alignment Ratio (0..0.5..1.0)",
            effectName: "Alignment Ratio",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "Normalized justification factor: 0.0 (Left), 0.5 (Center), 1.0 (Right)",
            expression: "try {\n    var j = text.sourceText.style.justification;\n    if (typeof ParagraphJustification !== 'undefined') {\n        if (j === ParagraphJustification.CENTER_JUSTIFY) 0.5;\n        else if (j === ParagraphJustification.RIGHT_JUSTIFY) 1.0;\n        else 0.0;\n    } else {\n        if (j == 7414) 0.5; else if (j == 7413) 1.0; else 0.0;\n    }\n} catch (err) {\n    0.0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (!textDoc || typeof textDoc.justification === "undefined") return 0;
                var j = textDoc.justification;
                if (typeof ParagraphJustification !== "undefined") {
                    if (j === ParagraphJustification.CENTER_JUSTIFY) return 0.5;
                    if (j === ParagraphJustification.RIGHT_JUSTIFY) return 1.0;
                    return 0.0;
                }
                return (j == 7414) ? 0.5 : ((j == 7413) ? 1.0 : 0.0);
            }
        },
        {
            id: "indent_left",
            category: "box",
            label: "First Line Indent / Left Margin",
            effectName: "Indent / Left Margin",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "Horizontal offset to the beginning of text glyphs (measures paragraph indent)",
            expression: "try {\n    sourceRectAtTime(time, false).left;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.left : 0; }
        },
        {
            id: "indent_right_spare",
            category: "box",
            label: "Box Right Margin (Spare Width)",
            effectName: "Box Right Margin (Spare)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "Remaining horizontal whitespace in paragraph box before line wraps",
            expression: "try {\n    var st = text.sourceText;\n    var r = sourceRectAtTime(time, false);\n    if (st && st.style && st.style.boxText && st.style.boxTextSize) {\n        Math.max(0, st.style.boxTextSize[0] - (r.left + r.width));\n    } else {\n        0;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && textDoc.boxText && textDoc.boxTextSize && rect) {
                    return Math.max(0, textDoc.boxTextSize[0] - (rect.left + rect.width));
                }
                return 0;
            }
        },
        {
            id: "baseline_offset",
            category: "box",
            label: "Baseline Offset (Top Margin)",
            effectName: "Baseline Offset (Top)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "Vertical ascent / distance from baseline to top of box",
            expression: "try {\n    sourceRectAtTime(time, false).top;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.top : 0; }
        },

        // --- Category 3: Typography & Style ---
        {
            id: "typo_font_size",
            category: "typo",
            label: "Font Size (px)",
            effectName: "Font Size (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            tooltip: "Layer font size in pixels (text.sourceText.style.fontSize)",
            expression: "try {\n    text.sourceText.style.fontSize;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) { return textDoc ? textDoc.fontSize : 0; }
        },
        {
            id: "typo_leading",
            category: "typo",
            label: "Leading (Line Spacing)",
            effectName: "Leading (Line Spacing)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            tooltip: "Leading / line-height in pixels",
            expression: "try {\n    var s = text.sourceText.style;\n    s.autoLeading ? (s.fontSize * 1.2) : s.leading;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc) return 0;
                return textDoc.autoLeading ? (textDoc.fontSize * 1.2) : textDoc.leading;
            }
        },
        {
            id: "typo_tracking",
            category: "typo",
            label: "Tracking",
            effectName: "Tracking",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            tooltip: "Letter tracking (spacing between glyphs)",
            expression: "try {\n    text.sourceText.style.tracking;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) { return textDoc ? textDoc.tracking : 0; }
        },
        {
            id: "typo_baseline_shift",
            category: "typo",
            label: "Baseline Shift",
            effectName: "Baseline Shift",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            tooltip: "Vertical baseline shift in pixels",
            expression: "try {\n    text.sourceText.style.baselineShift;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) { return textDoc ? textDoc.baselineShift : 0; }
        },
        {
            id: "typo_stroke_width",
            category: "typo",
            label: "Stroke Width",
            effectName: "Text Stroke Width",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            tooltip: "Character stroke outline width in pixels",
            expression: "try {\n    var s = text.sourceText.style;\n    s.applyStroke ? s.strokeWidth : 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc) return 0;
                return textDoc.applyStroke ? textDoc.strokeWidth : 0;
            }
        },
        {
            id: "typo_fill_color",
            category: "typo",
            label: "Fill Color",
            effectName: "Text Fill Color",
            matchName: "ADBE Color Control",
            type: "color",
            defaultChecked: false,
            tooltip: "Live text fill color [R, G, B, A]",
            expression: "try {\n    var s = text.sourceText.style;\n    s.applyFill ? s.fillColor : [1, 1, 1, 1];\n} catch (err) {\n    [1, 1, 1, 1];\n}",
            evalStatic: function (layer, textDoc) {
                if (textDoc && textDoc.applyFill && textDoc.fillColor) {
                    var c = textDoc.fillColor;
                    return [c[0], c[1], c[2], 1];
                }
                return [1, 1, 1, 1];
            }
        },
        {
            id: "typo_stroke_color",
            category: "typo",
            label: "Stroke Color",
            effectName: "Text Stroke Color",
            matchName: "ADBE Color Control",
            type: "color",
            defaultChecked: false,
            tooltip: "Live text stroke color [R, G, B, A]",
            expression: "try {\n    var s = text.sourceText.style;\n    s.applyStroke ? s.strokeColor : [0, 0, 0, 1];\n} catch (err) {\n    [0, 0, 0, 1];\n}",
            evalStatic: function (layer, textDoc) {
                if (textDoc && textDoc.applyStroke && textDoc.strokeColor) {
                    var c = textDoc.strokeColor;
                    return [c[0], c[1], c[2], 1];
                }
                return [0, 0, 0, 1];
            }
        },

        // --- Category 4: Counters & Metrics ---
        {
            id: "cnt_words",
            category: "counters",
            label: "Amount of Words (Slider)",
            effectName: "Amount of Words",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "Slider Control showing total amount of words detected in the text box",
            expression: "try {\n    var str = String(text.sourceText.value || text.sourceText || '').replace(/^\\s+|\\s+$/g, '');\n    str.length === 0 ? 0 : str.split(/\\s+/).length;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if ($.global.AE_TEXT_BOX_MEMORY && typeof $.global.AE_TEXT_BOX_MEMORY.totalWords === "number") {
                    return $.global.AE_TEXT_BOX_MEMORY.totalWords;
                }
                var s = textDoc ? String(textDoc.text || "").replace(/^\s+|\s+$/g, "") : "";
                return s.length === 0 ? 0 : s.split(/\s+/).length;
            }
        },
        {
            id: "cnt_lines",
            category: "counters",
            label: "Amount of Text Lines (Slider)",
            effectName: "Amount of Text Lines",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            tooltip: "Slider Control showing total amount of text lines (including wrapped paragraph lines)",
            expression: "try {\n    var st = text.sourceText;\n    var r = sourceRectAtTime(time, false);\n    if (st && st.style && st.style.boxText) {\n        var l = st.style.leading;\n        if (st.style.autoLeading || l <= 0) l = st.style.fontSize * 1.2;\n        Math.max(1, Math.round(r.height / l));\n    } else {\n        var str = String(st.value || st || '');\n        str.length === 0 ? 0 : str.split(/\\r\\n|\\r|\\n/).length;\n    }\n} catch (err) {\n    try {\n        var str = String(text.sourceText.value || text.sourceText || '');\n        str.length === 0 ? 0 : str.split(/\\r\\n|\\r|\\n/).length;\n    } catch(e) { 0; }\n}",
            evalStatic: function (layer, textDoc) {
                if ($.global.AE_TEXT_BOX_MEMORY && typeof $.global.AE_TEXT_BOX_MEMORY.totalLines === "number") {
                    return $.global.AE_TEXT_BOX_MEMORY.totalLines;
                }
                var s = textDoc ? String(textDoc.text || "") : "";
                return s.length === 0 ? 0 : s.split(/\r\n|\r|\n/).length;
            }
        },
        {
            id: "cnt_chars",
            category: "counters",
            label: "Character Count",
            effectName: "Character Count",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            tooltip: "Total character count of the text string",
            expression: "try {\n    String(text.sourceText.value || text.sourceText || '').length;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return textDoc ? String(textDoc.text || "").length : 0;
            }
        },
        {
            id: "metric_max_line",
            category: "counters",
            label: "Longest Line Width (px)",
            effectName: "Longest Line Width (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            tooltip: "Maximum pixel width among all lines in the text box",
            expression: "sourceRectAtTime(time, false).width;",
            evalStatic: function (layer, textDoc, rect) {
                if ($.global.AE_TEXT_BOX_MEMORY && $.global.AE_TEXT_BOX_MEMORY.maxLineWidth) {
                    return $.global.AE_TEXT_BOX_MEMORY.maxLineWidth;
                }
                return rect ? rect.width : 0;
            }
        },

        // --- Category 5: Responsive Rigging Utilities ---
        {
            id: "rig_padding",
            category: "rigging",
            label: "Box Padding [X, Y]",
            effectName: "Box Padding [X, Y]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            tooltip: "Customizable 2D Padding [X, Y] (Default: [40, 20])",
            expression: null,
            defaultVal: [40, 20],
            evalStatic: function () { return [40, 20]; }
        },
        {
            id: "rig_padded_size",
            category: "rigging",
            label: "Total Padded Size [W, H]",
            effectName: "Total Padded Size [W, H]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            tooltip: "Calculates [sourceRect.width + padX*2, sourceRect.height + padY*2]",
            expression: "try {\n    var r = sourceRectAtTime(time, false);\n    var pad = [40, 20];\n    try {\n        pad = effect('Box Padding [X, Y]')('Point');\n    } catch (e1) {\n        try { pad = effect('[Prop] Box Padding [X, Y]')('Point'); } catch (e2) {}\n    }\n    [r.width + pad[0] * 2, r.height + pad[1] * 2];\n} catch (err) {\n    var r = sourceRectAtTime(time, false);\n    [r.width + 80, r.height + 40];\n}",
            evalStatic: function (layer, textDoc, rect) {
                return rect ? [rect.width + 80, rect.height + 40] : [100, 50];
            }
        }
    ];

    // =========================================================================
    // 2. IN-MEMORY MEASUREMENT ENGINE: WORDS & LINES
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
        if (!isTextLayer(layer)) return null;
        try {
            var srcText = layer.property("Source Text");
            if (srcText) return srcText.value;
        } catch (e) {}
        return null;
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

    /**
     * Measures and stores in memory:
     *   1. Array with each word detected in the text box.
     *   2. Array with the width in pixels of each word.
     *   3. Array with the width in pixels of each text line.
     */
    function measureAndStoreTextMetrics(comp, layer) {
        if (!comp || !layer) return null;
        if (!isTextLayer(layer)) return null;

        var textProp = layer.property("Source Text");
        if (!textProp) return null;
        var textDoc = textProp.value;
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

        // Create temporary offscreen text layer to measure exact AE glyph geometry
        var tempLayer = null;
        try {
            tempLayer = comp.layers.addText("");
            tempLayer.enabled = false;
            var tempDoc = tempLayer.property("Source Text").value;
            tempDoc.fontSize = textDoc.fontSize;
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
                spaceWidth = Math.round((textDoc.fontSize * 0.28) * 100) / 100;
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
            if (wordWidths.length === 0) {
                var charRatio = (textDoc.fontSize || 40) * 0.52;
                for (var fw = 0; fw < words.length; fw++) {
                    wordWidths.push(Math.round(words[fw].length * charRatio * 100) / 100);
                }
            }
            if (lines.length === 0) {
                lines = fullText.split(/\r\n|\r|\n/);
                for (var fl = 0; fl < lines.length; fl++) {
                    lineWidths.push(Math.round(lines[fl].length * ((textDoc.fontSize || 40) * 0.52) * 100) / 100);
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

        $.global.AE_TEXT_BOX_MEMORY = memoryStore;

        try {
            layer._textMetrics = memoryStore;
        } catch (eMem) {}

        return memoryStore;
    }

    // =========================================================================
    // 3. HELPER UTILITIES: LAYER EFFECTS & RIGGING
    // =========================================================================

    function removePropertyEffects(layer) {
        var fxGroup = layer.property("ADBE Effect Parade");
        if (!fxGroup) return 0;
        var removedCount = 0;
        for (var i = fxGroup.numProperties; i >= 1; i--) {
            var fx = fxGroup.property(i);
            if (!fx) continue;
            var fxName = fx.name || "";
            var isOurs = false;
            for (var p = 0; p < PROPERTY_DEFS.length; p++) {
                var def = PROPERTY_DEFS[p];
                if (fxName === def.effectName ||
                    fxName === ("[Prop] " + def.effectName) ||
                    fxName.indexOf(def.effectName) !== -1) {
                    isOurs = true;
                    break;
                }
            }
            if (isOurs) {
                fx.remove();
                removedCount++;
            }
        }
        return removedCount;
    }

    function applyPropertiesToLayer(comp, layer, selectedDefIds, options) {
        var fxGroup = layer.property("ADBE Effect Parade");
        if (!fxGroup) return { success: false, msg: "Cannot access Effects on layer" };

        var textDoc = getTextDocument(layer);
        var rect = getSourceRect(layer);
        var addedCount = 0;
        var prefix = options.usePrefix ? "[Prop]" : "";

        if (isTextLayer(layer)) {
            measureAndStoreTextMetrics(comp, layer);
        }

        if (options.removeExisting) {
            removePropertyEffects(layer);
        }

        for (var i = 0; i < PROPERTY_DEFS.length; i++) {
            var def = PROPERTY_DEFS[i];
            if (!selectedDefIds[def.id]) continue;

            var targetName = prefix ? (prefix + " " + def.effectName) : def.effectName;

            var existingFx = fxGroup.property(targetName);
            if (existingFx && options.removeExisting) {
                existingFx.remove();
                existingFx = null;
            }

            var fx = existingFx;
            if (!fx) {
                try {
                    fx = fxGroup.addProperty(def.matchName);
                    if (fx) fx.name = targetName;
                } catch (addErr) {
                    continue;
                }
            }

            if (!fx) continue;

            var controlProp = fx.property(1);
            if (!controlProp) continue;

            if (options.mode === "expression" && def.expression) {
                try {
                    controlProp.expression = def.expression;
                } catch (expErr) {}
            } else {
                try {
                    controlProp.expression = "";
                    var staticVal = null;
                    if (typeof def.evalStatic === "function") {
                        staticVal = def.evalStatic(layer, textDoc, rect);
                    } else if (typeof def.defaultVal !== "undefined") {
                        staticVal = def.defaultVal;
                    }
                    if (staticVal !== null) {
                        controlProp.setValue(staticVal);
                    }
                } catch (valErr) {}
            }

            addedCount++;
        }

        if (options.autoCenterAnchor) {
            try {
                var anchorProp = layer.property("Transform").property("Anchor Point");
                if (anchorProp) {
                    anchorProp.expression = "// Auto-Center Anchor Point to Visual Bounds\nvar r = sourceRectAtTime(time, false);\n[r.left + r.width / 2, r.top + r.height / 2];";
                }
            } catch (ancErr) {}
        }

        return { success: true, count: addedCount };
    }

    function createResponsiveBackground(comp, targetLayer) {
        if (!comp || !targetLayer) return null;

        var bgName = targetLayer.name + "_Background";
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = bgName;

        try {
            shapeLayer.moveAfter(targetLayer);
        } catch (e) {}

        var rootVectors = shapeLayer.property("Contents") || shapeLayer.property("ADBE Root Vectors Group");
        var group = rootVectors.addProperty("ADBE Vector Group");
        group.name = "Background Card";

        var groupContents = group.property("Contents") || group.property("ADBE Vectors Group");
        var rectShape = groupContents.addProperty("ADBE Vector Shape - Rect");
        var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
        var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");

        fill.property("Color").setValue([0.12, 0.14, 0.18]);
        stroke.property("Color").setValue([0.28, 0.52, 0.95]);
        stroke.property("Stroke Width").setValue(2);
        rectShape.property("Roundness").setValue(16);

        var targetRef = 'thisComp.layer("' + targetLayer.name.replace(/"/g, '\\"') + '")';
        var sizeExpr = [
            "var target = " + targetRef + ";",
            "var r = target.sourceRectAtTime(time, false);",
            "var padX = 40;",
            "var padY = 20;",
            "try {",
            "    var p = target.effect('Box Padding [X, Y]')('Point');",
            "    padX = p[0]; padY = p[1];",
            "} catch (e1) {",
            "    try {",
            "        var p2 = target.effect('[Prop] Box Padding [X, Y]')('Point');",
            "        padX = p2[0]; padY = p2[1];",
            "    } catch (e2) {}",
            "}",
            "[r.width + padX * 2, r.height + padY * 2];"
        ].join("\n");
        rectShape.property("Size").expression = sizeExpr;

        var posExpr = [
            "var target = " + targetRef + ";",
            "var r = target.sourceRectAtTime(time, false);",
            "target.toComp([r.left + r.width / 2, r.top + r.height / 2]);"
        ].join("\n");
        shapeLayer.property("Transform").property("Position").expression = posExpr;

        return shapeLayer;
    }

    function createDemoEnvironment(selectedDefIds, options) {
        var comp = app.project.items.addComp(
            "Text Properties to Effects Demo",
            1920,
            1080,
            1.0,
            10.0,
            30.0
        );

        var bgSolid = null;
        if (typeof comp.layers.addSolid === "function") {
            try {
                bgSolid = comp.layers.addSolid([0.07, 0.08, 0.10], "Dark Backdrop", 1920, 1080, 1.0);
                bgSolid.locked = true;
            } catch (eSolid) {}
        }

        var textLayer1 = comp.layers.addText("ANTIGRAVITY RESPONSIVE TEXT");
        textLayer1.name = "Demo 1 - Point Text";
        var txtDoc1 = textLayer1.property("Source Text").value;
        txtDoc1.fontSize = 54;
        txtDoc1.font = "Arial-BoldMT";
        txtDoc1.applyFill = true;
        txtDoc1.fillColor = [1.0, 1.0, 1.0];
        txtDoc1.applyStroke = true;
        txtDoc1.strokeColor = [0.25, 0.60, 1.0];
        txtDoc1.strokeWidth = 2;
        txtDoc1.justification = ParagraphJustification.CENTER_JUSTIFY;
        textLayer1.property("Source Text").setValue(txtDoc1);
        textLayer1.property("Transform").property("Position").setValue([960, 380]);

        var textLayer2 = comp.layers.addText(
            "This is an After Effects paragraph text box. It wraps words automatically inside a rectangular boundary.\n" +
            "With this panel, its live box width, height, first-line indent, and alignment are instantly exposed as Effects!"
        );
        textLayer2.name = "Demo 2 - Paragraph Box Text";
        var txtDoc2 = textLayer2.property("Source Text").value;
        txtDoc2.fontSize = 28;
        txtDoc2.font = "ArialMT";
        txtDoc2.applyFill = true;
        txtDoc2.fillColor = [0.85, 0.88, 0.95];
        txtDoc2.leading = 40;
        txtDoc2.justification = ParagraphJustification.LEFT_JUSTIFY;
        try {
            if (typeof txtDoc2.setBoxTextSize === "function") {
                txtDoc2.setBoxTextSize([720, 200]);
            }
        } catch (e) {}
        textLayer2.property("Source Text").setValue(txtDoc2);
        textLayer2.property("Transform").property("Position").setValue([600, 560]);

        applyPropertiesToLayer(comp, textLayer1, selectedDefIds, options);
        applyPropertiesToLayer(comp, textLayer2, selectedDefIds, options);

        createResponsiveBackground(comp, textLayer1);

        textLayer1.selected = true;
        comp.openInViewer();

        return comp;
    }

    // =========================================================================
    // 4. SCRIPTUI USER INTERFACE BUILDER
    // =========================================================================
    // =========================================================================
    // 4. SCRIPTUI USER INTERFACE BUILDER
    // =========================================================================
    function buildUI(thisObj) {
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
        win.preferredSize = [420, 680];

        win.textMemoryStore = $.global.AE_TEXT_BOX_MEMORY;

        // ---------------------------------------------------------------------
        // Header
        // ---------------------------------------------------------------------
        var pnlHeader = win.add("panel", undefined, undefined);
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.spacing = 2;
        pnlHeader.margins = [8, 6, 8, 6];

        var lblTitle = pnlHeader.add("statictext", undefined, "⚡ " + SCRIPT_NAME + " " + SCRIPT_VERSION);
        try {
            lblTitle.graphics.font = ScriptUI.newFont("Verdana", "BOLD", 13);
        } catch (e) {}

        var lblDesc = pnlHeader.add(
            "statictext",
            undefined,
            "Check or uncheck properties below to show or hide their effects on the timeline in real-time."
        );

        // ---------------------------------------------------------------------
        // Quick Presets & Sync Toolbar
        // ---------------------------------------------------------------------
        var grpToolbar = win.add("group");
        grpToolbar.orientation = "row";
        grpToolbar.alignChildren = ["fill", "center"];
        grpToolbar.spacing = 4;

        var btnPresetCommon = grpToolbar.add("button", undefined, "★ Common");
        btnPresetCommon.helpTip = "Select standard width, height, word count, line count, alignment & indents";

        var btnPresetAll = grpToolbar.add("button", undefined, "☑ All");
        btnPresetAll.helpTip = "Select all properties to show as effects";

        var btnPresetNone = grpToolbar.add("button", undefined, "☐ None");
        btnPresetNone.helpTip = "Deselect all properties";

        var btnReadTimeline = grpToolbar.add("button", undefined, "🔄 Read Timeline");
        btnReadTimeline.helpTip = "Inspects selected layer and sets checkboxes to match effects currently in timeline";

        // ---------------------------------------------------------------------
        // Tabbed Panel: Categorized Property Checkboxes + In-Memory Store
        // ---------------------------------------------------------------------
        var tpanel = win.add("tabbedpanel", undefined, undefined);
        tpanel.alignChildren = ["fill", "top"];
        tpanel.alignment = ["fill", "fill"];

        var checkboxMap = {};
        var PROPERTY_DEFS_MAP = {};
        for (var pd = 0; pd < PROPERTY_DEFS.length; pd++) {
            PROPERTY_DEFS_MAP[PROPERTY_DEFS[pd].id] = PROPERTY_DEFS[pd];
        }

        // Helper to add checkbox and wire live timeline show/hide toggle
        function addCheckboxItem(container, def) {
            var chk = container.add("checkbox", undefined, def.label);
            chk.value = def.defaultChecked;
            chk.helpTip = (def.tooltip || "") + " (Toggling shows or hides this effect in the timeline)";
            chk.alignment = ["fill", "top"];
            checkboxMap[def.id] = chk;

            // Live event: Checking/unchecking shows or hides this effect on the timeline
            chk.onClick = function () {
                syncPropertyToTimeline(def, chk.value);
            };

            return chk;
        }

        // =====================================================================
        // TAB 1: ⚡ TIMELINE EFFECTS (SHOW / HIDE CHECKBOXES)
        // =====================================================================
        var tabTimeline = tpanel.add("tab", undefined, "⚡ Timeline Effects");
        tabTimeline.orientation = "column";
        tabTimeline.alignChildren = ["fill", "top"];
        tabTimeline.spacing = 6;
        tabTimeline.margins = 8;

        // Subpanel 1: Box & Dimensions Properties
        var pnlSR = tabTimeline.add("panel", undefined, "📐 Box & Dimensions (Show/Hide in Timeline)");
        pnlSR.orientation = "column";
        pnlSR.alignChildren = ["fill", "top"];
        pnlSR.spacing = 3;

        var boxProps = ["sr_width", "sr_height", "box_width", "box_height", "sr_size", "box_size", "sr_left", "sr_top"];
        for (var bi = 0; bi < boxProps.length; bi++) {
            var bDef = PROPERTY_DEFS_MAP[boxProps[bi]];
            if (bDef) addCheckboxItem(pnlSR, bDef);
        }

        // Subpanel 2: Alignment, Indent & Styling
        var pnlAlign = tabTimeline.add("panel", undefined, "📝 Alignment, Indent & Style (Show/Hide in Timeline)");
        pnlAlign.orientation = "column";
        pnlAlign.alignChildren = ["fill", "top"];
        pnlAlign.spacing = 3;

        var alignProps = ["align_index", "align_ratio", "indent_left", "indent_right_spare", "baseline_offset", "typo_font_size", "typo_leading"];
        for (var ai = 0; ai < alignProps.length; ai++) {
            var aDef = PROPERTY_DEFS_MAP[alignProps[ai]];
            if (aDef) addCheckboxItem(pnlAlign, aDef);
        }

        // Subpanel 3: Word & Line Count Sliders (Controls on Timeline Layer)
        var pnlCounters = tabTimeline.add("panel", undefined, "🔢 Word & Line Counters (Timeline Sliders & Live Readouts)");
        pnlCounters.orientation = "column";
        pnlCounters.alignChildren = ["fill", "top"];
        pnlCounters.spacing = 5;

        // Row for Amount of Words: Checkbox + Scrubbable Slider + Count Input
        var grpWordRow = pnlCounters.add("group");
        grpWordRow.orientation = "row";
        grpWordRow.alignment = ["fill", "center"];
        grpWordRow.spacing = 6;
        var chkWordsDef = PROPERTY_DEFS_MAP["cnt_words"];
        var chkWordAmount = grpWordRow.add("checkbox", undefined, "Amount of Words:");
        chkWordAmount.value = true;
        chkWordAmount.preferredSize = [135, -1];
        chkWordAmount.helpTip = "Shows or hides 'Amount of Words' Slider Control in the timeline";
        checkboxMap["cnt_words"] = chkWordAmount;

        var sldWordAmount = grpWordRow.add("slider", undefined, 0, 0, 500);
        sldWordAmount.alignment = ["fill", "center"];
        var txtWordAmount = grpWordRow.add("edittext", undefined, "0");
        txtWordAmount.characters = 4;
        txtWordAmount.readonly = true;

        chkWordAmount.onClick = function () {
            if (chkWordsDef) syncPropertyToTimeline(chkWordsDef, chkWordAmount.value);
        };

        // Row for Amount of Text Lines: Checkbox + Scrubbable Slider + Count Input
        var grpLineRow = pnlCounters.add("group");
        grpLineRow.orientation = "row";
        grpLineRow.alignment = ["fill", "center"];
        grpLineRow.spacing = 6;
        var chkLinesDef = PROPERTY_DEFS_MAP["cnt_lines"];
        var chkLineAmount = grpLineRow.add("checkbox", undefined, "Amount of Text Lines:");
        chkLineAmount.value = true;
        chkLineAmount.preferredSize = [135, -1];
        chkLineAmount.helpTip = "Shows or hides 'Amount of Text Lines' Slider Control in the timeline";
        checkboxMap["cnt_lines"] = chkLineAmount;

        var sldLineAmount = grpLineRow.add("slider", undefined, 0, 0, 100);
        sldLineAmount.alignment = ["fill", "center"];
        var txtLineAmount = grpLineRow.add("edittext", undefined, "0");
        txtLineAmount.characters = 4;
        txtLineAmount.readonly = true;

        chkLineAmount.onClick = function () {
            if (chkLinesDef) syncPropertyToTimeline(chkLinesDef, chkLineAmount.value);
        };

        // Extra counter metrics: Longest Line Width & Characters
        var grpExtraCounters = pnlCounters.add("group");
        grpExtraCounters.orientation = "row";
        grpExtraCounters.alignment = ["fill", "center"];
        grpExtraCounters.spacing = 8;
        if (PROPERTY_DEFS_MAP["cnt_longest_line"]) addCheckboxItem(grpExtraCounters, PROPERTY_DEFS_MAP["cnt_longest_line"]);
        if (PROPERTY_DEFS_MAP["cnt_chars"]) addCheckboxItem(grpExtraCounters, PROPERTY_DEFS_MAP["cnt_chars"]);

        // =====================================================================
        // TAB 2: 💾 IN-MEMORY WORDS & LINES STORE
        // =====================================================================
        var tabMemory = tpanel.add("tab", undefined, "💾 Memory Store");
        tabMemory.orientation = "column";
        tabMemory.alignChildren = ["fill", "top"];
        tabMemory.spacing = 6;
        tabMemory.margins = 8;

        var pnlMemStats = tabMemory.add("panel", undefined, "In-Memory Metrics ($.global.AE_TEXT_BOX_MEMORY)");
        pnlMemStats.orientation = "column";
        pnlMemStats.alignChildren = ["fill", "top"];
        pnlMemStats.spacing = 4;

        var lblMemHeader = pnlMemStats.add(
            "statictext",
            undefined,
            "Target: (None) | Words: 0 | Lines: 0 | Max Line: 0 px"
        );

        var grpMemViews = pnlMemStats.add("group");
        grpMemViews.orientation = "row";
        grpMemViews.alignChildren = ["left", "center"];
        grpMemViews.spacing = 8;
        var rdoViewWords = grpMemViews.add("radiobutton", undefined, "Words & Widths");
        var rdoViewLines = grpMemViews.add("radiobutton", undefined, "Lines & Widths");
        var rdoViewJSON = grpMemViews.add("radiobutton", undefined, "JSON Arrays");
        rdoViewWords.value = true;

        var txtMemDisplay = pnlMemStats.add("edittext", undefined, "// No text layer measured yet.\n// Select a text layer and click 'Measure Selected Text'.", {
            multiline: true,
            readonly: true
        });
        txtMemDisplay.preferredSize = [-1, 140];

        var grpMemBtns = pnlMemStats.add("group");
        grpMemBtns.orientation = "row";
        grpMemBtns.alignChildren = ["fill", "center"];
        grpMemBtns.spacing = 6;

        var btnMeasure = grpMemBtns.add("button", undefined, "🔍 Measure Selected Text");
        btnMeasure.helpTip = "Measures words and lines pixel widths and updates the sliders & memory store";

        var btnCopyMem = grpMemBtns.add("button", undefined, "📋 Copy JSON");
        btnCopyMem.helpTip = "Copies in-memory words, wordWidths, and lineWidths arrays to clipboard";

        var btnPrintConsole = grpMemBtns.add("button", undefined, "📜 Output to Console");
        btnPrintConsole.helpTip = "Prints formatted word and line width tables to ExtendScript console";

        // =====================================================================
        // TAB 3: ⚙️ RIGGING & EXECUTION OPTIONS
        // =====================================================================
        var tabOptions = tpanel.add("tab", undefined, "⚙️ Options & Rigging");
        tabOptions.orientation = "column";
        tabOptions.alignChildren = ["fill", "top"];
        tabOptions.spacing = 6;
        tabOptions.margins = 8;

        var pnlOpts = tabOptions.add("panel", undefined, "Effect Calculation Mode");
        pnlOpts.orientation = "column";
        pnlOpts.alignChildren = ["fill", "top"];
        pnlOpts.spacing = 4;

        var grpMode = pnlOpts.add("group");
        grpMode.orientation = "row";
        grpMode.alignChildren = ["left", "center"];
        grpMode.spacing = 10;
        var rdoLive = grpMode.add("radiobutton", undefined, "⚡ Live Expressions (Dynamic)");
        rdoLive.value = true;
        rdoLive.helpTip = "Effects update in real time as text or layers change";
        var rdoStatic = grpMode.add("radiobutton", undefined, "🧊 Bake Static Values");
        rdoStatic.helpTip = "Sets fixed numbers without expressions";

        var grpChkOpts = tabOptions.add("panel", undefined, "Rigging Helpers");
        grpChkOpts.orientation = "column";
        grpChkOpts.alignChildren = ["fill", "top"];
        grpChkOpts.spacing = 4;

        var chkRemoveExisting = grpChkOpts.add("checkbox", undefined, "Remove existing property effects first");
        chkRemoveExisting.value = false;

        var chkPrefix = grpChkOpts.add("checkbox", undefined, "Add '[Prop]' prefix to effect names");
        chkPrefix.value = false;

        var chkAutoCenter = grpChkOpts.add("checkbox", undefined, "Auto-center Anchor Point to text bounds");
        chkAutoCenter.value = false;

        var grpOptionBtns = tabOptions.add("group");
        grpOptionBtns.orientation = "row";
        grpOptionBtns.alignChildren = ["fill", "center"];
        grpOptionBtns.spacing = 6;

        var btnCreateBg = grpOptionBtns.add("button", undefined, "📦 Background Box Rig");
        btnCreateBg.helpTip = "Creates a shape layer behind selected text dynamically linked to its bounds";

        var btnDemo = grpOptionBtns.add("button", undefined, "✨ Create Demo Comp");
        btnDemo.helpTip = "Creates a test composition with Point & Box text layers";

        var btnRemove = grpOptionBtns.add("button", undefined, "🗑️ Remove All Effects");
        btnRemove.helpTip = "Removes any previously added property effects from selected layers";

        tpanel.selection = 0; // Tab 1 active by default

        // ---------------------------------------------------------------------
        // Action & Status Bar
        // ---------------------------------------------------------------------
        var grpActions = win.add("group");
        grpActions.orientation = "row";
        grpActions.alignChildren = ["fill", "center"];
        grpActions.spacing = 6;

        var btnApply = grpActions.add("button", undefined, "⚡ Apply All Checked Effects");
        btnApply.preferredSize = [-1, 32];
        btnApply.helpTip = "Applies all currently checked property effects to selected text layers";

        var lblStatus = win.add("statictext", undefined, "Ready. Check/uncheck any property to show/hide that effect in the timeline.");
        lblStatus.alignment = ["fill", "bottom"];
        try {
            lblStatus.graphics.font = ScriptUI.newFont("Verdana", "REGULAR", 10);
        } catch (e) {}

        function setStatus(msg, isError) {
            lblStatus.text = (isError ? "⚠ " : "✔ ") + msg;
        }

        function getSelectedDefIds() {
            var selected = {};
            var count = 0;
            for (var id in checkboxMap) {
                if (checkboxMap.hasOwnProperty(id) && checkboxMap[id].value) {
                    selected[id] = true;
                    count++;
                }
            }
            return { map: selected, count: count };
        }

        function getOptions() {
            return {
                mode: rdoLive.value ? "expression" : "static",
                removeExisting: chkRemoveExisting.value,
                usePrefix: chkPrefix.value,
                autoCenterAnchor: chkAutoCenter.value
            };
        }

        // ---------------------------------------------------------------------
        // LIVE TIMELINE SYNC: Shows or hides the effect in the timeline
        // ---------------------------------------------------------------------
        function syncPropertyToTimeline(def, isChecked) {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                if (app.project && app.project.items) {
                    for (var ci = 1; ci <= app.project.items.length; ci++) {
                        if (app.project.items[ci] instanceof CompItem) {
                            comp = app.project.items[ci];
                            break;
                        }
                    }
                }
                if (!comp && app.project && app.project.items && app.project.items.addComp) {
                    try {
                        comp = app.project.items.addComp("Text Properties Comp", 1920, 1080, 1.0, 10.0, 30.0);
                    } catch (eComp) {}
                }
            }
            if (!comp || !(comp instanceof CompItem)) {
                setStatus("No active composition available.");
                return;
            }

            var targetLayers = [];
            if (comp.selectedLayers && comp.selectedLayers.length > 0) {
                targetLayers = comp.selectedLayers;
            } else {
                for (var li = 1; li <= comp.layers.length; li++) {
                    if (isTextLayer(comp.layers[li])) {
                        targetLayers.push(comp.layers[li]);
                        break;
                    }
                }
                if (targetLayers.length === 0 && comp.layers.length > 0) {
                    targetLayers.push(comp.layers[1]);
                }
            }

            if (targetLayers.length === 0) {
                try {
                    var newLyr = comp.layers.addText("Antigravity Text Engine\nMeasuring words and line widths in real-time");
                    newLyr.name = "Text_Sample";
                    targetLayers.push(newLyr);
                } catch (eAddLyr) {
                    setStatus("Please select a text layer in the timeline.", true);
                    return;
                }
            }

            if (app.beginUndoGroup) {
                app.beginUndoGroup((isChecked ? "Show " : "Hide ") + def.effectName + " Effect");
            }

            var prefix = (chkPrefix && chkPrefix.value) ? "[Prop]" : "";
            var targetName = prefix ? (prefix + " " + def.effectName) : def.effectName;
            var isExpr = (rdoLive && rdoLive.value);

            for (var i = 0; i < targetLayers.length; i++) {
                var layer = targetLayers[i];
                var fxGroup = layer.property("ADBE Effect Parade") || layer.property("Effects");
                if (!fxGroup) continue;

                var existingFx = fxGroup.property(targetName) || fxGroup.property(def.effectName);

                if (isChecked) {
                    // SHOW / ADD / ENABLE EFFECT
                    if (!existingFx) {
                        try {
                            existingFx = fxGroup.addProperty(def.matchName);
                            if (existingFx) existingFx.name = targetName;
                        } catch (eAdd) {}
                    }
                    if (existingFx) {
                        existingFx.enabled = true;
                        var ctrl = existingFx.property(1);
                        if (ctrl) {
                            if (isExpr && def.expression) {
                                try { ctrl.expression = def.expression; } catch (eExp) {}
                            } else {
                                try {
                                    ctrl.expression = "";
                                    var textDoc = getTextDocument(layer);
                                    var rect = getSourceRect(layer);
                                    var sVal = (typeof def.evalStatic === "function")
                                        ? def.evalStatic(layer, textDoc, rect)
                                        : def.defaultVal;
                                    if (sVal !== null && typeof sVal !== "undefined") {
                                        ctrl.setValue(sVal);
                                    }
                                } catch (eVal) {}
                            }
                        }
                    }
                } else {
                    // HIDE / DISABLE / REMOVE EFFECT FROM TIMELINE
                    if (existingFx) {
                        try { existingFx.enabled = false; } catch (eEn) {}
                        try {
                            if (existingFx.remove) existingFx.remove();
                        } catch (eRm) {}
                    }
                }

                // If text layer, measure & store in memory
                if (isTextLayer(layer)) {
                    measureAndStoreTextMetrics(comp, layer);
                }
            }

            if (app.endUndoGroup) {
                app.endUndoGroup();
            }

            refreshMemoryDisplay();

            var verb = isChecked ? "👁️ Shown in Timeline: " : "🚫 Hidden from Timeline: ";
            setStatus(verb + def.effectName);
        }

        // ---------------------------------------------------------------------
        // Memory Display Refresh
        // ---------------------------------------------------------------------
        function refreshMemoryDisplay() {
            var mem = $.global.AE_TEXT_BOX_MEMORY;
            if (!mem || !mem.words) {
                lblMemHeader.text = "Target: (None) | Words: 0 | Lines: 0";
                txtMemDisplay.text = "// No text data in memory.";
                sldWordAmount.value = 0;
                txtWordAmount.text = "0";
                sldLineAmount.value = 0;
                txtLineAmount.text = "0";
                return;
            }

            var wCount = mem.totalWords || 0;
            var lCount = mem.totalLines || 0;

            if (wCount > sldWordAmount.maxvalue) sldWordAmount.maxvalue = wCount + 50;
            sldWordAmount.value = wCount;
            txtWordAmount.text = String(wCount);

            if (lCount > sldLineAmount.maxvalue) sldLineAmount.maxvalue = lCount + 20;
            sldLineAmount.value = lCount;
            txtLineAmount.text = String(lCount);

            lblMemHeader.text = "Layer: '" + (mem.layerName || "Unnamed") +
                "' | Words: " + wCount +
                " | Lines: " + lCount +
                " | Max Line: " + mem.maxLineWidth + " px";

            if (rdoViewWords.value) {
                var wLines = ["// DETECTED WORDS & PIXEL WIDTHS (" + wCount + " total):"];
                for (var wi = 0; wi < mem.words.length; wi++) {
                    wLines.push("[" + wi + "] \"" + mem.words[wi] + "\" -> " + mem.wordWidths[wi] + " px");
                }
                txtMemDisplay.text = wLines.join("\n");
            } else if (rdoViewLines.value) {
                var lLines = ["// DETECTED LINES & PIXEL WIDTHS (" + lCount + " total):"];
                for (var li = 0; li < mem.lines.length; li++) {
                    lLines.push("Line " + (li + 1) + " (" + mem.lineWidths[li] + " px): \"" + mem.lines[li] + "\"");
                }
                txtMemDisplay.text = lLines.join("\n");
            } else {
                var jsonLines = [
                    "{",
                    "  \"layerName\": \"" + (mem.layerName || "") + "\",",
                    "  \"totalWords\": " + wCount + ",",
                    "  \"totalLines\": " + lCount + ",",
                    "  \"words\": " + (function() {
                        var q = [];
                        for (var i = 0; i < mem.words.length; i++) q.push('\"' + mem.words[i].replace(/"/g, '\\"') + '\"');
                        return "[" + q.join(", ") + "]";
                    })() + ",",
                    "  \"wordWidths\": [" + mem.wordWidths.join(", ") + "],",
                    "  \"lines\": " + (function() {
                        var q = [];
                        for (var i = 0; i < mem.lines.length; i++) q.push('\"' + mem.lines[i].replace(/"/g, '\\"') + '\"');
                        return "[" + q.join(", ") + "]";
                    })() + ",",
                    "  \"lineWidths\": [" + mem.lineWidths.join(", ") + "],",
                    "  \"maxLineWidth\": " + mem.maxLineWidth + ",",
                    "  \"maxWordWidth\": " + mem.maxWordWidth + ",",
                    "  \"spaceWidth\": " + mem.spaceWidth + ",",
                    "  \"fontSize\": " + mem.fontSize + ",",
                    "  \"timestamp\": " + mem.timestamp,
                    "}"
                ];
                txtMemDisplay.text = jsonLines.join("\n");
            }
        }

        rdoViewWords.onClick = refreshMemoryDisplay;
        rdoViewLines.onClick = refreshMemoryDisplay;
        rdoViewJSON.onClick = refreshMemoryDisplay;

        // ---------------------------------------------------------------------
        // Preset Toolbar Handlers
        // ---------------------------------------------------------------------
        function setCheckboxes(filterFn) {
            for (var p = 0; p < PROPERTY_DEFS.length; p++) {
                var def = PROPERTY_DEFS[p];
                if (checkboxMap[def.id]) {
                    checkboxMap[def.id].value = Boolean(filterFn(def));
                }
            }
        }

        btnPresetAll.onClick = function () {
            setCheckboxes(function () { return true; });
            setStatus("Checked all properties.");
        };

        btnPresetNone.onClick = function () {
            setCheckboxes(function () { return false; });
            setStatus("Unchecked all properties.");
        };

        btnPresetCommon.onClick = function () {
            setCheckboxes(function (def) {
                return (def.id === "sr_width" ||
                        def.id === "sr_height" ||
                        def.id === "box_width" ||
                        def.id === "box_height" ||
                        def.id === "align_index" ||
                        def.id === "indent_left" ||
                        def.id === "indent_right_spare" ||
                        def.id === "cnt_words" ||
                        def.id === "cnt_lines");
            });
            setStatus("Checked common dimensions, alignment, indent & counters.");
        };

        btnReadTimeline.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !comp.selectedLayers || comp.selectedLayers.length === 0) {
                setStatus("Select a layer to read timeline effects.", true);
                return;
            }
            var layer = comp.selectedLayers[0];
            var fxGroup = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!fxGroup) {
                setStatus("No Effects group found on layer '" + layer.name + "'.", true);
                return;
            }

            var prefix = (chkPrefix && chkPrefix.value) ? "[Prop]" : "";
            var activeCount = 0;

            for (var p = 0; p < PROPERTY_DEFS.length; p++) {
                var def = PROPERTY_DEFS[p];
                var chk = checkboxMap[def.id];
                if (!chk) continue;

                var targetName = prefix ? (prefix + " " + def.effectName) : def.effectName;
                var fx = fxGroup.property(targetName) || fxGroup.property(def.effectName);

                if (fx && fx.enabled !== false) {
                    chk.value = true;
                    activeCount++;
                } else {
                    chk.value = false;
                }
            }

            setStatus("Read layer '" + layer.name + "': " + activeCount + " effect(s) active on timeline.");
        };

        // ---------------------------------------------------------------------
        // Action Button Handlers
        // ---------------------------------------------------------------------
        btnApply.onClick = function () {
            var selInfo = getSelectedDefIds();
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                var answer = confirm("No active composition found.\nWould you like to create a Demo Comp with sample text layers?");
                if (answer) {
                    app.beginUndoGroup("Create Text Properties Demo Comp");
                    try {
                        createDemoEnvironment(selInfo.map, getOptions());
                        refreshMemoryDisplay();
                        setStatus("Created demo composition and applied effects!");
                    } catch (demoErr) {
                        setStatus("Error: " + demoErr.toString(), true);
                    } finally {
                        app.endUndoGroup();
                    }
                }
                return;
            }

            var layers = comp.selectedLayers;
            if (!layers || layers.length === 0) {
                // If no selection, target first text layer
                for (var li = 1; li <= comp.layers.length; li++) {
                    if (isTextLayer(comp.layers[li])) {
                        layers = [comp.layers[li]];
                        break;
                    }
                }
            }

            if (!layers || layers.length === 0) {
                alert("Please select one or more text layers in the comp.");
                return;
            }

            app.beginUndoGroup("Apply All Checked Effects");
            var totalAdded = 0;
            var processedLayers = 0;
            var opts = getOptions();

            try {
                for (var l = 0; l < layers.length; l++) {
                    var target = layers[l];
                    var res = applyPropertiesToLayer(comp, target, selInfo.map, opts);
                    if (res.success) {
                        totalAdded += res.count;
                        processedLayers++;
                    }
                }
                refreshMemoryDisplay();
                setStatus("Applied " + totalAdded + " effect(s) across " + processedLayers + " layer(s).");
            } catch (err) {
                setStatus("Error: " + err.toString(), true);
            } finally {
                app.endUndoGroup();
            }
        };

        btnRemove.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) return;
            var layers = comp.selectedLayers;
            if (!layers || layers.length === 0) return;

            app.beginUndoGroup("Remove Property Effects");
            var totalRemoved = 0;
            try {
                for (var l = 0; l < layers.length; l++) {
                    totalRemoved += removePropertyEffects(layers[l]);
                }
                setCheckboxes(function () { return false; });
                setStatus("Removed " + totalRemoved + " property effect(s).");
            } catch (err) {
                setStatus("Error removing effects: " + err.toString(), true);
            } finally {
                app.endUndoGroup();
            }
        };

        btnCreateBg.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem) || !comp.selectedLayers || comp.selectedLayers.length === 0) {
                alert("Please select a text layer first.");
                return;
            }
            app.beginUndoGroup("Create Responsive Background Box");
            try {
                var bg = createResponsiveBackground(comp, comp.selectedLayers[0]);
                if (bg) setStatus("Created responsive background: " + bg.name);
            } catch (err) {
                setStatus("Error: " + err.toString(), true);
            } finally {
                app.endUndoGroup();
            }
        };

        btnDemo.onClick = function () {
            var selInfo = getSelectedDefIds();
            app.beginUndoGroup("Create Text Properties Demo Comp");
            try {
                createDemoEnvironment(selInfo.map, getOptions());
                refreshMemoryDisplay();
                setStatus("Created demo comp with Point & Box text layers!");
            } catch (demoErr) {
                setStatus("Error: " + demoErr.toString(), true);
            } finally {
                app.endUndoGroup();
            }
        };

        btnMeasure.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !comp.selectedLayers || comp.selectedLayers.length === 0 || !isTextLayer(comp.selectedLayers[0])) {
                alert("Please select a Text Layer to measure.");
                return;
            }
            app.beginUndoGroup("Measure Text Metrics");
            try {
                var mem = measureAndStoreTextMetrics(comp, comp.selectedLayers[0]);
                refreshMemoryDisplay();
                tpanel.selection = 1; // Switch to Memory Store tab
                setStatus("Measured " + mem.totalWords + " words and " + mem.totalLines + " lines into memory!");
            } catch (measErr) {
                setStatus("Error: " + measErr.toString(), true);
            } finally {
                app.endUndoGroup();
            }
        };

        btnCopyMem.onClick = function () {
            refreshMemoryDisplay();
            var textToCopy = txtMemDisplay.text;
            if (!textToCopy) return;

            var dlg = new Window("dialog", "In-Memory Text Metrics (Copy)", undefined, { resizeable: true });
            dlg.orientation = "column";
            dlg.alignChildren = ["fill", "top"];
            dlg.spacing = 8;
            dlg.margins = 12;

            dlg.add("statictext", undefined, "Press Ctrl+A then Ctrl+C to copy arrays to clipboard:");
            var copyBox = dlg.add("edittext", undefined, textToCopy, { multiline: true });
            copyBox.preferredSize = [480, 240];

            var grpDlgBtns = dlg.add("group");
            grpDlgBtns.alignment = ["right", "bottom"];
            var btnClose = grpDlgBtns.add("button", undefined, "Close", { name: "ok" });
            btnClose.onClick = function () { dlg.close(); };

            dlg.center();
            dlg.show();
        };

        btnPrintConsole.onClick = function () {
            var mem = $.global.AE_TEXT_BOX_MEMORY;
            if (!mem || !mem.words) {
                alert("No text metrics stored in memory yet.");
                return;
            }

            $.writeln("=================================================================");
            $.writeln("AE IN-MEMORY TEXT BOX METRICS REPORT");
            $.writeln("=================================================================");
            $.writeln("Layer Name:   " + mem.layerName);
            $.writeln("Total Words:  " + mem.totalWords);
            $.writeln("Total Lines:  " + mem.totalLines);
            $.writeln("Max Line W:   " + mem.maxLineWidth + " px");
            $.writeln("Max Word W:   " + mem.maxWordWidth + " px");
            $.writeln("Space Width:  " + mem.spaceWidth + " px");
            $.writeln("-----------------------------------------------------------------");
            $.writeln("1. WORDS ARRAY & WIDTHS:");
            for (var w = 0; w < mem.words.length; w++) {
                $.writeln("  [" + w + "] \"" + mem.words[w] + "\" -> " + mem.wordWidths[w] + " px");
            }
            $.writeln("-----------------------------------------------------------------");
            $.writeln("2. LINES ARRAY & WIDTHS:");
            for (var l = 0; l < mem.lines.length; l++) {
                $.writeln("  Line " + (l + 1) + " (" + mem.lineWidths[l] + " px): \"" + mem.lines[l] + "\"");
            }
            $.writeln("=================================================================");
            setStatus("Printed text metrics to ExtendScript Console ($.writeln).");
        };

        // Window resize handlers
        win.layout.layout(true);
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        // Auto-initialize demo environment if starting with an empty comp
        try {
            var currComp = app.project ? app.project.activeItem : null;
            if (!currComp || currComp.layers.length === 0) {
                var initSel = getSelectedDefIds();
                createDemoEnvironment(initSel.map, getOptions());
                refreshMemoryDisplay();
                setStatus("Created demo comp with Point & Paragraph text layers.");
            } else {
                refreshMemoryDisplay();
            }
        } catch (eInit) {}

        return win;
    }


    // =========================================================================
    // 5. INITIALIZATION & EXECUTION
    // =========================================================================
    var panel = buildUI(thisObj);
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
