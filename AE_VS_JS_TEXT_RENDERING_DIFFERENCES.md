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

<<<<<<< HEAD
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

## 16. Universal 9-Point Zero-Shift Anchor Alignment Architecture (`AE_Align_Anchor_Point.jsx`)

Anchoring text layers and precompositions dynamically without visual displacement requires addressing the interplay between After Effects' typographic coordinate system, affine transform matrices, and layer parenting hierarchies. This section documents the zero-shift alignment engine based on `AE_Align_Anchor_Point.jsx` and incorporated into `AE_Text_Precomp.jsx`.

### 16.1 Affine Zero-Shift Mathematical Model

When shifting a layer's anchor point from $\mathbf{A}_{\text{orig}} = [A_x, A_y]$ to a target coordinate $\mathbf{A}_{\text{target}} = [A'_x, A'_y]$, the visual content on screen displaces unless the layer's position $\mathbf{P}$ is compensated.

1. **Local Delta**:
   $$\Delta \mathbf{A} = [A'_x - A_x, \; A'_y - A_y]$$

2. **Scale and Rotation Transformation**:
   In local layer coordinates, the displacement scaled by the layer's scale factor $\mathbf{S} = [s_x, s_y] = [\text{scale}[0]/100, \; \text{scale}[1]/100]$ is:
   $$\Delta \mathbf{P}_{\text{local}} = [\Delta A_x \cdot s_x, \; \Delta A_y \cdot s_y]$$

   Accounting for layer rotation $\theta$ (in radians $\theta = \text{rot} \cdot \pi / 180$):
   $$\Delta P_x = \Delta \mathbf{P}_{\text{local}}[0] \cos\theta - \Delta \mathbf{P}_{\text{local}}[1] \sin\theta$$
   $$\Delta P_y = \Delta \mathbf{P}_{\text{local}}[0] \sin\theta + \Delta \mathbf{P}_{\text{local}}[1] \cos\theta$$

3. **Parent Hierarchy Compensation**:
   If the layer has a parent layer `layer.parent`, the composition-space position $\mathbf{P}_{\text{comp}} = \mathbf{P}_{\text{world}} + [\Delta P_x, \Delta P_y]$ must be converted back to the parent's local coordinate space:
   $$\mathbf{P}_{\text{final}} = \begin{cases}
   \text{origParent.fromComp}(\mathbf{P}_{\text{comp}}) & \text{if parent exists} \\
   \mathbf{P}_{\text{comp}} & \text{otherwise}
   \end{cases}$$

### 16.2 Bounding Box Duality: `sourceRectAtTime()` vs `Stated Dimensions`

After Effects evaluates boundaries differently depending on whether dynamic glyph paths or nominal box boundaries are used:

| Method | Characteristics | When to Use |
| :--- | :--- | :--- |
| **`sourceRectAtTime(time, false)`** | Evaluates the tight bounding box of visible rendered pixels/vectors at the given composition time. Shrinks or grows dynamically as text changes. | Organic text boxes, point text, dynamic typography badges, animated subtitle banners. |
| **`Stated Dimensions`** | Evaluates nominal declared dimensions: `doc.boxTextSize`, `doc.boxTextPos`, `layer.source.width/height`, or shape rectangle vector sizes. Constant regardless of inner text content. | Paragraph text boxes (preserving user box bounds), fixed UI cards, precompositions, solids. |

#### Paragraph Box Text Top-Left Reference:
In native After Effects, Paragraph (Box) Text layers have an intrinsic offset stored in `boxTextPos`:
- `boxTextPos[0]` = horizontal offset from insertion anchor to left margin (typically 0).
- `boxTextPos[1]` = vertical offset from insertion anchor to top margin (typically $-\text{ascenderHeight} \approx -0.78 \times \text{fontSize}$).
Therefore, the true top-left corner of the stated box text in local coordinates is:
$$\mathbf{X}_{\text{top-left}} = [ \text{doc.boxTextPos}[0], \; \text{doc.boxTextPos}[1] ]$$
Using $[0, 0]$ for box text alignment targets the **first line's baseline**, NOT the top of the box!

### 16.3 9-Point Alignment Preset Matrix

The 9 alignment presets evaluate horizontal ($X$) and vertical ($Y$) anchors from bounds $[L, T, W, H]$:

$$\mathbf{A}_{\text{target}}(X_{\text{mode}}, Y_{\text{mode}}) = \left[ L + f_x(X_{\text{mode}}) \cdot W, \; T + f_y(Y_{\text{mode}}) \cdot H \right]$$

where:
- $f_x(\text{Left}) = 0.0, \quad f_x(\text{Center}) = 0.5, \quad f_x(\text{Right}) = 1.0$
- $f_y(\text{Top}) = 0.0, \quad f_y(\text{Center}) = 0.5, \quad f_y(\text{Bottom}) = 1.0$

### 16.4 Content-Relative vs Canvas-Relative Reference Frames in Precomps

When precomposing text with padding $p$, two reference frames are available for anchor placement:

1. **Text Content Box Reference** (`anchorReference = "content"`):
   - Bounds: $[L, T, W, H] = [p, p, W_{\text{text}}, H_{\text{text}}]$.
   - Top-Left anchor: $[p, p]$.
   - Center anchor: $[p + W_{\text{text}}/2, \; p + H_{\text{text}}/2]$.
   - Ideal for kinetic text animators where secondary scaling or rotation must pivot directly around the typography itself, ignoring asymmetric padding.

2. **Precomp Canvas / Card Reference** (`anchorReference = "canvas"`):
   - Bounds: $[L, T, W, H] = [0, 0, W_{\text{precomp}}, H_{\text{precomp}}]$.
   - Top-Left anchor: $[0, 0]$.
   - Center anchor: $[W_{\text{precomp}}/2, \; H_{\text{precomp}}/2]$.
   - Ideal for UI cards, dialog bubbles, and motion graphics plates where the outer boundary of the background card governs layout alignment.

### 16.5 Procedural Guideline Anchor Reticle (`attachAnchorCross`)

To assist animators in visually verifying anchor alignment without affecting renders:
1. A vector shape layer is generated procedural with a crosshair (horizontal bar, vertical bar, center pivot dot, and outer reticle ring).
2. The reticle layer is parented directly to the target layer with:
   $$\text{crossLayer.transform.anchorPoint} = [0, 0, 0]$$
   $$\text{crossLayer.transform.position} = [0, 0, 0]$$
3. Because child layers evaluate local $[0, 0]$ at their parent's anchor point, the crosshair is permanently pinned to the parent's pivot point across all keyframed animations.
4. Setting `crossLayer.guideLayer = true` ensures it is visible in the viewport but completely excluded from After Effects renders and exports.

### 16.6 State Persistence via Effect Controls

To prevent loss of semantic alignment intent across script sessions, effect slider controls are attached to the layer (`ADBE Effect Parade`):
- `Anchor Align X`: Slider control storing $0$ (Left), $1$ (Center), or $2$ (Right).
- `Anchor Align Y`: Slider control storing $0$ (Top), $1$ (Center), or $2$ (Bottom).
- `Anchor Bounds Mode`: Slider control storing $0$ (`sourceRect`) or $1$ (`stated`).
- `Anchor Base Point`: 2D Point control storing $[\mathbf{A}_{\text{base}}[0], \mathbf{A}_{\text{base}}[1]]$ for scale-safe dynamic expressions.

---

## 17. ExtendScript Text Document Cloning & Font Substitution Prevention

When decomposing text layers into sub-strings in After Effects—such as in kinetic typography engines dividing text by lines (`divideMode === "lines"`) or words (`divideMode === "words"`)—scripting faces a critical font-binding trap where new layers unexpectedly revert to application defaults (e.g., ArialMT or MyriadPro) or substitute fonts.

### 17.1 The PostScript Name vs. Font Object Architecture (AE 24.0+)

