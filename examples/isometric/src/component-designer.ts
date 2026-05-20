import { dia, V } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { cellNamespace } from './shapes';
import { Link } from './shapes/link/link';
import { SHAPE_FACTORIES, BASE_SHAPE_BY_ID, FORM_FACTOR_PREVIEWS, getPreviewFactory } from './shapes/shape-factories';
import { drawGrid, switchView, transformationMatrix, applyShapeStyle } from './utils';
import { SvgPolygonShape } from './shapes/svgpolygon/svg-polygon-shape';
import { parseSvgFootprint } from './svg-footprint';
import { Area } from './shapes/area/area';
import { FrameCornerControl } from './tools';
import { GRID_SIZE, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE } from './theme';

// Component designer uses a fixed 10×10 GU grid, independent of the system designer.
const CD_GRID_COUNT = 10;
import { ShapeRegistry, ShapeDefinition, BUILT_IN_SHAPE_IDS, updateShapeDefinition, deleteShape, addShape, saveRegistryToStorage, ShapeLayer, IconEntry, migrateIconDef, defaultIconEntry } from './shapes/shape-registry';
import { BaseShape } from './shapes/shape-definition';
import { PRIMARY_COLORS } from './colors';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import ChevronUp16 from '@carbon/icons/es/chevron--up/16.js';
import ChevronDown16 from '@carbon/icons/es/chevron--down/16.js';
import OverflowMenuVertical16 from '@carbon/icons/es/overflow-menu--vertical/16.js';
import SettingsEdit16 from '@carbon/icons/es/settings--edit/16.js';
import Save16 from '@carbon/icons/es/save/16.js';
import View16 from '@carbon/icons/es/view/16.js';
import ViewOff16 from '@carbon/icons/es/view--off/16.js';
import Eyedropper16 from '@carbon/icons/es/eyedropper/16.js';
import Asleep16 from '@carbon/icons/es/asleep/16.js';
import Light16 from '@carbon/icons/es/light/16.js';
import Add16 from '@carbon/icons/es/add/16.js';
import AddLarge16 from '@carbon/icons/es/add--large/16.js';
import Subtract16 from '@carbon/icons/es/subtract/16.js';
import Tuning16 from '@carbon/icons/es/tuning/16.js';
import Draggable16 from '@carbon/icons/es/draggable/16.js';
import CloseLarge16 from '@carbon/icons/es/close--large/16.js';
import ArrowDown16 from '@carbon/icons/es/arrow--down/16.js';
import ArrowRight16 from '@carbon/icons/es/arrow--right/16.js';
import ArrowUp16 from '@carbon/icons/es/arrow--up/16.js';
import ArrowLeft16 from '@carbon/icons/es/arrow--left/16.js';
import SettingsView16 from '@carbon/icons/es/settings--view/16.js';
import Minimize16CD from '@carbon/icons/es/minimize/16.js';
import AlignBoxTopLeft16 from '@carbon/icons/es/align-box--top-left/16.js';
import AlignBoxTopCenter16 from '@carbon/icons/es/align-box--top-center/16.js';
import AlignBoxTopRight16 from '@carbon/icons/es/align-box--top-right/16.js';
import AlignBoxMiddleLeft16 from '@carbon/icons/es/align-box--middle-left/16.js';
import AlignBoxMiddleRight16 from '@carbon/icons/es/align-box--middle-right/16.js';
import AlignBoxBottomLeft16 from '@carbon/icons/es/align-box--bottom-left/16.js';
import AlignBoxBottomCenter16 from '@carbon/icons/es/align-box--bottom-center/16.js';
import AlignBoxBottomRight16 from '@carbon/icons/es/align-box--bottom-right/16.js';
import { getIconById, addUploadedIcon, removeUploadedIcon, IconCatalogEntry, ensureFullCatalog } from './icon-catalog';

function addTooltip(wrapper: HTMLElement, text: string, position: 'append' | 'prepend' = 'append'): void {
    const tipWrap = document.createElement('span');
    tipWrap.className = 'nr-cd-tooltip-wrap';

    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'nr-cd-tooltip-trigger';
    infoBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8.5 11 8.5 6.5 6.5 6.5 6.5 7.5 7.5 7.5 7.5 11 6 11 6 12 10 12 10 11z"/><path d="M8,3.5c-0.4,0-0.8,0.3-0.8,0.8S7.6,5,8,5c0.4,0,0.8-0.3,0.8-0.8S8.4,3.5,8,3.5z"/><path d="M8,15c-3.9,0-7-3.1-7-7s3.1-7,7-7s7,3.1,7,7S11.9,15,8,15z M8,2C4.7,2,2,4.7,2,8s2.7,6,6,6s6-2.7,6-6S11.3,2,8,2z"/></svg>';

    const tip = document.createElement('div');
    tip.className = 'nr-cd-tooltip';
    tip.textContent = text;

    infoBtn.addEventListener('mouseenter', () => {
        const rect = infoBtn.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = (rect.left + rect.width / 2 - 100) + 'px';
        tip.style.top = (rect.top - tip.offsetHeight - 8) + 'px';
    });
    infoBtn.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

    tipWrap.appendChild(infoBtn);
    tipWrap.appendChild(tip);
    if (position === 'prepend') {
        wrapper.insertBefore(tipWrap, wrapper.firstChild);
    } else {
        wrapper.appendChild(tipWrap);
    }
}

function isVendorIcon(entry: IconCatalogEntry | undefined | null): boolean {
    return entry?.source === 'aws' || entry?.source === 'gcp' || entry?.source === 'azure';
}
import { getVisibleIcons } from './icon-config';
import { shapeStore } from './shape-store';
import { saveToInventory, isDarkMode } from './svg-inventory';
import { getComponentCollections } from './admin';
import { buildComponentPanel, formatLabel, ComponentTreeItem } from './component-tree';

// DOM elements
const canvasEl     = document.getElementById('cd2-canvas')                as HTMLDivElement;
const canvasEl2D   = document.getElementById('cd2-canvas-2d')             as HTMLDivElement;
const inspectorEl  = document.getElementById('cd2-inspector')             as HTMLDivElement;
const paletteEl    = document.getElementById('cd2-palette')               as HTMLDivElement;
const layerPanelEl = document.getElementById('cd2-layers')                as HTMLDivElement;
const canvasWrapEl = document.getElementById('cd2-canvas-wrap')           as HTMLDivElement;



// Icon catalog lives in ./icon-catalog (single source of truth).
// The set of icons offered in the picker is further filtered by the admin
// configuration below — see buildIconContent().

// ── Base shape defaults store ─────────────────────────────────────────────
// Per-base-shape defaults, persisted to localStorage. Used when creating a
// new component or clicking "Reset to default".
interface BaseShapeDefaults {
    width?: number;
    height?: number;
    isometricHeight?: number;
    cornerRadius?: number;
    chamferSize?: number;
    chamferStart?: number;
    chamferBottomSize?: number;
    chamferBottomStart?: number;
    taper?: number;
    twist?: number;
    scaleTopX?: number;
    scaleTopY?: number;
    shedRoofDrop?: number;
    shedRoofDirection?: string;
}

const SHAPE_DEFAULTS_KEY = 'nextrack-base-shape-defaults-v1';

