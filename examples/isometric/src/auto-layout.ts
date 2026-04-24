import { dia, g } from '@joint/core';
import { DirectedGraph } from '@joint/layout-directed-graph';
import { GRID_SIZE } from './theme';
import { sortElements } from './utils';
import { View } from './shapes/isometric-shape';
import { carbonIconToString, CarbonIcon } from './icons';
import Grid16 from '@carbon/icons/es/grid/16.js';
import ArrowRight16 from '@carbon/icons/es/arrow--right/16.js';
import ArrowDown16 from '@carbon/icons/es/arrow--down/16.js';
import ArrowLeft16 from '@carbon/icons/es/arrow--left/16.js';
import ArrowUp16 from '@carbon/icons/es/arrow--up/16.js';
import AlignHorizontalCenter16 from '@carbon/icons/es/align--horizontal-center/16.js';
import AlignVerticalCenter16 from '@carbon/icons/es/align--vertical-center/16.js';

const ICON_GRID   = carbonIconToString(Grid16 as CarbonIcon);
const ICON_RIGHT  = carbonIconToString(ArrowRight16 as CarbonIcon);
const ICON_DOWN   = carbonIconToString(ArrowDown16 as CarbonIcon);
const ICON_LEFT   = carbonIconToString(ArrowLeft16 as CarbonIcon);
const ICON_UP     = carbonIconToString(ArrowUp16 as CarbonIcon);
const ICON_H_CENTER = carbonIconToString(AlignHorizontalCenter16 as CarbonIcon);
const ICON_V_CENTER = carbonIconToString(AlignVerticalCenter16 as CarbonIcon);

let toolbarEl: HTMLDivElement | null = null;
let graph: dia.Graph;
let getView: () => View;
let getSelectedZone: () => dia.Element | null = () => null;
let getSelectedElements: () => dia.Element[] = () => [];
let getGridSize: () => { w: number; h: number } = () => ({ w: 20, h: 20 });

export function initAutoLayout(
    container: HTMLDivElement,
    g: dia.Graph,
    viewFn: () => View,
    zoneFn: () => dia.Element | null,
    selectionFn: () => dia.Element[],
    gridSizeFn: () => { w: number; h: number },
): void {
    toolbarEl = container;
    graph = g;
    getView = viewFn;
    getSelectedZone = zoneFn;
    getSelectedElements = selectionFn;
    getGridSize = gridSizeFn;

    container.className = 'nr-layout-bar';

    // Grid layout
    addBtn(container, ICON_GRID, 'Grid layout', () => applyGridLayout(getTargetElements()));

    addSep(container);

    // Stack direction
    addBtn(container, ICON_DOWN,  'Stack top → bottom', () => applyStack('TB'));
    addBtn(container, ICON_RIGHT, 'Stack left → right',  () => applyStack('LR'));
    addBtn(container, ICON_UP,    'Stack bottom → top',  () => applyStack('BT'));
    addBtn(container, ICON_LEFT,  'Stack right → left',  () => applyStack('RL'));

    addSep(container);

    // Alignment
    addBtn(container, ICON_H_CENTER, 'Align horizontal center', () => applyAlign('horizontal'));
    addBtn(container, ICON_V_CENTER, 'Align vertical center',   () => applyAlign('vertical'));
}

function addBtn(parent: HTMLElement, icon: string, tooltip: string, onClick: () => void): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nr-layout-bar__btn';
    btn.title = tooltip;
    btn.setAttribute('aria-label', tooltip);
    btn.innerHTML = icon;
    btn.addEventListener('click', onClick);
    parent.appendChild(btn);
}

function addSep(parent: HTMLElement): void {
    const sep = document.createElement('div');
    sep.className = 'nr-layout-bar__sep';
    parent.appendChild(sep);
}

function getTargetElements(): dia.Element[] {
    // 1. Area-selected elements
    const selected = getSelectedElements();
    if (selected.length > 1) {
        return selected.filter(el => !el.get('isFrame') && el.get('componentRole') !== 'child');
    }

    // 2. Selected zone → its embedded children
    const zone = getSelectedZone();
    if (zone) {
        return zone.getEmbeddedCells().filter(
            c => !c.get('isFrame') && c.get('componentRole') !== 'child'
        ) as dia.Element[];
    }

    // 3. Fallback: all non-frame, non-child elements
    return graph.getElements().filter(
        el => !el.get('isFrame') && el.get('componentRole') !== 'child'
    );
}

interface Bounds { x: number; y: number; w: number; h: number; }