Historically in ExtendScript, text typography was accessed through:
- `TextDocument.font` (String): The PostScript name of the typeface (e.g., `"Poppins-SemiBold"`, `"HelveticaNeue-Light"`).

According to the official Adobe After Effects Scripting Guide:
> *"On write, there are very few restrictions on what can be supplied - if the underlying font management system does not have a matching Font object instance matching the supplied PostScript name a substitute instance will be created. You should use the Font object attribute for precise control."*

Starting in After Effects 24.0 (CC 2024), Adobe introduced:
- `TextDocument.fontObject` (Font object): Read/write attribute that binds directly to the specific font instance.
- `app.fonts` (`FontsObject`): Provides access to the font environment, allowing enumeration and resolution via `getFontsByPostScriptName()` and `getFontsByFamilyNameAndStyleName()`.

If a script creates a new text layer with `comp.layers.addText()` and sets `doc.font = sampleDoc.font` without updating `doc.fontObject`, one of two failures occurs:
1. **Silent Fallback**: In AE 24+, `doc.fontObject` retains the application's default font (e.g., ArialMT). Because `fontObject` takes precedence over the PostScript string, setting `doc.font` alone is either ignored or overridden.
2. **Substitute Instance Creation**: If the PostScript string cannot be unambiguously matched to the active font manager cache (common with OTF fonts, variable fonts, and Adobe Fonts / Typekit subscriptions), After Effects quietly fabricates an internal font proxy (`isSubstitute === true`), substituting an unrelated typeface without throwing a script exception.

### 17.2 The `addText()` Kinetic Typography Trap

When dividing text into lines or words:
1. `comp.layers.addText(textContent)` initializes a new Point Text layer with the user's current Character Panel defaults.
2. Reading `var doc = targetLayer.property("Source Text").value` returns a `TextDocument` pre-populated with those defaults.
3. Cherry-picking only `doc.font` and `doc.fontSize` leaves all other properties (`fontObject`, `tracking`, `fauxBold`, `fauxItalic`, `fontCapsOption`, `ligature`, `autoKernType`, `strokeOverFill`) detached from the source layer.

### 17.3 The Dual-Strategy Cloning Pattern

To guarantee 100% typographic fidelity with zero font substitution, modern ExtendScript tools must employ a **dual-strategy cloning pattern**:

```javascript
function applyTextDocStyling(targetLayer, sampleDoc, textContent, sourceLayer) {
    if (!targetLayer) return;
    try {
        var prop = targetLayer.property("Source Text");
        if (!prop) return;

        // Strategy 1: Direct native TextDocument assignment for Point Text
        // Setting a cloned TextDocument directly preserves 100% font identity, fontObject,
        // kerning, tracking, faux styles, and fills without triggering AE's font substitution.
        var directDone = false;
        try {
            var docToSet = null;
            if (sourceLayer && isTextLayer(sourceLayer)) {
                var sProp = sourceLayer.property("Source Text");
                if (sProp && sProp.value) docToSet = sProp.value;
            } else if (sampleDoc && !sampleDoc.boxText) {
                docToSet = sampleDoc;
            }

            if (docToSet && !docToSet.boxText) {
                docToSet.text = textContent;
                prop.setValue(docToSet);
                var vCheck = prop.value;
                if (vCheck && vCheck.text === textContent) {
                    directDone = true;
                }
            }
        } catch (eDir) {
            directDone = false;
        }

        if (directDone) return;

        // Strategy 2: Multi-Tier Attribute Transfer with FontObject Priority
        var doc = prop.value;
        doc.text = textContent;

        if (sampleDoc) {
            // Tier 1: Direct Font Object assignment (AE 24+ — zero substitution)
            var fontApplied = false;
            if (sampleDoc.fontObject) {
                try {
                    doc.fontObject = sampleDoc.fontObject;
                    fontApplied = true;
                } catch (eFO) { fontApplied = false; }
            }

            // Tier 2: Query Font Server via app.fonts (AE 24+)
            if (!fontApplied && typeof app !== "undefined" && app.fonts) {
                try {
                    if (sampleDoc.font && typeof app.fonts.getFontsByPostScriptName === "function") {
                        var matchedFonts = app.fonts.getFontsByPostScriptName(sampleDoc.font);
                        if (matchedFonts && matchedFonts.length > 0) {
                            doc.fontObject = matchedFonts[0];
                            fontApplied = true;
                        }
                    }
                } catch (eFMatch) {}

                if (!fontApplied && sampleDoc.fontFamily && typeof app.fonts.getFontsByFamilyNameAndStyleName === "function") {
                    try {
                        var matchedFonts2 = app.fonts.getFontsByFamilyNameAndStyleName(
                            sampleDoc.fontFamily, sampleDoc.fontStyle || "Regular"
                        );
                        if (matchedFonts2 && matchedFonts2.length > 0) {
                            doc.fontObject = matchedFonts2[0];
                            fontApplied = true;
                        }
                    } catch (eFMatch2) {}
                }
            }

            // Tier 3: PostScript font name fallback (Legacy AE CS6 - CC 2023)
            if (!fontApplied && sampleDoc.font) {
                try {
                    doc.font = sampleDoc.font;
                    fontApplied = true;
                } catch (eF) {}
            }

            // Typography Metrics & Character Attributes
            if (typeof sampleDoc.fontSize === "number" && sampleDoc.fontSize > 0) doc.fontSize = sampleDoc.fontSize;
            if (typeof sampleDoc.applyFill !== "undefined") doc.applyFill = sampleDoc.applyFill;
            if (sampleDoc.applyFill && sampleDoc.fillColor) {
                try { doc.fillColor = sampleDoc.fillColor; } catch (eFC) {}
            }
            if (typeof sampleDoc.applyStroke !== "undefined") doc.applyStroke = sampleDoc.applyStroke;
            if (sampleDoc.applyStroke && sampleDoc.strokeColor) {
                try {
                    doc.strokeColor = sampleDoc.strokeColor;
                    if (typeof sampleDoc.strokeWidth === "number") doc.strokeWidth = sampleDoc.strokeWidth;
                } catch (eSC) {}
            }
            if (typeof sampleDoc.strokeOverFill !== "undefined") {
                try { doc.strokeOverFill = sampleDoc.strokeOverFill; } catch (eSOF) {}
            }
            if (typeof sampleDoc.tracking !== "undefined") doc.tracking = sampleDoc.tracking;
            if (typeof sampleDoc.leading !== "undefined") doc.leading = sampleDoc.leading;
            if (typeof sampleDoc.autoLeading !== "undefined") doc.autoLeading = sampleDoc.autoLeading;
            if (typeof sampleDoc.baselineShift !== "undefined") doc.baselineShift = sampleDoc.baselineShift;
            if (typeof sampleDoc.horizontalScale !== "undefined") doc.horizontalScale = sampleDoc.horizontalScale;
            if (typeof sampleDoc.verticalScale !== "undefined") doc.verticalScale = sampleDoc.verticalScale;
            if (typeof sampleDoc.tsume !== "undefined") doc.tsume = sampleDoc.tsume;

            // Faux Styles & OpenType
            if (typeof sampleDoc.fontCapsOption !== "undefined") {
                try { doc.fontCapsOption = sampleDoc.fontCapsOption; } catch (eFCO) {}
            } else if (typeof sampleDoc.allCaps !== "undefined") {
                try { doc.allCaps = sampleDoc.allCaps; } catch (eAC) {}
            }
            if (typeof sampleDoc.smallCaps !== "undefined") {
                try { doc.smallCaps = sampleDoc.smallCaps; } catch (eSmC) {}
            }
            if (typeof sampleDoc.fauxBold !== "undefined") doc.fauxBold = sampleDoc.fauxBold;
            if (typeof sampleDoc.fauxItalic !== "undefined") doc.fauxItalic = sampleDoc.fauxItalic;
            if (typeof sampleDoc.fontBaselineOption !== "undefined") {
                try { doc.fontBaselineOption = sampleDoc.fontBaselineOption; } catch (eFBO) {}
            }
            if (typeof sampleDoc.autoKernType !== "undefined") {
                try { doc.autoKernType = sampleDoc.autoKernType; } catch (eAKT) {}
            }
            if (typeof sampleDoc.ligature !== "undefined") {
                try { doc.ligature = sampleDoc.ligature; } catch (eLig) {}
            }
        }

        prop.setValue(doc);
    } catch (eStyle) {}
}
```

