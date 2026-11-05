/**
 * windows-color-picker.js
 * High-fidelity Windows ChooseColor modal dialog emulation for After Effects Web IDE & ScriptUI
 */

(function(global) {
    'use strict';

    // 48 Standard Windows Basic Colours (8 columns x 6 rows)
    const WIN_BASIC_COLORS = [
        // Row 1
        '#FF8080', '#FFFF80', '#80FF80', '#00FF80', '#80FFFF', '#0080FF', '#FF80C0', '#FF80FF',
        // Row 2
        '#FF0000', '#FFFF00', '#80FF00', '#00FF40', '#00FFFF', '#0080C0', '#8080C0', '#FF00FF',
        // Row 3
        '#804040', '#FF8040', '#00FF00', '#008080', '#004080', '#8080FF', '#800040', '#FF0080',
        // Row 4
        '#800000', '#FF8000', '#008000', '#008040', '#0000FF', '#0000A0', '#800080', '#8000FF',
        // Row 5
        '#400000', '#804000', '#004000', '#004040', '#000080', '#000040', '#400040', '#400080',
        // Row 6
        '#000000', '#808000', '#808040', '#808080', '#408080', '#C0C0C0', '#400040', '#FFFFFF'
    ];

    // Default 16 custom colors
    const STORAGE_KEY = 'ae_win_custom_colours';
    function getStoredCustomColors() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr) && arr.length === 16) return arr;
            }
        } catch (e) {}
        return new Array(16).fill('#FFFFFF');
    }

    function saveStoredCustomColors(colors) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
        } catch (e) {}
    }

    // Windows HSL <-> RGB Math
    // Windows Scale: Hue: 0-239, Sat: 0-240, Lum: 0-240
    // RGB Scale: Red, Green, Blue: 0-255
    function rgbToWinHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l < 0.5 ? d / (max + min) : d / (2 - max - min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        const winH = Math.round(h * 240) % 240;
        const winS = Math.round(s * 240);
        const winL = Math.round(l * 240);
        return { h: winH, s: winS, l: winL };
    }

    function winHslToRgb(winH, winS, winL) {
        const h = (winH % 240) / 240;
        const s = Math.max(0, Math.min(240, winS)) / 240;
        const l = Math.max(0, Math.min(240, winL)) / 240;

        if (s === 0) {
            const val = Math.round(l * 255);
            return { r: val, g: val, b: val };
        }

        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
        const g = Math.round(hue2rgb(p, q, h) * 255);
        const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
        return { r, g, b };
    }

    function rgbToHex(r, g, b) {
        const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        return '#' + hex.toUpperCase();
    }

    function hexToRgb(hex) {
        if (!hex) return { r: 0, g: 0, b: 0 };
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const num = parseInt(hex, 16);
        if (isNaN(num)) return { r: 0, g: 0, b: 0 };
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    let activeCallback = null;
    let customColors = getStoredCustomColors();
    let selectedCustomIndex = 0;

    // Current State
    let currentH = 140; // 0-239
    let currentS = 206; // 0-240
    let currentL = 128; // 0-240
    let currentR = 34;  // 0-255
    let currentG = 136; // 0-255
    let currentB = 238; // 0-255

    let isSpectrumDragging = false;
    let isLumDragging = false;

    // DOM Elements Cache
    let modalBackdrop = null;
    let spectrumCanvas = null;
    let spectrumCtx = null;
    let spectrumCrosshair = null;
    let lumCanvas = null;
    let lumCtx = null;
    let lumArrow = null;
    let previewBox = null;

    let inputHue = null;
    let inputSat = null;
    let inputLum = null;
    let inputRed = null;
    let inputGreen = null;
    let inputBlue = null;
    let inputHex = null;

    function buildDialogDOM() {
        if (modalBackdrop) return;

        modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'win-color-modal-backdrop';
        modalBackdrop.id = 'win-color-modal-backdrop';
        modalBackdrop.style.display = 'none';

        modalBackdrop.innerHTML = `
            <div class="win-color-dialog" id="win-color-dialog">
                <!-- Title Bar -->
                <div class="win-dialog-titlebar">
                    <span class="win-dialog-title">Colour</span>
                    <button class="win-dialog-close" id="win-color-btn-close" title="Close">✕</button>
                </div>
                <!-- Dialog Content -->
                <div class="win-dialog-body">
                    <!-- Left Pane -->
                    <div class="win-color-left-pane">
                        <div class="win-color-section-title">Basic colours:</div>
                        <div class="win-basic-grid" id="win-basic-grid"></div>

                        <div class="win-color-section-title" style="margin-top: 14px;">Custom colours:</div>
                        <div class="win-custom-grid" id="win-custom-grid"></div>

                        <button class="win-btn win-btn-wide" id="win-btn-define-custom" style="margin-top: 12px;">Define Custom Colours &gt;&gt;</button>
                    </div>

                    <!-- Right Pane: Spectrum, Lum Slider, Preview, Inputs -->
                    <div class="win-color-right-pane" id="win-color-right-pane">
                        <div class="win-spectrum-row">
                            <div class="win-spectrum-box" id="win-spectrum-box">
                                <canvas id="win-spectrum-canvas" width="180" height="180"></canvas>
                                <div class="win-spectrum-crosshair" id="win-spectrum-crosshair"></div>
                            </div>
                            <div class="win-lum-box" id="win-lum-box">
                                <canvas id="win-lum-canvas" width="16" height="180"></canvas>
                                <div class="win-lum-arrow" id="win-lum-arrow">◀</div>
                            </div>
                        </div>

                        <!-- Preview & Inputs -->
                        <div class="win-inputs-row">
                            <div class="win-preview-col">
                                <div class="win-preview-box" id="win-preview-box"></div>
                                <div class="win-preview-label">Colour|Solid</div>
                            </div>

                            <div class="win-fields-col">
                                <div class="win-field-row">
                                    <label><u>H</u>ue:</label>
                                    <input type="number" id="win-input-hue" min="0" max="239" class="win-field-input">
                                </div>
                                <div class="win-field-row">
                                    <label><u>S</u>at:</label>
                                    <input type="number" id="win-input-sat" min="0" max="240" class="win-field-input">
                                </div>
                                <div class="win-field-row">
                                    <label><u>L</u>um:</label>
                                    <input type="number" id="win-input-lum" min="0" max="240" class="win-field-input">
                                </div>
                            </div>

                            <div class="win-fields-col">
                                <div class="win-field-row">
                                    <label><u>R</u>ed:</label>
                                    <input type="number" id="win-input-red" min="0" max="255" class="win-field-input">
                                </div>
                                <div class="win-field-row">
                                    <label><u>G</u>reen:</label>
                                    <input type="number" id="win-input-green" min="0" max="255" class="win-field-input">
                                </div>
                                <div class="win-field-row">
                                    <label><u>B</u>lue:</label>
                                    <input type="number" id="win-input-blue" min="0" max="255" class="win-field-input">
                                </div>
                            </div>
                        </div>

                        <div class="win-actions-row">
                            <div class="win-hex-row">
                                <label>Hex:</label>
                                <input type="text" id="win-input-hex" maxlength="7" class="win-field-input win-field-hex">
                            </div>
                            <button class="win-btn" id="win-btn-add-custom">Add to Custom Colours</button>
                        </div>
                    </div>
                </div>

                <!-- Footer: OK / Cancel -->
                <div class="win-dialog-footer">
                    <button class="win-btn win-btn-default" id="win-color-btn-ok">OK</button>
                    <button class="win-btn" id="win-color-btn-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalBackdrop);

        // Bind DOM elements
        spectrumCanvas = document.getElementById('win-spectrum-canvas');
        spectrumCtx = spectrumCanvas.getContext('2d');
        spectrumCrosshair = document.getElementById('win-spectrum-crosshair');
        lumCanvas = document.getElementById('win-lum-canvas');
        lumCtx = lumCanvas.getContext('2d');
        lumArrow = document.getElementById('win-lum-arrow');
        previewBox = document.getElementById('win-preview-box');

        inputHue = document.getElementById('win-input-hue');
        inputSat = document.getElementById('win-input-sat');
        inputLum = document.getElementById('win-input-lum');
        inputRed = document.getElementById('win-input-red');
        inputGreen = document.getElementById('win-input-green');
        inputBlue = document.getElementById('win-input-blue');
        inputHex = document.getElementById('win-input-hex');

        // Render Basic Colors
        const basicGrid = document.getElementById('win-basic-grid');
        WIN_BASIC_COLORS.forEach((hex, i) => {
            const swatch = document.createElement('div');
            swatch.className = 'win-swatch';
            swatch.style.backgroundColor = hex;
            swatch.title = hex;
            swatch.onclick = () => {
                selectColorFromHex(hex);
                highlightSwatch(swatch);
            };
            basicGrid.appendChild(swatch);
        });

        // Render Custom Colors
        renderCustomGrid();

        // Setup 2D Spectrum Drawing
        drawSpectrumCanvas();

        // Spectrum Interaction
        const spectrumBox = document.getElementById('win-spectrum-box');
        spectrumBox.onmousedown = (e) => {
            isSpectrumDragging = true;
            handleSpectrumDrag(e);
        };

        // Lum Interaction
        const lumBox = document.getElementById('win-lum-box');
        lumBox.onmousedown = (e) => {
            isLumDragging = true;
            handleLumDrag(e);
        };

        window.addEventListener('mousemove', (e) => {
            if (isSpectrumDragging) handleSpectrumDrag(e);
            if (isLumDragging) handleLumDrag(e);
        });

        window.addEventListener('mouseup', () => {
            isSpectrumDragging = false;
            isLumDragging = false;
        });

        // Input Listeners
        inputHue.oninput = () => {
            let h = parseInt(inputHue.value, 10);
            if (isNaN(h)) h = 0;
            currentH = Math.max(0, Math.min(239, h));
            updateFromHsl();
        };
        inputSat.oninput = () => {
            let s = parseInt(inputSat.value, 10);
            if (isNaN(s)) s = 0;
            currentS = Math.max(0, Math.min(240, s));
            updateFromHsl();
        };
        inputLum.oninput = () => {
            let l = parseInt(inputLum.value, 10);
            if (isNaN(l)) l = 0;
            currentL = Math.max(0, Math.min(240, l));
            updateFromHsl();
        };

        inputRed.oninput = () => {
            let r = parseInt(inputRed.value, 10);
            if (isNaN(r)) r = 0;
            currentR = Math.max(0, Math.min(255, r));
            updateFromRgb();
        };
        inputGreen.oninput = () => {
            let g = parseInt(inputGreen.value, 10);
            if (isNaN(g)) g = 0;
            currentG = Math.max(0, Math.min(255, g));
            updateFromRgb();
        };
        inputBlue.oninput = () => {
            let b = parseInt(inputBlue.value, 10);
            if (isNaN(b)) b = 0;
            currentB = Math.max(0, Math.min(255, b));
            updateFromRgb();
        };

        inputHex.onchange = () => {
            let val = inputHex.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                selectColorFromHex(val);
            } else {
                inputHex.value = rgbToHex(currentR, currentG, currentB);
            }
        };

        // Add to Custom Colours
        document.getElementById('win-btn-add-custom').onclick = () => {
            const hex = rgbToHex(currentR, currentG, currentB);
            customColors[selectedCustomIndex] = hex;
            saveStoredCustomColors(customColors);
            renderCustomGrid();
            selectedCustomIndex = (selectedCustomIndex + 1) % 16;
            highlightCustomSwatch(selectedCustomIndex);
        };

        // Dialog Buttons
        document.getElementById('win-color-btn-ok').onclick = () => {
            const confirmedHex = rgbToHex(currentR, currentG, currentB);
            const cb = activeCallback;
            closeDialog();
            if (typeof cb === 'function') {
                cb(confirmedHex);
            }
        };

        const cancelFn = () => {
            closeDialog();
        };
        document.getElementById('win-color-btn-cancel').onclick = cancelFn;
        document.getElementById('win-color-btn-close').onclick = cancelFn;

        modalBackdrop.onclick = (e) => {
            if (e.target === modalBackdrop) cancelFn();
        };

        window.addEventListener('keydown', (e) => {
            if (modalBackdrop.style.display !== 'none') {
                if (e.key === 'Escape') cancelFn();
                if (e.key === 'Enter') document.getElementById('win-color-btn-ok').click();
            }
        });
    }

    function renderCustomGrid() {
        const customGrid = document.getElementById('win-custom-grid');
        if (!customGrid) return;
        customGrid.innerHTML = '';
        customColors.forEach((hex, i) => {
            const swatch = document.createElement('div');
            swatch.className = 'win-swatch';
            if (i === selectedCustomIndex) swatch.classList.add('selected');
            swatch.style.backgroundColor = hex;
            swatch.title = `Custom ${i + 1}: ${hex}`;
            swatch.onclick = () => {
                selectedCustomIndex = i;
                highlightCustomSwatch(i);
                if (hex && hex !== '#FFFFFF') {
                    selectColorFromHex(hex);
                }
            };
            customGrid.appendChild(swatch);
        });
    }

    function highlightCustomSwatch(index) {
        const customGrid = document.getElementById('win-custom-grid');
        if (!customGrid) return;
        Array.from(customGrid.children).forEach((s, idx) => {
            s.classList.toggle('selected', idx === index);
        });
    }

    function highlightSwatch(swatchEl) {
        document.querySelectorAll('.win-basic-grid .win-swatch').forEach(s => s.classList.remove('selected'));
        if (swatchEl) swatchEl.classList.add('selected');
    }

    // 2D Hue/Saturation Canvas: Horizontal = Hue (0-239), Vertical = Sat (240 top to 0 bottom)
    function drawSpectrumCanvas() {
        const width = spectrumCanvas.width;
        const height = spectrumCanvas.height;
        const imgData = spectrumCtx.createImageData(width, height);
        const data = imgData.data;

        for (let y = 0; y < height; y++) {
            const sat = Math.round(((height - 1 - y) / (height - 1)) * 240);
            for (let x = 0; x < width; x++) {
                const hue = Math.round((x / (width - 1)) * 239);
                // Draw at Lum = 120 (pure mid-luminance hue/sat representation)
                const rgb = winHslToRgb(hue, sat, 120);
                const idx = (y * width + x) * 4;
                data[idx] = rgb.r;
                data[idx + 1] = rgb.g;
                data[idx + 2] = rgb.b;
                data[idx + 3] = 255;
            }
        }
        spectrumCtx.putImageData(imgData, 0, 0);
    }

    // 1D Luminance Slider Canvas: Top = White, Middle = Current (Hue, Sat), Bottom = Black
    function drawLumCanvas() {
        const width = lumCanvas.width;
        const height = lumCanvas.height;
        const imgData = lumCtx.createImageData(width, height);
        const data = imgData.data;

        for (let y = 0; y < height; y++) {
            const lum = Math.round(((height - 1 - y) / (height - 1)) * 240);
            const rgb = winHslToRgb(currentH, currentS, lum);
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = rgb.r;
                data[idx + 1] = rgb.g;
                data[idx + 2] = rgb.b;
                data[idx + 3] = 255;
            }
        }
        lumCtx.putImageData(imgData, 0, 0);
    }

    function handleSpectrumDrag(e) {
        const rect = spectrumCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        x = Math.max(0, Math.min(rect.width, x));
        y = Math.max(0, Math.min(rect.height, y));

        currentH = Math.round((x / rect.width) * 239);
        currentS = Math.round(((rect.height - y) / rect.height) * 240);

        updateFromHsl();
    }

    function handleLumDrag(e) {
        const rect = lumCanvas.getBoundingClientRect();
        let y = e.clientY - rect.top;
        y = Math.max(0, Math.min(rect.height, y));

        currentL = Math.round(((rect.height - y) / rect.height) * 240);
        updateFromHsl();
    }

    function updateFromHsl() {
        const rgb = winHslToRgb(currentH, currentS, currentL);
        currentR = rgb.r;
        currentG = rgb.g;
        currentB = rgb.b;
        syncUI();
    }

    function updateFromRgb() {
        const hsl = rgbToWinHsl(currentR, currentG, currentB);
        currentH = hsl.h;
        currentS = hsl.s;
        currentL = hsl.l;
        syncUI();
    }

    function selectColorFromHex(hex) {
        const rgb = hexToRgb(hex);
        currentR = rgb.r;
        currentG = rgb.g;
        currentB = rgb.b;
        const hsl = rgbToWinHsl(currentR, currentG, currentB);
        currentH = hsl.h;
        currentS = hsl.s;
        currentL = hsl.l;
        syncUI();
    }

    function syncUI() {
        // Redraw Lum bar with current Hue and Sat
        drawLumCanvas();

        // Position crosshair
        const x = (currentH / 239) * 180;
        const y = (1 - (currentS / 240)) * 180;
        spectrumCrosshair.style.left = `${Math.round(x)}px`;
        spectrumCrosshair.style.top = `${Math.round(y)}px`;

        // Position Lum arrow (y: 0 top = Lum 240, 180 bottom = Lum 0)
        const lumY = (1 - (currentL / 240)) * 180;
        lumArrow.style.top = `${Math.round(lumY)}px`;

        // Update Preview
        const hex = rgbToHex(currentR, currentG, currentB);
        previewBox.style.backgroundColor = hex;

        // Update Text Fields
        inputHue.value = currentH;
        inputSat.value = currentS;
        inputLum.value = currentL;
        inputRed.value = currentR;
        inputGreen.value = currentG;
        inputBlue.value = currentB;
        inputHex.value = hex;
    }

    function openDialog(initialColor, callback) {
        buildDialogDOM();
        activeCallback = callback;

        let hex = '#2288EE';
        if (typeof initialColor === 'number' && initialColor >= 0) {
            hex = '#' + initialColor.toString(16).padStart(6, '0');
        } else if (typeof initialColor === 'string' && initialColor.trim()) {
            hex = initialColor.trim().startsWith('#') ? initialColor.trim() : '#' + initialColor.trim();
        }

        selectColorFromHex(hex);
        modalBackdrop.style.display = 'flex';
    }

    function closeDialog() {
        if (modalBackdrop) {
            modalBackdrop.style.display = 'none';
        }
        activeCallback = null;
    }

    // Export globally
    global.openWindowsColorPicker = openDialog;

})(typeof window !== 'undefined' ? window : this);
