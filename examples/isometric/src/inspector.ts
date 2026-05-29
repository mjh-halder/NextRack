import { dia } from '@joint/core';
import IsometricShape from './shapes/isometric-shape';
import { applyShapeFillOpacity } from './nextrack-utils';
import { applyLabelPosition } from './label-position';
import { ShapeRegistry, BUILT_IN_SHAPE_IDS, ShapeDefinition } from './shapes/shape-registry';
import { getPaletteIcon } from './shape-query';
import { PRIMARY_COLORS } from './colors';
import { getCustomFields, getDataType, FieldDefinition } from './schema-registry';
import { getProductsByType, getProduct } from './product-catalog';
import { getCanvas, updateCanvas, CanvasRecord } from './canvas-store';
import { GRID_SIZE } from './theme';
import { carbonIconToString, CarbonIcon } from './icons';
import { getDesignIconEntries, IconCatalogEntry, iconKeepsOriginalColor, IconSource } from './icon-catalog';

/**
 * Mirror of the recognition-surface `nr-icon-color` opt-out on canvas
 * Icon-Shape `<image>` elements. Vendor-coloured icons get the class →
 * style.css suppresses the dark-mode brightness/invert filter for them.
 * Design Icons stay theme-tinted (no class), so black source SVGs render
 * dark in light mode and light in dark mode.
 * Pass `undefined` to clear both selectors (e.g. on icon removal).
 */
function syncIconColorClass(el: dia.Element, source: string | undefined): void {
    const keep = iconKeepsOriginalColor(source as IconSource | undefined);
    const cls = keep ? 'nr-icon-color' : '';
    el.attr('iconImage/class', cls);
    el.attr('iconFlat/class', cls);
}
import OverflowMenuVertical16 from '@carbon/icons/es/overflow-menu--vertical/16.js';
import AlignBoxTopLeft16 from '@carbon/icons/es/align-box--top-left/16.js';
import AlignBoxTopCenter16 from '@carbon/icons/es/align-box--top-center/16.js';
import AlignBoxTopRight16 from '@carbon/icons/es/align-box--top-right/16.js';
import AlignBoxBottomLeft16 from '@carbon/icons/es/align-box--bottom-left/16.js';
import AlignBoxBottomCenter16 from '@carbon/icons/es/align-box--bottom-center/16.js';
import AlignBoxBottomRight16 from '@carbon/icons/es/align-box--bottom-right/16.js';
import AlignBoxMiddleLeft16 from '@carbon/icons/es/align-box--middle-left/16.js';
import AlignBoxMiddleRight16 from '@carbon/icons/es/align-box--middle-right/16.js';
import Add16 from '@carbon/icons/es/add/16.js';
import Subtract16 from '@carbon/icons/es/subtract/16.js';
import Corner16 from '@carbon/icons/es/corner/16.js';
import Select0216 from '@carbon/icons/es/select--02/16.js';
const DEFAULT_ZONE_COLOR = '#0072c3';

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const LABEL_POSITIONS: Record<string, { x: string | number; y: string | number; textAnchor: string }> = {
    'top-left':     { x: 8,              y: 16,             textAnchor: 'start' },
    'top-right':    { x: 'calc(w - 8)',  y: 16,             textAnchor: 'end'   },
    'bottom-left':  { x: 8,              y: 'calc(h - 6)',  textAnchor: 'start' },
    'bottom-right': { x: 'calc(w - 8)', y: 'calc(h - 6)', textAnchor: 'end'   },
};

export const BADGE_POSITIONS: Record<string, { groupTransform: string; textAnchor: string }> = {
    'top-left':     { groupTransform: 'translate(0, 0)',                      textAnchor: 'start' },
    'top-right':    { groupTransform: 'translate(calc(w - 100), 0)',          textAnchor: 'start' },
    'bottom-left':  { groupTransform: 'translate(0, calc(h - 18))',          textAnchor: 'start' },
    'bottom-right': { groupTransform: 'translate(calc(w - 100), calc(h - 18))', textAnchor: 'start' },
};

const BADGE_W = 100;
const BADGE_H = 18;
const BADGE_CHAMFER = 6;

export function badgeChamferPath(badgePos: string): string {
    const w = BADGE_W;
    const h = BADGE_H;
    const c = BADGE_CHAMFER;
    switch (badgePos) {
        case 'bottom-right': return `M ${c} 0 L ${w} 0 L ${w} ${h} L 0 ${h} L 0 ${c} Z`;
        case 'bottom-left':  return `M 0 0 L ${w - c} 0 L ${w} ${c} L ${w} ${h} L 0 ${h} Z`;
        case 'top-right':    return `M 0 0 L ${w} 0 L ${w} ${h} L ${c} ${h} L 0 ${h - c} Z`;
        case 'top-left':     return `M 0 0 L ${w} 0 L ${w} ${h - c} L ${w - c} ${h} L 0 ${h} Z`;
        default:             return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    }
}

// --- Icon standing transform ---

type IconFace = 'front' | 'side';

function applyIconStanding(el: dia.Element, standing: boolean): void {
    if (standing) {
        const face = (el.get('iconFace') as IconFace) || 'front';
        applyIconFaceTransform(el, face);
    } else {
        el.attr('iconImage/transform', null);
    }
}

function applyIconFaceTransform(el: dia.Element, face: IconFace): void {
    const { width: w, height: h } = el.size();
    const iH = (el.get('isometricHeight') as number) || 0;
    const cx = w / 2;
    const cy = h / 2;
    const ox = (el.get('iconOffsetX') as number) ?? 0.22;
    const oy = (el.get('iconOffsetY') as number) ?? -0.22;
    const tx = ox * h;
    const ty = oy * h;
    if (face === 'side') {
        el.attr('iconImage/transform', `translate(${-tx},${-ty}) matrix(0,1,-1,-1,${w},0) rotate(180,${cx},${cy})`);
    } else {
        // Non-mirroring front-face placement (det = +1).
        el.attr('iconImage/transform', `translate(${tx},${ty}) matrix(1,0,1,1,${-iH},${h - iH})`);
    }
}

// --- Node metadata ---

export interface NodeMeta {
    name: string;
    shapeType: string;
    [key: string]: unknown;
}

export const META_KEY = 'meta';

const EMPTY_NODE_META: NodeMeta = { name: '', shapeType: '' };

// --- Link metadata ---

export interface LinkMeta {
    linkType: string;
    bandwidth: string;
    medium: string;
    encryption: string;
}

export const LINK_META_KEY = 'linkMeta';

const EMPTY_LINK_META: LinkMeta = { linkType: '', bandwidth: '', medium: '', encryption: '' };

const LINK_TYPE_OPTIONS = ['Host Access', 'Cluster Link'];

const LINK_FIELDS: { key: keyof LinkMeta; label: string; placeholder: string }[] = [
    { key: 'bandwidth',  label: 'Bandwidth',  placeholder: 'e.g. 10Gbps'  },
    { key: 'medium',     label: 'Medium',     placeholder: 'e.g. fiber'   },
    { key: 'encryption', label: 'Encryption', placeholder: 'e.g. TLS'     },
];


// --- Panel ---

export interface PanelActions {
    onDelete: () => void;
    onDuplicate: () => void;
    onDuplicateZone: (frame: dia.Element) => void;
}

export class PropertyPanel {

    /** Set by the System Designer after paper init. Used to look up cell views
     *  (e.g. for applyShapeFillOpacity). */
    public paper?: dia.Paper;

    private el: HTMLElement;
    private titleEl: HTMLElement;
    private titleTextEl: HTMLElement;

    private nodeSection: HTMLElement;
    private zoneSection: HTMLElement;
    private linkSection: HTMLElement;
    private duplicateBtn: HTMLButtonElement;
    private duplicateZoneBtn: HTMLButtonElement;
    private deleteBtn: HTMLButtonElement;
    private overflowBtn: HTMLButtonElement;
    private overflowMenu: HTMLElement;

    private currentNode: IsometricShape | null = null;
    private currentLink: dia.Link | null = null;
    private currentZone: dia.Element | null = null;
    private currentLayerId: string | null = null;

    private areaSection!: HTMLElement;
    private labelSection!: HTMLElement;
    private iconSection!: HTMLElement;
    private layerSection!: HTMLElement;
    private multiZoneSection!: HTMLElement;
    private multiZoneWidthInput!: HTMLInputElement;
    private multiZoneHeightInput!: HTMLInputElement;
    private multiZoneTargets: dia.Element[] = [];
    private multiLinkExtras: dia.Link[] = [];
    private multiLinkDetach: (() => void) | null = null;
    // Detacher for the per-Area `change:areaCorners` sync handler — keeps
    // the corner steppers in sync when on-canvas radius handles are dragged.
    private areaCornerSyncCleanup: (() => void) | null = null;