### 17.4 Hidden Measurement Layer Font Synchronization

Before dividing words and lines, kinetic layout engines instantiate a hidden measurement layer (`measureLayer.enabled = false`) to calculate individual word advances and differential space widths (`measure("A A") - measure("AA")`).

If `measureLayer` is not explicitly styled via `applyTextDocStyling` before calling `measureLayer.sourceRectAtTime(0, false)`, all advance widths are computed against the application's default font. Consequently:
- Word boundaries wrap at incorrect word counts.
- Right-aligned or centered kinetic lines experience erratic visual jitter because `(textboxW - lineW) / 2` calculates with default font metrics while lines render with the true font.

### 17.5 Pristine Document Capture Before Precomposing

When calling `comp.layers.precompose([textLayer.index], ...)`, After Effects restructures the composition hierarchy and moves the text layer into the new precomp. To safeguard against any loss of document state or index shifts:
```javascript
// Pre-capture pristine TextDocument before precompose hierarchy mutation
var precompOrigDoc = getTextDocument(textLayer);
var newComp = comp.layers.precompose([textLayer.index], precompName, true);

// Resolve inner text layer inside new comp
var innerTextLayer = newComp.layer(1);
var origDoc = getTextDocument(innerTextLayer) || precompOrigDoc;
```

---

## 18. Summary Checklist for Future Repositories

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
- [x] **Implement 9-point zero-shift affine invariance**: Scale and rotation-compensate anchor point modifications using local and parent matrices.
- [x] **Support dual bounds methods**: Offer both dynamic `sourceRectAtTime()` and nominal `stated` box dimensions.
- [x] **Provide non-rendering reticle guides**: Use `guideLayer = true` parented at $[0, 0]$ to visualize anchor points in viewports.
- [x] **Store alignment state in Effect Controls**: Embed slider/point controls on layers to persist alignment configuration.
- [x] **Assign `TextDocument.fontObject` in AE 24+**: Always prioritize `doc.fontObject = sampleDoc.fontObject` over `doc.font` to prevent AE's silent font substitution proxy creation.
- [x] **Use multi-tier font resolution hierarchy**: Resolve fonts through `fontObject` -> `app.fonts.getFontsByPostScriptName` -> `app.fonts.getFontsByFamilyNameAndStyleName` -> PostScript `doc.font`.
- [x] **Style measurement layers prior to `sourceRectAtTime`**: Ensure hidden measuring layers inherit exact font metrics to prevent word wrapping and padding misalignments.
- [x] **Bump cache busters across all assets**: Update `?v=X.Y.Z` in `index.html` to prevent browsers from executing cached manifests.



---

## 19. Modern After Effects Text Properties & Scripting Changelog (AE 24.0 through CC 2026+)

With the release of After Effects 24.0, 24.2, 24.3, 24.6, and CC 2025/2026, Adobe significantly overhauled the `TextDocument` DOM and JS Expression Engine, adding native properties for paragraph box overflow, insets, vertical alignment, first baseline alignment, auto-fit policies, line orientation, paragraph indentation, paragraph spacing, and composed line/paragraph counters.

### 19.1 Comprehensive Properties Specification Matrix

