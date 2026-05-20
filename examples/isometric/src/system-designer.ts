import { g, dia, V, highlighters, routers } from '@joint/core';
import Obstacles from './obstacles';
import IsometricShape, { View, ToolKeys } from './shapes/isometric-shape';
import { Computer, Database, ActiveDirectory, User, Firewall, Switch, Router, Link, Frame, cellNamespace } from './shapes';
import { sortElements, drawGrid, switchView, transformationMatrix, applyRegistryDefaults, applyShapeStyle } from './utils';
import { GRID_SIZE, GRID_COUNT, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE, MIN_ZOOM, MAX_ZOOM } from './theme';
import { PropertyPanel, META_KEY, LINK_META_KEY, BADGE_POSITIONS, badgeChamferPath, NodeMeta } from './inspector';
import { ShapeRegistry, ShapeDefinition, BUILT_IN_SHAPE_IDS } from './shapes/shape-registry';
import { getPreviewFactory } from './shapes/shape-factories';
import { ComplexComponent } from './shapes/complex-component';
import { ComponentPalette } from './palette';
import { saveGraph, loadGraph, saveDefaultDesign, loadDefaultDesign } from './persistence';
import {
    ensureExampleCanvas, listCanvases, createCanvas, deleteCanvas,
    getActiveCanvasId, setActiveCanvasId, saveCanvasGraph, loadCanvasGraph, CanvasRecord,
} from './canvas-store';
import { initUndoRedo, undo, redo, clearHistory } from './undo-redo';
import { initMinimap, updateMinimapView, scheduleMinimapUpdate, setMinimapNavigateCallback } from './minimap';
import { initResourceBar, showResourceBar, hideResourceBar, showZoneHud, hideZoneHud, detectStretchClusters } from './resource-bar';
import { initAutoLayout, showLayoutBar, hideLayoutBar } from './auto-layout';
import { applyHover, clearHover, applySelect, clearSelect, clearSelectFor, refreshSelect, applyConnHighlight, clearConnHighlights as clearConnRings, syncAllRings } from './hover-highlight';
import { initWorkloadTable, showWorkloadTable, hideWorkloadTable } from './workload-table';
import { initCalloutLabels, syncCalloutLabel, refreshAllCallouts, removeCallout, setCalloutVisibility } from './callout-labels';
import { getCanvas } from './canvas-store';
import { ViewToggle } from './view-toggle';
import { AreaSelect } from './area-select';
import { carbonIconToString, CarbonIcon } from './icons';
import { FrameCornerControl } from './tools';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';
import BringToFront16 from '@carbon/icons/es/bring-to-front/16.js';
import SendToBack16 from '@carbon/icons/es/send-to-back/16.js';
import CenterSquare16 from '@carbon/icons/es/center--square/16.js';
import Unlink16 from '@carbon/icons/es/unlink/16.js';
import PaintBrush16 from '@carbon/icons/es/paint-brush/16.js';
import Paste16 from '@carbon/icons/es/paste/16.js';
import SelectWindow16 from '@carbon/icons/es/select--window/16.js';
import ConnectionSignalOff16 from '@carbon/icons/es/connection-signal--off/16.js';
import ConnectionSignal16 from '@carbon/icons/es/connection-signal/16.js';
import Rotate16 from '@carbon/icons/es/rotate/16.js';
import Edit16 from '@carbon/icons/es/edit/16.js';
import Unplug16 from '@carbon/icons/es/unplug/16.js';
import View16 from '@carbon/icons/es/view/16.js';
import ViewOff16 from '@carbon/icons/es/view--off/16.js';

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
let copiedLinkStyle: Record<string, unknown> | null = null;
const CONN_LINK_COLOR_LIGHT = '#8d8d8d';
const CONN_LINK_COLOR_DARK = '#ffffff';
function getConnLinkColor(): string {
    return document.documentElement.classList.contains('cds--g100') ? CONN_LINK_COLOR_DARK : CONN_LINK_COLOR_LIGHT;
}

