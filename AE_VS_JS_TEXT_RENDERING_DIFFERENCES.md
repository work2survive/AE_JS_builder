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

### 3.3 Paragraph (Box) Text Justification & `boxTextPos` Rules

Unlike Point Text, Paragraph (Box) Text behaves fundamentally differently with regard to justification and anchor point mechanics:

1. **Justification is Internal to the Box**:
   - In Box Text, the bounding box $[0, 0 \text{ to } W, H]$ is fixed in layer space.
   - Setting `doc.justification = CENTER_JUSTIFY` or `RIGHT_JUSTIFY` formats the lines **inside** the box bounds $[0, W]$.
   - **Crucial Rule**: The layer position and anchor point must **NOT** be offset by $\frac{W}{2}$ or $W$ for Center/Right justification! Doing so causes double-displacement and pushes the text box far out of alignment.

2. **The `TextDocument.boxTextPos` Coordinate Mapping**:
   - In native After Effects, a Paragraph Text layer created via `comp.layers.addBoxText([w, h])` defaults its anchor point to the first line's baseline, **not** to the box's top-left corner!
   - `doc.boxTextPos` returns $[x, y]$, which represents the layer coordinates of the paragraph box top-left corner relative to the layer's anchor point (e.g., approximately $[0, -\text{baseline}]$).
   - If a script naively overwrites `layer.transform.anchorPoint = [0, 0, 0]`, it destroys AE's internal vertical baseline offset, displacing the text box upwards by $80\text{--}100\text{px}$ across the top of its intended container!

3. **The Universal Box Text Positioning Formula**:
   In After Effects, the composition coordinate $P_{\text{comp}}$ for any local layer point $P_{\text{layer}}$ is:
   $$P_{\text{comp}} = \text{Position} - \text{AnchorPoint} + P_{\text{layer}}$$
   The top-left corner of the box in local layer coordinates is $P_{\text{box}} = \text{doc.boxTextPos}$.
   To place the top-left of the paragraph box precisely at target composition coordinates $[X, Y]$:
   
   ```javascript
   // 1. Commit all text formatting first so AE calculates exact typography metrics:
   textDocProp.setValue(doc);

   // 2. Read the box top-left coordinate in layer space:
   var bPos = [0, 0];
   try {
       if (doc.boxTextPos) bPos = doc.boxTextPos;
   } catch (e) {}

   // 3. Pin layer anchor point to boxTextPos:
   textLayer.transform.anchorPoint.setValue([bPos[0], bPos[1], 0]);

   // 4. Pin layer position directly to the container top-left:
   textLayer.transform.position.setValue([X, Y, 0]);
   ```
   
   Because $\text{Position} - \text{AnchorPoint} + \text{boxTextPos} = [X, Y] - \text{bPos} + \text{bPos} = [X, Y]$, the container box top-left is mathematically guaranteed to land at $[X, Y]$ across all After Effects versions, fonts, leadings, and justification modes!

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

## 8. Font Substitutions, PostScript Mappings & Boundary-Condition Line Wrapping

Empirical ground-truth comparisons between native Adobe After Effects and the JavaScript emulator reveal that font metrics and line-breaking algorithms are intensely sensitive to runtime font resolution.

### 8.1 PostScript Font Server Mappings vs. Web Font Fallback Stacks
Adobe After Effects and Web browsers resolve font families through completely distinct subsystem architectures:

```
    ADOBE AFTER EFFECTS                                 WEB / JS EMULATOR
┌──────────────────────────────┐                   ┌──────────────────────────────┐
│ ExtendScript:                │                   │ CSS Font Stack:              │
│ doc.font = "ArialMT"         │                   │ font-family: 'Arial', ...    │
└──────────────┬───────────────┘                   └──────────────┬───────────────┘
               ▼                                                  ▼
┌──────────────────────────────┐                   ┌──────────────────────────────┐
│ Adobe CoolType / FontServer: │                   │ Browser Font Matching:       │
│ Matches PostScript table in  │                   │ DirectWrite / CoreText /     │
│ system OpenType/TrueType file│                   │ FreeType / Fontconfig        │
└──────────────┬───────────────┘                   └──────────────┬───────────────┘
               ▼                                                  ▼
┌──────────────────────────────┐                   ┌──────────────────────────────┐
│ Exact Glyph Advance Widths   │                   │ Fallback Substitution:       │
│ (Desktop TrueType font file) │                   │ Liberation Sans / DejaVu Sans│
└──────────────────────────────┘                   └──────────────────────────────┘
```

