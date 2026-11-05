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
- **Orbit Camera**: Left-click and drag anywhere on the composition viewport to rotate around the Point of Interest in 3D.
- **Mouse Wheel Zoom**: Smoothly dolly the camera in and out.
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

### 6. Global Expression Switch & 4-Way Evaluation Switch
- **Global Expressions Switch**: Located in the timeline switches header (`[=] Expressions: Shown/Hidden`). Click to hide/show expression formulas and badges.
- **4-Way Layer Evaluation Switch**: Positioned on the left of each timeline layer row:
  - **🎲 Rand (Default)**: Jitters and randomizes dynamic values with high-frequency noise.
  - **〰️ Wiggle**: Smooth, harmonic After Effects continuous wiggle.
  - **⏹️ Stop**: Freezes/stops the animation at its current evaluated value.
  - **⏮️ Base**: Resets to the original static base value defined in the script without animation.

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
- Comes with a sample test script: [`test_script.jsx`](file:///g:/My%20Drive/_openProjects/My_AE_assets/AE_JS_builder/test_script.jsx).

### 9. ScriptUI Panel & Dialog Emulator
- Emulates Adobe ExtendScript `Window`, `Panel`, `Group`, `Button`, `StaticText`, `EditText`, `Slider`, `Checkbox`, `RadioButton`, `DropDownList`, and `ProgressBar`.
- Supports layout orientation (`row` / `column`), alignment, margins, spacing, and event callbacks (`onClick`, `onChange`, `onChanging`).
- Switch to the **ScriptUI Panel Preview** tab to interact directly with your UI controls and see them modify the composition live.

### 10. Built-in Test Presets
1. **Cube Maker (`cube_maker.jsx`)**:
   - Interactive ScriptUI Panel for creating customizable 3D cuboids / cubes.
   - **X, Y, Z Dimensions**: Sliders and numerical inputs for width, height, and depth ($50\text{ to }500\text{ px}$).
   - **Link all sizes to Z**: A boolean checkbox control added to the controller layer. When checked, links X and Y to Z. Can be animated with keyframes or expressions directly in the timeline!
   - **Animate it**: Toggles dynamic wiggling of size/scale and 3D rotation ($Y$ and $X$).
   - **Sides & Stroke Colors**: Clickable color swatch dialogs to customize the fill color of the faces and border stroke color.
   - **Stroke Thickness**: Real-time slider ($1\text{ to }20\text{ px}$) to adjust border thickness.
2. **Test 1: 3D Cube (200x200px) with Wiggle**:
   - Original static 200x200 6-face cube test.
3. **Test 2: ScriptUI Cube Builder Panel**:
   - Original basic ScriptUI panel test.
4. **Test 3: Squares, Circles & Bézier Paths**:
   - Demonstrates rounded rectangles, circle shapes, and 5-point Bézier stars with curve tangents.

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
