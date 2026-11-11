// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: MESSAGE BUBBLE GENERATOR
// =============================================================================
//
// PURPOSE:
//   An interactive ScriptUI panel for Adobe After Effects that generates authentic,
//   expression-rigged chat and text message bubbles imitating modern messaging
//   platforms (Android RCS, iOS Messages, WhatsApp, Instagram Direct, Facebook Messenger, and Custom themes).
//
// FEATURES & WORKFLOW:
//   1. Message Text Input (Up to 250 characters, supports emojis).
//   2. Live Character Counter (with automatic 250-character limit enforcement).
//   3. Messaging Platform Preset Styles:
//      - Stored in a separate JSON file: "message bubble presets/presets.json".
//      - If not existing, automatically created on launch with platform presets.
//      - Quick-Reload (↻) and Open Presets Folder (📂) controls.
//      - Includes Android RCS, iOS Messages, WhatsApp, Instagram Direct, Facebook Messenger,
//        Telegram, Discord, and Custom themes.
//   4. Screen Width (px):
//      - Controls the layout boundary and drives automatic word-wrapping so the
//        text line splits naturally without overflowing the mobile screen ratio.
//   5. Text Size (px):
//      - Configurable typography scaling from 12px to 48px.
//   6. Direction Switch:
//      - Received: Aligned to the Left, neutral bubble background, left tail.
//      - Sent: Aligned to the Right, accent bubble background, right tail.
//   7. Theme Switch:
//      - Light Theme vs. Dark Theme with platform-accurate color palettes.
//   8. Timestamps:
//      - Generates realistic platform timestamps (e.g. 10:42 AM, 14:15).
//      - Randomized on demand with re-roll support (dialog setting coming later).
//   9. After Effects Layer Generation:
//      - Master Controller with interactive Effect Slider Controls.
//      - Parametric Vector Shape Layer for the Bubble.
//      - Native Typography Text Layers for Message and Timestamp.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript engine).
//   - Works both as a dockable panel (ScriptUI Panels) and as a floating palette.
// =============================================================================

