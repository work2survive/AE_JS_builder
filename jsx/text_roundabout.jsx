// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: TEXT ROUNDABOUT
// =============================================================================
//
// PURPOSE:
//   An interactive ScriptUI panel for After Effects that creates a parametric 3D
//   circular "Text Roundabout" (spinning carousel of 3D words) parented to a
//   master 3D controller null layer with continuous spin speed control.
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript ES3 engine).
//   - AE JS & ScriptUI Simulator (Web Emulator).
//   - Works both as a dockable panel (in ScriptUI Panels folder) and floating palette.
// =============================================================================

(function(thisObj) {
    "use strict";

    // ES3 String Helper (replaces unsupported String.prototype.trim)
    function trimStr(str) {
        if (!str) return "";
        return String(str).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    }

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Text Roundabout", undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Text Roundabout";
    }

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 14;

    // -------------------------------------------------------------------------
    // 2. Curated Word Pool & Color Palettes
    // -------------------------------------------------------------------------
    var WORD_POOL = [
        "CREATE", "DESIGN", "MOTION", "ENERGY", "FUTURE", "VISION",
        "DREAM", "INSPIRE", "DYNAMIC", "RHYTHM", "KINETIC", "SPARK",
        "VORTEX", "INFINITY", "ECLIPSE", "HORIZON", "VELOCITY", "SPECTRUM",
        "QUANTUM", "COSMOS", "RADIANT", "PULSE", "SYNAPSE", "ORBIT",
        "GRAVITY", "STELLAR", "CYBER", "NEBULA", "AURORA", "PRISM",
        "ZENITH", "NEXUS", "LUMEN", "AETHER", "MATRIX", "VECTOR"
    ];

    function hslToRgb(h, s, l) {
        var r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            function hue2rgb(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            }
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [r, g, b];
    }

    function getColorForIndex(i, total, theme) {
        if (theme === "Pastel Rainbow") {
            return hslToRgb(i / total, 0.75, 0.72);
        } else if (theme === "Cyberpunk Neon") {
            var cyberCols = [
                [0.0, 1.0, 0.9],   // Neon Cyan
                [1.0, 0.05, 0.55], // Neon Magenta
                [1.0, 0.92, 0.05], // Electric Yellow
                [0.45, 0.1, 1.0]   // Neon Purple
            ];
            return cyberCols[i % cyberCols.length];
        } else if (theme === "Gold & Amber") {
            var goldCols = [
                [1.0, 0.84, 0.0],  // Gold
                [1.0, 0.65, 0.1],  // Amber
                [0.98, 0.75, 0.2], // Warm Gold
                [1.0, 0.5, 0.0]    // Deep Amber
            ];
            return goldCols[i % goldCols.length];
        } else if (theme === "Monochrome White") {
            var v = 0.85 + (i % 2) * 0.15;
            return [v, v, v];
        } else {
            // Default: Vibrant Spectrum
            return hslToRgb(i / total, 0.95, 0.58);
        }
    }

    function getRandomWords(count) {
        var copy = [];
        for (var i = 0; i < WORD_POOL.length; i++) {
            copy.push(WORD_POOL[i]);
        }
        // Fisher-Yates Shuffle
        for (var j = copy.length - 1; j > 0; j--) {
            var randIdx = Math.floor(Math.random() * (j + 1));
            var tmp = copy[j];
            copy[j] = copy[randIdx];
            copy[randIdx] = tmp;
        }
        var selected = [];
        for (var k = 0; k < count && k < copy.length; k++) {
            selected.push(copy[k]);
        }
        return selected;
    }

    // -------------------------------------------------------------------------
    // 3. UI Header
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Text Roundabout");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "v1.0 - Kinetic 3D Word Carousel & Roundabout generator.");

    // -------------------------------------------------------------------------
    // 4. UI Section: Roundabout Configuration
    // -------------------------------------------------------------------------
    var pnlConfig = win.add("panel", undefined, "Roundabout Configuration");
    pnlConfig.orientation = "column";
    pnlConfig.spacing = 8;
    pnlConfig.alignChildren = ["fill", "top"];
    pnlConfig.alignment = ["fill", "top"];

    // --- Amount of Words (6 to 12) ---
    var grpWords = pnlConfig.add("group");
    grpWords.orientation = "row";
    grpWords.alignment = ["fill", "top"];
    var lblWords = grpWords.add("statictext", undefined, "Words (6-12):");
    lblWords.preferredSize = [100, -1];
    var sldWords = grpWords.add("slider", undefined, 8, 6, 12);
    sldWords.minvalue = 6;
    sldWords.maxvalue = 12;
    sldWords.value = 8;
    sldWords.alignment = ["fill", "center"];
    var txtWords = grpWords.add("edittext", undefined, "8");
    txtWords.characters = 3;

    // --- Spin Speed (-12 to +12) ---
    var grpSpeed = pnlConfig.add("group");
    grpSpeed.orientation = "row";
    grpSpeed.alignment = ["fill", "top"];
    var lblSpeed = grpSpeed.add("statictext", undefined, "Speed (-12..+12):");
    lblSpeed.preferredSize = [100, -1];
    var sldSpeed = grpSpeed.add("slider", undefined, 3, -12, 12);
    sldSpeed.minvalue = -12;
    sldSpeed.maxvalue = 12;
    sldSpeed.value = 3;
    sldSpeed.alignment = ["fill", "center"];
    var txtSpeed = grpSpeed.add("edittext", undefined, "3");
    txtSpeed.characters = 4;

    // --- Radius (150 to 700 px) ---
    var grpRad = pnlConfig.add("group");
    grpRad.orientation = "row";
    grpRad.alignment = ["fill", "top"];
    var lblRad = grpRad.add("statictext", undefined, "Radius (px):");
    lblRad.preferredSize = [100, -1];
    var sldRad = grpRad.add("slider", undefined, 320, 150, 700);
    sldRad.minvalue = 150;
    sldRad.maxvalue = 700;
    sldRad.value = 320;
    sldRad.alignment = ["fill", "center"];
    var txtRad = grpRad.add("edittext", undefined, "320");
    txtRad.characters = 4;

    // --- Tilt Angle X (-45 to +45) ---
    var grpTilt = pnlConfig.add("group");
    grpTilt.orientation = "row";
    grpTilt.alignment = ["fill", "top"];
    var lblTilt = grpTilt.add("statictext", undefined, "Tilt Angle (X):");
    lblTilt.preferredSize = [100, -1];
    var sldTilt = grpTilt.add("slider", undefined, 15, -45, 45);
    sldTilt.minvalue = -45;
    sldTilt.maxvalue = 45;
    sldTilt.value = 15;
    sldTilt.alignment = ["fill", "center"];
    var txtTilt = grpTilt.add("edittext", undefined, "15");
    txtTilt.characters = 4;

    // -------------------------------------------------------------------------
    // 5. UI Section: Text & Appearance
    // -------------------------------------------------------------------------
    var pnlStyle = win.add("panel", undefined, "Text & Appearance");
    pnlStyle.orientation = "column";
    pnlStyle.spacing = 8;
    pnlStyle.alignChildren = ["fill", "top"];
    pnlStyle.alignment = ["fill", "top"];

    // --- Font Size (18 to 72 px) ---
    var grpSize = pnlStyle.add("group");
    grpSize.orientation = "row";
    grpSize.alignment = ["fill", "top"];
    var lblSize = grpSize.add("statictext", undefined, "Font Size (px):");
    lblSize.preferredSize = [100, -1];
    var sldSize = grpSize.add("slider", undefined, 36, 18, 72);
    sldSize.minvalue = 18;
    sldSize.maxvalue = 72;
    sldSize.value = 36;
    sldSize.alignment = ["fill", "center"];
    var txtSize = grpSize.add("edittext", undefined, "36");
    txtSize.characters = 3;

    // --- Text Orientation Dropdown ---
    var grpOrient = pnlStyle.add("group");
    grpOrient.orientation = "row";
    grpOrient.alignment = ["fill", "top"];
    var lblOrient = grpOrient.add("statictext", undefined, "Orientation:");
    lblOrient.preferredSize = [100, -1];
    var dropOrient = grpOrient.add("dropdownlist", undefined, [
        "Face Outward (Carousel)",
        "Face Inward",
        "Face Camera (Billboard)"
    ]);
    dropOrient.selection = 0;
    dropOrient.alignment = ["fill", "center"];

    // --- Color Theme Dropdown ---
    var grpTheme = pnlStyle.add("group");
    grpTheme.orientation = "row";
    grpTheme.alignment = ["fill", "top"];
    var lblTheme = grpTheme.add("statictext", undefined, "Color Theme:");
    lblTheme.preferredSize = [100, -1];
    var dropTheme = grpTheme.add("dropdownlist", undefined, [
        "Vibrant Spectrum",
        "Cyberpunk Neon",
        "Pastel Rainbow",
        "Gold & Amber",
        "Monochrome White"
    ]);
    dropTheme.selection = 0;
    dropTheme.alignment = ["fill", "center"];

    // --- Custom Words Input (Optional) ---
    var grpCustom = pnlStyle.add("group");
    grpCustom.orientation = "column";
    grpCustom.alignChildren = ["fill", "top"];
    grpCustom.spacing = 3;
    var lblCustom = grpCustom.add("statictext", undefined, "Custom Words (comma-separated, optional):");
    var txtCustom = grpCustom.add("edittext", undefined, "");
    txtCustom.helpTip = "Type custom words separated by commas, or leave empty to auto-pick random words.";

    // -------------------------------------------------------------------------
    // 6. Two-Way Slider & EditText Synchronization
    // -------------------------------------------------------------------------
    function hookSliderText(sld, txt, minV, maxV, isInt) {
        sld.onChanging = function() {
            var v = isInt ? Math.round(sld.value) : Math.round(sld.value * 10) / 10;
            txt.text = String(v);
        };
        txt.onChange = function() {
            var v = parseFloat(txt.text);
            if (isNaN(v)) v = minV;
            v = Math.max(minV, Math.min(maxV, v));
            sld.value = v;
            txt.text = String(isInt ? Math.round(v) : Math.round(v * 10) / 10);
        };
    }

    hookSliderText(sldWords, txtWords, 6, 12, true);
    hookSliderText(sldSpeed, txtSpeed, -12, 12, true);
    hookSliderText(sldRad, txtRad, 150, 700, true);
    hookSliderText(sldTilt, txtTilt, -45, 45, true);
    hookSliderText(sldSize, txtSize, 18, 72, true);

    // -------------------------------------------------------------------------
    // 7. Action Button & Core Roundabout Builder Engine
    // -------------------------------------------------------------------------
    var btnBuild = win.add("button", undefined, "Build / Rebuild Text Roundabout");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.preferredSize = [-1, 36];

    function buildRoundabout() {
        var comp = app.project ? app.project.activeItem : null;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please open or select an active composition first.");
            return;
        }

        if (app.beginUndoGroup) {
            app.beginUndoGroup("Build Text Roundabout");
        }

        try {
            // Read UI parameters
            var numWords = Math.max(6, Math.min(12, parseInt(txtWords.text, 10) || 8));
            var spinSpeed = Math.max(-12, Math.min(12, parseFloat(txtSpeed.text) || 3));
            var radius = Math.max(100, parseFloat(txtRad.text) || 320);
            var tiltX = parseFloat(txtTilt.text) || 15;
            var fontSize = Math.max(12, parseFloat(txtSize.text) || 36);
            var orientMode = dropOrient.selection ? dropOrient.selection.index : 0;
            var themeName = dropTheme.selection ? dropTheme.selection.text : "Vibrant Spectrum";

            // Resolve words to use
            var words = [];
            var rawCustom = trimStr(txtCustom.text);
            if (rawCustom.length > 0) {
                var tokens = rawCustom.split(",");
                for (var t = 0; t < tokens.length; t++) {
                    var token = trimStr(tokens[t]);
                    if (token.length > 0) words.push(token);
                }
            }
            if (words.length < numWords) {
                var poolPicks = getRandomWords(numWords - words.length);
                for (var p = 0; p < poolPicks.length; p++) {
                    words.push(poolPicks[p]);
                }
            }
            if (words.length > numWords) {
                words = words.slice(0, numWords);
            }

            // Remove previous roundabout layers
            for (var l = comp.layers.length; l >= 1; l--) {
                var layer = comp.layers[l];
                if (layer && layer.name && (layer.name.indexOf("Roundabout_") === 0 || layer.name.indexOf("Word_") === 0)) {
                    layer.remove();
                }
            }

            var center = [comp.width / 2, comp.height / 2, 0];

            // 1. Create Master Controller Layer
            var master = (typeof comp.layers.addNull === "function") ? comp.layers.addNull() : comp.layers.addShape();
            master.name = "Roundabout_Controller";
            master.threeDLayer = true;
            master.label = 1;              // Red label in AE
            master.colorLabel = "#ff3b30"; // Red label in emulator
            master.notShyable = true;

            if (master.transform && master.transform.position) {
                master.transform.position.setValue(center);
            }
            if (master.transform && master.transform.xRotation) {
                master.transform.xRotation.setValue(tiltX);
            }

            // Add Master Slider Effect: "Spin Speed"
            var parade = master.property("ADBE Effect Parade") || master.property("Effects");
            if (parade) {
                var effSpeed = parade.addProperty("ADBE Slider Control");
                effSpeed.name = "Spin Speed";
                var sliderProp = effSpeed.property("ADBE Slider Control-0001") || effSpeed.property(1);
                if (sliderProp) {
                    sliderProp.setValue(spinSpeed);
                }

                var effRadius = parade.addProperty("ADBE Slider Control");
                effRadius.name = "Radius";
                var radProp = effRadius.property("ADBE Slider Control-0001") || effRadius.property(1);
                if (radProp) {
                    radProp.setValue(radius);
                }
            }

            // Continuous rotation expression on Y-Axis
            if (master.transform && master.transform.yRotation) {
                master.transform.yRotation.expression = "time * effect('Spin Speed')(1) * 30;";
            }

            // 2. Create 3D Word Layers in a circular ring
            var PI = Math.PI;
            for (var i = 0; i < words.length; i++) {
                var word = words[i];
                var angleDeg = i * (360 / words.length);
                var angleRad = angleDeg * (PI / 180);

                var x = radius * Math.sin(angleRad);
                var y = 0;
                var z = radius * Math.cos(angleRad);

                var textLayer = (typeof comp.layers.addText === "function") 
                    ? comp.layers.addText(word) 
                    : comp.layers.addShape();

                textLayer.name = "Word_" + (i + 1) + "_" + word;
                textLayer.threeDLayer = true;
                textLayer.label = 8;              // Blue label in AE
                textLayer.colorLabel = "#4d88ff"; // Blue label in emulator
                textLayer.parent = master;

                // Color based on theme
                var col = getColorForIndex(i, words.length, themeName);

                // Set source text properties in native AE
                try {
                    var sTextProp = textLayer.property("ADBE Text Properties") || textLayer.property("Text");
                    if (sTextProp) {
                        var docProp = sTextProp.property("ADBE Text Document") || textLayer.property("Source Text");
                        if (docProp) {
                            var textDoc = docProp.value;
                            if (textDoc) {
                                textDoc.fontSize = fontSize;
                                textDoc.fillColor = col;
                                textDoc.applyFill = true;
                                textDoc.applyStroke = false;
                                try {
                                    textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                                } catch(eJust) {}
                                docProp.setValue(textDoc);
                            }
                        }
                    }
                } catch(eDoc) {}

                // Emulator fallbacks
                textLayer.fontSize = fontSize;
                textLayer.fontColor = col;
                textLayer.justification = "center";

                // Set 3D Position
                if (textLayer.transform && textLayer.transform.position) {
                    textLayer.transform.position.setValue([x, y, z]);
                }

                // Set Orientation / Y-Rotation
                if (textLayer.transform) {
                    if (orientMode === 0) {
                        // Face Outward
                        if (textLayer.transform.yRotation) {
                            textLayer.transform.yRotation.setValue(angleDeg);
                        }
                    } else if (orientMode === 1) {
                        // Face Inward
                        if (textLayer.transform.yRotation) {
                            textLayer.transform.yRotation.setValue(angleDeg + 180);
                        }
                    } else {
                        // Face Camera (Billboard)
                        if (textLayer.transform.yRotation) {
                            textLayer.transform.yRotation.setValue(0);
                        }
                        if (textLayer.transform.xRotation) {
                            textLayer.transform.xRotation.setValue(-tiltX);
                        }
                    }
                }
            }

            // Keep master controller at top of layer hierarchy
            if (master.moveToBeginning) {
                master.moveToBeginning();
            }

            master.selected = true;

        } catch (err) {
            alert("Could not build Text Roundabout:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) {
                app.endUndoGroup();
            }
        }
    }

    btnBuild.onClick = function() {
        buildRoundabout();
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

    win.layout.layout(true);
    win.onResizing = win.onResize = function() { this.layout.resize(); };

    if (win instanceof Window) {
        win.center();
        win.show();
    }
})(this);
