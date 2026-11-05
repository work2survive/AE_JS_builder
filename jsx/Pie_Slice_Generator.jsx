/*
    Pie / Circular Sector Generator for Adobe After Effects  (v4)
    Creates a native Shape Layer with an expression-driven Path.

    Vertices:
      A = centre of the pie
      B = start-angle corner (where the arc begins)
      C = end-angle corner   (where the arc ends)

    "Round Corners" checkbox enables independent rounding radii for A, B and C.
    Overlap protection: A has the highest priority, then C, then B.
    B (and C) are automatically reduced if their rounding would collide
    with A's rounding or with each other.
*/
(function (thisObj) {
    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Pie / Slice Generator", undefined, { resizeable: true });
        if (!(thisObj instanceof Panel)) {
            panel.text = "Pie / Slice Generator";
        }

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 8;
        panel.margins = 12;

        // ---------------------------------------------------------------------
        // UI Header (Panel Title + Version & Description)
        // ---------------------------------------------------------------------
        var pnlHeader = panel.add("panel", undefined, "Pie / Slice Generator");
        pnlHeader.orientation = "column";
        pnlHeader.alignChildren = ["fill", "top"];
        pnlHeader.alignment = ["fill", "top"];
        pnlHeader.spacing = 3;
        pnlHeader.margins = [10, 8, 10, 8];

        var lblDesc = pnlHeader.add("statictext", undefined, "v4.1 - Procedural Bézier Shape Layer pie & slice sector generator.");

        // ---------- Dimensions ----------
        var grpRadius = panel.add("panel", undefined, "Dimensions");
        grpRadius.orientation = "column";
        grpRadius.alignChildren = ["fill", "top"];

        var chkEllipse = grpRadius.add("checkbox", undefined, "Enable Ellipse (separate X / Y)");
        var grpRX = grpRadius.add("group");
        grpRX.add("statictext", undefined, "Radius X:");
        var txtRadX = grpRX.add("edittext", undefined, "200");
        txtRadX.characters = 7;

        var grpRY = grpRadius.add("group");
        grpRY.add("statictext", undefined, "Radius Y:");
        var txtRadY = grpRY.add("edittext", undefined, "200");
        txtRadY.characters = 7;
        grpRY.enabled = false;

        chkEllipse.onClick = function () {
            grpRY.enabled = chkEllipse.value;
        };

        // ---------- Angles ----------
        var grpAngles = panel.add("panel", undefined, "Angles (degrees)");
        grpAngles.orientation = "column";
        grpAngles.alignChildren = ["fill", "top"];

        var grpStart = grpAngles.add("group");
        grpStart.add("statictext", undefined, "Start angle (B):");
        var txtStart = grpStart.add("edittext", undefined, "0");
        txtStart.characters = 7;

        var grpEnd = grpAngles.add("group");
        grpEnd.add("statictext", undefined, "End angle (C):");
        var txtEnd = grpEnd.add("edittext", undefined, "90");
        txtEnd.characters = 7;

        // ---------- Corner rounding ----------
        var grpRound = panel.add("panel", undefined, "Corner Rounding");
        grpRound.orientation = "column";
        grpRound.alignChildren = ["fill", "top"];

        var chkRound = grpRound.add("checkbox", undefined, "Round Corners");

        var grpCorners = grpRound.add("group");
        grpCorners.orientation = "column";
        grpCorners.alignChildren = ["fill", "top"];

        var grpCA = grpCorners.add("group");
        grpCA.add("statictext", undefined, "Radius A (centre):");
        var txtCornerA = grpCA.add("edittext", undefined, "20");
        txtCornerA.characters = 7;

        var grpCB = grpCorners.add("group");
        grpCB.add("statictext", undefined, "Radius B (start):");
        var txtCornerB = grpCB.add("edittext", undefined, "20");
        txtCornerB.characters = 7;

        var grpCC = grpCorners.add("group");
        grpCC.add("statictext", undefined, "Radius C (end):");
        var txtCornerC = grpCC.add("edittext", undefined, "20");
        txtCornerC.characters = 7;

        grpCorners.enabled = false;

        chkRound.onClick = function () {
            grpCorners.enabled = chkRound.value;
        };

        var btnCreate = panel.add("button", undefined, "Create Pie Slice Shape Layer");
        btnCreate.alignment = ["fill", "top"];
        btnCreate.preferredSize = [-1, 36];

        function numberFromField(field, fallback) {
            var n = parseFloat(field.text);
            return isFinite(n) ? n : fallback;
        }

        // ---------- Path expression ----------
        // All geometry is solved on a unit circle and scaled by (rx, ry) at the end,
        // so tangent continuity is kept for ellipses as well.
        var PATH_EXPR = [
            'var rx = Math.max(0.001, effect("Radius X")("Slider"));',
            'var ry = effect("Use Ellipse")("Checkbox") == 1 ? Math.max(0.001, effect("Radius Y")("Slider")) : rx;',
            'var R = (rx + ry) / 2;',
            'var PI = Math.PI;',
            'var a0 = degreesToRadians(effect("Start Angle")("Slider"));',
            'var a1 = degreesToRadians(effect("End Angle")("Slider"));',
            'var sweep = a1 - a0;',
            'var full = Math.abs(sweep) >= 2 * PI - 0.0001;',
            'if (full) { sweep = (sweep < 0 ? -1 : 1) * 2 * PI; a1 = a0 + sweep; }',
            'var s = sweep < 0 ? -1 : 1;',
            'var sw = Math.abs(sweep);',
            '',
            '// requested radii, in unit-circle space',
            'var useRound = effect("Round Corners")("Checkbox") == 1 && !full && sw > 0.001;',
            'var rA = 0, rB = 0, rC = 0;',
            'if (useRound) {',
            '  rA = Math.max(0, effect("Corner Radius A")("Slider")) / R;',
            '  rB = Math.max(0, effect("Corner Radius B")("Slider")) / R;',
            '  rC = Math.max(0, effect("Corner Radius C")("Slider")) / R;',
            '}',
            '',
            'function rOf(d) { var sd = Math.sin(d); return sd / (1 + sd); }',
            'function dOf(r) { return Math.asin(Math.min(1, r / (1 - r))); }',
            'function sc(v, k) { return [v[0] * k, v[1] * k]; }',
            '',
            '// ---- overlap protection: priority A > C > B ----',
            'var ang = sw <= PI ? sw : 2 * PI - sw;          // opening angle at A',
            'var tanH = Math.tan(ang / 2);',
            'rA = Math.min(rA, tanH);                         // A tangent length <= 1',
            'var tA = tanH > 1e-9 ? rA / tanH : 0;            // A tangent length along both edges',
            'var dm = Math.min(sw / 2, PI / 2);',
            'var room = Math.max(0, (1 - tA * tA) / 2);       // edge length left for B / C',
            'rC = Math.min(rC, 0.5, room, rOf(dm));',
            'var dC = rC > 0 ? dOf(rC) : 0;',
            'rB = Math.min(rB, 0.5, room, rOf(Math.max(0, Math.min(dm, sw - dC))));',
            'var dB = rB > 0 ? dOf(rB) : 0;',
            '',
            'var kA = (4 / 3) * Math.tan((PI - ang) / 4) * rA;',
            'var kB = (4 / 3) * Math.tan((dB + PI / 2) / 4) * rB;',
            'var kC = (4 / 3) * Math.tan((dC + PI / 2) / 4) * rC;',
            '',
            'var verts = [], ins = [], outs = [];',
            'function add(p, i, o) {',
            '  verts.push([p[0] * rx, p[1] * ry]);',
            '  ins.push([i[0] * rx, i[1] * ry]);',
            '  outs.push([o[0] * rx, o[1] * ry]);',
            '}',
            'var Z = [0, 0];',
            'var uB = [Math.cos(a0), Math.sin(a0)];',
            'var uC = [Math.cos(a1), Math.sin(a1)];',
            'var hasB = rB > 1e-6, hasC = rC > 1e-6, hasA = tA > 1e-6;',
            '',
            '// A (start of path; its rounding closes the path)',
            'if (hasA) add(sc(uB, tA), sc(uB, -kA), Z); else add(Z, Z, Z);',
            '',
            '// B',
            'if (hasB) add(sc(uB, Math.sqrt(1 - 2 * rB)), Z, sc(uB, kB));',
            '',
            '// arc between B and C',
            'var startAng = a0 + s * dB;',
            'var endAng = a1 - s * dC;',
            'var span = endAng - startAng;',
            'var count = Math.max(1, Math.ceil(Math.abs(span) / (PI / 2) - 1e-9));',
            'var step = span / count;',
            'var h = (4 / 3) * Math.tan(step / 4);',
            'for (var i = 0; i <= count; i++) {',
            '  var a = startAng + i * step;',
            '  var p = [Math.cos(a), Math.sin(a)];',
            '  var t = [-Math.sin(a), Math.cos(a)];',
            '  var vin = sc(t, -h);',
            '  var vout = sc(t, h);',
            '  if (i === 0) vin = hasB ? sc(t, -s * kB) : Z;',
            '  if (i === count) vout = hasC ? sc(t, s * kC) : Z;',
            '  add(p, vin, vout);',
            '}',
            '',
            '// C',
            'if (hasC) add(sc(uC, Math.sqrt(1 - 2 * rC)), sc(uC, kC), Z);',
            '',
            '// A (end side)',
            'if (hasA) add(sc(uC, tA), Z, sc(uC, -kA));',
            '',
            'createPath(verts, ins, outs, true);'
        ].join("\n");

        btnCreate.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Please open or select a composition first.");
                return;
            }

            app.beginUndoGroup("Create Pie / Slice Shape");

            try {
                var layer = comp.layers.addShape();
                layer.name = "Pie Slice Shape";
                layer.notShyable = true;

                function addSlider(name, value) {
                    var parade = layer.property("ADBE Effect Parade");
                    var effect = parade.addProperty("ADBE Slider Control");
                    effect.name = name;
                    effect.property(1).setValue(value);
                }

                function addCheckbox(name, value) {
                    var parade = layer.property("ADBE Effect Parade");
                    var effect = parade.addProperty("ADBE Checkbox Control");
                    effect.name = name;
                    effect.property(1).setValue(value ? 1 : 0);
                }

                addSlider("Radius X", numberFromField(txtRadX, 200));
                addSlider("Radius Y", numberFromField(txtRadY, 200));
                addCheckbox("Use Ellipse", chkEllipse.value);
                addSlider("Start Angle", numberFromField(txtStart, 0));
                addSlider("End Angle", numberFromField(txtEnd, 90));
                addCheckbox("Round Corners", chkRound.value);
                addSlider("Corner Radius A", numberFromField(txtCornerA, 20));
                addSlider("Corner Radius B", numberFromField(txtCornerB, 20));
                addSlider("Corner Radius C", numberFromField(txtCornerC, 20));

                var root = layer.property("ADBE Root Vectors Group");
                var pieGroup = root.addProperty("ADBE Vector Group");
                pieGroup.name = "Pie Group";

                var groupContents = pieGroup.property("ADBE Vectors Group");
                groupContents.addProperty("ADBE Vector Shape - Group");

                groupContents = pieGroup.property("ADBE Vectors Group");
                groupContents.addProperty("ADBE Vector Graphic - Fill");

                // Rounding is built into the path itself (no Round Corners
                // vector filter), so each vertex can have its own radius.
                groupContents = pieGroup.property("ADBE Vectors Group");
                var pathGroup = groupContents.property("ADBE Vector Shape - Group");
                var pathProperty = pathGroup.property("ADBE Vector Shape");
                pathProperty.expression = PATH_EXPR;

                layer.selected = true;
            } catch (err) {
                alert("Could not create Pie Slice Shape:\n" + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        // --- Bottom Subtle Repository Link ---
        var grpRepoLink = panel.add("group");
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

        panel.layout.layout(true);
        panel.onResizing = panel.onResize = function () { this.layout.resize(); };
        return panel;
    }

    var scriptPanel = buildUI(thisObj);
    if (scriptPanel !== null && scriptPanel instanceof Window) {
        scriptPanel.center();
        scriptPanel.show();
    }
})(this);
