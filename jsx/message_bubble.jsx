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
//      - Android RCS Style (Google Messages Material You)
//      - iOS Message Style (Apple iMessage)
//      - WhatsApp Style (with delivery checkmarks)
//      - Instagram Style (Instagram Direct signature vibrant violet/purple & pill capsules)
//      - Facebook Messenger Style (Facebook Messenger iconic blue & soft grey cards)
//      - Custom Style (fully customizable bubble and text colors)
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
    // 2. Color Palettes by Platform, Direction & Theme
    // -------------------------------------------------------------------------
    var PLATFORMS = {
        "Android RCS": {
            light: {
                sent:     { bubble: "#0b57d0", text: "#ffffff", time: "rgba(255,255,255,0.75)", check: "" },
                received: { bubble: "#f1f3f4", text: "#1f1f1f", time: "#70757a", check: "" }
            },
            dark: {
                sent:     { bubble: "#a8c7fa", text: "#041e49", time: "rgba(4,30,73,0.75)", check: "" },
                received: { bubble: "#303134", text: "#e3e3e3", time: "#9aa0a6", check: "" }
            },
            radius: 18,
            tailType: "modern"
        },
        "iOS Message": {
            light: {
                sent:     { bubble: "#007aff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#e9e9eb", text: "#000000", time: "#8e8e93", check: "" }
            },
            dark: {
                sent:     { bubble: "#0a84ff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#26252a", text: "#ffffff", time: "#8e8e93", check: "" }
            },
            radius: 18,
            tailType: "ios"
        },
        "WhatsApp": {
            light: {
                sent:     { bubble: "#d9fdd3", text: "#111b21", time: "#667781", check: "✓✓" },
                received: { bubble: "#ffffff", text: "#111b21", time: "#667781", check: "" }
            },
            dark: {
                sent:     { bubble: "#005c4b", text: "#e9edef", time: "#8696a0", check: "✓✓" },
                received: { bubble: "#202c33", text: "#e9edef", time: "#8696a0", check: "" }
            },
            radius: 10,
            tailType: "whatsapp"
        },
        "Instagram": {
            light: {
                sent:     { bubble: "#7839ee", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#efefef", text: "#000000", time: "#8e8e93", check: "" }
            },
            dark: {
                sent:     { bubble: "#7c3aed", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#262626", text: "#f5f5f5", time: "#a8a8a8", check: "" }
            },
            radius: 20,
            tailType: "instagram"
        },
        "Facebook Messenger": {
            light: {
                sent:     { bubble: "#0084ff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "✓" },
                received: { bubble: "#e4e6eb", text: "#050505", time: "#65676b", check: "" }
            },
            dark: {
                sent:     { bubble: "#0084ff", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "✓" },
                received: { bubble: "#303030", text: "#e4e6eb", time: "#b0b3b8", check: "" }
            },
            radius: 18,
            tailType: "messenger"
        },
        "Custom": {
            light: {
                sent:     { bubble: "#2563eb", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#f3f4f6", text: "#111827", time: "#6b7280", check: "" }
            },
            dark: {
                sent:     { bubble: "#3b82f6", text: "#ffffff", time: "rgba(255,255,255,0.70)", check: "" },
                received: { bubble: "#1f2937", text: "#f9fafb", time: "#9ca3af", check: "" }
            },
            radius: 16,
            tailType: "modern"
        }
    };

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
        "// 5-Frame Bubble Entrance Grow Animation",
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
        "    var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
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
        "// 5-Frame Typewriter Effect starting after Bubble Grow",
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
        "    var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "    var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(eFps) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "",
        "    var f = time / fd;",
        "    var fullStr = String(value);",
        "    if (f < growFrames) return '';",
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
        "    var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "    var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
        "    var fps = 30;",
        "    try { fps = thisComp.frameRate; } catch(eFps) {}",
        "    var fd = 1.0 / fps;",
        "    try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "",
        "    var f = time / fd;",
        "    var startF = growFrames + typeFrames;",
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
        "        var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        if ((time / fd) < (growFrames + typeFrames)) return value;",
        "    }",
        "",
        "    var animOn = getVal('Animate Entrance', 1);",
        "    if (animOn > 0) {",
        "        var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
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
        "        var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
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
        "        var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
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
        "        var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
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
        if (!text || !text.trim()) return 1.5;
        var trimmed = text.trim();
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
        "        var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
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
        "        var growFrames = Math.max(1, getVal('Bubble Grow Duration (frames)', 5));",
        "        var typeFrames = Math.max(1, getVal('Typewriter Duration (frames)', 5));",
        "        var fps = 30;",
        "        try { fps = thisComp.frameRate; } catch(eFps) {}",
        "        var fd = 1.0 / fps;",
        "        try { if (thisComp.frameDuration) fd = thisComp.frameDuration; } catch(eFd) {}",
        "        settleTime = (growFrames + typeFrames) * fd;",
        "    }",
        "    var deliveredTime = settleTime + getVal('Delivered Time (s)', 0.8);",
        "    var readTime = deliveredTime + getVal('Read Time (s)', 3.5);",
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
        "    var readTime = getVal('Read Time (s)', 3.5);",
        "    if (time >= readTime && time < (readTime + 0.35)) {",
        "        var dt = time - readTime;",
        "        var pop = Math.sin((dt / 0.35) * Math.PI) * 25;",
        "        return [value[0] + pop, value[1] + pop];",
        "    }",
        "    return value;",
        "})();"
    ].join("\n");

    var currentRandomTime = generateRandomTime();

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
    // 5. Platform Style & Theme Configuration
    // -------------------------------------------------------------------------
    var pnlStyle = win.add("panel", undefined, "Platform & Appearance");
    pnlStyle.orientation = "column";
    pnlStyle.alignChildren = ["fill", "top"];
    pnlStyle.spacing = 8;
    pnlStyle.margins = 10;

    // Platform Pull Down (Dropdown)
    var grpPlatform = pnlStyle.add("group");
    grpPlatform.orientation = "row";
    grpPlatform.alignChildren = ["left", "center"];
    var lblPlatform = grpPlatform.add("statictext", undefined, "Style Preset:");
    lblPlatform.preferredSize = [95, -1];

    var dropPlatform = grpPlatform.add("dropdownlist", undefined, [
        "Android RCS style",
        "iOS message style",
        "WhatsApp style",
        "Instagram style",
        "Facebook Messenger style",
        "Custom style"
    ]);
    dropPlatform.selection = 1; // Default: iOS message style
    dropPlatform.preferredSize = [185, 26];

    // Direction Switch: Received (Left) vs Sent (Right)
    var grpDirection = pnlStyle.add("group");
    grpDirection.orientation = "row";
    grpDirection.alignChildren = ["left", "center"];
    var lblDirection = grpDirection.add("statictext", undefined, "Message Type:");
    lblDirection.preferredSize = [95, -1];

    var radSent = grpDirection.add("radiobutton", undefined, "Sent (Right)");
    var radReceived = grpDirection.add("radiobutton", undefined, "Received (Left)");
    radSent.value = true; // Default: Sent

    // Theme Switch: Light vs Dark Theme
    var grpTheme = pnlStyle.add("group");
    grpTheme.orientation = "row";
    grpTheme.alignChildren = ["left", "center"];
    var lblTheme = grpTheme.add("statictext", undefined, "Color Theme:");
    lblTheme.preferredSize = [95, -1];

    var radLight = grpTheme.add("radiobutton", undefined, "Light Theme");
    var radDark = grpTheme.add("radiobutton", undefined, "Dark Theme");
    radLight.value = true; // Default: Light Theme

    // Tail / Pointer Switch
    var grpTail = pnlStyle.add("group");
    grpTail.orientation = "row";
    grpTail.alignChildren = ["left", "center"];
    var lblTail = grpTail.add("statictext", undefined, "Bubble Tail:");
    lblTail.preferredSize = [95, -1];

    var chkTail = grpTail.add("checkbox", undefined, "Show Tail / Pointer");
    chkTail.value = true; // Default: Show Tail
    chkTail.helpTip = "Toggle the chat pointer / tail at the bottom corner of the message bubble.";

    // Status Icon (Sent / Received / Read / Auto Timing)
    var grpStatus = pnlStyle.add("group");
    grpStatus.orientation = "row";
    grpStatus.alignChildren = ["left", "center"];
    var lblStatus = grpStatus.add("statictext", undefined, "Status Icon:");
    lblStatus.preferredSize = [95, -1];

    var dropStatus = grpStatus.add("dropdownlist", undefined, [
        "Auto (Timing Simulation)",
        "Read (✓✓)",
        "Delivered (✓✓)",
        "Sent (✓)",
        "None"
    ]);
    dropStatus.selection = 0; // Default: Auto (Timing Simulation)
    dropStatus.preferredSize = [185, 26];
    dropStatus.helpTip = "Auto: simulates sent -> delivered -> read timing based on text reading speed. Or choose static status.";

    var grpStatusInfo = pnlStyle.add("group");
    grpStatusInfo.orientation = "row";
    grpStatusInfo.alignChildren = ["left", "center"];
    var lblStatusInfoPad = grpStatusInfo.add("statictext", undefined, "");
    lblStatusInfoPad.preferredSize = [95, -1];
    var lblStatusInfo = grpStatusInfo.add("statictext", undefined, "⏱ Auto Read: ~4.2s (based on text length)");
    lblStatusInfo.helpTip = "Calculated reading duration based on character and word count.";

    dropStatus.onChange = function() {
        var isAuto = (dropStatus.selection && dropStatus.selection.index === 0);
        grpStatusInfo.visible = isAuto;
    };

    // -------------------------------------------------------------------------
    // 6. Dimensions & Typography (Screen Width, Fonts, Padding, Leading)
    // -------------------------------------------------------------------------
    var pnlDim = win.add("panel", undefined, "Layout & Typography");
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

    // -------------------------------------------------------------------------
    // 7. iOS 18 Text Effects & Animation Section
    // -------------------------------------------------------------------------
    var pnlAnim = win.add("panel", undefined, "Text Effects & Animation (iOS 18)");
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

    // Entrance Animation Row (Grow 5f + Typewriter 5f)
    var grpEntrance = pnlAnim.add("group");
    grpEntrance.orientation = "row";
    grpEntrance.alignChildren = ["left", "center"];
    var chkEntrance = grpEntrance.add("checkbox", undefined, "Entrance Animation (Grow 5f + Typewriter 5f)");
    chkEntrance.value = true; // Default: Enabled
    chkEntrance.helpTip = "Animate the bubble growing from left/right (5 frames), followed by a 5-frame typewriter text reveal.";

    // -------------------------------------------------------------------------
    // 8. Timestamp Section (Random time + Re-roll)
    // -------------------------------------------------------------------------
    var pnlTime = win.add("panel", undefined, "Timestamp (Randomized)");
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

    // -------------------------------------------------------------------------
    // 8. Color Picker Helper & Live Colors Panel
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

    // Colors & Appearance Panel (Always shown, with live color swatch buttons & hex inputs)
    var pnlColors = win.add("panel", undefined, "Colors & Appearance");
    pnlColors.orientation = "column";
    pnlColors.alignChildren = ["fill", "top"];
    pnlColors.spacing = 8;
    pnlColors.margins = 10;

    var cpBubble = createColorPicker(pnlColors, "#007AFF", "Bubble Color:", 95);
    var cpText = createColorPicker(pnlColors, "#FFFFFF", "Text Color:", 95);

    function syncColorsFromPlatform() {
        var selIdx = dropPlatform.selection ? dropPlatform.selection.index : 0;
        var platformKeys = ["Android RCS", "iOS Message", "WhatsApp", "Instagram", "Facebook Messenger", "Custom"];
        var platformName = platformKeys[selIdx] || "iOS Message";
        if (platformName === "Custom") return;

        var isSent = radSent.value;
        var isDark = radDark.value;
        var themeKey = isDark ? "dark" : "light";
        var dirKey = isSent ? "sent" : "received";
        var colorSet = PLATFORMS[platformName][themeKey][dirKey];

        if (colorSet) {
            cpBubble.setColor(colorSet.bubble, false);
            cpText.setColor(colorSet.text, false);
        }

        if (typeof dropFont !== "undefined" && dropFont) {
            if (platformName === "Android RCS") dropFont.selection = 1; // Roboto
            else if (platformName === "iOS Message" || platformName === "Instagram") dropFont.selection = 0; // SF Pro
            else if (platformName === "WhatsApp") dropFont.selection = 3; // Helvetica Neue
            else if (platformName === "Facebook Messenger") dropFont.selection = 2; // Segoe UI
        }
    }

    dropPlatform.onChange = function() {
        syncColorsFromPlatform();
    };
    radSent.onClick = function() {
        syncColorsFromPlatform();
    };
    radReceived.onClick = function() {
        syncColorsFromPlatform();
    };
    radLight.onClick = function() {
        syncColorsFromPlatform();
    };
    radDark.onClick = function() {
        syncColorsFromPlatform();
    };

    cpBubble.onChange = function() {
        dropPlatform.selection = 5; // Switch to Custom style
    };
    cpText.onChange = function() {
        dropPlatform.selection = 5; // Switch to Custom style
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
            if (measureStr(testLine) > maxPixelWidth && currentLine.trim().length > 0) {
                lines.push(currentLine.trim());
                currentLine = word.trimStart();
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine.length > 0) {
            lines.push(currentLine.trim());
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
            var platformKeys = ["Android RCS", "iOS Message", "WhatsApp", "Instagram", "Facebook Messenger", "Custom"];
            var platformName = platformKeys[selStyleIdx] || "iOS Message";
            var platformCfg = PLATFORMS[platformName] || PLATFORMS["iOS Message"];

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
            var statusString = "";
            var statusColor = timeColor;

            var deliveredTime = 0.8;
            var readDuration = calculateReadDuration(msgText);
            var readTime = Math.round((deliveredTime + readDuration) * 10) / 10;
            var readColor = isDark ? [0.33, 0.74, 0.92] : [0.20, 0.72, 0.95];

            if (isSent) {
                if (selStatusIdx === 0) {
                    // Auto: Sent at t=0, Delivered at t=0.8s, Read at t=readTime
                    statusString = "✓✓"; // Allocate space for double checks
                    statusColor = timeColor; // Initial neutral color
                } else if (selStatusIdx === 1) {
                    // Read (✓✓)
                    statusString = "✓✓";
                    statusColor = readColor;
                } else if (selStatusIdx === 2) {
                    // Delivered (✓✓)
                    statusString = "✓✓";
                    statusColor = timeColor;
                } else if (selStatusIdx === 3) {
                    // Sent (✓)
                    statusString = "✓";
                    statusColor = timeColor;
                } else {
                    // None (4)
                    statusString = "";
                }
            }

            var timeString = currentRandomTime;
            var timeFontSize = Math.max(10, Math.round(textSize * 0.58));
            var timeW = Math.round(timeString.length * timeFontSize * 0.55);
            var statusW = statusString ? Math.round(timeFontSize * 1.35) : 0;
            var statusSpacing = statusString ? 6 : 0;
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

                var effDelivered = parade.addProperty("ADBE Slider Control");
                if (effDelivered) { effDelivered.name = "Delivered Time (s)"; effDelivered.property(1).setValue(deliveredTime); }

                var effRead = parade.addProperty("ADBE Slider Control");
                if (effRead) { effRead.name = "Read Time (s)"; effRead.property(1).setValue(readTime); }

                var effStatNeut = parade.addProperty("ADBE Color Control");
                if (effStatNeut) { effStatNeut.name = "Status Neutral Color"; effStatNeut.property(1).setValue(timeColor); }

                var effStatRead = parade.addProperty("ADBE Color Control");
                if (effStatRead) { effStatRead.name = "Status Read Color"; effStatRead.property(1).setValue(readColor); }

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
                if (effGrowF) { effGrowF.name = "Bubble Grow Duration (frames)"; effGrowF.property(1).setValue(5); }

                var effTypeF = parade.addProperty("ADBE Slider Control");
                if (effTypeF) { effTypeF.name = "Typewriter Duration (frames)"; effTypeF.property(1).setValue(5); }

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
            var timeX = statusString ? (timeRowRightX - statusW - statusSpacing) : timeRowRightX;

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

            // 5. Dedicated Status / Read Icon Layer (Supports Auto Sent -> Delivered -> Read)
            var statusLayer = null;
            if (statusString) {
                if (typeof comp.layers.addText === "function") {
                    statusLayer = comp.layers.addText(statusString);
                } else {
                    statusLayer = comp.layers.addShape();
                }
                statusLayer.name = "Status_Icon";
                statusLayer.parent = master;
                statusLayer.fontSize = timeFontSize;
                statusLayer.fontColor = statusColor;
                statusLayer.fontFamily = selectedFont.css;
                statusLayer.justification = "right";
                statusLayer.transform.position.setValue([statusX, timeY, -0.5]);
                if (statusLayer.transform && statusLayer.transform.opacity) {
                    statusLayer.transform.opacity.expression = TIMECODE_ENTRANCE_EXPR;
                }

                // Attach dynamic status expressions (Auto / timing simulation)
                if (statusLayer.sourceText) {
                    statusLayer.sourceText.expression = STATUS_TEXT_EXPR;
                }
                var sParade = statusLayer.property("ADBE Effect Parade") || statusLayer.property("Effects");
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
                if (statusLayer.transform && statusLayer.transform.scale) {
                    statusLayer.transform.scale.expression = STATUS_SCALE_EXPR;
                }
            }

            // Select master controller
            master.selected = true;

        } catch (err) {
            alert("Could not generate Message Bubble:\n" + err.toString());
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
        buildMessageBubble();
    };

    // --- Bottom Subtle Repository Link ---
    var grpRepoLink = win.add("group");
    grpRepoLink.orientation = "row";
    grpRepoLink.alignment = ["fill", "bottom"];
    grpRepoLink.alignChildren = ["center", "center"];
    grpRepoLink.margins = [0, 4, 0, 0];
    var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE_JS_builder");
    lblRepoLink.helpTip = "https://github.com/work2survive/AE_JS_builder";
    lblRepoLink.onClick = function() {
        var url = "https://github.com/work2survive/AE_JS_builder";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else {
            system.callSystem('open "' + url + '"');
        }
    };

    // Initialize layout
    updateCharCount();
    syncColorsFromPlatform();

    win.layout.layout(true);
    win.onResizing = win.onResize = function() {
        this.layout.resize();
    };

    if (win !== null && win instanceof Window) {
        win.center();
        win.show();
    }

})(this);