function loadBaseShapeDefaults(): Record<string, BaseShapeDefaults> {
    try {
        const raw = localStorage.getItem(SHAPE_DEFAULTS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveBaseShapeDefault(baseShape: string, defaults: BaseShapeDefaults): void {
    const all = loadBaseShapeDefaults();
    all[baseShape] = defaults;
    try { localStorage.setItem(SHAPE_DEFAULTS_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

function getBaseShapeDefault(baseShape: string): BaseShapeDefaults {
    return loadBaseShapeDefaults()[baseShape] || {};
}

function applyBaseShapeDefaults(baseShape: string): void {
    const defs = getBaseShapeDefault(baseShape);
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        widthInput.value  = String(layer?.width  ?? 40);
        heightInput.value = String(layer?.height ?? 40);
        depthInput.value  = String(layer?.depth  ?? 20);
    } else {
        widthInput.value  = String((defs.width ?? 2) * GRID_SIZE);
        heightInput.value = String((defs.height ?? 2) * GRID_SIZE);
        depthInput.value  = String((defs.isometricHeight ?? 0.5) * GRID_SIZE);
    }
    selectedCornerRadius = defs.cornerRadius ?? 0;
    selectedChamferSize  = defs.chamferSize ?? 0;
    selectedChamferStart = defs.chamferStart ?? 0;
    selectedChamferBottomSize  = defs.chamferBottomSize ?? 0;
    selectedChamferBottomStart = defs.chamferBottomStart ?? 0;
    selectedTaper        = defs.taper ?? 0;
    selectedTwist        = defs.twist ?? 0;
    selectedScaleTopX    = defs.scaleTopX ?? 1;
    selectedScaleTopY    = defs.scaleTopY ?? 1;
    selectedShedRoofDrop = defs.shedRoofDrop ?? 0;
    selectedShedRoofDirection = defs.shedRoofDirection ?? 'front';
    if (baseShape === 'tube' || baseShape === 'duct') {
        selectedIconFace = 'side';
    }
}

const SIDEBAR_INSET = 0;
let currentShape: IsometricShape | null = null;
let currentShape2D: IsometricShape | null = null;
let currentShapeId = '';
let currentZoom  = 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gridVEl: any = null;

// Non-dimension template state (form factor, icon, style)
let selectedBaseShape: BaseShape = (BASE_SHAPE_BY_ID[currentShapeId] || 'cuboid') as BaseShape;
let selectedIcon: string | null = null;
let selectedIconFace: 'top' | 'front' | 'side' = 'top';
let selectedIconSize = 1.5; // grid units; 1.5 GU = 30px
let selectedIconOffsetX = 0;
let selectedIconOffsetY = 0;
let selectedIconSkewX = 0;
let selectedIconSkewY = 0;
let selectedStyle = { topColor: '', sideColor: '', frontColor: '', strokeColor: '' };

// Corner radius state (not persisted to registry; only applies to polygon shapes)
let selectedCornerRadius = 0; // pixels

// Chamfer state (not persisted to registry; only applies to cuboid shapes)
let selectedChamferSize = 0;
let selectedChamferStart = 0;
let selectedChamferBottomSize = 0;
let selectedChamferBottomStart = 0;

// Rotation state (0 or 90; applies to all shapes except cuboid)
let selectedRotation = 0;
let rotationAccordionLi: HTMLLIElement | null = null;

// 3D modifier state
let selectedTaper = 0;
let selectedTwist = 0;
let selectedScaleTopX = 1;
let selectedScaleTopY = 1;
let selectedShedRoofDrop = 0;
let selectedShedRoofDirection = 'front';

// SVG footprint state (complex shape mode only)
let svgParseError = '';

// Icon background state (not persisted to registry)
let dimensionYAdjustable = false;
let resizeFromInput = false;
let dimBehaviourRowEl: HTMLElement | null = null;
let hudRotateItemEl: HTMLElement | null = null;

let selectedIconBgSize = 1; // grid units; independent from icon size
let selectedIconBgEnabled = false;
let selectedIconMonochrome = false;
let selectedIconBgColor = PRIMARY_COLORS[0].base; // Grey 70 by default
let selectedIconBgShape: 'circle' | 'square' | 'octagon' = 'circle';
let selectedIconBgRadius = 6;
let selectedIconBgChamfer = 0.18;

// New multi-icon system
let iconEntries: import('./shapes/shape-registry').IconEntry[] = [];
let editingIconIndex = -1;
let iconsSectionBodyEl: HTMLElement | null = null;
let renderIconsListFn: (() => void) | null = null;

// Direct references to the swatch buttons so syncExtrasFromShape can update
// them without relying on a DOM query that could match unrelated elements.
let iconBgSwatchRefs: Array<{ btn: HTMLElement; colorBase: string }> = [];

// ── Variation state ───────────────────────────────────────────────────────────
let hasVariations = false;
let activeVariation: 'default' | 'turned90' = 'default';
let rebuildVariationButtons: () => void = () => {};

// ── Complex Shape state ────────────────────────────────────────────────────────
let isComplexShape = false;
let layers: ShapeLayer[] = [];
let selectedLayerIndex = 0;
let layerShapes: IsometricShape[]   = [];  // ISO canvas shapes, one per layer
let layerShapes2D: IsometricShape[] = [];  // 2D canvas shapes, one per layer
let hitAreaShape: IsometricShape | null = null;
let hitAreaShape2D: IsometricShape | null = null;
let hitAreaVisible = false;

// Extra slider DOM refs — assigned in build*Content functions
let offsetXInput:        HTMLInputElement;
let offsetYInput:        HTMLInputElement;
let baseElevationInput:  HTMLInputElement;
let offsetXValueEl:      HTMLElement;
let offsetYValueEl:      HTMLElement;
let baseElevationValueEl: HTMLElement;

// Accordion sections toggled by complex shape mode
let positionAccordionLi:          HTMLLIElement | null = null;
let svgFootprintAccordionLi:      HTMLLIElement | null = null;
let svgFootprintAccordionContent: HTMLElement   | null = null;

// Icon background extra controls — only visible in complex shape mode
let iconBgNoBackgroundBtnEl:   HTMLElement      | null = null;
let iconBgCustomColorRowEl:    HTMLElement      | null = null;
let iconBgCustomColorInputRef: HTMLInputElement | null = null;
let iconBgCornerRadiusRowEl:   HTMLElement      | null = null;
let iconBgCornerRadiusInputRef: HTMLInputElement | null = null;
let iconBgChamferRowEl:        HTMLElement      | null = null;
let iconBgChamferInputRef:     HTMLInputElement | null = null;

// Adaptive icon (no-bg + complex shape only): icon color follows app theme
let selectedIconAdaptive = false;
let iconAdaptiveToggleRowEl: HTMLElement | null = null;

// Complex-shape only: which layer carries the icon in the designer preview.
// Defaults to the main layer; user can pick another via a dropdown in the
// Icon section when more than one layer exists.
let iconLayerIndex = 0;

// Cached handle to the Icon accordion's content element so we can rebuild
// it when layers are added/removed/renamed (the accordion itself is built
// once per inspector — without this the layer dropdown never appears for
// shapes whose layer count changes after the inspector is constructed).
let iconAccordionContentEl: HTMLElement | null = null;

// Icon picker search term — module-scoped so re-renders of the icon
// section preserve what the user typed.
let iconSearchTerm = '';

// Direct reference to the single color picker for sync without DOM queries.
let colorPickerRef: HTMLInputElement | null = null;
let syncIconBgColorDisplay: () => void = () => {};
let syncFormFactorDropdown: () => void = () => {};
let iconBgSettingsWrapEl: HTMLElement | null = null;

/**
 * Pre-processes an SVG string so it renders fully white when used as a data URI.
 * Inserts a CSS filter block on the root <svg> element.
 */

const graph = new dia.Graph({}, { cellNamespace });
// The size tool reads graph.get('obstacles').isFree() to check for collisions.
// The Shape Designer has a single isolated shape, so obstacles are never needed.
graph.set('obstacles', { isFree: () => true });

const paper = new dia.Paper({
    el: canvasEl,
    model: graph,
    interactive: { elementMove: false },
    gridSize: GRID_SIZE,
    async: true,
    autoFreeze: true,
    defaultConnectionPoint: {
        name: 'boundary',
        args: { offset: GRID_SIZE / 2, selector: false }
    },
    defaultLink: () => new Link(),
    linkPinning: false,
    overflow: true,
    cellViewNamespace: cellNamespace,
    highlighting: {
        default: {
            name: 'mask',
            options: {
                layer: dia.Paper.Layers.BACK,
                attrs: { 'stroke': HIGHLIGHT_COLOR, 'stroke-width': 3 }
            }
        }
    }
});

const CD_MARGIN = 20;

gridVEl = drawGrid(paper, CD_GRID_COUNT, GRID_SIZE);
paper.setDimensions(
    SIDEBAR_INSET + 2 * GRID_SIZE * CD_GRID_COUNT * SCALE * ISOMETRIC_SCALE + CD_MARGIN * 2,
    GRID_SIZE * CD_GRID_COUNT * SCALE + CD_MARGIN * 2
);

// ── 2D mirror paper ───────────────────────────────────────────────────────────
// Always in 2D mode; its shape mirrors the ISO shape for simultaneous preview.

const graph2D = new dia.Graph({}, { cellNamespace });
graph2D.set('obstacles', { isFree: () => true });

const paper2D = new dia.Paper({
    el: canvasEl2D,
    model: graph2D,
    restrictTranslate: () => (x: number, y: number) => ({
        x: Math.max(0, x),
        y: Math.max(0, y),
    }),
    gridSize: GRID_SIZE,
    async: true,
    autoFreeze: true,
    overflow: true,
    cellViewNamespace: cellNamespace,
    interactive: false,
});

drawGrid(paper2D, CD_GRID_COUNT, GRID_SIZE);
paper2D.setDimensions(
    GRID_SIZE * CD_GRID_COUNT * SCALE + CD_MARGIN * 2,
    GRID_SIZE * CD_GRID_COUNT * SCALE + CD_MARGIN * 2
);

// ── Fixed view matrices ───────────────────────────────────────────────────────
// ISO paper is always isometric; 2D paper is always in 2D mode.
// The ViewToggle is hidden; dual-view replaces it.

switchView(paper, View.Isometric, null, SIDEBAR_INSET, CD_GRID_COUNT);
paper2D.matrix(transformationMatrix(View.TwoDimensional, CD_MARGIN, 0, CD_GRID_COUNT));

// ── Template panel ────────────────────────────────────────────────────────────

let shapeNameInput: HTMLInputElement;
let componentTypeSelect: HTMLSelectElement;
let headerSaveBtn: HTMLButtonElement | null = null;
let inspectorDirty = false;
let adminMode = false;
let setDefaultBtn: HTMLButtonElement | null = null;

function markDirty() {
    if (!inspectorDirty) {
        inspectorDirty = true;
        if (headerSaveBtn) {
            headerSaveBtn.disabled = false;
            headerSaveBtn.classList.remove('nr-save-btn--disabled');
            headerSaveBtn.classList.add('nr-save-btn--active');
        }
    }
}

function clearDirty() {
    inspectorDirty = false;
    if (headerSaveBtn) {
        headerSaveBtn.disabled = true;
        headerSaveBtn.classList.add('nr-save-btn--disabled');
        headerSaveBtn.classList.remove('nr-save-btn--active');
    }
}
let widthInput:   HTMLInputElement;
let heightInput:  HTMLInputElement;
let depthInput:   HTMLInputElement;
let widthDisplayEl:  HTMLInputElement | null = null;
let heightDisplayEl: HTMLInputElement | null = null;
let depthDisplayEl:  HTMLInputElement | null = null;
let widthValueEl:  HTMLElement;
let heightValueEl: HTMLElement;
let depthValueEl:  HTMLElement;
let cornerRadiusInput:  HTMLInputElement;
let cornerRadiusValueEl: HTMLElement;
let modifiersSvgInfoEl: HTMLElement | null = null;
let modifiersAccordionLi: HTMLLIElement | null = null;
let chamferSizeInput:   HTMLInputElement;
let chamferSizeValueEl: HTMLElement;
let chamferBottomSizeInput: HTMLInputElement;
let chamferBottomSizeValueEl: HTMLElement;
let iconFaceRowEl:      HTMLElement;
let taperInput: HTMLInputElement;
let taperValueEl: HTMLElement;
let twistInput: HTMLInputElement;
let twistValueEl: HTMLElement;
let stxInput: HTMLInputElement;
let stxValueEl: HTMLElement;
let styInput: HTMLInputElement;
let styValueEl: HTMLElement;
let chamferStartInput: HTMLInputElement;
let chamferStartVal: HTMLElement;
let chamferBottomStartInput: HTMLInputElement;
let chamferBottomStartVal: HTMLElement;
let shedDropInput: HTMLInputElement;
let shedDropValueEl: HTMLElement;
let shedDirSwitcherEl: HTMLElement | null = null;

const CDS_ICON_TRASH      = carbonIconToString(TrashCan16 as CarbonIcon);
const CDS_ICON_COPY       = carbonIconToString(Copy16 as CarbonIcon);
const CDS_ICON_CHEVRON_UP   = carbonIconToString(ChevronUp16 as CarbonIcon);
const CDS_ICON_CHEVRON_DOWN = carbonIconToString(ChevronDown16 as CarbonIcon);
const CDS_ICON_OVERFLOW     = carbonIconToString(OverflowMenuVertical16 as CarbonIcon);

const CDS_ACCORDION_ARROW = carbonIconToString(ChevronDown16 as CarbonIcon).replace('<svg', '<svg class="cds--accordion__arrow"');

function buildAccordionItem(
    title: string,
    startExpanded: boolean,
    buildContent: (container: HTMLElement) => void
): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'cds--accordion__item' + (startExpanded ? ' cds--accordion__item--active' : '');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cds--accordion__heading';
    btn.setAttribute('aria-expanded', String(startExpanded));
    btn.innerHTML = CDS_ACCORDION_ARROW + `<div class="cds--accordion__title">${title}</div>`;

    const content = document.createElement('div');
    content.className = 'cds--accordion__content';
    buildContent(content);

    btn.addEventListener('click', () => {
        const expanded = li.classList.toggle('cds--accordion__item--active');
        btn.setAttribute('aria-expanded', String(expanded));
        if (expanded) {
            requestAnimationFrame(() => btn.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
    });

    li.appendChild(btn);
    li.appendChild(content);
    return li;
}

/**
 * Updates the CSS custom property --nr-slider-fill on a range input so the
 * Carbon-styled gradient track reflects the current value position.
 * Must be called after any programmatic .value assignment and inside input handlers.
 */
function setSliderFill(el: HTMLInputElement) {
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const val = parseFloat(el.value) || 0;
    const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    el.style.setProperty('--nr-slider-fill', `${pct}%`);
}

/** Re-syncs the fill gradient for every slider currently in the inspector panel. */
function syncAllSliderFills() {
    inspectorEl.querySelectorAll<HTMLInputElement>('.nr-sd-slider').forEach(setSliderFill);
}

function buildSliderField(
    label: string,
    id: string,
    min: number,
    max: number,
    step: number,
    assignInput: (el: HTMLInputElement) => void,
    assignValue: (el: HTMLElement) => void,
    onChange: () => void,
    container: HTMLElement,
    unit?: string
) {
    const isDimension = id.startsWith('sd-width') || id.startsWith('sd-height') || id.startsWith('sd-depth')
        || id.startsWith('sd-offset') || id.startsWith('sd-base-elevation')
        || id === 'sd-icon-size' || id === 'sd-icon-bg-size';
    const showUnit = unit || (isDimension ? 'px' : '');
    const toDisplay = (v: number) => Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
    const fromDisplay = (d: number) => d;

    const row = document.createElement('div');
    row.className = 'nr-sd-number-row';

    const lbl = document.createElement('label');
    lbl.className = 'nr-sd-number-label';
    lbl.setAttribute('for', id);
    lbl.textContent = label;
    row.appendChild(lbl);

    const stepper = document.createElement('div');
    stepper.className = 'nr-ad__number-stepper';

    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.className = 'nr-ad__number-input';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    assignInput(input);

    // Display element shows px value + unit
    const displayEl = document.createElement('input');
    displayEl.type = 'text';
    displayEl.className = 'nr-sd-number-display';
    displayEl.value = `${toDisplay(parseFloat(input.value))}${showUnit}`;

    // Hidden value element for compatibility
    const valueEl = document.createElement('span');
    valueEl.style.display = 'none';
    valueEl.id = `${id}-value`;
    assignValue(valueEl);
    row.appendChild(valueEl);

    const defaultVal = parseFloat(input.value);
    const syncDisplay = () => { displayEl.value = `${toDisplay(parseFloat(input.value))}${showUnit}`; };

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'nr-stepper-reset';
    resetBtn.textContent = '\u00d7';
    resetBtn.title = `Reset to ${toDisplay(defaultVal)}${showUnit}`;
    resetBtn.style.display = 'none';

    const syncReset = () => {
        const cur = parseFloat(input.value);
        resetBtn.style.display = (Math.abs(cur - defaultVal) < 0.001) ? 'none' : '';
    };

    resetBtn.addEventListener('click', () => {
        input.value = String(defaultVal);
        syncDisplay();
        syncReset();
        onChange();
    });

    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'nr-ad__number-btn';
    decBtn.textContent = '\u2212';

    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'nr-ad__number-btn';
    incBtn.textContent = '+';

    const liveMin  = () => parseFloat(input.min)  || min;
    const liveMax  = () => parseFloat(input.max)  || max;
    const liveStep = () => parseFloat(input.step) || step;

    const update = () => {
        const v = parseFloat(input.value);
        const clamped = Math.max(liveMin(), Math.min(liveMax(), isNaN(v) ? liveMin() : v));
        input.value = String(clamped);
        syncDisplay();
        syncReset();
        onChange();
        markDirty();
    };

    decBtn.addEventListener('click', () => { input.value = String(Math.max(liveMin(), parseFloat(input.value) - liveStep())); update(); });
    incBtn.addEventListener('click', () => { input.value = String(Math.min(liveMax(), parseFloat(input.value) + liveStep())); update(); });

    displayEl.addEventListener('change', () => {
        const raw = parseFloat(displayEl.value);
        if (!isNaN(raw)) {
            const internal = fromDisplay(raw);
            input.value = String(Math.max(min, Math.min(max, internal)));
            update();
        } else {
            syncDisplay();
        }
    });

    // Drag-to-scrub: mousedown + drag left/right changes value
    let scrubStartX = 0;
    let scrubStartVal = 0;
    let scrubbing = false;

    displayEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (document.activeElement === displayEl) return; // already editing text
        e.preventDefault();
        scrubbing = true;
        scrubStartX = e.clientX;
        scrubStartVal = parseFloat(input.value);
        document.body.style.cursor = 'ew-resize';
        displayEl.style.cursor = 'ew-resize';

        const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - scrubStartX;
            const s = liveStep();
            const delta = Math.round(dx / 3) * s;
            const newVal = Math.max(liveMin(), Math.min(liveMax(), scrubStartVal + delta));
            input.value = String(newVal);
            syncDisplay();
            syncReset();
            onChange();
        };

        const onUp = () => {
            scrubbing = false;
            document.body.style.cursor = '';
            displayEl.style.cursor = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    stepper.appendChild(displayEl);
    stepper.appendChild(resetBtn);
    stepper.appendChild(decBtn);
    stepper.appendChild(incBtn);
    row.appendChild(stepper);
    container.appendChild(row);
}

function currentDimensionsPx(): { wPx: number; hPx: number; dPx: number } {
    const swapped = ROTATED_FORMS.has(selectedBaseShape);
    if (currentShape) {
        const { width, height } = currentShape.size();
        return { wPx: swapped ? height : width, hPx: swapped ? width : height, dPx: (currentShape.get('isometricHeight') ?? 0) };
    }
    const reg = ShapeRegistry[currentShapeId];
    const rawW = reg?.defaultSize?.width ?? GRID_SIZE * 2;
    const rawH = reg?.defaultSize?.height ?? GRID_SIZE * 2;
    return {
        wPx: swapped ? rawH : rawW,
        hPx: swapped ? rawW : rawH,
        dPx: reg?.defaultIsometricHeight ?? GRID_SIZE * 0.5,
    };
}

function buildDimensionsContent(container: HTMLElement) {
    const { wPx, hPx, dPx } = currentDimensionsPx();
    const isTube = TUBE_FAMILY.has(selectedBaseShape);

    buildSliderField(isTube ? 'Length' : 'Dimension X',  'sd-width',  1, 160, 1,
        (el) => { widthInput  = el; el.value = String(wPx); },
        (el) => { widthValueEl  = el; },
        onFieldChange, container);

    if (isTube) {
        buildSliderField('Diameter', 'sd-height', 1, 160, 1,
            (el) => { heightInput = el; el.value = String(dPx); },
            (el) => { heightValueEl = el; },
            onFieldChange, container);
        depthInput = document.createElement('input');
        depthInput.type = 'hidden';
        depthInput.value = String(dPx);
        container.appendChild(depthInput);
        depthValueEl = null;
        depthDisplayEl = null;
    } else {
        buildSliderField('Dimension Y', 'sd-height', 1, 160, 1,
            (el) => { heightInput = el; el.value = String(hPx); },
            (el) => { heightValueEl = el; },
            onFieldChange, container);
        buildSliderField('Dimension Z',  'sd-depth',  0, 160, 1,
            (el) => { depthInput  = el; el.value = String(dPx); },
            (el) => { depthValueEl  = el; },
            onFieldChange, container);
    }

    // Capture visible display inputs for external sync
    const rows = container.querySelectorAll<HTMLElement>('.nr-sd-number-row');
    widthDisplayEl  = rows[0]?.querySelector('.nr-sd-number-display') ?? null;
    heightDisplayEl = rows[1]?.querySelector('.nr-sd-number-display') ?? null;
    if (!isTube) depthDisplayEl = rows[2]?.querySelector('.nr-sd-number-display') ?? null;

    // Dimension Behaviour switcher (only for duct/pipe)
    const showBehaviour = selectedBaseShape === 'duct' || selectedBaseShape === 'pipe'
        || selectedBaseShape === 'tube' || selectedBaseShape === 'channel';
    const behaviourRow = document.createElement('div');
    behaviourRow.className = 'nr-sd-face-row';
    behaviourRow.style.display = showBehaviour ? '' : 'none';
    dimBehaviourRowEl = behaviourRow;

    const behaviourLbl = document.createElement('label');
    behaviourLbl.className = 'nr-sd-row-label';
    behaviourLbl.textContent = 'Behaviour';

    const behaviourSwitcher = document.createElement('div');
    behaviourSwitcher.className = 'nr-seg-control nr-seg-control--fixed';

    for (const opt of ['Static', 'Adjustable'] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = opt === 'Adjustable' ? dimensionYAdjustable : !dimensionYAdjustable;
        btn.className = 'nr-seg-btn' + (isActive ? ' nr-seg-btn--selected' : '');
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            dimensionYAdjustable = opt === 'Adjustable';
            behaviourSwitcher.querySelectorAll('.nr-seg-btn').forEach(b =>
                b.classList.toggle('nr-seg-btn--selected', b === btn)
            );
            updateResizeTools();
            markDirty();
        });
        behaviourSwitcher.appendChild(btn);
    }

    behaviourRow.appendChild(behaviourLbl);
    behaviourRow.appendChild(behaviourSwitcher);
    container.appendChild(behaviourRow);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'nr-sd-reset-btn';
    resetBtn.title = 'Reset to default';
    resetBtn.innerHTML = 'Reset to default';
    resetBtn.addEventListener('click', () => {
        const defs = getBaseShapeDefault(selectedBaseShape);
        widthInput.value = String(defs.width ?? 2);
        heightInput.value = String(defs.height ?? 2);
        depthInput.value = String(defs.isometricHeight ?? 2);
        onFieldChange();
    });
    container.appendChild(resetBtn);

    setDefaultBtn = document.createElement('button');
    setDefaultBtn.type = 'button';
    setDefaultBtn.className = 'nr-sd-reset-btn nr-sd-set-default-btn';
    const shapeLabel = BASE_SHAPE_LABELS[selectedBaseShape] || selectedBaseShape;
    setDefaultBtn.textContent = `Set as default for ${shapeLabel}`;
    setDefaultBtn.title = `Save current dimensions as default for ${shapeLabel}`;
    setDefaultBtn.style.display = adminMode ? '' : 'none';
    setDefaultBtn.addEventListener('click', () => {
        saveBaseShapeDefault(selectedBaseShape, {
            width: parseFloat(widthInput.value) || 2,
            height: parseFloat(heightInput.value) || 2,
            isometricHeight: parseFloat(depthInput.value) || 2,
            cornerRadius: selectedCornerRadius || undefined,
            chamferSize: selectedChamferSize || undefined,
            chamferStart: selectedChamferStart || undefined,
            chamferBottomSize: selectedChamferBottomSize || undefined,
            chamferBottomStart: selectedChamferBottomStart || undefined,
            taper: selectedTaper || undefined,
            twist: selectedTwist || undefined,
            scaleTopX: selectedScaleTopX !== 1 ? selectedScaleTopX : undefined,
            scaleTopY: selectedScaleTopY !== 1 ? selectedScaleTopY : undefined,
            shedRoofDrop: selectedShedRoofDrop || undefined,
            shedRoofDirection: selectedShedRoofDirection !== 'front' ? selectedShedRoofDirection : undefined,
        });
        showToast(`Default saved for "${selectedBaseShape}"`);
    });
    container.appendChild(setDefaultBtn);
}

function buildModifiersContent(container: HTMLElement) {
    // Info text — shown only when the current layer uses a custom SVG footprint.
    // updateDimensionLock() toggles its visibility alongside the sliders.
    const svgInfo = document.createElement('p');
    svgInfo.className = 'cds--form__helper-text nr-sd-modifiers-info';
    svgInfo.textContent = 'Modifiers are not supported if SVG Footprint is used.';
    svgInfo.style.display = 'none';
    modifiersSvgInfoEl = svgInfo;
    container.appendChild(svgInfo);

    const cornerRadiusRow = document.createElement('div');
    cornerRadiusRow.dataset.modifier = 'cornerRadius';
    buildSliderField('Corner Radius', 'sd-corner-radius', 0, 30, 1,
        (el) => { cornerRadiusInput = el; el.value = String(selectedCornerRadius); },
        (el) => { cornerRadiusValueEl = el; },
        () => {
            selectedCornerRadius = parseInt(cornerRadiusInput.value, 10);
            applyCornerRadiusToCurrentShape();
        },
        cornerRadiusRow, 'px');
    container.appendChild(cornerRadiusRow);

    const chamferRow = document.createElement('div');
    chamferRow.dataset.modifier = 'chamfer';
    buildSliderField('Top Chamfer', 'sd-chamfer', 0, 30, 1,
        (el) => { chamferSizeInput = el; el.value = String(selectedChamferSize); },
        (el) => { chamferSizeValueEl = el; },
        () => {
            selectedChamferSize = parseInt(chamferSizeInput.value, 10);
            applyChamferSizeToCurrentShape();
        },
        chamferRow, 'px');
    container.appendChild(chamferRow);

    const chamferHeightRow = document.createElement('div');
    chamferHeightRow.dataset.modifier = 'chamferHeight';
    // chamferStartInput, chamferStartVal — module-level
    buildSliderField('Top Chamfer %', 'sd-chamfer-start', 0, 1, 0.05,
        (el) => { chamferStartInput = el; el.value = String(selectedChamferStart); },
        (el) => { chamferStartVal = el; },
        () => {
            selectedChamferStart = parseFloat(chamferStartInput.value);
            applyChamferStartToCurrentShape();
        },
        chamferHeightRow, '%');
    container.appendChild(chamferHeightRow);

    const chamferBottomRow = document.createElement('div');
    chamferBottomRow.dataset.modifier = 'chamferBottom';
    buildSliderField('Bottom Chamfer', 'sd-chamfer-bottom', 0, 30, 1,
        (el) => { chamferBottomSizeInput = el; el.value = String(selectedChamferBottomSize); },
        (el) => { chamferBottomSizeValueEl = el; },
        () => {
            selectedChamferBottomSize = parseInt(chamferBottomSizeInput.value, 10);
            applyChamferBottomSizeToCurrentShape();
        },
        chamferBottomRow, 'px');
    container.appendChild(chamferBottomRow);

    const chamferBottomHeightRow = document.createElement('div');
    chamferBottomHeightRow.dataset.modifier = 'chamferBottomHeight';
    // chamferBottomStartInput, chamferBottomStartVal — module-level
    buildSliderField('Bottom Chamfer %', 'sd-chamfer-bottom-start', 0, 1, 0.05,
        (el) => { chamferBottomStartInput = el; el.value = String(selectedChamferBottomStart); },
        (el) => { chamferBottomStartVal = el; },
        () => {
            selectedChamferBottomStart = parseFloat(chamferBottomStartInput.value);
            applyChamferBottomStartToCurrentShape();
        },
        chamferBottomHeightRow, '%');
    container.appendChild(chamferBottomHeightRow);

    const taperRow = document.createElement('div');
    taperRow.dataset.modifier = 'taper';
    buildSliderField('Taper', 'sd-taper', -0.95, 0.95, 0.05,
        (el) => { taperInput = el; el.value = String(selectedTaper); },
        (el) => { taperValueEl = el; },
        () => { selectedTaper = parseFloat(taperInput.value); apply3DModifiers(); },
        taperRow);
    container.appendChild(taperRow);

    const twistRow = document.createElement('div');
    twistRow.dataset.modifier = 'twist';
    buildSliderField('Twist', 'sd-twist', -180, 180, 5,
        (el) => { twistInput = el; el.value = String(selectedTwist); },
        (el) => { twistValueEl = el; },
        () => { selectedTwist = parseFloat(twistInput.value); apply3DModifiers(); },
        twistRow, '°');
    container.appendChild(twistRow);

    const stxRow = document.createElement('div');
    stxRow.dataset.modifier = 'scaleTopX';
    buildSliderField('Scale Top X', 'sd-scale-top-x', 0.1, 2, 0.05,
        (el) => { stxInput = el; el.value = String(selectedScaleTopX); },
        (el) => { stxValueEl = el; },
        () => { selectedScaleTopX = parseFloat(stxInput.value); apply3DModifiers(); },
        stxRow);
    container.appendChild(stxRow);

    const styRow = document.createElement('div');
    styRow.dataset.modifier = 'scaleTopY';
    buildSliderField('Scale Top Y', 'sd-scale-top-y', 0.1, 2, 0.05,
        (el) => { styInput = el; el.value = String(selectedScaleTopY); },
        (el) => { styValueEl = el; },
        () => { selectedScaleTopY = parseFloat(styInput.value); apply3DModifiers(); },
        styRow);
    container.appendChild(styRow);

    // Shed Roof
    // shedDropInput, shedDropValueEl — module-level
    const shedDropRow = document.createElement('div');
    shedDropRow.dataset.modifier = 'shedRoof';
    buildSliderField('Shed Roof', 'sd-shed-drop', 0, 30, 1,
        (el) => { shedDropInput = el; el.value = String(selectedShedRoofDrop); },
        (el) => { shedDropValueEl = el; },
        () => { selectedShedRoofDrop = parseInt(shedDropInput.value, 10); applyShedRoofToCurrentShape(); },
        shedDropRow, 'px');
    container.appendChild(shedDropRow);

    const shedDirRow = document.createElement('div');
    shedDirRow.dataset.modifier = 'shedRoofDir';
    shedDirRow.className = 'nr-sd-face-row';
    shedDirRow.style.padding = '4px 0';
    const shedDirLabel = document.createElement('span');
    shedDirLabel.className = 'nr-sd-row-label';
    shedDirLabel.textContent = 'Roof Direction';
    shedDirRow.appendChild(shedDirLabel);
    const shedDirSwitcher = document.createElement('div');
    shedDirSwitcherEl = shedDirSwitcher;
    shedDirSwitcher.className = 'nr-seg-control nr-seg-control--fixed';
    shedDirSwitcher.style.flex = '0 0 160px';
    const shedDirDefs: Array<{ label: string; val: string; icon: CarbonIcon }> = [
        { label: 'Front', val: 'front', icon: ArrowDown16 as CarbonIcon },
        { label: 'Right', val: 'right', icon: ArrowRight16 as CarbonIcon },
        { label: 'Back',  val: 'back',  icon: ArrowUp16 as CarbonIcon },
        { label: 'Left',  val: 'left',  icon: ArrowLeft16 as CarbonIcon },
    ];
    for (const dir of shedDirDefs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const val = dir.val;
        btn.className = 'nr-seg-btn' + (val === selectedShedRoofDirection ? ' nr-seg-btn--selected' : '');
        btn.title = dir.label;
        btn.innerHTML = carbonIconToString(dir.icon);
        btn.addEventListener('click', () => {
            selectedShedRoofDirection = val;
            shedDirSwitcher.querySelectorAll('.nr-seg-btn').forEach(b =>
                b.classList.toggle('nr-seg-btn--selected', b === btn));
            applyShedRoofToCurrentShape();
            markDirty();
        });
        shedDirSwitcher.appendChild(btn);
    }
    shedDirRow.appendChild(shedDirSwitcher);
    container.appendChild(shedDirRow);

    const modResetBtn = document.createElement('button');
    modResetBtn.type = 'button';
    modResetBtn.className = 'nr-sd-reset-btn';
    modResetBtn.title = 'Reset to default';
    modResetBtn.innerHTML = 'Reset to default';
    modResetBtn.addEventListener('click', () => {
        const defs = getBaseShapeDefault(selectedBaseShape);
        cornerRadiusInput.value = String(defs.cornerRadius ?? 0); selectedCornerRadius = defs.cornerRadius ?? 0; applyCornerRadiusToCurrentShape();
        chamferSizeInput.value = String(defs.chamferSize ?? 0); selectedChamferSize = defs.chamferSize ?? 0; applyChamferSizeToCurrentShape();
        chamferStartInput.value = String(defs.chamferStart ?? 0); selectedChamferStart = defs.chamferStart ?? 0; applyChamferStartToCurrentShape();
        chamferBottomSizeInput.value = String(defs.chamferBottomSize ?? 0); selectedChamferBottomSize = defs.chamferBottomSize ?? 0; applyChamferBottomSizeToCurrentShape();
        chamferBottomStartInput.value = String(defs.chamferBottomStart ?? 0); selectedChamferBottomStart = defs.chamferBottomStart ?? 0; applyChamferBottomStartToCurrentShape();
        taperInput.value = String(defs.taper ?? 0); selectedTaper = defs.taper ?? 0;
        twistInput.value = String(defs.twist ?? 0); selectedTwist = defs.twist ?? 0;
        stxInput.value = String(defs.scaleTopX ?? 1); selectedScaleTopX = defs.scaleTopX ?? 1;
        styInput.value = String(defs.scaleTopY ?? 1); selectedScaleTopY = defs.scaleTopY ?? 1;
        shedDropInput.value = String(defs.shedRoofDrop ?? 0); selectedShedRoofDrop = defs.shedRoofDrop ?? 0; applyShedRoofToCurrentShape();
        selectedShedRoofDirection = defs.shedRoofDirection ?? 'front';
        shedDirSwitcher.querySelectorAll('.nr-seg-btn').forEach((b, i) => b.classList.toggle('nr-seg-btn--selected', ['front','right','back','left'][i] === selectedShedRoofDirection));
        apply3DModifiers();
        buildInspectorPanel();
    });
    container.appendChild(modResetBtn);

    // Shape opacity — removed from component designer, available in system designer inspector
    /*
    let shapeOpacityInput: HTMLInputElement;
    const opacityRow = document.createElement('div');
    opacityRow.dataset.modifier = 'shapeOpacity';
    buildSliderField('Opacity', 'sd-shape-opacity', 0, 100, 5,
        (el) => { shapeOpacityInput = el; el.value = '100'; },
        () => {},
        () => {
            const v = parseInt(shapeOpacityInput.value, 10) / 100;
            const faces = ['front', 'side', 'top', 'base', 'baseIso', 'cornerV1', 'cornerV2', 'cornerV3'];
            const apply = (s: any) => { if (!s) return; for (const f of faces) s.attr(`${f}/fillOpacity`, v); };
            apply(currentShape);
            apply(currentShape2D);
            if (isComplexShape) {
                apply(layerShapes[selectedLayerIndex]);
                apply(layerShapes2D[selectedLayerIndex]);
            }
        },
        opacityRow, '%');
    container.appendChild(opacityRow);
    */
}

function buildPositionContent(container: HTMLElement) {
    const layer = isComplexShape ? layers[selectedLayerIndex] : null;
    const ox = layer?.offsetX ?? 0;
    const oy = layer?.offsetY ?? 0;
    const elev = layer?.baseElevation ?? 0;
    buildSliderField('Offset X', 'sd-offset-x', -160, 160, 1,
        (el) => { offsetXInput = el; el.value = String(ox); },
        (el) => { offsetXValueEl = el; el.textContent = `${Math.round(ox)} px`; },
        onOffsetChange, container);
    buildSliderField('Offset Y', 'sd-offset-y', -160, 160, 1,
        (el) => { offsetYInput = el; el.value = String(oy); },
        (el) => { offsetYValueEl = el; el.textContent = `${Math.round(oy)} px`; },
        onOffsetChange, container);
    buildSliderField('Elevation', 'sd-base-elevation', 0, 320, 1,
        (el) => { baseElevationInput = el; el.value = String(elev); },
        (el) => { baseElevationValueEl = el; el.textContent = `${Math.round(elev)} px`; },
        onOffsetChange, container);
}

function buildRotationContent(container: HTMLElement) {
    const row = document.createElement('div');
    row.className = 'nr-sd-face-row';

    const label = document.createElement('label');
    label.className = 'nr-sd-row-label';
    label.textContent = 'Rotation';
    row.appendChild(label);

    const switcher = document.createElement('div');
    switcher.className = 'nr-sd-face-switcher';

    for (const angle of [0, 90] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-sd-face-btn' + (selectedRotation === angle ? ' nr-sd-face-btn--active' : '');
        btn.textContent = `${angle}°`;
        btn.addEventListener('click', () => {
            selectedRotation = angle;
            switcher.querySelectorAll('.nr-sd-face-btn').forEach(b =>
                b.classList.toggle('nr-sd-face-btn--active', b === btn)
            );
            applyRotation();
        });
        switcher.appendChild(btn);
    }

    row.appendChild(switcher);
    container.appendChild(row);
}

// Compact 2D preview thumbnails for the form-factor picker.
// Match the "selectable tile" interaction used by the icon background colour picker
const CLIP_SHAPE_ICONS: Record<string, string> = {
    square: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><rect x="3" y="3" width="10" height="10"/></svg>',
    circle: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><circle cx="8" cy="8" r="6"/></svg>',
    octagon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14" stroke-linejoin="miter"><polygon points="6,2 10,2 14,6 14,10 10,14 6,14 2,10 2,6"/></svg>',
};

const FORM_FACTOR_PREVIEWS_SVG: Record<string, string> = {
    cuboid:    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`,
    cylinder:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>`,
    pyramid:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="12,4 20,20 4,20"/></svg>`,
    octagon:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="8,4 16,4 20,8 20,16 16,20 8,20 4,16 4,8"/></svg>`,
    tube:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><ellipse cx="18" cy="12" rx="3" ry="6"/><line x1="6" y1="6" x2="18" y2="6"/><line x1="6" y1="18" x2="18" y2="18"/><ellipse cx="6" cy="12" rx="3" ry="6"/></svg>`,
    duct:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="9,4 15,4 19,8 19,16 15,20 9,20 5,16 5,8"/><line x1="9" y1="4" x2="12" y2="4" stroke-dasharray="2 2" opacity="0.4"/></svg>`,
    pipe:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="6" ry="3"/><line x1="6" y1="6" x2="6" y2="18"/><line x1="18" y1="6" x2="18" y2="18"/><ellipse cx="12" cy="18" rx="6" ry="3"/></svg>`,
    channel:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="4,9 8,5 16,5 20,9 20,15 16,19 8,19 4,15"/></svg>`,
    custom:    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="4,8 12,4 20,10 16,20 6,18"/></svg>`,
};

function buildFormFactorContent(container: HTMLElement) {
    const options: { value: BaseShape; label: string }[] = [
        { value: 'cuboid',      label: 'Square' },
        { value: 'cylinder',    label: 'Circle' },
        { value: 'octagon',     label: 'Octagon' },
        { value: 'pyramid',     label: 'Pyramid' },
        { value: 'tube',        label: 'Tube' },
        { value: 'duct',        label: 'Duct' },
        { value: 'custom',      label: 'Custom' },
    ];

    const row = document.createElement('div');
    row.className = 'nr-sd-face-row';

    const ffLabel = document.createElement('span');
    ffLabel.className = 'nr-sd-row-label';
    ffLabel.textContent = 'Base shape';
    row.appendChild(ffLabel);

    const dropWrap = document.createElement('div');
    dropWrap.className = 'nr-sd-dropdown';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nr-sd-dropdown__trigger';

    const PRIMARY_SHAPE: Record<string, string> = { pipe: 'tube', channel: 'duct' };
    const setTriggerContent = (value: BaseShape) => {
        const displayValue = PRIMARY_SHAPE[value] || value;
        const opt = options.find(o => o.value === displayValue)!;
        trigger.innerHTML = `<span class="nr-sd-dropdown__icon">${FORM_FACTOR_PREVIEWS_SVG[displayValue] ?? ''}</span><span class="nr-sd-dropdown__text">${opt.label}</span><svg class="nr-sd-dropdown__chevron" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`;
    };
    setTriggerContent(selectedBaseShape);

    syncFormFactorDropdown = () => {
        setTriggerContent(selectedBaseShape);
        menu.querySelectorAll('.nr-sd-dropdown__item--selected').forEach(el => el.classList.remove('nr-sd-dropdown__item--selected'));
        const active = menu.querySelector(`[data-value="${selectedBaseShape}"]`) ||
            menu.querySelector(`[data-value="${PRIMARY_SHAPE[selectedBaseShape] || selectedBaseShape}"]`);
        if (active) active.classList.add('nr-sd-dropdown__item--selected');
    };

    dropWrap.appendChild(trigger);

    const menu = document.createElement('ul');
    menu.className = 'nr-sd-dropdown__menu';
    menu.setAttribute('role', 'listbox');

    let veContainerRef: HTMLDivElement | null = null;
    let onCustomSelected: (() => void) | null = null;

    const closeMenu = () => {
        menu.classList.remove('nr-sd-dropdown__menu--open');
        trigger.classList.remove('nr-sd-dropdown__trigger--open');
    };

    for (const opt of options) {
        const li = document.createElement('li');
        li.className = 'nr-sd-dropdown__item';
        li.setAttribute('role', 'option');
        li.setAttribute('data-value', opt.value);
        if (opt.value === selectedBaseShape) li.classList.add('nr-sd-dropdown__item--selected');
        li.innerHTML = `<span class="nr-sd-dropdown__icon">${FORM_FACTOR_PREVIEWS_SVG[opt.value] ?? ''}</span><span class="nr-sd-dropdown__text">${opt.label}</span>`;

        li.addEventListener('click', () => {
            selectedBaseShape = opt.value;
            setTriggerContent(opt.value);
            menu.querySelectorAll('.nr-sd-dropdown__item--selected').forEach(el => el.classList.remove('nr-sd-dropdown__item--selected'));
            li.classList.add('nr-sd-dropdown__item--selected');
            closeMenu();
            if (veContainerRef) {
                veContainerRef.style.display = opt.value === 'custom' ? '' : 'none';
            }
            applyBaseShapeDefaults(opt.value);
            applyFormFactorToCanvas();
            if (opt.value === 'custom' && onCustomSelected) onCustomSelected();
            const needsVariants = opt.value === 'tube' || opt.value === 'duct';
            if (needsVariants) hasVariations = true;
            buildInspectorPanel();
        });

        menu.appendChild(li);
    }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('nr-sd-dropdown__menu--open');
        trigger.classList.toggle('nr-sd-dropdown__trigger--open', isOpen);
    });

    document.addEventListener('click', (e) => {
        if (!dropWrap.contains(e.target as Node)) closeMenu();
    });

    dropWrap.appendChild(menu);
    row.appendChild(dropWrap);
    container.appendChild(row);

    // ── Custom vertex editor ─────────────────────────────────────────────
    const veContainer = document.createElement('div');
    veContainer.className = 'nr-vertex-editor';
    veContainer.style.display = selectedBaseShape === 'custom' ? '' : 'none';

    const VE_PAD = 12;
    const VE_HANDLE = 6;
    let VE_GRID_X = 16;
    let VE_GRID_Y = 16;
    let VE_SNAP_X = 1 / VE_GRID_X;
    let VE_SNAP_Y = 1 / VE_GRID_Y;

    const { wPx, hPx } = currentDimensionsPx();
    const maxPx = Math.max(wPx, hPx, 1);
    VE_GRID_X = Math.round((wPx / maxPx) * 16) || 16;
    VE_GRID_Y = Math.round((hPx / maxPx) * 16) || 16;
    VE_SNAP_X = 1 / VE_GRID_X;
    VE_SNAP_Y = 1 / VE_GRID_Y;

    const VE_SIZE_X = VE_PAD * 2 + VE_GRID_X * 10;
    const VE_SIZE_Y = VE_PAD * 2 + VE_GRID_Y * 10;

    const veSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    veSvg.setAttribute('width', String(VE_SIZE_X));
    veSvg.setAttribute('height', String(VE_SIZE_Y));
    veSvg.setAttribute('viewBox', `0 0 ${VE_SIZE_X} ${VE_SIZE_Y}`);
    veSvg.classList.add('nr-vertex-editor__svg');

    const veGridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const areaX = VE_SIZE_X - VE_PAD * 2;
    const areaY = VE_SIZE_Y - VE_PAD * 2;
    for (let i = 0; i <= VE_GRID_Y; i++) {
        const pos = VE_PAD + (i / VE_GRID_Y) * areaY;
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', String(VE_PAD));
        hLine.setAttribute('y1', String(pos));
        hLine.setAttribute('x2', String(VE_PAD + areaX));
        hLine.setAttribute('y2', String(pos));
        hLine.classList.add('nr-vertex-editor__grid-line');
        if (i % (VE_GRID_Y / Math.round(wPx / GRID_SIZE)) === 0) hLine.classList.add('nr-vertex-editor__grid-line--major');
        veGridGroup.appendChild(hLine);
    }
    for (let i = 0; i <= VE_GRID_X; i++) {
        const pos = VE_PAD + (i / VE_GRID_X) * areaX;
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', String(pos));
        vLine.setAttribute('y1', String(VE_PAD));
        vLine.setAttribute('x2', String(pos));
        vLine.setAttribute('y2', String(VE_PAD + areaY));
        vLine.classList.add('nr-vertex-editor__grid-line');
        if (i % (VE_GRID_X / Math.round(hPx / GRID_SIZE)) === 0) vLine.classList.add('nr-vertex-editor__grid-line--major');
        veGridGroup.appendChild(vLine);
    }
    veSvg.appendChild(veGridGroup);

    const vePolygonsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    veSvg.appendChild(vePolygonsGroup);

    const veHandlesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    veSvg.appendChild(veHandlesGroup);

    const veEdgeHitsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    veSvg.insertBefore(veEdgeHitsGroup, veHandlesGroup);

    // Path toolbar
    const vePathToolbar = document.createElement('div');
    vePathToolbar.className = 'nr-ve-path-toolbar';

    const vePathTabsEl = document.createElement('div');
    vePathTabsEl.className = 'nr-ve-path-tabs';
    vePathToolbar.appendChild(vePathTabsEl);

    const veAddPathBtn = document.createElement('button');
    veAddPathBtn.type = 'button';
    veAddPathBtn.className = 'nr-ve-path-add';
    veAddPathBtn.textContent = '+';
    veAddPathBtn.title = 'New path';
    veAddPathBtn.addEventListener('click', () => {
        customPaths.push([[0.25, 0.25], [0.5, 0.25], [0.5, 0.5], [0.25, 0.5]]);
        activePathIdx = customPaths.length - 1;
        rebuildPathTabs();
        veRender();
        veApply();
    });
    vePathToolbar.appendChild(veAddPathBtn);

    veContainer.appendChild(vePathToolbar);
    veContainer.appendChild(veSvg);

    const veHint = document.createElement('div');
    veHint.className = 'nr-vertex-editor__hint';
    veHint.textContent = 'Drag vertices. Double-click edge to add. Right-click vertex to remove.';
    veContainer.appendChild(veHint);

    container.appendChild(veContainer);

    let customPaths: [number, number][][] = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
    let activePathIdx = 0;

    if (selectedBaseShape === 'custom' && currentShape) {
        const raw = currentShape.get('normalizedVerts');
        if (raw && raw.length > 0) {
            if (typeof raw[0][0] === 'number') {
                customPaths = [(raw as [number, number][]).map(v => [...v] as [number, number])];
            } else {
                customPaths = (raw as [number, number][][]).map(
                    (path: [number, number][]) => path.map(v => [...v] as [number, number])
                );
            }
        }
    }

    function rebuildPathTabs() {
        vePathTabsEl.innerHTML = '';
        customPaths.forEach((_, idx) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'nr-ve-path-tab' + (idx === activePathIdx ? ' nr-ve-path-tab--active' : '');
            tab.textContent = `Path ${idx + 1}`;
            tab.addEventListener('click', () => {
                activePathIdx = idx;
                rebuildPathTabs();
                veRender();
            });
            if (customPaths.length > 1) {
                const del = document.createElement('span');
                del.className = 'nr-ve-path-tab__del';
                del.textContent = '\u00d7';
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    customPaths.splice(idx, 1);
                    if (activePathIdx >= customPaths.length) activePathIdx = customPaths.length - 1;
                    rebuildPathTabs();
                    veRender();
                    veApply();
                });
                tab.appendChild(del);
            }
            vePathTabsEl.appendChild(tab);
        });
        vePathToolbar.style.display = selectedBaseShape === 'custom' ? '' : 'none';
    }

    function veToScreen(nx: number, ny: number): [number, number] {
        return [VE_PAD + nx * areaX, VE_PAD + ny * areaY];
    }

    function veFromScreen(sx: number, sy: number): [number, number] {
        const nx = Math.max(0, Math.min(1, (sx - VE_PAD) / areaX));
        const ny = Math.max(0, Math.min(1, (sy - VE_PAD) / areaY));
        return [
            Math.round(nx / VE_SNAP_X) * VE_SNAP_X,
            Math.round(ny / VE_SNAP_Y) * VE_SNAP_Y,
        ];
    }

    function veRender() {
        vePolygonsGroup.innerHTML = '';
        veHandlesGroup.innerHTML = '';
        veEdgeHitsGroup.innerHTML = '';

        for (let p = 0; p < customPaths.length; p++) {
            const path = customPaths[p];
            const pts = path.map(([nx, ny]) => veToScreen(nx, ny));
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', pts.map(([x, y]) => `${x},${y}`).join(' '));
            polygon.classList.add('nr-vertex-editor__polygon');
            if (p !== activePathIdx) polygon.classList.add('nr-vertex-editor__polygon--inactive');
            vePolygonsGroup.appendChild(polygon);

            if (p !== activePathIdx) continue;

            for (let i = 0; i < pts.length; i++) {
                const [x, y] = pts[i];
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', String(x));
                circle.setAttribute('cy', String(y));
                circle.setAttribute('r', String(VE_HANDLE));
                circle.classList.add('nr-vertex-editor__handle');
                circle.dataset.idx = String(i);
                veHandlesGroup.appendChild(circle);

                const j = (i + 1) % pts.length;
                const [x2, y2] = pts[j];
                const edgeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                edgeLine.setAttribute('x1', String(x));
                edgeLine.setAttribute('y1', String(y));
                edgeLine.setAttribute('x2', String(x2));
                edgeLine.setAttribute('y2', String(y2));
                edgeLine.classList.add('nr-vertex-editor__edge-hit');
                edgeLine.dataset.after = String(i);
                veEdgeHitsGroup.appendChild(edgeLine);
            }
        }
    }

    function veApply() {
        if (!currentShape) return;
        const allPaths = customPaths.map(path => path.map(v => [...v] as [number, number]));
        currentShape.set('normalizedVerts', allPaths);
        if (currentShape2D) currentShape2D.set('normalizedVerts', allPaths);
        if (isComplexShape) {
            const layer = layers[selectedLayerIndex];
            if (layer) {
                layer.svgNormVerts = allPaths[0];
                layer.baseShape = 'custom';
            }
        }
        markDirty();
    }

    // Drag handles (active path only)
    let veDragIdx = -1;
    veSvg.addEventListener('pointerdown', (e: PointerEvent) => {
        const target = e.target as SVGElement;
        if (target.classList.contains('nr-vertex-editor__handle') && target.dataset.idx) {
            veDragIdx = parseInt(target.dataset.idx, 10);
            veSvg.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    });
    veSvg.addEventListener('pointermove', (e: PointerEvent) => {
        if (veDragIdx < 0) return;
        const rect = veSvg.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        customPaths[activePathIdx][veDragIdx] = veFromScreen(sx, sy);
        veRender();
        veApply();
    });
    veSvg.addEventListener('pointerup', () => { veDragIdx = -1; });

    // Double-click edge to add vertex
    veSvg.addEventListener('dblclick', (e: MouseEvent) => {
        const target = e.target as SVGElement;
        if (target.classList.contains('nr-vertex-editor__edge-hit') && target.dataset.after) {
            const after = parseInt(target.dataset.after, 10);
            const rect = veSvg.getBoundingClientRect();
            const [nx, ny] = veFromScreen(e.clientX - rect.left, e.clientY - rect.top);
            customPaths[activePathIdx].splice(after + 1, 0, [nx, ny]);
            veRender();
            veApply();
        }
    });

    // Right-click vertex to remove (min 3)
    veSvg.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        const target = e.target as SVGElement;
        if (target.classList.contains('nr-vertex-editor__handle') && target.dataset.idx) {
            if (customPaths[activePathIdx].length <= 3) return;
            const idx = parseInt(target.dataset.idx, 10);
            customPaths[activePathIdx].splice(idx, 1);
            veRender();
            veApply();
        }
    });

    veContainerRef = veContainer;
    onCustomSelected = () => {
        if (currentShape) {
            const raw = currentShape.get('normalizedVerts');
            if (raw && raw.length > 0) {
                if (typeof raw[0][0] === 'number') {
                    customPaths = [(raw as [number, number][]).map(v => [...v] as [number, number])];
                } else {
                    customPaths = (raw as [number, number][][]).map(
                        (path: [number, number][]) => path.map(v => [...v] as [number, number])
                    );
                }
            } else {
                customPaths = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
            }
        }
        activePathIdx = 0;
        rebuildPathTabs();
        veRender();
        veApply();
    };

    if (selectedBaseShape === 'custom') {
        rebuildPathTabs();
        veRender();
    }
}

// Mirror the currently selected radio input into the preview-tile classes.
// Called after any place that updates `input[name="sd-form-factor"]` to keep
// the visual selection in sync with the underlying value.
function syncFormFactorTiles() {
    inspectorEl.querySelectorAll<HTMLButtonElement>('.nr-sd-formfactor-tile').forEach(btn => {
        const input = btn.querySelector<HTMLInputElement>('input[name="sd-form-factor"]');
        const selected = !!input?.checked;
        btn.classList.toggle('nr-sd-swatch-btn--selected', selected);
        btn.setAttribute('aria-pressed', String(selected));
    });
}

const NO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><line x1="6" y1="16" x2="26" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// Generates a composite SVG with icon and background at absolute pixel sizes
// within a fixed viewBox. Both are centered independently.
function buildCompositeIconSvg(iconSvg: string | null, bgColor: string | null, bgShape: 'circle' | 'square' | 'octagon', applyWhiteFilter = true, bgRadius = 6, bgChamfer = 0.18, padding: 'normal' | 'compact' | 'tight' | 'none' = 'normal', clipToShape = false, canvasPx = 64, iconPx = 64, bgPx = 64, iconColor: string | null = null, iconOpacity = 100, bgOpacity = 100): string {
    const S = canvasPx;

    // Background — absolute size, centered
    const bgOff = (S - bgPx) / 2;
    let shapeEl = '';
    if (bgShape === 'circle') {
        shapeEl = `<circle cx="${bgOff + bgPx / 2}" cy="${bgOff + bgPx / 2}" r="${bgPx / 2}"`;
    } else if (bgShape === 'octagon') {
        const c = bgPx * bgChamfer;
        shapeEl = `<polygon points="${bgOff + c},${bgOff} ${bgOff + bgPx - c},${bgOff} ${bgOff + bgPx},${bgOff + c} ${bgOff + bgPx},${bgOff + bgPx - c} ${bgOff + bgPx - c},${bgOff + bgPx} ${bgOff + c},${bgOff + bgPx} ${bgOff},${bgOff + bgPx - c} ${bgOff},${bgOff + c}"`;
    } else {
        shapeEl = `<rect x="${bgOff}" y="${bgOff}" width="${bgPx}" height="${bgPx}" rx="${bgRadius}"`;
    }
    const bgOpStr = bgOpacity < 100 ? ` opacity="${(bgOpacity / 100).toFixed(2)}"` : '';
    const bgEl = bgColor !== null ? `${shapeEl} fill="${bgColor}"${bgOpStr}/>` : '';

    // Icon — absolute size, centered independently (skip if no icon SVG)
    let iconEl = '';
    if (iconSvg) {
        const iconOff = (S - iconPx) / 2;
        const padFrac = padding === 'none' ? 0 : padding === 'compact' ? 6 / 64 : padding === 'tight' ? 3 / 64 : 13 / 64;
        const pad = iconPx * padFrac;
        const iconInner = iconPx - 2 * pad;
        const iconX = iconOff + pad;
        const iconY = iconOff + pad;

        let defsParts = '';
        let filterAttr = '';
        if (iconColor) {
            const r = parseInt(iconColor.slice(1, 3), 16) / 255;
            const g = parseInt(iconColor.slice(3, 5), 16) / 255;
            const b = parseInt(iconColor.slice(5, 7), 16) / 255;
            defsParts += `<filter id="nr-tint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} 0 0 0 1 0"/></filter>`;
            filterAttr = ' filter="url(#nr-tint)"';
        } else if (applyWhiteFilter) {
            defsParts += `<filter id="nr-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`;
            filterAttr = ' filter="url(#nr-white)"';
        }
        if (clipToShape) {
            defsParts += `<clipPath id="nr-icon-clip">${shapeEl}/></clipPath>`;
        }
        const defs = defsParts ? `<defs>${defsParts}</defs>` : '';
        const clipAttr = clipToShape ? ' clip-path="url(#nr-icon-clip)"' : '';
        const iconOpStr = iconOpacity < 100 ? ` opacity="${(iconOpacity / 100).toFixed(2)}"` : '';
        const iconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${defs}${bgEl}<image href="${iconHref}" x="${iconX}" y="${iconY}" width="${iconInner}" height="${iconInner}"${filterAttr}${clipAttr}${iconOpStr}/></svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${bgEl}</svg>`;
}

/**
 * Moves the element matching `selector` to be the last child of `viewEl` so
 * it is always painted on top of every other element in the same cell view.
 * JointJS attr() only touches attributes, not DOM order, so this survives
 * incremental updates without needing to be re-applied on every render.
 */
function raiseToFront(viewEl: Element, selector: string): void {
    const el = viewEl.querySelector(`[joint-selector="${selector}"]`);
    if (el && el !== viewEl.lastElementChild) {
        viewEl.appendChild(el);
    }
}

/** Sync legacy state variables back into the active IconEntry. */
function syncLegacyStateToIconEntry(): void {
    if (applyingAllLayerIcons) return;
    if (editingIconIndex < 0 || editingIconIndex >= iconEntries.length) return;
    const e = iconEntries[editingIconIndex];
    const prevId = e.id;
    if (selectedIcon !== null) e.id = selectedIcon;
    // Auto-update name from catalog when icon changes and no custom name was set
    if (e.id && e.id !== prevId) {
        const catalogEntry = getIconById(e.id);
        if (catalogEntry && (!(e as any).name || (e as any).name === `Icon ${editingIconIndex + 1}` || (e as any).name === (prevId ? getIconById(prevId)?.label : ''))) {
            (e as any).name = catalogEntry.label;
        }
    }
    e.face = selectedIconFace;
    e.size = selectedIconSize;
    e.offsetX = selectedIconOffsetX;
    e.offsetY = selectedIconOffsetY;
    e.skewX = selectedIconSkewX;
    e.skewY = selectedIconSkewY;
    e.bgEnabled = selectedIconBgEnabled;
    e.bgColor = selectedIconBgColor;
    e.bgShape = selectedIconBgShape;
    e.bgSize = selectedIconBgSize;
    e.bgRadius = selectedIconBgRadius;
    e.bgChamfer = selectedIconBgChamfer;
    e.monochrome = selectedIconMonochrome;
}

function applyIconToCurrentShape() {
    syncLegacyStateToIconEntry();
    if (!applyingAllLayerIcons) markDirty();
    const iconShape   = currentShape;
    const iconShape2D = currentShape2D;
    if (!iconShape) return;

    // If no entries and no legacy icon, clear
    const hasLegacyIcon = !!selectedIcon;
    const hasEntries = iconEntries.some(e => !!e.id);
    if (!hasLegacyIcon && !hasEntries && !selectedIconBgEnabled) {
        const noIconAttrs = {
            topIcon:   { href: '', width: 0, height: 0 },
            topIcon2D: { href: '', width: 0, height: 0 },
        };
        iconShape.attr(noIconAttrs);
        iconShape2D?.attr(noIconAttrs);
        return;
    }

    // Multi-icon rendering: each icon gets its own face transform baked into the SVG
    if (iconEntries.length > 0 && iconEntries.some(e => !!e.id || e.bgEnabled)) {
        const { width: shapeW, height: shapeH } = iconShape.size();
        const iH = iconShape.isometricHeight;

        // Build per-icon composites with face transforms baked in
        const isoParts: string[] = [];
        const twoDParts: string[] = [];

        for (const ie of iconEntries) {
            if (!ie.id && !ie.bgEnabled) continue;
            const ieIcon = ie.id ? getIconById(ie.id) : undefined;
            const ieBgSize = ie.bgSize;
            const ieCanvasGU = Math.max(ie.size, ieBgSize);
            const ieCanvasPx = ieCanvasGU * GRID_SIZE;
            const ieIconPx = ie.size * GRID_SIZE;
            const ieBgPx = ieBgSize * GRID_SIZE;
            const ieBg = ie.bgEnabled ? ie.bgColor : null;
            const isAws = ieIcon?.source === 'aws';
            const isVendorColor = ieIcon?.source === 'azure' || ieIcon?.source === 'gcp' || (isAws && !ie.monochrome);
            const ieMono = isAws && ie.monochrome;
            const ieSvgStr = ieMono ? (ieIcon?.svgMono || ieIcon?.svg || '') : (ieIcon?.svg || '');
            const ieIconColor = (ie as any).iconColor as string || '';
            const ieWhite = isVendorColor ? false : (ieIconColor ? false : (ie.bgEnabled ? true : isDarkMode()));
            const ieSvg = buildCompositeIconSvg(
                ieSvgStr || null, ieBg, ie.bgShape, ieSvgStr ? ieWhite : false,
                ie.bgRadius, ie.bgChamfer, 'normal', false, ieCanvasPx, ieIconPx, ieBgPx,
                ieIconColor || null, ie.iconOpacity ?? 100, ie.bgOpacity ?? 100
            );
            const ieHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ieSvg)}`;
            ie.href = ieHref;
            const ox = ie.offsetX * GRID_SIZE;
            const oy = ie.offsetY * GRID_SIZE;
            const skTx = (ie.skewX || ie.skewY) ? `skewX(${ie.skewX}) skewY(${ie.skewY})` : '';

            // 2D: only show "Main" icon (or the single icon if only one exists)
            const showIn2D = iconEntries.length === 1 || ie.isMain;
            if (showIn2D) {
                const x2d = (shapeW - ieCanvasPx) / 2 + ox;
                const y2d = (shapeH - ieCanvasPx) / 2 + oy;
                twoDParts.push(`<image href="${ieHref}" x="${x2d}" y="${y2d}" width="${ieCanvasPx}" height="${ieCanvasPx}"/>`);
            }

            // ISO: per-face transform
            if (ie.face === 'front') {
                const lx = (shapeW - ieCanvasPx) / 2 + ox;
                const ly = (iH - ieCanvasPx) / 2 + oy;
                const fcx = lx + ieCanvasPx / 2;
                const fcy = ly + ieCanvasPx / 2;
                isoParts.push(`<g transform="matrix(1,0,-1,-1,0,${shapeH}) rotate(180,${fcx},${fcy}) ${skTx}"><image href="${ieHref}" x="${lx}" y="${ly}" width="${ieCanvasPx}" height="${ieCanvasPx}"/></g>`);
            } else if (ie.face === 'side') {
                const lx = (shapeH - ieCanvasPx) / 2 + ox;
                const ly = (iH - ieCanvasPx) / 2 + oy;
                const fcx = lx + ieCanvasPx / 2;
                const fcy = ly + ieCanvasPx / 2;
                isoParts.push(`<g transform="matrix(0,1,-1,-1,${shapeW},0) rotate(180,${fcx},${fcy}) ${skTx}"><image href="${ieHref}" x="${lx}" y="${ly}" width="${ieCanvasPx}" height="${ieCanvasPx}"/></g>`);
            } else {
                const ix = -iH + (shapeW - ieCanvasPx) / 2 + ox;
                const iy = -iH + (shapeH - ieCanvasPx) / 2 + oy;
                const wrap = skTx ? `<g transform="${skTx}"><image href="${ieHref}" x="${ix}" y="${iy}" width="${ieCanvasPx}" height="${ieCanvasPx}"/></g>` :
                    `<image href="${ieHref}" x="${ix}" y="${iy}" width="${ieCanvasPx}" height="${ieCanvasPx}"/>`;
                isoParts.push(wrap);
            }
        }

        if (isoParts.length > 0 || twoDParts.length > 0) {
            // Iso composite: large viewBox to accommodate all face projections
            const vbSize = Math.max(shapeW, shapeH) + iH * 2;
            const isoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-iH} ${-iH} ${vbSize} ${vbSize}" width="${vbSize}" height="${vbSize}">${isoParts.join('')}</svg>`;
            const isoHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(isoSvg)}`;

            const twoDSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shapeW} ${shapeH}" width="${shapeW}" height="${shapeH}">${twoDParts.join('')}</svg>`;
            const twoDHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(twoDSvg)}`;

            iconShape.attr({
                topIcon: { href: isoHref, x: -iH, y: -iH, width: vbSize, height: vbSize, transform: null, class: '' },
                topIcon2D: { href: twoDHref, x: 0, y: 0, width: shapeW, height: shapeH, class: '' },
            });
            iconShape2D?.attr({
                topIcon: { href: isoHref, x: -iH, y: -iH, width: vbSize, height: vbSize, transform: null, class: '' },
                topIcon2D: { href: twoDHref, x: 0, y: 0, width: shapeW, height: shapeH, class: '' },
            });
            return;
        }
    }

    const icon = selectedIcon ? getIconById(selectedIcon) : undefined;
    const hasIcon = !!icon;
    const hasBg = selectedIconBgEnabled;

    if (!hasIcon && !hasBg) {
        const noIconAttrs = {
            topIcon:   { href: '', width: 0, height: 0 },
            topIcon2D: { href: '', width: 0, height: 0 },
        };
        iconShape.attr(noIconAttrs);
        iconShape2D?.attr(noIconAttrs);
        return;
    }

    const isAdaptive = selectedIconAdaptive && !selectedIconBgEnabled;
    const entry = hasIcon ? (icon as IconCatalogEntry) : null;
    const isAws = entry?.source === 'aws';
    const monoAws = isAws && selectedIconMonochrome;
    let iconSvg: string | null;
    let bgColor: string | null;
    let applyWhite: boolean;
    let iconPad: 'normal' | 'compact' | 'tight' | 'none';
    let clipIcon: boolean;

    if (!hasIcon) {
        // Background only, no icon
        iconSvg = null;
        bgColor = selectedIconBgColor;
        applyWhite = false;
        iconPad = 'none';
        clipIcon = false;
    } else if (isAws && !monoAws) {
        // AWS Color: use original full-color SVG directly, independent of icon background
        iconSvg = entry!.svg;
        bgColor = hasBg ? selectedIconBgColor : null;
        applyWhite = false;
        iconPad = 'normal';
        clipIcon = false;
    } else if (monoAws) {
        iconSvg = entry!.svgMono || entry!.svg;
        bgColor = hasBg ? selectedIconBgColor : null;
        applyWhite = hasBg ? !isAdaptive : isDarkMode();
        iconPad = 'compact';
        clipIcon = false;
    } else if (entry!.source === 'azure' || entry!.source === 'gcp') {
        iconSvg = entry!.svg;
        bgColor = hasBg ? selectedIconBgColor : null;
        applyWhite = false;
        iconPad = 'normal';
        clipIcon = false;
    } else {
        iconSvg = entry!.svg;
        bgColor = hasBg ? selectedIconBgColor : null;
        applyWhite = hasBg ? !isAdaptive : isDarkMode();
        iconPad = 'normal';
        clipIcon = false;
    }

    const canvasGU = hasIcon ? Math.max(selectedIconSize, selectedIconBgSize) : selectedIconBgSize;
    const canvasPx = canvasGU * GRID_SIZE;
    const iConPx = selectedIconSize * GRID_SIZE;
    const bgPx = selectedIconBgSize * GRID_SIZE;
    const svgSource = buildCompositeIconSvg(
        iconSvg,
        bgColor,
        selectedIconBgShape,
        applyWhite,
        selectedIconBgRadius,
        selectedIconBgChamfer,
        iconPad,
        clipIcon,
        canvasPx,
        iConPx,
        bgPx,
    );
    const adaptiveClass = isAdaptive ? 'nr-icon-adaptive' : '';
    const iconPx = canvasPx;
    const { width: w, height: h } = iconShape.size();
    const iH = iconShape.isometricHeight;
    const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSource)}`;
    // 2D: centered in the shape's own bounding box
    const oxPx = selectedIconOffsetX * GRID_SIZE;
    const oyPx = selectedIconOffsetY * GRID_SIZE;
    const x2D = (w - iconPx) / 2 + oxPx;
    const y2D = (h - iconPx) / 2 + oyPx;

    let topIconAttrs: Record<string, unknown>;

    const skewTx = (selectedIconSkewX !== 0 || selectedIconSkewY !== 0)
        ? `skewX(${selectedIconSkewX}) skewY(${selectedIconSkewY})`
        : '';

    if (selectedIconFace === 'front') {
        const localX = (w - iconPx) / 2 + oxPx;
        const localY = (iH - iconPx) / 2 + oyPx;
        const cx = localX + iconPx / 2;
        const cy = localY + iconPx / 2;
        topIconAttrs = {
            href,
            x: localX,
            y: localY,
            width:  iconPx,
            height: iconPx,
            transform: `matrix(1,0,-1,-1,0,${h}) rotate(180,${cx},${cy}) ${skewTx}`.trim(),
        };
    } else if (selectedIconFace === 'side') {
        const localX = (h - iconPx) / 2 + oxPx;
        const localY = (iH - iconPx) / 2 + oyPx;
        const cx = localX + iconPx / 2;
        const cy = localY + iconPx / 2;
        topIconAttrs = {
            href,
            x: localX,
            y: localY,
            width:  iconPx,
            height: iconPx,
            transform: `matrix(0,1,-1,-1,${w},0) rotate(180,${cx},${cy}) ${skewTx}`.trim(),
        };
    } else {
        const isoX = -iH + (w - iconPx) / 2 + oxPx;
        const isoY = -iH + (h - iconPx) / 2 + oyPx;
        topIconAttrs = {
            href,
            x: isoX,
            y: isoY,
            width:  iconPx,
            height: iconPx,
            transform: skewTx || null,
        };
    }

    // Do NOT set display here — group selectors iso/2d control visibility via toggleView().
    const iconAttrs = {
        topIcon:   { ...topIconAttrs, class: adaptiveClass },
        topIcon2D: { href, x: x2D, y: y2D, width: iconPx, height: iconPx, class: adaptiveClass },
    };
    iconShape.attr(iconAttrs);
    iconShape2D?.attr(iconAttrs);

    // Guarantee the icon element is rendered above all face paths.
    // JointJS attr() never reorders DOM nodes, so this DOM move persists.
    const isoView = paper.findViewByModel(iconShape);
    if (isoView) raiseToFront(isoView.el, 'topIcon');
    if (iconShape2D) {
        const view2D = paper2D.findViewByModel(iconShape2D);
        if (view2D) raiseToFront(view2D.el, 'topIcon2D');
    }
    if (isComplexShape && !applyingAllLayerIcons) saveIconEntriesToLayer();
}

