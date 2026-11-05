/**
 * scriptui.js
 * ScriptUI Polyfill for After Effects .jsx UI Panels and Dialogs
 */

(function(global) {
    'use strict';

    class UIElement {
        constructor(type, text = '', container = null, properties = {}) {
            this.type = type;
            this.text = text || '';
            this.container = container;
            this.properties = properties || {};
            this.children = [];
            this.visible = true;
            this._enabled = true;
            this.orientation = 'column'; // 'column' or 'row'
            this.alignChildren = ['center', 'center'];
            this.alignment = null;
            this.spacing = 6;
            this.margins = 8;
            this.preferredSize = [-1, -1];
            this.size = [-1, -1];
            this.characters = 0;
            this.value = false; // for checkbox/radio/slider

            this.layout = {
                layout: (recalc) => {
                    if (typeof this.updateLayout === 'function') this.updateLayout();
                    return true;
                },
                resize: () => {
                    if (typeof this.updateLayout === 'function') this.updateLayout();
                    return true;
                }
            };

            this.domElement = null;
            this.onClick = null;
            this.onChange = null;
            this.onChanging = null;
            this.onDraw = null;
            this.helpTip = '';
        }

        get enabled() {
            return this._enabled !== undefined ? this._enabled : true;
        }

        set enabled(val) {
            this._enabled = Boolean(val);
            if (this.domElement) {
                if (this.domElement.tagName === 'INPUT' || this.domElement.tagName === 'BUTTON' || this.domElement.tagName === 'SELECT') {
                    this.domElement.disabled = !this._enabled;
                } else {
                    this.domElement.style.opacity = this._enabled ? '1' : '0.4';
                    this.domElement.style.pointerEvents = this._enabled ? 'auto' : 'none';
                }
            }
            if (this.children && this.children.length > 0) {
                for (let i = 0; i < this.children.length; i++) {
                    this.children[i].enabled = this._enabled;
                }
            }
        }

        notify(event) {
            if (event === 'onDraw' && typeof this.onDraw === 'function') {
                this.onDraw();
            }
        }

        get graphics() {
            if (!this._graphics) {
                this._graphics = {
                    BrushType: { SOLID_COLOR: 1, THEME_COLOR: 2 },
                    PenType: { SOLID_COLOR: 1, THEME_COLOR: 2 },
                    newBrush: (type, color) => {
                        if (this.domElement && Array.isArray(color)) {
                            const r = Math.round((color[0] || 0) * 255);
                            const g = Math.round((color[1] || 0) * 255);
                            const b = Math.round((color[2] || 0) * 255);
                            this.domElement.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                        }
                        return {};
                    },
                    newPen: (type, color, width) => ({}),
                    newPath: () => {},
                    rectPath: () => {},
                    fillPath: () => {},
                    strokePath: () => {}
                };
            }
            return this._graphics;
        }

        add(type, bounds, text, properties) {
            // ScriptUI signature: container.add(type, bounds, text, properties)
            let childText = '';
            let childProps = {};

            if (typeof bounds === 'string') {
                childText = bounds;
                childProps = text || {};
            } else {
                childText = text || '';
                childProps = properties || {};
            }

            let child;
            switch (type.toLowerCase()) {
                case 'group':
                    child = new Group(childText, this, childProps);
                    break;
                case 'panel':
                    child = new Panel(childText, this, childProps);
                    break;
                case 'tabbedpanel':
                    child = new TabbedPanel(childText, this, childProps);
                    break;
                case 'tab':
                    child = new Tab(childText, this, childProps);
                    break;
                case 'button':
                    child = new Button(childText, this, childProps);
                    break;
                case 'statictext':
                    child = new StaticText(childText, this, childProps);
                    break;
                case 'edittext':
                    child = new EditText(childText, this, childProps);
                    break;
                case 'slider':
                    child = new Slider(childText, this, childProps);
                    break;
                case 'checkbox':
                    child = new Checkbox(childText, this, childProps);
                    break;
                case 'radiobutton':
                    child = new RadioButton(childText, this, childProps);
                    break;
                case 'dropdownlist':
                    child = new DropDownList(childText, this, childProps);
                    break;
                case 'progressbar':
                    child = new ProgressBar(childText, this, childProps);
                    break;
                case 'colorpicker':
                    child = new ColorPicker(childText, this, childProps);
                    break;
                default:
                    child = new UIElement(type, childText, this, childProps);
                    break;
            }

            this.children.push(child);
            return child;
        }

        remove(indexOrElement) {
            let idx = -1;
            if (typeof indexOrElement === 'number') {
                idx = indexOrElement;
            } else {
                idx = this.children.indexOf(indexOrElement);
            }
            if (idx >= 0 && idx < this.children.length) {
                const item = this.children.splice(idx, 1)[0];
                if (item.domElement && item.domElement.parentNode) {
                    item.domElement.parentNode.removeChild(item.domElement);
                }
            }
        }

        renderDOM() {
            // Override in subclasses
            return document.createElement('div');
        }

        applyCommonStyles(el) {
            if (this.orientation === 'row') {
                el.style.display = 'flex';
                el.style.flexDirection = 'row';
                el.style.alignItems = 'center';
            } else if (this.orientation === 'column') {
                el.style.display = 'flex';
                el.style.flexDirection = 'column';
            }
            if (this.spacing !== undefined) {
                el.style.gap = `${this.spacing}px`;
            }
            if (this.margins !== undefined) {
                if (Array.isArray(this.margins)) {
                    el.style.padding = `${this.margins[1]}px ${this.margins[2]}px ${this.margins[3]}px ${this.margins[0]}px`;
                } else {
                    el.style.padding = `${this.margins}px`;
                }
            }
            if (this.preferredSize && this.preferredSize[0] > 0) {
                el.style.width = `${this.preferredSize[0]}px`;
            }
            if (this.preferredSize && this.preferredSize[1] > 0) {
                el.style.height = `${this.preferredSize[1]}px`;
            }
            if (this.alignment) {
                if (Array.isArray(this.alignment) && this.alignment[0] === 'fill') {
                    el.style.width = '100%';
                    el.style.boxSizing = 'border-box';
                }
            }
            if (this.alignChildren && Array.isArray(this.alignChildren)) {
                if (this.alignChildren[0] === 'fill') {
                    el.style.alignItems = 'stretch';
                } else if (this.alignChildren[0] === 'left') {
                    el.style.alignItems = 'flex-start';
                } else if (this.alignChildren[0] === 'right') {
                    el.style.alignItems = 'flex-end';
                }
            }
            if (this.enabled === false) {
                if (el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'SELECT') {
                    el.disabled = true;
                } else {
                    el.style.opacity = '0.4';
                    el.style.pointerEvents = 'none';
                }
            }
        }
    }

    class Group extends UIElement {
        constructor(text, container, properties) {
            super('group', text, container, properties);
            this.orientation = 'row';
            this.spacing = 8;
            this.margins = 0;
        }

        renderDOM() {
            const div = document.createElement('div');
            div.className = 'scriptui-group';
            this.applyCommonStyles(div);
            for (const child of this.children) {
                div.appendChild(child.renderDOM());
            }
            this.domElement = div;
            return div;
        }
    }

    class Panel extends UIElement {
        constructor(text, container, properties) {
            super('panel', text, container, properties);
            this.orientation = 'column';
            this.spacing = 8;
            this.margins = 10;
        }

        renderDOM() {
            const fieldset = document.createElement('fieldset');
            fieldset.className = 'scriptui-panel';
            if (this.text && (this.text.includes('🔵') || this.text.includes('🟡') || this.properties?.className === 'animatable')) {
                fieldset.classList.add('scriptui-animatable');
            } else if (this.text && (this.text.includes('🔴') || this.properties?.className === 'static')) {
                fieldset.classList.add('scriptui-static');
            }
            if (this.text) {
                const legend = document.createElement('legend');
                legend.textContent = this.text;
                fieldset.appendChild(legend);
            }
            this.applyCommonStyles(fieldset);
            for (const child of this.children) {
                fieldset.appendChild(child.renderDOM());
            }
            this.domElement = fieldset;
            return fieldset;
        }
    }

    class TabbedPanel extends UIElement {
        constructor(text, container, properties) {
            super('tabbedpanel', text, container, properties);
            this.orientation = 'column';
            this.alignChildren = ['fill', 'top'];
            this.spacing = 0;
            this.margins = 0;
            this.tabs = [];
            this._selection = null;
            this.tabBarEl = null;
            this.tabBodyEl = null;
        }

        get selection() {
            return this._selection;
        }

        set selection(val) {
            if (typeof val === 'number') {
                if (val >= 0 && val < this.tabs.length) {
                    this.selectTab(this.tabs[val]);
                }
            } else if (val && (val instanceof Tab || this.tabs.indexOf(val) !== -1)) {
                this.selectTab(val);
            }
        }

        add(type, bounds, text, properties) {
            let childText = '';
            let childProps = {};
            if (typeof bounds === 'string') {
                childText = bounds;
                childProps = text || {};
            } else {
                childText = text || '';
                childProps = properties || {};
            }

            if (type.toLowerCase() === 'tab') {
                const tab = new Tab(childText, this, childProps);
                this.children.push(tab);
                this.tabs.push(tab);
                if (!this._selection) {
                    this._selection = tab;
                }
                return tab;
            }
            return super.add(type, bounds, text, properties);
        }

        selectTab(tab) {
            this._selection = tab;
            if (this.tabBarEl && this.tabBodyEl) {
                for (let i = 0; i < this.tabs.length; i++) {
                    const t = this.tabs[i];
                    const btn = this.tabBarEl.children[i];
                    const isActive = (t === tab);
                    if (btn) {
                        btn.classList.toggle('active', isActive);
                    }
                    if (t.domElement) {
                        t.domElement.style.display = isActive ? 'flex' : 'none';
                    }
                }
            }
            if (typeof this.onChange === 'function') {
                this.onChange();
            }
        }

        renderDOM() {
            const div = document.createElement('div');
            div.className = 'scriptui-tabbedpanel';
            this.applyCommonStyles(div);

            const tabBar = document.createElement('div');
            tabBar.className = 'scriptui-tab-bar';
            this.tabBarEl = tabBar;

            const tabBody = document.createElement('div');
            tabBody.className = 'scriptui-tab-body';
            this.tabBodyEl = tabBody;

            this.tabs.forEach((tab, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'scriptui-tab-btn' + (this._selection === tab ? ' active' : '');
                btn.textContent = tab.text || ('Tab ' + (index + 1));
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.selectTab(tab);
                });
                tabBar.appendChild(btn);

                const tabContent = tab.renderDOM();
                tabContent.style.display = (this._selection === tab) ? 'flex' : 'none';
                tabBody.appendChild(tabContent);
            });

            div.appendChild(tabBar);
            div.appendChild(tabBody);
            this.domElement = div;
            return div;
        }
    }

    class Tab extends UIElement {
        constructor(text, container, properties) {
            super('tab', text, container, properties);
            this.orientation = 'column';
            this.alignChildren = ['fill', 'top'];
            this.spacing = 8;
            this.margins = 8;
        }

        get index() {
            return this.container && this.container.tabs ? this.container.tabs.indexOf(this) : -1;
        }

        renderDOM() {
            const div = document.createElement('div');
            div.className = 'scriptui-tab-content';
            this.applyCommonStyles(div);

            for (const child of this.children) {
                div.appendChild(child.renderDOM());
            }

            this.domElement = div;
            return div;
        }
    }

    class Button extends UIElement {
        constructor(text, container, properties) {
            super('button', text, container, properties);
        }

        renderDOM() {
            const btn = document.createElement('button');
            btn.className = 'scriptui-button';
            this.applyCommonStyles(btn);
            if (this.helpTip) {
                btn.title = this.helpTip;
            }
            if (this.text && this.text.includes('🔴')) {
                btn.style.borderColor = '#ff5252';
                btn.style.background = '#3d1a1a';
                btn.style.color = '#ff9999';
            } else if (this.text && (this.text.includes('🔵') || this.text.includes('🟡'))) {
                btn.style.borderColor = '#2c8cff';
                btn.style.background = '#1a293d';
                btn.style.color = '#64b5f6';
            }
            btn.textContent = this.text || '';
            btn.onclick = () => {
                if (this.onClick) this.onClick();
            };
            this.domElement = btn;
            if (typeof this.onDraw === 'function') {
                this.onDraw();
            }
            return btn;
        }
    }

    class StaticText extends UIElement {
        constructor(text, container, properties) {
            super('statictext', text, container, properties);
        }

        renderDOM() {
            const span = document.createElement('span');
            span.className = 'scriptui-statictext';
            if (this.text && (this.text.includes('🔵') || this.text.includes('🟡'))) {
                span.style.color = '#64b5f6';
                span.style.fontWeight = '600';
            } else if (this.text && this.text.includes('🔴')) {
                span.style.color = '#ff7675';
                span.style.fontWeight = '600';
            }
            if (this._onClick || (this.text && (this.text.toLowerCase().includes('github') || this.text.toLowerCase().includes('http')))) {
                span.classList.add('scriptui-link');
            }
            span.textContent = this.text;
            span.onclick = (e) => {
                if (typeof this.onClick === 'function') {
                    e.stopPropagation();
                    this.onClick();
                }
            };
            this.domElement = span;
            return span;
        }

        set onClick(fn) {
            this._onClick = fn;
            if (this.domElement) {
                this.domElement.classList.add('scriptui-link');
            }
        }

        get onClick() {
            return this._onClick;
        }
    }

    class EditText extends UIElement {
        constructor(text, container, properties) {
            super('edittext', text, container, properties);
            this._text = text || '';
        }

        get text() {
            return this.domElement ? this.domElement.value : this._text;
        }

        set text(val) {
            this._text = String(val);
            if (this.domElement) this.domElement.value = this._text;
        }

        renderDOM() {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'scriptui-edittext';
            input.value = this._text;
            this.applyCommonStyles(input);
            if (this.helpTip) {
                input.title = this.helpTip;
            }
            if (this.characters > 0) {
                input.size = this.characters;
            }
            input.oninput = () => {
                this._text = input.value;
                if (this.onChanging) this.onChanging();
            };
            input.onchange = () => {
                this._text = input.value;
                if (this.onChange) this.onChange();
            };
            this.domElement = input;
            return input;
        }
    }

    class Slider extends UIElement {
        constructor(text, container, properties) {
            super('slider', text, container, properties);
            this.minvalue = (properties && properties.minvalue !== undefined) ? properties.minvalue : 0;
            this.maxvalue = (properties && properties.maxvalue !== undefined) ? properties.maxvalue : 100;
            this._value = (typeof text === 'number') ? text : this.minvalue;
        }

        get value() {
            return this.domElement ? parseFloat(this.domElement.value) : this._value;
        }

        set value(val) {
            this._value = Number(val);
            if (this.domElement) this.domElement.value = this._value;
        }

        renderDOM() {
            const container = document.createElement('div');
            container.className = 'scriptui-slider-container';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'scriptui-slider';
            slider.min = this.minvalue;
            slider.max = this.maxvalue;
            slider.value = this._value;

            slider.oninput = () => {
                this._value = parseFloat(slider.value);
                if (this.onChanging) this.onChanging();
            };
            slider.onchange = () => {
                this._value = parseFloat(slider.value);
                if (this.onChange) this.onChange();
            };

            container.appendChild(slider);
            this.domElement = slider;
            return container;
        }
    }

    class Checkbox extends UIElement {
        constructor(text, container, properties) {
            super('checkbox', text, container, properties);
            this._value = false;
        }

        get value() {
            return this.domElement ? this.domElement.checked : this._value;
        }

        set value(val) {
            this._value = Boolean(val);
            if (this.domElement) this.domElement.checked = this._value;
        }

        renderDOM() {
            const label = document.createElement('label');
            label.className = 'scriptui-checkbox-label';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = this._value;
            const handleToggle = () => {
                this._value = chk.checked;
                if (this.onClick) this.onClick();
                if (this.onChange) this.onChange();
            };
            chk.onchange = handleToggle;
            chk.onclick = handleToggle;

            const textSpan = document.createElement('span');
            textSpan.textContent = this.text;
            if (this.text && (this.text.includes('🔵') || this.text.includes('🟡'))) {
                textSpan.style.color = '#64b5f6';
                textSpan.style.fontWeight = '500';
            } else if (this.text && this.text.includes('🔴')) {
                textSpan.style.color = '#ff7675';
                textSpan.style.fontWeight = '500';
            }

            label.appendChild(chk);
            label.appendChild(textSpan);
            this.domElement = chk;
            return label;
        }
    }

    class RadioButton extends UIElement {
        constructor(text, container, properties) {
            super('radiobutton', text, container, properties);
            this._value = false;
        }

        get value() {
            return this.domElement ? this.domElement.checked : this._value;
        }

        set value(val) {
            this._value = Boolean(val);
            if (this.domElement) this.domElement.checked = this._value;
        }

        renderDOM() {
            const label = document.createElement('label');
            label.className = 'scriptui-radio-label';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = this.container ? `radio_${this.container.type}` : 'radio_group';
            radio.checked = this._value;
            radio.onchange = () => {
                this._value = radio.checked;
                if (this.onClick) this.onClick();
            };

            const textSpan = document.createElement('span');
            textSpan.textContent = this.text;
            if (this.text && (this.text.includes('🔵') || this.text.includes('🟡'))) {
                textSpan.style.color = '#64b5f6';
                textSpan.style.fontWeight = '500';
            } else if (this.text && this.text.includes('🔴')) {
                textSpan.style.color = '#ff7675';
                textSpan.style.fontWeight = '500';
            }

            label.appendChild(radio);
            label.appendChild(textSpan);
            this.domElement = radio;
            return label;
        }
    }

    class DropDownList extends UIElement {
        constructor(text, container, properties) {
            super('dropdownlist', text, container, properties);
            this.items = [];
            this.selection = null;
        }

        add(type, text) {
            if (type === 'item') {
                const item = { text: text, index: this.items.length };
                this.items.push(item);
                if (this.items.length === 1) {
                    this.selection = item;
                }
                return item;
            }
        }

        renderDOM() {
            const select = document.createElement('select');
            select.className = 'scriptui-dropdown';
            this.items.forEach((item, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = item.text;
                select.appendChild(opt);
            });

            select.onchange = () => {
                this.selection = this.items[select.selectedIndex];
                if (this.onChange) this.onChange();
            };

            this.domElement = select;
            return select;
        }
    }

    class ProgressBar extends UIElement {
        constructor(text, container, properties) {
            super('progressbar', text, container, properties);
            this.maxvalue = 100;
            this._value = 0;
        }

        get value() {
            return this._value;
        }

        set value(val) {
            this._value = val;
            if (this.domElement) this.domElement.value = val;
        }

        renderDOM() {
            const p = document.createElement('progress');
            p.className = 'scriptui-progressbar';
            p.max = this.maxvalue;
            p.value = this._value;
            this.domElement = p;
            return p;
        }
    }

    class ColorPicker extends UIElement {
        constructor(text, container, properties) {
            super('colorpicker', text, container, properties);
            let col = '#2288ff';
            if (properties && properties.color) col = properties.color;
            else if (typeof text === 'string' && text.startsWith('#')) col = text;
            this._color = col;
        }

        get value() {
            return this._color;
        }

        set value(val) {
            this._color = val;
            if (this.domElement) {
                const input = this.domElement.querySelector('input[type="color"]');
                if (input) input.value = val;
                const swatch = this.domElement.querySelector('.scriptui-color-swatch');
                if (swatch) swatch.style.backgroundColor = val;
                const hex = this.domElement.querySelector('.scriptui-color-hex');
                if (hex) hex.textContent = val.toUpperCase();
            }
        }

        renderDOM() {
            const container = document.createElement('div');
            container.className = 'scriptui-colorpicker-wrapper';
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            container.style.gap = '8px';

            const swatch = document.createElement('div');
            swatch.className = 'scriptui-color-swatch';
            swatch.style.width = '24px';
            swatch.style.height = '24px';
            swatch.style.borderRadius = '3px';
            swatch.style.border = '1px solid #777';
            swatch.style.cursor = 'pointer';
            swatch.style.backgroundColor = this._color;
            swatch.title = 'Click to open color picker dialog';

            const input = document.createElement('input');
            input.type = 'color';
            input.value = this._color;
            input.style.opacity = '0';
            input.style.width = '0';
            input.style.height = '0';
            input.style.position = 'absolute';
            input.style.pointerEvents = 'none';

            const hexSpan = document.createElement('span');
            hexSpan.className = 'scriptui-color-hex';
            hexSpan.textContent = this._color.toUpperCase();
            hexSpan.style.fontFamily = 'monospace';
            hexSpan.style.fontSize = '11px';
            hexSpan.style.color = '#ccc';

            swatch.onclick = () => {
                input.click();
            };

            input.oninput = () => {
                this._color = input.value;
                swatch.style.backgroundColor = this._color;
                hexSpan.textContent = this._color.toUpperCase();
                if (this.onChanging) this.onChanging();
            };

            input.onchange = () => {
                this._color = input.value;
                swatch.style.backgroundColor = this._color;
                hexSpan.textContent = this._color.toUpperCase();
                if (this.onChange) this.onChange();
            };

            container.appendChild(swatch);
            container.appendChild(input);
            container.appendChild(hexSpan);

            this.domElement = container;
            return container;
        }
    }

    // -------------------------------------------------------------
    // Window: Floating / Dockable Panel
    // -------------------------------------------------------------
    class ScriptUIWindow extends UIElement {
        constructor(type = 'palette', title = 'AE Script Panel', bounds = undefined, properties = {}) {
            super('window', title, null, properties);
            this.windowType = type; // 'palette', 'dialog', 'window'
            this.title = title;
            this.layout = {
                layout: () => this.updateLayout(),
                resize: () => this.updateLayout()
            };
            this.domWrapper = null;
        }

        get text() {
            return this.title;
        }

        set text(val) {
            this.title = val;
            if (this.domWrapper) {
                const titleEl = this.domWrapper.querySelector('.scriptui-window-title');
                if (titleEl) titleEl.textContent = val;
            }
        }

        center() {
            // Automatically centered by CSS or dock
        }

        close() {
            if (this.domWrapper && this.domWrapper.parentNode) {
                this.domWrapper.parentNode.removeChild(this.domWrapper);
            }
        }

        show() {
            const host = document.getElementById('scriptui-dock-host') || document.body;
            // Clear previous windows and placeholder
            host.innerHTML = '';

            const winDiv = document.createElement('div');
            winDiv.className = 'scriptui-window-container';

            // Title Bar
            const header = document.createElement('div');
            header.className = 'scriptui-window-header';
            header.innerHTML = `
                <span class="scriptui-window-title">${this.title}</span>
                <span class="scriptui-close-btn">&times;</span>
            `;
            header.querySelector('.scriptui-close-btn').onclick = () => this.close();
            winDiv.appendChild(header);

            // Body Content
            const body = document.createElement('div');
            body.className = 'scriptui-window-body';
            this.applyCommonStyles(body);

            for (const child of this.children) {
                body.appendChild(child.renderDOM());
            }

            winDiv.appendChild(body);
            host.appendChild(winDiv);
            this.domWrapper = winDiv;

            // Notify app to switch tab if needed
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('scriptui-window-shown'));
            }
            return this;
        }

        updateLayout() {
            if (this.domWrapper) {
                const body = this.domWrapper.querySelector('.scriptui-window-body');
                if (body) {
                    body.innerHTML = '';
                    for (const child of this.children) {
                        body.appendChild(child.renderDOM());
                    }
                }
            }
        }
    }

    // ExtendScript ScriptUI Window constructor
    global.Window = ScriptUIWindow;
    global.Panel = Panel;
    global.Group = Group;
    global.TabbedPanel = TabbedPanel;
    global.Tab = Tab;

})(typeof window !== 'undefined' ? window : global);
