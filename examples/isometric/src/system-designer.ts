import { g, dia, V, highlighters, routers } from '@joint/core';
import Obstacles from './obstacles';
import IsometricShape, { View } from './shapes/isometric-shape';
import { Computer, Database, ActiveDirectory, User, Firewall, Switch, Router, Link, Frame, cellNamespace } from './shapes';
import { sortElements, drawGrid, switchView, applyRegistryDefaults } from './utils';
import { GRID_SIZE, GRID_COUNT, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE, MIN_ZOOM, MAX_ZOOM } from './theme';
import { PropertyPanel, META_KEY } from './inspector';
import { ShapeRegistry } from './shapes/shape-registry';
import { ComponentPalette } from './palette';
import { saveGraph, loadGraph, saveDefaultDesign, loadDefaultDesign } from './persistence';
import {
    ensureExampleCanvas, listCanvases, createCanvas, deleteCanvas,
    getActiveCanvasId, setActiveCanvasId, saveCanvasGraph, loadCanvasGraph, CanvasRecord,
} from './canvas-store';
import { initUndoRedo, undo, redo, clearHistory } from './undo-redo';
import { initMinimap, updateMinimapView } from './minimap';
import { initResourceBar, showResourceBar, hideResourceBar, showZoneHud, hideZoneHud } from './resource-bar';
import { initWorkloadTable, showWorkloadTable, hideWorkloadTable } from './workload-table';
import { getCanvas } from './canvas-store';
import { ViewToggle } from './view-toggle';
import { AreaSelect } from './area-select';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import BringToFront16 from '@carbon/icons/es/bring-to-front/16.js';
import SendToBack16 from '@carbon/icons/es/send-to-back/16.js';
import ConnectionSignalOff16 from '@carbon/icons/es/connection-signal--off/16.js';

// Inline Carbon SVG icons (16 × 16) used in the menu components
const CDS_ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M12 4.7l-.7-.7L8 7.3 4.7 4l-.7.7L7.3 8 4 11.3l.7.7L8 8.7l3.3 3.3.7-.7L8.7 8z"/></svg>`;
const CDS_ICON_CHEVRON_DOWN = `<svg class="cds--select__arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`;
const CDS_ICON_WARNING = `<svg class="cds--text-input__invalid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 1C4.2 1 1 4.2 1 8s3.2 7 7 7 7-3.1 7-7-3.1-7-7-7zm-.5 3h1v5h-1V4zm.5 8.2c-.4 0-.8-.4-.8-.8s.4-.8.8-.8.8.4.8.8-.4.8-.8.8z"/></svg>`;

export const canvasEl = document.getElementById('canvas') as HTMLDivElement;
export const viewToggleContainerEl = document.getElementById('view-toggle-container') as HTMLDivElement;
const inspectorEl = document.getElementById('inspector') as HTMLDivElement;
export const paletteEl = document.getElementById('palette') as HTMLDivElement;
export const designNameEl = document.getElementById('design-name') as HTMLDivElement;

function deleteSelected() {
    if (!currentCell) return;
    // For a complex component, the base's embedded "child" layers are internal
    // geometry — they must be removed alongside the base.
    if (!(currentCell instanceof Link) && currentCell.get('componentRole') === 'base') {
        const children = currentCell.getEmbeddedCells()
            .filter(c => c.get('componentRole') === 'child');
        for (const c of children) c.remove();
    }
    currentCell.remove();
    // currentCell and panel are cleaned up by the graph 'remove' listener below
}

function cloneConnectedLinks(
    originals: dia.Element[],
    idMap: Map<string, string>,
    offset: number,
): dia.Link[] {
    const originalIds = new Set(originals.map(el => el.id as string));
    const seen = new Set<string>();
    const clonedLinks: dia.Link[] = [];

    for (const el of originals) {
        for (const link of graph.getConnectedLinks(el)) {
            const linkId = link.id as string;
            if (seen.has(linkId)) continue;
            seen.add(linkId);

            const srcId = (link.source() as { id?: string }).id;
            const tgtId = (link.target() as { id?: string }).id;
            if (!srcId || !tgtId) continue;
            if (!originalIds.has(srcId) || !originalIds.has(tgtId)) continue;

            const clonedLink = link.clone() as dia.Link;
            clonedLink.source({ ...link.source() as object, id: idMap.get(srcId) ?? srcId } as dia.Link.EndJSON);
            clonedLink.target({ ...link.target() as object, id: idMap.get(tgtId) ?? tgtId } as dia.Link.EndJSON);

            const verts = clonedLink.vertices();
            if (verts.length) {
                clonedLink.vertices(verts.map(v => ({ x: v.x + offset, y: v.y + offset })));
            }
            clonedLinks.push(clonedLink);
        }
    }
    return clonedLinks;
}

function duplicateSelected() {
    if (!currentCell || currentCell instanceof Link) return;
    graph.startBatch('duplicate');
    const offset = GRID_SIZE * 2;
    const clone = currentCell.clone() as IsometricShape;
    const { x, y } = currentCell.position();
    clone.position(x + offset, y + offset);
    clone.toggleView(currentView);

    const childLayers = currentCell.get('componentRole') === 'base'
        ? currentCell.getEmbeddedCells().filter(c => c.get('componentRole') === 'child') as IsometricShape[]
        : [];
    const clonedChildren = childLayers.map(child => {
        const cc = child.clone() as IsometricShape;
        const { x: cx, y: cy } = child.position();
        cc.position(cx + offset, cy + offset);
        cc.toggleView(currentView);
        return cc;
    });

    const idMap = new Map<string, string>();
    idMap.set(currentCell.id as string, clone.id as string);
    for (let i = 0; i < childLayers.length; i++) {
        idMap.set(childLayers[i].id as string, clonedChildren[i].id as string);
    }

    const clonedLinks = cloneConnectedLinks([currentCell, ...childLayers], idMap, offset);

    graph.addCells([clone, ...clonedChildren, ...clonedLinks]);
    for (const cc of clonedChildren) clone.embed(cc);

    paper.removeTools();
    clone.addTools(paper, currentView, []);
    panel.show(clone);
    currentCell = clone;
    graph.stopBatch('duplicate');
    if (currentView === View.Isometric) sortElements(graph);
}

