import { dia, V } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { cellNamespace } from './shapes';
import { Rectangle } from './shapes/rectangle/rectangle';
import { Link } from './shapes/link/link';
import { SHAPE_FACTORIES, BASE_SHAPE_BY_ID, FORM_FACTOR_PREVIEWS, getPreviewFactory } from './shapes/shape-factories';
import { drawGrid, switchView, transformationMatrix, applyShapeStyle, applyShapeFillOpacity, buildCompositeIconSvg, icon2DHref } from './utils';
import { applyTheme } from './index';
import { SvgPolygonShape } from './shapes/svgpolygon/svg-polygon-shape';
import { parseSvgFootprint } from './svg-footprint';
import { Area } from './shapes/area/area';
import { FrameCornerControl } from './tools';
import { GRID_SIZE, SHAPE_CELL_SIZE, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE } from './theme';

// Component designer uses a fixed 10×10 GU grid, independent of the system designer.
const CD_GRID_COUNT = 10;
import { ShapeRegistry, ShapeDefinition, BUILT_IN_SHAPE_IDS, updateShapeDefinition, deleteShape, addShape, saveRegistryToStorage, ShapeLayer, IconEntry, defaultIconEntry, defaultShapeLayer } from './shapes/shape-registry';
import { getHitArea, HIT_AREA_STEP, getPaletteIcon } from './shape-query';
import { BaseShape } from './shapes/shape-definition';
import {
    requiresSquareBase,
    isRotatedForm,
    isTubeFamily,
    dimensionsFor,
    getSupportedModifiers,
    defaultDimensionsFor,
    isPipeGroup,
    pipeVariantOf,
    pipeBaseShape,
    PipeVariant,
    ColorTheme,
    THEME_COLORS,
    DEFAULT_COLORS,
} from './shapes/shape-capabilities';
import { deriveFaceShades } from './color-derivation';
import { PRIMARY_COLORS } from './colors';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import ChevronUp16 from '@carbon/icons/es/chevron--up/16.js';
import ChevronDown16 from '@carbon/icons/es/chevron--down/16.js';
import OverflowMenuVertical16 from '@carbon/icons/es/overflow-menu--vertical/16.js';
import SettingsEdit16 from '@carbon/icons/es/settings--edit/16.js';
import Save16 from '@carbon/icons/es/save/16.js';
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
import { getIconById, addUploadedIcon, removeUploadedIcon, IconCatalogEntry, ensureFullCatalog, onCatalogChange } from './icon-catalog';
import { resolveIconRender } from './icon-resolver';
import { renderIcon } from './icon-renderer';

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
import {
    shapeStore,
    listUserFolders,
    createUserFolder,
    renameUserFolder,
    deleteUserFolder,
    userFolderNameExists,
} from './shape-store';
import { saveToInventory, isDarkMode } from './svg-inventory';
import { getComponentCollections } from './admin';
import { buildComponentPanel, formatLabel, ComponentTreeItem, USER_CREATED_COLLECTION } from './component-tree';

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

// One-shot cleanup: an earlier version stored per-shape user defaults under
// this key. The feature is gone; remove stale entries so they don't linger.
try { localStorage.removeItem('nextrack-base-shape-defaults-v1'); } catch { /* ignore */ }

// Single chokepoint for "write these three dimensions into the stepper UI".
// Writes the hidden numeric input, syncs the visible display input, and runs
// onFieldChange so the layer + cell + recenter all stay in lock-step.
// Every caller that programmatically changes dimensions MUST go through here
// — bypassing this is what produced the display-vs-form drift in the past.
function setDimensionInputs(w: number, h: number, d: number): void {
    widthInput.value  = String(w);
    heightInput.value = String(h);
    depthInput.value  = String(d);
    if (widthDisplayEl)  widthDisplayEl.value  = `${Math.round(w)}px`;
    if (heightDisplayEl) heightDisplayEl.value = `${Math.round(h)}px`;
    if (depthDisplayEl)  depthDisplayEl.value  = `${Math.round(d)}px`;
    onFieldChange();
}

// Switch the current layer between round (tube/pipe) and octagonal
// (duct/channel) variants of the Pipe group. Preserves the current rotation
// and dimensions — only the cross-section changes.
function switchPipeVariant(variant: PipeVariant): void {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    const current = currentBaseShape();
    if (!isPipeGroup(current)) return;
    const rotated = isRotatedForm(current);
    const next = pipeBaseShape(variant, rotated);
    if (next === current) return;
    layer.baseShape = next;
    applyFormFactorToCanvas();
    buildInspectorPanel();
    markDirty();
}

// Default per-base-shape dimensions live centrally in shape-capabilities.ts
// (`defaultDimensionsFor`). When switching base shape, the dimensions MUST
// be reset to the canonical defaults — the previous layer's values are never
// preserved across a base-shape change.
function applyBaseShapeDefaults(baseShape: BaseShape): void {
    const layer = layers[selectedLayerIndex];
    const defs = defaultDimensionsFor(baseShape);
    setDimensionInputs(defs.width, defs.height, defs.depth);
    if (layer) {
        applyCornerRadiusToCurrentShape(0);
        applyChamferSizeToCurrentShape(0);
        applyChamferStartToCurrentShape(0);
        applyChamferBottomSizeToCurrentShape(0);
        applyChamferBottomStartToCurrentShape(0);
        applyTwistToCurrentShape(0);
        applyScaleTopXToCurrentShape(1);
        applyScaleTopYToCurrentShape(1);
        applyShedRoofToCurrentShape(0, 'front');
    }
}

const SIDEBAR_INSET = 0;
let currentShape: IsometricShape | null = null;
let currentShape2D: IsometricShape | null = null;
let currentShapeId = '';
let currentZoom  = 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gridVEl: any = null;

// Per-IconEntry / per-Layer modifier globals (face/size/offset/skew/bg*,
// cornerRadius/chamfer*/twist/scaleTop*/shedRoof*) used to live as
// parallel module globals here. They have been removed; the entry / layer
// is the sole source of truth (see docs/adr/0001-input-sync-protocol.md).
//
// baseShape and style live on the layer; the helpers below read them
// fresh on every call, so any caller that previously read the global gets
// the current-layer value with no parallel cache.

function currentBaseShape(): BaseShape {
    return (layers[selectedLayerIndex]?.baseShape ?? 'rectangle') as BaseShape;
}

function currentStyle() {
    const s = layers[selectedLayerIndex]?.style;
    return {
        topColor:    s?.topColor    ?? '',
        sideColor:   s?.sideColor   ?? '',
        frontColor:  s?.frontColor  ?? '',
        strokeColor: s?.strokeColor ?? '',
    };
}

// Per-layer modifier state (cornerRadius / chamfer* / twist /
// scaleTop* / shedRoof*) used to live as parallel module globals here.
// They are gone — the layer itself (`layers[selectedLayerIndex].X`) is the
// sole source of truth and the modifier panel reads from it on rebuild and
// in syncInspectorToLayer. See docs/adr/0001-input-sync-protocol.md.

// Rotation state (0 or 90; applies to all shapes except rectangle). This is
// Shape-level meta, kept as a module global because there's no per-layer
// equivalent — the rotation switcher's populator reads it and re-renders
// the active segment.
let selectedRotation = 0;
let rotationAccordionLi: HTMLLIElement | null = null;

// SVG footprint state (complex shape mode only)
let svgParseError = '';

// Icon background state (not persisted to registry)
let dimensionYAdjustable = false;
let resizeFromInput = false;
let dimBehaviourRowEl: HTMLElement | null = null;
let hudRotateItemEl: HTMLElement | null = null;

// Icon background lives entirely on the IconEntry now. The bg-related
// module globals (bgEnabled / bgColor / bgSize / bgShape / bgRadius /
// bgChamfer) were the last carriers of "what's currently being edited";
// they are gone — see docs/adr/0001-input-sync-protocol.md.

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

// ── Layer state ────────────────────────────────────────────────────────────────
let layers: ShapeLayer[] = [];
let selectedLayerIndex = 0;
let layerShapes: IsometricShape[]   = [];  // ISO canvas shapes, one per layer
let layerShapes2D: IsometricShape[] = [];  // 2D canvas shapes, one per layer

// Re-apply theme-dependent fill/stroke on every layer when the document
// theme (cds--g100) flips OR when the central color-derivation settings
// change (admin Color Adjustment UI). SVG attr values are stamped on the
// elements and don't change with a CSS class toggle.
const _reapplyAllLayerStyles = () => {
    for (let i = 0; i < layers.length; i++) {
        const sty = layers[i]?.style;
        if (!sty) continue;
        if (layerShapes[i])   applyShapeStyle(layerShapes[i],   sty);
        if (layerShapes2D[i]) applyShapeStyle(layerShapes2D[i], sty);
    }
    // Icon 2D hrefs bake in the current theme (currentColor → black/white)
    // and per-vendor settings — rebuild them on every theme/setting change.
    applyIconToCurrentShape();
};
window.addEventListener('nr-theme-change', _reapplyAllLayerStyles);
window.addEventListener('nr-color-derivation-change', _reapplyAllLayerStyles);
window.addEventListener('nr-icon-rendering-change', _reapplyAllLayerStyles);
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

// Adaptive icon (no-bg + complex shape only): icon color follows app theme.
// Lives on IconEntry.adaptive; the toggle row ref is kept here so the
// populator in buildIconContent can flip its display when bg is enabled.
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
// The 2D paper is permanently in icon-only mode — hide shape body faces so
// only the centered 40×40 icon shows through. SD toggles this class
// dynamically; in the CD the 2D paper exists in parallel to the iso paper,
// so the class is set statically here.
paper2D.el.classList.add('nr-2d-icons-only');

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

// ── Mutation chokepoints ─────────────────────────────────────────────────────
// All icon and layer mutations MUST flow through these functions. They
// atomically mutate the data, mark the inspector dirty (Save button active),
// and trigger the render. Outside callers should never mutate
// layers[i].* or iconEntries[i].* directly — call one of these instead.

/**
 * Set the Shape's label, anchored to the floor plane even when Layer 0 floats.
 *
 * The label is conceptually a Shape-level property, not a per-Layer one. In
 * the current implementation it hangs visually on `layerShapes[0]`, but to
 * keep it at the floor plane (where the Hit Area sits) we compensate the
 * label's transform for Layer 0's baseElevation in the ISO view. In the 2D
 * view no elevation offset is applied, so no compensation is needed.
 */
function setShapeLabel(text: string): void {
    const elev = layers[0]?.baseElevation ?? 0;
    layerShapes[0]?.attr('label/text', text);
    // Push the label diagonally down-right by `elev` to counter the iso
    // projection's up-left shift caused by layer-0 elevation.
    layerShapes[0]?.attr('label/transform', elev ? `translate(${elev} ${elev})` : '');
    layerShapes2D[0]?.attr('label/text', text);
}

// ── Populator registry ──────────────────────────────────────────────────────
// Implements the Populate side of the input-sync protocol
// (docs/adr/0001-input-sync-protocol.md). Each input that displays Editor
// Draft state registers a populator function during DOM build; populate()
// re-runs all of them. Populators read fresh from the model on every call,
// so calling populate() at selection-change or after any mutation keeps the
// UI in sync with the Draft without any per-field wiring.

let populators: Array<() => void> = [];

function registerPopulator(fn: () => void): void {
    populators.push(fn);
}

function clearPopulators(): void {
    populators = [];
}

function populate(): void {
    for (const fn of populators) {
        try { fn(); } catch (e) {
            // A populator referencing a stale DOM node shouldn't break the
            // chain — log and continue so other inputs still refresh.
            // eslint-disable-next-line no-console
            console.warn('[populate] populator threw', e);
        }
    }
}

/**
 * The IconEntry currently being edited in the inspector. Null when no entry
 * is open (editingIconIndex === -1 or out of range).
 */
function currentEditingEntry(): IconEntry | null {
    if (editingIconIndex < 0 || editingIconIndex >= iconEntries.length) return null;
    return iconEntries[editingIconIndex];
}

/**
 * Lookup helper: find an IconEntry by stable id within the active editing
 * context (the selected layer's icons).
 */
function findIconEntry(entryId: string): IconEntry | undefined {
    return layers[selectedLayerIndex]?.icons?.find(e => e.id === entryId);
}

/**
 * Get the current editing context's icon array (live reference, not a copy).
 * Mutations here will affect the persisted data.
 */
function currentIconsArray(): IconEntry[] {
    return layers[selectedLayerIndex]?.icons ?? [];
}

/**
 * Update one icon entry. Returns true on success.
 * This is the single chokepoint that guarantees:
 *   1. The data is mutated.
 *   2. markDirty() fires (Save button activates).
 *   3. The canvas re-renders.
 */
function updateIcon(entryId: string, patch: Partial<IconEntry>): boolean {
    const entry = findIconEntry(entryId);
    if (!entry) return false;
    Object.assign(entry, patch);
    markDirty();
    applyIconToCurrentShape();
    populate();
    return true;
}

/** Add a new icon entry to the current layer. Returns the new entry.
 *  isMain is true only if no other IconEntry in any Layer of this Shape has it
 *  (CONTEXT.md: isMain is per-Shape, not per-Layer). */
function addIcon(partial: Partial<IconEntry> = {}): IconEntry {
    const arr = currentIconsArray();
    const shapeHasMain = layers.some(l => l.icons.some(e => e.isMain));
    const entry = defaultIconEntry({ isMain: !shapeHasMain, ...partial });
    arr.push(entry);
    markDirty();
    applyIconToCurrentShape();
    populate();
    return entry;
}

/** Remove an icon entry by stable id. Returns true on success. */
function removeIcon(entryId: string): boolean {
    const arr = currentIconsArray();
    const idx = arr.findIndex(e => e.id === entryId);
    if (idx < 0) return false;
    // The Main IconEntry is the Shape's identity icon and cannot be removed.
    if (arr[idx].isMain) return false;
    arr.splice(idx, 1);
    markDirty();
    applyIconToCurrentShape();
    populate();
    return true;
}

/** Mark one icon as the Main icon (exclusive across the whole Shape — clears
 *  isMain on every other IconEntry in every other Layer too, since isMain is
 *  per-Shape, not per-Layer). */
function setMainIcon(entryId: string): boolean {
    let target: IconEntry | undefined;
    for (const l of layers) {
        const found = l.icons.find(e => e.id === entryId);
        if (found) { target = found; break; }
    }
    if (!target) return false;
    for (const l of layers) {
        for (const e of l.icons) e.isMain = (e === target);
    }
    markDirty();
    applyIconToCurrentShape();
    populate();
    return true;
}

/** Reorder icons within the current layer. */
function reorderIcons(fromIdx: number, toIdx: number): boolean {
    const arr = currentIconsArray();
    if (fromIdx < 0 || fromIdx >= arr.length || toIdx < 0 || toIdx >= arr.length) return false;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    markDirty();
    applyIconToCurrentShape();
    populate();
    return true;
}

/** Update a Layer's geometric/style properties. */
function updateLayer(layerId: string, patch: Partial<ShapeLayer>): boolean {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return false;
    Object.assign(layer, patch);
    markDirty();
    renderLayersOnCanvas();
    populate();
    return true;
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
    input.style.display = 'none';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    assignInput(input);

    // Display element shows px value + unit. Read-only by design: numeric
    // input is via −/+ buttons or drag-to-scrub only — no free text entry.
    const displayEl = document.createElement('input');
    displayEl.type = 'text';
    displayEl.className = 'nr-sd-number-display';
    displayEl.readOnly = true;
    displayEl.style.userSelect = 'none';
    displayEl.style.cursor = 'ew-resize';
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

    stepper.appendChild(input);
    stepper.appendChild(displayEl);
    stepper.appendChild(resetBtn);
    stepper.appendChild(decBtn);
    stepper.appendChild(incBtn);
    row.appendChild(stepper);
    container.appendChild(row);
}

function currentDimensionsPx(): { wPx: number; hPx: number; dPx: number } {
    const swapped = isRotatedForm(currentBaseShape());
    if (currentShape) {
        const { width, height } = currentShape.size();
        return { wPx: swapped ? height : width, hPx: swapped ? width : height, dPx: (currentShape.get('isometricHeight') ?? 0) };
    }
    const reg = ShapeRegistry[currentShapeId];
    const layer0 = reg?.layers?.[0];
    const rawW = layer0?.width ?? GRID_SIZE * 2;
    const rawH = layer0?.height ?? GRID_SIZE * 2;
    return {
        wPx: swapped ? rawH : rawW,
        hPx: swapped ? rawW : rawH,
        dPx: layer0?.depth ?? GRID_SIZE * 0.5,
    };
}

