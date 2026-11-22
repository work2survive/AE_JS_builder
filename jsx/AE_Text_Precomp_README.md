# AE Text Precomp (v1.3.1)

[![Live Browser Simulator](https://img.shields.io/badge/Live%20Demo-AE%20ScriptUI%20Simulator-2c8cff?style=for-the-badge&logo=javascript)](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Adobe After Effects](https://img.shields.io/badge/Adobe%20After%20Effects-CS6%20--%20CC%202026%2B-9999FF?style=for-the-badge&logo=adobeaftereffects)](https://www.adobe.com/products/aftereffects.html)
[![Built with Antigravity](https://img.shields.io/badge/Built%20With-Antigravity-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/)

> **Interactive Web Simulator**: Test, customize, and preview this tool directly in your browser without launching After Effects via the [AE JS & ScriptUI Simulator](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true).

---

## 📖 Overview

**AE Text Precomp** is an Adobe After Effects ScriptUI panel and ExtendScript engine that encapsulates paragraph (box) and point text layers into perfectly formatted precompositions with **zero visual jump or shift** on screen.

Whenever an anchor point is placed or changed by this script, the precomposition's position is automatically and mathematically compensated using the layer's complete rotation, scale, and parent transform matrix so that the text box on screen never moves a single pixel from its original position.

---

## 🌟 What's New in v1.3.1

1. **Pixel-Perfect Zero-Shift Positioning**:
   - The original text box reference point is sampled *before* precomposing.
   - Any difference between the chosen anchor point (Top-Left, Top-Center, Top-Right, or Center) and the internal text box location is completely counteracted by position compensation:
     $$P_{\text{precomp}} = P_{\text{ref}} + R(\theta) \cdot S \cdot (A_{\text{precomp}} - C_{\text{ref}})$$
   - Parent layers, 3D rotations, and non-uniform scales are fully preserved without displacement.
2. **Separated Dimensions & Padding UI**:
   - Cleanly separated into two dedicated sections: **Dimensions** (Width, Height, Auto-Height) and **Padding** (Padding slider/input, Auto-Detect Width).
   - Added **"Auto detect width from selected layer"** checkbox as the primary option in the Padding section to dynamically inherit the active text box width.
3. **Dedicated Background Tab**:
   - Isolated all background card options into a dedicated **"Background"** tab, keeping the main Precomp tab lightweight and uncluttered.
   - Independent corner reaction selectors (**Top-Left, Top-Right, Bottom-Right, Bottom-Left**) with 1-click presets (*All Corners*, *Top Only*, *Chat Bubble*, *No Corners*).
3. **Crash-Proof AE DOM Re-Traversal**:
   - Hardened `createBackgroundShapeLayer` and `precompTextLayer` against Adobe After Effects internal C++ DOM handle invalidation. All property groups are queried fresh from `bgLayer` with full `try/catch` fail-safe boundaries.
4. **Enhanced Color Swatch**:
   - Interactive color swatch button + hex input synchronized across native After Effects `$.colorPicker`, Windows OS color dialogs, and the web simulator.

---

## ⚙️ Core Architecture & Features

### 1. Zero-Shift Precomposition Math
When After Effects precomposes a layer natively, the new precomp's anchor point is placed at its geometric center `[W/2, H/2]`, causing the layer on screen to jump and shift. **AE Text Precomp** calculates the exact typographic offset:
$$\Delta X = X_{\text{orig}} - \text{Anchor}_X, \quad \Delta Y = Y_{\text{orig}} - \text{Anchor}_Y$$
The parent precomp layer position is compensated so that the text remains pixel-for-pixel motionless on screen.

### 2. Alignment-Aware Top Anchor Placement
Based on paragraph justification, the precomp anchor point is automatically aligned to the top edge of the text box (offset by padding):
- **Left Justified**: $[ \text{Padding}, \text{Padding} ]$
- **Center Justified**: $[ \text{Precomp Width} / 2, \text{Padding} ]$
- **Right Justified**: $[ \text{Precomp Width} - \text{Padding}, \text{Padding} ]$

### 3. Smart Textbox Width Compensation
Inside the precomposition, the paragraph box size is automatically reduced:
$$\text{Textbox Width} = \text{Precomp Width} - (2 \times \text{Padding})$$
This ensures paragraph text flows naturally without clipping against the precomp edges.

### 4. Automatic Precomp Height
When **"Automatic precomp height (fit to wrapped text bounds)"** is enabled:
$$\text{Precomp Height} = \text{Text Bounds Height} + (2 \times \text{Padding})$$

### 5. Procedural 2D Rounded Background Card
- Derived from [`AE_Extruded_Round_corners`](https://github.com/work2survive/AE_Extruded_Round_corners).
- Generates an 8-vertex cubic Bézier shape path with Master Slider Controls added to the shape layer:
  - `Card Width`, `Card Height`
  - `Radius Top-Left`, `Radius Top-Right`, `Radius Bottom-Right`, `Radius Bottom-Left`
- Automatically enforces W3C proportional corner scaling if radii exceed box dimensions:
  $$f = \min\left(1.0, \frac{W}{r_{\text{TL}} + r_{\text{TR}}}, \frac{W}{r_{\text{BL}} + r_{\text{BR}}}, \frac{H}{r_{\text{TL}} + r_{\text{BL}}}, \frac{H}{r_{\text{TR}} + r_{\text{BR}}}\right)$$

### 6. 100-Word Lorem Ipsum Dummy Layer
If no text layer is selected when clicking precompose (or when clicking **Create 100-Word Dummy Layer Only**), the script generates a 100-word paragraph text layer using standard system fonts (`ArialMT`) formatted to the target dimensions.

---

## 🖥️ ScriptUI Panel Layout

```text
┌──────────────────────────────────────────────────┐
│ 📦 AE TEXT PRECOMP v1.3.0                        │
├──────────────────────────────────────────────────┤
│ Selected Text Layer Status:                      │
│ 'Title Layer' (Paragraph Box, LEFT | 42 words)  │
│ [ 🔄 Auto-Detect Selected Text Size ]            │
├──────────────────────────────────────────────────┤
│ ┌─ Precomp ───────┐ ┌─ Background ─────────────┐ │
│ │                                              │ │
│ │ ▼ Dimensions                                 │ │
│ │   Width:  [ 800  ] px                        │ │
│ │   Height: [ 400  ] px                        │ │
│ │   [x] Auto Precomp Height (fit wrapped text) │ │
│ │                                              │ │
│ │ ▼ Padding & Anchor                           │ │
│ │   [x] Auto detect width from selected layer  │ │
│ │   Padding: [======O=====] [ 30 ] px          │ │
│ │   [x] Auto Align Anchor to Top of Text Box   │ │
│ │   Alignment Override: [ Auto Detect        ▼]│ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ [  Precomp Selected Text Box                  ]  │
│ [  Create 100-Word Dummy Layer Only           ]  │
│ Ready.                                           │
│ GitHub: work2survive/AE-text-precomp             │
└──────────────────────────────────────────────────┘
```

---

## 📦 Installation

### Option 1: Dockable Panel (Recommended)
1. Download [`AE_Text_Precomp.jsx`](AE_Text_Precomp.jsx).
2. Place the file in your After Effects **ScriptUI Panels** directory:
   - **Windows**: `C:\Program Files\Adobe\Adobe After Effects <Version>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS**: `/Applications/Adobe After Effects <Version>/Scripts/ScriptUI Panels/`
3. Restart After Effects or click **Window → AE_Text_Precomp.jsx**.
4. Dock the panel anywhere into your AE layout workspace.

### Option 2: Run As Standalone Script
1. In After Effects, choose **File → Scripts → Run Script File...**
2. Select [`AE_Text_Precomp.jsx`](AE_Text_Precomp.jsx).

---

## 🚀 Step-by-Step Usage

1. **Select Text Layer**: Select any Point or Paragraph Text layer in your active composition.
2. **Auto-Detect**: Open the panel and click **Auto-Detect Selected Text Size** (or check *Auto detect width from selected layer*).
3. **Configure Settings**:
   - In the **Precomp** tab, adjust width, height, and padding.
   - In the **Background** tab, toggle the background card, choose which corners react to padding, and pick a fill color.
4. **Precompose**: Click **Precomp Selected Text Box**.
   - A new precomposition is created.
   - Text is adjusted inside without clipping.
   - Background card is generated underneath.
   - Zero visual jump occurs in your main composition.

---

## 🛠️ Compatibility

| Environment | Version / Target | Status |
| :--- | :--- | :--- |
| **Adobe After Effects** | CS6, CC 2014 through CC 2026+ | ✅ Native ES3 ExtendScript |
| **Operating Systems** | Windows 10/11, macOS 10.14+ | ✅ Fully Supported |
| **Web Simulator** | [AE JS Builder](https://work2survive.github.io/AE_JS_builder/) | ✅ 100% In-Browser Simulation |

---

## 🔗 Related Repositories

- **[AE JS Builder](https://github.com/work2survive/AE_JS_builder)**: Complete web-based ExtendScript and ScriptUI simulator.
- **[AE Extruded Round Corners](https://github.com/work2survive/AE_Extruded_Round_corners)**: Parametric 4-corner rounded rectangle geometry.
- **[AE Text Highlight](https://github.com/work2survive/AE-Text-Highlight)**: Kinetic typographic highlight generator.
- **[AE WindBox](https://github.com/work2survive/AE_windBox)**: Dynamic UI windbox & procedural styling suite.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