| Property Name | Access | Data Type | AE Version | Expressions Engine (`text.sourceText`) | ExtendScript DOM (`TextDocument`) | Web JS / Canvas Equivalent | Official Adobe Documentation Link |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`text_type`** | `[RO]` | Integer `0` / `1` | All | `st.isParagraphText ? 1 : 0` (AE 25+) | `textDoc.boxText ? 1 : 0` | Check if canvas renderer wraps text to bounding box | [TextDocument.boxText](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtext) |
| **`box_is_box`** | `[RO]` | Boolean | All | `st.isParagraphText` (AE 25+) | `textDoc.boxText` | `Boolean(boxWidth > 0)` | [TextDocument.boxText](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtext) |
| **`box_overflow`** | `[RO]` | Boolean | **AE 24.6+** | `st.boxOverflow` / `st.style.boxOverflow` | `textDoc.boxOverflow` | `measuredHeight > boxHeight \|\| measuredWidth > boxWidth` | [TextDocument.boxOverflow](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxoverflow) |
| **`box_width`** | `[R/W]` | Float (px) | All | `st.style.boxTextSize[0]` | `textDoc.boxTextSize[0]` | Maximum wrapping width `maxWidth` in Canvas | [TextDocument.boxTextSize](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtextsize) |
| **`box_height`** | `[R/W]` | Float (px) | All | `st.style.boxTextSize[1]` | `textDoc.boxTextSize[1]` | Maximum box height `maxHeight` in Canvas | [TextDocument.boxTextSize](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtextsize) |
| **`box_size`** | `[R/W]` | `[Float, Float]` | All | `st.style.boxTextSize` | `textDoc.boxTextSize` | `[boxWidth, boxHeight]` 2D boundary | [TextDocument.boxTextSize](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxtextsize) |
| **`box_inset_spacing`** | `[R/W]` | Float (px) | **AE 24.6+** | `st.boxInsetSpacing` | `textDoc.boxInsetSpacing` | CSS `padding` or Canvas coordinate inset offset | [TextDocument.boxInsetSpacing](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxinsetspacing) |
| **`box_vertical_align`**| `[R/W]` | Enum / Int | **AE 24.6+** | `st.boxVerticalAlignment` | `textDoc.boxVerticalAlignment` | CSS `align-items` / Canvas Y-offset calculation | [TextDocument.boxVerticalAlignment](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxverticalalignment) |
| **`box_first_baseline`**| `[R/W]` | Enum / Int | **AE 24.6+** | `st.boxFirstBaselineAlignment` | `textDoc.boxFirstBaselineAlignment` | Canvas `ctx.textBaseline = alphabetic/top` | [TextDocument.boxFirstBaselineAlignment](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxfirstbaselinealignment) |
| **`box_auto_fit`** | `[R/W]` | Enum / Int | **AE 24.6+** | `st.boxAutoFitPolicy` | `textDoc.boxAutoFitPolicy` | Dynamic font-scale down loop to fit box | [TextDocument.boxAutoFitPolicy](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-boxautofitpolicy) |
| **`line_orientation`** | `[R/W]` | Enum / Int | **AE 24.2+** | `st.lineOrientation` | `textDoc.lineOrientation` | CSS `writing-mode: vertical-rl` / Canvas vertical rendering | [TextDocument.lineOrientation](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-lineorientation) |
| **`first_line_indent`** | `[R/W]` | Float (px) | **AE 24.0+** | `st.firstLineIndent` | `textDoc.firstLineIndent` | CSS `text-indent` / First line X-offset in Canvas | [TextDocument.firstLineIndent](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-firstlineindent) |
| **`start_indent`** | `[R/W]` | Float (px) | **AE 24.0+** | `st.startIndent` | `textDoc.startIndent` | CSS `margin-left` (LTR) / Canvas line left margin | [TextDocument.startIndent](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-startindent) |
| **`end_indent`** | `[R/W]` | Float (px) | **AE 24.0+** | `st.endIndent` | `textDoc.endIndent` | CSS `margin-right` / Right boundary margin | [TextDocument.endIndent](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-endindent) |
| **`space_before`** | `[R/W]` | Float (px) | **AE 24.0+** | `st.spaceBefore` | `textDoc.spaceBefore` | CSS `margin-top` / Extra Y-delta before paragraph | [TextDocument.spaceBefore](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-spacebefore) |
| **`space_after`** | `[R/W]` | Float (px) | **AE 24.0+** | `st.spaceAfter` | `textDoc.spaceAfter` | CSS `margin-bottom` / Extra Y-delta after paragraph | [TextDocument.spaceAfter](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-spaceafter) |
| **`auto_hyphenate`** | `[R/W]` | Boolean | **AE 24.0+** | `st.autoHyphenate` | `textDoc.autoHyphenate` | CSS `hyphens: auto` / Hyphenation dictionary shaper | [TextDocument.autoHyphenate](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-autohyphenate) |
| **`hanging_roman`** | `[R/W]` | Boolean | **AE 24.0+** | `st.hangingRoman` | `textDoc.hangingRoman` | CSS `hanging-punctuation: first last` | [TextDocument.hangingRoman](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-hangingroman) |
| **`every_line_composer`**| `[R/W]`| Boolean | **AE 24.0+** | `st.everyLineComposer` | `textDoc.everyLineComposer` | Knuth-Plass multi-line optimization algorithm | [TextDocument.everyLineComposer](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-everylinecomposer) |
| **`composedLineCount`** | `[RO]` | Integer | **AE 24.3+** | `st.composedLineCount` | `textDoc.composedLineCount` | Calculated array length `wrappedLines.length` | [TextDocument.composedLineCount](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-composedlinecount) |
| **`paragraphCount`** | `[RO]` | Integer | **AE 24.3+** | `st.paragraphCount` | `textDoc.paragraphCount` | `text.split(/\r\n|\r|\n/).length` | [TextDocument.paragraphCount](https://ae-scripting.docsforadobe.dev/text/textdocument/#textdocument-paragraphcount) |

### 19.2 Paragraph Box Dimensions, Overflow & Insets
- **`boxOverflow` [RO]**:
  Returns `true` when the rendered typography exceeds the height or width of the bounding paragraph frame. This is invaluable for responsive kinetic typography rigs (e.g. automatically shrinking font size when overset occurs).
- **`boxInsetSpacing` [R/W]**:
  Specifies the internal padding offset in pixels between the box frame borders and the text glyphs.
- **`boxAutoFitPolicy` [R/W]**:
  - `7712` (`BoxAutoFitPolicy.NONE`): Fixed box and fixed font size.
  - `7713` (`BoxAutoFitPolicy.FIT_FONT_SIZE_TO_BOX`): Dynamically scales down font size until all text fits within the box frame without overflow.
  - `7714` (`BoxAutoFitPolicy.FIT_BOX_TO_TEXT`): Automatically adjusts the box frame dimensions to hug the rendered text content.

### 19.3 Vertical Alignment & Baseline Policies
- **`boxVerticalAlignment` [R/W]**:
  - `7512` (`BoxVerticalAlignment.TOP`): Text lines stack downward from the top inset margin.
  - `7513` (`BoxVerticalAlignment.CENTER`): Text block is vertically centered inside `boxTextSize[1]`.
  - `7514` (`BoxVerticalAlignment.BOTTOM`): Text block rests on the bottom inset margin.
  - `7515` (`BoxVerticalAlignment.JUSTIFY`): Leading expands dynamically to distribute lines evenly across the full box height.
- **`boxFirstBaselineAlignment` [R/W]**:
  Controls the vertical distance between the top of the box and the baseline of the first line of text.
  - `7612` (`ASCENT`): Font ascender height.
  - `7613` (`CAP_HEIGHT`): Font cap-height.
  - `7614` (`LEADING`): Font leading value.
  - `7615` (`X_HEIGHT`): Lowercase x-height.
  - `7616` (`LOW_CAP`): Small-caps baseline.
  - `7617` (`FIXED`): Minimum fixed offset defined by `boxFirstBaselineAlignmentMinimum`.
  - `7618` (`PROPORTIONAL`): Proportional scaling based on font metrics.

### 19.4 Text Orientation & Writing Modes
- **`lineOrientation` [R/W]**:
  - `7312` (`LineOrientation.HORIZONTAL`): Standard horizontal text layout (LTR / RTL).
  - `7313` (`LineOrientation.VERTICAL_RIGHT_TO_LEFT`): Traditional East Asian vertical layout flowing columns right-to-left.
  - `7314` (`LineOrientation.VERTICAL_LEFT_TO_RIGHT`): Vertical layout flowing columns left-to-right (Mongolian).

### 19.5 Paragraph Formatting, Indents & Spacing
- **`firstLineIndent` [R/W]**: Horizontal indentation in pixels applied only to the first line of each paragraph.
- **`startIndent` [R/W]**: Margin offset in pixels applied to the left (or reading start) of all lines in the paragraph.
- **`endIndent` [R/W]**: Margin offset in pixels applied to the right (or reading end) of all lines in the paragraph.
- **`spaceBefore` [R/W]**: Additional vertical whitespace in pixels preceding the first line of a paragraph.
- **`spaceAfter` [R/W]**: Additional vertical whitespace in pixels succeeding the last line of a paragraph.

### 19.6 Hyphenation & Composers
- **`autoHyphenate` [R/W]**: Enables or disables dictionary-based hyphenation at line breaks.
- **`hangingRoman` [R/W]**: Hangs punctuation marks (quotes, hyphens, periods) outside the paragraph box margin to preserve visual margin alignment.
- **`everyLineComposer` [R/W]**: When `true`, uses the multi-line Knuth-Plass global optimizer to distribute hyphenation and justification evenly across entire paragraphs rather than line-by-line greedy fitting.

### 19.7 Composed Line & Paragraph Counters
- **`composedLineCount` [RO]**:
  Returns the exact total count of composed lines generated by After Effects, including lines resulting from automatic paragraph box wrapping. This completely supersedes hacky height-divided-by-leading expression estimates.
- **`paragraphCount` [RO]**:
  Returns the count of distinct paragraphs separated by hard carriage returns (`\r`, `\n`).

### 19.8 Official Adobe Documentation & API Reference Links
1. **Adobe After Effects Scripting Guide — TextDocument**:  
   https://ae-scripting.docsforadobe.dev/text/textdocument/
2. **Adobe After Effects Scripting Guide — Changelog**:  
   https://ae-scripting.docsforadobe.dev/introduction/changelog/
3. **Adobe After Effects Expressions Language Reference — Text Properties**:  
   https://helpx.adobe.com/after-effects/using/expression-language-reference.html#text_properties
4. **Layer `sourceRectAtTime()` API Specification**:  
   https://ae-scripting.docsforadobe.dev/layers/layer/#layer-sourcerectattime

---

## 20. Exact Sub-Pixel Word & Character Bounding Box Geometries (Highlight Rigging Architecture)

When building procedural typography highlighters, kinetic subtitle boxes, callouts, or search-and-replace decorators in Adobe After Effects without decomposing or splitting text layers (Calculation Method), scripts must calculate the exact pixel position of specific words, phrases, or individual characters.

Unlike Web DOM elements with `Range.getBoundingClientRect()`, After Effects does **not** provide a native `getCharRect(index)` or `getWordRect(index)` API. Solving this requires strict mathematical modeling across both Point Text and Paragraph Box Text engines.

```
       PARENT TEXT LAYER (Top-Left Anchor Point [sRect.left, sRect.top])
       ┌─────────────────────────────────────────────────────────────┐  y = 0 (Top Bound)
       │  Line 0: "Lorem [ipsum] dolor sit amet"                     │  lineTop = 0 * lineStep
       │                 ▲                                           │  centerY = lineTop + fontSize/2
       │                 │ Highlight Pill Shape                      │
       │  Line 1: "consectetur adipiscing elit..."                   │  lineTop = 1 * lineStep
       └─────────────────────────────────────────────────────────────┘  y = totalContentHeight
```

### 20.1 The Parent Coordinate System Trap (Double-Offsetting)

When creating a child procedural Shape Layer for highlight rectangles and parenting it to the text layer:
```javascript
shapeLayer.parent = textLayer;
shapeLayer.transform.position.setValue([0, 0, 0]);
shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
```
In After Effects transform geometry, when child layer `shapeLayer` has `position = [0, 0, 0]`, its local origin $(0, 0)$ is placed **directly at `textLayer.anchorPoint`**.

#### The Vertical Double-Offset Trap
1. In Point Text, `sourceRectAtTime().top` is **negative** ($-\text{ascender}$, approx. $-0.78 \times \text{fontSize}$).
2. When the text layer anchor point is aligned to Top-Left, `textLayer.anchorPoint.y = sRect.top = -\text{ascender}`.
3. If the script calculates baseline $y = \text{lineIndex} \times \text{lineStep}$ and sets rect position to `baselineY - ascender`, the rendered position in comp space becomes:
   $$Y_{\text{rendered}} = \text{anchorPoint.y} + Y_{\text{rect}} = (-\text{ascender}) + (-\text{ascender}) = -2 \times \text{ascender}$$
   **Result**: Highlights float in empty space one full font size above the text line!

#### The Horizontal Justification Double-Offset Trap
1. In Center-Justified Point Text, `sourceRectAtTime().left = -\frac{\text{maxLineWidth}}{2}`.
2. The Top-Left aligned anchor point is $x = -\frac{\text{maxLineWidth}}{2}$.
3. If the script also offsets the line by $-\frac{\text{lineWidth}}{2}$, the child shape layer applies $-\frac{\text{maxLineWidth}}{2}$ **twice**.
   **Result**: Highlights are displaced hundreds of pixels to the left outside the text container!

---

### 20.2 Unified Bounding Box Formulas (Point & Box Text Invariant)

To guarantee 100% precision regardless of whether the layer is Point Text or Paragraph Box Text, Left, Center, or Right justified:

Let:
- $\text{contentWidth} = \begin{cases} \text{doc.boxTextSize[0]} & \text{if Paragraph Box Text} \\ \text{sRect.width} & \text{if Point Text} \end{cases}$
- $\text{boxHeight} = \text{fontSize}$
- $\text{lineTop} = \text{lineIndex} \times \text{lineStep}$ (where $\text{lineStep} = \text{doc.leading} \parallel \text{fontSize} \times 1.2$)

#### 1. Visual Line Horizontal Origin ($\text{lineLeft}$)
Relative to the top-left boundary frame:
$$\text{lineLeft} = \begin{cases}
0 & \text{if Left Justified} \\
\max\left(0, \frac{\text{contentWidth} - \text{lineWidth}}{2}\right) & \text{if Center Justified} \\
\max\left(0, \text{contentWidth} - \text{lineWidth}\right) & \text{if Right Justified}
\end{cases}$$

#### 2. Visual Line Vertical Center ($\text{boxCenterY}$)
$$\text{boxCenterY} = \text{lineTop} + \frac{\text{boxHeight}}{2}$$

---

### 20.3 Differential Delimiter-Anchored Prefix Measurement

Measuring words in isolation (e.g. `measureText("ipsum")`) introduces severe tracking and kerning errors because it ignores the trailing space, surrounding character ligatures, and contextual tracking deltas.

To obtain exact subpixel positions and widths in context:
1. Use an invisible measurement helper layer formatted identically to the target text layer.
2. Calculate the advance of the text **immediately preceding** the match ($\text{startAdv}$):
   $$\text{startAdv} = \text{measure}\left(\text{lineStr.substring}(0, \text{match.start}) + \text{"|"}\right).\text{width} - \text{measure}\left(\text{"|"}\right).\text{width}$$
3. Calculate the advance of the text **including** the matched word ($\text{endAdv}$):
   $$\text{endAdv} = \text{measure}\left(\text{lineStr.substring}(0, \text{match.end}) + \text{"|"}\right).\text{width} - \text{measure}\left(\text{"|"}\right).\text{width}$$
4. Compute the exact term width and center coordinate:
   $$\text{termWidth} = \max\left(4, \text{endAdv} - \text{startAdv}\right)$$
   $$\text{boxCenterX} = \text{lineLeft} + \text{startAdv} + \frac{\text{termWidth}}{2}$$

#### Why the Pipe Delimiter (`"|"`) Is Critical
- ExtendScript's `sourceRectAtTime()` trims trailing whitespace. Measuring `"Hello "` returns the width of `"Hello"`.
- Appending a non-whitespace delimiter `"|"` forces the typography engine to render and measure the true whitespace advance between words.
- Subtracting the isolated delimiter width `measure("|").width` yields the exact typographic advance up to the boundary.
- **Emoji Immunity**: Emojis (e.g. `🎨`, `💎`, `🎸`) have dynamic glyph metrics. Delimiter-anchored advance correctly measures multi-byte Unicode emoji surrogate pairs without corrupting character indices.

---

### 20.4 3D Text Layer & Anchor Point Invariance

When text layers have `threeDLayer = true` and custom Z-depth positions (e.g. `Z: -53px`):
1. **Preserve 3D Position Arrays**:
   ExtendScript vectors for 3D layers require 3 elements `[x, y, z]`. Passing 2-element arrays resets the Z-depth to $0\text{px}$, causing the text layer to jump visually toward or away from the camera.
2. **Propagate `threeDLayer = true` to Child Layers**:
   When parenting a vector Shape Layer to a 3D Text layer, the Shape Layer **must** also be set to `threeDLayer = true`. A 2D child layer parented to a 3D layer breaks 3D camera parallax and causes highlight planes to drift during camera rotation and orbit.
3. **Anchor Point Drift Threshold Guard**:
   Re-running anchor alignment algorithms on already-aligned layers can accumulate floating-point rounding errors. Always guard with a delta threshold:
   ```javascript
   if (Math.abs(deltaAx) < 0.001 && Math.abs(deltaAy) < 0.001) {
       return true; // Already top-left aligned, preserve position 100%
   }
   ```

---

## 21. Character & Emoji Spatial Locating: The Geometry of In-Line Character Placement

When replacing or decorating specific characters (such as swapping monochrome font glyphs for color vector emojis via `AE_Replace_Color_Emojis.jsx`, or anchoring callouts, badges, or pointers to specific characters inside existing text), scripts must determine the exact local $[X, Y]$ coordinates of individual characters within arbitrary text layers.

Unlike word-level bounding box calculations that wrap an entire word into a highlight box, character-level locating requires sub-pixel optical baseline alignment, multi-line paragraph text box wrapping, and justification invariance without altering the parent text layer's anchor point.

```
                  POINT TEXT CHARACTER LOCATING
      [Local Origin [0, 0] at Baseline Y=0, Horizontal Anchor at Justification X=0]
                     Line 0: "Hello After Effects! 😃 We now have color emojis!"
                     ──────────────────────────────▲─────────────────────────── [Baseline Y=0]
                                                   │
                                                   └─ [emojiCenterX, emojiCenterY]

                  PARAGRAPH (BOX) TEXT CHARACTER LOCATING
      [Local Origin [0, 0] at Box Top-Left [boxPos[0], boxPos[1]]]
      ┌────────────────────────────────────────────────────────────────────────┐
      │  Line 0: "Right aligned box text with popcorn 🍿 and circus"           │
      │  ─────────────────────────────────────────────▲───────────── [Line 0 Baseline = boxPos.y + ascender]
      │                                               │
      │  Line 1: "tent 🎪 rendered with native vector shapes!"                 │
      │  ──────────────▲──────────────────────────────────────────── [Line 1 Baseline = Line 0 Baseline + leading]
      │                └─ [emojiCenterX, emojiCenterY]                         │
      └────────────────────────────────────────────────────────────────────────┘
```

### 21.1 The Multi-Line Paragraph Text Box Wrapping Trap

The single most critical failure mode when locating characters in **Paragraph (Box) Text** stems from how After Effects stores text strings:

1. **Point Text**: Visual line breaks exist **only** where explicit newline characters (`\r\n`, `\r`, or `\n`) occur in `doc.text`.
2. **Paragraph (Box) Text**: Text flows continuously inside `doc.boxTextSize[0]`. Words wrap onto subsequent visual lines **without inserting newline characters into the underlying string**.

#### The Catastrophic Unwrapped Width Error in Center & Right Alignment
If a script naively splits `doc.text` by `/\r\n|\r|\n/`, an entire 50-word paragraph is treated as a **single line**:
- The measured line width $\text{lineW}$ is the length of all 50 words combined (e.g. $2500\text{px}$), while the box width $\text{boxWidth}$ is only $800\text{px}$.
- When aligned **Right**:
  $$\text{lineLeftX} = \text{boxWidth} - \text{lineW} = 800 - 2500 = -1700\text{px}$$
- The script calculates an advance for a character on line 2 or 3 using line index $0$, throwing the character into negative coordinate space far outside the composition window!

#### The Canonical Solution: Dynamic Visual Line Wrapping (`computeVisualLines`)
Before locating character coordinates, scripts **must** simulate After Effects' internal Knuth-Plass greedy line-breaker across each paragraph:

```javascript
function computeVisualLines(props, measurer) {
    var fullText = props.fullText;
    if (!props.isBox || props.boxWidth <= 0) {
        return fullText.split(/\r\n|\r|\n/);
    }

    // 1. Check for AETextCalibration engine (e.g. in AE_JS_builder emulator)
    var calib = (typeof AETextCalibration !== "undefined") ? AETextCalibration : (globalObj.AETextCalibration || null);
    if (calib && typeof calib.wrapParagraph === "function") {
        try {
            var wrapped = calib.wrapParagraph(fullText, props.boxWidth, props.fontSize, props.font, {}, props.tracking);
            if (wrapped && wrapped.length > 0) {
                var wLines = [];
                for (var wi = 0; wi < wrapped.length; wi++) wLines.push(wrapped[wi].text);
                return wLines;
            }
        } catch (eCal) {}
    }

    // 2. ExtendScript native greedy token wrapping fallback
    var rawParas = fullText.split(/\r\n|\r|\n/);
    var resultLines = [];
    for (var pi = 0; pi < rawParas.length; pi++) {
        var para = rawParas[pi];
        var words = para.match(/\S+|\s+/g) || [];
        if (words.length === 0) { resultLines.push(""); continue; }

        var curLine = "";
        for (var wi = 0; wi < words.length; wi++) {
            var token = words[wi];
            var testLine = curLine + token;
            var testW = measurer ? measurer.measurePrefixAdvance(testLine.replace(/\s+$/, "")) : 0;
            if (testW > props.boxWidth && curLine.replace(/\s+$/, "").length > 0) {
                resultLines.push(curLine.replace(/\s+$/, ""));
                curLine = token.replace(/^\s+/, "");
            } else {
                curLine = testLine;
            }
        }
        if (curLine.length > 0) resultLines.push(curLine.replace(/\s+$/, ""));
    }
    return resultLines.length > 0 ? resultLines : rawParas;
}
```

---

### 21.2 Paragraph Justification Enum & Numeric Normalization

ExtendScript justification values are encoded as numeric constants under `ParagraphJustification`. A notorious bug occurs when scripts misidentify numeric enum values or invert them:

| Justification | ExtendScript Enum | Numeric Value | Alternate / Last-Line Enums |
| :--- | :--- | :--- | :--- |
| **Left** | `ParagraphJustification.LEFT_JUSTIFY` | `7412` | `7415` (`JUSTIFY_LAST_LEFT`), `7418` (`JUSTIFY_ALL`), `0`, `"left"` |
| **Right** | `ParagraphJustification.RIGHT_JUSTIFY` | `7413` | `7416` (`JUSTIFY_LAST_RIGHT`), `1`, `"right"`, `"RIGHT_JUSTIFY"` |
| **Center** | `ParagraphJustification.CENTER_JUSTIFY` | `7414` | `7417` (`JUSTIFY_LAST_CENTER`), `2`, `"center"`, `"CENTER_JUSTIFY"` |

> [!WARNING]
> **The 7413 / 7414 Inversion Trap**:
> Developers frequently write `if (j === 7413) just = "center"` assuming standard array indexing or sequential numbering. In After Effects typography, **7413 is RIGHT** and **7414 is CENTER**. Inverting them causes right-aligned text to calculate center coordinates, displacing characters by hundreds of pixels.

To guarantee bulletproof justification normalization across all AE versions and web simulators:
```javascript
function normalizeJustification(j) {
    if (typeof ParagraphJustification !== "undefined") {
        if (j === ParagraphJustification.CENTER_JUSTIFY ||
            j === ParagraphJustification.JUSTIFY_LAST_CENTER ||
            (typeof ParagraphJustification.FULL_JUSTIFY_LASTCENTER !== "undefined" && j === ParagraphJustification.FULL_JUSTIFY_LASTCENTER)) {
            return "center";
        }
        if (j === ParagraphJustification.RIGHT_JUSTIFY ||
            j === ParagraphJustification.JUSTIFY_LAST_RIGHT ||
            (typeof ParagraphJustification.FULL_JUSTIFY_LASTRIGHT !== "undefined" && j === ParagraphJustification.FULL_JUSTIFY_LASTRIGHT)) {
            return "right";
        }
    }
    if (j == 7414 || j == 7417 || j == 2 || j === "center" || j === "CENTER_JUSTIFY") return "center";
    if (j == 7413 || j == 7416 || j == 1 || j === "right" || j === "RIGHT_JUSTIFY") return "right";
    if (typeof j === "string") {
        var s = j.toLowerCase();
        if (s.indexOf("center") !== -1) return "center";
        if (s.indexOf("right") !== -1) return "right";
    }
    return "left";
}
```

---

### 21.3 Child Layer Parenting Without Parent Anchor Point Disruption

When generating procedural vector shape layers to replace or decorate text characters, **never mutate the parent text layer's anchor point or position** (doing so breaks user keyframe animations, tracking trackers, and parent transforms).

Instead, utilize After Effects' transform hierarchy:
```javascript
var shapeLayer = comp.layers.addShape();
shapeLayer.parent = textLayer;
var origAP = textLayer.transform.anchorPoint.value; // [apX, apY, apZ]
shapeLayer.transform.anchorPoint.setValue([0, 0, 0]);
shapeLayer.transform.position.setValue([-origAP[0], -origAP[1], 0]);
shapeLayer.transform.scale.setValue([100, 100, 100]);
```

#### Why `position = [-origAP[0], -origAP[1], 0]` Works Universally
In After Effects matrix mechanics:
1. When `child.parent = parent`, child `position = [0, 0]` is evaluated at `parent.anchorPoint`.
2. Setting `child.position = -parent.anchorPoint` cancels out the parent's anchor point offset:
   $$M_{\text{child\_world}} = M_{\text{parent\_world}} \times \text{Translate}(-\text{Anchor}_{\text{parent}}) \times \text{Translate}(+\text{Anchor}_{\text{parent}}) = M_{\text{parent\_world}}$$
3. Consequently, any local coordinate $[x, y]$ in `shapeLayer` lands at the **exact same composition coordinate** as $[x, y]$ in the text layer's native coordinate space!

---

### 21.4 The Universal Character Coordinate Equations

For any specific character located on visual line `vl` (0-indexed) with line text `lineStr`:
1. **Visual Line Width**:
   $$\text{lineW} = \text{measurePrefixAdvance}(\text{lineStr})$$
2. **Character Advance & Prefix Advance**:
   $$\text{prefix} = \text{lineStr.substring}(0, \text{charIndex})$$
   $$\text{prefixAdv} = \text{measurePrefixAdvance}(\text{prefix})$$
   $$\text{charAdv} = \max\left(\text{fontSize} \times 0.70, \text{measurePrefixAdvance}(\text{prefix} + \text{char}) - \text{prefixAdv}\right)$$

#### 1. Horizontal Line Origin ($\text{lineLeftX}$)
$$\text{lineLeftX} = \begin{cases}
\text{boxPos}_x & \text{if Box Text, Left Justified} \\
\text{boxPos}_x + \frac{\text{boxWidth} - \text{lineW}}{2} & \text{if Box Text, Center Justified} \\
\text{boxPos}_x + \text{boxWidth} - \text{lineW} & \text{if Box Text, Right Justified} \\
0 & \text{if Point Text, Left Justified} \\
-\frac{\text{lineW}}{2} & \text{if Point Text, Center Justified} \\
-\text{lineW} & \text{if Point Text, Right Justified}
\end{cases}$$

#### 2. Vertical Line Baseline ($\text{lineBaselineY}$)
$$\text{firstBaselineY} = \begin{cases}
\text{boxPos}_y + (\text{fontSize} \times 0.78) & \text{if Paragraph Box Text} \\
0 & \text{if Point Text}
\end{cases}$$
$$\text{lineBaselineY} = \text{firstBaselineY} + (vl \times \text{leading})$$
*(where $\text{leading} = \text{doc.leading} \parallel \text{fontSize} \times 1.2$)*

#### 3. Character Center Coordinates ($\text{charCenterX}, \text{charCenterY}$)
$$\text{charCenterX} = \text{lineLeftX} + \text{prefixAdv} + \frac{\text{charAdv}}{2}$$
$$\text{charCenterY} = \text{lineBaselineY} - (\text{fontSize} \times 0.35)$$

> [!TIP]
> **Optical Baseline Offset ($0.35 \times \text{fontSize}$)**:
> In vector typography, glyph em-boxes extend from baseline $y=0$ upwards to ascender $y \approx -0.78 \times \text{fontSize}$. Placing an icon or replacement vector shape centered at $\text{lineBaselineY} - 0.35 \times \text{fontSize}$ centers the shape optically with the cap-height of uppercase Latin letters and digits.

---

### 21.5 Multi-Byte Unicode Surrogate Pairs & Text Animator Hiding

When characters are emojis (such as 🍿 `U+1F37F` or 🎪 `U+1F3AA`), JavaScript engines represent them as **two UTF-16 code units** (surrogate pairs with `codePoint >= 0x10000`, string length 2).

1. **Surrogate Pair Scanning**:
   ```javascript
   var code = str.charCodeAt(i);
   if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
       var next = str.charCodeAt(i + 1);
       if (next >= 0xDC00 && next <= 0xDFFF) {
           var cp = ((code - 0xD800) * 0x400) + (next - 0xDC00) + 0x10000;
           // Atomic glyph with length 2
           i++; // advance past surrogate partner
       }
   }
   ```
2. **Hiding Font Glyphs with Native Text Animators**:
   To replace font glyphs without removing text characters from `doc.text` (which would invalidate expressions, word wrapping, and text indexes):
   ```javascript
   var anim = animators.addProperty("ADBE Text Animator");
   var opProp = anim.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");
   opProp.setValue(0); // 0% opacity on font glyphs

   var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
   sel.property("ADBE Text Range Units").setValue(2); // 2 = Index Units (UTF-16 code units)
   sel.property("ADBE Text Index Start").setValue(match.start);
   sel.property("ADBE Text Index End").setValue(match.start + match.length);
   ```
   Because `ADBE Text Selector` in Index mode operates directly on UTF-16 code units, passing $[start, start + length]$ sets opacity to 0% exclusively for the target emoji glyphs, preserving exact line geometry while displaying native color vector shapes.



---

## 22. Advanced Text Wrapping, Micro-Typography & Paragraph Composition

> **Architected with Google DeepMind Antigravity for `work2survive` ecosystems.**  
> *Derived from algorithmic paragraph composition analysis (`AE-advanced-text-wrap`).*

When laying out text in desktop publishing, web applications, or motion graphics, simple rectangular boundary clipping creates visually displeasing typography: awkward single-word orphans, unbalanced line lengths, and prepositions dangling awkwardly at the end of lines. Modern professional typography addresses this through **global paragraph composition** and **micro-typographic rules**.

---

### 22.1 The Native ExtendScript Limitation: Naive Greedy Line Breaking vs. Paragraph Composition

Both Adobe After Effects native Paragraph (Box) Text and standard CSS (`word-wrap: break-word`) rely on **naive greedy first-fit line breaking**:

```
NAIVE GREEDY WRAPPING (Standard AE / CSS)
┌──────────────────────────────────────────────┐
│ Typography is the art and technique of       │ <-- Packed to 98% of container
│ arranging type to make written language      │ <-- Packed to 94% of container
│ legible, readable, and appealing when        │ <-- Packed to 96% of container
│ displayed.                                   │ <-- AWFUL WIDOW: 1 lonely word (10%)
└──────────────────────────────────────────────┘

BALANCED PARAGRAPH COMPOSITION (Knuth-Plass / InDesign Style)
┌──────────────────────────────────────────────┐
│     Typography is the art and technique      │ <-- Balanced at 82%
│      of arranging type to make written       │ <-- Balanced at 80%
│     language legible, readable, and          │ <-- Balanced at 81%
│         appealing when displayed.            │ <-- Harmonious ending (60%)
└──────────────────────────────────────────────┘
```

#### Why Greedy Line Breaking Fails:
1. **Local vs. Global Optimization**: Greedy line breaking only looks at the current line. It fits as many words as physically possible before breaking, which frequently dumps a single short word onto the final line (a **widow** or **orphan**).
2. **Visual Raggedness**: On centered or justified text, greedy line breaking creates erratic line lengths (e.g. line 1 = 580px, line 2 = 590px, line 3 = 80px).
3. **No Semantic Grammar Awareness**: Native AE greedy wrapping treats all spaces identically, happily leaving prepositions ("in", "on", "at", "to", "of", "de", "pour") hanging at the edge of a line, or breaking a number from its unit (e.g., separating `100` from `px` or `2026` from its year).

---

### 22.2 Knuth-Plass Dynamic Line Breaking & Aesthetic Penalty Functions

To generate visually harmonious paragraphs, `AE_Advanced_Text_Wrap.jsx` implements an algorithmic paragraph composer inspired by Donald Knuth and Michael Plass's line-breaking algorithm (used in $\text{\TeX}$ and Adobe InDesign's Paragraph Composer).