function buildDimensionsContent(container: HTMLElement) {
    const { wPx, hPx, dPx } = currentDimensionsPx();
    const dims = dimensionsFor(currentBaseShape());
    // Y holds the diameter when the second slider is "Diameter" (tube family);
    // otherwise it holds the model height.
    const ySource = dims.z === null ? dPx : hPx;

    buildSliderField(dims.x.label, 'sd-width', 1, 160, 1,
        (el) => { widthInput = el; el.value = String(wPx); },
        (el) => { widthValueEl = el; },
        onFieldChange, container);

    buildSliderField(dims.y.label, 'sd-height', 1, 160, 1,
        (el) => { heightInput = el; el.value = String(ySource); },
        (el) => { heightValueEl = el; },
        onFieldChange, container);

    if (dims.z === null) {
        // Depth is derived (= diameter) for tube-family shapes — keep a hidden
        // input so downstream readers still find it.
        depthInput = document.createElement('input');
        depthInput.type = 'hidden';
        depthInput.value = String(dPx);
        container.appendChild(depthInput);
        depthValueEl = null;
        depthDisplayEl = null;
    } else {
        buildSliderField(dims.z.label, 'sd-depth', 0, 160, 1,
            (el) => { depthInput = el; el.value = String(dPx); },
            (el) => { depthValueEl = el; },
            onFieldChange, container);
    }

    // Capture visible display inputs for external sync
    const rows = container.querySelectorAll<HTMLElement>('.nr-sd-number-row');
    widthDisplayEl  = rows[0]?.querySelector('.nr-sd-number-display') ?? null;
    heightDisplayEl = rows[1]?.querySelector('.nr-sd-number-display') ?? null;
    if (dims.z !== null) depthDisplayEl = rows[2]?.querySelector('.nr-sd-number-display') ?? null;

    // Dimension Behaviour switcher (only for duct/pipe)
    const showBehaviour = currentBaseShape() === 'duct' || currentBaseShape() === 'pipe'
        || currentBaseShape() === 'tube' || currentBaseShape() === 'channel';
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
        const defs = defaultDimensionsFor(currentBaseShape());
        setDimensionInputs(defs.width, defs.height, defs.depth);
    });
    container.appendChild(resetBtn);
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

    // Pipe variant switcher (Round / Octagonal) — only shown when the current
    // base shape is part of the pipe variant group. Switching writes the
    // matching BaseShape onto the layer (preserving rotation) without
    // resetting dimensions. Style mirrors the icon editor's Bg Shape switcher.
    const variantRow = document.createElement('div');
    variantRow.className = 'nr-sd-face-row';
    variantRow.dataset.pipeVariantRow = 'true';
    const variantLabel = document.createElement('label');
    variantLabel.className = 'nr-sd-row-label';
    variantLabel.textContent = 'Cross-section';
    variantRow.appendChild(variantLabel);
    const variantSwitcher = document.createElement('div');
    variantSwitcher.className = 'nr-seg-control nr-seg-control--fixed';
    for (const v of ['round', 'octagonal'] as PipeVariant[]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn';
        const label = v === 'round' ? 'Round' : 'Octagonal';
        btn.title = label;
        btn.textContent = label;
        btn.dataset.variant = v;
        btn.addEventListener('click', () => switchPipeVariant(v));
        variantSwitcher.appendChild(btn);
    }
    variantRow.appendChild(variantSwitcher);
    container.appendChild(variantRow);

    const layerForBuild = () => layers[selectedLayerIndex];

    const cornerRadiusRow = document.createElement('div');
    cornerRadiusRow.dataset.modifier = 'cornerRadius';
    buildSliderField('Corner Radius', 'sd-corner-radius', 0, 30, 1,
        (el) => { cornerRadiusInput = el; el.value = String(layerForBuild()?.cornerRadius ?? 0); },
        (el) => { cornerRadiusValueEl = el; },
        () => { applyCornerRadiusToCurrentShape(parseInt(cornerRadiusInput.value, 10)); },
        cornerRadiusRow, 'px');
    container.appendChild(cornerRadiusRow);

    const chamferRow = document.createElement('div');
    chamferRow.dataset.modifier = 'chamfer';
    buildSliderField('Top Chamfer', 'sd-chamfer', 0, 30, 1,
        (el) => { chamferSizeInput = el; el.value = String(layerForBuild()?.chamferSize ?? 0); },
        (el) => { chamferSizeValueEl = el; },
        () => { applyChamferSizeToCurrentShape(parseInt(chamferSizeInput.value, 10)); },
        chamferRow, 'px');
    container.appendChild(chamferRow);

    const chamferHeightRow = document.createElement('div');
    chamferHeightRow.dataset.modifier = 'chamferHeight';
    buildSliderField('Top Chamfer %', 'sd-chamfer-start', 0, 1, 0.05,
        (el) => { chamferStartInput = el; el.value = String(layerForBuild()?.chamferStart ?? 0); },
        (el) => { chamferStartVal = el; },
        () => { applyChamferStartToCurrentShape(parseFloat(chamferStartInput.value)); },
        chamferHeightRow, '%');
    container.appendChild(chamferHeightRow);

    const chamferBottomRow = document.createElement('div');
    chamferBottomRow.dataset.modifier = 'chamferBottom';
    buildSliderField('Bottom Chamfer', 'sd-chamfer-bottom', 0, 30, 1,
        (el) => { chamferBottomSizeInput = el; el.value = String(layerForBuild()?.chamferBottomSize ?? 0); },
        (el) => { chamferBottomSizeValueEl = el; },
        () => { applyChamferBottomSizeToCurrentShape(parseInt(chamferBottomSizeInput.value, 10)); },
        chamferBottomRow, 'px');
    container.appendChild(chamferBottomRow);

    const chamferBottomHeightRow = document.createElement('div');
    chamferBottomHeightRow.dataset.modifier = 'chamferBottomHeight';
    buildSliderField('Bottom Chamfer %', 'sd-chamfer-bottom-start', 0, 1, 0.05,
        (el) => { chamferBottomStartInput = el; el.value = String(layerForBuild()?.chamferBottomStart ?? 0); },
        (el) => { chamferBottomStartVal = el; },
        () => { applyChamferBottomStartToCurrentShape(parseFloat(chamferBottomStartInput.value)); },
        chamferBottomHeightRow, '%');
    container.appendChild(chamferBottomHeightRow);

    const twistRow = document.createElement('div');
    twistRow.dataset.modifier = 'twist';
    buildSliderField('Twist', 'sd-twist', -180, 180, 5,
        (el) => { twistInput = el; el.value = String(layerForBuild()?.twist ?? 0); },
        (el) => { twistValueEl = el; },
        () => { applyTwistToCurrentShape(parseFloat(twistInput.value)); },
        twistRow, '°');
    container.appendChild(twistRow);

    const stxRow = document.createElement('div');
    stxRow.dataset.modifier = 'scaleTopX';
    buildSliderField('Scale Top X', 'sd-scale-top-x', 0, 2, 0.05,
        (el) => { stxInput = el; el.value = String(layerForBuild()?.scaleTopX ?? 1); },
        (el) => { stxValueEl = el; },
        () => { applyScaleTopXToCurrentShape(parseFloat(stxInput.value)); },
        stxRow);
    container.appendChild(stxRow);

    const styRow = document.createElement('div');
    styRow.dataset.modifier = 'scaleTopY';
    buildSliderField('Scale Top Y', 'sd-scale-top-y', 0, 2, 0.05,
        (el) => { styInput = el; el.value = String(layerForBuild()?.scaleTopY ?? 1); },
        (el) => { styValueEl = el; },
        () => { applyScaleTopYToCurrentShape(parseFloat(styInput.value)); },
        styRow);
    container.appendChild(styRow);

    // Shed Roof
    const shedDropRow = document.createElement('div');
    shedDropRow.dataset.modifier = 'shedRoof';
    buildSliderField('Shed Roof', 'sd-shed-drop', 0, 30, 1,
        (el) => { shedDropInput = el; el.value = String(layerForBuild()?.shedRoofDrop ?? 0); },
        (el) => { shedDropValueEl = el; },
        () => {
            const layer = layerForBuild();
            applyShedRoofToCurrentShape(parseInt(shedDropInput.value, 10), layer?.shedRoofDirection ?? 'front');
        },
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
    const shedDirButtons: Record<string, HTMLButtonElement> = {};
    for (const dir of shedDirDefs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const val = dir.val;
        btn.className = 'nr-seg-btn';
        btn.title = dir.label;
        btn.innerHTML = carbonIconToString(dir.icon);
        btn.addEventListener('click', () => {
            const layer = layerForBuild();
            applyShedRoofToCurrentShape(layer?.shedRoofDrop ?? 0, val);
            populate();
        });
        shedDirButtons[val] = btn;
        shedDirSwitcher.appendChild(btn);
    }
    registerPopulator(() => {
        const dir = layerForBuild()?.shedRoofDirection ?? 'front';
        for (const v of ['front', 'right', 'back', 'left']) {
            shedDirButtons[v]?.classList.toggle('nr-seg-btn--selected', v === dir);
        }
    });
    shedDirRow.appendChild(shedDirSwitcher);
    container.appendChild(shedDirRow);

    const modResetBtn = document.createElement('button');
    modResetBtn.type = 'button';
    modResetBtn.className = 'nr-sd-reset-btn';
    modResetBtn.title = 'Reset to default';
    modResetBtn.innerHTML = 'Reset to default';
    modResetBtn.addEventListener('click', () => {
        // Modifier reset = identity values (no chamfer, no twist, etc.).
        // Per-modifier user defaults are no longer stored.
        cornerRadiusInput.value      = '0';  applyCornerRadiusToCurrentShape(0);
        chamferSizeInput.value       = '0';  applyChamferSizeToCurrentShape(0);
        chamferStartInput.value      = '0';  applyChamferStartToCurrentShape(0);
        chamferBottomSizeInput.value = '0';  applyChamferBottomSizeToCurrentShape(0);
        chamferBottomStartInput.value= '0';  applyChamferBottomStartToCurrentShape(0);
        twistInput.value             = '0';  applyTwistToCurrentShape(0);
        stxInput.value               = '1';  applyScaleTopXToCurrentShape(1);
        styInput.value               = '1';  applyScaleTopYToCurrentShape(1);
        shedDropInput.value          = '0';  applyShedRoofToCurrentShape(0, 'front');
        // For pipe-group shapes, also reset the cross-section to Round.
        if (isPipeGroup(currentBaseShape())) switchPipeVariant('round');
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
            apply(layerShapes[selectedLayerIndex]);
            apply(layerShapes2D[selectedLayerIndex]);
        },
        opacityRow, '%');
    container.appendChild(opacityRow);
    */
}

function buildPositionContent(container: HTMLElement) {
    const layer = layers[selectedLayerIndex] ?? null;
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

    const posResetBtn = document.createElement('button');
    posResetBtn.type = 'button';
    posResetBtn.className = 'nr-sd-reset-btn';
    posResetBtn.title = 'Reset offset and elevation to default';
    posResetBtn.innerHTML = 'Reset to default';
    posResetBtn.addEventListener('click', () => {
        offsetXInput.value        = '0';
        offsetYInput.value        = '0';
        baseElevationInput.value  = '0';
        const setDisp = (input: HTMLInputElement, val: number) => {
            const row = input.closest('.nr-sd-number-row');
            const display = row?.querySelector('.nr-sd-number-display') as HTMLInputElement | null;
            if (display) display.value = `${val}px`;
        };
        setDisp(offsetXInput, 0);
        setDisp(offsetYInput, 0);
        setDisp(baseElevationInput, 0);
        onOffsetChange();
    });
    container.appendChild(posResetBtn);
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

    const rotationButtons: Record<0 | 90, HTMLButtonElement> = { 0: null!, 90: null! };
    for (const angle of [0, 90] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-sd-face-btn';
        btn.textContent = `${angle}°`;
        btn.addEventListener('click', () => {
            applyRotation(angle);
            populate();
        });
        rotationButtons[angle] = btn;
        switcher.appendChild(btn);
    }

    registerPopulator(() => {
        rotationButtons[0].classList.toggle('nr-sd-face-btn--active', selectedRotation === 0);
        rotationButtons[90].classList.toggle('nr-sd-face-btn--active', selectedRotation === 90);
    });

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
    rectangle:    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`,
    circle:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>`,
    pyramid:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="12,4 20,20 4,20"/></svg>`,
    octagon:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="8,4 16,4 20,8 20,16 16,20 8,20 4,16 4,8"/></svg>`,
    tube:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><ellipse cx="18" cy="12" rx="3" ry="6"/><line x1="6" y1="6" x2="18" y2="6"/><line x1="6" y1="18" x2="18" y2="18"/><ellipse cx="6" cy="12" rx="3" ry="6"/></svg>`,
    duct:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="9,4 15,4 19,8 19,16 15,20 9,20 5,16 5,8"/><line x1="9" y1="4" x2="12" y2="4" stroke-dasharray="2 2" opacity="0.4"/></svg>`,
    pipe:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6" rx="6" ry="3"/><line x1="6" y1="6" x2="6" y2="18"/><line x1="18" y1="6" x2="18" y2="18"/><ellipse cx="12" cy="18" rx="6" ry="3"/></svg>`,
    channel:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="4,9 8,5 16,5 20,9 20,15 16,19 8,19 4,15"/></svg>`,
    custom:    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polygon points="4,8 12,4 20,10 16,20 6,18"/></svg>`,
};