// Re-render the Icon accordion content in place. Called when the layer set
// changes so the "Apply icon to layer" dropdown stays in sync.
function refreshIconAccordionContent(): void {
    if (!iconAccordionContentEl) return;
    iconAccordionContentEl.innerHTML = '';
    buildIconContent(iconAccordionContentEl);
}

function updateAdaptiveToggleVisibility() {
    const show = isComplexShape && !selectedIconBgEnabled;
    if (iconAdaptiveToggleRowEl) iconAdaptiveToggleRowEl.style.display = show ? '' : 'none';
    // When hidden, reset adaptive so icons render correctly on bg re-enable
    if (!show && selectedIconAdaptive) {
        selectedIconAdaptive = false;
        // iconAdaptiveToggleRowEl is the nr-toggle wrapper div; uncheck it
        if (iconAdaptiveToggleRowEl) {
            iconAdaptiveToggleRowEl.classList.remove('nr-toggle--checked');
            const btn = iconAdaptiveToggleRowEl.querySelector<HTMLButtonElement>('.nr-toggle__track');
            if (btn) btn.setAttribute('aria-checked', 'false');
        }
    }
}

function buildIconContent(container: HTMLElement) {
    // Cache the container so layer-count changes can trigger a rebuild
    // (see refreshIconAccordionContent). Without this the layer dropdown
    // below only reflects the layer set at inspector-construction time.
    iconAccordionContentEl = container;

    ensureFullCatalog();

    const getVisible = () => getVisibleIcons(isComplexShape ? 'complexShape' : 'componentEditor');

    // Icon source tabs
    let iconSourceTab: 'common' | 'aws' | 'gcp' | 'azure' = 'common';
    const tabRow = document.createElement('div');
    tabRow.className = 'nr-sd-icon-tabs';

    const tabDefs: Array<{ key: 'common' | 'aws' | 'gcp' | 'azure'; label: string }> = [
        { key: 'common', label: 'Common' },
        { key: 'aws',    label: 'AWS' },
        { key: 'gcp',    label: 'GCP' },
        { key: 'azure',  label: 'Azure' },
    ];
    const tabBtns = new Map<string, HTMLButtonElement>();

    for (const td of tabDefs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-sd-icon-tab' + (td.key === 'common' ? ' nr-sd-icon-tab--active' : '');
        btn.textContent = td.label;
        btn.addEventListener('click', () => {
            iconSourceTab = td.key;
            tabBtns.forEach((b, k) => b.classList.toggle('nr-sd-icon-tab--active', k === td.key));
            renderGrid();
            syncIconControlVisibility();
        });
        tabBtns.set(td.key, btn);
        tabRow.appendChild(btn);
    }
    container.appendChild(tabRow);

    const searchRow = document.createElement('div');
    searchRow.className = 'nr-sd-icon-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'nr-sd-icon-search-input';
    searchInput.placeholder = 'Search icons';
    searchInput.value = iconSearchTerm;
    searchInput.setAttribute('aria-label', 'Search icons');
    searchRow.appendChild(searchInput);
    container.appendChild(searchRow);

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'nr-sd-icon-scroll';

    const grid = document.createElement('div');
    grid.className = 'nr-sd-icon-grid';
    scrollWrap.appendChild(grid);

    const renderGrid = () => {
        grid.innerHTML = '';
        const visible = getVisible();
        const term = iconSearchTerm.trim().toLowerCase();
        const vendorSources = new Set(['aws', 'gcp', 'azure']);
        const sourceFiltered = vendorSources.has(iconSourceTab)
            ? visible.filter(ic => ic.source === iconSourceTab)
            : visible.filter(ic => !vendorSources.has(ic.source));
        const filtered = term
            ? sourceFiltered.filter(ic => ic.label.toLowerCase().includes(term))
            : sourceFiltered;
        const allIcons: Array<{ id: string | null; label: string; svg: string; source?: string }> = [
            { id: null, label: 'No icon', svg: NO_ICON_SVG },
            ...filtered.map(ic => ({ id: ic.id, label: ic.label, svg: ic.svg, source: ic.source })),
        ];
        for (const icon of allIcons) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-sd-icon-btn';
            const isVendor = icon.source === 'aws' || icon.source === 'gcp' || icon.source === 'azure';
            if (isVendor) {
                btn.classList.add('nr-icon-color');
                if (icon.source === 'aws' && selectedIconMonochrome) btn.classList.add('nr-icon-mono');
            }
            btn.setAttribute('title', icon.label);
            btn.setAttribute('aria-label', icon.label);
            btn.setAttribute('data-icon-id', icon.id ?? '');
            if (icon.id === null) btn.classList.add('nr-sd-icon-btn--remove');
            const isSelected = icon.id === null ? selectedIcon === null : selectedIcon === icon.id;
            if (isSelected) btn.classList.add('nr-sd-icon-btn--selected');
            if (icon.source === 'aws') {
                const entry = filtered.find(ic => ic.id === icon.id) as IconCatalogEntry | undefined;
                if (selectedIconMonochrome) {
                    btn.innerHTML = entry?.svgMono || icon.svg;
                } else {
                    btn.innerHTML = icon.svg;
                }
            } else {
                btn.innerHTML = icon.svg;
            }

            btn.addEventListener('click', () => {
                selectedIcon = icon.id;
                grid.querySelectorAll('.nr-sd-icon-btn').forEach(b =>
                    b.classList.toggle('nr-sd-icon-btn--selected', b === btn)
                );
                syncIconControlVisibility();
                applyIconToCurrentShape();
                if (iconsSectionBodyEl) {
                    const listEl = iconsSectionBodyEl.querySelector('div');
                    if (listEl) renderIconsListFn?.();
                }
                markDirty();
            });

            if (icon.source === 'uploaded') {
                btn.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (confirm(`Remove uploaded icon "${icon.label}"?`)) {
                        removeUploadedIcon(icon.id!);
                        if (selectedIcon === icon.id) {
                            selectedIcon = null;
                            applyIconToCurrentShape();
                        }
                        renderGrid();
                    }
                });
            }

            grid.appendChild(btn);
        }

        // Upload button at the end of the grid
        const uploadBtn = document.createElement('button');
        uploadBtn.type = 'button';
        uploadBtn.className = 'nr-sd-icon-btn nr-sd-icon-btn--upload';
        uploadBtn.setAttribute('title', 'Upload icon');
        uploadBtn.setAttribute('aria-label', 'Upload icon');
        uploadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M16 7l-6 6 1.41 1.41L15 10.83V24h2V10.83l3.59 3.58L22 13l-6-6z"/><path d="M6 28h20v-6h-2v4H8v-4H6v6z"/></svg>`;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.svg,image/svg+xml,.png,image/png';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const label = file.name.replace(/\.[^.]+$/, '');

            if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
                const reader = new FileReader();
                reader.onload = () => {
                    const svgText = reader.result as string;
                    const id = addUploadedIcon(label, svgText);
                    selectedIcon = id;
                    applyIconToCurrentShape();
                    renderGrid();
                };
                reader.readAsText(file);
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUri = reader.result as string;
                    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image href="${dataUri}" width="32" height="32"/></svg>`;
                    const id = addUploadedIcon(label, svg);
                    selectedIcon = id;
                    applyIconToCurrentShape();
                    renderGrid();
                };
                reader.readAsDataURL(file);
            }
            fileInput.value = '';
        });

        uploadBtn.addEventListener('click', () => fileInput.click());
        grid.appendChild(fileInput);
        grid.appendChild(uploadBtn);
    };

    searchInput.addEventListener('input', () => {
        iconSearchTerm = searchInput.value;
        renderGrid();
    });

    renderGrid();

    container.appendChild(scrollWrap);

    // Adaptive icon toggle — only in complex shape + no-bg mode
    // Uses nr-toggle: button-based, ::before thumb, no cds-- conflict.
    const adaptiveRow = document.createElement('div');
    adaptiveRow.className = 'nr-toggle' + (selectedIconAdaptive ? ' nr-toggle--checked' : '');
    adaptiveRow.style.display = (isComplexShape && !selectedIconBgEnabled) ? '' : 'none';
    iconAdaptiveToggleRowEl = adaptiveRow;

    const adaptiveLabelText = document.createElement('span');
    adaptiveLabelText.className = 'nr-toggle__label-text';
    adaptiveLabelText.textContent = 'Theme adaptive';

    const adaptiveTrack = document.createElement('button');
    adaptiveTrack.type = 'button';
    adaptiveTrack.id = 'sd-icon-adaptive';
    adaptiveTrack.className = 'nr-toggle__track';
    adaptiveTrack.setAttribute('role', 'switch');
    adaptiveTrack.setAttribute('aria-checked', selectedIconAdaptive ? 'true' : 'false');
    adaptiveTrack.setAttribute('aria-label', 'Theme adaptive');

    adaptiveTrack.addEventListener('click', () => {
        const next = !adaptiveRow.classList.contains('nr-toggle--checked');
        adaptiveRow.classList.toggle('nr-toggle--checked', next);
        adaptiveTrack.setAttribute('aria-checked', next ? 'true' : 'false');
        selectedIconAdaptive = next;
        applyIconToCurrentShape();
    });

    adaptiveRow.appendChild(adaptiveLabelText);
    adaptiveRow.appendChild(adaptiveTrack);
    container.appendChild(adaptiveRow);

    // AWS icon mode switcher — Colored or Monochrome (only for AWS)
    const iconModeRow = document.createElement('div');
    iconModeRow.className = 'nr-sd-face-row';
    iconModeRow.style.display = 'none';

    const modeLbl = document.createElement('label');
    modeLbl.className = 'nr-sd-row-label';
    modeLbl.textContent = 'Style';

    const modeSwitcher = document.createElement('div');
    modeSwitcher.className = 'nr-seg-control nr-seg-control--fixed';

    for (const mode of ['colored', 'mono'] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = mode === 'colored' ? !selectedIconMonochrome : selectedIconMonochrome;
        btn.className = 'nr-seg-btn' + (isActive ? ' nr-seg-btn--selected' : '');
        btn.textContent = mode === 'colored' ? 'Color' : 'Mono';
        btn.addEventListener('click', () => {
            selectedIconMonochrome = mode === 'mono';
            modeSwitcher.querySelectorAll('.nr-seg-btn').forEach(b =>
                b.classList.toggle('nr-seg-btn--selected', b === btn)
            );
            renderGrid();
            syncIconControlVisibility();
            applyIconToCurrentShape();
        });
        modeSwitcher.appendChild(btn);
    }

    iconModeRow.appendChild(modeLbl);
    iconModeRow.appendChild(modeSwitcher);
    container.appendChild(iconModeRow);

    function syncIconControlVisibility() {
        iconModeRow.style.display = iconSourceTab === 'aws' ? '' : 'none';
        modeSwitcher.querySelectorAll('.nr-seg-btn').forEach((b, i) => {
            b.classList.toggle('nr-seg-btn--selected', i === 0 ? !selectedIconMonochrome : selectedIconMonochrome);
        });
        // Apply mono filter only to AWS icons in the grid
        grid.querySelectorAll('.nr-sd-icon-btn.nr-icon-color').forEach(btn => {
            const isAws = iconSourceTab === 'aws';
            btn.classList.toggle('nr-icon-mono', isAws && selectedIconMonochrome);
        });
    }



    // ── Placement (merged from former Icon Placement section) ─────────
    iconFaceRowEl = document.createElement('div');
    iconFaceRowEl.className = 'nr-sd-face-row';

    const faceLbl = document.createElement('label');
    faceLbl.className = 'nr-sd-row-label';
    faceLbl.textContent = 'Placement';

    const faceSwitcher = document.createElement('div');
    faceSwitcher.className = 'nr-seg-control nr-seg-control--fixed';

    // For rotated forms, the internal face is swapped — show the default-form perspective
    const swapFace = (f: 'top' | 'front' | 'side'): 'top' | 'front' | 'side' => {
        if (!ROTATED_FORMS.has(selectedBaseShape)) return f;
        if (f === 'front') return 'side';
        if (f === 'side') return 'front';
        return f;
    };
    const displayFace = swapFace(selectedIconFace);

    for (const face of ['top', 'front', 'side'] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn' + (displayFace === face ? ' nr-seg-btn--selected' : '');
        btn.textContent = face.charAt(0).toUpperCase() + face.slice(1);
        btn.addEventListener('click', () => {
            // User picks in default-form perspective; swap to internal for rotated forms
            selectedIconFace = swapFace(face);
            faceSwitcher.querySelectorAll('.nr-seg-btn').forEach(b =>
                b.classList.toggle('nr-seg-btn--selected', b === btn)
            );
            applyIconToCurrentShape();
        });
        faceSwitcher.appendChild(btn);
    }

    iconFaceRowEl.appendChild(faceLbl);
    iconFaceRowEl.appendChild(faceSwitcher);
    container.appendChild(iconFaceRowEl);

    // Size — in pixels (1 GU = GRID_SIZE px)
    let iconSizeInputRef: HTMLInputElement;
    buildSliderField('Size', 'sd-icon-size', 0.5, 4, 0.1,
        (el) => { iconSizeInputRef = el; el.value = String(selectedIconSize); },
        (el) => { el.id = 'sd-icon-size-value'; },
        () => {
            selectedIconSize = parseFloat(iconSizeInputRef.value);
            applyIconToCurrentShape();
        },
        container, 'px');

    // Helper: build a dual X/Y input row
    const buildDualRow = (label: string, xVal: number, yVal: number, min: number, max: number, step: number, unit: string,
        onChangeX: (v: number) => void, onChangeY: (v: number) => void) => {
        const row = document.createElement('div');
        row.className = 'nr-sd-number-row';
        const lbl = document.createElement('label');
        lbl.className = 'nr-sd-number-label';
        lbl.textContent = label;
        row.appendChild(lbl);

        const wrap = document.createElement('div');
        wrap.className = 'nr-sd-dual-inputs';

        const buildHalf = (axis: string, val: number, onChange: (v: number) => void) => {
            const group = document.createElement('div');
            group.className = 'nr-sd-dual-group';
            const axisLbl = document.createElement('span');
            axisLbl.className = 'nr-sd-dual-axis';
            axisLbl.textContent = axis;
            group.appendChild(axisLbl);
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'nr-sd-dual-input';
            input.value = Number.isInteger(val) ? `${val}${unit}` : `${parseFloat(val.toFixed(2))}${unit}`;
            input.addEventListener('change', () => {
                const raw = parseFloat(input.value);
                if (!isNaN(raw)) {
                    const clamped = Math.max(min, Math.min(max, raw));
                    onChange(clamped);
                    input.value = Number.isInteger(clamped) ? `${clamped}${unit}` : `${parseFloat(clamped.toFixed(2))}${unit}`;
                }
            });
            // Drag-to-scrub
            let scrubX = 0, scrubV = 0;
            input.addEventListener('mousedown', (e: MouseEvent) => {
                if (document.activeElement === input) return;
                e.preventDefault();
                scrubX = e.clientX;
                scrubV = parseFloat(input.value) || 0;
                document.body.style.cursor = 'ew-resize';
                input.style.cursor = 'ew-resize';
                const onMove = (ev: MouseEvent) => {
                    const delta = Math.round((ev.clientX - scrubX) / 4) * step;
                    const nv = Math.max(min, Math.min(max, scrubV + delta));
                    onChange(nv);
                    input.value = Number.isInteger(nv) ? `${nv}${unit}` : `${parseFloat(nv.toFixed(2))}${unit}`;
                };
                const onUp = () => {
                    document.body.style.cursor = '';
                    input.style.cursor = '';
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            group.appendChild(input);
            return group;
        };

        wrap.appendChild(buildHalf('X', xVal, onChangeX));
        wrap.appendChild(buildHalf('Y', yVal, onChangeY));
        row.appendChild(wrap);
        container.appendChild(row);
    };

    // Offset
    buildDualRow('Offset', selectedIconOffsetX, selectedIconOffsetY, -1, 1, 0.05, '',
        (v) => { selectedIconOffsetX = v; applyIconToCurrentShape(); },
        (v) => { selectedIconOffsetY = v; applyIconToCurrentShape(); });

    // Skew
    buildDualRow('Skew', selectedIconSkewX, selectedIconSkewY, -30, 30, 1, '°',
        (v) => { selectedIconSkewX = v; applyIconToCurrentShape(); },
        (v) => { selectedIconSkewY = v; applyIconToCurrentShape(); });

    // Icon Color — same swatch popup pattern as background color
    const iconColorRow = document.createElement('div');
    iconColorRow.className = 'nr-sd-hex-color-row';
    iconColorRow.style.position = 'relative';
    const iconColorLabel = document.createElement('label');
    iconColorLabel.className = 'nr-sd-number-label';
    iconColorLabel.textContent = 'Icon Color';

    const curIconColor = (editingIconIndex >= 0 && iconEntries[editingIconIndex])
        ? ((iconEntries[editingIconIndex] as any).iconColor || '') : '';

    const icHexWrap = document.createElement('div');
    icHexWrap.className = 'nr-sd-hex-input-wrap';
    const icHexInput = document.createElement('input');
    icHexInput.type = 'text';
    icHexInput.className = 'nr-sd-hex-input';
    icHexInput.readOnly = true;
    icHexInput.style.cursor = 'pointer';
    icHexInput.value = curIconColor || 'None';
    const icColorBtn = document.createElement('button');
    icColorBtn.type = 'button';
    icColorBtn.className = 'nr-sd-hex-color-btn';
    icColorBtn.style.backgroundColor = curIconColor || 'transparent';

    const icPopup = document.createElement('div');
    icPopup.className = 'nr-sd-color-popup';
    icPopup.style.display = 'none';

    const setIconColor = (c: string) => {
        icHexInput.value = c || 'None';
        icColorBtn.style.backgroundColor = c || 'transparent';
        if (editingIconIndex >= 0 && iconEntries[editingIconIndex]) {
            (iconEntries[editingIconIndex] as any).iconColor = c;
        }
        applyIconToCurrentShape();
        markDirty();
    };

    // "None" button
    const icNoneBtn = document.createElement('button');
    icNoneBtn.type = 'button';
    icNoneBtn.className = 'nr-sd-color-popup__no-color';
    icNoneBtn.title = 'None';
    icNoneBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 0 1 4.24 10.24L3.76 3.76A5.97 5.97 0 0 1 8 2zM3.76 12.24a6 6 0 0 1 8.48-8.48z"/></svg>';
    icNoneBtn.addEventListener('click', () => { icPopup.style.display = 'none'; setIconColor(''); });
    icPopup.appendChild(icNoneBtn);

    for (const c of PRIMARY_COLORS) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'nr-sd-color-popup__swatch';
        swatch.style.backgroundColor = c.base;
        swatch.title = c.label;
        swatch.addEventListener('click', () => { icPopup.style.display = 'none'; setIconColor(c.base); });
        icPopup.appendChild(swatch);
    }

    const icHiddenPicker = document.createElement('input');
    icHiddenPicker.type = 'color';
    icHiddenPicker.className = 'nr-sd-hex-hidden-picker';
    icHiddenPicker.value = curIconColor || '#525252';
    const icCustomSwatch = document.createElement('button');
    icCustomSwatch.type = 'button';
    icCustomSwatch.className = 'nr-sd-color-popup__swatch nr-sd-color-popup__swatch--custom';
    icCustomSwatch.title = 'Custom color';
    icCustomSwatch.innerHTML = '<svg viewBox="0 0 32 32" fill="currentColor" width="12" height="12"><path d="M29.391,2.609a3.279,3.279,0,0,0-4.634,0L18.4835,8.883,12.793,3.207,11.3789,4.6211l4.2764,4.2764L2.4072,22.146A.9967.9967,0,0,0,2.1,22.78L.042,29.0361a1,1,0,0,0,1.265,1.2637l6.2549-2.0586a.9974.9974,0,0,0,.6348-.3076L21.4453,14.6855l4.2764,4.2764,1.4141-1.4141L21.4116,11.8237l6.2744-6.2744.0051-.0051a3.2781,3.2781,0,0,0,0-4.634ZM6.8965,27.0017l-4.3384,1.4275L3.985,24.0908ZM28.2808,5.8281l-.0051.0051L21.9316,12.177l-.707-.707,6.3491-6.3491a1.2783,1.2783,0,0,1,1.806,0h0a1.2776,1.2776,0,0,1-.0977,1.7071Z"/></svg>';
    icCustomSwatch.addEventListener('click', () => { icPopup.style.display = 'none'; icHiddenPicker.click(); });
    icPopup.appendChild(icCustomSwatch);
    icHiddenPicker.addEventListener('input', () => setIconColor(icHiddenPicker.value));

    icColorBtn.addEventListener('click', () => {
        const show = icPopup.style.display === 'none';
        icPopup.style.display = show ? '' : 'none';
        if (show) {
            const r = icColorBtn.getBoundingClientRect();
            icPopup.style.left = r.left + 'px';
            requestAnimationFrame(() => {
                const pH = icPopup.offsetHeight;
                icPopup.style.top = (r.top - pH - 4) + 'px';
            });
        }
    });
    icHexInput.addEventListener('click', () => icColorBtn.click());
    document.addEventListener('mousedown', (e) => { if (!icHexWrap.contains(e.target as Node)) icPopup.style.display = 'none'; }, true);

    icHexWrap.appendChild(icHexInput);
    icHexWrap.appendChild(icColorBtn);
    icHexWrap.appendChild(icHiddenPicker);
    icHexWrap.appendChild(icPopup);
    iconColorRow.appendChild(iconColorLabel);
    iconColorRow.appendChild(icHexWrap);
    container.appendChild(iconColorRow);

    // Icon Opacity
    const curIconOpacity = (editingIconIndex >= 0 && iconEntries[editingIconIndex])
        ? (iconEntries[editingIconIndex].iconOpacity ?? 100) : 100;
    let iconOpacityInputRef: HTMLInputElement;
    buildSliderField('Icon Opacity', 'sd-icon-opacity', 0, 100, 5,
        (el) => { iconOpacityInputRef = el; el.value = String(curIconOpacity); },
        () => {},
        () => {
            if (editingIconIndex >= 0 && iconEntries[editingIconIndex]) {
                iconEntries[editingIconIndex].iconOpacity = parseFloat(iconOpacityInputRef.value);
                applyIconToCurrentShape();
            }
        },
        container, '%');
}

function buildIconBackgroundContent(container: HTMLElement) {
    iconBgSwatchRefs = [];
    syncIconBgColorDisplay = () => {};


    // Hidden swatch row for sync compatibility
    const swatchRow = document.createElement('div');
    swatchRow.style.display = 'none';
    for (const color of PRIMARY_COLORS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        iconBgSwatchRefs.push({ btn, colorBase: color.base });
        swatchRow.appendChild(btn);
    }
    container.appendChild(swatchRow);

    // ── Hex color input with color picker popup ──────────────────────────────
    const customColorRow = document.createElement('div');
    customColorRow.className = 'nr-sd-hex-color-row';
    iconBgCustomColorRowEl = customColorRow;

    const customColorLabel = document.createElement('label');
    customColorLabel.className = 'nr-sd-number-label';
    customColorLabel.textContent = 'Background Color';

    const hexWrap = document.createElement('div');
    hexWrap.className = 'nr-sd-hex-input-wrap';

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'nr-sd-hex-input';
    hexInput.placeholder = '#000000';
    iconBgCustomColorInputRef = hexInput as any;

    const colorBtn = document.createElement('button');
    colorBtn.type = 'button';
    colorBtn.className = 'nr-sd-hex-color-btn';

    const NO_COLOR_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><line x1="3" y1="13" x2="13" y2="3"/></svg>';

    const hiddenPicker = document.createElement('input');
    hiddenPicker.type = 'color';
    hiddenPicker.className = 'nr-sd-hex-hidden-picker';
    hiddenPicker.value = selectedIconBgColor;

    syncIconBgColorDisplay = () => {
        if (selectedIconBgEnabled) {
            hexInput.value = selectedIconBgColor;
            hexInput.classList.remove('nr-sd-hex-input--default');
            colorBtn.style.backgroundColor = selectedIconBgColor;
            colorBtn.innerHTML = '';
        } else {
            hexInput.value = 'None';
            hexInput.classList.add('nr-sd-hex-input--default');
            colorBtn.style.backgroundColor = '';
            colorBtn.innerHTML = NO_COLOR_ICON;
        }
        hiddenPicker.value = selectedIconBgColor;
        if (iconBgSettingsWrapEl) iconBgSettingsWrapEl.style.display = selectedIconBgEnabled ? '' : 'none';
    };
    syncIconBgColorDisplay();

    // Unified popup: no-color + presets + custom picker
    const popup = document.createElement('div');
    popup.className = 'nr-sd-color-popup';
    popup.style.display = 'none';

    // No color option
    const noColorBtn = document.createElement('button');
    noColorBtn.type = 'button';
    noColorBtn.className = 'nr-sd-color-popup__no-color';
    noColorBtn.title = 'No color';
    noColorBtn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><line x1="3" y1="13" x2="13" y2="3"/></svg>';
    noColorBtn.addEventListener('click', () => {
        selectedIconBgEnabled = false;
        popup.style.display = 'none';
        syncIconBgColorDisplay();
        updateAdaptiveToggleVisibility();
        applyIconToCurrentShape();
        markDirty();
    });
    popup.appendChild(noColorBtn);

    // Preset swatches
    for (const color of PRIMARY_COLORS) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'nr-sd-color-popup__swatch';
        swatch.style.backgroundColor = color.base;
        swatch.title = color.label;
        swatch.addEventListener('click', () => {
            selectedIconBgEnabled = true;
            selectedIconBgColor = color.base;
            hiddenPicker.value = color.base;
            popup.style.display = 'none';
            syncIconBgColorDisplay();
            updateAdaptiveToggleVisibility();
            applyIconToCurrentShape();
            markDirty();
        });
        popup.appendChild(swatch);
    }

    // Custom color swatch (pipette icon)
    const customSwatch = document.createElement('button');
    customSwatch.type = 'button';
    customSwatch.className = 'nr-sd-color-popup__swatch nr-sd-color-popup__swatch--custom';
    customSwatch.title = 'Custom color';
    customSwatch.innerHTML = carbonIconToString(Eyedropper16 as CarbonIcon);
    customSwatch.addEventListener('click', () => {
        popup.style.display = 'none';
        hiddenPicker.click();
    });
    popup.appendChild(customSwatch);

    colorBtn.addEventListener('click', () => {
        const show = popup.style.display === 'none';
        popup.style.display = show ? '' : 'none';
        if (show) {
            const r = colorBtn.getBoundingClientRect();
            popup.style.left = r.left + 'px';
            requestAnimationFrame(() => {
                const pH = popup.offsetHeight;
                popup.style.top = (r.top - pH - 4) + 'px';
            });
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (!hexWrap.contains(e.target as Node)) popup.style.display = 'none';
    }, true);

    hiddenPicker.addEventListener('input', () => {
        selectedIconBgEnabled = true;
        selectedIconBgColor = hiddenPicker.value;
        syncIconBgColorDisplay();
        updateAdaptiveToggleVisibility();
        applyIconToCurrentShape();
        markDirty();
    });

    hexInput.readOnly = true;
    hexInput.style.cursor = 'pointer';
    hexInput.addEventListener('click', () => {
        colorBtn.click();
    });

    hexWrap.appendChild(hexInput);
    hexWrap.appendChild(colorBtn);
    hexWrap.appendChild(hiddenPicker);
    hexWrap.appendChild(popup);
    customColorRow.appendChild(customColorLabel);
    customColorRow.appendChild(hexWrap);
    container.appendChild(customColorRow);

    // ── Background settings (visible when bg color is selected) ─────────
    const bgSettingsWrap = document.createElement('div');
    bgSettingsWrap.className = 'nr-sd-bg-settings';
    bgSettingsWrap.style.display = selectedIconBgEnabled ? '' : 'none';
    iconBgSettingsWrapEl = bgSettingsWrap;

    let bgSizeInputRef: HTMLInputElement;
    buildSliderField('Bg Size', 'sd-icon-bg-size', 0.5, 4, 0.1,
        (el) => { bgSizeInputRef = el; el.value = String(selectedIconBgSize); },
        (el) => { el.id = 'sd-icon-bg-size-value'; },
        () => {
            selectedIconBgSize = parseFloat(bgSizeInputRef.value);
            applyIconToCurrentShape();
        },
        bgSettingsWrap, 'px');

    // ── Shape switcher ─────────────────────────────────────────────────────
    const shapeRow = document.createElement('div');
    shapeRow.className = 'nr-sd-face-row';

    const shapeLbl = document.createElement('label');
    shapeLbl.className = 'nr-sd-row-label';
    shapeLbl.textContent = 'Bg Shape';

    const shapeSwitcher = document.createElement('div');
    shapeSwitcher.className = 'nr-seg-control nr-seg-control--fixed';

    for (const opt of [{ value: 'square' as const, label: 'Square' }, { value: 'circle' as const, label: 'Circle' }, { value: 'octagon' as const, label: 'Octagon' }]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn' + (selectedIconBgShape === opt.value ? ' nr-seg-btn--selected' : '');
        btn.title = opt.label;
        btn.innerHTML = CLIP_SHAPE_ICONS[opt.value];
        btn.addEventListener('click', () => {
            selectedIconBgShape = opt.value;
            shapeSwitcher.querySelectorAll('.nr-seg-btn').forEach(b =>
                b.classList.toggle('nr-seg-btn--selected', b === btn)
            );
            if (iconBgCornerRadiusRowEl) {
                iconBgCornerRadiusRowEl.style.display = opt.value === 'square' ? '' : 'none';
            }
            if (iconBgChamferRowEl) {
                iconBgChamferRowEl.style.display = opt.value === 'octagon' ? '' : 'none';
            }
            applyIconToCurrentShape();
        });
        shapeSwitcher.appendChild(btn);
    }

    shapeRow.appendChild(shapeLbl);
    shapeRow.appendChild(shapeSwitcher);
    bgSettingsWrap.appendChild(shapeRow);

    // ── Corner Roundness (square only) ─────────────────────────────────
    const crWrap = document.createElement('div');
    crWrap.style.display = selectedIconBgShape === 'square' ? '' : 'none';
    iconBgCornerRadiusRowEl = crWrap;
    buildSliderField('Bg Corner Radius', 'sd-icon-bg-radius', 0, 32, 1,
        (el) => { el.value = String(selectedIconBgRadius); iconBgCornerRadiusInputRef = el; },
        (el) => { el.id = 'sd-icon-bg-radius-value'; },
        () => {
            selectedIconBgRadius = parseInt(iconBgCornerRadiusInputRef!.value, 10);
            applyIconToCurrentShape();
        },
        crWrap, 'px');
    bgSettingsWrap.appendChild(crWrap);

    // ── Octagon Cut Depth (octagon only) ──────────────────────────────
    const ocWrap = document.createElement('div');
    ocWrap.style.display = selectedIconBgShape === 'octagon' ? '' : 'none';
    iconBgChamferRowEl = ocWrap;
    buildSliderField('Bg Depth', 'sd-icon-bg-chamfer', 0.05, 0.45, 0.01,
        (el) => { el.value = String(selectedIconBgChamfer); iconBgChamferInputRef = el; },
        (el) => { el.id = 'sd-icon-bg-chamfer-value'; },
        () => {
            selectedIconBgChamfer = parseFloat(iconBgChamferInputRef.value);
            applyIconToCurrentShape();
        },
        ocWrap, '%');
    bgSettingsWrap.appendChild(ocWrap);

    // Background Opacity
    const curBgOpacity = (editingIconIndex >= 0 && iconEntries[editingIconIndex])
        ? (iconEntries[editingIconIndex].bgOpacity ?? 100) : 100;
    let bgOpacityInputRef: HTMLInputElement;
    buildSliderField('Bg Opacity', 'sd-icon-bg-opacity', 0, 100, 5,
        (el) => { bgOpacityInputRef = el; el.value = String(curBgOpacity); },
        () => {},
        () => {
            if (editingIconIndex >= 0 && iconEntries[editingIconIndex]) {
                iconEntries[editingIconIndex].bgOpacity = parseFloat(bgOpacityInputRef.value);
                applyIconToCurrentShape();
            }
        },
        bgSettingsWrap, '%');

    container.appendChild(bgSettingsWrap);

}

function buildColorContent(container: HTMLElement) {
    const hasCustomColor = !!(selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor);
    const current = hasCustomColor ? (selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor) : null;

    function applyColor(val: string) {
        selectedStyle.topColor   = val;
        selectedStyle.frontColor = val;
        selectedStyle.sideColor  = val;
        if (isComplexShape) {
            const layer = layers[selectedLayerIndex];
            if (layer) { layer.style.topColor = val; layer.style.frontColor = val; layer.style.sideColor = val; }
            const s = layerShapes[selectedLayerIndex], s2D = layerShapes2D[selectedLayerIndex];
            if (s)   applyShapeStyle(s,   layer?.style ?? {});
            if (s2D) applyShapeStyle(s2D, layer?.style ?? {});
            return;
        }
        if (currentShape)   applyShapeStyle(currentShape,   selectedStyle);
        if (currentShape2D) applyShapeStyle(currentShape2D, selectedStyle);
    }

    function buildHexColorRow(label: string, id: string, value: string | null, onChange: (val: string) => void, onClear?: () => void): HTMLElement {
        const NO_COLOR_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><line x1="3" y1="13" x2="13" y2="3"/></svg>';
        let isNone = value === null;

        const row = document.createElement('div');
        row.className = 'nr-sd-hex-color-row';

        const lbl = document.createElement('label');
        lbl.className = 'nr-sd-number-label';
        lbl.textContent = label;

        const hexWrap = document.createElement('div');
        hexWrap.className = 'nr-sd-hex-input-wrap';

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.id = id;
        hexInput.className = 'nr-sd-hex-input';
        hexInput.placeholder = '#000000';

        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'nr-sd-hex-color-btn';

        const hiddenPicker = document.createElement('input');
        hiddenPicker.type = 'color';
        hiddenPicker.className = 'nr-sd-hex-hidden-picker';
        hiddenPicker.value = value || '#e0e0e0';

        if (id === 'sd-color-light') colorPickerRef = hiddenPicker;

        const syncDisplay = () => {
            if (isNone) {
                hexInput.value = 'None';
                hexInput.classList.add('nr-sd-hex-input--default');
                colorBtn.style.backgroundColor = '';
                colorBtn.innerHTML = NO_COLOR_ICON;
            } else {
                hexInput.value = value!;
                hexInput.classList.remove('nr-sd-hex-input--default');
                colorBtn.style.backgroundColor = value!;
                colorBtn.innerHTML = '';
            }
        };
        syncDisplay();

        const popup = document.createElement('div');
        popup.className = 'nr-sd-color-popup';
        popup.style.display = 'none';

        if (onClear) {
            const noColorBtn = document.createElement('button');
            noColorBtn.type = 'button';
            noColorBtn.className = 'nr-sd-color-popup__no-color';
            noColorBtn.title = 'Default';
            noColorBtn.innerHTML = NO_COLOR_ICON;
            noColorBtn.addEventListener('click', () => {
                isNone = true;
                popup.style.display = 'none';
                syncDisplay();
                onClear();
            });
            popup.appendChild(noColorBtn);
        }

        for (const color of PRIMARY_COLORS) {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'nr-sd-color-popup__swatch';
            swatch.style.backgroundColor = color.base;
            swatch.title = color.label;
            swatch.addEventListener('click', () => {
                isNone = false;
                value = color.base;
                hiddenPicker.value = color.base;
                popup.style.display = 'none';
                syncDisplay();
                onChange(color.base);
            });
            popup.appendChild(swatch);
        }
        const customSwatch = document.createElement('button');
        customSwatch.type = 'button';
        customSwatch.className = 'nr-sd-color-popup__swatch nr-sd-color-popup__swatch--custom';
        customSwatch.title = 'Custom color';
        customSwatch.innerHTML = carbonIconToString(Eyedropper16 as CarbonIcon);
        customSwatch.addEventListener('click', () => { popup.style.display = 'none'; hiddenPicker.click(); });
        popup.appendChild(customSwatch);

        colorBtn.addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? '' : 'none'; });
        document.addEventListener('mousedown', (e) => { if (!hexWrap.contains(e.target as Node)) popup.style.display = 'none'; }, true);

        hiddenPicker.addEventListener('input', () => {
            isNone = false;
            value = hiddenPicker.value;
            syncDisplay();
            onChange(hiddenPicker.value);
        });

        hexInput.readOnly = true;
        hexInput.style.cursor = 'pointer';
        hexInput.addEventListener('click', () => { colorBtn.click(); });
        hexInput.addEventListener('change', () => {
            let v = hexInput.value.trim();
            if (!v.startsWith('#')) v = '#' + v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                isNone = false;
                value = v;
                hiddenPicker.value = v;
                syncDisplay();
                onChange(v);
            }
        });

        hexWrap.appendChild(hexInput);
        hexWrap.appendChild(colorBtn);
        hexWrap.appendChild(hiddenPicker);
        hexWrap.appendChild(popup);
        row.appendChild(lbl);
        row.appendChild(hexWrap);
        return row;
    }

    const clearColor = () => {
        selectedStyle.topColor = '';
        selectedStyle.frontColor = '';
        selectedStyle.sideColor = '';
        selectedStyle.strokeColor = '';
        for (const shape of [currentShape, currentShape2D]) {
            if (!shape) continue;
            const isTubeDuct = shape.attr('body/d') || shape.attr('outline/d');
            const defaults: Record<string, string> = isTubeDuct
                ? { body: '#e0e0e0', frontEllipse: '#c6c6c6', backArc: '#c6c6c6', outline: '#e0e0e0', frontFace: '#c6c6c6' }
                : { top: '#e0e0e0', front: '#c6c6c6', base: '#c6c6c6', side: '#a8a8a8', cornerV1: '#a8a8a8', cornerV2: '#a8a8a8', cornerV3: '#c6c6c6' };
            for (const [sel, fill] of Object.entries(defaults)) {
                shape.attr(`${sel}/fill`, fill);
            }
        }
    };
    container.appendChild(buildHexColorRow('Light Mode', 'sd-color-light', current, applyColor, clearColor));
    container.appendChild(buildHexColorRow('Dark Mode', 'sd-color-dark', current, applyColor, clearColor));

    const colorResetBtn = document.createElement('button');
    colorResetBtn.type = 'button';
    colorResetBtn.className = 'nr-sd-reset-btn';
    colorResetBtn.title = 'Reset to default';
    colorResetBtn.innerHTML = 'Reset to default';
    colorResetBtn.addEventListener('click', () => {
        clearColor();
        // Update both color row displays to "None" without rebuilding
        container.querySelectorAll<HTMLInputElement>('.nr-sd-hex-input').forEach(inp => {
            inp.value = 'None';
            inp.classList.add('nr-sd-hex-input--default');
        });
        container.querySelectorAll<HTMLElement>('.nr-sd-hex-color-btn').forEach(btn => {
            btn.style.backgroundColor = '';
            btn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><line x1="3" y1="13" x2="13" y2="3"/></svg>';
        });
        markDirty();
    });
    container.appendChild(colorResetBtn);
}

function saveAccordionState(): Record<string, boolean> {
    const state: Record<string, boolean> = {};
    inspectorEl.querySelectorAll('.cds--accordion__item').forEach(li => {
        const title = li.querySelector('.cds--accordion__title')?.textContent ?? '';
        if (title) state[title] = li.classList.contains('cds--accordion__item--active');
    });
    return state;
}

function restoreAccordionState(state: Record<string, boolean>) {
    if (Object.keys(state).length === 0) return;
    inspectorEl.querySelectorAll('.cds--accordion__item').forEach(li => {
        const title = li.querySelector('.cds--accordion__title')?.textContent ?? '';
        if (title in state) {
            li.classList.toggle('cds--accordion__item--active', state[title]);
            const heading = li.querySelector('.cds--accordion__heading');
            if (heading) heading.setAttribute('aria-expanded', String(state[title]));
        }
    });
}

function buildInspectorPanel() {
    const prevAccordionState = saveAccordionState();
    inspectorEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'nr-panel-header';
    const title = document.createElement('span');
    title.className = 'nr-panel-title';
    title.textContent = 'Component Configuration';
    header.appendChild(title);

    headerSaveBtn = document.createElement('button');
    headerSaveBtn.type = 'button';
    headerSaveBtn.className = 'nr-save-btn nr-save-btn--disabled';
    headerSaveBtn.disabled = true;
    headerSaveBtn.innerHTML = carbonIconToString(Save16 as CarbonIcon);
    headerSaveBtn.title = 'Save Component';
    headerSaveBtn.addEventListener('click', async () => {
        await onSave();
        clearDirty();
    });
    // Overflow menu (Duplicate / Delete)
    const overflowWrap = document.createElement('div');
    overflowWrap.className = 'nr-overflow-wrap';

    const overflowBtn = document.createElement('button');
    overflowBtn.type = 'button';
    overflowBtn.className = 'nr-save-btn';
    overflowBtn.title = 'More actions';
    overflowBtn.innerHTML = carbonIconToString(OverflowMenuVertical16 as CarbonIcon);

    const overflowMenu = document.createElement('ul');
    overflowMenu.className = 'nr-overflow-menu';

    const dupItem = document.createElement('li');
    dupItem.className = 'nr-overflow-menu__item';
    dupItem.innerHTML = CDS_ICON_COPY + ' Duplicate';
    dupItem.addEventListener('click', () => {
        overflowMenu.classList.remove('nr-overflow-menu--open');
        showDuplicateShapeModal(currentShapeId);
    });

    const delItem = document.createElement('li');
    delItem.className = 'nr-overflow-menu__item nr-overflow-menu__item--danger';
    delItem.innerHTML = CDS_ICON_TRASH + ' Delete';
    delItem.addEventListener('click', () => {
        overflowMenu.classList.remove('nr-overflow-menu--open');
        showDeleteConfirmModal(currentShapeId);
    });

    overflowMenu.appendChild(dupItem);
    overflowMenu.appendChild(delItem);

    overflowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overflowMenu.classList.toggle('nr-overflow-menu--open');
    });

    document.addEventListener('click', () => {
        overflowMenu.classList.remove('nr-overflow-menu--open');
    });

    overflowWrap.appendChild(overflowBtn);
    overflowWrap.appendChild(overflowMenu);

    const adminToggleBtn = document.createElement('button');
    adminToggleBtn.type = 'button';
    adminToggleBtn.className = 'nr-save-btn' + (adminMode ? ' nr-save-btn--active' : '');
    adminToggleBtn.title = adminMode ? 'Hide admin controls' : 'Show admin controls';
    adminToggleBtn.innerHTML = carbonIconToString((adminMode ? View16 : ViewOff16) as CarbonIcon);
    adminToggleBtn.addEventListener('click', () => {
        adminMode = !adminMode;
        adminToggleBtn.innerHTML = carbonIconToString((adminMode ? View16 : ViewOff16) as CarbonIcon);
        adminToggleBtn.classList.toggle('nr-save-btn--active', adminMode);
        adminToggleBtn.title = adminMode ? 'Hide admin controls' : 'Show admin controls';
        if (setDefaultBtn) setDefaultBtn.style.display = adminMode ? '' : 'none';
        // Toggle admin-only icon fields and modifier fields
        document.querySelectorAll<HTMLElement>('[data-icon-admin]').forEach(el => {
            el.style.display = adminMode ? '' : 'none';
        });
        syncModifierVisibility();
    });

    const headerActions = document.createElement('div');
    headerActions.className = 'nr-header-actions';
    headerActions.appendChild(adminToggleBtn);
    headerActions.appendChild(overflowWrap);
    headerActions.appendChild(headerSaveBtn);
    header.appendChild(headerActions);

    inspectorEl.appendChild(header);
    inspectorDirty = false;

    inspectorEl.addEventListener('input', markDirty);
    inspectorEl.addEventListener('change', markDirty);
    inspectorEl.addEventListener('click', (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('.nr-toggle__track, .nr-sd-dropdown__item, .nr-sd-color-swatch, .nr-sd-face-btn, [data-icon-id]')) {
            markDirty();
        }
    });

    // No user-defined shape selected — hide inspector, show empty state on canvas.
    if (!currentShapeId) {
        inspectorEl.style.display = 'none';
        return;
    }
    inspectorEl.style.display = '';

    // Name field
    const nameSection = document.createElement('div');
    nameSection.className = 'nr-sd-name-section';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'cds--label';
    nameLabel.setAttribute('for', 'sd-shape-name');
    nameLabel.textContent = 'Name';

    shapeNameInput = document.createElement('input');
    shapeNameInput.id = 'sd-shape-name';
    shapeNameInput.type = 'text';
    shapeNameInput.className = 'cds--text-input cds--text-input--sm';
    shapeNameInput.value = ShapeRegistry[currentShapeId]?.displayName ?? formatLabel(currentShapeId);
    shapeNameInput.addEventListener('input', () => {
        const name = shapeNameInput.value;
        if (isComplexShape) {
            // In complex shapes, only the first layer carries the label.
            layerShapes[0]?.attr('label/text', name);
            layerShapes2D[0]?.attr('label/text', name);
        } else if (currentShape) {
            currentShape.attr('label/text', name);
            currentShape2D?.attr('label/text', name);
        }
    });

    // Component Type dropdown
    const ctLabel = document.createElement('label');
    ctLabel.className = 'nr-sd-row-label';
    ctLabel.setAttribute('for', 'sd-component-type');
    ctLabel.textContent = 'Component Type';

    componentTypeSelect = document.createElement('select');
    const ctSelect = componentTypeSelect;
    ctSelect.id = 'sd-component-type';
    ctSelect.className = 'nr-sd-select';
    const ctOptions = ['', 'Server', 'Firewall', 'Switch', 'Storage', 'NIC', 'HSM', 'Custom'];
    for (const opt of ctOptions) {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt || '— none —';
        if ((ShapeRegistry[currentShapeId]?.componentType ?? '') === opt) el.selected = true;
        ctSelect.appendChild(el);
    }
    ctSelect.addEventListener('change', () => {
        if (ShapeRegistry[currentShapeId]) {
            ShapeRegistry[currentShapeId].componentType = ctSelect.value || undefined;
        }
    });

    // Hide label toggle — shown directly below the name input
    const labelHidden = currentShape?.attr('label/display') === 'none'
        || (isComplexShape && layerShapes[0]?.attr('label/display') === 'none');
    const hideLabelWrapper = document.createElement('div');
    hideLabelWrapper.className = 'nr-toggle' + (labelHidden ? ' nr-toggle--checked' : '');

    const hideLabelText = document.createElement('span');
    hideLabelText.className = 'nr-toggle__label-text';
    hideLabelText.textContent = 'Hide label on canvas';

    const hideLabelTrack = document.createElement('button');
    hideLabelTrack.type = 'button';
    hideLabelTrack.className = 'nr-toggle__track';
    hideLabelTrack.setAttribute('role', 'switch');
    hideLabelTrack.setAttribute('aria-checked', labelHidden ? 'true' : 'false');
    hideLabelTrack.setAttribute('aria-label', 'Hide label');
    hideLabelTrack.addEventListener('click', () => {
        const next = !hideLabelWrapper.classList.contains('nr-toggle--checked');
        hideLabelWrapper.classList.toggle('nr-toggle--checked', next);
        hideLabelTrack.setAttribute('aria-checked', next ? 'true' : 'false');
        const display = next ? 'none' : null;
        if (isComplexShape) {
            layerShapes[0]?.attr('label/display', display);
            layerShapes2D[0]?.attr('label/display', display);
        } else if (currentShape) {
            currentShape.attr('label/display', display);
            currentShape2D?.attr('label/display', display);
        }
    });

    hideLabelWrapper.appendChild(hideLabelText);
    hideLabelWrapper.appendChild(hideLabelTrack);

    // Complex Shape toggle — shown directly below the name input
    // Uses nr-toggle: button-based, ::before thumb, no cds-- conflict.
    const complexToggleWrapper = document.createElement('div');
    complexToggleWrapper.className = 'nr-toggle' + (isComplexShape ? ' nr-toggle--checked' : '');

    const toggleText = document.createElement('span');
    toggleText.className = 'nr-toggle__label-text';
    toggleText.textContent = 'Multi-Layer Shape';

    const toggleTrack = document.createElement('button');
    toggleTrack.type = 'button';
    toggleTrack.id = 'sd-complex-toggle';
    toggleTrack.className = 'nr-toggle__track';
    toggleTrack.setAttribute('role', 'switch');
    toggleTrack.setAttribute('aria-checked', isComplexShape ? 'true' : 'false');
    toggleTrack.setAttribute('aria-label', 'Complex Shape');
    toggleTrack.addEventListener('click', () => {
        const next = !complexToggleWrapper.classList.contains('nr-toggle--checked');
        complexToggleWrapper.classList.toggle('nr-toggle--checked', next);
        toggleTrack.setAttribute('aria-checked', next ? 'true' : 'false');
        onComplexShapeToggle(next);
    });

    complexToggleWrapper.appendChild(toggleText);
    complexToggleWrapper.appendChild(toggleTrack);

    // Variations toggle
    const variationsWrapper = document.createElement('div');
    variationsWrapper.className = 'nr-toggle' + (hasVariations ? ' nr-toggle--checked' : '');

    const variationsText = document.createElement('span');
    variationsText.className = 'nr-toggle__label-text';
    variationsText.textContent = 'Enable 90° variant';

    const variationsTrack = document.createElement('button');
    variationsTrack.type = 'button';
    variationsTrack.className = 'nr-toggle__track';
    variationsTrack.setAttribute('role', 'switch');
    variationsTrack.setAttribute('aria-checked', hasVariations ? 'true' : 'false');
    variationsTrack.setAttribute('aria-label', 'Variations');

    const variationSwitcher = document.createElement('div');
    variationSwitcher.className = 'nr-sd-face-row';
    variationSwitcher.style.display = hasVariations ? '' : 'none';

    const varLbl = document.createElement('label');
    varLbl.className = 'nr-sd-row-label';
    varLbl.textContent = 'Editing';

    const varBtnGroup = document.createElement('div');
    varBtnGroup.className = 'nr-sd-face-switcher';

    rebuildVariationButtons = () => {
        varBtnGroup.innerHTML = '';
        for (const v of ['default', 'turned90'] as const) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-sd-face-btn' + (activeVariation === v ? ' nr-sd-face-btn--active' : '');
            btn.textContent = v === 'default' ? 'Default' : '90° Turned';
            btn.addEventListener('click', () => {
                if (activeVariation === v) return;
                switchVariation(v);
            });
            varBtnGroup.appendChild(btn);
        }
    };
    rebuildVariationButtons();

    variationSwitcher.appendChild(varLbl);
    variationSwitcher.appendChild(varBtnGroup);

    variationsTrack.addEventListener('click', () => {
        hasVariations = !variationsWrapper.classList.contains('nr-toggle--checked');
        variationsWrapper.classList.toggle('nr-toggle--checked', hasVariations);
        variationsTrack.setAttribute('aria-checked', hasVariations ? 'true' : 'false');
        variationSwitcher.style.display = hasVariations ? '' : 'none';
        if (hasVariations && isComplexShape && !ShapeRegistry[currentShapeId]?.turned90) {
            saveIconEntriesToLayer();
            const currentDef = collectCurrentDef();
            updateShapeDefinition(currentShapeId, {
                ...currentDef,
                displayName: shapeNameInput?.value.trim() || formatLabel(currentShapeId),
                componentType: componentTypeSelect?.value || undefined,
                hasVariations: true,
                turned90: {
                    ...currentDef,
                    layers: layers.map(l => ({ ...l, style: { ...l.style }, icons: l.icons?.map(e => ({ ...e })) })),
                } as ShapeDefinition,
            });
            saveRegistryToStorage();
        }
        if (!hasVariations) {
            activeVariation = 'default';
            rebuildVariationButtons();
        }
        rebuildVariationButtons();
        markDirty();
    });

    variationsWrapper.appendChild(variationsText);
    variationsWrapper.appendChild(variationsTrack);

    // Name field above tabs — single row: label left, input right
    const nameWrap = document.createElement('div');
    nameWrap.className = 'nr-cd-name-wrap';
    nameLabel.className = 'nr-sd-row-label';
    shapeNameInput.className = 'nr-sd-number-display';
    shapeNameInput.style.cursor = 'text';
    shapeNameInput.style.fontFamily = 'var(--cds-body-compact-01-font-family, \'IBM Plex Sans\', sans-serif)';
    shapeNameInput.style.fontSize = '0.8125rem';
    nameWrap.appendChild(nameLabel);
    nameWrap.appendChild(shapeNameInput);
    inspectorEl.appendChild(nameWrap);

    // Tab navigation: Design | Settings
    const tabBar = document.createElement('div');
    tabBar.className = 'nr-cd-tabs';

    const designTabBtn = document.createElement('button');
    designTabBtn.type = 'button';
    designTabBtn.className = 'nr-cd-tabs__btn nr-cd-tabs__btn--active';
    designTabBtn.textContent = 'Design';

    const settingsTabBtn = document.createElement('button');
    settingsTabBtn.type = 'button';
    settingsTabBtn.className = 'nr-cd-tabs__btn';
    settingsTabBtn.textContent = 'Settings';

    tabBar.appendChild(designTabBtn);
    tabBar.appendChild(settingsTabBtn);
    inspectorEl.appendChild(tabBar);

    const designPanel = document.createElement('div');
    designPanel.className = 'nr-cd-tab-panel';

    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'nr-cd-tab-panel';
    settingsPanel.style.display = 'none';

    // Component Type — inline row (label left, dropdown right)
    const ctRow = document.createElement('div');
    ctRow.className = 'nr-sd-face-row';
    ctRow.style.padding = '12px 16px 12px 10px';
    ctRow.style.gap = '4px';
    addTooltip(ctRow, 'Determines which data properties can be configured for this component in the System Designer.', 'prepend');
    ctRow.appendChild(ctLabel);
    ctSelect.style.flex = '0 0 160px';
    ctSelect.style.width = '160px';
    ctRow.appendChild(ctSelect);
    settingsPanel.appendChild(ctRow);

    // Multi-layer toggle — flat row below component type
    addTooltip(complexToggleWrapper, 'Multi-layer mode. Build components with stacked layers, each with independent shapes and colors.', 'prepend');
    complexToggleWrapper.style.padding = '4px 16px 4px 10px';
    complexToggleWrapper.style.gap = '4px';
    settingsPanel.appendChild(complexToggleWrapper);

    variationsWrapper.style.padding = '4px 16px 4px 10px';
    variationsWrapper.style.gap = '4px';
    settingsPanel.appendChild(variationsWrapper);
    variationSwitcher.style.padding = '4px 16px';
    settingsPanel.appendChild(variationSwitcher);

    designTabBtn.addEventListener('click', () => {
        designTabBtn.classList.add('nr-cd-tabs__btn--active');
        settingsTabBtn.classList.remove('nr-cd-tabs__btn--active');
        designPanel.style.display = '';
        settingsPanel.style.display = 'none';
    });
    settingsTabBtn.addEventListener('click', () => {
        settingsTabBtn.classList.add('nr-cd-tabs__btn--active');
        designTabBtn.classList.remove('nr-cd-tabs__btn--active');
        settingsPanel.style.display = '';
        designPanel.style.display = 'none';
    });

    const accordion = document.createElement('ul');
    accordion.className = 'cds--accordion';

    const formFactorLi = buildAccordionItem('Form Factor', false, buildFormFactorContent);
    formFactorLi.setAttribute('data-design-only', 'true');
    accordion.appendChild(formFactorLi);

    const dimensionsLi = buildAccordionItem('Dimensions', false, buildDimensionsContent);
    dimensionsLi.setAttribute('data-design-only', 'true');
    accordion.appendChild(dimensionsLi);

    modifiersAccordionLi = buildAccordionItem('Modifiers', false, buildModifiersContent);
    modifiersAccordionLi.setAttribute('data-design-only', 'true');
    accordion.appendChild(modifiersAccordionLi);

    rotationAccordionLi = null;

    positionAccordionLi = buildAccordionItem('Position', isComplexShape, buildPositionContent);
    positionAccordionLi.style.display = isComplexShape ? '' : 'none';
    positionAccordionLi.setAttribute('data-design-only', 'true');
    accordion.appendChild(positionAccordionLi);

    // ── Icons section (plus/minus pattern) ────────────────────────────
    {
        const iconsLi = document.createElement('li');
        iconsLi.className = 'cds--accordion__item nr-float-section nr-float-section--active';

        const iconsHeader = document.createElement('div');
        iconsHeader.className = 'nr-float-section__header';
        const iconsTitle = document.createElement('span');
        iconsTitle.className = 'nr-float-section__title';
        iconsTitle.textContent = 'Icons';
        iconsHeader.appendChild(iconsTitle);

        const iconsAddIcon = carbonIconToString(AddLarge16 as CarbonIcon);

        const iconsAddBtn = document.createElement('button');
        iconsAddBtn.type = 'button';
        iconsAddBtn.className = 'nr-float-section__btn';
        iconsAddBtn.innerHTML = iconsAddIcon;
        iconsAddBtn.title = 'Add icon';
        // Event listener attached after openIconEditor is defined (see below)
        iconsHeader.appendChild(iconsAddBtn);
        iconsLi.appendChild(iconsHeader);

        const iconsBody = document.createElement('div');
        iconsBody.className = 'nr-float-section__body';
        iconsBody.style.display = '';
        iconsSectionBodyEl = iconsBody;

        // Icon list container (entries) and popup container (editor)
        const listEl = document.createElement('div');
        let popupEl = document.getElementById('nr-icon-editor-popup') as HTMLDivElement | null;
        if (!popupEl) {
            popupEl = document.createElement('div');
            popupEl.id = 'nr-icon-editor-popup';
            popupEl.className = 'nr-icon-editor-popup';
            popupEl.style.display = 'none';
            document.body.appendChild(popupEl);
        }
        popupEl.style.display = 'none';

        // Auto-reposition popup when content changes (fields show/hide)
        let popupDesiredTop = 0;
        let repositioning = false;
        const repositionPopup = () => {
            if (repositioning || popupEl!.style.display === 'none') return;
            repositioning = true;
            const popupH = popupEl!.offsetHeight;
            const maxTop = window.innerHeight - popupH - 8;
            popupEl!.style.top = Math.max(0, Math.min(popupDesiredTop, maxTop)) + 'px';
            repositioning = false;
        };
        new MutationObserver(repositionPopup).observe(popupEl, { childList: true, subtree: true });

        const openIconEditor = (idx: number) => {
            editingIconIndex = idx;
            const entry = iconEntries[idx];
            if (!entry) return;
            popupEl!.innerHTML = '';
            popupEl!.style.display = '';
            // Position popup aligned with the Icons section header
            const headerRect = iconsHeader.getBoundingClientRect();
            popupDesiredTop = headerRect.top - 1;
            popupEl!.style.top = popupDesiredTop + 'px';
            requestAnimationFrame(repositionPopup);

            // Header — Carbon Modal pattern: title left, X flush top-right
            const closeRow = document.createElement('div');
            closeRow.className = 'nr-icon-editor-header';
            const closeTitle = document.createElement('span');
            closeTitle.style.fontWeight = '600';
            closeTitle.style.fontSize = '0.8125rem';
            closeTitle.style.cursor = 'text';
            closeTitle.textContent = (entry as any).name || `Icon ${idx + 1}`;
            closeTitle.addEventListener('click', () => {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'nr-icon-entry-name-input';
                inp.style.fontWeight = '600';
                inp.style.fontSize = '0.8125rem';
                inp.value = (entry as any).name || `Icon ${idx + 1}`;
                closeTitle.replaceWith(inp);
                inp.focus();
                inp.select();
                const commit = () => {
                    (entry as any).name = inp.value || `Icon ${idx + 1}`;
                    inp.replaceWith(closeTitle);
                    closeTitle.textContent = (entry as any).name;
                    renderIconsList();
                };
                inp.addEventListener('blur', commit);
                inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
            });
            closeRow.appendChild(closeTitle);
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'nr-icon-editor-close';
            closeBtn.title = 'Close';
            closeBtn.innerHTML = carbonIconToString(CloseLarge16 as CarbonIcon);
            closeBtn.addEventListener('click', () => {
                syncLegacyStateToIconEntry();
                popupEl.style.display = 'none';
                editingIconIndex = -1;
                renderIconsList();
            });
            closeRow.appendChild(closeBtn);
            popupEl.appendChild(closeRow);

            // Icon selector (reuse existing buildIconContent into the popup)
            const iconContentWrap = document.createElement('div');
            buildIconContent(iconContentWrap);
            popupEl.appendChild(iconContentWrap);

            // Sync the legacy icon state from this entry so the existing controls work
            selectedIcon = entry.id || null;
            selectedIconFace = entry.face;
            selectedIconSize = entry.size;
            selectedIconOffsetX = entry.offsetX;
            selectedIconOffsetY = entry.offsetY;
            selectedIconSkewX = entry.skewX;
            selectedIconSkewY = entry.skewY;
            selectedIconBgEnabled = entry.bgEnabled;
            selectedIconBgColor = entry.bgColor;
            selectedIconBgShape = entry.bgShape;
            selectedIconBgSize = entry.bgSize;
            selectedIconBgRadius = entry.bgRadius;
            selectedIconBgChamfer = entry.bgChamfer;
            selectedIconMonochrome = entry.monochrome;

            // Background controls
            const bgContentWrap = document.createElement('div');
            buildIconBackgroundContent(bgContentWrap);
            popupEl.appendChild(bgContentWrap);
        };

        const renderIconsList = renderIconsListFn = () => {
            listEl.innerHTML = '';
            iconsBody.style.padding = iconEntries.length > 0 ? '' : '0';
            iconsBody.style.display = '';

            let dragSrcIdx = -1;
            let dropTargetIdx = -1;

            // Drag-over on the list container: compute target index from mouse position
            listEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer!.dropEffect = 'move';
                const rows = listEl.querySelectorAll('.nr-icon-entry-row');
                let targetIdx = iconEntries.length; // default: drop at end
                rows.forEach((r, i) => {
                    const rect = r.getBoundingClientRect();
                    if (e.clientY < rect.top + rect.height / 2) {
                        if (targetIdx === iconEntries.length) targetIdx = i;
                    }
                });
                if (targetIdx !== dropTargetIdx) {
                    rows.forEach(r => r.classList.remove('nr-icon-entry-row--drop'));
                    dropTargetIdx = targetIdx;
                    if (targetIdx < rows.length) {
                        rows[targetIdx].classList.add('nr-icon-entry-row--drop');
                    } else if (rows.length > 0) {
                        // Dropping at end: highlight last row's bottom (handled by CSS border-bottom)
                        rows[rows.length - 1].classList.add('nr-icon-entry-row--drop-after');
                    }
                }
            });
            listEl.addEventListener('dragleave', (e) => {
                if (!listEl.contains(e.relatedTarget as Node)) {
                    listEl.querySelectorAll('.nr-icon-entry-row--drop, .nr-icon-entry-row--drop-after').forEach(r => r.classList.remove('nr-icon-entry-row--drop', 'nr-icon-entry-row--drop-after'));
                    dropTargetIdx = -1;
                }
            });
            listEl.addEventListener('drop', (e) => {
                e.preventDefault();
                listEl.querySelectorAll('.nr-icon-entry-row--drop, .nr-icon-entry-row--drop-after').forEach(r => r.classList.remove('nr-icon-entry-row--drop', 'nr-icon-entry-row--drop-after'));
                if (dragSrcIdx < 0 || dropTargetIdx < 0 || dragSrcIdx === dropTargetIdx) { dragSrcIdx = -1; dropTargetIdx = -1; return; }
                const [moved] = iconEntries.splice(dragSrcIdx, 1);
                const insertAt = dropTargetIdx > dragSrcIdx ? dropTargetIdx - 1 : dropTargetIdx;
                iconEntries.splice(insertAt, 0, moved);
                if (editingIconIndex === dragSrcIdx) editingIconIndex = insertAt;
                else if (editingIconIndex >= Math.min(dragSrcIdx, insertAt) && editingIconIndex <= Math.max(dragSrcIdx, insertAt)) {
                    editingIconIndex += dragSrcIdx < insertAt ? -1 : 1;
                }
                dragSrcIdx = -1;
                dropTargetIdx = -1;
                renderIconsList();
                applyIconToCurrentShape();
                markDirty();
            });

            for (let idx = 0; idx < iconEntries.length; idx++) {
                const entry = iconEntries[idx];
                const isEditing = idx === editingIconIndex;
                const row = document.createElement('div');
                row.className = 'nr-icon-entry-row' + (isEditing ? ' nr-icon-entry-row--active' : '');

                // Drag-and-drop
                row.draggable = true;
                row.addEventListener('dragstart', (e) => {
                    dragSrcIdx = idx;
                    row.style.opacity = '0.4';
                    e.dataTransfer!.effectAllowed = 'move';
                });
                row.addEventListener('dragend', () => {
                    row.style.opacity = '';
                    listEl.querySelectorAll('.nr-icon-entry-row--drop, .nr-icon-entry-row--drop-after').forEach(r => r.classList.remove('nr-icon-entry-row--drop', 'nr-icon-entry-row--drop-after'));
                    dragSrcIdx = -1;
                    dropTargetIdx = -1;
                });

                // Drag handle (hidden when only 1 icon)
                const dragHandle = document.createElement('span');
                dragHandle.className = 'nr-icon-entry-drag' + (iconEntries.length < 2 ? ' nr-icon-entry-drag--hidden' : '');
                dragHandle.innerHTML = carbonIconToString(Draggable16 as CarbonIcon).replace('width="16"', 'width="12"').replace('height="16"', 'height="12"');
                row.appendChild(dragHandle);

                // Preview thumbnail
                const preview = document.createElement('div');
                preview.className = 'nr-icon-entry-preview';
                if (entry.id) {
                    const iconData = getIconById(entry.id);
                    if (iconData) {
                        preview.innerHTML = iconData.svg;
                        const isColor = iconData.source === 'aws' && !entry.monochrome
                            || iconData.source === 'azure' || iconData.source === 'gcp';
                        if (isColor) preview.classList.add('nr-icon-entry-preview--color');
                    }
                }
                row.appendChild(preview);

                // Name + Main tag
                const nameWrap = document.createElement('div');
                nameWrap.className = 'nr-icon-entry-name-wrap';
                const nameEl = document.createElement('span');
                nameEl.className = 'nr-icon-entry-name';
                const catalogLabel = entry.id ? (getIconById(entry.id)?.label || '') : '';
                nameEl.textContent = (entry as any).name || catalogLabel || `Icon ${idx + 1}`;
                nameWrap.appendChild(nameEl);
                if (entry.isMain) {
                    const mainTag = document.createElement('span');
                    mainTag.className = 'nr-icon-entry-main-tag';
                    mainTag.textContent = 'Main';
                    nameWrap.appendChild(mainTag);
                }
                row.appendChild(nameWrap);

                // Right-click: popup with "Make Main"
                row.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const existing = document.querySelector('.nr-icon-ctx-menu');
                    if (existing) existing.remove();
                    const menu = document.createElement('div');
                    menu.className = 'nr-icon-ctx-menu';
                    menu.style.position = 'fixed';
                    menu.style.left = e.clientX + 'px';
                    menu.style.top = e.clientY + 'px';
                    menu.style.zIndex = '200';
                    const item = document.createElement('button');
                    item.type = 'button';
                    item.className = 'nr-icon-ctx-menu__item';
                    item.textContent = 'Make Main';
                    item.addEventListener('click', () => {
                        iconEntries.forEach(ie => ie.isMain = false);
                        entry.isMain = true;
                        menu.remove();
                        renderIconsList();
                        applyIconToCurrentShape();
                        markDirty();
                    });
                    menu.appendChild(item);
                    document.body.appendChild(menu);
                    const dismiss = (ev: MouseEvent) => {
                        if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('mousedown', dismiss); }
                    };
                    setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
                });

                // Clicking the row opens the icon editor for this entry
                row.style.cursor = 'pointer';
                row.addEventListener('click', (e) => {
                    if ((e.target as HTMLElement).closest('.nr-icon-entry-btn')) return;
                    openIconEditor(idx);
                    renderIconsList();
                });

                // Settings button (Tuning icon)
                const settingsBtn = document.createElement('button');
                settingsBtn.type = 'button';
                settingsBtn.className = 'nr-icon-entry-btn';
                settingsBtn.title = 'Edit icon settings';
                settingsBtn.innerHTML = carbonIconToString(Tuning16 as CarbonIcon);
                settingsBtn.addEventListener('click', () => { openIconEditor(idx); renderIconsList(); });
                row.appendChild(settingsBtn);

                // Remove button
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'nr-icon-entry-btn nr-icon-entry-btn--danger';
                removeBtn.title = 'Remove icon';
                removeBtn.innerHTML = carbonIconToString(Subtract16 as CarbonIcon);
                removeBtn.addEventListener('click', () => {
                    iconEntries.splice(idx, 1);
                    if (editingIconIndex === idx) { popupEl.style.display = 'none'; editingIconIndex = -1; }
                    else if (editingIconIndex > idx) editingIconIndex--;
                    if (iconEntries.length === 0) { selectedIcon = null; selectedIconBgEnabled = false; }
                    renderIconsList();
                    applyIconToCurrentShape();
                    markDirty();
                });
                row.appendChild(removeBtn);

                listEl.appendChild(row);
            }
        };

        // Wire + button now that openIconEditor exists
        iconsAddBtn.addEventListener('click', () => {
            const entry = defaultIconEntry(iconEntries.length === 0);
            iconEntries.push(entry);
            editingIconIndex = iconEntries.length - 1;
            renderIconsList();
            openIconEditor(editingIconIndex);
        });

        renderIconsList();

        iconsBody.appendChild(listEl);
        iconsLi.appendChild(iconsBody);
        accordion.appendChild(iconsLi);
    }

    const colorLi = buildAccordionItem('Shape Color', false, buildColorContent);
    colorLi.setAttribute('data-design-only', 'true');
    accordion.appendChild(colorLi);

    svgFootprintAccordionLi = buildAccordionItem('SVG Footprint', false, (contentEl) => {
        svgFootprintAccordionContent = contentEl;
        syncSvgFootprintSection();
    });
    svgFootprintAccordionLi.style.display = isComplexShape ? '' : 'none';
    svgFootprintAccordionLi.setAttribute('data-design-only', 'true');
    accordion.appendChild(svgFootprintAccordionLi);

    designPanel.appendChild(accordion);
    inspectorEl.appendChild(designPanel);

    inspectorEl.appendChild(settingsPanel);

    // ── Canvas HUD (left side panel) ────────────────────────────────────
    const hud = document.getElementById('cd2-view-toggle-container')!;
    hud.innerHTML = '';
    hud.style.display = currentShapeId ? '' : 'none';

    const hudHeader = document.createElement('div');
    hudHeader.className = 'nr-cd-hud-header';
    const hudTitle = document.createElement('div');
    hudTitle.className = 'nr-cd-hud-title';
    hudTitle.textContent = 'Display Preview';
    hudHeader.appendChild(hudTitle);

    const hudMinBtn = document.createElement('button');
    hudMinBtn.type = 'button';
    hudMinBtn.className = 'nr-cd-hud-minimize';
    hudMinBtn.title = 'Minimize';
    hudMinBtn.innerHTML = carbonIconToString(Minimize16CD as CarbonIcon);

    let hudRestoreBtn = document.getElementById('nr-cd-hud-restore') as HTMLButtonElement | null;
    if (!hudRestoreBtn) {
        hudRestoreBtn = document.createElement('button');
        hudRestoreBtn.type = 'button';
        hudRestoreBtn.id = 'nr-cd-hud-restore';
        hudRestoreBtn.className = 'nr-cd-hud-restore';
        hudRestoreBtn.title = 'Display Preview';
        hudRestoreBtn.innerHTML = carbonIconToString(SettingsView16 as CarbonIcon);
        hudRestoreBtn.style.display = 'none';
        hud.parentElement?.appendChild(hudRestoreBtn);
    }

    hudMinBtn.addEventListener('click', () => {
        hud.style.display = 'none';
        if (hudRestoreBtn) hudRestoreBtn.style.display = '';
    });
    hudRestoreBtn.addEventListener('click', () => {
        hud.style.display = '';
        if (hudRestoreBtn) hudRestoreBtn.style.display = 'none';
    });

    hudHeader.appendChild(hudMinBtn);
    hud.appendChild(hudHeader);

    // Controls flex to fill available width via CSS (no fixed width).
    const toIcon14 = (icon: CarbonIcon) => carbonIconToString(icon).replace('width="16"', 'width="14"').replace('height="16"', 'height="14"');
    const HIDE_ICON = '<svg viewBox="0 0 32 32" fill="currentColor" width="14" height="14"><path d="M2,16A14,14,0,1,0,16,2,14,14,0,0,0,2,16Zm23.15,7.75L8.25,6.85a12,12,0,0,1,16.9,16.9ZM8.24,25.16A12,12,0,0,1,6.84,8.27L23.73,25.16a12,12,0,0,1-15.49,0Z"/></svg>';

    // ── Label Position (icon tile popup) ──────────────────────────────────
    const hudLabelItem = document.createElement('div');
    hudLabelItem.className = 'nr-cd-hud-item';
    hudLabelItem.style.position = 'relative';
    const hudLabelText = document.createElement('span');
    hudLabelText.textContent = 'Label';

    const labelPositions: { value: string; label: string; icon: string; col: number; row: number }[] = [
        { value: 'top-left',      label: 'Top Left',      icon: toIcon14(AlignBoxTopLeft16 as CarbonIcon),      col: 0, row: 0 },
        { value: 'top-center',    label: 'Top Center',    icon: toIcon14(AlignBoxTopCenter16 as CarbonIcon),    col: 1, row: 0 },
        { value: 'top-right',     label: 'Top Right',     icon: toIcon14(AlignBoxTopRight16 as CarbonIcon),     col: 2, row: 0 },
        { value: 'middle-left',   label: 'Middle Left',   icon: toIcon14(AlignBoxMiddleLeft16 as CarbonIcon),   col: 0, row: 1 },
        { value: 'middle-right',  label: 'Middle Right',  icon: toIcon14(AlignBoxMiddleRight16 as CarbonIcon),  col: 2, row: 1 },
        { value: 'bottom-left',   label: 'Bottom Left',   icon: toIcon14(AlignBoxBottomLeft16 as CarbonIcon),   col: 0, row: 2 },
        { value: 'bottom-center', label: 'Bottom Center', icon: toIcon14(AlignBoxBottomCenter16 as CarbonIcon), col: 1, row: 2 },
        { value: 'bottom-right',  label: 'Bottom Right',  icon: toIcon14(AlignBoxBottomRight16 as CarbonIcon),  col: 2, row: 2 },
    ];
    let curLabelPos = labelHidden ? 'none' : 'bottom-right';
    const curLabelDef = labelPositions.find(p => p.value === curLabelPos);

    const hudLabelTrigger = document.createElement('button');
    hudLabelTrigger.type = 'button';
    hudLabelTrigger.className = 'nr-marker-picker-btn';
    hudLabelTrigger.style.justifyContent = 'flex-start';
    hudLabelTrigger.style.gap = '6px';
    hudLabelTrigger.style.padding = '0 8px';
    hudLabelTrigger.innerHTML = `${curLabelDef ? curLabelDef.icon : HIDE_ICON}<span style="font-size:0.75rem">${curLabelDef ? curLabelDef.label : 'Hidden'}</span>`;

    const hudLabelPopup = document.createElement('div');
    hudLabelPopup.className = 'nr-label-pos-popup';
    hudLabelPopup.style.display = 'none';
    const hudLabelGrid = document.createElement('div');
    hudLabelGrid.className = 'nr-label-pos-grid';

    const applyHudLabelPos = (val: string) => {
        curLabelPos = val;
        const pos = labelPositions.find(p => p.value === val);
        hudLabelTrigger.innerHTML = `${pos ? pos.icon : HIDE_ICON}<span style="font-size:0.75rem">${pos ? pos.label : 'Hidden'}</span>`;
        hudLabelPopup.style.display = 'none';
        const targets = isComplexShape ? [layerShapes[0], layerShapes2D[0]] : [currentShape, currentShape2D];
        for (const s of targets) {
            if (!s) continue;
            if (val === 'none') { s.attr('label/display', 'none'); continue; }
            s.attr('label/display', null);
            const iH = s.isometricHeight ?? 0;
            const topY = -iH - 4;
            switch (val) {
                case 'bottom-right':  s.attr({ label: { x: 'calc(w + 10)', y: 'calc(h + 12)', textAnchor: 'start' } }); break;
                case 'bottom-left':   s.attr({ label: { x: -10, y: 'calc(h + 12)', textAnchor: 'end' } }); break;
                case 'bottom-center': s.attr({ label: { x: 'calc(w / 2)', y: 'calc(h + 12)', textAnchor: 'middle' } }); break;
                case 'top-right':     s.attr({ label: { x: 'calc(w + 10)', y: topY, textAnchor: 'start' } }); break;
                case 'top-left':      s.attr({ label: { x: -10, y: topY, textAnchor: 'end' } }); break;
                case 'top-center':    s.attr({ label: { x: 'calc(w / 2)', y: topY, textAnchor: 'middle' } }); break;
                case 'middle-left':   s.attr({ label: { x: -10, y: `calc(h / 2 - ${iH / 2})`, textAnchor: 'end' } }); break;
                case 'middle-right':  s.attr({ label: { x: 'calc(w + 10)', y: `calc(h / 2 - ${iH / 2})`, textAnchor: 'start' } }); break;
            }
        }
    };

    for (const pos of labelPositions) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'nr-label-pos-tile' + (pos.value === curLabelPos ? ' nr-label-pos-tile--selected' : '');
        tile.title = pos.label;
        tile.innerHTML = pos.icon;
        tile.style.gridColumn = String(pos.col + 1);
        tile.style.gridRow = String(pos.row + 1);
        tile.addEventListener('click', () => {
            hudLabelGrid.querySelectorAll('.nr-label-pos-tile--selected').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
            tile.classList.add('nr-label-pos-tile--selected');
            applyHudLabelPos(pos.value);
        });
        hudLabelGrid.appendChild(tile);
    }
    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'nr-label-pos-tile' + (curLabelPos === 'none' ? ' nr-label-pos-tile--selected' : '');
    hideBtn.title = 'Hide Label';
    hideBtn.innerHTML = HIDE_ICON;
    hideBtn.style.gridColumn = '2';
    hideBtn.style.gridRow = '2';
    hideBtn.addEventListener('click', () => {
        hudLabelGrid.querySelectorAll('.nr-label-pos-tile--selected').forEach(t => t.classList.remove('nr-label-pos-tile--selected'));
        hideBtn.classList.add('nr-label-pos-tile--selected');
        applyHudLabelPos('none');
    });
    hudLabelGrid.appendChild(hideBtn);
    hudLabelPopup.appendChild(hudLabelGrid);
    hudLabelTrigger.addEventListener('click', () => { hudLabelPopup.style.display = hudLabelPopup.style.display === 'none' ? '' : 'none'; });
    document.addEventListener('mousedown', (e) => { if (!hudLabelItem.contains(e.target as Node)) hudLabelPopup.style.display = 'none'; });
    hudLabelItem.appendChild(hudLabelText);
    hudLabelItem.appendChild(hudLabelTrigger);
    hudLabelItem.appendChild(hudLabelPopup);
    hud.appendChild(hudLabelItem);

    // ── Orientation switcher ──────────────────────────────────────────────
    const hudVariationItem = document.createElement('div');
    hudVariationItem.className = 'nr-cd-hud-item';
    const hudVariationText = document.createElement('span');
    hudVariationText.textContent = 'Orientation';
    const hudVarGroup = document.createElement('div');
    hudVarGroup.className = 'nr-seg-control';
    for (const v of ['default', 'turned90'] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn' + (activeVariation === v ? ' nr-seg-btn--selected' : '');
        btn.textContent = v === 'default' ? 'Default' : 'Rotated';
        btn.addEventListener('click', () => {
            if (activeVariation === v) return;
            switchVariation(v);
        });
        hudVarGroup.appendChild(btn);
    }
    hudVariationItem.appendChild(hudVariationText);
    hudVariationItem.appendChild(hudVarGroup);
    hudVariationItem.style.display = hasVariations ? '' : 'none';
    hud.appendChild(hudVariationItem);

    // Rotate 90° toggle (simple shapes with rotate pair)
    const hudRotateItem = document.createElement('div');
    hudRotateItem.className = 'nr-cd-hud-item';
    const hudRotateText = document.createElement('span');
    hudRotateText.textContent = 'Rotate 90\u00B0';
    const hudRotateTrack = document.createElement('button');
    hudRotateTrack.type = 'button';
    hudRotateTrack.className = 'nr-toggle__track';
    hudRotateTrack.setAttribute('role', 'switch');
    hudRotateTrack.setAttribute('aria-checked', activeVariation === 'turned90' ? 'true' : 'false');
    hudRotateTrack.setAttribute('aria-label', 'Rotate 90 degrees');
    if (activeVariation === 'turned90') hudRotateTrack.classList.add('nr-toggle__track--on');
    hudRotateTrack.addEventListener('click', () => {
        const isOn = hudRotateTrack.classList.toggle('nr-toggle__track--on');
        hudRotateTrack.setAttribute('aria-checked', isOn ? 'true' : 'false');
        rotateShape90();
    });
    hudRotateItem.appendChild(hudRotateText);
    hudRotateItem.appendChild(hudRotateTrack);
    hudRotateItemEl = hudRotateItem;
    const hasRotatePair = !!ROTATE_PAIR[selectedBaseShape];
    hudRotateItem.style.display = (hasRotatePair && !isComplexShape) ? '' : 'none';
    hud.appendChild(hudRotateItem);

    // ── Opacity (reuses buildSliderField for drag-to-scrub + ±) ─────────
    buildSliderField('Opacity', 'sd-hud-opacity', 0, 100, 5,
        (el) => { el.value = '100'; },
        () => {},
        () => {
            const el = hud.querySelector<HTMLInputElement>('#sd-hud-opacity');
            if (!el) return;
            const op = parseFloat(el.value) / 100;
            if (isComplexShape) {
                for (const s of layerShapes) { const v = paper.findViewByModel(s); if (v) v.el.style.opacity = String(op); }
                for (const s of layerShapes2D) { const v = paper2D.findViewByModel(s); if (v) v.el.style.opacity = String(op); }
            } else {
                if (currentShape) { const v = paper.findViewByModel(currentShape); if (v) v.el.style.opacity = String(op); }
                if (currentShape2D) { const v = paper2D.findViewByModel(currentShape2D); if (v) v.el.style.opacity = String(op); }
            }
        },
        hud, '%');

    // ── Mode (Light / Dark) switcher ──────────────────────────────────────
    const hudThemeItem = document.createElement('div');
    hudThemeItem.className = 'nr-cd-hud-item';
    const hudThemeText = document.createElement('span');
    hudThemeText.textContent = 'Mode';
    hudThemeItem.appendChild(hudThemeText);

    const lightIcon = carbonIconToString(Light16 as CarbonIcon).replace('width="16"', 'width="14"').replace('height="16"', 'height="14"');
    const darkIcon = carbonIconToString(Asleep16 as CarbonIcon).replace('width="16"', 'width="14"').replace('height="16"', 'height="14"');

    const themeSwitcher = document.createElement('div');
    themeSwitcher.className = 'nr-seg-control';
    const isDark = document.documentElement.classList.contains('cds--g100');

    const lightBtn = document.createElement('button');
    lightBtn.type = 'button';
    lightBtn.className = 'nr-seg-btn' + (!isDark ? ' nr-seg-btn--selected' : '');
    lightBtn.style.display = 'inline-flex';
    lightBtn.style.alignItems = 'center';
    lightBtn.style.justifyContent = 'center';
    lightBtn.style.gap = '4px';
    lightBtn.innerHTML = `${lightIcon}<span style="font-size:0.75rem">Light</span>`;
    lightBtn.title = 'Light mode';

    const darkBtn = document.createElement('button');
    darkBtn.type = 'button';
    darkBtn.className = 'nr-seg-btn' + (isDark ? ' nr-seg-btn--selected' : '');
    darkBtn.style.display = 'inline-flex';
    darkBtn.style.alignItems = 'center';
    darkBtn.style.justifyContent = 'center';
    darkBtn.style.gap = '4px';
    darkBtn.innerHTML = `${darkIcon}<span style="font-size:0.75rem">Dark</span>`;
    darkBtn.title = 'Dark mode';

    const applyThemeFromHud = (dark: boolean) => {
        localStorage.setItem('nr-theme', dark ? 'dark' : 'light');
        document.documentElement.classList.toggle('cds--g100', dark);
        document.documentElement.classList.toggle('cds--white', !dark);
        lightBtn.classList.toggle('nr-seg-btn--selected', !dark);
        darkBtn.classList.toggle('nr-seg-btn--selected', dark);
        const navBtn = document.getElementById('nav-theme');
        if (navBtn) navBtn.click();
    };

    lightBtn.addEventListener('click', () => applyThemeFromHud(false));
    darkBtn.addEventListener('click', () => applyThemeFromHud(true));

    themeSwitcher.appendChild(lightBtn);
    themeSwitcher.appendChild(darkBtn);
    hudThemeItem.appendChild(themeSwitcher);
    hud.appendChild(hudThemeItem);

    // ── Hit Area controls (complex shapes only) ─────────────────────────
    const isOrWillBeComplex = isComplexShape || !!ShapeRegistry[currentShapeId]?.complexShape;
    if (isOrWillBeComplex) {
        const hudHitAreaItem = document.createElement('div');
        hudHitAreaItem.className = 'nr-cd-hud-item';
        const hudHitAreaText = document.createElement('span');
        hudHitAreaText.textContent = 'Hit Area';
        const hudHitAreaTrack = document.createElement('button');
        hudHitAreaTrack.type = 'button';
        hudHitAreaTrack.className = 'nr-toggle__track';
        hudHitAreaTrack.setAttribute('role', 'switch');
        hudHitAreaTrack.setAttribute('aria-checked', 'false');
        hudHitAreaTrack.setAttribute('aria-label', 'Show Hit Area');

        const hitSizeWrap = document.createElement('div');
        hitSizeWrap.style.display = 'none';

        hudHitAreaTrack.addEventListener('click', () => {
            const isOn = hudHitAreaTrack.classList.toggle('nr-toggle__track--on');
            hudHitAreaTrack.setAttribute('aria-checked', isOn ? 'true' : 'false');
            hitSizeWrap.style.display = isOn ? '' : 'none';
            if (isOn) showHitAreaOverlay();
            else hideHitAreaOverlay();
        });
        hudHitAreaItem.appendChild(hudHitAreaText);
        hudHitAreaItem.appendChild(hudHitAreaTrack);
        hud.appendChild(hudHitAreaItem);

        const haDefSize = getHitAreaSize();
        buildSliderField('Width', 'sd-hud-ha-w', 10, 400, 5,
            (el) => { el.value = String(haDefSize.width); },
            () => {},
            () => {
                const el = hud.querySelector<HTMLInputElement>('#sd-hud-ha-w');
                if (!el || !hitAreaShape) return;
                const w = parseFloat(el.value) || 40;
                hitAreaShape.resize(w, hitAreaShape.size().height);
            },
            hitSizeWrap, 'px');
        buildSliderField('Height', 'sd-hud-ha-h', 10, 400, 5,
            (el) => { el.value = String(haDefSize.height); },
            () => {},
            () => {
                const el = hud.querySelector<HTMLInputElement>('#sd-hud-ha-h');
                if (!el || !hitAreaShape) return;
                const h = parseFloat(el.value) || 40;
                hitAreaShape.resize(hitAreaShape.size().width, h);
            },
            hitSizeWrap, 'px');
        hud.appendChild(hitSizeWrap);
    }

    restoreAccordionState(prevAccordionState);
    syncAllInspectorFields();
}

// All form factors except 'cuboid' require width === height (square base).
function requiresSquareBase(baseShape: string): boolean {
    return baseShape !== 'cuboid' && baseShape !== 'custom' && baseShape !== 'tube' && baseShape !== 'pipe' && baseShape !== 'duct' && baseShape !== 'channel';
}

// Form factors that expose the corner radius slider.
function supportsCornerRadius(baseShape: string): boolean {
    return baseShape === 'cuboid';
}

// Returns true when a layer uses a custom SVG footprint for rendering.
function isLayerSvg(layer: ShapeLayer): boolean {
    return !!(layer.svgNormVerts && layer.svgNormVerts.length >= 3 && layer.baseShape !== 'custom');
}

function isLayerCustomVerts(layer: ShapeLayer): boolean {
    return !!(layer.svgNormVerts && layer.svgNormVerts.length >= 3);
}

function applyCornerRadiusToCurrentShape() {
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (layer) layer.cornerRadius = selectedCornerRadius;
        layerShapes[selectedLayerIndex]?.set('cornerRadius', selectedCornerRadius);
        layerShapes2D[selectedLayerIndex]?.set('cornerRadius', selectedCornerRadius);
        return;
    }
    if (!currentShape) return;
    currentShape.set('cornerRadius', selectedCornerRadius);
    currentShape2D?.set('cornerRadius', selectedCornerRadius);
}

function applyChamferSizeToCurrentShape() {
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (layer) layer.chamferSize = selectedChamferSize;
        layerShapes[selectedLayerIndex]?.set('chamferSize', selectedChamferSize);
        layerShapes2D[selectedLayerIndex]?.set('chamferSize', selectedChamferSize);
        return;
    }
    if (!currentShape) return;
    currentShape.set('chamferSize', selectedChamferSize);
    currentShape2D?.set('chamferSize', selectedChamferSize);
}

function applyChamferStartToCurrentShape() {
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (layer) layer.chamferStart = selectedChamferStart;
        layerShapes[selectedLayerIndex]?.set('chamferStart', selectedChamferStart);
        layerShapes2D[selectedLayerIndex]?.set('chamferStart', selectedChamferStart);
        return;
    }
    if (!currentShape) return;
    currentShape.set('chamferStart', selectedChamferStart);
    currentShape2D?.set('chamferStart', selectedChamferStart);
}

function applyChamferBottomSizeToCurrentShape() {
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (layer) layer.chamferBottomSize = selectedChamferBottomSize;
        layerShapes[selectedLayerIndex]?.set('chamferBottomSize', selectedChamferBottomSize);
        layerShapes2D[selectedLayerIndex]?.set('chamferBottomSize', selectedChamferBottomSize);
        return;
    }
    if (!currentShape) return;
    currentShape.set('chamferBottomSize', selectedChamferBottomSize);
    currentShape2D?.set('chamferBottomSize', selectedChamferBottomSize);
}

function applyChamferBottomStartToCurrentShape() {
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (layer) layer.chamferBottomStart = selectedChamferBottomStart;
        layerShapes[selectedLayerIndex]?.set('chamferBottomStart', selectedChamferBottomStart);
        layerShapes2D[selectedLayerIndex]?.set('chamferBottomStart', selectedChamferBottomStart);
        return;
    }
    if (!currentShape) return;
    currentShape.set('chamferBottomStart', selectedChamferBottomStart);
    currentShape2D?.set('chamferBottomStart', selectedChamferBottomStart);
}

function applyShedRoofToCurrentShape() {
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (layer) {
            layer.shedRoofDrop = selectedShedRoofDrop;
            layer.shedRoofDirection = selectedShedRoofDirection;
        }
        layerShapes[selectedLayerIndex]?.set('shedRoofDrop', selectedShedRoofDrop);
        layerShapes[selectedLayerIndex]?.set('shedRoofDirection', selectedShedRoofDirection);
        layerShapes2D[selectedLayerIndex]?.set('shedRoofDrop', selectedShedRoofDrop);
        layerShapes2D[selectedLayerIndex]?.set('shedRoofDirection', selectedShedRoofDirection);
        return;
    }
    if (!currentShape) return;
    currentShape.set('shedRoofDrop', selectedShedRoofDrop);
    currentShape.set('shedRoofDirection', selectedShedRoofDirection);
    currentShape2D?.set('shedRoofDrop', selectedShedRoofDrop);
    currentShape2D?.set('shedRoofDirection', selectedShedRoofDirection);
}

const ALL_MODIFIERS = new Set(['cornerRadius', 'chamfer', 'chamferHeight', 'chamferBottom', 'chamferBottomHeight', 'taper', 'twist', 'scaleTopX', 'scaleTopY', 'shedRoof', 'shedRoofDir']);
const HIDDEN_MODIFIERS: Record<string, Set<string>> = {
    cylinder: new Set(['cornerRadius', 'chamfer', 'chamferHeight', 'twist']),
    tube:     ALL_MODIFIERS,
    pipe:     ALL_MODIFIERS,
    duct:     ALL_MODIFIERS,
    channel:  ALL_MODIFIERS,
};

const BASE_SHAPE_LABELS: Record<string, string> = {
    cuboid: 'Square', cylinder: 'Circle', octagon: 'Octagon', pyramid: 'Pyramid',
    tube: 'Tube', pipe: 'Pipe (Tube rotated)', duct: 'Duct', channel: 'Channel (Duct rotated)', custom: 'Complex',
};

const ROTATE_PAIR: Record<string, string> = {
    tube: 'pipe', pipe: 'tube',
    duct: 'channel', channel: 'duct',
};

const ROTATED_FORMS = new Set(['pipe', 'channel']);
const TUBE_FAMILY = new Set(['tube', 'pipe', 'duct', 'channel']);

function updateResizeTools() {
    paper.removeTools();
    paper2D.removeTools();
    if (dimensionYAdjustable && currentShape) {
        currentShape.addTools(paper, View.Isometric, ['size']);
    }
    if (dimensionYAdjustable && currentShape2D) {
        currentShape2D.addTools(paper2D, View.TwoDimensional, ['size']);
    }
}

function rotateShape90() {
    if (!currentShape || isComplexShape) return;

    const pairedShape = ROTATE_PAIR[selectedBaseShape];
    if (!pairedShape) return;

    // Capture real canvas dimensions and swap for the new extrusion axis
    const { width: realW, height: realH } = currentShape.size();

    if (selectedIconFace === 'front') selectedIconFace = 'side';
    else if (selectedIconFace === 'side') selectedIconFace = 'front';

    selectedBaseShape = pairedShape as BaseShape;

    widthInput.value = String(realH);
    heightInput.value = String(realW);

    applyFormFactorToCanvas();
    if (currentShape) centerShapeOnCanvas(currentShape, currentShape2D ?? null);
    buildInspectorPanel();
    updateResizeTools();
}

function applyRotation() {
    if (isComplexShape) {
        for (const s of layerShapes) s?.set('shapeRotation', selectedRotation);
        for (const s of layerShapes2D) s?.set('shapeRotation', selectedRotation);
        return;
    }
    currentShape?.set('shapeRotation', selectedRotation);
    currentShape2D?.set('shapeRotation', selectedRotation);
}

function apply3DModifiers() {
    const attrs: Record<string, number> = {
        taper: selectedTaper, twist: selectedTwist,
        scaleTopX: selectedScaleTopX, scaleTopY: selectedScaleTopY,
    };
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (layer) {
            layer.taper = selectedTaper;
            layer.twist = selectedTwist;
            layer.scaleTopX = selectedScaleTopX;
            layer.scaleTopY = selectedScaleTopY;
        }
        const s = layerShapes[selectedLayerIndex];
        const s2 = layerShapes2D[selectedLayerIndex];
        if (s) for (const [k, v] of Object.entries(attrs)) s.set(k, v);
        if (s2) for (const [k, v] of Object.entries(attrs)) s2.set(k, v);
        return;
    }
    if (!currentShape) return;
    for (const [k, v] of Object.entries(attrs)) {
        currentShape.set(k, v);
        currentShape2D?.set(k, v);
    }
}

// Enforce square-base (height = width) and pyramid min-depth constraints.
function updateDimensionLock() {
    if (!heightInput) return;
    const locked = requiresSquareBase(selectedBaseShape);
    heightInput.disabled = locked;
    heightInput.style.opacity = locked ? '0.4' : '';
    if (locked) {
        heightInput.value = widthInput.value;
        if (heightValueEl) {
            heightValueEl.textContent = `${Math.round(parseFloat(widthInput.value))} px`;
        }
    }

    const minDepth = selectedBaseShape === 'pyramid' ? 60 : 0;
    depthInput.min = String(minDepth);
    if (parseFloat(depthInput.value) < minDepth) {
        depthInput.value = String(minDepth);
        if (depthValueEl) depthValueEl.textContent = `${minDepth} px`;
    }

    // Corner radius and chamfer are only available for built-in polygon shapes,
    // not for SVG-footprint layers (SVG vertices are always used without rounding).
    const currentSvgLayer = isComplexShape ? (layers[selectedLayerIndex] ?? null) : null;
    const hasSvgLayer     = currentSvgLayer !== null && isLayerSvg(currentSvgLayer);
    if (rotationAccordionLi) rotationAccordionLi.style.display = selectedBaseShape !== 'cuboid' ? '' : 'none';
    if (modifiersSvgInfoEl) modifiersSvgInfoEl.style.display = hasSvgLayer ? '' : 'none';
    const showBehaviour = selectedBaseShape === 'duct' || selectedBaseShape === 'pipe'
        || selectedBaseShape === 'tube' || selectedBaseShape === 'channel';
    if (dimBehaviourRowEl) dimBehaviourRowEl.style.display = showBehaviour ? '' : 'none';
    if (hudRotateItemEl) hudRotateItemEl.style.display = ROTATE_PAIR[selectedBaseShape] ? '' : 'none';

    syncModifierVisibility();
}

// Update dimension sliders and value displays from the shape's current state.
function syncModifierVisibility(): void {
    const hidden = HIDDEN_MODIFIERS[selectedBaseShape] ?? new Set<string>();
    if (modifiersAccordionLi) {
        let allHidden = true;
        ALL_MODIFIERS.forEach(m => { if (!hidden.has(m)) allHidden = false; });
        modifiersAccordionLi.style.display = allHidden ? 'none' : '';
        if (!allHidden) {
            modifiersAccordionLi.querySelectorAll<HTMLElement>('[data-modifier]').forEach(el => {
                const mod = el.dataset.modifier!;
                const isHidden = hidden.has(mod);
                const isAdminOnly = mod === 'cornerRadius';
                el.style.display = (isHidden || (isAdminOnly && !adminMode)) ? 'none' : '';
            });
        }
    }
}

function dimDisplayValue(px: number): string {
    return `${Math.round(px)}`;
}

function syncAllInspectorFields() {
    if (currentShape) syncFormFromShape(currentShape);
    syncModifierFields();
    syncIconBgColorDisplay();
    applyIconToCurrentShape();
    if (setDefaultBtn) {
        const shapeLabel = BASE_SHAPE_LABELS[selectedBaseShape] || selectedBaseShape;
        setDefaultBtn.textContent = `Set as default for ${shapeLabel}`;
    }
}

function syncModifierFields() {
    if (cornerRadiusInput) { cornerRadiusInput.value = String(selectedCornerRadius); setSliderFill(cornerRadiusInput); }
    if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = `${selectedCornerRadius} px`;
    if (chamferSizeInput) { chamferSizeInput.value = String(selectedChamferSize); setSliderFill(chamferSizeInput); }
    if (chamferSizeValueEl) chamferSizeValueEl.textContent = `${selectedChamferSize} px`;
    if (taperInput) { taperInput.value = String(selectedTaper); setSliderFill(taperInput); }
    if (taperValueEl) taperValueEl.textContent = selectedTaper.toFixed(2);
    if (twistInput) { twistInput.value = String(selectedTwist); setSliderFill(twistInput); }
    if (twistValueEl) twistValueEl.textContent = selectedTwist.toFixed(2);
    if (stxInput) { stxInput.value = String(selectedScaleTopX); setSliderFill(stxInput); }
    if (stxValueEl) stxValueEl.textContent = selectedScaleTopX.toFixed(2);
    if (styInput) { styInput.value = String(selectedScaleTopY); setSliderFill(styInput); }
    if (styValueEl) styValueEl.textContent = selectedScaleTopY.toFixed(2);
}

function syncFormFromShape(shape: IsometricShape) {
    const { width, height } = shape.size();
    const depth = shape.get('isometricHeight') ?? 0;
    const swapped = ROTATED_FORMS.has(selectedBaseShape);
    const wPx = swapped ? height : width;
    const isTube = TUBE_FAMILY.has(selectedBaseShape);

    if (isTube) {
        widthInput.value  = String(wPx);
        heightInput.value = String(depth);
        depthInput.value  = String(depth);
        if (widthDisplayEl)  widthDisplayEl.value  = String(Math.round(wPx));
        if (heightDisplayEl) heightDisplayEl.value = String(Math.round(depth));
        if (widthValueEl)  widthValueEl.textContent  = `${Math.round(wPx)} px`;
        if (heightValueEl) heightValueEl.textContent = `${Math.round(depth)} px`;
    } else {
        const hPx = swapped ? width : height;
        widthInput.value  = String(wPx);
        heightInput.value = String(hPx);
        depthInput.value  = String(depth);
        if (widthDisplayEl)  widthDisplayEl.value  = String(Math.round(wPx));
        if (heightDisplayEl) heightDisplayEl.value = String(Math.round(hPx));
        if (depthDisplayEl)  depthDisplayEl.value  = String(Math.round(depth));
        if (widthValueEl)  widthValueEl.textContent  = `${Math.round(wPx)} px`;
        if (heightValueEl) heightValueEl.textContent = `${Math.round(hPx)} px`;
        if (depthValueEl)  depthValueEl.textContent  = `${Math.round(depth)} px`;
    }
    updateDimensionLock();
    syncAllSliderFills();
}

// Update form factor, icon, and color controls from the registry for the given shape id.
function syncExtrasFromShape(id: string) {
    const defaults = ShapeRegistry[id];

    selectedBaseShape   = (defaults?.baseShape ?? BASE_SHAPE_BY_ID[id] ?? 'cuboid') as BaseShape;
    selectedIconFace    = defaults?.iconFace   ?? 'top';
    selectedIcon        = defaults?.icon       ?? null;
    selectedIconSize    = defaults?.iconSize   ?? 1.5;
    iconLayerIndex      = defaults?.iconLayerIndex ?? 0;
    selectedIconBgEnabled  = defaults?.iconBgEnabled
        ?? (!!defaults?.iconHref && !!defaults?.iconBgColor
            && decodeURIComponent(defaults.iconHref).includes(`fill="${defaults.iconBgColor}"`));
    selectedIconAdaptive   = false;
    selectedIconBgColor = defaults?.iconBgColor ?? PRIMARY_COLORS[0].base;
    selectedIconBgShape  = (defaults?.iconBgShape ?? 'circle') as 'circle' | 'square' | 'octagon';
    selectedIconBgRadius = defaults?.iconBgRadius ?? 6;
    selectedIconBgChamfer = defaults?.iconBgChamfer ?? 0.18;
    selectedIconBgSize = defaults?.iconBgSize ?? (defaults?.iconSize ?? 1.5);

    // For complex shapes, icons live per-layer — don't load from shape-level.
    // For simple shapes, migrate from old format.
    if (!defaults?.complexShape) {
        iconEntries = defaults ? migrateIconDef(defaults) : [];
    }
    editingIconIndex = -1;

    selectedStyle     = {
        topColor:    defaults?.style?.topColor    ?? '',
        sideColor:   defaults?.style?.sideColor   ?? '',
        frontColor:  defaults?.style?.frontColor  ?? '',
        strokeColor: defaults?.style?.strokeColor ?? '',
    };
    selectedRotation  = defaults?.rotation  ?? 0;
    dimensionYAdjustable = defaults?.dimYAdjustable ?? false;
    selectedTaper     = defaults?.taper     ?? 0;
    selectedTwist     = defaults?.twist     ?? 0;
    selectedScaleTopX = defaults?.scaleTopX ?? 1;
    selectedScaleTopY = defaults?.scaleTopY ?? 1;

    // Sync radio buttons
    inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-form-factor"]').forEach(r => {
        r.checked = r.value === selectedBaseShape;
    });
    syncFormFactorTiles();
    syncFormFactorDropdown();

    // Sync icon selection — no-icon button has data-icon-id="" which maps to selectedIcon===null
    inspectorEl.querySelectorAll<HTMLElement>('.nr-sd-icon-btn').forEach(btn => {
        const match = selectedIcon === null
            ? btn.dataset.iconId === ''
            : btn.dataset.iconId === selectedIcon;
        btn.classList.toggle('nr-sd-icon-btn--selected', match);
    });

    // Sync icon size slider
    const sizeSlider = inspectorEl.querySelector<HTMLInputElement>('#sd-icon-size');
    const sizeValueEl = inspectorEl.querySelector<HTMLElement>('#sd-icon-size-value');
    if (sizeSlider) { sizeSlider.value = String(selectedIconSize); setSliderFill(sizeSlider); }
    if (sizeValueEl) sizeValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
    // Sync icon background size slider (independent)
    const bgSizeSlider = inspectorEl.querySelector<HTMLInputElement>('#sd-icon-bg-size');
    const bgSizeValueEl = inspectorEl.querySelector<HTMLElement>('#sd-icon-bg-size-value');
    if (bgSizeSlider) { bgSizeSlider.value = String(selectedIconBgSize); setSliderFill(bgSizeSlider); }
    if (bgSizeValueEl) bgSizeValueEl.textContent = `${selectedIconBgSize.toFixed(1)} cells`;

    // Sync icon background: no-bg swatch + color swatches + custom color picker
    if (iconBgNoBackgroundBtnEl) {
        iconBgNoBackgroundBtnEl.classList.toggle('nr-sd-swatch-btn--selected', !selectedIconBgEnabled);
    }
    for (const { btn, colorBase } of iconBgSwatchRefs) {
        btn.classList.toggle('nr-sd-swatch-btn--selected', selectedIconBgEnabled && colorBase === selectedIconBgColor);
    }

    // Sync icon background shape radio
    inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-icon-bg-shape"]').forEach(r => {
        r.checked = r.value === selectedIconBgShape;
    });

    // Sync corner roundness slider visibility and value
    if (iconBgCornerRadiusRowEl) {
        iconBgCornerRadiusRowEl.style.display = selectedIconBgShape === 'square' ? '' : 'none';
    }
    if (iconBgCornerRadiusInputRef) {
        iconBgCornerRadiusInputRef.value = String(selectedIconBgRadius);
        setSliderFill(iconBgCornerRadiusInputRef);
    }

    // Sync octagon cut depth slider visibility and value
    if (iconBgChamferRowEl) {
        iconBgChamferRowEl.style.display = selectedIconBgShape === 'octagon' ? '' : 'none';
    }
    if (iconBgChamferInputRef) {
        iconBgChamferInputRef.value = String(selectedIconBgChamfer);
        setSliderFill(iconBgChamferInputRef);
        const ocValueEl = document.getElementById('sd-icon-bg-chamfer-value');
        if (ocValueEl) ocValueEl.textContent = `${Math.round(selectedIconBgChamfer * 100)}%`;
    }

    // Sync icon background color display
    syncIconBgColorDisplay();

    // Sync single color input
    const representativeColor = selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor || '#e0e0e0';
    if (colorPickerRef) colorPickerRef.value = representativeColor;

    // Apply dimension lock now that selectedBaseShape has been updated.
    updateDimensionLock();
    syncAllSliderFills();

}

// Swap the canvas shape to match the selected form factor, preserving current dimensions.
function applyFormFactorToCanvas() {
    if (isComplexShape) {
        const layer = layers[selectedLayerIndex];
        if (!layer) return;
        layer.baseShape = selectedBaseShape;
        if (selectedBaseShape !== 'custom') {
            delete layer.svgNormVerts;
        }
        if (requiresSquareBase(selectedBaseShape)) {
            layer.height = layer.width;
            heightInput.value = String(layer.width);
            if (heightValueEl) heightValueEl.textContent = `${Math.round(layer.width)} px`;
            if (heightDisplayEl) heightDisplayEl.value = String(Math.round(layer.width));
        }
        updateDimensionLock();
        renderLayersOnCanvas();
        syncInspectorToLayer(selectedLayerIndex);
        return;
    }

    if (!currentShape) return;

    // Snap height to width immediately when switching to a square-base form factor.
    if (requiresSquareBase(selectedBaseShape)) heightInput.value = widthInput.value;
    updateDimensionLock();

    const width  = parseFloat(widthInput.value)  || 40;
    const height = parseFloat(heightInput.value) || 40;
    const depth  = parseFloat(depthInput.value)  || 0;

    const pos = currentShape.position();

    paper.removeTools();
    graph.clear();
    graph2D.clear();

    const shape = getPreviewFactory(currentShapeId, selectedBaseShape)();
    shape.resize(width, height);
    shape.set('isometricHeight',        depth);
    shape.set('defaultIsometricHeight', depth);
    shape.set('defaultSize',            { width, height });
    shape.position(pos.x, pos.y);
    shape.toggleView(View.Isometric);
    graph.addCell(shape);
    currentShape = shape;

    const shape2D = getPreviewFactory(currentShapeId, selectedBaseShape)();
    shape2D.resize(width, height);
    shape2D.set('isometricHeight',        depth);
    shape2D.set('defaultIsometricHeight', depth);
    shape2D.set('defaultSize',            { width, height });
    shape2D.position(pos.x, pos.y);
    shape2D.toggleView(View.TwoDimensional);
    graph2D.addCell(shape2D);
    currentShape2D = shape2D;

    applyCornerRadiusToCurrentShape();
    applyChamferSizeToCurrentShape();
    applyChamferStartToCurrentShape();
    applyIconToCurrentShape();

    if (selectedBaseShape === 'custom') {
        const defaults = ShapeRegistry[currentShapeId];
        if (defaults?.customVerts?.length) {
            currentShape.set('normalizedVerts', defaults.customVerts);
            currentShape2D?.set('normalizedVerts', defaults.customVerts);
        }
    }
    apply3DModifiers();
    applyRotation();
    centerShapeOnCanvas(currentShape, currentShape2D);
}

// Apply slider dimension values to the preview shape (grid units → px).
function onFieldChange() {
    markDirty();
    if (isComplexShape) {
        // Sliders operate in pixels in complex mode.
        const layer = layers[selectedLayerIndex];
        if (!layer) return;
        const w = parseFloat(widthInput.value);
        if (requiresSquareBase(layer.baseShape)) {
            heightInput.value = String(w);
            if (heightValueEl) heightValueEl.textContent = `${Math.round(w)} px`;
        }
        const h = parseFloat(heightInput.value);
        const d = parseFloat(depthInput.value);
        if (isNaN(w) || isNaN(h) || isNaN(d) || w < 1 || h < 1 || d < 0) return;
        layer.width  = w;
        layer.height = h;
        layer.depth  = d;
        // Update the layer's shape in-place for smooth dragging
        const s   = layerShapes[selectedLayerIndex];
        const s2D = layerShapes2D[selectedLayerIndex];
        s?.resize(layer.width, layer.height);
        s?.set('isometricHeight', layer.depth);
        s2D?.resize(layer.width, layer.height);
        s2D?.set('isometricHeight', layer.depth);
        // Compensate for top-left-anchored resize: keep composite centred.
        recenterCompositeShape();
        // Icon coords are derived from layer[0]'s w/h/iH; if those just
        // changed, recompute. Safe to call unconditionally — if a non-icon
        // layer was resized, layer[0]'s size is unchanged and this is a no-op.
        applyIconToCurrentShape();
        return;
    }
    if (!currentShape) return;
    const widthPx = parseFloat(widthInput.value);
    if (requiresSquareBase(selectedBaseShape)) {
        heightInput.value = String(widthPx);
        if (heightValueEl) heightValueEl.textContent = `${Math.round(widthPx)} px`;
    }

    const isTube = TUBE_FAMILY.has(selectedBaseShape);
    if (isTube) {
        const lengthPx = widthPx;
        const diameterPx = parseFloat(heightInput.value);
        if (isNaN(lengthPx) || isNaN(diameterPx) || lengthPx < 1 || diameterPx < 1) return;
        depthInput.value = String(diameterPx);
        const swapped = ROTATED_FORMS.has(selectedBaseShape);
        const canvasW = swapped ? diameterPx : lengthPx;
        const canvasH = swapped ? lengthPx : diameterPx;
        resizeFromInput = true;
        currentShape.resize(canvasW, canvasH);
        currentShape.set('isometricHeight', diameterPx);
        currentShape2D?.resize(canvasW, canvasH);
        currentShape2D?.set('isometricHeight', diameterPx);
        resizeFromInput = false;
        centerShapeOnCanvas(currentShape, currentShape2D ?? null);
        return;
    }

    const heightPx = parseFloat(heightInput.value);
    const depthPx  = parseFloat(depthInput.value);
    if (isNaN(widthPx) || isNaN(heightPx) || isNaN(depthPx) || widthPx < 1 || heightPx < 1 || depthPx < 0) return;
    const swapped = ROTATED_FORMS.has(selectedBaseShape);
    const canvasW = swapped ? heightPx : widthPx;
    const canvasH = swapped ? widthPx : heightPx;
    resizeFromInput = true;
    currentShape.resize(canvasW, canvasH);
    currentShape.set('isometricHeight', depthPx);
    currentShape2D?.resize(canvasW, canvasH);
    currentShape2D?.set('isometricHeight', depthPx);
    resizeFromInput = false;
    centerShapeOnCanvas(currentShape, currentShape2D ?? null);
}

// Persist all template values to the Shape Registry.
function collectCurrentDef(): Partial<ShapeDefinition> {
    let iconHref: string | undefined;
    if (selectedIcon) {
        const iconEntry = getIconById(selectedIcon);
        if (iconEntry) {
            const isAwsEntry = iconEntry.source === 'aws';
            const isAwsMono = isAwsEntry && selectedIconMonochrome;
            let iSvg: string, iBg: string | null, iWhite: boolean, iPad: 'normal' | 'compact' | 'tight' | 'none', iClip: boolean;
            if (isAwsEntry && !isAwsMono) {
                iSvg = iconEntry.svg;
                iBg = selectedIconBgEnabled ? selectedIconBgColor : null;
                iWhite = false;
                iPad = 'normal';
                iClip = false;
            } else if (isAwsMono) {
                iSvg = iconEntry.svgMono || iconEntry.svg;
                iBg = selectedIconBgEnabled ? selectedIconBgColor : null;
                iWhite = selectedIconBgEnabled ? true : isDarkMode();
                iPad = 'compact';
                iClip = false;
            } else if (iconEntry.source === 'azure' || iconEntry.source === 'gcp') {
                iSvg = iconEntry.svg;
                iBg = selectedIconBgEnabled ? selectedIconBgColor : null;
                iWhite = false;
                iPad = 'normal';
                iClip = false;
            } else {
                iSvg = iconEntry.svg;
                iBg = selectedIconBgEnabled ? selectedIconBgColor : null;
                iWhite = selectedIconBgEnabled ? true : isDarkMode();
                iPad = 'normal';
                iClip = false;
            }
            const cGU = Math.max(selectedIconSize, selectedIconBgSize);
            const cPx = cGU * GRID_SIZE;
            const iPx = selectedIconSize * GRID_SIZE;
            const bPx = selectedIconBgSize * GRID_SIZE;
            const svg = buildCompositeIconSvg(iSvg, iBg, selectedIconBgShape, iWhite, selectedIconBgRadius, selectedIconBgChamfer, iPad, iClip, cPx, iPx, bPx);
            iconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }
    }

    if (isComplexShape && layers.length > 0) {
        saveIconEntriesToLayer();
        const layer1 = layers[0];
        return {
            defaultSize: { width: layer1.width, height: layer1.height },
            defaultIsometricHeight: layer1.depth,
            baseShape: layer1.baseShape,
            cornerRadius: selectedCornerRadius,
            chamferSize: selectedChamferSize,
            chamferStart: selectedChamferStart || undefined,
            style: {
                topColor: selectedStyle.topColor || undefined,
                frontColor: selectedStyle.frontColor || undefined,
                sideColor: selectedStyle.sideColor || undefined,
                strokeColor: selectedStyle.strokeColor || undefined,
            },
            complexShape: true,
            layers: layers.map(l => ({ ...l, style: { ...l.style }, icons: l.icons?.map(e => ({ ...e })) })),
            hitAreaSize: hitAreaShape ? { ...hitAreaShape.size() } : undefined,
        };
    }

    syncLegacyStateToIconEntry();

    const dispW = parseFloat(widthInput.value);
    const dispH = parseFloat(heightInput.value);
    const depthPx = parseFloat(depthInput.value);
    const swapped = ROTATED_FORMS.has(selectedBaseShape);
    const saveW = swapped ? dispH : dispW;
    const saveH = swapped ? dispW : dispH;
    return {
        defaultSize: { width: saveW, height: saveH },
        defaultIsometricHeight: depthPx,
        baseShape: selectedBaseShape,
        iconFace: selectedIconFace,
        icon: selectedIcon ?? undefined,
        iconSize: selectedIconSize,
        iconBgColor: selectedIconBgColor,
        iconBgShape: selectedIconBgShape,
        iconBgRadius: selectedIconBgRadius,
        iconBgChamfer: selectedIconBgChamfer,
        iconHref,
        icons: iconEntries.length > 0 ? iconEntries : undefined,
        cornerRadius: selectedCornerRadius,
        chamferSize: selectedChamferSize,
        chamferStart: selectedChamferStart || undefined,
        style: {
            topColor: selectedStyle.topColor || undefined,
            frontColor: selectedStyle.frontColor || undefined,
            sideColor: selectedStyle.sideColor || undefined,
            strokeColor: selectedStyle.strokeColor || undefined,
        },
        complexShape: false,
        layers: undefined,
        customVerts: selectedBaseShape === 'custom' && currentShape
            ? (currentShape.get('normalizedVerts') as [number, number][] | undefined)
            : undefined,
        rotation: selectedRotation || undefined,
        dimYAdjustable: dimensionYAdjustable || undefined,
        taper: selectedTaper || undefined,
        twist: selectedTwist || undefined,
        scaleTopX: selectedScaleTopX !== 1 ? selectedScaleTopX : undefined,
        scaleTopY: selectedScaleTopY !== 1 ? selectedScaleTopY : undefined,
    };
}

function switchVariation(target: 'default' | 'turned90') {
    saveIconEntriesToLayer();
    const currentDef = collectCurrentDef();
    if (activeVariation === 'default') {
        updateShapeDefinition(currentShapeId, {
            ...currentDef,
            displayName: shapeNameInput?.value.trim() || formatLabel(currentShapeId),
            componentType: componentTypeSelect?.value || undefined,
            hasVariations: true,
        });
    } else {
        updateShapeDefinition(currentShapeId, { turned90: currentDef as ShapeDefinition });
    }

    activeVariation = target;
    const displayName = shapeNameInput?.value.trim() || formatLabel(currentShapeId);

    if (target === 'turned90') {
        const t90 = ShapeRegistry[currentShapeId]?.turned90;
        if (t90) {
            const tempId = '__variation_temp__';
            ShapeRegistry[tempId] = { ...t90, displayName };
            loadShapeIntoCanvas(tempId);
            delete ShapeRegistry[tempId];
        } else {
            loadShapeIntoCanvas(currentShapeId);
        }
    } else {
        loadShapeIntoCanvas(currentShapeId);
    }

    if (shapeNameInput) shapeNameInput.value = displayName;
    rebuildVariationButtons();
}

async function onSave() {
    const def = collectCurrentDef();
    const name = shapeNameInput?.value.trim() || formatLabel(currentShapeId);
    const ct = componentTypeSelect?.value || undefined;

    const existing = ShapeRegistry[currentShapeId];
    const update: Partial<ShapeDefinition> = {
        ...def,
        displayName: name,
        componentType: ct,
        hasVariations: hasVariations || undefined,
    };

    if (hasVariations) {
        if (activeVariation === 'default') {
            update.turned90 = existing?.turned90 as ShapeDefinition | undefined;
        } else {
            // Editing turned90: keep existing default fields, store current as turned90
            if (existing) {
                update.defaultSize = existing.defaultSize;
                update.defaultIsometricHeight = existing.defaultIsometricHeight;
                update.baseShape = existing.baseShape;
                update.iconFace = existing.iconFace;
                update.icon = existing.icon;
                update.iconSize = existing.iconSize;
                update.iconBgEnabled = existing.iconBgEnabled;
                update.iconBgColor = existing.iconBgColor;
                update.iconBgShape = existing.iconBgShape;
                update.iconBgRadius = existing.iconBgRadius;
                update.iconBgSize = existing.iconBgSize;
                update.iconBgChamfer = existing.iconBgChamfer;
                update.iconHref = existing.iconHref;
                update.cornerRadius = existing.cornerRadius;
                update.chamferSize = existing.chamferSize;
                update.chamferStart = existing.chamferStart;
                update.style = existing.style;
                update.complexShape = existing.complexShape;
                update.layers = existing.layers;
                update.customVerts = existing.customVerts;
                update.rotation = existing.rotation;
                update.taper = existing.taper;
                update.twist = existing.twist;
                update.scaleTopX = existing.scaleTopX;
                update.scaleTopY = existing.scaleTopY;
            }
            update.turned90 = def as ShapeDefinition;
        }
    } else {
        update.turned90 = undefined;
    }

    updateShapeDefinition(currentShapeId, update);
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
    buildPalettePanel();

    // Auto-save SVG to inventory (current theme only — no theme swap to avoid flash)
    const svg = await buildShapeSvgString();
    if (svg) {
        const wasDark = isDarkMode();
        const generalStored = shapeStore.list('general').find(s => s.id === currentShapeId);
        const col = generalStored?.definition.collection || ShapeRegistry[currentShapeId]?.collection || 'General';
        saveToInventory(currentShapeId, name, col, wasDark ? svg : svg, wasDark ? svg : svg);
        document.dispatchEvent(new CustomEvent('nextrack:inventory-changed'));
    }

    showToast('Component saved');
}

function centerShapeOnCanvas(shape: IsometricShape, shape2D: IsometricShape | null) {
    const gridPx = CD_GRID_COUNT * GRID_SIZE;
    const { width, height } = shape.size();
    const posX = (gridPx - width)  / 2;
    const posY = (gridPx - height) / 2;
    shape.position(posX, posY);
    shape2D?.position(posX, posY);
}

// Complex-shape anchor: Layer 0 (main) is pinned to the ground.
//
// Every layer's absolute position is computed against a fixed reference
// (bx,by). Per-layer resize, offset and elevation all shift that layer's
// centre — the previous implementation kept the composite bbox centred,
// which also moved Layer 0 whenever other layers got elevation/offsets.
//
// The user wants the main layer anchored at the ground regardless of what
// the other layers do. So we now translate all layers by the delta needed
// to place Layer 0's *ground* centre (i.e. canvas centre plus L0's own
// offsets, but ignoring its baseElevation) at the canvas centre. Other
// layers' relative positions (including their elevation) are preserved.
function recenterCompositeShape() {
    if (!isComplexShape) return;
    if (layerShapes.length === 0 || layers.length === 0) return;

    const gridPx  = CD_GRID_COUNT * GRID_SIZE;
    const centerX = gridPx / 2;
    const centerY = gridPx / 2;
    const L0      = layers[0];

    // Ground target = where Layer 0 would sit without any elevation.
    // L0's own offsets are intentionally respected so users can still
    // nudge the main horizontally/vertically if they need to.
    const targetX = centerX + L0.offsetX;
    const targetY = centerY + L0.offsetY;

    const translate = (shapes: IsometricShape[]) => {
        if (shapes.length === 0) return;
        const anchor    = shapes[0];
        const { x, y }  = anchor.position();
        const { width: w, height: h } = anchor.size();
        const anchorCX  = x + w / 2;
        const anchorCY  = y + h / 2;
        const dx = targetX - anchorCX;
        const dy = targetY - anchorCY;
        if (dx === 0 && dy === 0) return;
        for (const s of shapes) {
            const p = s.position();
            s.position(p.x + dx, p.y + dy);
        }
    };

    translate(layerShapes);
    translate(layerShapes2D);

    if (hitAreaVisible) {
        if (hitAreaShape) centerHitArea(hitAreaShape, graph);
        if (hitAreaShape2D) centerHitArea(hitAreaShape2D, graph2D);
    }
}

function getHitAreaSize(): { width: number; height: number } {
    const reg = ShapeRegistry[currentShapeId];
    if (reg?.hitAreaSize) return { ...reg.hitAreaSize };
    const L0 = layers[0];
    if (!L0) return { width: GRID_SIZE * 2, height: GRID_SIZE * 2 };
    let minX = 0, minY = 0, maxX = L0.width, maxY = L0.height;
    for (const l of layers) {
        const lx = l.offsetX - L0.width / 2 + l.width / 2;
        const ly = l.offsetY - L0.height / 2 + l.height / 2;
        minX = Math.min(minX, lx - l.width / 2);
        minY = Math.min(minY, ly - l.height / 2);
        maxX = Math.max(maxX, lx + l.width / 2 + L0.width / 2);
        maxY = Math.max(maxY, ly + l.height / 2 + L0.height / 2);
    }
    return { width: maxX - minX, height: maxY - minY };
}

function centerHitArea(area: IsometricShape, g: dia.Graph) {
    const gridPx = CD_GRID_COUNT * GRID_SIZE;
    const center = gridPx / 2;
    const s = area.size();
    area.position(center - s.width / 2, center - s.height / 2);
}

function showHitAreaOverlay() {
    hideHitAreaOverlay();
    hitAreaVisible = true;
    const haSize = getHitAreaSize();

    const createOverlay = (g: dia.Graph, p: dia.Paper): IsometricShape => {
        const area = new Area();
        area.resize(haSize.width, haSize.height);
        area.attr('body/fill', 'rgba(15, 98, 254, 0.08)');
        area.attr('body/stroke', '#0f62fe');
        area.attr('body/stroke-width', 1);
        area.attr('body/stroke-dasharray', '4 3');
        area.attr('label/display', 'none');
        area.set('z', 1000);
        centerHitArea(area, g);
        g.addCell(area);
        area.addTools(p, View.TwoDimensional);
        return area;
    };

    hitAreaShape = createOverlay(graph, paper);
    hitAreaShape2D = createOverlay(graph2D, paper2D);

    hitAreaShape.on('change:size', () => {
        if (!hitAreaShape) return;
        centerHitArea(hitAreaShape, graph);
        const s = hitAreaShape.size();
        if (hitAreaShape2D) {
            hitAreaShape2D.resize(s.width, s.height);
            centerHitArea(hitAreaShape2D, graph2D);
        }
        const wEl = document.getElementById('sd-hud-ha-w') as HTMLInputElement | null;
        const hEl = document.getElementById('sd-hud-ha-h') as HTMLInputElement | null;
        if (wEl) { wEl.value = String(Math.round(s.width)); const d = wEl.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display'); if (d) d.value = `${Math.round(s.width)}px`; }
        if (hEl) { hEl.value = String(Math.round(s.height)); const d = hEl.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display'); if (d) d.value = `${Math.round(s.height)}px`; }
        markDirty();
    });
}

function hideHitAreaOverlay() {
    hitAreaVisible = false;
    if (hitAreaShape) { hitAreaShape.remove(); hitAreaShape = null; }
    if (hitAreaShape2D) { hitAreaShape2D.remove(); hitAreaShape2D = null; }
}

// Keep form in sync when resize or height tools are used directly on the shape.
graph.on('change:size', (cell: dia.Cell) => {
    if (isComplexShape) return;
    if (currentShape && cell.id === currentShape.id) {
        // For adjustable tube/duct shapes, constrain to only change the length axis
        // Default (tube/duct): length=canvas width, cross-section=canvas height (fix height)
        // Rotated (pipe/channel): length=canvas height, cross-section=canvas width (fix width)
        if (!resizeFromInput && dimensionYAdjustable && ROTATE_PAIR[selectedBaseShape]) {
            const { width, height } = currentShape.size();
            const isRotated = ROTATED_FORMS.has(selectedBaseShape);
            const fixedPx = parseFloat(heightInput.value) || 40;
            if (isRotated && Math.abs(width - fixedPx) > 0.5) {
                currentShape.resize(fixedPx, height, { silent: true });
            } else if (!isRotated && Math.abs(height - fixedPx) > 0.5) {
                currentShape.resize(width, fixedPx, { silent: true });
            }
        }
        syncFormFromShape(currentShape);
        applyIconToCurrentShape();
        if (currentShape2D) {
            const { width, height } = currentShape.size();
            currentShape2D.resize(width, height);
        }
        centerShapeOnCanvas(currentShape, currentShape2D);
    }
});

paper.on('element:mouseenter', () => {
    paper.el.querySelectorAll('.joint-tools').forEach(el => el.classList.add('nr-tools--hover'));
});
paper.on('element:mouseleave', () => {
    paper.el.querySelectorAll('.nr-tools--hover').forEach(el => el.classList.remove('nr-tools--hover'));
});

graph2D.on('change:size', (cell: dia.Cell) => {
    if (isComplexShape) return;
    if (currentShape2D && cell.id === currentShape2D.id) {
        if (!resizeFromInput && dimensionYAdjustable && ROTATE_PAIR[selectedBaseShape]) {
            const { width, height } = currentShape2D.size();
            const isRotated = ROTATED_FORMS.has(selectedBaseShape);
            const fixedPx = parseFloat(heightInput.value) || 40;
            if (isRotated && Math.abs(width - fixedPx) > 0.5) {
                currentShape2D.resize(fixedPx, height, { silent: true });
            } else if (!isRotated && Math.abs(height - fixedPx) > 0.5) {
                currentShape2D.resize(width, fixedPx, { silent: true });
            }
        }
        const { width, height } = currentShape2D.size();
        currentShape?.resize(width, height);
        syncFormFromShape(currentShape2D);
        applyIconToCurrentShape();
        centerShapeOnCanvas(currentShape!, currentShape2D);
    }
});

paper2D.on('element:mouseenter', () => {
    paper2D.el.querySelectorAll('.joint-tools').forEach(el => el.classList.add('nr-tools--hover'));
});
paper2D.on('element:mouseleave', () => {
    paper2D.el.querySelectorAll('.nr-tools--hover').forEach(el => el.classList.remove('nr-tools--hover'));
});

graph.on('change:isometricHeight', (cell: dia.Cell) => {
    if (isComplexShape) return; // layer shapes have no height tools
    if (currentShape && cell.id === currentShape.id) {
        syncFormFromShape(currentShape);
        applyIconToCurrentShape();
        if (currentShape2D) {
            currentShape2D.set('isometricHeight', currentShape.get('isometricHeight'));
        }
        centerShapeOnCanvas(currentShape, currentShape2D);
    }
});

// ── Complex Shape helpers ─────────────────────────────────────────────────────

// ── SVG Footprint helpers ─────────────────────────────────────────────────────

/**
 * Rebuilds the SVG Footprint inspector section for the currently selected layer.
 * Shows an upload control when no SVG is loaded, or the filename + Remove button
 * when one is active.  Displays any pending parse error beneath the control.
 */
function syncSvgFootprintSection() {
    // Toggle the accordion item visibility
    if (svgFootprintAccordionLi) {
        svgFootprintAccordionLi.style.display = isComplexShape ? '' : 'none';
    }
    if (!isComplexShape || !svgFootprintAccordionContent) return;

    const layer = layers[selectedLayerIndex] ?? null;
    svgFootprintAccordionContent.innerHTML = '';

    if (!layer) return;

    // Row: label left, control right (160px) — same layout as other inputs
    const row = document.createElement('div');
    row.className = 'nr-sd-number-row';

    const lbl = document.createElement('span');
    lbl.className = 'nr-sd-number-label';
    lbl.textContent = 'File';
    row.appendChild(lbl);

    const controlWrap = document.createElement('div');
    controlWrap.className = 'nr-svgfp-control';

    if (isLayerSvg(layer)) {
        const fileName = document.createElement('span');
        fileName.className = 'nr-svgfp-name';
        fileName.title = layer.svgFootprintName ?? 'custom.svg';
        fileName.textContent = layer.svgFootprintName ?? 'custom.svg';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'nr-svgfp-remove-btn';
        removeBtn.title = 'Remove';
        removeBtn.setAttribute('aria-label', 'Remove SVG footprint');
        removeBtn.innerHTML = CDS_ICON_TRASH;
        removeBtn.addEventListener('click', onRemoveSvgFootprint);

        controlWrap.appendChild(fileName);
        controlWrap.appendChild(removeBtn);
    } else {
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'nr-svgfp-name nr-svgfp-name--empty';
        fileNameSpan.textContent = 'No file';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'sd-svgfp-input';
        fileInput.accept = '.svg,image/svg+xml';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => onSvgFootprintUpload(fileInput));

        const uploadBtn = document.createElement('label');
        uploadBtn.className = 'nr-svgfp-upload-btn';
        uploadBtn.setAttribute('for', 'sd-svgfp-input');
        uploadBtn.textContent = 'Upload';

        controlWrap.appendChild(fileNameSpan);
        controlWrap.appendChild(fileInput);
        controlWrap.appendChild(uploadBtn);
    }

    row.appendChild(controlWrap);
    svgFootprintAccordionContent.appendChild(row);

    if (isLayerSvg(layer) && layer.svgFootprint) {
        const preview = document.createElement('div');
        preview.className = 'nr-svgfp-preview';
        preview.setAttribute('aria-label', 'SVG footprint preview');
        preview.innerHTML = layer.svgFootprint;
        svgFootprintAccordionContent.appendChild(preview);

        // Billboard toggle
        const bbRow = document.createElement('div');
        bbRow.className = 'nr-sd-face-row';
        const bbLabel = document.createElement('span');
        bbLabel.className = 'nr-sd-row-label';
        bbLabel.textContent = 'Stand Up';
        bbRow.appendChild(bbLabel);

        const bbToggle = document.createElement('div');
        bbToggle.className = 'nr-toggle';
        const bbBtn = document.createElement('button');
        bbBtn.type = 'button';
        bbBtn.id = 'sd-svg-billboard';
        bbBtn.setAttribute('role', 'switch');
        const isBillboard = !!(layer as any).svgBillboard;
        bbBtn.setAttribute('aria-checked', String(isBillboard));
        if (isBillboard) bbToggle.classList.add('nr-toggle--checked');
        const bbTrack = document.createElement('span');
        bbTrack.className = 'nr-toggle__track';
        bbBtn.appendChild(bbTrack);
        bbBtn.addEventListener('click', () => {
            const next = !((layer as any).svgBillboard);
            (layer as any).svgBillboard = next;
            bbBtn.setAttribute('aria-checked', String(next));
            bbToggle.classList.toggle('nr-toggle--checked', next);
            applyBillboardMode(next);
            markDirty();
        });
        bbToggle.appendChild(bbBtn);
        bbRow.appendChild(bbToggle);
        svgFootprintAccordionContent.appendChild(bbRow);

        // Apply billboard mode to current shapes
        applyBillboardMode(isBillboard);
    } else if (!isLayerSvg(layer)) {
    }

    // Parse error (cleared on layer switch and on successful upload/remove)
    if (svgParseError) {
        const errEl = document.createElement('p');
        errEl.className = 'cds--form-requirement';
        errEl.style.marginTop = '4px';
        errEl.textContent = svgParseError;
        svgFootprintAccordionContent.appendChild(errEl);
    }
}

function applyBillboardMode(enabled: boolean): void {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    const svgStr = layer.svgFootprint;

    for (let i = 0; i < layerShapes.length; i++) {
        const s = layerShapes[i];
        const s2D = layerShapes2D[i];
        if (!s) continue;

        if (enabled && svgStr) {
            const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
            const { width: w, height: h } = s.size();
            const iH = (s.get('isometricHeight') as number) || 10;

            // Hide normal 3D faces
            s.attr('side/display', 'none');
            s.attr('top/display', 'none');
            s.attr('base/display', 'none');

            const cx = w / 2;
            const cy = h / 2;
            s.attr('billboardFront', {
                href, x: 0, y: 0, width: w, height: h, display: null,
                transform: `matrix(1,0,-1,-1,0,${h}) rotate(180,${cx},${cy})`,
            });

            // 2D flat view
            if (s2D) {
                s2D.attr('base/display', 'none');
                s2D.attr('billboard2D', {
                    href, x: 0, y: 0, width: w, height: h, display: null,
                });
            }
        } else {
            s.attr('side/display', null);
            s.attr('top/display', null);
            s.attr('base/display', null);
            s.attr('billboardFront/display', 'none');
            if (s2D) {
                s2D.attr('base/display', null);
                s2D.attr('billboard2D/display', 'none');
            }
        }
    }
}

/** Reads the selected file, parses it, and applies the SVG footprint to the current layer. */
function onSvgFootprintUpload(fileInput: HTMLInputElement) {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const svgString = e.target?.result as string;
        if (typeof svgString !== 'string' || !svgString.trim()) return;

        const result = parseSvgFootprint(svgString);
        if (result.error || result.normVerts.length < 3) {
            svgParseError = result.error ?? 'Could not extract a usable outline from this SVG.';
            syncSvgFootprintSection();
            return;
        }

        const layer = layers[selectedLayerIndex];
        if (!layer) return;

        svgParseError           = '';
        layer.svgFootprint      = svgString;
        layer.svgNormVerts      = result.normVerts;
        layer.svgFootprintName  = file.name;

        renderLayersOnCanvas();
        syncSvgFootprintSection();
        updateDimensionLock(); // hide corner radius / chamfer for SVG layer
    };
    reader.readAsText(file);
}

/** Removes the SVG footprint from the current layer, reverting to the built-in form factor. */
function onRemoveSvgFootprint() {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;

    delete layer.svgFootprint;
    delete layer.svgNormVerts;
    delete layer.svgFootprintName;
    svgParseError = '';

    renderLayersOnCanvas();
    syncSvgFootprintSection();
    updateDimensionLock(); // restore corner radius / chamfer if form factor supports it
}

function showLayersPanel() {
    layerPanelEl.style.display = 'flex';
}

function hideLayersPanel() {
    layerPanelEl.style.display = 'none';
}

/**
 * The component origin on the canvas: shapes with no offset are centred here.
 * Using a fixed reference point so all layers share the same coordinate origin.
 */
function layerBasePos(): { x: number; y: number } {
    const gridPx = CD_GRID_COUNT * GRID_SIZE;
    return { x: gridPx / 2, y: gridPx / 2 };
}

function renderLayersOnCanvas() {
    paper.removeTools();
    graph.clear();
    graph2D.clear();
    layerShapes   = [];
    layerShapes2D = [];
    currentShape   = null;
    currentShape2D = null;

    const { x: bx, y: by } = layerBasePos();

    // Build all shapes first (not yet in the graph) so we control insertion order.
    for (let idx = 0; idx < layers.length; idx++) {
        const layer = layers[idx];
        const isoX = bx - layer.width  / 2 + layer.offsetX - layer.baseElevation;
        const isoY = by - layer.height / 2 + layer.offsetY - layer.baseElevation;

        let shape: IsometricShape;
        if (isLayerCustomVerts(layer)) {
            const svgShape = new SvgPolygonShape();
            svgShape.set('normalizedVerts', layer.svgNormVerts!);
            shape = svgShape;
        } else {
            shape = (FORM_FACTOR_PREVIEWS[layer.baseShape] ?? FORM_FACTOR_PREVIEWS['cuboid'])();
        }
        shape.resize(layer.width, layer.height);
        shape.set('isometricHeight',        layer.depth);
        shape.set('defaultIsometricHeight', layer.depth);
        shape.set('defaultSize',            { width: layer.width, height: layer.height });
        if (layer.cornerRadius !== undefined) shape.set('cornerRadius', layer.cornerRadius);
        if (layer.chamferSize !== undefined) shape.set('chamferSize', layer.chamferSize);
        if (layer.chamferStart) shape.set('chamferStart', layer.chamferStart);
        if (layer.chamferBottomSize) shape.set('chamferBottomSize', layer.chamferBottomSize);
        if (layer.chamferBottomStart) shape.set('chamferBottomStart', layer.chamferBottomStart);
        if (layer.taper) shape.set('taper', layer.taper);
        if (layer.twist) shape.set('twist', layer.twist);
        if (layer.scaleTopX !== undefined && layer.scaleTopX !== 1) shape.set('scaleTopX', layer.scaleTopX);
        if (layer.scaleTopY !== undefined && layer.scaleTopY !== 1) shape.set('scaleTopY', layer.scaleTopY);
        if (layer.shedRoofDrop) shape.set('shedRoofDrop', layer.shedRoofDrop);
        if (layer.shedRoofDirection) shape.set('shedRoofDirection', layer.shedRoofDirection);
        shape.position(isoX, isoY);
        shape.toggleView(View.Isometric);
        if ((layer as any).svgBillboard && layer.svgFootprint) {
            const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(layer.svgFootprint)}`;
            const lw = layer.width, lh = layer.height;
            const cx = lw / 2, cy = lh / 2;
            shape.attr({ 'side': { display: 'none' }, 'top': { display: 'none' }, 'base': { display: 'none' } });
            shape.attr('billboardFront', {
                href, x: 0, y: 0, width: lw, height: lh, display: null,
                transform: `matrix(1,0,-1,-1,0,${lh}) rotate(180,${cx},${cy})`,
            });
        }
        if (idx > 0) shape.attr('label/text', '');
        layerShapes.push(shape);

        const x2D = bx - layer.width  / 2 + layer.offsetX;
        const y2D = by - layer.height / 2 + layer.offsetY;

        let shape2D: IsometricShape;
        if (isLayerCustomVerts(layer)) {
            const svgShape2D = new SvgPolygonShape();
            svgShape2D.set('normalizedVerts', layer.svgNormVerts!);
            shape2D = svgShape2D;
        } else {
            shape2D = (FORM_FACTOR_PREVIEWS[layer.baseShape] ?? FORM_FACTOR_PREVIEWS['cuboid'])();
        }
        shape2D.resize(layer.width, layer.height);
        shape2D.set('isometricHeight',        layer.depth);
        shape2D.set('defaultIsometricHeight', layer.depth);
        shape2D.set('defaultSize',            { width: layer.width, height: layer.height });
        if (layer.cornerRadius !== undefined) shape2D.set('cornerRadius', layer.cornerRadius);
        if (layer.chamferSize !== undefined) shape2D.set('chamferSize', layer.chamferSize);
        if (layer.chamferStart) shape2D.set('chamferStart', layer.chamferStart);
        if (layer.chamferBottomSize) shape2D.set('chamferBottomSize', layer.chamferBottomSize);
        if (layer.chamferBottomStart) shape2D.set('chamferBottomStart', layer.chamferBottomStart);
        if (layer.taper) shape2D.set('taper', layer.taper);
        if (layer.twist) shape2D.set('twist', layer.twist);
        if (layer.scaleTopX !== undefined && layer.scaleTopX !== 1) shape2D.set('scaleTopX', layer.scaleTopX);
        if (layer.scaleTopY !== undefined && layer.scaleTopY !== 1) shape2D.set('scaleTopY', layer.scaleTopY);
        if (layer.shedRoofDrop) shape2D.set('shedRoofDrop', layer.shedRoofDrop);
        if (layer.shedRoofDirection) shape2D.set('shedRoofDirection', layer.shedRoofDirection);
        shape2D.position(x2D, y2D);
        shape2D.toggleView(View.TwoDimensional);
        if ((layer as any).svgBillboard && layer.svgFootprint) {
            const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(layer.svgFootprint)}`;
            shape2D.attr('base/display', 'none');
            shape2D.attr('billboard2D', { href, x: 0, y: 0, width: layer.width, height: layer.height, display: null });
        }
        if (idx > 0) shape2D.attr('label/text', '');
        layerShapes2D.push(shape2D);
    }

    for (let idx = 0; idx < layerShapes.length; idx++) {
        graph.addCell(layerShapes[idx]);
        const s = layers[idx];
        if (s.style.topColor || s.style.frontColor || s.style.sideColor || s.style.strokeColor) {
            applyShapeStyle(layerShapes[idx], s.style);
        }
    }
    for (let idx = 0; idx < layerShapes2D.length; idx++) {
        graph2D.addCell(layerShapes2D[idx]);
        const s = layers[idx];
        if (s.style.topColor || s.style.frontColor || s.style.sideColor || s.style.strokeColor) {
            applyShapeStyle(layerShapes2D[idx], s.style);
        }
    }

    currentShape   = layerShapes[selectedLayerIndex]   ?? null;
    currentShape2D = layerShapes2D[selectedLayerIndex] ?? null;

    // Apply each layer's stored icons to its own shape.
    if (isComplexShape) {
        applyAllLayerIcons();
    } else {
        applyIconToCurrentShape();
    }

    // Realign the composite bbox to the canvas centre.
    recenterCompositeShape();
}

function buildLayersPanel() {
    layerPanelEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'nr-panel-header';
    const title = document.createElement('span');
    title.className = 'nr-panel-title';
    title.textContent = 'Layers';
    header.appendChild(title);
    layerPanelEl.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'nr-layers-list';

    const makeLayerAction = (icon: string, label: string, handler: () => void): HTMLButtonElement => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-layer-item-action';
        btn.setAttribute('aria-label', label);
        btn.innerHTML = icon;
        btn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
        return btn;
    };

    // Render layers top-to-bottom with the MAIN (index 0) at the bottom of the list,
    // mirroring the paint order: main = bottommost visual, extra layers stacked above.
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const isMain = i === 0;
        const li = document.createElement('li');
        li.className = 'nr-layer-item' + (i === selectedLayerIndex ? ' nr-layer-item--selected' : '') + (isMain ? ' nr-layer-item--main' : '');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'nr-layer-item-name';
        nameSpan.textContent = layer.name;
        li.appendChild(nameSpan);

        if (isMain) {
            const tag = document.createElement('span');
            tag.className = 'cds--tag cds--tag--blue nr-layer-main-tag';
            tag.textContent = 'Main';
            tag.title = 'Main layer — owns the component name and label position';
            li.appendChild(tag);
        } else {
            // Chevron up/down are only shown on additional layers. Main layer stays
            // anchored at index 0 — nothing can move above/below it.
            // Array index 0 = bottom of list visually; index 1 is just above it.
            // "Move up" in the UI (visually higher) = increase array index.
            const upBtn   = makeLayerAction(CDS_ICON_CHEVRON_UP,   `Move ${layer.name} up`,   () => onMoveLayerUp(i));
            const downBtn = makeLayerAction(CDS_ICON_CHEVRON_DOWN, `Move ${layer.name} down`, () => onMoveLayerDown(i));
            upBtn.disabled   = i >= layers.length - 1; // already at the top
            downBtn.disabled = i <= 1;                 // just above main — can't go lower
            li.appendChild(upBtn);
            li.appendChild(downBtn);
        }

        // Overflow menu — Rename / Duplicate / Delete. Delete is disabled on main.
        const menuBtn = makeLayerAction(CDS_ICON_OVERFLOW, `Actions for ${layer.name}`, () => {
            showLayerOverflowMenu(menuBtn, i);
        });
        menuBtn.classList.add('nr-layer-item-action--menu');
        li.appendChild(menuBtn);

        li.addEventListener('click', () => {
            saveIconEntriesToLayer();
            editingIconIndex = -1;
            const edPopup = document.getElementById('nr-icon-editor-popup');
            if (edPopup) edPopup.style.display = 'none';
            selectedLayerIndex = i;
            selectedBaseShape = layers[i]?.baseShape ?? 'cuboid';
            currentShape   = layerShapes[i]   ?? null;
            currentShape2D = layerShapes2D[i] ?? null;
            iconEntries = layers[i]?.icons?.map(e => ({ ...e })) ?? [];
            selectedIcon = null;
            selectedIconBgEnabled = false;
            buildLayersPanel();
            buildInspectorPanel();
            syncInspectorToLayer(i);
            applyAllLayerIcons();
        });

        list.appendChild(li);
    }

    layerPanelEl.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'nr-layers-add-btn';
    addBtn.textContent = '+ Add Layer';
    addBtn.addEventListener('click', onAddLayer);
    layerPanelEl.appendChild(addBtn);
}

// Per-layer overflow popup: Rename / Duplicate / Delete.
// Uses the Carbon overflow-menu-options classes (already pulled in by @carbon/styles).
function showLayerOverflowMenu(anchor: HTMLElement, index: number) {
    const existing = document.querySelector('.nr-layer-overflow-popup');
    if (existing) { existing.remove(); return; }

    const layer = layers[index];
    if (!layer) return;
    const isMain = index === 0;

    const popup = document.createElement('div');
    popup.className = 'cds--overflow-menu-options cds--overflow-menu-options--open nr-layer-overflow-popup';
    popup.setAttribute('role', 'menu');
    const rect = anchor.getBoundingClientRect();
    popup.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.right - 160}px;z-index:6000;min-width:160px;`;

    const list = document.createElement('ul');
    list.className = 'cds--overflow-menu-options__content';

    const items: Array<{ label: string; onClick: () => void; disabled?: boolean }> = [
        { label: 'Rename layer',    onClick: () => { popup.remove(); showRenameLayerModal(index); } },
        { label: 'Duplicate layer', onClick: () => { popup.remove(); onDuplicateLayer(index); } },
        { label: 'Delete layer',    onClick: () => { popup.remove(); onDeleteLayer(index); }, disabled: isMain || layers.length <= 1 },
    ];

    for (const item of items) {
        const li = document.createElement('li');
        li.className = 'cds--overflow-menu-options__option' + (item.disabled ? ' cds--overflow-menu-options__option--disabled' : '');
        const btn = document.createElement('button');
        btn.className = 'cds--overflow-menu-options__btn';
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.disabled = !!item.disabled;
        btn.textContent = item.label;
        if (!item.disabled) btn.addEventListener('click', item.onClick);
        li.appendChild(btn);
        list.appendChild(li);
    }

    popup.appendChild(list);
    document.body.appendChild(popup);

    const dismiss = (e: MouseEvent) => {
        if (!popup.contains(e.target as Node) && e.target !== anchor) {
            popup.remove();
            document.removeEventListener('mousedown', dismiss, true);
        }
    };
    document.addEventListener('mousedown', dismiss, true);
}

