// ==========================================
// After Effects JSX Script: 200x200 3D Cube
// Built with 6 Shape Layers & Master Controller
// ==========================================

var comp = app.project.activeItem;
if (!comp) {
    comp = app.project.items.addComp("Cube Comp", 1280, 720, 1, 10, 30);
}

// Clear any existing layers
while (comp.layers.length > 0) {
    comp.layers.remove(comp.layers[0]);
}

var size = 200;
var half = size / 2;
var center = [comp.width / 2, comp.height / 2, 0];

$.writeln("Creating 200x200 px 3D Cube at comp center: " + center.join(", "));

// 1. Create Master Controller Layer
var master = comp.layers.addShape();
master.name = "Cube_Master_Controller";
master.threeDLayer = true;
master.shy = false;
master.transform.position.setValue(center);

// Apply AE wiggle expressions on rotations
master.transform.yRotation.expression = "wiggle(0.4, 45)";
master.transform.xRotation.expression = "wiggle(0.3, 30)";
master.transform.zRotation.expression = "wiggle(0.2, 15)";

// 2. Define 6 Faces of the 3D Cube
var faces = [
    { name: "Face_Front",  pos: [0, 0, -half], rot: [0, 0, 0],     color: [0.95, 0.25, 0.30] }, // Red
    { name: "Face_Back",   pos: [0, 0, half],  rot: [0, 180, 0],   color: [0.20, 0.85, 0.40] }, // Green
    { name: "Face_Left",   pos: [-half, 0, 0], rot: [0, -90, 0],   color: [0.25, 0.50, 0.95] }, // Blue
    { name: "Face_Right",  pos: [half, 0, 0],  rot: [0, 90, 0],    color: [0.95, 0.80, 0.20] }, // Yellow
    { name: "Face_Top",    pos: [0, -half, 0], rot: [90, 0, 0],    color: [0.85, 0.30, 0.90] }, // Magenta
    { name: "Face_Bottom", pos: [0, half, 0],  rot: [-90, 0, 0],   color: [0.20, 0.90, 0.90] }  // Cyan
];

for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    var faceLayer = comp.layers.addShape();
    faceLayer.name = f.name;
    faceLayer.threeDLayer = true;
    faceLayer.shy = true;

    // Vector Contents: Group -> Rect + Fill + Stroke
    var contents = faceLayer.property("Contents");
    var group = contents.addProperty("ADBE Vector Group");
    group.name = "Face Shape";

    var rect = group.property("Contents").addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([size, size]);
    rect.property("Position").setValue([0, 0]);
    rect.property("Roundness").setValue(12); // Slightly rounded edges

    var fill = group.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    fill.property("Color").setValue(f.color);
    fill.property("Opacity").setValue(85); // Semi-transparent for 3D visibility

    var stroke = group.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("Color").setValue([1, 1, 1]);
    stroke.property("Stroke Width").setValue(3);
    stroke.property("Opacity").setValue(100);

    // Transform setup: Since parent = master, position is relative to master!
    faceLayer.transform.position.setValue(f.pos);
    faceLayer.transform.orientation.setValue(f.rot);

    // Parent to Master Controller
    faceLayer.parent = master;
}

$.writeln("3D Cube successfully generated! Rotate camera with mouse drag, zoom with wheel.");
