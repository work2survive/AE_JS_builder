// ==========================================
// Sample External After Effects Script (.jsx)
// Test opening and executing via Open Dialog
// ==========================================

(function() {
    var comp = app.project.activeItem;
    if (!comp) {
        comp = app.project.items.addComp("Test JSX Comp", 1280, 720, 1, 10, 30);
    }

    // Clear comp
    while (comp.layers.length > 0) {
        comp.layers.remove(comp.layers[0]);
    }

    var center = [comp.width / 2, comp.height / 2, 0];
    $.writeln("Executing external .jsx script!");

    // 1. Create a 3D Rotating Ring / Circle
    var ring = comp.layers.addShape();
    ring.name = "Outer_3D_Ring";
    ring.threeDLayer = true;
    ring.transform.position.setValue(center);
    ring.transform.yRotation.expression = "wiggle(0.6, 50)";
    ring.transform.xRotation.expression = "wiggle(0.4, 30)";

    var ringGroup = ring.property("Contents").addProperty("ADBE Vector Group");
    var ellipse = ringGroup.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("Size").setValue([320, 320]);

    var ringStroke = ringGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    ringStroke.property("Color").setValue([0.2, 0.7, 1.0]);
    ringStroke.property("Stroke Width").setValue(6);

    // 2. Create a 3D Golden Star at Center
    var starLayer = comp.layers.addShape();
    starLayer.name = "Center_3D_Star";
    starLayer.threeDLayer = true;
    starLayer.transform.position.setValue(center);
    starLayer.transform.zRotation.expression = "wiggle(0.5, 90)";
    starLayer.parent = ring; // Parented to the ring!

    var starGroup = starLayer.property("Contents").addProperty("ADBE Vector Group");
    var pathProp = starGroup.property("Contents").addProperty("ADBE Vector Shape - Path");

    var star = new Shape();
    var points = 5;
    var rOuter = 80;
    var rInner = 35;
    star.vertices = [];
    star.inTangents = [];
    star.outTangents = [];

    for (var i = 0; i < points * 2; i++) {
        var angle = (i * Math.PI) / points - Math.PI / 2;
        var r = (i % 2 === 0) ? rOuter : rInner;
        star.vertices.push([Math.cos(angle) * r, Math.sin(angle) * r]);
        star.inTangents.push([0, 0]);
        star.outTangents.push([0, 0]);
    }
    star.closed = true;
    pathProp.property("Path").setValue(star);

    var starFill = starGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    starFill.property("Color").setValue([1.0, 0.8, 0.1]);

    var starStroke = starGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    starStroke.property("Color").setValue([1, 1, 1]);
    starStroke.property("Stroke Width").setValue(2);

    $.writeln("Success: External .jsx script loaded and executed!");
})();