// Small modal for renaming a layer — mirrors the Duplicate Component modal pattern.
function showRenameLayerModal(index: number) {
    const layer = layers[index];
    if (!layer) return;

    const modalEl = document.createElement('div');
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-rename-layer-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';
    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-rename-layer-heading';
    headingEl.textContent = 'Rename layer';
    const closeBtnWrapper = document.createElement('div');
    closeBtnWrapper.className = 'cds--modal-close-button';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cds--modal-close';
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = CDS_ICON_CLOSE;
    closeBtn.addEventListener('click', () => modalEl.remove());
    closeBtnWrapper.appendChild(closeBtn);
    headerEl.appendChild(headingEl);
    headerEl.appendChild(closeBtnWrapper);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'cds--modal-content';
    const formItem = document.createElement('div');
    formItem.className = 'cds--form-item';
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'cds--text-input-wrapper';
    const label = document.createElement('label');
    label.className = 'cds--label';
    label.setAttribute('for', 'nr-rename-layer-input');
    label.textContent = 'Layer name';
    const fieldOuter = document.createElement('div');
    fieldOuter.className = 'cds--text-input__field-outer-wrapper';
    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'cds--text-input__field-wrapper';
    const nameInput = document.createElement('input');
    nameInput.id = 'nr-rename-layer-input';
    nameInput.type = 'text';
    nameInput.className = 'cds--text-input';
    nameInput.value = layer.name;
    fieldWrapper.appendChild(nameInput);
    fieldOuter.appendChild(fieldWrapper);
    inputWrapper.appendChild(label);
    inputWrapper.appendChild(fieldOuter);
    formItem.appendChild(inputWrapper);
    bodyEl.appendChild(formItem);

    const footerEl = document.createElement('div');
    footerEl.className = 'cds--modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cds--btn cds--btn--secondary';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => modalEl.remove());
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'cds--btn cds--btn--primary';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Rename';
    confirmBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        layer.name = name;
        modalEl.remove();
        buildLayersPanel();
        refreshIconAccordionContent();
    });
    nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter')  confirmBtn.click();
        if (e.key === 'Escape') modalEl.remove();
    });
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(confirmBtn);

    containerEl.appendChild(headerEl);
    containerEl.appendChild(bodyEl);
    containerEl.appendChild(footerEl);
    modalEl.appendChild(containerEl);
    document.body.appendChild(modalEl);
    modalEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === modalEl) modalEl.remove();
    });
    nameInput.select();
    nameInput.focus();
}