function duplicateZone(frame: Frame): void {
    graph.startBatch('duplicate');
    const offset = GRID_SIZE * 4;
    const clonedFrame = frame.clone() as Frame;
    const { x, y } = frame.position();
    clonedFrame.position(x + offset, y + offset);

    const embeddedElements = frame.getEmbeddedCells()
        .filter(c => c instanceof IsometricShape && !c.get('isFrame')) as IsometricShape[];

    const idMap = new Map<string, string>();
    const clonedChildren = embeddedElements.map(child => {
        const clone = child.clone() as IsometricShape;
        const { x: cx, y: cy } = child.position();
        clone.position(cx + offset, cy + offset);
        clone.toggleView(currentView);
        idMap.set(child.id as string, clone.id as string);
        return clone;
    });

    const clonedLinks = cloneConnectedLinks(embeddedElements, idMap, offset);

    graph.addCells([clonedFrame, ...clonedChildren, ...clonedLinks]);
    clonedFrame.toggleView(currentView);
    for (const child of clonedChildren) {
        clonedFrame.embed(child);
    }
    graph.stopBatch('duplicate');
    if (currentView === View.Isometric) sortElements(graph);
}

export const panel = new PropertyPanel(inspectorEl, {
    onDelete: deleteSelected,
    onDuplicate: duplicateSelected,
    onDuplicateZone: (frame) => duplicateZone(frame as Frame),
});

// Left inset = nav rail (48px) + palette width (208px) + breathing room (20px).
// Content is shifted right by this amount so it starts clear of the sidebars.
const SIDEBAR_INSET = 276;

// Carbon --cds-interactive blue, used as the tree-selection highlight on shapes
const TREE_HIGHLIGHT_ID = 'tree-selection';
const TREE_HIGHLIGHT_COLOR = HIGHLIGHT_COLOR;

let currentView = View.Isometric;
let currentCell: IsometricShape | Link = null;
let currentZoom = 1;
let currentGridCountX = GRID_COUNT;
let currentGridCountY = GRID_COUNT;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gridVEl: any = null;
let gridVisible = true;
let treeHighlightedCell: IsometricShape | null = null;
let currentFrame: Frame | null = null;

export const graph = new dia.Graph({}, { cellNamespace });

// Obstacles listen to changes in the graph and update their internal state
const obstacles = new Obstacles(graph);
graph.set('obstacles', obstacles);

// Undo/redo must be initialized after obstacles to avoid capturing the
// circular graph.set('obstacles') call in the history.
initUndoRedo(graph);

// A complex component's non-base layers ("child" role) are part of the
// component's geometry — they must not be independently draggable, selectable,
// or exposable to the link tool. Any click on them resolves to the base layer.
function resolveComponentBase(cell: dia.Element): dia.Element {
    if (cell.get('componentRole') === 'child') {
        const parent = cell.getParentCell();
        if (parent && !parent.isLink() && (parent as dia.Element).get('componentRole') === 'base') {
            return parent as dia.Element;
        }
    }
    return cell;
}

// Outward direction vector per port — used by the short-distance router to
// add orthogonal approach/departure points so links never run along edges.
function portDirection(portId: string): { dx: number; dy: number } {
    switch (portId) {
        case 'front': return { dx:  0, dy:  1 };
        case 'back':  return { dx:  0, dy: -1 };
        case 'right': return { dx:  1, dy:  0 };
        case 'left':  return { dx: -1, dy:  0 };
        default:      return { dx:  0, dy:  0 };
    }
}

const paper = new dia.Paper({
    el: canvasEl,
    model: graph,
    interactive: (cellView) => {
        if (cellView.model.get('componentRole') === 'child') {
            // Child layers forward clicks (handled in element:pointerup) but
            // cannot be dragged, resized, or link-started independently.
            return false;
        }
        return true;
    },
    // Prevent the elements from being dragged outside of the paper
    // and from being dropped on top of other elements
    restrictTranslate: (elementView) => {
        const element = elementView.model;
        // Frames are not tracked as obstacles; they move freely within the canvas.
        if (element.get('isFrame')) {
            return (x: number, y: number) => ({ x: Math.max(0, x), y: Math.max(0, y) });
        }
        const isometricEl = element as IsometricShape;
        const { width, height } = isometricEl.size();
        // a little memory allocation optimization
        // we don't need to create a new rect on every call, we can reuse the same one
        const newBBox = new g.Rect();
        return function(x, y) {
            newBBox.update(x, y, width, height);
            return obstacles.isFree(newBBox, isometricEl.cid)
                ? { x, y }
                : isometricEl.position();
        }
    },
    gridSize: GRID_SIZE / 2,
    async: true,
    autoFreeze: true,
    defaultConnectionPoint: {
        name: 'anchor',
        args: { offset: 4 },
    },
    defaultRouter: (vertices, args, linkView) => {
        const manhattanArgs = {
            step: GRID_SIZE / 2,
            startDirections: ['top', 'bottom', 'left', 'right'],
            endDirections:   ['top', 'bottom', 'left', 'right'],
            isPointObstacle: (point) => {
                const x = Math.floor(point.x / GRID_SIZE) * GRID_SIZE - GRID_SIZE / 2;
                const y = Math.floor(point.y / GRID_SIZE) * GRID_SIZE - GRID_SIZE / 2;
                const rect = new g.Rect(x, y, GRID_SIZE * 2, GRID_SIZE * 1.5);
                return !obstacles.isFree(rect);
            }
        };
        // Very short direct connections (≤ 2.5 GU, no user waypoints):
        // straight line — Manhattan would kink due to overlapping obstacle zones.
        // Everything else goes through Manhattan for clean orthogonal routing.
        if (vertices.length === 0) {
            const srcCenter = linkView.sourceBBox.center();
            const tgtCenter = linkView.targetBBox.center();
            if (srcCenter.distance(tgtCenter) <= GRID_SIZE * 2.5) {
                return routers.normal(vertices, args, linkView);
            }
        }
        return routers.manhattan(vertices, manhattanArgs as any, linkView);
    },
    defaultLink: () => new Link(),
    linkPinning: false,
    overflow: true,
    snapLinks: { radius: GRID_SIZE },
    cellViewNamespace: cellNamespace,
    defaultAnchor: { name: 'modelCenter' },
    validateConnection: (_cellViewS, _magnetS, cellViewT, magnetT) => {
        // Only allow connections that land on a port magnet — never on the
        // element body. This prevents links from attaching to the model
        // center when the user misses a port.
        if (!magnetT) return false;
        const port = cellViewT?.findAttribute('port', magnetT);
        return !!port;
    },
    highlighting: {
        default: {
            name: 'mask',
            options: {
                layer: dia.Paper.Layers.BACK,
                attrs: {
                    'stroke': HIGHLIGHT_COLOR,
                    'stroke-width': 3,
                }
            }
        }
    }
});

gridVEl = drawGrid(paper, GRID_COUNT, GRID_SIZE);

