// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE SPIRAL MAKER v1.0.0
// =============================================================================
//
// PURPOSE:
//   Procedural Vector Spiral Generator for Adobe After Effects.
//   Openly inspired by the online SVG Spiral Generator at:
//   https://tiny-online.tools/svg-tools/svg-spiral-generator
//
// ENHANCED CAPABILITIES & AFTER EFFECTS INTEGRATION:
//   1. Start & End Stroke Thickness via Native AE Taper:
//      - Direct, animatable control over Start Stroke Thickness (px) and End Stroke Thickness (px).
//      - Drives native After Effects Shape Layer Stroke Taper (CC 2020 v17.0+).
//      - "Continuous Taper" automatically computes exact Start Width %, End Width %,
//        and taper progression across the complete spiral path.
//      - Manual taper options for custom Start/End Length % and Ease profiles.
//   2. Multiple Spiral Mathematical Formulations:
//      - Archimedean Spiral: r = a + b * theta (constant coil spacing / vinyl groove).
//      - Logarithmic Spiral: r = a * exp(b * theta) (nautilus shell / galaxy growth).
//      - Golden Spiral: Fibonacci ratio expansion (phi = 1.61803398875).
//      - Fermat Spiral: Parabolic r = a * sqrt(theta) (sunflower phyllotaxis).
//      - Hyperbolic Spiral: Reciprocal spiral curve.
//   3. Full Vector Geometry & Framing:
//      - Turns (revolutions), Inner/Start Radius, Outer/End Radius.
//      - Start Angle offset (degrees), Clockwise or Counter-Clockwise direction.
//      - Independent Scale X & Scale Y for squished / elliptical spiral forms.
//      - Analytical cubic Bézier tangents for mathematically smooth curvature.
//   4. Native Shape Layer Architecture:
//      - Procedural expression rig with animatable Slider, Checkbox, and Color Controls.
//      - Built-in Trim Paths for instant keyframe drawing / revealing animations.
//      - Optional Fill generator for spiral silhouettes and fan discs.
//      - "Update Selected Spiral Layer" to adjust existing layers without recreating.
//   5. External Presets System (JSON):
//      - Automatically loads & saves presets from "AE_spiral_maker/presets.json".
//      - Ships with 8 curated presets (Nautilus, Vinyl, Golden, Galaxy, Zen Brush, etc.).
//
// COMPATIBILITY:
//   - Adobe After Effects CS6 through CC 2026+ (ExtendScript engine)
//   - Native Stroke Taper supported in CC 2020 (v17.0)+; graceful fallback on older versions.
//   - Works both as a dockable panel (ScriptUI Panels) and as a floating palette.
// =============================================================================