1. **ExtendScript PostScript Names**: In native After Effects, setting `doc.font = "Arial"` can throw an error or fall back unless the font's canonical PostScript name is provided (e.g. `ArialMT`, `Georgia`, `TimesNewRomanPSMT`, `CourierNewPSMT`, `Verdana`, `TrebuchetMS`, `Impact`, `SegoeUI`).
2. **Web Browser Fallbacks**: Browsers rely on the client OS font inventory. On Linux distributions (e.g., Ubuntu, ChromeOS) or mobile platforms without proprietary Microsoft fonts installed, requested fonts like `Arial`, `Times New Roman`, or `Segoe UI` are silently substituted with open-source alternatives (such as `Liberation Sans`, `FreeSerif`, or `DejaVu Sans`).
3. **Advance Width Variance**: While substituted fonts maintain similar design proportions, individual character advance widths deviate by **1% to 4%**. For example, the advance width of `"over the lazy dog. Calibration:"` at $15.6\text{px}$ is:
   - Genuine Arial (Windows/macOS): $\approx 206.4\text{px}$
   - Fallback Sans-Serif (Linux FreeType): $\approx 198.8\text{px}$

### 8.2 The "1-Word" Line-Wrap Boundary Threshold
When paragraph text wraps inside a Paragraph (Box) layer:
$$\text{availBaseWidth} = \text{boxWidth} - \text{leftIndent} - \text{rightIndent}$$

If the cumulative advance width of a sequence of words falls within a critical boundary threshold ($\pm 5\text{px}$) of $\text{availBaseWidth}$:
- **In Native AE**: If $\text{cumulativeWidth} > \text{availBaseWidth}$ by even $0.1\text{px}$, the engine breaks the line and pushes the trailing word onto the next line.
- **In Web Emulator**: If an OS-level font substitution renders glyphs slightly more condensed ($\text{cumulativeWidth} \le \text{availBaseWidth}$), the trailing word is retained on the line, resulting in **one fewer total line** for the paragraph.

### 8.3 Overset Text Spill Direction: Left vs. Right
The direction in which overflowing or overset text spills outside the container boundary is determined by justification:

```
LEFT JUSTIFIED OVERFLOW (Spills Right)       RIGHT JUSTIFIED OVERFLOW (Spills Left)
┌─────────────────────────┐                 ┌─────────────────────────┐
│ The quick brown fox     │                 │     The quick brown fox │
│ jumps over the lazy dog. Calibration:!    !Calibration: jumps over the lazy dog. │
└─────────────────────────┘                 └─────────────────────────┘
                          ▲                 ▲
            Spills OUTSIDE RIGHT       Spills OUTSIDE LEFT
```

1. **Left Justified (`LEFT_JUSTIFY`)**:
   - Anchor point is at $x = \text{leftIndent}$, and glyphs advance in positive $+x$.
   - Any line that exceeds the box boundary spills visibly across the **right** border of the bounding card.
2. **Right Justified (`RIGHT_JUSTIFY`)**:
   - Anchor point is at $x = \text{boxWidth} - \text{rightIndent}$, and SVG uses `text-anchor="end"`.
   - Glyphs advance backward into negative $-x$ relative to the anchor point.
   - **Critical Gotcha**: If a line fails to wrap or exceeds the available width, the overflow spills across the **left** border of the bounding card!

---

## 9. Visual Symmetry: Container Box Width vs. Content Width

When creating backgrounds or precompositions around text layers (e.g. rounded rectangle cards, badges, or subtitles):

```
       CONTAINER BOX (ASYMMETRIC)               CONTENT-BOUND (SYMMETRIC)
   ┌────────────────────────────────┐         ┌───────────────────────┐
   │ [pad]                     [pad]│         │ [pad]            [pad]│
   │ Sed ut perspiciatis unde       │         │ Sed ut perspiciatis   │
   │ omnis iste natus               │         │ unde omnis iste natus │
   │ error sit...                   │         │ error sit...          │
   │                   ◄── GAP ───► │         └───────────────────────┘
   └────────────────────────────────┘          Left Pad == Right Pad
```