For a paragraph consisting of tokens $T_1, T_2, \dots, T_n$ with target maximum width $W_{\text{max}}$:

1. **Line Slack ($\Delta_k$)**:
   $$\Delta_k = W_{\text{max}} - \text{Width}(\text{Line}_k)$$

2. **Penalty Function ($P_{\text{line}}$)**:
   $$P_{\text{line}} = \begin{cases}
   \infty & \text{if } \text{Width} > W_{\text{max}} \\
   \Delta_k^2 + P_{\text{hyphen}} + P_{\text{ladder}} & \text{if } k < M \text{ (intermediate line)} \\
   P_{\text{widow}}(\text{Width}) & \text{if } k = M \text{ (last line of paragraph)}
   \end{cases}$$

3. **Widow Penalty ($P_{\text{widow}}$)**:
   $$P_{\text{widow}} = \begin{cases}
   50000 & \text{if } \text{Width}_M < 0.25 \times W_{\text{max}} \text{ or single word} \\
   0 & \text{if } \text{Width}_M \ge 0.25 \times W_{\text{max}} \text{ (natural ending)}
   \end{cases}$$

4. **Dynamic Programming Recurrence**:
   Let $C[i]$ be the minimum penalty to wrap tokens from index $i$ to the end of the paragraph $n$:
   $$C[i] = \min_{i < j \le n} \left( P_{\text{line}}(T_i \dots T_{j-1}) + C[j] \right)$$
   This evaluates the global paragraph in $O(n^2)$ time (typically under 3 milliseconds in ExtendScript for paragraphs under 200 words), yielding mathematically optimal line balance.