function buildFormFactorContent(container: HTMLElement) {
    // Pipe is one dropdown entry covering tube/pipe/duct/channel — the
    // round/octagonal split lives in the modifier panel's variant switcher.
    const options: { value: BaseShape; label: string }[] = [
        { value: 'rectangle',   label: 'Rectangle' },
        { value: 'circle',      label: 'Circle' },
        { value: 'octagon',     label: 'Octagon' },
        { value: 'tube',        label: 'Pipe' },
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

    // All four pipe-group variants render as the single 'tube' dropdown entry
    // labelled "Pipe"; the round/octagonal split is a modifier-panel switcher.
    // hexahedron is an alias for rectangle, svgPolygon for custom — map them
    // so the trigger lookup never lands on a value missing from `options`.
    const PRIMARY_SHAPE: Record<string, string> = {
        pipe: 'tube', channel: 'tube', duct: 'tube',
        hexahedron: 'rectangle',
        svgPolygon: 'custom',
    };
    const setTriggerContent = (value: BaseShape) => {
        const displayValue = PRIMARY_SHAPE[value] || value;
        const opt = options.find(o => o.value === displayValue) ?? options[0];
        trigger.innerHTML = `<span class="nr-sd-dropdown__icon">${FORM_FACTOR_PREVIEWS_SVG[displayValue] ?? ''}</span><span class="nr-sd-dropdown__text">${opt.label}</span><svg class="nr-sd-dropdown__chevron" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`;
    };
    setTriggerContent(currentBaseShape());

    syncFormFactorDropdown = () => {
        setTriggerContent(currentBaseShape());
        menu.querySelectorAll('.nr-sd-dropdown__item--selected').forEach(el => el.classList.remove('nr-sd-dropdown__item--selected'));
        const active = menu.querySelector(`[data-value="${currentBaseShape()}"]`) ||
            menu.querySelector(`[data-value="${PRIMARY_SHAPE[currentBaseShape()] || currentBaseShape()}"]`);
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
        if (opt.value === currentBaseShape()) li.classList.add('nr-sd-dropdown__item--selected');
        li.innerHTML = `<span class="nr-sd-dropdown__icon">${FORM_FACTOR_PREVIEWS_SVG[opt.value] ?? ''}</span><span class="nr-sd-dropdown__text">${opt.label}</span>`;

        li.addEventListener('click', () => {
            // Form-factor pick: write the new base shape onto the current
            // layer. Downstream calls re-read it via currentBaseShape().
            const layer = layers[selectedLayerIndex];
            if (layer) layer.baseShape = opt.value;
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
            // Pipe-group base shapes (round + octagonal variants × rotations)
            // ship with rotation variations enabled.
            if (isPipeGroup(opt.value)) hasVariations = true;
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
    veContainer.style.display = currentBaseShape() === 'custom' ? '' : 'none';

    const VE_PAD = 12;
    const VE_HANDLE = 6;
    // The drawing view is always a 16×16 square regardless of the actual
    // shape dimensions — normalized coordinates (0..1 in both axes) decouple
    // the editor from the rendered aspect ratio.
    const VE_GRID = 16;
    const VE_SNAP_X = 1 / VE_GRID;
    const VE_SNAP_Y = 1 / VE_GRID;
    const VE_SIZE_X = VE_PAD * 2 + VE_GRID * 10;
    const VE_SIZE_Y = VE_SIZE_X;
    const VE_MAJOR_STEP = 4;

    const veSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    veSvg.setAttribute('width', String(VE_SIZE_X));
    veSvg.setAttribute('height', String(VE_SIZE_Y));
    veSvg.setAttribute('viewBox', `0 0 ${VE_SIZE_X} ${VE_SIZE_Y}`);
    veSvg.classList.add('nr-vertex-editor__svg');

    const veGridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const areaX = VE_SIZE_X - VE_PAD * 2;
    const areaY = VE_SIZE_Y - VE_PAD * 2;
    for (let i = 0; i <= VE_GRID; i++) {
        const yPos = VE_PAD + (i / VE_GRID) * areaY;
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', String(VE_PAD));
        hLine.setAttribute('y1', String(yPos));
        hLine.setAttribute('x2', String(VE_PAD + areaX));
        hLine.setAttribute('y2', String(yPos));
        hLine.classList.add('nr-vertex-editor__grid-line');
        if (i % VE_MAJOR_STEP === 0) hLine.classList.add('nr-vertex-editor__grid-line--major');
        veGridGroup.appendChild(hLine);

        const xPos = VE_PAD + (i / VE_GRID) * areaX;
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', String(xPos));
        vLine.setAttribute('y1', String(VE_PAD));
        vLine.setAttribute('x2', String(xPos));
        vLine.setAttribute('y2', String(VE_PAD + areaY));
        vLine.classList.add('nr-vertex-editor__grid-line');
        if (i % VE_MAJOR_STEP === 0) vLine.classList.add('nr-vertex-editor__grid-line--major');
        veGridGroup.appendChild(vLine);
    }
    veSvg.appendChild(veGridGroup);

    const vePolygonsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    veSvg.appendChild(vePolygonsGroup);

    const veHandlesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    veSvg.appendChild(veHandlesGroup);

    const veEdgeHitsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    veSvg.insertBefore(veEdgeHitsGroup, veHandlesGroup);

    // Two-column layout: sidebar (add buttons + path list) on the left,
    // drawing grid on the right.
    const veBody = document.createElement('div');
    veBody.className = 'nr-vertex-editor__body';

    const veSidebar = document.createElement('div');
    veSidebar.className = 'nr-vertex-editor__sidebar';

    const veMain = document.createElement('div');
    veMain.className = 'nr-vertex-editor__main';

    // Sidebar contents: add-buttons row on top, then the list of added paths.
    const vePathToolbar = document.createElement('div');
    vePathToolbar.className = 'nr-ve-path-toolbar';

    const vePathTabsEl = document.createElement('div');
    vePathTabsEl.className = 'nr-ve-path-tabs';

    // Two add buttons \u2014 Path (closed polygon = footprint) vs. Line (open
    // polyline drawn on the top face only). Type is set on creation and
    // cannot be changed afterwards.
    const veAddPathBtn = document.createElement('button');
    veAddPathBtn.type = 'button';
    veAddPathBtn.className = 'nr-ve-path-add';
    veAddPathBtn.textContent = '+ Path';
    veAddPathBtn.title = 'New path (closed polygon)';
    veAddPathBtn.addEventListener('click', () => {
        editorPaths.push({ type: 'polygon', verts: [[0.25, 0.25], [0.5, 0.25], [0.5, 0.5], [0.25, 0.5]] });
        activePathIdx = editorPaths.length - 1;
        rebuildPathTabs();
        veRender();
        veApply();
    });
    vePathToolbar.appendChild(veAddPathBtn);

    const veAddLineBtn = document.createElement('button');
    veAddLineBtn.type = 'button';
    veAddLineBtn.className = 'nr-ve-path-add';
    veAddLineBtn.textContent = '+ Line';
    veAddLineBtn.title = 'New line (open polyline on top face)';
    veAddLineBtn.addEventListener('click', () => {
        editorPaths.push({ type: 'line', verts: [[0.25, 0.5], [0.75, 0.5]] });
        activePathIdx = editorPaths.length - 1;
        rebuildPathTabs();
        veRender();
        veApply();
    });
    vePathToolbar.appendChild(veAddLineBtn);

    veSidebar.appendChild(vePathToolbar);
    veSidebar.appendChild(vePathTabsEl);

    veMain.appendChild(veSvg);
    const veHint = document.createElement('div');
    veHint.className = 'nr-vertex-editor__hint';
    veHint.textContent = 'Drag vertices. Double-click edge to add. Right-click vertex to remove.';
    veMain.appendChild(veHint);

    veBody.appendChild(veSidebar);
    veBody.appendChild(veMain);
    veContainer.appendChild(veBody);

    container.appendChild(veContainer);

    // Unified path model: polygons (closed, define footprint) + lines (open,
    // overlay on top face). Lines are stored separately on the layer/cell.
    interface EditorPath { type: 'polygon' | 'line'; verts: [number, number][] }
    let editorPaths: EditorPath[] = [{ type: 'polygon', verts: [[0, 0], [1, 0], [1, 1], [0, 1]] }];
    let activePathIdx = 0;

    if (currentBaseShape() === 'custom' && currentShape) {
        editorPaths = loadEditorPaths();
    }

    function loadEditorPaths(): EditorPath[] {
        const result: EditorPath[] = [];
        const raw = currentShape?.get('normalizedVerts');
        if (raw && raw.length > 0) {
            if (typeof raw[0][0] === 'number') {
                result.push({ type: 'polygon', verts: (raw as [number, number][]).map(v => [...v] as [number, number]) });
            } else {
                for (const p of raw as [number, number][][]) {
                    result.push({ type: 'polygon', verts: p.map(v => [...v] as [number, number]) });
                }
            }
        }
        const linesRaw = currentShape?.get('lines') as [number, number][][] | undefined;
        if (linesRaw && linesRaw.length > 0) {
            for (const l of linesRaw) {
                result.push({ type: 'line', verts: l.map(v => [...v] as [number, number]) });
            }
        }
        if (result.length === 0) {
            result.push({ type: 'polygon', verts: [[0, 0], [1, 0], [1, 1], [0, 1]] });
        }
        return result;
    }

    function rebuildPathTabs() {
        vePathTabsEl.innerHTML = '';
        // Number paths and lines independently for readable tab labels.
        let pathCounter = 0;
        let lineCounter = 0;
        editorPaths.forEach((path, idx) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'nr-ve-path-tab' + (idx === activePathIdx ? ' nr-ve-path-tab--active' : '');
            const label = document.createElement('span');
            label.textContent = path.type === 'polygon'
                ? `Path ${++pathCounter}`
                : `Line ${++lineCounter}`;
            tab.appendChild(label);
            tab.addEventListener('click', () => {
                activePathIdx = idx;
                rebuildPathTabs();
                veRender();
            });
            if (editorPaths.length > 1) {
                const del = document.createElement('span');
                del.className = 'nr-ve-path-tab__del';
                del.textContent = '\u00d7';
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    editorPaths.splice(idx, 1);
                    if (activePathIdx >= editorPaths.length) activePathIdx = editorPaths.length - 1;
                    rebuildPathTabs();
                    veRender();
                    veApply();
                });
                tab.appendChild(del);
            }
            vePathTabsEl.appendChild(tab);
        });
        vePathToolbar.style.display = currentBaseShape() === 'custom' ? '' : 'none';
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

        for (let p = 0; p < editorPaths.length; p++) {
            const ep = editorPaths[p];
            const pts = ep.verts.map(([nx, ny]) => veToScreen(nx, ny));
            const shape = document.createElementNS('http://www.w3.org/2000/svg',
                ep.type === 'polygon' ? 'polygon' : 'polyline');
            shape.setAttribute('points', pts.map(([x, y]) => `${x},${y}`).join(' '));
            shape.classList.add(ep.type === 'polygon' ? 'nr-vertex-editor__polygon' : 'nr-vertex-editor__line');
            if (p !== activePathIdx) {
                shape.classList.add(ep.type === 'polygon' ? 'nr-vertex-editor__polygon--inactive' : 'nr-vertex-editor__line--inactive');
            }
            vePolygonsGroup.appendChild(shape);

            if (p !== activePathIdx) continue;

            const edgeCount = ep.type === 'polygon' ? pts.length : pts.length - 1;
            for (let i = 0; i < pts.length; i++) {
                const [x, y] = pts[i];
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', String(x));
                circle.setAttribute('cy', String(y));
                circle.setAttribute('r', String(VE_HANDLE));
                circle.classList.add('nr-vertex-editor__handle');
                circle.dataset.idx = String(i);
                veHandlesGroup.appendChild(circle);

                if (i >= edgeCount) continue;
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
        const polygons: [number, number][][] = [];
        const lines:    [number, number][][] = [];
        for (const ep of editorPaths) {
            const copy = ep.verts.map(v => [...v] as [number, number]);
            if (ep.type === 'polygon') polygons.push(copy);
            else                       lines.push(copy);
        }
        currentShape.set('normalizedVerts', polygons);
        currentShape.set('lines', lines);
        if (currentShape2D) {
            currentShape2D.set('normalizedVerts', polygons);
            currentShape2D.set('lines', lines);
        }
        const layer = layers[selectedLayerIndex];
        if (layer) {
            layer.normalizedVerts = polygons[0];
            layer.lines = lines.length > 0 ? lines : undefined;
            layer.baseShape = 'custom';
        }
        // Anchor count may have crossed the 4-vs-other boundary, which changes
        // shed-roof capability on SvgPolygonShape — refresh the modifier panel.
        syncModifierVisibility();
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
        editorPaths[activePathIdx].verts[veDragIdx] = veFromScreen(sx, sy);
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
            editorPaths[activePathIdx].verts.splice(after + 1, 0, [nx, ny]);
            veRender();
            veApply();
        }
    });

    // Right-click vertex to remove (min 3 for polygons, 2 for lines)
    veSvg.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        const target = e.target as SVGElement;
        if (target.classList.contains('nr-vertex-editor__handle') && target.dataset.idx) {
            const active = editorPaths[activePathIdx];
            const min = active.type === 'polygon' ? 3 : 2;
            if (active.verts.length <= min) return;
            const idx = parseInt(target.dataset.idx, 10);
            active.verts.splice(idx, 1);
            veRender();
            veApply();
        }
    });

    veContainerRef = veContainer;
    onCustomSelected = () => {
        if (currentShape) editorPaths = loadEditorPaths();
        activePathIdx = 0;
        rebuildPathTabs();
        veRender();
        veApply();
    };

    if (currentBaseShape() === 'custom') {
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

// buildCompositeIconSvg lives in utils.ts (single source of truth shared
// with SD's icon2DHref). Imported above.

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
    if (!applyingAllLayerIcons) markDirty();
    const iconShape   = currentShape;
    const iconShape2D = currentShape2D;
    if (!iconShape) return;

    // Render the multi-icon path when ANY entry has an icon or background.
    // (The previous code also checked selectedIcon / selectedIconBgEnabled
    // globals as a "legacy" fallback. With the entries as SoT, these checks
    // are redundant — and would re-introduce the drift the input-sync ADR
    // documents.)
    if (iconEntries.length > 0 && iconEntries.some(e => !!e.iconId || e.bgEnabled)) {
        const { width: shapeW, height: shapeH } = iconShape.size();
        const iH = iconShape.isometricHeight;

        // Build per-icon composites with face transforms baked in.
        //
        // Z-order: SVG paints later siblings on top, so we want the LAST
        // entry rendered to be the one the user expects on top — which is
        // the FIRST entry in the icons list (top of the list = top of the
        // stack, matching how renderIconsList shows them). We iterate the
        // entries in reverse so iconEntries[0] is appended last to isoParts.
        const isoParts: string[] = [];

        const mode = isDarkMode() ? 'dark' : 'light';
        for (let i = iconEntries.length - 1; i >= 0; i--) {
            const ie = iconEntries[i];
            if (!ie.iconId && !ie.bgEnabled) continue;
            const ieBgSize = ie.bgSize;
            const ieCanvasGU = Math.max(ie.size, ieBgSize);
            const ieCanvasPx = ieCanvasGU * GRID_SIZE;
            const ieIconPx = ie.size * GRID_SIZE;
            const ieBgPx = ieBgSize * GRID_SIZE;

            // All vendor / mono / iconColor / background decisions are made by
            // the central resolver. This loop only adds the iso-face transform.
            const decision = resolveIconRender(ie, 'isoFace', mode);
            if (!decision) continue;

            // Carbon-style line art ships with fill="currentColor"; the data
            // URI has no paint context, so resolve to a concrete colour. The
            // feColorMatrix (when iconColor is set) will overpaint it anyway.
            let ieSvgStr = decision.glyphSvg;
            if (ieSvgStr) {
                const defaultGlyphColor = mode === 'dark' ? '#ffffff' : '#000000';
                ieSvgStr = ieSvgStr.replace(/currentColor/g, defaultGlyphColor);
            }
            const ieIconColor = decision.glyphTint === 'original' ? null : decision.glyphTint;
            const bg = decision.background;

            const ieSvg = buildCompositeIconSvg(
                ieSvgStr || null,
                bg?.color ?? null,
                (bg?.shape ?? ie.bgShape),
                false, // applyWhiteFilter — superseded by glyphTint
                bg?.radius ?? ie.bgRadius,
                bg?.chamfer ?? ie.bgChamfer,
                'normal',
                false,
                ieCanvasPx, ieIconPx, ieBgPx,
                ieIconColor,
                ie.iconOpacity ?? 100,
                bg?.opacity ?? 100,
            );
            const ieHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ieSvg)}`;
            ie.href = ieHref;
            const ox = ie.offsetX * GRID_SIZE;
            const oy = ie.offsetY * GRID_SIZE;
            const skTx = (ie.skewX || ie.skewY) ? `skewX(${ie.skewX}) skewY(${ie.skewY})` : '';

            // ISO: per-face transform
            if (ie.face === 'front') {
                const lx = (shapeW - ieCanvasPx) / 2 + ox;
                const ly = (iH - ieCanvasPx) / 2 + oy;
                // Non-mirroring (det=+1) map onto the front-face parallelogram.
                isoParts.push(`<g transform="matrix(1,0,1,1,${-iH},${shapeH - iH}) ${skTx}"><image href="${ieHref}" x="${lx}" y="${ly}" width="${ieCanvasPx}" height="${ieCanvasPx}"/></g>`);
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

        // 2D: single Main icon, rendered through the shared icon2DHref so
        // SD and CD show pixel-identical output. Avoids the per-source
        // divergence that the previous inline 2D composite caused.
        const mainIE = iconEntries.find(e => !!e.iconId && e.isMain)
            ?? (iconEntries.length === 1 ? iconEntries[0] : undefined);
        const twoDHref = mainIE?.iconId ? icon2DHref(mainIE) : '';

        if (isoParts.length > 0 || twoDHref) {
            // Iso composite: large viewBox to accommodate all face projections
            const vbSize = Math.max(shapeW, shapeH) + iH * 2;
            const isoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-iH} ${-iH} ${vbSize} ${vbSize}" width="${vbSize}" height="${vbSize}">${isoParts.join('')}</svg>`;
            const isoHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(isoSvg)}`;

            const x2D = (shapeW - SHAPE_CELL_SIZE) / 2;
            const y2D = (shapeH - SHAPE_CELL_SIZE) / 2;

            iconShape.attr({
                topIcon: { href: isoHref, x: -iH, y: -iH, width: vbSize, height: vbSize, transform: null, class: '' },
                topIcon2D: { href: twoDHref, x: x2D, y: y2D, width: SHAPE_CELL_SIZE, height: SHAPE_CELL_SIZE, class: '' },
            });
            iconShape2D?.attr({
                topIcon: { href: isoHref, x: -iH, y: -iH, width: vbSize, height: vbSize, transform: null, class: '' },
                topIcon2D: { href: twoDHref, x: x2D, y: y2D, width: SHAPE_CELL_SIZE, height: SHAPE_CELL_SIZE, class: '' },
            });
            return;
        }
    }

    // Legacy single-icon path removed — every Shape is now layered, and the
    // multi-entry path above handles all rendering. If we reach this point with
    // no entries to render, clear the icon and return.
    const noIconAttrs = {
        topIcon:   { href: '', width: 0, height: 0 },
        topIcon2D: { href: '', width: 0, height: 0 },
    };
    iconShape.attr(noIconAttrs);
    iconShape2D?.attr(noIconAttrs);
}

// Re-render the Icon accordion content in place. Called when the layer set
// changes so the "Apply icon to layer" dropdown stays in sync.
function refreshIconAccordionContent(): void {
    if (!iconAccordionContentEl) return;
    iconAccordionContentEl.innerHTML = '';
    buildIconContent(iconAccordionContentEl);
}

// updateAdaptiveToggleVisibility was the imperative sync function that the
// bg-color handlers called to hide the adaptive toggle (and clear its
// global) whenever the background became enabled. It is no longer needed:
//   - the bg-color handlers now pass `adaptive: false` directly to
//     updateIcon when enabling the background, keeping the model coherent;
//   - the adaptive populator in buildIconContent reads entry.bgEnabled to
//     toggle the row's display, replacing the imperative DOM mutation.

function buildIconContent(container: HTMLElement) {
    // Cache the container so layer-count changes can trigger a rebuild
    // (see refreshIconAccordionContent). Without this the layer dropdown
    // below only reflects the layer set at inspector-construction time.
    iconAccordionContentEl = container;

    ensureFullCatalog();

    const getVisible = () => getVisibleIcons('complexShape');

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
        const allIcons: Array<{ id: string | null; label: string; svg: string; source?: string }> =
            filtered.map(ic => ({ id: ic.id, label: ic.label, svg: ic.svg, source: ic.source }));
        for (const icon of allIcons) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-sd-icon-btn';
            // The picker is a recognition surface. Resolve via the shared
            // icon-renderer so the rules match the trees / list / palette:
            // vendor + uploaded keep their original colors; carbon + custom
            // get the brightness-tint via the default CSS. Monochrome is
            // never applied here — it's a canvas-bake property.
            const rendered = icon.id ? renderIcon(icon.id, 'picker') : null;
            if (rendered?.cssClass) btn.classList.add(rendered.cssClass);
            btn.setAttribute('title', icon.label);
            btn.setAttribute('aria-label', icon.label);
            btn.setAttribute('data-icon-id', icon.id ?? '');
            btn.setAttribute('data-icon-source', icon.source ?? '');
            btn.innerHTML = rendered?.html ?? icon.svg;

            btn.addEventListener('click', () => {
                const entry = currentEditingEntry();
                if (!entry) { applyIconToCurrentShape(); markDirty(); return; }
                updateIcon(entry.id, { iconId: icon.id! });
                syncIconControlVisibility();
                if (iconsSectionBodyEl) {
                    const listEl = iconsSectionBodyEl.querySelector('div');
                    if (listEl) renderIconsListFn?.();
                }
            });

            if (icon.source === 'uploaded') {
                btn.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (confirm(`Remove uploaded icon "${icon.label}"?`)) {
                        removeUploadedIcon(icon.id!);
                        const entry = currentEditingEntry();
                        if (entry && entry.iconId === icon.id) {
                            updateIcon(entry.id, { iconId: '' });
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

            const selectUploadedIcon = (id: string) => {
                const entry = currentEditingEntry();
                if (entry) updateIcon(entry.id, { iconId: id });
                else        applyIconToCurrentShape();
                renderGrid();
            };

            if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
                const reader = new FileReader();
                reader.onload = () => {
                    const svgText = reader.result as string;
                    selectUploadedIcon(addUploadedIcon(label, svgText));
                };
                reader.readAsText(file);
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUri = reader.result as string;
                    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image href="${dataUri}" width="32" height="32"/></svg>`;
                    selectUploadedIcon(addUploadedIcon(label, svg));
                };
                reader.readAsDataURL(file);
            }
            fileInput.value = '';
        });

        uploadBtn.addEventListener('click', () => fileInput.click());
        grid.appendChild(fileInput);
        grid.appendChild(uploadBtn);

        // Apply current entry's selection state + AWS mono variant on every
        // grid (re)render. This runs not just on populate() but every time
        // the grid is rebuilt (tab switch, search filter), so the displayed
        // state always tracks the entry.
        populateGrid();
    };

    const populateGrid = () => {
        const entry = currentEditingEntry();
        grid.querySelectorAll<HTMLElement>('.nr-sd-icon-btn').forEach(btn => {
            const id = btn.dataset.iconId ?? '';
            const isSelected = id === ''
                ? !entry?.iconId
                : id === entry?.iconId;
            btn.classList.toggle('nr-sd-icon-btn--selected', isSelected);
        });
    };
    registerPopulator(populateGrid);

    searchInput.addEventListener('input', () => {
        iconSearchTerm = searchInput.value;
        renderGrid();
    });

    renderGrid();

    container.appendChild(scrollWrap);

    // Adaptive icon toggle — only in complex shape + no-bg mode
    // Uses nr-toggle: button-based, ::before thumb, no cds-- conflict.
    const adaptiveRow = document.createElement('div');
    adaptiveRow.className = 'nr-toggle';
    iconAdaptiveToggleRowEl = adaptiveRow;

    const adaptiveLabelText = document.createElement('span');
    adaptiveLabelText.className = 'nr-toggle__label-text';
    adaptiveLabelText.textContent = 'Theme adaptive';

    const adaptiveTrack = document.createElement('button');
    adaptiveTrack.type = 'button';
    adaptiveTrack.id = 'sd-icon-adaptive';
    adaptiveTrack.className = 'nr-toggle__track';
    adaptiveTrack.setAttribute('role', 'switch');
    adaptiveTrack.setAttribute('aria-label', 'Theme adaptive');

    adaptiveTrack.addEventListener('click', () => {
        const entry = currentEditingEntry();
        if (!entry) { applyIconToCurrentShape(); return; }
        updateIcon(entry.id, { adaptive: !entry.adaptive });
    });

    registerPopulator(() => {
        const entry = currentEditingEntry();
        const checked = !!entry?.adaptive;
        const bgEnabled = !!entry?.bgEnabled;
        adaptiveRow.classList.toggle('nr-toggle--checked', checked);
        adaptiveRow.style.display = bgEnabled ? 'none' : '';
        adaptiveTrack.setAttribute('aria-checked', checked ? 'true' : 'false');
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

    const modeButtons: Record<'colored' | 'mono', HTMLButtonElement> = { colored: null!, mono: null! };
    for (const mode of ['colored', 'mono'] as const) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn';
        btn.textContent = mode === 'colored' ? 'Color' : 'Mono';
        btn.addEventListener('click', () => {
            const entry = currentEditingEntry();
            if (!entry) { applyIconToCurrentShape(); return; }
            updateIcon(entry.id, { monochrome: mode === 'mono' });
            renderGrid();
        });
        modeButtons[mode] = btn;
        modeSwitcher.appendChild(btn);
    }

    iconModeRow.appendChild(modeLbl);
    iconModeRow.appendChild(modeSwitcher);
    container.appendChild(iconModeRow);

    registerPopulator(() => {
        const entry = currentEditingEntry();
        const mono = !!entry?.monochrome;
        modeButtons.colored.classList.toggle('nr-seg-btn--selected', !mono);
        modeButtons.mono.classList.toggle('nr-seg-btn--selected', mono);
    });

    function syncIconControlVisibility() {
        // Show the mode switcher only when viewing AWS icons. The selected
        // segment state inside the switcher is owned by the populator above.
        iconModeRow.style.display = iconSourceTab === 'aws' ? '' : 'none';
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
        if (!isRotatedForm(currentBaseShape())) return f;
        if (f === 'front') return 'side';
        if (f === 'side') return 'front';
        return f;
    };

    const FACES = ['top', 'front', 'side'] as const;
    const faceButtons: Record<typeof FACES[number], HTMLButtonElement> =
        { top: null!, front: null!, side: null! };

    for (const face of FACES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn';
        btn.textContent = face.charAt(0).toUpperCase() + face.slice(1);
        btn.addEventListener('click', () => {
            const entry = currentEditingEntry();
            if (!entry) { applyIconToCurrentShape(); return; }
            // User picks in default-form perspective; swap to internal for rotated forms
            updateIcon(entry.id, { face: swapFace(face) });
        });
        faceButtons[face] = btn;
        faceSwitcher.appendChild(btn);
    }

    registerPopulator(() => {
        const entry = currentEditingEntry();
        if (!entry) return;
        const displayFace = swapFace(entry.face);
        for (const face of FACES) {
            faceButtons[face].classList.toggle('nr-seg-btn--selected', displayFace === face);
        }
    });

    iconFaceRowEl.appendChild(faceLbl);
    iconFaceRowEl.appendChild(faceSwitcher);
    container.appendChild(iconFaceRowEl);

    // Size — in pixels (1 GU = GRID_SIZE px)
    let iconSizeInputRef: HTMLInputElement;
    buildSliderField('Size', 'sd-icon-size', 0.5, 4, 0.1,
        (el) => { iconSizeInputRef = el; el.value = String(currentEditingEntry()?.size ?? 1.5); },
        (el) => { el.id = 'sd-icon-size-value'; },
        () => {
            const v = parseFloat(iconSizeInputRef.value);
            const entry = currentEditingEntry();
            if (entry) updateIcon(entry.id, { size: v });
            else        applyIconToCurrentShape();
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
    const editEntry0 = currentEditingEntry();
    buildDualRow('Offset', editEntry0?.offsetX ?? 0, editEntry0?.offsetY ?? 0, -1, 1, 0.05, '',
        (v) => {
            const e = currentEditingEntry();
            if (e) updateIcon(e.id, { offsetX: v });
            else    applyIconToCurrentShape();
        },
        (v) => {
            const e = currentEditingEntry();
            if (e) updateIcon(e.id, { offsetY: v });
            else    applyIconToCurrentShape();
        });

    // Skew
    buildDualRow('Skew', editEntry0?.skewX ?? 0, editEntry0?.skewY ?? 0, -30, 30, 1, '°',
        (v) => {
            const e = currentEditingEntry();
            if (e) updateIcon(e.id, { skewX: v });
            else    applyIconToCurrentShape();
        },
        (v) => {
            const e = currentEditingEntry();
            if (e) updateIcon(e.id, { skewY: v });
            else    applyIconToCurrentShape();
        });

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
        const arr = currentIconsArray();
        const entry = arr[editingIconIndex];
        if (entry) {
            updateIcon(entry.id, { iconColor: c });
        } else {
            // No entry selected — fall back to legacy apply + dirty.
            applyIconToCurrentShape();
            markDirty();
        }
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
            const arr = currentIconsArray();
            const entry = arr[editingIconIndex];
            if (entry) {
                updateIcon(entry.id, { iconOpacity: parseFloat(iconOpacityInputRef.value) });
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
    // Initial value overwritten by syncIconBgColorDisplay() immediately
    // below, then re-set by populate() on every refresh — the default here
    // only matters if the popup is open without an entry, which doesn't
    // happen in normal flow.
    hiddenPicker.value = PRIMARY_COLORS[0].base;

    // Populator for bg color display. Reads the active entry's bg fields and
    // mirrors them into the DOM. Registered with the populator registry so
    // it runs on every populate(). Kept assigned to the module-level
    // `syncIconBgColorDisplay` variable so legacy call sites still work; they
    // become redundant once populate() fully takes over but are harmless.
    syncIconBgColorDisplay = () => {
        const entry = currentEditingEntry();
        const bgEnabled = !!entry?.bgEnabled;
        const bgColor = entry?.bgColor || PRIMARY_COLORS[0].base;
        if (bgEnabled) {
            hexInput.value = bgColor;
            hexInput.classList.remove('nr-sd-hex-input--default');
            colorBtn.style.backgroundColor = bgColor;
            colorBtn.innerHTML = '';
        } else {
            hexInput.value = 'None';
            hexInput.classList.add('nr-sd-hex-input--default');
            colorBtn.style.backgroundColor = '';
            colorBtn.innerHTML = NO_COLOR_ICON;
        }
        hiddenPicker.value = bgColor;
        if (iconBgSettingsWrapEl) iconBgSettingsWrapEl.style.display = bgEnabled ? '' : 'none';
    };
    registerPopulator(syncIconBgColorDisplay);
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
        popup.style.display = 'none';
        const entry = currentEditingEntry();
        if (entry) updateIcon(entry.id, { bgEnabled: false });
        else        { applyIconToCurrentShape(); markDirty(); }
    });
    popup.appendChild(noColorBtn);

    // Preset swatches. Picking a color enables the background. Model
    // invariant: when bg is on, `adaptive` must be false — pass it in the
    // same patch so the entry stays consistent.
    for (const color of PRIMARY_COLORS) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'nr-sd-color-popup__swatch';
        swatch.style.backgroundColor = color.base;
        swatch.title = color.label;
        swatch.addEventListener('click', () => {
            popup.style.display = 'none';
            const entry = currentEditingEntry();
            if (entry) updateIcon(entry.id, { bgEnabled: true, bgColor: color.base, adaptive: false });
            else        { applyIconToCurrentShape(); markDirty(); }
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
        const entry = currentEditingEntry();
        if (entry) updateIcon(entry.id, { bgEnabled: true, bgColor: hiddenPicker.value, adaptive: false });
        else        { applyIconToCurrentShape(); markDirty(); }
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
    // Default to hidden; syncIconBgColorDisplay (populator) sets the correct
    // display from the entry immediately on populate().
    bgSettingsWrap.style.display = 'none';
    iconBgSettingsWrapEl = bgSettingsWrap;

    let bgSizeInputRef: HTMLInputElement;
    buildSliderField('Bg Size', 'sd-icon-bg-size', 0.5, 4, 0.1,
        (el) => { bgSizeInputRef = el; el.value = String(currentEditingEntry()?.bgSize ?? 1); },
        (el) => { el.id = 'sd-icon-bg-size-value'; },
        () => {
            const v = parseFloat(bgSizeInputRef.value);
            const entry = currentEditingEntry();
            if (entry) updateIcon(entry.id, { bgSize: v });
            else        applyIconToCurrentShape();
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

    const SHAPE_OPTS = [
        { value: 'square' as const, label: 'Square' },
        { value: 'circle' as const, label: 'Circle' },
        { value: 'octagon' as const, label: 'Octagon' },
    ];
    const shapeButtons: Record<'square' | 'circle' | 'octagon', HTMLButtonElement> = {
        square: null!, circle: null!, octagon: null!,
    };

    for (const opt of SHAPE_OPTS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-seg-btn';
        btn.title = opt.label;
        btn.innerHTML = CLIP_SHAPE_ICONS[opt.value];
        btn.addEventListener('click', () => {
            const entry = currentEditingEntry();
            if (!entry) { applyIconToCurrentShape(); return; }
            updateIcon(entry.id, { bgShape: opt.value });
        });
        shapeButtons[opt.value] = btn;
        shapeSwitcher.appendChild(btn);
    }

    shapeRow.appendChild(shapeLbl);
    shapeRow.appendChild(shapeSwitcher);
    bgSettingsWrap.appendChild(shapeRow);

    // ── Corner Roundness (square only) ─────────────────────────────────
    const crWrap = document.createElement('div');
    iconBgCornerRadiusRowEl = crWrap;
    buildSliderField('Bg Corner Radius', 'sd-icon-bg-radius', 0, 32, 1,
        (el) => { el.value = String(currentEditingEntry()?.bgRadius ?? 6); iconBgCornerRadiusInputRef = el; },
        (el) => { el.id = 'sd-icon-bg-radius-value'; },
        () => {
            const v = parseInt(iconBgCornerRadiusInputRef!.value, 10);
            const entry = currentEditingEntry();
            if (entry) updateIcon(entry.id, { bgRadius: v });
            else        applyIconToCurrentShape();
        },
        crWrap, 'px');
    bgSettingsWrap.appendChild(crWrap);

    // ── Octagon Cut Depth (octagon only) ──────────────────────────────
    const ocWrap = document.createElement('div');
    iconBgChamferRowEl = ocWrap;
    buildSliderField('Bg Depth', 'sd-icon-bg-chamfer', 0.05, 0.45, 0.01,
        (el) => { el.value = String(currentEditingEntry()?.bgChamfer ?? 0.18); iconBgChamferInputRef = el; },
        (el) => { el.id = 'sd-icon-bg-chamfer-value'; },
        () => {
            const v = parseFloat(iconBgChamferInputRef.value);
            const entry = currentEditingEntry();
            if (entry) updateIcon(entry.id, { bgChamfer: v });
            else        applyIconToCurrentShape();
        },
        ocWrap, '%');
    bgSettingsWrap.appendChild(ocWrap);

    // Populator: bg shape selection + per-shape control visibility (corner
    // radius only for square, octagon-depth only for octagon). Reads from
    // the active entry so the controls always reflect the Draft.
    registerPopulator(() => {
        const entry = currentEditingEntry();
        const bgShape = entry?.bgShape ?? 'circle' as const;
        shapeButtons.square.classList.toggle('nr-seg-btn--selected', bgShape === 'square');
        shapeButtons.circle.classList.toggle('nr-seg-btn--selected', bgShape === 'circle');
        shapeButtons.octagon.classList.toggle('nr-seg-btn--selected', bgShape === 'octagon');
        crWrap.style.display = bgShape === 'square' ? '' : 'none';
        ocWrap.style.display = bgShape === 'octagon' ? '' : 'none';
    });

    // Background Opacity
    const curBgOpacity = (editingIconIndex >= 0 && iconEntries[editingIconIndex])
        ? (iconEntries[editingIconIndex].bgOpacity ?? 100) : 100;
    let bgOpacityInputRef: HTMLInputElement;
    buildSliderField('Bg Opacity', 'sd-icon-bg-opacity', 0, 100, 5,
        (el) => { bgOpacityInputRef = el; el.value = String(curBgOpacity); },
        () => {},
        () => {
            const arr = currentIconsArray();
            const entry = arr[editingIconIndex];
            if (entry) {
                updateIcon(entry.id, { bgOpacity: parseFloat(bgOpacityInputRef.value) });
            }
        },
        bgSettingsWrap, '%');

    container.appendChild(bgSettingsWrap);

}

function buildColorContent(container: HTMLElement) {
    const layer = layers[selectedLayerIndex];
    const initialStyle = currentStyle();
    const initialTheme: ColorTheme = (layer?.style.colorTheme as ColorTheme | undefined) ?? 'default';

    // Single shape-color value used by Light/Dark pickers (top=front=side).
    type CustomTarget = 'shapeLight' | 'shapeDark' | 'lineLight' | 'lineDark';

    function setCustomField(target: CustomTarget, val: string) {
        const lyr = layers[selectedLayerIndex];
        if (!lyr) return;
        if (target === 'shapeLight') {
            const s = deriveFaceShades(val);
            lyr.style.topColor = s.top; lyr.style.frontColor = s.front; lyr.style.sideColor = s.side;
        } else if (target === 'shapeDark') {
            const s = deriveFaceShades(val);
            lyr.style.topColorDark = s.top; lyr.style.frontColorDark = s.front; lyr.style.sideColorDark = s.side;
        } else if (target === 'lineLight') {
            lyr.style.strokeColor = val;
        } else {
            lyr.style.strokeColorDark = val;
        }
        const s = layerShapes[selectedLayerIndex], s2D = layerShapes2D[selectedLayerIndex];
        if (s)   applyShapeStyle(s,   lyr.style);
        if (s2D) applyShapeStyle(s2D, lyr.style);
        markDirty();
    }

    function applyColor(val: string) {
        // Legacy single-color setter (kept for the existing buildHexColorRow callers
        // until the picker rows below take over).
        const lyr = layers[selectedLayerIndex];
        if (lyr) {
            const s = deriveFaceShades(val);
            lyr.style.topColor = s.top;
            lyr.style.frontColor = s.front;
            lyr.style.sideColor = s.side;
        }
        const s = layerShapes[selectedLayerIndex], s2D = layerShapes2D[selectedLayerIndex];
        if (s)   applyShapeStyle(s,   lyr?.style ?? {});
        if (s2D) applyShapeStyle(s2D, lyr?.style ?? {});
        markDirty();
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

    // Reset every color field (Light + Dark) so applyShapeStyle (called by
    // the caller) falls back to STYLE_TEMPLATE_DEFAULTS in both modes. Was
    // previously only clearing the Light fields, leaving Dark colors from a
    // prior Custom/Vendor theme in place — the canvas still showed those in
    // Dark mode after switching to Default.
    const clearColor = () => {
        const layer = layers[selectedLayerIndex];
        if (!layer) return;
        layer.style.topColor = layer.style.frontColor = layer.style.sideColor = '';
        layer.style.strokeColor = '';
        layer.style.topColorDark = layer.style.frontColorDark = layer.style.sideColorDark = '';
        layer.style.strokeColorDark = '';
        markDirty();
    };
    // ── Color Theme dropdown ──────────────────────────────────────────────
    const themeRow = document.createElement('div');
    themeRow.className = 'nr-sd-hex-color-row';
    const themeLbl = document.createElement('label');
    themeLbl.className = 'nr-sd-number-label';
    themeLbl.textContent = 'Color Theme';
    themeRow.appendChild(themeLbl);
    const themeSelect = document.createElement('select');
    themeSelect.className = 'nr-sd-select';
    for (const opt of [
        { value: 'default', label: 'Default' },
        { value: 'gcp',     label: 'GCP'    },
        { value: 'aws',     label: 'AWS'    },
        { value: 'azure',   label: 'Azure'  },
        { value: 'custom',  label: 'Custom' },
    ]) {
        const o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label;
        if (opt.value === initialTheme) o.selected = true;
        themeSelect.appendChild(o);
    }
    themeRow.appendChild(themeSelect);
    container.appendChild(themeRow);

    // ── Custom color pickers (shown only when theme === 'custom') ─────────
    const customWrap = document.createElement('div');
    customWrap.className = 'nr-sd-color-custom-wrap';

    // Seed pickers from layer values, falling back to common defaults.
    const seedShapeLight = initialStyle.topColor      || DEFAULT_COLORS.shapeLight;
    const seedShapeDark  = layer?.style.topColorDark   || DEFAULT_COLORS.shapeDark;
    const seedLineLight  = initialStyle.strokeColor   || DEFAULT_COLORS.lineLight;
    const seedLineDark   = layer?.style.strokeColorDark|| DEFAULT_COLORS.lineDark;

    customWrap.appendChild(buildHexColorRow('Shape Light', 'sd-color-shape-light', seedShapeLight, v => setCustomField('shapeLight', v)));
    customWrap.appendChild(buildHexColorRow('Shape Dark',  'sd-color-shape-dark',  seedShapeDark,  v => setCustomField('shapeDark',  v)));
    customWrap.appendChild(buildHexColorRow('Line Light',  'sd-color-line-light',  seedLineLight,  v => setCustomField('lineLight',  v)));
    customWrap.appendChild(buildHexColorRow('Line Dark',   'sd-color-line-dark',   seedLineDark,   v => setCustomField('lineDark',   v)));
    customWrap.style.display = initialTheme === 'custom' ? '' : 'none';
    container.appendChild(customWrap);

    // Update the visible hex-input + color swatch in each Custom picker row.
    // Picker DOM was built once with initial seeds; switching themes must
    // re-seed the rows so the user always starts adjustments from a known
    // state (the default theme).
    function syncCustomPickerDisplays(): void {
        const rows: Array<[string, string]> = [
            ['sd-color-shape-light', DEFAULT_COLORS.shapeLight],
            ['sd-color-shape-dark',  DEFAULT_COLORS.shapeDark],
            ['sd-color-line-light',  DEFAULT_COLORS.lineLight],
            ['sd-color-line-dark',   DEFAULT_COLORS.lineDark],
        ];
        for (const [id, value] of rows) {
            const input = customWrap.querySelector<HTMLInputElement>(`#${id}`);
            if (!input) continue;
            const rowEl = input.closest('.nr-sd-hex-color-row');
            if (!rowEl) continue;
            const hexInput = rowEl.querySelector<HTMLInputElement>('.nr-sd-hex-input');
            const swatch   = rowEl.querySelector<HTMLElement>('.nr-sd-hex-color-btn');
            const picker   = rowEl.querySelector<HTMLInputElement>('.nr-sd-hex-hidden-picker');
            if (hexInput) { hexInput.value = value; hexInput.classList.remove('nr-sd-hex-input--default'); }
            if (swatch)   { swatch.style.backgroundColor = value; swatch.innerHTML = ''; }
            if (picker)   { picker.value = value; }
        }
    }

    function applyTheme(theme: ColorTheme) {
        const lyr = layers[selectedLayerIndex];
        if (!lyr) return;
        lyr.style.colorTheme = theme;
        if (theme === 'custom') {
            // Always start from the Default state when entering Custom — the
            // user adjusts from a known baseline, not from whatever vendor
            // preset happened to be active before.
            const sL = deriveFaceShades(DEFAULT_COLORS.shapeLight);
            const sD = deriveFaceShades(DEFAULT_COLORS.shapeDark);
            lyr.style.topColor = sL.top; lyr.style.frontColor = sL.front; lyr.style.sideColor = sL.side;
            lyr.style.topColorDark = sD.top; lyr.style.frontColorDark = sD.front; lyr.style.sideColorDark = sD.side;
            lyr.style.strokeColor     = DEFAULT_COLORS.lineLight;
            lyr.style.strokeColorDark = DEFAULT_COLORS.lineDark;
            syncCustomPickerDisplays();
        } else {
            // Default + vendor themes (azure/aws/gcp): write the derived
            // tokens from the per-theme tuning into the layer's style so
            // applyShapeStyle uses them instead of falling back to the
            // hardcoded STYLE_TEMPLATE_DEFAULTS.
            const preset = THEME_COLORS[theme];
            if (preset) {
                const sL = deriveFaceShades(preset.shapeLight);
                const sD = deriveFaceShades(preset.shapeDark);
                lyr.style.topColor = sL.top; lyr.style.frontColor = sL.front; lyr.style.sideColor = sL.side;
                lyr.style.topColorDark = sD.top; lyr.style.frontColorDark = sD.front; lyr.style.sideColorDark = sD.side;
                lyr.style.strokeColor     = preset.lineLight;
                lyr.style.strokeColorDark = preset.lineDark;
            } else {
                // Defensive: if the theme has no preset (shouldn't happen),
                // wipe customs so we at least fall back to template defaults.
                clearColor();
            }
        }
        const s = layerShapes[selectedLayerIndex], s2D = layerShapes2D[selectedLayerIndex];
        if (s)   applyShapeStyle(s,   lyr.style);
        if (s2D) applyShapeStyle(s2D, lyr.style);
        customWrap.style.display = theme === 'custom' ? '' : 'none';
        markDirty();
    }

    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value as ColorTheme));

    const colorResetBtn = document.createElement('button');
    colorResetBtn.type = 'button';
    colorResetBtn.className = 'nr-sd-reset-btn';
    colorResetBtn.title = 'Reset to default theme';
    colorResetBtn.innerHTML = 'Reset to default';
    colorResetBtn.addEventListener('click', () => {
        themeSelect.value = 'default';
        applyTheme('default');
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

    const headerActions = document.createElement('div');
    headerActions.className = 'nr-header-actions';
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
    // Read from the live label on layer 0 first. The label IS the draft —
    // setShapeLabel writes to it on every keystroke, so it always carries
    // the user's in-progress name. The registry is only consulted as a
    // fallback for first build (no layer cell yet). This prevents the
    // rebuild-resets-input drift that happens when buildInspectorPanel
    // runs after the user has typed but not saved (e.g. on layer add).
    const liveLabel = layerShapes[0]?.attr('label/text') as string | undefined;
    shapeNameInput.value = (liveLabel && liveLabel.trim())
        || ShapeRegistry[currentShapeId]?.displayName
        || formatLabel(currentShapeId);
    shapeNameInput.addEventListener('input', () => {
        const newName = shapeNameInput.value;
        // Update the cell label on the design canvas (live visual feedback)
        // AND the palette tree row label on the left (so the user sees the
        // in-progress name everywhere immediately). Persistence to the
        // registry still happens only on Save — this is a UI mirror, not a
        // commit.
        setShapeLabel(newName);
        componentPanelHandle?.updateLabel?.(currentShapeId, newName);
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
    const labelHidden = layerShapes[0]?.attr('label/display') === 'none';
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
        layerShapes[0]?.attr('label/display', display);
        layerShapes2D[0]?.attr('label/display', display);
    });

    hideLabelWrapper.appendChild(hideLabelText);
    hideLabelWrapper.appendChild(hideLabelTrack);

    // Complex Shape toggle — OBSOLETE.
    // Every Shape is now layered; the toggle's mode-flip no longer represents
    // anything meaningful. The DOM element is kept (some code still references
    // it via `inspectorEl.querySelector('#sd-complex-toggle')`) but it's hidden
    // from the user. To add layers, use the "Add Layer" button.
    const complexToggleWrapper = document.createElement('div');
    complexToggleWrapper.className = 'nr-toggle nr-toggle--checked';
    complexToggleWrapper.style.display = 'none';

    const toggleText = document.createElement('span');
    toggleText.className = 'nr-toggle__label-text';
    toggleText.textContent = 'Multi-Layer Shape';

    const toggleTrack = document.createElement('button');
    toggleTrack.type = 'button';
    toggleTrack.id = 'sd-complex-toggle';
    toggleTrack.className = 'nr-toggle__track';
    toggleTrack.setAttribute('role', 'switch');
    toggleTrack.setAttribute('aria-checked', 'true');
    toggleTrack.setAttribute('aria-label', 'Complex Shape (obsolete)');
    // Click handler removed — toggle is hidden and obsolete (every Shape is layered).

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
        if (hasVariations && !ShapeRegistry[currentShapeId]?.turned90) {
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

    positionAccordionLi = buildAccordionItem('Position', true, buildPositionContent);
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
            // Reset the populator registry — DOM is about to be rebuilt and
            // any populators from a previously-open entry now point at stale
            // nodes. Build code below will re-register against the new DOM.
            clearPopulators();
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

            // Delete button in the popup header — mirrors the list-row remove
            // button so the user can scrap an icon while it's open. Hidden for
            // the shape-wide Main icon (which is never deletable).
            if (!entry.isMain) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'nr-icon-editor-close';
                deleteBtn.title = 'Delete icon from shape';
                deleteBtn.style.color = 'var(--cds-support-error, #da1e28)';
                deleteBtn.innerHTML = carbonIconToString(TrashCan16 as CarbonIcon);
                deleteBtn.addEventListener('click', () => {
                    removeIcon(entry.id);
                    popupEl.style.display = 'none';
                    editingIconIndex = -1;
                    clearPopulators();
                    renderIconsList();
                });
                closeRow.appendChild(deleteBtn);
            }

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'nr-icon-editor-close';
            closeBtn.title = 'Close';
            closeBtn.innerHTML = carbonIconToString(CloseLarge16 as CarbonIcon);
            closeBtn.addEventListener('click', () => {
                popupEl.style.display = 'none';
                editingIconIndex = -1;
                clearPopulators();
                renderIconsList();
            });
            closeRow.appendChild(closeBtn);
            popupEl.appendChild(closeRow);

            // (Legacy globals pre-seed block fully removed — the popup's
            // populators read straight from the entry.)

            // Icon selector (reuse existing buildIconContent into the popup)
            const iconContentWrap = document.createElement('div');
            buildIconContent(iconContentWrap);
            popupEl.appendChild(iconContentWrap);

            // Background controls
            const bgContentWrap = document.createElement('div');
            buildIconBackgroundContent(bgContentWrap);
            popupEl.appendChild(bgContentWrap);

            // Fill values from the Draft (the entry) into every input
            // registered above. Idempotent — run again after any mutation via
            // the chokepoint pattern.
            populate();
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
                const insertAt = dropTargetIdx > dragSrcIdx ? dropTargetIdx - 1 : dropTargetIdx;
                reorderIcons(dragSrcIdx, insertAt);
                if (editingIconIndex === dragSrcIdx) editingIconIndex = insertAt;
                else if (editingIconIndex >= Math.min(dragSrcIdx, insertAt) && editingIconIndex <= Math.max(dragSrcIdx, insertAt)) {
                    editingIconIndex += dragSrcIdx < insertAt ? -1 : 1;
                }
                dragSrcIdx = -1;
                dropTargetIdx = -1;
                renderIconsList();
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

                // Preview thumbnail — recognition surface. Lookup via the
                // shared icon-renderer so the rules (no monochrome here, no
                // inline tile color, just an opt-out class for color-bearing
                // sources) match the trees and palette.
                const preview = document.createElement('div');
                preview.className = 'nr-icon-entry-preview';
                const rendered = renderIcon(entry.iconId, 'list');
                if (rendered) {
                    preview.innerHTML = rendered.html;
                    if (rendered.cssClass) preview.classList.add(rendered.cssClass);
                }
                row.appendChild(preview);

                // Name + Main tag
                const nameWrap = document.createElement('div');
                nameWrap.className = 'nr-icon-entry-name-wrap';
                const nameEl = document.createElement('span');
                nameEl.className = 'nr-icon-entry-name';
                const catalogLabel = entry.iconId ? (getIconById(entry.iconId)?.label || '') : '';
                nameEl.textContent = entry.name || catalogLabel || `Icon ${idx + 1}`;
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
                        setMainIcon(entry.id);
                        menu.remove();
                        renderIconsList();
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

                // Remove button — rendered for every non-Main icon. The
                // shape-wide Main icon gets no minus at all (it's never
                // deletable; the disabled button just confused users into
                // thinking the action was supposed to work).
                if (!entry.isMain) {
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'nr-icon-entry-btn nr-icon-entry-btn--danger';
                    removeBtn.innerHTML = carbonIconToString(Subtract16 as CarbonIcon);
                    removeBtn.title = 'Remove icon';
                    removeBtn.addEventListener('click', () => {
                        removeIcon(entry.id);
                        if (editingIconIndex === idx) { popupEl.style.display = 'none'; editingIconIndex = -1; }
                        else if (editingIconIndex > idx) editingIconIndex--;
                        renderIconsList();
                    });
                    row.appendChild(removeBtn);
                }

                listEl.appendChild(row);
            }
        };

        // Wire + button now that openIconEditor exists. Seed every new entry
        // with the default Cube glyph so a freshly-added icon never renders
        // as an empty placeholder.
        iconsAddBtn.addEventListener('click', () => {
            addIcon({ iconId: 'cube' });
            const arr = currentIconsArray();
            editingIconIndex = arr.length - 1;
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
        const targets = [layerShapes[0], layerShapes2D[0]];
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
    // Rotate HUD is hidden in the layered editor — rotation is now applied
    // per-layer via the inspector, not via a global swap on the canvas shape.
    hudRotateItem.style.display = 'none';
    hud.appendChild(hudRotateItem);

    // ── Opacity (reuses buildSliderField for drag-to-scrub + ±) ─────────
    buildSliderField('Opacity', 'sd-hud-opacity', 0, 100, 5,
        (el) => { el.value = '100'; },
        () => {},
        () => {
            const el = hud.querySelector<HTMLInputElement>('#sd-hud-opacity');
            if (!el) return;
            const op = parseFloat(el.value) / 100;
            for (const s of layerShapes)   { const v = paper.findViewByModel(s);   if (v) applyShapeFillOpacity(v, op); }
            for (const s of layerShapes2D) { const v = paper2D.findViewByModel(s); if (v) applyShapeFillOpacity(v, op); }
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
        lightBtn.classList.toggle('nr-seg-btn--selected', !dark);
        darkBtn.classList.toggle('nr-seg-btn--selected', dark);
        // applyTheme owns the class toggle, the nr-theme-change dispatch AND
        // the nav-theme icon swap — calling it directly avoids the double-
        // toggle bug that the previous `navBtn.click()` caused (the click
        // handler reads the state we just set and inverts it).
        applyTheme(dark);
    };

    lightBtn.addEventListener('click', () => applyThemeFromHud(false));
    darkBtn.addEventListener('click', () => applyThemeFromHud(true));

    // Sync the switcher when the theme is changed elsewhere (e.g. the app
    // header's theme toggle). Without this, the HUD selection drifts away
    // from the actual mode until the inspector is rebuilt.
    const syncFromCurrentTheme = () => {
        const dark = document.documentElement.classList.contains('cds--g100');
        lightBtn.classList.toggle('nr-seg-btn--selected', !dark);
        darkBtn.classList.toggle('nr-seg-btn--selected', dark);
    };
    window.addEventListener('nr-theme-change', syncFromCurrentTheme);

    themeSwitcher.appendChild(lightBtn);
    themeSwitcher.appendChild(darkBtn);
    hudThemeItem.appendChild(themeSwitcher);
    hud.appendChild(hudThemeItem);

    // ── Hit Area controls — always available (every Shape is layered) ──
    {
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
        buildSliderField('Width', 'sd-hud-ha-w', 10, 400, 10,
            (el) => { el.value = String(haDefSize.width); },
            () => {},
            () => {
                const el = hud.querySelector<HTMLInputElement>('#sd-hud-ha-w');
                if (!el || !hitAreaShape) return;
                const w = parseFloat(el.value) || 40;
                hitAreaShape.resize(w, hitAreaShape.size().height);
            },
            hitSizeWrap, 'px');
        buildSliderField('Height', 'sd-hud-ha-h', 10, 400, 10,
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

// `requiresSquareBase`, `isRotatedForm`, `isTubeFamily`, `dimensionsFor`,
// `getSupportedModifiers` are imported from shape-capabilities (ADR-0004).

// Form factors that expose the corner radius slider.
function supportsCornerRadius(baseShape: string): boolean {
    return baseShape === 'rectangle';
}

// Returns true when a layer is rendered from an uploaded SVG.
// Discriminated by baseShape — no longer by "is normalizedVerts populated".
function isLayerSvg(layer: ShapeLayer): boolean {
    return layer.baseShape === 'svgPolygon';
}

// Returns true when a layer's geometry comes from a polygon (drawn or uploaded).
// Both 'custom' (in-app drawer) and 'svgPolygon' (uploaded) store verts in normalizedVerts.
function isLayerCustomVerts(layer: ShapeLayer): boolean {
    return layer.baseShape === 'custom' || layer.baseShape === 'svgPolygon';
}

// ── Per-modifier chokepoints ────────────────────────────────────────────────
// Each function is the only sanctioned write path for its modifier. Takes
// the value as a parameter (no global read), writes to the layer model AND
// to both layer cells, and marks dirty. Lighter than the full `updateLayer`
// chokepoint because modifier changes don't need a layout re-render — only
// the affected cell's attribute changes, JointJS re-renders that cell.

function applyCornerRadiusToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.cornerRadius = v;
    layerShapes[selectedLayerIndex]?.set('cornerRadius', v);
    layerShapes2D[selectedLayerIndex]?.set('cornerRadius', v);
    markDirty();
}

function applyChamferSizeToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.chamferSize = v;
    layerShapes[selectedLayerIndex]?.set('chamferSize', v);
    layerShapes2D[selectedLayerIndex]?.set('chamferSize', v);
    markDirty();
}

function applyChamferStartToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.chamferStart = v;
    layerShapes[selectedLayerIndex]?.set('chamferStart', v);
    layerShapes2D[selectedLayerIndex]?.set('chamferStart', v);
    markDirty();
}

function applyChamferBottomSizeToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.chamferBottomSize = v;
    layerShapes[selectedLayerIndex]?.set('chamferBottomSize', v);
    layerShapes2D[selectedLayerIndex]?.set('chamferBottomSize', v);
    markDirty();
}

function applyChamferBottomStartToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.chamferBottomStart = v;
    layerShapes[selectedLayerIndex]?.set('chamferBottomStart', v);
    layerShapes2D[selectedLayerIndex]?.set('chamferBottomStart', v);
    markDirty();
}

function applyShedRoofToCurrentShape(drop: number, direction: string) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.shedRoofDrop = drop;
    layer.shedRoofDirection = direction;
    layerShapes[selectedLayerIndex]?.set('shedRoofDrop', drop);
    layerShapes[selectedLayerIndex]?.set('shedRoofDirection', direction);
    layerShapes2D[selectedLayerIndex]?.set('shedRoofDrop', drop);
    layerShapes2D[selectedLayerIndex]?.set('shedRoofDirection', direction);
    markDirty();
}

// "Which modifier inputs to show" is owned by the shape capability registry
// in src/shapes/shape-capabilities.ts (see ADR-0004).

const BASE_SHAPE_LABELS: Record<string, string> = {
    rectangle: 'Rectangle', circle: 'Circle', octagon: 'Octagon',
    tube: 'Pipe', pipe: 'Pipe_rotated', duct: 'Pipe', channel: 'Pipe_rotated', custom: 'Complex',
};

const ROTATE_PAIR: Record<string, string> = {
    tube: 'pipe', pipe: 'tube',
    duct: 'channel', channel: 'duct',
};


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
    // Legacy single-shape rotate is no-op in the layered model.
    // Per-layer rotation is set via the layer's modifier sliders.
    return;
}

function applyRotation(angle: number) {
    selectedRotation = angle;
    for (const s of layerShapes) s?.set('shapeRotation', angle);
    for (const s of layerShapes2D) s?.set('shapeRotation', angle);
    markDirty();
}

function applyTwistToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.twist = v;
    layerShapes[selectedLayerIndex]?.set('twist', v);
    layerShapes2D[selectedLayerIndex]?.set('twist', v);
    markDirty();
}

function applyScaleTopXToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.scaleTopX = v;
    layerShapes[selectedLayerIndex]?.set('scaleTopX', v);
    layerShapes2D[selectedLayerIndex]?.set('scaleTopX', v);
    markDirty();
}

function applyScaleTopYToCurrentShape(v: number) {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    layer.scaleTopY = v;
    layerShapes[selectedLayerIndex]?.set('scaleTopY', v);
    layerShapes2D[selectedLayerIndex]?.set('scaleTopY', v);
    markDirty();
}

// Enforce square-base (height = width) and pyramid min-depth constraints.
function updateDimensionLock() {
    if (!heightInput) return;
    const locked = requiresSquareBase(currentBaseShape());
    const heightRow = heightInput.closest('.nr-sd-number-row') as HTMLElement | null;
    heightRow?.classList.toggle('nr-sd-number-row--readonly', locked);
    if (locked) {
        heightInput.value = widthInput.value;
        if (heightValueEl) {
            heightValueEl.textContent = `${Math.round(parseFloat(widthInput.value))} px`;
        }
        // Sync the visible display element (drag-to-scrub input) — it has its
        // own value separate from the hidden numeric input.
        const display = heightRow?.querySelector('.nr-sd-number-display') as HTMLInputElement | null;
        if (display) display.value = `${Math.round(parseFloat(widthInput.value))}px`;
    }

    depthInput.min = '0';

    // Corner radius and chamfer are only available for built-in polygon shapes,
    // not for SVG-footprint layers (SVG vertices are always used without rounding).
    const currentSvgLayer = layers[selectedLayerIndex] ?? null;
    const hasSvgLayer     = currentSvgLayer !== null && isLayerSvg(currentSvgLayer);
    if (rotationAccordionLi) rotationAccordionLi.style.display = currentBaseShape() !== 'rectangle' ? '' : 'none';
    if (modifiersSvgInfoEl) modifiersSvgInfoEl.style.display = hasSvgLayer ? '' : 'none';
    const showBehaviour = currentBaseShape() === 'duct' || currentBaseShape() === 'pipe'
        || currentBaseShape() === 'tube' || currentBaseShape() === 'channel';
    if (dimBehaviourRowEl) dimBehaviourRowEl.style.display = showBehaviour ? '' : 'none';
    if (hudRotateItemEl) hudRotateItemEl.style.display = ROTATE_PAIR[currentBaseShape()] ? '' : 'none';

    syncModifierVisibility();
}

// Update dimension sliders and value displays from the shape's current state.
// Universal rows (e.g. shapeOpacity) live outside the per-shape capability
// gate — every shape gets them.
const UNIVERSAL_MODIFIERS = new Set<string>(['shapeOpacity']);

function syncModifierVisibility(): void {
    if (!modifiersAccordionLi) return;
    const layer = layers[selectedLayerIndex];
    const supported = layer
        ? getSupportedModifiers(layer.baseShape, layer)
        : new Set<string>();
    const pipeGroup = !!layer && isPipeGroup(layer.baseShape);
    const anyVisible = supported.size > 0 || UNIVERSAL_MODIFIERS.size > 0 || pipeGroup;
    modifiersAccordionLi.style.display = anyVisible ? '' : 'none';
    if (!anyVisible) return;
    // Pipe-variant row: only for pipe-group shapes; highlight current variant.
    const variantRow = modifiersAccordionLi.querySelector<HTMLElement>('[data-pipe-variant-row]');
    if (variantRow) {
        variantRow.style.display = pipeGroup ? '' : 'none';
        if (pipeGroup && layer) {
            const variant = pipeVariantOf(layer.baseShape);
            variantRow.querySelectorAll<HTMLButtonElement>('.nr-seg-btn').forEach(btn => {
                btn.classList.toggle('nr-seg-btn--selected', btn.dataset.variant === variant);
            });
        }
    }
    modifiersAccordionLi.querySelectorAll<HTMLElement>('[data-modifier]').forEach(el => {
        const mod = el.dataset.modifier!;
        const isCapable = UNIVERSAL_MODIFIERS.has(mod) || supported.has(mod as never);
        el.style.display = isCapable ? '' : 'none';
    });
}

function dimDisplayValue(px: number): string {
    return `${Math.round(px)}`;
}

function syncAllInspectorFields() {
    if (currentShape) syncFormFromShape(currentShape);
    syncModifierFields();
    syncIconBgColorDisplay();
    applyIconToCurrentShape();
}

function syncModifierFields() {
    const layer = layers[selectedLayerIndex];
    const cr = layer?.cornerRadius ?? 0;
    const cs = layer?.chamferSize ?? 0;
    const tw = layer?.twist ?? 0;
    const sx = layer?.scaleTopX ?? 1;
    const sy = layer?.scaleTopY ?? 1;
    if (cornerRadiusInput) { cornerRadiusInput.value = String(cr); setSliderFill(cornerRadiusInput); }
    if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = `${cr} px`;
    if (chamferSizeInput) { chamferSizeInput.value = String(cs); setSliderFill(chamferSizeInput); }
    if (chamferSizeValueEl) chamferSizeValueEl.textContent = `${cs} px`;
    if (twistInput) { twistInput.value = String(tw); setSliderFill(twistInput); }
    if (twistValueEl) twistValueEl.textContent = tw.toFixed(2);
    if (stxInput) { stxInput.value = String(sx); setSliderFill(stxInput); }
    if (stxValueEl) stxValueEl.textContent = sx.toFixed(2);
    if (styInput) { styInput.value = String(sy); setSliderFill(styInput); }
    if (styValueEl) styValueEl.textContent = sy.toFixed(2);
}

function syncFormFromShape(shape: IsometricShape) {
    const { width, height } = shape.size();
    const depth = shape.get('isometricHeight') ?? 0;
    const swapped = isRotatedForm(currentBaseShape());
    const wPx = swapped ? height : width;
    const isTube = isTubeFamily(currentBaseShape());

    if (isTube) {
        widthInput.value  = String(wPx);
        heightInput.value = String(depth);
        depthInput.value  = String(depth);
        if (widthDisplayEl)  widthDisplayEl.value  = `${Math.round(wPx)}px`;
        if (heightDisplayEl) heightDisplayEl.value = `${Math.round(depth)}px`;
        if (widthValueEl)  widthValueEl.textContent  = `${Math.round(wPx)} px`;
        if (heightValueEl) heightValueEl.textContent = `${Math.round(depth)} px`;
    } else {
        const hPx = swapped ? width : height;
        widthInput.value  = String(wPx);
        heightInput.value = String(hPx);
        depthInput.value  = String(depth);
        if (widthDisplayEl)  widthDisplayEl.value  = `${Math.round(wPx)}px`;
        if (heightDisplayEl) heightDisplayEl.value = `${Math.round(hPx)}px`;
        if (depthDisplayEl)  depthDisplayEl.value  = `${Math.round(depth)}px`;
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
    const layer0 = defaults?.layers?.[0];
    const icon0 = layer0?.icons?.[0];

    // baseShape and style live on layer0 itself — they are read directly
    // via currentBaseShape() / currentStyle() everywhere; no module-level
    // mirroring needed. BASE_SHAPE_BY_ID[id] used to provide a fallback
    // here for legacy shapes that didn't have a baseShape on their layer;
    // that fallback is now in currentBaseShape() (which defaults to
    // 'rectangle'). If a legacy shape still relies on the registry-id-based
    // default, fix it at load time by patching layer0.baseShape before
    // syncExtrasFromShape runs.
    iconLayerIndex      = 0;
    /* Icon-background defaults flow from icon0 to entry.bg* directly via
     * `iconEntries = layer0?.icons ?? []` below; no parallel global cache. */

    // Live reference to the layer's icon array (no copy). Mutations to
    // iconEntries are mutations to layers[0].icons.
    iconEntries = layer0?.icons ?? [];
    editingIconIndex = -1;
    selectedRotation  = defaults?.defaultRotation  ?? 0;
    dimensionYAdjustable = defaults?.dimYAdjustable ?? false;
    // Per-layer modifier values (twist/scaleTopX/Y) used to be mirrored
    // into module globals here. They aren't anymore — the layer itself is
    // the source of truth and the modifier panel reads from it on rebuild.

    // Sync radio buttons
    inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-form-factor"]').forEach(r => {
        r.checked = r.value === currentBaseShape();
    });
    syncFormFactorTiles();
    syncFormFactorDropdown();

    // Icon selection state used to be synced here by querying
    // .nr-sd-icon-btn under inspectorEl, but the icon picker grid lives in
    // the floating popup (appended to document.body), never under
    // inspectorEl. The query iterated zero elements — dead code, removed.
    // The popup's own populator (registerPopulator(populateGrid)) handles
    // selection state from the entry.

    // The icon-related DOM-sync blocks that used to live here queried
    // inspectorEl for popup elements (sliders, switchers, swatches) that
    // actually live in the floating popup appended to document.body, so
    // they iterated zero elements. The remaining live cases (popup open
    // during a shape switch) are out of scope of "load a new shape" — the
    // popup is rebuilt on its next open, and its populators read directly
    // from the entry. Removed.

    // Sync single color input
    const cs = currentStyle();
    const representativeColor = cs.topColor || cs.frontColor || cs.sideColor || '#e0e0e0';
    if (colorPickerRef) colorPickerRef.value = representativeColor;

    // Apply dimension lock now that currentBaseShape() has been updated.
    updateDimensionLock();
    syncAllSliderFills();

    // Shape load is a "selection change" at the Shape level — fire all
    // registered populators so any field that reads from Shape-level state
    // (e.g. the rotation switcher) refreshes against the newly-loaded
    // values.
    populate();
}

