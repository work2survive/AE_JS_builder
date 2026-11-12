// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE WINDBOX v1.1
// =============================================================================
//
// PURPOSE:
//   A procedural 3D Wind Volume Particle System for Adobe After Effects,
//   featuring a virtual 3D bounding box (Guide Layer) and preset physics
//   for organic elements (Leaves, Clouds, Stars, Mountains, Shapes, and Custom Comps).
//
// KEY CAPABILITIES:
//   1. Virtual 3D Cube (Guide Layer):
//      - Visible in After Effects working composition viewport for precise volume framing.
//      - Flagged as Guide Layer (`guideLayer = true`) by default so it never renders to exports.
//      - 6 parametric faces parented to the Master Controller with dynamic expressions.
//   2. Wind-Driven Particle Motion & Rotation:
//      - Particles travel along normalized 3D wind vector [X, Y, Z] at animatable speed.
//      - 3D spatial wrapping keeps particles in continuous flow within the box volume.
//      - "Align to Wind" option dynamically rotates particles to face and orient with the wind.
//      - 3-axis positional turbulence & independent 3-axis rotational tumbling wiggle.
//   3. Rich Preset System:
//      - 🍃 Leaves: Procedural Bézier teardrop leaves with multi-hue autumn tones & organic tumbling.
//      - ☁️ Clouds: Wide-volume billowing clouds drifting on diagonal 3D wind gently in front of the camera.
//      - ⭐ Stars: 5-pointed twinkling stars with cosmic shimmering float.
//      - ⛰️ Mountains: Low-poly geometric mountain silhouettes with majestic parallax glide.
//      - ⚪ 3D Circles: Snow, dust, spores, or bubbles.
//      - ⬛ 3D Squares: Confetti, debris, or pixel particles.
//      - 🎬 Project Composition: Instantiate any existing CompItem from the project!
//      - 🎯 Selected Layer(s): Duplicate any selected timeline layer as particle source.
//   4. Master 3D Controller:
//      - Single 3D null layer containing Slider, Color, and Checkbox Effect Controls.
//      - Moving or rotating the controller transforms and reorients the entire wind volume.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6 through CC 2026+ (ExtendScript engine)
//   - Works both as a dockable panel (ScriptUI Panels) and as a floating palette.
// =============================================================================