// Re-color highlighted links when theme changes
new MutationObserver(() => {
    const color = getConnLinkColor();
    for (const { link } of connHighlightedLinks) {
        link.attr('line/stroke', color);
    }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
let connHighlightedLinks: Array<{ link: dia.Link; origStroke: string; origWidth: number }> = [];
let connHighlightedNodes: dia.Element[] = [];

function highlightConnections(cell: IsometricShape): void {
    clearConnectionHighlights();
    const links = graph.getConnectedLinks(cell);
    for (const link of links) {
        if (link.attr('./display') === 'none') continue;
        const origStroke = (link.attr('line/stroke') as string) || '#333333';
        const origWidth = (link.attr('line/strokeWidth') as number) || 1;
        link.attr('line/stroke', getConnLinkColor());
        link.attr('line/strokeWidth', 2);
        connHighlightedLinks.push({ link, origStroke, origWidth });

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
    for (const { link, origStroke, origWidth } of connHighlightedLinks) {
        link.attr('line/stroke', origStroke);
        link.attr('line/strokeWidth', origWidth);
    }
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
        // Frames, areas, labels and their embedded children move freely.
        if (element.get('isFrame') || element.get('isArea') || element.get('isGridLabel') || element.get('isIcon')) {
            return (x: number, y: number) => ({ x: Math.max(0, x), y: Math.max(0, y) });
        }
        // Elements embedded in a frame bypass obstacle checks so they
        // translate correctly when their parent zone is dragged.
        if (element.getParentCell()?.get('isFrame')) {
            return (x: number, y: number) => ({ x: Math.max(0, x), y: Math.max(0, y) });
        }
        const isometricEl = element as IsometricShape;
        const meta = element.get(META_KEY) as Record<string, unknown> | undefined;
        const sKey = (meta?.shapeType as string) || '';
        const sDef = sKey ? ShapeRegistry[sKey] : undefined;
        if (sDef?.dimYAdjustable) {
            return (x: number, y: number) => ({ x: Math.max(0, x), y: Math.max(0, y) });
        }
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
        args: { offset: 2 },
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
const CANVAS_PAD = 200;
paper.setDimensions(
    SIDEBAR_INSET + 2 * GRID_SIZE * GRID_COUNT * SCALE * ISOMETRIC_SCALE + CANVAS_PAD,
    GRID_SIZE * GRID_COUNT * SCALE + CANVAS_PAD
);

ensureExampleCanvas();
let activeCanvasId = getActiveCanvasId();
loadCanvasGraph(activeCanvasId, graph);
requestAnimationFrame(() => centerGridInViewport(currentGridCountX, currentGridCountY));

graph.on('reset', () => {
    requestAnimationFrame(() => {
        graph.getElements().forEach(el => syncCalloutLabel(el));
    });
});


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
    removeCallout(cell.id as string);
    const view = paper.findViewByModel(cell);
    if (view) clearSelectFor(view);
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

const SD_ROTATE_PAIR: Record<string, string> = { tube: 'pipe', pipe: 'tube', duct: 'channel', channel: 'duct' };

function applyIconAttrsToShape(shape: IsometricShape, href: string, iconPx: number, w: number, h: number, iH: number, face: string): void {
    let topIconAttrs: Record<string, unknown>;
    if (face === 'front') {
        const lx = (w - iconPx) / 2, ly = (iH - iconPx) / 2;
        const cx = lx + iconPx / 2, cy = ly + iconPx / 2;
        topIconAttrs = { href, x: lx, y: ly, width: iconPx, height: iconPx, transform: `matrix(1,0,-1,-1,0,${h}) rotate(180,${cx},${cy})` };
    } else if (face === 'side') {
        const lx = (h - iconPx) / 2, ly = (iH - iconPx) / 2;
        const cx = lx + iconPx / 2, cy = ly + iconPx / 2;
        topIconAttrs = { href, x: lx, y: ly, width: iconPx, height: iconPx, transform: `matrix(0,1,-1,-1,${w},0) rotate(180,${cx},${cy})` };
    } else {
        topIconAttrs = { href, x: -iH + (w - iconPx) / 2, y: -iH + (h - iconPx) / 2, width: iconPx, height: iconPx, transform: null };
    }
    const x2D = (w - iconPx) / 2, y2D = (h - iconPx) / 2;
    shape.attr({ topIcon: topIconAttrs, topIcon2D: { href, x: x2D, y: y2D, width: iconPx, height: iconPx } });
}

// Scale label font and height proportionally when width changes via drag.
let labelResizeFromDrag = false;
graph.on('change:size', (cell: dia.Cell) => {
    if (cell.get('isGridLabel')) {
        if (labelResizeFromDrag) return;
        const prev = cell.previous('size') as { width: number; height: number } | undefined;
        if (!prev || Math.abs((cell as dia.Element).size().width - prev.width) < 0.5) return;
        const ratio = (cell as dia.Element).size().width / prev.width;
        const curFont = (cell.get('labelFontSize') as number) || 14;
        const fontSize = Math.round(Math.max(8, curFont * ratio));
        const newHeight = Math.max(GRID_SIZE / 2, prev.height * ratio);
        labelResizeFromDrag = true;
        cell.set('labelFontSize', fontSize);
        cell.attr('label/font-size', fontSize);
        (cell as dia.Element).resize((cell as dia.Element).size().width, newHeight);
        refreshSelect(cell);
        labelResizeFromDrag = false;
    }
    if (cell.get('isIcon') && cell.get('iconStanding')) {
        const el = cell as dia.Element;
        const { width: w, height: h } = el.size();
        const cx = w / 2;
        const cy = h / 2;
        const ox = (el.get('iconOffsetX') as number) ?? 0.22;
        const oy = (el.get('iconOffsetY') as number) ?? -0.22;
        const tx = ox * h;
        const ty = oy * h;
        const face = (el.get('iconFace') as string) || 'front';
        if (face === 'side') {
            el.attr('iconImage/transform', `translate(${-tx},${-ty}) matrix(0,1,-1,-1,${w},0) rotate(180,${cx},${cy})`);
        } else {
            el.attr('iconImage/transform', `translate(${tx},${ty}) matrix(1,0,-1,-1,0,${h}) rotate(180,${cx},${cy})`);
        }
    }
});

// Auto-size grid labels when added or when text/font changes from inspector.
graph.on('add', (cell: dia.Cell) => {
    if (cell.isLink() && cell.get('lineColor')) {
        requestAnimationFrame(() => {
            const view = paper.findViewByModel(cell);
            if (view) view.el.classList.add('nr-link--custom');
        });
    }
    if (cell.get('isGridLabel')) {
        requestAnimationFrame(() => {
            const { GridLabel: GL } = require('./shapes/grid-label/grid-label');
            if (cell instanceof GL) (cell as any).autoSize(paper);
        });
    }
    if (cell.get('isIcon')) {
        const iconData = cell.get('iconData') as string | undefined;
        if (iconData) {
            cell.attr('iconFlat/href', iconData);
        }
    }
});
graph.on('change:lineColor', (cell: dia.Cell) => {
    const view = paper.findViewByModel(cell);
    if (view) view.el.classList.toggle('nr-link--custom', !!cell.get('lineColor'));
});
graph.on('change:attrs', (cell: dia.Cell) => {
    if (!cell.get('isGridLabel') || labelResizeFromDrag) return;
    requestAnimationFrame(() => {
        labelResizeFromDrag = true;
        const { GridLabel: GL } = require('./shapes/grid-label/grid-label');
        if (cell instanceof GL) (cell as any).autoSize(paper);
        labelResizeFromDrag = false;
        refreshSelect(cell);
    });
});

// Re-apply icon positioning after resize so icon stays centred on the new geometry.
graph.on('change:size', (cell: dia.Cell) => {
    const meta = cell.get(META_KEY) as Record<string, unknown> | undefined;
    const shapeKey = (meta?.shapeType as string) || '';
    const def = shapeKey ? ShapeRegistry[shapeKey] : undefined;
    const icon0 = def?.layers?.[0]?.icons?.[0];
    if (icon0?.href) {
        const shape = cell as IsometricShape;
        const { width: w, height: h } = shape.size();
        const iH = (shape.get('isometricHeight') as number) ?? 0;
        const face = (shape.get('effectiveIconFace') as string) || icon0.face || 'top';
        const iconPx = (icon0.size ?? 1.5) * GRID_SIZE;
        applyIconAttrsToShape(shape, icon0.href, iconPx, w, h, iH, face);
    }
    refreshSelect(cell);
    syncCalloutLabel(cell as dia.Element);
});

graph.on('change:position', (cell: dia.Cell) => {
    refreshSelect(cell);
    syncCalloutLabel(cell as dia.Element);

});

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
    refreshAllCallouts();

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
    refreshAllCallouts();

}

// Scroll is free — minimap and zoom handle navigation without clamping.

paper.on('blank:mousewheel', (evt: dia.Event, x: number, y: number, delta: number) => {
    applyWheelZoom(evt, x, y, delta);
});

paper.on('cell:mousewheel', (_cellView: dia.CellView, evt: dia.Event, x: number, y: number, delta: number) => {
    applyWheelZoom(evt, x, y, delta);
});

// Switch between isometric and 2D view

// View switch helper — used by the component designer's switchView import



new ViewToggle(viewToggleContainerEl, 'isometric', (view) => {
    currentView = view === 'isometric' ? View.Isometric : View.TwoDimensional;
    currentZoom = 1;
    paper.removeTools();
    // Instant view switch — no animation
    graph.getElements().forEach((el: dia.Element) =>
        (el as IsometricShape).toggleView(currentView));
    paper.matrix(transformationMatrix(currentView, 20, SIDEBAR_INSET, currentGridCountX));
    paper.el.classList.toggle('nr-2d-icons-only', currentView === View.TwoDimensional);
    if (currentView === View.Isometric) sortElements(graph);
    if (currentCell && !(currentCell instanceof Link)) {
        (currentCell as IsometricShape).addTools(paper, currentView);
    }
    updateMinimapView(currentView, currentGridCountX);
    syncZoomSlider();
    setCalloutVisibility(currentView === View.Isometric);
    // Re-add resize tools for the current selected shape after view switch
    if (currentCell && !(currentCell instanceof Link) && !currentCell.get('isFrame')) {
        const meta = currentCell.get(META_KEY) as Record<string, unknown> | undefined;
        const shapeKey = (meta?.shapeType as string) || '';
        const def = shapeKey ? ShapeRegistry[shapeKey] : undefined;
        if (def?.dimYAdjustable) {
            (currentCell as IsometricShape).addTools(paper, currentView, ['size']);
        }
    }
    requestAnimationFrame(() => fitToContent());
});

switchView(paper, currentView, currentCell, SIDEBAR_INSET, currentGridCountX);

// ---- Minimap ----

initCalloutLabels(canvasEl, paper);

const minimapEl = document.getElementById('minimap') as HTMLDivElement;
initMinimap(minimapEl, graph, paper);
setMinimapNavigateCallback(() => refreshAllCallouts());

updateMinimapView(currentView, currentGridCountX);

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

const fitBtn = document.createElement('button');
fitBtn.type = 'button';
fitBtn.className = 'nr-zoom-btn';
fitBtn.setAttribute('aria-label', 'Fit to screen');
fitBtn.innerHTML = carbonIconToString(CenterSquare16 as CarbonIcon).replace('width="16"', 'width="14"').replace('height="16"', 'height="14"');
fitBtn.addEventListener('click', () => {
    const elements = graph.getElements();
    if (elements.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
        const { x, y } = el.position();
        const { width, height } = el.size();
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + width > maxX) maxX = x + width;
        if (y + height > maxY) maxY = y + height;
    }
    const pad = GRID_SIZE * 2;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;

    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const vpW = window.innerWidth - SIDEBAR_INSET;
    const vpH = window.innerHeight - headerH;
    if (vpW <= 0 || vpH <= 0) return;

    const baseMx = transformationMatrix(currentView, 20, SIDEBAR_INSET, currentGridCountX);

    // Project bbox corners through the isometric transform (without offset)
    // to get the screen-space extent at zoom=1
    const corners = [
        { x: minX, y: minY }, { x: maxX, y: minY },
        { x: minX, y: maxY }, { x: maxX, y: maxY },
    ];
    let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
    for (const c of corners) {
        const sx = baseMx.a * c.x + baseMx.c * c.y;
        const sy = baseMx.b * c.x + baseMx.d * c.y;
        if (sx < sMinX) sMinX = sx;
        if (sy < sMinY) sMinY = sy;
        if (sx > sMaxX) sMaxX = sx;
        if (sy > sMaxY) sMaxY = sy;
    }
    const screenW = sMaxX - sMinX;
    const screenH = sMaxY - sMinY;
    if (screenW <= 0 || screenH <= 0) return;

    const fitZoom = Math.min(vpW / screenW, vpH / screenH);
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));
    currentZoom = clampedZoom;

    // Build matrix: translate content center to viewport center, at fit scale.
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const vpCx = SIDEBAR_INSET + vpW / 2;
    const vpCy = headerH + vpH / 2;

    // baseMx without translation (linear isometric transform only)
    const baseMxNoT = V.createSVGMatrix().translate(-baseMx.e, -baseMx.f).multiply(baseMx);

    const newMx = V.createSVGMatrix()
        .translate(vpCx, vpCy)
        .scale(clampedZoom)
        .multiply(baseMxNoT)
        .translate(-centerX, -centerY);

    paper.matrix(newMx);
    window.scrollTo(0, 0);
    syncZoomSlider();
    scheduleMinimapUpdate();
    refreshAllCallouts();
});

