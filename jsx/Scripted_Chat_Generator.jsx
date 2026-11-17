// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL:
// SCRIPTED CHAT GENERATOR v1.0.0
// Repository: https://github.com/work2survive/AE_scripted_Chat
// Based on:   https://github.com/work2survive/AE_message_bubble
// =============================================================================
//
// PURPOSE:
//   Generates complete, animated multi-bubble chat conversations in After Effects
//   (similar to FakeDetail.com, but fully animated & expression-rigged).
//   Reads scripted conversations from JSON files inside the "conversation"
//   subfolder (or imported directly into After Effects).
//
// KEY CAPABILITIES:
//   1. Conversation JSON Management ("conversation" subfolder):
//      - Top-of-UI pull-down automatically detects all .json files in "conversation/".
//      - Also detects .json FootageItems imported directly into After Effects.
//      - JSON header stores all common conversation settings (platform, theme,
//        initial timestamp, 12h/24h format, real/fake delays, typography, colors,
//        screen layout, and animations).
//   2. Smart Timestamps & Real vs. Fake Delays:
//      - Initial timestamp in header & UI, with automatic calculation for all
//        subsequent sent and received bubbles in 24h (14:32) or 12h (2:32 PM) format.
//      - Differentiates "Real Delay" (actual seconds in AE timeline before next
//        bubble appears) from "Fake Delay" (clock time increment on the timestamp).
//      - Per-bubble overrides:
//        * Specific time without '+' (e.g. "14:32") -> uses that clock time directly.
//        * Relative fake delay with '+' (e.g. "+14:32" or "+00:05") -> adds hours:minutes
//          to the previous bubble's timestamp.
//        * Per-bubble "realDelay" (e.g. 2 seconds for "Hey, are you at home?") while
//          all other bubbles use the header/UI default (e.g. 1.0s).
//   3. Automatic Chat Screen Scrolling:
//      - Automatically scrolls the conversation upward with smooth easing once
//        message bubbles overflow the vertical inner height of the chat screen.
//   4. Screen Tab:
//      - Controls Chat Screen visibility, opacity, width & height, inner padding,
//        background color, corner roundness, overflow clipping, and scroll speed.
//   5. Built on the AE_message_bubble Engine:
//      - Full single-path Bézier rounded rectangle + tail geometry, emoji font
//        range formatting, RCS circled checks & standard checks, and iOS 18 text effects.
//      - Schema & builder hooks ready for future RCS dialogs (images, videos,
//        carousels, and action buttons).
// =============================================================================

