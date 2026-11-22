# Adobe After Effects vs. JavaScript / SVG Text Rendering: The Definitive Engine Guide

> **Knowledge Base & Calibration Reference**  
> *Architected & co-authored with Google DeepMind Antigravity for `work2survive` ecosystems.*  
> *Derived from empirical ground-truth benchmark analysis (`AE_Text_Calibration_Matrix_8x5`).*

---

## 1. Executive Summary

Emulating Adobe After Effects (AE) text geometry, justification, and `sourceRectAtTime()` behavior in Web / JavaScript runtimes (HTML5 Canvas, SVG, WebGL, DOM) is notoriously tricky. While modern browser engines assume a CSS box model (top-left origin, automatic margin/padding, relative flow, and DOM-based font metrics), After Effects utilizes a specialized desktop DTP (Desktop Publishing) vector typography engine inherited from Adobe Illustrator and InDesign.

This document serves as the foundational technical standard for this repository and all future `work2survive` projects, ensuring developers do not start from scratch when synchronizing native AE ExtendScript typography with JavaScript emulator and export engines.

---

## 2. Point Text vs. Paragraph (Box) Text

The single biggest source of discrepancies between After Effects and JavaScript is the fundamental duality of **Point Text** vs. **Paragraph (Box) Text**.

```
                POINT TEXT                                PARAGRAPH (BOX) TEXT
     [Anchor: Baseline Y=0, Just. X=0]             [Anchor: Top-Left of Box [0, 0]]
                    │                                      ┌────────────────────────┐
                    │                                      │ [leftIndent]           │
       The quick brown fox jumps                           │ The quick brown fox    │
       ───────────────────────── [Baseline Y=0]            │ jumps over the lazy    │
                                                           │ dog.                   │
                                                           └────────────────────────┘
```

### 2.1 The Native ExtendScript Limitation
In native After Effects, there is **no public ExtendScript constructor** to create a Paragraph (Box) Text layer from scratch:
- `comp.layers.addText()` **always creates a Point Text layer**.
- Although After Effects CC 2024 introduced `TextDocument.boxText = true` and `TextDocument.boxTextSize = [w, h]`, older versions (CS6 through CC 2023) treat `boxText` as read-only or ignore it when applied to a layer created via `addText()`.
- Therefore, automated scripts (such as chat generators, subtitle riggers, and dynamic text formatters) must either format text with explicit `\r` carriage returns to soft-wrap lines, or account for Point Text mechanics.

### 2.2 Origin & Coordinate Differences
| Dimension / Metric | AE Point Text | AE Paragraph (Box) Text | Standard Web / SVG |
| :--- | :--- | :--- | :--- |
| **Origin $[0, 0]$** | **Alphabetic Baseline** of line 1 | **Top-Left Corner** of the paragraph box | Top-Left of element box |
| **Ascender Space** | Glyphs ascend into **negative $y$ space** ($y < 0$) | Contained inside box ($y \ge 0$) | Below element $y$ (in HTML DOM) |
| **Bounding Box** | Determined solely by rendered glyph paths | Fixed box size $[w, h]$ (text can overflow) | Bounding rect / content box |
| **Horizontal Anchor** | Shifts with justification ($0$, $-w/2$, $-w$) | Always at the box left ($x = 0$) | Left edge ($x = 0$) by default |

---

## 3. Horizontal Justification & Anchor Point Geometry

In native After Effects Point Text, the layer's local $[0, 0]$ origin is **directly tied to the text justification setting**:

### 3.1 Point Text Justification Rules
1. **Left Justification (`LEFT_JUSTIFY` / `7412`)**:
   - The anchor point $x=0$ is at the **left edge** of each line.
   - Text extends entirely in positive $x$ ($x \ge 0$).
2. **Center Justification (`CENTER_JUSTIFY` / `7414`)**:
   - The anchor point $x=0$ is at the **horizontal center** of each line.
   - Line text extends symmetrically into negative and positive space: $[-w/2 \le x \le +w/2]$.
   - *Gotcha*: If a Point Text layer is Center Justified and placed at `position.x = containerLeft`, the center of the text will sit on the left border of the container, causing the left half of the text to spill out to the left!
3. **Right Justification (`RIGHT_JUSTIFY` / `7413`)**:
   - The anchor point $x=0$ is at the **right edge** of each line.
   - Line text extends entirely into negative space ($x \le 0$).
   - *Gotcha*: If placed at `position.x = containerLeft`, the entire text line will render outside the container to the left!

