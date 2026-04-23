import { dia } from '@joint/core';
import { Computer, ComplexComponent, cellNamespace } from './shapes';
import IsometricShape, { View } from './shapes/isometric-shape';
import { drawGrid, switchView, applyRegistryDefaults } from './utils';
import { getDataType } from './schema-registry';
import { ShapeRegistry } from './shapes/shape-registry';
import { listApps, getApp, saveApp, createApp, deleteApp, AppDefinition } from './app-store';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Add16 from '@carbon/icons/es/add/16.js';
import { GRID_SIZE, SCALE, ISOMETRIC_SCALE } from './theme';

const ICON_TRASH = carbonIconToString(TrashCan16 as CarbonIcon);
const ICON_ADD   = carbonIconToString(Add16 as CarbonIcon);

// Canvas constants — same approach as Component Designer
const AD_GRID_COUNT = 8;
const AD_MARGIN     = 20;
const SIDEBAR_INSET = 0;

// DOM refs
const canvasEl    = document.getElementById('ad-canvas')      as HTMLDivElement;
const paletteEl   = document.getElementById('ad-palette')     as HTMLDivElement;
const inspectorEl = document.getElementById('ad-inspector')   as HTMLDivElement;

// Canvas
const graph = new dia.Graph({}, { cellNamespace });
graph.set('obstacles', { isFree: () => true });

const paper = new dia.Paper({
    el: canvasEl,
    model: graph,
    interactive: false,
    gridSize: GRID_SIZE,
    async: true,
    autoFreeze: true,
    overflow: true,
    cellViewNamespace: cellNamespace,
});

drawGrid(paper, AD_GRID_COUNT, GRID_SIZE);
paper.setDimensions(
    SIDEBAR_INSET + 2 * GRID_SIZE * AD_GRID_COUNT * SCALE * ISOMETRIC_SCALE + AD_MARGIN * 2,
    GRID_SIZE * AD_GRID_COUNT * SCALE + AD_MARGIN * 2
);
switchView(paper, View.Isometric, null, SIDEBAR_INSET, AD_GRID_COUNT);

// State
let selectedAppId: string | null = null;

export function initAppDesigner(_container: HTMLDivElement): void {
    renderPalette();
    renderInspector();
}

// ---- Preview shape ----

function findAppShapeKey(): string | null {
    for (const [id, def] of Object.entries(ShapeRegistry)) {
        if (def.componentType === 'App' || id === 'app' || (def.displayName ?? '').toLowerCase() === 'app') {
            return id;
        }
    }
    return null;
}

function updatePreview(): void {
    graph.getCells().forEach(c => c.remove());

    if (!selectedAppId) return;
    const app = getApp(selectedAppId);
    if (!app) return;

    const shapeKey = findAppShapeKey();
    const def = shapeKey ? ShapeRegistry[shapeKey] : null;

    if (def?.complexShape && def.layers?.length) {
        const baseLayer = def.layers[0];
        const cc = new ComplexComponent();
        cc.resize(baseLayer.width, baseLayer.height);
        cc.set('isometricHeight', baseLayer.depth);
        cc.set('defaultIsometricHeight', baseLayer.depth);
        cc.set('defaultSize', { width: baseLayer.width, height: baseLayer.height });
        cc.set('layers', def.layers.map(l => ({ ...l, style: { ...l.style } })));
        cc.position(GRID_SIZE * 2, GRID_SIZE * 2);

        if (def.iconHref) {
            cc.set('iconHref', def.iconHref);
            cc.set('iconSize', (def.iconSize ?? 1) * GRID_SIZE);
            cc.set('iconFace', def.iconFace ?? 'top');
            cc.set('iconLayerIndex', def.iconLayerIndex ?? 0);
        }

        cc.attr('label/text', app.name || def.displayName || 'App');
        cc.toggleView(View.Isometric);
        graph.addCell(cc);
    } else {
        const shape = new Computer();
        shape.resize(GRID_SIZE * 3, GRID_SIZE * 3);
        shape.set('isometricHeight', GRID_SIZE * 2);
        shape.set('defaultIsometricHeight', GRID_SIZE * 2);
        shape.position(GRID_SIZE * 2, GRID_SIZE * 2);

        if (def) applyRegistryDefaults(shape, def, paper);

        shape.attr('label/text', app.name || 'App');
        shape.toggleView(View.Isometric);
        graph.addCell(shape);
    }
}

// ---- Left panel: app list ----

function renderPalette(): void {
    paletteEl.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'nr-ad__list-header';
    const title = document.createElement('span');
    title.className = 'nr-ad__list-title';
    title.textContent = 'Applications';
    header.appendChild(title);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'nr-ad__list-add';
    addBtn.title = 'New application';
    addBtn.innerHTML = ICON_ADD;
    addBtn.addEventListener('click', () => {
        const app = createApp('New Application');
        selectedAppId = app.id;
        renderPalette();
        renderInspector();
        updatePreview();
    });
    header.appendChild(addBtn);
    paletteEl.appendChild(header);

    // List
    const list = document.createElement('div');
    list.className = 'nr-ad__list';

    for (const app of listApps()) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'nr-ad__list-item';
        if (app.id === selectedAppId) item.classList.add('nr-ad__list-item--selected');

        const label = document.createElement('span');
        label.className = 'nr-ad__list-item-label';
        label.textContent = app.name || 'Untitled';
        item.appendChild(label);

        item.addEventListener('click', () => {
            selectedAppId = app.id;
            renderPalette();
            renderInspector();
            updatePreview();
        });
        list.appendChild(item);
    }

    if (listApps().length === 0) {
        const empty = document.createElement('div');
        empty.className = 'nr-ad__list-empty';
        empty.textContent = 'No applications yet.';
        list.appendChild(empty);
    }

    paletteEl.appendChild(list);
}