// Swap the canvas shape to match the selected form factor, preserving current dimensions.
function applyFormFactorToCanvas() {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    const willBePolygon = currentBaseShape() === 'custom' || currentBaseShape() === 'svgPolygon';
    layer.baseShape = currentBaseShape();
    // Clear polygon-specific data when leaving a polygon-based form factor.
    if (!willBePolygon) {
        delete layer.normalizedVerts;
        delete layer.svgFootprint;
        delete layer.svgFootprintName;
        delete layer.svgBillboard;
    }
    markDirty();
    if (requiresSquareBase(currentBaseShape())) {
        layer.height = layer.width;
        heightInput.value = String(layer.width);
        if (heightValueEl) heightValueEl.textContent = `${Math.round(layer.width)} px`;
        if (heightDisplayEl) heightDisplayEl.value = String(Math.round(layer.width));
    }
    updateDimensionLock();
    renderLayersOnCanvas();
    syncInspectorToLayer(selectedLayerIndex);
}

// Apply slider dimension values to the selected layer (grid units → px).
function onFieldChange() {
    markDirty();
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    const w = parseFloat(widthInput.value);
    if (requiresSquareBase(layer.baseShape)) {
        heightInput.value = String(w);
        if (heightValueEl) heightValueEl.textContent = `${Math.round(w)} px`;
        const heightRow = heightInput.closest('.nr-sd-number-row') as HTMLElement | null;
        const display = heightRow?.querySelector('.nr-sd-number-display') as HTMLInputElement | null;
        if (display) display.value = `${Math.round(w)}px`;
    }
    let h = parseFloat(heightInput.value);
    let d = parseFloat(depthInput.value);
    // Pipe-group shapes (tube/pipe/duct/channel) have a single "Diameter"
    // stepper that drives both the model height AND depth — Y and Z stay
    // locked together so the cross-section stays circular/octagonal.
    if (isTubeFamily(layer.baseShape)) {
        d = h;
        depthInput.value = String(d);
        if (depthDisplayEl) depthDisplayEl.value = `${Math.round(d)}px`;
    }
    if (isNaN(w) || isNaN(h) || isNaN(d) || w < 1 || h < 1 || d < 0) return;
    layer.width  = w;
    layer.height = h;
    layer.depth  = d;
    // Update the layer's shape in-place for smooth dragging.
    const s   = layerShapes[selectedLayerIndex];
    const s2D = layerShapes2D[selectedLayerIndex];
    s?.resize(layer.width, layer.height);
    s?.set('isometricHeight', layer.depth);
    s2D?.resize(layer.width, layer.height);
    s2D?.set('isometricHeight', layer.depth);
    // Compensate for top-left-anchored resize: keep composite centred.
    recenterCompositeShape();
    // Re-bake the icon when layer[0] resizes (icon coords derive from its bbox).
    applyIconToCurrentShape();
}

