# AE Align Anchor Point (ExtendScript & ScriptUI Tool)

> **Co-authored & architected with Google DeepMind Antigravity.**  
> *Zero-shift anchor point alignment for Adobe After Effects using dynamic expressions and scale-safe compensation.*

---

## 1. Overview & Purpose

In Adobe After Effects, changing the **Anchor Point** of a layer (Text Box, Vector Shape, Solid, Footage, or Precomposition) shifts the local origin around which the layer rotates and scales. By default, modifying the Anchor Point causes the layer's visual content to move across the composition canvas.

**AE Align Anchor Point** provides a one-click ScriptUI panel that aligns the anchor point to any edge (Left, Center, Right) and vertical boundary (Top, Center, Bottom)—or any point on a 3×3 visual matrix—**while keeping the visual content completely stationary on screen**.

It accomplishes this through two workflows:
1. **Dynamic Expression Linking**: Two linked, lightweight expressions on `Anchor Point` and `Position` that dynamically adapt via `sourceRectAtTime(time, false)` whenever text is edited, bounding boxes change, or the layer is scaled.
2. **True One-Time Static Bake**: Direct calculation and application of static values with zero expression overhead.

---

## 2. The Mechanics Behind Zero-Shift Alignment

### 2.1 The Coordinate Transformation

Any point $\mathbf{X}_{\text{layer}}$ inside a layer's local content is mapped to its parent/composition space $\mathbf{X}_{\text{comp}}$ by the affine transformation:

$$\mathbf{X}_{\text{comp}} = \mathbf{P} + \mathbf{R}(\theta) \cdot \mathbf{S} \cdot (\mathbf{X}_{\text{layer}} - \mathbf{A})$$

Where:
- $\mathbf{P} = [P_x, P_y]$ is the layer's **Position**.
- $\mathbf{A} = [A_x, A_y]$ is the layer's **Anchor Point**.
- $\mathbf{S} = \text{diag}(S_x / 100, S_y / 100)$ is the layer's **Scale**.
- $\mathbf{R}(\theta)$ is the 2D rotation matrix for angle $\theta$:
  $$\mathbf{R}(\theta) = \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix}$$

### 2.2 Content Invariance Condition

If the anchor point is shifted from $\mathbf{A}_{\text{old}}$ to a new target $\mathbf{A}_{\text{new}}$, we require that every point $\mathbf{X}_{\text{layer}}$ remains visually unchanged on screen:

$$\mathbf{P}_{\text{new}} + \mathbf{R} \cdot \mathbf{S} \cdot (\mathbf{X}_{\text{layer}} - \mathbf{A}_{\text{new}}) = \mathbf{P}_{\text{old}} + \mathbf{R} \cdot \mathbf{S} \cdot (\mathbf{X}_{\text{layer}} - \mathbf{A}_{\text{old}})$$

Subtracting $\mathbf{R} \cdot \mathbf{S} \cdot \mathbf{X}_{\text{layer}}$ from both sides:

$$\mathbf{P}_{\text{new}} - \mathbf{R} \cdot \mathbf{S} \cdot \mathbf{A}_{\text{new}} = \mathbf{P}_{\text{old}} - \mathbf{R} \cdot \mathbf{S} \cdot \mathbf{A}_{\text{old}}$$

$$\mathbf{P}_{\text{new}} = \mathbf{P}_{\text{old}} + \mathbf{R}(\theta) \cdot \mathbf{S} \cdot (\mathbf{A}_{\text{new}} - \mathbf{A}_{\text{old}})$$

When rotation $\theta = 0^\circ$, $\mathbf{R}(0^\circ) = \mathbf{I}$, and this simplifies directly to:

$$\mathbf{P}_{\text{new}} = \mathbf{P}_{\text{old}} + \left[ (A_{\text{new}, x} - A_{\text{old}, x}) \cdot \frac{S_x}{100}, \; (A_{\text{new}, y} - A_{\text{old}, y}) \cdot \frac{S_y}{100} \right]$$

---

## 3. Dynamic Expression Architecture

### 3.1 Top-Left Alignment Expressions

For aligning to the **Top-Left** corner of the content:

