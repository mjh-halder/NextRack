import { dia, V } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { cellNamespace } from './shapes';
import { Link } from './shapes/link/link';
import { SHAPE_FACTORIES, BASE_SHAPE_BY_ID, FORM_FACTOR_PREVIEWS, getPreviewFactory } from './shapes/shape-factories';
import { drawGrid, switchView, transformationMatrix } from './utils';
import { GRID_SIZE, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE, MIN_ZOOM, MAX_ZOOM } from './theme';

// Component designer uses a fixed 10×10 GU grid, independent of the system designer.
const CD_GRID_COUNT = 10;
import { ShapeRegistry, BUILT_IN_SHAPE_IDS, updateShapeDefaults, deleteShape, addShape, saveRegistryToStorage } from './shapes/shape-registry';
import { BaseShape } from './shapes/shape-definition';
import { PRIMARY_COLORS } from './colors';
import cubeIconSvg from '../assets/cube-icon.svg';
import routerIconSvg from '../assets/router-icon.svg';
import switchIconSvg from '../assets/switch-icon.svg';
import k8sControlNodeIconSvg from '../assets/kubernetesControlNode-logo.svg';
import k8sWorkerNodeIconSvg from '../assets/kubernetesWorkerNode-logo.svg';
import virtualInstanceIconSvg from '../assets/virtualinstance-logo.svg';
import serverDnsSvg from '../assets/server--dns.svg';
import pipelinesSvg from '../assets/pipelines.svg';
import boxSvg from '../assets/box.svg';
import securitySvg from '../assets/security (1).svg';
import mediaLibrarySvg from '../assets/media--library--filled.svg';
import licenseSvg from '../assets/license.svg';
import apiSvg from '../assets/API--1.svg';
import sapSvg from '../assets/SAP.svg';
import vmwareSvg from '../assets/logo--vmware.svg';
import ansibleSvg from '../assets/logo--red-hat-ansible.svg';
import reactSvg from '../assets/logo--react.svg';
import pythonSvg from '../assets/logo--python.svg';
import openshiftSvg from '../assets/logo--openshift.svg';
import kubernetesSvg from '../assets/logo--kubernetes.svg';
import gitSvg from '../assets/logo--git.svg';
import virtualMachineSvg from '../assets/virtual-machine.svg';
import databaseSvg from '../assets/data--base.svg';
import objectStorageSvg from '../assets/object-storage.svg';
import bareMetalServerSvg from '../assets/ibm-cloud--bare-metal-server.svg';
import tuningSvg from '../assets/tuning.svg';
import aiAgentSvg from '../assets/ai-agent-invocation.svg';
import cubeSvg from '../assets/cube.svg';
import k8sControlPlaneSvg from '../assets/kubernetes--control-plane-node.svg';
import instanceVirtualSvg from '../assets/instance--virtual.svg';
import k8sWorkerNodeSvg from '../assets/kubernetes--worker-node.svg';

// DOM elements
const canvasEl     = document.getElementById('cd2-canvas')                as HTMLDivElement;
const canvasEl2D   = document.getElementById('cd2-canvas-2d')             as HTMLDivElement;
const inspectorEl  = document.getElementById('cd2-inspector')             as HTMLDivElement;
const paletteEl    = document.getElementById('cd2-palette')               as HTMLDivElement;
const designNameEl = document.getElementById('cd2-design-name')           as HTMLDivElement;



