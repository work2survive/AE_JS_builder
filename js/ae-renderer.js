/**
 * Co-authored & architected with Google DeepMind Antigravity.
 * ae-renderer.js
 * 3D/2D Viewport Renderer, Interactive Camera (Orbit/Pan/Zoom), and SVG Shape Generator
 */

(function(global) {
    'use strict';

    class AERenderer {
        constructor(comp, containerId) {
            this.comp = comp;
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error('Container not found:', containerId);
                return;
            }

            // Camera Settings (Default matching AE 3D camera)
            this.camera = {
                orbitX: -35,      // Azimuth (degrees)
                orbitY: 25,       // Elevation (degrees)
                distance: 1800,   // Dolly distance (px, ~67% zoom to fit standard viewports)
                zoom: 1.0,        // 2D Canvas Magnification factor (1.0 = 100%)
                targetX: comp.width / 2,
                targetY: comp.height / 2,
                targetZ: 0,
                fov: 50,          // Perspective (px = 1200)
                isDragging: false,
                isPanning: false,
                lastMouseX: 0,
                lastMouseY: 0
            };

            this.isPlaying = true;
            this.startTime = performance.now();
            this.lastFrameTime = performance.now();

            this.initDOM();
            this.initEvents();
            this.updateCameraTransform();
            this.startLoop();
        }

        initDOM() {
            this.container.innerHTML = `
                <div class="ae-viewport">
                    <div class="ae-viewport-overlay">
                        <div class="ae-viewport-header-left">
                            <span class="ae-panel-title ae-viewport-panel-title">Viewport</span>
                            <div class="ae-cam-info">
                                <span id="cam-view-name">Custom View 1</span> | 
                                Orbit: <span id="cam-orbit-vals">-35°, 25°</span> | 
                                Zoom: <span id="cam-zoom-val">100%</span>
                            </div>
                        </div>
                        <div class="ae-viewport-controls">
                            <button id="btn-reset-cam" title="Reset Camera">Reset Cam</button>
                            <button id="btn-cam-active" title="Active Camera">Active Camera</button>
                            <button id="btn-cam-front" title="Front View">Front</button>
                            <button id="btn-cam-top" title="Top View">Top</button>
                            <button id="btn-cam-right" title="Right View">Right</button>
                        </div>
                    </div>
                    <div class="ae-world-scene" id="ae-world-scene">
                        <div class="ae-camera-rig" id="ae-camera-rig">
                            <div class="ae-comp-canvas" id="ae-comp-canvas" style="width: ${this.comp.width}px; height: ${this.comp.height}px;">
                                <div class="ae-comp-guide"></div>
                                <div class="ae-comp-center-mark"></div>
                                <div class="ae-layers-container" id="ae-layers-container"></div>
                            </div>
                        </div>
                    </div>

                    <!-- AE 3D Orientation Axis Gizmo (Left Bottom Corner) -->
                    <div class="ae-axis-gizmo" id="ae-axis-gizmo" title="3D World Orientation (X: Red, Y: Green, Z: Blue)">
                        <div class="ae-axis-gizmo-rig" id="ae-axis-gizmo-rig">
                            <!-- Origin: Blue cube with red center dot -->
                            <div class="ae-gizmo-origin">
                                <div class="ae-gizmo-origin-cube">
                                    <div class="ae-cube-face front"></div>
                                    <div class="ae-cube-face back"></div>
                                    <div class="ae-cube-face left"></div>
                                    <div class="ae-cube-face right"></div>
                                    <div class="ae-cube-face top"></div>
                                    <div class="ae-cube-face bottom"></div>
                                </div>
                                <div class="ae-gizmo-dot"></div>
                            </div>

                            <!-- X Axis (Red) -->
                            <div class="ae-gizmo-axis ae-axis-x">
                                <div class="ae-axis-stem"></div>
                                <div class="ae-axis-arrow"></div>
                                <div class="ae-axis-arrow cross"></div>
                                <span class="ae-axis-label">X</span>
                            </div>

                            <!-- Y Axis (Green) -->
                            <div class="ae-gizmo-axis ae-axis-y">
                                <div class="ae-axis-stem"></div>
                                <div class="ae-axis-arrow"></div>
                                <div class="ae-axis-arrow cross"></div>
                                <span class="ae-axis-label">Y</span>
                            </div>

                            <!-- Z Axis (Blue) -->
                            <div class="ae-gizmo-axis ae-axis-z">
                                <div class="ae-axis-stem"></div>
                                <div class="ae-axis-arrow"></div>
                                <div class="ae-axis-arrow cross"></div>
                                <span class="ae-axis-label">Z</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.worldScene = document.getElementById('ae-world-scene');
            this.cameraRig = document.getElementById('ae-camera-rig');
            this.layersContainer = document.getElementById('ae-layers-container');
            this.orbitValsEl = document.getElementById('cam-orbit-vals');
            this.zoomValEl = document.getElementById('cam-zoom-val');
            this.viewNameEl = document.getElementById('cam-view-name');
            this.gizmoRig = document.getElementById('ae-axis-gizmo-rig');
            this.gizmoLabelX = this.container.querySelector('.ae-axis-x .ae-axis-label');
            this.gizmoLabelY = this.container.querySelector('.ae-axis-y .ae-axis-label');
            this.gizmoLabelZ = this.container.querySelector('.ae-axis-z .ae-axis-label');
        }

        initEvents() {
            const vp = this.container.querySelector('.ae-viewport');

            // Mouse wheel zoom
            vp.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY;
                const factor = delta > 0 ? 1.08 : 0.92;
                if (!this.camera.zoom) this.camera.zoom = 1.0;

                // Two-stage Zoom Architecture (Limited to 300% max zoom in):
                // Safe distance threshold: 900px (~200% zoom).
                // At distance >= 900px, 3D vertices never approach the 1200px CSS perspective near-plane singularity.
                // When zooming closer, 2D viewport magnification (zoom) scales from 1.0 up to 1.5, reaching exactly 300% maximum.
                const MAX_EFFECTIVE_ZOOM = 3.0; // 300% maximum zoom in
                if (delta < 0) {
                    // Zooming in
                    const curEffectiveZoom = (1800 / this.camera.distance) * this.camera.zoom;
                    if (curEffectiveZoom < MAX_EFFECTIVE_ZOOM) {
                        if (this.camera.distance > 900) {
                            const newDist = Math.max(900, this.camera.distance * factor);
                            this.camera.distance = Math.max(1800 / MAX_EFFECTIVE_ZOOM, newDist);
                        } else {
                            const maxAllowedZoom = MAX_EFFECTIVE_ZOOM / (1800 / this.camera.distance);
                            this.camera.zoom = Math.min(maxAllowedZoom, this.camera.zoom * 1.08);
                        }
                    }
                } else {
                    // Zooming out
                    if (this.camera.zoom > 1.01) {
                        this.camera.zoom = Math.max(1.0, this.camera.zoom / 1.08);
                    } else {
                        this.camera.zoom = 1.0;
                        this.camera.distance = Math.min(6000, this.camera.distance * factor);
                    }
                }
                this.updateCameraTransform();
            }, { passive: false });

            // Prevent default browser context menu on viewport to allow Right-Click Pan
            vp.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });

            // Mouse down for orbit or pan
            vp.addEventListener('mousedown', (e) => {
                if (e.target.closest('.ae-viewport-controls')) return;

                if (e.button === 0 && !e.altKey) {
                    // Left click: Orbit
                    this.camera.isDragging = true;
                    this.camera.isPanning = false;
                    vp.classList.add('is-orbiting');
                    document.body.classList.add('body-viewport-orbiting');
                } else if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
                    // Right click (button 2), Middle click (button 1), or Alt+Left click: Pan
                    e.preventDefault();
                    this.camera.isPanning = true;
                    this.camera.isDragging = false;
                    vp.classList.add('is-panning');
                    document.body.classList.add('body-viewport-panning');
                }
                this.camera.lastMouseX = e.clientX;
                this.camera.lastMouseY = e.clientY;
            });

            window.addEventListener('mousemove', (e) => {
                if (!this.camera.isDragging && !this.camera.isPanning) return;

                const dx = e.clientX - this.camera.lastMouseX;
                const dy = e.clientY - this.camera.lastMouseY;
                this.camera.lastMouseX = e.clientX;
                this.camera.lastMouseY = e.clientY;

                if (this.camera.isDragging) {
                    this.camera.orbitX += dx * 0.45;
                    this.camera.orbitY -= dy * 0.45;
                    // Clamp elevation to avoid gimbal flip
                    this.camera.orbitY = Math.max(-89.9, Math.min(89.9, this.camera.orbitY));
                    this.viewNameEl.textContent = 'Custom View';
                } else if (this.camera.isPanning) {
                    // Pan relative to distance, current zoom magnification, and camera orientation
                    const curZoom = this.camera.zoom || 1.0;
                    const panSpeed = (this.camera.distance / curZoom) * 0.0012 * 1.5;

                    const radX = (this.camera.orbitX || 0) * Math.PI / 180;
                    const radY = (this.camera.orbitY || 0) * Math.PI / 180;

                    const sinX = Math.sin(radX);
                    const cosX = Math.cos(radX);
                    const sinY = Math.sin(radY);
                    const cosY = Math.cos(radY);

                    // 3D camera pan vector inverse projected into world space
                    const worldDeltaX = (dx * cosX + dy * sinY * sinX) * panSpeed;
                    const worldDeltaY = (dy * cosY) * panSpeed;
                    const worldDeltaZ = (dx * sinX - dy * sinY * cosX) * panSpeed;

                    this.camera.targetX -= worldDeltaX;
                    this.camera.targetY -= worldDeltaY;
                    this.camera.targetZ -= worldDeltaZ;
                }

                this.updateCameraTransform();
            });

            window.addEventListener('mouseup', () => {
                this.camera.isDragging = false;
                this.camera.isPanning = false;
                vp.classList.remove('is-orbiting', 'is-panning');
                document.body.classList.remove('body-viewport-orbiting', 'body-viewport-panning');
            });

            // Camera buttons
            document.getElementById('btn-reset-cam').onclick = () => this.setCameraView('custom');
            document.getElementById('btn-cam-active').onclick = () => this.setCameraView('active');
            document.getElementById('btn-cam-front').onclick = () => this.setCameraView('front');
            document.getElementById('btn-cam-top').onclick = () => this.setCameraView('top');
            document.getElementById('btn-cam-right').onclick = () => this.setCameraView('right');

            // Recalculate on comp change
            this.comp._onChanged = () => {
                this.renderLayers(this.comp.time);
            };
        }

        setCameraView(preset) {
            this.camera.targetX = this.comp.width / 2;
            this.camera.targetY = this.comp.height / 2;
            this.camera.targetZ = 0;
            this.camera.zoom = 1.0;

            const defaultDist = 1800;
            switch (preset) {
                case 'active':
                    this.camera.orbitX = 0;
                    this.camera.orbitY = 0;
                    this.camera.distance = defaultDist;
                    this.viewNameEl.textContent = 'Active Camera';
                    break;
                case 'front':
                    this.camera.orbitX = 0;
                    this.camera.orbitY = 0;
                    this.camera.distance = defaultDist;
                    this.viewNameEl.textContent = 'Front';
                    break;
                case 'top':
                    this.camera.orbitX = 0;
                    this.camera.orbitY = 89.9;
                    this.camera.distance = defaultDist;
                    this.viewNameEl.textContent = 'Top';
                    break;
                case 'right':
                    this.camera.orbitX = -90;
                    this.camera.orbitY = 0;
                    this.camera.distance = defaultDist;
                    this.viewNameEl.textContent = 'Right';
                    break;
                case 'custom':
                default:
                    this.camera.orbitX = -35;
                    this.camera.orbitY = 25;
                    this.camera.distance = defaultDist;
                    this.viewNameEl.textContent = 'Custom View 1';
                    break;
            }
            this.updateCameraTransform();
        }

        updateCameraTransform() {
            if (!this.cameraRig) return;
            if (!this.camera.zoom) this.camera.zoom = 1.0;

            // Update UI readout
            if (this.orbitValsEl) {
                this.orbitValsEl.textContent = `${Math.round(this.camera.orbitX)}°, ${Math.round(this.camera.orbitY)}°`;
            }
            if (this.zoomValEl) {
                const effectiveZoom = Math.min(300, Math.round(((1800 / this.camera.distance) * this.camera.zoom) * 100));
                this.zoomValEl.textContent = `${effectiveZoom}%`;
            }

            // AE 3D Camera Rig Transform:
            // Move scene so target is at (0, 0, 0), rotate around it, and position along Z relative to 1200px perspective
            const zTarget = 1200 - this.camera.distance;
            const zScale = this.camera.zoom;
            const transformStr = `scale(${zScale}, ${zScale}) translateZ(${zTarget}px) rotateX(${this.camera.orbitY}deg) rotateY(${this.camera.orbitX}deg) translate3d(${-this.camera.targetX}px, ${-this.camera.targetY}px, ${-this.camera.targetZ}px)`;
            this.cameraRig.style.transform = transformStr;

            // Synchronize AE 3D Axis Orientation Gizmo with Camera Orbit
            if (this.gizmoRig) {
                this.gizmoRig.style.transform = `rotateX(${this.camera.orbitY}deg) rotateY(${this.camera.orbitX}deg)`;
                // Billboard orientation for axis labels so they always face viewer legibly
                const billboard = `rotateY(${-this.camera.orbitX}deg) rotateX(${-this.camera.orbitY}deg)`;
                if (this.gizmoLabelX) this.gizmoLabelX.style.transform = billboard;
                if (this.gizmoLabelY) this.gizmoLabelY.style.transform = `rotateZ(90deg) ${billboard}`;
                if (this.gizmoLabelZ) this.gizmoLabelZ.style.transform = `rotateY(90deg) ${billboard}`;
            }
        }

        startLoop() {
            const loop = (now) => {
                if (this.isPlaying) {
                    const dt = (now - this.lastFrameTime) / 1000;
                    this.comp.time += dt;
                    if (this.comp.time > this.comp.duration) {
                        this.comp.time = 0;
                    }
                }
                this.lastFrameTime = now;

                this.renderLayers(this.comp.time);
                if (typeof window !== 'undefined' && typeof window.updateDynamicTimelineProperties === 'function') {
                    window.updateDynamicTimelineProperties(this.comp.time);
                }
                requestAnimationFrame(loop);
            };
            this.updateCameraTransform();
            requestAnimationFrame(loop);
        }

        // -------------------------------------------------------------
        // SVG Vector Rendering for AE Shape Layers
        // -------------------------------------------------------------
        renderShapeContents(contentsGroup, time) {
            let svgChildren = '';

            const traverseGroup = (group, parentFill = null, parentStroke = null) => {
                let localFill = parentFill;
                let localStroke = parentStroke;

                // Collect fills and strokes in this group first
                for (const prop of group.properties) {
                    if (prop instanceof VectorGraphicFill) {
                        const col = prop.color.getValueAtTime(time);
                        const rawOp = prop.opacity.getValueAtTime(time);
                        let op = (rawOp !== undefined && rawOp !== null && !isNaN(rawOp)) ? Math.max(0, Math.min(1, rawOp / 100)) : 1;
                        if (col && col.length >= 4 && col[3] !== undefined) {
                            const colAlpha = (col[3] > 1.0) ? (col[3] / 255) : col[3];
                            op *= Math.max(0, Math.min(1, colAlpha));
                        }
                        if (op > 0.0001 && col) {
                            const maxVal = Math.max(col[0] || 0, col[1] || 0, col[2] || 0);
                            const scale = (maxVal <= 1.0) ? 255 : 1.0;
                            const r = Math.round((col[0] || 0) * scale);
                            const g = Math.round((col[1] || 0) * scale);
                            const b = Math.round((col[2] || 0) * scale);
                            localFill = { color: `rgba(${r}, ${g}, ${b}, ${op})`, opacity: op };
                        } else {
                            localFill = null;
                        }
                    } else if (prop instanceof VectorGraphicStroke) {
                        const col = prop.color.getValueAtTime(time);
                        const rawOp = prop.opacity.getValueAtTime(time);
                        let op = (rawOp !== undefined && rawOp !== null && !isNaN(rawOp)) ? Math.max(0, Math.min(1, rawOp / 100)) : 1;
                        if (col && col.length >= 4 && col[3] !== undefined) {
                            const colAlpha = (col[3] > 1.0) ? (col[3] / 255) : col[3];
                            op *= Math.max(0, Math.min(1, colAlpha));
                        }
                        const rawSw = prop.strokeWidth.getValueAtTime(time);
                        const sw = (rawSw !== undefined && rawSw !== null && !isNaN(rawSw)) ? Math.max(0, Number(rawSw)) : 0;
                        if (sw > 0.0001 && op > 0.0001 && col) {
                            const maxVal = Math.max(col[0] || 0, col[1] || 0, col[2] || 0);
                            const scale = (maxVal <= 1.0) ? 255 : 1.0;
                            const r = Math.round((col[0] || 0) * scale);
                            const g = Math.round((col[1] || 0) * scale);
                            const b = Math.round((col[2] || 0) * scale);
                            localStroke = { color: `rgba(${r}, ${g}, ${b}, ${op})`, width: sw, opacity: op };
                        } else {
                            localStroke = null;
                        }
                    }
                }

                // Render shapes
                for (const prop of group.properties) {
                    if (prop instanceof VectorShapeRect) {
                        const size = prop.size.getValueAtTime(time) || [100, 100];
                        const pos = prop.position.getValueAtTime(time) || [0, 0];
                        const round = prop.roundness.getValueAtTime(time) || 0;
                        const w = size[0], h = size[1];
                        const x = pos[0] - w / 2;
                        const y = pos[1] - h / 2;

                        const fillAttr = localFill ? `fill="${localFill.color}"` : 'fill="none"';
                        const strokeAttr = (localStroke && localStroke.width > 0 && localStroke.opacity > 0)
                            ? `stroke="${localStroke.color}" stroke-width="${localStroke.width}"`
                            : 'stroke="none"';

                        svgChildren += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${round}" ry="${round}" ${fillAttr} ${strokeAttr} />`;
                    } else if (prop instanceof VectorShapeEllipse) {
                        const size = prop.size.getValueAtTime(time) || [100, 100];
                        const pos = prop.position.getValueAtTime(time) || [0, 0];
                        const rx = (size[0] || 100) / 2;
                        const ry = (size[1] || 100) / 2;

                        const fillAttr = localFill ? `fill="${localFill.color}"` : 'fill="none"';
                        const strokeAttr = (localStroke && localStroke.width > 0 && localStroke.opacity > 0)
                            ? `stroke="${localStroke.color}" stroke-width="${localStroke.width}"`
                            : 'stroke="none"';

                        svgChildren += `<ellipse cx="${pos[0]}" cy="${pos[1]}" rx="${rx}" ry="${ry}" ${fillAttr} ${strokeAttr} />`;
                    } else if (prop instanceof VectorShapePath) {
                        const shapeData = prop.path.getValueAtTime(time);
                        if (shapeData && shapeData.vertices && shapeData.vertices.length > 0) {
                            const d = this.generateSVGPathData(shapeData);
                            const fillAttr = localFill ? `fill="${localFill.color}"` : 'fill="none"';
                            const strokeAttr = (localStroke && localStroke.width > 0 && localStroke.opacity > 0)
                                ? `stroke="${localStroke.color}" stroke-width="${localStroke.width}"`
                                : 'stroke="none"';
                            svgChildren += `<path d="${d}" ${fillAttr} ${strokeAttr} stroke-linecap="round" stroke-linejoin="round" />`;
                        }
                    } else if (prop instanceof VectorGroup) {
                        // Recursively process nested group with local transform and opacity
                        const subContents = prop.property('Contents');
                        if (subContents) {
                            const prevSvgChildren = svgChildren;
                            svgChildren = '';
                            traverseGroup(subContents, localFill, localStroke);
                            const grpInner = svgChildren;
                            svgChildren = prevSvgChildren;

                            if (grpInner) {
                                const t = prop.transform;
                                let transformAttr = '';
                                let opAttr = '';
                                if (t) {
                                    const pos = (t.position && typeof t.position.getValueAtTime === 'function') ? (t.position.getValueAtTime(time) || [0, 0]) : [0, 0];
                                    const scale = (t.scale && typeof t.scale.getValueAtTime === 'function') ? (t.scale.getValueAtTime(time) || [100, 100]) : [100, 100];
                                    const rot = (t.rotation && typeof t.rotation.getValueAtTime === 'function') ? (t.rotation.getValueAtTime(time) || 0) : 0;
                                    const rawOp = (t.opacity && typeof t.opacity.getValueAtTime === 'function') ? t.opacity.getValueAtTime(time) : 100;
                                    const op = (rawOp !== undefined && rawOp !== null && !isNaN(rawOp)) ? Math.max(0, Math.min(1, rawOp / 100)) : 1;

                                    const transforms = [];
                                    if (pos[0] !== 0 || pos[1] !== 0) transforms.push(`translate(${pos[0]}, ${pos[1]})`);
                                    if (rot !== 0) transforms.push(`rotate(${rot})`);
                                    if (scale[0] !== 100 || scale[1] !== 100) transforms.push(`scale(${scale[0] / 100}, ${scale[1] / 100})`);
                                    if (transforms.length > 0) transformAttr = ` transform="${transforms.join(' ')}"`;
                                    if (op < 0.999) opAttr = ` opacity="${op}"`;
                                }
                                svgChildren += `<g${transformAttr}${opAttr}>${grpInner}</g>`;
                            }
                        }
                    } else if (prop instanceof PropertyGroup) {
                        traverseGroup(prop, localFill, localStroke);
                    }
                }
            };

            if (contentsGroup) {
                traverseGroup(contentsGroup);
            }

            return svgChildren;
        }

        generateSVGPathData(shape) {
            const v = shape.vertices;
            const inT = shape.inTangents || [];
            const outT = shape.outTangents || [];
            if (!v || v.length === 0) return '';

            let d = `M ${v[0][0]},${v[0][1]} `;

            for (let i = 1; i < v.length; i++) {
                const prevV = v[i - 1];
                const prevOut = outT[i - 1] || [0, 0];
                const cp1x = prevV[0] + prevOut[0];
                const cp1y = prevV[1] + prevOut[1];

                const currV = v[i];
                const currIn = inT[i] || [0, 0];
                const cp2x = currV[0] + currIn[0];
                const cp2y = currV[1] + currIn[1];

                d += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${currV[0]},${currV[1]} `;
            }

            if (shape.closed) {
                const lastIdx = v.length - 1;
                const prevV = v[lastIdx];
                const prevOut = outT[lastIdx] || [0, 0];
                const cp1x = prevV[0] + prevOut[0];
                const cp1y = prevV[1] + prevOut[1];

                const firstV = v[0];
                const firstIn = inT[0] || [0, 0];
                const cp2x = firstV[0] + firstIn[0];
                const cp2y = firstV[1] + firstIn[1];

                d += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${firstV[0]},${firstV[1]} Z`;
            }

            return d;
        }

        renderTextContent(layer, time) {
            let txt = '';
            if (layer.sourceText) {
                txt = String(layer.sourceText.getValueAtTime(time) || '');
                if (!txt && layer.sourceText._baseValue && (!this.isPlaying || time < 0.05)) {
                    txt = String(layer.sourceText._baseValue);
                }
            }
            if (!txt && layer.text && typeof layer.text === 'string') {
                txt = layer.text;
            }
            if (!txt) return '';

            const fs = layer.fontSize || 24;
            const lines = txt.split('\n');
            let fill = '#ffffff';
            let rawCol = null;
            if (layer.effect && typeof layer.effect === 'function') {
                const effCol = layer.effect('Status Color') || layer.effect('Status Fill Color') || layer.effect('Color') || layer.effect('Fill');
                if (effCol) {
                    const colProp = effCol.property('Color') || effCol.property(1);
                    if (colProp && typeof colProp.getValueAtTime === 'function') {
                        rawCol = colProp.getValueAtTime(time);
                    }
                }
            }
            if (!rawCol && layer.fontColor) {
                rawCol = (typeof layer.fontColor.getValueAtTime === 'function') ? layer.fontColor.getValueAtTime(time) : layer.fontColor;
            }
            if (rawCol) {
                if (Array.isArray(rawCol)) {
                    const maxVal = Math.max(rawCol[0] || 0, rawCol[1] || 0, rawCol[2] || 0);
                    const mult = (maxVal <= 1.0) ? 255 : 1;
                    fill = `rgb(${Math.round(rawCol[0] * mult)}, ${Math.round(rawCol[1] * mult)}, ${Math.round(rawCol[2] * mult)})`;
                } else {
                    fill = String(rawCol);
                }
            }

            const textAnchor = layer.justification === 'right' ? 'end' : (layer.justification === 'center' ? 'middle' : 'start');
            const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const lineStep = (layer.leading !== undefined && layer.leading > 0)
                ? layer.leading
                : (fs * 1.35 * ((layer.leadingPercent || 100) / 100));

            // Clean separation: textFont for words/symbols, emojiFont specifically for emojis
            const defaultEmojiStack = "'Noto Color Emoji', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
            const emojiFont = layer.emojiFontFamily || defaultEmojiStack;
            const textFont = layer.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

            // Regular expression matching Unicode emoji sequences, pictographs, variation selectors & ZWJ
            const emojiRegex = /(\p{Extended_Pictographic}(?:[\uFE00-\uFE0F]|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic})*|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+)/gu;

            const tspans = lines.map((l, li) => {
                if (!l) {
                    return `<tspan x="0" dy="${li === 0 ? 0 : lineStep}">&#160;</tspan>`;
                }
                const parts = [];
                let lastIndex = 0;
                let match;
                emojiRegex.lastIndex = 0;
                while ((match = emojiRegex.exec(l)) !== null) {
                    if (match.index > lastIndex) {
                        parts.push(`<tspan font-family="${textFont}">${escapeXml(l.substring(lastIndex, match.index))}</tspan>`);
                    }
                    parts.push(`<tspan font-family="${emojiFont}" font-size="${Math.round(fs * 1.05)}px">${escapeXml(match[0])}</tspan>`);
                    lastIndex = emojiRegex.lastIndex;
                }
                if (lastIndex < l.length) {
                    parts.push(`<tspan font-family="${textFont}">${escapeXml(l.substring(lastIndex))}</tspan>`);
                }
                if (parts.length === 0) {
                    parts.push(`<tspan font-family="${textFont}">${escapeXml(l)}</tspan>`);
                }
                return `<tspan x="0" dy="${li === 0 ? 0 : lineStep}">${parts.join('')}</tspan>`;
            }).join('');

            return `
                <text x="0" y="0" fill="${fill}" font-size="${fs}px" text-anchor="${textAnchor}" style="user-select:none; font-weight:400;">
                    ${tspans}
                </text>
            `;
        }

        renderLayers(time) {
            if (!this.layersContainer) return;

            // Sync layer DOM elements with comp.layers (AE layers are ordered 1..N top-to-bottom,
            // so we iterate from bottom to top to ensure correct DOM stacking order)
            const layers = this.comp.layers;
            const currentIds = new Set();

            for (let i = layers.length - 1; i >= 0; i--) {
                const layer = layers[i];
                if (!layer.enabled) continue;

                const layerId = `ae-layer-${i}`;
                currentIds.add(layerId);

                let layerEl = document.getElementById(layerId);
                if (!layerEl) {
                    layerEl = document.createElement('div');
                    layerEl.id = layerId;
                    layerEl.className = 'ae-layer';
                }
                // Ensure DOM order matches AE stacking order (layer 0 is topmost/last child)
                this.layersContainer.appendChild(layerEl);
                layerEl.style.zIndex = layers.length - i;

                // 3D Matrix & CSS Transformation
                const isStaticPreview = (!this.isPlaying || time === 0);
                const worldMat = layer.getWorldMatrix(time, isStaticPreview);
                const cssMat = Mat4.toCSS(worldMat);
                const opacity = layer.getWorldOpacity(time);

                layerEl.style.transform = cssMat;
                layerEl.style.opacity = opacity;
                layerEl.style.transformStyle = layer.threeDLayer ? 'preserve-3d' : 'flat';

                // Precomposition or Shape Layer SVG Render
                if (layer.source && layer.source.layers) {
                    layer.source.time = time;
                    let subHtml = '';
                    for (let s = layer.source.layers.length - 1; s >= 0; s--) {
                        const subLayer = layer.source.layers[s];
                        if (!subLayer.enabled) continue;
                        const subMat = subLayer.getWorldMatrix(time, isStaticPreview);
                        const subCss = Mat4.toCSS(subMat);
                        let subOpacity = (typeof subLayer.getWorldOpacity === 'function') ? subLayer.getWorldOpacity(time) : 1.0;
                        if (isStaticPreview && subOpacity === 0) {
                            subOpacity = 1.0;
                        }

                        let subContent = '';
                        if (typeof TextLayer !== 'undefined' && subLayer instanceof TextLayer) {
                            subContent = this.renderTextContent(subLayer, time);
                        } else if (subLayer.sourceText) {
                            subContent = this.renderTextContent(subLayer, time);
                        } else if (subLayer.contents) {
                            subContent = this.renderShapeContents(subLayer.contents, time);
                        }

                        if (subContent) {
                            const subZ = layer.source.layers.length - s;
                            subHtml += `
                                <div class="ae-sublayer" style="position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0 0; backface-visibility: visible; transform: ${subCss}; opacity: ${subOpacity}; z-index: ${subZ}; transform-style: preserve-3d;">
                                    <svg class="ae-layer-svg" style="overflow: visible;">${subContent}</svg>
                                </div>
                            `;
                        }
                    }
                    layerEl.innerHTML = subHtml;
                } else if (layer instanceof ShapeLayer) {
                    const svgContent = this.renderShapeContents(layer.contents, time);
                    layerEl.innerHTML = `
                        <svg class="ae-layer-svg" style="overflow: visible;">
                            ${svgContent}
                        </svg>
                    `;
                } else if (typeof TextLayer !== 'undefined' && layer instanceof TextLayer) {
                    const textSvg = this.renderTextContent(layer, time);
                    layerEl.innerHTML = `
                        <svg class="ae-layer-svg" style="overflow: visible;">
                            ${textSvg}
                        </svg>
                    `;
                }
            }

            // Remove destroyed top-level comp layers only (do not delete nested sublayers)
            const existingEls = this.layersContainer.querySelectorAll(':scope > .ae-layer');
            existingEls.forEach(el => {
                if (!currentIds.has(el.id)) {
                    el.remove();
                }
            });
        }
    }

    global.AERenderer = AERenderer;

})(typeof window !== 'undefined' ? window : global);
