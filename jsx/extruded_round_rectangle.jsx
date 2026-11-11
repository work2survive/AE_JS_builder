// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: EXTRUDED ROUND RECTANGLE v1.3
// =============================================================================
//
// PURPOSE:
//   An interactive ScriptUI panel for After Effects that creates a parametric 3D
//   Extruded Rounded Rectangle built out of native Shape Layers inside a dedicated
//   precomposition with continuous rasterization.
//
// TOPOLOGY & GEOMETRY:
//   1. Front & Back Faces:
//      - Two 3D Shape Layers (Cap_Front at -Z/2, Cap_Back at +Z/2).
//      - Native procedural Bézier paths with 4 independent corner radii
//        (Top-Left, Top-Right, Bottom-Right, Bottom-Left) and W3C CSS
//        proportional overlap protection (§5.5).
//   2. Side Walls & Corners:
//      - 4 Straight Wall 3D Shape Layers (Top, Bottom, Left, Right) positioned
//        between the corner arcs.
//      - 4 Curved Corner Quadrants built from cylindrical sector wall facets
//        (Corner_TR, Corner_BR, Corner_BL, Corner_TL) with customizable segments.
//   3. Composition Hierarchy:
//      - Master Controller Layer (Extruded_Rect_Master_Controller) inside precomp.
//      - Precomp layer in parent comp with collapseTransformation = true.
//      - 17 Master Effect Controls driving geometry, corners, colors, and stroke.
//   4. Dimension Presets:
//      - Pulldown menu (Card, Cube, Pill, Tile, ...) loaded from a separate JSON file:
//        "AE Extruded round rect presets/presets.json" (next to the script).
//      - Folder & JSON are auto-created with defaults on first run (falls back to
//        the user's AppData / Documents folder if the script folder is read-only).
//
// COMPATIBILITY:
//   - Adobe After Effects CS6, CC 2014 - 2026+ (ExtendScript engine).
//   - Web AE JS & ScriptUI Emulator (ae-core.js, ae-renderer.js, app.js).
// =============================================================================

