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
//        Sparse Dotted to Solid, and Rovi (Inner-Glow Stroke Expanding Fill) —
//        all paired with AE Opacity Typewriter.
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

    var BALLOON_LAYER_TAG    = "AE_COMIC_BALLOON_SHAPE";
    var BALLOON_LAYER_NAME   = "Comic Balloon";
    var ROVI_FILL_LAYER_TAG  = "AE_COMIC_ROVI_FILL_SHAPE";
    var ROVI_FILL_LAYER_NAME = "Comic Balloon Rovi Fill";
    var TARGET_GUIDE_TAG     = "AE_COMIC_TARGET_GUIDE_SHAPE";
    var TARGET_GUIDE_PREFIX  = "Tail Target ";
    var STATE_EFFECT_NAME    = "Comic Balloon State";
    var PRESETS_STORAGE_KEY  = "AE_COMIC_BALLOON_PRESETS_V2";
    var PRESETS_FOLDER_NAME  = "comic_balloon_presets";
    var PRESETS_FILE_NAME    = "presets.json";

    var TYPEWRITER_ANIMATOR_NAME = "Comic Typewriter Animator";
    var BLOAT_MASK_NAME          = "Comic Bloat Mask";
    var TIMING_EFFECT_NAMES = [
        "Bubble Start Delay (s)",
        "Bubble Enable In",
        "Bubble In Time (s)",
        "Bubble Link Read Time",
        "Bubble Sec Per 25 Chars",
        "Bubble Read Time (s)",
        "Bubble Enable Out",
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
    var GEOMETRY_KEYS   = ["square", "rounded", "electric", "cloud", "explosion", "wobbly", "bubble_lines"];
    var GEOMETRY_LABELS = ["Square", "Rounded Corners", "Electric", "Cloud Shape (Thoughts)", "Explosion / Shout", "Wobbly", "Bubble Lines"];

    var TAIL_KEYS       = ["none", "line", "triangle", "curved_triangle", "lightning", "clouds"];
    var TAIL_LABELS     = ["None", "Line", "Triangle Sharp", "Curved Triangle", "Lightning Shaped", "Thinking Clouds"];

    var TAIL_PLACEMENT_KEYS   = ["perimeter", "target"];
    var TAIL_PLACEMENT_LABELS = [
        "1. Trim Paths Perimeter (%)",
        "2. Target Guide Layer (Closest Pt)"
    ];

    var STROKE_KEYS     = ["none", "solid", "variable", "dotted"];
    var STROKE_LABELS   = ["None", "Solid (Thickness)", "Variable Thickness (Min & Max)", "Dotted (Whisper)"];

    var ANIM_KEYS       = ["none", "clementine", "bloat", "sparse_dots", "rovi"];
    var ANIM_LABELS     = [
        "None (Static)",
        "1. Clementine (Trim from Tail)",
        "2. Bloat (Horizontal Expand Mask)",
        "3. Sparse Dotted to Solid",
        "4. Rovi (Inner Glow Stroke Fill)"
    ];

    function getDefaultPresets() {
        return {
            "Classic Speech": {
                geometry: "rounded",
                padX: 36,
                padY: 26,
                cornerRadius: 28,
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
                tailStyle: "triangle",
                tailPlacementMode: "perimeter",
                tailTargetSnapTip: true,
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
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
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
            "Electric Speech": {
                geometry: "electric",
                padX: 36,
                padY: 26,
                cornerRadius: 0,
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
                tailStyle: "curved_triangle",
                tailPosition: 52,
                tailStartWidth: 2.4,
                tailStart: 50.8,
                tailEnd: 53.2,
                tailOffset: 0,
                tailLength: 75,
                tailAngle: -10,
                tailCurve: 50,
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
            "Thought Cloud": {
                geometry: "cloud",
                padX: 40,
                padY: 30,
                cornerRadius: 28,
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 44,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
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
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 90,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
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
            "Wobbly": {
                geometry: "wobbly",
                padX: 38,
                padY: 28,
                cornerRadius: 28,
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 14,
                wobblyDepth: 10,
                wobblyWidthRand: 65,
                tailStyle: "triangle",
                tailPosition: 43,
                tailStartWidth: 2.5,
                tailStart: 41.75,
                tailEnd: 44.25,
                tailOffset: 0,
                tailLength: 85,
                tailAngle: -18,
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
            "Bubble Lines": {
                geometry: "bubble_lines",
                padX: 24,
                padY: 16,
                cornerRadius: 18,
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
                tailStyle: "triangle",
                tailPosition: 54,
                tailStartWidth: 2.5,
                tailStart: 52.75,
                tailEnd: 55.25,
                tailOffset: 0,
                tailLength: 80,
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
            "Whisper Dotted": {
                geometry: "rounded",
                padX: 36,
                padY: 26,
                cornerRadius: 36,
                electricPoint: 58,
                electricSkew: -22,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
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
                geometry: "electric",
                padX: 34,
                padY: 24,
                cornerRadius: 0,
                electricPoint: 62,
                electricSkew: 24,
                cloudPuffs: 12,
                cloudDepth: 42,
                cloudWidthRand: 0,
                spikeCount: 18,
                spikeDepth: 85,
                spikeWidthRand: 0,
                wobblyWaves: 0,
                wobblyDepth: 0,
                wobblyWidthRand: 65,
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
        if (raw.animStyle === "none" || raw.animStyle === "clementine" || raw.animStyle === "bloat" || raw.animStyle === "sparse_dots" || raw.animStyle === "rovi") {
            aStyle = raw.animStyle;
        }

        var gKey = def.geometry;
        if (raw.geometry === "square" || raw.geometry === "rounded" || raw.geometry === "electric" || raw.geometry === "cloud" || raw.geometry === "explosion" || raw.geometry === "wobbly" || raw.geometry === "bubble_lines") {
            gKey = raw.geometry;
        } else if (raw.geometry === "dyamond" || raw.geometry === "diamond") {
            gKey = "wobbly";
        } else if (raw.geometry === "bubble lines") {
            gKey = "bubble_lines";
        }

        var defaultWWaves = (gKey === "wobbly") ? 14 : 0;
        var defaultWDepth = (gKey === "wobbly") ? 10 : 0;
        var rawWWaves = (raw.wobblyWaves !== undefined) ? raw.wobblyWaves : raw.dyamondWaves;
        var rawWDepth = (raw.wobblyDepth !== undefined) ? raw.wobblyDepth : raw.dyamondDepth;
        var rawWRand  = (raw.wobblyWidthRand !== undefined) ? raw.wobblyWidthRand : raw.dyamondWidthRand;

        return {
            geometry: gKey,
            padX: clampNum(raw.padX, 0, 200, def.padX),
            padY: clampNum(raw.padY, 0, 200, def.padY),
            cornerRadius: clampNum(raw.cornerRadius, 0, 200, def.cornerRadius),
            electricPoint: Math.round(clampNum(raw.electricPoint, 10, 150, 58)),
            electricSkew: Math.round(clampNum(raw.electricSkew, -75, 75, -22)),
            cloudPuffs: Math.round(clampNum(raw.cloudPuffs, 6, 30, def.cloudPuffs)),
            cloudDepth: Math.round(clampNum(rawCloudD, 10, 120, def.cloudDepth)),
            cloudWidthRand: Math.round(clampNum(raw.cloudWidthRand, 0, 100, 0)),
            spikeCount: Math.round(clampNum(raw.spikeCount, 6, 40, def.spikeCount)),
            spikeDepth: Math.round(clampNum(rawSpikeD, 15, 220, def.spikeDepth)),
            spikeWidthRand: Math.round(clampNum(raw.spikeWidthRand, 0, 100, 0)),
            wobblyWaves: Math.round(clampNum(rawWWaves, 0, 36, defaultWWaves)),
            wobblyDepth: Math.round(clampNum(rawWDepth, 0, 50, defaultWDepth)),
            wobblyWidthRand: Math.round(clampNum(rawWRand !== undefined ? rawWRand : 65, 0, 100, 65)),
            tailStyle: (raw.tailStyle === "none" || raw.tailStyle === "line" || raw.tailStyle === "triangle" || raw.tailStyle === "curved_triangle" || raw.tailStyle === "lightning" || raw.tailStyle === "clouds") ? raw.tailStyle : def.tailStyle,
            tailPlacementMode: (raw.tailPlacementMode === "target") ? "target" : "perimeter",
            tailTargetSnapTip: (raw.tailTargetSnapTip !== undefined) ? Boolean(raw.tailTargetSnapTip) : true,
            tailPosition: tPos,
            tailStartWidth: tWidth,
            tailStart: computedStart,
            tailEnd: computedEnd,
            tailOffset: clampNum(raw.tailOffset, -360, 360, def.tailOffset),
            tailLength: clampNum(raw.tailLength, 15, 450, def.tailLength),
            tailAngle: clampNum(raw.tailAngle, -75, 75, def.tailAngle),
            tailCurve: Math.round(clampNum(raw.tailCurve, -100, 100, 45)),
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
            enableIn: (raw.enableIn !== undefined) ? Boolean(raw.enableIn) : true,
            inTime: Math.round(clampNum(raw.inTime, 0.1, 10, def.inTime) * 10) / 10,
            readTime: Math.round(clampNum(raw.readTime, 0.2, 60, def.readTime) * 10) / 10,
            linkReadTime: (raw.linkReadTime !== undefined) ? Boolean(raw.linkReadTime) : true,
            secPer25: Math.round(clampNum(raw.secPer25, 0.2, 10, def.secPer25) * 10) / 10,
            enableOut: (raw.enableOut !== undefined) ? Boolean(raw.enableOut) : true,
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

    function isRoviFillLayer(layer) {
        if (!layer) return false;
        try {
            if (layer.comment && String(layer.comment).indexOf(ROVI_FILL_LAYER_TAG) !== -1) return true;
            if (layer.name === ROVI_FILL_LAYER_NAME) return true;
        } catch (e) {}
        return false;
    }

    function isTargetGuideLayer(layer) {
        if (!layer) return false;
        try {
            if (layer.comment && String(layer.comment).indexOf(TARGET_GUIDE_TAG) !== -1) return true;
            if (layer.name && String(layer.name).indexOf(TARGET_GUIDE_PREFIX) === 0) return true;
        } catch (e) {}
        return false;
    }

    function extractTargetGuideHex(layer) {
        if (!layer) return "";
        try {
            var cmt = layer.comment ? String(layer.comment) : "";
            var tagPrefix = TARGET_GUIDE_TAG + ":";
            var idx = cmt.indexOf(tagPrefix);
            if (idx !== -1) {
                return trimStr(cmt.substring(idx + tagPrefix.length));
            }
            var nm = layer.name ? String(layer.name) : "";
            if (nm.indexOf(TARGET_GUIDE_PREFIX) === 0) {
                return trimStr(nm.substring(TARGET_GUIDE_PREFIX.length));
            }
        } catch (e) {}
        return "";
    }

    function findTargetGuideLayer(comp, hexCode) {
        if (!comp) return null;
        var count = getCompLayerCount(comp);
        var wantedName = hexCode ? (TARGET_GUIDE_PREFIX + hexCode) : "";
        var wantedTag  = hexCode ? (TARGET_GUIDE_TAG + ":" + hexCode) : TARGET_GUIDE_TAG;
        var fallbackGuide = null;
        for (var i = 1; i <= count; i++) {
            var lyr = getCompLayerAt(comp, i);
            if (!lyr || !isTargetGuideLayer(lyr)) continue;
            if (!fallbackGuide) fallbackGuide = lyr;
            if (hexCode) {
                var c = lyr.comment ? String(lyr.comment) : "";
                if (c.indexOf(wantedTag) !== -1 || lyr.name === wantedName) {
                    return lyr;
                }
            } else {
                return lyr;
            }
        }
        return hexCode ? null : fallbackGuide;
    }

    function removeTargetGuideLayer(comp, hexCode) {
        if (!comp) return;
        var count = getCompLayerCount(comp);
        for (var i = count; i >= 1; i--) {
            var lyr = getCompLayerAt(comp, i);
            if (!lyr || !isTargetGuideLayer(lyr)) continue;
            if (!hexCode || extractTargetGuideHex(lyr) === hexCode) {
                try { lyr.remove(); } catch (eRMG) {}
            }
        }
    }

    /**
     * Creates or reuses the draggable AE Guide Layer ("Tail Target <HEX>") in `comp`.
     * Preserves any existing Position when updating so user placement is never lost.
     */
    function ensureTargetGuideLayer(comp, hexCode, defaultWorldPos, refLayerAbove) {
        if (!comp) return null;
        var code = hexCode || generateHexId(4);
        var guideName = TARGET_GUIDE_PREFIX + code;
        var guideTag  = TARGET_GUIDE_TAG + ":" + code;
        var existing = findTargetGuideLayer(comp, code);
        if (existing) {
            try { existing.name = guideName; } catch (eGN) {}
            try { existing.comment = guideTag; } catch (eGC) {}
            try { existing.guideLayer = true; } catch (eG1) {}
            try { existing.enabled = true; } catch (eGE) {}
            return existing;
        }

        var gLayer = comp.layers.addShape();
        gLayer.name = guideName;
        try { gLayer.comment = guideTag; } catch (eGC2) {}
        try { gLayer.guideLayer = true; } catch (eG2) {}
        try { gLayer.label = 9; } catch (eGLb) {}
        try { gLayer.threeDLayer = false; } catch (eG3D) {}

        var gTr = gLayer.property("Transform");
        gTr.property("Anchor Point").setValue([0, 0]);
        gTr.property("Position").setValue([
            Math.round((defaultWorldPos[0] || 0) * 10) / 10,
            Math.round((defaultWorldPos[1] || 0) * 10) / 10
        ]);
        gTr.property("Scale").setValue([100, 100]);

        var gCont = gLayer.property("Contents") || gLayer.property("ADBE Root Vectors Group");
        if (gCont) {
            // 1. Outer Ring + Subtle Clickable Fill
            var ringGrp = gCont.addProperty("ADBE Vector Group");
            ringGrp.name = "Target Ring";
            var ringVec = ringGrp.property("Contents") || ringGrp.property("ADBE Vectors Group");
            if (ringVec) {
                var rPathG = ringVec.addProperty("ADBE Vector Shape - Group");
                var rP = rPathG.property("Path") || rPathG.property("ADBE Vector Shape");
                if (rP) {
                    var rC = circleShapeData(0, 0, 15);
                    var rS = new ShapeClass();
                    rS.vertices = rC.vertices;
                    rS.inTangents = rC.inTangents;
                    rS.outTangents = rC.outTangents;
                    rS.closed = true;
                    rP.setValue(rS);
                }
                var rFill = ringVec.addProperty("ADBE Vector Graphic - Fill");
                if (rFill) {
                    var rfC = rFill.property("Color") || rFill.property("ADBE Vector Fill Color");
                    var rfO = rFill.property("Opacity") || rFill.property("ADBE Vector Fill Opacity");
                    if (rfC) rfC.setValue([0.05, 0.85, 1.0, 1]);
                    if (rfO) rfO.setValue(18);
                }
                var rStr = ringVec.addProperty("ADBE Vector Graphic - Stroke");
                if (rStr) {
                    var rsC = rStr.property("Color") || rStr.property("ADBE Vector Stroke Color");
                    var rsW = rStr.property("Stroke Width") || rStr.property("ADBE Vector Stroke Width");
                    if (rsC) rsC.setValue([0.05, 0.88, 1.0, 1]);
                    if (rsW) rsW.setValue(2.5);
                }
            }

            // 2. Crosshair Ticks (4 cardinal hairlines)
            var ticks = [
                [[-23, 0], [-9, 0]],
                [[9, 0], [23, 0]],
                [[0, -23], [0, -9]],
                [[0, 9], [0, 23]]
            ];
            for (var ti = 0; ti < ticks.length; ti++) {
                var tGrp = gCont.addProperty("ADBE Vector Group");
                tGrp.name = "Crosshair " + (ti + 1);
                var tVec = tGrp.property("Contents") || tGrp.property("ADBE Vectors Group");
                if (!tVec) continue;
                var tPG = tVec.addProperty("ADBE Vector Shape - Group");
                var tP = tPG.property("Path") || tPG.property("ADBE Vector Shape");
                if (tP) {
                    var tS = new ShapeClass();
                    tS.vertices = ticks[ti];
                    tS.inTangents = [[0, 0], [0, 0]];
                    tS.outTangents = [[0, 0], [0, 0]];
                    tS.closed = false;
                    tP.setValue(tS);
                }
                var tStr = tVec.addProperty("ADBE Vector Graphic - Stroke");
                if (tStr) {
                    var tsC = tStr.property("Color") || tStr.property("ADBE Vector Stroke Color");
                    var tsW = tStr.property("Stroke Width") || tStr.property("ADBE Vector Stroke Width");
                    if (tsC) tsC.setValue([0.05, 0.88, 1.0, 1]);
                    if (tsW) tsW.setValue(2);
                }
            }

            // 3. Center Bullseye Dot
            var dotGrp = gCont.addProperty("ADBE Vector Group");
            dotGrp.name = "Center Dot";
            var dotVec = dotGrp.property("Contents") || dotGrp.property("ADBE Vectors Group");
            if (dotVec) {
                var dPG = dotVec.addProperty("ADBE Vector Shape - Group");
                var dP = dPG.property("Path") || dPG.property("ADBE Vector Shape");
                if (dP) {
                    var dC = circleShapeData(0, 0, 4);
                    var dS = new ShapeClass();
                    dS.vertices = dC.vertices;
                    dS.inTangents = dC.inTangents;
                    dS.outTangents = dC.outTangents;
                    dS.closed = true;
                    dP.setValue(dS);
                }
                var dFill = dotVec.addProperty("ADBE Vector Graphic - Fill");
                if (dFill) {
                    var dfC = dFill.property("Color") || dFill.property("ADBE Vector Fill Color");
                    if (dfC) dfC.setValue([1.0, 0.72, 0.08, 1]);
                }
            }
        }

        if (refLayerAbove) {
            try { gLayer.moveBefore(refLayerAbove); } catch (eGMv) {}
        }
        return gLayer;
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
            if (!lyr || lyr === textLayer || isComicBalloonShapeLayer(lyr) || isRoviFillLayer(lyr) || isTargetGuideLayer(lyr)) continue;
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
            if (isTargetGuideLayer(lyr)) {
                var gHex = extractTargetGuideHex(lyr);
                var gTot = getCompLayerCount(comp);
                for (var gi = 1; gi <= gTot; gi++) {
                    var gl = getCompLayerAt(comp, gi);
                    if (!gl || gl === lyr) continue;
                    var st = readLayerStateEffect(gl);
                    if (isComicBalloonPrecompLayer(gl) && (!gHex || (st && st.precompHex === gHex) || gl.name === ("comic balloon " + gHex))) {
                        var gpItem = gl.source;
                        var gInTxt = null, gInBln = null;
                        var gpCnt = getCompLayerCount(gpItem);
                        for (var gk = 1; gk <= gpCnt; gk++) {
                            var gil = getCompLayerAt(gpItem, gk);
                            if (!gInTxt && isTextLayer(gil)) gInTxt = gil;
                            if (!gInBln && isComicBalloonShapeLayer(gil)) gInBln = gil;
                        }
                        if (gInTxt) {
                            return {
                                mode: "precomp",
                                comp: comp,
                                precompLayer: gl,
                                precompItem: gpItem,
                                textLayer: gInTxt,
                                balloonLayer: gInBln
                            };
                        }
                    }
                    if (isTextLayer(gl) && st && (!gHex || st.precompHex === gHex)) {
                        return {
                            mode: "text",
                            comp: comp,
                            textLayer: gl,
                            balloonLayer: findChildBalloonForText(comp, gl)
                        };
                    }
                }
            }
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
            var sampleStr = "POW! Comic Balloon\nReady for Action Right Now!\nLet's Go!";
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

        // 4. Remove Rovi Inner-Glow Fill helper layer if present
        try {
            var ownerComp = textLayer.containingComp || (balloonLayer ? balloonLayer.containingComp : null);
            if (ownerComp) {
                var lCnt = getCompLayerCount(ownerComp);
                for (var ri = lCnt; ri >= 1; ri--) {
                    var candL = getCompLayerAt(ownerComp, ri);
                    if (candL && isRoviFillLayer(candL) && (!candL.parent || candL.parent === textLayer)) {
                        try { candL.remove(); } catch (eRR) {}
                    }
                }
            }
        } catch (eRoviCln) {}
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
     * Measures each visual line of `textLayer` (supporting both Point Text line breaks
     * and Paragraph Box Text word-wrapping, plus Left / Center / Right justification),
     * returning line intervals relative to `[0, 0]` (the centered text anchor point).
     */
    function measureTextLineBoxes(comp, textLayer, bounds) {
        var tw = (bounds && bounds.width > 0) ? bounds.width : 200;
        var th = (bounds && bounds.height > 0) ? bounds.height : 60;
        var doc = getTextDocumentSafe(textLayer);
        if (!doc) {
            return [{ left: -tw * 0.5, right: tw * 0.5, cy: 0, fontH: th }];
        }

        var fullText = String((typeof doc === "object" && doc.text !== undefined) ? doc.text : doc);
        var fontSize = (typeof doc === "object" && Number(doc.fontSize) > 0) ? Number(doc.fontSize) : 36;
        var isBox = Boolean(typeof doc === "object" && doc.boxText && doc.boxTextSize);
        var boxWidth = isBox ? Number(doc.boxTextSize[0]) : tw;

        var just = "left";
        try {
            var jv = doc.justification;
            if (jv === 7414 || jv === 2 || jv === "center" || jv === "CENTER_JUSTIFY" ||
                (typeof ParagraphJustification !== "undefined" && jv === ParagraphJustification.CENTER_JUSTIFY)) {
                just = "center";
            } else if (jv === 7413 || jv === 1 || jv === "right" || jv === "RIGHT_JUSTIFY" ||
                (typeof ParagraphJustification !== "undefined" && jv === ParagraphJustification.RIGHT_JUSTIFY)) {
                just = "right";
            }
        } catch (eJ) {}

        var rawParas = fullText.split(/\r\n|\r|\n/);
        var visualLines = [];
        var lineWidths = [];
        var measLayer = null;

        try {
            if (comp && comp.layers && typeof comp.layers.addText === "function") {
                measLayer = comp.layers.addText("");
                measLayer.enabled = true;
                try { measLayer.property("Transform").property("Position").setValue([-9999, -9999]); } catch (eMP) {}
                var mDocProp = measLayer.property("Source Text");
                var mDoc = mDocProp ? mDocProp.value : null;
                if (mDoc && typeof mDoc === "object") {
                    mDoc.fontSize = fontSize;
                    if (doc.font) { try { mDoc.font = doc.font; } catch (eMF) {} }
                    if (doc.tracking !== undefined) { try { mDoc.tracking = doc.tracking; } catch (eMT) {} }
                    mDoc.applyStroke = false;
                    mDoc.applyFill = true;
                    try { mDoc.boxText = false; } catch (eMB) {}
                    try { mDocProp.setValue(mDoc); } catch (eMS) {}
                }

                var curT = comp.time || 0;
                var rawMeas = function (str) {
                    if (!str || str.length === 0) return 0;
                    if (mDoc && typeof mDoc === "object" && mDocProp) {
                        mDoc.text = str;
                        mDocProp.setValue(mDoc);
                    } else if (mDocProp) {
                        mDocProp.setValue(str);
                    }
                    var sr = measLayer.sourceRectAtTime(curT, false);
                    return (sr && sr.width > 0) ? sr.width : 0;
                };
                var pipeW = rawMeas("|");
                var measureAdv = function (str) {
                    if (!str || str.length === 0) return 0;
                    return Math.max(0, rawMeas(str + "|") - pipeW);
                };

                var pi, pw;
                if (!isBox || boxWidth <= 0) {
                    visualLines = rawParas;
                } else {
                    for (pi = 0; pi < rawParas.length; pi++) {
                        var words = rawParas[pi].match(/\S+/g) || [];
                        if (words.length === 0) {
                            visualLines.push("");
                            continue;
                        }
                        var curLine = words[0];
                        for (pw = 1; pw < words.length; pw++) {
                            var cand = curLine + " " + words[pw];
                            if (measureAdv(cand) > boxWidth && curLine.length > 0) {
                                visualLines.push(curLine);
                                curLine = words[pw];
                            } else {
                                curLine = cand;
                            }
                        }
                        visualLines.push(curLine);
                    }
                }

                for (pi = 0; pi < visualLines.length; pi++) {
                    var cleanStr = trimStr(visualLines[pi]);
                    if (cleanStr.length > 0) {
                        lineWidths.push({ idx: pi, width: Math.max(8, measureAdv(cleanStr)) });
                    }
                }
            }
        } catch (eMeas) {
        } finally {
            if (measLayer) {
                try { measLayer.remove(); } catch (eRemM) {}
            }
        }

        // Fallback proportional character-length widths if offscreen measure was unavailable
        if (lineWidths.length === 0) {
            for (var fi = 0; fi < rawParas.length; fi++) {
                var fsStr = trimStr(rawParas[fi]);
                if (fsStr.length > 0) {
                    lineWidths.push({ idx: fi, width: Math.max(12, fsStr.length * fontSize * 0.52) });
                }
            }
        }
        if (lineWidths.length === 0) {
            return [{ left: -tw * 0.5, right: tw * 0.5, cy: 0, fontH: th }];
        }

        var maxMeas = 0;
        var li;
        for (li = 0; li < lineWidths.length; li++) {
            if (lineWidths[li].width > maxMeas) maxMeas = lineWidths[li].width;
        }
        var wRatio = (maxMeas > 1e-3) ? (tw / maxMeas) : 1.0;

        var mCount = lineWidths.length;
        var effFontH = (mCount === 1) ? th : Math.min(fontSize, th / (1.0 + 0.55 * (mCount - 1)));
        var stepY = (mCount > 1) ? ((th - effFontH) / (mCount - 1)) : 0;

        var specs = [];
        for (li = 0; li < mCount; li++) {
            var sw = Math.max(12, Math.min(tw, lineWidths[li].width * wRatio));
            var lX, rX;
            if (just === "center") {
                lX = -sw * 0.5;
                rX =  sw * 0.5;
            } else if (just === "right") {
                lX = (tw * 0.5) - sw;
                rX =  tw * 0.5;
            } else {
                lX = -tw * 0.5;
                rX = -tw * 0.5 + sw;
            }
            var cy = (mCount === 1) ? 0 : (-th * 0.5 + effFontH * 0.5 + li * stepY);
            specs.push({
                left: lX,
                right: rX,
                cy: cy,
                fontH: effFontH
            });
        }
        return specs;
    }

    /**
     * Builds the unified closed clockwise perimeter for "bubble_lines" ("Bubble Lines"):
     * inflates each text line like a thick marker highlight and merges all line bands
     * into a single y-monotone contour with smooth rounded outer corners & inner step fillets.
     */
    function buildBubbleLinesPerimeterSegments(textW, textH, cfg, lineSpecs) {
        var effPadX = Math.max(6, cfg.padX !== undefined ? cfg.padX : 24);
        var effPadY = Math.max(4, cfg.padY !== undefined ? cfg.padY : 16);
        var lines = lineSpecs;

        if (!lines || lines.length === 0) {
            if (cfg._isPreviewIcon) {
                var pH = textH / 3.0;
                lines = [
                    { left: -textW * 0.50, right: textW * 0.50, cy: -textH * 0.34, fontH: pH },
                    { left: -textW * 0.50, right: textW * 0.24, cy: 0,             fontH: pH },
                    { left: -textW * 0.50, right: -textW * 0.04, cy: textH * 0.34, fontH: pH }
                ];
            } else {
                lines = [{ left: -textW * 0.5, right: textW * 0.5, cy: 0, fontH: textH }];
            }
        }

        var nL = lines.length;
        var rects = [];
        var i, j;

        for (i = 0; i < nL; i++) {
            var ln = lines[i];
            var fh = Math.max(8, ln.fontH || (textH / nL));
            var minAdjHalfH = fh * 0.5 + effPadY;
            if (i > 0) {
                minAdjHalfH = Math.max(minAdjHalfH, Math.abs(ln.cy - lines[i - 1].cy) * 0.54);
            }
            if (i < nL - 1) {
                minAdjHalfH = Math.max(minAdjHalfH, Math.abs(lines[i + 1].cy - ln.cy) * 0.54);
            }
            rects.push({
                L: ln.left - effPadX,
                R: ln.right + effPadX,
                y0: ln.cy - minAdjHalfH,
                y1: ln.cy + minAdjHalfH
            });
        }

        // Snap near-equal left/right line edges (< 4px) so almost-identical lines form a flush wall
        var snapTol = cfg._isPreviewIcon ? 1.5 : 5.0;
        for (i = 0; i < rects.length - 1; i++) {
            if (Math.abs(rects[i + 1].L - rects[i].L) < snapTol) {
                var minL = Math.min(rects[i].L, rects[i + 1].L);
                rects[i].L = minL;
                rects[i + 1].L = minL;
            }
            if (Math.abs(rects[i + 1].R - rects[i].R) < snapTol) {
                var maxR = Math.max(rects[i].R, rects[i + 1].R);
                rects[i].R = maxR;
                rects[i + 1].R = maxR;
            }
        }

        // Guarantee generous horizontal bridge between consecutive lines so contour is 100% single-piece
        var minBridge = cfg._isPreviewIcon ? 10 : Math.max(20, Math.min(44, textW * 0.22));
        for (i = 0; i < rects.length - 1; i++) {
            var ov = Math.min(rects[i].R, rects[i + 1].R) - Math.max(rects[i].L, rects[i + 1].L);
            if (ov < minBridge) {
                var need = (minBridge - ov) * 0.5 + 1.0;
                if (rects[i].R < rects[i + 1].R) rects[i].R += need; else rects[i + 1].R += need;
                if (rects[i].L > rects[i + 1].L) rects[i].L -= need; else rects[i + 1].L -= need;
            }
        }

        // 1D vertical scanline union of overlapping line highlight rectangles
        var rawYs = [];
        for (i = 0; i < rects.length; i++) {
            rawYs.push(rects[i].y0);
            rawYs.push(rects[i].y1);
        }
        rawYs.sort(function (a, b) { return a - b; });

        var ys = [rawYs[0]];
        for (i = 1; i < rawYs.length; i++) {
            if (rawYs[i] - ys[ys.length - 1] > 0.5) {
                ys.push(rawYs[i]);
            }
        }

        var slabs = [];
        for (i = 0; i < ys.length - 1; i++) {
            var ym = 0.5 * (ys[i] + ys[i + 1]);
            var sL = 1e9;
            var sR = -1e9;
            for (j = 0; j < rects.length; j++) {
                if (ym >= rects[j].y0 - 0.1 && ym <= rects[j].y1 + 0.1) {
                    if (rects[j].L < sL) sL = rects[j].L;
                    if (rects[j].R > sR) sR = rects[j].R;
                }
            }
            if (sL < sR) {
                if (slabs.length > 0 &&
                    Math.abs(slabs[slabs.length - 1].L - sL) < 1.0 &&
                    Math.abs(slabs[slabs.length - 1].R - sR) < 1.0) {
                    slabs[slabs.length - 1].y1 = ys[i + 1];
                } else {
                    slabs.push({ y0: ys[i], y1: ys[i + 1], L: sL, R: sR });
                }
            }
        }

        // Absorb ultra-thin vertical slivers (< 4px) into neighboring slab for clean fillets
        var minSlabH = cfg._isPreviewIcon ? 2.0 : 5.0;
        for (i = slabs.length - 1; i >= 0; i--) {
            if (slabs.length > 1 && (slabs[i].y1 - slabs[i].y0) < minSlabH) {
                if (i > 0) {
                    slabs[i - 1].y1 = slabs[i].y1;
                    slabs[i - 1].L = Math.min(slabs[i - 1].L, slabs[i].L);
                    slabs[i - 1].R = Math.max(slabs[i - 1].R, slabs[i].R);
                    slabs.splice(i, 1);
                } else {
                    slabs[1].y0 = slabs[0].y0;
                    slabs[1].L = Math.min(slabs[1].L, slabs[0].L);
                    slabs[1].R = Math.max(slabs[1].R, slabs[0].R);
                    slabs.splice(0, 1);
                }
            }
        }

        // Trace clockwise rectilinear polygon starting at top-right corner of top slab
        var rawPts = [];
        var nS = slabs.length;
        rawPts.push([slabs[0].R, slabs[0].y0]);
        for (i = 0; i < nS; i++) {
            rawPts.push([slabs[i].R, slabs[i].y1]);
            if (i < nS - 1 && Math.abs(slabs[i + 1].R - slabs[i].R) > 0.5) {
                rawPts.push([slabs[i + 1].R, slabs[i].y1]);
            }
        }
        rawPts.push([slabs[nS - 1].L, slabs[nS - 1].y1]);
        for (i = nS - 1; i >= 0; i--) {
            rawPts.push([slabs[i].L, slabs[i].y0]);
            if (i > 0 && Math.abs(slabs[i - 1].L - slabs[i].L) > 0.5) {
                rawPts.push([slabs[i - 1].L, slabs[i].y0]);
            }
        }

        // Remove duplicate or collinear points so every vertex is a true 90-degree corner
        var dedup = [];
        for (i = 0; i < rawPts.length; i++) {
            var prevP = dedup.length > 0 ? dedup[dedup.length - 1] : rawPts[rawPts.length - 1];
            if (dist2D(prevP, rawPts[i]) > 0.5) {
                dedup.push(rawPts[i]);
            }
        }
        var corners = [];
        var nD = dedup.length;
        for (i = 0; i < nD; i++) {
            var pPrev = dedup[(i - 1 + nD) % nD];
            var pCur  = dedup[i];
            var pNext = dedup[(i + 1) % nD];
            var vx1 = pCur[0] - pPrev[0], vy1 = pCur[1] - pPrev[1];
            var vx2 = pNext[0] - pCur[0], vy2 = pNext[1] - pCur[1];
            var l1 = Math.sqrt(vx1 * vx1 + vy1 * vy1) || 1;
            var l2 = Math.sqrt(vx2 * vx2 + vy2 * vy2) || 1;
            var cross = (vx1 / l1) * (vy2 / l2) - (vy1 / l1) * (vx2 / l2);
            if (Math.abs(cross) > 0.05) {
                corners.push(pCur);
            }
        }

        var nC = corners.length;
        var cRad = Math.max(0, cfg.cornerRadius !== undefined ? cfg.cornerRadius : 18);
        var KB = 0.5522847498307936;
        var cornerSpecs = [];

        for (i = 0; i < nC; i++) {
            var cPrev = corners[(i - 1 + nC) % nC];
            var cCur  = corners[i];
            var cNext = corners[(i + 1) % nC];
            var dxIn  = cCur[0] - cPrev[0], dyIn  = cCur[1] - cPrev[1];
            var dxOut = cNext[0] - cCur[0], dyOut = cNext[1] - cCur[1];
            var lenIn  = Math.sqrt(dxIn * dxIn + dyIn * dyIn) || 1;
            var lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut) || 1;
            var uIn  = [dxIn / lenIn, dyIn / lenIn];
            var uOut = [dxOut / lenOut, dyOut / lenOut];
            var rk = Math.min(cRad, lenIn * 0.46, lenOut * 0.46);

            cornerSpecs.push({
                arcStart: [cCur[0] - uIn[0] * rk,  cCur[1] - uIn[1] * rk],
                arcEnd:   [cCur[0] + uOut[0] * rk, cCur[1] + uOut[1] * rk],
                out0:     [uIn[0] * rk * KB,       uIn[1] * rk * KB],
                in1:      [-uOut[0] * rk * KB,     -uOut[1] * rk * KB],
                rk:       rk
            });
        }

        // Start closed perimeter at Top-Center of the top highlight edge (between corner nC-1 and corner 0)
        var topLeftEnd    = cornerSpecs[nC - 1].arcEnd;
        var topRightStart = cornerSpecs[0].arcStart;
        var topMid = [0.5 * (topLeftEnd[0] + topRightStart[0]), 0.5 * (topLeftEnd[1] + topRightStart[1])];

        var outSegs = [];
        function pushBLSeg(p0, out0, in1, p1, isCorner) {
            if (dist2D(p0, p1) > 0.05) {
                outSegs.push({ p0: p0, out0: out0, in1: in1, p1: p1, isCornerArc: Boolean(isCorner) });
            }
        }

        pushBLSeg(topMid, [0, 0], [0, 0], topRightStart, false);
        for (i = 0; i < nC; i++) {
            var cs = cornerSpecs[i];
            if (cs.rk > 0.05) {
                pushBLSeg(cs.arcStart, cs.out0, cs.in1, cs.arcEnd, true);
            }
            if (i < nC - 1) {
                pushBLSeg(cs.arcEnd, [0, 0], [0, 0], cornerSpecs[i + 1].arcStart, false);
            } else {
                pushBLSeg(cs.arcEnd, [0, 0], [0, 0], topMid, false);
            }
        }

        return annotateArcLengths(outSegs);
    }

    /**
     * Builds the classic 6-sided angular pointed-end "Electric" comic balloon (<=======>)
     * starting clockwise at Top-Center (0, -eB), with configurable side-tip pointiness,
     * vertical tip skew, and optional circular corner fillets.
     */
    function buildElectricPerimeterSegments(textW, textH, cfg, extraPad) {
        var padX = (cfg.padX !== undefined ? cfg.padX : 36) + (extraPad || 0);
        var padY = (cfg.padY !== undefined ? cfg.padY : 26) + (extraPad || 0);
        var w = Math.max(24, textW + padX * 2);
        var h = Math.max(24, textH + padY * 2);
        var a = w * 0.5;
        var eB = h * 0.5;

        var ePointPct = clampNum(cfg.electricPoint, 10, 150, 58);
        var eSkewPct  = clampNum(cfg.electricSkew, -75, 75, -22);

        // Guarantee full horizontal text clearance inside the flat top/bottom rails
        var minClearX = cfg._isPreviewIcon ? 2 : Math.max(8, padX * 0.48);
        var innerA = Math.max(textW * 0.5 + minClearX, a * 0.86);
        var pointJut = Math.max(cfg._isPreviewIcon ? 5 : 10, eB * (ePointPct / 100.0));
        var tipA = innerA + pointJut;

        var skewShift = (eSkewPct / 100.0) * eB * 0.65;
        var leftTipY  =  skewShift;
        var rightTipY = -skewShift;

        // 6 clockwise polygon corners starting at Top-Right
        var ec = [
            [ innerA, -eB],
            [ tipA,    rightTipY],
            [ innerA,  eB],
            [-innerA,  eB],
            [-tipA,    leftTipY],
            [-innerA, -eB]
        ];

        var eRad = Math.max(0, cfg.cornerRadius || 0);
        var eSpecs = [];
        var i;
        for (i = 0; i < 6; i++) {
            var cPrev = ec[(i + 5) % 6];
            var cCur  = ec[i];
            var cNext = ec[(i + 1) % 6];

            var dxIn  = cCur[0] - cPrev[0], dyIn  = cCur[1] - cPrev[1];
            var dxOut = cNext[0] - cCur[0], dyOut = cNext[1] - cCur[1];
            var lenIn  = Math.sqrt(dxIn * dxIn + dyIn * dyIn) || 1;
            var lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut) || 1;
            var uIn  = [dxIn / lenIn, dyIn / lenIn];
            var uOut = [dxOut / lenOut, dyOut / lenOut];

            var dotTurn = clampNum(uIn[0] * uOut[0] + uIn[1] * uOut[1], -0.999, 0.999);
            var theta   = Math.acos(dotTurn);
            var tanHalf = Math.tan(theta * 0.5);

            var trimD = 0;
            var hLen  = 0;
            if (eRad > 0.05 && tanHalf > 1e-4) {
                trimD = Math.min(eRad * tanHalf, lenIn * 0.45, lenOut * 0.45);
                var rEff = trimD / tanHalf;
                hLen = (4.0 / 3.0) * Math.tan(theta * 0.25) * rEff;
            }

            eSpecs.push({
                arcStart: [cCur[0] - uIn[0] * trimD,  cCur[1] - uIn[1] * trimD],
                arcEnd:   [cCur[0] + uOut[0] * trimD, cCur[1] + uOut[1] * trimD],
                out0:     [uIn[0] * hLen,             uIn[1] * hLen],
                in1:      [-uOut[0] * hLen,           -uOut[1] * hLen],
                trimD:    trimD
            });
        }

        var topMid = [0.5 * (eSpecs[5].arcEnd[0] + eSpecs[0].arcStart[0]), -eB];
        var eSegs = [];
        function pushESeg(p0, out0, in1, p1, isCorner) {
            if (dist2D(p0, p1) > 0.05) {
                eSegs.push({ p0: p0, out0: out0, in1: in1, p1: p1, isCornerArc: Boolean(isCorner) });
            }
        }

        pushESeg(topMid, [0, 0], [0, 0], eSpecs[0].arcStart, false);
        for (i = 0; i < 6; i++) {
            var es = eSpecs[i];
            if (es.trimD > 0.05) {
                pushESeg(es.arcStart, es.out0, es.in1, es.arcEnd, true);
            }
            if (i < 5) {
                pushESeg(es.arcEnd, [0, 0], [0, 0], eSpecs[i + 1].arcStart, false);
            } else {
                pushESeg(es.arcEnd, [0, 0], [0, 0], topMid, false);
            }
        }

        return annotateArcLengths(eSegs);
    }

    function segUnitStartDir(seg) {
        var tx = seg.out0[0], ty = seg.out0[1];
        if (tx * tx + ty * ty < 1e-6) {
            var pA = evalCubicPt(seg.p0, seg.out0, seg.in1, seg.p1, 0.02);
            tx = pA[0] - seg.p0[0];
            ty = pA[1] - seg.p0[1];
        }
        var m = Math.sqrt(tx * tx + ty * ty) || 1;
        return [tx / m, ty / m];
    }

    function segUnitEndDir(seg) {
        var tx = -seg.in1[0], ty = -seg.in1[1];
        if (tx * tx + ty * ty < 1e-6) {
            var pB = evalCubicPt(seg.p0, seg.out0, seg.in1, seg.p1, 0.98);
            tx = seg.p1[0] - pB[0];
            ty = seg.p1[1] - pB[1];
        }
        var m = Math.sqrt(tx * tx + ty * ty) || 1;
        return [tx / m, ty / m];
    }

    function rotateClosedSegmentsToTopCenter(segs) {
        if (!segs || segs.length === 0) return segs;
        annotateArcLengths(segs);

        var bestU = 0;
        var bestScore = 1e18;
        var s, uCand, pt, score;
        var STEPS = 96;
        for (s = 0; s < STEPS; s++) {
            uCand = s / STEPS;
            pt = evaluatePerimeterAtU(segs, uCand).point;
            if (pt[1] <= 0) {
                score = Math.abs(pt[0]) + Math.max(0, pt[1]) * 10.0;
                if (score < bestScore) {
                    bestScore = score;
                    bestU = uCand;
                }
            }
        }
        // Fine local search around bestU
        var stepFine = 1.0 / (STEPS * 8);
        for (s = -8; s <= 8; s++) {
            uCand = (((bestU + s * stepFine) % 1) + 1) % 1;
            pt = evaluatePerimeterAtU(segs, uCand).point;
            if (pt[1] <= 0) {
                score = Math.abs(pt[0]);
                if (score < bestScore) {
                    bestScore = score;
                    bestU = uCand;
                }
            }
        }

        if (bestU <= 1e-4 || bestU >= 1.0 - 1e-4) {
            return segs;
        }

        var ev = evaluatePerimeterAtU(segs, bestU);
        var hitIdx = ev.segIndex;
        var hitT   = ev.t;
        var n = segs.length;
        var rotated = [];
        var i;

        if (hitT <= 1e-3) {
            for (i = 0; i < n; i++) {
                rotated.push(segs[(hitIdx + i) % n]);
            }
        } else if (hitT >= 1.0 - 1e-3) {
            for (i = 0; i < n; i++) {
                rotated.push(segs[(hitIdx + 1 + i) % n]);
            }
        } else {
            var sp = splitCubicSegment(segs[hitIdx], hitT);
            if (dist2D(sp.right.p0, sp.right.p1) > 0.05) rotated.push(sp.right);
            for (i = 1; i < n; i++) {
                rotated.push(segs[(hitIdx + i) % n]);
            }
            if (dist2D(sp.left.p0, sp.left.p1) > 0.05) rotated.push(sp.left);
        }

        return rotated.length > 0 ? annotateArcLengths(rotated) : segs;
    }

    /**
     * Universal Wobbly Outline modifier applicable to ALL balloon shapes:
     *   - When wobblyWaves <= 0 or wobblyDepth <= 0: returns `baseSegs` untouched (crisp outline).
     *   - For smooth closed contours (Rounded Corners, Wobbly, filleted Electric / Bubble Lines):
     *     applies closed-loop G1 centripetal Catmull-Rom waves with corner-shoulder protection.
     *   - For sharp-feature contours (Square, crisp Electric, Cloud cusps, Explosion spikes):
     *     pins every sharp corner/cusp/spike tip while making the smooth/straight edges between
     *     them organically wobbly, then re-anchors `u = 0` cleanly at Top-Center.
     */
    function applyWobblyToPerimeterSegments(baseSegs, cfg, rectCornerGuard) {
        if (!baseSegs || baseSegs.length === 0) return baseSegs;
        var rawW = (cfg.wobblyWaves !== undefined) ? cfg.wobblyWaves : cfg.dyamondWaves;
        var rawD = (cfg.wobblyDepth !== undefined) ? cfg.wobblyDepth : cfg.dyamondDepth;
        var rawR = (cfg.wobblyWidthRand !== undefined) ? cfg.wobblyWidthRand : cfg.dyamondWidthRand;

        var waves     = Math.round(clampNum(rawW, 0, 36, 0));
        var wDepthPct = clampNum(rawD, 0, 50, 0);
        var wRandPct  = clampNum(rawR !== undefined ? rawR : 65, 0, 100, 65);

        if (waves <= 0 || wDepthPct <= 0.01) {
            return baseSegs;
        }

        var nBase = baseSegs.length;
        var sharpIdx = [];
        var i;
        for (i = 0; i < nBase; i++) {
            var prevSeg = baseSegs[(i - 1 + nBase) % nBase];
            var curSeg  = baseSegs[i];
            var dPrev = segUnitEndDir(prevSeg);
            var dCur  = segUnitStartDir(curSeg);
            var dotJ  = dPrev[0] * dCur[0] + dPrev[1] * dCur[1];
            if (dotJ < 0.92) {
                sharpIdx.push(i);
            }
        }

        // Bounding half-extents for inward clamping
        var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (i = 0; i < nBase; i++) {
            var bp = baseSegs[i].p0;
            if (bp[0] < minX) minX = bp[0];
            if (bp[0] > maxX) maxX = bp[0];
            if (bp[1] < minY) minY = bp[1];
            if (bp[1] > maxY) maxY = bp[1];
        }
        var halfW = Math.max(12, 0.5 * (maxX - minX));
        var halfH = Math.max(12, 0.5 * (maxY - minY));
        var maxInward = Math.min(halfW, halfH) * 0.24;
        var rFrac = wRandPct / 100.0;
        var tension = 0.36;

        // CASE A: Smooth closed contour (no sharp vertices)
        if (sharpIdx.length === 0) {
            var numPts = Math.max(4, waves * 2);
            var uWaves = computePerimeterIntervals(baseSegs, numPts, wRandPct, 31.7);
            var evals = [];
            var wi;
            for (wi = 0; wi < numPts; wi++) {
                evals.push(evaluatePerimeterAtU(baseSegs, uWaves[wi]));
            }

            var wavePts = [];
            for (wi = 0; wi < numPts; wi++) {
                var prevEv = evals[(wi - 1 + numPts) % numPts];
                var curEv  = evals[wi];
                var nextEv = evals[(wi + 1) % numPts];
                var localSpan = 0.5 * (dist2D(prevEv.point, curEv.point) + dist2D(curEv.point, nextEv.point));

                var ampMod = 1.0;
                if (rFrac > 1e-4) {
                    var aSeed = Math.sin((wi + 1) * 41.317 + waves * 19.73 + 7.13) * 43758.5453;
                    var aSigned = (aSeed - Math.floor(aSeed)) * 2.0 - 1.0;
                    ampMod = Math.max(0.20, 1.0 + 0.65 * rFrac * aSigned);
                }

                var sign = (wi % 2 === 0) ? 1.0 : -1.0;
                var mag  = localSpan * (wDepthPct / 100.0) * ampMod;

                var inProtectedCorner = false;
                if (rectCornerGuard) {
                    var inCornerX = Math.abs(curEv.point[0]) > (rectCornerGuard.dA - rectCornerGuard.dR * 1.15);
                    var inCornerY = Math.abs(curEv.point[1]) > (rectCornerGuard.dB - rectCornerGuard.dR * 1.15);
                    inProtectedCorner = (inCornerX && inCornerY);
                } else if (baseSegs[curEv.segIndex] && baseSegs[curEv.segIndex].isCornerArc) {
                    inProtectedCorner = true;
                }

                if (inProtectedCorner) {
                    if (sign < 0) {
                        mag *= 0.15;
                    } else {
                        mag *= 0.45;
                    }
                } else if (sign < 0 && mag > maxInward) {
                    mag = maxInward;
                }

                var disp = sign * mag;
                wavePts.push([
                    curEv.point[0] + curEv.normal[0] * disp,
                    curEv.point[1] + curEv.normal[1] * disp
                ]);
            }

            var inHandles  = [];
            var outHandles = [];
            for (wi = 0; wi < numPts; wi++) {
                var pPrev = wavePts[(wi - 1 + numPts) % numPts];
                var pCur  = wavePts[wi];
                var pNext = wavePts[(wi + 1) % numPts];

                var dx1 = pCur[0] - pPrev[0];
                var dy1 = pCur[1] - pPrev[1];
                var d1  = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;

                var dx2 = pNext[0] - pCur[0];
                var dy2 = pNext[1] - pCur[1];
                var d2  = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;

                var tx = (dx1 / d1) * d2 + (dx2 / d2) * d1;
                var ty = (dy1 / d1) * d2 + (dy2 / d2) * d1;
                var tMag = Math.sqrt(tx * tx + ty * ty) || 1;
                tx /= tMag;
                ty /= tMag;

                inHandles.push([-tx * d1 * tension, -ty * d1 * tension]);
                outHandles.push([tx * d2 * tension,  ty * d2 * tension]);
            }

            var outSmooth = [];
            for (wi = 0; wi < numPts; wi++) {
                var nxt = (wi + 1) % numPts;
                outSmooth.push({
                    p0: wavePts[wi],
                    out0: outHandles[wi],
                    in1: inHandles[nxt],
                    p1: wavePts[nxt]
                });
            }
            return annotateArcLengths(outSmooth);
        }

        // CASE B: Sharp-cornered / cusped / spiked shapes — pin sharp vertices & wobble sub-chains
        var K = sharpIdx.length;
        var chains = [];
        var totalPerim = 0;
        var c, sIdx, endIdx;
        for (c = 0; c < K; c++) {
            sIdx = sharpIdx[c];
            endIdx = sharpIdx[(c + 1) % K];
            var sub = [];
            var walk = sIdx;
            var guard = 0;
            var isCurvedChain = false;
            while (guard < nBase + 1) {
                var sg = baseSegs[walk];
                sub.push({
                    p0: sg.p0,
                    out0: sg.out0,
                    in1: sg.in1,
                    p1: sg.p1
                });
                if (sg.out0[0] * sg.out0[0] + sg.out0[1] * sg.out0[1] > 0.05 ||
                    sg.in1[0] * sg.in1[0] + sg.in1[1] * sg.in1[1] > 0.05) {
                    isCurvedChain = true;
                }
                walk = (walk + 1) % nBase;
                guard++;
                if (walk === endIdx) break;
            }
            annotateArcLengths(sub);
            var cLen = 0;
            for (i = 0; i < sub.length; i++) cLen += sub[i].arcLen;
            totalPerim += cLen;
            chains.push({ segs: sub, len: cLen, curved: isCurvedChain });
        }

        var totalHalfWaves = Math.max(2, waves * 2);
        var accLen = 0;
        var prevQuota = 0;
        var globalWaveIdx = 0;
        var sharpOutSegs = [];

        for (c = 0; c < K; c++) {
            var ch = chains[c];
            accLen += ch.len;
            var curQuota = Math.round((accLen / Math.max(1e-4, totalPerim)) * totalHalfWaves);
            var m = Math.max(0, curQuota - prevQuota);
            prevQuota = curQuota;

            if (m <= 0 || ch.len < 4.0) {
                for (i = 0; i < ch.segs.length; i++) {
                    sharpOutSegs.push(ch.segs[i]);
                }
                continue;
            }

            // Build interval weights along this sub-chain (m interior wave extrema -> m + 1 intervals)
            var nInt = m + 1;
            var wArr = [];
            var wSum = 0;
            var k;
            for (k = 0; k < nInt; k++) {
                var wk = 1.0;
                if (rFrac > 1e-4) {
                    var sd = Math.sin((globalWaveIdx + k + 1) * 17.371 + waves * 53.19 + c * 11.7) * 43758.5453;
                    var fr = sd - Math.floor(sd);
                    wk = Math.max(0.25, 1.0 + 0.72 * rFrac * (fr * 2.0 - 1.0));
                }
                wArr.push(wk);
                wSum += wk;
            }
            var uNodes = [0];
            var uAcc = 0;
            for (k = 0; k < nInt; k++) {
                uAcc += wArr[k] / (wSum || nInt);
                uNodes.push(k === nInt - 1 ? 1.0 : uAcc);
            }

            var chainPts = [];
            if (ch.curved) {
                // Subdivide each interval at its midpoint so underlying curve lobes (e.g. Cloud puffs) stay round
                chainPts.push(ch.segs[0].p0);
                for (k = 0; k < nInt; k++) {
                    var uMid = 0.5 * (uNodes[k] + uNodes[k + 1]);
                    var evMid = evaluatePerimeterAtU(ch.segs, uMid);
                    // Interpolate displacement smoothly across the curved arc
                    var dispStart = 0;
                    var dispEnd   = 0;
                    if (k > 0) {
                        dispStart = chainPts[chainPts.length - 1]._disp || 0;
                    }
                    var nextDisp = 0;
                    if (k < nInt - 1) {
                        var evPeak = evaluatePerimeterAtU(ch.segs, uNodes[k + 1]);
                        var spanEst = ch.len / nInt;
                        var aModC = 1.0;
                        if (rFrac > 1e-4) {
                            var asC = Math.sin((globalWaveIdx + 1) * 41.317 + waves * 19.73 + 7.13) * 43758.5453;
                            aModC = Math.max(0.25, 1.0 + 0.60 * rFrac * ((asC - Math.floor(asC)) * 2.0 - 1.0));
                        }
                        var sgnC = (globalWaveIdx % 2 === 0) ? 1.0 : -1.0;
                        globalWaveIdx++;
                        var magC = spanEst * (wDepthPct / 100.0) * aModC;
                        if (sgnC < 0 && magC > maxInward) magC = maxInward;
                        nextDisp = sgnC * magC;

                        var midDisp = 0.5 * (dispStart + nextDisp);
                        chainPts.push([
                            evMid.point[0] + evMid.normal[0] * midDisp,
                            evMid.point[1] + evMid.normal[1] * midDisp
                        ]);

                        var pkPt = [
                            evPeak.point[0] + evPeak.normal[0] * nextDisp,
                            evPeak.point[1] + evPeak.normal[1] * nextDisp
                        ];
                        pkPt._disp = nextDisp;
                        chainPts.push(pkPt);
                    } else {
                        var tailDisp = 0.5 * dispStart;
                        chainPts.push([
                            evMid.point[0] + evMid.normal[0] * tailDisp,
                            evMid.point[1] + evMid.normal[1] * tailDisp
                        ]);
                    }
                }
                chainPts.push(ch.segs[ch.segs.length - 1].p1);
            } else {
                // Straight sub-chain (Square, Electric, Explosion, sharp Bubble Lines)
                chainPts.push(ch.segs[0].p0);
                for (k = 1; k <= m; k++) {
                    var evN = evaluatePerimeterAtU(ch.segs, uNodes[k]);
                    var evPrev = evaluatePerimeterAtU(ch.segs, uNodes[k - 1]);
                    var evNext = evaluatePerimeterAtU(ch.segs, uNodes[k + 1]);
                    var lSpan = 0.5 * (dist2D(evPrev.point, evN.point) + dist2D(evN.point, evNext.point));

                    var aModS = 1.0;
                    if (rFrac > 1e-4) {
                        var asS = Math.sin((globalWaveIdx + 1) * 41.317 + waves * 19.73 + 7.13) * 43758.5453;
                        aModS = Math.max(0.20, 1.0 + 0.65 * rFrac * ((asS - Math.floor(asS)) * 2.0 - 1.0));
                    }
                    var sgnS = (globalWaveIdx % 2 === 0) ? 1.0 : -1.0;
                    globalWaveIdx++;

                    var magS = lSpan * (wDepthPct / 100.0) * aModS;
                    if (sgnS < 0 && magS > maxInward) magS = maxInward;
                    var dispS = sgnS * magS;
                    chainPts.push([
                        evN.point[0] + evN.normal[0] * dispS,
                        evN.point[1] + evN.normal[1] * dispS
                    ]);
                }
                chainPts.push(ch.segs[ch.segs.length - 1].p1);
            }

            var nCP = chainPts.length;
            var cIn  = [];
            var cOut = [];
            for (k = 0; k < nCP; k++) {
                if (k === 0) {
                    var fDx = chainPts[1][0] - chainPts[0][0];
                    var fDy = chainPts[1][1] - chainPts[0][1];
                    cIn.push([0, 0]);
                    cOut.push([fDx * 0.30, fDy * 0.30]);
                } else if (k === nCP - 1) {
                    var lDx = chainPts[nCP - 2][0] - chainPts[nCP - 1][0];
                    var lDy = chainPts[nCP - 2][1] - chainPts[nCP - 1][1];
                    cIn.push([lDx * 0.30, lDy * 0.30]);
                    cOut.push([0, 0]);
                } else {
                    var qPrev = chainPts[k - 1];
                    var qCur  = chainPts[k];
                    var qNext = chainPts[k + 1];

                    var vx1 = qCur[0] - qPrev[0], vy1 = qCur[1] - qPrev[1];
                    var vl1 = Math.sqrt(vx1 * vx1 + vy1 * vy1) || 1;
                    var vx2 = qNext[0] - qCur[0], vy2 = qNext[1] - qCur[1];
                    var vl2 = Math.sqrt(vx2 * vx2 + vy2 * vy2) || 1;

                    var qtx = (vx1 / vl1) * vl2 + (vx2 / vl2) * vl1;
                    var qty = (vy1 / vl1) * vl2 + (vy2 / vl2) * vl1;
                    var qtMag = Math.sqrt(qtx * qtx + qty * qty) || 1;
                    qtx /= qtMag;
                    qty /= qtMag;

                    cIn.push([-qtx * vl1 * tension, -qty * vl1 * tension]);
                    cOut.push([qtx * vl2 * tension,  qty * vl2 * tension]);
                }
            }

            for (k = 0; k < nCP - 1; k++) {
                if (dist2D(chainPts[k], chainPts[k + 1]) > 0.05) {
                    sharpOutSegs.push({
                        p0: [chainPts[k][0], chainPts[k][1]],
                        out0: cOut[k],
                        in1: cIn[k + 1],
                        p1: [chainPts[k + 1][0], chainPts[k + 1][1]]
                    });
                }
            }
        }

        return rotateClosedSegmentsToTopCenter(sharpOutSegs);
    }

    /**
     * Builds the closed clockwise perimeter segments starting at Top-Center (0, -b)
     * for any of the 7 Balloon Geometries (square, rounded, electric, cloud, explosion,
     * wobbly, bubble_lines) and applies optional universal Wobbly waves when > 0.
     */
    function buildBalloonPerimeterSegments(textW, textH, cfg, lineSpecs) {
        var geom = cfg.geometry || "rounded";
        if (geom === "dyamond" || geom === "diamond") geom = "wobbly";

        var rawWWaves = (cfg.wobblyWaves !== undefined) ? cfg.wobblyWaves : cfg.dyamondWaves;
        var rawWDepth = (cfg.wobblyDepth !== undefined) ? cfg.wobblyDepth : cfg.dyamondDepth;
        var effWaves  = Math.round(clampNum(rawWWaves, 0, 36, geom === "wobbly" ? 14 : 0));
        var effWDepth = clampNum(rawWDepth, 0, 50, geom === "wobbly" ? 10 : 0);
        var hasWobble = (effWaves > 0 && effWDepth > 0.01);

        var padX = cfg.padX;
        var padY = cfg.padY;
        var w = Math.max(24, textW + padX * 2);
        var h = Math.max(24, textH + padY * 2);

        // Cushion inward wave troughs slightly so universal wobbly never touches text
        var wobblePad = 0;
        if (hasWobble && geom !== "wobbly") {
            var estPerim = 2.0 * (w + h);
            var estHalfWave = estPerim / Math.max(4, effWaves * 2);
            wobblePad = estHalfWave * (effWDepth / 100.0) * (cfg._isPreviewIcon ? 0.25 : 0.55);
        }

        var a = w / 2 + wobblePad;
        var b = h / 2 + wobblePad;
        var segs = [];

        if (geom === "bubble_lines") {
            var blCfg = cfg;
            if (wobblePad > 0.5) {
                blCfg = cloneObject(cfg);
                blCfg.padX = (cfg.padX !== undefined ? cfg.padX : 24) + wobblePad * 0.7;
                blCfg.padY = (cfg.padY !== undefined ? cfg.padY : 16) + wobblePad * 0.5;
            }
            var blSegs = buildBubbleLinesPerimeterSegments(textW, textH, blCfg, lineSpecs);
            return applyWobblyToPerimeterSegments(blSegs, cfg, null);
        }

        if (geom === "electric") {
            var elSegs = buildElectricPerimeterSegments(textW, textH, cfg, wobblePad);
            return applyWobblyToPerimeterSegments(elSegs, cfg, null);
        }

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

            annotateArcLengths(segs);
            var sqGuard = (r > 0.05) ? { dA: a, dB: b, dR: r } : null;
            return applyWobblyToPerimeterSegments(segs, cfg, sqGuard);
        }

        if (geom === "wobbly") {
            var approxPerim = 2.0 * (w + h);
            var approxHalfWave = hasWobble ? (approxPerim / Math.max(4, effWaves * 2)) : 0;
            var inwardAllowance = hasWobble ? (approxHalfWave * (effWDepth / 100.0) * 0.75) : 0;
            var dA = Math.max(w / 2, textW / 2 + 6 + inwardAllowance);
            var dB = Math.max(h / 2, textH / 2 + 6 + inwardAllowance);
            var dR = Math.max(6, Math.min(cfg.cornerRadius !== undefined ? cfg.cornerRadius : 28, dA * 0.75, dB * 0.75));
            var KD = 0.5522847498307936;

            var rectSegs = [];
            function pushDLine(p0, p1) {
                if (dist2D(p0, p1) > 0.05) {
                    rectSegs.push({ p0: p0, out0: [0, 0], in1: [0, 0], p1: p1 });
                }
            }
            pushDLine([0, -dB], [dA - dR, -dB]);
            if (dR > 0.05) rectSegs.push({ p0: [dA - dR, -dB], out0: [dR * KD, 0], in1: [0, -dR * KD], p1: [dA, -dB + dR] });
            pushDLine([dA, -dB + dR], [dA, dB - dR]);
            if (dR > 0.05) rectSegs.push({ p0: [dA, dB - dR], out0: [0, dR * KD], in1: [dR * KD, 0], p1: [dA - dR, dB] });
            pushDLine([dA - dR, dB], [-dA + dR, dB]);
            if (dR > 0.05) rectSegs.push({ p0: [-dA + dR, dB], out0: [-dR * KD, 0], in1: [0, dR * KD], p1: [-dA, dB - dR] });
            pushDLine([-dA, dB - dR], [-dA, -dB + dR]);
            if (dR > 0.05) rectSegs.push({ p0: [-dA, -dB + dR], out0: [0, -dR * KD], in1: [-dR * KD, 0], p1: [-dA + dR, -dB] });
            pushDLine([-dA + dR, -dB], [0, -dB]);
            annotateArcLengths(rectSegs);

            var wobCfg = cfg;
            if (cfg.wobblyWaves === undefined && cfg.dyamondWaves === undefined) {
                wobCfg = cloneObject(cfg);
                wobCfg.wobblyWaves = effWaves;
                wobCfg.wobblyDepth = effWDepth;
            }
            return applyWobblyToPerimeterSegments(rectSegs, wobCfg, { dA: dA, dB: dB, dR: dR });
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
            annotateArcLengths(segs);
            return applyWobblyToPerimeterSegments(segs, cfg, null);
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
        annotateArcLengths(segs);
        return applyWobblyToPerimeterSegments(segs, cfg, null);
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
     * Finds the arc-length parameter `u` in [0, 1) on `segs` whose point is closest to `targetPt`.
     */
    function findClosestPerimeterU(segs, targetPt) {
        if (!segs || segs.length === 0 || !targetPt) return 0.56;
        var tx = targetPt[0] || 0;
        var ty = targetPt[1] || 0;
        var bestU = 0;
        var bestD = 1e18;
        var COARSE = 120;
        var s, uC, pt, dx, dy, d2;
        for (s = 0; s < COARSE; s++) {
            uC = s / COARSE;
            pt = evaluatePerimeterAtU(segs, uC).point;
            dx = pt[0] - tx;
            dy = pt[1] - ty;
            d2 = dx * dx + dy * dy;
            if (d2 < bestD) {
                bestD = d2;
                bestU = uC;
            }
        }
        var baseU = bestU;
        var fineStep = 1.0 / (COARSE * 8);
        for (s = -8; s <= 8; s++) {
            uC = (((baseU + s * fineStep) % 1) + 1) % 1;
            pt = evaluatePerimeterAtU(segs, uC).point;
            dx = pt[0] - tx;
            dy = pt[1] - ty;
            d2 = dx * dx + dy * dy;
            if (d2 < bestD) {
                bestD = d2;
                bestU = uC;
            }
        }
        return bestU;
    }

    function worldPointToBalloonLocal(worldPt, centerPos, scaleArr, rotDeg) {
        var dx = (worldPt[0] || 0) - (centerPos[0] || 0);
        var dy = (worldPt[1] || 0) - (centerPos[1] || 0);
        var rad = -((rotDeg || 0) * Math.PI / 180.0);
        var cr = Math.cos(rad), sr = Math.sin(rad);
        var rx = dx * cr - dy * sr;
        var ry = dx * sr + dy * cr;
        var sx = ((scaleArr && scaleArr[0]) ? scaleArr[0] : 100) / 100.0;
        var sy = ((scaleArr && scaleArr[1]) ? scaleArr[1] : 100) / 100.0;
        if (Math.abs(sx) < 1e-4) sx = 1.0;
        if (Math.abs(sy) < 1e-4) sy = 1.0;
        return [rx / sx, ry / sy];
    }

    function balloonLocalToWorldPoint(localPt, centerPos, scaleArr, rotDeg) {
        var sx = ((scaleArr && scaleArr[0]) ? scaleArr[0] : 100) / 100.0;
        var sy = ((scaleArr && scaleArr[1]) ? scaleArr[1] : 100) / 100.0;
        var lx = (localPt[0] || 0) * sx;
        var ly = (localPt[1] || 0) * sy;
        var rad = (rotDeg || 0) * Math.PI / 180.0;
        var cr = Math.cos(rad), sr = Math.sin(rad);
        return [
            (centerPos[0] || 0) + (lx * cr - ly * sr),
            (centerPos[1] || 0) + (lx * sr + ly * cr)
        ];
    }

    /**
     * Generates complete Balloon + Tail Shape specifications and exact outer bounds.
     */
    function computeBalloonAndTail(textW, textH, cfg, lineSpecs, targetLocalPt) {
        var segs = buildBalloonPerimeterSegments(textW, textH, cfg, lineSpecs);
        var tailStyle = cfg.tailStyle || "none";
        var useTargetMode = (cfg.tailPlacementMode === "target" && tailStyle !== "none" && targetLocalPt && targetLocalPt.length >= 2);

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

        if (useTargetMode) {
            uMid = findClosestPerimeterU(segs, targetLocalPt);
            span = clampNum(cfg.tailStartWidth, 0.1, 4.0, 2.5) / 100.0;
            uA = ((uMid - span * 0.5) % 1 + 1) % 1;
            uB = (uMid + span * 0.5) % 1;
        }

        if (tailStyle === "triangle" || tailStyle === "curved_triangle" || tailStyle === "lightning") {
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

        var tailLen = Math.max(15, cfg.tailLength || 85);
        var pTip;

        if (useTargetMode) {
            var vxT = targetLocalPt[0] - pMid[0];
            var vyT = targetLocalPt[1] - pMid[1];
            var dT  = Math.sqrt(vxT * vxT + vyT * vyT);
            var dotOut = vxT * nOut[0] + vyT * nOut[1];
            var dirTX = (dotOut > 2.0 && dT > 4.0) ? (vxT / dT) : nOut[0];
            var dirTY = (dotOut > 2.0 && dT > 4.0) ? (vyT / dT) : nOut[1];

            if (cfg.tailTargetSnapTip !== false) {
                tailLen = (dotOut > 2.0) ? Math.max(15.0, dT) : 18.0;
                pTip = [pMid[0] + dirTX * tailLen, pMid[1] + dirTY * tailLen];
            } else {
                var targAng = Math.atan2(dirTY, dirTX) + ((cfg.tailAngle || 0) * Math.PI / 180.0);
                pTip = [pMid[0] + tailLen * Math.cos(targAng), pMid[1] + tailLen * Math.sin(targAng)];
            }
        } else {
            // Blend outward perimeter normal with radial vector from center for smooth comic direction
            var rLen = Math.sqrt(pMid[0] * pMid[0] + pMid[1] * pMid[1]) || 1;
            var rx = pMid[0] / rLen;
            var ry = pMid[1] / rLen;
            var dirX = nOut[0] * 0.45 + rx * 0.55;
            var dirY = nOut[1] * 0.45 + ry * 0.55;
            var dirMag = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            var baseOutAng = Math.atan2(dirY / dirMag, dirX / dirMag);
            var tipAng = baseOutAng + ((cfg.tailAngle || 0) * Math.PI / 180.0);

            pTip = [
                pMid[0] + tailLen * Math.cos(tipAng),
                pMid[1] + tailLen * Math.sin(tipAng)
            ];
        }

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

        } else if (tailStyle === "triangle" || tailStyle === "curved_triangle" || tailStyle === "lightning") {
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

                } else if (tailStyle === "curved_triangle") {
                    // Curved Triangle (comic swooping horn): non-self-intersecting cubic Bézier spine + tapering half-width
                    var cMid = [(b1[0] + b2[0]) * 0.5, (b1[1] + b2[1]) * 0.5];
                    var cvx = pTip[0] - cMid[0];
                    var cvy = pTip[1] - cMid[1];
                    var cLen = Math.sqrt(cvx * cvx + cvy * cvy) || 1;
                    var ux = cvx / cLen;
                    var uy = cvy / cLen;
                    var perpX = -uy;
                    var perpY = ux;

                    // Clockwise base chord from b1 -> b2 gives outward base normal N = [Ty, -Tx]
                    var tbx = b2[0] - b1[0];
                    var tby = b2[1] - b1[1];
                    var tbLen = Math.sqrt(tbx * tbx + tby * tby) || 1;
                    var baseHalfW = Math.max(1.0, tbLen * 0.5);
                    var bnx = tby / tbLen;
                    var bny = -tbx / tbLen;

                    // Natural bow exits along outward normal N and sweeps smoothly into pTip
                    var dotNP = bnx * perpX + bny * perpY;
                    var bowSign = (Math.abs(dotNP) > 0.05) ? (dotNP >= 0 ? 1 : -1) : 1;
                    var bxDir = perpX * bowSign;
                    var byDir = perpY * bowSign;

                    var curveFrac = clampNum(cfg.tailCurve !== undefined ? cfg.tailCurve : 45, -100, 100, 45) / 100.0;
                    var bowDist = cLen * 0.44 * curveFrac;

                    var sc1 = [cMid[0] + cvx * 0.30 + bxDir * (bowDist * 0.95), cMid[1] + cvy * 0.30 + byDir * (bowDist * 0.95)];
                    var sc2 = [cMid[0] + cvx * 0.68 + bxDir * (bowDist * 0.72), cMid[1] + cvy * 0.68 + byDir * (bowDist * 0.72)];

                    // Spine tangents rotated -90 deg point toward b1 (side 1), +90 deg toward b2 (side 2)
                    var d1x = sc2[0] - cMid[0];
                    var d1y = sc2[1] - cMid[1];
                    var d1Len = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
                    var n1x = d1y / d1Len;
                    var n1y = -d1x / d1Len;

                    var d2x = pTip[0] - sc1[0];
                    var d2y = pTip[1] - sc1[1];
                    var d2Len = Math.sqrt(d2x * d2x + d2y * d2y) || 1;
                    var n2x = d2y / d2Len;
                    var n2y = -d2x / d2Len;

                    var cw1 = baseHalfW * 0.58;
                    var cw2 = baseHalfW * 0.22;

                    var c1Side1 = [sc1[0] + n1x * cw1, sc1[1] + n1y * cw1];
                    var c1Side2 = [sc1[0] - n1x * cw1, sc1[1] - n1y * cw1];
                    var c2Side1 = [sc2[0] + n2x * cw2, sc2[1] + n2y * cw2];
                    var c2Side2 = [sc2[0] - n2x * cw2, sc2[1] - n2y * cw2];

                    // Attach outgoing handle on b1, add pTip with in/out handles, and attach incoming handle on b2 (verts[0])
                    outT[verts.length - 1] = [c1Side1[0] - b1[0], c1Side1[1] - b1[1]];
                    verts.push(pTip);
                    inT.push([c2Side1[0] - pTip[0], c2Side1[1] - pTip[1]]);
                    outT.push([c2Side2[0] - pTip[0], c2Side2[1] - pTip[1]]);
                    inT[0] = [c1Side2[0] - b2[0], c1Side2[1] - b2[1]];

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
                    for (var ks = 1; ks <= 3; ks++) {
                        var pSample = evalCubicPt(p0, sd.outTangents[i], sd.inTangents[j], sd.vertices[j], ks * 0.25);
                        minX = Math.min(minX, pSample[0]); maxX = Math.max(maxX, pSample[0]);
                        minY = Math.min(minY, pSample[1]); maxY = Math.max(maxY, pSample[1]);
                    }
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
            perimeterSegs: segs,
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

            var useRoundJoin = (cfg.geometry === "rounded" || cfg.geometry === "cloud" || cfg.tailStyle === "curved_triangle" || effStrokeStyle === "dotted" || cfg.animStyle === "sparse_dots");
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
        var enableIn   = (cfg.enableIn !== undefined ? Boolean(cfg.enableIn) : true) ? 1 : 0;
        var inTime     = clampNum(cfg.inTime, 0.1, 10, 0.6);
        var enableOut  = (cfg.enableOut !== undefined ? Boolean(cfg.enableOut) : true) ? 1 : 0;
        var outTime    = clampNum(cfg.outTime, 0.1, 10, 0.5);
        var secPer25   = clampNum(cfg.secPer25, 0.2, 10, 1.2);
        var linkRead   = cfg.linkReadTime ? 1 : 0;
        var effRead    = computeEffectiveReadTime(cfg, charCount);
        var bakedChars = Math.max(1, charCount || 1);

        var eDelay  = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Start Delay (s)", startDelay);
        var eEnIn   = ensureEffectCtrl(fxParade, "ADBE Checkbox Control", "Bubble Enable In",       enableIn);
        var eIn     = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble In Time (s)",     inTime);
        var eLink   = ensureEffectCtrl(fxParade, "ADBE Checkbox Control", "Bubble Link Read Time",  linkRead);
        var eSp25   = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Sec Per 25 Chars", secPer25);
        var eRead   = ensureEffectCtrl(fxParade, "ADBE Slider Control",   "Bubble Read Time (s)",   effRead);
        var eEnOut  = ensureEffectCtrl(fxParade, "ADBE Checkbox Control", "Bubble Enable Out",      enableOut);
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
            setEffectExpression(eEnIn,  mirrorOuter("Bubble Enable In"));
            setEffectExpression(eIn,    mirrorOuter("Bubble In Time (s)"));
            setEffectExpression(eLink,  mirrorOuter("Bubble Link Read Time"));
            setEffectExpression(eSp25,  mirrorOuter("Bubble Sec Per 25 Chars"));
            setEffectExpression(eEnOut, mirrorOuter("Bubble Enable Out"));
            setEffectExpression(eOut,   mirrorOuter("Bubble Out Time (s)"));
        } else {
            setEffectExpression(eDelay, "");
            setEffectExpression(eEnIn,  "");
            setEffectExpression(eIn,    "");
            setEffectExpression(eLink,  "");
            setEffectExpression(eSp25,  "");
            setEffectExpression(eEnOut, "");
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
            'var useIn = (Number(effect("Bubble Enable In")(1).value) > 0.5);\n' +
            'var useOut = (Number(effect("Bubble Enable Out")(1).value) > 0.5);\n' +
            'var dly = Math.max(0, effect("Bubble Start Delay (s)")(1).value);\n' +
            'var tIn = useIn ? Math.max(0.01, effect("Bubble In Time (s)")(1).value) : 0.0;\n' +
            'var tRd = Math.max(0.01, effect("Bubble Read Time (s)")(1).value);\n' +
            'var tOt = useOut ? Math.max(0.01, effect("Bubble Out Time (s)")(1).value) : 0.0;\n' +
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
            'else if (useIn && time < t1) { st = 2; }\n' +
            'else if (time < t2) { st = 3; }\n' +
            'else if (useOut && time < t3) { st = 4; }\n' +
            'else { st = 5; }\n' +
            'st;';
        setEffectExpression(eStatus, statusExpr);

        setEffectExpression(eInPrg,
            commonHeader +
            'var p = 0;\n' +
            'if (time < t0) { p = 0; }\n' +
            'else if (!useIn || time >= t1) { p = 100; }\n' +
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
            'if (!useOut || time <= t2) { p = 0; }\n' +
            'else if (time >= t3) { p = 100; }\n' +
            'else { p = ((time - t2) / tOt) * 100.0; }\n' +
            'p;'
        );

        setEffectExpression(eEnv,
            commonHeader +
            'var env = 100.0;\n' +
            'if (time < t0) { env = 0.0; }\n' +
            'else if (useIn && time < t1) { env = ((time - t0) / tIn) * 100.0; }\n' +
            'else if (time <= t2 || !useOut) { env = 100.0; }\n' +
            'else if (time < t3) { env = (1.0 - (time - t2) / tOt) * 100.0; }\n' +
            'else { env = 0.0; }\n' +
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

    function serializeSegsCompact(segs) {
        var parts = [];
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i];
            parts.push("[" +
                (Math.round(s.p0[0] * 100) / 100) + "," +
                (Math.round(s.p0[1] * 100) / 100) + "," +
                (Math.round(s.out0[0] * 100) / 100) + "," +
                (Math.round(s.out0[1] * 100) / 100) + "," +
                (Math.round(s.in1[0] * 100) / 100) + "," +
                (Math.round(s.in1[1] * 100) / 100) + "," +
                (Math.round(s.p1[0] * 100) / 100) + "," +
                (Math.round(s.p1[1] * 100) / 100) + "," +
                (Math.round((s.u0 || 0) * 10000) / 10000) + "," +
                (Math.round((s.u1 !== undefined ? s.u1 : 1) * 10000) / 10000) +
            "]");
        }
        return "[" + parts.join(",") + "]";
    }

    function serializePerimeterSamplesCompact(segs, count) {
        var n = count || 96;
        var parts = [];
        for (var i = 0; i < n; i++) {
            var u = i / n;
            var pt = evaluatePerimeterAtU(segs, u).point;
            parts.push("[" +
                (Math.round(pt[0] * 10) / 10) + "," +
                (Math.round(pt[1] * 10) / 10) + "," +
                (Math.round(u * 10000) / 10000) +
            "]");
        }
        return "[" + parts.join(",") + "]";
    }

    /**
     * Builds an ES3 expression snippet that defines `V0`, `I0`, `O0`, and `IS_CLOSED`
     * dynamically from the draggable Target Guide Layer ("Tail Target <HEX>"), placing
     * the tail's origin at the closest point on the balloon perimeter to the guide layer.
     */
    function buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, role, cloudIdx) {
        if (!geoResult || !geoResult.perimeterSegs || !targetLink || !targetLink.guideName) return "";
        var segs = geoResult.perimeterSegs;
        var fbTip = targetLink.fallbackTip || geoResult.pTip || [0, 90];
        var fbX = Math.round((fbTip[0] || 0) * 100) / 100;
        var fbY = Math.round((fbTip[1] || 0) * 100) / 100;

        var targetCoordSnippet = "";
        if (targetLink.outerCompName && targetLink.precompLayerName) {
            targetCoordSnippet =
                'var T = [' + fbX + ',' + fbY + '];\n' +
                'try {\n' +
                '    var oC = comp("' + escapeJsonStr(targetLink.outerCompName) + '");\n' +
                '    var gL = oC.layer("' + escapeJsonStr(targetLink.guideName) + '");\n' +
                '    var pL = oC.layer("' + escapeJsonStr(targetLink.precompLayerName) + '");\n' +
                '    var gW = gL.toComp(gL.transform.anchorPoint.value);\n' +
                '    var pP = pL.fromComp(gW);\n' +
                '    var cO = pL.transform.anchorPoint.value;\n' +
                '    T = [pP[0] - cO[0], pP[1] - cO[1]];\n' +
                '} catch (eTG) {}\n';
        } else {
            targetCoordSnippet =
                'var T = [' + fbX + ',' + fbY + '];\n' +
                'try {\n' +
                '    var gL = thisComp.layer("' + escapeJsonStr(targetLink.guideName) + '");\n' +
                '    var gW = gL.toComp(gL.transform.anchorPoint.value);\n' +
                '    var lP = thisLayer.fromComp(gW);\n' +
                '    var lA = thisLayer.transform.anchorPoint.value;\n' +
                '    T = [lP[0] - (lA[0] || 0), lP[1] - (lA[1] || 0)];\n' +
                '} catch (eTG) {}\n';
        }

        var snapTip = (cfg.tailTargetSnapTip !== false) ? "true" : "false";
        var fixedLen = Math.max(15, Math.round((cfg.tailLength || 85) * 100) / 100);
        var slantRad = Math.round(((cfg.tailAngle || 0) * Math.PI / 180.0) * 10000) / 10000;
        var widFrac  = Math.round((clampNum(cfg.tailStartWidth, 0.1, 4.0, 2.5) / 100.0) * 10000) / 10000;
        var curveFrac = Math.round((clampNum(cfg.tailCurve !== undefined ? cfg.tailCurve : 45, -100, 100, 45) / 100.0) * 1000) / 1000;
        var tStyle   = cfg.tailStyle || "triangle";

        var solverHeader =
            targetCoordSnippet +
            'var S = ' + serializeSegsCompact(segs) + ';\n' +
            'var P = ' + serializePerimeterSamplesCompact(segs, 96) + ';\n' +
            'function evalS(sg, t) {\n' +
            '    var mt = 1.0 - t, ax = sg[0], ay = sg[1], bx = ax + sg[2], by = ay + sg[3], dx = sg[6], dy = sg[7], cx = dx + sg[4], cy = dy + sg[5];\n' +
            '    return [mt*mt*mt*ax + 3*mt*mt*t*bx + 3*mt*t*t*cx + t*t*t*dx, mt*mt*mt*ay + 3*mt*mt*t*by + 3*mt*t*t*cy + t*t*t*dy];\n' +
            '}\n' +
            'function evalU(uR) {\n' +
            '    var u = ((uR % 1) + 1) % 1, si;\n' +
            '    for (si = 0; si < S.length; si++) {\n' +
            '        var sg = S[si];\n' +
            '        if (u <= sg[9] || si === S.length - 1) {\n' +
            '            var spn = Math.max(1e-6, sg[9] - sg[8]);\n' +
            '            var t = clamp((u - sg[8]) / spn, 0, 1);\n' +
            '            var pt = evalS(sg, t);\n' +
            '            var pA = evalS(sg, Math.max(0, t - 0.01));\n' +
            '            var pB = evalS(sg, Math.min(1, t + 0.01));\n' +
            '            var tx = pB[0] - pA[0], ty = pB[1] - pA[1], tl = Math.sqrt(tx*tx + ty*ty) || 1;\n' +
            '            return { pt: pt, n: [ty / tl, -tx / tl] };\n' +
            '        }\n' +
            '    }\n' +
            '    return { pt: [S[0][0], S[0][1]], n: [0, -1] };\n' +
            '}\n' +
            'var bestU = P[0][2], bestD = 1e18, ki, ddx, ddy, dd;\n' +
            'for (ki = 0; ki < P.length; ki++) {\n' +
            '    ddx = P[ki][0] - T[0]; ddy = P[ki][1] - T[1]; dd = ddx*ddx + ddy*ddy;\n' +
            '    if (dd < bestD) { bestD = dd; bestU = P[ki][2]; }\n' +
            '}\n' +
            'var baseU = bestU, fStep = 1.0 / 640.0;\n' +
            'for (ki = -6; ki <= 6; ki++) {\n' +
            '    var cU = (((baseU + ki * fStep) % 1) + 1) % 1;\n' +
            '    var cp = evalU(cU).pt;\n' +
            '    ddx = cp[0] - T[0]; ddy = cp[1] - T[1]; dd = ddx*ddx + ddy*ddy;\n' +
            '    if (dd < bestD) { bestD = dd; bestU = cU; }\n' +
            '}\n' +
            'var mEv = evalU(bestU);\n' +
            'var pMid = mEv.pt, nOut = mEv.n;\n' +
            'var vxT = T[0] - pMid[0], vyT = T[1] - pMid[1];\n' +
            'var dT = Math.sqrt(vxT*vxT + vyT*vyT);\n' +
            'var dotO = vxT * nOut[0] + vyT * nOut[1];\n' +
            'var dirX = (dotO > 2.0 && dT > 4.0) ? (vxT / dT) : nOut[0];\n' +
            'var dirY = (dotO > 2.0 && dT > 4.0) ? (vyT / dT) : nOut[1];\n' +
            'var tLen = ' + fixedLen + ';\n' +
            'var pTip;\n' +
            'if (' + snapTip + ') {\n' +
            '    tLen = (dotO > 2.0) ? Math.max(15.0, dT) : 18.0;\n' +
            '    pTip = [pMid[0] + dirX * tLen, pMid[1] + dirY * tLen];\n' +
            '} else {\n' +
            '    var tAng = Math.atan2(dirY, dirX) + ' + slantRad + ';\n' +
            '    pTip = [pMid[0] + tLen * Math.cos(tAng), pMid[1] + tLen * Math.sin(tAng)];\n' +
            '}\n';

        if (role === "line") {
            return (
                solverHeader +
                'var V0 = [pMid, pTip];\n' +
                'var I0 = [[0,0],[0,0]];\n' +
                'var O0 = [[0,0],[0,0]];\n' +
                'var IS_CLOSED = false;\n'
            );
        }

        if (role === "cloud") {
            var cIdx = cloudIdx || 1;
            var frac = (cIdx === 1) ? 0.34 : ((cIdx === 2) ? 0.68 : 0.96);
            var rMul = (cIdx === 1) ? 1.00 : ((cIdx === 2) ? 0.65 : 0.40);
            return (
                solverHeader +
                'var rB = clamp(tLen * 0.17, 9, 22) * ' + rMul.toFixed(2) + ';\n' +
                'var ccx = pMid[0] + (pTip[0] - pMid[0]) * ' + frac.toFixed(2) + ';\n' +
                'var ccy = pMid[1] + (pTip[1] - pMid[1]) * ' + frac.toFixed(2) + ';\n' +
                'var ck = rB * 0.55228475;\n' +
                'var V0 = [[ccx, ccy - rB], [ccx + rB, ccy], [ccx, ccy + rB], [ccx - rB, ccy]];\n' +
                'var I0 = [[-ck, 0], [0, -ck], [ck, 0], [0, ck]];\n' +
                'var O0 = [[ck, 0], [0, ck], [-ck, 0], [0, -ck]];\n' +
                'var IS_CLOSED = true;\n'
            );
        }

        // role === "body" (spliced tail: triangle, curved_triangle, lightning)
        var tailBuildSnippet = "";
        if (tStyle === "triangle") {
            tailBuildSnippet =
                'V0.push(pTip); I0.push([0,0]); O0.push([0,0]);\n';
        } else if (tStyle === "curved_triangle") {
            tailBuildSnippet =
                'var cMid = [(b1[0] + b2[0]) * 0.5, (b1[1] + b2[1]) * 0.5];\n' +
                'var cvx = pTip[0] - cMid[0], cvy = pTip[1] - cMid[1];\n' +
                'var cLen = Math.sqrt(cvx*cvx + cvy*cvy) || 1;\n' +
                'var perpX = -cvy / cLen, perpY = cvx / cLen;\n' +
                'var tbx = b2[0] - b1[0], tby = b2[1] - b1[1];\n' +
                'var tbLen = Math.sqrt(tbx*tbx + tby*tby) || 1;\n' +
                'var baseHW = Math.max(1.0, tbLen * 0.5);\n' +
                'var bnx = tby / tbLen, bny = -tbx / tbLen;\n' +
                'var dotNP = bnx * perpX + bny * perpY;\n' +
                'var bowSign = (Math.abs(dotNP) > 0.05) ? (dotNP >= 0 ? 1 : -1) : 1;\n' +
                'var bxD = perpX * bowSign, byD = perpY * bowSign;\n' +
                'var bowD = cLen * 0.44 * ' + curveFrac + ';\n' +
                'var sc1 = [cMid[0] + cvx * 0.30 + bxD * (bowD * 0.95), cMid[1] + cvy * 0.30 + byD * (bowD * 0.95)];\n' +
                'var sc2 = [cMid[0] + cvx * 0.68 + bxD * (bowD * 0.72), cMid[1] + cvy * 0.68 + byD * (bowD * 0.72)];\n' +
                'var d1x = sc2[0] - cMid[0], d1y = sc2[1] - cMid[1], d1L = Math.sqrt(d1x*d1x + d1y*d1y) || 1;\n' +
                'var n1x = d1y / d1L, n1y = -d1x / d1L;\n' +
                'var d2x = pTip[0] - sc1[0], d2y = pTip[1] - sc1[1], d2L = Math.sqrt(d2x*d2x + d2y*d2y) || 1;\n' +
                'var n2x = d2y / d2L, n2y = -d2x / d2L;\n' +
                'var cw1 = baseHW * 0.58, cw2 = baseHW * 0.22;\n' +
                'O0[V0.length - 1] = [sc1[0] + n1x * cw1 - b1[0], sc1[1] + n1y * cw1 - b1[1]];\n' +
                'V0.push(pTip);\n' +
                'I0.push([sc2[0] + n2x * cw2 - pTip[0], sc2[1] + n2y * cw2 - pTip[1]]);\n' +
                'O0.push([sc2[0] - n2x * cw2 - pTip[0], sc2[1] - n2y * cw2 - pTip[1]]);\n' +
                'I0[0] = [sc1[0] - n1x * cw1 - b2[0], sc1[1] - n1y * cw1 - b2[1]];\n';
        } else {
            tailBuildSnippet =
                'var midB = [(b1[0] + b2[0]) * 0.5, (b1[1] + b2[1]) * 0.5];\n' +
                'var vxB = pTip[0] - midB[0], vyB = pTip[1] - midB[1];\n' +
                'var bxB = b1[0] - b2[0], byB = b1[1] - b2[1];\n' +
                'var bDist = Math.sqrt(bxB*bxB + byB*byB) || 1;\n' +
                'var pxB = bxB / bDist, pyB = byB / bDist;\n' +
                'var w0B = Math.max(1.5, bDist * 0.5), jog = Math.max(9, tLen * 0.14);\n' +
                'var h1B = w0B * 0.56, h2B = w0B * 0.36;\n' +
                'var bPts = [\n' +
                '    [midB[0] + vxB * 0.48 + pxB * (jog + h1B), midB[1] + vyB * 0.48 + pyB * (jog + h1B)],\n' +
                '    [midB[0] + vxB * 0.41 + pxB * (-0.35 * jog + h2B), midB[1] + vyB * 0.41 + pyB * (-0.35 * jog + h2B)],\n' +
                '    pTip,\n' +
                '    [midB[0] + vxB * 0.35 + pxB * (-0.35 * jog - h2B), midB[1] + vyB * 0.35 + pyB * (-0.35 * jog - h2B)],\n' +
                '    [midB[0] + vxB * 0.42 + pxB * (jog - h1B), midB[1] + vyB * 0.42 + pyB * (jog - h1B)]\n' +
                '];\n' +
                'for (var bi = 0; bi < 5; bi++) { V0.push(bPts[bi]); I0.push([0,0]); O0.push([0,0]); }\n';
        }

        return (
            solverHeader +
            'function splitSeg(sg, t) {\n' +
            '    var ax = sg[0], ay = sg[1], bx = ax + sg[2], by = ay + sg[3], dx = sg[6], dy = sg[7], cx = dx + sg[4], cy = dy + sg[5];\n' +
            '    var q0x = ax + (bx - ax)*t, q0y = ay + (by - ay)*t;\n' +
            '    var q1x = bx + (cx - bx)*t, q1y = by + (cy - by)*t;\n' +
            '    var q2x = cx + (dx - cx)*t, q2y = cy + (dy - cy)*t;\n' +
            '    var r0x = q0x + (q1x - q0x)*t, r0y = q0y + (q1y - q0y)*t;\n' +
            '    var r1x = q1x + (q2x - q1x)*t, r1y = q1y + (q2y - q1y)*t;\n' +
            '    var sx = r0x + (r1x - r0x)*t, sy = r0y + (r1y - r0y)*t;\n' +
            '    return {\n' +
            '        L: [ax, ay, q0x - ax, q0y - ay, r0x - sx, r0y - sy, sx, sy],\n' +
            '        R: [sx, sy, r1x - sx, r1y - sy, q2x - dx, q2y - dy, dx, dy]\n' +
            '    };\n' +
            '}\n' +
            'function subLin(a, b) {\n' +
            '    var out = [];\n' +
            '    if (b <= a + 1e-6) return out;\n' +
            '    for (var i = 0; i < S.length; i++) {\n' +
            '        var sg = S[i];\n' +
            '        if (sg[9] <= a + 1e-7 || sg[8] >= b - 1e-7) continue;\n' +
            '        var sp = Math.max(1e-6, sg[9] - sg[8]);\n' +
            '        var t0 = clamp((a - sg[8]) / sp, 0, 1);\n' +
            '        var t1 = clamp((b - sg[8]) / sp, 0, 1);\n' +
            '        if (t1 <= t0 + 1e-6) continue;\n' +
            '        if (t0 <= 1e-5 && t1 >= 1.0 - 1e-5) {\n' +
            '            out.push([sg[0], sg[1], sg[2], sg[3], sg[4], sg[5], sg[6], sg[7]]);\n' +
            '        } else {\n' +
            '            var s1 = splitSeg(sg, t0);\n' +
            '            var rem = (1.0 - t0 > 1e-6) ? clamp((t1 - t0) / (1.0 - t0), 0, 1) : 1.0;\n' +
            '            var s2 = splitSeg(s1.R, rem);\n' +
            '            out.push(s2.L);\n' +
            '        }\n' +
            '    }\n' +
            '    return out;\n' +
            '}\n' +
            'var spW = clamp(' + widFrac + ', 0.001, 0.04);\n' +
            'var uA = ((bestU - spW * 0.5) % 1 + 1) % 1;\n' +
            'var uB = (bestU + spW * 0.5) % 1;\n' +
            'var ch = (uB < uA) ? subLin(uB, uA) : subLin(uB, 1.0).concat(subLin(0.0, uA));\n' +
            'var V0 = [], I0 = [], O0 = [];\n' +
            'if (ch.length > 0) {\n' +
            '    var b2 = [ch[0][0], ch[0][1]];\n' +
            '    var lastC = ch[ch.length - 1];\n' +
            '    var b1 = [lastC[6], lastC[7]];\n' +
            '    V0.push(b2); I0.push([0,0]); O0.push([ch[0][2], ch[0][3]]);\n' +
            '    for (var mi = 1; mi < ch.length; mi++) {\n' +
            '        V0.push([ch[mi][0], ch[mi][1]]);\n' +
            '        I0.push([ch[mi - 1][4], ch[mi - 1][5]]);\n' +
            '        O0.push([ch[mi][2], ch[mi][3]]);\n' +
            '    }\n' +
            '    V0.push(b1); I0.push([lastC[4], lastC[5]]); O0.push([0,0]);\n' +
            tailBuildSnippet +
            '} else {\n' +
            '    for (var fi = 0; fi < S.length; fi++) {\n' +
            '        var pr = S[(fi - 1 + S.length) % S.length], cu = S[fi];\n' +
            '        V0.push([cu[0], cu[1]]); I0.push([pr[4], pr[5]]); O0.push([cu[2], cu[3]]);\n' +
            '    }\n' +
            '}\n' +
            'var IS_CLOSED = true;\n'
        );
    }

    function applyDynamicTargetTailPaths(balloonLayer, geoResult, cfg, targetLink) {
        if (!balloonLayer || !geoResult || !targetLink || !targetLink.guideName) return;
        if (cfg.tailPlacementMode !== "target" || !cfg.tailStyle || cfg.tailStyle === "none") return;

        var rootContents = balloonLayer.property("Contents") || balloonLayer.property("ADBE Root Vectors Group");
        if (!rootContents) return;
        var numGroups = (typeof rootContents.numProperties === "number")
            ? rootContents.numProperties
            : (rootContents.properties ? rootContents.properties.length : 0);

        var tStyle = cfg.tailStyle;
        for (var gi = 1; gi <= numGroups; gi++) {
            var grp = rootContents.property(gi);
            if (!grp) continue;
            var gCont = grp.property("Contents") || grp.property("ADBE Vectors Group");
            if (!gCont) continue;
            var pathG = gCont.property("ADBE Vector Shape - Group") || gCont.property("Path 1");
            if (!pathG) continue;
            var pathP = pathG.property("Path") || pathG.property("ADBE Vector Shape");
            if (!pathP) continue;

            var snippet = "";
            if (grp.name === "Balloon Body" && (tStyle === "triangle" || tStyle === "curved_triangle" || tStyle === "lightning")) {
                snippet = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "body", 0);
            } else if (grp.name === "Tail Line" && tStyle === "line") {
                snippet = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "line", 0);
            } else if (grp.name.indexOf("Thought Cloud ") === 0 && tStyle === "clouds") {
                var cIdx = parseInt(grp.name.replace("Thought Cloud ", ""), 10) || 1;
                snippet = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "cloud", cIdx);
            }
            if (snippet) {
                pathP.expression = snippet + "createPath(V0, I0, O0, IS_CLOSED);";
            }
        }
    }

    /**
     * Generates a createPath(...) expression that expands the balloon's width
     * horizontally from 0 -> full width WITHOUT Scale distortion (preserving
     * corner radii, Electric chevrons, puff curves, and spike tips along the caps).
     */
    function buildBloatPathExpression(shapeData, halfTextW, cfg, envRefExpr, offsetXY, dynamicSnippet) {
        var bodyHalfW = Math.max(12, halfTextW + (cfg.padX || 0));
        if (shapeData && shapeData.vertices) {
            for (var vi = 0; vi < shapeData.vertices.length; vi++) {
                var avx = Math.abs(shapeData.vertices[vi][0] || 0);
                if (cfg.geometry === "electric" && avx > bodyHalfW) {
                    bodyHalfW = avx;
                }
            }
        }

        var capR = 16;
        if (cfg.geometry === "square") {
            capR = 2;
        } else if (cfg.geometry === "electric") {
            capR = Math.min(bodyHalfW * 0.80, Math.max(14, bodyHalfW - halfTextW));
        } else if (cfg.geometry === "rounded" || cfg.geometry === "wobbly" || cfg.geometry === "bubble_lines") {
            capR = Math.min(bodyHalfW * 0.9, Math.max(4, cfg.cornerRadius || 0));
        } else {
            capR = Math.min(bodyHalfW * 0.65, 22);
        }
        var splitX = Math.max(0, Math.round((bodyHalfW - capR) * 100) / 100);
        bodyHalfW  = Math.round(bodyHalfW * 100) / 100;
        capR       = Math.round(capR * 100) / 100;

        var offX = offsetXY ? (Math.round(offsetXY[0] * 100) / 100) : 0;
        var offY = offsetXY ? (Math.round(offsetXY[1] * 100) / 100) : 0;

        var sourceInit = dynamicSnippet
            ? dynamicSnippet
            : (
                'var V0 = ' + serialize2DArrayCompact(shapeData.vertices) + ';\n' +
                'var I0 = ' + serialize2DArrayCompact(shapeData.inTangents) + ';\n' +
                'var O0 = ' + serialize2DArrayCompact(shapeData.outTangents) + ';\n' +
                'var IS_CLOSED = ' + (shapeData.closed ? "true" : "false") + ';\n'
            );

        return (
            'var env = clamp(' + envRefExpr + ', 0, 100) / 100.0;\n' +
            'var p = env * env * (3.0 - 2.0 * env);\n' +
            sourceInit +
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
            '    V.push([nx + ' + offX + ', vy + ' + offY + ']);\n' +
            '    IT.push([nix, iy]);\n' +
            '    OT.push([nox, oy]);\n' +
            '}\n' +
            'createPath(V, IT, OT, IS_CLOSED);'
        );
    }

    /**
     * Creates the masked companion Shape Layer ("Comic Balloon Rovi Fill") directly
     * behind `balloonLayer` for Style 4 ("rovi"):
     *   - Clipped strictly to the balloon interior via native AE Masks (ADBE Mask Parade)
     *     so zero stroke glow ever bleeds outside the perimeter.
     *   - Uses 4 concentric round-capped/round-joined Stroke bands in `fillColor` driven
     *     by the exact same Trim Paths arc from the tail tip as the outer stroke:
     *     expanding inward toward the center while thickening and gaining opacity until
     *     100% of the balloon interior is uniformly filled at `p = 1`.
     */
    function createRoviInnerGlowFillLayer(comp, textLayer, balloonLayer, geoResult, textBounds, cfg, bodyOffsetDeg, hasTailLead, envFromChildExpr, targetLink) {
        if (!comp || !textLayer || !balloonLayer || !cfg.fillEnabled) return null;
        var layerFillOp = clampNum(cfg.fillOpacity, 0, 100, 100);
        if (layerFillOp <= 0.01) return null;

        var roviLayer = comp.layers.addShape();
        roviLayer.name = ROVI_FILL_LAYER_NAME;
        try { roviLayer.comment = ROVI_FILL_LAYER_TAG; } catch (eRC) {}
        try { roviLayer.label = 11; } catch (eRL) {}
        try { roviLayer.enabled = true; } catch (eRE) {}

        var is3D = Boolean(textLayer.threeDLayer);
        try { roviLayer.threeDLayer = is3D; } catch (eR3D) {}

        roviLayer.parent = textLayer;
        var rTr = roviLayer.property("Transform");
        rTr.property("Anchor Point").setValue(is3D ? [0, 0, 0] : [0, 0]);
        rTr.property("Position").setValue(is3D ? [0, 0, 0] : [0, 0]);
        rTr.property("Scale").setValue(is3D ? [100, 100, 100] : [100, 100]);
        var rRot = rTr.property("Rotation") || rTr.property("Z Rotation");
        if (rRot) rRot.setValue(0);
        var rOp = rTr.property("Opacity");
        if (rOp) rOp.setValue(layerFillOp);

        try { roviLayer.moveAfter(balloonLayer); } catch (eRMv) {}

        var isDynTarget = Boolean(targetLink && targetLink.guideName && cfg.tailPlacementMode === "target" && cfg.tailStyle && cfg.tailStyle !== "none");
        var dynBodyPathExpr = "";
        if (isDynTarget && (cfg.tailStyle === "triangle" || cfg.tailStyle === "curved_triangle" || cfg.tailStyle === "lightning")) {
            var bSnip = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "body", 0);
            if (bSnip) dynBodyPathExpr = bSnip + "createPath(V0, I0, O0, IS_CLOSED);";
        }

        // 1. Add Interior Clipping Masks (ADBE Mask Parade) so stroke expands strictly inward
        var masksParade = roviLayer.property("ADBE Mask Parade") || roviLayer.property("Masks");
        function appendInteriorMask(maskName, sd, dynExpr) {
            if (!masksParade || typeof masksParade.addProperty !== "function" || !sd || !sd.vertices) return;
            try {
                var mAtom = masksParade.addProperty("ADBE Mask Atom");
                if (!mAtom) return;
                mAtom.name = maskName;
                var mShapeProp = mAtom.property("ADBE Mask Shape") || mAtom.property("Mask Path");
                if (mShapeProp) {
                    var mObj = new ShapeClass();
                    mObj.vertices = sd.vertices;
                    mObj.inTangents = sd.inTangents;
                    mObj.outTangents = sd.outTangents;
                    mObj.closed = Boolean(sd.closed);
                    mShapeProp.setValue(mObj);
                    if (dynExpr) mShapeProp.expression = dynExpr;
                }
                if (typeof MaskMode !== "undefined" && MaskMode.ADD !== undefined) {
                    try { mAtom.maskMode = MaskMode.ADD; } catch (eMM) {}
                }
            } catch (eAddM) {}
        }

        appendInteriorMask("Rovi Body Mask", geoResult.bodyShape, dynBodyPathExpr);
        var ei;
        for (ei = 0; ei < geoResult.extraShapes.length; ei++) {
            if (geoResult.extraShapes[ei].filled) {
                var cDynM = "";
                if (isDynTarget && cfg.tailStyle === "clouds" && geoResult.extraShapes[ei].name.indexOf("Thought Cloud ") === 0) {
                    var cIdxM = parseInt(geoResult.extraShapes[ei].name.replace("Thought Cloud ", ""), 10) || 1;
                    var cSnipM = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "cloud", cIdxM);
                    if (cSnipM) cDynM = cSnipM + "createPath(V0, I0, O0, IS_CLOSED);";
                }
                appendInteriorMask("Rovi " + geoResult.extraShapes[ei].name + " Mask", geoResult.extraShapes[ei].shapeData, cDynM);
            }
        }

        // 2. Populate Concentric Inner-Glow Expanding Stroke Bands
        var rContents = roviLayer.property("Contents") || roviLayer.property("ADBE Root Vectors Group");
        if (!rContents) return roviLayer;

        var fRgb = hexToRgb(cfg.fillColor);
        var balloonW = Math.max(24, (textBounds.width || 160) + (cfg.padX || 0) * 2);
        var balloonH = Math.max(24, (textBounds.height || 80) + (cfg.padY || 0) * 2);
        var spanW = Math.max(balloonW, (geoResult.bounds.maxX - geoResult.bounds.minX));
        var spanH = Math.max(balloonH, (geoResult.bounds.maxY - geoResult.bounds.minY));
        var fullCoverW = Math.min(2000, Math.round(Math.max(100, Math.min(spanW, spanH) * 1.35 + Math.max(balloonW, balloonH) * 0.35)));

        var ROVI_BANDS = [
            { name: "Deep Center Fill", wScale: 1.00, wExp: 1.60, opFormula: "(p <= 0.002) ? 0 : Math.min(100.0, 100.0 * (0.22 * p + 0.78 * Math.pow(p, 2.8)))" },
            { name: "Inner Glow Mid",   wScale: 0.68, wExp: 1.45, opFormula: "(p <= 0.002) ? 0 : Math.min(100.0, 100.0 * Math.pow(p, 1.85))" },
            { name: "Inner Glow Near",  wScale: 0.40, wExp: 1.30, opFormula: "(p <= 0.002) ? 0 : Math.min(100.0, 100.0 * Math.pow(p, 1.15))" },
            { name: "Inner Rim Core",   wScale: 0.18, wExp: 1.15, opFormula: "(p <= 0.002) ? 0 : Math.min(100.0, 100.0 * Math.pow(p, 0.65))" }
        ];

        function addGlowBandsForShape(baseLabel, sd, coverW, offsetDeg, pHeaderExpr, dynExpr) {
            if (!sd || !sd.vertices) return;
            for (var bi = 0; bi < ROVI_BANDS.length; bi++) {
                var band = ROVI_BANDS[bi];
                var bGrp = rContents.addProperty("ADBE Vector Group");
                bGrp.name = baseLabel + " - " + band.name;
                var bCont = bGrp.property("Contents") || bGrp.property("ADBE Vectors Group");
                if (!bCont) continue;

                var pGrp = bCont.addProperty("ADBE Vector Shape - Group");
                var sObj = new ShapeClass();
                sObj.vertices = sd.vertices;
                sObj.inTangents = sd.inTangents;
                sObj.outTangents = sd.outTangents;
                sObj.closed = Boolean(sd.closed);
                var pProp = pGrp.property("Path") || pGrp.property("ADBE Vector Shape");
                if (pProp) {
                    pProp.setValue(sObj);
                    if (dynExpr) pProp.expression = dynExpr;
                }

                var stProp = bCont.addProperty("ADBE Vector Graphic - Stroke");
                if (stProp) {
                    var colP = stProp.property("Color") || stProp.property("ADBE Vector Stroke Color");
                    if (colP) colP.setValue([fRgb[0], fRgb[1], fRgb[2], 1]);
                    try {
                        var lcP = stProp.property("Line Cap") || stProp.property("ADBE Vector Stroke Line Cap");
                        if (lcP) lcP.setValue(2); // Round Cap
                        var ljP = stProp.property("Line Join") || stProp.property("ADBE Vector Stroke Line Join");
                        if (ljP) ljP.setValue(2); // Round Join for smooth inward glow curvature
                        var mlP = stProp.property("Miter Limit") || stProp.property("ADBE Vector Stroke Miter Limit");
                        if (mlP) mlP.setValue(10);
                    } catch (eCapR) {}

                    var maxBandW = Math.max(4, Math.round(coverW * band.wScale * 10) / 10);
                    var swP = stProp.property("Stroke Width") || stProp.property("ADBE Vector Stroke Width");
                    if (swP) {
                        swP.setValue(maxBandW);
                        swP.expression = pHeaderExpr + "value * Math.pow(p, " + band.wExp.toFixed(2) + ");";
                    }
                    var soP = stProp.property("Opacity") || stProp.property("ADBE Vector Stroke Opacity");
                    if (soP) {
                        soP.setValue(100);
                        soP.expression = pHeaderExpr + band.opFormula + ";";
                    }
                }

                var trm = bCont.addProperty("ADBE Vector Filter - Trim");
                if (trm) {
                    var tS = trm.property("Start")  || trm.property("ADBE Vector Trim Start");
                    var tE = trm.property("End")    || trm.property("ADBE Vector Trim End");
                    var tO = trm.property("Offset") || trm.property("ADBE Vector Trim Offset");
                    if (tO && offsetDeg) tO.setValue(offsetDeg);
                    if (tS) tS.expression = pHeaderExpr + "50.0 - 50.0 * p;";
                    if (tE) tE.expression = pHeaderExpr + "50.0 + 50.0 * p;";
                }
            }
        }

        var leadStartB = hasTailLead ? 0.26 : 0.0;
        var leadSpanB  = hasTailLead ? 0.74 : 1.0;
        var bodyPHeader =
            "var raw = " + envFromChildExpr + " / 100.0;\n" +
            "var p = clamp((raw - " + leadStartB.toFixed(2) + ") / " + leadSpanB.toFixed(2) + ", 0, 1);\n";
        addGlowBandsForShape("Body", geoResult.bodyShape, fullCoverW, bodyOffsetDeg, bodyPHeader, dynBodyPathExpr);

        for (ei = 0; ei < geoResult.extraShapes.length; ei++) {
            var exS = geoResult.extraShapes[ei];
            if (exS.filled && exS.shapeData && exS.shapeData.vertices && exS.shapeData.vertices.length >= 3) {
                var cIdxR = parseInt(exS.name.replace("Thought Cloud ", ""), 10) || 1;
                var p0R = (3 - cIdxR) * 0.10;
                var p1R = p0R + 0.14;
                var cloudPHeader =
                    "var raw = " + envFromChildExpr + " / 100.0;\n" +
                    "var p = clamp((raw - " + p0R.toFixed(2) + ") / " + (p1R - p0R).toFixed(2) + ", 0, 1);\n";
                var cloudDiam = dist2D(exS.shapeData.vertices[0], exS.shapeData.vertices[2]);
                var cloudCoverW = Math.max(18, Math.round(cloudDiam * 1.40));
                var cDynB = "";
                if (isDynTarget && cfg.tailStyle === "clouds") {
                    var cSnipB = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "cloud", cIdxR);
                    if (cSnipB) cDynB = cSnipB + "createPath(V0, I0, O0, IS_CLOSED);";
                }
                addGlowBandsForShape(exS.name, exS.shapeData, cloudCoverW, 0, cloudPHeader, cDynB);
            }
        }

        return roviLayer;
    }

    function applyInOutAnimationRig(comp, textLayer, balloonLayer, geoResult, textBounds, cfg, precompLayer, outerCompName, hexCode) {
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

        var targetLink = null;
        if (cfg.tailPlacementMode === "target" && cfg.tailStyle && cfg.tailStyle !== "none" && hexCode) {
            targetLink = {
                guideName: TARGET_GUIDE_PREFIX + hexCode,
                outerCompName: outerCompName || "",
                precompLayerName: precompLayer ? precompLayer.name : "",
                fallbackTip: geoResult.pTip
            };
        }

        var style = cfg.animStyle || "none";
        if (style === "none") {
            if (targetLink) {
                applyDynamicTargetTailPaths(balloonLayer, geoResult, cfg, targetLink);
            }
            return;
        }

        // All active styles animate text with AE's basic Opacity Typewriter Animator
        applyTypewriterAnimator(textLayer);

        var rootContents = balloonLayer.property("Contents") || balloonLayer.property("ADBE Root Vectors Group");
        if (!rootContents) return;

        var envFromChildExpr = '(thisLayer.hasParent ? parent.effect("Bubble Envelope")(1).value : 100)';
        var numGroups = (typeof rootContents.numProperties === "number")
            ? rootContents.numProperties
            : (rootContents.properties ? rootContents.properties.length : 0);

        var gi, grp, gCont, fillG, fillOp, strokeG, strokeOp, strokeW, pathG, pathP;

        if (targetLink && style !== "bloat") {
            applyDynamicTargetTailPaths(balloonLayer, geoResult, cfg, targetLink);
        }

        // ---------------------------------------------------------------------
        // STYLE 1 ("clementine") & STYLE 4 ("rovi"):
        //   - Outer Stroke grows from the tip of the tail via Trim Paths
        //   - "clementine": flat Fill fades from opacity 0 to 100
        //   - "rovi": flat Fill is 0; masked inner-glow stroke expands inward
        //             from the growing perimeter toward the center to fill
        // ---------------------------------------------------------------------
        if (style === "clementine" || style === "rovi") {
            var tailStyle = cfg.tailStyle || "none";
            var hasTailLead = (tailStyle === "line" || tailStyle === "clouds");
            var bodyTargetPt = [0, (textBounds.height / 2) + (cfg.padY || 26)];
            if (tailStyle === "triangle" || tailStyle === "curved_triangle" || tailStyle === "lightning") {
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
                        if (style === "rovi") {
                            fillOp.setValue(0);
                            fillOp.expression = "0;";
                        } else {
                            fillOp.expression = 'var p = clamp(' + envFromChildExpr + ', 0, 100) / 100.0;\nvalue * p;';
                        }
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

            if (style === "rovi" && cfg.fillEnabled) {
                createRoviInnerGlowFillLayer(
                    comp,
                    textLayer,
                    balloonLayer,
                    geoResult,
                    textBounds,
                    cfg,
                    bodyOffsetDeg,
                    hasTailLead,
                    envFromChildExpr,
                    targetLink
                );
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
                            var bloatDynSnip = "";
                            if (targetLink) {
                                if (grp.name === "Balloon Body" && (cfg.tailStyle === "triangle" || cfg.tailStyle === "curved_triangle" || cfg.tailStyle === "lightning")) {
                                    bloatDynSnip = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "body", 0);
                                } else if (grp.name === "Tail Line" && cfg.tailStyle === "line") {
                                    bloatDynSnip = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "line", 0);
                                } else if (grp.name.indexOf("Thought Cloud ") === 0 && cfg.tailStyle === "clouds") {
                                    var bcIdx = parseInt(grp.name.replace("Thought Cloud ", ""), 10) || 1;
                                    bloatDynSnip = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "cloud", bcIdx);
                                }
                            }
                            pathP.expression = buildBloatPathExpression(srcShape, halfTW, cfg, envFromChildExpr, null, bloatDynSnip);
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
                                var maskDynSnip = "";
                                if (targetLink && (cfg.tailStyle === "triangle" || cfg.tailStyle === "curved_triangle" || cfg.tailStyle === "lightning")) {
                                    maskDynSnip = buildDynamicTargetShapeSnippet(geoResult, cfg, targetLink, "body", 0);
                                }
                                mShapeProp.expression = buildBloatPathExpression(
                                    geoResult.bodyShape,
                                    halfTW,
                                    cfg,
                                    'effect("Bubble Envelope")(1).value',
                                    [tAp[0] || 0, tAp[1] || 0],
                                    maskDynSnip
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
            if (isRoviFillLayer(il)) continue;
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
        var wantsTargetGuide = (cfg.tailPlacementMode === "target" && cfg.tailStyle && cfg.tailStyle !== "none");

        // Case 1: Existing Precomp Selected & Make Precomp is STILL ON -> Fast In-Place Update!
        if (ctx.mode === "precomp" && cfg.makePrecomp) {
            var pLayer = ctx.precompLayer;
            var pItem  = ctx.precompItem;
            var innerText = ctx.textLayer;

            cleanupTextAnimationArtifacts(innerText, ctx.balloonLayer);

            var existingEnv = readLayerStateEffect(pLayer) || readLayerStateEffect(innerText) || {};
            var origRec = existingEnv.orig || capturePristineTextState(innerText);
            var hexCode = trimStr(pItem.name.replace(/^comic balloon\s+/i, "")) || existingEnv.precompHex || preferredHex || generateHexId(4);

            var centered = centerTextAnchorZeroShift(pItem, innerText, origRec);
            var lineSpecsPre = (cfg.geometry === "bubble_lines") ? measureTextLineBoxes(pItem, innerText, centered.bounds) : null;

            var pTr1   = pLayer.property("Transform");
            var pPos1  = pTr1.property("Position").value;
            var pSc1   = pTr1.property("Scale").value;
            var pRotP1 = pTr1.property("Rotation") || pTr1.property("Z Rotation");
            var pRot1  = pRotP1 ? (pRotP1.value || 0) : 0;

            var targetLocalPre = null;
            if (wantsTargetGuide) {
                var guide1 = findTargetGuideLayer(comp, hexCode);
                if (!guide1) {
                    var defCfg1 = cloneObject(cfg);
                    defCfg1.tailPlacementMode = "perimeter";
                    var defGeo1 = computeBalloonAndTail(centered.bounds.width, centered.bounds.height, defCfg1, lineSpecsPre, null);
                    var defWorld1 = balloonLocalToWorldPoint(defGeo1.pTip, pPos1, pSc1, pRot1);
                    guide1 = ensureTargetGuideLayer(comp, hexCode, defWorld1, pLayer);
                } else {
                    ensureTargetGuideLayer(comp, hexCode, [0, 0], pLayer);
                }
                if (guide1) {
                    var gPos1 = guide1.property("Transform").property("Position").value;
                    targetLocalPre = worldPointToBalloonLocal(gPos1, pPos1, pSc1, pRot1);
                }
            } else {
                removeTargetGuideLayer(comp, hexCode);
            }

            var geo = computeBalloonAndTail(centered.bounds.width, centered.bounds.height, cfg, lineSpecsPre, targetLocalPre);

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

            try { if (pLayer.canSetCollapseTransformation) pLayer.collapseTransformation = true; } catch (eCT1) {}
            var pAnchorProp = pLayer.property("Transform").property("Anchor Point");
            if (pLayer.threeDLayer) {
                pAnchorProp.setValue([newW / 2, newH / 2, 0]);
            } else {
                pAnchorProp.setValue([newW / 2, newH / 2]);
            }

            applyInOutAnimationRig(pItem, innerText, rebuiltBalloon, geo, centered.bounds, cfg, pLayer, comp.name, hexCode);

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
        var precompName = "";
        if (cfg.makePrecomp) {
            precompName = generateUniquePrecompName(activeHex);
            activeHex = trimStr(precompName.replace(/^comic balloon\s+/i, "")) || activeHex;
        }

        // Center Anchor Point of Text Layer (Zero-Shift)
        var cInfo = centerTextAnchorZeroShift(comp, targetText, origState);

        var preTr = targetText.property("Transform");
        var outerPos   = preTr.property("Position").value;
        var outerScale = preTr.property("Scale").value;
        var outerRotP  = preTr.property("Rotation") || preTr.property("Z Rotation");
        var outerRot   = outerRotP ? (outerRotP.value || 0) : 0;
        var outerParent = targetText.parent;
        var outer3D    = Boolean(targetText.threeDLayer);

        // Build Balloon + Tail Geometry & linked child Shape Layer
        var lineSpecsMain = (cfg.geometry === "bubble_lines") ? measureTextLineBoxes(comp, targetText, cInfo.bounds) : null;
        var targetLocalMain = null;
        var activeGuideLayer = null;

        if (wantsTargetGuide) {
            activeGuideLayer = findTargetGuideLayer(comp, activeHex);
            if (!activeGuideLayer) {
                var defCfgM = cloneObject(cfg);
                defCfgM.tailPlacementMode = "perimeter";
                var defGeoM = computeBalloonAndTail(cInfo.bounds.width, cInfo.bounds.height, defCfgM, lineSpecsMain, null);
                var defWorldM = balloonLocalToWorldPoint(defGeoM.pTip, outerPos, outerScale, outerRot);
                activeGuideLayer = ensureTargetGuideLayer(comp, activeHex, defWorldM, targetText);
            } else {
                ensureTargetGuideLayer(comp, activeHex, [0, 0], targetText);
            }
            if (activeGuideLayer) {
                var gPosM = activeGuideLayer.property("Transform").property("Position").value;
                targetLocalMain = worldPointToBalloonLocal(gPosM, outerPos, outerScale, outerRot);
            }
        } else {
            removeTargetGuideLayer(comp, activeHex);
        }

        var geoData = computeBalloonAndTail(cInfo.bounds.width, cInfo.bounds.height, cfg, lineSpecsMain, targetLocalMain);
        targetBalloon = createOrRebuildBalloonLayer(comp, targetText, targetBalloon, geoData, cfg);

        var env = { version: 2, precompHex: activeHex, orig: origState, config: cfg };
        writeLayerStateEffect(targetText, env);

        // If Make Precomp is OFF, rig timing/animation directly in current comp
        if (!cfg.makePrecomp) {
            applyInOutAnimationRig(comp, targetText, targetBalloon, geoData, cInfo.bounds, cfg, null, "", activeHex);
            if (activeGuideLayer) {
                try { activeGuideLayer.moveBefore(targetText); } catch (eGMvT) {}
            }
            try {
                var cLen = getCompLayerCount(comp);
                for (var s = 1; s <= cLen; s++) getCompLayerAt(comp, s).selected = false;
                targetText.selected = true;
            } catch (eSel) {}
            if (comp._notify) comp._notify();
            return { precompName: null, precompHex: activeHex, isUpdate: isUpdateRun, mode: "text" };
        }

        // Case 3: Precompose Text + Child Balloon (+ any Emoji / Highlight children) into "comic balloon <HEX>"
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

        var actualHex = activeHex;
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

            if (activeGuideLayer) {
                try { activeGuideLayer.moveBefore(precompLayer); } catch (eGMvP) {}
            }

            if (innerTxt && innerBln) {
                applyInOutAnimationRig(precompItem, innerTxt, innerBln, geoData, cInfo.bounds, cfg, precompLayer, comp.name, actualHex);
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
     *   - Removes the Balloon layer, Target Guide Layer & animation artifacts
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
        var remHex = "";

        if (ctx.mode === "precomp") {
            env = readLayerStateEffect(ctx.precompLayer) || readLayerStateEffect(ctx.textLayer);
            remHex = trimStr(ctx.precompItem.name.replace(/^comic balloon\s+/i, "")) || ((env && env.precompHex) ? env.precompHex : "");
            var unpacked = unpackPrecompToParentComp(comp, ctx.precompLayer, ctx.precompItem, false);
            textLayer = unpacked.textLayer;
        } else {
            textLayer = ctx.textLayer;
            env = readLayerStateEffect(textLayer);
            remHex = (env && env.precompHex) ? env.precompHex : "";
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

        removeTargetGuideLayer(comp, remHex);

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

    function createToggleSliderRow(parent, labelStr, defEnabled, defVal, minVal, maxVal, unitStr, onValueChanged, decimals, fixedDecimals) {
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

        var chk = grp.add("checkbox", undefined, labelStr);
        chk.preferredSize = [104, -1];
        chk.value = Boolean(defEnabled);

        var sld = grp.add("slider", undefined, defVal, minVal, maxVal);
        sld.minvalue = minVal;
        sld.maxvalue = maxVal;
        sld.stepdelta = stepVal;
        sld.value = defVal;
        sld.alignment = ["fill", "center"];

        var txt = grp.add("edittext", undefined, fmtNum(defVal));
        txt.preferredSize = [46, 20];

        var uLbl = null;
        if (unitStr) {
            uLbl = grp.add("statictext", undefined, unitStr);
            uLbl.preferredSize = [18, -1];
        }

        function syncDomStep() {
            if (sld.domElement && sld.domElement.step !== String(stepVal)) {
                sld.domElement.step = String(stepVal);
            }
        }

        function syncEnabledState() {
            var en = Boolean(chk.value);
            sld.enabled = en;
            txt.enabled = en;
            if (uLbl) uLbl.enabled = en;
        }

        function setVal(v, notify) {
            syncDomStep();
            var clamped = clampNum(v, minVal, maxVal, defVal);
            var rounded = Math.round(clamped * factor) / factor;
            sld.value = rounded;
            txt.text = fmtNum(rounded);
            if (notify && typeof onValueChanged === "function") onValueChanged(rounded);
        }

        chk.onClick = function () {
            syncEnabledState();
            if (typeof onValueChanged === "function") onValueChanged(sld.value);
        };

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

        syncEnabledState();

        return {
            group: grp,
            checkbox: chk,
            slider: sld,
            edittext: txt,
            syncDomStep: syncDomStep,
            isEnabled: function () { return Boolean(chk.value); },
            setEnabled: function (en, notify) {
                chk.value = Boolean(en);
                syncEnabledState();
                if (notify && typeof onValueChanged === "function") onValueChanged(sld.value);
            },
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

        var suppressGeomAutoDefaults = false;
        var lastManualGeomKey = "rounded";

        var ctrlCornerRadius    = createSliderRow(pnlGeom, "Corner Radius:",   28,   0, 150, "px", refreshPreviewCanvas);
        var ctrlElectricPoint   = createSliderRow(pnlGeom, "Electric Point:",  58,  10, 150, "%",  refreshPreviewCanvas);
        var ctrlElectricSkew    = createSliderRow(pnlGeom, "Electric Skew:",  -22, -75,  75, "%",  refreshPreviewCanvas);
        var ctrlCloudPuffs      = createSliderRow(pnlGeom, "Cloud Puffs:",     12,   6,  30, "",   refreshPreviewCanvas);
        var ctrlCloudDepth      = createSliderRow(pnlGeom, "Puff Depth:",      42,  10, 120, "%",  refreshPreviewCanvas);
        var ctrlCloudWidthRand  = createSliderRow(pnlGeom, "Puff Width Rand:",  0,   0, 100, "%",  refreshPreviewCanvas);
        var ctrlSpikeCount      = createSliderRow(pnlGeom, "Burst Spikes:",    18,   6,  40, "",   refreshPreviewCanvas);
        var ctrlSpikeDepth      = createSliderRow(pnlGeom, "Spike Depth:",     85,  15, 220, "%",  refreshPreviewCanvas);
        var ctrlSpikeWidthRand  = createSliderRow(pnlGeom, "Spike Width Rand:", 0,   0, 100, "%",  refreshPreviewCanvas);

        ctrlElectricPoint.group.helpTip   = "Controls how far the pointed left & right Electric side chevrons jut outward (% of half-height).";
        ctrlElectricSkew.group.helpTip    = "Tilts the left & right Electric side tips vertically (0% = symmetric <--->, +/- slants tips).";
        ctrlCloudDepth.group.helpTip      = "Puff depth relative (%) to each individual puff's width.";
        ctrlCloudWidthRand.group.helpTip  = "0% = constant arc-length puff width; >0% = randomizes puff widths while keeping exact puff count.";
        ctrlSpikeDepth.group.helpTip      = "Spike height relative (%) to each individual spike's base width.";
        ctrlSpikeWidthRand.group.helpTip  = "0% = constant arc-length spike width; >0% = randomizes spike widths while keeping exact spike count.";

        var pnlWobbly = tabBalloon.add("panel", undefined, "Wobbly Outline (All Shapes — 0 = Crisp)");
        pnlWobbly.orientation = "column";
        pnlWobbly.alignChildren = ["fill", "top"];
        pnlWobbly.spacing = 5;
        pnlWobbly.margins = [8, 10, 8, 8];

        var ctrlWobblyWaves     = createSliderRow(pnlWobbly, "Wobbly Waves:",    0,  0,  36, "",  refreshPreviewCanvas);
        var ctrlWobblyDepth     = createSliderRow(pnlWobbly, "Wave Depth:",      0,  0,  50, "%", refreshPreviewCanvas);
        var ctrlWobblyWidthRand = createSliderRow(pnlWobbly, "Wave Width Rand:", 65, 0, 100, "%", refreshPreviewCanvas);

        ctrlWobblyWaves.group.helpTip     = "0 = crisp non-wobbly shape; >0 = adds hand-drawn wobbly waves to ANY selected balloon shape.";
        ctrlWobblyDepth.group.helpTip     = "0% = crisp non-wobbly shape; >0% = wave amplitude relative (%) to each wave's local span.";
        ctrlWobblyWidthRand.group.helpTip = "0% = uniform smooth waves; >0% = organic hand-drawn irregular wave widths & heights.";

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

            if (!suppressGeomAutoDefaults && key !== lastManualGeomKey) {
                if (key === "wobbly" && (ctrlWobblyWaves.getValue() <= 0 || ctrlWobblyDepth.getValue() <= 0)) {
                    ctrlWobblyWaves.setValue(14, false);
                    ctrlWobblyDepth.setValue(10, false);
                }
                if (key === "electric" && lastManualGeomKey !== "electric") {
                    ctrlCornerRadius.setValue(0, false);
                } else if ((key === "rounded" || key === "wobbly") && lastManualGeomKey === "electric" && ctrlCornerRadius.getValue() <= 0) {
                    ctrlCornerRadius.setValue(28, false);
                } else if (key === "bubble_lines" && lastManualGeomKey === "electric" && ctrlCornerRadius.getValue() <= 0) {
                    ctrlCornerRadius.setValue(18, false);
                }
            }
            lastManualGeomKey = key;

            ctrlCornerRadius.group.enabled   = (key === "rounded" || key === "electric" || key === "wobbly" || key === "bubble_lines");
            ctrlElectricPoint.group.enabled  = (key === "electric");
            ctrlElectricSkew.group.enabled   = (key === "electric");
            ctrlCloudPuffs.group.enabled     = (key === "cloud");
            ctrlCloudDepth.group.enabled     = (key === "cloud");
            ctrlCloudWidthRand.group.enabled = (key === "cloud");
            ctrlSpikeCount.group.enabled     = (key === "explosion");
            ctrlSpikeDepth.group.enabled     = (key === "explosion");
            ctrlSpikeWidthRand.group.enabled = (key === "explosion");

            // Wobbly Outline controls are ALWAYS enabled so ALL shapes can be made wobbly (or 0 for crisp)
            ctrlWobblyWaves.group.enabled     = true;
            ctrlWobblyDepth.group.enabled     = true;
            ctrlWobblyWidthRand.group.enabled = true;
            refreshPreviewCanvas();
        }
        ddGeometry.onChange = syncBalloonShapeVisibility;

        // ---------------------------------------------------------------------
        // TAB 2: TAIL (Style + Placement Mode: Perimeter % OR Draggable Guide)
        // ---------------------------------------------------------------------
        var tabTail = tabs.add("tab", undefined, "Tail");
        tabTail.orientation = "column";
        tabTail.alignChildren = ["fill", "top"];
        tabTail.spacing = 6;
        tabTail.margins = 8;

        var pnlTailStyle = tabTail.add("panel", undefined, "Tail Style & Placement Method");
        pnlTailStyle.orientation = "column";
        pnlTailStyle.alignChildren = ["fill", "top"];
        pnlTailStyle.spacing = 5;
        pnlTailStyle.margins = [8, 10, 8, 8];

        var grpTailTypeRow = pnlTailStyle.add("group");
        grpTailTypeRow.orientation = "row";
        grpTailTypeRow.alignChildren = ["left", "center"];
        grpTailTypeRow.spacing = 6;
        var lblTailStyle = grpTailTypeRow.add("statictext", undefined, "Tail Type:");
        lblTailStyle.preferredSize = [95, -1];
        var ddTailStyle = grpTailTypeRow.add("dropdownlist", undefined, TAIL_LABELS);
        ddTailStyle.alignment = ["fill", "center"];
        ddTailStyle.selection = 2;

        var grpTailModeRow = pnlTailStyle.add("group");
        grpTailModeRow.orientation = "row";
        grpTailModeRow.alignChildren = ["left", "center"];
        grpTailModeRow.spacing = 6;
        var lblTailMode = grpTailModeRow.add("statictext", undefined, "Placement:");
        lblTailMode.preferredSize = [95, -1];
        var ddTailPlacement = grpTailModeRow.add("dropdownlist", undefined, TAIL_PLACEMENT_LABELS);
        ddTailPlacement.alignment = ["fill", "center"];
        ddTailPlacement.selection = 0;
        ddTailPlacement.helpTip = "Method 1: Trim-Paths Perimeter (%). Method 2: Draggable AE Guide Layer whose closest point on the perimeter sets the tail origin.";

        var chkTargetSnapTip = pnlTailStyle.add("checkbox", undefined, 'Pin Tail Tip to Draggable Guide ("Tail Target <HEX>")');
        chkTargetSnapTip.value = true;
        chkTargetSnapTip.helpTip = "When checked, dragging the Guide Layer moves BOTH the closest-point tail origin on the perimeter AND the tail tip directly to the Guide Layer. Uncheck to aim toward the Guide Layer using fixed Tail Length & Tip Slant.";

        // Trim-Paths-Style Perimeter Placement Panel
        var pnlTrim = tabTail.add("panel", undefined, "Perimeter Placement & Base Width");
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

        var pnlTailTarget = tabTail.add("panel", undefined, "Tail Target Length, Slant & Curve");
        pnlTailTarget.orientation = "column";
        pnlTailTarget.alignChildren = ["fill", "top"];
        pnlTailTarget.spacing = 5;
        pnlTailTarget.margins = [8, 10, 8, 8];

        var ctrlTailLength = createSliderRow(pnlTailTarget, "Tail Length:", 85,   15, 350, "px", refreshPreviewCanvas);
        var ctrlTailAngle  = createSliderRow(pnlTailTarget, "Tip Slant:",   12,  -70,  70, "°",  refreshPreviewCanvas);
        var ctrlTailCurve  = createSliderRow(pnlTailTarget, "Tail Curve:",  45, -100, 100, "%",  refreshPreviewCanvas);
        ctrlTailCurve.group.helpTip = "Controls the swooping bend of the Curved Triangle tail (-100% to +100%).";

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

            var pIdx = ddTailPlacement.selection ? ddTailPlacement.selection.index : 0;
            var pMode = TAIL_PLACEMENT_KEYS[pIdx] || "perimeter";
            var isTargetMode = (pMode === "target");

            ddTailPlacement.enabled  = hasTail;
            chkTargetSnapTip.enabled = (hasTail && isTargetMode);

            pnlTrim.enabled              = hasTail;
            grpQuickEdges.enabled        = (hasTail && !isTargetMode);
            ctrlTailPos.group.enabled    = (hasTail && !isTargetMode);
            ctrlTailOffset.group.enabled = (hasTail && !isTargetMode);
            ctrlTailWidth.group.enabled  = hasTail;

            pnlTailTarget.enabled         = hasTail;
            var manualLenEnabled          = hasTail && (!isTargetMode || !chkTargetSnapTip.value);
            ctrlTailLength.group.enabled  = manualLenEnabled;
            ctrlTailAngle.group.enabled   = manualLenEnabled;
            ctrlTailCurve.group.enabled   = (hasTail && key === "curved_triangle");
            refreshPreviewCanvas();
        }
        ddTailStyle.onChange      = syncTailControlsVisibility;
        ddTailPlacement.onChange  = syncTailControlsVisibility;
        chkTargetSnapTip.onClick  = syncTailControlsVisibility;

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

        var ctrlStartDelay = createSliderRow(pnlTiming, "Start Delay:", 0.0, 0.0, 10.0, "s", onTimingControlChanged, 1, true);
        var ctrlInTime     = createToggleSliderRow(pnlTiming, "Fade In:",  true, 0.6, 0.1, 5.0, "s", onTimingControlChanged, 1, true);
        var ctrlOutTime    = createToggleSliderRow(pnlTiming, "Fade Out:", true, 0.5, 0.1, 5.0, "s", onTimingControlChanged, 1, true);
        var ctrlReadTime   = createSliderRow(pnlTiming, "Read Time:",   2.0, 0.2, 20.0, "s", onTimingControlChanged, 1, true);

        ctrlInTime.checkbox.helpTip  = "Activate or disable Fade In (uncheck to use Fade Out only).";
        ctrlOutTime.checkbox.helpTip = "Activate or disable Fade Out (uncheck to use Fade In only).";

        var chkLinkReadTime = pnlTiming.add("checkbox", undefined, "Link Read Time to Text Length (25 chars)");
        chkLinkReadTime.value = true;
        chkLinkReadTime.helpTip = "Automatically computes Read Time from text length based on seconds per 25 characters.";

        var ctrlSecPer25 = createSliderRow(pnlTiming, "Sec / 25 Chars:", 1.2, 0.2, 5.0, "s", onTimingControlChanged, 1, true);

        var lblReadSummary = pnlTiming.add("statictext", undefined, "Status Effect: 0=waiting, 1=start, 2=in, 3=reading, 4=out, 5=end");
        lblReadSummary.alignment = ["fill", "top"];
        lblReadSummary.helpTip = 'Creates "Bubble Status", "Bubble Enable In", "Bubble Enable Out", and In / Reading / Out timing Effects for custom expressions.';

        function syncInOutControlsVisibility() {
            var aIdx = ddAnimStyle.selection ? ddAnimStyle.selection.index : 0;
            var aKey = ANIM_KEYS[aIdx] || "none";
            if (aKey === "clementine") {
                lblAnimDesc.text = "Typewriter text + Stroke trims from tail tip + Fill fades 0-100%.";
            } else if (aKey === "rovi") {
                lblAnimDesc.text = "Typewriter + Stroke trims from tail + Inner-glow stroke expands to fill.";
            } else if (aKey === "bloat") {
                lblAnimDesc.text = "Typewriter text + Balloon width expands masking text + Stroke 0->Max.";
            } else if (aKey === "sparse_dots") {
                lblAnimDesc.text = "Typewriter text + Sparse dotted stroke coalesces to solid + Fill fades.";
            } else {
                lblAnimDesc.text = "Static balloon (Timing & Status effects still generated).";
            }

            var hasIn  = ctrlInTime.isEnabled();
            var hasOut = ctrlOutTime.isEnabled();
            var modeTag = (hasIn && hasOut)
                ? "In+Out"
                : (hasIn ? "In Only" : (hasOut ? "Out Only" : "In/Out Off"));

            var isLinked = Boolean(chkLinkReadTime.value);
            ctrlSecPer25.group.enabled = isLinked;
            ctrlReadTime.group.enabled = !isLinked;

            if (isLinked) {
                var cTarget = resolveTargetContext(true);
                var nChars = (cTarget && cTarget.textLayer) ? countReadableChars(cTarget.textLayer) : 33;
                var autoRd = Math.max(0.2, Math.round(((nChars / 25.0) * ctrlSecPer25.getValue()) * 10) / 10);
                ctrlReadTime.setValue(autoRd, false);
                lblReadSummary.text = "[" + modeTag + "] Auto Read: " + autoRd.toFixed(1) + "s (" + nChars + " chars) | Status: 0..5";
            } else {
                lblReadSummary.text = "[" + modeTag + "] Status: 0=wait, 1=start, 2=in, 3=read, 4=out, 5=end";
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
            var pIdx = ddTailPlacement.selection ? ddTailPlacement.selection.index : 0;
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
                electricPoint: Math.round(ctrlElectricPoint.getValue()),
                electricSkew: Math.round(ctrlElectricSkew.getValue()),
                cloudPuffs: Math.round(ctrlCloudPuffs.getValue()),
                cloudDepth: ctrlCloudDepth.getValue(),
                cloudWidthRand: ctrlCloudWidthRand.getValue(),
                spikeCount: Math.round(ctrlSpikeCount.getValue()),
                spikeDepth: ctrlSpikeDepth.getValue(),
                spikeWidthRand: ctrlSpikeWidthRand.getValue(),
                wobblyWaves: Math.round(ctrlWobblyWaves.getValue()),
                wobblyDepth: ctrlWobblyDepth.getValue(),
                wobblyWidthRand: ctrlWobblyWidthRand.getValue(),
                tailStyle: TAIL_KEYS[tIdx] || "triangle",
                tailPlacementMode: TAIL_PLACEMENT_KEYS[pIdx] || "perimeter",
                tailTargetSnapTip: Boolean(chkTargetSnapTip.value),
                tailPosition: tPos,
                tailStartWidth: tWidth,
                tailStart: tStart,
                tailEnd: tEnd,
                tailOffset: ctrlTailOffset.getValue(),
                tailLength: ctrlTailLength.getValue(),
                tailAngle: ctrlTailAngle.getValue(),
                tailCurve: ctrlTailCurve.getValue(),
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
                enableIn: ctrlInTime.isEnabled(),
                inTime: ctrlInTime.getValue(),
                readTime: ctrlReadTime.getValue(),
                linkReadTime: Boolean(chkLinkReadTime.value),
                secPer25: ctrlSecPer25.getValue(),
                enableOut: ctrlOutTime.isEnabled(),
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
            suppressGeomAutoDefaults = true;
            lastManualGeomKey = c.geometry;

            ddGeometry.selection      = indexOfKey(GEOMETRY_KEYS, c.geometry, 1);
            ddTailStyle.selection     = indexOfKey(TAIL_KEYS, c.tailStyle, 2);
            ddTailPlacement.selection = indexOfKey(TAIL_PLACEMENT_KEYS, c.tailPlacementMode, 0);
            ddStrokeStyle.selection   = indexOfKey(STROKE_KEYS, c.strokeStyle, 1);
            ddAnimStyle.selection     = indexOfKey(ANIM_KEYS, c.animStyle, 0);

            ctrlPadX.setValue(c.padX, false);
            ctrlPadY.setValue(c.padY, false);
            ctrlCornerRadius.setValue(c.cornerRadius, false);
            ctrlElectricPoint.setValue(c.electricPoint, false);
            ctrlElectricSkew.setValue(c.electricSkew, false);
            ctrlCloudPuffs.setValue(c.cloudPuffs, false);
            ctrlCloudDepth.setValue(c.cloudDepth, false);
            ctrlCloudWidthRand.setValue(c.cloudWidthRand, false);
            ctrlSpikeCount.setValue(c.spikeCount, false);
            ctrlSpikeDepth.setValue(c.spikeDepth, false);
            ctrlSpikeWidthRand.setValue(c.spikeWidthRand, false);
            ctrlWobblyWaves.setValue(c.wobblyWaves, false);
            ctrlWobblyDepth.setValue(c.wobblyDepth, false);
            ctrlWobblyWidthRand.setValue(c.wobblyWidthRand, false);

            chkTargetSnapTip.value = Boolean(c.tailTargetSnapTip);
            ctrlTailPos.setValue(c.tailPosition, false);
            ctrlTailWidth.setValue(c.tailStartWidth, false);
            ctrlTailOffset.setValue(c.tailOffset, false);
            ctrlTailLength.setValue(c.tailLength, false);
            ctrlTailAngle.setValue(c.tailAngle, false);
            ctrlTailCurve.setValue(c.tailCurve, false);

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
            ctrlInTime.setEnabled(c.enableIn, false);
            ctrlInTime.setValue(c.inTime, false);
            ctrlReadTime.setValue(c.readTime, false);
            chkLinkReadTime.value = Boolean(c.linkReadTime);
            ctrlSecPer25.setValue(c.secPer25, false);
            ctrlOutTime.setEnabled(c.enableOut, false);
            ctrlOutTime.setValue(c.outTime, false);

            chkMakePrecomp.value = Boolean(c.makePrecomp);

            syncBalloonShapeVisibility();
            suppressGeomAutoDefaults = false;

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

                var previewSegs = buildBalloonPerimeterSegments(cfg.geometry === "electric" ? 56 : 68, 26, {
                    geometry: cfg.geometry,
                    padX: cfg.geometry === "bubble_lines" ? 7 : (cfg.geometry === "electric" ? 8 : 10),
                    padY: cfg.geometry === "bubble_lines" ? 5 : 8,
                    cornerRadius: Math.min(cfg.geometry === "bubble_lines" ? 6 : 12, cfg.cornerRadius * 0.4),
                    electricPoint: cfg.electricPoint,
                    electricSkew: cfg.electricSkew,
                    cloudPuffs: cfg.cloudPuffs,
                    cloudDepth: cfg.cloudDepth,
                    cloudWidthRand: cfg.cloudWidthRand,
                    spikeCount: Math.min(18, cfg.spikeCount),
                    spikeDepth: Math.min(95, cfg.spikeDepth),
                    spikeWidthRand: cfg.spikeWidthRand,
                    wobblyWaves: cfg.wobblyWaves,
                    wobblyDepth: cfg.wobblyDepth,
                    wobblyWidthRand: cfg.wobblyWidthRand,
                    _isPreviewIcon: true
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
                    el.style.cursor = (cfg.tailPlacementMode === "target") ? "default" : "crosshair";

                    var segs = buildBalloonPerimeterSegments(cfg.geometry === "electric" ? 56 : 68, 26, {
                        geometry: cfg.geometry,
                        padX: cfg.geometry === "bubble_lines" ? 7 : (cfg.geometry === "electric" ? 8 : 10),
                        padY: cfg.geometry === "bubble_lines" ? 5 : 8,
                        cornerRadius: Math.min(cfg.geometry === "bubble_lines" ? 6 : 12, cfg.cornerRadius * 0.4),
                        electricPoint: cfg.electricPoint,
                        electricSkew: cfg.electricSkew,
                        cloudPuffs: cfg.cloudPuffs,
                        cloudDepth: cfg.cloudDepth,
                        cloudWidthRand: cfg.cloudWidthRand,
                        spikeCount: Math.min(18, cfg.spikeCount),
                        spikeDepth: Math.min(95, cfg.spikeDepth),
                        spikeWidthRand: cfg.spikeWidthRand,
                        wobblyWaves: cfg.wobblyWaves,
                        wobblyDepth: cfg.wobblyDepth,
                        wobblyWidthRand: cfg.wobblyWidthRand,
                        _isPreviewIcon: true
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
                        var txNum = cx + mEv.point[0] + 16 * Math.cos(outA);
                        var tyNum = cy + mEv.point[1] + 16 * Math.sin(outA);
                        var mxNum = cx + mEv.point[0];
                        var myNum = cy + mEv.point[1];
                        var tx = txNum.toFixed(1);
                        var ty = tyNum.toFixed(1);
                        var mx = mxNum.toFixed(1);
                        var my = myNum.toFixed(1);

                        var pointerLineSvg = '<line x1="' + mx + '" y1="' + my + '" x2="' + tx + '" y2="' + ty + '" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>';
                        if (cfg.tailStyle === "curved_triangle") {
                            var pdx = txNum - mxNum;
                            var pdy = tyNum - myNum;
                            var pLen = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
                            var ppx = -pdy / pLen;
                            var ppy = pdx / pLen;
                            var pDot = mEv.normal[0] * ppx + mEv.normal[1] * ppy;
                            var pSign = (Math.abs(pDot) > 0.05) ? (pDot >= 0 ? 1 : -1) : 1;
                            var pBow = (cfg.tailCurve / 100.0) * 8.5 * pSign;
                            var qx = ((mxNum + txNum) * 0.5 + ppx * pBow).toFixed(1);
                            var qy = ((myNum + tyNum) * 0.5 + ppy * pBow).toFixed(1);
                            pointerLineSvg = '<path d="M ' + mx + ' ' + my + ' Q ' + qx + ' ' + qy + ' ' + tx + ' ' + ty + '" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>';
                        }

                        var tipGlyphSvg = '<circle cx="' + tx + '" cy="' + ty + '" r="2.8" fill="#fbbf24"/>';
                        if (cfg.tailPlacementMode === "target") {
                            tipGlyphSvg =
                                '<circle cx="' + tx + '" cy="' + ty + '" r="5.5" fill="rgba(34,211,238,0.20)" stroke="#22d3ee" stroke-width="1.4"/>' +
                                '<circle cx="' + tx + '" cy="' + ty + '" r="2.0" fill="#fbbf24"/>';
                        }

                        hiSvg =
                            '<polyline points="' + arcPts.join(" ") + '" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round"/>' +
                            pointerLineSvg +
                            tipGlyphSvg;
                    }

                    el.innerHTML =
                        '<svg width="100%" height="100%" viewBox="0 0 136 76" style="display:block;pointer-events:none;">' +
                        '<polygon points="' + ptsAll.join(" ") + '" fill="rgba(255,255,255,0.08)" stroke="#64748b" stroke-width="1.5"/>' +
                        hiSvg +
                        '</svg>';

                    if (!el._trimDragBound) {
                        el._trimDragBound = true;
                        var updateFromMouse = function (ev) {
                            if (ddTailPlacement.selection && ddTailPlacement.selection.index === 1) return;
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
                            if (ddTailPlacement.selection && ddTailPlacement.selection.index === 1) return;
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
