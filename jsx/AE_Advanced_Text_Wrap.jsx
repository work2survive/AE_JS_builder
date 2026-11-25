// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE ADVANCED TEXT WRAP v1.3.0
// =============================================================================
//
// PURPOSE:
//   An advanced typographic paragraph composer and text wrapping engine for
//   Adobe After Effects. Wraps text not merely by box clipping, but by crafting
//   visually harmonious, balanced paragraphs with micro-typographic precision.
//
// KEY CAPABILITIES:
//   1. Balanced Paragraph Composer (Knuth-Plass / InDesign Style):
//      - Evaluates all candidate line breaks across the entire paragraph.
//      - Minimizes raggedness, eliminates abrupt line-length jumps, and balances lines.
//   2. Multiple Wrap Methods:
//      - Balanced Paragraph (Harmonious line lengths across the paragraph)
//      - Greedy First-Fit (Polished classic wrapping up to Max Width)
//      - Optical Pyramid (Centered / Stanza card with expanding line lengths)
//      - Reverse Pyramid (Top-heavy headline style tapering downwards)
//      - Compact Block (Maximum density within Max Width)
//   3. Multilingual Algorithmic Hyphenation:
//      - Built-in syllable segmentation for English, Spanish, French, German, Italian, and Universal.
//      - Configurable minimum word length, minimum prefix, and minimum suffix.
//      - Prevents hyphen ladders (consecutive line-ending hyphens).
//   4. Micro-Typographic Rules & Semantic Unit Binding:
//      - Option to remove existing text breaks (\r, \n) before wrapping (Default: ON).
//      - Non-breaking spaces (U+00A0) prevent dangling short words / prepositions.
//      - Binds numbers and following units/symbols (e.g., "100 px", "50 %", "25 kg").
//      - Binds honorifics and abbreviations (e.g., "Dr. Smith", "e.g. typography").
//      - Widow & orphan prevention (ensures last line never has a lonely single word).
//   5. Dual Width Constraints (Ceiling & Desired Target):
//      - Max Width (Ceiling): Absolute pixel constraint boundary.
//      - Desired Approx Width: Desired visual paragraph width (always < Max Width).
//   6. Non-Destructive State Storage & Idempotent Re-wrapping:
//      - Stores pristine original text (preserving manual breaks \r/\n), box dimensions,
//        layer position, anchor point, and bounding box inside an "Advanced Text Wrap" effect.
//      - When switching wrap methods or parameters, always reads from original pristine text.
//      - One-click restoration back to exact original state and coordinates.
//   7. Visual Position Matching (Zero-Drift Paragraph Anchoring):
//      - Visually matches the exact position of the original pre-wrap text once wrapped (Default: ON).
//      - Three matching reference modes: By Text Justification (Natural Flow), Visual Center
//        (Symmetric Expansion), or Top Edge (First Line Fixed).
//      - Guarantees titles, lower-thirds, and centered cards never drop or drift when lines expand.
//   8. Anchor Point Auto-Alignment (AE-Align-AnchorPoint Mechanics):
//      - Auto-aligns layer Anchor Point according to text justification (Left -> Left edge,
//        Center -> Center, Right -> Right edge). Default: ON.
//      - Choice between Apply Once (zero-shift baked position) or Live Expression (reactive to justification changes).
//      - Scale, rotation, and 3D orientation-safe position compensation (Zero Content Jump).
//   9. Universal Compatibility:
//      - Works identically on Point Text and Paragraph (Box) Text.
//      - Works across all text alignments (Left, Center, Right, Justified).
//      - 100% interoperable with AE-Text-Highlight and AE-replace-color-emojis.
//
// REPOSITORY:
//   https://github.com/work2survive/AE-advanced-text-wrap
//
// LIVE DEMO:
//   https://work2survive.github.io/AE_JS_builder/?jsx=AE_Advanced_Text_Wrap.jsx&autobuild=true
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_TITLE   = "AE Advanced Text Wrap";
    var SCRIPT_VERSION = "v1.5.0";
    var GITHUB_URL     = "https://github.com/work2survive/AE-advanced-text-wrap";
    var README_URL     = "https://github.com/work2survive/AE-advanced-text-wrap/blob/main/README.md";

    // -------------------------------------------------------------------------
    // 1. Safe Environment & Polyfills (ES3 Compatibility for native AE ExtendScript)
    // -------------------------------------------------------------------------
    var globalObj = (typeof $ !== "undefined" && typeof $.global !== "undefined")
        ? $.global
        : (typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));

    if (typeof $ === "undefined") {
        globalObj.$ = {
            global: globalObj,
            writeln: function (msg) {
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

    function trimStart(str) {
        if (!str) return "";
        return String(str).replace(/^[\s\uFEFF\xA0]+/g, "");
    }

    function trimEnd(str) {
        if (!str) return "";
        return String(str).replace(/[\s\uFEFF\xA0]+$/g, "");
    }

    /**
     * Strips existing manual line breaks and carriage returns (\r, \n, \u2028, \u2029),
     * collapsing adjoining whitespace into a single clean space.
     */
    function stripExistingLineBreaks(str) {
        if (!str) return "";
        return String(str).replace(/[ \t]*[\r\n\u2028\u2029]+[ \t]*/g, " ");
    }

    function arrayIndexOf(arr, val) {
        if (!arr) return -1;
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === val) return i;
        }
        return -1;
    }

    // -------------------------------------------------------------------------
    // 2. Composition & Text Layer Detection
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

    function getTextDocument(layer) {
        if (!layer) return null;
        try {
            var prop = layer.property("ADBE Text Properties") || layer.property("Text");
            if (prop) {
                var docProp = prop.property("ADBE Text Document") || layer.property("Source Text");
                if (docProp && docProp.value) return docProp.value;
            }
            if (layer.sourceText && layer.sourceText.value) return layer.sourceText.value;
            if (layer.text && typeof layer.text === "object") return layer.text;
        } catch (e) {}
        return null;
    }

    function getTextLayerString(layer) {
        if (!layer) return "";
        try {
            var doc = getTextDocument(layer);
            if (doc && doc.text !== undefined) return String(doc.text);
            var srcProp = layer.property("Source Text") || layer.sourceText;
            if (srcProp && srcProp.value !== undefined) {
                var v = srcProp.value;
                if (v && typeof v === "object" && v.text !== undefined) return String(v.text);
                return String(v || "");
            }
            if (typeof layer.text === "string") return layer.text;
        } catch (e) {}
        return "";
    }

    // -------------------------------------------------------------------------
    // 3. Multi-Lingual Algorithmic Syllabification & Hyphenation
    // -------------------------------------------------------------------------
    // Clean syllable patterns across English, Spanish, French, German, and Italian
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

    /**
     * Splits a word into valid hyphenation syllables according to language grammar.
     * Respects minPrefix and minSuffix constraints.
     */
    function hyphenateWord(word, lang, minWordLen, minPrefix, minSuffix) {
        if (!word) return [word];
        if (minWordLen === undefined) minWordLen = 6;
        if (minPrefix === undefined) minPrefix = 3;
        if (minSuffix === undefined) minSuffix = 3;

        // Skip words shorter than minWordLen or all-caps acronyms
        if (word.length < minWordLen) return [word];
        if (/^[A-Z0-9_\-]+$/.test(word)) return [word];
        // Skip words containing emojis or surrogate pairs
        if (/[\uD800-\uDFFF]/.test(word)) return [word];

        var config = HYPHEN_PATTERNS[lang] || HYPHEN_PATTERNS.english;
        var vowels = config.vowels;
        var wLower = word.toLowerCase();

        // 1. Check known prefixes
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

        // 2. Check known suffixes
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

        // 3. Double consonant division (e.g., let-ter, hap-py, com-mon, run-ning)
        var doubleMatch = word.match(/([bcdfghjklmnpqrstvwxz])\1/i);
        if (doubleMatch && doubleMatch.index !== undefined) {
            var splitPos = doubleMatch.index + 1;
            if (splitPos >= minPrefix && (word.length - splitPos) >= minSuffix) {
                return [word.slice(0, splitPos), word.slice(splitPos)];
            }
        }

        // 4. Vowel-Consonant-Consonant-Vowel (VCCV) division
        for (var i = minPrefix; i <= word.length - minSuffix; i++) {
            var c1 = word.charAt(i - 1);
            var c2 = word.charAt(i);
            var prevIsVowel = vowels.test(c1);
            var curIsVowel = vowels.test(c2);

            // V-CV rule: single consonant between vowels usually attaches to second syllable (e.g. pa-per, ti-ger)
            if (i > 1 && vowels.test(word.charAt(i - 2)) && !prevIsVowel && curIsVowel) {
                var cut = i - 1;
                if (cut >= minPrefix && (word.length - cut) >= minSuffix) {
                    return [word.slice(0, cut), word.slice(cut)];
                }
            }

            // VC-CV rule: two consonants between vowels split (e.g. un-der, doc-tor)
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
    // 4. Micro-Typography Grammar & Semantic Unit Binding
    // -------------------------------------------------------------------------
    var SHORT_WORDS_DICT = {
        english: ["a", "an", "the", "in", "on", "at", "to", "for", "with", "by", "of", "from", "as", "is", "it", "into", "like", "through", "after", "over", "between", "out", "about", "but", "and", "or", "nor", "so", "yet", "if", "than", "this", "that"],
        spanish: ["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "en", "con", "por", "para", "sin", "tras", "y", "e", "o", "u", "ni", "que", "a", "sobre", "entre", "hacia", "hasta", "desde", "se", "su", "sus"],
        french: ["le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "en", "à", "dans", "par", "pour", "sur", "avec", "sans", "sous", "et", "ou", "mais", "donc", "car", "ni", "que", "ce", "sa", "ses"],
        german: ["der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einem", "einen", "eines", "in", "im", "an", "am", "auf", "aus", "bei", "beim", "mit", "nach", "von", "vom", "zu", "zum", "zur", "und", "oder", "aber", "wie", "als", "um", "für"],
        italian: ["il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "del", "dello", "della", "dei", "degli", "delle", "a", "al", "allo", "alla", "ai", "agli", "alle", "da", "dal", "in", "nel", "con", "su", "sul", "per", "tra", "fra", "e", "o", "ma", "che"],
        universal: ["a", "an", "the", "in", "on", "at", "to", "of", "de", "en", "et", "y", "und", "el", "la"]
    };

    var NBSP = "\u00A0"; // Non-breaking space

    /**
     * Applies micro-typographic bindings (NBSP) to prevent dangling prepositions,
     * orphan numbers, broken unit symbols, and isolated words.
     */
    function applySemanticBindings(text, lang, opts) {
        if (!text) return "";
        var str = text;

        // 1. Preserve and protect Unicode emoji sequences
        // Multi-byte surrogate pairs are atomic and should never be broken
        var dict = SHORT_WORDS_DICT[lang] || SHORT_WORDS_DICT.english;

        // 2. Numbers & Units (e.g., "100 px", "25 %", "1920 x 1080", "50 kg", "12 min")
        if (opts.bindNumbers) {
            str = str.replace(/(\b\d+(?:[.,]\d+)?)\s+([a-zA-Z%$€£¥°]+)\b/g, "$1" + NBSP + "$2");
            // Currency symbols before figures ($ 500, € 250)
            str = str.replace(/(^|[\s(])([\$€£¥₹])\s*(\d+)/g, "$1$2" + NBSP + "$3");
        }

        // 3. Honorifics and common abbreviations (Dr. Smith, Mr. Jones, e.g. text)
        if (opts.bindHonorifics) {
            str = str.replace(/\b(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Sr\.|Sra\.|St\.|e\.g\.|i\.e\.|etc\.)\s+([A-Za-z0-9])/g, "$1" + NBSP + "$2");
        }

        // 4. Dangling Short Words & Prepositions at end of lines
        if (opts.avoidDanglingShort) {
            for (var i = 0; i < dict.length; i++) {
                var w = dict[i];
                // Word preceded by word boundary / space, followed by space -> convert space to NBSP
                var reg = new RegExp("(^|[\\s(\"«¿¡])(" + w + ")\\s+", "gi");
                str = str.replace(reg, "$1$2" + NBSP);
            }
        }

        // 5. Widow & Orphan Prevention (bind last two words of every paragraph)
        if (opts.preventWidows) {
            var paras = str.split(/\r\n|\r|\n/);
            for (var p = 0; p < paras.length; p++) {
                var pStr = paras[p];
                // Match last space before the final word in the paragraph
                paras[p] = pStr.replace(/(\S+)\s+(\S+)$/, "$1" + NBSP + "$2");
            }
            str = paras.join("\r");
        }

        return str;
    }

    // -------------------------------------------------------------------------
    // 5. Typography Measurement Engine
    // -------------------------------------------------------------------------
    /**
     * Creates an accurate measurement callback for the target text layer.
     * Uses a single off-screen temporary text layer to measure sourceRectAtTime width.
     */
    function createTextMeasurer(comp, textLayer, textDoc) {
        var fontSize = (textDoc && textDoc.fontSize) ? textDoc.fontSize : 48;
        var font = (textDoc && textDoc.font) ? textDoc.font : "";
        var tracking = (textDoc && textDoc.tracking) ? textDoc.tracking : 0;

        var measLayer = null;
        var measDocProp = null;
        var measDoc = null;

        try {
            measLayer = comp.layers.addText("");
            measLayer.enabled = true;
            if (measLayer.transform && measLayer.transform.position) {
                measLayer.transform.position.setValue([-9999, -9999, 0]);
            }
            measDocProp = measLayer.property("Source Text");
            measDoc = measDocProp ? measDocProp.value : null;
            if (measDoc) {
                measDoc.fontSize = fontSize;
                if (font) {
                    try { measDoc.font = font; } catch (eF) {}
                }
                measDoc.tracking = tracking;
                measDoc.applyStroke = false;
                measDoc.applyFill = true;
                try { measDoc.boxText = false; } catch (eBT) {}
                try { measDocProp.setValue(measDoc); } catch (eDS) {}
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
            // Fallback estimation if emulator / no sourceRect
            if (typeof AETextCalibration !== "undefined" && typeof AETextCalibration.measureLineWidth === "function") {
                return AETextCalibration.measureLineWidth(str, fontSize, font, tracking);
            }
            return str.length * (fontSize * 0.52);
        }

        var pipeW = rawMeasure("|");

        // Pipe technique: trailing spaces have 0 width in AE sourceRect unless bounded by a glyph
        function measureAdvance(str) {
            if (!str || str.length === 0) return 0;
            var w = rawMeasure(str + "|") - pipeW;
            return Math.max(0, w);
        }

        return {
            measureAdvance: measureAdvance,
            fontSize: fontSize,
            hyphenWidth: measureAdvance("-"),
            cleanup: function () {
                if (measLayer) {
                    try { measLayer.remove(); } catch (eR) {}
                    measLayer = null;
                }
            }
        };
    }

    // -------------------------------------------------------------------------
    // 6. Paragraph Line Breaking & Optimization Algorithms
    // -------------------------------------------------------------------------

    /**
     * Splits paragraph text into wrap tokens, optionally expanding hyphenated syllables.
     */
    function tokenizeParagraph(paraText, lang, useHyphen, minWordLen, measurer) {
        // Normalize regular spaces while preserving NBSP (\u00A0)
        var rawTokens = paraText.match(/\S+/g) || [];
        var tokens = [];

        for (var i = 0; i < rawTokens.length; i++) {
            var raw = rawTokens[i];
            // Split by NBSP if attached, but treat NBSP unit as atomic
            var parts = raw.split(NBSP);
            var isBound = parts.length > 1;

            var word = raw;
            var syllables = (useHyphen && !isBound) ? hyphenateWord(word, lang, minWordLen, 3, 3) : [word];

            tokens.push({
                text: word,
                syllables: syllables,
                isBound: isBound,
                width: measurer.measureAdvance(word)
            });
        }
        return tokens;
    }

    /**
     * Method 1: Balanced Paragraph (Knuth-Plass Dynamic Programming Style)
     * Finds global line break sequence that minimizes raggedness variance across lines,
     * targeting desiredW while strictly respecting maxW.
     */
    function wrapBalanced(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW) {
        if (!desiredW || desiredW >= maxW) desiredW = Math.max(50, maxW - 20);
        var tokens = tokenizeParagraph(paraText, lang, useHyphen, minWordLen, measurer);
        if (tokens.length === 0) return [""];

        var n = tokens.length;
        // memoized dynamic programming: opt[i] = minimum cost from token i to end
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
                    // Test hyphenation of token j if enabled
                    if (useHyphen && tok.syllables && tok.syllables.length > 1) {
                        var pfx = tok.syllables[0];
                        var pfxW = measurer.measureAdvance(pfx + "-");
                        var testHyphenW = (j === i) ? pfxW : (currentLineWidth - tok.width + spaceW + pfxW);
                        if (testHyphenW <= maxW) {
                            var slackH = Math.abs(desiredW - testHyphenW);
                            var penaltyH = (slackH * slackH) + 8000 + cost[j]; // hyphen penalty
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
                    // Last line of paragraph: slack penalty is relaxed, but penalize severe widow
                    if (currentLineWidth < desiredW * 0.25 && n > 1) {
                        lineCost = 50000; // Widow penalty
                    } else {
                        lineCost = 0; // Natural last line
                    }
                } else {
                    // Intermediate line: quadratic deviation relative to desiredW
                    if (deltaDesired <= 0) {
                        lineCost = deltaDesired * deltaDesired;
                    } else {
                        // Beyond desiredW up to maxW: progressive soft pressure
                        lineCost = deltaDesired * deltaDesired * 1.6;
                    }
                }

                var totalCost = lineCost + cost[j + 1];
                if (totalCost < cost[i]) {
                    cost[i] = totalCost;
                    nextBreak[i] = j + 1;
                    hyphenAt[i] = false;
                }
            }
        }

        // Reconstruct lines
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
                tokens[nxt].text = rest; // Mutate remainder for subsequent line
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

    /**
     * Method 2: Greedy First-Fit (Polished Standard with Micro-Typographic Guardrails)
     * Fits up to desiredW and allows overflow only up to maxW when optimal.
     */
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
                // If adding token brings line closer to desiredW than breaking, or if line is very short
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
                // If token exceeds maxW, attempt hyphenation if enabled
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
                        // Word itself is wider than maxW: place on own line
                        lines.push(tok.text);
                        curTokens = [];
                        curWidth = 0;
                    }
                }
            }
        }

        if (curTokens.length > 0) {
            lines.push(curTokens.join(" "));
        }

        // Post-pass: check if final line is an orphan/widow
        if (lines.length > 1) {
            var lastLine = lines[lines.length - 1];
            var lastWords = lastLine.split(" ");
            if (lastWords.length === 1 && lines[lines.length - 2].indexOf(" ") !== -1) {
                var prevLine = lines[lines.length - 2];
                var prevWords = prevLine.split(" ");
                var stolenWord = prevWords.pop();
                lines[lines.length - 2] = prevWords.join(" ");
                lines[lines.length - 1] = stolenWord + " " + lastLine;
            }
        }

        return lines;
    }

    /**
     * Method 3: Optical Pyramid (Centered Stanza Card - Lines Expand Symmetrically)
     */
    function wrapOpticalPyramid(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW) {
        if (!desiredW || desiredW >= maxW) desiredW = Math.max(50, maxW - 20);
        var words = paraText.match(/\S+/g) || [];
        if (words.length === 0) return [""];
        if (words.length <= 3) return [words.join(" ")];

        // Target 3 to 4 graded steps up to desiredW (capped by maxW)
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

            if (lineWords.length > 0) {
                lines.push(lineWords.join(" "));
            }
            if (wordIdx >= words.length) break;
        }

        // Catch any remaining words on final line
        if (wordIdx < words.length) {
            var remaining = [];
            while (wordIdx < words.length) {
                remaining.push(words[wordIdx++]);
            }
            lines.push(remaining.join(" "));
        }

        return lines;
    }

    /**
     * Method 4: Reverse Pyramid (Headline / Lead-In Style - Lines Taper Downwards)
     */
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

            if (lineWords.length > 0) {
                lines.push(lineWords.join(" "));
            }
            if (wordIdx >= words.length) break;
        }

        if (wordIdx < words.length) {
            var remaining2 = [];
            while (wordIdx < words.length) {
                remaining2.push(words[wordIdx++]);
            }
            lines.push(remaining2.join(" "));
        }

        return lines;
    }

    /**
     * Method 5: Compact Block (Tightly Pack Lines up to Max Width)
     */
    function wrapCompactBlock(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW) {
        return wrapGreedy(paraText, maxW, desiredW, lang, useHyphen, minWordLen, measurer, spaceW);
    }

    // -------------------------------------------------------------------------
    // 7. State Storage & Restoration Engine
    // -------------------------------------------------------------------------
    var EFFECT_NAME = "Advanced Text Wrap";

    // -------------------------------------------------------------------------
    // 7. Non-Destructive State Storage & One-Click Restore Engine
    // -------------------------------------------------------------------------

    /**
     * Determines whether an expression on Anchor Point or Position was generated by this JSX
     * or the integrated anchor alignment engine.
     */
    function isExpressionFromThisJSX(expr) {
        if (!expr || typeof expr !== "string") return false;
        var s = expr.toLowerCase();
        if (s.indexOf("ae advanced text wrap") !== -1) return true;
        if (s.indexOf("advancedtextwrap") !== -1) return true;
        if (s.indexOf("dynamic alignment anchor") !== -1) return true;
        if (s.indexOf("dynamic alignment position compensator") !== -1) return true;
        if (s.indexOf("ae align anchor point") !== -1) return true;
        if (s.indexOf("sourcerectattime") !== -1 && s.indexOf("justification") !== -1 && (s.indexOf("7414") !== -1 || s.indexOf("targetx = r.left") !== -1)) {
            return true;
        }
        return false;
    }

    /**
     * Stores original pre-wrap text, box dimensions, position, anchor point, and bounding box
     * in an effect expression and layer comment.
     * Guarded: will NEVER overwrite an existing stored original state!
     */
    function storeOriginalState(textLayer, origText, isBox, boxSize, boxPos, origPos, origAP, anchorExpr, posExpr, origBounds) {
        if (!textLayer) return;
        try {
            // Guard: preserve pristine original state across multiple re-wraps
            var existing = readOriginalState(textLayer);
            if (existing && existing.text) return;

            var fxParade = textLayer.property("ADBE Effect Parade") || textLayer.property("Effects");
            if (!fxParade) return;

            var eff = fxParade.property(EFFECT_NAME);
            if (!eff) {
                try {
                    eff = fxParade.addProperty("ADBE Slider Control");
                } catch (eAdd) {}
            }
            if (eff) {
                eff.name = EFFECT_NAME;
                var sliderProp = eff.property("ADBE Slider Control-0001") || eff.property(1);
                if (sliderProp) {
                    var cleanAnchorExpr = anchorExpr || "";
                    if (isExpressionFromThisJSX(cleanAnchorExpr)) {
                        cleanAnchorExpr = "";
                    }
                    var cleanPosExpr = posExpr || "";
                    if (isExpressionFromThisJSX(cleanPosExpr)) {
                        cleanPosExpr = "";
                    }

                    var payload = {
                        text: origText,
                        isBox: Boolean(isBox),
                        boxSize: boxSize || null,
                        boxPos: boxPos || null,
                        position: (origPos && origPos.length >= 2) ? [origPos[0], origPos[1], (origPos.length > 2 ? origPos[2] : 0)] : null,
                        anchorPoint: (origAP && origAP.length >= 2) ? [origAP[0], origAP[1], (origAP.length > 2 ? origAP[2] : 0)] : null,
                        anchorExpr: cleanAnchorExpr,
                        posExpr: cleanPosExpr,
                        bounds: origBounds ? [origBounds.left, origBounds.top, origBounds.width, origBounds.height] : null
                    };
                    var jsonStr = "";
                    try {
                        jsonStr = encodeURIComponent(JSON.stringify(payload));
                    } catch (eJ) {
                        jsonStr = encodeURIComponent(origText);
                    }
                    sliderProp.expression = "/* AdvancedTextWrapState:" + jsonStr + " */\nvalue;";
                }
            }

            // Also mirror text in layer.comment for native AE inspector persistence
            try {
                if (textLayer.comment !== undefined && (!textLayer.comment || textLayer.comment.indexOf("AdvancedTextWrap") === -1)) {
                    textLayer.comment = "AdvancedTextWrap:" + origText;
                }
            } catch (eC) {}
        } catch (eStore) {}
    }

    /**
     * Reads the stored original state from the layer's effect or comment.
     */
    function readOriginalState(textLayer) {
        if (!textLayer) return null;
        try {
            var fxParade = textLayer.property("ADBE Effect Parade") || textLayer.property("Effects");
            if (fxParade) {
                var eff = fxParade.property(EFFECT_NAME);
                if (eff) {
                    var sliderProp = eff.property("ADBE Slider Control-0001") || eff.property(1);
                    if (sliderProp && sliderProp.expression) {
                        var expr = sliderProp.expression;
                        var match = expr.match(/\/\* AdvancedTextWrapState:(.*?) \*\//);
                        if (match && match[1]) {
                            var decoded = decodeURIComponent(match[1]);
                            try {
                                return JSON.parse(decoded);
                            } catch (eParse) {
                                return {
                                    text: decoded,
                                    isBox: false,
                                    boxSize: null,
                                    boxPos: null,
                                    position: null,
                                    anchorPoint: null,
                                    anchorExpr: "",
                                    posExpr: "",
                                    bounds: null
                                };
                            }
                        }
                    }
                }
            }

            // Fallback to layer.comment
            if (textLayer.comment && textLayer.comment.indexOf("AdvancedTextWrap:") === 0) {
                return {
                    text: textLayer.comment.slice("AdvancedTextWrap:".length),
                    isBox: false,
                    boxSize: null,
                    boxPos: null,
                    position: null,
                    anchorPoint: null,
                    anchorExpr: "",
                    posExpr: "",
                    bounds: null
                };
            }
        } catch (eRead) {}
        return null;
    }

    /**
     * Restores the layer back to its original unmodified text, box geometry,
     * position, and anchor point.
     * Removes Anchor Point and Position expressions if they come from this JSX.
     */
    function restoreOriginalText(textLayer) {
        if (!textLayer) return false;
        var state = readOriginalState(textLayer);

        var is3D = Boolean(textLayer.threeDLayer);
        var transform = textLayer.property("Transform");
        var apProp = transform ? transform.property("Anchor Point") : null;
        var posProp = transform ? transform.property("Position") : null;

        // If no stored state found, but expressions from this JSX are present on layer, clean them up!
        if (!state || !state.text) {
            var cleanedAny = false;
            if (apProp) {
                var curApExpr = "";
                try { curApExpr = apProp.expression || ""; } catch (e) {}
                if (isExpressionFromThisJSX(curApExpr)) {
                    try {
                        apProp.expression = "";
                        apProp.expressionEnabled = false;
                        cleanedAny = true;
                    } catch (eAE) {}
                }
            }
            if (posProp) {
                var curPosExpr = "";
                try { curPosExpr = posProp.expression || ""; } catch (e) {}
                if (isExpressionFromThisJSX(curPosExpr)) {
                    try {
                        posProp.expression = "";
                        posProp.expressionEnabled = false;
                        cleanedAny = true;
                    } catch (ePE) {}
                }
            }
            return cleanedAny;
        }

        var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
        var docProp = textProp ? (textProp.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
        if (!docProp) return false;

        // 1. Restore Source Text & Box Geometry
        var doc = docProp.value;
        if (doc) {
            doc.text = state.text;
            if (state.isBox && state.boxSize) {
                try {
                    doc.boxText = true;
                    doc.boxTextSize = state.boxSize;
                    if (state.boxPos) doc.boxTextPos = state.boxPos;
                } catch (eBox) {}
            }
            docProp.setValue(doc);
        } else {
            docProp.setValue(state.text);
        }

        // 2. Restore Transform: Position & Anchor Point
        if (transform) {
            if (apProp) {
                var currentAnchorExpr = "";
                try { currentAnchorExpr = apProp.expression || ""; } catch (eCAE) {}
                var isJSXAnchor = isExpressionFromThisJSX(currentAnchorExpr) || isExpressionFromThisJSX(state.anchorExpr);

                if (isJSXAnchor) {
                    try {
                        apProp.expression = "";
                        apProp.expressionEnabled = false;
                    } catch (eAE) {}
                } else if (state.anchorExpr) {
                    try {
                        apProp.expression = state.anchorExpr;
                    } catch (eAE2) {}
                } else {
                    try {
                        apProp.expression = "";
                        apProp.expressionEnabled = false;
                    } catch (eAE3) {}
                }

                if (state.anchorPoint && typeof state.anchorPoint[0] === "number") {
                    try {
                        if (is3D) {
                            apProp.setValue([state.anchorPoint[0], state.anchorPoint[1], state.anchorPoint[2] || 0]);
                        } else {
                            apProp.setValue([state.anchorPoint[0], state.anchorPoint[1]]);
                        }
                    } catch (eAS) {}
                }
            }

            if (posProp) {
                var currentPosExpr = "";
                try { currentPosExpr = posProp.expression || ""; } catch (eCPE) {}
                var isJSXPos = isExpressionFromThisJSX(currentPosExpr) || isExpressionFromThisJSX(state.posExpr);

                if (isJSXPos) {
                    try {
                        posProp.expression = "";
                        posProp.expressionEnabled = false;
                    } catch (ePE) {}
                } else if (state.posExpr) {
                    try {
                        posProp.expression = state.posExpr;
                    } catch (ePE2) {}
                } else {
                    try {
                        posProp.expression = "";
                        posProp.expressionEnabled = false;
                    } catch (ePE3) {}
                }

                if (state.position && typeof state.position[0] === "number") {
                    try {
                        if (posProp.dimensionsSeparated) {
                            var xP = transform.property("X Position");
                            var yP = transform.property("Y Position");
                            var zP = is3D ? transform.property("Z Position") : null;
                            if (xP) xP.setValue(state.position[0]);
                            if (yP) yP.setValue(state.position[1]);
                            if (zP) zP.setValue(state.position[2] || 0);
                        } else {
                            if (is3D) {
                                posProp.setValue([state.position[0], state.position[1], state.position[2] || 0]);
                            } else {
                                posProp.setValue([state.position[0], state.position[1]]);
                            }
                        }
                    } catch (ePS) {}
                }
            }
        }

        // 3. Remove effect and clear layer comment
        try {
            var fxParade = textLayer.property("ADBE Effect Parade") || textLayer.property("Effects");
            if (fxParade) {
                var eff = fxParade.property(EFFECT_NAME);
                if (eff) eff.remove();
            }
        } catch (eRem) {}

        try {
            if (textLayer.comment && textLayer.comment.indexOf("AdvancedTextWrap:") === 0) {
                textLayer.comment = "";
            }
        } catch (eCom) {}

        return true;
    }

    // -------------------------------------------------------------------------
    // 8. Anchor Point Auto-Alignment Engine (AE-Align-AnchorPoint Mechanics)
    // -------------------------------------------------------------------------

    /**
     * Determines text layer bounding box via sourceRectAtTime or box text definition
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

        return { left: 0, top: 0, width: 100, height: 100 };
    }

    /**
     * Computes target [tx, ty] anchor coordinate from bounding box and alignment modes
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
     * Rotates displacement vector by layer 2D rotation or 3D orientation & Euler rotations
     */
    function applyTransformRotation(v, layer, is3D) {
        var transform = layer.property("Transform");
        if (!transform) return v;

        if (!is3D) {
            var rotProp = transform.property("Rotation");
            var rz = rotProp ? (rotProp.value || 0) : 0;
            if (Math.abs(rz) > 0.0001) {
                var rad = rz * (Math.PI / 180);
                return [
                    v[0] * Math.cos(rad) - v[1] * Math.sin(rad),
                    v[0] * Math.sin(rad) + v[1] * Math.cos(rad),
                    v[2] || 0
                ];
            }
            return v;
        }

        var orientProp = transform.property("Orientation");
        var xRotProp = transform.property("X Rotation");
        var yRotProp = transform.property("Y Rotation");
        var zRotProp = transform.property("Z Rotation") || transform.property("Rotation");

        var oVal = (orientProp && orientProp.value) ? orientProp.value : [0, 0, 0];
        var xRot = (xRotProp && typeof xRotProp.value === "number") ? xRotProp.value : 0;
        var yRot = (yRotProp && typeof yRotProp.value === "number") ? yRotProp.value : 0;
        var zRot = (zRotProp && typeof zRotProp.value === "number") ? zRotProp.value : 0;

        function rotX(vec, deg) {
            if (!deg || Math.abs(deg) < 0.0001) return vec;
            var r = deg * (Math.PI / 180);
            var c = Math.cos(r), s = Math.sin(r);
            return [vec[0], vec[1] * c - vec[2] * s, vec[1] * s + vec[2] * c];
        }
        function rotY(vec, deg) {
            if (!deg || Math.abs(deg) < 0.0001) return vec;
            var r = deg * (Math.PI / 180);
            var c = Math.cos(r), s = Math.sin(r);
            return [vec[0] * c + vec[2] * s, vec[1], -vec[0] * s + vec[2] * c];
        }
        function rotZ(vec, deg) {
            if (!deg || Math.abs(deg) < 0.0001) return vec;
            var r = deg * (Math.PI / 180);
            var c = Math.cos(r), s = Math.sin(r);
            return [vec[0] * c - vec[1] * s, vec[0] * s + vec[1] * c, vec[2]];
        }

        var res = [v[0], v[1], v[2] || 0];
        if (zRot) res = rotZ(res, zRot);
        if (yRot) res = rotY(res, yRot);
        if (xRot) res = rotX(res, xRot);
        if (oVal[2]) res = rotZ(res, oVal[2]);
        if (oVal[1]) res = rotY(res, oVal[1]);
        if (oVal[0]) res = rotX(res, oVal[0]);
        return res;
    }

    /**
     * Detects current text justification ("left", "center", "right") from layer TextDocument
     */
    function detectLayerJustification(textLayer) {
        if (!textLayer) return "left";
        try {
            var doc = getTextDocument(textLayer);
            if (doc && doc.justification !== undefined) {
                var j = doc.justification;
                if (j === 7414 || j === 7417 || j === "center") return "center";
                if (j === 7413 || j === 7416 || j === "right") return "right";
                return "left";
            }
            var srcProp = textLayer.property("Source Text") || textLayer.sourceText;
            if (srcProp && srcProp.value && srcProp.value.justification !== undefined) {
                var j2 = srcProp.value.justification;
                if (j2 === 7414 || j2 === 7417 || j2 === "center") return "center";
                if (j2 === 7413 || j2 === 7416 || j2 === "right") return "right";
                return "left";
            }
            if (textLayer.justification) {
                var j3 = textLayer.justification;
                if (j3 === 7414 || j3 === 7417 || j3 === "center") return "center";
                if (j3 === 7413 || j3 === 7416 || j3 === "right") return "right";
                return "left";
            }
        } catch (e) {}
        return "left";
    }

    /**
     * Generates dynamic Anchor Point expression that reacts to justification changes
     * Uses a multi-tiered approach:
     * 1. AE 25.0+ TextStyle.justification API ("alignLeft", "alignCenter", "alignRight", "justifyFull")
     * 2. Point Text geometric ratio: ratio = -2 * r.left / r.width (< 0.5: left, 0.5..1.5: center, >= 1.5: right)
     * 3. Paragraph (Box) Text box boundaries comparison
     */
    function buildDynamicAlignmentAnchorExpression(yMode, is3D) {
        var zPart = is3D ? ", (value.length > 2 ? value[2] : 0)" : "";
        var exprY = (yMode === "center") ? "r.top + r.height / 2" : (yMode === "bottom" ? "r.top + r.height" : "r.top");
        return "// AE Advanced Text Wrap (Dynamic Alignment Anchor)\n" +
               "var r = sourceRectAtTime(time, false);\n" +
               "var align = \"left\";\n" +
               "var detected = false;\n" +
               "try {\n" +
               "    var st = thisLayer.text ? thisLayer.text.sourceText : thisLayer.sourceText;\n" +
               "    var sObj = (st && st.style) ? st.style : ((st && typeof st.getStyleAt === \"function\") ? st.getStyleAt(0) : null);\n" +
               "    if (sObj && sObj.justification !== undefined) {\n" +
               "        var j = String(sObj.justification).toLowerCase();\n" +
               "        if (j.indexOf(\"center\") !== -1 || j.indexOf(\"full\") !== -1) {\n" +
               "            align = \"center\";\n" +
               "            detected = true;\n" +
               "        } else if (j.indexOf(\"right\") !== -1) {\n" +
               "            align = \"right\";\n" +
               "            detected = true;\n" +
               "        } else if (j.indexOf(\"left\") !== -1) {\n" +
               "            align = \"left\";\n" +
               "            detected = true;\n" +
               "        }\n" +
               "    }\n" +
               "} catch (eStyle) {}\n" +
               "if (!detected && r.width > 0) {\n" +
               "    try {\n" +
               "        var st2 = thisLayer.text ? thisLayer.text.sourceText : thisLayer.sourceText;\n" +
               "        var isBox = false;\n" +
               "        var bw = 0;\n" +
               "        if (st2 && st2.isParagraphText !== undefined) isBox = Boolean(st2.isParagraphText);\n" +
               "        if (st2 && st2.boxTextSize && st2.boxTextSize[0]) {\n" +
               "            bw = st2.boxTextSize[0];\n" +
               "            isBox = true;\n" +
               "        }\n" +
               "        if (isBox && bw > 0) {\n" +
               "            var dL = Math.abs(r.left);\n" +
               "            var dC = Math.abs((r.left + r.width / 2) - bw / 2);\n" +
               "            var dR = Math.abs((r.left + r.width) - bw);\n" +
               "            if (dC < dL && dC < dR) align = \"center\";\n" +
               "            else if (dR < dL && dR < dC) align = \"right\";\n" +
               "            else align = \"left\";\n" +
               "        } else {\n" +
               "            var ratio = -2 * r.left / r.width;\n" +
               "            if (ratio >= 0.5 && ratio < 1.5) align = \"center\";\n" +
               "            else if (ratio >= 1.5) align = \"right\";\n" +
               "            else align = \"left\";\n" +
               "        }\n" +
               "    } catch (eGeo) {\n" +
               "        var ratio2 = -2 * r.left / r.width;\n" +
               "        if (ratio2 >= 0.5 && ratio2 < 1.5) align = \"center\";\n" +
               "        else if (ratio2 >= 1.5) align = \"right\";\n" +
               "        else align = \"left\";\n" +
               "    }\n" +
               "}\n" +
               "var targetX = r.left;\n" +
               "if (align === \"center\") {\n" +
               "    targetX = r.left + r.width / 2;\n" +
               "} else if (align === \"right\") {\n" +
               "    targetX = r.left + r.width;\n" +
               "}\n" +
               "var targetY = " + exprY + ";\n" +
               "[targetX, targetY" + zPart + "];";
    }

    /**
     * Computes the visual reference point for position matching
     */
    function computeReferencePoint(bounds, matchRefMode, justification) {
        if (!bounds) return [0, 0];
        var rx = bounds.left + bounds.width / 2;
        var ry = bounds.top + bounds.height / 2;

        if (matchRefMode === "justification") {
            if (justification === "left") {
                rx = bounds.left;
            } else if (justification === "right") {
                rx = bounds.left + bounds.width;
            } else {
                rx = bounds.left + bounds.width / 2;
            }
            ry = bounds.top + bounds.height / 2;
        } else if (matchRefMode === "center") {
            rx = bounds.left + bounds.width / 2;
            ry = bounds.top + bounds.height / 2;
        } else if (matchRefMode === "top") {
            if (justification === "left") {
                rx = bounds.left;
            } else if (justification === "right") {
                rx = bounds.left + bounds.width;
            } else {
                rx = bounds.left + bounds.width / 2;
            }
            ry = bounds.top;
        }
        return [rx, ry];
    }

    /**
     * Generates scale and rotation safe Position expression matching dynamic anchor shift
     * and visual position matching
     */
    function buildDynamicAlignmentPositionExpression(yMode, is3D, baseA, matchOriginalPos, matchRefMode, wrapRefOffset) {
        var baseAx = (baseA && typeof baseA[0] === "number") ? baseA[0] : 0;
        var baseAy = (baseA && typeof baseA[1] === "number") ? baseA[1] : 0;
        var baseAz = (baseA && typeof baseA[2] === "number") ? baseA[2] : 0;
        var exprY = (yMode === "center") ? "r.top + r.height / 2" : (yMode === "bottom" ? "r.top + r.height" : "r.top");

        var offX = (wrapRefOffset && typeof wrapRefOffset[0] === "number") ? wrapRefOffset[0] : 0;
        var offY = (wrapRefOffset && typeof wrapRefOffset[1] === "number") ? wrapRefOffset[1] : 0;

        var banner = "// AE Advanced Text Wrap (Dynamic Alignment Position Compensator)\n";
        var boundsBlock = "var r = sourceRectAtTime(time, false);\n" +
                          "var align = \"left\";\n" +
                          "var detected = false;\n" +
                          "try {\n" +
                          "    var st = thisLayer.text ? thisLayer.text.sourceText : thisLayer.sourceText;\n" +
                          "    var sObj = (st && st.style) ? st.style : ((st && typeof st.getStyleAt === \"function\") ? st.getStyleAt(0) : null);\n" +
                          "    if (sObj && sObj.justification !== undefined) {\n" +
                          "        var j = String(sObj.justification).toLowerCase();\n" +
                          "        if (j.indexOf(\"center\") !== -1 || j.indexOf(\"full\") !== -1) {\n" +
                          "            align = \"center\";\n" +
                          "            detected = true;\n" +
                          "        } else if (j.indexOf(\"right\") !== -1) {\n" +
                          "            align = \"right\";\n" +
                          "            detected = true;\n" +
                          "        } else if (j.indexOf(\"left\") !== -1) {\n" +
                          "            align = \"left\";\n" +
                          "            detected = true;\n" +
                          "        }\n" +
                          "    }\n" +
                          "} catch (eStyle) {}\n" +
                          "if (!detected && r.width > 0) {\n" +
                          "    try {\n" +
                          "        var st2 = thisLayer.text ? thisLayer.text.sourceText : thisLayer.sourceText;\n" +
                          "        var isBox = false;\n" +
                          "        var bw = 0;\n" +
                          "        if (st2 && st2.isParagraphText !== undefined) isBox = Boolean(st2.isParagraphText);\n" +
                          "        if (st2 && st2.boxTextSize && st2.boxTextSize[0]) {\n" +
                          "            bw = st2.boxTextSize[0];\n" +
                          "            isBox = true;\n" +
                          "        }\n" +
                          "        if (isBox && bw > 0) {\n" +
                          "            var dL = Math.abs(r.left);\n" +
                          "            var dC = Math.abs((r.left + r.width / 2) - bw / 2);\n" +
                          "            var dR = Math.abs((r.left + r.width) - bw);\n" +
                          "            if (dC < dL && dC < dR) align = \"center\";\n" +
                          "            else if (dR < dL && dR < dC) align = \"right\";\n" +
                          "            else align = \"left\";\n" +
                          "        } else {\n" +
                          "            var ratio = -2 * r.left / r.width;\n" +
                          "            if (ratio >= 0.5 && ratio < 1.5) align = \"center\";\n" +
                          "            else if (ratio >= 1.5) align = \"right\";\n" +
                          "            else align = \"left\";\n" +
                          "        }\n" +
                          "    } catch (eGeo) {\n" +
                          "        var ratio2 = -2 * r.left / r.width;\n" +
                          "        if (ratio2 >= 0.5 && ratio2 < 1.5) align = \"center\";\n" +
                          "        else if (ratio2 >= 1.5) align = \"right\";\n" +
                          "        else align = \"left\";\n" +
                          "    }\n" +
                          "}\n" +
                          "var targetX = r.left;\n" +
                          "if (align === \"center\") {\n" +
                          "    targetX = r.left + r.width / 2;\n" +
                          "} else if (align === \"right\") {\n" +
                          "    targetX = r.left + r.width;\n" +
                          "}\n" +
                          "var targetY = " + exprY + ";\n";

        var matchBlock = "";
        if (matchOriginalPos && (offX !== 0 || offY !== 0)) {
            matchBlock = "var offX = " + offX + ";\n" +
                         "var offY = " + offY + ";\n" +
                         "var dx = ((targetX - origA[0]) - offX) * s[0];\n" +
                         "var dy = ((targetY - origA[1]) - offY) * s[1];\n";
        } else {
            matchBlock = "var dx = (targetX - origA[0]) * s[0];\n" +
                         "var dy = (targetY - origA[1]) * s[1];\n";
        }

        if (is3D) {
            return banner +
                boundsBlock +
                "var s = [\n" +
                "    transform.scale[0] / 100,\n" +
                "    transform.scale[1] / 100,\n" +
                "    (transform.scale.length > 2 ? transform.scale[2] : 100) / 100\n" +
                "];\n" +
                "var origA = [" + baseAx + ", " + baseAy + ", " + baseAz + "];\n" +
                matchBlock +
                "var dz = 0;\n" +
                "function rotX(vec, deg) {\n" +
                "    if (!deg) return vec;\n" +
                "    var rad = deg * (Math.PI / 180), c = Math.cos(rad), sn = Math.sin(rad);\n" +
                "    return [vec[0], vec[1] * c - vec[2] * sn, vec[1] * sn + vec[2] * c];\n" +
                "}\n" +
                "function rotY(vec, deg) {\n" +
                "    if (!deg) return vec;\n" +
                "    var rad = deg * (Math.PI / 180), c = Math.cos(rad), sn = Math.sin(rad);\n" +
                "    return [vec[0] * c + vec[2] * sn, vec[1], -vec[0] * sn + vec[2] * c];\n" +
                "}\n" +
                "function rotZ(vec, deg) {\n" +
                "    if (!deg) return vec;\n" +
                "    var rad = deg * (Math.PI / 180), c = Math.cos(rad), sn = Math.sin(rad);\n" +
                "    return [vec[0] * c - vec[1] * sn, vec[0] * sn + vec[1] * c, vec[2]];\n" +
                "}\n" +
                "var v = [dx, dy, dz];\n" +
                "try {\n" +
                "    var xr = transform.xRotation ? (transform.xRotation.value || transform.xRotation) : 0;\n" +
                "    var yr = transform.yRotation ? (transform.yRotation.value || transform.yRotation) : 0;\n" +
                "    var zr = transform.zRotation ? (transform.zRotation.value || transform.zRotation) : (transform.rotation ? (transform.rotation.value || transform.rotation) : 0);\n" +
                "    if (zr) v = rotZ(v, zr);\n" +
                "    if (yr) v = rotY(v, yr);\n" +
                "    if (xr) v = rotX(v, xr);\n" +
                "} catch (eR) {}\n" +
                "try {\n" +
                "    var o = transform.orientation;\n" +
                "    if (o) {\n" +
                "        if (o[2]) v = rotZ(v, o[2]);\n" +
                "        if (o[1]) v = rotY(v, o[1]);\n" +
                "        if (o[0]) v = rotX(v, o[0]);\n" +
                "    }\n" +
                "} catch (eO) {}\n" +
                "[value[0] + v[0], value[1] + v[1], (value.length > 2 ? value[2] : 0) + v[2]];";
        }

        return banner +
            boundsBlock +
            "var s = [transform.scale[0] / 100, transform.scale[1] / 100];\n" +
            "var origA = [" + baseAx + ", " + baseAy + "];\n" +
            matchBlock +
            "var rot = transform.rotation;\n" +
            "if (rot && Math.abs(rot) > 0.0001) {\n" +
            "    var rad = rot * (Math.PI / 180);\n" +
            "    var rx = dx * Math.cos(rad) - dy * Math.sin(rad);\n" +
            "    var ry = dx * Math.sin(rad) + dy * Math.cos(rad);\n" +
            "    [value[0] + rx, value[1] + ry];\n" +
            "} else {\n" +
            "    [value[0] + dx, value[1] + dy];\n" +
            "}";
    }

    /**
     * Aligns the layer Anchor Point according to text justification
     * Mode: 'once' (zero-shift baked position) or 'expression' (live reactive expression)
     */
    function alignTextLayerAnchor(textLayer, alignMode, verticalAlign, baseAnchor, matchOriginalPos, matchRefMode, wrapRefOffset) {
        if (!textLayer) return false;
        var comp = textLayer.containingComp;
        var curTime = comp ? comp.time : 0;
        var is3D = Boolean(textLayer.threeDLayer);

        var transform = textLayer.property("Transform");
        if (!transform) return false;

        var apProp = transform.property("Anchor Point");
        var posProp = transform.property("Position");
        var scaleProp = transform.property("Scale");
        if (!apProp || !posProp) return false;

        var curA = apProp.value;
        var curPos = posProp.value;
        var curScale = scaleProp ? scaleProp.value : [100, 100, 100];

        var yMode = verticalAlign || "top";

        if (alignMode === "expression") {
            var baseA = baseAnchor || curA;
            var aExpr = buildDynamicAlignmentAnchorExpression(yMode, is3D);
            var pExpr = buildDynamicAlignmentPositionExpression(yMode, is3D, baseA, matchOriginalPos, matchRefMode, wrapRefOffset);

            if (posProp.dimensionsSeparated) {
                try { posProp.dimensionsSeparated = false; } catch (eDim) {}
            }
            apProp.expression = aExpr;
            posProp.expression = pExpr;
            return true;
        } else {
            // One-Time Static Bake Mode
            var xMode = detectLayerJustification(textLayer);
            var bounds = getLayerSourceRectBounds(textLayer, curTime);
            var targetA = computeTargetAnchor(bounds, xMode, yMode);

            var sx = (curScale[0] || 100) / 100;
            var sy = (curScale[1] || 100) / 100;
            var sz = is3D ? ((curScale.length > 2 ? curScale[2] : 100) / 100) : 1;

            var deltaAx = targetA[0] - curA[0];
            var deltaAy = targetA[1] - curA[1];
            var deltaAz = 0;

            var sdx = deltaAx * sx;
            var sdy = deltaAy * sy;
            var sdz = deltaAz * sz;

            var pDelta = applyTransformRotation([sdx, sdy, sdz], textLayer, is3D);

            try { apProp.expression = ""; } catch (eAE) {}
            try { posProp.expression = ""; } catch (ePE) {}

            if (is3D) {
                apProp.setValue([targetA[0], targetA[1], (curA.length > 2 ? curA[2] : 0)]);
            } else {
                apProp.setValue([targetA[0], targetA[1]]);
            }

            if (posProp.dimensionsSeparated) {
                var xP = transform.property("X Position");
                var yP = transform.property("Y Position");
                var zP = is3D ? transform.property("Z Position") : null;
                if (xP) xP.setValue(xP.value + pDelta[0]);
                if (yP) yP.setValue(yP.value + pDelta[1]);
                if (zP) zP.setValue(zP.value + pDelta[2]);
            } else {
                if (is3D) {
                    posProp.setValue([curPos[0] + pDelta[0], curPos[1] + pDelta[1], (curPos.length > 2 ? curPos[2] : 0) + pDelta[2]]);
                } else {
                    posProp.setValue([curPos[0] + pDelta[0], curPos[1] + pDelta[1]]);
                }
            }
            return true;
        }
    }

    /**
     * Compensates layer Position so the wrapped text visually matches the original text position
     */
    function matchWrappedPosition(textLayer, origBounds, matchRefMode, baseAnchor, basePos, is3D) {
        if (!textLayer || !origBounds) return false;
        var transform = textLayer.property("Transform");
        if (!transform) return false;

        var posProp = transform.property("Position");
        var apProp = transform.property("Anchor Point");
        var scaleProp = transform.property("Scale");
        if (!posProp || !apProp) return false;

        var comp = textLayer.containingComp;
        var curTime = comp ? comp.time : 0;
        var curBounds = getLayerSourceRectBounds(textLayer, curTime);
        var just = detectLayerJustification(textLayer);

        var rOrig = computeReferencePoint(origBounds, matchRefMode, just);
        var rNew = computeReferencePoint(curBounds, matchRefMode, just);

        var curA = apProp.value;
        var baseA = baseAnchor || curA;
        var baseP = basePos || posProp.value;
        var curScale = scaleProp ? scaleProp.value : [100, 100, 100];

        var sx = (curScale[0] || 100) / 100;
        var sy = (curScale[1] || 100) / 100;
        var sz = is3D ? ((curScale.length > 2 ? curScale[2] : 100) / 100) : 1;

        var deltaLocalX = (curA[0] - baseA[0]) - (rNew[0] - rOrig[0]);
        var deltaLocalY = (curA[1] - baseA[1]) - (rNew[1] - rOrig[1]);
        var deltaLocalZ = 0;

        var pComp = applyTransformRotation([deltaLocalX * sx, deltaLocalY * sy, deltaLocalZ * sz], textLayer, is3D);

        var targetPosX = baseP[0] + pComp[0];
        var targetPosY = baseP[1] + pComp[1];
        var targetPosZ = (baseP.length > 2 ? baseP[2] : 0) + pComp[2];

        try { posProp.expression = ""; } catch (ePE) {}

        if (posProp.dimensionsSeparated) {
            var xP = transform.property("X Position");
            var yP = transform.property("Y Position");
            var zP = is3D ? transform.property("Z Position") : null;
            if (xP) xP.setValue(targetPosX);
            if (yP) yP.setValue(targetPosY);
            if (zP) zP.setValue(targetPosZ);
        } else {
            if (is3D) {
                posProp.setValue([targetPosX, targetPosY, targetPosZ]);
            } else {
                posProp.setValue([targetPosX, targetPosY]);
            }
        }
        return true;
    }

    // -------------------------------------------------------------------------
    // 9. Main Text Wrapping Orchestration
    // -------------------------------------------------------------------------

    function executeTextWrap(comp, textLayer, options) {
        if (!comp || !textLayer) return false;

        var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
        var docProp = textProp ? (textProp.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
        if (!docProp) return false;

        var doc = docProp.value;
        var transform = textLayer.property("Transform");
        var apProp = transform ? transform.property("Anchor Point") : null;
        var posProp = transform ? transform.property("Position") : null;
        var is3D = Boolean(textLayer.threeDLayer);

        // 1. Retrieve or capture pristine original state
        var existingState = readOriginalState(textLayer);
        var rawTextToWrap = "";
        var isBox = false;
        var origBoxSize = null;
        var origBoxPos = null;
        var baseAnchor = null;
        var basePos = null;
        var origBounds = null;

        if (existingState && existingState.text) {
            // Re-wrapping from previously wrapped layer: Use pristine original state!
            rawTextToWrap = existingState.text;
            isBox = Boolean(existingState.isBox);
            origBoxSize = existingState.boxSize;
            origBoxPos = existingState.boxPos;
            baseAnchor = existingState.anchorPoint;
            basePos = existingState.position;
            if (existingState.bounds && existingState.bounds.length >= 4) {
                origBounds = {
                    left: existingState.bounds[0],
                    top: existingState.bounds[1],
                    width: existingState.bounds[2],
                    height: existingState.bounds[3]
                };
            } else {
                origBounds = getLayerSourceRectBounds(textLayer, comp.time);
            }
        } else {
            // First time wrapping: snapshot pristine original state from layer!
            rawTextToWrap = getTextLayerString(textLayer);
            if (!rawTextToWrap || trimString(rawTextToWrap).length === 0) return false;

            isBox = Boolean(doc && doc.boxText === true);
            origBoxSize = (doc && doc.boxTextSize) ? [doc.boxTextSize[0], doc.boxTextSize[1]] : null;
            origBoxPos = (doc && doc.boxTextPos) ? [doc.boxTextPos[0], doc.boxTextPos[1]] : null;
            baseAnchor = apProp ? [apProp.value[0], apProp.value[1], (apProp.value.length > 2 ? apProp.value[2] : 0)] : [0, 0, 0];
            basePos = posProp ? [posProp.value[0], posProp.value[1], (posProp.value.length > 2 ? posProp.value[2] : 0)] : [0, 0, 0];
            var origAnchorExpr = apProp ? (apProp.expression || "") : "";
            var origPosExpr = posProp ? (posProp.expression || "") : "";
            origBounds = getLayerSourceRectBounds(textLayer, comp.time);

            storeOriginalState(textLayer, rawTextToWrap, isBox, origBoxSize, origBoxPos, basePos, baseAnchor, origAnchorExpr, origPosExpr, origBounds);
        }

        // 2. Initialize accurate measurement engine
        var measurer = createTextMeasurer(comp, textLayer, doc);
        var spaceW = measurer.measureAdvance(" ");
        var maxW = options.maxWidth || 600;
        var desiredW = options.desiredWidth || Math.max(50, maxW - 100);
        if (desiredW >= maxW) desiredW = Math.max(50, maxW - 20);

        try {
            var removeBreaks = (options.removeExistingBreaks !== undefined) ? Boolean(options.removeExistingBreaks) : true;
            var textToWrap = rawTextToWrap;
            if (removeBreaks) {
                textToWrap = stripExistingLineBreaks(textToWrap);
            }

            // 3. Apply semantic & micro-typographic bindings (prepositions, numbers, widows)
            var preprocessed = applySemanticBindings(textToWrap, options.language, {
                bindNumbers: options.bindNumbers,
                bindHonorifics: options.bindHonorifics,
                avoidDanglingShort: options.avoidDanglingShort,
                preventWidows: options.preventWidows
            });

            // 4. Split by manual line breaks / paragraphs (preserving intentional breaks if not stripped)
            var rawParagraphs = preprocessed.split(/\r\n|\r|\n/);
            var finalWrappedLines = [];

            for (var p = 0; p < rawParagraphs.length; p++) {
                var pText = trimString(rawParagraphs[p]);
                if (pText.length === 0) {
                    finalWrappedLines.push("");
                    continue;
                }

                var paraLines = [];
                switch (options.method) {
                    case "balanced":
                        paraLines = wrapBalanced(pText, maxW, desiredW, options.language, options.useHyphen, options.minWordLen, measurer, spaceW);
                        break;
                    case "pyramid":
                        paraLines = wrapOpticalPyramid(pText, maxW, desiredW, options.language, options.useHyphen, options.minWordLen, measurer, spaceW);
                        break;
                    case "reverse_pyramid":
                        paraLines = wrapReversePyramid(pText, maxW, desiredW, options.language, options.useHyphen, options.minWordLen, measurer, spaceW);
                        break;
                    case "compact":
                        paraLines = wrapCompactBlock(pText, maxW, desiredW, options.language, options.useHyphen, options.minWordLen, measurer, spaceW);
                        break;
                    case "greedy":
                    default:
                        paraLines = wrapGreedy(pText, maxW, desiredW, options.language, options.useHyphen, options.minWordLen, measurer, spaceW);
                        break;
                }

                for (var l = 0; l < paraLines.length; l++) {
                    finalWrappedLines.push(paraLines[l]);
                }
            }

            // 5. Join lines with After Effects native line break (\r)
            var wrappedFullText = finalWrappedLines.join("\r");

            // 6. Commit text update to layer TextDocument
            if (doc) {
                doc.text = wrappedFullText;
                if (isBox) {
                    // Update box text width constraint to match maxW
                    try {
                        var lineCount = Math.max(1, finalWrappedLines.length);
                        var effectiveLeading = (doc.leading && doc.leading > 0) ? doc.leading : (doc.fontSize * 1.25);
                        var calculatedHeight = Math.max(origBoxSize ? origBoxSize[1] : 200, (lineCount + 1) * effectiveLeading);
                        doc.boxTextSize = [maxW, calculatedHeight];
                    } catch (eBS) {}
                }
                docProp.setValue(doc);
            } else {
                docProp.setValue(wrappedFullText);
            }

            // 7. Auto-align Anchor Point if enabled
            var just = detectLayerJustification(textLayer);
            var rOrig = computeReferencePoint(origBounds, options.matchRefMode, just);
            var curBounds = getLayerSourceRectBounds(textLayer, comp.time);
            var rNew = computeReferencePoint(curBounds, options.matchRefMode, just);
            var wrapRefOffset = [rNew[0] - rOrig[0], rNew[1] - rOrig[1]];

            if (options.autoAlignAnchor) {
                alignTextLayerAnchor(textLayer, options.alignMode, options.verticalAlign, baseAnchor, options.matchOriginalPosition, options.matchRefMode, wrapRefOffset);
            }

            // 8. Visually match original text position if enabled (default ON)
            if (options.matchOriginalPosition && options.alignMode !== "expression") {
                matchWrappedPosition(textLayer, origBounds, options.matchRefMode, baseAnchor, basePos, is3D);
            }

            // 9. Update effect status slider
            var fxParade = textLayer.property("ADBE Effect Parade") || textLayer.property("Effects");
            if (fxParade) {
                var eff = fxParade.property(EFFECT_NAME);
                if (eff) {
                    var slider = eff.property("ADBE Slider Control-0001") || eff.property(1);
                    if (slider) slider.setValue(maxW);
                }
            }

            return true;
        } finally {
            measurer.cleanup();
        }
    }

    // -------------------------------------------------------------------------
    // 10. ScriptUI Panel & User Interface
    // -------------------------------------------------------------------------

    function buildUI(thisObj) {
        var isDockable = (typeof Panel !== "undefined" && thisObj instanceof Panel);
        var WinClass = (typeof Window !== "undefined") ? Window : (globalObj.Window || null);
        var win = isDockable ? thisObj : (WinClass ? new WinClass("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true }) : null);
        if (!win) return null;

        if (win instanceof Window) {
            win.text = SCRIPT_TITLE + " " + SCRIPT_VERSION;
            win.preferredSize = [280, 360];
            win.minimumSize = [220, 280];
            win.maximumSize = [600, 900];
        } else {
            win.preferredSize = [260, -1];
            win.minimumSize = [200, -1];
        }

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
        pnlHeader.alignment = ["fill", "top"];

        var lblSub = pnlHeader.add("statictext", undefined, "Balanced paragraph typography & hyphenation");
        lblSub.alignment = ["fill", "center"];
        try {
            lblSub.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 1.0, 1.0], 1);
        } catch (eG) {}

        // --- Target Layer Detection Panel ---
        var pnlTarget = win.add("panel", undefined, "Selected Text Layer");
        pnlTarget.orientation = "row";
        pnlTarget.alignChildren = ["fill", "center"];
        pnlTarget.spacing = 6;
        pnlTarget.margins = [6, 4, 6, 4];
        pnlTarget.alignment = ["fill", "top"];

        var lblTargetStatus = pnlTarget.add("statictext", undefined, "Scanning for text layer...", { truncate: "middle" });
        lblTargetStatus.alignment = ["fill", "center"];
        lblTargetStatus.preferredSize = [150, 20];
        lblTargetStatus.minimumSize = [60, 20];

        var btnRefresh = pnlTarget.add("button", undefined, "Refresh");
        btnRefresh.preferredSize = [55, 22];

        // =====================================================================
        // TABBED NAVIGATION PANEL (Saves ~50% vertical space)
        // =====================================================================
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.alignment = ["fill", "fill"];
        tpanel.spacing = 4;
        tpanel.margins = 0;

        // ---------------------------------------------------------------------
        // TAB 1: Wrap & Width
        // ---------------------------------------------------------------------
        var tabWrap = tpanel.add("tab", undefined, "Wrap & Width");
        tabWrap.orientation = "column";
        tabWrap.alignChildren = ["fill", "top"];
        tabWrap.spacing = 5;
        tabWrap.margins = [6, 6, 6, 6];

        // --- Width Constraints Panel ---
        var pnlWidth = tabWrap.add("panel", undefined, "Width Constraints (px)");
        pnlWidth.orientation = "column";
        pnlWidth.alignChildren = ["fill", "top"];
        pnlWidth.spacing = 4;
        pnlWidth.margins = [6, 5, 6, 5];
        pnlWidth.alignment = ["fill", "top"];

        // 1. Max Text Width Constraint (Ceiling)
        var grpMaxWidthRow = pnlWidth.add("group");
        grpMaxWidthRow.orientation = "row";
        grpMaxWidthRow.alignChildren = ["fill", "center"];
        grpMaxWidthRow.spacing = 6;
        grpMaxWidthRow.alignment = ["fill", "top"];

        var lblMaxWidth = grpMaxWidthRow.add("statictext", undefined, "Max Width:");
        lblMaxWidth.preferredSize = [65, -1];
        lblMaxWidth.minimumSize = [50, -1];
        lblMaxWidth.helpTip = "Max Width (Ceiling): Absolute physical boundary in pixels.";

        var sldMaxWidth = grpMaxWidthRow.add("slider", undefined, 600, 100, 1920);
        sldMaxWidth.alignment = ["fill", "center"];

        var txtMaxWidth = grpMaxWidthRow.add("edittext", undefined, "600");
        txtMaxWidth.preferredSize = [42, 20];

        var lblPx1 = grpMaxWidthRow.add("statictext", undefined, "px");
        lblPx1.preferredSize = [16, -1];

        // 2. Desired Approx Width (Target - Always strictly smaller than Max Width)
        var grpDesiredWidthRow = pnlWidth.add("group");
        grpDesiredWidthRow.orientation = "row";
        grpDesiredWidthRow.alignChildren = ["fill", "center"];
        grpDesiredWidthRow.spacing = 6;
        grpDesiredWidthRow.alignment = ["fill", "top"];

        var lblDesiredWidth = grpDesiredWidthRow.add("statictext", undefined, "Desired:");
        lblDesiredWidth.preferredSize = [65, -1];
        lblDesiredWidth.minimumSize = [50, -1];
        lblDesiredWidth.helpTip = "Desired Approx Width: Target visual width (always < Max Width).";

        var sldDesiredWidth = grpDesiredWidthRow.add("slider", undefined, 500, 60, 1900);
        sldDesiredWidth.alignment = ["fill", "center"];

        var txtDesiredWidth = grpDesiredWidthRow.add("edittext", undefined, "500");
        txtDesiredWidth.preferredSize = [42, 20];

        var lblPx2 = grpDesiredWidthRow.add("statictext", undefined, "px");
        lblPx2.preferredSize = [16, -1];

        // Two-way synchronization enforcing: desired approx width is ALWAYS strictly smaller than max width
        function syncWidthConstraints(source) {
            var maxV = Math.round(sldMaxWidth.value);
            var desV = Math.round(sldDesiredWidth.value);

            if (desV >= maxV) {
                desV = Math.max(50, maxV - 20);
                sldDesiredWidth.value = desV;
            }

            txtMaxWidth.text = String(maxV);
            txtDesiredWidth.text = String(desV);
        }

        sldMaxWidth.onChanging = function () {
            var maxV = Math.round(sldMaxWidth.value);
            txtMaxWidth.text = String(maxV);
            var desV = Math.round(sldDesiredWidth.value);
            if (desV >= maxV) {
                desV = Math.max(50, maxV - 20);
                sldDesiredWidth.value = desV;
                txtDesiredWidth.text = String(desV);
            }
        };
        sldMaxWidth.onChange = function () {
            syncWidthConstraints("max");
        };
        txtMaxWidth.onChange = function () {
            var val = parseInt(txtMaxWidth.text, 10);
            if (!isNaN(val)) {
                val = Math.max(100, Math.min(1920, val));
                sldMaxWidth.value = val;
                syncWidthConstraints("max");
            }
        };

        sldDesiredWidth.onChanging = function () {
            var maxV = Math.round(sldMaxWidth.value);
            var desV = Math.round(sldDesiredWidth.value);
            if (desV >= maxV) {
                desV = Math.max(50, maxV - 20);
                sldDesiredWidth.value = desV;
            }
            txtDesiredWidth.text = String(desV);
        };
        sldDesiredWidth.onChange = function () {
            syncWidthConstraints("desired");
        };
        txtDesiredWidth.onChange = function () {
            var val = parseInt(txtDesiredWidth.text, 10);
            if (!isNaN(val)) {
                var maxV = Math.round(sldMaxWidth.value);
                val = Math.max(50, Math.min(maxV - 20, val));
                sldDesiredWidth.value = val;
                txtDesiredWidth.text = String(val);
            }
        };

        // --- Wrap Method & Language Panel ---
        var pnlMethod = tabWrap.add("panel", undefined, "Method & Formatting");
        pnlMethod.orientation = "column";
        pnlMethod.alignChildren = ["fill", "top"];
        pnlMethod.spacing = 4;
        pnlMethod.margins = [6, 5, 6, 5];
        pnlMethod.alignment = ["fill", "top"];

        var grpMethodRow = pnlMethod.add("group");
        grpMethodRow.orientation = "row";
        grpMethodRow.alignChildren = ["left", "center"];
        grpMethodRow.spacing = 6;
        grpMethodRow.alignment = ["fill", "top"];
        var lblM = grpMethodRow.add("statictext", undefined, "Method:");
        lblM.preferredSize = [65, -1];
        lblM.minimumSize = [50, -1];

        var ddMethod = grpMethodRow.add("dropdownlist", undefined, [
            "1. Balanced (Knuth-Plass)",
            "2. Greedy Fit (Fast)",
            "3. Optical Pyramid (Cards)",
            "4. Reverse Pyramid (Headline)",
            "5. Compact Block (Density)"
        ]);
        ddMethod.selection = 0;
        ddMethod.alignment = ["fill", "center"];
        ddMethod.preferredSize = [140, 22];
        ddMethod.minimumSize = [100, 22];

        var grpLangRow = pnlMethod.add("group");
        grpLangRow.orientation = "row";
        grpLangRow.alignChildren = ["left", "center"];
        grpLangRow.spacing = 6;
        grpLangRow.alignment = ["fill", "top"];
        var lblL = grpLangRow.add("statictext", undefined, "Language:");
        lblL.preferredSize = [65, -1];
        lblL.minimumSize = [50, -1];

        var ddLanguage = grpLangRow.add("dropdownlist", undefined, [
            "English (US/UK)",
            "Spanish (Español)",
            "French (Français)",
            "German (Deutsch)",
            "Italian (Italiano)",
            "Universal (Latin)"
        ]);
        ddLanguage.selection = 0;
        ddLanguage.alignment = ["fill", "center"];
        ddLanguage.preferredSize = [140, 22];
        ddLanguage.minimumSize = [100, 22];

        var chkHyphen = pnlMethod.add("checkbox", undefined, "Enable Hyphenation (-)");
        chkHyphen.value = true;
        chkHyphen.helpTip = "Enables multilingual algorithmic syllabification and hyphenation.";

        var chkRemoveBreaks = pnlMethod.add("checkbox", undefined, "Remove Existing Line Breaks");
        chkRemoveBreaks.value = true;
        chkRemoveBreaks.helpTip = "Strips existing manual carriage returns (\\r, \\n) before wrapping into a clean paragraph.";

        // ---------------------------------------------------------------------
        // TAB 2: Typography
        // ---------------------------------------------------------------------
        var tabTypo = tpanel.add("tab", undefined, "Typography");
        tabTypo.orientation = "column";
        tabTypo.alignChildren = ["fill", "top"];
        tabTypo.spacing = 5;
        tabTypo.margins = [6, 6, 6, 6];

        var pnlMicro = tabTypo.add("panel", undefined, "Micro-Typography & Semantic Units");
        pnlMicro.orientation = "column";
        pnlMicro.alignChildren = ["fill", "top"];
        pnlMicro.spacing = 6;
        pnlMicro.margins = [8, 8, 8, 8];
        pnlMicro.alignment = ["fill", "top"];

        var chkWidows = pnlMicro.add("checkbox", undefined, "Prevent Widows & Orphans");
        chkWidows.value = true;
        chkWidows.helpTip = "Binds the last words together so single words never sit alone on a line.";

        var chkDangling = pnlMicro.add("checkbox", undefined, "Avoid Dangling Short Words (NBSP)");
        chkDangling.value = true;
        chkDangling.helpTip = "Binds short prepositions and articles (in, on, of, the) to the next word with non-breaking space.";

        var chkNumbers = pnlMicro.add("checkbox", undefined, "Keep Numbers & Units Bound");
        chkNumbers.value = true;
        chkNumbers.helpTip = "Binds numbers to their following unit or symbol (e.g. 100 px, 50 %).";

        var chkHonorifics = pnlMicro.add("checkbox", undefined, "Keep Honorifics & Titles Bound");
        chkHonorifics.value = true;
        chkHonorifics.helpTip = "Binds titles and abbreviations (e.g. Dr. Smith, Mr. Jones).";

        // ---------------------------------------------------------------------
        // TAB 3: Anchor & Align
        // ---------------------------------------------------------------------
        var tabAlign = tpanel.add("tab", undefined, "Anchor & Align");
        tabAlign.orientation = "column";
        tabAlign.alignChildren = ["fill", "top"];
        tabAlign.spacing = 5;
        tabAlign.margins = [6, 6, 6, 6];

        var pnlAlignment = tabAlign.add("panel", undefined, "Position & Anchor Alignment");
        pnlAlignment.orientation = "column";
        pnlAlignment.alignChildren = ["fill", "top"];
        pnlAlignment.spacing = 5;
        pnlAlignment.margins = [6, 5, 6, 5];
        pnlAlignment.alignment = ["fill", "top"];

        // 1. Visually Match Original Text Position (Default: ON)
        var chkMatchPos = pnlAlignment.add("checkbox", undefined, "Visually Match Original Position");
        chkMatchPos.value = true;
        chkMatchPos.helpTip = "Keeps the wrapped text visually pinned to the original text's location on the composition.";

        var grpMatchRef = pnlAlignment.add("group");
        grpMatchRef.orientation = "row";
        grpMatchRef.alignChildren = ["left", "center"];
        grpMatchRef.spacing = 4;
        grpMatchRef.margins = [14, 0, 0, 0];
        grpMatchRef.alignment = ["fill", "top"];
        var lblMatchRef = grpMatchRef.add("statictext", undefined, "Ref Mode:");
        lblMatchRef.preferredSize = [65, -1];
        lblMatchRef.minimumSize = [50, -1];
        lblMatchRef.helpTip = "Reference origin used when repositioning the wrapped paragraph.";

        var ddMatchRef = grpMatchRef.add("dropdownlist", undefined, [
            "By Justification (Natural)",
            "Visual Center (Symmetric)",
            "Top Edge (First Line Fixed)"
        ]);
        ddMatchRef.selection = 0;
        ddMatchRef.preferredSize = [140, 22];
        ddMatchRef.minimumSize = [100, 22];
        ddMatchRef.alignment = ["fill", "center"];

        chkMatchPos.onClick = function () {
            ddMatchRef.enabled = chkMatchPos.value;
        };

        // 2. Anchor Point Auto-Alignment (AE-Align-AnchorPoint)
        var chkAutoAlign = pnlAlignment.add("checkbox", undefined, "Auto-Align Anchor Point");
        chkAutoAlign.value = true;
        chkAutoAlign.helpTip = "Automatically repositions layer anchor point based on paragraph alignment (left, center, right).";

        var grpAlignMode = pnlAlignment.add("group");
        grpAlignMode.orientation = "column";
        grpAlignMode.alignChildren = ["left", "top"];
        grpAlignMode.spacing = 3;
        grpAlignMode.margins = [14, 0, 0, 0];
        grpAlignMode.alignment = ["fill", "top"];

        var rbAlignOnce = grpAlignMode.add("radiobutton", undefined, "Apply Once (Baked Position)");
        var rbAlignExpr = grpAlignMode.add("radiobutton", undefined, "Live Expression (Dynamic)");
        rbAlignOnce.value = true;
        rbAlignOnce.helpTip = "Computes and sets the anchor point and position values statically once.";
        rbAlignExpr.helpTip = "Applies an expression so the anchor point dynamically updates if text alignment changes.";

        var grpAlignVert = pnlAlignment.add("group");
        grpAlignVert.orientation = "row";
        grpAlignVert.alignChildren = ["left", "center"];
        grpAlignVert.spacing = 4;
        grpAlignVert.margins = [14, 0, 0, 0];
        grpAlignVert.alignment = ["fill", "top"];
        var lblVertAlign = grpAlignVert.add("statictext", undefined, "Vertical:");
        lblVertAlign.preferredSize = [65, -1];
        lblVertAlign.minimumSize = [50, -1];
        lblVertAlign.helpTip = "Vertical anchor point placement.";

        var ddVertAlign = grpAlignVert.add("dropdownlist", undefined, [
            "Top (Standard)",
            "Center (Middle)",
            "Bottom"
        ]);
        ddVertAlign.selection = 0;
        ddVertAlign.preferredSize = [140, 22];
        ddVertAlign.minimumSize = [100, 22];
        ddVertAlign.alignment = ["fill", "center"];

        chkAutoAlign.onClick = function () {
            var en = chkAutoAlign.value;
            rbAlignOnce.enabled = en;
            rbAlignExpr.enabled = en;
            ddVertAlign.enabled = en;
        };

        // Set initial tab selection
        tpanel.selection = tabWrap;

        // --- Secondary Action Buttons ---
        var grpSubBtns = win.add("group");
        grpSubBtns.orientation = "row";
        grpSubBtns.alignChildren = ["fill", "center"];
        grpSubBtns.alignment = ["fill", "top"];
        grpSubBtns.spacing = 6;

        var btnRestore = grpSubBtns.add("button", undefined, "↺ Restore Original");
        var btnDemo    = grpSubBtns.add("button", undefined, "📝 Create Demo");
        btnRestore.preferredSize = [-1, 26];
        btnDemo.preferredSize    = [-1, 26];
        btnRestore.alignment = ["fill", "center"];
        btnDemo.alignment    = ["fill", "center"];
        btnRestore.helpTip = "Restores the original unwrapped text, box dimensions, position, and removes script-generated expressions.";
        btnDemo.helpTip = "Creates a sample paragraph in the active composition for instant testing.";

        // --- Primary Action Button ---
        var btnExecute = win.add("button", undefined, "✨ Wrap Paragraph");
        btnExecute.alignment = ["fill", "center"];
        btnExecute.preferredSize = [-1, 32];
        btnExecute.helpTip = "Analyzes, hyphenates, and wraps the selected text layer with optical micro-typography.";

        // ---------------------------------------------------------------------
        // Event Listeners & UI Logic
        // ---------------------------------------------------------------------

        function updateTargetStatus() {
            var comp = getActiveComposition();
            if (!comp) {
                lblTargetStatus.text = "No active composition found.";
                lblTargetStatus.helpTip = lblTargetStatus.text;
                return null;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                lblTargetStatus.text = "Select a Point or Box Text layer.";
                lblTargetStatus.helpTip = lblTargetStatus.text;
                return null;
            }
            var doc = getTextDocument(textLayer);
            var isBox = Boolean(doc && doc.boxText);
            var typeStr = isBox ? "Box Text" : "Point Text";
            var rawName = textLayer.name || "Text Layer";
            var shortName = rawName;
            if (shortName.length > 20) {
                shortName = shortName.substring(0, 18) + "...";
            }
            lblTargetStatus.text = shortName + " (" + typeStr + ")";
            lblTargetStatus.helpTip = rawName + " (" + typeStr + ")";
            return textLayer;
        }

        btnRefresh.onClick = function () {
            updateTargetStatus();
        };

        btnDemo.onClick = function () {
            var comp = getActiveComposition();
            if (!comp) {
                alert("Please open or select a composition first.");
                return;
            }
            var demoStr = "Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. In motion graphics and digital video, balanced text wrapping prevents awkward orphans, avoids dangling prepositions like in or on, and binds 1920 x 1080 resolution figures together with 100 % visual harmony. With advanced paragraph composition, every single line feels intentional, pleasing, and perfectly weighted.";

            var demoLayer = comp.layers.addText(demoStr);
            demoLayer.name = "Demo Paragraph Text";
            if (demoLayer.transform && demoLayer.transform.position) {
                demoLayer.transform.position.setValue([Math.round(comp.width / 2), Math.round(comp.height / 3), 0]);
            }
            try {
                var doc = getTextDocument(demoLayer);
                if (doc) {
                    doc.fontSize = 38;
                    doc.fillColor = [1, 1, 1];
                    if (typeof ParagraphJustification !== "undefined") {
                        doc.justification = ParagraphJustification.CENTER_JUSTIFY;
                    }
                    demoLayer.property("Source Text").setValue(doc);
                }
            } catch (eD) {}

            demoLayer.selected = true;
            updateTargetStatus();
        };

        btnRestore.onClick = function () {
            var comp = getActiveComposition();
            if (!comp) {
                lblTargetStatus.text = "No active composition.";
                return;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                lblTargetStatus.text = "Please select the wrapped text layer to restore.";
                return;
            }
            app.beginUndoGroup("Restore Original Text");
            try {
                var restored = restoreOriginalText(textLayer);
                if (restored) {
                    lblTargetStatus.text = "Restored original text, geometry & expressions.";
                    updateTargetStatus();
                } else {
                    lblTargetStatus.text = "No stored original text or JSX expressions found.";
                }
            } catch (err) {
                lblTargetStatus.text = "Restore error: " + err.toString();
            } finally {
                app.endUndoGroup();
            }
        };

        btnExecute.onClick = function () {
            var comp = getActiveComposition();
            if (!comp) {
                alert("Please open a composition first.");
                return;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                alert("Please select a text layer to wrap.");
                return;
            }

            var methodKeys = ["balanced", "greedy", "pyramid", "reverse_pyramid", "compact"];
            var langKeys = ["english", "spanish", "french", "german", "italian", "universal"];

            var matchRefIdx = (ddMatchRef.selection ? ddMatchRef.selection.index : 0);
            var matchRefMode = (matchRefIdx === 1) ? "center" : ((matchRefIdx === 2) ? "top" : "justification");

            var vertIdx = (ddVertAlign.selection ? ddVertAlign.selection.index : 0);
            var vAlign = (vertIdx === 1) ? "center" : ((vertIdx === 2) ? "bottom" : "top");

            var opts = {
                maxWidth: parseInt(txtMaxWidth.text, 10) || 600,
                desiredWidth: parseInt(txtDesiredWidth.text, 10) || 500,
                method: methodKeys[ddMethod.selection ? ddMethod.selection.index : 0] || "balanced",
                language: langKeys[ddLanguage.selection ? ddLanguage.selection.index : 0] || "english",
                useHyphen: chkHyphen.value,
                removeExistingBreaks: chkRemoveBreaks.value,
                minWordLen: 6,
                preventWidows: chkWidows.value,
                avoidDanglingShort: chkDangling.value,
                bindNumbers: chkNumbers.value,
                bindHonorifics: chkHonorifics.value,
                matchOriginalPosition: chkMatchPos.value,
                matchRefMode: matchRefMode,
                autoAlignAnchor: chkAutoAlign.value,
                alignMode: rbAlignExpr.value ? "expression" : "once",
                verticalAlign: vAlign
            };

            app.beginUndoGroup("AE Advanced Text Wrap");
            try {
                var success = executeTextWrap(comp, textLayer, opts);
                if (success) {
                    updateTargetStatus();
                } else {
                    alert("Could not wrap text layer. Please ensure the layer has text content.");
                }
            } catch (err) {
                alert("Text wrap error: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        // Initial detection
        updateTargetStatus();

        if (win.layout) {
            win.layout.layout(true);
        }
        win.onResizing = win.onResize = function () {
            if (this.layout) {
                this.layout.resize();
            }
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        }

        return win;
    }

    // -------------------------------------------------------------------------
    // 10. Execution Bootstrap
    // -------------------------------------------------------------------------
    buildUI(thisObj);

})(this);
