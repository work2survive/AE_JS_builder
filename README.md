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
- **Fills & Gradients**: Solid flat RGB, opacity, linear gradients (`ADBE Vector Graphic - G-Fill`), and radial gradients
- **Strokes & Dashes**: Solid, dashed, dotted pearls, line caps (Butt, Round, Square), line joins (Miter, Round, Bevel), and miter limits

### 3. Variable-Width Stroke Taper Engine (`ADBE Vector Taper`)
Full procedural emulation of Adobe After Effects' native Stroke Taper feature (`ADBE Vector Taper`):
- **ExtendScript DOM Parity**: Complete property group support on both standard strokes (`ADBE Vector Graphic - Stroke`) and gradient strokes (`ADBE Vector Graphic - G-Stroke`):
  - **Start Length** (`ADBE Vector Taper Start Length`): `0%` to `100%` (or pixels)
  - **End Length** (`ADBE Vector Taper End Length`): `0%` to `100%` (or pixels)
  - **Start Width** (`ADBE Vector Taper Start Width`): `0%` to `100%` (percentage of base stroke width)
  - **End Width** (`ADBE Vector Taper End Width`): `0%` to `100%`
  - **Start Ease** & **End Ease** (`ADBE Vector Taper Start/End Ease`): `-100%` to `+100%` curvature easing
  - **Length Units** (`ADBE Vector Taper Length Units`): `1` (Percentage), `2` (Pixels)
- **High-Fidelity Procedural Geometry**: Evaluates analytical Bézier curve derivatives to compute continuous normal vectors, offset boundary envelopes ($\mathbf{P}_L, \mathbf{P}_R$), and proportional length scaling ($L_s + L_e > L$).
- **Terminal Caps**: Seamlessly transitions into needle-sharp points ($0\%$ width), semicircular round caps, butt caps, or projecting square caps.
- **Universal Shape Support**: Works seamlessly across custom Bézier paths, rectangles, ellipses, and star/polygonal shapes.
- **Timeline & Live Scrubbing**: Twirlable `Taper` group under each stroke row in the timeline with animatable badges and interactive drag-scrub controls.

### 4. Interactive 3D Camera Controls
- **Orbit Camera**: Left-click and drag anywhere on the composition viewport to rotate around the Point of Interest in 3D (`Custom View 1`).
- **Two-Stage Zoom Architecture**:
  - **Dolly Distance Guard**: Preserves natural 3D depth down to a safe minimum distance ($900\text{ px}$) so geometry never hits the CSS 3D near-plane singularity.
  - **Canvas Magnification Zoom**: Seamlessly transitions to 2D canvas magnification (up to $1000\%$) for ultra-close inspection without perspective distortion or stretched polygons.
- **Pan Camera**: Right-click drag, middle-click, or `Alt + Left-click` drag to truck/pedestal.
- **Camera Views**: Quick presets for `Active Camera`, `Front`, `Top`, `Right`, `Custom View 1`, and `Reset Cam`.
- **Composition Resolution Dropdown**: Direct header dropdown to toggle resolutions (`720p`, `1080p` default, `1440p`, `4k`).

### 5. Live Wiggle Expression Engine
- Native `wiggle(freq, amp)` expression support.
- Runs on a real-time `requestAnimationFrame` loop at 60 fps.
- Click the stopwatch on any property in the timeline to add, customize, or disable wiggle expressions on the fly.

### 6. Shy Switch (UI Focus Mode)
- **Global Shy Switch**: Located in the timeline switches header. **Active by default**.
- **Hides Unrelated Properties & Layers**: When active, shies secondary/child layers and unedited boilerplate properties (such as default anchor points, unedited opacities, and unused transforms) to keep the timeline focused strictly on the properties and effects controlled by your `.jsx` UI panel.
- **Reveal All**: Click the **`Shy (UI Focus)`** button in the header or the banner link to toggle Shy mode OFF and inspect all comp layers and properties in full detail.
- **Layer Shy Switches**: Each layer row features its own Shy switch icon matching After Effects.

### 7. Global Expression Switch & Sequential Evaluation Switch
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

### 8. Dual Classification Color Coding (Timeline vs .JSX UI)
- **In the AE Timeline**:
  - 🔵 **Shade of Blue** (`[ANIM]`): Properties animatable in the AE timeline (Position, Scale, Rotation, Opacity, Effects, Dimensions, Colors, Stroke Width).
  - 🔴 **Shade of Red** (`[STATIC]`): Properties defined once in setup that cannot be animated (Parent links, 3D switch, Layer Name, Shape Group hierarchy).