// Canvas dimensions: sidebar inset on the left + grid content + extra whitespace on
// the right and bottom so panning feels open with room on all sides.
const CANVAS_H_PAD = 200;
const CANVAS_V_PAD = 200;
paper.setDimensions(
    SIDEBAR_INSET + 2 * GRID_SIZE * GRID_COUNT * SCALE * ISOMETRIC_SCALE + CANVAS_H_PAD,
    GRID_SIZE * GRID_COUNT * SCALE + CANVAS_V_PAD
);

// Ensure the example canvas exists (migrates legacy default design on first run)
ensureExampleCanvas();
let activeCanvasId = getActiveCanvasId();
loadCanvasGraph(activeCanvasId, graph);

// Clean up selection when a cell is removed by any means (tool, keyboard, inspector)

graph.on('remove', (cell: dia.Cell) => {
    if (currentCell && currentCell.id === cell.id) {
        currentCell = null;
        panel.hide();
    }
    if (currentFrame && currentFrame.id === cell.id) {
        currentFrame = null;
        panel.hide();
    }
    if (treeHighlightedCell && treeHighlightedCell.id === cell.id) {
        treeHighlightedCell = null;
        palette.setTreeSelection(null);
    }
});

// Keyboard: Delete/Backspace → delete selected; Ctrl+D → duplicate selected

document.addEventListener('keydown', (e: KeyboardEvent) => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (areaSelect.hasSelection) {
            areaSelect.deleteSelection();
        } else {
            deleteSelected();
        }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
});

// Sort cells on position and size change

graph.on('change:position change:size', () => {
    if (currentView !== View.Isometric) return;
    sortElements(graph);
});

// Zoom via mouse wheel (blank and cell areas)

function applyWheelZoom(evt: dia.Event, x: number, y: number, delta: number) {
    evt.preventDefault();
    // Clamp raw delta to ±1 so large trackpad swipes don't jump multiple steps.
    // Use a small step (2%) for slow, precise zoom.
    const clampedDelta = Math.sign(delta) * Math.min(Math.abs(delta), 1);
    const step = clampedDelta > 0 ? 1.02 : 1 / 1.02;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * step));
    if (newZoom === currentZoom) return;
    const factor = newZoom / currentZoom;
    currentZoom = newZoom;
    const mx = paper.matrix();
    // x, y are paper-local (model-space) coords supplied by JointJS.
    // The zoom anchor must be in SVG/screen-space, so project through the current matrix.
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

// Zoom anchored to the centre of the usable viewport (header + sidebar excluded)
function applyMenuZoom(factor: number) {
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));
    if (newZoom === currentZoom) return;
    const zoomFactor = newZoom / currentZoom;
    currentZoom = newZoom;
    const mx = paper.matrix();
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const sx = SIDEBAR_INSET + (window.innerWidth  - SIDEBAR_INSET) / 2;
    const sy = headerH               + (window.innerHeight - headerH)       / 2;
    paper.matrix(
        V.createSVGMatrix()
            .translate(sx, sy)
            .scale(zoomFactor)
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

// Switch between isometric and 2D view

new ViewToggle(viewToggleContainerEl, 'isometric', (view) => {
    currentView = view === 'isometric' ? View.Isometric : View.TwoDimensional;
    currentZoom = 1;
    switchView(paper, currentView, currentCell, SIDEBAR_INSET, currentGridCountX);
    updateMinimapView(currentView, currentGridCountX);
});

switchView(paper, currentView, currentCell, SIDEBAR_INSET, currentGridCountX);

// ---- Minimap ----

const minimapEl = document.getElementById('minimap') as HTMLDivElement;
initMinimap(minimapEl, graph, paper);

const workloadTableEl = document.getElementById('workload-table') as HTMLDivElement;
initWorkloadTable(workloadTableEl);

const resourceBarEl = document.getElementById('resource-bar') as HTMLDivElement;
initResourceBar(resourceBarEl, graph);

// ---- New Design ----

// Compute the scroll position that centers the grid in the usable viewport area
// (viewport width minus sidebar). Must be called after switchView() sets the matrix.
function centerGridInViewport(gridCountX: number, gridCountY: number) {
    const mx = paper.matrix();
    const W = gridCountX * GRID_SIZE;
    const H = gridCountY * GRID_SIZE;
    // Transform the four grid corners through the current paper matrix
    const corners = [
        { x: 0, y: 0 }, { x: W, y: 0 }, { x: 0, y: H }, { x: W, y: H },
    ].map(p => ({
        sx: mx.a * p.x + mx.c * p.y + mx.e,
        sy: mx.b * p.x + mx.d * p.y + mx.f,
    }));
    const minX = Math.min(...corners.map(c => c.sx));
    const maxX = Math.max(...corners.map(c => c.sx));
    const minY = Math.min(...corners.map(c => c.sy));
    const maxY = Math.max(...corners.map(c => c.sy));
    const gridCenterX = (minX + maxX) / 2;
    const gridCenterY = (minY + maxY) / 2;
    const vpCenterX = SIDEBAR_INSET + (window.innerWidth - SIDEBAR_INSET) / 2;
    const vpCenterY = window.innerHeight / 2;
    window.scroll(Math.max(0, gridCenterX - vpCenterX), Math.max(0, gridCenterY - vpCenterY));
}

function applyNewDesign(name: string, gridCount: number) {
    paper.removeTools();
    currentCell = null;
    currentZoom = 1;
    currentGridCountX = gridCount;
    currentGridCountY = gridCount;
    panel.hide();

    // Resize obstacle grid before clearing so removal events use the correct size
    obstacles.sizeX = gridCount;
    obstacles.sizeY = gridCount;
    graph.clear();
    clearHistory();
    // Rebuild the obstacle grid at the new size (graph is empty so this just resets it)
    obstacles.update();

    if (gridVEl) gridVEl.remove();
    gridVEl = drawGrid(paper, gridCount, GRID_SIZE);

    paper.setDimensions(
        SIDEBAR_INSET + 2 * GRID_SIZE * gridCount * SCALE * ISOMETRIC_SCALE + CANVAS_H_PAD,
        GRID_SIZE * gridCount * SCALE + CANVAS_V_PAD
    );

    switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
    centerGridInViewport(currentGridCountX, currentGridCountY);
    updateMinimapView(currentView, currentGridCountX);

    designNameEl.textContent = name;
    designNameEl.style.display = 'block';
}

function showNewDesignModal() {
    // Carbon Modal structure: cds--modal is the full-viewport overlay + dialog container
    const modalEl = document.createElement('div');
    // In @carbon/styles v1.x, the visible state is toggled with `is-visible`,
    // not `cds--modal--open`. Without it the modal has opacity:0/visibility:hidden.
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-modal-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';

    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-modal-heading';
    headingEl.textContent = 'New Design';

    // cds--modal-close-button wrapper provides position:absolute top-right placement
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

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'cds--modal-content';

    // Carbon TextInput — Design Name
    const nameFormItem = document.createElement('div');
    nameFormItem.className = 'cds--form-item';

    const nameInputWrapper = document.createElement('div');
    nameInputWrapper.className = 'cds--text-input-wrapper';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'cds--label';
    nameLabel.setAttribute('for', 'nr-name-input');
    nameLabel.textContent = 'Design Name';

    const nameOuterWrapper = document.createElement('div');
    nameOuterWrapper.className = 'cds--text-input__field-outer-wrapper';

    const nameFieldWrapper = document.createElement('div');
    nameFieldWrapper.className = 'cds--text-input__field-wrapper';

    const nameInput = document.createElement('input');
    nameInput.id = 'nr-name-input';
    nameInput.type = 'text';
    nameInput.className = 'cds--text-input';
    nameInput.placeholder = 'e.g. Data Center East';

    const nameErrorEl = document.createElement('div');
    nameErrorEl.className = 'cds--form-requirement';
    nameErrorEl.id = 'nr-name-error';
    nameErrorEl.style.display = 'none';

    nameFieldWrapper.appendChild(nameInput);
    nameOuterWrapper.appendChild(nameFieldWrapper);
    nameInputWrapper.appendChild(nameLabel);
    nameInputWrapper.appendChild(nameOuterWrapper);
    nameInputWrapper.appendChild(nameErrorEl);
    nameFormItem.appendChild(nameInputWrapper);

    // Carbon Select — Grid Size
    const sizeFormItem = document.createElement('div');
    sizeFormItem.className = 'cds--form-item';

    const sizeSelectWrapper = document.createElement('div');
    sizeSelectWrapper.className = 'cds--select';

    const sizeLabel = document.createElement('label');
    sizeLabel.className = 'cds--label';
    sizeLabel.setAttribute('for', 'nr-size-select');
    sizeLabel.textContent = 'Grid Size';

    const sizeInputWrapper = document.createElement('div');
    sizeInputWrapper.className = 'cds--select-input-wrapper';

    const sizeSelect = document.createElement('select');
    sizeSelect.id = 'nr-size-select';
    sizeSelect.className = 'cds--select-input';

    for (const opt of [
        { label: 'Small (40 × 40)',   value: '40' },
        { label: 'Medium (80 × 80)',  value: '80' },
        { label: 'Large (120 × 120)', value: '120' },
    ]) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        option.className = 'cds--select-option';
        if (opt.value === '80') option.selected = true;
        sizeSelect.appendChild(option);
    }

    sizeInputWrapper.appendChild(sizeSelect);
    sizeInputWrapper.insertAdjacentHTML('beforeend', CDS_ICON_CHEVRON_DOWN);
    sizeSelectWrapper.appendChild(sizeLabel);
    sizeSelectWrapper.appendChild(sizeInputWrapper);
    sizeFormItem.appendChild(sizeSelectWrapper);

    bodyEl.appendChild(nameFormItem);
    bodyEl.appendChild(sizeFormItem);

    // Footer
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
        if (name.length < 3) {
            // Apply Carbon invalid state to the TextInput
            nameFieldWrapper.setAttribute('data-invalid', 'true');
            nameInput.className = 'cds--text-input cds--text-input--invalid';
            nameInput.setAttribute('aria-invalid', 'true');
            nameInput.setAttribute('aria-describedby', 'nr-name-error');
            if (!nameFieldWrapper.querySelector('.cds--text-input__invalid-icon')) {
                nameFieldWrapper.insertAdjacentHTML('beforeend', CDS_ICON_WARNING);
            }
            nameErrorEl.textContent = 'Name must be at least 3 characters.';
            nameErrorEl.style.display = '';
            nameInput.focus();
            return;
        }
        const gridCount = parseInt(sizeSelect.value, 10);
        modalEl.remove();
        applyNewDesign(name, gridCount);
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

    // Close on backdrop click (the cds--modal element itself is the overlay)
    modalEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === modalEl) modalEl.remove();
    });

    nameInput.focus();
}

