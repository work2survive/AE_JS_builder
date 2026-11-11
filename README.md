# After Effects JS & ScriptUI Simulator (3D / 2D)

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2c8cff?style=for-the-badge&logo=github)](https://work2survive.github.io/AE_JS_builder/)

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
- **File Dialog**: Click the **`📂 Open .JSX`** button in the top bar to open any `.jsx` or `.js` file from your disk.
- **Drag & Drop**: Drag `.jsx` files directly from your file manager into the code editor panel.
- **Auto-Execution**: The loaded script is automatically loaded into the editor and executed in the 3D comp, displaying real-time console output in the drawer.
- **Deep Linking & URL Routing**: The active script name is automatically synchronized with the URL (e.g., `?jsx=cylinder_maker.jsx` or `?jsx=extruded_round_rectangle.jsx`). Loading a link with a `?jsx=` parameter auto-detects and runs that tool immediately. Pressing the **Clear** button removes the URL parameter and resets the stage.
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

1. **Cube Maker 3D (`jsx/cube_maker.jsx` - v1.3)**:
   - **Interactive ScriptUI Panel**: Runs as a dockable panel in After Effects or floating palette in the emulator.
   - **Geometry Tab**:
     - **Dimensions (X, Y, Z)**: Sliders and numerical inputs for width, height, and depth ($10\text{ to }500\text{ px}$).
     - **Link All Sizes to Z**: Checkbox adding an AE Checkbox Control effect. When checked, links X and Y to Z. Supports timeline keyframing and expressions.
     - **Topology & Precomp**: Builds 6 rectangular shape faces parented to a master controller, precomposed into a clean subcomp with continuous rasterization (`collapseTransformation = true`).
   - **Appearance Tab**:
     - **Face & Edge Colors**: Live color swatches paired with direct hex inputs for sides fill and border stroke.
     - **Opacity Controls**: Independent sliders for Face Opacity ($0\text{--}100\%$) and Stroke Opacity ($0\text{--}100\%$).
     - **Stroke Width**: Real-time slider ($0\text{ to }20\text{ px}$) with automatic stroke suppression when width is 0.
     - **Corner Roundness & Face Gap**: Scrubbable sliders for rounded bevels and inset edge spacing.

2. **Cylinder Maker 3D (`jsx/cylinder_maker.jsx` - v1.4)**:
   - **Parametric 3D Cylinder & Slice Generator**: Generates full cylinders or customizable radial slice sectors.
   - **Geometry Tab**:
     - **Radius**: Scrubbable slider and numeric field ($1\text{ to }500\text{ px}$).
     - **Extrude (Height)**: Scrubbable slider ($1\text{ to }1000\text{ px}$).
     - **Wall Segments**: Dynamic resolution slider ($3\text{ to }64\text{ segments}$) computing exact chord lengths and tangent angles.
     - **Slice Options**: "Enable Slice" checkbox with Start Angle and End Angle controls ($0^\circ\text{ to }360^\circ$) to produce pie wedges, open tubes, and half-cylinders with automatically generated radial end walls (`Slice_Start` and `Slice_End`) driven by reactive expressions ensuring walls stay visible and in sync if slice is toggled post-creation.
   - **Appearance Tab**:
     - **Tri-Color Palette**: 3 separate color swatches with paired hex fields for Top/Front Cap, Walls, and Bottom/Back Cap.
     - **Opacity & Stroke**: Global opacity slider, stroke color swatch + hex field, and stroke width slider ($0\text{ to }20\text{ px}$) with dynamic expression to hide stroke at 0.
     - **Inner Sides Checkbox**: "Paint inner sides with edge color" (enabled by default) adds internal backing cap faces (`Cap_Top_Inner`, `Cap_Bottom_Inner`) sharing the walls color to prevent contrasting cap colors from leaking through seams at acute viewing angles.
     - **Imitate Wall Segments Checkbox**: "Imitate segments of extruded walls" (enabled by default) generates caps matching the extruded polygonal wall facets vertex-for-vertex, eliminating sub-pixel edge leakage.
   - **Live Rigging**: Precomposes walls and caps into an auto-rigged subcomp driven by Master Effect Controls on the parent layer.

3. **Pie / Slice Generator (`jsx/Pie_Slice_Generator.jsx` - v4.1)**:
   - **Procedural Bézier Vector Path**: Creates a native AE Shape Layer whose path is dynamically calculated using a single mathematical expression.
   - **Dimensions**: Radius X with optional "Enable Ellipse" checkbox for independent Radius Y (elliptical sectors).
   - **Angles**: Start angle (Point B) and End angle (Point C) in degrees, supporting partial sectors up to full $360^\circ$ circles.
   - **Corner Rounding & Overlap Protection**:
     - "Round Corners" checkbox enabling independent rounding radii for Center vertex (A), Start corner (B), and End corner (C).
     - Built-in mathematical constraint solver preventing corner rounding collisions (Priority: Center A > End C > Start B).
   - Generates clean `createPath(verts, ins, outs, true)` expression code.

4. **Custom Rounded Rect (`jsx/custom_rounded_rect.jsx` - v1.1)**:
   - **Independent 4-Corner Parametric Bézier Generator**: Creates a native AE Shape Layer with individual corner radii (Top-Left, Top-Right, Bottom-Right, Bottom-Left) and dynamic effect controls.
   - **Geometry Tab**:
     - **Dimensions (Width & Height)**: Sliders and numerical inputs ($10\text{ to }2000\text{ px}$) with quick dimension presets (Card, Square, HD, Banner).
     - **Link All Corners**: Checkbox with Master Radius slider ($0\text{ to }500\text{ px}$) to drive all 4 corners simultaneously.
     - **2x2 Corner Radii Grid**: Individual controls for Top-Left (TL), Top-Right (TR), Bottom-Left (BL), and Bottom-Right (BR).
     - **Quick Corner Presets**: One-click buttons for Capsule / Pill, Top Tab, Bottom Tab, Diagonal, Card 30px, and Sharp 0px.
     - **Overlap Protection**: Implements the W3C CSS Backgrounds & Borders Level 3 (§5.5) proportional corner scaling solver ($f = \min(1.0, w / \text{sum}_{\text{top}}, w / \text{sum}_{\text{bottom}}, h / \text{sum}_{\text{left}}, h / \text{sum}_{\text{right}})$) so corners never collide or distort even when radii exceed rectangle dimensions.
   - **Appearance Tab**:
     - **Fill & Stroke Controls**: Native color swatches paired with hex inputs, Fill Opacity, Stroke Color swatch, and Stroke Width ($0\text{ to }50\text{ px}$).
     - **0-Stroke Suppression**: Dynamic expression disables stroke rendering when width is 0.
   - **Procedural Rigging**: Adds 14 native Slider/Color/Checkbox Effect Controls to the shape layer and links Bézier path points and tangents via `createPath()` expression.
   - **Credits & Reference**: Based on the AECustomRoundedRect specification by [work2survive](https://github.com/work2survive/AECustomRoundedRect).

5. **Extruded Round Rectangle 3D (`jsx/extruded_round_rectangle.jsx` - v1.3)**:
   - **Parametric 3D Extruded Rounded Rectangle**: Combines the procedural front/back caps of `custom_rounded_rect` with cylindrical sector wall facets from `cylinder_maker` to form an airtight 3D solid.
   - **Geometry Tab**:
     - **Dimensions ($W \times H \times D$)**: Interactive sliders and inputs for Width ($20\text{--}1920\text{ px}$), Height ($20\text{--}1080\text{ px}$), and Extrude Depth ($10\text{--}800\text{ px}$).
     - **Quick Dimension Presets**: Card, Cube, Pill, and Tile.
     - **Corner Radii ($2 \times 2$ Grid)**: Link All Corners + Master Radius or independent radii for Top-Left, Top-Right, Bottom-Left, and Bottom-Right.
     - **Corner Resolution**: Configurable segment count ($2\text{ to }16\text{ facets per corner}$) to balance smoothness and render speed.
     - **W3C Overlap Protection**: Auto-scales corner radii proportionally when combined radii exceed dimensions.
   - **Appearance Tab**:
     - **Tri-Color Palette**: Independent live color swatches paired with hex inputs for Front Face Color, Back Face Color, and Perimeter Walls/Corners Color.
     - **Independent Opacity**: Sliders for Caps Opacity and Sides Opacity.
     - **Edge Stroke**: Color swatch + hex input and stroke width slider ($0\text{ to }30\text{ px}$) with 0-stroke suppression.
     - **Inner Sides Checkbox**: "Paint inner sides using edge color" (enabled by default) adds internal backing cap faces (`Cap_Front_Inner`, `Cap_Back_Inner`) sharing the sides color to prevent opposite face colors from peeking through perimeter edges.
     - **Imitate Corner Segments Checkbox**: "Imitate segments of extruded round corners" (enabled by default) dynamically facets the front and back caps' rounded corners to match the extruded corner wall segments vertex-for-vertex, completely eliminating any Bézier curvature gaps or color leaks.
   - **Live Rigging**: Builds 33 native 3D Shape Layers precomposed into an auto-rigged subcomp driven by 18 Master Effect Controls on the parent layer with continuous rasterization.

6. **Message Bubble Generator (`jsx/message_bubble.jsx` - v1.0)**:
   - **Dedicated Standalone Repository**: [work2survive/AE_message_bubble](https://github.com/work2survive/AE_message_bubble)
   - **Interactive Chat Bubble Engine**: Generates authentic, parametric 2D vector chat bubbles imitating modern mobile messaging platforms (**iOS Messages**, **Android RCS**, **WhatsApp**, **Instagram Direct**, **Facebook Messenger**, and **Custom** themes).
   - **Appearance Tab**:
     - **Layout & Typography**: Font family selector (`SF Pro`, `Roboto`, `Segoe UI`, `Helvetica Neue`, `Arial`, `Inter`, `Open Sans`, `System Default`), responsive screen width ($300\text{ to }1920\text{ px}$ with automatic word-wrapping), text size ($12\text{ to }60\text{ px}$), inner padding ($-10\text{ to }+10\text{ px}$), and leading ($50\%\text{ to }150\%$).
     - **Colors & Appearance**: Interactive color swatches paired with direct hex inputs for bubble and text colors.
     - **Status & Timestamp**: Circled RCS receipts (`○✓`, `○○✓✓`, `●●✓✓`), standard checks (`✓`, `✓✓`), intelligent auto-timing read duration simulation, and randomized timestamps with re-roll. Automatically sets receipts to `None` for Received messages.
     - **Bubble Tail & Direction**: Toggle bottom corner pointer/tail for consecutive multi-message chaining; switch between Sent (Right) and Received (Left).
   - **Animation Tab**:
     - **Entrance Animations**: Independent sliders for Bubble Grow ($0\text{ to }20\text{ frames}$, snappy `easeOutBack` expansion) and Typewriter Reveal ($0\text{ to }20\text{ frames}$, character-by-character reveal).
     - **iOS 18 Animated Text Effects**: 8 continuous looping presets (Big, Small, Shake, Nod, Explode, Ripple, Bloom, Jitter) with speed ($50\%\text{--}200\%$) and intensity ($20\%\text{--}200\%$) modulation.
   - **Live Rigging**: Generates parametric vector shape layers and text layers driven by `Bubble_Master_Controller` with native Effect Controls.

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
