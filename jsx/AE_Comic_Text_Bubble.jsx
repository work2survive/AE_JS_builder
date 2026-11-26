// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE COMIC TEXT BUBBLE v2.1.0
// =============================================================================
//
// PURPOSE:
//   Ground-up parametric Comic Balloon generator for Adobe After Effects.
//   Transforms any existing Point Text or Paragraph (Box) Text layer into a
//   stylized comic speech, thought, whisper, or shout balloon with optional
//   parametric In / Out animations and expression-ready timing telemetry.
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
//   5. Arc-Length Geometry & Trim-Paths Tail Perimeter Targeting:
//      - Constant-width or width-randomized Cloud Puffs & Explosion Spikes
//        with depth relative (%) to each individual puff/spike width.
//      - Perimeter Position (%), Tail Start Width (0.1 - 4.0), and Offset (deg).
//   6. In / Out Animation Engine & Custom Expression Telemetry:
//      - Styles: Clementine (Trim from Tail), Bloat (Horizontal Expand Mask),
//        and Sparse Dotted to Solid — all paired with AE Opacity Typewriter.
//      - Auto Read-Time linked to character count (seconds per 25 characters).
//      - Exposes "Bubble Status" (0=waiting, 1=start, 2=in, 3=reading, 4=out, 5=end)
//        and In / Reading / Out timing controls in Effects for custom expressions.
//   7. Non-Destructive Effect State Backup & Full Reversal:
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
    var SCRIPT_VERSION = "v2.1.0";
    var REPO_URL       = "https://github.com/work2survive/AE-comic-text-bubble";
    var LIVE_DEMO_URL  = "https://work2survive.github.io/AE_JS_builder/?jsx=AE_Comic_Text_Bubble.jsx&autobuild=true";

    var BALLOON_LAYER_TAG  = "AE_COMIC_BALLOON_SHAPE";
    var BALLOON_LAYER_NAME = "Comic Balloon";
    var STATE_EFFECT_NAME  = "Comic Balloon State";
    var PRESETS_STORAGE_KEY = "AE_COMIC_BALLOON_PRESETS_V2";
    var PRESETS_FOLDER_NAME = "comic_balloon_presets";
    var PRESETS_FILE_NAME   = "presets.json";

    var TYPEWRITER_ANIMATOR_NAME = "Comic Typewriter Animator";
    var BLOAT_MASK_NAME          = "Comic Bloat Mask";
    var TIMING_EFFECT_NAMES = [
        "Bubble Start Delay (s)",
        "Bubble In Time (s)",
        "Bubble Link Read Time",
        "Bubble Sec Per 25 Chars",
        "Bubble Read Time (s)",
        "Bubble Out Time (s)",
        "Bubble Status",
        "Bubble In Timing",
        "Bubble Reading Timing",
        "Bubble Out Timing",
        "Bubble Envelope"
    ];

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

    var ANIM_KEYS       = ["none", "clementine", "bloat", "sparse_dots"];
    var ANIM_LABELS     = [
        "None (Static)",
        "1. Clementine (Trim from Tail)",
        "2. Bloat (Horizontal Expand Mask)",
        "3. Sparse Dotted to Solid"
    ];

    function getDefaultPresets() {
        return {
            "Classic Speech": {
                geometry: "rounded",
                padX: 36,
                padY: 26,
                cornerRadius: 28,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                tailStyle: "triangle",
                tailPosition: 56,
                tailStartWidth: 2.5,
                tailStart: 54.75,
                tailEnd: 57.25,
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
                animStyle: "none",
                startDelay: 0,
                inTime: 0.6,
                readTime: 2.0,
                linkReadTime: true,
                secPer25: 1.2,
                outTime: 0.5,
                makePrecomp: true
            },
            "Comic Ink Box": {
                geometry: "square",
                padX: 34,
                padY: 24,
                cornerRadius: 0,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                tailStyle: "triangle",
                tailPosition: 49,
                tailStartWidth: 2.4,
                tailStart: 47.8,
                tailEnd: 50.2,
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
                animStyle: "none",
                startDelay: 0,
                inTime: 0.6,
                readTime: 2.0,
                linkReadTime: true,
                secPer25: 1.2,
                outTime: 0.5,
                makePrecomp: true
            },
            "Thought Cloud": {
                geometry: "cloud",
                padX: 40,
                padY: 30,
                cornerRadius: 28,
                cloudPuffs: 12,
                cloudDepth: 44,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                tailStyle: "clouds",
                tailPosition: 57,
                tailStartWidth: 2.0,
                tailStart: 56.0,
                tailEnd: 58.0,
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
                animStyle: "none",
                startDelay: 0,
                inTime: 0.6,
                readTime: 2.0,
                linkReadTime: true,
                secPer25: 1.2,
                outTime: 0.5,
                makePrecomp: true
            },
            "Explosion Shout!": {
                geometry: "explosion",
                padX: 42,
                padY: 32,
                cornerRadius: 0,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 90,
                spikeWidthRand: 0,
                tailStyle: "lightning",
                tailPosition: 56,
                tailStartWidth: 3.2,
                tailStart: 54.4,
                tailEnd: 57.6,
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
                animStyle: "none",
                startDelay: 0,
                inTime: 0.5,
                readTime: 2.0,
                linkReadTime: true,
                secPer25: 1.1,
                outTime: 0.4,
                makePrecomp: true
            },
            "Whisper Dotted": {
                geometry: "rounded",
                padX: 36,
                padY: 26,
                cornerRadius: 36,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                tailStyle: "line",
                tailPosition: 55,
                tailStartWidth: 1.5,
                tailStart: 54.25,
                tailEnd: 55.75,
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
                animStyle: "none",
                startDelay: 0,
                inTime: 0.7,
                readTime: 2.0,
                linkReadTime: true,
                secPer25: 1.3,
                outTime: 0.6,
                makePrecomp: true
            },
            "Electric Radio": {
                geometry: "rounded",
                padX: 34,
                padY: 24,
                cornerRadius: 12,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                tailStyle: "lightning",
                tailPosition: 54,
                tailStartWidth: 2.8,
                tailStart: 52.6,
                tailEnd: 55.4,
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
                animStyle: "none",
                startDelay: 0,
                inTime: 0.6,
                readTime: 2.0,
                linkReadTime: true,
                secPer25: 1.2,
                outTime: 0.5,
                makePrecomp: true
            }
        };
    }

    function normalizePresetData(raw) {
        var def = getDefaultPresets()["Classic Speech"];
        if (!raw || typeof raw !== "object") return cloneObject(def);

        var tPos = def.tailPosition;
        var tWidth = def.tailStartWidth;

        if (raw.tailPosition !== undefined && raw.tailPosition !== null) {
            tPos = clampNum(raw.tailPosition, 0, 100, def.tailPosition);
        } else if (raw.tailStart !== undefined && raw.tailEnd !== undefined) {
            var s0 = ((parseFloat(raw.tailStart) || 0) % 100 + 100) % 100;
            var e0 = ((parseFloat(raw.tailEnd) || 0) % 100 + 100) % 100;
            var sp0 = ((e0 - s0) % 100 + 100) % 100;
            if (sp0 > 50) {
                var tmp0 = s0; s0 = e0; e0 = tmp0;
                sp0 = 100 - sp0;
            }
            tPos = (s0 + sp0 * 0.5) % 100;
            if (raw.tailStartWidth === undefined) {
                tWidth = sp0;
            }
        }

        if (raw.tailStartWidth !== undefined && raw.tailStartWidth !== null) {
            tWidth = raw.tailStartWidth;
        }

        tPos   = Math.round(clampNum(tPos, 0, 100, def.tailPosition) * 10) / 10;
        tWidth = Math.round(clampNum(tWidth, 0.1, 4.0, def.tailStartWidth) * 10) / 10;

        var halfW = tWidth * 0.5;
        var computedStart = ((tPos - halfW) % 100 + 100) % 100;
        var computedEnd   = ((tPos + halfW) % 100 + 100) % 100;

        var rawCloudD = raw.cloudDepth;
        var rawSpikeD = raw.spikeDepth;
        // Seamless upgrade from v2.0 pixel depths when width randomizer fields were absent
        if (raw.cloudWidthRand === undefined && typeof rawCloudD === "number" && rawCloudD <= 25) {
            rawCloudD = Math.round(rawCloudD * 2.3);
        }
        if (raw.spikeWidthRand === undefined && typeof rawSpikeD === "number" && rawSpikeD <= 40) {
            rawSpikeD = Math.round(rawSpikeD * 3.0);
        }

        var aStyle = def.animStyle;
        if (raw.animStyle === "none" || raw.animStyle === "clementine" || raw.animStyle === "bloat" || raw.animStyle === "sparse_dots") {
            aStyle = raw.animStyle;
        }

        return {
            geometry: (raw.geometry === "square" || raw.geometry === "rounded" || raw.geometry === "cloud" || raw.geometry === "explosion") ? raw.geometry : def.geometry,
            padX: clampNum(raw.padX, 0, 200, def.padX),
            padY: clampNum(raw.padY, 0, 200, def.padY),
            cornerRadius: clampNum(raw.cornerRadius, 0, 200, def.cornerRadius),
            cloudPuffs: Math.round(clampNum(raw.cloudPuffs, 6, 30, def.cloudPuffs)),
            cloudDepth: Math.round(clampNum(rawCloudD, 10, 120, def.cloudDepth)),
            cloudWidthRand: Math.round(clampNum(raw.cloudWidthRand, 0, 100, 0)),
            spikeCount: Math.round(clampNum(raw.spikeCount, 6, 40, def.spikeCount)),
            spikeDepth: Math.round(clampNum(rawSpikeD, 15, 220, def.spikeDepth)),
            spikeWidthRand: Math.round(clampNum(raw.spikeWidthRand, 0, 100, 0)),
            tailStyle: (raw.tailStyle === "none" || raw.tailStyle === "line" || raw.tailStyle === "triangle" || raw.tailStyle === "lightning" || raw.tailStyle === "clouds") ? raw.tailStyle : def.tailStyle,
            tailPosition: tPos,
            tailStartWidth: tWidth,
            tailStart: computedStart,
            tailEnd: computedEnd,
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
            animStyle: aStyle,
            startDelay: Math.round(clampNum(raw.startDelay, 0, 30, def.startDelay) * 10) / 10,
            inTime: Math.round(clampNum(raw.inTime, 0.1, 10, def.inTime) * 10) / 10,
            readTime: Math.round(clampNum(raw.readTime, 0.2, 60, def.readTime) * 10) / 10,
            linkReadTime: (raw.linkReadTime !== undefined) ? Boolean(raw.linkReadTime) : true,
            secPer25: Math.round(clampNum(raw.secPer25, 0.2, 10, def.secPer25) * 10) / 10,
            outTime: Math.round(clampNum(raw.outTime, 0.1, 10, def.outTime) * 10) / 10,
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

    function cleanupTextAnimationArtifacts(textLayer, balloonLayer) {
        if (!textLayer) return;

        // 1. Remove Comic Typewriter Animator from Text Layer
        try {
            var textProps = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
            if (textProps) {
                var animators = textProps.property("ADBE Text Animators") || textProps.property("Animators");
                if (animators) {
                    var aCnt = (typeof animators.numProperties === "number")
                        ? animators.numProperties
                        : (animators.properties ? animators.properties.length : 0);
                    for (var ai = aCnt; ai >= 1; ai--) {
                        var anim = animators.property(ai);
                        if (anim && anim.name === TYPEWRITER_ANIMATOR_NAME && typeof anim.remove === "function") {
                            try { anim.remove(); } catch (eRA) {}
                        }
                    }
                }
            }
        } catch (eTAnim) {}

        // 2. Clear Alpha Track Matte from Text Layer & re-enable Balloon visibility
        try {
            var noMatte = (typeof TrackMatteType !== "undefined" && TrackMatteType.NO_TRACK_MATTE !== undefined)
                ? TrackMatteType.NO_TRACK_MATTE
                : 5012;
            if (typeof textLayer.setTrackMatte === "function") {
                textLayer.setTrackMatte(null, noMatte);
            } else if (textLayer.trackMatteType !== undefined && typeof TrackMatteType !== "undefined") {
                textLayer.trackMatteType = noMatte;
            }
        } catch (eTM) {}

        if (balloonLayer) {
            try { balloonLayer.enabled = true; } catch (eBE) {}
        }

        // 3. Remove fallback Bloat Mask from Text Layer if present
        try {
            var masks = textLayer.property("ADBE Mask Parade") || textLayer.property("Masks");
            if (masks) {
                var mProp = masks.property(BLOAT_MASK_NAME);
                if (mProp && typeof mProp.remove === "function") {
                    mProp.remove();
                }
            }
        } catch (eMsk) {}
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
            ].concat(TIMING_EFFECT_NAMES);
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

        cleanupTextAnimationArtifacts(textLayer, null);

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
     * Builds a smooth 72-segment arc-length-annotated base superellipse starting
     * clockwise at Top-Center (0, -B) so u in [0, 1) divides true perimeter length.
     */
    function buildSmoothBasePerimeter(A, B, nExp) {
        var steps = 72;
        var raw = [];
        var i;
        for (i = 0; i < steps; i++) {
            var a0 = -Math.PI / 2 + (2 * Math.PI * i) / steps;
            var a1 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / steps;
            raw.push({
                p0: superellipsePoint(a0, A, B, nExp),
                out0: [0, 0],
                in1: [0, 0],
                p1: superellipsePoint(a1, A, B, nExp)
            });
        }
        return annotateArcLengths(raw);
    }

    /**
     * Divides the closed `baseSegs` perimeter into `count` intervals:
     *   - When randPct == 0: exact constant visual chord width across every puff/spike.
     *   - When randPct > 0: deterministic randomized widths preserving exact `count`.
     */
    function computePerimeterIntervals(baseSegs, count, randPct, salt) {
        var r = clampNum(randPct, 0, 100, 0) / 100.0;
        var weights = [];
        var sumW = 0;
        var i, iter;
        for (i = 0; i < count; i++) {
            var w = 1.0;
            if (r > 1e-4) {
                var seed = Math.sin((i + 1) * 12.9898 + count * 78.233 + (salt || 0)) * 43758.5453;
                var frac = seed - Math.floor(seed); // [0, 1)
                var signed = frac * 2.0 - 1.0;      // [-1, 1)
                w = Math.max(0.18, 1.0 + 0.80 * r * signed);
            }
            weights.push(w);
            sumW += w;
        }
        var du = [];
        for (i = 0; i < count; i++) {
            du.push(weights[i] / (sumW || count));
        }

        // Equalize true chord widths around tight corners in 5 fast passes
        if (baseSegs && baseSegs.length > 0) {
            for (iter = 0; iter < 5; iter++) {
                var uTmp = [0];
                var accTmp = 0;
                for (i = 0; i < count; i++) {
                    accTmp += du[i];
                    uTmp.push(i === count - 1 ? 1.0 : accTmp);
                }
                var ptsTmp = [];
                for (i = 0; i < count; i++) {
                    ptsTmp.push(evaluatePerimeterAtU(baseSegs, uTmp[i]).point);
                }
                var nextDu = [];
                var sumNext = 0;
                for (i = 0; i < count; i++) {
                    var chord = dist2D(ptsTmp[i], ptsTmp[(i + 1) % count]);
                    var corr = du[i] * (weights[i] / Math.max(1e-3, chord));
                    nextDu.push(corr);
                    sumNext += corr;
                }
                if (sumNext > 1e-6) {
                    for (i = 0; i < count; i++) {
                        du[i] = nextDu[i] / sumNext;
                    }
                }
            }
        }

        var uBounds = [0];
        var acc = 0;
        for (i = 0; i < count; i++) {
            acc += du[i];
            uBounds.push(i === count - 1 ? 1.0 : acc);
        }
        return uBounds;
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

        var baseSegs = buildSmoothBasePerimeter(A, B, nExp);

        if (geom === "cloud") {
            var puffs = Math.max(6, Math.min(30, Math.round(cfg.cloudPuffs || 12)));
            var depthPct = clampNum(cfg.cloudDepth, 10, 120, 42);
            var puffRand = clampNum(cfg.cloudWidthRand, 0, 100, 0);
            var uPuffs = computePerimeterIntervals(baseSegs, puffs, puffRand, 17.3);
            var cusps = [];
            var ci;
            for (ci = 0; ci < puffs; ci++) {
                cusps.push(evaluatePerimeterAtU(baseSegs, uPuffs[ci]).point);
            }
            for (ci = 0; ci < puffs; ci++) {
                var c0 = cusps[ci];
                var c1 = cusps[(ci + 1) % puffs];
                var ex = c1[0] - c0[0];
                var ey = c1[1] - c0[1];
                var puffWidth = Math.sqrt(ex * ex + ey * ey) || 1;
                var nx = ey / puffWidth;
                var ny = -ex / puffWidth;
                // Puff depth is strictly relative to each particular puff's width
                var lobeD = puffWidth * (depthPct / 100.0);
                segs.push({
                    p0: c0,
                    out0: [ex * 0.18 + nx * lobeD * 1.33, ey * 0.18 + ny * lobeD * 1.33],
                    in1: [-ex * 0.18 + nx * lobeD * 1.33, -ey * 0.18 + ny * lobeD * 1.33],
                    p1: c1
                });
            }
            return annotateArcLengths(segs);
        }

        // Explosion / Shout (true arc-length division + optional width randomizer + width-relative spike depth)
        var spikes = Math.max(6, Math.min(40, Math.round(cfg.spikeCount || 18)));
        var sDepthPct = clampNum(cfg.spikeDepth, 15, 220, 85);
        var spikeRand = clampNum(cfg.spikeWidthRand, 0, 100, 0);
        var uSpikes = computePerimeterIntervals(baseSegs, spikes, spikeRand, 53.7);
        var valleys = [];
        var si;
        for (si = 0; si < spikes; si++) {
            valleys.push(evaluatePerimeterAtU(baseSegs, uSpikes[si]).point);
        }
        for (si = 0; si < spikes; si++) {
            var v0 = valleys[si];
            var v1 = valleys[(si + 1) % spikes];
            var sx = v1[0] - v0[0];
            var sy = v1[1] - v0[1];
            var spikeWidth = Math.sqrt(sx * sx + sy * sy) || 1;
            var cnx = sy / spikeWidth;
            var cny = -sx / spikeWidth;

            var midU = (uSpikes[si] + uSpikes[si + 1]) * 0.5;
            var midPt = evaluatePerimeterAtU(baseSegs, midU).point;
            var rMag = Math.sqrt(midPt[0] * midPt[0] + midPt[1] * midPt[1]) || 1;
            var rnx = midPt[0] / rMag;
            var rny = midPt[1] / rMag;

            var onx = cnx * 0.65 + rnx * 0.35;
            var ony = cny * 0.65 + rny * 0.35;
            var oMag = Math.sqrt(onx * onx + ony * ony) || 1;
            onx /= oMag;
            ony /= oMag;

            // Spike depth is strictly relative to each particular spike's base width
            var spikeH = spikeWidth * (sDepthPct / 100.0);
            var tipPt = [midPt[0] + onx * spikeH, midPt[1] + ony * spikeH];

            segs.push({ p0: v0,    out0: [0, 0], in1: [0, 0], p1: tipPt });
            segs.push({ p0: tipPt, out0: [0, 0], in1: [0, 0], p1: v1 });
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

        var startPct = cfg.tailStart;
        var endPct   = cfg.tailEnd;
        if (cfg.tailPosition !== undefined && cfg.tailStartWidth !== undefined) {
            var posP = clampNum(cfg.tailPosition, 0, 100, 56);
            var widP = clampNum(cfg.tailStartWidth, 0.1, 4.0, 2.5);
            startPct = ((posP - widP * 0.5) % 100 + 100) % 100;
            endPct   = ((posP + widP * 0.5) % 100 + 100) % 100;
        }

        var offFrac = (cfg.tailOffset || 0) / 360.0;
        var uA = (((startPct / 100.0) + offFrac) % 1 + 1) % 1;
        var uB = (((endPct / 100.0) + offFrac) % 1 + 1) % 1;
        var span = ((uB - uA) % 1 + 1) % 1;

        // Always take the minor perimeter arc so the tail base never swallows the balloon
        if (span > 0.5) {
            var tmp = uA; uA = uB; uB = tmp;
            span = 1.0 - span;
        }
        var uMid = (uA + span * 0.5) % 1;

        if (tailStyle === "triangle" || tailStyle === "lightning") {
            if (span < 0.001) {
                span = 0.001;
                uA = ((uMid - span * 0.5) % 1 + 1) % 1;
                uB = (uMid + span * 0.5) % 1;
            } else if (span > 0.04) {
                span = 0.04;
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
                    var w0 = Math.max(1.5, bDist * 0.5);
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

            var useRoundJoin = (cfg.geometry === "rounded" || cfg.geometry === "cloud" || effStrokeStyle === "dotted" || cfg.animStyle === "sparse_dots");
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

            // Style 3 ("sparse_dots"): ensure Dash 1 & Gap 1 exist on non-dotted strokes too so they animate from sparse dots -> solid
            if (cfg.animStyle === "sparse_dots" && effStrokeStyle !== "dotted") {
                try {
                    var dashesAnim = strokeProp.dashes || strokeProp.property("ADBE Vector Stroke Dashes") || strokeProp.property("Dashes");
                    if (dashesAnim && typeof dashesAnim.addProperty === "function") {
                        var da1 = dashesAnim.property("ADBE Vector Stroke Dash 1") || dashesAnim.addProperty("ADBE Vector Stroke Dash 1");
                        if (da1) da1.setValue(180);
                        var ga1 = dashesAnim.property("ADBE Vector Stroke Gap 1") || dashesAnim.addProperty("ADBE Vector Stroke Gap 1");
                        if (ga1) ga1.setValue(0);
                    }
                } catch (eDashA) {}
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
        try { balloonLayer.enabled = true; } catch (eEn) {}

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
    // 7B. Timing & Status Telemetry Effects + In / Out Animation Engine
    //     Styles:
    //       1. "clementine": Typewriter + Stroke Trim from Tail Tip + Fill Fade
    //       2. "bloat":      Typewriter + Horizontal Width Expand Mask + Stroke Width 0->Max + Fill 100%
    //       3. "sparse_dots":Typewriter + Sparse Dotted Line -> Solid Stroke + Fill Fade
    // -------------------------------------------------------------------------
    function countReadableChars(textLayer) {
        var doc = getTextDocumentSafe(textLayer);
        var txt = "";
        if (doc && typeof doc === "object" && doc.text !== undefined) {
            txt = String(doc.text);
        } else if (typeof doc === "string") {
            txt = doc;
        }
        var flat = txt.replace(/[\r\n]+/g, "");
        return flat.length > 0 ? flat.length : 1;
    }

    function computeEffectiveReadTime(cfg, charCount) {
        if (cfg.linkReadTime) {
            var c = Math.max(1, charCount || 1);
            var sp25 = clampNum(cfg.secPer25, 0.2, 10, 1.2);
            return Math.max(0.2, Math.round(((c / 25.0) * sp25) * 100) / 100);
        }
        return clampNum(cfg.readTime, 0.2, 60, 2.0);
    }

    /**
     * Finds the exact normalized arc-length fraction f in [0, 1) along a closed
     * ShapeData path closest to `targetPt` (e.g. `pTip` of the tail).
     */
    function computePointArcFraction(shapeData, targetPt) {
        if (!shapeData || !shapeData.vertices || shapeData.vertices.length < 2 || !targetPt) {
            return 0.5;
        }
        var verts = shapeData.vertices;
        var inT = shapeData.inTangents || [];
        var outT = shapeData.outTangents || [];
        var n = verts.length;
        var segCount = shapeData.closed ? n : (n - 1);
        var STEPS = 24;
        var cumLen = 0;
        var bestDist2 = 1e18;
        var bestLen = 0;
        var i, s;

        for (i = 0; i < segCount; i++) {
            var j = (i + 1) % n;
            var p0 = verts[i];
            var o0 = outT[i] || [0, 0];
            var i1 = inT[j] || [0, 0];
            var p1 = verts[j];
            var prev = p0;
            for (s = 0; s <= STEPS; s++) {
                var pt = (s === 0) ? p0 : evalCubicPt(p0, o0, i1, p1, s / STEPS);
                if (s > 0) {
                    cumLen += dist2D(prev, pt);
                }
                var dx = pt[0] - targetPt[0];
                var dy = pt[1] - targetPt[1];
                var d2 = dx * dx + dy * dy;
                if (d2 < bestDist2) {
                    bestDist2 = d2;
                    bestLen = cumLen;
                }
                prev = pt;
            }
        }
        if (cumLen <= 1e-5) return 0.5;
        return ((bestLen / cumLen) % 1 + 1) % 1;
    }

    function setEffectExpression(eff, exprStr) {
        if (!eff) return;
        try {
            var p = eff.property(1);
            if (p) p.expression = exprStr || "";
        } catch (e) {}
    }

    /**
     * Attaches user-accessible Timing & Status Effect Controls onto `layer`:
     *   - Bubble Start Delay (s)
     *   - Bubble In Time (s)
     *   - Bubble Link Read Time (Checkbox)
     *   - Bubble Sec Per 25 Chars
     *   - Bubble Read Time (s)
     *   - Bubble Out Time (s)
     *   - Bubble Status          (0=waiting, 1=start, 2=in, 3=reading, 4=out, 5=end)
     *   - Bubble In Timing       (0 - 100%)
     *   - Bubble Reading Timing  (0 - 100%)
     *   - Bubble Out Timing      (0 - 100%)
     *   - Bubble Envelope        (0 - 100% active visibility progress)
     */
    function applyTimingAndStatusEffects(layer, cfg, charCount, linkOpts) {
        if (!layer) return;
        var fxParade = layer.property("ADBE Effect Parade") || layer.property("Effects");
        if (!fxParade) return;

        var startDelay = clampNum(cfg.startDelay, 0, 30, 0);
        var inTime     = clampNum(cfg.inTime, 0.1, 10, 0.6);
        var outTime    = clampNum(cfg.outTime, 0.1, 10, 0.5);
        var secPer25   = clampNum(cfg.secPer25, 0.2, 10, 1.2);
        var linkRead   = cfg.linkReadTime ? 1 : 0;
        var effRead    = computeEffectiveReadTime(cfg, charCount);
        var bakedChars = Math.max(1, charCount || 1);

        var eDelay  = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Start Delay (s)", startDelay);
        var eIn     = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble In Time (s)",     inTime);
        var eLink   = ensureEffectCtrl(fxParade, "ADBE Checkbox Control", "Bubble Link Read Time",  linkRead);
        var eSp25   = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Sec Per 25 Chars", secPer25);
        var eRead   = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Read Time (s)",   effRead);
        var eOut    = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Out Time (s)",    outTime);
        var eStatus = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Status",          0);
        var eInPrg  = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble In Timing",       0);
        var eRdPrg  = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Reading Timing",  0);
        var eOtPrg  = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Out Timing",      0);
        var eEnv    = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Envelope",        100);

        // Mirror input controls from outer precomp layer when inside a precomp
        if (linkOpts && linkOpts.outerCompName && linkOpts.outerLayerName) {
            var oc = escapeJsonStr(linkOpts.outerCompName);
            var ol = escapeJsonStr(linkOpts.outerLayerName);
            function mirrorOuter(effName) {
                return 'var v = value;\ntry { v = comp("' + oc + '").layer("' + ol + '").effect("' + effName + '")(1).value; } catch (e) {}\nv;';
            }
            setEffectExpression(eDelay, mirrorOuter("Bubble Start Delay (s)"));
            setEffectExpression(eIn,    mirrorOuter("Bubble In Time (s)"));
            setEffectExpression(eLink,  mirrorOuter("Bubble Link Read Time"));
            setEffectExpression(eSp25,  mirrorOuter("Bubble Sec Per 25 Chars"));
            setEffectExpression(eOut,   mirrorOuter("Bubble Out Time (s)"));
        } else {
            setEffectExpression(eDelay, "");
            setEffectExpression(eIn,    "");
            setEffectExpression(eLink,  "");
            setEffectExpression(eSp25,  "");
            setEffectExpression(eOut,   "");
        }

        // Dynamic Read-Time expression (links to 25-character reading speed when checkbox is ON)
        var readSourceSnippet = "";
        if (linkOpts && linkOpts.innerCompName && linkOpts.innerTextName) {
            readSourceSnippet =
                'var st = comp("' + escapeJsonStr(linkOpts.innerCompName) + '").layer("' + escapeJsonStr(linkOpts.innerTextName) + '").text.sourceText.value;\n';
        } else {
            readSourceSnippet =
                'var st = thisLayer.text.sourceText.value;\n';
        }

        var manualFallbackSnippet = "var outVal = value;\n";
        if (linkOpts && linkOpts.outerCompName && linkOpts.outerLayerName) {
            manualFallbackSnippet =
                'var outVal = value;\n' +
                'try { outVal = comp("' + escapeJsonStr(linkOpts.outerCompName) + '").layer("' + escapeJsonStr(linkOpts.outerLayerName) + '").effect("Bubble Read Time (s)")(1).value; } catch (eM) {}\n';
        }

        var readExpr =
            'var isLinked = effect("Bubble Link Read Time")(1).value;\n' +
            manualFallbackSnippet +
            'if (isLinked && Number(isLinked) > 0.5) {\n' +
            '    var sp25 = Math.max(0.05, effect("Bubble Sec Per 25 Chars")(1).value);\n' +
            '    var nChars = ' + bakedChars + ';\n' +
            '    try {\n' +
            '        ' + readSourceSnippet +
            '        var s = (st && st.text !== undefined) ? String(st.text) : String(st);\n' +
            '        s = s.replace(/[\\r\\n]+/g, "");\n' +
            '        if (s.length > 0) nChars = s.length;\n' +
            '    } catch (eTxt) {}\n' +
            '    outVal = Math.max(0.1, (nChars / 25.0) * sp25);\n' +
            '}\n' +
            'outVal;';
        setEffectExpression(eRead, readExpr);

        var commonHeader =
            'var dly = Math.max(0, effect("Bubble Start Delay (s)")(1).value);\n' +
            'var tIn = Math.max(0.01, effect("Bubble In Time (s)")(1).value);\n' +
            'var tRd = Math.max(0.01, effect("Bubble Read Time (s)")(1).value);\n' +
            'var tOt = Math.max(0.01, effect("Bubble Out Time (s)")(1).value);\n' +
            'var inPt = (thisLayer && thisLayer.inPoint !== undefined) ? thisLayer.inPoint : 0;\n' +
            'var t0 = inPt + dly;\n' +
            'var t1 = t0 + tIn;\n' +
            'var t2 = t1 + tRd;\n' +
            'var t3 = t2 + tOt;\n';

        var statusExpr =
            '/* Bubble Status: 0=waiting, 1=start, 2=in, 3=reading, 4=out, 5=end */\n' +
            commonHeader +
            'var fd = (thisComp && thisComp.frameDuration) ? thisComp.frameDuration : (1.0 / 30.0);\n' +
            'var st = 0;\n' +
            'if (time < t0 - fd * 0.5) { st = 0; }\n' +
            'else if (Math.abs(time - t0) <= fd * 0.5) { st = 1; }\n' +
            'else if (time < t1) { st = 2; }\n' +
            'else if (time < t2) { st = 3; }\n' +
            'else if (time < t3) { st = 4; }\n' +
            'else { st = 5; }\n' +
            'st;';
        setEffectExpression(eStatus, statusExpr);

        setEffectExpression(eInPrg,
            commonHeader +
            'var p = 0;\n' +
            'if (time <= t0) { p = 0; }\n' +
            'else if (time >= t1) { p = 100; }\n' +
            'else { p = ((time - t0) / tIn) * 100.0; }\n' +
            'p;'
        );

        setEffectExpression(eRdPrg,
            commonHeader +
            'var p = 0;\n' +
            'if (time <= t1) { p = 0; }\n' +
            'else if (time >= t2) { p = 100; }\n' +
            'else { p = ((time - t1) / tRd) * 100.0; }\n' +
            'p;'
        );

        setEffectExpression(eOtPrg,
            commonHeader +
            'var p = 0;\n' +
            'if (time <= t2) { p = 0; }\n' +
            'else if (time >= t3) { p = 100; }\n' +
            'else { p = ((time - t2) / tOt) * 100.0; }\n' +
            'p;'
        );

        setEffectExpression(eEnv,
            commonHeader +
            'var env = 0;\n' +
            'if (time <= t0 || time >= t3) { env = 0; }\n' +
            'else if (time < t1) { env = ((time - t0) / tIn) * 100.0; }\n' +
            'else if (time <= t2) { env = 100.0; }\n' +
            'else { env = (1.0 - (time - t2) / tOt) * 100.0; }\n' +
            'clamp(env, 0, 100);'
        );
    }

    function applyTypewriterAnimator(textLayer) {
        if (!textLayer) return;
        try {
            var textProps = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
            if (!textProps) return;
            var animators = textProps.property("ADBE Text Animators") || textProps.property("Animators");
            if (!animators || typeof animators.addProperty !== "function") return;

            var anim = animators.addProperty("ADBE Text Animator");
            if (!anim) return;
            anim.name = TYPEWRITER_ANIMATOR_NAME;

            var aProps = anim.property("ADBE Text Animator Properties") || anim.property("Properties");
            if (aProps && typeof aProps.addProperty === "function") {
                var opProp = aProps.addProperty("ADBE Text Opacity");
                if (opProp) opProp.setValue(0);
            }

            var sels = anim.property("ADBE Text Selectors") || anim.property("Selectors");
            if (sels) {
                var sel = sels.property(1);
                if (!sel && typeof sels.addProperty === "function") {
                    sel = sels.addProperty("ADBE Text Selector");
                }
                if (sel) {
                    var startProp = sel.property("ADBE Text Percent Start") || sel.property("Start");
                    var endProp   = sel.property("ADBE Text Percent End")   || sel.property("End");
                    if (endProp) endProp.setValue(100);
                    if (startProp) {
                        startProp.setValue(0);
                        startProp.expression = 'clamp(effect("Bubble Envelope")(1).value, 0, 100);';
                    }
                    var adv = sel.property("ADBE Text Range Advanced") || sel.property("Advanced");
                    if (adv) {
                        var sm = adv.property("ADBE Text Range Smoothness") || adv.property("Smoothness");
                        if (sm) sm.setValue(0);
                    }
                }
            }
        } catch (eTW) {}
    }

    function serialize2DArrayCompact(arr) {
        var parts = [];
        for (var i = 0; i < arr.length; i++) {
            var x = Math.round((arr[i][0] || 0) * 100) / 100;
            var y = Math.round((arr[i][1] || 0) * 100) / 100;
            parts.push("[" + x + "," + y + "]");
        }
        return "[" + parts.join(",") + "]";
    }

    /**
     * Generates a createPath(...) expression that expands the balloon's width
     * horizontally from 0 -> full width WITHOUT Scale distortion (preserving
     * corner radii, puff curves, and spike tips along the left & right caps).
     */
    function buildBloatPathExpression(shapeData, halfTextW, cfg, envRefExpr, offsetXY) {
        var bodyHalfW = Math.max(12, halfTextW + (cfg.padX || 0));
        var capR = 16;
        if (cfg.geometry === "square") {
            capR = 2;
        } else if (cfg.geometry === "rounded") {
            capR = Math.min(bodyHalfW * 0.9, Math.max(4, cfg.cornerRadius || 0));
        } else {
            capR = Math.min(bodyHalfW * 0.65, 22);
        }
        var splitX = Math.max(0, Math.round((bodyHalfW - capR) * 100) / 100);
        bodyHalfW  = Math.round(bodyHalfW * 100) / 100;
        capR       = Math.round(capR * 100) / 100;

        var ox = offsetXY ? (Math.round(offsetXY[0] * 100) / 100) : 0;
        var oy = offsetXY ? (Math.round(offsetXY[1] * 100) / 100) : 0;

        return (
            'var env = clamp(' + envRefExpr + ', 0, 100) / 100.0;\n' +
            'var p = env * env * (3.0 - 2.0 * env);\n' +
            'var V0 = ' + serialize2DArrayCompact(shapeData.vertices) + ';\n' +
            'var I0 = ' + serialize2DArrayCompact(shapeData.inTangents) + ';\n' +
            'var O0 = ' + serialize2DArrayCompact(shapeData.outTangents) + ';\n' +
            'var fullW = ' + bodyHalfW + ';\n' +
            'var capR = ' + capR + ';\n' +
            'var splitX = ' + splitX + ';\n' +
            'var targetW = fullW * p;\n' +
            'var q = 1.0;\n' +
            'var k = 1.0;\n' +
            'if (fullW > capR + 0.01) {\n' +
            '    if (targetW >= capR) {\n' +
            '        q = (targetW - capR) / (fullW - capR);\n' +
            '        k = 1.0;\n' +
            '    } else {\n' +
            '        q = 0.0;\n' +
            '        k = (capR > 0.01) ? (targetW / capR) : p;\n' +
            '    }\n' +
            '} else {\n' +
            '    q = 0.0;\n' +
            '    k = p;\n' +
            '}\n' +
            'var shift = (1.0 - q) * splitX;\n' +
            'var n = V0.length;\n' +
            'var V = [];\n' +
            'var IT = [];\n' +
            'var OT = [];\n' +
            'for (var i = 0; i < n; i++) {\n' +
            '    var vx = V0[i][0], vy = V0[i][1];\n' +
            '    var ix = I0[i][0], iy = I0[i][1];\n' +
            '    var ox = O0[i][0], oy = O0[i][1];\n' +
            '    var nx, nix, nox;\n' +
            '    if (vx > splitX) { nx = (vx - shift) * k; nix = ix * k; nox = ox * k; }\n' +
            '    else if (vx < -splitX) { nx = (vx + shift) * k; nix = ix * k; nox = ox * k; }\n' +
            '    else { nx = (vx * q) * k; nix = (ix * q) * k; nox = (ox * q) * k; }\n' +
            '    V.push([nx + ' + ox + ', vy + ' + oy + ']);\n' +
            '    IT.push([nix, iy]);\n' +
            '    OT.push([nox, oy]);\n' +
            '}\n' +
            'createPath(V, IT, OT, ' + (shapeData.closed ? "true" : "false") + ');'
        );
    }

    function applyInOutAnimationRig(comp, textLayer, balloonLayer, geoResult, textBounds, cfg, precompLayer, outerCompName) {
        if (!textLayer || !balloonLayer) return;

        var charCount = countReadableChars(textLayer);

        // Always populate Timing & Bubble Status Effects so custom user expressions can read them
        if (precompLayer && outerCompName) {
            applyTimingAndStatusEffects(precompLayer, cfg, charCount, {
                innerCompName: comp.name,
                innerTextName: textLayer.name
            });
            applyTimingAndStatusEffects(textLayer, cfg, charCount, {
                outerCompName: outerCompName,
                outerLayerName: precompLayer.name
            });
        } else {
            applyTimingAndStatusEffects(textLayer, cfg, charCount, null);
        }

        var style = cfg.animStyle || "none";
        if (style === "none") {
            return;
        }

        // All 3 styles animate text with AE's basic Opacity Typewriter Animator
        applyTypewriterAnimator(textLayer);

        var rootContents = balloonLayer.property("Contents") || balloonLayer.property("ADBE Root Vectors Group");
        if (!rootContents) return;

        var envFromChildExpr = 'parent.effect("Bubble Envelope")(1).value';
        var numGroups = (typeof rootContents.numProperties === "number")
            ? rootContents.numProperties
            : (rootContents.properties ? rootContents.properties.length : 0);

        var gi, grp, gCont, fillG, fillOp, strokeG, strokeOp, strokeW, pathG, pathP;

        // ---------------------------------------------------------------------
        // STYLE 1: "clementine"
        //   - Stroke grows from the tip of the tail via Trim Paths
        //   - Fill fades from opacity 0 to 100 (scaled by fillOpacity)
        // ---------------------------------------------------------------------
        if (style === "clementine") {
            var tailStyle = cfg.tailStyle || "none";
            var hasTailLead = (tailStyle === "line" || tailStyle === "clouds");
            var bodyTargetPt = [0, (textBounds.height / 2) + (cfg.padY || 26)];
            if (tailStyle === "triangle" || tailStyle === "lightning") {
                bodyTargetPt = geoResult.pTip;
            } else if (hasTailLead) {
                bodyTargetPt = geoResult.pMid;
            }

            var fTip = computePointArcFraction(geoResult.bodyShape, bodyTargetPt);
            var bodyOffsetDeg = Math.round(((((fTip - 0.5) % 1) + 1) % 1) * 360 * 100) / 100;

            for (gi = 1; gi <= numGroups; gi++) {
                grp = rootContents.property(gi);
                if (!grp) continue;
                gCont = grp.property("Contents") || grp.property("ADBE Vectors Group");
                if (!gCont) continue;

                fillG = gCont.property("ADBE Vector Graphic - Fill") || gCont.property("Fill 1") || gCont.property("Fill");
                if (fillG) {
                    fillOp = fillG.property("Opacity") || fillG.property("ADBE Vector Fill Opacity");
                    if (fillOp) {
                        fillOp.expression = 'var p = clamp(' + envFromChildExpr + ', 0, 100) / 100.0;\nvalue * p;';
                    }
                }

                strokeG = gCont.property("ADBE Vector Graphic - Stroke") || gCont.property("Stroke 1") || gCont.property("Stroke");
                if (strokeG) {
                    strokeOp = strokeG.property("Opacity") || strokeG.property("ADBE Vector Stroke Opacity");
                    if (strokeOp) {
                        strokeOp.expression = '(' + envFromChildExpr + ' <= 0.2) ? 0 : value;';
                    }

                    var trimG = gCont.addProperty("ADBE Vector Filter - Trim");
                    if (trimG) {
                        var trStart  = trimG.property("Start")  || trimG.property("ADBE Vector Trim Start");
                        var trEnd    = trimG.property("End")    || trimG.property("ADBE Vector Trim End");
                        var trOffset = trimG.property("Offset") || trimG.property("ADBE Vector Trim Offset");

                        if (grp.name === "Tail Line") {
                            // Line vertices are [pMid (0%), pTip (100%)]: grow from tip (100% -> 0%) during first 28% of envelope
                            if (trEnd) trEnd.setValue(100);
                            if (trStart) {
                                trStart.expression =
                                    'var p = clamp((' + envFromChildExpr + ' / 100.0) / 0.28, 0, 1);\n' +
                                    '100.0 - 100.0 * p;';
                            }
                        } else if (grp.name.indexOf("Thought Cloud ") === 0) {
                            var cIdx = parseInt(grp.name.replace("Thought Cloud ", ""), 10) || 1;
                            // Cloud 3 (tip) grows first [0..0.14], Cloud 2 [0.10..0.24], Cloud 1 [0.20..0.34]
                            var p0c = (3 - cIdx) * 0.10;
                            var p1c = p0c + 0.14;
                            if (trStart) {
                                trStart.expression =
                                    'var raw = ' + envFromChildExpr + ' / 100.0;\n' +
                                    'var p = clamp((raw - ' + p0c.toFixed(2) + ') / ' + (p1c - p0c).toFixed(2) + ', 0, 1);\n' +
                                    '50.0 - 50.0 * p;';
                            }
                            if (trEnd) {
                                trEnd.expression =
                                    'var raw = ' + envFromChildExpr + ' / 100.0;\n' +
                                    'var p = clamp((raw - ' + p0c.toFixed(2) + ') / ' + (p1c - p0c).toFixed(2) + ', 0, 1);\n' +
                                    '50.0 + 50.0 * p;';
                            }
                        } else {
                            // Main Balloon Body: emerges symmetrically from tail tip (or pMid after lead-in tail)
                            if (trOffset) trOffset.setValue(bodyOffsetDeg);
                            var leadStart = hasTailLead ? 0.26 : 0.0;
                            var leadSpan  = hasTailLead ? 0.74 : 1.0;
                            if (trStart) {
                                trStart.expression =
                                    'var raw = ' + envFromChildExpr + ' / 100.0;\n' +
                                    'var p = clamp((raw - ' + leadStart.toFixed(2) + ') / ' + leadSpan.toFixed(2) + ', 0, 1);\n' +
                                    '50.0 - 50.0 * p;';
                            }
                            if (trEnd) {
                                trEnd.expression =
                                    'var raw = ' + envFromChildExpr + ' / 100.0;\n' +
                                    'var p = clamp((raw - ' + leadStart.toFixed(2) + ') / ' + leadSpan.toFixed(2) + ', 0, 1);\n' +
                                    '50.0 + 50.0 * p;';
                            }
                        }
                    }
                }
            }
            return;
        }

        // ---------------------------------------------------------------------
        // STYLE 2: "bloat"
        //   - Balloon expands horizontally in width (createPath, NOT Scale!)
        //   - Balloon masks the Text Layer (Alpha Track Matte + kept visible)
        //   - Stroke thickness grows from 0 to selected thickness
        //   - Fill stays at 100% (selected fillOpacity) while active
        // ---------------------------------------------------------------------
        if (style === "bloat") {
            var halfTW = (textBounds.width || 160) / 2.0;

            for (gi = 1; gi <= numGroups; gi++) {
                grp = rootContents.property(gi);
                if (!grp) continue;
                gCont = grp.property("Contents") || grp.property("ADBE Vectors Group");
                if (!gCont) continue;

                pathG = gCont.property("ADBE Vector Shape - Group") || gCont.property("Path 1");
                if (pathG) {
                    pathP = pathG.property("Path") || pathG.property("ADBE Vector Shape");
                    if (pathP) {
                        var srcShape = (grp.name === "Balloon Body") ? geoResult.bodyShape : null;
                        if (!srcShape) {
                            for (var esi = 0; esi < geoResult.extraShapes.length; esi++) {
                                if (geoResult.extraShapes[esi].name === grp.name) {
                                    srcShape = geoResult.extraShapes[esi].shapeData;
                                    break;
                                }
                            }
                        }
                        if (srcShape) {
                            pathP.expression = buildBloatPathExpression(srcShape, halfTW, cfg, envFromChildExpr, null);
                        }
                    }
                }

                fillG = gCont.property("ADBE Vector Graphic - Fill") || gCont.property("Fill 1") || gCont.property("Fill");
                if (fillG) {
                    fillOp = fillG.property("Opacity") || fillG.property("ADBE Vector Fill Opacity");
                    if (fillOp) {
                        // 100% (user's fillOpacity) throughout active bloat; 0% only when completely closed
                        fillOp.expression = '(' + envFromChildExpr + ' <= 0.1) ? 0 : value;';
                    }
                }

                strokeG = gCont.property("ADBE Vector Graphic - Stroke") || gCont.property("Stroke 1") || gCont.property("Stroke");
                if (strokeG) {
                    strokeW = strokeG.property("Stroke Width") || strokeG.property("ADBE Vector Stroke Width");
                    if (strokeW) {
                        strokeW.expression = 'var p = clamp(' + envFromChildExpr + ', 0, 100) / 100.0;\nvalue * p;';
                    }
                    strokeOp = strokeG.property("Opacity") || strokeG.property("ADBE Vector Stroke Opacity");
                    if (strokeOp) {
                        strokeOp.expression = '(' + envFromChildExpr + ' <= 0.1) ? 0 : value;';
                    }
                }
            }

            // Mask the Text Layer with the horizontally expanding Balloon
            var usedTrackMatte = false;
            try {
                if (typeof textLayer.setTrackMatte === "function") {
                    var alphaType = (typeof TrackMatteType !== "undefined" && TrackMatteType.ALPHA !== undefined)
                        ? TrackMatteType.ALPHA
                        : 5013;
                    textLayer.setTrackMatte(balloonLayer, alphaType);
                    balloonLayer.enabled = true; // Keep balloon visible behind text while acting as Alpha Matte
                    usedTrackMatte = true;
                }
            } catch (eMatte) {}

            // Fallback for older AE versions (< 2023) without layer.setTrackMatte(...)
            if (!usedTrackMatte) {
                try {
                    var masks = textLayer.property("ADBE Mask Parade") || textLayer.property("Masks");
                    if (masks && typeof masks.addProperty === "function") {
                        var mAtom = masks.property(BLOAT_MASK_NAME) || masks.addProperty("ADBE Mask Atom");
                        if (mAtom) {
                            mAtom.name = BLOAT_MASK_NAME;
                            var mShapeProp = mAtom.property("ADBE Mask Shape") || mAtom.property("Mask Path");
                            if (mShapeProp) {
                                var tAp = textLayer.property("Transform").property("Anchor Point").value;
                                mShapeProp.expression = buildBloatPathExpression(
                                    geoResult.bodyShape,
                                    halfTW,
                                    cfg,
                                    'effect("Bubble Envelope")(1).value',
                                    [tAp[0] || 0, tAp[1] || 0]
                                );
                            }
                        }
                    }
                } catch (eOldMask) {}
            }
            return;
        }

        // ---------------------------------------------------------------------
        // STYLE 3: "sparse_dots"
        //   - Stroke appears from a very sparse dotted line to a solid line
        //   - Fill gains in opacity from 0 to selected fillOpacity
        // ---------------------------------------------------------------------
        if (style === "sparse_dots") {
            for (gi = 1; gi <= numGroups; gi++) {
                grp = rootContents.property(gi);
                if (!grp) continue;
                gCont = grp.property("Contents") || grp.property("ADBE Vectors Group");
                if (!gCont) continue;

                fillG = gCont.property("ADBE Vector Graphic - Fill") || gCont.property("Fill 1") || gCont.property("Fill");
                if (fillG) {
                    fillOp = fillG.property("Opacity") || fillG.property("ADBE Vector Fill Opacity");
                    if (fillOp) {
                        fillOp.expression = 'var p = clamp(' + envFromChildExpr + ', 0, 100) / 100.0;\nvalue * p;';
                    }
                }

                strokeG = gCont.property("ADBE Vector Graphic - Stroke") || gCont.property("Stroke 1") || gCont.property("Stroke");
                if (strokeG) {
                    strokeOp = strokeG.property("Opacity") || strokeG.property("ADBE Vector Stroke Opacity");
                    if (strokeOp) {
                        strokeOp.expression =
                            'var p = clamp(' + envFromChildExpr + ', 0, 100) / 100.0;\n' +
                            '(p <= 0.002) ? 0 : Math.min(value, value * p * 5.0);';
                    }
                    var dashesG = strokeG.dashes || strokeG.property("ADBE Vector Stroke Dashes") || strokeG.property("Dashes");
                    if (dashesG) {
                        var dProp = dashesG.property("ADBE Vector Stroke Dash 1") || dashesG.property("Dash") || dashesG.property(1);
                        var gProp = dashesG.property("ADBE Vector Stroke Gap 1")  || dashesG.property("Gap")  || dashesG.property(2);
                        if (dProp) {
                            dProp.expression =
                                'var p = clamp(' + envFromChildExpr + ', 0, 100) / 100.0;\n' +
                                '0.5 + 220.0 * Math.pow(p, 1.6);';
                        }
                        if (gProp) {
                            gProp.expression =
                                'var p = clamp(' + envFromChildExpr + ', 0, 100) / 100.0;\n' +
                                '140.0 * Math.pow(1.0 - p, 1.8);';
                        }
                    }
                }
            }
        }
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
        var innerBalloon = null;
        var layersToExtract = [];
        var count = getCompLayerCount(precompItem);
        var i;
        for (i = 1; i <= count; i++) {
            var il = getCompLayerAt(precompItem, i);
            if (!il) continue;
            if (isComicBalloonShapeLayer(il) && !innerBalloon) innerBalloon = il;
            if (!keepBalloon && isComicBalloonShapeLayer(il)) continue;
            if (isTextLayer(il) && !innerText) innerText = il;
            layersToExtract.push(il);
        }

        if (innerText) {
            cleanupTextAnimationArtifacts(innerText, innerBalloon);
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

            cleanupTextAnimationArtifacts(innerText, ctx.balloonLayer);

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

            var rebuiltBalloon = createOrRebuildBalloonLayer(pItem, innerText, ctx.balloonLayer, geo, cfg);

            var pAnchorProp = pLayer.property("Transform").property("Anchor Point");
            if (pLayer.threeDLayer) {
                pAnchorProp.setValue([newW / 2, newH / 2, 0]);
            } else {
                pAnchorProp.setValue([newW / 2, newH / 2]);
            }

            applyInOutAnimationRig(pItem, innerText, rebuiltBalloon, geo, centered.bounds, cfg, pLayer, comp.name);

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

        cleanupTextAnimationArtifacts(targetText, targetBalloon);

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

        // If Make Precomp is OFF, rig timing/animation directly in current comp
        if (!cfg.makePrecomp) {
            applyInOutAnimationRig(comp, targetText, targetBalloon, geoData, cInfo.bounds, cfg, null, "");
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
        var innerBln = null;
        var innerCnt = getCompLayerCount(precompItem);
        for (si = 1; si <= innerCnt; si++) {
            var cand = getCompLayerAt(precompItem, si);
            if (!innerTxt && isTextLayer(cand)) innerTxt = cand;
            if (!innerBln && isComicBalloonShapeLayer(cand)) innerBln = cand;
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

            if (innerTxt && innerBln) {
                applyInOutAnimationRig(precompItem, innerTxt, innerBln, geoData, cInfo.bounds, cfg, precompLayer, comp.name);
            }

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
     *   - Removes the Balloon layer & animation artifacts
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
            cleanupTextAnimationArtifacts(textLayer, ctx.balloonLayer);
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
                cleanupTextAnimationArtifacts(textLayer, null);
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

    function createSliderRow(parent, labelStr, defVal, minVal, maxVal, unitStr, onValueChanged, decimals, fixedDecimals) {
        var dec = (typeof decimals === "number" && decimals > 0) ? decimals : 0;
        var factor = (dec > 0) ? Math.pow(10, dec) : 1;
        var stepVal = (dec > 0) ? (1 / factor) : 1;

        function fmtNum(val) {
            var r = Math.round(val * factor) / factor;
            if (dec > 0 && fixedDecimals) return r.toFixed(dec);
            return String(r);
        }

        var grp = parent.add("group");
        grp.orientation = "row";
        grp.alignment = ["fill", "top"];
        grp.alignChildren = ["left", "center"];
        grp.spacing = 6;

        var lbl = grp.add("statictext", undefined, labelStr);
        lbl.preferredSize = [104, -1];

        var sld = grp.add("slider", undefined, defVal, minVal, maxVal);
        sld.minvalue = minVal;
        sld.maxvalue = maxVal;
        sld.stepdelta = stepVal;
        sld.value = defVal;
        sld.alignment = ["fill", "center"];

        var txt = grp.add("edittext", undefined, fmtNum(defVal));
        txt.preferredSize = [46, 20];

        if (unitStr) {
            var uLbl = grp.add("statictext", undefined, unitStr);
            uLbl.preferredSize = [18, -1];
        }

        function syncDomStep() {
            if (sld.domElement && sld.domElement.step !== String(stepVal)) {
                sld.domElement.step = String(stepVal);
            }
        }

        function setVal(v, notify) {
            syncDomStep();
            var clamped = clampNum(v, minVal, maxVal, defVal);
            var rounded = Math.round(clamped * factor) / factor;
            sld.value = rounded;
            txt.text = fmtNum(rounded);
            if (notify && typeof onValueChanged === "function") onValueChanged(rounded);
        }

        sld.onChanging = sld.onChange = function () {
            syncDomStep();
            var clamped = clampNum(sld.value, minVal, maxVal, defVal);
            var r = Math.round(clamped * factor) / factor;
            txt.text = fmtNum(r);
            if (typeof onValueChanged === "function") onValueChanged(r);
        };

        txt.onChange = function () {
            setVal(txt.text, true);
        };

        return {
            group: grp,
            slider: sld,
            edittext: txt,
            syncDomStep: syncDomStep,
            getValue: function () {
                var c = clampNum(txt.text, minVal, maxVal, defVal);
                return Math.round(c * factor) / factor;
            },
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
        // MIDDLE: TABS (1. Balloon | 2. Tail | 3. Appearance | 4. In / Out)
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
        pnlGeom.spacing = 5;
        pnlGeom.margins = [8, 10, 8, 8];

        var grpGeomRow = pnlGeom.add("group");
        grpGeomRow.orientation = "row";
        grpGeomRow.alignment = ["fill", "top"];
        grpGeomRow.spacing = 6;
        var lblGeom = grpGeomRow.add("statictext", undefined, "Shape:");
        lblGeom.preferredSize = [104, -1];
        var ddGeometry = grpGeomRow.add("dropdownlist", undefined, GEOMETRY_LABELS);
        ddGeometry.alignment = ["fill", "center"];
        ddGeometry.selection = 1;

        var ctrlCornerRadius   = createSliderRow(pnlGeom, "Corner Radius:",   28,  0, 150, "px", refreshPreviewCanvas);
        var ctrlCloudPuffs     = createSliderRow(pnlGeom, "Cloud Puffs:",     12,  6,  30, "",   refreshPreviewCanvas);
        var ctrlCloudDepth     = createSliderRow(pnlGeom, "Puff Depth:",      42, 10, 120, "%",  refreshPreviewCanvas);
        var ctrlCloudWidthRand = createSliderRow(pnlGeom, "Puff Width Rand:",  0,  0, 100, "%",  refreshPreviewCanvas);
        var ctrlSpikeCount     = createSliderRow(pnlGeom, "Burst Spikes:",    18,  6,  40, "",   refreshPreviewCanvas);
        var ctrlSpikeDepth     = createSliderRow(pnlGeom, "Spike Depth:",     85, 15, 220, "%",  refreshPreviewCanvas);
        var ctrlSpikeWidthRand = createSliderRow(pnlGeom, "Spike Width Rand:", 0,  0, 100, "%",  refreshPreviewCanvas);

        ctrlCloudDepth.group.helpTip     = "Puff depth relative (%) to each individual puff's width.";
        ctrlCloudWidthRand.group.helpTip = "0% = constant arc-length puff width; >0% = randomizes puff widths while keeping exact puff count.";
        ctrlSpikeDepth.group.helpTip     = "Spike height relative (%) to each individual spike's base width.";
        ctrlSpikeWidthRand.group.helpTip = "0% = constant arc-length spike width; >0% = randomizes spike widths while keeping exact spike count.";

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
            ctrlCornerRadius.group.enabled   = (key === "rounded");
            ctrlCloudPuffs.group.enabled     = (key === "cloud");
            ctrlCloudDepth.group.enabled     = (key === "cloud");
            ctrlCloudWidthRand.group.enabled = (key === "cloud");
            ctrlSpikeCount.group.enabled     = (key === "explosion");
            ctrlSpikeDepth.group.enabled     = (key === "explosion");
            ctrlSpikeWidthRand.group.enabled = (key === "explosion");
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

        var ctrlTailPos    = createSliderRow(pnlTrim, "Position:",         56,   0, 100, "%", refreshPreviewCanvas, 1, false);
        var ctrlTailWidth  = createSliderRow(pnlTrim, "Tail Start Width:", 2.5, 0.1, 4.0, "",  refreshPreviewCanvas, 1, true);
        var ctrlTailOffset = createSliderRow(pnlTrim, "Offset:",            0, -180, 180, "°", refreshPreviewCanvas, 0, false);

        var pnlTailTarget = tabTail.add("panel", undefined, "Tail Target Length & Slant");
        pnlTailTarget.orientation = "column";
        pnlTailTarget.alignChildren = ["fill", "top"];
        pnlTailTarget.spacing = 5;
        pnlTailTarget.margins = [8, 10, 8, 8];

        var ctrlTailLength = createSliderRow(pnlTailTarget, "Tail Length:", 85,  15, 350, "px", refreshPreviewCanvas);
        var ctrlTailAngle  = createSliderRow(pnlTailTarget, "Tip Slant:",   12, -70,  70, "°",  refreshPreviewCanvas);

        function snapPerimeterAt(centerPct) {
            var p = Math.round((((centerPct % 100) + 100) % 100) * 10) / 10;
            ctrlTailOffset.setValue(0, false);
            ctrlTailPos.setValue(p, true);
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

        // ---------------------------------------------------------------------
        // TAB 4: IN / OUT (Animation Styles, Read-Time Link & Expression Effects)
        // ---------------------------------------------------------------------
        var tabInOut = tabs.add("tab", undefined, "In / Out");
        tabInOut.orientation = "column";
        tabInOut.alignChildren = ["fill", "top"];
        tabInOut.spacing = 6;
        tabInOut.margins = 8;

        var pnlAnimStyle = tabInOut.add("panel", undefined, "In / Out Animation Style");
        pnlAnimStyle.orientation = "column";
        pnlAnimStyle.alignChildren = ["fill", "top"];
        pnlAnimStyle.spacing = 5;
        pnlAnimStyle.margins = [8, 10, 8, 8];

        var grpAnimRow = pnlAnimStyle.add("group");
        grpAnimRow.orientation = "row";
        grpAnimRow.alignment = ["fill", "top"];
        grpAnimRow.spacing = 6;
        var lblAnimStyle = grpAnimRow.add("statictext", undefined, "Style:");
        lblAnimStyle.preferredSize = [56, -1];
        var ddAnimStyle = grpAnimRow.add("dropdownlist", undefined, ANIM_LABELS);
        ddAnimStyle.alignment = ["fill", "center"];
        ddAnimStyle.selection = 0;

        var lblAnimDesc = pnlAnimStyle.add("statictext", undefined, "Static balloon (Timing & Status effects still generated).");
        lblAnimDesc.alignment = ["fill", "top"];

        var pnlTiming = tabInOut.add("panel", undefined, "Timing & Reading Duration");
        pnlTiming.orientation = "column";
        pnlTiming.alignChildren = ["fill", "top"];
        pnlTiming.spacing = 5;
        pnlTiming.margins = [8, 10, 8, 8];

        var ctrlStartDelay = createSliderRow(pnlTiming, "Start Delay:",    0.0, 0.0, 10.0, "s", onTimingControlChanged, 1, true);
        var ctrlInTime     = createSliderRow(pnlTiming, "Fade In Time:",   0.6, 0.1,  5.0, "s", onTimingControlChanged, 1, true);
        var ctrlOutTime    = createSliderRow(pnlTiming, "Fade Out Time:",  0.5, 0.1,  5.0, "s", onTimingControlChanged, 1, true);
        var ctrlReadTime   = createSliderRow(pnlTiming, "Read Time:",      2.0, 0.2, 20.0, "s", onTimingControlChanged, 1, true);

        var chkLinkReadTime = pnlTiming.add("checkbox", undefined, "Link Read Time to Text Length (25 chars)");
        chkLinkReadTime.value = true;
        chkLinkReadTime.helpTip = "Automatically computes Read Time from text length based on seconds per 25 characters.";

        var ctrlSecPer25 = createSliderRow(pnlTiming, "Sec / 25 Chars:", 1.2, 0.2, 5.0, "s", onTimingControlChanged, 1, true);

        var lblReadSummary = pnlTiming.add("statictext", undefined, "Status Effect: 0=waiting, 1=start, 2=in, 3=reading, 4=out, 5=end");
        lblReadSummary.alignment = ["fill", "top"];
        lblReadSummary.helpTip = 'Creates "Bubble Status", "Bubble In Timing", "Bubble Reading Timing", and "Bubble Out Timing" Effects for custom expressions.';

        function syncInOutControlsVisibility() {
            var aIdx = ddAnimStyle.selection ? ddAnimStyle.selection.index : 0;
            var aKey = ANIM_KEYS[aIdx] || "none";
            if (aKey === "clementine") {
                lblAnimDesc.text = "Typewriter text + Stroke trims from tail tip + Fill fades 0-100%.";
            } else if (aKey === "bloat") {
                lblAnimDesc.text = "Typewriter text + Balloon width expands masking text + Stroke 0->Max.";
            } else if (aKey === "sparse_dots") {
                lblAnimDesc.text = "Typewriter text + Sparse dotted stroke coalesces to solid + Fill fades.";
            } else {
                lblAnimDesc.text = "Static balloon (Timing & Status effects still generated).";
            }

            var isLinked = Boolean(chkLinkReadTime.value);
            ctrlSecPer25.group.enabled = isLinked;
            ctrlReadTime.group.enabled = !isLinked;

            if (isLinked) {
                var cTarget = resolveTargetContext(true);
                var nChars = (cTarget && cTarget.textLayer) ? countReadableChars(cTarget.textLayer) : 33;
                var autoRd = Math.max(0.2, Math.round(((nChars / 25.0) * ctrlSecPer25.getValue()) * 10) / 10);
                ctrlReadTime.setValue(autoRd, false);
                lblReadSummary.text = "Auto Read: " + autoRd.toFixed(1) + "s (" + nChars + " chars) | Status: 0..5 in Effects";
            } else {
                lblReadSummary.text = "Status Effect: 0=waiting, 1=start, 2=in, 3=reading, 4=out, 5=end";
            }
        }

        function onTimingControlChanged() {
            syncInOutControlsVisibility();
        }

        ddAnimStyle.onChange = syncInOutControlsVisibility;
        chkLinkReadTime.onClick = syncInOutControlsVisibility;

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
            var aIdx = ddAnimStyle.selection ? ddAnimStyle.selection.index : 0;

            var minW = ctrlStrokeMinWidth.getValue();
            var maxW = ctrlStrokeMaxWidth.getValue();
            if (minW > maxW) {
                var swap = minW; minW = maxW; maxW = swap;
            }

            var tPos   = ctrlTailPos.getValue();
            var tWidth = ctrlTailWidth.getValue();
            var halfTW = tWidth * 0.5;
            var tStart = ((tPos - halfTW) % 100 + 100) % 100;
            var tEnd   = ((tPos + halfTW) % 100 + 100) % 100;

            return {
                geometry: GEOMETRY_KEYS[gIdx] || "rounded",
                padX: ctrlPadX.getValue(),
                padY: ctrlPadY.getValue(),
                cornerRadius: ctrlCornerRadius.getValue(),
                cloudPuffs: Math.round(ctrlCloudPuffs.getValue()),
                cloudDepth: ctrlCloudDepth.getValue(),
                cloudWidthRand: ctrlCloudWidthRand.getValue(),
                spikeCount: Math.round(ctrlSpikeCount.getValue()),
                spikeDepth: ctrlSpikeDepth.getValue(),
                spikeWidthRand: ctrlSpikeWidthRand.getValue(),
                tailStyle: TAIL_KEYS[tIdx] || "triangle",
                tailPosition: tPos,
                tailStartWidth: tWidth,
                tailStart: tStart,
                tailEnd: tEnd,
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
                animStyle: ANIM_KEYS[aIdx] || "none",
                startDelay: ctrlStartDelay.getValue(),
                inTime: ctrlInTime.getValue(),
                readTime: ctrlReadTime.getValue(),
                linkReadTime: Boolean(chkLinkReadTime.value),
                secPer25: ctrlSecPer25.getValue(),
                outTime: ctrlOutTime.getValue(),
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
            ddAnimStyle.selection   = indexOfKey(ANIM_KEYS, c.animStyle, 0);

            ctrlPadX.setValue(c.padX, false);
            ctrlPadY.setValue(c.padY, false);
            ctrlCornerRadius.setValue(c.cornerRadius, false);
            ctrlCloudPuffs.setValue(c.cloudPuffs, false);
            ctrlCloudDepth.setValue(c.cloudDepth, false);
            ctrlCloudWidthRand.setValue(c.cloudWidthRand, false);
            ctrlSpikeCount.setValue(c.spikeCount, false);
            ctrlSpikeDepth.setValue(c.spikeDepth, false);
            ctrlSpikeWidthRand.setValue(c.spikeWidthRand, false);

            ctrlTailPos.setValue(c.tailPosition, false);
            ctrlTailWidth.setValue(c.tailStartWidth, false);
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

            ctrlStartDelay.setValue(c.startDelay, false);
            ctrlInTime.setValue(c.inTime, false);
            ctrlReadTime.setValue(c.readTime, false);
            chkLinkReadTime.value = Boolean(c.linkReadTime);
            ctrlSecPer25.setValue(c.secPer25, false);
            ctrlOutTime.setValue(c.outTime, false);

            chkMakePrecomp.value = Boolean(c.makePrecomp);

            syncBalloonShapeVisibility();
            syncTailControlsVisibility();
            syncStrokeControlsVisibility();
            syncInOutControlsVisibility();
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
                    cloudDepth: cfg.cloudDepth,
                    cloudWidthRand: cfg.cloudWidthRand,
                    spikeCount: Math.min(18, cfg.spikeCount),
                    spikeDepth: Math.min(95, cfg.spikeDepth),
                    spikeWidthRand: cfg.spikeWidthRand
                });

                var cx = w * 0.5;
                var cy = h * 0.46;
                var penDim = g.newPen(g.PenType.SOLID_COLOR, [0.55, 0.62, 0.72, 1], 1.5);
                g.newPath();
                for (var s = 0; s <= 56; s++) {
                    var pt = evaluatePerimeterAtU(previewSegs, s / 56).point;
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
                    if (sp < 0.005) sp = 0.005;

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
            try {
                var fracSliders = [ctrlTailPos, ctrlTailWidth, ctrlStartDelay, ctrlInTime, ctrlOutTime, ctrlReadTime, ctrlSecPer25];
                for (var fi = 0; fi < fracSliders.length; fi++) {
                    if (fracSliders[fi] && fracSliders[fi].syncDomStep) fracSliders[fi].syncDomStep();
                }
            } catch (eStep) {}

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
                        cloudDepth: cfg.cloudDepth,
                        cloudWidthRand: cfg.cloudWidthRand,
                        spikeCount: Math.min(18, cfg.spikeCount),
                        spikeDepth: Math.min(95, cfg.spikeDepth),
                        spikeWidthRand: cfg.spikeWidthRand
                    });

                    var cx = 68, cy = 36;
                    var ptsAll = [];
                    var s;
                    for (s = 0; s <= 64; s++) {
                        var p = evaluatePerimeterAtU(segs, s / 64).point;
                        ptsAll.push((cx + p[0]).toFixed(1) + "," + (cy + p[1]).toFixed(1));
                    }

                    var hiSvg = "";
                    if (cfg.tailStyle !== "none") {
                        var off = (cfg.tailOffset || 0) / 360.0;
                        var u1 = (((cfg.tailStart / 100.0) + off) % 1 + 1) % 1;
                        var u2 = (((cfg.tailEnd / 100.0) + off) % 1 + 1) % 1;
                        var sp = ((u2 - u1) % 1 + 1) % 1;
                        if (sp > 0.5) { var tmp = u1; u1 = u2; u2 = tmp; sp = 1 - sp; }
                        if (sp < 0.005) sp = 0.005;

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
                        '<svg width="100%" height="100%" viewBox="0 0 136 76" style="display:block;pointer-events:none;">' +
                        '<polygon points="' + ptsAll.join(" ") + '" fill="rgba(255,255,255,0.08)" stroke="#64748b" stroke-width="1.5"/>' +
                        hiSvg +
                        '</svg>';

                    if (!el._trimDragBound) {
                        el._trimDragBound = true;
                        var updateFromMouse = function (ev) {
                            var rect = el.getBoundingClientRect();
                            var rw = rect.width || 136;
                            var rh = rect.height || 76;
                            var dx = ((ev.clientX - rect.left) / rw) * 136 - 68;
                            var dy = ((ev.clientY - rect.top) / rh) * 76 - 36;
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
            syncInOutControlsVisibility();
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

                // In AE_JS_builder live demo, restart playhead at 0s so In/Out animation plays immediately
                try {
                    if (cfg.animStyle !== "none" && typeof window !== "undefined" && window.aeRenderer && window.aeRenderer.comp) {
                        window.aeRenderer.comp.time = 0;
                        window.aeRenderer.isPlaying = true;
                    }
                } catch (ePlay) {}

                var animTag = (cfg.animStyle && cfg.animStyle !== "none") ? (" [" + cfg.animStyle + "]") : "";
                if (res.mode === "precomp") {
                    lblStatus.text = (res.isUpdate ? "Updated: " : "Built: ") + '"' + res.precompName + '"' + animTag;
                } else {
                    lblStatus.text = (res.isUpdate ? "Updated" : "Built") + " Comic Balloon (linked child)" + animTag + ".";
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