// ---- Export SVG ----

function cleanSvgForExport(clone: SVGSVGElement): void {
    // Remove grid and back-layer decorations
    clone.querySelectorAll('[data-grid], .joint-back-layer').forEach(el => el.remove());

    // Remove port/anchor circles
    clone.querySelectorAll('.joint-port').forEach(el => el.remove());

    // Ensure <image> href is also set as xlink:href for compatibility
    clone.querySelectorAll('image').forEach(img => {
        const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href) {
            img.setAttribute('href', href);
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
        }
    });
}

function downloadSvg(clone: SVGSVGElement, filename: string): void {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportCanvasSvg(): void {
    const svgEl = paper.el.querySelector('svg');
    if (!svgEl) return;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    cleanSvgForExport(clone);

    // Measure content bounding box
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);

    const contentGroup = clone.querySelector('.joint-cells-layer') as SVGGElement | null;
    const bbox = contentGroup ? contentGroup.getBBox() : clone.getBBox();
    document.body.removeChild(clone);

    if (bbox.width === 0 || bbox.height === 0) return;

    const pad = 16;
    clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    clone.setAttribute('width', String(Math.ceil(bbox.width + pad * 2)));
    clone.setAttribute('height', String(Math.ceil(bbox.height + pad * 2)));
    clone.removeAttribute('style');

    const docName = designNameEl.textContent?.trim() || 'design';
    const filename = docName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.svg';
    downloadSvg(clone, filename);
}

// ---- Toast ----

