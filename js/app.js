/**
 * Co-authored & architected with Google DeepMind Antigravity.
 * app.js
 * After Effects Web IDE Controller & Timeline Inspector
 */

(function(global) {
    'use strict';

    // -------------------------------------------------------------
    // Version Management (v1.2.12)
    // -------------------------------------------------------------
    function computeDailyVersion() {
        return '1.2.12';
    }

    const APP_VERSION = '1.2.12';
    global.EMULATOR_VERSION = APP_VERSION;
    global.AE_TEXT_GUIDE_URL = 'https://github.com/work2survive/AE_JS_builder/blob/main/AE_VS_JS_TEXT_RENDERING_DIFFERENCES.md';

    let renderer = null;
    let selectedLayer = null;
    let globalShyActive = true; // Switch to shy all properties not related to .JSX UI by default
    const expressionsVisible = true; // Always show expressions

    // Console logging helper
    function appendConsole(msg, isError = false) {
        const consoleEl = document.getElementById('ae-console-drawer');
        if (!consoleEl) return;
        const line = document.createElement('div');
        line.className = 'ae-console-line' + (isError ? ' error' : '');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }
    global.aeConsoleLog = appendConsole;

    // HTML / Attribute safety escaper (prevents quotes in expressions from breaking DOM tags)
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeAttr(str) {
        if (str === null || str === undefined) return '';
        return escapeHtml(str).replace(/\r?\n/g, '&#10;');
    }

    // Helper: Formats color array [r, g, b] (0-1 or 0-255) to hex & rgb(R, G, B)
    function formatRgbInfo(val) {
        let r = 255, g = 255, b = 255;
        if (Array.isArray(val)) {
            const maxVal = Math.max(val[0] || 0, val[1] || 0, val[2] || 0);
            if (maxVal <= 1.0) {
                r = Math.round((val[0] || 0) * 255);
                g = Math.round((val[1] || 0) * 255);
                b = Math.round((val[2] || 0) * 255);
            } else {
                r = Math.round(val[0] || 0);
                g = Math.round(val[1] || 0);
                b = Math.round(val[2] || 0);
            }
        } else if (typeof val === 'string' && val.startsWith('#')) {
            const h = val.replace('#', '');
            r = parseInt(h.slice(0, 2), 16) || 0;
            g = parseInt(h.slice(2, 4), 16) || 0;
            b = parseInt(h.slice(4, 6), 16) || 0;
        }
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));

        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        const rgbStr = `rgb(${r}, ${g}, ${b})`;
        return { r, g, b, hex, rgbStr };
    }

    // Smooth real-time update of dynamic timeline rows (Circle RGB, Wiggle, Blink)
    window.updateDynamicTimelineProperties = function(time) {
        const dynamicBtns = document.querySelectorAll('.ae-prop-eval-btn[data-mode="circle"], .ae-prop-eval-btn[data-mode="wiggle"], .ae-prop-eval-btn[data-mode="blink"]');
        if (!dynamicBtns || dynamicBtns.length === 0) return;
        dynamicBtns.forEach(btn => {
            const propId = btn.dataset.propId;
            const prop = (typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
            if (!prop) return;
            const row = btn.closest('.ae-prop-row');
            if (!row) return;

            if (prop.type === 'color' || isColorProperty(prop)) {
                const swatch = row.querySelector('.ae-color-swatch-box');
                const rgbLabel = row.querySelector('.ae-color-rgb-val');
                const val = prop.getValueAtTime(time);
                const info = formatRgbInfo(val);
                if (swatch) swatch.style.backgroundColor = info.hex;
                if (rgbLabel) {
                    rgbLabel.textContent = info.rgbStr;
                    rgbLabel.title = `RGB Code: ${info.rgbStr}`;
                }
            } else if (prop.type === 'boolean' || isBooleanProperty(prop)) {
                const chk = row.querySelector('.ae-effect-checkbox');
                const labelSpan = row.querySelector('.ae-boolean-val-label') || row.querySelector('.ae-prop-val-container label span');
                const val = Boolean(prop.getValueAtTime(time));
                if (chk) chk.checked = val;
                if (labelSpan) {
                    labelSpan.textContent = val ? '1 (true)' : '0 (false)';
                    labelSpan.style.color = val ? 'var(--ae-blue)' : '#888';
                }
            }
        });
    };

    // -------------------------------------------------------------
    // Timeline Inspector UI Generation (Matches AE Look Exactly)
    // -------------------------------------------------------------
    const EVAL_MODES_STANDARD = [
        { mode: 'rand', letter: 'R', label: 'Rand', desc: 'Randomize on tick', color: '#00e676', textColor: '#0a3d1b' },
        { mode: 'wiggle', letter: 'W', label: 'Wiggle', desc: 'Smooth Harmonic Wiggle', color: '#ffd166', textColor: '#3d2c00' },
        { mode: 'stop', letter: 'S', label: 'Stop', desc: 'Freeze evaluated value', color: '#ff5252', textColor: '#ffffff' },
        { mode: 'base', letter: 'B', label: 'Base', desc: 'Static base value (reset)', color: '#8b949e', textColor: '#ffffff' }
    ];

    const EVAL_MODES_COLOR = [
        { mode: 'orig', letter: 'O', label: 'Original', desc: 'Original color (UI panel)', color: '#2563eb', textColor: '#ffffff' },
        { mode: 'rand', letter: 'R', label: 'Random', desc: 'Random fixed color', color: '#db2777', textColor: '#ffffff' },
        { mode: 'circle', letter: 'C', label: 'Circle RGB', desc: 'Circle RGB spectrum (5s cycle)', color: 'linear-gradient(135deg, #ff0055, #00ffcc, #3300ff)', isGradient: true, textColor: '#ffffff' },
        { mode: 'wiggle', letter: 'W', label: 'Wiggle', desc: 'Wiggle color (harmonic shift)', color: '#ffd166', textColor: '#3d2c00' },
        { mode: 'half', letter: 'H', label: '50% Opacity', desc: '50% opacity (semi-transparent)', color: '#8b5cf6', textColor: '#ffffff' },
        { mode: 'transparent', letter: 'T', label: 'Transparent', desc: '100% transparent (hidden)', color: '#334155', textColor: '#cbd5e1' }
    ];

    const EVAL_MODES_BOOLEAN = [
        { mode: 'default', letter: 'D', label: 'Default', desc: 'Default / base value or expression', color: '#8b949e', textColor: '#ffffff' },
        { mode: 'true', letter: 'T', label: 'True', desc: 'Forced True (1)', color: '#00e676', textColor: '#0a3d1b' },
        { mode: 'false', letter: 'F', label: 'False', desc: 'Forced False (0)', color: '#ff5252', textColor: '#ffffff' },
        { mode: 'blink', letter: 'B', label: 'Blink', desc: 'Blink (1 per second)', color: '#ffd166', textColor: '#3d2c00' }
    ];

    function isBooleanProperty(prop) {
        if (!prop) return false;
        if (prop.type === 'boolean') return true;
        const name = (prop.name || '').toLowerCase();
        const matchName = (prop.matchName || '').toLowerCase();
        if (name === 'checkbox' || matchName.includes('checkbox')) return true;
        return false;
    }

    function isColorProperty(prop) {
        if (!prop) return false;
        if (prop.type === 'color') return true;
        const name = (prop.name || '').toLowerCase();
        if (name === 'color' || name.includes('color') || name.includes('tint')) return true;
        return false;
    }

    function getEvalModesForProp(prop) {
        if (isBooleanProperty(prop)) return EVAL_MODES_BOOLEAN;
        return isColorProperty(prop) ? EVAL_MODES_COLOR : EVAL_MODES_STANDARD;
    }

    function renderEvalModeSwitch(prop) {
        if (!prop || !prop._id) return '';
        const isBool = isBooleanProperty(prop);
        const isColor = !isBool && isColorProperty(prop);
        const modesList = isBool ? EVAL_MODES_BOOLEAN : (isColor ? EVAL_MODES_COLOR : EVAL_MODES_STANDARD);
        const defaultMode = isBool ? 'default' : (isColor ? 'orig' : (prop.expression ? 'wiggle' : 'base'));
        let mode = prop.animMode || defaultMode;
        if (isBool) {
            if (!prop.animMode || prop.animMode === 'base' || !modesList.some(m => m.mode === mode)) {
                mode = 'default';
                prop.animMode = 'default';
            }
        } else if (isColor && (mode === 'base' || !prop.animMode)) {
            mode = 'orig';
            prop.animMode = 'orig';
        } else if (!isColor && prop.expression && prop.expressionEnabled && (!prop.animMode || mode === 'base')) {
            mode = 'wiggle';
            prop.animMode = 'wiggle';
        }
        let cfg = modesList.find(m => m.mode === mode);
        if (!cfg) {
            mode = defaultMode;
            cfg = modesList[0];
        }

        const cycleHint = modesList.map(m => m.letter).join(' → ');
        const title = `Evaluation: [${cfg.letter}] ${cfg.label} (${cfg.desc}) - Click to cycle: ${cycleHint}`;
        const bgStyle = cfg.isGradient ? `background: ${cfg.color};` : `background-color: ${cfg.color};`;

        return `
            <button class="ae-prop-eval-btn ${isColor ? 'ae-eval-btn-color' : ''} ${isBool ? 'ae-eval-btn-bool' : ''}" data-action="cycle-prop-mode" data-is-color="${isColor ? '1' : '0'}" data-is-bool="${isBool ? '1' : '0'}" data-mode="${mode}" data-prop-id="${prop._id}" title="${title}">
                <span class="ae-eval-color-box ${mode === 'transparent' ? 'is-transparent' : ''} ${mode === 'half' ? 'is-half' : ''}" style="${bgStyle} color: ${cfg.textColor};">
                    <span class="ae-eval-letter">${cfg.letter}</span>
                    <span class="ae-eval-knob"></span>
                </span>
            </button>
        `;
    }
    const render4WaySwitch = renderEvalModeSwitch;
    window.renderEvalModeSwitch = renderEvalModeSwitch;
    window.EVAL_MODES_BOOLEAN = EVAL_MODES_BOOLEAN;

    // Per-Property Toggle Expression Switch (= / ≠)
    function renderPropExprToggle(prop) {
        if (!prop || !prop._expression || !prop._expression.trim()) return '';
        const isEnabled = Boolean(prop.expressionEnabled);
        return `<button class="ae-prop-expr-toggle ${isEnabled ? 'active' : 'disabled'}" data-action="toggle-prop-expression" data-prop-id="${prop._id}" title="${isEnabled ? 'Toggle Expression: ON (Click to disable)' : 'Toggle Expression: OFF (Click to enable)'}"><span class="ae-expr-icon">${isEnabled ? '=' : '≠'}</span></button>`;
    }

    // Expression Formula Badge in Timeline (= formula)
    function renderPropExprBadge(prop) {
        if (!prop || !prop._expression || !prop._expression.trim()) return '';
        if (!expressionsVisible || !prop.expressionEnabled) return '';
        const safeExpr = escapeAttr(prop._expression);
        const text = escapeHtml(prop._expression);
        return `<span class="ae-expr-badge" title="${safeExpr}" data-action="edit-expression" data-prop-id="${prop._id}"><span class="ae-expr-badge-icon">=</span> ${text}</span>`;
    }

    function openComposition(nameOrComp) {
        let targetComp = null;
        if (typeof CompItem !== 'undefined' && nameOrComp instanceof CompItem) {
            targetComp = nameOrComp;
        } else if (typeof nameOrComp === 'string') {
            targetComp = app?.project?.items?.find(it => it.name === nameOrComp && (typeof CompItem === 'undefined' || it instanceof CompItem));
        }
        if (!targetComp) return;

        app.project.activeItem = targetComp;
        if (global.aeRenderer) {
            global.aeRenderer.comp = targetComp;
            global.aeRenderer.render();
        }
        renderTimeline();
        appendConsole(`Switched active composition focus to: [${targetComp.name}]`);
    }
    window.openComposition = openComposition;

    function renderTimeline() {
        const treeEl = document.getElementById('ae-layers-tree');
        if (!treeEl) return;
        treeEl.innerHTML = '';

        const comp = app.project.activeItem;
        if (!comp) return;

        // Render Composition Navigation Breadcrumbs in Timeline Header
        const breadcrumbsEl = document.getElementById('ae-comp-breadcrumbs');
        if (breadcrumbsEl && app && app.project && app.project.items) {
            const activeComp = app.project.activeItem;
            const allComps = app.project.items.filter(it => (typeof CompItem === 'undefined') || (it instanceof CompItem) || it.layers);
            let bHtml = '';
            if (allComps.length <= 1) {
                bHtml = `<span class="ae-comp-breadcrumb-item active" title="Active Composition: ${escapeHtml(activeComp?.name || 'Main Comp')}">
                    <svg class="ae-comp-icon" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M 5.5 2.5 V 13.5 M 10.5 2.5 V 13.5 M 2 6 H 5.5 M 10.5 6 H 14 M 2 10 H 5.5 M 10.5 10 H 14"/></svg>
                    <span class="ae-comp-name">${escapeHtml(activeComp?.name || 'Main Comp')}</span>
                </span>`;
            } else {
                allComps.forEach(c => {
                    const isActive = (c === activeComp);
                    bHtml += `<button class="ae-comp-breadcrumb-item ${isActive ? 'active' : ''}" data-action="switch-comp" data-comp-name="${escapeHtml(c.name)}" title="${isActive ? 'Active Composition: ' + escapeHtml(c.name) : 'Switch to ' + escapeHtml(c.name)}">
                        <svg class="ae-comp-icon" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M 5.5 2.5 V 13.5 M 10.5 2.5 V 13.5 M 2 6 H 5.5 M 10.5 6 H 14 M 2 10 H 5.5 M 10.5 10 H 14"/></svg>
                        <span class="ae-comp-name">${escapeHtml(c.name)}</span>
                    </button>`;
                });
            }
            breadcrumbsEl.innerHTML = bHtml;
            breadcrumbsEl.querySelectorAll('[data-action="switch-comp"]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    openComposition(btn.dataset.compName);
                };
            });
            const activeBtn = breadcrumbsEl.querySelector('.ae-comp-breadcrumb-item.active');
            if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
                try {
                    activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                } catch (e) {}
            }
        }

        let shiedLayerCount = 0;

        function renderLayerRow(layer, idx, parentComp, depth = 0, parentPrefix = '', isInsidePrecomp = false) {
            const isPrecomp = Boolean(layer.source && (layer.source.layers || (typeof CompItem !== 'undefined' && layer.source instanceof CompItem)));
            const hasUIEffects = Boolean(layer.effects && layer.effects.properties && layer.effects.properties.length > 0);
            const isNotShyable = Boolean(layer.notShyable || isPrecomp || layer.name === 'Cube_Master_Controller' || (layer.name && (layer.name.indexOf('cube_maker') === 0 || layer.name.endsWith('_Controller'))) || hasUIEffects);

            // In Shy Mode: Hide secondary/geometry layers marked shy, but NEVER hide layers with UI properties or precomps
            if (globalShyActive && layer.shy && !isNotShyable) {
                shiedLayerCount++;
                return null;
            }

            const row = document.createElement('div');
            row.className = 'ae-layer-row' + (depth > 0 ? ' is-nested' : '') + (isPrecomp ? ' is-precomp-row' : '');
            row.dataset.layerId = layer._id;
            row.dataset.layerIndex = idx;
            row.dataset.depth = depth;

            const is3D = layer.threeDLayer;
            const parentName = layer.parent ? layer.parent.name : 'None';

            const safeLayerName = escapeHtml(layer.name);
            const safeParentName = escapeHtml(parentName);
            const displayNum = parentPrefix ? `${parentPrefix}.${idx + 1}` : `${idx + 1}`;
            const textIndentPx = depth * 16;
            const paddingLeftPx = 8 + depth * 22;

            let iconHtml = '&#9733;';
            if (isPrecomp) {
                iconHtml = `<svg class="ae-comp-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M 5.5 2.5 V 13.5 M 10.5 2.5 V 13.5 M 2 6 H 5.5 M 10.5 6 H 14 M 2 10 H 5.5 M 10.5 10 H 14"/></svg>`;
            } else if (typeof TextLayer !== 'undefined' && layer instanceof TextLayer) {
                iconHtml = `<span style="font-weight:700; font-family:sans-serif; color:#ff6b81; font-size:11px;">T</span>`;
            } else if (layer.sourceText) {
                iconHtml = `<span style="font-weight:700; font-family:sans-serif; color:#ff6b81; font-size:11px;">T</span>`;
            }

            let badgesHtml = '';
            if (isPrecomp) {
                badgesHtml += `<span class="ae-badge-type static ae-badge-precomp" title="Composition / Precomp layer">[PRECOMP]</span>`;
                badgesHtml += `<span class="ae-badge-comp-dims" title="Dimensions: ${layer.source.width}×${layer.source.height} px">${layer.source.width}×${layer.source.height}</span>`;
                badgesHtml += `<button class="ae-btn-open-comp" data-action="open-comp" data-comp-name="${escapeHtml(layer.source.name)}" title="Open '${escapeHtml(layer.source.name)}' in viewer">Open Comp ↗</button>`;
            } else if (isInsidePrecomp) {
                badgesHtml += `<span class="ae-badge-type static ae-badge-nested" title="Layer inside ${escapeHtml(parentComp.name)}">[NESTED]</span>`;
            }

            row.innerHTML = `
                <div class="ae-layer-main-bar ${layer === selectedLayer ? 'selected' : ''}" style="padding-left: ${paddingLeftPx}px;">
                    <span class="ae-twirl open" data-action="toggle-layer">&#9656;</span>
                    <span class="ae-color-tag" style="background-color: ${layer.colorLabel || (isPrecomp ? '#9b5de5' : '#e07a5f')};"></span>
                    <span class="ae-layer-num" title="Layer index">${displayNum}</span>
                    <span class="ae-layer-icon">${iconHtml}</span>
                    <span class="ae-layer-title ${depth > 0 ? 'is-nested' : ''}" style="text-indent: ${textIndentPx}px;" title="${safeLayerName}">
                        ${depth > 0 ? `<span class="ae-nesting-indicator" title="Nested in ${escapeHtml(parentComp.name)}">↳ </span>` : ''}${safeLayerName}
                    </span>
                    ${badgesHtml}
                    <div class="ae-switches">
                        ${isNotShyable ? `
                        <div class="ae-switch-shy locked" title="UI Controller / Precomp: Always shown">
                            <svg viewBox="0 0 20 20" width="13" height="13" fill="none">
                                <rect x="5" y="8" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.8"/>
                                <path d="M 7.5 8 V 5.5 A 2.5 2.5 0 0 1 12.5 5.5 V 8" stroke="currentColor" stroke-width="1.8"/>
                                <circle cx="10" cy="12.5" r="1" fill="currentColor"/>
                            </svg>
                        </div>
                        ` : `
                        <div class="ae-switch-shy ${layer.shy ? 'active' : ''}" data-action="toggle-layer-shy" title="Shy switch (hide this layer when shy is enabled)">
                            <svg viewBox="0 0 20 20" width="13" height="13" fill="none">
                                <path d="M 4 13.5 C 4 6, 16 6, 16 13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                                <circle cx="7.2" cy="8.8" r="1.1" fill="currentColor"/>
                                <circle cx="12.8" cy="8.8" r="1.1" fill="currentColor"/>
                                <path d="M 8.4 10.5 C 8.4 15.2, 11.6 15.2, 11.6 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="currentColor" fill-opacity="0.2"/>
                                <line x1="2" y1="13.5" x2="18" y2="13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </div>
                        `}
                        <div class="ae-switch-3d ${is3D ? 'active' : ''}" data-action="toggle-3d" title="3D Layer switch (Defined once on creation - [STATIC])">
                            <div class="ae-cube-icon"></div>
                        </div>
                        ${parentName !== 'None' ? `<span class="ae-badge-type static ae-badge-parent" title="Parent: ${safeParentName} (Defined once on creation - [STATIC])"><svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M 4 3.5 V 8.5 A 2 2 0 0 0 6 10.5 H 12 M 9.5 8 L 12 10.5 L 9.5 13"/></svg></span>` : ''}
                    </div>
                </div>

                <div class="ae-layer-details">
                    <!-- Nested Composition Section if Precomp -->
                    ${isPrecomp ? `
                    <div class="ae-prop-group ae-nested-comp-group">
                        <div class="ae-prop-group-header">
                            <span class="ae-twirl open" data-action="toggle-group">&#9656;</span>
                            <span class="ae-prop-group-title">
                                <svg class="ae-comp-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M 5.5 2.5 V 13.5 M 10.5 2.5 V 13.5 M 2 6 H 5.5 M 10.5 6 H 14 M 2 10 H 5.5 M 10.5 10 H 14"/></svg>
                                Composition: <strong>${escapeHtml(layer.source.name)}</strong>
                            </span>
                            <span class="ae-badge-type static" style="margin-left:6px;">[${layer.source.layers ? layer.source.layers.length : 0} LAYERS]</span>
                            <button class="ae-btn-open-comp-inline" data-action="open-comp" data-comp-name="${escapeHtml(layer.source.name)}" title="Switch viewer & timeline to ${escapeHtml(layer.source.name)}">Open in Viewer ↗</button>
                        </div>
                        <div class="ae-prop-items ae-nested-comp-items" style="display: block;"></div>
                    </div>
                    ` : ''}

                    <!-- Effects Group -->
                    ${layer.effects && layer.effects.properties.length > 0 ? `
                    <div class="ae-prop-group">
                        <div class="ae-prop-group-header">
                            <span class="ae-twirl open" data-action="toggle-group">&#9656;</span>
                            <span class="ae-prop-group-title">${isNotShyable ? 'Effects (UI Defined Properties)' : 'Effects'}</span>
                            ${isNotShyable ? `<span class="ae-badge-ui-locked ae-badge-eye" style="margin-left:8px;" title="Always Visible / Cannot Shy: All properties defined in .JSX UI remain visible at all times and cannot be hidden when Shy mode is active"><svg viewBox="0 0 16 12" width="14" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 1 6 C 3.2 2.2, 12.8 2.2, 15 6 C 12.8 9.8, 3.2 9.8, 1 6 Z"/><circle cx="8" cy="6" r="2.1" fill="currentColor"/></svg></span>` : ''}
                        </div>
                        <div class="ae-prop-items" id="layer-effects-${layer._id}" style="display: block;">
                            ${renderEffectsProperties(layer.effects, idx)}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Contents Group -->
                    ${(!globalShyActive || (layer.contents && layer.contents.properties.length > 0)) ? `
                    <div class="ae-prop-group">
                        <div class="ae-prop-group-header">
                            <span class="ae-twirl ${globalShyActive ? '' : 'open'}" data-action="toggle-group">&#9656;</span>
                            <span class="ae-prop-group-title">Contents</span>
                            <span class="ae-badge-type static" style="margin-left:6px;">[STATIC]</span>
                            <span class="ae-prop-group-action" data-action="add-shape-menu">Add: &#9662;</span>
                        </div>
                        <div class="ae-prop-items" id="layer-contents-${layer._id}" style="display: ${globalShyActive ? 'none' : 'block'};">
                            ${renderVectorContents(layer.contents, idx)}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Text Group -->
                    ${(typeof TextLayer !== 'undefined' && layer instanceof TextLayer) ? `
                    <div class="ae-prop-group">
                        <div class="ae-prop-group-header">
                            <span class="ae-twirl open" data-action="toggle-group">&#9656;</span>
                            <span class="ae-prop-group-title">Text</span>
                            <span class="ae-badge-type animatable" style="margin-left:6px;">[TEXT]</span>
                        </div>
                        <div class="ae-prop-items">
                            <div class="ae-prop-row ae-prop-animatable">
                                <span class="ae-badge-type animatable">[ANIM]</span>
                                <span class="ae-prop-name">Source Text</span>
                                <div class="ae-prop-val-container">
                                    <span style="color:#ffd166; font-family:var(--font-mono); font-size:11px;">"${escapeHtml(String(layer.sourceText ? (layer.sourceText.value || '') : ''))}"</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Transform Group -->
                    <div class="ae-prop-group">
                        <div class="ae-prop-group-header">
                            <span class="ae-twirl open" data-action="toggle-group">&#9656;</span>
                            <span class="ae-prop-group-title">Transform</span>
                            <span class="ae-prop-group-action" data-action="reset-transform">Reset</span>
                        </div>
                        <div class="ae-prop-items">
                            ${renderTransformProperties(layer)}
                        </div>
                    </div>
                </div>
            `;

            // If this layer is a Precomp, populate its nested composition container recursively!
            if (isPrecomp && layer.source && layer.source.layers) {
                const nestedItemsEl = row.querySelector('.ae-nested-comp-items');
                if (nestedItemsEl) {
                    layer.source.layers.forEach((childLayer, childIdx) => {
                        const childRow = renderLayerRow(childLayer, childIdx, layer.source, depth + 1, displayNum, true);
                        if (childRow) nestedItemsEl.appendChild(childRow);
                    });
                }
            }

            // Click row to select / toggle selection
            const bar = row.querySelector('.ae-layer-main-bar');
            if (bar) {
                bar.onclick = (e) => {
                    if (e.target.closest('.ae-twirl') || e.target.closest('.ae-switch-3d') || e.target.closest('.ae-switch-shy') || e.target.closest('.ae-btn-open-comp')) return;
                    const wasSelected = (selectedLayer === layer && layer.selected);
                    selectedLayer = wasSelected ? null : layer;
                    if (comp && comp.layers && comp.layers._layers) {
                        comp.layers._layers.forEach(l => {
                            l.selected = (l === selectedLayer);
                        });
                    }
                    document.querySelectorAll('.ae-layer-main-bar').forEach(el => el.classList.remove('selected'));
                    if (selectedLayer) {
                        bar.classList.add('selected');
                    }
                    window.dispatchEvent(new CustomEvent('ae-layer-selection-changed', { detail: { layer: selectedLayer } }));
                };
            }

            // 3D Switch toggle
            const switch3d = row.querySelector('[data-action="toggle-3d"]');
            if (switch3d) {
                switch3d.onclick = (e) => {
                    e.stopPropagation();
                    layer.threeDLayer = !layer.threeDLayer;
                    renderTimeline();
                    if (parentComp && parentComp._notify) parentComp._notify();
                    else if (comp && comp._onChanged) comp._onChanged();
                };
            }

            // Layer Shy switch toggle
            const shyBtn = row.querySelector('[data-action="toggle-layer-shy"]');
            if (shyBtn) {
                shyBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (isNotShyable && depth === 0) {
                        appendConsole(`Layer [${layer.name}] contains UI-defined properties or is a Precomp and cannot be shied.`);
                        return;
                    }
                    layer.shy = !layer.shy;
                    renderTimeline();
                };
            }

            // Open Comp button handlers
            row.querySelectorAll('[data-action="open-comp"]').forEach(openBtn => {
                openBtn.onclick = (e) => {
                    e.stopPropagation();
                    openComposition(openBtn.dataset.compName);
                };
            });

            // Sequential Evaluation Mode Switch Handler
            row.querySelectorAll('[data-action="cycle-prop-mode"], [data-action="set-prop-mode"]').forEach(btn => {
                const handleCycle = (e, reverse = false) => {
                    e.stopPropagation();
                    const currentMode = btn.dataset.mode;
                    const propId = btn.dataset.propId;
                    const prop = (typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
                    if (prop) {
                        const isBool = isBooleanProperty(prop);
                        const isColor = !isBool && isColorProperty(prop);
                        const modesList = isBool ? EVAL_MODES_BOOLEAN : (isColor ? EVAL_MODES_COLOR : EVAL_MODES_STANDARD);
                        const modeKeys = modesList.map(m => m.mode);
                        const curIdx = modeKeys.indexOf(currentMode);
                        const step = reverse ? -1 : 1;
                        const nextIdx = (curIdx >= 0) ? ((curIdx + step + modeKeys.length) % modeKeys.length) : (reverse ? modeKeys.length - 1 : 0);
                        const nextMode = modeKeys[nextIdx];
                        prop.animMode = nextMode;

                        if (nextMode === 'stop') {
                            prop._frozenTime = comp.time;
                            prop._frozenValue = prop.getValueAtTime(comp.time);
                        } else {
                            prop._frozenTime = null;
                            prop._frozenValue = null;
                        }

                        if (isColor && nextMode === 'rand') {
                            prop._randomFixedColor = prop._makeRandomFixedColor ? prop._makeRandomFixedColor() : null;
                        }

                        renderTimeline();
                        if (window.updateDynamicTimelineProperties && comp) {
                            window.updateDynamicTimelineProperties(comp.time);
                        }
                        if (parentComp && parentComp._notify) parentComp._notify();
                        else if (comp && comp._onChanged) comp._onChanged();
                        const nextCfg = modesList[nextIdx];
                        appendConsole(`Property [${prop.name}] evaluation mode set to [${nextCfg.label.toUpperCase()}] (${nextCfg.letter})`);
                    }
                };

                btn.onclick = (e) => handleCycle(e, false);
                btn.oncontextmenu = (e) => {
                    e.preventDefault();
                    handleCycle(e, true);
                };
            });

            // Twirls
            row.querySelectorAll('.ae-twirl').forEach(twirl => {
                twirl.onclick = (e) => {
                    e.stopPropagation();
                    twirl.classList.toggle('open');
                    const container = twirl.closest('.ae-layer-main-bar')
                        ? row.querySelector('.ae-layer-details')
                        : twirl.closest('.ae-prop-group')?.querySelector('.ae-prop-items');
                    if (container) {
                        container.style.display = twirl.classList.contains('open') ? 'block' : 'none';
                    }
                };
            });

            return row;
        }

        comp.layers.forEach((layer, idx) => {
            const row = renderLayerRow(layer, idx, comp, 0, '', false);
            if (row) treeEl.appendChild(row);
        });

        // Show Shy status notice if layers are hidden
        if (shiedLayerCount > 0) {
            const shyBanner = document.createElement('div');
            shyBanner.className = 'ae-shy-notice';
            shyBanner.innerHTML = `<span>&#128065; Shy Mode Active: <strong>${shiedLayerCount} secondary layers</strong> hidden to focus on .JSX UI. <a href="#" id="shy-reveal-link" style="color:var(--ae-blue); font-weight:600; text-decoration:none; margin-left:6px;">Reveal All</a></span>`;
            treeEl.appendChild(shyBanner);
            const revealLink = shyBanner.querySelector('#shy-reveal-link');
            if (revealLink) {
                revealLink.onclick = (e) => {
                    e.preventDefault();
                    globalShyActive = false;
                    const btn = document.getElementById('btn-global-shy');
                    if (btn) btn.classList.remove('active');
                    renderTimeline();
                };
            }
        }

        attachScrubbableEvents();
    }

    function renderTaperGroup(taperGroup, layerIdx) {
        if (!taperGroup) return '';
        const renderTaperRow = (p, label, unit = '%') => {
            if (!p) return '';
            const val = (p.value !== undefined) ? p.value : 0;
            return `
                <div class="ae-prop-row ae-prop-animatable" style="padding-left: 14px;">
                    ${render4WaySwitch(p)}
                    <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                    <span class="ae-prop-stopwatch">&#9201;</span>
                    ${renderPropExprToggle(p)}
                    <span class="ae-prop-name">${escapeHtml(label)}</span>
                    <div class="ae-prop-val-container">
                        <span class="ae-scrub-val" data-prop-id="${p.id}" data-val="${val}" data-unit="${unit}">${val} ${unit}</span>
                        ${renderPropExprBadge(p)}
                    </div>
                </div>
            `;
        };

        return `
            <div class="ae-prop-group" style="padding-left: 8px;">
                <div class="ae-prop-group-header">
                    <span class="ae-twirl" data-action="toggle-group">&#9656;</span>
                    <span class="ae-prop-group-title">Taper</span>
                    <span class="ae-badge-type animatable" style="margin-left:6px;" title="Stroke Taper Controls">[TAPER]</span>
                </div>
                <div class="ae-prop-items" style="display:none;">
                    ${renderTaperRow(taperGroup.startLength, 'Start Length', '%')}
                    ${renderTaperRow(taperGroup.endLength, 'End Length', '%')}
                    ${renderTaperRow(taperGroup.startWidth, 'Start Width', '%')}
                    ${renderTaperRow(taperGroup.endWidth, 'End Width', '%')}
                    ${renderTaperRow(taperGroup.startEase, 'Start Ease', '%')}
                    ${renderTaperRow(taperGroup.endEase, 'End Ease', '%')}
                </div>
            </div>
        `;
    }

    function renderVectorContents(contentsGroup, layerIdx = 0) {
        if (!contentsGroup || !contentsGroup.properties) return '';
        let html = '';

        contentsGroup.properties.forEach(item => {
            if (item instanceof VectorGroup) {
                html += `
                    <div class="ae-prop-group" style="padding-left: 10px;">
                        <div class="ae-prop-group-header">
                            <span class="ae-twirl open" data-action="toggle-group">&#9656;</span>
                            <span class="ae-prop-group-title">${escapeHtml(item.name)}</span>
                            <span class="ae-badge-type static" style="margin-left:6px;" title="Shape Group defined once in setup">[STATIC]</span>
                        </div>
                        <div class="ae-prop-items">
                            ${renderVectorContents(item.property('Contents'), layerIdx)}
                        </div>
                    </div>
                `;
            } else if (item instanceof VectorShapeRect) {
                const size = item.size.value || [100, 100];
                html += `
                    <div class="ae-prop-row ae-prop-animatable">
                        ${render4WaySwitch(item.size)}
                        <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                        <span class="ae-prop-stopwatch">&#9201;</span>
                        ${renderPropExprToggle(item.size)}
                        <span class="ae-prop-name">Rectangle Size</span>
                        <div class="ae-prop-val-container">
                            <span class="ae-scrub-val" data-prop="rect-size-x" data-val="${size[0]}">${size[0]}</span>,
                            <span class="ae-scrub-val" data-prop="rect-size-y" data-val="${size[1]}">${size[1]}</span> px
                            ${renderPropExprBadge(item.size)}
                        </div>
                    </div>
                `;
            } else if (item instanceof VectorShapeEllipse) {
                const size = item.size.value || [100, 100];
                html += `
                    <div class="ae-prop-row ae-prop-animatable">
                        ${render4WaySwitch(item.size)}
                        <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                        <span class="ae-prop-stopwatch">&#9201;</span>
                        ${renderPropExprToggle(item.size)}
                        <span class="ae-prop-name">Ellipse Size</span>
                        <div class="ae-prop-val-container">
                            <span class="ae-scrub-val" data-prop="ellipse-size-x" data-val="${size[0]}">${size[0]}</span>,
                            <span class="ae-scrub-val" data-prop="ellipse-size-y" data-val="${size[1]}">${size[1]}</span> px
                            ${renderPropExprBadge(item.size)}
                        </div>
                    </div>
                `;
            } else if (item instanceof VectorShapePath) {
                html += `
                    <div class="ae-prop-row ae-prop-animatable">
                        ${render4WaySwitch(item.path)}
                        <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                        <span class="ae-prop-stopwatch">&#9201;</span>
                        ${renderPropExprToggle(item.path)}
                        <span class="ae-prop-name">Path</span>
                        <div class="ae-prop-val-container">
                            <span style="color: #888;">Shape Bézier Path</span>
                            ${renderPropExprBadge(item.path)}
                        </div>
                    </div>
                `;
            } else if (item instanceof VectorGraphicFill) {
                const info = formatRgbInfo(item.color.value);
                html += `
                    <div class="ae-prop-row ae-prop-animatable">
                        ${render4WaySwitch(item.color)}
                        <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                        <span class="ae-prop-stopwatch">&#9201;</span>
                        ${renderPropExprToggle(item.color)}
                        <span class="ae-prop-name">Fill Color</span>
                        <div class="ae-prop-val-container">
                            <label class="ae-color-picker-label" title="Click to pick fill color">
                                <input type="color" value="${info.hex}" class="ae-vector-color-input" data-layer-idx="${layerIdx}" data-prop-type="fill-color" />
                                <span class="ae-color-swatch-box" style="background-color: ${info.hex};"></span>
                            </label>
                            <span class="ae-color-rgb-val" title="RGB Code: ${info.rgbStr}">${info.rgbStr}</span>
                            ${renderPropExprBadge(item.color)}
                        </div>
                    </div>
                `;
            } else if (item instanceof VectorGraphicStroke) {
                const colInfo = formatRgbInfo(item.color.value);
                const w = item.strokeWidth.value || 1;
                html += `
                    <div class="ae-prop-row ae-prop-animatable">
                        ${render4WaySwitch(item.color)}
                        <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                        <span class="ae-prop-stopwatch">&#9201;</span>
                        ${renderPropExprToggle(item.color)}
                        <span class="ae-prop-name">Stroke Color</span>
                        <div class="ae-prop-val-container">
                            <label class="ae-color-picker-label" title="Click to pick stroke color">
                                <input type="color" value="${colInfo.hex}" class="ae-vector-color-input" data-layer-idx="${layerIdx}" data-prop-type="stroke-color" />
                                <span class="ae-color-swatch-box" style="background-color: ${colInfo.hex};"></span>
                            </label>
                            <span class="ae-color-rgb-val" title="RGB Code: ${colInfo.rgbStr}">${colInfo.rgbStr}</span>
                            ${renderPropExprBadge(item.color)}
                        </div>
                    </div>
                    <div class="ae-prop-row ae-prop-animatable">
                        ${render4WaySwitch(item.strokeWidth)}
                        <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                        <span class="ae-prop-stopwatch">&#9201;</span>
                        ${renderPropExprToggle(item.strokeWidth)}
                        <span class="ae-prop-name">Stroke Width</span>
                        <div class="ae-prop-val-container">
                            <span class="ae-scrub-val" data-prop-id="${item.strokeWidth.id}" data-val="${w}" data-unit="px">${w} px</span>
                            ${renderPropExprBadge(item.strokeWidth)}
                        </div>
                    </div>
                    ${item.taper ? renderTaperGroup(item.taper, layerIdx) : ''}
                `;
            } else if ((typeof VectorGraphicGradientStroke !== 'undefined' && item instanceof VectorGraphicGradientStroke) || item.matchName === 'ADBE Vector Graphic - G-Stroke') {
                const w = item.strokeWidth.value || 1;
                html += `
                    <div class="ae-prop-row ae-prop-animatable">
                        ${render4WaySwitch(item.strokeWidth)}
                        <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                        <span class="ae-prop-stopwatch">&#9201;</span>
                        ${renderPropExprToggle(item.strokeWidth)}
                        <span class="ae-prop-name">Stroke Width</span>
                        <div class="ae-prop-val-container">
                            <span class="ae-scrub-val" data-prop-id="${item.strokeWidth.id}" data-val="${w}" data-unit="px">${w} px</span>
                            ${renderPropExprBadge(item.strokeWidth)}
                        </div>
                    </div>
                    ${item.taper ? renderTaperGroup(item.taper, layerIdx) : ''}
                `;
            }
        });

        return html;
    }

    function renderEffectsProperties(effectsGroup, layerIdx) {
        if (!effectsGroup || !effectsGroup.properties) return '';
        let html = '';

        effectsGroup.properties.forEach(effect => {
            const isSingleProp = (effect.properties.length === 1);

            const renderPropItem = (prop) => {
                const hasWiggle = Boolean(prop.expression && prop.expressionEnabled);
                const safeTitle = hasWiggle ? escapeAttr(prop.expression) : 'Click to add/edit wiggle';
                const safeExpr = escapeAttr(prop.expression);
                const safePropName = escapeHtml(prop.name);
                const safeEffectName = escapeHtml(effect.name);
                const displayName = isSingleProp ? safeEffectName : `${safeEffectName} (${safePropName})`;

                if (prop.type === 'boolean') {
                    const isChecked = Boolean(prop.value);
                    return `
                        <div class="ae-prop-row ae-prop-animatable">
                            ${render4WaySwitch(prop)}
                            <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                            <span class="ae-badge-ui-locked" title="Defined in .JSX UI panel">UI</span>
                            <span class="ae-prop-stopwatch ${hasWiggle ? 'active' : ''}" title="${safeTitle}" data-action="toggle-wiggle-effect" data-prop-id="${prop._id || prop.id}" data-effect-name="${safeEffectName}" data-prop-name="${safePropName}">&#9201;</span>
                            ${renderPropExprToggle(prop)}
                            <span class="ae-prop-name">${displayName}</span>
                            <div class="ae-prop-val-container">
                                <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                                    <input type="checkbox" ${isChecked ? 'checked' : ''} data-prop-id="${prop._id || prop.id}" data-effect-name="${safeEffectName}" data-prop-name="${safePropName}" class="ae-effect-checkbox" />
                                    <span class="ae-boolean-val-label" style="font-family:monospace; color:${isChecked ? 'var(--ae-blue)' : '#888'}; font-size:11px;">${isChecked ? '1 (true)' : '0 (false)'}</span>
                                </label>
                                ${renderPropExprBadge(prop)}
                            </div>
                        </div>
                    `;
                } else if (prop.type === 'number') {
                    const val = Math.round(prop.value * 10) / 10;
                    const unit = (effect.name.includes('Size') || effect.name.includes('Width') || effect.name.includes('Roundness') || effect.name.includes('Gap')) ? ' px' : '';
                    return `
                        <div class="ae-prop-row ae-prop-animatable">
                            ${render4WaySwitch(prop)}
                            <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                            <span class="ae-badge-ui-locked" title="Defined in .JSX UI panel">UI</span>
                            <span class="ae-prop-stopwatch ${hasWiggle ? 'active' : ''}" title="${safeTitle}" data-action="toggle-wiggle-effect" data-prop-id="${prop._id || prop.id}" data-effect-name="${safeEffectName}" data-prop-name="${safePropName}">&#9201;</span>
                            ${renderPropExprToggle(prop)}
                            <span class="ae-prop-name">${displayName}</span>
                            <div class="ae-prop-val-container">
                                <span class="ae-scrub-val" data-prop-id="${prop._id || prop.id}" data-effect-name="${safeEffectName}" data-prop="${safePropName}">${val}${unit}</span>
                                ${renderPropExprBadge(prop)}
                            </div>
                        </div>
                    `;
                } else if (prop.type === 'color') {
                    const info = formatRgbInfo(prop.value);
                    return `
                        <div class="ae-prop-row ae-prop-animatable">
                            ${render4WaySwitch(prop)}
                            <span class="ae-badge-type animatable" title="Animatable in AE timeline">[ANIM]</span>
                            <span class="ae-badge-ui-locked" title="Defined in .JSX UI panel">UI</span>
                            <span class="ae-prop-stopwatch ${hasWiggle ? 'active' : ''}" title="${safeTitle}" data-action="toggle-wiggle-effect" data-prop-id="${prop._id || prop.id}" data-effect-name="${safeEffectName}" data-prop-name="${safePropName}">&#9201;</span>
                            ${renderPropExprToggle(prop)}
                            <span class="ae-prop-name">${displayName}</span>
                            <div class="ae-prop-val-container">
                                <label class="ae-color-picker-label" title="Click to pick color">
                                    <input type="color" value="${info.hex}" class="ae-effect-color-input" data-prop-id="${prop._id || prop.id}" data-effect-name="${safeEffectName}" data-prop-name="${safePropName}" />
                                    <span class="ae-color-swatch-box" style="background-color: ${info.hex};"></span>
                                </label>
                                <span class="ae-color-rgb-val" title="RGB Code: ${info.rgbStr}">${info.rgbStr}</span>
                                ${renderPropExprBadge(prop)}
                            </div>
                        </div>
                    `;
                }
                return '';
            };

            if (isSingleProp) {
                // Flatten single-property expression controls directly for a sleek, compact timeline
                html += renderPropItem(effect.properties[0]);
            } else {
                html += `
                    <div class="ae-prop-group" style="padding-left: 10px;">
                        <div class="ae-prop-group-header">
                            <span class="ae-twirl open" data-action="toggle-group">&#9656;</span>
                            <span class="ae-prop-group-title">${escapeHtml(effect.name)}</span>
                            <span class="ae-badge-type static" style="margin-left:6px;" title="Effect definition defined once">[STATIC EFF]</span>
                        </div>
                        <div class="ae-prop-items">
                            ${effect.properties.map(p => renderPropItem(p)).join('')}
                        </div>
                    </div>
                `;
            }
        });

        return html;
    }

    function renderTransformProperties(layer) {
        const t = layer.transform;
        const is3D = layer.threeDLayer;

        const anchor = t.anchorPoint.value || [0, 0, 0];
        const pos = t.position.value || [0, 0, 0];
        const sc = t.scale.value || [100, 100, 100];
        const orient = t.orientation.value || [0, 0, 0];
        const xRot = t.xRotation.value || 0;
        const yRot = t.yRotation.value || 0;
        const zRot = t.zRotation.value || 0;
        const op = t.opacity.value !== undefined ? t.opacity.value : 100;

        const makeRow = (prop, label, values, units = '', isArray = true) => {
            const hasWiggle = Boolean(prop.expression && prop.expressionEnabled);
            const isStatic = (label === 'Anchor Point');
            const safeTitle = hasWiggle ? escapeAttr(prop.expression) : 'Click to add/edit wiggle';
            const safeExpr = escapeAttr(prop.expression);
            const safePropName = escapeHtml(prop.name);
            const safeLabel = escapeHtml(label);

            // In Shy Mode: Hide properties not related to the .JSX UI or expressions
            if (globalShyActive && !hasWiggle) {
                if (label === 'Anchor Point' || label === 'Opacity') return '';
                if (label === 'Orientation' && values[0] === 0 && values[1] === 0 && values[2] === 0) return '';
                if ((label === 'X Rotation' || label === 'Y Rotation' || label === 'Z Rotation' || label === 'Rotation') && values === 0) return '';
            }

            const valSpans = isArray
                ? values.map((v, i) => `<span class="ae-scrub-val" data-prop="${safePropName}" data-prop-id="${prop._id || prop.id}" data-layer-id="${layer._id || layer.id}" data-channel="${i}">${Math.round(v * 10) / 10}</span>`).join(', ')
                : `<span class="ae-scrub-val" data-prop="${safePropName}" data-prop-id="${prop._id || prop.id}" data-layer-id="${layer._id || layer.id}" data-channel="0">${Math.round(values * 10) / 10}</span>`;

            return `
                <div class="ae-prop-row ${isStatic ? 'ae-prop-static' : 'ae-prop-animatable'}">
                    ${!isStatic ? render4WaySwitch(prop) : ''}
                    <span class="ae-badge-type ${isStatic ? 'static' : 'animatable'}" title="${isStatic ? 'Defined once on creation' : 'Animatable in AE timeline'}">${isStatic ? '[STATIC]' : '[ANIM]'}</span>
                    <span class="ae-prop-stopwatch ${hasWiggle ? 'active' : ''}" title="${safeTitle}" data-action="toggle-wiggle" data-prop-id="${prop._id || prop.id}" data-layer-id="${layer._id || layer.id}" data-prop-name="${safePropName}">&#9201;</span>
                    ${renderPropExprToggle(prop)}
                    <span class="ae-prop-name">${safeLabel}</span>
                    <div class="ae-prop-val-container">
                        ${valSpans} ${units}
                        ${renderPropExprBadge(prop)}
                    </div>
                </div>
            `;
        };

        let html = '';
        html += makeRow(t.anchorPoint, 'Anchor Point', is3D ? anchor : [anchor[0], anchor[1]]);
        html += makeRow(t.position, 'Position', is3D ? pos : [pos[0], pos[1]]);
        html += makeRow(t.scale, 'Scale', is3D ? sc : [sc[0], sc[1]], '%');

        if (is3D) {
            html += makeRow(t.orientation, 'Orientation', orient, '°');
            html += makeRow(t.xRotation, 'X Rotation', xRot, '°', false);
            html += makeRow(t.yRotation, 'Y Rotation', yRot, '°', false);
            html += makeRow(t.zRotation, 'Z Rotation', zRot, '°', false);
        } else {
            html += makeRow(t.zRotation, 'Rotation', zRot, '°', false);
        }

        html += makeRow(t.opacity, 'Opacity', op, '%', false);

        return html;
    }

    // Live sync cube 3D faces from parent composition effect controls
    function syncCubeFromControls(layer) {
        if (!layer) return;
        const isCube = (layer.name === 'Cube_Master_Controller' || (layer.name && layer.name.startsWith('cube_maker_')) || (layer.effects && layer.effects.property('Size X')));
        if (!isCube) return;

        // Target comp where the 6 faces are located
        let targetComp = (layer.source && layer.source.layers) ? layer.source : null;
        if (!targetComp) {
            if (layer.containingComp) targetComp = layer.containingComp;
            if (!targetComp && app?.project?.items) {
                targetComp = app.project.items.find(it => it.name && it.name.startsWith('cube_maker_')) || null;
            }
        }
        if (!targetComp) return;

        const effX = layer.effects.property('Size X')?.property('Slider')?.value ?? 200;
        const effY = layer.effects.property('Size Y')?.property('Slider')?.value ?? 200;
        const effZ = layer.effects.property('Size Z')?.property('Slider')?.value ?? 200;
        const gap = layer.effects.property('Gap')?.property('Slider')?.value ?? 0;
        const roundness = layer.effects.property('Corner Roundness')?.property('Slider')?.value ?? 0;
        const strokeWidth = layer.effects.property('Stroke Width')?.property('Slider')?.value ?? 3;
        const sidesOp = layer.effects.property('Sides Opacity')?.property('Slider')?.value ?? 85;
        const strokeOp = layer.effects.property('Stroke Opacity')?.property('Slider')?.value ?? 100;
        const linkZ = (layer.effects.property('Link all sizes to Z')?.property('Checkbox')?.value === 1);
        const fillColor = layer.effects.property('Sides Color')?.property('Color')?.value || [0.13, 0.53, 0.93];
        const strokeColor = layer.effects.property('Stroke Color')?.property('Color')?.value || [1, 1, 1];

        const sx = linkZ ? effZ : effX;
        const sy = linkZ ? effZ : effY;
        const sz = effZ;
        const hx = sx / 2, hy = sy / 2, hz = sz / 2;

        // If targetComp has Cube_Master_Controller, sync its effects as well
        const preMaster = targetComp.layers.byName ? targetComp.layers.byName('Cube_Master_Controller') : null;
        if (preMaster && preMaster !== layer) {
            preMaster.effects.property('Size X')?.property('Slider')?.setValue(effX);
            preMaster.effects.property('Size Y')?.property('Slider')?.setValue(effY);
            preMaster.effects.property('Size Z')?.property('Slider')?.setValue(effZ);
            preMaster.effects.property('Link all sizes to Z')?.property('Checkbox')?.setValue(linkZ ? 1 : 0);
            preMaster.effects.property('Sides Color')?.property('Color')?.setValue(fillColor);
            preMaster.effects.property('Sides Opacity')?.property('Slider')?.setValue(sidesOp);
            preMaster.effects.property('Stroke Color')?.property('Color')?.setValue(strokeColor);
            preMaster.effects.property('Stroke Opacity')?.property('Slider')?.setValue(strokeOp);
            preMaster.effects.property('Stroke Width')?.property('Slider')?.setValue(strokeWidth);
            preMaster.effects.property('Corner Roundness')?.property('Slider')?.setValue(roundness);
            preMaster.effects.property('Gap')?.property('Slider')?.setValue(gap);
        }

        const updateFace = (name, pos, w, h) => {
            const f = targetComp.layers.byName ? targetComp.layers.byName(name) : targetComp.layers.find(l => l.name === name);
            if (f) {
                f.transform.position.setValue(pos);
                const grp = f.property('Contents')?.property(1)?.property('Contents');
                if (grp) {
                    const r = grp.property('ADBE Vector Shape - Rect');
                    if (r) {
                        r.property('Size')?.setValue([Math.max(1, w - gap * 2), Math.max(1, h - gap * 2)]);
                        r.property('Roundness')?.setValue(roundness);
                    }
                    const fl = grp.property('ADBE Vector Graphic - Fill');
                    if (fl) {
                        fl.property('Color')?.setValue(fillColor);
                        fl.property('Opacity')?.setValue(sidesOp);
                    }
                    const st = grp.property('ADBE Vector Graphic - Stroke');
                    if (st) {
                        st.property('Color')?.setValue(strokeColor);
                        st.property('Stroke Width')?.setValue(strokeWidth);
                        st.property('Opacity')?.setValue(strokeOp);
                    }
                }
            }
        };

        updateFace('Face_Front',  [0, 0, -hz], sx, sy);
        updateFace('Face_Back',   [0, 0, hz],  sx, sy);
        updateFace('Face_Left',   [-hx, 0, 0], sz, sy);
        updateFace('Face_Right',  [hx, 0, 0],  sz, sy);
        updateFace('Face_Top',    [0, -hy, 0], sx, sz);
        updateFace('Face_Bottom', [0, hy, 0],  sx, sz);

        if (targetComp._onChanged) targetComp._onChanged();
        if (layer.containingComp && layer.containingComp._onChanged) layer.containingComp._onChanged();
    }

    // Live sync cylinder 3D walls and caps from parent composition effect controls
    function syncCylinderFromControls(layer) {
        if (!layer) return;
        const isCylinder = (layer.name === 'Cylinder_Master_Controller' || (layer.name && layer.name.startsWith('cylinder_maker_')) || (layer.effects && layer.effects.property('Radius Distance')));
        if (!isCylinder) return;

        let targetComp = (layer.source && layer.source.layers) ? layer.source : null;
        if (!targetComp) {
            if (layer.containingComp) targetComp = layer.containingComp;
            if (!targetComp && app?.project?.items) {
                targetComp = app.project.items.find(it => it.name && it.name.startsWith('cylinder_maker_')) || null;
            }
        }
        if (!targetComp) return;

        const radius = layer.effects.property('Radius Distance')?.property('Slider')?.value ?? 150;
        const height = layer.effects.property('Extrude Distance')?.property('Slider')?.value ?? 200;
        const segs = Math.max(3, Math.round(layer.effects.property('Rotation Segments')?.property('Slider')?.value ?? 16));
        const enableSlice = (layer.effects.property('Enable Slice')?.property('Checkbox')?.value === 1);
        const startAngle = layer.effects.property('Start Angle')?.property('Slider')?.value ?? 0;
        const endAngle = layer.effects.property('End Angle')?.property('Slider')?.value ?? 360;

        const topColor = layer.effects.property('Top Cap Color')?.property('Color')?.value || [0.2, 0.7, 0.95];
        const wallsColor = layer.effects.property('Walls Color')?.property('Color')?.value || [0.15, 0.55, 0.9];
        const bottomColor = layer.effects.property('Bottom Cap Color')?.property('Color')?.value || [0.1, 0.4, 0.75];

        const opacity = layer.effects.property('Opacity')?.property('Slider')?.value ?? 85;
        const strokeColor = layer.effects.property('Stroke Color')?.property('Color')?.value || [1, 1, 1];
        const strokeWidth = layer.effects.property('Stroke Width')?.property('Slider')?.value ?? 2;

        const halfH = height / 2;
        const dAngleDeg = enableSlice ? (endAngle - startAngle) : 360;
        const segAngleDeg = dAngleDeg / segs;
        const segAngleRad = (segAngleDeg * Math.PI) / 180;
        const wallW = Math.max(1, 2 * radius * Math.sin(segAngleRad / 2));
        const rMid = radius * Math.cos(segAngleRad / 2);

        // Update Cylinder_Master_Controller inside targetComp if present
        const preMaster = targetComp.layers.byName ? targetComp.layers.byName('Cylinder_Master_Controller') : null;
        if (preMaster && preMaster !== layer) {
            preMaster.effects.property('Radius Distance')?.property('Slider')?.setValue(radius);
            preMaster.effects.property('Extrude Distance')?.property('Slider')?.setValue(height);
            preMaster.effects.property('Rotation Segments')?.property('Slider')?.setValue(segs);
            preMaster.effects.property('Enable Slice')?.property('Checkbox')?.setValue(enableSlice ? 1 : 0);
            preMaster.effects.property('Start Angle')?.property('Slider')?.setValue(startAngle);
            preMaster.effects.property('End Angle')?.property('Slider')?.setValue(endAngle);
            preMaster.effects.property('Top Cap Color')?.property('Color')?.setValue(topColor);
            preMaster.effects.property('Walls Color')?.property('Color')?.setValue(wallsColor);
            preMaster.effects.property('Bottom Cap Color')?.property('Color')?.setValue(bottomColor);
            preMaster.effects.property('Opacity')?.property('Slider')?.setValue(opacity);
            preMaster.effects.property('Stroke Color')?.property('Color')?.setValue(strokeColor);
            preMaster.effects.property('Stroke Width')?.property('Slider')?.setValue(strokeWidth);
        }

        // Update Wall Segments
        for (let i = 0; i < segs; i++) {
            const wallName = 'Wall_' + (i + 1);
            const wall = targetComp.layers.byName ? targetComp.layers.byName(wallName) : targetComp.layers.find(l => l.name === wallName);
            if (wall) {
                const curDeg = (enableSlice ? startAngle : 0) + (i + 0.5) * segAngleDeg;
                const curRad = (curDeg * Math.PI) / 180;
                const pos = [rMid * Math.sin(curRad), 0, -rMid * Math.cos(curRad)];
                wall.transform.position.setValue(pos);
                wall.transform.orientation.setValue([0, -curDeg, 0]);
                if (wall.transform.yRotation) wall.transform.yRotation.setValue(-curDeg);

                const grp = wall.property('Contents')?.property(1)?.property('Contents');
                if (grp) {
                    const r = grp.property('ADBE Vector Shape - Rect');
                    if (r) r.property('Size')?.setValue([wallW, height]);
                    const fl = grp.property('ADBE Vector Graphic - Fill');
                    if (fl) {
                        fl.property('Color')?.setValue(wallsColor);
                        fl.property('Opacity')?.setValue(opacity);
                    }
                    const st = grp.property('ADBE Vector Graphic - Stroke');
                    if (st) {
                        st.property('Color')?.setValue(strokeColor);
                        st.property('Stroke Width')?.setValue(strokeWidth);
                        st.property('Opacity')?.setValue(opacity);
                    }
                }
            }
        }

        // Update Radial Slice Walls
        const sliceStart = targetComp.layers.byName ? targetComp.layers.byName('Slice_Start') : targetComp.layers.find(l => l.name === 'Slice_Start');
        const sliceEnd = targetComp.layers.byName ? targetComp.layers.byName('Slice_End') : targetComp.layers.find(l => l.name === 'Slice_End');

        if (sliceStart) {
            sliceStart.enabled = enableSlice;
            if (enableSlice) {
                const sRad = (startAngle * Math.PI) / 180;
                sliceStart.transform.position.setValue([(radius / 2) * Math.sin(sRad), 0, -(radius / 2) * Math.cos(sRad)]);
                sliceStart.transform.orientation.setValue([0, 90 - startAngle, 0]);
                if (sliceStart.transform.yRotation) sliceStart.transform.yRotation.setValue(90 - startAngle);
                const grp = sliceStart.property('Contents')?.property(1)?.property('Contents');
                if (grp) {
                    grp.property('ADBE Vector Shape - Rect')?.property('Size')?.setValue([radius, height]);
                    grp.property('ADBE Vector Graphic - Fill')?.property('Color')?.setValue(wallsColor);
                    grp.property('ADBE Vector Graphic - Fill')?.property('Opacity')?.setValue(opacity);
                }
            }
        }

        if (sliceEnd) {
            sliceEnd.enabled = enableSlice;
            if (enableSlice) {
                const eRad = (endAngle * Math.PI) / 180;
                sliceEnd.transform.position.setValue([(radius / 2) * Math.sin(eRad), 0, -(radius / 2) * Math.cos(eRad)]);
                sliceEnd.transform.orientation.setValue([0, 90 - endAngle, 0]);
                if (sliceEnd.transform.yRotation) sliceEnd.transform.yRotation.setValue(90 - endAngle);
                const grp = sliceEnd.property('Contents')?.property(1)?.property('Contents');
                if (grp) {
                    grp.property('ADBE Vector Shape - Rect')?.property('Size')?.setValue([radius, height]);
                    grp.property('ADBE Vector Graphic - Fill')?.property('Color')?.setValue(wallsColor);
                    grp.property('ADBE Vector Graphic - Fill')?.property('Opacity')?.setValue(opacity);
                }
            }
        }

        // Update Top & Bottom Caps
        const updateCap = (name, yPos, color) => {
            const cap = targetComp.layers.byName ? targetComp.layers.byName(name) : targetComp.layers.find(l => l.name === name);
            if (cap) {
                cap.transform.position.setValue([0, yPos, 0]);
                const grp = cap.property('Contents')?.property(1)?.property('Contents');
                if (grp) {
                    const fl = grp.property('ADBE Vector Graphic - Fill');
                    if (fl) {
                        fl.property('Color')?.setValue(color);
                        fl.property('Opacity')?.setValue(opacity);
                    }
                    const st = grp.property('ADBE Vector Graphic - Stroke');
                    if (st) {
                        st.property('Color')?.setValue(strokeColor);
                        st.property('Stroke Width')?.setValue(strokeWidth);
                        st.property('Opacity')?.setValue(opacity);
                    }
                    const pathProp = grp.property('ADBE Vector Shape - Group')?.property('ADBE Vector Shape') || grp.property('ADBE Vector Shape - Path')?.property('Path');
                    if (pathProp && pathProp.expression) {
                        const newShape = pathProp.evaluateExpression();
                        if (newShape) pathProp.setValue(newShape);
                    }
                }
            }
        };

        updateCap('Cap_Top', -halfH, topColor);
        updateCap('Cap_Bottom', halfH, bottomColor);

        if (targetComp._onChanged) targetComp._onChanged();
        if (layer.containingComp && layer.containingComp._onChanged) layer.containingComp._onChanged();
    }

    // Number Scrubbing & Wiggle Dialog
    function attachScrubbableEvents() {
        document.querySelectorAll('.ae-scrub-val').forEach(el => {
            let startX = 0;
            let startVal = 0;
            let activeProp = null;
            let channel = 0;

            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startVal = parseFloat(el.textContent) || 0;
                channel = parseInt(el.dataset.channel || 0);

                const propId = el.dataset.propId;
                let layer = null;
                let effectName = null;
                if (propId && typeof Property !== 'undefined' && Property.getById) {
                    activeProp = Property.getById(propId);
                } else {
                    const row = el.closest('.ae-layer-row');
                    const layerIdx = parseInt(row?.dataset.layerIndex);
                    layer = app.project.activeItem.layers[layerIdx];
                    effectName = el.dataset.effectName;
                    const propName = el.dataset.prop;
                    if (layer && effectName && propName) {
                        activeProp = layer.effects.property(effectName)?.property(propName);
                    } else if (layer && propName) {
                        activeProp = layer.transform.property(propName);
                    }
                }

                const onMove = (moveEvent) => {
                    const dx = moveEvent.clientX - startX;
                    const step = moveEvent.shiftKey ? 10 : (moveEvent.altKey ? 0.1 : 1);
                    const newVal = Math.round((startVal + dx * step) * 10) / 10;
                    const unit = el.dataset.unit || (el.textContent.includes('px') ? 'px' : (el.textContent.includes('%') ? '%' : ''));
                    el.textContent = unit ? `${newVal} ${unit}` : newVal;

                    if (activeProp) {
                        let cur = activeProp.value;
                        if (Array.isArray(cur)) {
                            cur = cur.slice();
                            cur[channel] = newVal;
                            activeProp.setValue(cur);
                        } else {
                            activeProp.setValue(newVal);
                        }

                        // Trigger active composition rerender
                        const comp = app?.project?.activeItem;
                        if (comp && comp._onChanged) comp._onChanged();

                        // Live-sync to cube & cylinder in precomp / targetComp
                        if (layer && effectName) {
                            syncCubeFromControls(layer);
                            syncCylinderFromControls(layer);
                            if (typeof window.__syncEmojiLayerFromEffect === 'function') {
                                window.__syncEmojiLayerFromEffect(layer, effectName);
                            }
                        }
                    }
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    renderTimeline();
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        });

        // Wiggle expression toggle / prompt for Transform
        document.querySelectorAll('[data-action="toggle-wiggle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = btn.closest('.ae-layer-row');
                const propId = btn.dataset.propId;
                let prop = (propId && typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
                const layerId = row?.dataset.layerId;
                const layer = (layerId && typeof Layer !== 'undefined' && Layer.getById) ? Layer.getById(layerId) : app.project.activeItem.layers[parseInt(row?.dataset.layerIndex)];
                const propName = btn.dataset.propName;
                if (!prop && layer) prop = layer.transform?.property(propName);
                if (!prop) return;

                const currentExpr = prop.expression || 'wiggle(0.5, 30)';
                const newExpr = prompt(`Edit Expression / Wiggle for ${layer?.name || 'Layer'} -> ${propName}:\n(e.g. wiggle(freq, amp) or leave empty to remove)`, currentExpr);
                if (newExpr !== null) {
                    prop.expression = newExpr.trim();
                    prop.expressionEnabled = Boolean(prop.expression);
                    renderTimeline();
                    appendConsole(`Set expression on ${layer?.name || 'Layer'}.${propName} = "${prop.expression}"`);
                }
            });
        });

        // Wiggle expression toggle / prompt for Effects (e.g. Checkbox)
        document.querySelectorAll('[data-action="toggle-wiggle-effect"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const row = btn.closest('.ae-layer-row');
                const propId = btn.dataset.propId;
                let prop = (propId && typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
                const layerId = row?.dataset.layerId;
                const layer = (layerId && typeof Layer !== 'undefined' && Layer.getById) ? Layer.getById(layerId) : app.project.activeItem.layers[parseInt(row?.dataset.layerIndex)];
                const effName = btn.dataset.effectName;
                const propName = btn.dataset.propName;
                if (!prop && layer) prop = layer.effects?.property(effName)?.property(propName);
                if (!prop) return;

                const currentExpr = prop.expression || 'wiggle(1, 1) > 0 ? 1 : 0';
                const newExpr = prompt(`Edit Expression / Wiggle for Effect [${effName}] -> ${propName}:\n(e.g. wiggle(1, 1) > 0 ? 1 : 0)`, currentExpr);
                if (newExpr !== null) {
                    prop.expression = newExpr.trim();
                    prop.expressionEnabled = Boolean(prop.expression);
                    renderTimeline();
                    appendConsole(`Set expression on Effect [${effName}].${propName} = "${prop.expression}"`);
                }
            });
        });

        // Dedicated Per-Property Toggle Expression Switch (= / ≠)
        document.querySelectorAll('[data-action="toggle-prop-expression"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const propId = btn.dataset.propId;
                const prop = (typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
                if (!prop) return;
                prop.expressionEnabled = !prop.expressionEnabled;
                if (prop.expressionEnabled) {
                    if (!prop.animMode || prop.animMode === 'base') {
                        if (prop.type === 'boolean' || isBooleanProperty(prop)) {
                            prop.animMode = 'default';
                        } else {
                            prop.animMode = (prop.type === 'color' || isColorProperty(prop)) ? 'orig' : 'wiggle';
                        }
                    }
                }
                prop.clearCache();
                renderTimeline();
                appendConsole(`Toggled expression on ${prop.name || 'property'}: ${prop.expressionEnabled ? 'ON' : 'OFF'}`);
            });
        });

        // Expression Formula Badge Edit Click
        document.querySelectorAll('[data-action="edit-expression"]').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                const propId = badge.dataset.propId;
                const prop = (typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
                if (!prop) return;
                const currentExpr = prop.expression || '';
                const newExpr = prompt(`Edit Expression for ${prop.name || 'property'}:\n(Leave empty to remove)`, currentExpr);
                if (newExpr !== null) {
                    prop.expression = newExpr.trim();
                    prop.expressionEnabled = Boolean(prop.expression);
                    prop.clearCache();
                    renderTimeline();
                    appendConsole(`Updated expression on ${prop.name || 'property'} = "${prop.expression}"`);
                }
            });
        });

        // Effect Checkbox Toggle (e.g. Link all sizes to Z)
        document.querySelectorAll('.ae-effect-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const row = chk.closest('.ae-layer-row');
                const propId = chk.dataset.propId;
                let prop = (propId && typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
                const layerId = row?.dataset.layerId;
                const layer = (layerId && typeof Layer !== 'undefined' && Layer.getById) ? Layer.getById(layerId) : app.project.activeItem.layers[parseInt(row?.dataset.layerIndex)];
                const effName = chk.dataset.effectName;
                const propName = chk.dataset.propName;
                if (!prop && layer) prop = layer.effects?.property(effName)?.property(propName);
                if (prop) {
                    prop.setValue(chk.checked ? 1 : 0);
                    prop.animMode = 'default';
                    syncCubeFromControls(layer);
                    syncCylinderFromControls(layer);
                    if (typeof window.__syncEmojiLayerFromEffect === 'function') {
                        window.__syncEmojiLayerFromEffect(layer, effName);
                    }
                    renderTimeline();
                    appendConsole(`Toggled [${effName}] = ${chk.checked ? 1 : 0}`);
                }
            });
        });

        // Effect Color Picker Input (e.g. Sides Color, Stroke Color)
        document.querySelectorAll('.ae-effect-color-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const row = input.closest('.ae-layer-row');
                const propId = input.dataset.propId;
                let prop = (propId && typeof Property !== 'undefined' && Property.getById) ? Property.getById(propId) : null;
                const layerId = row?.dataset.layerId;
                const layer = (layerId && typeof Layer !== 'undefined' && Layer.getById) ? Layer.getById(layerId) : app.project.activeItem.layers[parseInt(row?.dataset.layerIndex)];
                const effName = input.dataset.effectName;
                const propName = input.dataset.propName;
                if (!prop && layer) prop = layer.effects?.property(effName)?.property(propName);
                if (prop) {
                    const hex = input.value;
                    const r = parseInt(hex.slice(1, 3), 16) / 255;
                    const g = parseInt(hex.slice(3, 5), 16) / 255;
                    const b = parseInt(hex.slice(5, 7), 16) / 255;
                    prop.setValue([r, g, b]);

                    // Propagate to cube face / cylinder layers
                    syncCubeFromControls(layer);
                    syncCylinderFromControls(layer);

                    renderTimeline();
                    appendConsole(`Color updated [${effName}] = rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`);
                }
            });
        });

        // Vector Shape Color Picker Input (Face Fill / Stroke Color)
        document.querySelectorAll('.ae-vector-color-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const row = input.closest('.ae-layer-row');
                const layerId = row?.dataset.layerId;
                const layer = (layerId && typeof Layer !== 'undefined' && Layer.getById) ? Layer.getById(layerId) : app.project.activeItem.layers[parseInt(row?.dataset.layerIndex)];
                const propType = input.dataset.propType;
                if (!layer) return;

                const hex = input.value;
                const r = parseInt(hex.slice(1, 3), 16) / 255;
                const g = parseInt(hex.slice(3, 5), 16) / 255;
                const b = parseInt(hex.slice(5, 7), 16) / 255;

                const grp = layer.property('Contents')?.property(1)?.property('Contents');
                if (propType === 'fill-color') {
                    const fl = grp?.property('ADBE Vector Graphic - Fill');
                    if (fl) fl.property('Color').setValue([r, g, b]);
                } else if (propType === 'stroke-color') {
                    const st = grp?.property('ADBE Vector Graphic - Stroke');
                    if (st) st.property('Color').setValue([r, g, b]);
                }

                renderTimeline();
            });
        });
    }

    function rgbToHex(rgb) {
        if (!rgb) return '#ffffff';
        const r = Math.round((rgb[0] || 0) * 255).toString(16).padStart(2, '0');
        const g = Math.round((rgb[1] || 0) * 255).toString(16).padStart(2, '0');
        const b = Math.round((rgb[2] || 0) * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    // -------------------------------------------------------------
    // Composition Clear Helper (Runs on new script or build)
    // -------------------------------------------------------------
    function clearCompLayers() {
        if (typeof app !== 'undefined' && app.project) {
            const mainComp = app.project.items.find(it => it.name === 'Main Comp') || app.project.items[0];
            if (mainComp) {
                app.project.activeItem = mainComp;
                if (global.aeRenderer) {
                    global.aeRenderer.comp = mainComp;
                }
            }
            const comp = app.project.activeItem;
            if (comp && comp.layers) {
                while (comp.layers.length > 0) {
                    comp.layers.remove(comp.layers[0]);
                }
                if (comp._onChanged) comp._onChanged();
            }
        }
        if (typeof renderTimeline === 'function') renderTimeline();
    }
    window.clearCompLayers = clearCompLayers;

    // -------------------------------------------------------------
    // JSX Script Runner Engine & Auto-build
    // -------------------------------------------------------------
    function isAutoBuildRequested() {
        try {
            const chk = document.getElementById('chk-autobuild');
            if (chk && chk.dataset.initialized === 'true') {
                return chk.checked;
            }
            const url = new URL(window.location.href);
            if (url.searchParams.has('autobuild')) {
                const v = (url.searchParams.get('autobuild') || '').toLowerCase();
                return v === '' || v === 'true' || v === '1' || v === 'yes';
            }
            if (url.hash) {
                const hash = url.hash.replace(/^#\/?/, '').trim();
                const hp = new URLSearchParams(hash);
                if (hp.has('autobuild')) {
                    const hv = (hp.get('autobuild') || '').toLowerCase();
                    return hv === '' || hv === 'true' || hv === '1' || hv === 'yes';
                }
                if (hash.includes('autobuild=true') || hash.includes('autobuild=1')) return true;
            }
            if (chk) return chk.checked;
            return false;
        } catch (e) {
            return false;
        }
    }

    function setAutoBuildInURL(active) {
        try {
            const url = new URL(window.location.href);
            if (active) {
                url.searchParams.set('autobuild', 'true');
            } else {
                url.searchParams.delete('autobuild');
            }
            if (url.hash) {
                const hash = url.hash.replace(/^#\/?/, '').trim();
                const hp = new URLSearchParams(hash);
                hp.delete('autobuild');
                if (active) hp.set('autobuild', 'true');
                const cleanHash = hp.toString();
                url.hash = cleanHash ? `#${cleanHash}` : '';
            }
            const cleanUrl = url.origin + url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
            window.history.replaceState({ autobuild: active }, '', cleanUrl);
        } catch (e) {
            try {
                if (active) {
                    window.location.hash = (window.location.hash ? window.location.hash + '&' : '') + 'autobuild=true';
                }
            } catch (err) {}
        }
    }

    function findMainBuildButton() {
        const dock = document.getElementById('scriptui-dock-host') || document.body;
        const buttons = Array.from(dock.querySelectorAll('button.scriptui-button, button'));
        if (buttons.length === 0) return null;

        // 1. Look for button with text containing "build"
        const buildBtn = buttons.slice().reverse().find(b => (b.textContent || '').toLowerCase().includes('build'));
        if (buildBtn) return buildBtn;

        // 2. Look for button with text containing "create", "generate", "add emoji", or "replace emoji"
        const createBtn = buttons.slice().reverse().find(b => {
            const txt = (b.textContent || '').toLowerCase();
            return txt.includes('create') || txt.includes('generate') || txt.includes('add emoji') || txt.includes('replace emoji');
        });
        if (createBtn) return createBtn;

        // 3. Fallback to the last button in the dock host that isn't a helper button
        for (let i = buttons.length - 1; i >= 0; i--) {
            const txt = (buttons[i].textContent || '').trim().toLowerCase();
            if (txt && !['help', 'info', 'presets...', 'cancel', 'reset', 'browse', 'open', 'save'].includes(txt)) {
                return buttons[i];
            }
        }
        return buttons[buttons.length - 1];
    }

    function triggerAutoBuild(retryCount = 0) {
        if (!isAutoBuildRequested()) return;
        setTimeout(() => {
            const btn = findMainBuildButton();
            if (btn) {
                appendConsole(`[Autobuild] Automatically triggering build: "${btn.textContent.trim()}"`);
                btn.click();
                renderTimeline();
            } else if (retryCount < 4) {
                triggerAutoBuild(retryCount + 1);
            } else {
                appendConsole('[Autobuild] Notice: No build button found in panel to trigger automatically.', false);
            }
        }, retryCount === 0 ? 120 : 150);
    }

    function runUserScript(code, sourceUrl) {
        try {
            clearCompLayers();
            appendConsole('Cleared composition. Executing JSX script...');

            // Configure execution context for temporary vs trusted files
            if (window.AEExecutionContext) {
                const activeSource = sourceUrl || window.__currentScriptSource || null;
                window.AEExecutionContext.setContext(activeSource);
                if (window.AEExecutionContext.isTemporary) {
                    appendConsole(`🛡️ [Sandbox Active] Running JSX from external repository: ${activeSource || 'external'}`, false);
                    appendConsole(`📁 Working Directory redirected to temporary folder: ${window.AEExecutionContext.tempDir}`, false);
                    appendConsole(`⏱️ All files created by this script are temporary and will be deleted after 30 minutes.`, false);
                }
            }

            // Sandbox execution with After Effects globals
            const scriptFunc = new Function(
                'app', '$', 'CompItem', 'Shape', 'Layer', 'AVLayer', 'ShapeLayer', 'TextLayer', 'Window', 'Panel', 'Group', 'TabbedPanel', 'Tab', 'Mat4', 'File', 'Folder',
                `"use strict";\n${code}`
            );
            scriptFunc.call(
                window,
                app, $, CompItem, Shape,
                (window.Layer || (typeof Layer !== 'undefined' ? Layer : null)),
                (window.AVLayer || window.Layer || (typeof AVLayer !== 'undefined' ? AVLayer : null)),
                (window.ShapeLayer || (typeof ShapeLayer !== 'undefined' ? ShapeLayer : null)),
                (window.TextLayer || (typeof TextLayer !== 'undefined' ? TextLayer : null)),
                Window, Panel, Group, TabbedPanel, Tab, Mat4,
                (window.AEFile || window.File),
                (window.AEFolder || window.Folder)
            );
            appendConsole('Script executed successfully!');
            renderTimeline();
            triggerAutoBuild();
        } catch (err) {
            console.error(err);
            appendConsole(`Script Error: ${err.message}`, true);
        }
    }

    // -------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------
    function initApp() {
        if (window.__aeAppInitialized) return;
        window.__aeAppInitialized = true;
        // Update version badge
        const versionBadge = document.getElementById('ae-version-badge');
        if (versionBadge) {
            versionBadge.textContent = 'v' + APP_VERSION;
            versionBadge.title = `Daily Incremental Version: v${APP_VERSION} (Started at v1.0.0 on 2026-11-05)`;
        }

        // Initialize Auto Build Switch from URL parameters
        const chkAutobuild = document.getElementById('chk-autobuild');
        const toggleAutobuild = document.getElementById('ae-autobuild-toggle');
        if (chkAutobuild) {
            const urlAutoBuildActive = isAutoBuildRequested();
            chkAutobuild.checked = urlAutoBuildActive;
            chkAutobuild.dataset.initialized = 'true';
            if (toggleAutobuild) {
                toggleAutobuild.classList.toggle('active', urlAutoBuildActive);
            }

            chkAutobuild.onchange = () => {
                const active = chkAutobuild.checked;
                if (toggleAutobuild) {
                    toggleAutobuild.classList.toggle('active', active);
                }
                setAutoBuildInURL(active);
                appendConsole(active ? 'Auto Build ON: Scripts will build layers automatically (&autobuild=true).' : 'Auto Build OFF.');
                if (active) {
                    triggerAutoBuild();
                }
            };
        }

        const comp = app.project.activeItem;
        if (comp) {
            comp._onChanged = () => {
                renderTimeline();
            };
        }

        // Init 3D Viewport Renderer
        renderer = new AERenderer(comp, 'ae-viewport-panel');
        global.aeRenderer = renderer;

        // Setup preset selector with .jsx files detected in jsx/ subfolder
        const presetSelect = document.getElementById('ae-preset-select');
        const codeTextarea = document.getElementById('ae-code-editor');
        const currentFilenameEl = document.getElementById('current-filename');
        const jsxFiles = new Map();
        const sampleFiles = new Map();

        // -------------------------------------------------------------
        // URL Parameter Routing (Direct Deep Linking for .JSX files)
        // -------------------------------------------------------------
        function isExternalURL(str) {
            if (!str || typeof str !== 'string') return false;
            const s = str.trim();
            return /^https?:\/\//i.test(s) || /^\/\//.test(s) || /^(raw\.githubusercontent\.com|github\.com|gist\.githubusercontent\.com|gist\.github\.com)\//i.test(s) || /:\/\//.test(s);
        }

        function convertToDirectRawURL(urlStr) {
            if (!urlStr || typeof urlStr !== 'string') return urlStr;
            let cleanUrl = urlStr.trim();
            if (!cleanUrl) return cleanUrl;

            // Ensure protocol
            if (!/^https?:\/\//i.test(cleanUrl) && !cleanUrl.startsWith('//')) {
                cleanUrl = 'https://' + cleanUrl;
            }

            // Known repository shorthand / fallback map for work2survive repositories
            const KNOWN_GITHUB_REPOS = {
                'ae-cube-maker-3d': 'https://raw.githubusercontent.com/work2survive/AE-Cube-Maker-3D/main/cube_maker.jsx',
                'ae-cylinder-maker-3d': 'https://raw.githubusercontent.com/work2survive/AE-Cylinder-Maker-3D/main/cylinder_maker.jsx',
                'ae-pie-slice-tool': 'https://raw.githubusercontent.com/work2survive/AE-Pie-Slice-Tool/main/Pie_Slice_Generator.jsx',
                'ae_custom_rounded_rect': 'https://raw.githubusercontent.com/work2survive/AE_Custom_Rounded_Rect/main/custom_rounded_rect.jsx',
                'aecustomroundedrect': 'https://raw.githubusercontent.com/work2survive/AE_Custom_Rounded_Rect/main/custom_rounded_rect.jsx',
                'ae_extruded_round_corners': 'https://raw.githubusercontent.com/work2survive/AE_Extruded_Round_corners/main/extruded_round_rectangle.jsx',
                'extruded_round_corners_corners': 'https://raw.githubusercontent.com/work2survive/AE_Extruded_Round_corners/main/extruded_round_rectangle.jsx',
                'ae_message_bubble': 'https://raw.githubusercontent.com/work2survive/AE_message_bubble/main/Message_Bubble_Generator.jsx',
                'ae_windbox': 'https://raw.githubusercontent.com/work2survive/AE_windBox/main/AE_WindBox_Panel.jsx',
                'ae_spiral_maker': 'https://raw.githubusercontent.com/work2survive/AE_spiral_maker/main/AE_Spiral_Maker.jsx'
            };

            // If a whole repository root was provided e.g. https://github.com/work2survive/AE-Cube-Maker-3D
            const repoOnlyMatch = cleanUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?$/i);
            if (repoOnlyMatch) {
                const repoKey = repoOnlyMatch[2].toLowerCase();
                if (KNOWN_GITHUB_REPOS[repoKey]) {
                    return KNOWN_GITHUB_REPOS[repoKey];
                }
            }

            // Auto-convert standard GitHub blob and raw URLs:
            // https://github.com/user/repo/blob/branch/path.jsx -> https://raw.githubusercontent.com/user/repo/branch/path.jsx
            // https://github.com/user/repo/raw/branch/path.jsx -> https://raw.githubusercontent.com/user/repo/branch/path.jsx
            const ghBlobMatch = cleanUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/i);
            if (ghBlobMatch) {
                return `https://raw.githubusercontent.com/${ghBlobMatch[1]}/${ghBlobMatch[2]}/${ghBlobMatch[3]}`;
            }

            // GitHub Gist:
            const gistMatch = cleanUrl.match(/^https?:\/\/gist\.github\.com\/([^/]+)\/([a-f0-9]+)(?:\/raw)?(?:\/.+)?$/i);
            if (gistMatch) {
                return `https://gist.githubusercontent.com/${gistMatch[1]}/${gistMatch[2]}/raw`;
            }

            return cleanUrl;
        }

        function normalizeJSXToken(str) {
            if (!str) return '';
            return str.toLowerCase()
                .replace(/\.jsx$/i, '')
                .replace(/rounded/g, 'round')
                .replace(/rectangles?/g, 'rect')
                .replace(/generators?/g, 'gen')
                .replace(/makers?/g, 'maker')
                .replace(/[\s\-_]/g, '');
        }

        function updateURLForJSX(filename, isPush) {
            if (!filename) return;
            try {
                const url = new URL(window.location.href);
                const autoActive = isAutoBuildRequested();
                // Clean any legacy/bare params before setting canonical jsx parameter
                for (const key of Array.from(url.searchParams.keys())) {
                    if (key !== 'jsx' && key !== 'autobuild') url.searchParams.delete(key);
                }
                url.searchParams.set('jsx', filename);
                if (autoActive) {
                    url.searchParams.set('autobuild', 'true');
                } else {
                    url.searchParams.delete('autobuild');
                }
                if (url.hash && url.hash.includes('jsx=')) {
                    url.hash = '';
                }
                if (isPush) {
                    window.history.pushState({ jsx: filename, autobuild: autoActive }, '', url.toString());
                } else {
                    window.history.replaceState({ jsx: filename, autobuild: autoActive }, '', url.toString());
                }
            } catch (e) {
                try {
                    const autoActive = isAutoBuildRequested();
                    window.location.hash = `jsx=${encodeURIComponent(filename)}` + (autoActive ? '&autobuild=true' : '');
                } catch (err) {}
            }
        }

        function removeJSXFromURL() {
            try {
                const url = new URL(window.location.href);
                url.searchParams.delete('jsx');
                url.searchParams.delete('sample');
                url.searchParams.delete('file');
                url.searchParams.delete('preset');
                url.searchParams.delete('script');
                if (isAutoBuildRequested()) {
                    url.searchParams.set('autobuild', 'true');
                } else {
                    url.searchParams.delete('autobuild');
                }
                url.hash = '';
                const cleanUrl = url.origin + url.pathname + (url.search ? url.search : '');
                window.history.replaceState({}, '', cleanUrl);
            } catch (e) {
                try {
                    window.location.hash = '';
                } catch (err) {}
            }
        }

        function getRequestedJSXFromURL() {
            try {
                const url = new URL(window.location.href);
                const urlParams = url.searchParams;
                let target = urlParams.get('jsx') || urlParams.get('url') || urlParams.get('sample') || urlParams.get('file') || urlParams.get('preset') || urlParams.get('script');
                
                // If not found in named parameters, check bare query param (e.g., ?https://... or ?cylinder_maker.jsx or ?cylinder)
                if (!target && url.search) {
                    const rawSearch = url.search.replace(/^\?/, '').trim();
                    if (rawSearch) {
                        if (/^https?:\/\//i.test(rawSearch) || rawSearch.startsWith('//') || /^(raw\.githubusercontent\.com|github\.com)\//i.test(rawSearch)) {
                            const autoIdx = rawSearch.indexOf('&autobuild');
                            target = autoIdx !== -1 ? rawSearch.slice(0, autoIdx) : rawSearch;
                        } else {
                            const firstKey = rawSearch.split('&')[0].split('=')[0];
                            if (firstKey && !['fbclid', 'utm_source'].includes(firstKey.toLowerCase())) {
                                target = firstKey;
                            }
                        }
                    }
                }

                // Also check hash (e.g., #jsx=https://... or #jsx=... or #cylinder_maker.jsx)
                if (!target && url.hash) {
                    const hash = url.hash.replace(/^#\/?/, '').trim();
                    if (hash) {
                        if (/^https?:\/\//i.test(hash) || hash.startsWith('//') || /^(raw\.githubusercontent\.com|github\.com)\//i.test(hash)) {
                            target = hash.split('&')[0];
                        } else {
                            const hashParams = new URLSearchParams(hash);
                            target = hashParams.get('jsx') || hashParams.get('url') || hashParams.get('file') || hashParams.get('preset') || hash.split('&')[0].split('=')[0];
                        }
                    }
                }

                if (target) {
                    target = decodeURIComponent(target).trim().replace(/^["']|["']$/g, '');
                }
                return target || null;
            } catch (e) {
                return null;
            }
        }

        function findMatchingOption(target) {
            if (!target) return null;
            const cleanTarget = normalizeJSXToken(target);

            // 1. Direct match on option value or filename
            for (let i = 0; i < presetSelect.options.length; i++) {
                const opt = presetSelect.options[i];
                if (opt.value === `jsx:${target}` || opt.value === `sample:${target}` || opt.value === `preset:${target}`) {
                    return opt.value;
                }
                if (opt.value.replace(/^(jsx:|sample:)/, '').toLowerCase() === target.toLowerCase()) {
                    return opt.value;
                }
            }

            // 2. Normalized exact match (ignoring case, .jsx extension, round/rounded, rect/rectangle)
            for (let i = 0; i < presetSelect.options.length; i++) {
                const opt = presetSelect.options[i];
                const valName = opt.value.replace(/^(jsx:|sample:|preset:)/, '');
                if (normalizeJSXToken(valName) === cleanTarget) {
                    return opt.value;
                }
            }

            // 3. Substring / Inclusion match
            for (let i = 0; i < presetSelect.options.length; i++) {
                const opt = presetSelect.options[i];
                const valName = opt.value.replace(/^(jsx:|sample:|preset:)/, '');
                const cleanVal = normalizeJSXToken(valName);
                if (cleanVal.includes(cleanTarget) || cleanTarget.includes(cleanVal)) {
                    return opt.value;
                }
            }

            // 4. Token-based overlap match (e.g. "custom round rectangle" vs "custom_rounded_rect.jsx")
            const targetWords = target.toLowerCase().replace(/\.jsx$/, '').split(/[\s\-_]+/).filter(w => w.length >= 3);
            if (targetWords.length > 0) {
                let bestOpt = null;
                let maxMatches = 0;
                for (let i = 0; i < presetSelect.options.length; i++) {
                    const opt = presetSelect.options[i];
                    const valName = opt.value.replace(/^(jsx:|sample:|preset:)/, '').toLowerCase();
                    let matches = 0;
                    for (const word of targetWords) {
                        const normWord = normalizeJSXToken(word);
                        if (valName.includes(word) || normalizeJSXToken(valName).includes(normWord)) {
                            matches++;
                        }
                    }
                    if (matches > maxMatches) {
                        maxMatches = matches;
                        bestOpt = opt.value;
                    }
                }
                if (maxMatches >= Math.min(2, targetWords.length)) {
                    return bestOpt;
                }
            }

            return null;
        }

        async function loadPresetOrJSX(val, updateUrl, isPush) {
            if (!val) return;
            if (isExternalURL(val)) {
                try {
                    await loadAndRunJSXFromURL(val, updateUrl, isPush);
                } catch (e) {
                    appendConsole(`Failed to load script from URL ${val}: ${e.message}`, true);
                }
                return;
            }
            presetSelect.value = val;
            if (val.startsWith('jsx:') || val.startsWith('sample:')) {
                const isSample = val.startsWith('sample:');
                const folder = isSample ? 'samples' : 'jsx';
                const fname = val.slice(isSample ? 7 : 4);
                const fileMap = isSample ? sampleFiles : jsxFiles;
                const manifestList = isSample ? window.SAMPLE_FOLDER_FILES : window.JSX_FOLDER_FILES;
                const fileObj = fileMap.get(fname);
                let code = fileObj ? fileObj.code : null;

                // If code not cached, look in the folder manifest
                if (!code && manifestList && Array.isArray(manifestList)) {
                    const found = manifestList.find(f => (typeof f === 'object' && f.filename === fname));
                    if (found && found.code) code = found.code;
                }

                // If over HTTP, try fetching fresh from disk
                if (window.location.protocol.startsWith('http')) {
                    try {
                        const resp = await fetch(`${folder}/${encodeURIComponent(fname)}?t=${Date.now()}`, { cache: 'no-cache' });
                        if (resp.ok) {
                            const freshCode = await resp.text();
                            if (freshCode && freshCode.trim().length > 0) {
                                code = freshCode;
                                if (fileObj) fileObj.code = code;
                            }
                        }
                    } catch(e) {
                        console.warn('Could not fetch fresh jsx file, using cached version.');
                    }
                }

                if (code) {
                    codeTextarea.value = code;
                    if (currentFilenameEl) currentFilenameEl.textContent = fname;
                    appendConsole(`Selected "${fname}" from ${folder}/ folder. Executing...`);
                    if (updateUrl) updateURLForJSX(fname, isPush);
                    window.__currentScriptSource = `${folder}/${fname}`;
                    runUserScript(code, `${folder}/${fname}`);
                }
            } else if (val.startsWith('preset:')) {
                const key = val.slice(7);
                const matched = findMatchingOption(key);
                if (matched && matched !== val) {
                    loadPresetOrJSX(matched, updateUrl, isPush);
                    return;
                }
                if (typeof PRESETS !== 'undefined' && PRESETS[key]) {
                    codeTextarea.value = PRESETS[key].code;
                    if (currentFilenameEl) currentFilenameEl.textContent = PRESETS[key].name;
                    appendConsole(`Selected preset "${PRESETS[key].name}". Executing...`);
                    if (updateUrl) updateURLForJSX(key, isPush);
                    window.__currentScriptSource = `preset:${key}`;
                    runUserScript(PRESETS[key].code, `preset:${key}`);
                }
            }
        }

        function renderPresetOptions() {
            presetSelect.innerHTML = '';

            // 1. Detected JSX tools (jsx/ folder)
            if (jsxFiles.size > 0) {
                const jsxGroup = document.createElement('optgroup');
                jsxGroup.label = '📁 Detected JSX Scripts';
                for (const [fname] of jsxFiles.entries()) {
                    const opt = document.createElement('option');
                    opt.value = `jsx:${fname}`;
                    opt.textContent = `📄 ${fname}`;
                    jsxGroup.appendChild(opt);
                }
                presetSelect.appendChild(jsxGroup);
            }

            // 2. Built-in Samples (samples/ folder)
            if (sampleFiles.size > 0) {
                const sampleGroup = document.createElement('optgroup');
                sampleGroup.label = 'Built-in Samples';
                for (const [fname] of sampleFiles.entries()) {
                    const opt = document.createElement('option');
                    opt.value = `sample:${fname}`;
                    opt.textContent = `📄 ${fname}`;
                    sampleGroup.appendChild(opt);
                }
                presetSelect.appendChild(sampleGroup);
            }
        }

        function loadManifestInto(list, map, folder) {
            if (!list || !Array.isArray(list)) return;
            list.forEach(item => {
                const fname = typeof item === 'string' ? item : item.filename;
                const code = typeof item === 'object' ? item.code : null;
                const path = typeof item === 'object' ? item.path : `${folder}/${fname}`;
                if (fname) {
                    map.set(fname, { filename: fname, path: path, code: code });
                }
            });
        }

        async function populatePresetsDropdown() {
            // Load manifests immediately
            loadManifestInto(window.JSX_FOLDER_FILES, jsxFiles, 'jsx');
            loadManifestInto(window.SAMPLE_FOLDER_FILES, sampleFiles, 'samples');

            // Also ingest any items from window.PRESETS if present
            if (typeof PRESETS !== 'undefined' && PRESETS) {
                for (const [key, item] of Object.entries(PRESETS)) {
                    if (!sampleFiles.has(key) && !jsxFiles.has(key)) {
                        sampleFiles.set(key, { filename: key, path: (item && item.path) || `samples/${key}`, code: (item && item.code) || null });
                    }
                }
            }

            // Render options immediately without waiting for network
            renderPresetOptions();

            // Handler for selection change
            presetSelect.onchange = () => {
                loadPresetOrJSX(presetSelect.value, true, true);
            };
        }

        populatePresetsDropdown().then(async () => {
            const requested = getRequestedJSXFromURL();
            let targetVal = null;
            if (requested) {
                if (isExternalURL(requested)) {
                    targetVal = requested;
                    appendConsole(`Detected external JSX URL in query: "${requested}". Fetching...`);
                } else {
                    targetVal = findMatchingOption(requested);
                    if (targetVal) {
                        appendConsole(`Detected "${requested}" in URL. Auto-loading...`);
                    } else {
                        appendConsole(`Requested file "${requested}" from URL was not found in presets. Defaulting to Cube Maker.`, true);
                    }
                }
            }

            if (!targetVal) {
                const defaultOpt = presetSelect.querySelector('option[value="jsx:cube_maker.jsx"]');
                targetVal = defaultOpt ? 'jsx:cube_maker.jsx' : (presetSelect.options[0] ? presetSelect.options[0].value : null);
            }

            if (targetVal) {
                // Preserve URL parameter by using replaceState without adding history noise
                await loadPresetOrJSX(targetVal, true, false);
            }
        });

        // Listen for browser Back/Forward navigation
        window.addEventListener('popstate', () => {
            if (chkAutobuild) {
                delete chkAutobuild.dataset.initialized;
                const autoActive = isAutoBuildRequested();
                chkAutobuild.checked = autoActive;
                chkAutobuild.dataset.initialized = 'true';
                if (toggleAutobuild) {
                    toggleAutobuild.classList.toggle('active', autoActive);
                }
            }
            const requested = getRequestedJSXFromURL();
            if (requested) {
                if (isExternalURL(requested)) {
                    if (presetSelect.value !== requested) {
                        loadPresetOrJSX(requested, false, false);
                    }
                } else {
                    const matched = findMatchingOption(requested);
                    if (matched && matched !== presetSelect.value) {
                        loadPresetOrJSX(matched, false, false);
                    }
                }
            } else {
                const defaultOpt = presetSelect.querySelector('option[value="jsx:cube_maker.jsx"]');
                const fallback = defaultOpt ? 'jsx:cube_maker.jsx' : (presetSelect.options[0] ? presetSelect.options[0].value : null);
                if (fallback && fallback !== presetSelect.value) {
                    loadPresetOrJSX(fallback, false, false);
                }
            }
        });

        // File Open Dialog & Loader
        const btnOpenJSX = document.getElementById('btn-open-jsx');
        const fileInputJSX = document.getElementById('file-input-jsx');
        const dragOverlay = document.getElementById('ae-drag-overlay');

        function loadAndRunJSXFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                codeTextarea.value = content;
                if (currentFilenameEl) currentFilenameEl.textContent = file.name;
                appendConsole(`Loaded file "${file.name}" (${file.size} bytes). Executing...`);
                updateURLForJSX(file.name, true);
                const matched = findMatchingOption(file.name);
                if (matched) {
                    presetSelect.value = matched;
                }
                window.__currentScriptSource = `file:${file.name}`;
                // Automatically execute the loaded script
                runUserScript(content, `file:${file.name}`);
            };
            reader.onerror = () => {
                appendConsole(`Failed to read file "${file.name}"`, true);
            };
            reader.readAsText(file);
        }

        if (btnOpenJSX && fileInputJSX) {
            btnOpenJSX.onclick = () => {
                fileInputJSX.value = ''; // Reset so the same file can be selected again
                fileInputJSX.click();
            };

            fileInputJSX.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    loadAndRunJSXFile(file);
                }
            };
        }

        // -------------------------------------------------------------
        // Load JSX from Web URL Dialog & Fetcher
        // -------------------------------------------------------------
        async function loadAndRunJSXFromURL(urlStr, updateUrl = true, isPush = false) {
            if (!urlStr || typeof urlStr !== 'string') throw new Error('Please enter a valid URL.');
            let cleanUrl = convertToDirectRawURL(urlStr);
            if (!cleanUrl) throw new Error('Please enter a valid URL.');

            appendConsole(`Fetching JSX from URL: ${cleanUrl}...`);
            const response = await fetch(cleanUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch script: HTTP ${response.status} ${response.statusText}`);
            }

            const code = await response.text();
            if (!code || code.trim().length === 0) {
                throw new Error('The URL returned an empty response.');
            }

            // Detect if an HTML error page was returned instead of raw code
            const trimmed = code.trim().toLowerCase();
            if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.includes('<title>404: not found</title>')) {
                throw new Error('The URL returned an HTML page instead of a raw script. If using GitHub, make sure to use the Raw link.');
            }

            // Determine script filename
            let filename = '';
            try {
                const parsedUrl = new URL(cleanUrl);
                filename = decodeURIComponent(parsedUrl.pathname.split('/').pop() || '');
            } catch(e) {}
            if (!filename || (!filename.toLowerCase().endsWith('.jsx') && !filename.toLowerCase().endsWith('.js'))) {
                filename = (filename ? filename.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'remote_script') + '.jsx';
            }

            codeTextarea.value = code;
            if (currentFilenameEl) currentFilenameEl.textContent = `${filename} (🌐 Remote URL)`;
            appendConsole(`Loaded "${filename}" from URL (${code.length} characters). Executing...`);

            // Update preset selector to reflect external script
            if (presetSelect) {
                let extOpt = presetSelect.querySelector('option[data-external="true"]');
                if (!extOpt) {
                    extOpt = document.createElement('option');
                    extOpt.dataset.external = 'true';
                    presetSelect.insertBefore(extOpt, presetSelect.firstChild);
                }
                extOpt.value = urlStr;
                extOpt.textContent = `🌐 ${filename} (External URL)`;
                presetSelect.value = urlStr;
            }

            if (updateUrl) {
                updateURLForJSX(urlStr, isPush);
            }

            window.__currentScriptSource = urlStr;
            // Execute script
            runUserScript(code, urlStr);
            return filename;
        }

        const btnUrlJSX = document.getElementById('btn-url-jsx');
        const modalUrl = document.getElementById('ae-url-modal');
        const inputUrl = document.getElementById('ae-url-input');
        const btnUrlClose = document.getElementById('ae-url-close');
        const btnUrlCancel = document.getElementById('ae-url-cancel');
        const btnUrlSubmit = document.getElementById('ae-url-submit');
        const txtUrlSubmit = document.getElementById('ae-url-submit-text');
        const errUrl = document.getElementById('ae-url-error');

        function openUrlModal() {
            if (!modalUrl) return;
            modalUrl.style.display = 'flex';
            if (errUrl) {
                errUrl.style.display = 'none';
                errUrl.textContent = '';
            }
            if (btnUrlSubmit) btnUrlSubmit.disabled = false;
            if (txtUrlSubmit) txtUrlSubmit.textContent = 'Load & Run';
            setTimeout(() => {
                if (inputUrl) {
                    inputUrl.focus();
                    inputUrl.select();
                }
            }, 50);
        }

        function closeUrlModal() {
            if (!modalUrl) return;
            modalUrl.style.display = 'none';
            if (errUrl) {
                errUrl.style.display = 'none';
                errUrl.textContent = '';
            }
        }

        async function submitUrlModal() {
            if (!inputUrl) return;
            const url = inputUrl.value.trim();
            if (!url) {
                if (errUrl) {
                    errUrl.textContent = 'Please enter or paste a .jsx URL.';
                    errUrl.style.display = 'block';
                }
                inputUrl.focus();
                return;
            }

            if (errUrl) {
                errUrl.style.display = 'none';
                errUrl.textContent = '';
            }
            if (btnUrlSubmit) btnUrlSubmit.disabled = true;
            if (txtUrlSubmit) txtUrlSubmit.textContent = 'Fetching...';

            try {
                await loadAndRunJSXFromURL(url, true, true);
                closeUrlModal();
            } catch (err) {
                if (errUrl) {
                    errUrl.textContent = err.message || 'Error loading URL.';
                    errUrl.style.display = 'block';
                }
                appendConsole(`Error loading URL: ${err.message}`, true);
            } finally {
                if (btnUrlSubmit) btnUrlSubmit.disabled = false;
                if (txtUrlSubmit) txtUrlSubmit.textContent = 'Load & Run';
            }
        }

        if (btnUrlJSX) btnUrlJSX.onclick = openUrlModal;
        if (btnUrlClose) btnUrlClose.onclick = closeUrlModal;
        if (btnUrlCancel) btnUrlCancel.onclick = closeUrlModal;
        if (btnUrlSubmit) btnUrlSubmit.onclick = submitUrlModal;

        if (inputUrl) {
            inputUrl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitUrlModal();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeUrlModal();
                }
            };
        }

        if (modalUrl) {
            modalUrl.onclick = (e) => {
                if (e.target === modalUrl) closeUrlModal();
            };
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalUrl && modalUrl.style.display !== 'none') {
                closeUrlModal();
            }
        });

        // File Download Handler ("Download .JSX")
        const btnDownloadJSX = document.getElementById('btn-download-jsx');
        if (btnDownloadJSX) {
            btnDownloadJSX.onclick = () => {
                const code = codeTextarea.value || '';
                let filename = (currentFilenameEl && currentFilenameEl.textContent.trim()) || 'script.jsx';
                if (!filename.toLowerCase().endsWith('.jsx') && !filename.toLowerCase().endsWith('.js')) {
                    filename += '.jsx';
                }
                const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                appendConsole(`Downloaded "${filename}" (${blob.size} bytes).`);
            };
        }

        // Drag and Drop Support for .JSX files
        const dropTarget = document.querySelector('.ae-editor-panel');
        if (dropTarget) {
            dropTarget.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverlay) dragOverlay.style.display = 'flex';
            });

            dropTarget.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverlay && !dropTarget.contains(e.relatedTarget)) {
                    dragOverlay.style.display = 'none';
                }
            });

            dropTarget.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverlay) dragOverlay.style.display = 'none';
                const file = e.dataTransfer.files[0];
                if (file) {
                    loadAndRunJSXFile(file);
                }
            });
        }

        // Tab Switching (Script Editor vs ScriptUI Dock)
        const tabEditor = document.getElementById('tab-editor');
        const tabScriptUI = document.getElementById('tab-scriptui');
        const editorView = document.getElementById('editor-view');
        const scriptUIView = document.getElementById('scriptui-dock-host');

        tabEditor.onclick = () => {
            tabEditor.classList.add('active');
            tabScriptUI.classList.remove('active');
            editorView.style.display = 'flex';
            scriptUIView.style.display = 'none';
        };

        tabScriptUI.onclick = () => {
            tabScriptUI.classList.add('active');
            tabEditor.classList.remove('active');
            editorView.style.display = 'none';
            scriptUIView.style.display = 'block';
        };

        window.addEventListener('scriptui-window-shown', () => {
            tabScriptUI.click();
        });

        // Global Shy Toggle Button (AE Shy Guy Pictogram)
        const btnGlobalShy = document.getElementById('btn-global-shy');
        if (btnGlobalShy) {
            btnGlobalShy.onclick = () => {
                globalShyActive = !globalShyActive;
                btnGlobalShy.classList.toggle('active', globalShyActive);
                renderTimeline();
                appendConsole(globalShyActive ? 'Shy Mode ON: Showing only .JSX UI-related properties and active controls.' : 'Shy Mode OFF: Showing all comp layers and properties.');
            };
        }



        // Buttons
        document.getElementById('btn-run-script').onclick = () => {
            runUserScript(codeTextarea.value, window.__currentScriptSource || 'editor');
        };

        document.getElementById('btn-clear-comp').onclick = (e) => {
            clearCompLayers();
            if (e && e.shiftKey) {
                removeJSXFromURL();
                window.__currentScriptSource = null;
                if (currentFilenameEl) currentFilenameEl.textContent = 'None';
                const scriptUIView = document.getElementById('scriptui-dock-host');
                if (scriptUIView) {
                    scriptUIView.innerHTML = '<div style="color: #888; font-size: 12px; text-align: center; margin-top: 40px;">No active ScriptUI panel. Select or run a script.</div>';
                }
                appendConsole('Cleared all layers and removed URL parameters.');
            } else {
                appendConsole('Cleared all layers in composition. (Active script & URL preserved)');
            }
        };

        // Keyboard Shortcut: Ctrl+Enter to Run
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                runUserScript(codeTextarea.value, window.__currentScriptSource || 'editor');
            }
        });

        // -------------------------------------------------------------
        // Resizable Panels (Viewport, Timeline, and Code/ScriptUI)
        // -------------------------------------------------------------
        function initPanelResizers() {
            const workspace = document.getElementById('ae-workspace');
            const leftCol = document.getElementById('ae-left-column');
            const viewportPanel = document.getElementById('ae-viewport-panel');
            const resizerV = document.getElementById('resizer-vertical');
            const resizerH = document.getElementById('resizer-horizontal');

            if (!workspace || !leftCol || !viewportPanel || !resizerV || !resizerH) return;

            // Restore saved sizes from localStorage
            try {
                const savedLeftW = localStorage.getItem('ae_panel_width_left');
                if (savedLeftW) {
                    const w = parseFloat(savedLeftW);
                    const wsWidth = workspace.getBoundingClientRect().width || window.innerWidth;
                    if (w >= 300 && w <= wsWidth - 280) {
                        leftCol.style.width = w + 'px';
                    }
                }
                const savedTopH = localStorage.getItem('ae_panel_height_top');
                if (savedTopH) {
                    const h = parseFloat(savedTopH);
                    const colHeight = leftCol.getBoundingClientRect().height || (window.innerHeight - 42);
                    if (h >= 140 && h <= colHeight - 120) {
                        viewportPanel.style.height = h + 'px';
                    }
                }
            } catch (e) {}

            // Vertical splitter drag (Left Column vs Right Column)
            let isDraggingV = false;
            let startX = 0;
            let startW = 0;

            resizerV.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDraggingV = true;
                startX = e.clientX;
                startW = leftCol.getBoundingClientRect().width;
                resizerV.classList.add('is-dragging');
                document.body.classList.add('is-resizing-v');
            });

            // Horizontal splitter drag (Viewport vs Bottom Timeline)
            let isDraggingH = false;
            let startY = 0;
            let startH = 0;

            resizerH.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDraggingH = true;
                startY = e.clientY;
                startH = viewportPanel.getBoundingClientRect().height;
                resizerH.classList.add('is-dragging');
                document.body.classList.add('is-resizing-h');
            });

            window.addEventListener('mousemove', (e) => {
                if (isDraggingV) {
                    const dx = e.clientX - startX;
                    const wsWidth = workspace.getBoundingClientRect().width;
                    const minW = 300;
                    const maxW = Math.max(minW, wsWidth - 280);
                    const newW = Math.min(Math.max(startW + dx, minW), maxW);
                    leftCol.style.width = newW + 'px';
                    try { localStorage.setItem('ae_panel_width_left', newW); } catch (err) {}
                    window.dispatchEvent(new Event('resize'));
                }

                if (isDraggingH) {
                    const dy = e.clientY - startY;
                    const colHeight = leftCol.getBoundingClientRect().height;
                    const minH = 140;
                    const maxH = Math.max(minH, colHeight - 120);
                    const newH = Math.min(Math.max(startH + dy, minH), maxH);
                    viewportPanel.style.height = newH + 'px';
                    try { localStorage.setItem('ae_panel_height_top', newH); } catch (err) {}
                    window.dispatchEvent(new Event('resize'));
                }
            });

            window.addEventListener('mouseup', () => {
                if (isDraggingV) {
                    isDraggingV = false;
                    resizerV.classList.remove('is-dragging');
                    document.body.classList.remove('is-resizing-v');
                    window.dispatchEvent(new Event('resize'));
                }
                if (isDraggingH) {
                    isDraggingH = false;
                    resizerH.classList.remove('is-dragging');
                    document.body.classList.remove('is-resizing-h');
                    window.dispatchEvent(new Event('resize'));
                }
            });

            // Double click to reset to default 58% / 56% split
            resizerV.addEventListener('dblclick', () => {
                leftCol.style.width = '58%';
                try { localStorage.removeItem('ae_panel_width_left'); } catch (err) {}
                window.dispatchEvent(new Event('resize'));
            });

            resizerH.addEventListener('dblclick', () => {
                viewportPanel.style.height = '56%';
                try { localStorage.removeItem('ae_panel_height_top'); } catch (err) {}
                window.dispatchEvent(new Event('resize'));
            });
        }

        initPanelResizers();

        renderTimeline();
        appendConsole(`Adobe After Effects vs JS Text Rendering Differences Guide: ${global.AE_TEXT_GUIDE_URL}`);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})(typeof window !== 'undefined' ? window : global);
