// ==========================================
// After Effects ScriptUI UI Panel Tester
// ==========================================

(function(thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "AE Cube Generator", undefined, {resizeable: true});
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 14;

    // Size Group
    var pnlSize = win.add("panel", undefined, "Cube Dimensions");
    pnlSize.orientation = "column";
    pnlSize.spacing = 8;
    
    var grpRow = pnlSize.add("group");
    grpRow.orientation = "row";
    grpRow.add("statictext", undefined, "Size (px):");
    var txtSize = grpRow.add("edittext", undefined, "200");
    txtSize.characters = 5;

    var sldSize = pnlSize.add("slider", undefined, 200, {minvalue: 50, maxvalue: 500});
    sldSize.onChanging = function() {
        txtSize.text = Math.round(sldSize.value);
    };
    txtSize.onChange = function() {
        sldSize.value = parseFloat(txtSize.text) || 200;
    };

    // Animation Group
    var pnlAnim = win.add("panel", undefined, "Animation / Wiggle");
    var chkWiggle = pnlAnim.add("checkbox", undefined, "Enable 3D Wiggle");
    chkWiggle.value = true;

    var grpWiggle = pnlAnim.add("group");
    grpWiggle.add("statictext", undefined, "Wiggle Freq:");
    var txtFreq = grpWiggle.add("edittext", undefined, "0.5");
    txtFreq.characters = 4;
    grpWiggle.add("statictext", undefined, "Amp:");
    var txtAmp = grpWiggle.add("edittext", undefined, "45");
    txtAmp.characters = 4;

    // Build Button
    var btnBuild = win.add("button", undefined, "Generate Cube In Comp");
    btnBuild.onClick = function() {
        var comp = app.project.activeItem;
        if (!comp) return;

        var size = parseFloat(txtSize.text) || 200;
        var half = size / 2;
        var center = [comp.width / 2, comp.height / 2, 0];

        // Clear existing
        while (comp.layers.length > 0) comp.layers.remove(comp.layers[0]);

        var master = comp.layers.addShape();
        master.name = "Cube_Master";
        master.threeDLayer = true;
        master.transform.position.setValue(center);

        if (chkWiggle.value) {
            var f = parseFloat(txtFreq.text) || 0.5;
            var a = parseFloat(txtAmp.text) || 45;
            master.transform.yRotation.expression = "wiggle(" + f + ", " + a + ")";
            master.transform.xRotation.expression = "wiggle(" + (f * 0.7) + ", " + (a * 0.6) + ")";
        }

        var faces = [
            { name: "Front",  pos: [0, 0, -half], rot: [0, 0, 0],   color: [0.9, 0.2, 0.3] },
            { name: "Back",   pos: [0, 0, half],  rot: [0, 180, 0], color: [0.2, 0.8, 0.4] },
            { name: "Left",   pos: [-half, 0, 0], rot: [0, -90, 0], color: [0.3, 0.5, 0.9] },
            { name: "Right",  pos: [half, 0, 0],  rot: [0, 90, 0],  color: [0.9, 0.8, 0.2] },
            { name: "Top",    pos: [0, -half, 0], rot: [90, 0, 0],  color: [0.8, 0.3, 0.8] },
            { name: "Bottom", pos: [0, half, 0],  rot: [-90, 0, 0], color: [0.2, 0.8, 0.8] }
        ];

        for (var i = 0; i < faces.length; i++) {
            var f = faces[i];
            var layer = comp.layers.addShape();
            layer.name = "Face_" + f.name;
            layer.threeDLayer = true;

            var group = layer.property("Contents").addProperty("ADBE Vector Group");
            var rect = group.property("Contents").addProperty("ADBE Vector Shape - Rect");
            rect.property("Size").setValue([size, size]);
            rect.property("Roundness").setValue(10);

            var fill = group.property("Contents").addProperty("ADBE Vector Graphic - Fill");
            fill.property("Color").setValue(f.color);
            fill.property("Opacity").setValue(80);

            var stroke = group.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
            stroke.property("Color").setValue([1, 1, 1]);
            stroke.property("Stroke Width").setValue(2);

            layer.transform.position.setValue(f.pos);
            layer.transform.orientation.setValue(f.rot);
            layer.parent = master;
        }

        $.writeln("Generated Cube with size: " + size + "px!");
    };

    if (win instanceof Window) {
        win.show();
    }
    return win;
})(this);
