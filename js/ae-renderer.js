/**
 * Co-authored & architected with Google DeepMind Antigravity.
 * ae-renderer.js
 * 3D/2D Viewport Renderer, Interactive Camera (Orbit/Pan/Zoom), and SVG Shape Generator
 *
 * Technical References & Architecture Guides:
 * - Text Rendering Engine & Discrepancy Guide:
 *   https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
 * - Anchor Point Alignment & Zero-Shift Geometry:
 *   https://github.com/work2survive/AE-Align-AnchorPoint/blob/main/README.md
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

            this.viewportTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('ae_viewport_theme')) || window.__aeViewportTheme || 'dark';

            this.initDOM();
            this.initEvents();
            this.applyViewportTheme(this.viewportTheme);
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
                            <select id="ae-viewport-resolution" class="ae-viewport-res-select" title="Composition Resolution: 1080p (1920×1080)">
                                <option value="720p">720p</option>
                                <option value="1080p" selected>1080p</option>
                                <option value="1440p">1440p</option>
                                <option value="4k">4k</option>
                            </select>
                        </div>
                        <div class="ae-viewport-controls">
                            <button id="btn-reset-cam" title="Reset Camera">Reset Cam</button>
                            <button id="btn-cam-active" title="Active Camera">Active Camera</button>
                            <button id="btn-cam-front" title="Front View">Front</button>
                            <button id="btn-cam-top" title="Top View">Top</button>
                            <button id="btn-cam-right" title="Right View">Right</button>
                            <button id="btn-viewport-theme" class="ae-viewport-theme-btn" title="Viewport Background: Dark (Click for Bright)">
                                <svg class="ae-icon-moon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                            </button>
                            <button id="btn-viewport-screenshot" class="ae-viewport-screenshot-btn" title="Download Viewport Screenshot (PNG)">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;">
                                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                                    <circle cx="12" cy="13" r="3"/>
                                </svg>
                            </button>
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
                if (e.target.closest('.ae-viewport-controls') || e.target.closest('.ae-viewport-header-left')) return;

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

            // Viewport theme toggle (Dark / Bright)
            const themeBtn = document.getElementById('btn-viewport-theme');
            if (themeBtn) {
                themeBtn.onclick = () => this.toggleViewportTheme();
            }

            // Viewport screenshot download button
            const snapBtn = document.getElementById('btn-viewport-screenshot');
            if (snapBtn) {
                snapBtn.onclick = () => this.captureViewportScreenshot();
            }

            // Composition Resolution dropdown
            const resSelect = document.getElementById('ae-viewport-resolution');
            if (resSelect) {
                resSelect.addEventListener('change', (e) => {
                    this.setResolution(e.target.value);
                });
            }
            this.syncResolutionDropdown();

            // Recalculate on comp change
            this.comp._onChanged = () => {
                this.syncResolutionDropdown();
                this.renderLayers(this.comp.time);
            };
        }

        setResolution(presetKey) {
            const PRESETS = {
                '720p':  { width: 1280, height: 720,  label: '720p' },
                '1080p': { width: 1920, height: 1080, label: '1080p' },
                '1440p': { width: 2560, height: 1440, label: '1440p' },
                '4k':    { width: 3840, height: 2160, label: '4k' }
            };
            const target = PRESETS[presetKey];
            if (!target || !this.comp) return;

            const prevW = this.comp.width;
            const prevH = this.comp.height;

            this.comp.width = target.width;
            this.comp.height = target.height;

            // Update composition canvas DOM element size
            const canvas = document.getElementById('ae-comp-canvas');
            if (canvas) {
                canvas.style.width = `${target.width}px`;
                canvas.style.height = `${target.height}px`;
            }

            // Keep camera target centered if it was centered on the comp
            if (Math.abs(this.camera.targetX - prevW / 2) < 2 && Math.abs(this.camera.targetY - prevH / 2) < 2) {
                this.camera.targetX = target.width / 2;
                this.camera.targetY = target.height / 2;
            }
            this.updateCameraTransform();

            this.syncResolutionDropdown();

            if (this.comp._onChanged) {
                this.comp._onChanged();
            }
            this.renderLayers(this.comp.time);
        }

        syncResolutionDropdown() {
            const resSelect = document.getElementById('ae-viewport-resolution');
            if (!resSelect || !this.comp) return;

            const w = this.comp.width;
            const h = this.comp.height;

            let customOpt = resSelect.querySelector('option[value="custom"]');

            if (w === 1280 && h === 720) {
                if (customOpt) customOpt.remove();
                resSelect.value = '720p';
                resSelect.title = 'Composition Resolution: 720p (1280×720)';
            } else if (w === 1920 && h === 1080) {
                if (customOpt) customOpt.remove();
                resSelect.value = '1080p';
                resSelect.title = 'Composition Resolution: 1080p (1920×1080)';
            } else if (w === 2560 && h === 1440) {
                if (customOpt) customOpt.remove();
                resSelect.value = '1440p';
                resSelect.title = 'Composition Resolution: 1440p (2560×1440)';
            } else if (w === 3840 && h === 2160) {
                if (customOpt) customOpt.remove();
                resSelect.value = '4k';
                resSelect.title = 'Composition Resolution: 4k (3840×2160)';
            } else {
                if (!customOpt) {
                    customOpt = document.createElement('option');
                    customOpt.value = 'custom';
                    resSelect.appendChild(customOpt);
                }
                customOpt.textContent = `Custom (${w}×${h})`;
                resSelect.value = 'custom';
                resSelect.title = `Composition Resolution: Custom (${w}×${h})`;
            }
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

        getMoonIconSvg() {
            return `<svg class="ae-icon-moon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
        }

        getSunIconSvg() {
            return `<svg class="ae-icon-sun" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
        }

        applyViewportTheme(theme) {
            this.viewportTheme = (theme === 'bright') ? 'bright' : 'dark';
            window.__aeViewportTheme = this.viewportTheme;
            const isBright = this.viewportTheme === 'bright';
            if (this.container) {
                this.container.classList.toggle('ae-theme-bright', isBright);
            }
            const themeBtn = document.getElementById('btn-viewport-theme');
            if (themeBtn) {
                themeBtn.title = isBright ? 'Viewport Background: Bright (Click for Dark)' : 'Viewport Background: Dark (Click for Bright)';
                themeBtn.innerHTML = isBright ? this.getSunIconSvg() : this.getMoonIconSvg();
                themeBtn.classList.toggle('active', isBright);
            }

            // Adapt existing dummy text layers to ensure optimal contrast when switching viewport themes
            if (this.comp && this.comp.layers) {
                const allLayers = Array.isArray(this.comp.layers) ? this.comp.layers : (this.comp.layers._layers || []);
                let modified = false;
                const newTextColor = isBright ? [0.08, 0.08, 0.08] : [1, 1, 1];
                allLayers.forEach(l => {
                    if (l && l._isDummyText) {
                        if (l.sourceText && l.sourceText.value && typeof l.sourceText.value === 'object') {
                            l.sourceText.value.fillColor = newTextColor;
                        }
                        l.fontColor = newTextColor;
                        modified = true;
                    }
                });
                if (modified) {
                    this.render(this.comp.time || 0);
                }
            }
        }

        toggleViewportTheme() {
            const nextTheme = (this.viewportTheme === 'bright') ? 'dark' : 'bright';
            this.applyViewportTheme(nextTheme);
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('ae_viewport_theme', nextTheme);
                }
            } catch (e) {}
        }

        async captureViewportScreenshot() {
            const btn = document.getElementById('btn-viewport-screenshot');
            try {
                const vp = this.container ? this.container.querySelector('.ae-viewport') : document.querySelector('.ae-viewport');
                if (!vp) return;

                if (btn) {
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.5';
                }

                const isBright = this.container && this.container.classList.contains('ae-theme-bright');
                const bg = isBright ? '#dcdce0' : '#1a1a1a';

                const rect = vp.getBoundingClientRect();
                const width = Math.round(rect.width || vp.clientWidth || 1024);
                const height = Math.round(rect.height || vp.clientHeight || 512);
                const pr = Math.max(1, window.devicePixelRatio || 1);

                const opts = {
                    backgroundColor: bg,
                    width: width,
                    height: height,
                    pixelRatio: pr,
                    skipFonts: true,
                    cacheBust: true,
                    filter: (node) => {
                        if (!node) return true;
                        if (node.classList && node.classList.contains('ae-viewport-overlay')) return false;
                        return true;
                    }
                };

                let dataUrl = '';
                if (typeof htmlToImage !== 'undefined' && htmlToImage.toPng) {
                    try {
                        // Warm-up pass: pre-bakes the CSS 3D transform tree and SVG subtrees in WebKit/Blink
                        await htmlToImage.toPng(vp, opts);
                    } catch (eWarm) {}
                    dataUrl = await htmlToImage.toPng(vp, opts);
                } else {
                    throw new Error('Screenshot engine not loaded');
                }

                if (dataUrl) {
                    const compName = (this.comp && this.comp.name) ? this.comp.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'viewport';
                    const now = new Date();
                    const pad = (n) => String(n).padStart(2, '0');
                    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
                    const filename = `${compName}_${timestamp}.png`;

                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = dataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    if (typeof appendConsole === 'function') {
                        appendConsole(`Viewport screenshot downloaded: ${filename}`);
                    }
                }
            } catch (err) {
                console.error('[Screenshot Error]', err);
                if (typeof appendConsole === 'function') {
                    appendConsole(`Screenshot download failed: ${err.message}`, true);
                }
            } finally {
                if (btn) {
                    btn.style.pointerEvents = 'auto';
                    btn.style.opacity = '1';
                }
            }
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

        render(time = (this.comp ? this.comp.time : 0)) {
            this.renderLayers(time);
        }

        // -------------------------------------------------------------
        // SVG Vector Rendering for AE Shape Layers
        // -------------------------------------------------------------
        renderShapeContents(contentsGroup, time) {
            let svgDefs = '';
            let svgChildren = '';
            let gradCounter = 0;

            const parseColorAndOpacity = (col, off) => {
                if (Array.isArray(col)) {
                    const maxVal = Math.max(col[0] || 0, col[1] || 0, col[2] || 0);
                    const scale = (maxVal <= 1.0) ? 255 : 1.0;
                    const r = Math.round((col[0] || 0) * scale);
                    const g = Math.round((col[1] || 0) * scale);
                    const b = Math.round((col[2] || 0) * scale);
                    const a = (col[3] !== undefined) ? ((col[3] > 1.0) ? col[3] / 255 : col[3]) : 1;
                    return { offset: off, color: `rgb(${r}, ${g}, ${b})`, opacity: a };
                }
                return { offset: off, color: String(col), opacity: 1 };
            };

            const parseGradientStops = (colorsVal) => {
                if (!colorsVal) {
                    return [
                        { offset: '0%', color: 'rgb(255, 0, 0)', opacity: 1 },
                        { offset: '100%', color: 'rgb(0, 0, 255)', opacity: 1 }
                    ];
                }
                if (Array.isArray(colorsVal) && colorsVal.length > 0) {
                    if (Array.isArray(colorsVal[0]) && colorsVal[0].length === 2 && typeof colorsVal[0][0] === 'number') {
                        return colorsVal.map(stop => {
                            const off = Math.round(stop[0] * 100) + '%';
                            return parseColorAndOpacity(stop[1], off);
                        });
                    }
                    if (Array.isArray(colorsVal[0]) && (colorsVal[0].length === 3 || colorsVal[0].length === 4)) {
                        const step = colorsVal.length > 1 ? 1 / (colorsVal.length - 1) : 1;
                        return colorsVal.map((col, idx) => {
                            const off = Math.round(idx * step * 100) + '%';
                            return parseColorAndOpacity(col, off);
                        });
                    }
                    if (typeof colorsVal[0] === 'object' && 'color' in colorsVal[0]) {
                        return colorsVal.map(s => {
                            const off = (typeof s.offset === 'number' ? Math.round(s.offset * 100) + '%' : s.offset) || '0%';
                            return parseColorAndOpacity(s.color, off);
                        });
                    }
                    if (typeof colorsVal[0] === 'string') {
                        const step = colorsVal.length > 1 ? 1 / (colorsVal.length - 1) : 1;
                        return colorsVal.map((hex, idx) => {
                            const off = Math.round(idx * step * 100) + '%';
                            return { offset: off, color: hex, opacity: 1 };
                        });
                    }
                }
                return [
                    { offset: '0%', color: 'rgb(255, 0, 0)', opacity: 1 },
                    { offset: '100%', color: 'rgb(0, 0, 255)', opacity: 1 }
                ];
            };

            const buildGradientDef = (gradProp) => {
                const gradType = gradProp.type ? (gradProp.type.getValueAtTime(time) || 1) : 1;
                const startPt = gradProp.startPoint ? (gradProp.startPoint.getValueAtTime(time) || [-50, 0]) : [-50, 0];
                const endPt = gradProp.endPoint ? (gradProp.endPoint.getValueAtTime(time) || [50, 0]) : [50, 0];
                const rawColors = gradProp.colors ? gradProp.colors.getValueAtTime(time) : null;
                const rawOp = gradProp.opacity ? gradProp.opacity.getValueAtTime(time) : 100;
                const gradOp = (rawOp !== undefined && rawOp !== null && !isNaN(rawOp)) ? Math.max(0, Math.min(1, rawOp / 100)) : 1;
                const stops = parseGradientStops(rawColors);

                gradCounter++;
                const gradId = 'ae_grad_' + Math.random().toString(36).substr(2, 8) + '_' + gradCounter;
                const stopsHtml = stops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}" stop-opacity="${s.opacity * gradOp}" />`).join('');

                if (gradType === 2) {
                    const cx = startPt[0], cy = startPt[1];
                    const dx = endPt[0] - startPt[0], dy = endPt[1] - startPt[1];
                    const r = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    svgDefs += `<radialGradient id="${gradId}" cx="${cx}" cy="${cy}" r="${r}" fx="${cx}" fy="${cy}" gradientUnits="userSpaceOnUse">${stopsHtml}</radialGradient>`;
                } else {
                    const x1 = startPt[0], y1 = startPt[1];
                    const x2 = endPt[0], y2 = endPt[1];
                    svgDefs += `<linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stopsHtml}</linearGradient>`;
                }

                return `url(#${gradId})`;
            };

            const extractStrokeInfo = (prop) => {
                const rawSw = prop.strokeWidth ? prop.strokeWidth.getValueAtTime(time) : 2;
                const sw = (rawSw !== undefined && rawSw !== null && !isNaN(rawSw)) ? Math.max(0, Number(rawSw)) : 0;
                const rawOp = prop.opacity ? prop.opacity.getValueAtTime(time) : 100;
                let op = (rawOp !== undefined && rawOp !== null && !isNaN(rawOp)) ? Math.max(0, Math.min(1, rawOp / 100)) : 1;

                let strokeColor = 'none';
                if ((typeof VectorGraphicGradientStroke !== 'undefined' && prop instanceof VectorGraphicGradientStroke) || prop.matchName === 'ADBE Vector Graphic - G-Stroke') {
                    strokeColor = buildGradientDef(prop);
                } else {
                    const col = prop.color ? prop.color.getValueAtTime(time) : [1, 1, 1];
                    if (col && col.length >= 4 && col[3] !== undefined) {
                        const colAlpha = (col[3] > 1.0) ? (col[3] / 255) : col[3];
                        op *= Math.max(0, Math.min(1, colAlpha));
                    }
                    if (col) {
                        const maxVal = Math.max(col[0] || 0, col[1] || 0, col[2] || 0);
                        const scale = (maxVal <= 1.0) ? 255 : 1.0;
                        const r = Math.round((col[0] || 0) * scale);
                        const g = Math.round((col[1] || 0) * scale);
                        const b = Math.round((col[2] || 0) * scale);
                        strokeColor = `rgba(${r}, ${g}, ${b}, ${op})`;
                    }
                }

                const capVal = prop.lineCap ? (prop.lineCap.getValueAtTime(time) || 1) : 1;
                const cap = (capVal === 2 || capVal === 'round') ? 'round' : ((capVal === 3 || capVal === 'projecting' || capVal === 'square') ? 'square' : 'butt');

                const joinVal = prop.lineJoin ? (prop.lineJoin.getValueAtTime(time) || 1) : 1;
                const join = (joinVal === 2 || joinVal === 'round') ? 'round' : ((joinVal === 3 || joinVal === 'bevel') ? 'bevel' : 'miter');

                const miter = prop.miterLimit ? (prop.miterLimit.getValueAtTime(time) || 4) : 4;

                let dashStr = '';
                let dashOffset = 0;
                const dashesProp = prop.dashes || (prop.property && (prop.property('Dashes') || prop.property('ADBE Vector Stroke Dashes')));
                if (dashesProp && dashesProp.properties && dashesProp.properties.length > 0) {
                    const dashParts = [];
                    for (const dp of dashesProp.properties) {
                        const mName = dp.matchName || dp.name || '';
                        const val = dp.getValueAtTime ? dp.getValueAtTime(time) : dp.value;
                        if (mName.includes('Offset')) {
                            dashOffset = Number(val) || 0;
                        } else if (val !== undefined && val !== null && !isNaN(val)) {
                            dashParts.push(Math.max(0, Number(val)));
                        }
                    }
                    if (dashParts.length > 0) dashStr = dashParts.join(' ');
                } else if (prop.dashArray && Array.isArray(prop.dashArray)) {
                    dashStr = prop.dashArray.join(' ');
                }

                let taperInfo = null;
                const taperProp = prop.taper || (prop.property && (prop.property('Taper') || prop.property('ADBE Vector Taper')));
                if (taperProp) {
                    const getTaperVal = (pName, mName, defVal) => {
                        let sub = taperProp[pName] || (taperProp.property && (taperProp.property(pName) || taperProp.property(mName)));
                        if (sub) {
                            const v = (sub.getValueAtTime && typeof sub.getValueAtTime === 'function') ? sub.getValueAtTime(time) : sub.value;
                            if (v !== undefined && v !== null && !isNaN(v)) return Number(v);
                        }
                        return defVal;
                    };
                    const startLength = Math.max(0, getTaperVal('startLength', 'ADBE Vector Taper Start Length', 0));
                    const endLength = Math.max(0, getTaperVal('endLength', 'ADBE Vector Taper End Length', 0));
                    const startWidth = Math.max(0, getTaperVal('startWidth', 'ADBE Vector Taper Start Width', 0));
                    const endWidth = Math.max(0, getTaperVal('endWidth', 'ADBE Vector Taper End Width', 0));
                    const startEase = Math.max(-100, Math.min(100, getTaperVal('startEase', 'ADBE Vector Taper Start Ease', 0)));
                    const endEase = Math.max(-100, Math.min(100, getTaperVal('endEase', 'ADBE Vector Taper End Ease', 0)));
                    const lengthUnits = Math.round(getTaperVal('lengthUnits', 'ADBE Vector Taper Length Units', 1));

                    if (startLength > 0.001 || endLength > 0.001) {
                        taperInfo = {
                            startLength,
                            endLength,
                            startWidth,
                            endWidth,
                            startEase,
                            endEase,
                            lengthUnits
                        };
                    }
                }

                if (sw > 0.0001 && op > 0.0001 && strokeColor !== 'none') {
                    return {
                        color: strokeColor,
                        width: sw,
                        opacity: op,
                        cap: cap,
                        join: join,
                        miter: miter,
                        dash: dashStr,
                        dashOffset: dashOffset,
                        taper: taperInfo
                    };
                }
                return null;
            };

            const formatStrokeAttrs = (localStroke) => {
                if (!localStroke || localStroke.width <= 0 || localStroke.opacity <= 0) {
                    return 'stroke="none"';
                }
                let s = `stroke="${localStroke.color}" stroke-width="${localStroke.width}"`;
                if (localStroke.cap && localStroke.cap !== 'butt') s += ` stroke-linecap="${localStroke.cap}"`;
                if (localStroke.join && localStroke.join !== 'miter') s += ` stroke-linejoin="${localStroke.join}"`;
                if (localStroke.miter && localStroke.miter !== 4) s += ` stroke-miterlimit="${localStroke.miter}"`;
                if (localStroke.dash) s += ` stroke-dasharray="${localStroke.dash}"`;
                if (localStroke.dashOffset) s += ` stroke-dashoffset="${localStroke.dashOffset}"`;
                return s;
            };

            const formatFillAttr = (localFill) => {
                if (!localFill) return 'fill="none"';
                return `fill="${localFill.color}"`;
            };

            const traverseGroup = (group, parentFill = null, parentStroke = null) => {
                let localFill = parentFill;
                let localStroke = parentStroke;

                // Collect fills and strokes in this group first
                for (const prop of group.properties) {
                    if ((typeof VectorGraphicGradientFill !== 'undefined' && prop instanceof VectorGraphicGradientFill) || prop.matchName === 'ADBE Vector Graphic - G-Fill') {
                        const gradUrl = buildGradientDef(prop);
                        localFill = { color: gradUrl, opacity: 1, isGradient: true };
                    } else if (prop instanceof VectorGraphicFill) {
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
                    } else if ((typeof VectorGraphicGradientStroke !== 'undefined' && prop instanceof VectorGraphicGradientStroke) || prop.matchName === 'ADBE Vector Graphic - G-Stroke') {
                        localStroke = extractStrokeInfo(prop);
                    } else if (prop instanceof VectorGraphicStroke) {
                        localStroke = extractStrokeInfo(prop);
                    }
                }

                // Check if this group has multiple VectorShapePath siblings (compound path)
                const pathProps = group.properties.filter(p => p instanceof VectorShapePath);
                const combinePathsAsCompound = (pathProps.length > 1 && !(localStroke && localStroke.taper));
                let compoundPathsRendered = false;

                // Render shapes
                for (const prop of group.properties) {
                    if (prop instanceof VectorShapeRect) {
                        const size = prop.size.getValueAtTime(time) || [100, 100];
                        const pos = prop.position.getValueAtTime(time) || [0, 0];
                        const round = prop.roundness.getValueAtTime(time) || 0;
                        const w = size[0], h = size[1];
                        const x = pos[0] - w / 2;
                        const y = pos[1] - h / 2;

                        const fillAttr = formatFillAttr(localFill);
                        if (localStroke && localStroke.taper) {
                            if (localFill) {
                                svgChildren += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${round}" ry="${round}" ${fillAttr} stroke="none" />`;
                            }
                            const shapeData = this.rectToShapeData(pos, size, round);
                            const taperedD = this.generateTaperedPathData(shapeData, localStroke);
                            if (taperedD) {
                                svgChildren += `<path d="${taperedD}" fill="${localStroke.color}" stroke="none" />`;
                            }
                        } else {
                            const strokeAttr = formatStrokeAttrs(localStroke);
                            svgChildren += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${round}" ry="${round}" ${fillAttr} ${strokeAttr} />`;
                        }
                    } else if (prop instanceof VectorShapeEllipse) {
                        const size = prop.size.getValueAtTime(time) || [100, 100];
                        const pos = prop.position.getValueAtTime(time) || [0, 0];
                        const rx = (size[0] || 100) / 2;
                        const ry = (size[1] || 100) / 2;

                        const fillAttr = formatFillAttr(localFill);
                        if (localStroke && localStroke.taper) {
                            if (localFill) {
                                svgChildren += `<ellipse cx="${pos[0]}" cy="${pos[1]}" rx="${rx}" ry="${ry}" ${fillAttr} stroke="none" />`;
                            }
                            const shapeData = this.ellipseToShapeData(pos, size);
                            const taperedD = this.generateTaperedPathData(shapeData, localStroke);
                            if (taperedD) {
                                svgChildren += `<path d="${taperedD}" fill="${localStroke.color}" stroke="none" />`;
                            }
                        } else {
                            const strokeAttr = formatStrokeAttrs(localStroke);
                            svgChildren += `<ellipse cx="${pos[0]}" cy="${pos[1]}" rx="${rx}" ry="${ry}" ${fillAttr} ${strokeAttr} />`;
                        }
                    } else if ((typeof VectorShapeStar !== 'undefined' && prop instanceof VectorShapeStar) || prop.matchName === 'ADBE Vector Shape - Star') {
                        const starType = prop.type ? (prop.type.getValueAtTime(time) || 1) : 1;
                        const pts = Math.max(3, Math.round(prop.points ? (prop.points.getValueAtTime(time) || 5) : 5));
                        const pos = prop.position ? (prop.position.getValueAtTime(time) || [0, 0]) : [0, 0];
                        const rot = prop.rotation ? (prop.rotation.getValueAtTime(time) || 0) : 0;
                        const rOut = prop.outerRadius ? (prop.outerRadius.getValueAtTime(time) || 50) : 50;
                        const rIn = prop.innerRadius ? (prop.innerRadius.getValueAtTime(time) || 25) : 25;
                        const rotRad = (rot - 90) * (Math.PI / 180);

                        let d = '';
                        if (starType === 2) {
                            for (let i = 0; i < pts; i++) {
                                const a = rotRad + (i * 2 * Math.PI) / pts;
                                const px = Math.round((pos[0] + rOut * Math.cos(a)) * 100) / 100;
                                const py = Math.round((pos[1] + rOut * Math.sin(a)) * 100) / 100;
                                d += (i === 0 ? `M ${px},${py} ` : `L ${px},${py} `);
                            }
                            d += 'Z';
                        } else {
                            const totalPts = pts * 2;
                            for (let i = 0; i < totalPts; i++) {
                                const a = rotRad + (i * Math.PI) / pts;
                                const r = (i % 2 === 0) ? rOut : rIn;
                                const px = Math.round((pos[0] + r * Math.cos(a)) * 100) / 100;
                                const py = Math.round((pos[1] + r * Math.sin(a)) * 100) / 100;
                                d += (i === 0 ? `M ${px},${py} ` : `L ${px},${py} `);
                            }
                            d += 'Z';
                        }

                        const fillAttr = formatFillAttr(localFill);
                        if (localStroke && localStroke.taper) {
                            if (localFill) {
                                svgChildren += `<path d="${d}" ${fillAttr} stroke="none" />`;
                            }
                            const shapeData = this.starToShapeData(starType, pts, pos, rot, rOut, rIn);
                            const taperedD = this.generateTaperedPathData(shapeData, localStroke);
                            if (taperedD) {
                                svgChildren += `<path d="${taperedD}" fill="${localStroke.color}" stroke="none" />`;
                            }
                        } else {
                            const strokeAttr = formatStrokeAttrs(localStroke);
                            svgChildren += `<path d="${d}" ${fillAttr} ${strokeAttr} />`;
                        }
                    } else if (prop instanceof VectorShapePath) {
                        if (combinePathsAsCompound) {
                            if (!compoundPathsRendered) {
                                compoundPathsRendered = true;
                                const dParts = [];
                                for (const pp of pathProps) {
                                    const sd = pp.path.getValueAtTime(time);
                                    if (sd && sd.vertices && sd.vertices.length > 0) {
                                        const subD = this.generateSVGPathData(sd);
                                        if (subD) dParts.push(subD);
                                    }
                                }
                                if (dParts.length > 0) {
                                    const fillAttr = formatFillAttr(localFill);
                                    const strokeAttr = formatStrokeAttrs(localStroke);
                                    svgChildren += `<path d="${dParts.join(' ')}" fill-rule="evenodd" ${fillAttr} ${strokeAttr} />`;
                                }
                            }
                        } else {
                            const shapeData = prop.path.getValueAtTime(time);
                            if (shapeData && shapeData.vertices && shapeData.vertices.length > 0) {
                                const d = this.generateSVGPathData(shapeData);
                                const fillAttr = formatFillAttr(localFill);
                                if (localStroke && localStroke.taper) {
                                    if (localFill) {
                                        svgChildren += `<path d="${d}" ${fillAttr} stroke="none" />`;
                                    }
                                    const taperedD = this.generateTaperedPathData(shapeData, localStroke);
                                    if (taperedD) {
                                        svgChildren += `<path d="${taperedD}" fill="${localStroke.color}" stroke="none" />`;
                                    }
                                } else {
                                    const strokeAttr = formatStrokeAttrs(localStroke);
                                    svgChildren += `<path d="${d}" ${fillAttr} ${strokeAttr} />`;
                                }
                            }
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

            return (svgDefs ? `<defs>${svgDefs}</defs>` : '') + svgChildren;
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

        rectToShapeData(pos, size, roundness) {
            const w = size[0] || 100, h = size[1] || 100;
            const hw = w / 2, hh = h / 2;
            const cx = pos[0] || 0, cy = pos[1] || 0;
            const round = Math.max(0, Math.min(roundness || 0, hw, hh));
            if (round <= 0.001) {
                return {
                    vertices: [
                        [cx - hw, cy - hh],
                        [cx + hw, cy - hh],
                        [cx + hw, cy + hh],
                        [cx - hw, cy + hh]
                    ],
                    inTangents: [[0, 0], [0, 0], [0, 0], [0, 0]],
                    outTangents: [[0, 0], [0, 0], [0, 0], [0, 0]],
                    closed: true
                };
            }
            const k = 0.5522847498 * round;
            return {
                vertices: [
                    [cx - hw + round, cy - hh],
                    [cx + hw - round, cy - hh],
                    [cx + hw, cy - hh + round],
                    [cx + hw, cy + hh - round],
                    [cx + hw - round, cy + hh],
                    [cx - hw + round, cy + hh],
                    [cx - hw, cy + hh - round],
                    [cx - hw, cy - hh + round]
                ],
                inTangents: [
                    [-k, 0], [0, 0], [0, -k], [0, 0],
                    [k, 0], [0, 0], [0, k], [0, 0]
                ],
                outTangents: [
                    [0, 0], [k, 0], [0, 0], [0, k],
                    [0, 0], [-k, 0], [0, 0], [-k, 0]
                ],
                closed: true
            };
        }

        ellipseToShapeData(pos, size) {
            const rx = (size[0] || 100) / 2;
            const ry = (size[1] || 100) / 2;
            const cx = pos[0] || 0, cy = pos[1] || 0;
            const kx = 0.5522847498 * rx;
            const ky = 0.5522847498 * ry;
            return {
                vertices: [
                    [cx, cy - ry],
                    [cx + rx, cy],
                    [cx, cy + ry],
                    [cx - rx, cy]
                ],
                inTangents: [
                    [-kx, 0], [0, -ky], [kx, 0], [0, ky]
                ],
                outTangents: [
                    [kx, 0], [0, ky], [-kx, 0], [0, -ky]
                ],
                closed: true
            };
        }

        starToShapeData(starType, pts, pos, rot, rOut, rIn) {
            const rotRad = ((rot || 0) - 90) * (Math.PI / 180);
            const vertices = [];
            const cx = pos[0] || 0, cy = pos[1] || 0;
            if (starType === 2) {
                for (let i = 0; i < pts; i++) {
                    const a = rotRad + (i * 2 * Math.PI) / pts;
                    vertices.push([cx + rOut * Math.cos(a), cy + rOut * Math.sin(a)]);
                }
            } else {
                const totalPts = pts * 2;
                for (let i = 0; i < totalPts; i++) {
                    const a = rotRad + (i * Math.PI) / pts;
                    const r = (i % 2 === 0) ? rOut : rIn;
                    vertices.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
                }
            }
            return {
                vertices: vertices,
                inTangents: vertices.map(() => [0, 0]),
                outTangents: vertices.map(() => [0, 0]),
                closed: true
            };
        }

        generateTaperedPathData(shape, strokeInfo) {
            const v = shape.vertices;
            if (!v || v.length < 2) return '';
            const inT = shape.inTangents || [];
            const outT = shape.outTangents || [];
            const isClosed = Boolean(shape.closed);
            const numSegments = isClosed ? v.length : (v.length - 1);

            const samples = [];
            const tangents = [];
            const normals = [];
            const distances = [0];
            let totalLen = 0;

            for (let s = 0; s < numSegments; s++) {
                const p0 = v[s];
                const o0 = outT[s] || [0, 0];
                const nextIdx = (s + 1) % v.length;
                const p3 = v[nextIdx];
                const i1 = inT[nextIdx] || [0, 0];

                const isCurved = (Math.abs(o0[0]) > 1e-4 || Math.abs(o0[1]) > 1e-4 || Math.abs(i1[0]) > 1e-4 || Math.abs(i1[1]) > 1e-4);
                const steps = isCurved ? 24 : 10;
                const startStep = (s === 0) ? 0 : 1;

                const cp1 = [p0[0] + o0[0], p0[1] + o0[1]];
                const cp2 = [p3[0] + i1[0], p3[1] + i1[1]];

                for (let k = startStep; k <= steps; k++) {
                    const t = k / steps;
                    let pt, dpt;
                    if (isCurved) {
                        const omt = 1 - t;
                        const omt2 = omt * omt;
                        const omt3 = omt2 * omt;
                        const t2 = t * t;
                        const t3 = t2 * t;

                        pt = [
                            omt3 * p0[0] + 3 * omt2 * t * cp1[0] + 3 * omt * t2 * cp2[0] + t3 * p3[0],
                            omt3 * p0[1] + 3 * omt2 * t * cp1[1] + 3 * omt * t2 * cp2[1] + t3 * p3[1]
                        ];
                        dpt = [
                            3 * omt2 * (cp1[0] - p0[0]) + 6 * omt * t * (cp2[0] - cp1[0]) + 3 * t2 * (p3[0] - cp2[0]),
                            3 * omt2 * (cp1[1] - p0[1]) + 6 * omt * t * (cp2[1] - cp1[1]) + 3 * t2 * (p3[1] - cp2[1])
                        ];
                    } else {
                        pt = [p0[0] + t * (p3[0] - p0[0]), p0[1] + t * (p3[1] - p0[1])];
                        dpt = [p3[0] - p0[0], p3[1] - p0[1]];
                    }

                    const dLen = Math.hypot(dpt[0], dpt[1]);
                    const tx = (dLen > 1e-6) ? (dpt[0] / dLen) : 1;
                    const ty = (dLen > 1e-6) ? (dpt[1] / dLen) : 0;
                    const nx = -ty;
                    const ny = tx;

                    if (samples.length > 0) {
                        const prevPt = samples[samples.length - 1];
                        const stepDist = Math.hypot(pt[0] - prevPt[0], pt[1] - prevPt[1]);
                        totalLen += stepDist;
                        distances.push(totalLen);
                    }

                    samples.push(pt);
                    tangents.push([tx, ty]);
                    normals.push([nx, ny]);
                }
            }

            if (totalLen < 1e-4 || samples.length < 2) return '';

            const baseW = strokeInfo.width || 1;
            const taper = strokeInfo.taper || {};
            const u_s = taper.startLength || 0;
            const u_e = taper.endLength || 0;
            const startW = (taper.startWidth !== undefined ? taper.startWidth : 0) / 100 * baseW;
            const endW = (taper.endWidth !== undefined ? taper.endWidth : 0) / 100 * baseW;
            const ease_s = (taper.startEase || 0) / 100;
            const ease_e = (taper.endEase || 0) / 100;
            const units = taper.lengthUnits || 1;

            let lenStart = (units === 2) ? u_s : (u_s / 100) * totalLen;
            let lenEnd = (units === 2) ? u_e : (u_e / 100) * totalLen;

            if (lenStart + lenEnd > totalLen && (lenStart + lenEnd) > 0) {
                const sc = totalLen / (lenStart + lenEnd);
                lenStart *= sc;
                lenEnd *= sc;
            }

            const calcEase = (tVal, easeVal) => {
                if (Math.abs(easeVal) < 1e-4) return tVal;
                if (easeVal > 0) {
                    return Math.pow(tVal, 1 + 2 * easeVal);
                } else {
                    return 1 - Math.pow(1 - tVal, 1 - 2 * easeVal);
                }
            };

            const calcWidthAtDist = (d) => {
                let w = baseW;
                if (lenStart > 1e-4 && d < lenStart) {
                    const u = Math.max(0, Math.min(1, d / lenStart));
                    w = startW + (baseW - startW) * calcEase(u, ease_s);
                }
                if (lenEnd > 1e-4 && d > (totalLen - lenEnd)) {
                    const u = Math.max(0, Math.min(1, (totalLen - d) / lenEnd));
                    const wEnd = endW + (baseW - endW) * calcEase(u, ease_e);
                    if (d < lenStart) {
                        w = Math.min(w, wEnd);
                    } else {
                        w = wEnd;
                    }
                }
                return Math.max(0, w);
            };

            const N = samples.length;
            const leftPts = [];
            const rightPts = [];

            for (let i = 0; i < N; i++) {
                const pt = samples[i];
                const norm = normals[i];
                const d = distances[i];
                const hw = calcWidthAtDist(d) * 0.5;
                leftPts.push([pt[0] + hw * norm[0], pt[1] + hw * norm[1]]);
                rightPts.push([pt[0] - hw * norm[0], pt[1] - hw * norm[1]]);
            }

            const roundCapPoints = (center, pFrom, pTo, outwardsDir) => {
                const r = Math.hypot(pFrom[0] - center[0], pFrom[1] - center[1]);
                if (r < 0.05) return [];
                const aFrom = Math.atan2(pFrom[1] - center[1], pFrom[0] - center[0]);
                const aTo = Math.atan2(pTo[1] - center[1], pTo[0] - center[0]);
                let da = (aTo - aFrom) % (2 * Math.PI);
                if (da < 0) da += 2 * Math.PI;
                const aOut = Math.atan2(outwardsDir[1], outwardsDir[0]);
                let diffOut = (aOut - aFrom) % (2 * Math.PI);
                if (diffOut < 0) diffOut += 2 * Math.PI;
                if (diffOut > da) {
                    da = da - 2 * Math.PI;
                }
                const capPts = [];
                const capSteps = 6;
                for (let s = 1; s <= capSteps; s++) {
                    const ang = aFrom + da * (s / capSteps);
                    capPts.push([center[0] + r * Math.cos(ang), center[1] + r * Math.sin(ang)]);
                }
                return capPts;
            };

            const capType = strokeInfo.cap || 'butt';
            const dParts = [];
            const wStart = calcWidthAtDist(0);
            const wEnd = calcWidthAtDist(totalLen);

            if (isClosed) {
                dParts.push(`M ${Math.round(leftPts[0][0]*100)/100},${Math.round(leftPts[0][1]*100)/100}`);
                for (let i = 1; i < N; i++) {
                    dParts.push(`L ${Math.round(leftPts[i][0]*100)/100},${Math.round(leftPts[i][1]*100)/100}`);
                }
                for (let i = N - 1; i >= 0; i--) {
                    dParts.push(`L ${Math.round(rightPts[i][0]*100)/100},${Math.round(rightPts[i][1]*100)/100}`);
                }
                dParts.push('Z');
            } else {
                // Open path
                // Start cap: from rightPts[0] to leftPts[0]
                if (wStart <= 0.05) {
                    dParts.push(`M ${Math.round(samples[0][0]*100)/100},${Math.round(samples[0][1]*100)/100}`);
                } else if (capType === 'round') {
                    dParts.push(`M ${Math.round(rightPts[0][0]*100)/100},${Math.round(rightPts[0][1]*100)/100}`);
                    const capStartPts = roundCapPoints(samples[0], rightPts[0], leftPts[0], [-tangents[0][0], -tangents[0][1]]);
                    for (const pt of capStartPts) {
                        dParts.push(`L ${Math.round(pt[0]*100)/100},${Math.round(pt[1]*100)/100}`);
                    }
                } else if (capType === 'square') {
                    const hw0 = wStart * 0.5;
                    const p1 = [rightPts[0][0] - hw0 * tangents[0][0], rightPts[0][1] - hw0 * tangents[0][1]];
                    const p2 = [leftPts[0][0] - hw0 * tangents[0][0], leftPts[0][1] - hw0 * tangents[0][1]];
                    dParts.push(`M ${Math.round(rightPts[0][0]*100)/100},${Math.round(rightPts[0][1]*100)/100}`);
                    dParts.push(`L ${Math.round(p1[0]*100)/100},${Math.round(p1[1]*100)/100}`);
                    dParts.push(`L ${Math.round(p2[0]*100)/100},${Math.round(p2[1]*100)/100}`);
                    dParts.push(`L ${Math.round(leftPts[0][0]*100)/100},${Math.round(leftPts[0][1]*100)/100}`);
                } else {
                    // Butt
                    dParts.push(`M ${Math.round(rightPts[0][0]*100)/100},${Math.round(rightPts[0][1]*100)/100}`);
                    dParts.push(`L ${Math.round(leftPts[0][0]*100)/100},${Math.round(leftPts[0][1]*100)/100}`);
                }

                // Forward along left boundary
                const startIdx = (wStart <= 0.05) ? 1 : 0;
                for (let i = startIdx; i < N; i++) {
                    dParts.push(`L ${Math.round(leftPts[i][0]*100)/100},${Math.round(leftPts[i][1]*100)/100}`);
                }

                // End cap: from leftPts[N-1] to rightPts[N-1]
                if (wEnd <= 0.05) {
                    dParts.push(`L ${Math.round(samples[N-1][0]*100)/100},${Math.round(samples[N-1][1]*100)/100}`);
                } else if (capType === 'round') {
                    const capEndPts = roundCapPoints(samples[N-1], leftPts[N-1], rightPts[N-1], tangents[N-1]);
                    for (const pt of capEndPts) {
                        dParts.push(`L ${Math.round(pt[0]*100)/100},${Math.round(pt[1]*100)/100}`);
                    }
                } else if (capType === 'square') {
                    const hwEnd = wEnd * 0.5;
                    const p1 = [leftPts[N-1][0] + hwEnd * tangents[N-1][0], leftPts[N-1][1] + hwEnd * tangents[N-1][1]];
                    const p2 = [rightPts[N-1][0] + hwEnd * tangents[N-1][0], rightPts[N-1][1] + hwEnd * tangents[N-1][1]];
                    dParts.push(`L ${Math.round(p1[0]*100)/100},${Math.round(p1[0]*100)/100}`);
                    dParts.push(`L ${Math.round(p2[0]*100)/100},${Math.round(p2[1]*100)/100}`);
                    dParts.push(`L ${Math.round(rightPts[N-1][0]*100)/100},${Math.round(rightPts[N-1][0]*100)/100}`);
                } else {
                    // Butt
                    dParts.push(`L ${Math.round(rightPts[N-1][0]*100)/100},${Math.round(rightPts[N-1][0]*100)/100}`);
                }

                // Backward along right boundary
                const endIdx = (wEnd <= 0.05) ? (N - 2) : (N - 1);
                for (let i = endIdx; i >= 0; i--) {
                    dParts.push(`L ${Math.round(rightPts[i][0]*100)/100},${Math.round(rightPts[i][1]*100)/100}`);
                }
                dParts.push('Z');
            }

            return dParts.join(' ');
        }

        // Render text content to SVG elements with accurate baseline ascent/descent,
        // justification alignments, paragraph box wrapping, and faux styles.
        // Reference: https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md
        renderTextContent(layer, time) {
            let txt = '';
            let textDoc = null;
            if (layer.sourceText) {
                const val = (typeof layer.sourceText.getValueAtTime === 'function')
                    ? layer.sourceText.getValueAtTime(time)
                    : layer.sourceText.value;
                if (val && typeof val === 'object') {
                    txt = (val.text !== undefined) ? String(val.text) : '';
                    textDoc = val;
                } else {
                    txt = String(val || '');
                }
                if (!txt && layer.sourceText._baseValue && (!this.isPlaying || time < 0.05)) {
                    const bv = layer.sourceText._baseValue;
                    if (bv && typeof bv === 'object') {
                        txt = (bv.text !== undefined) ? String(bv.text) : '';
                        if (!textDoc) textDoc = bv;
                    } else {
                        txt = String(bv || '');
                    }
                }
            }
            if (!txt && layer.text && typeof layer.text === 'string') {
                txt = layer.text;
            }
            if (!txt) return '';

            const calib = (typeof AETextCalibration !== 'undefined') ? AETextCalibration : null;
            const fs = layer.fontSize || (textDoc && textDoc.fontSize) || 24;
            const requestedFont = layer.fontFamily || layer.font || (textDoc && textDoc.font) || 'system-ui';
            const profile = calib ? calib.getFontProfile(requestedFont) : { ascentRatio: 0.78, descentRatio: 0.22, leadingRatio: 1.20, charWidthRatio: 0.52 };

            // Paragraph box detection
            const isBox = Boolean((textDoc && textDoc.boxText === true) || (layer.boxText === true));
            const boxSize = isBox ? ((textDoc && textDoc.boxTextSize) || layer.boxTextSize || null) : null;
            const boxWidth = boxSize ? boxSize[0] : 0;
            const boxHeight = boxSize ? boxSize[1] : 0;

            const rawJust = (textDoc && textDoc.justification !== undefined) ? textDoc.justification : (layer.justification || 'left');
            const normJust = (typeof normalizeJustification === 'function')
                ? normalizeJustification(rawJust)
                : ((rawJust === 'center' || rawJust === 2 || rawJust === 7414) ? 'center' : ((rawJust === 'right' || rawJust === 1 || rawJust === 7413) ? 'right' : 'left'));

            const tracking = (textDoc && textDoc.tracking !== undefined) ? textDoc.tracking : (layer.tracking || 0);
            const trackingPx = (tracking / 1000) * fs * (profile.trackingScale || 1.0);

            const firstLineIndent = (textDoc && textDoc.firstLineIndent !== undefined) ? textDoc.firstLineIndent : (layer.firstLineIndent || 0);
            const leftIndent = (textDoc && textDoc.leftIndent !== undefined) ? textDoc.leftIndent : (layer.leftIndent || 0);
            const rightIndent = (textDoc && textDoc.rightIndent !== undefined) ? textDoc.rightIndent : (layer.rightIndent || 0);
            const baselineShift = (textDoc && textDoc.baselineShift !== undefined) ? textDoc.baselineShift : (layer.baselineShift || 0);

            const fauxBold = (textDoc && textDoc.fauxBold) || Boolean(layer.fauxBold) || false;
            const fauxItalic = (textDoc && textDoc.fauxItalic) || Boolean(layer.fauxItalic) || false;
            const allCaps = (textDoc && textDoc.allCaps) || Boolean(layer.allCaps) || false;

            const applyStroke = (textDoc && textDoc.applyStroke) || Boolean(layer.applyStroke) || false;
            const strokeWidth = (textDoc && textDoc.strokeWidth !== undefined) ? textDoc.strokeWidth : (layer.strokeWidth || 1);
            let strokeColor = '#000000';
            if (applyStroke) {
                const rawSc = (textDoc && textDoc.strokeColor) || layer.strokeColor || [0, 0, 0];
                if (Array.isArray(rawSc)) {
                    const mult = Math.max(rawSc[0] || 0, rawSc[1] || 0, rawSc[2] || 0) <= 1.0 ? 255 : 1;
                    strokeColor = `rgb(${Math.round((rawSc[0] || 0) * mult)}, ${Math.round((rawSc[1] || 0) * mult)}, ${Math.round((rawSc[2] || 0) * mult)})`;
                } else {
                    strokeColor = String(rawSc);
                }
            }

            // Fill color
            let fill = '#ffffff';
            let rawCol = null;
            if (layer.effect && typeof layer.effect === 'function') {
                const effCol = layer.effect('Status Color') || layer.effect('Status Fill Color') || layer.effect('Color') || layer.effect('Fill') || layer.effect('Text Fill Color');
                if (effCol) {
                    const colProp = effCol.property('Color') || effCol.property(1);
                    if (colProp && typeof colProp.getValueAtTime === 'function') {
                        rawCol = colProp.getValueAtTime(time);
                    }
                }
            }
            if (!rawCol && textDoc && textDoc.fillColor) {
                rawCol = textDoc.fillColor;
            }
            if (!rawCol && layer.fontColor) {
                rawCol = (typeof layer.fontColor.getValueAtTime === 'function') ? layer.fontColor.getValueAtTime(time) : layer.fontColor;
            }
            if (rawCol) {
                if (Array.isArray(rawCol)) {
                    const mult = Math.max(rawCol[0] || 0, rawCol[1] || 0, rawCol[2] || 0) <= 1.0 ? 255 : 1;
                    fill = `rgb(${Math.round((rawCol[0] || 0) * mult)}, ${Math.round((rawCol[1] || 0) * mult)}, ${Math.round((rawCol[2] || 0) * mult)})`;
                } else {
                    fill = String(rawCol);
                }
            }

            // Font stack mapping
            let textFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            if (requestedFont) {
                const rawFontStr = String(requestedFont).replace(/"/g, "'").trim();
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
            }

            const defaultEmojiStack = "'Noto Color Emoji', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
            const emojiFont = layer.emojiFontFamily || defaultEmojiStack;
            const emojiRegex = /(\p{Extended_Pictographic}(?:[\uFE00-\uFE0F]|[\u{1F3FB}-\u{1F3FF}]|\u200D\p{Extended_Pictographic})*|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+)/gu;
            const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const leadingVal = (textDoc && textDoc.leading !== undefined) ? textDoc.leading : (layer.leading || 0);
            const autoLeading = (textDoc && textDoc.autoLeading !== undefined) ? textDoc.autoLeading : (leadingVal <= 0);
            const effectiveLeading = (!autoLeading && leadingVal > 0)
                ? leadingVal
                : (fs * (profile.leadingRatio || 1.20) * ((layer.leadingPercent || 100) / 100));

            let linesData = [];
            let firstBaselineY = 0;

            if (isBox && boxWidth > 0 && calib) {
                // Calibrated wrapped lines for paragraph box text
                linesData = calib.wrapParagraph(txt, boxWidth, fs, requestedFont, { firstLineIndent, leftIndent, rightIndent }, tracking);
                firstBaselineY = (fs * profile.ascentRatio) + (profile.yOffset || 0) + (calib.firstBaselineOffset || 0) - baselineShift;
            } else {
                // Point text lines
                const rawLines = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
                linesData = rawLines.map((l, i) => ({
                    text: l,
                    isFirstLine: i === 0,
                    lineWidth: calib ? calib.measureLineWidth(l, fs, requestedFont, tracking) : 0,
                    indentX: 0
                }));
                firstBaselineY = -baselineShift + (profile.yOffset || 0);
            }

            // Build calibrated tspans
            const tspans = linesData.map((lineObj, li) => {
                const lineText = lineObj.text;
                const lineY = firstBaselineY + (li * effectiveLeading);

                let lineX = 0;
                let textAnchor = 'start';

                if (isBox && boxWidth > 0) {
                    if (normJust === 'center') {
                        lineX = (boxWidth + leftIndent - rightIndent) / 2;
                        textAnchor = 'middle';
                    } else if (normJust === 'right') {
                        lineX = boxWidth - rightIndent;
                        textAnchor = 'end';
                    } else {
                        lineX = lineObj.indentX !== undefined ? lineObj.indentX : (leftIndent + (lineObj.isFirstLine ? firstLineIndent : 0));
                        textAnchor = 'start';
                    }
                } else {
                    if (normJust === 'center') {
                        lineX = 0;
                        textAnchor = 'middle';
                    } else if (normJust === 'right') {
                        lineX = 0;
                        textAnchor = 'end';
                    } else {
                        lineX = 0;
                        textAnchor = 'start';
                    }
                }

                if (!lineText) {
                    return `<tspan x="${lineX}" y="${lineY}" text-anchor="${textAnchor}">&#160;</tspan>`;
                }

                const parts = [];
                let lastIndex = 0;
                let match;
                emojiRegex.lastIndex = 0;

                // Detect if this text layer has color emoji vector children or hide-emoji text animators
                let hideFontEmojis = false;
                if (this.comp && this.comp.layers) {
                    const allLayers = Array.isArray(this.comp.layers) ? this.comp.layers : (this.comp.layers._layers || []);
                    hideFontEmojis = allLayers.some(l => l && l.parent === layer && (l.comment === 'AE_COLOR_EMOJI_CHILD' || (l.name && (l.name.indexOf('Color Emoji') !== -1 || l.name.indexOf('[Emoji]') !== -1))));
                }
                if (!hideFontEmojis) {
                    try {
                        const textProps = layer.property && (layer.property('ADBE Text Properties') || layer.property('Text'));
                        const animators = textProps && (textProps.property('ADBE Text Animators') || textProps.property('Animators'));
                        if (animators) {
                            const count = animators.numProperties || (animators._list ? animators._list.length : 0);
                            for (let ai = 1; ai <= count; ai++) {
                                const a = animators.property ? animators.property(ai) : (animators._list ? animators._list[ai - 1] : null);
                                if (a && a.name && (a.name.indexOf('Hide Font Emojis') !== -1 || a.name.indexOf('Hide Emojis') !== -1)) {
                                    hideFontEmojis = true;
                                    break;
                                }
                            }
                        }
                    } catch (eH) {}
                }

                while ((match = emojiRegex.exec(lineText)) !== null) {
                    if (match.index > lastIndex) {
                        parts.push(`<tspan font-family="${textFont}">${escapeXml(lineText.substring(lastIndex, match.index))}</tspan>`);
                    }
                    if (hideFontEmojis) {
                        parts.push(`<tspan font-family="${emojiFont}" font-size="${Math.round(fs * 1.05)}px" fill="transparent" fill-opacity="0" stroke="none" style="opacity: 0;">${escapeXml(match[0])}</tspan>`);
                    } else {
                        parts.push(`<tspan font-family="${emojiFont}" font-size="${Math.round(fs * 1.05)}px">${escapeXml(match[0])}</tspan>`);
                    }
                    lastIndex = emojiRegex.lastIndex;
                }
                if (lastIndex < lineText.length) {
                    parts.push(`<tspan font-family="${textFont}">${escapeXml(lineText.substring(lastIndex))}</tspan>`);
                }
                if (parts.length === 0) {
                    parts.push(`<tspan font-family="${textFont}">${escapeXml(lineText)}</tspan>`);
                }

                return `<tspan x="${lineX}" y="${lineY}" text-anchor="${textAnchor}">${parts.join('')}</tspan>`;
            }).join('');

            const strokeAttr = applyStroke ? `stroke="${strokeColor}" stroke-width="${strokeWidth}"` : '';
            const styleAttr = [
                'user-select:none',
                `font-weight:${fauxBold ? 'bold' : 'normal'}`,
                `font-style:${fauxItalic ? 'italic' : 'normal'}`,
                `text-transform:${allCaps ? 'uppercase' : 'none'}`,
                trackingPx !== 0 ? `letter-spacing:${trackingPx.toFixed(2)}px` : ''
            ].filter(Boolean).join('; ');

            return `
                <text fill="${fill}" font-size="${fs}px" ${strokeAttr} style="${styleAttr}">
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

            // Detect active Chat_Master_Controller and "Use Screen as Mask"
            let screenClipData = null;
            const masterCtrl = layers.find(l => l.name === 'Chat_Master_Controller');
            if (masterCtrl && masterCtrl.enabled) {
                try {
                    const effMask = masterCtrl.effect('Use Screen as Mask') || masterCtrl.effect('Clip Bubbles Outside Screen');
                    const useMask = effMask ? ((effMask('Checkbox') ? effMask('Checkbox').value : effMask.value) == 1) : true;
                    if (useMask) {
                        const effW = masterCtrl.effect('Screen Width');
                        const effH = masterCtrl.effect('Screen Height');
                        const effR = masterCtrl.effect('Screen Corner Radius');
                        const sw = effW ? ((effW('Slider') ? effW('Slider').value : effW.value) || 540) : 540;
                        const sh = effH ? ((effH('Slider') ? effH('Slider').value : effH.value) || 940) : 940;
                        const sr = effR ? ((effR('Slider') ? effR('Slider').value : effR.value) || 44) : 44;
                        const mMat = masterCtrl.getWorldMatrix(time);
                        const cx = (mMat && mMat[12] !== undefined) ? mMat[12] : (this.comp.width / 2);
                        const cy = (mMat && mMat[13] !== undefined) ? mMat[13] : (this.comp.height / 2);
                        screenClipData = {
                            cx: cx,
                            cy: cy,
                            w: sw,
                            h: sh,
                            r: Math.max(0, Math.min(sr, sw / 2, sh / 2))
                        };
                    }
                } catch (eM) {}
            }

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

                // Clip bubble layers strictly to screen boundaries if Use Screen as Mask is active
                if (layer.name && layer.name.indexOf('bubble_') === 0) {
                    if (screenClipData) {
                        const lx = worldMat[12] !== undefined ? worldMat[12] : (this.comp.width / 2);
                        const ly = worldMat[13] !== undefined ? worldMat[13] : (this.comp.height / 2);
                        const l = (screenClipData.cx - screenClipData.w / 2) - lx;
                        const r = (screenClipData.cx + screenClipData.w / 2) - lx;
                        const t = (screenClipData.cy - screenClipData.h / 2) - ly;
                        const b = (screenClipData.cy + screenClipData.h / 2) - ly;
                        const rad = screenClipData.r;
                        const clipPathStr = `path('M ${l + rad} ${t} L ${r - rad} ${t} A ${rad} ${rad} 0 0 1 ${r} ${t + rad} L ${r} ${b - rad} A ${rad} ${rad} 0 0 1 ${r - rad} ${b} L ${l + rad} ${b} A ${rad} ${rad} 0 0 1 ${l} ${b - rad} L ${l} ${t + rad} A ${rad} ${rad} 0 0 1 ${l + rad} ${t} Z')`;
                        layerEl.style.clipPath = clipPathStr;
                    } else {
                        layerEl.style.clipPath = '';
                    }
                } else if (layerEl.style.clipPath) {
                    layerEl.style.clipPath = '';
                }

                // Precomposition or Shape Layer SVG Render
                if (layer.source && layer.source.layers) {
                    let subTime = time;
                    if (layer.timeRemap && layer.timeRemapEnabled) {
                        try {
                            const trVal = layer.timeRemap.getValueAtTime(time);
                            if (typeof trVal === 'number' && !isNaN(trVal)) {
                                subTime = trVal;
                            }
                        } catch (eTR) {}
                    }
                    layer.source.time = subTime;
                    layerEl.innerHTML = this.renderCompLayersHtml(layer.source, subTime, isStaticPreview, 0);
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

        renderCompLayersHtml(compItem, time, isStaticPreview, depth = 0) {
            if (!compItem || !compItem.layers) return '';
            if (depth > 6) return ''; // Safeguard against infinite circular nesting
            let subHtml = '';
            for (let s = compItem.layers.length - 1; s >= 0; s--) {
                const subLayer = compItem.layers[s];
                if (!subLayer.enabled) continue;
                const subMat = subLayer.getWorldMatrix(time, isStaticPreview);
                const subCss = Mat4.toCSS(subMat);
                let subOpacity = (typeof subLayer.getWorldOpacity === 'function') ? subLayer.getWorldOpacity(time) : 1.0;
                if (isStaticPreview && subOpacity === 0) {
                    const compDur = (subLayer.containingComp && subLayer.containingComp.duration)
                        ? subLayer.containingComp.duration
                        : ((compItem && compItem.duration) ? compItem.duration : 10.0);
                    const endOpacity = (typeof subLayer.getWorldOpacity === 'function') ? subLayer.getWorldOpacity(compDur) : 0;
                    if (endOpacity > 0) {
                        subOpacity = endOpacity;
                    }
                }

                let subContent = '';
                if (subLayer.source && subLayer.source.layers) {
                    let nestedTime = time;
                    if (subLayer.timeRemap && subLayer.timeRemapEnabled) {
                        try {
                            const trVal = subLayer.timeRemap.getValueAtTime(time);
                            if (typeof trVal === 'number' && !isNaN(trVal)) {
                                nestedTime = trVal;
                            }
                        } catch (e) {}
                    }
                    subLayer.source.time = nestedTime;
                    subContent = this.renderCompLayersHtml(subLayer.source, nestedTime, isStaticPreview, depth + 1);
                } else if (typeof TextLayer !== 'undefined' && subLayer instanceof TextLayer) {
                    subContent = `<svg class="ae-layer-svg" style="overflow: visible;">${this.renderTextContent(subLayer, time)}</svg>`;
                } else if (subLayer.sourceText) {
                    subContent = `<svg class="ae-layer-svg" style="overflow: visible;">${this.renderTextContent(subLayer, time)}</svg>`;
                } else if (subLayer.contents) {
                    subContent = `<svg class="ae-layer-svg" style="overflow: visible;">${this.renderShapeContents(subLayer.contents, time)}</svg>`;
                }

                if (subContent) {
                    const subZ = compItem.layers.length - s;
                    subHtml += `
                        <div class="ae-sublayer" style="position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0 0; backface-visibility: visible; transform: ${subCss}; opacity: ${subOpacity}; z-index: ${subZ}; transform-style: preserve-3d;">
                            ${subContent}
                        </div>
                    `;
                }
            }
            return subHtml;
        }
    }

    global.AERenderer = AERenderer;

})(typeof window !== 'undefined' ? window : global);
