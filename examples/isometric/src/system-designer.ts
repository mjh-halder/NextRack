import { g, dia, V, highlighters, routers } from '@joint/core';
import Obstacles from './obstacles';
import IsometricShape, { View } from './shapes/isometric-shape';
import { Computer, Database, ActiveDirectory, User, Firewall, Switch, Router, Link, Frame, cellNamespace } from './shapes';
import { sortElements, drawGrid, switchView, transformationMatrix, applyRegistryDefaults, applyShapeStyle } from './utils';
import { GRID_SIZE, GRID_COUNT, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE, MIN_ZOOM, MAX_ZOOM } from './theme';
import { PropertyPanel, META_KEY, LINK_META_KEY, BADGE_POSITIONS, badgeChamferPath } from './inspector';
import { ShapeRegistry, ShapeDefinition } from './shapes/shape-registry';
import { getPreviewFactory } from './shapes/shape-factories';
import { ComponentPalette } from './palette';
import { saveGraph, loadGraph, saveDefaultDesign, loadDefaultDesign } from './persistence';
import {
    ensureExampleCanvas, listCanvases, createCanvas, deleteCanvas,
    getActiveCanvasId, setActiveCanvasId, saveCanvasGraph, loadCanvasGraph, CanvasRecord,
} from './canvas-store';
import { initUndoRedo, undo, redo, clearHistory } from './undo-redo';
import { initMinimap, updateMinimapView, scheduleMinimapUpdate } from './minimap';
import { initResourceBar, showResourceBar, hideResourceBar, showZoneHud, hideZoneHud, detectStretchClusters } from './resource-bar';
import { initAutoLayout, showLayoutBar, hideLayoutBar } from './auto-layout';
import { applyHover, clearHover, applySelect, clearSelect, clearSelectFor, applyConnHighlight, clearConnHighlights as clearConnRings, syncAllRings } from './hover-highlight';
import { initWorkloadTable, showWorkloadTable, hideWorkloadTable } from './workload-table';
import { getCanvas } from './canvas-store';
import { ViewToggle } from './view-toggle';
import { AreaSelect } from './area-select';
import { carbonIconToString, CarbonIcon } from './icons';
import { FrameCornerControl } from './tools';
import { LOADER_SVG, ensureLoaderStyles } from './loader';
ensureLoaderStyles();
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import BringToFront16 from '@carbon/icons/es/bring-to-front/16.js';
import SendToBack16 from '@carbon/icons/es/send-to-back/16.js';
import ConnectionSignalOff16 from '@carbon/icons/es/connection-signal--off/16.js';
import ConnectionSignal16 from '@carbon/icons/es/connection-signal/16.js';
import Rotate16 from '@carbon/icons/es/rotate/16.js';

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

function duplicateSingleElement(cell: IsometricShape, offset: number, idMap: Map<string, string>): { clone: IsometricShape; children: IsometricShape[] } {
    const clone = cell.clone() as IsometricShape;
    const { x, y } = cell.position();
    clone.position(x + offset, y + offset);
    clone.toggleView(currentView);
    idMap.set(cell.id as string, clone.id as string);

    const childLayers = cell.get('componentRole') === 'base'
        ? cell.getEmbeddedCells().filter(c => c.get('componentRole') === 'child') as IsometricShape[]
        : [];
    const children = childLayers.map(child => {
        const cc = child.clone() as IsometricShape;
        const { x: cx, y: cy } = child.position();
        cc.position(cx + offset, cy + offset);
        cc.toggleView(currentView);
        idMap.set(child.id as string, cc.id as string);
        return cc;
    });

    return { clone, children };
}

function duplicateWithLinks() {
    if (!currentCell || currentCell instanceof Link) return;
    graph.startBatch('duplicate');
    const offset = GRID_SIZE * 2;
    const idMap = new Map<string, string>();
    const { clone, children } = duplicateSingleElement(currentCell, offset, idMap);
    const origChildren = currentCell.get('componentRole') === 'base'
        ? currentCell.getEmbeddedCells().filter(c => c.get('componentRole') === 'child') as IsometricShape[]
        : [];

    const clonedLinks: dia.Link[] = [];
    const seen = new Set<string>();
    const allOrigIds = new Set([currentCell.id as string, ...origChildren.map(c => c.id as string)]);
    for (const el of [currentCell, ...origChildren]) {
        for (const link of graph.getConnectedLinks(el)) {
            const linkId = link.id as string;
            if (seen.has(linkId)) continue;
            seen.add(linkId);
            const srcId = (link.source() as { id?: string }).id;
            const tgtId = (link.target() as { id?: string }).id;
            if (!srcId || !tgtId) continue;
            const clonedLink = link.clone() as dia.Link;
            const newSrcId = allOrigIds.has(srcId) ? (idMap.get(srcId) ?? srcId) : srcId;
            const newTgtId = allOrigIds.has(tgtId) ? (idMap.get(tgtId) ?? tgtId) : tgtId;
            clonedLink.source({ ...link.source() as object, id: newSrcId } as dia.Link.EndJSON);
            clonedLink.target({ ...link.target() as object, id: newTgtId } as dia.Link.EndJSON);
            const verts = clonedLink.vertices();
            if (verts.length) {
                clonedLink.vertices(verts.map(v => ({ x: v.x + offset, y: v.y + offset })));
            }
            clonedLinks.push(clonedLink);
        }
    }

    graph.addCells([clone, ...children, ...clonedLinks]);
    for (const cc of children) clone.embed(cc);

    paper.removeTools();
    clone.addTools(paper, currentView, []);
    panel.show(clone);
    currentCell = clone;
    graph.stopBatch('duplicate');
    if (currentView === View.Isometric) sortElements(graph);
}