const AVAILABLE_ICONS = [
    // Generic
    { id: 'cube',                  label: 'Cube',                  svg: cubeIconSvg },
    { id: 'cube-alt',              label: 'Cube (alt)',            svg: cubeSvg },
    { id: 'box',                   label: 'Box',                   svg: boxSvg },
    { id: 'license',               label: 'License',               svg: licenseSvg },
    { id: 'tuning',                label: 'Tuning',                svg: tuningSvg },
    { id: 'media-library',         label: 'Media Library',         svg: mediaLibrarySvg },
    { id: 'pipelines',             label: 'Pipelines',             svg: pipelinesSvg },
    { id: 'ai-agent',              label: 'AI Agent',              svg: aiAgentSvg },
    // Network & Security
    { id: 'router',                label: 'Router',                svg: routerIconSvg },
    { id: 'switch',                label: 'Switch',                svg: switchIconSvg },
    { id: 'server-dns',            label: 'DNS Server',            svg: serverDnsSvg },
    { id: 'security',              label: 'Security',              svg: securitySvg },
    { id: 'api',                   label: 'API',                   svg: apiSvg },
    // Compute & Storage
    { id: 'virtual-machine',       label: 'Virtual Machine',       svg: virtualMachineSvg },
    { id: 'instance-virtual',      label: 'Instance',              svg: instanceVirtualSvg },
    { id: 'virtual-instance',      label: 'Virtual Instance',      svg: virtualInstanceIconSvg },
    { id: 'bare-metal-server',     label: 'Bare Metal Server',     svg: bareMetalServerSvg },
    { id: 'database',              label: 'Database',              svg: databaseSvg },
    { id: 'object-storage',        label: 'Object Storage',        svg: objectStorageSvg },
    // Kubernetes
    { id: 'k8s-control-node',      label: 'K8s Control Node',     svg: k8sControlNodeIconSvg },
    { id: 'k8s-control-plane',     label: 'K8s Control Plane',    svg: k8sControlPlaneSvg },
    { id: 'k8s-worker-node',       label: 'K8s Worker Node',      svg: k8sWorkerNodeIconSvg },
    { id: 'k8s-worker-node-alt',   label: 'K8s Worker (alt)',     svg: k8sWorkerNodeSvg },
    { id: 'kubernetes',            label: 'Kubernetes',            svg: kubernetesSvg },
    { id: 'openshift',             label: 'OpenShift',             svg: openshiftSvg },
    // Platforms & Tools
    { id: 'vmware',                label: 'VMware',                svg: vmwareSvg },
    { id: 'ansible',               label: 'Ansible',               svg: ansibleSvg },
    { id: 'python',                label: 'Python',                svg: pythonSvg },
    { id: 'react',                 label: 'React',                 svg: reactSvg },
    { id: 'git',                   label: 'Git',                   svg: gitSvg },
    { id: 'sap',                   label: 'SAP',                   svg: sapSvg },
];

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

// Icon background state (not persisted to registry)
const selectedIconBgEnabled = true;
let selectedIconBgColor = PRIMARY_COLORS[0].base; // Grey 70 by default
let selectedIconBgShape: 'circle' | 'square' = 'circle';

// Direct references to the swatch buttons so syncExtrasFromShape can update
// them without relying on a DOM query that could match unrelated elements.
let iconBgSwatchRefs: Array<{ btn: HTMLElement; colorBase: string }> = [];

// Icon white tint state
let iconPage = 0;
const ICON_PAGE_SIZE = 12;

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
    // Single shape: only clamp to positive coordinates, no obstacle logic needed.
    restrictTranslate: () => (x: number, y: number) => ({
        x: Math.max(0, x),
        y: Math.max(0, y),
    }),
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
let widthInput:   HTMLInputElement;
let heightInput:  HTMLInputElement;
let depthInput:   HTMLInputElement;
let widthValueEl:  HTMLElement;
let heightValueEl: HTMLElement;
let depthValueEl:  HTMLElement;
let cornerRadiusInput:  HTMLInputElement;
let cornerRadiusValueEl: HTMLElement;
let cornerRadiusRowEl:  HTMLElement;
let chamferSizeInput:   HTMLInputElement;
let chamferSizeValueEl: HTMLElement;
let chamferRowEl:       HTMLElement;
let iconFaceRowEl:      HTMLElement;

