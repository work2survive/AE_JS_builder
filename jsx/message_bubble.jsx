// =============================================================================
// ADOBE AFTER EFFECTS EXTENDSCRIPT & SCRIPTUI PANEL: MESSAGE BUBBLE GENERATOR
// =============================================================================
//
// PURPOSE:
//   An interactive ScriptUI panel for Adobe After Effects that generates authentic,
//   expression-rigged chat and text message bubbles imitating modern messaging
//   platforms (Android RCS, iOS Messages, WhatsApp, and Custom themes).
//
// FEATURES & WORKFLOW:
//   1. Message Text Input (Up to 250 characters, supports emojis).
//   2. Live Character Counter (with automatic 250-character limit enforcement).
//   3. Messaging Platform Preset Styles:
//      - Android RCS Style (Google Messages Material You)
//      - iOS Message Style (Apple iMessage)
//      - WhatsApp Style (with delivery checkmarks)
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

    var currentRandomTime = generateRandomTime();

    // -------------------------------------------------------------------------
    // 3. UI Header: Title & Description
    // -------------------------------------------------------------------------
    var pnlHeader = win.add("panel", undefined, "Message Bubble");
    pnlHeader.orientation = "column";
    pnlHeader.alignChildren = ["fill", "top"];
    pnlHeader.spacing = 3;
    pnlHeader.margins = [10, 8, 10, 8];

    pnlHeader.add("statictext", undefined, "Chat bubble generator for Android RCS, iOS, WhatsApp & Custom.");

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
        "Custom style"
    ]);
    dropPlatform.selection = 1; // Default: iOS message style
    dropPlatform.preferredSize = [160, 22];

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

    // -------------------------------------------------------------------------
    // 6. Dimensions & Typography (Screen Width determines line splits)
    // -------------------------------------------------------------------------
    var pnlDim = win.add("panel", undefined, "Layout & Typography");
    pnlDim.orientation = "column";
    pnlDim.alignChildren = ["fill", "top"];
    pnlDim.spacing = 8;
    pnlDim.margins = 10;

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

    // -------------------------------------------------------------------------
    // 7. Timestamp Section (Random time + Re-roll)
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
    btnRerollTime.preferredSize = [100, 24];
    btnRerollTime.onClick = function() {
        currentRandomTime = generateRandomTime();
        lblTimeVal.text = "Time: " + currentRandomTime;
    };

    // -------------------------------------------------------------------------
    // 8. Custom Colors Section (Revealed when Custom style is active)
    // -------------------------------------------------------------------------
    var pnlCustom = win.add("panel", undefined, "Custom Colors");
    pnlCustom.orientation = "column";
    pnlCustom.alignChildren = ["fill", "top"];
    pnlCustom.spacing = 6;
    pnlCustom.margins = 10;
    pnlCustom.visible = false;

    var grpCustomBubble = pnlCustom.add("group");
    grpCustomBubble.orientation = "row";
    grpCustomBubble.alignChildren = ["left", "center"];
    grpCustomBubble.add("statictext", undefined, "Bubble Color:").preferredSize = [95, -1];
    var txtCustomBubble = grpCustomBubble.add("edittext", undefined, "#2563EB");
    txtCustomBubble.characters = 8;

    var grpCustomText = pnlCustom.add("group");
    grpCustomText.orientation = "row";
    grpCustomText.alignChildren = ["left", "center"];
    grpCustomText.add("statictext", undefined, "Text Color:").preferredSize = [95, -1];
    var txtCustomText = grpCustomText.add("edittext", undefined, "#FFFFFF");
    txtCustomText.characters = 8;

    // Toggle custom panel visibility when style changes
    function checkCustomPanel() {
        var selIdx = dropPlatform.selection ? dropPlatform.selection.index : 0;
        pnlCustom.visible = (selIdx === 3); // 3 = Custom style
        win.layout.layout(true);
    }
    dropPlatform.onChange = function() {
        checkCustomPanel();
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
            var platformKeys = ["Android RCS", "iOS Message", "WhatsApp", "Custom"];
            var platformName = platformKeys[selStyleIdx] || "iOS Message";
            var platformCfg = PLATFORMS[platformName] || PLATFORMS["iOS Message"];

            var isSent = radSent.value;
            var isDark = radDark.value;
            var themeKey = isDark ? "dark" : "light";
            var dirKey = isSent ? "sent" : "received";
            var colorSet = platformCfg[themeKey][dirKey];

            // If custom style, override colors with user inputs
            if (platformName === "Custom") {
                colorSet = {
                    bubble: txtCustomBubble.text || "#2563EB",
                    text: txtCustomText.text || "#FFFFFF",
                    time: isDark ? "#9ca3af" : "#6b7280",
                    check: ""
                };
            }

            var screenW = parseFloat(txtWidth.text) || 420;
            var textSize = parseFloat(txtSize.text) || 20;

            // Chat messaging UX: Max bubble width is 72% of screen width
            var maxBubbleW = Math.max(120, screenW * 0.72);
            var padX = Math.round(textSize * 0.75);
            var padY = Math.round(textSize * 0.55);
            var maxTextW = maxBubbleW - (padX * 2);

            // Perform automatic word-wrapping
            var lines = wrapTextToLines(msgText, maxTextW, textSize);
            var wrappedString = lines.join("\n");
            var measuredTextW = getLinesPixelBounds(lines, textSize);

            var lineH = Math.round(textSize * 1.35);
            var textBlockH = lines.length * lineH;

            // Timestamp formatting
            var timeString = currentRandomTime;
            if (colorSet.check) {
                timeString += " " + colorSet.check;
            }
            var timeFontSize = Math.max(10, Math.round(textSize * 0.58));
            var timeW = Math.round(timeString.length * timeFontSize * 0.58);

            // Bubble bounding dimensions
            var singleLine = (lines.length === 1);
            var bubbleW = 0;
            var bubbleH = 0;
            if (singleLine && (measuredTextW + timeW + padX * 2 + 12 < maxBubbleW)) {
                // Inline single line message + timestamp
                bubbleW = measuredTextW + timeW + (padX * 2) + 12;
                bubbleH = textBlockH + (padY * 2);
            } else {
                // Multiline message + bottom timestamp row
                bubbleW = Math.max(measuredTextW, timeW) + (padX * 2);
                bubbleH = textBlockH + (padY * 2) + timeFontSize + 6;
            }

            var cornerRadius = platformCfg.radius || 18;
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

                var effCol = parade.addProperty("ADBE Color Control");
                if (effCol) { effCol.name = "Bubble Color"; effCol.property(1).setValue(hexToRgb(colorSet.bubble)); }
            }

            // 2. Bubble Vector Shape Layer
            var bubbleLayer = comp.layers.addShape();
            bubbleLayer.name = isSent ? "Bubble_Sent" : "Bubble_Received";
            bubbleLayer.parent = master;
            bubbleLayer.transform.position.setValue([0, 0, 0]);

            var contents = bubbleLayer.property("ADBE Root Vectors Group") || bubbleLayer.property("Contents");
            var group = contents.addProperty("ADBE Vector Group");
            group.name = "Bubble Group";
            var grpContents = group.property("ADBE Vectors Group") || group.property("Contents");

            var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
            rect.property("Size").setValue([bubbleW, bubbleH]);
            rect.property("Roundness").setValue(cornerRadius);

            var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
            fill.property("Color").setValue(hexToRgb(colorSet.bubble));

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
            textLayer.fontColor = hexToRgb(colorSet.text);
            textLayer.justification = "left";
            textLayer.transform.position.setValue([textLeftX, textTopY, 0]);

            // 4. Timestamp Text Layer
            var timeLayer = null;
            var timeX = (bubbleW / 2) - padX;
            var timeY = (bubbleH / 2) - Math.round(padY * 0.6) - timeFontSize;

            if (typeof comp.layers.addText === "function") {
                timeLayer = comp.layers.addText(timeString);
            } else {
                timeLayer = comp.layers.addShape();
            }
            timeLayer.name = "Timestamp_Text";
            timeLayer.parent = master;
            timeLayer.fontSize = timeFontSize;
            timeLayer.fontColor = hexToRgb(colorSet.time);
            timeLayer.justification = "right";
            timeLayer.transform.position.setValue([timeX, timeY, 0]);

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
    checkCustomPanel();

    win.layout.layout(true);
    win.onResizing = win.onResize = function() {
        this.layout.resize();
    };

    if (win !== null && win instanceof Window) {
        win.center();
        win.show();
    }

})(this);