---

### 22.3 Micro-Typographic Rules & Non-Breaking Space Binding

In micro-typography, certain words and grammatical tokens must remain syntactically and visually unified. Rather than introducing complex line-breaking exceptions, these rules are implemented by replacing regular space (`\u0020`) with the **Unicode Non-Breaking Space (`\u00A0` / NBSP)**:

| Typographic Rule | Problem Pattern | Solution via `\u00A0` Binding | Example |
| :--- | :--- | :--- | :--- |
| **Dangling Short Words** | Articles and prepositions (length $\le 3$) left at line ends | Bind to following word | `in\u00A0motion`, `the\u00A0best`, `de\u00A0la` |
| **Number & Unit Binding** | Numbers separated from their units or percentages | Bind number to symbol / unit | `100\u00A0px`, `50\u00A0%`, `1920\u00A0x\u00A01080` |
| **Currency Figures** | Currency symbol separated from number | Bind currency symbol to figure | `$\u00A0500`, `€\u00A0250` |
| **Honorifics & Abbreviations** | Titles and abbreviations separated from names | Bind honorific to following token | `Dr.\u00A0Smith`, `Mr.\u00A0Jones`, `e.g.\u00A0text` |
| **Widow & Orphan Prevention** | Single lonely word on final paragraph line | Bind penultimate word to final word | `visual\u00A0harmony` |