// Persist all template values to the Shape Registry.
function collectCurrentDef(): Partial<ShapeDefinition> {
    // Every loaded Shape has at least one Layer (loadShapeIntoCanvas refuses
    // otherwise). Each IconEntry already carries its baked `href` — set by
    // applyIconToCurrentShape during the user's edits and re-set on every
    // chokepoint mutation. collectCurrentDef therefore does NO re-baking; it
    // is a pure projection of the current Draft.
    //
    // (The old legacy bake here used the selectedIcon/selectedIconBg* globals
    // to re-derive an href and overwrite icons[0].href. That created a
    // one-save-behind drift bug whenever the entry-side state moved before
    // the globals did — see the input-sync ADR.)
    const layersOut = layers.map(l => ({ ...l, style: { ...l.style }, icons: l.icons.map(e => ({ ...e })) }));
    return {
        displayName: shapeNameInput?.value.trim() || formatLabel(currentShapeId),
        componentType: componentTypeSelect?.value || undefined,
        defaultRotation: selectedRotation || undefined,
        dimYAdjustable: dimensionYAdjustable || undefined,
        layers: layersOut,
        hitAreaSize: hitAreaShape ? { ...hitAreaShape.size() } : undefined,
    };
}

function switchVariation(target: 'default' | 'turned90') {
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
                update.displayName = existing.displayName;
                update.componentType = existing.componentType;
                update.collection = existing.collection;
                update.dimYAdjustable = existing.dimYAdjustable;
                update.hitAreaSize = existing.hitAreaSize;
                update.defaultRotation = existing.defaultRotation;
                update.layers = existing.layers;
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
// All Layers are equal (CONTEXT.md). The composite is centered by aligning
// the floor-layer bbox (= the Hit Area footprint) with the canvas centre.
// Floor layers are those with baseElevation === 0; if none, use all layers.
// No Layer is privileged as the anchor — the floor footprint is.
function recenterCompositeShape() {
    if (layerShapes.length === 0 || layers.length === 0) return;

    const gridPx  = CD_GRID_COUNT * GRID_SIZE;
    const centerX = gridPx / 2;
    const centerY = gridPx / 2;

    const hasFloor = layers.some(l => l.baseElevation === 0);
    const indices: number[] = [];
    for (let i = 0; i < layers.length; i++) {
        if (!hasFloor || layers[i].baseElevation === 0) indices.push(i);
    }

    const translate = (shapes: IsometricShape[], isIso: boolean) => {
        if (shapes.length === 0) return;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        for (const idx of indices) {
            const s = shapes[idx];
            if (!s) continue;
            const { x, y } = s.position();
            const { width: w, height: h } = s.size();
            // In iso view the layer is rendered offset by (-elev, -elev) for
            // the elevation "lift". Add elev back to recover the ground-plane
            // position. Floor layers have elev=0 so this is a no-op for them.
            const elev = isIso ? (layers[idx].baseElevation ?? 0) : 0;
            // Subtract the per-layer offset so the bbox reflects the layer's
            // "neutral" (offset-free) position. Otherwise recenter would treat
            // the offset as drift and cancel it out — user-entered offsets
            // would silently snap back to zero (reported bug, 2026-05-24).
            //
            // 2D paper deliberately ignores `layer.offsetX/Y` when placing the
            // shape (renderLayersOnCanvas) — so for 2D the position IS already
            // neutral and we must NOT subtract the offset a second time, or
            // multilayer shapes drift sideways in 2D.
            const ox = isIso ? (layers[idx].offsetX ?? 0) : 0;
            const oy = isIso ? (layers[idx].offsetY ?? 0) : 0;
            const gx = x + elev - ox;
            const gy = y + elev - oy;
            if (gx        < minX) minX = gx;
            if (gy        < minY) minY = gy;
            if (gx + w    > maxX) maxX = gx + w;
            if (gy + h    > maxY) maxY = gy + h;
        }
        if (!Number.isFinite(minX)) return;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const dx = centerX - cx;
        const dy = centerY - cy;
        if (dx === 0 && dy === 0) return;
        for (const s of shapes) {
            const p = s.position();
            s.position(p.x + dx, p.y + dy);
        }
    };

    translate(layerShapes,   true);
    translate(layerShapes2D, false);

    if (hitAreaVisible) {
        if (hitAreaShape) centerHitArea(hitAreaShape, graph);
        if (hitAreaShape2D) centerHitArea(hitAreaShape2D, graph2D);
    }
}

function getHitAreaSize(): { width: number; height: number } {
    const reg = ShapeRegistry[currentShapeId];
    // Synthesize a ShapeDefinition view of the editor's live state so the
    // facade rule (CONTEXT.md → Hit Area) is the single source of truth.
    const def: ShapeDefinition = {
        displayName: reg?.displayName ?? '',
        hitAreaSize: reg?.hitAreaSize,
        layers,
    };
    const size = getHitArea(def);
    // Editor-only safety net: a brand-new Shape with no Layers should still
    // show a non-zero overlay rather than a degenerate point.
    if (size.width === 0 && size.height === 0) {
        return { width: GRID_SIZE * 2, height: GRID_SIZE * 2 };
    }
    return size;
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
        // Snap to HIT_AREA_STEP (10px). If the snapped size differs, write it
        // back — this triggers another change:size, but the next pass sees the
        // already-snapped value and is a no-op, so no infinite loop.
        const raw = hitAreaShape.size();
        const snappedW = Math.round(raw.width  / HIT_AREA_STEP) * HIT_AREA_STEP;
        const snappedH = Math.round(raw.height / HIT_AREA_STEP) * HIT_AREA_STEP;
        if (snappedW !== raw.width || snappedH !== raw.height) {
            hitAreaShape.resize(snappedW, snappedH);
            return;
        }
        centerHitArea(hitAreaShape, graph);
        if (hitAreaShape2D) {
            hitAreaShape2D.resize(snappedW, snappedH);
            centerHitArea(hitAreaShape2D, graph2D);
        }
        const wEl = document.getElementById('sd-hud-ha-w') as HTMLInputElement | null;
        const hEl = document.getElementById('sd-hud-ha-h') as HTMLInputElement | null;
        if (wEl) { wEl.value = String(snappedW); const d = wEl.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display'); if (d) d.value = `${snappedW}px`; }
        if (hEl) { hEl.value = String(snappedH); const d = hEl.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display'); if (d) d.value = `${snappedH}px`; }
        markDirty();
    });
}

function hideHitAreaOverlay() {
    hitAreaVisible = false;
    if (hitAreaShape) { hitAreaShape.remove(); hitAreaShape = null; }
    if (hitAreaShape2D) { hitAreaShape2D.remove(); hitAreaShape2D = null; }
}

// Hover affordance for the resize tools (no-op when none are visible).
paper.on('element:mouseenter', () => {
    paper.el.querySelectorAll('.joint-tools').forEach(el => el.classList.add('nr-tools--hover'));
});
paper.on('element:mouseleave', () => {
    paper.el.querySelectorAll('.nr-tools--hover').forEach(el => el.classList.remove('nr-tools--hover'));
});

// Note: graph change:size / change:isometricHeight handlers for the legacy
// single-shape resize-by-tool path were removed — layered Shapes resize via
// the inspector, not via direct tool dragging on the canvas.

paper2D.on('element:mouseenter', () => {
    paper2D.el.querySelectorAll('.joint-tools').forEach(el => el.classList.add('nr-tools--hover'));
});
paper2D.on('element:mouseleave', () => {
    paper2D.el.querySelectorAll('.nr-tools--hover').forEach(el => el.classList.remove('nr-tools--hover'));
});

// Note: change:isometricHeight handler removed — layered Shapes set depth
// via the inspector slider, no per-shape height tool runs.

// ── Complex Shape helpers ─────────────────────────────────────────────────────

// ── SVG Footprint helpers ─────────────────────────────────────────────────────

/**
 * Rebuilds the SVG Footprint inspector section for the currently selected layer.
 * Shows an upload control when no SVG is loaded, or the filename + Remove button
 * when one is active.  Displays any pending parse error beneath the control.
 */
function syncSvgFootprintSection() {
    if (!svgFootprintAccordionContent) return;

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
        layer.baseShape         = 'svgPolygon';
        layer.svgFootprint      = svgString;
        layer.normalizedVerts   = result.normVerts;
        layer.svgFootprintName  = file.name;
        markDirty();

        renderLayersOnCanvas();
        syncSvgFootprintSection();
        updateDimensionLock(); // hide corner radius / chamfer for SVG layer
    };
    reader.readAsText(file);
}