let applyingAllLayerIcons = false;

function applyAllLayerIcons() {
    if (!isComplexShape) return;
    applyingAllLayerIcons = true;
    const noIconAttrs = {
        topIcon:   { href: '', width: 0, height: 0 },
        topIcon2D: { href: '', width: 0, height: 0 },
    };
    const savedEntries = iconEntries;
    const savedShape = currentShape;
    const savedShape2D = currentShape2D;
    for (let idx = 0; idx < layers.length; idx++) {
        const layerIcons = layers[idx].icons;
        const shape = layerShapes[idx];
        const shape2D = layerShapes2D[idx];
        if (!layerIcons || !layerIcons.some(e => !!e.id || e.bgEnabled)) {
            shape?.attr(noIconAttrs);
            shape2D?.attr(noIconAttrs);
            continue;
        }
        iconEntries = layerIcons;
        currentShape = shape ?? null;
        currentShape2D = shape2D ?? null;
        applyIconToCurrentShape();
    }
    iconEntries = savedEntries;
    currentShape = savedShape;
    currentShape2D = savedShape2D;
    applyingAllLayerIcons = false;
}

function saveIconEntriesToLayer() {
    if (!isComplexShape) return;
    const layer = layers[selectedLayerIndex];
    if (layer) layer.icons = iconEntries.map(e => ({ ...e }));
}