- **In the Sample .JSX UI Panel (Cube Maker)**:
  - 🟡 **Yellow**: All parameters animatable in the timeline (Dimensions X/Y/Z, Link to Z, Colors, Stroke Width, Wiggle toggle).
  - 🔴 **Red**: All parameters defined once in script setup (Cube Structure, 3D Topology, Build/Reset button).
  - A visual legend is displayed at the top of the ScriptUI window.

### 9. Open & Test .JSX Files Directly
- **File Dialog**: Click the **`📂 Upload .JSX`** button in the top bar to open any `.jsx` or `.js` file from your disk.
- **Load from Web URL**: Click **`🌐 Load from URL`** to load any raw `.jsx` script directly from GitHub or any web host.
- **Drag & Drop**: Drag `.jsx` files directly from your file manager into the code editor panel.
- **Auto-Execution**: The loaded script is automatically loaded into the editor and executed in the 3D comp, displaying real-time console output in the drawer.
- **Auto Build Switch (`&autobuild=true`)**: A topbar toggle switch located immediately after the **Run Script** button. When active, it automatically appends `&autobuild=true` to the URL and automatically triggers the script's primary build/create button upon execution (e.g., *Build / Rebuild Extruded Rectangle*, *Build / Rebuild 3D Cube*, *Create Pie Slice Shape Layer*), generating geometry instantly without needing to press the button manually. When loading a URL containing `autobuild=true`, the switch is automatically enabled.
- **Deep Linking & External URL Loading**: The simulator supports loading both local scripts and arbitrary external `.jsx` scripts via full web URLs:
  - **Local Scripts**: `https://work2survive.github.io/AE_JS_builder/?jsx=cube_maker.jsx&autobuild=true`
  - **External Scripts (Whole URL)**: `https://work2survive.github.io/AE_JS_builder/?jsx=https://github.com/work2survive/AE-Cube-Maker-3D/blob/main/cube_maker.jsx&autobuild=true`
  - **Auto-Conversion & Protocol Handling**: Automatically detects and converts GitHub raw links (`raw.githubusercontent.com`), GitHub blob links (`github.com/.../blob/...`), raw/branch paths, and Gists into direct raw scripts with CORS headers.
  - Automatically fetches the code, populates the editor and preset dropdown, renders the ScriptUI panel, and triggers `&autobuild=true` immediately upon arrival. Pressing the **Clear** button resets the stage and cleans URL parameters.
- **External Repository Sandbox & 30-Minute Temporary File Isolation**:
  - Scripts loaded from external repositories (excluding `work2survive.github`) are automatically sandboxed in a scoped temporary folder (`/tmp/temp_external_<hash>/`).
  - Any files or folders created by third-party scripts via ExtendScript `File` and `Folder` (`Folder.userData`, `Folder.myDocuments`, `Folder.current`, `new File(...)`, `file.write(...)`) work exclusively inside this isolated temporary folder.
  - All files created by external scripts are marked as temporary with a 30-minute Time-To-Live (TTL) and are automatically deleted upon expiration.
