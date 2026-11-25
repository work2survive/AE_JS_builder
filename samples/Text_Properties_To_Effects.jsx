// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL:
// TEXT & BOX PROPERTIES TO EFFECTS (INSPECTOR & RIGGER) v1.3.1
// =============================================================================
//
// PURPOSE:
//   Exposes hidden After Effects text properties, paragraph box dimensions,
//   sourceRectAtTime() boundaries, alignment, indent, typography metrics, and
//   content counters as live, interactive Effect Controls (Sliders, Points,
//   Checkboxes, Colors) on the layer.
//
// OFFICIAL DOCUMENTATION & API REFERENCES:
//   - Adobe AE TextDocument API:
//     https://ae-scripting.docsforadobe.dev/text/textdocument/
//   - Adobe AE Scripting Changelog:
//     https://ae-scripting.docsforadobe.dev/introduction/changelog/
//   - AE vs Web JS Text Rendering Differences Guide:
//     https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
//   - Adobe AE Expression Reference:
//     https://helpx.adobe.com/after-effects/using/expression-language-reference.html#text_properties
//
// PROPERTY ACCESS NOTATION:
//   - [RO]  = Read-Only (Calculated dynamically by After Effects layout engine).
//   - [R/W] = Read / Write (Can be modified via ExtendScript TextDocument or Expression Style).
//
// IN-MEMORY METRICS STORE:
//   Automatically analyzes and stores in memory:
//     - Array with each word detected in the text box.
//     - Array with the width in pixels of each word.
//     - Array with the width in pixels of each text line.
//     - Real-time paragraph box dimensions, overflow state, and composed line count.
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
    var SCRIPT_VERSION = "v1.3.1";
    var DOC_TEXTDOC_URL = "https://ae-scripting.docsforadobe.dev/text/textdocument/";
    var DOC_CHANGELOG_URL = "https://ae-scripting.docsforadobe.dev/introduction/changelog/";
    var DOC_DIFFERENCES_URL = "https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md";

    // Global in-memory cache initialization
    var $global;
    try {
        $global = (typeof $ !== "undefined" && typeof $.global !== "undefined")
            ? $.global
            : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
    } catch (eG) {
        $global = this;
    }

    if (typeof $ === "undefined") {
        try {
            $global.$ = { global: $global, writeln: function (msg) { if (typeof console !== "undefined") console.log(msg); } };
        } catch (eDol) {}
    } else {
        try {
            if (typeof $.global === "undefined") $.global = $global;
        } catch (eDol2) {}
    }

    var $memGlobal = (typeof $ !== "undefined" && typeof $.global !== "undefined") ? $.global : $global;
    if (typeof $memGlobal.AE_TEXT_BOX_MEMORY === "undefined") {
        $memGlobal.AE_TEXT_BOX_MEMORY = {
            layerName: "",
            textType: 0,
            isBoxText: 0,
            textTypeName: "Point Text",
            words: [],
            wordWidths: [],
            lines: [],
            lineWidths: [],
            spaceWidth: 0,
            fontSize: 0,
            boxWidth: 0,
            boxHeight: 0,
            boxOverflow: 0,
            boxInsetSpacing: 0,
            boxVerticalAlignment: 7512,
            boxFirstBaselineAlignment: 7612,
            boxAutoFitPolicy: 7712,
            lineOrientation: 7312,
            totalWords: 0,
            totalLines: 0,
            composedLineCount: 0,
            paragraphCount: 0,
            firstLineIndent: 0,
            startIndent: 0,
            endIndent: 0,
            spaceBefore: 0,
            spaceAfter: 0,
            autoHyphenate: false,
            hangingRoman: false,
            everyLineComposer: false,
            maxLineWidth: 0,
            maxWordWidth: 0,
            timestamp: 0
        };
    }

    // Helper to safely open external URLs in default web browser
    function openExternalURL(url) {
        if (!url) return;
        try {
            if ($.os && $.os.indexOf("Windows") !== -1) {
                system.callSystem('cmd.exe /c start "" "' + url + '"');
            } else {
                system.callSystem('open "' + url + '"');
            }
        } catch (eSys) {
            try {
                var f = new File(Folder.temp.fsName + "/open_url.url");
                f.open("w");
                f.writeln("[InternetShortcut]");
                f.writeln("URL=" + url);
                f.close();
                f.execute();
            } catch (eFile) {}
        }
    }

    // =========================================================================
    // 1. PROPERTY DEFINITIONS CATALOG
    // =========================================================================
    var PROPERTY_DEFS = [
        // =====================================================================
        // CATEGORY: BOX & DIMENSIONS
        // =====================================================================
        {
            id: "text_type",
            category: "box",
            access: "RO",
            label: "[RO] Text Type: Point (0) / Box (1)",
            effectName: "Text Type (0:Point, 1:Box)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtext",
            tooltip: "[RO] Text Type: 0 for Point Text, 1 for Paragraph Box Text (isParagraphText / boxText)",
            expression: "try {\n    var st = text.sourceText;\n    if (typeof st.isParagraphText !== 'undefined') {\n        st.isParagraphText ? 1 : 0;\n    } else if (typeof st.isPointText !== 'undefined') {\n        st.isPointText ? 0 : 1;\n    } else if (st.style && typeof st.style.boxText !== 'undefined') {\n        st.style.boxText ? 1 : 0;\n    } else if (typeof st.boxText !== 'undefined') {\n        st.boxText ? 1 : 0;\n    } else if (st.style && st.style.boxTextSize && st.style.boxTextSize[0] > 0) {\n        1;\n    } else if (st.value && typeof st.value.boxText !== 'undefined') {\n        st.value.boxText ? 1 : 0;\n    } else {\n        0;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (!textDoc) return 0;
                if (typeof textDoc.boxText !== "undefined") return textDoc.boxText ? 1 : 0;
                if (typeof textDoc.pointText !== "undefined") return textDoc.pointText ? 0 : 1;
                return 0;
            }
        },
        {
            id: "box_is_box",
            category: "box",
            access: "RO",
            label: "[RO] Is Paragraph Box Text (0/1)",
            effectName: "Is Paragraph Box Text",
            matchName: "ADBE Checkbox Control",
            type: "checkbox",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtext",
            tooltip: "[RO] Checkbox: 0 (unchecked) if Point Text, 1 (checked) if Paragraph Box Text",
            expression: "try {\n    var st = text.sourceText;\n    if (typeof st.isParagraphText !== 'undefined') {\n        st.isParagraphText ? 1 : 0;\n    } else if (typeof st.isPointText !== 'undefined') {\n        st.isPointText ? 0 : 1;\n    } else if (st.style && typeof st.style.boxText !== 'undefined') {\n        st.style.boxText ? 1 : 0;\n    } else if (typeof st.boxText !== 'undefined') {\n        st.boxText ? 1 : 0;\n    } else if (st.style && st.style.boxTextSize && st.style.boxTextSize[0] > 0) {\n        1;\n    } else if (st.value && typeof st.value.boxText !== 'undefined') {\n        st.value.boxText ? 1 : 0;\n    } else {\n        0;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (!textDoc) return 0;
                if (typeof textDoc.boxText !== "undefined") return textDoc.boxText ? 1 : 0;
                if (typeof textDoc.pointText !== "undefined") return textDoc.pointText ? 0 : 1;
                return 0;
            }
        },
        {
            id: "box_overflow",
            category: "box",
            access: "RO",
            label: "[RO] Box Overflow (Overset)",
            effectName: "Box Overflow",
            matchName: "ADBE Checkbox Control",
            type: "checkbox",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxoverflow",
            tooltip: "[RO] TextDocument.boxOverflow — Returns true if text overflows paragraph box frame (AE 24.6+)",
            expression: "try {\n    var st = text.sourceText;\n    if (typeof st.boxOverflow !== 'undefined') {\n        st.boxOverflow ? 1 : 0;\n    } else if (st.style && typeof st.style.boxOverflow !== 'undefined') {\n        st.style.boxOverflow ? 1 : 0;\n    } else if (st.style && st.style.boxText && st.style.boxTextSize) {\n        var r = sourceRectAtTime(time, false);\n        (r.height > st.style.boxTextSize[1] || r.width > st.style.boxTextSize[0]) ? 1 : 0;\n    } else {\n        0;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && typeof textDoc.boxOverflow !== "undefined") return textDoc.boxOverflow ? 1 : 0;
                if (textDoc && textDoc.boxText && textDoc.boxTextSize && rect) {
                    return (rect.height > textDoc.boxTextSize[1] || rect.width > textDoc.boxTextSize[0]) ? 1 : 0;
                }
                return 0;
            }
        },
        {
            id: "box_width",
            category: "box",
            access: "RW",
            label: "[R/W] Paragraph Box Width",
            effectName: "Box Text Width",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtextsize",
            tooltip: "[R/W] TextDocument.boxTextSize[0] — Width of paragraph text box frame in pixels",
            expression: "try {\n    var st = text.sourceText;\n    if (st && st.style && st.style.boxText && st.style.boxTextSize) {\n        st.style.boxTextSize[0];\n    } else {\n        sourceRectAtTime(time, false).width;\n    }\n} catch (err) {\n    sourceRectAtTime(time, false).width;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && textDoc.boxText && textDoc.boxTextSize) return textDoc.boxTextSize[0];
                return rect ? rect.width : 0;
            }
        },
        {
            id: "box_height",
            category: "box",
            access: "RW",
            label: "[R/W] Paragraph Box Height",
            effectName: "Box Text Height",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtextsize",
            tooltip: "[R/W] TextDocument.boxTextSize[1] — Height of paragraph text box frame in pixels",
            expression: "try {\n    var st = text.sourceText;\n    if (st && st.style && st.style.boxText && st.style.boxTextSize) {\n        st.style.boxTextSize[1];\n    } else {\n        sourceRectAtTime(time, false).height;\n    }\n} catch (err) {\n    sourceRectAtTime(time, false).height;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && textDoc.boxText && textDoc.boxTextSize) return textDoc.boxTextSize[1];
                return rect ? rect.height : 0;
            }
        },
        {
            id: "box_size",
            category: "box",
            access: "RW",
            label: "[R/W] Paragraph Box Size [W, H]",
            effectName: "Box Text Size [W, H]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtextsize",
            tooltip: "[R/W] TextDocument.boxTextSize — 2D Point [width, height] of paragraph box",
            expression: "try {\n    var st = text.sourceText;\n    if (st && st.style && st.style.boxText && st.style.boxTextSize) {\n        st.style.boxTextSize;\n    } else {\n        var r = sourceRectAtTime(time, false);\n        [r.width, r.height];\n    }\n} catch (err) {\n    var r = sourceRectAtTime(time, false);\n    [r.width, r.height];\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (textDoc && textDoc.boxText && textDoc.boxTextSize) return textDoc.boxTextSize;
                return rect ? [rect.width, rect.height] : [0, 0];
            }
        },
        {
            id: "box_inset_spacing",
            category: "box",
            access: "RW",
            label: "[R/W] Box Inset Spacing (px)",
            effectName: "Box Inset Spacing",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxinsetspacing",
            tooltip: "[R/W] TextDocument.boxInsetSpacing — Padding / margin inset inside paragraph box (AE 24.6+)",
            expression: "try {\n    var st = text.sourceText;\n    (typeof st.boxInsetSpacing !== 'undefined') ? st.boxInsetSpacing : (st.style && typeof st.style.boxInsetSpacing !== 'undefined' ? st.style.boxInsetSpacing : 0);\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && typeof textDoc.boxInsetSpacing !== "undefined") ? textDoc.boxInsetSpacing : 0;
            }
        },
        {
            id: "box_vertical_align",
            category: "box",
            access: "RW",
            label: "[R/W] Box Vertical Alignment (0..3)",
            effectName: "Box Vertical Alignment",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxverticalalignment",
            tooltip: "[R/W] TextDocument.boxVerticalAlignment — 0:Top (7512), 1:Center (7513), 2:Bottom (7514), 3:Justify (7515) (AE 24.6+)",
            expression: "try {\n    var st = text.sourceText;\n    var va = (typeof st.boxVerticalAlignment !== 'undefined') ? st.boxVerticalAlignment : (st.style && typeof st.style.boxVerticalAlignment !== 'undefined' ? st.style.boxVerticalAlignment : 0);\n    if (typeof BoxVerticalAlignment !== 'undefined') {\n        if (va === BoxVerticalAlignment.CENTER) 1;\n        else if (va === BoxVerticalAlignment.BOTTOM) 2;\n        else if (va === BoxVerticalAlignment.JUSTIFY) 3;\n        else 0;\n    } else {\n        if (va == 7513) 1; else if (va == 7514) 2; else if (va == 7515) 3; else 0;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc || typeof textDoc.boxVerticalAlignment === "undefined") return 0;
                var va = textDoc.boxVerticalAlignment;
                return (va == 7513) ? 1 : ((va == 7514) ? 2 : ((va == 7515) ? 3 : 0));
            }
        },
        {
            id: "box_first_baseline",
            category: "box",
            access: "RW",
            label: "[R/W] Box First Baseline Align (0..6)",
            effectName: "Box First Baseline Align",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxfirstbaselinealignment",
            tooltip: "[R/W] TextDocument.boxFirstBaselineAlignment — Baseline offset policy (0:Ascent, 1:Cap, 2:Leading, 3:X-Height, 4:Low-Cap, 5:Fixed, 6:Prop) (AE 24.6+)",
            expression: "try {\n    var st = text.sourceText;\n    var ba = (typeof st.boxFirstBaselineAlignment !== 'undefined') ? st.boxFirstBaselineAlignment : (st.style && typeof st.style.boxFirstBaselineAlignment !== 'undefined' ? st.style.boxFirstBaselineAlignment : 0);\n    (ba >= 7612 && ba <= 7618) ? (ba - 7612) : 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc || typeof textDoc.boxFirstBaselineAlignment === "undefined") return 0;
                var ba = textDoc.boxFirstBaselineAlignment;
                return (ba >= 7612 && ba <= 7618) ? (ba - 7612) : 0;
            }
        },
        {
            id: "box_auto_fit",
            category: "box",
            access: "RW",
            label: "[R/W] Box Auto-Fit Policy (0..2)",
            effectName: "Box Auto-Fit Policy",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxautofitpolicy",
            tooltip: "[R/W] TextDocument.boxAutoFitPolicy — 0:None (7712), 1:Fit Font to Box (7713), 2:Fit Box to Text (7714) (AE 24.6+)",
            expression: "try {\n    var st = text.sourceText;\n    var af = (typeof st.boxAutoFitPolicy !== 'undefined') ? st.boxAutoFitPolicy : (st.style && typeof st.style.boxAutoFitPolicy !== 'undefined' ? st.style.boxAutoFitPolicy : 0);\n    if (af == 7713) 1; else if (af == 7714) 2; else 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc || typeof textDoc.boxAutoFitPolicy === "undefined") return 0;
                var af = textDoc.boxAutoFitPolicy;
                return (af == 7713) ? 1 : ((af == 7714) ? 2 : 0);
            }
        },
        {
            id: "line_orientation",
            category: "box",
            access: "RW",
            label: "[R/W] Line Orientation (0:H, 1:V-RTL, 2:V-LTR)",
            effectName: "Line Orientation",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-lineorientation",
            tooltip: "[R/W] TextDocument.lineOrientation — 0:Horizontal (7312), 1:Vertical RTL (7313), 2:Vertical LTR (7314) (AE 24.2+)",
            expression: "try {\n    var st = text.sourceText;\n    var lo = (typeof st.lineOrientation !== 'undefined') ? st.lineOrientation : (st.style && typeof st.style.lineOrientation !== 'undefined' ? st.style.lineOrientation : 0);\n    if (lo == 7313) 1; else if (lo == 7314) 2; else 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc || typeof textDoc.lineOrientation === "undefined") return 0;
                var lo = textDoc.lineOrientation;
                return (lo == 7313) ? 1 : ((lo == 7314) ? 2 : 0);
            }
        },

        // --- Visual Glyphs Bounds (sourceRectAtTime) ---
        {
            id: "sr_width",
            category: "bounds",
            access: "RO",
            label: "[RO] Text Width (sourceRect)",
            effectName: "Text Width (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] sourceRectAtTime(time, false).width — Dynamic width of text glyphs / bounds",
            expression: "sourceRectAtTime(time, false).width;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.width : 0; }
        },
        {
            id: "sr_height",
            category: "bounds",
            access: "RO",
            label: "[RO] Text Height (sourceRect)",
            effectName: "Text Height (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] sourceRectAtTime(time, false).height — Dynamic height of text glyphs / bounds",
            expression: "sourceRectAtTime(time, false).height;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.height : 0; }
        },
        {
            id: "sr_size",
            category: "bounds",
            access: "RO",
            label: "[RO] Visual Size [W, H]",
            effectName: "Visual Size [W, H]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] 2D Point [width, height] from sourceRectAtTime",
            expression: "var r = sourceRectAtTime(time, false);\n[r.width, r.height];",
            evalStatic: function (layer, textDoc, rect) { return rect ? [rect.width, rect.height] : [0, 0]; }
        },
        {
            id: "sr_left",
            category: "bounds",
            access: "RO",
            label: "[RO] Text Left Offset (X Min)",
            effectName: "Text Left (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] sourceRectAtTime(time, false).left — Horizontal distance from origin to text start",
            expression: "sourceRectAtTime(time, false).left;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.left : 0; }
        },
        {
            id: "sr_top",
            category: "bounds",
            access: "RO",
            label: "[RO] Text Top Offset (Y Min / Baseline)",
            effectName: "Text Top (sourceRect)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] sourceRectAtTime(time, false).top — Vertical distance from origin to top of text",
            expression: "sourceRectAtTime(time, false).top;",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.top : 0; }
        },
        {
            id: "sr_center",
            category: "bounds",
            access: "RO",
            label: "[RO] Visual Center Offset [X, Y]",
            effectName: "Visual Center Offset",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] Visual center point coordinates [left + width/2, top + height/2]",
            expression: "var r = sourceRectAtTime(time, false);\n[r.left + r.width / 2, r.top + r.height / 2];",
            evalStatic: function (layer, textDoc, rect) {
                return rect ? [rect.left + rect.width / 2, rect.top + rect.height / 2] : [0, 0];
            }
        },
        {
            id: "sr_min_corner",
            category: "bounds",
            access: "RO",
            label: "[RO] Min Corner [Left, Top]",
            effectName: "Min Corner [Left, Top]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] Top-Left boundary coordinate [left, top]",
            expression: "var r = sourceRectAtTime(time, false);\n[r.left, r.top];",
            evalStatic: function (layer, textDoc, rect) { return rect ? [rect.left, rect.top] : [0, 0]; }
        },
        {
            id: "sr_max_corner",
            category: "bounds",
            access: "RO",
            label: "[RO] Max Corner [Right, Bottom]",
            effectName: "Max Corner [Right, Bottom]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] Bottom-Right boundary coordinate [left + width, top + height]",
            expression: "var r = sourceRectAtTime(time, false);\n[r.left + r.width, r.top + r.height];",
            evalStatic: function (layer, textDoc, rect) {
                return rect ? [rect.left + rect.width, rect.top + rect.height] : [0, 0];
            }
        },

        // =====================================================================
        // CATEGORY: PARAGRAPH & ALIGNMENT
        // =====================================================================
        {
            id: "align_index",
            category: "align",
            access: "RW",
            label: "[R/W] Paragraph Alignment (0..3)",
            effectName: "Alignment Index",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-justification",
            tooltip: "[R/W] Paragraph justification: 0:Left, 1:Center, 2:Right, 3:Justified",
            expression: "try {\n    var j = text.sourceText.style.justification;\n    if (typeof ParagraphJustification !== 'undefined') {\n        if (j === ParagraphJustification.CENTER_JUSTIFY) 1;\n        else if (j === ParagraphJustification.RIGHT_JUSTIFY) 2;\n        else if (j === ParagraphJustification.LEFT_JUSTIFY) 0;\n        else 3;\n    } else {\n        if (j == 7414) 1; else if (j == 7413) 2; else 0;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (!textDoc || typeof textDoc.justification === "undefined") return 0;
                var j = textDoc.justification;
                return (j == 7414) ? 1 : ((j == 7413) ? 2 : 0);
            }
        },
        {
            id: "align_ratio",
            category: "align",
            access: "RW",
            label: "[R/W] Alignment Ratio (0..0.5..1.0)",
            effectName: "Alignment Ratio",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-justification",
            tooltip: "[R/W] Normalized justification factor: 0.0 (Left), 0.5 (Center), 1.0 (Right)",
            expression: "try {\n    var j = text.sourceText.style.justification;\n    if (typeof ParagraphJustification !== 'undefined') {\n        if (j === ParagraphJustification.CENTER_JUSTIFY) 0.5;\n        else if (j === ParagraphJustification.RIGHT_JUSTIFY) 1.0;\n        else 0.0;\n    } else {\n        if (j == 7414) 0.5; else if (j == 7413) 1.0; else 0.0;\n    }\n} catch (err) {\n    0.0;\n}",
            evalStatic: function (layer, textDoc, rect) {
                if (!textDoc || typeof textDoc.justification === "undefined") return 0;
                var j = textDoc.justification;
                return (j == 7414) ? 0.5 : ((j == 7413) ? 1.0 : 0.0);
            }
        },
        {
            id: "first_line_indent",
            category: "align",
            access: "RW",
            label: "[R/W] First Line Indent (px)",
            effectName: "First Line Indent (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-firstlineindent",
            tooltip: "[R/W] TextDocument.firstLineIndent — First line indent in pixels (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    (typeof st.firstLineIndent !== 'undefined') ? st.firstLineIndent : (st.style && typeof st.style.firstLineIndent !== 'undefined' ? st.style.firstLineIndent : 0);\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && typeof textDoc.firstLineIndent !== "undefined") ? textDoc.firstLineIndent : 0;
            }
        },
        {
            id: "start_indent",
            category: "align",
            access: "RW",
            label: "[R/W] Start / Left Indent (px)",
            effectName: "Start Indent (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-startindent",
            tooltip: "[R/W] TextDocument.startIndent — Left / start margin indent in pixels (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    (typeof st.startIndent !== 'undefined') ? st.startIndent : (st.style && typeof st.style.startIndent !== 'undefined' ? st.style.startIndent : 0);\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && typeof textDoc.startIndent !== "undefined") ? textDoc.startIndent : 0;
            }
        },
        {
            id: "end_indent",
            category: "align",
            access: "RW",
            label: "[R/W] End / Right Indent (px)",
            effectName: "End Indent (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-endindent",
            tooltip: "[R/W] TextDocument.endIndent — Right / end margin indent in pixels (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    (typeof st.endIndent !== 'undefined') ? st.endIndent : (st.style && typeof st.style.endIndent !== 'undefined' ? st.style.endIndent : 0);\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && typeof textDoc.endIndent !== "undefined") ? textDoc.endIndent : 0;
            }
        },
        {
            id: "space_before",
            category: "align",
            access: "RW",
            label: "[R/W] Space Before Paragraph (px)",
            effectName: "Space Before (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-spacebefore",
            tooltip: "[R/W] TextDocument.spaceBefore — Vertical space added before paragraph in pixels (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    (typeof st.spaceBefore !== 'undefined') ? st.spaceBefore : (st.style && typeof st.style.spaceBefore !== 'undefined' ? st.style.spaceBefore : 0);\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && typeof textDoc.spaceBefore !== "undefined") ? textDoc.spaceBefore : 0;
            }
        },
        {
            id: "space_after",
            category: "align",
            access: "RW",
            label: "[R/W] Space After Paragraph (px)",
            effectName: "Space After (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-spaceafter",
            tooltip: "[R/W] TextDocument.spaceAfter — Vertical space added after paragraph in pixels (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    (typeof st.spaceAfter !== 'undefined') ? st.spaceAfter : (st.style && typeof st.style.spaceAfter !== 'undefined' ? st.style.spaceAfter : 0);\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && typeof textDoc.spaceAfter !== "undefined") ? textDoc.spaceAfter : 0;
            }
        },
        {
            id: "auto_hyphenate",
            category: "align",
            access: "RW",
            label: "[R/W] Auto Hyphenation",
            effectName: "Auto Hyphenation",
            matchName: "ADBE Checkbox Control",
            type: "checkbox",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-autohyphenate",
            tooltip: "[R/W] TextDocument.autoHyphenate — Automatic word hyphenation enabled (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    var h = (typeof st.autoHyphenate !== 'undefined') ? st.autoHyphenate : (st.style && typeof st.style.autoHyphenate !== 'undefined' ? st.style.autoHyphenate : false);\n    h ? 1 : 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && textDoc.autoHyphenate) ? 1 : 0;
            }
        },
        {
            id: "hanging_roman",
            category: "align",
            access: "RW",
            label: "[R/W] Hanging Roman Punctuation",
            effectName: "Hanging Roman",
            matchName: "ADBE Checkbox Control",
            type: "checkbox",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-hangingroman",
            tooltip: "[R/W] TextDocument.hangingRoman — Punctuation hangs outside paragraph margins (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    var hr = (typeof st.hangingRoman !== 'undefined') ? st.hangingRoman : (st.style && typeof st.style.hangingRoman !== 'undefined' ? st.style.hangingRoman : false);\n    hr ? 1 : 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && textDoc.hangingRoman) ? 1 : 0;
            }
        },
        {
            id: "every_line_composer",
            category: "align",
            access: "RW",
            label: "[R/W] Every-Line Composer",
            effectName: "Every-Line Composer",
            matchName: "ADBE Checkbox Control",
            type: "checkbox",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-everylinecomposer",
            tooltip: "[R/W] TextDocument.everyLineComposer — Multi-line paragraph optimizer vs single-line (AE 24.0+)",
            expression: "try {\n    var st = text.sourceText;\n    var elc = (typeof st.everyLineComposer !== 'undefined') ? st.everyLineComposer : (st.style && typeof st.style.everyLineComposer !== 'undefined' ? st.style.everyLineComposer : false);\n    elc ? 1 : 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return (textDoc && textDoc.everyLineComposer) ? 1 : 0;
            }
        },
        {
            id: "indent_left",
            category: "align",
            access: "RO",
            label: "[RO] Visual Left Indent (px)",
            effectName: "Indent / Left Margin",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] Horizontal offset to the beginning of text glyphs (measures paragraph visual indent)",
            expression: "try {\n    sourceRectAtTime(time, false).left;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.left : 0; }
        },
        {
            id: "indent_right_spare",
            category: "align",
            access: "RO",
            label: "[RO] Box Right Margin (Spare Width)",
            effectName: "Box Right Margin (Spare)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtextsize",
            tooltip: "[RO] Remaining horizontal whitespace in paragraph box before line wraps",
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
            category: "align",
            access: "RO",
            label: "[RO] Baseline Offset (Top Margin)",
            effectName: "Baseline Offset (Top)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] Vertical ascent / distance from baseline to top of box",
            expression: "try {\n    sourceRectAtTime(time, false).top;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc, rect) { return rect ? rect.top : 0; }
        },

        // =====================================================================
        // CATEGORY: CHARACTER & TYPOGRAPHY STYLE
        // =====================================================================
        {
            id: "typo_font_size",
            category: "typo",
            access: "RW",
            label: "[R/W] Font Size (px)",
            effectName: "Font Size (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-fontsize",
            tooltip: "[R/W] Layer font size in pixels (text.sourceText.style.fontSize)",
            expression: "try {\n    text.sourceText.style.fontSize;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) { return textDoc ? textDoc.fontSize : 0; }
        },
        {
            id: "typo_leading",
            category: "typo",
            access: "RW",
            label: "[R/W] Leading (Line Spacing)",
            effectName: "Leading (Line Spacing)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-leading",
            tooltip: "[R/W] Leading / line-height in pixels",
            expression: "try {\n    var s = text.sourceText.style;\n    s.autoLeading ? (s.fontSize * 1.2) : s.leading;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc) return 0;
                return textDoc.autoLeading ? (textDoc.fontSize * 1.2) : textDoc.leading;
            }
        },
        {
            id: "typo_tracking",
            category: "typo",
            access: "RW",
            label: "[R/W] Tracking (Letter Spacing)",
            effectName: "Tracking",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-tracking",
            tooltip: "[R/W] Letter tracking (spacing between glyphs in 1/1000 em)",
            expression: "try {\n    text.sourceText.style.tracking;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) { return textDoc ? textDoc.tracking : 0; }
        },
        {
            id: "typo_baseline_shift",
            category: "typo",
            access: "RW",
            label: "[R/W] Baseline Shift",
            effectName: "Baseline Shift",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-baselineshift",
            tooltip: "[R/W] Vertical baseline shift in pixels",
            expression: "try {\n    text.sourceText.style.baselineShift;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) { return textDoc ? textDoc.baselineShift : 0; }
        },
        {
            id: "typo_stroke_width",
            category: "typo",
            access: "RW",
            label: "[R/W] Stroke Width",
            effectName: "Text Stroke Width",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-strokewidth",
            tooltip: "[R/W] Character stroke outline width in pixels",
            expression: "try {\n    var s = text.sourceText.style;\n    s.applyStroke ? s.strokeWidth : 0;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (!textDoc) return 0;
                return textDoc.applyStroke ? textDoc.strokeWidth : 0;
            }
        },
        {
            id: "typo_fill_color",
            category: "typo",
            access: "RW",
            label: "[R/W] Fill Color",
            effectName: "Text Fill Color",
            matchName: "ADBE Color Control",
            type: "color",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-fillcolor",
            tooltip: "[R/W] Live text fill color [R, G, B, A]",
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
            access: "RW",
            label: "[R/W] Stroke Color",
            effectName: "Text Stroke Color",
            matchName: "ADBE Color Control",
            type: "color",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-strokecolor",
            tooltip: "[R/W] Live text stroke color [R, G, B, A]",
            expression: "try {\n    var s = text.sourceText.style;\n    s.applyStroke ? s.strokeColor : [0, 0, 0, 1];\n} catch (err) {\n    [0, 0, 0, 1];\n}",
            evalStatic: function (layer, textDoc) {
                if (textDoc && textDoc.applyStroke && textDoc.strokeColor) {
                    var c = textDoc.strokeColor;
                    return [c[0], c[1], c[2], 1];
                }
                return [0, 0, 0, 1];
            }
        },

        // =====================================================================
        // CATEGORY: COUNTERS & CONTENT METRICS
        // =====================================================================
        {
            id: "cnt_lines",
            category: "counters",
            access: "RO",
            label: "[RO] Composed Line Count (Slider)",
            effectName: "Amount of Text Lines",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-composedlinecount",
            tooltip: "[RO] TextDocument.composedLineCount — Exact number of composed/wrapped lines in paragraph box (AE 24.3+)",
            expression: "try {\n    var st = text.sourceText;\n    if (typeof st.composedLineCount === 'number') {\n        st.composedLineCount;\n    } else if (st.style && typeof st.style.composedLineCount === 'number') {\n        st.style.composedLineCount;\n    } else if (st.style && st.style.boxText) {\n        var l = st.style.leading;\n        if (st.style.autoLeading || l <= 0) l = st.style.fontSize * 1.2;\n        var r = sourceRectAtTime(time, false);\n        Math.max(1, Math.round(r.height / l));\n    } else {\n        var str = String(st.value || st || '');\n        str.length === 0 ? 0 : str.split(/\\r\\n|\\r|\\n/).length;\n    }\n} catch (err) {\n    try {\n        var str = String(text.sourceText.value || text.sourceText || '');\n        str.length === 0 ? 0 : str.split(/\\r\\n|\\r|\\n/).length;\n    } catch(e) { 0; }\n}",
            evalStatic: function (layer, textDoc) {
                if (textDoc && typeof textDoc.composedLineCount === "number") return textDoc.composedLineCount;
                if ($.global.AE_TEXT_BOX_MEMORY && typeof $.global.AE_TEXT_BOX_MEMORY.composedLineCount === "number") {
                    return $.global.AE_TEXT_BOX_MEMORY.composedLineCount;
                }
                var s = textDoc ? String(textDoc.text || "") : "";
                return s.length === 0 ? 0 : s.split(/\r\n|\r|\n/).length;
            }
        },
        {
            id: "cnt_words",
            category: "counters",
            access: "RO",
            label: "[RO] Amount of Words (Slider)",
            effectName: "Amount of Words",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: true,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-text",
            tooltip: "[RO] Total amount of words detected in the text box",
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
            id: "cnt_paragraphs",
            category: "counters",
            access: "RO",
            label: "[RO] Paragraph Count (Hard Returns)",
            effectName: "Paragraph Count",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-paragraphcount",
            tooltip: "[RO] TextDocument.paragraphCount — Number of paragraphs separated by hard returns (AE 24.3+)",
            expression: "try {\n    var st = text.sourceText;\n    if (typeof st.paragraphCount === 'number') {\n        st.paragraphCount;\n    } else if (st.style && typeof st.style.paragraphCount === 'number') {\n        st.style.paragraphCount;\n    } else {\n        var str = String(st.value || st || '').replace(/^\\s+|\\s+$/g, '');\n        str.length === 0 ? 0 : str.split(/\\r\\n|\\r|\\n/).length;\n    }\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                if (textDoc && typeof textDoc.paragraphCount === "number") return textDoc.paragraphCount;
                var s = textDoc ? String(textDoc.text || "").replace(/^\s+|\s+$/g, "") : "";
                return s.length === 0 ? 0 : s.split(/\r\n|\r|\n/).length;
            }
        },
        {
            id: "cnt_chars",
            category: "counters",
            access: "RO",
            label: "[RO] Character Count",
            effectName: "Character Count",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-text",
            tooltip: "[RO] Total character count of the text string",
            expression: "try {\n    String(text.sourceText.value || text.sourceText || '').length;\n} catch (err) {\n    0;\n}",
            evalStatic: function (layer, textDoc) {
                return textDoc ? String(textDoc.text || "").length : 0;
            }
        },
        {
            id: "metric_max_line",
            category: "counters",
            access: "RO",
            label: "[RO] Longest Line Width (px)",
            effectName: "Longest Line Width (px)",
            matchName: "ADBE Slider Control",
            type: "slider",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] Maximum pixel width among all lines in the text box",
            expression: "sourceRectAtTime(time, false).width;",
            evalStatic: function (layer, textDoc, rect) {
                if ($.global.AE_TEXT_BOX_MEMORY && $.global.AE_TEXT_BOX_MEMORY.maxLineWidth) {
                    return $.global.AE_TEXT_BOX_MEMORY.maxLineWidth;
                }
                return rect ? rect.width : 0;
            }
        },

        // =====================================================================
        // CATEGORY: RESPONSIVE RIGGING UTILITIES
        // =====================================================================
        {
            id: "rig_padding",
            category: "rigging",
            access: "RW",
            label: "[R/W] Box Padding [X, Y]",
            effectName: "Box Padding [X, Y]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[R/W] Customizable 2D Padding [X, Y] for dynamic background card (Default: [40, 20])",
            expression: null,
            defaultVal: [40, 20],
            evalStatic: function () { return [40, 20]; }
        },
        {
            id: "rig_padded_size",
            category: "rigging",
            access: "RO",
            label: "[RO] Total Padded Size [W, H]",
            effectName: "Total Padded Size [W, H]",
            matchName: "ADBE Point Control",
            type: "point",
            defaultChecked: false,
            docUrl: "https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime",
            tooltip: "[RO] Calculates [sourceRect.width + padX*2, sourceRect.height + padY*2]",
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
     *   4. Real-time box overflow, composed lines, and paragraph counts.
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
            var emptyIsBox = (textDoc && (textDoc.boxText === true || (typeof textDoc.pointText !== "undefined" && !textDoc.pointText))) ? 1 : 0;
            var emptyStore = {
                layerName: layer.name,
                layerIndex: layer.index,
                fullText: "",
                textType: emptyIsBox,
                isBoxText: emptyIsBox,
                textTypeName: emptyIsBox ? "Box Text" : "Point Text",
                words: [],
                wordWidths: [],
                lines: [],
                lineWidths: [],
                spaceWidth: 0,
                fontSize: textDoc.fontSize || 0,
                font: textDoc.font || "",
                boxWidth: 0,
                boxHeight: 0,
                boxOverflow: 0,
                boxInsetSpacing: (typeof textDoc.boxInsetSpacing !== "undefined") ? textDoc.boxInsetSpacing : 0,
                boxVerticalAlignment: (typeof textDoc.boxVerticalAlignment !== "undefined") ? textDoc.boxVerticalAlignment : 7512,
                boxFirstBaselineAlignment: (typeof textDoc.boxFirstBaselineAlignment !== "undefined") ? textDoc.boxFirstBaselineAlignment : 7612,
                boxAutoFitPolicy: (typeof textDoc.boxAutoFitPolicy !== "undefined") ? textDoc.boxAutoFitPolicy : 7712,
                lineOrientation: (typeof textDoc.lineOrientation !== "undefined") ? textDoc.lineOrientation : 7312,
                totalWords: 0,
                totalLines: 0,
                composedLineCount: 0,
                paragraphCount: 0,
                firstLineIndent: (typeof textDoc.firstLineIndent !== "undefined") ? textDoc.firstLineIndent : 0,
                startIndent: (typeof textDoc.startIndent !== "undefined") ? textDoc.startIndent : 0,
                endIndent: (typeof textDoc.endIndent !== "undefined") ? textDoc.endIndent : 0,
                spaceBefore: (typeof textDoc.spaceBefore !== "undefined") ? textDoc.spaceBefore : 0,
                spaceAfter: (typeof textDoc.spaceAfter !== "undefined") ? textDoc.spaceAfter : 0,
                autoHyphenate: Boolean(textDoc.autoHyphenate),
                hangingRoman: Boolean(textDoc.hangingRoman),
                everyLineComposer: Boolean(textDoc.everyLineComposer),
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
            } else if (textDoc.boxText || (typeof textDoc.pointText !== "undefined" && !textDoc.pointText)) {
                isBox = true;
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

        var isBoxVal = isBox ? 1 : 0;
        var rActual = getSourceRect(layer);
        var isOverflow = 0;
        if (textDoc && typeof textDoc.boxOverflow !== "undefined") {
            isOverflow = textDoc.boxOverflow ? 1 : 0;
        } else if (isBox && boxHeight > 0 && rActual) {
            isOverflow = (rActual.height > boxHeight || rActual.width > boxWidth) ? 1 : 0;
        }

        var compLineCount = (textDoc && typeof textDoc.composedLineCount === "number")
            ? textDoc.composedLineCount
            : lines.length;

        var hardParaCount = (textDoc && typeof textDoc.paragraphCount === "number")
            ? textDoc.paragraphCount
            : (fullText.split(/\r\n|\r|\n/).length);

        var memoryStore = {
            layerName: layer.name,
            layerIndex: layer.index,
            fullText: fullText,
            textType: isBoxVal,
            isBoxText: isBoxVal,
            textTypeName: isBox ? "Box Text" : "Point Text",
            words: words,
            wordWidths: wordWidths,
            lines: lines,
            lineWidths: lineWidths,
            spaceWidth: spaceWidth,
            fontSize: textDoc.fontSize,
            font: textDoc.font || "",
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            boxOverflow: isOverflow,
            boxInsetSpacing: (typeof textDoc.boxInsetSpacing !== "undefined") ? textDoc.boxInsetSpacing : 0,
            boxVerticalAlignment: (typeof textDoc.boxVerticalAlignment !== "undefined") ? textDoc.boxVerticalAlignment : 7512,
            boxFirstBaselineAlignment: (typeof textDoc.boxFirstBaselineAlignment !== "undefined") ? textDoc.boxFirstBaselineAlignment : 7612,
            boxAutoFitPolicy: (typeof textDoc.boxAutoFitPolicy !== "undefined") ? textDoc.boxAutoFitPolicy : 7712,
            lineOrientation: (typeof textDoc.lineOrientation !== "undefined") ? textDoc.lineOrientation : 7312,
            totalWords: words.length,
            totalLines: lines.length,
            composedLineCount: compLineCount,
            paragraphCount: hardParaCount,
            firstLineIndent: (typeof textDoc.firstLineIndent !== "undefined") ? textDoc.firstLineIndent : 0,
            startIndent: (typeof textDoc.startIndent !== "undefined") ? textDoc.startIndent : 0,
            endIndent: (typeof textDoc.endIndent !== "undefined") ? textDoc.endIndent : 0,
            spaceBefore: (typeof textDoc.spaceBefore !== "undefined") ? textDoc.spaceBefore : 0,
            spaceAfter: (typeof textDoc.spaceAfter !== "undefined") ? textDoc.spaceAfter : 0,
            autoHyphenate: Boolean(textDoc.autoHyphenate),
            hangingRoman: Boolean(textDoc.hangingRoman),
            everyLineComposer: Boolean(textDoc.everyLineComposer),
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

    function createDummyTextLayer(comp) {
        if (!comp) return null;
        var dummyName = "Selected Text Layer (Demo)";
        var existing = null;
        try {
            existing = comp.layer(dummyName);
        } catch (eFind) {}
        if (existing) return existing;

        var dummyLayer = comp.layers.addText("Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nSed do eiusmod tempor.");
        dummyLayer.name = dummyName;
        dummyLayer.property("Transform").property("Position").setValue([comp.width / 2, comp.height / 2]);

        try {
            var docProp = dummyLayer.property("Source Text");
            if (docProp) {
                var doc = docProp.value;
                if (doc) {
                    doc.fontSize = 36;
                    doc.applyFill = true;
                    doc.fillColor = [1, 1, 1];
                    try {
                        if (typeof doc.setBoxTextSize === "function") {
                            doc.setBoxTextSize([820, 420]);
                        }
                    } catch (eBox) {}
                    docProp.setValue(doc);
                }
            }
        } catch (eDoc) {}

        try {
            for (var i = 1; i <= comp.layers.length; i++) {
                comp.layers[i].selected = false;
            }
        } catch (eDesel) {}
        dummyLayer.selected = true;

        return dummyLayer;
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
    function buildUI(thisObj) {
        var isPanel = (typeof Panel !== "undefined" && thisObj instanceof Panel);
        var win = isPanel
            ? thisObj
            : (typeof Window !== "undefined" ? new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, { resizeable: true }) : null);
        if (!win) return null;
        if (!isPanel) {
            win.text = SCRIPT_NAME + " " + SCRIPT_VERSION;
        }

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;
        win.preferredSize = [500, 520];

        // ---------------------------------------------------------------------
        // Header Banner & Preset Quick-Select Toolbar
        // ---------------------------------------------------------------------
        var grpHeader = win.add("group");
        grpHeader.orientation = "column";
        grpHeader.alignChildren = ["fill", "top"];
        grpHeader.spacing = 2;

        var lblTitle = grpHeader.add("statictext", undefined, "✨ " + SCRIPT_NAME + " " + SCRIPT_VERSION);
        try {
            lblTitle.graphics.font = ScriptUI.newFont("Verdana", "BOLD", 12);
        } catch (eFont) {}

        var lblSub = grpHeader.add("statictext", undefined, "Expose native AE text & box properties to interactive timeline effects.");

        var grpToolbar = win.add("group");
        grpToolbar.orientation = "row";
        grpToolbar.alignChildren = ["fill", "center"];
        grpToolbar.spacing = 5;

        var btnPresetAll = grpToolbar.add("button", undefined, "Check All");
        btnPresetAll.helpTip = "Selects all property checkboxes across all tabs";

        var btnPresetNone = grpToolbar.add("button", undefined, "None");
        btnPresetNone.helpTip = "Clears all property checkboxes across all tabs";

        var btnPresetCommon = grpToolbar.add("button", undefined, "Common");
        btnPresetCommon.helpTip = "Selects core essentials: Text Type, Box Size, Overflow, Alignment, Indents, and Counters";

        var btnReadTimeline = grpToolbar.add("button", undefined, "🔄 Read Timeline");
        btnReadTimeline.helpTip = "Inspects selected layer and sets checkboxes to match effects currently active in timeline";

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

        // Helper to add checkbox and wire live timeline show/hide toggle with tooltip & link
        function addCheckboxItem(container, def) {
            var chk = container.add("checkbox", undefined, def.label);
            chk.value = def.defaultChecked;
            var tip = (def.tooltip || def.label);
            if (def.docUrl) {
                tip += "\nDocs: " + def.docUrl;
            }
            tip += "\n(Toggling shows or hides this effect in the timeline)";
            chk.helpTip = tip;
            chk.alignment = ["fill", "top"];
            checkboxMap[def.id] = chk;

            // Live event: Checking/unchecking shows or hides this effect on the timeline
            chk.onClick = function () {
                syncPropertyToTimeline(def, chk.value);
            };

            return chk;
        }

        // Helper to layout a list of property checkboxes into a clean 2-column grid
        function addTwoColumnCheckboxGrid(container, propIdList) {
            var grpCols = container.add("group");
            grpCols.orientation = "row";
            grpCols.alignChildren = ["fill", "top"];
            grpCols.alignment = ["fill", "top"];
            grpCols.spacing = 10;

            var col1 = grpCols.add("group");
            col1.orientation = "column";
            col1.alignChildren = ["fill", "top"];
            col1.alignment = ["fill", "top"];
            col1.spacing = 3;

            var col2 = grpCols.add("group");
            col2.orientation = "column";
            col2.alignChildren = ["fill", "top"];
            col2.alignment = ["fill", "top"];
            col2.spacing = 3;

            var half = Math.ceil(propIdList.length / 2);
            for (var i = 0; i < propIdList.length; i++) {
                var targetCol = (i < half) ? col1 : col2;
                var pDef = PROPERTY_DEFS_MAP[propIdList[i]];
                if (pDef) {
                    addCheckboxItem(targetCol, pDef);
                }
            }
            return grpCols;
        }

        // =====================================================================
        // TAB 1: 📐 BOX & DIMENSIONS
        // =====================================================================
        var tabBox = tpanel.add("tab", undefined, "📐 Box");
        tabBox.orientation = "column";
        tabBox.alignChildren = ["fill", "top"];
        tabBox.spacing = 6;
        tabBox.margins = 8;

        // Paragraph Box Frame Properties Panel (2 Columns)
        var pnlBoxFrame = tabBox.add("panel", undefined, "📐 Paragraph Box & Frame Properties");
        pnlBoxFrame.orientation = "column";
        pnlBoxFrame.alignChildren = ["fill", "top"];
        pnlBoxFrame.spacing = 3;

        var boxFrameProps = [
            "text_type", "box_is_box", "box_overflow",
            "box_width", "box_height", "box_size",
            "box_inset_spacing", "box_vertical_align",
            "box_first_baseline", "box_auto_fit", "line_orientation"
        ];
        addTwoColumnCheckboxGrid(pnlBoxFrame, boxFrameProps);

        // Visual Glyphs Bounds Panel (2 Columns)
        var pnlSR = tabBox.add("panel", undefined, "📐 Visual Glyphs Bounds (sourceRectAtTime)");
        pnlSR.orientation = "column";
        pnlSR.alignChildren = ["fill", "top"];
        pnlSR.spacing = 3;

        var srProps = ["sr_width", "sr_height", "sr_size", "sr_left", "sr_top", "sr_center", "sr_min_corner", "sr_max_corner"];
        addTwoColumnCheckboxGrid(pnlSR, srProps);

        // =====================================================================
        // TAB 2: 📝 PARAGRAPH & ALIGNMENT
        // =====================================================================
        var tabAlign = tpanel.add("tab", undefined, "📝 Paragraph");
        tabAlign.orientation = "column";
        tabAlign.alignChildren = ["fill", "top"];
        tabAlign.spacing = 6;
        tabAlign.margins = 8;

        // Alignment & Margins Panel (2 Columns)
        var pnlAlign = tabAlign.add("panel", undefined, "📝 Alignment & Margin Indents");
        pnlAlign.orientation = "column";
        pnlAlign.alignChildren = ["fill", "top"];
        pnlAlign.spacing = 3;

        var alignProps = ["align_index", "align_ratio", "first_line_indent", "start_indent", "end_indent", "indent_left", "indent_right_spare", "baseline_offset"];
        addTwoColumnCheckboxGrid(pnlAlign, alignProps);

        // Spacing & Paragraph Formatting Panel (2 Columns)
        var pnlSpacing = tabAlign.add("panel", undefined, "📝 Paragraph Spacing & Composers");
        pnlSpacing.orientation = "column";
        pnlSpacing.alignChildren = ["fill", "top"];
        pnlSpacing.spacing = 3;

        var spacingProps = ["space_before", "space_after", "auto_hyphenate", "hanging_roman", "every_line_composer"];
        addTwoColumnCheckboxGrid(pnlSpacing, spacingProps);

        // =====================================================================
        // TAB 3: 🎨 CHARACTER & STYLE
        // =====================================================================
        var tabStyle = tpanel.add("tab", undefined, "🎨 Style");
        tabStyle.orientation = "column";
        tabStyle.alignChildren = ["fill", "top"];
        tabStyle.spacing = 6;
        tabStyle.margins = 8;

        var pnlStyle = tabStyle.add("panel", undefined, "🎨 Character & Typography Properties");
        pnlStyle.orientation = "column";
        pnlStyle.alignChildren = ["fill", "top"];
        pnlStyle.spacing = 3;

        var typoProps = ["typo_font_size", "typo_leading", "typo_tracking", "typo_baseline_shift", "typo_stroke_width", "typo_fill_color", "typo_stroke_color"];
        addTwoColumnCheckboxGrid(pnlStyle, typoProps);

        // =====================================================================
        // TAB 4: 🔢 WORD, LINE & PARAGRAPH COUNTERS
        // =====================================================================
        var tabCounters = tpanel.add("tab", undefined, "🔢 Counters");
        tabCounters.orientation = "column";
        tabCounters.alignChildren = ["fill", "top"];
        tabCounters.spacing = 6;
        tabCounters.margins = 8;

        // Word, Line & Paragraph Counters Panel
        var pnlCounters = tabCounters.add("panel", undefined, "🔢 Counters (Timeline Sliders & Live Readouts)");
        pnlCounters.orientation = "column";
        pnlCounters.alignChildren = ["fill", "top"];
        pnlCounters.spacing = 5;

        // Row for Amount of Text Lines (Composed Lines): Checkbox + Scrub Slider + Readout
        var grpLineRow = pnlCounters.add("group");
        grpLineRow.orientation = "row";
        grpLineRow.alignment = ["fill", "center"];
        grpLineRow.spacing = 6;
        var chkLinesDef = PROPERTY_DEFS_MAP["cnt_lines"];
        var chkLineAmount = grpLineRow.add("checkbox", undefined, "Composed Lines:");
        chkLineAmount.value = true;
        chkLineAmount.preferredSize = [135, -1];
        chkLineAmount.helpTip = "[RO] Shows or hides 'Amount of Text Lines' (composedLineCount) Slider Control in the timeline\nDocs: " + (chkLinesDef ? chkLinesDef.docUrl : "");
        checkboxMap["cnt_lines"] = chkLineAmount;

        var sldLineAmount = grpLineRow.add("slider", undefined, 0, 0, 100);
        sldLineAmount.alignment = ["fill", "center"];
        var txtLineAmount = grpLineRow.add("edittext", undefined, "0");
        txtLineAmount.characters = 4;
        txtLineAmount.readonly = true;

        chkLineAmount.onClick = function () {
            if (chkLinesDef) syncPropertyToTimeline(chkLinesDef, chkLineAmount.value);
        };

        // Row for Amount of Words: Checkbox + Scrub Slider + Readout
        var grpWordRow = pnlCounters.add("group");
        grpWordRow.orientation = "row";
        grpWordRow.alignment = ["fill", "center"];
        grpWordRow.spacing = 6;
        var chkWordsDef = PROPERTY_DEFS_MAP["cnt_words"];
        var chkWordAmount = grpWordRow.add("checkbox", undefined, "Amount of Words:");
        chkWordAmount.value = true;
        chkWordAmount.preferredSize = [135, -1];
        chkWordAmount.helpTip = "[RO] Shows or hides 'Amount of Words' Slider Control in the timeline\nDocs: " + (chkWordsDef ? chkWordsDef.docUrl : "");
        checkboxMap["cnt_words"] = chkWordAmount;

        var sldWordAmount = grpWordRow.add("slider", undefined, 0, 0, 500);
        sldWordAmount.alignment = ["fill", "center"];
        var txtWordAmount = grpWordRow.add("edittext", undefined, "0");
        txtWordAmount.characters = 4;
        txtWordAmount.readonly = true;

        chkWordAmount.onClick = function () {
            if (chkWordsDef) syncPropertyToTimeline(chkWordsDef, chkWordAmount.value);
        };

        // Row for Paragraph Count: Checkbox + Scrub Slider + Readout
        var grpParaRow = pnlCounters.add("group");
        grpParaRow.orientation = "row";
        grpParaRow.alignment = ["fill", "center"];
        grpParaRow.spacing = 6;
        var chkParaDef = PROPERTY_DEFS_MAP["cnt_paragraphs"];
        var chkParaAmount = grpParaRow.add("checkbox", undefined, "Paragraph Count:");
        chkParaAmount.value = false;
        chkParaAmount.preferredSize = [135, -1];
        chkParaAmount.helpTip = "[RO] Shows or hides 'Paragraph Count' (paragraphCount) Slider Control in the timeline\nDocs: " + (chkParaDef ? chkParaDef.docUrl : "");
        checkboxMap["cnt_paragraphs"] = chkParaAmount;

        var sldParaAmount = grpParaRow.add("slider", undefined, 0, 0, 100);
        sldParaAmount.alignment = ["fill", "center"];
        var txtParaAmount = grpParaRow.add("edittext", undefined, "0");
        txtParaAmount.characters = 4;
        txtParaAmount.readonly = true;

        chkParaAmount.onClick = function () {
            if (chkParaDef) syncPropertyToTimeline(chkParaDef, chkParaAmount.value);
        };

        // Extra counter metrics: Longest Line Width & Characters
        var grpExtraCounters = pnlCounters.add("group");
        grpExtraCounters.orientation = "row";
        grpExtraCounters.alignment = ["fill", "center"];
        grpExtraCounters.spacing = 8;
        if (PROPERTY_DEFS_MAP["metric_max_line"]) addCheckboxItem(grpExtraCounters, PROPERTY_DEFS_MAP["metric_max_line"]);
        if (PROPERTY_DEFS_MAP["cnt_chars"]) addCheckboxItem(grpExtraCounters, PROPERTY_DEFS_MAP["cnt_chars"]);

        // =====================================================================
        // TAB 5: 💾 IN-MEMORY WORDS & LINES STORE
        // =====================================================================
        var tabMemory = tpanel.add("tab", undefined, "💾 Store");
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
            "Target: (None) | Type: Point | Words: 0 | Lines: 0 | Overset: No"
        );

        var grpMemViews = pnlMemStats.add("group");
        grpMemViews.orientation = "row";
        grpMemViews.alignChildren = ["left", "center"];
        grpMemViews.spacing = 8;
        var rdoViewWords = grpMemViews.add("radiobutton", undefined, "Words & Widths");
        var rdoViewLines = grpMemViews.add("radiobutton", undefined, "Lines & Widths");
        var rdoViewJSON = grpMemViews.add("radiobutton", undefined, "JSON Arrays");
        var rdoViewFull = grpMemViews.add("radiobutton", undefined, "Full Metrics");
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
        btnMeasure.helpTip = "Measures words and lines pixel widths, overflow, and updates the sliders & memory store";

        var btnCopyMem = grpMemBtns.add("button", undefined, "📋 Copy JSON");
        btnCopyMem.helpTip = "Copies in-memory words, wordWidths, and lineWidths arrays to clipboard";

        var btnPrintConsole = grpMemBtns.add("button", undefined, "📜 Output to Console");
        btnPrintConsole.helpTip = "Prints formatted word and line width tables to ExtendScript console";

        // =====================================================================
        // TAB 6: ⚙️ RIGGING OPTIONS & DOCUMENTATION
        // =====================================================================
        var tabOptions = tpanel.add("tab", undefined, "⚙️ Options");
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

        // Documentation & Links Panel
        var pnlDocs = tabOptions.add("panel", undefined, "📖 Documentation & Reference Links");
        pnlDocs.orientation = "column";
        pnlDocs.alignChildren = ["fill", "top"];
        pnlDocs.spacing = 4;

        var lblLegend = pnlDocs.add("statictext", undefined, "Legend: [RO] = Read-Only by layout engine | [R/W] = Read / Write");
        try {
            lblLegend.graphics.font = ScriptUI.newFont("Verdana", "BOLD", 9);
        } catch (eF2) {}

        var grpDocBtns = pnlDocs.add("group");
        grpDocBtns.orientation = "row";
        grpDocBtns.alignChildren = ["fill", "center"];
        grpDocBtns.spacing = 6;

        var btnOpenTextDoc = grpDocBtns.add("button", undefined, "🌐 TextDocument API");
        btnOpenTextDoc.helpTip = "Opens the official Adobe After Effects TextDocument Scripting Reference: " + DOC_TEXTDOC_URL;
        btnOpenTextDoc.onClick = function () { openExternalURL(DOC_TEXTDOC_URL); };

        var btnOpenChangelog = grpDocBtns.add("button", undefined, "🌐 AE Changelog");
        btnOpenChangelog.helpTip = "Opens the Adobe AE Scripting Changelog: " + DOC_CHANGELOG_URL;
        btnOpenChangelog.onClick = function () { openExternalURL(DOC_CHANGELOG_URL); };

        var btnOpenGuide = grpDocBtns.add("button", undefined, "📄 Differences Guide");
        btnOpenGuide.helpTip = "Opens the comprehensive AE vs Web JS Text Rendering Differences documentation: " + DOC_DIFFERENCES_URL;
        btnOpenGuide.onClick = function () { openExternalURL(DOC_DIFFERENCES_URL); };

        tpanel.selection = 0; // Tab 1 (Box) active by default

        // ---------------------------------------------------------------------
        // Action & Status Bar
        // ---------------------------------------------------------------------
        var grpActions = win.add("group");
        grpActions.orientation = "row";
        grpActions.alignChildren = ["fill", "center"];
        grpActions.spacing = 6;

        var btnApply = grpActions.add("button", undefined, "🚀 Build / Apply Checked Effects");
        btnApply.preferredSize = [-1, 34];
        btnApply.helpTip = "Builds and applies all currently checked property effects to selected text layers";

        var lblStatus = win.add("statictext", undefined, "Ready. Hover over any checkbox for explanation & documentation links.");
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

            var layers = comp.selectedLayers;
            if (!layers || layers.length === 0) {
                var foundText = null;
                for (var li = 1; li <= comp.layers.length; li++) {
                    if (isTextLayer(comp.layers[li])) {
                        foundText = comp.layers[li];
                        foundText.selected = true;
                        break;
                    }
                }
                if (!foundText) {
                    foundText = createDummyTextLayer(comp);
                }
                layers = [foundText];
            }

            var options = getOptions();
            var prefix = options.usePrefix ? "[Prop]" : "";
            var targetName = prefix ? (prefix + " " + def.effectName) : def.effectName;

            app.beginUndoGroup("Toggle Effect: " + def.effectName);
            try {
                for (var i = 0; i < layers.length; i++) {
                    var layer = layers[i];
                    var fxGroup = layer.property("ADBE Effect Parade") || layer.property("Effects");
                    if (!fxGroup) continue;

                    var existingFx = fxGroup.property(targetName) || fxGroup.property(def.effectName);

                    if (isChecked) {
                        if (existingFx) {
                            existingFx.enabled = true;
                        } else {
                            var singleMap = {};
                            singleMap[def.id] = true;
                            applyPropertiesToLayer(comp, layer, singleMap, options);
                        }
                    } else {
                        if (existingFx) {
                            existingFx.enabled = false;
                        }
                    }
                }
                setStatus((isChecked ? "Showed: " : "Hidden: ") + def.effectName + " in timeline.");
            } catch (syncErr) {
                setStatus("Error toggling " + def.effectName + ": " + syncErr.toString(), true);
            } finally {
                app.endUndoGroup();
            }
        }

        // ---------------------------------------------------------------------
        // In-Memory Store Refresh & Formatting Handlers
        // ---------------------------------------------------------------------
        function refreshMemoryDisplay() {
            var mem = $.global.AE_TEXT_BOX_MEMORY;
            if (!mem || !mem.words || mem.words.length === 0) {
                lblMemHeader.text = "Target: (None) | Type: Point | Words: 0 | Lines: 0 | Overset: No";
                txtMemDisplay.text = "// No text layer measured yet.\n// Select a text layer and click 'Measure Selected Text'.";
                txtWordAmount.text = "0";
                txtLineAmount.text = "0";
                txtParaAmount.text = "0";
                sldWordAmount.value = 0;
                sldLineAmount.value = 0;
                sldParaAmount.value = 0;
                return;
            }

            lblMemHeader.text = "Layer: '" + (mem.layerName || "Layer") + "' | " +
                (mem.textTypeName || (mem.textType ? "Box Text" : "Point Text")) +
                " | Words: " + mem.totalWords +
                " | Lines: " + (mem.composedLineCount || mem.totalLines) +
                " | Overset: " + (mem.boxOverflow ? "YES" : "NO");

            txtWordAmount.text = String(mem.totalWords);
            txtLineAmount.text = String(mem.composedLineCount || mem.totalLines);
            txtParaAmount.text = String(mem.paragraphCount || 1);
            sldWordAmount.value = Math.min(500, mem.totalWords);
            sldLineAmount.value = Math.min(100, (mem.composedLineCount || mem.totalLines));
            sldParaAmount.value = Math.min(100, (mem.paragraphCount || 1));

            if (rdoViewWords.value) {
                var outW = "// WORDS AND WIDTHS (IN PIXELS) FOR: '" + mem.layerName + "'\n";
                outW += "// Total Words: " + mem.totalWords + " | Space Width: " + mem.spaceWidth + " px\n";
                outW += "--------------------------------------------------------\n";
                outW += "INDEX | WORD                         | WIDTH (PX)\n";
                outW += "--------------------------------------------------------\n";
                for (var w = 0; w < mem.words.length; w++) {
                    var idx = (w + 1 < 10 ? "0" : "") + (w + 1);
                    var wordStr = mem.words[w];
                    while (wordStr.length < 28) wordStr += " ";
                    outW += "[" + idx + "] | " + wordStr + " | " + mem.wordWidths[w] + " px\n";
                }
                txtMemDisplay.text = outW;
            } else if (rdoViewLines.value) {
                var outL = "// LINES AND WIDTHS (IN PIXELS) FOR: '" + mem.layerName + "'\n";
                outL += "// Total Lines: " + (mem.composedLineCount || mem.totalLines) + " | Box Text: " + (mem.isBoxText ? "YES" : "NO") + "\n";
                outL += "--------------------------------------------------------\n";
                outL += "LINE | TEXT                           | WIDTH (PX)\n";
                outL += "--------------------------------------------------------\n";
                for (var l = 0; l < mem.lines.length; l++) {
                    var lIdx = (l + 1 < 10 ? "0" : "") + (l + 1);
                    var lineStr = mem.lines[l];
                    if (lineStr.length > 30) lineStr = lineStr.substring(0, 27) + "...";
                    while (lineStr.length < 30) lineStr += " ";
                    outL += "[" + lIdx + "] | " + lineStr + " | " + mem.lineWidths[l] + " px\n";
                }
                txtMemDisplay.text = outL;
            } else if (rdoViewJSON.value) {
                var jsonStr = "{\n" +
                    '  "layerName": "' + mem.layerName + '",\n' +
                    '  "textType": ' + mem.textType + ',\n' +
                    '  "textTypeName": "' + (mem.textTypeName || (mem.textType ? "Box Text" : "Point Text")) + '",\n' +
                    '  "boxOverflow": ' + mem.boxOverflow + ',\n' +
                    '  "composedLineCount": ' + (mem.composedLineCount || mem.totalLines) + ',\n' +
                    '  "paragraphCount": ' + (mem.paragraphCount || 1) + ',\n' +
                    '  "words": ' + arrayToJSON(mem.words) + ',\n' +
                    '  "wordWidths": ' + arrayToJSON(mem.wordWidths) + ',\n' +
                    '  "lines": ' + arrayToJSON(mem.lines) + ',\n' +
                    '  "lineWidths": ' + arrayToJSON(mem.lineWidths) + '\n' +
                    "}";
                txtMemDisplay.text = jsonStr;
            } else {
                var fullMetrics = "// COMPREHENSIVE TEXT METRICS (AE 24+ EXTENDED)\n" +
                    "Layer Name: " + mem.layerName + "\n" +
                    "Text Type: " + (mem.textType ? "1 (Box Text)" : "0 (Point Text)") + "\n" +
                    "Box Overflow: " + (mem.boxOverflow ? "YES (Overset)" : "NO") + "\n" +
                    "Composed Line Count: " + (mem.composedLineCount || mem.totalLines) + "\n" +
                    "Paragraph Count: " + (mem.paragraphCount || 1) + "\n" +
                    "Box Inset Spacing: " + mem.boxInsetSpacing + " px\n" +
                    "Box Vertical Align: " + mem.boxVerticalAlignment + "\n" +
                    "Line Orientation: " + mem.lineOrientation + "\n" +
                    "First Line Indent: " + mem.firstLineIndent + " px\n" +
                    "Start Indent: " + mem.startIndent + " px\n" +
                    "End Indent: " + mem.endIndent + " px\n" +
                    "Space Before: " + mem.spaceBefore + " px | Space After: " + mem.spaceAfter + " px\n" +
                    "Auto Hyphenate: " + mem.autoHyphenate + " | Hanging Roman: " + mem.hangingRoman + "\n" +
                    "Every-Line Composer: " + mem.everyLineComposer + "\n" +
                    "Max Line Width: " + mem.maxLineWidth + " px\n" +
                    "Max Word Width: " + mem.maxWordWidth + " px";
                txtMemDisplay.text = fullMetrics;
            }
        }

        function arrayToJSON(arr) {
            if (!arr || arr.length === 0) return "[]";
            var out = "[";
            for (var i = 0; i < arr.length; i++) {
                if (typeof arr[i] === "string") {
                    out += '"' + arr[i].replace(/"/g, '\\"') + '"';
                } else {
                    out += arr[i];
                }
                if (i < arr.length - 1) out += ", ";
            }
            out += "]";
            return out;
        }

        rdoViewWords.onClick = refreshMemoryDisplay;
        rdoViewLines.onClick = refreshMemoryDisplay;
        rdoViewJSON.onClick = refreshMemoryDisplay;
        rdoViewFull.onClick = refreshMemoryDisplay;

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
                return (def.id === "text_type" ||
                        def.id === "box_is_box" ||
                        def.id === "box_overflow" ||
                        def.id === "sr_width" ||
                        def.id === "sr_height" ||
                        def.id === "box_width" ||
                        def.id === "box_height" ||
                        def.id === "align_index" ||
                        def.id === "first_line_indent" ||
                        def.id === "cnt_words" ||
                        def.id === "cnt_lines");
            });
            setStatus("Checked common dimensions, text type, alignment, indent & counters.");
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
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please select or open a composition first.");
                return;
            }

            var selectedLayers = comp.selectedLayers;
            if (!selectedLayers || selectedLayers.length === 0) {
                alert("Please select at least one text layer in the active composition.");
                return;
            }

            var selInfo = getSelectedDefIds();
            if (selInfo.count === 0) {
                alert("Please check at least one property to apply.");
                return;
            }

            var options = getOptions();
            var totalAdded = 0;
            var processedLayers = 0;

            app.beginUndoGroup("Apply Text & Box Properties to Effects");
            try {
                for (var i = 0; i < selectedLayers.length; i++) {
                    var layer = selectedLayers[i];
                    var res = applyPropertiesToLayer(comp, layer, selInfo.map, options);
                    if (res && res.success) {
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
            if (!comp || !comp.selectedLayers || comp.selectedLayers.length === 0) {
                alert("Please select a text layer first.");
                return;
            }
            app.beginUndoGroup("Remove Property Effects");
            try {
                var removed = 0;
                for (var i = 0; i < comp.selectedLayers.length; i++) {
                    removed += removePropertyEffects(comp.selectedLayers[i]);
                }
                for (var id in checkboxMap) {
                    if (checkboxMap.hasOwnProperty(id)) {
                        checkboxMap[id].value = false;
                    }
                }
                setStatus("Removed " + removed + " property effect(s).");
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
            if (!comp || !comp.selectedLayers || comp.selectedLayers.length === 0) {
                alert("Please select a text layer in the active composition.");
                return;
            }
            var layer = comp.selectedLayers[0];
            if (!isTextLayer(layer)) {
                alert("Selected layer is not a text layer.");
                return;
            }
            app.beginUndoGroup("Measure Selected Text");
            try {
                var store = measureAndStoreTextMetrics(comp, layer);
                if (store) {
                    refreshMemoryDisplay();
                    setStatus("Measured '" + layer.name + "': " + store.totalWords + " words, " + (store.composedLineCount || store.totalLines) + " lines, overset: " + (store.boxOverflow ? "YES" : "NO"));
                }
            } catch (measErr) {
                setStatus("Measurement error: " + measErr.toString(), true);
            } finally {
                app.endUndoGroup();
            }
        };

        btnCopyMem.onClick = function () {
            var mem = $.global.AE_TEXT_BOX_MEMORY;
            if (!mem || !mem.words) {
                alert("No in-memory data to copy. Click 'Measure Selected Text' first.");
                return;
            }
            var jsonStr = "{\n" +
                '  "layerName": "' + mem.layerName + '",\n' +
                '  "textType": ' + mem.textType + ',\n' +
                '  "textTypeName": "' + (mem.textTypeName || (mem.textType ? "Box Text" : "Point Text")) + '",\n' +
                '  "boxOverflow": ' + mem.boxOverflow + ',\n' +
                '  "composedLineCount": ' + (mem.composedLineCount || mem.totalLines) + ',\n' +
                '  "paragraphCount": ' + (mem.paragraphCount || 1) + ',\n' +
                '  "boxInsetSpacing": ' + mem.boxInsetSpacing + ',\n' +
                '  "words": ' + arrayToJSON(mem.words) + ',\n' +
                '  "wordWidths": ' + arrayToJSON(mem.wordWidths) + ',\n' +
                '  "lines": ' + arrayToJSON(mem.lines) + ',\n' +
                '  "lineWidths": ' + arrayToJSON(mem.lineWidths) + '\n' +
                "}";

            try {
                var tempComp = app.project ? app.project.activeItem : null;
                if (!tempComp && app.project && app.project.items) {
                    for (var i = 1; i <= app.project.items.length; i++) {
                        if (app.project.items[i] instanceof CompItem) {
                            tempComp = app.project.items[i];
                            break;
                        }
                    }
                }
                if (tempComp && typeof tempComp.layers.addText === "function") {
                    var clipLayer = tempComp.layers.addText(jsonStr);
                    clipLayer.property("Source Text").selected = true;
                    app.executeCommand(19); // Copy command
                    clipLayer.remove();
                    setStatus("JSON copied to clipboard!");
                    return;
                }
            } catch (eClip) {}

            setStatus("JSON ready in display box. (Clipboard auto-copy fallback)");
        };

        btnPrintConsole.onClick = function () {
            var mem = $.global.AE_TEXT_BOX_MEMORY;
            if (!mem || !mem.words || mem.words.length === 0) {
                alert("No in-memory data available. Click 'Measure Selected Text' first.");
                return;
            }
            if (typeof $.writeln === "function") {
                $.writeln("=======================================================");
                $.writeln("IN-MEMORY METRICS FOR: " + mem.layerName);
                $.writeln("Text Type: " + mem.textTypeName + " | Overset: " + (mem.boxOverflow ? "YES" : "NO"));
                $.writeln("Total Words: " + mem.totalWords + " | Composed Lines: " + (mem.composedLineCount || mem.totalLines));
                $.writeln("Paragraphs: " + (mem.paragraphCount || 1) + " | Inset: " + mem.boxInsetSpacing + " px");
                $.writeln("-------------------------------------------------------");
                $.writeln("WORDS & WIDTHS (PX):");
                for (var w = 0; w < mem.words.length; w++) {
                    $.writeln("  [" + (w + 1) + "] " + mem.words[w] + " -> " + mem.wordWidths[w] + " px");
                }
                $.writeln("-------------------------------------------------------");
                $.writeln("LINES & WIDTHS (PX):");
                for (var l = 0; l < mem.lines.length; l++) {
                    $.writeln("  [" + (l + 1) + "] " + mem.lines[l] + " -> " + mem.lineWidths[l] + " px");
                }
                $.writeln("=======================================================");
                setStatus("Metrics printed to console!");
            }
        };

        // Window resize handler
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        win.layout.layout(true);
        return win;
    }

    // =========================================================================
    // 5. ENTRY POINT & EXECUTION
    // =========================================================================
    var myUI = buildUI(thisObj);
    if (myUI && typeof Window !== "undefined" && myUI instanceof Window) {
        myUI.center();
        myUI.show();
    }

})(this);
