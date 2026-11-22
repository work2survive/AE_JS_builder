// Co-authored & architected with Google DeepMind Antigravity.
// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: AE TEXT PRECOMP
// =============================================================================
//
// PURPOSE:
//   Precomposes a selected text box (paragraph or point text) into a neatly-sized
//   composition so it is comfortable to manipulate, scale, position, and animate.
//
// FEATURES:
//   - Precomp Width sizing: Enter custom width or auto-detect from selected text layer.
//   - "Automatic precomp height": Expands precomp height to fit the textbox vertical size.
//   - "Automatic anchor point": Moves anchor point to the top of the text box,
//     placing it automatically on Left, Center, or Right depending on paragraph alignment.
//   - If no text layer is selected: Automatically creates a dummy text layer using
//     the size parameters, a system font (ArialMT), and 100 words of Lorem Ipsum.
//   - Zero Visual Shift: Mathematically calculates compensation so the text layer
//     does not jump on screen when precomposed and repositioned.
//   - Compatible with Adobe After Effects CS6 through CC 2026+ and the AE_JS_builder emulator.
// =============================================================================

(function(thisObj) {
    "use strict";

    // -------------------------------------------------------------------------
    // ES3 Helpers & Polyfills
    // -------------------------------------------------------------------------
    function trimStr(str) {
        if (!str) return "";
        return String(str).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    }

    // 100 Words of Lorem Ipsum
    var LOREM_IPSUM_100 =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut " +
        "labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris " +
        "nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit " +
        "esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in " +
        "culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error " +
        "sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore " +
        "veritatis et quasi architecto beatae vitae dicta sunt explicabo.";

    function wrapTextToWidth(text, maxWidth, fontSize) {
        var charWidth = (fontSize || 28) * 0.52;
        var maxCharsPerLine = Math.max(15, Math.floor(maxWidth / charWidth));
        var words = text.split(/\s+/);
        var lines = [];
        var currentLine = "";
        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (currentLine.length === 0) {
                currentLine = word;
            } else if ((currentLine.length + 1 + word.length) <= maxCharsPerLine) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        return lines.join("\n");
    }

    // -------------------------------------------------------------------------
    // Text Layer Detection & Metrics
    // -------------------------------------------------------------------------
    function isTextLayer(layer) {
        if (!layer) return false;
        try {
            if (typeof TextLayer !== "undefined" && layer instanceof TextLayer) return true;
        } catch (e) {}
        try {
            if (layer.property("ADBE Text Properties") !== null) return true;
            if (layer.property("Source Text") !== null) return true;
        } catch (e) {}
        return false;
    }

    function getSelectedTextLayer(comp) {
        if (!comp) {
            comp = app.project.activeItem;
        }
        if (!comp || !(comp instanceof CompItem)) return null;

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) return null;

        for (var i = 0; i < sel.length; i++) {
            if (isTextLayer(sel[i])) {
                return sel[i];
            }
        }
        return null;
    }

    function getTextLayerMetrics(comp, layer) {
        if (!layer) return null;

        var t = (comp && typeof comp.time !== "undefined") ? comp.time : 0;
        var rect = null;
        try {
            if (typeof layer.sourceRectAtTime === "function") {
                rect = layer.sourceRectAtTime(t, false);
            }
        } catch (eRect) {}

        if (!rect || typeof rect.width === "undefined") {
            rect = { left: 0, top: 0, width: 800, height: 200 };
        }

        var textProp = layer.property("Source Text");
        var textDoc = textProp ? textProp.value : null;

        var isBoxText = false;
        var boxWidth = 0;
        var boxHeight = 0;
        var justification = 7412; // LEFT_JUSTIFY default
        var align = "left";
        var font = "ArialMT";
        var fontSize = 28;

        if (textDoc) {
            try {
                if (textDoc.font) font = textDoc.font;
                if (textDoc.fontSize) fontSize = textDoc.fontSize;
                if (typeof textDoc.justification !== "undefined") {
                    justification = textDoc.justification;
                }
                if (textDoc.boxText && textDoc.boxTextSize) {
                    isBoxText = true;
                    boxWidth = textDoc.boxTextSize[0];
                    boxHeight = textDoc.boxTextSize[1];
                }
            } catch (eDoc) {}
        }

        // Justification evaluation
        if (typeof ParagraphJustification !== "undefined") {
            if (justification === ParagraphJustification.CENTER_JUSTIFY ||
                justification === ParagraphJustification.FULL_JUSTIFY_LASTCENTER) {
                align = "center";
            } else if (justification === ParagraphJustification.RIGHT_JUSTIFY ||
                       justification === ParagraphJustification.FULL_JUSTIFY_LASTRIGHT) {
                align = "right";
            } else {
                align = "left";
            }
        } else {
            if (justification == 7414 || justification == 7417) {
                align = "center";
            } else if (justification == 7413 || justification == 7416) {
                align = "right";
            } else {
                align = "left";
            }
        }

        var detW = isBoxText && boxWidth > 0 ? Math.round(boxWidth) : Math.ceil(rect.width);
        var detH = isBoxText && boxHeight > 0 ? Math.max(Math.round(boxHeight), Math.ceil(rect.height)) : Math.ceil(rect.height);

        return {
            layer: layer,
            name: layer.name,
            rect: rect,
            isBoxText: isBoxText,
            boxWidth: boxWidth,
            boxHeight: boxHeight,
            detectedWidth: Math.max(10, detW),
            detectedHeight: Math.max(10, detH),
            justification: justification,
            align: align,
            font: font,
            fontSize: fontSize
        };
    }

    // -------------------------------------------------------------------------
    // Create Dummy 100-Word Lorem Ipsum Text Layer
    // -------------------------------------------------------------------------
    function createDummyTextLayer(comp, targetW, targetH, autoHeight) {
        if (!comp) {
            comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                comp = app.project.items.addComp("AE Text Precomp Demo", 1920, 1080, 1.0, 10.0, 30.0);
                if (comp.openInViewer) comp.openInViewer();
            }
        }

        var w = targetW || 800;
        var h = (autoHeight || !targetH) ? 420 : targetH;

        var dummyLayer = comp.layers.addText(LOREM_IPSUM_100);
        dummyLayer.name = "Lorem Ipsum Text Box";

        // Center initially in composition
        dummyLayer.transform.position.setValue([comp.width / 2, comp.height / 2, 0]);

        var textProp = dummyLayer.property("Source Text");
        var doc = null;
        if (textProp) {
            try {
                doc = textProp.value;
            } catch (eVal) {}
        }

        if (doc) {
            doc.text = LOREM_IPSUM_100;
            doc.fontSize = 28;
            doc.font = "ArialMT"; // System font
            doc.fillColor = [0.95, 0.95, 0.95];
            doc.applyFill = true;
            doc.applyStroke = false;
            doc.leading = 40;
            doc.justification = (typeof ParagraphJustification !== "undefined")
                ? ParagraphJustification.LEFT_JUSTIFY
                : 7412;

            try {
                if (typeof doc.setBoxTextSize === "function") {
                    doc.setBoxTextSize([w, h]);
                } else if (typeof doc.boxText !== "undefined") {
                    doc.boxText = true;
                    doc.boxTextSize = [w, h];
                }
            } catch (eBox) {}

            try {
                textProp.setValue(doc);
            } catch (eSet) {}
        }

        // If box text is not supported by host engine, word wrap to fit width
        try {
            var r = dummyLayer.sourceRectAtTime(0, false);
            if (!r || r.width > (w * 1.4)) {
                var wrapped = wrapTextToWidth(LOREM_IPSUM_100, w, 28);
                if (doc) {
                    doc.text = wrapped;
                    textProp.setValue(doc);
                }
            }
        } catch (eWrap) {}

        // Select dummy layer
        var totalL = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
        for (var i = 1; i <= totalL; i++) {
            var l = comp.layer(i);
            if (l) l.selected = false;
        }
        dummyLayer.selected = true;

        return dummyLayer;
    }

    // -------------------------------------------------------------------------
    // Core Precompose Engine
    // -------------------------------------------------------------------------
    function precompTextLayer(options) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            comp = app.project.items.addComp("AE Text Precomp Demo", 1920, 1080, 1.0, 10.0, 30.0);
            if (comp.openInViewer) comp.openInViewer();
        }

        var textLayer = getSelectedTextLayer(comp);
        var createdDummy = false;

        if (!textLayer) {
            textLayer = createDummyTextLayer(comp, options.width, options.height, options.autoHeight);
            createdDummy = true;
        }

        var metrics = getTextLayerMetrics(comp, textLayer);

        // Store original transforms and parenting before precompose
        var origPos = textLayer.transform.position.value;
        var origAnchor = textLayer.transform.anchorPoint.value;
        var origScale = textLayer.transform.scale.value;
        var origRot = 0;
        try {
            if (textLayer.transform.rotation) {
                origRot = textLayer.transform.rotation.value;
            } else if (textLayer.transform.zRotation) {
                origRot = textLayer.transform.zRotation.value;
            }
        } catch (eRot) {}

        var origParent = textLayer.parent;
        var origName = textLayer.name;
        var is3D = textLayer.threeDLayer;

        // Alignment (auto-detected or overridden)
        var align = metrics.align;
        if (options.forceAlign && options.forceAlign !== "auto") {
            align = options.forceAlign;
        }

        // Width & Height calculation
        var targetW = options.width || metrics.detectedWidth || 800;
        var targetH = options.height || 400;

        var finalW = Math.max(20, Math.round(targetW));
        var finalH = 0;

        if (options.autoHeight) {
            // Expand precomp height to fit the textbox vertical size
            var textH = metrics.detectedHeight;
            if (metrics.rect && metrics.rect.height) {
                textH = Math.max(textH, Math.ceil(metrics.rect.height));
            }
            finalH = Math.max(20, Math.round(textH));
        } else {
            finalH = Math.max(20, Math.round(targetH));
        }

        // Calculate Anchor Point on the text box
        // Automatic Anchor Point: Top of the text box, positioned at Left, Center, or Right based on alignment
        var ax = 0;
        var ay = 0;

        if (options.autoAnchor) {
            if (metrics.isBoxText) {
                ay = 0;
                if (align === "left") {
                    ax = 0;
                } else if (align === "center") {
                    ax = metrics.boxWidth / 2;
                } else if (align === "right") {
                    ax = metrics.boxWidth;
                }
            } else {
                ay = metrics.rect.top;
                if (align === "left") {
                    ax = metrics.rect.left;
                } else if (align === "center") {
                    ax = metrics.rect.left + (metrics.rect.width / 2);
                } else if (align === "right") {
                    ax = metrics.rect.left + metrics.rect.width;
                }
            }
        } else {
            // Standard Center Anchor Point
            ax = metrics.rect.left + (metrics.rect.width / 2);
            ay = metrics.rect.top + (metrics.rect.height / 2);
        }

        // Calculate exact Main Comp coordinates where [ax, ay] is located
        var sx = origScale[0] / 100.0;
        var sy = origScale[1] / 100.0;
        var dx = (ax - origAnchor[0]) * sx;
        var dy = (ay - origAnchor[1]) * sy;
        var rad = (origRot || 0) * Math.PI / 180.0;
        var cosA = Math.cos(rad);
        var sinA = Math.sin(rad);

        var compPosX = origPos[0] + (dx * cosA - dy * sinA);
        var compPosY = origPos[1] + (dx * sinA + dy * cosA);
        var compPosZ = (origPos.length > 2) ? origPos[2] : 0;

        // Precomposition Name
        var precompName = trimStr(options.precompName);
        if (!precompName) {
            precompName = origName + " Comp";
        }

        // Execute Precompose
        var newComp = comp.layers.precompose([textLayer.index], precompName, true);
        if (!newComp) {
            var numItems = (typeof app.project.numItems !== "undefined") ? app.project.numItems : app.project.items.length;
            for (var p = 1; p <= numItems; p++) {
                var it = (typeof app.project.item === "function") ? app.project.item(p) : app.project.items[p - 1];
                if (it && it.name === precompName && (it instanceof CompItem)) {
                    newComp = it;
                    break;
                }
            }
        }

        if (!newComp) {
            throw new Error("Unable to create precomposition.");
        }

        // Set Precomposition Dimensions
        newComp.width = finalW;
        newComp.height = finalH;

        // Find the resulting precomp layer in the parent comp
        var precompLayer = null;
        var totalL = (typeof comp.numLayers !== "undefined") ? comp.numLayers : comp.layers.length;
        for (var i = 1; i <= totalL; i++) {
            var l = (typeof comp.layer === "function") ? comp.layer(i) : comp.layers[i - 1];
            if (l && l.source === newComp) {
                precompLayer = l;
                break;
            }
        }
        if (!precompLayer && comp.selectedLayers && comp.selectedLayers.length > 0) {
            precompLayer = comp.selectedLayers[0];
        }

        // Inside newComp: configure inner text layer
        var innerTextLayer = (typeof newComp.layer === "function") ? newComp.layer(1) : newComp.layers[0];
        if (innerTextLayer) {
            // Update boxText size if paragraph box
            if (metrics.isBoxText) {
                try {
                    var inProp = innerTextLayer.property("Source Text");
                    var inDoc = inProp ? inProp.value : null;
                    if (inDoc) {
                        if (typeof inDoc.setBoxTextSize === "function") {
                            inDoc.setBoxTextSize([finalW, finalH]);
                            inProp.setValue(inDoc);
                        } else if (inDoc.boxTextSize) {
                            inDoc.boxTextSize = [finalW, finalH];
                            inProp.setValue(inDoc);
                        }
                    }
                } catch (eInBox) {}
            }

            // Position and Anchor Point inside newComp
            if (options.autoAnchor) {
                innerTextLayer.transform.anchorPoint.setValue([ax, ay]);

                var innerX = 0;
                if (align === "center") {
                    innerX = finalW / 2;
                } else if (align === "right") {
                    innerX = finalW;
                }
                innerTextLayer.transform.position.setValue([innerX, 0, 0]);
            } else {
                innerTextLayer.transform.anchorPoint.setValue([ax, ay]);
                innerTextLayer.transform.position.setValue([finalW / 2, finalH / 2, 0]);
            }

            innerTextLayer.transform.scale.setValue([100, 100, 100]);
            try {
                if (innerTextLayer.transform.rotation) innerTextLayer.transform.rotation.setValue(0);
                if (innerTextLayer.transform.zRotation) innerTextLayer.transform.zRotation.setValue(0);
            } catch (eZeroRot) {}
        }

        // In parent comp: configure precompLayer
        if (precompLayer) {
            var precompAnchorX = 0;
            var precompAnchorY = 0;

            if (options.autoAnchor) {
                precompAnchorY = 0;
                if (align === "left") {
                    precompAnchorX = 0;
                } else if (align === "center") {
                    precompAnchorX = finalW / 2;
                } else if (align === "right") {
                    precompAnchorX = finalW;
                }
            } else {
                precompAnchorX = finalW / 2;
                precompAnchorY = finalH / 2;
            }

            precompLayer.transform.anchorPoint.setValue([precompAnchorX, precompAnchorY, 0]);
            precompLayer.transform.position.setValue([compPosX, compPosY, compPosZ]);
            precompLayer.transform.scale.setValue(origScale);
            try {
                if (precompLayer.transform.rotation) precompLayer.transform.rotation.setValue(origRot);
                if (precompLayer.transform.zRotation) precompLayer.transform.zRotation.setValue(origRot);
            } catch (eSetRot) {}

            if (origParent) {
                try { precompLayer.parent = origParent; } catch (ePar) {}
            }
            if (is3D) {
                try { precompLayer.threeDLayer = true; } catch (e3D) {}
            }

            precompLayer.selected = true;
        }

        return {
            success: true,
            newComp: newComp,
            precompLayer: precompLayer,
            width: finalW,
            height: finalH,
            align: align,
            createdDummy: createdDummy,
            name: precompName
        };
    }

    // -------------------------------------------------------------------------
    // ScriptUI Interface
    // -------------------------------------------------------------------------
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "AE Text Precomp", undefined, { resizeable: true });
    if (!(thisObj instanceof Panel)) {
        win.text = "AE Text Precomp";
    }

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 12;

    // --- Header ---
    var pnlHeader = win.add("panel", undefined, "AE Text Precomp");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    var lblSubTitle = pnlHeader.add("statictext", undefined, "Smart Text Box Precomposer & Dynamic Anchor Point Rigger");
    lblSubTitle.graphics.foregroundColor = win.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.35, 0.65, 0.95, 1], 1);

    // --- Detection & Status Panel ---
    var pnlDetect = win.add("panel", undefined, "Text Layer Detection");
    pnlDetect.orientation = "column";
    pnlDetect.alignChildren = ["fill", "top"];
    pnlDetect.spacing = 6;
    pnlDetect.margins = 10;

    var grpStatus = pnlDetect.add("group");
    grpStatus.orientation = "row";
    grpStatus.alignment = ["fill", "top"];
    var lblStatusIcon = grpStatus.add("statictext", undefined, "[Layer]:");
    lblStatusIcon.preferredSize = [60, -1];
    var lblStatusText = grpStatus.add("statictext", undefined, "Scanning active selection...");
    lblStatusText.alignment = ["fill", "center"];

    var btnAutoDetect = pnlDetect.add("button", undefined, "Auto-Detect Selected Text Size");
    btnAutoDetect.helpTip = "Detects dimensions and justification from the currently selected text layer.";

    // --- Precomp Dimensions Panel ---
    var pnlDims = win.add("panel", undefined, "Precomp Dimensions");
    pnlDims.orientation = "column";
    pnlDims.alignChildren = ["fill", "top"];
    pnlDims.spacing = 8;
    pnlDims.margins = 10;

    // Width Row
    var grpWidth = pnlDims.add("group");
    grpWidth.orientation = "row";
    grpWidth.alignment = ["fill", "top"];
    var lblWidth = grpWidth.add("statictext", undefined, "Precomp Width (px):");
    lblWidth.preferredSize = [130, -1];
    var txtWidth = grpWidth.add("edittext", undefined, "800");
    txtWidth.alignment = ["fill", "center"];

    // Quick Width Buttons
    var grpQuickW = pnlDims.add("group");
    grpQuickW.orientation = "row";
    grpQuickW.alignment = ["fill", "top"];
    var lblPresets = grpQuickW.add("statictext", undefined, "Quick Widths:");
    lblPresets.preferredSize = [130, -1];
    var btnW600 = grpQuickW.add("button", undefined, "600");
    btnW600.preferredSize = [50, 22];
    var btnW800 = grpQuickW.add("button", undefined, "800");
    btnW800.preferredSize = [50, 22];
    var btnW1080 = grpQuickW.add("button", undefined, "1080");
    btnW1080.preferredSize = [50, 22];
    var btnW1920 = grpQuickW.add("button", undefined, "1920");
    btnW1920.preferredSize = [50, 22];

    btnW600.onClick = function() { txtWidth.text = "600"; };
    btnW800.onClick = function() { txtWidth.text = "800"; };
    btnW1080.onClick = function() { txtWidth.text = "1080"; };
    btnW1920.onClick = function() { txtWidth.text = "1920"; };

    // Automatic Precomp Height Checkbox
    var chkAutoHeight = pnlDims.add("checkbox", undefined, "automatic precomp height");
    chkAutoHeight.value = true;
    chkAutoHeight.helpTip = "Expands the height of the precomp to fit the textbox vertical size automatically.";

    // Manual Height Row
    var grpHeight = pnlDims.add("group");
    grpHeight.orientation = "row";
    grpHeight.alignment = ["fill", "top"];
    var lblHeight = grpHeight.add("statictext", undefined, "Manual Height (px):");
    lblHeight.preferredSize = [130, -1];
    var txtHeight = grpHeight.add("edittext", undefined, "400");
    txtHeight.alignment = ["fill", "center"];
    txtHeight.enabled = false;

    chkAutoHeight.onClick = function() {
        txtHeight.enabled = !chkAutoHeight.value;
    };

    // --- Anchor Point Options Panel ---
    var pnlAnchor = win.add("panel", undefined, "Anchor Point & Alignment");
    pnlAnchor.orientation = "column";
    pnlAnchor.alignChildren = ["fill", "top"];
    pnlAnchor.spacing = 8;
    pnlAnchor.margins = 10;

    var chkAutoAnchor = pnlAnchor.add("checkbox", undefined, "automatic anchor point");
    chkAutoAnchor.value = true;
    chkAutoAnchor.helpTip = "Moves anchor point to the top of the text box (Top-Left, Top-Center, or Top-Right depending on alignment).";

    var grpAlign = pnlAnchor.add("group");
    grpAlign.orientation = "row";
    grpAlign.alignment = ["fill", "top"];
    var lblAlign = grpAlign.add("statictext", undefined, "Anchor Alignment:");
    lblAlign.preferredSize = [130, -1];
    var dropAlign = grpAlign.add("dropdownlist", undefined, [
        "Auto-detect from Alignment",
        "Force Top-Left",
        "Force Top-Center",
        "Force Top-Right"
    ]);
    dropAlign.selection = 0;
    dropAlign.alignment = ["fill", "center"];

    // --- Action Buttons ---
    var pnlActions = win.add("panel", undefined, "Actions");
    pnlActions.orientation = "column";
    pnlActions.alignChildren = ["fill", "top"];
    pnlActions.spacing = 8;
    pnlActions.margins = 10;

    var btnPrecomp = pnlActions.add("button", undefined, "Precomp Selected Text Box");
    btnPrecomp.preferredSize = [-1, 32];
    btnPrecomp.helpTip = "Precompose selected text box or creates 100-word dummy layer if none is selected.";

    var btnDummyOnly = pnlActions.add("button", undefined, "Create 100-Word Dummy Layer Only");
    btnDummyOnly.helpTip = "Creates a 100-word Lorem Ipsum text layer in the active composition without precomposing.";

    var lblFeedback = win.add("statictext", undefined, "Ready.");
    lblFeedback.alignment = ["fill", "bottom"];

    // --- Link Footer ---
    var grpFooter = win.add("group");
    grpFooter.orientation = "row";
    grpFooter.alignment = ["fill", "bottom"];
    grpFooter.alignChildren = ["center", "center"];
    grpFooter.margins = [0, 4, 0, 0];
    var lblRepo = grpFooter.add("statictext", undefined, "GitHub: work2survive/AE_JS_builder");
    lblRepo.helpTip = "https://github.com/work2survive/AE_JS_builder";
    lblRepo.onClick = function() {
        var url = "https://github.com/work2survive/AE_JS_builder";
        if (typeof window !== "undefined" && window.open) {
            window.open(url, "_blank");
        } else if ($.os && $.os.indexOf("Windows") !== -1) {
            system.callSystem('explorer "' + url + '"');
        } else if (typeof system !== "undefined" && system.callSystem) {
            system.callSystem('open "' + url + '"');
        }
    };

    // -------------------------------------------------------------------------
    // UI Event Handlers & State Sync
    // -------------------------------------------------------------------------
    function syncLayerDetection() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            lblStatusText.text = "No active composition found.";
            btnAutoDetect.enabled = false;
            return null;
        }

        var textLayer = getSelectedTextLayer(comp);
        if (textLayer) {
            var metrics = getTextLayerMetrics(comp, textLayer);
            var typeStr = metrics.isBoxText ? "Paragraph Box" : "Point Text";
            var alignStr = metrics.align.toUpperCase();
            lblStatusText.text = "'" + textLayer.name + "' (" + typeStr + ", " + alignStr + ")";
            btnAutoDetect.enabled = true;
            return metrics;
        } else {
            lblStatusText.text = "None selected (will create 100-word dummy layer)";
            btnAutoDetect.enabled = false;
            return null;
        }
    }

    btnAutoDetect.onClick = function() {
        var metrics = syncLayerDetection();
        if (metrics) {
            txtWidth.text = String(metrics.detectedWidth);
            txtHeight.text = String(metrics.detectedHeight);

            if (metrics.align === "center") {
                dropAlign.selection = 2; // Top-Center
            } else if (metrics.align === "right") {
                dropAlign.selection = 3; // Top-Right
            } else {
                dropAlign.selection = 1; // Top-Left
            }

            lblFeedback.text = "Auto-detected: " + metrics.detectedWidth + "x" + metrics.detectedHeight + "px (" + metrics.align + ")";
        } else {
            alert("Please select a text layer in your active composition first.");
        }
    };

    btnDummyOnly.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("Create 100-Word Dummy Layer");
        try {
            var comp = app.project.activeItem;
            var w = parseFloat(txtWidth.text) || 800;
            var h = parseFloat(txtHeight.text) || 400;
            var autoH = chkAutoHeight.value;

            var dummy = createDummyTextLayer(comp, w, h, autoH);
            syncLayerDetection();
            lblFeedback.text = "Created dummy layer: '" + dummy.name + "' with 100 words of Lorem Ipsum.";
        } catch (err) {
            alert("Error creating dummy text layer:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    btnPrecomp.onClick = function() {
        if (app.beginUndoGroup) app.beginUndoGroup("AE Text Precomp");
        try {
            var w = parseFloat(txtWidth.text) || 800;
            var h = parseFloat(txtHeight.text) || 400;
            var autoH = chkAutoHeight.value;
            var autoAnc = chkAutoAnchor.value;

            var forceAlign = "auto";
            if (dropAlign.selection) {
                var selIdx = dropAlign.selection.index;
                if (selIdx === 1) forceAlign = "left";
                else if (selIdx === 2) forceAlign = "center";
                else if (selIdx === 3) forceAlign = "right";
            }

            var res = precompTextLayer({
                width: w,
                height: h,
                autoHeight: autoH,
                autoAnchor: autoAnc,
                forceAlign: forceAlign
            });

            syncLayerDetection();
            var msg = "Precomposed into '" + res.name + "' [" + res.width + "x" + res.height + "px]";
            if (res.createdDummy) {
                msg += " (Generated 100-word dummy layer)";
            }
            lblFeedback.text = msg;
        } catch (err) {
            alert("Error precomposing text box:\n" + err.toString());
        } finally {
            if (app.endUndoGroup) app.endUndoGroup();
        }
    };

    // Initial check
    syncLayerDetection();

    win.layout.layout(true);
    win.onResizing = win.onResize = function() { this.layout.resize(); };

    if (win instanceof Window) {
        win.center();
        win.show();
    }
})(this);