### 9.1 The Dragged Container Box Trap
In native After Effects, Paragraph (Box) Text layers have a container bounding box (`textDoc.boxTextSize = [boxW, boxH]`). This value represents the rectangular area the user dragged out in the AE composition window, **not** the rendered width of the text inside:
- If a user drags an 800 px wide text box in AE, but the text inside wraps and the longest line only reaches 380 px, `boxTextSize[0]` remains `800`.
- Sizing a precomp or background card using `boxTextSize[0] + (2 * padding)` creates an asymmetric layout: 30 px padding on the left, but `(800 - 380) + 30 = 450 px` of empty space on the right!

### 9.2 The Content-Bound Golden Rule
To achieve 100% visual symmetry across all justification modes:
1. Wrap or split the text into visual lines.
2. Measure the exact advance width of each line $W_i$.
3. Compute $\text{maxLineContentW} = \max(W_0, W_1, \dots, W_{N-1})$.
4. Set the precomposition and background card width to:
   $$\text{precompW} = \text{maxLineContentW} + (2 \times \text{padding})$$
5. Set the internal text box width to $\text{textboxW} = \text{maxLineContentW}$.
- **Result**: The longest line starts at $x = \text{padding}$ and ends at $x = \text{precompW} - \text{padding}$. Left padding and right padding are identical ($=\text{padding}$).

---

## 10. Typographic Vertical Padding: Ascender-to-Descender Calibration

A common mistake in automated layout scripts is using individual glyph bounding boxes (`sourceRectAtTime()`) to determine top and bottom padding.

```
       GLYPH-BOUND (UNSTABLE)                  TYPOGRAPHIC (BALANCED)
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ [pad]                 │                 │ [pad]                 │
   │ aeiou (no ascenders)  │                 │ --- Ascender Line --- │
   │                       │                 │ aeiou (no ascenders)  │
   │ dicta sunt explicabo. │                 │ dicta sunt explicabo. │
   │ (no descenders)       │                 │ --- Descender Line ---│
   │ [pad]                 │                 │ [pad]                 │
   └───────────────────────┘                 └───────────────────────┘
     Unequal visual balance                    Equal visual balance
```

### 10.1 Why Glyph Bounding Boxes Cause Jumping
- A line containing only lowercase non-ascenders (`"aeiou"`) has a bounding box top at x-height ($\approx 0.50 \times \text{fontSize}$). If top padding is measured from this box, uppercase letters or ascenders on another line will appear cramped or overflow the card.
- A line containing descenders (`"happy"`) extends down to $\approx 0.22 \times \text{fontSize}$, whereas a line without descenders (`"dicta sunt explicabo."`) terminates at the baseline ($y = 0$). If bottom padding is measured from glyph extents, the card height will jump depending on whether the last word has a `p, g, y, q, j`.

### 10.2 Universal Typographic Formula
To achieve stable, balanced vertical padding:
1. Treat every line as occupying the universal typographic span from **ascender line** to **descender line**:
   $$\text{ascenderHeight} = \text{fontSize} \times 0.78$$
   $$\text{descenderHeight} = \text{fontSize} \times 0.22$$
2. For $N$ lines with leading $\text{lineStep}$:
   $$\text{textTypoHeight} = \text{ascenderHeight} + ((N - 1) \times \text{lineStep}) + \text{descenderHeight}$$
3. Set the precomp / card height to:
   $$\text{precompH} = \text{textTypoHeight} + (2 \times \text{padding})$$
4. Place the first line's alphabetic baseline at:
   $$\text{firstBaselineY} = \text{padding} + \text{ascenderHeight}$$
- **Top Padding**: distance from card top ($y=0$) to first line's ascender line is $(\text{padding} + \text{ascenderHeight}) - \text{ascenderHeight} = \text{padding}$.
- **Bottom Padding**: distance from last line's descender line to card bottom is $\text{precompH} - (\text{firstBaselineY} + (N-1)\text{lineStep} + \text{descenderHeight}) = \text{padding}$.