function getLayoutBounds(): Bounds {
    const zone = getSelectedZone();
    if (zone) {
        const pos = zone.position();
        const size = zone.size();
        const pad = GRID_SIZE;
        return { x: pos.x + pad, y: pos.y + pad, w: size.width - pad * 2, h: size.height - pad * 2 };
    }
    const gs = getGridSize();
    return { x: GRID_SIZE, y: GRID_SIZE, w: (gs.w - 2) * GRID_SIZE, h: (gs.h - 2) * GRID_SIZE };
}

// ---- Grid Layout ----

function applyGridLayout(elements: dia.Element[]): void {
    if (elements.length === 0) return;

    const bounds = getLayoutBounds();
    const gap = GRID_SIZE * 2;

    // Determine max element size for uniform cell sizing
    let maxW = 0, maxH = 0;
    for (const el of elements) {
        const s = el.size();
        if (s.width > maxW) maxW = s.width;
        if (s.height > maxH) maxH = s.height;
    }

    const cellW = maxW + gap;
    const cellH = maxH + gap;
    const cols = Math.max(1, Math.floor(bounds.w / cellW));

    graph.startBatch('layout');
    elements.forEach((el, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        el.position(
            bounds.x + col * cellW,
            bounds.y + row * cellH,
        );
    });
    graph.stopBatch('layout');
    if (getView() === View.Isometric) sortElements(graph);
}

// ---- Stack (Directed Graph) ----

function applyStack(rankDir: 'TB' | 'BT' | 'LR' | 'RL'): void {
    const elements = getTargetElements();
    if (elements.length === 0) return;

    const bounds = getLayoutBounds();

    // Collect only links between target elements
    const ids = new Set(elements.map(el => el.id as string));
    const links = graph.getLinks().filter(l => {
        const src = (l.source() as { id?: string }).id;
        const tgt = (l.target() as { id?: string }).id;
        return src && tgt && ids.has(src) && ids.has(tgt);
    });

    const cells = [...elements, ...links];

    // Adapt separations to fit within bounds
    const avgW = elements.reduce((s, el) => s + el.size().width, 0) / elements.length;
    const avgH = elements.reduce((s, el) => s + el.size().height, 0) / elements.length;
    const isHorizontal = rankDir === 'LR' || rankDir === 'RL';
    const availMain = isHorizontal ? bounds.w : bounds.h;
    const availCross = isHorizontal ? bounds.h : bounds.w;
    const avgMain = isHorizontal ? avgW : avgH;
    const avgCross = isHorizontal ? avgH : avgW;

    const maxRankSep = Math.max(GRID_SIZE, (availMain - avgMain * elements.length) / Math.max(1, elements.length));
    const maxNodeSep = Math.max(GRID_SIZE, (availCross - avgCross * elements.length) / Math.max(1, elements.length));

    graph.startBatch('layout');

    const bbox = DirectedGraph.layout(cells, {
        rankDir,
        nodeSep: Math.min(GRID_SIZE * 2, maxNodeSep),
        rankSep: Math.min(GRID_SIZE * 3, maxRankSep),
        edgeSep: GRID_SIZE,
        marginX: 0,
        marginY: 0,
        setVertices: false,
    });

    // Shift layout result into bounds
    const offsetX = bounds.x - bbox.x;
    const offsetY = bounds.y - bbox.y;

    for (const el of elements) {
        const pos = el.position();
        const size = el.size();
        el.position(
            Math.max(bounds.x, Math.min(bounds.x + bounds.w - size.width, pos.x + offsetX)),
            Math.max(bounds.y, Math.min(bounds.y + bounds.h - size.height, pos.y + offsetY)),
        );
    }

    graph.stopBatch('layout');
    if (getView() === View.Isometric) sortElements(graph);
}

// ---- Alignment ----

function applyAlign(axis: 'horizontal' | 'vertical'): void {
    const elements = getTargetElements();
    if (elements.length < 2) return;

    graph.startBatch('layout');

    if (axis === 'horizontal') {
        // Align all to the average Y center
        let sumY = 0;
        elements.forEach(el => {
            const pos = el.position();
            sumY += pos.y + el.size().height / 2;
        });
        const avgY = sumY / elements.length;
        elements.forEach(el => {
            const pos = el.position();
            el.position(pos.x, avgY - el.size().height / 2);
        });
    } else {
        // Align all to the average X center
        let sumX = 0;
        elements.forEach(el => {
            const pos = el.position();
            sumX += pos.x + el.size().width / 2;
        });
        const avgX = sumX / elements.length;
        elements.forEach(el => {
            const pos = el.position();
            el.position(avgX - el.size().width / 2, pos.y);
        });
    }

    graph.stopBatch('layout');
    if (getView() === View.Isometric) sortElements(graph);
}

export function showLayoutBar(): void {
    if (toolbarEl) toolbarEl.style.display = '';
}

export function hideLayoutBar(): void {
    if (toolbarEl) toolbarEl.style.display = 'none';
}
