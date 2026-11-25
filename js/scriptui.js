/**
 * Co-authored & architected with Google DeepMind Antigravity.
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

        get visible() {
            return this._visible !== undefined ? this._visible : true;
        }

        set visible(val) {
            this._visible = Boolean(val);
            if (this.domElement) {
                this.domElement.style.display = this._visible ? '' : 'none';
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
            // For Slider/Scrollbar/Progressbar, ExtendScript supports:
            // container.add("slider", bounds, value, minvalue, maxvalue, properties)
            let childText = '';
            let childProps = {};

            const tLower = (type || '').toLowerCase();
            if (tLower === 'slider' || tLower === 'scrollbar' || tLower === 'progressbar') {
                const initialVal = (typeof text === 'number') ? text : 0;
                let minVal = 0;
                let maxVal = 100;

                if (typeof properties === 'number') {
                    minVal = properties;
                    if (arguments.length >= 5 && typeof arguments[4] === 'number') {
                        maxVal = arguments[4];
                    }
                    if (arguments.length >= 6 && typeof arguments[5] === 'object') {
                        childProps = arguments[5] || {};
                    }
                } else if (properties && typeof properties === 'object') {
                    childProps = properties;
                    if (properties.minvalue !== undefined) minVal = properties.minvalue;
                    if (properties.maxvalue !== undefined) maxVal = properties.maxvalue;
                }

                childProps.minvalue = minVal;
                childProps.maxvalue = maxVal;
                childText = initialVal;
            } else if (typeof bounds === 'string') {
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
                case 'custombutton':
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
                case 'listbox':
                    child = new ListBox(childText, this, childProps);
                    break;
                case 'scrollbar':
                    child = new Scrollbar(childText, this, childProps);
                    break;
                case 'iconbutton':
                    child = new IconButton(childText, this, childProps);
                    break;
                case 'treeview':
                    child = new TreeView(childText, this, childProps);
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
            const isContainer = (this.type === 'panel' || this.type === 'group' || this.type === 'tabbedpanel' || this.type === 'tab' || this.type === 'window' || this.type === 'palette');
            if (this.type === 'checkbox' || this.type === 'radiobutton') {
                el.style.display = 'inline-flex';
                el.style.flexDirection = 'row';
                el.style.alignItems = 'center';
            } else if (isContainer) {
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
                    } else if (typeof this.margins === 'number' && this.margins > 0) {
                        el.style.padding = `${this.margins}px`;
                    }
                }
            }
            if (this._visible === false) {
                el.style.display = 'none';
            }
            if (this.preferredSize && this.preferredSize[0] > 0) {
                el.style.width = `${this.preferredSize[0]}px`;
                if (el.tagName === 'SPAN') {
                    el.style.display = 'inline-block';
                    el.style.flexShrink = '0';
                }
            }
            if (this.preferredSize && this.preferredSize[1] > 0) {
                el.style.height = `${this.preferredSize[1]}px`;
            }
            if (this.alignment) {
                if (Array.isArray(this.alignment)) {
                    if (this.alignment[0] === 'fill') {
                        el.style.width = '100%';
                        el.style.boxSizing = 'border-box';
                        el.style.flex = '1';
                    } else if (this.alignment[0] === 'left') {
                        el.style.alignSelf = 'flex-start';
                    } else if (this.alignment[0] === 'right') {
                        el.style.alignSelf = 'flex-end';
                    } else if (this.alignment[0] === 'center') {
                        el.style.alignSelf = 'center';
                    }
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
                    el.style.opacity = '0.35';
                    el.style.pointerEvents = 'none';
                }
            }
        }
    }

    class Group extends UIElement {
        constructor(text, container, properties) {
            super('group', text, container, properties);
            this.orientation = 'row';
            this.spacing = 6;
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
            this.spacing = 6;
            this.margins = [6, 8, 8, 8];
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
            this.spacing = 6;
            this.margins = [4, 2, 4, 2];
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
            this._text = text || '';
        }

        get text() {
            return this._text !== undefined ? this._text : '';
        }

        set text(val) {
            this._text = String(val);
            if (this.domElement) {
                this.domElement.textContent = this._text;
            }
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
            if (!this.text && (this.preferredSize[0] <= 45 || typeof this.onDraw === 'function' || (this.helpTip && this.helpTip.toLowerCase().includes('color')))) {
                btn.classList.add('scriptui-color-swatch-btn');
            }
            btn.onclick = () => {
                const btnText = (this.text || '').toLowerCase();
                if (btnText.includes('build') && !btnText.includes('highlight') && (btnText.includes('cube') || btnText.includes('cylinder') || btnText.includes('spiral') || btnText.includes('scene'))) {
                    if (typeof window !== 'undefined' && typeof window.clearCompLayers === 'function') {
                        window.clearCompLayers();
                    } else if (typeof app !== 'undefined' && app.project && app.project.activeItem) {
                        const comp = app.project.activeItem;
                        while (comp.layers && comp.layers.length > 0) {
                            comp.layers.remove(comp.layers[0]);
                        }
                    }
                }
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
            this._text = text || '';
        }

        get text() {
            return this.domElement ? this.domElement.textContent : this._text;
        }

        set text(val) {
            this._text = String(val !== undefined && val !== null ? val : '');
            if (this.domElement) {
                this.domElement.textContent = this._text;
            }
        }

        renderDOM() {
            const span = document.createElement('span');
            span.className = 'scriptui-statictext';
            this.applyCommonStyles(span);
            if (this._text && (this._text.includes('🔵') || this._text.includes('🟡'))) {
                span.style.color = '#64b5f6';
                span.style.fontWeight = '600';
            } else if (this._text && this._text.includes('🔴')) {
                span.style.color = '#ff7675';
                span.style.fontWeight = '600';
            }
            if (this._onClick || (this._text && (this._text.toLowerCase().includes('github') || this._text.toLowerCase().includes('http')))) {
                span.classList.add('scriptui-link');
            }
            span.textContent = this._text;
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

        get active() {
            return this.domElement ? (document.activeElement === this.domElement) : false;
        }

        set active(val) {
            if (this.domElement) {
                if (val) this.domElement.focus();
                else this.domElement.blur();
            }
        }

        renderDOM() {
            const isMultiline = Boolean(this.properties && this.properties.multiline);
            const input = document.createElement(isMultiline ? 'textarea' : 'input');
            if (!isMultiline) input.type = 'text';
            input.className = 'scriptui-edittext' + (isMultiline ? ' multiline' : '');
            input.value = this._text;
            this.applyCommonStyles(input);
            if (this.helpTip) {
                input.title = this.helpTip;
            }
            if (!isMultiline && this.characters > 0) {
                input.size = this.characters;
                input.style.width = `${Math.max(36, this.characters * 7 + 16)}px`;
                input.style.flexShrink = '0';
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
            this._minvalue = (properties && properties.minvalue !== undefined) ? Number(properties.minvalue) : 0;
            this._maxvalue = (properties && properties.maxvalue !== undefined) ? Number(properties.maxvalue) : 100;
            this._value = (typeof text === 'number') ? text : this._minvalue;
        }

        get minvalue() {
            return this._minvalue !== undefined ? this._minvalue : 0;
        }

        set minvalue(val) {
            this._minvalue = Number(val);
            if (this.domElement) this.domElement.min = this._minvalue;
        }

        get maxvalue() {
            return this._maxvalue !== undefined ? this._maxvalue : 100;
        }

        set maxvalue(val) {
            this._maxvalue = Number(val);
            if (this.domElement) this.domElement.max = this._maxvalue;
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
            this.applyCommonStyles(container);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'scriptui-slider';
            slider.min = this.minvalue;
            slider.max = this.maxvalue;
            slider.value = this._value;
            if (this.enabled === false) {
                slider.disabled = true;
            }

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
            this.orientation = 'row';
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
            this.applyCommonStyles(label);

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = this._value;
            if (this.enabled === false) {
                chk.disabled = true;
            }
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
            this.orientation = 'row';
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
            this.applyCommonStyles(label);

            const radio = document.createElement('input');
            radio.type = 'radio';
            if (this.container && !this.container._radioGroupId) {
                this.container._radioGroupId = 'radio_grp_' + Math.random().toString(36).substring(2, 9);
            }
            radio.name = this.container ? this.container._radioGroupId : 'radio_group';
            radio.checked = this._value;
            if (this.enabled === false) {
                radio.disabled = true;
            }
            radio.onchange = () => {
                this._value = radio.checked;
                if (this.container && this.container.children) {
                    this.container.children.forEach(child => {
                        if (child instanceof RadioButton && child !== this) {
                            child._value = false;
                        }
                    });
                }
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
            this._selection = null;
            if (Array.isArray(text)) {
                text.forEach(t => this.add('item', String(t)));
            }
        }

        get selection() {
            return this._selection;
        }

        set selection(val) {
            if (typeof val === 'number') {
                this._selection = this.items[val] || null;
            } else {
                this._selection = val;
            }
            if (this.domElement) {
                const idx = (this._selection && this._selection.index !== undefined) ? this._selection.index : -1;
                this.domElement.selectedIndex = idx;
            }
        }

        add(type, text) {
            if (type === 'item') {
                const item = { text: text, index: this.items.length };
                this.items.push(item);
                if (this.domElement) {
                    const opt = document.createElement('option');
                    opt.value = item.index;
                    opt.textContent = item.text;
                    this.domElement.appendChild(opt);
                }
                if (this.items.length === 1 && !this._selection) {
                    this._selection = item;
                }
                return item;
            }
        }

        removeAll() {
            this.items = [];
            this._selection = null;
            if (this.domElement) {
                this.domElement.innerHTML = '';
            }
        }

        renderDOM() {
            const select = document.createElement('select');
            select.className = 'scriptui-dropdown';
            this.applyCommonStyles(select);
            this.items.forEach((item, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = item.text;
                select.appendChild(opt);
            });
            if (this._selection && this._selection.index !== undefined) {
                select.selectedIndex = this._selection.index;
            }

            select.onchange = () => {
                this._selection = this.items[select.selectedIndex];
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

    class ListBox extends UIElement {
        constructor(text, container, properties) {
            super('listbox', text, container, properties);
            this.items = [];
            this._selection = null;
            this.multiselect = !!(properties && properties.multiselect);
            if (Array.isArray(text)) {
                text.forEach(t => this.add('item', String(t)));
            }
        }

        get selection() {
            return this._selection;
        }

        set selection(val) {
            if (typeof val === 'number') {
                this._selection = this.items[val] || null;
            } else if (Array.isArray(val)) {
                this._selection = val.map(v => (typeof v === 'number' ? this.items[v] : v)).filter(Boolean);
            } else {
                this._selection = val;
            }
            if (this.domElement) {
                if (Array.isArray(this._selection)) {
                    const selIndices = new Set(this._selection.map(s => s.index));
                    Array.from(this.domElement.options).forEach(opt => {
                        opt.selected = selIndices.has(Number(opt.value));
                    });
                } else if (this._selection) {
                    this.domElement.selectedIndex = this._selection.index !== undefined ? this._selection.index : -1;
                } else {
                    this.domElement.selectedIndex = -1;
                }
            }
        }

        add(type, text) {
            if (type === 'item') {
                const item = { text: String(text || ''), index: this.items.length };
                this.items.push(item);
                if (this.domElement) {
                    const opt = document.createElement('option');
                    opt.value = item.index;
                    opt.textContent = item.text;
                    this.domElement.appendChild(opt);
                }
                if (this.items.length === 1 && !this._selection && !this.multiselect) {
                    this._selection = item;
                }
                return item;
            }
        }

        removeAll() {
            this.items = [];
            this._selection = null;
            if (this.domElement) this.domElement.innerHTML = '';
        }

        renderDOM() {
            const select = document.createElement('select');
            select.className = 'scriptui-listbox';
            if (this.multiselect) select.multiple = true;
            select.size = Math.max(3, Math.min(6, this.items.length || 3));
            this.applyCommonStyles(select);
            this.items.forEach((item, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = item.text;
                if (!this.multiselect && this._selection === item) opt.selected = true;
                select.appendChild(opt);
            });

            select.onchange = () => {
                if (this.multiselect) {
                    this._selection = Array.from(select.selectedOptions).map(opt => this.items[Number(opt.value)]);
                } else {
                    this._selection = this.items[select.selectedIndex] || null;
                }
                if (this.onChange) this.onChange();
            };

            this.domElement = select;
            return select;
        }
    }

    class Scrollbar extends UIElement {
        constructor(text, container, properties) {
            super('scrollbar', text, container, properties);
            this.minvalue = 0;
            this.maxvalue = 100;
            this.stepdelta = 1;
            this.jumpdelta = 10;
            this._value = 0;
            if (properties) {
                if (properties.minvalue !== undefined) this.minvalue = properties.minvalue;
                if (properties.maxvalue !== undefined) this.maxvalue = properties.maxvalue;
            }
        }

        get value() {
            return this._value;
        }

        set value(val) {
            this._value = Math.max(this.minvalue, Math.min(this.maxvalue, Number(val) || 0));
            if (this.domElement) this.domElement.value = this._value;
        }

        renderDOM() {
            const input = document.createElement('input');
            input.type = 'range';
            input.className = 'scriptui-scrollbar';
            input.min = this.minvalue;
            input.max = this.maxvalue;
            input.step = this.stepdelta;
            input.value = this._value;
            this.applyCommonStyles(input);

            input.oninput = () => {
                this._value = Number(input.value);
                if (this.onChanging) this.onChanging();
            };
            input.onchange = () => {
                this._value = Number(input.value);
                if (this.onChange) this.onChange();
            };

            this.domElement = input;
            return input;
        }
    }

    class IconButton extends Button {
        constructor(text, container, properties) {
            super(text, container, properties);
            this.type = 'iconbutton';
            this.image = properties && properties.image ? properties.image : null;
        }

        renderDOM() {
            const btn = super.renderDOM();
            btn.classList.add('scriptui-iconbutton');
            return btn;
        }
    }

    function createTreeNode(type, text, parent) {
        return {
            type: type,
            text: String(text || ''),
            items: [],
            expanded: true,
            selected: false,
            parent: parent || null,
            add(subType, subText) {
                const child = createTreeNode(subType, subText, this);
                this.items.push(child);
                return child;
            },
            remove(child) {
                const idx = this.items.indexOf(child);
                if (idx !== -1) this.items.splice(idx, 1);
            },
            removeAll() {
                this.items = [];
            }
        };
    }

    class TreeView extends UIElement {
        constructor(text, container, properties) {
            super('treeview', text, container, properties);
            this.items = [];
            this._selection = null;
        }

        get selection() {
            return this._selection;
        }

        set selection(val) {
            this._selection = val;
            if (this.onChange) this.onChange();
        }

        add(type, text) {
            const node = createTreeNode(type, text, this);
            this.items.push(node);
            return node;
        }

        remove(child) {
            const idx = this.items.indexOf(child);
            if (idx !== -1) this.items.splice(idx, 1);
        }

        removeAll() {
            this.items = [];
            this._selection = null;
            if (this.domElement) this.domElement.innerHTML = '';
        }

        renderDOM() {
            const container = document.createElement('div');
            container.className = 'scriptui-treeview';
            container.style.border = '1px solid #333';
            container.style.borderRadius = '3px';
            container.style.padding = '4px';
            container.style.maxHeight = '120px';
            container.style.overflowY = 'auto';
            container.style.background = '#181818';
            container.style.color = '#ccc';
            container.style.fontSize = '11px';

            const renderNodes = (list, parentEl, depth) => {
                list.forEach(item => {
                    const row = document.createElement('div');
                    row.style.padding = '2px 4px 2px ' + (depth * 14 + 4) + 'px';
                    row.style.cursor = 'pointer';
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.gap = '4px';

                    const icon = document.createElement('span');
                    icon.textContent = item.type === 'node' ? '📁' : '📄';
                    row.appendChild(icon);

                    const label = document.createElement('span');
                    label.textContent = item.text;
                    row.appendChild(label);

                    row.onclick = (e) => {
                        e.stopPropagation();
                        this._selection = item;
                        Array.from(container.querySelectorAll('.scriptui-tree-row')).forEach(r => r.style.background = 'transparent');
                        row.style.background = 'rgba(77, 136, 255, 0.35)';
                        if (this.onChange) this.onChange();
                    };
                    row.className = 'scriptui-tree-row';
                    parentEl.appendChild(row);

                    if (item.items && item.items.length > 0) {
                        renderNodes(item.items, parentEl, depth + 1);
                    }
                });
            };

            renderNodes(this.items, container, 0);
            this.domElement = container;
            return container;
        }
    }

    // -------------------------------------------------------------
    // Window: Floating / Dockable Panel (Real After Effects Behavior)
    // -------------------------------------------------------------
    class ScriptUIWindow extends UIElement {
        constructor(type = 'palette', title = 'AE Script Panel', bounds = undefined, properties = {}) {
            super('window', title, null, properties);
            this.windowType = type; // 'palette', 'dialog', 'window'
            this.title = title || 'AE Script Panel';
            this.orientation = 'column';
            this.spacing = 6;
            this.margins = 0;
            this.layout = {
                layout: () => this.updateLayout(),
                resize: () => this.updateLayout()
            };
            this.domWrapper = null;
            this.onClose = null;
            this.onResize = null;
            this.onResizing = null;
            this.isFocused = true;

            // Retain dock state from previous run if user docked/undocked
            this.isDocked = ScriptUIWindow._lastDockState !== false;

            // Dimensions and positions (Default in After Effects: 480x680)
            this._bounds = bounds;
            let initW = 480;
            let initH = 680;
            if (Array.isArray(bounds) && bounds.length >= 4 && (bounds[2] - (bounds[0] || 0)) > 50) {
                initW = Math.max(260, bounds[2] - (bounds[0] || 0));
                initH = Math.max(140, bounds[3] - (bounds[1] || 0));
            } else if (ScriptUIWindow._lastSize && ScriptUIWindow._lastSize.width >= 300) {
                initW = ScriptUIWindow._lastSize.width;
                initH = ScriptUIWindow._lastSize.height || 680;
            }
            this._width = initW;
            this._height = initH;
            this._floatingPos = ScriptUIWindow._lastFloatingPos || null;
        }

        get text() {
            return this.title;
        }

        set text(val) {
            this.title = val;
            if (this.domWrapper) {
                const tabTitle = this.domWrapper.querySelector('.scriptui-tab-title-ae');
                if (tabTitle) tabTitle.textContent = val;
                const floatingTitle = this.domWrapper.querySelector('.scriptui-floating-title-text');
                if (floatingTitle) floatingTitle.textContent = val;
            }
        }

        get size() {
            if (this.domWrapper) {
                const rect = this.domWrapper.getBoundingClientRect();
                return [rect.width, rect.height];
            }
            return [this._width || 480, this._height || 680];
        }

        set size(val) {
            if (Array.isArray(val) && val.length >= 2) {
                if (val[0] > 0) this._width = Math.max(260, val[0]);
                if (val[1] > 0) this._height = Math.max(140, val[1]);
                if (this.domWrapper) {
                    if (this._width) this.domWrapper.style.width = this._width + 'px';
                    if (this._height) this.domWrapper.style.height = this._height + 'px';
                }
                if (this._width && this._height) {
                    ScriptUIWindow._lastSize = { width: this._width, height: this._height };
                }
                if (typeof this.onResize === 'function') {
                    try { this.onResize(); } catch (e) {}
                }
            }
        }

        get bounds() {
            if (this.domWrapper) {
                const rect = this.domWrapper.getBoundingClientRect();
                return [rect.left, rect.top, rect.right, rect.bottom];
            }
            return [0, 0, this._width || 480, this._height || 680];
        }

        set bounds(val) {
            if (Array.isArray(val) && val.length >= 4) {
                this.location = [val[0], val[1]];
                this.size = [val[2] - val[0], val[3] - val[1]];
            }
        }

        get location() {
            if (this.domWrapper) {
                const rect = this.domWrapper.getBoundingClientRect();
                return [rect.left, rect.top];
            }
            if (this._floatingPos) return [this._floatingPos.left, this._floatingPos.top];
            return [0, 0];
        }

        set location(val) {
            if (Array.isArray(val) && val.length >= 2) {
                this._floatingPos = { left: val[0], top: val[1] };
                ScriptUIWindow._lastFloatingPos = this._floatingPos;
                if (this.domWrapper && !this.isDocked) {
                    this.domWrapper.style.left = val[0] + 'px';
                    this.domWrapper.style.top = val[1] + 'px';
                }
            }
        }

        setFocus(val) {
            this.isFocused = Boolean(val);
            if (this.domWrapper) {
                this.domWrapper.classList.toggle('is-focused', this.isFocused);
            }
        }

        center() {
            if (!this.isDocked && this.domWrapper) {
                this.centerFloating();
            }
        }

        centerFloating() {
            if (!this.domWrapper) return;
            const w = this._width || 480;
            const h = this.domWrapper.getBoundingClientRect().height || this._height || 680;
            const left = Math.max(20, Math.round((window.innerWidth - w) / 2));
            const top = Math.max(50, Math.round((window.innerHeight - h) / 2));
            this.domWrapper.style.left = left + 'px';
            this.domWrapper.style.top = top + 'px';
            this._floatingPos = { left, top };
            ScriptUIWindow._lastFloatingPos = this._floatingPos;
        }

        resetSize() {
            this._width = 480;
            this._height = 680;
            if (this.domWrapper) {
                this.domWrapper.style.width = '480px';
                this.domWrapper.style.height = '680px';
            }
            ScriptUIWindow._lastSize = { width: 480, height: 680 };
            if (typeof this.onResize === 'function') {
                try { this.onResize(); } catch (e) {}
            }
        }

        close() {
            if (typeof this.onClose === 'function') {
                try { this.onClose(); } catch (err) { console.warn(err); }
            }
            if (this.domWrapper && this.domWrapper.parentNode) {
                this.domWrapper.parentNode.removeChild(this.domWrapper);
            }
            this.domWrapper = null;
            if (ScriptUIWindow.activeWindow === this) {
                ScriptUIWindow.activeWindow = null;
            }
            const host = document.getElementById('scriptui-dock-host');
            if (host && !host.querySelector('.scriptui-window-container')) {
                host.innerHTML = '<div style="color: #888; font-size: 12px; text-align: center; margin-top: 40px;">ScriptUI window closed. Run a script to reopen.</div>';
            }
            const tabScriptUI = document.getElementById('tab-scriptui');
            if (tabScriptUI) {
                tabScriptUI.textContent = 'ScriptUI Panel Preview';
            }
        }

        dock(initial = false) {
            this.isDocked = true;
            ScriptUIWindow._lastDockState = true;
            const winDiv = this.domWrapper;
            if (!winDiv) return;

            winDiv.classList.remove('scriptui-floating');
            winDiv.style.position = '';
            winDiv.style.left = '';
            winDiv.style.top = '';
            winDiv.style.zIndex = '';
            winDiv.style.maxHeight = '';

            const host = document.getElementById('scriptui-dock-host');
            if (host) {
                host.innerHTML = '';
                host.appendChild(winDiv);
            }

            // Update menu text
            const dockMenuBtn = winDiv.querySelector('.scriptui-menu-dock-btn');
            if (dockMenuBtn) dockMenuBtn.textContent = 'Undock Panel';

            const tabScriptUI = document.getElementById('tab-scriptui');
            if (tabScriptUI) tabScriptUI.textContent = 'ScriptUI Panel Preview';

            this.setFocus(true);
            if (!initial && typeof this.onResize === 'function') {
                try { this.onResize(); } catch (e) {}
            }
        }

        undock(initial = false) {
            this.isDocked = false;
            ScriptUIWindow._lastDockState = false;
            const winDiv = this.domWrapper;
            if (!winDiv) return;

            winDiv.classList.add('scriptui-floating');
            document.body.appendChild(winDiv);

            // Compute floating position
            if (!this._floatingPos) {
                const editorPanel = document.getElementById('ae-editor-panel');
                const rect = editorPanel ? editorPanel.getBoundingClientRect() : { left: window.innerWidth - 500, top: 60 };
                const left = Math.max(20, Math.min(window.innerWidth - 500, Math.round(rect.left + 20)));
                const top = Math.max(50, Math.min(window.innerHeight - 700, Math.round(rect.top + 20)));
                this._floatingPos = { left, top };
            }
            winDiv.style.position = 'fixed';
            winDiv.style.zIndex = '10000';
            winDiv.style.left = this._floatingPos.left + 'px';
            winDiv.style.top = this._floatingPos.top + 'px';
            winDiv.style.maxHeight = 'calc(100vh - 40px)';
            ScriptUIWindow._lastFloatingPos = this._floatingPos;

            // Render dock placeholder in #scriptui-dock-host
            const host = document.getElementById('scriptui-dock-host');
            if (host) {
                host.innerHTML = `
                    <div class="scriptui-undocked-placeholder">
                        <div class="scriptui-placeholder-icon">
                            <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h6a1.5 1.5 0 0 1 1.5 1.5V5h-1V2.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5H6v1H3a1.5 1.5 0 0 1-1.5-1.5v-10z"/>
                                <path d="M11 6a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V7.207l-4.146 4.147a.5.5 0 0 1-.708-.708L14.293 6.5H11.5A.5.5 0 0 1 11 6z"/>
                            </svg>
                        </div>
                        <div class="scriptui-placeholder-title">${this.title} is Floating</div>
                        <div class="scriptui-placeholder-desc">The ScriptUI window is undocked and active over your workspace. You can edit code, inspect layers, and test the tool simultaneously.</div>
                        <div class="scriptui-placeholder-actions">
                            <button class="ae-btn ae-btn-primary scriptui-redock-btn" type="button">⇲ Dock Panel Back</button>
                            <button class="ae-btn scriptui-center-btn" type="button">Center Window</button>
                        </div>
                    </div>
                `;
                const btnRedock = host.querySelector('.scriptui-redock-btn');
                if (btnRedock) btnRedock.onclick = () => this.dock();
                const btnCenter = host.querySelector('.scriptui-center-btn');
                if (btnCenter) btnCenter.onclick = () => this.centerFloating();
            }

            // Update menu text
            const dockMenuBtn = winDiv.querySelector('.scriptui-menu-dock-btn');
            if (dockMenuBtn) dockMenuBtn.textContent = 'Dock Panel';

            const tabScriptUI = document.getElementById('tab-scriptui');
            if (tabScriptUI) tabScriptUI.textContent = 'ScriptUI Panel Preview (Floating)';

            this.setFocus(true);
            if (!initial && typeof this.onResize === 'function') {
                try { this.onResize(); } catch (e) {}
            }
        }

        toggleDock() {
            if (this.isDocked) this.undock();
            else this.dock();
        }

        _setupWindowEvents(winDiv, titlebar, tabBar, rCorner, rRight, rBottom) {
            const hamburgerBtn = tabBar.querySelector('.scriptui-hamburger-btn');
            const menu = tabBar.querySelector('.scriptui-panel-menu');
            const closeBtnOS = titlebar.querySelector('.scriptui-floating-close-btn');

            if (closeBtnOS) {
                closeBtnOS.onclick = (e) => {
                    e.stopPropagation();
                    this.close();
                };
            }

            // Hamburger Context Menu Toggle (Matches image_2.png)
            if (hamburgerBtn && menu) {
                hamburgerBtn.onclick = (e) => {
                    e.stopPropagation();
                    const isVisible = menu.style.display !== 'none';
                    menu.style.display = isVisible ? 'none' : 'block';
                    const dockItem = menu.querySelector('.scriptui-menu-dock-btn');
                    if (dockItem) {
                        dockItem.textContent = this.isDocked ? 'Undock Panel' : 'Dock Panel';
                    }
                };

                // Menu items
                menu.querySelectorAll('.scriptui-menu-item').forEach(item => {
                    item.onclick = (e) => {
                        e.stopPropagation();
                        if (item.classList.contains('disabled')) return;
                        menu.style.display = 'none';
                        const action = item.getAttribute('data-action');
                        if (action === 'close') {
                            this.close();
                        } else if (action === 'dock') {
                            this.toggleDock();
                        }
                    };
                });
            }

            // Global click: close menu when clicking outside & handle focus outline
            const onDocPointerDown = (e) => {
                if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && e.target !== hamburgerBtn) {
                    menu.style.display = 'none';
                }
                if (winDiv && winDiv.parentNode) {
                    if (winDiv.contains(e.target)) {
                        this.setFocus(true);
                    } else {
                        this.setFocus(false);
                    }
                }
            };
            document.addEventListener('pointerdown', onDocPointerDown);

            // Double click tab bar to toggle dock / undock
            tabBar.ondblclick = (e) => {
                if (!e.target.closest('.scriptui-hamburger-btn') && !e.target.closest('.scriptui-panel-menu')) {
                    this.toggleDock();
                }
            };

            // Resizing logic for Corner, Right Edge, and Bottom Edge (ONLY active when undocked)
            const initResizer = (resizerEl, mode) => {
                resizerEl.addEventListener('pointerdown', (e) => {
                    if (this.isDocked) return;
                    e.preventDefault();
                    e.stopPropagation();
                    this.setFocus(true);
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const winRect = winDiv.getBoundingClientRect();
                    const startW = winRect.width;
                    const startH = winRect.height;

                    const onPointerMove = (ev) => {
                        if (mode === 'corner' || mode === 'right') {
                            const newW = Math.max(260, Math.min(window.innerWidth - 20, Math.round(startW + (ev.clientX - startX))));
                            winDiv.style.width = newW + 'px';
                            this._width = newW;
                        }
                        if (mode === 'corner' || mode === 'bottom') {
                            const newH = Math.max(140, Math.min(window.innerHeight - 20, Math.round(startH + (ev.clientY - startY))));
                            winDiv.style.height = newH + 'px';
                            this._height = newH;
                        }
                        ScriptUIWindow._lastSize = { width: this._width, height: this._height };
                        if (typeof this.onResizing === 'function') {
                            try { this.onResizing(); } catch (err) {}
                        }
                    };

                    const onPointerUp = () => {
                        document.removeEventListener('pointermove', onPointerMove);
                        document.removeEventListener('pointerup', onPointerUp);
                        document.removeEventListener('pointercancel', onPointerUp);
                        if (typeof this.onResize === 'function') {
                            try { this.onResize(); } catch (err) {}
                        }
                    };

                    document.addEventListener('pointermove', onPointerMove);
                    document.addEventListener('pointerup', onPointerUp);
                    document.addEventListener('pointercancel', onPointerUp);
                });
            };

            initResizer(rCorner, 'corner');
            initResizer(rRight, 'right');
            initResizer(rBottom, 'bottom');

            // Dragging logic on Floating Titlebar & Tab Bar (Draggable floating window + Drag-to-undock / Drag-to-dock)
            const initDrag = (dragEl) => {
                dragEl.addEventListener('pointerdown', (e) => {
                    if (e.target.closest('.scriptui-hamburger-btn') || e.target.closest('.scriptui-floating-close-btn') || e.target.closest('.scriptui-panel-menu')) return;
                    e.preventDefault();
                    this.setFocus(true);

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startRect = winDiv.getBoundingClientRect();
                    const startLeft = startRect.left;
                    const startTop = startRect.top;
                    let hasDetached = !this.isDocked;
                    let isDragging = false;

                    const dockHost = document.getElementById('scriptui-dock-host');

                    const onPointerMove = (ev) => {
                        const dx = ev.clientX - startX;
                        const dy = ev.clientY - startY;

                        // If docked, tear off into floating after 5px movement
                        if (!hasDetached) {
                            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                                this.undock();
                                hasDetached = true;
                                isDragging = true;
                                winDiv.classList.add('is-dragging');
                                dragEl.classList.add('is-dragging');
                            } else {
                                return;
                            }
                        } else {
                            isDragging = true;
                            winDiv.classList.add('is-dragging');
                            dragEl.classList.add('is-dragging');
                        }

                        const winW = winDiv.offsetWidth || 480;
                        const newLeft = Math.max(20 - winW, Math.min(window.innerWidth - 40, Math.round(startLeft + dx)));
                        const newTop = Math.max(0, Math.min(window.innerHeight - 30, Math.round(startTop + dy)));

                        winDiv.style.left = newLeft + 'px';
                        winDiv.style.top = newTop + 'px';
                        this._floatingPos = { left: newLeft, top: newTop };
                        ScriptUIWindow._lastFloatingPos = this._floatingPos;

                        // Highlight dock drop zone if hovering over dock host
                        if (dockHost) {
                            const dockRect = dockHost.getBoundingClientRect();
                            const isOverDock = (ev.clientX >= dockRect.left && ev.clientX <= dockRect.right &&
                                                ev.clientY >= dockRect.top && ev.clientY <= dockRect.bottom);
                            dockHost.classList.toggle('drag-over', isOverDock);
                        }
                    };

                    const onPointerUp = (ev) => {
                        document.removeEventListener('pointermove', onPointerMove);
                        document.removeEventListener('pointerup', onPointerUp);
                        document.removeEventListener('pointercancel', onPointerUp);

                        winDiv.classList.remove('is-dragging');
                        dragEl.classList.remove('is-dragging');

                        if (dockHost) {
                            const dockRect = dockHost.getBoundingClientRect();
                            const isOverDock = (ev.clientX >= dockRect.left && ev.clientX <= dockRect.right &&
                                                ev.clientY >= dockRect.top && ev.clientY <= dockRect.bottom);
                            dockHost.classList.remove('drag-over');

                            // If dropped inside dock host, dock back!
                            if (isOverDock && isDragging) {
                                this.dock();
                            }
                        }
                    };

                    document.addEventListener('pointermove', onPointerMove);
                    document.addEventListener('pointerup', onPointerUp);
                    document.addEventListener('pointercancel', onPointerUp);
                });
            };

            initDrag(titlebar);
            initDrag(tabBar);
        }

        show() {
            // Close any existing active window
            if (ScriptUIWindow.activeWindow && ScriptUIWindow.activeWindow !== this) {
                try { ScriptUIWindow.activeWindow.close(); } catch (eOld) {}
            }
            ScriptUIWindow.activeWindow = this;

            const host = document.getElementById('scriptui-dock-host') || document.body;
            host.innerHTML = '';

            const winDiv = document.createElement('div');
            winDiv.className = 'scriptui-window-container is-focused' + (this.isDocked ? '' : ' scriptui-floating');
            if (this._width) winDiv.style.width = this._width + 'px';
            if (this._height) winDiv.style.height = this._height + 'px';

            // 1. Floating Window OS Titlebar (Shown ONLY when undocked, matches image_4.png)
            const titlebar = document.createElement('div');
            titlebar.className = 'scriptui-floating-titlebar';
            titlebar.innerHTML = `
                <span class="scriptui-floating-title-text" title="${this.title}">${this.title}</span>
                <button class="scriptui-floating-close-btn" type="button" title="Close Panel">&times;</button>
            `;
            winDiv.appendChild(titlebar);

            // 2. Panel Tab Bar (Matches image_2.png and image_4.png)
            const tabBar = document.createElement('div');
            tabBar.className = 'scriptui-tab-bar-ae';
            tabBar.innerHTML = `
                <div class="scriptui-tab-item-ae">
                    <span class="scriptui-tab-title-ae" title="${this.title}">${this.title}</span>
                    <button class="scriptui-hamburger-btn" type="button" title="Panel Menu">
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
                            <rect y="0" width="12" height="1.8" rx="0.5"/>
                            <rect y="4" width="12" height="1.8" rx="0.5"/>
                            <rect y="8" width="12" height="1.8" rx="0.5"/>
                        </svg>
                    </button>
                </div>
                <!-- Context Menu (matches image_2.png) -->
                <div class="scriptui-panel-menu" style="display: none;">
                    <div class="scriptui-menu-item" data-action="close">Close Panel</div>
                    <div class="scriptui-menu-item scriptui-menu-dock-btn" data-action="dock">${this.isDocked ? 'Undock Panel' : 'Dock Panel'}</div>
                    <div class="scriptui-menu-item disabled">Close Other Panels in Group</div>
                    <div class="scriptui-menu-item disabled">Panel Group Settings <span class="menu-arrow">&#x25B8;</span></div>
                </div>
            `;
            winDiv.appendChild(tabBar);

            // 3. Body Content
            const body = document.createElement('div');
            body.className = 'scriptui-window-body';
            this.applyCommonStyles(body);

            for (const child of this.children) {
                body.appendChild(child.renderDOM());
            }
            winDiv.appendChild(body);

            // 4. Resizers: Corner (Both), Right Edge (Width), Bottom Edge (Height) - only active when undocked
            const rCorner = document.createElement('div');
            rCorner.className = 'scriptui-resizer-corner';
            rCorner.title = 'Drag to resize panel (Width & Height)';
            winDiv.appendChild(rCorner);

            const rRight = document.createElement('div');
            rRight.className = 'scriptui-resizer-right';
            rRight.title = 'Drag to resize width';
            winDiv.appendChild(rRight);

            const rBottom = document.createElement('div');
            rBottom.className = 'scriptui-resizer-bottom';
            rBottom.title = 'Drag to resize height';
            winDiv.appendChild(rBottom);

            this.domWrapper = winDiv;

            // Setup Event Handlers: Dragging, Resizing, Dock/Undock, Buttons, Focus
            this._setupWindowEvents(winDiv, titlebar, tabBar, rCorner, rRight, rBottom);

            // Mount to DOM based on dock state
            if (this.isDocked) {
                this.dock(true);
            } else {
                this.undock(true);
            }

            // Set focus immediately
            this.setFocus(true);

            // Notify app to switch tab if needed (when docked)
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

    // Static variables for remembering state across script re-runs
    ScriptUIWindow.activeWindow = null;
    ScriptUIWindow._lastDockState = true;
    ScriptUIWindow._lastFloatingPos = null;
    ScriptUIWindow._lastSize = { width: 480, height: 680 };

    // ExtendScript ScriptUI Window constructor
    global.Window = ScriptUIWindow;
    global.ScriptUIWindow = ScriptUIWindow;
    global.Panel = Panel;
    global.Group = Group;
    global.TabbedPanel = TabbedPanel;
    global.Tab = Tab;
    global.ListBox = ListBox;
    global.Scrollbar = Scrollbar;
    global.IconButton = IconButton;
    global.TreeView = TreeView;

})(typeof window !== 'undefined' ? window : global);