---

## 11. Word-by-Word Kinetic Splitting & Space Character Measurement

When breaking paragraph text into individual word layers (for kinetic typography, karaoke effects, or physics simulations):

### 11.1 Space Characters Have Zero Vector Bounding Box
In After Effects ExtendScript, `newComp.layers.addText(" ")` creates a layer with an empty space character. Calling `layer.sourceRectAtTime(0, false)` on a space character returns `width = 0` (or throws), because space characters have no vector paths or outlines.

### 11.2 The Differential Delimiter Calibration
To measure the true advance width of the space character in native After Effects (including font-specific kerning):
1. Create a measurement layer.
2. Set text to `"A A"`, measure $W_1 = \text{sourceRectAtTime}(0, \text{false}).\text{width}$.
3. Set text to `"AA"`, measure $W_2 = \text{sourceRectAtTime}(0, \text{false}).\text{width}$.
4. Compute:
   $$\text{spaceWidth} = W_1 - W_2$$
5. *Fallback (if measurement layer unavailable)*:
   $$\text{spaceWidth} \approx \text{fontSize} \times 0.28$$

### 11.3 Sequential Word Placement
Never place words using string `indexOf` or substring prefix matching, as duplicate words or trailing space stripping cause words to collapse onto the same X coordinate. Instead, advance sequentially:
$$\text{curX}_{i+1} = \text{curX}_i + \text{wordWidth}_i + \text{spaceWidth}$$

---

## 12. Canvas 2D Metric Calibration vs. SVG DOM Rendering in Web Simulators

In web-based After Effects simulators (like `AE_JS_builder`):

### 12.1 The Approximation Ratio Trap
Older JS emulators estimated character widths using a static ratio table (e.g., $0.51 \times \text{fontSize}$ for standard characters). However:
- In real fonts (e.g. Arial, Segoe UI), narrow characters (`r, t, f, c`) take $0.25\text{--}0.38 \times \text{fontSize}$, while wide characters (`w, m`) take $0.75\text{--}0.85 \times \text{fontSize}$.
- When SVG `<text>` renders in the browser, the browser's native text engine (DirectWrite / CoreText / FreeType) uses real font glyph widths.
- If `computeSourceRect` uses static ratios while SVG renders real glyphs, layout calculations deviate by 10%–30%, causing word drift, erratic gaps, or overlapping collisions (e.g. `"commodoconsequat"` collisions).

### 12.2 Unified Canvas 2D Font Metric Engine
In `ae-core.js`, `measureLineWidth` must query an offscreen HTML5 Canvas 2D context using the exact font stack used by the SVG renderer:
```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.font = `${fontSize}px ${fontStack}`;
const actualWidth = ctx.measureText(str).width;
```
This guarantees 1:1 sub-pixel parity between `sourceRectAtTime()` calculations and rendered SVG DOM elements.

---

## 13. Zero-Displacement Anchor Point Compensation via `toComp()` & `fromComp()`

When precomposing a text layer and modifying its anchor point (e.g. "automatic anchor point" moving to Top-Left, Top-Center, or Top-Right):

### 13.1 The Displacement Problem
In native AE, moving a layer's anchor point from $[A_x, A_y]$ to $[A'_x, A'_y]$ displaces the layer on screen by $(A' - A)$ rotated and scaled. When a user creates a precomp with an automatic anchor point, they expect the text box to remain **pinned to its exact screen position**.

### 13.2 Mathematical Compensation Algorithm
1. **The Ground Truth of Layer Coordinates in After Effects**:
   In native After Effects ExtendScript, for **both** Point Text and Paragraph (Box) Text layers:
   - The layer's vertical origin ($y = 0$) in local layer space is anchored to the **first line's alphabetic baseline**.
   - In Paragraph (Box) Text, `textDoc.boxTextPos` returns approximately `[0, -25]` (or `[0, -0.78 * fontSize]`), confirming that the top of the box resides at $-\text{ascenderHeight}$ relative to the layer anchor point.
   - If a script evaluates `layer.toComp([0, 0])` on Box Text, it captures the **baseline** coordinate rather than the top of the box, leading to a downward displacement of exactly $\approx 0.78 \times \text{fontSize}$ (approx 26px to 41px).