function duplicateSelected() {
    // Multi-select: duplicate all selected elements
    if (typeof areaSelect !== 'undefined' && areaSelect.hasSelection) {
        const cells = areaSelect.selection.filter(c => c instanceof IsometricShape && !c.get('isFrame')) as IsometricShape[];
        if (cells.length === 0) return;
        graph.startBatch('duplicate');
        const offset = GRID_SIZE * 2;
        const idMap = new Map<string, string>();
        const allOriginals: dia.Element[] = [];
        const allClones: dia.Cell[] = [];

        for (const cell of cells) {
            const { clone, children } = duplicateSingleElement(cell, offset, idMap);
            allOriginals.push(cell, ...cell.getEmbeddedCells().filter(c => c.get('componentRole') === 'child') as IsometricShape[]);
            allClones.push(clone, ...children);
            // Embed children after adding to graph (done below)
        }

        const clonedLinks = cloneConnectedLinks(allOriginals as IsometricShape[], idMap, offset);
        graph.addCells([...allClones, ...clonedLinks]);

        // Re-embed child layers
        for (const cell of cells) {
            const cloneId = idMap.get(cell.id as string);
            if (!cloneId) continue;
            const clone = graph.getCell(cloneId) as IsometricShape;
            const childLayers = cell.getEmbeddedCells().filter(c => c.get('componentRole') === 'child') as IsometricShape[];
            for (const child of childLayers) {
                const ccId = idMap.get(child.id as string);
                if (ccId) clone.embed(graph.getCell(ccId));
            }
        }

        areaSelect.clear();
        graph.stopBatch('duplicate');
        if (currentView === View.Isometric) sortElements(graph);
        return;
    }

    // Single-select: duplicate current cell
    if (!currentCell || currentCell instanceof Link) return;
    graph.startBatch('duplicate');
    const offset = GRID_SIZE * 2;
    const idMap = new Map<string, string>();
    const { clone, children } = duplicateSingleElement(currentCell, offset, idMap);
    const origChildren = currentCell.get('componentRole') === 'base'
        ? currentCell.getEmbeddedCells().filter(c => c.get('componentRole') === 'child') as IsometricShape[]
        : [];
    const clonedLinks = cloneConnectedLinks([currentCell, ...origChildren], idMap, offset);

    graph.addCells([clone, ...children, ...clonedLinks]);
    for (const cc of children) clone.embed(cc);

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
    const idMap = new Map<string, string>();
    const allCells: dia.Cell[] = [];
    const allOrigElements: IsometricShape[] = [];

    function cloneZoneRecursive(srcFrame: Frame, parentClone: Frame | null): Frame {
        const clonedFrame = srcFrame.clone() as Frame;
        const { x, y } = srcFrame.position();
        clonedFrame.position(x + offset, y + offset);
        idMap.set(srcFrame.id as string, clonedFrame.id as string);
        allCells.push(clonedFrame);

        const embedded = srcFrame.getEmbeddedCells();

        // Clone nested zones first (recursively)
        const childFrames = embedded.filter(c => c.get('isFrame')) as Frame[];
        for (const childFrame of childFrames) {
            cloneZoneRecursive(childFrame, clonedFrame);
        }

        // Clone elements (non-zone, non-link)
        const elements = embedded.filter(c => c instanceof IsometricShape && !c.get('isFrame')) as IsometricShape[];
        for (const el of elements) {
            const { clone, children } = duplicateSingleElement(el, offset, idMap);
            allCells.push(clone, ...children);
            allOrigElements.push(el);

            const childLayers = el.get('componentRole') === 'base'
                ? el.getEmbeddedCells().filter(c => c.get('componentRole') === 'child') as IsometricShape[]
                : [];
            allOrigElements.push(...childLayers);
        }

        return clonedFrame;
    }

    const rootClone = cloneZoneRecursive(frame, null);
    const clonedLinks = cloneConnectedLinks(allOrigElements, idMap, offset);
    graph.addCells([...allCells, ...clonedLinks]);

    // Re-establish parent-child embedding using the id map
    function reEmbed(srcFrame: Frame) {
        const clonedFrameId = idMap.get(srcFrame.id as string)!;
        const clonedFrame = graph.getCell(clonedFrameId) as Frame;
        clonedFrame.toggleView(currentView);

        for (const child of srcFrame.getEmbeddedCells()) {
            const clonedChildId = idMap.get(child.id as string);
            if (clonedChildId) {
                clonedFrame.embed(graph.getCell(clonedChildId));
            }
            if (child.get('isFrame')) {
                reEmbed(child as Frame);
            }
            // Re-embed component child layers
            if (child instanceof IsometricShape && child.get('componentRole') === 'base') {
                const baseCloneId = idMap.get(child.id as string);
                if (!baseCloneId) continue;
                const baseClone = graph.getCell(baseCloneId);
                for (const layerChild of child.getEmbeddedCells().filter(c => c.get('componentRole') === 'child')) {
                    const layerCloneId = idMap.get(layerChild.id as string);
                    if (layerCloneId) baseClone.embed(graph.getCell(layerCloneId));
                }
            }
        }
    }
    reEmbed(frame);

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

let syncZoomSlider: () => void = () => {};

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

const CONN_HIGHLIGHT_ID = 'connection-highlight';
const CONN_LINK_COLOR = '#ffffff';
let connHighlightedLinks: dia.Link[] = [];
let connHighlightedNodes: dia.Element[] = [];

function highlightConnections(cell: IsometricShape): void {
    clearConnectionHighlights();
    const links = graph.getConnectedLinks(cell);
    for (const link of links) {
        if (link.attr('./display') === 'none') continue;
        link.attr('line/stroke', CONN_LINK_COLOR);
        link.attr('line/strokeWidth', 2);
        connHighlightedLinks.push(link);

        const srcId = (link.source() as { id?: string }).id;
        const tgtId = (link.target() as { id?: string }).id;
        const neighborId = srcId === (cell.id as string) ? tgtId : srcId;
        if (neighborId) {
            const neighbor = graph.getCell(neighborId);
            if (neighbor && !neighbor.isLink()) {
                const view = paper.findViewByModel(neighbor);
                if (view) {
                    applyConnHighlight(view);
                    connHighlightedNodes.push(neighbor as dia.Element);
                }
            }
        }
    }
}

function clearConnectionHighlights(): void {
    const hadLinks = connHighlightedLinks.length > 0;
    connHighlightedLinks = [];
    if (hadLinks) styleClusterLinks();
    clearConnRings();
    connHighlightedNodes = [];
}

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
        // Frames and their embedded children move freely.
        if (element.get('isFrame')) {
            return (x: number, y: number) => ({ x: Math.max(0, x), y: Math.max(0, y) });
        }
        // Elements embedded in a frame bypass obstacle checks so they
        // translate correctly when their parent zone is dragged.
        if (element.getParentCell()?.get('isFrame')) {
            return (x: number, y: number) => ({ x: Math.max(0, x), y: Math.max(0, y) });
        }
        const isometricEl = element as IsometricShape;
        const { width, height } = isometricEl.size();
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
    validateConnection: (cellViewS, _magnetS, cellViewT, magnetT) => {
        if (!cellViewT) return false;
        const targetModel = cellViewT.model;
        const sourceModel = cellViewS?.model;
        // Zone-to-zone connections: allow linking frame bodies directly
        if (targetModel.get('isFrame') && sourceModel?.get('isFrame')) {
            return targetModel.id !== sourceModel.id;
        }
        // Normal element connections require a port magnet
        if (!magnetT) return false;
        const port = cellViewT.findAttribute('port', magnetT);
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

ensureExampleCanvas();
let activeCanvasId = getActiveCanvasId();
loadCanvasGraph(activeCanvasId, graph);


function toggleHideConnections(cell: IsometricShape): void {
    const hidden = !cell.get('hideConnections');
    cell.set('hideConnections', hidden);
    const links = graph.getConnectedLinks(cell);
    for (const link of links) {
        const srcId = (link.source() as { id?: string }).id;
        const tgtId = (link.target() as { id?: string }).id;
        const srcHidden = srcId ? !!graph.getCell(srcId)?.get('hideConnections') : false;
        const tgtHidden = tgtId ? !!graph.getCell(tgtId)?.get('hideConnections') : false;
        link.attr('./display', (srcHidden || tgtHidden) ? 'none' : null);
    }
}

function applyHideConnections(): void {
    for (const link of graph.getLinks()) {
        const srcId = (link.source() as { id?: string }).id;
        const tgtId = (link.target() as { id?: string }).id;
        const srcHidden = srcId ? !!graph.getCell(srcId)?.get('hideConnections') : false;
        const tgtHidden = tgtId ? !!graph.getCell(tgtId)?.get('hideConnections') : false;
        link.attr('./display', (srcHidden || tgtHidden) ? 'none' : null);
    }
}
applyHideConnections();

// Clean up selection when a cell is removed by any means (tool, keyboard, inspector)

graph.on('remove', (cell: dia.Cell) => {
    if (currentCell && currentCell.id === cell.id) {
        clearConnectionHighlights();
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
        if (currentFrame) {
            duplicateZone(currentFrame);
        } else {
            duplicateSelected();
        }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
});

// Sort cells on position and size change — debounced to avoid O(n²) work per
// pixel during drag. Fires once after the last change settles.
let sortTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSort() {
    if (currentView !== View.Isometric) return;
    if (sortTimer) clearTimeout(sortTimer);
    sortTimer = setTimeout(() => { sortTimer = null; sortElements(graph); }, 80);
}

graph.on('change:position change:size', debouncedSort);

// Zoom via mouse wheel (blank and cell areas)

function getMinZoom(): number {
    const baseMx = transformationMatrix(currentView, 20, SIDEBAR_INSET, currentGridCountX);
    const gw = currentGridCountX * GRID_SIZE;
    const gh = (currentGridCountY ?? currentGridCountX) * GRID_SIZE;
    const corners = [
        { x: baseMx.a * 0 + baseMx.c * 0, y: baseMx.b * 0 + baseMx.d * 0 },
        { x: baseMx.a * gw + baseMx.c * 0, y: baseMx.b * gw + baseMx.d * 0 },
        { x: baseMx.a * gw + baseMx.c * gh, y: baseMx.b * gw + baseMx.d * gh },
        { x: baseMx.a * 0 + baseMx.c * gh, y: baseMx.b * 0 + baseMx.d * gh },
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
    }
    const gridScreenW = maxX - minX + 100;
    const gridScreenH = maxY - minY + 100;
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const vpW = window.innerWidth - SIDEBAR_INSET;
    const vpH = window.innerHeight - headerH;
    if (vpW <= 0 || vpH <= 0 || gridScreenW <= 0 || gridScreenH <= 0) return MIN_ZOOM;
    return Math.max(MIN_ZOOM, Math.min(vpW / gridScreenW, vpH / gridScreenH));
}

function applyWheelZoom(evt: dia.Event, x: number, y: number, delta: number) {
    evt.preventDefault();
    const clampedDelta = Math.sign(delta) * Math.min(Math.abs(delta), 1);
    const pct = 0.04 + 0.06 * (1 - currentZoom / MAX_ZOOM);
    const step = clampedDelta > 0 ? (1 + pct) : 1 / (1 + pct);
    const minZoom = getMinZoom();
    const newZoom = Math.min(MAX_ZOOM, Math.max(minZoom, currentZoom * step));
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
    syncZoomSlider();
    scheduleMinimapUpdate();
}

// Zoom anchored to the centre of the usable viewport (header + sidebar excluded)
function applyMenuZoom(factor: number) {
    const minZoom = getMinZoom();
    const newZoom = Math.min(MAX_ZOOM, Math.max(minZoom, currentZoom * factor));
    if (newZoom === currentZoom) return;
    const zoomFactor = newZoom / currentZoom;
    currentZoom = newZoom;
    const mx = paper.matrix();
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const sx = window.scrollX + SIDEBAR_INSET + (window.innerWidth  - SIDEBAR_INSET) / 2;
    const sy = window.scrollY + headerH      + (window.innerHeight - headerH)       / 2;
    paper.matrix(
        V.createSVGMatrix()
            .translate(sx, sy)
            .scale(zoomFactor)
            .translate(-sx, -sy)
            .multiply(mx)
    );
    syncZoomSlider();
    scheduleMinimapUpdate();
}

// Clamp scroll so the grid never moves more than 200px outside the viewport
const SCROLL_PAD = 100;
function clampScroll(): void {
    const mx = paper.matrix();
    const gw = currentGridCountX * GRID_SIZE;
    const gh = currentGridCountY * GRID_SIZE;
    const corners = [
        { x: mx.a * 0 + mx.c * 0 + mx.e, y: mx.b * 0 + mx.d * 0 + mx.f },
        { x: mx.a * gw + mx.c * 0 + mx.e, y: mx.b * gw + mx.d * 0 + mx.f },
        { x: mx.a * gw + mx.c * gh + mx.e, y: mx.b * gw + mx.d * gh + mx.f },
        { x: mx.a * 0 + mx.c * gh + mx.e, y: mx.b * 0 + mx.d * gh + mx.f },
    ];
    let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
    for (const c of corners) {
        if (c.x < gMinX) gMinX = c.x;
        if (c.x > gMaxX) gMaxX = c.x;
        if (c.y < gMinY) gMinY = c.y;
        if (c.y > gMaxY) gMaxY = c.y;
    }

    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const vpLeft = window.scrollX + SIDEBAR_INSET;
    const vpTop = window.scrollY + headerH;
    const vpRight = window.scrollX + window.innerWidth;
    const vpBottom = window.scrollY + window.innerHeight;

    let dx = 0, dy = 0;
    if (gMaxX < vpLeft + SCROLL_PAD) dx = (vpLeft + SCROLL_PAD) - gMaxX;
    if (gMinX > vpRight - SCROLL_PAD) dx = (vpRight - SCROLL_PAD) - gMinX;
    if (gMaxY < vpTop + SCROLL_PAD) dy = (vpTop + SCROLL_PAD) - gMaxY;
    if (gMinY > vpBottom - SCROLL_PAD) dy = (vpBottom - SCROLL_PAD) - gMinY;

    if (dx !== 0 || dy !== 0) {
        window.scroll(window.scrollX - dx, window.scrollY - dy);
    }
}
window.addEventListener('scroll', clampScroll);

paper.on('blank:mousewheel', (evt: dia.Event, x: number, y: number, delta: number) => {
    applyWheelZoom(evt, x, y, delta);
});

paper.on('cell:mousewheel', (_cellView: dia.CellView, evt: dia.Event, x: number, y: number, delta: number) => {
    applyWheelZoom(evt, x, y, delta);
});

// Switch between isometric and 2D view

// ── Experimental: animated view transition ──────────────────────────────────
// Interpolates the paper matrix between 2D and isometric over ~300ms for a
// smooth "rotation" feel. Shape iso/2d groups are crossfaded via opacity.

const VIEW_TRANSITION_MS = 900;
let viewTransitionRaf = 0;

function lerpMatrix(a: DOMMatrix, b: DOMMatrix, t: number): SVGMatrix {
    const m = V.createSVGMatrix();
    m.a = a.a + (b.a - a.a) * t;
    m.b = a.b + (b.b - a.b) * t;
    m.c = a.c + (b.c - a.c) * t;
    m.d = a.d + (b.d - a.d) * t;
    m.e = a.e + (b.e - a.e) * t;
    m.f = a.f + (b.f - a.f) * t;
    return m;
}

function easeInOut(t: number): number {
    return t;
}

function animateViewSwitch(toView: View) {
    if (viewTransitionRaf) cancelAnimationFrame(viewTransitionRaf);

    // Capture what model-space point is currently at the viewport center
    const sm = paper.matrix();
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const vpCx = window.scrollX + SIDEBAR_INSET + (window.innerWidth - SIDEBAR_INSET) / 2;
    const vpCy = window.scrollY + headerH + (window.innerHeight - headerH) / 2;
    const det = sm.a * sm.d - sm.b * sm.c;
    const modelX = ( sm.d * (vpCx - sm.e) - sm.c * (vpCy - sm.f)) / det;
    const modelY = (-sm.b * (vpCx - sm.e) + sm.a * (vpCy - sm.f)) / det;

    // Adjust target matrix so the same model point stays at viewport center
    const startMatrix = sm;
    const endMatrix = transformationMatrix(toView, 20, SIDEBAR_INSET, currentGridCountX);
    const endPx = endMatrix.a * modelX + endMatrix.c * modelY + endMatrix.e;
    const endPy = endMatrix.b * modelX + endMatrix.d * modelY + endMatrix.f;
    endMatrix.e += vpCx - endPx;
    endMatrix.f += vpCy - endPy;

    paper.el.style.position = 'relative';

    const overlayEl = document.createElement('div');
    overlayEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;opacity:0;background:var(--cds-background,#fff);display:flex;align-items:center;justify-content:center;';

    const loaderWrap = document.createElement('div');
    loaderWrap.style.cssText = 'position:fixed;top:50%;left:calc(50% + 128px);transform:translate(-50%,-50%);opacity:0;color:var(--cds-text-secondary,#525252);';
    loaderWrap.innerHTML = LOADER_SVG;
    overlayEl.appendChild(loaderWrap);

    paper.el.appendChild(overlayEl);

    let swapped = false;
    const start = performance.now();

    function tick(now: number) {
        const elapsed = now - start;
        const raw = Math.min(elapsed / VIEW_TRANSITION_MS, 1);
        const t = easeInOut(raw);

        const m = lerpMatrix(startMatrix, endMatrix, t);

        // Gentle zoom dip, scaled around the viewport-center model point
        const dip = Math.sin(raw * Math.PI) * 0.08;
        if (dip > 0.001) {
            const s = 1 - dip;
            m.a *= s; m.b *= s; m.c *= s; m.d *= s;
            const px = m.a * modelX + m.c * modelY + m.e;
            const py = m.b * modelX + m.d * modelY + m.f;
            m.e += vpCx - px;
            m.f += vpCy - py;
        }

        paper.matrix(m);

        // Fog: quick in (0–40%), slow out (40–100%)
        let fog: number;
        if (raw < 0.4) {
            fog = raw / 0.4;
        } else {
            const out = (raw - 0.4) / 0.6;
            fog = 1 - out * out;
        }
        overlayEl.style.opacity = String(fog);
        const loaderOpacity = Math.max(0, fog - 0.5) * 2;
        loaderWrap.style.opacity = String(loaderOpacity);

        // Swap while fully faded out
        if (!swapped && raw >= 0.5) {
            swapped = true;
            graph.getElements().forEach((el: dia.Element) =>
                (el as IsometricShape).toggleView(toView));
        }

        if (raw < 1) {
            viewTransitionRaf = requestAnimationFrame(tick);
        } else {
            viewTransitionRaf = 0;
            overlayEl.remove();
            if (!swapped) {
                graph.getElements().forEach((el: dia.Element) =>
                    (el as IsometricShape).toggleView(toView));
            }
            if (toView === View.Isometric) sortElements(graph);
            if (currentCell) currentCell.addTools(paper, toView);
        }
    }
    viewTransitionRaf = requestAnimationFrame(tick);
}

new ViewToggle(viewToggleContainerEl, 'isometric', (view) => {
    currentView = view === 'isometric' ? View.Isometric : View.TwoDimensional;
    currentZoom = 1;
    paper.removeTools();
    animateViewSwitch(currentView);
    updateMinimapView(currentView, currentGridCountX);
    syncZoomSlider();
});

switchView(paper, currentView, currentCell, SIDEBAR_INSET, currentGridCountX);

// ---- Minimap ----

const minimapEl = document.getElementById('minimap') as HTMLDivElement;
initMinimap(minimapEl, graph, paper);

// ---- Element Table button ----
import { showElementTable } from './element-table';
(document.getElementById('element-table-btn') as HTMLButtonElement).addEventListener('click', () => showElementTable(graph));

// ---- Zoom slider ----

const zoomControlEl = document.getElementById('zoom-control') as HTMLDivElement;

const zoomOutBtn = document.createElement('button');
zoomOutBtn.type = 'button';
zoomOutBtn.className = 'nr-zoom-btn';
zoomOutBtn.setAttribute('aria-label', 'Zoom out');
zoomOutBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4 7h8v2H4z"/></svg>';
zoomOutBtn.addEventListener('click', () => { applyMenuZoom(1 / 1.25); syncZoomSlider(); });

const zoomSlider = document.createElement('input');
zoomSlider.type = 'range';
zoomSlider.className = 'nr-zoom-slider';
zoomSlider.min = String(Math.log(MIN_ZOOM));
zoomSlider.max = String(Math.log(MAX_ZOOM));
zoomSlider.step = '0.01';
zoomSlider.value = '0';
zoomSlider.setAttribute('aria-label', 'Zoom');
zoomSlider.addEventListener('input', () => {
    const target = Math.exp(parseFloat(zoomSlider.value));
    const factor = target / currentZoom;
    applyMenuZoom(factor);
    zoomLabel.textContent = Math.round(currentZoom * 100) + '%';
});

const zoomInBtn = document.createElement('button');
zoomInBtn.type = 'button';
zoomInBtn.className = 'nr-zoom-btn';
zoomInBtn.setAttribute('aria-label', 'Zoom in');
zoomInBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M11 7H9V4H7v3H4v2h3v3h2V9h3z"/></svg>';
zoomInBtn.addEventListener('click', () => { applyMenuZoom(1.25); syncZoomSlider(); });

const zoomLabel = document.createElement('span');
zoomLabel.className = 'nr-zoom-label';
zoomLabel.textContent = '100%';

zoomControlEl.className = 'nr-zoom-control';
zoomControlEl.appendChild(zoomOutBtn);
zoomControlEl.appendChild(zoomSlider);
zoomControlEl.appendChild(zoomInBtn);
zoomControlEl.appendChild(zoomLabel);

syncZoomSlider = () => {
    zoomSlider.value = String(Math.log(currentZoom));
    zoomLabel.textContent = Math.round(currentZoom * 100) + '%';
};

const workloadTableEl = document.getElementById('workload-table') as HTMLDivElement;
initWorkloadTable(workloadTableEl);

const resourceBarEl = document.getElementById('resource-bar') as HTMLDivElement;
initResourceBar(resourceBarEl, graph);

// ---- Stretch Cluster detection ----

let lastClusters: ReturnType<typeof detectStretchClusters> = [];

function refreshStretchClusters(): void {
    lastClusters = detectStretchClusters(graph);
    const clusterByZone = new Map<string, { label: string; color: string }>();

    for (let i = 0; i < lastClusters.length; i++) {
        const letter = String.fromCharCode(65 + (i % 26));
        const defaultLabel = `Stretch Cluster ${letter}`;
        const cluster = lastClusters[i];
        for (const zoneId of cluster.zoneIds) {
            const zone = graph.getCell(zoneId);
            const color = (zone?.get('zoneColor') as string) || '#0072c3';
            clusterByZone.set(zoneId, { label: defaultLabel, color });
        }
    }

    for (const el of graph.getElements()) {
        if (!el.get('isFrame')) continue;
        const info = clusterByZone.get(el.id as string);
        if (info) {
            const customName = el.get('clusterName') as string | undefined;
            const displayName = customName || info.label;
            el.attr('badge/text', displayName);
            el.attr('badge/fill', 'rgba(255,255,255,0.5)');
            el.attr('badgeBg/fill', info.color);
            el.attr('badgeGroup/display', null);
            el.set('stretchCluster', info.label);

            const badgePos = (el.get('badgeLabelPosition') as string) || 'top-right';
            const bp = BADGE_POSITIONS[badgePos];
            if (bp) {
                el.attr('badgeGroup/transform', bp.groupTransform);
            }
            el.attr('badgeBg/d', badgeChamferPath(badgePos));
        } else {
            el.attr('badge/text', '');
            el.attr('badgeGroup/display', 'none');
            el.unset('stretchCluster');
        }
    }
}

function getStretchClusterForZone(zoneId: string): ReturnType<typeof detectStretchClusters>[0] | null {
    for (const c of lastClusters) {
        if (c.zoneIds.indexOf(zoneId) >= 0) return c;
    }
    return null;
}

function styleClusterLinks(): void {
    for (const link of graph.getLinks()) {
        const meta = link.get(LINK_META_KEY) as Record<string, unknown> | undefined;
        const view = paper.findViewByModel(link);
        if (meta?.linkType === 'Cluster Link') {
            const srcId = (link.source() as { id?: string }).id;
            const src = srcId ? graph.getCell(srcId) : null;
            const color = (src?.get('zoneColor') as string) || '#0072c3';
            link.attr('line/stroke', color);
            link.attr('line/strokeWidth', 1.5);
            link.attr('line/strokeDasharray', '8 4');
            link.attr('line/targetMarker', { type: 'none' });
            if (view) {
                view.el.classList.add('nr-cluster-link');
                view.el.style.setProperty('--nr-cluster-color', color);
            }
        } else {
            link.attr('line/stroke', '#333333');
            link.attr('line/strokeWidth', 1);
            link.attr('line/strokeDasharray', null);
            link.attr('line/targetMarker', { type: 'path', d: 'M 3 -4 L -3 0 L 3 4 z', fill: 'context-stroke', stroke: 'context-stroke' });
            if (view) {
                view.el.classList.remove('nr-cluster-link');
                view.el.style.removeProperty('--nr-cluster-color');
            }
        }
    }
}

graph.on('add remove change:source change:target change:linkMeta', () => {
    refreshStretchClusters();
    styleClusterLinks();
});

paper.on('render:done', () => {
    styleClusterLinks();
});

// Auto-set link type when a new link's endpoints are both resolved.
graph.on('change:source change:target', (cell: dia.Cell) => {
    if (!cell.isLink()) return;
    const link = cell as dia.Link;
    const meta = link.get(LINK_META_KEY) as Record<string, unknown> | undefined;
    if (meta?.linkType) return;
    const srcId = (link.source() as { id?: string }).id;
    const tgtId = (link.target() as { id?: string }).id;
    if (!srcId || !tgtId) return;
    const src = graph.getCell(srcId);
    const tgt = graph.getCell(tgtId);
    const type = (src?.get('isFrame') && tgt?.get('isFrame')) ? 'Cluster Link' : 'Host Access';
    link.set(LINK_META_KEY, { ...(meta || {}), linkType: type });
});

const layoutBarEl = document.getElementById('layout-bar') as HTMLDivElement;
initAutoLayout(
    layoutBarEl,
    graph,
    () => currentView,
    () => currentFrame,
    () => (typeof areaSelect !== 'undefined' && areaSelect.hasSelection)
        ? areaSelect.selection.filter(c => !c.isLink()) as dia.Element[]
        : [],
    () => ({ w: currentGridCountX, h: currentGridCountY }),
);

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

async function exportCanvasSvg(): Promise<void> {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const mx = paper.matrix();
    const wrapper = document.createElementNS(ns, 'g');
    wrapper.setAttribute('transform',
        `matrix(${mx.a},${mx.b},${mx.c},${mx.d},0,0)`);

    // Collect all cell views in their actual DOM order (respects z-index)
    const cellsLayer = paper.el.querySelector('.joint-cells-layer');
    if (!cellsLayer) return;
    const orderedViews: SVGGElement[] = [];
    cellsLayer.querySelectorAll(':scope > [model-id]').forEach(el => {
        orderedViews.push(el as SVGGElement);
    });

    for (const liveEl of orderedViews) {
        const modelId = liveEl.getAttribute('model-id');
        if (!modelId) continue;
        const cell = graph.getCell(modelId);
        if (!cell) continue;

        const isLink = cell.isLink();

        // Skip hidden links
        if (isLink && liveEl.querySelector('[display="none"]')?.closest('[model-id]') === liveEl) {
            if (cell.attr('./display') === 'none') continue;
        }

        const clone = liveEl.cloneNode(true) as SVGGElement;

        if (isLink) {
            // Read the connection stroke from the LIVE DOM
            const liveConn = (liveEl.querySelector('[joint-selector="line"]') ?? liveEl.querySelector('.connection')) as SVGElement | null;
            const isDarkMode = document.documentElement.classList.contains('cds--g100');
            let linkStroke = '#333333';
            if (liveConn) {
                const cs = window.getComputedStyle(liveConn).stroke;
                const rgbMatch = cs.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (rgbMatch) {
                    const [, r, g, b] = rgbMatch;
                    linkStroke = '#' + [r, g, b].map(c => parseInt(c).toString(16).padStart(2, '0')).join('');
                } else {
                    linkStroke = cs;
                }
            } else if (isDarkMode) {
                linkStroke = '#8d8d8d';
            }

            // Remove invisible hit-area wrapper and tools
            clone.querySelectorAll('.connection-wrap, .joint-highlight-layer, [magnet="true"], .link-tools').forEach(e => e.remove());

            // Bake connection stroke color
            const connPath = (clone.querySelector('[joint-selector="line"]') ?? clone.querySelector('.connection')) as SVGElement | null;
            if (connPath) connPath.setAttribute('stroke', linkStroke);

            // Color ALL remaining non-connection, non-wrapper paths (= markers)
            clone.querySelectorAll('path').forEach(p => {
                if (p.classList.contains('connection') || p.getAttribute('joint-selector') === 'line') return;
                if (p.classList.contains('connection-wrap')) { p.remove(); return; }
                const strokeW = parseFloat(p.getAttribute('stroke-width') || '1');
                if (strokeW > 5) { p.remove(); return; }
                const d = p.getAttribute('d') ?? '';
                if (!d) { p.remove(); return; }
                for (const attr of ['fill', 'stroke']) {
                    const val = p.getAttribute(attr);
                    if (val !== 'none') {
                        p.setAttribute(attr, linkStroke);
                    }
                }
            });

            // Also check non-path marker elements (e.g. polygon, circle)
            clone.querySelectorAll('polygon, circle, rect, line').forEach(el => {
                if (el.closest('.connection-wrap')) return;
                for (const attr of ['fill', 'stroke']) {
                    const val = el.getAttribute(attr);
                    if (val === 'context-stroke' || val === 'context-fill') {
                        el.setAttribute(attr, linkStroke);
                    }
                }
            });
        } else {
            // Bake computed colors for elements
            const selectors = 'path, ellipse, rect, circle, polygon, line';
            const liveShapes = liveEl.querySelectorAll(selectors);
            const colors: Array<{ fill: string; stroke: string }> = [];
            liveShapes.forEach(e => {
                const cs = window.getComputedStyle(e);
                colors.push({ fill: cs.fill, stroke: cs.stroke });
            });
            const cloneShapes = clone.querySelectorAll(selectors);
            cloneShapes.forEach((e, i) => {
                if (!colors[i]) return;
                const { fill, stroke } = colors[i];
                if (fill && fill !== 'none') e.setAttribute('fill', fill);
                if (stroke && stroke !== 'none') e.setAttribute('stroke', stroke);
            });
            // Fix text labels: paint-order="stroke" isn't supported everywhere.
            // Split into two layers: stroke-only behind, fill-only on top.
            // Bake computed colors for dark/light mode.
            const liveTexts = liveEl.querySelectorAll('text');
            const textColors: Array<{ fill: string; stroke: string }> = [];
            liveTexts.forEach(t => {
                const cs = window.getComputedStyle(t);
                textColors.push({ fill: cs.fill, stroke: cs.stroke });
            });
            const cloneTexts = clone.querySelectorAll('text[paint-order]');
            let ti = 0;
            cloneTexts.forEach(txt => {
                const tc = textColors[ti++] || { fill: '#333', stroke: '#fff' };
                const bg = txt.cloneNode(true) as SVGTextElement;
                bg.removeAttribute('paint-order');
                bg.setAttribute('fill', 'none');
                bg.setAttribute('stroke', tc.stroke);
                const fg = txt.cloneNode(true) as SVGTextElement;
                fg.removeAttribute('paint-order');
                fg.setAttribute('stroke', 'none');
                fg.setAttribute('fill', tc.fill);
                txt.parentNode?.insertBefore(bg, txt);
                txt.parentNode?.insertBefore(fg, txt);
                txt.remove();
            });

            clone.querySelectorAll('.joint-port').forEach(e => e.remove());
            clone.querySelectorAll('[display="none"]').forEach(e => e.remove());
            clone.querySelectorAll('path').forEach(p => {
                const d = p.getAttribute('d') ?? '';
                if (!d || d === 'M 0 0') p.remove();
            });
            // Rasterize visible SVG icons to PNG for PowerPoint compatibility
            const images = Array.from(clone.querySelectorAll('image'));
            for (const img of images) {
                const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                const w = parseFloat(img.getAttribute('width') || '0');
                const h = parseFloat(img.getAttribute('height') || '0');
                if (!href || w === 0 || h === 0) { img.remove(); continue; }
                await inlineSvgImage(img as SVGImageElement, href);
            }
        }

        wrapper.appendChild(clone);
    }

    // Copy defs, resolving context-stroke in markers to #8d8d8d (dark) or #333 (light)
    const paperDefs = paper.el.querySelector('svg > defs');
    if (paperDefs && paperDefs.children.length > 0) {
        const defsCopy = paperDefs.cloneNode(true) as SVGDefsElement;
        const isDark = document.documentElement.classList.contains('cds--g100');
        const defaultLinkColor = isDark ? '#8d8d8d' : '#333333';
        defsCopy.querySelectorAll('*').forEach(el => {
            for (const attr of ['fill', 'stroke']) {
                const val = el.getAttribute(attr);
                if (val === 'context-stroke' || val === 'context-fill') {
                    el.setAttribute(attr, defaultLinkColor);
                }
            }
        });
        svg.appendChild(defsCopy);
    }

    svg.appendChild(wrapper);

    // Measure with all transforms applied
    svg.style.cssText = 'position:absolute;left:-9999px;top:-9999px;overflow:visible';
    svg.setAttribute('width', '8000');
    svg.setAttribute('height', '8000');
    document.body.appendChild(svg);
    const bbox = svg.getBBox();
    document.body.removeChild(svg);

    if (bbox.width === 0 || bbox.height === 0) return;

    const pad = 16;
    svg.setAttribute('viewBox',
        `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    svg.setAttribute('width', String(Math.ceil(bbox.width + pad * 2)));
    svg.setAttribute('height', String(Math.ceil(bbox.height + pad * 2)));
    svg.removeAttribute('style');

    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const docName = designNameEl.textContent?.trim() || 'design';
    const filename = docName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.svg';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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


function setTreeHighlight(cell: IsometricShape | null) {
    clearSelect();
    treeHighlightedCell = cell;
    if (cell) {
        const cellView = paper.findViewByModel(cell);
        if (cellView) applySelect(cellView);
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
    clearConnectionHighlights();
    paper.removeTools();
    cell.addTools(paper, currentView, []);
    currentCell = cell;
    panel.show(cell);
    setTreeHighlight(cell);
    highlightConnections(cell);
});

// Let the palette know which zone is selected so new components get embedded.
palette.setActiveZoneGetter(() => currentFrame);

// Right-click on element tree → open the same context menu as on the canvas.
palette.setTreeContextMenuCallback((cellId, clientX, clientY) => {
    const cell = graph.getCell(cellId);
    if (!cell) return;
    paper.removeTools();
    if (cell.get('isFrame')) {
        updateZoneAssignment(cell as Frame);
        (cell as Frame).addTools(paper, currentView);
        currentCell = null;
        currentFrame = cell as Frame;
        panel.showZone(cell as dia.Element);
        const cluster = getStretchClusterForZone(cell.id as string);
        showZoneHud(cell as dia.Element, cluster ? cluster.totals : undefined);
        setTreeHighlight(null);
    } else if (cell instanceof IsometricShape) {
        const shape = resolveComponentBase(cell) as IsometricShape;
        updateZoneAssignment(shape);
        shape.addTools(paper, currentView, []);
        currentCell = shape;
        currentFrame = null;
        panel.show(shape);
        setTreeHighlight(shape);
    }
    showContextMenu(clientX, clientY, buildActionsForCurrentSelection());
});

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
        hideLayoutBar();
        hideWorkloadTable();
        showWorkloadTable(id);
    } else {
        hideWorkloadTable();
        canvasEl.style.display = '';
        viewToggleContainerEl.style.display = '';
        minimapEl.style.display = '';
        showResourceBar();
        showLayoutBar();
        loadCanvasGraph(id, graph);
        applyHideConnections();
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
        paper.removeTools();
        currentCell = null;
        currentFrame = null;
        treeHighlightedCell = null;
        if (cells.length > 0) {
            palette.setTreeMultiSelection(cells.map(c => String(c.id)));
        } else {
            palette.setTreeSelection(null);
        }
        hideZoneHud();
        if (cells.length === 0) {
            panel.hide();
            return;
        }
        const zones = cells.filter(c => c.get('isFrame'));
        for (const zone of zones) {
            (zone as Frame).addTools(paper, currentView);
        }
        if (zones.length >= 2 && zones.length === cells.length) {
            panel.showMultiZone(zones as dia.Element[]);
        } else {
            panel.hide();
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

FrameCornerControl.getSiblingZones = (primary) => {
    if (!areaSelect.hasSelection) return [];
    const sel = areaSelect.selection;
    if (!sel.some(c => String(c.id) === String(primary.id))) return [];
    return sel.filter(c => c.get('isFrame') && String(c.id) !== String(primary.id)) as dia.Element[];
};

palette.setZoneDropHighlightCallback((zoneId) => {
    clearZoneDropHighlight();
    if (!zoneId) return;
    const zone = graph.getCell(zoneId);
    if (!zone || !zone.get('isFrame')) return;
    const view = paper.findViewByModel(zone);
    if (view) applyHover(view);
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
    clearConnectionHighlights();
    const link = linkView.model as Link;
    paper.removeTools();
    link.addTools(paper);
    currentCell = link;
    currentFrame = null;
    panel.showLink(link);
    setTreeHighlight(null);
});

let dropTargetZone: Frame | null = null;

function clearZoneDropHighlight(): void {
    if (!dropTargetZone) return;
    const view = paper.findViewByModel(dropTargetZone);
    if (view) clearHover();
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
        const view = paper.findViewByModel(targetZone);
        if (view) applyHover(view);
        dropTargetZone = targetZone;
    }
});

let isDragging = false;

paper.on('element:pointerdown', () => { isDragging = false; });
paper.on('element:pointermove', () => {
    if (!isDragging) { isDragging = true; clearHover(); }
    syncAllRings();
});

paper.on('element:mouseenter', (elementView: dia.ElementView) => {
    applyHover(elementView);
});

paper.on('element:mouseleave', () => {
    if (!isDragging) clearHover();
});

paper.on('element:pointerup', (elementView: dia.ElementView, evt: dia.Event) => {
    clearZoneDropHighlight();
    isDragging = false;

    const resolved = resolveComponentBase(elementView.model);

    if (evt.shiftKey) {
        areaSelect.toggle(resolved);
        currentCell = null;
        currentFrame = null;
        treeHighlightedCell = null;
        palette.setTreeSelection(null);
        clearConnectionHighlights();
        return;
    }

    if (areaSelect.hasSelection && areaSelect.isSelected(resolved)) return;
    areaSelect.clear();
    clearConnectionHighlights();

    const model = elementView.model;
    paper.removeTools();
    if (model.get('isFrame')) {
        updateZoneAssignment(model as Frame);
        (model as Frame).addTools(paper, currentView);
        currentCell = null;
        currentFrame = model as Frame;
        panel.showZone(model);
        const cluster = getStretchClusterForZone(model.id as string);
        showZoneHud(model, cluster ? cluster.totals : undefined);
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
    highlightConnections(shape);
});

paper.on('blank:pointerdown', (_evt: dia.Event) => {
    if (_evt.shiftKey) return;
    areaSelect.clear();
    clearHover();
    paper.removeTools();
    currentCell = null;
    currentFrame = null;
    panel.hide();
    hideZoneHud();
    setTreeHighlight(null);
    clearConnectionHighlights();
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
const CTX_ICON_CONNECT     = carbonIconToString(ConnectionSignal16    as CarbonIcon);
const CTX_ICON_ROTATE      = carbonIconToString(Rotate16              as CarbonIcon);

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

function switchShapeVariation(cell: IsometricShape): void {
    const meta = (cell.get(META_KEY) as Record<string, unknown>) ?? {};
    const shapeKey = (meta.shapeType as string) || '';
    const def = ShapeRegistry[shapeKey];
    if (!def?.hasVariations || !def.turned90) return;

    const current = (cell.get('shapeVariation') as string) || 'default';
    const target = current === 'default' ? 'turned90' : 'default';
    const targetDef = target === 'turned90' ? def.turned90 : def;

    const pos = cell.position();
    const parentZone = cell.getParentCell();

    graph.startBatch('switch-variation');

    const factory = getPreviewFactory(shapeKey, targetDef.baseShape ?? 'cuboid');
    const newShape = factory();
    applyRegistryDefaults(newShape, targetDef, paper);
    newShape.position(pos.x, pos.y);
    newShape.set(META_KEY, meta);
    newShape.set('shapeVariation', target);
    newShape.toggleView(currentView);

    const links = graph.getConnectedLinks(cell);
    for (const link of links) {
        const src = link.source() as { id?: string; port?: string };
        const tgt = link.target() as { id?: string; port?: string };
        if (src.id === (cell.id as string)) link.source({ ...src, id: newShape.id as string } as any);
        if (tgt.id === (cell.id as string)) link.target({ ...tgt, id: newShape.id as string } as any);
    }

    cell.remove();
    graph.addCell(newShape);
    if (parentZone) (parentZone as Frame).embed(newShape);

    paper.removeTools();
    newShape.addTools(paper, currentView, []);
    currentCell = newShape;
    panel.show(newShape);
    setTreeHighlight(newShape);

    graph.stopBatch('switch-variation');
    if (currentView === View.Isometric) sortElements(graph);
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
        const isHidden = !!cell.get('hideConnections');
        const meta = (cell.get(META_KEY) as Record<string, unknown>) ?? {};
        const shapeKey = (meta.shapeType as string) || '';
        const shapeDef = ShapeRegistry[shapeKey];
        if (shapeDef?.hasVariations && shapeDef.turned90) {
            const current = (cell.get('shapeVariation') as string) || 'default';
            const targetLabel = current === 'default' ? '90° Turned' : 'Default';
            actions.push(
                { label: `Switch to ${targetLabel}`, icon: CTX_ICON_ROTATE, run: () => switchShapeVariation(cell) },
            );
        }
        actions.push(
            { label: 'Duplicate',            icon: CTX_ICON_DUPLICATE, run: duplicateSelected },
            { label: 'Duplicate with Links', icon: CTX_ICON_DUPLICATE, run: duplicateWithLinks },
            { label: isHidden ? 'Show Connections' : 'Hide Connections',
              icon: isHidden ? CTX_ICON_CONNECT : CTX_ICON_DISCONNECT,
              run: () => toggleHideConnections(cell) },
            { label: 'Delete Connections',   icon: CTX_ICON_DISCONNECT, run: () => {
                const links = graph.getConnectedLinks(cell);
                for (const link of links) link.remove();
            }},
            { label: 'Delete',               icon: CTX_ICON_DELETE,     run: deleteSelected    },
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
        const ctxCluster = getStretchClusterForZone(model.id as string);
        showZoneHud(model, ctxCluster ? ctxCluster.totals : undefined);
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
            saveGraph(graph, currentGridCountX, currentGridCountY);
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
            syncZoomSlider();
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