function loadIconEntriesFromLayer(index: number) {
    if (!isComplexShape) return;
    const layer = layers[index];
    iconEntries = layer?.icons?.map(e => ({ ...e })) ?? [];
    selectedIcon = null;
    selectedIconBgEnabled = false;
    if (renderIconsListFn) renderIconsListFn();
}

function syncInspectorToLayer(index: number) {
    const layer = layers[index];
    if (!layer) return;

    selectedBaseShape = layer.baseShape;

    // Complex shape sliders always operate in pixels.
    widthInput.value  = String(layer.width);
    heightInput.value = String(layer.height);
    depthInput.value  = String(layer.depth);
    setSliderFill(widthInput);
    setSliderFill(heightInput);
    setSliderFill(depthInput);
    if (widthValueEl)  widthValueEl.textContent  = `${Math.round(layer.width)} px`;
    if (heightValueEl) heightValueEl.textContent = `${Math.round(layer.height)} px`;
    if (depthValueEl)  depthValueEl.textContent  = `${Math.round(layer.depth)} px`;
    if (widthDisplayEl)  widthDisplayEl.value  = String(Math.round(layer.width));
    if (heightDisplayEl) heightDisplayEl.value = String(Math.round(layer.height));
    if (depthDisplayEl)  depthDisplayEl.value  = String(Math.round(layer.depth));

    if (offsetXInput)        {
        offsetXInput.value = String(layer.offsetX);
        setSliderFill(offsetXInput);
        const d = offsetXInput.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
        if (d) d.value = `${Math.round(layer.offsetX)}px`;
    }
    if (offsetYInput)        {
        offsetYInput.value = String(layer.offsetY);
        setSliderFill(offsetYInput);
        const d = offsetYInput.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
        if (d) d.value = `${Math.round(layer.offsetY)}px`;
    }
    if (baseElevationInput)  {
        baseElevationInput.value = String(layer.baseElevation);
        baseElevationInput.disabled = index === 0;
        setSliderFill(baseElevationInput);
        const d = baseElevationInput.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
        if (d) d.value = `${Math.round(layer.baseElevation)}px`;
    }
    if (offsetXValueEl)       offsetXValueEl.textContent       = `${Math.round(layer.offsetX)} px`;
    if (offsetYValueEl)       offsetYValueEl.textContent       = `${Math.round(layer.offsetY)} px`;
    if (baseElevationValueEl) baseElevationValueEl.textContent = `${Math.round(layer.baseElevation)} px`;

    // Sync form factor radio buttons
    inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-form-factor"]').forEach(r => {
        r.checked = r.value === layer.baseShape;
    });
    syncFormFactorTiles();

    // Sync color picker
    selectedStyle = {
        topColor:    layer.style.topColor    ?? '',
        sideColor:   layer.style.sideColor   ?? '',
        frontColor:  layer.style.frontColor  ?? '',
        strokeColor: layer.style.strokeColor ?? '',
    };
    const repColor = layer.style.topColor || layer.style.frontColor || layer.style.sideColor || '#e0e0e0';
    if (colorPickerRef) colorPickerRef.value = repColor;

    // Sync corner radius and chamfer (may be overridden/hidden for SVG layers by updateDimensionLock)
    const cr = layer.cornerRadius ?? 0;
    selectedCornerRadius = cr;
    if (cornerRadiusInput) {
        cornerRadiusInput.value = String(cr);
        setSliderFill(cornerRadiusInput);
        const d = cornerRadiusInput.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
        if (d) d.value = `${cr}px`;
    }
    if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = `${cr} px`;

    const cs = layer.chamferSize ?? 0;
    selectedChamferSize = cs;
    if (chamferSizeInput) {
        chamferSizeInput.value = String(cs);
        setSliderFill(chamferSizeInput);
        const d = chamferSizeInput.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
        if (d) d.value = `${cs}px`;
    }
    if (chamferSizeValueEl) chamferSizeValueEl.textContent = `${cs} px`;

    const syncSlider = (input: HTMLInputElement | null, val: number) => {
        if (!input) return;
        input.value = String(val);
        setSliderFill(input);
        const d = input.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
        if (d) d.value = `${val}px`;
    };

    selectedChamferStart = layer.chamferStart ?? 0;
    syncSlider(chamferStartInput, selectedChamferStart);

    selectedChamferBottomSize = layer.chamferBottomSize ?? 0;
    syncSlider(chamferBottomSizeInput, selectedChamferBottomSize);

    selectedChamferBottomStart = layer.chamferBottomStart ?? 0;
    syncSlider(chamferBottomStartInput, selectedChamferBottomStart);

    selectedTaper = layer.taper ?? 0;
    syncSlider(taperInput, selectedTaper);
    if (taperValueEl) taperValueEl.textContent = selectedTaper.toFixed(2);

    selectedTwist = layer.twist ?? 0;
    syncSlider(twistInput, selectedTwist);
    if (twistValueEl) twistValueEl.textContent = `${selectedTwist}°`;

    selectedScaleTopX = layer.scaleTopX ?? 1;
    syncSlider(stxInput, selectedScaleTopX);
    if (stxValueEl) stxValueEl.textContent = selectedScaleTopX.toFixed(2);

    selectedScaleTopY = layer.scaleTopY ?? 1;
    syncSlider(styInput, selectedScaleTopY);
    if (styValueEl) styValueEl.textContent = selectedScaleTopY.toFixed(2);

    selectedShedRoofDrop = layer.shedRoofDrop ?? 0;
    syncSlider(shedDropInput, selectedShedRoofDrop);

    selectedShedRoofDirection = (layer.shedRoofDirection as string) ?? 'front';
    if (shedDirSwitcherEl) {
        shedDirSwitcherEl.querySelectorAll('.nr-seg-btn').forEach((b, i) =>
            b.classList.toggle('nr-seg-btn--selected', ['front', 'right', 'back', 'left'][i] === selectedShedRoofDirection));
    }

    // SVG footprint section: clear any stale parse error, then refresh
    svgParseError = '';
    syncSvgFootprintSection();
    updateDimensionLock();
    syncAllSliderFills();
    // Icon entries are loaded before buildInspectorPanel in the layer click handler,
    // so we only need to refresh the list if renderIconsListFn was just rebuilt.
    if (renderIconsListFn) renderIconsListFn();
}

