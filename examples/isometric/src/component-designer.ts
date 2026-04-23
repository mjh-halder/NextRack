import { dia, V } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { cellNamespace } from './shapes';
import { Link } from './shapes/link/link';
import { SHAPE_FACTORIES, BASE_SHAPE_BY_ID, FORM_FACTOR_PREVIEWS, getPreviewFactory } from './shapes/shape-factories';
import { drawGrid, switchView, transformationMatrix, applyShapeStyle } from './utils';
import { SvgPolygonShape } from './shapes/svgpolygon/svg-polygon-shape';
import { parseSvgFootprint } from './svg-footprint';
import { GRID_SIZE, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE, MIN_ZOOM, MAX_ZOOM } from './theme';

// Component designer uses a fixed 10×10 GU grid, independent of the system designer.
const CD_GRID_COUNT = 10;
import { ShapeRegistry, BUILT_IN_SHAPE_IDS, updateShapeDefinition, deleteShape, addShape, saveRegistryToStorage, ShapeLayer } from './shapes/shape-registry';
import { BaseShape } from './shapes/shape-definition';
import { PRIMARY_COLORS } from './colors';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import ChevronUp16 from '@carbon/icons/es/chevron--up/16.js';
import ChevronDown16 from '@carbon/icons/es/chevron--down/16.js';
import OverflowMenuVertical16 from '@carbon/icons/es/overflow-menu--vertical/16.js';
import { getIconById, addUploadedIcon, removeUploadedIcon } from './icon-catalog';
import { getVisibleIcons } from './icon-config';
import { shapeStore } from './shape-store';
import { getComponentCollections } from './admin';

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

function formatLabel(id: string): string {
    return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const SIDEBAR_INSET = 0;
let currentShape: IsometricShape | null = null;
let currentShape2D: IsometricShape | null = null;
let currentShapeId: string = Object.keys(ShapeRegistry).find(id => !BUILT_IN_SHAPE_IDS.has(id)) || '';
let currentZoom  = 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gridVEl: any = null;

// Non-dimension template state (form factor, icon, style)
let selectedBaseShape: BaseShape = (BASE_SHAPE_BY_ID[currentShapeId] || 'cuboid') as BaseShape;
let selectedIcon: string | null = null;
let selectedIconFace: 'top' | 'front' = 'top';
let selectedIconSize = 1; // grid units; 1 GU = GRID_SIZE px
let selectedStyle = { topColor: '', sideColor: '', frontColor: '', strokeColor: '' };

// Corner radius state (not persisted to registry; only applies to polygon shapes)
let selectedCornerRadius = 0; // pixels

// Chamfer state (not persisted to registry; only applies to cuboid shapes)
let selectedChamferSize = 0; // pixels

// SVG footprint state (complex shape mode only)
let svgParseError = '';

// Icon background state (not persisted to registry)
let selectedIconBgEnabled = true;
let selectedIconBgColor = PRIMARY_COLORS[0].base; // Grey 70 by default
let selectedIconBgShape: 'circle' | 'square' | 'octagon' = 'circle';
let selectedIconBgRadius = 6;

// Direct references to the swatch buttons so syncExtrasFromShape can update
// them without relying on a DOM query that could match unrelated elements.
let iconBgSwatchRefs: Array<{ btn: HTMLElement; colorBase: string }> = [];

// ── Complex Shape state ────────────────────────────────────────────────────────
let isComplexShape = false;
let layers: ShapeLayer[] = [];
let selectedLayerIndex = 0;
let layerShapes: IsometricShape[]   = [];  // ISO canvas shapes, one per layer
let layerShapes2D: IsometricShape[] = [];  // 2D canvas shapes, one per layer

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

// ── Zoom ─────────────────────────────────────────────────────────────────────

function applyWheelZoom(evt: dia.Event, x: number, y: number, delta: number) {
    evt.preventDefault();
    const clampedDelta = Math.sign(delta) * Math.min(Math.abs(delta), 1);
    const step = clampedDelta > 0 ? 1.02 : 1 / 1.02;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * step));
    if (newZoom === currentZoom) return;
    const factor = newZoom / currentZoom;
    currentZoom = newZoom;
    const mx = paper.matrix();
    const sx = mx.a * x + mx.c * y + mx.e;
    const sy = mx.b * x + mx.d * y + mx.f;
    paper.matrix(
        V.createSVGMatrix()
            .translate(sx, sy)
            .scale(factor)
            .translate(-sx, -sy)
            .multiply(mx)
    );
}

paper.on('blank:mousewheel', (evt: dia.Event, x: number, y: number, delta: number) => {
    applyWheelZoom(evt, x, y, delta);
});
paper.on('cell:mousewheel', (_cellView: dia.CellView, evt: dia.Event, x: number, y: number, delta: number) => {
    applyWheelZoom(evt, x, y, delta);
});

// ── Fixed view matrices ───────────────────────────────────────────────────────
// ISO paper is always isometric; 2D paper is always in 2D mode.
// The ViewToggle is hidden; dual-view replaces it.

switchView(paper, View.Isometric, null, SIDEBAR_INSET, CD_GRID_COUNT);
paper2D.matrix(transformationMatrix(View.TwoDimensional, CD_MARGIN, 0, CD_GRID_COUNT));

// ── Template panel ────────────────────────────────────────────────────────────

let shapeNameInput: HTMLInputElement;
let componentTypeSelect: HTMLSelectElement;
let widthInput:   HTMLInputElement;
let heightInput:  HTMLInputElement;
let depthInput:   HTMLInputElement;
let widthValueEl:  HTMLElement;
let heightValueEl: HTMLElement;
let depthValueEl:  HTMLElement;
let cornerRadiusInput:  HTMLInputElement;
let cornerRadiusValueEl: HTMLElement;
let cornerRadiusRowEl:  HTMLElement;
let modifiersSvgInfoEl: HTMLElement | null = null;
let modifiersAccordionLi: HTMLLIElement | null = null;
let chamferSizeInput:   HTMLInputElement;
let chamferSizeValueEl: HTMLElement;
let chamferRowEl:       HTMLElement;
let iconFaceRowEl:      HTMLElement;

const CDS_ICON_TRASH      = carbonIconToString(TrashCan16 as CarbonIcon);
const CDS_ICON_COPY       = carbonIconToString(Copy16 as CarbonIcon);
const CDS_ICON_CHEVRON_UP   = carbonIconToString(ChevronUp16 as CarbonIcon);
const CDS_ICON_CHEVRON_DOWN = carbonIconToString(ChevronDown16 as CarbonIcon);
const CDS_ICON_OVERFLOW     = carbonIconToString(OverflowMenuVertical16 as CarbonIcon);