    private nodeInputs: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};
    private nodeLabelHiddenEl!: HTMLInputElement;
    private nodeCustomContainer!: HTMLElement;
    private nodeCustomInputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
    private zoneNameInput!: HTMLInputElement;
    private zoneCustomContainer!: HTMLElement;
    private zoneCustomInputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
    private selectedZoneColor = DEFAULT_ZONE_COLOR;
    private zoneLabelPosValue = 'top-left';
    private zoneLabelHidden = false;
    private zoneBorderStyleSelect!: HTMLSelectElement;
    private zoneBadgePosValue = 'top-right';
    private zoneClusterNameInput!: HTMLInputElement;
    private zoneNotesInput!: HTMLTextAreaElement;
    private linkTypeSelect!: HTMLSelectElement;
    private linkInputs = {} as Record<keyof LinkMeta, HTMLInputElement>;
    private linkCustomContainer!: HTMLElement;
    private linkCustomInputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
    private linkNotesInput!: HTMLTextAreaElement;

    constructor(el: HTMLElement, private actions: PanelActions) {
        this.el = el;
        this.build();
        this.hide();
    }

    private build() {
        this.titleEl = document.createElement('div');
        this.titleEl.className = 'inspector-title';

        this.titleTextEl = document.createElement('span');
        this.titleTextEl.className = 'inspector-title__text';
        this.titleEl.appendChild(this.titleTextEl);

        this.overflowBtn = document.createElement('button');
        this.overflowBtn.className = 'inspector-overflow-btn';
        this.overflowBtn.setAttribute('aria-label', 'Actions');
        this.overflowBtn.innerHTML = carbonIconToString(OverflowMenuVertical16 as CarbonIcon);
        this.titleEl.appendChild(this.overflowBtn);

        this.overflowMenu = document.createElement('ul');
        this.overflowMenu.className = 'inspector-overflow-menu';
        this.overflowMenu.setAttribute('role', 'menu');
        this.titleEl.appendChild(this.overflowMenu);

        this.overflowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = this.overflowMenu.classList.toggle('inspector-overflow-menu--open');
            this.overflowBtn.classList.toggle('inspector-overflow-btn--active', open);
        });

        document.addEventListener('click', () => {
            this.overflowMenu.classList.remove('inspector-overflow-menu--open');
            this.overflowBtn.classList.remove('inspector-overflow-btn--active');
        });

        this.el.appendChild(this.titleEl);

        // ---- Node section (rebuilt dynamically per componentType in show()) ----
        this.nodeSection = document.createElement('div');
        this.nodeSection.className = 'inspector-section';
        this.el.appendChild(this.nodeSection);

        // ---- Zone section (rebuilt dynamically in showZone()) ----
        this.zoneSection = document.createElement('div');
        this.zoneSection.className = 'inspector-section';
        this.el.appendChild(this.zoneSection);

        // ---- Link section (rebuilt dynamically in showLink()) ----
        this.linkSection = document.createElement('div');
        this.linkSection.className = 'inspector-section';
        this.el.appendChild(this.linkSection);

        // ---- Area section (rebuilt dynamically in showArea()) ----
        this.areaSection = document.createElement('div');
        this.areaSection.className = 'inspector-section';
        this.el.appendChild(this.areaSection);

        // ---- Label section (rebuilt dynamically in showLabel()) ----
        this.labelSection = document.createElement('div');
        this.labelSection.className = 'inspector-section';
        this.el.appendChild(this.labelSection);

        // ---- Icon section (rebuilt dynamically in showIcon()) ----
        this.iconSection = document.createElement('div');
        this.iconSection.className = 'inspector-section';
        this.el.appendChild(this.iconSection);

        // ---- Layer section (rebuilt dynamically in showLayer()) ----
        this.layerSection = document.createElement('div');
        this.layerSection.className = 'inspector-section';
        this.el.appendChild(this.layerSection);

        // ---- Multi-zone section ----
        this.multiZoneSection = document.createElement('div');
        this.multiZoneSection.className = 'inspector-section';

        const mzWidthRow = this.buildRow('mz-width', 'Width (grid units)', 'Width');
        this.multiZoneWidthInput = mzWidthRow.input as HTMLInputElement;
        this.multiZoneWidthInput.type = 'number';
        this.multiZoneWidthInput.min = '1';
        this.multiZoneWidthInput.addEventListener('input', () => this.applyMultiZoneSize());
        this.multiZoneSection.appendChild(mzWidthRow.row);

        const mzHeightRow = this.buildRow('mz-height', 'Height (grid units)', 'Height');
        this.multiZoneHeightInput = mzHeightRow.input as HTMLInputElement;
        this.multiZoneHeightInput.type = 'number';
        this.multiZoneHeightInput.min = '1';
        this.multiZoneHeightInput.addEventListener('input', () => this.applyMultiZoneSize());
        this.multiZoneSection.appendChild(mzHeightRow.row);

        this.el.appendChild(this.multiZoneSection);

        // Action items inside the overflow menu
        const dupLi = document.createElement('li');
        dupLi.setAttribute('role', 'menuitem');
        dupLi.className = 'inspector-overflow-menu__item';
        this.duplicateBtn = document.createElement('button');
        this.duplicateBtn.className = 'inspector-overflow-menu__btn';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateBtn.addEventListener('click', () => {
            this.closeOverflowMenu();
            this.actions.onDuplicate();
        });
        dupLi.appendChild(this.duplicateBtn);
        this.overflowMenu.appendChild(dupLi);

        const dupZoneLi = document.createElement('li');
        dupZoneLi.setAttribute('role', 'menuitem');
        dupZoneLi.className = 'inspector-overflow-menu__item';
        this.duplicateZoneBtn = document.createElement('button');
        this.duplicateZoneBtn.className = 'inspector-overflow-menu__btn';
        this.duplicateZoneBtn.textContent = 'Duplicate Zone';
        this.duplicateZoneBtn.addEventListener('click', () => {
            this.closeOverflowMenu();
            if (this.currentZone) this.actions.onDuplicateZone(this.currentZone);
        });
        dupZoneLi.appendChild(this.duplicateZoneBtn);
        this.overflowMenu.appendChild(dupZoneLi);

        const delLi = document.createElement('li');
        delLi.setAttribute('role', 'menuitem');
        delLi.className = 'inspector-overflow-menu__item inspector-overflow-menu__item--danger';
        this.deleteBtn = document.createElement('button');
        this.deleteBtn.className = 'inspector-overflow-menu__btn inspector-overflow-menu__btn--danger';
        this.deleteBtn.textContent = 'Delete';
        this.deleteBtn.addEventListener('click', () => {
            this.closeOverflowMenu();
            if (this.currentZone) {
                this.currentZone.remove();
                this.hide();
            } else {
                this.actions.onDelete();
            }
        });
        delLi.appendChild(this.deleteBtn);
        this.overflowMenu.appendChild(delLi);
    }

    private buildAccordionSection(title: string): { li: HTMLLIElement; body: HTMLDivElement } {
        const li = document.createElement('li') as HTMLLIElement;
        li.className = 'cds--accordion__item cds--accordion__item--active';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cds--accordion__heading';
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = `<svg class="cds--accordion__arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z"/></svg><div class="cds--accordion__title">${title}</div>`;
        li.appendChild(btn);
        const body = document.createElement('div');
        body.className = 'cds--accordion__content';
        li.appendChild(body);
        btn.addEventListener('click', () => {
            const active = li.classList.toggle('cds--accordion__item--active');
            btn.setAttribute('aria-expanded', String(active));
        });
        return { li, body };
    }

    private buildTabBar(panels: Array<{ label: string; panel: HTMLElement }>): HTMLElement {
        const tabs = document.createElement('div');
        tabs.className = 'nr-cd-tabs';
        const buttons: HTMLButtonElement[] = [];
        panels.forEach(({ label, panel }, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-cd-tabs__btn' + (i === 0 ? ' nr-cd-tabs__btn--active' : '');
            btn.textContent = label;
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('nr-cd-tabs__btn--active'));
                btn.classList.add('nr-cd-tabs__btn--active');
                panels.forEach(p => { p.panel.style.display = 'none'; });
                panel.style.display = '';
            });
            tabs.appendChild(btn);
            buttons.push(btn);
            panel.style.display = i === 0 ? '' : 'none';
        });
        return tabs;
    }

    private buildColorPicker(initialColor: string, onChange: (color: string) => void): HTMLElement {
        const hexWrap = document.createElement('div');
        hexWrap.className = 'nr-sd-hex-input-wrap';
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'nr-sd-hex-input';
        hexInput.readOnly = true;
        hexInput.style.cursor = 'pointer';
        hexInput.value = initialColor;
        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'nr-sd-hex-color-btn';
        colorBtn.style.backgroundColor = initialColor;
        const popup = document.createElement('div');
        popup.className = 'nr-sd-color-popup';
        popup.style.display = 'none';
        for (const c of PRIMARY_COLORS) {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'nr-sd-color-popup__swatch';
            swatch.style.backgroundColor = c.base;
            swatch.title = c.label;
            swatch.addEventListener('click', () => {
                hexInput.value = c.base;
                colorBtn.style.backgroundColor = c.base;
                popup.style.display = 'none';
                onChange(c.base);
            });
            popup.appendChild(swatch);
        }
        const hiddenPicker = document.createElement('input');
        hiddenPicker.type = 'color';
        hiddenPicker.className = 'nr-sd-hex-hidden-picker';
        hiddenPicker.value = initialColor;
        const customSwatch = document.createElement('button');
        customSwatch.type = 'button';
        customSwatch.className = 'nr-sd-color-popup__swatch nr-sd-color-popup__swatch--custom';
        customSwatch.title = 'Custom color';
        customSwatch.innerHTML = '<svg viewBox="0 0 32 32" fill="currentColor" width="12" height="12"><path d="M29.391,2.609a3.279,3.279,0,0,0-4.634,0L18.4835,8.883,12.793,3.207,11.3789,4.6211l4.2764,4.2764L2.4072,22.146A.9967.9967,0,0,0,2.1,22.78L.042,29.0361a1,1,0,0,0,1.265,1.2637l6.2549-2.0586a.9974.9974,0,0,0,.6348-.3076L21.4453,14.6855l4.2764,4.2764,1.4141-1.4141L21.4116,11.8237l6.2744-6.2744.0051-.0051a3.2781,3.2781,0,0,0,0-4.634ZM6.8965,27.0017l-4.3384,1.4275L3.985,24.0908ZM28.2808,5.8281l-.0051.0051L21.9316,12.177l-.707-.707,6.3491-6.3491a1.2783,1.2783,0,0,1,1.806,0h0a1.2776,1.2776,0,0,1-.0977,1.7071Z"/></svg>';
        customSwatch.addEventListener('click', () => { popup.style.display = 'none'; hiddenPicker.click(); });
        popup.appendChild(customSwatch);
        hiddenPicker.addEventListener('input', () => {
            hexInput.value = hiddenPicker.value;
            colorBtn.style.backgroundColor = hiddenPicker.value;
            onChange(hiddenPicker.value);
        });
        colorBtn.addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? '' : 'none'; });
        hexInput.addEventListener('click', () => { colorBtn.click(); });
        document.addEventListener('mousedown', (e) => { if (!hexWrap.contains(e.target as Node)) popup.style.display = 'none'; });
        hexWrap.appendChild(hexInput);
        hexWrap.appendChild(colorBtn);
        hexWrap.appendChild(hiddenPicker);
        hexWrap.appendChild(popup);
        return hexWrap;
    }

    private closeOverflowMenu() {
        this.overflowMenu.classList.remove('inspector-overflow-menu--open');
        this.overflowBtn.classList.remove('inspector-overflow-btn--active');
    }

    private buildRow(id: string, labelText: string, placeholder: string, multiline = false) {
        const row = document.createElement('div');
        row.className = 'inspector-row';

        const label = document.createElement('label');
        label.textContent = labelText;
        label.htmlFor = `inspector-${id}`;
        row.appendChild(label);

        let input: HTMLInputElement | HTMLTextAreaElement;
        if (multiline) {
            input = document.createElement('textarea');
            (input as HTMLTextAreaElement).rows = 3;
        } else {
            input = document.createElement('input');
            (input as HTMLInputElement).type = 'text';
        }
        input.id = `inspector-${id}`;
        input.placeholder = placeholder;
        row.appendChild(input);

        return { row, input };
    }

    private buildAreaLabelPositionRow(el: dia.Element): HTMLElement {
        const toIcon14 = (icon: CarbonIcon) => carbonIconToString(icon).replace('width="16"', 'width="14"').replace('height="16"', 'height="14"');
        const positions: { value: string; label: string; icon: string; col: number; row: number }[] = [
            { value: 'top-left',      label: 'Top Left',      icon: toIcon14(AlignBoxTopLeft16 as CarbonIcon),      col: 0, row: 0 },
            { value: 'top-center',    label: 'Top Center',    icon: toIcon14(AlignBoxTopCenter16 as CarbonIcon),    col: 1, row: 0 },
            { value: 'top-right',     label: 'Top Right',     icon: toIcon14(AlignBoxTopRight16 as CarbonIcon),     col: 2, row: 0 },
            { value: 'middle-left',   label: 'Middle Left',   icon: toIcon14(AlignBoxMiddleLeft16 as CarbonIcon),   col: 0, row: 1 },
            { value: 'middle-right',  label: 'Middle Right',  icon: toIcon14(AlignBoxMiddleRight16 as CarbonIcon),  col: 2, row: 1 },
            { value: 'bottom-left',   label: 'Bottom Left',   icon: toIcon14(AlignBoxBottomLeft16 as CarbonIcon),   col: 0, row: 2 },
            { value: 'bottom-center', label: 'Bottom Center', icon: toIcon14(AlignBoxBottomCenter16 as CarbonIcon), col: 1, row: 2 },
            { value: 'bottom-right',  label: 'Bottom Right',  icon: toIcon14(AlignBoxBottomRight16 as CarbonIcon),  col: 2, row: 2 },
        ];
        const HIDE_ICON = '<svg viewBox="0 0 32 32" fill="currentColor" width="14" height="14"><path d="M2,16A14,14,0,1,0,16,2,14,14,0,0,0,2,16Zm23.15,7.75L8.25,6.85a12,12,0,0,1,16.9,16.9ZM8.24,25.16A12,12,0,0,1,6.84,8.27L23.73,25.16a12,12,0,0,1-15.49,0Z"/></svg>';

        const currentPos = (el.get('labelPosition') as string) ||
            (el.attr('label/display') === 'none' ? 'none' : 'none');

        const curEntry = positions.find(p => p.value === currentPos);
        const curIcon = curEntry ? curEntry.icon : HIDE_ICON;
        const curLabel = curEntry ? curEntry.label : 'Hidden';

        const row = document.createElement('div');
        row.className = 'inspector-row';
        row.style.position = 'relative';
        const lbl = document.createElement('label');
        lbl.textContent = 'Label Position';
        row.appendChild(lbl);

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'nr-marker-picker-btn';
        trigger.style.flex = '0 0 160px';
        trigger.style.width = '160px';
        trigger.style.justifyContent = 'flex-start';
        trigger.style.gap = '6px';
        trigger.style.padding = '0 8px';
        trigger.innerHTML = `${curIcon}<span style="font-size:0.75rem">${curLabel}</span>`;

        const popup = document.createElement('div');
        popup.className = 'nr-label-pos-popup';
        popup.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'nr-label-pos-grid';

        const applyPos = (value: string) => {
            const pos = positions.find(p => p.value === value);
            el.set('labelPosition', value);
            if (value === 'none') {
                el.attr('label/display', 'none');
                trigger.innerHTML = `${HIDE_ICON}<span style="font-size:0.75rem">Hidden</span>`;
            } else {
                el.attr('label/display', null);
                switch (value) {
                    case 'top-left':
                        el.attr({ label: { x: 8, y: 16, textAnchor: 'start' } }); break;
                    case 'top-center':
                        el.attr({ label: { x: 'calc(w / 2)', y: 16, textAnchor: 'middle' } }); break;
                    case 'top-right':
                        el.attr({ label: { x: 'calc(w - 8)', y: 16, textAnchor: 'end' } }); break;
                    case 'middle-left':
                        el.attr({ label: { x: 8, y: 'calc(h / 2)', textAnchor: 'start' } }); break;
                    case 'middle-right':
                        el.attr({ label: { x: 'calc(w - 8)', y: 'calc(h / 2)', textAnchor: 'end' } }); break;
                    case 'bottom-left':
                        el.attr({ label: { x: 8, y: 'calc(h - 6)', textAnchor: 'start' } }); break;
                    case 'bottom-center':
                        el.attr({ label: { x: 'calc(w / 2)', y: 'calc(h - 6)', textAnchor: 'middle' } }); break;
                    case 'bottom-right':
                        el.attr({ label: { x: 'calc(w - 8)', y: 'calc(h - 6)', textAnchor: 'end' } }); break;
                }
                trigger.innerHTML = `${pos!.icon}<span style="font-size:0.75rem">${pos!.label}</span>`;
            }
            grid.querySelectorAll('.nr-label-pos-tile').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
            popup.style.display = 'none';
        };

        for (const pos of positions) {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'nr-label-pos-tile' + (pos.value === currentPos ? ' nr-label-pos-tile--selected' : '');
            tile.title = pos.label;
            tile.innerHTML = pos.icon;
            tile.style.gridColumn = String(pos.col + 1);
            tile.style.gridRow = String(pos.row + 1);
            tile.addEventListener('click', () => {
                grid.querySelectorAll('.nr-label-pos-tile--selected').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
                tile.classList.add('nr-label-pos-tile--selected');
                applyPos(pos.value);
            });
            grid.appendChild(tile);
        }

        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'nr-label-pos-tile' + (currentPos === 'none' ? ' nr-label-pos-tile--selected' : '');
        hideBtn.title = 'Hide Label';
        hideBtn.innerHTML = HIDE_ICON;
        hideBtn.style.gridColumn = '2';
        hideBtn.style.gridRow = '2';
        hideBtn.addEventListener('click', () => {
            grid.querySelectorAll('.nr-label-pos-tile--selected').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
            hideBtn.classList.add('nr-label-pos-tile--selected');
            applyPos('none');
        });
        grid.appendChild(hideBtn);

        popup.appendChild(grid);
        trigger.addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? '' : 'none'; });
        document.addEventListener('mousedown', (e) => { if (!row.contains(e.target as Node)) popup.style.display = 'none'; });

        row.appendChild(trigger);
        row.appendChild(popup);
        return row;
    }

    private buildStepperRow(labelText: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void, defaultValue?: number): { row: HTMLElement; input: HTMLInputElement } {
        const defVal = defaultValue ?? value;
        // Decimal precision derived from `step` so 0.5 renders as "0.5"
        // and 1 renders as "1". Avoids per-call format overrides.
        const decimals = step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
        const fmt  = (v: number) => v.toFixed(decimals);
        const snap = (v: number) => parseFloat(v.toFixed(decimals));
        const row = document.createElement('div');
        row.className = 'inspector-row nr-sd-number-row';
        const label = document.createElement('label');
        label.textContent = labelText;
        row.appendChild(label);

        const stepper = document.createElement('div');
        stepper.className = 'nr-ad__number-stepper';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'nr-ad__number-input';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = fmt(value);

        const displayEl = document.createElement('input');
        displayEl.type = 'text';
        displayEl.className = 'nr-sd-number-display';
        displayEl.value = fmt(value);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'nr-stepper-reset';
        resetBtn.textContent = '\u00d7';
        resetBtn.title = `Reset to ${fmt(defVal)}`;
        resetBtn.style.display = snap(value) === snap(defVal) ? 'none' : '';
        resetBtn.addEventListener('click', () => {
            input.value = fmt(defVal);
            update();
        });

        const decBtn = document.createElement('button');
        decBtn.type = 'button';
        decBtn.className = 'nr-ad__number-btn';
        decBtn.textContent = '\u2212';

        const incBtn = document.createElement('button');
        incBtn.type = 'button';
        incBtn.className = 'nr-ad__number-btn';
        incBtn.textContent = '+';

        const update = () => {
            const v = parseFloat(input.value);
            const clamped = Math.max(min, Math.min(max, isNaN(v) ? min : v));
            input.value = fmt(clamped);
            displayEl.value = fmt(clamped);
            resetBtn.style.display = snap(clamped) === snap(defVal) ? 'none' : '';
            onChange(clamped);
        };

        decBtn.addEventListener('click', () => { input.value = fmt(Math.max(min, parseFloat(input.value) - step)); update(); });
        incBtn.addEventListener('click', () => { input.value = fmt(Math.min(max, parseFloat(input.value) + step)); update(); });
        displayEl.addEventListener('change', () => {
            const raw = parseFloat(displayEl.value);
            if (!isNaN(raw)) {
                input.value = String(Math.max(min, Math.min(max, raw)));
                update();
            } else {
                displayEl.value = input.value;
            }
        });

        // Drag-to-scrub: mousedown + drag left/right changes value
        let scrubStartX = 0;
        let scrubStartVal = 0;
        displayEl.addEventListener('mousedown', (e: MouseEvent) => {
            if (document.activeElement === displayEl) return;
            e.preventDefault();
            scrubStartX = e.clientX;
            scrubStartVal = parseFloat(input.value);
            document.body.style.cursor = 'ew-resize';
            displayEl.style.cursor = 'ew-resize';

            const onMove = (ev: MouseEvent) => {
                const dx = ev.clientX - scrubStartX;
                const delta = Math.round(dx / 3) * step;
                const newVal = Math.max(min, Math.min(max, scrubStartVal + delta));
                input.value = fmt(newVal);
                displayEl.value = fmt(newVal);
                resetBtn.style.display = snap(newVal) === snap(defVal) ? 'none' : '';
                onChange(newVal);
            };
            const onUp = () => {
                document.body.style.cursor = '';
                displayEl.style.cursor = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // The hidden <input> is the source of truth for the row's value (its
        // change-handler reads from it, +/- buttons write to it). It must be
        // attached to the DOM so that callers can locate the row from the
        // input via `input.closest('.nr-sd-number-row')` — without this,
        // closest() returns null on detached elements and downstream code
        // that walks back up to the display element silently no-ops. That
        // was the root cause of the area-corner display "lag" bug: the
        // mode-toggle's per-corner display update path used closest() and
        // never reached the visible inputs.
        input.style.display = 'none';
        stepper.appendChild(input);
        stepper.appendChild(displayEl);
        stepper.appendChild(resetBtn);
        stepper.appendChild(decBtn);
        stepper.appendChild(incBtn);
        row.appendChild(stepper);
        return { row, input };
    }

    private buildSelectRow(id: string, labelText: string, options: string[]): { row: HTMLElement; select: HTMLSelectElement } {
        const row = document.createElement('div');
        row.className = 'inspector-row';

        const label = document.createElement('label');
        label.textContent = labelText;
        label.htmlFor = `inspector-${id}`;
        row.appendChild(label);

        const select = document.createElement('select');
        select.id = `inspector-${id}`;
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— select —';
        select.appendChild(emptyOpt);
        for (const opt of options) {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            select.appendChild(el);
        }
        row.appendChild(select);

        return { row, select };
    }

    private buildCheckboxRow(id: string, labelText: string): { row: HTMLElement; input: HTMLInputElement } {
        const row = document.createElement('div');
        row.className = 'inspector-row';

        const wrapper = document.createElement('div');
        wrapper.className = 'cds--form-item cds--checkbox-wrapper';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `inspector-${id}`;
        input.className = 'cds--checkbox';
        input.name = id;

        const label = document.createElement('label');
        label.htmlFor = `inspector-${id}`;
        label.className = 'cds--checkbox-label';

        const span = document.createElement('span');
        span.className = 'cds--checkbox-label-text';
        span.textContent = labelText;

        label.appendChild(span);
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        row.appendChild(wrapper);

        return { row, input };
    }

    private save() {
        if (this.currentNode) this.saveNode();
        else if (this.currentZone) this.saveZone();
        else if (this.currentLink) this.saveLink();
    }

    private saveNode() {
        if (!this.currentNode) return;
        const existing: Record<string, unknown> = this.currentNode.get(META_KEY) ?? {};
        const meta: Record<string, unknown> = { ...existing };

        if (this.nodeInputs.name) meta.name = this.nodeInputs.name.value;
        if (this.nodeInputs.notes) meta.notes = (this.nodeInputs.notes as HTMLTextAreaElement).value;

        // Only save editable (non-readonly) type fields
        for (const [key, input] of Object.entries(this.nodeCustomInputs)) {
            if (input.classList.contains('inspector-readonly')) continue;
            meta[key] = input.value;
        }

        this.currentNode.set(META_KEY, meta);
        const shapeKey = (meta.shapeType as string) || '';
        const productId = meta.productId as string;
        const product = productId ? getProduct(productId) : null;
        const displayLabel = (meta.name as string || '').trim()
            || (product ? String(product.values.name ?? '') : '')
            || ShapeRegistry[shapeKey]?.displayName
            || ShapeRegistry[shapeKey]?.componentType
            || '';
        this.currentNode.attr('label/text', displayLabel);
        this.currentNode.attr('label/display', this.nodeLabelHiddenEl.checked ? 'none' : null);
    }

    private saveZone() {
        if (!this.currentZone) return;
        const name = this.zoneNameInput.value.trim();
        this.currentZone.attr('label/text', name || 'Zone');
        this.currentZone.attr('label/display', this.zoneLabelHidden ? 'none' : null);

        const color = this.selectedZoneColor;
        this.currentZone.set('zoneColor', color);
        this.currentZone.attr('body/stroke', color);
        this.currentZone.attr('body/fill', hexToRgba(color, 0.08));
        this.currentZone.attr('label/fill', color);

        const borderStyle = this.zoneBorderStyleSelect.value;
        this.currentZone.set('zoneBorderStyle', borderStyle);
        this.currentZone.attr('body/stroke-dasharray', borderStyle === 'Dashed' ? '8 4' : null);

        const selectedPos = this.zoneLabelHidden ? 'none' : this.zoneLabelPosValue;
        this.currentZone.set('zoneLabelPosition', selectedPos);
        if (!this.zoneLabelHidden) {
            const pos = LABEL_POSITIONS[this.zoneLabelPosValue];
            if (pos) {
                this.currentZone.attr('label/x', pos.x);
                this.currentZone.attr('label/y', pos.y);
                this.currentZone.attr('label/text-anchor', pos.textAnchor);
            }
        }

        // Stretch Cluster badge
        if (this.currentZone.get('stretchCluster')) {
            const clusterName = this.zoneClusterNameInput.value.trim();
            this.currentZone.set('clusterName', clusterName);
            this.currentZone.attr('badge/text', clusterName || this.currentZone.get('stretchCluster'));

            const badgePos = this.zoneBadgePosValue;
            this.currentZone.set('badgeLabelPosition', badgePos);
            const bp = BADGE_POSITIONS[badgePos];
            this.currentZone.attr('badgeGroup/transform', bp.groupTransform);
            this.currentZone.attr('badgeBg/d', badgeChamferPath(badgePos));
        }

        // Preserve any zoneMeta fields not covered by current inputs — same
        // reasoning as saveNode/saveLink: harvesting from scratch silently
        // drops fields that this zone has but the active schema doesn't cover.
        const existingZoneMeta = (this.currentZone.get('zoneMeta') as Record<string, unknown>) ?? {};
        const zoneMeta: Record<string, unknown> = { ...existingZoneMeta };
        for (const [key, input] of Object.entries(this.zoneCustomInputs)) {
            zoneMeta[key] = input.value;
        }
        if (this.zoneNotesInput) zoneMeta.notes = this.zoneNotesInput.value;
        this.currentZone.set('zoneMeta', zoneMeta);
    }

    private saveLink() {
        if (!this.currentLink) return;
        // Preserve any meta fields not covered by the current input set —
        // building meta from scratch (the previous behaviour) silently
        // dropped legacy or schema-specific fields that the link had but
        // the active inputs didn't cover. Same pattern as saveNode.
        const existing = (this.currentLink.get(LINK_META_KEY) as Record<string, unknown>) ?? {};
        const meta: Record<string, unknown> = {
            ...existing,
            linkType:   this.linkTypeSelect.value,
            bandwidth:  this.linkInputs.bandwidth.value,
            medium:     this.linkInputs.medium.value,
            encryption: this.linkInputs.encryption.value,
        };
        for (const [key, input] of Object.entries(this.linkCustomInputs)) {
            meta[key] = input.value;
        }
        if (this.linkNotesInput) meta.notes = this.linkNotesInput.value;
        this.currentLink.set(LINK_META_KEY, meta);
        updateLinkLabel(this.currentLink, meta as unknown as LinkMeta);
    }

    private buildCustomFields(
        container: HTMLElement,
        typeId: string,
        existingValues: Record<string, unknown>,
        saveFn: () => void,
    ): Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
        container.innerHTML = '';
        const fields = getCustomFields(typeId);
        const inputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
        if (fields.length === 0) return inputs;

        for (const field of fields) {
            const row = document.createElement('div');
            row.className = 'inspector-row';
            const label = document.createElement('label');
            label.textContent = field.label;
            label.htmlFor = `inspector-custom-${typeId}-${field.key}`;
            row.appendChild(label);

            let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

            if (field.type === 'select' && field.options?.length) {
                input = document.createElement('select');
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '— select —';
                input.appendChild(emptyOpt);
                for (const opt of field.options) {
                    const el = document.createElement('option');
                    el.value = opt;
                    el.textContent = opt;
                    input.appendChild(el);
                }
            } else if (field.multiline) {
                input = document.createElement('textarea');
                (input as HTMLTextAreaElement).rows = 3;
            } else {
                input = document.createElement('input');
                (input as HTMLInputElement).type = field.type === 'number' ? 'number' : 'text';
            }

            input.id = `inspector-custom-${typeId}-${field.key}`;
            if (field.placeholder && 'placeholder' in input) input.placeholder = field.placeholder;
            input.value = String(existingValues[field.key] ?? '');
            input.addEventListener('input', saveFn);
            row.appendChild(input);
            container.appendChild(row);
            inputs[field.key] = input;
        }
        return inputs;
    }

    show(cell: IsometricShape) {
        this.currentNode = cell;
        this.currentLink = null;
        this.currentZone = null;
        const meta: Record<string, unknown> = cell.get(META_KEY) ?? { ...EMPTY_NODE_META };

        const shapeKey = (meta.shapeType as string) || '';
        const shapeDef = ShapeRegistry[shapeKey];
        const componentType = shapeDef?.componentType || shapeDef?.displayName || '';
        const typeId = componentType.toLowerCase().replace(/\s+/g, '-');
        const typeDef = typeId ? getDataType(typeId) : null;

        // Rebuild node section dynamically
        this.nodeSection.innerHTML = '';
        this.nodeInputs = {} as Record<keyof NodeMeta, HTMLInputElement | HTMLTextAreaElement>;
        this.nodeCustomInputs = {};

        // ── Tab switcher: Properties | Notes ────────────────────────────
        const tabBar = document.createElement('div');
        tabBar.className = 'nr-cd-tabs';
        const propsTabBtn = document.createElement('button');
        propsTabBtn.type = 'button';
        propsTabBtn.className = 'nr-cd-tabs__btn nr-cd-tabs__btn--active';
        propsTabBtn.textContent = 'Properties';
        const notesTabBtn = document.createElement('button');
        notesTabBtn.type = 'button';
        notesTabBtn.className = 'nr-cd-tabs__btn';
        notesTabBtn.textContent = 'Data';
        tabBar.appendChild(propsTabBtn);
        tabBar.appendChild(notesTabBtn);
        this.nodeSection.appendChild(tabBar);

        const propsPanel = document.createElement('div');
        const notesPanel = document.createElement('div');
        notesPanel.className = 'inspector-notes-panel';
        notesPanel.style.display = 'none';

        propsTabBtn.addEventListener('click', () => {
            propsTabBtn.classList.add('nr-cd-tabs__btn--active');
            notesTabBtn.classList.remove('nr-cd-tabs__btn--active');
            propsPanel.style.display = '';
            notesPanel.style.display = 'none';
        });
        notesTabBtn.addEventListener('click', () => {
            notesTabBtn.classList.add('nr-cd-tabs__btn--active');
            propsTabBtn.classList.remove('nr-cd-tabs__btn--active');
            notesPanel.style.display = '';
            propsPanel.style.display = 'none';
        });

        // ── Design section (collapsible) ────────────────────────────────
        const designLi = document.createElement('li');
        designLi.className = 'cds--accordion__item cds--accordion__item--active';
        const designBtn = document.createElement('button');
        designBtn.type = 'button';
        designBtn.className = 'cds--accordion__heading';
        designBtn.setAttribute('aria-expanded', 'true');
        designBtn.innerHTML = '<svg class="cds--accordion__arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11 3 6 3.7 5.3 8 9.6 12.3 5.3 13 6z"/></svg><div class="cds--accordion__title">Design</div>';
        const designBody = document.createElement('div');
        designBody.className = 'cds--accordion__content';
        designBtn.addEventListener('click', () => {
            const expanded = designLi.classList.toggle('cds--accordion__item--active');
            designBtn.setAttribute('aria-expanded', String(expanded));
            designBody.style.display = expanded ? '' : 'none';
        });
        designLi.appendChild(designBtn);
        designLi.appendChild(designBody);
        const propsAccordion = document.createElement('ul');
        propsAccordion.className = 'cds--accordion';
        propsAccordion.appendChild(designLi);
        propsPanel.appendChild(propsAccordion);

        // Name
        const { row: nameRow, input: nameInput } = this.buildRow('node-name', 'Name', 'Name');
        this.nodeInputs.name = nameInput as HTMLInputElement;
        nameInput.value = String(meta.name ?? '');
        nameInput.addEventListener('input', () => this.saveNode());
        designBody.appendChild(nameRow);

        // Label Position — tile popup with Carbon align-box icons
        const labelPosRow = document.createElement('div');
        labelPosRow.className = 'inspector-row';
        labelPosRow.style.position = 'relative';
        const labelPosLabel = document.createElement('label');
        labelPosLabel.textContent = 'Label Position';
        labelPosRow.appendChild(labelPosLabel);

        const toIcon14 = (icon: CarbonIcon) => carbonIconToString(icon).replace('width="16"', 'width="14"').replace('height="16"', 'height="14"');

        // Grid layout: 3 columns (left, center, right) x 3 rows (top, middle, bottom) + hide
        const positions: { value: string; label: string; icon: string; col: number; row: number }[] = [
            { value: 'top-left',      label: 'Top Left',      icon: toIcon14(AlignBoxTopLeft16 as CarbonIcon),      col: 0, row: 0 },
            { value: 'top-center',    label: 'Top Center',    icon: toIcon14(AlignBoxTopCenter16 as CarbonIcon),    col: 1, row: 0 },
            { value: 'top-right',     label: 'Top Right',     icon: toIcon14(AlignBoxTopRight16 as CarbonIcon),     col: 2, row: 0 },
            { value: 'middle-left',   label: 'Middle Left',   icon: toIcon14(AlignBoxMiddleLeft16 as CarbonIcon),   col: 0, row: 1 },
            { value: 'middle-right',  label: 'Middle Right',  icon: toIcon14(AlignBoxMiddleRight16 as CarbonIcon),  col: 2, row: 1 },
            { value: 'bottom-left',   label: 'Bottom Left',   icon: toIcon14(AlignBoxBottomLeft16 as CarbonIcon),   col: 0, row: 2 },
            { value: 'bottom-center', label: 'Bottom Center', icon: toIcon14(AlignBoxBottomCenter16 as CarbonIcon), col: 1, row: 2 },
            { value: 'bottom-right',  label: 'Bottom Right',  icon: toIcon14(AlignBoxBottomRight16 as CarbonIcon),  col: 2, row: 2 },
        ];
        const HIDE_ICON = '<svg viewBox="0 0 32 32" fill="currentColor" width="14" height="14"><path d="M2,16A14,14,0,1,0,16,2,14,14,0,0,0,2,16Zm23.15,7.75L8.25,6.85a12,12,0,0,1,16.9,16.9ZM8.24,25.16A12,12,0,0,1,6.84,8.27L23.73,25.16a12,12,0,0,1-15.49,0Z"/></svg>';

        const currentLabelPos = (cell.get('labelPosition') as string) ||
            (cell.attr('label/display') === 'none' ? 'none' : 'bottom-right');

        const curPos = positions.find(p => p.value === currentLabelPos);
        const curIcon = curPos ? curPos.icon : HIDE_ICON;
        const curLabel = curPos ? curPos.label : 'Hidden';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'nr-marker-picker-btn';
        trigger.style.flex = '0 0 160px';
        trigger.style.width = '160px';
        trigger.style.justifyContent = 'flex-start';
        trigger.style.gap = '6px';
        trigger.style.padding = '0 8px';
        trigger.innerHTML = `${curIcon}<span style="font-size:0.75rem">${curLabel}</span>`;

        const popup = document.createElement('div');
        popup.className = 'nr-label-pos-popup';
        popup.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'nr-label-pos-grid';

        const applyPos = (value: string) => {
            const pos = positions.find(p => p.value === value);
            cell.set('labelPosition', value);
            if (value === 'none') {
                trigger.innerHTML = `${HIDE_ICON}<span style="font-size:0.75rem">Hidden</span>`;
            } else {
                trigger.innerHTML = `${pos!.icon}<span style="font-size:0.75rem">${pos!.label}</span>`;
            }
            applyLabelPosition(cell);
            grid.querySelectorAll('.nr-label-pos-tile').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
            popup.style.display = 'none';
            this.nodeLabelHiddenEl.checked = value === 'none';
            this.saveNode();
        };

        for (const pos of positions) {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'nr-label-pos-tile' + (pos.value === currentLabelPos ? ' nr-label-pos-tile--selected' : '');
            tile.title = pos.label;
            tile.innerHTML = pos.icon;
            tile.style.gridColumn = String(pos.col + 1);
            tile.style.gridRow = String(pos.row + 1);
            tile.addEventListener('click', () => {
                grid.querySelectorAll('.nr-label-pos-tile--selected').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
                tile.classList.add('nr-label-pos-tile--selected');
                applyPos(pos.value);
            });
            grid.appendChild(tile);
        }

        // Hide button in the center cell (row 2, col 2)
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'nr-label-pos-tile' + (currentLabelPos === 'none' ? ' nr-label-pos-tile--selected' : '');
        hideBtn.title = 'Hide Label';
        hideBtn.innerHTML = HIDE_ICON;
        hideBtn.style.gridColumn = '2';
        hideBtn.style.gridRow = '2';
        hideBtn.addEventListener('click', () => {
            grid.querySelectorAll('.nr-label-pos-tile--selected').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
            hideBtn.classList.add('nr-label-pos-tile--selected');
            applyPos('none');
        });
        grid.appendChild(hideBtn);

        popup.appendChild(grid);
        trigger.addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? '' : 'none'; });
        document.addEventListener('mousedown', (e) => { if (!labelPosRow.contains(e.target as Node)) popup.style.display = 'none'; });

        labelPosRow.appendChild(trigger);
        labelPosRow.appendChild(popup);
        designBody.appendChild(labelPosRow);

        // Label Distance — px gap between label and component edge. Re-applies
        // the current label position so the offset updates live.
        const initialGap = (cell.get('labelDistance') as number) ?? 10;
        const { row: distanceRow } = this.buildStepperRow(
            'Label Distance', 0, 80, 1, initialGap,
            (v) => {
                cell.set('labelDistance', v);
                const pos = (cell.get('labelPosition') as string) || 'bottom-right';
                if (pos !== 'none') applyPos(pos);
            },
            10,
        );
        designBody.appendChild(distanceRow);

        // Hidden checkbox kept for saveNode compatibility
        const hiddenCheckbox = document.createElement('input');
        hiddenCheckbox.type = 'checkbox';
        hiddenCheckbox.style.display = 'none';
        hiddenCheckbox.checked = currentLabelPos === 'none';
        this.nodeLabelHiddenEl = hiddenCheckbox;
        designBody.appendChild(hiddenCheckbox);

        // (Floating Label section is a separate accordion below)

        // ── Custom Style section (plus/minus toggle) ─────────────────────
        if (!BUILT_IN_SHAPE_IDS.has(shapeKey)) {
            const hasCustomStyle = ((cell.get('shapeOpacity') as number) ?? 100) < 100;

            const styleLi = document.createElement('li');
            styleLi.className = 'cds--accordion__item nr-float-section' + (hasCustomStyle ? ' nr-float-section--active' : '');

            const styleHeader = document.createElement('div');
            styleHeader.className = 'nr-float-section__header';
            const styleTitle = document.createElement('span');
            styleTitle.className = 'nr-float-section__title';
            styleTitle.textContent = 'Custom Style';
            styleHeader.appendChild(styleTitle);

            const styleAddIcon = carbonIconToString(Add16 as CarbonIcon).replace('width="16"', 'width="20"').replace('height="16"', 'height="20"');
            const styleRemoveIcon = carbonIconToString(Subtract16 as CarbonIcon).replace('width="16"', 'width="20"').replace('height="16"', 'height="20"');

            const styleAddBtn = document.createElement('button');
            styleAddBtn.type = 'button';
            styleAddBtn.className = 'nr-float-section__btn';
            styleAddBtn.innerHTML = hasCustomStyle ? styleRemoveIcon : styleAddIcon;
            styleAddBtn.title = hasCustomStyle ? 'Remove custom style' : 'Add custom style';
            styleHeader.appendChild(styleAddBtn);
            styleLi.appendChild(styleHeader);

            const styleFields = document.createElement('div');
            styleFields.className = 'nr-float-section__body';
            styleFields.style.display = hasCustomStyle ? '' : 'none';

            styleAddBtn.addEventListener('click', () => {
                const isActive = styleLi.classList.contains('nr-float-section--active');
                if (isActive) {
                    // change:shapeOpacity listener applies fill-opacity reset.
                    cell.set('shapeOpacity', 100);
                }
                const next = !isActive;
                styleLi.classList.toggle('nr-float-section--active', next);
                styleFields.style.display = next ? '' : 'none';
                styleAddBtn.innerHTML = next ? styleRemoveIcon : styleAddIcon;
                styleAddBtn.title = next ? 'Remove custom style' : 'Add custom style';
            });

            // Color picker removed — the `accentColor` plumbing no longer
            // had a visible effect. Only Opacity remains in Custom Style.

            // Opacity — fill-only via helper, so strokes (edges) stay opaque.
            // Sole writer is `cell.set('shapeOpacity', v)`; the central
            // change:shapeOpacity listener in system-designer applies the
            // SVG-side fill-opacity. Keeps grid + inspector in sync.
            const currentOpacity = (cell.get('shapeOpacity') as number) ?? 100;
            const { row: opacityRow } = this.buildStepperRow('Opacity', 0, 100, 5, currentOpacity, (v) => {
                cell.set('shapeOpacity', v);
            }, 100);
            styleFields.appendChild(opacityRow);

            styleLi.appendChild(styleFields);
            propsAccordion.appendChild(styleLi);
        }

        // ── Floating Label section (plus/minus toggle instead of accordion chevron)
        {
            const floatMeta = (cell.get('meta') as Record<string, unknown>) || {};
            const isCalloutOn = !!cell.get('calloutLabel');
            const syncCallout = () => {
                const { syncCalloutLabel } = require('./callout-labels');
                syncCalloutLabel(cell);
            };

            const floatLi = document.createElement('li');
            floatLi.className = 'cds--accordion__item nr-float-section' + (isCalloutOn ? ' nr-float-section--active' : '');

            const floatHeader = document.createElement('div');
            floatHeader.className = 'nr-float-section__header';
            const floatTitle = document.createElement('span');
            floatTitle.className = 'nr-float-section__title';
            floatTitle.textContent = 'Floating Label';
            floatHeader.appendChild(floatTitle);

            const addIcon = carbonIconToString(Add16 as CarbonIcon).replace('width="16"', 'width="20"').replace('height="16"', 'height="20"');
            const removeIcon = carbonIconToString(Subtract16 as CarbonIcon).replace('width="16"', 'width="20"').replace('height="16"', 'height="20"');

            const floatAddBtn = document.createElement('button');
            floatAddBtn.type = 'button';
            floatAddBtn.className = 'nr-float-section__btn';
            floatAddBtn.innerHTML = isCalloutOn ? removeIcon : addIcon;
            floatAddBtn.title = isCalloutOn ? 'Remove floating label' : 'Add floating label';
            floatHeader.appendChild(floatAddBtn);
            floatLi.appendChild(floatHeader);

            const floatFields = document.createElement('div');
            floatFields.className = 'nr-float-section__body';
            floatFields.style.display = isCalloutOn ? '' : 'none';

            floatAddBtn.addEventListener('click', () => {
                const next = !cell.get('calloutLabel');
                cell.set('calloutLabel', next);
                floatFields.style.display = next ? '' : 'none';
                floatLi.classList.toggle('nr-float-section--active', next);
                floatAddBtn.innerHTML = next ? removeIcon : addIcon;
                floatAddBtn.title = next ? 'Remove floating label' : 'Add floating label';
                syncCallout();
            });

            // Headline
            const { row: headlineRow, input: headlineInput } = this.buildRow('callout-headline', 'Headline', 'Headline');
            headlineInput.value = String(floatMeta.calloutTitle || floatMeta.name || '');
            headlineInput.addEventListener('input', () => {
                const m = (cell.get('meta') as Record<string, unknown>) || {};
                m.calloutTitle = headlineInput.value;
                cell.set('meta', { ...m });
                syncCallout();
            });
            floatFields.appendChild(headlineRow);

            // Width
            const { row: floatWidthRow } = this.buildStepperRow('Max Width', 60, 300, 10,
                (cell.get('calloutWidth') as number) ?? 160, (v) => {
                    cell.set('calloutWidth', v);
                    syncCallout();
                }, 160);
            floatFields.appendChild(floatWidthRow);

            // Distance
            const { row: floatDistRow } = this.buildStepperRow('Distance', 20, 200, 5,
                (cell.get('calloutDistance') as number) ?? 78, (v) => {
                    cell.set('calloutDistance', v);
                    syncCallout();
                }, 78);
            floatFields.appendChild(floatDistRow);

            // Text (last)
            const { row: floatTextRow, input: floatTextInput } = this.buildRow('callout-text', 'Text', 'Description', true);
            floatTextRow.style.marginTop = '4px';
            (floatTextInput as HTMLTextAreaElement).value = String(floatMeta.calloutSubtitle || '');
            floatTextInput.addEventListener('input', () => {
                const m = (cell.get('meta') as Record<string, unknown>) || {};
                m.calloutSubtitle = floatTextInput.value;
                cell.set('meta', { ...m });
                syncCallout();
            });
            floatFields.appendChild(floatTextRow);

            floatLi.appendChild(floatFields);
            propsAccordion.appendChild(floatLi);
        }

        const isJustDraw = document.documentElement.classList.contains('nr-mode-just-draw');
        if (typeDef && componentType && !isJustDraw) {
            const dataBody = document.createElement('div');

            const products = getProductsByType(componentType);
            const selectedProductId = (meta.productId as string) || '';
            const selectedProduct = selectedProductId ? getProduct(selectedProductId) : null;

            if (products.length > 0 || selectedProductId) {
                const { row: prodRow, select: prodSelect } = this.buildSelectRow(
                    'node-product', `${componentType} Product`,
                    products.map(p => String(p.values.name || p.id))
                );
                prodSelect.innerHTML = '';
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '— none —';
                prodSelect.appendChild(emptyOpt);
                for (const p of products) {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = String(p.values.name || p.id);
                    if (p.id === selectedProductId) opt.selected = true;
                    prodSelect.appendChild(opt);
                }
                prodSelect.addEventListener('change', () => {
                    meta.productId = prodSelect.value;
                    this.saveNode();
                    this.show(cell);
                });
                dataBody.appendChild(prodRow);
            }

            for (const field of typeDef.fields) {
                if (field.key === 'id' || field.key === 'name') continue;
                let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
                let row: HTMLElement;
                if (field.type === 'select' && field.options?.length) {
                    const r = this.buildSelectRow(`node-type-${field.key}`, field.label, field.options);
                    row = r.row; input = r.select;
                } else if (field.multiline) {
                    const r = this.buildRow(`node-type-${field.key}`, field.label, field.placeholder || field.label, true);
                    row = r.row; input = r.input;
                } else {
                    const r = this.buildRow(`node-type-${field.key}`, field.label, field.placeholder || field.label);
                    row = r.row; input = r.input;
                    if (field.type === 'number') (input as HTMLInputElement).type = 'number';
                }
                if (selectedProduct) {
                    input.value = String(selectedProduct.values[field.key] ?? '');
                    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.readOnly = true;
                    else input.disabled = true;
                    input.classList.add('inspector-readonly');
                } else {
                    input.value = String(meta[field.key] ?? '');
                    input.addEventListener('input', () => this.saveNode());
                }
                dataBody.appendChild(row);
                this.nodeCustomInputs[field.key] = input;
            }

            notesPanel.appendChild(dataBody);
        }

        // Custom fields from schema registry
        const customContainer = document.createElement('div');
        customContainer.className = 'inspector-custom-fields';
        propsPanel.appendChild(customContainer);
        this.nodeCustomContainer = customContainer;
        const schemaCustom = this.buildCustomFields(customContainer, 'node', meta, () => this.saveNode());
        Object.assign(this.nodeCustomInputs, schemaCustom);

        this.nodeSection.appendChild(propsPanel);

        // ── Notes panel ─────────────────────────────────────────────────
        const { row: notesRow, input: notesInput } = this.buildRow('node-notes', 'Notes', 'Notes', true);
        this.nodeInputs.notes = notesInput as HTMLTextAreaElement;
        notesInput.value = String(meta.notes ?? '');
        notesInput.addEventListener('input', () => this.saveNode());
        notesPanel.appendChild(notesRow);
        this.nodeSection.appendChild(notesPanel);

        this.titleTextEl.textContent = 'Component Inspector';
        this.hideAllSections();
        this.nodeSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = '';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = '';
        this.deleteBtn.textContent = 'Delete';
        this.overflowBtn.style.display = '';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    showZone(frame: dia.Element) {
        this.currentZone = frame;
        this.currentNode = null;
        this.currentLink = null;

        this.zoneSection.innerHTML = '';

        // ── Tabs ───────────────────────────────────────────────────────
        const propsPanel = document.createElement('div');
        const notesPanel = document.createElement('div');
        notesPanel.className = 'inspector-notes-panel';
        const tabs = this.buildTabBar([
            { label: 'Properties', panel: propsPanel },
            { label: 'Notes', panel: notesPanel },
        ]);
        this.zoneSection.appendChild(tabs);

        // ── Properties panel ───────────────────────────────────────────
        const accordion = document.createElement('ul');
        accordion.className = 'cds--accordion';

        // ── Design section ─────────────────────────────────────────────
        const { li: designLi, body: designBody } = this.buildAccordionSection('Design');
        accordion.appendChild(designLi);

        // Zone Name
        const { row: nameRow, input: nameInput } = this.buildRow('zone-name', 'Name', 'Zone Name');
        this.zoneNameInput = nameInput as HTMLInputElement;
        this.zoneNameInput.value = (frame.attr('label/text') as string | undefined) ?? '';
        this.zoneNameInput.addEventListener('input', () => this.saveZone());
        designBody.appendChild(nameRow);

        // Label Position dropdown
        const ICON_RECT = 'M27,12v15H5V5h15v-2H5c-1.1046,0-2,.8954-2,2v22c0,1.1046.8954,2,2,2h22c1.1046,0,2-.8954,2-2v-15h-2Z';
        const zonePositions = [
            { value: 'top-left',     label: 'Top Left',      rotation: 270 },
            { value: 'top-right',    label: 'Top Right',     rotation: 0   },
            { value: 'bottom-left',  label: 'Bottom Left',   rotation: 180 },
            { value: 'bottom-right', label: 'Bottom Right',  rotation: 90  },
            { value: 'none',         label: 'Hide Label',    rotation: -1  },
        ];
        const makeIcon = (rotation: number): string => {
            if (rotation < 0) return '<svg viewBox="0 0 32 32" fill="currentColor" width="14" height="14"><path d="M2,16H2A14,14,0,1,0,16,2,14,14,0,0,0,2,16Zm23.15,7.75L8.25,6.85a12,12,0,0,1,16.9,16.9ZM8.24,25.16A12,12,0,0,1,6.84,8.27L23.73,25.16a12,12,0,0,1-15.49,0Z"/></svg>';
            return `<svg viewBox="0 0 32 32" fill="currentColor" width="14" height="14" style="transform:rotate(${rotation}deg)"><path d="${ICON_RECT}"/><circle cx="26.5" cy="5.5" r="3.5"/></svg>`;
        };

        const savedPos = (frame.get('zoneLabelPosition') as string) ||
            (frame.attr('label/display') === 'none' ? 'none' : 'top-left');
        this.zoneLabelPosValue = savedPos;
        this.zoneLabelHidden = savedPos === 'none';

        const labelPosRow = document.createElement('div');
        labelPosRow.className = 'inspector-row';
        const labelPosLabel = document.createElement('label');
        labelPosLabel.textContent = 'Label';
        labelPosRow.appendChild(labelPosLabel);

        const dropWrap = document.createElement('div');
        dropWrap.className = 'nr-sd-dropdown';
        dropWrap.style.flex = '0 0 160px';
        dropWrap.style.width = '160px';
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'nr-sd-dropdown__trigger';
        const curPos = zonePositions.find(p => p.value === savedPos) || zonePositions[0];
        const setTrigger = (pos: typeof zonePositions[0]) => {
            trigger.innerHTML = `<span class="nr-sd-dropdown__icon">${makeIcon(pos.rotation)}</span><span class="nr-sd-dropdown__text">${pos.label}</span>`;
        };
        setTrigger(curPos);
        const menu = document.createElement('ul');
        menu.className = 'nr-sd-dropdown__menu';
        menu.setAttribute('role', 'listbox');
        for (const pos of zonePositions) {
            const li = document.createElement('li');
            li.className = 'nr-sd-dropdown__item' + (pos.value === savedPos ? ' nr-sd-dropdown__item--selected' : '');
            li.setAttribute('role', 'option');
            li.innerHTML = `<span class="nr-sd-dropdown__icon">${makeIcon(pos.rotation)}</span><span class="nr-sd-dropdown__text">${pos.label}</span>`;
            li.addEventListener('click', () => {
                menu.classList.remove('nr-sd-dropdown__menu--open');
                trigger.classList.remove('nr-sd-dropdown__trigger--open');
                menu.querySelectorAll('.nr-sd-dropdown__item--selected').forEach(el => el.classList.remove('nr-sd-dropdown__item--selected'));
                li.classList.add('nr-sd-dropdown__item--selected');
                setTrigger(pos);
                this.zoneLabelPosValue = pos.value;
                this.zoneLabelHidden = pos.value === 'none';
                this.saveZone();
            });
            menu.appendChild(li);
        }
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.toggle('nr-sd-dropdown__menu--open');
            trigger.classList.toggle('nr-sd-dropdown__trigger--open', isOpen);
        });
        document.addEventListener('click', () => {
            menu.classList.remove('nr-sd-dropdown__menu--open');
            trigger.classList.remove('nr-sd-dropdown__trigger--open');
        });
        dropWrap.appendChild(trigger);
        dropWrap.appendChild(menu);
        labelPosRow.appendChild(dropWrap);
        designBody.appendChild(labelPosRow);

        // Color picker — hex input with popup
        this.selectedZoneColor = (frame.get('zoneColor') as string | undefined) ?? DEFAULT_ZONE_COLOR;
        const colorRow = document.createElement('div');
        colorRow.className = 'inspector-row';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Color';
        colorRow.appendChild(colorLabel);
        const hexWrap = document.createElement('div');
        hexWrap.className = 'nr-sd-hex-input-wrap';
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'nr-sd-hex-input';
        hexInput.readOnly = true;
        hexInput.style.cursor = 'pointer';
        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'nr-sd-hex-color-btn';
        let currentZoneColor = this.selectedZoneColor;
        const syncColorDisplay = () => {
            hexInput.value = currentZoneColor;
            hexInput.classList.remove('nr-sd-hex-input--default');
            colorBtn.style.backgroundColor = currentZoneColor;
            colorBtn.innerHTML = '';
        };
        syncColorDisplay();
        const popup = document.createElement('div');
        popup.className = 'nr-sd-color-popup';
        popup.style.display = 'none';
        for (const c of PRIMARY_COLORS.filter(cl => cl.base !== '#161616')) {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'nr-sd-color-popup__swatch';
            swatch.style.backgroundColor = c.base;
            swatch.title = c.label;
            swatch.addEventListener('click', () => {
                currentZoneColor = c.base;
                this.selectedZoneColor = c.base;
                popup.style.display = 'none';
                syncColorDisplay();
                this.saveZone();
            });
            popup.appendChild(swatch);
        }
        const hiddenPicker = document.createElement('input');
        hiddenPicker.type = 'color';
        hiddenPicker.className = 'nr-sd-hex-hidden-picker';
        hiddenPicker.value = currentZoneColor;
        const customSwatch = document.createElement('button');
        customSwatch.type = 'button';
        customSwatch.className = 'nr-sd-color-popup__swatch nr-sd-color-popup__swatch--custom';
        customSwatch.title = 'Custom color';
        customSwatch.innerHTML = '<svg viewBox="0 0 32 32" fill="currentColor" width="12" height="12"><path d="M29.391,2.609a3.279,3.279,0,0,0-4.634,0L18.4835,8.883,12.793,3.207,11.3789,4.6211l4.2764,4.2764L2.4072,22.146A.9967.9967,0,0,0,2.1,22.78L.042,29.0361a1,1,0,0,0,1.265,1.2637l6.2549-2.0586a.9974.9974,0,0,0,.6348-.3076L21.4453,14.6855l4.2764,4.2764,1.4141-1.4141L21.4116,11.8237l6.2744-6.2744.0051-.0051a3.2781,3.2781,0,0,0,0-4.634ZM6.8965,27.0017l-4.3384,1.4275L3.985,24.0908ZM28.2808,5.8281l-.0051.0051L21.9316,12.177l-.707-.707,6.3491-6.3491a1.2783,1.2783,0,0,1,1.806,0h0a1.2776,1.2776,0,0,1-.0977,1.7071Z"/></svg>';
        customSwatch.addEventListener('click', () => { popup.style.display = 'none'; hiddenPicker.click(); });
        popup.appendChild(customSwatch);
        hiddenPicker.addEventListener('input', () => {
            currentZoneColor = hiddenPicker.value;
            this.selectedZoneColor = currentZoneColor;
            syncColorDisplay();
            this.saveZone();
        });
        colorBtn.addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? '' : 'none'; });
        hexInput.addEventListener('click', () => { colorBtn.click(); });
        document.addEventListener('mousedown', (e) => {
            if (!hexWrap.contains(e.target as Node)) popup.style.display = 'none';
        });
        hexWrap.appendChild(hexInput);
        hexWrap.appendChild(colorBtn);
        hexWrap.appendChild(hiddenPicker);
        hexWrap.appendChild(popup);
        colorRow.appendChild(hexWrap);
        designBody.appendChild(colorRow);

        // ── Data section (hidden in Just-Draw mode) ──────────────────
        const { li: dataLi, body: dataBody } = this.buildAccordionSection('Data');
        if (!document.documentElement.classList.contains('nr-mode-just-draw')) {
            accordion.appendChild(dataLi);
        }

        const { row: borderStyleRow, select: borderStyleSelect } = this.buildSelectRow(
            'zone-border-style', 'Border Style', ['Solid', 'Dashed']
        );
        borderStyleSelect.querySelector('option[value=""]')?.remove();
        this.zoneBorderStyleSelect = borderStyleSelect;
        this.zoneBorderStyleSelect.value = (frame.get('zoneBorderStyle') as string | undefined) ?? 'Solid';
        this.zoneBorderStyleSelect.addEventListener('change', () => this.saveZone());
        dataBody.appendChild(borderStyleRow);

        this.zoneCustomContainer = document.createElement('div');
        this.zoneCustomContainer.className = 'inspector-custom-fields';
        const zoneMeta: Record<string, unknown> = frame.get('zoneMeta') ?? {};
        this.zoneCustomInputs = this.buildCustomFields(
            this.zoneCustomContainer, 'zone', zoneMeta, () => this.saveZone()
        );
        dataBody.appendChild(this.zoneCustomContainer);

        // ── Stretch Cluster section (shown only when zone is in a cluster) ──
        const clusterLabel = frame.get('stretchCluster') as string | undefined;
        const isInCluster = !!clusterLabel;
        if (isInCluster) {
            const { li: clusterLi, body: clusterBody } = this.buildAccordionSection('Stretch Cluster');
            accordion.appendChild(clusterLi);

            const { row: clusterNameRow, input: clusterNameInput } = this.buildRow(
                'zone-cluster-name', 'Cluster Name', 'e.g. Stretch Cluster A'
            );
            this.zoneClusterNameInput = clusterNameInput as HTMLInputElement;
            const customName = (frame.get('clusterName') as string | undefined) ?? '';
            this.zoneClusterNameInput.value = customName || clusterLabel;
            this.zoneClusterNameInput.addEventListener('input', () => this.saveZone());
            clusterBody.appendChild(clusterNameRow);

            const savedBadgePos = (frame.get('badgeLabelPosition') as string | undefined) ?? 'top-right';
            this.zoneBadgePosValue = savedBadgePos;

            const badgePosRow = document.createElement('div');
            badgePosRow.className = 'inspector-row';
            const bpLabel = document.createElement('label');
            bpLabel.textContent = 'Badge Position';
            badgePosRow.appendChild(bpLabel);

            const bpPositions = [
                { value: 'top-left',     label: 'Top Left',      rotation: 270 },
                { value: 'top-right',    label: 'Top Right',     rotation: 0   },
                { value: 'bottom-left',  label: 'Bottom Left',   rotation: 180 },
                { value: 'bottom-right', label: 'Bottom Right',  rotation: 90  },
            ];

            const bpDropWrap = document.createElement('div');
            bpDropWrap.className = 'nr-sd-dropdown';
            bpDropWrap.style.flex = '0 0 160px';
            bpDropWrap.style.width = '160px';
            const bpTrigger = document.createElement('button');
            bpTrigger.type = 'button';
            bpTrigger.className = 'nr-sd-dropdown__trigger';
            const bpCur = bpPositions.find(p => p.value === savedBadgePos) || bpPositions[1];
            const setBpTrigger = (pos: typeof bpPositions[0]) => {
                bpTrigger.innerHTML = `<span class="nr-sd-dropdown__icon">${makeIcon(pos.rotation)}</span><span class="nr-sd-dropdown__text">${pos.label}</span>`;
            };
            setBpTrigger(bpCur);
            const bpMenu = document.createElement('ul');
            bpMenu.className = 'nr-sd-dropdown__menu';
            bpMenu.setAttribute('role', 'listbox');
            for (const pos of bpPositions) {
                const li = document.createElement('li');
                li.className = 'nr-sd-dropdown__item' + (pos.value === savedBadgePos ? ' nr-sd-dropdown__item--selected' : '');
                li.setAttribute('role', 'option');
                li.innerHTML = `<span class="nr-sd-dropdown__icon">${makeIcon(pos.rotation)}</span><span class="nr-sd-dropdown__text">${pos.label}</span>`;
                li.addEventListener('click', () => {
                    bpMenu.classList.remove('nr-sd-dropdown__menu--open');
                    bpTrigger.classList.remove('nr-sd-dropdown__trigger--open');
                    bpMenu.querySelectorAll('.nr-sd-dropdown__item--selected').forEach(el => el.classList.remove('nr-sd-dropdown__item--selected'));
                    li.classList.add('nr-sd-dropdown__item--selected');
                    setBpTrigger(pos);
                    this.zoneBadgePosValue = pos.value;
                    this.saveZone();
                });
                bpMenu.appendChild(li);
            }
            bpTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = bpMenu.classList.toggle('nr-sd-dropdown__menu--open');
                bpTrigger.classList.toggle('nr-sd-dropdown__trigger--open', isOpen);
            });
            document.addEventListener('click', () => {
                bpMenu.classList.remove('nr-sd-dropdown__menu--open');
                bpTrigger.classList.remove('nr-sd-dropdown__trigger--open');
            });
            bpDropWrap.appendChild(bpTrigger);
            bpDropWrap.appendChild(bpMenu);
            badgePosRow.appendChild(bpDropWrap);
            clusterBody.appendChild(badgePosRow);
        }

        propsPanel.appendChild(accordion);
        this.zoneSection.appendChild(propsPanel);

        // ── Notes panel ────────────────────────────────────────────────
        const { row: notesRow, input: notesInput } = this.buildRow('zone-notes', 'Notes', 'Notes', true);
        this.zoneNotesInput = notesInput as HTMLTextAreaElement;
        this.zoneNotesInput.value = String(zoneMeta.notes ?? '');
        this.zoneNotesInput.addEventListener('input', () => this.saveZone());
        notesPanel.appendChild(notesRow);
        this.zoneSection.appendChild(notesPanel);

        this.titleTextEl.textContent = 'Zone Inspector';
        this.hideAllSections();
        this.zoneSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = 'none';
        this.duplicateZoneBtn.parentElement!.style.display = '';
        this.deleteBtn.parentElement!.style.display = '';
        this.deleteBtn.textContent = 'Delete Zone';
        this.overflowBtn.style.display = '';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    showLink(link: dia.Link) {
        this.detachMultiLink();
        this.currentLink = link;
        this.currentNode = null;
        this.currentZone = null;

        this.linkSection.innerHTML = '';
        const meta: Record<string, unknown> = link.get(LINK_META_KEY) ?? { ...EMPTY_LINK_META };

        // Auto-detect link type based on source/target
        let linkType = String(meta.linkType ?? '');
        if (!linkType) {
            const srcId = (link.source() as { id?: string }).id;
            const tgtId = (link.target() as { id?: string }).id;
            if (srcId && tgtId) {
                const srcCell = link.graph?.getCell(srcId);
                const tgtCell = link.graph?.getCell(tgtId);
                if (srcCell?.get('isFrame') && tgtCell?.get('isFrame')) {
                    linkType = 'Cluster Link';
                } else {
                    linkType = 'Host Access';
                }
                meta.linkType = linkType;
                link.set(LINK_META_KEY, meta);
            }
        }

        // ── Tabs ───────────────────────────────────────────────────────
        const propsPanel = document.createElement('div');
        const dataPanel = document.createElement('div');
        dataPanel.className = 'inspector-notes-panel';
        const tabs = this.buildTabBar([
            { label: 'Design', panel: propsPanel },
            { label: 'Data', panel: dataPanel },
        ]);
        this.linkSection.appendChild(tabs);

        // ── Properties panel ───────────────────────────────────────────
        const accordion = document.createElement('ul');
        accordion.className = 'cds--accordion';

        // ── Design section ��────────────────────────────────────────────
        const { li: designLi, body: designBody } = this.buildAccordionSection('Design');
        accordion.appendChild(designLi);

        const { row: ltRow, select: ltSelect } = this.buildSelectRow(
            'link-type', 'Link Type', LINK_TYPE_OPTIONS
        );
        this.linkTypeSelect = ltSelect;
        this.linkTypeSelect.value = linkType;
        this.linkTypeSelect.addEventListener('change', () => this.saveLink());

        // Line style
        const lineStyleRow = document.createElement('div');
        lineStyleRow.className = 'inspector-row';
        const lineStyleLabel = document.createElement('label');
        lineStyleLabel.textContent = 'Line Style';
        lineStyleRow.appendChild(lineStyleLabel);
        const lineStyleSelect = document.createElement('select');
        lineStyleSelect.style.flex = '0 0 160px';
        lineStyleSelect.style.width = '160px';
        for (const [val, txt] of [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            lineStyleSelect.appendChild(opt);
        }
        lineStyleSelect.value = (link.get('lineStyle') as string) || 'solid';

        const applyLineVisuals = () => {
            const style = lineStyleSelect.value;
            const thickness = parseFloat(lineThicknessInput.value) || 1;
            const color = (link.get('lineColor') as string) || '#333333';
            const opacity = ((link.get('lineOpacity') as number) ?? 100) / 100;

            const lineAttrs: Record<string, unknown> = {
                stroke: color,
                strokeWidth: thickness,
                strokeOpacity: opacity,
                strokeLinecap: null,
                strokeDasharray: null,
            };

            if (style === 'dashed') {
                lineAttrs.strokeDasharray = `${thickness * 4} ${thickness * 2.5}`;
            } else if (style === 'dotted') {
                lineAttrs.strokeDasharray = `${thickness} ${thickness * 2.5}`;
                lineAttrs.strokeLinecap = 'round';
            }

            // Rebuild markers with current color
            const targetType = (link.get('arrowType') as string) || 'arrow';
            const sourceType = (link.get('sourceArrowType') as string) || 'none';
            if (targetType !== 'none') lineAttrs.targetMarker = buildMarker(targetType, 'target');
            if (sourceType !== 'none') lineAttrs.sourceMarker = buildMarker(sourceType, 'source');

            link.attr({ line: lineAttrs });
            link.set('lineStyle', style);
            link.set('lineThickness', thickness);
        };

        lineStyleSelect.addEventListener('change', applyLineVisuals);
        lineStyleRow.appendChild(lineStyleSelect);
        designBody.appendChild(lineStyleRow);

        // Marker definitions: id, label, preview SVG path (drawn in a 24x16 viewBox)
        const MARKER_DEFS: Array<{ id: string; label: string; preview: string }> = [
            { id: 'none',            label: 'None',            preview: '<line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="1"/>' },
            { id: 'arrow',           label: 'Arrow',           preview: '<line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1"/><path d="M 16 4 L 22 8 L 16 12 Z" fill="currentColor"/>' },
            { id: 'arrow-outline',   label: 'Arrow Outline',   preview: '<line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1"/><path d="M 16 4 L 22 8 L 16 12 Z" fill="none" stroke="currentColor" stroke-width="1"/>' },
            { id: 'diamond',         label: 'Diamond',         preview: '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1"/><path d="M 14 8 L 18 4 L 22 8 L 18 12 Z" fill="currentColor"/>' },
            { id: 'diamond-outline', label: 'Diamond Outline', preview: '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1"/><path d="M 14 8 L 18 4 L 22 8 L 18 12 Z" fill="none" stroke="currentColor" stroke-width="1"/>' },
            { id: 'circle',          label: 'Circle',          preview: '<line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1"/><circle cx="19" cy="8" r="3" fill="currentColor"/>' },
            { id: 'circle-outline',  label: 'Circle Outline',  preview: '<line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1"/><circle cx="19" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1"/>' },
            { id: 'bar',             label: 'Bar',             preview: '<line x1="2" y1="8" x2="21" y2="8" stroke="currentColor" stroke-width="1"/><line x1="21" y1="3" x2="21" y2="13" stroke="currentColor" stroke-width="1.5"/>' },
        ];

        const buildMarker = (type: string, end: 'target' | 'source', scale?: number): Record<string, unknown> => {
            const hasCustomColor = !!(link.get('lineColor'));
            const color = hasCustomColor ? ((link.get('lineColor') as string) || '#333333') : 'context-stroke';
            const bg = document.documentElement.classList.contains('cds--g100') ? '#262626' : '#ffffff';
            const s = scale ?? ((end === 'target'
                ? (link.get('endArrowSize') as number)
                : (link.get('beginArrowSize') as number)) ?? 1);
            const a = (v: number) => +(v * s).toFixed(2);
            // All paths have tip at (0,0) so the line endpoint touches the component edge.
            switch (type) {
                case 'none':
                    return { type: 'path', d: 'M 0 0', fill: 'none', stroke: 'none' };
                case 'arrow':
                    return { type: 'path', d: `M ${a(6)} ${a(-4)} L 0 0 L ${a(6)} ${a(4)} z`, fill: color, stroke: color };
                case 'arrow-outline':
                    return { type: 'path', d: `M ${a(6)} ${a(-4)} L 0 0 L ${a(6)} ${a(4)} z`, fill: bg, stroke: color, 'stroke-width': 1 };
                case 'diamond':
                    return { type: 'path', d: `M ${a(6)} ${a(-4)} L 0 0 L ${a(6)} ${a(4)} L ${a(12)} 0 Z`, fill: color, stroke: color };
                case 'diamond-outline':
                    return { type: 'path', d: `M ${a(6)} ${a(-4)} L 0 0 L ${a(6)} ${a(4)} L ${a(12)} 0 Z`, fill: bg, stroke: color, 'stroke-width': 1 };
                case 'circle':
                    return { type: 'circle', r: a(3), cx: a(3), fill: color, stroke: color };
                case 'circle-outline':
                    return { type: 'circle', r: a(3), cx: a(3), fill: bg, stroke: color, 'stroke-width': 1 };
                case 'bar':
                    return { type: 'path', d: `M 0 ${a(-5)} L 0 ${a(5)}`, fill: 'none', stroke: color, 'stroke-width': 1.5 };
                default:
                    return { type: 'path', d: `M ${a(6)} ${a(-4)} L 0 0 L ${a(6)} ${a(4)} z`, fill: color, stroke: color };
            }
        };

        const buildArrowRow = (label: string, typeKey: string, sizeKey: string, attrKey: 'targetMarker' | 'sourceMarker', defaultType: string) => {
            const end: 'target' | 'source' = attrKey === 'sourceMarker' ? 'source' : 'target';
            const row = document.createElement('div');
            row.className = 'inspector-row';
            row.style.position = 'relative';
            const lbl = document.createElement('label');
            lbl.textContent = label;
            row.appendChild(lbl);

            const control = document.createElement('div');
            control.style.display = 'flex';
            control.style.flex = '0 0 160px';
            control.style.width = '160px';
            control.style.alignItems = 'stretch';

            // Type picker button (left side)
            const currentType = (link.get(typeKey) as string) || defaultType;
            const currentDef = MARKER_DEFS.find(m => m.id === currentType) || MARKER_DEFS[0];
            const typeBtn = document.createElement('button');
            typeBtn.type = 'button';
            typeBtn.className = 'nr-marker-picker-btn';
            typeBtn.style.flex = '0 0 32px';
            typeBtn.style.width = '32px';
            typeBtn.style.borderRight = 'none';
            typeBtn.style.padding = '0';
            typeBtn.innerHTML = `<svg viewBox="0 0 24 16" width="36" height="12">${currentDef.preview}</svg>`;
            typeBtn.title = currentDef.label;

            // Size stepper (right side)
            const sizeStepper = document.createElement('div');
            sizeStepper.className = 'nr-ad__number-stepper';
            sizeStepper.style.flex = '1';
            sizeStepper.style.height = '28px';

            const sizeDisplay = document.createElement('input');
            sizeDisplay.type = 'text';
            sizeDisplay.className = 'nr-sd-number-display';
            sizeDisplay.style.width = '28px';
            sizeDisplay.style.textAlign = 'center';
            const curSize = (link.get(sizeKey) as number) ?? 1;
            sizeDisplay.value = `${Math.round(curSize * 4)}px`;

            const sizeDecBtn = document.createElement('button');
            sizeDecBtn.type = 'button';
            sizeDecBtn.className = 'nr-ad__number-btn';
            sizeDecBtn.style.height = '28px';
            sizeDecBtn.style.width = '28px';
            sizeDecBtn.textContent = '\u2212';

            const sizeIncBtn = document.createElement('button');
            sizeIncBtn.type = 'button';
            sizeIncBtn.className = 'nr-ad__number-btn';
            sizeIncBtn.style.height = '28px';
            sizeIncBtn.style.width = '28px';
            sizeIncBtn.textContent = '+';

            let sizeVal = curSize;
            const applySize = () => {
                sizeVal = Math.max(0.5, Math.min(3, sizeVal));
                sizeDisplay.value = `${Math.round(sizeVal * 4)}px`;
                link.set(sizeKey, sizeVal);
                const t = (link.get(typeKey) as string) || defaultType;
                if (t !== 'none') link.attr({ line: { [attrKey]: buildMarker(t, end, sizeVal) } });
            };
            sizeDecBtn.addEventListener('click', () => { sizeVal -= 0.25; applySize(); });
            sizeIncBtn.addEventListener('click', () => { sizeVal += 0.25; applySize(); });
            sizeDisplay.addEventListener('change', () => {
                const raw = parseFloat(sizeDisplay.value);
                if (!isNaN(raw)) { sizeVal = raw / 4; applySize(); } else { sizeDisplay.value = `${Math.round(sizeVal * 4)}px`; }
            });

            // Drag-to-scrub
            let scrubStartX = 0;
            let scrubStartVal = 0;
            sizeDisplay.addEventListener('mousedown', (e: MouseEvent) => {
                if (document.activeElement === sizeDisplay) return;
                e.preventDefault();
                scrubStartX = e.clientX;
                scrubStartVal = sizeVal;
                document.body.style.cursor = 'ew-resize';
                sizeDisplay.style.cursor = 'ew-resize';
                const onMove = (ev: MouseEvent) => {
                    const delta = Math.round((ev.clientX - scrubStartX) / 6) * 0.25;
                    sizeVal = scrubStartVal + delta;
                    applySize();
                };
                const onUp = () => {
                    document.body.style.cursor = '';
                    sizeDisplay.style.cursor = '';
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            sizeStepper.appendChild(sizeDisplay);
            sizeStepper.appendChild(sizeDecBtn);
            sizeStepper.appendChild(sizeIncBtn);

            // Popup (square tiles)
            const popup = document.createElement('div');
            popup.className = 'nr-marker-picker-popup nr-marker-picker-popup--square';
            popup.style.display = 'none';

            for (const def of MARKER_DEFS) {
                const tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'nr-marker-picker-tile nr-marker-picker-tile--sq' + (def.id === currentType ? ' nr-marker-picker-tile--selected' : '');
                tile.title = def.label;
                tile.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20"><g transform="translate(0,4)">${def.preview}</g></svg>`;
                tile.addEventListener('click', () => {
                    link.set(typeKey, def.id);
                    link.attr({ line: { [attrKey]: buildMarker(def.id, end) } });
                    typeBtn.innerHTML = `<svg viewBox="0 0 24 16" width="36" height="12">${def.preview}</svg>`;
                    typeBtn.title = def.label;
                    popup.querySelectorAll('.nr-marker-picker-tile').forEach(t =>
                        t.classList.toggle('nr-marker-picker-tile--selected', t === tile));
                    popup.style.display = 'none';
                });
                popup.appendChild(tile);
            }

            typeBtn.addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? '' : 'none'; });
            document.addEventListener('mousedown', (e) => { if (!row.contains(e.target as Node)) popup.style.display = 'none'; });

            control.appendChild(typeBtn);
            control.appendChild(sizeStepper);
            row.appendChild(control);
            row.appendChild(popup);
            designBody.appendChild(row);
        };

        buildArrowRow('End Arrow Type', 'arrowType', 'endArrowSize', 'targetMarker', 'arrow');
        buildArrowRow('Begin Arrow Type', 'sourceArrowType', 'beginArrowSize', 'sourceMarker', 'none');

        // Thickness
        const { row: lineThicknessRow, input: lineThicknessInput } = this.buildStepperRow(
            'Thickness', 0.5, 6, 0.5, (link.get('lineThickness') as number) ?? 1, () => applyLineVisuals()
        );
        designBody.appendChild(lineThicknessRow);

        // Color
        const lineColorRow = document.createElement('div');
        lineColorRow.className = 'inspector-row';
        const lineColorLabel = document.createElement('label');
        lineColorLabel.textContent = 'Color';
        lineColorRow.appendChild(lineColorLabel);
        const lineColorWrap = this.buildColorPicker(
            (link.get('lineColor') as string) || '#333333',
            (c) => { link.set('lineColor', c); applyLineVisuals(); }
        );
        lineColorRow.appendChild(lineColorWrap);
        designBody.appendChild(lineColorRow);

        // Opacity
        const { row: lineOpacityRow } = this.buildStepperRow(
            'Opacity', 0, 100, 5, (link.get('lineOpacity') as number) ?? 100, (v) => {
                link.set('lineOpacity', v);
                applyLineVisuals();
            }
        );
        designBody.appendChild(lineOpacityRow);

        // Router
        const routerRow = document.createElement('div');
        routerRow.className = 'inspector-row';
        const routerLbl = document.createElement('label');
        routerLbl.textContent = 'Routing';
        routerRow.appendChild(routerLbl);
        const routerSelect = document.createElement('select');
        routerSelect.style.flex = '0 0 160px';
        routerSelect.style.width = '160px';
        for (const [val, txt] of [
            ['default', 'Auto (Manhattan)'],
            ['normal', 'Direct'],
            ['orthogonal', 'Orthogonal'],
            ['manhattan', 'Manhattan'],
            ['metro', 'Metro'],
        ]) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            routerSelect.appendChild(opt);
        }
        const curRouter = (link.get('customRouter') as string) || 'default';
        routerSelect.value = curRouter;
        routerSelect.addEventListener('change', () => {
            const val = routerSelect.value;
            link.set('customRouter', val);
            if (val === 'default') {
                link.unset('router');
            } else {
                link.set('router', { name: val });
            }
        });
        routerRow.appendChild(routerSelect);
        designBody.appendChild(routerRow);

        // Connector
        const connRow = document.createElement('div');
        connRow.className = 'inspector-row';
        const connLbl = document.createElement('label');
        connLbl.textContent = 'Connector';
        connRow.appendChild(connLbl);
        const connSelect = document.createElement('select');
        connSelect.style.flex = '0 0 160px';
        connSelect.style.width = '160px';
        for (const [val, txt] of [
            ['default', 'Default'],
            ['normal', 'Straight'],
            ['rounded', 'Rounded'],
            ['smooth', 'Smooth'],
            ['jumpover', 'Jump Over'],
        ]) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            connSelect.appendChild(opt);
        }
        const curConn = (link.get('customConnector') as string) || 'default';
        connSelect.value = curConn;
        connSelect.addEventListener('change', () => {
            const val = connSelect.value;
            link.set('customConnector', val);
            if (val === 'default') {
                link.unset('connector');
            } else {
                const args: Record<string, unknown> = {};
                if (val === 'rounded') args.radius = 8;
                if (val === 'jumpover') { args.size = 6; args.jump = 'arc'; }
                link.set('connector', { name: val, args });
            }
        });
        connRow.appendChild(connSelect);
        designBody.appendChild(connRow);

        propsPanel.appendChild(accordion);
        this.linkSection.appendChild(propsPanel);

        // ── Data panel ─────────────────────────────────────────────────
        dataPanel.appendChild(ltRow);

        if (!document.documentElement.classList.contains('nr-mode-just-draw')) {
            for (const field of LINK_FIELDS) {
                const { row, input } = this.buildRow(
                    `link-${field.key}`, field.label, field.placeholder
                );
                this.linkInputs[field.key] = input as HTMLInputElement;
                this.linkInputs[field.key].value = String(meta[field.key] ?? '');
                this.linkInputs[field.key].addEventListener('input', () => this.saveLink());
                dataPanel.appendChild(row);
            }
            this.linkCustomContainer = document.createElement('div');
            this.linkCustomContainer.className = 'inspector-custom-fields';
            this.linkCustomInputs = this.buildCustomFields(
                this.linkCustomContainer, 'connection', meta, () => this.saveLink()
            );
            dataPanel.appendChild(this.linkCustomContainer);
        }

        this.linkSection.appendChild(dataPanel);

        this.titleTextEl.textContent = 'Connection Inspector';
        this.hideAllSections();
        this.linkSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = 'none';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = 'none';
        this.overflowBtn.style.display = 'none';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    showMultiLink(links: dia.Link[]) {
        this.detachMultiLink();
        if (links.length === 0) { this.hide(); return; }
        if (links.length === 1) { this.showLink(links[0]); return; }

        const primary = links[0];
        const extras = links.slice(1);

        this.showLink(primary);
        // showLink calls detachMultiLink, so set extras AFTER it returns.
        this.multiLinkExtras = extras;

        // Style props mirrored to all other selected connections whenever the
        // primary connection changes. Design-only — Data/meta stays per-link.
        const MIRRORED_PROPS = [
            'lineStyle', 'lineColor', 'lineThickness', 'lineOpacity',
            'arrowType', 'sourceArrowType',
            'arrowSize', 'sourceArrowSize', 'targetArrowSize',
            'router', 'connector',
        ];

        const mirror = () => {
            const lineAttrs = primary.attr('line');
            for (const l of extras) {
                if (!l.graph) continue;
                for (const k of MIRRORED_PROPS) {
                    const v = primary.get(k);
                    if (v !== undefined) l.set(k, v);
                }
                if (lineAttrs) l.attr('line', lineAttrs);
            }
        };

        primary.on('change', mirror);
        this.multiLinkDetach = () => primary.off('change', mirror);

        this.titleTextEl.textContent = `${links.length} Connections`;
    }

    private detachMultiLink() {
        if (this.multiLinkDetach) {
            this.multiLinkDetach();
            this.multiLinkDetach = null;
        }
        this.multiLinkExtras = [];
    }

    showLayer(canvasId: string, onUpdate?: () => void, onLayerTypeChange?: () => void) {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;
        this.currentLayerId = canvasId;

        const canvas = getCanvas(canvasId);
        if (!canvas) { this.hide(); return; }

        this.hideAllSections();
        this.duplicateBtn.parentElement!.style.display = 'none';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = 'none';
        this.overflowBtn.style.display = 'none';
        this.closeOverflowMenu();

        // Rebuild layer section
        this.layerSection.innerHTML = '';
        this.layerSection.style.display = '';

        // Layer title
        const { row: nameRow, input: nameInput } = this.buildRow(
            'layer-name', 'Layer Title', 'Layer title'
        );
        nameInput.value = canvas.name;
        nameInput.addEventListener('input', () => {
            updateCanvas(canvasId, { name: nameInput.value });
            onUpdate?.();
        });
        this.layerSection.appendChild(nameRow);

        // Layer type
        const layerTypeDt = getDataType('layer-type');
        const typeOptions = layerTypeDt
            ? layerTypeDt.fields.map(f => f.key)
            : ['Infrastructure', 'Workloads'];

        const { row: typeRow, select: typeSelect } = this.buildSelectRow(
            'layer-type', 'Layer Type', typeOptions
        );
        typeSelect.value = canvas.layerType || '';
        typeSelect.addEventListener('change', () => {
            updateCanvas(canvasId, { layerType: typeSelect.value });
            onLayerTypeChange?.();
        });
        this.layerSection.appendChild(typeRow);

        this.titleTextEl.textContent = 'Layer Properties';
        this.el.classList.remove('inspector-hidden');
    }

    showMultiZone(zones: dia.Element[]) {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;
        this.currentLayerId = null;
        this.multiZoneTargets = zones;

        const firstSize = zones[0].size();
        const allSameWidth = zones.every(z => z.size().width === firstSize.width);
        const allSameHeight = zones.every(z => z.size().height === firstSize.height);

        this.multiZoneWidthInput.value = allSameWidth ? String(Math.round(firstSize.width / GRID_SIZE)) : '';
        this.multiZoneHeightInput.value = allSameHeight ? String(Math.round(firstSize.height / GRID_SIZE)) : '';
        this.multiZoneWidthInput.placeholder = allSameWidth ? '' : 'mixed';
        this.multiZoneHeightInput.placeholder = allSameHeight ? '' : 'mixed';

        this.titleTextEl.textContent = `${zones.length} Zones`;
        this.hideAllSections();
        this.multiZoneSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = 'none';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = 'none';
        this.overflowBtn.style.display = 'none';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    private applyMultiZoneSize() {
        const wVal = this.multiZoneWidthInput.value.trim();
        const hVal = this.multiZoneHeightInput.value.trim();
        const w = wVal ? Math.max(1, parseInt(wVal, 10)) * GRID_SIZE : 0;
        const h = hVal ? Math.max(1, parseInt(hVal, 10)) * GRID_SIZE : 0;
        for (const zone of this.multiZoneTargets) {
            if (!zone.graph) continue;
            const cur = zone.size();
            zone.resize(w || cur.width, h || cur.height);
        }
    }

    private applyAccentColor(cell: IsometricShape, color: string): void {
        const meta = cell.get(META_KEY) as Record<string, unknown> | undefined;
        const shapeKey = (meta?.shapeType as string) || '';
        const def = ShapeRegistry[shapeKey] as ShapeDefinition | undefined;
        if (!def) return;

        const entry0 = getPaletteIcon(def);
        const defBgColor = entry0?.bgColor || '';
        const defHref = entry0?.href;
        const effectiveColor = color || defBgColor || '';

        if (defHref) {
            if (color) {
                const prefix = 'data:image/svg+xml;charset=utf-8,';
                let svgStr = decodeURIComponent(defHref.slice(prefix.length));

                if (defBgColor && svgStr.includes(`fill="${defBgColor}"`)) {
                    svgStr = svgStr.replace(
                        `fill="${defBgColor}"`,
                        `fill="${color}"`
                    );
                } else if (entry0) {
                    // Background element not present — insert one before
                    // the first <image or closing tag.
                    const bgShape = entry0.bgShape ?? 'circle';
                    const iconSizePx = (entry0.size ?? 1) * GRID_SIZE;
                    const bgSizePx = (entry0.bgSize ?? entry0.size ?? 1) * GRID_SIZE;
                    const canvasPx = Math.max(iconSizePx, bgSizePx);
                    const off = (canvasPx - bgSizePx) / 2;
                    let bgEl: string;
                    if (bgShape === 'circle') {
                        bgEl = `<circle cx="${off + bgSizePx / 2}" cy="${off + bgSizePx / 2}" r="${bgSizePx / 2}" fill="${color}"/>`;
                    } else if (bgShape === 'octagon') {
                        const c = bgSizePx * (entry0.bgChamfer ?? 0.18);
                        bgEl = `<polygon points="${off + c},${off} ${off + bgSizePx - c},${off} ${off + bgSizePx},${off + c} ${off + bgSizePx},${off + bgSizePx - c} ${off + bgSizePx - c},${off + bgSizePx} ${off + c},${off + bgSizePx} ${off},${off + bgSizePx - c} ${off},${off + c}" fill="${color}"/>`;
                    } else {
                        const rx = entry0.bgRadius ?? 6;
                        bgEl = `<rect x="${off}" y="${off}" width="${bgSizePx}" height="${bgSizePx}" rx="${rx}" fill="${color}"/>`;
                    }
                    const insertPos = svgStr.indexOf('><') + 1;
                    if (insertPos > 0) {
                        svgStr = svgStr.slice(0, insertPos) + bgEl + svgStr.slice(insertPos);
                    }
                }
                const newHref = prefix + encodeURIComponent(svgStr);
                cell.attr('topIcon/href', newHref);
                cell.attr('topIcon2D/href', newHref);
            } else if (defBgColor && entry0) {
                // Reset to default: ensure the definition's bg color is present.
                const prefix = 'data:image/svg+xml;charset=utf-8,';
                let svgStr = decodeURIComponent(defHref.slice(prefix.length));
                if (!svgStr.includes(`fill="${defBgColor}"`)) {
                    const bgShape = entry0.bgShape ?? 'circle';
                    const iconSizePx = (entry0.size ?? 1) * GRID_SIZE;
                    const bgSizePx = (entry0.bgSize ?? entry0.size ?? 1) * GRID_SIZE;
                    const canvasPx = Math.max(iconSizePx, bgSizePx);
                    const off = (canvasPx - bgSizePx) / 2;
                    let bgEl: string;
                    if (bgShape === 'circle') {
                        bgEl = `<circle cx="${off + bgSizePx / 2}" cy="${off + bgSizePx / 2}" r="${bgSizePx / 2}" fill="${defBgColor}"/>`;
                    } else if (bgShape === 'octagon') {
                        const c = bgSizePx * (entry0.bgChamfer ?? 0.18);
                        bgEl = `<polygon points="${off + c},${off} ${off + bgSizePx - c},${off} ${off + bgSizePx},${off + c} ${off + bgSizePx},${off + bgSizePx - c} ${off + bgSizePx - c},${off + bgSizePx} ${off + c},${off + bgSizePx} ${off},${off + bgSizePx - c} ${off},${off + c}" fill="${defBgColor}"/>`;
                    } else {
                        const rx = entry0.bgRadius ?? 6;
                        bgEl = `<rect x="${off}" y="${off}" width="${bgSizePx}" height="${bgSizePx}" rx="${rx}" fill="${defBgColor}"/>`;
                    }
                    const insertPos = svgStr.indexOf('><') + 1;
                    if (insertPos > 0) {
                        svgStr = svgStr.slice(0, insertPos) + bgEl + svgStr.slice(insertPos);
                    }
                }
                const restoredHref = prefix + encodeURIComponent(svgStr);
                cell.attr('topIcon/href', restoredHref);
                cell.attr('topIcon2D/href', restoredHref);
            } else {
                cell.attr('topIcon/href', defHref);
                cell.attr('topIcon2D/href', defHref);
            }
        }

        if ((def.layers?.length ?? 0) > 1) {
            const children = cell.getEmbeddedCells();
            for (const child of children) {
                if (child.get('componentRole') === 'child') {
                    child.attr('top/fill', effectiveColor);
                }
            }
        }
    }

    private hideAllSections(): void {
        this.nodeSection.style.display = 'none';
        this.zoneSection.style.display = 'none';
        this.linkSection.style.display = 'none';
        this.areaSection.style.display = 'none';
        this.labelSection.style.display = 'none';
        this.iconSection.style.display = 'none';
        this.layerSection.style.display = 'none';
        this.multiZoneSection.style.display = 'none';
    }

    showArea(el: dia.Element): void {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;

        // Drop any previous areaCorners change listener before rebuilding.
        this.areaCornerSyncCleanup?.();
        this.areaCornerSyncCleanup = null;

        this.areaSection.innerHTML = '';

        const propsPanel = document.createElement('div');
        const notesPanel = document.createElement('div');
        notesPanel.className = 'inspector-notes-panel';
        const tabs = this.buildTabBar([
            { label: 'Properties', panel: propsPanel },
            { label: 'Notes', panel: notesPanel },
        ]);
        this.areaSection.appendChild(tabs);

        const accordion = document.createElement('ul');
        accordion.className = 'cds--accordion';

        // ── Design section ─────────────────────────────────────────────
        const { li: designLi, body: designBody } = this.buildAccordionSection('Design');
        accordion.appendChild(designLi);

        // Name
        const { row: nameRow, input: nameInput } = this.buildRow('area-name', 'Name', 'Area');
        nameInput.value = (el.attr('label/text') as string) || '';
        nameInput.addEventListener('input', () => { el.attr('label/text', nameInput.value); });
        designBody.appendChild(nameRow);

        // Label Position
        designBody.appendChild(this.buildAreaLabelPositionRow(el));

        // ── Fill color picker ──────────────────────────────────────────
        const areaColor = (el.get('areaColor') as string) || '#0043CE';
        const applyFill = () => {
            const col = (el.get('areaColor') as string) || '#0043CE';
            const opacity = parseFloat(String(el.get('areaOpacity') ?? 50)) / 100;
            const r = parseInt(col.slice(1, 3), 16);
            const g = parseInt(col.slice(3, 5), 16);
            const b = parseInt(col.slice(5, 7), 16);
            el.attr('body/fill', `rgba(${r},${g},${b},${opacity})`);
            el.attr('label/fill', col);
        };
        const colorRow = document.createElement('div');
        colorRow.className = 'inspector-row';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Fill Color';
        colorRow.appendChild(colorLabel);
        const hexWrap = this.buildColorPicker(areaColor, (c) => {
            el.set('areaColor', c);
            applyFill();
        });
        colorRow.appendChild(hexWrap);
        designBody.appendChild(colorRow);

        // Opacity
        const { row: opacityRow } = this.buildStepperRow('Opacity', 0, 100, 5, el.get('areaOpacity') ?? 50, (v) => {
            el.set('areaOpacity', v);
            applyFill();
        });
        designBody.appendChild(opacityRow);

        // ── Outline section ────────────────────────────────────────────
        const { li: outlineLi, body: outlineBody } = this.buildAccordionSection('Outline');
        accordion.appendChild(outlineLi);

        // Outline style dropdown
        const outlineStyleRow = document.createElement('div');
        outlineStyleRow.className = 'inspector-row';
        const outlineStyleLabel = document.createElement('label');
        outlineStyleLabel.textContent = 'Style';
        outlineStyleRow.appendChild(outlineStyleLabel);
        const outlineSelect = document.createElement('select');
        outlineSelect.style.flex = '0 0 160px';
        outlineSelect.style.width = '160px';
        for (const [val, txt] of [['none', 'None'], ['dotted', 'Dotted'], ['square-dotted', 'Square Dotted'], ['dashed', 'Dashed'], ['solid', 'Solid']]) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            outlineSelect.appendChild(opt);
        }
        outlineSelect.value = (el.get('outlineStyle') as string) || 'none';

        const applyOutline = () => {
            const style = outlineSelect.value;
            const thickness = parseFloat(thicknessInput.value);
            const color = (el.get('outlineColor') as string) || '#8d8d8d';
            if (style === 'none') {
                el.attr('body/stroke', 'none');
                el.attr('body/stroke-width', 0);
                el.attr('body/stroke-dasharray', null);
                el.attr('body/stroke-linecap', null);
            } else {
                el.attr('body/stroke', color);
                el.attr('body/stroke-width', thickness);
                if (style === 'dotted') {
                    el.attr('body/stroke-dasharray', `0 ${thickness * 2.5}`);
                    el.attr('body/stroke-linecap', 'round');
                } else if (style === 'square-dotted') {
                    el.attr('body/stroke-dasharray', `${thickness} ${thickness * 2}`);
                    el.attr('body/stroke-linecap', 'butt');
                } else if (style === 'dashed') {
                    el.attr('body/stroke-dasharray', `${thickness * 4} ${thickness * 2.5}`);
                    el.attr('body/stroke-linecap', 'butt');
                } else {
                    el.attr('body/stroke-dasharray', null);
                    el.attr('body/stroke-linecap', null);
                }
            }
            el.set('outlineStyle', style);
            el.set('outlineThickness', thickness);
            outlineDetailsEl.style.display = style === 'none' ? 'none' : '';
        };

        outlineSelect.addEventListener('change', applyOutline);
        outlineStyleRow.appendChild(outlineSelect);
        outlineBody.appendChild(outlineStyleRow);

        // Details container (hidden when style = none)
        const outlineDetailsEl = document.createElement('div');
        outlineDetailsEl.style.display = (el.get('outlineStyle') || 'none') === 'none' ? 'none' : '';

        // Outline thickness
        const { row: thicknessRow, input: thicknessInput } = this.buildStepperRow(
            'Thickness', 0.5, 6, 0.5, el.get('outlineThickness') ?? 1, () => applyOutline()
        );
        outlineDetailsEl.appendChild(thicknessRow);

        // Outline color
        const outColorRow = document.createElement('div');
        outColorRow.className = 'inspector-row';
        const outColorLabel = document.createElement('label');
        outColorLabel.textContent = 'Color';
        outColorRow.appendChild(outColorLabel);
        const outColorWrap = this.buildColorPicker(
            (el.get('outlineColor') as string) || '#8d8d8d',
            (c) => { el.set('outlineColor', c); applyOutline(); }
        );
        outColorRow.appendChild(outColorWrap);
        outlineDetailsEl.appendChild(outColorRow);

        outlineBody.appendChild(outlineDetailsEl);

        // ── Corner section (areas only, not double arrows) ──────────────
        const isDoubleArrow = !!el.get('isDoubleArrow');
        const { li: cornerLi, body: cornerBody } = this.buildAccordionSection('Corners');
        if (!isDoubleArrow) accordion.appendChild(cornerLi);

        const CK = ['tl', 'tr', 'bl', 'br'] as const;
        // Migrate legacy single-value fields into per-corner data.
        // Default is "default" (= plain rectangle, no corner mods).
        let saved = el.get('areaCorners') as Record<string, { style: string; radius: number }> | undefined;
        if (!saved || !saved.tl) {
            const legacyStyle = (el.get('cornerStyle') as string) || 'default';
            const legacyRadius = (el.get('areaRadius') as number) ?? 0;
            saved = {};
            for (const k of CK) saved[k] = { style: legacyStyle, radius: legacyRadius };
            el.set('areaCorners', saved);
            el.unset('cornerStyle');
            el.unset('areaRadius');
        }

        const cornerVals: Record<string, { style: string; radius: number }> = {};
        for (const k of CK) cornerVals[k] = { ...saved[k] };

        const allSame = CK.every(k => cornerVals[k].radius === cornerVals.tl.radius);
        let independent = !allSame;

        const cornerSvg = carbonIconToString(Corner16 as CarbonIcon);
        const rotIcon = (deg: number) => `<span style="display:inline-flex;transform:rotate(${deg}deg)">${cornerSvg}</span>`;

        const applyAllCorners = () => {
            // Single source of truth: the area's `bodyPath` :d binding reads
            // `areaCorners` and re-renders. No direct body/d manipulation.
            // Drop any legacy body/d carried over from older builds so the
            // binding can take effect.
            if (el.attr('body/d') != null) el.removeAttr('body/d');
            el.set('areaCorners', { ...cornerVals });
            updateRadiusVisibility();
            // Inform the canvas so it can refresh the corner-radius diamond
            // tools (which depend on the style: default → none, otherwise →
            // shown). Listener lives in system-designer.ts.
            document.dispatchEvent(new CustomEvent('nextrack:area-corners-style-changed', { detail: { cellId: el.id } }));
        };

        // ── Style dropdown (shared) ────────────────────────────────────
        const styleRow = document.createElement('div');
        styleRow.className = 'inspector-row';
        const styleLbl = document.createElement('label');
        styleLbl.textContent = 'Style';
        styleRow.appendChild(styleLbl);
        const cornerStyleSelect = document.createElement('select');
        cornerStyleSelect.style.flex = '0 0 160px';
        cornerStyleSelect.style.width = '160px';
        for (const [val, txt] of [['default', 'Default'], ['rounded', 'Rounded'], ['cut', 'Cut']]) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            cornerStyleSelect.appendChild(opt);
        }
        cornerStyleSelect.value = cornerVals.tl.style;
        cornerStyleSelect.addEventListener('change', () => {
            for (const k of CK) cornerVals[k].style = cornerStyleSelect.value;
            applyAllCorners();
        });
        styleRow.appendChild(cornerStyleSelect);
        cornerBody.appendChild(styleRow);

        // ── Radius row: stepper (134px) + Select02 toggle (26px) = 160px
        const select02Icon = carbonIconToString(Select0216 as CarbonIcon);

        const indepInputs: Record<string, HTMLInputElement> = {};
        const { row: uniRadRow, input: uniRadInput } = this.buildStepperRow('Radius', 0, 40, 1, cornerVals.tl.radius, () => {
            if (independent) return;
            const v = parseFloat(uniRadInput.value) || 0;
            for (const k of CK) cornerVals[k].radius = v;
            applyAllCorners();
        });

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'nr-ad__number-btn nr-corner-toggle-btn' + (independent ? ' nr-corner-toggle--active' : '');
        toggleBtn.title = 'Independent corners';
        toggleBtn.innerHTML = select02Icon;
        // The Independent toggle is meaningless in polygon mode (the grid
        // would just stay hidden); drop it from the UI entirely there.
        if (((el.get('normalizedVerts') as [number, number][]) ?? []).length >= 3) {
            toggleBtn.style.display = 'none';
        }

        const uniStepper = uniRadRow.querySelector<HTMLElement>('.nr-ad__number-stepper');
        if (uniStepper) uniStepper.appendChild(toggleBtn);
        cornerBody.appendChild(uniRadRow);

        // Polygon mode: radius is set per-vertex by the yellow on-canvas
        // diamonds, not by the inspector — only the style dropdown remains
        // relevant. Default style: radius is meaningless (plain rect/path).
        // Style change still flows through applyAllCorners → areaCorners.tl.style.
        const hasCustomPath = ((el.get('normalizedVerts') as [number, number][]) ?? []).length >= 3;
        const isDefaultStyle = cornerVals.tl.style === 'default';
        const updateRadiusVisibility = () => {
            const hideRadius = hasCustomPath || cornerVals.tl.style === 'default';
            uniRadRow.style.display = hideRadius ? 'none' : '';
            indepWrap.style.display = (independent && !hideRadius) ? '' : 'none';
        };
        if (hasCustomPath || isDefaultStyle) uniRadRow.style.display = 'none';

        // ── Independent corner inputs (2×2 grid) ──────────────────────
        const indepWrap = document.createElement('div');
        indepWrap.className = 'nr-corner-grid';
        indepWrap.style.display = (independent && !hasCustomPath) ? '' : 'none';
        const cornerDeg: Record<string, number> = { tl: 0, tr: 90, br: 180, bl: 270 };

        const gridEl = document.createElement('div');
        // Grid layout handled by CSS (.nr-corner-grid > div)

        for (const k of CK) {
            const { row: cRow, input: cInput } = this.buildStepperRow('', 0, 40, 1, cornerVals[k].radius, () => {
                cornerVals[k].radius = parseFloat(cInput.value) || 0;
                applyAllCorners();
                syncUnifiedDisplay();
            });
            const lbl = cRow.querySelector('label');
            if (lbl) lbl.style.display = 'none';
            const cStepper = cRow.querySelector<HTMLElement>('.nr-ad__number-stepper');
            if (cStepper) {
                cStepper.style.maxWidth = '100%';
                const iconBtn = document.createElement('span');
                iconBtn.className = 'nr-ad__number-btn nr-corner-icon-btn';
                iconBtn.innerHTML = rotIcon(cornerDeg[k]);
                cStepper.insertBefore(iconBtn, cStepper.firstChild);
            }
            indepInputs[k] = cInput;
            gridEl.appendChild(cRow);
        }
        indepWrap.appendChild(gridEl);
        cornerBody.appendChild(indepWrap);

        const uniDispEl = uniRadRow.querySelector<HTMLInputElement>('.nr-sd-number-display');
        const uniButtons = uniRadRow.querySelectorAll<HTMLButtonElement>('.nr-ad__number-btn:not(.nr-corner-toggle-btn)');

        const setUnifiedReadOnly = (ro: boolean) => {
            if (uniDispEl) { uniDispEl.readOnly = ro; uniDispEl.style.opacity = ro ? '0.5' : ''; }
            uniButtons.forEach(b => { b.disabled = ro; b.style.opacity = ro ? '0.3' : ''; });
        };

        const syncUnifiedDisplay = () => {
            const vals = CK.map(k => cornerVals[k].radius);
            const allEqual = vals.every(v => v === vals[0]);
            if (uniDispEl) uniDispEl.value = allEqual ? `${vals[0]}px` : 'Mixed';
            uniRadInput.value = allEqual ? String(vals[0]) : '';
        };

        const setIndepMode = (on: boolean) => {
            independent = on;
            indepWrap.style.display = on ? '' : 'none';
            toggleBtn.classList.toggle('nr-corner-toggle--active', on);
            setUnifiedReadOnly(on);
            if (on) {
                const v = parseFloat(uniRadInput.value) || 0;
                for (const k of CK) {
                    cornerVals[k].radius = v;
                    indepInputs[k].value = String(v);
                    const d = indepInputs[k].closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
                    if (d) d.value = `${v}px`;
                }
                syncUnifiedDisplay();
                applyAllCorners();
            } else {
                const avg = Math.round(CK.reduce((s, k) => s + cornerVals[k].radius, 0) / 4);
                for (const k of CK) cornerVals[k].radius = avg;
                uniRadInput.value = String(avg);
                if (uniDispEl) uniDispEl.value = `${avg}px`;
                applyAllCorners();
            }
        };

        toggleBtn.addEventListener('click', () => setIndepMode(!independent));
        if (independent) {
            syncUnifiedDisplay();
            setUnifiedReadOnly(true);
        }

        // Reflect external `areaCorners` mutations (yellow on-canvas radius
        // handles) back into the steppers. Compares per-key so the sliders
        // only repaint when something actually changed.
        const syncFromModel = () => {
            const fromModel = el.get('areaCorners') as Record<string, { style: string; radius: number }> | undefined;
            if (!fromModel) return;
            let dirty = false;
            for (const k of CK) {
                const spec = fromModel[k];
                if (!spec) continue;
                if (spec.radius !== cornerVals[k].radius || spec.style !== cornerVals[k].style) {
                    cornerVals[k] = { ...spec };
                    indepInputs[k].value = String(spec.radius);
                    const d = indepInputs[k].closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
                    if (d) d.value = `${spec.radius}px`;
                    dirty = true;
                }
            }
            if (dirty) syncUnifiedDisplay();
        };
        el.on('change:areaCorners', syncFromModel);
        this.areaCornerSyncCleanup = () => el.off('change:areaCorners', syncFromModel);

        propsPanel.appendChild(accordion);
        this.areaSection.appendChild(propsPanel);

        // Notes
        const { row: notesRow, input: notesInput } = this.buildRow('area-notes', 'Notes', 'Notes', true);
        (notesInput as HTMLTextAreaElement).value = String(el.get('areaNotes') ?? '');
        notesInput.addEventListener('input', () => { el.set('areaNotes', notesInput.value); });
        notesPanel.appendChild(notesRow);
        this.areaSection.appendChild(notesPanel);

        this.titleTextEl.textContent = 'Area Inspector';
        this.hideAllSections();
        this.areaSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = '';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = '';
        this.deleteBtn.textContent = 'Delete';
        this.overflowBtn.style.display = '';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    /**
     * Dedicated inspector for DoubleArrow. Kept separate from `showArea`
     * because the two shapes share no domain logic beyond rendering generic
     * style properties — mixing them led to crashes (Edit-Path actions
     * triggered for arrows that have no path-edit code) and stale UI
     * (Area's blue/50%-opacity defaults shown for a grey arrow). Reads
     * canonical state from the model via `el.get(...)` so the inspector and
     * canvas stay in sync via the same chokepoints used everywhere else.
     */
    showDoubleArrow(el: dia.Element): void {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;

        // DoubleArrow has no Corner accordion → no corner sync listener.
        this.areaCornerSyncCleanup?.();
        this.areaCornerSyncCleanup = null;

        this.areaSection.innerHTML = '';

        const propsPanel = document.createElement('div');
        const notesPanel = document.createElement('div');
        notesPanel.className = 'inspector-notes-panel';
        const tabs = this.buildTabBar([
            { label: 'Properties', panel: propsPanel },
            { label: 'Notes', panel: notesPanel },
        ]);
        this.areaSection.appendChild(tabs);

        const accordion = document.createElement('ul');
        accordion.className = 'cds--accordion';

        // ── Design section ─────────────────────────────────────────────
        const { li: designLi, body: designBody } = this.buildAccordionSection('Design');
        accordion.appendChild(designLi);

        // Name
        const { row: nameRow, input: nameInput } = this.buildRow('arrow-name', 'Name', 'Double Arrow');
        nameInput.value = (el.attr('label/text') as string) || '';
        nameInput.addEventListener('input', () => { el.attr('label/text', nameInput.value); });
        designBody.appendChild(nameRow);

        // Label Position (shared helper — works for any rect-bounded shape)
        designBody.appendChild(this.buildAreaLabelPositionRow(el));

        // Fill color + opacity → chokepoint
        const applyFill = () => {
            const col = (el.get('areaColor') as string) || '#525252';
            const opacity = parseFloat(String(el.get('areaOpacity') ?? 50)) / 100;
            const r = parseInt(col.slice(1, 3), 16);
            const g = parseInt(col.slice(3, 5), 16);
            const b = parseInt(col.slice(5, 7), 16);
            el.attr('body/fill', `rgba(${r},${g},${b},${opacity})`);
            el.attr('label/fill', col);
        };
        const colorRow = document.createElement('div');
        colorRow.className = 'inspector-row';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Fill Color';
        colorRow.appendChild(colorLabel);
        const hexWrap = this.buildColorPicker(
            (el.get('areaColor') as string) || '#525252',
            (c) => { el.set('areaColor', c); applyFill(); },
        );
        colorRow.appendChild(hexWrap);
        designBody.appendChild(colorRow);

        const { row: opacityRow } = this.buildStepperRow('Opacity', 0, 100, 1, el.get('areaOpacity') ?? 50, (v) => {
            el.set('areaOpacity', v);
            applyFill();
        });
        designBody.appendChild(opacityRow);

        // ── Outline section ────────────────────────────────────────────
        const { li: outlineLi, body: outlineBody } = this.buildAccordionSection('Outline');
        accordion.appendChild(outlineLi);

        const outlineStyleRow = document.createElement('div');
        outlineStyleRow.className = 'inspector-row';
        const outlineStyleLabel = document.createElement('label');
        outlineStyleLabel.textContent = 'Style';
        outlineStyleRow.appendChild(outlineStyleLabel);
        const outlineSelect = document.createElement('select');
        outlineSelect.style.flex = '0 0 160px';
        outlineSelect.style.width = '160px';
        for (const [val, txt] of [['none', 'None'], ['dotted', 'Dotted'], ['square-dotted', 'Square Dotted'], ['dashed', 'Dashed'], ['solid', 'Solid']]) {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            outlineSelect.appendChild(opt);
        }
        outlineSelect.value = (el.get('outlineStyle') as string) || 'none';

        const applyOutline = () => {
            const style = outlineSelect.value;
            const thickness = parseFloat(thicknessInput.value);
            const color = (el.get('outlineColor') as string) || '#8d8d8d';
            if (style === 'none') {
                el.attr('body/stroke', 'none');
                el.attr('body/stroke-width', 0);
                el.attr('body/stroke-dasharray', null);
                el.attr('body/stroke-linecap', null);
            } else {
                el.attr('body/stroke', color);
                el.attr('body/stroke-width', thickness);
                if (style === 'dotted') {
                    el.attr('body/stroke-dasharray', `0 ${thickness * 2.5}`);
                    el.attr('body/stroke-linecap', 'round');
                } else if (style === 'square-dotted') {
                    el.attr('body/stroke-dasharray', `${thickness} ${thickness * 2}`);
                    el.attr('body/stroke-linecap', 'butt');
                } else if (style === 'dashed') {
                    el.attr('body/stroke-dasharray', `${thickness * 4} ${thickness * 2.5}`);
                    el.attr('body/stroke-linecap', 'butt');
                } else {
                    el.attr('body/stroke-dasharray', null);
                    el.attr('body/stroke-linecap', null);
                }
            }
            el.set('outlineStyle', style);
            el.set('outlineThickness', thickness);
            outlineDetailsEl.style.display = style === 'none' ? 'none' : '';
        };

        outlineSelect.addEventListener('change', applyOutline);
        outlineStyleRow.appendChild(outlineSelect);
        outlineBody.appendChild(outlineStyleRow);

        const outlineDetailsEl = document.createElement('div');
        outlineDetailsEl.style.display = ((el.get('outlineStyle') as string) || 'none') === 'none' ? 'none' : '';

        const { row: thicknessRow, input: thicknessInput } = this.buildStepperRow(
            'Thickness', 0.5, 6, 0.5, el.get('outlineThickness') ?? 2, () => applyOutline(),
        );
        outlineDetailsEl.appendChild(thicknessRow);

        const outColorRow = document.createElement('div');
        outColorRow.className = 'inspector-row';
        const outColorLabel = document.createElement('label');
        outColorLabel.textContent = 'Color';
        outColorRow.appendChild(outColorLabel);
        const outColorWrap = this.buildColorPicker(
            (el.get('outlineColor') as string) || '#8d8d8d',
            (c) => { el.set('outlineColor', c); applyOutline(); },
        );
        outColorRow.appendChild(outColorWrap);
        outlineDetailsEl.appendChild(outColorRow);

        outlineBody.appendChild(outlineDetailsEl);

        propsPanel.appendChild(accordion);
        this.areaSection.appendChild(propsPanel);

        // Notes
        const { row: notesRow, input: notesInput } = this.buildRow('arrow-notes', 'Notes', 'Notes', true);
        (notesInput as HTMLTextAreaElement).value = String(el.get('areaNotes') ?? '');
        notesInput.addEventListener('input', () => { el.set('areaNotes', notesInput.value); });
        notesPanel.appendChild(notesRow);
        this.areaSection.appendChild(notesPanel);

        this.titleTextEl.textContent = 'Double Arrow Inspector';
        this.hideAllSections();
        this.areaSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = '';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = '';
        this.deleteBtn.textContent = 'Delete';
        this.overflowBtn.style.display = '';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    showIcon(el: dia.Element): void {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;

        this.iconSection.innerHTML = '';

        const propsPanel = document.createElement('div');
        const tabs = this.buildTabBar([
            { label: 'Properties', panel: propsPanel },
        ]);
        this.iconSection.appendChild(tabs);

        const accordion = document.createElement('ul');
        accordion.className = 'cds--accordion';

        const { li: designLi, body: designBody } = this.buildAccordionSection('Design');
        accordion.appendChild(designLi);

        const currentHref = (el.get('iconData') as string) || '';
        const currentSvg = (el.get('iconSvgRaw') as string) || '';

        // Compact file row (same pattern as component-designer SVG footprint)
        const fileRow = document.createElement('div');
        fileRow.className = 'inspector-row';
        const fileLbl = document.createElement('label');
        fileLbl.textContent = 'File';
        fileRow.appendChild(fileLbl);

        const controlWrap = document.createElement('div');
        controlWrap.className = 'nr-svgfp-control';

        const preview = document.createElement('div');
        preview.className = 'nr-svgfp-preview';

        const rebuildFileRow = () => {
            controlWrap.innerHTML = '';
            const href = (el.get('iconData') as string) || '';
            const svgRaw = (el.get('iconSvgRaw') as string) || '';

            if (href) {
                const fileName = document.createElement('span');
                fileName.className = 'nr-svgfp-name';
                fileName.textContent = (el.get('iconFileName') as string) || 'icon.svg';
                fileName.title = fileName.textContent;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'nr-svgfp-remove-btn';
                removeBtn.title = 'Remove';
                removeBtn.setAttribute('aria-label', 'Remove icon');
                removeBtn.innerHTML = '<svg viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="M12 12h2v12h-2zm6 0h2v12h-2z"/><path d="M4 6v2h2v19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 21V8h16v19zm4-26h8v2h-8z"/></svg>';
                removeBtn.addEventListener('click', () => {
                    el.attr('iconImage/href', null);
                    el.attr('iconFlat/href', null);
                    el.set('iconData', null);
                    el.set('iconSvgRaw', null);
                    el.set('iconFileName', null);
                    el.set('iconSource', null);
                    el.set('iconStanding', false);
                    el.set('iconFace', 'front');
                    el.attr('iconImage/transform', null);
                    syncIconColorClass(el, undefined);
                    preview.innerHTML = '';
                    preview.style.display = 'none';
                    rebuildFileRow();
                    rebuildStandRow();
                });
                controlWrap.appendChild(fileName);
                controlWrap.appendChild(removeBtn);

                preview.innerHTML = svgRaw || '';
                preview.style.display = svgRaw ? '' : 'none';
            } else {
                const emptySpan = document.createElement('span');
                emptySpan.className = 'nr-svgfp-name nr-svgfp-name--empty';
                emptySpan.textContent = 'No file';

                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.svg,image/svg+xml';
                fileInput.style.display = 'none';
                fileInput.addEventListener('change', () => {
                    const file = fileInput.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                        const svgText = reader.result as string;
                        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
                        el.attr('iconImage/href', dataUrl);
                        el.attr('iconFlat/href', dataUrl);
                        el.set('iconData', dataUrl);
                        el.set('iconSvgRaw', svgText);
                        el.set('iconFileName', file.name);
                        el.set('iconSource', 'uploaded');
                        syncIconColorClass(el, 'uploaded');
                        rebuildFileRow();
                        rebuildStandRow();
                    };
                    reader.readAsText(file);
                });

                const uploadBtn = document.createElement('label');
                uploadBtn.className = 'nr-svgfp-upload-btn';
                uploadBtn.textContent = 'Upload';
                uploadBtn.addEventListener('click', () => fileInput.click());

                controlWrap.appendChild(emptySpan);
                controlWrap.appendChild(fileInput);
                controlWrap.appendChild(uploadBtn);
                preview.style.display = 'none';
            }
        };

        rebuildFileRow();
        fileRow.appendChild(controlWrap);
        designBody.appendChild(fileRow);
        designBody.appendChild(preview);

        // Design Icons library (IDB-backed; managed in Admin)
        const designIcons = getDesignIconEntries();
        if (designIcons.length > 0) {
            const gridSection = document.createElement('div');
            gridSection.style.marginTop = '8px';

            const gridLabel = document.createElement('label');
            gridLabel.textContent = 'Design Icons';
            gridLabel.style.display = 'block';
            gridLabel.style.fontSize = '0.8125rem';
            gridLabel.style.marginBottom = '6px';
            gridLabel.style.color = 'var(--cds-text-primary, #161616)';
            gridSection.appendChild(gridLabel);

            const iconGrid = document.createElement('div');
            iconGrid.className = 'nr-sd-icon-grid';

            const applyDesignIcon = (icon: IconCatalogEntry) => {
                const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(icon.svg);
                el.attr('iconImage/href', dataUrl);
                el.attr('iconFlat/href', dataUrl);
                el.set('iconData', dataUrl);
                el.set('iconSvgRaw', icon.svg);
                el.set('iconFileName', icon.label + '.svg');
                el.set('iconSource', icon.source);
                syncIconColorClass(el, icon.source);
                rebuildFileRow();
                rebuildStandRow();
                applyIconStanding(el, !!(el.get('iconStanding')));
            };

            for (const icon of designIcons) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'nr-sd-icon-btn';
                btn.title = icon.label;
                btn.innerHTML = icon.svg;
                btn.addEventListener('click', () => {
                    iconGrid.querySelectorAll('.nr-sd-icon-btn').forEach(b =>
                        b.classList.remove('nr-sd-icon-btn--selected')
                    );
                    btn.classList.add('nr-sd-icon-btn--selected');
                    applyDesignIcon(icon);
                });
                iconGrid.appendChild(btn);
            }

            gridSection.appendChild(iconGrid);
            designBody.appendChild(gridSection);
        }

        // Stand Up toggle
        const standRow = document.createElement('div');
        standRow.className = 'nr-sd-face-row';
        standRow.style.marginTop = '8px';

        // Face selector (Front / Side)
        const faceRow = document.createElement('div');
        faceRow.className = 'nr-sd-face-row';

        const rebuildStandRow = () => {
            standRow.innerHTML = '';
            faceRow.innerHTML = '';
            const hasIcon = !!(el.get('iconData'));
            standRow.style.display = hasIcon ? '' : 'none';
            faceRow.style.display = 'none';
            if (!hasIcon) return;

            const standLabel = document.createElement('span');
            standLabel.className = 'nr-sd-row-label';
            standLabel.textContent = 'Stand Up';
            standRow.appendChild(standLabel);

            const toggle = document.createElement('div');
            toggle.className = 'nr-toggle';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('role', 'switch');
            const isStanding = !!(el.get('iconStanding'));
            btn.setAttribute('aria-checked', String(isStanding));
            if (isStanding) toggle.classList.add('nr-toggle--checked');
            const track = document.createElement('span');
            track.className = 'nr-toggle__track';
            btn.appendChild(track);
            btn.addEventListener('click', () => {
                const next = !(el.get('iconStanding'));
                el.set('iconStanding', next);
                btn.setAttribute('aria-checked', String(next));
                toggle.classList.toggle('nr-toggle--checked', next);
                applyIconStanding(el, next);
                faceRow.style.display = next ? '' : 'none';
                showOffsetSliders();
            });
            toggle.appendChild(btn);
            standRow.appendChild(toggle);

            // Face switcher (only visible when standing)
            faceRow.style.display = isStanding ? '' : 'none';
            const faceLabel = document.createElement('span');
            faceLabel.className = 'nr-sd-row-label';
            faceLabel.textContent = 'Face';
            faceRow.appendChild(faceLabel);

            const faceSwitcher = document.createElement('div');
            faceSwitcher.className = 'nr-seg-control nr-seg-control--fixed';
            faceSwitcher.style.flex = '0 0 120px';
            const currentFace = (el.get('iconFace') as IconFace) || 'front';
            for (const opt of ['Front', 'Side'] as const) {
                const faceBtn = document.createElement('button');
                faceBtn.type = 'button';
                const val: IconFace = opt.toLowerCase() as IconFace;
                const active = val === currentFace;
                faceBtn.className = 'nr-seg-btn' + (active ? ' nr-seg-btn--selected' : '');
                faceBtn.textContent = opt;
                faceBtn.addEventListener('click', () => {
                    el.set('iconFace', val);
                    applyIconFaceTransform(el, val);
                    faceSwitcher.querySelectorAll('.nr-seg-btn').forEach(b =>
                        b.classList.toggle('nr-seg-btn--selected', b === faceBtn)
                    );
                });
                faceSwitcher.appendChild(faceBtn);
            }
            faceRow.appendChild(faceSwitcher);
        };

        const buildSlider = (label: string, key: string, defaultVal: number, min = -3, max = 3) => {
            const row = document.createElement('div');
            row.className = 'nr-sd-face-row';
            const sliderLabel = document.createElement('span');
            sliderLabel.className = 'nr-sd-row-label';
            sliderLabel.textContent = label;
            row.appendChild(sliderLabel);
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '6px';
            wrap.style.flex = '0 0 140px';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = String(min);
            slider.max = String(max);
            slider.step = '0.05';
            slider.value = String((el.get(key) as number) ?? defaultVal);
            slider.style.flex = '1';
            const valLabel = document.createElement('span');
            valLabel.style.fontSize = '0.75rem';
            valLabel.style.minWidth = '32px';
            valLabel.style.textAlign = 'right';
            valLabel.style.fontFamily = "'IBM Plex Mono', monospace";
            valLabel.textContent = parseFloat(slider.value).toFixed(2);
            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                el.set(key, v);
                valLabel.textContent = v.toFixed(2);
                applyIconFaceTransform(el, (el.get('iconFace') as IconFace) || 'front');
            });
            wrap.appendChild(slider);
            wrap.appendChild(valLabel);
            row.appendChild(wrap);
            return row;
        };

        const oxRow = buildSlider('Offset X', 'iconOffsetX', 0.22, -3, 3);
        const oyRow = buildSlider('Offset Y', 'iconOffsetY', -0.22, -3, 3);

        const showOffsetSliders = () => {
            const show = !!(el.get('iconStanding')) && !!(el.get('iconData'));
            oxRow.style.display = show ? '' : 'none';
            oyRow.style.display = show ? '' : 'none';
        };

        rebuildStandRow();
        showOffsetSliders();
        designBody.appendChild(standRow);
        designBody.appendChild(faceRow);
        designBody.appendChild(oxRow);
        designBody.appendChild(oyRow);

        // Apply standing state on initial show and sync flat image
        if (currentHref) {
            el.attr('iconFlat/href', currentHref);
            applyIconStanding(el, !!(el.get('iconStanding')));
            if (currentSvg) {
                preview.innerHTML = currentSvg;
                preview.style.display = '';
            }
        }

        propsPanel.appendChild(accordion);
        this.iconSection.appendChild(propsPanel);

        this.titleTextEl.textContent = 'Icon Inspector';
        this.hideAllSections();
        this.iconSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = '';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = '';
        this.deleteBtn.textContent = 'Delete';
        this.overflowBtn.style.display = '';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    showLabel(el: dia.Element): void {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;

        this.labelSection.innerHTML = '';

        const propsPanel = document.createElement('div');
        const tabs = this.buildTabBar([
            { label: 'Properties', panel: propsPanel },
        ]);
        this.labelSection.appendChild(tabs);

        const accordion = document.createElement('ul');
        accordion.className = 'cds--accordion';

        const { li: designLi, body: designBody } = this.buildAccordionSection('Design');
        accordion.appendChild(designLi);

        // Text
        const { row: textRow, input: textInput } = this.buildRow('label-text', 'Text', 'Label');
        textInput.value = (el.attr('label/text') as string) || '';
        textInput.addEventListener('input', () => {
            el.attr('label/text', textInput.value || 'Label');
        });
        designBody.appendChild(textRow);

        // Color picker
        const labelColor = (el.get('labelColor') as string) || '#525252';
        const colorRow = document.createElement('div');
        colorRow.className = 'inspector-row';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Color';
        colorRow.appendChild(colorLabel);
        const hexWrap = document.createElement('div');
        hexWrap.className = 'nr-sd-hex-input-wrap';
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'nr-sd-hex-input';
        hexInput.readOnly = true;
        hexInput.style.cursor = 'pointer';
        hexInput.value = labelColor;
        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'nr-sd-hex-color-btn';
        colorBtn.style.backgroundColor = labelColor;
        const popup = document.createElement('div');
        popup.className = 'nr-sd-color-popup';
        popup.style.display = 'none';
        for (const c of PRIMARY_COLORS) {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'nr-sd-color-popup__swatch';
            swatch.style.backgroundColor = c.base;
            swatch.title = c.label;
            swatch.addEventListener('click', () => {
                hexInput.value = c.base;
                colorBtn.style.backgroundColor = c.base;
                popup.style.display = 'none';
                el.set('labelColor', c.base);
                el.attr('label/fill', c.base);
            });
            popup.appendChild(swatch);
        }
        const hiddenPicker = document.createElement('input');
        hiddenPicker.type = 'color';
        hiddenPicker.className = 'nr-sd-hex-hidden-picker';
        hiddenPicker.value = labelColor;
        const customSwatch = document.createElement('button');
        customSwatch.type = 'button';
        customSwatch.className = 'nr-sd-color-popup__swatch nr-sd-color-popup__swatch--custom';
        customSwatch.title = 'Custom color';
        customSwatch.innerHTML = '<svg viewBox="0 0 32 32" fill="currentColor" width="12" height="12"><path d="M29.391,2.609a3.279,3.279,0,0,0-4.634,0L18.4835,8.883,12.793,3.207,11.3789,4.6211l4.2764,4.2764L2.4072,22.146A.9967.9967,0,0,0,2.1,22.78L.042,29.0361a1,1,0,0,0,1.265,1.2637l6.2549-2.0586a.9974.9974,0,0,0,.6348-.3076L21.4453,14.6855l4.2764,4.2764,1.4141-1.4141L21.4116,11.8237l6.2744-6.2744.0051-.0051a3.2781,3.2781,0,0,0,0-4.634ZM6.8965,27.0017l-4.3384,1.4275L3.985,24.0908ZM28.2808,5.8281l-.0051.0051L21.9316,12.177l-.707-.707,6.3491-6.3491a1.2783,1.2783,0,0,1,1.806,0h0a1.2776,1.2776,0,0,1-.0977,1.7071Z"/></svg>';
        customSwatch.addEventListener('click', () => { popup.style.display = 'none'; hiddenPicker.click(); });
        popup.appendChild(customSwatch);
        hiddenPicker.addEventListener('input', () => {
            hexInput.value = hiddenPicker.value;
            colorBtn.style.backgroundColor = hiddenPicker.value;
            el.set('labelColor', hiddenPicker.value);
            el.attr('label/fill', hiddenPicker.value);
        });
        colorBtn.addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? '' : 'none'; });
        hexInput.addEventListener('click', () => { colorBtn.click(); });
        document.addEventListener('mousedown', (e) => { if (!hexWrap.contains(e.target as Node)) popup.style.display = 'none'; });
        hexWrap.appendChild(hexInput);
        hexWrap.appendChild(colorBtn);
        hexWrap.appendChild(hiddenPicker);
        hexWrap.appendChild(popup);
        colorRow.appendChild(hexWrap);
        designBody.appendChild(colorRow);

        // Font size
        const fontRow = document.createElement('div');
        fontRow.className = 'inspector-row';
        const fontLabel = document.createElement('label');
        fontLabel.textContent = 'Font Size';
        fontRow.appendChild(fontLabel);
        const fontInput = document.createElement('input');
        fontInput.type = 'number';
        fontInput.min = '8';
        fontInput.max = '72';
        fontInput.value = String(el.get('labelFontSize') ?? 14);
        fontInput.style.flex = '0 0 160px';
        fontInput.style.width = '160px';
        fontInput.addEventListener('input', () => {
            const val = Math.max(8, Math.min(72, parseInt(fontInput.value) || 14));
            el.set('labelFontSize', val);
            el.attr('label/font-size', val);
        });
        fontRow.appendChild(fontInput);
        designBody.appendChild(fontRow);

        // Orientation switcher (Default / Rotated)
        const orientRow = document.createElement('div');
        orientRow.className = 'inspector-row';
        const orientLabel = document.createElement('label');
        orientLabel.textContent = 'Orientation';
        orientRow.appendChild(orientLabel);
        const orientSwitcher = document.createElement('div');
        orientSwitcher.className = 'nr-seg-control nr-seg-control--fixed';
        orientSwitcher.style.flex = '0 0 160px';
        const isRotated = ((el.get('labelRotation') as number) ?? 0) === 270;
        for (const opt of ['Default', 'Rotated'] as const) {
            const btn = document.createElement('button');
            btn.type = 'button';
            const active = opt === 'Rotated' ? isRotated : !isRotated;
            btn.className = 'nr-seg-btn' + (active ? ' nr-seg-btn--selected' : '');
            btn.textContent = opt;
            btn.addEventListener('click', () => {
                const deg = opt === 'Rotated' ? 270 : 0;
                const { applyRotation } = require('./tools/rotate-tool');
                applyRotation(el as dia.Element, deg, this.paper);
                orientSwitcher.querySelectorAll('.nr-seg-btn').forEach(b =>
                    b.classList.toggle('nr-seg-btn--selected', b === btn)
                );
            });
            orientSwitcher.appendChild(btn);
        }
        orientRow.appendChild(orientSwitcher);
        designBody.appendChild(orientRow);

        propsPanel.appendChild(accordion);
        this.labelSection.appendChild(propsPanel);

        this.titleTextEl.textContent = 'Label Inspector';
        this.hideAllSections();
        this.labelSection.style.display = '';
        this.duplicateBtn.parentElement!.style.display = '';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateZoneBtn.parentElement!.style.display = 'none';
        this.deleteBtn.parentElement!.style.display = '';
        this.deleteBtn.textContent = 'Delete';
        this.overflowBtn.style.display = '';
        this.closeOverflowMenu();
        this.el.classList.remove('inspector-hidden');
    }

    hide() {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;
        this.currentLayerId = null;
        this.multiZoneTargets = [];
        this.detachMultiLink();
        this.el.classList.add('inspector-hidden');
    }
}

// Compact label on the link: "10Gbps / fiber" — cleared if both fields are empty.
function updateLinkLabel(link: dia.Link, meta: LinkMeta) {
    const parts = [meta.bandwidth, meta.medium].filter(Boolean);
    const text = parts.join(' / ');
    if (text) {
        link.labels([{
            position: 0.5,
            attrs: {
                text: { text, fontSize: 9, fill: '#555', fontFamily: 'sans-serif' },
                rect: { fill: 'white', stroke: 'none', rx: 2, ry: 2 }
            }
        }]);
    } else {
        link.labels([]);
    }
}