(function (thisObj) {
    "use strict";

    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Scripted Chat Generator", undefined, { resizeable: true });

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 6;
    win.margins = 10;

    // -------------------------------------------------------------------------
    // 1. Constants, JSON Polyfill & Utility Helpers
    // -------------------------------------------------------------------------
    var MAX_CHARS = 500;
    var PRESETS_FOLDER_NAME = "message bubble presets";
    var PRESETS_FILE_NAME = "presets.json";
    var CONVERSATION_FOLDER_NAME = "conversation";

    var JSONPolyfill = (typeof JSON !== "undefined" && JSON.parse && JSON.stringify) ? JSON : {
        parse: function (str) {
            return eval("(" + str + ")");
        },
        stringify: function (obj, replacer, space) {
            var indent = (typeof space === "number") ? new Array(space + 1).join(" ") : (space || "  ");
            function ser(val, depth) {
                if (val === null || val === undefined) return "null";
                if (typeof val === "boolean" || typeof val === "number") return String(val);
                if (typeof val === "string") {
                    return '"' + val.replace(/\\/g, "\\\\")
                                    .replace(/"/g, '\\"')
                                    .replace(/\r/g, "\\r")
                                    .replace(/\n/g, "\\n")
                                    .replace(/\t/g, "\\t") + '"';
                }
                var padCur = indent ? new Array(depth + 1).join(indent) : "";
                var padNext = indent ? new Array(depth + 2).join(indent) : "";
                var nl = indent ? "\n" : "";
                var sep = indent ? ": " : ":";
                if (val instanceof Array) {
                    if (val.length === 0) return "[]";
                    var arrItems = [];
                    for (var i = 0; i < val.length; i++) {
                        arrItems.push(padNext + ser(val[i], depth + 1));
                    }
                    return "[" + nl + arrItems.join("," + nl) + nl + padCur + "]";
                }
                if (typeof val === "object") {
                    var keys = [];
                    for (var k in val) {
                        if (val.hasOwnProperty(k) && typeof val[k] !== "function" && val[k] !== undefined) {
                            keys.push(k);
                        }
                    }
                    if (keys.length === 0) return "{}";
                    var objItems = [];
                    for (var j = 0; j < keys.length; j++) {
                        var key = keys[j];
                        objItems.push(padNext + ser(String(key), depth + 1) + sep + ser(val[key], depth + 1));
                    }
                    return "{" + nl + objItems.join("," + nl) + nl + padCur + "}";
                }
                return "null";
            }
            return ser(obj, 0);
        }
    };

    function trimStr(s) {
        if (s === null || s === undefined) return "";
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function hexToRgb(hex) {
        if (!hex) return [0.5, 0.5, 0.5];
        var str = String(hex);
        if (str.indexOf("rgba") === 0 || str.indexOf("rgb") === 0) {
            var m = str.match(/[\d.]+/g);
            if (m && m.length >= 3) {
                return [
                    Math.max(0, Math.min(1, parseFloat(m[0]) / 255)),
                    Math.max(0, Math.min(1, parseFloat(m[1]) / 255)),
                    Math.max(0, Math.min(1, parseFloat(m[2]) / 255))
                ];
            }
        }
        str = str.replace("#", "");
        if (str.length === 3) {
            str = str.charAt(0) + str.charAt(0) +
                  str.charAt(1) + str.charAt(1) +
                  str.charAt(2) + str.charAt(2);
        }
        var num = parseInt(str, 16);
        if (isNaN(num)) return [0.5, 0.5, 0.5];
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#888888";
        var r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255).toString(16);
        var g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255).toString(16);
        var b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255).toString(16);
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        return "#" + (r + g + b).toUpperCase();
    }

    function getLayer(comp, nameOrIndex) {
        if (!comp || !comp.layers) return null;
        try {
            if (typeof comp.layer === "function") {
                var l = comp.layer(nameOrIndex);
                if (l) return l;
            }
        } catch (e) {}
        try {
            if (typeof nameOrIndex === "string" && typeof comp.layers.byName === "function") {
                var l2 = comp.layers.byName(nameOrIndex);
                if (l2) return l2;
            }
        } catch (e2) {}
        if (typeof nameOrIndex === "number") {
            return comp.layers[nameOrIndex - 1] || null;
        }
        for (var i = 0; i < comp.layers.length; i++) {
            if (comp.layers[i] && comp.layers[i].name === nameOrIndex) {
                return comp.layers[i];
            }
        }
        return null;
    }

    function getTextProp(lyr) {
        if (!lyr) return null;
        try {
            if (lyr.property) {
                var p1 = lyr.property("Source Text");
                if (p1 && typeof p1.setValue === "function") return p1;
                var p2 = lyr.property("ADBE Text Properties");
                if (p2) {
                    var p3 = p2.property("ADBE Text Document") || p2.property("Source Text");
                    if (p3 && typeof p3.setValue === "function") return p3;
                }
            }
        } catch (e) {}
        if (lyr.sourceText && typeof lyr.sourceText.setValue === "function") {
            return lyr.sourceText;
        }
        return null;
    }

    function findLayerByName(comp, name) {
        return getLayer(comp, name);
    }

    function addControl(fxGroup, matchName, name, defaultValue) {
        if (!fxGroup) return null;
        try {
            var ctrl = fxGroup.addProperty(matchName);
            if (!ctrl) return null;
            ctrl.name = name;
            var propIdx = 1;
            var valProp = null;
            try { valProp = ctrl.property(propIdx); } catch (e) {}
            if (!valProp) {
                try { valProp = ctrl.property("Slider") || ctrl.property("Checkbox") || ctrl.property("Color"); } catch (e2) {}
            }
            if (valProp && defaultValue !== undefined) {
                valProp.setValue(defaultValue);
            }
            return ctrl;
        } catch (err) {
            return null;
        }
    }

    function safeSetExpression(prop, exprStr) {
        if (!prop) return;
        try {
            if (prop.canSetExpression !== false) {
                prop.expression = exprStr;
            }
        } catch (e) {}
    }

    function pickColor(currentRgb) {
        try {
            if (typeof $.colorPicker === "function") {
                var r = Math.round(Math.max(0, Math.min(1, currentRgb[0])) * 255);
                var g = Math.round(Math.max(0, Math.min(1, currentRgb[1])) * 255);
                var b = Math.round(Math.max(0, Math.min(1, currentRgb[2])) * 255);
                var hexInt = (r << 16) | (g << 8) | b;
                var picked = $.colorPicker(hexInt);
                if (picked !== -1 && picked !== undefined && !isNaN(picked)) {
                    return [
                        ((picked >> 16) & 255) / 255,
                        ((picked >> 8) & 255) / 255,
                        (picked & 255) / 255
                    ];
                }
                return null;
            }
        } catch (e) {}
        return currentRgb;
    }

    // -------------------------------------------------------------------------
    // 2. Font Stacks & Platform Presets (from AE_message_bubble)
    // -------------------------------------------------------------------------
    var FONTS = [
        {
            name: "SF Pro (Apple / iOS)",
            css: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
            ae: "SFProText-Regular",
            aeFallbacks: ["SFProText-Regular", "SFProDisplay-Regular", "HelveticaNeue", "SegoeUI", "ArialMT", "Arial"]
        },
        {
            name: "Roboto (Google / Android)",
            css: "Roboto, 'Google Sans', 'Segoe UI', Arial, sans-serif",
            ae: "Roboto-Regular",
            aeFallbacks: ["Roboto-Regular", "GoogleSans-Regular", "SegoeUI", "ArialMT", "Arial"]
        },
        {
            name: "Segoe UI (Windows)",
            css: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            ae: "SegoeUI",
            aeFallbacks: ["SegoeUI", "Tahoma", "ArialMT", "Arial"]
        },
        {
            name: "Helvetica Neue",
            css: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            ae: "HelveticaNeue",
            aeFallbacks: ["HelveticaNeue", "Helvetica", "ArialMT", "Arial"]
        },
        {
            name: "Arial",
            css: "Arial, Helvetica, sans-serif",
            ae: "ArialMT",
            aeFallbacks: ["ArialMT", "Arial"]
        },
        {
            name: "Inter",
            css: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            ae: "Inter-Regular",
            aeFallbacks: ["Inter-Regular", "Inter", "SegoeUI", "ArialMT", "Arial"]
        },
        {
            name: "Open Sans",
            css: "'Open Sans', 'Segoe UI', Roboto, sans-serif",
            ae: "OpenSans-Regular",
            aeFallbacks: ["OpenSans-Regular", "OpenSans", "SegoeUI", "ArialMT", "Arial"]
        },
        {
            name: "System Default",
            css: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            ae: "ArialMT",
            aeFallbacks: ["SegoeUI", "SFProText-Regular", "HelveticaNeue", "ArialMT", "Arial"]
        },
        {
            name: "Noto Color Emoji (Google)",
            css: "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', Roboto, Arial, sans-serif",
            ae: "NotoColorEmoji",
            aeFallbacks: ["NotoColorEmoji", "NotoColorEmoji-Regular", "AppleColorEmoji", "SegoeUIEmoji", "Roboto-Regular", "SegoeUI", "ArialMT"]
        }
    ];

    var FONT_NAMES = [];
    for (var fni = 0; fni < FONTS.length; fni++) {
        FONTS[fni].family = FONTS[fni].css;
        FONTS[fni].aeCandidates = FONTS[fni].aeFallbacks;
        FONT_NAMES.push(FONTS[fni].name);
    }

    var EMOJI_FONTS = [
        {
            name: "Noto Color Emoji (Google)",
            family: "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
            aeCandidates: ["NotoColorEmoji", "NotoColorEmoji-Regular", "SegoeUIEmoji", "AppleColorEmoji"]
        },
        {
            name: "Apple Color Emoji (Apple)",
            family: "'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            aeCandidates: ["AppleColorEmoji", "NotoColorEmoji", "SegoeUIEmoji"]
        },
        {
            name: "WhatsApp (Apple/Custom)",
            family: "'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            aeCandidates: ["AppleColorEmoji", "NotoColorEmoji", "SegoeUIEmoji"]
        },
        {
            name: "Twemoji Mozilla (Twitter)",
            family: "'Twemoji Mozilla', 'Twitter Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            aeCandidates: ["TwemojiMozilla", "TwitterColorEmoji", "NotoColorEmoji", "SegoeUIEmoji"]
        },
        {
            name: "Segoe UI Emoji (Windows)",
            family: "'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif",
            aeCandidates: ["SegoeUIEmoji", "NotoColorEmoji", "AppleColorEmoji"]
        }
    ];

    var EMOJI_FONT_NAMES = [];
    for (var efni = 0; efni < EMOJI_FONTS.length; efni++) {
        EMOJI_FONT_NAMES.push(EMOJI_FONTS[efni].name);
    }

    var DEFAULT_PLATFORMS = {
        "Android RCS": {
            label: "Android RCS style",
            radius: 18,
            tailType: "modern",
            font: "Roboto (Google / Android)",
            fontIndex: 1,
            fontFamily: "Roboto, 'Google Sans', 'Segoe UI', Arial, sans-serif",
            aeFontCandidates: ["Roboto-Regular", "GoogleSans-Regular", "SegoeUI", "ArialMT", "Arial"],
            emojiFont: "Noto Color Emoji (Google)",
            emojiFontFamily: "'Noto Color Emoji', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif",
            emojiAeCandidates: ["NotoColorEmoji", "NotoColorEmoji-Regular", "SegoeUIEmoji", "AppleColorEmoji"],
            statusStyle: "rcs",
            light: {
                screenBg: "#FFFFFF",
                sent:     { bubble: "#0b57d0", text: "#ffffff", time: "#c4d7f8", check: "" },
                received: { bubble: "#f1f3f4", text: "#1f1f1f", time: "#70757a", check: "" }
            },
            dark: {
                screenBg: "#131314",
                sent:     { bubble: "#a8c7fa", text: "#041e49", time: "#29436c", check: "" },
                received: { bubble: "#303134", text: "#e3e3e3", time: "#9aa0a6", check: "" }
            }
        },
        "iOS Message": {
            label: "iOS message style",
            radius: 18,
            tailType: "ios",
            font: "SF Pro (Apple / iOS)",
            fontIndex: 0,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
            aeFontCandidates: ["SFProText-Regular", "SFProDisplay-Regular", "HelveticaNeue", "SegoeUI", "ArialMT", "Arial"],
            emojiFont: "Apple Color Emoji (Apple)",
            emojiFontFamily: "'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            emojiAeCandidates: ["AppleColorEmoji", "NotoColorEmoji", "NotoColorEmoji-Regular", "SegoeUIEmoji"],
            statusStyle: "standard",
            light: {
                screenBg: "#FFFFFF",
                sent:     { bubble: "#007aff", text: "#ffffff", time: "#cce4ff", check: "" },
                received: { bubble: "#e9e9eb", text: "#000000", time: "#8e8e93", check: "" }
            },
            dark: {
                screenBg: "#000000",
                sent:     { bubble: "#0b84fe", text: "#ffffff", time: "#cce4ff", check: "" },
                received: { bubble: "#26252a", text: "#ffffff", time: "#8e8e93", check: "" }
            }
        },
        "WhatsApp": {
            label: "WhatsApp style",
            radius: 8,
            tailType: "classic",
            font: "Helvetica Neue",
            fontIndex: 3,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            aeFontCandidates: ["HelveticaNeue", "Helvetica", "SegoeUI", "ArialMT", "Arial"],
            emojiFont: "Apple Color Emoji (Apple)",
            emojiFontFamily: "'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            emojiAeCandidates: ["AppleColorEmoji", "NotoColorEmoji", "SegoeUIEmoji"],
            statusStyle: "standard",
            light: {
                screenBg: "#EFEAE2",
                sent:     { bubble: "#d9fdd3", text: "#111b21", time: "#667781", check: "#53bdeb" },
                received: { bubble: "#ffffff", text: "#111b21", time: "#667781", check: "" }
            },
            dark: {
                screenBg: "#0B141A",
                sent:     { bubble: "#005c4b", text: "#e9edef", time: "#8696a0", check: "#53bdeb" },
                received: { bubble: "#202c33", text: "#e9edef", time: "#8696a0", check: "" }
            }
        },
        "Instagram": {
            label: "Instagram style",
            radius: 20,
            tailType: "none",
            font: "SF Pro (Apple / iOS)",
            fontIndex: 0,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Instagram Sans', 'Helvetica Neue', Arial, sans-serif",
            aeFontCandidates: ["SFProText-Regular", "HelveticaNeue", "SegoeUI", "ArialMT", "Arial"],
            emojiFont: "Apple Color Emoji (Apple)",
            emojiFontFamily: "'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            emojiAeCandidates: ["AppleColorEmoji", "NotoColorEmoji", "SegoeUIEmoji"],
            statusStyle: "standard",
            light: {
                screenBg: "#FFFFFF",
                sent:     { bubble: "#3797f0", text: "#ffffff", time: "#d4ebff", check: "" },
                received: { bubble: "#efefef", text: "#262626", time: "#8e8e8e", check: "" }
            },
            dark: {
                screenBg: "#121212",
                sent:     { bubble: "#3797f0", text: "#ffffff", time: "#d4ebff", check: "" },
                received: { bubble: "#262626", text: "#f5f5f5", time: "#a8a8a8", check: "" }
            }
        },
        "Facebook Messenger": {
            label: "Messenger style",
            radius: 18,
            tailType: "none",
            font: "Segoe UI (Windows)",
            fontIndex: 2,
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif",
            aeFontCandidates: ["SegoeUI", "Tahoma", "ArialMT", "Arial"],
            emojiFont: "Segoe UI Emoji (Windows)",
            emojiFontFamily: "'Segoe UI Emoji', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif",
            emojiAeCandidates: ["SegoeUIEmoji", "NotoColorEmoji", "AppleColorEmoji"],
            statusStyle: "standard",
            light: {
                screenBg: "#FFFFFF",
                sent:     { bubble: "#0084ff", text: "#ffffff", time: "#cce6ff", check: "#0084ff" },
                received: { bubble: "#e4e6eb", text: "#050505", time: "#65676b", check: "" }
            },
            dark: {
                screenBg: "#18191A",
                sent:     { bubble: "#0084ff", text: "#ffffff", time: "#cce6ff", check: "#0084ff" },
                received: { bubble: "#303030", text: "#e4e6eb", time: "#b0b3b8", check: "" }
            }
        },
        "Telegram": {
            label: "Telegram style",
            radius: 14,
            tailType: "classic",
            font: "Open Sans",
            fontIndex: 6,
            fontFamily: "'Open Sans', 'Segoe UI', Roboto, Arial, sans-serif",
            aeFontCandidates: ["OpenSans-Regular", "OpenSans", "SegoeUI", "ArialMT", "Arial"],
            emojiFont: "Apple Color Emoji (Apple)",
            emojiFontFamily: "'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            emojiAeCandidates: ["AppleColorEmoji", "NotoColorEmoji", "SegoeUIEmoji"],
            statusStyle: "standard",
            light: {
                screenBg: "#DCE6D5",
                sent:     { bubble: "#effdde", text: "#000000", time: "#4fae4e", check: "#4fae4e" },
                received: { bubble: "#ffffff", text: "#000000", time: "#a0acb6", check: "" }
            },
            dark: {
                screenBg: "#0E1621",
                sent:     { bubble: "#2b5278", text: "#ffffff", time: "#9ec2e6", check: "#6ab2f2" },
                received: { bubble: "#182533", text: "#ffffff", time: "#708499", check: "" }
            }
        },
        "Discord": {
            label: "Discord style",
            radius: 12,
            tailType: "none",
            font: "Inter",
            fontIndex: 5,
            fontFamily: "Inter, 'gg sans', 'Segoe UI', Arial, sans-serif",
            aeFontCandidates: ["Inter-Regular", "Inter", "SegoeUI", "ArialMT", "Arial"],
            emojiFont: "Twemoji Mozilla (Twitter)",
            emojiFontFamily: "'Twemoji Mozilla', 'Twitter Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif",
            emojiAeCandidates: ["TwemojiMozilla", "TwitterColorEmoji", "NotoColorEmoji", "SegoeUIEmoji"],
            statusStyle: "standard",
            light: {
                screenBg: "#FFFFFF",
                sent:     { bubble: "#5865f2", text: "#ffffff", time: "#d4d8fc", check: "" },
                received: { bubble: "#e3e5e8", text: "#2e3338", time: "#747f8d", check: "" }
            },
            dark: {
                screenBg: "#313338",
                sent:     { bubble: "#5865f2", text: "#ffffff", time: "#d4d8fc", check: "" },
                received: { bubble: "#2b2d31", text: "#dbdee1", time: "#949ba4", check: "" }
            }
        },
        "Custom": {
            label: "Custom Preset",
            radius: 18,
            tailType: "modern",
            font: "System Default",
            fontIndex: 7,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            aeFontCandidates: ["SegoeUI", "ArialMT", "Arial", "HelveticaNeue"],
            emojiFont: "Noto Color Emoji (Google)",
            emojiFontFamily: "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif",
            emojiAeCandidates: ["NotoColorEmoji", "AppleColorEmoji", "SegoeUIEmoji"],
            statusStyle: "standard",
            light: {
                screenBg: "#FFFFFF",
                sent:     { bubble: "#007aff", text: "#ffffff", time: "#cce4ff", check: "" },
                received: { bubble: "#e9e9eb", text: "#000000", time: "#8e8e93", check: "" }
            },
            dark: {
                screenBg: "#121212",
                sent:     { bubble: "#0b84fe", text: "#ffffff", time: "#cce4ff", check: "" },
                received: { bubble: "#26252a", text: "#ffffff", time: "#8e8e93", check: "" }
            }
        }
    };

    function cloneObject(obj) {
        return JSONPolyfill.parse(JSONPolyfill.stringify(obj));
    }

    var PLATFORMS = cloneObject(DEFAULT_PLATFORMS);
    var platformKeys = [];
    function updatePlatformKeys() {
        platformKeys = [];
        for (var k in PLATFORMS) {
            if (PLATFORMS.hasOwnProperty(k)) {
                platformKeys.push(k);
            }
        }
    }
    updatePlatformKeys();
    // =========================================================================
    // 2B. PRESETS FILE LOADER & CONVERSATION FOLDER MANAGER
    // =========================================================================
    function getScriptBaseFolder() {
        try {
            var scriptFile = new File($.fileName);
            if (scriptFile && scriptFile.parent && scriptFile.parent.exists) {
                return scriptFile.parent;
            }
        } catch (e) {}
        return Folder.myDocuments;
    }

    function getPresetsFolder() {
        var base = getScriptBaseFolder();
        var presetFolder = new Folder(base.fsName + "/message bubble presets");
        if (!presetFolder.exists) {
            try { presetFolder.create(); } catch (e) {}
        }
        return presetFolder;
    }

    function getPresetsFile() {
        var folder = getPresetsFolder();
        return new File(folder.fsName + "/presets.json");
    }

    function ensurePresetsFile() {
        try {
            var f = getPresetsFile();
            if (!f.exists) {
                f.encoding = "UTF-8";
                if (f.open("w")) {
                    f.write(JSONPolyfill.stringify(DEFAULT_PLATFORMS, null, 2));
                    f.close();
                }
            }
        } catch (e) {}
    }

    function loadPresetsFromFile() {
        try {
            ensurePresetsFile();
            var f = getPresetsFile();
            if (f.exists) {
                f.encoding = "UTF-8";
                if (f.open("r")) {
                    var content = f.read();
                    f.close();
                    if (content && content.length > 2) {
                        var parsed = JSONPolyfill.parse(content);
                        if (parsed && typeof parsed === "object") {
                            for (var k in parsed) {
                                if (parsed.hasOwnProperty(k)) {
                                    PLATFORMS[k] = parsed[k];
                                }
                            }
                            updatePlatformKeys();
                            return true;
                        }
                    }
                }
            }
        } catch (e) {}
        return false;
    }
    loadPresetsFromFile();

    // Default Built-in Conversations (written to /conversation/ if missing, and used as fallback)
    var DEFAULT_CONVERSATIONS = {
        "rcs_home_invitation.json": {
            "schemaVersion": "1.0",
            "header": {
                "conversationTitle": "Home Invitation (Android RCS Demo)",
                "platform": "Android RCS",
                "theme": "light",
                "font": "Roboto",
                "emojiFont": "Noto Color Emoji (Google)",
                "useTimestamps": true,
                "initialTimestamp": "14:20",
                "timeFormat": "24h",
                "realDelayBetweenBubbles": 1.0,
                "fakeDelayBetweenBubbles": "+00:01",
                "bubbleWidth": 620,
                "maxBubbleWidth": 720,
                "textWrapping": true,
                "textSize": 42,
                "innerPadding": 36,
                "lineSpacing": 130,
                "bubbleGap": 24,
                "showTail": true,
                "groupConsecutive": true,
                "showStatus": true,
                "sentToDeliveredDelay": 0.6,
                "deliveredToReadDelay": 1.2,
                "entranceAnimation": true,
                "growDuration": 12,
                "typewriterSpeed": 0,
                "screenVisible": true,
                "screenOpacity": 100,
                "screenWidth": 960,
                "screenHeight": 1680,
                "screenInnerPadding": 48,
                "screenCornerRadius": 64,
                "screenBackgroundColor": "#F8F9FA",
                "autoScroll": true,
                "clipToScreen": true,
                "scrollSmoothnessFrames": 12
            },
            "messages": [
                {
                    "id": "msg_01",
                    "type": "text",
                    "direction": "sent",
                    "text": "Hey! Just finished work 👋"
                },
                {
                    "id": "msg_02",
                    "type": "text",
                    "direction": "received",
                    "text": "Hey, are you at home?",
                    "realDelay": 2.0,
                    "timestamp": "+00:02"
                },
                {
                    "id": "msg_03",
                    "type": "text",
                    "direction": "sent",
                    "text": "Almost! Walking up the street right now 🏃‍♂️",
                    "timestamp": "+00:01"
                },
                {
                    "id": "msg_04",
                    "type": "text",
                    "direction": "sent",
                    "text": "Give me 5 minutes!",
                    "realDelay": 0.8
                },
                {
                    "id": "msg_05",
                    "type": "text",
                    "direction": "received",
                    "text": "Awesome! I brought pizza 🍕 and drinks",
                    "realDelay": 1.5,
                    "timestamp": "+00:05"
                },
                {
                    "id": "msg_06",
                    "type": "text",
                    "direction": "sent",
                    "text": "No way!! Best surprise ever 😍",
                    "timestamp": "14:32",
                    "textAnimation": { "nod": true, "shake": false, "blink": false }
                },
                {
                    "id": "msg_07",
                    "type": "text",
                    "direction": "received",
                    "text": "Ring the buzzer when you're downstairs 🔔",
                    "realDelay": 1.2
                },
                {
                    "id": "msg_08",
                    "type": "text",
                    "direction": "sent",
                    "text": "Just arrived at the door! Unlocking now 🔑"
                },
                {
                    "id": "msg_09",
                    "type": "text",
                    "direction": "received",
                    "text": "Come on up, 3rd floor! 🎉",
                    "realDelay": 1.5,
                    "textAnimation": { "nod": true, "shake": false, "blink": false }
                }
            ]
        },
        "ios_lunch_plans.json": {
            "schemaVersion": "1.0",
            "header": {
                "conversationTitle": "Weekend Lunch Plans (iOS 12h Demo)",
                "platform": "iOS Message",
                "theme": "light",
                "font": "SF Pro",
                "emojiFont": "Apple Color Emoji (Apple)",
                "useTimestamps": true,
                "initialTimestamp": "11:45",
                "timeFormat": "12h",
                "realDelayBetweenBubbles": 1.2,
                "fakeDelayBetweenBubbles": "+00:02",
                "bubbleWidth": 620,
                "maxBubbleWidth": 720,
                "textWrapping": true,
                "textSize": 42,
                "innerPadding": 36,
                "lineSpacing": 130,
                "bubbleGap": 22,
                "showTail": true,
                "groupConsecutive": true,
                "showStatus": true,
                "sentToDeliveredDelay": 0.7,
                "deliveredToReadDelay": 1.4,
                "entranceAnimation": true,
                "growDuration": 12,
                "typewriterSpeed": 0,
                "screenVisible": true,
                "screenOpacity": 100,
                "screenWidth": 960,
                "screenHeight": 1680,
                "screenInnerPadding": 48,
                "screenCornerRadius": 68,
                "screenBackgroundColor": "#FFFFFF",
                "autoScroll": true,
                "clipToScreen": true,
                "scrollSmoothnessFrames": 12
            },
            "messages": [
                {
                    "id": "ios_01",
                    "type": "text",
                    "direction": "received",
                    "text": "Morning! Still on for tacos today? 🌮"
                },
                {
                    "id": "ios_02",
                    "type": "text",
                    "direction": "sent",
                    "text": "100%! I've been thinking about them all week 😋",
                    "realDelay": 1.0,
                    "timestamp": "+00:01"
                },
                {
                    "id": "ios_03",
                    "type": "text",
                    "direction": "received",
                    "text": "Haha same! Should we meet at 12:30?",
                    "realDelay": 1.8,
                    "timestamp": "12:00"
                },
                {
                    "id": "ios_04",
                    "type": "text",
                    "direction": "sent",
                    "text": "12:30 works great. See you at La Taqueria! 🙌",
                    "timestamp": "+00:03",
                    "textAnimation": { "nod": true, "shake": false, "blink": false }
                }
            ]
        },
        "whatsapp_project_update.json": {
            "schemaVersion": "1.0",
            "header": {
                "conversationTitle": "Motion Design Review (WhatsApp Dark Demo)",
                "platform": "WhatsApp",
                "theme": "dark",
                "font": "Helvetica Neue",
                "emojiFont": "WhatsApp (Apple/Custom)",
                "useTimestamps": true,
                "initialTimestamp": "18:10",
                "timeFormat": "24h",
                "realDelayBetweenBubbles": 1.0,
                "fakeDelayBetweenBubbles": "+00:01",
                "bubbleWidth": 640,
                "maxBubbleWidth": 740,
                "textWrapping": true,
                "textSize": 40,
                "innerPadding": 34,
                "lineSpacing": 130,
                "bubbleGap": 20,
                "showTail": true,
                "groupConsecutive": true,
                "showStatus": true,
                "sentToDeliveredDelay": 0.5,
                "deliveredToReadDelay": 1.0,
                "entranceAnimation": true,
                "growDuration": 10,
                "typewriterSpeed": 0,
                "screenVisible": true,
                "screenOpacity": 100,
                "screenWidth": 960,
                "screenHeight": 1680,
                "screenInnerPadding": 44,
                "screenCornerRadius": 56,
                "screenBackgroundColor": "#0B141A",
                "autoScroll": true,
                "clipToScreen": true,
                "scrollSmoothnessFrames": 12
            },
            "messages": [
                {
                    "id": "wa_01",
                    "type": "text",
                    "direction": "received",
                    "text": "Hey! Did the client approve the new chat animation? 🎬"
                },
                {
                    "id": "wa_02",
                    "type": "text",
                    "direction": "sent",
                    "text": "Yes! They loved the automatic scroll and timestamp calculation 🔥",
                    "realDelay": 1.4,
                    "timestamp": "+00:02"
                },
                {
                    "id": "wa_03",
                    "type": "text",
                    "direction": "received",
                    "text": "Hey, are you at home?",
                    "realDelay": 2.0,
                    "timestamp": "19:05"
                },
                {
                    "id": "wa_04",
                    "type": "text",
                    "direction": "sent",
                    "text": "Yep! Exporting the final .JSON package right now 💻✨",
                    "timestamp": "+00:01"
                }
            ]
        }
    };

    function getConversationFolder() {
        var base = getScriptBaseFolder();
        var targetPath = (base && base.fsName ? base.fsName : ".") + "/conversation";
        try {
            if (typeof Folder !== "undefined") {
                var convFolder = new Folder(targetPath);
                if (!convFolder.exists) {
                    try { convFolder.create(); } catch (e) {}
                }
                return convFolder;
            }
        } catch (e2) {}
        return makeFallbackFolder(targetPath);
    }

    function ensureConversationFiles() {
        try {
            var folder = getConversationFolder();
            for (var fileName in DEFAULT_CONVERSATIONS) {
                if (DEFAULT_CONVERSATIONS.hasOwnProperty(fileName)) {
                    var f = new File(folder.fsName + "/" + fileName);
                    if (!f.exists) {
                        f.encoding = "UTF-8";
                        if (f.open("w")) {
                            f.write(JSONPolyfill.stringify(DEFAULT_CONVERSATIONS[fileName], null, 2));
                            f.close();
                        }
                    }
                }
            }
        } catch (e) {}
    }

    // Holds metadata of discovered conversations:
    // [{ fileName, label, filePath, source: "folder"|"ae_project"|"builtin", data }]
    var discoveredConversations = [];

    function isValidConversationObject(obj) {
        if (!obj || typeof obj !== "object") return false;
        if (obj.$schema && !obj.messages && !obj.header) return false;
        if (obj.messages && obj.messages instanceof Array) return true;
        if (obj.header && typeof obj.header === "object") return true;
        return false;
    }

    function normalizeConversationHeader(hdr) {
        if (!hdr || typeof hdr !== "object") return {};
        var typo = hdr.typography || {};
        var appCfg = hdr.appearance || {};
        var cols = appCfg.colors || {};
        var scr = hdr.screen || {};
        var anim = hdr.animation || {};

        if (!hdr.conversationTitle && hdr.title) hdr.conversationTitle = hdr.title;
        if (hdr.useTimestamps === undefined && hdr.showTimestamps !== undefined) hdr.useTimestamps = hdr.showTimestamps;

        if (!hdr.font && typo.fontFamily) hdr.font = typo.fontFamily;
        if (!hdr.emojiFont && typo.emojiFont && typo.emojiFont.indexOf("Auto") === -1) hdr.emojiFont = typo.emojiFont;
        if (hdr.bubbleWidth === undefined && typo.bubbleWidth !== undefined && typo.bubbleWidth > 0) hdr.bubbleWidth = typo.bubbleWidth;
        if (hdr.maxBubbleWidth === undefined && typo.maxBubbleWidth !== undefined) hdr.maxBubbleWidth = typo.maxBubbleWidth;
        if (hdr.textSize === undefined && typo.textSize !== undefined) hdr.textSize = typo.textSize;
        if (hdr.lineSpacing === undefined && typo.leadingPercent !== undefined) hdr.lineSpacing = typo.leadingPercent;
        if (hdr.bubbleGap === undefined && typo.bubbleGap !== undefined) hdr.bubbleGap = typo.bubbleGap;

        if (hdr.showTail === undefined && appCfg.showTail !== undefined) hdr.showTail = appCfg.showTail;
        if (hdr.groupConsecutive === undefined && appCfg.smartGroupTails !== undefined) hdr.groupConsecutive = appCfg.smartGroupTails;

        if (hdr.screenVisible === undefined && scr.visible !== undefined) hdr.screenVisible = scr.visible;
        if (hdr.screenOpacity === undefined && scr.opacity !== undefined) hdr.screenOpacity = scr.opacity;
        if (hdr.screenWidth === undefined && scr.width !== undefined) hdr.screenWidth = scr.width;
        if (hdr.screenHeight === undefined && scr.height !== undefined) hdr.screenHeight = scr.height;
        if (hdr.screenInnerPadding === undefined && scr.innerPadding !== undefined) hdr.screenInnerPadding = scr.innerPadding;
        if (hdr.screenCornerRadius === undefined && scr.cornerRadius !== undefined) hdr.screenCornerRadius = scr.cornerRadius;
        if (!hdr.screenBackgroundColor && scr.backgroundColor) hdr.screenBackgroundColor = scr.backgroundColor;
        if (hdr.autoScroll === undefined && scr.autoScroll !== undefined) hdr.autoScroll = scr.autoScroll;
        if (hdr.clipToScreen === undefined && scr.clipOverflow !== undefined) hdr.clipToScreen = scr.clipOverflow;
        if (hdr.scrollSmoothnessFrames === undefined && scr.scrollDurationFrames !== undefined) hdr.scrollSmoothnessFrames = scr.scrollDurationFrames;

        if (hdr.entranceAnimation === undefined && anim.animateEntrance !== undefined) hdr.entranceAnimation = anim.animateEntrance;
        if (hdr.growDuration === undefined && anim.bubbleGrowFrames !== undefined) hdr.growDuration = anim.bubbleGrowFrames;

        if (!hdr.sentColors && (cols.sentBubble || cols.sentText || cols.sentTime)) {
            hdr.sentColors = {
                bubble: cols.sentBubble,
                text: cols.sentText,
                time: cols.sentTime
            };
        }
        if (!hdr.receivedColors && (cols.receivedBubble || cols.receivedText || cols.receivedTime)) {
            hdr.receivedColors = {
                bubble: cols.receivedBubble,
                text: cols.receivedText,
                time: cols.receivedTime
            };
        }
        return hdr;
    }

    function normalizeConversationData(parsed) {
        if (!parsed || typeof parsed !== "object") return parsed;
        if (parsed.header) {
            normalizeConversationHeader(parsed.header);
        }
        if (parsed.messages && parsed.messages instanceof Array) {
            for (var i = 0; i < parsed.messages.length; i++) {
                var m = parsed.messages[i];
                if (!m) continue;
                if (!m.direction && (m.type === "sent" || m.type === "received")) {
                    m.direction = m.type;
                    m.type = m.dialogType || "text";
                }
                if (!m.textAnimation && m.textEffect && m.textEffect !== "none") {
                    var eff = String(m.textEffect).toLowerCase();
                    m.textAnimation = {
                        nod: eff === "nod",
                        shake: eff === "shake",
                        blink: eff === "blink"
                    };
                }
            }
        }
        return parsed;
    }

    function loadConversationFromFile(fileObj) {
        try {
            if (!fileObj || !fileObj.exists) return null;
            fileObj.encoding = "UTF-8";
            if (fileObj.open("r")) {
                var raw = fileObj.read();
                fileObj.close();
                if (raw && raw.length > 2) {
                    var parsed = JSONPolyfill.parse(raw);
                    if (isValidConversationObject(parsed)) {
                        return normalizeConversationData(parsed);
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    function scanConversations() {
        ensureConversationFiles();
        discoveredConversations = [];
        var seenNames = {};

        // 1. Scan /conversation/ folder for *.json files (excluding schema files)
        try {
            var folder = getConversationFolder();
            if (folder && folder.exists && typeof folder.getFiles === "function") {
                var files = folder.getFiles("*.json");
                if (files && files.length > 0) {
                    files.sort(function(a, b) {
                        return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1;
                    });
                    for (var i = 0; i < files.length; i++) {
                        var f = files[i];
                        if (!(f instanceof File)) continue;
                        var fName = decodeURI(f.name);
                        if (fName.toLowerCase().indexOf("schema") !== -1) continue;
                        var parsed = loadConversationFromFile(f);
                        if (parsed) {
                            var title = (parsed.header && (parsed.header.conversationTitle || parsed.header.title))
                                ? (parsed.header.conversationTitle || parsed.header.title)
                                : fName;
                            discoveredConversations.push({
                                fileName: fName,
                                label: fName + " — " + title,
                                filePath: f.fsName,
                                source: "folder",
                                data: parsed
                            });
                            seenNames[fName] = true;
                        }
                    }
                }
            }
        } catch (e) {}

        // 2. Also detect .json FootageItems imported directly in the After Effects Project panel
        try {
            if (typeof app !== "undefined" && app.project && app.project.numItems) {
                for (var pIdx = 1; pIdx <= app.project.numItems; pIdx++) {
                    var projItem = app.project.item(pIdx);
                    if (projItem && projItem.mainSource && projItem.file) {
                        var pName = decodeURI(projItem.file.name);
                        if (/\.json$/i.test(pName) && pName.toLowerCase().indexOf("schema") === -1 && pName.toLowerCase() !== "presets.json") {
                            if (!seenNames[pName]) {
                                var parsedProj = loadConversationFromFile(projItem.file);
                                if (parsedProj) {
                                    var pTitle = (parsedProj.header && (parsedProj.header.conversationTitle || parsedProj.header.title))
                                        ? (parsedProj.header.conversationTitle || parsedProj.header.title)
                                        : pName;
                                    discoveredConversations.push({
                                        fileName: pName,
                                        label: "[AE Project] " + pName + " — " + pTitle,
                                        filePath: projItem.file.fsName,
                                        source: "ae_project",
                                        data: parsedProj
                                    });
                                    seenNames[pName] = true;
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {}

        // 3. Fallback to built-in conversations if running in a sandboxed/virtual environment
        for (var defName in DEFAULT_CONVERSATIONS) {
            if (DEFAULT_CONVERSATIONS.hasOwnProperty(defName) && !seenNames[defName]) {
                var defData = normalizeConversationData(cloneObject(DEFAULT_CONVERSATIONS[defName]));
                var defTitle = (defData.header && (defData.header.conversationTitle || defData.header.title))
                    ? (defData.header.conversationTitle || defData.header.title)
                    : defName;
                discoveredConversations.push({
                    fileName: defName,
                    label: defName + " — " + defTitle,
                    filePath: getConversationFolder().fsName + "/" + defName,
                    source: "builtin",
                    data: defData
                });
                seenNames[defName] = true;
            }
        }

        return discoveredConversations;
    }

    function saveConversationToFile(convEntry, updatedHeader) {
        if (!convEntry || !convEntry.data) return false;
        convEntry.data.header = updatedHeader;
        DEFAULT_CONVERSATIONS[convEntry.fileName] = cloneObject(convEntry.data);
        try {
            var targetPath = convEntry.filePath || (getConversationFolder().fsName + "/" + convEntry.fileName);
            var f = new File(targetPath);
            f.encoding = "UTF-8";
            if (f.open("w")) {
                f.write(JSONPolyfill.stringify(convEntry.data, null, 2));
                f.close();
                return true;
            }
        } catch (e) {}
        return false;
    }

    function importConversationIntoAEProject(convEntry) {
        if (!convEntry) return null;
        try {
            if (!app.project) return null;
            var targetPath = convEntry.filePath || (getConversationFolder().fsName + "/" + convEntry.fileName);
            var f = new File(targetPath);
            if (!f.exists && convEntry.data) {
                f.encoding = "UTF-8";
                if (f.open("w")) {
                    f.write(JSONPolyfill.stringify(convEntry.data, null, 2));
                    f.close();
                }
            }
            if (!f.exists) return null;

            // Check if already imported in AE project
            for (var i = 1; i <= app.project.numItems; i++) {
                var item = app.project.item(i);
                if (item && item.file && item.file.fsName === f.fsName) {
                    return item;
                }
            }
            if (typeof ImportOptions !== "undefined") {
                var io = new ImportOptions(f);
                var imported = app.project.importFile(io);
                return imported;
            }
        } catch (e) {}
        return null;
    }

    // =========================================================================
    // 2C. TIMESTAMP & REAL / FAKE DELAY CALCULATION ENGINE
    // =========================================================================
    function parseTimeToMinutes(timeStr) {
        if (timeStr === undefined || timeStr === null) return 14 * 60 + 20;
        var s = String(timeStr).replace(/^\s+|\s+$/g, "");
        if (!s) return 14 * 60 + 20;

        var isPM = /pm/i.test(s);
        var isAM = /am/i.test(s);
        var clean = s.replace(/[^0-9:]/g, "");
        var parts = clean.split(":");
        var hh = parseInt(parts[0], 10);
        var mm = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        if (isNaN(hh)) hh = 14;
        if (isNaN(mm)) mm = 0;

        if (isPM && hh < 12) hh += 12;
        if (isAM && hh === 12) hh = 0;

        return ((hh * 60 + mm) % 1440 + 1440) % 1440;
    }

    function parseOffsetToMinutes(offsetStr) {
        if (offsetStr === undefined || offsetStr === null) return 1;
        if (typeof offsetStr === "number") return Math.round(offsetStr);
        var s = String(offsetStr).replace(/^\s+|\s+$/g, "");
        if (!s) return 1;
        var clean = s.replace(/^\+/, "").replace(/[^0-9:]/g, "");
        if (!clean) return 0;
        var parts = clean.split(":");
        if (parts.length >= 2) {
            var hh = parseInt(parts[0], 10) || 0;
            var mm = parseInt(parts[1], 10) || 0;
            return hh * 60 + mm;
        }
        var onlyMin = parseInt(parts[0], 10);
        return isNaN(onlyMin) ? 1 : onlyMin;
    }

    function formatMinutesToTime(totalMinutes, formatStr) {
        var mins = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
        var hh24 = Math.floor(mins / 60);
        var mm = mins % 60;
        var mmStr = (mm < 10 ? "0" : "") + mm;

        if (String(formatStr).toLowerCase() === "12h") {
            var suffix = hh24 >= 12 ? " PM" : " AM";
            var hh12 = hh24 % 12;
            if (hh12 === 0) hh12 = 12;
            return hh12 + ":" + mmStr + suffix;
        }
        var hhStr = (hh24 < 10 ? "0" : "") + hh24;
        return hhStr + ":" + mmStr;
    }

    function calculateReadDuration(text) {
        var cleanText = String(text || "").replace(/^\s+|\s+$/g, "");
        if (cleanText.length === 0) return 2.0;
        var words = cleanText.split(/\s+/).length;
        var wordTime = words * 0.30;
        var charTime = cleanText.length * 0.055;
        var readingTime = Math.max(wordTime, charTime);
        return Math.max(1.5, Math.round((readingTime + 0.8) * 10) / 10);
    }

    function getMessageDirection(m) {
        if (!m) return "sent";
        var d = m.direction || ((m.type === "sent" || m.type === "received") ? m.type : "sent");
        return (String(d).toLowerCase() === "received") ? "received" : "sent";
    }

    function computeConversationSchedule(conversationData, overrideHeader) {
        var hdr = normalizeConversationHeader(overrideHeader || (conversationData && conversationData.header) || {});
        var msgs = (conversationData && conversationData.messages instanceof Array) ? conversationData.messages : [];

        var initialTimeStr = hdr.initialTimestamp !== undefined ? String(hdr.initialTimestamp) : "14:20";
        var timeFormat = hdr.timeFormat === "12h" ? "12h" : "24h";
        var defaultRealDelay = (hdr.realDelayBetweenBubbles !== undefined && !isNaN(parseFloat(hdr.realDelayBetweenBubbles)))
            ? Math.max(0, parseFloat(hdr.realDelayBetweenBubbles))
            : 1.0;
        var defaultFakeDelayStr = hdr.fakeDelayBetweenBubbles !== undefined ? String(hdr.fakeDelayBetweenBubbles) : "+00:01";
        var defaultFakeOffsetMins = parseOffsetToMinutes(defaultFakeDelayStr);
        var groupConsecutive = hdr.groupConsecutive !== false;
        var globalShowTail = hdr.showTail !== false;

        var currentClockMins = parseTimeToMinutes(initialTimeStr);
        var currentTimelineSec = 0.25; // Slight breathing room at start of comp (0.25s)
        var schedule = [];

        for (var i = 0; i < msgs.length; i++) {
            var m = msgs[i] || {};
            var dir = getMessageDirection(m);
            var msgType = String(m.dialogType || ((m.type !== "sent" && m.type !== "received" && m.type) ? m.type : "text")).toLowerCase();
            var rawText = m.text !== undefined ? String(m.text) : "";
            if (msgType !== "text" && !rawText) {
                rawText = "[" + msgType.toUpperCase() + "]";
            }

            // 1. Real Delay calculation (seconds in AE timeline)
            var realDelayUsed = 0;
            if (i === 0) {
                if (m.realDelay !== undefined && m.realDelay !== null && !isNaN(parseFloat(m.realDelay))) {
                    realDelayUsed = Math.max(0, parseFloat(m.realDelay));
                    currentTimelineSec = realDelayUsed;
                } else {
                    realDelayUsed = 0;
                }
            } else {
                if (m.realDelay !== undefined && m.realDelay !== null && !isNaN(parseFloat(m.realDelay))) {
                    realDelayUsed = Math.max(0, parseFloat(m.realDelay));
                } else {
                    realDelayUsed = defaultRealDelay;
                }
                currentTimelineSec += realDelayUsed;
            }
            currentTimelineSec = Math.round(currentTimelineSec * 100) / 100;

            // 2. Fake Timestamp calculation (displayed clock time on bubble)
            var rawTsSpec = (m.timestamp !== undefined && m.timestamp !== null) ? String(m.timestamp).replace(/^\s+|\s+$/g, "") : "";
            var fakeMode = "auto";
            if (i === 0) {
                if (rawTsSpec.length > 0) {
                    if (rawTsSpec.charAt(0) === "+") {
                        currentClockMins += parseOffsetToMinutes(rawTsSpec);
                        fakeMode = "relative (" + rawTsSpec + ")";
                    } else {
                        currentClockMins = parseTimeToMinutes(rawTsSpec);
                        fakeMode = "direct (" + rawTsSpec + ")";
                    }
                } else {
                    fakeMode = "initial (" + initialTimeStr + ")";
                }
            } else {
                if (rawTsSpec.length > 0) {
                    if (rawTsSpec.charAt(0) === "+") {
                        currentClockMins += parseOffsetToMinutes(rawTsSpec);
                        fakeMode = "relative (" + rawTsSpec + ")";
                    } else {
                        currentClockMins = parseTimeToMinutes(rawTsSpec);
                        fakeMode = "direct (" + rawTsSpec + ")";
                    }
                } else {
                    currentClockMins += defaultFakeOffsetMins;
                    fakeMode = "auto (" + defaultFakeDelayStr + ")";
                }
            }

            var formattedTime = formatMinutesToTime(currentClockMins, timeFormat);

            // 3. Tail & consecutive grouping logic
            var nextMsg = (i + 1 < msgs.length) ? msgs[i + 1] : null;
            var nextDir = nextMsg ? getMessageDirection(nextMsg) : null;
            var isLastInCluster = (nextDir !== dir);
            var bubbleShowTail = globalShowTail;
            if ( m.showTail !== undefined && m.showTail !== null ) {
                bubbleShowTail = !!m.showTail;
            } else if (groupConsecutive && !isLastInCluster) {
                bubbleShowTail = false;
            }

            var bubbleShowStatus = (hdr.showStatus !== false) && (dir === "sent");
            if (m.showStatus !== undefined && m.showStatus !== null) {
                bubbleShowStatus = !!m.showStatus && (dir === "sent");
            }

            schedule.push({
                index: i,
                id: m.id || ("msg_" + (i < 9 ? "0" : "") + (i + 1)),
                type: msgType,
                direction: dir,
                text: rawText,
                startTime: currentTimelineSec,
                realDelayUsed: realDelayUsed,
                hasCustomRealDelay: (m.realDelay !== undefined && m.realDelay !== null),
                rawTimestampSpec: rawTsSpec,
                fakeMode: fakeMode,
                formattedTimestamp: formattedTime,
                clockMinutes: currentClockMins,
                showTail: bubbleShowTail,
                showStatus: bubbleShowStatus,
                textAnimation: m.textAnimation || null,
                rcsPayload: m.rcs || null
            });
        }

        return schedule;
    }

    // =========================================================================
    // 3. STATIC SHAPE GENERATORS & DYNAMIC EXPRESSIONS
    // =========================================================================
    function computeScreenRectData(w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        var k = 0.55228475;
        var kr = r * k;
        var hw = w / 2;
        var hh = h / 2;
        var v = [
            [-hw + r, -hh],
            [hw - r, -hh],
            [hw, -hh + r],
            [hw, hh - r],
            [hw - r, hh],
            [-hw + r, hh],
            [-hw, hh - r],
            [-hw, -hh + r]
        ];
        var iT = [
            [-kr, 0], [0, 0], [0, -kr], [0, 0],
            [kr, 0],  [0, 0], [0, kr],  [0, 0]
        ];
        var oT = [
            [0, 0], [kr, 0],  [0, 0], [0, kr],
            [0, 0], [-kr, 0], [0, 0], [0, -kr]
        ];
        return { v: v, i: iT, o: oT };
    }

    function computeShapeData(w, h, r, showTail, isSent, tailStyleNum) {
        r = Math.min(r, w / 2, h / 2);
        var k = 0.55228475;
        var kr = r * k;
        var v = [], iT = [], oT = [];

        if (!showTail || tailStyleNum === 3) {
            v = [[r,0],[w-r,0],[w,r],[w,h-r],[w-r,h],[r,h],[0,h-r],[0,r]];
            iT = [[-kr,0],[0,0],[0,-kr],[0,0],[kr,0],[0,0],[0,kr],[0,0]];
            oT = [[0,0],[kr,0],[0,0],[0,kr],[0,0],[-kr,0],[0,0],[0,-kr]];
        } else if (isSent) {
            if (tailStyleNum === 2) {
                var tw = 12, th = 16;
                v = [[r,0],[w-r,0],[w,r],[w,h-th],[w+tw,h],[w-r,h],[r,h],[0,h-r],[0,r]];
                iT = [[-kr,0],[0,0],[0,-kr],[0,0],[-2,-4],[4,0],[0,0],[0,kr],[0,0]];
                oT = [[0,0],[kr,0],[0,0],[0,6],[-4,2],[0,0],[-kr,0],[0,0],[0,-kr]];
            } else {
                var tw = 10, th = 18;
                v = [[r,0],[w-r,0],[w,r],[w,h-th],[w+tw,h],[w-r,h],[r,h],[0,h-r],[0,r]];
                iT = [[-kr,0],[0,0],[0,-kr],[0,0],[-2,-6],[5,2],[0,0],[0,kr],[0,0]];
                oT = [[0,0],[kr,0],[0,0],[0,8],[-6,2],[0,0],[-kr,0],[0,0],[0,-kr]];
            }
        } else {
            if (tailStyleNum === 2) {
                var tw = 12, th = 16;
                v = [[r,0],[w-r,0],[w,r],[w,h-r],[w-r,h],[0,h],[-tw,h],[0,h-th],[0,r]];
                iT = [[-kr,0],[0,0],[0,-kr],[0,0],[kr,0],[0,0],[4,2],[2,-4],[0,0]];
                oT = [[0,0],[kr,0],[0,0],[0,kr],[0,0],[-4,0],[2,-4],[0,-6],[0,-kr]];
            } else {
                var tw = 10, th = 18;
                v = [[r,0],[w-r,0],[w,r],[w,h-r],[w-r,h],[r,h],[-tw,h],[0,h-th],[0,r]];
                iT = [[-kr,0],[0,0],[0,-kr],[0,0],[kr,0],[0,0],[6,2],[2,-6],[0,0]];
                oT = [[0,0],[kr,0],[0,0],[0,kr],[0,0],[-5,2],[2,-6],[0,-8],[0,-kr]];
            }
        }
        return { v: v, i: iT, o: oT };
    }

    var SCREEN_PATH_EXPR = [
        "try {",
        "    var ctrl = thisComp.layer('Chat_Master_Controller');",
        "    var w = Math.max(100, ctrl.effect('Screen Width')('Slider'));",
        "    var h = Math.max(100, ctrl.effect('Screen Height')('Slider'));",
        "    var r = Math.max(0, ctrl.effect('Screen Corner Radius')('Slider'));",
        "    r = Math.min(r, w / 2, h / 2);",
        "    var k = 0.55228475;",
        "    var kr = r * k;",
        "    var hw = w / 2;",
        "    var hh = h / 2;",
        "    var v = [[-hw+r,-hh],[hw-r,-hh],[hw,-hh+r],[hw,hh-r],[hw-r,hh],[-hw+r,hh],[-hw,hh-r],[-hw,-hh+r]];",
        "    var i = [[-kr,0],[0,0],[0,-kr],[0,0],[kr,0],[0,0],[0,kr],[0,0]];",
        "    var o = [[0,0],[kr,0],[0,0],[0,kr],[0,0],[-kr,0],[0,0],[0,-kr]];",
        "    createPath(v, i, o, true);",
        "} catch(e) { value; }"
    ].join("\n");

    var SCREEN_OPACITY_EXPR = [
        "try {",
        "    var ctrl = thisComp.layer('Chat_Master_Controller');",
        "    var vis = ctrl.effect('Show Chat Screen')('Checkbox') == 1;",
        "    var op = Math.max(0, Math.min(100, ctrl.effect('Screen Opacity')('Slider')));",
        "    vis ? op : 0;",
        "} catch(e) { value; }"
    ].join("\n");

    function buildScrollControllerExpr(bubbleScheduleMeta) {
        // bubbleScheduleMeta: [{ startTime: 0.25, bottomEdgeRelTop: 140 }, ...]
        var startsArr = [];
        var bottomsArr = [];
        for (var i = 0; i < bubbleScheduleMeta.length; i++) {
            startsArr.push(bubbleScheduleMeta[i].startTime);
            bottomsArr.push(Math.round(bubbleScheduleMeta[i].bottomEdgeRelTop));
        }
        return [
            "try {",
            "    var ctrl = thisComp.layer('Chat_Master_Controller');",
            "    var autoScroll = ctrl.effect('Auto Scroll on Overflow')('Checkbox') == 1;",
            "    var manualOffset = ctrl.effect('Manual Scroll Offset Y')('Slider');",
            "    var screenH = ctrl.effect('Screen Height')('Slider');",
            "    var screenPad = ctrl.effect('Screen Inner Padding')('Slider');",
            "    var smoothFrames = Math.max(1, ctrl.effect('Scroll Smoothness (frames)')('Slider'));",
            "    var dur = smoothFrames * thisComp.frameDuration;",
            "    var viewportH = Math.max(100, screenH - 2 * screenPad);",
            "    var starts = [" + startsArr.join(",") + "];",
            "    var bottoms = [" + bottomsArr.join(",") + "];",
            "    var scrollY = 0;",
            "    if (autoScroll && starts.length > 0) {",
            "        var prevScroll = 0;",
            "        for (var i = 0; i < starts.length; i++) {",
            "            var targetScroll = Math.max(0, bottoms[i] - viewportH);",
            "            if (time >= starts[i]) {",
            "                var elapsed = time - starts[i];",
            "                if (elapsed < dur && dur > 0) {",
            "                    var p = elapsed / dur;",
            "                    var ease = 1 - Math.pow(1 - p, 3);",
            "                    scrollY = prevScroll + (targetScroll - prevScroll) * ease;",
            "                } else {",
            "                    scrollY = targetScroll;",
            "                }",
            "                prevScroll = targetScroll;",
            "            }",
            "        }",
            "    }",
            "    [0, -scrollY + manualOffset, 0];",
            "} catch(e) { value; }"
        ].join("\n");
    }

    var BUBBLE_PRECOMP_OPACITY_EXPR = [
        "try {",
        "    var ctrl = thisComp.layer('Chat_Master_Controller');",
        "    var clip = ctrl.effect('Clip Bubbles Outside Screen')('Checkbox') == 1;",
        "    if (!clip) {",
        "        100;",
        "    } else {",
        "        var screenH = ctrl.effect('Screen Height')('Slider');",
        "        var screenPad = ctrl.effect('Screen Inner Padding')('Slider');",
        "        var scrollPos = thisComp.layer('Chat_Scroll_Controller').transform.position;",
        "        var relY = transform.position[1] + scrollPos[1];",
        "        var halfScreen = screenH / 2 - screenPad * 0.35;",
        "        var fadeZone = Math.max(24, screenPad * 0.9);",
        "        var distTop = (relY + halfScreen);",
        "        var distBot = (halfScreen - relY);",
        "        if (distTop < -fadeZone || distBot < -fadeZone) {",
        "            0;",
        "        } else if (distTop < fadeZone) {",
        "            Math.max(0, Math.min(100, ((distTop + fadeZone) / (2 * fadeZone)) * 100));",
        "        } else if (distBot < fadeZone) {",
        "            Math.max(0, Math.min(100, ((distBot + fadeZone) / (2 * fadeZone)) * 100));",
        "        } else {",
        "            100;",
        "        }",
        "    }",
        "} catch(e) { 100; }"
    ].join("\n");

    var PATH_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var txt = thisComp.layer('Message_Text');",
        "var pad = ctrl.effect('Inner Padding')('Slider');",
        "var r = ctrl.effect('Corner Radius')('Slider');",
        "var showTail = ctrl.effect('Show Tail')('Checkbox') == 1;",
        "var isSent = ctrl.effect('Is Sent (Right)')('Checkbox') == 1;",
        "var tailStyle = Math.round(ctrl.effect('Tail Style (1=iOS,2=WA,3=None)')('Slider'));",
        "var showTime = ctrl.effect('Show Timecode')('Checkbox') == 1;",
        "var showStat = ctrl.effect('Show Status')('Checkbox') == 1;",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var rect = txt.sourceRectAtTime(Math.max(startT + 5, time), false);",
        "var extraH = (showTime || (showStat && isSent)) ? 26 : 0;",
        "var minW = (showTime || (showStat && isSent)) ? 140 : 60;",
        "var w = Math.max(rect.width + pad * 2, minW);",
        "var h = Math.max(rect.height + pad * 2 + extraH, 50);",
        "r = Math.min(r, w / 2, h / 2);",
        "var k = 0.55228475;",
        "var kr = r * k;",
        "var v = [], i = [], o = [];",
        "if (!showTail || tailStyle == 3) {",
        "    v = [[r,0],[w-r,0],[w,r],[w,h-r],[w-r,h],[r,h],[0,h-r],[0,r]];",
        "    i = [[-kr,0],[0,0],[0,-kr],[0,0],[kr,0],[0,0],[0,kr],[0,0]];",
        "    o = [[0,0],[kr,0],[0,0],[0,kr],[0,0],[-kr,0],[0,0],[0,-kr]];",
        "} else if (isSent) {",
        "    if (tailStyle == 2) {",
        "        var tw = 12, th = 16;",
        "        v = [[r,0],[w-r,0],[w,r],[w,h-th],[w+tw,h],[w-r,h],[r,h],[0,h-r],[0,r]];",
        "        i = [[-kr,0],[0,0],[0,-kr],[0,0],[-2,-4],[4,0],[0,0],[0,kr],[0,0]];",
        "        o = [[0,0],[kr,0],[0,0],[0,6],[-4,2],[0,0],[-kr,0],[0,0],[0,-kr]];",
        "    } else {",
        "        var tw = 10, th = 18;",
        "        v = [[r,0],[w-r,0],[w,r],[w,h-th],[w+tw,h],[w-r,h],[r,h],[0,h-r],[0,r]];",
        "        i = [[-kr,0],[0,0],[0,-kr],[0,0],[-2,-6],[5,2],[0,0],[0,kr],[0,0]];",
        "        o = [[0,0],[kr,0],[0,0],[0,8],[-6,2],[0,0],[-kr,0],[0,0],[0,-kr]];",
        "    }",
        "} else {",
        "    if (tailStyle == 2) {",
        "        var tw = 12, th = 16;",
        "        v = [[r,0],[w-r,0],[w,r],[w,h-r],[w-r,h],[0,h],[-tw,h],[0,h-th],[0,r]];",
        "        i = [[-kr,0],[0,0],[0,-kr],[0,0],[kr,0],[0,0],[4,2],[2,-4],[0,0]];",
        "        o = [[0,0],[kr,0],[0,0],[0,kr],[0,0],[-4,0],[2,-4],[0,-6],[0,-kr]];",
        "    } else {",
        "        var tw = 10, th = 18;",
        "        v = [[r,0],[w-r,0],[w,r],[w,h-r],[w-r,h],[r,h],[-tw,h],[0,h-th],[0,r]];",
        "        i = [[-kr,0],[0,0],[0,-kr],[0,0],[kr,0],[0,0],[6,2],[2,-6],[0,0]];",
        "        o = [[0,0],[kr,0],[0,0],[0,kr],[0,0],[-5,2],[2,-6],[0,-8],[0,-kr]];",
        "    }",
        "}",
        "createPath(v, i, o, true);",
        "} catch(err) { value; }"
    ].join("\n");

    var BUBBLE_ANCHOR_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var txt = thisComp.layer('Message_Text');",
        "var pad = ctrl.effect('Inner Padding')('Slider');",
        "var isSent = ctrl.effect('Is Sent (Right)')('Checkbox') == 1;",
        "var showTime = ctrl.effect('Show Timecode')('Checkbox') == 1;",
        "var showStat = ctrl.effect('Show Status')('Checkbox') == 1;",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var rect = txt.sourceRectAtTime(Math.max(startT + 5, time), false);",
        "var extraH = (showTime || (showStat && isSent)) ? 26 : 0;",
        "var minW = (showTime || (showStat && isSent)) ? 140 : 60;",
        "var w = Math.max(rect.width + pad * 2, minW);",
        "var h = Math.max(rect.height + pad * 2 + extraH, 50);",
        "isSent ? [w, h] : [0, h];",
        "} catch(e) { value; }"
    ].join("\n");

    var BUBBLE_POS_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var txt = thisComp.layer('Message_Text');",
        "var pad = ctrl.effect('Inner Padding')('Slider');",
        "var isSent = ctrl.effect('Is Sent (Right)')('Checkbox') == 1;",
        "var showTime = ctrl.effect('Show Timecode')('Checkbox') == 1;",
        "var showStat = ctrl.effect('Show Status')('Checkbox') == 1;",
        "var trackW = 0; try { trackW = ctrl.effect('Chat Track Width')('Slider'); } catch(e){}",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var rect = txt.sourceRectAtTime(Math.max(startT + 5, time), false);",
        "var extraH = (showTime || (showStat && isSent)) ? 26 : 0;",
        "var minW = (showTime || (showStat && isSent)) ? 140 : 60;",
        "var w = Math.max(rect.width + pad * 2, minW);",
        "var h = Math.max(rect.height + pad * 2 + extraH, 50);",
        "if (trackW > 0) {",
        "    isSent ? [trackW / 2, h / 2] : [-trackW / 2, h / 2];",
        "} else {",
        "    isSent ? [w / 2, h / 2] : [-w / 2, h / 2];",
        "}",
        "} catch(e) { value; }"
    ].join("\n");

    var BUBBLE_GROW_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    [0, 0];",
        "} else {",
        "    var doAnim = ctrl.effect('Entrance Animation')('Checkbox') == 1;",
        "    var durFrames = Math.max(1, ctrl.effect('Grow Duration (frames)')('Slider'));",
        "    var dur = durFrames * thisComp.frameDuration;",
        "    if (!doAnim) {",
        "        value;",
        "    } else if (localT < dur) {",
        "        var p = localT / dur;",
        "        var c1 = 1.70158;",
        "        var c3 = c1 + 1;",
        "        var s = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);",
        "        [value[0] * s, value[1] * s];",
        "    } else {",
        "        value;",
        "    }",
        "}",
        "} catch(e) { value; }"
    ].join("\n");

    var BUBBLE_OPACITY_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    0;",
        "} else {",
        "    var doAnim = ctrl.effect('Entrance Animation')('Checkbox') == 1;",
        "    var durFrames = Math.max(1, ctrl.effect('Grow Duration (frames)')('Slider'));",
        "    var dur = Math.min(durFrames * 0.6, 8) * thisComp.frameDuration;",
        "    if (!doAnim) {",
        "        100;",
        "    } else {",
        "        linear(localT, 0, dur, 0, 100);",
        "    }",
        "}",
        "} catch(e) { value; }"
    ].join("\n");

    var DYNAMIC_WRAP_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    '';",
        "} else {",
        "    var doWrap = ctrl.effect('Auto Wrap Text')('Checkbox') == 1;",
        "    var maxW = Math.max(80, ctrl.effect('Max Bubble Width')('Slider'));",
        "    var pad = ctrl.effect('Inner Padding')('Slider');",
        "    var doAnim = ctrl.effect('Entrance Animation')('Checkbox') == 1;",
        "    var speed = ctrl.effect('Typewriter Speed')('Slider');",
        "    var growFrames = ctrl.effect('Grow Duration (frames)')('Slider');",
        "    var raw = value.toString();",
        "    var fs = 42;",
        "    try { fs = style.fontSize; } catch(e) {}",
        "    var availW = Math.max(60, maxW - pad * 2);",
        "    var charW = fs * 0.50;",
        "    var maxChars = Math.max(5, Math.floor(availW / charW));",
        "    var wrapped = raw;",
        "    if (doWrap) {",
        "        var paragraphs = raw.split(/\\r\\n|\\r|\\n/);",
        "        var outLines = [];",
        "        for (var p = 0; p < paragraphs.length; p++) {",
        "            var words = paragraphs[p].split(' ');",
        "            var cur = '';",
        "            for (var i = 0; i < words.length; i++) {",
        "                var w = words[i];",
        "                var test = cur.length === 0 ? w : cur + ' ' + w;",
        "                if (test.length > maxChars && cur.length > 0) {",
        "                    outLines.push(cur);",
        "                    cur = w;",
        "                } else {",
        "                    cur = test;",
        "                }",
        "            }",
        "            outLines.push(cur);",
        "        }",
        "        wrapped = outLines.join('\\r');",
        "    }",
        "    if (doAnim && speed > 0) {",
        "        var delay = (growFrames * 0.45) * thisComp.frameDuration;",
        "        var t = Math.max(0, localT - delay);",
        "        var count = Math.floor(t * speed);",
        "        wrapped.substring(0, count);",
        "    } else {",
        "        wrapped;",
        "    }",
        "}",
        "} catch(e) { value; }"
    ].join("\n");

    var TIMECODE_POS_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var txt = thisComp.layer('Message_Text');",
        "var pad = ctrl.effect('Inner Padding')('Slider');",
        "var isSent = ctrl.effect('Is Sent (Right)')('Checkbox') == 1;",
        "var showTime = ctrl.effect('Show Timecode')('Checkbox') == 1;",
        "var showStat = ctrl.effect('Show Status')('Checkbox') == 1;",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var rect = txt.sourceRectAtTime(Math.max(startT + 5, time), false);",
        "var extraH = (showTime || (showStat && isSent)) ? 26 : 0;",
        "var minW = (showTime || (showStat && isSent)) ? 140 : 60;",
        "var w = Math.max(rect.width + pad * 2, minW);",
        "var h = Math.max(rect.height + pad * 2 + extraH, 50);",
        "var statusOffset = (showStat && isSent) ? 38 : 0;",
        "[w - pad * 0.6 - statusOffset, h - 14];",
        "} catch(e) { value; }"
    ].join("\n");

    var TIMECODE_ENTRANCE_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    0;",
        "} else {",
        "    var show = ctrl.effect('Show Timecode')('Checkbox') == 1;",
        "    var doAnim = ctrl.effect('Entrance Animation')('Checkbox') == 1;",
        "    var durFrames = Math.max(1, ctrl.effect('Grow Duration (frames)')('Slider'));",
        "    var dur = durFrames * thisComp.frameDuration;",
        "    if (!show) { 0; }",
        "    else if (!doAnim) { 80; }",
        "    else { linear(localT, dur * 0.5, dur * 1.1, 0, 80); }",
        "}",
        "} catch(e) { 80; }"
    ].join("\n");

    var STATUS_POS_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var txt = thisComp.layer('Message_Text');",
        "var pad = ctrl.effect('Inner Padding')('Slider');",
        "var isSent = ctrl.effect('Is Sent (Right)')('Checkbox') == 1;",
        "var showTime = ctrl.effect('Show Timecode')('Checkbox') == 1;",
        "var showStat = ctrl.effect('Show Status')('Checkbox') == 1;",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var rect = txt.sourceRectAtTime(Math.max(startT + 5, time), false);",
        "var extraH = (showTime || (showStat && isSent)) ? 26 : 0;",
        "var minW = (showTime || (showStat && isSent)) ? 140 : 60;",
        "var w = Math.max(rect.width + pad * 2, minW);",
        "var h = Math.max(rect.height + pad * 2 + extraH, 50);",
        "[w - pad * 0.55, h - 14];",
        "} catch(e) { value; }"
    ].join("\n");

    var POS_ANIM_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = Math.max(0, time - startT);",
        "var doNod = ctrl.effect('Anim: Nod')('Checkbox') == 1;",
        "var doShake = ctrl.effect('Anim: Shake')('Checkbox') == 1;",
        "var freq = ctrl.effect('Anim Speed')('Slider');",
        "var amp = ctrl.effect('Anim Intensity')('Slider');",
        "var decay = ctrl.effect('Anim Decay (0=Loop)')('Slider');",
        "var delay = 0.05;",
        "var t = Math.max(0, localT - textIndex * delay);",
        "var env = (decay > 0) ? Math.exp(-decay * t) : 1;",
        "var x = doShake ? Math.sin(t * freq * Math.PI * 2) * amp * env : 0;",
        "var y = doNod ? -Math.abs(Math.sin(t * freq * Math.PI)) * amp * env : 0;",
        "[x, y, 0];",
        "} catch(e) { [0,0,0]; }"
    ].join("\n");

    var SCALE_ANIM_EXPR = "[100, 100, 100];";

    var ROT_ANIM_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = Math.max(0, time - startT);",
        "var doShake = ctrl.effect('Anim: Shake')('Checkbox') == 1;",
        "var freq = ctrl.effect('Anim Speed')('Slider');",
        "var amp = ctrl.effect('Anim Intensity')('Slider');",
        "var decay = ctrl.effect('Anim Decay (0=Loop)')('Slider');",
        "var delay = 0.04;",
        "var t = Math.max(0, localT - textIndex * delay);",
        "var env = (decay > 0) ? Math.exp(-decay * t) : 1;",
        "doShake ? Math.cos(t * freq * Math.PI * 2) * (amp * 0.25) * env : 0;",
        "} catch(e) { 0; }"
    ].join("\n");

    var OPACITY_ANIM_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    0;",
        "} else {",
        "    var doBlink = ctrl.effect('Anim: Blink')('Checkbox') == 1;",
        "    var freq = ctrl.effect('Anim Speed')('Slider');",
        "    var delay = 0.06;",
        "    var t = Math.max(0, localT - textIndex * delay);",
        "    doBlink ? ((Math.sin(t * freq * Math.PI * 2) + 1) * 45 + 10) : 100;",
        "}",
        "} catch(e) { 100; }"
    ].join("\n");

    var STATUS_TEXT_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = Math.max(0, time - startT);",
        "var tDeliv = ctrl.effect('Sent -> Delivered (s)')('Slider');",
        "var style = Math.round(ctrl.effect('Status Style (1=Std,2=RCS)')('Slider'));",
        "if (style == 2) {",
        "    (localT < tDeliv) ? '○✓' : '○✓ ○✓';",
        "} else {",
        "    (localT < tDeliv) ? '✓' : '✓✓';",
        "}",
        "} catch(e) { value; }"
    ].join("\n");

    var STATUS_COLOR_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = Math.max(0, time - startT);",
        "var tDeliv = ctrl.effect('Sent -> Delivered (s)')('Slider');",
        "var tRead = tDeliv + ctrl.effect('Delivered -> Read (s)')('Slider');",
        "var cUnread = ctrl.effect('Status Base Color')('Color');",
        "var cRead = ctrl.effect('Status Read Color')('Color');",
        "linear(localT, tRead, tRead + 0.18, cUnread, cRead);",
        "} catch(e) { value; }"
    ].join("\n");

    var STATUS_SCALE_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    [0, 0];",
        "} else {",
        "    var tDeliv = ctrl.effect('Sent -> Delivered (s)')('Slider');",
        "    var tRead = tDeliv + ctrl.effect('Delivered -> Read (s)')('Slider');",
        "    var s = 100;",
        "    if (localT >= tDeliv && localT < tDeliv + 0.22) {",
        "        s = 100 + Math.sin(((localT - tDeliv) / 0.22) * Math.PI) * 28;",
        "    } else if (localT >= tRead && localT < tRead + 0.22) {",
        "        s = 100 + Math.sin(((localT - tRead) / 0.22) * Math.PI) * 28;",
        "    }",
        "    [s, s];",
        "}",
        "} catch(e) { value; }"
    ].join("\n");

    var STATUS_TEXT_OPACITY_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    0;",
        "} else {",
        "    var show = (ctrl.effect('Show Status')('Checkbox') == 1) && (ctrl.effect('Is Sent (Right)')('Checkbox') == 1);",
        "    var style = Math.round(ctrl.effect('Status Style (1=Std,2=RCS)')('Slider'));",
        "    (show && style != 2) ? 95 : 0;",
        "}",
        "} catch(e) { 0; }"
    ].join("\n");

    var STATUS_RCS_OPACITY_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) {",
        "    0;",
        "} else {",
        "    var show = (ctrl.effect('Show Status')('Checkbox') == 1) && (ctrl.effect('Is Sent (Right)')('Checkbox') == 1);",
        "    var style = Math.round(ctrl.effect('Status Style (1=Std,2=RCS)')('Slider'));",
        "    (show && style == 2) ? 95 : 0;",
        "}",
        "} catch(e) { 0; }"
    ].join("\n");

    var RCS_LEFT_CIRCLE_POS_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = Math.max(0, time - startT);",
        "var tDeliv = ctrl.effect('Sent -> Delivered (s)')('Slider');",
        "var sz = ctrl.effect('Text Size')('Slider') * 0.42;",
        "var r = sz * 0.36;",
        "(localT < tDeliv) ? [-r, -r] : [-(r * 2.55), -r];",
        "} catch(e) { value; }"
    ].join("\n");

    var RCS_RIGHT_CIRCLE_POS_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var sz = ctrl.effect('Text Size')('Slider') * 0.42;",
        "var r = sz * 0.36;",
        "[-r, -r];",
        "} catch(e) { value; }"
    ].join("\n");

    var RCS_CIRCLE_PATH_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var sz = ctrl.effect('Text Size')('Slider') * 0.42;",
        "var r = sz * 0.36;",
        "var k = r * 0.55228475;",
        "createPath([[0,-r],[r,0],[0,r],[-r,0]], [[-k,0],[0,-k],[k,0],[0,k]], [[k,0],[0,k],[-k,0],[0,-k]], true);",
        "} catch(e) { value; }"
    ].join("\n");

    var RCS_LEFT_TICK_PATH_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = Math.max(0, time - startT);",
        "var tDeliv = ctrl.effect('Sent -> Delivered (s)')('Slider');",
        "var sz = ctrl.effect('Text Size')('Slider') * 0.42;",
        "var r = sz * 0.36;",
        "var cx = (localT < tDeliv) ? -r : -(r * 2.55);",
        "var cy = -r;",
        "createPath([[cx - r*0.42, cy + r*0.02], [cx - r*0.10, cy + r*0.34], [cx + r*0.45, cy - r*0.30]], [], [], false);",
        "} catch(e) { value; }"
    ].join("\n");

    var RCS_RIGHT_TICK_PATH_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var sz = ctrl.effect('Text Size')('Slider') * 0.42;",
        "var r = sz * 0.36;",
        "var cx = -r;",
        "var cy = -r;",
        "createPath([[cx - r*0.42, cy + r*0.02], [cx - r*0.10, cy + r*0.34], [cx + r*0.45, cy - r*0.30]], [], [], false);",
        "} catch(e) { value; }"
    ].join("\n");

    var RCS_RIGHT_OPACITY_EXPR = [
        "try {",
        "var ctrl = thisComp.layer('Bubble_Controller');",
        "var startT = 0; try { startT = ctrl.effect('Start Time (s)')('Slider'); } catch(e){}",
        "var localT = time - startT;",
        "if (localT < 0) { 0; } else {",
        "    var tDeliv = ctrl.effect('Sent -> Delivered (s)')('Slider');",
        "    (localT < tDeliv) ? 0 : 100;",
        "}",
        "} catch(e) { 0; }"
    ].join("\n");

    // =========================================================================
    // 4. UI CONSTRUCTION (ScriptUI Panel — 5 Tabs + Top Conversation Pull-Down)
    // =========================================================================
    function createUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Scripted Chat Generator v1.0", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 10;

        // Scan conversations before building dropdown
        scanConversations();

        // State Colors (RGB 0..1)
        var stateColors = {
            sentBubble:     hexToRgb("#D3E3FD"),
            sentText:       hexToRgb("#041E49"),
            sentTime:       hexToRgb("#444746"),
            sentCheck:      hexToRgb("#0B57D0"),
            receivedBubble: hexToRgb("#F1F3F4"),
            receivedText:   hexToRgb("#1F1F1F"),
            receivedTime:   hexToRgb("#5E5E5E"),
            screenBg:       hexToRgb("#F8F9FA")
        };

        var currentConversationIndex = 0;

        function bindSliderEdit(slider, editText, isFloat, onChangeCallback) {
            slider.onChanging = function () {
                var val = isFloat ? (Math.round(this.value * 10) / 10) : Math.round(this.value);
                editText.text = String(val);
            };
            slider.onChange = function () {
                var val = isFloat ? (Math.round(this.value * 10) / 10) : Math.round(this.value);
                editText.text = String(val);
                if (typeof onChangeCallback === "function") onChangeCallback(val);
            };
            editText.onChange = function () {
                var parsed = isFloat ? parseFloat(this.text) : parseInt(this.text, 10);
                if (isNaN(parsed)) {
                    parsed = isFloat ? (Math.round(slider.value * 10) / 10) : Math.round(slider.value);
                } else {
                    if (parsed < slider.minvalue) parsed = slider.minvalue;
                    if (parsed > slider.maxvalue) parsed = slider.maxvalue;
                }
                slider.value = parsed;
                this.text = String(parsed);
                if (typeof onChangeCallback === "function") onChangeCallback(parsed);
            };
        }

        function setBtnColorSwatch(btn, rgb) {
            try {
                var g = btn.graphics;
                g.backgroundColor = g.newBrush(g.BrushType.SOLID_COLOR, [rgb[0], rgb[1], rgb[2], 1]);
            } catch (e) {}
            btn.text = rgbToHex(rgb);
        }

        // -----------------------------------------------------------------
        // TOP BAR: CONVERSATION PULL-DOWN ("conversation" subfolder)
        // -----------------------------------------------------------------
        var pnlTopConv = win.add("panel", undefined, "Conversation (.JSON in /conversation/)");
        pnlTopConv.orientation = "column";
        pnlTopConv.alignChildren = ["fill", "top"];
        pnlTopConv.spacing = 5;
        pnlTopConv.margins = [10, 14, 10, 8];

        var grpConvRow = pnlTopConv.add("group");
        grpConvRow.orientation = "row";
        grpConvRow.alignChildren = ["fill", "center"];
        grpConvRow.spacing = 4;

        var convLabels = [];
        for (var ci = 0; ci < discoveredConversations.length; ci++) {
            convLabels.push(discoveredConversations[ci].label);
        }
        if (convLabels.length === 0) convLabels.push("(No conversations found)");

        var dropConversation = grpConvRow.add("dropdownlist", undefined, convLabels);
        dropConversation.selection = 0;
        dropConversation.alignment = ["fill", "center"];
        dropConversation.helpTip = "Select a scripted conversation .JSON from the 'conversation' subfolder or AE Project";

        var btnReloadConv = grpConvRow.add("button", undefined, "\u21BB");
        btnReloadConv.preferredSize = [28, 24];
        btnReloadConv.alignment = ["right", "center"];
        btnReloadConv.helpTip = "Rescan the 'conversation' subfolder and reload .JSON files";

        var btnOpenConvFolder = grpConvRow.add("button", undefined, "\uD83D\uDCC2");
        btnOpenConvFolder.preferredSize = [28, 24];
        btnOpenConvFolder.alignment = ["right", "center"];
        btnOpenConvFolder.helpTip = "Open the 'conversation' subfolder to edit or add .JSON files";

        var btnImportJSONToAE = grpConvRow.add("button", undefined, "\uD83D\uDCE5");
        btnImportJSONToAE.preferredSize = [28, 24];
        btnImportJSONToAE.alignment = ["right", "center"];
        btnImportJSONToAE.helpTip = "Import the selected .JSON file directly into the After Effects Project panel";

        var btnSaveHeaderToJSON = grpConvRow.add("button", undefined, "\uD83D\uDCBE");
        btnSaveHeaderToJSON.preferredSize = [28, 24];
        btnSaveHeaderToJSON.alignment = ["right", "center"];
        btnSaveHeaderToJSON.helpTip = "Save current UI header settings back into the selected conversation .JSON file";

        var txtConvMeta = pnlTopConv.add("statictext", undefined, "Ready — 0 messages");
        txtConvMeta.alignment = ["fill", "center"];

        // -----------------------------------------------------------------
        // TABBED PANEL
        // -----------------------------------------------------------------
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "fill"];
        tpanel.alignment = ["fill", "fill"];

        // =================================================================
        // TAB 1: CHAT & TIMING (Platform, Timestamps, Real vs Fake Delays)
        // =================================================================
        var tabChat = tpanel.add("tab", undefined, "Chat & Timing");
        tabChat.orientation = "column";
        tabChat.alignChildren = ["fill", "top"];
        tabChat.spacing = 6;
        tabChat.margins = 8;

        // 1A. Platform & Theme
        var pnlPlat = tabChat.add("panel", undefined, "Platform & Theme (Header Settings)");
        pnlPlat.orientation = "column";
        pnlPlat.alignChildren = ["fill", "top"];
        pnlPlat.spacing = 5;
        pnlPlat.margins = [10, 14, 10, 8];

        var grpPlat = pnlPlat.add("group");
        grpPlat.orientation = "row";
        grpPlat.alignChildren = ["left", "center"];
        grpPlat.add("statictext", undefined, "Platform:");
        var dropPlatform = grpPlat.add("dropdownlist", undefined, platformKeys);
        dropPlatform.selection = 0;
        dropPlatform.alignment = ["fill", "center"];

        var btnOpenPresets = grpPlat.add("button", undefined, "\uD83D\uDCC2");
        btnOpenPresets.preferredSize = [28, 24];
        btnOpenPresets.alignment = ["right", "center"];
        btnOpenPresets.helpTip = "Open 'message bubble presets' folder";

        var grpThemeRow = pnlPlat.add("group");
        grpThemeRow.orientation = "row";
        grpThemeRow.alignChildren = ["left", "center"];
        grpThemeRow.spacing = 12;
        grpThemeRow.add("statictext", undefined, "Theme:");
        var radLight = grpThemeRow.add("radiobutton", undefined, "Light Mode");
        var radDark = grpThemeRow.add("radiobutton", undefined, "Dark Mode");
        radLight.value = true;

        var grpTailRow = pnlPlat.add("group");
        grpTailRow.orientation = "row";
        grpTailRow.alignChildren = ["left", "center"];
        grpTailRow.spacing = 14;
        var chkShowTail = grpTailRow.add("checkbox", undefined, "Show Bubble Tail");
        chkShowTail.value = true;
        var chkGroupConsecutive = grpTailRow.add("checkbox", undefined, "Smart Group Tails");
        chkGroupConsecutive.value = true;
        chkGroupConsecutive.helpTip = "Only show tail on the last bubble of consecutive messages from the same sender";

        // 1B. Timestamps & Real vs Fake Delays
        var pnlTiming = tabChat.add("panel", undefined, "Timestamps & Delays (Real vs. Fake)");
        pnlTiming.orientation = "column";
        pnlTiming.alignChildren = ["fill", "top"];
        pnlTiming.spacing = 5;
        pnlTiming.margins = [10, 14, 10, 8];

        var grpTsTop = pnlTiming.add("group");
        grpTsTop.orientation = "row";
        grpTsTop.alignChildren = ["left", "center"];
        grpTsTop.spacing = 10;
        var chkUseTime = grpTsTop.add("checkbox", undefined, "Show Timestamps");
        chkUseTime.value = true;
        grpTsTop.add("statictext", undefined, "Format:");
        var rad24h = grpTsTop.add("radiobutton", undefined, "24h (14:32)");
        var rad12h = grpTsTop.add("radiobutton", undefined, "12h (2:32 PM)");
        rad24h.value = true;

        var grpInitFake = pnlTiming.add("group");
        grpInitFake.orientation = "row";
        grpInitFake.alignChildren = ["left", "center"];
        grpInitFake.spacing = 8;
        grpInitFake.add("statictext", undefined, "Initial Time:");
        var inpInitTime = grpInitFake.add("edittext", undefined, "14:20");
        inpInitTime.characters = 7;
        inpInitTime.helpTip = "Header initial timestamp (e.g. '14:20' or '2:20 PM'). Subsequent bubbles calculate automatically.";

        grpInitFake.add("statictext", undefined, "Default Fake Delay:");
        var inpFakeDelay = grpInitFake.add("edittext", undefined, "+00:01");
        inpFakeDelay.characters = 7;
        inpFakeDelay.helpTip = "Default clock increment added to each bubble's timestamp (e.g. '+00:01' adds 1 minute). Per-bubble 'timestamp' can use '+HH:MM' (relative) or 'HH:MM' (direct).";

        var grpRealDelay = pnlTiming.add("group");
        grpRealDelay.orientation = "row";
        grpRealDelay.alignChildren = ["left", "center"];
        var lblRealDelay = grpRealDelay.add("statictext", undefined, "Real Delay (s):");
        lblRealDelay.preferredSize.width = 92;
        lblRealDelay.helpTip = "Actual After Effects timeline delay (in seconds) between bubbles appearing. Individual messages in .JSON can override this with 'realDelay'.";
        var sldRealDelay = grpRealDelay.add("slider", undefined, 1.0, 0.1, 10.0);
        sldRealDelay.preferredSize.width = 115;
        var inpRealDelay = grpRealDelay.add("edittext", undefined, "1");
        inpRealDelay.characters = 4;

        // 1C. Scripted Messages Schedule Preview
        var pnlPreview = tabChat.add("panel", undefined, "Scripted Messages Schedule (Preview)");
        pnlPreview.orientation = "column";
        pnlPreview.alignChildren = ["fill", "fill"];
        pnlPreview.spacing = 4;
        pnlPreview.margins = [8, 12, 8, 8];

        var lstMessages = pnlPreview.add("listbox", undefined, [], {
            multiselect: false
        });
        lstMessages.preferredSize = [320, 125];
        lstMessages.helpTip = "Live schedule preview showing [Direction] [Calculated Clock Time] (@AE Timeline Sec / +RealDelay) : Message Text";

        // =================================================================
        // TAB 2: APPEARANCE (Typography, Sizing, Colors, Read Receipts)
        // =================================================================
        var tabStyle = tpanel.add("tab", undefined, "Appearance");
        tabStyle.orientation = "column";
        tabStyle.alignChildren = ["fill", "top"];
        tabStyle.spacing = 6;
        tabStyle.margins = 8;

        var pnlTypo = tabStyle.add("panel", undefined, "Typography & Bubble Dimensions");
        pnlTypo.orientation = "column";
        pnlTypo.alignChildren = ["fill", "top"];
        pnlTypo.spacing = 4;
        pnlTypo.margins = [10, 14, 10, 8];

        var grpFont = pnlTypo.add("group");
        grpFont.orientation = "row";
        grpFont.alignChildren = ["left", "center"];
        var lblFont = grpFont.add("statictext", undefined, "Font:");
        lblFont.preferredSize.width = 72;
        var dropFont = grpFont.add("dropdownlist", undefined, FONT_NAMES);
        dropFont.selection = 0;
        dropFont.alignment = ["fill", "center"];

        var grpEmoji = pnlTypo.add("group");
        grpEmoji.orientation = "row";
        grpEmoji.alignChildren = ["left", "center"];
        var lblEmoji = grpEmoji.add("statictext", undefined, "Emoji Font:");
        lblEmoji.preferredSize.width = 72;
        var dropEmojiFont = grpEmoji.add("dropdownlist", undefined, EMOJI_FONT_NAMES);
        dropEmojiFont.selection = 0;
        dropEmojiFont.alignment = ["fill", "center"];

        var chkTextWrap = pnlTypo.add("checkbox", undefined, "Auto Wrap Text to Max Bubble Width");
        chkTextWrap.value = true;

        // Bubble Width
        var grpW = pnlTypo.add("group");
        grpW.orientation = "row";
        grpW.alignChildren = ["left", "center"];
        var lblW = grpW.add("statictext", undefined, "Bubble Width:");
        lblW.preferredSize.width = 92;
        var sldWidth = grpW.add("slider", undefined, 620, 200, 1400);
        sldWidth.preferredSize.width = 115;
        var inpWidth = grpW.add("edittext", undefined, "620");
        inpWidth.characters = 4;

        // Max Bubble Width
        var grpMaxW = pnlTypo.add("group");
        grpMaxW.orientation = "row";
        grpMaxW.alignChildren = ["left", "center"];
        var lblMaxW = grpMaxW.add("statictext", undefined, "Max Width:");
        lblMaxW.preferredSize.width = 92;
        var sldMaxWidth = grpMaxW.add("slider", undefined, 720, 220, 1600);
        sldMaxWidth.preferredSize.width = 115;
        var inpMaxWidth = grpMaxW.add("edittext", undefined, "720");
        inpMaxWidth.characters = 4;

        // Text Size
        var grpTS = pnlTypo.add("group");
        grpTS.orientation = "row";
        grpTS.alignChildren = ["left", "center"];
        var lblTS = grpTS.add("statictext", undefined, "Text Size:");
        lblTS.preferredSize.width = 92;
        var sldTextSize = grpTS.add("slider", undefined, 42, 16, 110);
        sldTextSize.preferredSize.width = 115;
        var inpTextSize = grpTS.add("edittext", undefined, "42");
        inpTextSize.characters = 4;

        // Inner Padding
        var grpPad = pnlTypo.add("group");
        grpPad.orientation = "row";
        grpPad.alignChildren = ["left", "center"];
        var lblPad = grpPad.add("statictext", undefined, "Inner Padding:");
        lblPad.preferredSize.width = 92;
        var sldPad = grpPad.add("slider", undefined, 36, 10, 100);
        sldPad.preferredSize.width = 115;
        var inpPad = grpPad.add("edittext", undefined, "36");
        inpPad.characters = 4;

        // Line Spacing %
        var grpLead = pnlTypo.add("group");
        grpLead.orientation = "row";
        grpLead.alignChildren = ["left", "center"];
        var lblLead = grpLead.add("statictext", undefined, "Leading (%):");
        lblLead.preferredSize.width = 92;
        var sldLead = grpLead.add("slider", undefined, 130, 90, 220);
        sldLead.preferredSize.width = 115;
        var inpLead = grpLead.add("edittext", undefined, "130");
        inpLead.characters = 4;

        // Vertical Gap Between Bubbles
        var grpGap = pnlTypo.add("group");
        grpGap.orientation = "row";
        grpGap.alignChildren = ["left", "center"];
        var lblGap = grpGap.add("statictext", undefined, "Bubble Gap:");
        lblGap.preferredSize.width = 92;
        var sldGap = grpGap.add("slider", undefined, 24, 4, 100);
        sldGap.preferredSize.width = 115;
        var inpGap = grpGap.add("edittext", undefined, "24");
        inpGap.characters = 4;

        // Bubble Colors (Sent & Received)
        var pnlColors = tabStyle.add("panel", undefined, "Bubble & Text Colors");
        pnlColors.orientation = "column";
        pnlColors.alignChildren = ["fill", "top"];
        pnlColors.spacing = 4;
        pnlColors.margins = [10, 14, 10, 8];

        var grpSentCols = pnlColors.add("group");
        grpSentCols.orientation = "row";
        grpSentCols.alignChildren = ["left", "center"];
        grpSentCols.spacing = 6;
        var lblSentCol = grpSentCols.add("statictext", undefined, "Sent (Right):");
        lblSentCol.preferredSize.width = 82;
        var btnSentBubbleCol = grpSentCols.add("button", undefined, "#D3E3FD");
        btnSentBubbleCol.preferredSize = [82, 24];
        btnSentBubbleCol.helpTip = "Sent Bubble Background Color";
        var btnSentTextCol = grpSentCols.add("button", undefined, "#041E49");
        btnSentTextCol.preferredSize = [82, 24];
        btnSentTextCol.helpTip = "Sent Bubble Text Color";

        var grpRecvCols = pnlColors.add("group");
        grpRecvCols.orientation = "row";
        grpRecvCols.alignChildren = ["left", "center"];
        grpRecvCols.spacing = 6;
        var lblRecvCol = grpRecvCols.add("statictext", undefined, "Received (Left):");
        lblRecvCol.preferredSize.width = 82;
        var btnRecvBubbleCol = grpRecvCols.add("button", undefined, "#F1F3F4");
        btnRecvBubbleCol.preferredSize = [82, 24];
        btnRecvBubbleCol.helpTip = "Received Bubble Background Color";
        var btnRecvTextCol = grpRecvCols.add("button", undefined, "#1F1F1F");
        btnRecvTextCol.preferredSize = [82, 24];
        btnRecvTextCol.helpTip = "Received Bubble Text Color";

        // Status & Delivery Receipt
        var pnlStatus = tabStyle.add("panel", undefined, "Delivery & Read Receipts (Sent Bubbles)");
        pnlStatus.orientation = "column";
        pnlStatus.alignChildren = ["fill", "top"];
        pnlStatus.spacing = 4;
        pnlStatus.margins = [10, 14, 10, 8];

        var chkShowStatus = pnlStatus.add("checkbox", undefined, "Show Checkmarks (\u2713 -> \u2713\u2713 / RCS \u25CB\u2713)");
        chkShowStatus.value = true;

        var grpDeliv = pnlStatus.add("group");
        grpDeliv.orientation = "row";
        grpDeliv.alignChildren = ["left", "center"];
        var lblDeliv = grpDeliv.add("statictext", undefined, "Sent->Deliv (s):");
        lblDeliv.preferredSize.width = 92;
        var sldDelivDelay = grpDeliv.add("slider", undefined, 0.6, 0.1, 8.0);
        sldDelivDelay.preferredSize.width = 115;
        var inpDelivDelay = grpDeliv.add("edittext", undefined, "0.6");
        inpDelivDelay.characters = 4;

        var grpRead = pnlStatus.add("group");
        grpRead.orientation = "row";
        grpRead.alignChildren = ["left", "center"];
        var lblRead = grpRead.add("statictext", undefined, "Deliv->Read (s):");
        lblRead.preferredSize.width = 92;
        var sldReadDelay = grpRead.add("slider", undefined, 1.2, 0.1, 8.0);
        sldReadDelay.preferredSize.width = 115;
        var inpReadDelay = grpRead.add("edittext", undefined, "1.2");
        inpReadDelay.characters = 4;

        // =================================================================
        // TAB 3: SCREEN (Visibility, Opacity, Size, Padding, Color, Radius, Auto-Scroll)
        // =================================================================
        var tabScreen = tpanel.add("tab", undefined, "Screen");
        tabScreen.orientation = "column";
        tabScreen.alignChildren = ["fill", "top"];
        tabScreen.spacing = 6;
        tabScreen.margins = 8;

        var pnlScreen = tabScreen.add("panel", undefined, "Chat Screen Appearance");
        pnlScreen.orientation = "column";
        pnlScreen.alignChildren = ["fill", "top"];
        pnlScreen.spacing = 6;
        pnlScreen.margins = [10, 14, 10, 10];

        var chkScreenVisible = pnlScreen.add("checkbox", undefined, "Show Chat Screen Background");
        chkScreenVisible.value = true;

        // Screen Opacity
        var grpScrOp = pnlScreen.add("group");
        grpScrOp.orientation = "row";
        grpScrOp.alignChildren = ["left", "center"];
        var lblScrOp = grpScrOp.add("statictext", undefined, "Opacity (%):");
        lblScrOp.preferredSize.width = 98;
        var sldScreenOpacity = grpScrOp.add("slider", undefined, 100, 0, 100);
        sldScreenOpacity.preferredSize.width = 115;
        var inpScreenOpacity = grpScrOp.add("edittext", undefined, "100");
        inpScreenOpacity.characters = 4;

        // Screen Width
        var grpScrW = pnlScreen.add("group");
        grpScrW.orientation = "row";
        grpScrW.alignChildren = ["left", "center"];
        var lblScrW = grpScrW.add("statictext", undefined, "Screen Width:");
        lblScrW.preferredSize.width = 98;
        var sldScreenWidth = grpScrW.add("slider", undefined, 960, 320, 2160);
        sldScreenWidth.preferredSize.width = 115;
        var inpScreenWidth = grpScrW.add("edittext", undefined, "960");
        inpScreenWidth.characters = 4;

        // Screen Height
        var grpScrH = pnlScreen.add("group");
        grpScrH.orientation = "row";
        grpScrH.alignChildren = ["left", "center"];
        var lblScrH = grpScrH.add("statictext", undefined, "Screen Height:");
        lblScrH.preferredSize.width = 98;
        var sldScreenHeight = grpScrH.add("slider", undefined, 1680, 400, 3840);
        sldScreenHeight.preferredSize.width = 115;
        var inpScreenHeight = grpScrH.add("edittext", undefined, "1680");
        inpScreenHeight.characters = 4;

        // Screen Inner Padding
        var grpScrPad = pnlScreen.add("group");
        grpScrPad.orientation = "row";
        grpScrPad.alignChildren = ["left", "center"];
        var lblScrPad = grpScrPad.add("statictext", undefined, "Inner Padding:");
        lblScrPad.preferredSize.width = 98;
        var sldScreenPad = grpScrPad.add("slider", undefined, 48, 0, 200);
        sldScreenPad.preferredSize.width = 115;
        var inpScreenPad = grpScrPad.add("edittext", undefined, "48");
        inpScreenPad.characters = 4;

        // Screen Corner Roundness
        var grpScrRad = pnlScreen.add("group");
        grpScrRad.orientation = "row";
        grpScrRad.alignChildren = ["left", "center"];
        var lblScrRad = grpScrRad.add("statictext", undefined, "Corner Roundness:");
        lblScrRad.preferredSize.width = 98;
        var sldScreenRadius = grpScrRad.add("slider", undefined, 64, 0, 240);
        sldScreenRadius.preferredSize.width = 115;
        var inpScreenRadius = grpScrRad.add("edittext", undefined, "64");
        inpScreenRadius.characters = 4;

        // Screen Background Color
        var grpScrCol = pnlScreen.add("group");
        grpScrCol.orientation = "row";
        grpScrCol.alignChildren = ["left", "center"];
        var lblScrCol = grpScrCol.add("statictext", undefined, "Background Color:");
        lblScrCol.preferredSize.width = 98;
        var btnScreenBgCol = grpScrCol.add("button", undefined, "#F8F9FA");
        btnScreenBgCol.preferredSize = [100, 24];

        // Overflow & Auto-Scrolling Panel
        var pnlScroll = tabScreen.add("panel", undefined, "Overflow & Automatic Chat Scrolling");
        pnlScroll.orientation = "column";
        pnlScroll.alignChildren = ["fill", "top"];
        pnlScroll.spacing = 6;
        pnlScroll.margins = [10, 14, 10, 10];

        var chkAutoScroll = pnlScroll.add("checkbox", undefined, "Auto-Scroll Chat When Bubbles Overflow Screen");
        chkAutoScroll.value = true;
        chkAutoScroll.helpTip = "Automatically scrolls the conversation upward once bubbles exceed (Screen Height - 2 * Inner Padding)";

        var chkClipToScreen = pnlScroll.add("checkbox", undefined, "Fade / Clip Bubbles Exiting Top & Bottom of Screen");
        chkClipToScreen.value = true;

        var grpScrollSmooth = pnlScroll.add("group");
        grpScrollSmooth.orientation = "row";
        grpScrollSmooth.alignChildren = ["left", "center"];
        var lblScrollSmooth = grpScrollSmooth.add("statictext", undefined, "Scroll Smooth (f):");
        lblScrollSmooth.preferredSize.width = 98;
        var sldScrollSmooth = grpScrollSmooth.add("slider", undefined, 12, 1, 45);
        sldScrollSmooth.preferredSize.width = 115;
        var inpScrollSmooth = grpScrollSmooth.add("edittext", undefined, "12");
        inpScrollSmooth.characters = 4;

        // =================================================================
        // TAB 4: ANIMATION (Entrance & iOS 18 Text Animator)
        // =================================================================
        var tabAnim = tpanel.add("tab", undefined, "Animation");
        tabAnim.orientation = "column";
        tabAnim.alignChildren = ["fill", "top"];
        tabAnim.spacing = 6;
        tabAnim.margins = 8;

        var pnlEntrance = tabAnim.add("panel", undefined, "Bubble Entrance Animation");
        pnlEntrance.orientation = "column";
        pnlEntrance.alignChildren = ["fill", "top"];
        pnlEntrance.spacing = 6;
        pnlEntrance.margins = [10, 14, 10, 10];

        var chkEntranceAnim = pnlEntrance.add("checkbox", undefined, "Pop-In Grow Animation from Tail Corner");
        chkEntranceAnim.value = true;

        var grpGrow = pnlEntrance.add("group");
        grpGrow.orientation = "row";
        grpGrow.alignChildren = ["left", "center"];
        var lblGrow = grpGrow.add("statictext", undefined, "Grow Frames:");
        lblGrow.preferredSize.width = 95;
        var sldGrowDur = grpGrow.add("slider", undefined, 12, 3, 45);
        sldGrowDur.preferredSize.width = 115;
        var inpGrowDur = grpGrow.add("edittext", undefined, "12");
        inpGrowDur.characters = 4;

        var grpType = pnlEntrance.add("group");
        grpType.orientation = "row";
        grpType.alignChildren = ["left", "center"];
        var lblType = grpType.add("statictext", undefined, "Typewriter (c/s):");
        lblType.preferredSize.width = 95;
        var sldTypewriter = grpType.add("slider", undefined, 0, 0, 80);
        sldTypewriter.preferredSize.width = 115;
        var inpTypewriter = grpType.add("edittext", undefined, "0");
        inpTypewriter.characters = 4;

        var pnlTextAnim = tabAnim.add("panel", undefined, "Default Text Animation (iOS 18 Style)");
        pnlTextAnim.orientation = "column";
        pnlTextAnim.alignChildren = ["fill", "top"];
        pnlTextAnim.spacing = 5;
        pnlTextAnim.margins = [10, 14, 10, 10];

        var grpAnimChks = pnlTextAnim.add("group");
        grpAnimChks.orientation = "row";
        grpAnimChks.alignChildren = ["left", "center"];
        grpAnimChks.spacing = 12;
        var chkNod = grpAnimChks.add("checkbox", undefined, "Nod");
        var chkShake = grpAnimChks.add("checkbox", undefined, "Shake");
        var chkBlink = grpAnimChks.add("checkbox", undefined, "Blink");
        var chkDecay = grpAnimChks.add("checkbox", undefined, "Settle (Decay)");
        chkDecay.value = true;

        var grpSpd = pnlTextAnim.add("group");
        grpSpd.orientation = "row";
        grpSpd.alignChildren = ["left", "center"];
        var lblSpd = grpSpd.add("statictext", undefined, "Anim Speed:");
        lblSpd.preferredSize.width = 95;
        var sldSpeed = grpSpd.add("slider", undefined, 3, 1, 15);
        sldSpeed.preferredSize.width = 115;
        var inpSpeed = grpSpd.add("edittext", undefined, "3");
        inpSpeed.characters = 4;

        var grpInt = pnlTextAnim.add("group");
        grpInt.orientation = "row";
        grpInt.alignChildren = ["left", "center"];
        var lblInt = grpInt.add("statictext", undefined, "Intensity:");
        lblInt.preferredSize.width = 95;
        var sldIntensity = grpInt.add("slider", undefined, 16, 2, 60);
        sldIntensity.preferredSize.width = 115;
        var inpIntensity = grpInt.add("edittext", undefined, "16");
        inpIntensity.characters = 4;

        // =================================================================
        // TAB 5: HELP (.JSON Format Guide & Font Links)
        // =================================================================
        var tabHelp = tpanel.add("tab", undefined, "Help");
        tabHelp.orientation = "column";
        tabHelp.alignChildren = ["fill", "top"];
        tabHelp.spacing = 6;
        tabHelp.margins = 8;

        var pnlJsonGuide = tabHelp.add("panel", undefined, "Conversation .JSON & Timestamp Syntax");
        pnlJsonGuide.orientation = "column";
        pnlJsonGuide.alignChildren = ["fill", "top"];
        pnlJsonGuide.spacing = 3;
        pnlJsonGuide.margins = [10, 14, 10, 8];

        pnlJsonGuide.add("statictext", undefined, "1. Place conversation .JSON files in the /conversation/ folder.");
        pnlJsonGuide.add("statictext", undefined, "2. 'header' stores platform, screen, initialTimestamp & delays.");
        pnlJsonGuide.add("statictext", undefined, "3. Real Delay: 'realDelay': 2.0 overrides timeline gap (seconds).");
        pnlJsonGuide.add("statictext", undefined, "4. Fake Timestamp: '+00:05' adds to previous; '14:32' sets exact.");
        pnlJsonGuide.add("statictext", undefined, "5. Future RCS ready: type 'text'|'image'|'video'|'carousel'|'buttons'.");

        var pnlEmojiNote = tabHelp.add("panel", undefined, "Note on Color Emojis in After Effects");
        pnlEmojiNote.orientation = "column";
        pnlEmojiNote.alignChildren = ["fill", "top"];
        pnlEmojiNote.spacing = 2;
        pnlEmojiNote.margins = [10, 14, 10, 8];

        pnlEmojiNote.add("statictext", undefined, "Note: Adobe After Effects does not support color emojis natively yet.");
        pnlEmojiNote.add("statictext", undefined, "Emoji fonts render as monochrome glyphs tinted by the text fill color.");

        var pnlHelpLinks = tabHelp.add("panel", undefined, "Fonts & Repository Links");
        pnlHelpLinks.orientation = "column";
        pnlHelpLinks.alignChildren = ["fill", "top"];
        pnlHelpLinks.spacing = 4;
        pnlHelpLinks.margins = [10, 14, 10, 8];

        function openURL(url) {
            try {
                if ($.os.toLowerCase().indexOf("win") !== -1) {
                    system.callSystem('cmd.exe /c start "" "' + url + '"');
                } else {
                    system.callSystem('open "' + url + '"');
                }
            } catch (e) {
                alert("Open URL:\n" + url);
            }
        }

        var btnDlRoboto = pnlHelpLinks.add("button", undefined, "Google Fonts — Roboto & Open Sans");
        btnDlRoboto.onClick = function () { openURL("https://fonts.google.com/specimen/Roboto"); };

        var btnDlSFPro = pnlHelpLinks.add("button", undefined, "Apple Developer — SF Pro & Apple Emoji");
        btnDlSFPro.onClick = function () { openURL("https://developer.apple.com/fonts/"); };

        var btnDlNotoEmoji = pnlHelpLinks.add("button", undefined, "Google Fonts — Noto Color Emoji");
        btnDlNotoEmoji.onClick = function () { openURL("https://fonts.google.com/noto/specimen/Noto+Color+Emoji"); };

        var btnOpenRepo = pnlHelpLinks.add("button", undefined, "GitHub — AE_scripted_Chat Repository");
        btnOpenRepo.onClick = function () { openURL("https://github.com/work2survive/AE_scripted_Chat"); };

        tpanel.selection = 0;

        // -----------------------------------------------------------------
        // BOTTOM ACTION BAR
        // -----------------------------------------------------------------
        var grpBottom = win.add("group");
        grpBottom.orientation = "column";
        grpBottom.alignChildren = ["fill", "center"];
        grpBottom.margins = [0, 4, 0, 0];

        var btnGenerate = grpBottom.add("button", undefined, "Generate Scripted Chat");
        btnGenerate.preferredSize.height = 38;

        // =====================================================================
        // 5A. UI EVENT BINDINGS, HEADER SYNC & TYPOGRAPHY / EMOJI ENGINE
        // =====================================================================
        function getCurrentConversationEntry() {
            if (discoveredConversations.length === 0) return null;
            var idx = dropConversation.selection ? dropConversation.selection.index : 0;
            if (idx < 0 || idx >= discoveredConversations.length) idx = 0;
            return discoveredConversations[idx];
        }

        function collectHeaderFromUI() {
            var entry = getCurrentConversationEntry();
            var existingHdr = (entry && entry.data && entry.data.header) ? entry.data.header : {};
            var platName = dropPlatform.selection ? dropPlatform.selection.text : "Android RCS";
            var fontName = dropFont.selection ? dropFont.selection.text : "Roboto";
            var emojiFontName = dropEmojiFont.selection ? dropEmojiFont.selection.text : "Noto Color Emoji (Google)";

            return {
                conversationTitle: existingHdr.conversationTitle || (entry ? entry.fileName : "Scripted Conversation"),
                platform: platName,
                theme: radDark.value ? "dark" : "light",
                font: fontName,
                emojiFont: emojiFontName,
                useTimestamps: chkUseTime.value,
                initialTimestamp: inpInitTime.text || "14:20",
                timeFormat: rad12h.value ? "12h" : "24h",
                realDelayBetweenBubbles: parseFloat(inpRealDelay.text) || 1.0,
                fakeDelayBetweenBubbles: inpFakeDelay.text || "+00:01",
                bubbleWidth: parseInt(inpWidth.text, 10) || 620,
                maxBubbleWidth: parseInt(inpMaxWidth.text, 10) || 720,
                textWrapping: chkTextWrap.value,
                textSize: parseInt(inpTextSize.text, 10) || 42,
                innerPadding: parseInt(inpPad.text, 10) || 36,
                lineSpacing: parseInt(inpLead.text, 10) || 130,
                bubbleGap: parseInt(inpGap.text, 10) || 24,
                showTail: chkShowTail.value,
                groupConsecutive: chkGroupConsecutive.value,
                showStatus: chkShowStatus.value,
                sentToDeliveredDelay: parseFloat(inpDelivDelay.text) || 0.6,
                deliveredToReadDelay: parseFloat(inpReadDelay.text) || 1.2,
                entranceAnimation: chkEntranceAnim.value,
                growDuration: parseInt(inpGrowDur.text, 10) || 12,
                typewriterSpeed: parseInt(inpTypewriter.text, 10) || 0,
                screenVisible: chkScreenVisible.value,
                screenOpacity: parseInt(inpScreenOpacity.text, 10) !== undefined && !isNaN(parseInt(inpScreenOpacity.text, 10)) ? parseInt(inpScreenOpacity.text, 10) : 100,
                screenWidth: parseInt(inpScreenWidth.text, 10) || 960,
                screenHeight: parseInt(inpScreenHeight.text, 10) || 1680,
                screenInnerPadding: parseInt(inpScreenPad.text, 10) || 48,
                screenCornerRadius: parseInt(inpScreenRadius.text, 10) || 64,
                screenBackgroundColor: rgbToHex(stateColors.screenBg),
                autoScroll: chkAutoScroll.value,
                clipToScreen: chkClipToScreen.value,
                scrollSmoothnessFrames: parseInt(inpScrollSmooth.text, 10) || 12,
                sentColors: {
                    bubble: rgbToHex(stateColors.sentBubble),
                    text: rgbToHex(stateColors.sentText),
                    time: rgbToHex(stateColors.sentTime),
                    check: rgbToHex(stateColors.sentCheck)
                },
                receivedColors: {
                    bubble: rgbToHex(stateColors.receivedBubble),
                    text: rgbToHex(stateColors.receivedText),
                    time: rgbToHex(stateColors.receivedTime)
                }
            };
        }

        function refreshMessagePreviewList() {
            var entry = getCurrentConversationEntry();
            lstMessages.removeAll();
            if (!entry || !entry.data) {
                txtConvMeta.text = "No conversation loaded.";
                return;
            }
            var liveHdr = collectHeaderFromUI();
            var schedule = computeConversationSchedule(entry.data, liveHdr);
            var totalDur = 0;
            for (var i = 0; i < schedule.length; i++) {
                var item = schedule[i];
                var dirTag = item.direction === "sent" ? "[SENT]" : "[RECV]";
                var timeTag = liveHdr.useTimestamps ? (" " + item.formattedTimestamp) : "";
                var delayTag = " (@" + item.startTime.toFixed(1) + "s";
                if (i > 0 || item.hasCustomRealDelay) {
                    delayTag += " / +" + item.realDelayUsed + "s" + (item.hasCustomRealDelay ? "*" : "");
                }
                delayTag += ")";
                var snippet = item.text.replace(/\r\n|\r|\n/g, " ");
                if (snippet.length > 34) snippet = snippet.substring(0, 34) + "...";
                var rowStr = (i + 1) + ". " + dirTag + timeTag + delayTag + "  " + snippet;
                lstMessages.add("item", rowStr);
                totalDur = Math.max(totalDur, item.startTime + calculateReadDuration(item.text));
            }
            var title = liveHdr.conversationTitle || entry.fileName;
            txtConvMeta.text = title + "  |  " + schedule.length + " bubbles  |  ~" + Math.ceil(totalDur + 1.5) + "s total";
        }

        function applyPlatformThemeColors(platName, isDark, keepExplicitScreenBg, explicitHeader) {
            var p = PLATFORMS[platName] || PLATFORMS["Android RCS"] || PLATFORMS[platformKeys[0]];
            if (!p) return;
            var modeObj = isDark ? (p.dark || p.light) : (p.light || p.dark);
            if (!modeObj) return;

            var sCol = modeObj.sent || {};
            var rCol = modeObj.received || {};

            if (explicitHeader && explicitHeader.sentColors) {
                if (explicitHeader.sentColors.bubble) sCol.bubble = explicitHeader.sentColors.bubble;
                if (explicitHeader.sentColors.text) sCol.text = explicitHeader.sentColors.text;
                if (explicitHeader.sentColors.time) sCol.time = explicitHeader.sentColors.time;
                if (explicitHeader.sentColors.check) sCol.check = explicitHeader.sentColors.check;
            }
            if (explicitHeader && explicitHeader.receivedColors) {
                if (explicitHeader.receivedColors.bubble) rCol.bubble = explicitHeader.receivedColors.bubble;
                if (explicitHeader.receivedColors.text) rCol.text = explicitHeader.receivedColors.text;
                if (explicitHeader.receivedColors.time) rCol.time = explicitHeader.receivedColors.time;
            }

            stateColors.sentBubble     = hexToRgb(sCol.bubble || "#D3E3FD");
            stateColors.sentText       = hexToRgb(sCol.text   || "#041E49");
            stateColors.sentTime       = hexToRgb(sCol.time   || "#444746");
            stateColors.sentCheck      = hexToRgb(sCol.check  || "#0B57D0");
            stateColors.receivedBubble = hexToRgb(rCol.bubble || "#F1F3F4");
            stateColors.receivedText   = hexToRgb(rCol.text   || "#1F1F1F");
            stateColors.receivedTime   = hexToRgb(rCol.time   || "#5E5E5E");

            if (!keepExplicitScreenBg) {
                var bgHex = modeObj.screenBg || (isDark ? "#121212" : "#F8F9FA");
                stateColors.screenBg = hexToRgb(bgHex);
            }

            setBtnColorSwatch(btnSentBubbleCol, stateColors.sentBubble);
            setBtnColorSwatch(btnSentTextCol, stateColors.sentText);
            setBtnColorSwatch(btnRecvBubbleCol, stateColors.receivedBubble);
            setBtnColorSwatch(btnRecvTextCol, stateColors.receivedText);
            setBtnColorSwatch(btnScreenBgCol, stateColors.screenBg);
        }

        function setSliderAndInput(sld, inp, val, isFloat) {
            if (val === undefined || val === null || isNaN(val)) return;
            var v = isFloat ? (Math.round(parseFloat(val) * 10) / 10) : Math.round(parseFloat(val));
            if (v < sld.minvalue) v = sld.minvalue;
            if (v > sld.maxvalue) v = sld.maxvalue;
            sld.value = v;
            inp.text = String(v);
        }

        function applyHeaderToUI(hdr) {
            if (!hdr) return;

            // Platform
            var platName = hdr.platform || "Android RCS";
            for (var pi = 0; pi < platformKeys.length; pi++) {
                if (platformKeys[pi] === platName) {
                    dropPlatform.selection = pi;
                    break;
                }
            }
            var pObj = PLATFORMS[platName] || PLATFORMS[platformKeys[0]];

            // Theme
            var isDark = String(hdr.theme || "light").toLowerCase() === "dark";
            radDark.value = isDark;
            radLight.value = !isDark;

            // Font & Emoji Font
            var targetFont = hdr.font || (pObj && pObj.font) || "Roboto";
            for (var fi = 0; fi < FONT_NAMES.length; fi++) {
                if (FONT_NAMES[fi] === targetFont) {
                    dropFont.selection = fi;
                    break;
                }
            }
            var targetEmoji = hdr.emojiFont || (pObj && pObj.emojiFont) || "Noto Color Emoji (Google)";
            for (var ei = 0; ei < EMOJI_FONT_NAMES.length; ei++) {
                if (EMOJI_FONT_NAMES[ei] === targetEmoji || EMOJI_FONT_NAMES[ei].indexOf(targetEmoji) === 0) {
                    dropEmojiFont.selection = ei;
                    break;
                }
            }

            // Tails & Status
            chkShowTail.value = hdr.showTail !== false;
            chkGroupConsecutive.value = hdr.groupConsecutive !== false;
            chkShowStatus.value = hdr.showStatus !== false;

            // Timestamps & Delays
            chkUseTime.value = hdr.useTimestamps !== false;
            inpInitTime.text = hdr.initialTimestamp !== undefined ? String(hdr.initialTimestamp) : "14:20";
            var is12h = String(hdr.timeFormat || "24h").toLowerCase() === "12h";
            rad12h.value = is12h;
            rad24h.value = !is12h;
            inpFakeDelay.text = hdr.fakeDelayBetweenBubbles !== undefined ? String(hdr.fakeDelayBetweenBubbles) : "+00:01";
            setSliderAndInput(sldRealDelay, inpRealDelay, hdr.realDelayBetweenBubbles !== undefined ? hdr.realDelayBetweenBubbles : 1.0, true);

            // Dimensions & Typography
            chkTextWrap.value = hdr.textWrapping !== false;
            setSliderAndInput(sldWidth, inpWidth, hdr.bubbleWidth !== undefined ? hdr.bubbleWidth : 620, false);
            setSliderAndInput(sldMaxWidth, inpMaxWidth, hdr.maxBubbleWidth !== undefined ? hdr.maxBubbleWidth : 720, false);
            setSliderAndInput(sldTextSize, inpTextSize, hdr.textSize !== undefined ? hdr.textSize : 42, false);
            setSliderAndInput(sldPad, inpPad, hdr.innerPadding !== undefined ? hdr.innerPadding : 36, false);
            setSliderAndInput(sldLead, inpLead, hdr.lineSpacing !== undefined ? hdr.lineSpacing : 130, false);
            setSliderAndInput(sldGap, inpGap, hdr.bubbleGap !== undefined ? hdr.bubbleGap : 24, false);

            // Status timings
            setSliderAndInput(sldDelivDelay, inpDelivDelay, hdr.sentToDeliveredDelay !== undefined ? hdr.sentToDeliveredDelay : 0.6, true);
            setSliderAndInput(sldReadDelay, inpReadDelay, hdr.deliveredToReadDelay !== undefined ? hdr.deliveredToReadDelay : 1.2, true);

            // Entrance Animation
            chkEntranceAnim.value = hdr.entranceAnimation !== false;
            setSliderAndInput(sldGrowDur, inpGrowDur, hdr.growDuration !== undefined ? hdr.growDuration : 12, false);
            setSliderAndInput(sldTypewriter, inpTypewriter, hdr.typewriterSpeed !== undefined ? hdr.typewriterSpeed : 0, false);

            // Screen Tab Settings
            chkScreenVisible.value = hdr.screenVisible !== false;
            setSliderAndInput(sldScreenOpacity, inpScreenOpacity, hdr.screenOpacity !== undefined ? hdr.screenOpacity : 100, false);
            setSliderAndInput(sldScreenWidth, inpScreenWidth, hdr.screenWidth !== undefined ? hdr.screenWidth : 960, false);
            setSliderAndInput(sldScreenHeight, inpScreenHeight, hdr.screenHeight !== undefined ? hdr.screenHeight : 1680, false);
            setSliderAndInput(sldScreenPad, inpScreenPad, hdr.screenInnerPadding !== undefined ? hdr.screenInnerPadding : 48, false);
            setSliderAndInput(sldScreenRadius, inpScreenRadius, hdr.screenCornerRadius !== undefined ? hdr.screenCornerRadius : 64, false);
            chkAutoScroll.value = hdr.autoScroll !== false;
            chkClipToScreen.value = hdr.clipToScreen !== false;
            setSliderAndInput(sldScrollSmooth, inpScrollSmooth, hdr.scrollSmoothnessFrames !== undefined ? hdr.scrollSmoothnessFrames : 12, false);

            // Colors
            var hasExplicitScreenBg = !!hdr.screenBackgroundColor;
            if (hasExplicitScreenBg) {
                stateColors.screenBg = hexToRgb(hdr.screenBackgroundColor);
            }
            applyPlatformThemeColors(platName, isDark, hasExplicitScreenBg, hdr);
        }

        function selectConversationByIndex(idx) {
            if (idx < 0 || idx >= discoveredConversations.length) return;
            currentConversationIndex = idx;
            var entry = discoveredConversations[idx];
            if (entry && entry.data && entry.data.header) {
                applyHeaderToUI(entry.data.header);
            }
            refreshMessagePreviewList();
        }

        // Bind Sliders & Inputs
        bindSliderEdit(sldRealDelay, inpRealDelay, true, function () { refreshMessagePreviewList(); });
        bindSliderEdit(sldWidth, inpWidth, false);
        bindSliderEdit(sldMaxWidth, inpMaxWidth, false);
        bindSliderEdit(sldTextSize, inpTextSize, false);
        bindSliderEdit(sldPad, inpPad, false);
        bindSliderEdit(sldLead, inpLead, false);
        bindSliderEdit(sldGap, inpGap, false);
        bindSliderEdit(sldDelivDelay, inpDelivDelay, true);
        bindSliderEdit(sldReadDelay, inpReadDelay, true);
        bindSliderEdit(sldScreenOpacity, inpScreenOpacity, false);
        bindSliderEdit(sldScreenWidth, inpScreenWidth, false);
        bindSliderEdit(sldScreenHeight, inpScreenHeight, false);
        bindSliderEdit(sldScreenPad, inpScreenPad, false);
        bindSliderEdit(sldScreenRadius, inpScreenRadius, false);
        bindSliderEdit(sldScrollSmooth, inpScrollSmooth, false);
        bindSliderEdit(sldGrowDur, inpGrowDur, false);
        bindSliderEdit(sldTypewriter, inpTypewriter, false);
        bindSliderEdit(sldSpeed, inpSpeed, false);
        bindSliderEdit(sldIntensity, inpIntensity, false);

        // Bind Timing & Platform Controls to Live Preview
        chkUseTime.onClick = function () { refreshMessagePreviewList(); };
        rad24h.onClick = function () { refreshMessagePreviewList(); };
        rad12h.onClick = function () { refreshMessagePreviewList(); };
        inpInitTime.onChange = function () { refreshMessagePreviewList(); };
        inpFakeDelay.onChange = function () { refreshMessagePreviewList(); };

        dropConversation.onChange = function () {
            if (!this.selection) return;
            selectConversationByIndex(this.selection.index);
        };

        dropPlatform.onChange = function () {
            if (!this.selection) return;
            var platName = this.selection.text;
            var p = PLATFORMS[platName];
            if (p) {
                if (p.fontIndex !== undefined && p.fontIndex < FONT_NAMES.length) {
                    dropFont.selection = p.fontIndex;
                }
                if (p.emojiFont) {
                    for (var ei = 0; ei < EMOJI_FONT_NAMES.length; ei++) {
                        if (EMOJI_FONT_NAMES[ei] === p.emojiFont) {
                            dropEmojiFont.selection = ei;
                            break;
                        }
                    }
                }
                chkShowTail.value = (p.tailType !== "none");
                applyPlatformThemeColors(platName, radDark.value, false, null);
            }
        };

        radLight.onClick = function () {
            var platName = dropPlatform.selection ? dropPlatform.selection.text : "Android RCS";
            applyPlatformThemeColors(platName, false, false, null);
        };
        radDark.onClick = function () {
            var platName = dropPlatform.selection ? dropPlatform.selection.text : "Android RCS";
            applyPlatformThemeColors(platName, true, false, null);
        };

        // Color Picker Button Handlers
        btnSentBubbleCol.onClick = function () {
            var c = pickColor(stateColors.sentBubble);
            if (c) { stateColors.sentBubble = c; setBtnColorSwatch(this, c); }
        };
        btnSentTextCol.onClick = function () {
            var c = pickColor(stateColors.sentText);
            if (c) { stateColors.sentText = c; setBtnColorSwatch(this, c); }
        };
        btnRecvBubbleCol.onClick = function () {
            var c = pickColor(stateColors.receivedBubble);
            if (c) { stateColors.receivedBubble = c; setBtnColorSwatch(this, c); }
        };
        btnRecvTextCol.onClick = function () {
            var c = pickColor(stateColors.receivedText);
            if (c) { stateColors.receivedText = c; setBtnColorSwatch(this, c); }
        };
        btnScreenBgCol.onClick = function () {
            var c = pickColor(stateColors.screenBg);
            if (c) { stateColors.screenBg = c; setBtnColorSwatch(this, c); }
        };

        // Top Bar Buttons
        btnReloadConv.onClick = function () {
            loadPresetsFromFile();
            scanConversations();
            dropConversation.removeAll();
            for (var i = 0; i < discoveredConversations.length; i++) {
                dropConversation.add("item", discoveredConversations[i].label);
            }
            if (discoveredConversations.length > 0) {
                var selIdx = Math.min(currentConversationIndex, discoveredConversations.length - 1);
                dropConversation.selection = selIdx;
                selectConversationByIndex(selIdx);
            }
        };

        btnOpenConvFolder.onClick = function () {
            try {
                ensureConversationFiles();
                var folder = getConversationFolder();
                if (folder && folder.exists) {
                    folder.execute();
                } else {
                    alert("Conversation folder path:\n" + folder.fsName);
                }
            } catch (e) {
                alert("Could not open conversation folder: " + e.toString());
            }
        };

        btnOpenPresets.onClick = function () {
            try {
                ensurePresetsFile();
                var folder = getPresetsFolder();
                if (folder && folder.exists) {
                    folder.execute();
                } else {
                    alert("Presets folder path:\n" + folder.fsName);
                }
            } catch (e) {
                alert("Could not open presets folder: " + e.toString());
            }
        };

        btnImportJSONToAE.onClick = function () {
            var entry = getCurrentConversationEntry();
            if (!entry) {
                alert("Please select a conversation first.");
                return;
            }
            var imported = importConversationIntoAEProject(entry);
            if (imported) {
                alert("Imported '" + entry.fileName + "' into the After Effects Project panel!");
            } else {
                // Also allow browsing for an external .json file to copy/load
                try {
                    var picked = File.openDialog("Select a Conversation .JSON file", "*.json");
                    if (picked && picked.exists) {
                        var parsed = loadConversationFromFile(picked);
                        if (parsed) {
                            var pName = decodeURI(picked.name);
                            var pTitle = (parsed.header && parsed.header.conversationTitle) ? parsed.header.conversationTitle : pName;
                            discoveredConversations.push({
                                fileName: pName,
                                label: pName + " — " + pTitle,
                                filePath: picked.fsName,
                                source: "folder",
                                data: parsed
                            });
                            dropConversation.add("item", pName + " — " + pTitle);
                            dropConversation.selection = discoveredConversations.length - 1;
                            selectConversationByIndex(discoveredConversations.length - 1);
                            importConversationIntoAEProject(discoveredConversations[discoveredConversations.length - 1]);
                        }
                    }
                } catch (e) {}
            }
        };

        btnSaveHeaderToJSON.onClick = function () {
            var entry = getCurrentConversationEntry();
            if (!entry) return;
            var newHdr = collectHeaderFromUI();
            var ok = saveConversationToFile(entry, newHdr);
            refreshMessagePreviewList();
            if (ok) {
                alert("Saved current UI header settings to:\n" + entry.fileName);
            } else {
                alert("Updated header in memory for:\n" + entry.fileName);
            }
        };

        // Initialize UI from first discovered conversation
        if (discoveredConversations.length > 0) {
            selectConversationByIndex(0);
        }

        // =====================================================================
        // 5B. TYPOGRAPHY & EMOJI DETECTION ENGINE (Based on AE_message_bubble)
        // =====================================================================
        function isEmojiCodePoint(cp) {
            return (
                (cp >= 0x1F300 && cp <= 0x1FAFF) ||
                (cp >= 0x2600 && cp <= 0x27BF) ||
                (cp >= 0x2300 && cp <= 0x23FF) ||
                (cp >= 0x2B50 && cp <= 0x2B55) ||
                (cp >= 0xFE00 && cp <= 0xFE0F) ||
                cp === 0x200D ||
                cp === 0x20E3 ||
                (cp >= 0x1F1E6 && cp <= 0x1F1FF)
            );
        }

        function splitEmojiAndTextRanges(str) {
            var ranges = [];
            if (!str || str.length === 0) return ranges;
            var i = 0;
            var curStart = 0;
            var curIsEmoji = false;

            while (i < str.length) {
                var c1 = str.charCodeAt(i);
                var cp = c1;
                var step = 1;
                if (c1 >= 0xD800 && c1 <= 0xDBFF && (i + 1) < str.length) {
                    var c2 = str.charCodeAt(i + 1);
                    if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                        cp = ((c1 - 0xD800) << 10) + (c2 - 0xDC00) + 0x10000;
                        step = 2;
                    }
                }
                var emojiFlag = isEmojiCodePoint(cp);
                if (i === 0) {
                    curIsEmoji = emojiFlag;
                } else if (emojiFlag !== curIsEmoji) {
                    ranges.push({ start: curStart, end: i, isEmoji: curIsEmoji });
                    curStart = i;
                    curIsEmoji = emojiFlag;
                }
                i += step;
            }
            ranges.push({ start: curStart, end: str.length, isEmoji: curIsEmoji });
            return ranges;
        }

        function measureTypographyLine(str, fontSize) {
            if (!str) return 0;
            var w = 0;
            var i = 0;
            while (i < str.length) {
                var c1 = str.charCodeAt(i);
                if (c1 >= 0xD800 && c1 <= 0xDBFF && (i + 1) < str.length) {
                    w += fontSize * 1.15;
                    i += 2;
                    continue;
                }
                var ch = str.charAt(i);
                if ("ilI1|.,:;!'` ".indexOf(ch) !== -1) {
                    w += fontSize * 0.28;
                } else if ("mwMW@%".indexOf(ch) !== -1) {
                    w += fontSize * 0.82;
                } else if (ch >= "A" && ch <= "Z") {
                    w += fontSize * 0.64;
                } else {
                    w += fontSize * 0.52;
                }
                i++;
            }
            return w;
        }

        function wrapTextToLines(rawText, maxTextWidth, fontSize, doWrap) {
            var text = String(rawText || "");
            var paragraphs = text.split(/\r\n|\r|\n/);
            if (!doWrap) return paragraphs;

            var wrappedLines = [];
            for (var p = 0; p < paragraphs.length; p++) {
                var words = paragraphs[p].split(" ");
                var currentLine = "";
                for (var w = 0; w < words.length; w++) {
                    var word = words[w];
                    var candidate = currentLine.length === 0 ? word : (currentLine + " " + word);
                    if (measureTypographyLine(candidate, fontSize) > maxTextWidth && currentLine.length > 0) {
                        wrappedLines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = candidate;
                    }
                }
                wrappedLines.push(currentLine);
            }
            return wrappedLines;
        }

        function computeBubbleLayout(rawText, hdr, showTail, showStatus, isSent) {
            var fontSize = hdr.textSize || 42;
            var pad = hdr.innerPadding || 36;
            var leadPct = hdr.lineSpacing || 130;
            var screenInnerW = Math.max(240, (hdr.screenWidth || 960) - 2 * (hdr.screenInnerPadding || 48));
            var maxBubbleW = Math.min(hdr.maxBubbleWidth || 720, Math.round(screenInnerW * 0.86));
            var availTextW = Math.max(80, maxBubbleW - pad * 2);

            var lines = wrapTextToLines(rawText, availTextW, fontSize, hdr.textWrapping !== false);
            var maxLineW = 0;
            for (var i = 0; i < lines.length; i++) {
                var lw = measureTypographyLine(lines[i], fontSize);
                if (lw > maxLineW) maxLineW = lw;
            }

            var lineHeightPx = fontSize * (leadPct / 100);
            var textBlockH = Math.max(fontSize, fontSize + (lines.length - 1) * lineHeightPx);
            var hasFooter = hdr.useTimestamps || (showStatus && isSent);
            var extraH = hasFooter ? 26 : 0;
            var minW = hasFooter ? 148 : 68;

            var bubbleW = Math.min(maxBubbleW, Math.max(Math.ceil(maxLineW + pad * 2), minW));
            var bubbleH = Math.max(Math.ceil(textBlockH + pad * 2 + extraH), 54);

            return {
                wrappedText: lines.join("\r"),
                linesCount: lines.length,
                textWidth: Math.ceil(maxLineW),
                textHeight: Math.ceil(textBlockH),
                bubbleWidth: bubbleW,
                bubbleHeight: bubbleH,
                effectiveMaxBubbleWidth: maxBubbleW,
                chatTrackWidth: screenInnerW
            };
        }

        function formatTextLayer(textLayer, textStr, fontSize, fillColor, justification, leading, customCandidates, customFamilyCss, emojiCandidates, emojiFamilyCss) {
            var prop = textLayer.property("Source Text");
            var doc = prop.value;
            doc.text = textStr;
            doc.fontSize = fontSize;
            doc.fillColor = fillColor;
            doc.applyFill = true;
            doc.applyStroke = false;
            doc.justification = justification;
            if (leading !== undefined && leading !== null) {
                doc.autoLeading = false;
                doc.leading = leading;
            }

            var candidates = customCandidates || ["Roboto-Regular", "Roboto", "SegoeUI", "ArialMT", "Arial"];
            for (var i = 0; i < candidates.length; i++) {
                try {
                    doc.font = candidates[i];
                    break;
                } catch (e) {}
            }
            if (customFamilyCss) {
                try { doc.fontFamily = customFamilyCss; } catch (e) {}
            }
            if (emojiFamilyCss) {
                try { doc.emojiFontFamily = emojiFamilyCss; } catch (e) {}
            }

            // Apply per-character emoji font ranges in After Effects CC 2024+ if characterRange is available
            try {
                if (typeof doc.characterRange === "function" && emojiCandidates && emojiCandidates.length > 0) {
                    var ranges = splitEmojiAndTextRanges(textStr);
                    for (var r = 0; r < ranges.length; r++) {
                        if (ranges[r].isEmoji && ranges[r].end > ranges[r].start) {
                            var charRng = doc.characterRange(ranges[r].start, ranges[r].end);
                            for (var ec = 0; ec < emojiCandidates.length; ec++) {
                                try {
                                    charRng.font = emojiCandidates[ec];
                                    break;
                                } catch (e2) {}
                            }
                        }
                    }
                }
            } catch (eRange) {}

            prop.setValue(doc);
        }

        // =====================================================================
        // 5C. CORE AFTER EFFECTS GENERATOR (Screen + Auto-Scroll + Precomp Bubbles)
        // =====================================================================
        function createSingleBubbleLayersAndPrecomp(comp, msgItem, hdr, platObj, fontObj, emojiFontObj, bubbleCenterY, scrollCtrlLayer) {
            var isSent = (msgItem.direction === "sent");
            var layout = computeBubbleLayout(msgItem.text, hdr, msgItem.showTail, msgItem.showStatus, isSent);

            var bubbleCol = isSent ? stateColors.sentBubble : stateColors.receivedBubble;
            var textCol   = isSent ? stateColors.sentText   : stateColors.receivedText;
            var timeCol   = isSent ? stateColors.sentTime   : stateColors.receivedTime;
            var checkCol  = stateColors.sentCheck;

            var tailStyleNum = 1;
            if (platObj && platObj.tailType === "classic") tailStyleNum = 2;
            else if (platObj && platObj.tailType === "none") tailStyleNum = 3;
            var statusStyleNum = (platObj && platObj.statusStyle === "rcs") ? 2 : 1;

            var radiusVal = (platObj && platObj.radius !== undefined) ? platObj.radius : 18;
            var padVal = hdr.innerPadding || 36;
            var textSizeVal = hdr.textSize || 42;
            var leadPctVal = hdr.lineSpacing || 130;
            var leadPxVal = Math.round(textSizeVal * (leadPctVal / 100));

            // Per-message or global text animation
            var doNod = chkNod.value || !!(msgItem.textAnimation && msgItem.textAnimation.nod);
            var doShake = chkShake.value || !!(msgItem.textAnimation && msgItem.textAnimation.shake);
            var doBlink = chkBlink.value || !!(msgItem.textAnimation && msgItem.textAnimation.blink);
            var decayVal = chkDecay.value ? 2.2 : 0;
            var speedVal = parseFloat(inpSpeed.text) || 3;
            var intensityVal = parseFloat(inpIntensity.text) || 16;

            // 1. Bubble_Controller (Null Layer)
            var ctrlLayer = comp.layers.addNull();
            ctrlLayer.name = "Bubble_Controller";
            ctrlLayer.label = isSent ? 9 : 11;
            var fx = ctrlLayer.property("ADBE Effect Parade");

            addControl(fx, "ADBE Slider Control",   "Start Time (s)",                   msgItem.startTime);
            addControl(fx, "ADBE Slider Control",   "Chat Track Width",                 layout.chatTrackWidth);
            addControl(fx, "ADBE Slider Control",   "Bubble Width",                     hdr.bubbleWidth || 620);
            addControl(fx, "ADBE Slider Control",   "Max Bubble Width",                 layout.effectiveMaxBubbleWidth);
            addControl(fx, "ADBE Checkbox Control", "Auto Wrap Text",                   hdr.textWrapping !== false ? 1 : 0);
            addControl(fx, "ADBE Slider Control",   "Text Size",                        textSizeVal);
            addControl(fx, "ADBE Slider Control",   "Inner Padding",                    padVal);
            addControl(fx, "ADBE Slider Control",   "Corner Radius",                    radiusVal);
            addControl(fx, "ADBE Slider Control",   "Line Spacing %",                   leadPctVal);
            addControl(fx, "ADBE Checkbox Control", "Show Tail",                        msgItem.showTail ? 1 : 0);
            addControl(fx, "ADBE Checkbox Control", "Is Sent (Right)",                  isSent ? 1 : 0);
            addControl(fx, "ADBE Slider Control",   "Tail Style (1=iOS,2=WA,3=None)",   tailStyleNum);
            addControl(fx, "ADBE Color Control",    "Bubble Color",                     bubbleCol);
            addControl(fx, "ADBE Color Control",    "Text Color",                       textCol);
            addControl(fx, "ADBE Color Control",    "Timecode Color",                   timeCol);
            addControl(fx, "ADBE Color Control",    "Status Base Color",                timeCol);
            addControl(fx, "ADBE Color Control",    "Status Read Color",                checkCol);
            addControl(fx, "ADBE Checkbox Control", "Show Timecode",                    hdr.useTimestamps !== false ? 1 : 0);
            addControl(fx, "ADBE Checkbox Control", "Show Status",                      msgItem.showStatus ? 1 : 0);
            addControl(fx, "ADBE Slider Control",   "Status Style (1=Std,2=RCS)",       statusStyleNum);
            addControl(fx, "ADBE Slider Control",   "Sent -> Delivered (s)",            hdr.sentToDeliveredDelay || 0.6);
            addControl(fx, "ADBE Slider Control",   "Delivered -> Read (s)",            hdr.deliveredToReadDelay || 1.2);
            addControl(fx, "ADBE Checkbox Control", "Entrance Animation",               hdr.entranceAnimation !== false ? 1 : 0);
            addControl(fx, "ADBE Slider Control",   "Grow Duration (frames)",           hdr.growDuration || 12);
            addControl(fx, "ADBE Slider Control",   "Typewriter Speed",                 hdr.typewriterSpeed || 0);
            addControl(fx, "ADBE Checkbox Control", "Anim: Nod",                        doNod ? 1 : 0);
            addControl(fx, "ADBE Checkbox Control", "Anim: Shake",                      doShake ? 1 : 0);
            addControl(fx, "ADBE Checkbox Control", "Anim: Blink",                      doBlink ? 1 : 0);
            addControl(fx, "ADBE Slider Control",   "Anim Decay (0=Loop)",              decayVal);
            addControl(fx, "ADBE Slider Control",   "Anim Speed",                       speedVal);
            addControl(fx, "ADBE Slider Control",   "Anim Intensity",                   intensityVal);

            // 2. Bubble_Shape (Parametric Vector Shape Layer)
            var shapeLayer = comp.layers.addShape();
            shapeLayer.name = "Bubble_Shape";
            shapeLayer.parent = ctrlLayer;

            var contents = shapeLayer.property("ADBE Root Vectors Group");
            var bubbleGrp = contents.addProperty("ADBE Vector Group");
            bubbleGrp.name = "Bubble_Geometry";
            var grpVectors = bubbleGrp.property("ADBE Vectors Group");

            var pathProp = grpVectors.addProperty("ADBE Vector Shape - Group");
            pathProp.name = "Merged_Bubble_Path";

            var initShapeData = computeShapeData(layout.bubbleWidth, layout.bubbleHeight, radiusVal, msgItem.showTail, isSent, tailStyleNum);
            var myShape = new Shape();
            myShape.vertices = initShapeData.v;
            myShape.inTangents = initShapeData.i;
            myShape.outTangents = initShapeData.o;
            myShape.closed = true;

            var rawPath = pathProp.property("ADBE Vector Shape");
            rawPath.setValue(myShape);
            safeSetExpression(rawPath, PATH_EXPR);

            var fillProp = grpVectors.addProperty("ADBE Vector Graphic - Fill");
            fillProp.name = "Bubble_Fill";
            var fillColProp = fillProp.property("ADBE Vector Fill Color");
            fillColProp.setValue(bubbleCol);
            safeSetExpression(fillColProp, "try { thisComp.layer('Bubble_Controller').effect('Bubble Color')('Color'); } catch(e) { value; }");

            var shapeTr = shapeLayer.property("ADBE Transform Group");
            var initAnchor = isSent ? [layout.bubbleWidth, layout.bubbleHeight] : [0, layout.bubbleHeight];
            var initPos = isSent ? [layout.chatTrackWidth / 2, layout.bubbleHeight / 2] : [-layout.chatTrackWidth / 2, layout.bubbleHeight / 2];
            shapeTr.property("ADBE Anchor Point").setValue(initAnchor);
            safeSetExpression(shapeTr.property("ADBE Anchor Point"), BUBBLE_ANCHOR_EXPR);
            shapeTr.property("ADBE Position").setValue(initPos);
            safeSetExpression(shapeTr.property("ADBE Position"), BUBBLE_POS_EXPR);
            safeSetExpression(shapeTr.property("ADBE Scale"), BUBBLE_GROW_EXPR);
            safeSetExpression(shapeTr.property("ADBE Opacity"), BUBBLE_OPACITY_EXPR);

            // 3. Message_Text Layer
            var textLayer = comp.layers.addText(layout.wrappedText);
            textLayer.name = "Message_Text";
            textLayer.parent = shapeLayer;

            formatTextLayer(
                textLayer,
                layout.wrappedText,
                textSizeVal,
                textCol,
                ParagraphJustification.LEFT_JUSTIFY,
                leadPxVal,
                fontObj ? fontObj.aeCandidates : null,
                fontObj ? fontObj.family : null,
                emojiFontObj ? emojiFontObj.aeCandidates : null,
                emojiFontObj ? emojiFontObj.family : null
            );
            safeSetExpression(textLayer.property("Source Text"), DYNAMIC_WRAP_EXPR);

            var txtTr = textLayer.property("ADBE Transform Group");
            txtTr.property("ADBE Anchor Point").setValue([0, -textSizeVal * 0.82]);
            safeSetExpression(txtTr.property("ADBE Anchor Point"), "try { var r = sourceRectAtTime(Math.max(5, time), false); [r.left, r.top]; } catch(e) { value; }");
            txtTr.property("ADBE Position").setValue([padVal, padVal]);
            safeSetExpression(txtTr.property("ADBE Position"), "try { var p = thisComp.layer('Bubble_Controller').effect('Inner Padding')('Slider'); [p, p]; } catch(e) { value; }");
            safeSetExpression(txtTr.property("ADBE Opacity"), BUBBLE_OPACITY_EXPR);

            // Add Per-Character Text Animator (Nod, Shake, Blink + Dynamic Text Color)
            try {
                var txtPropGroup = textLayer.property("ADBE Text Properties");
                var animators = txtPropGroup.property("ADBE Text Animators");
                var anim = animators.addProperty("ADBE Text Animator");
                anim.name = "Dynamic_Text_FX";
                var animProps = anim.property("ADBE Text Animator Properties");

                var fillColorAnim = animProps.addProperty("ADBE Text Fill Color");
                fillColorAnim.setValue(textCol);
                safeSetExpression(fillColorAnim, "try { thisComp.layer('Bubble_Controller').effect('Text Color')('Color'); } catch(e) { value; }");

                var posAnim = animProps.addProperty("ADBE Text Position 3D");
                posAnim.setValue([0, 0, 0]);
                var scaleAnim = animProps.addProperty("ADBE Text Scale 3D");
                scaleAnim.setValue([100, 100, 100]);
                var rotAnim = animProps.addProperty("ADBE Text Rotation");
                rotAnim.setValue(0);
                var opAnim = animProps.addProperty("ADBE Text Opacity");
                opAnim.setValue(100);

                var selectors = anim.property("ADBE Text Selectors");
                var exprSel = selectors.addProperty("ADBE Text Expressible Selector");
                exprSel.name = "Wave_Expression_Selector";
                var amountProp = exprSel.property("ADBE Text Expressible Amount");

                posAnim.setValue([1, 1, 0]);
                safeSetExpression(posAnim, POS_ANIM_EXPR);
                safeSetExpression(scaleAnim, SCALE_ANIM_EXPR);
                safeSetExpression(rotAnim, ROT_ANIM_EXPR);
                safeSetExpression(opAnim, OPACITY_ANIM_EXPR);
                safeSetExpression(amountProp, "[100, 100, 100];");
            } catch (eAnim) {}

            // 4. Timecode_Text Layer
            var timeSize = Math.max(14, Math.round(textSizeVal * 0.50));
            var timeLayer = comp.layers.addText(msgItem.formattedTimestamp);
            timeLayer.name = "Timecode_Text";
            timeLayer.parent = shapeLayer;

            formatTextLayer(
                timeLayer,
                msgItem.formattedTimestamp,
                timeSize,
                timeCol,
                ParagraphJustification.RIGHT_JUSTIFY,
                timeSize,
                fontObj ? fontObj.aeCandidates : null,
                fontObj ? fontObj.family : null,
                emojiFontObj ? emojiFontObj.aeCandidates : null,
                emojiFontObj ? emojiFontObj.family : null
            );

            var timeTr = timeLayer.property("ADBE Transform Group");
            safeSetExpression(timeTr.property("ADBE Anchor Point"), "try { var r = sourceRectAtTime(0, false); [r.left + r.width, r.top + r.height]; } catch(e) { value; }");
            var statusOffsetInit = (msgItem.showStatus && isSent) ? 38 : 0;
            timeTr.property("ADBE Position").setValue([layout.bubbleWidth - padVal * 0.6 - statusOffsetInit, layout.bubbleHeight - 14]);
            safeSetExpression(timeTr.property("ADBE Position"), TIMECODE_POS_EXPR);
            timeTr.property("ADBE Opacity").setValue(hdr.useTimestamps !== false ? 80 : 0);
            safeSetExpression(timeTr.property("ADBE Opacity"), TIMECODE_ENTRANCE_EXPR);

            // 5. Status_Check Layer (Standard Text Checkmarks ✓ -> ✓✓)
            var statSize = Math.max(14, Math.round(textSizeVal * 0.52));
            var initCheckStr = (statusStyleNum === 2) ? "\u25CB\u2713 \u25CB\u2713" : "\u2713\u2713";
            var statLayer = comp.layers.addText(initCheckStr);
            statLayer.name = "Status_Check";
            statLayer.parent = shapeLayer;

            formatTextLayer(
                statLayer,
                initCheckStr,
                statSize,
                checkCol,
                ParagraphJustification.RIGHT_JUSTIFY,
                statSize,
                fontObj ? fontObj.aeCandidates : null,
                fontObj ? fontObj.family : null,
                emojiFontObj ? emojiFontObj.aeCandidates : null,
                emojiFontObj ? emojiFontObj.family : null
            );
            safeSetExpression(statLayer.property("Source Text"), STATUS_TEXT_EXPR);

            try {
                var statAnimators = statLayer.property("ADBE Text Properties").property("ADBE Text Animators");
                var statAnim = statAnimators.addProperty("ADBE Text Animator");
                statAnim.name = "Read_Receipt_Color";
                var statFill = statAnim.property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");
                statFill.setValue(checkCol);
                safeSetExpression(statFill, STATUS_COLOR_EXPR);
            } catch (eStat) {}

            var statTr = statLayer.property("ADBE Transform Group");
            safeSetExpression(statTr.property("ADBE Anchor Point"), "try { var r = sourceRectAtTime(0, false); [r.left + r.width, r.top + r.height]; } catch(e) { value; }");
            statTr.property("ADBE Position").setValue([layout.bubbleWidth - padVal * 0.55, layout.bubbleHeight - 14]);
            safeSetExpression(statTr.property("ADBE Position"), STATUS_POS_EXPR);
            safeSetExpression(statTr.property("ADBE Scale"), STATUS_SCALE_EXPR);
            statTr.property("ADBE Opacity").setValue((msgItem.showStatus && isSent && statusStyleNum !== 2) ? 95 : 0);
            safeSetExpression(statTr.property("ADBE Opacity"), STATUS_TEXT_OPACITY_EXPR);

            // 6. Status_RCS_Check Layer (Vector Circled Checkmarks ○✓ -> ○✓ ○✓)
            var rcsLayer = comp.layers.addShape();
            rcsLayer.name = "Status_RCS_Check";
            rcsLayer.parent = shapeLayer;

            var rcsContents = rcsLayer.property("ADBE Root Vectors Group");
            var rcsLeftGrp = rcsContents.addProperty("ADBE Vector Group");
            rcsLeftGrp.name = "Left_Badge";
            var rcsLeftVecs = rcsLeftGrp.property("ADBE Vectors Group");
            var leftCirclePath = rcsLeftVecs.addProperty("ADBE Vector Shape - Group");
            safeSetExpression(leftCirclePath.property("ADBE Vector Shape"), RCS_CIRCLE_PATH_EXPR);
            safeSetExpression(rcsLeftGrp.property("ADBE Vector Transform Group").property("ADBE Vector Position"), RCS_LEFT_CIRCLE_POS_EXPR);
            var leftTickPath = rcsLeftVecs.addProperty("ADBE Vector Shape - Group");
            safeSetExpression(leftTickPath.property("ADBE Vector Shape"), RCS_LEFT_TICK_PATH_EXPR);
            var leftStroke = rcsLeftVecs.addProperty("ADBE Vector Graphic - Stroke");
            leftStroke.property("ADBE Vector Stroke Width").setValue(2.0);
            safeSetExpression(leftStroke.property("ADBE Vector Stroke Color"), STATUS_COLOR_EXPR);

            var rcsRightGrp = rcsContents.addProperty("ADBE Vector Group");
            rcsRightGrp.name = "Right_Badge";
            var rcsRightVecs = rcsRightGrp.property("ADBE Vectors Group");
            var rightCirclePath = rcsRightVecs.addProperty("ADBE Vector Shape - Group");
            safeSetExpression(rightCirclePath.property("ADBE Vector Shape"), RCS_CIRCLE_PATH_EXPR);
            safeSetExpression(rcsRightGrp.property("ADBE Vector Transform Group").property("ADBE Vector Position"), RCS_RIGHT_CIRCLE_POS_EXPR);
            var rightTickPath = rcsRightVecs.addProperty("ADBE Vector Shape - Group");
            safeSetExpression(rightTickPath.property("ADBE Vector Shape"), RCS_RIGHT_TICK_PATH_EXPR);
            var rightStroke = rcsRightVecs.addProperty("ADBE Vector Graphic - Stroke");
            rightStroke.property("ADBE Vector Stroke Width").setValue(2.0);
            safeSetExpression(rightStroke.property("ADBE Vector Stroke Color"), STATUS_COLOR_EXPR);
            safeSetExpression(rcsRightGrp.property("ADBE Vector Transform Group").property("ADBE Vector Opacity"), RCS_RIGHT_OPACITY_EXPR);

            var rcsTr = rcsLayer.property("ADBE Transform Group");
            rcsTr.property("ADBE Position").setValue([layout.bubbleWidth - padVal * 0.55, layout.bubbleHeight - 14]);
            safeSetExpression(rcsTr.property("ADBE Position"), STATUS_POS_EXPR);
            safeSetExpression(rcsTr.property("ADBE Scale"), STATUS_SCALE_EXPR);
            rcsTr.property("ADBE Opacity").setValue((msgItem.showStatus && isSent && statusStyleNum === 2) ? 95 : 0);
            safeSetExpression(rcsTr.property("ADBE Opacity"), STATUS_RCS_OPACITY_EXPR);

            // Order layers top-to-bottom before precomposing
            ctrlLayer.moveToBeginning();
            rcsLayer.moveAfter(ctrlLayer);
            statLayer.moveAfter(rcsLayer);
            timeLayer.moveAfter(statLayer);
            textLayer.moveAfter(timeLayer);
            shapeLayer.moveAfter(textLayer);

            // 7. Precompose the 6 bubble layers into a dedicated precomp
            var precompLayerLayerIndices = [
                ctrlLayer.index,
                rcsLayer.index,
                statLayer.index,
                timeLayer.index,
                textLayer.index,
                shapeLayer.index
            ];

            var numStr = (msgItem.index + 1 < 10 ? "0" : "") + (msgItem.index + 1);
            var randHex = "";
            var hexChars = "0123456789ABCDEF";
            for (var rh = 0; rh < 4; rh++) {
                randHex += hexChars.charAt(Math.floor(Math.random() * 16));
            }
            var preCompName = "bubble_" + numStr + "_" + randHex;

            try {
                var preComp = comp.layers.precompose(precompLayerLayerIndices, preCompName, true);
                var preCompLayer = getLayer(comp, preCompName);
                if (preCompLayer && scrollCtrlLayer) {
                    preCompLayer.parent = scrollCtrlLayer;
                    preCompLayer.label = isSent ? 9 : 11;
                    var pcTr = preCompLayer.property("ADBE Transform Group");
                    pcTr.property("ADBE Anchor Point").setValue([preComp.width / 2, preComp.height / 2, 0]);
                    pcTr.property("ADBE Position").setValue([0, bubbleCenterY, 0]);
                    safeSetExpression(pcTr.property("ADBE Opacity"), BUBBLE_PRECOMP_OPACITY_EXPR);
                }
            } catch (ePre) {}

            return layout;
        }

        function getCompLayerCount(comp) {
            if (!comp) return 0;
            if (typeof comp.numLayers === "number") return comp.numLayers;
            if (comp.layers && typeof comp.layers.length === "number") return comp.layers.length;
            return 0;
        }

        function removeExistingChatRig(comp) {
            try {
                var count = getCompLayerCount(comp);
                for (var i = count; i >= 1; i--) {
                    var lyr = getLayer(comp, i);
                    var nm = (lyr && lyr.name) ? lyr.name : "";
                    if (
                        nm === "Chat_Master_Controller" ||
                        nm === "Chat_Scroll_Controller" ||
                        nm === "Chat_Screen_BG" ||
                        nm.indexOf("bubble_") === 0
                    ) {
                        try { lyr.remove(); } catch (eRem) {}
                    }
                }
            } catch (e) {}
        }

        function buildScriptedChat(replaceExistingInComp) {
            var entry = getCurrentConversationEntry();
            if (!entry || !entry.data) {
                alert("Please select a valid conversation .JSON from the pull-down first.");
                return;
            }

            var hdr = collectHeaderFromUI();
            var schedule = computeConversationSchedule(entry.data, hdr);
            if (schedule.length === 0) {
                alert("The selected conversation has no messages.");
                return;
            }

            // Calculate total required composition duration
            var lastItem = schedule[schedule.length - 1];
            var totalTimelineNeeded = lastItem.startTime + calculateReadDuration(lastItem.text) + 2.5;

            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                var compW = Math.max(1080, (hdr.screenWidth || 960) + 120);
                var compH = Math.max(1920, (hdr.screenHeight || 1680) + 240);
                var compDur = Math.max(12, Math.ceil(totalTimelineNeeded));
                comp = app.project.items.addComp("Scripted_Chat_Comp", compW, compH, 1.0, compDur, 30);
                comp.openInViewer();
            } else {
                if (comp.duration < totalTimelineNeeded) {
                    try { comp.duration = Math.ceil(totalTimelineNeeded); } catch (eDur) {}
                }
            }

            app.beginUndoGroup("Generate Scripted Chat Conversation");

            try {
                if (replaceExistingInComp) {
                    removeExistingChatRig(comp);
                }

                // Resolve Platform, Font, and Emoji Font
                var platName = hdr.platform || "Android RCS";
                var platObj = PLATFORMS[platName] || PLATFORMS["Android RCS"] || PLATFORMS[platformKeys[0]];
                var fontObj = FONTS[0];
                for (var fi = 0; fi < FONTS.length; fi++) {
                    if (FONTS[fi].name === hdr.font) {
                        fontObj = FONTS[fi];
                        break;
                    }
                }
                var emojiFontObj = EMOJI_FONTS[0];
                for (var ei = 0; ei < EMOJI_FONTS.length; ei++) {
                    if (EMOJI_FONTS[ei].name === hdr.emojiFont || EMOJI_FONTS[ei].name.indexOf(hdr.emojiFont) === 0) {
                        emojiFontObj = EMOJI_FONTS[ei];
                        break;
                    }
                }

                var screenW = hdr.screenWidth || 960;
                var screenH = hdr.screenHeight || 1680;
                var screenPad = hdr.screenInnerPadding !== undefined ? hdr.screenInnerPadding : 48;
                var screenRad = hdr.screenCornerRadius !== undefined ? hdr.screenCornerRadius : 64;
                var bubbleGap = hdr.bubbleGap !== undefined ? hdr.bubbleGap : 24;

                // 1. Create Chat_Master_Controller (Null at center of composition)
                var masterCtrl = comp.layers.addNull();
                masterCtrl.name = "Chat_Master_Controller";
                masterCtrl.label = 10; // Purple
                var mTr = masterCtrl.property("ADBE Transform Group");
                mTr.property("ADBE Anchor Point").setValue([0, 0, 0]);
                mTr.property("ADBE Position").setValue([comp.width / 2, comp.height / 2, 0]);

                var mFx = masterCtrl.property("ADBE Effect Parade");
                addControl(mFx, "ADBE Checkbox Control", "Show Chat Screen",            hdr.screenVisible !== false ? 1 : 0);
                addControl(mFx, "ADBE Slider Control",   "Screen Opacity",              hdr.screenOpacity !== undefined ? hdr.screenOpacity : 100);
                addControl(mFx, "ADBE Slider Control",   "Screen Width",                screenW);
                addControl(mFx, "ADBE Slider Control",   "Screen Height",               screenH);
                addControl(mFx, "ADBE Slider Control",   "Screen Inner Padding",        screenPad);
                addControl(mFx, "ADBE Slider Control",   "Screen Corner Radius",        screenRad);
                addControl(mFx, "ADBE Color Control",    "Screen Background Color",     stateColors.screenBg);
                addControl(mFx, "ADBE Checkbox Control", "Auto Scroll on Overflow",     hdr.autoScroll !== false ? 1 : 0);
                addControl(mFx, "ADBE Checkbox Control", "Clip Bubbles Outside Screen", hdr.clipToScreen !== false ? 1 : 0);
                addControl(mFx, "ADBE Slider Control",   "Scroll Smoothness (frames)",  hdr.scrollSmoothnessFrames || 12);
                addControl(mFx, "ADBE Slider Control",   "Manual Scroll Offset Y",      0);
                addControl(mFx, "ADBE Slider Control",   "Real Delay (s)",              hdr.realDelayBetweenBubbles || 1.0);
                addControl(mFx, "ADBE Slider Control",   "Bubble Vertical Gap",         bubbleGap);

                // 2. Create Chat_Screen_BG (Parametric Rounded Rectangle Shape Layer)
                var screenLayer = comp.layers.addShape();
                screenLayer.name = "Chat_Screen_BG";
                screenLayer.label = 14; // Cyan
                screenLayer.parent = masterCtrl;

                var scrContents = screenLayer.property("ADBE Root Vectors Group");
                var scrGrp = scrContents.addProperty("ADBE Vector Group");
                scrGrp.name = "Screen_Rect_Geometry";
                var scrVecs = scrGrp.property("ADBE Vectors Group");
                var scrPathGrp = scrVecs.addProperty("ADBE Vector Shape - Group");
                scrPathGrp.name = "Screen_Rounded_Path";

                var scrInitData = computeScreenRectData(screenW, screenH, screenRad);
                var scrShape = new Shape();
                scrShape.vertices = scrInitData.v;
                scrShape.inTangents = scrInitData.i;
                scrShape.outTangents = scrInitData.o;
                scrShape.closed = true;

                var scrRawPath = scrPathGrp.property("ADBE Vector Shape");
                scrRawPath.setValue(scrShape);
                safeSetExpression(scrRawPath, SCREEN_PATH_EXPR);

                var scrFill = scrVecs.addProperty("ADBE Vector Graphic - Fill");
                scrFill.name = "Screen_Fill";
                var scrFillCol = scrFill.property("ADBE Vector Fill Color");
                scrFillCol.setValue(stateColors.screenBg);
                safeSetExpression(scrFillCol, "try { thisComp.layer('Chat_Master_Controller').effect('Screen Background Color')('Color'); } catch(e) { value; }");

                var scrTr = screenLayer.property("ADBE Transform Group");
                scrTr.property("ADBE Anchor Point").setValue([0, 0, 0]);
                scrTr.property("ADBE Position").setValue([0, 0, 0]);
                scrTr.property("ADBE Opacity").setValue(hdr.screenVisible !== false ? (hdr.screenOpacity !== undefined ? hdr.screenOpacity : 100) : 0);
                safeSetExpression(scrTr.property("ADBE Opacity"), SCREEN_OPACITY_EXPR);

                // 3. Create Chat_Scroll_Controller (Null parented to Chat_Master_Controller)
                var scrollCtrl = comp.layers.addNull();
                scrollCtrl.name = "Chat_Scroll_Controller";
                scrollCtrl.label = 13; // Yellow
                scrollCtrl.parent = masterCtrl;
                var scTr = scrollCtrl.property("ADBE Transform Group");
                scTr.property("ADBE Anchor Point").setValue([0, 0, 0]);
                scTr.property("ADBE Position").setValue([0, 0, 0]);

                // 4. Generate Each Bubble Precomp and Stack Vertically inside Screen Inner Area
                var currentTopRelScreenTop = 0; // Measured relative to top inner padding edge (-screenH/2 + screenPad)
                var scrollMeta = [];

                for (var bi = 0; bi < schedule.length; bi++) {
                    var msgItem = schedule[bi];
                    var isSent = (msgItem.direction === "sent");
                    var previewLayout = computeBubbleLayout(msgItem.text, hdr, msgItem.showTail, msgItem.showStatus, isSent);

                    var bubbleH = previewLayout.bubbleHeight;
                    var bubbleCenterY = (-screenH / 2) + screenPad + currentTopRelScreenTop + (bubbleH / 2);
                    var bottomEdgeRelTop = currentTopRelScreenTop + bubbleH;

                    createSingleBubbleLayersAndPrecomp(
                        comp,
                        msgItem,
                        hdr,
                        platObj,
                        fontObj,
                        emojiFontObj,
                        bubbleCenterY,
                        scrollCtrl
                    );

                    scrollMeta.push({
                        startTime: msgItem.startTime,
                        bottomEdgeRelTop: bottomEdgeRelTop
                    });

                    currentTopRelScreenTop += bubbleH + bubbleGap;
                }

                // 5. Bind Auto-Scroll Expression to Chat_Scroll_Controller Position
                var scrollExpr = buildScrollControllerExpr(scrollMeta);
                safeSetExpression(scTr.property("ADBE Position"), scrollExpr);

                // 6. Keep Master Controller & Scroll Controller at Top, Screen BG at Bottom
                try {
                    masterCtrl.moveToBeginning();
                    scrollCtrl.moveAfter(masterCtrl);
                    screenLayer.moveToEnd();
                } catch (eOrder) {}

                // Select Master Controller so user immediately sees Effect Controls
                var totalLayersNow = getCompLayerCount(comp);
                for (var s = 1; s <= totalLayersNow; s++) {
                    var sl = getLayer(comp, s);
                    if (sl) sl.selected = false;
                }
                masterCtrl.selected = true;

            } catch (err) {
                alert("Error generating scripted chat:\n" + err.toString() + " (Line: " + (err.line || "?") + ")");
            } finally {
                app.endUndoGroup();
            }
        }

        // Check if active comp already has a Chat_Master_Controller to toggle button label
        function checkSelectionState() {
            var comp = (app && app.project) ? app.project.activeItem : null;
            if (comp && (comp instanceof CompItem)) {
                var master = findLayerByName(comp, "Chat_Master_Controller");
                if (master) {
                    btnGenerate.text = "Update / Rebuild Scripted Chat";
                    return true;
                }
            }
            btnGenerate.text = "Generate Scripted Chat";
            return false;
        }

        win.onActivate = function () {
            checkSelectionState();
        };

        btnGenerate.onClick = function () {
            var hasExisting = checkSelectionState();
            buildScriptedChat(hasExisting);
            checkSelectionState();
        };

        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        win.layout.layout(true);
        if (win instanceof Window) {
            win.center();
            win.show();
        }
    }

    createUI(this);

})(this);