### 3.2 Canonical Container Placement Formulas
To position Point Text inside a bounding container of bounds $[X, Y, W, H]$ with indents $\text{leftIndent}$ and $\text{rightIndent}$:

$$\text{Position}_X = \begin{cases} 
X + \text{leftIndent} & \text{if Left Justified} \\
X + \frac{W + \text{leftIndent} - \text{rightIndent}}{2} & \text{if Center Justified} \\
X + W - \text{rightIndent} & \text{if Right Justified}
\end{cases}$$

$$\text{Position}_Y = Y + \text{FirstBaselineOffset} \quad (\approx Y + \text{fontSize} \times \text{ascentRatio} + \text{headroom})$$

---

## 4. `sourceRectAtTime()` Coordinates & Emulation

In After Effects expressions and scripts, `layer.sourceRectAtTime(time, includeExtents)` measures the layer's content boundaries in local layer space.

### 4.1 Point Text `sourceRectAtTime()` Return Values

```
           X=0 (Left Justified)
            │
  -ascent ──┼───────┌─────────────────────────┐ ▲
   (r.top)  │       │ The quick brown fox     │ │
            │       │ jumps over the lazy dog.│ │ r.height
  Baseline ─┼───────┴─────────────────────────┘ ▼
   (Y=0)    │       ◄─────── r.width ────────►
            │
```

- **`r.top` is Negative**: Because the origin $y=0$ is the baseline of the first line, glyphs extending upwards (caps, ascenders like `h, b, d, k, l, t`) have negative $y$ coordinates:
  $$r.\text{top} = -(\text{fontSize} \times \text{ascentRatio}) - \text{baselineShift}$$
- **`r.left` Depends on Justification**:
  $$r.\text{left} = \begin{cases}
  0 & \text{if Left Justified} \\
  -\frac{r.\text{width}}{2} & \text{if Center Justified} \\
  -r.\text{width} & \text{if Right Justified}
  \end{cases}$$
- **`r.height`**: Spans from the highest ascender of line 1 to the lowest descender of the final line:
  $$r.\text{height} = (\text{lineCount} - 1) \times \text{effectiveLeading} + \text{fontSize} \times (\text{ascentRatio} + \text{descentRatio})$$

### 4.2 Paragraph (Box) Text `sourceRectAtTime()` Return Values
In Box Text, the origin $[0, 0]$ is the top-left corner of the paragraph box:
- `r.top` is **positive** (distance from the box top to the highest ascender):
  $$r.\text{top} = \text{fontSize} \times (1 - \text{ascentRatio})$$
- `r.left` is **positive** (distance from the box left to the leftmost glyph):
  $$r.\text{left} = \text{leftIndent} \quad (\text{or } \text{leftIndent} + \text{firstLineIndent})$$

---

## 5. Expression Coordinate Dimensions: The `toComp()` Dimension Trap

When linking a shape layer (such as a background box or cyan bounding rectangle) to a text layer's `sourceRectAtTime()` via expressions:

### 5.1 The 3D Vector Return Trap
In After Effects, `layer.toComp(point)` and `layer.toWorld(point)` **always return a 3-element vector `[x, y, 0]`**, even when called on a 2D layer!

```javascript
// ❌ WRONG: Fails in native AE with "Expression result must be of dimension 2, not 3"
var target = thisComp.layer("Text_Layer");
var r = target.sourceRectAtTime(time, false);
target.toComp([r.left + r.width / 2, r.top + r.height / 2]);

// ✅ CORRECT: Works across all native AE versions and Web Emulators
var target = thisComp.layer("Text_Layer");
var r = target.sourceRectAtTime(time, false);
var p = target.toComp([r.left + r.width / 2, r.top + r.height / 2]);
[p[0], p[1]]; // Sliced to 2D
```

When writing robust AE expressions or building JS emulator expression parsers, always slice or clamp dimensional vectors to match the target property's dimensional requirement.

---

## 6. Typographic Metrics & Font Advance Width Profiles

Standard browser typography (DOM `canvas.measureText()`) measures advance width up to the trailing whitespace and does not compute baseline ascent ratios according to desktop DTP metrics.

Below are the empirical metric ratios for common system fonts calibrated against Adobe After Effects CC:

