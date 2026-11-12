/**
 * Co-authored & architected with Google DeepMind Antigravity.
 * ae-core.js
 * After Effects Object Model, 3D Math, and Expression/Wiggle Engine
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
        }

        property(nameOrIndex) {
            return null;
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
                const transform = layer ? layer.transform : null;
                const comp = (name) => {
                    if (!name) return rootComp;
                    const project = app?.project;
                    if (!project) return null;
                    return project.items.find(item => item.name === name) || null;
                };

                let res;
                try {
                    const evalBody = 'return eval(' + JSON.stringify(expr) + ');';
                    const fn = new Function(
                        'time', 'value', 'layer', 'thisLayer', 'thisComp', 'comp', 'transform', 'wiggle', 'effect',
                        'degreesToRadians', 'radiansToDegrees', 'createPath', 'seedRandom', 'random', 'Math',
                        `"use strict";\n${evalBody}`
                    );
                    res = fn(evalTime, value, layer, thisLayer, thisComp, comp, transform, wiggle, effect, degreesToRadians, radiansToDegrees, createPath, seedRandom, random, Math);
                } catch (evalErr) {
                    try {
                        const fn = new Function(
                            'time', 'value', 'layer', 'thisLayer', 'thisComp', 'comp', 'transform', 'wiggle', 'effect',
                            'degreesToRadians', 'radiansToDegrees', 'createPath', 'seedRandom', 'random', 'Math',
                            `"use strict";\n${expr}`
                        );
                        res = fn(evalTime, value, layer, thisLayer, thisComp, comp, transform, wiggle, effect, degreesToRadians, radiansToDegrees, createPath, seedRandom, random, Math);
                    } catch (fnErr) {
                        console.warn('[AE Expression Error]', fnErr);
                    }
                }

                if (res === undefined) {
                    try {
                        const fn = new Function(
                            'time', 'value', 'layer', 'thisLayer', 'thisComp', 'comp', 'transform', 'wiggle', 'effect',
                            'degreesToRadians', 'radiansToDegrees', 'createPath', 'seedRandom', 'random', 'Math',
                            `"use strict";\n${expr}`
                        );
                        res = fn(evalTime, value, layer, thisLayer, thisComp, comp, transform, wiggle, effect, degreesToRadians, radiansToDegrees, createPath, seedRandom, random, Math);
                    } catch (e) {}
                }

                if (res !== undefined && res !== null) {
                    if (res instanceof Property) return res.value;
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
                case 'ADBE Vector Shape - Group':
                case 'ADBE Vector Shape - Path':
                case 'Path':
                    prop = new VectorShapePath();
                    break;
                case 'ADBE Vector Graphic - Fill':
                case 'Fill':
                    prop = new VectorGraphicFill();
                    break;
                case 'ADBE Vector Graphic - Stroke':
                case 'Stroke':
                    prop = new VectorGraphicStroke();
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
            return this.properties.find(p =>
                p.name.toLowerCase() === clean ||
                p.matchName.toLowerCase() === clean ||
                p.name.toLowerCase().includes(clean)
            ) || null;
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

    class VectorGraphicStroke extends PropertyGroup {
        constructor() {
            super('Stroke 1', 'ADBE Vector Graphic - Stroke');
            this.color       = new Property('Color', 'ADBE Vector Stroke Color', [1, 1, 1], 'color');
            this.strokeWidth = new Property('Stroke Width', 'ADBE Vector Stroke Width', 2, 'number');
            this.opacity     = new Property('Opacity', 'ADBE Vector Stroke Opacity', 100, 'number');

            [this.color, this.strokeWidth, this.opacity].forEach(p => {
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

    // -------------------------------------------------------------
    // 6. Transform Group for Layers
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
    class Layer extends PropertyGroup {
        constructor(name = 'Layer', containingComp = null) {
            super(name, 'ADBE Layer');
            this.containingComp = containingComp;
            this.enabled = true;
            this.parent = null;
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

        property(nameOrIndex) {
            if (nameOrIndex === 'Transform' || nameOrIndex === 'ADBE Transform Group') return this.transform;
            if (nameOrIndex === 'Effects' || nameOrIndex === 'ADBE Effect Parade') return this.effects;
            return super.property(nameOrIndex);
        }

        // Calculate 4x4 World Transformation Matrix at given time
        getWorldMatrix(time, fallbackZeroScale = false) {
            const t = this.transform;
            const anchor = t.anchorPoint.getValueAtTime(time);
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
                // Orientation in AE applies composite matrix R = Rx * Ry * Rz
                if (orient[0]) m = Mat4.rotateX(m, orient[0] * DEG2RAD);
                if (orient[1]) m = Mat4.rotateY(m, orient[1] * DEG2RAD);
                if (orient[2]) m = Mat4.rotateZ(m, orient[2] * DEG2RAD);

                // Individual 3D Rotations (X, then Y, then Z)
                if (xRot) m = Mat4.rotateX(m, xRot * DEG2RAD);
                if (yRot) m = Mat4.rotateY(m, yRot * DEG2RAD);
                if (zRot) m = Mat4.rotateZ(m, zRot * DEG2RAD);
            } else {
                // 2D Rotation
                if (zRot) m = Mat4.rotateZ(m, zRot * DEG2RAD);
            }

            // 3. Scale (scale in AE is percentage: 100 = 1.0)
            const sx = (scale[0] !== undefined ? scale[0] : 100) / 100;
            const sy = (scale[1] !== undefined ? scale[1] : 100) / 100;
            const sz = this._threeDLayer ? ((scale[2] !== undefined ? scale[2] : 100) / 100) : 1;
            m = Mat4.scale(m, [sx, sy, sz]);

            // 4. Translate by negative Anchor Point
            m = Mat4.translate(m, [
                -(anchor[0] || 0),
                -(anchor[1] || 0),
                this._threeDLayer ? -(anchor[2] || 0) : 0
            ]);

            // 5. Parent transformation hierarchy
            if (this.parent && this.parent instanceof Layer) {
                const parentMatrix = this.parent.getWorldMatrix(time, fallbackZeroScale);
                m = Mat4.multiply(parentMatrix, m);
            }

            return m;
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

    class ShapeLayer extends Layer {
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
    }

    class TextLayer extends Layer {
        constructor(name = 'Text Layer', containingComp = null, initialText = '') {
            super(name, containingComp);
            this.colorLabel = '#ff2d55'; // AE Text layer red/peach
            this.notShyable = false;

            this.text = new PropertyGroup('Text', 'ADBE Text Properties');
            this.text.parentProperty = this;

            const textStr = (typeof initialText === 'string') ? initialText : (initialText?.toString() || '');
            this.sourceText = new Property('Source Text', 'ADBE Text Document', textStr, 'string');
            this.sourceText.parentProperty = this.text;
            this.text.properties.push(this.sourceText);

            this.properties.unshift(this.text);
            this.fontSize = 24;
            this.fontColor = [1, 1, 1];
            this.fontFamily = 'system-ui, -apple-system, sans-serif';
            this.emojiFontFamily = "'Noto Color Emoji', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
            this.justification = 'left'; // 'left' | 'center' | 'right'
        }

        property(nameOrIndex) {
            if (nameOrIndex === 'Text' || nameOrIndex === 'ADBE Text Properties') return this.text;
            if (nameOrIndex === 'Source Text' || nameOrIndex === 'ADBE Text Document') return this.sourceText;
            return super.property(nameOrIndex);
        }

        sourceRectAtTime(time, includeExtents) {
            const str = String(this.sourceText.getValueAtTime(time || 0) || '');
            const lines = str.split('\n');
            const fs = this.fontSize || 24;
            const lineH = fs * 1.35;
            let maxW = 0;
            for (const line of lines) {
                let w = 0;
                for (let i = 0; i < line.length; i++) {
                    const code = line.charCodeAt(i);
                    w += (code > 255 ? fs * 1.0 : fs * 0.55);
                }
                if (w > maxW) maxW = w;
            }
            return {
                top: 0,
                left: 0,
                width: maxW,
                height: lines.length * lineH
            };
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
            const layer = new ShapeLayer(item.name || ('Layer ' + count), this.comp);
            layer.source = item;
            layer.threeDLayer = true;
            layer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.unshift(layer);
            this._notify();
            return layer;
        }

        precompose(indices, name, moveAllAttributes = true) {
            const project = app?.project;
            const newComp = new CompItem(name, this.comp.width, this.comp.height, this.comp.pixelAspect, this.comp.duration, this.comp.frameRate);
            if (project) {
                project.items.push(newComp);
            }

            // In AE, indices are 1-based integers of the layers to precompose
            const sortedIndices = [...indices].sort((a, b) => a - b);
            const layersToMove = [];
            sortedIndices.forEach(idx => {
                const lyr = this[idx - 1];
                if (lyr) layersToMove.push(lyr);
            });

            layersToMove.forEach(lyr => {
                const pos = this.indexOf(lyr);
                if (pos !== -1) {
                    this.splice(pos, 1);
                }
                lyr.containingComp = newComp;
                newComp.layers.push(lyr);
            });

            // Create precomp representation layer in this parent comp
            const precompLayer = new ShapeLayer(name, this.comp);
            precompLayer.source = newComp;
            precompLayer.threeDLayer = true;
            precompLayer.label = 1; // Red
            precompLayer.colorLabel = '#ff3b30';
            precompLayer.notShyable = true;
            precompLayer.transform.anchorPoint.setValue([newComp.width / 2, newComp.height / 2, 0]);
            precompLayer.transform.position.setValue([this.comp.width / 2, this.comp.height / 2, 0]);
            this.unshift(precompLayer);

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
            if (this.comp && this.comp._onChanged) this.comp._onChanged();
        }
    }

    class CompItem {
        constructor(name = 'Comp 1', width = 1280, height = 720, pixelAspect = 1, duration = 10, frameRate = 30) {
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
    app.project.addComp('Main Comp', 1280, 720, 1, 10, 30);

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

    // ExtendScript File Object Polyfill
    class AEFile {
        constructor(path) {
            this.fsName = path || '';
            this.name = path ? String(path).split(/[\\/]/).pop() : '';
            this.exists = true;
            this.content = '';
        }

        open(mode) { return true; }
        read() { return this.content; }
        write(text) { this.content = text; return true; }
        close() { return true; }

        static openDialog(promptStr, filter) {
            const input = document.getElementById('file-input-jsx');
            if (input) input.click();
            return null;
        }
    }

    // Attach openDialog to global File if File exists, or assign AEFile
    if (typeof global.File !== 'undefined') {
        global.File.openDialog = AEFile.openDialog;
    } else {
        global.File = AEFile;
    }
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
    global.prepareExpressionBody = prepareExpressionBody;

    global.app = app;
    global.$ = $;
    global.Mat4 = Mat4;
    global.Shape = Shape;
    global.ShapeLayer = ShapeLayer;
    global.TextLayer = TextLayer;
    global.CompItem = CompItem;
    global.Property = Property;
    global.PropertyGroup = PropertyGroup;
    global.VectorGroup = VectorGroup;
    global.VectorShapeRect = VectorShapeRect;
    global.VectorShapeEllipse = VectorShapeEllipse;
    global.VectorShapePath = VectorShapePath;
    global.VectorGraphicFill = VectorGraphicFill;
    global.VectorGraphicStroke = VectorGraphicStroke;
    global.EffectGroup = EffectGroup;
    global.EffectCheckboxControl = EffectCheckboxControl;
    global.EffectSliderControl = EffectSliderControl;
    global.EffectColorControl = EffectColorControl;

})(typeof window !== 'undefined' ? window : global);