const CDS_ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M11 4V3a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v1H1v1h1l.9 9a1 1 0 0 0 1 .9h8.1a1 1 0 0 0 1-.9L14 5h1V4zm-5-1h4v1H6zm6 10H4L3.1 5h9.8z"/></svg>`;

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
    slider.addEventListener('input', () => {
        valueEl.textContent = `${parseFloat(slider.value).toFixed(1)} GU`;
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

function buildFormFactorContent(container: HTMLElement) {
    // proportional-cuboid is not listed here: it is a resize behavior (aspect-ratio lock),
    // not a distinct geometry. Hexagonal and Octagon use it internally.
    const options = [
        { value: 'cuboid',      label: 'Cube' },
        { value: 'cylinder',    label: 'Cylinder' },
        { value: 'pyramid',     label: 'Pyramid' },
        { value: 'hexagonal',   label: 'Hexagonal' },
        { value: 'octagon',     label: 'Octagon' },
    ];

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'cds--radio-button-group cds--radio-button-group--vertical';
    fieldset.style.border = 'none';
    fieldset.style.padding = '0';
    fieldset.style.margin = '0';

    for (const opt of options) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cds--radio-button-wrapper';

        const input = document.createElement('input');
        input.type = 'radio';
        input.className = 'cds--radio-button';
        input.name = 'sd-form-factor';
        input.id = `sd-ff-${opt.value}`;
        input.value = opt.value;
        if (opt.value === selectedBaseShape) input.checked = true;

        const lbl = document.createElement('label');
        lbl.className = 'cds--radio-button__label';
        lbl.setAttribute('for', `sd-ff-${opt.value}`);
        lbl.innerHTML = `<span class="cds--radio-button__appearance"></span><span class="cds--radio-button__label-text">${opt.label}</span>`;

        input.addEventListener('change', () => {
            selectedBaseShape = opt.value as BaseShape;
            applyFormFactorToCanvas();
        });;

        wrapper.appendChild(input);
        wrapper.appendChild(lbl);
        fieldset.appendChild(wrapper);
    }

    container.appendChild(fieldset);
}

const NO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><line x1="6" y1="16" x2="26" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// Generates a composite SVG: colored background shape with icon SVG centered inside.
function buildCompositeIconSvg(iconSvg: string, bgColor: string, bgShape: 'circle' | 'square'): string {
    const S = 64;
    const pad = 13; // ~20% inset on each side
    const iconInner = S - 2 * pad;
    const bgEl = bgShape === 'circle'
        ? `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="${bgColor}"/>`
        : `<rect width="${S}" height="${S}" rx="6" fill="${bgColor}"/>`;
    const iconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`;
    // White-tint is applied via an SVG <filter> on the <image> element rather than
    // via a CSS :root rule inside the icon SVG. A CSS :root rule in a nested
    // data-URI SVG can be misscoped to the composite SVG's root by the browser
    // when the parent element transitions from display:none to visible, causing
    // the background colour to be incorrectly overridden.
    // The feColorMatrix below maps every non-transparent pixel to white (R=G=B=1)
    // while preserving the original alpha channel.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><defs><filter id="nr-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs>${bgEl}<image href="${iconHref}" x="${pad}" y="${pad}" width="${iconInner}" height="${iconInner}" filter="url(#nr-white)"/></svg>`;
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
    if (!currentShape) return;
    const icon = AVAILABLE_ICONS.find(i => i.id === selectedIcon);
    if (!icon) {
        // Zero size hides the image without touching display — group selectors
        // (iso / 2d) must remain the sole controllers of element visibility.
        const noIconAttrs = {
            topIcon:   { href: '', width: 0, height: 0 },
            topIcon2D: { href: '', width: 0, height: 0 },
        };
        currentShape.attr(noIconAttrs);
        currentShape2D?.attr(noIconAttrs);
        return;
    }
    const svgSource = buildCompositeIconSvg(icon.svg, selectedIconBgColor, selectedIconBgShape);
    const iconPx = selectedIconSize * GRID_SIZE;
    const { width: w, height: h } = currentShape.size();
    const iH = currentShape.isometricHeight;
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
        topIconAttrs = {
            href,
            x: localX,
            y: localY,
            width:  iconPx,
            height: iconPx,
            transform: `matrix(1,0,-1,-1,0,${h})`,
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
        topIcon:   topIconAttrs,
        topIcon2D: { href, x: x2D, y: y2D, width: iconPx, height: iconPx },
    };
    currentShape.attr(iconAttrs);
    currentShape2D?.attr(iconAttrs);

    // Guarantee the icon element is rendered above all face paths.
    // JointJS attr() never reorders DOM nodes, so this DOM move persists.
    const isoView = paper.findViewByModel(currentShape);
    if (isoView) raiseToFront(isoView.el, 'topIcon');
    if (currentShape2D) {
        const view2D = paper2D.findViewByModel(currentShape2D);
        if (view2D) raiseToFront(view2D.el, 'topIcon2D');
    }
}

function buildIconContent(container: HTMLElement) {
    // All slots: null = "no icon", then each icon entry
    const allIcons: Array<{ id: string | null; label: string; svg: string }> = [
        { id: null, label: 'No icon', svg: NO_ICON_SVG },
        ...AVAILABLE_ICONS.map(ic => ({ id: ic.id, label: ic.label, svg: ic.svg })),
    ];
    const totalPages = Math.ceil(allIcons.length / ICON_PAGE_SIZE);

    const grid = document.createElement('div');
    grid.className = 'nr-sd-icon-grid';

    const paginationRow = document.createElement('div');
    paginationRow.className = 'nr-sd-icon-pagination';

    function renderPage() {
        grid.innerHTML = '';
        const start = iconPage * ICON_PAGE_SIZE;
        const pageIcons = allIcons.slice(start, start + ICON_PAGE_SIZE);

        for (const icon of pageIcons) {
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

            grid.appendChild(btn);
        }

        prevBtn.disabled = iconPage === 0;
        nextBtn.disabled = iconPage >= totalPages - 1;
        pageLabel.textContent = `${iconPage + 1} / ${totalPages}`;
    }

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'nr-sd-icon-page-btn';
    prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M10 11.5L5.5 8 10 4.5z"/></svg>`;
    prevBtn.addEventListener('click', () => { iconPage--; renderPage(); });

    const pageLabel = document.createElement('span');
    pageLabel.className = 'nr-sd-icon-page-label';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'nr-sd-icon-page-btn';
    nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M6 4.5L10.5 8 6 11.5z"/></svg>`;
    nextBtn.addEventListener('click', () => { iconPage++; renderPage(); });

    paginationRow.appendChild(prevBtn);
    paginationRow.appendChild(pageLabel);
    paginationRow.appendChild(nextBtn);

    renderPage();

    container.appendChild(grid);
    container.appendChild(paginationRow);

    // Face toggle — top or front (cuboid only)
    iconFaceRowEl = document.createElement('div');
    iconFaceRowEl.className = 'nr-sd-face-row';
    iconFaceRowEl.style.display = selectedBaseShape === 'cuboid' ? '' : 'none';

    const faceLbl = document.createElement('label');
    faceLbl.className = 'cds--label';
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

    slider.addEventListener('input', () => {
        selectedIconSize = parseFloat(slider.value);
        sliderValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
        applyIconToCurrentShape();
    });

    sliderRow.appendChild(labelRow);
    sliderRow.appendChild(slider);
    container.appendChild(sliderRow);
}

function buildIconBackgroundContent(container: HTMLElement) {
    // ── Color swatches ────────────────────────────────────────────────────────
    const swatchGrid = document.createElement('div');
    swatchGrid.className = 'nr-sd-icon-grid';

    // Reset refs so syncExtrasFromShape always has fresh references.
    iconBgSwatchRefs = [];

    for (const color of PRIMARY_COLORS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-sd-icon-btn' + (selectedIconBgColor === color.base ? ' nr-sd-icon-btn--selected' : '');
        btn.setAttribute('title', color.label);
        btn.setAttribute('aria-label', color.label);
        iconBgSwatchRefs.push({ btn, colorBase: color.base });

        const swatch = document.createElement('span');
        swatch.style.cssText = `display:block;width:20px;height:20px;border-radius:50%;background:${color.base};transition:background 0.1s;`;
        btn.appendChild(swatch);

        btn.addEventListener('mouseenter', () => { swatch.style.background = color.hover; });
        btn.addEventListener('mouseleave', () => { swatch.style.background = color.base; });
        btn.addEventListener('click', () => {
            selectedIconBgColor = color.base;
            swatchGrid.querySelectorAll('.nr-sd-icon-btn').forEach(b =>
                b.classList.toggle('nr-sd-icon-btn--selected', b === btn)
            );
            applyIconToCurrentShape();
        });
        swatchGrid.appendChild(btn);
    }

    container.appendChild(swatchGrid);

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

    slider.addEventListener('input', () => {
        selectedIconSize = parseFloat(slider.value);
        sliderValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
        // Keep the Icon-section size slider in sync
        const iconSizeSlider = document.querySelector<HTMLInputElement>('#sd-icon-size');
        const iconSizeValue  = document.querySelector<HTMLElement>('#sd-icon-size-value');
        if (iconSizeSlider) iconSizeSlider.value = String(selectedIconSize);
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

    const bgShapeOptions: Array<{ value: 'circle' | 'square'; label: string }> = [
        { value: 'circle', label: 'Circle' },
        { value: 'square', label: 'Square' },
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
            applyIconToCurrentShape();
        });

        wrapper.appendChild(input);
        wrapper.appendChild(lbl);
        fieldset.appendChild(wrapper);
    }

    container.appendChild(fieldset);
}

function buildColorContent(container: HTMLElement) {
    const COLOR_FIELDS: Array<{ label: string; id: string; key: keyof typeof selectedStyle }> = [
        { label: 'Top face',   id: 'sd-color-top',    key: 'topColor' },
        { label: 'Front face', id: 'sd-color-front',  key: 'frontColor' },
        { label: 'Side face',  id: 'sd-color-side',   key: 'sideColor' },
        { label: 'Stroke',     id: 'sd-color-stroke', key: 'strokeColor' },
    ];

    for (const field of COLOR_FIELDS) {
        const row = document.createElement('div');
        row.className = 'nr-sd-color-row';

        const lbl = document.createElement('label');
        lbl.className = 'cds--label';
        lbl.setAttribute('for', field.id);
        lbl.textContent = field.label;

        const input = document.createElement('input');
        input.type = 'color';
        input.id = field.id;
        input.className = 'nr-sd-color-input';
        input.value = selectedStyle[field.key] || '#e0e0e0';

        input.addEventListener('input', () => { selectedStyle[field.key] = input.value; });

        row.appendChild(lbl);
        row.appendChild(input);
        container.appendChild(row);
    }
}

function buildInspectorPanel() {
    inspectorEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'nr-panel-header';
    const title = document.createElement('span');
    title.className = 'nr-panel-title';
    title.textContent = 'Shape Template';
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
        if (!currentShape) return;
        currentShape.attr('label/text', shapeNameInput.value);
        currentShape2D?.attr('label/text', shapeNameInput.value);
    });

    nameSection.appendChild(nameLabel);
    nameSection.appendChild(shapeNameInput);
    inspectorEl.appendChild(nameSection);

    const accordion = document.createElement('ul');
    accordion.className = 'cds--accordion';
    accordion.appendChild(buildAccordionItem('Form Factor',  true, buildFormFactorContent));
    accordion.appendChild(buildAccordionItem('Dimensions',   true, buildDimensionsContent));
    accordion.appendChild(buildAccordionItem('Icon',            true,  buildIconContent));
    accordion.appendChild(buildAccordionItem('Icon Background', false, buildIconBackgroundContent));
    accordion.appendChild(buildAccordionItem('Color',           true,  buildColorContent));
    inspectorEl.appendChild(accordion);

    const footer = document.createElement('div');
    footer.className = 'nr-sd-panel-footer';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    saveBtn.type = 'button';
    saveBtn.style.width = '100%';
    saveBtn.textContent = 'Save Defaults';
    saveBtn.addEventListener('click', onSave);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'cds--btn cds--btn--sm nr-btn--danger-ghost';
    deleteBtn.type = 'button';
    deleteBtn.style.width = '100%';
    deleteBtn.innerHTML = `${CDS_ICON_TRASH} Delete Shape`;
    deleteBtn.addEventListener('click', () => showDeleteConfirmModal(currentShapeId));

    footer.appendChild(saveBtn);
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

