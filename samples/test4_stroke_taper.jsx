// ==========================================
// After Effects Stroke Taper Showcase:
// Variable-width Tapered Vector Strokes
// ==========================================

var comp = app.project.activeItem;
while (comp.layers.length > 0) comp.layers.remove(comp.layers[0]);

var center = [comp.width / 2, comp.height / 2, 0];

// -------------------------------------------------------------
// 1. Double-ended Taper Calligraphic Flourish (Sharp tips at both ends)
// -------------------------------------------------------------
var flourishLayer = comp.layers.addShape();
flourishLayer.name = "Tapered_Flourish";
flourishLayer.threeDLayer = true;
flourishLayer.transform.position.setValue([center[0] - 420, center[1], 0]);

var fGroup = flourishLayer.property("Contents").addProperty("ADBE Vector Group");
var fPathGroup = fGroup.property("Contents").addProperty("ADBE Vector Shape - Group");
var fPathProp = fPathGroup.property("ADBE Vector Shape") || fPathGroup.property("Path") || fPathGroup;

var flourishShape = new Shape();
flourishShape.vertices = [
    [-180, 90],
    [-60, -90],
    [60, 90],
    [180, -90]
];
flourishShape.inTangents = [
    [0, 0],
    [-70, 50],
    [-70, -50],
    [-50, 50]
];
flourishShape.outTangents = [
    [50, -50],
    [70, -50],
    [70, 50],
    [0, 0]
];
flourishShape.closed = false;
fPathProp.setValue(flourishShape);

var fStroke = fGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
fStroke.property("Color").setValue([0.23, 0.83, 0.70]); // #3bd4b3
fStroke.property("Stroke Width").setValue(36);
fStroke.property("Line Cap").setValue(2); // Round Cap

// Taper properties (CC 2020+ ADBE Vector Taper)
var fTaper = fStroke.property("ADBE Vector Taper") || fStroke.property("Taper");
if (fTaper) {
    fTaper.property("Start Length").setValue(45);
    fTaper.property("End Length").setValue(45);
    fTaper.property("Start Width").setValue(0);
    fTaper.property("End Width").setValue(0);
    fTaper.property("Start Ease").setValue(25);
    fTaper.property("End Ease").setValue(25);
}

// -------------------------------------------------------------
// 2. Comet / Meteor Trail (One-ended sharp taper, round thick end)
// -------------------------------------------------------------
var cometLayer = comp.layers.addShape();
cometLayer.name = "Comet_Trail";
cometLayer.threeDLayer = true;
cometLayer.transform.position.setValue([center[0], center[1], 0]);

var cGroup = cometLayer.property("Contents").addProperty("ADBE Vector Group");
var cPathGroup = cGroup.property("Contents").addProperty("ADBE Vector Shape - Group");
var cPathProp = cPathGroup.property("ADBE Vector Shape") || cPathGroup.property("Path") || cPathGroup;

var cometShape = new Shape();
cometShape.vertices = [
    [-160, 120],
    [-50, 10],
    [60, -70],
    [160, -110]
];
cometShape.inTangents = [
    [0, 0],
    [-60, 45],
    [-55, 30],
    [-45, 15]
];
cometShape.outTangents = [
    [60, -45],
    [55, -30],
    [45, -15],
    [0, 0]
];
cometShape.closed = false;
cPathProp.setValue(cometShape);

var cStroke = cGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
cStroke.property("Color").setValue([1.0, 0.45, 0.2]); // Orange-coral
cStroke.property("Stroke Width").setValue(44);
cStroke.property("Line Cap").setValue(2); // Round Cap

var cTaper = cStroke.property("ADBE Vector Taper") || cStroke.property("Taper");
if (cTaper) {
    cTaper.property("Start Length").setValue(90);
    cTaper.property("End Length").setValue(0);
    cTaper.property("Start Width").setValue(0);
    cTaper.property("End Width").setValue(100);
    cTaper.property("Start Ease").setValue(35);
}

// -------------------------------------------------------------
// 3. Tapered Arc Wave Ribbon (Cyan-blue with partial width taper)
// -------------------------------------------------------------
var waveLayer = comp.layers.addShape();
waveLayer.name = "Wave_Ribbon";
waveLayer.threeDLayer = true;
waveLayer.transform.position.setValue([center[0] + 420, center[1], 0]);

var wGroup = waveLayer.property("Contents").addProperty("ADBE Vector Group");
var wPathGroup = wGroup.property("Contents").addProperty("ADBE Vector Shape - Group");
var wPathProp = wPathGroup.property("ADBE Vector Shape") || wPathGroup.property("Path") || wPathGroup;

var waveShape = new Shape();
waveShape.vertices = [
    [-150, 100],
    [-50, -100],
    [50, 100],
    [150, -70]
];
waveShape.inTangents = [
    [0, 0],
    [-60, -60],
    [-60, 60],
    [-50, -40]
];
waveShape.outTangents = [
    [60, 60],
    [60, -60],
    [50, 40],
    [0, 0]
];
waveShape.closed = false;
waveShape.closed = false;
wPathProp.setValue(waveShape);

var wStroke = wGroup.property("Contents").addProperty("ADBE Vector Graphic - Stroke");
wStroke.property("Color").setValue([0.2, 0.65, 1.0]); // Sky blue
wStroke.property("Stroke Width").setValue(36);
wStroke.property("Line Cap").setValue(2); // Round Cap

var wTaper = wStroke.property("ADBE Vector Taper") || wStroke.property("Taper");
if (wTaper) {
    wTaper.property("Start Length").setValue(50);
    wTaper.property("End Length").setValue(50);
    wTaper.property("Start Width").setValue(15);
    wTaper.property("End Width").setValue(15);
    wTaper.property("Start Ease").setValue(-20);
    wTaper.property("End Ease").setValue(-20);
}

$.writeln("Stroke Taper showcase created: Flourish, Comet, and Wave Ribbon!");
