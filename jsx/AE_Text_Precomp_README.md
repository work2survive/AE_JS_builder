# AE Text Precomp (v1.4.4)

[![Live Browser Simulator](https://img.shields.io/badge/Live%20Demo-AE%20ScriptUI%20Simulator-2c8cff?style=for-the-badge&logo=javascript)](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Adobe After Effects](https://img.shields.io/badge/Adobe%20After%20Effects-CS6%20--%20CC%202026%2B-9999FF?style=for-the-badge&logo=adobeaftereffects)](https://www.adobe.com/products/aftereffects.html)
[![Built with Antigravity](https://img.shields.io/badge/Built%20With-Antigravity-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/)

> **Interactive Web Simulator**: Test, customize, and preview this tool directly in your browser without launching After Effects via the [AE JS & ScriptUI Simulator](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Text_Precomp.jsx&autobuild=true).

---

## 📖 Overview

**AE Text Precomp** is an Adobe After Effects ScriptUI panel and ExtendScript engine that encapsulates paragraph (box) and point text layers into perfectly formatted precompositions with **zero visual jump or shift** on screen.

Whenever an anchor point is placed or changed by this script, the precomposition's position is automatically and mathematically compensated using the layer's complete rotation, scale, and parent transform matrix so that the text box on screen never moves a single pixel from its original position.

In **v1.4.4**, AE Text Precomp delivers **kinetic word and line splitting**: seamlessly divide any paragraph or point text into individual, perfectly styled and positioned layers for every single word or line inside the precomp with sub-pixel uniform word spacing, calibrated across both native After Effects and the browser-based AE simulator.

---

## 🌟 What's New in v1.4.3

1. **Deterministic Inter-Word Spacing via Space Character Width**:
   - In "Divide by Words", spacing between consecutive words is strictly and uniformly calculated using the exact measured font space character width (`spaceWidth`).
   - Eliminates all inconsistent spacing, oversized gaps, and accidental word collisions (`curX += wordW + spaceWidth`).
2. **Unified Typographic Baseline Locking**:
   - All words on each line are anchored to a shared typographic baseline ($Y = 0$, `lineBaselineY = padding + firstLineCap + li * lineStep`), eliminating vertical jumping between lowercase words, capitals, and ascenders.
3. **Compensated Precomp Placement**:
   - Accounts for any anchor point movement when moving layers to the precomp, moving the precomp counter to the axis movement to place it exactly where the text layer was originally.
4. **"Divide by Words" & "Divide by Lines" Actions**:
   - Splits paragraph or point text into individual text layers for each word at its exact matching spatial position.
   - Calculates sub-pixel word offsets along each typographic line using prefix measurement (`measureExact(textBefore)`) to perfectly preserve typographic kerning and letter tracking.
   - Grounds each word's anchor point to its local glyph bounding box `[rWord.left, rWord.top]`, ensuring clean per-word scaling and rotation.
   - Names each layer `Word N: "<word>"` inside the precomposition.

2. **"Divide by Lines" Action Button**:
   - Splits multiline text into individual text layers for each visual line matching the original layout and justification (Left, Center, Right).
   - Accurately computes line leading (auto or fixed) and baseline steps.
   - Names each layer `Line N: "<line text>"`.

3. **Complete Typographic Style Inheritance**:
   - Divided layers inherit all native character formatting: font family, font size, fill color, stroke color, stroke width, tracking, baseline shift, and capitalization.
   - The optional procedural rounded background card is automatically sent behind all divided layers (`bgLayer.moveToEnd()`).

4. **Zero-Shift Guarantee**:
   - The overall precomposition container is placed at the exact screen coordinates of the original text box, guaranteeing zero visual jump.

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
Inside the precomposition, unified paragraph text box size is automatically reduced:
$$\text{Textbox Width} = \text{Precomp Width} - (2 \times \text{Padding})$$
This ensures paragraph text flows naturally without clipping against the precomp edges.

### 4. Automatic Precomp Height
When **"Automatic precomp height (fit to wrapped text bounds)"** is enabled:
$$\text{Precomp Height} = \text{Text Bounds Height} + (2 \times \text{Padding})$$

### 5. Kinetic Word & Line Text Division
- Automatically analyzes wrapping, soft breaks, and line breaks in paragraph and point text.
- Generates dedicated text layers for each word or line with individual transform controls.
- Text layers are immediately ready for kinetic motion graphics, staggered animations, per-word 3D transforms, or expression animators inside the precomp.

### 6. Procedural 2D Rounded Background Card
- Derived from [`AE_Extruded_Round_corners`](https://github.com/work2survive/AE_Extruded_Round_corners).
- Generates an 8-vertex cubic Bézier shape path with Master Slider Controls added to the shape layer:
  - `Card Width`, `Card Height`
  - `Radius Top-Left`, `Radius Top-Right`, `Radius Bottom-Right`, `Radius Bottom-Left`
- Automatically enforces W3C proportional corner scaling if radii exceed box dimensions:
  $$f = \min\left(1.0, \frac{W}{r_{\text{TL}} + r_{\text{TR}}}, \frac{W}{r_{\text{BL}} + r_{\text{BR}}}, \frac{H}{r_{\text{TL}} + r_{\text{BL}}}, \frac{H}{r_{\text{TR}} + r_{\text{BR}}}\right)$$

### 7. 100-Word Lorem Ipsum Dummy Layer
If no text layer is selected when clicking precompose (or when clicking **Create 100-Word Dummy Layer Only**), the script generates a 100-word paragraph text layer using standard system fonts (`ArialMT`) formatted to the target dimensions.

---

## 🖥️ ScriptUI Panel Layout

```text
┌──────────────────────────────────────────────────┐
│ 📦 AE TEXT PRECOMP v1.4.3                        │
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
│ [ Divide by Words ]      [ Divide by Lines ]     │
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
4. **Choose Execution Mode**:
   - **Precomp Selected Text Box**: Precomposes the unified text box with zero visual shift.
   - **Divide by Words**: Splits the text into individual, styled, and kerned text layers for every word, then precomposes.
   - **Divide by Lines**: Splits the text into individual text layers for each line in matching positions, then precomposes.

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