Because `\u00A0` has the exact same visual advance width as a standard space in After Effects, line measurement is preserved while preventing the layout engine from breaking between the bound tokens.

---

### 22.4 Algorithmic Syllabification & Hyphenation in ExtendScript ES3

When a word exceeds the remaining line budget, naive line breaking forces the entire word onto the next line, creating a gaping hole (a "river" or large ragged gap) on the preceding line.

`AE_Advanced_Text_Wrap.jsx` incorporates a zero-dependency, multi-lingual algorithmic hyphenator compatible with After Effects' ECMAScript 3 engine:

```javascript
// Syllable break constraints
minWordLength = 6;  // Words under 6 letters are never hyphenated
minPrefix     = 3;  // At least 3 letters must remain on the first line
minSuffix     = 3;  // At least 3 letters must carry over to the next line
```

#### Multi-Language Support Matrix:
- **English (US/UK)**: Recognizes morphological prefixes (`un-`, `dis-`, `trans-`, `inter-`, `multi-`), suffixes (`-tion`, `-ment`, `-ness`, `-able`, `-ing`), and double-consonant division (`let-ter`, `run-ning`).
- **Spanish (Español)**: Implements Hispanic syllabification: indivisible digraphs (`ch`, `ll`, `rr`), inseparable consonant-liquid blends (`pr`, `br`, `tr`, `cl`, `pl`), and diphthong preservation.
- **French (Français)**: Accounts for elision apostrophes (`l'`, `d'`, `qu'`) and French prefix/suffix boundaries.
- **German (Deutsch)**: Handles Germanic compound prefix boundaries (`ver-`, `zer-`, `ent-`, `be-`) and standard suffixes (`-ung`, `-heit`, `-keit`, `-schaft`).
- **Universal Fallback**: Vowel-Consonant-Consonant-Vowel ($V-CV$ / $VC-CV$) generic syllabification.