// ---- Right panel: profile editor ----

function renderInspector(): void {
    inspectorEl.innerHTML = '';

    if (!selectedAppId) {
        const msg = document.createElement('div');
        msg.className = 'nr-ad__empty';
        msg.textContent = 'Select or create an application.';
        inspectorEl.appendChild(msg);
        return;
    }

    const app = getApp(selectedAppId);
    if (!app) { selectedAppId = null; renderInspector(); return; }

    // Header
    const header = document.createElement('div');
    header.className = 'nr-ad__profile-header';
    const title = document.createElement('h2');
    title.className = 'nr-ad__profile-title';
    title.textContent = 'Application Profile';
    header.appendChild(title);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cds--btn cds--btn--danger--tertiary cds--btn--sm';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete "${app.name}"?`)) return;
        deleteApp(app.id);
        selectedAppId = null;
        renderPalette();
        renderInspector();
        updatePreview();
    });
    header.appendChild(deleteBtn);
    inspectorEl.appendChild(header);

    const form = document.createElement('div');
    form.className = 'nr-ad__form';

    const save = () => { saveApp(app); updatePreview(); };

    form.appendChild(buildTextField('Application Name', app.name, v => {
        app.name = v; save(); renderPalette();
    }));

    form.appendChild(buildDropdown('Deployment Model', opts('deployment-model'), app.deploymentModel, v => { app.deploymentModel = v; save(); }));
    form.appendChild(buildDropdown('Operating System', opts('operating-system'), app.operatingSystem, v => { app.operatingSystem = v; save(); }));
    form.appendChild(buildDropdown('Application Server', opts('app-server'), app.applicationServer, v => { app.applicationServer = v; save(); }));
    form.appendChild(buildDropdown('Database', opts('database-technology'), app.database, v => { app.database = v; save(); }));
    form.appendChild(buildDropdown('Replication Level', opts('replication-level'), app.replicationLevel, v => { app.replicationLevel = v; save(); }));

    // Storage
    const storageSection = document.createElement('div');
    storageSection.className = 'nr-ad__storage-section';

    const storageHeader = document.createElement('div');
    storageHeader.className = 'nr-ad__storage-header';
    const storageTitle = document.createElement('span');
    storageTitle.className = 'nr-ad__storage-title';
    storageTitle.textContent = 'Storage';
    storageHeader.appendChild(storageTitle);

    const addStorageBtn = document.createElement('button');
    addStorageBtn.type = 'button';
    addStorageBtn.className = 'nr-ad__storage-add';
    addStorageBtn.innerHTML = ICON_ADD;
    addStorageBtn.addEventListener('click', () => {
        app.storageEntries.push({ type: '', amount: '' });
        save();
        renderInspector();
    });
    storageHeader.appendChild(addStorageBtn);
    storageSection.appendChild(storageHeader);

    const storageTypes = opts('storage-type');
    for (let i = 0; i < app.storageEntries.length; i++) {
        const entry = app.storageEntries[i];
        const row = document.createElement('div');
        row.className = 'nr-ad__storage-row';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'nr-ad__input';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— type —';
        typeSelect.appendChild(emptyOpt);
        for (const t of storageTypes) {
            const o = document.createElement('option');
            o.value = t; o.textContent = t;
            if (t === entry.type) o.selected = true;
            typeSelect.appendChild(o);
        }
        typeSelect.addEventListener('change', () => { entry.type = typeSelect.value; save(); });
        row.appendChild(typeSelect);

        const amountInput = document.createElement('input');
        amountInput.type = 'text';
        amountInput.className = 'nr-ad__input';
        amountInput.placeholder = 'e.g. 500 GB';
        amountInput.value = entry.amount;
        amountInput.addEventListener('input', () => { entry.amount = amountInput.value; save(); });
        row.appendChild(amountInput);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'nr-ad__storage-remove';
        removeBtn.innerHTML = ICON_TRASH;
        removeBtn.addEventListener('click', () => {
            app.storageEntries.splice(i, 1);
            save();
            renderInspector();
        });
        row.appendChild(removeBtn);

        storageSection.appendChild(row);
    }

    form.appendChild(storageSection);
    inspectorEl.appendChild(form);
}

// ---- Helpers ----

function opts(typeId: string): string[] {
    const dt = getDataType(typeId);
    return dt ? dt.fields.map(f => f.key) : [];
}

function buildTextField(label: string, value: string, onChange: (v: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'nr-ad__field';
    const lbl = document.createElement('label');
    lbl.className = 'nr-ad__label';
    lbl.textContent = label;
    row.appendChild(lbl);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'nr-ad__input';
    input.value = value;
    input.addEventListener('input', () => onChange(input.value));
    row.appendChild(input);
    return row;
}

function buildDropdown(label: string, options: string[], value: string, onChange: (v: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'nr-ad__field';
    const lbl = document.createElement('label');
    lbl.className = 'nr-ad__label';
    lbl.textContent = label;
    row.appendChild(lbl);
    const select = document.createElement('select');
    select.className = 'nr-ad__input';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— select —';
    select.appendChild(emptyOpt);
    for (const opt of options) {
        const el = document.createElement('option');
        el.value = opt; el.textContent = opt;
        if (opt === value) el.selected = true;
        select.appendChild(el);
    }
    select.addEventListener('change', () => onChange(select.value));
    row.appendChild(select);
    return row;
}