const CDS_ACCORDION_ARROW = `<svg focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" class="cds--accordion__arrow"><path d="M11 8L6 13 5.3 12.3 9.6 8 5.3 3.7 6 3z"></path></svg>`;

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
    container: HTMLElement
) {
    const sliderRow = document.createElement('div');
    sliderRow.className = 'nr-sd-slider-row';

    const labelRow = document.createElement('div');
    labelRow.className = 'nr-sd-slider-label-row';

    const lbl = document.createElement('label');
    lbl.className = 'cds--label';
    lbl.setAttribute('for', id);
    lbl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'nr-sd-slider-value';
    valueEl.id = `${id}-value`;
    assignValue(valueEl);

    labelRow.appendChild(lbl);
    labelRow.appendChild(valueEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = id;
    slider.className = 'nr-sd-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    assignInput(slider);
    setSliderFill(slider); // set initial fill after value is assigned
    slider.addEventListener('input', () => {
        setSliderFill(slider);
        // In complex shape mode the dimension sliders work in pixels, not grid units.
        if (isComplexShape) {
            valueEl.textContent = `${Math.round(parseFloat(slider.value))} px`;
        } else {
            valueEl.textContent = `${parseFloat(slider.value).toFixed(1)} GU`;
        }
        onChange();
    });

    sliderRow.appendChild(labelRow);
    sliderRow.appendChild(slider);
    container.appendChild(sliderRow);
}

function buildDimensionsContent(container: HTMLElement) {
    buildSliderField('Width',  'sd-width',  0.5, 8, 0.5,
        (el) => { widthInput  = el; el.value = '2'; },
        (el) => { widthValueEl  = el; el.textContent = '2.0 GU'; },
        onFieldChange, container);
    buildSliderField('Height', 'sd-height', 0.5, 8, 0.5,
        (el) => { heightInput = el; el.value = '2'; },
        (el) => { heightValueEl = el; el.textContent = '2.0 GU'; },
        onFieldChange, container);
    buildSliderField('Depth',  'sd-depth',  0,   8, 0.5,
        (el) => { depthInput  = el; el.value = '2'; },
        (el) => { depthValueEl  = el; el.textContent = '2.0 GU'; },
        onFieldChange, container);
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

    // Corner radius — only for cuboid shapes.
    const crRow = document.createElement('div');
    cornerRadiusRowEl = crRow;
    crRow.style.display = supportsCornerRadius(selectedBaseShape) ? '' : 'none';
    buildSliderField('Corner Radius', 'sd-corner-radius', 0, 30, 1,
        (el) => { cornerRadiusInput = el; el.value = String(selectedCornerRadius); },
        (el) => { cornerRadiusValueEl = el; el.textContent = `${selectedCornerRadius} px`; },
        () => {
            selectedCornerRadius = parseInt(cornerRadiusInput.value, 10);
            cornerRadiusValueEl.textContent = `${selectedCornerRadius} px`;
            applyCornerRadiusToCurrentShape();
        },
        crRow);
    container.appendChild(crRow);

    // Chamfer — bevels the top face corners; side faces adapt to the chamfered top edges.
    const chRow = document.createElement('div');
    chamferRowEl = chRow;
    chRow.style.display = supportsCornerRadius(selectedBaseShape) ? '' : 'none';
    buildSliderField('Chamfer', 'sd-chamfer', 0, 30, 1,
        (el) => { chamferSizeInput = el; el.value = String(selectedChamferSize); },
        (el) => { chamferSizeValueEl = el; el.textContent = `${selectedChamferSize} px`; },
        () => {
            selectedChamferSize = parseInt(chamferSizeInput.value, 10);
            chamferSizeValueEl.textContent = `${selectedChamferSize} px`;
            applyChamferSizeToCurrentShape();
        },
        chRow);
    container.appendChild(chRow);
}

function buildPositionContent(container: HTMLElement) {
    buildSliderField('Offset X', 'sd-offset-x', -8, 8, 0.5,
        (el) => { offsetXInput = el; el.value = '0'; },
        (el) => { offsetXValueEl = el; el.textContent = '0.0 GU'; },
        onOffsetChange, container);
    buildSliderField('Offset Y', 'sd-offset-y', -8, 8, 0.5,
        (el) => { offsetYInput = el; el.value = '0'; },
        (el) => { offsetYValueEl = el; el.textContent = '0.0 GU'; },
        onOffsetChange, container);
    buildSliderField('Elevation', 'sd-base-elevation', 0, 16, 0.5,
        (el) => { baseElevationInput = el; el.value = '0'; },
        (el) => { baseElevationValueEl = el; el.textContent = '0.0 GU'; },
        onOffsetChange, container);
}

// Compact 2D preview thumbnails for the form-factor picker.
// Match the "selectable tile" interaction used by the icon background colour picker
// (same nr-sd-swatch-* classes). All preview outlines use currentColor so they
// adapt to light/dark mode.
const FORM_FACTOR_PREVIEWS_SVG: Record<string, string> = {
    cuboid:    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`,
    cylinder:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12a7 2.5 0 0 0 14 0V6"/></svg>`,
    pyramid:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="12,4 20,20 4,20"/></svg>`,
    hexagonal: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="8,4 16,4 20,12 16,20 8,20 4,12"/></svg>`,
    octagon:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="8,4 16,4 20,8 20,16 16,20 8,20 4,16 4,8"/></svg>`,
};

function buildFormFactorContent(container: HTMLElement) {
    // proportional-cuboid is not listed here: it is a resize behavior (aspect-ratio lock),
    // not a distinct geometry. Hexagonal and Octagon use it internally.
    const options: { value: BaseShape; label: string }[] = [
        { value: 'cuboid',      label: 'Cube' },
        { value: 'cylinder',    label: 'Cylinder' },
        { value: 'pyramid',     label: 'Pyramid' },
        { value: 'hexagonal',   label: 'Hexagonal' },
        { value: 'octagon',     label: 'Octagon' },
    ];

    const tileRow = document.createElement('div');
    tileRow.className = 'nr-sd-swatch-row nr-sd-formfactor-row';

    const tiles: Array<{ btn: HTMLButtonElement; value: BaseShape }> = [];

    const setSelected = (value: BaseShape) => {
        for (const { btn, value: v } of tiles) {
            btn.classList.toggle('nr-sd-swatch-btn--selected', v === value);
            btn.setAttribute('aria-pressed', String(v === value));
        }
    };

    for (const opt of options) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-sd-swatch-btn nr-sd-formfactor-tile';
        btn.setAttribute('title', opt.label);
        btn.setAttribute('aria-label', opt.label);
        btn.setAttribute('aria-pressed', String(opt.value === selectedBaseShape));
        if (opt.value === selectedBaseShape) btn.classList.add('nr-sd-swatch-btn--selected');
        btn.innerHTML = FORM_FACTOR_PREVIEWS_SVG[opt.value] ?? '';
        // Keep the hidden radio input so existing sync logic that queries
        // `input[name="sd-form-factor"]` continues to find a checked option.
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'sd-form-factor';
        input.value = opt.value;
        input.hidden = true;
        input.checked = opt.value === selectedBaseShape;
        btn.appendChild(input);

        btn.addEventListener('click', () => {
            selectedBaseShape = opt.value;
            setSelected(opt.value);
            // Mirror into hidden radios so any code reading them stays in sync.
            tileRow.querySelectorAll<HTMLInputElement>('input[name="sd-form-factor"]').forEach(r => {
                r.checked = r.value === opt.value;
            });
            applyFormFactorToCanvas();
        });

        tiles.push({ btn, value: opt.value });
        tileRow.appendChild(btn);
    }

    container.appendChild(tileRow);
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

// Generates a composite SVG: colored background shape with icon SVG centered inside.
function buildCompositeIconSvg(iconSvg: string, bgColor: string | null, bgShape: 'circle' | 'square' | 'octagon', applyWhiteFilter = true, bgRadius = 6): string {
    const S = 64;
    const pad = 13; // ~20% inset on each side
    const iconInner = S - 2 * pad;
    let bgEl = '';
    if (bgColor !== null) {
        if (bgShape === 'circle') {
            bgEl = `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="${bgColor}"/>`;
        } else if (bgShape === 'octagon') {
            // Regular octagon inscribed in S×S with ~18% clip on each corner
            const c = Math.round(S * 0.18);
            bgEl = `<polygon points="${c},0 ${S - c},0 ${S},${c} ${S},${S - c} ${S - c},${S} ${c},${S} 0,${S - c} 0,${c}" fill="${bgColor}"/>`;
        } else {
            bgEl = `<rect width="${S}" height="${S}" rx="${bgRadius}" fill="${bgColor}"/>`;
        }
    }
    const iconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`;
    // White-tint: feColorMatrix maps every non-transparent pixel to white while preserving alpha.
    // Skipped in adaptive mode — the CSS class nr-icon-adaptive handles coloring instead.
    const filterDefs = applyWhiteFilter
        ? `<defs><filter id="nr-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs>`
        : '';
    const filterAttr = applyWhiteFilter ? ' filter="url(#nr-white)"' : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${filterDefs}${bgEl}<image href="${iconHref}" x="${pad}" y="${pad}" width="${iconInner}" height="${iconInner}"${filterAttr}/></svg>`;
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

function applyIconToCurrentShape() {
    // In complex shape mode the icon is rendered on a user-chosen layer
    // (defaults to the main layer). Clamp the index in case layers were
    // removed since it was last set, and wipe the icon from every other
    // layer so moving the target never leaves a stale copy behind.
    const clampedIdx = isComplexShape
        ? Math.min(Math.max(0, iconLayerIndex), Math.max(0, layerShapes.length - 1))
        : 0;
    if (isComplexShape) {
        const noIconAttrs = {
            topIcon:   { href: '', width: 0, height: 0 },
            topIcon2D: { href: '', width: 0, height: 0 },
        };
        for (let i = 0; i < layerShapes.length; i++) {
            if (i === clampedIdx) continue;
            layerShapes[i]?.attr(noIconAttrs);
            layerShapes2D[i]?.attr(noIconAttrs);
        }
    }
    const iconShape   = isComplexShape ? (layerShapes[clampedIdx]   ?? null) : currentShape;
    const iconShape2D = isComplexShape ? (layerShapes2D[clampedIdx] ?? null) : currentShape2D;
    if (!iconShape) return;

    const icon = selectedIcon ? getIconById(selectedIcon) : undefined;
    if (!icon) {
        // Zero size hides the image without touching display — group selectors
        // (iso / 2d) must remain the sole controllers of element visibility.
        const noIconAttrs = {
            topIcon:   { href: '', width: 0, height: 0 },
            topIcon2D: { href: '', width: 0, height: 0 },
        };
        iconShape.attr(noIconAttrs);
        iconShape2D?.attr(noIconAttrs);
        return;
    }
    const isAdaptive = selectedIconAdaptive && !selectedIconBgEnabled;
    const svgSource = buildCompositeIconSvg(
        icon.svg,
        selectedIconBgEnabled ? selectedIconBgColor : null,
        selectedIconBgShape,
        !isAdaptive,  // skip white filter when adaptive CSS class takes over
        selectedIconBgRadius
    );
    const adaptiveClass = isAdaptive ? 'nr-icon-adaptive' : '';
    const iconPx = selectedIconSize * GRID_SIZE;
    const { width: w, height: h } = iconShape.size();
    const iH = iconShape.isometricHeight;
    const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSource)}`;
    // 2D: centered in the shape's own bounding box
    const x2D = (w - iconPx) / 2;
    const y2D = (h - iconPx) / 2;

    let topIconAttrs: Record<string, unknown>;

    if (selectedIconFace === 'front') {
        // Project the icon onto the front face parallelogram.
        //
        // The front face has vertices (in shape-local model space, r=0):
        //   V3=(0,h), V2=(w,h), topV2=(w-iH,h-iH), topV3=(-iH,h-iH)
        //
        // Local coordinate system on the face:
        //   origin  = V3 = (0, h)
        //   x-axis  = (1, 0) per unit  (along the bottom edge)
        //   y-axis  = (-1,-1) per unit  (up the face, toward topV3)
        //
        // SVG matrix(a,b,c,d,e,f): X = a*lx + c*ly + e, Y = b*lx + d*ly + f
        //   → matrix(1, 0, -1, -1, 0, h)
        //
        // The icon occupies [localX, localY, iconPx, iconPx] in local space,
        // centered within [0..w] × [0..iH].
        const localX = (w - iconPx) / 2;
        const localY = (iH - iconPx) / 2;
        // The projection matrix inverts the y-axis, so the icon content is
        // rendered upside down on the face. Rotate 180° around the icon's
        // own centre (applied BEFORE the projection matrix in SVG transform
        // order) to compensate.
        const cx = localX + iconPx / 2;
        const cy = localY + iconPx / 2;
        topIconAttrs = {
            href,
            x: localX,
            y: localY,
            width:  iconPx,
            height: iconPx,
            transform: `matrix(1,0,-1,-1,0,${h}) rotate(180,${cx},${cy})`,
        };
    } else {
        // Top face: standard positioning in model space, no extra transform.
        const isoX = -iH + (w - iconPx) / 2;
        const isoY = -iH + (h - iconPx) / 2;
        topIconAttrs = {
            href,
            x: isoX,
            y: isoY,
            width:  iconPx,
            height: iconPx,
            transform: null,
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

    const getVisible = () => getVisibleIcons(isComplexShape ? 'complexShape' : 'componentEditor');

    // Layer target dropdown — only meaningful when editing a complex shape
    // with more than one layer. Clamp first so the preselected <option>
    // always matches a real layer.
    if (isComplexShape && layers.length > 1) {
        if (iconLayerIndex < 0 || iconLayerIndex >= layers.length) iconLayerIndex = 0;

        const formItem = document.createElement('div');
        formItem.className = 'cds--form-item';

        const selectWrapper = document.createElement('div');
        selectWrapper.className = 'cds--select';

        const label = document.createElement('label');
        label.className = 'cds--label';
        label.setAttribute('for', 'cd-icon-layer-select');
        label.textContent = 'Apply icon to layer';

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'cds--select-input-wrapper';

        const select = document.createElement('select');
        select.id = 'cd-icon-layer-select';
        select.className = 'cds--select-input';

        for (let i = 0; i < layers.length; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = layers[i].name || `Layer ${i + 1}`;
            opt.className = 'cds--select-option';
            if (i === iconLayerIndex) opt.selected = true;
            select.appendChild(opt);
        }

        select.addEventListener('change', () => {
            const next = parseInt(select.value, 10);
            if (Number.isNaN(next)) return;
            iconLayerIndex = next;
            applyIconToCurrentShape();
        });

        inputWrapper.appendChild(select);
        inputWrapper.insertAdjacentHTML(
            'beforeend',
            `<svg class="cds--select__arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`
        );
        selectWrapper.appendChild(label);
        selectWrapper.appendChild(inputWrapper);
        formItem.appendChild(selectWrapper);
        container.appendChild(formItem);
    }

    // Search input — filters the grid by label (substring, case-insensitive).
    // "No icon" is always offered so the user can clear a selection regardless
    // of the filter.
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
        const filtered = term
            ? visible.filter(ic => ic.label.toLowerCase().includes(term))
            : visible;
        const allIcons: Array<{ id: string | null; label: string; svg: string; source?: string }> = [
            { id: null, label: 'No icon', svg: NO_ICON_SVG },
            ...filtered.map(ic => ({ id: ic.id, label: ic.label, svg: ic.svg, source: ic.source })),
        ];
        for (const icon of allIcons) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-sd-icon-btn';
            btn.setAttribute('title', icon.label);
            btn.setAttribute('aria-label', icon.label);
            btn.setAttribute('data-icon-id', icon.id ?? '');
            const isSelected = icon.id === null ? selectedIcon === null : selectedIcon === icon.id;
            if (isSelected) btn.classList.add('nr-sd-icon-btn--selected');
            btn.innerHTML = icon.svg;

            btn.addEventListener('click', () => {
                selectedIcon = icon.id;
                grid.querySelectorAll('.nr-sd-icon-btn').forEach(b =>
                    b.classList.toggle('nr-sd-icon-btn--selected', b === btn)
                );
                applyIconToCurrentShape();
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

    // Face toggle — top or front (cuboid only)
    iconFaceRowEl = document.createElement('div');
    iconFaceRowEl.className = 'nr-sd-face-row';
    iconFaceRowEl.style.display = selectedBaseShape === 'cuboid' ? '' : 'none';

    const faceLbl = document.createElement('label');
    faceLbl.className = 'nr-sd-row-label';
    faceLbl.textContent = 'Face';

    const faceSwitcher = document.createElement('div');
    faceSwitcher.className = 'nr-sd-face-switcher';

    for (const face of ['top', 'front'] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-sd-face-btn' + (selectedIconFace === face ? ' nr-sd-face-btn--active' : '');
        btn.textContent = face.charAt(0).toUpperCase() + face.slice(1);
        btn.addEventListener('click', () => {
            selectedIconFace = face;
            faceSwitcher.querySelectorAll('.nr-sd-face-btn').forEach(b =>
                b.classList.toggle('nr-sd-face-btn--active', b === btn)
            );
            applyIconToCurrentShape();
        });
        faceSwitcher.appendChild(btn);
    }

    iconFaceRowEl.appendChild(faceLbl);
    iconFaceRowEl.appendChild(faceSwitcher);
    container.appendChild(iconFaceRowEl);

    // Size slider — controls icon width/height (always square), in grid units
    const sliderRow = document.createElement('div');
    sliderRow.className = 'nr-sd-slider-row';

    const labelRow = document.createElement('div');
    labelRow.className = 'nr-sd-slider-label-row';
    const sliderLbl = document.createElement('label');
    sliderLbl.className = 'cds--label';
    sliderLbl.setAttribute('for', 'sd-icon-size');
    sliderLbl.textContent = 'Size';
    const sliderValueEl = document.createElement('span');
    sliderValueEl.className = 'nr-sd-slider-value';
    sliderValueEl.id = 'sd-icon-size-value';
    sliderValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
    labelRow.appendChild(sliderLbl);
    labelRow.appendChild(sliderValueEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'sd-icon-size';
    slider.className = 'nr-sd-slider';
    slider.min = '0.5';
    slider.max = '4';
    slider.step = '0.1';
    slider.value = String(selectedIconSize);
    setSliderFill(slider);

    slider.addEventListener('input', () => {
        setSliderFill(slider);
        selectedIconSize = parseFloat(slider.value);
        sliderValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
        applyIconToCurrentShape();
    });

    sliderRow.appendChild(labelRow);
    sliderRow.appendChild(slider);
    container.appendChild(sliderRow);
}

function buildIconBackgroundContent(container: HTMLElement) {
    // ── Swatch row: no-bg circle + color circles ──────────────────────────────
    const swatchRow = document.createElement('div');
    swatchRow.className = 'nr-sd-swatch-row';

    // Reset refs so syncExtrasFromShape always has fresh references.
    iconBgSwatchRefs = [];

    // "No background" swatch — circle with diagonal slash (complex only)
    const noBgBtn = document.createElement('button');
    noBgBtn.type = 'button';
    noBgBtn.className = 'nr-sd-swatch-btn nr-sd-swatch-btn--no-bg' + (!selectedIconBgEnabled ? ' nr-sd-swatch-btn--selected' : '');
    noBgBtn.setAttribute('title', 'No background');
    noBgBtn.setAttribute('aria-label', 'No background');
    noBgBtn.style.display = isComplexShape ? '' : 'none';
    iconBgNoBackgroundBtnEl = noBgBtn;
    noBgBtn.addEventListener('click', () => {
        selectedIconBgEnabled = false;
        noBgBtn.classList.add('nr-sd-swatch-btn--selected');
        swatchRow.querySelectorAll('.nr-sd-swatch-btn:not(.nr-sd-swatch-btn--no-bg)').forEach(b =>
            b.classList.remove('nr-sd-swatch-btn--selected')
        );
        updateAdaptiveToggleVisibility();
        applyIconToCurrentShape();
    });
    swatchRow.appendChild(noBgBtn);

    // Color swatches
    for (const color of PRIMARY_COLORS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-sd-swatch-btn' + (selectedIconBgEnabled && selectedIconBgColor === color.base ? ' nr-sd-swatch-btn--selected' : '');
        btn.setAttribute('title', color.label);
        btn.setAttribute('aria-label', color.label);
        iconBgSwatchRefs.push({ btn, colorBase: color.base });

        const inner = document.createElement('span');
        inner.className = 'nr-sd-swatch-inner';
        inner.style.background = color.base;
        btn.appendChild(inner);

        btn.addEventListener('click', () => {
            selectedIconBgEnabled = true;
            selectedIconBgColor = color.base;
            noBgBtn.classList.remove('nr-sd-swatch-btn--selected');
            swatchRow.querySelectorAll('.nr-sd-swatch-btn:not(.nr-sd-swatch-btn--no-bg)').forEach(b =>
                b.classList.toggle('nr-sd-swatch-btn--selected', b === btn)
            );
            if (iconBgCustomColorInputRef) iconBgCustomColorInputRef.value = color.base;
            updateAdaptiveToggleVisibility();
            applyIconToCurrentShape();
        });
        swatchRow.appendChild(btn);
    }

    container.appendChild(swatchRow);

    // ── Custom color picker (complex shape only) ──────────────────────────────
    const customColorRow = document.createElement('div');
    customColorRow.className = 'nr-sd-custom-color-row';
    customColorRow.style.display = isComplexShape ? '' : 'none';
    iconBgCustomColorRowEl = customColorRow;

    const customColorLabel = document.createElement('label');
    customColorLabel.className = 'nr-sd-row-label';
    customColorLabel.setAttribute('for', 'sd-icon-bg-custom-color');
    customColorLabel.textContent = 'Custom';

    const customColorInput = document.createElement('input');
    customColorInput.type = 'color';
    customColorInput.id = 'sd-icon-bg-custom-color';
    customColorInput.className = 'nr-sd-color-input';
    customColorInput.value = selectedIconBgColor;
    iconBgCustomColorInputRef = customColorInput;

    customColorInput.addEventListener('input', () => {
        selectedIconBgEnabled = true;
        selectedIconBgColor = customColorInput.value;
        noBgBtn.classList.remove('nr-sd-swatch-btn--selected');
        swatchRow.querySelectorAll('.nr-sd-swatch-btn:not(.nr-sd-swatch-btn--no-bg)').forEach(b =>
            b.classList.remove('nr-sd-swatch-btn--selected')
        );
        updateAdaptiveToggleVisibility();
        applyIconToCurrentShape();
    });

    customColorRow.appendChild(customColorLabel);
    customColorRow.appendChild(customColorInput);
    container.appendChild(customColorRow);

    // ── Size slider ───────────────────────────────────────────────────────────
    const sliderRow = document.createElement('div');
    sliderRow.className = 'nr-sd-slider-row';

    const labelRow = document.createElement('div');
    labelRow.className = 'nr-sd-slider-label-row';
    const sliderLbl = document.createElement('label');
    sliderLbl.className = 'cds--label';
    sliderLbl.setAttribute('for', 'sd-icon-bg-size');
    sliderLbl.textContent = 'Size';
    const sliderValueEl = document.createElement('span');
    sliderValueEl.className = 'nr-sd-slider-value';
    sliderValueEl.id = 'sd-icon-bg-size-value';
    sliderValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
    labelRow.appendChild(sliderLbl);
    labelRow.appendChild(sliderValueEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'sd-icon-bg-size';
    slider.className = 'nr-sd-slider';
    slider.min = '0.5';
    slider.max = '4';
    slider.step = '0.1';
    slider.value = String(selectedIconSize);
    setSliderFill(slider);

    slider.addEventListener('input', () => {
        setSliderFill(slider);
        selectedIconSize = parseFloat(slider.value);
        sliderValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
        // Keep the Icon-section size slider in sync
        const iconSizeSlider = document.querySelector<HTMLInputElement>('#sd-icon-size');
        const iconSizeValue  = document.querySelector<HTMLElement>('#sd-icon-size-value');
        if (iconSizeSlider) {
            iconSizeSlider.value = String(selectedIconSize);
            setSliderFill(iconSizeSlider);
        }
        if (iconSizeValue)  iconSizeValue.textContent = `${selectedIconSize.toFixed(1)} cells`;
        applyIconToCurrentShape();
    });

    sliderRow.appendChild(labelRow);
    sliderRow.appendChild(slider);
    container.appendChild(sliderRow);

    // ── Shape radio ───────────────────────────────────────────────────────────
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'cds--radio-button-group cds--radio-button-group--vertical';
    fieldset.style.cssText = 'border:none;padding:0;margin:0;';

    const legend = document.createElement('legend');
    legend.className = 'cds--label';
    legend.style.paddingBottom = '4px';
    legend.textContent = 'Shape';
    fieldset.appendChild(legend);

    const bgShapeOptions: Array<{ value: 'circle' | 'square' | 'octagon'; label: string }> = [
        { value: 'circle',  label: 'Circle' },
        { value: 'square',  label: 'Square' },
        { value: 'octagon', label: 'Octagon' },
    ];

    for (const opt of bgShapeOptions) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cds--radio-button-wrapper';

        const input = document.createElement('input');
        input.type = 'radio';
        input.className = 'cds--radio-button';
        input.name = 'sd-icon-bg-shape';
        input.id = `sd-bg-shape-${opt.value}`;
        input.value = opt.value;
        if (opt.value === selectedIconBgShape) input.checked = true;

        const lbl = document.createElement('label');
        lbl.className = 'cds--radio-button__label';
        lbl.setAttribute('for', `sd-bg-shape-${opt.value}`);
        lbl.innerHTML = `<span class="cds--radio-button__appearance"></span><span class="cds--radio-button__label-text">${opt.label}</span>`;

        input.addEventListener('change', () => {
            selectedIconBgShape = opt.value;
            if (iconBgCornerRadiusRowEl) {
                iconBgCornerRadiusRowEl.style.display = opt.value === 'square' ? '' : 'none';
            }
            applyIconToCurrentShape();
        });

        wrapper.appendChild(input);
        wrapper.appendChild(lbl);
        fieldset.appendChild(wrapper);
    }

    container.appendChild(fieldset);

    // ── Corner Radius slider (square only) ────────────────────────────────────
    const crRow = document.createElement('div');
    crRow.className = 'nr-sd-slider-row';
    crRow.style.display = selectedIconBgShape === 'square' ? '' : 'none';
    iconBgCornerRadiusRowEl = crRow;

    const crLabelRow = document.createElement('div');
    crLabelRow.className = 'nr-sd-slider-label-row';
    const crLbl = document.createElement('label');
    crLbl.className = 'cds--label';
    crLbl.setAttribute('for', 'sd-icon-bg-radius');
    crLbl.textContent = 'Corner Roundness';
    const crValueEl = document.createElement('span');
    crValueEl.className = 'nr-sd-slider-value';
    crValueEl.id = 'sd-icon-bg-radius-value';
    crValueEl.textContent = `${selectedIconBgRadius}px`;
    crLabelRow.appendChild(crLbl);
    crLabelRow.appendChild(crValueEl);

    const crSlider = document.createElement('input');
    crSlider.type = 'range';
    crSlider.id = 'sd-icon-bg-radius';
    crSlider.className = 'nr-sd-slider';
    crSlider.min = '0';
    crSlider.max = '32';
    crSlider.step = '1';
    crSlider.value = String(selectedIconBgRadius);
    setSliderFill(crSlider);
    iconBgCornerRadiusInputRef = crSlider;

    crSlider.addEventListener('input', () => {
        setSliderFill(crSlider);
        selectedIconBgRadius = parseInt(crSlider.value, 10);
        crValueEl.textContent = `${selectedIconBgRadius}px`;
        applyIconToCurrentShape();
    });

    crRow.appendChild(crLabelRow);
    crRow.appendChild(crSlider);
    container.appendChild(crRow);
}

function buildColorContent(container: HTMLElement) {
    const row = document.createElement('div');
    row.className = 'nr-sd-color-row';

    const lbl = document.createElement('label');
    lbl.className = 'nr-sd-row-label';
    lbl.setAttribute('for', 'sd-color-base');
    lbl.textContent = 'Shape Color';

    const input = document.createElement('input');
    input.type = 'color';
    input.id = 'sd-color-base';
    input.className = 'nr-sd-color-input';
    const current = selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor || '#e0e0e0';
    input.value = current;
    colorPickerRef = input;

    input.addEventListener('input', () => {
        const val = input.value;
        selectedStyle.topColor   = val;
        selectedStyle.frontColor = val;
        selectedStyle.sideColor  = val;
        if (isComplexShape) {
            const layer = layers[selectedLayerIndex];
            if (layer) {
                layer.style.topColor   = val;
                layer.style.frontColor = val;
                layer.style.sideColor  = val;
            }
            const s    = layerShapes[selectedLayerIndex];
            const s2D  = layerShapes2D[selectedLayerIndex];
            if (s)   applyShapeStyle(s,   layer?.style ?? {});
            if (s2D) applyShapeStyle(s2D, layer?.style ?? {});
            return;
        }
        if (currentShape)   applyShapeStyle(currentShape,   selectedStyle);
        if (currentShape2D) applyShapeStyle(currentShape2D, selectedStyle);
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'nr-sd-color-clear-btn';
    clearBtn.setAttribute('title', 'Clear color');
    clearBtn.setAttribute('aria-label', 'Clear color');
    clearBtn.innerHTML = CDS_ICON_TRASH;
    clearBtn.addEventListener('click', () => {
        selectedStyle.topColor   = '';
        selectedStyle.frontColor = '';
        selectedStyle.sideColor  = '';
        input.value = '#e0e0e0';
        if (isComplexShape) {
            const layer = layers[selectedLayerIndex];
            if (layer) layer.style = {};
            const s    = layerShapes[selectedLayerIndex];
            const s2D  = layerShapes2D[selectedLayerIndex];
            if (s) {
                s.attr('top/fill',   '#a8a8a8');
                s.attr('front/fill', '#e0e0e0');
                s.attr('base/fill',  '#e0e0e0');
                s.attr('side/fill',  '#c6c6c6');
            }
            if (s2D) {
                s2D.attr('top/fill',   '#a8a8a8');
                s2D.attr('front/fill', '#e0e0e0');
                s2D.attr('base/fill',  '#e0e0e0');
                s2D.attr('side/fill',  '#c6c6c6');
            }
            return;
        }
        if (currentShape) {
            currentShape.attr('top/fill',   '#a8a8a8');
            currentShape.attr('front/fill', '#e0e0e0');
            currentShape.attr('side/fill',  '#c6c6c6');
        }
        if (currentShape2D) {
            currentShape2D.attr('top/fill',   '#a8a8a8');
            currentShape2D.attr('front/fill', '#e0e0e0');
            currentShape2D.attr('side/fill',  '#c6c6c6');
        }
    });

    row.appendChild(lbl);
    row.appendChild(input);
    row.appendChild(clearBtn);
    container.appendChild(row);
}

function buildInspectorPanel() {
    inspectorEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'nr-panel-header';
    const title = document.createElement('span');
    title.className = 'nr-panel-title';
    title.textContent = 'Component Configuration';
    header.appendChild(title);
    inspectorEl.appendChild(header);

    // No user-defined shape selected — show empty state and stop here.
    if (!currentShapeId) {
        const empty = document.createElement('p');
        empty.className = 'nr-inspector-empty';
        empty.textContent = 'Create a component to get started.';
        inspectorEl.appendChild(empty);
        return;
    }

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
    ctLabel.className = 'cds--label';
    ctLabel.setAttribute('for', 'sd-component-type');
    ctLabel.textContent = 'Component Type';
    ctLabel.style.marginTop = '8px';

    componentTypeSelect = document.createElement('select');
    const ctSelect = componentTypeSelect;
    ctSelect.id = 'sd-component-type';
    ctSelect.className = 'cds--text-input cds--text-input--sm';
    const ctOptions = ['', 'Server', 'Firewall', 'Switch', 'Storage', 'NIC'];
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
    hideLabelText.textContent = 'Hide label';

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
    toggleText.textContent = 'Complex Shape';

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

    nameSection.appendChild(nameLabel);
    nameSection.appendChild(shapeNameInput);
    nameSection.appendChild(ctLabel);
    nameSection.appendChild(ctSelect);
    nameSection.appendChild(hideLabelWrapper);
    nameSection.appendChild(complexToggleWrapper);
    inspectorEl.appendChild(nameSection);

    const accordion = document.createElement('ul');
    accordion.className = 'cds--accordion';
    accordion.appendChild(buildAccordionItem('Form Factor',     false, buildFormFactorContent));
    accordion.appendChild(buildAccordionItem('Dimensions',      false, buildDimensionsContent));
    modifiersAccordionLi = buildAccordionItem('Modifiers', false, buildModifiersContent);
    modifiersAccordionLi.style.display = supportsCornerRadius(selectedBaseShape) ? '' : 'none';
    accordion.appendChild(modifiersAccordionLi);

    // Position section — only visible in complex shape mode
    positionAccordionLi = buildAccordionItem('Position', false, buildPositionContent);
    positionAccordionLi.style.display = isComplexShape ? '' : 'none';
    accordion.appendChild(positionAccordionLi);

    accordion.appendChild(buildAccordionItem('Icon',            false, buildIconContent));
    accordion.appendChild(buildAccordionItem('Icon Background', false, buildIconBackgroundContent));
    accordion.appendChild(buildAccordionItem('Color',           false, buildColorContent));

    // SVG Footprint section — only visible in complex shape mode
    svgFootprintAccordionLi = buildAccordionItem('SVG Footprint', false, (contentEl) => {
        svgFootprintAccordionContent = contentEl;
        syncSvgFootprintSection();
    });
    svgFootprintAccordionLi.style.display = isComplexShape ? '' : 'none';
    accordion.appendChild(svgFootprintAccordionLi);

    inspectorEl.appendChild(accordion);

    const footer = document.createElement('div');
    footer.className = 'nr-sd-panel-footer';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    saveBtn.type = 'button';
    saveBtn.style.width = '100%';
    saveBtn.textContent = 'Save Component';
    saveBtn.addEventListener('click', onSave);

    const duplicateBtn = document.createElement('button');
    duplicateBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
    duplicateBtn.type = 'button';
    duplicateBtn.style.width = '100%';
    duplicateBtn.textContent = 'Duplicate Component';
    duplicateBtn.addEventListener('click', () => showDuplicateShapeModal(currentShapeId));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'cds--btn cds--btn--sm nr-btn--danger-ghost';
    deleteBtn.type = 'button';
    deleteBtn.style.width = '100%';
    deleteBtn.textContent = 'Delete Component';
    deleteBtn.addEventListener('click', () => showDeleteConfirmModal(currentShapeId));

    const exportSvgBtn = document.createElement('button');
    exportSvgBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    exportSvgBtn.type = 'button';
    exportSvgBtn.style.width = '100%';
    exportSvgBtn.textContent = 'Export SVG';
    exportSvgBtn.addEventListener('click', exportShapeSvg);

    footer.appendChild(saveBtn);
    footer.appendChild(duplicateBtn);
    footer.appendChild(exportSvgBtn);
    footer.appendChild(deleteBtn);
    inspectorEl.appendChild(footer);
}

// All form factors except 'cuboid' require width === height (square base).
function requiresSquareBase(baseShape: string): boolean {
    return baseShape !== 'cuboid';
}

// Form factors that expose the corner radius slider.
function supportsCornerRadius(baseShape: string): boolean {
    return baseShape === 'cuboid';
}

// Returns true when a layer uses a custom SVG footprint for rendering.
function isLayerSvg(layer: ShapeLayer): boolean {
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

// Enforce square-base (height = width) and pyramid min-depth constraints.
function updateDimensionLock() {
    const locked = requiresSquareBase(selectedBaseShape);
    heightInput.disabled = locked;
    heightInput.style.opacity = locked ? '0.4' : '';
    if (locked) {
        heightInput.value = widthInput.value;
        if (heightValueEl) {
            heightValueEl.textContent = isComplexShape
                ? `${Math.round(parseFloat(widthInput.value))} px`
                : `${parseFloat(widthInput.value).toFixed(1)} GU`;
        }
    }

    // Pyramid depth minimum: only enforced in simple (GU) mode.
    // In complex pixel mode the depth slider min is already set to 0.
    if (!isComplexShape) {
        const minDepth = selectedBaseShape === 'pyramid' ? 2 : 0;
        depthInput.min = String(minDepth);
        if (parseFloat(depthInput.value) < minDepth) {
            depthInput.value = String(minDepth);
            if (depthValueEl) depthValueEl.textContent = `${minDepth.toFixed(1)} GU`;
        }
    }

    // Corner radius and chamfer are only available for built-in polygon shapes,
    // not for SVG-footprint layers (SVG vertices are always used without rounding).
    const currentSvgLayer = isComplexShape ? (layers[selectedLayerIndex] ?? null) : null;
    const hasSvgLayer     = currentSvgLayer !== null && isLayerSvg(currentSvgLayer);
    const isCuboid = supportsCornerRadius(selectedBaseShape);
    const showEdgeControls = isCuboid && !hasSvgLayer;
    if (cornerRadiusRowEl) cornerRadiusRowEl.style.display = showEdgeControls ? '' : 'none';
    if (chamferRowEl)      chamferRowEl.style.display      = showEdgeControls ? '' : 'none';
    if (iconFaceRowEl)     iconFaceRowEl.style.display     = showEdgeControls ? '' : 'none';
    if (modifiersAccordionLi) modifiersAccordionLi.style.display = isCuboid ? '' : 'none';
    if (modifiersSvgInfoEl) modifiersSvgInfoEl.style.display = hasSvgLayer ? '' : 'none';
}

// Update dimension sliders and value displays from the shape's current state.
function syncFormFromShape(shape: IsometricShape) {
    const { width, height } = shape.size();
    const depth = shape.get('isometricHeight') ?? 0;
    const wGU = width  / GRID_SIZE;
    const hGU = height / GRID_SIZE;
    const dGU = depth  / GRID_SIZE;
    widthInput.value  = String(wGU);
    heightInput.value = String(hGU);
    depthInput.value  = String(dGU);
    if (widthValueEl)  widthValueEl.textContent  = `${wGU.toFixed(1)} GU`;
    if (heightValueEl) heightValueEl.textContent = `${hGU.toFixed(1)} GU`;
    if (depthValueEl)  depthValueEl.textContent  = `${dGU.toFixed(1)} GU`;
    updateDimensionLock();
    syncAllSliderFills();
}

// Update form factor, icon, and color controls from the registry for the given shape id.
function syncExtrasFromShape(id: string) {
    const defaults = ShapeRegistry[id];

    selectedBaseShape   = (defaults?.baseShape ?? BASE_SHAPE_BY_ID[id] ?? 'cuboid') as BaseShape;
    selectedIconFace    = defaults?.iconFace   ?? 'top';
    selectedIcon        = defaults?.icon       ?? null;
    selectedIconSize    = defaults?.iconSize   ?? 1;
    iconLayerIndex      = defaults?.iconLayerIndex ?? 0;
    selectedIconBgEnabled  = true; // reset to enabled on shape switch
    selectedIconAdaptive   = false;
    selectedIconBgColor = defaults?.iconBgColor ?? PRIMARY_COLORS[0].base;
    selectedIconBgShape  = (defaults?.iconBgShape ?? 'circle') as 'circle' | 'square' | 'octagon';
    selectedIconBgRadius = defaults?.iconBgRadius ?? 6;
    selectedStyle     = {
        topColor:    defaults?.style?.topColor    ?? '',
        sideColor:   defaults?.style?.sideColor   ?? '',
        frontColor:  defaults?.style?.frontColor  ?? '',
        strokeColor: defaults?.style?.strokeColor ?? '',
    };

    // Sync radio buttons
    inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-form-factor"]').forEach(r => {
        r.checked = r.value === selectedBaseShape;
    });
    syncFormFactorTiles();

    // Sync icon selection — no-icon button has data-icon-id="" which maps to selectedIcon===null
    inspectorEl.querySelectorAll<HTMLElement>('.nr-sd-icon-btn').forEach(btn => {
        const match = selectedIcon === null
            ? btn.dataset.iconId === ''
            : btn.dataset.iconId === selectedIcon;
        btn.classList.toggle('nr-sd-icon-btn--selected', match);
    });

    // Sync both size sliders (Icon section + Icon Background section share selectedIconSize)
    const sizeSlider = inspectorEl.querySelector<HTMLInputElement>('#sd-icon-size');
    const sizeValueEl = inspectorEl.querySelector<HTMLElement>('#sd-icon-size-value');
    if (sizeSlider) { sizeSlider.value = String(selectedIconSize); setSliderFill(sizeSlider); }
    if (sizeValueEl) sizeValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
    const bgSizeSlider = inspectorEl.querySelector<HTMLInputElement>('#sd-icon-bg-size');
    const bgSizeValueEl = inspectorEl.querySelector<HTMLElement>('#sd-icon-bg-size-value');
    if (bgSizeSlider) { bgSizeSlider.value = String(selectedIconSize); setSliderFill(bgSizeSlider); }
    if (bgSizeValueEl) bgSizeValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;

    // Sync icon background: no-bg swatch + color swatches + custom color picker
    if (iconBgNoBackgroundBtnEl) {
        iconBgNoBackgroundBtnEl.classList.toggle('nr-sd-swatch-btn--selected', !selectedIconBgEnabled);
    }
    for (const { btn, colorBase } of iconBgSwatchRefs) {
        btn.classList.toggle('nr-sd-swatch-btn--selected', selectedIconBgEnabled && colorBase === selectedIconBgColor);
    }
    if (iconBgCustomColorInputRef) iconBgCustomColorInputRef.value = selectedIconBgColor;

    // Sync icon background shape radio
    inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-icon-bg-shape"]').forEach(r => {
        r.checked = r.value === selectedIconBgShape;
    });

    // Sync corner radius slider visibility and value
    if (iconBgCornerRadiusRowEl) {
        iconBgCornerRadiusRowEl.style.display = selectedIconBgShape === 'square' ? '' : 'none';
    }
    if (iconBgCornerRadiusInputRef) {
        iconBgCornerRadiusInputRef.value = String(selectedIconBgRadius);
        const crValueEl = document.getElementById('sd-icon-bg-radius-value');
        if (crValueEl) crValueEl.textContent = `${selectedIconBgRadius}px`;
    }

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
        if (requiresSquareBase(selectedBaseShape)) {
            layer.height = layer.width;
            heightInput.value = String(layer.width / GRID_SIZE);
            if (heightValueEl) heightValueEl.textContent = `${(layer.width / GRID_SIZE).toFixed(1)} GU`;
        }
        updateDimensionLock();
        renderLayersOnCanvas();
        return;
    }

    if (!currentShape) return;

    // Snap height to width immediately when switching to a square-base form factor.
    if (requiresSquareBase(selectedBaseShape)) heightInput.value = widthInput.value;
    updateDimensionLock();

    const widthGU  = parseFloat(widthInput.value);
    const heightGU = parseFloat(heightInput.value);
    const depthGU  = parseFloat(depthInput.value);
    const width  = (isNaN(widthGU)  || widthGU  < 0.5 ? 1 : widthGU)  * GRID_SIZE;
    const height = (isNaN(heightGU) || heightGU < 0.5 ? 1 : heightGU) * GRID_SIZE;
    const depth  = (isNaN(depthGU)  || depthGU  < 0   ? 0 : depthGU)  * GRID_SIZE;

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
    applyIconToCurrentShape();
}

// Apply slider dimension values to the preview shape (grid units → px).
function onFieldChange() {
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
    const widthGU = parseFloat(widthInput.value);
    if (requiresSquareBase(selectedBaseShape)) {
        heightInput.value = String(widthGU);
        if (heightValueEl) heightValueEl.textContent = `${widthGU.toFixed(1)} GU`;
    }
    const heightGU = parseFloat(heightInput.value);
    const depthGU  = parseFloat(depthInput.value);
    if (isNaN(widthGU) || isNaN(heightGU) || isNaN(depthGU) || widthGU < 0.5 || heightGU < 0.5 || depthGU < 0) return;
    currentShape.resize(widthGU * GRID_SIZE, heightGU * GRID_SIZE);
    currentShape.set('isometricHeight', depthGU * GRID_SIZE);
    currentShape2D?.resize(widthGU * GRID_SIZE, heightGU * GRID_SIZE);
    currentShape2D?.set('isometricHeight', depthGU * GRID_SIZE);
    centerShapeOnCanvas(currentShape, currentShape2D ?? null);
}

// Persist all template values to the Shape Registry.
function onSave() {
    // Pre-compute icon URI (shared by both simple and complex paths)
    let iconHref: string | undefined;
    if (selectedIcon) {
        const iconEntry = getIconById(selectedIcon);
        if (iconEntry) {
            const svg = buildCompositeIconSvg(iconEntry.svg, selectedIconBgEnabled ? selectedIconBgColor : null, selectedIconBgShape, true, selectedIconBgRadius);
            iconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }
    }

    if (isComplexShape) {
        if (layers.length === 0) return;
        const layer1 = layers[0];
        updateShapeDefinition(currentShapeId, {
            displayName: shapeNameInput?.value.trim() || formatLabel(currentShapeId),
            defaultSize: { width: layer1.width, height: layer1.height },
            defaultIsometricHeight: layer1.depth,
            baseShape: layer1.baseShape,
            iconFace: selectedIconFace,
            icon: selectedIcon ?? undefined,
            iconSize: selectedIconSize,
            iconBgColor: selectedIconBgColor,
            iconBgShape: selectedIconBgShape,
            iconBgRadius: selectedIconBgRadius,
            iconHref,
            iconLayerIndex,
            cornerRadius: selectedCornerRadius,
            chamferSize: selectedChamferSize,
            style: {
                topColor:    selectedStyle.topColor    || undefined,
                frontColor:  selectedStyle.frontColor  || undefined,
                sideColor:   selectedStyle.sideColor   || undefined,
                strokeColor: selectedStyle.strokeColor || undefined,
            },
            complexShape: true,
            layers: layers.map(l => ({ ...l, style: { ...l.style } })),
        });
        saveRegistryToStorage();
        document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
        buildPalettePanel();
        return;
    }

    if (!currentShape) return;
    const widthGU  = parseFloat(widthInput.value);
    const heightGU = parseFloat(heightInput.value);
    const depthGU  = parseFloat(depthInput.value);
    if (isNaN(widthGU) || isNaN(heightGU) || isNaN(depthGU)) return;

    updateShapeDefinition(currentShapeId, {
        displayName: shapeNameInput?.value.trim() || formatLabel(currentShapeId),
        componentType: componentTypeSelect?.value || undefined,
        defaultSize: { width: widthGU * GRID_SIZE, height: heightGU * GRID_SIZE },
        defaultIsometricHeight: depthGU * GRID_SIZE,
        baseShape: selectedBaseShape,
        iconFace: selectedIconFace,
        icon: selectedIcon ?? undefined,
        iconSize: selectedIconSize,
        iconBgColor: selectedIconBgColor,
        iconBgShape: selectedIconBgShape,
        iconBgRadius: selectedIconBgRadius,
        iconHref,
        cornerRadius: selectedCornerRadius,
        chamferSize: selectedChamferSize,
        style: {
            topColor:    selectedStyle.topColor    || undefined,
            frontColor:  selectedStyle.frontColor  || undefined,
            sideColor:   selectedStyle.sideColor   || undefined,
            strokeColor: selectedStyle.strokeColor || undefined,
        },
        complexShape: false,
        layers: undefined,
    });
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
    buildPalettePanel();
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
}

// Keep form in sync when resize or height tools are used directly on the shape.
graph.on('change:size', (cell: dia.Cell) => {
    if (isComplexShape) return; // layer shapes have no resize tools
    if (currentShape && cell.id === currentShape.id) {
        syncFormFromShape(currentShape);
        applyIconToCurrentShape();
        if (currentShape2D) {
            const { width, height } = currentShape.size();
            currentShape2D.resize(width, height);
        }
        centerShapeOnCanvas(currentShape, currentShape2D);
    }
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

    if (isLayerSvg(layer)) {
        // ── SVG is loaded: show filename + preview and an icon-only remove button ──
        const row = document.createElement('div');
        row.className = 'nr-svgfp-row';

        const fileName = document.createElement('span');
        fileName.className = 'nr-svgfp-filename nr-svgfp-filename--body';
        fileName.title = layer.svgFootprintName ?? 'custom.svg';
        fileName.textContent = layer.svgFootprintName ?? 'custom.svg';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'nr-svgfp-remove-btn';
        removeBtn.title = 'Remove SVG footprint';
        removeBtn.setAttribute('aria-label', 'Remove SVG footprint');
        removeBtn.innerHTML = CDS_ICON_TRASH;
        removeBtn.addEventListener('click', onRemoveSvgFootprint);

        row.appendChild(fileName);
        row.appendChild(removeBtn);
        svgFootprintAccordionContent.appendChild(row);

        // Live preview — render the raw uploaded SVG so the user can confirm the outline.
        if (layer.svgFootprint) {
            const preview = document.createElement('div');
            preview.className = 'nr-svgfp-preview';
            preview.setAttribute('aria-label', 'SVG footprint preview');
            preview.innerHTML = layer.svgFootprint;
            svgFootprintAccordionContent.appendChild(preview);
        }
    } else {
        // ── No SVG loaded: label left, compact upload button right ────────
        const uploadRow = document.createElement('div');
        uploadRow.className = 'nr-svgfp-row';

        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'nr-svgfp-filename';
        fileNameSpan.textContent = 'No file';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'sd-svgfp-input';
        fileInput.accept = '.svg,image/svg+xml';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => onSvgFootprintUpload(fileInput));

        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'cds--btn cds--btn--secondary cds--btn--sm nr-svgfp-upload-label';
        uploadLabel.setAttribute('for', 'sd-svgfp-input');
        uploadLabel.textContent = 'Upload';

        uploadRow.appendChild(fileNameSpan);
        uploadRow.appendChild(fileInput);
        uploadRow.appendChild(uploadLabel);
        svgFootprintAccordionContent.appendChild(uploadRow);

        const hint = document.createElement('p');
        hint.className = 'cds--form__helper-text';
        hint.style.marginTop = '4px';
        hint.textContent = 'Single closed outline SVG only.';
        svgFootprintAccordionContent.appendChild(hint);
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
    canvasWrapEl.style.right = '508px'; // 300px inspector + 208px layers
}

function hideLayersPanel() {
    layerPanelEl.style.display = 'none';
    canvasWrapEl.style.right = '';
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

        // Use SvgPolygonShape when the layer has an uploaded SVG footprint,
        // otherwise fall back to the selected built-in form factor.
        let shape: IsometricShape;
        if (isLayerSvg(layer)) {
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
        shape.position(isoX, isoY);
        shape.toggleView(View.Isometric);
        // Only the first layer carries the shape's label; additional layers are unlabelled.
        if (idx > 0) shape.attr('label/text', '');
        layerShapes.push(shape);

        const x2D = bx - layer.width  / 2 + layer.offsetX;
        const y2D = by - layer.height / 2 + layer.offsetY;

        let shape2D: IsometricShape;
        if (isLayerSvg(layer)) {
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
        shape2D.position(x2D, y2D);
        shape2D.toggleView(View.TwoDimensional);
        if (idx > 0) shape2D.attr('label/text', '');
        layerShapes2D.push(shape2D);
    }

    // Add cells in FORWARD order so SVG painter's algorithm puts Layer 0
    // (the main/base layer) at the bottom of the stack, with additional
    // layers painting above it. First cell added = painted first = behind.
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

    // currentShape points to the selected layer (used by slider sync on canvas events).
    currentShape   = layerShapes[selectedLayerIndex]   ?? null;
    currentShape2D = layerShapes2D[selectedLayerIndex] ?? null;

    // Reapply icon to Layer 1 (component-level attribute) after canvas rebuild.
    applyIconToCurrentShape();

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
            selectedLayerIndex = i;
            buildLayersPanel();
            syncInspectorToLayer(i);
            currentShape   = layerShapes[i]   ?? null;
            currentShape2D = layerShapes2D[i] ?? null;
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

    if (offsetXInput)        { offsetXInput.value       = String(layer.offsetX);       setSliderFill(offsetXInput); }
    if (offsetYInput)        { offsetYInput.value       = String(layer.offsetY);       setSliderFill(offsetYInput); }
    if (baseElevationInput)  {
        baseElevationInput.value    = String(layer.baseElevation);
        baseElevationInput.disabled = index === 0;
        setSliderFill(baseElevationInput);
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
    if (cornerRadiusInput)   { cornerRadiusInput.value   = String(cr); setSliderFill(cornerRadiusInput); }
    if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = `${cr} px`;

    const cs = layer.chamferSize ?? 0;
    selectedChamferSize = cs;
    if (chamferSizeInput)   { chamferSizeInput.value   = String(cs); setSliderFill(chamferSizeInput); }
    if (chamferSizeValueEl) chamferSizeValueEl.textContent = `${cs} px`;

    // SVG footprint section: clear any stale parse error, then refresh
    svgParseError = '';
    syncSvgFootprintSection();
    updateDimensionLock();
    syncAllSliderFills();
}

/** Called when offset/elevation sliders change */
function onOffsetChange() {
    if (!isComplexShape) return;
    const layer = layers[selectedLayerIndex];
    if (!layer) return;

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
    const newLayer: ShapeLayer = {
        id:            `layer-${Date.now()}`,
        name:          `Layer ${layers.length + 1}`,
        baseShape:     'cuboid',
        width:         2 * GRID_SIZE,
        height:        2 * GRID_SIZE,
        depth:         GRID_SIZE,
        offsetX:       0,
        offsetY:       0,
        baseElevation: 0,
        style:         {},
        cornerRadius:  0,
    };
    layers.push(newLayer);
    selectedLayerIndex = layers.length - 1;
    renderLayersOnCanvas();
    buildLayersPanel();
    syncInspectorToLayer(selectedLayerIndex);
    refreshIconAccordionContent();
}

function onDeleteLayer(index: number) {
    if (layers.length <= 1) return; // always keep at least one layer
    if (index === 0) return;        // main layer cannot be deleted
    layers.splice(index, 1);
    if (selectedLayerIndex >= layers.length) selectedLayerIndex = layers.length - 1;
    if (iconLayerIndex    >= layers.length) iconLayerIndex    = 0;
    renderLayersOnCanvas();
    buildLayersPanel();
    syncInspectorToLayer(selectedLayerIndex);
    refreshIconAccordionContent();
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
        widthInput.min  = '1';   widthInput.max  = '160'; widthInput.step = '1';
        heightInput.min = '1';   heightInput.max = '160'; heightInput.step = '1';
        depthInput.min  = '0';   depthInput.max  = '160'; depthInput.step = '1';
        if (offsetXInput) {
            offsetXInput.min  = '-160'; offsetXInput.max  = '160'; offsetXInput.step = '1';
        }
        if (offsetYInput) {
            offsetYInput.min  = '-160'; offsetYInput.max  = '160'; offsetYInput.step = '1';
        }
        if (baseElevationInput) {
            baseElevationInput.min  = '0'; baseElevationInput.max  = '320'; baseElevationInput.step = '1';
        }
    } else {
        widthInput.min  = '0.5'; widthInput.max  = '8'; widthInput.step = '0.5';
        heightInput.min = '0.5'; heightInput.max = '8'; heightInput.step = '0.5';
        depthInput.min  = '0';   depthInput.max  = '8'; depthInput.step = '0.5';
    }
}

function onComplexShapeToggle(enabled: boolean) {
    if (enabled) {
        // Read current single-shape dimensions from sliders (still in GU at this point)
        const wGU = parseFloat(widthInput?.value  ?? '2');
        const hGU = parseFloat(heightInput?.value ?? '2');
        const dGU = parseFloat(depthInput?.value  ?? '1');
        const w = (isNaN(wGU) ? 2 : wGU) * GRID_SIZE;
        const h = (isNaN(hGU) ? 2 : hGU) * GRID_SIZE;
        const d = (isNaN(dGU) ? 1 : dGU) * GRID_SIZE;

        isComplexShape     = true;
        selectedLayerIndex = 0;
        layerShapes        = [];
        layerShapes2D      = [];
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
        if (iconBgNoBackgroundBtnEl) iconBgNoBackgroundBtnEl.style.display = 'none';
        if (iconBgCustomColorRowEl)  iconBgCustomColorRowEl.style.display  = 'none';
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

function onCreateShape(name: string) {
    const id = nameToId(name);
    addShape(id, {
        displayName: name,
        defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
        defaultIsometricHeight: GRID_SIZE * 0.5,
    });
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
    currentShapeId = id;
    buildPalettePanel();
    buildInspectorPanel();
    loadShapeIntoCanvas(id);
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
    headingEl.textContent = 'New Shape';

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
    label.textContent = 'Shape Name';

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

function exportShapeSvg(): void {
    const svgEl = paper.el.querySelector('svg');
    if (!svgEl) return;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    cleanSvgForExport(clone);

    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);

    const contentGroup = clone.querySelector('.joint-cells-layer') as SVGGElement | null;
    const bbox = contentGroup ? contentGroup.getBBox() : clone.getBBox();
    document.body.removeChild(clone);

    if (bbox.width === 0 || bbox.height === 0) return;

    const pad = 8;
    clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    clone.setAttribute('width', String(Math.ceil(bbox.width + pad * 2)));
    clone.setAttribute('height', String(Math.ceil(bbox.height + pad * 2)));
    clone.removeAttribute('style');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const svgString = new XMLSerializer().serializeToString(clone);
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
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
    const remaining = Object.keys(ShapeRegistry).filter(id => !BUILT_IN_SHAPE_IDS.has(id));
    if (remaining.length === 0) {
        paper.removeTools();
        graph.clear();
        graph2D.clear();
        currentShape = null;
        currentShape2D = null;
    } else {
        const next = remaining.includes(currentShapeId) ? currentShapeId : remaining[0];
        currentShapeId = next;
        loadShapeIntoCanvas(next);
    }
    buildPalettePanel();
}

const CD_ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`;

function buildCollapsibleSection(title: string, body: HTMLElement, separator: boolean): HTMLElement {
    const section = document.createElement('div');
    section.className = 'nr-palette-section' + (separator ? ' nr-palette-section--separated' : '');

    const headerBtn = document.createElement('button');
    headerBtn.className = 'nr-section-header';
    headerBtn.type = 'button';
    headerBtn.setAttribute('aria-expanded', 'true');

    const labelSpan = document.createElement('span');
    labelSpan.textContent = title;

    const chevronSpan = document.createElement('span');
    chevronSpan.className = 'nr-section-chevron';
    chevronSpan.innerHTML = CD_ICON_CHEVRON_DOWN;

    headerBtn.appendChild(labelSpan);
    headerBtn.appendChild(chevronSpan);

    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'nr-section-body';
    bodyWrapper.appendChild(body);

    headerBtn.addEventListener('click', () => {
        const collapsed = section.classList.toggle('nr-palette-section--collapsed');
        headerBtn.setAttribute('aria-expanded', String(!collapsed));
    });

    section.appendChild(headerBtn);
    section.appendChild(bodyWrapper);
    return section;
}

function buildPalettePanel() {
    paletteEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'nr-panel-header';
    const title = document.createElement('span');
    title.className = 'nr-panel-title';
    title.textContent = 'Component Designer';
    header.appendChild(title);
    paletteEl.appendChild(header);

    const generalIds = new Set(shapeStore.list('general').map(s => s.id));

    // ── User Components (first, expanded by default) ─────────────────────────
    const userWrapper = document.createElement('div');

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'nr-palette-new-btn';
    newBtn.textContent = '+ New Component';
    newBtn.addEventListener('click', showNewShapeModal);
    userWrapper.appendChild(newBtn);

    const list = document.createElement('ul');
    list.className = 'nr-palette-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'User Components');

    for (const id of Object.keys(ShapeRegistry).filter(id => !BUILT_IN_SHAPE_IDS.has(id) && !generalIds.has(id))) {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(id === currentShapeId));

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-palette-item' + (id === currentShapeId ? ' nr-palette-item--selected' : '');
        btn.dataset.shapeId = id;

        const iconId  = ShapeRegistry[id]?.icon;
        const iconSvg = iconId ? getIconById(iconId)?.svg : undefined;
        if (iconSvg) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'nr-palette-item-icon';
            iconSpan.innerHTML = iconSvg;
            iconSpan.setAttribute('aria-hidden', 'true');
            btn.appendChild(iconSpan);
        }
        const labelSpan = document.createElement('span');
        labelSpan.className = 'nr-palette-item-label';
        labelSpan.textContent = ShapeRegistry[id]?.displayName ?? formatLabel(id);
        btn.appendChild(labelSpan);

        btn.addEventListener('click', () => {
            paletteEl.querySelectorAll<HTMLButtonElement>('.nr-palette-item').forEach(b => {
                b.classList.toggle('nr-palette-item--selected', b === btn);
                b.closest('li')?.setAttribute('aria-selected', String(b === btn));
            });
            currentShapeId = id;
            loadShapeIntoCanvas(id);
        });

        li.appendChild(btn);
        list.appendChild(li);
    }

    userWrapper.appendChild(list);
    paletteEl.appendChild(buildCollapsibleSection('User Components', userWrapper, false));

    // ── Collection-based sections (General, Oracle, NetApp, …) ─────────────
    const allGeneral = shapeStore.list('general');
    const byCollection = new Map<string, typeof allGeneral>();
    for (const stored of allGeneral) {
        const col = stored.definition.collection || 'General';
        if (!byCollection.has(col)) byCollection.set(col, []);
        byCollection.get(col)!.push(stored);
    }

    for (const collectionName of getComponentCollections()) {
        const items = byCollection.get(collectionName) ?? [];
        const colList = document.createElement('ul');
        colList.className = 'nr-palette-list';
        colList.setAttribute('role', 'listbox');
        colList.setAttribute('aria-label', `${collectionName} Components`);

        for (const stored of items) {
            const sid = stored.id;
            const def = stored.definition;
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', String(sid === currentShapeId));

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-palette-item' + (sid === currentShapeId ? ' nr-palette-item--selected' : '');
            btn.dataset.shapeId = sid;

            const iconId  = def.icon;
            const iconSvg = iconId ? getIconById(iconId)?.svg : undefined;
            if (iconSvg) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'nr-palette-item-icon';
                iconSpan.innerHTML = iconSvg;
                iconSpan.setAttribute('aria-hidden', 'true');
                btn.appendChild(iconSpan);
            }
            const labelSpan = document.createElement('span');
            labelSpan.className = 'nr-palette-item-label';
            labelSpan.textContent = def.displayName ?? formatLabel(sid);
            btn.appendChild(labelSpan);

            btn.addEventListener('click', () => {
                if (!ShapeRegistry[sid]) {
                    addShape(sid, { ...def });
                }
                paletteEl.querySelectorAll<HTMLButtonElement>('.nr-palette-item').forEach(b => {
                    b.classList.toggle('nr-palette-item--selected', b === btn);
                    b.closest('li')?.setAttribute('aria-selected', String(b === btn));
                });
                currentShapeId = sid;
                loadShapeIntoCanvas(sid);
            });

            li.appendChild(btn);
            colList.appendChild(li);
        }

        paletteEl.appendChild(buildCollapsibleSection(collectionName, colList, true));
    }
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
    // Reset the paper matrix so the viewport always returns to the centred baseline.
    paper.matrix(transformationMatrix(View.Isometric, CD_MARGIN, SIDEBAR_INSET, CD_GRID_COUNT));

    const savedDefaults = ShapeRegistry[id];
    const displayName   = savedDefaults?.displayName ?? formatLabel(id);
    if (shapeNameInput) shapeNameInput.value = displayName;

    // Restore icon/style/baseShape fields (common to both simple and complex paths)
    syncExtrasFromShape(id);

    // Sync the complex toggle state in the inspector (it persists across palette switches)
    // #sd-complex-toggle is now a <button> inside an .nr-toggle wrapper div.
    const complexToggleBtn = inspectorEl.querySelector<HTMLButtonElement>('#sd-complex-toggle');
    const complexToggleDiv = complexToggleBtn?.closest<HTMLElement>('.nr-toggle') ?? null;

    selectedCornerRadius = savedDefaults?.cornerRadius ?? 0;
    selectedChamferSize  = savedDefaults?.chamferSize ?? 0;

    if (savedDefaults?.complexShape && savedDefaults.layers?.length) {
        // ── Complex shape path ─────────────────────────────────────────────────
        isComplexShape     = true;
        layers             = savedDefaults.layers.map(l => ({ ...l, style: { ...l.style } }));
        selectedLayerIndex = 0;

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
        if (iconBgNoBackgroundBtnEl) iconBgNoBackgroundBtnEl.style.display = 'none';
        if (iconBgCustomColorRowEl)  iconBgCustomColorRowEl.style.display  = 'none';
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
        shape2D.position(posX, posY);
        shape2D.toggleView(View.TwoDimensional);
        graph2D.addCell(shape2D);
        currentShape2D = shape2D;

        shape.attr('label/text', displayName);
        shape2D.attr('label/text', displayName);

        syncFormFromShape(shape);

        if (selectedStyle.topColor || selectedStyle.frontColor || selectedStyle.sideColor || selectedStyle.strokeColor) {
            applyShapeStyle(shape,   selectedStyle);
            applyShapeStyle(shape2D, selectedStyle);
        }

        if (cornerRadiusInput)   { cornerRadiusInput.value = String(selectedCornerRadius); setSliderFill(cornerRadiusInput); }
        if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = `${selectedCornerRadius} px`;

        if (chamferSizeInput)   { chamferSizeInput.value = String(selectedChamferSize); setSliderFill(chamferSizeInput); }
        if (chamferSizeValueEl) chamferSizeValueEl.textContent = `${selectedChamferSize} px`;

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
    hide: () => { /* nothing to collapse in the Shape Designer */ },
};

export function selectShape(id: string): void {
    if (!ShapeRegistry[id]) return;
    currentShapeId = id;
    buildPalettePanel();
    buildInspectorPanel();
    loadShapeIntoCanvas(id);
}

// ── Initialise ────────────────────────────────────────────────────────────────

buildInspectorPanel();
buildPalettePanel();
if (currentShapeId) loadShapeIntoCanvas(currentShapeId);
