# After Effects JS & ScriptUI Simulator (3D / 2D)

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2c8cff?style=for-the-badge&logo=github)](https://work2survive.github.io/AE_JS_builder/)
[![Built with Antigravity](https://img.shields.io/badge/Built%20With-Antigravity-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/)

**Live Browser Simulator**: [https://work2survive.github.io/AE_JS_builder/](https://work2survive.github.io/AE_JS_builder/)

An agnostic, browser-based runtime that emulates Adobe After Effects 2D/3D layers, shape vector contents (rectangles, ellipses, Bézier paths), property hierarchy, wiggle expressions, camera navigation, and ScriptUI UI panels.

Built to accelerate After Effects script and panel development (`.jsx`) without needing to launch or restart After Effects.

---

## Features

### 1. 3D & 2D Layer System with AE Transform Mathematics
- **3D Transform Pipeline**: Emulates AE's exact coordinate system and rotation order:
  1. Negative Anchor Point offset
  2. Scale percentage (`100% = 1.0`)
  3. Orientation (`Z`, `Y`, `X` Euler angles)
  4. Individual 3-axis rotation (`X`, `Y`, `Z Rotation`)
  5. Position translation (`X`, `Y`, `Z`)
  6. Hierarchical parenting chains (`layer.parent = master`)
- **2D & 3D Switching**: Toggle 3D Layer switch on any layer in real time.

### 2. Shape Layers & Vector Contents
Supports the core AE vector shapes:
- **Rectangles** (`ADBE Vector Shape - Rect`): `Size [w, h]`, `Position [x, y]`, `Roundness`
- **Ellipses / Circles** (`ADBE Vector Shape - Ellipse`): `Size [w, h]`, `Position [x, y]`
- **Bézier Paths** (`ADBE Vector Shape - Path`): Full `new Shape()` object with `vertices`, `inTangents`, `outTangents`, and `closed`
- **Fills & Strokes**: RGB color, opacity, and stroke width

### 3. Interactive 3D Camera Controls
- **Orbit Camera**: Left-click and drag anywhere on the composition viewport to rotate around the Point of Interest in 3D (`Custom View 1`).
- **Two-Stage Zoom Architecture**:
  - **Dolly Distance Guard**: Preserves natural 3D depth down to a safe minimum distance ($900\text{ px}$) so geometry never hits the CSS 3D near-plane singularity.
  - **Canvas Magnification Zoom**: Seamlessly transitions to 2D canvas magnification (up to $1000\%$) for ultra-close inspection without perspective distortion or stretched polygons.
- **Pan Camera**: Middle-click or `Alt + Left-click` drag to truck/pedestal.
- **Camera Views**: Quick presets for `Active Camera`, `Front`, `Top`, `Right`, `Custom View 1`, and `Reset Cam`.

### 4. Live Wiggle Expression Engine
- Native `wiggle(freq, amp)` expression support.
- Runs on a real-time `requestAnimationFrame` loop at 60 fps.
- Click the stopwatch on any property in the timeline to add, customize, or disable wiggle expressions on the fly.

### 5. Shy Switch (UI Focus Mode)
- **Global Shy Switch**: Located in the timeline switches header. **Active by default**.
- **Hides Unrelated Properties & Layers**: When active, shies secondary/child layers and unedited boilerplate properties (such as default anchor points, unedited opacities, and unused transforms) to keep the timeline focused strictly on the properties and effects controlled by your `.jsx` UI panel.
- **Reveal All**: Click the **`Shy (UI Focus)`** button in the header or the banner link to toggle Shy mode OFF and inspect all comp layers and properties in full detail.
- **Layer Shy Switches**: Each layer row features its own Shy switch icon matching After Effects.

### 6. Global Expression Switch & Sequential Evaluation Switch
- **Global Expressions Switch**: Located in the timeline switches header (`[=] Expressions: Shown/Hidden`). Click to hide/show expression formulas and badges.
- **Sequential Evaluation Mode Switch**: A compact, single-button switch on each animatable property row designed with a **2:1 aspect ratio** ($28\times 14\text{ px}$) that cycles sequentially through evaluation states on click. The capital letter is positioned on the left side alongside a status toggle indicator on the right:
  - **Standard Properties (Position, Scale, Rotation, Dimensions, Sliders)**:
    - 🟩 **`[R]` Rand (Green)**: Jitters and randomizes dynamic values with high-frequency noise.
    - 🟨 **`[W]` Wiggle (Gold)**: Smooth, harmonic After Effects continuous sine wiggle.
    - 🟥 **`[S]` Stop (Red)**: Freezes/stops the animation at its current evaluated value.
    - ⬜ **`[B]` Base (Slate Gray)**: Resets to the original static base value defined in the script without animation.
  - **Color Properties & Effects (Color Controls, Fill Colors, Stroke Colors)**:
    - 🟦 **`[O]` Original (Blue)**: Resets to original color from the UI panel.
    - 🟪 **`[R]` Random (Pink)**: Generates a fixed vibrant random color.
    - 🌈 **`[C]` Circle RGB (Rainbow)**: Continuously cycles through the full RGB color wheel (360° hue loop).
    - 🟨 **`[W]` Wiggle (Gold)**: Smooth harmonic color shifts on RGB channels.
    - 🟪 **`[H]` 50% Opacity (Purple / Semi-Transparent Grid)**: Sets opacity to 50% semi-transparent.
    - ⬛ **`[T]` Transparent (Dark Checkerboard)**: Sets opacity to 0% (100% transparent / hidden).
  - *Click to cycle sequentially forward. Right-click (`contextmenu`) to cycle in reverse.*

### 7. Dual Classification Color Coding (Timeline vs .JSX UI)
- **In the AE Timeline**:
  - 🔵 **Shade of Blue** (`[ANIM]`): Properties animatable in the AE timeline (Position, Scale, Rotation, Opacity, Effects, Dimensions, Colors, Stroke Width).
  - 🔴 **Shade of Red** (`[STATIC]`): Properties defined once in setup that cannot be animated (Parent links, 3D switch, Layer Name, Shape Group hierarchy).
- **In the Sample .JSX UI Panel (Cube Maker)**:
  - 🟡 **Yellow**: All parameters animatable in the timeline (Dimensions X/Y/Z, Link to Z, Colors, Stroke Width, Wiggle toggle).
  - 🔴 **Red**: All parameters defined once in script setup (Cube Structure, 3D Topology, Build/Reset button).
  - A visual legend is displayed at the top of the ScriptUI window.

### 8. Open & Test .JSX Files Directly
- **File Dialog**: Click the **`📂 Upload .JSX`** button in the top bar to open any `.jsx` or `.js` file from your disk.
- **Load from Web URL**: Click **`🌐 Load from URL`** to load any raw `.jsx` script directly from GitHub or any web host.
- **Drag & Drop**: Drag `.jsx` files directly from your file manager into the code editor panel.
- **Auto-Execution**: The loaded script is automatically loaded into the editor and executed in the 3D comp, displaying real-time console output in the drawer.
- **Auto Build Switch (`&autobuild=true`)**: A topbar toggle switch located immediately after the **Run Script** button. When active, it automatically appends `&autobuild=true` to the URL and automatically triggers the script's primary build/create button upon execution (e.g., *Build / Rebuild Extruded Rectangle*, *Build / Rebuild 3D Cube*, *Create Pie Slice Shape Layer*), generating geometry instantly without needing to press the button manually. When loading a URL containing `autobuild=true`, the switch is automatically enabled.
- **Deep Linking & URL Routing**: The active script name is automatically synchronized with the URL (e.g., `?jsx=cylinder_maker.jsx&autobuild=true` or `?jsx=extruded_round_rectangle.jsx&autobuild=true`). Loading a link with a `?jsx=` parameter auto-detects and runs that tool immediately. Pressing the **Clear** button removes the URL parameter and resets the stage.
- Comes with a sample test script: [`test_script.jsx`](file:///g:/My%20Drive/_openProjects/My_AE_assets/AE_JS_builder/test_script.jsx).

### 9. ScriptUI Panel & Dialog Emulator
- Emulates Adobe ExtendScript `Window`, `Panel`, `Group`, `Button`, `StaticText`, `EditText`, `Slider`, `Checkbox`, `RadioButton`, `DropDownList`, and `ProgressBar`.
- Supports layout orientation (`row` / `column`), alignment, margins, spacing, and event callbacks (`onClick`, `onChange`, `onChanging`).
- **Standardized ScriptUI Slider API**: Supports both native ExtendScript positional signature `container.add("slider", undefined, initial, min, max)` and object options signature `{ minvalue, maxvalue }` across AE CS6–2026+.
- **Windows Color Picker (ChooseColor) Emulation**: Faithful dialog emulation with 48 basic color swatches, 16 custom slots (persisted in localStorage), 2D HSL Spectrum box with crosshair cursor, vertical Luminance bar with pointer arrow, live preview box, and bidirectional Hue/Sat/Lum (0-240), Red/Green/Blue (0-255), and Hex (#RRGGBB) numeric inputs.
- **Color Swatch + Hex Rule**: Standardized interactive rectangular sample swatches positioned immediately adjacent to hex text boxes across all JSX panels, providing 100% visual and interactive parity between Adobe After Effects ScriptUI and the Web Emulator.
- Switch to the **ScriptUI Panel Preview** tab to interact directly with your UI controls and see them modify the composition live.

### 10. Built-in Test Presets & Parametric Generators

The emulator includes production-ready After Effects ScriptUI tools as well as quick verification presets:

#### A. Production ScriptUI Add-ons (`jsx/` Folder)

The simulator includes standalone production-ready After Effects ScriptUI tools located in [`jsx/`](jsx/). Each tool is maintained in its own dedicated repository with complete documentation, installation guides, and full source code:

1. **[Cube Maker 3D](https://github.com/work2survive/AE-Cube-Maker-3D)** (`jsx/cube_maker.jsx` - v1.3):
   - Parametric 3D cube generator with independent face colors, opacity, stroke controls, and collapsed-transformation master rigging.
   - **Repository**: [work2survive/AE-Cube-Maker-3D](https://github.com/work2survive/AE-Cube-Maker-3D)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=cube_maker.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=cube_maker.jsx&autobuild=true)

2. **[Cylinder Maker 3D](https://github.com/work2survive/AE-Cylinder-Maker-3D)** (`jsx/cylinder_maker.jsx` - v1.4):
   - Parametric 3D cylinder and circular slice sector generator with auto-rigged wall facets, tri-color palette, and inner cap seams protection.
   - **Repository**: [work2survive/AE-Cylinder-Maker-3D](https://github.com/work2survive/AE-Cylinder-Maker-3D)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=cylinder_maker.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=cylinder_maker.jsx&autobuild=true)

3. **[Pie / Slice Generator](https://github.com/work2survive/AE-Pie-Slice-Tool)** (`jsx/Pie_Slice_Generator.jsx` - v4.1):
   - Expression-driven parametric circular and elliptical pie slices, arcs, and wedges with independent 3-corner rounding and overlap collision protection.
   - **Repository**: [work2survive/AE-Pie-Slice-Tool](https://github.com/work2survive/AE-Pie-Slice-Tool)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=Pie_Slice_Generator.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=Pie_Slice_Generator.jsx&autobuild=true)

4. **[Custom Rounded Rect](https://github.com/work2survive/AE_Custom_Rounded_Rect)** (`jsx/custom_rounded_rect.jsx` - v1.1):
   - Native 2D shape layer generator with 4 independent corner radii, quick presets, and W3C CSS Backgrounds & Borders Level 3 proportional overlap protection.
   - **Repository**: [work2survive/AE_Custom_Rounded_Rect](https://github.com/work2survive/AE_Custom_Rounded_Rect)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=custom_rounded_rect.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=custom_rounded_rect.jsx&autobuild=true)

5. **[Extruded Round Rectangle 3D](https://github.com/work2survive/AE_Extruded_Round_corners)** (`jsx/extruded_round_rectangle.jsx` - v1.3):
   - Parametric 3D extruded rounded rectangle with faceted corner walls, tri-color palette, airtight inner caps, and master rigging.
   - **Repository**: [work2survive/AE_Extruded_Round_corners](https://github.com/work2survive/AE_Extruded_Round_corners)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=extruded_round_rectangle.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=extruded_round_rectangle.jsx&autobuild=true)

6. **[Message Bubble Generator](https://github.com/work2survive/AE_message_bubble)** (`jsx/message_bubble.jsx` - v1.0):
   - Authentic 2D vector chat bubble generator imitating iOS Messages, Android RCS, WhatsApp, Instagram, Messenger, and Custom themes with auto-timing receipts and iOS 18 text animations.
   - **Repository**: [work2survive/AE_message_bubble](https://github.com/work2survive/AE_message_bubble)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=message_bubble.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=message_bubble.jsx&autobuild=true)

#### B. Quick Verification Presets

7. **Test 1: 3D Cube (200x200px) with Wiggle**:
   - Baseline 6-face cube demonstration with active `wiggle()` expressions on position, rotation, and dimensions.
8. **Test 2: ScriptUI Cube Builder Panel**:
   - Baseline ScriptUI window demonstration showing button callbacks, edit texts, and layer hierarchy creation.
9. **Test 3: Squares, Circles & Bézier Paths**:
   - 2D vector primitives demonstration showing rounded rectangles, circle shapes, and 5-point Bézier star paths with curved control tangents.

---

## How to Run

### Option 1: Direct File Open
Simply double-click `index.html` or drag it into any modern web browser (Chrome, Edge, Firefox, Safari). There are no external dependencies or build steps required.

### Option 2: Local Server
Run `run_server.bat` or run:
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000`.

---

## 🔗 Related Standalone Repositories

The production tools built and tested inside this simulator are also available as dedicated, standalone After Effects plugins and ScriptUI panels:

- **[AE Cube Maker 3D](https://github.com/work2survive/AE-Cube-Maker-3D)**: Parametric 3D cube generator with independent face colors, opacity, stroke controls, and collapsed-transformation master rigging (v1.3).
- **[AE Cylinder Maker 3D](https://github.com/work2survive/AE-Cylinder-Maker-3D)**: Parametric 3D cylinder and circular slice sector generator with auto-rigged wall facets, tri-color palette, and inner cap seams protection (v1.4).
- **[AE Pie Slice Tool](https://github.com/work2survive/AE-Pie-Slice-Tool)**: Parametric circular sectors, arcs, and pie slices with corner rounding and collision protection (v4.1).
- **[AE_Custom_Rounded_Rect](https://github.com/work2survive/AE_Custom_Rounded_Rect)**: Independent 4-corner parametric rounded rectangle generator with W3C CSS proportional overlap protection (v1.1).
- **[AE_Extruded_Round_corners](https://github.com/work2survive/AE_Extruded_Round_corners)**: Parametric 3D extruded rounded rectangle with faceted corner walls, tri-color palette, airtight inner caps, and master rigging (v1.3 / v2.0).
- **[AE Message Bubble Generator](https://github.com/work2survive/AE_message_bubble)**: Authentic chat and text message bubble generator for iOS, Android RCS, WhatsApp, Instagram, Messenger, and Custom themes (v1.0).

---

## 🤖 Acknowledgments

Engineered, architected, and co-developed using **[Google DeepMind Antigravity](https://deepmind.google/)** agentic coding assistant.