(function(thisObj) {
    "use strict";

    var SCRIPT_VERSION = "v1.3";

    // -------------------------------------------------------------------------
    // 1. ScriptUI Window / Dockable Panel Initialization
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "Extruded Round Rectangle " + SCRIPT_VERSION, undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "Extruded Round Rectangle " + SCRIPT_VERSION;
    }

    var currentPrecompName = "";

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 14;

    // -------------------------------------------------------------------------
    // 2. Helper Functions: Colors, Transforms & Cross-Platform Layer Access
    // -------------------------------------------------------------------------
    function hexToRgb(hex) {
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
        }
        var num = parseInt(hex, 16);
        return [
            ((num >> 16) & 255) / 255, // Red (0.0 to 1.0)
            ((num >> 8) & 255) / 255,  // Green (0.0 to 1.0)
            (num & 255) / 255          // Blue (0.0 to 1.0)
        ];
    }

    function getTransformProp(layer, propName) {
        if (!layer) return null;
        var p = null;
        if (layer.transform && typeof layer.transform.property === "function") {
            p = layer.transform.property(propName);
        }
        if (!p && typeof layer.property === "function") {
            var tg = layer.property("ADBE Transform Group") || layer.property("Transform");
            if (tg && typeof tg.property === "function") {
                p = tg.property(propName);
            }
        }
        if (!p && layer.transform) {
            if (propName === "X Rotation") p = layer.transform.xRotation;
            else if (propName === "Y Rotation") p = layer.transform.yRotation;
            else if (propName === "Z Rotation") p = layer.transform.zRotation || layer.transform.rotation;
            else if (propName === "Scale") p = layer.transform.scale;
            else if (propName === "Orientation") p = layer.transform.orientation;
            else if (propName === "Position") p = layer.transform.position;
            else if (propName === "Anchor Point") p = layer.transform.anchorPoint;
            else if (propName === "Opacity") p = layer.transform.opacity;
        }
        return p;
    }

    function setTransformVal(layer, propName, val) {
        var p = getTransformProp(layer, propName);
        if (p && typeof p.setValue === "function") {
            p.setValue(val);
        }
    }

    function setTransformExpr(layer, propName, expr) {
        var p = getTransformProp(layer, propName);
        if (p) {
            p.expression = expr;
        }
    }

    function getLayer(comp, nameOrIndex) {
        if (!comp) return null;
        if (typeof comp.layer === "function") {
            try {
                return comp.layer(nameOrIndex);
            } catch (e) {}
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

    function removeLayer(comp, layer) {
        if (!layer) return;
        if (typeof layer.remove === "function") {
            layer.remove();
        } else if (comp && comp.layers && typeof comp.layers.remove === "function") {
            comp.layers.remove(layer);
        }
    }

    // -------------------------------------------------------------------------
    // 2b. ExtendScript ES3 JSON Polyfill (Crockford json2 compliant)
    // -------------------------------------------------------------------------
    var JSONPolyfill = (function() {
        if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function" && typeof JSON.stringify === "function") {
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

    // -------------------------------------------------------------------------
    // 2c. External Dimension Presets (JSON file, auto-created on first run)
    //     Folder: "AE Extruded round rect presets/presets.json"
    //     Location: next to this script; falls back to the user's AppData or
    //     Documents folder when the script folder is not writable.
    // -------------------------------------------------------------------------
    var PRESETS_FOLDER_NAME = "AE Extruded round rect presets";
    var PRESETS_FILE_NAME = "presets.json";
    var currentPresetsFolder = null;
    var currentPresetsFile = null;
    var warnedSecurityPref = false;

    var DEFAULT_DIM_PRESETS = [
        {
            name: "Phone / Mobile",
            width: 360,
            height: 760,
            depth: 30,
            radius: 44,
            frontColor: "#111111",
            backColor: "#1a1a1a",
            capsOpacity: 100,
            sidesColor: "#0a0a0a",
            sidesOpacity: 100,
            strokeColor: "#000000",
            strokeWidth: 0,
            strokeOpacity: 0
        },
        {
            name: "Card",
            width: 500,
            height: 300,
            depth: 15,
            radius: 24,
            frontColor: "#FFF8DC",
            backColor: "#FEF3BD",
            capsOpacity: 100,
            sidesColor: "#EBD997",
            sidesOpacity: 100,
            strokeColor: "#FFFFFF",
            strokeWidth: 0,
            strokeOpacity: 0
        },
        {
            name: "Tablet",
            width: 720,
            height: 960,
            depth: 25,
            radius: 32,
            frontColor: "#CFD4D9",
            backColor: "#C2C7CD",
            capsOpacity: 100,
            sidesColor: "#9AA1A8",
            sidesOpacity: 100,
            strokeColor: "#222428",
            strokeWidth: 3,
            strokeOpacity: 100
        },
        {
            name: "Cube",
            width: 350,
            height: 350,
            depth: 350,
            radius: 40,
            frontColor: "#2288EE",
            backColor: "#EE8822",
            capsOpacity: 100,
            sidesColor: "#1166CC",
            sidesOpacity: 90,
            strokeColor: "#FFFFFF",
            strokeWidth: 2,
            strokeOpacity: 100
        },
        {
            name: "Pill",
            width: 600,
            height: 200,
            depth: 80,
            radius: 100,
            frontColor: "#00C2CB",
            backColor: "#FF6584",
            capsOpacity: 100,
            sidesColor: "#009FA7",
            sidesOpacity: 100,
            strokeColor: "#FFFFFF",
            strokeWidth: 2,
            strokeOpacity: 90
        },
        {
            name: "Tile",
            width: 400,
            height: 400,
            depth: 30,
            radius: 20,
            frontColor: "#333D4B",
            backColor: "#232B35",
            capsOpacity: 100,
            sidesColor: "#1D242C",
            sidesOpacity: 100,
            strokeColor: "#4E5969",
            strokeWidth: 1.5,
            strokeOpacity: 100
        },
        {
            name: "Wide Banner",
            width: 900,
            height: 180,
            depth: 50,
            radius: 16,
            frontColor: "#6C5CE7",
            backColor: "#A29BFE",
            capsOpacity: 100,
            sidesColor: "#5844D1",
            sidesOpacity: 95,
            strokeColor: "#FFFFFF",
            strokeWidth: 2,
            strokeOpacity: 90
        }
    ];

    function parsePresetObject(raw, defaultName) {
        if (!raw) return null;
        var w = parseFloat(raw.width), h = parseFloat(raw.height), d = parseFloat(raw.depth);
        if (isNaN(w) || isNaN(h) || isNaN(d)) return null;
        var obj = {
            name: String(raw.name || defaultName),
            width: w,
            height: h,
            depth: d
        };
        if (raw.radius !== undefined && !isNaN(parseFloat(raw.radius))) obj.radius = parseFloat(raw.radius);
        if (raw.frontColor) obj.frontColor = String(raw.frontColor);
        if (raw.backColor) obj.backColor = String(raw.backColor);
        if (raw.capsOpacity !== undefined && !isNaN(parseFloat(raw.capsOpacity))) obj.capsOpacity = parseFloat(raw.capsOpacity);
        if (raw.sidesColor) obj.sidesColor = String(raw.sidesColor);
        if (raw.sidesOpacity !== undefined && !isNaN(parseFloat(raw.sidesOpacity))) obj.sidesOpacity = parseFloat(raw.sidesOpacity);
        if (raw.strokeColor) obj.strokeColor = String(raw.strokeColor);
        if (raw.strokeWidth !== undefined && !isNaN(parseFloat(raw.strokeWidth))) obj.strokeWidth = parseFloat(raw.strokeWidth);
        if (raw.strokeOpacity !== undefined && !isNaN(parseFloat(raw.strokeOpacity))) obj.strokeOpacity = parseFloat(raw.strokeOpacity);
        return obj;
    }

    function cloneDefaultPresets() {
        var arr = [];
        for (var i = 0; i < DEFAULT_DIM_PRESETS.length; i++) {
            var p = DEFAULT_DIM_PRESETS[i];
            arr.push(parsePresetObject(p, p.name));
        }
        return arr;
    }

    // Active presets (loaded from JSON, with built-in fallback)
    var DIM_PRESETS = cloneDefaultPresets();

    function checkScriptSecurityPreference() {
        if (warnedSecurityPref) return;
        warnedSecurityPref = true;
        try {
            if (typeof app !== "undefined" && app && app.preferences) {
                var allowed = app.preferences.getPrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY");
                if (allowed === 0) {
                    alert("Notice: After Effects security is currently blocking scripts from writing files.\n\n" +
                          "To allow Extruded Round Rectangle to create its presets file, please enable:\n" +
                          "Preferences > Scripting & Expressions > 'Allow Scripts to Write Files and Access Network'.\n\n" +
                          "Built-in default presets will be used in memory for now.");
                }
            }
        } catch (ePref) {}
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
        } catch (e1) {}

        // Current working directory
        try {
            if (Folder.current) {
                candidates.push(new Folder(Folder.current.fsName + "/" + PRESETS_FOLDER_NAME));
            }
        } catch (eCurr) {}

        var userAppDataFolder = null;
        try {
            if (Folder.userData) {
                userAppDataFolder = new Folder(Folder.userData.fsName + "/Adobe/After Effects/" + PRESETS_FOLDER_NAME);
                candidates.push(userAppDataFolder);
            }
        } catch (e2) {}

        var userDocsFolder = null;
        try {
            if (Folder.myDocuments) {
                userDocsFolder = new Folder(Folder.myDocuments.fsName + "/Adobe/After Effects/" + PRESETS_FOLDER_NAME);
                candidates.push(userDocsFolder);
            }
        } catch (e3) {}

        // 1. Existing folder that already contains presets.json
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i] && candidates[i].exists) {
                var testF = new File(candidates[i].fsName + "/" + PRESETS_FILE_NAME);
                if (testF.exists) return candidates[i];
            }
        }

        // 2. Any existing (possibly empty) folder
        for (var j = 0; j < candidates.length; j++) {
            if (candidates[j] && candidates[j].exists) return candidates[j];
        }

        // 3. First run: try to create the folder (script folder, then AppData, then Documents)
        for (var c = 0; c < candidates.length; c++) {
            try {
                if (candidates[c] && candidates[c].create()) return candidates[c];
            } catch (eCreate) {}
        }

        checkScriptSecurityPreference();
        return candidates.length > 0 ? candidates[0] : null;
    }

    function ensurePresetsFile(folder) {
        if (!folder || typeof File === "undefined") return null;
        var pFile = new File(folder.fsName + "/" + PRESETS_FILE_NAME);
        if (pFile.exists) return pFile;

        try {
            if (!folder.exists && !folder.create()) {
                checkScriptSecurityPreference();
                return pFile;
            }
            pFile.encoding = "UTF-8";
            if (pFile.open("w")) {
                var dataObj = {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "description": "After Effects Extruded Round Rectangle - Style & Dimension Presets (dimensions, radii, fill, colors, opacity, stroke line). Edit freely, then press the reload button in the panel.",
                    "version": "1.1",
                    "presets": cloneDefaultPresets()
                };
                pFile.write(JSONPolyfill.stringify(dataObj, null, 2));
                pFile.close();
            } else {
                checkScriptSecurityPreference();
            }
        } catch (eWrite) {
            checkScriptSecurityPreference();
        }
        return pFile;
    }

    function loadPresetsFromFile() {
        DIM_PRESETS = cloneDefaultPresets();
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
                            var parsedItem = parsePresetObject(list[i], "Preset " + (i + 1));
                            if (parsedItem) loaded.push(parsedItem);
                        }
                    } else if (list && typeof list === "object") {
                        for (var k in list) {
                            if (list.hasOwnProperty(k) && k.charAt(0) !== "$" && k !== "version" && k !== "description") {
                                var parsedObj = parsePresetObject(list[k], k);
                                if (parsedObj) loaded.push(parsedObj);
                            }
                        }
                    }
                    if (loaded.length > 0) {
                        DIM_PRESETS = loaded;
                        return loaded.length;
                    }
                }
            }
        } catch (eLoad) {
            alert("Could not parse presets file:\n" + currentPresetsFile.fsName + "\n\n" + eLoad.toString() + "\n\nUsing built-in default presets.");
        }
        return 0;
    }

    loadPresetsFromFile();

    // -------------------------------------------------------------------------
    // 3. UI Header (Panel Title + Version & Description)
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Extruded Round Rectangle " + SCRIPT_VERSION);
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.alignment = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblDesc = pnlHeader.add("statictext", undefined, "v1.3 - Parametric 3D extruded rounded rectangle with procedural front/back caps and cylindrical corners.");

    // -------------------------------------------------------------------------
    // 4. Tabbed Panel (Geometry vs. Appearance)
    // -------------------------------------------------------------------------
    var tabs = win.add("tabbedpanel");
    tabs.alignChildren = ["fill", "top"];
    tabs.alignment = ["fill", "top"];

    // =========================================================================
    // TAB 1: GEOMETRY
    // =========================================================================
    var tabGeometry = tabs.add("tab", undefined, "Geometry");
    tabGeometry.orientation = "column";
    tabGeometry.alignChildren = ["fill", "top"];
    tabGeometry.spacing = 10;
    tabGeometry.margins = 10;

    // --- Dimensions Section ---
    var pnlDim = tabGeometry.add("panel", undefined, "Dimensions (Width, Height, Extrude Depth)");
    pnlDim.orientation = "column";
    pnlDim.spacing = 8;
    pnlDim.alignChildren = ["fill", "top"];
    pnlDim.alignment = ["fill", "top"];

    // Width
    var grpW = pnlDim.add("group");
    grpW.orientation = "row";
    grpW.alignment = ["fill", "top"];
    var lblW = grpW.add("statictext", undefined, "Width (X):");
    lblW.preferredSize = [70, -1];
    var sldW = grpW.add("slider", undefined, 500, 20, 1920);
    sldW.minvalue = 20; sldW.maxvalue = 1920; sldW.value = 500;
    sldW.alignment = ["fill", "center"];
    var txtW = grpW.add("edittext", undefined, "500");
    txtW.characters = 4;

    // Height
    var grpH = pnlDim.add("group");
    grpH.orientation = "row";
    grpH.alignment = ["fill", "top"];
    var lblH = grpH.add("statictext", undefined, "Height (Y):");
    lblH.preferredSize = [70, -1];
    var sldH = grpH.add("slider", undefined, 300, 20, 1080);
    sldH.minvalue = 20; sldH.maxvalue = 1080; sldH.value = 300;
    sldH.alignment = ["fill", "center"];
    var txtH = grpH.add("edittext", undefined, "300");
    txtH.characters = 4;

    // Extrude Depth
    var grpD = pnlDim.add("group");
    grpD.orientation = "row";
    grpD.alignment = ["fill", "top"];
    var lblD = grpD.add("statictext", undefined, "Depth (Z):");
    lblD.preferredSize = [70, -1];
    var sldD = grpD.add("slider", undefined, 120, 10, 800);
    sldD.minvalue = 10; sldD.maxvalue = 800; sldD.value = 120;
    sldD.alignment = ["fill", "center"];
    var txtD = grpD.add("edittext", undefined, "120");
    txtD.characters = 4;

    // Quick Dimension Presets (Pulldown menu, loaded from external JSON file)
    var grpDimPresets = pnlDim.add("group");
    grpDimPresets.orientation = "row";
    grpDimPresets.alignment = ["fill", "top"];
    grpDimPresets.alignChildren = ["left", "center"];
    grpDimPresets.spacing = 4;
    var lblDimPreset = grpDimPresets.add("statictext", undefined, "Preset:");
    lblDimPreset.preferredSize = [70, -1];
    var dropDimPreset = grpDimPresets.add("dropdownlist", undefined, []);
    dropDimPreset.alignment = ["fill", "center"];
    dropDimPreset.preferredSize = [150, -1];
    dropDimPreset.helpTip = "Dimension presets stored in '" + PRESETS_FOLDER_NAME + "/" + PRESETS_FILE_NAME + "'.";
    var btnReloadDimPresets = grpDimPresets.add("button", undefined, "\u21BB");
    btnReloadDimPresets.preferredSize = [26, 24];
    btnReloadDimPresets.helpTip = "Reload presets from the JSON file in '" + PRESETS_FOLDER_NAME + "'.";
    var btnOpenDimPresets = grpDimPresets.add("button", undefined, "📂");
    btnOpenDimPresets.preferredSize = [26, 24];
    btnOpenDimPresets.helpTip = "Open '" + PRESETS_FOLDER_NAME + "' folder in File Explorer / Finder.";

    var suppressPresetChange = false;

    function populateDimPresetDropdown() {
        suppressPresetChange = true;
        if (typeof dropDimPreset.removeAll === "function") {
            dropDimPreset.removeAll();
        }
        dropDimPreset.add("item", "Choose preset...");
        for (var i = 0; i < DIM_PRESETS.length; i++) {
            var p = DIM_PRESETS[i];
            dropDimPreset.add("item", p.name + " (" + p.width + " x " + p.height + " x " + p.depth + ")");
        }
        dropDimPreset.selection = 0;
        suppressPresetChange = false;
    }

    dropDimPreset.onChange = function() {
        if (suppressPresetChange || !dropDimPreset.selection) return;
        var idx = dropDimPreset.selection.index - 1;
        if (idx < 0 || idx >= DIM_PRESETS.length) return;
        var p = DIM_PRESETS[idx];
        applyPreset(p);
    };

    btnReloadDimPresets.onClick = function() {
        var c = loadPresetsFromFile();
        populateDimPresetDropdown();
        if (c > 0 && currentPresetsFile) {
            alert("Reloaded " + c + " presets from:\n" + currentPresetsFile.fsName);
        } else {
            alert("Could not read presets file. Using built-in default presets.");
        }
    };

    btnOpenDimPresets.onClick = function() {
        if (!currentPresetsFolder) currentPresetsFolder = getPresetsFolder();
        if (currentPresetsFolder && currentPresetsFolder.exists) {
            try {
                if (typeof currentPresetsFolder.execute === "function") {
                    currentPresetsFolder.execute();
                } else if (typeof system !== "undefined" && system.callSystem && $.os) {
                    if ($.os.indexOf("Windows") !== -1) {
                        system.callSystem('explorer "' + currentPresetsFolder.fsName + '"');
                    } else {
                        system.callSystem('open "' + currentPresetsFolder.fsName + '"');
                    }
                } else {
                    alert("Presets folder:\n" + currentPresetsFolder.fsName);
                }
            } catch (eOpen) {
                alert("Presets folder:\n" + currentPresetsFolder.fsName);
            }
        } else {
            alert("Presets folder:\n" + (currentPresetsFolder ? currentPresetsFolder.fsName : PRESETS_FOLDER_NAME));
        }
    };

    populateDimPresetDropdown();

    function applyPreset(p) {
        if (!p) return;

        // 1. Dimensions (Width, Height, Depth)
        if (p.width !== undefined) {
            var w = Math.max(sldW.minvalue, Math.min(sldW.maxvalue, p.width));
            sldW.value = w; txtW.text = String(w);
        }
        if (p.height !== undefined) {
            var h = Math.max(sldH.minvalue, Math.min(sldH.maxvalue, p.height));
            sldH.value = h; txtH.text = String(h);
        }
        if (p.depth !== undefined) {
            var d = Math.max(sldD.minvalue, Math.min(sldD.maxvalue, p.depth));
            sldD.value = d; txtD.text = String(d);
        }

        // 2. Corner Radius
        if (p.radius !== undefined && typeof sldMaster !== "undefined") {
            var r = Math.max(0, Math.min(400, p.radius));
            chkLink.value = true;
            grpMaster.enabled = true;
            grpGrid.enabled = false;
            sldMaster.value = r; txtMaster.text = String(Math.round(r));
            sldTL.value = r; txtTL.text = String(Math.round(r));
            sldTR.value = r; txtTR.text = String(Math.round(r));
            sldBL.value = r; txtBL.text = String(Math.round(r));
            sldBR.value = r; txtBR.text = String(Math.round(r));
        }

        // 3. Fill Colors & Opacities
        if (p.frontColor && typeof cpFront !== "undefined" && cpFront && typeof cpFront.setColor === "function") {
            cpFront.setColor(p.frontColor, false);
        }
        if (p.backColor && typeof cpBack !== "undefined" && cpBack && typeof cpBack.setColor === "function") {
            cpBack.setColor(p.backColor, false);
        }
        if (p.capsOpacity !== undefined && typeof sldCapOp !== "undefined" && sldCapOp && txtCapOp) {
            var capOp = Math.max(0, Math.min(100, p.capsOpacity));
            sldCapOp.value = capOp; txtCapOp.text = String(Math.round(capOp));
        }
        if (p.sidesColor && typeof cpSides !== "undefined" && cpSides && typeof cpSides.setColor === "function") {
            cpSides.setColor(p.sidesColor, false);
        }
        if (p.sidesOpacity !== undefined && typeof sldSidesOp !== "undefined" && sldSidesOp && txtSidesOp) {
            var sideOp = Math.max(0, Math.min(100, p.sidesOpacity));
            sldSidesOp.value = sideOp; txtSidesOp.text = String(Math.round(sideOp));
        }

        // 4. Line / Stroke Width, Color & Opacity
        if (p.strokeColor && typeof cpStroke !== "undefined" && cpStroke && typeof cpStroke.setColor === "function") {
            cpStroke.setColor(p.strokeColor, false);
        }
        if (p.strokeWidth !== undefined && typeof sldThick !== "undefined" && sldThick && txtThick) {
            var thick = Math.max(0, Math.min(30, p.strokeWidth));
            sldThick.value = thick; txtThick.text = String(thick);
        }
        if (p.strokeOpacity !== undefined && typeof sldStrokeOp !== "undefined" && sldStrokeOp && txtStrokeOp) {
            var stOp = Math.max(0, Math.min(100, p.strokeOpacity));
            sldStrokeOp.value = stOp; txtStrokeOp.text = String(Math.round(stOp));
        }

        buildOrUpdateExtruded(false);
    }

    function setDim(w, h, d, fromPreset) {
        w = Math.max(sldW.minvalue, Math.min(sldW.maxvalue, w));
        h = Math.max(sldH.minvalue, Math.min(sldH.maxvalue, h));
        d = Math.max(sldD.minvalue, Math.min(sldD.maxvalue, d));
        sldW.value = w; txtW.text = String(w);
        sldH.value = h; txtH.text = String(h);
        sldD.value = d; txtD.text = String(d);
        if (!fromPreset && dropDimPreset && dropDimPreset.selection && dropDimPreset.selection.index !== 0) {
            suppressPresetChange = true;
            dropDimPreset.selection = 0;
            suppressPresetChange = false;
        }
        buildOrUpdateExtruded(false);
    }

    // --- Corner Radii Section ---
    var pnlCorners = tabGeometry.add("panel", undefined, "Corner Radii & Resolution");
    pnlCorners.orientation = "column";
    pnlCorners.spacing = 6;
    pnlCorners.alignChildren = ["fill", "top"];
    pnlCorners.alignment = ["fill", "top"];

    var chkLink = pnlCorners.add("checkbox", undefined, "Link All Corners");
    chkLink.value = true;

    // Master Radius Row
    var grpMaster = pnlCorners.add("group");
    grpMaster.orientation = "row";
    grpMaster.alignment = ["fill", "top"];
    var lblMaster = grpMaster.add("statictext", undefined, "Radius:");
    lblMaster.preferredSize = [65, -1];
    var sldMaster = grpMaster.add("slider", undefined, 60, 0, 400);
    sldMaster.minvalue = 0; sldMaster.maxvalue = 400; sldMaster.value = 60;
    sldMaster.alignment = ["fill", "center"];
    var txtMaster = grpMaster.add("edittext", undefined, "60");
    txtMaster.characters = 4;

    // Individual Corner Radii (2x2 Grid with compact labels TL/TR/BL/BR)
    var grpGrid = pnlCorners.add("group");
    grpGrid.orientation = "column";
    grpGrid.spacing = 5;
    grpGrid.alignment = ["fill", "top"];
    grpGrid.enabled = false;

    // Row Top: TL and TR
    var grpRowTop = grpGrid.add("group");
    grpRowTop.orientation = "row";
    grpRowTop.alignment = ["fill", "top"];

    var lblTL = grpRowTop.add("statictext", undefined, "TL:");
    lblTL.preferredSize = [24, -1];
    var sldTL = grpRowTop.add("slider", undefined, 60, 0, 400);
    sldTL.minvalue = 0; sldTL.maxvalue = 400; sldTL.value = 60;
    sldTL.alignment = ["fill", "center"];
    var txtTL = grpRowTop.add("edittext", undefined, "60");
    txtTL.characters = 3;

    var lblTR = grpRowTop.add("statictext", undefined, "TR:");
    lblTR.preferredSize = [24, -1];
    var sldTR = grpRowTop.add("slider", undefined, 60, 0, 400);
    sldTR.minvalue = 0; sldTR.maxvalue = 400; sldTR.value = 60;
    sldTR.alignment = ["fill", "center"];
    var txtTR = grpRowTop.add("edittext", undefined, "60");
    txtTR.characters = 3;

    // Row Bottom: BL and BR
    var grpRowBottom = grpGrid.add("group");
    grpRowBottom.orientation = "row";
    grpRowBottom.alignment = ["fill", "top"];

    var lblBL = grpRowBottom.add("statictext", undefined, "BL:");
    lblBL.preferredSize = [24, -1];
    var sldBL = grpRowBottom.add("slider", undefined, 60, 0, 400);
    sldBL.minvalue = 0; sldBL.maxvalue = 400; sldBL.value = 60;
    sldBL.alignment = ["fill", "center"];
    var txtBL = grpRowBottom.add("edittext", undefined, "60");
    txtBL.characters = 3;

    var lblBR = grpRowBottom.add("statictext", undefined, "BR:");
    lblBR.preferredSize = [24, -1];
    var sldBR = grpRowBottom.add("slider", undefined, 60, 0, 400);
    sldBR.minvalue = 0; sldBR.maxvalue = 400; sldBR.value = 60;
    sldBR.alignment = ["fill", "center"];
    var txtBR = grpRowBottom.add("edittext", undefined, "60");
    txtBR.characters = 3;

    // Corner Segments Row (Cylindrical Resolution)
    var grpSeg = pnlCorners.add("group");
    grpSeg.orientation = "row";
    grpSeg.alignment = ["fill", "top"];
    var lblSeg = grpSeg.add("statictext", undefined, "Segments:");
    lblSeg.preferredSize = [65, -1];
    var sldSeg = grpSeg.add("slider", undefined, 6, 2, 16);
    sldSeg.minvalue = 2; sldSeg.maxvalue = 16; sldSeg.value = 6;
    sldSeg.alignment = ["fill", "center"];
    var txtSeg = grpSeg.add("edittext", undefined, "6");
    txtSeg.characters = 3;

    // Quick Corner Presets (2 Rows of 2 Buttons for compact resilience)
    var grpCornerPresets = pnlCorners.add("group");
    grpCornerPresets.orientation = "column";
    grpCornerPresets.alignChildren = ["fill", "top"];
    grpCornerPresets.spacing = 3;

    var rowCP1 = grpCornerPresets.add("group");
    rowCP1.orientation = "row";
    rowCP1.spacing = 4;
    var btnPreCapsule = rowCP1.add("button", undefined, "Capsule");
    var btnPreTabs = rowCP1.add("button", undefined, "Top Tab");

    var rowCP2 = grpCornerPresets.add("group");
    rowCP2.orientation = "row";
    rowCP2.spacing = 4;
    var btnPreDiag = rowCP2.add("button", undefined, "Diagonal");
    var btnPreSharp = rowCP2.add("button", undefined, "Sharp (0px)");

    btnPreCapsule.onClick = function() {
        chkLink.value = true;
        grpMaster.enabled = true;
        grpGrid.enabled = false;
        var r = Math.min(sldW.value, sldH.value) / 2;
        sldMaster.value = r; txtMaster.text = String(Math.round(r));
        setAllRadii(r, r, r, r);
    };

    btnPreTabs.onClick = function() {
        chkLink.value = false;
        grpMaster.enabled = false;
        grpGrid.enabled = true;
        setAllRadii(60, 60, 0, 0);
    };

    btnPreDiag.onClick = function() {
        chkLink.value = false;
        grpMaster.enabled = false;
        grpGrid.enabled = true;
        setAllRadii(80, 0, 80, 0);
    };

    btnPreSharp.onClick = function() {
        chkLink.value = true;
        grpMaster.enabled = true;
        grpGrid.enabled = false;
        sldMaster.value = 0; txtMaster.text = "0";
        setAllRadii(0, 0, 0, 0);
    };

    function setAllRadii(tl, tr, bl, br) {
        sldTL.value = tl; txtTL.text = String(Math.round(tl));
        sldTR.value = tr; txtTR.text = String(Math.round(tr));
        sldBL.value = bl; txtBL.text = String(Math.round(bl));
        sldBR.value = br; txtBR.text = String(Math.round(br));
        buildOrUpdateExtruded(false);
    }

    // Overlap Protection
    var chkOverlap = pnlCorners.add("checkbox", undefined, "Prevent Overlap (W3C CSS Proportional Scaling)");
    chkOverlap.value = true;
    chkOverlap.onClick = function() { buildOrUpdateExtruded(false); };

    // =========================================================================
    // TAB 2: APPEARANCE & STYLING
    // =========================================================================
    var tabAppearance = tabs.add("tab", undefined, "Appearance");
    tabAppearance.orientation = "column";
    tabAppearance.alignChildren = ["fill", "top"];
    tabAppearance.spacing = 10;
    tabAppearance.margins = 10;

    var pnlStyle = tabAppearance.add("panel", undefined, "Materials & Colors");
    pnlStyle.orientation = "column";
    pnlStyle.spacing = 8;
    pnlStyle.alignChildren = ["fill", "top"];
    pnlStyle.alignment = ["fill", "top"];

    // Color Picker Helper Function
    function createColorPicker(parent, defaultHex) {
        var grp = parent.add("group");
        grp.orientation = "row";
        grp.spacing = 6;
        grp.alignChildren = ["left", "center"];

        var btnSwatch = grp.add("button", undefined, "");
        btnSwatch.preferredSize = [36, 22];
        btnSwatch.helpTip = "Click to pick color";

        var txtHex = grp.add("edittext", undefined, defaultHex.toUpperCase());
        txtHex.preferredSize = [70, 22];
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
                if (btnSwatch.notify) btnSwatch.notify("onDraw");
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

        picker.setColor = setColor;
        setColor(defaultHex, false);
        return picker;
    }

    function resetPresetDropdown() {
        if (dropDimPreset && dropDimPreset.selection && dropDimPreset.selection.index !== 0) {
            suppressPresetChange = true;
            dropDimPreset.selection = 0;
            suppressPresetChange = false;
        }
    }

    // Front Face Color
    var grpFrontCol = pnlStyle.add("group");
    grpFrontCol.orientation = "row";
    grpFrontCol.alignment = ["fill", "top"];
    var lblFrontCol = grpFrontCol.add("statictext", undefined, "Front Color:");
    lblFrontCol.preferredSize = [135, -1];
    var cpFront = createColorPicker(grpFrontCol, "#2288ee");
    cpFront.onChange = function() { resetPresetDropdown(); buildOrUpdateExtruded(false); };

    // Back Face Color
    var grpBackCol = pnlStyle.add("group");
    grpBackCol.orientation = "row";
    grpBackCol.alignment = ["fill", "top"];
    var lblBackCol = grpBackCol.add("statictext", undefined, "Back Color:");
    lblBackCol.preferredSize = [135, -1];
    var cpBack = createColorPicker(grpBackCol, "#ee8822");
    cpBack.onChange = function() { resetPresetDropdown(); buildOrUpdateExtruded(false); };

    // Front / Back Caps Opacity
    var grpCapOp = pnlStyle.add("group");
    grpCapOp.orientation = "row";
    grpCapOp.alignment = ["fill", "top"];
    var lblCapOp = grpCapOp.add("statictext", undefined, "Caps Opacity:");
    lblCapOp.preferredSize = [135, -1];
    var sldCapOp = grpCapOp.add("slider", undefined, 100, 0, 100);
    sldCapOp.alignment = ["fill", "center"];
    var txtCapOp = grpCapOp.add("edittext", undefined, "100");
    txtCapOp.characters = 3;

    // Sides / Walls Color
    var grpSidesCol = pnlStyle.add("group");
    grpSidesCol.orientation = "row";
    grpSidesCol.alignment = ["fill", "top"];
    var lblSidesCol = grpSidesCol.add("statictext", undefined, "Sides Color:");
    lblSidesCol.preferredSize = [135, -1];
    var cpSides = createColorPicker(grpSidesCol, "#1166cc");
    cpSides.onChange = function() { resetPresetDropdown(); buildOrUpdateExtruded(false); };

    // Sides / Walls Opacity
    var grpSidesOp = pnlStyle.add("group");
    grpSidesOp.orientation = "row";
    grpSidesOp.alignment = ["fill", "top"];
    var lblSidesOp = grpSidesOp.add("statictext", undefined, "Sides Opacity:");
    lblSidesOp.preferredSize = [135, -1];
    var sldSidesOp = grpSidesOp.add("slider", undefined, 90, 0, 100);
    sldSidesOp.alignment = ["fill", "center"];
    var txtSidesOp = grpSidesOp.add("edittext", undefined, "90");
    txtSidesOp.characters = 3;

    // Stroke Color
    var grpStroke = pnlStyle.add("group");
    grpStroke.orientation = "row";
    grpStroke.alignment = ["fill", "top"];
    var lblStroke = grpStroke.add("statictext", undefined, "Stroke Color:");
    lblStroke.preferredSize = [135, -1];
    var cpStroke = createColorPicker(grpStroke, "#ffffff");
    cpStroke.onChange = function() { resetPresetDropdown(); buildOrUpdateExtruded(false); };

    // Stroke Width
    var grpThick = pnlStyle.add("group");
    grpThick.orientation = "row";
    grpThick.alignment = ["fill", "top"];
    var lblThick = grpThick.add("statictext", undefined, "Stroke Width:");
    lblThick.preferredSize = [135, -1];
    var sldThick = grpThick.add("slider", undefined, 2, 0, 30);
    sldThick.alignment = ["fill", "center"];
    var txtThick = grpThick.add("edittext", undefined, "2");
    txtThick.characters = 3;

    // Stroke Opacity
    var grpStrokeOp = pnlStyle.add("group");
    grpStrokeOp.orientation = "row";
    grpStrokeOp.alignment = ["fill", "top"];
    var lblStrokeOp = grpStrokeOp.add("statictext", undefined, "Stroke Opacity:");
    lblStrokeOp.preferredSize = [135, -1];
    var sldStrokeOp = grpStrokeOp.add("slider", undefined, 100, 0, 100);
    sldStrokeOp.alignment = ["fill", "center"];
    var txtStrokeOp = grpStrokeOp.add("edittext", undefined, "100");
    txtStrokeOp.characters = 3;

    // Inner Sides Checkbox (Non-animatable, paints inner sides using edge color)
    var grpInnerSides = pnlStyle.add("group");
    grpInnerSides.orientation = "row";
    grpInnerSides.alignment = ["fill", "top"];
    var chkInnerSides = grpInnerSides.add("checkbox", undefined, "Paint inner sides using edge color");
    chkInnerSides.value = true;
    chkInnerSides.helpTip = "Adds internal cap faces colored with the edge/sides color to avoid front/back colors leaking through edges at acute angles.";
    chkInnerSides.onClick = function() {
        buildOrUpdateExtruded(true);
    };

    // Imitate Corner Segments Checkbox (Non-animatable, matches cap corners to extruded wall facets)
    var grpSegmentCorners = pnlStyle.add("group");
    grpSegmentCorners.orientation = "row";
    grpSegmentCorners.alignment = ["fill", "top"];
    var chkSegmentCorners = grpSegmentCorners.add("checkbox", undefined, "Imitate segments of extruded round corners");
    chkSegmentCorners.value = true;
    chkSegmentCorners.helpTip = "Generates faceted cap corners that match the extruded wall segments vertex-for-vertex, preventing cap colors from leaking through edge facets.";
    chkSegmentCorners.onClick = function() {
        buildOrUpdateExtruded(true);
    };

    // Two-way slider hook helper
    function hookSliderText(sld, txt, onChangeFn, isInt) {
        function updateFromSlider() {
            var val = isInt ? Math.round(sld.value) : Math.round(sld.value * 10) / 10;
            if (isNaN(val)) val = isInt ? Math.round(sld.minvalue || 0) : 0;
            txt.text = String(val);
            if (typeof onChangeFn === "function") onChangeFn();
        }
        sld.onChanging = updateFromSlider;
        sld.onChange = updateFromSlider;

        txt.onChange = function() {
            var val = parseFloat(txt.text);
            if (isNaN(val)) val = (typeof sld.minvalue === "number") ? sld.minvalue : 0;
            var minV = (typeof sld.minvalue === "number") ? sld.minvalue : 0;
            var maxV = (typeof sld.maxvalue === "number") ? sld.maxvalue : 10000;
            val = Math.max(minV, Math.min(maxV, val));
            sld.value = val;
            txt.text = String(isInt ? Math.round(val) : Math.round(val * 10) / 10);
            if (typeof onChangeFn === "function") onChangeFn();
        };
    }

    var onLiveUpdate = function() {
        resetPresetDropdown();
        buildOrUpdateExtruded(false);
    };
    var onDimSliderUpdate = function() {
        resetPresetDropdown();
        buildOrUpdateExtruded(false);
    };
    hookSliderText(sldW, txtW, onDimSliderUpdate, true);
    hookSliderText(sldH, txtH, onDimSliderUpdate, true);
    hookSliderText(sldD, txtD, onDimSliderUpdate, true);
    hookSliderText(sldMaster, txtMaster, function() {
        if (chkLink.value) {
            var v = sldMaster.value;
            sldTL.value = v; txtTL.text = String(Math.round(v));
            sldTR.value = v; txtTR.text = String(Math.round(v));
            sldBL.value = v; txtBL.text = String(Math.round(v));
            sldBR.value = v; txtBR.text = String(Math.round(v));
        }
        onLiveUpdate();
    }, true);
    hookSliderText(sldTL, txtTL, onLiveUpdate, true);
    hookSliderText(sldTR, txtTR, onLiveUpdate, true);
    hookSliderText(sldBL, txtBL, onLiveUpdate, true);
    hookSliderText(sldBR, txtBR, onLiveUpdate, true);
    hookSliderText(sldSeg, txtSeg, onLiveUpdate, true);
    hookSliderText(sldCapOp, txtCapOp, onLiveUpdate, true);
    hookSliderText(sldSidesOp, txtSidesOp, onLiveUpdate, true);
    hookSliderText(sldThick, txtThick, onLiveUpdate, true);
    hookSliderText(sldStrokeOp, txtStrokeOp, onLiveUpdate, true);

    chkLink.onClick = function() {
        var linked = chkLink.value;
        grpMaster.enabled = linked;
        grpGrid.enabled = !linked;
        if (linked) {
            var v = sldMaster.value;
            sldTL.value = v; txtTL.text = String(Math.round(v));
            sldTR.value = v; txtTR.text = String(Math.round(v));
            sldBL.value = v; txtBL.text = String(Math.round(v));
            sldBR.value = v; txtBR.text = String(Math.round(v));
        }
        buildOrUpdateExtruded(false);
    };

    tabs.selection = 0;

    // --- Action Button (Anchored at the bottom outside of tabs) ---
    var btnBuild = win.add("button", undefined, "Build / Rebuild Extruded Rectangle");
    btnBuild.alignment = ["fill", "top"];
    btnBuild.preferredSize = [-1, 36];
    btnBuild.onClick = function() {
        buildOrUpdateExtruded(true);
    };

    // --- Bottom Subtle Repository Link ---
    var grpRepoLink = win.add("group");
    grpRepoLink.orientation = "row";
    grpRepoLink.alignment = ["fill", "bottom"];
    grpRepoLink.alignChildren = ["center", "center"];
    grpRepoLink.margins = [0, 4, 0, 0];
    var lblRepoLink = grpRepoLink.add("statictext", undefined, "GitHub: work2survive/AE_Extruded_Round_corners");
    lblRepoLink.helpTip = "https://github.com/work2survive/AE_Extruded_Round_corners";
    lblRepoLink.onClick = function() {
        var url = "https://github.com/work2survive/AE_Extruded_Round_corners";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else {
            system.callSystem('open "' + url + '"');
        }
    };

    // -------------------------------------------------------------------------
    // 5. Procedural Geometry & Expression Generation
    // -------------------------------------------------------------------------
    function computeCapShapeData(w, h, rTL, rTR, rBR, rBL, preventOverlap, imitateSegments, segCount) {
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

        var halfW = w / 2;
        var halfH = h / 2;
        var xMin = -halfW;
        var xMax =  halfW;
        var yMin = -halfH;
        var yMax =  halfH;

        var isSeg = (typeof imitateSegments === "undefined") ? true : imitateSegments;
        if (isSeg) {
            var S = Math.max(1, segCount || 6);
            var verts = [];
            var ins = [];
            var outs = [];

            function addV(x, y) {
                if (verts.length > 0) {
                    var last = verts[verts.length - 1];
                    if (Math.abs(last[0] - x) < 0.0001 && Math.abs(last[1] - y) < 0.0001) return;
                }
                verts.push([x, y]);
                ins.push([0, 0]);
                outs.push([0, 0]);
            }

            addV(xMin + rTL, yMin);
            addV(xMax - rTR, yMin);

            if (rTR > 0 && S >= 1) {
                var cX = xMax - rTR, cY = yMin + rTR;
                for (var s = 1; s <= S; s++) {
                    var rad = (-90 + s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rTR * Math.cos(rad), cY + rTR * Math.sin(rad));
                }
            } else {
                addV(xMax, yMin);
            }

            addV(xMax, yMax - rBR);

            if (rBR > 0 && S >= 1) {
                var cX = xMax - rBR, cY = yMax - rBR;
                for (var s = 1; s <= S; s++) {
                    var rad = (s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rBR * Math.cos(rad), cY + rBR * Math.sin(rad));
                }
            } else {
                addV(xMax, yMax);
            }

            addV(xMin + rBL, yMax);

            if (rBL > 0 && S >= 1) {
                var cX = xMin + rBL, cY = yMax - rBL;
                for (var s = 1; s <= S; s++) {
                    var rad = (90 + s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rBL * Math.cos(rad), cY + rBL * Math.sin(rad));
                }
            } else {
                addV(xMin, yMax);
            }

            addV(xMin, yMin + rTL);

            if (rTL > 0 && S >= 1) {
                var cX = xMin + rTL, cY = yMin + rTL;
                for (var s = 1; s < S; s++) {
                    var rad = (180 + s * (90 / S)) * (Math.PI / 180);
                    addV(cX + rTL * Math.cos(rad), cY + rTL * Math.sin(rad));
                }
            } else {
                addV(xMin, yMin);
            }

            return {
                points: verts,
                inTangents: ins,
                outTangents: outs
            };
        }

        var K = 0.5522847498307936;
        var points = [
            [xMin + rTL, yMin],
            [xMax - rTR, yMin],
            [xMax, yMin + rTR],
            [xMax, yMax - rBR],
            [xMax - rBR, yMax],
            [xMin + rBL, yMax],
            [xMin, yMax - rBL],
            [xMin, yMin + rTL]
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

    function getCapPathExpr(imitateSegments) {
        return [
            "// Procedural Path for Extruded Rounded Rectangle Caps",
            "(function() {",
            "    function getVal(name, fallback) {",
            "        try {",
            "            var p = thisComp.layer('Extruded_Rect_Master_Controller').effect(name)(1);",
            "            return (p && typeof p.value !== 'undefined') ? p.value : (p !== undefined ? p : fallback);",
            "        } catch(e) {",
            "            return fallback;",
            "        }",
            "    }",
            "",
            "    var w = Math.max(0, getVal('Width', 500));",
            "    var h = Math.max(0, getVal('Height', 300));",
            "    var linkAll = getVal('Link All Corners', 0);",
            "    var masterR = Math.max(0, getVal('Radius All', 60));",
            "",
            "    var rTL = linkAll ? masterR : Math.max(0, getVal('Radius Top-Left', 60));",
            "    var rTR = linkAll ? masterR : Math.max(0, getVal('Radius Top-Right', 60));",
            "    var rBR = linkAll ? masterR : Math.max(0, getVal('Radius Bottom-Right', 60));",
            "    var rBL = linkAll ? masterR : Math.max(0, getVal('Radius Bottom-Left', 60));",
            "",
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
            "        rTL *= f;",
            "        rTR *= f;",
            "        rBR *= f;",
            "        rBL *= f;",
            "    }",
            "",
            "    var halfW = w / 2;",
            "    var halfH = h / 2;",
            "    var xMin = -halfW;",
            "    var xMax =  halfW;",
            "    var yMin = -halfH;",
            "    var yMax =  halfH;",
            "",
            imitateSegments ? [
            "    var S = Math.max(1, Math.round(getVal('Corner Segments', 6)));",
            "    var verts = [];",
            "    var ins = [];",
            "    var outs = [];",
            "    function addV(x, y) {",
            "        if (verts.length > 0) {",
            "            var last = verts[verts.length - 1];",
            "            if (Math.abs(last[0] - x) < 0.0001 && Math.abs(last[1] - y) < 0.0001) return;",
            "        }",
            "        verts.push([x, y]);",
            "        ins.push([0, 0]);",
            "        outs.push([0, 0]);",
            "    }",
            "    addV(xMin + rTL, yMin);",
            "    addV(xMax - rTR, yMin);",
            "    if (rTR > 0 && S >= 1) {",
            "        var cX = xMax - rTR, cY = yMin + rTR;",
            "        for (var s = 1; s <= S; s++) {",
            "            var rad = (-90 + s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rTR * Math.cos(rad), cY + rTR * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMax, yMin);",
            "    }",
            "    addV(xMax, yMax - rBR);",
            "    if (rBR > 0 && S >= 1) {",
            "        var cX = xMax - rBR, cY = yMax - rBR;",
            "        for (var s = 1; s <= S; s++) {",
            "            var rad = (s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rBR * Math.cos(rad), cY + rBR * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMax, yMax);",
            "    }",
            "    addV(xMin + rBL, yMax);",
            "    if (rBL > 0 && S >= 1) {",
            "        var cX = xMin + rBL, cY = yMax - rBL;",
            "        for (var s = 1; s <= S; s++) {",
            "            var rad = (90 + s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rBL * Math.cos(rad), cY + rBL * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMin, yMax);",
            "    }",
            "    addV(xMin, yMin + rTL);",
            "    if (rTL > 0 && S >= 1) {",
            "        var cX = xMin + rTL, cY = yMin + rTL;",
            "        for (var s = 1; s < S; s++) {",
            "            var rad = (180 + s * (90 / S)) * (Math.PI / 180);",
            "            addV(cX + rTL * Math.cos(rad), cY + rTL * Math.sin(rad));",
            "        }",
            "    } else {",
            "        addV(xMin, yMin);",
            "    }",
            "    return createPath(verts, ins, outs, true);"
            ].join("\n") : [
            "    var K = 0.5522847498307936;",
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
            "        [-rTL * K, 0], [0, 0],",
            "        [0, -rTR * K], [0, 0],",
            "        [rBR * K, 0], [0, 0],",
            "        [0, rBL * K], [0, 0]",
            "    ];",
            "    var outTangents = [",
            "        [0, 0], [rTR * K, 0],",
            "        [0, 0], [0, rBR * K],",
            "        [0, 0], [-rBL * K, 0],",
            "        [0, 0], [0, -rTL * K]",
            "    ];",
            "    return createPath(points, inTangents, outTangents, true);"
            ].join("\n"),
            "",
            "})();"
        ].join("\n");
    }

    // -------------------------------------------------------------------------
    // 6. Core Engine: Build & Live-Update the Extruded Shape
    // -------------------------------------------------------------------------
    function buildOrUpdateExtruded(forceRebuild) {
        var parentComp = app.project ? app.project.activeItem : null;
        if (!parentComp || !(parentComp instanceof CompItem)) {
            if (forceRebuild) alert("Please select or open an active composition first.");
            return;
        }

        if (!forceRebuild && !currentPrecompName) return;

        var w = parseFloat(txtW.text) || 500;
        var h = parseFloat(txtH.text) || 300;
        var d = parseFloat(txtD.text) || 120;
        var linkAll = chkLink.value;
        var rAll = parseFloat(txtMaster.text) || 60;
        var rTL = linkAll ? rAll : (parseFloat(txtTL.text) || 0);
        var rTR = linkAll ? rAll : (parseFloat(txtTR.text) || 0);
        var rBR = linkAll ? rAll : (parseFloat(txtBR.text) || 0);
        var rBL = linkAll ? rAll : (parseFloat(txtBL.text) || 0);
        var segCount = Math.max(2, Math.min(16, parseInt(txtSeg.text, 10) || 6));
        var preventOverlap = chkOverlap.value;
        var imitateSegments = (typeof chkSegmentCorners !== "undefined") ? chkSegmentCorners.value : true;

        var frontColor = hexToRgb(cpFront._color);
        var backColor = hexToRgb(cpBack._color);
        var capsOpacity = Math.max(0, Math.min(100, parseFloat(txtCapOp.text) || 100));
        var sidesColor = hexToRgb(cpSides._color);
        var sidesOpacity = Math.max(0, Math.min(100, parseFloat(txtSidesOp.text) || 90));
        var strokeColor = hexToRgb(cpStroke._color);
        var strokeWidth = Math.max(0, parseFloat(txtThick.text) || 0);
        var strokeOpacity = Math.max(0, Math.min(100, parseFloat(txtStrokeOp.text) || 100));

        var center = [parentComp.width / 2, parentComp.height / 2, 0];

        // ---------------------------------------------------------------------
        // Case A: Structural Recreation
        // ---------------------------------------------------------------------
        if (forceRebuild) {
            if (app.beginUndoGroup) app.beginUndoGroup("Build Extruded Rounded Rectangle Precomp");

            try {
                var randNum = Math.floor(1000 + Math.random() * 9000);
                var precompName = "extruded_rect_" + randNum;
                currentPrecompName = precompName;

                // Clean up all previous layers from parent composition on build
                for (var p = parentComp.layers.length; p >= 1; p--) {
                    var oldL = getLayer(parentComp, p);
                    if (oldL) {
                        removeLayer(parentComp, oldL);
                    }
                }

                // 1. Create Master Controller Layer
                var master = parentComp.layers.addShape();
                master.name = "Extruded_Rect_Master_Controller";
                master.threeDLayer = true;
                master.shy = false;
                master.notShyable = true;
                master.label = 1;              // Red label
                master.colorLabel = "#ff3b30";
                setTransformVal(master, "Anchor Point", [0, 0, 0]);
                setTransformVal(master, "Position", center);

                var createdLayers = [];

                // Common function to configure Rect Vector Group
                function setupRectVector(layer, size, fillCol, fillOp, strCol, strW, strOp) {
                    var root = layer.property("ADBE Root Vectors Group") || layer.property("Contents") || (layer.property && layer.property(1));
                    var grp = root.addProperty("ADBE Vector Group");
                    grp.name = "Vector Group";

                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    contents.addProperty("ADBE Vector Shape - Rect");
                    contents.addProperty("ADBE Vector Graphic - Fill");
                    contents.addProperty("ADBE Vector Graphic - Stroke");

                    contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                    var rect = contents.property("ADBE Vector Shape - Rect") || contents.property(1);
                    if (rect) {
                        var rSize = rect.property("ADBE Vector Rect Size") || rect.property("Size") || rect.property(2) || rect.property(1);
                        if (rSize && rSize.setValue) rSize.setValue(size);
                    }

                    var fill = contents.property("ADBE Vector Graphic - Fill") || contents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol && fCol.setValue) fCol.setValue(fillCol);
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp && fOp.setValue) fOp.setValue(fillOp);
                    }

                    var stroke = contents.property("ADBE Vector Graphic - Stroke") || contents.property(3);
                    if (stroke) {
                        var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                        if (sCol && sCol.setValue) sCol.setValue(strCol);
                        var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                        if (sW && sW.setValue) sW.setValue(strW);
                        var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                        if (sOp && sOp.setValue) sOp.setValue(strW <= 0.0001 ? 0 : strOp);
                    }
                }

                // 2. Create 4 Straight Side Walls
                // Top Wall (Between TL and TR corners)
                var wallTop = parentComp.layers.addShape();
                wallTop.name = "Wall_Top";
                wallTop.threeDLayer = true;
                wallTop.shy = true;
                setupRectVector(wallTop, [Math.max(0.1, w - rTL - rTR), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallTop.parent = master;
                setTransformVal(wallTop, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallTop, "Position", [(-rTR + rTL) / 2, -h / 2, 0]);
                setTransformVal(wallTop, "Orientation", [90, 0, 0]);
                createdLayers.push(wallTop);

                // Bottom Wall (Between BL and BR corners)
                var wallBottom = parentComp.layers.addShape();
                wallBottom.name = "Wall_Bottom";
                wallBottom.threeDLayer = true;
                wallBottom.shy = true;
                setupRectVector(wallBottom, [Math.max(0.1, w - rBL - rBR), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallBottom.parent = master;
                setTransformVal(wallBottom, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallBottom, "Position", [(-rBR + rBL) / 2, h / 2, 0]);
                setTransformVal(wallBottom, "Orientation", [90, 180, 0]);
                createdLayers.push(wallBottom);

                // Left Wall (Between TL and BL corners)
                var wallLeft = parentComp.layers.addShape();
                wallLeft.name = "Wall_Left";
                wallLeft.threeDLayer = true;
                wallLeft.shy = true;
                setupRectVector(wallLeft, [Math.max(0.1, h - rTL - rBL), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallLeft.parent = master;
                setTransformVal(wallLeft, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallLeft, "Position", [-w / 2, (-rBL + rTL) / 2, 0]);
                setTransformVal(wallLeft, "Orientation", [90, -90, 0]);
                createdLayers.push(wallLeft);

                // Right Wall (Between TR and BR corners)
                var wallRight = parentComp.layers.addShape();
                wallRight.name = "Wall_Right";
                wallRight.threeDLayer = true;
                wallRight.shy = true;
                setupRectVector(wallRight, [Math.max(0.1, h - rTR - rBR), d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                wallRight.parent = master;
                setTransformVal(wallRight, "Anchor Point", [0, 0, 0]);
                setTransformVal(wallRight, "Position", [w / 2, (-rBR + rTR) / 2, 0]);
                setTransformVal(wallRight, "Orientation", [90, 90, 0]);
                createdLayers.push(wallRight);

                // 3. Create 4 Cylindrical Corner Quadrants
                function createCornerQuadrant(cornerId, centerFn, startDeg, endDeg, rVal) {
                    var sweep = endDeg - startDeg;
                    var alpha = (Math.abs(sweep) / segCount) * (Math.PI / 180);
                    var chord = Math.max(0.1, 2 * rVal * Math.sin(alpha / 2));
                    var rMid = rVal * Math.cos(alpha / 2);

                    for (var s = 0; s < segCount; s++) {
                        var theta = startDeg + (s + 0.5) * (sweep / segCount);
                        var rad = theta * (Math.PI / 180);
                        var cCenter = centerFn();
                        var posX = cCenter[0] + rMid * Math.cos(rad);
                        var posY = cCenter[1] + rMid * Math.sin(rad);

                        var cWall = parentComp.layers.addShape();
                        cWall.name = "Corner_" + cornerId + "_Wall_" + (s + 1);
                        cWall.threeDLayer = true;
                        cWall.shy = true;
                        setupRectVector(cWall, [chord, d], sidesColor, sidesOpacity, strokeColor, strokeWidth, strokeOpacity);
                        cWall.parent = master;
                        setTransformVal(cWall, "Anchor Point", [0, 0, 0]);
                        setTransformVal(cWall, "Position", [posX, posY, 0]);
                        setTransformVal(cWall, "Orientation", [90, theta + 90, 0]);
                        createdLayers.push(cWall);
                    }
                }

                // TR Corner (from -90° to 0°)
                createCornerQuadrant("TR", function() { return [w / 2 - rTR, -h / 2 + rTR]; }, -90, 0, rTR);
                // BR Corner (from 0° to 90°)
                createCornerQuadrant("BR", function() { return [w / 2 - rBR, h / 2 - rBR]; }, 0, 90, rBR);
                // BL Corner (from 90° to 180°)
                createCornerQuadrant("BL", function() { return [-w / 2 + rBL, h / 2 - rBL]; }, 90, 180, rBL);
                // TL Corner (from 180° to 270°)
                createCornerQuadrant("TL", function() { return [-w / 2 + rTL, -h / 2 + rTL]; }, 180, 270, rTL);

                // 4. Create Front and Back Caps (Procedural Bézier Geometry)
                function createCap(capName, zPos, xRot, capColor, isInner) {
                    var cap = parentComp.layers.addShape();
                    cap.name = capName;
                    cap.threeDLayer = true;
                    cap.shy = true;

                    var root = cap.property("ADBE Root Vectors Group") || cap.property("Contents") || (cap.property && cap.property(1));
                    var grp = root.addProperty("ADBE Vector Group");
                    grp.name = "Cap Vector";

                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    contents.addProperty("ADBE Vector Shape - Group");
                    contents.addProperty("ADBE Vector Graphic - Fill");
                    if (!isInner) {
                        contents.addProperty("ADBE Vector Graphic - Stroke");
                    }

                    contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));

                    var shapeGroup = contents.property("ADBE Vector Shape - Group") || contents.property(1);
                    if (shapeGroup) {
                        var pProp = shapeGroup.property("ADBE Vector Shape") || shapeGroup.property("Path") || (shapeGroup.numProperties >= 2 ? shapeGroup.property(2) : shapeGroup.property(1));
                        if (pProp) {
                            var capData = computeCapShapeData(w, h, rTL, rTR, rBR, rBL, preventOverlap, imitateSegments, segCount);
                            if (typeof Shape !== "undefined") {
                                try {
                                    var sObj = new Shape();
                                    sObj.vertices = capData.points;
                                    sObj.inTangents = capData.inTangents;
                                    sObj.outTangents = capData.outTangents;
                                    sObj.closed = true;
                                    pProp.setValue(sObj);
                                } catch(eS) {}
                            }
                        }
                    }

                    var fill = contents.property("ADBE Vector Graphic - Fill") || contents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol && fCol.setValue) fCol.setValue(capColor);
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp && fOp.setValue) fOp.setValue(capsOpacity);
                    }

                    if (!isInner) {
                        var stroke = contents.property("ADBE Vector Graphic - Stroke") || contents.property(3);
                        if (stroke) {
                            var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                            if (sCol && sCol.setValue) sCol.setValue(strokeColor);
                            var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                            if (sW && sW.setValue) sW.setValue(strokeWidth);
                            var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                            if (sOp && sOp.setValue) sOp.setValue(strokeWidth <= 0.0001 ? 0 : strokeOpacity);
                        }
                    }

                    cap.parent = master;
                    setTransformVal(cap, "Anchor Point", [0, 0, 0]);
                    setTransformVal(cap, "Position", [0, 0, zPos]);
                    setTransformVal(cap, "Orientation", [xRot, 0, 0]);
                    createdLayers.push(cap);
                    return cap;
                }

                var capFront = createCap("Cap_Front", -d / 2, 0, frontColor, false);
                var capBack = createCap("Cap_Back", d / 2, 0, backColor, false);
                var paintInnerSides = (typeof chkInnerSides !== "undefined") ? chkInnerSides.value : true;
                if (paintInnerSides) {
                    var capFrontInner = createCap("Cap_Front_Inner", -d / 2 + 0.15, 0, sidesColor, true);
                    var capBackInner = createCap("Cap_Back_Inner", d / 2 - 0.15, 0, sidesColor, true);
                }

                // 5. Precompose All Sub-Layers
                var indicesMap = {};
                if (master && master.index) indicesMap[master.index] = true;
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

                var preComp = parentComp.layers.precompose(indices, precompName, true);

                // Center preMaster inside precomp
                var preCenter = [preComp.width / 2, preComp.height / 2, 0];
                var preMaster = getLayer(preComp, "Extruded_Rect_Master_Controller") || (preComp.layer ? preComp.layer(1) : (preComp.layers && preComp.layers[0]));
                if (preMaster) {
                    preMaster.label = 1;
                    preMaster.colorLabel = "#ff3b30";
                    preMaster.notShyable = true;
                    if (preMaster.moveToBeginning) preMaster.moveToBeginning();
                    setTransformVal(preMaster, "Anchor Point", [0, 0, 0]);
                    setTransformVal(preMaster, "Position", preCenter);
                }

                // Target precomp layer in parent comp
                var extLayer = null;
                if (parentComp.layers) {
                    for (var pli = 1; pli <= parentComp.layers.length; pli++) {
                        var testL = parentComp.layer(pli);
                        if (testL && testL.source === preComp) {
                            extLayer = testL;
                            break;
                        }
                    }
                }
                if (!extLayer) {
                    extLayer = getLayer(parentComp, precompName) || getLayer(parentComp, 1);
                }
                if (extLayer) {
                    extLayer.name = precompName;
                    extLayer.threeDLayer = true;
                    if ("collapseTransformation" in extLayer) {
                        extLayer.collapseTransformation = true;
                    }
                    extLayer.label = 1;
                    extLayer.colorLabel = "#ff3b30";
                    extLayer.notShyable = true;
                    setTransformVal(extLayer, "Anchor Point", preCenter);
                    setTransformVal(extLayer, "Position", center);
                    if (extLayer.moveToBeginning) extLayer.moveToBeginning();
                }

                // 6. Master Controls on Parent Layer
                function addMasterProp(type, name, val) {
                    if (!extLayer) return null;
                    var parade = extLayer.property("ADBE Effect Parade") || extLayer.property("Effects");
                    if (!parade) return null;
                    var eff = parade.addProperty(type);
                    eff.name = name;
                    if (eff.property(1) && typeof eff.property(1).setValue === "function") {
                        eff.property(1).setValue(val);
                    }
                    return eff;
                }

                addMasterProp("ADBE Slider Control",   "Width",                w);
                addMasterProp("ADBE Slider Control",   "Height",               h);
                addMasterProp("ADBE Slider Control",   "Extrude Depth",        d);
                addMasterProp("ADBE Checkbox Control", "Link All Corners",     linkAll ? 1 : 0);
                addMasterProp("ADBE Slider Control",   "Radius All",           rAll);
                addMasterProp("ADBE Slider Control",   "Radius Top-Left",      rTL);
                addMasterProp("ADBE Slider Control",   "Radius Top-Right",     rTR);
                addMasterProp("ADBE Slider Control",   "Radius Bottom-Right",  rBR);
                addMasterProp("ADBE Slider Control",   "Radius Bottom-Left",   rBL);
                addMasterProp("ADBE Slider Control",   "Corner Segments",      segCount);
                addMasterProp("ADBE Checkbox Control", "Prevent Overlap",      preventOverlap ? 1 : 0);
                addMasterProp("ADBE Color Control",    "Front Color",          frontColor);
                addMasterProp("ADBE Color Control",    "Back Color",           backColor);
                addMasterProp("ADBE Slider Control",   "Caps Opacity",         capsOpacity);
                addMasterProp("ADBE Color Control",    "Sides Color",          sidesColor);
                addMasterProp("ADBE Slider Control",   "Sides Opacity",        sidesOpacity);
                addMasterProp("ADBE Color Control",    "Stroke Color",         strokeColor);
                addMasterProp("ADBE Slider Control",   "Stroke Width",         strokeWidth);
                addMasterProp("ADBE Slider Control",   "Stroke Opacity",       strokeOpacity);

                // 7. Expressions on Master Controller inside Subcomp
                if (preMaster) {
                    function linkControllerProp(effName, effTarget, defaultVal) {
                        var parade = preMaster.property("ADBE Effect Parade") || preMaster.property("Effects");
                        if (!parade) return null;
                        var eff = parade.addProperty(
                            effName.indexOf("Color") !== -1 ? "ADBE Color Control" :
                            (effName.indexOf("Link") !== -1 || effName.indexOf("Overlap") !== -1 ? "ADBE Checkbox Control" : "ADBE Slider Control")
                        );
                        eff.name = effName;
                        if (typeof defaultVal !== "undefined" && eff.property(1) && typeof eff.property(1).setValue === "function") {
                            eff.property(1).setValue(defaultVal);
                        }
                        eff.property(1).expression = 'try { comp("' + parentComp.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '").layer("' + precompName + '").effect("' + effTarget + '")(1).value; } catch(e) { value; }';
                        return eff;
                    }

                    linkControllerProp("Width", "Width", w);
                    linkControllerProp("Height", "Height", h);
                    linkControllerProp("Extrude Depth", "Extrude Depth", d);
                    linkControllerProp("Link All Corners", "Link All Corners", linkAll ? 1 : 0);
                    linkControllerProp("Radius All", "Radius All", rAll);
                    linkControllerProp("Radius Top-Left", "Radius Top-Left", rTL);
                    linkControllerProp("Radius Top-Right", "Radius Top-Right", rTR);
                    linkControllerProp("Radius Bottom-Right", "Radius Bottom-Right", rBR);
                    linkControllerProp("Radius Bottom-Left", "Radius Bottom-Left", rBL);
                    linkControllerProp("Corner Segments", "Corner Segments", segCount);
                    linkControllerProp("Prevent Overlap", "Prevent Overlap", preventOverlap ? 1 : 0);
                    linkControllerProp("Front Color", "Front Color", frontColor);
                    linkControllerProp("Back Color", "Back Color", backColor);
                    linkControllerProp("Caps Opacity", "Caps Opacity", capsOpacity);
                    linkControllerProp("Sides Color", "Sides Color", sidesColor);
                    linkControllerProp("Sides Opacity", "Sides Opacity", sidesOpacity);
                    linkControllerProp("Stroke Color", "Stroke Color", strokeColor);
                    linkControllerProp("Stroke Width", "Stroke Width", strokeWidth);
                    linkControllerProp("Stroke Opacity", "Stroke Opacity", strokeOpacity);
                }

                // 8. Dynamic Expressions on Subcomp Layers
                // Shared expression snippets
                var exprFrontCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Front Color")(1).value; } catch(e) { value; }';
                var exprBackCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Back Color")(1).value; } catch(e) { value; }';
                var exprCapsOp = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Caps Opacity")(1).value; } catch(e) { try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Front/Back Opacity")(1).value; } catch(e2) { value; } }';
                var exprSidesCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Sides Color")(1).value; } catch(e) { value; }';
                var exprSidesOp = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Sides Opacity")(1).value; } catch(e) { value; }';
                var exprStrokeCol = 'try { thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Color")(1).value; } catch(e) { value; }';
                var exprStrokeWidth = 'try { Math.max(0, thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Width")(1).value); } catch(e) { value; }';
                var exprStrokeOp = 'try { var sw = thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Width")(1).value; var op = thisComp.layer("Extruded_Rect_Master_Controller").effect("Stroke Opacity")(1).value; (sw <= 0.0001) ? 0 : op; } catch(e) { value; }';

                // Setup layer expressions helper
                function applyCommonMaterialExprs(lay, faceType) {
                    if (!lay) return;
                    var root = lay.property("ADBE Root Vectors Group") || lay.property("Contents") || (lay.property && lay.property(1));
                    if (!root) return;
                    var grp = root.property(1);
                    if (!grp) return;
                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    if (!contents) return;

                    var fill = contents.property("ADBE Vector Graphic - Fill") || contents.property(2);
                    if (fill) {
                        var fCol = fill.property("ADBE Vector Fill Color") || fill.property("Color") || fill.property(1);
                        if (fCol) {
                            if (faceType === "front") fCol.expression = exprFrontCol;
                            else if (faceType === "back") fCol.expression = exprBackCol;
                            else fCol.expression = exprSidesCol;
                        }
                        var fOp = fill.property("ADBE Vector Fill Opacity") || fill.property("Opacity") || fill.property(2);
                        if (fOp) fOp.expression = (faceType === "front" || faceType === "back") ? exprCapsOp : exprSidesOp;
                    }

                    var stroke = contents.property("ADBE Vector Graphic - Stroke") || contents.property(3);
                    if (stroke) {
                        var sCol = stroke.property("ADBE Vector Stroke Color") || stroke.property("Color") || stroke.property(1);
                        if (sCol) sCol.expression = exprStrokeCol;
                        var sW = stroke.property("ADBE Vector Stroke Width") || stroke.property("Stroke Width") || stroke.property(2);
                        if (sW) sW.expression = exprStrokeWidth;
                        var sOp = stroke.property("ADBE Vector Stroke Opacity") || stroke.property("Opacity") || stroke.property(3);
                        if (sOp) sOp.expression = exprStrokeOp;
                    }
                }

                // Front & Back Caps expressions
                var capPathExpr = getCapPathExpr(imitateSegments);

                var preCapFront = getLayer(preComp, "Cap_Front");
                if (preCapFront) {
                    setTransformExpr(preCapFront, "Position", 'try { [0, 0, -thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2]; } catch(e) { [0, 0, -' + (d / 2) + ']; }');
                    applyCommonMaterialExprs(preCapFront, "front");
                    var rootF = preCapFront.property("ADBE Root Vectors Group") || preCapFront.property("Contents") || (preCapFront.property && preCapFront.property(1));
                    var grpF = rootF.property(1);
                    var contF = grpF.property("ADBE Vectors Group") || grpF.property("Contents") || (grpF.property && grpF.property(2)) || (grpF.property && grpF.property(1));
                    var shpF = contF.property("ADBE Vector Shape - Group") || contF.property(1);
                    var pF = shpF.property("ADBE Vector Shape") || shpF.property("Path") || (shpF.numProperties >= 2 ? shpF.property(2) : shpF.property(1));
                    if (pF) pF.expression = capPathExpr;
                }

                var preCapFrontInner = getLayer(preComp, "Cap_Front_Inner");
                if (preCapFrontInner) {
                    setTransformExpr(preCapFrontInner, "Position", 'try { [0, 0, -thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2 + 0.15]; } catch(e) { [0, 0, -' + (d / 2 - 0.15) + ']; }');
                    applyCommonMaterialExprs(preCapFrontInner, "sides");
                    var rootFI = preCapFrontInner.property("ADBE Root Vectors Group") || preCapFrontInner.property("Contents") || (preCapFrontInner.property && preCapFrontInner.property(1));
                    var grpFI = rootFI.property(1);
                    var contFI = grpFI.property("ADBE Vectors Group") || grpFI.property("Contents") || (grpFI.property && grpFI.property(2)) || (grpFI.property && grpFI.property(1));
                    var shpFI = contFI.property("ADBE Vector Shape - Group") || contFI.property(1);
                    var pFI = shpFI.property("ADBE Vector Shape") || shpFI.property("Path") || (shpFI.numProperties >= 2 ? shpFI.property(2) : shpFI.property(1));
                    if (pFI) pFI.expression = capPathExpr;
                }

                var preCapBack = getLayer(preComp, "Cap_Back");
                if (preCapBack) {
                    setTransformExpr(preCapBack, "Position", 'try { [0, 0, thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2]; } catch(e) { [0, 0, ' + (d / 2) + ']; }');
                    applyCommonMaterialExprs(preCapBack, "back");
                    var rootB = preCapBack.property("ADBE Root Vectors Group") || preCapBack.property("Contents") || (preCapBack.property && preCapBack.property(1));
                    var grpB = rootB.property(1);
                    var contB = grpB.property("ADBE Vectors Group") || grpB.property("Contents") || (grpB.property && grpB.property(2)) || (grpB.property && grpB.property(1));
                    var shpB = contB.property("ADBE Vector Shape - Group") || contB.property(1);
                    var pB = shpB.property("ADBE Vector Shape") || shpB.property("Path") || (shpB.numProperties >= 2 ? shpB.property(2) : shpB.property(1));
                    if (pB) pB.expression = capPathExpr;
                }

                var preCapBackInner = getLayer(preComp, "Cap_Back_Inner");
                if (preCapBackInner) {
                    setTransformExpr(preCapBackInner, "Position", 'try { [0, 0, thisComp.layer("Extruded_Rect_Master_Controller").effect("Extrude Depth")(1).value / 2 - 0.15]; } catch(e) { [0, 0, ' + (d / 2 - 0.15) + ']; }');
                    applyCommonMaterialExprs(preCapBackInner, "sides");
                    var rootBI = preCapBackInner.property("ADBE Root Vectors Group") || preCapBackInner.property("Contents") || (preCapBackInner.property && preCapBackInner.property(1));
                    var grpBI = rootBI.property(1);
                    var contBI = grpBI.property("ADBE Vectors Group") || grpBI.property("Contents") || (grpBI.property && grpBI.property(2)) || (grpBI.property && grpBI.property(1));
                    var shpBI = contBI.property("ADBE Vector Shape - Group") || contBI.property(1);
                    var pBI = shpBI.property("ADBE Vector Shape") || shpBI.property("Path") || (shpBI.numProperties >= 2 ? shpBI.property(2) : shpBI.property(1));
                    if (pBI) pBI.expression = capPathExpr;
                }

                // Helper for wall dimensions & positions
                var exprSolverHeader = [
                    'var m = thisComp.layer("Extruded_Rect_Master_Controller");',
                    'function _gv(n, fb) { try { var eff = m.effect(n); return (eff && eff(1)) ? eff(1).value : fb; } catch(e) { return fb; } }',
                    'var w = Math.max(0, _gv("Width", ' + w + '));',
                    'var h = Math.max(0, _gv("Height", ' + h + '));',
                    'var d = Math.max(0, _gv("Extrude Depth", ' + d + '));',
                    'var link = _gv("Link All Corners", ' + (linkAll ? 1 : 0) + ') > 0;',
                    'var rAll = Math.max(0, _gv("Radius All", ' + rAll + '));',
                    'var rTL = link ? rAll : Math.max(0, _gv("Radius Top-Left", ' + rTL + '));',
                    'var rTR = link ? rAll : Math.max(0, _gv("Radius Top-Right", ' + rTR + '));',
                    'var rBR = link ? rAll : Math.max(0, _gv("Radius Bottom-Right", ' + rBR + '));',
                    'var rBL = link ? rAll : Math.max(0, _gv("Radius Bottom-Left", ' + rBL + '));',
                    'if (_gv("Prevent Overlap", ' + (preventOverlap ? 1 : 0) + ') > 0) {',
                    '    var tS = rTL + rTR, bS = rBL + rBR, lS = rTL + rBL, rS = rTR + rBR;',
                    '    var f = 1.0;',
                    '    if (tS > w && tS > 0) f = Math.min(f, w / tS);',
                    '    if (bS > w && bS > 0) f = Math.min(f, w / bS);',
                    '    if (lS > h && lS > 0) f = Math.min(f, h / lS);',
                    '    if (rS > h && rS > 0) f = Math.min(f, h / rS);',
                    '    rTL *= f; rTR *= f; rBR *= f; rBL *= f;',
                    '}'
                ].join('\n');

                function applyRectSizeExpr(lay, sizeExpr) {
                    if (!lay) return;
                    var root = lay.property("ADBE Root Vectors Group") || lay.property("Contents") || (lay.property && lay.property(1));
                    var grp = root.property(1);
                    var contents = grp.property("ADBE Vectors Group") || grp.property("Contents") || (grp.property && grp.property(2)) || (grp.property && grp.property(1));
                    var rect = contents.property("ADBE Vector Shape - Rect") || contents.property(1);
                    var rSize = rect.property("ADBE Vector Rect Size") || rect.property("Size") || rect.property(2) || rect.property(1);
                    if (rSize) rSize.expression = sizeExpr;
                }

                // Apply expressions to straight walls
                var preWallTop = getLayer(preComp, "Wall_Top");
                if (preWallTop) {
                    setTransformExpr(preWallTop, "Position", exprSolverHeader + '\n[(-rTR + rTL) / 2, -h / 2, 0];');
                    applyRectSizeExpr(preWallTop, exprSolverHeader + '\n[Math.max(0.1, w - rTL - rTR), d];');
                    applyCommonMaterialExprs(preWallTop, false);
                }

                var preWallBottom = getLayer(preComp, "Wall_Bottom");
                if (preWallBottom) {
                    setTransformExpr(preWallBottom, "Position", exprSolverHeader + '\n[(-rBR + rBL) / 2, h / 2, 0];');
                    applyRectSizeExpr(preWallBottom, exprSolverHeader + '\n[Math.max(0.1, w - rBL - rBR), d];');
                    applyCommonMaterialExprs(preWallBottom, false);
                }

                var preWallLeft = getLayer(preComp, "Wall_Left");
                if (preWallLeft) {
                    setTransformExpr(preWallLeft, "Position", exprSolverHeader + '\n[-w / 2, (-rBL + rTL) / 2, 0];');
                    applyRectSizeExpr(preWallLeft, exprSolverHeader + '\n[Math.max(0.1, h - rTL - rBL), d];');
                    applyCommonMaterialExprs(preWallLeft, false);
                }

                var preWallRight = getLayer(preComp, "Wall_Right");
                if (preWallRight) {
                    setTransformExpr(preWallRight, "Position", exprSolverHeader + '\n[w / 2, (-rBR + rTR) / 2, 0];');
                    applyRectSizeExpr(preWallRight, exprSolverHeader + '\n[Math.max(0.1, h - rTR - rBR), d];');
                    applyCommonMaterialExprs(preWallRight, false);
                }

                // Corner wall facet expressions
                function applyCornerWallExprs(cornerId, startDeg, endDeg, radiusVar, centerExpr) {
                    var sweep = endDeg - startDeg;
                    for (var s = 0; s < segCount; s++) {
                        var wName = "Corner_" + cornerId + "_Wall_" + (s + 1);
                        var lay = getLayer(preComp, wName);
                        if (lay) {
                            var tFormula = startDeg + ' + (' + s + ' + 0.5) * (' + sweep + ' / Math.max(1, Math.round(_gv("Corner Segments", ' + segCount + '))))';
                            var posExpr = [
                                exprSolverHeader,
                                'var r = ' + radiusVar + ';',
                                'var segs = Math.max(1, Math.round(_gv("Corner Segments", ' + segCount + ')));',
                                'var alpha = (' + Math.abs(sweep) + ' / segs) * (Math.PI / 180);',
                                'var rMid = r * Math.cos(alpha / 2);',
                                'var theta = ' + tFormula + ';',
                                'var rad = theta * (Math.PI / 180);',
                                'var c = ' + centerExpr + ';',
                                '[c[0] + rMid * Math.cos(rad), c[1] + rMid * Math.sin(rad), 0];'
                            ].join('\n');

                            var sizeExpr = [
                                exprSolverHeader,
                                'var r = ' + radiusVar + ';',
                                'var segs = Math.max(1, Math.round(_gv("Corner Segments", ' + segCount + ')));',
                                'var alpha = (' + Math.abs(sweep) + ' / segs) * (Math.PI / 180);',
                                'var chord = Math.max(0.1, 2 * r * Math.sin(alpha / 2));',
                                '[chord, d];'
                            ].join('\n');

                            var orientExpr = [
                                exprSolverHeader,
                                'var theta = ' + tFormula + ';',
                                '[90, theta + 90, 0];'
                            ].join('\n');

                            setTransformExpr(lay, "Position", posExpr);
                            setTransformExpr(lay, "Orientation", orientExpr);
                            applyRectSizeExpr(lay, sizeExpr);
                            applyCommonMaterialExprs(lay, false);
                        }
                    }
                }

                applyCornerWallExprs("TR", -90, 0, "rTR", '[w / 2 - rTR, -h / 2 + rTR]');
                applyCornerWallExprs("BR", 0, 90, "rBR", '[w / 2 - rBR, h / 2 - rBR]');
                applyCornerWallExprs("BL", 90, 180, "rBL", '[-w / 2 + rBL, h / 2 - rBL]');
                applyCornerWallExprs("TL", 180, 270, "rTL", '[-w / 2 + rTL, -h / 2 + rTL]');

                if (extLayer) extLayer.selected = true;

            } catch (err) {
                alert("Error building Extruded Rounded Rectangle: " + err.toString());
            } finally {
                if (app.endUndoGroup) app.endUndoGroup();
            }
        }
        // ---------------------------------------------------------------------
        // Case B: Live Updating Existing Composition
        // ---------------------------------------------------------------------
        else {
            var existingLayer = getLayer(parentComp, currentPrecompName);
            if (!existingLayer) return;

            function setEffectVal(layer, effName, val) {
                if (!layer) return;
                var parade = layer.property("ADBE Effect Parade") || layer.property("Effects");
                if (parade) {
                    var eff = parade.property(effName);
                    if (eff) {
                        var p = eff.property(1);
                        if (p && typeof p.setValue === "function") p.setValue(val);
                    }
                }
            }

            setEffectVal(existingLayer, "Width",                w);
            setEffectVal(existingLayer, "Height",               h);
            setEffectVal(existingLayer, "Extrude Depth",        d);
            setEffectVal(existingLayer, "Link All Corners",     linkAll ? 1 : 0);
            setEffectVal(existingLayer, "Radius All",           rAll);
            setEffectVal(existingLayer, "Radius Top-Left",      rTL);
            setEffectVal(existingLayer, "Radius Top-Right",     rTR);
            setEffectVal(existingLayer, "Radius Bottom-Right",  rBR);
            setEffectVal(existingLayer, "Radius Bottom-Left",   rBL);
            setEffectVal(existingLayer, "Corner Segments",      segCount);
            setEffectVal(existingLayer, "Prevent Overlap",      preventOverlap ? 1 : 0);
            setEffectVal(existingLayer, "Front Color",          frontColor);
            setEffectVal(existingLayer, "Back Color",           backColor);
            setEffectVal(existingLayer, "Caps Opacity",         capsOpacity);
            setEffectVal(existingLayer, "Front/Back Color",     frontColor);
            setEffectVal(existingLayer, "Front/Back Opacity",   capsOpacity);
            setEffectVal(existingLayer, "Sides Color",          sidesColor);
            setEffectVal(existingLayer, "Sides Opacity",        sidesOpacity);
            setEffectVal(existingLayer, "Stroke Color",         strokeColor);
            setEffectVal(existingLayer, "Stroke Width",         strokeWidth);
            setEffectVal(existingLayer, "Stroke Opacity",       strokeOpacity);
        }
    }

    // -------------------------------------------------------------------------
    // 7. Layout & Show Window
    // -------------------------------------------------------------------------
    if (win) {
        win.layout.layout(true);
        win.layout.resize();
        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        }
    }

    return win;
})(this);