(function (thisObj) {
    "use strict";

    // ==========================================
    // COLOR HELPERS & SCRIPTUI COLOR PICKER
    // ==========================================
    function hexToRgb(hex) {
        hex = String(hex).replace("#", "");
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var num = parseInt(hex, 16);
        return [
            ((num >> 16) & 255) / 255, // Red channel   (0.0 to 1.0)
            ((num >> 8) & 255) / 255,  // Green channel (0.0 to 1.0)
            (num & 255) / 255          // Blue channel  (0.0 to 1.0)
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#8C8C8C";
        var r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255).toString(16);
        var g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255).toString(16);
        var b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255).toString(16);
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        return "#" + r + g + b;
    }

    function createColorPicker(parent, defaultHex) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.spacing = 6;
        grp.alignChildren = ["left", "center"];

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [36, 22];
        btnSwatch.helpTip = "Click to pick color (After Effects native Color Picker)";

        var txtHex = grp.add("edittext", undefined, defaultHex);
        txtHex.preferredSize = [70, 22];
        txtHex.characters = 7;
        txtHex.helpTip = "Direct hex color input (e.g. #8C8C8C)";

        var picker = {
            group: grp,
            button: btnSwatch,
            edittext: txtHex,
            _color: defaultHex,
            value: defaultHex,
            onChange: null,
            setColor: function(newHex, triggerChange) {
                setColor(newHex, triggerChange);
            }
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
            }

            if (triggerChange && typeof picker.onChange === "function") {
                picker.onChange();
            }
        }

        btnSwatch.onClick = function() {
            var curHex = picker._color || "#8C8C8C";
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
        return picker;
    }

    // ==========================================
    // PROCEDURAL VECTOR SHAPE BUILDER
    // ==========================================
    function buildParticleShape(pLayer, sourceIndex, shapeSize, defaultColor, pIndex) {
        var root = pLayer.property("ADBE Root Vectors Group");
        var shapeGroup = root.addProperty("ADBE Vector Group");
        shapeGroup.name = "Particle Shape";
        var contents = shapeGroup.property("ADBE Vectors Group");

        // Curated multi-tone palettes for rich natural particle fields
        var autumnLeafPalette = [
            [0.32, 0.68, 0.22, 1], // Fresh Green
            [0.88, 0.68, 0.12, 1], // Golden Amber
            [0.92, 0.44, 0.10, 1], // Vivid Autumn Orange
            [0.82, 0.22, 0.16, 1], // Crimson
            [0.55, 0.72, 0.20, 1]  // Bright Lime
        ];

        var starPalette = [
            [1.0, 0.95, 0.45, 1], // Warm Golden Star
            [1.0, 1.0, 1.0, 1],    // Pure White Diamond
            [0.75, 0.88, 1.0, 1],  // Celestial Blue
            [1.0, 0.85, 0.6, 1]   // Peach Starlight
        ];

        var finalColor = defaultColor;

        if (sourceIndex === 0) { // 🍃 Leaves (Procedural Teardrop Bézier)
            var pathGroup = contents.addProperty("ADBE Vector Shape - Group");
            var pathProp = pathGroup.property("ADBE Vector Shape");
            var leafShape = new Shape();
            var r = shapeSize / 2;
            leafShape.vertices = [[0, -r], [r * 0.65, 0], [0, r * 0.9], [-r * 0.65, 0]];
            var k = r * 0.45;
            leafShape.inTangents = [[-k * 0.4, 0], [0, -k], [k * 0.4, 0], [0, k]];
            leafShape.outTangents = [[k * 0.4, 0], [0, k], [-k * 0.4, 0], [0, -k]];
            leafShape.closed = true;
            pathProp.setValue(leafShape);
            finalColor = autumnLeafPalette[(pIndex - 1) % autumnLeafPalette.length];

        } else if (sourceIndex === 1) { // ☁️ Clouds (Soft Multi-Puff Cumulus & Wispy Clouds)
            var pathGroupCloud = contents.addProperty("ADBE Vector Shape - Group");
            var pathPropCloud = pathGroupCloud.property("ADBE Vector Shape");
            var cloudShape = new Shape();
            var cw = shapeSize * 1.3, ch = shapeSize * 0.65;
            var cVariant = (pIndex - 1) % 3;

            if (cVariant === 0) { // Classic Billowing Cumulus
                cloudShape.vertices = [
                    [-cw * 0.42, ch * 0.22],
                    [cw * 0.42, ch * 0.22],
                    [cw * 0.46, -ch * 0.05],
                    [cw * 0.2, -ch * 0.38],
                    [-cw * 0.16, -ch * 0.44],
                    [-cw * 0.46, -ch * 0.05]
                ];
                var cc0 = shapeSize * 0.18;
                cloudShape.inTangents = [[0, 0], [cc0, 0], [0, cc0], [cc0, 0], [-cc0, 0], [0, -cc0]];
                cloudShape.outTangents = [[-cc0, 0], [0, -cc0], [-cc0, 0], [cc0, 0], [0, cc0], [0, 0]];
            } else if (cVariant === 1) { // Elongated Wispy Cloud
                var cw1 = cw * 1.2, ch1 = ch * 0.8;
                cloudShape.vertices = [
                    [-cw1 * 0.45, ch1 * 0.18],
                    [cw1 * 0.45, ch1 * 0.18],
                    [cw1 * 0.48, -ch1 * 0.06],
                    [cw1 * 0.22, -ch1 * 0.32],
                    [-cw1 * 0.14, -ch1 * 0.36],
                    [-cw1 * 0.48, -ch1 * 0.06]
                ];
                var cc1 = shapeSize * 0.2;
                cloudShape.inTangents = [[0, 0], [cc1, 0], [0, cc1], [cc1, 0], [-cc1, 0], [0, -cc1]];
                cloudShape.outTangents = [[-cc1, 0], [0, -cc1], [-cc1, 0], [cc1, 0], [0, cc1], [0, 0]];
            } else { // High-Puff Layered Cloud
                var cw2 = cw * 1.1, ch2 = ch * 1.05;
                cloudShape.vertices = [
                    [-cw2 * 0.4, ch2 * 0.24],
                    [cw2 * 0.4, ch2 * 0.24],
                    [cw2 * 0.44, 0],
                    [cw2 * 0.25, -ch2 * 0.42],
                    [-cw2 * 0.08, -ch2 * 0.48],
                    [-cw2 * 0.44, 0]
                ];
                var cc2 = shapeSize * 0.17;
                cloudShape.inTangents = [[0, 0], [cc2, 0], [0, cc2], [cc2, 0], [-cc2, 0], [0, -cc2]];
                cloudShape.outTangents = [[-cc2, 0], [0, -cc2], [-cc2, 0], [cc2, 0], [0, cc2], [0, 0]];
            }
            cloudShape.closed = true;
            pathPropCloud.setValue(cloudShape);

            // Subtle airy cloud tint palette (ethereal soft whites and sky mists)
            var cloudPalette = [
                [0.96, 0.98, 1.0, 1],   // Pure airy white
                [0.92, 0.95, 0.98, 1],  // Soft sky-tinted white
                [0.88, 0.92, 0.96, 1]   // Atmospheric depth mist
            ];
            finalColor = cloudPalette[cVariant];

        } else if (sourceIndex === 2) { // ⭐ Stars (5-Point Vector Star)
            var pathGroupStar = contents.addProperty("ADBE Vector Shape - Group");
            var pathPropStar = pathGroupStar.property("ADBE Vector Shape");
            var starShape = new Shape();
            var rOut = shapeSize / 2;
            var rIn = rOut * 0.42;
            var sVerts = [], sIns = [], sOuts = [];
            for (var st = 0; st < 10; st++) {
                var ang = (st * Math.PI) / 5 - Math.PI / 2;
                var rad = (st % 2 === 0) ? rOut : rIn;
                sVerts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
                sIns.push([0, 0]);
                sOuts.push([0, 0]);
            }
            starShape.vertices = sVerts;
            starShape.inTangents = sIns;
            starShape.outTangents = sOuts;
            starShape.closed = true;
            pathPropStar.setValue(starShape);
            finalColor = starPalette[(pIndex - 1) % starPalette.length];

        } else if (sourceIndex === 3) { // ⛰️ Mountains (Diverse Low-Poly Ridges along X Axis)
            var pathGroupMnt = contents.addProperty("ADBE Vector Shape - Group");
            var pathPropMnt = pathGroupMnt.property("ADBE Vector Shape");
            var mntShape = new Shape();
            var mw = shapeSize, mh = shapeSize * 0.65;
            var variant = (pIndex - 1) % 4;

            if (variant === 0) { // Alpine Horn Peak
                mntShape.vertices = [
                    [-mw * 0.5, mh * 0.4],
                    [-mw * 0.28, -mh * 0.05],
                    [-mw * 0.1, mh * 0.08],
                    [0, -mh * 0.5],
                    [mw * 0.18, -mh * 0.12],
                    [mw * 0.35, mh * 0.1],
                    [mw * 0.5, mh * 0.4]
                ];
            } else if (variant === 1) { // Twin Peak Massif
                mntShape.vertices = [
                    [-mw * 0.5, mh * 0.4],
                    [-mw * 0.22, -mh * 0.42],
                    [-mw * 0.04, -mh * 0.1],
                    [mw * 0.18, -mh * 0.48],
                    [mw * 0.38, -mh * 0.02],
                    [mw * 0.5, mh * 0.4]
                ];
            } else if (variant === 2) { // Jagged Ridge
                mntShape.vertices = [
                    [-mw * 0.5, mh * 0.4],
                    [-mw * 0.35, -mh * 0.15],
                    [-mw * 0.18, -mh * 0.38],
                    [0, -mh * 0.25],
                    [mw * 0.22, -mh * 0.45],
                    [mw * 0.38, -mh * 0.2],
                    [mw * 0.5, mh * 0.4]
                ];
            } else { // Broad Horizon Mountain
                mntShape.vertices = [
                    [-mw * 0.5, mh * 0.4],
                    [-mw * 0.3, -mh * 0.22],
                    [-mw * 0.05, -mh * 0.35],
                    [mw * 0.15, -mh * 0.28],
                    [mw * 0.35, -mh * 0.12],
                    [mw * 0.5, mh * 0.4]
                ];
            }
            mntShape.inTangents = [];
            mntShape.outTangents = [];
            for (var vi = 0; vi < mntShape.vertices.length; vi++) {
                mntShape.inTangents.push([0, 0]);
                mntShape.outTangents.push([0, 0]);
            }
            mntShape.closed = true;
            pathPropMnt.setValue(mntShape);

            // Layered atmospheric slate & mountain blues
            var mountainPalette = [
                [0.22, 0.28, 0.36, 1], // Deep Front Mountain Slate
                [0.28, 0.35, 0.45, 1], // Mid-Range Granite Blue
                [0.36, 0.44, 0.54, 1], // Distant Mist Mountain
                [0.44, 0.52, 0.62, 1]  // Atmospheric Horizon Ridge
            ];
            finalColor = mountainPalette[variant];

        } else if (sourceIndex === 4) { // ⚪ 3D Circles
            var ellipse = contents.addProperty("ADBE Vector Shape - Ellipse");
            ellipse.property("ADBE Vector Ellipse Size").setValue([shapeSize, shapeSize]);

        } else if (sourceIndex === 5) { // ⬛ 3D Squares
            var rect = contents.addProperty("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Size").setValue([shapeSize, shapeSize]);
        }

        // Add Vector Fill Graphic
        var fill = contents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue(finalColor);
        if (sourceIndex === 1) { // ☁️ Clouds: gentle, soft airy translucency
            try {
                fill.property("ADBE Vector Fill Opacity").setValue(78);
            } catch (e) {}
        }
    }


    // =========================================================================
    // JSON POLYFILL (Safe ExtendScript JSON parser & stringifier)
    // =========================================================================
    var JSONPolyfill = (function() {
        if (typeof JSON === "object" && JSON && typeof JSON.stringify === "function" && typeof JSON.parse === "function") {
            return JSON;
        }
        var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        var meta = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"': '\\"', '\\': '\\\\' };
        function quote(string) {
            escapable.lastIndex = 0;
            return escapable.test(string) ? '"' + string.replace(escapable, function(a) {
                var c = meta[a];
                return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' : '"' + string + '"';
        }
        var repSpace = '';
        function str(key, holder, gap) {
            var value = holder[key];
            switch (typeof value) {
                case 'string': return quote(value);
                case 'number': return isFinite(value) ? String(value) : 'null';
                case 'boolean': return String(value);
                case 'object':
                    if (!value) return 'null';
                    var mind = gap;
                    gap += repSpace;
                    var partial = [];
                    if (Object.prototype.toString.apply(value) === '[object Array]') {
                        for (var i = 0; i < value.length; i += 1) {
                            partial[i] = str(i, value, gap) || 'null';
                        }
                        var v = partial.length === 0 ? '[]' : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' : '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }
                    for (var k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            var res = str(k, value, gap);
                            if (res) partial.push((gap ? quote(k) + ': ' : quote(k) + ':') + res);
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
                return str('', { '': value }, '');
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

    // =========================================================================
    // EXTERNAL PRESETS (JSON file, auto-created in "AE_windbox/presets.json")
    // =========================================================================
    var PRESETS_FOLDER_NAME = "AE_windbox";
    var PRESETS_FILE_NAME = "presets.json";
    var currentPresetsFolder = null;
    var currentPresetsFile = null;

    var DEFAULT_PRESETS = [
        {
            name: "Falling Leaves (Organic Flutter & Tumble)",
            sourceIndex: 0,
            masterSeed: 12345,
            sizeX: 1400,
            sizeY: 800,
            sizeZ: 1000,
            windSpeed: 260,
            dirX: 1.0,
            dirY: 0.3,
            dirZ: 0.2,
            alignToWind: true,
            numParticles: 50,
            fadeInDist: 180,
            fadeOutDist: 180,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 28,
            partSizeRand: 45,
            scaleWigFreq: 1.0,
            scaleWigAmp: 15,
            partColor: "#44aa33",
            posFreq: 1.6,
            posAmpX: 70,
            posAmpY: 50,
            posAmpZ: 60,
            rotXFreq: 1.2,
            rotXAmp: 60,
            rotYFreq: 1.2,
            rotYAmp: 60,
            rotZFreq: 1.5,
            rotZAmp: 75,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        },
        {
            name: "Drifting Clouds (Soft Gentle Float)",
            sourceIndex: 1,
            masterSeed: 24680,
            sizeX: 3600,
            sizeY: 850,
            sizeZ: 2800,
            windSpeed: 65,
            dirX: 0.85,
            dirY: -0.12,
            dirZ: -0.65,
            alignToWind: false,
            numParticles: 22,
            fadeInDist: 350,
            fadeOutDist: 350,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 240,
            partSizeRand: 50,
            scaleWigFreq: 0.3,
            scaleWigAmp: 10,
            partColor: "#f0f4f8",
            posFreq: 0.2,
            posAmpX: 35,
            posAmpY: 20,
            posAmpZ: 30,
            rotXFreq: 0.1,
            rotXAmp: 2,
            rotYFreq: 0.1,
            rotYAmp: 3,
            rotZFreq: 0.15,
            rotZAmp: 4,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        },
        {
            name: "Cosmic Stars (Twinkle & Shimmer)",
            sourceIndex: 2,
            masterSeed: 13579,
            sizeX: 1500,
            sizeY: 1000,
            sizeZ: 1500,
            windSpeed: 40,
            dirX: 0.4,
            dirY: -0.2,
            dirZ: 0.4,
            alignToWind: false,
            numParticles: 70,
            fadeInDist: 150,
            fadeOutDist: 150,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 18,
            partSizeRand: 60,
            scaleWigFreq: 1.5,
            scaleWigAmp: 35,
            partColor: "#ffea00",
            posFreq: 0.8,
            posAmpX: 40,
            posAmpY: 40,
            posAmpZ: 40,
            rotXFreq: 0.5,
            rotXAmp: 20,
            rotYFreq: 0.5,
            rotYAmp: 20,
            rotZFreq: 0.8,
            rotZAmp: 45,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        },
        {
            name: "Parallax Mountains (Horizon Glide)",
            sourceIndex: 3,
            masterSeed: 98765,
            sizeX: 3200,
            sizeY: 250,
            sizeZ: 3600,
            windSpeed: 220,
            dirX: 0.0,
            dirY: 0.0,
            dirZ: -1.0,
            alignToWind: false,
            numParticles: 24,
            fadeInDist: 300,
            fadeOutDist: 300,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 380,
            partSizeRand: 35,
            scaleWigFreq: 0.0,
            scaleWigAmp: 0,
            partColor: "#3a4a5e",
            posFreq: 0.1,
            posAmpX: 20,
            posAmpY: 0,
            posAmpZ: 0,
            rotXFreq: 0.0,
            rotXAmp: 0,
            rotYFreq: 0.0,
            rotYAmp: 0,
            rotZFreq: 0.0,
            rotZAmp: 0,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        },
        {
            name: "3D Circles (Snow / Spores)",
            sourceIndex: 4,
            masterSeed: 54321,
            sizeX: 1200,
            sizeY: 800,
            sizeZ: 1000,
            windSpeed: 200,
            dirX: 1.0,
            dirY: 0.0,
            dirZ: 0.0,
            alignToWind: false,
            numParticles: 60,
            fadeInDist: 120,
            fadeOutDist: 120,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 14,
            partSizeRand: 50,
            scaleWigFreq: 0.8,
            scaleWigAmp: 20,
            partColor: "#ffffff",
            posFreq: 1.0,
            posAmpX: 50,
            posAmpY: 50,
            posAmpZ: 50,
            rotXFreq: 0.5,
            rotXAmp: 30,
            rotYFreq: 0.5,
            rotYAmp: 30,
            rotZFreq: 0.5,
            rotZAmp: 30,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        },
        {
            name: "3D Squares (Confetti / Debris)",
            sourceIndex: 5,
            masterSeed: 67890,
            sizeX: 1200,
            sizeY: 800,
            sizeZ: 1000,
            windSpeed: 250,
            dirX: 1.0,
            dirY: 0.2,
            dirZ: 0.1,
            alignToWind: true,
            numParticles: 60,
            fadeInDist: 120,
            fadeOutDist: 120,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 14,
            partSizeRand: 40,
            scaleWigFreq: 1.2,
            scaleWigAmp: 25,
            partColor: "#ff3b30",
            posFreq: 1.2,
            posAmpX: 60,
            posAmpY: 60,
            posAmpZ: 60,
            rotXFreq: 1.5,
            rotXAmp: 90,
            rotYFreq: 1.5,
            rotYAmp: 90,
            rotZFreq: 2.0,
            rotZAmp: 120,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        },
        {
            name: "Project Composition...",
            sourceIndex: 6,
            masterSeed: 12345,
            sizeX: 1600,
            sizeY: 900,
            sizeZ: 1400,
            windSpeed: 200,
            dirX: 1.0,
            dirY: 0.0,
            dirZ: 0.0,
            alignToWind: true,
            numParticles: 20,
            fadeInDist: 150,
            fadeOutDist: 150,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 100,
            partSizeRand: 30,
            scaleWigFreq: 0.5,
            scaleWigAmp: 10,
            partColor: "#44aa33",
            posFreq: 1.0,
            posAmpX: 40,
            posAmpY: 40,
            posAmpZ: 40,
            rotXFreq: 0.5,
            rotXAmp: 20,
            rotYFreq: 0.5,
            rotYAmp: 20,
            rotZFreq: 0.5,
            rotZAmp: 20,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        },
        {
            name: "Selected Layer(s)",
            sourceIndex: 7,
            masterSeed: 12345,
            sizeX: 1600,
            sizeY: 900,
            sizeZ: 1400,
            windSpeed: 200,
            dirX: 1.0,
            dirY: 0.0,
            dirZ: 0.0,
            alignToWind: true,
            numParticles: 20,
            fadeInDist: 150,
            fadeOutDist: 150,
            cameraFade: true,
            cameraFadeDist: 250,
            partSize: 100,
            partSizeRand: 30,
            scaleWigFreq: 0.5,
            scaleWigAmp: 10,
            partColor: "#44aa33",
            posFreq: 1.0,
            posAmpX: 40,
            posAmpY: 40,
            posAmpZ: 40,
            rotXFreq: 0.5,
            rotXAmp: 20,
            rotYFreq: 0.5,
            rotYAmp: 20,
            rotZFreq: 0.5,
            rotZAmp: 20,
            cubeGuide: true,
            cubeFillColor: "#8c8c8c",
            cubeFillOpacity: 10,
            cubeStrokeColor: "#ffffff",
            cubeStrokeWidth: 1.5,
            cubeStrokeOpacity: 85
        }
    ];

    function cloneDefaultPresets() {
        var arr = [];
        for (var i = 0; i < DEFAULT_PRESETS.length; i++) {
            var item = DEFAULT_PRESETS[i];
            var copy = {};
            for (var k in item) {
                if (item.hasOwnProperty(k)) copy[k] = item[k];
            }
            arr.push(copy);
        }
        return arr;
    }

    var ACTIVE_PRESETS = cloneDefaultPresets();

    function getPresetsFolder() {
        if (typeof Folder === "undefined") return null;
        var candidates = [];

        // 1. Next to current script file
        try {
            if (typeof $.fileName !== "undefined" && $.fileName) {
                var scriptFile = new File($.fileName);
                if (scriptFile.exists && scriptFile.parent) {
                    candidates.push(new Folder(scriptFile.parent.fsName + "/" + PRESETS_FOLDER_NAME));
                    if (scriptFile.parent.parent && scriptFile.parent.parent.exists) {
                        candidates.push(new Folder(scriptFile.parent.parent.fsName + "/" + PRESETS_FOLDER_NAME));
                    }
                }
            }
        } catch (e1) {}

        // 2. Folder.current
        try {
            if (Folder.current) {
                candidates.push(new Folder(Folder.current.fsName + "/" + PRESETS_FOLDER_NAME));
            }
        } catch (eCurr) {}

        // 3. User AppData / Documents
        try {
            if (Folder.userData) {
                candidates.push(new Folder(Folder.userData.fsName + "/Adobe/After Effects/" + PRESETS_FOLDER_NAME));
            }
        } catch (e2) {}
        try {
            if (Folder.myDocuments) {
                candidates.push(new Folder(Folder.myDocuments.fsName + "/Adobe/After Effects/" + PRESETS_FOLDER_NAME));
            }
        } catch (e3) {}

        // 1. Existing folder containing presets.json
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i] && candidates[i].exists) {
                var testF = new File(candidates[i].fsName + "/" + PRESETS_FILE_NAME);
                if (testF.exists) return candidates[i];
            }
        }

        // 2. Any existing folder
        for (var j = 0; j < candidates.length; j++) {
            if (candidates[j] && candidates[j].exists) return candidates[j];
        }

        // 3. First run: auto-create the folder
        for (var c = 0; c < candidates.length; c++) {
            try {
                if (candidates[c] && candidates[c].create()) return candidates[c];
            } catch (eCreate) {}
        }

        return candidates.length > 0 ? candidates[0] : null;
    }

    function ensurePresetsFile(folder) {
        if (!folder || typeof File === "undefined") return null;
        var pFile = new File(folder.fsName + "/" + PRESETS_FILE_NAME);
        if (pFile.exists) return pFile;

        try {
            if (!folder.exists && !folder.create()) {
                return pFile;
            }
            pFile.encoding = "UTF-8";
            if (pFile.open("w")) {
                var dataObj = {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "description": "After Effects WindBox - Presets configuration. Edit freely or add your own custom presets, then click the reload button (🔄) in the panel.",
                    "version": "1.2",
                    "presets": cloneDefaultPresets()
                };
                pFile.write(JSONPolyfill.stringify(dataObj, null, 2));
                pFile.close();
            }
        } catch (eWrite) {}
        return pFile;
    }

    function parsePresetObject(raw, fallbackName) {
        if (!raw || typeof raw !== "object") return null;
        var p = {};
        p.name = (raw.name !== undefined && String(raw.name).length > 0) ? String(raw.name) : fallbackName;
        p.sourceIndex = (raw.sourceIndex !== undefined) ? Number(raw.sourceIndex) : 0;
        p.masterSeed = (raw.masterSeed !== undefined) ? Number(raw.masterSeed) : 12345;
        p.sizeX = (raw.sizeX !== undefined) ? Number(raw.sizeX) : 1400;
        p.sizeY = (raw.sizeY !== undefined) ? Number(raw.sizeY) : 800;
        p.sizeZ = (raw.sizeZ !== undefined) ? Number(raw.sizeZ) : 1000;
        p.windSpeed = (raw.windSpeed !== undefined) ? Number(raw.windSpeed) : 260;
        p.dirX = (raw.dirX !== undefined) ? Number(raw.dirX) : 1.0;
        p.dirY = (raw.dirY !== undefined) ? Number(raw.dirY) : 0.3;
        p.dirZ = (raw.dirZ !== undefined) ? Number(raw.dirZ) : 0.2;
        p.alignToWind = (raw.alignToWind !== undefined) ? Boolean(raw.alignToWind) : true;
        p.numParticles = (raw.numParticles !== undefined) ? Number(raw.numParticles) : 50;
        p.fadeInDist = (raw.fadeInDist !== undefined) ? Number(raw.fadeInDist) : 150;
        p.fadeOutDist = (raw.fadeOutDist !== undefined) ? Number(raw.fadeOutDist) : 150;
        p.partSize = (raw.partSize !== undefined) ? Number(raw.partSize) : 28;
        p.partSizeRand = (raw.partSizeRand !== undefined) ? Number(raw.partSizeRand) : 45;
        p.scaleWigFreq = (raw.scaleWigFreq !== undefined) ? Number(raw.scaleWigFreq) : 1.0;
        p.scaleWigAmp = (raw.scaleWigAmp !== undefined) ? Number(raw.scaleWigAmp) : 15;
        p.partColor = (raw.partColor !== undefined) ? String(raw.partColor) : "#44aa33";
        p.posFreq = (raw.posFreq !== undefined) ? Number(raw.posFreq) : 1.6;
        p.posAmpX = (raw.posAmpX !== undefined) ? Number(raw.posAmpX) : 70;
        p.posAmpY = (raw.posAmpY !== undefined) ? Number(raw.posAmpY) : 50;
        p.posAmpZ = (raw.posAmpZ !== undefined) ? Number(raw.posAmpZ) : 60;
        p.rotXFreq = (raw.rotXFreq !== undefined) ? Number(raw.rotXFreq) : 1.2;
        p.rotXAmp = (raw.rotXAmp !== undefined) ? Number(raw.rotXAmp) : 60;
        p.rotYFreq = (raw.rotYFreq !== undefined) ? Number(raw.rotYFreq) : 1.2;
        p.rotYAmp = (raw.rotYAmp !== undefined) ? Number(raw.rotYAmp) : 60;
        p.rotZFreq = (raw.rotZFreq !== undefined) ? Number(raw.rotZFreq) : 1.5;
        p.rotZAmp = (raw.rotZAmp !== undefined) ? Number(raw.rotZAmp) : 75;
        p.cubeGuide = (raw.cubeGuide !== undefined) ? Boolean(raw.cubeGuide) : true;
        p.cubeFillColor = (raw.cubeFillColor !== undefined) ? String(raw.cubeFillColor) : "#8c8c8c";
        p.cubeFillOpacity = (raw.cubeFillOpacity !== undefined) ? Number(raw.cubeFillOpacity) : 10;
        p.cubeStrokeColor = (raw.cubeStrokeColor !== undefined) ? String(raw.cubeStrokeColor) : "#ffffff";
        p.cubeStrokeWidth = (raw.cubeStrokeWidth !== undefined) ? Number(raw.cubeStrokeWidth) : 1.5;
        p.cubeStrokeOpacity = (raw.cubeStrokeOpacity !== undefined) ? Number(raw.cubeStrokeOpacity) : 85;
        return p;
    }

    function loadPresetsFromFile() {
        ACTIVE_PRESETS = cloneDefaultPresets();
        currentPresetsFolder = getPresetsFolder();
        if (!currentPresetsFolder) return 0;
        currentPresetsFile = ensurePresetsFile(currentPresetsFolder);
        if (!currentPresetsFile || !currentPresetsFile.exists) return 0;

        try {
            currentPresetsFile.encoding = "UTF-8";
            if (currentPresetsFile.open("r")) {
                var content = currentPresetsFile.read();
                currentPresetsFile.close();
                if (content && content.replace(/^\s+|\s+$/g, "").length > 0) {
                    var parsed = JSONPolyfill.parse(content);
                    var list = (parsed && parsed.presets) ? parsed.presets : parsed;
                    var loaded = [];
                    if (list && typeof list.length === "number") {
                        for (var i = 0; i < list.length; i++) {
                            var pItem = parsePresetObject(list[i], "Preset " + (i + 1));
                            if (pItem) loaded.push(pItem);
                        }
                    }
                    if (loaded.length > 0) {
                        ACTIVE_PRESETS = loaded;
                        return loaded.length;
                    }
                }
            }
        } catch (eLoad) {}
        return ACTIVE_PRESETS.length;
    }

    // ==========================================
    // UI BUILDER
    // ==========================================
    function buildWindBoxUI(thisObj) {
        var isPanel = (thisObj instanceof Panel);
        var win = isPanel ? thisObj : new Window("palette", "AE WindBox v1.1", undefined, {
            resizeable: true
        });
        if (!(thisObj instanceof Panel)) {
            win.text = "AE WindBox v1.1";
        }

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        // ---------------------------------------------------------------------
        // 1. UI Header (Panel Title + Version & Description)
        // ---------------------------------------------------------------------
        var pnlHeader = win.add("panel", undefined, "AE WindBox");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.spacing = 3;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblDesc = pnlHeader.add("statictext", undefined, "v1.1 - Procedural 3D Wind Volume Particle System with Virtual Guide Cube.");

        // ---------- SYSTEM NAME & PRESETS ----------
        var headerGroup = win.add("group");
        headerGroup.orientation = "row";
        headerGroup.alignChildren = ["left", "center"];
        headerGroup.alignment = ["fill", "top"];
        headerGroup.spacing = 6;

        headerGroup.add("statictext", undefined, "System Name:");
        var txtSysName = headerGroup.add("edittext", undefined, "WindBox");
        txtSysName.characters = 8;

        headerGroup.add("statictext", undefined, "Seed:");
        var editMasterSeed = headerGroup.add("edittext", undefined, "12345");
        editMasterSeed.characters = 6;
        editMasterSeed.helpTip = "Master Random Seed governing all procedural particles, sizes, and motions";

        var btnRandSeed = headerGroup.add("button", undefined, "🎲");
        btnRandSeed.maximumSize = [24, 22];
        btnRandSeed.helpTip = "Generate new random seed";
        btnRandSeed.onClick = function() {
            editMasterSeed.text = String(Math.floor(Math.random() * 89999 + 10000));
        };

        var btnHelp = headerGroup.add("button", undefined, "?");
        btnHelp.maximumSize = [24, 22];
        btnHelp.onClick = function () {
            alert(
                "AE WindBox + 3D Cube Maker (v1.1)\n" +
                "=================================\n" +
                "1. Virtual 3D Cube (Guide Layer):\n" +
                "   Defines the 3D wind boundary. Marked as Guide Layer by default so it stays\n" +
                "   visible in the working viewport for reference, but never renders to exports!\n\n" +
                "2. Wind Physics & Flow Direction:\n" +
                "   Particles wrap seamlessly in 3D volume space. Enable 'Align to Wind' so\n" +
                "   elements naturally steer and orient in the direction of the wind vector!\n\n" +
                "3. Presets & Custom Comps:\n" +
                "   Quickly switch between Leaves, Clouds, Stars, Mountains, Shapes, or pick\n" +
                "   any composition from your project to instantiate as 3D wind particles.\n\n" +
                "Tip: Moving or rotating the Controller null transforms the entire wind volume in 3D world space.",
                "About AE WindBox"
            );
        };

        // ---------- PRESET QUICK-LOADER ROW ----------
        var grpPreset = win.add("group");
        grpPreset.orientation = "row";
        grpPreset.alignChildren = ["left", "center"];
        grpPreset.alignment = ["fill", "top"];
        grpPreset.spacing = 6;

        grpPreset.add("statictext", undefined, "Preset:");
        var dropPreset = grpPreset.add("dropdownlist", undefined, []);
        dropPreset.preferredSize = [230, 24];

        var btnReloadPresets = grpPreset.add("button", undefined, "🔄");
        btnReloadPresets.maximumSize = [28, 24];
        btnReloadPresets.helpTip = "Reload presets from AE_windbox/presets.json (auto-creates if missing)";

        // ---------- TABBED PANEL ----------
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.spacing = 4;
        tpanel.margins = 4;

        // ==========================================
        // TAB 1: BOX & WIND FLOW
        // ==========================================
        var tabFlow = tpanel.add("tab", undefined, "Box & Wind");
        tabFlow.orientation = "column";
        tabFlow.alignChildren = ["fill", "top"];
        tabFlow.spacing = 6;
        tabFlow.margins = 6;

        // Box Size Panel
        var pnlSize = tabFlow.add("panel", undefined, "Cube Dimensions (X, Y, Z) - Animatable");
        pnlSize.orientation = "row";
        pnlSize.alignChildren = ["fill", "center"];
        pnlSize.spacing = 4;

        pnlSize.add("statictext", undefined, "X:");
        var editSizeX = pnlSize.add("edittext", undefined, "1400");
        editSizeX.characters = 5;

        pnlSize.add("statictext", undefined, "Y:");
        var editSizeY = pnlSize.add("edittext", undefined, "800");
        editSizeY.characters = 5;

        pnlSize.add("statictext", undefined, "Z:");
        var editSizeZ = pnlSize.add("edittext", undefined, "1000");
        editSizeZ.characters = 5;

        // Wind Flow Panel
        var pnlWind = tabFlow.add("panel", undefined, "Wind Flow - Animatable");
        pnlWind.orientation = "column";
        pnlWind.alignChildren = ["fill", "top"];
        pnlWind.spacing = 4;

        // Speed row
        var grpSpeed = pnlWind.add("group");
        grpSpeed.orientation = "row";
        grpSpeed.alignChildren = ["left", "center"];
        grpSpeed.add("statictext", undefined, "Wind Speed (px/s):");
        var editSpeed = grpSpeed.add("edittext", undefined, "260");
        editSpeed.characters = 6;

        // Direction row
        var grpDir = pnlWind.add("group");
        grpDir.orientation = "row";
        grpDir.alignChildren = ["fill", "center"];
        grpDir.spacing = 4;

        grpDir.add("statictext", undefined, "Direction:");
        grpDir.add("statictext", undefined, "X:");
        var editDirX = grpDir.add("edittext", undefined, "1.0");
        editDirX.characters = 4;

        grpDir.add("statictext", undefined, "Y:");
        var editDirY = grpDir.add("edittext", undefined, "0.3");
        editDirY.characters = 4;

        grpDir.add("statictext", undefined, "Z:");
        var editDirZ = grpDir.add("edittext", undefined, "0.2");
        editDirZ.characters = 4;

        // Align rotation to wind checkbox
        var chkAlignWind = pnlWind.add("checkbox", undefined, "Align Particle Rotation to Wind Vector");
        chkAlignWind.value = true;
        chkAlignWind.helpTip = "Automatically rotates particles towards the wind direction vector with aerodynamic tumble";

        // Particle Count Panel
        var pnlCount = tabFlow.add("panel", undefined, "Particles Count - Animatable");
        pnlCount.orientation = "row";
        pnlCount.alignChildren = ["left", "center"];
        pnlCount.spacing = 6;

        pnlCount.add("statictext", undefined, "Number of Particles:");
        var editCount = pnlCount.add("edittext", undefined, "50");
        editCount.characters = 5;

        // Boundary & Camera Fade Panel
        var pnlFade = tabFlow.add("panel", undefined, "Particle Fade (Boundary & Camera) - Animatable");
        pnlFade.orientation = "column";
        pnlFade.alignChildren = ["fill", "top"];
        pnlFade.spacing = 6;
        pnlFade.margins = 6;

        var grpBoundFade = pnlFade.add("group");
        grpBoundFade.orientation = "row";
        grpBoundFade.alignChildren = ["left", "center"];
        grpBoundFade.spacing = 4;
        grpBoundFade.add("statictext", undefined, "Fade In Dist (px):");
        var editFadeInDist = grpBoundFade.add("edittext", undefined, "150");
        editFadeInDist.characters = 5;
        editFadeInDist.helpTip = "Distance from box entry boundary over which particle fades smoothly from 0 to 100% opacity";

        grpBoundFade.add("statictext", undefined, "Fade Out Dist (px):");
        var editFadeOutDist = grpBoundFade.add("edittext", undefined, "150");
        editFadeOutDist.characters = 5;
        editFadeOutDist.helpTip = "Distance to box exit boundary over which particle fades smoothly from 100% to 0 opacity";

        var grpCamFade = pnlFade.add("group");
        grpCamFade.orientation = "row";
        grpCamFade.alignChildren = ["left", "center"];
        grpCamFade.spacing = 6;
        var chkCameraFade = grpCamFade.add("checkbox", undefined, "Fade Near Camera (Default ON)");
        chkCameraFade.value = true;
        chkCameraFade.helpTip = "Fade out particles that come too close to the active camera lens";

        grpCamFade.add("statictext", undefined, "Near Fade Dist (px):");
        var editCamFadeDist = grpCamFade.add("edittext", undefined, "250");
        editCamFadeDist.characters = 5;
        editCamFadeDist.helpTip = "Distance in pixels in front of the camera lens under which particles fade smoothly to 0 opacity";

        // ==========================================
        // TAB 2: VIRTUAL CUBE (GUIDE LAYER)
        // ==========================================
        var tabCube = tpanel.add("tab", undefined, "Virtual Cube");
        tabCube.orientation = "column";
        tabCube.alignChildren = ["fill", "top"];
        tabCube.spacing = 6;
        tabCube.margins = 6;

        var chkCreateCube = tabCube.add("checkbox", undefined, "Build Virtual 3D Cube (AE-Cube-Maker-3D)");
        chkCreateCube.value = true;

        var chkCubeGuide = tabCube.add("checkbox", undefined, "Set as Guide Layer (Viewport only, invisible in render)");
        chkCubeGuide.value = true; // Default: Guide layer!

        var lblGuideTip = tabCube.add("statictext", undefined, "Guide Layers frame the volume in working viewport and do NOT render out.", { multiline: true });
        lblGuideTip.alignment = ["fill", "top"];

        var pnlCubeStyle = tabCube.add("panel", undefined, "Cube Visualizer Appearance");
        pnlCubeStyle.orientation = "column";
        pnlCubeStyle.alignChildren = ["fill", "top"];
        pnlCubeStyle.spacing = 6;

        // Sides (Face) Color Picker
        var grpCubeFill = pnlCubeStyle.add("group");
        grpCubeFill.orientation = "row";
        grpCubeFill.alignment = ["fill", "top"];
        var lblCubeFill = grpCubeFill.add("statictext", undefined, "Sides Fill Color:");
        lblCubeFill.preferredSize = [135, -1];
        var cpCubeFill = createColorPicker(grpCubeFill, "#8c8c8c");

        // Sides Opacity
        var grpCubeSidesOp = pnlCubeStyle.add("group");
        grpCubeSidesOp.orientation = "row";
        grpCubeSidesOp.alignChildren = ["left", "center"];
        var lblSidesOp = grpCubeSidesOp.add("statictext", undefined, "Sides Opacity (%):");
        lblSidesOp.preferredSize = [135, -1];
        var editCubeSidesOp = grpCubeSidesOp.add("edittext", undefined, "10");
        editCubeSidesOp.characters = 4;
        grpCubeSidesOp.add("statictext", undefined, "(Subtle holographic volume)");

        // Stroke Color Picker
        var grpCubeStroke = pnlCubeStyle.add("group");
        grpCubeStroke.orientation = "row";
        grpCubeStroke.alignment = ["fill", "top"];
        var lblCubeStroke = grpCubeStroke.add("statictext", undefined, "Stroke Color:");
        lblCubeStroke.preferredSize = [135, -1];
        var cpCubeStroke = createColorPicker(grpCubeStroke, "#ffffff");

        // Stroke Width
        var grpCubeStrokeW = pnlCubeStyle.add("group");
        grpCubeStrokeW.orientation = "row";
        grpCubeStrokeW.alignChildren = ["left", "center"];
        var lblStrokeW = grpCubeStrokeW.add("statictext", undefined, "Stroke Width (px):");
        lblStrokeW.preferredSize = [135, -1];
        var editCubeStrokeW = grpCubeStrokeW.add("edittext", undefined, "1.5");
        editCubeStrokeW.characters = 4;

        // Stroke Opacity
        var grpCubeStrokeOp = pnlCubeStyle.add("group");
        grpCubeStrokeOp.orientation = "row";
        grpCubeStrokeOp.alignChildren = ["left", "center"];
        var lblStrokeOp = grpCubeStrokeOp.add("statictext", undefined, "Stroke Opacity (%):");
        lblStrokeOp.preferredSize = [135, -1];
        var editCubeStrokeOp = grpCubeStrokeOp.add("edittext", undefined, "85");
        editCubeStrokeOp.characters = 4;

        // ==========================================
        // TAB 3: POSITION WIGGLE
        // ==========================================
        var tabPosWiggle = tpanel.add("tab", undefined, "Pos Wiggle");
        tabPosWiggle.orientation = "column";
        tabPosWiggle.alignChildren = ["fill", "top"];
        tabPosWiggle.spacing = 6;
        tabPosWiggle.margins = 6;

        var pnlPosWig = tabPosWiggle.add("panel", undefined, "Particle Position Turbulence");
        pnlPosWig.orientation = "column";
        pnlPosWig.alignChildren = ["fill", "top"];
        pnlPosWig.spacing = 4;

        var grpPosFreq = pnlPosWig.add("group");
        grpPosFreq.orientation = "row";
        grpPosFreq.alignChildren = ["left", "center"];
        grpPosFreq.add("statictext", undefined, "Frequency (Hz):");
        var editPosFreq = grpPosFreq.add("edittext", undefined, "1.6");
        editPosFreq.characters = 5;

        var grpPosAmp = pnlPosWig.add("group");
        grpPosAmp.orientation = "row";
        grpPosAmp.alignChildren = ["fill", "center"];
        grpPosAmp.spacing = 4;

        grpPosAmp.add("statictext", undefined, "Amount (px):");
        grpPosAmp.add("statictext", undefined, "X:");
        var editPosAmpX = grpPosAmp.add("edittext", undefined, "70");
        editPosAmpX.characters = 4;

        grpPosAmp.add("statictext", undefined, "Y:");
        var editPosAmpY = grpPosAmp.add("edittext", undefined, "50");
        editPosAmpY.characters = 4;

        grpPosAmp.add("statictext", undefined, "Z:");
        var editPosAmpZ = grpPosAmp.add("edittext", undefined, "60");
        editPosAmpZ.characters = 4;

        // ==========================================
        // TAB 4: ROTATION WIGGLE
        // ==========================================
        var tabRotWiggle = tpanel.add("tab", undefined, "Rot Wiggle");
        tabRotWiggle.orientation = "column";
        tabRotWiggle.alignChildren = ["fill", "top"];
        tabRotWiggle.spacing = 6;
        tabRotWiggle.margins = 6;

        // X Rotation (Pitch)
        var pnlRotX = tabRotWiggle.add("panel", undefined, "X Rotation Turbulence (Pitch)");
        pnlRotX.orientation = "row";
        pnlRotX.alignChildren = ["fill", "center"];
        pnlRotX.spacing = 4;
        pnlRotX.add("statictext", undefined, "Amount (°):");
        var editRotXAmp = pnlRotX.add("edittext", undefined, "60");
        editRotXAmp.characters = 4;
        pnlRotX.add("statictext", undefined, "Freq (Hz):");
        var editRotXFreq = pnlRotX.add("edittext", undefined, "1.2");
        editRotXFreq.characters = 4;

        // Y Rotation (Yaw)
        var pnlRotY = tabRotWiggle.add("panel", undefined, "Y Rotation Turbulence (Yaw)");
        pnlRotY.orientation = "row";
        pnlRotY.alignChildren = ["fill", "center"];
        pnlRotY.spacing = 4;
        pnlRotY.add("statictext", undefined, "Amount (°):");
        var editRotYAmp = pnlRotY.add("edittext", undefined, "60");
        editRotYAmp.characters = 4;
        pnlRotY.add("statictext", undefined, "Freq (Hz):");
        var editRotYFreq = pnlRotY.add("edittext", undefined, "1.2");
        editRotYFreq.characters = 4;

        // Z Rotation (Roll)
        var pnlRotZ = tabRotWiggle.add("panel", undefined, "Z Rotation Turbulence (Roll)");
        pnlRotZ.orientation = "row";
        pnlRotZ.alignChildren = ["fill", "center"];
        pnlRotZ.spacing = 4;
        pnlRotZ.add("statictext", undefined, "Amount (°):");
        var editRotZAmp = pnlRotZ.add("edittext", undefined, "75");
        editRotZAmp.characters = 4;
        pnlRotZ.add("statictext", undefined, "Freq (Hz):");
        var editRotZFreq = pnlRotZ.add("edittext", undefined, "1.5");
        editRotZFreq.characters = 4;

        // ==========================================
        // TAB 5: PARTICLE SOURCE & APPEARANCE
        // ==========================================
        var tabSource = tpanel.add("tab", undefined, "Particles");
        tabSource.orientation = "column";
        tabSource.alignChildren = ["fill", "top"];
        tabSource.spacing = 6;
        tabSource.margins = 6;

        var grpSource = tabSource.add("group");
        grpSource.orientation = "row";
        grpSource.alignChildren = ["left", "center"];
        grpSource.add("statictext", undefined, "Source:");
        var dropSource = grpSource.add("dropdownlist", undefined, [
            "🍃 Built-in Leaves (Bézier Vector)",
            "☁️ Built-in Clouds (Soft Vector)",
            "⭐ Built-in Stars (5-Point Vector)",
            "⛰️ Built-in Mountains (Silhouette)",
            "⚪ Built-in 3D Circle (Vector)",
            "⬛ Built-in 3D Square (Vector)",
            "🎬 Project Composition...",
            "🎯 Use Selected Timeline Layer(s)"
        ]);
        dropSource.selection = 0; // Default to Leaves!

        // Project Comp Selector row (visible when source == 6)
        var grpProjComp = tabSource.add("group");
        grpProjComp.orientation = "row";
        grpProjComp.alignChildren = ["left", "center"];
        grpProjComp.visible = false;

        grpProjComp.add("statictext", undefined, "Comp:");
        var dropProjectComp = grpProjComp.add("dropdownlist", undefined, ["(Scan Project Comps)"]);
        dropProjectComp.preferredSize = [160, -1];
        dropProjectComp.selection = 0;

        var btnRefreshComps = grpProjComp.add("button", undefined, "🔄");
        btnRefreshComps.maximumSize = [28, 22];
        btnRefreshComps.helpTip = "Scan project for available Compositions";

        var projectCompItems = [];
        function updateProjectCompsList() {
            dropProjectComp.removeAll();
            projectCompItems = [];
            var proj = app.project;
            if (proj && proj.items) {
                for (var ci = 1; ci <= proj.items.length; ci++) {
                    var item = proj.items[ci];
                    if (item && item instanceof CompItem) {
                        dropProjectComp.add("item", item.name);
                        projectCompItems.push(item);
                    }
                }
            }
            if (dropProjectComp.items.length === 0) {
                dropProjectComp.add("item", "(No comps found)");
            }
            dropProjectComp.selection = 0;
        }

        btnRefreshComps.onClick = function() {
            updateProjectCompsList();
        };

        var grpPartSize = tabSource.add("group");
        grpPartSize.orientation = "row";
        grpPartSize.alignChildren = ["left", "center"];
        grpPartSize.add("statictext", undefined, "Particle Size (px):");
        var editPartSize = grpPartSize.add("edittext", undefined, "28");
        editPartSize.characters = 5;

        // Born Size Randomness
        var grpPartSizeRand = tabSource.add("group");
        grpPartSizeRand.orientation = "row";
        grpPartSizeRand.alignChildren = ["left", "center"];
        grpPartSizeRand.add("statictext", undefined, "Size Randomness (%):");
        var editPartSizeRand = grpPartSizeRand.add("edittext", undefined, "45");
        editPartSizeRand.characters = 5;
        editPartSizeRand.helpTip = "Percentage of size variation applied when particles are born (0 = identical, 100 = 0x to 2x variation)";
        grpPartSizeRand.add("statictext", undefined, "(Variation at birth)");

        // Scale Wiggle (Dynamic breathing / pulsing)
        var pnlScaleWig = tabSource.add("panel", undefined, "Size Wiggle (Dynamic Pulsing / Breathing) - Animatable");
        pnlScaleWig.orientation = "row";
        pnlScaleWig.alignChildren = ["fill", "center"];
        pnlScaleWig.spacing = 4;

        pnlScaleWig.add("statictext", undefined, "Freq (Hz):");
        var editScaleWigFreq = pnlScaleWig.add("edittext", undefined, "1.0");
        editScaleWigFreq.characters = 4;

        pnlScaleWig.add("statictext", undefined, "Amount (%):");
        var editScaleWigAmp = pnlScaleWig.add("edittext", undefined, "15");
        editScaleWigAmp.characters = 4;

        // Custom particle base color
        var grpPartCol = tabSource.add("group");
        grpPartCol.orientation = "row";
        grpPartCol.alignChildren = ["left", "center"];
        grpPartCol.add("statictext", undefined, "Base Color:");
        var cpPartColor = createColorPicker(grpPartCol, "#44aa33");

        function handleSourceChange() {
            var idx = dropSource.selection.index;
            grpProjComp.visible = (idx === 6);
            grpPartSize.enabled = (idx <= 5);
            grpPartCol.enabled = (idx <= 5);
            if (idx === 6) {
                updateProjectCompsList();
            }
        }

        dropSource.onChange = handleSourceChange;

        function applyPreset(preset) {
            if (!preset) return;
            if (preset.sourceIndex !== undefined && preset.sourceIndex >= 0 && preset.sourceIndex < dropSource.items.length) {
                dropSource.selection = preset.sourceIndex;
            }
            if (preset.masterSeed !== undefined) editMasterSeed.text = String(preset.masterSeed);
            if (preset.sizeX !== undefined) editSizeX.text = String(preset.sizeX);
            if (preset.sizeY !== undefined) editSizeY.text = String(preset.sizeY);
            if (preset.sizeZ !== undefined) editSizeZ.text = String(preset.sizeZ);
            if (preset.windSpeed !== undefined) editSpeed.text = String(preset.windSpeed);
            if (preset.dirX !== undefined) editDirX.text = String(preset.dirX);
            if (preset.dirY !== undefined) editDirY.text = String(preset.dirY);
            if (preset.dirZ !== undefined) editDirZ.text = String(preset.dirZ);
            if (preset.alignToWind !== undefined) chkAlignWind.value = Boolean(preset.alignToWind);
            if (preset.numParticles !== undefined) editCount.text = String(preset.numParticles);
            if (preset.fadeInDist !== undefined) editFadeInDist.text = String(preset.fadeInDist);
            if (preset.fadeOutDist !== undefined) editFadeOutDist.text = String(preset.fadeOutDist);
            if (preset.cameraFade !== undefined) chkCameraFade.value = Boolean(preset.cameraFade);
            if (preset.cameraFadeDist !== undefined) editCamFadeDist.text = String(preset.cameraFadeDist);
            if (preset.partSize !== undefined) editPartSize.text = String(preset.partSize);
            if (preset.partSizeRand !== undefined) editPartSizeRand.text = String(preset.partSizeRand);
            if (preset.scaleWigFreq !== undefined) editScaleWigFreq.text = String(preset.scaleWigFreq);
            if (preset.scaleWigAmp !== undefined) editScaleWigAmp.text = String(preset.scaleWigAmp);
            if (preset.partColor !== undefined) cpPartColor.setColor(preset.partColor, false);
            if (preset.posFreq !== undefined) editPosFreq.text = String(preset.posFreq);
            if (preset.posAmpX !== undefined) editPosAmpX.text = String(preset.posAmpX);
            if (preset.posAmpY !== undefined) editPosAmpY.text = String(preset.posAmpY);
            if (preset.posAmpZ !== undefined) editPosAmpZ.text = String(preset.posAmpZ);
            if (preset.rotXFreq !== undefined) editRotXFreq.text = String(preset.rotXFreq);
            if (preset.rotXAmp !== undefined) editRotXAmp.text = String(preset.rotXAmp);
            if (preset.rotYFreq !== undefined) editRotYFreq.text = String(preset.rotYFreq);
            if (preset.rotYAmp !== undefined) editRotYAmp.text = String(preset.rotYAmp);
            if (preset.rotZFreq !== undefined) editRotZFreq.text = String(preset.rotZFreq);
            if (preset.rotZAmp !== undefined) editRotZAmp.text = String(preset.rotZAmp);
            if (preset.cubeGuide !== undefined) chkCubeGuide.value = Boolean(preset.cubeGuide);
            if (preset.cubeFillColor !== undefined) cpCubeFill.setColor(preset.cubeFillColor, false);
            if (preset.cubeFillOpacity !== undefined) editCubeSidesOp.text = String(preset.cubeFillOpacity);
            if (preset.cubeStrokeColor !== undefined) cpCubeStroke.setColor(preset.cubeStrokeColor, false);
            if (preset.cubeStrokeWidth !== undefined) editCubeStrokeW.text = String(preset.cubeStrokeWidth);
            if (preset.cubeStrokeOpacity !== undefined) editCubeStrokeOp.text = String(preset.cubeStrokeOpacity);
            handleSourceChange();
        }

        function populatePresetDropdown() {
            dropPreset.removeAll();
            for (var p = 0; p < ACTIVE_PRESETS.length; p++) {
                dropPreset.add("item", ACTIVE_PRESETS[p].name);
            }
            if (dropPreset.items.length > 0) {
                dropPreset.selection = 0;
            }
        }

        dropPreset.onChange = function () {
            if (dropPreset.selection && dropPreset.selection.index >= 0 && dropPreset.selection.index < ACTIVE_PRESETS.length) {
                applyPreset(ACTIVE_PRESETS[dropPreset.selection.index]);
            }
        };

        btnReloadPresets.onClick = function () {
            loadPresetsFromFile();
            populatePresetDropdown();
            if (dropPreset.selection) {
                applyPreset(ACTIVE_PRESETS[dropPreset.selection.index]);
            }
        };

        // Initial loading of external presets
        loadPresetsFromFile();
        populatePresetDropdown();
        if (dropPreset.items.length > 0) {
            dropPreset.selection = 0;
            applyPreset(ACTIVE_PRESETS[0]);
        }


        // ==========================================
        // ACTION BUTTONS
        // ==========================================
        var grpActions = win.add("group");
        grpActions.orientation = "column";
        grpActions.alignChildren = ["fill", "center"];
        grpActions.spacing = 4;

        var btnCreate = grpActions.add("button", undefined, "Build / Create WindBox + Cube");
        btnCreate.preferredSize.height = 34;

        // ---------- REPOSITORY FOOTER LINK ----------
        var grpRepoLink = win.add("group");
        grpRepoLink.orientation = "row";
        grpRepoLink.alignment = ["fill", "bottom"];
        grpRepoLink.alignChildren = ["center", "center"];
        grpRepoLink.margins = [0, 4, 0, 0];
        var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE_windBox");
        lblRepoLink.helpTip = "https://github.com/work2survive/AE_windBox";
        lblRepoLink.onClick = function () {
            var url = "https://github.com/work2survive/AE_windBox";
            if (typeof window !== "undefined" && window.open) {
                window.open(url, "_blank");
            } else if ($.os.indexOf("Windows") !== -1) {
                system.callSystem('explorer "' + url + '"');
            } else {
                system.callSystem('open "' + url + '"');
            }
        };

        // ---------- HELPER: NUMERIC PARSER ----------
        function getNum(editField, defaultVal) {
            var val = parseFloat(editField.text);
            return isNaN(val) ? defaultVal : val;
        }

        // ---------- HELPER: ADD SLIDER CONTROL ----------
        function addSlider(layer, effectName, defaultValue) {
            var slider = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            slider.name = effectName;
            slider.property("ADBE Slider Control-0001").setValue(defaultValue);
            return slider;
        }

        // ---------- HELPER: ADD COLOR CONTROL ----------
        function addColor(layer, effectName, defaultColorArray) {
            var colorProp = layer.property("ADBE Effect Parade").addProperty("ADBE Color Control");
            colorProp.name = effectName;
            colorProp.property("ADBE Color Control-0001").setValue(defaultColorArray);
            return colorProp;
        }

        // ---------- HELPER: ADD CHECKBOX CONTROL ----------
        function addCheckbox(layer, effectName, defaultValue) {
            var chk = layer.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
            chk.name = effectName;
            chk.property("ADBE Checkbox Control-0001").setValue(defaultValue ? 1 : 0);
            return chk;
        }

        // ---------- HELPER: SET TRANSFORM PROPERTY ----------
        function setTransformVal(layer, propName, val) {
            var xform = layer.property("ADBE Transform Group") || layer.property("Transform") || layer.transform;
            if (xform) {
                var p = null;
                if (propName === "Position") p = xform.property("ADBE Position") || xform.position;
                else if (propName === "Anchor Point") p = xform.property("ADBE Anchor Point") || xform.anchorPoint;
                else if (propName === "Orientation") p = xform.property("ADBE Orientation") || xform.orientation;
                else p = xform.property(propName);

                if (p && typeof p.setValue === "function") {
                    p.setValue(val);
                }
            }
        }

        // ==========================================
        // CREATE WINDBOX + 3D CUBE LOGIC
        // ==========================================
        btnCreate.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please select or open an active Composition first.", "AE WindBox");
                return;
            }

            var sysName = txtSysName.text.replace(/^\s+|\s+$/g, "");
            if (sysName.length === 0) sysName = "WindBox";

            var masterSeed = Math.floor(getNum(editMasterSeed, 12345));
            var sizeX = Math.max(10, getNum(editSizeX, 1400));
            var sizeY = Math.max(10, getNum(editSizeY, 800));
            var sizeZ = Math.max(10, getNum(editSizeZ, 1000));
            var windSpd = getNum(editSpeed, 260);
            var dirX = getNum(editDirX, 1.0);
            var dirY = getNum(editDirY, 0.3);
            var dirZ = getNum(editDirZ, 0.2);
            var alignToWind = chkAlignWind.value;
            var numParticles = Math.max(1, Math.round(getNum(editCount, 50)));
            var fadeInDist = Math.max(0, getNum(editFadeInDist, 150));
            var fadeOutDist = Math.max(0, getNum(editFadeOutDist, 150));
            var isCamFade = chkCameraFade.value;
            var camFadeDist = Math.max(1, getNum(editCamFadeDist, 250));
            var partSizeRand = Math.max(0, Math.min(100, getNum(editPartSizeRand, 45)));
            var scaleWigFreq = Math.max(0, getNum(editScaleWigFreq, 1.0));
            var scaleWigAmp = Math.max(0, getNum(editScaleWigAmp, 15));

            var posFreq = Math.max(0, getNum(editPosFreq, 1.6));
            var posAmpX = Math.max(0, getNum(editPosAmpX, 70));
            var posAmpY = Math.max(0, getNum(editPosAmpY, 50));
            var posAmpZ = Math.max(0, getNum(editPosAmpZ, 60));

            var rotXAmp = getNum(editRotXAmp, 60);
            var rotXFreq = Math.max(0, getNum(editRotXFreq, 1.2));
            var rotYAmp = getNum(editRotYAmp, 60);
            var rotYFreq = Math.max(0, getNum(editRotYFreq, 1.2));
            var rotZAmp = getNum(editRotZAmp, 75);
            var rotZFreq = Math.max(0, getNum(editRotZFreq, 1.5));

            var shouldBuildCube = chkCreateCube.value;
            var isCubeGuide = chkCubeGuide.value;
            var cubeFillColor = hexToRgb(cpCubeFill.value);
            var cubeStrokeColor = hexToRgb(cpCubeStroke.value);
            var cubeSidesOp = Math.max(0, Math.min(100, getNum(editCubeSidesOp, 10)));
            var cubeStrokeWidth = Math.max(0.5, getNum(editCubeStrokeW, 1.5));
            var cubeStrokeOp = Math.max(0, Math.min(100, getNum(editCubeStrokeOp, 85)));

            var particleType = dropSource.selection.index;
            var shapeSize = Math.max(1, getNum(editPartSize, 28));
            var partBaseColor = hexToRgb(cpPartColor.value);

            // Handle Project Comp or Custom Source Layer
            var chosenComp = null;
            if (particleType === 6) { // Project Composition
                if (projectCompItems.length > 0 && dropProjectComp.selection) {
                    chosenComp = projectCompItems[dropProjectComp.selection.index];
                }
                if (!chosenComp) {
                    alert("Please select a valid Project Composition from the dropdown.", "AE WindBox");
                    return;
                }
            }

            var templateLayers = [];
            if (particleType === 7) { // Selected Layer(s)
                if (!comp.selectedLayers || comp.selectedLayers.length === 0) {
                    alert("Please select at least one layer in the composition to use as the particle source.", "AE WindBox");
                    return;
                }
                for (var i = 0; i < comp.selectedLayers.length; i++) {
                    templateLayers.push(comp.selectedLayers[i]);
                }
            }

            if (app.beginUndoGroup) {
                app.beginUndoGroup("Create WindBox (" + sysName + ")");
            }

            try {
                // 1. Create WindBox Master Controller Null
                var ctrlName = sysName + "_Controller";
                var ctrlLayer = comp.layers.addNull();
                ctrlLayer.name = ctrlName;
                ctrlLayer.threeDLayer = true;
                ctrlLayer.shy = false;
                ctrlLayer.notShyable = true;
                ctrlLayer.label = 1; // Red label in After Effects (Label 1 = Red)
                ctrlLayer.colorLabel = "#ff3b30"; // Red label in emulator
                setTransformVal(ctrlLayer, "Position", [comp.width / 2, comp.height / 2, 0]);
                setTransformVal(ctrlLayer, "Anchor Point", [0, 0, 0]);

                // 2. Add Expression Controls to Controller
                // Master Random Seed
                addSlider(ctrlLayer, "WindBox - Random Seed", masterSeed);

                // Size controls
                addSlider(ctrlLayer, "WindBox - Size X", sizeX);
                addSlider(ctrlLayer, "WindBox - Size Y", sizeY);
                addSlider(ctrlLayer, "WindBox - Size Z", sizeZ);

                // Wind & Dynamic Controls
                addSlider(ctrlLayer, "WindBox - Wind Speed", windSpd);
                addSlider(ctrlLayer, "WindBox - Number of Particles", numParticles);
                addSlider(ctrlLayer, "WindBox - Direction X", dirX);
                addSlider(ctrlLayer, "WindBox - Direction Y", dirY);
                addSlider(ctrlLayer, "WindBox - Direction Z", dirZ);
                addCheckbox(ctrlLayer, "WindBox - Align to Wind", alignToWind ? 1 : 0);
                addSlider(ctrlLayer, "WindBox - Particle Type", particleType);

                // Boundary & Camera Fade Controls
                addSlider(ctrlLayer, "WindBox - Fade In Distance", fadeInDist);
                addSlider(ctrlLayer, "WindBox - Fade Out Distance", fadeOutDist);
                addCheckbox(ctrlLayer, "WindBox - Fade Near Camera", isCamFade ? 1 : 0);
                addSlider(ctrlLayer, "WindBox - Camera Fade Dist", camFadeDist);

                // Particle Size Randomness & Size Wiggle Controls
                addSlider(ctrlLayer, "WindBox - Size Random (%)", partSizeRand);
                addSlider(ctrlLayer, "WindBox - Scale Wiggle Freq", scaleWigFreq);
                addSlider(ctrlLayer, "WindBox - Scale Wiggle Amp (%)", scaleWigAmp);

                // Cube appearance & Guide layer controls
                addCheckbox(ctrlLayer, "WindBox - Cube Guide Layer", isCubeGuide ? 1 : 0);
                addColor(ctrlLayer, "WindBox - Cube Fill Color", cubeFillColor);
                addSlider(ctrlLayer, "WindBox - Cube Fill Opacity", cubeSidesOp);
                addColor(ctrlLayer, "WindBox - Cube Stroke Color", cubeStrokeColor);
                addSlider(ctrlLayer, "WindBox - Cube Stroke Width", cubeStrokeWidth);
                addSlider(ctrlLayer, "WindBox - Cube Stroke Opacity", cubeStrokeOp);

                // Turbulence Wiggle controls
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Freq", posFreq);
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Amp X", posAmpX);
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Amp Y", posAmpY);
                addSlider(ctrlLayer, "WindBox - Pos Wiggle Amp Z", posAmpZ);
                addSlider(ctrlLayer, "WindBox - Rot X Wiggle Freq", rotXFreq);
                addSlider(ctrlLayer, "WindBox - Rot X Wiggle Amp", rotXAmp);
                addSlider(ctrlLayer, "WindBox - Rot Y Wiggle Freq", rotYFreq);
                addSlider(ctrlLayer, "WindBox - Rot Y Wiggle Amp", rotYAmp);
                addSlider(ctrlLayer, "WindBox - Rot Z Wiggle Freq", rotZFreq);
                addSlider(ctrlLayer, "WindBox - Rot Z Wiggle Amp", rotZAmp);

                // 3. VIRTUAL 3D CUBE BOUNDING BOX (Guide Layer)
                if (shouldBuildCube) {
                    var halfX = sizeX / 2;
                    var halfY = sizeY / 2;
                    var halfZ = sizeZ / 2;

                    var faceConfigs = [
                        { name: "Front",  pos: [0, 0, -halfZ], rot: [0, 0, 0],   w: sizeX, h: sizeY },
                        { name: "Back",   pos: [0, 0, halfZ],  rot: [0, 180, 0], w: sizeX, h: sizeY },
                        { name: "Left",   pos: [-halfX, 0, 0], rot: [0, -90, 0], w: sizeZ, h: sizeY },
                        { name: "Right",  pos: [halfX, 0, 0],  rot: [0, 90, 0],  w: sizeZ, h: sizeY },
                        { name: "Top",    pos: [0, -halfY, 0], rot: [90, 0, 0],  w: sizeX, h: sizeZ },
                        { name: "Bottom", pos: [0, halfY, 0],  rot: [-90, 0, 0], w: sizeX, h: sizeZ }
                    ];

                    var faceExprs = {
                        "Front": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; [0, 0, -sz / 2];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sx), Math.max(1, sy)];'
                        },
                        "Back": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; [0, 0, sz / 2];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sx), Math.max(1, sy)];'
                        },
                        "Left": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; [-sx / 2, 0, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sz), Math.max(1, sy)];'
                        },
                        "Right": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; [sx / 2, 0, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sz = m.effect("WindBox - Size Z")(1).value; var sy = m.effect("WindBox - Size Y")(1).value; [Math.max(1, sz), Math.max(1, sy)];'
                        },
                        "Top": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sy = m.effect("WindBox - Size Y")(1).value; [0, -sy / 2, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sz = m.effect("WindBox - Size Z")(1).value; [Math.max(1, sx), Math.max(1, sz)];'
                        },
                        "Bottom": {
                            pos: 'var m = thisComp.layer("' + ctrlName + '"); var sy = m.effect("WindBox - Size Y")(1).value; [0, sy / 2, 0];',
                            size: 'var m = thisComp.layer("' + ctrlName + '"); var sx = m.effect("WindBox - Size X")(1).value; var sz = m.effect("WindBox - Size Z")(1).value; [Math.max(1, sx), Math.max(1, sz)];'
                        }
                    };

                    var exprSidesFill = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Fill Color")(1).value; } catch (e) { [0.55, 0.55, 0.55, 1]; }';
                    var exprSidesOp   = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Fill Opacity")(1).value; } catch (e) { 10; }';
                    var exprStrokeCol = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Color")(1).value; } catch (e) { [1, 1, 1, 1]; }';
                    var exprStrokeW   = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Width")(1).value; } catch (e) { 1.5; }';
                    var exprStrokeOp  = 'try { thisComp.layer("' + ctrlName + '").effect("WindBox - Cube Stroke Opacity")(1).value; } catch (e) { 85; }';

                    for (var f = 0; f < faceConfigs.length; f++) {
                        var cfg = faceConfigs[f];
                        var faceLayer = comp.layers.addShape();
                        faceLayer.name = sysName + "_Cube_Face_" + cfg.name;
                        faceLayer.threeDLayer = true;
                        faceLayer.shy = true;
                        faceLayer.guideLayer = isCubeGuide; // Virtual Guide Layer (Viewport only)
                        faceLayer.label = isCubeGuide ? 14 : 13; // Blue Guide / Grey
                        faceLayer.colorLabel = isCubeGuide ? "#5ac8fa" : "#8e8e93";

                        var faceGroup = faceLayer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
                        faceGroup.name = "Face Vector";

                        var faceContents = faceGroup.property("ADBE Vectors Group");

                        // Rectangle Shape
                        var faceRect = faceContents.addProperty("ADBE Vector Shape - Rect");
                        faceRect.property("ADBE Vector Rect Size").setValue([cfg.w, cfg.h]);
                        faceRect.property("ADBE Vector Rect Size").expression = faceExprs[cfg.name].size;

                        // Semitransparent Fill
                        var faceFill = faceContents.addProperty("ADBE Vector Graphic - Fill");
                        faceFill.property("ADBE Vector Fill Color").setValue(cubeFillColor);
                        faceFill.property("ADBE Vector Fill Color").expression = exprSidesFill;
                        faceFill.property("ADBE Vector Fill Opacity").setValue(cubeSidesOp);
                        faceFill.property("ADBE Vector Fill Opacity").expression = exprSidesOp;

                        // Stroke Lines
                        var faceStroke = faceContents.addProperty("ADBE Vector Graphic - Stroke");
                        faceStroke.property("ADBE Vector Stroke Color").setValue(cubeStrokeColor);
                        faceStroke.property("ADBE Vector Stroke Color").expression = exprStrokeCol;
                        faceStroke.property("ADBE Vector Stroke Width").setValue(cubeStrokeWidth);
                        faceStroke.property("ADBE Vector Stroke Width").expression = exprStrokeW;
                        faceStroke.property("ADBE Vector Stroke Opacity").setValue(cubeStrokeOp);
                        faceStroke.property("ADBE Vector Stroke Opacity").expression = exprStrokeOp;

                        // Parent Face directly to Master Controller
                        faceLayer.parent = ctrlLayer;
                        setTransformVal(faceLayer, "Anchor Point", [0, 0, 0]);
                        setTransformVal(faceLayer, "Position", cfg.pos);
                        setTransformVal(faceLayer, "Orientation", cfg.rot);

                        var xf = faceLayer.property("ADBE Transform Group") || faceLayer.transform;
                        var pProp = xf ? (xf.property("ADBE Position") || xf.position) : faceLayer.property("ADBE Position");
                        if (pProp && faceExprs[cfg.name]) {
                            pProp.expression = faceExprs[cfg.name].pos;
                        }
                    }
                }

                // 4. PARTICLE EXPRESSIONS (Motion, Alignment, Turbulence)
                var posExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var sX = Math.max(1, ctrl.effect("WindBox - Size X")(1).value);',
                    'var sY = Math.max(1, ctrl.effect("WindBox - Size Y")(1).value);',
                    'var sZ = Math.max(1, ctrl.effect("WindBox - Size Z")(1).value);',
                    'var spd = ctrl.effect("WindBox - Wind Speed")(1).value;',
                    'var dX = ctrl.effect("WindBox - Direction X")(1).value;',
                    'var dY = ctrl.effect("WindBox - Direction Y")(1).value;',
                    'var dZ = ctrl.effect("WindBox - Direction Z")(1).value;',
                    '',
                    'var len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);',
                    'var dir = (len > 0.0001) ? [dX / len, dY / len, dZ / len] : [1, 0, 0];',
                    '',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'var seed = 12345;',
                    'try { seed = ctrl.effect("WindBox - Random Seed")(1).value; } catch(e) {}',
                    'seedRandom(seed + pIndex * 9973 + 17, true);',
                    'var pType = 0;',
                    'try { pType = ctrl.effect("WindBox - Particle Type")(1).value; } catch(e) {}',
                    'var isMnt = (pType === 3);',
                    'var isCloud = (pType === 1);',
                    'var initY = isMnt ? (sY * 0.35 + (random() - 0.5) * (sY * 0.1)) : (isCloud ? (-sY * 0.12 + (random() - 0.5) * (sY * 0.75)) : ((random() - 0.5) * sY));',
                    'var initPos = [',
                    '    (random() - 0.5) * sX,',
                    '    initY,',
                    '    (random() - 0.5) * sZ',
                    '];',
                    '',
                    'var dist = spd * time;',
                    'var curX = initPos[0] + dir[0] * dist;',
                    'var curY = initPos[1] + dir[1] * dist;',
                    'var curZ = initPos[2] + dir[2] * dist;',
                    '',
                    'function wrapAxis(val, size) {',
                    '    var shifted = val + size * 0.5;',
                    '    var m = shifted % size;',
                    '    if (m < 0) m += size;',
                    '    return m - size * 0.5;',
                    '}',
                    '',
                    'var bx = wrapAxis(curX, sX);',
                    'var by = wrapAxis(curY, sY);',
                    'var bz = wrapAxis(curZ, sZ);',
                    '',
                    'var pFreq = ctrl.effect("WindBox - Pos Wiggle Freq")(1).value;',
                    'var pAmpX = ctrl.effect("WindBox - Pos Wiggle Amp X")(1).value;',
                    'var pAmpY = ctrl.effect("WindBox - Pos Wiggle Amp Y")(1).value;',
                    'var pAmpZ = ctrl.effect("WindBox - Pos Wiggle Amp Z")(1).value;',
                    '',
                    'seedRandom(seed + pIndex * 9973 + 51, false);',
                    'var tOffX = pIndex * 13.73 + (seed % 100);',
                    'var tOffY = pIndex * 29.41 + (seed % 100) + 11.3;',
                    'var tOffZ = pIndex * 47.19 + (seed % 100) + 23.7;',
                    'var wX = (pFreq > 0 && pAmpX > 0) ? (wiggle(pFreq, pAmpX, 1, 0.5, time + tOffX)[0] - value[0]) : 0;',
                    'var wY = (pFreq > 0 && pAmpY > 0) ? (wiggle(pFreq, pAmpY, 1, 0.5, time + tOffY)[1] - value[1]) : 0;',
                    'var wZ = (pFreq > 0 && pAmpZ > 0) ? (wiggle(pFreq, pAmpZ, 1, 0.5, time + tOffZ)[2] - value[2]) : 0;',
                    '',
                    'ctrl.toWorld([bx + wX, by + wY, bz + wZ]);'
                ].join("\n");

                var rotXExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var dY = ctrl.effect("WindBox - Direction Y")(1).value;',
                    'var dZ = ctrl.effect("WindBox - Direction Z")(1).value;',
                    'var alignWind = 0;',
                    'try { alignWind = ctrl.effect("WindBox - Align to Wind")(1).value; } catch(e) {}',
                    'var pitchAng = (alignWind == 1 && (dY != 0 || dZ != 0)) ? (-Math.atan2(dY, dZ) * 180 / Math.PI) : 0;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'var seed = 12345;',
                    'try { seed = ctrl.effect("WindBox - Random Seed")(1).value; } catch(e) {}',
                    'seedRandom(seed + pIndex * 9973 + 101, false);',
                    'var f = ctrl.effect("WindBox - Rot X Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot X Wiggle Amp")(1).value;',
                    'var tOff = pIndex * 19.31 + (seed % 100);',
                    'var w = (f > 0 && a > 0) ? (wiggle(f, a, 1, 0.5, time + tOff)[0] - value[0] || wiggle(f, a, 1, 0.5, time + tOff) - value) : 0;',
                    'value + pitchAng + w;'
                ].join("\n");

                var rotYExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var dX = ctrl.effect("WindBox - Direction X")(1).value;',
                    'var dZ = ctrl.effect("WindBox - Direction Z")(1).value;',
                    'var alignWind = 0;',
                    'try { alignWind = ctrl.effect("WindBox - Align to Wind")(1).value; } catch(e) {}',
                    'var yawAng = (alignWind == 1 && (dX != 0 || dZ != 0)) ? (Math.atan2(dZ, dX) * 180 / Math.PI) : 0;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'var seed = 12345;',
                    'try { seed = ctrl.effect("WindBox - Random Seed")(1).value; } catch(e) {}',
                    'seedRandom(seed + pIndex * 9973 + 203, false);',
                    'var f = ctrl.effect("WindBox - Rot Y Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot Y Wiggle Amp")(1).value;',
                    'var tOff = pIndex * 31.17 + (seed % 100);',
                    'var w = (f > 0 && a > 0) ? (wiggle(f, a, 1, 0.5, time + tOff)[0] - value[0] || wiggle(f, a, 1, 0.5, time + tOff) - value) : 0;',
                    'value + yawAng + w;'
                ].join("\n");

                var rotZExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var dX = ctrl.effect("WindBox - Direction X")(1).value;',
                    'var dY = ctrl.effect("WindBox - Direction Y")(1).value;',
                    'var spd = ctrl.effect("WindBox - Wind Speed")(1).value;',
                    'var alignWind = 0;',
                    'try { alignWind = ctrl.effect("WindBox - Align to Wind")(1).value; } catch(e) {}',
                    'var windAng = (alignWind == 1 && (dX != 0 || dY != 0)) ? (Math.atan2(dY, dX) * 180 / Math.PI) : 0;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'var seed = 12345;',
                    'try { seed = ctrl.effect("WindBox - Random Seed")(1).value; } catch(e) {}',
                    'seedRandom(seed + pIndex * 9973 + 307, false);',
                    'var spinDir = ((pIndex % 3) - 1);',
                    'var windSpin = (alignWind == 1) ? (spd * time * 0.15 * spinDir) : 0;',
                    'var f = ctrl.effect("WindBox - Rot Z Wiggle Freq")(1).value;',
                    'var a = ctrl.effect("WindBox - Rot Z Wiggle Amp")(1).value;',
                    'var tOff = pIndex * 43.83 + (seed % 100);',
                    'var w = (f > 0 && a > 0) ? (wiggle(f, a, 1, 0.5, time + tOff)[0] - value[0] || wiggle(f, a, 1, 0.5, time + tOff) - value) : 0;',
                    'value + windAng + windSpin + w;'
                ].join("\n");

                var opacityExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var activeCount = ctrl.effect("WindBox - Number of Particles")(1).value;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'if (pIndex > activeCount) { 0; } else {',
                    '    var fadeIn = 0, fadeOut = 0;',
                    '    try { fadeIn = Math.max(0, ctrl.effect("WindBox - Fade In Distance")(1).value); } catch(e) {}',
                    '    try { fadeOut = Math.max(0, ctrl.effect("WindBox - Fade Out Distance")(1).value); } catch(e) {}',
                    '    var boundFactor = 1;',
                    '    if (fadeIn > 0 || fadeOut > 0) {',
                    '        var sX = Math.max(1, ctrl.effect("WindBox - Size X")(1).value);',
                    '        var sY = Math.max(1, ctrl.effect("WindBox - Size Y")(1).value);',
                    '        var sZ = Math.max(1, ctrl.effect("WindBox - Size Z")(1).value);',
                    '        var spd = ctrl.effect("WindBox - Wind Speed")(1).value;',
                    '        var dX = ctrl.effect("WindBox - Direction X")(1).value;',
                    '        var dY = ctrl.effect("WindBox - Direction Y")(1).value;',
                    '        var dZ = ctrl.effect("WindBox - Direction Z")(1).value;',
                    '        var len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);',
                    '        var dir = (len > 0.0001) ? [dX / len, dY / len, dZ / len] : [1, 0, 0];',
                    '        var seed = 12345;',
                    '        try { seed = ctrl.effect("WindBox - Random Seed")(1).value; } catch(e) {}',
                    '        seedRandom(seed + pIndex * 9973 + 17, true);',
                    '        var pType = 0;',
                    '        try { pType = ctrl.effect("WindBox - Particle Type")(1).value; } catch(e) {}',
                    '        var isMnt = (pType === 3);',
                    '        var isCloud = (pType === 1);',
                    '        var initY = isMnt ? (sY * 0.35 + (random() - 0.5) * (sY * 0.1)) : (isCloud ? (-sY * 0.12 + (random() - 0.5) * (sY * 0.75)) : ((random() - 0.5) * sY));',
                    '        var initPos = [(random() - 0.5) * sX, initY, (random() - 0.5) * sZ];',
                    '        var dist = spd * time;',
                    '        function wrapAxis(val, size) {',
                    '            var shifted = val + size * 0.5;',
                    '            var m = shifted % size;',
                    '            if (m < 0) m += size;',
                    '            return m - size * 0.5;',
                    '        }',
                    '        var bx = wrapAxis(initPos[0] + dir[0] * dist, sX);',
                    '        var by = wrapAxis(initPos[1] + dir[1] * dist, sY);',
                    '        var bz = wrapAxis(initPos[2] + dir[2] * dist, sZ);',
                    '        var dIn = 999999, dOut = 999999;',
                    '        if (Math.abs(dir[0]) > 0.001) {',
                    '            var inX = (dir[0] > 0) ? (bx + sX * 0.5) : (sX * 0.5 - bx);',
                    '            var outX = (dir[0] > 0) ? (sX * 0.5 - bx) : (bx + sX * 0.5);',
                    '            dIn = Math.min(dIn, inX / Math.abs(dir[0]));',
                    '            dOut = Math.min(dOut, outX / Math.abs(dir[0]));',
                    '        }',
                    '        if (Math.abs(dir[1]) > 0.001) {',
                    '            var inY = (dir[1] > 0) ? (by + sY * 0.5) : (sY * 0.5 - by);',
                    '            var outY = (dir[1] > 0) ? (sY * 0.5 - by) : (by + sY * 0.5);',
                    '            dIn = Math.min(dIn, inY / Math.abs(dir[1]));',
                    '            dOut = Math.min(dOut, outY / Math.abs(dir[1]));',
                    '        }',
                    '        if (Math.abs(dir[2]) > 0.001) {',
                    '            var inZ = (dir[2] > 0) ? (bz + sZ * 0.5) : (sZ * 0.5 - bz);',
                    '            var outZ = (dir[2] > 0) ? (sZ * 0.5 - bz) : (bz + sZ * 0.5);',
                    '            dIn = Math.min(dIn, inZ / Math.abs(dir[2]));',
                    '            dOut = Math.min(dOut, outZ / Math.abs(dir[2]));',
                    '        }',
                    '        var fIn = (fadeIn > 0) ? Math.min(1, Math.max(0, dIn / fadeIn)) : 1;',
                    '        var fOut = (fadeOut > 0) ? Math.min(1, Math.max(0, dOut / fadeOut)) : 1;',
                    '        boundFactor = fIn * fOut;',
                    '    }',
                    '    var camFactor = 1;',
                    '    var useCamFade = 0;',
                    '    try { useCamFade = ctrl.effect("WindBox - Fade Near Camera")(1).value; } catch(e) {}',
                    '    if (useCamFade > 0) {',
                    '        var camFadeDist = 250;',
                    '        try { camFadeDist = Math.max(1, ctrl.effect("WindBox - Camera Fade Dist")(1).value); } catch(e) {}',
                    '        var camPos = [thisComp.width / 2, thisComp.height / 2, -1777.78];',
                    '        var camForward = [0, 0, 1];',
                    '        try {',
                    '            if (thisComp.activeCamera) {',
                    '                camPos = thisComp.activeCamera.toWorld([0, 0, 0]);',
                    '                camForward = thisComp.activeCamera.toWorldVec([0, 0, 1]);',
                    '            }',
                    '        } catch(e) {}',
                    '        var myPos = toWorld(anchorPoint);',
                    '        var toPt = [myPos[0] - camPos[0], myPos[1] - camPos[1], myPos[2] - camPos[2]];',
                    '        var depth = toPt[0] * camForward[0] + toPt[1] * camForward[1] + toPt[2] * camForward[2];',
                    '        if (depth <= 0) {',
                    '            camFactor = 0;',
                    '        } else if (depth < camFadeDist) {',
                    '            camFactor = depth / camFadeDist;',
                    '        }',
                    '    }',
                    '    value * boundFactor * camFactor;',
                    '}'
                ].join("\n");

                var scaleExpr = [
                    'var ctrl = thisComp.layer("' + ctrlName + '");',
                    'var activeCount = ctrl.effect("WindBox - Number of Particles")(1).value;',
                    'var pIndex = effect("WindBox Particle Index")(1).value;',
                    'if (pIndex > activeCount) { [0, 0, 0]; } else {',
                    '    var seed = 12345;',
                    '    try { seed = ctrl.effect("WindBox - Random Seed")(1).value; } catch(e) {}',
                    '    seedRandom(seed + pIndex * 9973 + 43, true);',
                    '    var szRand = 0;',
                    '    try { szRand = Math.max(0, ctrl.effect("WindBox - Size Random (%)")(1).value) / 100; } catch(e) {}',
                    '    var randMult = (szRand > 0) ? (1 + (random() - 0.5) * 2 * szRand) : 1;',
                    '    randMult = Math.max(0.05, randMult);',
                    '    var sFreq = 0, sAmp = 0;',
                    '    try { sFreq = ctrl.effect("WindBox - Scale Wiggle Freq")(1).value; } catch(e) {}',
                    '    try { sAmp = ctrl.effect("WindBox - Scale Wiggle Amp (%)")(1).value; } catch(e) {}',
                    '    var tOff = pIndex * 23.45 + (seed % 100);',
                    '    var w = (sFreq > 0 && sAmp > 0) ? (wiggle(sFreq, sAmp, 1, 0.5, time + tOff)[0] - value[0]) : 0;',
                    '    var s = Math.max(0.1, value[0] * randMult * (1 + w / 100));',
                    '    [s, s, s];',
                    '}'
                ].join("\n");

                // 5. GENERATE PARTICLE LAYERS
                for (var p = 1; p <= numParticles; p++) {
                    var pLayer;

                    if (particleType === 6) { // Project Composition
                        pLayer = comp.layers.add(chosenComp);
                    } else if (particleType === 7) { // Selected Timeline Layers
                        var src = templateLayers[(p - 1) % templateLayers.length];
                        pLayer = src.duplicate();
                    } else { // Procedural Vector Shapes: Leaves, Clouds, Stars, Mountains, Circle, Square
                        pLayer = comp.layers.addShape();
                        buildParticleShape(pLayer, particleType, shapeSize, partBaseColor, p);
                    }

                    pLayer.name = sysName + "_Particle_" + (p < 10 ? "0" + p : p);
                    pLayer.threeDLayer = true;
                    pLayer.shy = true;
                    pLayer.label = 9; // Green label

                    // Add Particle Index Slider
                    var idxSlider = pLayer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
                    idxSlider.name = "WindBox Particle Index";
                    idxSlider.property("ADBE Slider Control-0001").setValue(p);

                    // Attach Expressions to Transform properties
                    var xform = pLayer.property("ADBE Transform Group") || pLayer.transform;

                    var posProp = xform.property("ADBE Position") || xform.position;
                    if (posProp) posProp.expression = posExpr;

                    var rotXProp = xform.property("ADBE Rotate X") || xform.property("X Rotation") || xform.xRotation;
                    var rotYProp = xform.property("ADBE Rotate Y") || xform.property("Y Rotation") || xform.yRotation;
                    var rotZProp = xform.property("ADBE Rotate Z") || xform.property("Z Rotation") || xform.zRotation;

                    if (rotXProp) rotXProp.expression = rotXExpr;
                    if (rotYProp) rotYProp.expression = rotYExpr;
                    if (rotZProp) rotZProp.expression = rotZExpr;

                    var opacProp = xform.property("ADBE Opacity") || xform.opacity;
                    if (opacProp) opacProp.expression = opacityExpr;

                    var scaleProp = xform.property("ADBE Scale") || xform.scale;
                    if (scaleProp) scaleProp.expression = scaleExpr;
                }

                // Select the Controller layer so user can immediately animate it
                if (comp.selectedLayers) {
                    for (var sel = 0; sel < comp.selectedLayers.length; sel++) {
                        comp.selectedLayers[sel].selected = false;
                    }
                }
                ctrlLayer.selected = true;

            } catch (err) {
                alert("Error building WindBox:\n" + err.toString(), "AE WindBox Error");
            } finally {
                if (app.endUndoGroup) {
                    app.endUndoGroup();
                }
            }
        };


        // Resize layout handling
        win.onResizing = win.onResize = function () {
            this.layout.resize();
        };

        return win;
    }

    // Launch UI
    var windBoxPanel = buildWindBoxUI(thisObj);
    if (windBoxPanel instanceof Window) {
        windBoxPanel.center();
        windBoxPanel.show();
    } else {
        windBoxPanel.layout.layout(true);
    }

})(this);