function applyCornerRadiusToCurrentShape() {
    if (!currentShape) return;
    currentShape.set('cornerRadius', selectedCornerRadius);
    currentShape2D?.set('cornerRadius', selectedCornerRadius);
}

function applyChamferSizeToCurrentShape() {
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
        if (heightValueEl) heightValueEl.textContent = `${parseFloat(widthInput.value).toFixed(1)} GU`;
    }

    // Pyramid requires at least 2 GU of depth.
    const minDepth = selectedBaseShape === 'pyramid' ? 2 : 0;
    depthInput.min = String(minDepth);
    if (parseFloat(depthInput.value) < minDepth) {
        depthInput.value = String(minDepth);
        if (depthValueEl) depthValueEl.textContent = `${minDepth.toFixed(1)} GU`;
    }

    // Corner radius, chamfer, and icon face are only available for cuboid shapes.
    const showEdgeControls = supportsCornerRadius(selectedBaseShape);
    if (cornerRadiusRowEl) cornerRadiusRowEl.style.display = showEdgeControls ? '' : 'none';
    if (chamferRowEl)      chamferRowEl.style.display      = showEdgeControls ? '' : 'none';
    if (iconFaceRowEl)     iconFaceRowEl.style.display     = showEdgeControls ? '' : 'none';
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
}

