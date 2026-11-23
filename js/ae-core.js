/**
 * Co-authored & architected with Google DeepMind Antigravity.
 * ae-core.js
 * After Effects Object Model, 3D Math, and Expression/Wiggle Engine
 *
 * Technical References & Architecture Guides:
 * - Text Rendering Engine & Discrepancy Guide:
 *   https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
 * - Anchor Point Mathematics & Zero-Shift Compensation:
 *   https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md
 */

(function(global) {
    'use strict';

    // -------------------------------------------------------------
    // 1. Math3D: Vectors and 4x4 Matrices
    // -------------------------------------------------------------
    const DEG2RAD = Math.PI / 180;
    const RAD2DEG = 180 / Math.PI;

    const Mat4 = {
        identity() {
            return [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ];
        },

        multiply(a, b) {
            const out = new Array(16);
            for (let i = 0; i < 4; i++) {
                const ai0 = a[i], ai1 = a[i + 4], ai2 = a[i + 8], ai3 = a[i + 12];
                out[i]      = ai0 * b[0]  + ai1 * b[1]  + ai2 * b[2]  + ai3 * b[3];
                out[i + 4]  = ai0 * b[4]  + ai1 * b[5]  + ai2 * b[6]  + ai3 * b[7];
                out[i + 8]  = ai0 * b[8]  + ai1 * b[9]  + ai2 * b[10] + ai3 * b[11];
                out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
            }
            return out;
        },

        translate(m, v) {
            const x = v[0] || 0, y = v[1] || 0, z = v[2] || 0;
            const out = m.slice();
            out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
            out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
            out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
            out[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
            return out;
        },

        scale(m, v) {
            const x = v[0], y = v[1], z = v[2] === undefined ? 1 : v[2];
            const out = m.slice();
            out[0] *= x; out[1] *= x; out[2] *= x; out[3] *= x;
            out[4] *= y; out[5] *= y; out[6] *= y; out[7] *= y;
            out[8] *= z; out[9] *= z; out[10] *= z; out[11] *= z;
            return out;
        },

        rotateX(m, rad) {
            const s = Math.sin(rad), c = Math.cos(rad);
            const r = [
                1, 0, 0, 0,
                0, c, s, 0,
                0, -s, c, 0,
                0, 0, 0, 1
            ];
            return Mat4.multiply(m, r);
        },

        rotateY(m, rad) {
            const s = Math.sin(rad), c = Math.cos(rad);
            const r = [
                c, 0, -s, 0,
                0, 1, 0, 0,
                s, 0, c, 0,
                0, 0, 0, 1
            ];
            return Mat4.multiply(m, r);
        },

        rotateZ(m, rad) {
            const s = Math.sin(rad), c = Math.cos(rad);
            const r = [
                c, s, 0, 0,
                -s, c, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ];
            return Mat4.multiply(m, r);
        },

        transformPoint(m, v) {
            const x = v[0] || 0, y = v[1] || 0, z = v[2] || 0;
            const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
            return [
                (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
                (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
                (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
            ];
        },

        invert(m) {
            const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
            const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
            const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
            const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

            const b00 = a00 * a11 - a01 * a10;
            const b01 = a00 * a12 - a02 * a10;
            const b02 = a00 * a13 - a03 * a10;
            const b03 = a01 * a12 - a02 * a11;
            const b04 = a01 * a13 - a03 * a11;
            const b05 = a02 * a13 - a03 * a12;
            const b06 = a20 * a31 - a21 * a30;
            const b07 = a20 * a32 - a22 * a30;
            const b08 = a20 * a33 - a23 * a30;
            const b09 = a21 * a32 - a22 * a31;
            const b10 = a21 * a33 - a23 * a31;
            const b11 = a22 * a33 - a23 * a32;

            let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) return Mat4.identity();
            det = 1.0 / det;

            return [
                (a11 * b11 - a12 * b10 + a13 * b09) * det,
                (a02 * b10 - a01 * b11 - a03 * b09) * det,
                (a31 * b05 - a32 * b04 + a33 * b03) * det,
                (a22 * b04 - a21 * b05 - a23 * b03) * det,
                (a12 * b08 - a10 * b11 - a13 * b07) * det,
                (a00 * b11 - a02 * b08 + a03 * b07) * det,
                (a32 * b02 - a30 * b05 - a33 * b01) * det,
                (a20 * b05 - a22 * b02 + a23 * b01) * det,
                (a10 * b10 - a11 * b08 + a13 * b06) * det,
                (a01 * b08 - a00 * b10 - a03 * b06) * det,
                (a30 * b04 - a31 * b02 + a33 * b00) * det,
                (a21 * b02 - a20 * b04 - a23 * b00) * det,
                (a11 * b07 - a10 * b09 - a12 * b06) * det,
                (a00 * b09 - a01 * b07 + a02 * b06) * det,
                (a31 * b01 - a30 * b03 - a32 * b00) * det,
                (a20 * b03 - a21 * b01 + a22 * b00) * det
            ];
        },

        toCSS(m) {
            // matrix3d takes column-major values
            const formatted = m.map(v => (Math.abs(v) < 1e-6 ? 0 : Number(v.toFixed(5))));
            return `matrix3d(${formatted.join(',')})`;
        }
    };

    // -------------------------------------------------------------
    // 2. AE Wiggle Noise Generator (Perlin-like smooth noise)
    // -------------------------------------------------------------
    class WiggleGenerator {
        constructor() {
            this.seed = 1337;
        }

        // Fast hash for 1D float
        hash(i) {
            const n = Math.sin(i * 12.9898 + this.seed) * 43758.5453;
            return (n - Math.floor(n)) * 2 - 1; // -1 to 1
        }

        // Cubic hermite interpolation
        smooth(t) {
            return t * t * (3 - 2 * t);
        }

        noise1D(x) {
            const i = Math.floor(x);
            const f = x - i;
            const w = this.smooth(f);
            return this.hash(i) * (1 - w) + this.hash(i + 1) * w;
        }

        wiggle(freq, amp, time, channelOffset = 0) {
            if (!freq || !amp) return 0;
            const t = time * freq + channelOffset * 31.415;
            return this.noise1D(t) * amp;
        }
    }

    const wiggleGen = new WiggleGenerator();

    // -------------------------------------------------------------
    // 3. AE Property & PropertyGroup Model
    // -------------------------------------------------------------
    const propertyRegistry = new Map();
    let propIdCounter = 0;

    function prepareExpressionBody(code) {
        let clean = (code || '').trim();
        if (!clean) return 'return value;';
        if (/\breturn\s+/.test(clean)) {
            return clean;
        }
        return 'return eval(' + JSON.stringify(clean) + ');';
    }

    class PropertyBase {
        constructor(name, matchName) {
            this.name = name;
            this.matchName = matchName || name;
            this.parentProperty = null;
            this.enabled = true;
        }

        property(nameOrIndex) {
            return null;
        }

        remove() {
            if (this.parentProperty && this.parentProperty.properties) {
                const idx = this.parentProperty.properties.indexOf(this);
                if (idx !== -1) {
                    this.parentProperty.properties.splice(idx, 1);
                    if (this.parentProperty._notifyChange) {
                        this.parentProperty._notifyChange();
                    }
                }
            }
        }
    }

    class Property extends PropertyBase {
        constructor(name, matchName, defaultValue, type = 'number') {
            super(name, matchName);
            this._id = 'prop_' + (++propIdCounter);
            propertyRegistry.set(this._id, this);

            this.type = type; // 'number', '2d', '3d', 'color', 'boolean'
            this._baseValue = this._clone(defaultValue);
            this._expression = '';
            this.expressionEnabled = true;
            this.animMode = (type === 'color') ? 'orig' : (type === 'boolean' ? 'default' : 'base');
            this._frozenTime = null;
            this._frozenValue = null;
            this._cachedTime = null;
            this._cachedValue = this._clone(defaultValue);
        }

        get id() {
            return this._id;
        }

        get expression() {
            return this._expression;
        }

        set expression(val) {
            this._expression = String(val || '');
            if (this._expression.trim()) {
                this.expressionEnabled = true;
                if (this.type === 'color') {
                    if (!this.animMode || this.animMode === 'base') {
                        this.animMode = 'orig';
                    }
                } else if (this.type === 'boolean') {
                    if (!this.animMode || this.animMode === 'base') {
                        this.animMode = 'default';
                    }
                } else if (!this.animMode || this.animMode === 'base') {
                    this.animMode = 'wiggle';
                }
            }
            this.clearCache();
            this._notifyChange();
        }

        _clone(val) {
            if (Array.isArray(val)) return val.slice();
            return val;
        }

        setValue(val) {
            this._baseValue = this._clone(val);
            this.clearCache();
            this._notifyChange();
        }

        get value() {
            const t = (Property._currentEvaluationTime !== null && Property._currentEvaluationTime !== undefined)
                ? Property._currentEvaluationTime
                : (this.getRootComp()?.time || 0);
            return this.getValueAtTime(t);
        }

        get 0() {
            const v = this.value;
            return Array.isArray(v) ? v[0] : (typeof v === 'number' ? v : undefined);
        }

        get 1() {
            const v = this.value;
            return Array.isArray(v) ? v[1] : undefined;
        }

        get 2() {
            const v = this.value;
            return Array.isArray(v) ? v[2] : undefined;
        }

        get 3() {
            const v = this.value;
            return Array.isArray(v) ? v[3] : undefined;
        }

        get length() {
            const v = this.value;
            return Array.isArray(v) ? v.length : 1;
        }

        valueOf() {
            return this.value;
        }

        [Symbol.toPrimitive](hint) {
            if (hint === 'string') return String(this.value);
            return this.value;
        }

        _isColor255() {
            if (Array.isArray(this._baseValue) && this._baseValue.length >= 3) {
                return Math.max(this._baseValue[0] || 0, this._baseValue[1] || 0, this._baseValue[2] || 0) > 1.0;
            }
            return false;
        }

        _makeRandomFixedColor() {
            const is255 = this._isColor255();
            const scale = is255 ? 255 : 1.0;
            const hue = Math.random();
            const rgb = Property.hsvToRgb(hue, 0.85, 0.95);
            return [rgb[0] * scale, rgb[1] * scale, rgb[2] * scale, scale];
        }

        _makeCircleColor(time) {
            const is255 = this._isColor255();
            const scale = is255 ? 255 : 1.0;
            if (time === undefined || time === null) {
                time = (Property._currentEvaluationTime !== null && Property._currentEvaluationTime !== undefined)
                    ? Property._currentEvaluationTime
                    : (this.getRootComp()?.time || 0);
            }
            // Circle around the whole RGB spectrum once every 5 seconds (full saturation & brightness)
            const hue = ((time / 5.0) % 1.0 + 1.0) % 1.0;
            const rgb = Property.hsvToRgb(hue, 1.0, 1.0);
            return [rgb[0] * scale, rgb[1] * scale, rgb[2] * scale, scale];
        }

        _makeWiggleColor(time) {
            const is255 = this._isColor255();
            const scale = is255 ? 255 : 1.0;
            const base = Array.isArray(this._baseValue) ? this._baseValue : [1, 1, 1];
            const nr = (base[0] || 0) / scale;
            const ng = (base[1] || 0) / scale;
            const nb = (base[2] || 0) / scale;

            const wr = Math.max(0, Math.min(1, nr + wiggleGen.wiggle(0.75, 0.35, time, 10)));
            const wg = Math.max(0, Math.min(1, ng + wiggleGen.wiggle(0.75, 0.35, time, 11)));
            const wb = Math.max(0, Math.min(1, nb + wiggleGen.wiggle(0.75, 0.35, time, 12)));
            return [wr * scale, wg * scale, wb * scale, scale];
        }

        _makeHalfOpacityColor() {
            const is255 = this._isColor255();
            const base = Array.isArray(this._baseValue) ? this._clone(this._baseValue) : [1, 1, 1];
            return [base[0] || 0, base[1] || 0, base[2] || 0, is255 ? 128 : 0.5];
        }

        _makeTransparentColor() {
            const base = Array.isArray(this._baseValue) ? this._clone(this._baseValue) : [1, 1, 1];
            return [base[0] || 0, base[1] || 0, base[2] || 0, 0.0];
        }

        static hsvToRgb(h, s, v) {
            let r = 0, g = 0, b = 0;
            const i = Math.floor(h * 6);
            const f = h * 6 - i;
            const p = v * (1 - s);
            const q = v * (1 - f * s);
            const t = v * (1 - (1 - f) * s);
            switch (i % 6) {
                case 0: r = v; g = t; b = p; break;
                case 1: r = q; g = v; b = p; break;
                case 2: r = p; g = v; b = t; break;
                case 3: r = p; g = q; b = v; break;
                case 4: r = t; g = p; b = v; break;
                case 5: r = v; g = p; b = q; break;
            }
            return [r, g, b];
        }

        getValueAtTime(time) {
            if (time === undefined || time === null) {
                time = (Property._currentEvaluationTime !== null && Property._currentEvaluationTime !== undefined)
                    ? Property._currentEvaluationTime
                    : (this.getRootComp()?.time || 0);
            }

            const isColor = (this.type === 'color');
            const isBool = (this.type === 'boolean');
            const defaultMode = isColor ? 'orig' : (isBool ? 'default' : 'base');
            let mode = this.animMode;
            if (!mode || (isColor && mode === 'base') || (isBool && mode === 'base')) {
                mode = defaultMode;
            }

            // 1. Frozen / Stop mode
            if (mode === 'stop') {
                if (this._frozenValue !== null && this._frozenValue !== undefined) {
                    return this._clone(this._frozenValue);
                }
                time = (this._frozenTime !== null) ? this._frozenTime : 0;
            }

            // 2. Boolean Property special modes (Default | True | False | Blink)
            if (isBool) {
                if (mode === 'true') {
                    return 1;
                }
                if (mode === 'false') {
                    return 0;
                }
                if (mode === 'blink') {
                    // Blink at 1 Hz (1 blink per second: 0.5s ON, 0.5s OFF)
                    const cycle = ((Math.floor(time * 2) % 2) + 2) % 2;
                    return (cycle === 0) ? 1 : 0;
                }
                // 'default' mode: evaluate expression if present and enabled; otherwise return base value
                if (this._expression && this.expressionEnabled) {
                    const evaluated = this.evaluateExpression(time);
                    return Boolean(evaluated) ? 1 : 0;
                }
                return this._clone(this._baseValue);
            }

            // 2. Color Property special modes (Orig | Rand | Circle | Wiggle | Half | Transparent)
            if (isColor) {
                if (mode === 'rand') {
                    if (!this._randomFixedColor) {
                        this._randomFixedColor = this._makeRandomFixedColor();
                    }
                    return this._clone(this._randomFixedColor);
                }
                if (mode === 'circle') {
                    return this._makeCircleColor(time);
                }
                if (mode === 'wiggle') {
                    return this._makeWiggleColor(time);
                }
                if (mode === 'half') {
                    return this._makeHalfOpacityColor();
                }
                if (mode === 'transparent') {
                    return this._makeTransparentColor();
                }
                // 'orig' mode: if has expression, evaluate expression below; otherwise return _baseValue
                if (mode === 'orig' && (!this._expression || !this.expressionEnabled)) {
                    return this._clone(this._baseValue);
                }
            }

            // 3. Has expression and enabled
            if (this._expression && this.expressionEnabled) {
                return this.evaluateExpression(time);
            }

            // 4. BASE mode without expression
            if (mode === 'base' || mode === 'stop' || mode === 'orig') {
                return this._clone(this._baseValue);
            }

            // 4. Dynamic Wiggle / Rand on properties without explicit expressions
            if (mode === 'wiggle' || mode === 'rand') {
                const isRand = (mode === 'rand');
                const evalTime = isRand ? (time + Math.sin(time * 25) * 0.15) : time;
                const jitterScale = isRand ? 1.4 : 1.0;
                const base = this._baseValue;

                if (typeof base === 'number') {
                    const amp = Math.max(5, Math.abs(base) * 0.15) * jitterScale;
                    return base + wiggleGen.wiggle(1.0, amp, evalTime, 0);
                } else if (Array.isArray(base)) {
                    return base.map((v, idx) => {
                        if (typeof v === 'number') {
                            const amp = Math.max(5, Math.abs(v) * 0.15) * jitterScale;
                            return v + wiggleGen.wiggle(1.0, amp, evalTime, idx + 1);
                        }
                        return v;
                    });
                }
            }

            return this._clone(this._baseValue);
        }

        clearCache() {
            this._cachedTime = null;
        }

        getRootComp() {
            let p = this.parentProperty;
            while (p && p.parentProperty) {
                p = p.parentProperty;
            }
            return (p && p.containingComp) ? p.containingComp : (app?.project?.activeItem || null);
        }

        getLayer() {
            let p = this.parentProperty;
            while (p && !(p instanceof Layer)) {
                p = p.parentProperty;
            }
            return p;
        }

        evaluateExpression(time) {
            const base = this._clone(this._baseValue);
            const expr = this._expression.trim();
            if (!expr || !this.expressionEnabled) return base;

            const layer = this.getLayer();
            const rootComp = this.getRootComp();
            const isColor = (this.type === 'color');
            const animMode = this.animMode || (isColor ? 'orig' : (expr ? 'wiggle' : 'base'));

            // BASE/ORIG mode: return static base value without evaluating animation, UNLESS it's a procedural path expression, color expression, or enabled expression
            if (animMode === 'base' && this.type !== 'shape' && !this.expressionEnabled) {
                return base;
            }

            // STOP mode: return frozen value or freeze time
            if (animMode === 'stop') {
                if (this._frozenValue !== null && this._frozenValue !== undefined) {
                    return this._clone(this._frozenValue);
                }
                time = (this._frozenTime !== null) ? this._frozenTime : 0;
            }

            // RAND mode: add randomized jitter / noise (for numeric properties only, not colors)
            const isRand = (animMode === 'rand' && !isColor);
            const evalTime = isRand ? (time + Math.sin(time * 25) * 0.15) : time;
            const jitterScale = isRand ? 1.4 : 1.0;

            // Handle standard wiggle(freq, amp)
            const wiggleMatch = expr.match(/^wiggle\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
            if (wiggleMatch) {
                const freq = parseFloat(wiggleMatch[1]) * (isRand ? 1.6 : 1.0);
                const amp = parseFloat(wiggleMatch[2]) * jitterScale;
                if (Array.isArray(base)) {
                    return base.map((v, idx) => v + wiggleGen.wiggle(freq, amp, evalTime, idx + 1));
                }
                return base + wiggleGen.wiggle(freq, amp, evalTime, 0);
            }

            // General JS expression sandbox with full AE standard API
            const prevEvalTime = Property._currentEvaluationTime;
            Property._currentEvaluationTime = evalTime;
            try {
                const value = base;
                const degreesToRadians = (deg) => (deg * Math.PI) / 180;
                const radiansToDegrees = (rad) => (rad * 180) / Math.PI;
                const createPath = (points = [], inTangents = [], outTangents = [], is_closed = true) => {
                    const shp = new Shape();
                    shp.vertices = points || [];
                    shp.inTangents = inTangents || [];
                    shp.outTangents = outTangents || [];
                    shp.closed = (is_closed !== undefined ? Boolean(is_closed) : true);
                    return shp;
                };

                const wiggle = (f, a, octaves, ampMult, t) => {
                    const freq = f * (isRand ? 1.6 : 1.0);
                    const amp = a * jitterScale;
                    const evalT = (t !== undefined) ? t : evalTime;
                    const lIdx = (layer && layer.index !== undefined) ? layer.index : (layer && layer._id !== undefined ? layer._id : 1);
                    const layerOffset = lIdx * 19.73 + (rndState % 1000) * 0.01;
                    if (Array.isArray(value)) {
                        return value.map((v, i) => v + wiggleGen.wiggle(freq, amp, evalT, layerOffset + (i + 1) * 31.415));
                    }
                    return value + wiggleGen.wiggle(freq, amp, evalT, layerOffset);
                };
                let rndState = 12345;
                const seedRandom = (seed, timeless) => {
                    rndState = (Math.abs(Math.floor(seed)) % 2147483647) || 1;
                };
                const random = (min, max) => {
                    rndState = (rndState * 48271) % 2147483647;
                    const r = (rndState - 1) / 2147483646;
                    if (min === undefined) return r;
                    if (max === undefined) return r * min;
                    return min + r * (max - min);
                };

                const effect = (name) => (layer ? layer.effect(name) : null);
                const thisComp = rootComp;
                const thisLayer = layer;
                const parent = (layer && layer.parent) ? layer.parent : null;
                const transform = layer ? layer.transform : null;
                const comp = (name) => {
                    if (!name) return rootComp;
                    const project = app?.project;
                    if (!project) return null;
                    return project.items.find(item => item.name === name) || null;
                };
                const sourceRectAtTime = (t, includeExtents) => {
                    if (layer && typeof layer.sourceRectAtTime === 'function') {
                        return layer.sourceRectAtTime(t !== undefined ? t : evalTime, includeExtents);
                    }
                    return { top: 0, left: 0, width: 100, height: 40 };
                };
                const unwrapVal = (v) => (v instanceof Property) ? v.value : v;
                const interpVal = (v1, v2, p) => {
                    const a = unwrapVal(v1);
                    const b = unwrapVal(v2);
                    if (Array.isArray(a) && Array.isArray(b)) {
                        return a.map((item, idx) => {
                            const n1 = Number(unwrapVal(item)) || 0;
                            const n2 = Number(unwrapVal(b[idx] !== undefined ? b[idx] : item)) || 0;
                            return n1 + (n2 - n1) * p;
                        });
                    }
                    const n1 = Number(a) || 0;
                    const n2 = Number(b) || 0;
                    return n1 + (n2 - n1) * p;
                };
                const linear = function(t, tMin, tMax, value1, value2) {
                    const tv = Number(unwrapVal(t)) || 0;
                    if (arguments.length === 3) {
                        const p = Math.max(0, Math.min(1, tv));
                        return interpVal(tMin, tMax, p);
                    }
                    const minT = Number(unwrapVal(tMin)) || 0;
                    const maxT = Number(unwrapVal(tMax)) || 0;
                    const span = maxT - minT;
                    const p = Math.abs(span) < 1e-9 ? (tv >= maxT ? 1 : 0) : Math.max(0, Math.min(1, (tv - minT) / span));
                    return interpVal(value1, value2, p);
                };
                const ease = function(t, tMin, tMax, value1, value2) {
                    const tv = Number(unwrapVal(t)) || 0;
                    if (arguments.length === 3) {
                        const p = Math.max(0, Math.min(1, tv));
                        const e = p * p * (3 - 2 * p);
                        return interpVal(tMin, tMax, e);
                    }
                    const minT = Number(unwrapVal(tMin)) || 0;
                    const maxT = Number(unwrapVal(tMax)) || 0;
                    const span = maxT - minT;
                    const p = Math.abs(span) < 1e-9 ? (tv >= maxT ? 1 : 0) : Math.max(0, Math.min(1, (tv - minT) / span));
                    const e = p * p * (3 - 2 * p);
                    return interpVal(value1, value2, e);
                };
                const easeIn = ease;
                const easeOut = ease;
                const clamp = (val, limit1, limit2) => {
                    const v = unwrapVal(val);
                    const l1 = Number(unwrapVal(limit1)) || 0;
                    const l2 = Number(unwrapVal(limit2)) || 0;
                    const lo = Math.min(l1, l2);
                    const hi = Math.max(l1, l2);
                    if (Array.isArray(v)) {
                        return v.map(x => Math.max(lo, Math.min(hi, Number(unwrapVal(x)) || 0)));
                    }
                    return Math.max(lo, Math.min(hi, Number(v) || 0));
                };

                let res;
                try {
                    const evalBody = 'return eval(' + JSON.stringify(expr) + ');';
                    const fn = new Function(
                        'time', 'value', 'layer', 'thisLayer', 'parent', 'thisComp', 'comp', 'transform', 'wiggle', 'effect',
                        'degreesToRadians', 'radiansToDegrees', 'createPath', 'seedRandom', 'random',
                        'linear', 'ease', 'easeIn', 'easeOut', 'clamp', 'sourceRectAtTime', 'Math',
                        `"use strict";\n${evalBody}`
                    );
                    res = fn(evalTime, value, layer, thisLayer, parent, thisComp, comp, transform, wiggle, effect, degreesToRadians, radiansToDegrees, createPath, seedRandom, random, linear, ease, easeIn, easeOut, clamp, sourceRectAtTime, Math);
                } catch (evalErr) {
                    try {
                        const fn = new Function(
                            'time', 'value', 'layer', 'thisLayer', 'parent', 'thisComp', 'comp', 'transform', 'wiggle', 'effect',
                            'degreesToRadians', 'radiansToDegrees', 'createPath', 'seedRandom', 'random',
                            'linear', 'ease', 'easeIn', 'easeOut', 'clamp', 'sourceRectAtTime', 'Math',
                            `"use strict";\n${expr}`
                        );
                        res = fn(evalTime, value, layer, thisLayer, parent, thisComp, comp, transform, wiggle, effect, degreesToRadians, radiansToDegrees, createPath, seedRandom, random, linear, ease, easeIn, easeOut, clamp, sourceRectAtTime, Math);
                    } catch (fnErr) {
                        console.warn('[AE Expression Error]', fnErr);
                    }
                }

                if (res === undefined) {
                    try {
                        const fn = new Function(
                            'time', 'value', 'layer', 'thisLayer', 'parent', 'thisComp', 'comp', 'transform', 'wiggle', 'effect',
                            'degreesToRadians', 'radiansToDegrees', 'createPath', 'seedRandom', 'random',
                            'linear', 'ease', 'easeIn', 'easeOut', 'clamp', 'sourceRectAtTime', 'Math',
                            `"use strict";\n${expr}`
                        );
                        res = fn(evalTime, value, layer, thisLayer, parent, thisComp, comp, transform, wiggle, effect, degreesToRadians, radiansToDegrees, createPath, seedRandom, random, linear, ease, easeIn, easeOut, clamp, sourceRectAtTime, Math);
                    } catch (e) {}
                }

                if (res !== undefined && res !== null) {
                    if (res instanceof Property) return res.value;
                    if (Array.isArray(res)) {
                        const unwrapped = res.map(item => (item instanceof Property) ? item.value : item);
                        if (Array.isArray(base) && base.length === 2 && unwrapped.length >= 2) {
                            return [unwrapped[0], unwrapped[1]];
                        }
                        return unwrapped;
                    }
                    return res;
                }
                return base;
            } catch (err) {
                console.warn('[AE Expression Error]', err);
                return base;
            } finally {
                Property._currentEvaluationTime = prevEvalTime;
            }
        }

        _notifyChange() {
            const comp = this.getRootComp();
            if (comp && comp._onChanged) comp._onChanged();
        }
    }

    class PropertyGroup extends PropertyBase {
        constructor(name, matchName) {
            super(name, matchName);
            this.properties = [];
        }

        addProperty(nameOrMatchName) {
            let prop = null;
            switch (nameOrMatchName) {
                case 'ADBE Vector Group':
                case 'Group':
                    prop = new VectorGroup('Group ' + (this.properties.length + 1));
                    break;
                case 'ADBE Vector Shape - Rect':
                case 'Rectangle':
                case 'Rect':
                    prop = new VectorShapeRect();
                    break;
                case 'ADBE Vector Shape - Ellipse':
                case 'Ellipse':
                case 'Circle':
                    prop = new VectorShapeEllipse();
                    break;
                case 'ADBE Vector Shape - Star':
                case 'ADBE Vector Shape - Polystar':
                case 'Polystar':
                case 'Star':
                case 'Polygon':
                    prop = new VectorShapeStar();
                    break;
                case 'ADBE Vector Shape - Group':
                case 'ADBE Vector Shape - Path':
                case 'Path':
                    prop = new VectorShapePath();
                    break;
                case 'ADBE Vector Graphic - Fill':
                case 'Fill':
                    prop = new VectorGraphicFill();
                    break;
                case 'ADBE Vector Graphic - G-Fill':
                case 'Gradient Fill':
                case 'G-Fill':
                    prop = new VectorGraphicGradientFill();
                    break;
                case 'ADBE Vector Graphic - Stroke':
                case 'Stroke':
                    prop = new VectorGraphicStroke();
                    break;
                case 'ADBE Vector Graphic - G-Stroke':
                case 'Gradient Stroke':
                case 'G-Stroke':
                    prop = new VectorGraphicGradientStroke();
                    break;
                case 'ADBE Vector Taper':
                case 'Taper':
                    if (this.taper) {
                        return this.taper;
                    }
                    const taperGroup = new PropertyGroup('Taper', 'ADBE Vector Taper');
                    taperGroup.startLength = new Property('Start Length', 'ADBE Vector Taper Start Length', 0, 'number');
                    taperGroup.endLength = new Property('End Length', 'ADBE Vector Taper End Length', 0, 'number');
                    taperGroup.startWidth = new Property('Start Width', 'ADBE Vector Taper Start Width', 0, 'number');
                    taperGroup.endWidth = new Property('End Width', 'ADBE Vector Taper End Width', 0, 'number');
                    taperGroup.startEase = new Property('Start Ease', 'ADBE Vector Taper Start Ease', 0, 'number');
                    taperGroup.endEase = new Property('End Ease', 'ADBE Vector Taper End Ease', 0, 'number');
                    taperGroup.lengthUnits = new Property('Length Units', 'ADBE Vector Taper Length Units', 1, 'number');
                    [taperGroup.startLength, taperGroup.endLength, taperGroup.startWidth, taperGroup.endWidth, taperGroup.startEase, taperGroup.endEase, taperGroup.lengthUnits].forEach(tp => {
                        tp.parentProperty = taperGroup;
                        taperGroup.properties.push(tp);
                    });
                    prop = taperGroup;
                    break;
                case 'ADBE Vector Stroke Dash 1':
                case 'ADBE Vector Stroke Dash 2':
                case 'ADBE Vector Stroke Dash 3':
                case 'Dash':
                case 'Dash 1':
                case 'Dash 2':
                    prop = new Property(nameOrMatchName, 'ADBE Vector Stroke Dash', 10, 'number');
                    break;
                case 'ADBE Vector Stroke Gap 1':
                case 'ADBE Vector Stroke Gap 2':
                case 'ADBE Vector Stroke Gap 3':
                case 'Gap':
                case 'Gap 1':
                case 'Gap 2':
                    prop = new Property(nameOrMatchName, 'ADBE Vector Stroke Gap', 10, 'number');
                    break;
                case 'ADBE Vector Stroke Offset':
                case 'Offset':
                    prop = new Property('Offset', 'ADBE Vector Stroke Offset', 0, 'number');
                    break;
                case 'ADBE Vector Filter - Trim':
                case 'Trim Paths':
                    prop = new PropertyGroup('Trim Paths 1', 'ADBE Vector Filter - Trim');
                    prop.start = new Property('Start', 'ADBE Vector Trim Start', 0, 'number');
                    prop.end = new Property('End', 'ADBE Vector Trim End', 100, 'number');
                    prop.offset = new Property('Offset', 'ADBE Vector Trim Offset', 0, 'number');
                    [prop.start, prop.end, prop.offset].forEach(tp => {
                        tp.parentProperty = prop;
                        prop.properties.push(tp);
                    });
                    break;
                case 'ADBE Checkbox Control':
                case 'Checkbox Control':
                    prop = new EffectCheckboxControl();
                    break;
                case 'ADBE Slider Control':
                case 'Slider Control':
                    prop = new EffectSliderControl();
                    break;
                case 'ADBE Color Control':
                case 'Color Control':
                    prop = new EffectColorControl();
                    break;
                case 'ADBE Point Control':
                case 'Point Control':
                    prop = new EffectPointControl();
                    break;
                default:
                    prop = new PropertyGroup(nameOrMatchName, nameOrMatchName);
                    break;
            }

            if (prop) {
                prop.parentProperty = this;
                this.properties.push(prop);
                const comp = (this.getLayer && this.getLayer())?.containingComp || app?.project?.activeItem;
                if (comp && comp._onChanged) comp._onChanged();
            }
            return prop;
        }

        getLayer() {
            let p = this.parentProperty;
            while (p && !(p instanceof Layer)) {
                p = p.parentProperty;
            }
            return p;
        }

        property(nameOrIndex) {
            if (typeof nameOrIndex === 'number') {
                return this.properties[nameOrIndex - 1] || null; // 1-indexed in AE
            }
            const clean = String(nameOrIndex).toLowerCase();
            // 1. Exact match by name or matchName takes strict precedence
            const exact = this.properties.find(p =>
                p.name.toLowerCase() === clean ||
                p.matchName.toLowerCase() === clean
            );
            if (exact) return exact;
            // 2. Fallback partial/substring match ONLY if no exact match exists
            const partial = this.properties.find(p =>
                p.name.toLowerCase().includes(clean)
            );
            if (partial) return partial;
            if (this.taper && this.taper.properties) {
                const sub = this.taper.property(nameOrIndex);
                if (sub) return sub;
            }
            return null;
        }

        get numProperties() {
            return this.properties.length;
        }
    }

    // -------------------------------------------------------------
    // 4. Vector Shapes & Graphics (Contents)
    // -------------------------------------------------------------
    class VectorGroup extends PropertyGroup {
        constructor(name = 'Group 1') {
            super(name, 'ADBE Vector Group');
            this.contents = new PropertyGroup('Contents', 'ADBE Vectors Group');
            this.contents.parentProperty = this;
            this.transform = new VectorTransformGroup();
            this.transform.parentProperty = this;

            this.properties.push(this.contents);
            this.properties.push(this.transform);
        }

        property(nameOrIndex) {
            if (nameOrIndex === 'Contents' || nameOrIndex === 'ADBE Vectors Group' || nameOrIndex === 1) return this.contents;
            if (nameOrIndex === 'Transform' || nameOrIndex === 'ADBE Vector Transform Group' || nameOrIndex === 2) return this.transform;
            return super.property(nameOrIndex);
        }
    }

    class VectorTransformGroup extends PropertyGroup {
        constructor() {
            super('Transform', 'ADBE Vector Transform Group');
            this.anchorPoint = new Property('Anchor Point', 'ADBE Vector Anchor Point', [0, 0], '2d');
            this.position    = new Property('Position', 'ADBE Vector Position', [0, 0], '2d');
            this.scale       = new Property('Scale', 'ADBE Vector Scale', [100, 100], '2d');
            this.rotation    = new Property('Rotation', 'ADBE Vector Rotation', 0, 'number');
            this.opacity     = new Property('Opacity', 'ADBE Vector Group Opacity', 100, 'number');

            [this.anchorPoint, this.position, this.scale, this.rotation, this.opacity].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    class VectorShapeRect extends PropertyGroup {
        constructor() {
            super('Rectangle Path 1', 'ADBE Vector Shape - Rect');
            this.size      = new Property('Size', 'ADBE Vector Rect Size', [100, 100], '2d');
            this.position  = new Property('Position', 'ADBE Vector Rect Position', [0, 0], '2d');
            this.roundness = new Property('Roundness', 'ADBE Vector Rect Roundness', 0, 'number');

            [this.size, this.position, this.roundness].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    class VectorShapeEllipse extends PropertyGroup {
        constructor() {
            super('Ellipse Path 1', 'ADBE Vector Shape - Ellipse');
            this.size     = new Property('Size', 'ADBE Vector Ellipse Size', [100, 100], '2d');
            this.position = new Property('Position', 'ADBE Vector Ellipse Position', [0, 0], '2d');

            [this.size, this.position].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    class VectorShapeStar extends PropertyGroup {
        constructor() {
            super('Polystar Path 1', 'ADBE Vector Shape - Star');
            this.type           = new Property('Type', 'ADBE Vector Star Type', 1, 'number'); // 1: Star, 2: Polygon
            this.points         = new Property('Points', 'ADBE Vector Star Points', 5, 'number');
            this.position       = new Property('Position', 'ADBE Vector Star Position', [0, 0], '2d');
            this.rotation       = new Property('Rotation', 'ADBE Vector Star Rotation', 0, 'number');
            this.outerRadius    = new Property('Outer Radius', 'ADBE Vector Star Outer Radius', 50, 'number');
            this.outerRoundness = new Property('Outer Roundness', 'ADBE Vector Star Outer Roundness', 0, 'number');
            this.innerRadius    = new Property('Inner Radius', 'ADBE Vector Star Inner Radius', 25, 'number');
            this.innerRoundness = new Property('Inner Roundness', 'ADBE Vector Star Inner Roundness', 0, 'number');

            [this.type, this.points, this.position, this.rotation, this.outerRadius, this.outerRoundness, this.innerRadius, this.innerRoundness].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    // Bezier Shape Path Object
    class Shape {
        constructor() {
            this.vertices = [];     // Array of [x, y]
            this.inTangents = [];   // Array of [x, y] relative to vertex
            this.outTangents = [];  // Array of [x, y] relative to vertex
            this.closed = true;
        }
    }

    class VectorShapePath extends PropertyGroup {
        constructor() {
            super('Path 1', 'ADBE Vector Shape - Group');
            const defaultShape = new Shape();
            defaultShape.vertices = [[-50, -50], [50, -50], [50, 50], [-50, 50]];
            defaultShape.inTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
            defaultShape.outTangents = [[0, 0], [0, 0], [0, 0], [0, 0]];
            defaultShape.closed = true;

            this.path = new Property('Path', 'ADBE Vector Shape', defaultShape, 'shape');
            this.path.parentProperty = this;
            this.properties.push(this.path);
        }

        property(nameOrIndex) {
            if (nameOrIndex === 'Path' || nameOrIndex === 'ADBE Vector Shape' || nameOrIndex === 1) return this.path;
            return super.property(nameOrIndex);
        }
    }

    class VectorGraphicFill extends PropertyGroup {
        constructor() {
            super('Fill 1', 'ADBE Vector Graphic - Fill');
            this.color   = new Property('Color', 'ADBE Vector Fill Color', [0.85, 0.2, 0.2], 'color'); // 0-1 RGB
            this.opacity = new Property('Opacity', 'ADBE Vector Fill Opacity', 100, 'number');

            [this.color, this.opacity].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    class VectorGraphicGradientFill extends PropertyGroup {
        constructor() {
            super('Gradient Fill 1', 'ADBE Vector Graphic - G-Fill');
            this.type       = new Property('Type', 'ADBE Vector Grad Type', 1, 'number'); // 1: Linear, 2: Radial
            this.startPoint = new Property('Start Point', 'ADBE Vector Grad Start Pt', [-50, 0], '2d');
            this.endPoint   = new Property('End Point', 'ADBE Vector Grad End Pt', [50, 0], '2d');
            this.colors     = new Property('Colors', 'ADBE Vector Grad Colors', [[0, [1, 0, 0]], [1, [0, 0, 1]]], 'gradient');
            this.opacity    = new Property('Opacity', 'ADBE Vector Grad Opacity', 100, 'number');

            [this.type, this.startPoint, this.endPoint, this.colors, this.opacity].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    class VectorGraphicStroke extends PropertyGroup {
        constructor() {
            super('Stroke 1', 'ADBE Vector Graphic - Stroke');
            this.color       = new Property('Color', 'ADBE Vector Stroke Color', [1, 1, 1], 'color');
            this.strokeWidth = new Property('Stroke Width', 'ADBE Vector Stroke Width', 2, 'number');
            this.opacity     = new Property('Opacity', 'ADBE Vector Stroke Opacity', 100, 'number');
            this.lineCap     = new Property('Line Cap', 'ADBE Vector Stroke Line Cap', 1, 'number'); // 1: Butt, 2: Round, 3: Projecting
            this.lineJoin    = new Property('Line Join', 'ADBE Vector Stroke Line Join', 1, 'number'); // 1: Miter, 2: Round, 3: Bevel
            this.miterLimit  = new Property('Miter Limit', 'ADBE Vector Stroke Miter Limit', 4, 'number');
            this.dashes      = new PropertyGroup('Dashes', 'ADBE Vector Stroke Dashes');
            this.dashes.parentProperty = this;

            this.taper       = new PropertyGroup('Taper', 'ADBE Vector Taper');
            this.taper.parentProperty = this;
            this.taper.startLength = new Property('Start Length', 'ADBE Vector Taper Start Length', 0, 'number');
            this.taper.endLength = new Property('End Length', 'ADBE Vector Taper End Length', 0, 'number');
            this.taper.startWidth = new Property('Start Width', 'ADBE Vector Taper Start Width', 0, 'number');
            this.taper.endWidth = new Property('End Width', 'ADBE Vector Taper End Width', 0, 'number');
            this.taper.startEase = new Property('Start Ease', 'ADBE Vector Taper Start Ease', 0, 'number');
            this.taper.endEase = new Property('End Ease', 'ADBE Vector Taper End Ease', 0, 'number');
            this.taper.lengthUnits = new Property('Length Units', 'ADBE Vector Taper Length Units', 1, 'number');
            [this.taper.startLength, this.taper.endLength, this.taper.startWidth, this.taper.endWidth, this.taper.startEase, this.taper.endEase, this.taper.lengthUnits].forEach(tp => {
                tp.parentProperty = this.taper;
                this.taper.properties.push(tp);
            });

            [this.color, this.strokeWidth, this.opacity, this.lineCap, this.lineJoin, this.miterLimit, this.dashes, this.taper].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    class VectorGraphicGradientStroke extends PropertyGroup {
        constructor() {
            super('Gradient Stroke 1', 'ADBE Vector Graphic - G-Stroke');
            this.type        = new Property('Type', 'ADBE Vector Grad Type', 1, 'number'); // 1: Linear, 2: Radial
            this.startPoint  = new Property('Start Point', 'ADBE Vector Grad Start Pt', [-50, 0], '2d');
            this.endPoint    = new Property('End Point', 'ADBE Vector Grad End Pt', [50, 0], '2d');
            this.colors      = new Property('Colors', 'ADBE Vector Grad Colors', [[0, [1, 1, 1]], [1, [0.2, 0.5, 1]]], 'gradient');
            this.opacity     = new Property('Opacity', 'ADBE Vector Grad Opacity', 100, 'number');
            this.strokeWidth = new Property('Stroke Width', 'ADBE Vector Stroke Width', 2, 'number');
            this.lineCap     = new Property('Line Cap', 'ADBE Vector Stroke Line Cap', 1, 'number');
            this.lineJoin    = new Property('Line Join', 'ADBE Vector Stroke Line Join', 1, 'number');
            this.miterLimit  = new Property('Miter Limit', 'ADBE Vector Stroke Miter Limit', 4, 'number');
            this.dashes      = new PropertyGroup('Dashes', 'ADBE Vector Stroke Dashes');
            this.dashes.parentProperty = this;

            this.taper       = new PropertyGroup('Taper', 'ADBE Vector Taper');
            this.taper.parentProperty = this;
            this.taper.startLength = new Property('Start Length', 'ADBE Vector Taper Start Length', 0, 'number');
            this.taper.endLength = new Property('End Length', 'ADBE Vector Taper End Length', 0, 'number');
            this.taper.startWidth = new Property('Start Width', 'ADBE Vector Taper Start Width', 0, 'number');
            this.taper.endWidth = new Property('End Width', 'ADBE Vector Taper End Width', 0, 'number');
            this.taper.startEase = new Property('Start Ease', 'ADBE Vector Taper Start Ease', 0, 'number');
            this.taper.endEase = new Property('End Ease', 'ADBE Vector Taper End Ease', 0, 'number');
            this.taper.lengthUnits = new Property('Length Units', 'ADBE Vector Taper Length Units', 1, 'number');
            [this.taper.startLength, this.taper.endLength, this.taper.startWidth, this.taper.endWidth, this.taper.startEase, this.taper.endEase, this.taper.lengthUnits].forEach(tp => {
                tp.parentProperty = this.taper;
                this.taper.properties.push(tp);
            });

            [this.type, this.startPoint, this.endPoint, this.colors, this.opacity, this.strokeWidth, this.lineCap, this.lineJoin, this.miterLimit, this.dashes, this.taper].forEach(p => {
                p.parentProperty = this;
                this.properties.push(p);
            });
        }
    }

    // -------------------------------------------------------------
    // 5. Expression Controls & Effects
    // -------------------------------------------------------------
    class EffectGroup extends PropertyGroup {
        constructor(name, matchName) {
            super(name, matchName);
        }

        asCallable() {
            const self = this;
            const fn = function(propNameOrIndex) {
                return self.property(propNameOrIndex);
            };
            fn.valueOf = () => self.property(1)?.value;
            fn[Symbol.toPrimitive] = () => self.property(1)?.value;
            Object.setPrototypeOf(fn, self);
            return fn;
        }
    }

    class EffectCheckboxControl extends EffectGroup {
        constructor(name = 'Checkbox Control') {
            super(name, 'ADBE Checkbox Control');
            this.checkbox = new Property('Checkbox', 'ADBE Checkbox Control-0001', 1, 'boolean');
            this.checkbox.parentProperty = this;
            this.properties.push(this.checkbox);
        }
    }

    class EffectSliderControl extends EffectGroup {
        constructor(name = 'Slider Control') {
            super(name, 'ADBE Slider Control');
            this.slider = new Property('Slider', 'ADBE Slider Control-0001', 100, 'number');
            this.slider.parentProperty = this;
            this.properties.push(this.slider);
        }
    }

    class EffectColorControl extends EffectGroup {
        constructor(name = 'Color Control') {
            super(name, 'ADBE Color Control');
            this.color = new Property('Color', 'ADBE Color Control-0001', [1, 1, 1], 'color');
            this.color.parentProperty = this;
            this.properties.push(this.color);
        }
    }

    class EffectPointControl extends EffectGroup {
        constructor(name = 'Point Control') {
            super(name, 'ADBE Point Control');
            this.point = new Property('Point', 'ADBE Point Control-0001', [0, 0], '2d');
            this.point.parentProperty = this;
            this.properties.push(this.point);
        }
    }

    // -------------------------------------------------------------
    // 6. Transform Group for Layers
    // Evaluates 2D/3D affine transformation pipelines.
    // Reference: Mathematical derivation for anchor point offset and zero-shift compensation:
    // https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md
    // -------------------------------------------------------------
    class TransformGroup extends PropertyGroup {
        constructor(is3D = false) {
            super('Transform', 'ADBE Transform Group');
            this.anchorPoint = new Property('Anchor Point', 'ADBE Anchor Point', [0, 0, 0], '3d');
            this.position    = new Property('Position', 'ADBE Position', [0, 0, 0], '3d');
            this.scale       = new Property('Scale', 'ADBE Scale', [100, 100, 100], '3d');
            this.orientation = new Property('Orientation', 'ADBE Orientation', [0, 0, 0], '3d');
            this.xRotation   = new Property('X Rotation', 'ADBE Rotate X', 0, 'number');
            this.yRotation   = new Property('Y Rotation', 'ADBE Rotate Y', 0, 'number');
            this.zRotation   = new Property('Z Rotation', 'ADBE Rotate Z', 0, 'number');
            this.rotation    = new Property('Rotation', 'ADBE Rotate Z', 0, 'number'); // Alias for 2D
            this.opacity     = new Property('Opacity', 'ADBE Opacity', 100, 'number');

            this.properties = [
                this.anchorPoint,
                this.position,
                this.scale,
                this.orientation,
                this.xRotation,
                this.yRotation,
                this.zRotation,
                this.opacity
            ];
            this.properties.forEach(p => (p.parentProperty = this));
        }

        property(nameOrIndex) {
            if (nameOrIndex === 'Rotation' || nameOrIndex === 'rotation') {
                return this.zRotation;
            }
            if (nameOrIndex === 'X Rotation' || nameOrIndex === 'ADBE Rotate X') return this.xRotation;
            if (nameOrIndex === 'Y Rotation' || nameOrIndex === 'ADBE Rotate Y') return this.yRotation;
            if (nameOrIndex === 'Z Rotation' || nameOrIndex === 'ADBE Rotate Z') return this.zRotation;
            if (nameOrIndex === 'Position' || nameOrIndex === 'ADBE Position') return this.position;
            if (nameOrIndex === 'Scale' || nameOrIndex === 'ADBE Scale') return this.scale;
            if (nameOrIndex === 'Orientation' || nameOrIndex === 'ADBE Orientation') return this.orientation;
            if (nameOrIndex === 'Anchor Point' || nameOrIndex === 'ADBE Anchor Point') return this.anchorPoint;
            if (nameOrIndex === 'Opacity' || nameOrIndex === 'ADBE Opacity') return this.opacity;
            return super.property(nameOrIndex);
        }
    }

    // -------------------------------------------------------------
    // 7. Layer Base and Shape Layer
    // -------------------------------------------------------------
    let layerIdCounter = 0;
    const layerRegistry = new Map();

    class Layer extends PropertyGroup {
        constructor(name = 'Layer', containingComp = null) {
            super(name, 'ADBE Layer');
            this._id = 'layer_' + (++layerIdCounter);
            layerRegistry.set(this._id, this);

            this.containingComp = containingComp;
            this.enabled = true;
            this.parent = null;
            this.source = null;
            this._threeDLayer = false;
            this._shy = false;
            this._animMode = 'rand'; // 'rand' (default) | 'wiggle' | 'stop' | 'base'
            this._frozenTime = 0;
            this.colorLabel = '#e07a5f'; // default label color
            this.selected = false;
            this.guideLayer = false;
            this.notShyable = false;

            this.effects = new PropertyGroup('Effects', 'ADBE Effect Parade');
            this.effects.parentProperty = this;

            this.transform = new TransformGroup(this._threeDLayer);
            this.transform.parentProperty = this;

            this.properties.push(this.effects);
            this.properties.push(this.transform);
        }

        get id() {
            return this._id;
        }

        get name() {
            if (this._name) return this._name;
            if (this.source && this.source.name) return this.source.name;
            return 'Layer';
        }
        set name(val) {
            this._name = val;
        }

        get width() {
            if (this._width !== undefined) return this._width;
            if (this.source && this.source.width !== undefined) return this.source.width;
            return this.containingComp ? this.containingComp.width : 1920;
        }
        set width(val) {
            this._width = val;
        }

        get height() {
            if (this._height !== undefined) return this._height;
            if (this.source && this.source.height !== undefined) return this.source.height;
            return this.containingComp ? this.containingComp.height : 1080;
        }
        set height(val) {
            this._height = val;
        }

        property(nameOrIndex) {
            if (typeof nameOrIndex === 'string') {
                const clean = nameOrIndex.toLowerCase();
                if (clean === 'position' || clean === 'adbe position') {
                    return this.transform ? this.transform.position : null;
                }
                if (clean === 'scale' || clean === 'adbe scale') {
                    return this.transform ? this.transform.scale : null;
                }
                if (clean === 'rotation' || clean === 'adbe rotate z' || clean === 'z rotation') {
                    return this.transform ? this.transform.rotation : null;
                }
                if (clean === 'opacity' || clean === 'adbe opacity') {
                    return this.transform ? this.transform.opacity : null;
                }
                if (clean === 'anchor point' || clean === 'adbe anchor point') {
                    return this.transform ? this.transform.anchorPoint : null;
                }
            }
            return super.property(nameOrIndex);
        }

        get position() { return this.transform.position; }
        get scale() { return this.transform.scale; }
        get orientation() { return this.transform.orientation; }
        get xRotation() { return this.transform.xRotation; }
        get yRotation() { return this.transform.yRotation; }
        get zRotation() { return this.transform.zRotation; }
        get rotation() { return this.transform.rotation; }
        get opacity() { return this.transform.opacity; }
        get anchorPoint() { return this.transform.anchorPoint; }
        get hasParent() { return Boolean(this.parent && this.parent instanceof Layer); }

        effect(nameOrIndex) {
            const eff = this.effects.property(nameOrIndex);
            if (eff && eff.asCallable) return eff.asCallable();
            return eff;
        }

        get threeDLayer() {
            return this._threeDLayer;
        }

        set threeDLayer(val) {
            this._threeDLayer = Boolean(val);
            if (this.containingComp && this.containingComp._onChanged) {
                this.containingComp._onChanged();
            }
        }

        get shy() {
            return this._shy;
        }

        set shy(val) {
            this._shy = Boolean(val);
            if (this.containingComp && this.containingComp._onChanged) {
                this.containingComp._onChanged();
            }
        }

        get animMode() {
            return this._animMode || 'rand';
        }

        set animMode(val) {
            this._animMode = val;
            if (val === 'stop') {
                this._frozenTime = this.containingComp ? this.containingComp.time : 0;
            }
            if (this.containingComp && this.containingComp._onChanged) {
                this.containingComp._onChanged();
            }
        }

        get index() {
            if (!this.containingComp) return 1;
            return this.containingComp.layers.indexOf(this) + 1;
        }

        get label() {
            return this._label || 1;
        }

        set label(val) {
            this._label = val;
            const aeLabels = [
                '#000000', // 0: None
                '#ff3b30', // 1: Red
                '#ffcc00', // 2: Yellow
                '#4cd964', // 3: Aqua
                '#ff9500', // 4: Pink
                '#5856d6', // 5: Lavender
                '#ff2d55', // 6: Peach
                '#5ac8fa', // 7: Seafoam
                '#4d88ff', // 8: Blue
                '#2ecc71', // 9: Green
                '#9b59b6', // 10: Purple
                '#e67e22', // 11: Orange
                '#95a5a6', // 12: Brown
                '#e07a5f', // 13: Magenta
                '#1abc9c', // 14: Cyan
                '#34495e', // 15: Sandstone
                '#7f8c8d'  // 16: Dark Green
            ];
            this.colorLabel = aeLabels[val] || '#ff3b30';
            if (this.containingComp && this.containingComp._onChanged) {
                this.containingComp._onChanged();
            }
        }

        moveToBeginning() {
            if (!this.containingComp) return;
            const layers = this.containingComp.layers;
            const idx = layers.indexOf(this);
            if (idx !== -1) {
                layers.splice(idx, 1);
                layers.unshift(this);
                layers._notify();
            }
        }

        moveToEnd() {
            if (!this.containingComp) return;
            const layers = this.containingComp.layers;
            const idx = layers.indexOf(this);
            if (idx !== -1) {
                layers.splice(idx, 1);
                layers.push(this);
                layers._notify();
            }
        }

        moveBefore(targetLayer) {
            if (!this.containingComp || !targetLayer) return;
            const layers = this.containingComp.layers;
            const idx = layers.indexOf(this);
            if (idx !== -1) layers.splice(idx, 1);
            const targetIdx = layers.indexOf(targetLayer);
            if (targetIdx !== -1) {
                layers.splice(targetIdx, 0, this);
            } else {
                layers.unshift(this);
            }
            layers._notify();
        }

        moveAfter(targetLayer) {
            if (!this.containingComp || !targetLayer) return;
            const layers = this.containingComp.layers;
            const idx = layers.indexOf(this);
            if (idx !== -1) layers.splice(idx, 1);
            const targetIdx = layers.indexOf(targetLayer);
            if (targetIdx !== -1) {
                layers.splice(targetIdx + 1, 0, this);
            } else {
                layers.push(this);
            }
            layers._notify();
        }

        remove() {
            if (this.containingComp && this.containingComp.layers) {
                this.containingComp.layers.remove(this);
            }
        }

        get canSetTimeRemapEnabled() {
            return Boolean(this.source || this._canTimeRemap);
        }

        get timeRemapEnabled() {
            return Boolean(this._timeRemapEnabled);
        }

        set timeRemapEnabled(val) {
            this._timeRemapEnabled = Boolean(val);
            if (this._timeRemapEnabled && !this.timeRemap) {
                this.timeRemap = new Property('Time Remap', 'ADBE Time Remapping', 0, 'number');
                this.timeRemap.parentProperty = this;
                this.properties.push(this.timeRemap);
            }
            if (this.containingComp && this.containingComp._onChanged) {
                this.containingComp._onChanged();
            }
        }

        property(nameOrIndex) {
            if (nameOrIndex === 'Transform' || nameOrIndex === 'ADBE Transform Group') return this.transform;
            if (nameOrIndex === 'Effects' || nameOrIndex === 'ADBE Effect Parade') return this.effects;
            if (nameOrIndex === 'Time Remap' || nameOrIndex === 'ADBE Time Remapping') return this.timeRemap || null;
            return super.property(nameOrIndex);
        }

        // Calculate 4x4 transform of this layer in parent/world space (excluding local anchor offset).
        // Coordinates follow the After Effects affine transformation pipeline:
        //   X_comp = P + R(theta) * S * (x_layer - A)
        // Child layers positioned at [0, 0] inherit this origin (parent anchor point location).
        // Reference: https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md
        getParentSpaceMatrix(time, fallbackZeroScale = false) {
            const t = this.transform;
            const pos    = t.position.getValueAtTime(time);
            let scale    = t.scale.getValueAtTime(time);
            if (fallbackZeroScale && scale && scale[0] === 0 && scale[1] === 0) {
                scale = (t.scale._baseValue && t.scale._baseValue[0] > 0) ? t.scale._baseValue : [100, 100];
            }
            const orient = t.orientation.getValueAtTime(time);
            const xRot   = t.xRotation.getValueAtTime(time);
            const yRot   = t.yRotation.getValueAtTime(time);
            const zRot   = t.zRotation.getValueAtTime(time);

            let m = Mat4.identity();

            // 1. Translate to Position
            m = Mat4.translate(m, [pos[0] || 0, pos[1] || 0, this._threeDLayer ? (pos[2] || 0) : 0]);

            // 2. Rotations (AE Order: Orientation then X, Y, Z Rotation)
            if (this._threeDLayer) {
                if (orient) {
                    if (orient[0]) m = Mat4.rotateX(m, orient[0] * DEG2RAD);
                    if (orient[1]) m = Mat4.rotateY(m, orient[1] * DEG2RAD);
                    if (orient[2]) m = Mat4.rotateZ(m, orient[2] * DEG2RAD);
                }
                if (xRot) m = Mat4.rotateX(m, xRot * DEG2RAD);
                if (yRot) m = Mat4.rotateY(m, yRot * DEG2RAD);
                if (zRot) m = Mat4.rotateZ(m, zRot * DEG2RAD);
            } else {
                if (zRot) m = Mat4.rotateZ(m, zRot * DEG2RAD);
            }

            // 3. Scale (scale in AE is percentage: 100 = 1.0)
            const sx = (scale[0] !== undefined ? scale[0] : 100) / 100;
            const sy = (scale[1] !== undefined ? scale[1] : 100) / 100;
            const sz = this._threeDLayer ? ((scale[2] !== undefined ? scale[2] : 100) / 100) : 1;
            m = Mat4.scale(m, [sx, sy, sz]);

            // 4. Prepend parent's transform hierarchy
            if (this.parent && this.parent instanceof Layer) {
                const parentMatrix = (typeof this.parent.getParentSpaceMatrix === 'function')
                    ? this.parent.getParentSpaceMatrix(time, fallbackZeroScale)
                    : this.parent.getWorldMatrix(time, fallbackZeroScale);
                m = Mat4.multiply(parentMatrix, m);
            }

            return m;
        }

        // Calculate 4x4 World Transformation Matrix at given time for layer contents
        getWorldMatrix(time, fallbackZeroScale = false) {
            const parentM = this.getParentSpaceMatrix(time, fallbackZeroScale);
            const t = this.transform;
            const anchor = t.anchorPoint.getValueAtTime(time);

            // Translate by negative Anchor Point for layer content
            const anchorM = Mat4.translate(Mat4.identity(), [
                -(anchor[0] || 0),
                -(anchor[1] || 0),
                this._threeDLayer ? -(anchor[2] || 0) : 0
            ]);

            return Mat4.multiply(parentM, anchorM);
        }

        // Concatenated opacity (layer * parent)
        getWorldOpacity(time) {
            let op = (this.transform.opacity.getValueAtTime(time) || 0) / 100;
            if (this.parent && this.parent instanceof Layer) {
                op *= this.parent.getWorldOpacity(time);
            }
            return Math.max(0, Math.min(1, op));
        }

        toWorld(point, time) {
            const t = (time !== undefined) ? time : (Property._currentEvaluationTime || 0);
            const m = this.getWorldMatrix(t);
            const p = (point && point.value !== undefined) ? point.value : (point || [0, 0, 0]);
            const pt = Mat4.transformPoint(m, p);
            return (p && p.length === 2) ? [pt[0], pt[1]] : pt;
        }

        toWorldVec(vec, time) {
            const t = (time !== undefined) ? time : (Property._currentEvaluationTime || 0);
            const m = this.getWorldMatrix(t);
            const v = (vec && vec.value !== undefined) ? vec.value : (vec || [0, 0, 1]);
            const p0 = Mat4.transformPoint(m, [0, 0, 0]);
            const p1 = Mat4.transformPoint(m, v);
            const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
            return (len > 0.000001) ? [d[0] / len, d[1] / len, d[2] / len] : [0, 0, 1];
        }

        toComp(point, time) {
            return this.toWorld(point, time);
        }

        toCompVec(vec, time) {
            return this.toWorldVec(vec, time);
        }

        fromWorld(point, time) {
            const t = (time !== undefined) ? time : (Property._currentEvaluationTime || 0);
            const m = this.getWorldMatrix(t);
            const inv = Mat4.invert(m);
            const p = (point && point.value !== undefined) ? point.value : (point || [0, 0, 0]);
            const pt = Mat4.transformPoint(inv, p);
            return (p && p.length === 2) ? [pt[0], pt[1]] : pt;
        }

        fromComp(point, time) {
            return this.fromWorld(point, time);
        }
    }

    Layer.getById = function(id) {
        if (!id) return null;
        if (layerRegistry.has(id)) return layerRegistry.get(id);
        const strId = String(id);
        if (layerRegistry.has(strId)) return layerRegistry.get(strId);
        if (!strId.startsWith('layer_')) {
            const prefixed = 'layer_' + strId;
            if (layerRegistry.has(prefixed)) return layerRegistry.get(prefixed);
        }
        return null;
    };

    class AVLayer extends Layer {
        constructor(name = 'AV Layer', containingComp = null) {
            super(name, containingComp);
            this.matchName = 'ADBE AV Layer';
        }

        sourceRectAtTime(time, includeExtents) {
            const w = (this.source && typeof this.source.width === 'number') ? this.source.width : (typeof this.width === 'number' ? this.width : 0);
            const h = (this.source && typeof this.source.height === 'number') ? this.source.height : (typeof this.height === 'number' ? this.height : 0);
            return { top: 0, left: 0, width: w, height: h };
        }
    }

    class ShapeLayer extends AVLayer {
        constructor(name = 'Shape Layer', containingComp = null) {
            super(name, containingComp);
            this.colorLabel = '#4d88ff'; // AE Shape layer blue
            this.contents = new PropertyGroup('Contents', 'ADBE Root Vectors Group');
            this.contents.parentProperty = this;
            this.properties.unshift(this.contents);
        }

        property(nameOrIndex) {
            if (nameOrIndex === 'Contents' || nameOrIndex === 'ADBE Root Vectors Group') return this.contents;
            return super.property(nameOrIndex);
        }

        sourceRectAtTime(time, includeExtents) {
            const t = (time !== undefined) ? time : 0;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let found = false;

            function scanGroup(grp, parentPos = [0, 0], parentScale = [1, 1]) {
                if (!grp || !grp.properties) return;
                let grpPos = [0, 0];
                let grpScale = [1, 1];
                const tr = grp.property ? (grp.property('Transform') || grp.property('ADBE Vector Transform Group')) : null;
                if (tr) {
                    const pProp = tr.property('Position') || tr.property('ADBE Vector Position');
                    const sProp = tr.property('Scale') || tr.property('ADBE Vector Scale');
                    if (pProp) {
                        const pv = pProp.getValueAtTime ? pProp.getValueAtTime(t) : pProp.value;
                        if (Array.isArray(pv)) grpPos = [pv[0], pv[1]];
                    }
                    if (sProp) {
                        const sv = sProp.getValueAtTime ? sProp.getValueAtTime(t) : sProp.value;
                        if (Array.isArray(sv)) grpScale = [sv[0] / 100, sv[1] / 100];
                    }
                }
                const curX = parentPos[0] + grpPos[0];
                const curY = parentPos[1] + grpPos[1];
                const curScaleX = parentScale[0] * grpScale[0];
                const curScaleY = parentScale[1] * grpScale[1];

                for (let i = 0; i < grp.properties.length; i++) {
                    const p = grp.properties[i];
                    if (p instanceof VectorShapeRect) {
                        const szProp = p.property('Size') || p.property('ADBE Vector Rect Size') || p.size;
                        const posProp = p.property('Position') || p.property('ADBE Vector Rect Position') || p.position;
                        const sz = szProp ? (szProp.getValueAtTime ? szProp.getValueAtTime(t) : szProp.value) : [100, 100];
                        const pos = posProp ? (posProp.getValueAtTime ? posProp.getValueAtTime(t) : posProp.value) : [0, 0];
                        const w = (sz[0] || 0) * curScaleX;
                        const h = (sz[1] || 0) * curScaleY;
                        const cx = curX + (pos[0] || 0) * curScaleX;
                        const cy = curY + (pos[1] || 0) * curScaleY;
                        minX = Math.min(minX, cx - w / 2); maxX = Math.max(maxX, cx + w / 2);
                        minY = Math.min(minY, cy - h / 2); maxY = Math.max(maxY, cy + h / 2);
                        found = true;
                    } else if (p instanceof VectorShapeEllipse) {
                        const szProp = p.property('Size') || p.property('ADBE Vector Ellipse Size') || p.size;
                        const posProp = p.property('Position') || p.property('ADBE Vector Ellipse Position') || p.position;
                        const sz = szProp ? (szProp.getValueAtTime ? szProp.getValueAtTime(t) : szProp.value) : [100, 100];
                        const pos = posProp ? (posProp.getValueAtTime ? posProp.getValueAtTime(t) : posProp.value) : [0, 0];
                        const w = (sz[0] || 0) * curScaleX;
                        const h = (sz[1] || 0) * curScaleY;
                        const cx = curX + (pos[0] || 0) * curScaleX;
                        const cy = curY + (pos[1] || 0) * curScaleY;
                        minX = Math.min(minX, cx - w / 2); maxX = Math.max(maxX, cx + w / 2);
                        minY = Math.min(minY, cy - h / 2); maxY = Math.max(maxY, cy + h / 2);
                        found = true;
                    } else if (p instanceof VectorShapeStar) {
                        const rProp = p.property('Outer Radius') || p.property('ADBE Vector Star Outer Radius') || p.outerRadius;
                        const posProp = p.property('Position') || p.property('ADBE Vector Star Position') || p.position;
                        const r = rProp ? (rProp.getValueAtTime ? rProp.getValueAtTime(t) : rProp.value) : 50;
                        const pos = posProp ? (posProp.getValueAtTime ? posProp.getValueAtTime(t) : posProp.value) : [0, 0];
                        const rx = r * curScaleX;
                        const ry = r * curScaleY;
                        const cx = curX + (pos[0] || 0) * curScaleX;
                        const cy = curY + (pos[1] || 0) * curScaleY;
                        minX = Math.min(minX, cx - rx); maxX = Math.max(maxX, cx + rx);
                        minY = Math.min(minY, cy - ry); maxY = Math.max(maxY, cy + ry);
                        found = true;
                    } else if (p instanceof VectorShapePath) {
                        const pathProp = p.property('ADBE Vector Shape') || p.property('Path') || p.path;
                        const shp = pathProp ? (pathProp.getValueAtTime ? pathProp.getValueAtTime(t) : pathProp.value) : null;
                        if (shp && shp.vertices && shp.vertices.length > 0) {
                            shp.vertices.forEach(v => {
                                const vx = curX + v[0] * curScaleX;
                                const vy = curY + v[1] * curScaleY;
                                minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
                                minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
                                found = true;
                            });
                        }
                    } else if (p instanceof PropertyGroup) {
                        scanGroup(p, [curX, curY], [curScaleX, curScaleY]);
                    }
                }
            }

            if (this.contents) scanGroup(this.contents);

            if (!found) {
                return { top: 0, left: 0, width: 0, height: 0 };
            }
            return {
                top: minY,
                left: minX,
                width: maxX - minX,
                height: maxY - minY
            };
        }
    }

    const ParagraphJustification = {
        LEFT_JUSTIFY: 7412,
        RIGHT_JUSTIFY: 7413,
        CENTER_JUSTIFY: 7414,
        FULL_JUSTIFY: 7415,
        JUSTIFY_LAST_LEFT: 7415,
        JUSTIFY_LAST_RIGHT: 7416,
        JUSTIFY_LAST_CENTER: 7417,
        JUSTIFY_ALL: 7418
    };

    function normalizeJustification(j) {
        if (j === 7414 || j === 2 || j === 'center' || j === 'CENTER_JUSTIFY' || j === ParagraphJustification.CENTER_JUSTIFY) return 'center';
        if (j === 7413 || j === 1 || j === 'right' || j === 'RIGHT_JUSTIFY' || j === ParagraphJustification.RIGHT_JUSTIFY) return 'right';
        if (j === 7415 || j === 7416 || j === 7417 || j === 7418 || j === 3 || j === 'justify' || j === 'full' || j === 'FULL_JUSTIFY' || j === ParagraphJustification.FULL_JUSTIFY) return 'justify';
        return 'left';
    }

    class TextDocument {
        constructor(text = '', fontSize = 24, font = 'system-ui, -apple-system, sans-serif', color = [1, 1, 1], justification = 'left') {
            this.text = String(text || '');
            this.fontSize = fontSize;
            this.font = font;
            this.fontFamily = font;
            this.fontStyle = 'Regular';
            this.fillColor = color;
            this.applyFill = true;
            this.applyStroke = false;
            this.strokeColor = [1, 1, 1];
            this.strokeWidth = 1;
            this.strokeOverFill = false;
            this.justification = (typeof justification === 'number' || typeof justification === 'string')
                ? justification
                : ParagraphJustification.LEFT_JUSTIFY;
            this.tracking = 0;
            this.leading = 0;
            this.autoLeading = true;
            this.baselineShift = 0;
            this.firstLineIndent = 0;
            this.leftIndent = 0;
            this.rightIndent = 0;
            this.spaceBefore = 0;
            this.spaceAfter = 0;
            this.fauxBold = false;
            this.fauxItalic = false;
            this.allCaps = false;
            this.smallCaps = false;
            this.superscript = false;
            this.subscript = false;
            this.horizontalScale = 1.0;
            this.verticalScale = 1.0;
            this.boxText = false;
            this.boxTextSize = null;
            this.boxTextPos = [0, 0];
        }

        get pointText() {
            return !this.boxText;
        }

        set pointText(val) {
            this.boxText = !val;
        }

        get isParagraphText() {
            return Boolean(this.boxText);
        }

        get isPointText() {
            return !this.boxText;
        }

        setBoxTextSize(size) {
            if (Array.isArray(size) && size.length >= 2) {
                this.boxTextSize = [Number(size[0]), Number(size[1])];
                this.boxText = true;
            } else {
                this.boxTextSize = null;
                this.boxText = false;
            }
        }

        get font() {
            return this.fontFamily || this._font || 'system-ui, -apple-system, sans-serif';
        }

        set font(val) {
            this._font = val;
            this.fontFamily = val;
        }

        toString() {
            return String(this.text || '');
        }

        valueOf() {
            return String(this.text || '');
        }
    }

    // -------------------------------------------------------------
    // After Effects Typography & Box Text Calibration System
    // Standardizes baseline, ascent/descent, word wrapping, and
    // sourceRectAtTime boundaries to match native Adobe After Effects.
    //
    // Technical Standards & Guides:
    // - Typography Differences, Point vs Box Text, and Metrics:
    //   https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
    // - Bounds Calibration & Dynamic sourceRectAtTime Invariants:
    //   https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md
    // -------------------------------------------------------------
    const AETextCalibration = {
        ascentRatio: 0.78,
        descentRatio: 0.22,
        capHeightRatio: 0.70,
        leadingRatio: 1.20,
        trackingScale: 1.0,        // 1000 tracking units = 1 em
        firstBaselineOffset: 0.0,  // Fine-tuning baseline offset in px
        globalXOffset: 0.0,
        globalYOffset: 0.0,

        fontProfiles: {
            'arial': {
                ascentRatio: 0.78,
                descentRatio: 0.22,
                charWidthRatio: 0.52,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'georgia': {
                ascentRatio: 0.81,
                descentRatio: 0.24,
                charWidthRatio: 0.50,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'times': {
                ascentRatio: 0.77,
                descentRatio: 0.23,
                charWidthRatio: 0.46,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'courier': {
                ascentRatio: 0.82,
                descentRatio: 0.22,
                charWidthRatio: 0.60,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: true
            },
            'verdana': {
                ascentRatio: 0.82,
                descentRatio: 0.22,
                charWidthRatio: 0.58,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'trebuchet': {
                ascentRatio: 0.79,
                descentRatio: 0.22,
                charWidthRatio: 0.54,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'impact': {
                ascentRatio: 0.85,
                descentRatio: 0.18,
                charWidthRatio: 0.47,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'tahoma': {
                ascentRatio: 0.81,
                descentRatio: 0.21,
                charWidthRatio: 0.53,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'segoe': {
                ascentRatio: 0.79,
                descentRatio: 0.22,
                charWidthRatio: 0.52,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'myriad': {
                ascentRatio: 0.78,
                descentRatio: 0.22,
                charWidthRatio: 0.51,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            },
            'default': {
                ascentRatio: 0.78,
                descentRatio: 0.22,
                charWidthRatio: 0.51,
                trackingScale: 1.0,
                xOffset: 0,
                yOffset: 0,
                monospace: false
            }
        },

        getFontProfile(fontName) {
            if (!fontName) return this.fontProfiles['default'];
            const fn = String(fontName).toLowerCase();
            for (const [key, profile] of Object.entries(this.fontProfiles)) {
                if (key !== 'default' && fn.includes(key)) return profile;
            }
            return this.fontProfiles['default'];
        },

        measureCharWidth(char, fontSize, profile) {
            const fs = fontSize || 24;
            if (!char) return 0;
            if (profile && profile.monospace) return fs * profile.charWidthRatio;
            const code = char.charCodeAt(0);
            if (code >= 0xD800 && code <= 0xDBFF) return fs * 1.15;
            if (code > 255) return fs * 1.05;
            if ("ijl|!.,:;'I `".indexOf(char) !== -1) return fs * 0.28;
            if ("wmWM@#%&".indexOf(char) !== -1) return fs * 0.82;
            if ("ABCDEFGHJKLMNOPQRSTUVWXYZ".indexOf(char) !== -1) return fs * 0.64;
            const baseRatio = (profile && profile.charWidthRatio) || 0.51;
            return fs * baseRatio;
        },

        measureLineWidth(str, fontSize, fontName, tracking = 0) {
            if (!str) return 0;
            const fs = fontSize || 24;

            // In browser / DOM environment, use Canvas 2D font metric for 1:1 match with rendered SVG text
            if (typeof document !== 'undefined') {
                try {
                    if (!this._measureCanvas) {
                        this._measureCanvas = document.createElement('canvas');
                        this._measureCtx = this._measureCanvas.getContext('2d');
                    }
                    if (this._measureCtx) {
                        const rawFontStr = String(fontName || 'Arial').replace(/"/g, "'").trim();
                        let textFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                        if (rawFontStr.includes(',')) {
                            textFont = rawFontStr;
                        } else {
                            const cleanFont = rawFontStr.replace(/['"]/g, '').trim();
                            const fontLower = cleanFont.toLowerCase();
                            if (fontLower.includes('courier') || fontLower.includes('consolas') || fontLower.includes('monospace')) {
                                textFont = `'${cleanFont}', 'Courier New', Consolas, monospace`;
                            } else if (fontLower.includes('times') || fontLower.includes('georgia') || fontLower.includes('serif')) {
                                textFont = `'${cleanFont}', Georgia, 'Times New Roman', serif`;
                            } else if (fontLower.includes('impact')) {
                                textFont = `'${cleanFont}', Impact, sans-serif`;
                            } else if (fontLower.includes('trebuchet')) {
                                textFont = `'${cleanFont}', 'Trebuchet MS', sans-serif`;
                            } else if (fontLower.includes('verdana')) {
                                textFont = `'${cleanFont}', Verdana, sans-serif`;
                            } else if (fontLower.includes('myriad')) {
                                textFont = `'${cleanFont}', 'Myriad Pro', 'Segoe UI', -apple-system, Arial, sans-serif`;
                            } else if (fontLower.includes('helvetica')) {
                                textFont = `'${cleanFont}', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
                            } else {
                                textFont = `'${cleanFont}', 'Segoe UI', Arial, -apple-system, sans-serif`;
                            }
                        }
                        this._measureCtx.font = `${fs}px ${textFont}`;
                        const m = this._measureCtx.measureText(str).width;
                        if (m && !isNaN(m) && m > 0) {
                            let total = m;
                            if (tracking && str.length > 1) {
                                const profile = this.getFontProfile(fontName);
                                const trackDelta = ((tracking / 1000) * fs * (profile.trackingScale || 1.0));
                                total += (str.length - 1) * trackDelta;
                            }
                            return Math.max(0, total);
                        }
                    }
                } catch (e) {}
            }

            const profile = this.getFontProfile(fontName);
            let total = 0;
            for (let i = 0; i < str.length; i++) {
                total += this.measureCharWidth(str[i], fs, profile);
            }
            if (tracking && str.length > 1) {
                const trackDelta = ((tracking / 1000) * fs * (profile.trackingScale || 1.0));
                total += (str.length - 1) * trackDelta;
            }
            return Math.max(0, total);
        },

        wrapParagraph(text, boxWidth, fontSize, fontName, indents = {}, tracking = 0) {
            const str = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const paras = str.split('\n');
            const firstLineIndent = indents.firstLineIndent || 0;
            const leftIndent = indents.leftIndent || 0;
            const rightIndent = indents.rightIndent || 0;
            const availBaseWidth = Math.max(20, boxWidth - leftIndent - rightIndent);
            const lines = [];

            for (let p = 0; p < paras.length; p++) {
                const para = paras[p];
                const words = para.match(/\S+|\s+/g) || [];
                if (words.length === 0) {
                    lines.push({ text: '', isFirstLine: true, lineWidth: 0, indentX: leftIndent + firstLineIndent });
                    continue;
                }

                let curLine = '';
                let isFirstLineOfPara = true;
                let currentLimit = Math.max(10, availBaseWidth - firstLineIndent);

                for (let w = 0; w < words.length; w++) {
                    const token = words[w];
                    const testLine = curLine + token;
                    const testW = this.measureLineWidth(testLine.trimEnd(), fontSize, fontName, tracking);

                    if (testW > currentLimit && curLine.trim().length > 0) {
                        const finalLineStr = curLine.trimEnd();
                        lines.push({
                            text: finalLineStr,
                            isFirstLine: isFirstLineOfPara,
                            lineWidth: this.measureLineWidth(finalLineStr, fontSize, fontName, tracking),
                            indentX: leftIndent + (isFirstLineOfPara ? firstLineIndent : 0)
                        });
                        curLine = token.trimStart();
                        isFirstLineOfPara = false;
                        currentLimit = availBaseWidth;
                    } else {
                        curLine = testLine;
                    }
                }

                if (curLine.length > 0) {
                    const finalLineStr = curLine.trimEnd();
                    lines.push({
                        text: finalLineStr,
                        isFirstLine: isFirstLineOfPara,
                        lineWidth: this.measureLineWidth(finalLineStr, fontSize, fontName, tracking),
                        indentX: leftIndent + (isFirstLineOfPara ? firstLineIndent : 0)
                    });
                }
            }

            return lines;
        },

        // Calculates exact dynamic bounding box { top, left, width, height }
        // matching After Effects sourceRectAtTime(time, false) semantics.
        // For Point text: origin is at baseline, yielding negative top: top = -ascent.
        // For Paragraph text: origin is at box [0, 0].
        // References:
        // - https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md#4-the-sourcerectattime-dilemma
        // - https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md#2-dual-calculation-engines
        computeSourceRect(layer, time) {
            let str = '';
            let textDoc = null;
            if (layer.sourceText) {
                const val = (typeof layer.sourceText.getValueAtTime === 'function')
                    ? layer.sourceText.getValueAtTime(time || 0)
                    : layer.sourceText.value;
                if (val && typeof val === 'object') {
                    str = (val.text !== undefined) ? String(val.text) : '';
                    textDoc = val;
                } else {
                    str = String(val || '');
                }
                if (!str && layer.sourceText._baseValue) {
                    const bv = layer.sourceText._baseValue;
                    if (bv && typeof bv === 'object') {
                        str = (bv.text !== undefined) ? String(bv.text) : '';
                        if (!textDoc) textDoc = bv;
                    } else {
                        str = String(bv || '');
                    }
                }
            }
            if (!str && layer.text && typeof layer.text === 'string') {
                str = layer.text;
            }

            const fs = layer.fontSize || (textDoc && textDoc.fontSize) || 24;
            const fontName = layer.fontFamily || layer.font || (textDoc && textDoc.font) || 'system-ui';
            const profile = this.getFontProfile(fontName);
            const tracking = (textDoc && textDoc.tracking !== undefined) ? textDoc.tracking : (layer.tracking || 0);
            const justification = (textDoc && textDoc.justification !== undefined) ? textDoc.justification : (layer.justification || 'left');
            const normJust = normalizeJustification(justification);
            const baselineShift = (textDoc && textDoc.baselineShift !== undefined) ? textDoc.baselineShift : (layer.baselineShift || 0);

            const isBox = Boolean((textDoc && textDoc.boxText === true) || (layer.boxText === true));
            const boxSize = isBox ? ((textDoc && textDoc.boxTextSize) || layer.boxTextSize || null) : null;
            const boxWidth = boxSize ? boxSize[0] : 0;
            const boxHeight = boxSize ? boxSize[1] : 0;

            const firstLineIndent = (textDoc && textDoc.firstLineIndent !== undefined) ? textDoc.firstLineIndent : (layer.firstLineIndent || 0);
            const leftIndent = (textDoc && textDoc.leftIndent !== undefined) ? textDoc.leftIndent : (layer.leftIndent || 0);
            const rightIndent = (textDoc && textDoc.rightIndent !== undefined) ? textDoc.rightIndent : (layer.rightIndent || 0);

            const leadingVal = (textDoc && textDoc.leading !== undefined) ? textDoc.leading : (layer.leading || 0);
            const autoLeading = (textDoc && textDoc.autoLeading !== undefined) ? textDoc.autoLeading : (leadingVal <= 0);
            const effectiveLeading = (!autoLeading && leadingVal > 0) ? leadingVal : (fs * (profile.leadingRatio || this.leadingRatio));

            if (!isBox || boxWidth <= 0) {
                // Point Text
                const rawLines = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
                let maxW = 0;
                for (const l of rawLines) {
                    const lw = this.measureLineWidth(l, fs, fontName, tracking);
                    if (lw > maxW) maxW = lw;
                }
                const lineCount = Math.max(1, rawLines.length);
                const glyphHeight = fs * (profile.ascentRatio + profile.descentRatio);
                const totalH = (lineCount - 1) * effectiveLeading + glyphHeight;

                // In AE Point Text: baseline is y=0, glyphs go up into negative space: top = -ascent
                const top = -(fs * profile.ascentRatio) - baselineShift + (profile.yOffset || 0);
                let left = 0;
                if (normJust === 'center') {
                    left = -maxW / 2;
                } else if (normJust === 'right') {
                    left = -maxW;
                } else {
                    left = 0;
                }
                return {
                    top: Math.round(top * 100) / 100,
                    left: Math.round(left * 100) / 100,
                    width: Math.round(maxW * 100) / 100,
                    height: Math.round(totalH * 100) / 100
                };
            } else {
                // Paragraph Box Text
                const lines = this.wrapParagraph(str, boxWidth, fs, fontName, { firstLineIndent, leftIndent, rightIndent }, tracking);
                let maxW = 0;
                for (const l of lines) {
                    if (l.lineWidth > maxW) maxW = l.lineWidth;
                }
                const lineCount = Math.max(1, lines.length);
                const glyphHeight = fs * (profile.ascentRatio + profile.descentRatio);
                const totalH = (lineCount - 1) * effectiveLeading + glyphHeight;

                // In AE Box Text: top is relative to box top [0, 0]
                const top = Math.max(0, (profile.yOffset || 0));
                let left = leftIndent;
                if (normJust === 'center') {
                    left = Math.max(0, (boxWidth - maxW) / 2);
                } else if (normJust === 'right') {
                    left = Math.max(0, boxWidth - maxW - rightIndent);
                } else {
                    left = leftIndent + (lines.length > 0 && lines[0].isFirstLine ? firstLineIndent : 0);
                }
                return {
                    top: Math.round(top * 100) / 100,
                    left: Math.round(left * 100) / 100,
                    width: Math.round(maxW * 100) / 100,
                    height: Math.round(totalH * 100) / 100
                };
            }
        },

        setCalibrationOffset(param, value) {
            if (typeof param === 'object' && param !== null) {
                Object.assign(this, param);
            } else if (typeof param === 'string' && value !== undefined) {
                this[param] = value;
            }
        },

        resetCalibration() {
            this.ascentRatio = 0.78;
            this.descentRatio = 0.22;
            this.capHeightRatio = 0.70;
            this.leadingRatio = 1.20;
            this.trackingScale = 1.0;
            this.firstBaselineOffset = 0.0;
            this.globalXOffset = 0.0;
            this.globalYOffset = 0.0;
        },

        exportCalibration() {
            return {
                ascentRatio: this.ascentRatio,
                descentRatio: this.descentRatio,
                capHeightRatio: this.capHeightRatio,
                leadingRatio: this.leadingRatio,
                trackingScale: this.trackingScale,
                firstBaselineOffset: this.firstBaselineOffset,
                globalXOffset: this.globalXOffset,
                globalYOffset: this.globalYOffset,
                fontProfiles: JSON.parse(JSON.stringify(this.fontProfiles))
            };
        }
    };

    class TextLayer extends Layer {
        constructor(name = 'Text Layer', containingComp = null, initialText = '') {
            super(name, containingComp);
            this.colorLabel = '#ff2d55'; // AE Text layer red/peach
            this.notShyable = false;

            this.text = new PropertyGroup('Text', 'ADBE Text Properties');
            this.text.parentProperty = this;

            const textStr = (typeof initialText === 'string') ? initialText : (initialText?.toString() || '');
            const textDoc = new TextDocument(textStr, 24, 'system-ui, -apple-system, sans-serif', [1, 1, 1], 'left');
            this.sourceText = new Property('Source Text', 'ADBE Text Document', textDoc, 'string');
            this.sourceText.parentProperty = this.text;
            this.text.properties.push(this.sourceText);
            this.text.sourceText = this.sourceText;
            Object.defineProperties(this.sourceText, {
                style: {
                    get: () => textDoc,
                    configurable: true
                },
                boxText: {
                    get: () => Boolean(this.boxText || (textDoc && textDoc.boxText)),
                    configurable: true
                },
                pointText: {
                    get: () => !Boolean(this.boxText || (textDoc && textDoc.boxText)),
                    configurable: true
                },
                isParagraphText: {
                    get: () => Boolean(this.boxText || (textDoc && textDoc.boxText)),
                    configurable: true
                },
                isPointText: {
                    get: () => !Boolean(this.boxText || (textDoc && textDoc.boxText)),
                    configurable: true
                }
            });

            // Direct typography state on layer
            this.fontSize = 24;
            this.fontColor = [1, 1, 1];
            this.fontFamily = 'system-ui, -apple-system, sans-serif';
            this.emojiFontFamily = "'Noto Color Emoji', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
            this.justification = 'left';
            this.tracking = 0;
            this.leading = 0;
            this.autoLeading = true;
            this.baselineShift = 0;
            this.firstLineIndent = 0;
            this.leftIndent = 0;
            this.rightIndent = 0;
            this.fauxBold = false;
            this.fauxItalic = false;
            this.allCaps = false;
            this.applyStroke = false;
            this.strokeWidth = 1;
            this.strokeColor = [1, 1, 1];
            this.boxText = false;
            this.boxTextSize = null;

            // Hook setValue to sync layer properties when TextDocument or string is assigned
            const origSetValue = this.sourceText.setValue.bind(this.sourceText);
            this.sourceText.setValue = (val) => {
                if (val && typeof val === 'object') {
                    if (val.text !== undefined) textDoc.text = String(val.text);
                    if (val.fontSize !== undefined) {
                        textDoc.fontSize = val.fontSize;
                        this.fontSize = val.fontSize;
                    }
                    if (val.font !== undefined && val.font !== 'system-ui, -apple-system, sans-serif') {
                        textDoc.font = val.font;
                        textDoc.fontFamily = val.font;
                        this.fontFamily = val.font;
                    } else if (val.fontFamily !== undefined) {
                        textDoc.fontFamily = val.fontFamily;
                        textDoc.font = val.fontFamily;
                        this.fontFamily = val.fontFamily;
                    } else if (val.font !== undefined) {
                        textDoc.font = val.font;
                        textDoc.fontFamily = val.font;
                        this.fontFamily = val.font;
                    }
                    if (val.fillColor !== undefined) {
                        textDoc.fillColor = val.fillColor;
                        this.fontColor = val.fillColor;
                    }
                    if (val.justification !== undefined) {
                        textDoc.justification = val.justification;
                        this.justification = normalizeJustification(val.justification);
                    }
                    if (val.tracking !== undefined) {
                        textDoc.tracking = val.tracking;
                        this.tracking = val.tracking;
                    }
                    if (val.leading !== undefined) {
                        textDoc.leading = val.leading;
                        this.leading = val.leading;
                    }
                    if (val.autoLeading !== undefined) {
                        textDoc.autoLeading = val.autoLeading;
                        this.autoLeading = val.autoLeading;
                    }
                    if (val.baselineShift !== undefined) {
                        textDoc.baselineShift = val.baselineShift;
                        this.baselineShift = val.baselineShift;
                    }
                    if (val.firstLineIndent !== undefined) {
                        textDoc.firstLineIndent = val.firstLineIndent;
                        this.firstLineIndent = val.firstLineIndent;
                    }
                    if (val.leftIndent !== undefined) {
                        textDoc.leftIndent = val.leftIndent;
                        this.leftIndent = val.leftIndent;
                    }
                    if (val.rightIndent !== undefined) {
                        textDoc.rightIndent = val.rightIndent;
                        this.rightIndent = val.rightIndent;
                    }
                    if (val.fauxBold !== undefined) {
                        textDoc.fauxBold = val.fauxBold;
                        this.fauxBold = val.fauxBold;
                    }
                    if (val.fauxItalic !== undefined) {
                        textDoc.fauxItalic = val.fauxItalic;
                        this.fauxItalic = val.fauxItalic;
                    }
                    if (val.allCaps !== undefined) {
                        textDoc.allCaps = val.allCaps;
                        this.allCaps = val.allCaps;
                    }
                    if (val.applyStroke !== undefined) {
                        textDoc.applyStroke = val.applyStroke;
                        this.applyStroke = val.applyStroke;
                    }
                    if (val.strokeWidth !== undefined) {
                        textDoc.strokeWidth = val.strokeWidth;
                        this.strokeWidth = val.strokeWidth;
                    }
                    if (val.strokeColor !== undefined) {
                        textDoc.strokeColor = val.strokeColor;
                        this.strokeColor = val.strokeColor;
                    }
                    if (val.boxText !== undefined) {
                        textDoc.boxText = Boolean(val.boxText);
                        this.boxText = Boolean(val.boxText);
                    }
                    if (val.boxTextSize !== undefined) {
                        textDoc.boxTextSize = val.boxTextSize;
                        this.boxTextSize = val.boxTextSize;
                        if (val.boxTextSize) {
                            textDoc.boxText = true;
                            this.boxText = true;
                        }
                    }
                    this.sourceText._baseValue = textDoc;
                    origSetValue(textDoc);
                } else {
                    textDoc.text = String(val !== undefined && val !== null ? val : '');
                    this.sourceText._baseValue = textDoc;
                    origSetValue(textDoc);
                }
                const comp = this.containingComp || app?.project?.activeItem;
                if (comp && comp._onChanged) comp._onChanged();
            };

            this.properties.unshift(this.text);
        }

        get font() {
            return this.fontFamily;
        }

        set font(val) {
            this.fontFamily = val;
            if (this.sourceText && this.sourceText._baseValue && typeof this.sourceText._baseValue === 'object') {
                this.sourceText._baseValue.font = val;
            }
        }

        setBoxTextSize(size) {
            if (Array.isArray(size) && size.length >= 2) {
                this.boxTextSize = [Number(size[0]), Number(size[1])];
                this.boxText = true;
                if (this.sourceText && this.sourceText._baseValue && typeof this.sourceText._baseValue === 'object') {
                    this.sourceText._baseValue.setBoxTextSize(size);
                }
            } else {
                this.boxTextSize = null;
                this.boxText = false;
                if (this.sourceText && this.sourceText._baseValue && typeof this.sourceText._baseValue === 'object') {
                    this.sourceText._baseValue.setBoxTextSize(null);
                }
            }
            const comp = this.containingComp || app?.project?.activeItem;
            if (comp && comp._onChanged) comp._onChanged();
        }

        property(nameOrIndex) {
            if (nameOrIndex === 'Text' || nameOrIndex === 'ADBE Text Properties') return this.text;
            if (nameOrIndex === 'Source Text' || nameOrIndex === 'ADBE Text Document') return this.sourceText;
            return super.property(nameOrIndex);
        }

        sourceRectAtTime(time, includeExtents) {
            return AETextCalibration.computeSourceRect(this, time);
        }
    }

    // -------------------------------------------------------------
    // 7. CompItem & LayerCollection
    // -------------------------------------------------------------
    class LayerCollection extends Array {
        constructor(comp) {
            super();
            this.comp = comp;
        }

        addShape() {
            const count = this.length + 1;
            const layer = new ShapeLayer('Shape Layer ' + count, this.comp);
            // Default center position for shape layer in AE: center of comp
            layer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.unshift(layer); // AE layers are ordered top-to-bottom (1 is topmost)
            this._notify();
            return layer;
        }

        addText(initialText = '') {
            const count = this.length + 1;
            const textStr = (typeof initialText === 'string') ? initialText : (initialText?.toString() || '');
            const layer = new TextLayer('Text Layer ' + count, this.comp, textStr);
            layer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.unshift(layer);
            this._notify();
            return layer;
        }

        addBoxText(size = [100, 100], initialText = '') {
            const count = this.length + 1;
            const textStr = (typeof initialText === 'string') ? initialText : (initialText?.toString() || '');
            const layer = new TextLayer('Text Layer ' + count, this.comp, textStr);
            const w = (Array.isArray(size) && size[0] > 0) ? Number(size[0]) : 100;
            const h = (Array.isArray(size) && size.length > 1 && size[1] > 0) ? Number(size[1]) : 100;
            layer.boxText = true;
            layer.boxTextSize = [w, h];
            if (layer.sourceText && layer.sourceText._baseValue && typeof layer.sourceText._baseValue === 'object') {
                layer.sourceText._baseValue.boxText = true;
                layer.sourceText._baseValue.boxTextSize = [w, h];
            }
            layer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.unshift(layer);
            this._notify();
            return layer;
        }

        addSolid(color, name, width, height, pixelAspect, duration) {
            const count = this.length + 1;
            const layerName = name || ('Solid ' + count);
            const w = width || this.comp.width;
            const h = height || this.comp.height;
            const layer = new ShapeLayer(layerName, this.comp);
            layer.width = w;
            layer.height = h;

            const group = layer.property("Contents").addProperty("ADBE Vector Group");
            group.name = "Solid Plate";
            const rect = group.property("Contents").addProperty("ADBE Vector Shape - Rect");
            rect.property("Size").setValue([w, h]);
            const fill = group.property("Contents").addProperty("ADBE Vector Graphic - Fill");
            fill.property("Color").setValue(color || [0.1, 0.1, 0.1]);

            layer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.push(layer);
            this._notify();
            return layer;
        }

        addNull() {
            const count = this.length + 1;
            const layer = new ShapeLayer('Null ' + count, this.comp);
            layer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.unshift(layer);
            this._notify();
            return layer;
        }

        add(item) {
            // Adds an AVLayer/CompLayer representing an item (CompItem)
            const count = this.length + 1;
            const layer = new AVLayer(item.name || ('Layer ' + count), this.comp);
            layer.source = item;
            layer.threeDLayer = true;
            if (item instanceof CompItem || (item && item.layers)) {
                layer.colorLabel = '#9b5de5'; // Lavender comp label
                layer.transform.anchorPoint.setValue([item.width / 2, item.height / 2, 0]);
            }
            layer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.unshift(layer);
            this._notify();
            return layer;
        }

        precompose(indices, name, moveAllAttributes = true) {
            const project = app?.project;
            const newComp = new CompItem(name, this.comp.width, this.comp.height, this.comp.pixelAspect, this.comp.duration, this.comp.frameRate);
            if (project && !project.items.includes(newComp)) {
                project.items.push(newComp);
            }

            // In AE, indices are 1-based integers of the layers to precompose
            const sortedIndices = [...indices].sort((a, b) => a - b);
            const layersToMove = [];
            sortedIndices.forEach(idx => {
                const lyr = this[idx - 1];
                if (lyr) layersToMove.push(lyr);
            });

            let insertPos = 0;
            if (layersToMove.length > 0) {
                insertPos = this.indexOf(layersToMove[0]);
                if (insertPos === -1) insertPos = 0;
            }

            layersToMove.forEach(lyr => {
                const pos = this.indexOf(lyr);
                if (pos !== -1) {
                    this.splice(pos, 1);
                }
                lyr.containingComp = newComp;
                newComp.layers.push(lyr);
            });

            // Create precomp representation layer in this parent comp
            const precompLayer = new AVLayer(name, this.comp);
            precompLayer.source = newComp;
            precompLayer.threeDLayer = true;
            precompLayer.label = 1; // Lavender / Red precomp label
            precompLayer.colorLabel = '#9b5de5';
            precompLayer.notShyable = true;
            precompLayer.transform.anchorPoint.setValue([newComp.width / 2, newComp.height / 2, 0]);
            precompLayer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.splice(Math.min(insertPos, this.length), 0, precompLayer);

            this._notify();
            if (newComp._onChanged) newComp._onChanged();
            return newComp;
        }

        byName(name) {
            return this.find(l => l.name === name) || null;
        }

        remove(layer) {
            const idx = this.indexOf(layer);
            if (idx !== -1) {
                this.splice(idx, 1);
                this._notify();
            }
        }

        _notify() {
            if (this.comp) this.comp._notify();
        }
    }

    class CompItem {
        constructor(name = 'Comp 1', width = 1920, height = 1080, pixelAspect = 1, duration = 10, frameRate = 30) {
            this.name = name;
            this.width = width;
            this.height = height;
            this.pixelAspect = pixelAspect;
            this.duration = duration;
            this.frameRate = frameRate;
            this.time = 0;
            this.bgColor = [0.1, 0.1, 0.1];

            this.layers = new LayerCollection(this);
            this._onChanged = null;
        }

        get numLayers() {
            return this.layers ? this.layers.length : 0;
        }

        get typeName() {
            return 'Composition';
        }

        openInViewer() {
            if (typeof app !== 'undefined' && app.project) {
                app.project.activeItem = this;
                if (typeof window !== 'undefined') {
                    if (window.aeRenderer) {
                        window.aeRenderer.comp = this;
                        window.aeRenderer.render();
                    }
                    if (typeof window.renderTimeline === 'function') {
                        window.renderTimeline();
                    }
                }
            }
            return this;
        }

        _notify() {
            if (this._onChanged) this._onChanged();
            if (typeof app !== 'undefined' && app.project && app.project.items) {
                app.project.items.forEach(comp => {
                    if (comp !== this && comp.layers) {
                        const hasChild = comp.layers.some(l => l.source === this);
                        if (hasChild && comp._onChanged) comp._onChanged();
                    }
                });
            }
        }

        get activeCamera() {
            const cam = this.layers.find(l => (l.matchName === 'ADBE Camera Layer' || (l.name && l.name.toLowerCase().includes('camera'))) && l.enabled);
            if (cam) return cam;
            const cx = this.width / 2;
            const cy = this.height / 2;
            const cz = -1777.78;
            return {
                name: 'Active Camera',
                position: { value: [cx, cy, cz] },
                toWorld: (pt = [0, 0, 0]) => {
                    const p = (pt && pt.value !== undefined) ? pt.value : pt;
                    return [cx + (p[0] || 0), cy + (p[1] || 0), cz + (p[2] || 0)];
                },
                toWorldVec: (v = [0, 0, 1]) => {
                    const vec = (v && v.value !== undefined) ? v.value : v;
                    return [vec[0] || 0, vec[1] || 0, vec[2] || 1];
                }
            };
        }

        get frameDuration() {
            return 1.0 / (this.frameRate || 30);
        }

        layer(nameOrIndex) {
            if (typeof nameOrIndex === 'number') {
                return this.layers[nameOrIndex - 1] || null; // 1-indexed
            }
            return this.layers.byName(nameOrIndex);
        }

        get selectedLayers() {
            return this.layers.filter(l => l.selected);
        }
    }

    // -------------------------------------------------------------
    // 8. Top-level AE 'app' and Global Scripting Namespace
    // -------------------------------------------------------------
    class ItemCollection extends Array {
        constructor(project) {
            super();
            this.project = project;
        }

        addComp(name, width, height, pixelAspect = 1, duration = 10, frameRate = 30) {
            return this.project.addComp(name, width, height, pixelAspect, duration, frameRate);
        }

        byName(name) {
            return this.find(it => it.name === name) || null;
        }
    }

    class Project {
        constructor() {
            this.items = new ItemCollection(this);
            this.activeItem = null;
        }

        get numItems() {
            return this.items.length;
        }

        addComp(name, width, height, pixelAspect = 1, duration = 10, frameRate = 30) {
            const comp = new CompItem(name, width, height, pixelAspect, duration, frameRate);
            this.items.push(comp);
            this.activeItem = comp;
            return comp;
        }

        item(idx) {
            return this.items[idx - 1] || null;
        }
    }

    const app = {
        project: new Project(),
        version: '24.0 (Emulated)',
        appName: 'After Effects JS Emulator',
        beginUndoGroup(name) {
            // Undo group polyfill for AE ExtendScript compatibility
        },
        endUndoGroup() {
            // End undo group polyfill
        }
    };

    // Default Comp
    app.project.addComp('Main Comp', 1920, 1080, 1, 10, 30);

    // Global Dollar object in ExtendScript ($)
    const $ = {
        writeln(...args) {
            console.log('[AE JSX]', ...args);
            if (global.aeConsoleLog) global.aeConsoleLog(args.join(' '));
        },
        write(...args) {
            console.log('[AE JSX]', ...args);
            if (global.aeConsoleLog) global.aeConsoleLog(args.join(' '));
        },
        // Adobe ExtendScript native $.colorPicker() API emulation (Windows ChooseColor dialog)
        colorPicker(initialColor, callback) {
            let hex = '#2288EE';
            if (typeof initialColor === 'number' && initialColor >= 0) {
                hex = '#' + initialColor.toString(16).padStart(6, '0');
            } else if (typeof initialColor === 'string') {
                hex = initialColor.startsWith('#') ? initialColor : '#' + initialColor;
            }
            if (typeof global.openWindowsColorPicker === 'function') {
                global.openWindowsColorPicker(hex, (chosenHex) => {
                    let clean = chosenHex.replace('#', '');
                    let num = parseInt(clean, 16);
                    if (typeof callback === 'function') {
                        callback(chosenHex, num);
                    }
                });
                return -1;
            }
            const res = prompt('After Effects Color Picker:\nEnter hex color (e.g. #2288EE):', hex);
            if (res && res.trim()) {
                let clean = res.trim().replace('#', '');
                let num = parseInt(clean, 16);
                if (!isNaN(num)) {
                    if (typeof callback === 'function') callback('#' + clean, num);
                    return num;
                }
            }
            return -1;
        }
    };

    // =========================================================================
    // ExtendScript Virtual File System (AEVirtualFS) with 30-Minute Temporary TTL
    // =========================================================================
    const TEMP_FILE_TTL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
    const VFS_STORAGE_PREFIX = 'ae_vfs_file:';
    const VFS_REGISTRY_KEY = 'ae_vfs_temp_registry';

    function isWork2surviveOrigin(urlOrPath) {
        if (!urlOrPath || typeof urlOrPath !== 'string') return true;
        const s = urlOrPath.toLowerCase().trim();
        // Local scripts, samples, presets, or empty/data URLs are trusted
        if (!/^https?:\/\//i.test(s) && !s.startsWith('//')) {
            return true;
        }
        // Trusted work2survive repositories & GitHub pages:
        return s.includes('work2survive.github.io') ||
               s.includes('github.com/work2survive/') ||
               s.includes('raw.githubusercontent.com/work2survive/');
    }

    const AEExecutionContext = {
        currentSource: null,
        isTemporary: false,
        tempDir: '/tmp/temp_sandbox',
        setContext: function(sourceUrl) {
            this.currentSource = sourceUrl || null;
            const isTrusted = isWork2surviveOrigin(sourceUrl);
            this.isTemporary = !isTrusted;
            if (this.isTemporary) {
                let hash = 0;
                const str = String(sourceUrl || 'external');
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash |= 0;
                }
                const folderId = Math.abs(hash).toString(36);
                this.tempDir = `/tmp/temp_external_${folderId}`;
            } else {
                this.tempDir = '/tmp';
            }
        }
    };
    global.AEExecutionContext = AEExecutionContext;

    class AEVirtualFS {
        static getRegistry() {
            try {
                const raw = localStorage.getItem(VFS_REGISTRY_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        }

        static saveRegistry(reg) {
            try {
                localStorage.setItem(VFS_REGISTRY_KEY, JSON.stringify(reg));
            } catch (e) {}
        }

        static normalizePath(p) {
            if (!p) return '/';
            let norm = String(p).replace(/\\/g, '/').replace(/\/+/g, '/');
            if (norm.length > 1 && norm.endsWith('/')) {
                norm = norm.slice(0, -1);
            }
            return norm;
        }

        static resolvePath(p, isTemporary, tempDir) {
            if (!p) return isTemporary ? (tempDir || '/tmp') : '/';
            let norm = String(p).replace(/\\/g, '/');
            if (isTemporary) {
                const base = tempDir || '/tmp';
                if (!norm.startsWith(base)) {
                    norm = base + '/' + norm.replace(/^\/+/, '');
                }
            }
            return this.normalizePath(norm);
        }

        static purgeExpiredFiles(onPurgeCallback) {
            const now = Date.now();
            const reg = this.getRegistry();
            let changed = false;

            for (const [path, meta] of Object.entries(reg)) {
                if (meta.isTemporary && meta.expiresAt && now >= meta.expiresAt) {
                    try {
                        localStorage.removeItem(VFS_STORAGE_PREFIX + path);
                    } catch (e) {}
                    delete reg[path];
                    changed = true;
                    if (typeof onPurgeCallback === 'function') {
                        onPurgeCallback(path, meta);
                    } else if (typeof global.appendConsole === 'function') {
                        global.appendConsole(`🗑️ [Temp Cleanup] Temporary file "${meta.name || path}" from external repository has expired (30 min) and was automatically deleted.`, false);
                    }
                }
            }

            if (changed) {
                this.saveRegistry(reg);
            }
        }

        static writeFile(path, content, isTemporary, sourceUrl) {
            const norm = this.normalizePath(path);
            const now = Date.now();
            const reg = this.getRegistry();

            const existing = reg[norm];
            const meta = {
                path: norm,
                name: norm.split('/').pop() || '',
                isTemporary: !!isTemporary,
                sourceUrl: sourceUrl || (existing ? existing.sourceUrl : ''),
                createdAt: existing ? existing.createdAt : now,
                modifiedAt: now,
                expiresAt: isTemporary ? (now + TEMP_FILE_TTL_MS) : null
            };

            reg[norm] = meta;
            this.saveRegistry(reg);

            try {
                localStorage.setItem(VFS_STORAGE_PREFIX + norm, content !== undefined && content !== null ? String(content) : '');
            } catch (e) {
                console.warn('[AEVirtualFS] LocalStorage save error:', e);
            }
            return meta;
        }

        static readFile(path) {
            this.purgeExpiredFiles();
            const norm = this.normalizePath(path);
            const reg = this.getRegistry();
            if (!reg[norm]) return null;
            try {
                return localStorage.getItem(VFS_STORAGE_PREFIX + norm) || '';
            } catch (e) {
                return '';
            }
        }

        static exists(path) {
            this.purgeExpiredFiles();
            const norm = this.normalizePath(path);
            const reg = this.getRegistry();
            return !!reg[norm];
        }

        static deleteFile(path) {
            const norm = this.normalizePath(path);
            const reg = this.getRegistry();
            if (reg[norm]) {
                delete reg[norm];
                this.saveRegistry(reg);
            }
            try {
                localStorage.removeItem(VFS_STORAGE_PREFIX + norm);
            } catch (e) {}
            return true;
        }

        static getFiles(folderPath, mask) {
            this.purgeExpiredFiles();
            const normFolder = this.normalizePath(folderPath);
            const reg = this.getRegistry();
            const results = [];

            for (const [path, meta] of Object.entries(reg)) {
                const pathParent = path.slice(0, Math.max(0, path.lastIndexOf('/'))) || '/';
                if (pathParent === normFolder) {
                    if (!mask || mask === '*' || mask === '*.*') {
                        results.push(path);
                    } else if (mask.startsWith('*.')) {
                        const ext = mask.slice(1).toLowerCase();
                        if (path.toLowerCase().endsWith(ext)) {
                            results.push(path);
                        }
                    } else if (path.toLowerCase().includes(mask.toLowerCase())) {
                        results.push(path);
                    }
                }
            }
            return results;
        }

        static getTempFiles() {
            this.purgeExpiredFiles();
            const reg = this.getRegistry();
            return Object.values(reg).filter(m => m.isTemporary);
        }

        static clearAllTempFiles() {
            const reg = this.getRegistry();
            let changed = false;
            for (const [path, meta] of Object.entries(reg)) {
                if (meta.isTemporary) {
                    try {
                        localStorage.removeItem(VFS_STORAGE_PREFIX + path);
                    } catch (e) {}
                    delete reg[path];
                    changed = true;
                }
            }
            if (changed) this.saveRegistry(reg);
        }
    }
    global.AEVirtualFS = AEVirtualFS;

    // Purge expired files on startup
    try {
        AEVirtualFS.purgeExpiredFiles();
    } catch (e) {}

    // Periodic 30-minute expiration check (every 10 seconds)
    if (typeof setInterval !== 'undefined') {
        setInterval(() => {
            try {
                AEVirtualFS.purgeExpiredFiles();
            } catch (e) {}
        }, 10000);
    }

    // ExtendScript Folder & File Object Polyfills
    function AEFolder(path) {
        if (!(this instanceof AEFolder)) {
            return new AEFolder(path);
        }
        const resolved = AEVirtualFS.resolvePath(path, AEExecutionContext.isTemporary, AEExecutionContext.tempDir);
        this.fsName = resolved;
        this.name = this.fsName.split(/[\\/]/).pop() || '';
        this.fullName = this.fsName;
        this.path = this.fsName.slice(0, Math.max(0, this.fsName.lastIndexOf('/'))) || '.';
        this.exists = true;
    }

    Object.defineProperty(AEFolder.prototype, 'parent', {
        get: function() {
            const parts = String(this.fsName || '.').split(/[\\/]/);
            parts.pop();
            return new AEFolder(parts.join('/') || '.');
        }
    });

    AEFolder.prototype.create = function() { return true; };
    AEFolder.prototype.execute = function() { return true; };
    AEFolder.prototype.getFiles = function(mask) {
        const filePaths = AEVirtualFS.getFiles(this.fsName, mask);
        return filePaths.map(p => new AEFile(p));
    };
    AEFolder.prototype.selectDialog = function(promptStr) { return null; };
    AEFolder.prototype.toString = function() { return this.fsName; };

    Object.defineProperties(AEFolder, {
        myDocuments: {
            get: function() {
                const base = AEExecutionContext.isTemporary ? (AEExecutionContext.tempDir + '/Documents') : '/Documents';
                return new AEFolder(base);
            }
        },
        userData: {
            get: function() {
                const base = AEExecutionContext.isTemporary ? (AEExecutionContext.tempDir + '/UserData') : '/UserData';
                return new AEFolder(base);
            }
        },
        current: {
            get: function() {
                return new AEFolder(AEExecutionContext.isTemporary ? AEExecutionContext.tempDir : '.');
            }
        },
        temp: {
            get: function() {
                return new AEFolder(AEExecutionContext.isTemporary ? AEExecutionContext.tempDir : '/tmp');
            }
        },
        desktop: {
            get: function() {
                const base = AEExecutionContext.isTemporary ? (AEExecutionContext.tempDir + '/Desktop') : '/Desktop';
                return new AEFolder(base);
            }
        },
        appPackage: {
            get: function() {
                return new AEFolder('/Applications');
            }
        },
        system: {
            get: function() {
                return new AEFolder('/System');
            }
        }
    });
    AEFolder.selectDialog = function(promptStr) { return null; };

    function AEFile(path) {
        if (!(this instanceof AEFile)) {
            return new AEFile(path);
        }
        const resolved = AEVirtualFS.resolvePath(path, AEExecutionContext.isTemporary, AEExecutionContext.tempDir);
        this.fsName = resolved;
        this.name = this.fsName ? this.fsName.split(/[\\/]/).pop() : '';
        this.fullName = this.fsName;
        this.absoluteURI = this.fsName;
        this.path = this.fsName.slice(0, Math.max(0, this.fsName.lastIndexOf('/'))) || '.';
        this.content = AEVirtualFS.readFile(this.fsName) || '';
        this.encoding = 'UTF-8';
        this.length = this.content.length;
        this.lineFeed = 'unix';
        this._writeMode = false;
    }

    Object.defineProperty(AEFile.prototype, 'exists', {
        get: function() {
            return AEVirtualFS.exists(this.fsName);
        }
    });

    Object.defineProperty(AEFile.prototype, 'parent', {
        get: function() {
            const parts = String(this.fsName || '.').split(/[\\/]/);
            parts.pop();
            return new AEFolder(parts.join('/') || '.');
        }
    });

    AEFile.prototype.open = function(mode) {
        this.content = AEVirtualFS.readFile(this.fsName) || '';
        if (mode && (mode.includes('w') || mode.includes('a'))) {
            this._writeMode = true;
            if (mode.includes('w')) this.content = '';
        } else {
            this._writeMode = false;
        }
        return true;
    };
    AEFile.prototype.read = function(chars) { return this.content; };
    AEFile.prototype.readln = function() { return this.content; };
    AEFile.prototype.write = function(text) {
        this.content += (text !== undefined && text !== null ? String(text) : '');
        this.length = this.content.length;
        return true;
    };
    AEFile.prototype.writeln = function(text) {
        return this.write((text !== undefined && text !== null ? String(text) : '') + '\n');
    };
    AEFile.prototype.close = function() {
        if (this._writeMode) {
            const isTemp = AEExecutionContext.isTemporary;
            const meta = AEVirtualFS.writeFile(this.fsName, this.content, isTemp, AEExecutionContext.currentSource);
            this._writeMode = false;
            if (isTemp && typeof global.appendConsole === 'function') {
                global.appendConsole(`📁 [Temporary File Saved] "${this.name}" created in temporary folder (${this.parent.fsName}). Expires and will be deleted in 30 minutes.`, false);
            }
        }
        return true;
    };
    AEFile.prototype.seek = function(pos) { return true; };
    AEFile.prototype.tell = function() { return 0; };
    AEFile.prototype.execute = function() { return true; };
    AEFile.prototype.remove = function() {
        AEVirtualFS.deleteFile(this.fsName);
        this.content = '';
        this.length = 0;
        return true;
    };
    AEFile.prototype.rename = function(newName) { this.name = newName; return true; };
    AEFile.prototype.toString = function() { return this.fsName; };

    AEFile.openDialog = function(promptStr, filter, multiSelect) {
        const input = document.getElementById('file-input-jsx');
        if (input) input.click();
        return null;
    };
    AEFile.saveDialog = function(promptStr, filter) {
        return null;
    };

    try {
        Object.defineProperty(global, 'File', {
            value: AEFile,
            writable: true,
            configurable: true
        });
    } catch (e) {
        try { global.File = AEFile; } catch (err) {}
    }
    if (typeof global.Folder === 'undefined') {
        global.Folder = AEFolder;
    }
    global.AEFolder = AEFolder;
    global.AEFile = AEFile;

    // Export to global scope
    Property.getById = function(id) {
        if (id === null || id === undefined) return null;
        if (propertyRegistry.has(id)) return propertyRegistry.get(id);
        const strId = String(id);
        if (propertyRegistry.has(strId)) return propertyRegistry.get(strId);
        if (!strId.startsWith('prop_')) {
            const prefixed = 'prop_' + strId;
            if (propertyRegistry.has(prefixed)) return propertyRegistry.get(prefixed);
        }
        return null;
    };
    global.getPropertyById = Property.getById;
    global.getLayerById = Layer.getById;
    global.prepareExpressionBody = prepareExpressionBody;

    global.app = app;
    global.$ = $;
    global.Mat4 = Mat4;
    global.Shape = Shape;
    global.Layer = Layer;
    global.AVLayer = AVLayer;
    global.ShapeLayer = ShapeLayer;
    global.TextLayer = TextLayer;
    global.CompItem = CompItem;
    global.Property = Property;
    global.PropertyGroup = PropertyGroup;
    global.VectorGroup = VectorGroup;
    global.VectorShapeRect = VectorShapeRect;
    global.VectorShapeEllipse = VectorShapeEllipse;
    global.VectorShapeStar = VectorShapeStar;
    global.VectorShapePath = VectorShapePath;
    global.VectorGraphicFill = VectorGraphicFill;
    global.VectorGraphicGradientFill = VectorGraphicGradientFill;
    global.VectorGraphicStroke = VectorGraphicStroke;
    global.VectorGraphicGradientStroke = VectorGraphicGradientStroke;
    global.TextDocument = TextDocument;
    global.ParagraphJustification = ParagraphJustification;
    global.normalizeJustification = normalizeJustification;
    global.AETextCalibration = AETextCalibration;
    global.EffectGroup = EffectGroup;
    global.EffectCheckboxControl = EffectCheckboxControl;
    global.EffectSliderControl = EffectSliderControl;
    global.EffectColorControl = EffectColorControl;

})(typeof window !== 'undefined' ? window : global);
