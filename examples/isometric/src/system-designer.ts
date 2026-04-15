import { g, dia, V, highlighters } from '@joint/core';
import Obstacles from './obstacles';
import IsometricShape, { View } from './shapes/isometric-shape';
import { Computer, Database, ActiveDirectory, User, Firewall, Switch, Router, Link, Frame, cellNamespace } from './shapes';
import { sortElements, drawGrid, switchView, applyRegistryDefaults } from './utils';
import { GRID_SIZE, GRID_COUNT, HIGHLIGHT_COLOR, SCALE, ISOMETRIC_SCALE, MIN_ZOOM, MAX_ZOOM } from './theme';
import { PropertyPanel, META_KEY } from './inspector';
import { ShapeRegistry } from './shapes/shape-registry';
import { ComponentPalette } from './palette';
import { saveGraph, loadGraph, saveDefaultDesign, loadDefaultDesign } from './persistence';
import { ViewToggle } from './view-toggle';

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
    currentCell.remove();
    // currentCell and panel are cleaned up by the graph 'remove' listener below
}

function duplicateSelected() {
    if (!currentCell || currentCell instanceof Link) return;
    const clone = currentCell.clone() as IsometricShape;
    const { x, y } = currentCell.position();
    clone.position(x + GRID_SIZE * 2, y + GRID_SIZE * 2);
    clone.toggleView(currentView);
    graph.addCell(clone);
    paper.removeTools();
    clone.addTools(paper, currentView, ['connect']);
    panel.show(clone);
    currentCell = clone;
    if (currentView === View.Isometric) sortElements(graph);
}

function duplicateZone(frame: Frame): void {
    const offset = GRID_SIZE * 4;
    const clonedFrame = frame.clone() as Frame;
    const { x, y } = frame.position();
    clonedFrame.position(x + offset, y + offset);

    const embeddedElements = frame.getEmbeddedCells()
        .filter(c => c instanceof IsometricShape && !c.get('isFrame')) as IsometricShape[];

    const clonedChildren = embeddedElements.map(child => {
        const clone = child.clone() as IsometricShape;
        const { x: cx, y: cy } = child.position();
        clone.position(cx + offset, cy + offset);
        clone.toggleView(currentView);
        return clone;
    });

    graph.addCells([clonedFrame, ...clonedChildren]);
    clonedFrame.toggleView(currentView);
    for (const child of clonedChildren) {
        clonedFrame.embed(child);
    }
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
const TREE_HIGHLIGHT_COLOR = '#0f62fe';

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

const graph = new dia.Graph({}, { cellNamespace });

// Obstacles listen to changes in the graph and update their internal state
const obstacles = new Obstacles(graph);
graph.set('obstacles', obstacles);

const paper = new dia.Paper({
    el: canvasEl,
    model: graph,
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
        name: 'boundary',
        args: {
            offset: GRID_SIZE / 2,
            // It's important to set selector to false, and determine the magnet
            // with `magnet-selector` attribute on the element.
            // Otherwise, the element bounding box would contain the isometric part of the element
            // and the connection would be created to the wrong point.
            selector: false
        }
    },
    defaultRouter: {
        name: 'manhattan',
        args: {
            step: GRID_SIZE / 2,
            startDirections: ['top', 'bottom', 'left', 'right'],
            endDirections:   ['top', 'bottom', 'left', 'right'],
            // Use the existing obstacle detection to determine if the point is an obstacle
            // By default, the router would need to build its own obstacles map
            isPointObstacle: (point: g.Point) => {
                const x = Math.floor(point.x / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
                const y = Math.floor(point.y / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
                const rect = new g.Rect(x, y, GRID_SIZE * 3, GRID_SIZE * 2);
                return !obstacles.isFree(rect);
            }
        }
    },
    defaultLink: () => new Link(),
    linkPinning: false,
    overflow: true,
    snapLinks: { radius: GRID_SIZE / 2 },
    cellViewNamespace: cellNamespace,
    defaultAnchor: { name: 'modelCenter' },
    highlighting: {
        default: {
            name: 'mask',
            options: {
                layer: dia.Paper.Layers.BACK,
                attrs: {
                    'stroke': HIGHLIGHT_COLOR,
                    'stroke-width': 3
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

// Load default design if one has been saved, otherwise start with an empty canvas.
loadDefaultDesign(graph);

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
        deleteSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
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
    currentZoom = 1; // reset zoom on view switch — matrices are incompatible across views
    switchView(paper, currentView, currentCell, SIDEBAR_INSET, currentGridCountX);
});

switchView(paper, currentView, currentCell, SIDEBAR_INSET, currentGridCountX);

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
    // Rebuild the obstacle grid at the new size (graph is empty so this just resets it)
    obstacles.update();

    if (gridVEl) gridVEl.remove();
    gridVEl = drawGrid(paper, gridCount, GRID_SIZE);

    paper.setDimensions(
        SIDEBAR_INSET + 2 * GRID_SIZE * gridCount * SCALE * ISOMETRIC_SCALE + CANVAS_H_PAD,
        GRID_SIZE * gridCount * SCALE + CANVAS_V_PAD
    );

    // Set view matrix first, then scroll to center the grid in the usable area
    switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
    centerGridInViewport(currentGridCountX, currentGridCountY);

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
    shape.addTools(paper, currentView, ['connect']);
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
    cell.addTools(paper, currentView, ['connect']);
    currentCell = cell;
    panel.show(cell);
    setTreeHighlight(cell);
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
    const link = linkView.model as Link;
    paper.removeTools();
    link.addTools(paper);
    currentCell = link;
    currentFrame = null;
    panel.showLink(link);
    setTreeHighlight(null);
});

paper.on('element:pointerup', (elementView: dia.ElementView) => {
    const model = elementView.model;
    paper.removeTools();
    if (model.get('isFrame')) {
        updateZoneAssignment(model as Frame);
        (model as Frame).addTools(paper, currentView);
        currentCell = null;
        currentFrame = model as Frame;
        panel.showZone(model);
        setTreeHighlight(null);
        return;
    }
    const shape = model as IsometricShape;
    updateZoneAssignment(shape);
    shape.addTools(paper, currentView, ['connect']);
    currentCell = shape;
    currentFrame = null;
    panel.show(shape);
    setTreeHighlight(shape);
});

paper.on('blank:pointerdown', () => {
    paper.removeTools();
    currentCell = null;
    currentFrame = null;
    panel.hide();
    setTreeHighlight(null);
});

// Setup scrolling

paper.el.style.cursor = 'grab';

paper.on('blank:pointerdown', (evt) => {
    evt.data = {
        scrollX: window.scrollX, clientX: evt.clientX,
        scrollY: window.scrollY, clientY: evt.clientY
    };
    paper.el.style.cursor = 'grabbing';
});

paper.on('blank:pointermove', (evt) => {
    window.scroll(evt.data.scrollX + (evt.data.clientX - evt.clientX), evt.data.scrollY + (evt.data.clientY - evt.clientY));
});

paper.on('blank:pointerup', () => {
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
                switchView(paper, currentView, null, SIDEBAR_INSET, currentGridCountX);
            });
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
        case 'admin-set-default':
            saveDefaultDesign(graph);
            showToast('Default design saved.');
            break;
    }
});