| Font Family | PostScript Name | Category | Ascent Ratio | Descent Ratio | Char Width Ratio | Monospace |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Arial** | `ArialMT` | Sans-Serif | $0.78$ | $0.22$ | $0.52$ | No |
| **Georgia** | `Georgia` | Serif | $0.81$ | $0.24$ | $0.50$ | No |
| **Times New Roman** | `TimesNewRomanPSMT` | Serif | $0.77$ | $0.23$ | $0.46$ | No |
| **Courier New** | `CourierNewPSMT` | Monospace | $0.82$ | $0.22$ | $0.60$ | **Yes** |
| **Verdana** | `Verdana` | Wide Sans | $0.82$ | $0.22$ | $0.58$ | No |
| **Trebuchet MS** | `TrebuchetMS` | Humanist | $0.79$ | $0.22$ | $0.54$ | No |
| **Impact** | `Impact` | Display Sans | $0.85$ | $0.18$ | $0.47$ | No |
| **Segoe UI** | `SegoeUI` | Modern UI | $0.79$ | $0.22$ | $0.52$ | No |
| **Myriad Pro** | `MyriadPro-Regular` | Contemporary | $0.78$ | $0.22$ | $0.51$ | No |

### 6.1 Adobe Auto-Leading Standard
In Adobe After Effects, when `autoLeading == true` (or `leading == 0`), the effective line height is mathematically defined as:
$$\text{EffectiveLeading} = \text{fontSize} \times 1.20$$

### 6.2 Tracking Conversion
In After Effects, tracking values are defined in **1/1000 em**:
$$\Delta x_{\text{char}} = \left(\frac{\text{tracking}}{1000}\right) \times \text{fontSize}$$
*Example*: A tracking value of $+50$ at $\text{fontSize} = 20\text{px}$ adds $(50 / 1000) \times 20 = 1.0\text{px}$ extra spacing between adjacent characters.

---

## 7. SVG / Web Emulator Implementation Architecture

When building a Web Emulator or JS renderer (such as `ae-renderer.js`):

### 7.1 SVG Representation for Point Text
To match native AE Point Text in SVG:
1. Wrap the text layer in `<text transform="translate(textPosX, textPosY)">`.
2. Do **not** set `dominant-baseline: hanging` or `central`; keep the default alphabetic baseline so that $y=0$ corresponds to the native AE baseline!
3. For line $i \in [0, N-1]$:
   - Line Y: $y_i = - \text{baselineShift} + (i \times \text{effectiveLeading})$
   - Line X & Text Anchor:
     - Left: `x = 0`, `text-anchor = "start"`
     - Center: `x = 0`, `text-anchor = "middle"`
     - Right: `x = 0`, `text-anchor = "end"`

### 7.2 SVG Representation for Box Text
When rendering genuine Box Text (`boxText: true`):
1. Wrap `<text transform="translate(boxLeft, boxTop)">`.
2. First line baseline is shifted down into the box by the font's ascender:
   $$y_0 = \text{fontSize} \times \text{ascentRatio} - \text{baselineShift}$$
3. For line $i$:
   - Line Y: $y_i = y_0 + (i \times \text{effectiveLeading})$
   - Line X & Text Anchor:
     - Left: `x = leftIndent + (isFirstLine ? firstLineIndent : 0)`, `text-anchor = "start"`
     - Center: `x = (boxWidth + leftIndent - rightIndent) / 2`, `text-anchor = "middle"`
     - Right: `x = boxWidth - rightIndent`, `text-anchor = "end"`

---

## 8. Summary Checklist for Future Repositories

When developing tools or emulators that interface with After Effects typography:
- [x] **Identify text layer mode**: Check if `doc.boxText === true` or Point Text.
- [x] **Compensate Point Text positions**: Position Center Justified point text at center $(W/2)$ and Right Justified point text at right $(W - \text{margin})$.
- [x] **Slice expression vectors**: Always convert `target.toComp(...)` results to 2D `[p[0], p[1]]` when driving 2D properties.
- [x] **Account for negative `sourceRectAtTime().top`**: When building bounding boxes or auto-crop backgrounds, remember `r.top` is negative in Point Text.
- [x] **Use $1.20 \times \text{fontSize}$ for auto-leading**: Never use browser default line-heights (1.35–1.50) when emulating AE.
- [x] **Apply 1/1000 em for tracking**: Scale tracking values linearly by `(tracking / 1000) * fontSize`.
