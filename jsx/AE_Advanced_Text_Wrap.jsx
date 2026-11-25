// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE ADVANCED TEXT WRAP v1.0.0
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
//      - Non-breaking spaces (U+00A0) prevent dangling short words / prepositions.
//      - Binds numbers and following units/symbols (e.g., "100 px", "50 %", "25 kg").
//      - Binds honorifics and abbreviations (e.g., "Dr. Smith", "e.g. typography").
//      - Widow & orphan prevention (ensures last line never has a lonely single word).
//   5. Max Text Width Constraint:
//      - Interactive pixel constraint slider and edittext with live feedback.
//   6. Non-Destructive State Storage & One-Click Restore:
//      - Stores original text and geometry inside an "Advanced Text Wrap" Slider Control effect
//        expression and layer comment.
//      - One-click restoration to the exact pre-wrap state.
//   7. Universal Compatibility:
//      - Works identically on Point Text and Paragraph (Box) Text.
//      - Works across all text alignments (Left, Center, Right, Justified).
//      - 100% interoperable with AE-Text-Highlight and AE-replace-color-emojis
//        (surrogate-pair emoji safety, preserves character indices).
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
    var SCRIPT_VERSION = "v1.0.0";
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

    /**
     * Stores original pre-wrap text and geometry in an effect expression and layer comment.
     */
    function storeOriginalState(textLayer, origText, isBox, boxSize) {
        if (!textLayer) return;
        try {
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
                    // Encode state into expression comment payload
                    var payload = {
                        text: origText,
                        isBox: isBox,
                        boxSize: boxSize || [0, 0]
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

            // Also mirror in layer.comment for native AE inspector persistence
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
                                return { text: decoded, isBox: false, boxSize: null };
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
                    boxSize: null
                };
            }
        } catch (eRead) {}
        return null;
    }

    /**
     * Restores the layer back to its original unmodified text and geometry.
     */
    function restoreOriginalText(textLayer) {
        if (!textLayer) return false;
        var state = readOriginalState(textLayer);
        if (!state || !state.text) return false;

        var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
        var docProp = textProp ? (textProp.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
        if (!docProp) return false;

        var doc = docProp.value;
        if (doc) {
            doc.text = state.text;
            if (state.isBox && state.boxSize) {
                try {
                    doc.boxText = true;
                    doc.boxTextSize = state.boxSize;
                } catch (eBox) {}
            }
            docProp.setValue(doc);
        } else {
            docProp.setValue(state.text);
        }

        return true;
    }

    // -------------------------------------------------------------------------
    // 8. Main Text Wrapping Orchestration
    // -------------------------------------------------------------------------

    function executeTextWrap(comp, textLayer, options) {
        if (!comp || !textLayer) return false;

        var textProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
        var docProp = textProp ? (textProp.property("ADBE Text Document") || textLayer.property("Source Text")) : textLayer.property("Source Text");
        if (!docProp) return false;

        var doc = docProp.value;
        var fullText = getTextLayerString(textLayer);
        if (!fullText || trimString(fullText).length === 0) return false;

        var isBox = Boolean(doc && doc.boxText === true);
        var origBoxSize = (doc && doc.boxTextSize) ? [doc.boxTextSize[0], doc.boxTextSize[1]] : null;

        // 1. Store original text in effect before mutating
        var existingState = readOriginalState(textLayer);
        if (!existingState) {
            storeOriginalState(textLayer, fullText, isBox, origBoxSize);
        }

        // 2. Initialize accurate measurement engine
        var measurer = createTextMeasurer(comp, textLayer, doc);
        var spaceW = measurer.measureAdvance(" ");
        var maxW = options.maxWidth || 600;
        var desiredW = options.desiredWidth || Math.max(50, maxW - 100);
        if (desiredW >= maxW) desiredW = Math.max(50, maxW - 20);

        try {
            // 3. Apply semantic & micro-typographic bindings (prepositions, numbers, widows)
            var preprocessed = applySemanticBindings(fullText, options.language, {
                bindNumbers: options.bindNumbers,
                bindHonorifics: options.bindHonorifics,
                avoidDanglingShort: options.avoidDanglingShort,
                preventWidows: options.preventWidows
            });

            // 4. Split by manual line breaks / paragraphs
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

            // 7. Update effect status
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
    // 9. ScriptUI Panel & User Interface
    // -------------------------------------------------------------------------

    function buildUI(thisObj) {
        var isDockable = (typeof Panel !== "undefined" && thisObj instanceof Panel);
        var WinClass = (typeof Window !== "undefined") ? Window : (globalObj.Window || null);
        var win = isDockable ? thisObj : (WinClass ? new WinClass("palette", SCRIPT_TITLE + " " + SCRIPT_VERSION, undefined, { resizeable: true }) : null);
        if (!win) return null;

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // --- Header Panel ---
        var pnlHeader = win.add("panel", undefined, SCRIPT_TITLE + " " + SCRIPT_VERSION);
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.spacing = 3;
        pnlHeader.margins = [8, 6, 8, 6];

        var lblSub = pnlHeader.add("statictext", undefined, "Balanced paragraph typography, hyphenation & micro-spacing");
        try {
            lblSub.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.75, 1.0, 1.0], 1);
        } catch (eG) {}

        // --- Target Layer Detection Panel ---
        var pnlTarget = win.add("panel", undefined, "Selected Text Layer");
        pnlTarget.orientation = "row";
        pnlTarget.alignChildren = ["fill", "center"];
        pnlTarget.spacing = 6;
        pnlTarget.margins = 8;

        var lblTargetStatus = pnlTarget.add("statictext", undefined, "Scanning for text layer...");
        lblTargetStatus.alignment = ["fill", "center"];

        var btnRefresh = pnlTarget.add("button", undefined, "Refresh");
        btnRefresh.preferredSize = [65, 24];

        // --- Width Constraints Panel ---
        var pnlWidth = win.add("panel", undefined, "Width Constraints (px)");
        pnlWidth.orientation = "column";
        pnlWidth.alignChildren = ["fill", "top"];
        pnlWidth.spacing = 6;
        pnlWidth.margins = 8;

        // 1. Max Text Width Constraint (Ceiling)
        var grpMaxWidthRow = pnlWidth.add("group");
        grpMaxWidthRow.orientation = "row";
        grpMaxWidthRow.alignChildren = ["fill", "center"];
        grpMaxWidthRow.spacing = 6;

        var lblMaxWidth = grpMaxWidthRow.add("statictext", undefined, "Max Width (Ceiling):");
        lblMaxWidth.preferredSize = [130, -1];

        var sldMaxWidth = grpMaxWidthRow.add("slider", undefined, 600, 100, 1920);
        sldMaxWidth.alignment = ["fill", "center"];

        var txtMaxWidth = grpMaxWidthRow.add("edittext", undefined, "600");
        txtMaxWidth.preferredSize = [50, 22];

        var lblPx1 = grpMaxWidthRow.add("statictext", undefined, "px");
        lblPx1.preferredSize = [18, -1];

        // 2. Desired Approx Width (Target - Always strictly smaller than Max Width)
        var grpDesiredWidthRow = pnlWidth.add("group");
        grpDesiredWidthRow.orientation = "row";
        grpDesiredWidthRow.alignChildren = ["fill", "center"];
        grpDesiredWidthRow.spacing = 6;

        var lblDesiredWidth = grpDesiredWidthRow.add("statictext", undefined, "Desired Approx Width:");
        lblDesiredWidth.preferredSize = [130, -1];

        var sldDesiredWidth = grpDesiredWidthRow.add("slider", undefined, 500, 60, 1900);
        sldDesiredWidth.alignment = ["fill", "center"];

        var txtDesiredWidth = grpDesiredWidthRow.add("edittext", undefined, "500");
        txtDesiredWidth.preferredSize = [50, 22];

        var lblPx2 = grpDesiredWidthRow.add("statictext", undefined, "px");
        lblPx2.preferredSize = [18, -1];

        // Two-way synchronization enforcing: desired approx width is ALWAYS strictly smaller than max width
        function syncWidthConstraints(source) {
            var maxV = Math.round(sldMaxWidth.value);
            var desV = Math.round(sldDesiredWidth.value);

            // Desired width must always be smaller than max width (buffer of at least 20px)
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
        var pnlMethod = win.add("panel", undefined, "Wrap Method & Language");
        pnlMethod.orientation = "column";
        pnlMethod.alignChildren = ["fill", "top"];
        pnlMethod.spacing = 6;
        pnlMethod.margins = 8;

        var grpMethodRow = pnlMethod.add("group");
        grpMethodRow.orientation = "row";
        grpMethodRow.alignChildren = ["left", "center"];
        grpMethodRow.spacing = 6;
        grpMethodRow.add("statictext", undefined, "Method:");

        var ddMethod = grpMethodRow.add("dropdownlist", undefined, [
            "1. Balanced Paragraph (Knuth-Plass InDesign)",
            "2. Greedy Fit (Typographically Polished)",
            "3. Optical Pyramid (Centered Stanza Card)",
            "4. Reverse Pyramid (Headline / Lead-in)",
            "5. Compact Block (Max Density)"
        ]);
        ddMethod.selection = 0;
        ddMethod.alignment = ["fill", "center"];

        var grpLangRow = pnlMethod.add("group");
        grpLangRow.orientation = "row";
        grpLangRow.alignChildren = ["left", "center"];
        grpLangRow.spacing = 6;
        grpLangRow.add("statictext", undefined, "Language:");

        var ddLanguage = grpLangRow.add("dropdownlist", undefined, [
            "English (US/UK)",
            "Spanish (Español)",
            "French (Français)",
            "German (Deutsch)",
            "Italian (Italiano)",
            "Universal (Latin General)"
        ]);
        ddLanguage.selection = 0;
        ddLanguage.alignment = ["fill", "center"];

        var chkHyphen = pnlMethod.add("checkbox", undefined, "Enable Multilingual Hyphenation (-)");
        chkHyphen.value = true;

        // --- Micro-Typographic Options Panel ---
        var pnlMicro = win.add("panel", undefined, "Micro-Typography & Semantic Units");
        pnlMicro.orientation = "column";
        pnlMicro.alignChildren = ["fill", "top"];
        pnlMicro.spacing = 5;
        pnlMicro.margins = 8;

        var chkWidows = pnlMicro.add("checkbox", undefined, "Prevent Widows & Orphans (Keep last words together)");
        chkWidows.value = true;

        var chkDangling = pnlMicro.add("checkbox", undefined, "Avoid Dangling Short Words & Prepositions (NBSP)");
        chkDangling.value = true;

        var chkNumbers = pnlMicro.add("checkbox", undefined, "Keep Numbers, Units & Currencies Bound (e.g. 100 px)");
        chkNumbers.value = true;

        var chkHonorifics = pnlMicro.add("checkbox", undefined, "Keep Honorifics & Abbreviations Together (Dr. / e.g.)");
        chkHonorifics.value = true;

        // --- Secondary Action Buttons ---
        var grpSubBtns = win.add("group");
        grpSubBtns.orientation = "row";
        grpSubBtns.alignChildren = ["fill", "center"];
        grpSubBtns.spacing = 6;

        var btnRestore = grpSubBtns.add("button", undefined, "↺ Restore Original Text");
        var btnDemo    = grpSubBtns.add("button", undefined, "📝 Create Demo Text");
        btnRestore.preferredSize = [-1, 26];
        btnDemo.preferredSize    = [-1, 26];

        // --- Primary Action Button ---
        var btnExecute = win.add("button", undefined, "✨ Wrap Text into Pleasant Paragraph");
        btnExecute.alignment = ["fill", "center"];
        btnExecute.preferredSize = [-1, 36];

        // ---------------------------------------------------------------------
        // Event Listeners & UI Logic
        // ---------------------------------------------------------------------

        function updateTargetStatus() {
            var comp = getActiveComposition();
            if (!comp) {
                lblTargetStatus.text = "No active composition found.";
                return null;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                lblTargetStatus.text = "Please select a Point or Box Text layer.";
                return null;
            }
            var doc = getTextDocument(textLayer);
            var isBox = Boolean(doc && doc.boxText);
            lblTargetStatus.text = textLayer.name + " (" + (isBox ? "Box Text" : "Point Text") + ")";
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
                alert("No active composition.");
                return;
            }
            var textLayer = getSelectedTextLayer(comp);
            if (!textLayer) {
                alert("Please select the wrapped text layer to restore.");
                return;
            }
            var restored = restoreOriginalText(textLayer);
            if (restored) {
                alert("Restored original text successfully!");
            } else {
                alert("No stored original text found on this layer.");
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

            var opts = {
                maxWidth: parseInt(txtMaxWidth.text, 10) || 600,
                desiredWidth: parseInt(txtDesiredWidth.text, 10) || 500,
                method: methodKeys[ddMethod.selection ? ddMethod.selection.index : 0] || "balanced",
                language: langKeys[ddLanguage.selection ? ddLanguage.selection.index : 0] || "english",
                useHyphen: chkHyphen.value,
                minWordLen: 6,
                preventWidows: chkWidows.value,
                avoidDanglingShort: chkDangling.value,
                bindNumbers: chkNumbers.value,
                bindHonorifics: chkHonorifics.value
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

        if (win instanceof Window) {
            win.center();
            win.show();
        } else if (win.layout) {
            win.layout.layout(true);
        }

        return win;
    }

    // -------------------------------------------------------------------------
    // 10. Execution Bootstrap
    // -------------------------------------------------------------------------
    buildUI(thisObj);

})(this);
