// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE COMIC TEXT BUBBLE v2.0.0
// =============================================================================
//
// PURPOSE:
//   Ground-up parametric Comic Balloon generator for Adobe After Effects.
//   Transforms any existing Point Text or Paragraph (Box) Text layer into a
//   stylized comic speech, thought, whisper, or shout balloon.
//
// CORE ARCHITECTURE & COMBINED ENGINES:
//   1. AE Text Precomp (https://github.com/work2survive/AE-text-precomp):
//      - Optional 1-click Zero-Shift Precomposition (Default: ON), named
//        "comic balloon <HEX>" with symmetric non-clipping exterior canvas bounds.
//   2. AE Align Anchor Point (https://github.com/work2survive/AE-Align-AnchorPoint):
//      - Automatically centers both the Text Box and Balloon Anchor Points
//        horizontally and vertically with scale/rotation-safe Zero-Shift compensation.
//      - Links the Balloon as a direct child layer of the Text Layer.
//   3. Full Ecosystem Interoperability:
//      - 100% compatible with text layers styled or processed by:
//        * AE-replace-color-emojis (https://github.com/work2survive/AE-replace-color-emojis)
//        * AE-advanced-text-wrap   (https://github.com/work2survive/AE-advanced-text-wrap)
//        * AE-Text-Highlight       (https://github.com/work2survive/AE-Text-Highlight)
//   4. Preset Management System:
//      - Store, Rename, Delete, Open (.json), and Download (.json) presets.
//   5. Trim-Paths-Style Tail Perimeter Targeting:
//      - Exact arc-length Start (%), End (%), and Offset (deg) controls with
//        live visual perimeter preview + De Casteljau Bézier splicing.
//   6. Non-Destructive Effect State Backup & Full Reversal:
//      - Stores original text box, content, and transform properties in Effects.
//      - Idempotent Build / Update & 1-click Remove Balloon (full reversal).
//
// REPOSITORY:
//   https://github.com/work2survive/AE-comic-text-bubble
//
// LIVE DEMO:
//   https://work2survive.github.io/AE_JS_builder/?jsx=AE_Comic_Text_Bubble.jsx&autobuild=true
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_NAME    = "AE Comic Text Bubble";
    var SCRIPT_VERSION = "v2.0.0";
    var REPO_URL       = "https://github.com/work2survive/AE-comic-text-bubble";
    var LIVE_DEMO_URL  = "https://work2survive.github.io/AE_JS_builder/?jsx=AE_Comic_Text_Bubble.jsx&autobuild=true";

    var BALLOON_LAYER_TAG  = "AE_COMIC_BALLOON_SHAPE";
    var BALLOON_LAYER_NAME = "Comic Balloon";
    var STATE_EFFECT_NAME  = "Comic Balloon State";
    var PRESETS_STORAGE_KEY = "AE_COMIC_BALLOON_PRESETS_V2";
    var PRESETS_FOLDER_NAME = "comic_balloon_presets";
    var PRESETS_FILE_NAME   = "presets.json";

    // -------------------------------------------------------------------------
    // 1. Safe Environment, Polyfills & ES3 JSON Helpers
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

    var ShapeClass = (typeof Shape !== "undefined")
        ? Shape
        : (globalObj.Shape || ((typeof window !== "undefined") ? window.Shape : null) || function () {
            this.vertices = [];
            this.inTangents = [];
            this.outTangents = [];
            this.closed = true;
        });

    function trimStr(s) {
        if (s === null || s === undefined) return "";
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function clampNum(v, lo, hi, fallback) {
        var n = parseFloat(v);
        if (isNaN(n)) return (fallback !== undefined ? fallback : lo);
        if (n < lo) return lo;
        if (n > hi) return hi;
        return n;
    }

    function escapeJsonStr(str) {
        return String(str)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t");
    }

    function es3Stringify(val, indent, depth) {
        var d = depth || 0;
        var pad = "";
        var innerPad = "";
        var i;
        if (indent) {
            for (i = 0; i < d; i++) pad += indent;
            for (i = 0; i <= d; i++) innerPad += indent;
        }
        if (val === null || val === undefined) return "null";
        var t = typeof val;
        if (t === "boolean") return val ? "true" : "false";
        if (t === "number") return isFinite(val) ? String(val) : "null";
        if (t === "string") return '"' + escapeJsonStr(val) + '"';
        if (val instanceof Array || Object.prototype.toString.call(val) === "[object Array]") {
            if (val.length === 0) return "[]";
            var aParts = [];
            for (i = 0; i < val.length; i++) {
                aParts.push(es3Stringify(val[i], indent, d + 1));
            }
            if (indent) {
                return "[\n" + innerPad + aParts.join(",\n" + innerPad) + "\n" + pad + "]";
            }
            return "[" + aParts.join(",") + "]";
        }
        if (t === "object") {
            var oParts = [];
            for (var k in val) {
                if (val.hasOwnProperty(k) && typeof val[k] !== "function" && val[k] !== undefined) {
                    var sep = indent ? ": " : ":";
                    oParts.push('"' + escapeJsonStr(k) + '"' + sep + es3Stringify(val[k], indent, d + 1));
                }
            }
            if (oParts.length === 0) return "{}";
            if (indent) {
                return "{\n" + innerPad + oParts.join(",\n" + innerPad) + "\n" + pad + "}";
            }
            return "{" + oParts.join(",") + "}";
        }
        return "null";
    }

    var JSONSafe = {
        stringify: function (obj, pretty) {
            if (typeof JSON !== "undefined" && JSON && typeof JSON.stringify === "function") {
                try { return JSON.stringify(obj, null, pretty ? 2 : 0); } catch (e) {}
            }
            return es3Stringify(obj, pretty ? "  " : "", 0);
        },
        parse: function (str) {
            if (!str || typeof str !== "string") return null;
            if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function") {
                return JSON.parse(str);
            }
            return eval("(" + str + ")");
        }
    };

    function cloneObject(obj) {
        return JSONSafe.parse(JSONSafe.stringify(obj, false));
    }

    function generateHexId(len) {
        var chars = "0123456789ABCDEF";
        var n = len || 4;
        var out = "";
        for (var i = 0; i < n; i++) {
            out += chars.charAt(Math.floor(Math.random() * 16));
        }
        return out;
    }

    function generateUniquePrecompName(existingHex) {
        var hex = existingHex || generateHexId(4);
        var candidate = "comic balloon " + hex;
        if (existingHex) return candidate;
        try {
            if (typeof app !== "undefined" && app.project && app.project.items) {
                var guard = 0;
                while (guard < 20) {
                    var conflict = false;
                    var count = app.project.items.length;
                    for (var i = 1; i <= count; i++) {
                        var it = app.project.items[i] || app.project.items[i - 1];
                        if (it && it.name === candidate) {
                            conflict = true;
                            break;
                        }
                    }
                    if (!conflict) break;
                    hex = generateHexId(4);
                    candidate = "comic balloon " + hex;
                    guard++;
                }
            }
        } catch (e) {}
        return candidate;
    }

    function hexToRgb(hex) {
        if (!hex) return [1.0, 1.0, 1.0];
        var clean = String(hex).replace("#", "");
        if (clean.length === 3) {
            clean = clean.charAt(0) + clean.charAt(0) +
                    clean.charAt(1) + clean.charAt(1) +
                    clean.charAt(2) + clean.charAt(2);
        }
        var num = parseInt(clean, 16);
        if (isNaN(num)) return [1.0, 1.0, 1.0];
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#FFFFFF";
        var r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
        var g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
        var b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
        var rh = r.toString(16); if (rh.length < 2) rh = "0" + rh;
        var gh = g.toString(16); if (gh.length < 2) gh = "0" + gh;
        var bh = b.toString(16); if (bh.length < 2) bh = "0" + bh;
        return ("#" + rh + gh + bh).toUpperCase();
    }

    function openExternalUrl(url) {
        try {
            if (typeof window !== "undefined" && typeof window.open === "function") {
                window.open(url, "_blank");
                return;
            }
            if (typeof system !== "undefined" && system.callSystem) {
                if ($.os && $.os.indexOf("Windows") !== -1) {
                    system.callSystem('cmd.exe /c start "" "' + url + '"');
                } else {
                    system.callSystem('open "' + url + '"');
                }
            }
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // 2. Preset System (Built-in Defaults + Store, Rename, Delete, Open, Download)
    // -------------------------------------------------------------------------
    var GEOMETRY_KEYS   = ["square", "rounded", "cloud", "explosion"];
    var GEOMETRY_LABELS = ["Square", "Rounded Corners", "Cloud Shape (Thoughts)", "Explosion / Shout"];

    var TAIL_KEYS       = ["none", "line", "triangle", "lightning", "clouds"];
    var TAIL_LABELS     = ["None", "Line", "Triangle Sharp", "Lightning Shaped", "Thinking Clouds"];

    var STROKE_KEYS     = ["none", "solid", "variable", "dotted"];
    var STROKE_LABELS   = ["None", "Solid (Thickness)", "Variable Thickness (Min & Max)", "Dotted (Whisper)"];

    function getDefaultPresets() {
        return {
            "Classic Speech": {
                geometry: "rounded",
                padX: 36,
                padY: 26,
                cornerRadius: 28,
                cloudPuffs: 12,
                cloudDepth: 18,
                spikeCount: 18,
                spikeDepth: 28,
                tailStyle: "triangle",
                tailStart: 52,
                tailEnd: 60,
                tailOffset: 0,
                tailLength: 85,
                tailAngle: 12,
                fillEnabled: true,
                fillColor: "#FFFFFF",
                fillOpacity: 100,
                strokeStyle: "solid",
                strokeColor: "#111111",
                strokeWidth: 5,
                strokeMinWidth: 2,
                strokeMaxWidth: 9,
                dotGap: 12,
                makePrecomp: true
            },
            "Comic Ink Box": {
                geometry: "square",
                padX: 34,
                padY: 24,
                cornerRadius: 0,
                cloudPuffs: 12,
                cloudDepth: 18,
                spikeCount: 18,
                spikeDepth: 28,
                tailStyle: "triangle",
                tailStart: 45,
                tailEnd: 53,
                tailOffset: 0,
                tailLength: 80,
                tailAngle: -10,
                fillEnabled: true,
                fillColor: "#FFFDF5",
                fillOpacity: 100,
                strokeStyle: "variable",
                strokeColor: "#0F172A",
                strokeWidth: 6,
                strokeMinWidth: 2,
                strokeMaxWidth: 9,
                dotGap: 12,
                makePrecomp: true
            },
            "Thought Cloud": {
                geometry: "cloud",
                padX: 40,
                padY: 30,
                cornerRadius: 28,
                cloudPuffs: 12,
                cloudDepth: 18,
                spikeCount: 18,
                spikeDepth: 28,
                tailStyle: "clouds",
                tailStart: 54,
                tailEnd: 60,
                tailOffset: 0,
                tailLength: 95,
                tailAngle: 15,
                fillEnabled: true,
                fillColor: "#FFFFFF",
                fillOpacity: 100,
                strokeStyle: "solid",
                strokeColor: "#1E293B",
                strokeWidth: 4,
                strokeMinWidth: 2,
                strokeMaxWidth: 8,
                dotGap: 12,
                makePrecomp: true
            },
            "Explosion Shout!": {
                geometry: "explosion",
                padX: 42,
                padY: 32,
                cornerRadius: 0,
                cloudPuffs: 12,
                cloudDepth: 18,
                spikeCount: 18,
                spikeDepth: 30,
                tailStyle: "lightning",
                tailStart: 52,
                tailEnd: 60,
                tailOffset: 0,
                tailLength: 100,
                tailAngle: 10,
                fillEnabled: true,
                fillColor: "#FFE600",
                fillOpacity: 100,
                strokeStyle: "solid",
                strokeColor: "#111111",
                strokeWidth: 6,
                strokeMinWidth: 2,
                strokeMaxWidth: 10,
                dotGap: 12,
                makePrecomp: true
            },
            "Whisper Dotted": {
                geometry: "rounded",
                padX: 36,
                padY: 26,
                cornerRadius: 36,
                cloudPuffs: 12,
                cloudDepth: 18,
                spikeCount: 18,
                spikeDepth: 28,
                tailStyle: "line",
                tailStart: 52,
                tailEnd: 58,
                tailOffset: 0,
                tailLength: 75,
                tailAngle: 15,
                fillEnabled: true,
                fillColor: "#F8FAFC",
                fillOpacity: 100,
                strokeStyle: "dotted",
                strokeColor: "#334155",
                strokeWidth: 4,
                strokeMinWidth: 2,
                strokeMaxWidth: 8,
                dotGap: 12,
                makePrecomp: true
            },
            "Electric Radio": {
                geometry: "rounded",
                padX: 34,
                padY: 24,
                cornerRadius: 12,
                cloudPuffs: 12,
                cloudDepth: 18,
                spikeCount: 18,
                spikeDepth: 28,
                tailStyle: "lightning",
                tailStart: 50,
                tailEnd: 58,
                tailOffset: 0,
                tailLength: 95,
                tailAngle: -15,
                fillEnabled: true,
                fillColor: "#E0F7FA",
                fillOpacity: 100,
                strokeStyle: "variable",
                strokeColor: "#0A2540",
                strokeWidth: 5,
                strokeMinWidth: 2,
                strokeMaxWidth: 8,
                dotGap: 12,
                makePrecomp: true
            }
        };
    }

    function normalizePresetData(raw) {
        var def = getDefaultPresets()["Classic Speech"];
        if (!raw || typeof raw !== "object") return cloneObject(def);
        return {
            geometry: (raw.geometry === "square" || raw.geometry === "rounded" || raw.geometry === "cloud" || raw.geometry === "explosion") ? raw.geometry : def.geometry,
            padX: clampNum(raw.padX, 0, 200, def.padX),
            padY: clampNum(raw.padY, 0, 200, def.padY),
            cornerRadius: clampNum(raw.cornerRadius, 0, 200, def.cornerRadius),
            cloudPuffs: Math.round(clampNum(raw.cloudPuffs, 6, 30, def.cloudPuffs)),
            cloudDepth: clampNum(raw.cloudDepth, 4, 60, def.cloudDepth),
            spikeCount: Math.round(clampNum(raw.spikeCount, 6, 40, def.spikeCount)),
            spikeDepth: clampNum(raw.spikeDepth, 6, 100, def.spikeDepth),
            tailStyle: (raw.tailStyle === "none" || raw.tailStyle === "line" || raw.tailStyle === "triangle" || raw.tailStyle === "lightning" || raw.tailStyle === "clouds") ? raw.tailStyle : def.tailStyle,
            tailStart: clampNum(raw.tailStart, 0, 100, def.tailStart),
            tailEnd: clampNum(raw.tailEnd, 0, 100, def.tailEnd),
            tailOffset: clampNum(raw.tailOffset, -360, 360, def.tailOffset),
            tailLength: clampNum(raw.tailLength, 15, 450, def.tailLength),
            tailAngle: clampNum(raw.tailAngle, -75, 75, def.tailAngle),
            fillEnabled: (raw.fillEnabled !== undefined) ? Boolean(raw.fillEnabled) : true,
            fillColor: (typeof raw.fillColor === "string" && raw.fillColor.length >= 4) ? raw.fillColor.toUpperCase() : def.fillColor,
            fillOpacity: clampNum(raw.fillOpacity, 0, 100, def.fillOpacity),
            strokeStyle: (raw.strokeStyle === "none" || raw.strokeStyle === "solid" || raw.strokeStyle === "variable" || raw.strokeStyle === "dotted") ? raw.strokeStyle : def.strokeStyle,
            strokeColor: (typeof raw.strokeColor === "string" && raw.strokeColor.length >= 4) ? raw.strokeColor.toUpperCase() : def.strokeColor,
            strokeWidth: clampNum(raw.strokeWidth, 0.5, 60, def.strokeWidth),
            strokeMinWidth: clampNum(raw.strokeMinWidth, 0.5, 60, def.strokeMinWidth),
            strokeMaxWidth: clampNum(raw.strokeMaxWidth, 0.5, 60, def.strokeMaxWidth),
            dotGap: clampNum(raw.dotGap, 2, 80, def.dotGap),
            makePrecomp: (raw.makePrecomp !== undefined) ? Boolean(raw.makePrecomp) : true
        };
    }

    var PRESETS = getDefaultPresets();

    function getPresetsFileObj() {
        try {
            if (typeof Folder === "undefined" || typeof File === "undefined") return null;
            var baseFolder = null;
            try {
                if (typeof $.fileName === "string" && $.fileName.length > 0) {
                    var sf = new File($.fileName);
                    if (sf.parent && sf.parent.exists) baseFolder = sf.parent;
                }
            } catch (e1) {}
            if (!baseFolder && Folder.userData) {
                baseFolder = Folder.userData;
            }
            if (!baseFolder) return null;
            var pFolder = new Folder(baseFolder.fsName + "/" + PRESETS_FOLDER_NAME);
            if (!pFolder.exists) {
                try { pFolder.create(); } catch (eCr) {}
            }
            if (pFolder.exists) {
                return new File(pFolder.fsName + "/" + PRESETS_FILE_NAME);
            }
        } catch (e) {}
        return null;
    }

    function loadStoredPresets() {
        var loadedMap = null;

        // 1. Browser localStorage (AE_JS_builder live demo)
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                var lsRaw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
                if (lsRaw) {
                    var lsParsed = JSONSafe.parse(lsRaw);
                    if (lsParsed && typeof lsParsed === "object") {
                        loadedMap = lsParsed.presets || lsParsed;
                    }
                }
            }
        } catch (eLS) {}

        // 2. Native AE app.settings
        if (!loadedMap) {
            try {
                if (typeof app !== "undefined" && app.settings && app.settings.haveSetting("AE_Comic_Balloon", PRESETS_STORAGE_KEY)) {
                    var setRaw = app.settings.getSetting("AE_Comic_Balloon", PRESETS_STORAGE_KEY);
                    if (setRaw) {
                        var setParsed = JSONSafe.parse(setRaw);
                        if (setParsed && typeof setParsed === "object") {
                            loadedMap = setParsed.presets || setParsed;
                        }
                    }
                }
            } catch (eSet) {}
        }

        // 3. External JSON file on disk
        if (!loadedMap) {
            try {
                var pf = getPresetsFileObj();
                if (pf && pf.exists) {
                    pf.encoding = "UTF-8";
                    if (pf.open("r")) {
                        var fTxt = pf.read();
                        pf.close();
                        var fParsed = JSONSafe.parse(fTxt);
                        if (fParsed && typeof fParsed === "object") {
                            loadedMap = fParsed.presets || fParsed;
                        }
                    }
                }
            } catch (eFile) {}
        }

        if (loadedMap && typeof loadedMap === "object") {
            var nextMap = {};
            var count = 0;
            for (var k in loadedMap) {
                if (loadedMap.hasOwnProperty(k) && loadedMap[k] && typeof loadedMap[k] === "object") {
                    nextMap[k] = normalizePresetData(loadedMap[k]);
                    count++;
                }
            }
            if (count > 0) {
                PRESETS = nextMap;
            }
        }
    }

    function persistPresets() {
        var payloadObj = {
            name: "AE Comic Text Bubble Presets",
            version: "2.0",
            presets: PRESETS
        };
        var jsonStr = JSONSafe.stringify(payloadObj, true);

        try {
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem(PRESETS_STORAGE_KEY, jsonStr);
            }
        } catch (eLS) {}

        try {
            if (typeof app !== "undefined" && app.settings && typeof app.settings.saveSetting === "function") {
                app.settings.saveSetting("AE_Comic_Balloon", PRESETS_STORAGE_KEY, jsonStr);
            }
        } catch (eSet) {}

        try {
            var pf = getPresetsFileObj();
            if (pf) {
                pf.encoding = "UTF-8";
                if (pf.open("w")) {
                    pf.write(jsonStr);
                    pf.close();
                }
            }
        } catch (eFile) {}
    }

    loadStoredPresets();

    // -------------------------------------------------------------------------
    // 3. Composition, Text Layer & Ecosystem Sibling Helpers
    // -------------------------------------------------------------------------
    function getActiveComp() {
        if (typeof app === "undefined" || !app.project) return null;
        var active = app.project.activeItem;
        if (active && (active instanceof CompItem || active.layers)) {
            return active;
        }
        if (app.project.items) {
            var len = app.project.items.length;
            for (var i = 1; i <= len; i++) {
                var it = app.project.items[i] || app.project.items[i - 1];
                if (it && (it instanceof CompItem || it.layers)) {
                    if (it.selectedLayers && it.selectedLayers.length > 0) return it;
                }
            }
            for (var j = 1; j <= len; j++) {
                var it2 = app.project.items[j] || app.project.items[j - 1];
                if (it2 && (it2 instanceof CompItem || it2.layers)) return it2;
            }
        }
        return null;
    }

    function getCompLayerCount(comp) {
        if (!comp || !comp.layers) return 0;
        return (typeof comp.numLayers === "number") ? comp.numLayers : (comp.layers.length || 0);
    }

    function getCompLayerAt(comp, oneBasedIdx) {
        if (!comp || !comp.layers) return null;
        if (typeof comp.layer === "function") {
            try {
                var l = comp.layer(oneBasedIdx);
                if (l) return l;
            } catch (e) {}
        }
        return comp.layers[oneBasedIdx] || comp.layers[oneBasedIdx - 1] || null;
    }

    function isTextLayer(layer) {
        if (!layer) return false;
        try {
            if (typeof TextLayer !== "undefined" && layer instanceof TextLayer) return true;
            if (layer.matchName === "ADBE Text Layer") return true;
            return Boolean(
                layer.property("ADBE Text Properties") ||
                layer.property("Text") ||
                layer.property("Source Text")
            );
        } catch (e) {
            return false;
        }
    }

    function isComicBalloonShapeLayer(layer) {
        if (!layer) return false;
        try {
            if (layer.comment && String(layer.comment).indexOf(BALLOON_LAYER_TAG) !== -1) return true;
            if (layer.name === BALLOON_LAYER_NAME) return true;
        } catch (e) {}
        return false;
    }

    function isComicBalloonPrecompLayer(layer) {
        if (!layer) return false;
        try {
            if (readLayerStateEffect(layer)) {
                if (layer.source && layer.source.layers) return true;
            }
            if (layer.source && layer.source.layers && /^comic balloon [0-9A-Fa-f]{4,8}$/.test(layer.name || "")) {
                return true;
            }
        } catch (e) {}
        return false;
    }

    function findChildBalloonForText(comp, textLayer) {
        var count = getCompLayerCount(comp);
        for (var i = 1; i <= count; i++) {
            var lyr = getCompLayerAt(comp, i);
            if (lyr && isComicBalloonShapeLayer(lyr) && lyr.parent === textLayer) {
                return lyr;
            }
        }
        return null;
    }

    /**
     * Finds sibling helper child layers parented to textLayer from ecosystem tools:
     *   - AE-replace-color-emojis (comment "AE_COLOR_EMOJI_CHILD" or " - Color Emojis")
     *   - AE-Text-Highlight       (comment "AE_TEXT_HIGHLIGHT" or " - Highlights")
     *   - Any other non-balloon child layer parented to textLayer
     */
    function collectSiblingChildren(comp, textLayer) {
        var above = [];
        var below = [];
        var all = [];
        if (!comp || !textLayer) return { all: all, above: above, below: below };
        var count = getCompLayerCount(comp);
        for (var i = 1; i <= count; i++) {
            var lyr = getCompLayerAt(comp, i);
            if (!lyr || lyr === textLayer || isComicBalloonShapeLayer(lyr)) continue;
            if (lyr.parent === textLayer) {
                all.push(lyr);
                if (lyr.index < textLayer.index) {
                    above.push(lyr);
                } else {
                    below.push(lyr);
                }
            }
        }
        return { all: all, above: above, below: below };
    }

    /**
     * Resolves the active user target in `comp`:
     *   - { mode: "precomp", comp, precompLayer, precompItem, innerTextLayer, balloonLayer }
     *   - { mode: "text",    comp, textLayer, balloonLayer }
     */
    function resolveTargetContext(allowFallbackFirstLayer) {
        var comp = getActiveComp();
        if (!comp) return null;

        // If user is currently inside a "comic balloon <HEX>" precomp itself, check if they selected inner layers
        var sel = comp.selectedLayers || [];
        var i, lyr;

        for (i = 0; i < sel.length; i++) {
            lyr = sel[i];
            if (isComicBalloonPrecompLayer(lyr)) {
                var pItem = lyr.source;
                var innerText = null;
                var innerBalloon = null;
                var pCount = getCompLayerCount(pItem);
                for (var k = 1; k <= pCount; k++) {
                    var il = getCompLayerAt(pItem, k);
                    if (!innerText && isTextLayer(il)) innerText = il;
                    if (!innerBalloon && isComicBalloonShapeLayer(il)) innerBalloon = il;
                }
                if (innerText) {
                    return {
                        mode: "precomp",
                        comp: comp,
                        precompLayer: lyr,
                        precompItem: pItem,
                        textLayer: innerText,
                        balloonLayer: innerBalloon
                    };
                }
            }
            if (isComicBalloonShapeLayer(lyr) && lyr.parent && isTextLayer(lyr.parent)) {
                return {
                    mode: "text",
                    comp: comp,
                    textLayer: lyr.parent,
                    balloonLayer: lyr
                };
            }
            if (isTextLayer(lyr)) {
                return {
                    mode: "text",
                    comp: comp,
                    textLayer: lyr,
                    balloonLayer: findChildBalloonForText(comp, lyr)
                };
            }
            // If user selected a Highlight or Color Emoji child layer, resolve to its parent text layer
            if (lyr && lyr.parent && isTextLayer(lyr.parent)) {
                return {
                    mode: "text",
                    comp: comp,
                    textLayer: lyr.parent,
                    balloonLayer: findChildBalloonForText(comp, lyr.parent)
                };
            }
        }

        if (allowFallbackFirstLayer) {
            var total = getCompLayerCount(comp);
            for (i = 1; i <= total; i++) {
                lyr = getCompLayerAt(comp, i);
                if (isComicBalloonPrecompLayer(lyr)) {
                    var pItem2 = lyr.source;
                    var innerText2 = null;
                    var innerBalloon2 = null;
                    var pCount2 = getCompLayerCount(pItem2);
                    for (var k2 = 1; k2 <= pCount2; k2++) {
                        var il2 = getCompLayerAt(pItem2, k2);
                        if (!innerText2 && isTextLayer(il2)) innerText2 = il2;
                        if (!innerBalloon2 && isComicBalloonShapeLayer(il2)) innerBalloon2 = il2;
                    }
                    if (innerText2) {
                        return {
                            mode: "precomp",
                            comp: comp,
                            precompLayer: lyr,
                            precompItem: pItem2,
                            textLayer: innerText2,
                            balloonLayer: innerBalloon2
                        };
                    }
                }
                if (isTextLayer(lyr)) {
                    return {
                        mode: "text",
                        comp: comp,
                        textLayer: lyr,
                        balloonLayer: findChildBalloonForText(comp, lyr)
                    };
                }
            }
        }

        return { mode: "none", comp: comp };
    }

    /**
     * Used in Live Demo / empty stage (&autobuild=true) when comp has zero layers:
     * Creates a clean sample comic text layer so Build works out of the box.
     */
    function ensureTargetOrSampleText() {
        var ctx = resolveTargetContext(true);
        if (!ctx) {
            if (typeof app !== "undefined" && app.project && app.project.items && typeof app.project.items.addComp === "function") {
                var newC = app.project.items.addComp("Main Comp", 1280, 720, 1, 10, 30);
                app.project.activeItem = newC;
                ctx = { mode: "none", comp: newC };
            } else {
                return null;
            }
        }
        if (ctx.mode !== "none") return ctx;

        var comp = ctx.comp;
        if (getCompLayerCount(comp) === 0 && comp.layers && typeof comp.layers.addText === "function") {
            var sampleStr = "POW! Comic Balloon\nReady for Action!";
            var tLayer = comp.layers.addText(sampleStr);
            tLayer.name = "Dialogue Text";
            try {
                var srcProp = tLayer.property("Source Text");
                if (srcProp) {
                    var doc = srcProp.value;
                    if (doc && typeof doc === "object") {
                        doc.text = sampleStr;
                        doc.fontSize = 44;
                        doc.leading = 54;
                        doc.fillColor = [0.07, 0.09, 0.14];
                        doc.applyFill = true;
                        if (typeof ParagraphJustification !== "undefined") {
                            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
                        }
                        srcProp.setValue(doc);
                    }
                }
                tLayer.property("Transform").property("Position").setValue([comp.width / 2, comp.height * 0.44]);
                tLayer.selected = true;
            } catch (eSample) {}
            return {
                mode: "text",
                comp: comp,
                textLayer: tLayer,
                balloonLayer: null
            };
        }

        return ctx;
    }

    // -------------------------------------------------------------------------
    // 4. Original Text Box, Content & Transform Backup in Effect Layer Controls
    // -------------------------------------------------------------------------
    function getTextDocumentSafe(textLayer) {
        if (!textLayer) return null;
        try {
            var srcProp = textLayer.property("Source Text");
            if (!srcProp) {
                var tp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
                if (tp) srcProp = tp.property("ADBE Text Document") || tp.property("Source Text");
            }
            if (srcProp) return srcProp.value;
        } catch (e) {}
        return null;
    }

    function getLayerBounds(layer, compTime) {
        if (!layer) return { left: -120, top: -40, width: 240, height: 80 };
        var t = (compTime !== undefined) ? compTime : 0;
        try {
            if (typeof layer.sourceRectAtTime === "function") {
                var sr = layer.sourceRectAtTime(t, false);
                if (sr && (sr.width > 0 || sr.height > 0)) {
                    return { left: sr.left, top: sr.top, width: sr.width, height: sr.height };
                }
            }
        } catch (eSR) {}

        var doc = getTextDocumentSafe(layer);
        if (doc && doc.boxText && doc.boxTextSize) {
            var bp = doc.boxTextPos || [0, 0];
            return { left: bp[0], top: bp[1], width: doc.boxTextSize[0], height: doc.boxTextSize[1] };
        }
        return { left: -120, top: -40, width: 240, height: 80 };
    }

    function capturePristineTextState(textLayer) {
        var tr = textLayer.property("Transform");
        var posProp = tr.property("Position");
        var apProp  = tr.property("Anchor Point");
        var scProp  = tr.property("Scale");
        var rotProp = tr.property("Rotation") || tr.property("Z Rotation");
        var opProp  = tr.property("Opacity");
        var oriProp = tr.property("Orientation");

        var doc = getTextDocumentSafe(textLayer);
        var textStr = "";
        var isBox = false;
        var boxSize = null;
        var boxPos = null;
        var fontSize = 36;
        var leading = 43.2;
        var fontName = "";
        var tracking = 0;
        var justification = null;
        var fillColor = null;
        var applyFill = true;
        var applyStroke = false;
        var strokeColor = null;
        var strokeWidth = 0;

        if (doc && typeof doc === "object") {
            textStr = (doc.text !== undefined) ? String(doc.text) : "";
            isBox = Boolean(doc.boxText);
            if (isBox && doc.boxTextSize) {
                boxSize = [doc.boxTextSize[0], doc.boxTextSize[1]];
                if (doc.boxTextPos) boxPos = [doc.boxTextPos[0], doc.boxTextPos[1]];
            }
            if (typeof doc.fontSize === "number") fontSize = doc.fontSize;
            if (typeof doc.leading === "number") leading = doc.leading;
            if (doc.font) fontName = String(doc.font);
            if (typeof doc.tracking === "number") tracking = doc.tracking;
            if (doc.justification !== undefined) justification = doc.justification;
            if (doc.applyFill !== undefined) applyFill = Boolean(doc.applyFill);
            if (doc.applyFill && doc.fillColor) fillColor = [doc.fillColor[0], doc.fillColor[1], doc.fillColor[2]];
            if (doc.applyStroke !== undefined) applyStroke = Boolean(doc.applyStroke);
            if (doc.applyStroke && doc.strokeColor) strokeColor = [doc.strokeColor[0], doc.strokeColor[1], doc.strokeColor[2]];
            if (typeof doc.strokeWidth === "number") strokeWidth = doc.strokeWidth;
        } else if (typeof doc === "string") {
            textStr = doc;
        }

        var pVal = posProp ? posProp.value : [0, 0];
        var aVal = apProp ? apProp.value : [0, 0];
        var sVal = scProp ? scProp.value : [100, 100];
        var rVal = rotProp ? (rotProp.value || 0) : 0;
        var oVal = opProp ? (opProp.value !== undefined ? opProp.value : 100) : 100;
        var oriVal = (oriProp && oriProp.value) ? [oriProp.value[0], oriProp.value[1], oriProp.value[2]] : [0, 0, 0];

        var apExpr = "";
        var posExpr = "";
        try { if (apProp && apProp.expression) apExpr = apProp.expression; } catch (e1) {}
        try { if (posProp && posProp.expression) posExpr = posProp.expression; } catch (e2) {}

        return {
            layerName: textLayer.name,
            text: textStr,
            isBox: isBox,
            boxSize: boxSize,
            boxPos: boxPos,
            fontSize: fontSize,
            leading: leading,
            font: fontName,
            tracking: tracking,
            justification: justification,
            applyFill: applyFill,
            fillColor: fillColor,
            applyStroke: applyStroke,
            strokeColor: strokeColor,
            strokeWidth: strokeWidth,
            position: [pVal[0] || 0, pVal[1] || 0, (pVal.length > 2 ? pVal[2] : 0)],
            anchorPoint: [aVal[0] || 0, aVal[1] || 0, (aVal.length > 2 ? aVal[2] : 0)],
            scale: [sVal[0] !== undefined ? sVal[0] : 100, sVal[1] !== undefined ? sVal[1] : 100, (sVal.length > 2 ? sVal[2] : 100)],
            rotation: rVal,
            orientation: oriVal,
            opacity: oVal,
            threeDLayer: Boolean(textLayer.threeDLayer),
            parentName: (textLayer.parent && textLayer.parent.name) ? textLayer.parent.name : "",
            anchorExpr: apExpr,
            posExpr: posExpr,
            siblingShift: [0, 0]
        };
    }

    function ensureEffectCtrl(fxParade, matchName, ctrlName, val) {
        if (!fxParade) return null;
        try {
            var eff = fxParade.property(ctrlName);
            if (!eff) eff = fxParade.addProperty(matchName);
            if (eff) {
                eff.name = ctrlName;
                var p = eff.property(1);
                if (p && val !== undefined) p.setValue(val);
            }
            return eff;
        } catch (e) {
            return null;
        }
    }

    function writeLayerStateEffect(layer, stateEnvelope) {
        if (!layer || !stateEnvelope) return;
        try {
            var fxParade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!fxParade) return;

            var mainEff = ensureEffectCtrl(fxParade, "ADBE Slider Control", STATE_EFFECT_NAME, 1);
            if (mainEff) {
                var sp = mainEff.property("ADBE Slider Control-0001") || mainEff.property(1);
                if (sp) {
                    var encoded = encodeURIComponent(JSONSafe.stringify(stateEnvelope, false));
                    sp.expression = "/* ComicBalloonStateV2:" + encoded + " */\nvalue;";
                }
            }

            // Also populate visible inspector Effect Controls for Original Transform & Text Box
            var orig = stateEnvelope.orig;
            if (orig) {
                ensureEffectCtrl(fxParade, "ADBE Point Control", "CB Orig Position", [orig.position[0], orig.position[1]]);
                ensureEffectCtrl(fxParade, "ADBE Point Control", "CB Orig Anchor", [orig.anchorPoint[0], orig.anchorPoint[1]]);
                ensureEffectCtrl(fxParade, "ADBE Point Control", "CB Orig Scale", [orig.scale[0], orig.scale[1]]);
                ensureEffectCtrl(fxParade, "ADBE Slider Control", "CB Orig Rotation", orig.rotation || 0);
                if (orig.isBox && orig.boxSize) {
                    ensureEffectCtrl(fxParade, "ADBE Point Control", "CB Orig Box Size", [orig.boxSize[0], orig.boxSize[1]]);
                }
            }
        } catch (e) {}
    }

    function readLayerStateEffect(layer) {
        if (!layer) return null;
        try {
            var fxParade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!fxParade) return null;
            var eff = fxParade.property(STATE_EFFECT_NAME);
            if (!eff) return null;
            var sp = eff.property("ADBE Slider Control-0001") || eff.property(1);
            if (sp && sp.expression) {
                var m = sp.expression.match(/\/\* ComicBalloonStateV2:(.*?) \*\//);
                if (m && m[1]) {
                    return JSONSafe.parse(decodeURIComponent(m[1]));
                }
            }
        } catch (e) {}
        return null;
    }

    function removeStateEffectsFromLayer(layer) {
        if (!layer) return;
        try {
            var fxParade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!fxParade) return;
            var names = [
                STATE_EFFECT_NAME,
                "CB Orig Position",
                "CB Orig Anchor",
                "CB Orig Scale",
                "CB Orig Rotation",
                "CB Orig Box Size"
            ];
            for (var i = 0; i < names.length; i++) {
                var eff = fxParade.property(names[i]);
                if (eff && typeof eff.remove === "function") {
                    try { eff.remove(); } catch (eR) {}
                }
            }
        } catch (e) {}
    }

    function restoreTextLayerFromOrigState(comp, textLayer, orig) {
        if (!textLayer || !orig) return;

        // 1. Restore Text Box & Content
        try {
            var srcProp = textLayer.property("Source Text");
            if (srcProp) {
                var doc = srcProp.value;
                if (doc && typeof doc === "object") {
                    if (orig.isBox && orig.boxSize) {
                        try {
                            doc.boxText = true;
                            doc.boxTextSize = [orig.boxSize[0], orig.boxSize[1]];
                            if (orig.boxPos) doc.boxTextPos = [orig.boxPos[0], orig.boxPos[1]];
                        } catch (eBox) {}
                    }
                    doc.text = orig.text;
                    if (orig.fontSize) doc.fontSize = orig.fontSize;
                    if (orig.leading) doc.leading = orig.leading;
                    if (orig.font) {
                        try { doc.font = orig.font; } catch (eF) {}
                    }
                    if (typeof orig.tracking === "number") doc.tracking = orig.tracking;
                    if (orig.justification !== null && orig.justification !== undefined) {
                        try { doc.justification = orig.justification; } catch (eJ) {}
                    }
                    if (orig.fillColor) {
                        try {
                            doc.applyFill = orig.applyFill;
                            doc.fillColor = orig.fillColor;
                        } catch (eFC) {}
                    }
                    srcProp.setValue(doc);
                } else {
                    srcProp.setValue(orig.text);
                }
            }
        } catch (eTxt) {}

        // 2. Restore Sibling Child Offsets (Emojis / Highlights) BEFORE restoring parent anchor
        if (orig.siblingShift && (Math.abs(orig.siblingShift[0]) > 1e-5 || Math.abs(orig.siblingShift[1]) > 1e-5)) {
            var sibs = collectSiblingChildren(comp, textLayer).all;
            for (var si = 0; si < sibs.length; si++) {
                try {
                    var cPosProp = sibs[si].property("Transform").property("Position");
                    var cp = cPosProp.value;
                    if (cp.length > 2) {
                        cPosProp.setValue([cp[0] + orig.siblingShift[0], cp[1] + orig.siblingShift[1], cp[2]]);
                    } else {
                        cPosProp.setValue([cp[0] + orig.siblingShift[0], cp[1] + orig.siblingShift[1]]);
                    }
                } catch (eSib) {}
            }
        }

        // 3. Restore Layer Name, 3D Flag, Parent & Transform
        try { if (orig.layerName) textLayer.name = orig.layerName; } catch (eN) {}
        try { textLayer.threeDLayer = Boolean(orig.threeDLayer); } catch (e3D) {}

        if (comp && orig.parentName) {
            var pCount = getCompLayerCount(comp);
            for (var pi = 1; pi <= pCount; pi++) {
                var cand = getCompLayerAt(comp, pi);
                if (cand && cand !== textLayer && cand.name === orig.parentName) {
                    try { textLayer.parent = cand; } catch (ePar) {}
                    break;
                }
            }
        } else {
            try { textLayer.parent = null; } catch (ePar0) {}
        }

        try {
            var tr = textLayer.property("Transform");
            var apProp  = tr.property("Anchor Point");
            var posProp = tr.property("Position");
            var scProp  = tr.property("Scale");
            var rotProp = tr.property("Rotation") || tr.property("Z Rotation");
            var opProp  = tr.property("Opacity");
            var oriProp = tr.property("Orientation");

            if (apProp) {
                try { apProp.expression = orig.anchorExpr || ""; } catch (eAE) {}
                apProp.setValue(orig.threeDLayer ? orig.anchorPoint : [orig.anchorPoint[0], orig.anchorPoint[1]]);
            }
            if (posProp) {
                try { posProp.expression = orig.posExpr || ""; } catch (ePE) {}
                posProp.setValue(orig.threeDLayer ? orig.position : [orig.position[0], orig.position[1]]);
            }
            if (scProp) {
                scProp.setValue(orig.threeDLayer ? orig.scale : [orig.scale[0], orig.scale[1]]);
            }
            if (rotProp) rotProp.setValue(orig.rotation || 0);
            if (oriProp && orig.threeDLayer && orig.orientation) oriProp.setValue(orig.orientation);
            if (opProp && orig.opacity !== undefined) opProp.setValue(orig.opacity);
        } catch (eTr) {}

        removeStateEffectsFromLayer(textLayer);
    }

    // -------------------------------------------------------------------------
    // 5. Zero-Shift Center Anchor Point Alignment (AE-Align-AnchorPoint)
    // -------------------------------------------------------------------------
    /**
     * Places the text layer's Anchor Point at its exact horizontal & vertical
     * visual center [sr.left + sr.width/2, sr.top + sr.height/2] WITHOUT shifting
     * the text or any parented emoji/highlight layers on screen.
     */
    function centerTextAnchorZeroShift(comp, textLayer, origRecord) {
        var curTime = comp ? comp.time : 0;
        var bounds = getLayerBounds(textLayer, curTime);
        var centerAx = bounds.left + bounds.width / 2;
        var centerAy = bounds.top + bounds.height / 2;

        var tr = textLayer.property("Transform");
        var apProp  = tr.property("Anchor Point");
        var posProp = tr.property("Position");
        var scProp  = tr.property("Scale");
        var rotProp = tr.property("Rotation") || tr.property("Z Rotation");

        // Clear any dynamic anchor expressions from prior tools so centered bake is clean
        try { if (apProp.expression) apProp.expression = ""; } catch (e1) {}
        try { if (posProp.expression) posProp.expression = ""; } catch (e2) {}

        var curA = apProp.value;
        var curP = posProp.value;
        var curS = scProp ? scProp.value : [100, 100];
        var curR = rotProp ? (rotProp.value || 0) : 0;

        var deltaAx = centerAx - (curA[0] || 0);
        var deltaAy = centerAy - (curA[1] || 0);

        if (Math.abs(deltaAx) > 1e-5 || Math.abs(deltaAy) > 1e-5) {
            var sx = (curS[0] !== undefined ? curS[0] : 100) / 100;
            var sy = (curS[1] !== undefined ? curS[1] : 100) / 100;
            var sdx = deltaAx * sx;
            var sdy = deltaAy * sy;
            var rad = curR * (Math.PI / 180);
            var pDeltaX = sdx * Math.cos(rad) - sdy * Math.sin(rad);
            var pDeltaY = sdx * Math.sin(rad) + sdy * Math.cos(rad);

            var is3D = Boolean(textLayer.threeDLayer);
            if (is3D) {
                apProp.setValue([centerAx, centerAy, curA.length > 2 ? curA[2] : 0]);
                posProp.setValue([curP[0] + pDeltaX, curP[1] + pDeltaY, curP.length > 2 ? curP[2] : 0]);
            } else {
                apProp.setValue([centerAx, centerAy]);
                posProp.setValue([curP[0] + pDeltaX, curP[1] + pDeltaY]);
            }

            // Compensate sibling child layers (AE-replace-color-emojis / AE-Text-Highlight)
            var sibs = collectSiblingChildren(comp, textLayer).all;
            for (var i = 0; i < sibs.length; i++) {
                try {
                    var cPosProp = sibs[i].property("Transform").property("Position");
                    var cp = cPosProp.value;
                    if (cp.length > 2) {
                        cPosProp.setValue([cp[0] - deltaAx, cp[1] - deltaAy, cp[2]]);
                    } else {
                        cPosProp.setValue([cp[0] - deltaAx, cp[1] - deltaAy]);
                    }
                } catch (eSib) {}
            }

            if (origRecord) {
                origRecord.siblingShift = [
                    (origRecord.siblingShift ? origRecord.siblingShift[0] : 0) + deltaAx,
                    (origRecord.siblingShift ? origRecord.siblingShift[1] : 0) + deltaAy
                ];
            }
        }

        return {
            bounds: bounds,
            centerAx: centerAx,
            centerAy: centerAy
        };
    }

    // -------------------------------------------------------------------------
    // 6. Parametric Balloon Geometry & Trim-Paths Tail Splicing Engine
    // -------------------------------------------------------------------------
    function lerp2D(a, b, t) {
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    function dist2D(a, b) {
        var dx = b[0] - a[0];
        var dy = b[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function evalCubicPt(p0, out0, in1, p1, t) {
        var isStraight = (Math.abs(out0[0]) < 1e-5 && Math.abs(out0[1]) < 1e-5 &&
                          Math.abs(in1[0]) < 1e-5 && Math.abs(in1[1]) < 1e-5);
        if (isStraight) return lerp2D(p0, p1, t);
        var c1 = [p0[0] + out0[0], p0[1] + out0[1]];
        var c2 = [p1[0] + in1[0], p1[1] + in1[1]];
        var mt = 1 - t;
        var mt2 = mt * mt;
        var t2 = t * t;
        return [
            mt2 * mt * p0[0] + 3 * mt2 * t * c1[0] + 3 * mt * t2 * c2[0] + t2 * t * p1[0],
            mt2 * mt * p0[1] + 3 * mt2 * t * c1[1] + 3 * mt * t2 * c2[1] + t2 * t * p1[1]
        ];
    }

    function splitCubicSegment(seg, t) {
        if (t <= 0) {
            return {
                left:  { p0: seg.p0, out0: [0, 0], in1: [0, 0], p1: seg.p0 },
                right: { p0: seg.p0, out0: seg.out0, in1: seg.in1, p1: seg.p1 }
            };
        }
        if (t >= 1) {
            return {
                left:  { p0: seg.p0, out0: seg.out0, in1: seg.in1, p1: seg.p1 },
                right: { p0: seg.p1, out0: [0, 0], in1: [0, 0], p1: seg.p1 }
            };
        }

        var isStraight = (Math.abs(seg.out0[0]) < 1e-5 && Math.abs(seg.out0[1]) < 1e-5 &&
                          Math.abs(seg.in1[0]) < 1e-5 && Math.abs(seg.in1[1]) < 1e-5);
        if (isStraight) {
            var mid = lerp2D(seg.p0, seg.p1, t);
            return {
                left:  { p0: seg.p0, out0: [0, 0], in1: [0, 0], p1: mid },
                right: { p0: mid,    out0: [0, 0], in1: [0, 0], p1: seg.p1 }
            };
        }

        var p0 = seg.p0;
        var c1 = [p0[0] + seg.out0[0], p0[1] + seg.out0[1]];
        var c2 = [seg.p1[0] + seg.in1[0], seg.p1[1] + seg.in1[1]];
        var p3 = seg.p1;

        var q0 = lerp2D(p0, c1, t);
        var q1 = lerp2D(c1, c2, t);
        var q2 = lerp2D(c2, p3, t);
        var r0 = lerp2D(q0, q1, t);
        var r1 = lerp2D(q1, q2, t);
        var s  = lerp2D(r0, r1, t);

        return {
            left: {
                p0: p0,
                out0: [q0[0] - p0[0], q0[1] - p0[1]],
                in1: [r0[0] - s[0], r0[1] - s[1]],
                p1: s
            },
            right: {
                p0: s,
                out0: [r1[0] - s[0], r1[1] - s[1]],
                in1: [q2[0] - p3[0], q2[1] - p3[1]],
                p1: p3
            }
        };
    }

    function annotateArcLengths(rawSegs) {
        var total = 0;
        var i, s;
        var SAMPLES = 16;
        for (i = 0; i < rawSegs.length; i++) {
            var seg = rawSegs[i];
            var cum = [0];
            var prev = seg.p0;
            var segLen = 0;
            for (s = 1; s <= SAMPLES; s++) {
                var pt = evalCubicPt(seg.p0, seg.out0, seg.in1, seg.p1, s / SAMPLES);
                segLen += dist2D(prev, pt);
                cum.push(segLen);
                prev = pt;
            }
            seg.samples = cum;
            seg.arcLen = Math.max(1e-4, segLen);
            total += seg.arcLen;
        }
        var acc = 0;
        for (i = 0; i < rawSegs.length; i++) {
            rawSegs[i].u0 = acc / total;
            acc += rawSegs[i].arcLen;
            rawSegs[i].u1 = (i === rawSegs.length - 1) ? 1.0 : (acc / total);
        }
        return rawSegs;
    }

    function arcFractionToBezierT(seg, frac) {
        if (frac <= 0) return 0;
        if (frac >= 1) return 1;
        var targetD = frac * seg.arcLen;
        var cum = seg.samples;
        var n = cum.length - 1;
        for (var i = 0; i < n; i++) {
            if (targetD <= cum[i + 1] || i === n - 1) {
                var span = cum[i + 1] - cum[i];
                var sub = (span > 1e-6) ? ((targetD - cum[i]) / span) : 0;
                return (i + sub) / n;
            }
        }
        return frac;
    }

    function evaluatePerimeterAtU(segs, uRaw) {
        var u = ((uRaw % 1) + 1) % 1;
        for (var i = 0; i < segs.length; i++) {
            var seg = segs[i];
            if (u <= seg.u1 || i === segs.length - 1) {
                var span = Math.max(1e-6, seg.u1 - seg.u0);
                var frac = Math.max(0, Math.min(1, (u - seg.u0) / span));
                var t = arcFractionToBezierT(seg, frac);
                var pt = evalCubicPt(seg.p0, seg.out0, seg.in1, seg.p1, t);
                var dt = 0.01;
                var pA = evalCubicPt(seg.p0, seg.out0, seg.in1, seg.p1, Math.max(0, t - dt));
                var pB = evalCubicPt(seg.p0, seg.out0, seg.in1, seg.p1, Math.min(1, t + dt));
                var tx = pB[0] - pA[0];
                var ty = pB[1] - pA[1];
                var tLen = Math.sqrt(tx * tx + ty * ty) || 1;
                // Clockwise in screen coords (+X right, +Y down): outward normal is [ty, -tx]
                var nx = ty / tLen;
                var ny = -tx / tLen;
                return { point: pt, normal: [nx, ny], segIndex: i, t: t };
            }
        }
        return { point: segs[0].p0, normal: [0, -1], segIndex: 0, t: 0 };
    }

    /**
     * Extracts an exact cubic Bézier chain along [uStart -> uEnd] clockwise around [0, 1).
     */
    function extractSubpathBetweenU(segs, uStartRaw, uEndRaw) {
        var uStart = ((uStartRaw % 1) + 1) % 1;
        var uEnd   = ((uEndRaw % 1) + 1) % 1;

        function extractLinearRange(a, b) {
            var out = [];
            if (b <= a + 1e-6) return out;
            for (var i = 0; i < segs.length; i++) {
                var seg = segs[i];
                if (seg.u1 <= a + 1e-7 || seg.u0 >= b - 1e-7) continue;
                var span = Math.max(1e-6, seg.u1 - seg.u0);
                var f0 = Math.max(0, Math.min(1, (a - seg.u0) / span));
                var f1 = Math.max(0, Math.min(1, (b - seg.u0) / span));
                if (f1 <= f0 + 1e-6) continue;
                var t0 = arcFractionToBezierT(seg, f0);
                var t1 = arcFractionToBezierT(seg, f1);
                if (t0 <= 1e-5 && t1 >= 1 - 1e-5) {
                    out.push({ p0: seg.p0, out0: seg.out0, in1: seg.in1, p1: seg.p1 });
                } else {
                    var firstSplit = splitCubicSegment(seg, t0);
                    var remT = (1 - t0 > 1e-6) ? ((t1 - t0) / (1 - t0)) : 1;
                    var secondSplit = splitCubicSegment(firstSplit.right, Math.max(0, Math.min(1, remT)));
                    out.push(secondSplit.left);
                }
            }
            return out;
        }

        if (uStart < uEnd) {
            return extractLinearRange(uStart, uEnd);
        }
        var part1 = extractLinearRange(uStart, 1.0);
        var part2 = extractLinearRange(0.0, uEnd);
        return part1.concat(part2);
    }

    function superellipsePoint(theta, a, b, n) {
        var ct = Math.cos(theta);
        var st = Math.sin(theta);
        var sc = (ct < 0) ? -1 : 1;
        var ss = (st < 0) ? -1 : 1;
        var exp = 2.0 / n;
        return [
            a * sc * Math.pow(Math.abs(ct), exp),
            b * ss * Math.pow(Math.abs(st), exp)
        ];
    }

    /**
     * Builds the closed clockwise perimeter segments starting at Top-Center (0, -b)
     * for any of the 4 Balloon Geometries: square, rounded, cloud, explosion.
     */
    function buildBalloonPerimeterSegments(textW, textH, cfg) {
        var padX = cfg.padX;
        var padY = cfg.padY;
        var w = Math.max(24, textW + padX * 2);
        var h = Math.max(24, textH + padY * 2);
        var a = w / 2;
        var b = h / 2;
        var geom = cfg.geometry || "rounded";
        var segs = [];

        if (geom === "square" || geom === "rounded") {
            var r = (geom === "square") ? 0 : Math.max(0, Math.min(cfg.cornerRadius || 0, a, b));
            var K = 0.5522847498307936;

            function pushLine(p0, p1) {
                if (dist2D(p0, p1) > 0.05) {
                    segs.push({ p0: p0, out0: [0, 0], in1: [0, 0], p1: p1 });
                }
            }

            // Clockwise from Top-Center (0, -b)
            pushLine([0, -b], [a - r, -b]);
            if (r > 0.05) {
                segs.push({ p0: [a - r, -b], out0: [r * K, 0], in1: [0, -r * K], p1: [a, -b + r] });
            }
            pushLine([a, -b + r], [a, b - r]);
            if (r > 0.05) {
                segs.push({ p0: [a, b - r], out0: [0, r * K], in1: [r * K, 0], p1: [a - r, b] });
            }
            pushLine([a - r, b], [-a + r, b]);
            if (r > 0.05) {
                segs.push({ p0: [-a + r, b], out0: [-r * K, 0], in1: [0, r * K], p1: [-a, b - r] });
            }
            pushLine([-a, b - r], [-a, -b + r]);
            if (r > 0.05) {
                segs.push({ p0: [-a, -b + r], out0: [0, -r * K], in1: [-r * K, 0], p1: [-a + r, -b] });
            }
            pushLine([-a + r, -b], [0, -b]);

            return annotateArcLengths(segs);
        }

        // Safe superellipse inner cushion so text corners never touch cloud cusps or explosion valleys
        var halfTW = textW / 2 + 4;
        var halfTH = textH / 2 + 4;
        var nExp = 2.8;
        var A = a * 1.06;
        var B = b * 1.06;
        var diagCheck = Math.pow(Math.pow(halfTW / A, nExp) + Math.pow(halfTH / B, nExp), 1.0 / nExp);
        if (diagCheck > 0.96) {
            var scaleUp = diagCheck / 0.96;
            A *= scaleUp;
            B *= scaleUp;
        }

        if (geom === "cloud") {
            var puffs = Math.max(6, Math.min(30, Math.round(cfg.cloudPuffs || 12)));
            var depth = Math.max(4, cfg.cloudDepth || 18);
            var cusps = [];
            var ci;
            for (ci = 0; ci < puffs; ci++) {
                var ang = -Math.PI / 2 + (2 * Math.PI * ci) / puffs;
                cusps.push(superellipsePoint(ang, A, B, nExp));
            }
            for (ci = 0; ci < puffs; ci++) {
                var c0 = cusps[ci];
                var c1 = cusps[(ci + 1) % puffs];
                var ex = c1[0] - c0[0];
                var ey = c1[1] - c0[1];
                var elen = Math.sqrt(ex * ex + ey * ey) || 1;
                var nx = ey / elen;
                var ny = -ex / elen;
                var midAng = -Math.PI / 2 + (2 * Math.PI * (ci + 0.5)) / puffs;
                var lobeD = depth * (1.0 + 0.12 * Math.cos(2 * midAng));
                segs.push({
                    p0: c0,
                    out0: [ex * 0.18 + nx * lobeD * 1.33, ey * 0.18 + ny * lobeD * 1.33],
                    in1: [-ex * 0.18 + nx * lobeD * 1.33, -ey * 0.18 + ny * lobeD * 1.33],
                    p1: c1
                });
            }
            return annotateArcLengths(segs);
        }

        // Explosion / Shout
        var spikes = Math.max(6, Math.min(40, Math.round(cfg.spikeCount || 18)));
        var sDepth = Math.max(6, cfg.spikeDepth || 28);
        var totalVerts = spikes * 2;
        var pts = [];
        var si;
        for (si = 0; si < totalVerts; si++) {
            var sAng = -Math.PI / 2 + (2 * Math.PI * si) / totalVerts;
            var basePt = superellipsePoint(sAng, A, B, nExp);
            if (si % 2 === 0) {
                pts.push(basePt);
            } else {
                var rLen = Math.sqrt(basePt[0] * basePt[0] + basePt[1] * basePt[1]) || 1;
                var rx = basePt[0] / rLen;
                var ry = basePt[1] / rLen;
                var mult = ((((si - 1) / 2) % 2) === 0) ? 1.12 : 0.84;
                pts.push([basePt[0] + rx * sDepth * mult, basePt[1] + ry * sDepth * mult]);
            }
        }
        for (si = 0; si < totalVerts; si++) {
            segs.push({
                p0: pts[si],
                out0: [0, 0],
                in1: [0, 0],
                p1: pts[(si + 1) % totalVerts]
            });
        }
        return annotateArcLengths(segs);
    }

    function segmentsToClosedShapeData(segs) {
        var verts = [];
        var inT = [];
        var outT = [];
        var n = segs.length;
        for (var i = 0; i < n; i++) {
            var prev = segs[(i - 1 + n) % n];
            var cur  = segs[i];
            verts.push(cur.p0);
            inT.push(prev.in1);
            outT.push(cur.out0);
        }
        return { vertices: verts, inTangents: inT, outTangents: outT, closed: true };
    }

    function circleShapeData(cx, cy, r) {
        var k = r * 0.5522847498307936;
        return {
            vertices: [
                [cx, cy - r],
                [cx + r, cy],
                [cx, cy + r],
                [cx - r, cy]
            ],
            inTangents: [
                [-k, 0],
                [0, -k],
                [k, 0],
                [0, k]
            ],
            outTangents: [
                [k, 0],
                [0, k],
                [-k, 0],
                [0, -k]
            ],
            closed: true
        };
    }

    /**
     * Generates complete Balloon + Tail Shape specifications and exact outer bounds.
     */
    function computeBalloonAndTail(textW, textH, cfg) {
        var segs = buildBalloonPerimeterSegments(textW, textH, cfg);
        var tailStyle = cfg.tailStyle || "none";

        var offFrac = (cfg.tailOffset || 0) / 360.0;
        var uA = (((cfg.tailStart / 100.0) + offFrac) % 1 + 1) % 1;
        var uB = (((cfg.tailEnd / 100.0) + offFrac) % 1 + 1) % 1;
        var span = ((uB - uA) % 1 + 1) % 1;

        // Always take the minor perimeter arc so the tail base never swallows the balloon
        if (span > 0.5) {
            var tmp = uA; uA = uB; uB = tmp;
            span = 1.0 - span;
        }
        var uMid = (uA + span * 0.5) % 1;

        if (tailStyle === "triangle" || tailStyle === "lightning") {
            if (span < 0.025) {
                span = 0.05;
                uA = ((uMid - span * 0.5) % 1 + 1) % 1;
                uB = (uMid + span * 0.5) % 1;
            } else if (span > 0.35) {
                span = 0.35;
                uA = ((uMid - span * 0.5) % 1 + 1) % 1;
                uB = (uMid + span * 0.5) % 1;
            }
        }

        var midEval = evaluatePerimeterAtU(segs, uMid);
        var pMid = midEval.point;
        var nOut = midEval.normal;

        // Blend outward perimeter normal with radial vector from center for smooth comic direction
        var rLen = Math.sqrt(pMid[0] * pMid[0] + pMid[1] * pMid[1]) || 1;
        var rx = pMid[0] / rLen;
        var ry = pMid[1] / rLen;
        var dirX = nOut[0] * 0.45 + rx * 0.55;
        var dirY = nOut[1] * 0.45 + ry * 0.55;
        var dirMag = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        var baseOutAng = Math.atan2(dirY / dirMag, dirX / dirMag);
        var tipAng = baseOutAng + ((cfg.tailAngle || 0) * Math.PI / 180.0);

        var tailLen = Math.max(15, cfg.tailLength || 85);
        var pTip = [
            pMid[0] + tailLen * Math.cos(tipAng),
            pMid[1] + tailLen * Math.sin(tipAng)
        ];

        var bodyShape = null;
        var extraShapes = []; // { name, shapeData, filled, stroked, isLine }

        if (tailStyle === "none") {
            bodyShape = segmentsToClosedShapeData(segs);

        } else if (tailStyle === "line") {
            bodyShape = segmentsToClosedShapeData(segs);
            extraShapes.push({
                name: "Tail Line",
                shapeData: {
                    vertices: [pMid, pTip],
                    inTangents: [[0, 0], [0, 0]],
                    outTangents: [[0, 0], [0, 0]],
                    closed: false
                },
                filled: false,
                stroked: true,
                isLine: true
            });

        } else if (tailStyle === "clouds") {
            bodyShape = segmentsToClosedShapeData(segs);
            var rBase = Math.max(9, Math.min(22, tailLen * 0.17));
            var puffsSpec = [
                { frac: 0.34, r: rBase },
                { frac: 0.68, r: rBase * 0.65 },
                { frac: 0.96, r: rBase * 0.40 }
            ];
            for (var pi = 0; pi < puffsSpec.length; pi++) {
                var pf = puffsSpec[pi];
                var cx = pMid[0] + (pTip[0] - pMid[0]) * pf.frac;
                var cy = pMid[1] + (pTip[1] - pMid[1]) * pf.frac;
                extraShapes.push({
                    name: "Thought Cloud " + (pi + 1),
                    shapeData: circleShapeData(cx, cy, pf.r),
                    filled: true,
                    stroked: true,
                    isLine: false,
                    strokeScale: (pi === 0 ? 0.9 : (pi === 1 ? 0.8 : 0.7))
                });
            }

        } else if (tailStyle === "triangle" || tailStyle === "lightning") {
            // Splice open perimeter chain clockwise from uB around to uA
            var chain = extractSubpathBetweenU(segs, uB, uA);
            if (!chain || chain.length === 0) {
                bodyShape = segmentsToClosedShapeData(segs);
            } else {
                var b2 = chain[0].p0;
                var b1 = chain[chain.length - 1].p1;

                var verts = [];
                var inT = [];
                var outT = [];

                verts.push(b2);
                inT.push([0, 0]);
                outT.push(chain[0].out0);

                for (var m = 1; m < chain.length; m++) {
                    verts.push(chain[m].p0);
                    inT.push(chain[m - 1].in1);
                    outT.push(chain[m].out0);
                }

                verts.push(b1);
                inT.push(chain[chain.length - 1].in1);
                outT.push([0, 0]);

                if (tailStyle === "triangle") {
                    verts.push(pTip);
                    inT.push([0, 0]);
                    outT.push([0, 0]);
                } else {
                    // Non-self-intersecting ribbon lightning bolt from B1 -> zig-zag -> pTip -> B2
                    var midBase = [(b1[0] + b2[0]) * 0.5, (b1[1] + b2[1]) * 0.5];
                    var vx = pTip[0] - midBase[0];
                    var vy = pTip[1] - midBase[1];
                    var bx = b1[0] - b2[0];
                    var by = b1[1] - b2[1];
                    var bDist = Math.sqrt(bx * bx + by * by) || 1;
                    var px = bx / bDist;
                    var py = by / bDist;
                    var w0 = Math.max(6, bDist * 0.5);
                    var jog = Math.max(9, tailLen * 0.14);

                    var h1 = w0 * 0.56;
                    var h2 = w0 * 0.36;

                    var l1 = [midBase[0] + vx * 0.48 + px * (jog + h1),        midBase[1] + vy * 0.48 + py * (jog + h1)];
                    var l2 = [midBase[0] + vx * 0.41 + px * (-0.35 * jog + h2), midBase[1] + vy * 0.41 + py * (-0.35 * jog + h2)];
                    var r2 = [midBase[0] + vx * 0.35 + px * (-0.35 * jog - h2), midBase[1] + vy * 0.35 + py * (-0.35 * jog - h2)];
                    var r1 = [midBase[0] + vx * 0.42 + px * (jog - h1),        midBase[1] + vy * 0.42 + py * (jog - h1)];

                    var boltPts = [l1, l2, pTip, r2, r1];
                    for (var bi = 0; bi < boltPts.length; bi++) {
                        verts.push(boltPts[bi]);
                        inT.push([0, 0]);
                        outT.push([0, 0]);
                    }
                }

                bodyShape = {
                    vertices: verts,
                    inTangents: inT,
                    outTangents: outT,
                    closed: true
                };
            }
        }

        // Compute exact bounding box across body + tail + strokes so precomp never clips
        var minX = -textW / 2, maxX = textW / 2;
        var minY = -textH / 2, maxY = textH / 2;

        function expandWithShape(sd) {
            if (!sd || !sd.vertices) return;
            var nV = sd.vertices.length;
            for (var i = 0; i < nV; i++) {
                var p0 = sd.vertices[i];
                minX = Math.min(minX, p0[0]); maxX = Math.max(maxX, p0[0]);
                minY = Math.min(minY, p0[1]); maxY = Math.max(maxY, p0[1]);
                if (sd.closed || i < nV - 1) {
                    var j = (i + 1) % nV;
                    var pMidSample = evalCubicPt(p0, sd.outTangents[i], sd.inTangents[j], sd.vertices[j], 0.5);
                    minX = Math.min(minX, pMidSample[0]); maxX = Math.max(maxX, pMidSample[0]);
                    minY = Math.min(minY, pMidSample[1]); maxY = Math.max(maxY, pMidSample[1]);
                }
            }
        }

        expandWithShape(bodyShape);
        for (var ei = 0; ei < extraShapes.length; ei++) {
            expandWithShape(extraShapes[ei].shapeData);
        }

        var maxSW = 0;
        if (cfg.strokeStyle === "solid" || cfg.strokeStyle === "dotted") {
            maxSW = cfg.strokeWidth || 5;
        } else if (cfg.strokeStyle === "variable") {
            maxSW = Math.max(cfg.strokeMinWidth || 2, cfg.strokeMaxWidth || 9);
        } else if (tailStyle === "line") {
            maxSW = cfg.strokeWidth || 4;
        }
        var margin = maxSW + 14;

        return {
            bodyShape: bodyShape,
            extraShapes: extraShapes,
            pMid: pMid,
            pTip: pTip,
            uA: uA,
            uB: uB,
            uMid: uMid,
            bounds: {
                minX: minX - margin,
                maxX: maxX + margin,
                minY: minY - margin,
                maxY: maxY + margin
            }
        };
    }

    // -------------------------------------------------------------------------
    // 7. Shape Layer Vector Construction (Fill + Solid / Variable / Dotted Stroke)
    // -------------------------------------------------------------------------
    function populateVectorGroup(rootContents, groupName, shapeData, cfg, opts) {
        var grp = rootContents.addProperty("ADBE Vector Group");
        grp.name = groupName;
        var gContents = grp.property("Contents") || grp.property("ADBE Vectors Group");

        var pathGroup = gContents.addProperty("ADBE Vector Shape - Group");
        var shapeObj = new ShapeClass();
        shapeObj.vertices = shapeData.vertices;
        shapeObj.inTangents = shapeData.inTangents;
        shapeObj.outTangents = shapeData.outTangents;
        shapeObj.closed = Boolean(shapeData.closed);

        var pathProp = pathGroup.property("Path") || pathGroup.property("ADBE Vector Shape");
        pathProp.setValue(shapeObj);

        var wantFill = (opts && opts.filled !== undefined) ? opts.filled : cfg.fillEnabled;
        if (wantFill && cfg.fillEnabled) {
            var fillProp = gContents.addProperty("ADBE Vector Graphic - Fill");
            var fRgb = hexToRgb(cfg.fillColor);
            var cProp = fillProp.property("Color") || fillProp.property("ADBE Vector Fill Color");
            if (cProp) cProp.setValue([fRgb[0], fRgb[1], fRgb[2], 1]);
            var fOp = fillProp.property("Opacity") || fillProp.property("ADBE Vector Fill Opacity");
            if (fOp) fOp.setValue(clampNum(cfg.fillOpacity, 0, 100, 100));
        }

        var isLineOnly = Boolean(opts && opts.isLine);
        var sScale = (opts && opts.strokeScale) ? opts.strokeScale : 1.0;
        var effStrokeStyle = cfg.strokeStyle;
        if (isLineOnly && effStrokeStyle === "none") {
            effStrokeStyle = "solid"; // Line tail must have a visible stroke
        }

        if (effStrokeStyle !== "none") {
            var strokeProp = gContents.addProperty("ADBE Vector Graphic - Stroke");
            var sRgb = hexToRgb(cfg.strokeColor);
            var scProp = strokeProp.property("Color") || strokeProp.property("ADBE Vector Stroke Color");
            if (scProp) scProp.setValue([sRgb[0], sRgb[1], sRgb[2], 1]);

            var useRoundJoin = (cfg.geometry === "rounded" || cfg.geometry === "cloud" || effStrokeStyle === "dotted");
            try {
                var lcProp = strokeProp.property("Line Cap") || strokeProp.property("ADBE Vector Stroke Line Cap");
                if (lcProp) lcProp.setValue(2); // Round Cap
                var ljProp = strokeProp.property("Line Join") || strokeProp.property("ADBE Vector Stroke Line Join");
                if (ljProp) ljProp.setValue(useRoundJoin ? 2 : 1); // Round or Miter
                var mlProp = strokeProp.property("Miter Limit") || strokeProp.property("ADBE Vector Stroke Miter Limit");
                if (mlProp) mlProp.setValue(10);
            } catch (eCap) {}

            var swProp = strokeProp.property("Stroke Width") || strokeProp.property("ADBE Vector Stroke Width");

            if (effStrokeStyle === "solid") {
                if (swProp) swProp.setValue(Math.max(0.5, (cfg.strokeWidth || 5) * sScale));

            } else if (effStrokeStyle === "variable") {
                var minW = Math.min(cfg.strokeMinWidth || 2, cfg.strokeMaxWidth || 9) * sScale;
                var maxW = Math.max(cfg.strokeMinWidth || 2, cfg.strokeMaxWidth || 9) * sScale;
                if (maxW < 0.5) maxW = 0.5;
                if (swProp) swProp.setValue(maxW);

                var ratioPct = Math.max(0, Math.min(100, (minW / maxW) * 100));
                try {
                    var taper = strokeProp.taper || strokeProp.property("ADBE Vector Taper") || strokeProp.property("Taper");
                    if (taper) {
                        var pSL = taper.startLength || taper.property("ADBE Vector Taper Start Length") || taper.property("Start Length");
                        var pEL = taper.endLength   || taper.property("ADBE Vector Taper End Length")   || taper.property("End Length");
                        var pSW = taper.startWidth  || taper.property("ADBE Vector Taper Start Width")  || taper.property("Start Width");
                        var pEW = taper.endWidth    || taper.property("ADBE Vector Taper End Width")    || taper.property("End Width");
                        var pSE = taper.startEase   || taper.property("ADBE Vector Taper Start Ease")   || taper.property("Start Ease");
                        var pEE = taper.endEase     || taper.property("ADBE Vector Taper End Ease")     || taper.property("End Ease");

                        if (isLineOnly) {
                            if (pSL) pSL.setValue(0);
                            if (pEL) pEL.setValue(100);
                            if (pSW) pSW.setValue(100);
                            if (pEW) pEW.setValue(ratioPct);
                        } else {
                            if (pSL) pSL.setValue(50);
                            if (pEL) pEL.setValue(50);
                            if (pSW) pSW.setValue(ratioPct);
                            if (pEW) pEW.setValue(ratioPct);
                            if (pSE) pSE.setValue(25);
                            if (pEE) pEE.setValue(25);
                        }
                    }
                } catch (eTaper) {}

            } else if (effStrokeStyle === "dotted") {
                var dotW = Math.max(1, (cfg.strokeWidth || 4) * sScale);
                if (swProp) swProp.setValue(dotW);
                try {
                    var dashes = strokeProp.dashes || strokeProp.property("ADBE Vector Stroke Dashes") || strokeProp.property("Dashes");
                    if (dashes && typeof dashes.addProperty === "function") {
                        var d1 = dashes.addProperty("ADBE Vector Stroke Dash 1");
                        if (d1) d1.setValue(Math.max(0.5, dotW * 0.25)); // With Round Cap, short dash renders crisp round whisper dots
                        var g1 = dashes.addProperty("ADBE Vector Stroke Gap 1");
                        if (g1) g1.setValue(Math.max(dotW * 1.6, (cfg.dotGap || 12) * sScale));
                    }
                } catch (eDash) {}
            }
        }

        return grp;
    }

    function createOrRebuildBalloonLayer(comp, textLayer, existingBalloon, geoResult, cfg) {
        var balloonLayer = existingBalloon;
        if (!balloonLayer) {
            balloonLayer = comp.layers.addShape();
        }
        balloonLayer.name = BALLOON_LAYER_NAME;
        try { balloonLayer.comment = BALLOON_LAYER_TAG; } catch (eC) {}
        try { balloonLayer.label = 11; } catch (eL) {}

        var is3D = Boolean(textLayer.threeDLayer);
        try { balloonLayer.threeDLayer = is3D; } catch (e3D) {}

        // Link Balloon as child of Text Layer, centered horizontally & vertically at [0, 0]
        balloonLayer.parent = textLayer;
        var tr = balloonLayer.property("Transform");
        tr.property("Anchor Point").setValue(is3D ? [0, 0, 0] : [0, 0]);
        tr.property("Position").setValue(is3D ? [0, 0, 0] : [0, 0]);
        tr.property("Scale").setValue(is3D ? [100, 100, 100] : [100, 100]);
        var rotP = tr.property("Rotation") || tr.property("Z Rotation");
        if (rotP) rotP.setValue(0);

        // Place Balloon directly behind text layer & behind any AE-Text-Highlight child layer
        var sibs = collectSiblingChildren(comp, textLayer);
        var lowestBelow = textLayer;
        for (var bi = 0; bi < sibs.below.length; bi++) {
            if (sibs.below[bi].index > lowestBelow.index) {
                lowestBelow = sibs.below[bi];
            }
        }
        try { balloonLayer.moveAfter(lowestBelow); } catch (eMv) {}

        // Clear previous vector contents
        var rootContents = balloonLayer.property("Contents") || balloonLayer.property("ADBE Root Vectors Group");
        if (rootContents) {
            var numP = (typeof rootContents.numProperties === "number")
                ? rootContents.numProperties
                : (rootContents.properties ? rootContents.properties.length : 0);
            for (var p = numP; p >= 1; p--) {
                var oldProp = rootContents.property(p);
                if (oldProp && typeof oldProp.remove === "function") {
                    try { oldProp.remove(); } catch (eRem) {}
                }
            }

            // Add Main Balloon Body (with spliced tail if triangle/lightning)
            populateVectorGroup(rootContents, "Balloon Body", geoResult.bodyShape, cfg, {
                filled: true,
                stroked: true,
                isLine: false
            });

            // Add Extra Tail Shapes (Line or Thinking Clouds)
            for (var ei = 0; ei < geoResult.extraShapes.length; ei++) {
                var ex = geoResult.extraShapes[ei];
                populateVectorGroup(rootContents, ex.name, ex.shapeData, cfg, ex);
            }
        }

        return balloonLayer;
    }

    // -------------------------------------------------------------------------
    // 8. Build / Update & Remove / Reverse Orchestrator (AE-text-precomp)
    // -------------------------------------------------------------------------
    function moveLayerBetweenComps(layer, fromComp, toComp, targetOneBasedIdx) {
        if (typeof layer.copyToComp === "function") {
            layer.copyToComp(toComp);
            var copied = getCompLayerAt(toComp, 1);
            if (copied && targetOneBasedIdx > 1) {
                var refLyr = getCompLayerAt(toComp, Math.min(targetOneBasedIdx, getCompLayerCount(toComp)));
                if (refLyr && refLyr !== copied) {
                    try { copied.moveAfter(refLyr); } catch (eM) {}
                }
            }
            return copied;
        }
        // AE_JS_builder direct LayerCollection transfer (preserves all effects, animators & children)
        if (fromComp && fromComp.layers && toComp && toComp.layers && typeof fromComp.layers.indexOf === "function") {
            var pos = fromComp.layers.indexOf(layer);
            if (pos !== -1) fromComp.layers.splice(pos, 1);
            layer.containingComp = toComp;
            var ins = Math.max(0, Math.min(toComp.layers.length, (targetOneBasedIdx || 1) - 1));
            toComp.layers.splice(ins, 0, layer);
            if (fromComp.layers._notify) fromComp.layers._notify();
            if (toComp.layers._notify) toComp.layers._notify();
            return layer;
        }
        return null;
    }

    function unpackPrecompToParentComp(parentComp, precompLayer, precompItem, keepBalloon) {
        var preIndex = precompLayer.index;
        var preTr = precompLayer.property("Transform");
        var prePos = preTr.property("Position").value;
        var preScale = preTr.property("Scale").value;
        var preRotProp = preTr.property("Rotation") || preTr.property("Z Rotation");
        var preRot = preRotProp ? (preRotProp.value || 0) : 0;
        var preParent = precompLayer.parent;
        var pre3D = Boolean(precompLayer.threeDLayer);

        var innerText = null;
        var layersToExtract = [];
        var count = getCompLayerCount(precompItem);
        var i;
        for (i = 1; i <= count; i++) {
            var il = getCompLayerAt(precompItem, i);
            if (!il) continue;
            if (!keepBalloon && isComicBalloonShapeLayer(il)) continue;
            if (isTextLayer(il) && !innerText) innerText = il;
            layersToExtract.push(il);
        }

        // Record parent relationships inside precomp before moving
        var relMap = [];
        for (i = 0; i < layersToExtract.length; i++) {
            var srcL = layersToExtract[i];
            relMap.push({
                wasParentedToText: (srcL.parent === innerText),
                isText: (srcL === innerText),
                localPos: srcL.property("Transform").property("Position").value,
                localAP: srcL.property("Transform").property("Anchor Point").value,
                localScale: srcL.property("Transform").property("Scale").value
            });
            try { srcL.parent = null; } catch (eU) {}
        }

        var movedLayers = [];
        for (i = 0; i < layersToExtract.length; i++) {
            var mv = moveLayerBetweenComps(layersToExtract[i], precompItem, parentComp, preIndex + i);
            movedLayers.push(mv);
        }

        var restoredText = null;
        var restoredBalloon = null;
        for (i = 0; i < movedLayers.length; i++) {
            if (relMap[i].isText) restoredText = movedLayers[i];
            if (movedLayers[i] && isComicBalloonShapeLayer(movedLayers[i])) restoredBalloon = movedLayers[i];
        }

        if (restoredText) {
            try { restoredText.threeDLayer = pre3D; } catch (e3) {}
            try { restoredText.parent = preParent || null; } catch (eP) {}
            var rTr = restoredText.property("Transform");
            rTr.property("Position").setValue(pre3D ? [prePos[0], prePos[1], prePos[2] || 0] : [prePos[0], prePos[1]]);
            rTr.property("Scale").setValue(pre3D ? [preScale[0], preScale[1], preScale[2] || 100] : [preScale[0], preScale[1]]);
            var rr = rTr.property("Rotation") || rTr.property("Z Rotation");
            if (rr) rr.setValue(preRot);

            for (i = 0; i < movedLayers.length; i++) {
                var ml = movedLayers[i];
                if (ml && ml !== restoredText && relMap[i].wasParentedToText) {
                    try { ml.threeDLayer = pre3D; } catch (eC3) {}
                    ml.parent = restoredText;
                    ml.property("Transform").property("Anchor Point").setValue(relMap[i].localAP);
                    ml.property("Transform").property("Position").setValue(relMap[i].localPos);
                    ml.property("Transform").property("Scale").setValue(relMap[i].localScale);
                }
            }
        }

        try { precompLayer.remove(); } catch (eRL) {}
        try {
            if (typeof precompItem.remove === "function") {
                precompItem.remove();
            } else if (typeof app !== "undefined" && app.project && app.project.items && typeof app.project.items.indexOf === "function") {
                var idx = app.project.items.indexOf(precompItem);
                if (idx !== -1) app.project.items.splice(idx, 1);
            }
        } catch (eRI) {}

        return { textLayer: restoredText, balloonLayer: restoredBalloon };
    }

    function executeBuildOrUpdate(cfg, preferredHex) {
        var ctx = ensureTargetOrSampleText();
        if (!ctx || ctx.mode === "none") {
            throw new Error("Please select an existing Text Layer (or Comic Balloon) in an active composition.");
        }

        var comp = ctx.comp;

        // Case 1: Existing Precomp Selected & Make Precomp is STILL ON -> Fast In-Place Update!
        if (ctx.mode === "precomp" && cfg.makePrecomp) {
            var pLayer = ctx.precompLayer;
            var pItem  = ctx.precompItem;
            var innerText = ctx.textLayer;

            var existingEnv = readLayerStateEffect(pLayer) || readLayerStateEffect(innerText) || {};
            var origRec = existingEnv.orig || capturePristineTextState(innerText);
            var hexCode = existingEnv.precompHex || preferredHex || generateHexId(4);

            var centered = centerTextAnchorZeroShift(pItem, innerText, origRec);
            var geo = computeBalloonAndTail(centered.bounds.width, centered.bounds.height, cfg);

            var halfW = Math.max(20, Math.ceil(Math.max(Math.abs(geo.bounds.minX), Math.abs(geo.bounds.maxX))));
            var halfH = Math.max(20, Math.ceil(Math.max(Math.abs(geo.bounds.minY), Math.abs(geo.bounds.maxY))));
            var newW = halfW * 2;
            var newH = halfH * 2;

            pItem.width = newW;
            pItem.height = newH;

            innerText.property("Transform").property("Position").setValue([newW / 2, newH / 2]);
            innerText.property("Transform").property("Scale").setValue([100, 100]);
            var iRot = innerText.property("Transform").property("Rotation") || innerText.property("Transform").property("Z Rotation");
            if (iRot) iRot.setValue(0);

            createOrRebuildBalloonLayer(pItem, innerText, ctx.balloonLayer, geo, cfg);

            var pAnchorProp = pLayer.property("Transform").property("Anchor Point");
            if (pLayer.threeDLayer) {
                pAnchorProp.setValue([newW / 2, newH / 2, 0]);
            } else {
                pAnchorProp.setValue([newW / 2, newH / 2]);
            }

            var envUpdate = { version: 2, precompHex: hexCode, orig: origRec, config: cfg };
            writeLayerStateEffect(innerText, envUpdate);
            writeLayerStateEffect(pLayer, envUpdate);

            if (pItem._notify) pItem._notify();
            if (comp._notify) comp._notify();

            return { precompName: pItem.name, precompHex: hexCode, isUpdate: true, mode: "precomp" };
        }

        // Case 2: Existing Precomp Selected, but user unchecked Make Precomp -> Unpack first!
        var targetText = ctx.textLayer;
        var targetBalloon = ctx.balloonLayer;
        var priorEnv = null;

        if (ctx.mode === "precomp" && !cfg.makePrecomp) {
            priorEnv = readLayerStateEffect(ctx.precompLayer) || readLayerStateEffect(ctx.textLayer);
            var unpacked = unpackPrecompToParentComp(comp, ctx.precompLayer, ctx.precompItem, true);
            targetText = unpacked.textLayer;
            targetBalloon = unpacked.balloonLayer;
        } else {
            priorEnv = readLayerStateEffect(targetText);
        }

        if (!targetText) {
            throw new Error("Could not locate target text layer.");
        }

        var isUpdateRun = Boolean(priorEnv && priorEnv.orig);
        var origState = isUpdateRun ? priorEnv.orig : capturePristineTextState(targetText);
        var activeHex = (priorEnv && priorEnv.precompHex) ? priorEnv.precompHex : (preferredHex || generateHexId(4));

        // Center Anchor Point of Text Layer (Zero-Shift)
        var cInfo = centerTextAnchorZeroShift(comp, targetText, origState);

        // Build Balloon + Tail Geometry & linked child Shape Layer
        var geoData = computeBalloonAndTail(cInfo.bounds.width, cInfo.bounds.height, cfg);
        targetBalloon = createOrRebuildBalloonLayer(comp, targetText, targetBalloon, geoData, cfg);

        var env = { version: 2, precompHex: activeHex, orig: origState, config: cfg };
        writeLayerStateEffect(targetText, env);

        // If Make Precomp is OFF, keep in current comp with Balloon linked as child
        if (!cfg.makePrecomp) {
            try {
                var cLen = getCompLayerCount(comp);
                for (var s = 1; s <= cLen; s++) getCompLayerAt(comp, s).selected = false;
                targetText.selected = true;
            } catch (eSel) {}
            if (comp._notify) comp._notify();
            return { precompName: null, precompHex: activeHex, isUpdate: isUpdateRun, mode: "text" };
        }

        // Case 3: Precompose Text + Child Balloon (+ any Emoji / Highlight children) into "comic balloon <HEX>"
        var preTr = targetText.property("Transform");
        var outerPos   = preTr.property("Position").value;
        var outerScale = preTr.property("Scale").value;
        var outerRotP  = preTr.property("Rotation") || preTr.property("Z Rotation");
        var outerRot   = outerRotP ? (outerRotP.value || 0) : 0;
        var outerParent = targetText.parent;
        var outer3D    = Boolean(targetText.threeDLayer);

        var halfCW = Math.max(20, Math.ceil(Math.max(Math.abs(geoData.bounds.minX), Math.abs(geoData.bounds.maxX))));
        var halfCH = Math.max(20, Math.ceil(Math.max(Math.abs(geoData.bounds.minY), Math.abs(geoData.bounds.maxY))));
        var preW = halfCW * 2;
        var preH = halfCH * 2;

        var sibGroup = collectSiblingChildren(comp, targetText);
        var indicesToPrecomp = [];
        var si;
        for (si = 0; si < sibGroup.above.length; si++) indicesToPrecomp.push(sibGroup.above[si].index);
        indicesToPrecomp.push(targetText.index);
        for (si = 0; si < sibGroup.below.length; si++) indicesToPrecomp.push(sibGroup.below[si].index);
        indicesToPrecomp.push(targetBalloon.index);
        indicesToPrecomp.sort(function (a, b) { return a - b; });

        var precompName = generateUniquePrecompName(activeHex);
        var actualHex = precompName.replace(/^comic balloon\s+/i, "");
        env.precompHex = actualHex;

        var insertSlot = indicesToPrecomp[0];
        var precompItem = comp.layers.precompose(indicesToPrecomp, precompName, true);
        precompItem.width = preW;
        precompItem.height = preH;

        // Inside precompItem: place centered textLayer at [preW/2, preH/2] with neutral local scale/rot
        var innerTxt = null;
        var innerCnt = getCompLayerCount(precompItem);
        for (si = 1; si <= innerCnt; si++) {
            var cand = getCompLayerAt(precompItem, si);
            if (isTextLayer(cand)) { innerTxt = cand; break; }
        }
        if (innerTxt) {
            try { innerTxt.threeDLayer = false; } catch (eI3) {}
            var iTr = innerTxt.property("Transform");
            iTr.property("Position").setValue([preW / 2, preH / 2]);
            iTr.property("Scale").setValue([100, 100]);
            var ir = iTr.property("Rotation") || iTr.property("Z Rotation");
            if (ir) ir.setValue(0);
            writeLayerStateEffect(innerTxt, env);
        }
        for (si = 1; si <= innerCnt; si++) {
            var ch = getCompLayerAt(precompItem, si);
            if (ch && ch !== innerTxt) {
                try { ch.threeDLayer = false; } catch (eCh3) {}
            }
        }

        // Configure precomp layer in parent comp with Zero-Shift visual lock
        var precompLayer = getCompLayerAt(comp, insertSlot) || comp.layers.byName(precompName);
        if (precompLayer) {
            try { precompLayer.threeDLayer = outer3D; } catch (eP3) {}
            try { if (precompLayer.canSetCollapseTransformation) precompLayer.collapseTransformation = true; } catch (eCT) {}
            var pTr = precompLayer.property("Transform");
            pTr.property("Anchor Point").setValue(outer3D ? [preW / 2, preH / 2, 0] : [preW / 2, preH / 2]);
            pTr.property("Position").setValue(outer3D ? [outerPos[0], outerPos[1], outerPos[2] || 0] : [outerPos[0], outerPos[1]]);
            pTr.property("Scale").setValue(outer3D ? [outerScale[0], outerScale[1], outerScale[2] || 100] : [outerScale[0], outerScale[1]]);
            var pr = pTr.property("Rotation") || pTr.property("Z Rotation");
            if (pr) pr.setValue(outerRot);
            if (outerParent) {
                try { precompLayer.parent = outerParent; } catch (ePP) {}
            }
            writeLayerStateEffect(precompLayer, env);

            try {
                var tot = getCompLayerCount(comp);
                for (si = 1; si <= tot; si++) getCompLayerAt(comp, si).selected = false;
                precompLayer.selected = true;
            } catch (eSel2) {}
        }

        if (precompItem._notify) precompItem._notify();
        if (comp._notify) comp._notify();

        return { precompName: precompName, precompHex: actualHex, isUpdate: isUpdateRun, mode: "precomp" };
    }

    /**
     * Reverses the entire Comic Balloon process:
     *   - Unpacks precomposition if precomposed
     *   - Removes the Balloon layer
     *   - Restores original text box, content, and transform properties from Effects
     */
    function executeRemoveAndReverse() {
        var ctx = resolveTargetContext(true);
        if (!ctx || ctx.mode === "none") {
            throw new Error("No Comic Balloon or Text Layer found to revert.");
        }

        var comp = ctx.comp;
        var textLayer = null;
        var env = null;

        if (ctx.mode === "precomp") {
            env = readLayerStateEffect(ctx.precompLayer) || readLayerStateEffect(ctx.textLayer);
            var unpacked = unpackPrecompToParentComp(comp, ctx.precompLayer, ctx.precompItem, false);
            textLayer = unpacked.textLayer;
        } else {
            textLayer = ctx.textLayer;
            env = readLayerStateEffect(textLayer);
            if (ctx.balloonLayer) {
                try { ctx.balloonLayer.remove(); } catch (eRB) {}
            }
            // Remove any extra child balloon layers attached to textLayer
            var extraB = findChildBalloonForText(comp, textLayer);
            while (extraB) {
                try { extraB.remove(); } catch (eEB) { break; }
                extraB = findChildBalloonForText(comp, textLayer);
            }
        }

        if (textLayer) {
            if (env && env.orig) {
                restoreTextLayerFromOrigState(comp, textLayer, env.orig);
            } else {
                removeStateEffectsFromLayer(textLayer);
            }
            try {
                var tot = getCompLayerCount(comp);
                for (var i = 1; i <= tot; i++) getCompLayerAt(comp, i).selected = false;
                textLayer.selected = true;
            } catch (eS) {}
        }

        if (comp._notify) comp._notify();
        return true;
    }

    // -------------------------------------------------------------------------
    // 9. Color Picker Helper (Native AE $.colorPicker + Web Simulator Picker)
    // -------------------------------------------------------------------------
    function createColorPickerRow(parent, labelStr, defaultHex, onColorChanged) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.alignChildren = ["left", "center"];
        grp.spacing = 6;

        var lbl = grp.add("statictext", undefined, labelStr);
        lbl.preferredSize = [86, -1];

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [34, 22];
        btnSwatch.helpTip = "Click to open color picker";

        var txtHex = grp.add("edittext", undefined, defaultHex);
        txtHex.preferredSize = [74, 22];
        txtHex.characters = 7;

        var picker = {
            group: grp,
            value: defaultHex,
            setColor: null
        };

        btnSwatch.onDraw = function () {
            try {
                var g = this.graphics;
                var rgb = hexToRgb(picker.value);
                var brush = g.newBrush(g.BrushType.SOLID_COLOR, [rgb[0], rgb[1], rgb[2], 1.0]);
                var pen = g.newPen(g.PenType.SOLID_COLOR, [0.55, 0.55, 0.55, 1.0], 1);
                g.newPath();
                g.rectPath(0, 0, this.size ? this.size[0] : 34, this.size ? this.size[1] : 22);
                g.fillPath(brush);
                g.strokePath(pen);
            } catch (e) {}
        };

        function setColor(hexStr, fireCallback) {
            if (!hexStr) return;
            var clean = trimStr(hexStr).toUpperCase();
            if (clean.charAt(0) !== "#") clean = "#" + clean;
            if (!/^#[0-9A-F]{6}$/.test(clean)) return;

            picker.value = clean;
            txtHex.text = clean;

            try { if (btnSwatch.notify) btnSwatch.notify("onDraw"); } catch (eN) {}
            try {
                // Trigger background color in AE_JS_builder
                btnSwatch.graphics.newBrush(btnSwatch.graphics.BrushType.SOLID_COLOR, hexToRgb(clean));
            } catch (eG) {}
            if (btnSwatch.domElement) {
                btnSwatch.domElement.style.backgroundColor = clean;
                btnSwatch.domElement.style.border = "1px solid #888";
            }
            if (fireCallback && typeof onColorChanged === "function") {
                onColorChanged(clean);
            }
        }
        picker.setColor = setColor;

        btnSwatch.onClick = function () {
            var cur = picker.value || "#FFFFFF";
            if (typeof window !== "undefined" && typeof window.openWindowsColorPicker === "function") {
                window.openWindowsColorPicker(cur, function (picked) {
                    setColor(picked, true);
                });
                return;
            }
            if (typeof $.colorPicker === "function") {
                var res = $.colorPicker(parseInt(cur.replace("#", ""), 16));
                if (res !== -1 && res !== undefined && res !== null) {
                    var hs = Number(res).toString(16);
                    while (hs.length < 6) hs = "0" + hs;
                    setColor("#" + hs, true);
                }
            }
        };

        txtHex.onChange = function () {
            var v = trimStr(txtHex.text).toUpperCase();
            if (v.charAt(0) !== "#") v = "#" + v;
            if (/^#[0-9A-F]{6}$/.test(v)) {
                setColor(v, true);
            } else {
                txtHex.text = picker.value;
            }
        };

        setColor(defaultHex, false);
        return picker;
    }

    function createSliderRow(parent, labelStr, defVal, minVal, maxVal, unitStr, onValueChanged) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.alignment = ["fill", "top"];
        grp.alignChildren = ["left", "center"];
        grp.spacing = 6;

        var lbl = grp.add("statictext", undefined, labelStr);
        lbl.preferredSize = [95, -1];

        var sld = grp.add("slider", undefined, defVal, minVal, maxVal);
        sld.minvalue = minVal;
        sld.maxvalue = maxVal;
        sld.value = defVal;
        sld.alignment = ["fill", "center"];

        var txt = grp.add("edittext", undefined, String(defVal));
        txt.preferredSize = [42, 20];

        if (unitStr) {
            var uLbl = grp.add("statictext", undefined, unitStr);
            uLbl.preferredSize = [18, -1];
        }

        function setVal(v, notify) {
            var clamped = clampNum(v, minVal, maxVal, defVal);
            var rounded = (Math.abs(clamped - Math.round(clamped)) < 0.05) ? Math.round(clamped) : (Math.round(clamped * 10) / 10);
            sld.value = rounded;
            txt.text = String(rounded);
            if (notify && typeof onValueChanged === "function") onValueChanged(rounded);
        }

        sld.onChanging = sld.onChange = function () {
            var r = Math.round(sld.value);
            txt.text = String(r);
            if (typeof onValueChanged === "function") onValueChanged(r);
        };

        txt.onChange = function () {
            setVal(txt.text, true);
        };

        return {
            group: grp,
            slider: sld,
            edittext: txt,
            getValue: function () { return clampNum(txt.text, minVal, maxVal, defVal); },
            setValue: setVal
        };
    }

    // -------------------------------------------------------------------------
    // 10. Ground-Up ScriptUI Interface Construction
    //     Layout Order:
    //       1. Presets (Very Top: Dropdown + Store, Rename, Delete, Open, Download)
    //       2. Tabs: [ Balloon ]  [ Tail ]  [ Appearance ]
    //       3. Bottom: Precomp Option + [ Build / Update ] + [ Remove Balloon ]
    // -------------------------------------------------------------------------
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        var pendingHex = generateHexId(4);

        // =====================================================================
        // TOP: PRESETS MANAGER + SELECTION / LIVE DEMO BAR
        // =====================================================================
        var pnlPresets = win.add("panel", undefined, "Presets");
        pnlPresets.orientation = "column";
        pnlPresets.alignChildren = ["fill", "top"];
        pnlPresets.spacing = 5;
        pnlPresets.margins = [8, 10, 8, 8];

        var grpPresetSel = pnlPresets.add("group");
        grpPresetSel.orientation = "row";
        grpPresetSel.alignment = ["fill", "top"];
        grpPresetSel.spacing = 6;

        var lblPreset = grpPresetSel.add("statictext", undefined, "Preset:");
        lblPreset.preferredSize = [42, -1];

        var ddPreset = grpPresetSel.add("dropdownlist", undefined, []);
        ddPreset.alignment = ["fill", "center"];

        var grpPresetBtns = pnlPresets.add("group");
        grpPresetBtns.orientation = "row";
        grpPresetBtns.alignment = ["fill", "top"];
        grpPresetBtns.spacing = 4;

        var btnStorePreset    = grpPresetBtns.add("button", undefined, "Store");
        var btnRenamePreset   = grpPresetBtns.add("button", undefined, "Rename");
        var btnDeletePreset   = grpPresetBtns.add("button", undefined, "Delete");
        var btnOpenPreset     = grpPresetBtns.add("button", undefined, "Open");
        var btnDownloadPreset = grpPresetBtns.add("button", undefined, "Download");

        btnStorePreset.alignment    = ["fill", "center"];
        btnRenamePreset.alignment   = ["fill", "center"];
        btnDeletePreset.alignment   = ["fill", "center"];
        btnOpenPreset.alignment     = ["fill", "center"];
        btnDownloadPreset.alignment = ["fill", "center"];

        btnStorePreset.preferredSize    = [-1, 22];
        btnRenamePreset.preferredSize   = [-1, 22];
        btnDeletePreset.preferredSize   = [-1, 22];
        btnOpenPreset.preferredSize     = [-1, 22];
        btnDownloadPreset.preferredSize = [-1, 22];

        btnStorePreset.helpTip    = "Save current settings as a new or existing preset";
        btnRenamePreset.helpTip   = "Rename the selected preset";
        btnDeletePreset.helpTip   = "Delete the selected preset";
        btnOpenPreset.helpTip     = "Open / import preset(s) from a .json file";
        btnDownloadPreset.helpTip = "Download / export the selected preset as a .json file";

        // Active Target Layer Bar
        var grpTargetBar = win.add("group");
        grpTargetBar.orientation = "row";
        grpTargetBar.alignment = ["fill", "top"];
        grpTargetBar.spacing = 6;

        var lblTargetLayer = grpTargetBar.add("statictext", undefined, "Target: Scanning active composition...");
        lblTargetLayer.alignment = ["fill", "center"];

        var btnRefresh = grpTargetBar.add("button", undefined, "Refresh");
        btnRefresh.preferredSize = [56, 20];

        var btnLiveDemo = grpTargetBar.add("button", undefined, "Live Demo");
        btnLiveDemo.preferredSize = [68, 20];
        btnLiveDemo.helpTip = LIVE_DEMO_URL;
        btnLiveDemo.onClick = function () { openExternalUrl(LIVE_DEMO_URL); };

        // =====================================================================
        // MIDDLE: TABS (1. Balloon | 2. Tail | 3. Appearance)
        // =====================================================================
        var tabs = win.add("tabbedpanel");
        tabs.alignment = ["fill", "fill"];

        // ---------------------------------------------------------------------
        // TAB 1: BALLOON (Geometry & Exterior Padding)
        // ---------------------------------------------------------------------
        var tabBalloon = tabs.add("tab", undefined, "Balloon");
        tabBalloon.orientation = "column";
        tabBalloon.alignChildren = ["fill", "top"];
        tabBalloon.spacing = 6;
        tabBalloon.margins = 8;

        var pnlGeom = tabBalloon.add("panel", undefined, "Balloon Geometry");
        pnlGeom.orientation = "column";
        pnlGeom.alignChildren = ["fill", "top"];
        pnlGeom.spacing = 6;
        pnlGeom.margins = [8, 10, 8, 8];

        var grpGeomRow = pnlGeom.add("group");
        grpGeomRow.orientation = "row";
        grpGeomRow.alignment = ["fill", "top"];
        grpGeomRow.spacing = 6;
        var lblGeom = grpGeomRow.add("statictext", undefined, "Shape:");
        lblGeom.preferredSize = [95, -1];
        var ddGeometry = grpGeomRow.add("dropdownlist", undefined, GEOMETRY_LABELS);
        ddGeometry.alignment = ["fill", "center"];
        ddGeometry.selection = 1;

        var ctrlCornerRadius = createSliderRow(pnlGeom, "Corner Radius:", 28, 0, 150, "px", refreshPreviewCanvas);
        var ctrlCloudPuffs   = createSliderRow(pnlGeom, "Cloud Puffs:", 12, 6, 26, "",   refreshPreviewCanvas);
        var ctrlCloudDepth   = createSliderRow(pnlGeom, "Puff Depth:", 18, 4, 50, "px",  refreshPreviewCanvas);
        var ctrlSpikeCount   = createSliderRow(pnlGeom, "Burst Spikes:", 18, 6, 36, "",  refreshPreviewCanvas);
        var ctrlSpikeDepth   = createSliderRow(pnlGeom, "Spike Length:", 28, 6, 80, "px", refreshPreviewCanvas);

        var pnlPadding = tabBalloon.add("panel", undefined, "Exterior Padding & Centering");
        pnlPadding.orientation = "column";
        pnlPadding.alignChildren = ["fill", "top"];
        pnlPadding.spacing = 6;
        pnlPadding.margins = [8, 10, 8, 8];

        var ctrlPadX = createSliderRow(pnlPadding, "Padding X:", 36, 0, 150, "px", refreshPreviewCanvas);
        var ctrlPadY = createSliderRow(pnlPadding, "Padding Y:", 26, 0, 150, "px", refreshPreviewCanvas);

        var lblAnchorNote = pnlPadding.add("statictext", undefined, "Anchor Points centered (H & V) with Balloon linked as child.");
        lblAnchorNote.helpTip = "Compatible with AE-replace-color-emojis, AE-advanced-text-wrap, and AE-Text-Highlight.";

        function syncBalloonShapeVisibility() {
            var idx = ddGeometry.selection ? ddGeometry.selection.index : 1;
            var key = GEOMETRY_KEYS[idx] || "rounded";
            ctrlCornerRadius.group.enabled = (key === "rounded");
            ctrlCloudPuffs.group.enabled   = (key === "cloud");
            ctrlCloudDepth.group.enabled   = (key === "cloud");
            ctrlSpikeCount.group.enabled   = (key === "explosion");
            ctrlSpikeDepth.group.enabled   = (key === "explosion");
            refreshPreviewCanvas();
        }
        ddGeometry.onChange = syncBalloonShapeVisibility;

        // ---------------------------------------------------------------------
        // TAB 2: TAIL (Style + Trim-Paths-Style Perimeter Dialog + Target)
        // ---------------------------------------------------------------------
        var tabTail = tabs.add("tab", undefined, "Tail");
        tabTail.orientation = "column";
        tabTail.alignChildren = ["fill", "top"];
        tabTail.spacing = 6;
        tabTail.margins = 8;

        var pnlTailStyle = tabTail.add("panel", undefined, "Tail Style");
        pnlTailStyle.orientation = "row";
        pnlTailStyle.alignChildren = ["left", "center"];
        pnlTailStyle.spacing = 6;
        pnlTailStyle.margins = [8, 10, 8, 8];

        var lblTailStyle = pnlTailStyle.add("statictext", undefined, "Tail Type:");
        lblTailStyle.preferredSize = [95, -1];
        var ddTailStyle = pnlTailStyle.add("dropdownlist", undefined, TAIL_LABELS);
        ddTailStyle.alignment = ["fill", "center"];
        ddTailStyle.selection = 2;

        // Trim-Paths-Style Perimeter Placement Panel
        var pnlTrim = tabTail.add("panel", undefined, "Perimeter Placement (Trim Paths Style)");
        pnlTrim.orientation = "column";
        pnlTrim.alignChildren = ["fill", "top"];
        pnlTrim.spacing = 5;
        pnlTrim.margins = [8, 10, 8, 8];

        // Interactive Perimeter Visualizer (works in both native AE ScriptUI & AE_JS_builder DOM)
        var grpPreviewWrap = pnlTrim.add("group");
        grpPreviewWrap.orientation = "row";
        grpPreviewWrap.alignment = ["fill", "top"];
        grpPreviewWrap.alignChildren = ["center", "center"];
        grpPreviewWrap.spacing = 8;

        var previewWidget = grpPreviewWrap.add("button", undefined, "");
        previewWidget.preferredSize = [136, 76];
        previewWidget.helpTip = "0% = Top, 25% = Right, 50% = Bottom, 75% = Left (Click to jump Offset around perimeter)";

        var grpQuickEdges = grpPreviewWrap.add("group");
        grpQuickEdges.orientation = "column";
        grpQuickEdges.spacing = 3;

        var qRow1 = grpQuickEdges.add("group"); qRow1.spacing = 3;
        var btnEdgeTop   = qRow1.add("button", undefined, "Top 0%");    btnEdgeTop.preferredSize   = [62, 20];
        var btnEdgeRight = qRow1.add("button", undefined, "Right 25%"); btnEdgeRight.preferredSize = [62, 20];

        var qRow2 = grpQuickEdges.add("group"); qRow2.spacing = 3;
        var btnEdgeBot   = qRow2.add("button", undefined, "Bot 50%");   btnEdgeBot.preferredSize   = [62, 20];
        var btnEdgeLeft  = qRow2.add("button", undefined, "Left 75%");  btnEdgeLeft.preferredSize  = [62, 20];

        var qRow3 = grpQuickEdges.add("group"); qRow3.spacing = 3;
        var btnEdgeBL    = qRow3.add("button", undefined, "Bot-L 56%"); btnEdgeBL.preferredSize    = [62, 20];
        var btnEdgeBR    = qRow3.add("button", undefined, "Bot-R 44%"); btnEdgeBR.preferredSize    = [62, 20];

        var ctrlTailStart  = createSliderRow(pnlTrim, "Start:",       52,   0, 100, "%", refreshPreviewCanvas);
        var ctrlTailEnd    = createSliderRow(pnlTrim, "End:",         60,   0, 100, "%", refreshPreviewCanvas);
        var ctrlTailOffset = createSliderRow(pnlTrim, "Offset:",       0, -180, 180, "°", refreshPreviewCanvas);

        var pnlTailTarget = tabTail.add("panel", undefined, "Tail Target Length & Slant");
        pnlTailTarget.orientation = "column";
        pnlTailTarget.alignChildren = ["fill", "top"];
        pnlTailTarget.spacing = 5;
        pnlTailTarget.margins = [8, 10, 8, 8];

        var ctrlTailLength = createSliderRow(pnlTailTarget, "Tail Length:", 85,  15, 350, "px", refreshPreviewCanvas);
        var ctrlTailAngle  = createSliderRow(pnlTailTarget, "Tip Slant:",   12, -70,  70, "°",  refreshPreviewCanvas);

        function snapPerimeterAt(centerPct) {
            var curStart = ctrlTailStart.getValue();
            var curEnd   = ctrlTailEnd.getValue();
            var curSpan  = Math.abs(curEnd - curStart);
            if (curSpan < 4 || curSpan > 40) curSpan = 8;
            var half = curSpan / 2;
            var s = ((centerPct - half) % 100 + 100) % 100;
            var e = ((centerPct + half) % 100 + 100) % 100;
            ctrlTailOffset.setValue(0, false);
            ctrlTailStart.setValue(Math.round(s), false);
            ctrlTailEnd.setValue(Math.round(e), true);
        }

        btnEdgeTop.onClick   = function () { snapPerimeterAt(0); };
        btnEdgeRight.onClick = function () { snapPerimeterAt(25); };
        btnEdgeBot.onClick   = function () { snapPerimeterAt(50); };
        btnEdgeLeft.onClick  = function () { snapPerimeterAt(75); };
        btnEdgeBL.onClick    = function () { snapPerimeterAt(56); };
        btnEdgeBR.onClick    = function () { snapPerimeterAt(44); };

        previewWidget.onClick = function () {
            // Cycle clockwise in 45° steps when clicked in native AE (or pointer handler in web demo)
            var nextOff = ctrlTailOffset.getValue() + 45;
            if (nextOff > 180) nextOff -= 360;
            ctrlTailOffset.setValue(nextOff, true);
        };

        function syncTailControlsVisibility() {
            var idx = ddTailStyle.selection ? ddTailStyle.selection.index : 0;
            var key = TAIL_KEYS[idx] || "none";
            var hasTail = (key !== "none");
            pnlTrim.enabled = hasTail;
            pnlTailTarget.enabled = hasTail;
            refreshPreviewCanvas();
        }
        ddTailStyle.onChange = syncTailControlsVisibility;

        // ---------------------------------------------------------------------
        // TAB 3: APPEARANCE (Fill, Stroke Style & Thickness, Colors)
        // ---------------------------------------------------------------------
        var tabAppearance = tabs.add("tab", undefined, "Appearance");
        tabAppearance.orientation = "column";
        tabAppearance.alignChildren = ["fill", "top"];
        tabAppearance.spacing = 6;
        tabAppearance.margins = 8;

        var pnlFill = tabAppearance.add("panel", undefined, "Fill");
        pnlFill.orientation = "column";
        pnlFill.alignChildren = ["fill", "top"];
        pnlFill.spacing = 5;
        pnlFill.margins = [8, 10, 8, 8];

        var chkFillEnabled = pnlFill.add("checkbox", undefined, "Enable Balloon Fill");
        chkFillEnabled.value = true;
        var cpFillColor = createColorPickerRow(pnlFill, "Fill Color:", "#FFFFFF", refreshPreviewCanvas);
        var ctrlFillOpacity = createSliderRow(pnlFill, "Fill Opacity:", 100, 0, 100, "%", refreshPreviewCanvas);

        chkFillEnabled.onClick = function () {
            cpFillColor.group.enabled = chkFillEnabled.value;
            ctrlFillOpacity.group.enabled = chkFillEnabled.value;
            refreshPreviewCanvas();
        };

        var pnlStroke = tabAppearance.add("panel", undefined, "Lines / Stroke Style & Color");
        pnlStroke.orientation = "column";
        pnlStroke.alignChildren = ["fill", "top"];
        pnlStroke.spacing = 5;
        pnlStroke.margins = [8, 10, 8, 8];

        var grpStrokeStyle = pnlStroke.add("group");
        grpStrokeStyle.orientation = "row";
        grpStrokeStyle.alignment = ["fill", "top"];
        grpStrokeStyle.spacing = 6;
        var lblStrokeStyle = grpStrokeStyle.add("statictext", undefined, "Stroke Style:");
        lblStrokeStyle.preferredSize = [86, -1];
        var ddStrokeStyle = grpStrokeStyle.add("dropdownlist", undefined, STROKE_LABELS);
        ddStrokeStyle.alignment = ["fill", "center"];
        ddStrokeStyle.selection = 1;

        var cpStrokeColor = createColorPickerRow(pnlStroke, "Stroke Color:", "#111111", refreshPreviewCanvas);

        var ctrlStrokeWidth    = createSliderRow(pnlStroke, "Thickness:",     5, 1, 40, "px", refreshPreviewCanvas);
        var ctrlStrokeMinWidth = createSliderRow(pnlStroke, "Min Thickness:", 2, 1, 30, "px", refreshPreviewCanvas);
        var ctrlStrokeMaxWidth = createSliderRow(pnlStroke, "Max Thickness:", 9, 1, 50, "px", refreshPreviewCanvas);
        var ctrlDotGap         = createSliderRow(pnlStroke, "Dot Spacing:",  12, 3, 50, "px", refreshPreviewCanvas);

        function syncStrokeControlsVisibility() {
            var idx = ddStrokeStyle.selection ? ddStrokeStyle.selection.index : 1;
            var key = STROKE_KEYS[idx] || "solid";
            var hasStroke = (key !== "none");
            cpStrokeColor.group.enabled    = hasStroke;
            ctrlStrokeWidth.group.enabled  = (key === "solid" || key === "dotted");
            ctrlStrokeMinWidth.group.enabled = (key === "variable");
            ctrlStrokeMaxWidth.group.enabled = (key === "variable");
            ctrlDotGap.group.enabled       = (key === "dotted");
            refreshPreviewCanvas();
        }
        ddStrokeStyle.onChange = syncStrokeControlsVisibility;

        tabs.selection = tabBalloon;

        // =====================================================================
        // BOTTOM: MAKE PRECOMP + BUILD / UPDATE / REMOVE
        // =====================================================================
        var pnlFooter = win.add("panel", undefined, "Output & Actions");
        pnlFooter.orientation = "column";
        pnlFooter.alignChildren = ["fill", "top"];
        pnlFooter.spacing = 6;
        pnlFooter.margins = [8, 10, 8, 8];

        var chkMakePrecomp = pnlFooter.add("checkbox", undefined, 'Make Precomp ("comic balloon ' + pendingHex + '")');
        chkMakePrecomp.value = true;
        chkMakePrecomp.helpTip = 'Precomposes the centered Text Layer + linked Balloon child into "comic balloon <HEX>" (Default: Yes).';

        var grpMainBtns = pnlFooter.add("group");
        grpMainBtns.orientation = "row";
        grpMainBtns.alignment = ["fill", "top"];
        grpMainBtns.spacing = 6;

        var btnBuildUpdate = grpMainBtns.add("button", undefined, "Build / Update Balloon");
        btnBuildUpdate.alignment = ["fill", "center"];
        btnBuildUpdate.preferredSize = [-1, 30];
        btnBuildUpdate.helpTip = "Creates a Comic Balloon from the selected Text Layer, or updates an existing Comic Balloon.";

        var btnRemove = grpMainBtns.add("button", undefined, "Remove Balloon");
        btnRemove.preferredSize = [120, 30];
        btnRemove.helpTip = "Removes the balloon/precomp and reverses the text box back to its exact original state.";

        var lblStatus = win.add("statictext", undefined, "Ready. Select a Text Layer and click Build / Update Balloon.");
        lblStatus.alignment = ["fill", "bottom"];

        // =====================================================================
        // UI <-> CONFIG READ / WRITE & LIVE TRIM-PERIMETER PREVIEW RENDERER
        // =====================================================================
        function collectUIConfig() {
            var gIdx = ddGeometry.selection ? ddGeometry.selection.index : 1;
            var tIdx = ddTailStyle.selection ? ddTailStyle.selection.index : 2;
            var sIdx = ddStrokeStyle.selection ? ddStrokeStyle.selection.index : 1;

            var minW = ctrlStrokeMinWidth.getValue();
            var maxW = ctrlStrokeMaxWidth.getValue();
            if (minW > maxW) {
                var swap = minW; minW = maxW; maxW = swap;
            }

            return {
                geometry: GEOMETRY_KEYS[gIdx] || "rounded",
                padX: ctrlPadX.getValue(),
                padY: ctrlPadY.getValue(),
                cornerRadius: ctrlCornerRadius.getValue(),
                cloudPuffs: Math.round(ctrlCloudPuffs.getValue()),
                cloudDepth: ctrlCloudDepth.getValue(),
                spikeCount: Math.round(ctrlSpikeCount.getValue()),
                spikeDepth: ctrlSpikeDepth.getValue(),
                tailStyle: TAIL_KEYS[tIdx] || "triangle",
                tailStart: ctrlTailStart.getValue(),
                tailEnd: ctrlTailEnd.getValue(),
                tailOffset: ctrlTailOffset.getValue(),
                tailLength: ctrlTailLength.getValue(),
                tailAngle: ctrlTailAngle.getValue(),
                fillEnabled: Boolean(chkFillEnabled.value),
                fillColor: cpFillColor.value || "#FFFFFF",
                fillOpacity: ctrlFillOpacity.getValue(),
                strokeStyle: STROKE_KEYS[sIdx] || "solid",
                strokeColor: cpStrokeColor.value || "#111111",
                strokeWidth: ctrlStrokeWidth.getValue(),
                strokeMinWidth: minW,
                strokeMaxWidth: maxW,
                dotGap: ctrlDotGap.getValue(),
                makePrecomp: Boolean(chkMakePrecomp.value)
            };
        }

        function indexOfKey(arr, key, fallback) {
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] === key) return i;
            }
            return fallback || 0;
        }

        function applyConfigToUI(rawCfg) {
            var c = normalizePresetData(rawCfg);
            ddGeometry.selection    = indexOfKey(GEOMETRY_KEYS, c.geometry, 1);
            ddTailStyle.selection   = indexOfKey(TAIL_KEYS, c.tailStyle, 2);
            ddStrokeStyle.selection = indexOfKey(STROKE_KEYS, c.strokeStyle, 1);

            ctrlPadX.setValue(c.padX, false);
            ctrlPadY.setValue(c.padY, false);
            ctrlCornerRadius.setValue(c.cornerRadius, false);
            ctrlCloudPuffs.setValue(c.cloudPuffs, false);
            ctrlCloudDepth.setValue(c.cloudDepth, false);
            ctrlSpikeCount.setValue(c.spikeCount, false);
            ctrlSpikeDepth.setValue(c.spikeDepth, false);

            ctrlTailStart.setValue(c.tailStart, false);
            ctrlTailEnd.setValue(c.tailEnd, false);
            ctrlTailOffset.setValue(c.tailOffset, false);
            ctrlTailLength.setValue(c.tailLength, false);
            ctrlTailAngle.setValue(c.tailAngle, false);

            chkFillEnabled.value = Boolean(c.fillEnabled);
            cpFillColor.setColor(c.fillColor, false);
            ctrlFillOpacity.setValue(c.fillOpacity, false);
            cpFillColor.group.enabled = chkFillEnabled.value;
            ctrlFillOpacity.group.enabled = chkFillEnabled.value;

            cpStrokeColor.setColor(c.strokeColor, false);
            ctrlStrokeWidth.setValue(c.strokeWidth, false);
            ctrlStrokeMinWidth.setValue(c.strokeMinWidth, false);
            ctrlStrokeMaxWidth.setValue(c.strokeMaxWidth, false);
            ctrlDotGap.setValue(c.dotGap, false);

            chkMakePrecomp.value = Boolean(c.makePrecomp);

            syncBalloonShapeVisibility();
            syncTailControlsVisibility();
            syncStrokeControlsVisibility();
            refreshPreviewCanvas();
        }

        // Custom-drawn Trim-Paths Perimeter Preview (ScriptUI Graphics + Web DOM SVG)
        previewWidget.onDraw = function () {
            try {
                var cfg = collectUIConfig();
                var w = this.size ? this.size[0] : 136;
                var h = this.size ? this.size[1] : 76;
                var g = this.graphics;
                var bgBrush = g.newBrush(g.BrushType.SOLID_COLOR, [0.14, 0.16, 0.20, 1]);
                g.newPath();
                g.rectPath(0, 0, w, h);
                g.fillPath(bgBrush);

                var previewSegs = buildBalloonPerimeterSegments(68, 28, {
                    geometry: cfg.geometry,
                    padX: 10,
                    padY: 8,
                    cornerRadius: Math.min(12, cfg.cornerRadius * 0.4),
                    cloudPuffs: cfg.cloudPuffs,
                    cloudDepth: 5,
                    spikeCount: Math.min(14, cfg.spikeCount),
                    spikeDepth: 7
                });

                var cx = w * 0.5;
                var cy = h * 0.46;
                var penDim = g.newPen(g.PenType.SOLID_COLOR, [0.55, 0.62, 0.72, 1], 1.5);
                g.newPath();
                for (var s = 0; s <= 48; s++) {
                    var pt = evaluatePerimeterAtU(previewSegs, s / 48).point;
                    if (s === 0) g.moveTo(cx + pt[0], cy + pt[1]);
                    else g.lineTo(cx + pt[0], cy + pt[1]);
                }
                g.strokePath(penDim);

                if (cfg.tailStyle !== "none") {
                    var off = (cfg.tailOffset || 0) / 360.0;
                    var u1 = (((cfg.tailStart / 100.0) + off) % 1 + 1) % 1;
                    var u2 = (((cfg.tailEnd / 100.0) + off) % 1 + 1) % 1;
                    var sp = ((u2 - u1) % 1 + 1) % 1;
                    if (sp > 0.5) { var t = u1; u1 = u2; u2 = t; sp = 1 - sp; }
                    if (sp < 0.03) sp = 0.03;

                    var penHi = g.newPen(g.PenType.SOLID_COLOR, [0.15, 0.82, 0.98, 1], 3);
                    g.newPath();
                    for (var k = 0; k <= 12; k++) {
                        var pArc = evaluatePerimeterAtU(previewSegs, u1 + sp * (k / 12)).point;
                        if (k === 0) g.moveTo(cx + pArc[0], cy + pArc[1]);
                        else g.lineTo(cx + pArc[0], cy + pArc[1]);
                    }
                    g.strokePath(penHi);

                    var mEv = evaluatePerimeterAtU(previewSegs, u1 + sp * 0.5);
                    var outA = Math.atan2(mEv.normal[1], mEv.normal[0]) + (cfg.tailAngle * Math.PI / 180);
                    var tipP = [cx + mEv.point[0] + 16 * Math.cos(outA), cy + mEv.point[1] + 16 * Math.sin(outA)];
                    var penTip = g.newPen(g.PenType.SOLID_COLOR, [1.0, 0.72, 0.15, 1], 2);
                    g.newPath();
                    g.moveTo(cx + mEv.point[0], cy + mEv.point[1]);
                    g.lineTo(tipP[0], tipP[1]);
                    g.strokePath(penTip);
                }
            } catch (eDraw) {}
        };

        function refreshPreviewCanvas() {
            if (!previewWidget) return;
            try { if (previewWidget.notify) previewWidget.notify("onDraw"); } catch (eN) {}

            // Rich interactive SVG preview inside AE_JS_builder Web Simulator
            if (previewWidget.domElement) {
                try {
                    var cfg = collectUIConfig();
                    var el = previewWidget.domElement;
                    el.style.padding = "0";
                    el.style.background = "#181c24";
                    el.style.border = "1px solid #334155";
                    el.style.borderRadius = "4px";
                    el.style.overflow = "hidden";
                    el.style.cursor = "crosshair";

                    var segs = buildBalloonPerimeterSegments(68, 28, {
                        geometry: cfg.geometry,
                        padX: 10,
                        padY: 8,
                        cornerRadius: Math.min(12, cfg.cornerRadius * 0.4),
                        cloudPuffs: cfg.cloudPuffs,
                        cloudDepth: 5,
                        spikeCount: Math.min(14, cfg.spikeCount),
                        spikeDepth: 7
                    });

                    var cx = 68, cy = 36;
                    var ptsAll = [];
                    var s;
                    for (s = 0; s <= 56; s++) {
                        var p = evaluatePerimeterAtU(segs, s / 56).point;
                        ptsAll.push((cx + p[0]).toFixed(1) + "," + (cy + p[1]).toFixed(1));
                    }

                    var hiSvg = "";
                    if (cfg.tailStyle !== "none") {
                        var off = (cfg.tailOffset || 0) / 360.0;
                        var u1 = (((cfg.tailStart / 100.0) + off) % 1 + 1) % 1;
                        var u2 = (((cfg.tailEnd / 100.0) + off) % 1 + 1) % 1;
                        var sp = ((u2 - u1) % 1 + 1) % 1;
                        if (sp > 0.5) { var tmp = u1; u1 = u2; u2 = tmp; sp = 1 - sp; }
                        if (sp < 0.03) sp = 0.03;

                        var arcPts = [];
                        for (s = 0; s <= 14; s++) {
                            var pa = evaluatePerimeterAtU(segs, u1 + sp * (s / 14)).point;
                            arcPts.push((cx + pa[0]).toFixed(1) + "," + (cy + pa[1]).toFixed(1));
                        }
                        var mEv = evaluatePerimeterAtU(segs, u1 + sp * 0.5);
                        var outA = Math.atan2(mEv.point[1], mEv.point[0]) + (cfg.tailAngle * Math.PI / 180);
                        var tx = (cx + mEv.point[0] + 15 * Math.cos(outA)).toFixed(1);
                        var ty = (cy + mEv.point[1] + 15 * Math.sin(outA)).toFixed(1);
                        var mx = (cx + mEv.point[0]).toFixed(1);
                        var my = (cy + mEv.point[1]).toFixed(1);

                        hiSvg =
                            '<polyline points="' + arcPts.join(" ") + '" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round"/>' +
                            '<line x1="' + mx + '" y1="' + my + '" x2="' + tx + '" y2="' + ty + '" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>' +
                            '<circle cx="' + tx + '" cy="' + ty + '" r="2.8" fill="#fbbf24"/>';
                    }

                    el.innerHTML =
                        '<svg width="136" height="76" viewBox="0 0 136 76" style="display:block;pointer-events:none;">' +
                        '<polygon points="' + ptsAll.join(" ") + '" fill="rgba(255,255,255,0.08)" stroke="#64748b" stroke-width="1.5"/>' +
                        hiSvg +
                        '</svg>';

                    if (!el._trimDragBound) {
                        el._trimDragBound = true;
                        var updateFromMouse = function (ev) {
                            var rect = el.getBoundingClientRect();
                            var dx = (ev.clientX - rect.left) - 68;
                            var dy = (ev.clientY - rect.top) - 36;
                            var angDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                            // Top-Center (-90 deg) corresponds to 0% perimeter
                            var pct = (((angDeg + 90) / 360) * 100 % 100 + 100) % 100;
                            snapPerimeterAt(pct);
                        };
                        el.onclick = null;
                        previewWidget.onClick = null;
                        el.addEventListener("pointerdown", function (ev) {
                            ev.preventDefault();
                            updateFromMouse(ev);
                            var onMove = function (me) { updateFromMouse(me); };
                            var onUp = function () {
                                document.removeEventListener("pointermove", onMove);
                                document.removeEventListener("pointerup", onUp);
                            };
                            document.addEventListener("pointermove", onMove);
                            document.addEventListener("pointerup", onUp);
                        });
                    }
                } catch (eDom) {}
            }
        }

        // =====================================================================
        // PRESET CRUD & JSON IMPORT / DOWNLOAD WIRING
        // =====================================================================
        var suppressPresetOnChange = false;

        function populatePresetDropdown(selectName) {
            suppressPresetOnChange = true;
            ddPreset.removeAll();
            var names = [];
            var targetIdx = 0;
            var idx = 0;
            for (var k in PRESETS) {
                if (PRESETS.hasOwnProperty(k)) {
                    ddPreset.add("item", k);
                    if (selectName && k === selectName) targetIdx = idx;
                    names.push(k);
                    idx++;
                }
            }
            if (names.length > 0) {
                ddPreset.selection = targetIdx;
            }
            suppressPresetOnChange = false;
            return names;
        }

        function getSelectedPresetName() {
            return ddPreset.selection ? ddPreset.selection.text : "";
        }

        ddPreset.onChange = function () {
            if (suppressPresetOnChange) return;
            var name = getSelectedPresetName();
            if (name && PRESETS[name]) {
                applyConfigToUI(PRESETS[name]);
                lblStatus.text = 'Loaded preset: "' + name + '"';
            }
        };

        // 1. STORE PRESET
        btnStorePreset.onClick = function () {
            var curName = getSelectedPresetName() || "My Comic Preset";
            var entered = (typeof prompt === "function") ? prompt("Store Preset Name:", curName) : curName;
            if (entered === null || entered === undefined) return;
            var cleanName = trimStr(entered);
            if (!cleanName) return;

            PRESETS[cleanName] = normalizePresetData(collectUIConfig());
            persistPresets();
            populatePresetDropdown(cleanName);
            lblStatus.text = 'Stored preset: "' + cleanName + '"';
        };

        // 2. RENAME PRESET
        btnRenamePreset.onClick = function () {
            var oldName = getSelectedPresetName();
            if (!oldName || !PRESETS[oldName]) return;
            var entered = (typeof prompt === "function") ? prompt('Rename Preset "' + oldName + '" to:', oldName) : null;
            if (entered === null || entered === undefined) return;
            var newName = trimStr(entered);
            if (!newName || newName === oldName) return;

            var rebuilt = {};
            for (var k in PRESETS) {
                if (PRESETS.hasOwnProperty(k)) {
                    if (k === oldName) rebuilt[newName] = PRESETS[oldName];
                    else rebuilt[k] = PRESETS[k];
                }
            }
            PRESETS = rebuilt;
            persistPresets();
            populatePresetDropdown(newName);
            lblStatus.text = 'Renamed preset to: "' + newName + '"';
        };

        // 3. DELETE PRESET
        btnDeletePreset.onClick = function () {
            var curName = getSelectedPresetName();
            if (!curName || !PRESETS[curName]) return;
            if (typeof confirm === "function") {
                if (!confirm('Delete preset "' + curName + '"?')) return;
            }
            delete PRESETS[curName];

            var remaining = 0;
            for (var k in PRESETS) { if (PRESETS.hasOwnProperty(k)) remaining++; }
            if (remaining === 0) {
                PRESETS = { "Classic Speech": getDefaultPresets()["Classic Speech"] };
            }

            persistPresets();
            var names = populatePresetDropdown();
            if (names.length > 0 && PRESETS[names[0]]) {
                applyConfigToUI(PRESETS[names[0]]);
            }
            lblStatus.text = 'Deleted preset: "' + curName + '"';
        };

        function ingestImportedPresetJson(rawJsonText, fallbackFileName) {
            var parsed = JSONSafe.parse(rawJsonText);
            if (!parsed || typeof parsed !== "object") {
                throw new Error("Invalid preset JSON content.");
            }

            var firstImported = "";
            if (parsed.presets && typeof parsed.presets === "object") {
                for (var pk in parsed.presets) {
                    if (parsed.presets.hasOwnProperty(pk)) {
                        PRESETS[pk] = normalizePresetData(parsed.presets[pk]);
                        if (!firstImported) firstImported = pk;
                    }
                }
            } else if (parsed.preset && typeof parsed.preset === "object") {
                var singleName = trimStr(parsed.name) || fallbackFileName || "Imported Preset";
                PRESETS[singleName] = normalizePresetData(parsed.preset);
                firstImported = singleName;
            } else if (parsed.geometry || parsed.tailStyle || parsed.strokeStyle) {
                var directName = trimStr(parsed.name) || fallbackFileName || "Imported Preset";
                PRESETS[directName] = normalizePresetData(parsed);
                firstImported = directName;
            } else {
                for (var mk in parsed) {
                    if (parsed.hasOwnProperty(mk) && parsed[mk] && typeof parsed[mk] === "object") {
                        PRESETS[mk] = normalizePresetData(parsed[mk]);
                        if (!firstImported) firstImported = mk;
                    }
                }
            }

            if (!firstImported) throw new Error("No valid preset entries found in JSON.");
            persistPresets();
            populatePresetDropdown(firstImported);
            applyConfigToUI(PRESETS[firstImported]);
            lblStatus.text = 'Opened preset: "' + firstImported + '"';
        }

        // 4. OPEN PRESET (.json)
        btnOpenPreset.onClick = function () {
            // Web Simulator (AE_JS_builder): HTML5 File Picker
            if (typeof document !== "undefined" && typeof document.createElement === "function" && typeof FileReader !== "undefined") {
                var fileIn = document.createElement("input");
                fileIn.type = "file";
                fileIn.accept = ".json,application/json";
                fileIn.style.display = "none";
                document.body.appendChild(fileIn);
                fileIn.addEventListener("change", function () {
                    var f = fileIn.files && fileIn.files[0];
                    if (f) {
                        var reader = new FileReader();
                        reader.onload = function (ev) {
                            try {
                                var baseN = String(f.name || "Imported").replace(/\.json$/i, "");
                                ingestImportedPresetJson(String(ev.target.result || ""), baseN);
                            } catch (err) {
                                lblStatus.text = "Error opening preset: " + err.message;
                            }
                        };
                        reader.readAsText(f);
                    }
                    if (fileIn.parentNode) fileIn.parentNode.removeChild(fileIn);
                });
                fileIn.click();
                return;
            }

            // Native After Effects: File.openDialog
            if (typeof File !== "undefined" && typeof File.openDialog === "function") {
                var selFile = File.openDialog("Open Comic Balloon Preset (.json)", "*.json");
                if (!selFile) return;
                try {
                    selFile.encoding = "UTF-8";
                    if (selFile.open("r")) {
                        var txt = selFile.read();
                        selFile.close();
                        var fBase = decodeURI(selFile.name || "Imported").replace(/\.json$/i, "");
                        ingestImportedPresetJson(txt, fBase);
                    }
                } catch (eOpen) {
                    lblStatus.text = "Error opening JSON: " + eOpen.message;
                }
            }
        };

        // 5. DOWNLOAD PRESET (.json)
        btnDownloadPreset.onClick = function () {
            var curName = getSelectedPresetName() || "Comic_Balloon_Preset";
            var curData = collectUIConfig();
            var exportObj = {
                name: curName,
                generator: SCRIPT_NAME + " " + SCRIPT_VERSION,
                preset: normalizePresetData(curData)
            };
            var jsonOut = JSONSafe.stringify(exportObj, true);
            var safeFile = curName.replace(/[^A-Za-z0-9_\-]+/g, "_") + ".json";

            // Web Simulator (AE_JS_builder): Instant Browser File Download
            if (typeof document !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined" && URL.createObjectURL) {
                try {
                    var blob = new Blob([jsonOut], { type: "application/json;charset=utf-8" });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement("a");
                    a.href = url;
                    a.download = safeFile;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                    lblStatus.text = 'Downloaded preset JSON: "' + safeFile + '"';
                    return;
                } catch (eBlob) {}
            }

            // Native After Effects: File.saveDialog (fallback to Desktop)
            if (typeof File !== "undefined") {
                var outFile = null;
                if (typeof File.saveDialog === "function") {
                    outFile = File.saveDialog("Download / Save Comic Balloon Preset (.json)", "*.json");
                }
                if (!outFile && typeof Folder !== "undefined" && Folder.desktop) {
                    outFile = new File(Folder.desktop.fsName + "/" + safeFile);
                }
                if (!outFile) return;
                if (!/\.json$/i.test(outFile.fsName)) {
                    outFile = new File(outFile.fsName + ".json");
                }
                try {
                    outFile.encoding = "UTF-8";
                    if (outFile.open("w")) {
                        outFile.write(jsonOut);
                        outFile.close();
                        lblStatus.text = "Saved preset to: " + outFile.name;
                    }
                } catch (eSave) {
                    lblStatus.text = "Error saving JSON: " + eSave.message;
                }
            }
        };

        // =====================================================================
        // TARGET DETECTION & ACTION BUTTON HANDLERS
        // =====================================================================
        function syncTargetStatus(loadExistingConfig) {
            var ctx = resolveTargetContext(false);
            if (!ctx) {
                lblTargetLayer.text = "Target: No active composition.";
                return;
            }
            if (ctx.mode === "precomp") {
                var envP = readLayerStateEffect(ctx.precompLayer) || readLayerStateEffect(ctx.textLayer);
                var hexP = (envP && envP.precompHex) ? envP.precompHex : pendingHex;
                pendingHex = hexP;
                chkMakePrecomp.text = 'Make Precomp ("comic balloon ' + pendingHex + '")';
                lblTargetLayer.text = 'Target: "' + ctx.precompLayer.name + '" (Active Balloon Precomp)';
                btnBuildUpdate.text = "Update Comic Balloon";
                if (loadExistingConfig && envP && envP.config) {
                    applyConfigToUI(envP.config);
                }
            } else if (ctx.mode === "text") {
                var envT = readLayerStateEffect(ctx.textLayer);
                if (envT && envT.precompHex) pendingHex = envT.precompHex;
                chkMakePrecomp.text = 'Make Precomp ("comic balloon ' + pendingHex + '")';
                if (ctx.balloonLayer || envT) {
                    lblTargetLayer.text = 'Target: "' + ctx.textLayer.name + '" (Balloon Linked)';
                    btnBuildUpdate.text = "Update Comic Balloon";
                    if (loadExistingConfig && envT && envT.config) {
                        applyConfigToUI(envT.config);
                    }
                } else {
                    lblTargetLayer.text = 'Target: "' + ctx.textLayer.name + '" (Text Layer)';
                    btnBuildUpdate.text = "Build / Update Balloon";
                }
            } else {
                chkMakePrecomp.text = 'Make Precomp ("comic balloon ' + pendingHex + '")';
                lblTargetLayer.text = "Target: Select a Text Layer in Comp.";
                btnBuildUpdate.text = "Build / Update Balloon";
            }
        }

        btnRefresh.onClick = function () {
            syncTargetStatus(true);
            lblStatus.text = "Refreshed active layer selection.";
        };

        btnBuildUpdate.onClick = function () {
            var cfg = collectUIConfig();
            var appRef = (typeof app !== "undefined") ? app : globalObj.app;
            if (appRef && typeof appRef.beginUndoGroup === "function") {
                appRef.beginUndoGroup(SCRIPT_NAME + ": Build / Update");
            }
            try {
                var res = executeBuildOrUpdate(cfg, pendingHex);
                pendingHex = generateHexId(4);
                syncTargetStatus(false);
                if (res.mode === "precomp") {
                    lblStatus.text = (res.isUpdate ? "Updated: " : "Built: ") + '"' + res.precompName + '"';
                } else {
                    lblStatus.text = (res.isUpdate ? "Updated" : "Built") + " Comic Balloon (linked child of Text).";
                }
            } catch (err) {
                lblStatus.text = "Error: " + err.message;
            } finally {
                if (appRef && typeof appRef.endUndoGroup === "function") {
                    appRef.endUndoGroup();
                }
            }
        };

        btnRemove.onClick = function () {
            var appRef = (typeof app !== "undefined") ? app : globalObj.app;
            if (appRef && typeof appRef.beginUndoGroup === "function") {
                appRef.beginUndoGroup(SCRIPT_NAME + ": Remove & Revert");
            }
            try {
                executeRemoveAndReverse();
                pendingHex = generateHexId(4);
                syncTargetStatus(false);
                lblStatus.text = "Removed balloon and restored original text layer.";
            } catch (err) {
                lblStatus.text = "Revert: " + err.message;
            } finally {
                if (appRef && typeof appRef.endUndoGroup === "function") {
                    appRef.endUndoGroup();
                }
            }
        };

        // Initialize Presets & UI State
        var initNames = populatePresetDropdown("Classic Speech");
        if (initNames.length > 0) {
            var firstKey = PRESETS["Classic Speech"] ? "Classic Speech" : initNames[0];
            applyConfigToUI(PRESETS[firstKey]);
        }
        syncTargetStatus(true);

        win.onResizing = win.onResize = function () {
            if (this.layout) this.layout.resize();
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        } else if (win.layout) {
            win.layout.layout(true);
        }
        setTimeoutSafe(refreshPreviewCanvas);

        return win;
    }

    function setTimeoutSafe(fn) {
        if (typeof setTimeout === "function") {
            setTimeout(fn, 30);
        } else {
            try { fn(); } catch (e) {}
        }
    }

    buildUI(thisObj);

})(this);