// Update form factor, icon, and color controls from the registry for the given shape id.
function syncExtrasFromShape(id: string) {
    const defaults = ShapeRegistry[id];

    selectedBaseShape   = (defaults?.baseShape ?? BASE_SHAPE_BY_ID[id] ?? 'cuboid') as BaseShape;
    selectedIconFace    = defaults?.iconFace   ?? 'top';
    selectedIcon        = defaults?.icon       ?? null;
    selectedIconSize    = defaults?.iconSize   ?? 1;
    selectedIconBgColor = defaults?.iconBgColor ?? PRIMARY_COLORS[0].base;
    selectedIconBgShape = (defaults?.iconBgShape ?? 'circle') as 'circle' | 'square';
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
    if (sizeSlider) sizeSlider.value = String(selectedIconSize);
    if (sizeValueEl) sizeValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;
    const bgSizeSlider = inspectorEl.querySelector<HTMLInputElement>('#sd-icon-bg-size');
    const bgSizeValueEl = inspectorEl.querySelector<HTMLElement>('#sd-icon-bg-size-value');
    if (bgSizeSlider) bgSizeSlider.value = String(selectedIconSize);
    if (bgSizeValueEl) bgSizeValueEl.textContent = `${selectedIconSize.toFixed(1)} cells`;

    // Sync icon background color swatches using direct refs (avoids false DOM matches).
    for (const { btn, colorBase } of iconBgSwatchRefs) {
        btn.classList.toggle('nr-sd-icon-btn--selected', colorBase === selectedIconBgColor);
    }

    // Sync icon background shape radio
    inspectorEl.querySelectorAll<HTMLInputElement>('input[name="sd-icon-bg-shape"]').forEach(r => {
        r.checked = r.value === selectedIconBgShape;
    });

    // Sync color inputs
    const colorMap: Array<[string, string]> = [
        ['sd-color-top',    selectedStyle.topColor    || '#e0e0e0'],
        ['sd-color-front',  selectedStyle.frontColor  || '#e0e0e0'],
        ['sd-color-side',   selectedStyle.sideColor   || '#e0e0e0'],
        ['sd-color-stroke', selectedStyle.strokeColor || '#e0e0e0'],
    ];
    for (const [elId, value] of colorMap) {
        const el = inspectorEl.querySelector<HTMLInputElement>(`#${elId}`);
        if (el) el.value = value;
    }

    // Apply dimension lock now that selectedBaseShape has been updated.
    updateDimensionLock();
}