function showToast(message: string) {
    const n = document.createElement('div');
    n.className = 'cds--inline-notification cds--inline-notification--success';
    n.setAttribute('role', 'status');
    n.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9000;min-width:260px;max-width:400px;';
    n.innerHTML = `<div class="cds--inline-notification__details"><p class="cds--inline-notification__title">${message}</p></div>`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

// ---- Adjust Grid Size ----

function applyGridResize(newX: number, newY: number) {
    currentGridCountX = newX;
    currentGridCountY = newY;
    obstacles.sizeX = newX;
    obstacles.sizeY = newY;
    obstacles.update();

    if (gridVEl) gridVEl.remove();
    gridVEl = drawGrid(paper, newX, GRID_SIZE, '#e8e8e8', newY);

    paper.setDimensions(
        SIDEBAR_INSET + 2 * GRID_SIZE * newX * SCALE * ISOMETRIC_SCALE + CANVAS_H_PAD,
        GRID_SIZE * newY * SCALE + CANVAS_V_PAD
    );

    switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
    centerGridInViewport(currentGridCountX, currentGridCountY);
    updateMinimapView(currentView, currentGridCountX);
}

function showAdjustGridModal() {
    const modalEl = document.createElement('div');
    modalEl.className = 'cds--modal is-visible';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'nr-grid-modal-heading');

    const containerEl = document.createElement('div');
    containerEl.className = 'cds--modal-container cds--modal-container--sm';

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'cds--modal-header';

    const headingEl = document.createElement('p');
    headingEl.className = 'cds--modal-header__heading';
    headingEl.id = 'nr-grid-modal-heading';
    headingEl.textContent = 'Adjust Grid Size';

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

    // Body — two number inputs side by side
    const bodyEl = document.createElement('div');
    bodyEl.className = 'cds--modal-content';
    bodyEl.style.display = 'flex';
    bodyEl.style.gap = '1rem';

    function makeNumberField(id: string, label: string, value: number): { wrapper: HTMLElement; input: HTMLInputElement } {
        const formItem = document.createElement('div');
        formItem.className = 'cds--form-item';
        formItem.style.flex = '1';

        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'cds--text-input-wrapper';

        const lbl = document.createElement('label');
        lbl.className = 'cds--label';
        lbl.setAttribute('for', id);
        lbl.textContent = label;

        const outerWrapper = document.createElement('div');
        outerWrapper.className = 'cds--text-input__field-outer-wrapper';

        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'cds--text-input__field-wrapper';

        const input = document.createElement('input');
        input.id = id;
        input.type = 'number';
        input.className = 'cds--text-input';
        input.min = '5';
        input.max = '500';
        input.value = String(value);

        fieldWrapper.appendChild(input);
        outerWrapper.appendChild(fieldWrapper);
        inputWrapper.appendChild(lbl);
        inputWrapper.appendChild(outerWrapper);
        formItem.appendChild(inputWrapper);

        return { wrapper: formItem, input };
    }

    const { wrapper: xWrapper, input: xInput } = makeNumberField('nr-grid-x', 'Width (columns)', currentGridCountX);
    const { wrapper: yWrapper, input: yInput } = makeNumberField('nr-grid-y', 'Height (rows)', currentGridCountY);
    bodyEl.appendChild(xWrapper);
    bodyEl.appendChild(yWrapper);

    // Footer
    const footerEl = document.createElement('div');
    footerEl.className = 'cds--modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cds--btn cds--btn--secondary';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => modalEl.remove());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'cds--btn cds--btn--primary';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        const newX = Math.max(5, Math.min(500, parseInt(xInput.value, 10) || currentGridCountX));
        const newY = Math.max(5, Math.min(500, parseInt(yInput.value, 10) || currentGridCountY));
        modalEl.remove();
        applyGridResize(newX, newY);
    });

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(saveBtn);

    containerEl.appendChild(headerEl);
    containerEl.appendChild(bodyEl);
    containerEl.appendChild(footerEl);
    modalEl.appendChild(containerEl);
    document.body.appendChild(modalEl);

    modalEl.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === modalEl) modalEl.remove();
    });

    xInput.focus();
    xInput.select();
}


// Apply or remove the Carbon-blue edge highlight that syncs tree ↔ canvas selection.
function setTreeHighlight(cell: IsometricShape | null) {
    if (treeHighlightedCell) {
        const prevView = paper.findViewByModel(treeHighlightedCell);
        if (prevView) highlighters.mask.remove(prevView, TREE_HIGHLIGHT_ID);
    }
    treeHighlightedCell = cell;
    if (cell) {
        const cellView = paper.findViewByModel(cell);
        if (cellView) {
            highlighters.mask.add(cellView, 'base', TREE_HIGHLIGHT_ID, {
                layer: dia.Paper.Layers.BACK,
                attrs: { stroke: TREE_HIGHLIGHT_COLOR, 'stroke-width': 3 }
            });
        }
    }
    palette.setTreeSelection(cell ? String(cell.id) : null);
}

const palette = new ComponentPalette(paletteEl, graph, () => currentView, (shape) => {
    paper.removeTools();
    shape.addTools(paper, currentView, []);
    if (shape.get('isFrame')) {
        currentCell = null;
        panel.hide();
    } else {
        currentCell = shape;
        panel.show(shape);
        setTreeHighlight(shape);
    }
    if (currentView === View.Isometric) {
        sortElements(graph);
    }
}, (cellId: string) => {
    // Tree item clicked — select the element on the canvas
    const cell = graph.getCell(cellId);
    if (!cell || !(cell instanceof IsometricShape) || cell.get('isFrame')) return;
    paper.removeTools();
    cell.addTools(paper, currentView, []);
    currentCell = cell;
    panel.show(cell);
    setTreeHighlight(cell);
});

// Let the palette know which zone is selected so new components get embedded.
palette.setActiveZoneGetter(() => currentFrame);

// Canvas switching
palette.setCanvasCallbacks(
    (id) => switchCanvas(id),
    () => showNewCanvasDialog(),
    (id) => showDeleteCanvasDialog(id),
);
palette.refreshCanvasDropdown(activeCanvasId);

function switchCanvas(id: string): void {
    saveCanvasGraph(activeCanvasId, graph);
    paper.removeTools();
    currentCell = null;
    currentFrame = null;
    hideZoneHud();
    if (typeof areaSelect !== 'undefined') areaSelect.clear();
    graph.clear();
    clearHistory();
    activeCanvasId = id;
    setActiveCanvasId(id);

    const canvas = getCanvas(id);
    const isWorkload = canvas?.layerType === 'Workloads';

    if (isWorkload) {
        canvasEl.style.display = 'none';
        viewToggleContainerEl.style.display = 'none';
        minimapEl.style.display = 'none';
        hideResourceBar();
        hideWorkloadTable();
        showWorkloadTable(id);
    } else {
        hideWorkloadTable();
        canvasEl.style.display = '';
        viewToggleContainerEl.style.display = '';
        minimapEl.style.display = '';
        showResourceBar();
        loadCanvasGraph(id, graph);
        switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
        updateMinimapView(currentView, currentGridCountX);
    }

    panel.showLayer(id, () => palette.refreshCanvasDropdown(id), () => switchCanvas(id));
}

function buildModalOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'nr-dm__overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    return overlay;
}