> [!CAUTION]
> **Hyphen Ladder Prevention**: Consecutive line-ending hyphens (two or more lines in a row ending in `-`) create visual distraction. The cost function adds a heavy penalty ($+20000$) whenever two consecutive lines break on a hyphen.

---

### 22.5 Line Break Mechanics: `\r` (Carriage Return) vs. `\n` in Point & Box Text

In web browsers, newline characters (`\n`, `\r\n`) are standard. In native After Effects text engines, newline mechanics require precise handling:

1. **`\r` is After Effects' Native Line Break**:
   Inside an Adobe After Effects `TextDocument.text`, the canonical line break character is carriage return:
   $$\text{Line Break} = \text{String.fromCharCode}(13) \quad (\verb|'\r'|)$$
   Using `\n` alone can cause inconsistent vertical spacing or baseline calculation glitches in CS6 through CC 2022.
2. **Point Text Wrapping**:
   Point Text has no bounding box; it renders on a single infinite horizontal line until an explicit `\r` is encountered.
   By inserting `\r` at the mathematically optimal break positions computed by `AE_Advanced_Text_Wrap.jsx`, Point Text is transformed into an immaculately wrapped multi-line paragraph **without altering the layer's baseline origin, justification, or anchor point coordinate**.
3. **Paragraph (Box) Text Wrapping**:
   For Paragraph Box Text, setting `doc.text` with explicit `\r` breaks overrides AE's internal naive greedy wrap. Additionally, `doc.boxTextSize = [maxTextWidth, calculatedHeight]` ensures the container box matches the exact pixel constraint.

---

### 22.6 Persistent State Storage via Expression Comment Payloads

To provide non-destructive operation with a 1-click **"↺ Restore Original Text"** feature, the original pre-wrap text, geometry, and box type must persist across project saves (`.aep`) without modifying the user's composition structure.

Because native After Effects expression controls do not offer a dedicated string property, state is persisted using an **Expression Comment Payload** on an `ADBE Slider Control`:

```javascript
// 1. Create or retrieve state effect:
var fxParade = textLayer.property("ADBE Effect Parade");
var eff = fxParade.property("Advanced Text Wrap") || fxParade.addProperty("ADBE Slider Control");
eff.name = "Advanced Text Wrap";

// 2. Encode state payload into the Slider property's expression:
var payload = {
    text: originalText,
    isBox: isBox,
    boxSize: boxSize || [0, 0]
};
var encoded = encodeURIComponent(JSON.stringify(payload));
eff.property(1).expression = "/* AdvancedTextWrapState:" + encoded + " */\nvalue;";

// 3. Mirror in layer.comment for native After Effects metadata inspection:
textLayer.comment = "AdvancedTextWrap:" + originalText;
```

When the user clicks "Restore Original Text", the script reads `eff.property(1).expression` or `textLayer.comment`, parses the JSON payload, and restores the original text and box dimensions seamlessly.

---

### 22.7 Interoperability Architecture with Character-Level Animators

`AE_Advanced_Text_Wrap.jsx` is engineered to integrate cleanly with `AE-Text-Highlight` and `AE-replace-color-emojis`:

1. **Surrogate Pair (Emoji) Protection**:
   Emojis represented by multi-byte UTF-16 surrogate pairs (`\uD800..\uDBFF\uDC00..\uDFFF`, e.g. 🍿, 🚀, ❤️) are treated as **indivisible atomic tokens**. The tokenizer and hyphenator never split a surrogate pair or insert hyphens between them.
2. **Execution Order with Color Emojis (`AE-replace-color-emojis`)**:
   Always execute `AE_Advanced_Text_Wrap.jsx` **first**. Once the paragraph has achieved optimal balance and line breaks (`\r`), run `AE-replace-color-emojis`. The emoji engine will read the exact visual line geometry and place vector shapes precisely on the wrapped lines.
3. **Execution Order with Text Highlights (`AE-Text-Highlight`)**:
   Because `AE_Text_Highlight` identifies words and phrases across visual lines, wrapping the text first ensures highlights fit the final line lengths. Furthermore, because `\u00A0` (NBSP) is treated as whitespace (`\s`), target search queries (e.g. `"peace of mind"`) match seamlessly across non-breaking spaces.
