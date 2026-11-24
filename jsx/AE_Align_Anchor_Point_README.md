# AE Align Anchor Point (v1.2.0)

[![Live Browser Simulator](https://img.shields.io/badge/Live%20Demo-AE%20ScriptUI%20Simulator-2c8cff?style=for-the-badge&logo=javascript)](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Align_Anchor_Point.jsx&autobuild=true)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Adobe After Effects](https://img.shields.io/badge/Adobe%20After%20Effects-CS6%20--%20CC%202026%2B-9999FF?style=for-the-badge&logo=adobeaftereffects)](https://www.adobe.com/products/aftereffects.html)
[![Built with Antigravity](https://img.shields.io/badge/Built%20With-Antigravity-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/)

> **Interactive Web Simulator**: Test, customize, and preview this tool directly in your browser without launching After Effects via the [AE JS & ScriptUI Simulator](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Align_Anchor_Point.jsx&autobuild=true).

---

## 📖 Overview

**AE Align Anchor Point** is an Adobe After Effects ScriptUI panel and live expression engine that aligns the anchor point of any 2D or 3D composition, text box (paragraph or point text), vector shape, solid, footage, or null layer to Left, Center, or Right (X) and Top, Center, or Bottom (Y) with **zero visual jump or shift** of content on screen.

Moving an anchor point natively in After Effects shifts the layer's visual position across the composition. **AE Align Anchor Point** completely eliminates this drift by pairing the Anchor Point with a scale-safe, 3-axis rotation-safe, and orientation-safe Position compensator expression (or static keyframe bake), keeping the layer's rendered visual content strictly locked in place.

---

## 🌟 Key Features

1. **Zero-Shift Content Invariance in 2D & 3D**:
   - Mathematically couples Anchor Point and Position so that moving the anchor point never displaces the visual content on screen.
   - Scale-safe ($S / 100$), rotation-safe ($R_z$), and 3D orientation & Euler rotation-safe ($R_{3D}$) compensation prevents drift even if the layer is 3D, rotated, or oriented along X, Y, and Z.
   - Supports separated position dimensions (`X Position`, `Y Position`, `Z Position`).

2. **Dual Calculation Engines**:
   - **`sourceRectAtTime(time, false)`**: Dynamically measures the exact rendered bounding box of glyphs, ascenders, descenders, and vector paths.
   - **Stated Width & Height**: Aligns to declared paragraph box text dimensions (`boxTextSize`), solid sizes (`layer.width`, `layer.height`), or precomp canvas dimensions (`source.width`, `source.height`).

3. **Original Anchor Point Storage Effect**:
   - Optional checkbox to record the layer's unshifted anchor point in a standard After Effects coordinate effect:
     - **2D Layers**: `ADBE Point Control` named `"Original Anchor Point"`.
     - **3D Layers**: `ADBE Point3D Control` named `"Original Anchor Point"`.
   - **Non-Destructive**: Subsequent alignment shifts preserve the true original anchor point and never overwrite it.
   - Expressions dynamically read from this effect for reference, guaranteeing long-term drift-free stability.

4. **Layer State Persistence**:
   - Stores the active alignment parameters directly on the layer using standard After Effects effect controls (`Anchor Align X`, `Anchor Align Y`, `Anchor Bounds Mode`, `Anchor Base Point`).
   - Selecting a previously aligned layer automatically restores and reflects its alignment settings in the UI.

5. **Quick 3x3 Preset Visual Matrix**:
   - Dedicated 9-button grid (`Top-Left`, `Center`, `Bot-Right`, etc.) for one-click alignment.

6. **Dual Execution Modes**:
   - **One-Time Static Bake (Default)**: Instantly calculates exact compensation once and sets static numeric values on Anchor Point and Position without any continuous expression runtime overhead.
   - **Live Dynamic Expressions**: Anchor point and position remain continuously reactive to text edits, font size changes, and content resizing.
   - **Visual Expression Management**: Clear Expressions button (`✕ Clear Expressions`) is directly coupled alongside Dynamic Expressions within the Execution Engine panel for immediate cleanup.

---

## 🖥️ ScriptUI Panel Layout

```text
┌────────────────────────────────────────────────────────┐
│ ⚓ AE ALIGN ANCHOR POINT v1.2.0                         │
│ Zero-Shift Anchor Aligner with State Effect            │
├────────────────────────────────────────────────────────┤
│ Target Selection:                                      │
│ 'Title_Text' [Text Layer (3D), Anchor: 230, 90, 0]     │
│ [ 🔄 Refresh Selection ]                                │
├────────────────────────────────────────────────────────┤
│ Bounds Calculation Method:                             │
│ (•) sourceRectAtTime() (Dynamic)  ( ) Stated Dimensions│
├────────────────────────────────────────────────────────┤
│ Horizontal Alignment (X):                              │
│ ( ) Left Edge      (•) Center        ( ) Right Edge    │
├────────────────────────────────────────────────────────┤
│ Vertical Alignment (Y):                                │
│ ( ) Top Edge       (•) Center        ( ) Bottom Edge   │
├────────────────────────────────────────────────────────┤
│ Quick 9-Point Presets (Visual Matrix):                 │
│ [ Top-Left   ]  [ Top-Center ]  [ Top-Right   ]        │
│ [ Mid-Left   ]  [ Center     ]  [ Mid-Right   ]        │
│ [ Bot-Left   ]  [ Bot-Center ]  [ Bot-Right   ]        │
├────────────────────────────────────────────────────────┤
│ Execution Engine:                                      │
│ (•) One-Time Static Bake (No Expressions - Default)    │
│ ( ) Dynamic Expressions (Live)   [ ✕ Clear Expressions]│
│ [x] Store Original Anchor Point (Coordinate Effect)    │
├────────────────────────────────────────────────────────┤
│ [ ⚓ Align Anchor Point (Zero Visual Shift)           ] │
│ Ready.                                                 │
│ GitHub: work2survive/AE-Align-AnchorPoint              │
└────────────────────────────────────────────────────────┘
```

---

## ⚙️ Mathematical Derivation & Zero-Shift Content Mechanics

### 1. The 2D Anchor Point Coordinate Relationship
In After Effects, every 2D layer's visual content is transformed according to the classic affine transformation:
$$\mathbf{X}_{\text{comp}} = \mathbf{P} + \mathbf{R}(\theta) \cdot \mathbf{S} \cdot (\mathbf{x}_{\text{layer}} - \mathbf{A})$$

Where:
- $\mathbf{P} = [P_x, P_y]^T$ is the layer's **Position** in composition space.
- $\mathbf{A} = [A_x, A_y]^T$ is the layer's **Anchor Point** in layer local space.
- $\mathbf{x}_{\text{layer}}$ is an arbitrary point within the layer's content (e.g. top-left corner of text glyphs).
- $\mathbf{S} = \begin{bmatrix} s_x/100 & 0 \\ 0 & s_y/100 \end{bmatrix}$ is the scale matrix.
- $\mathbf{R}(\theta) = \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix}$ is the 2D rotation matrix.

### 2. The 3D Coordinate System & Euler Rotation Chain
For 3D layers (`layer.threeDLayer = true`), points exist in 3-axis space $\mathbb{R}^3$:
$$\mathbf{X}_{\text{comp}} = \mathbf{P} + \mathbf{R}_{3D} \cdot \mathbf{S} \cdot (\mathbf{x}_{\text{layer}} - \mathbf{A})$$

Where:
- $\mathbf{P} = [P_x, P_y, P_z]^T$ (or separated `X/Y/Z Position`).
- $\mathbf{A} = [A_x, A_y, A_z]^T$.
- $\mathbf{S} = \operatorname{diag}(s_x/100, s_y/100, s_z/100)$.
- $\mathbf{R}_{3D}$ is the concatenated After Effects 3D transformation matrix composed of **Orientation** $[o_x, o_y, o_z]$ followed by individual Euler rotations $[r_x, r_y, r_z]$:
  $$\mathbf{R}_{3D} = \mathbf{R}_x(o_x) \cdot \mathbf{R}_y(o_y) \cdot \mathbf{R}_z(o_z) \cdot \mathbf{R}_x(r_x) \cdot \mathbf{R}_y(r_y) \cdot \mathbf{R}_z(r_z)$$

When evaluating the action of $\mathbf{R}_{3D}$ on a local scaled displacement vector $\mathbf{v} = \mathbf{S} \cdot \Delta\mathbf{A}$, transformations are applied sequentially in right-to-left vector order:
$$\mathbf{v}' = \mathbf{R}_x(o_x)\Big( \mathbf{R}_y(o_y)\Big( \mathbf{R}_z(o_z)\Big( \mathbf{R}_x(r_x)\Big( \mathbf{R}_y(r_y)\Big( \mathbf{R}_z(r_z)\cdot \mathbf{v}\Big)\Big)\Big)\Big)\Big)$$

### 3. The Zero-Shift Invariance Condition
When moving the anchor point from $\mathbf{A}_{\text{base}}$ to $\mathbf{A}_{\text{target}}$, the rendered content point $\mathbf{x}_{\text{layer}}$ must satisfy:
$$\mathbf{X}_{\text{comp}}(\text{new}) = \mathbf{X}_{\text{comp}}(\text{old})$$

$$\mathbf{P}_{\text{new}} + \mathbf{R} \cdot \mathbf{S} \cdot (\mathbf{x} - \mathbf{A}_{\text{target}}) = \mathbf{P}_{\text{base}} + \mathbf{R} \cdot \mathbf{S} \cdot (\mathbf{x} - \mathbf{A}_{\text{base}})$$

Subtracting like terms yields the universal compensation formula for both 2D and 3D:
$$\mathbf{P}_{\text{new}} = \mathbf{P}_{\text{base}} + \mathbf{R} \cdot \mathbf{S} \cdot (\mathbf{A}_{\text{target}} - \mathbf{A}_{\text{base}})$$

Let $\Delta \mathbf{A} = \mathbf{A}_{\text{target}} - \mathbf{A}_{\text{base}}$. When rotation is zero ($\theta = 0$):
$$P_x(\text{new}) = P_x(\text{base}) + \Delta A_x \cdot \frac{s_x}{100}$$
$$P_y(\text{new}) = P_y(\text{base}) + \Delta A_y \cdot \frac{s_y}{100}$$
$$P_z(\text{new}) = P_z(\text{base}) + \Delta A_z \cdot \frac{s_z}{100}$$

When rotation $\neq 0$, the vector displacement $\mathbf{v}' = \mathbf{R}_{3D} \cdot (\mathbf{S} \cdot \Delta \mathbf{A})$ is added directly to position:
$$\mathbf{P}_{\text{new}} = \mathbf{P}_{\text{base}} + \mathbf{v}'$$

### 4. The Special Case: Base Anchor at $[0, 0]$
When a layer's base anchor point was $[0, 0]$ (common for text layers and shape layers created at the origin), $\mathbf{A}_{\text{base}} = [0, 0]$, which simplifies $\Delta \mathbf{A} = \mathbf{A}_{\text{target}}$.
In that case, the position expression reduces to:
```javascript
const r = sourceRectAtTime(time, false);
const s = [transform.scale[0] / 100, transform.scale[1] / 100];
value + [r.left * s[0], r.top * s[1]];
```

---

## 🔬 Deep-Dive: Anchor Points in After Effects vs. JavaScript Emulation

When building tools that run both natively in Adobe After Effects (ExtendScript ES3 engine) and inside JavaScript browser emulators (like the [AE JS & ScriptUI Simulator](https://work2survive.github.io/AE_JS_builder/)), several critical runtime differences emerge:

### 1. Operator Overloading in Vector Math
- **After Effects Native Engine**: The AE expression engine (both the Modern JavaScript engine and Legacy ExtendScript) natively overloads mathematical operators for arrays and vectors:
  ```javascript
  // Valid in native After Effects expressions:
  const s = transform.scale / 100;           // Evaluates to [1, 1]
  const pos = value + [r.left, r.top];       // Vector addition
  ```
- **Pure JavaScript / V8 / Web Browsers**: Pure JavaScript does not support operator overloading:
  - `[100, 100] / 100` evaluates to `NaN`!
  - `[960, 540] + [10, 20]` evaluates to `"960,54010,20"` (string concatenation)!
- **Universal Parity Rule**: Expressions must always index components explicitly:
  ```javascript
  const s = [transform.scale[0] / 100, transform.scale[1] / 100];
  const newPos = [value[0] + dx, value[1] + dy];
  ```
  This component-wise syntax is 100% valid in native AE and strictly valid in JavaScript environments.

### 2. Multi-Dimensional Property Array Indexing
- **In After Effects**: Multi-dimensional properties (e.g. `Position`, `Scale`, `Anchor Point`) can be indexed directly:
  ```javascript
  transform.scale[0]; // Returns 100
  ```
- **In JavaScript Emulation**: Properties in JS object models are instances of a `Property` class. Accessing `transform.scale[0]` returns `undefined` unless the class implements numeric index getters:
  ```javascript
  get 0() { const v = this.value; return Array.isArray(v) ? v[0] : v; }
  get 1() { const v = this.value; return Array.isArray(v) ? v[1] : undefined; }
  get 2() { const v = this.value; return Array.isArray(v) ? v[2] : undefined; }
  get length() { const v = this.value; return Array.isArray(v) ? v.length : 1; }
  ```

### 3. Parent Space Transform Matrix Separation
- **In After Effects**:
  - The parent matrix transformation for child layers is:
    $$M_{\text{parent}} = T(\text{position}) \cdot R(\text{rotation}) \cdot S(\text{scale})$$
  - The local offset $-T(\text{anchor})$ applies **only** to the parent layer's own internal drawing content, **not** to child layers!
- **In JS Emulators**:
  - A common bug is computing a single monolithic `getWorldMatrix()` that includes $-T(\text{anchor})$ and using it for child layers. This causes child layers at $[0, 0]$ to be pinned to the top-left corner instead of the anchor point.
  - Fix: Decouple `getParentSpaceMatrix()` from `getWorldMatrix()`.

### 4. Expression Circular Dependency & Base Value Extraction (`origA`)
- **In After Effects**:
  - If `transform.anchorPoint` has an expression attached, querying `transform.anchorPoint.value` from a `position` expression returns the **post-expression evaluated value**, NOT the raw static base value!
  - If the position expression computes $\Delta \mathbf{A} = \mathbf{A}_{\text{target}} - \text{transform.anchorPoint.value}$, both terms become identical, causing $\Delta \mathbf{A} = 0$!
- **Solution**:
  - Store the baseline anchor point $\mathbf{A}_{\text{base}}$ into an effect control (`Anchor Base Point`), or embed the static base coordinates directly into the position expression:
    ```javascript
    const origA = [230, 90]; // Statically referenced baseline
    const dx = (targetX - origA[0]) * s[0];
    ```

### 5. `sourceRectAtTime()` vs. `boxTextSize`
- **`sourceRectAtTime(time, false)`**:
  - Measures the tight visual bounding box of rendered character paths.
  - Ascenders (like `h`, `d`, `k`), descenders (like `g`, `y`, `p`), and capital letters influence `r.top` and `r.height`.
  - For empty or whitespace lines, dimensions collapse.
- **`boxTextSize`**:
  - Represents the declared spatial container box of paragraph text.
  - In native AE: Accessed via `thisLayer.text.sourceText.value.boxTextSize`.
  - In modern AE JS expressions:
    ```javascript
    const sDoc = thisLayer.text ? thisLayer.text.sourceText.value : null;
    const boxW = sDoc && sDoc.boxTextSize ? sDoc.boxTextSize[0] : thisLayer.width;
    ```

### 6. The 3D Rotation Operator Order (Right-to-Left Vector Transform Trap)
- **The Matrix Pipeline**:
  In After Effects, the complete 3D affine transformation matrix for layer content is concatenated in the following order:
  $$\mathbf{M} = \mathbf{T}(\mathbf{P}) \cdot \mathbf{R}_x(o_x) \cdot \mathbf{R}_y(o_y) \cdot \mathbf{R}_z(o_z) \cdot \mathbf{R}_x(r_x) \cdot \mathbf{R}_y(r_y) \cdot \mathbf{R}_z(r_z) \cdot \mathbf{S}$$
- **The Vector Transformation Order**:
  When rotating a displacement vector $\mathbf{v} = \mathbf{S} \cdot \Delta\mathbf{A}$, the matrices multiply vector $\mathbf{v}$ from **right to left**:
  $$\mathbf{v}' = \mathbf{R}_x(o_x)\Big( \mathbf{R}_y(o_y)\Big( \mathbf{R}_z(o_z)\Big( \mathbf{R}_x(r_x)\Big( \mathbf{R}_y(r_y)\Big( \mathbf{R}_z(r_z)\cdot \mathbf{v}\Big)\Big)\Big)\Big)\Big)$$
- **The Trap**:
  If Euler rotations are evaluated in intuitive forward order ($o_x \to o_y \to o_z \to r_x \to r_y \to r_z$), rotated 3D layers experience severe coordinate drift ($> 100\text{ px}$).
- **The Rule**:
  Vector rotation must strictly proceed from the inside out:
  1. $R_z(r_z)$ (Z Rotation)
  2. $R_y(r_y)$ (Y Rotation)
  3. $R_x(r_x)$ (X Rotation)
  4. $R_z(o_z)$ (Orientation Z)
  5. $R_y(o_y)$ (Orientation Y)
  6. $R_x(o_x)$ (Orientation X)
  This guarantees exact machine-precision zero drift ($< 10^{-14}\text{ px}$) under arbitrary 3D orientations and rotations.

### 7. Separated Position Dimensions (`dimensionsSeparated`)
- **After Effects Limitation**:
  When a user separates position dimensions, `transform.position` ceases to behave as a standard multi-dimensional vector array. Calling `posProp.setValue([x, y, z])` or assigning `posProp.expression = ...` throws a fatal ExtendScript error:
  `"Can't set expression on multidimensional property when separated"`.
- **Handling Strategy**:
  - **Static Bake**: The script checks `posProp.dimensionsSeparated`. If true, it individually targets `Transform.X Position`, `Transform.Y Position`, and `Transform.Z Position`, applying compensated scalar offsets directly.
  - **Dynamic Expressions**: Unseparates dimensions (`posProp.dimensionsSeparated = false`) before applying the consolidated 3-axis position expression.
  - **Expression Cleanup**: Cleans expressions from `position` as well as `X Position`, `Y Position`, and `Z Position` to prevent orphaned active expressions.

### 8. Non-Destructive "Original Anchor Point" Effect Architecture
- **The Multi-Pass Baseline Drift Problem**:
  If a user aligns an anchor point once (Center $\to$ Top-Left), the layer's `anchorPoint` becomes $[0, 0]$. If the user later re-runs the tool to align from Top-Left $\to$ Bottom-Right, reading the current `anchorPoint.value` treats $[0, 0]$ as the baseline origin, permanently corrupting the layer's true center reference.
- **The Effect Snapshot Solution**:
  - The script checks if an effect named `"Original Anchor Point"` already exists on the layer.
  - If **absent**, it creates an `ADBE Point Control` (2D) or `ADBE Point3D Control` (3D) and stores the unshifted baseline $[A_x, A_y, A_z]$.
  - If **already present**, it preserves the existing stored value and never overwrites it on subsequent alignment passes.
- **Dynamic Expression Integration**:
  The generated position expression dynamically references the effect with safe fallback:
  ```javascript
  let origA = [230, 90, 0];
  try {
      const fx = effect("Original Anchor Point");
      if (fx && fx(1)) origA = fx(1).value;
  } catch (eFx) {}
  ```
  This guarantees that multiple alignment passes, font changes, and text box adjustments never cause baseline coordinate drift.

---

## 📦 Installation & Setup

### Option 1: Dockable ScriptUI Panel in After Effects
1. Download [`AE_Align_Anchor_Point.jsx`](AE_Align_Anchor_Point.jsx).
2. Place the `.jsx` file inside your After Effects **ScriptUI Panels** directory:
   - **Windows**: `C:\Program Files\Adobe\Adobe After Effects <Version>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS**: `/Applications/Adobe After Effects <Version>/Scripts/ScriptUI Panels/`
3. Restart After Effects or click **Window → AE_Align_Anchor_Point.jsx**.
4. Dock the panel anywhere into your AE workspace layout.

### Option 2: Live Browser Emulator
Test and run the panel directly in your browser without Adobe After Effects:
👉 **[Launch Live Demo in AE ScriptUI Simulator](https://work2survive.github.io/AE_JS_builder/?jsx=AE_Align_Anchor_Point.jsx&autobuild=true)**

---

## 📄 License & Credits

- **Author**: Co-authored & architected with **Google DeepMind Antigravity**.
- **Repository**: [https://github.com/work2survive/AE-Align-AnchorPoint](https://github.com/work2survive/AE-Align-AnchorPoint)
- **License**: [MIT License](LICENSE)