zoomControlEl.className = 'nr-zoom-control';
zoomControlEl.appendChild(zoomOutBtn);
zoomControlEl.appendChild(zoomSlider);
zoomControlEl.appendChild(zoomInBtn);
zoomControlEl.appendChild(zoomLabel);
zoomControlEl.appendChild(fitBtn);

syncZoomSlider = () => {
    const mx = paper.matrix();
    const actualScale = Math.sqrt(mx.a * mx.a + mx.b * mx.b);
    const baseMx = transformationMatrix(currentView, 20, SIDEBAR_INSET, currentGridCountX);
    const baseScale = Math.sqrt(baseMx.a * baseMx.a + baseMx.b * baseMx.b);
    if (baseScale > 0) currentZoom = actualScale / baseScale;
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
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const vpCenterX = SIDEBAR_INSET + (window.innerWidth - SIDEBAR_INSET) / 2;
    const vpCenterY = headerH + (window.innerHeight - headerH) / 2;
    const dx = vpCenterX - gridCenterX;
    const dy = vpCenterY - gridCenterY;
    paper.matrix(V.createSVGMatrix().translate(dx, dy).multiply(mx));
    refreshAllCallouts();

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
        SIDEBAR_INSET + 2 * GRID_SIZE * gridCount * SCALE * ISOMETRIC_SCALE + CANVAS_PAD,
        GRID_SIZE * gridCount * SCALE + CANVAS_PAD
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
        SIDEBAR_INSET + 2 * GRID_SIZE * newX * SCALE * ISOMETRIC_SCALE + CANVAS_PAD,
        GRID_SIZE * newY * SCALE + CANVAS_PAD
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

function screenCoordsOfModelPoint(mx: DOMMatrix, px: number, py: number): { sx: number; sy: number } {
    return { sx: mx.a * px + mx.c * py + mx.e, sy: mx.b * px + mx.d * py + mx.f };
}

function focusElement(el: dia.Element): void {
    switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
    const mx = paper.matrix();
    const bbox = el.getBBox();
    const c = screenCoordsOfModelPoint(mx, bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const vpCx = SIDEBAR_INSET + (window.innerWidth - SIDEBAR_INSET) / 2;
    const vpCy = headerH + (window.innerHeight - headerH) / 2;
    const dx = vpCx - c.sx;
    const dy = vpCy - c.sy;
    paper.matrix(V.createSVGMatrix()
        .translate(dx, dy)
        .multiply(mx));
    syncZoomSlider();
    scheduleMinimapUpdate();
}

export function fitToContent(): void {
    const elements = graph.getElements();
    if (elements.length === 0) return;
    switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
    const mx = paper.matrix();
    let minSx = Infinity, minSy = Infinity, maxSx = -Infinity, maxSy = -Infinity;
    for (const el of elements) {
        const bbox = el.getBBox();
        const corners = [
            { x: bbox.x, y: bbox.y },
            { x: bbox.x + bbox.width, y: bbox.y },
            { x: bbox.x, y: bbox.y + bbox.height },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
        ];
        for (const p of corners) {
            const s = screenCoordsOfModelPoint(mx, p.x, p.y);
            if (s.sx < minSx) minSx = s.sx;
            if (s.sy < minSy) minSy = s.sy;
            if (s.sx > maxSx) maxSx = s.sx;
            if (s.sy > maxSy) maxSy = s.sy;
        }
    }
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 0;
    const vpW = window.innerWidth - SIDEBAR_INSET;
    const vpH = window.innerHeight - headerH;
    const contentW = maxSx - minSx;
    const contentH = maxSy - minSy;
    if (contentW <= 0 || contentH <= 0) return;
    const pad = 1.3;
    const scale = Math.min(vpW / (contentW * pad), vpH / (contentH * pad), 1);
    const contentCx = (minSx + maxSx) / 2;
    const contentCy = (minSy + maxSy) / 2;
    const vpCx = SIDEBAR_INSET + vpW / 2;
    const vpCy = headerH + vpH / 2;
    paper.matrix(V.createSVGMatrix()
        .translate(vpCx, vpCy)
        .scale(scale)
        .translate(-contentCx, -contentCy)
        .multiply(mx));
    syncZoomSlider();
    scheduleMinimapUpdate();
}

const palette = new ComponentPalette(paletteEl, graph, () => currentView, (shape) => {
    paper.removeTools();
    clearSelect();

    if (shape.get('isArea') || shape.get('isGridLabel') || shape.get('isIcon')) {
        shape.addTools(paper, currentView);
        currentCell = shape;
        currentFrame = null;
        if (shape.get('isGridLabel')) {
            panel.showLabel(shape);
        } else if (shape.get('isIcon')) {
            panel.showIcon(shape);
        } else panel.showArea(shape);
        setTreeHighlight(shape);
        const view = paper.findViewByModel(shape);
        if (view) requestAnimationFrame(() => applySelect(view));
    } else if (shape.get('isFrame')) {
        shape.addTools(paper, currentView);
        currentCell = null;
        currentFrame = shape as Frame;
        panel.showZone(shape);
        const view = paper.findViewByModel(shape);
        if (view) requestAnimationFrame(() => applySelect(view));
    } else {
        shape.addTools(paper, currentView, []);
        currentCell = shape;
        panel.show(shape);
        setTreeHighlight(shape);
        const view = paper.findViewByModel(shape);
        if (view) applySelect(view);
    }
    if (currentView === View.Isometric) {
        sortElements(graph);
    }
}, (cellId: string) => {
    // Tree item clicked — select the element on the canvas
    const cell = graph.getCell(cellId);
    if (!cell || !(cell instanceof IsometricShape)) return;
    clearConnectionHighlights();
    clearSelect();
    paper.removeTools();

    if (cell.get('isFrame')) {
        const frame = cell as Frame;
        frame.addTools(paper, currentView);
        currentCell = null;
        currentFrame = frame;
        panel.showZone(frame);
        const cluster = getStretchClusterForZone(frame.id as string);
        showZoneHud(frame, cluster ? cluster.totals : undefined);
        palette.setTreeSelection(String(frame.id));
        const view = paper.findViewByModel(frame);
        if (view) requestAnimationFrame(() => applySelect(view));
        hideLayoutBar();
        focusElement(frame);
    } else {
        cell.addTools(paper, currentView, []);
        currentCell = cell;
        panel.show(cell);
        setTreeHighlight(cell);
        highlightConnections(cell);
        hideLayoutBar();
        focusElement(cell);
    }
});

// Provide viewport center in model space so new components appear in view.
palette.setViewportCenterCallback(() => {
    const mx = paper.matrix();
    const inv = V.createSVGMatrix().multiply(mx).inverse();
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 40;
    const cx = window.scrollX + SIDEBAR_INSET + (window.innerWidth - SIDEBAR_INSET) / 2;
    const cy = window.scrollY + headerH + (window.innerHeight - headerH) / 2;
    return { x: inv.a * cx + inv.c * cy + inv.e, y: inv.b * cx + inv.d * cy + inv.f };
});

// Drag-and-drop from component palette into the canvas
let dragHighlightedZone: Frame | null = null;

function findZoneAtPoint(modelX: number, modelY: number): Frame | null {
    const frames = graph.getElements().filter(el => el.get('isFrame')) as Frame[];
    // Prefer the smallest (most specific) zone
    let best: Frame | null = null;
    let bestArea = Infinity;
    for (const f of frames) {
        const { x, y } = f.position();
        const { width: fw, height: fh } = f.size();
        if (modelX >= x && modelX <= x + fw && modelY >= y && modelY <= y + fh) {
            const area = fw * fh;
            if (area < bestArea) { best = f; bestArea = area; }
        }
    }
    return best;
}

function clientToModel(clientX: number, clientY: number): { x: number; y: number } {
    const mx = paper.matrix();
    const inv = V.createSVGMatrix().multiply(mx).inverse();
    const px = clientX + window.scrollX;
    const py = clientY + window.scrollY;
    return { x: inv.a * px + inv.c * py + inv.e, y: inv.b * px + inv.d * py + inv.f };
}

function highlightDropZone(zone: Frame | null): void {
    if (dragHighlightedZone === zone) return;
    if (dragHighlightedZone) {
        const view = paper.findViewByModel(dragHighlightedZone);
        if (view) view.el.classList.remove('nr-drop-target');
    }
    dragHighlightedZone = zone;
    if (zone) {
        const view = paper.findViewByModel(zone);
        if (view) view.el.classList.add('nr-drop-target');
    }
}

const canvasDropTarget = document.getElementById('canvas')!;

canvasDropTarget.addEventListener('dragover', (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('application/x-nextrack-shape')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const model = clientToModel(e.clientX, e.clientY);
    highlightDropZone(findZoneAtPoint(model.x, model.y));
});

canvasDropTarget.addEventListener('dragleave', () => {
    highlightDropZone(null);
});

document.addEventListener('dragend', () => { highlightDropZone(null); });

canvasDropTarget.addEventListener('drop', (e: DragEvent) => {
    const shapeId = e.dataTransfer?.getData('application/x-nextrack-shape');
    if (!shapeId) return;
    e.preventDefault();
    highlightDropZone(null);

    const def = ShapeRegistry[shapeId];
    if (!def) return;

    const { x: modelX, y: modelY } = clientToModel(e.clientX, e.clientY);
    const dropZone = findZoneAtPoint(modelX, modelY);
    const meta: NodeMeta = { name: '', shapeType: shapeId, serverId: '', notes: '' };

    let placed: IsometricShape;
    const baseLayer = def.layers?.[0];
    if ((def.layers?.length ?? 0) > 1 && baseLayer) {
        const { ComplexComponent } = require('./shapes/complex-component');
        const haSize = def.hitAreaSize ?? { width: baseLayer.width, height: baseLayer.height };
        const cc = new ComplexComponent();
        cc.resize(haSize.width, haSize.height);
        cc.set('isometricHeight', baseLayer.depth);
        cc.set('defaultIsometricHeight', baseLayer.depth);
        cc.set('defaultSize', haSize);
        cc.set('layers', def.layers!.map((l: any) => ({ ...l, style: { ...l.style } })));
        cc.position(modelX - haSize.width / 2, modelY - haSize.height / 2);
        cc.set(META_KEY, meta);
        if (def.displayName) cc.attr('label/text', def.displayName);
        applyRegistryDefaults(cc, def, paper);
        cc.toggleView(currentView);
        graph.addCell(cc);
        placed = cc;
    } else {
        const baseShape = baseLayer?.baseShape ?? 'cuboid';
        const factory = getPreviewFactory(shapeId, baseShape);
        const shape = factory();
        applyRegistryDefaults(shape, def, paper);
        const { width, height } = shape.size();
        shape.position(modelX - width / 2, modelY - height / 2);
        shape.set(META_KEY, meta);
        shape.set('currentBaseShape', baseShape);
        shape.toggleView(currentView);
        graph.addCell(shape);
        placed = shape;
    }

    if (dropZone) dropZone.embed(placed);

    if (currentView === View.Isometric) sortElements(graph);
    palette.refresh();
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
        hideLayoutBar();
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
        if (cells.length >= 2) showLayoutBar();
        else hideLayoutBar();
        hideZoneHud();
        if (cells.length === 0) {
            panel.hide();
            return;
        }
        const zones = cells.filter(c => c.get('isFrame'));
        for (const zone of zones) {
            (zone as Frame).addTools(paper, currentView);
        }
        if (zones.length > 0) {
            requestAnimationFrame(() => {
                paper.el.querySelectorAll<SVGElement>('.joint-tools [joint-selector="handle"]').forEach(h => {
                    h.style.opacity = '1';
                });
            });
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

// ── Link port dots (green circles at connected ports) ────────────────────────

const LINK_DOT_COLOR = '#C6F08F';
const LINK_DOT_R = 3;
let linkPortDots: SVGElement[] = [];

function showLinkPortDots(linkView: dia.LinkView): void {
    const ns = 'http://www.w3.org/2000/svg';
    const link = linkView.model;
    const sourcePoint = linkView.getEndAnchor('source');
    const targetPoint = linkView.getEndAnchor('target');
    const layer = paper.getLayerNode(dia.Paper.Layers.FRONT);

    for (const pt of [sourcePoint, targetPoint]) {
        if (!pt) continue;
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', String(pt.x));
        dot.setAttribute('cy', String(pt.y));
        dot.setAttribute('r', String(LINK_DOT_R));
        dot.setAttribute('fill', LINK_DOT_COLOR);
        dot.setAttribute('stroke', '#6f6f6f');
        dot.setAttribute('stroke-width', '0.5');
        dot.setAttribute('pointer-events', 'none');
        layer.appendChild(dot);
        linkPortDots.push(dot);
    }
}

function clearLinkPortDots(): void {
    for (const dot of linkPortDots) {
        dot.parentNode?.removeChild(dot);
    }
    linkPortDots = [];
}

// Show/Hide tools on cell pointer events

paper.on('link:pointerdown', (linkView: dia.LinkView, evt: dia.Event) => {
    const isShift = !!(evt.shiftKey || (evt as any).originalEvent?.shiftKey);
    if (isShift) {
        evt.stopPropagation();
        const link = linkView.model as Link;
        // If a single link was selected via normal click, promote to multi-select
        if (currentCell instanceof Link && !areaSelect.isSelected(currentCell)) {
            areaSelect.toggle(currentCell);
        }
        areaSelect.toggle(link);
        currentCell = null;
        currentFrame = null;
        clearConnectionHighlights();
        paper.removeTools();
        panel.hide();
        // Refresh port dots for all selected links
        clearLinkPortDots();
        for (const cell of areaSelect.selection) {
            if (cell.isLink()) {
                const lv = paper.findViewByModel(cell) as dia.LinkView | null;
                if (lv) showLinkPortDots(lv);
            }
        }
    }
});

paper.on('link:pointerup', (linkView: dia.LinkView) => {
    const link = linkView.model as Link;
    // Skip if shift-select already handled in pointerdown
    if (areaSelect.isSelected(link)) return;

    areaSelect.clear();
    clearConnectionHighlights();
    clearLinkPortDots();
    paper.removeTools();
    link.addTools(paper);
    currentCell = link;
    currentFrame = null;
    panel.showLink(link);
    setTreeHighlight(null);
    showLinkPortDots(linkView);
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
    if (!isDragging) { isDragging = true; clearHover(); clearLinkPortDots(); }
    syncAllRings();
});

paper.on('element:mouseenter', (elementView: dia.ElementView) => {
    applyHover(elementView);
    paper.el.querySelectorAll('.joint-tools').forEach(el => el.classList.add('nr-tools--hover'));
});

paper.on('element:mouseleave', () => {
    if (!isDragging) clearHover();
    paper.el.querySelectorAll('.nr-tools--hover').forEach(el => el.classList.remove('nr-tools--hover'));
});

paper.on('element:pointerup', (elementView: dia.ElementView, evt: dia.Event) => {
    clearZoneDropHighlight();
    clearLinkPortDots();
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
        clearSelect();

        const zoneView = paper.findViewByModel(model);
        if (zoneView) requestAnimationFrame(() => applySelect(zoneView));
        hideLayoutBar();
        return;
    }
    if (model.get('isArea')) {
        (model as IsometricShape).addTools(paper, currentView);
        currentCell = model as IsometricShape;
        currentFrame = null;
        panel.showArea(model);
        setTreeHighlight(null);
        clearSelect();
        const areaView = paper.findViewByModel(model);
        if (areaView) requestAnimationFrame(() => applySelect(areaView));
        hideLayoutBar();
        hideZoneHud();
        return;
    }
    if (model.get('isGridLabel')) {
        (model as IsometricShape).addTools(paper, currentView);
        currentCell = model as IsometricShape;
        currentFrame = null;
        panel.showLabel(model);
        setTreeHighlight(null);
        clearSelect();


        const labelView = paper.findViewByModel(model);
        if (labelView) requestAnimationFrame(() => applySelect(labelView));
        hideLayoutBar();
        hideZoneHud();
        return;
    }
    if (model.get('isIcon')) {
        (model as IsometricShape).addTools(paper, currentView);
        currentCell = model as IsometricShape;
        currentFrame = null;
        panel.showIcon(model);
        setTreeHighlight(null);
        clearSelect();
        const iconView = paper.findViewByModel(model);
        if (iconView) requestAnimationFrame(() => applySelect(iconView));
        hideLayoutBar();
        hideZoneHud();
        return;
    }
    // Click on a complex component's internal layer → act on the base instead.
    const shape = resolveComponentBase(model) as IsometricShape;
    updateZoneAssignment(shape);
    const shapeMeta = shape.get(META_KEY) as Record<string, unknown> | undefined;
    const shapeKey = (shapeMeta?.shapeType as string) || '';
    const shapeDef = shapeKey ? ShapeRegistry[shapeKey] : undefined;
    const sizeTools: ToolKeys[] = shapeDef?.dimYAdjustable ? ['size'] : [];
    shape.addTools(paper, currentView, sizeTools);
    currentCell = shape;
    currentFrame = null;
    panel.show(shape);
    hideLayoutBar();
    hideZoneHud();
    setTreeHighlight(shape);
    highlightConnections(shape);
});

paper.on('blank:pointerdown', (_evt: dia.Event) => {
    if (_evt.shiftKey) return;
    areaSelect.clear();
    clearHover();
    paper.removeTools();
    clearLinkPortDots();
    currentCell = null;
    currentFrame = null;
    panel.hide();
    hideLayoutBar();
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
const CTX_ICON_UNPLUG      = carbonIconToString(Unplug16              as CarbonIcon);
const CTX_ICON_VIEW        = carbonIconToString(View16                as CarbonIcon);
const CTX_ICON_VIEW_OFF    = carbonIconToString(ViewOff16             as CarbonIcon);
const CTX_ICON_ROTATE      = carbonIconToString(Rotate16              as CarbonIcon);
const CTX_ICON_EDIT        = carbonIconToString(Edit16                as CarbonIcon);
const CTX_ICON_UNLINK      = carbonIconToString(Unlink16              as CarbonIcon);
const CTX_ICON_COPY_STYLE  = carbonIconToString(PaintBrush16          as CarbonIcon);
const CTX_ICON_PASTE_STYLE = carbonIconToString(Paste16               as CarbonIcon);
const CTX_ICON_SELECT      = carbonIconToString(SelectWindow16        as CarbonIcon);
const CTX_ICON_SELECT_LINK = carbonIconToString(ConnectionSignal16    as CarbonIcon);

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

function rotateShapeInGrid(cell: IsometricShape): void {
    const meta = (cell.get(META_KEY) as Record<string, unknown>) ?? {};
    const shapeKey = (meta.shapeType as string) || '';
    const def = ShapeRegistry[shapeKey];
    if (!def) return;
    // Use the actual current base shape on the canvas, not the registry default
    const defBaseShape = def.layers?.[0]?.baseShape;
    const currentBase = (cell.get('currentBaseShape') as string) || defBaseShape || 'cuboid';
    const pairedBase = SD_ROTATE_PAIR[currentBase];
    if (!pairedBase) return;

    const { width, height } = cell.size();
    const pos = cell.position();
    const parentZone = cell.getParentCell();

    graph.startBatch('rotate-shape');

    const factory = getPreviewFactory(shapeKey, pairedBase);
    const newShape = factory();
    // Swap width↔height for the rotated extrusion axis
    newShape.resize(height, width);
    newShape.set('isometricHeight', cell.get('isometricHeight'));
    newShape.set('defaultIsometricHeight', cell.get('defaultIsometricHeight'));
    newShape.set('defaultSize', { width: height, height: width });
    newShape.position(pos.x, pos.y);
    newShape.set(META_KEY, meta);
    newShape.set('currentBaseShape', pairedBase);
    newShape.toggleView(currentView);
    // Swap icon face based on current effective face
    const defIcon0 = def.layers?.[0]?.icons?.[0];
    const currentFace = (cell.get('effectiveIconFace') as string) || defIcon0?.face || 'top';
    let rotatedFace: string = currentFace;
    if (currentFace === 'front') rotatedFace = 'side';
    else if (currentFace === 'side') rotatedFace = 'front';
    // Construct a rotated definition: swap layer width/height and update icon face
    const rotDef: ShapeDefinition = {
        ...def,
        layers: def.layers?.map((l, i) => i === 0
            ? { ...l, baseShape: pairedBase as any, width: height, height: width,
                icons: l.icons.map((e, j) => j === 0 ? { ...e, face: rotatedFace as 'top' | 'front' | 'side' } : { ...e }) }
            : { ...l, style: { ...l.style }, icons: l.icons.map(e => ({ ...e })) }
        ) ?? [],
    };
    applyRegistryDefaults(newShape, rotDef, paper);

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
    const newDef = ShapeRegistry[shapeKey];
    const sizeTools: ToolKeys[] = newDef?.dimYAdjustable ? ['size'] : [];
    newShape.addTools(paper, currentView, sizeTools);
    currentCell = newShape;
    panel.show(newShape);
    setTreeHighlight(newShape);

    graph.stopBatch('rotate-shape');
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

    let newShape: IsometricShape;
    const targetBaseLayer = targetDef.layers?.[0];
    if ((targetDef.layers?.length ?? 0) > 1 && targetBaseLayer) {
        const haSize2 = targetDef.hitAreaSize ?? { width: targetBaseLayer.width, height: targetBaseLayer.height };
        const cc = new ComplexComponent();
        cc.resize(haSize2.width, haSize2.height);
        cc.set('isometricHeight', targetBaseLayer.depth);
        cc.set('defaultIsometricHeight', targetBaseLayer.depth);
        cc.set('defaultSize', haSize2);
        cc.set('layers', targetDef.layers!.map(l => ({ ...l, style: { ...l.style } })));
        if (targetDef.displayName) cc.attr('label/text', targetDef.displayName);
        if (targetDef.defaultRotation) cc.set('shapeRotation', targetDef.defaultRotation);
        newShape = cc;
    } else {
        const factory = getPreviewFactory(shapeKey, targetBaseLayer?.baseShape ?? 'cuboid');
        newShape = factory();
        applyRegistryDefaults(newShape, targetDef, paper);
    }
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
    } else if (currentCell && currentCell.get('isArea')) {
        const cell = currentCell as dia.Element;
        actions.push(
            { label: 'Rotate', icon: CTX_ICON_ROTATE, run: () => {
                const { applyRotation } = require('./tools/rotate-tool');
                const cur = (cell.get('labelRotation') as number) || 0;
                applyRotation(cell, cur === 270 ? 0 : 270);
            }},
            { label: 'Move to Front', icon: CTX_ICON_FRONT,     run: () => cell.toFront() },
            { label: 'Move to Back',  icon: CTX_ICON_BACK,      run: () => cell.toBack()  },
            { label: 'Duplicate', icon: CTX_ICON_DUPLICATE, run: duplicateSelected },
            { label: 'Delete',    icon: CTX_ICON_DELETE,    run: deleteSelected },
        );
    } else if (currentCell && currentCell.get('isGridLabel')) {
        const labelEl = currentCell as dia.Element;
        actions.push(
            { label: 'Rotate', icon: CTX_ICON_ROTATE, run: () => {
                const cur = (labelEl.get('labelRotation') as number) || 0;
                const next = cur === 270 ? 0 : 270;
                const { applyRotation } = require('./tools/rotate-tool');
                applyRotation(labelEl, next);
                panel.showLabel(labelEl);
            }},
            { label: 'Duplicate', icon: CTX_ICON_DUPLICATE, run: duplicateSelected },
            { label: 'Delete',    icon: CTX_ICON_DELETE,    run: deleteSelected },
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
        if (shapeDef && SD_ROTATE_PAIR[shapeDef.layers?.[0]?.baseShape ?? '']) {
            actions.push(
                { label: 'Rotate', icon: CTX_ICON_ROTATE, run: () => rotateShapeInGrid(cell) },
            );
        }
        if (shapeKey && !BUILT_IN_SHAPE_IDS.has(shapeKey)) {
            actions.push(
                { label: 'Edit Component', icon: CTX_ICON_EDIT, run: () => {
                    document.dispatchEvent(new CustomEvent('nextrack:navigate-to-shape', { detail: { shapeId: shapeKey } }));
                }},
            );
        }
        actions.push(
            { label: 'Duplicate',            icon: CTX_ICON_DUPLICATE, run: duplicateSelected },
            { label: 'Duplicate with Links', icon: CTX_ICON_DUPLICATE, run: duplicateWithLinks },
            { label: isHidden ? 'Show Connections' : 'Hide Connections',
              icon: isHidden ? CTX_ICON_VIEW : CTX_ICON_VIEW_OFF,
              run: () => toggleHideConnections(cell) },
            { label: 'Delete Connections',   icon: CTX_ICON_UNPLUG, run: () => {
                const links = graph.getConnectedLinks(cell);
                for (const link of links) link.remove();
            }},
            { label: 'Delete',               icon: CTX_ICON_DELETE,     run: deleteSelected    },
        );
    } else if (currentCell instanceof Link) {
        const link = currentCell;
        const verts = link.vertices();
        if (verts && verts.length > 0) {
            actions.push(
                { label: 'Delete Waypoints', icon: CTX_ICON_UNLINK, run: () => { link.vertices([]); } },
            );
        }
        actions.push(
            { label: 'Copy Style', icon: CTX_ICON_COPY_STYLE, run: () => {
                copiedLinkStyle = {
                    lineColor: link.get('lineColor'),
                    lineThickness: link.get('lineThickness'),
                    lineStyle: link.get('lineStyle'),
                    lineOpacity: link.get('lineOpacity'),
                    arrowType: link.get('arrowType'),
                    sourceArrowType: link.get('sourceArrowType'),
                    customRouter: link.get('customRouter'),
                    customConnector: link.get('customConnector'),
                    lineAttrs: link.attr('line') as Record<string, unknown>,
                };
            }},
        );
        if (copiedLinkStyle) {
            actions.push(
                { label: 'Paste Style', icon: CTX_ICON_PASTE_STYLE, run: () => {
                    if (!copiedLinkStyle) return;
                    const s = copiedLinkStyle;
                    // Collect all links to paste to: current + any selected
                    const targets: dia.Link[] = [link];
                    for (const cell of areaSelect.selection) {
                        if (cell.isLink() && cell !== link) targets.push(cell as dia.Link);
                    }
                    for (const target of targets) {
                        for (const key of ['lineColor', 'lineThickness', 'lineStyle', 'lineOpacity', 'arrowType', 'sourceArrowType', 'customRouter', 'customConnector'] as const) {
                            if (s[key] !== undefined) target.set(key as string, s[key]);
                        }
                        if (s.lineAttrs) target.attr({ line: s.lineAttrs as Record<string, unknown> });
                        if (s.customRouter && s.customRouter !== 'default') {
                            target.set('router', { name: s.customRouter });
                        } else {
                            target.unset('router');
                        }
                        if (s.customConnector && s.customConnector !== 'default') {
                            const args: Record<string, unknown> = {};
                            if (s.customConnector === 'rounded') args.radius = 8;
                            if (s.customConnector === 'jumpover') { args.size = 6; args.jump = 'arc'; }
                            target.set('connector', { name: s.customConnector, args });
                        } else {
                            target.unset('connector');
                        }
                    }
                    panel.showLink(link);
                }},
            );
        }
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
        clearSelect();
        const ctxZoneView = paper.findViewByModel(model);
        if (ctxZoneView) requestAnimationFrame(() => applySelect(ctxZoneView));
    } else if (model.get('isArea')) {
        (model as IsometricShape).addTools(paper, currentView);
        currentCell = model as IsometricShape;
        currentFrame = null;
        panel.showArea(model);
    } else if (model.get('isGridLabel')) {
        (model as IsometricShape).addTools(paper, currentView);
        currentCell = model as IsometricShape;
        currentFrame = null;
        panel.showLabel(model);


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
    const actions: CtxAction[] = [];
    const elements = graph.getElements();
    const links = graph.getLinks();
    if (elements.length > 0) {
        actions.push({ label: 'Select All Components', icon: CTX_ICON_SELECT, run: () => {
            areaSelect.clear();
            for (const el of elements) {
                if (!el.get('isFrame') && el.get('componentRole') !== 'child') {
                    areaSelect.toggle(el);
                }
            }
        }});
    }
    if (links.length > 0) {
        actions.push({ label: 'Select All Links', icon: CTX_ICON_SELECT_LINK, run: () => {
            areaSelect.clear();
            for (const lnk of links) {
                areaSelect.toggle(lnk);
            }
            clearLinkPortDots();
            for (const lnk of links) {
                const lv = paper.findViewByModel(lnk) as dia.LinkView | null;
                if (lv) showLinkPortDots(lv);
            }
        }});
    }
    if (actions.length > 0) {
        showContextMenu(evt.clientX, evt.clientY, actions);
    }
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
    const mx = paper.matrix();
    evt.data = {
        tx: mx.e, ty: mx.f,
        clientX: evt.clientX, clientY: evt.clientY,
        panning: true,
    };
    paper.el.style.cursor = 'grabbing';
});

paper.on('blank:pointermove', (evt) => {
    if (!evt.data?.panning) return;
    const dx = evt.clientX - evt.data.clientX;
    const dy = evt.clientY - evt.data.clientY;
    const mx = paper.matrix();
    paper.matrix(V.createSVGMatrix().translate(dx + evt.data.tx - mx.e, dy + evt.data.ty - mx.f).multiply(mx));
    scheduleMinimapUpdate();
    refreshAllCallouts();

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

document.addEventListener('nextrack:focus-cluster', ((e: CustomEvent<{ clusterId: string }>) => {
    const clusterId = e.detail.clusterId;
    requestAnimationFrame(() => {
        const cell = graph.getCell(clusterId);
        if (!cell || !cell.get('isFrame')) return;

        const frame = cell as Frame;
        clearConnectionHighlights();
        clearSelect();
        paper.removeTools();
        frame.addTools(paper, currentView);
        currentCell = null;
        currentFrame = frame;
        panel.showZone(frame);
        palette.setTreeSelection(String(frame.id));

        const view = paper.findViewByModel(frame);
        if (view) applySelect(view);

        focusElement(frame);
    });
}) as EventListener);