#### Anchor Point Expression:
```javascript
const r = sourceRectAtTime(time, false);
[r.left, r.top];
```

#### Position Expression (Scale-Safe):
```javascript
const r = sourceRectAtTime(time, false);
const s = transform.scale / 100;
const target = [r.left, r.top];
const origA = transform.anchorPoint.value;
value + [(target[0] - origA[0]) * s[0], (target[1] - origA[1]) * s[1]];
```

*Note: For a standard text layer where the pre-expression anchor point is `[0, 0]`, `origA` is `[0, 0]`, which reduces cleanly to `value + [r.left * s[0], r.top * s[1]]`.*

### 3.2 Full 9-Point Matrix Expression Formulas

`sourceRectAtTime(time, false)` returns an object `{ left, top, width, height }` describing the exact geometry of the layer's contents:

| Alignment | Target X Formula | Target Y Formula |
|:---|:---|:---|
| **Top-Left** | `r.left` | `r.top` |
| **Top-Center** | `r.left + r.width / 2` | `r.top` |
| **Top-Right** | `r.left + r.width` | `r.top` |
| **Mid-Left** | `r.left` | `r.top + r.height / 2` |
| **Center** | `r.left + r.width / 2` | `r.top + r.height / 2` |
| **Mid-Right** | `r.left + r.width` | `r.top + r.height / 2` |
| **Bottom-Left** | `r.left` | `r.top + r.height` |
| **Bottom-Center** | `r.left + r.width / 2` | `r.top + r.height` |
| **Bottom-Right** | `r.left + r.width` | `r.top + r.height` |

### 3.3 Universal Compatibility

1. **Text Layers (Point & Paragraph Box Text)**:
   Typing new characters, changing font sizes, or adjusting leading immediately recalculates `r.width` and `r.height`. The anchor point and position adapt live without manual realignment.
2. **Shape & Vector Layers**:
   Encompasses the combined extents of all paths, rectangles, ellipses, and polystars inside `Contents`.
3. **Solids, Footage & Precomps**:
   For footage items, `sourceRectAtTime()` yields `{ left: 0, top: 0, width: layer.width, height: layer.height }`. Left edge is `0`, Center is `width / 2`, and Right edge is `width`.
4. **Scale Safety**:
   Multiplying by `transform.scale / 100` ensures that whether scale is 50%, 200%, or non-uniform (e.g. `[150, 75]`), the compensation maintains exact sub-pixel positioning.
5. **Rotation Handling**:
   The full expression includes 2D rotation compensation ($\cos\theta$ and $\sin\theta$) so layers with non-zero rotation remain completely locked in place.

---

## 4. One-Time Bake Mode (Static Execution)

If continuous expression evaluation is not needed (e.g., to maximize playback performance or simplify project handoffs):
- Select **Bake to Static Values** in the UI.
- The script calculates the exact displacement vector $\Delta \mathbf{P}$, sets `Anchor Point` and `Position` to numeric values, and leaves no expressions on the properties.
- Alternatively, for layers with existing expressions, you can select both properties and choose:  
  `Animation > Keyframe Assistant > Convert Expression to Keyframes`.

---

## 5. ScriptUI Interface & Feature Highlights

1. **Header & Status Panel**:
   - Displays script title, version, and active target layer metrics.
2. **Horizontal (X) Controls**:
   - Radio buttons for Left, Center, and Right.
3. **Vertical (Y) Controls**:
   - Radio buttons for Top, Center, and Bottom.
4. **Quick 3×3 Visual Grid**:
   - 9 interactive buttons corresponding to the bounding box anchor points. Clicking any button updates the radio selectors and applies the alignment immediately.
5. **Execution Engine (Default Static Bake & Dynamic Expression Management)**:
   - Defaults to **One-Time Static Bake** for zero runtime overhead.
   - When **Dynamic Expressions** is selected, a dedicated `✕ Clear Expressions` button is directly paired alongside it for one-click expression cleanup.

---

## 6. Compatibility

- **Adobe After Effects**: CC 2014, CC 2015, CC 2018, CC 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026+.
- **AE_JS_builder Web Emulator**: Fully simulated with ScriptUI, SVG vector rendering, and Canvas 2D font metric engine.