// Swap the canvas shape to match the selected form factor, preserving current dimensions.
function applyFormFactorToCanvas() {
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
    shape.addTools(paper, View.Isometric);
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
}

// Persist all template values to the Shape Registry.
function onSave() {
    if (!currentShape) return;
    const widthGU  = parseFloat(widthInput.value);
    const heightGU = parseFloat(heightInput.value);
    const depthGU  = parseFloat(depthInput.value);
    if (isNaN(widthGU) || isNaN(heightGU) || isNaN(depthGU)) return;

    // Pre-compute the composite icon data URI so the system designer can apply
    // the icon to instances without needing its own icon-building logic.
    let iconHref: string | undefined;
    if (selectedIcon) {
        const iconEntry = AVAILABLE_ICONS.find(i => i.id === selectedIcon);
        if (iconEntry) {
            const svg = buildCompositeIconSvg(iconEntry.svg, selectedIconBgColor, selectedIconBgShape);
            iconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }
    }

    updateShapeDefaults(currentShapeId, {
        displayName: shapeNameInput?.value.trim() || formatLabel(currentShapeId),
        defaultSize: { width: widthGU * GRID_SIZE, height: heightGU * GRID_SIZE },
        defaultIsometricHeight: depthGU * GRID_SIZE,
        baseShape: selectedBaseShape,
        iconFace: selectedIconFace,
        icon: selectedIcon ?? undefined,
        iconSize: selectedIconSize,
        iconBgColor: selectedIconBgColor,
        iconBgShape: selectedIconBgShape,
        iconHref,
        style: {
            topColor:    selectedStyle.topColor    || undefined,
            frontColor:  selectedStyle.frontColor  || undefined,
            sideColor:   selectedStyle.sideColor   || undefined,
            strokeColor: selectedStyle.strokeColor || undefined,
        },
    });
    saveRegistryToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
}

