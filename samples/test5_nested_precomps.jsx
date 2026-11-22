// ==========================================
// After Effects JSX Script: Precomps & Composition Nesting Demo
// Demonstrates Main Comp -> Nested Precomp -> Inner Precomp
// ==========================================

(function() {
    var mainComp = app.project.activeItem;
    if (!mainComp) {
        mainComp = app.project.items.addComp("Main Comp", 1920, 1080, 1, 10, 30);
    }

    // Clear main comp
    while (mainComp.layers.length > 0) {
        mainComp.layers.remove(mainComp.layers[0]);
    }

    // 1. Create a Background Shape in Main Comp
    var bg = mainComp.layers.addShape();
    bg.name = "Main_Background_Plate";
    var bgGrp = bg.property("Contents").addProperty("ADBE Vector Group");
    var bgRect = bgGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
    bgRect.property("Size").setValue([1920, 1080]);
    var bgFill = bgGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    bgFill.property("Color").setValue([0.08, 0.09, 0.12]);

    // 2. Create Level-1 Precomposition: "Card Precomp"
    var cardComp = app.project.items.addComp("Card Precomp", 800, 500, 1, 10, 30);
    var cardLayer = mainComp.layers.add(cardComp);
    cardLayer.name = "Card Precomp Layer";
    cardLayer.transform.position.setValue([mainComp.width / 2, mainComp.height / 2, 0]);

    // Add elements to Card Precomp
    var cardBg = cardComp.layers.addShape();
    cardBg.name = "Card_Background";
    var cbGrp = cardBg.property("Contents").addProperty("ADBE Vector Group");
    var cbRect = cbGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
    cbRect.property("Size").setValue([760, 460]);
    cbRect.property("Roundness").setValue(24);
    var cbFill = cbGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    cbFill.property("Color").setValue([0.16, 0.20, 0.28]);

    var title = cardComp.layers.addText("Nested Precomp Title");
    title.name = "Header Text";
    title.transform.position.setValue([cardComp.width / 2, 100, 0]);

    // 3. Create Level-2 Nested Precomposition: "Badge Subcomp"
    var badgeComp = app.project.items.addComp("Badge Subcomp", 300, 80, 1, 10, 30);
    var badgeLayer = cardComp.layers.add(badgeComp);
    badgeLayer.name = "Badge Subcomp Layer";
    badgeLayer.transform.position.setValue([cardComp.width / 2, 280, 0]);

    // Add elements inside the Level-2 Badge Subcomp
    var badgeShape = badgeComp.layers.addShape();
    badgeShape.name = "Badge_Pill";
    var bpGrp = badgeShape.property("Contents").addProperty("ADBE Vector Group");
    var bpRect = bpGrp.property("Contents").addProperty("ADBE Vector Shape - Rect");
    bpRect.property("Size").setValue([280, 60]);
    bpRect.property("Roundness").setValue(30);
    var bpFill = bpGrp.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    bpFill.property("Color").setValue([0.23, 0.51, 0.96]);

    var badgeText = badgeComp.layers.addText("LEVEL 2 NESTED");
    badgeText.name = "Badge Label";
    badgeText.transform.position.setValue([badgeComp.width / 2, badgeComp.height / 2, 0]);

    if (mainComp && typeof mainComp.openInViewer === "function") {
        mainComp.openInViewer();
    }

    $.writeln("Precomp nesting demo created successfully: Main Comp -> Card Precomp -> Badge Subcomp");
})();
