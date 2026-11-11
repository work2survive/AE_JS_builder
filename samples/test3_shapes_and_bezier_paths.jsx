// ==========================================
// After Effects Shapes Showcase:
// Squares, Circles, and Custom Bézier Paths
// ==========================================

var comp = app.project.activeItem;
while (comp.layers.length > 0) comp.layers.remove(comp.layers[0]);

var center = [comp.width / 2, comp.height / 2, 0];

// 1. Rounded Square Layer
var sqLayer = comp.layers.addShape();
sqLayer.name = "Square_Shape";
sqLayer.threeDLayer = true;
sqLayer.transform.position.setValue([center[0] - 250, center[1], 0]);
sqLayer.transform.zRotation.expression = "wiggle(0.5, 40)";

var sqGroup = sqLayer.property("Contents").addProperty("ADBE Vector Group");
var rect = sqGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
rect.property("Size").setValue([180, 180]);
rect.property("Roundness").setValue(24);

var sqFill = sqGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
sqFill.property("Color").setValue([0.9, 0.4, 0.1]);
var sqStroke = sqGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
sqStroke.property("Color").setValue([1, 1, 1]);
sqStroke.property("Stroke Width").setValue(3);

// 2. Circle / Ellipse Layer
var circleLayer = comp.layers.addShape();
circleLayer.name = "Circle_Shape";
circleLayer.threeDLayer = true;
circleLayer.transform.position.setValue([center[0], center[1], 0]);
circleLayer.transform.position.expression = "wiggle(0.8, 30)";

var cGroup = circleLayer.property("Contents").addProperty("ADBE Vector Group");
var ellipse = cGroup.property("Contents").addProperty("ADBE Vector Shape - Ellipse");
ellipse.property("Size").setValue([180, 180]);

var cFill = cGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
cFill.property("Color").setValue([0.15, 0.65, 0.95]);
var cStroke = cGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
cStroke.property("Color").setValue([1, 1, 1]);
cStroke.property("Stroke Width").setValue(3);

// 3. Custom Bézier Star Path Layer
var starLayer = comp.layers.addShape();
starLayer.name = "Star_Path_Shape";
starLayer.threeDLayer = true;
starLayer.transform.position.setValue([center[0] + 250, center[1], 0]);
starLayer.transform.yRotation.expression = "wiggle(0.5, 60)";

var starGroup = starLayer.property("Contents").addProperty("ADBE Vector Group");
var pathProp = starGroup.property("Contents").addProperty("ADBE Vector Shape - Path");

// Construct 5-point star path
var star = new Shape();
var points = 5;
var rOuter = 100;
var rInner = 45;
star.vertices = [];
star.inTangents = [];
star.outTangents = [];

for (var i = 0; i < points * 2; i++) {
    var angle = (i * Math.PI) / points - Math.PI / 2;
    var r = (i % 2 === 0) ? rOuter : rInner;
    var x = Math.cos(angle) * r;
    var y = Math.sin(angle) * r;
    star.vertices.push([x, y]);
    // Smooth tangents on outer points
    if (i % 2 === 0) {
        star.inTangents.push([-Math.sin(angle) * 12, Math.cos(angle) * 12]);
        star.outTangents.push([Math.sin(angle) * 12, -Math.cos(angle) * 12]);
    } else {
        star.inTangents.push([0, 0]);
        star.outTangents.push([0, 0]);
    }
}
star.closed = true;
pathProp.property("Path").setValue(star);

var starFill = starGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
starFill.property("Color").setValue([0.9, 0.8, 0.2]);
var starStroke = starGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
starStroke.property("Color").setValue([1, 1, 1]);
starStroke.property("Stroke Width").setValue(3);

$.writeln("Shapes showcase created: Square, Circle, and Bézier Star!");