// Keep form in sync when resize or height tools are used directly on the shape.
graph.on('change:size', (cell: dia.Cell) => {
    if (currentShape && cell.id === currentShape.id) {
        syncFormFromShape(currentShape);
        applyIconToCurrentShape();
        if (currentShape2D) {
            const { width, height } = currentShape.size();
            currentShape2D.resize(width, height);
        }
    }
});

graph.on('change:isometricHeight', (cell: dia.Cell) => {
    if (currentShape && cell.id === currentShape.id) {
        syncFormFromShape(currentShape);
        applyIconToCurrentShape();
        if (currentShape2D) {
            currentShape2D.set('isometricHeight', currentShape.get('isometricHeight'));
        }
    }
});

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
        designNameEl.style.display = 'none';
    } else {
        const next = remaining.includes(currentShapeId) ? currentShapeId : remaining[0];
        currentShapeId = next;
        loadShapeIntoCanvas(next);
    }
    buildPalettePanel();
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

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'nr-palette-new-btn';
    newBtn.textContent = '+ New Shape';
    newBtn.addEventListener('click', showNewShapeModal);
    paletteEl.appendChild(newBtn);

    const list = document.createElement('ul');
    list.className = 'nr-palette-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Components');

    for (const id of Object.keys(ShapeRegistry).filter(id => !BUILT_IN_SHAPE_IDS.has(id))) {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(id === currentShapeId));

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-palette-item' + (id === currentShapeId ? ' nr-palette-item--selected' : '');
        btn.textContent = formatLabel(id);
        btn.dataset.shapeId = id;

        btn.addEventListener('click', () => {
            list.querySelectorAll<HTMLButtonElement>('.nr-palette-item').forEach(b => {
                b.classList.toggle('nr-palette-item--selected', b === btn);
                b.closest('li')?.setAttribute('aria-selected', String(b === btn));
            });
            currentShapeId = id;
            loadShapeIntoCanvas(id);
        });

        li.appendChild(btn);
        list.appendChild(li);
    }

    paletteEl.appendChild(list);
}