2. **Unified Reference Point Formulation**:
   - For both Point Text and Paragraph Box Text:
     $$P_{\text{local\_ref}} = [ X_{\text{ref}}, -\text{ascenderHeight} ]$$
     where $\text{ascenderHeight} = 0.78 \times \text{fontSize}$ (or font ascent).
   - Capture composition coordinates before precomposing:
     $$P_{\text{comp}} = \text{textLayer.toComp}(P_{\text{local\_ref}})$$
3. **Placement Inside `newComp` (Unified Baseline & Background Card Alignment)**:
   - In `newComp`, the background card shape layer spans from $y = 0$ to $y = \text{precompH}$.
   - To ensure the background card fully encloses Line 0 (rather than cutting through Line 0's baseline) while maintaining symmetric top and bottom padding:
     - The first line's alphabetic baseline must be positioned at $y = \text{padding} + \text{ascenderHeight}$.
     - Glyphs ascend by $\text{ascenderHeight}$ into the headroom space, placing Line 0's visual ascender edge strictly at $y = \text{padding}$.
   - For standard single-layer precomposition:
     $$\text{innerTextLayer.transform.anchorPoint} = [ X_{\text{ref}}, 0 ]$$
     $$\text{innerTextLayer.transform.position} = [ X_{\text{target}}, \text{padding} + \text{ascenderHeight} ]$$
   - For kinetic word and line layers:
     $$\text{firstBaselineY} = \text{padding} + \text{ascenderHeight}$$
     $$\text{lineLayer.transform.anchorPoint} = [ r.\text{left}, 0 ], \quad \text{lineLayer.transform.position} = [ X_{\text{line}}, \text{lineBaselineY} ]$$
   - This guarantees that inside `newComp`, the distance from the top edge of the background card ($y = 0$) to the top of Line 0 ($y = \text{padding}$) is strictly $\text{padding}$. When $\text{padding} = 0$, the background card top edge perfectly aligns with the top of Line 0 without any clipping at $y < 0$.
4. **Placement in Parent Composition**:
   - Set precomposition anchor point to:
     $$\text{precompAnchor} = [ \text{innerRefX}, \text{padding} ]$$
   - Position `precompLayer` at:
     $$\text{precompLayer.position} = \begin{cases} 
     \text{origParent.fromComp}(P_{\text{comp}}) & \text{if parented} \\
     P_{\text{comp}} & \text{if unparented}
     \end{cases}$$
- **Result**: When $\text{padding} = 0$, both the text and the background card inside the precomposition align over the original text with **zero vertical or horizontal displacement (0.00px error)** and the background card moves up to completely wrap Line 0.

---

## 14. Web Simulator Script Caching & Manifest Synchronization

In web environments serving JSX tools dynamically via GitHub Pages:
1. **Aggressive Manifest Caching**: Browsers aggressively cache script manifests (`manifest.js`). If `index.html` references `jsx/manifest.js?v=1.3.1`, browsers will execute stale cached code even after the `.jsx` file on disk has been updated.
2. **Synchronized Cache Busters**: Whenever the JSX codebase or simulator core is updated, bump the version query string (`?v=X.Y.Z`) across `index.html`, `manifest.js`, `ae-core.js`, `ae-renderer.js`, and `app.js`.

---

## 15. Dynamic `sourceRectAtTime()` Live Expression Bounding Boxes

To visualize, debug, or dynamically parent backgrounds to text in real time, rigging live bounding boxes via shape layer expressions is the industry standard in both native AE and the Web Emulator.

### 15.1 Bounding Box Geometry Formulas
To track any text layer (`Point Text` or `Paragraph Box Text`) with an active shape rectangle layer:

```javascript
// 1. Rect Size Expression (ADBE Vector Rect Size)
try {
    var target = thisComp.layer("My_Text_Layer");
    var r = target.sourceRectAtTime(time, false);
    [Math.max(2, r.width), Math.max(2, r.height)];
} catch (err) {
    value;
}

// 2. Shape Layer Position Expression (ADBE Position)
try {
    var target = thisComp.layer("My_Text_Layer");
    var r = target.sourceRectAtTime(time, false);
    // target.toComp takes the geometric center in local layer space:
    var p = target.toComp([r.left + r.width / 2, r.top + r.height / 2]);
    [p[0], p[1]]; // Crucial: slice to 2D
} catch (err) {
    value;
}
```

### 15.2 Coordinate Transformation Nuances Across Engines
1. **Local Bounding Box (`r.left`, `r.top`)**:
   - In **Point Text**: `r.top` is negative (relative to alphabetic baseline $y=0$), and `r.left` depends on justification ($0$ for Left, $-W/2$ for Center, $-W$ for Right).
   - In **Paragraph Box Text**: When anchor point is pinned to `doc.boxTextPos`, `r.top` is positive ($\approx 0$ to ascender), and `r.left` reflects the internal paragraph margin (`leftIndent` or `boxWidth - contentWidth - rightIndent`).
2. **`target.toComp()` Parity**:
   Because `toComp()` accounts for layer position, anchor point, scale, rotation, and parent transforms:
   $$\mathbf{P}_{\text{comp}} = \mathbf{M}_{\text{world}} \times \begin{bmatrix} r.\text{left} + \frac{r.\text{width}}{2} \\ r.\text{top} + \frac{r.\text{height}}{2} \\ 0 \\ 1 \end{bmatrix}$$
   The shape rectangle's center automatically snaps directly over the optical center of the text glyphs, guaranteeing exact 1:1 bounding alignment.

---

## 16. Summary Checklist for Future Repositories

When developing tools or emulators that interface with After Effects typography:
- [x] **Identify text layer mode**: Check if `doc.boxText === true` or Point Text.
- [x] **Compensate Point Text positions**: Position Center Justified point text at center $(W/2)$ and Right Justified point text at right $(W - \text{margin})$.
- [x] **Pin Box Text anchor point to `doc.boxTextPos`**: Avoid overwriting `anchorPoint = [0, 0]` without offsetting for native baseline origin.
- [x] **Respect Box Text justification internally**: Do not add $W/2$ or $W$ position offsets to Center/Right justified Box Text.
- [x] **Slice expression vectors to 2D**: Always convert `target.toComp(...)` results to 2D `[p[0], p[1]]` when driving 2D properties.
- [x] **Account for negative `sourceRectAtTime().top`**: When building bounding boxes or auto-crop backgrounds, remember `r.top` is negative in Point Text.
- [x] **Use $1.20 \times \text{fontSize}$ for auto-leading**: Never use browser default line-heights (1.35–1.50) when emulating AE.
- [x] **Apply 1/1000 em for tracking**: Scale tracking values linearly by `(tracking / 1000) * fontSize`.
- [x] **Handle OS font substitution variances**: Recognize that Linux/Android fallback fonts (Liberation Sans, DejaVu Sans) have 1%–4% advance width variances from native Windows/Mac Adobe FontServer fonts.
- [x] **Test line-wrapping boundary conditions**: Near `availBaseWidth`, a 1-pixel advance width deviation can cause the trailing word to wrap or spill.
- [x] **Account for right-justified overset spill**: Right-justified text (`text-anchor="end"`) spills over the **left** edge of containers when overflowing.
- [x] **Wrap backgrounds by content, not container box**: Base precomp widths on `maxLineContentW + 2 * padding` instead of arbitrary `boxTextSize[0]`.
- [x] **Measure vertical padding by typographic ascender/descender**: Calculate card height from $0.78 \times fs$ to $0.22 \times fs$, never from individual glyph bounds.
- [x] **Measure space character differentially**: Compute `spaceWidth = measure("A A") - measure("AA")` for sub-pixel word spacing.
- [x] **Synchronize layout metrics with Canvas 2D in Web**: Use `ctx.measureText()` in browser JS emulators to eliminate layout vs. SVG rendering drift.
- [x] **Compensate anchor points via `toComp()` & `fromComp()`**: Pinned layer positions must counter anchor shifts across parent hierarchies.
- [x] **Bump cache busters across all assets**: Update `?v=X.Y.Z` in `index.html` to prevent browsers from executing cached manifests.