/** Removes the SVG footprint from the current layer, reverting to the previous form factor. */
function onRemoveSvgFootprint() {
    const layer = layers[selectedLayerIndex];
    if (!layer) return;

    // Reverting from 'svgPolygon': fall back to rectangle (a sane default). The
    // user can change to any other base shape via the form-factor picker.
    if (layer.baseShape === 'svgPolygon') layer.baseShape = 'rectangle';
    delete layer.svgFootprint;
    delete layer.normalizedVerts;
    delete layer.svgFootprintName;
    delete layer.svgBillboard;
    svgParseError = '';
    markDirty();

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

/**
 * Centre of the union bbox of all floor layers (baseElevation === 0), in
 * shape-coords (offsetX/Y are relative to the shape origin). Used to keep
 * the visual cluster centred on the canvas when layer offsets are
 * asymmetric. Mirror of `shapeBboxCentre` in complex-component.ts — the two
 * designers must agree on this geometry or the same shape renders at
 * different positions in CD vs SD.
 */
function layerUnionCentre(ls: ReadonlyArray<ShapeLayer>): { x: number; y: number } {
    const floors = ls.filter(l => l.baseElevation === 0);
    const considered = floors.length > 0 ? floors : ls;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const l of considered) {
        if (l.offsetX - l.width  / 2 < minX) minX = l.offsetX - l.width  / 2;
        if (l.offsetX + l.width  / 2 > maxX) maxX = l.offsetX + l.width  / 2;
        if (l.offsetY - l.height / 2 < minY) minY = l.offsetY - l.height / 2;
        if (l.offsetY + l.height / 2 > maxY) maxY = l.offsetY + l.height / 2;
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0 };
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
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

    // Centre the layer union on the canvas — without this, asymmetric layer
    // offsets shift the visual cluster sideways from (bx, by). Same logic as
    // SD's ComplexComponent.shapeBboxCentre so the two designers stay in sync.
    // Single-layer shapes preserve user-set offset as-is.
    const isoBbox = layers.length > 1 ? layerUnionCentre(layers) : { x: 0, y: 0 };

    // Build all shapes first (not yet in the graph) so we control insertion order.
    for (let idx = 0; idx < layers.length; idx++) {
        const layer = layers[idx];
        const isoX = bx - layer.width  / 2 + (layer.offsetX - isoBbox.x) - layer.baseElevation;
        const isoY = by - layer.height / 2 + (layer.offsetY - isoBbox.y) - layer.baseElevation;

        let shape: IsometricShape;
        if (isLayerCustomVerts(layer)) {
            const svgShape = new SvgPolygonShape();
            svgShape.set('normalizedVerts', layer.normalizedVerts!);
            shape = svgShape;
        } else {
            shape = (FORM_FACTOR_PREVIEWS[layer.baseShape] ?? FORM_FACTOR_PREVIEWS['rectangle'])();
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

        // 2D paper: layer.offsetX/Y are deliberately NOT applied here. The
        // 2D representation is a single composite icon centred on the canvas
        // — no per-layer offset, no secondary layers spreading out sideways.
        // Non-main layers are hidden below; only the layer carrying the
        // shape-wide isMain icon stays visible.
        const x2D = bx - layer.width  / 2;
        const y2D = by - layer.height / 2;

        let shape2D: IsometricShape;
        if (isLayerCustomVerts(layer)) {
            const svgShape2D = new SvgPolygonShape();
            svgShape2D.set('normalizedVerts', layer.normalizedVerts!);
            shape2D = svgShape2D;
        } else {
            shape2D = (FORM_FACTOR_PREVIEWS[layer.baseShape] ?? FORM_FACTOR_PREVIEWS['rectangle'])();
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
    applyAllLayerIcons();

    // Re-apply the Shape's label to the fresh layerShapes[0]. The label is a
    // Shape-level concept anchored to the floor plane; it gets wiped by the
    // graph.clear() at the top of this function and must be re-established.
    const labelText = ShapeRegistry[currentShapeId]?.displayName
        ?? shapeNameInput?.value
        ?? '';
    if (labelText) setShapeLabel(labelText);

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

    // Render layers top-to-bottom: highest array index visually on top, layer 0
    // at the bottom of the list (matches paint order). All layers are equal —
    // there is no "Main" layer anymore. Every layer is movable/deletable; only
    // constraint is that a Shape must keep at least one Layer.
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const li = document.createElement('li');
        li.className = 'nr-layer-item' + (i === selectedLayerIndex ? ' nr-layer-item--selected' : '');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'nr-layer-item-name';
        nameSpan.textContent = layer.name;
        li.appendChild(nameSpan);

        // Every layer can move up/down. Disabled only at the array boundaries.
        const upBtn   = makeLayerAction(CDS_ICON_CHEVRON_UP,   `Move ${layer.name} up`,   () => onMoveLayerUp(i));
        const downBtn = makeLayerAction(CDS_ICON_CHEVRON_DOWN, `Move ${layer.name} down`, () => onMoveLayerDown(i));
        upBtn.disabled   = i >= layers.length - 1; // already at the top of the stack
        downBtn.disabled = i <= 0;                 // already at the bottom of the stack
        li.appendChild(upBtn);
        li.appendChild(downBtn);

        // Overflow menu — Rename / Duplicate / Delete.
        // Delete is disabled only when this is the last remaining Layer.
        const menuBtn = makeLayerAction(CDS_ICON_OVERFLOW, `Actions for ${layer.name}`, () => {
            showLayerOverflowMenu(menuBtn, i);
        });
        menuBtn.classList.add('nr-layer-item-action--menu');
        li.appendChild(menuBtn);

        li.addEventListener('click', () => {
            editingIconIndex = -1;
            const edPopup = document.getElementById('nr-icon-editor-popup');
            if (edPopup) edPopup.style.display = 'none';
            selectedLayerIndex = i;
            currentShape   = layerShapes[i]   ?? null;
            currentShape2D = layerShapes2D[i] ?? null;
            iconEntries = layers[i]?.icons ?? [];
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
        // Delete is disabled only when this is the last remaining Layer.
        { label: 'Delete layer',    onClick: () => { popup.remove(); onDeleteLayer(index); }, disabled: layers.length <= 1 },
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
    applyingAllLayerIcons = true;
    const noIconAttrs = {
        topIcon:   { href: '', width: 0, height: 0 },
        topIcon2D: { href: '', width: 0, height: 0 },
    };
    const savedEntries = iconEntries;
    const savedShape = currentShape;
    const savedShape2D = currentShape2D;

    // 2D representation is a single composite icon: only the layer holding
    // the shape-wide isMain icon renders into the 2D paper. All other
    // layers' shape2Ds get their visuals hidden so they don't ghost over
    // the main icon when the user hovers (no secondary outline, no offset
    // duplicates).
    const mainLayerIdx = Math.max(0, layers.findIndex(l => l.icons?.some(e => e.isMain)));

    for (let idx = 0; idx < layers.length; idx++) {
        const layerIcons = layers[idx].icons;
        const shape = layerShapes[idx];
        const shape2D = layerShapes2D[idx];
        const is2DVisible = idx === mainLayerIdx;

        if (shape2D && !is2DVisible) {
            // Hide secondary-layer 2D shapes by toggling their cellView's root
            // group display directly. JointJS doesn't expose a `root` selector
            // we can drive via attrs, so reach into the rendered DOM instead.
            const view2D = paper2D.findViewByModel(shape2D);
            if (view2D?.el) (view2D.el as SVGElement).style.display = 'none';
        } else if (shape2D && is2DVisible) {
            const view2D = paper2D.findViewByModel(shape2D);
            if (view2D?.el) (view2D.el as SVGElement).style.display = '';
        }

        if (!layerIcons || !layerIcons.some(e => !!e.iconId || e.bgEnabled)) {
            shape?.attr(noIconAttrs);
            shape2D?.attr(noIconAttrs);
            continue;
        }
        iconEntries = layerIcons;
        currentShape = shape ?? null;
        currentShape2D = is2DVisible ? (shape2D ?? null) : null;
        applyIconToCurrentShape();
    }
    iconEntries = savedEntries;
    currentShape = savedShape;
    currentShape2D = savedShape2D;
    applyingAllLayerIcons = false;
}

function syncInspectorToLayer(index: number) {
    const layer = layers[index];
    if (!layer) return;

    // baseShape is read directly from the layer via currentBaseShape() now;
    // no module-level cache to keep in sync.

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
    if (widthDisplayEl)  widthDisplayEl.value  = `${Math.round(layer.width)}px`;
    if (heightDisplayEl) heightDisplayEl.value = `${Math.round(layer.height)}px`;
    if (depthDisplayEl)  depthDisplayEl.value  = `${Math.round(layer.depth)}px`;

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
        // Every layer can float freely now — no anchor-to-floor for layers[0].
        baseElevationInput.disabled = false;
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

    // Sync color picker — read directly from the layer's style (no module
    // mirror).
    const repColor = layer.style.topColor || layer.style.frontColor || layer.style.sideColor || '#e0e0e0';
    if (colorPickerRef) colorPickerRef.value = repColor;

    // Sync corner radius and chamfer (may be overridden/hidden for SVG layers
    // by updateDimensionLock). Reads come straight from the layer model —
    // there is no parallel `selected*` cache.
    const syncSlider = (input: HTMLInputElement | null, val: number, displaySuffix = 'px') => {
        if (!input) return;
        input.value = String(val);
        setSliderFill(input);
        const d = input.closest('.nr-sd-number-row')?.querySelector<HTMLInputElement>('.nr-sd-number-display');
        if (d) d.value = `${val}${displaySuffix}`;
    };

    const cr = layer.cornerRadius ?? 0;
    syncSlider(cornerRadiusInput, cr);
    if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = `${cr} px`;

    const cs = layer.chamferSize ?? 0;
    syncSlider(chamferSizeInput, cs);
    if (chamferSizeValueEl) chamferSizeValueEl.textContent = `${cs} px`;

    syncSlider(chamferStartInput, layer.chamferStart ?? 0);
    syncSlider(chamferBottomSizeInput, layer.chamferBottomSize ?? 0);
    syncSlider(chamferBottomStartInput, layer.chamferBottomStart ?? 0);

    const twist = layer.twist ?? 0;
    syncSlider(twistInput, twist);
    if (twistValueEl) twistValueEl.textContent = `${twist}°`;

    const sx = layer.scaleTopX ?? 1;
    syncSlider(stxInput, sx);
    if (stxValueEl) stxValueEl.textContent = sx.toFixed(2);

    const sy = layer.scaleTopY ?? 1;
    syncSlider(styInput, sy);
    if (styValueEl) styValueEl.textContent = sy.toFixed(2);

    syncSlider(shedDropInput, layer.shedRoofDrop ?? 0);

    const shedDir = (layer.shedRoofDirection as string) ?? 'front';
    if (shedDirSwitcherEl) {
        shedDirSwitcherEl.querySelectorAll('.nr-seg-btn').forEach((b, i) =>
            b.classList.toggle('nr-seg-btn--selected', ['front', 'right', 'back', 'left'][i] === shedDir));
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
    const layer = layers[selectedLayerIndex];
    if (!layer) return;
    markDirty();

    layer.offsetX       = parseFloat(offsetXInput.value);
    layer.offsetY       = parseFloat(offsetYInput.value);
    // All layers can float freely now — no more layers[0] === floor constraint.
    layer.baseElevation = parseFloat(baseElevationInput.value);

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
    // If Layer 0's elevation just changed, re-apply the label transform so the
    // label stays anchored to the floor plane (Hit Area), not floating with the layer.
    if (selectedLayerIndex === 0) {
        const txt = (layerShapes[0]?.attr('label/text') as string | undefined) ?? '';
        setShapeLabel(txt);
    }
}

function onAddLayer() {
    editingIconIndex = -1;
    const edPopup = document.getElementById('nr-icon-editor-popup');
    if (edPopup) edPopup.style.display = 'none';
    const stackElevation = layers.reduce((sum, l) => sum + l.depth, 0);

    const newLayer: ShapeLayer = defaultShapeLayer({
        name:          `Layer ${layers.length + 1}`,
        width:         2 * GRID_SIZE,
        height:        2 * GRID_SIZE,
        depth:         GRID_SIZE,
        baseElevation: stackElevation,
        cornerRadius:  0,
    });
    layers.push(newLayer);
    selectedLayerIndex = layers.length - 1;
    iconEntries = newLayer.icons;   // live reference to the new layer's icon array
    markDirty();
    renderLayersOnCanvas();
    buildLayersPanel();
    showLayersPanel();
    buildInspectorPanel();
    syncInspectorToLayer(selectedLayerIndex);
}

function onDeleteLayer(index: number) {
    // Any layer is deletable, but a Shape must keep at least one Layer.
    if (layers.length <= 1) return;
    markDirty();
    editingIconIndex = -1;
    const edPopup = document.getElementById('nr-icon-editor-popup');
    if (edPopup) edPopup.style.display = 'none';
    layers.splice(index, 1);
    if (selectedLayerIndex >= layers.length) selectedLayerIndex = layers.length - 1;
    if (iconLayerIndex    >= layers.length) iconLayerIndex    = 0;
    iconEntries = layers[selectedLayerIndex]?.icons ?? [];
    renderLayersOnCanvas();
    buildLayersPanel();
    // Layers panel stays visible — even at 1 Layer, it shows that one Layer
    // and the "Add Layer" button is the way to grow.
    showLayersPanel();
    buildInspectorPanel();
    syncInspectorToLayer(selectedLayerIndex);
}

// "Up" in the list UI = higher array index = paints higher in the stack.
// All layers can move freely — no special "Main" anchor anymore.
function onMoveLayerUp(index: number) {
    if (index < 0 || index >= layers.length - 1) return;
    [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
    if (selectedLayerIndex === index) selectedLayerIndex = index + 1;
    else if (selectedLayerIndex === index + 1) selectedLayerIndex = index;
    if (iconLayerIndex === index) iconLayerIndex = index + 1;
    else if (iconLayerIndex === index + 1) iconLayerIndex = index;
    markDirty();
    renderLayersOnCanvas();
    buildLayersPanel();
    syncInspectorToLayer(selectedLayerIndex);
    refreshIconAccordionContent();
}

function onMoveLayerDown(index: number) {
    if (index <= 0) return;
    [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
    if (selectedLayerIndex === index) selectedLayerIndex = index - 1;
    else if (selectedLayerIndex === index - 1) selectedLayerIndex = index;
    if (iconLayerIndex === index) iconLayerIndex = index - 1;
    else if (iconLayerIndex === index - 1) iconLayerIndex = index;
    markDirty();
    renderLayersOnCanvas();
    buildLayersPanel();
    syncInspectorToLayer(selectedLayerIndex);
    refreshIconAccordionContent();
}

function onDuplicateLayer(index: number) {
    const source = layers[index];
    // Deep-clone icons so the copy doesn't share entries with the source —
    // shallow `...source` would alias `icons` (same array reference),
    // meaning subsequent edits to either layer would mutate both.
    // Strip `isMain` on every copied icon: a Shape has exactly one Main
    // icon (the original), so the duplicated layer must not carry the flag.
    const copy: ShapeLayer = {
        ...source,
        id:   `layer-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        name: `${source.name} Copy`,
        style: { ...source.style },
        icons: source.icons.map(ie => ({
            ...ie,
            id: `icon-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            isMain: false,
        })),
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

// onComplexShapeToggle deleted — the toggle UI is hidden and the function was
// only called by its click handler. Every Shape is layered now; the natural
// minimum is a one-layer Shape, and "Add Layer" grows the stack.

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
        layers: [defaultShapeLayer({
            width: GRID_SIZE * 2,
            height: GRID_SIZE * 2,
            depth: GRID_SIZE * 0.5,
            icons: [defaultIconEntry({
                id: `icon-${id}-main`,
                iconId: 'cube',
                isMain: true,
            })],
        })],
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
        ...(source ?? { layers: [defaultShapeLayer({ width: GRID_SIZE * 2, height: GRID_SIZE * 2, depth: GRID_SIZE * 0.5 })] }),
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

interface FolderModalOptions {
    mode: 'create' | 'rename';
    folderId?: string;
    initialName?: string;
}

function showFolderModal(opts: FolderModalOptions): void {
    const isRename = opts.mode === 'rename';
    const submitLabel = isRename ? 'Rename Folder' : 'Create Folder';
    const headingText = isRename ? 'Rename Folder' : 'New Folder';

    const modalEl = document.createElement('div');
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-cd-folder-modal-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';

    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-cd-folder-modal-heading';
    headingEl.textContent = headingText;

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
    label.setAttribute('for', 'nr-cd-folder-name-input');
    label.textContent = 'Folder Name';

    const outerWrapper = document.createElement('div');
    outerWrapper.className = 'cds--text-input__field-outer-wrapper';

    const fieldWrapper = document.createElement('div');
    fieldWrapper.className = 'cds--text-input__field-wrapper';

    const nameInput = document.createElement('input');
    nameInput.id = 'nr-cd-folder-name-input';
    nameInput.type = 'text';
    nameInput.className = 'cds--text-input';
    nameInput.placeholder = 'e.g. Networking';
    nameInput.value = opts.initialName ?? '';

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

    const submitBtn = document.createElement('button');
    submitBtn.className = 'cds--btn cds--btn--primary';
    submitBtn.type = 'button';
    submitBtn.textContent = submitLabel;

    const setInvalid = (msg: string) => {
        fieldWrapper.setAttribute('data-invalid', 'true');
        nameInput.className = 'cds--text-input cds--text-input--invalid';
        nameInput.setAttribute('aria-invalid', 'true');
        if (!fieldWrapper.querySelector('.cds--text-input__invalid-icon')) {
            fieldWrapper.insertAdjacentHTML('beforeend', CDS_ICON_WARNING);
        }
        errorEl.textContent = msg;
        errorEl.style.display = '';
        nameInput.focus();
    };

    submitBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name.length < 1) { setInvalid('Please enter a name.'); return; }
        if (userFolderNameExists(name, opts.folderId)) { setInvalid('A folder with this name already exists.'); return; }
        modalEl.remove();
        if (isRename && opts.folderId) {
            renameUserFolder(opts.folderId, name);
        } else {
            createUserFolder(name);
        }
        buildPalettePanel();
    });

    nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') submitBtn.click();
        if (e.key === 'Escape') modalEl.remove();
    });

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(submitBtn);

    containerEl.appendChild(headerEl);
    containerEl.appendChild(bodyEl);
    containerEl.appendChild(footerEl);
    modalEl.appendChild(containerEl);
    document.body.appendChild(modalEl);

    modalEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === modalEl) modalEl.remove();
    });

    nameInput.focus();
    nameInput.select();
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
    const shapes = layerShapes;
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