// ── Canvas shape loading ───────────────────────────────────────────────────────

function loadShapeIntoCanvas(id: string) {
    paper.removeTools();
    graph.clear();
    graph2D.clear();
    currentZoom = 1;
    // Reset the paper matrix so the viewport always returns to the centred baseline.
    paper.matrix(transformationMatrix(View.Isometric, CD_MARGIN, SIDEBAR_INSET, CD_GRID_COUNT));

    const savedBaseShape = ShapeRegistry[id]?.baseShape ?? BASE_SHAPE_BY_ID[id] ?? 'cuboid';
    const factory = getPreviewFactory(id, savedBaseShape);
    if (!factory) return;

    // Load saved dimensions from registry; fall back to 2×2×2 GU for new shapes.
    const FALLBACK_GU = 2 * GRID_SIZE;
    const savedDefaults = ShapeRegistry[id];
    const initWidth  = savedDefaults?.defaultSize?.width              ?? FALLBACK_GU;
    const initHeight = savedDefaults?.defaultSize?.height             ?? FALLBACK_GU;
    const initDepth  = savedDefaults?.defaultIsometricHeight          ?? FALLBACK_GU;

    // Centre the shape on the 10×10 GU canvas regardless of its size.
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
    shape.addTools(paper, View.Isometric);
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

    const displayName = ShapeRegistry[id]?.displayName ?? formatLabel(id);
    shape.attr('label/text', displayName);
    shape2D.attr('label/text', displayName);
    if (shapeNameInput) shapeNameInput.value = displayName;

    syncFormFromShape(shape);   // sets widthInput / heightInput
    syncExtrasFromShape(id);    // sets selectedBaseShape, then calls updateDimensionLock

    // Reset icon page and corner radius/chamfer for each new shape load.
    iconPage = 0;
    selectedCornerRadius = 0;
    if (cornerRadiusInput)   cornerRadiusInput.value = '0';
    if (cornerRadiusValueEl) cornerRadiusValueEl.textContent = '0 px';
    applyCornerRadiusToCurrentShape();

    selectedChamferSize = 0;
    if (chamferSizeInput)   chamferSizeInput.value = '0';
    if (chamferSizeValueEl) chamferSizeValueEl.textContent = '0 px';
    applyChamferSizeToCurrentShape();
    applyIconToCurrentShape();

    designNameEl.textContent = formatLabel(id);
    designNameEl.style.display = 'block';
}

// ── Paper element events ───────────────────────────────────────────────────────

// Re-attach tools if the user clicks the shape after panning the canvas.
paper.on('element:pointerup', (elementView: dia.ElementView) => {
    paper.removeTools();
    const shape = elementView.model as IsometricShape;
    shape.addTools(paper, View.Isometric);
    currentShape = shape;
});

// ── Exported panel shim ────────────────────────────────────────────────────────
// index.ts calls cdPanel.hide() when switching back to the System Designer.

export const panel = {
    hide: () => { /* nothing to collapse in the Shape Designer */ },
};

// ── Initialise ────────────────────────────────────────────────────────────────

buildInspectorPanel();
buildPalettePanel();
if (currentShapeId) loadShapeIntoCanvas(currentShapeId);