/** Called when offset/elevation sliders change */
function onOffsetChange() {
    if (!isComplexShape) return;
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    markDirty();

    layer.offsetX       = parseFloat(offsetXInput.value);
    layer.offsetY       = parseFloat(offsetYInput.value);
    layer.baseElevation = selectedLayerIndex === 0 ? 0 : parseFloat(baseElevationInput.value);

    if (offsetXValueEl)       offsetXValueEl.textContent       = `${Math.round(layer.offsetX)} px`;
    if (offsetYValueEl)       offsetYValueEl.textContent       = `${Math.round(layer.offsetY)} px`;
    if (baseElevationValueEl) baseElevationValueEl.textContent = `${Math.round(layer.baseElevation)} px`;

    // Reposition the affected shape in-place (no full redraw needed)
    const { x: bx, y: by } = layerBasePos();
    const shape   = layerShapes[selectedLayerIndex];
    const shape2D = layerShapes2D[selectedLayerIndex];
    shape?.position(
        bx - layer.width  / 2 + layer.offsetX - layer.baseElevation,
        by - layer.height / 2 + layer.offsetY - layer.baseElevation
    );
    shape2D?.position(
        bx - layer.width  / 2 + layer.offsetX,
        by - layer.height / 2 + layer.offsetY
    );
    // Keep the composite centred regardless of per-layer offset/elevation.
    recenterCompositeShape();
}

function onAddLayer() {
    saveIconEntriesToLayer();
    editingIconIndex = -1;
    const edPopup = document.getElementById('nr-icon-editor-popup');
    if (edPopup) edPopup.style.display = 'none';
    const stackElevation = layers.reduce((sum, l) => sum + l.depth, 0);

    const newLayer: ShapeLayer = {
        id:            `layer-${Date.now()}`,
        name:          `Layer ${layers.length + 1}`,
        baseShape:     'cuboid',
        width:         2 * GRID_SIZE,
        height:        2 * GRID_SIZE,
        depth:         GRID_SIZE,
        offsetX:       0,
        offsetY:       0,
        baseElevation: stackElevation,
        style:         {},
        cornerRadius:  0,
    };
    layers.push(newLayer);
    selectedLayerIndex = layers.length - 1;
    selectedBaseShape = newLayer.baseShape;
    iconEntries = [];
    selectedIcon = null;
    selectedIconBgEnabled = false;
    renderLayersOnCanvas();
    buildLayersPanel();
    buildInspectorPanel();
    syncInspectorToLayer(selectedLayerIndex);
}

function onDeleteLayer(index: number) {
    if (layers.length <= 1) return;
    if (index === 0) return;
    saveIconEntriesToLayer();
    editingIconIndex = -1;
    const edPopup = document.getElementById('nr-icon-editor-popup');
    if (edPopup) edPopup.style.display = 'none';
    layers.splice(index, 1);
    if (selectedLayerIndex >= layers.length) selectedLayerIndex = layers.length - 1;
    if (iconLayerIndex    >= layers.length) iconLayerIndex    = 0;
    selectedBaseShape = layers[selectedLayerIndex]?.baseShape ?? 'cuboid';
    iconEntries = layers[selectedLayerIndex]?.icons?.map(e => ({ ...e })) ?? [];
    selectedIcon = null;
    selectedIconBgEnabled = false;
    renderLayersOnCanvas();
    buildLayersPanel();
    buildInspectorPanel();
    syncInspectorToLayer(selectedLayerIndex);
}

