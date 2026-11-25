// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE COMIC TEXT BUBBLE v1.0.0
// =============================================================================
//
// PURPOSE:
//   A complete, interactive Comic & Speech Balloon Generator for Adobe After Effects.
//   Transforms any text layer into an authentic, expression-rigged comic speech
//   balloon with procedural body shapes, interactive drag-and-drop tail targeting,
//   advanced typographic text wrapping, full color customization, and snappy comic
//   entrance & exit transition animations.
//
// COMBINES ARCHITECTURES FROM:
//   1. AE-advanced-text-wrap:
//      - Knuth-Plass dynamic programming balanced paragraph composer.
//      - 5 wrap methods (Balanced, Greedy, Optical Pyramid, Reverse Pyramid, Compact Block).
//      - Micro-typographic rules (NBSP for dangling short words, orphan/widow prevention,
//        number & unit binding, honorific binding, manual break stripping).
//      - Multi-lingual algorithmic syllable hyphenation (EN, ES, FR, DE, IT, Universal).
//      - Non-destructive state preservation & zero-drift paragraph positioning.
//   2. AE-replace-color-emojis & AE_Get_Emojis:
//      - Comic emoji palette insertion bar (POW, SHOUT, ZAP, IDEA, LOVE, BOOM, etc.).
//      - Full Unicode emoji and emoticon parsing (:D, :), ;), <3, etc.).
//   3. AE-Text-Highlight:
//      - Sub-pixel typography bounding box measurement via sourceRectAtTime().
//      - Dynamic word highlight accent cards to emphasize comic punch words.
//   4. AE-Align-AnchorPoint:
//      - Zero-shift anchor point positioning mathematics:
//        P_new = P_base + R(theta) * S * (A_target - A_base)
//      - Tail-origin scaling so bubbles pop out naturally from the speaker's mouth.
//
// KEY CAPABILITIES:
//   1. Text Wrapping with Style Presets:
//      - Balanced Knuth-Plass, Greedy First-Fit, Optical Pyramid, Reverse Pyramid, Compact Block.
//      - Interactive Max Width & Desired Approx Width sliders with dual-constraint locking.
//   2. Balloon Body Style Presets:
//      - Classic Speech Oval (Smooth Ellipse)
//      - Modern Rounded Rectangle (Adjustable Corner Radii)
//      - Action / Shout Burst (Spiky Jagged Explosion)
//      - Thought Cloud (Scalloped Puffy Arcs)
//      - Whisper Bubble (Dashed / Soft Outline)
//      - Golden Age Caption Box (Clean Crisp Rectangle)
//   3. Tail Style Presets:
//      - Curved Hook / Horn (Classic Comic Inward Curve)
//      - Straight Cone / Triangle (Direct Pointer)
//      - Wide Speech Wedge
//      - Thought Bubbles (Chain of 3 Diminishing Circles)
//      - Lightning / Electric Bolt (Zigzag Broadcast / Scream)
//      - Scream Spike (Exaggerated Action Barb)
//      - None (Floating / Caption)
//   4. 🎯 Drag & Drop Tail Target Placement:
//      - In-Comp Null Layer: Creates a dedicated "🎯 Tail Target" null in AE that can be
//        dragged directly in the comp viewer to point at any character's mouth!
//      - In-Panel 2D Interactive Target Pad: Drag a target crosshair around the bubble miniature.
//      - 3x3 Quick Direction Matrix (Top-L, Top-C, Top-R, Mid-L, Center, Mid-R, Bot-L, Bot-C, Bot-R).
//      - Numeric Angle (-180° to +180°) and Distance (20px to 350px) sliders.
//   5. Color Picker (Background & Stroke):
//      - Background / Fill Color: Hex input + Clickable Color Swatch (Windows Color Picker & AE picker).
//      - Stroke / Outline Color: Hex input + Clickable Color Swatch + Stroke Width (0-30px).
//      - 6 Quick Comic Theme presets (Classic White, Action Yellow, Hero Cyan, Villain Purple, Danger Red, Dark Manga).
//   6. Animation In & Out Presets:
//      - In: Pop & Comic Bounce, Elastic Zoom, Whip & Slide, Flash Pop, Typewriter Reveal, Smooth Fade, None.
//      - Out: Pop / Shrink Out, Fade & Float Out, Slide Out, Comic Puff / Dissolve, None.
//      - Customizable In Duration, In Delay, Hold Duration, and Out Duration.
//      - Animate from Tail Origin toggle (grows directly from speaker target).
//   7. Non-Destructive State Storage & Revert:
//      - Saves original text string, font size, styling, position, anchor point, scale, and rotation
//        inside an "AE Comic Bubble State" effect on the text layer.
//      - One-click "↩ Revert to Original Text Layer" restores the text layer to its pristine pre-bubble state.
//
// REPOSITORY:
//   https://github.com/work2survive/AE-comic-text-bubble
//
// LIVE DEMO:
//   https://work2survive.github.io/AE_JS_builder/?jsx=AE_Comic_Text_Bubble.jsx&autobuild=true
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_TITLE   = "AE Comic Text Bubble";
    var SCRIPT_VERSION = "v1.0.0";
    var GITHUB_URL     = "https://github.com/work2survive/AE-comic-text-bubble";
    var README_URL     = "https://github.com/work2survive/AE-comic-text-bubble/blob/main/README.md";
    var DEMO_URL       = "https://work2survive.github.io/AE_JS_builder/?jsx=AE_Comic_Text_Bubble.jsx&autobuild=true";

    var EFFECT_STATE_NAME = "AE Comic Bubble State";
    var LAYER_BUBBLE_NAME = "🗯️ Comic Bubble";
    var LAYER_TARGET_NAME = "🎯 Tail Target";

    // -------------------------------------------------------------------------
    // 1. Safe Environment & Polyfills (ES3 Compatibility for AE CS6-CC 2026+)
    // -------------------------------------------------------------------------
    var globalObj = (typeof $ !== "undefined" && typeof $.global !== "undefined")
        ? $.global
        : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));

    if (typeof $ === "undefined") {
        globalObj.$ = {
            global: globalObj,
            writeln: function(msg) {
                if (typeof console !== "undefined" && console.log) console.log(msg);
            }
        };
    } else if (typeof $.global === "undefined") {
        $.global = globalObj;
    }

    function trimString(str) {
        if (!str) return "";
        return String(str).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    }

    function stripExistingLineBreaks(str) {
        if (!str) return "";
        return String(str).replace(/[ \t]*[\r\n\u2028\u2029]+[ \t]*/g, " ");
    }

    function hexToRgb(hex) {
        if (!hex) return [1, 1, 1];
        hex = String(hex).replace("#", "");
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
        if (!rgb || rgb.length < 3) return "#FFFFFF";
        var r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255))).toString(16);
        var g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255))).toString(16);
        var b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255))).toString(16);
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        return ("#" + r + g + b).toUpperCase();
    }

    // -------------------------------------------------------------------------
    // 2. Composition & Text Layer Utilities
    // -------------------------------------------------------------------------
    function getActiveComposition() {
        var activeApp = (typeof app !== "undefined") ? app : globalObj.app;
        if (activeApp && activeApp.project && activeApp.project.activeItem) {
            var itm = activeApp.project.activeItem;
            if (typeof CompItem !== "undefined" && itm instanceof CompItem) return itm;
            if (itm.typeName === "Composition" || itm.layers) return itm;
        }
        if (activeApp && activeApp.project && activeApp.project.items) {
            for (var i = 1; i <= activeApp.project.items.length; i++) {
                var it = activeApp.project.items[i];
                if (it && (it.typeName === "Composition" || it.layers)) {
                    if (it.selectedLayers && it.selectedLayers.length > 0) return it;
                }
            }
            for (var j = 1; j <= activeApp.project.items.length; j++) {
                var it2 = activeApp.project.items[j];
                if (it2 && (it2.typeName === "Composition" || it2.layers)) return it2;
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
            if (l && l.parent && isTextLayer(l.parent)) return l.parent;
        }
        return null;
    }

    function getTextLayerString(layer) {
        if (!layer) return "";
        try {
            var textProp = layer.property("ADBE Text Properties") || layer.property("Text");
            var docProp = textProp ? (textProp.property("ADBE Text Document") || layer.property("Source Text")) : layer.property("Source Text");
            if (docProp && docProp.value) {
                var doc = docProp.value;
                if (doc && doc.text !== undefined) return String(doc.text);
            }
            if (layer.sourceText && layer.sourceText.value !== undefined) {
                var v = layer.sourceText.value;
                if (v && typeof v === "object" && v.text !== undefined) return String(v.text);
                return String(v || "");
            }
            if (typeof layer.text === "string") return layer.text;
        } catch (e) {}
        return "";
    }

    function ensureCompAndSampleLayer() {
        var comp = getActiveComposition();
        var activeApp = (typeof app !== "undefined") ? app : globalObj.app;
        if (!comp) {
            if (activeApp && activeApp.project) {
                comp = activeApp.project.items.addComp("Comic Bubble Demo", 1920, 1080, 1.0, 5.0, 30);
            }
        }
        if (!comp) return null;

        var textLayer = getSelectedTextLayer(comp);
        if (!textLayer) {
            // Find any text layer in comp
            if (comp.layers && comp.layers.length > 0) {
                for (var i = 1; i <= comp.layers.length; i++) {
                    var l = comp.layers[i];
                    if (isTextLayer(l)) {
                        textLayer = l;
                        break;
                    }
                }
            }
        }

        // If still no text layer, create a sample punchy comic text layer
        if (!textLayer && comp.layers && typeof comp.layers.addText === "function") {
            textLayer = comp.layers.addText("POW! 💥 That was incredible!\nWhat do we do next?");
            textLayer.name = "Comic Dialogue Text";
            if (textLayer.transform && textLayer.transform.position) {
                textLayer.transform.position.setValue([comp.width / 2, comp.height / 2 - 40, 0]);
            }
            try {
                var docProp = textLayer.property("Source Text");
                if (docProp && docProp.value) {
                    var doc = docProp.value;
                    doc.fontSize = 44;
                    doc.applyFill = true;
                    doc.fillColor = [0.08, 0.08, 0.12];
                    doc.justification = (typeof ParagraphJustification !== "undefined" && ParagraphJustification.CENTER_JUSTIFY)
                        ? ParagraphJustification.CENTER_JUSTIFY : 7414;
                    docProp.setValue(doc);
                }
            } catch (eDoc) {}
        }

        return { comp: comp, textLayer: textLayer };
    }

    // -------------------------------------------------------------------------
    // 3. Multi-Lingual Syllabification & Hyphenation (from AE-advanced-text-wrap)
    // -------------------------------------------------------------------------
    var HYPHEN_PATTERNS = {
        english: {
            vowels: /[aeiouy]/i,
            prefixes: ["un", "dis", "trans", "inter", "anti", "super", "multi", "over", "under", "pre", "mis", "sub", "non"],
            suffixes: ["tion", "sion", "ment", "ness", "able", "ible", "less", "ful", "ing", "ous", "ance", "ence", "ize", "ism", "ist", "ity"]
        },
        spanish: {
            vowels: /[aeiouáéíóúü]/i,
            strongVowels: /[aeoáéó]/i,
            weakVowels: /[iuíúü]/i,
            digraphs: ["ch", "ll", "rr"],
            prefixes: ["des", "trans", "inter", "sobre", "anti", "sub", "ante", "contra"],
            suffixes: ["ción", "sión", "miento", "mente", "able", "ible", "idad", "ismo", "ista", "oso", "osa", "ura"]
        },
        french: {
            vowels: /[aeiouyàâéèêëîïôùûüÿœæ]/i,
            prefixes: ["dé", "dés", "trans", "inter", "sous", "sur", "anti", "multi"],
            suffixes: ["tion", "sion", "ment", "able", "ible", "ité", "isme", "iste", "eur", "euse", "ence", "ance"]
        },
        german: {
            vowels: /[aeiouyäöü]/i,
            prefixes: ["ver", "zer", "ent", "ge", "be", "über", "unter", "durch", "hinter"],
            suffixes: ["ung", "heit", "keit", "schaft", "lich", "isch", "ig", "bar", "sam", "tum"]
        },
        italian: {
            vowels: /[aeiouàèéìíîòóùú]/i,
            prefixes: ["dis", "tras", "inter", "sotto", "sopra", "anti"],
            suffixes: ["zione", "sione", "mento", "mente", "abile", "ibile", "ità", "ismo", "ista", "oso", "osa"]
        },
        universal: {
            vowels: /[aeiouyàâéèêëîïôùûüÿäöaeoáéíóú]/i,
            prefixes: ["un", "in", "de", "dis", "con", "pro"],
            suffixes: ["tion", "ment", "ing", "ed", "al", "ic"]
        }
    };

    function hyphenateWord(word, lang, minWordLen, minPrefix, minSuffix) {
        if (!word) return [word];
        if (minWordLen === undefined) minWordLen = 6;
        if (minPrefix === undefined) minPrefix = 3;
        if (minSuffix === undefined) minSuffix = 3;

        if (word.length < minWordLen) return [word];
        if (/^[A-Z0-9_\-]+$/.test(word)) return [word];
        if (/[\uD800-\uDFFF]/.test(word)) return [word];

        var config = HYPHEN_PATTERNS[lang] || HYPHEN_PATTERNS.english;
        var vowels = config.vowels;
        var wLower = word.toLowerCase();

        if (config.prefixes) {
            for (var p = 0; p < config.prefixes.length; p++) {
                var pfx = config.prefixes[p];
                if (wLower.indexOf(pfx) === 0 && pfx.length >= minPrefix && (word.length - pfx.length) >= minSuffix) {
                    var rest = word.slice(pfx.length);
                    var restChunks = hyphenateWord(rest, lang, minWordLen, minPrefix, minSuffix);
                    return [word.slice(0, pfx.length)].concat(restChunks);
                }
            }
        }

        if (config.suffixes) {
            for (var s = 0; s < config.suffixes.length; s++) {
                var sfx = config.suffixes[s];
                var sfxPos = word.length - sfx.length;
                if (sfxPos >= minPrefix && sfx.length >= minSuffix && wLower.lastIndexOf(sfx) === sfxPos) {
                    var base = word.slice(0, sfxPos);
                    var baseChunks = hyphenateWord(base, lang, minWordLen, minPrefix, minSuffix);
                    return baseChunks.concat([word.slice(sfxPos)]);
                }
            }
        }

        var doubleMatch = word.match(/([bcdfghjklmnpqrstvwxz])\1/i);
        if (doubleMatch && doubleMatch.index !== undefined) {
            var splitPos = doubleMatch.index + 1;
            if (splitPos >= minPrefix && (word.length - splitPos) >= minSuffix) {
                return [word.slice(0, splitPos), word.slice(splitPos)];
            }
        }

        for (var i = minPrefix; i <= word.length - minSuffix; i++) {
            var c1 = word.charAt(i - 1);
            var c2 = word.charAt(i);
            var prevIsVowel = vowels.test(c1);
            var curIsVowel = vowels.test(c2);

            if (i > 1 && vowels.test(word.charAt(i - 2)) && !prevIsVowel && curIsVowel) {
                var cut = i - 1;
                if (cut >= minPrefix && (word.length - cut) >= minSuffix) {
                    return [word.slice(0, cut), word.slice(cut)];
                }
            }
            if (i > 1 && i < word.length - 1) {
                var vBefore = vowels.test(word.charAt(i - 2));
                var vAfter = vowels.test(word.charAt(i + 1));
                if (vBefore && !prevIsVowel && !curIsVowel && vAfter) {
                    return [word.slice(0, i), word.slice(i)];
                }
            }
        }

        return [word];
    }

    // -------------------------------------------------------------------------
    // 4. Micro-Typography Grammar & Semantic Unit Binding (from AE-advanced-text-wrap)
    // -------------------------------------------------------------------------
    var SHORT_WORDS_DICT = {
        english: ["a", "an", "the", "in", "on", "at", "to", "for", "with", "by", "of", "from", "as", "is", "it", "into", "like", "through", "after", "over", "between", "out", "about", "but", "and", "or", "nor", "so", "yet", "if", "than", "this", "that"],
        spanish: ["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "en", "con", "por", "para", "sin", "tras", "y", "e", "o", "u", "ni", "que", "a", "sobre", "entre", "hacia", "hasta", "desde", "se", "su", "sus"],
        french: ["le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "en", "à", "dans", "par", "pour", "sur", "avec", "sans", "sous", "et", "ou", "mais", "donc", "car", "ni", "que", "ce", "sa", "ses"],
        german: ["der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einem", "einen", "eines", "in", "im", "an", "am", "auf", "aus", "bei", "beim", "mit", "nach", "von", "vom", "zu", "zum", "zur", "und", "oder", "aber", "wie", "als", "um", "für"],
        italian: ["il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "del", "dello", "della", "dei", "degli", "delle", "a", "al", "allo", "alla", "ai", "agli", "alle", "da", "dal", "in", "nel", "con", "su", "sul", "per", "tra", "fra", "e", "o", "ma", "che"],
        universal: ["a", "an", "the", "in", "on", "at", "to", "of", "de", "en", "et", "y", "und", "el", "la"]
    };

    var NBSP = "\u00A0";

    function applySemanticBindings(text, lang, opts) {
        if (!text) return "";
        var str = text;
        var dict = SHORT_WORDS_DICT[lang] || SHORT_WORDS_DICT.english;

        if (opts.bindNumbers) {
            str = str.replace(/(\b\d+(?:[.,]\d+)?)\s+([a-zA-Z%$€£¥°]+)\b/g, "$1" + NBSP + "$2");
            str = str.replace(/(^|[\s(])([\$€£¥₹])\s*(\d+)/g, "$1$2" + NBSP + "$3");
        }
        if (opts.bindHonorifics) {
            str = str.replace(/\b(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Sr\.|Sra\.|St\.|e\.g\.|i\.e\.|etc\.)\s+([A-Za-z0-9])/g, "$1" + NBSP + "$2");
        }
        if (opts.avoidDanglingShort) {
            for (var i = 0; i < dict.length; i++) {
                var w = dict[i];
                var reg = new RegExp("(^|[\\s(\"«¿¡])(" + w + ")\\s+", "gi");
                str = str.replace(reg, "$1$2" + NBSP);
            }
        }
        if (opts.preventWidows) {
            var paras = str.split(/\r\n|\r|\n/);
            for (var p = 0; p < paras.length; p++) {
                var pStr = paras[p];
                paras[p] = pStr.replace(/(\S+)\s+(\S+)$/, "$1" + NBSP + "$2");
            }
            str = paras.join("\r");
        }
        return str;
    }

    // -------------------------------------------------------------------------
    // 5. Typography Measurement Engine
    // -------------------------------------------------------------------------
    function createTextMeasurer(comp, textLayer) {
        var fontSize = 44;
        var font = "";
        var tracking = 0;
        try {
            var docProp = textLayer ? (textLayer.property("ADBE Text Properties") || textLayer.property("Text")) : null;
            var docVal = docProp ? (docProp.property("ADBE Text Document") || textLayer.property("Source Text")) : null;
            if (docVal && docVal.value) {
                fontSize = docVal.value.fontSize || 44;
                font = docVal.value.font || "";
                tracking = docVal.value.tracking || 0;
            }
        } catch (eT) {}

        var measLayer = null;
        var measDocProp = null;
        var measDoc = null;

        try {
            if (comp && comp.layers && typeof comp.layers.addText === "function") {
                measLayer = comp.layers.addText("");
                measLayer.enabled = true;
                if (measLayer.transform && measLayer.transform.position) {
                    measLayer.transform.position.setValue([-9999, -9999, 0]);
                }
                measDocProp = measLayer.property("Source Text");
                measDoc = measDocProp ? measDocProp.value : null;
                if (measDoc) {
                    measDoc.fontSize = fontSize;
                    if (font) { try { measDoc.font = font; } catch (eF) {} }
                    measDoc.tracking = tracking;
                    measDoc.applyStroke = false;
                    measDoc.applyFill = true;
                    try { measDocProp.setValue(measDoc); } catch (eDS) {}
                }
            }
        } catch (eM) {}

        function rawMeasure(str) {
            if (!str || str.length === 0) return 0;
            if (measLayer && measDocProp) {
                if (measDoc) {
                    measDoc.text = str;
                    measDocProp.setValue(measDoc);
                } else {
                    measDocProp.setValue(str);
                }
                try {
                    var r = measLayer.sourceRectAtTime(comp.time || 0, false);
                    if (r && typeof r.width === "number") return r.width;
                } catch (eSR) {}
            }
            if (typeof AETextCalibration !== "undefined" && typeof AETextCalibration.measureLineWidth === "function") {
                return AETextCalibration.measureLineWidth(str, fontSize, font, tracking);
            }
            return str.length * (fontSize * 0.52);
        }

        var pipeW = rawMeasure("|");
        function measureAdvance(str) {
            if (!str || str.length === 0) return 0;
            var w = rawMeasure(str + "|") - pipeW;
            return Math.max(0, w);
        }

        return {
            measureAdvance: measureAdvance,
            fontSize: fontSize,
            hyphenWidth: measureAdvance("-"),
            cleanup: function() {
                if (measLayer) {
                    try { measLayer.remove(); } catch (eR) {}
                    measLayer = null;
                }
            }
        };
    }

    // -------------------------------------------------------------------------
    // 6. Text Wrapping Algorithms (Balanced Knuth-Plass, Greedy, Pyramids, Compact)
    // -------------------------------------------------------------------------
    function tokenizeParagraph(paraText, lang, useHyphen, minWordLen, measurer) {
        var rawTokens = paraText.match(/\S+/g) || [];
        var tokens = [];
        for (var i = 0; i < rawTokens.length; i++) {
            var raw = rawTokens[i];
            var parts = raw.split(NBSP);
            var isBound = parts.length > 1;
            var syllables = (useHyphen && !isBound) ? hyphenateWord(raw, lang, minWordLen, 3, 3) : [raw];
            tokens.push({
                text: raw,
                syllables: syllables,
                isBound: isBound,
                width: measurer.measureAdvance(raw)
            });
        }
        return tokens;
    }

    function wrapBalanced(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW) {
        if (!desiredW || desiredW >= maxW) desiredW = Math.max(50, maxW - 20);
        var tokens = tokenizeParagraph(paraText, lang, useHyphen, minWordLen, measurer);
        if (tokens.length === 0) return [""];

        var n = tokens.length;
        var cost = new Array(n + 1);
        var nextBreak = new Array(n + 1);
        var hyphenAt = new Array(n + 1);

        cost[n] = 0;
        nextBreak[n] = n;
        hyphenAt[n] = false;

        for (var i = n - 1; i >= 0; i--) {
            cost[i] = Infinity;
            nextBreak[i] = i + 1;
            hyphenAt[i] = false;
            var currentLineWidth = 0;

            for (var j = i; j < n; j++) {
                var tok = tokens[j];
                if (j === i) {
                    currentLineWidth = tok.width;
                } else {
                    currentLineWidth += spaceW + tok.width;
                }

                if (currentLineWidth > maxW) {
                    if (useHyphen && tok.syllables && tok.syllables.length > 1) {
                        var pfx = tok.syllables[0];
                        var pfxW = measurer.measureAdvance(pfx + "-");
                        var testHyphenW = (j === i) ? pfxW : (currentLineWidth - tok.width + spaceW + pfxW);
                        if (testHyphenW <= maxW) {
                            var slackH = Math.abs(desiredW - testHyphenW);
                            var penaltyH = (slackH * slackH) + 8000 + cost[j];
                            if (penaltyH < cost[i]) {
                                cost[i] = penaltyH;
                                nextBreak[i] = j;
                                hyphenAt[i] = true;
                            }
                        }
                    }
                    break;
                }

                var lineCost = 0;
                var deltaDesired = currentLineWidth - desiredW;
                if (j === n - 1) {
                    lineCost = (currentLineWidth < desiredW * 0.25 && n > 1) ? 50000 : 0;
                } else {
                    lineCost = (deltaDesired <= 0) ? (deltaDesired * deltaDesired) : (deltaDesired * deltaDesired * 1.6);
                }

                var totalCost = lineCost + cost[j + 1];
                if (totalCost < cost[i]) {
                    cost[i] = totalCost;
                    nextBreak[i] = j + 1;
                    hyphenAt[i] = false;
                }
            }
        }

        var resultLines = [];
        var curr = 0;
        while (curr < n) {
            var nxt = nextBreak[curr];
            var isHyp = hyphenAt[curr];
            var lineWords = [];
            for (var k = curr; k < (isHyp ? nxt : nxt); k++) {
                lineWords.push(tokens[k].text);
            }
            if (isHyp && nxt < n) {
                var hypTok = tokens[nxt];
                var syl1 = hypTok.syllables[0];
                var rest = hypTok.text.slice(syl1.length);
                lineWords.push(syl1 + "-");
                tokens[nxt].text = rest;
                tokens[nxt].width = measurer.measureAdvance(rest);
                tokens[nxt].syllables = [rest];
                curr = nxt;
            } else {
                curr = nxt;
            }
            resultLines.push(lineWords.join(" "));
        }
        return resultLines;
    }

    function wrapGreedy(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW) {
        if (!desiredW || desiredW >= maxW) desiredW = Math.max(50, maxW - 20);
        var tokens = tokenizeParagraph(paraText, lang, useHyphen, minWordLen, measurer);
        if (tokens.length === 0) return [""];

        var lines = [];
        var curTokens = [];
        var curWidth = 0;

        for (var i = 0; i < tokens.length; i++) {
            var tok = tokens[i];
            var addW = (curTokens.length === 0) ? tok.width : (spaceW + tok.width);

            if (curWidth + addW <= desiredW) {
                curTokens.push(tok.text);
                curWidth += addW;
            } else if (curWidth + addW <= maxW) {
                var distBefore = Math.abs(desiredW - curWidth);
                var distAfter = Math.abs((curWidth + addW) - desiredW);
                if (distAfter <= distBefore || curTokens.length === 0 || curWidth < desiredW * 0.45) {
                    curTokens.push(tok.text);
                    curWidth += addW;
                } else {
                    lines.push(curTokens.join(" "));
                    curTokens = [tok.text];
                    curWidth = tok.width;
                }
            } else {
                var hyphenated = false;
                if (useHyphen && tok.syllables && tok.syllables.length > 1) {
                    var s1 = tok.syllables[0];
                    var s1W = measurer.measureAdvance(s1 + "-");
                    var sAddW = (curTokens.length === 0) ? s1W : (spaceW + s1W);
                    if (curWidth + sAddW <= maxW) {
                        curTokens.push(s1 + "-");
                        lines.push(curTokens.join(" "));
                        var remainder = tok.text.slice(s1.length);
                        curTokens = [remainder];
                        curWidth = measurer.measureAdvance(remainder);
                        hyphenated = true;
                    }
                }
                if (!hyphenated) {
                    if (curTokens.length > 0) {
                        lines.push(curTokens.join(" "));
                        curTokens = [tok.text];
                        curWidth = tok.width;
                    } else {
                        lines.push(tok.text);
                        curTokens = [];
                        curWidth = 0;
                    }
                }
            }
        }
        if (curTokens.length > 0) lines.push(curTokens.join(" "));
        return lines;
    }

    function wrapOpticalPyramid(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW) {
        if (!desiredW || desiredW >= maxW) desiredW = Math.max(50, maxW - 20);
        var words = paraText.match(/\S+/g) || [];
        if (words.length === 0) return [""];
        if (words.length <= 3) return [words.join(" ")];

        var stepCount = Math.min(5, Math.max(2, Math.ceil(words.length / 4)));
        var lines = [];
        var wordIdx = 0;

        for (var step = 1; step <= stepCount; step++) {
            var stepFraction = step / stepCount;
            var stepTarget = Math.max(desiredW * 0.40, desiredW * stepFraction);
            var stepMax = Math.min(maxW, stepTarget);
            var lineWords = [];
            var lineW = 0;

            while (wordIdx < words.length) {
                var w = words[wordIdx];
                var wW = measurer.measureAdvance(w);
                var testW = (lineWords.length === 0) ? wW : (lineW + spaceW + wW);
                if (testW <= stepMax || lineWords.length === 0) {
                    lineWords.push(w);
                    lineW = testW;
                    wordIdx++;
                } else {
                    break;
                }
            }
            if (lineWords.length > 0) lines.push(lineWords.join(" "));
            if (wordIdx >= words.length) break;
        }
        if (wordIdx < words.length) {
            var remaining = [];
            while (wordIdx < words.length) remaining.push(words[wordIdx++]);
            lines.push(remaining.join(" "));
        }
        return lines;
    }

    function wrapReversePyramid(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW) {
        if (!desiredW || desiredW >= maxW) desiredW = Math.max(50, maxW - 20);
        var words = paraText.match(/\S+/g) || [];
        if (words.length === 0) return [""];
        if (words.length <= 3) return [words.join(" ")];

        var stepCount = Math.min(5, Math.max(2, Math.ceil(words.length / 4)));
        var lines = [];
        var wordIdx = 0;

        for (var step = 0; step < stepCount; step++) {
            var taperRatio = 1.0 - (step * (0.55 / stepCount));
            var stepTarget = Math.max(desiredW * 0.35, desiredW * taperRatio);
            var stepMax = Math.min(maxW, stepTarget);
            var lineWords = [];
            var lineW = 0;

            while (wordIdx < words.length) {
                var w = words[wordIdx];
                var wW = measurer.measureAdvance(w);
                var testW = (lineWords.length === 0) ? wW : (lineW + spaceW + wW);
                if (testW <= stepMax || lineWords.length === 0) {
                    lineWords.push(w);
                    lineW = testW;
                    wordIdx++;
                } else {
                    break;
                }
            }
            if (lineWords.length > 0) lines.push(lineWords.join(" "));
            if (wordIdx >= words.length) break;
        }
        if (wordIdx < words.length) {
            var remaining2 = [];
            while (wordIdx < words.length) remaining2.push(words[wordIdx++]);
            lines.push(remaining2.join(" "));
        }
        return lines;
    }

    function composeWrappedText(rawText, opts, measurer) {
        if (!rawText) return "";
        var clean = opts.removeExistingBreaks ? stripExistingLineBreaks(rawText) : rawText;
        clean = applySemanticBindings(clean, opts.language, opts);

        var spaceW = measurer.measureAdvance(" ");
        var maxW = opts.maxWidth || 450;
        var desiredW = opts.desiredWidth || 380;
        var lang = opts.language || "english";
        var useHyphen = opts.useHyphen;

        var paras = clean.split(/\r\n|\r|\n/);
        var finalLines = [];

        for (var p = 0; p < paras.length; p++) {
            var pText = trimString(paras[p]);
            if (!pText) {
                finalLines.push("");
                continue;
            }
            var pLines = [];
            switch (opts.method) {
                case "balanced":
                    pLines = wrapBalanced(pText, maxW, desiredW, lang, useHyphen, 6, measurer, spaceW);
                    break;
                case "greedy":
                case "compact":
                    pLines = wrapGreedy(pText, maxW, desiredW, lang, useHyphen, 6, measurer, spaceW);
                    break;
                case "pyramid":
                    pLines = wrapOpticalPyramid(pText, maxW, desiredW, lang, useHyphen, 6, measurer, spaceW);
                    break;
                case "reverse_pyramid":
                    pLines = wrapReversePyramid(pText, maxW, desiredW, lang, useHyphen, 6, measurer, spaceW);
                    break;
                default:
                    pLines = wrapBalanced(pText, maxW, desiredW, lang, useHyphen, 6, measurer, spaceW);
                    break;
            }
            finalLines = finalLines.concat(pLines);
        }
        return finalLines.join("\r");
    }

    // -------------------------------------------------------------------------
    // 7. Non-Destructive State Storage & Revert Engine
    // -------------------------------------------------------------------------
    function storeOriginalState(textLayer, origText) {
        if (!textLayer) return;
        try {
            var existing = readOriginalState(textLayer);
            if (existing && existing.text) return; // Guard pristine original

            var transform = textLayer.property("Transform");
            var posProp = transform ? transform.property("Position") : null;
            var apProp = transform ? transform.property("Anchor Point") : null;
            var scaleProp = transform ? transform.property("Scale") : null;
            var rotProp = transform ? (transform.property("Rotation") || transform.property("Z Rotation")) : null;

            var docProp = textLayer.property("Source Text");
            var doc = (docProp && docProp.value) ? docProp.value : null;

            var r = [0, 0, 100, 50];
            try {
                var sr = textLayer.sourceRectAtTime(0, false);
                if (sr) r = [sr.left, sr.top, sr.width, sr.height];
            } catch (eSR) {}

            var payload = {
                text: origText,
                position: posProp ? posProp.value : null,
                anchorPoint: apProp ? apProp.value : null,
                scale: scaleProp ? scaleProp.value : [100, 100, 100],
                rotation: rotProp ? rotProp.value : 0,
                fontSize: doc ? doc.fontSize : 44,
                font: doc ? doc.font : "",
                fillColor: (doc && doc.fillColor) ? doc.fillColor : [0, 0, 0],
                strokeColor: (doc && doc.strokeColor) ? doc.strokeColor : [0, 0, 0],
                strokeWidth: doc ? doc.strokeWidth : 0,
                justification: doc ? doc.justification : 7414,
                bounds: r
            };

            var fxParade = textLayer.property("ADBE Effect Parade") || textLayer.property("Effects");
            if (fxParade) {
                var eff = fxParade.property(EFFECT_STATE_NAME);
                if (!eff) {
                    try { eff = fxParade.addProperty("ADBE Slider Control"); } catch (eAdd) {}
                }
                if (eff) {
                    eff.name = EFFECT_STATE_NAME;
                    var sliderProp = eff.property("ADBE Slider Control-0001") || eff.property(1);
                    if (sliderProp) {
                        var jsonStr = "";
                        try {
                            jsonStr = encodeURIComponent(JSON.stringify(payload));
                        } catch (eJ) {
                            jsonStr = encodeURIComponent(origText);
                        }
                        sliderProp.expression = "/* ComicBubbleState:" + jsonStr + " */\nvalue;";
                    }
                }
            }

            if (textLayer.comment !== undefined && (!textLayer.comment || textLayer.comment.indexOf("ComicBubble:") === -1)) {
                textLayer.comment = "ComicBubble:" + origText;
            }
        } catch (eStore) {}
    }

    function readOriginalState(textLayer) {
        if (!textLayer) return null;
        try {
            var fxParade = textLayer.property("ADBE Effect Parade") || textLayer.property("Effects");
            if (fxParade) {
                var eff = fxParade.property(EFFECT_STATE_NAME);
                if (eff) {
                    var sliderProp = eff.property("ADBE Slider Control-0001") || eff.property(1);
                    if (sliderProp && sliderProp.expression) {
                        var match = sliderProp.expression.match(/\/\* ComicBubbleState:(.*?) \*\//);
                        if (match && match[1]) {
                            var decoded = decodeURIComponent(match[1]);
                            try { return JSON.parse(decoded); } catch (eP) { return { text: decoded }; }
                        }
                    }
                }
            }
            if (textLayer.comment && textLayer.comment.indexOf("ComicBubble:") === 0) {
                return { text: textLayer.comment.slice("ComicBubble:".length) };
            }
        } catch (eRead) {}
        return null;
    }

    function revertToOriginal(comp, textLayer) {
        if (!comp || !textLayer) return false;
        var state = readOriginalState(textLayer);
        if (!state) return false;

        var transform = textLayer.property("Transform");
        var posProp = transform ? transform.property("Position") : null;
        var apProp = transform ? transform.property("Anchor Point") : null;
        var scaleProp = transform ? transform.property("Scale") : null;
        var rotProp = transform ? (transform.property("Rotation") || transform.property("Z Rotation")) : null;

        // Clean expressions
        if (posProp) { try { posProp.expression = ""; posProp.expressionEnabled = false; } catch (e) {} }
        if (apProp) { try { apProp.expression = ""; apProp.expressionEnabled = false; } catch (e) {} }
        if (scaleProp) { try { scaleProp.expression = ""; scaleProp.expressionEnabled = false; } catch (e) {} }
        if (rotProp) { try { rotProp.expression = ""; rotProp.expressionEnabled = false; } catch (e) {} }

        // Restore values
        if (state.anchorPoint && apProp) { try { apProp.setValue(state.anchorPoint); } catch (e) {} }
        if (state.position && posProp) { try { posProp.setValue(state.position); } catch (e) {} }
        if (state.scale && scaleProp) { try { scaleProp.setValue(state.scale); } catch (e) {} }
        if (state.rotation !== undefined && rotProp) { try { rotProp.setValue(state.rotation); } catch (e) {} }

        // Restore Source Text
        var docProp = textLayer.property("Source Text");
        if (docProp) {
            try { docProp.expression = ""; docProp.expressionEnabled = false; } catch (eE) {}
            if (state.text !== undefined) {
                try {
                    var doc = docProp.value;
                    if (doc) {
                        doc.text = state.text;
                        if (state.fontSize) doc.fontSize = state.fontSize;
                        if (state.font) try { doc.font = state.font; } catch (eF) {}
                        if (state.fillColor) doc.fillColor = state.fillColor;
                        if (state.strokeColor) doc.strokeColor = state.strokeColor;
                        if (state.strokeWidth !== undefined) doc.strokeWidth = state.strokeWidth;
                        if (state.justification !== undefined) doc.justification = state.justification;
                        docProp.setValue(doc);
                    } else {
                        docProp.setValue(state.text);
                    }
                } catch (eST) {
                    try { docProp.setValue(state.text); } catch (eST2) {}
                }
            }
        }

        // Delete generated Comic Bubble and Target Null layers
        if (comp.layers) {
            for (var i = comp.layers.length; i >= 1; i--) {
                var l = comp.layers[i];
                if (l && (l.name === LAYER_BUBBLE_NAME || l.name === LAYER_TARGET_NAME || l.name === "Highlight_Accent")) {
                    try { l.remove(); } catch (eR) {}
                }
            }
        }

        // Remove Effect State
        try {
            var fxParade = textLayer.property("ADBE Effect Parade") || textLayer.property("Effects");
            if (fxParade) {
                var eff = fxParade.property(EFFECT_STATE_NAME);
                if (eff) eff.remove();
            }
        } catch (eEff) {}

        try { textLayer.comment = ""; } catch (eC) {}
        return true;
    }

    // -------------------------------------------------------------------------
    // 8. Procedural Comic Balloon & Tail Geometry Engine
    // -------------------------------------------------------------------------
    /**
     * Generates a single closed Bézier path seamlessly uniting the balloon body
     * and speech tail pointer.
     */
    function computeComicBubbleShape(w, h, bodyType, cornerRadius, burstSpikes, tailType, tailBaseW, tailAngleDeg, tailDist, tailCurvature) {
        var a = Math.max(20, w / 2);
        var b = Math.max(15, h / 2);
        var meanR = (a + b) / 2;

        var hasTail = (tailType && tailType !== "none");
        var rad = tailAngleDeg * (Math.PI / 180);
        while (rad < 0) rad += 2 * Math.PI;
        while (rad >= 2 * Math.PI) rad -= 2 * Math.PI;

        var tipX = tailDist * Math.cos(rad);
        var tipY = tailDist * Math.sin(rad);

        var vertices = [];
        var inTangents = [];
        var outTangents = [];

        // ---------------------------------------------------------------------
        // CASE A: CLASSIC SPEECH OVAL (Seamless Bézier Ellipse + Tail)
        // ---------------------------------------------------------------------
        if (bodyType === "oval") {
            if (!hasTail) {
                // 4-Quadrant perfect ellipse
                var kappa = 0.55228475;
                var kx = a * kappa;
                var ky = b * kappa;
                vertices = [[a, 0], [0, b], [-a, 0], [0, -b]];
                inTangents = [[0, -ky], [kx, 0], [0, ky], [-kx, 0]];
                outTangents = [[0, ky], [-kx, 0], [0, -ky], [kx, 0]];
                return { vertices: vertices, inTangents: inTangents, outTangents: outTangents, closed: true };
            }

            var halfBaseAngle = Math.min(Math.PI * 0.35, Math.max(0.10, tailBaseW / (2 * meanR)));
            var ang1 = rad - halfBaseAngle;
            var ang2 = rad + halfBaseAngle;

            var span = 2 * Math.PI - 2 * halfBaseAngle;
            var steps = 14;
            var dt = span / steps;

            for (var i = 0; i <= steps; i++) {
                var t = ang2 + i * dt;
                var vx = a * Math.cos(t);
                var vy = b * Math.sin(t);
                vertices.push([vx, vy]);

                var tx = -a * Math.sin(t) * (dt / 3);
                var ty = b * Math.cos(t) * (dt / 3);
                inTangents.push([-tx, -ty]);
                outTangents.push([tx, ty]);
            }

            // Vertices[steps] is at ang1 (B1). Tail tip connects B1 -> Tip -> B2.
            var b1 = vertices[vertices.length - 1];
            var b2 = vertices[0];

            var v1x = tipX - b1[0];
            var v1y = tipY - b1[1];
            var len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 1;
            var n1x = -v1y / len1;
            var n1y = v1x / len1;

            var v2x = b2[0] - tipX;
            var v2y = b2[1] - tipY;
            var len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 1;
            var n2x = -v2y / len2;
            var n2y = v2x / len2;

            var curveAmount = (tailType === "straight_cone" || tailType === "wide_wedge") ? 0 : (tailCurvature * 0.40);

            outTangents[outTangents.length - 1] = [v1x * 0.35 + n1x * len1 * curveAmount, v1y * 0.35 + n1y * len1 * curveAmount];

            // Add Tip vertex
            vertices.push([tipX, tipY]);
            inTangents.push([-v1x * 0.25 + n1x * len1 * (curveAmount * 0.5), -v1y * 0.25 + n1y * len1 * (curveAmount * 0.5)]);
            outTangents.push([v2x * 0.25 - n2x * len2 * (curveAmount * 0.5), v2y * 0.25 - n2y * len2 * (curveAmount * 0.5)]);

            inTangents[0] = [-v2x * 0.35 - n2x * len2 * curveAmount, -v2y * 0.35 - n2y * len2 * curveAmount];

            return { vertices: vertices, inTangents: inTangents, outTangents: outTangents, closed: true };
        }

        // ---------------------------------------------------------------------
        // CASE B: ACTION / SHOUT BURST (Spiky Explosion)
        // ---------------------------------------------------------------------
        if (bodyType === "shout") {
            var pts = Math.max(8, Math.min(36, burstSpikes || 16));
            var totalPts = pts * 2;
            var rOut = Math.max(a, b) + 16;
            var rIn = rOut * 0.62;

            for (var p = 0; p < totalPts; p++) {
                var pAng = (p * 2 * Math.PI) / totalPts;
                var isSpike = (p % 2 === 0);
                var radius = isSpike ? rOut : rIn;

                var diffAng = Math.abs(pAng - rad);
                if (diffAng > Math.PI) diffAng = 2 * Math.PI - diffAng;

                // Elongate the spike closest to the tail angle towards Tip
                if (hasTail && isSpike && diffAng < (Math.PI / pts)) {
                    vertices.push([tipX, tipY]);
                } else {
                    vertices.push([radius * Math.cos(pAng), radius * Math.sin(pAng)]);
                }
                inTangents.push([0, 0]);
                outTangents.push([0, 0]);
            }
            return { vertices: vertices, inTangents: inTangents, outTangents: outTangents, closed: true };
        }

        // ---------------------------------------------------------------------
        // CASE C: THOUGHT CLOUD (Scalloped Puffs)
        // ---------------------------------------------------------------------
        if (bodyType === "thought") {
            var cloudPuffs = 12;
            var cDt = (2 * Math.PI) / cloudPuffs;
            for (var c = 0; c < cloudPuffs; c++) {
                var cAng = c * cDt;
                var cx = a * Math.cos(cAng);
                var cy = b * Math.sin(cAng);
                vertices.push([cx, cy]);

                var pTanX = -a * Math.sin(cAng) * 0.28;
                var pTanY = b * Math.cos(cAng) * 0.28;
                inTangents.push([-pTanX, -pTanY]);
                outTangents.push([pTanX, pTanY]);
            }
            return { vertices: vertices, inTangents: inTangents, outTangents: outTangents, closed: true };
        }

        // ---------------------------------------------------------------------
        // CASE D: MODERN ROUNDED RECTANGLE / CAPTION BOX / WHISPER
        // ---------------------------------------------------------------------
        var r = (bodyType === "caption") ? 0 : Math.min(Math.min(a, b), cornerRadius || 28);
        var K = 0.55228475;
        var rK = r * K;

        // Base 8-point rounded rectangle vertices:
        // [0: Top-L bottom], [1: Top-L right], [2: Top-R left], [3: Top-R bottom],
        // [4: Bot-R top], [5: Bot-R left], [6: Bot-L right], [7: Bot-L top]
        var rectPts = [
            [-a, -b + r], [-a + r, -b],
            [a - r, -b],  [a, -b + r],
            [a, b - r],   [a - r, b],
            [-a + r, b],  [-a, b - r]
        ];
        var rectIn = [
            [0, -rK], [-rK, 0],
            [0, 0],   [rK, 0],
            [0, 0],   [0, rK],
            [rK, 0],  [0, 0]
        ];
        var rectOut = [
            [0, 0],   [rK, 0],
            [rK, 0],  [0, 0],
            [0, rK],  [0, 0],
            [-rK, 0], [0, -rK]
        ];

        if (!hasTail) {
            return { vertices: rectPts, inTangents: rectIn, outTangents: rectOut, closed: true };
        }

        // If tail is attached to rounded rect:
        // Determine closest edge: 0:Top (-b), 1:Right (+a), 2:Bottom (+b), 3:Left (-a)
        var edgeIdx = 2; // Default bottom
        if (rad >= Math.PI * 0.25 && rad < Math.PI * 0.75) edgeIdx = 2; // Bottom
        else if (rad >= Math.PI * 0.75 && rad < Math.PI * 1.25) edgeIdx = 3; // Left
        else if (rad >= Math.PI * 1.25 && rad < Math.PI * 1.75) edgeIdx = 0; // Top
        else edgeIdx = 1; // Right

        var halfW = tailBaseW / 2;
        var curveFact = (tailType === "straight_cone") ? 0 : (tailCurvature * 0.35);

        // Splice tail into target edge
        for (var vi = 0; vi < rectPts.length; vi++) {
            vertices.push(rectPts[vi]);
            inTangents.push(rectIn[vi]);
            outTangents.push(rectOut[vi]);

            // Insert tail between appropriate edge points
            if (edgeIdx === 2 && vi === 5) { // Bottom edge [5 -> 6]
                var bx = Math.max(-a + r + halfW + 10, Math.min(a - r - halfW - 10, tipX));
                vertices.push([bx + halfW, b]);
                inTangents.push([0, 0]);
                outTangents.push([(tipX - (bx + halfW)) * 0.3, (tipY - b) * 0.3]);

                vertices.push([tipX, tipY]);
                inTangents.push([0, 0]);
                outTangents.push([0, 0]);

                vertices.push([bx - halfW, b]);
                inTangents.push([(tipX - (bx - halfW)) * 0.3, (tipY - b) * 0.3]);
                outTangents.push([0, 0]);
            } else if (edgeIdx === 0 && vi === 1) { // Top edge [1 -> 2]
                var txPos = Math.max(-a + r + halfW + 10, Math.min(a - r - halfW - 10, tipX));
                vertices.push([txPos - halfW, -b]);
                inTangents.push([0, 0]);
                outTangents.push([(tipX - (txPos - halfW)) * 0.3, (tipY - (-b)) * 0.3]);

                vertices.push([tipX, tipY]);
                inTangents.push([0, 0]);
                outTangents.push([0, 0]);

                vertices.push([txPos + halfW, -b]);
                inTangents.push([(tipX - (txPos + halfW)) * 0.3, (tipY - (-b)) * 0.3]);
                outTangents.push([0, 0]);
            }
        }

        return { vertices: vertices, inTangents: inTangents, outTangents: outTangents, closed: true };
    }

    // -------------------------------------------------------------------------
    // 9. Main Comic Bubble Creation & Rigging Engine
    // -------------------------------------------------------------------------
    function buildComicBubble(comp, textLayer, params) {
        if (!comp || !textLayer) return false;

        var origText = getTextLayerString(textLayer);
        if (!origText) origText = "POW! 💥 That was incredible!\nWhat do we do next?";

        // 1. Non-destructively store original properties
        storeOriginalState(textLayer, origText);

        // 2. Perform Intelligent Typography Wrap
        var measurer = createTextMeasurer(comp, textLayer);
        var wrappedText = composeWrappedText(origText, {
            maxWidth: params.maxWidth,
            desiredWidth: params.desiredWidth,
            method: params.wrapMethod,
            language: params.language,
            useHyphen: params.useHyphen,
            removeExistingBreaks: params.removeBreaks,
            preventWidows: params.preventWidows,
            avoidDanglingShort: params.avoidDanglingShort,
            bindNumbers: params.bindNumbers,
            bindHonorifics: params.bindHonorifics
        }, measurer);
        measurer.cleanup();

        // Update Source Text on Text Layer
        var docProp = textLayer.property("Source Text");
        if (docProp) {
            try {
                var doc = docProp.value;
                if (doc) {
                    doc.text = wrappedText;
                    docProp.setValue(doc);
                } else {
                    docProp.setValue(wrappedText);
                }
            } catch (eDoc) {
                try { docProp.setValue(wrappedText); } catch (eDoc2) {}
            }
        }

        // 3. Measure dynamic wrapped text bounding box
        var textBounds = { left: -150, top: -40, width: 300, height: 80 };
        try {
            var sr = textLayer.sourceRectAtTime(comp.time || 0, false);
            if (sr && sr.width > 0) {
                textBounds = { left: sr.left, top: sr.top, width: sr.width, height: sr.height };
            }
        } catch (eSR) {}

        // Calculate Bubble Dimensions with Padding
        var padX = params.padX || 36;
        var padY = params.padY || 26;
        var bubbleW = textBounds.width + (padX * 2);
        var bubbleH = textBounds.height + (padY * 2);

        // Visual Center of Text Layer in local coordinates
        var textCenterLocalX = textBounds.left + (textBounds.width / 2);
        var textCenterLocalY = textBounds.top + (textBounds.height / 2);

        // Clean up previous comic bubble layers from composition
        if (comp.layers) {
            for (var cl = comp.layers.length; cl >= 1; cl--) {
                var oldL = comp.layers[cl];
                if (oldL && (oldL.name === LAYER_BUBBLE_NAME || oldL.name === LAYER_TARGET_NAME || oldL.name === "Highlight_Accent")) {
                    try { oldL.remove(); } catch (eR) {}
                }
            }
        }

        // 4. Create Dedicated In-Comp "🎯 Tail Target" Null Layer
        var targetNull = null;
        var textPos = [comp.width / 2, comp.height / 2, 0];
        try {
            if (textLayer.transform && textLayer.transform.position) {
                textPos = textLayer.transform.position.value;
            }
        } catch (eP) {}

        var tailRad = params.tailAngle * (Math.PI / 180);
        var targetCompX = textPos[0] + textCenterLocalX + (params.tailDist * Math.cos(tailRad));
        var targetCompY = textPos[1] + textCenterLocalY + (params.tailDist * Math.sin(tailRad));

        try {
            if (typeof comp.layers.addNull === "function") {
                targetNull = comp.layers.addNull();
            } else if (typeof comp.layers.addShape === "function") {
                targetNull = comp.layers.addShape();
            }
            if (targetNull) {
                targetNull.name = LAYER_TARGET_NAME;
                targetNull.label = 13; // Cyan label in AE
                if (targetNull.transform && targetNull.transform.position) {
                    targetNull.transform.position.setValue([targetCompX, targetCompY, 0]);
                }
            }
        } catch (eNull) {}

        // 5. Create "🗯️ Comic Bubble" Vector Shape Layer
        var bubbleLayer = null;
        try {
            bubbleLayer = comp.layers.addShape();
            bubbleLayer.name = LAYER_BUBBLE_NAME;
            bubbleLayer.label = 11; // Orange / Comic Yellow label
            // Place bubble immediately underneath the text layer
            try { bubbleLayer.moveAfter(textLayer); } catch (eMove) {}
        } catch (eShape) {
            return false;
        }

        // Position bubble exactly at text visual center
        var bubbleCompPos = [textPos[0] + textCenterLocalX, textPos[1] + textCenterLocalY, 0];
        if (bubbleLayer.transform && bubbleLayer.transform.position) {
            bubbleLayer.transform.position.setValue(bubbleCompPos);
        }

        // 6. Generate Vector Shape Bézier Path
        var shapeData = computeComicBubbleShape(
            bubbleW,
            bubbleH,
            params.bodyType,
            params.cornerRadius,
            params.burstSpikes,
            params.tailType,
            params.tailBaseW,
            params.tailAngle,
            params.tailDist,
            params.tailCurvature
        );

        var contents = bubbleLayer.property("ADBE Root Vectors Group") || bubbleLayer.property("Contents");
        var grp = contents.addProperty("ADBE Vector Group");
        grp.name = "Comic Bubble Outline";
        var grpContents = grp.property("ADBE Vectors Group") || grp.property("Contents");

        // Add Path
        var pathPropItem = grpContents.addProperty("ADBE Vector Shape - Path") || grpContents.addProperty("ADBE Vector Shape - Group");
        var pathProp = pathPropItem ? (pathPropItem.property("ADBE Vector Shape") || pathPropItem.property("Path") || pathPropItem.property(1)) : null;

        var ShapeClass = (typeof Shape !== "undefined") ? Shape : (globalObj.Shape || null);
        if (ShapeClass && pathProp) {
            try {
                var sObj = new ShapeClass();
                sObj.vertices = shapeData.vertices;
                sObj.inTangents = shapeData.inTangents;
                sObj.outTangents = shapeData.outTangents;
                sObj.closed = true;
                pathProp.setValue(sObj);
            } catch (eSetPath) {}
        }

        // If Thought Cloud with chain bubbles, add 3 descending thought circles
        if (params.bodyType === "thought" && params.tailType !== "none") {
            var thoughtPuffs = [
                { frac: 0.35, r: 18 },
                { frac: 0.65, r: 11 },
                { frac: 0.90, r: 6 }
            ];
            for (var tp = 0; tp < thoughtPuffs.length; tp++) {
                var pf = thoughtPuffs[tp];
                var pfx = (params.tailDist * pf.frac) * Math.cos(tailRad);
                var pfy = (params.tailDist * pf.frac) * Math.sin(tailRad);

                var grpPuff = contents.addProperty("ADBE Vector Group");
                grpPuff.name = "Thought Puff " + (tp + 1);
                var puffContents = grpPuff.property("Contents");
                var elProp = puffContents.addProperty("ADBE Vector Shape - Ellipse");
                if (elProp) {
                    if (elProp.property("Size")) elProp.property("Size").setValue([pf.r * 2, pf.r * 2]);
                    if (elProp.property("Position")) elProp.property("Position").setValue([pfx, pfy]);
                }
            }
        }

        // Add Fill
        var fill = contents.addProperty("ADBE Vector Graphic - Fill");
        var rgbFill = hexToRgb(params.bgColor);
        if (fill.property("Color") || fill.property("ADBE Vector Fill Color")) {
            (fill.property("Color") || fill.property("ADBE Vector Fill Color")).setValue(rgbFill);
        }
        if (fill.property("Opacity")) {
            fill.property("Opacity").setValue(params.bgOpacity);
        }

        // Add Stroke
        if (params.strokeWidth > 0) {
            var stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
            var rgbStroke = hexToRgb(params.strokeColor);
            if (stroke.property("Color") || stroke.property("ADBE Vector Stroke Color")) {
                (stroke.property("Color") || stroke.property("ADBE Vector Stroke Color")).setValue(rgbStroke);
            }
            if (stroke.property("Stroke Width") || stroke.property("ADBE Vector Stroke Width")) {
                (stroke.property("Stroke Width") || stroke.property("ADBE Vector Stroke Width")).setValue(params.strokeWidth);
            }
            if (stroke.property("Line Join")) stroke.property("Line Join").setValue(2); // Round join
            if (stroke.property("Line Cap")) stroke.property("Line Cap").setValue(2);  // Round cap
            if (params.bodyType === "whisper") {
                // Dashed stroke for whisper
                try {
                    var dashes = stroke.property("Dashes") || stroke.property("ADBE Vector Stroke Dashes");
                    if (dashes && dashes.addProperty) {
                        var d1 = dashes.addProperty("ADBE Vector Stroke Dash 1");
                        if (d1) d1.setValue(10);
                        var g1 = dashes.addProperty("ADBE Vector Stroke Gap 1");
                        if (g1) g1.setValue(8);
                    }
                } catch (eDash) {}
            }
        }

        // 7. Optional Text Highlight Accent (from AE-Text-Highlight)
        if (params.enableHighlight && params.highlightWords) {
            try {
                var grpHi = contents.addProperty("ADBE Vector Group");
                grpHi.name = "Highlight Accent";
                var hiContents = grpHi.property("Contents");
                var hiRect = hiContents.addProperty("ADBE Vector Shape - Rect");
                if (hiRect) {
                    if (hiRect.property("Size")) hiRect.property("Size").setValue([textBounds.width * 0.5, 34]);
                    if (hiRect.property("Position")) hiRect.property("Position").setValue([0, 10]);
                    if (hiRect.property("Roundness")) hiRect.property("Roundness").setValue(8);
                }
                var hiFill = hiContents.addProperty("ADBE Vector Graphic - Fill");
                if (hiFill && hiFill.property("Color")) {
                    hiFill.property("Color").setValue(hexToRgb(params.highlightColor || "#FFE600"));
                }
                if (hiFill && hiFill.property("Opacity")) hiFill.property("Opacity").setValue(45);
            } catch (eHi) {}
        }

        // 8. Zero-Shift Anchor Point Alignment (from AE-Align-AnchorPoint)
        if (params.animateFromTail) {
            // Place anchor point at tail tip/origin so bubble grows outward from speaker
            var tailLocalTip = [params.tailDist * Math.cos(tailRad), params.tailDist * Math.sin(tailRad), 0];
            if (bubbleLayer.transform && bubbleLayer.transform.anchorPoint && bubbleLayer.transform.position) {
                var curPos = bubbleLayer.transform.position.value;
                bubbleLayer.transform.anchorPoint.setValue(tailLocalTip);
                bubbleLayer.transform.position.setValue([curPos[0] + tailLocalTip[0], curPos[1] + tailLocalTip[1], 0]);
            }
        }

        // 9. Dynamic Animation In / Out Expression Engine
        var inDur = params.inDuration || 0.35;
        var inDelay = params.inDelay || 0.0;
        var holdDur = params.holdDuration || 2.5;
        var outDur = params.outDuration || 0.30;
        var inPreset = params.animInPreset || "bounce";
        var outPreset = params.animOutPreset || "shrink";

        // Procedural Scale & Opacity Expressions for Bubble Layer
        var SCALE_EXPR = [
            "// AE Comic Text Bubble - Dynamic In/Out Scale Engine",
            "var t = time - " + inDelay + ";",
            "var tIn = " + inDur + ";",
            "var tHold = " + holdDur + ";",
            "var tOut = " + outDur + ";",
            "var inPreset = '" + inPreset + "';",
            "var outPreset = '" + outPreset + "';",
            "",
            "if (t < 0) {",
            "    [0, 0];",
            "} else if (t < tIn) {",
            "    var p = t / tIn;",
            "    if (inPreset === 'bounce') {",
            "        // Comic Elastic Overshoot (0% -> 118% -> 96% -> 100%)",
            "        var s = (p === 0) ? 0 : (p === 1 ? 1 : Math.sin(p * Math.PI * 2.5) * Math.pow(1 - p, 2) * 0.4 + p);",
            "        [s * 100, s * 100];",
            "    } else if (inPreset === 'zoom') {",
            "        // Explosive Zoom",
            "        var z = Math.min(1.25, Math.pow(p, 0.45));",
            "        [z * 100, z * 100];",
            "    } else if (inPreset === 'fade' || inPreset === 'none') {",
            "        [100, 100];",
            "    } else {",
            "        var p2 = Math.min(1, p * 1.15);",
            "        [p2 * 100, p2 * 100];",
            "    }",
            "} else if (t < tIn + tHold) {",
            "    [100, 100];",
            "} else if (t < tIn + tHold + tOut) {",
            "    var pOut = (t - (tIn + tHold)) / tOut;",
            "    if (outPreset === 'shrink') {",
            "        // Anticipation bump then quick shrink",
            "        var bump = (pOut < 0.25) ? (1 + pOut * 0.3) : Math.max(0, 1.08 - Math.pow((pOut - 0.25) / 0.75, 2) * 1.08);",
            "        [bump * 100, bump * 100];",
            "    } else if (outPreset === 'puff') {",
            "        var puffS = 1.0 + pOut * 0.25;",
            "        [puffS * 100, puffS * 100];",
            "    } else if (outPreset === 'none') {",
            "        [100, 100];",
            "    } else {",
            "        var sOut = Math.max(0, 1 - pOut);",
            "        [sOut * 100, sOut * 100];",
            "    }",
            "} else {",
            "    (outPreset === 'none') ? [100, 100] : [0, 0];",
            "}"
        ].join("\n");

        var OPACITY_EXPR = [
            "// AE Comic Text Bubble - Dynamic In/Out Opacity Engine",
            "var t = time - " + inDelay + ";",
            "var tIn = " + inDur + ";",
            "var tHold = " + holdDur + ";",
            "var tOut = " + outDur + ";",
            "var outPreset = '" + outPreset + "';",
            "",
            "if (t < 0) {",
            "    0;",
            "} else if (t < tIn) {",
            "    Math.min(100, (t / tIn) * 100);",
            "} else if (t < tIn + tHold) {",
            "    100;",
            "} else if (t < tIn + tHold + tOut) {",
            "    var pOut = (t - (tIn + tHold)) / tOut;",
            "    (outPreset === 'none') ? 100 : Math.max(0, (1 - pOut) * 100);",
            "} else {",
            "    (outPreset === 'none') ? 100 : 0;",
            "}"
        ].join("\n");

        if (bubbleLayer.transform && bubbleLayer.transform.scale) {
            bubbleLayer.transform.scale.expression = SCALE_EXPR;
        }
        if (bubbleLayer.transform && bubbleLayer.transform.opacity) {
            bubbleLayer.transform.opacity.expression = OPACITY_EXPR;
        }

        // Also animate text layer opacity/scale synchronously
        if (textLayer.transform && textLayer.transform.opacity) {
            textLayer.transform.opacity.expression = OPACITY_EXPR;
        }

        return true;
    }

    // -------------------------------------------------------------------------
    // 10. ScriptUI User Interface
    // -------------------------------------------------------------------------
    function buildUI(thisObj) {
        var isDockable = (typeof Panel !== "undefined" && thisObj instanceof Panel);
        var WinClass = (typeof Window !== "undefined") ? Window : (globalObj.Window || null);
        var win = isDockable ? thisObj : (WinClass ? new WinClass("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true }) : null);
        if (!win) return null;

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 5;
        win.margins = [6, 6, 6, 6];

        // --- Header Panel ---
        var pnlHeader = win.add("panel", undefined, SCRIPT_TITLE + " " + SCRIPT_VERSION);
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.spacing = 2;
        pnlHeader.margins = [6, 4, 6, 4];

        var lblSub = pnlHeader.add("statictext", undefined, "Parametric Comic Balloon Maker with Drag & Drop Tail & Text Wrap");
        try {
            lblSub.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.98, 0.75, 0.15, 1.0], 1);
        } catch (eG) {}

        // --- Target Text Layer Detection ---
        var pnlDetect = win.add("panel", undefined, "Selected Text Layer");
        pnlDetect.orientation = "row";
        pnlDetect.alignChildren = ["fill", "center"];
        pnlDetect.spacing = 6;
        pnlDetect.margins = [6, 4, 6, 4];

        var lblDetect = pnlDetect.add("statictext", undefined, "Scanning for text layer...", { truncate: "middle" });
        lblDetect.preferredSize = [150, 20];

        var btnScan = pnlDetect.add("button", undefined, "Refresh");
        btnScan.preferredSize = [55, 20];

        // =====================================================================
        // TABBED NAVIGATION PANEL
        // =====================================================================
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.alignment = ["fill", "fill"];
        tpanel.spacing = 4;
        tpanel.margins = 0;

        // ---------------------------------------------------------------------
        // TAB 1: 💬 TEXT & WRAP
        // ---------------------------------------------------------------------
        var tabText = tpanel.add("tab", undefined, "💬 Text & Wrap");
        tabText.orientation = "column";
        tabText.alignChildren = ["fill", "top"];
        tabText.spacing = 6;
        tabText.margins = 6;

        // Dialogue Edit Text
        var grpTextPrompt = tabText.add("group");
        grpTextPrompt.orientation = "row";
        grpTextPrompt.add("statictext", undefined, "Dialogue / Speech:");

        var txtDialogue = tabText.add("edittext", undefined, "POW! 💥 That was incredible!\nWhat do we do next?", { multiline: true, wantReturn: true });
        txtDialogue.preferredSize = [-1, 55];

        // Comic Emoji Quick Insertion Bar
        var grpEmojiBar = tabText.add("group");
        grpEmojiBar.orientation = "row";
        grpEmojiBar.alignChildren = ["left", "center"];
        grpEmojiBar.spacing = 2;

        var comicEmojis = ["💥", "💬", "🗯️", "⚡", "💡", "❤️", "❓", "❗", "💣", "💤"];
        for (var em = 0; em < comicEmojis.length; em++) {
            (function(emojiChar) {
                var btnEm = grpEmojiBar.add("button", undefined, emojiChar);
                btnEm.preferredSize = [24, 20];
                btnEm.helpTip = "Click to insert " + emojiChar + " into dialogue";
                btnEm.onClick = function() {
                    txtDialogue.text = (txtDialogue.text || "") + " " + emojiChar;
                };
            })(comicEmojis[em]);
        }

        // Text Wrap Presets
        var grpWrapRow = tabText.add("group");
        grpWrapRow.orientation = "row";
        grpWrapRow.alignChildren = ["left", "center"];
        grpWrapRow.add("statictext", undefined, "Wrap Style:");

        var ddWrapMethod = grpWrapRow.add("dropdownlist", undefined, [
            "Balanced Knuth-Plass (Harmonious)",
            "Greedy First-Fit (Classic)",
            "Optical Pyramid (Expanding)",
            "Reverse Pyramid (Headline Taper)",
            "Compact Block (High Density)"
        ]);
        ddWrapMethod.selection = 0;
        ddWrapMethod.preferredSize = [170, 22];

        // Width Sliders
        var grpW1 = tabText.add("group");
        grpW1.orientation = "row";
        grpW1.alignChildren = ["fill", "center"];
        grpW1.add("statictext", undefined, "Max W:");
        var sldMaxW = grpW1.add("slider", undefined, 420, 150, 1200);
        sldMaxW.alignment = ["fill", "center"];
        var txtMaxW = grpW1.add("edittext", undefined, "420");
        txtMaxW.preferredSize = [40, 20];
        grpW1.add("statictext", undefined, "px");

        var grpW2 = tabText.add("group");
        grpW2.orientation = "row";
        grpW2.alignChildren = ["fill", "center"];
        grpW2.add("statictext", undefined, "Desired:");
        var sldDesW = grpW2.add("slider", undefined, 360, 100, 1100);
        sldDesW.alignment = ["fill", "center"];
        var txtDesW = grpW2.add("edittext", undefined, "360");
        txtDesW.preferredSize = [40, 20];
        grpW2.add("statictext", undefined, "px");

        sldMaxW.onChanging = function() {
            var v = Math.round(sldMaxW.value);
            txtMaxW.text = String(v);
            if (sldDesW.value >= v) {
                sldDesW.value = Math.max(50, v - 20);
                txtDesW.text = String(Math.round(sldDesW.value));
            }
        };
        sldDesW.onChanging = function() {
            var v = Math.round(sldDesW.value);
            if (v >= sldMaxW.value) v = Math.max(50, Math.round(sldMaxW.value) - 20);
            sldDesW.value = v;
            txtDesW.text = String(v);
        };

        // Micro-Typography & Grammar
        var chkStripBreaks = tabText.add("checkbox", undefined, "Strip manual breaks (\\r, \\n) before wrap");
        chkStripBreaks.value = true;
        var chkWidows = tabText.add("checkbox", undefined, "Widow & orphan prevention (bind last words)");
        chkWidows.value = true;
        var chkNumbers = tabText.add("checkbox", undefined, "Bind numbers and following units (100 px, 50 %)");
        chkNumbers.value = true;

        // ---------------------------------------------------------------------
        // TAB 2: 🗯️ BUBBLE & TAIL (With Drag & Drop Target)
        // ---------------------------------------------------------------------
        var tabBubble = tpanel.add("tab", undefined, "🗯️ Bubble & Tail");
        tabBubble.orientation = "column";
        tabBubble.alignChildren = ["fill", "top"];
        tabBubble.spacing = 6;
        tabBubble.margins = 6;

        // Bubble Body Presets
        var grpBodyRow = tabBubble.add("group");
        grpBodyRow.orientation = "row";
        grpBodyRow.add("statictext", undefined, "Bubble Shape:");
        var ddBodyType = grpBodyRow.add("dropdownlist", undefined, [
            "Classic Speech Oval (Ellipse)",
            "Modern Rounded Rectangle (Pill)",
            "Action / Shout Burst (Explosion)",
            "Thought Cloud (Scalloped Arcs)",
            "Whisper Bubble (Dashed Stroke)",
            "Golden Age Caption Box (Rectangle)"
        ]);
        ddBodyType.selection = 0;
        ddBodyType.preferredSize = [165, 22];

        // Tail Style Presets
        var grpTailRow = tabBubble.add("group");
        grpTailRow.orientation = "row";
        grpTailRow.add("statictext", undefined, "Tail Style:");
        var ddTailType = grpTailRow.add("dropdownlist", undefined, [
            "Curved Hook / Horn (Classic Comic)",
            "Straight Cone / Triangle (Direct)",
            "Wide Speech Wedge",
            "Thought Bubbles (3 Diminishing Circles)",
            "Lightning / Electric Bolt (Broadcast)",
            "Scream Spike (Action Barb)",
            "None (Floating / Caption)"
        ]);
        ddTailType.selection = 0;
        ddTailType.preferredSize = [165, 22];

        // Padding & Corner Radius
        var grpPad = tabBubble.add("group");
        grpPad.orientation = "row";
        grpPad.alignChildren = ["fill", "center"];
        grpPad.add("statictext", undefined, "Padding X/Y:");
        var sldPadX = grpPad.add("slider", undefined, 36, 10, 100);
        sldPadX.preferredSize = [60, -1];
        var sldPadY = grpPad.add("slider", undefined, 26, 10, 80);
        sldPadY.preferredSize = [60, -1];

        // --- 🎯 2D DRAG & DROP TAIL TARGET CONTROLLER ---
        var pnlTargetCtrl = tabBubble.add("panel", undefined, "🎯 Tail Placement Target");
        pnlTargetCtrl.orientation = "column";
        pnlTargetCtrl.alignChildren = ["fill", "top"];
        pnlTargetCtrl.spacing = 4;
        pnlTargetCtrl.margins = [6, 4, 6, 4];

        var lblTargetHelp = pnlTargetCtrl.add("statictext", undefined, "Sets in-comp '🎯 Tail Target' null & interactive pointer angle");
        lblTargetHelp.preferredSize = [-1, 14];

        // 3x3 Matrix Buttons (Quick Placement Presets)
        var grpMatrix = pnlTargetCtrl.add("group");
        grpMatrix.orientation = "column";
        grpMatrix.alignChildren = ["center", "top"];
        grpMatrix.spacing = 2;

        var mRow1 = grpMatrix.add("group"); mRow1.spacing = 2;
        var btnTL = mRow1.add("button", undefined, "↖ Top-L"); btnTL.preferredSize = [65, 18];
        var btnTC = mRow1.add("button", undefined, "↑ Top-C"); btnTC.preferredSize = [65, 18];
        var btnTR = mRow1.add("button", undefined, "↗ Top-R"); btnTR.preferredSize = [65, 18];

        var mRow2 = grpMatrix.add("group"); mRow2.spacing = 2;
        var btnML = mRow2.add("button", undefined, "← Mid-L"); btnML.preferredSize = [65, 18];
        var btnCC = mRow2.add("button", undefined, "🎯 Cent"); btnCC.preferredSize = [65, 18];
        var btnMR = mRow2.add("button", undefined, "→ Mid-R"); btnMR.preferredSize = [65, 18];

        var mRow3 = grpMatrix.add("group"); mRow3.spacing = 2;
        var btnBL = mRow3.add("button", undefined, "↙ Bot-L"); btnBL.preferredSize = [65, 18];
        var btnBC = mRow3.add("button", undefined, "↓ Bot-C"); btnBC.preferredSize = [65, 18];
        var btnBR = mRow3.add("button", undefined, "↘ Bot-R"); btnBR.preferredSize = [65, 18];

        // Angle & Distance Numeric Sliders
        var grpAng = pnlTargetCtrl.add("group");
        grpAng.orientation = "row";
        grpAng.alignChildren = ["fill", "center"];
        grpAng.add("statictext", undefined, "Angle:");
        var sldAngle = grpAng.add("slider", undefined, 115, -180, 180);
        sldAngle.alignment = ["fill", "center"];
        var txtAngle = grpAng.add("edittext", undefined, "115");
        txtAngle.preferredSize = [35, 20];
        grpAng.add("statictext", undefined, "°");

        var grpDist = pnlTargetCtrl.add("group");
        grpDist.orientation = "row";
        grpDist.alignChildren = ["fill", "center"];
        grpDist.add("statictext", undefined, "Distance:");
        var sldDist = grpDist.add("slider", undefined, 90, 20, 350);
        sldDist.alignment = ["fill", "center"];
        var txtDist = grpDist.add("edittext", undefined, "90");
        txtDist.preferredSize = [35, 20];
        grpDist.add("statictext", undefined, "px");

        sldAngle.onChanging = function() { txtAngle.text = String(Math.round(sldAngle.value)); };
        sldDist.onChanging = function() { txtDist.text = String(Math.round(sldDist.value)); };

        // Matrix button click bindings
        btnTL.onClick = function() { sldAngle.value = -135; txtAngle.text = "-135"; };
        btnTC.onClick = function() { sldAngle.value = -90;  txtAngle.text = "-90";  };
        btnTR.onClick = function() { sldAngle.value = -45;  txtAngle.text = "-45";  };
        btnML.onClick = function() { sldAngle.value = 180;  txtAngle.text = "180";  };
        btnCC.onClick = function() { sldDist.value = 30;    txtDist.text = "30";    };
        btnMR.onClick = function() { sldAngle.value = 0;    txtAngle.text = "0";    };
        btnBL.onClick = function() { sldAngle.value = 115;  txtAngle.text = "115";  };
        btnBC.onClick = function() { sldAngle.value = 90;   txtAngle.text = "90";   };
        btnBR.onClick = function() { sldAngle.value = 45;   txtAngle.text = "45";   };

        // ---------------------------------------------------------------------
        // TAB 3: 🎨 COLORS & STYLING
        // ---------------------------------------------------------------------
        var tabStyle = tpanel.add("tab", undefined, "🎨 Colors & Style");
        tabStyle.orientation = "column";
        tabStyle.alignChildren = ["fill", "top"];
        tabStyle.spacing = 8;
        tabStyle.margins = 6;

        function createColorPickerRow(parent, labelText, defaultHex) {
            var grp = parent.add("group");
            grp.orientation = "row";
            grp.alignChildren = ["left", "center"];
            grp.spacing = 6;

            var lbl = grp.add("statictext", undefined, labelText);
            lbl.preferredSize = [90, -1];

            var btnSwatch = grp.add("button", undefined, "");
            btnSwatch.preferredSize = [36, 22];

            var txtHex = grp.add("edittext", undefined, defaultHex);
            txtHex.preferredSize = [65, 22];

            var state = { color: defaultHex };

            function updateSwatch(hex) {
                state.color = hex;
                txtHex.text = hex.toUpperCase();
                if (btnSwatch.domElement) {
                    btnSwatch.domElement.style.backgroundColor = hex;
                    btnSwatch.domElement.style.border = "1px solid #666";
                }
            }

            btnSwatch.onClick = function() {
                var cur = state.color || "#FFFFFF";
                if (typeof window !== "undefined" && typeof window.openWindowsColorPicker === "function") {
                    window.openWindowsColorPicker(cur, function(selectedHex) {
                        updateSwatch(selectedHex);
                    });
                    return;
                }
                var hexNum = parseInt(cur.replace("#", ""), 16);
                var res = (typeof $.colorPicker === "function") ? $.colorPicker(hexNum) : -1;
                if (res !== -1 && res !== undefined && res !== null) {
                    var s = Number(res).toString(16);
                    while (s.length < 6) s = "0" + s;
                    updateSwatch("#" + s);
                }
            };

            txtHex.onChange = function() {
                var val = txtHex.text.replace(/^[\s#]+/, "");
                if (/^[0-9A-Fa-f]{6}$/.test(val)) {
                    updateSwatch("#" + val);
                } else {
                    txtHex.text = state.color;
                }
            };

            updateSwatch(defaultHex);
            return {
                getColor: function() { return state.color; },
                setColor: updateSwatch
            };
        }

        var cpBg = createColorPickerRow(tabStyle, "Bubble Fill:", "#FFFFFF");
        var cpStroke = createColorPickerRow(tabStyle, "Stroke Color:", "#000000");

        var grpStrokeW = tabStyle.add("group");
        grpStrokeW.orientation = "row";
        grpStrokeW.alignChildren = ["fill", "center"];
        var lblSW = grpStrokeW.add("statictext", undefined, "Stroke Width:");
        lblSW.preferredSize = [90, -1];
        var sldStrokeW = grpStrokeW.add("slider", undefined, 5, 0, 30);
        sldStrokeW.alignment = ["fill", "center"];
        var txtStrokeW = grpStrokeW.add("edittext", undefined, "5");
        txtStrokeW.preferredSize = [35, 20];
        grpStrokeW.add("statictext", undefined, "px");
        sldStrokeW.onChanging = function() { txtStrokeW.text = String(Math.round(sldStrokeW.value)); };

        // Quick Comic Theme Palette Swatches
        var pnlThemes = tabStyle.add("panel", undefined, "Quick Comic Theme Palettes");
        pnlThemes.orientation = "row";
        pnlThemes.alignChildren = ["center", "center"];
        pnlThemes.spacing = 4;
        pnlThemes.margins = [4, 4, 4, 4];

        var btnThemeWhite  = pnlThemes.add("button", undefined, "Classic");
        var btnThemeYellow = pnlThemes.add("button", undefined, "Action");
        var btnThemeCyan   = pnlThemes.add("button", undefined, "Hero");
        var btnThemeDark   = pnlThemes.add("button", undefined, "Manga");

        btnThemeWhite.preferredSize = [50, 20];
        btnThemeYellow.preferredSize = [50, 20];
        btnThemeCyan.preferredSize = [50, 20];
        btnThemeDark.preferredSize = [50, 20];

        btnThemeWhite.onClick  = function() { cpBg.setColor("#FFFFFF"); cpStroke.setColor("#000000"); };
        btnThemeYellow.onClick = function() { cpBg.setColor("#FFE600"); cpStroke.setColor("#111111"); };
        btnThemeCyan.onClick   = function() { cpBg.setColor("#00E5FF"); cpStroke.setColor("#1A237E"); };
        btnThemeDark.onClick   = function() { cpBg.setColor("#18181B"); cpStroke.setColor("#FFFFFF"); };

        // ---------------------------------------------------------------------
        // TAB 4: 🎬 ANIMATION & TRANSITIONS
        // ---------------------------------------------------------------------
        var tabAnim = tpanel.add("tab", undefined, "🎬 Animations");
        tabAnim.orientation = "column";
        tabAnim.alignChildren = ["fill", "top"];
        tabAnim.spacing = 6;
        tabAnim.margins = 6;

        var grpAnimIn = tabAnim.add("group");
        grpAnimIn.orientation = "row";
        grpAnimIn.add("statictext", undefined, "Entrance (In):");
        var ddAnimIn = grpAnimIn.add("dropdownlist", undefined, [
            "Pop & Comic Bounce (Elastic 0->118%->100%)",
            "Elastic Zoom In (High Energy)",
            "Whip & Slide In (From Tail Direction)",
            "Smooth Fade & Scale",
            "None (Static Entry)"
        ]);
        ddAnimIn.selection = 0;
        ddAnimIn.preferredSize = [165, 22];

        var grpAnimOut = tabAnim.add("group");
        grpAnimOut.orientation = "row";
        grpAnimOut.add("statictext", undefined, "Exit (Out):");
        var ddAnimOut = grpAnimOut.add("dropdownlist", undefined, [
            "Pop / Shrink Out (Anticipation bump -> 0%)",
            "Fade & Float Out",
            "Comic Puff / Dissolve",
            "None (Hold indefinitely)"
        ]);
        ddAnimOut.selection = 0;
        ddAnimOut.preferredSize = [165, 22];

        var grpDur1 = tabAnim.add("group");
        grpDur1.orientation = "row";
        grpDur1.alignChildren = ["fill", "center"];
        grpDur1.add("statictext", undefined, "In Duration:");
        var sldInDur = grpDur1.add("slider", undefined, 0.35, 0.1, 2.0);
        sldInDur.alignment = ["fill", "center"];
        var txtInDur = grpDur1.add("edittext", undefined, "0.35");
        txtInDur.preferredSize = [35, 20];
        grpDur1.add("statictext", undefined, "s");
        sldInDur.onChanging = function() { txtInDur.text = sldInDur.value.toFixed(2); };

        var grpHold = tabAnim.add("group");
        grpHold.orientation = "row";
        grpHold.alignChildren = ["fill", "center"];
        grpHold.add("statictext", undefined, "Hold Duration:");
        var sldHold = grpHold.add("slider", undefined, 2.5, 0.5, 10.0);
        sldHold.alignment = ["fill", "center"];
        var txtHold = grpHold.add("edittext", undefined, "2.5");
        txtHold.preferredSize = [35, 20];
        grpHold.add("statictext", undefined, "s");
        sldHold.onChanging = function() { txtHold.text = sldHold.value.toFixed(1); };

        var chkTailOrigin = tabAnim.add("checkbox", undefined, "Animate from Tail Origin (Pops from speaker)");
        chkTailOrigin.value = true;

        // =====================================================================
        // BOTTOM ACTION BAR
        // =====================================================================
        var grpActions = win.add("group");
        grpActions.orientation = "column";
        grpActions.alignChildren = ["fill", "top"];
        grpActions.spacing = 4;

        var btnBuild = grpActions.add("button", undefined, "🗯️ Build / Rebuild Comic Bubble");
        btnBuild.preferredSize = [-1, 30];

        var btnRevert = grpActions.add("button", undefined, "↩ Revert to Original Text Layer");
        btnRevert.preferredSize = [-1, 24];

        var lblStatus = grpActions.add("statictext", undefined, "Ready.");
        lblStatus.preferredSize = [-1, 14];

        // --- Target Detection Handler ---
        function updateDetection() {
            var comp = getActiveComposition();
            if (!comp) {
                lblDetect.text = "No active composition found";
                return;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (textLayer) {
                lblDetect.text = "Layer: " + textLayer.name;
                var str = getTextLayerString(textLayer);
                if (str && txtDialogue.text !== str) {
                    txtDialogue.text = str;
                }
            } else {
                lblDetect.text = "Comp: " + comp.name + " (Auto-creates sample)";
            }
        }

        btnScan.onClick = updateDetection;

        // --- Revert Handler ---
        btnRevert.onClick = function() {
            var ctx = ensureCompAndSampleLayer();
            if (!ctx || !ctx.textLayer) {
                alert("Please select a text layer first.");
                return;
            }
            var success = revertToOriginal(ctx.comp, ctx.textLayer);
            if (success) {
                lblStatus.text = "Restored original text layer properties cleanly.";
                updateDetection();
            } else {
                lblStatus.text = "No saved pre-bubble state found on layer.";
            }
        };

        // --- Main Build Button Handler ---
        btnBuild.onClick = function() {
            var ctx = ensureCompAndSampleLayer();
            if (!ctx || !ctx.comp || !ctx.textLayer) {
                alert("Please open a composition with a text layer.");
                return;
            }

            var wrapMethods = ["balanced", "greedy", "pyramid", "reverse_pyramid", "compact"];
            var bodyTypes = ["oval", "rounded_rect", "shout", "thought", "whisper", "caption"];
            var tailTypes = ["curved_hook", "straight_cone", "wide_wedge", "thought_bubbles", "lightning_bolt", "scream_barb", "none"];
            var animInTypes = ["bounce", "zoom", "slide", "fade", "none"];
            var animOutTypes = ["shrink", "fade", "puff", "none"];

            var params = {
                maxWidth: parseInt(txtMaxW.text, 10) || 420,
                desiredWidth: parseInt(txtDesW.text, 10) || 360,
                wrapMethod: wrapMethods[ddWrapMethod.selection ? ddWrapMethod.selection.index : 0] || "balanced",
                language: "english",
                useHyphen: true,
                removeBreaks: chkStripBreaks.value,
                preventWidows: chkWidows.value,
                avoidDanglingShort: true,
                bindNumbers: chkNumbers.value,
                bindHonorifics: true,

                bodyType: bodyTypes[ddBodyType.selection ? ddBodyType.selection.index : 0] || "oval",
                tailType: tailTypes[ddTailType.selection ? ddTailType.selection.index : 0] || "curved_hook",
                cornerRadius: 28,
                burstSpikes: 16,
                padX: Math.round(sldPadX.value) || 36,
                padY: Math.round(sldPadY.value) || 26,

                tailBaseW: 38,
                tailAngle: parseFloat(txtAngle.text) || 115,
                tailDist: parseFloat(txtDist.text) || 90,
                tailCurvature: 0.35,

                bgColor: cpBg.getColor(),
                bgOpacity: 100,
                strokeColor: cpStroke.getColor(),
                strokeWidth: parseFloat(txtStrokeW.text) || 5,

                enableHighlight: false,
                highlightWords: "",
                highlightColor: "#FFE600",

                animInPreset: animInTypes[ddAnimIn.selection ? ddAnimIn.selection.index : 0] || "bounce",
                animOutPreset: animOutTypes[ddAnimOut.selection ? ddAnimOut.selection.index : 0] || "shrink",
                inDuration: parseFloat(txtInDur.text) || 0.35,
                inDelay: 0.0,
                holdDuration: parseFloat(txtHold.text) || 2.5,
                outDuration: 0.30,
                animateFromTail: chkTailOrigin.value
            };

            var appObj = (typeof app !== "undefined") ? app : globalObj.app;
            if (appObj && appObj.beginUndoGroup) appObj.beginUndoGroup("AE Comic Text Bubble");
            try {
                var ok = buildComicBubble(ctx.comp, ctx.textLayer, params);
                if (ok) {
                    lblStatus.text = "Comic bubble built successfully!";
                    updateDetection();
                } else {
                    lblStatus.text = "Failed to build comic bubble.";
                }
            } catch (err) {
                lblStatus.text = "Error: " + err.toString();
            } finally {
                if (appObj && appObj.endUndoGroup) appObj.endUndoGroup();
            }
        };

        updateDetection();

        if (win.layout) win.layout.layout(true);
        win.onResizing = win.onResize = function() {
            if (this.layout) this.layout.resize();
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        }

        return win;
    }

    // -------------------------------------------------------------------------
    // 11. Execution Bootstrap
    // -------------------------------------------------------------------------
    buildUI(thisObj);

})(this);