let componentPanelHandle: {
    rebuild: () => void;
    setSearchTerm?: (term: string) => void;
    updateLabel?: (shapeId: string, newLabel: string) => void;
} | null = null;

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
        // Use the Shape-wide Main IconEntry (CONTEXT.md: isMain is per-Shape).
        // Matches the SD palette + element tree. Querying `layers[0].icons[0]`
        // here previously caused the CD tree and SD tree to disagree whenever
        // the user's Main IconEntry was not the first entry of the first Layer.
        const catId = def ? getPaletteIcon(def)?.iconId : undefined;
        const rendered = renderIcon(catId, 'tree');
        items.push({
            id,
            label: def?.displayName ?? formatLabel(id),
            iconSvg: rendered?.html,
            iconCssClass: rendered?.cssClass,
            collection: USER_CREATED_COLLECTION,
            userFolderId: def?.userFolderId,
        });
    }

    for (const collectionName of getComponentCollections()) {
        for (const s of (byCollection.get(collectionName) ?? [])) {
            const catId = getPaletteIcon(s.definition)?.iconId;
            const rendered = renderIcon(catId, 'tree');
            items.push({
                id: s.id,
                label: s.definition.displayName ?? formatLabel(s.id),
                iconSvg: rendered?.html,
                iconCssClass: rendered?.cssClass,
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
        onCreateComponent: showNewShapeModal,
        onCreateFolder: () => showFolderModal({ mode: 'create' }),
        userFolders: listUserFolders().map(f => ({ id: f.id, name: f.name })),
        onRenameUserFolder: (folderId) => {
            const f = listUserFolders().find(x => x.id === folderId);
            if (!f) return;
            showFolderModal({ mode: 'rename', folderId, initialName: f.name });
        },
        onDeleteUserFolder: (folderId) => onDeleteUserFolderConfirm(folderId),
        onMoveShapeToUserFolder: (shapeId, folderId) => onMoveUserShape(shapeId, folderId),
    });
}

function onMoveUserShape(shapeId: string, folderId: string | null): void {
    const def = ShapeRegistry[shapeId];
    if (!def || BUILT_IN_SHAPE_IDS.has(shapeId)) return;
    // User-generated shapes (the only ones movable into user folders) are not
    // stored in shapeStore('general'); they live directly in the registry.
    if (folderId) def.userFolderId = folderId;
    else delete def.userFolderId;
    saveRegistryToStorage();
    buildPalettePanel();
}

function onDeleteUserFolderConfirm(folderId: string): void {
    const folder = listUserFolders().find(f => f.id === folderId);
    if (!folder) return;

    // Count shapes currently inside the folder so the warning copy reflects
    // the real impact ("X components will move back to User Created").
    const containedShapes = Object.keys(ShapeRegistry).filter(id =>
        !BUILT_IN_SHAPE_IDS.has(id) && ShapeRegistry[id]?.userFolderId === folderId,
    );

    const modalEl = document.createElement('div');
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-del-folder-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';

    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-del-folder-heading';
    headingEl.textContent = 'Delete Folder';

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

    const bodyEl = document.createElement('div');
    bodyEl.className = 'cds--modal-content';

    const msg = document.createElement('p');
    msg.style.cssText = 'font-size:0.875rem;line-height:1.5;margin:0;';
    const countLine = containedShapes.length === 0
        ? `The folder is empty.`
        : containedShapes.length === 1
            ? `<strong>1 component</strong> will move back to <strong>User Created</strong>.`
            : `<strong>${containedShapes.length} components</strong> will move back to <strong>User Created</strong>.`;
    msg.innerHTML =
        `Delete the folder <strong>${folder.name}</strong>?<br><br>` +
        `Only the folder structure is removed — your components are not deleted. ${countLine}`;
    bodyEl.appendChild(msg);

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
    confirmBtn.textContent = 'Delete Folder';
    confirmBtn.addEventListener('click', () => {
        modalEl.remove();
        for (const id of containedShapes) {
            delete ShapeRegistry[id].userFolderId;
        }
        saveRegistryToStorage();
        deleteUserFolder(folderId);
        buildPalettePanel();
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
    modalEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') modalEl.remove();
    });

    cancelBtn.focus();
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

    // Reassign the working `layers` array FIRST — downstream syncs read from
    // it (via currentBaseShape() / currentStyle() / layers[selectedLayerIndex])
    // so they must see the new shape's layers, not the old ones. Legacy
    // shapes whose layer0 has no `baseShape` used to fall back to
    // BASE_SHAPE_BY_ID at read time; patch it here so currentBaseShape()
    // returns the right value.
    if (savedDefaults?.layers?.length) {
        layers             = savedDefaults.layers.map(l => ({ ...l, style: { ...l.style }, icons: l.icons.map(e => ({ ...e })) }));
        selectedLayerIndex = 0;
        if (layers[0] && !layers[0].baseShape) {
            layers[0].baseShape = (BASE_SHAPE_BY_ID[id] ?? 'rectangle') as BaseShape;
        }
        // Normalize isMain: exactly one Main icon across the whole Shape.
        // Old saved Shapes can have multiple `isMain: true` entries (e.g. from
        // the previous layer-duplicate path which carried the flag forward) —
        // keep the first, clear the rest so the UI shows only one minus-less
        // protected icon.
        let seenMain = false;
        for (const l of layers) {
            for (const ie of l.icons) {
                if (ie.isMain) {
                    if (seenMain) ie.isMain = false;
                    else seenMain = true;
                }
            }
        }
    }

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

    const layer0 = savedDefaults?.layers?.[0];

    // Sync modifier sliders with loaded values from layer0 (which is the
    // selected layer right after a fresh shape load, since selectedLayerIndex
    // is reset to 0 above).
    const tw = layer0?.twist ?? 0;
    const sx = layer0?.scaleTopX ?? 1;
    const sy = layer0?.scaleTopY ?? 1;
    if (twistInput) { twistInput.value = String(tw); if (twistValueEl) twistValueEl.textContent = `${tw}°`; }
    if (stxInput)   { stxInput.value   = String(sx); if (stxValueEl)   stxValueEl.textContent   = sx.toFixed(2); }
    if (styInput)   { styInput.value   = String(sy); if (styValueEl)   styValueEl.textContent   = sy.toFixed(2); }

    if (savedDefaults?.layers?.length) {
        iconEntries = layers[0]?.icons ?? [];

        // The complex toggle is obsolete but still exists in the DOM — set it
        // checked for consistency. (Cleanup of the toggle UI is a follow-up.)
        if (complexToggleDiv) complexToggleDiv.classList.add('nr-toggle--checked');
        if (complexToggleBtn) complexToggleBtn.setAttribute('aria-checked', 'true');
        if (positionAccordionLi)     positionAccordionLi.style.display     = '';
        if (svgFootprintAccordionLi) svgFootprintAccordionLi.style.display = '';
        if (iconBgNoBackgroundBtnEl) iconBgNoBackgroundBtnEl.style.display = '';
        if (iconBgCustomColorRowEl)  iconBgCustomColorRowEl.style.display  = '';

        updateSliderRangesForComplexMode(true);
        renderLayersOnCanvas();
        // Label sits on layerShapes[0] visually. It's a cosmetic anchor — the
        // label is logically a Shape-level property, not a per-layer one.
        setShapeLabel(displayName);
        buildLayersPanel();
        // Always show the Layers panel — even a single-layer Shape lists its one
        // Layer so the user can rename it, change its base shape, or click
        // "Add Layer" to grow into a multi-layer Shape.
        showLayersPanel();
        syncInspectorToLayer(0);
    } else {
        // Defensive fallback: a Shape without layers can't be loaded. Should
        // never happen with the new schema, but guard against corrupt data.
        console.warn(`[nextrack] Shape "${id}" has no layers — refusing to load.`);
        return;
    }

    // Show resize handle for adjustable shapes
    updateResizeTools();

    // Refresh the icon section's layer dropdown to match the loaded shape.
    refreshIconAccordionContent();
}

// ── Paper element events ───────────────────────────────────────────────────────

// Re-attach tools if the user clicks the shape after panning the canvas.
// Layer selection is managed exclusively through the Layers panel — the
// canvas is non-interactive for selection purposes.

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
    // Keep the Layers panel in sync with the editor state. Without this it
    // stuck around after the user navigated back to the picker (resetSelection)
    // or hopped into the CD without picking a shape first.
    if (currentShapeId) showLayersPanel(); else hideLayersPanel();
}

// ── Initialise ────────────────────────────────────────────────────────────────

buildInspectorPanel();
buildPalettePanel();
if (currentShapeId) loadShapeIntoCanvas(currentShapeId);
syncEmptyState();

// Vendor catalogs (AWS/Azure/GCP) load asynchronously. The initial palette
// build sees empty entries for vendor icons and renders rows without their
// SVGs; without this listener the CD palette stays stale while the SD palette
// (which has its own onCatalogChange hook) refreshes correctly. Same hook here
// keeps the two trees in sync.
onCatalogChange(() => {
    buildPalettePanel();
});