// "Up" in the list UI = higher array index = paints higher in the stack.
// Main layer (index 0) is anchored; neighbouring index 1 cannot swap with it.
function onMoveLayerUp(index: number) {
    if (index < 1) return;                 // main is immovable
    if (index >= layers.length - 1) return;
    [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
    if (selectedLayerIndex === index) selectedLayerIndex = index + 1;
    else if (selectedLayerIndex === index + 1) selectedLayerIndex = index;
    if (iconLayerIndex === index) iconLayerIndex = index + 1;
    else if (iconLayerIndex === index + 1) iconLayerIndex = index;
    renderLayersOnCanvas();
    buildLayersPanel();
    syncInspectorToLayer(selectedLayerIndex);
    refreshIconAccordionContent();
}

function onMoveLayerDown(index: number) {
    if (index <= 1) return;                // index 1 is just above main — no further down
    [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
    if (selectedLayerIndex === index) selectedLayerIndex = index - 1;
    else if (selectedLayerIndex === index - 1) selectedLayerIndex = index;
    if (iconLayerIndex === index) iconLayerIndex = index - 1;
    else if (iconLayerIndex === index - 1) iconLayerIndex = index;
    renderLayersOnCanvas();
    buildLayersPanel();
    syncInspectorToLayer(selectedLayerIndex);
    refreshIconAccordionContent();
}

function onDuplicateLayer(index: number) {
    const source = layers[index];
    const copy: ShapeLayer = {
        ...source,
        id:   `layer-${Date.now()}`,
        name: `${source.name} Copy`,
        style: { ...source.style },
    };
    layers.splice(index + 1, 0, copy);
    selectedLayerIndex = index + 1;
    renderLayersOnCanvas();
    buildLayersPanel();
    syncInspectorToLayer(selectedLayerIndex);
    refreshIconAccordionContent();
}

/**
 * Switch slider ranges between GU mode (simple shapes) and pixel mode (complex shapes).
 * Must be called before syncInspectorToLayer / syncFormFromShape so that the slider
 * min/max/step are correct when values are written.
 */
function updateSliderRangesForComplexMode(enabled: boolean) {
    if (!widthInput || !heightInput || !depthInput) return;
    if (enabled) {
        if (offsetXInput) {
            offsetXInput.min  = '-160'; offsetXInput.max  = '160'; offsetXInput.step = '1';
        }
        if (offsetYInput) {
            offsetYInput.min  = '-160'; offsetYInput.max  = '160'; offsetYInput.step = '1';
        }
        if (baseElevationInput) {
            baseElevationInput.min  = '0'; baseElevationInput.max  = '320'; baseElevationInput.step = '1';
        }
    }
}

function onComplexShapeToggle(enabled: boolean) {
    if (enabled) {
        // Read current single-shape dimensions from sliders (still in GU at this point)
        const w = parseFloat(widthInput?.value  ?? '40') || 40;
        const h = parseFloat(heightInput?.value ?? '40') || 40;
        const d = parseFloat(depthInput?.value  ?? '20') || 20;

        isComplexShape     = true;
        selectedLayerIndex = 0;
        layerShapes        = [];
        layerShapes2D      = [];
        const customVerts = selectedBaseShape === 'custom' && currentShape
            ? (currentShape.get('normalizedVerts') as [number, number][] | [number, number][][] | undefined)
            : undefined;
        const normVerts = customVerts
            ? (Array.isArray(customVerts[0]?.[0]) ? (customVerts as [number, number][][])[0] : customVerts as [number, number][])
            : undefined;

        layers = [{
            id:            'layer-1',
            name:          'Layer 1',
            baseShape:     selectedBaseShape,
            width:         w,
            height:        h,
            depth:         d,
            offsetX:       0,
            offsetY:       0,
            baseElevation: 0,
            style:         { ...selectedStyle },
            cornerRadius:  selectedCornerRadius,
            svgNormVerts:  normVerts,
            icons:         iconEntries.length > 0 ? iconEntries.map(e => ({ ...e })) : undefined,
        }];

        paper.removeTools();
        graph.clear();
        graph2D.clear();
        currentShape   = null;
        currentShape2D = null;

        updateSliderRangesForComplexMode(true);
        renderLayersOnCanvas();
        buildLayersPanel();
        showLayersPanel();
        if (positionAccordionLi)     positionAccordionLi.style.display     = '';
        if (svgFootprintAccordionLi) svgFootprintAccordionLi.style.display = '';
        if (iconBgNoBackgroundBtnEl) iconBgNoBackgroundBtnEl.style.display = '';
        if (iconBgCustomColorRowEl)  iconBgCustomColorRowEl.style.display  = '';
        updateAdaptiveToggleVisibility();
        syncInspectorToLayer(0);
    } else {
        // Revert to simple shape; restore Layer 1's properties to the sliders
        const layer1       = layers[0];
        isComplexShape     = false;
        layers             = [];
        layerShapes        = [];
        layerShapes2D      = [];
        selectedLayerIndex = 0;

        updateSliderRangesForComplexMode(false);

        if (layer1) {
            selectedBaseShape = layer1.baseShape;
            selectedStyle = {
                topColor:    layer1.style.topColor    ?? '',
                sideColor:   layer1.style.sideColor   ?? '',
                frontColor:  layer1.style.frontColor  ?? '',
                strokeColor: layer1.style.strokeColor ?? '',
            };
        }

        hideLayersPanel();
        if (positionAccordionLi)     positionAccordionLi.style.display     = 'none';
        if (svgFootprintAccordionLi) svgFootprintAccordionLi.style.display = 'none';
        if (iconBgNoBackgroundBtnEl) iconBgNoBackgroundBtnEl.style.display = '';
        if (iconBgCustomColorRowEl)  iconBgCustomColorRowEl.style.display  = '';
        updateAdaptiveToggleVisibility();

        // Rebuild the single-shape preview using Layer 1's dimensions
        const initWidth  = layer1?.width  ?? 2 * GRID_SIZE;
        const initHeight = layer1?.height ?? 2 * GRID_SIZE;
        const initDepth  = layer1?.depth  ?? GRID_SIZE;

        paper.removeTools();
        graph.clear();
        graph2D.clear();

        const factory = getPreviewFactory(currentShapeId, selectedBaseShape);
        if (!factory) return;

        const gridPx = CD_GRID_COUNT * GRID_SIZE;
        const posX = (gridPx - initWidth)  / 2;
        const posY = (gridPx - initHeight) / 2;

        const shape = factory();
        shape.resize(initWidth, initHeight);
        shape.set('isometricHeight',        initDepth);
        shape.set('defaultIsometricHeight', initDepth);
        shape.set('defaultSize',            { width: initWidth, height: initHeight });
        shape.position(posX, posY);
        shape.toggleView(View.Isometric);
        graph.addCell(shape);
        currentShape = shape;

        const shape2D = factory();
        shape2D.resize(initWidth, initHeight);
        shape2D.set('isometricHeight',        initDepth);
        shape2D.set('defaultIsometricHeight', initDepth);
        shape2D.set('defaultSize',            { width: initWidth, height: initHeight });
        shape2D.position(posX, posY);
        shape2D.toggleView(View.TwoDimensional);
        graph2D.addCell(shape2D);
        currentShape2D = shape2D;

        // Sync sliders back to Layer 1's values
        syncFormFromShape(shape);

        // Sync style
        if (selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor || selectedStyle.strokeColor) {
            applyShapeStyle(shape,   selectedStyle);
            applyShapeStyle(shape2D, selectedStyle);
        }
        if (colorPickerRef) {
            colorPickerRef.value = selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor || '#e0e0e0';
        }

        // Sync corner radius from Layer 1
        if (layer1?.cornerRadius !== undefined) {
            selectedCornerRadius = layer1.cornerRadius;
            if (cornerRadiusInput)   cornerRadiusInput.value   = String(selectedCornerRadius);
            if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = `${selectedCornerRadius} px`;
        }
        applyCornerRadiusToCurrentShape();

        // Sync form factor radio buttons
        inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-form-factor"]').forEach(r => {
            r.checked = r.value === selectedBaseShape;
        });
        syncFormFactorTiles();
        updateDimensionLock();

        applyIconToCurrentShape();
        svgParseError = '';
        syncSvgFootprintSection(); // hides the section now that isComplexShape is false
    }
    // Complex toggle changes the layer count visible to the user; refresh
    // the icon section so the "Apply icon to layer" dropdown appears/hides.
    refreshIconAccordionContent();
}

// ── Shape selector (palette panel) ────────────────────────────────────────────

const CDS_ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M12 4.7l-.7-.7L8 7.3 4.7 4l-.7.7L7.3 8 4 11.3l.7.7L8 8.7l3.3 3.3.7-.7L8.7 8z"/></svg>`;
const CDS_ICON_WARNING = `<svg class="cds--text-input__invalid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 1C4.2 1 1 4.2 1 8s3.2 7 7 7 7-3.1 7-7-3.1-7-7-7zm-.5 3h1v5h-1V4zm.5 8.2c-.4 0-.8-.4-.8-.8s.4-.8.8-.8.8.4.8.8-.4.8-.8.8z"/></svg>`;

function nameToId(name: string): string {
    let id = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!id) id = 'shape';
    let candidate = id;
    let n = 2;
    while (ShapeRegistry[candidate]) candidate = `${id}-${n++}`;
    return candidate;
}

function onCreateShape(name: string, componentType?: string) {
    const id = nameToId(name);
    addShape(id, {
        displayName: name,
        componentType,
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE * 0.5,
    });
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
    currentShapeId = id;
    buildPalettePanel();
    buildInspectorPanel();
    loadShapeIntoCanvas(id);
    syncEmptyState();
}

function onDuplicateShape(sourceId: string, newName: string) {
    const newId = nameToId(newName);
    const source = ShapeRegistry[sourceId];
    addShape(newId, {
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE * 0.5,
        ...(source ?? {}),
        displayName: newName,
    });
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
    currentShapeId = newId;
    buildPalettePanel();
    buildInspectorPanel();
    loadShapeIntoCanvas(newId);
    syncEmptyState();
}

function showDuplicateShapeModal(sourceId: string) {
    const sourceName = ShapeRegistry[sourceId]?.displayName ?? formatLabel(sourceId);

    const modalEl = document.createElement('div');
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-dup-modal-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';

    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-dup-modal-heading';
    headingEl.textContent = 'Duplicate Component';

    const closeBtnWrapper = document.createElement('div');
    closeBtnWrapper.className = 'cds--modal-close-button';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cds--modal-close';
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = CDS_ICON_CLOSE;
    closeBtn.addEventListener('click', () => modalEl.remove());
    closeBtnWrapper.appendChild(closeBtn);

    headerEl.appendChild(headingEl);
    headerEl.appendChild(closeBtnWrapper);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'cds--modal-content';

    const formItem = document.createElement('div');
    formItem.className = 'cds--form-item';

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'cds--text-input-wrapper';

    const label = document.createElement('label');
    label.className = 'cds--label';
    label.setAttribute('for', 'nr-dup-name-input');
    label.textContent = 'New Name';

    const outerWrapper = document.createElement('div');
    outerWrapper.className = 'cds--text-input__field-outer-wrapper';

    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'cds--text-input__field-wrapper';

    const nameInput = document.createElement('input');
    nameInput.id = 'nr-dup-name-input';
    nameInput.type = 'text';
    nameInput.className = 'cds--text-input';
    nameInput.value = `${sourceName} Copy`;

    const errorEl = document.createElement('div');
    errorEl.className = 'cds--form-requirement';
    errorEl.style.display = 'none';

    fieldWrapper.appendChild(nameInput);
    outerWrapper.appendChild(fieldWrapper);
    inputWrapper.appendChild(label);
    inputWrapper.appendChild(outerWrapper);
    inputWrapper.appendChild(errorEl);
    formItem.appendChild(inputWrapper);
    bodyEl.appendChild(formItem);

    const footerEl = document.createElement('div');
    footerEl.className = 'cds--modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cds--btn cds--btn--secondary';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => modalEl.remove());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'cds--btn cds--btn--primary';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Duplicate';
    confirmBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name.length < 1) {
            fieldWrapper.setAttribute('data-invalid', 'true');
            nameInput.className = 'cds--text-input cds--text-input--invalid';
            nameInput.setAttribute('aria-invalid', 'true');
            if (!fieldWrapper.querySelector('.cds--text-input__invalid-icon')) {
                fieldWrapper.insertAdjacentHTML('beforeend', CDS_ICON_WARNING);
            }
            errorEl.textContent = 'Please enter a name.';
            errorEl.style.display = '';
            nameInput.focus();
            return;
        }
        modalEl.remove();
        onDuplicateShape(sourceId, name);
    });

    nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') confirmBtn.click();
        if (e.key === 'Escape') modalEl.remove();
    });

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(confirmBtn);

    containerEl.appendChild(headerEl);
    containerEl.appendChild(bodyEl);
    containerEl.appendChild(footerEl);
    modalEl.appendChild(containerEl);
    document.body.appendChild(modalEl);

    modalEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === modalEl) modalEl.remove();
    });

    nameInput.select();
    nameInput.focus();
}

function showNewShapeModal() {
    const modalEl = document.createElement('div');
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-cd-modal-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';

    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-cd-modal-heading';
    headingEl.textContent = 'New Component';

    const closeBtnWrapper = document.createElement('div');
    closeBtnWrapper.className = 'cds--modal-close-button';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cds--modal-close';
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = CDS_ICON_CLOSE;
    closeBtn.addEventListener('click', () => modalEl.remove());
    closeBtnWrapper.appendChild(closeBtn);

    headerEl.appendChild(headingEl);
    headerEl.appendChild(closeBtnWrapper);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'cds--modal-content';

    const formItem = document.createElement('div');
    formItem.className = 'cds--form-item';

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'cds--text-input-wrapper';

    const label = document.createElement('label');
    label.className = 'cds--label';
    label.setAttribute('for', 'nr-cd-name-input');
    label.textContent = 'Component Name';

    const outerWrapper = document.createElement('div');
    outerWrapper.className = 'cds--text-input__field-outer-wrapper';

    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'cds--text-input__field-wrapper';

    const nameInput = document.createElement('input');
    nameInput.id = 'nr-cd-name-input';
    nameInput.type = 'text';
    nameInput.className = 'cds--text-input';
    nameInput.placeholder = 'e.g. Load Balancer';

    const errorEl = document.createElement('div');
    errorEl.className = 'cds--form-requirement';
    errorEl.style.display = 'none';

    fieldWrapper.appendChild(nameInput);
    outerWrapper.appendChild(fieldWrapper);
    inputWrapper.appendChild(label);
    inputWrapper.appendChild(outerWrapper);
    inputWrapper.appendChild(errorEl);
    formItem.appendChild(inputWrapper);
    bodyEl.appendChild(formItem);

    const footerEl = document.createElement('div');
    footerEl.className = 'cds--modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cds--btn cds--btn--secondary';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => modalEl.remove());

    const createBtn = document.createElement('button');
    createBtn.className = 'cds--btn cds--btn--primary';
    createBtn.type = 'button';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name.length < 1) {
            fieldWrapper.setAttribute('data-invalid', 'true');
            nameInput.className = 'cds--text-input cds--text-input--invalid';
            nameInput.setAttribute('aria-invalid', 'true');
            if (!fieldWrapper.querySelector('.cds--text-input__invalid-icon')) {
                fieldWrapper.insertAdjacentHTML('beforeend', CDS_ICON_WARNING);
            }
            errorEl.textContent = 'Please enter a name.';
            errorEl.style.display = '';
            nameInput.focus();
            return;
        }
        modalEl.remove();
        onCreateShape(name);
    });

    nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') createBtn.click();
        if (e.key === 'Escape') modalEl.remove();
    });

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(createBtn);

    containerEl.appendChild(headerEl);
    containerEl.appendChild(bodyEl);
    containerEl.appendChild(footerEl);
    modalEl.appendChild(containerEl);
    document.body.appendChild(modalEl);

    modalEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === modalEl) modalEl.remove();
    });

    nameInput.focus();
}

function cleanSvgForExport(clone: SVGSVGElement): void {
    clone.querySelectorAll('[data-grid], .joint-back-layer').forEach(el => el.remove());
    clone.querySelectorAll('.joint-port').forEach(el => el.remove());
    clone.querySelectorAll('image').forEach(img => {
        const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href) {
            img.setAttribute('href', href);
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
        }
    });
}

function rasterizeSvgToDataUri(href: string, width: number, height: number): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2;
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(href);
        img.src = href;
    });
}

async function inlineSvgImage(img: SVGImageElement, href: string): Promise<void> {
    const w = parseFloat(img.getAttribute('width') || '0');
    const h = parseFloat(img.getAttribute('height') || '0');
    if (href.startsWith('data:image/svg+xml') && w > 0 && h > 0) {
        const pngUri = await rasterizeSvgToDataUri(href, w, h);
        img.setAttribute('href', pngUri);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', pngUri);
    } else {
        img.setAttribute('href', href);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
    }
}

function showToast(message: string): void {
    const existing = document.querySelector('.nr-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'nr-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('nr-toast--visible'));
    setTimeout(() => {
        toast.classList.remove('nr-toast--visible');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

async function cloneShapeView(shape: IsometricShape): Promise<SVGGElement | null> {
    const view = paper.findViewByModel(shape);
    if (!view) return null;

    const liveEls = view.el.querySelectorAll('path, ellipse, rect, circle, polygon, line');
    const computedColors: Array<{ fill: string; stroke: string }> = [];
    liveEls.forEach(el => {
        const cs = window.getComputedStyle(el);
        computedColors.push({ fill: cs.fill, stroke: cs.stroke });
    });

    const shapeEl = view.el.cloneNode(true) as SVGGElement;

    const cloneEls = shapeEl.querySelectorAll('path, ellipse, rect, circle, polygon, line');
    cloneEls.forEach((el, i) => {
        if (computedColors[i]) {
            const { fill, stroke } = computedColors[i];
            if (fill && fill !== 'none') el.setAttribute('fill', fill);
            if (stroke && stroke !== 'none') el.setAttribute('stroke', stroke);
        }
    });

    shapeEl.querySelectorAll('.joint-port').forEach(el => el.remove());
    shapeEl.querySelectorAll('[joint-selector="label"]').forEach(el => el.remove());
    shapeEl.querySelectorAll('[display="none"]').forEach(el => el.remove());
    shapeEl.querySelectorAll('path').forEach(p => {
        const d = p.getAttribute('d') ?? '';
        if (!d || d === 'M 0 0') p.remove();
    });
    const images = Array.from(shapeEl.querySelectorAll('image'));
    for (const img of images) {
        const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        const w = parseFloat(img.getAttribute('width') || '0');
        const h = parseFloat(img.getAttribute('height') || '0');
        if (!href || w === 0 || h === 0) { img.remove(); continue; }
        await inlineSvgImage(img as SVGImageElement, href);
    }

    return shapeEl;
}

async function buildShapeSvgString(): Promise<string | null> {
    const shapes = isComplexShape ? layerShapes : (currentShape ? [currentShape] : []);
    if (shapes.length === 0) return null;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const mx = paper.matrix();
    const wrapper = document.createElementNS(ns, 'g');
    wrapper.setAttribute('transform',
        `matrix(${mx.a},${mx.b},${mx.c},${mx.d},0,0)`);

    for (const shape of shapes) {
        const el = await cloneShapeView(shape);
        if (!el) continue;
        el.removeAttribute('transform');
        const pos = shape.position();
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
        g.appendChild(el);
        wrapper.appendChild(g);
    }

    svg.appendChild(wrapper);

    svg.style.cssText = 'position:absolute;left:-9999px;top:-9999px;overflow:visible';
    svg.setAttribute('width', '4000');
    svg.setAttribute('height', '4000');
    document.body.appendChild(svg);
    const bbox = svg.getBBox();
    document.body.removeChild(svg);

    if (bbox.width === 0 || bbox.height === 0) return null;

    const pad = 8;
    svg.setAttribute('viewBox',
        `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    svg.setAttribute('width', String(Math.ceil(bbox.width + pad * 2)));
    svg.setAttribute('height', String(Math.ceil(bbox.height + pad * 2)));
    svg.removeAttribute('style');

    return new XMLSerializer().serializeToString(svg);
}

async function exportShapeSvg(): Promise<void> {
    const svgString = await buildShapeSvgString();
    if (!svgString) return;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const displayName = ShapeRegistry[currentShapeId]?.displayName ?? currentShapeId;
    const filename = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.svg';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showDeleteConfirmModal(id: string) {
    const displayName = ShapeRegistry[id]?.displayName ?? id;

    const modalEl = document.createElement('div');
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-del-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';

    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-del-heading';
    headingEl.textContent = 'Delete Component';

    const closeBtnWrapper = document.createElement('div');
    closeBtnWrapper.className = 'cds--modal-close-button';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cds--modal-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = CDS_ICON_CLOSE;
    closeBtn.addEventListener('click', () => modalEl.remove());
    closeBtnWrapper.appendChild(closeBtn);

    headerEl.appendChild(headingEl);
    headerEl.appendChild(closeBtnWrapper);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'cds--modal-content';

    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:0.875rem;line-height:1.5;margin:0;';
    msg.innerHTML = `Delete <strong>${displayName}</strong>?<br><br>This component will be permanently removed from the registry. This action cannot be undone.`;
    bodyEl.appendChild(msg);

    // Footer
    const footerEl = document.createElement('div');
    footerEl.className = 'cds--modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cds--btn cds--btn--secondary';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => modalEl.remove());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'cds--btn cds--btn--danger';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Delete';
    confirmBtn.addEventListener('click', () => {
        modalEl.remove();
        onDeleteShape(id);
    });

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(confirmBtn);

    containerEl.appendChild(headerEl);
    containerEl.appendChild(bodyEl);
    containerEl.appendChild(footerEl);
    modalEl.appendChild(containerEl);
    document.body.appendChild(modalEl);

    // Close on backdrop click
    modalEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === modalEl) modalEl.remove();
    });

    // Keyboard: Escape closes, Enter confirms
    modalEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') modalEl.remove();
    });

    cancelBtn.focus();
}

function onDeleteShape(id: string) {
    deleteShape(id);
    shapeStore.remove('general', id);
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));

    currentShapeId = '';
    paper.removeTools();
    graph.clear();
    graph2D.clear();
    currentShape = null;
    currentShape2D = null;

    buildInspectorPanel();
    buildPalettePanel();
    syncEmptyState();
}


let componentPanelHandle: { rebuild: () => void } | null = null;

function buildPalettePanel() {
    paletteEl.innerHTML = '';

    const generalIds = new Set(shapeStore.list('general').map(s => s.id));
    const allGeneral = shapeStore.list('general');

    const byCollection = new Map<string, typeof allGeneral>();
    for (const stored of allGeneral) {
        const col = stored.definition.collection || 'General';
        if (!byCollection.has(col)) byCollection.set(col, []);
        byCollection.get(col)!.push(stored);
    }

    const userIds = Object.keys(ShapeRegistry).filter(id => !BUILT_IN_SHAPE_IDS.has(id) && !generalIds.has(id));

    const items: ComponentTreeItem[] = [];

    for (const id of userIds) {
        const def = ShapeRegistry[id];
        const iconEntry = def?.icon ? getIconById(def.icon) : undefined;
        const isV = iconEntry && (iconEntry.source === 'aws' || iconEntry.source === 'gcp' || iconEntry.source === 'azure');
        items.push({
            id,
            label: def?.displayName ?? formatLabel(id),
            iconSvg: iconEntry?.svg,
            iconSvgMono: isV ? iconEntry.svgMono : undefined,
            iconBgColor: isV ? iconEntry.bgColor : undefined,
            iconIsVendor: !!isV,
            collection: 'User Components',
        });
    }

    for (const collectionName of getComponentCollections()) {
        for (const s of (byCollection.get(collectionName) ?? [])) {
            const iconEntry = s.definition.icon ? getIconById(s.definition.icon) : undefined;
            const isV = iconEntry && (iconEntry.source === 'aws' || iconEntry.source === 'gcp' || iconEntry.source === 'azure');
            items.push({
                id: s.id,
                label: s.definition.displayName ?? formatLabel(s.id),
                iconSvg: iconEntry?.svg,
                iconSvgMono: isV ? iconEntry.svgMono : undefined,
                iconBgColor: isV ? iconEntry.bgColor : undefined,
                iconIsVendor: !!isV,
                collection: collectionName,
                data: s.definition,
            });
        }
    }

    const selectShape_ = (id: string, data?: unknown) => {
        const def = data as ShapeDefinition | undefined;
        if (def && !ShapeRegistry[id]) addShape(id, { ...def });
        paletteEl.querySelectorAll<HTMLButtonElement>('.nr-comp-tree__row--leaf, .nr-palette-svg-card').forEach(b => {
            const isMatch = b.dataset.shapeId === id;
            b.classList.toggle('nr-comp-tree__row--selected', isMatch);
            b.classList.toggle('nr-palette-svg-card--selected', isMatch);
        });
        currentShapeId = id;
        hasVariations = !!ShapeRegistry[id]?.hasVariations;
        activeVariation = 'default';
        buildInspectorPanel();
        loadShapeIntoCanvas(id);
        syncEmptyState();
    };

    componentPanelHandle = buildComponentPanel(paletteEl, {
        items,
        onSelect: selectShape_,
        selectedId: () => currentShapeId,
        showCreateButton: true,
        onCreateClick: showNewShapeModal,
    });
}

// ── Canvas shape loading ───────────────────────────────────────────────────────

function loadShapeIntoCanvas(id: string) {
    paper.removeTools();
    graph.clear();
    graph2D.clear();
    currentShape   = null;
    currentShape2D = null;
    layerShapes    = [];
    layerShapes2D  = [];
    currentZoom = 1;
    paper.matrix(transformationMatrix(View.Isometric, CD_MARGIN, SIDEBAR_INSET, CD_GRID_COUNT));

    const savedDefaults = ShapeRegistry[id];
    const displayName   = savedDefaults?.displayName ?? formatLabel(id);
    if (shapeNameInput) shapeNameInput.value = displayName;

    // Restore icon/style/baseShape fields (common to both simple and complex paths)
    syncExtrasFromShape(id);
    syncIconBgColorDisplay();
    // Refresh icon list and close any open editor popup
    editingIconIndex = -1;
    const edPopup = document.getElementById('nr-icon-editor-popup');
    if (edPopup) edPopup.style.display = 'none';
    if (renderIconsListFn) renderIconsListFn();

    // Sync the complex toggle state in the inspector (it persists across palette switches)
    // #sd-complex-toggle is now a <button> inside an .nr-toggle wrapper div.
    const complexToggleBtn = inspectorEl.querySelector<HTMLButtonElement>('#sd-complex-toggle');
    const complexToggleDiv = complexToggleBtn?.closest<HTMLElement>('.nr-toggle') ?? null;

    selectedCornerRadius = savedDefaults?.cornerRadius ?? 0;
    selectedChamferSize  = savedDefaults?.chamferSize ?? 0;
    selectedChamferStart = savedDefaults?.chamferStart ?? 0;

    // Sync 3D modifier sliders with loaded values
    if (taperInput) { taperInput.value = String(selectedTaper); taperValueEl.textContent = selectedTaper.toFixed(2); }
    if (twistInput) { twistInput.value = String(selectedTwist); twistValueEl.textContent = `${selectedTwist}°`; }
    if (stxInput) { stxInput.value = String(selectedScaleTopX); stxValueEl.textContent = selectedScaleTopX.toFixed(2); }
    if (styInput) { styInput.value = String(selectedScaleTopY); styValueEl.textContent = selectedScaleTopY.toFixed(2); }

    if (savedDefaults?.complexShape && savedDefaults.layers?.length) {
        // ── Complex shape path ─────────────────────────────────────────────────
        isComplexShape     = true;
        layers             = savedDefaults.layers.map(l => ({ ...l, style: { ...l.style } }));
        selectedLayerIndex = 0;

        iconEntries = layers[0]?.icons?.map(e => ({ ...e })) ?? [];

        if (complexToggleDiv) complexToggleDiv.classList.add('nr-toggle--checked');
        if (complexToggleBtn) complexToggleBtn.setAttribute('aria-checked', 'true');
        if (positionAccordionLi)     positionAccordionLi.style.display     = '';
        if (svgFootprintAccordionLi) svgFootprintAccordionLi.style.display = '';
        if (iconBgNoBackgroundBtnEl) iconBgNoBackgroundBtnEl.style.display = '';
        if (iconBgCustomColorRowEl)  iconBgCustomColorRowEl.style.display  = '';

        updateSliderRangesForComplexMode(true);
        renderLayersOnCanvas();
        // Label lives only on Layer 1 (layerShapes[0]); other layers stay unlabelled.
        layerShapes[0]?.attr('label/text', displayName);
        layerShapes2D[0]?.attr('label/text', displayName);
        buildLayersPanel();
        showLayersPanel();
        syncInspectorToLayer(0);
    } else {
        // ── Simple shape path (original logic) ────────────────────────────────
        isComplexShape     = false;
        layers             = [];

        updateSliderRangesForComplexMode(false);
        if (complexToggleDiv) complexToggleDiv.classList.remove('nr-toggle--checked');
        if (complexToggleBtn) complexToggleBtn.setAttribute('aria-checked', 'false');
        if (positionAccordionLi)     positionAccordionLi.style.display     = 'none';
        if (svgFootprintAccordionLi) svgFootprintAccordionLi.style.display = 'none';
        if (iconBgNoBackgroundBtnEl) iconBgNoBackgroundBtnEl.style.display = '';
        if (iconBgCustomColorRowEl)  iconBgCustomColorRowEl.style.display  = '';
        updateAdaptiveToggleVisibility();
        hideLayersPanel();

        const savedBaseShape = savedDefaults?.baseShape ?? BASE_SHAPE_BY_ID[id] ?? 'cuboid';
        const factory = getPreviewFactory(id, savedBaseShape);
        if (!factory) return;

        const FALLBACK_GU = 2 * GRID_SIZE;
        const initWidth  = savedDefaults?.defaultSize?.width     ?? FALLBACK_GU;
        const initHeight = savedDefaults?.defaultSize?.height    ?? FALLBACK_GU;
        const initDepth  = savedDefaults?.defaultIsometricHeight ?? FALLBACK_GU;

        const gridPx = CD_GRID_COUNT * GRID_SIZE;
        const posX = (gridPx - initWidth)  / 2;
        const posY = (gridPx - initHeight) / 2;

        const shape = factory();
        shape.resize(initWidth, initHeight);
        shape.set('isometricHeight',        initDepth);
        shape.set('defaultIsometricHeight', initDepth);
        shape.set('defaultSize',            { width: initWidth, height: initHeight });
        shape.set('cornerRadius', selectedCornerRadius);
        shape.set('chamferSize', selectedChamferSize);
        shape.set('chamferStart', selectedChamferStart);
        shape.set('taper', selectedTaper);
        shape.set('twist', selectedTwist);
        shape.set('scaleTopX', selectedScaleTopX);
        shape.set('scaleTopY', selectedScaleTopY);
        if (savedDefaults?.customVerts) shape.set('normalizedVerts', savedDefaults.customVerts);
        shape.attr('label/text', displayName);
        shape.position(posX, posY);
        shape.toggleView(View.Isometric);
        graph.addCell(shape);
        currentShape = shape;

        const shape2D = factory();
        shape2D.resize(initWidth, initHeight);
        shape2D.set('isometricHeight',        initDepth);
        shape2D.set('defaultIsometricHeight', initDepth);
        shape2D.set('defaultSize',            { width: initWidth, height: initHeight });
        shape2D.set('cornerRadius', selectedCornerRadius);
        shape2D.set('chamferSize', selectedChamferSize);
        shape2D.set('chamferStart', selectedChamferStart);
        shape2D.set('taper', selectedTaper);
        shape2D.set('twist', selectedTwist);
        shape2D.set('scaleTopX', selectedScaleTopX);
        shape2D.set('scaleTopY', selectedScaleTopY);
        if (savedDefaults?.customVerts) shape2D.set('normalizedVerts', savedDefaults.customVerts);
        shape2D.attr('label/text', displayName);
        shape2D.position(posX, posY);
        shape2D.toggleView(View.TwoDimensional);
        graph2D.addCell(shape2D);
        currentShape2D = shape2D;

        syncAllInspectorFields();

        if (selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor || selectedStyle.strokeColor) {
            applyShapeStyle(shape,   selectedStyle);
            applyShapeStyle(shape2D, selectedStyle);
        }

        applyCornerRadiusToCurrentShape();
        applyChamferSizeToCurrentShape();

        // Force re-render so both modifiers are reflected in the initial paint.
        if (currentShape) {
            const { width, height } = currentShape.size();
            currentShape.resize(width, height);
        }
        if (currentShape2D) {
            const { width, height } = currentShape2D.size();
            currentShape2D.resize(width, height);
        }

        applyIconToCurrentShape();
    }

    // Show resize handle for adjustable shapes
    updateResizeTools();

    // Refresh the icon section's layer dropdown to match the loaded shape.
    refreshIconAccordionContent();
}

// ── Paper element events ───────────────────────────────────────────────────────

// Re-attach tools if the user clicks the shape after panning the canvas.
// In complex shape mode, canvas shapes are not individually selectable —
// layer selection is managed exclusively through the Layers panel.
paper.on('element:pointerup', (elementView: dia.ElementView) => {
    if (isComplexShape) return;
    currentShape = elementView.model as IsometricShape;
});

// ── Exported panel shim ────────────────────────────────────────────────────────
// index.ts calls cdPanel.hide() when switching back to the System Designer.

export const panel = {
    hide: () => {
        const p = document.getElementById('nr-icon-editor-popup');
        if (p) p.style.display = 'none';
    },
    resetSelection: () => {
        currentShapeId = '';
        paper.removeTools();
        graph.clear();
        graph2D.clear();
        currentShape = null;
        currentShape2D = null;
        buildInspectorPanel();
        buildPalettePanel();
        syncEmptyState();
    },
};

export function selectShape(id: string): void {
    if (!ShapeRegistry[id]) return;
    currentShapeId = id;
    hasVariations = !!ShapeRegistry[id]?.hasVariations;
    activeVariation = 'default';
    buildPalettePanel();
    buildInspectorPanel();
    loadShapeIntoCanvas(id);
    syncEmptyState();
}

function syncEmptyState(): void {
    const el = document.getElementById('cd2-empty-state');
    if (el) el.style.display = currentShapeId ? 'none' : '';
    const vtEl = document.getElementById('cd2-view-toggle-container');
    if (vtEl) vtEl.style.display = currentShapeId ? '' : 'none';
}

// ── Initialise ────────────────────────────────────────────────────────────────

buildInspectorPanel();
buildPalettePanel();
if (currentShapeId) loadShapeIntoCanvas(currentShapeId);
syncEmptyState();