function buildModalShell(titleText: string, danger = false): HTMLDivElement {
    const dialog = document.createElement('div');
    dialog.className = 'nr-dm__dialog' + (danger ? ' nr-dm__dialog--danger' : '');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', titleText);

    const header = document.createElement('div');
    header.className = 'nr-dm__dialog-header';
    const headerContent = document.createElement('div');
    headerContent.className = 'nr-dm__dialog-header-content';
    const title = document.createElement('h3');
    title.className = 'nr-dm__dialog-title';
    title.textContent = titleText;
    headerContent.appendChild(title);
    header.appendChild(headerContent);
    dialog.appendChild(header);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nr-dm__dialog-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M24 9.4L22.6 8 16 14.6 9.4 8 8 9.4 14.6 16 8 22.6 9.4 24 16 17.4 22.6 24 24 22.6 17.4 16 24 9.4z"/></svg>';
    closeBtn.addEventListener('click', () => { dialog.closest('.nr-dm__overlay')?.remove(); });
    dialog.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'nr-dm__dialog-content';
    dialog.appendChild(content);

    return dialog;
}

function buildModalRow(labelText: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'nr-dm__dialog-row';
    const label = document.createElement('label');
    label.className = 'cds--label';
    label.textContent = labelText;
    row.appendChild(label);
    return row;
}

function showNewCanvasDialog(): void {
    const overlay = buildModalOverlay();
    const dialog = buildModalShell('New Canvas');
    const content = dialog.querySelector('.nr-dm__dialog-content')!;

    const form = document.createElement('div');
    form.className = 'nr-dm__dialog-form';

    const nameRow = buildModalRow('Name');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'nr-dm__dialog-input';
    nameInput.placeholder = 'e.g. Production DC';
    nameRow.appendChild(nameInput);
    form.appendChild(nameRow);

    const typeRow = buildModalRow('Type');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'nr-dm__dialog-input';
    for (const opt of ['Infra_Logical', 'Infra_Physical', 'App_Workload']) {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt.replace(/_/g, ' ');
        typeSelect.appendChild(el);
    }
    typeRow.appendChild(typeSelect);
    form.appendChild(typeRow);

    content.appendChild(form);

    const errEl = document.createElement('div');
    errEl.className = 'nr-dm__dialog-error';
    content.appendChild(errEl);

    const actions = document.createElement('div');
    actions.className = 'nr-dm__dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cds--btn cds--btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    actions.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'cds--btn cds--btn--primary';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { errEl.textContent = 'Name is required.'; return; }
        const canvasType = typeSelect.value as CanvasRecord['canvasType'];
        const rec = createCanvas(name, canvasType);
        overlay.remove();
        palette.refreshCanvasDropdown(rec.id);
        switchCanvas(rec.id);
    });
    actions.appendChild(createBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    nameInput.focus();
}