- Comes with a sample test script: [`test_script.jsx`](file:///g:/My%20Drive/_openProjects/My_AE_assets/AE_JS_builder/test_script.jsx).

### 10. ScriptUI Panel & Dialog Emulator
- Emulates Adobe ExtendScript `Window`, `Panel`, `Group`, `Button`, `StaticText`, `EditText`, `Slider`, `Checkbox`, `RadioButton`, `DropDownList`, and `ProgressBar`.
- Supports layout orientation (`row` / `column`), alignment, margins, spacing, and event callbacks (`onClick`, `onChange`, `onChanging`).
- **Standardized ScriptUI Slider API**: Supports both native ExtendScript positional signature `container.add("slider", undefined, initial, min, max)` and object options signature `{ minvalue, maxvalue }` across AE CS6–2026+.
- **Windows Color Picker (ChooseColor) Emulation**: Faithful dialog emulation with 48 basic color swatches, 16 custom slots (persisted in localStorage), 2D HSL Spectrum box with crosshair cursor, vertical Luminance bar with pointer arrow, live preview box, and bidirectional Hue/Sat/Lum (0-240), Red/Green/Blue (0-255), and Hex (#RRGGBB) numeric inputs.
- **Color Swatch + Hex Rule**: Standardized interactive rectangular sample swatches positioned immediately adjacent to hex text boxes across all JSX panels, providing 100% visual and interactive parity between Adobe After Effects ScriptUI and the Web Emulator.
- Switch to the **ScriptUI Panel Preview** tab to interact directly with your UI controls and see them modify the composition live.

### 11. Detected Production ScriptUI Tools (`jsx/` Folder)

The simulator automatically detects and loads standalone production-ready After Effects ScriptUI tools located in [`jsx/`](jsx/). Each tool is maintained in its own dedicated repository with complete documentation, installation guides, and full source code:

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

7. **[AE WindBox](https://github.com/work2survive/AE_windBox)** (`jsx/AE_WindBox_Panel.jsx` - v1.0):
   - Procedural 3D wind volume particle system with animatable 3D Cube bounding box based on `AE-Cube-Maker-3D` architecture, 3-axis positional/rotational turbulence, seamless spatial wrapping, and live color controls.
   - **Repository**: [work2survive/AE_windBox](https://github.com/work2survive/AE_windBox)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=AE_WindBox_Panel.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=AE_WindBox_Panel.jsx&autobuild=true)

8. **[AE Spiral Maker](https://github.com/work2survive/AE_spiral_maker)** (`jsx/AE_Spiral_Maker.jsx` - v1.0):
   - Procedural vector spiral generator inspired by `tiny-online.tools/svg-tools/svg-spiral-generator`, featuring 5 mathematical spiral algorithms (Archimedean, Logarithmic, Golden Spiral, Fermat, Hyperbolic), native After Effects Stroke Taper integration for independent start and end stroke thicknesses, analytical cubic Bézier derivative tangents, and 8 factory presets.
   - **Repository**: [work2survive/AE_spiral_maker](https://github.com/work2survive/AE_spiral_maker)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=AE_Spiral_Maker.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Spiral_Maker.jsx&autobuild=true)

9. **[Scripted Chat Generator](https://github.com/work2survive/AE_scripted_Chat)** (`jsx/Scripted_Chat_Generator.jsx` - v1.0):
   - Automated messenger conversation generator loading JSON conversation scripts from `conversation/` subfolder across iOS Messages, Android RCS, WhatsApp, Messenger, and Custom themes. Features reading-speed-based scheduling, responsive dynamic bubble layouts, message delivery/read status badges, and synchronized precomposition rigging.
   - **Repository**: [work2survive/AE_scripted_Chat](https://github.com/work2survive/AE_scripted_Chat)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=Scripted_Chat_Generator.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=Scripted_Chat_Generator.jsx&autobuild=true)

10. **[AE Get Emojis](https://github.com/work2survive/AE_Get_Emojis)** (`jsx/AE_Get_Emojis.jsx` - v1.0):
   - Instant full-color vector emoji search, indexing, and native Shape Layer generator for Adobe After Effects. Solves After Effects' lack of color emoji font support by generating native vector shapes from OpenMoji and Twemoji databases stored in `emojis/`. Features smart search by name, Unicode hex, integer, emoji glyph, or Wikipedia text emoticons (`:D`, `:)`, `;)`, `:P`, `<3`, `</3`, `XD`, `¯\_(ツ)_/¯`), bidirectional Unicode ↔ Integer conversion (`U+1F603` ↔ `128515`), interactive catalog index sliders, dynamic `Add Emoji` / `Replace Emoji` mode, and custom outline width and size controls.
   - **Repository**: [work2survive/AE_Get_Emojis](https://github.com/work2survive/AE_Get_Emojis)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=AE_Get_Emojis.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Get_Emojis.jsx&autobuild=true)

11. **[AE Text Precomp](https://github.com/work2survive/AE-text-precomp)** (`jsx/AE_Text_Precomp.jsx` - v1.2):
   - ScriptUI text precomposer that encapsulates selected paragraph/point text layers into comfortably-sized precomps with customizable padding, auto-height calculation, and dynamic top anchor alignment (left, center, right) with zero visual shift. Includes a procedural 2D rounded rectangle background card with 4 independent corner radii (adapted from `AE_Extruded_Round_corners`), padding reactivity toggles, and an integrated color picker.
   - **Repository**: [work2survive/AE-text-precomp](https://github.com/work2survive/AE-text-precomp)
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true)

#### Built-in Samples (`samples/` Folder)

The simulator includes built-in sample scripts located in [`samples/`](samples/) demonstrating ScriptUI, kinetic typography, expressions, and 3D primitives:

1. **AE / Emulator Tester** (`samples/ae_emulator_tester.jsx` - v1.0):
   - Comprehensive calibration test harness verifying parity between After Effects desktop and the Web Simulator:
     - **Grid Background & Coordinate Calibration**: 100px major & 50px minor grid lines, comp origin center crosshairs (`[960, 540]`), and 100x100px corner alignment bounding boxes to detect position/scale mismatches.
     - **System Fonts Typography Showcase**: Tests cross-platform system fonts (Segoe UI, Arial, Georgia, Times New Roman, Courier New, Trebuchet MS, Impact) displaying the classic *"The quick brown fox jumps over the lazy dog"* pangram along with numerics and glyphs for kerning, baseline, and metric validation.
     - **Geometric Primitives (Ellipses & Polygons)**: Regular circles, stretched ellipses, concentric rings, 3-sided triangles, 5-sided pentagons, 6-sided hexagons, 8-sided octagons, 5-point stars, and 8-point starbursts.
     - **Stroke Styles & Dash Patterns**: Hairline, medium, and heavy widths; Butt, Round, and Projecting/Square line caps; Miter, Round, and Bevel line joins; Solid, standard dashed, dotted pearls (round cap + zero dash), and alternating dual dash patterns.
     - **Variable-Width Stroke Taper**: Needle-point double-ended flourishes, single-ended comet tails, and eased taper transitions.
     - **Fill Styles & Gradients**: Flat RGB solid colors, semi-transparent fills, multi-stop linear gradients (`ADBE Vector Graphic - G-Fill`), and radial gradients.
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?sample=ae_emulator_tester.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?sample=ae_emulator_tester.jsx&autobuild=true)

2. **Text Roundabout** (`samples/text_roundabout.jsx` - v1.0):
   - Parametric 3D circular word carousel spinning around a central master 3D controller null, featuring 6 to 12 configurable random or custom words, -12 to +12 continuous spin speed control, 3D tilt, and orientation modes (carousel, inward, billboard).
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?sample=text_roundabout.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?sample=text_roundabout.jsx&autobuild=true)

3. **Test 1: 3D Cube (200x200px) with Wiggle** (`samples/test1_3d_cube_wiggle.jsx`):
   - Baseline 6-face cube demonstration with active `wiggle()` expressions on position, rotation, and dimensions.

4. **Test 2: ScriptUI Cube Builder Panel** (`samples/test2_scriptui_cube_builder.jsx`):
   - Baseline ScriptUI window demonstration showing button callbacks, edit texts, and layer hierarchy creation.

5. **Test 3: Squares, Circles & Bézier Paths** (`samples/test3_shapes_and_bezier_paths.jsx`):
   - 2D vector primitives demonstration showing rounded rectangles, circle shapes, and 5-point Bézier star paths with curved control tangents.

6. **Test 4: Stroke Taper Showcase** (`samples/test4_stroke_taper.jsx`):
   - Variable-width vector strokes demonstrating double-ended calligraphic flourishes (needle points), comet/meteor streak trails (single-ended sharp taper to rounded head), and wave ribbons with partial width tapering and negative easing.
   - **Live Demo**: [https://work2survive.github.io/AE_JS_builder/?sample=test4_stroke_taper.jsx&autobuild=true](https://work2survive.github.io/AE_JS_builder/?sample=test4_stroke_taper.jsx&autobuild=true)

7. **Sample External Script** (`samples/test_script.jsx`):
   - Sample external script with 3D star and rotating ring.

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
- **[AE WindBox](https://github.com/work2survive/AE_windBox)**: Procedural 3D wind volume particle system with dynamic 3D cube bounding box, 3-axis positional and rotational turbulence, and master controller rigging (v1.0).
- **[AE Spiral Maker](https://github.com/work2survive/AE_spiral_maker)**: Procedural vector spiral generator featuring 5 mathematical spiral algorithms, native After Effects Stroke Taper integration for independent start and end stroke thicknesses, analytical cubic Bézier derivative tangents, and factory presets (v1.0).
- **[AE Scripted Chat](https://github.com/work2survive/AE_scripted_Chat)**: Fully animated multi-message chat conversation generator with smart timestamps, real vs fake delays, auto-scrolling, and JSON conversation management (v1.0).
- **[AE Get Emojis](https://github.com/work2survive/AE_Get_Emojis)**: Full-color vector emoji search, catalog indexer, and native After Effects shape layer generator supporting OpenMoji & Twemoji with emoticon parsing and bidirectional Unicode conversion (v1.0).

---

## 💖 Support / Sponsor

If you find this tool helpful and want to support its ongoing development and maintenance:

[![Sponsor work2survive](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/work2survive)

Every contribution helps keep these open-source After Effects tools free, maintained, and continuously improved for the motion design community!

---

## 🤖 Acknowledgments

Engineered, architected, and co-developed using **[Google DeepMind Antigravity](https://deepmind.google/)** agentic coding assistant.