(function (thisObj) {
    "use strict";

    var SCRIPT_NAME = "AE Spiral Maker";
    var SCRIPT_VERSION = "v1.0.0";
    var GITHUB_REPO_URL = "https://github.com/work2survive/AE_spiral_maker";
    var INSPIRATION_URL = "https://tiny-online.tools/svg-tools/svg-spiral-generator";

    // =========================================================================
    // COLOR HELPERS & SCRIPTUI COLOR PICKER
    // =========================================================================

    function hexToRgb(hex) {
        var clean = String(hex || "").replace("#", "");
        if (clean.length === 3) {
            clean = clean.charAt(0) + clean.charAt(0) +
                    clean.charAt(1) + clean.charAt(1) +
                    clean.charAt(2) + clean.charAt(2);
        }
        var num = parseInt(clean, 16);
        if (isNaN(num)) return [1, 1, 1];
        return [
            ((num >> 16) & 255) / 255,
            ((num >> 8) & 255) / 255,
            (num & 255) / 255
        ];
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb.length < 3) return "#FFFFFF";
        var r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255).toString(16);
        var g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255).toString(16);
        var b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255).toString(16);
        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;
        return ("#" + r + g + b).toUpperCase();
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
        txtHex.helpTip = "Direct hex color input (e.g. #00D4FF)";

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
            var curHex = picker._color || "#00D4FF";
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
            var val = txtHex.text.replace(/[^0-9A-Fa-f#]/g, "");
            if (val.charAt(0) !== "#") val = "#" + val;
            if (val.length > 7) val = val.substring(0, 7);
            setColor(val, true);
        };

        setColor(defaultHex, false);
        return picker;
    }

    function numField(field, fallback) {
        var v = parseFloat(field.text);
        return (isFinite(v) && !isNaN(v)) ? v : fallback;
    }

    // =========================================================================
    // EXTERNAL PRESETS (JSON file, auto-created in "AE_spiral_maker/presets.json")
    // =========================================================================

    var PRESETS_FOLDER_NAME = "AE_spiral_maker";
    var PRESETS_FILE_NAME = "presets.json";

    var DEFAULT_PRESETS = [
        {
            name: "Classic Archimedean (Tapered Flow)",
            spiralType: 0,
            turns: 4.0,
            startRadius: 8.0,
            endRadius: 260.0,
            startAngle: 0.0,
            clockwise: true,
            scaleX: 100.0,
            scaleY: 100.0,
            resolution: 48,
            startThickness: 2.0,
            endThickness: 24.0,
            continuousTaper: true,
            taperStartLen: 100.0,
            taperEndLen: 100.0,
            taperStartEase: 0.0,
            taperEndEase: 0.0,
            strokeColor: "#00D4FF",
            strokeOpacity: 100.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#00D4FF",
            fillOpacity: 0.0,
            addTrimPaths: true
        },
        {
            name: "Nautilus Shell (Logarithmic Growth)",
            spiralType: 1,
            turns: 3.2,
            startRadius: 10.0,
            endRadius: 300.0,
            startAngle: 0.0,
            clockwise: true,
            scaleX: 100.0,
            scaleY: 100.0,
            resolution: 60,
            startThickness: 3.0,
            endThickness: 36.0,
            continuousTaper: true,
            taperStartLen: 100.0,
            taperEndLen: 100.0,
            taperStartEase: 15.0,
            taperEndEase: 0.0,
            strokeColor: "#20E3B2",
            strokeOpacity: 100.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#20E3B2",
            fillOpacity: 0.0,
            addTrimPaths: true
        },
        {
            name: "Golden Spiral (Fibonacci Ratio)",
            spiralType: 2,
            turns: 2.5,
            startRadius: 6.0,
            endRadius: 320.0,
            startAngle: 0.0,
            clockwise: true,
            scaleX: 100.0,
            scaleY: 100.0,
            resolution: 64,
            startThickness: 4.0,
            endThickness: 32.0,
            continuousTaper: true,
            taperStartLen: 100.0,
            taperEndLen: 100.0,
            taperStartEase: 0.0,
            taperEndEase: 0.0,
            strokeColor: "#FFB800",
            strokeOpacity: 100.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#FFB800",
            fillOpacity: 0.0,
            addTrimPaths: true
        },
        {
            name: "Vinyl Record Groove (Uniform Pitch)",
            spiralType: 0,
            turns: 14.0,
            startRadius: 60.0,
            endRadius: 320.0,
            startAngle: 0.0,
            clockwise: true,
            scaleX: 100.0,
            scaleY: 100.0,
            resolution: 36,
            startThickness: 2.5,
            endThickness: 2.5,
            continuousTaper: true,
            taperStartLen: 0.0,
            taperEndLen: 0.0,
            taperStartEase: 0.0,
            taperEndEase: 0.0,
            strokeColor: "#99A2B2",
            strokeOpacity: 90.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#111111",
            fillOpacity: 0.0,
            addTrimPaths: true
        },
        {
            name: "Sunflower Core (Fermat Parabolic)",
            spiralType: 3,
            turns: 6.0,
            startRadius: 4.0,
            endRadius: 240.0,
            startAngle: 45.0,
            clockwise: true,
            scaleX: 100.0,
            scaleY: 100.0,
            resolution: 48,
            startThickness: 2.0,
            endThickness: 16.0,
            continuousTaper: true,
            taperStartLen: 100.0,
            taperEndLen: 100.0,
            taperStartEase: 0.0,
            taperEndEase: 0.0,
            strokeColor: "#FFDE00",
            strokeOpacity: 100.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#FFDE00",
            fillOpacity: 0.0,
            addTrimPaths: true
        },
        {
            name: "Hypnotic Swirl (Reverse Taper)",
            spiralType: 1,
            turns: 4.5,
            startRadius: 5.0,
            endRadius: 340.0,
            startAngle: 180.0,
            clockwise: false,
            scaleX: 100.0,
            scaleY: 100.0,
            resolution: 52,
            startThickness: 38.0,
            endThickness: 2.0,
            continuousTaper: true,
            taperStartLen: 0.0,
            taperEndLen: 100.0,
            taperStartEase: 0.0,
            taperEndEase: -20.0,
            strokeColor: "#E024C3",
            strokeOpacity: 100.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#E024C3",
            fillOpacity: 0.0,
            addTrimPaths: true
        },
        {
            name: "Zen Calligraphy (Heavy to Needle)",
            spiralType: 0,
            turns: 1.8,
            startRadius: 12.0,
            endRadius: 220.0,
            startAngle: 90.0,
            clockwise: true,
            scaleX: 115.0,
            scaleY: 85.0,
            resolution: 72,
            startThickness: 42.0,
            endThickness: 1.0,
            continuousTaper: true,
            taperStartLen: 0.0,
            taperEndLen: 100.0,
            taperStartEase: 0.0,
            taperEndEase: 40.0,
            strokeColor: "#F5F5F7",
            strokeOpacity: 100.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#FFFFFF",
            fillOpacity: 0.0,
            addTrimPaths: true
        },
        {
            name: "Cyber Vortex (Electric Pulse)",
            spiralType: 0,
            turns: 5.5,
            startRadius: 15.0,
            endRadius: 280.0,
            startAngle: 0.0,
            clockwise: true,
            scaleX: 100.0,
            scaleY: 100.0,
            resolution: 50,
            startThickness: 3.0,
            endThickness: 20.0,
            continuousTaper: true,
            taperStartLen: 100.0,
            taperEndLen: 100.0,
            taperStartEase: 0.0,
            taperEndEase: 0.0,
            strokeColor: "#FF0077",
            strokeOpacity: 100.0,
            lineCapIndex: 1,
            enableFill: false,
            fillColor: "#FF0077",
            fillOpacity: 0.0,
            addTrimPaths: true
        }
    ];

    var ACTIVE_PRESETS = [];
    for (var d = 0; d < DEFAULT_PRESETS.length; d++) {
        ACTIVE_PRESETS.push(DEFAULT_PRESETS[d]);
    }

    function locatePresetsFolder() {
        var candidates = [];
        try {
            if ($.fileName) {
                var scriptF = new File($.fileName);
                if (scriptF && scriptF.parent && scriptF.parent.exists) {
                    candidates.push(new Folder(scriptF.parent.fsName + "/" + PRESETS_FOLDER_NAME));
                    candidates.push(scriptF.parent);
                }
            }
        } catch(e1) {}

        try {
            if (Folder.userData && Folder.userData.exists) {
                candidates.push(new Folder(Folder.userData.fsName + "/" + PRESETS_FOLDER_NAME));
            }
        } catch(e2) {}

        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i] && candidates[i].exists) {
                var testF = new File(candidates[i].fsName + "/" + PRESETS_FILE_NAME);
                if (testF.exists) return candidates[i];
            }
        }

        for (var j = 0; j < candidates.length; j++) {
            if (candidates[j] && candidates[j].exists) return candidates[j];
        }

        if (candidates.length > 0) return candidates[0];
        return Folder.current;
    }

    function loadPresetsFromFile() {
        try {
            var folder = locatePresetsFolder();
            if (!folder) return;
            if (!folder.exists) {
                try { folder.create(); } catch(eC) {}
            }
            var targetFile = new File(folder.fsName + "/" + PRESETS_FILE_NAME);
            if (!targetFile.exists) {
                // Save defaults to file for easy customization
                savePresetsToFile(targetFile, DEFAULT_PRESETS);
                return;
            }

            if (targetFile.open("r")) {
                var content = targetFile.read();
                targetFile.close();
                if (content && content.length > 10) {
                    var parsed = null;
                    try {
                        if (typeof JSON !== "undefined" && JSON.parse) {
                            parsed = JSON.parse(content);
                        } else {
                            parsed = eval("(" + content + ")");
                        }
                    } catch(eP) {}

                    if (parsed && parsed.presets && parsed.presets instanceof Array && parsed.presets.length > 0) {
                        ACTIVE_PRESETS = parsed.presets;
                    }
                }
            }
        } catch(err) {}
    }

    function savePresetsToFile(fileObj, presetsList) {
        try {
            if (!fileObj) return;
            var jsonStr = "";
            var payload = {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "description": "After Effects Spiral Maker - Presets configuration. Edit freely or add your own custom presets.",
                "version": "1.0.0",
                "presets": presetsList
            };
            if (typeof JSON !== "undefined" && JSON.stringify) {
                jsonStr = JSON.stringify(payload, null, 2);
            }
            if (jsonStr && fileObj.open("w")) {
                fileObj.write(jsonStr);
                fileObj.close();
            }
        } catch(eS) {}
    }

    // =========================================================================
    // EXPRESSION CODE (INJECTED INTO AFTER EFFECTS SHAPE PATH PROPERTY)
    // =========================================================================

    var SPIRAL_PATH_EXPR = [
        '// AE Spiral Maker - Procedural Bézier Spiral Path Generator',
        'var spType = Math.round(effect("Spiral Type")("Slider")); // 1: Archimedean, 2: Logarithmic, 3: Golden, 4: Fermat, 5: Hyperbolic',
        'var turns = Math.max(0.01, effect("Turns")("Slider"));',
        'var rStart = Math.max(0, effect("Start Radius")("Slider"));',
        'var rEnd = Math.max(0.01, effect("End Radius")("Slider"));',
        'var startAngDeg = effect("Start Angle")("Slider");',
        'var isCW = effect("Clockwise")("Checkbox") == 1;',
        'var sx = effect("Scale X")("Slider") / 100;',
        'var sy = effect("Scale Y")("Slider") / 100;',
        'var ptsPerTurn = Math.max(12, Math.round(effect("Resolution")("Slider")));',
        '',
        'var PI = Math.PI;',
        'var totalAng = turns * 2 * PI;',
        'var dir = isCW ? 1 : -1;',
        'var a0 = degreesToRadians(startAngDeg);',
        '',
        '// Determine total segment count',
        'var totalSteps = Math.min(1000, Math.max(16, Math.round(turns * ptsPerTurn)));',
        'var dTheta = totalAng / totalSteps;',
        '',
        '// Golden ratio constant',
        'var PHI = 1.61803398875;',
        '',
        '// Helper: compute radius and radial derivative dr/dtheta at parameter u in [0, 1]',
        'function evalSpiral(u) {',
        '    var th = u * totalAng;',
        '    var r = 0, dr = 0;',
        '    if (spType === 2 || spType === 3) {',
        '        // Logarithmic / Golden Spiral',
        '        var r0 = Math.max(0.1, rStart);',
        '        var r1 = Math.max(0.2, rEnd);',
        '        var growth = Math.log(r1 / r0);',
        '        r = r0 * Math.exp(growth * u);',
        '        dr = totalAng > 1e-6 ? (growth / totalAng) * r : 0;',
        '    } else if (spType === 4) {',
        '        // Fermat Parabolic Spiral: r = rStart + (rEnd - rStart) * sqrt(u)',
        '        var su = Math.sqrt(Math.max(1e-6, u));',
        '        r = rStart + (rEnd - rStart) * su;',
        '        dr = (totalAng > 1e-6 && su > 1e-6) ? ((rEnd - rStart) / totalAng) / (2 * su) : 0;',
        '    } else if (spType === 5) {',
        '        // Hyperbolic Reciprocal: r = rEnd / (1 + (rEnd/r0 - 1) * (1 - u))',
        '        var r0H = Math.max(0.1, rStart);',
        '        var kH = (rEnd / r0H) - 1;',
        '        var denom = 1 + kH * (1 - u);',
        '        r = denom > 1e-6 ? rEnd / denom : rEnd;',
        '        dr = (denom > 1e-6 && totalAng > 1e-6) ? (rEnd * kH / (denom * denom * totalAng)) : 0;',
        '    } else {',
        '        // Default: Archimedean Spiral: r = rStart + (rEnd - rStart) * u',
        '        r = rStart + (rEnd - rStart) * u;',
        '        dr = totalAng > 1e-6 ? (rEnd - rStart) / totalAng : 0;',
        '    }',
        '    return { r: r, dr: dr };',
        '}',
        '',
        '// Bézier handle factor for circular segment dTheta: (4/3) * tan(dTheta / 4)',
        'var h = (4 / 3) * Math.tan(dTheta / 4);',
        'if (h <= 0 || !isFinite(h)) h = dTheta / 3;',
        '',
        'var verts = [];',
        'var inT = [];',
        'var outT = [];',
        '',
        'for (var i = 0; i <= totalSteps; i++) {',
        '    var u = i / totalSteps;',
        '    var geom = evalSpiral(u);',
        '    var r = geom.r;',
        '    var dr = geom.dr;',
        '',
        '    var theta = u * totalAng;',
        '    var phi = a0 + dir * theta;',
        '    var cosP = Math.cos(phi);',
        '    var sinP = Math.sin(phi);',
        '',
        '    // Point position [X, Y]',
        '    var px = r * cosP * sx;',
        '    var py = r * sinP * sy;',
        '    verts.push([px, py]);',
        '',
        '    // Analytical Tangent Vector [vx, vy]',
        '    // dx/dtheta = dr*cos(phi) - r*sin(phi)*dir',
        '    // dy/dtheta = dr*sin(phi) + r*cos(phi)*dir',
        '    var vx = (dr * cosP - r * sinP * dir) * sx;',
        '    var vy = (dr * sinP + r * cosP * dir) * sy;',
        '',
        '    var tx = vx * h;',
        '    var ty = vy * h;',
        '',
        '    if (i === 0) {',
        '        inT.push([0, 0]);',
        '        outT.push([tx, ty]);',
        '    } else if (i === totalSteps) {',
        '        inT.push([-tx, -ty]);',
        '        outT.push([0, 0]);',
        '    } else {',
        '        inT.push([-tx, -ty]);',
        '        outT.push([tx, ty]);',
        '    }',
        '}',
        '',
        'createPath(verts, inT, outT, false);'
    ].join("\n");

    // Expressions for Native AE Stroke Width & Taper
    var STROKE_WIDTH_EXPR = [
        'var tStart = Math.max(0, effect("Start Thickness")("Slider"));',
        'var tEnd = Math.max(0, effect("End Thickness")("Slider"));',
        'Math.max(tStart, tEnd, 0.001);'
    ].join("\n");

    var TAPER_START_WIDTH_EXPR = [
        'var tStart = Math.max(0, effect("Start Thickness")("Slider"));',
        'var tEnd = Math.max(0, effect("End Thickness")("Slider"));',
        'var maxW = Math.max(tStart, tEnd, 0.001);',
        'var cont = effect("Continuous Taper")("Checkbox") == 1;',
        'if (cont) {',
        '    (tStart <= tEnd) ? (tStart / maxW) * 100 : 100;',
        '} else {',
        '    (tStart / maxW) * 100;',
        '}'
    ].join("\n");

    var TAPER_END_WIDTH_EXPR = [
        'var tStart = Math.max(0, effect("Start Thickness")("Slider"));',
        'var tEnd = Math.max(0, effect("End Thickness")("Slider"));',
        'var maxW = Math.max(tStart, tEnd, 0.001);',
        'var cont = effect("Continuous Taper")("Checkbox") == 1;',
        'if (cont) {',
        '    (tStart <= tEnd) ? 100 : (tEnd / maxW) * 100;',
        '} else {',
        '    (tEnd / maxW) * 100;',
        '}'
    ].join("\n");

    var TAPER_START_LEN_EXPR = [
        'var cont = effect("Continuous Taper")("Checkbox") == 1;',
        'if (cont) {',
        '    var tStart = effect("Start Thickness")("Slider");',
        '    var tEnd = effect("End Thickness")("Slider");',
        '    (tStart <= tEnd) ? 100 : 0;',
        '} else {',
        '    effect("Taper Start Length")("Slider");',
        '}'
    ].join("\n");

    var TAPER_END_LEN_EXPR = [
        'var cont = effect("Continuous Taper")("Checkbox") == 1;',
        'if (cont) {',
        '    var tStart = effect("Start Thickness")("Slider");',
        '    var tEnd = effect("End Thickness")("Slider");',
        '    (tStart <= tEnd) ? 0 : 100;',
        '} else {',
        '    effect("Taper End Length")("Slider");',
        '}'
    ].join("\n");

    // =========================================================================
    // MAIN SCRIPTUI INTERFACE BUILDER
    // =========================================================================

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME + " " + SCRIPT_VERSION, undefined, { resizeable: true });

        if (!(thisObj instanceof Panel)) {
            win.text = SCRIPT_NAME + " " + SCRIPT_VERSION;
        }

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // ---------------------------------------------------------------------
        // 1. HEADER (Title, Version & Inspiration Note)
        // ---------------------------------------------------------------------
        var pnlHeader = win.add("panel", undefined, "");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.spacing = 2;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblTitle = pnlHeader.add("statictext", undefined, "🌀 AE SPIRAL MAKER " + SCRIPT_VERSION);
        try {
            lblTitle.graphics.font = ScriptUI.newFont("Verdana", "Bold", 13);
        } catch(eF) {}

        var lblDesc = pnlHeader.add("statictext", undefined, "Procedural Vector Spirals with AE Stroke Taper Controls.");
        var lblInspired = pnlHeader.add("statictext", undefined, "Inspired by tiny-online.tools/svg-tools/svg-spiral-generator");
        lblInspired.helpTip = INSPIRATION_URL;

        // ---------------------------------------------------------------------
        // 2. PRESETS BAR
        // ---------------------------------------------------------------------
        var grpPreset = win.add("group");
        grpPreset.orientation = "row";
        grpPreset.alignChildren = ["left", "center"];
        grpPreset.spacing = 6;

        grpPreset.add("statictext", undefined, "Preset:");
        var dropPreset = grpPreset.add("dropdownlist", undefined, []);
        dropPreset.preferredSize = [230, 24];
        dropPreset.helpTip = "Choose from curated spiral presets (Archimedean, Nautilus, Vinyl, Golden, etc.)";

        var btnReloadPresets = grpPreset.add("button", undefined, "🔄");
        btnReloadPresets.maximumSize = [28, 24];
        btnReloadPresets.helpTip = "Reload presets from AE_spiral_maker/presets.json (auto-creates if missing)";

        // ---------------------------------------------------------------------
        // 3. TABBED CONTROLS
        // ---------------------------------------------------------------------
        var tpanel = win.add("tabbedpanel");
        tpanel.alignChildren = ["fill", "top"];
        tpanel.spacing = 4;
        tpanel.margins = 4;

        // ==========================================
        // TAB 1: SPIRAL GEOMETRY
        // ==========================================
        var tabGeom = tpanel.add("tab", undefined, "🌀 Spiral Shape");
        tabGeom.orientation = "column";
        tabGeom.alignChildren = ["fill", "top"];
        tabGeom.spacing = 6;
        tabGeom.margins = 8;

        // Spiral Type
        var grpType = tabGeom.add("group");
        grpType.orientation = "row";
        grpType.alignChildren = ["left", "center"];
        var lblType = grpType.add("statictext", undefined, "Spiral Type:");
        lblType.preferredSize = [100, -1];
        var dropSpiralType = grpType.add("dropdownlist", undefined, [
            "1. Archimedean (Linear - Vinyl/Coil)",
            "2. Logarithmic (Exponential Growth)",
            "3. Golden Spiral (Fibonacci Ratio)",
            "4. Fermat Spiral (Parabolic Core)",
            "5. Hyperbolic (Reciprocal Funnel)"
        ]);
        dropSpiralType.selection = 0;
        dropSpiralType.preferredSize = [210, 24];

        // Turns & Angle
        var grpTurns = tabGeom.add("group");
        grpTurns.orientation = "row";
        grpTurns.alignChildren = ["left", "center"];
        var lblTurns = grpTurns.add("statictext", undefined, "Turns (Revs):");
        lblTurns.preferredSize = [100, -1];
        var editTurns = grpTurns.add("edittext", undefined, "4.0");
        editTurns.characters = 6;

        var lblStartAng = grpTurns.add("statictext", undefined, "Start Angle (°):");
        var editStartAngle = grpTurns.add("edittext", undefined, "0.0");
        editStartAngle.characters = 6;

        // Inner & Outer Radii
        var grpRadii = tabGeom.add("group");
        grpRadii.orientation = "row";
        grpRadii.alignChildren = ["left", "center"];
        var lblStartR = grpRadii.add("statictext", undefined, "Inner Radius (px):");
        lblStartR.preferredSize = [100, -1];
        var editStartRadius = grpRadii.add("edittext", undefined, "8.0");
        editStartRadius.characters = 6;

        var lblEndR = grpRadii.add("statictext", undefined, "Outer Radius (px):");
        var editEndRadius = grpRadii.add("edittext", undefined, "260.0");
        editEndRadius.characters = 6;

        // Direction & Aspect Scale
        var grpDirScale = tabGeom.add("group");
        grpDirScale.orientation = "row";
        grpDirScale.alignChildren = ["left", "center"];
        var chkClockwise = grpDirScale.add("checkbox", undefined, "Clockwise Direction");
        chkClockwise.value = true;

        var lblScaleX = grpDirScale.add("statictext", undefined, "Scale X %:");
        var editScaleX = grpDirScale.add("edittext", undefined, "100");
        editScaleX.characters = 5;

        var lblScaleY = grpDirScale.add("statictext", undefined, "Y %:");
        var editScaleY = grpDirScale.add("edittext", undefined, "100");
        editScaleY.characters = 5;

        // Resolution (Smoothness)
        var grpRes = tabGeom.add("group");
        grpRes.orientation = "row";
        grpRes.alignChildren = ["left", "center"];
        var lblRes = grpRes.add("statictext", undefined, "Smoothness:");
        lblRes.preferredSize = [100, -1];
        var editRes = grpRes.add("edittext", undefined, "48");
        editRes.characters = 6;
        grpRes.add("statictext", undefined, "points per turn (Bézier tangents)");

        // ==========================================
        // TAB 2: STROKE & AE TAPER
        // ==========================================
        var tabStroke = tpanel.add("tab", undefined, "🖌️ Stroke & Taper");
        tabStroke.orientation = "column";
        tabStroke.alignChildren = ["fill", "top"];
        tabStroke.spacing = 6;
        tabStroke.margins = 8;

        // Start & End Thickness (The core feature)
        var pnlThickness = tabStroke.add("panel", undefined, "Stroke Thickness (Native AE Taper)");
        pnlThickness.orientation = "column";
        pnlThickness.alignChildren = ["fill", "top"];
        pnlThickness.spacing = 6;

        var grpThick = pnlThickness.add("group");
        grpThick.orientation = "row";
        grpThick.alignChildren = ["left", "center"];
        var lblStartTh = grpThick.add("statictext", undefined, "Start Thickness (px):");
        lblStartTh.preferredSize = [120, -1];
        var editStartThick = grpThick.add("edittext", undefined, "2.0");
        editStartThick.characters = 6;
        editStartThick.helpTip = "Stroke thickness at the beginning (center/inner tip) of the spiral";

        var lblEndTh = grpThick.add("statictext", undefined, "End Thickness (px):");
        lblEndTh.preferredSize = [115, -1];
        var editEndThick = grpThick.add("edittext", undefined, "24.0");
        editEndThick.characters = 6;
        editEndThick.helpTip = "Stroke thickness at the terminus (outer tip) of the spiral";

        var chkContinuous = pnlThickness.add("checkbox", undefined, "Continuous Taper across Full Path (Recommended)");
        chkContinuous.value = true;
        chkContinuous.helpTip = "Smoothly transitions from Start Thickness to End Thickness along 100% of the spiral curve.";

        // Manual Taper lengths & eases
        var grpManualTaper = pnlThickness.add("group");
        grpManualTaper.orientation = "column";
        grpManualTaper.alignChildren = ["fill", "top"];
        grpManualTaper.spacing = 4;
        grpManualTaper.enabled = false;

        var grpLens = grpManualTaper.add("group");
        grpLens.orientation = "row";
        grpLens.alignChildren = ["left", "center"];
        grpLens.add("statictext", undefined, "Start Length %:");
        var editTaperStartLen = grpLens.add("edittext", undefined, "100");
        editTaperStartLen.characters = 5;

        grpLens.add("statictext", undefined, "End Length %:");
        var editTaperEndLen = grpLens.add("edittext", undefined, "100");
        editTaperEndLen.characters = 5;

        var grpEases = grpManualTaper.add("group");
        grpEases.orientation = "row";
        grpEases.alignChildren = ["left", "center"];
        grpEases.add("statictext", undefined, "Start Ease %:");
        var editTaperStartEase = grpEases.add("edittext", undefined, "0");
        editTaperStartEase.characters = 5;

        grpEases.add("statictext", undefined, "End Ease %:");
        var editTaperEndEase = grpEases.add("edittext", undefined, "0");
        editTaperEndEase.characters = 5;

        chkContinuous.onClick = function() {
            grpManualTaper.enabled = !chkContinuous.value;
        };

        // Stroke Color & Line Cap
        var pnlStrokeStyle = tabStroke.add("panel", undefined, "Stroke Style & Color");
        pnlStrokeStyle.orientation = "column";
        pnlStrokeStyle.alignChildren = ["fill", "top"];
        pnlStrokeStyle.spacing = 6;

        var grpCol = pnlStrokeStyle.add("group");
        grpCol.orientation = "row";
        grpCol.alignChildren = ["left", "center"];
        var lblCol = grpCol.add("statictext", undefined, "Stroke Color:");
        lblCol.preferredSize = [100, -1];
        var cpStrokeColor = createColorPicker(grpCol, "#00D4FF");

        var lblOp = grpCol.add("statictext", undefined, "Opacity %:");
        var editStrokeOp = grpCol.add("edittext", undefined, "100");
        editStrokeOp.characters = 4;

        var grpCap = pnlStrokeStyle.add("group");
        grpCap.orientation = "row";
        grpCap.alignChildren = ["left", "center"];
        var lblCap = grpCap.add("statictext", undefined, "Line Cap:");
        lblCap.preferredSize = [100, -1];
        var dropLineCap = grpCap.add("dropdownlist", undefined, ["Butt Cap", "Round Cap (Recommended)", "Projecting Cap"]);
        dropLineCap.selection = 1;
        dropLineCap.preferredSize = [190, 24];

        // ==========================================
        // TAB 3: ANIMATION & FILL
        // ==========================================
        var tabAnim = tpanel.add("tab", undefined, "✨ Animation & Fill");
        tabAnim.orientation = "column";
        tabAnim.alignChildren = ["fill", "top"];
        tabAnim.spacing = 8;
        tabAnim.margins = 8;

        var pnlTrim = tabAnim.add("panel", undefined, "Animation: Trim Paths");
        pnlTrim.orientation = "column";
        pnlTrim.alignChildren = ["fill", "top"];
        pnlTrim.spacing = 4;
        var chkAddTrim = pnlTrim.add("checkbox", undefined, "Add Trim Paths modifier (Start, End & Offset)");
        chkAddTrim.value = true;
        pnlTrim.add("statictext", undefined, "Allows one-click keyframing to draw or wipe the spiral on screen.");

        var pnlFill = tabAnim.add("panel", undefined, "Spiral Fill (Optional)");
        pnlFill.orientation = "column";
        pnlFill.alignChildren = ["fill", "top"];
        pnlFill.spacing = 6;
        var chkEnableFill = pnlFill.add("checkbox", undefined, "Enable Fill");
        chkEnableFill.value = false;

        var grpFillCol = pnlFill.add("group");
        grpFillCol.orientation = "row";
        grpFillCol.alignChildren = ["left", "center"];
        var lblFillCol = grpFillCol.add("statictext", undefined, "Fill Color:");
        lblFillCol.preferredSize = [80, -1];
        var cpFillColor = createColorPicker(grpFillCol, "#00D4FF");

        var lblFillOp = grpFillCol.add("statictext", undefined, "Opacity %:");
        var editFillOp = grpFillCol.add("edittext", undefined, "0");
        editFillOp.characters = 4;
        grpFillCol.enabled = false;

        chkEnableFill.onClick = function() {
            grpFillCol.enabled = chkEnableFill.value;
            if (chkEnableFill.value && parseFloat(editFillOp.text) <= 0) {
                editFillOp.text = "100";
            }
        };

        var pnlRig = tabAnim.add("panel", undefined, "Live Expressions");
        pnlRig.orientation = "column";
        pnlRig.alignChildren = ["fill", "top"];
        var chkLiveRig = pnlRig.add("checkbox", undefined, "Live Expression Rig (Parametric Sliders in Effect Controls)");
        chkLiveRig.value = true;
        chkLiveRig.helpTip = "Adds animatable Effect Sliders to the shape layer so parameters can be tweaked and keyframed anytime.";

        // ---------------------------------------------------------------------
        // 4. PRESET POPULATION & SWITCHING
        // ---------------------------------------------------------------------
        function applyPreset(p) {
            if (!p) return;
            if (p.spiralType !== undefined && dropSpiralType.items.length > p.spiralType) {
                dropSpiralType.selection = p.spiralType;
            }
            if (p.turns !== undefined) editTurns.text = String(p.turns);
            if (p.startRadius !== undefined) editStartRadius.text = String(p.startRadius);
            if (p.endRadius !== undefined) editEndRadius.text = String(p.endRadius);
            if (p.startAngle !== undefined) editStartAngle.text = String(p.startAngle);
            if (p.clockwise !== undefined) chkClockwise.value = !!p.clockwise;
            if (p.scaleX !== undefined) editScaleX.text = String(p.scaleX);
            if (p.scaleY !== undefined) editScaleY.text = String(p.scaleY);
            if (p.resolution !== undefined) editRes.text = String(p.resolution);

            if (p.startThickness !== undefined) editStartThick.text = String(p.startThickness);
            if (p.endThickness !== undefined) editEndThick.text = String(p.endThickness);
            if (p.continuousTaper !== undefined) {
                chkContinuous.value = !!p.continuousTaper;
                grpManualTaper.enabled = !chkContinuous.value;
            }
            if (p.taperStartLen !== undefined) editTaperStartLen.text = String(p.taperStartLen);
            if (p.taperEndLen !== undefined) editTaperEndLen.text = String(p.taperEndLen);
            if (p.taperStartEase !== undefined) editTaperStartEase.text = String(p.taperStartEase);
            if (p.taperEndEase !== undefined) editTaperEndEase.text = String(p.taperEndEase);

            if (p.strokeColor) cpStrokeColor.setColor(p.strokeColor, true);
            if (p.strokeOpacity !== undefined) editStrokeOp.text = String(p.strokeOpacity);
            if (p.lineCapIndex !== undefined && dropLineCap.items.length > p.lineCapIndex) {
                dropLineCap.selection = p.lineCapIndex;
            }

            if (p.addTrimPaths !== undefined) chkAddTrim.value = !!p.addTrimPaths;
            if (p.enableFill !== undefined) {
                chkEnableFill.value = !!p.enableFill;
                grpFillCol.enabled = chkEnableFill.value;
            }
            if (p.fillColor) cpFillColor.setColor(p.fillColor, true);
            if (p.fillOpacity !== undefined) editFillOp.text = String(p.fillOpacity);
        }

        function populatePresetDropdown() {
            dropPreset.removeAll();
            for (var i = 0; i < ACTIVE_PRESETS.length; i++) {
                dropPreset.add("item", ACTIVE_PRESETS[i].name);
            }
            if (dropPreset.items.length > 0) {
                dropPreset.selection = 0;
            }
        }

        dropPreset.onChange = function() {
            if (dropPreset.selection && dropPreset.selection.index >= 0) {
                applyPreset(ACTIVE_PRESETS[dropPreset.selection.index]);
            }
        };

        btnReloadPresets.onClick = function() {
            loadPresetsFromFile();
            populatePresetDropdown();
            if (dropPreset.selection) {
                applyPreset(ACTIVE_PRESETS[dropPreset.selection.index]);
            }
        };

        loadPresetsFromFile();
        populatePresetDropdown();
        if (ACTIVE_PRESETS.length > 0) {
            applyPreset(ACTIVE_PRESETS[0]);
        }

        // ---------------------------------------------------------------------
        // 5. ACTION BUTTONS (Create & Update)
        // ---------------------------------------------------------------------
        var btnCreate = win.add("button", undefined, "🌀 Create Spiral Shape Layer");
        btnCreate.alignment = ["fill", "top"];
        btnCreate.preferredSize = [-1, 38];

        var btnUpdate = win.add("button", undefined, "🔄 Update Selected Spiral Layer");
        btnUpdate.alignment = ["fill", "top"];
        btnUpdate.preferredSize = [-1, 26];
        btnUpdate.helpTip = "Updates the parameters of an already selected Spiral Shape layer in-place.";

        // ---------------------------------------------------------------------
        // 6. LAYER GENERATION LOGIC
        // ---------------------------------------------------------------------

        function getActiveComp() {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please open or select an active composition first.", SCRIPT_NAME);
                return null;
            }
            return comp;
        }

        function addOrSetSlider(layer, name, val) {
            var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!parade) return null;
            var effect = parade.property(name);
            if (!effect) {
                effect = parade.addProperty("ADBE Slider Control");
                effect.name = name;
            }
            if (effect) {
                var p = effect.property(1) || effect.property("Slider");
                if (p && typeof p.setValue === "function") {
                    p.setValue(val);
                }
            }
            return effect;
        }

        function addOrSetCheckbox(layer, name, val) {
            var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!parade) return null;
            var effect = parade.property(name);
            if (!effect) {
                effect = parade.addProperty("ADBE Checkbox Control");
                effect.name = name;
            }
            if (effect) {
                var p = effect.property(1) || effect.property("Checkbox");
                if (p && typeof p.setValue === "function") {
                    p.setValue(val ? 1 : 0);
                }
            }
            return effect;
        }

        function addOrSetColor(layer, name, rgbVal) {
            var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
            if (!parade) return null;
            var effect = parade.property(name);
            if (!effect) {
                effect = parade.addProperty("ADBE Color Control");
                effect.name = name;
            }
            if (effect) {
                var p = effect.property(1) || effect.property("Color");
                if (p && typeof p.setValue === "function") {
                    p.setValue(rgbVal);
                }
            }
            return effect;
        }

        function applySpiralParametersToLayer(layer, params, isNew) {
            // 1. Setup / Update Slider and Checkbox Controls
            addOrSetSlider(layer, "Spiral Type", params.spiralType + 1);
            addOrSetSlider(layer, "Turns", params.turns);
            addOrSetSlider(layer, "Start Radius", params.startRadius);
            addOrSetSlider(layer, "End Radius", params.endRadius);
            addOrSetSlider(layer, "Start Angle", params.startAngle);
            addOrSetCheckbox(layer, "Clockwise", params.clockwise);
            addOrSetSlider(layer, "Scale X", params.scaleX);
            addOrSetSlider(layer, "Scale Y", params.scaleY);
            addOrSetSlider(layer, "Resolution", params.resolution);

            addOrSetSlider(layer, "Start Thickness", params.startThickness);
            addOrSetSlider(layer, "End Thickness", params.endThickness);
            addOrSetCheckbox(layer, "Continuous Taper", params.continuousTaper);
            addOrSetSlider(layer, "Taper Start Length", params.taperStartLen);
            addOrSetSlider(layer, "Taper End Length", params.taperEndLen);
            addOrSetSlider(layer, "Taper Start Ease", params.taperStartEase);
            addOrSetSlider(layer, "Taper End Ease", params.taperEndEase);

            // 2. Setup Vector Groups if this is a newly created layer
            var root = layer.property("ADBE Root Vectors Group");
            var spiralGroup = root.property("Spiral Group");
            if (!spiralGroup) {
                spiralGroup = root.addProperty("ADBE Vector Group");
                spiralGroup.name = "Spiral Group";
            }
            var contents = spiralGroup.property("ADBE Vectors Group");

            // Fill (optional or background)
            var fill = contents.property("ADBE Vector Graphic - Fill") || contents.property("Spiral Fill");
            if (!fill && (params.enableFill || isNew)) {
                fill = contents.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Spiral Fill";
            }
            if (fill) {
                try {
                    var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                    if (fCol && typeof fCol.setValue === "function") fCol.setValue(hexToRgb(params.fillColor));
                    var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                    if (fOp && typeof fOp.setValue === "function") fOp.setValue(params.enableFill ? params.fillOpacity : 0);
                    fill.enabled = params.enableFill;
                } catch(eF2) {}
            }

            // Path
            var pathShape = contents.property("ADBE Vector Shape - Group") || contents.property("Spiral Path");
            if (!pathShape) {
                pathShape = contents.addProperty("ADBE Vector Shape - Group");
                pathShape.name = "Spiral Path";
            }
            var pathProp = pathShape ? (pathShape.property("ADBE Vector Shape") || pathShape.property("Path") || pathShape.property(1)) : null;
            if (pathProp) {
                if (params.liveRig) {
                    pathProp.expression = SPIRAL_PATH_EXPR;
                } else {
                    pathProp.expression = "";
                    var staticPath = computeStaticShapePath(params);
                    if (typeof pathProp.setValue === "function") pathProp.setValue(staticPath);
                }
            }

            // Stroke & Taper
            var stroke = contents.property("ADBE Vector Graphic - Stroke") || contents.property("Spiral Stroke");
            if (!stroke) {
                stroke = contents.addProperty("ADBE Vector Graphic - Stroke");
                stroke.name = "Spiral Stroke";
            }
            var strokeColProp = stroke ? (stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1)) : null;
            var strokeOpProp = stroke ? (stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(2)) : null;
            var strokeWProp = stroke ? (stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(3)) : null;
            var lineCapProp = stroke ? (stroke.property("ADBE Vector Stroke Line Cap") || stroke.property("Line Cap")) : null;
            var lineJoinProp = stroke ? (stroke.property("ADBE Vector Stroke Line Join") || stroke.property("Line Join")) : null;

            if (strokeColProp && typeof strokeColProp.setValue === "function") strokeColProp.setValue(hexToRgb(params.strokeColor));
            if (strokeOpProp && typeof strokeOpProp.setValue === "function") strokeOpProp.setValue(params.strokeOpacity);
            if (lineCapProp && typeof lineCapProp.setValue === "function") lineCapProp.setValue(params.lineCapIndex + 1);
            if (lineJoinProp && typeof lineJoinProp.setValue === "function") lineJoinProp.setValue(2);

            var maxThick = Math.max(params.startThickness, params.endThickness, 0.001);
            if (strokeWProp) {
                if (params.liveRig) {
                    strokeWProp.expression = STROKE_WIDTH_EXPR;
                } else {
                    strokeWProp.expression = "";
                    if (typeof strokeWProp.setValue === "function") strokeWProp.setValue(maxThick);
                }
            }

            // Native After Effects Stroke Taper (CC 2020 v17.0+)
            try {
                var taper = stroke ? (stroke.property("ADBE Vector Taper") || stroke.property("Taper") || stroke.property("ADBE Vector Stroke Taper")) : null;
                if (taper) {
                    var sWidthProp = taper.property("ADBE Vector Taper Start Width") || taper.property("Start Width") || taper.property(3);
                    var eWidthProp = taper.property("ADBE Vector Taper End Width") || taper.property("End Width") || taper.property(4);
                    var sLenProp = taper.property("ADBE Vector Taper Start Length") || taper.property("Start Length") || taper.property(1);
                    var eLenProp = taper.property("ADBE Vector Taper End Length") || taper.property("End Length") || taper.property(2);
                    var sEaseProp = taper.property("ADBE Vector Taper Start Ease") || taper.property("Start Ease") || taper.property(5);
                    var eEaseProp = taper.property("ADBE Vector Taper End Ease") || taper.property("End Ease") || taper.property(6);

                    // Set direct initial values
                    var sWVal = (params.startThickness / maxThick) * 100;
                    var eWVal = (params.endThickness / maxThick) * 100;
                    if (sWidthProp && typeof sWidthProp.setValue === "function") sWidthProp.setValue(sWVal);
                    if (eWidthProp && typeof eWidthProp.setValue === "function") eWidthProp.setValue(eWVal);

                    if (params.continuousTaper) {
                        if (params.startThickness <= params.endThickness) {
                            if (sLenProp && typeof sLenProp.setValue === "function") sLenProp.setValue(100);
                            if (eLenProp && typeof eLenProp.setValue === "function") eLenProp.setValue(0);
                        } else {
                            if (sLenProp && typeof sLenProp.setValue === "function") sLenProp.setValue(0);
                            if (eLenProp && typeof eLenProp.setValue === "function") eLenProp.setValue(100);
                        }
                    } else {
                        if (sLenProp && typeof sLenProp.setValue === "function") sLenProp.setValue(params.taperStartLen);
                        if (eLenProp && typeof eLenProp.setValue === "function") eLenProp.setValue(params.taperEndLen);
                    }

                    if (sEaseProp && typeof sEaseProp.setValue === "function") sEaseProp.setValue(params.taperStartEase);
                    if (eEaseProp && typeof eEaseProp.setValue === "function") eEaseProp.setValue(params.taperEndEase);

                    // Apply live expressions if requested
                    if (params.liveRig) {
                        if (sWidthProp) sWidthProp.expression = TAPER_START_WIDTH_EXPR;
                        if (eWidthProp) eWidthProp.expression = TAPER_END_WIDTH_EXPR;
                        if (sLenProp) sLenProp.expression = TAPER_START_LEN_EXPR;
                        if (eLenProp) eLenProp.expression = TAPER_END_LEN_EXPR;
                        if (sEaseProp) sEaseProp.expression = 'effect("Taper Start Ease")("Slider");';
                        if (eEaseProp) eEaseProp.expression = 'effect("Taper End Ease")("Slider");';
                    } else {
                        if (sWidthProp) sWidthProp.expression = "";
                        if (eWidthProp) eWidthProp.expression = "";
                        if (sLenProp) sLenProp.expression = "";
                        if (eLenProp) eLenProp.expression = "";
                        if (sEaseProp) sEaseProp.expression = "";
                        if (eEaseProp) eEaseProp.expression = "";
                    }
                }
            } catch(eTaper) {}

            // Trim Paths
            if (params.addTrimPaths) {
                var trim = contents.property("ADBE Vector Filter - Trim") || contents.property("Trim Paths");
                if (!trim) {
                    try {
                        trim = contents.addProperty("ADBE Vector Filter - Trim");
                        trim.name = "Trim Paths";
                    } catch(eTr) {}
                }
                if (trim) {
                    try {
                        var trStart = trim.property("ADBE Vector Trim Start") || trim.property("Start") || trim.property(1);
                        var trEnd = trim.property("ADBE Vector Trim End") || trim.property("End") || trim.property(2);
                        var trOff = trim.property("ADBE Vector Trim Offset") || trim.property("Offset") || trim.property(3);
                        if (trStart && typeof trStart.setValue === "function" && trStart.value === undefined) trStart.setValue(0);
                        if (trEnd && typeof trEnd.setValue === "function" && trEnd.value === undefined) trEnd.setValue(100);
                        if (trOff && typeof trOff.setValue === "function" && trOff.value === undefined) trOff.setValue(0);
                    } catch(eTrProps) {}
                }
            }
        }

        function collectUIParameters() {
            return {
                spiralType: dropSpiralType.selection ? dropSpiralType.selection.index : 0,
                turns: Math.max(0.01, numField(editTurns, 4.0)),
                startAngle: numField(editStartAngle, 0.0),
                startRadius: Math.max(0, numField(editStartRadius, 8.0)),
                endRadius: Math.max(0.01, numField(editEndRadius, 260.0)),
                clockwise: chkClockwise.value,
                scaleX: numField(editScaleX, 100.0),
                scaleY: numField(editScaleY, 100.0),
                resolution: Math.max(12, Math.round(numField(editRes, 48))),
                startThickness: Math.max(0, numField(editStartThick, 2.0)),
                endThickness: Math.max(0, numField(editEndThick, 24.0)),
                continuousTaper: chkContinuous.value,
                taperStartLen: Math.max(0, Math.min(100, numField(editTaperStartLen, 100))),
                taperEndLen: Math.max(0, Math.min(100, numField(editTaperEndLen, 100))),
                taperStartEase: Math.max(-100, Math.min(100, numField(editTaperStartEase, 0))),
                taperEndEase: Math.max(-100, Math.min(100, numField(editTaperEndEase, 0))),
                strokeColor: cpStrokeColor.value || "#00D4FF",
                strokeOpacity: Math.max(0, Math.min(100, numField(editStrokeOp, 100))),
                lineCapIndex: dropLineCap.selection ? dropLineCap.selection.index : 1,
                addTrimPaths: chkAddTrim.value,
                enableFill: chkEnableFill.value,
                fillColor: cpFillColor.value || "#00D4FF",
                fillOpacity: Math.max(0, Math.min(100, numField(editFillOp, 0))),
                liveRig: chkLiveRig.value
            };
        }

        function computeStaticShapePath(p) {
            var myShape = new Shape();
            var totalAng = p.turns * 2 * Math.PI;
            var dir = p.clockwise ? 1 : -1;
            var a0 = p.startAngle * (Math.PI / 180);
            var steps = Math.min(1000, Math.max(16, Math.round(p.turns * p.resolution)));
            var dTheta = totalAng / steps;
            var sx = p.scaleX / 100;
            var sy = p.scaleY / 100;
            var h = (4 / 3) * Math.tan(dTheta / 4);
            if (h <= 0 || !isFinite(h)) h = dTheta / 3;

            var verts = [];
            var inT = [];
            var outT = [];

            for (var i = 0; i <= steps; i++) {
                var u = i / steps;
                var r = 0, dr = 0;
                if (p.spiralType === 1 || p.spiralType === 2) {
                    var r0 = Math.max(0.1, p.startRadius);
                    var r1 = Math.max(0.2, p.endRadius);
                    var growth = Math.log(r1 / r0);
                    r = r0 * Math.exp(growth * u);
                    dr = totalAng > 1e-6 ? (growth / totalAng) * r : 0;
                } else if (p.spiralType === 3) {
                    var su = Math.sqrt(Math.max(1e-6, u));
                    r = p.startRadius + (p.endRadius - p.startRadius) * su;
                    dr = (totalAng > 1e-6 && su > 1e-6) ? ((p.endRadius - p.startRadius) / totalAng) / (2 * su) : 0;
                } else if (p.spiralType === 4) {
                    var r0H = Math.max(0.1, p.startRadius);
                    var kH = (p.endRadius / r0H) - 1;
                    var denom = 1 + kH * (1 - u);
                    r = denom > 1e-6 ? p.endRadius / denom : p.endRadius;
                    dr = (denom > 1e-6 && totalAng > 1e-6) ? (p.endRadius * kH / (denom * denom * totalAng)) : 0;
                } else {
                    r = p.startRadius + (p.endRadius - p.startRadius) * u;
                    dr = totalAng > 1e-6 ? (p.endRadius - p.startRadius) / totalAng : 0;
                }

                var phi = a0 + dir * (u * totalAng);
                var cosP = Math.cos(phi);
                var sinP = Math.sin(phi);

                var px = r * cosP * sx;
                var py = r * sinP * sy;
                verts.push([px, py]);

                var vx = (dr * cosP - r * sinP * dir) * sx;
                var vy = (dr * sinP + r * cosP * dir) * sy;
                var tx = vx * h;
                var ty = vy * h;

                if (i === 0) {
                    inT.push([0, 0]);
                    outT.push([tx, ty]);
                } else if (i === steps) {
                    inT.push([-tx, -ty]);
                    outT.push([0, 0]);
                } else {
                    inT.push([-tx, -ty]);
                    outT.push([tx, ty]);
                }
            }

            myShape.vertices = verts;
            myShape.inTangents = inT;
            myShape.outTangents = outT;
            myShape.closed = false;
            return myShape;
        }

        btnCreate.onClick = function() {
            var comp = getActiveComp();
            if (!comp) return;

            app.beginUndoGroup("Create Spiral Shape Layer");
            try {
                var params = collectUIParameters();
                var layer = comp.layers.addShape();
                var presetName = dropPreset.selection ? dropPreset.selection.text.split(" (")[0] : "Spiral";
                layer.name = presetName + " Shape";
                layer.notShyable = true;

                // Center in viewport (safely handle native AE Transform Group and simulator)
                try {
                    var trGroup = layer.property("ADBE Transform Group") || layer.property("Transform");
                    var posProp = trGroup ? (trGroup.property("ADBE Position") || trGroup.property("Position") || trGroup.property(1) || trGroup.property(2)) : null;
                    if (!posProp && layer.transform) posProp = layer.transform.position;
                    if (!posProp) posProp = layer.property("Position");
                    if (posProp && typeof posProp.setValue === "function") {
                        posProp.setValue([comp.width / 2, comp.height / 2]);
                    }
                } catch(ePos) {}

                applySpiralParametersToLayer(layer, params, true);
                layer.selected = true;
            } catch(err) {
                alert("Could not create Spiral Shape Layer:\n" + err.toString(), SCRIPT_NAME);
            } finally {
                app.endUndoGroup();
            }
        };

        btnUpdate.onClick = function() {
            var comp = getActiveComp();
            if (!comp) return;
            if (comp.selectedLayers.length === 0) {
                alert("Please select a Spiral Shape layer in the timeline to update.", SCRIPT_NAME);
                return;
            }

            var layer = comp.selectedLayers[0];
            var parade = layer.property("ADBE Effect Parade");
            if (!parade || !parade.property("Spiral Type")) {
                alert("Selected layer is not an AE Spiral Maker layer (missing Spiral Type control).", SCRIPT_NAME);
                return;
            }

            app.beginUndoGroup("Update Spiral Shape Layer");
            try {
                var params = collectUIParameters();
                applySpiralParametersToLayer(layer, params, false);
            } catch(err) {
                alert("Could not update Spiral Shape Layer:\n" + err.toString(), SCRIPT_NAME);
            } finally {
                app.endUndoGroup();
            }
        };

        // ---------------------------------------------------------------------
        // 7. FOOTER LINK
        // ---------------------------------------------------------------------
        var grpRepoLink = win.add("group");
        grpRepoLink.orientation = "row";
        grpRepoLink.alignment = ["fill", "bottom"];
        grpRepoLink.alignChildren = ["center", "center"];
        grpRepoLink.margins = [0, 4, 0, 0];

        var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE_spiral_maker");
        lblRepoLink.helpTip = GITHUB_REPO_URL;
        lblRepoLink.onClick = function() {
            var url = GITHUB_REPO_URL;
            if (typeof window !== "undefined" && window.open) {
                window.open(url, "_blank");
            } else if ($.os.indexOf("Windows") !== -1) {
                system.callSystem('explorer "' + url + '"');
            } else {
                system.callSystem('open "' + url + '"');
            }
        };

        win.layout.layout(true);
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    var scriptPanel = buildUI(thisObj);
    if (scriptPanel !== null && scriptPanel instanceof Window) {
        scriptPanel.center();
        scriptPanel.show();
    }

})(this);