function showDeleteCanvasDialog(id: string): void {
    const canvases = listCanvases();
    const canvas = canvases.find(c => c.id === id);
    if (!canvas) return;
    if (canvases.length <= 1) {
        showToast('Cannot delete the last canvas.');
        return;
    }

    const overlay = buildModalOverlay();
    const dialog = buildModalShell('Delete Canvas', true);
    const content = dialog.querySelector('.nr-dm__dialog-content')!;

    const msg = document.createElement('p');
    msg.className = 'nr-dm__dialog-desc';
    msg.textContent = `Are you sure you want to delete "${canvas.name}"? This will permanently remove all elements on this canvas.`;
    content.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'nr-dm__dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cds--btn cds--btn--secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    actions.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'cds--btn cds--btn--danger';
    confirmBtn.textContent = 'Delete';
    confirmBtn.addEventListener('click', () => {
        overlay.remove();
        deleteCanvas(id);
        if (id === activeCanvasId) {
            const remaining = listCanvases();
            const nextId = remaining[0]?.id ?? '';
            switchCanvas(nextId);
        }
        palette.refreshCanvasDropdown(activeCanvasId);
    });
    actions.appendChild(confirmBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

// Area selection: Shift+Drag on blank canvas to rubber-band select multiple elements.
const areaSelect = new AreaSelect({
    paper,
    graph,
    canvasEl,
    resolveComponentBase,
    onSelectionChange: (cells) => {
        if (cells.length > 0) {
            paper.removeTools();
            currentCell = null;
            currentFrame = null;
            panel.hide();
            setTreeHighlight(null);
        }
    },
    onGroupMoveEnd: (cells) => {
        cells.forEach(cell => {
            if (!cell.isLink() && !cell.get('isFrame')) {
                updateZoneAssignment(cell as IsometricShape);
            }
        });
        if (currentView === View.Isometric) sortElements(graph);
    },
});

// When element-tree drag-drop targets a zone, tint the zone on the canvas
// with the same orange used by the canvas drag highlight.
palette.setZoneDropHighlightCallback((zoneId) => {
    // Clear previous
    if (dropTargetZone) {
        dropTargetZone.attr({
            body: { fill: ZONE_DEFAULT_FILL, stroke: ZONE_DEFAULT_STROKE },
            label: { fill: ZONE_DEFAULT_STROKE },
        });
        dropTargetZone = null;
    }
    if (!zoneId) return;
    const zone = graph.getCell(zoneId);
    if (!zone || !zone.get('isFrame')) return;
    (zone as Frame).attr({
        body: { fill: ZONE_DROP_FILL, stroke: ZONE_DROP_STROKE },
        label: { fill: ZONE_DROP_STROKE },
    });
    dropTargetZone = zone as Frame;
});

// Zone assignment helpers

/** Collects IDs of all cells recursively embedded within element (any depth). */
function getEmbeddedDeep(element: IsometricShape): Set<string> {
    const ids = new Set<string>();
    const visit = (el: dia.Element) => {
        for (const child of el.getEmbeddedCells()) {
            ids.add(String(child.id));
            if (!child.isLink()) visit(child as dia.Element);
        }
    };
    visit(element);
    return ids;
}

/**
 * Returns the innermost Frame whose bounding box contains the element's center,
 * excluding the element itself and any of its embedded descendants (prevents
 * circular embedding). "Innermost" means the smallest-area containing frame.
 */
function findTopmostContainingFrame(element: IsometricShape): Frame | null {
    const center = element.getBBox().center();
    const excludeIds = getEmbeddedDeep(element);
    const containing = graph.getElements()
        .filter(e =>
            e !== element &&
            !excludeIds.has(String(e.id)) &&
            e.get('isFrame') &&
            e.getBBox().containsPoint(center)
        ) as Frame[];
    if (containing.length === 0) return null;
    // Smallest area = innermost (most specific) zone
    containing.sort((a, b) => {
        const aBox = a.getBBox();
        const bBox = b.getBBox();
        return (aBox.width * aBox.height) - (bBox.width * bBox.height);
    });
    return containing[0];
}

/**
 * Called after an element is dropped. Embeds it into the topmost containing
 * frame, or unembeds it if it was moved out of its current zone.
 * Uses JointJS native embedding so the relationship persists in save/load
 * and children translate automatically when their parent zone moves.
 */
function updateZoneAssignment(element: IsometricShape): void {
    const newZone = findTopmostContainingFrame(element);
    const currentParent = element.getParentCell() as Frame | null;
    if (currentParent?.id === newZone?.id) return;
    if (currentParent) currentParent.unembed(element);
    if (newZone) newZone.embed(element);
}

// Show/Hide tools on cell pointer events

paper.on('link:pointerup', (linkView: dia.LinkView) => {
    areaSelect.clear();
    const link = linkView.model as Link;
    paper.removeTools();
    link.addTools(paper);
    currentCell = link;
    currentFrame = null;
    panel.showLink(link);
    setTreeHighlight(null);
});

// Zone-drop hint: while dragging an element across the canvas, temporarily
// tint the target zone's own fill + stroke to orange so the user sees which
// zone would receive the component. No extra highlighter mask — just the
// zone's native attrs are swapped and restored.
const ZONE_DEFAULT_FILL   = 'rgba(0, 114, 195, 0.08)';
const ZONE_DEFAULT_STROKE = '#0072c3';
const ZONE_DROP_FILL      = 'rgba(255, 131, 43, 0.15)';
const ZONE_DROP_STROKE    = '#ff832b';
let dropTargetZone: Frame | null = null;

function clearZoneDropHighlight(): void {
    if (!dropTargetZone) return;
    dropTargetZone.attr({
        body: { fill: ZONE_DEFAULT_FILL, stroke: ZONE_DEFAULT_STROKE },
        label: { fill: ZONE_DEFAULT_STROKE },
    });
    dropTargetZone = null;
}

paper.on('element:pointermove', (elementView: dia.ElementView) => {
    const model = elementView.model;
    if (model.get('isFrame') || model.get('componentRole') === 'child') return;

    const shape = resolveComponentBase(model) as IsometricShape;
    const targetZone = findTopmostContainingFrame(shape);

    if (targetZone?.id === dropTargetZone?.id) return;

    clearZoneDropHighlight();

    if (targetZone && targetZone.id !== shape.getParentCell()?.id) {
        targetZone.attr({
            body: { fill: ZONE_DROP_FILL, stroke: ZONE_DROP_STROKE },
            label: { fill: ZONE_DROP_STROKE },
        });
        dropTargetZone = targetZone;
    }
});

paper.on('element:pointerup', (elementView: dia.ElementView, evt: dia.Event) => {
    clearZoneDropHighlight();

    const resolved = resolveComponentBase(elementView.model);

    if (evt.shiftKey) {
        areaSelect.toggle(resolved);
        paper.removeTools();
        currentCell = null;
        currentFrame = null;
        panel.hide();
        setTreeHighlight(null);
        return;
    }

    if (areaSelect.hasSelection && areaSelect.isSelected(resolved)) return;
    areaSelect.clear();

    const model = elementView.model;
    paper.removeTools();
    if (model.get('isFrame')) {
        updateZoneAssignment(model as Frame);
        (model as Frame).addTools(paper, currentView);
        currentCell = null;
        currentFrame = model as Frame;
        panel.showZone(model);
        showZoneHud(model);
        setTreeHighlight(null);
        return;
    }
    // Click on a complex component's internal layer → act on the base instead.
    const shape = resolveComponentBase(model) as IsometricShape;
    updateZoneAssignment(shape);
    shape.addTools(paper, currentView, []);
    currentCell = shape;
    currentFrame = null;
    panel.show(shape);
    hideZoneHud();
    setTreeHighlight(shape);
});

paper.on('blank:pointerdown', (_evt: dia.Event) => {
    if (_evt.shiftKey) return;
    areaSelect.clear();
    paper.removeTools();
    currentCell = null;
    currentFrame = null;
    panel.hide();
    hideZoneHud();
    setTreeHighlight(null);
});

// ── Context menu ──────────────────────────────────────────────────────────────
// Right-click on an element opens a floating menu. Selection is reused from
// the pointerup handlers above so the panel/tools state stays consistent.
//
// Kill the browser's native context menu everywhere. Target-based filtering
// missed overlays rendered outside the canvas subtree. Registered on window
// AND document in capture phase so nothing inner can sneak past before the
// default is cancelled; also mirrored on the oncontextmenu handler as a
// belt-and-braces fallback for any edge case where a listener is cleared.
const suppressContextMenu = (evt: Event): boolean => {
    evt.preventDefault();
    return false;
};
window.addEventListener('contextmenu',   suppressContextMenu, true);
document.addEventListener('contextmenu', suppressContextMenu, true);
window.oncontextmenu   = suppressContextMenu;
document.oncontextmenu = suppressContextMenu;

const CTX_ICON_DELETE       = carbonIconToString(TrashCan16            as CarbonIcon);
const CTX_ICON_DUPLICATE   = carbonIconToString(Copy16                as CarbonIcon);
const CTX_ICON_FRONT       = carbonIconToString(BringToFront16        as CarbonIcon);
const CTX_ICON_BACK        = carbonIconToString(SendToBack16          as CarbonIcon);
const CTX_ICON_DISCONNECT  = carbonIconToString(ConnectionSignalOff16 as CarbonIcon);

interface CtxAction {
    label: string;
    icon:  string;
    run:   () => void;
}

let ctxMenuEl: HTMLDivElement | null = null;

function hideContextMenu(): void {
    if (!ctxMenuEl) return;
    ctxMenuEl.remove();
    ctxMenuEl = null;
}

function showContextMenu(clientX: number, clientY: number, actions: CtxAction[]): void {
    hideContextMenu();
    if (actions.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'nr-ctx-menu';
    menu.setAttribute('role', 'menu');

    for (const a of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-ctx-menu__item';
        btn.setAttribute('role', 'menuitem');

        const icon = document.createElement('span');
        icon.className = 'nr-ctx-menu__icon';
        icon.innerHTML = a.icon;

        const label = document.createElement('span');
        label.className = 'nr-ctx-menu__label';
        label.textContent = a.label;

        btn.appendChild(icon);
        btn.appendChild(label);
        btn.addEventListener('click', () => { hideContextMenu(); a.run(); });
        menu.appendChild(btn);
    }

    // Position before insertion is fine — position: fixed uses viewport coords.
    menu.style.left = clientX + 'px';
    menu.style.top  = clientY + 'px';
    document.body.appendChild(menu);

    // After layout, nudge back into viewport if the menu overflows the edge.
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right  > vw) menu.style.left = Math.max(0, vw - rect.width  - 4) + 'px';
    if (rect.bottom > vh) menu.style.top  = Math.max(0, vh - rect.height - 4) + 'px';

    ctxMenuEl = menu;
}

function buildActionsForCurrentSelection(): CtxAction[] {
    const actions: CtxAction[] = [];
    if (currentFrame) {
        // Zone-specific actions (rendering order) listed first so geometry-
        // affecting actions like Delete stay at the bottom.
        const frame = currentFrame;
        actions.push(
            { label: 'Move to Front', icon: CTX_ICON_FRONT,     run: () => frame.toFront() },
            { label: 'Move to Back',  icon: CTX_ICON_BACK,      run: () => frame.toBack()  },
            { label: 'Duplicate',     icon: CTX_ICON_DUPLICATE, run: () => duplicateZone(frame) },
            { label: 'Delete',        icon: CTX_ICON_DELETE,    run: () => { frame.remove(); } },
        );
    } else if (currentCell && !(currentCell instanceof Link)) {
        const cell = currentCell;
        actions.push(
            { label: 'Duplicate',          icon: CTX_ICON_DUPLICATE,  run: duplicateSelected },
            { label: 'Delete Connections', icon: CTX_ICON_DISCONNECT, run: () => {
                const links = graph.getConnectedLinks(cell);
                for (const link of links) link.remove();
            }},
            { label: 'Delete',             icon: CTX_ICON_DELETE,     run: deleteSelected    },
        );
    } else if (currentCell instanceof Link) {
        actions.push(
            { label: 'Delete', icon: CTX_ICON_DELETE, run: deleteSelected },
        );
    }
    return actions;
}

// Select on right-click (mirrors pointerup selection) so the menu always
// targets the element the user clicked, even if nothing was selected yet.
paper.on('element:contextmenu', (elementView: dia.ElementView, evt: dia.Event) => {
    evt.preventDefault();
    const model = elementView.model;
    paper.removeTools();
    if (model.get('isFrame')) {
        updateZoneAssignment(model as Frame);
        (model as Frame).addTools(paper, currentView);
        currentCell = null;
        currentFrame = model as Frame;
        panel.showZone(model);
        setTreeHighlight(null);
    } else {
        const shape = resolveComponentBase(model) as IsometricShape;
        updateZoneAssignment(shape);
        shape.addTools(paper, currentView, []);
        currentCell = shape;
        currentFrame = null;
        panel.show(shape);
        setTreeHighlight(shape);
    }
    showContextMenu(evt.clientX, evt.clientY, buildActionsForCurrentSelection());
});

paper.on('link:contextmenu', (linkView: dia.LinkView, evt: dia.Event) => {
    evt.preventDefault();
    const link = linkView.model as Link;
    paper.removeTools();
    link.addTools(paper);
    currentCell = link;
    currentFrame = null;
    panel.showLink(link);
    setTreeHighlight(null);
    showContextMenu(evt.clientX, evt.clientY, buildActionsForCurrentSelection());
});

paper.on('blank:contextmenu', (evt: dia.Event) => {
    evt.preventDefault();
    hideContextMenu();
});

// Dismiss on outside click, scroll, resize, Esc.
// Skip button=2 so a right-click that just opened the menu (via JointJS'
// paper mousedown handler, which fires before this document-level listener)
// doesn't immediately close it. Right-click dismissal is handled explicitly
// by blank:contextmenu.
document.addEventListener('mousedown', (evt: MouseEvent) => {
    if (!ctxMenuEl) return;
    if (evt.button === 2) return;
    if (evt.target instanceof Node && ctxMenuEl.contains(evt.target)) return;
    hideContextMenu();
});
document.addEventListener('keydown', (evt: KeyboardEvent) => {
    if (evt.key === 'Escape') hideContextMenu();
});
window.addEventListener('scroll', hideContextMenu, true);
window.addEventListener('resize', hideContextMenu);

// Setup scrolling

paper.el.style.cursor = 'grab';

paper.on('blank:pointerdown', (evt) => {
    if (evt.shiftKey) return;
    evt.data = {
        scrollX: window.scrollX, clientX: evt.clientX,
        scrollY: window.scrollY, clientY: evt.clientY,
        panning: true,
    };
    paper.el.style.cursor = 'grabbing';
});

paper.on('blank:pointermove', (evt) => {
    if (!evt.data?.panning) return;
    window.scroll(evt.data.scrollX + (evt.data.clientX - evt.clientX), evt.data.scrollY + (evt.data.clientY - evt.clientY));
});

paper.on('blank:pointerup', (evt) => {
    if (!evt.data?.panning) return;
    paper.el.style.cursor = 'grab';
});

// When the component designer saves defaults, update all matching instances
// already placed on this canvas. applyRegistryDefaults() is the single
// function that propagates every registry field — dimensions, label, colors,
// and icon — to each instance, keeping the system designer in sync.
document.addEventListener('nextrack:registry-changed', () => {
    graph.getElements().forEach(cell => {
        if (cell.get('isFrame')) return; // frames are user-controlled containers
        const meta = cell.get(META_KEY);
        if (!meta?.kind) return;
        const defaults = ShapeRegistry[meta.kind];
        if (!defaults) return;
        applyRegistryDefaults(cell, defaults, paper);
        if (currentView === View.Isometric) sortElements(graph);
    });
});

// Header menu actions — connected to existing system-designer functions.
// Unconnected actions (zoom, grid, validate, …) are dispatched but ignored here;
// they will be wired as those features are implemented.
document.addEventListener('nextrack:header-action', (e: Event) => {
    const { action } = (e as CustomEvent<{ action: string }>).detail;
    switch (action) {
        case 'file-new':
            showNewDesignModal();
            break;
        case 'file-save':
            saveGraph(graph);
            break;
        case 'file-open':
            loadGraph(graph, () => {
                paper.removeTools();
                currentCell = null;
                panel.hide();
                clearHistory();
                switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
            });
            break;
        case 'edit-undo':
            undo();
            break;
        case 'edit-redo':
            redo();
            break;
        case 'edit-delete':
            deleteSelected();
            break;
        case 'view-zoom-in':
            applyMenuZoom(1.25);
            break;
        case 'view-zoom-out':
            applyMenuZoom(1 / 1.25);
            break;
        case 'view-fit':
            currentZoom = 1;
            switchView(paper, currentView, currentCell, SIDEBAR_INSET, currentGridCountX);
            break;
        case 'view-center':
            centerGridInViewport(currentGridCountX, currentGridCountY);
            break;
        case 'view-toggle-grid':
            gridVisible = !gridVisible;
            if (gridVEl) gridVEl.node.style.display = gridVisible ? '' : 'none';
            break;
        case 'model-adjust-grid':
            showAdjustGridModal();
            break;
        case 'file-export-svg':
            exportCanvasSvg();
            break;
        case 'admin-set-default':
            saveCanvasGraph(activeCanvasId, graph);
            saveDefaultDesign(graph);
            showToast('Canvas saved.');
            break;
    }
});