(function(thisObj) {
    "use strict";

    // -------------------------------------------------------------------------
    // ExtendScript ES3 Polyfills & String Helpers (Compatibility with CC 2014-2026)
    // -------------------------------------------------------------------------
    if (typeof String.prototype.trim !== "function") {
        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g, "");
        };
    }
    if (typeof String.prototype.trimStart !== "function") {
        String.prototype.trimStart = function() {
            return this.replace(/^\s+/, "");
        };
    }
    if (typeof String.prototype.trimEnd !== "function") {
        String.prototype.trimEnd = function() {
            return this.replace(/\s+$/, "");
        };
    }
    if (typeof String.prototype.trimLeft !== "function") {
        String.prototype.trimLeft = String.prototype.trimStart;
    }
    if (typeof String.prototype.trimRight !== "function") {
        String.prototype.trimRight = String.prototype.trimEnd;
    }

    function trimStr(str) {
        if (str === null || typeof str === "undefined") return "";
        return String(str).replace(/^\s+|\s+$/g, "");
    }

    function trimLeftStr(str) {
        if (str === null || typeof str === "undefined") return "";
        return String(str).replace(/^\s+/, "");
    }

    // -------------------------------------------------------------------------
    // ExtendScript ES3 JSON Polyfill (Crockford json2 compliant)
    // -------------------------------------------------------------------------
    var JSONPolyfill = (function() {
        if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function" && typeof JSON.stringify === "function") {
            return JSON;
        }
        var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        var meta = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"': '\\"',
            '\\': '\\\\'
        };
        function quote(string) {
            escapable.lastIndex = 0;
            return escapable.test(string) ? '"' + string.replace(escapable, function(a) {
                var c = meta[a];
                return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' : '"' + string + '"';
        }
        var repSpace = '';
        function str(key, holder, gap, rep) {
            var value = holder[key];
            if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
                value = value.toJSON(key);
            }
            if (typeof rep === 'function') {
                value = rep.call(holder, key, value);
            }
            switch (typeof value) {
                case 'string': return quote(value);
                case 'number': return isFinite(value) ? String(value) : 'null';
                case 'boolean':
                case 'null': return String(value);
                case 'object':
                    if (!value) return 'null';
                    var mind = gap;
                    gap += repSpace;
                    var partial = [];
                    if (Object.prototype.toString.apply(value) === '[object Array]') {
                        var length = value.length;
                        for (var i = 0; i < length; i += 1) {
                            partial[i] = str(i, value, gap, rep) || 'null';
                        }
                        var v = partial.length === 0 ? '[]' : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' : '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }
                    for (var k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            var res = str(k, value, gap, rep);
                            if (res) {
                                partial.push((gap ? quote(k) + ': ' : quote(k) + ':') + res);
                            }
                        }
                    }
                    var result = partial.length === 0 ? '{}' : gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' : '{' + partial.join(',') + '}';
                    gap = mind;
                    return result;
            }
            return undefined;
        }
        return {
            stringify: function(value, replacer, space) {
                repSpace = '';
                if (typeof space === 'number') {
                    for (var i = 0; i < space; i += 1) repSpace += ' ';
                } else if (typeof space === 'string') {
                    repSpace = space;
                }
                return str('', {'': value}, '', replacer);
            },
            parse: function(text) {
                if (!text) return null;
                var rx_one = /^[\],:{}\s]*$/;
                var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
                var rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
                var rx_four = /(?:^|:|,)(?:\s*\[)+/g;
                if (rx_one.test(text.replace(rx_two, '@').replace(rx_three, ']').replace(rx_four, ''))) {
                    return eval('(' + text + ')');
                }
                throw new SyntaxError('JSON.parse: Invalid JSON string');
            }
        };
    })();
    if (typeof JSON === "undefined") {
        JSON = JSONPolyfill;
    }

    var SCRIPT_VERSION = "v1.0";
    var MAX_CHARS = 250;

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Message Bubble Generator " + SCRIPT_VERSION, undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Message Bubble Generator " + SCRIPT_VERSION;
    }

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 12;

    // -------------------------------------------------------------------------
    // 2. Color Palettes by Platform, Direction & Theme (Defaults)
    // -------------------------------------------------------------------------
    var DEFAULT_PLATFORMS = {
        "Android RCS": {
            label: "Android RCS style",
            radius: 18,
            tailType: "modern",
            font: "Roboto (Google / Android)",
            statusStyle: "rcs",
            light: {
                sent:     { bubble: "#0b57d0", text: "#ffffff", time: "rgba(255,255,255,0.75)", check: "" },
                received: { bubble: "#f1f3f4", text: "#1f1f1f", time: "#70757a", check: "" }
            },
            dark: {
                sent:     { bubble: "#a8c7fa", text: "#041e49", time: "rgba(4,30,73,0.75)", check: "" },
                received: { bubble: "#303134", text: "#e3e3e3", time: "#9aa0a6", check: "" }
            }
        },
        "iOS Message": {
            label: "iOS message style",
            radius: 18,
            tailType: "ios",
            font: "SF Pro (Apple / iOS)",
            statusStyle: "standard",
            light: {
                sent:     { bubble: "#007aff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#e9e9eb", text: "#000000", time: "#8e8e93", check: "" }
            },
            dark: {
                sent:     { bubble: "#0a84ff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#26252a", text: "#ffffff", time: "#8e8e93", check: "" }
            }
        },
        "WhatsApp": {
            label: "WhatsApp style",
            radius: 10,
            tailType: "whatsapp",
            font: "Helvetica Neue",
            statusStyle: "standard",
            light: {
                sent:     { bubble: "#d9fdd3", text: "#111b21", time: "#667781", check: "✓✓" },
                received: { bubble: "#ffffff", text: "#111b21", time: "#667781", check: "" }
            },
            dark: {
                sent:     { bubble: "#005c4b", text: "#e9edef", time: "#8696a0", check: "✓✓" },
                received: { bubble: "#202c33", text: "#e9edef", time: "#8696a0", check: "" }
            }
        },
        "Instagram": {
            label: "Instagram style",
            radius: 20,
            tailType: "instagram",
            font: "SF Pro (Apple / iOS)",
            statusStyle: "standard",
            light: {
                sent:     { bubble: "#7839ee", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#efefef", text: "#000000", time: "#8e8e93", check: "" }
            },
            dark: {
                sent:     { bubble: "#7c3aed", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#262626", text: "#f5f5f5", time: "#a8a8a8", check: "" }
            }
        },
        "Facebook Messenger": {
            label: "Facebook Messenger style",
            radius: 18,
            tailType: "messenger",
            font: "Segoe UI (Windows)",
            statusStyle: "standard",
            light: {
                sent:     { bubble: "#0084ff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "✓" },
                received: { bubble: "#e4e6eb", text: "#050505", time: "#65676b", check: "" }
            },
            dark: {
                sent:     { bubble: "#0084ff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "✓" },
                received: { bubble: "#303030", text: "#e4e6eb", time: "#b0b3b8", check: "" }
            }
        },
        "Telegram": {
            label: "Telegram style",
            radius: 16,
            tailType: "modern",
            font: "SF Pro (Apple / iOS)",
            statusStyle: "standard",
            light: {
                sent:     { bubble: "#effdde", text: "#000000", time: "#4fae4e", check: "✓✓" },
                received: { bubble: "#ffffff", text: "#000000", time: "#a0acb6", check: "" }
            },
            dark: {
                sent:     { bubble: "#2b5278", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "✓✓" },
                received: { bubble: "#182533", text: "#ffffff", time: "#708499", check: "" }
            }
        },
        "Discord": {
            label: "Discord style",
            radius: 14,
            tailType: "modern",
            font: "Inter",
            statusStyle: "standard",
            light: {
                sent:     { bubble: "#5865f2", text: "#ffffff", time: "rgba(255,255,255,0.75)", check: "" },
                received: { bubble: "#f2f3f5", text: "#2e3338", time: "#747f8d", check: "" }
            },
            dark: {
                sent:     { bubble: "#5865f2", text: "#ffffff", time: "rgba(255,255,255,0.75)", check: "" },
                received: { bubble: "#2b2d31", text: "#dbdee1", "time": "#949ba4", check: "" }
            }
        },
        "Custom": {
            label: "Custom style",
            radius: 16,
            tailType: "modern",
            font: "System Default",
            statusStyle: "standard",
            light: {
                sent:     { bubble: "#2563eb", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#f3f4f6", text: "#111827", time: "#6b7280", check: "" }
            },
            dark: {
                sent:     { bubble: "#3b82f6", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#1f2937", text: "#f9fafb", time: "#9ca3af", check: "" }
            }
        }
    };

    // -------------------------------------------------------------------------
    // External Preset File & Folder Management (Auto-Creation with Permission Fallback)
    // -------------------------------------------------------------------------
    var PRESETS_FOLDER_NAME = "message bubble presets";
    var PRESETS_FILE_NAME = "presets.json";
    var currentPresetsFolder = null;
    var currentPresetsFile = null;
    var warnedSecurityPref = false;

    function checkScriptSecurityPreference() {
        if (warnedSecurityPref) return;
        warnedSecurityPref = true;
        try {
            if (typeof app !== "undefined" && app && app.preferences) {
                var allowed = app.preferences.getPrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY");
                if (allowed === 0) {
                    alert("Notice: After Effects security is currently blocking scripts from writing files.\n\n" +
                          "To allow Message Bubble Generator to create presets on disk, please enable:\n" +
                          "Preferences > Scripting & Expressions > 'Allow Scripts to Write Files and Access Network'.\n\n" +
                          "Built-in default presets will be used in memory for now.");
                }
            }
        } catch(ePref) {}
    }

    function getPresetsFolder() {
        if (typeof Folder === "undefined") return null;

        var candidates = [];
        var scriptParent = null;

        try {
            if (typeof $.fileName !== "undefined" && $.fileName) {
                var sFile = new File($.fileName);
                if (sFile && sFile.exists) {
                    scriptParent = sFile.parent;
                    if (scriptParent && scriptParent.exists) {
                        candidates.push(new Folder(scriptParent.fsName + "/" + PRESETS_FOLDER_NAME));
                        if (scriptParent.parent && scriptParent.parent.exists) {
                            candidates.push(new Folder(scriptParent.parent.fsName + "/" + PRESETS_FOLDER_NAME));
                        }
                    }
                }
            }
        } catch(e1) {}

        // User AppData folder (Guaranteed writable without Administrator privileges)
        var userAppDataFolder = null;
        try {
            if (Folder.userData) {
                userAppDataFolder = new Folder(Folder.userData.fsName + "/Adobe/After Effects/" + PRESETS_FOLDER_NAME);
                candidates.push(userAppDataFolder);
            }
        } catch(e2) {}

        // User Documents folder
        var userDocsFolder = null;
        try {
            if (Folder.myDocuments) {
                userDocsFolder = new Folder(Folder.myDocuments.fsName + "/Adobe/After Effects/" + PRESETS_FOLDER_NAME);
                candidates.push(userDocsFolder);
            }
        } catch(e3) {}

        // Current working directory
        try {
            if (Folder.current) {
                candidates.push(new Folder(Folder.current.fsName + "/" + PRESETS_FOLDER_NAME));
            }
        } catch(e4) {}

        // 1. If any candidate folder exists and contains presets.json, use it
        for (var i = 0; i < candidates.length; i++) {
            var cand = candidates[i];
            if (cand && cand.exists) {
                var testF = new File(cand.fsName + "/" + PRESETS_FILE_NAME);
                var testAlt = new File(cand.fsName + "/message_bubble_presets.json");
                if (testF.exists || testAlt.exists) {
                    return cand;
                }
            }
        }

        // 2. If any candidate folder already exists (even if empty), use it
        for (var j = 0; j < candidates.length; j++) {
            if (candidates[j] && candidates[j].exists) {
                return candidates[j];
            }
        }

        // 3. Attempt creation: First next to script file
        if (scriptParent && scriptParent.exists) {
            try {
                var localF = new Folder(scriptParent.fsName + "/" + PRESETS_FOLDER_NAME);
                if (localF.create()) {
                    return localF;
                }
            } catch(eLoc) {}
        }

        // 4. Fallback creation: User AppData folder (handles Program Files installs where write is blocked)
        if (userAppDataFolder) {
            try {
                if (userAppDataFolder.create()) {
                    return userAppDataFolder;
                }
            } catch(eUsr) {}
        }

        // 5. Fallback creation: Documents folder
        if (userDocsFolder) {
            try {
                if (userDocsFolder.create()) {
                    return userDocsFolder;
                }
            } catch(eDoc) {}
        }

        return candidates.length > 0 ? candidates[0] : null;
    }

    function ensurePresetsFile(folder) {
        if (!folder || typeof File === "undefined") return null;
        var pFile = new File(folder.fsName + "/" + PRESETS_FILE_NAME);
        if (pFile.exists) return pFile;

        var altFile = new File(folder.fsName + "/message_bubble_presets.json");
        if (altFile.exists) return altFile;

        try {
            if (!folder.exists) {
                if (!folder.create()) {
                    checkScriptSecurityPreference();
                }
            }
            pFile.encoding = "UTF-8";
            if (pFile.open("w")) {
                var dataObj = {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "description": "After Effects Message Bubble Generator - Platform Style Presets",
                    "version": "1.0",
                    "presets": DEFAULT_PLATFORMS
                };
                pFile.write(JSONPolyfill.stringify(dataObj, null, 2));
                pFile.close();
            } else {
                checkScriptSecurityPreference();
            }
        } catch(eWrite) {
            checkScriptSecurityPreference();
        }
        return pFile;
    }

    function loadPresetsFromFile() {
        currentPresetsFolder = getPresetsFolder();
        if (!currentPresetsFolder) return 0;
        currentPresetsFile = ensurePresetsFile(currentPresetsFolder);
        if (!currentPresetsFile || !currentPresetsFile.exists) return 0;

        try {
            currentPresetsFile.encoding = "UTF-8";
            if (currentPresetsFile.open("r")) {
                var content = currentPresetsFile.read();
                currentPresetsFile.close();
                if (content && trimStr(content).length > 0) {
                    var parsed = JSONPolyfill.parse(content);
                    if (parsed && typeof parsed === "object") {
                        var rawMap = parsed.presets ? parsed.presets : parsed;
                        var count = 0;
                        var newPresets = {};
                        for (var k in rawMap) {
                            if (rawMap.hasOwnProperty(k) && k.charAt(0) !== "$" && k !== "version" && k !== "description") {
                                newPresets[k] = rawMap[k];
                                count++;
                            }
                        }
                        if (count > 0) {
                            if (!newPresets["Custom"] && DEFAULT_PLATFORMS["Custom"]) {
                                newPresets["Custom"] = DEFAULT_PLATFORMS["Custom"];
                            }
                            PLATFORMS = newPresets;
                            return count;
                        }
                    }
                }
            }
        } catch(eLoad) {}
        return 0;
    }

    // Active platforms map (loaded from JSON, with default fallback)
    var PLATFORMS = {};
    for (var kDef in DEFAULT_PLATFORMS) {
        if (DEFAULT_PLATFORMS.hasOwnProperty(kDef)) {
            PLATFORMS[kDef] = DEFAULT_PLATFORMS[kDef];
        }
    }
    loadPresetsFromFile();

    var platformKeys = [];
    function updatePlatformKeys() {
        platformKeys = [];
        for (var pKey in PLATFORMS) {
            if (PLATFORMS.hasOwnProperty(pKey) && pKey.charAt(0) !== "$" && pKey !== "version" && pKey !== "description") {
                platformKeys.push(pKey);
            }
        }
    }
    updatePlatformKeys();

    // -------------------------------------------------------------------------
    // Common Messaging App Fonts & System Typography
    // -------------------------------------------------------------------------
    var FONTS = [
        { name: "SF Pro (Apple / iOS)", css: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif", ae: "SFProText-Regular" },
        { name: "Roboto (Google / Android)", css: "Roboto, 'Google Sans', sans-serif", ae: "Roboto-Regular" },
        { name: "Segoe UI (Windows)", css: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", ae: "SegoeUI" },
        { name: "Helvetica Neue", css: "'Helvetica Neue', Helvetica, Arial, sans-serif", ae: "HelveticaNeue" },
        { name: "Arial", css: "Arial, Helvetica, sans-serif", ae: "ArialMT" },
        { name: "Inter", css: "Inter, sans-serif", ae: "Inter-Regular" },
        { name: "Open Sans", css: "'Open Sans', sans-serif", ae: "OpenSans-Regular" },
        { name: "System Default", css: "system-ui, -apple-system, sans-serif", ae: "" }
    ];

    // Helper: Hex color to AE 0.0-1.0 float array
    function hexToRgb(hex) {
        if (!hex) return [1, 1, 1];
        hex = hex.replace("#", "");
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

    // Helper: AE float color array to hex string
    function rgbToHex(rgb) {
        if (!rgb || !rgb.length) return "#FFFFFF";
        var r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255).toString(16);
        var g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255).toString(16);
        var b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255).toString(16);
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        return ("#" + r + g + b).toUpperCase();
    }

    function getLayer(comp, nameOrIndex) {
        if (!comp) return null;
        if (typeof comp.layer === "function") {
            try { return comp.layer(nameOrIndex); } catch (e) {}
        }
        if (comp.layers) {
            try {
                if (typeof nameOrIndex === "number") return comp.layers[nameOrIndex - 1] || comp.layers[nameOrIndex];
                if (typeof comp.layers.byName === "function") return comp.layers.byName(nameOrIndex);
                if (typeof comp.layers.find === "function") {
                    return comp.layers.find(function(l) { return l.name === nameOrIndex; }) || null;
                }
                for (var li = 1; li <= comp.layers.length; li++) {
                    var l = comp.layers[li];
                    if (l && l.name === nameOrIndex) return l;
                }
            } catch (e2) {}
        }
        return null;
    }

    // Helper: Generate a realistic random timestamp (e.g. "10:42 AM" or "18:25")
    function generateRandomTime() {
        var hour = Math.floor(1 + Math.random() * 12);
        var min = Math.floor(Math.random() * 60);
        var minStr = (min < 10) ? ("0" + min) : String(min);
        var ampm = Math.random() > 0.4 ? "PM" : "AM";
        return hour + ":" + minStr + " " + ampm;
    }

    // -------------------------------------------------------------------------
    // Core Geometry Engine: Custom Rounded Rectangle & Tail Pointer
    // -------------------------------------------------------------------------
    function computeShapeData(w, h, rTL, rTR, rBR, rBL, preventOverlap) {
        w = Math.max(0, w);
        h = Math.max(0, h);
        rTL = Math.max(0, rTL);
        rTR = Math.max(0, rTR);
        rBR = Math.max(0, rBR);
        rBL = Math.max(0, rBL);

        if (preventOverlap) {
            var topSum    = rTL + rTR;
            var bottomSum = rBL + rBR;
            var leftSum   = rTL + rBL;
            var rightSum  = rTR + rBR;

            var f = 1.0;
            if (topSum > w && topSum > 0)       f = Math.min(f, w / topSum);
            if (bottomSum > w && bottomSum > 0) f = Math.min(f, w / bottomSum);
            if (leftSum > h && leftSum > 0)     f = Math.min(f, h / leftSum);
            if (rightSum > h && rightSum > 0)   f = Math.min(f, h / rightSum);

            rTL *= f;
            rTR *= f;
            rBR *= f;
            rBL *= f;
        }

        var K = 0.5522847498307936;
        var halfW = w / 2;
        var halfH = h / 2;
        var xMin = -halfW;
        var xMax =  halfW;
        var yMin = -halfH;
        var yMax =  halfH;

        var points = [
            [xMin + rTL, yMin],        // P0: Top edge, TL curve end
            [xMax - rTR, yMin],        // P1: Top edge, TR curve start
            [xMax, yMin + rTR],        // P2: Right edge, TR curve end
            [xMax, yMax - rBR],        // P3: Right edge, BR curve start
            [xMax - rBR, yMax],        // P4: Bottom edge, BR curve end
            [xMin + rBL, yMax],        // P5: Bottom edge, BL curve start
            [xMin, yMax - rBL],        // P6: Left edge, BL curve end
            [xMin, yMin + rTL]         // P7: Left edge, TL curve start
        ];

        var inTangents = [
            [-rTL * K, 0],
            [0, 0],
            [0, -rTR * K],
            [0, 0],
            [rBR * K, 0],
            [0, 0],
            [0, rBL * K],
            [0, 0]
        ];

        var outTangents = [
            [0, 0],
            [rTR * K, 0],
            [0, 0],
            [0, rBR * K],
            [0, 0],
            [-rBL * K, 0],
            [0, 0],
            [0, -rTL * K]
        ];

        return {
            points: points,
            inTangents: inTangents,
            outTangents: outTangents
        };
    }

    function computeTailData(w, h, isSent) {
        var halfW = w / 2;
        var halfH = h / 2;
        if (isSent) {
            // Sent message: tail extends at bottom-right
            return {
                points: [
                    [halfW, halfH - 18],
                    [halfW + 7, halfH - 2],
                    [halfW + 8, halfH],
                    [halfW + 2, halfH],
                    [halfW - 16, halfH],
                    [halfW - 4, halfH - 12]
                ],
                inTangents: [
                    [0, 0],
                    [-2, -4],
                    [0, -1],
                    [2, 0],
                    [4, 0],
                    [0, 0]
                ],
                outTangents: [
                    [1, 5],
                    [1, 1],
                    [-2, 0],
                    [-4, 0],
                    [0, 0],
                    [0, 0]
                ]
            };
        } else {
            // Received message: tail extends at bottom-left (mirrored on X)
            return {
                points: [
                    [-halfW, halfH - 18],
                    [-halfW - 7, halfH - 2],
                    [-halfW - 8, halfH],
                    [-halfW - 2, halfH],
                    [-halfW + 16, halfH],
                    [-halfW + 4, halfH - 12]
                ],
                inTangents: [
                    [0, 0],
                    [2, -4],
                    [0, -1],
                    [-2, 0],
                    [-4, 0],
                    [0, 0]
                ],
                outTangents: [
                    [-1, 5],
                    [-1, 1],
                    [2, 0],
                    [4, 0],
                    [0, 0],
                    [0, 0]
                ]
            };
        }
    }

    var PATH_EXPR = [
        "// Custom Rounded Rectangle Base Expression (W3C CSS Proportional Overlap)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            var p = effect(name)(1);",
        "            return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "        } catch(e) {",
        "            try {",
        "                var p2 = parent.effect(name)(1);",
        "                return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "            } catch(e2) {",
        "                return fallback;",
        "            }",
        "        }",
        "    }",
        "",
        "    var w = Math.max(0, getVal('Bubble Width', getVal('Width', 300)));",
        "    var h = Math.max(0, getVal('Bubble Height', getVal('Height', 100)));",
        "    var rTL = Math.max(0, getVal('Radius Top-Left', 18));",
        "    var rTR = Math.max(0, getVal('Radius Top-Right', 18));",
        "    var rBR = Math.max(0, getVal('Radius Bottom-Right', 18));",
        "    var rBL = Math.max(0, getVal('Radius Bottom-Left', 18));",
        "    var preventOverlap = getVal('Prevent Overlap', 1);",
        "",
        "    if (preventOverlap > 0) {",
        "        var topSum    = rTL + rTR;",
        "        var bottomSum = rBL + rBR;",
        "        var leftSum   = rTL + rBL;",
        "        var rightSum  = rTR + rBR;",
        "",
        "        var f = 1.0;",
        "        if (topSum > w && topSum > 0)       f = Math.min(f, w / topSum);",
        "        if (bottomSum > w && bottomSum > 0) f = Math.min(f, w / bottomSum);",
        "        if (leftSum > h && leftSum > 0)     f = Math.min(f, h / leftSum);",
        "        if (rightSum > h && rightSum > 0)   f = Math.min(f, h / rightSum);",
        "",
        "        rTL *= f; rTR *= f; rBR *= f; rBL *= f;",
        "    }",
        "",
        "    var K = 0.5522847498307936;",
        "    var halfW = w / 2;",
        "    var halfH = h / 2;",
        "    var xMin = -halfW; var xMax = halfW;",
        "    var yMin = -halfH; var yMax = halfH;",
        "",
        "    var points = [",
        "        [xMin + rTL, yMin],",
        "        [xMax - rTR, yMin],",
        "        [xMax, yMin + rTR],",
        "        [xMax, yMax - rBR],",
        "        [xMax - rBR, yMax],",
        "        [xMin + rBL, yMax],",
        "        [xMin, yMax - rBL],",
        "        [xMin, yMin + rTL]",
        "    ];",
        "    var inTangents = [",
        "        [-rTL * K, 0],",
        "        [0, 0],",
        "        [0, -rTR * K],",
        "        [0, 0],",
        "        [rBR * K, 0],",
        "        [0, 0],",
        "        [0, rBL * K],",
        "        [0, 0]",
        "    ];",
        "    var outTangents = [",
        "        [0, 0],",
        "        [rTR * K, 0],",
        "        [0, 0],",
        "        [0, rBR * K],",
        "        [0, 0],",
        "        [-rBL * K, 0],",
        "        [0, 0],",
        "        [0, -rTL * K]",
        "    ];",
        "    return createPath(points, inTangents, outTangents, true);",
        "})();"
    ].join("\n");

    // -------------------------------------------------------------------------
    // Entrance Animations: Bubble Grow (5 frames) + Typewriter Reveal (5 frames)
    // -------------------------------------------------------------------------
    var BUBBLE_GROW_EXPR = [
        "// Entrance Grow Animation",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn <= 0) return value;",
        "",
        "    var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "    if (growFrames <= 0) return value;",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(eFps) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "",
        "    var f = time / fd;",
        "    if (f <= 0) return [0, 0];",
        "    if (f >= growFrames) return value;",
        "",
        "    var p = f / growFrames;",
        "    // Smooth snappy overshoot easing (easeOutBack)",
        "    var c1 = 1.3;",
        "    var c3 = c1 + 1.0;",
        "    var eased = 1.0 + c3 * Math.pow(p - 1.0, 3) + c1 * Math.pow(p - 1.0, 2);",
        "    var s = Math.max(0, Math.min(108, eased * 100));",
        "    return [value[0] * (s / 100), value[1] * (s / 100)];",
        "})();"
    ].join("\n");

    var BUBBLE_OPACITY_EXPR = [
        "// Clean Entrance Opacity",
        "(function() {",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(e) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(e2) {}",
        "    var f = time / fd;",
        "    if (f < 0) return 0;",
        "    return value;",
        "})();"
    ].join("\n");

    var TYPEWRITER_EXPR = [
        "// Typewriter Effect starting after Bubble Grow",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn <= 0) return value;",
        "",
        "    var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "    var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(eFps) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "",
        "    var f = time / fd;",
        "    if (f < growFrames) return '';",
        "    if (typeFrames <= 0) return value;",
        "    var fullStr = String(value);",
        "    if (f >= (growFrames + typeFrames)) return value;",
        "",
        "    var p = (f - growFrames) / typeFrames;",
        "    var charCount = Math.max(1, Math.round(p * fullStr.length));",
        "    return fullStr.substring(0, charCount);",
        "})();"
    ].join("\n");

    var TIMECODE_ENTRANCE_EXPR = [
        "// Entrance Fade In after Typewriter completion",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn <= 0) return value;",
        "",
        "    var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "    var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(eFps) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "",
        "    var f = time / fd;",
        "    var startF = growFrames + typeFrames;",
        "    if (startF <= 0) return value;",
        "    if (f < startF) return 0;",
        "    if (f >= startF + 2) return value;",
        "    return value * ((f - startF) / 2.0);",
        "})();"
    ].join("\n");

    // -------------------------------------------------------------------------
    // iOS 18 Animated Text Effects - Dynamic Expressions Engine
    // -------------------------------------------------------------------------
    var POS_ANIM_EXPR = [
        "// iOS 18 Animated Text Effect - Position Expression",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        try {",
        "            var p3 = effect(name)(1);",
        "            return (p3 && typeof p3.value !== 'undefined') ? p3.value : (p3 !== undefined ? p3 : fallback);",
        "        } catch(e3) {}",
        "        return fallback;",
        "    }",
        "",
        "    var effectType = Math.round(getVal('Animation Effect Type', 0));",
        "    if (effectType === 0) return value;",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        if ((time / fd) < (growFrames + typeFrames)) return value;",
        "    }",
        "",
        "    var speed = Math.max(0.1, getVal('Animation Speed', 100) / 100);",
        "    var amp = Math.max(0, getVal('Animation Intensity', 100) / 100);",
        "    var t = time * speed;",
        "    var dx = 0;",,
        "    var dy = 0;",
        "",
        "    if (effectType === 3) {",
        "        // 3: Shake (rapid horizontal wobble)",
        "        var freq = 20 * speed;",
        "        dx = Math.sin(time * freq * Math.PI * 2) * (8 * amp);",
        "    } else if (effectType === 4) {",
        "        // 4: Nod (rhythmic vertical bobbing)",
        "        var freq = 2.4 * speed;",
        "        dy = Math.sin(time * freq * Math.PI * 2) * (10 * amp);",
        "    } else if (effectType === 6) {",
        "        // 6: Ripple (floating wave undulating motion)",
        "        var freq = 3.2 * speed;",
        "        dy = Math.sin(time * freq) * (7 * amp);",
        "        dx = Math.cos(time * freq * 0.6) * (4 * amp);",
        "    } else if (effectType === 8) {",
        "        // 8: Jitter (erratic twitching)",
        "        try {",
        "            var w = wiggle(22 * speed, 5 * amp);",
        "            return [w[0], w[1], (value.length > 2 ? value[2] : 0)];",
        "        } catch(eW) {",
        "            dx = (Math.sin(time * 43 * speed) + Math.cos(time * 67 * speed)) * (2.5 * amp);",
        "            dy = (Math.cos(time * 53 * speed) + Math.sin(time * 71 * speed)) * (2.5 * amp);",
        "        }",
        "    }",
        "",
        "    return [value[0] + dx, value[1] + dy, (value.length > 2 ? value[2] : 0)];",
        "})();"
    ].join("\n");

    var SCALE_ANIM_EXPR = [
        "// iOS 18 Animated Text Effect - Scale Expression",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        try {",
        "            var p3 = effect(name)(1);",
        "            return (p3 && typeof p3.value !== 'undefined') ? p3.value : (p3 !== undefined ? p3 : fallback);",
        "        } catch(e3) {}",
        "        return fallback;",
        "    }",
        "",
        "    var effectType = Math.round(getVal('Animation Effect Type', 0));",
        "    if (effectType === 0) return value;",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        if ((time / fd) < (growFrames + typeFrames)) return value;",
        "    }",
        "",
        "    var speed = Math.max(0.1, getVal('Animation Speed', 100) / 100);",
        "    var amp = Math.max(0, getVal('Animation Intensity', 100) / 100);",
        "    var t = time * speed;",
        "    var factor = 1.0;",
        "",
        "    if (effectType === 1) {",
        "        // 1: Big (enlarge bounce pulse)",
        "        var pulse = Math.abs(Math.sin(t * Math.PI * 1.8));",
        "        factor = 1.0 + (0.32 * amp * pulse);",
        "    } else if (effectType === 2) {",
        "        // 2: Small (contracted breathing scale)",
        "        var pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.5);",
        "        factor = 1.0 - (0.22 * amp * (0.6 + 0.4 * pulse));",
        "    } else if (effectType === 5) {",
        "        // 5: Explode (burst expansion and decaying shockwave)",
        "        var cycle = 1.6 / speed;",
        "        var phase = (time % cycle) / cycle;",
        "        var offset = 0;",
        "        if (phase < 0.22) {",
        "            offset = Math.sin((phase / 0.22) * Math.PI * 0.5) * (0.55 * amp);",
        "        } else {",
        "            var decay = Math.exp(-(phase - 0.22) * 8);",
        "            offset = Math.cos((phase - 0.22) * Math.PI * 12) * (0.55 * amp) * decay;",
        "        }",
        "        factor = Math.max(0.2, 1.0 + offset);",
        "    } else if (effectType === 6) {",
        "        // 6: Ripple (breathing subtle scale deformation)",
        "        factor = 1.0 + (0.06 * amp * Math.sin(t * 3.2));",
        "    } else if (effectType === 7) {",
        "        // 7: Bloom (radiant expanding pulse)",
        "        var pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.0);",
        "        factor = 1.0 + (0.20 * amp * pulse);",
        "    } else if (effectType === 8) {",
        "        // 8: Jitter (erratic scale fluctuation)",
        "        var jScale = (Math.sin(time * 37 * speed) * 0.08) * amp;",
        "        factor = 1.0 + jScale;",
        "    }",
        "",
        "    return [value[0] * factor, value[1] * factor];",
        "})();"
    ].join("\n");

    var ROT_ANIM_EXPR = [
        "// iOS 18 Animated Text Effect - Rotation Expression",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        try {",
        "            var p3 = effect(name)(1);",
        "            return (p3 && typeof p3.value !== 'undefined') ? p3.value : (p3 !== undefined ? p3 : fallback);",
        "        } catch(e3) {}",
        "        return fallback;",
        "    }",
        "",
        "    var effectType = Math.round(getVal('Animation Effect Type', 0));",
        "    if (effectType === 0) return value;",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        if ((time / fd) < (growFrames + typeFrames)) return value;",
        "    }",
        "",
        "    var speed = Math.max(0.1, getVal('Animation Speed', 100) / 100);",
        "    var amp = Math.max(0, getVal('Animation Intensity', 100) / 100);",
        "    var t = time * speed;",
        "    var rot = 0;",
        "",
        "    if (effectType === 3) {",
        "        // Shake",
        "        rot = Math.sin(time * 20 * speed * Math.PI) * (1.8 * amp);",
        "    } else if (effectType === 4) {",
        "        // Nod",
        "        rot = Math.sin(time * 2.4 * speed * Math.PI * 2) * (3.5 * amp);",
        "    } else if (effectType === 6) {",
        "        // Ripple",
        "        rot = Math.sin(t * 3.2) * (2.5 * amp);",
        "    } else if (effectType === 8) {",
        "        // Jitter",
        "        rot = (Math.sin(time * 47 * speed) * 3.0) * amp;",
        "    }",
        "",
        "    return value + rot;",
        "})();"
    ].join("\n");

    var OPACITY_ANIM_EXPR = [
        "// iOS 18 Animated Text Effect - Opacity Expression",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        try {",
        "            var p3 = effect(name)(1);",
        "            return (p3 && typeof p3.value !== 'undefined') ? p3.value : (p3 !== undefined ? p3 : fallback);",
        "        } catch(e3) {}",
        "        return fallback;",
        "    }",
        "",
        "    var effectType = Math.round(getVal('Animation Effect Type', 0));",
        "    if (effectType === 0) return value;",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        if ((time / fd) < (growFrames + typeFrames)) return value;",
        "    }",
        "",
        "    var speed = Math.max(0.1, getVal('Animation Speed', 100) / 100);",
        "    var amp = Math.max(0, getVal('Animation Intensity', 100) / 100);",
        "    var t = time * speed;",
        "",
        "    if (effectType === 7) {",
        "        // Bloom: radiant glowing pulse",
        "        var pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.0);",
        "        return Math.min(100, Math.max(30, value * (0.65 + 0.35 * pulse)));",
        "    } else if (effectType === 5) {",
        "        // Explode: initial flash at burst",
        "        var cycle = 1.6 / speed;",
        "        var phase = (time % cycle) / cycle;",
        "        if (phase < 0.15) {",
        "            return Math.min(100, value * (0.8 + 0.2 * (phase / 0.15)));",
        "        }",
        "    }",
        "",
        "    return value;",
        "})();"
    ].join("\n");

    // -------------------------------------------------------------------------
    // Automatic Read & Delivery Timing Calculation & Expressions
    // -------------------------------------------------------------------------
    function calculateReadDuration(text) {
        if (!text) return 1.5;
        var trimmed = trimStr(text);
        if (!trimmed) return 1.5;
        var words = trimmed.split(/\s+/).length;
        var chars = trimmed.length;

        // Base reaction / glance delay before recipient begins reading
        var reactionDelay = 0.8;
        // Average human reading speed: ~220 words per minute (approx 0.28s per word)
        var wordTime = words * 0.28;
        // Density bonus for emojis / punctuation / character density
        var densityBonus = Math.max(0, (chars - (words * 4))) * 0.025;

        var total = reactionDelay + wordTime + densityBonus;
        return Math.max(1.5, Math.min(12.0, Math.round(total * 10) / 10));
    }

    var STATUS_TEXT_EXPR = [
        "// Animated Status Icon (Sent -> Delivered -> Read)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        try {",
        "            var p3 = effect(name)(1);",
        "            return (p3 && typeof p3.value !== 'undefined') ? p3.value : (p3 !== undefined ? p3 : fallback);",
        "        } catch(e3) {}",
        "        return fallback;",
        "    }",
        "",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode === 4) return '';",
        "    if (mode === 3) return '✓';",
        "    if (mode === 2) return '✓✓';",
        "    if (mode === 1) return '✓✓';",
        "",
        "    // Auto mode (0): Sent at t=settleTime ('✓'), Delivered at t >= deliveredTime ('✓✓')",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    var settleTime = 0;",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    if (time < deliveredTime) {",
        "        return '✓';",
        "    } else {",
        "        return '✓✓';",
        "    }",
        "})();"
    ].join("\n");

    var STATUS_COLOR_EXPR = [
        "// Animated Status Icon Color (Neutral Gray -> Read Receipt Blue/Cyan)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        try {",
        "            var p3 = effect(name)(1);",
        "            return (p3 && typeof p3.value !== 'undefined') ? p3.value : (p3 !== undefined ? p3 : fallback);",
        "        } catch(e3) {}",
        "        return fallback;",
        "    }",
        "",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    var neutralCol = getVal('Status Neutral Color', [0.55, 0.55, 0.55]);",
        "    var readCol = getVal('Status Read Color', [0.20, 0.72, 0.95]);",
        "",
        "    if (mode === 4 || mode === 3 || mode === 2) return neutralCol;",
        "    if (mode === 1) return readCol;",
        "",
        "    // Auto mode (0): transitions from neutral to readCol at readTime",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    var settleTime = 0;",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    var readTime = settleTime + getVal('Read Time (s)', 4.2);",
        "    if (time < readTime) {",
        "        return neutralCol;",
        "    } else {",
        "        return readCol;",
        "    }",
        "})();"
    ].join("\n");

    var STATUS_SCALE_EXPR = [
        "// Status Icon Micro-interaction Pop on Read",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode !== 0) return value;",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    var settleTime = 0;",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    var readTime = settleTime + getVal('Read Time (s)', 4.2);",
        "    if (time >= readTime && time < (readTime + 0.35)) {",
        "        var dt = time - readTime;",
        "        var pop = Math.sin((dt / 0.35) * Math.PI) * 25;",
        "        return [value[0] + pop, value[1] + pop];",
        "    }",
        "    return value;",
        "})();"
    ].join("\n");

    // -------------------------------------------------------------------------
    // Android RCS Status Icon Expressions (Circle Outline / Solid Filled Checks)
    // -------------------------------------------------------------------------
    var STATUS_TEXT_OPACITY_EXPR = [
        "// Standard Checks Layer Opacity (checks style and entrance)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "",
        "    var style = Math.round(getVal('Status Icon Style', 0));",
        "    if (style !== 1) return 0; // Visible when style === 1 (Standard Checks)",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode === 4) return 0; // None",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn <= 0) return 100;",
        "    var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "    var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(eFps) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "    var totalTime = (growFrames + typeFrames) * fd;",
        "    if (time < totalTime) return 0;",
        "    var dt = time - totalTime;",
        "    var fadeDur = 2.0 * fd;",
        "    return Math.min(100, (dt / fadeDur) * 100);",
        "})();"
    ].join("\n");

    var STATUS_RCS_OPACITY_EXPR = [
        "// RCS Circled Checks Layer Opacity (checks style and entrance)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "",
        "    var style = Math.round(getVal('Status Icon Style', 0));",
        "    if (style !== 0) return 0; // Visible when style === 0 (RCS Circled Checks)",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode === 4) return 0; // None",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn <= 0) return 100;",
        "    var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "    var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(eFps) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "    var totalTime = (growFrames + typeFrames) * fd;",
        "    if (time < totalTime) return 0;",
        "    var dt = time - totalTime;",
        "    var fadeDur = 2.0 * fd;",
        "    return Math.min(100, (dt / fadeDur) * 100);",
        "})();"
    ].join("\n");

    var RCS_CIRCLE1_POS_EXPR = [
        "// Circle 1 Position: centered at [3.0, 0] for Sent (single circle), [-3.0, 0] for Delivered / Read",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    var isSingle = (mode === 3);",
        "    if (mode === 0) {",
        "        var animOn = getVal('Animate Entrance', 1);",
        "        var settleTime = 0;",
        "        if (animOn > 0) {",
        "            var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "            var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "            var fps = 30;",
        "            try { fps = thisComp.frameRate; } catch(eFps) {}",
        "            var fd = 1.0 / fps;",
        "            try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "            settleTime = (growFrames + typeFrames) * fd;",
        "        }",
        "        var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "        isSingle = (time < deliveredTime);",
        "    }",
        "    return isSingle ? [3.0, 0] : [-3.0, 0];",
        "})();"
    ].join("\n");

    var RCS_CIRCLE2_OPACITY_EXPR = [
        "// Circle 2 Opacity: hidden for Sent or None, visible for Delivered / Read",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode === 4 || mode === 3) return 0;",
        "    if (mode === 2 || mode === 1) return 100;",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    var settleTime = 0;",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    return (time >= deliveredTime) ? 100 : 0;",
        "})();"
    ].join("\n");

    var RCS_CIRCLE_FILL_OPACITY_EXPR = [
        "// Circle Fill Opacity: 0 for Sent & Delivered (outline only), 100 for Read (solid filled)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode === 1) return 100;",
        "    if (mode === 4 || mode === 3 || mode === 2) return 0;",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    var settleTime = 0;",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    var readTime = settleTime + getVal('Read Time (s)', 4.2);",
        "    return (time >= readTime) ? 100 : 0;",
        "})();"
    ].join("\n");

    var RCS_CIRCLE_STROKE_OPACITY_EXPR = [
        "// Circle Stroke Opacity: 100 for Sent & Delivered (outline), 0 for Read (filled)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode === 1) return 0;",
        "    if (mode === 4 || mode === 3 || mode === 2) return 100;",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    var settleTime = 0;",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    var readTime = settleTime + getVal('Read Time (s)', 4.2);",
        "    return (time >= readTime) ? 0 : 100;",
        "})();"
    ].join("\n");

    var RCS_CHECK_COLOR_EXPR = [
        "// Checkmark Stroke Color: Neutral color for Sent & Delivered, Inverted Contrast for Read",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "    var neutralCol = getVal('Status Neutral Color', [0.55, 0.55, 0.55]);",
        "    var readCheckCol = getVal('Status Read Check Color', [1, 1, 1]);",
        "    var mode = Math.round(getVal('Status Icon Mode', 0));",
        "    if (mode === 1) return readCheckCol;",
        "    if (mode === 4 || mode === 3 || mode === 2) return neutralCol;",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    var settleTime = 0;",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(0, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(0, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    var readTime = settleTime + getVal('Read Time (s)', 4.2);",
        "    return (time >= readTime) ? readCheckCol : neutralCol;",
        "})();"
    ].join("\n");

    var RCS_CIRCLE_FILL_COLOR_EXPR = [
        "// Circle Fill Color (Read accent / Charcoal / Solid)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "    return getVal('Status Read Color', [0.20, 0.72, 0.95]);",
        "})();"
    ].join("\n");

    var RCS_CIRCLE_STROKE_COLOR_EXPR = [
        "// Circle Stroke Color (Neutral Outline)",
        "(function() {",
        "    function getVal(name, fallback) {",
        "        try {",
        "            if (thisLayer && thisLayer.hasParent) {",
        "                var p = thisLayer.parent.effect(name)(1);",
        "                return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
        "            }",
        "        } catch(e) {}",
        "        try {",
        "            var p2 = thisComp.layer('Bubble_Master_Controller').effect(name)(1);",
        "            return (p2 && typeof p2.value !== 'undefined') ? p2.value : (p2 !== undefined ? p2 : fallback);",
        "        } catch(e2) {}",
        "        return fallback;",
        "    }",
        "    return getVal('Status Neutral Color', [0.55, 0.55, 0.55]);",
        "})();"
    ].join("\n");

    var currentRandomTime = generateRandomTime();
    var dropStatusStyle = null, dropStatus = null, grpStatusInfo = null, lblStatusInfo = null;
    var lastSentStatusIdx = 0; // Memory for sent status when toggling direction

    // -------------------------------------------------------------------------
    // 3. UI Header: Title & Description
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Message Bubble");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    pnlHeader.add("statictext", undefined, "Chat bubble generator for iOS, Android RCS, WhatsApp, Instagram & Messenger.");

    // -------------------------------------------------------------------------
    // 4. Message Text Panel (Max 250 characters, Emoji support)
    // -------------------------------------------------------------------------
    var pnlMessage = win.add("panel", undefined, "Message Content (Emojis Supported)");
    pnlMessage.orientation = "column";
    pnlMessage.alignChildren = ["fill", "top"];
    pnlMessage.spacing = 6;
    pnlMessage.margins = 10;

    var txtMessage = pnlMessage.add("edittext", undefined, "Hey! Are we still meeting for lunch today? 😊🍕", { multiline: true });
    txtMessage.preferredSize = [-1, 52];
    txtMessage.helpTip = "Type your message text here (Max 250 characters). Emojis are supported.";

    // Character Counter Label
    var grpCharCount = pnlMessage.add("group");
    grpCharCount.orientation = "row";
    grpCharCount.alignChildren = ["right", "center"];
    var lblCharCount = grpCharCount.add("statictext", undefined, "0 / " + MAX_CHARS + " chars");
    lblCharCount.preferredSize = [120, -1];

    function updateCharCount() {
        var current = txtMessage.text || "";
        if (current.length > MAX_CHARS) {
            current = current.substring(0, MAX_CHARS);
            txtMessage.text = current;
        }
        lblCharCount.text = current.length + " / " + MAX_CHARS + " chars";
        if (typeof lblStatusInfo !== "undefined" && lblStatusInfo) {
            var dur = calculateReadDuration(current);
            lblStatusInfo.text = "⏱ Auto Read: ~" + (0.8 + dur).toFixed(1) + "s (based on text length)";
        }
    }

    txtMessage.onChanging = function() {
        updateCharCount();
    };
    txtMessage.onChange = function() {
        updateCharCount();
    };

    // -------------------------------------------------------------------------
    // 5. Color Picker Helper Function
    // -------------------------------------------------------------------------
    function createColorPicker(parent, defaultHex, labelText, labelWidth) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.spacing = 8;
        grp.alignChildren = ["left", "center"];

        if (labelText) {
            var lbl = grp.add("statictext", undefined, labelText);
            lbl.preferredSize = [labelWidth || 95, -1];
        }

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [36, 22];
        btnSwatch.helpTip = "Click to pick color (Native / Windows Color Picker)";

        var txtHex = grp.add("edittext", undefined, defaultHex);
        txtHex.preferredSize = [75, 22];
        txtHex.characters = 7;
        txtHex.helpTip = "Direct hex color input (e.g. #2288EE)";

        var picker = {
            group: grp,
            button: btnSwatch,
            edittext: txtHex,
            _color: defaultHex,
            value: defaultHex,
            onChange: null
        };

        btnSwatch.onDraw = function() {
            try {
                var g = this.graphics;
                var rgb = hexToRgb(picker._color);
                var brush = g.newBrush(g.BrushType.SOLID_COLOR, [rgb[0], rgb[1], rgb[2], 1.0]);
                var pen = g.newPen(g.PenType.SOLID_COLOR, [0.7, 0.7, 0.7, 1.0], 1);
                g.newPath();
                g.rectPath(0, 0, this.size ? this.size[0] : 36, this.size ? this.size[1] : 22);
                g.fillPath(brush);
                g.strokePath(pen);
            } catch(e) {}
        };

        function setColor(newHex, triggerChange) {
            if (!newHex) return;
            if (newHex.indexOf("#") !== 0) newHex = "#" + newHex;
            picker._color = newHex;
            picker.value = newHex;
            txtHex.text = newHex.toUpperCase();

            try {
                if (btnSwatch.notify) {
                    btnSwatch.notify("onDraw");
                }
            } catch(e) {}

            if (btnSwatch.domElement) {
                btnSwatch.domElement.style.backgroundColor = newHex;
                btnSwatch.domElement.style.border = "1px solid #777";
                btnSwatch.domElement.style.borderRadius = "3px";
            }

            if (triggerChange && typeof picker.onChange === "function") {
                picker.onChange(newHex);
            }
        }

        btnSwatch.onClick = function() {
            var curHex = picker._color || "#2288EE";
            if (typeof window !== "undefined" && typeof window.openWindowsColorPicker === "function") {
                window.openWindowsColorPicker(curHex, function(selectedHex) {
                    setColor(selectedHex, true);
                });
                return;
            }

            var hexNum = parseInt(curHex.replace("#", ""), 16);
            var result = -1;
            if (typeof $.colorPicker === "function") {
                result = $.colorPicker(hexNum, function(selectedHex) {
                    setColor(selectedHex, true);
                });
            }
            if (result !== -1 && result !== undefined && result !== null) {
                var hexStr = Number(result).toString(16);
                while (hexStr.length < 6) hexStr = "0" + hexStr;
                setColor("#" + hexStr, true);
            }
        };

        txtHex.onChange = function() {
            var val = txtHex.text.replace(/^\s+|\s+$/g, "");
            if (val.indexOf("#") !== 0) val = "#" + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                setColor(val, true);
            } else {
                txtHex.text = picker._color.toUpperCase();
            }
        };

        setColor(defaultHex, false);
        picker.setColor = setColor;
        return picker;
    }

    // -------------------------------------------------------------------------
    // 6. Tabbed Panel Navigation: Message, Appearance & Animation
    // -------------------------------------------------------------------------
    var tpanel = win.add("tabbedpanel", undefined);
    tpanel.alignChildren = ["fill", "top"];
    tpanel.alignment = ["fill", "top"];

    // =========================================================================
    // TAB 1: MESSAGE (Platform & Appearance, Timestamp)
    // =========================================================================
    var tabMessage = tpanel.add("tab", undefined, "Message");
    tabMessage.orientation = "column";
    tabMessage.alignChildren = ["fill", "top"];
    tabMessage.spacing = 8;
    tabMessage.margins = 8;

    // --- Panel: Platform & Appearance ---
    var pnlStyle = tabMessage.add("panel", undefined, "Platform & Appearance");
    pnlStyle.orientation = "column";
    pnlStyle.alignChildren = ["fill", "top"];
    pnlStyle.spacing = 8;
    pnlStyle.margins = 10;

    // Platform Pull Down (Dropdown) & Preset Actions
    var grpPlatform = pnlStyle.add("group");
    grpPlatform.orientation = "row";
    grpPlatform.alignChildren = ["left", "center"];
    var lblPlatform = grpPlatform.add("statictext", undefined, "Style Preset:");
    lblPlatform.preferredSize = [115, -1];

    var dropPlatform = grpPlatform.add("dropdownlist", undefined, []);
    dropPlatform.preferredSize = [155, 26];

    var btnReloadPresets = grpPlatform.add("button", undefined, "↻");
    btnReloadPresets.preferredSize = [26, 26];
    btnReloadPresets.helpTip = "Reload presets from JSON file in 'message bubble presets' folder.";

    var btnOpenPresets = grpPlatform.add("button", undefined, "📂");
    btnOpenPresets.preferredSize = [26, 26];
    btnOpenPresets.helpTip = "Open 'message bubble presets' folder in File Explorer / Finder.";

    function populatePlatformDropdown(selectedKey) {
        updatePlatformKeys();
        if (typeof dropPlatform.removeAll === "function") {
            dropPlatform.removeAll();
        } else {
            dropPlatform.items = [];
            if (dropPlatform.domElement) dropPlatform.domElement.innerHTML = "";
        }
        var selectIndex = 0;
        for (var i = 0; i < platformKeys.length; i++) {
            var key = platformKeys[i];
            var cfg = PLATFORMS[key] || DEFAULT_PLATFORMS[key];
            var label = (cfg && cfg.label) ? cfg.label : (key + " style");
            dropPlatform.add("item", label);
            if (selectedKey && key === selectedKey) {
                selectIndex = i;
            } else if (!selectedKey && key === "iOS Message") {
                selectIndex = i;
            }
        }
        if (dropPlatform.items.length > 0) {
            dropPlatform.selection = selectIndex;
        }
    }

    populatePlatformDropdown("iOS Message");

    btnReloadPresets.onClick = function() {
        var curKey = (dropPlatform.selection && platformKeys[dropPlatform.selection.index])
            ? platformKeys[dropPlatform.selection.index]
            : "iOS Message";
        var c = loadPresetsFromFile();
        populatePlatformDropdown(curKey);
        syncColorsFromPlatform();
        if (c > 0 && currentPresetsFile) {
            alert("Reloaded " + c + " presets from:\n" + currentPresetsFile.fsName);
        } else {
            alert("Presets reloaded from defaults.");
        }
    };

    btnOpenPresets.onClick = function() {
        if (!currentPresetsFolder) currentPresetsFolder = getPresetsFolder();
        if (currentPresetsFolder && currentPresetsFolder.exists) {
            currentPresetsFolder.execute();
        } else {
            alert("Presets folder:\n" + (currentPresetsFolder ? currentPresetsFolder.fsName : PRESETS_FOLDER_NAME));
        }
    };

    // Direction Switch: Received (Left) vs Sent (Right)
    var grpDirection = pnlStyle.add("group");
    grpDirection.orientation = "row";
    grpDirection.alignChildren = ["left", "center"];
    var lblDirection = grpDirection.add("statictext", undefined, "Message Type:");
    lblDirection.preferredSize = [115, -1];

    var radSent = grpDirection.add("radiobutton", undefined, "Sent (Right)");
    var radReceived = grpDirection.add("radiobutton", undefined, "Received (Left)");
    radSent.value = true; // Default: Sent

    // Theme Switch: Light vs Dark Theme
    var grpTheme = pnlStyle.add("group");
    grpTheme.orientation = "row";
    grpTheme.alignChildren = ["left", "center"];
    var lblTheme = grpTheme.add("statictext", undefined, "Color Theme:");
    lblTheme.preferredSize = [115, -1];

    var radLight = grpTheme.add("radiobutton", undefined, "Light Theme");
    var radDark = grpTheme.add("radiobutton", undefined, "Dark Theme");
    radLight.value = true; // Default: Light Theme

    // Tail / Pointer Switch
    var grpTail = pnlStyle.add("group");
    grpTail.orientation = "row";
    grpTail.alignChildren = ["left", "center"];
    var lblTail = grpTail.add("statictext", undefined, "Bubble Tail:");
    lblTail.preferredSize = [115, -1];

    var chkTail = grpTail.add("checkbox", undefined, "Show Tail / Pointer");
    chkTail.value = true; // Default: Show Tail
    chkTail.helpTip = "Toggle the chat pointer / tail at the bottom corner of the message bubble.";

    // --- Panel: Timestamp (Randomized) ---
    var pnlTime = tabMessage.add("panel", undefined, "Timestamp (Randomized)");
    pnlTime.orientation = "row";
    pnlTime.alignChildren = ["fill", "center"];
    pnlTime.spacing = 8;
    pnlTime.margins = [10, 8, 10, 8];

    var lblTimeVal = pnlTime.add("statictext", undefined, "Time: " + currentRandomTime);
    lblTimeVal.alignment = ["fill", "center"];
    lblTimeVal.helpTip = "Timestamps are randomized for now. A dedicated custom time dialog will be added in a future update.";

    var btnRerollTime = pnlTime.add("button", undefined, "🎲 Re-roll Time");
    btnRerollTime.preferredSize = [135, 26];
    btnRerollTime.onClick = function() {
        currentRandomTime = generateRandomTime();
        lblTimeVal.text = "Time: " + currentRandomTime;
    };

    // =========================================================================
    // TAB 2: APPEARANCE (Layout & Typography, Colors & Appearance, Status Icon)
    // =========================================================================
    var tabAppearance = tpanel.add("tab", undefined, "Appearance");
    tabAppearance.orientation = "column";
    tabAppearance.alignChildren = ["fill", "top"];
    tabAppearance.spacing = 8;
    tabAppearance.margins = 8;

    // --- Panel: Layout & Typography ---
    var pnlDim = tabAppearance.add("panel", undefined, "Layout & Typography");
    pnlDim.orientation = "column";
    pnlDim.alignChildren = ["fill", "top"];
    pnlDim.spacing = 8;
    pnlDim.margins = 10;

    // Font Family Row
    var grpFont = pnlDim.add("group");
    grpFont.orientation = "row";
    grpFont.alignChildren = ["left", "center"];
    var lblFont = grpFont.add("statictext", undefined, "Font Family:");
    lblFont.preferredSize = [115, -1];

    var fontOptions = [
        "SF Pro (Apple / iOS)",
        "Roboto (Google / Android)",
        "Segoe UI (Windows)",
        "Helvetica Neue",
        "Arial",
        "Inter",
        "Open Sans",
        "System Default"
    ];
    var dropFont = grpFont.add("dropdownlist", undefined, fontOptions);
    dropFont.selection = 0; // Default: SF Pro
    dropFont.preferredSize = [185, 26];
    dropFont.helpTip = "Select font family commonly used across mobile messaging platforms.";

    // Screen Width Row (Determines where text line splits)
    var grpWidth = pnlDim.add("group");
    grpWidth.orientation = "row";
    grpWidth.alignChildren = ["left", "center"];
    var lblWidth = grpWidth.add("statictext", undefined, "Screen Width (px):");
    lblWidth.preferredSize = [115, -1];
    var sldWidth = grpWidth.add("slider", undefined, 420, 300, 1920);
    sldWidth.alignment = ["fill", "center"];
    var txtWidth = grpWidth.add("edittext", undefined, "420");
    txtWidth.characters = 5;
    txtWidth.helpTip = "Mobile screen width in pixels. Text wraps so the bubble does not exceed 72% of this width.";

    sldWidth.onChanging = function() {
        txtWidth.text = String(Math.round(sldWidth.value));
    };
    txtWidth.onChange = function() {
        var v = Math.max(200, Math.min(3840, parseFloat(txtWidth.text) || 420));
        sldWidth.value = v;
        txtWidth.text = String(Math.round(v));
    };

    // Text Size Row
    var grpSize = pnlDim.add("group");
    grpSize.orientation = "row";
    grpSize.alignChildren = ["left", "center"];
    var lblSize = grpSize.add("statictext", undefined, "Text Size (px):");
    lblSize.preferredSize = [115, -1];
    var sldSize = grpSize.add("slider", undefined, 20, 12, 60);
    sldSize.alignment = ["fill", "center"];
    var txtSize = grpSize.add("edittext", undefined, "20");
    txtSize.characters = 3;

    sldSize.onChanging = function() {
        txtSize.text = String(Math.round(sldSize.value));
    };
    txtSize.onChange = function() {
        var v = Math.max(8, Math.min(120, parseFloat(txtSize.text) || 20));
        sldSize.value = v;
        txtSize.text = String(Math.round(v));
    };

    // Inner Padding Row (-10px to +10px)
    var grpPad = pnlDim.add("group");
    grpPad.orientation = "row";
    grpPad.alignChildren = ["left", "center"];
    var lblPad = grpPad.add("statictext", undefined, "Inner Padding (px):");
    lblPad.preferredSize = [115, -1];
    var sldPad = grpPad.add("slider", undefined, 0, -10, 10);
    sldPad.alignment = ["fill", "center"];
    var txtPad = grpPad.add("edittext", undefined, "0");
    txtPad.characters = 3;
    txtPad.helpTip = "Adjust bubble inner padding from -10px (tight) to +10px (spacious).";

    sldPad.onChanging = function() {
        txtPad.text = String(Math.round(sldPad.value));
    };
    txtPad.onChange = function() {
        var v = Math.max(-10, Math.min(10, parseFloat(txtPad.text) || 0));
        sldPad.value = v;
        txtPad.text = String(Math.round(v));
    };

    // Leading / Line Height Row (50% to 150%)
    var grpLeading = pnlDim.add("group");
    grpLeading.orientation = "row";
    grpLeading.alignChildren = ["left", "center"];
    var lblLeading = grpLeading.add("statictext", undefined, "Leading (%):");
    lblLeading.preferredSize = [115, -1];
    var sldLeading = grpLeading.add("slider", undefined, 100, 50, 150);
    sldLeading.alignment = ["fill", "center"];
    var txtLeading = grpLeading.add("edittext", undefined, "100");
    txtLeading.characters = 4;
    txtLeading.helpTip = "Text line height / leading in percentage from 50% (compact) to 150% (relaxed).";

    sldLeading.onChanging = function() {
        txtLeading.text = String(Math.round(sldLeading.value));
    };
    txtLeading.onChange = function() {
        var v = Math.max(50, Math.min(150, parseFloat(txtLeading.text) || 100));
        sldLeading.value = v;
        txtLeading.text = String(Math.round(v));
    };

    // --- Panel: Colors & Appearance ---
    var pnlColors = tabAppearance.add("panel", undefined, "Colors & Appearance");
    pnlColors.orientation = "column";
    pnlColors.alignChildren = ["fill", "top"];
    pnlColors.spacing = 8;
    pnlColors.margins = 10;

    var cpBubble = createColorPicker(pnlColors, "#007AFF", "Bubble Color:", 115);
    var cpText = createColorPicker(pnlColors, "#FFFFFF", "Text Color:", 115);

    // --- Panel: Status & Delivery Receipts ---
    var pnlStatus = tabAppearance.add("panel", undefined, "Status & Delivery Receipts");
    pnlStatus.orientation = "column";
    pnlStatus.alignChildren = ["fill", "top"];
    pnlStatus.spacing = 6;
    pnlStatus.margins = [10, 8, 10, 8];

    // Status Icon Style (RCS Circled Checks vs Standard Checks)
    var grpStatusStyle = pnlStatus.add("group");
    grpStatusStyle.orientation = "row";
    grpStatusStyle.alignChildren = ["left", "center"];
    var lblStatusStyle = grpStatusStyle.add("statictext", undefined, "Icon Style:");
    lblStatusStyle.preferredSize = [115, -1];

    dropStatusStyle = grpStatusStyle.add("dropdownlist", undefined, [
        "RCS Circled Checks (○✓)",
        "Standard Checks (✓✓)"
    ]);
    dropStatusStyle.selection = 0; // Default: RCS Circled Checks
    dropStatusStyle.preferredSize = [185, 26];
    dropStatusStyle.helpTip = "Choose between Google Messages / Android RCS circled checkmarks (outline/filled) or standard checks.";

    // Status Icon (Sent / Received / Read / Auto Timing)
    var grpStatus = pnlStatus.add("group");
    grpStatus.orientation = "row";
    grpStatus.alignChildren = ["left", "center"];
    var lblStatus = grpStatus.add("statictext", undefined, "Status Icon:");
    lblStatus.preferredSize = [115, -1];

    dropStatus = grpStatus.add("dropdownlist", undefined, [
        "Auto (Timing Simulation)",
        "Read",
        "Delivered",
        "Sent",
        "None"
    ]);
    dropStatus.selection = 0; // Default: Auto (Timing Simulation)
    dropStatus.preferredSize = [185, 26];
    dropStatus.helpTip = "Auto: simulates sent -> delivered -> read timing based on text reading speed. Or choose static status.";

    grpStatusInfo = pnlStatus.add("group");
    grpStatusInfo.orientation = "row";
    grpStatusInfo.alignChildren = ["left", "center"];
    var lblStatusInfoPad = grpStatusInfo.add("statictext", undefined, "");
    lblStatusInfoPad.preferredSize = [115, -1];
    lblStatusInfo = grpStatusInfo.add("statictext", undefined, "⏱ Auto Read: ~4.2s (based on text length)");
    lblStatusInfo.helpTip = "Calculated reading duration based on character and word count.";

    dropStatus.onChange = function() {
        var isAuto = (dropStatus.selection && dropStatus.selection.index === 0);
        grpStatusInfo.visible = isAuto;
        if (radSent.value && dropStatus.selection) {
            lastSentStatusIdx = dropStatus.selection.index;
        }
    };

    updateCharCount(); // Initialize auto-read timing text

    // =========================================================================
    // TAB 3: ANIMATION (Text Effects & Animation)
    // =========================================================================
    var tabAnimation = tpanel.add("tab", undefined, "Animation");
    tabAnimation.orientation = "column";
    tabAnimation.alignChildren = ["fill", "top"];
    tabAnimation.spacing = 8;
    tabAnimation.margins = 8;

    // --- Panel: Text Effects & Animation ---
    var pnlAnim = tabAnimation.add("panel", undefined, "Text Effects & Animation (iOS 18)");
    pnlAnim.orientation = "column";
    pnlAnim.alignChildren = ["fill", "top"];
    pnlAnim.spacing = 6;
    pnlAnim.margins = [10, 8, 10, 8];

    // Effect Preset Dropdown Row
    var grpAnimDrop = pnlAnim.add("group");
    grpAnimDrop.orientation = "row";
    grpAnimDrop.alignChildren = ["left", "center"];
    var lblAnim = grpAnimDrop.add("statictext", undefined, "Animated Effect:");
    lblAnim.preferredSize = [115, -1];

    var animOptions = [
        "None (Static)",
        "Big (Enlarge Pulse)",
        "Small (Contract Scale)",
        "Shake (Horizontal Wobble)",
        "Nod (Vertical Bobbing)",
        "Explode (Burst & Decay)",
        "Ripple (Wave Float)",
        "Bloom (Radiant Glow)",
        "Jitter (Chaotic Glitch)"
    ];
    var dropAnim = grpAnimDrop.add("dropdownlist", undefined, animOptions);
    dropAnim.selection = 0; // Default: None
    dropAnim.preferredSize = [185, 26];
    dropAnim.helpTip = "Select iOS 18 animated text effect.";

    // 8 iOS 18 Effect Preset Buttons (2 rows of 4 buttons)
    var grpBtnRow1 = pnlAnim.add("group");
    grpBtnRow1.orientation = "row";
    grpBtnRow1.spacing = 4;
    grpBtnRow1.alignChildren = ["fill", "center"];

    var btnBig     = grpBtnRow1.add("button", undefined, "Big");
    var btnSmall   = grpBtnRow1.add("button", undefined, "Small");
    var btnShake   = grpBtnRow1.add("button", undefined, "Shake");
    var btnNod     = grpBtnRow1.add("button", undefined, "Nod");
    btnBig.preferredSize   = [68, 24];
    btnSmall.preferredSize = [68, 24];
    btnShake.preferredSize = [68, 24];
    btnNod.preferredSize   = [68, 24];

    var grpBtnRow2 = pnlAnim.add("group");
    grpBtnRow2.orientation = "row";
    grpBtnRow2.spacing = 4;
    grpBtnRow2.alignChildren = ["fill", "center"];

    var btnExplode = grpBtnRow2.add("button", undefined, "Explode");
    var btnRipple  = grpBtnRow2.add("button", undefined, "Ripple");
    var btnBloom   = grpBtnRow2.add("button", undefined, "Bloom");
    var btnJitter  = grpBtnRow2.add("button", undefined, "Jitter");
    btnExplode.preferredSize = [68, 24];
    btnRipple.preferredSize  = [68, 24];
    btnBloom.preferredSize   = [68, 24];
    btnJitter.preferredSize  = [68, 24];

    var effectButtons = [
        { btn: btnBig,     index: 1 },
        { btn: btnSmall,   index: 2 },
        { btn: btnShake,   index: 3 },
        { btn: btnNod,     index: 4 },
        { btn: btnExplode, index: 5 },
        { btn: btnRipple,  index: 6 },
        { btn: btnBloom,   index: 7 },
        { btn: btnJitter,  index: 8 }
    ];

    function updateButtonHighlights(currentIdx) {
        for (var b = 0; b < effectButtons.length; b++) {
            var item = effectButtons[b];
            var isSelected = (item.index === currentIdx);
            if (item.btn.domElement) {
                if (isSelected) {
                    item.btn.domElement.style.backgroundColor = "#007aff";
                    item.btn.domElement.style.color = "#ffffff";
                    item.btn.domElement.style.borderColor = "#005bb5";
                    item.btn.domElement.style.fontWeight = "bold";
                } else {
                    item.btn.domElement.style.backgroundColor = "";
                    item.btn.domElement.style.color = "";
                    item.btn.domElement.style.borderColor = "";
                    item.btn.domElement.style.fontWeight = "normal";
                }
            }
        }
    }

    function selectEffect(idx) {
        dropAnim.selection = idx;
        updateButtonHighlights(idx);
    }

    for (var b = 0; b < effectButtons.length; b++) {
        (function(item) {
            item.btn.onClick = function() {
                var cur = dropAnim.selection ? dropAnim.selection.index : 0;
                if (cur === item.index) {
                    selectEffect(0); // Toggle off to None
                } else {
                    selectEffect(item.index);
                }
            };
        })(effectButtons[b]);
    }

    dropAnim.onChange = function() {
        var cur = dropAnim.selection ? dropAnim.selection.index : 0;
        updateButtonHighlights(cur);
    };

    // Animation Speed Row (50% to 200%)
    var grpSpeed = pnlAnim.add("group");
    grpSpeed.orientation = "row";
    grpSpeed.alignChildren = ["left", "center"];
    var lblSpeed = grpSpeed.add("statictext", undefined, "Anim Speed (%):");
    lblSpeed.preferredSize = [115, -1];
    var sldSpeed = grpSpeed.add("slider", undefined, 100, 50, 200);
    sldSpeed.alignment = ["fill", "center"];
    var txtSpeed = grpSpeed.add("edittext", undefined, "100");
    txtSpeed.characters = 4;
    txtSpeed.helpTip = "Animation speed / frequency multiplier from 50% (slow) to 200% (fast).";

    sldSpeed.onChanging = function() {
        txtSpeed.text = String(Math.round(sldSpeed.value));
    };
    txtSpeed.onChange = function() {
        var v = Math.max(20, Math.min(300, parseFloat(txtSpeed.text) || 100));
        sldSpeed.value = v;
        txtSpeed.text = String(Math.round(v));
    };

    // Animation Intensity Row (20% to 200%)
    var grpAmp = pnlAnim.add("group");
    grpAmp.orientation = "row";
    grpAmp.alignChildren = ["left", "center"];
    var lblAmp = grpAmp.add("statictext", undefined, "Intensity (%):");
    lblAmp.preferredSize = [115, -1];
    var sldAmp = grpAmp.add("slider", undefined, 100, 20, 200);
    sldAmp.alignment = ["fill", "center"];
    var txtAmp = grpAmp.add("edittext", undefined, "100");
    txtAmp.characters = 4;
    txtAmp.helpTip = "Animation displacement and vibration amplitude.";

    sldAmp.onChanging = function() {
        txtAmp.text = String(Math.round(sldAmp.value));
    };
    txtAmp.onChange = function() {
        var v = Math.max(10, Math.min(300, parseFloat(txtAmp.text) || 100));
        sldAmp.value = v;
        txtAmp.text = String(Math.round(v));
    };

    // Entrance Animation Controls
    var grpEntrance = pnlAnim.add("group");
    grpEntrance.orientation = "row";
    grpEntrance.alignChildren = ["left", "center"];
    var chkEntrance = grpEntrance.add("checkbox", undefined, "Entrance Animation (Grow + Typewriter)");
    chkEntrance.value = true; // Default: Enabled
    chkEntrance.helpTip = "Animate the bubble growing from left/right, followed by a typewriter text reveal.";

    // Bubble Grow Duration Row (0 to 20 frames)
    var grpGrow = pnlAnim.add("group");
    grpGrow.orientation = "row";
    grpGrow.alignChildren = ["left", "center"];
    var lblGrow = grpGrow.add("statictext", undefined, "Bubble Grow (frames):");
    lblGrow.preferredSize = [125, -1];
    var sldGrow = grpGrow.add("slider", undefined, 5, 0, 20);
    sldGrow.alignment = ["fill", "center"];
    var txtGrow = grpGrow.add("edittext", undefined, "5");
    txtGrow.characters = 3;
    txtGrow.helpTip = "Duration of the bubble growth animation in frames (0 to 20).";

    sldGrow.onChanging = function() {
        txtGrow.text = String(Math.round(sldGrow.value));
    };
    sldGrow.onChange = function() {
        txtGrow.text = String(Math.round(sldGrow.value));
    };
    txtGrow.onChange = function() {
        var v = Math.max(0, Math.min(20, parseInt(txtGrow.text, 10) || 0));
        sldGrow.value = v;
        txtGrow.text = String(Math.round(v));
    };

    // Typewriter Duration Row (0 to 20 frames)
    var grpType = pnlAnim.add("group");
    grpType.orientation = "row";
    grpType.alignChildren = ["left", "center"];
    var lblType = grpType.add("statictext", undefined, "Typewriter (frames):");
    lblType.preferredSize = [125, -1];
    var sldType = grpType.add("slider", undefined, 5, 0, 20);
    sldType.alignment = ["fill", "center"];
    var txtType = grpType.add("edittext", undefined, "5");
    txtType.characters = 3;
    txtType.helpTip = "Duration of the typewriter text reveal in frames (0 to 20).";

    sldType.onChanging = function() {
        txtType.text = String(Math.round(sldType.value));
    };
    sldType.onChange = function() {
        txtType.text = String(Math.round(sldType.value));
    };
    txtType.onChange = function() {
        var v = Math.max(0, Math.min(20, parseInt(txtType.text, 10) || 0));
        sldType.value = v;
        txtType.text = String(Math.round(v));
    };

    chkEntrance.onClick = function() {
        var en = chkEntrance.value;
        sldGrow.enabled = en;
        txtGrow.enabled = en;
        sldType.enabled = en;
        txtType.enabled = en;
    };

    tpanel.selection = tabMessage; // Default to Message tab

    function syncColorsFromPlatform() {
        var selIdx = dropPlatform.selection ? dropPlatform.selection.index : 0;
        var platformName = platformKeys[selIdx] || "iOS Message";
        if (platformName === "Custom") return;

        var isSent = radSent.value;
        var isDark = radDark.value;
        var themeKey = isDark ? "dark" : "light";
        var dirKey = isSent ? "sent" : "received";
        var platformCfg = PLATFORMS[platformName] || DEFAULT_PLATFORMS[platformName];
        if (!platformCfg) return;

        var colorSet = (platformCfg[themeKey] && platformCfg[themeKey][dirKey]) ? platformCfg[themeKey][dirKey] : null;

        if (colorSet) {
            if (colorSet.bubble) cpBubble.setColor(colorSet.bubble, false);
            if (colorSet.text) cpText.setColor(colorSet.text, false);
        }

        if (typeof dropFont !== "undefined" && dropFont) {
            if (typeof platformCfg.fontIndex === "number" && platformCfg.fontIndex < FONTS.length) {
                dropFont.selection = platformCfg.fontIndex;
            } else if (platformCfg.font) {
                for (var fi = 0; fi < FONTS.length; fi++) {
                    if (FONTS[fi].name.toLowerCase().indexOf(platformCfg.font.toLowerCase()) !== -1 ||
                        platformCfg.font.toLowerCase().indexOf(FONTS[fi].name.toLowerCase()) !== -1) {
                        dropFont.selection = fi;
                        break;
                    }
                }
            } else {
                if (platformName === "Android RCS") dropFont.selection = 1; // Roboto
                else if (platformName === "iOS Message" || platformName === "Instagram") dropFont.selection = 0; // SF Pro
                else if (platformName === "WhatsApp") dropFont.selection = 3; // Helvetica Neue
                else if (platformName === "Facebook Messenger") dropFont.selection = 2; // Segoe UI
            }
        }

        if (typeof dropStatusStyle !== "undefined" && dropStatusStyle) {
            if (typeof platformCfg.statusStyleIndex === "number") {
                dropStatusStyle.selection = platformCfg.statusStyleIndex;
            } else if (platformCfg.statusStyle === "rcs" || platformName === "Android RCS") {
                dropStatusStyle.selection = 0; // RCS Circled Checks (○✓)
            } else {
                dropStatusStyle.selection = 1; // Standard Checks (✓✓)
            }
        }
    }

    dropPlatform.onChange = function() {
        syncColorsFromPlatform();
    };
    radSent.onClick = function() {
        if (typeof dropStatus !== "undefined" && dropStatus) {
            dropStatus.selection = (lastSentStatusIdx === 4) ? 0 : lastSentStatusIdx;
            if (dropStatus.onChange) dropStatus.onChange();
        }
        syncColorsFromPlatform();
    };
    radReceived.onClick = function() {
        if (typeof dropStatus !== "undefined" && dropStatus) {
            dropStatus.selection = 4; // Set to "None" by default for Received messages
            if (dropStatus.onChange) dropStatus.onChange();
        }
        syncColorsFromPlatform();
    };
    radLight.onClick = function() {
        syncColorsFromPlatform();
    };
    radDark.onClick = function() {
        syncColorsFromPlatform();
    };

    function selectCustomPlatformStyle() {
        for (var i = 0; i < platformKeys.length; i++) {
            if (platformKeys[i] === "Custom") {
                dropPlatform.selection = i;
                break;
            }
        }
    }
    cpBubble.onChange = function() {
        selectCustomPlatformStyle();
    };
    cpText.onChange = function() {
        selectCustomPlatformStyle();
    };

    // -------------------------------------------------------------------------
    // 9. Word-Wrapping Engine: Splits text into lines based on screen width
    // -------------------------------------------------------------------------
    function wrapTextToLines(rawText, maxPixelWidth, fontSize) {
        if (!rawText) return [""];
        // Clean multi-spaces & break into words
        var words = rawText.replace(/\r\n/g, "\n").split(/(\s+)/);
        var lines = [];
        var currentLine = "";

        // Average character widths based on typography
        function measureStr(str) {
            var w = 0;
            for (var i = 0; i < str.length; i++) {
                var code = str.charCodeAt(i);
                // Unicode emojis / surrogate pairs / wide glyphs
                if (code > 255 || (code >= 0xD800 && code <= 0xDBFF)) {
                    w += fontSize * 1.1;
                } else if ("ijl|!.,:;'I".indexOf(str.charAt(i)) !== -1) {
                    w += fontSize * 0.28;
                } else if ("wmWM@#%&".indexOf(str.charAt(i)) !== -1) {
                    w += fontSize * 0.78;
                } else {
                    w += fontSize * 0.52;
                }
            }
            return w;
        }

        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (word === "\n") {
                lines.push(currentLine);
                currentLine = "";
                continue;
            }
            var testLine = currentLine + word;
            if (measureStr(testLine) > maxPixelWidth && trimStr(currentLine).length > 0) {
                lines.push(trimStr(currentLine));
                currentLine = trimLeftStr(word);
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine.length > 0) {
            lines.push(trimStr(currentLine));
        }

        return lines.length > 0 ? lines : [""];
    }

    // Measure maximum line pixel width
    function getLinesPixelBounds(lines, fontSize) {
        var maxW = 0;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var w = 0;
            for (var c = 0; c < line.length; c++) {
                var code = line.charCodeAt(c);
                if (code > 255 || (code >= 0xD800 && code <= 0xDBFF)) {
                    w += fontSize * 1.1;
                } else if ("ijl|!.,:;'I".indexOf(line.charAt(c)) !== -1) {
                    w += fontSize * 0.28;
                } else if ("wmWM@#%&".indexOf(line.charAt(c)) !== -1) {
                    w += fontSize * 0.78;
                } else {
                    w += fontSize * 0.52;
                }
            }
            if (w > maxW) maxW = w;
        }
        return Math.max(30, maxW);
    }

    // -------------------------------------------------------------------------
    // 10. Core Generation Engine: Build Message Bubble in Active Comp
    // -------------------------------------------------------------------------
    function buildMessageBubble() {
        var comp = app.project ? app.project.activeItem : null;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please open or select an active composition first.");
            return;
        }

        if (app.beginUndoGroup) {
            app.beginUndoGroup("Create Message Bubble");
        }

        try {
            var msgText = txtMessage.text || "Hello! 👋";
            if (msgText.length > MAX_CHARS) {
                msgText = msgText.substring(0, MAX_CHARS);
            }

            var selStyleIdx = dropPlatform.selection ? dropPlatform.selection.index : 0;
            var platformName = platformKeys[selStyleIdx] || "iOS Message";
            var platformCfg = PLATFORMS[platformName] || DEFAULT_PLATFORMS[platformName] || DEFAULT_PLATFORMS["iOS Message"];

            var isSent = radSent.value;
            var isDark = radDark.value;
            var themeKey = isDark ? "dark" : "light";
            var dirKey = isSent ? "sent" : "received";
            var colorSet = platformCfg[themeKey][dirKey];

            var bubbleColor = hexToRgb(cpBubble.value);
            var textColor = hexToRgb(cpText.value);
            var timeColor = hexToRgb(colorSet ? colorSet.time : "#888888");

            var screenW = parseFloat(txtWidth.text) || 420;
            var textSize = parseFloat(txtSize.text) || 20;

            var padOffset = parseFloat(txtPad.text) || 0;
            var leadingPercent = parseFloat(txtLeading.text) || 100;
            var leadingFactor = leadingPercent / 100;

            var selAnimIdx = dropAnim.selection ? dropAnim.selection.index : 0;
            var animSpeed = parseFloat(txtSpeed.text) || 100;
            var animAmp = parseFloat(txtAmp.text) || 100;
            var growFVal = (typeof sldGrow !== "undefined" && sldGrow) ? Math.max(0, Math.min(20, Math.round(sldGrow.value))) : 5;
            var typeFVal = (typeof sldType !== "undefined" && sldType) ? Math.max(0, Math.min(20, Math.round(sldType.value))) : 5;

            var fontIdx = dropFont.selection ? dropFont.selection.index : 0;
            var selectedFont = FONTS[fontIdx] || FONTS[0];

            // Chat messaging UX: Max bubble width is 72% of screen width
            var maxBubbleW = Math.max(120, screenW * 0.72);
            var padX = Math.max(4, Math.round(textSize * 0.75) + padOffset);
            var padY = Math.max(4, Math.round(textSize * 0.55) + padOffset);
            var maxTextW = maxBubbleW - (padX * 2);

            // Perform automatic word-wrapping
            var lines = wrapTextToLines(msgText, maxTextW, textSize);
            var wrappedString = lines.join("\n");
            var measuredTextW = getLinesPixelBounds(lines, textSize);

            var lineH = Math.round(textSize * 1.35 * leadingFactor);
            var textBlockH = lines.length * lineH;

            // Status Icon & Timestamp formatting (Auto, Read, Delivered, Sent, None)
            var selStatusIdx = dropStatus.selection ? dropStatus.selection.index : 0;
            var isAutoStatus = (selStatusIdx === 0);
            var selStatusStyleIdx = (typeof dropStatusStyle !== "undefined" && dropStatusStyle && dropStatusStyle.selection)
                ? dropStatusStyle.selection.index
                : (platformName === "Android RCS" ? 0 : 1);
            var isRCSStyle = (selStatusStyleIdx === 0);

            var deliveredTime = 0.8;
            var readDuration = calculateReadDuration(msgText);
            var readTime = Math.round((deliveredTime + readDuration) * 10) / 10;

            // Determine Read Receipt Colors (RCS filled circles vs standard checkmarks)
            var isDarkBubble = (bubbleColor[0] * 0.299 + bubbleColor[1] * 0.587 + bubbleColor[2] * 0.114) < 0.55;
            var rcsReadCircleCol = isDarkBubble ? [1.0, 1.0, 1.0] : [0.18, 0.19, 0.21];
            var rcsReadCheckCol = isDarkBubble ? bubbleColor : [1.0, 1.0, 1.0];
            var standardReadColor = isDark ? [0.33, 0.74, 0.92] : [0.20, 0.72, 0.95];
            var readColor = isRCSStyle ? rcsReadCircleCol : standardReadColor;
            var statusColor = timeColor;

            var statusString = "";
            if (isSent && selStatusIdx !== 4) {
                if (selStatusIdx === 0 || selStatusIdx === 1 || selStatusIdx === 2) {
                    statusString = "✓✓";
                } else if (selStatusIdx === 3) {
                    statusString = "✓";
                }
            }

            var timeString = currentRandomTime;
            var timeFontSize = Math.max(10, Math.round(textSize * 0.58));
            var timeW = Math.round(timeString.length * timeFontSize * 0.55);
            var statusW = (isSent && selStatusIdx !== 4)
                ? (isRCSStyle ? Math.round(timeFontSize * 1.55) : Math.round(timeFontSize * 1.35))
                : 0;
            var statusSpacing = statusW > 0 ? 6 : 0;
            var timeRowW = timeW + statusSpacing + statusW;

            // Bubble bounding dimensions
            var singleLine = (lines.length === 1);
            var bubbleW = 0;
            var bubbleH = 0;

            // Headroom expansion for scaling effects (Big, Explode)
            var scalePadFactor = (selAnimIdx === 1) ? 1.24 : ((selAnimIdx === 5) ? 1.30 : 1.0);
            var effMeasuredW = Math.round(measuredTextW * scalePadFactor);
            var effTextH = Math.round(textBlockH * scalePadFactor);

            if (singleLine && (effMeasuredW + timeRowW + padX * 2 + 16 < maxBubbleW)) {
                // Inline single line message + timestamp + status icon
                bubbleW = effMeasuredW + timeRowW + (padX * 2) + 16;
                bubbleH = effTextH + (padY * 2);
            } else {
                // Multiline message + bottom timestamp row
                bubbleW = Math.max(effMeasuredW, timeRowW) + (padX * 2);
                bubbleH = effTextH + (padY * 2) + timeFontSize + 6;
            }

            var hasTail = chkTail.value;
            var cornerRadius = platformCfg.radius || 18;

            // Corner radii based on direction and tail setting (Custom Rounded Rect engine)
            var rTL = cornerRadius;
            var rTR = cornerRadius;
            var rBR = cornerRadius;
            var rBL = cornerRadius;

            if (hasTail) {
                if (isSent) {
                    rBR = 4; // Tucked corner for sent tail
                } else {
                    rBL = 4; // Tucked corner for received tail
                }
            }

            var compCenter = [comp.width / 2, comp.height / 2, 0];

            // Horizontal alignment within screen:
            // Sent: Right-anchored; Received: Left-anchored
            var screenMargin = Math.round(screenW * 0.04);
            var halfScreenW = screenW / 2;
            var posX = isSent
                ? (compCenter[0] + halfScreenW - screenMargin - (bubbleW / 2))
                : (compCenter[0] - halfScreenW + screenMargin + (bubbleW / 2));
            var posY = compCenter[1];

            // 1. Master Controller Layer
            var master = comp.layers.addShape ? comp.layers.addShape() : comp.layers.addNull();
            master.name = "Bubble_Master_Controller";
            master.label = 1; // Red
            master.colorLabel = "#ff3b30";
            master.notShyable = true;
            master.transform.position.setValue([posX, posY, 0]);

            // Add Effect Controls to Master Controller
            var parade = master.property("ADBE Effect Parade") || master.property("Effects");
            if (parade && parade.addProperty) {
                var effW = parade.addProperty("ADBE Slider Control");
                if (effW) { effW.name = "Screen Width"; effW.property(1).setValue(screenW); }

                var effSize = parade.addProperty("ADBE Slider Control");
                if (effSize) { effSize.name = "Text Size"; effSize.property(1).setValue(textSize); }

                var effBW = parade.addProperty("ADBE Slider Control");
                if (effBW) { effBW.name = "Bubble Width"; effBW.property(1).setValue(bubbleW); }

                var effBH = parade.addProperty("ADBE Slider Control");
                if (effBH) { effBH.name = "Bubble Height"; effBH.property(1).setValue(bubbleH); }

                var effTail = parade.addProperty("ADBE Checkbox Control");
                if (effTail) { effTail.name = "Show Tail"; effTail.property(1).setValue(hasTail ? 1 : 0); }

                var effStatus = parade.addProperty("ADBE Slider Control");
                if (effStatus) { effStatus.name = "Status Icon Mode"; effStatus.property(1).setValue(selStatusIdx); }

                var effStatusStyle = parade.addProperty("ADBE Slider Control");
                if (effStatusStyle) { effStatusStyle.name = "Status Icon Style"; effStatusStyle.property(1).setValue(selStatusStyleIdx); }

                var effDelivered = parade.addProperty("ADBE Slider Control");
                if (effDelivered) { effDelivered.name = "Delivered Time (s)"; effDelivered.property(1).setValue(deliveredTime); }

                var effRead = parade.addProperty("ADBE Slider Control");
                if (effRead) { effRead.name = "Read Time (s)"; effRead.property(1).setValue(readTime); }

                var effStatNeut = parade.addProperty("ADBE Color Control");
                if (effStatNeut) { effStatNeut.name = "Status Neutral Color"; effStatNeut.property(1).setValue(timeColor); }

                var effStatRead = parade.addProperty("ADBE Color Control");
                if (effStatRead) { effStatRead.name = "Status Read Color"; effStatRead.property(1).setValue(readColor); }

                var effStatReadCheck = parade.addProperty("ADBE Color Control");
                if (effStatReadCheck) { effStatReadCheck.name = "Status Read Check Color"; effStatReadCheck.property(1).setValue(rcsReadCheckCol); }

                var effPad = parade.addProperty("ADBE Slider Control");
                if (effPad) { effPad.name = "Inner Padding Offset"; effPad.property(1).setValue(padOffset); }

                var effLead = parade.addProperty("ADBE Slider Control");
                if (effLead) { effLead.name = "Leading Percent"; effLead.property(1).setValue(leadingPercent); }

                var effAnim = parade.addProperty("ADBE Slider Control");
                if (effAnim) { effAnim.name = "Animation Effect Type"; effAnim.property(1).setValue(selAnimIdx); }

                var effSpeed = parade.addProperty("ADBE Slider Control");
                if (effSpeed) { effSpeed.name = "Animation Speed"; effSpeed.property(1).setValue(animSpeed); }

                var effAmp = parade.addProperty("ADBE Slider Control");
                if (effAmp) { effAmp.name = "Animation Intensity"; effAmp.property(1).setValue(animAmp); }

                var effEnt = parade.addProperty("ADBE Checkbox Control");
                if (effEnt) { effEnt.name = "Animate Entrance"; effEnt.property(1).setValue(chkEntrance.value ? 1 : 0); }

                var effGrowF = parade.addProperty("ADBE Slider Control");
                if (effGrowF) {
                    effGrowF.name = "Bubble Grow Duration (frames)";
                    effGrowF.property(1).setValue(growFVal);
                }

                var effTypeF = parade.addProperty("ADBE Slider Control");
                if (effTypeF) {
                    effTypeF.name = "Typewriter Duration (frames)";
                    effTypeF.property(1).setValue(typeFVal);
                }

                var effCol = parade.addProperty("ADBE Color Control");
                if (effCol) { effCol.name = "Bubble Color"; effCol.property(1).setValue(bubbleColor); }
            }

            // 2. Bubble Vector Shape Layer (driven by Custom Rounded Rect engine)
            var bubbleLayer = comp.layers.addShape();
            bubbleLayer.name = isSent ? "Bubble_Sent" : "Bubble_Received";
            bubbleLayer.parent = master;

            // Anchor point placed at tail corner so bubble grows outward from tail
            // Sent: grows from Right to Left; Received: grows from Left to Right
            var originX = isSent ? (bubbleW / 2) : -(bubbleW / 2);
            var originY = (bubbleH / 2);
            var bAnchor = bubbleLayer.transform.anchorPoint || (bubbleLayer.property && bubbleLayer.property("ADBE Transform Group") && bubbleLayer.property("ADBE Transform Group").property("ADBE Anchor Point"));
            if (bAnchor) {
                bAnchor.setValue([originX, originY, 0]);
            }
            bubbleLayer.transform.position.setValue([originX, originY, 0]);

            if (bubbleLayer.transform.scale) bubbleLayer.transform.scale.expression = BUBBLE_GROW_EXPR;
            if (bubbleLayer.transform.opacity) bubbleLayer.transform.opacity.expression = BUBBLE_OPACITY_EXPR;

            // Add Effect Controls to Bubble Shape Layer (matching custom_rounded_rect)
            var bParade = bubbleLayer.property("ADBE Effect Parade") || bubbleLayer.property("Effects");
            if (bParade && bParade.addProperty) {
                var bEffW = bParade.addProperty("ADBE Slider Control");
                if (bEffW) { bEffW.name = "Width"; bEffW.property(1).setValue(bubbleW); }

                var bEffH = bParade.addProperty("ADBE Slider Control");
                if (bEffH) { bEffH.name = "Height"; bEffH.property(1).setValue(bubbleH); }

                var bEffTL = bParade.addProperty("ADBE Slider Control");
                if (bEffTL) { bEffTL.name = "Radius Top-Left"; bEffTL.property(1).setValue(rTL); }

                var bEffTR = bParade.addProperty("ADBE Slider Control");
                if (bEffTR) { bEffTR.name = "Radius Top-Right"; bEffTR.property(1).setValue(rTR); }

                var bEffBR = bParade.addProperty("ADBE Slider Control");
                if (bEffBR) { bEffBR.name = "Radius Bottom-Right"; bEffBR.property(1).setValue(rBR); }

                var bEffBL = bParade.addProperty("ADBE Slider Control");
                if (bEffBL) { bEffBL.name = "Radius Bottom-Left"; bEffBL.property(1).setValue(rBL); }

                var bEffOv = bParade.addProperty("ADBE Checkbox Control");
                if (bEffOv) { bEffOv.name = "Prevent Overlap"; bEffOv.property(1).setValue(1); }

                var bEffTail = bParade.addProperty("ADBE Checkbox Control");
                if (bEffTail) { bEffTail.name = "Show Tail"; bEffTail.property(1).setValue(hasTail ? 1 : 0); }
            }

            var contents = bubbleLayer.property("ADBE Root Vectors Group") || bubbleLayer.property("Contents");

            // [A] Base outline group using custom_rounded_rect
            var grpBase = contents.addProperty("ADBE Vector Group");
            grpBase.name = "Bubble Base Outline";
            var grpBaseContents = grpBase.property("ADBE Vectors Group") || grpBase.property("Contents");
            var pathBase = grpBaseContents.addProperty("ADBE Vector Shape - Group");
            var baseShapeData = computeShapeData(bubbleW, bubbleH, rTL, rTR, rBR, rBL, true);
            if (typeof Shape !== "undefined") {
                try {
                    var sObj = new Shape();
                    sObj.vertices = baseShapeData.points;
                    sObj.inTangents = baseShapeData.inTangents;
                    sObj.outTangents = baseShapeData.outTangents;
                    sObj.closed = true;
                    var pathProp = pathBase.property("ADBE Vector Shape") || pathBase.property("Path") || pathBase.property(1);
                    if (pathProp) {
                        pathProp.setValue(sObj);
                        pathProp.expression = PATH_EXPR;
                    }
                } catch(eS) {}
            }

            // [B] Tail Pointer vector group (when enabled)
            if (hasTail) {
                var grpTailShape = contents.addProperty("ADBE Vector Group");
                grpTailShape.name = "Tail Pointer";
                var grpTailContents = grpTailShape.property("ADBE Vectors Group") || grpTailShape.property("Contents");
                var pathTail = grpTailContents.addProperty("ADBE Vector Shape - Group");
                var tailShapeData = computeTailData(bubbleW, bubbleH, isSent);
                if (typeof Shape !== "undefined") {
                    try {
                        var sObjTail = new Shape();
                        sObjTail.vertices = tailShapeData.points;
                        sObjTail.inTangents = tailShapeData.inTangents;
                        sObjTail.outTangents = tailShapeData.outTangents;
                        sObjTail.closed = true;
                        var pathTailProp = pathTail.property("ADBE Vector Shape") || pathTail.property("Path") || pathTail.property(1);
                        if (pathTailProp) {
                            pathTailProp.setValue(sObjTail);
                        }
                    } catch(eT) {}
                }
            }

            // [C] Shared Fill Graphic for unified bubble silhouette
            var fill = contents.addProperty("ADBE Vector Graphic - Fill");
            fill.property("Color").setValue(bubbleColor);

            // 3. Message Text Layer
            var textLayer = null;
            var textTopY = -(bubbleH / 2) + padY;
            var textLeftX = -(bubbleW / 2) + padX;

            if (typeof comp.layers.addText === "function") {
                textLayer = comp.layers.addText(wrappedString);
            } else {
                textLayer = comp.layers.addShape();
            }
            textLayer.name = "Message_Text";
            textLayer.parent = master;
            textLayer.fontSize = textSize;
            textLayer.fontColor = textColor;
            textLayer.fontFamily = selectedFont.css;
            textLayer.leading = lineH;
            textLayer.leadingPercent = leadingPercent;
            textLayer.justification = "left";

            var anchorProp = textLayer.transform.anchorPoint || (textLayer.property && textLayer.property("ADBE Transform Group") && textLayer.property("ADBE Transform Group").property("ADBE Anchor Point"));
            if (anchorProp) {
                anchorProp.setValue([0, 0, 0]);
            }
            textLayer.transform.position.setValue([textLeftX, textTopY, -0.5]);

            // Attach dynamic expressions for iOS 18 animated effects
            if (textLayer.transform.position) textLayer.transform.position.expression = POS_ANIM_EXPR;
            if (textLayer.transform.scale) textLayer.transform.scale.expression = SCALE_ANIM_EXPR;
            var rotProp = textLayer.transform.rotation || textLayer.transform.zRotation || (textLayer.property && textLayer.property("ADBE Transform Group") && textLayer.property("ADBE Transform Group").property("ADBE Rotate Z"));
            if (rotProp) rotProp.expression = ROT_ANIM_EXPR;
            if (textLayer.transform.opacity) textLayer.transform.opacity.expression = OPACITY_ANIM_EXPR;

            if (textLayer.property && textLayer.property("Source Text")) {
                try {
                    var textDoc = textLayer.property("Source Text").value;
                    if (textDoc) {
                        textDoc.autoLeading = false;
                        textDoc.leading = lineH;
                        if (selectedFont.ae) {
                            try { textDoc.font = selectedFont.ae; } catch(eFont) {}
                        }
                        textLayer.property("Source Text").setValue(textDoc);
                    }
                } catch(eDoc) {}
                textLayer.property("Source Text").expression = TYPEWRITER_EXPR;
            } else if (textLayer.sourceText) {
                textLayer.sourceText.expression = TYPEWRITER_EXPR;
            }

            // 4. Timestamp & Status Row (allocated space for sent/delivered/read status icon)
            var timeRowRightX = (bubbleW / 2) - padX;
            var timeY = (bubbleH / 2) - Math.round(padY * 0.6) - timeFontSize;

            var statusX = timeRowRightX;
            var timeX = (statusW > 0) ? (timeRowRightX - statusW - statusSpacing) : timeRowRightX;
            var statusCenterX = timeRowRightX - (statusW / 2);
            var statusCenterY = timeY + Math.round(timeFontSize * 0.44);

            var timeLayer = null;
            if (typeof comp.layers.addText === "function") {
                timeLayer = comp.layers.addText(timeString);
            } else {
                timeLayer = comp.layers.addShape();
            }
            timeLayer.name = "Timestamp_Text";
            timeLayer.parent = master;
            timeLayer.fontSize = timeFontSize;
            timeLayer.fontColor = timeColor;
            timeLayer.fontFamily = selectedFont.css;
            timeLayer.justification = "right";
            timeLayer.transform.position.setValue([timeX, timeY, -0.5]);
            if (timeLayer.transform && timeLayer.transform.opacity) {
                timeLayer.transform.opacity.expression = TIMECODE_ENTRANCE_EXPR;
            }

            // 5. Dedicated Status / Read Icon Layers (Supports both RCS Circled Checks & Standard Checks)
            var hasStatus = (isSent && selStatusIdx !== 4);
            if (hasStatus) {
                // [A] Standard Checks Text Layer (WhatsApp / Classic ✓✓ style)
                var statusLayerText = null;
                if (typeof comp.layers.addText === "function") {
                    statusLayerText = comp.layers.addText(statusString || "✓✓");
                } else {
                    statusLayerText = comp.layers.addShape();
                }
                statusLayerText.name = "Status_Icon_Text";
                statusLayerText.parent = master;
                statusLayerText.fontSize = timeFontSize;
                statusLayerText.fontColor = statusColor;
                statusLayerText.fontFamily = selectedFont.css;
                statusLayerText.justification = "right";
                statusLayerText.transform.position.setValue([statusX, timeY, -0.5]);
                if (statusLayerText.transform && statusLayerText.transform.opacity) {
                    statusLayerText.transform.opacity.expression = STATUS_TEXT_OPACITY_EXPR;
                }
                if (statusLayerText.sourceText) {
                    statusLayerText.sourceText.expression = STATUS_TEXT_EXPR;
                }
                var sParade = statusLayerText.property("ADBE Effect Parade") || statusLayerText.property("Effects");
                if (sParade && sParade.addProperty) {
                    var sColEff = sParade.addProperty("ADBE Color Control");
                    if (sColEff) {
                        sColEff.name = "Status Color";
                        var sColProp = sColEff.property("Color") || sColEff.property(1);
                        if (sColProp) {
                            sColProp.setValue(statusColor);
                            sColProp.expression = STATUS_COLOR_EXPR;
                        }
                    }
                    try {
                        var sFillEff = sParade.addProperty("ADBE Fill");
                        if (sFillEff) {
                            sFillEff.name = "Status Fill Color";
                            var sFillCol = sFillEff.property("Color") || sFillEff.property(1);
                            if (sFillCol) {
                                sFillCol.setValue(statusColor);
                                sFillCol.expression = STATUS_COLOR_EXPR;
                            }
                        }
                    } catch(eFill) {}
                }
                if (statusLayerText.transform && statusLayerText.transform.scale) {
                    statusLayerText.transform.scale.expression = STATUS_SCALE_EXPR;
                }

                // [B] RCS Circled Checks Shape Layer (Google Messages / Android RCS style)
                var statusLayerRCS = null;
                if (typeof comp.layers.addShape === "function") {
                    statusLayerRCS = comp.layers.addShape();
                } else {
                    statusLayerRCS = comp.layers.addNull();
                }
                statusLayerRCS.name = "Status_Icon_RCS";
                statusLayerRCS.parent = master;
                statusLayerRCS.transform.position.setValue([statusCenterX, statusCenterY, -0.5]);
                if (statusLayerRCS.transform && statusLayerRCS.transform.opacity) {
                    statusLayerRCS.transform.opacity.expression = STATUS_RCS_OPACITY_EXPR;
                }
                if (statusLayerRCS.transform && statusLayerRCS.transform.scale) {
                    statusLayerRCS.transform.scale.expression = STATUS_SCALE_EXPR;
                }

                var rcsContents = statusLayerRCS.property("ADBE Root Vectors Group") || statusLayerRCS.property("Contents");
                if (rcsContents && rcsContents.addProperty) {
                    var circleSize = Math.max(10, Math.round(timeFontSize * 0.95));
                    var circleRadius = circleSize / 2;
                    var circleOffset = Math.round(circleSize * 0.44);
                    var checkScale = circleRadius / 6.5;

                    // Circle 1 Group
                    var grpC1 = rcsContents.addProperty("ADBE Vector Group");
                    grpC1.name = "Circle 1 Group";
                    var c1Contents = grpC1.property("ADBE Vectors Group") || grpC1.property("Contents");
                    var c1Transform = grpC1.property("ADBE Vector Transform Group") || grpC1.property("Transform");
                    if (c1Transform) {
                        var c1Pos = c1Transform.property("ADBE Vector Position") || c1Transform.property("Position");
                        if (c1Pos) c1Pos.expression = RCS_CIRCLE1_POS_EXPR;
                    }

                    // Circle 1 Shape (Ellipse + Fill + Stroke)
                    var grpC1Shape = c1Contents.addProperty("ADBE Vector Group");
                    grpC1Shape.name = "Circle 1 Shape";
                    var c1sContents = grpC1Shape.property("ADBE Vectors Group") || grpC1Shape.property("Contents");
                    var el1 = c1sContents.addProperty("ADBE Vector Shape - Ellipse");
                    if (el1) {
                        var el1Size = el1.property("ADBE Vector Ellipse Size") || el1.property("Size");
                        if (el1Size) el1Size.setValue([circleSize, circleSize]);
                    }
                    var f1 = c1sContents.addProperty("ADBE Vector Graphic - Fill");
                    if (f1) {
                        var f1Col = f1.property("ADBE Vector Fill Color") || f1.property("Color");
                        if (f1Col) f1Col.expression = RCS_CIRCLE_FILL_COLOR_EXPR;
                        var f1Op = f1.property("ADBE Vector Fill Opacity") || f1.property("Opacity");
                        if (f1Op) f1Op.expression = RCS_CIRCLE_FILL_OPACITY_EXPR;
                    }
                    var s1 = c1sContents.addProperty("ADBE Vector Graphic - Stroke");
                    if (s1) {
                        var s1Col = s1.property("ADBE Vector Stroke Color") || s1.property("Color");
                        if (s1Col) s1Col.expression = RCS_CIRCLE_STROKE_COLOR_EXPR;
                        var s1W = s1.property("ADBE Vector Stroke Width") || s1.property("Stroke Width");
                        if (s1W) s1W.setValue(1.5);
                        var s1Op = s1.property("ADBE Vector Stroke Opacity") || s1.property("Opacity");
                        if (s1Op) s1Op.expression = RCS_CIRCLE_STROKE_OPACITY_EXPR;
                    }

                    // Checkmark 1 (Path + Stroke)
                    var grpChk1 = c1Contents.addProperty("ADBE Vector Group");
                    grpChk1.name = "Checkmark 1";
                    var chk1Contents = grpChk1.property("ADBE Vectors Group") || grpChk1.property("Contents");
                    var p1 = chk1Contents.addProperty("ADBE Vector Shape - Group");
                    if (p1 && typeof Shape !== "undefined") {
                        try {
                            var shp1 = new Shape();
                            shp1.vertices = [
                                [-2.7 * checkScale, -0.2 * checkScale],
                                [-0.7 * checkScale, 2.0 * checkScale],
                                [2.8 * checkScale, -2.4 * checkScale]
                            ];
                            shp1.inTangents = [[0, 0], [0, 0], [0, 0]];
                            shp1.outTangents = [[0, 0], [0, 0], [0, 0]];
                            shp1.closed = false;
                            var p1Prop = p1.property("ADBE Vector Shape") || p1.property("Path") || p1.property(1);
                            if (p1Prop) p1Prop.setValue(shp1);
                        } catch(eShp1) {}
                    }
                    var sChk1 = chk1Contents.addProperty("ADBE Vector Graphic - Stroke");
                    if (sChk1) {
                        var sChk1Col = sChk1.property("ADBE Vector Stroke Color") || sChk1.property("Color");
                        if (sChk1Col) sChk1Col.expression = RCS_CHECK_COLOR_EXPR;
                        var sChk1W = sChk1.property("ADBE Vector Stroke Width") || sChk1.property("Stroke Width");
                        if (sChk1W) sChk1W.setValue(1.5);
                    }

                    // Circle 2 Group
                    var grpC2 = rcsContents.addProperty("ADBE Vector Group");
                    grpC2.name = "Circle 2 Group";
                    var c2Contents = grpC2.property("ADBE Vectors Group") || grpC2.property("Contents");
                    var c2Transform = grpC2.property("ADBE Vector Transform Group") || grpC2.property("Transform");
                    if (c2Transform) {
                        var c2Pos = c2Transform.property("ADBE Vector Position") || c2Transform.property("Position");
                        if (c2Pos) c2Pos.setValue([circleOffset, 0]);
                        var c2Op = c2Transform.property("ADBE Vector Group Opacity") || c2Transform.property("Opacity");
                        if (c2Op) c2Op.expression = RCS_CIRCLE2_OPACITY_EXPR;
                    }

                    // Circle 2 Shape (Ellipse + Fill + Stroke)
                    var grpC2Shape = c2Contents.addProperty("ADBE Vector Group");
                    grpC2Shape.name = "Circle 2 Shape";
                    var c2sContents = grpC2Shape.property("ADBE Vectors Group") || grpC2Shape.property("Contents");
                    var el2 = c2sContents.addProperty("ADBE Vector Shape - Ellipse");
                    if (el2) {
                        var el2Size = el2.property("ADBE Vector Ellipse Size") || el2.property("Size");
                        if (el2Size) el2Size.setValue([circleSize, circleSize]);
                    }
                    var f2 = c2sContents.addProperty("ADBE Vector Graphic - Fill");
                    if (f2) {
                        var f2Col = f2.property("ADBE Vector Fill Color") || f2.property("Color");
                        if (f2Col) f2Col.expression = RCS_CIRCLE_FILL_COLOR_EXPR;
                        var f2Op = f2.property("ADBE Vector Fill Opacity") || f2.property("Opacity");
                        if (f2Op) f2Op.expression = RCS_CIRCLE_FILL_OPACITY_EXPR;
                    }
                    var s2 = c2sContents.addProperty("ADBE Vector Graphic - Stroke");
                    if (s2) {
                        var s2Col = s2.property("ADBE Vector Stroke Color") || s2.property("Color");
                        if (s2Col) s2Col.expression = RCS_CIRCLE_STROKE_COLOR_EXPR;
                        var s2W = s2.property("ADBE Vector Stroke Width") || s2.property("Stroke Width");
                        if (s2W) s2W.setValue(1.5);
                        var s2Op = s2.property("ADBE Vector Stroke Opacity") || s2.property("Opacity");
                        if (s2Op) s2Op.expression = RCS_CIRCLE_STROKE_OPACITY_EXPR;
                    }

                    // Checkmark 2 (Path + Stroke)
                    var grpChk2 = c2Contents.addProperty("ADBE Vector Group");
                    grpChk2.name = "Checkmark 2";
                    var chk2Contents = grpChk2.property("ADBE Vectors Group") || grpChk2.property("Contents");
                    var p2 = chk2Contents.addProperty("ADBE Vector Shape - Group");
                    if (p2 && typeof Shape !== "undefined") {
                        try {
                            var shp2 = new Shape();
                            shp2.vertices = [
                                [-2.7 * checkScale, -0.2 * checkScale],
                                [-0.7 * checkScale, 2.0 * checkScale],
                                [2.8 * checkScale, -2.4 * checkScale]
                            ];
                            shp2.inTangents = [[0, 0], [0, 0], [0, 0]];
                            shp2.outTangents = [[0, 0], [0, 0], [0, 0]];
                            shp2.closed = false;
                            var p2Prop = p2.property("ADBE Vector Shape") || p2.property("Path") || p2.property(1);
                            if (p2Prop) p2Prop.setValue(shp2);
                        } catch(eShp2) {}
                    }
                    var sChk2 = chk2Contents.addProperty("ADBE Vector Graphic - Stroke");
                    if (sChk2) {
                        var sChk2Col = sChk2.property("ADBE Vector Stroke Color") || sChk2.property("Color");
                        if (sChk2Col) sChk2Col.expression = RCS_CHECK_COLOR_EXPR;
                        var sChk2W = sChk2.property("ADBE Vector Stroke Width") || sChk2.property("Stroke Width");
                        if (sChk2W) sChk2W.setValue(1.5);
                    }
                }
            }

            // 6. Precompose all created layers into "message_" + random hex number
            var randHex = Math.floor(Math.random() * 0x10000).toString(16).toLowerCase();
            while (randHex.length < 4) randHex = "0" + randHex;
            var precompName = "message_" + randHex;

            var createdLayers = [master, bubbleLayer, textLayer, timeLayer];
            if (hasStatus && statusLayerText) createdLayers.push(statusLayerText);
            if (hasStatus && statusLayerRCS) createdLayers.push(statusLayerRCS);

            var preCompItem = null;
            var precompLayer = null;

            if (comp.layers && typeof comp.layers.precompose === "function") {
                try {
                    var indicesMap = {};
                    for (var ci = 0; ci < createdLayers.length; ci++) {
                        if (createdLayers[ci] && createdLayers[ci].index) {
                            indicesMap[createdLayers[ci].index] = true;
                        }
                    }
                    var indices = [];
                    for (var kIdx in indicesMap) {
                        if (indicesMap.hasOwnProperty(kIdx)) {
                            indices.push(parseInt(kIdx, 10));
                        }
                    }
                    indices.sort(function(a, b) { return a - b; });

                    preCompItem = comp.layers.precompose(indices, precompName, true);

                    // Find the precomp representation layer in parent comp
                    for (var pli = 1; pli <= comp.layers.length; pli++) {
                        var testL = comp.layer(pli);
                        if (testL && (testL.source === preCompItem || testL.name === precompName)) {
                            precompLayer = testL;
                            break;
                        }
                    }
                    if (!precompLayer) {
                        precompLayer = getLayer(comp, precompName) || getLayer(comp, 1);
                    }
                } catch(ePrecomp) {}
            }

            if (precompLayer) {
                precompLayer.name = precompName;
                precompLayer.label = 1; // Red / Accent
                precompLayer.colorLabel = "#ff3b30";
                precompLayer.notShyable = true;
                if ("collapseTransformation" in precompLayer) {
                    precompLayer.collapseTransformation = true; // Continuous rasterization preserves vector sharpness
                }

                // 7. Add all animable Effect Controls to the precomp's parent layer
                function addParentEffect(type, name, val) {
                    var p = precompLayer.property("ADBE Effect Parade") || precompLayer.property("Effects");
                    if (!p || !p.addProperty) return null;
                    var eff = p.addProperty(type);
                    if (eff) {
                        eff.name = name;
                        var prop = eff.property(1);
                        if (prop && typeof prop.setValue === "function") {
                            prop.setValue(val);
                        }
                    }
                    return eff;
                }

                addParentEffect("ADBE Color Control", "Bubble Color", bubbleColor);
                addParentEffect("ADBE Checkbox Control", "Animate Entrance", chkEntrance.value ? 1 : 0);
                addParentEffect("ADBE Slider Control", "Bubble Grow Duration (frames)", growFVal);
                addParentEffect("ADBE Slider Control", "Typewriter Duration (frames)", typeFVal);
                addParentEffect("ADBE Slider Control", "Animation Effect Type", selAnimIdx);
                addParentEffect("ADBE Slider Control", "Animation Speed", animSpeed);
                addParentEffect("ADBE Slider Control", "Animation Intensity", animAmp);
                addParentEffect("ADBE Slider Control", "Delivered Time (s)", deliveredTime);
                addParentEffect("ADBE Slider Control", "Read Time (s)", readTime);
                addParentEffect("ADBE Slider Control", "Status Icon Mode", selStatusIdx);
                addParentEffect("ADBE Slider Control", "Status Icon Style", selStatusStyleIdx);
                addParentEffect("ADBE Color Control", "Status Neutral Color", timeColor);
                addParentEffect("ADBE Color Control", "Status Read Color", readColor);
                addParentEffect("ADBE Color Control", "Status Read Check Color", rcsReadCheckCol);
                addParentEffect("ADBE Slider Control", "Bubble Width", bubbleW);
                addParentEffect("ADBE Slider Control", "Bubble Height", bubbleH);
                addParentEffect("ADBE Slider Control", "Inner Padding Offset", padOffset);
                addParentEffect("ADBE Slider Control", "Leading Percent", leadingPercent);
                addParentEffect("ADBE Checkbox Control", "Show Tail", hasTail ? 1 : 0);
                addParentEffect("ADBE Slider Control", "Screen Width", screenW);
                addParentEffect("ADBE Slider Control", "Text Size", textSize);

                precompLayer.selected = true;

                // 8. Link Master Controller inside the precomp to parent precomp layer
                var safeParentCompName = comp.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                var safePrecompName = precompName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

                function linkPreMaster(effectName, isColor) {
                    if (!master) return;
                    var eff = master.effect(effectName);
                    if (!eff || !eff.property(1)) return;
                    var valStr = isColor ? "" : ".value";
                    var expr = 'try {\n' +
                               '    comp("' + safeParentCompName + '").layer("' + safePrecompName + '").effect("' + effectName + '")(1)' + valStr + ';\n' +
                               '} catch (err) {\n' +
                               '    value;\n' +
                               '}';
                    eff.property(1).expression = expr;
                }

                linkPreMaster("Bubble Color", true);
                linkPreMaster("Animate Entrance", false);
                linkPreMaster("Bubble Grow Duration (frames)", false);
                linkPreMaster("Typewriter Duration (frames)", false);
                linkPreMaster("Animation Effect Type", false);
                linkPreMaster("Animation Speed", false);
                linkPreMaster("Animation Intensity", false);
                linkPreMaster("Delivered Time (s)", false);
                linkPreMaster("Read Time (s)", false);
                linkPreMaster("Status Icon Mode", false);
                linkPreMaster("Status Icon Style", false);
                linkPreMaster("Status Neutral Color", true);
                linkPreMaster("Status Read Color", true);
                linkPreMaster("Status Read Check Color", true);
                linkPreMaster("Bubble Width", false);
                linkPreMaster("Bubble Height", false);
                linkPreMaster("Inner Padding Offset", false);
                linkPreMaster("Leading Percent", false);
                linkPreMaster("Show Tail", false);
                linkPreMaster("Screen Width", false);
                linkPreMaster("Text Size", false);

                if (fill && fill.property && fill.property("Color")) {
                    fill.property("Color").expression = 'try {\n' +
                        '    comp("' + safeParentCompName + '").layer("' + safePrecompName + '").effect("Bubble Color")(1);\n' +
                        '} catch (err) {\n' +
                        '    try { thisComp.layer("Bubble_Master_Controller").effect("Bubble Color")(1); } catch (e) { value; }\n' +
                        '}';
                }
            } else {
                master.selected = true;
            }

        } catch (err) {
            alert("Could not generate Message Bubble:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) {
                app.endUndoGroup();
            }
        }
    }

    // -------------------------------------------------------------------------
    // Selection Detection & Live Update Engine (Precomp Tracking)
    // -------------------------------------------------------------------------
    function isMessageBubbleLayer(lyr) {
        if (!lyr) return false;
        if (lyr.name && /^message_[0-9a-fA-F]+/i.test(lyr.name)) return true;
        if (lyr.source && lyr.source instanceof CompItem) {
            if (/^message_[0-9a-fA-F]+/i.test(lyr.source.name)) return true;
            if (isMessageBubbleComp(lyr.source)) return true;
        }
        if (lyr.effect && lyr.effect("Bubble Color") && lyr.effect("Bubble Width")) {
            return true;
        }
        return false;
    }

    function isMessageBubbleComp(compItem) {
        if (!compItem || !(compItem instanceof CompItem)) return false;
        if (compItem.name && /^message_[0-9a-fA-F]+/i.test(compItem.name)) return true;
        if (getLayer(compItem, "Bubble_Master_Controller")) return true;
        return false;
    }

    function getSelectedMessageBubblePrecomp() {
        var comp = app.project ? app.project.activeItem : null;
        if (!comp || !(comp instanceof CompItem)) return null;

        var sel = comp.selectedLayers;
        if (sel && sel.length > 0) {
            for (var i = 0; i < sel.length; i++) {
                var lyr = sel[i];
                if (isMessageBubbleLayer(lyr)) {
                    var srcComp = (lyr.source && lyr.source instanceof CompItem) ? lyr.source : null;
                    return {
                        parentComp: comp,
                        precompLayer: lyr,
                        preCompItem: srcComp
                    };
                }
            }
        }

        if (isMessageBubbleComp(comp)) {
            return {
                parentComp: null,
                precompLayer: null,
                preCompItem: comp
            };
        }

        return null;
    }

    var lastTargetLayer = null;

    function loadSettingsFromPrecomp(target) {
        if (!target) return;
        var pLayer = target.precompLayer;
        var pComp = target.preCompItem;

        if (pComp) {
            var txtL = getLayer(pComp, "Message_Text");
            if (txtL) {
                var raw = "";
                if (txtL.property && txtL.property("Source Text")) {
                    try {
                        var doc = txtL.property("Source Text").value;
                        if (doc && doc.text) raw = doc.text;
                    } catch(e1) {}
                }
                if (!raw && txtL.text) raw = txtL.text;
                if (raw) {
                    txtMessage.text = raw;
                    updateCharCount();
                }
            }
        }

        var effSource = pLayer || (pComp ? getLayer(pComp, "Bubble_Master_Controller") : null);
        if (effSource && effSource.effect) {
            try {
                var eCol = effSource.effect("Bubble Color");
                if (eCol && eCol.property(1)) {
                    var valCol = eCol.property(1).value;
                    if (valCol) cpBubble.setColor(rgbToHex(valCol), false);
                }
            } catch(eC) {}

            try {
                var eW = effSource.effect("Screen Width");
                if (eW && eW.property(1)) txtWidth.text = String(Math.round(eW.property(1).value));
            } catch(eW2) {}

            try {
                var eS = effSource.effect("Text Size");
                if (eS && eS.property(1)) txtSize.text = String(Math.round(eS.property(1).value));
            } catch(eS2) {}

            try {
                var ePad = effSource.effect("Inner Padding Offset");
                if (ePad && ePad.property(1)) txtPad.text = String(Math.round(ePad.property(1).value));
            } catch(ePad2) {}

            try {
                var eLead = effSource.effect("Leading Percent");
                if (eLead && eLead.property(1)) txtLeading.text = String(Math.round(eLead.property(1).value));
            } catch(eLead2) {}

            try {
                var eTail = effSource.effect("Show Tail");
                if (eTail && eTail.property(1)) chkTail.value = (eTail.property(1).value >= 1);
            } catch(eTail2) {}

            try {
                var eEnt = effSource.effect("Animate Entrance");
                if (eEnt && eEnt.property(1)) chkEntrance.value = (eEnt.property(1).value >= 1);
            } catch(eEnt2) {}

            try {
                var eGrow = effSource.effect("Bubble Grow Duration (frames)");
                if (eGrow && eGrow.property(1) && typeof sldGrow !== "undefined" && sldGrow) {
                    var gVal = Math.round(eGrow.property(1).value);
                    sldGrow.value = gVal;
                    if (txtGrow) txtGrow.text = String(gVal);
                }
            } catch(eG2) {}

            try {
                var eType = effSource.effect("Typewriter Duration (frames)");
                if (eType && eType.property(1) && typeof sldType !== "undefined" && sldType) {
                    var tVal = Math.round(eType.property(1).value);
                    sldType.value = tVal;
                    if (txtType) txtType.text = String(tVal);
                }
            } catch(eT2) {}

            try {
                var eAnim = effSource.effect("Animation Effect Type");
                if (eAnim && eAnim.property(1) && dropAnim) {
                    var aVal = Math.round(eAnim.property(1).value);
                    if (aVal >= 0 && aVal < animOptions.length) {
                        dropAnim.selection = aVal;
                    }
                }
            } catch(eA2) {}

            try {
                var eSpeed = effSource.effect("Animation Speed");
                if (eSpeed && eSpeed.property(1)) txtSpeed.text = String(Math.round(eSpeed.property(1).value));
            } catch(eSp2) {}

            try {
                var eAmp = effSource.effect("Animation Intensity");
                if (eAmp && eAmp.property(1)) txtAmp.text = String(Math.round(eAmp.property(1).value));
            } catch(eAmp2) {}

            try {
                var eStat = effSource.effect("Status Icon Mode");
                if (eStat && eStat.property(1) && dropStatus) {
                    var sVal = Math.round(eStat.property(1).value);
                    if (sVal >= 0 && sVal < 5) dropStatus.selection = sVal;
                }
            } catch(eSt2) {}

            try {
                var eStatStyle = effSource.effect("Status Icon Style");
                if (eStatStyle && eStatStyle.property(1) && dropStatusStyle) {
                    var ssVal = Math.round(eStatStyle.property(1).value);
                    if (ssVal >= 0 && ssVal < 2) dropStatusStyle.selection = ssVal;
                }
            } catch(eSs2) {}
        }

        if (pComp) {
            if (getLayer(pComp, "Bubble_Sent")) {
                radSent.value = true;
                radReceived.value = false;
            } else if (getLayer(pComp, "Bubble_Received")) {
                radReceived.value = true;
                radSent.value = false;
            }
        }
    }

    function checkSelectionState() {
        try {
            var target = getSelectedMessageBubblePrecomp();
            if (target) {
                var targetName = (target.precompLayer ? target.precompLayer.name : (target.preCompItem ? target.preCompItem.name : ""));
                var updateText = targetName ? ("Update Message Bubble (" + targetName + ")") : "Update Message Bubble";
                if (btnBuild.text !== updateText) {
                    btnBuild.text = updateText;
                }

                var currentKey = target.precompLayer || target.preCompItem;
                if (currentKey && currentKey !== lastTargetLayer) {
                    lastTargetLayer = currentKey;
                    loadSettingsFromPrecomp(target);
                }
            } else {
                if (btnBuild.text !== "Create Message Bubble") {
                    btnBuild.text = "Create Message Bubble";
                }
                lastTargetLayer = null;
            }
        } catch(e) {}
    }

    function updateExistingMessageBubble(activeTarget) {
        var parentComp = activeTarget.parentComp || (app.project ? app.project.activeItem : null);
        var precompLayer = activeTarget.precompLayer;
        var preCompItem = activeTarget.preCompItem;

        if (!preCompItem && precompLayer && precompLayer.source instanceof CompItem) {
            preCompItem = precompLayer.source;
        }

        if (app.beginUndoGroup) {
            app.beginUndoGroup("Update Message Bubble");
        }

        try {
            var msgText = txtMessage.text || "Hello! 👋";
            if (msgText.length > MAX_CHARS) {
                msgText = msgText.substring(0, MAX_CHARS);
            }

            var selStyleIdx = dropPlatform.selection ? dropPlatform.selection.index : 0;
            var platformName = platformKeys[selStyleIdx] || "iOS Message";
            var platformCfg = PLATFORMS[platformName] || DEFAULT_PLATFORMS[platformName] || DEFAULT_PLATFORMS["iOS Message"];

            var isSent = radSent.value;
            var isDark = radDark.value;
            var themeKey = isDark ? "dark" : "light";
            var dirKey = isSent ? "sent" : "received";
            var colorSet = platformCfg[themeKey][dirKey];

            var bubbleColor = hexToRgb(cpBubble.value);
            var textColor = hexToRgb(cpText.value);
            var timeColor = hexToRgb(colorSet ? colorSet.time : "#888888");

            var screenW = parseFloat(txtWidth.text) || 420;
            var textSize = parseFloat(txtSize.text) || 20;

            var padOffset = parseFloat(txtPad.text) || 0;
            var leadingPercent = parseFloat(txtLeading.text) || 100;
            var leadingFactor = leadingPercent / 100;

            var selAnimIdx = dropAnim.selection ? dropAnim.selection.index : 0;
            var animSpeed = parseFloat(txtSpeed.text) || 100;
            var animAmp = parseFloat(txtAmp.text) || 100;
            var growFVal = (typeof sldGrow !== "undefined" && sldGrow) ? Math.max(0, Math.min(20, Math.round(sldGrow.value))) : 5;
            var typeFVal = (typeof sldType !== "undefined" && sldType) ? Math.max(0, Math.min(20, Math.round(sldType.value))) : 5;

            var fontIdx = dropFont.selection ? dropFont.selection.index : 0;
            var selectedFont = FONTS[fontIdx] || FONTS[0];

            var maxBubbleW = Math.max(120, screenW * 0.72);
            var padX = Math.max(4, Math.round(textSize * 0.75) + padOffset);
            var padY = Math.max(4, Math.round(textSize * 0.55) + padOffset);
            var maxTextW = maxBubbleW - (padX * 2);

            var lines = wrapTextToLines(msgText, maxTextW, textSize);
            var wrappedString = lines.join("\n");
            var measuredTextW = getLinesPixelBounds(lines, textSize);

            var lineH = Math.round(textSize * 1.35 * leadingFactor);
            var textBlockH = lines.length * lineH;

            var selStatusIdx = dropStatus.selection ? dropStatus.selection.index : 0;
            var isAutoStatus = (selStatusIdx === 0);
            var selStatusStyleIdx = (typeof dropStatusStyle !== "undefined" && dropStatusStyle && dropStatusStyle.selection)
                ? dropStatusStyle.selection.index
                : (platformCfg.statusStyle === "rcs" || platformName === "Android RCS" ? 0 : 1);
            var isRCSStyle = (selStatusStyleIdx === 0);

            var deliveredTime = 0.8;
            var readDuration = calculateReadDuration(msgText);
            var readTime = Math.round((deliveredTime + readDuration) * 10) / 10;

            var isDarkBubble = (bubbleColor[0] * 0.299 + bubbleColor[1] * 0.587 + bubbleColor[2] * 0.114) < 0.55;
            var rcsReadCircleCol = isDarkBubble ? [1.0, 1.0, 1.0] : [0.18, 0.19, 0.21];
            var rcsReadCheckCol = isDarkBubble ? bubbleColor : [1.0, 1.0, 1.0];
            var standardReadColor = isDark ? [0.33, 0.74, 0.92] : [0.20, 0.72, 0.95];
            var readColor = isRCSStyle ? rcsReadCircleCol : standardReadColor;
            var statusColor = timeColor;

            var statusString = "";
            if (isSent && selStatusIdx !== 4) {
                if (selStatusIdx === 0 || selStatusIdx === 1 || selStatusIdx === 2) {
                    statusString = "✓✓";
                } else if (selStatusIdx === 3) {
                    statusString = "✓";
                }
            }

            var timeString = currentRandomTime;
            var timeFontSize = Math.max(10, Math.round(textSize * 0.58));
            var timeW = Math.round(timeString.length * timeFontSize * 0.55);
            var statusW = (isSent && selStatusIdx !== 4)
                ? (isRCSStyle ? Math.round(timeFontSize * 1.55) : Math.round(timeFontSize * 1.35))
                : 0;
            var statusSpacing = statusW > 0 ? 6 : 0;
            var timeRowW = timeW + statusSpacing + statusW;

            var singleLine = (lines.length === 1);
            var bubbleW = 0;
            var bubbleH = 0;

            var scalePadFactor = (selAnimIdx === 1) ? 1.24 : ((selAnimIdx === 5) ? 1.30 : 1.0);
            var effMeasuredW = Math.round(measuredTextW * scalePadFactor);
            var effTextH = Math.round(textBlockH * scalePadFactor);

            if (singleLine && (effMeasuredW + timeRowW + padX * 2 + 16 < maxBubbleW)) {
                bubbleW = effMeasuredW + timeRowW + (padX * 2) + 16;
                bubbleH = effTextH + (padY * 2);
            } else {
                bubbleW = Math.max(effMeasuredW, timeRowW) + (padX * 2);
                bubbleH = effTextH + (padY * 2) + timeFontSize + 6;
            }

            var hasTail = chkTail.value;
            var cornerRadius = platformCfg.radius || 18;

            var rTL = cornerRadius;
            var rTR = cornerRadius;
            var rBR = cornerRadius;
            var rBL = cornerRadius;

            if (hasTail) {
                if (isSent) {
                    rBR = 4;
                } else {
                    rBL = 4;
                }
            }

            // 1. Update Master Effects on precompLayer (in parent comp)
            if (precompLayer && precompLayer.effect) {
                function setEffVal(name, val) {
                    try {
                        var eff = precompLayer.effect(name);
                        if (eff && eff.property(1) && typeof eff.property(1).setValue === "function") {
                            eff.property(1).setValue(val);
                        }
                    } catch(eEff) {}
                }
                setEffVal("Bubble Color", bubbleColor);
                setEffVal("Animate Entrance", chkEntrance.value ? 1 : 0);
                setEffVal("Bubble Grow Duration (frames)", growFVal);
                setEffVal("Typewriter Duration (frames)", typeFVal);
                setEffVal("Animation Effect Type", selAnimIdx);
                setEffVal("Animation Speed", animSpeed);
                setEffVal("Animation Intensity", animAmp);
                setEffVal("Delivered Time (s)", deliveredTime);
                setEffVal("Read Time (s)", readTime);
                setEffVal("Status Icon Mode", selStatusIdx);
                setEffVal("Status Icon Style", selStatusStyleIdx);
                setEffVal("Status Neutral Color", timeColor);
                setEffVal("Status Read Color", readColor);
                setEffVal("Status Read Check Color", rcsReadCheckCol);
                setEffVal("Bubble Width", bubbleW);
                setEffVal("Bubble Height", bubbleH);
                setEffVal("Inner Padding Offset", padOffset);
                setEffVal("Leading Percent", leadingPercent);
                setEffVal("Show Tail", hasTail ? 1 : 0);
                setEffVal("Screen Width", screenW);
                setEffVal("Text Size", textSize);
            }

            // 2. Update layers inside precomp
            if (preCompItem) {
                var compCenter = [preCompItem.width / 2, preCompItem.height / 2, 0];
                var screenMargin = Math.round(screenW * 0.04);
                var halfScreenW = screenW / 2;
                var posX = isSent
                    ? (compCenter[0] + halfScreenW - screenMargin - (bubbleW / 2))
                    : (compCenter[0] - halfScreenW + screenMargin + (bubbleW / 2));
                var posY = compCenter[1];

                // Master controller inside precomp
                var master = getLayer(preCompItem, "Bubble_Master_Controller");
                if (master && master.transform && master.transform.position) {
                    master.transform.position.setValue([posX, posY, 0]);
                }

                // Bubble Shape layer
                var bubbleLayer = getLayer(preCompItem, "Bubble_Sent") || getLayer(preCompItem, "Bubble_Received");
                if (bubbleLayer) {
                    bubbleLayer.name = isSent ? "Bubble_Sent" : "Bubble_Received";
                    var originX = isSent ? (bubbleW / 2) : -(bubbleW / 2);
                    var originY = (bubbleH / 2);
                    var bAnchor = bubbleLayer.transform.anchorPoint || (bubbleLayer.property && bubbleLayer.property("ADBE Transform Group") && bubbleLayer.property("ADBE Transform Group").property("ADBE Anchor Point"));
                    if (bAnchor) bAnchor.setValue([originX, originY, 0]);
                    if (bubbleLayer.transform && bubbleLayer.transform.position) {
                        bubbleLayer.transform.position.setValue([originX, originY, 0]);
                    }

                    // Update base shape outline
                    var baseShapeData = computeShapeData(bubbleW, bubbleH, rTL, rTR, rBR, rBL, true);
                    var pathProp = null;
                    try {
                        pathProp = bubbleLayer.property("Contents").property("Bubble Base Outline").property("Contents").property("ADBE Vector Shape - Group").property("Path");
                    } catch(eP) {
                        try {
                            pathProp = bubbleLayer.property("ADBE Root Vectors Group").property("Bubble Base Outline").property("ADBE Vectors Group").property("ADBE Vector Shape - Group").property(1);
                        } catch(eP2) {}
                    }
                    if (pathProp && typeof Shape !== "undefined") {
                        try {
                            var sObj = new Shape();
                            sObj.vertices = baseShapeData.points;
                            sObj.inTangents = baseShapeData.inTangents;
                            sObj.outTangents = baseShapeData.outTangents;
                            sObj.closed = true;
                            pathProp.setValue(sObj);
                        } catch(eSObj) {}
                    }

                    // Update tail pointer shape
                    if (hasTail) {
                        var tailShapeData = computeTailData(bubbleW, bubbleH, isSent);
                        var pathTailProp = null;
                        try {
                            pathTailProp = bubbleLayer.property("Contents").property("Tail Pointer").property("Contents").property("ADBE Vector Shape - Group").property("Path");
                        } catch(eTP) {
                            try {
                                pathTailProp = bubbleLayer.property("ADBE Root Vectors Group").property("Tail Pointer").property("ADBE Vectors Group").property("ADBE Vector Shape - Group").property(1);
                            } catch(eTP2) {}
                        }
                        if (pathTailProp && typeof Shape !== "undefined") {
                            try {
                                var sObjTail = new Shape();
                                sObjTail.vertices = tailShapeData.points;
                                sObjTail.inTangents = tailShapeData.inTangents;
                                sObjTail.outTangents = tailShapeData.outTangents;
                                sObjTail.closed = true;
                                pathTailProp.setValue(sObjTail);
                            } catch(eSTail) {}
                        }
                    }

                    // Update fill color
                    try {
                        var fillProp = bubbleLayer.property("Contents").property("ADBE Vector Graphic - Fill").property("Color");
                        if (fillProp) fillProp.setValue(bubbleColor);
                    } catch(eF) {}
                }

                // Update Message Text layer
                var textLayer = getLayer(preCompItem, "Message_Text");
                var textTopY = -(bubbleH / 2) + padY;
                var textLeftX = -(bubbleW / 2) + padX;
                if (textLayer) {
                    textLayer.fontSize = textSize;
                    textLayer.fontColor = textColor;
                    textLayer.fontFamily = selectedFont.css;
                    textLayer.leading = lineH;
                    textLayer.leadingPercent = leadingPercent;
                    if (textLayer.transform && textLayer.transform.position) {
                        textLayer.transform.position.setValue([textLeftX, textTopY, -0.5]);
                    }
                    if (textLayer.property && textLayer.property("Source Text")) {
                        try {
                            var tDoc = textLayer.property("Source Text").value;
                            if (tDoc) {
                                tDoc.text = wrappedString;
                                tDoc.fontSize = textSize;
                                tDoc.leading = lineH;
                                tDoc.autoLeading = false;
                                if (selectedFont.ae) {
                                    try { tDoc.font = selectedFont.ae; } catch(eFnt) {}
                                }
                                textLayer.property("Source Text").setValue(tDoc);
                            }
                        } catch(eTDoc) {}
                    }
                    if (textLayer.text !== undefined) {
                        textLayer.text = wrappedString;
                    }
                }

                // Update Timestamp Text layer
                var timeRowRightX = (bubbleW / 2) - padX;
                var timeY = (bubbleH / 2) - Math.round(padY * 0.6) - timeFontSize;
                var statusX = timeRowRightX;
                var timeX = (statusW > 0) ? (timeRowRightX - statusW - statusSpacing) : timeRowRightX;
                var statusCenterX = timeRowRightX - (statusW / 2);
                var statusCenterY = timeY + Math.round(timeFontSize * 0.44);

                var timeLayer = getLayer(preCompItem, "Timestamp_Text");
                if (timeLayer) {
                    timeLayer.fontSize = timeFontSize;
                    timeLayer.fontColor = timeColor;
                    timeLayer.fontFamily = selectedFont.css;
                    if (timeLayer.transform && timeLayer.transform.position) {
                        timeLayer.transform.position.setValue([timeX, timeY, -0.5]);
                    }
                }

                // Update Status text layer
                var statusLayerText = getLayer(preCompItem, "Status_Icon_Text");
                if (statusLayerText) {
                    statusLayerText.fontSize = timeFontSize;
                    statusLayerText.fontColor = statusColor;
                    statusLayerText.fontFamily = selectedFont.css;
                    if (statusLayerText.transform && statusLayerText.transform.position) {
                        statusLayerText.transform.position.setValue([statusX, timeY, -0.5]);
                    }
                    if (statusLayerText.sourceText) {
                        try {
                            var sDoc = statusLayerText.sourceText.value;
                            if (sDoc) {
                                sDoc.text = statusString || "✓✓";
                                statusLayerText.sourceText.setValue(sDoc);
                            }
                        } catch(eSDoc) {}
                    }
                }

                // Update Status RCS layer
                var statusLayerRCS = getLayer(preCompItem, "Status_Icon_RCS");
                if (statusLayerRCS && statusLayerRCS.transform && statusLayerRCS.transform.position) {
                    statusLayerRCS.transform.position.setValue([statusCenterX, statusCenterY, -0.5]);
                }

                if (typeof preCompItem._onChanged === "function") {
                    preCompItem._onChanged();
                }
            }

            if (parentComp && typeof parentComp._notify === "function") {
                parentComp._notify();
            }

            if (precompLayer) {
                precompLayer.selected = true;
            }

        } catch(err) {
            alert("Could not update Message Bubble:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) {
                app.endUndoGroup();
            }
        }
    }

    // -------------------------------------------------------------------------
    // 11. Build Action Buttons
    // -------------------------------------------------------------------------
    var btnBuild = win.add("button", undefined, "Create Message Bubble");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.preferredSize = [-1, 36];
    btnBuild.onClick = function() {
        var activeTarget = getSelectedMessageBubblePrecomp();
        if (activeTarget) {
            updateExistingMessageBubble(activeTarget);
        } else {
            buildMessageBubble();
        }
    };

    // --- Bottom Subtle Repository Link ---
    var grpRepoLink = win.add("group");
    grpRepoLink.orientation = "row";
    grpRepoLink.alignment = ["fill", "bottom"];
    grpRepoLink.alignChildren = ["center", "center"];
    grpRepoLink.margins = [0, 4, 0, 0];
    var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE_message_bubble");
    lblRepoLink.helpTip = "https://github.com/work2survive/AE_message_bubble";
    lblRepoLink.onClick = function() {
        var url = "https://github.com/work2survive/AE_message_bubble";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else {
            system.callSystem('open "' + url + '"');
        }
    };

    // Initialize layout & live selection state
    updateCharCount();
    syncColorsFromPlatform();
    checkSelectionState();

    win.onActivate = function() {
        checkSelectionState();
    };
    try {
        win.addEventListener("mouseover", function() { checkSelectionState(); });
        win.addEventListener("focus", function() { checkSelectionState(); });
    } catch(eEvt) {}

    var pollTimerId = null;
    if (typeof window !== "undefined" && typeof window.setInterval === "function") {
        pollTimerId = window.setInterval(checkSelectionState, 300);
    }

    var aeTaskId = 0;
    if (typeof app !== "undefined" && typeof app.scheduleTask === "function") {
        try {
            aeTaskId = app.scheduleTask("checkSelectionState()", 350, true);
        } catch(eTask) {}
    }

    win.onClose = function() {
        if (pollTimerId !== null && typeof window !== "undefined" && typeof window.clearInterval === "function") {
            try { window.clearInterval(pollTimerId); } catch(eC1) {}
        }
        if (aeTaskId && typeof app !== "undefined" && typeof app.cancelTask === "function") {
            try { app.cancelTask(aeTaskId); } catch(eC2) {}
        }
    };

    win.layout.layout(true);
    win.onResizing = win.onResize = function() {
        this.layout.resize();
    };

    if (win !== null && win instanceof Window) {
        win.center();
        win.show();
    }

})(this);
