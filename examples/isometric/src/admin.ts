// Admin area: Carbon-style left side-nav with two views.
//   - Icon Configuration: three sections + search (general / complex-only / available pool).
//   - User Settings:      placeholder for now.
//
// Wiring: initAdmin() is called once from index.ts. show()/hide() are driven by
// the app-level view switcher in index.ts.

import { ICON_CATALOG, IconCatalogEntry, getIconById, addUploadedIcon, addAwsIcons, removeAllAwsIcons, getAwsIconCount, addGcpIcons, removeAllGcpIcons, getGcpIconCount, addAzureIcons, removeAllAzureIcons, getAzureIconCount, addGridIcon, removeGridIcon, getGridIconCount, onCatalogChange, ensureFullCatalog, ensureCarbonIcons } from './icon-catalog';
import { unzipSync } from 'fflate';
import { carbonIconToString, CarbonIcon } from './icons';
import Edit16 from '@carbon/icons/es/edit/16.js';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Upload16 from '@carbon/icons/es/upload/16.js';
import SubtractAlt16 from '@carbon/icons/es/subtract--alt/16.js';
import Download16 from '@carbon/icons/es/download/16.js';

const ACTION_ICON_EDIT    = carbonIconToString(Edit16 as CarbonIcon);
const ACTION_ICON_DELETE  = carbonIconToString(TrashCan16 as CarbonIcon);
const ACTION_ICON_PUBLISH = carbonIconToString(Upload16 as CarbonIcon);
const ACTION_ICON_REMOVE  = carbonIconToString(SubtractAlt16 as CarbonIcon);
const ACTION_ICON_DOWNLOAD = carbonIconToString(Download16 as CarbonIcon);
import {
    getAllConfig,
    setIconScope,
    IconScope,
} from './icon-config';
import { ShapeRegistry, ShapeDefinition, BUILT_IN_SHAPE_IDS, deleteShape, saveRegistryToStorage } from './shapes/shape-registry';
import { shapeStore } from './shape-store';
import { componentStore, ComponentDefinition } from './component-store';
import { listInventory, removeFromInventory, isDarkMode, SvgInventoryEntry } from './svg-inventory';

type AdminView = 'icon-config' | 'component-library' | 'inventory' | 'data' | 'user-settings';

let rootEl: HTMLDivElement | null = null;
let currentView: AdminView = 'icon-config';

// Search term is module-scoped so re-renders don't lose it.
let iconSearchTerm = '';

// Cap rendered results in the "Available" section: the full Carbon set is
// 2.5k+ icons and rendering them all would stall the main thread.
const AVAILABLE_MAX = 300;

const NAV_ITEMS: Array<{ id: AdminView; label: string }> = [
    { id: 'icon-config',       label: 'Icon Configuration' },
    { id: 'component-library', label: 'Component Library' },
    { id: 'inventory',         label: 'SVG Inventory' },
    { id: 'data',              label: 'Data' },
    { id: 'user-settings',     label: 'User Settings' },
];

export function initAdmin(container: HTMLDivElement): void {
    rootEl = container;
    container.classList.add('nr-admin');

    const sideNav = document.createElement('nav');
    sideNav.className = 'nr-admin__side-nav';
    sideNav.setAttribute('aria-label', 'Admin navigation');

    for (const item of NAV_ITEMS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-admin__nav-item';
        btn.dataset.view = item.id;
        btn.textContent = item.label;
        btn.addEventListener('click', () => selectView(item.id));
        sideNav.appendChild(btn);
    }

    container.appendChild(sideNav);

    const contentEl = document.createElement('div');
    contentEl.className = 'nr-admin__content';
    contentEl.id = 'nr-admin-content';
    container.appendChild(contentEl);

    selectView(currentView);

    document.addEventListener('nextrack:inventory-changed', () => {
        if (currentView === 'inventory' && rootEl) {
            const contentEl = rootEl.querySelector<HTMLDivElement>('.nr-admin__content');
            if (contentEl) renderInventory(contentEl);
        }
    });
}

function selectView(view: AdminView): void {
    if (!rootEl) return;
    currentView = view;

    rootEl.querySelectorAll<HTMLButtonElement>('.nr-admin__nav-item').forEach(btn => {
        const active = btn.dataset.view === view;
        btn.classList.toggle('nr-admin__nav-item--selected', active);
        btn.setAttribute('aria-current', active ? 'page' : 'false');
    });

    // Move data-model element back to body if leaving Data view
    const dmEl = document.getElementById('data-model');
    if (dmEl && dmEl.parentElement?.classList.contains('nr-admin__content')) {
        dmEl.style.display = 'none';
        dmEl.style.position = '';
        dmEl.style.inset = '';
        dmEl.style.left = '';
        dmEl.style.top = '';
        document.body.appendChild(dmEl);
    }

    const contentEl = rootEl.querySelector<HTMLDivElement>('.nr-admin__content');
    if (!contentEl) return;
    contentEl.innerHTML = '';
    contentEl.style.padding = '';
    contentEl.style.position = '';
    contentEl.style.overflow = '';
    if (view === 'icon-config')       renderIconConfig(contentEl);
    if (view === 'component-library') renderComponentLibrary(contentEl);
    if (view === 'inventory')         renderInventory(contentEl);
    if (view === 'data')              renderDataView(contentEl);
    if (view === 'user-settings')     renderUserSettings(contentEl);
}

function renderDataView(container: HTMLElement): void {
    const dmEl = document.getElementById('data-model');
    if (!dmEl) return;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.padding = '0';
    dmEl.style.display = 'flex';
    dmEl.style.position = 'absolute';
    dmEl.style.inset = '0';
    dmEl.style.left = '0';
    dmEl.style.top = '0';
    container.appendChild(dmEl);
}

function renderComponentLibrary(container: HTMLElement): void {
    const host = document.createElement('div');
    container.appendChild(host);

    const render = () => {
        host.innerHTML = '';
        buildGeneralComponentsSection(host, render);
        buildUserComponentsSection(host, render);
    };
    render();
}

function buildInventoryCard(entry: SvgInventoryEntry, container: HTMLElement): HTMLElement {
    const svgLight = entry.svgLight ?? (entry as any).svg ?? '';
    const svgDark  = entry.svgDark  ?? svgLight;

    const card = document.createElement('div');
    card.className = 'nr-admin__inventory-card';

    const preview = document.createElement('div');
    preview.className = 'nr-admin__inventory-preview';

    const lightWrap = document.createElement('div');
    lightWrap.className = 'nr-admin__inventory-svg--light';
    lightWrap.innerHTML = svgLight;
    const darkWrap = document.createElement('div');
    darkWrap.className = 'nr-admin__inventory-svg--dark';
    darkWrap.innerHTML = svgDark;

    preview.appendChild(lightWrap);
    preview.appendChild(darkWrap);
    card.appendChild(preview);

    const label = document.createElement('div');
    label.className = 'nr-admin__inventory-label';
    label.textContent = entry.displayName;
    label.title = entry.displayName;
    card.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'nr-admin__inventory-actions';

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'nr-admin__inventory-icon-btn';
    dlBtn.title = 'Download';
    dlBtn.setAttribute('aria-label', 'Download');
    dlBtn.innerHTML = ACTION_ICON_DOWNLOAD;
    dlBtn.addEventListener('click', () => {
        const svg = isDarkMode() ? svgDark : svgLight;
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = entry.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    actions.appendChild(dlBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'nr-admin__inventory-icon-btn nr-admin__inventory-icon-btn--danger';
    delBtn.title = 'Remove';
    delBtn.setAttribute('aria-label', 'Remove');
    delBtn.innerHTML = ACTION_ICON_DELETE;
    delBtn.addEventListener('click', () => {
        removeFromInventory(entry.componentId);
        renderInventory(container);
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
}

function renderInventory(container: HTMLElement): void {
    container.innerHTML = '';

    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.textContent = 'SVG Inventory';
    container.appendChild(heading);

    const entries = listInventory();
    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No SVGs in inventory yet.';
        container.appendChild(empty);
        return;
    }

    const groups = new Map<string, SvgInventoryEntry[]>();
    for (const entry of entries) {
        const col = entry.collection || 'General';
        if (!groups.has(col)) groups.set(col, []);
        groups.get(col)!.push(entry);
    }

    groups.forEach((items, col) => {
        const section = document.createElement('div');
        section.className = 'nr-admin__inventory-section';

        const title = document.createElement('h3');
        title.className = 'nr-admin__inventory-section-title';
        title.textContent = col;
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'nr-admin__inventory-grid';

        for (const entry of items) {
            grid.appendChild(buildInventoryCard(entry, container));
        }

        section.appendChild(grid);
        container.appendChild(section);
    });
}

function buildShapeRow(
    id: string,
    def: ShapeDefinition,
    actions: HTMLElement,
    onCollectionChange?: (value: string) => void,
): HTMLTableRowElement {
    const tr = document.createElement('tr');

    const tdThumb = document.createElement('td');
    tdThumb.className = 'nr-admin__table-thumb';
    if (def.icon) {
        const entry = getIconById(def.icon);
        if (entry) tdThumb.innerHTML = entry.svg;
    }
    tr.appendChild(tdThumb);

    const tdId = document.createElement('td');
    tdId.textContent = id;
    tdId.className = 'nr-admin__table-mono';
    tr.appendChild(tdId);

    const tdName = document.createElement('td');
    tdName.textContent = def.displayName || '—';
    tr.appendChild(tdName);

    const tdCollection = document.createElement('td');
    if (onCollectionChange) {
        const select = document.createElement('select');
        select.className = 'nr-admin__table-select';
        for (const col of getComponentCollections()) {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col;
            if ((def.collection || 'General') === col) opt.selected = true;
            select.appendChild(opt);
        }
        select.addEventListener('change', () => onCollectionChange(select.value));
        tdCollection.appendChild(select);
    } else {
        tdCollection.textContent = def.collection || 'General';
    }
    tr.appendChild(tdCollection);

    const tdBase = document.createElement('td');
    tdBase.textContent = def.baseShape || '—';
    tr.appendChild(tdBase);

    const tdSize = document.createElement('td');
    const w = Math.round(def.defaultSize.width);
    const h = Math.round(def.defaultSize.height);
    tdSize.textContent = `${w}×${h}`;
    tr.appendChild(tdSize);

    const tdDepth = document.createElement('td');
    tdDepth.textContent = String(Math.round(def.defaultIsometricHeight));
    tr.appendChild(tdDepth);

    const tdComplex = document.createElement('td');
    tdComplex.textContent = def.complexShape ? `Yes (${def.layers?.length ?? 0} layers)` : 'No';
    tr.appendChild(tdComplex);

    const tdActions = document.createElement('td');
    tdActions.className = 'nr-admin__table-actions';
    tdActions.appendChild(actions);
    tr.appendChild(tdActions);

    return tr;
}

function createActionBtn(iconSvg: string, label: string, onClick: () => void, danger = false): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nr-admin__table-btn' + (danger ? ' nr-admin__table-btn--danger' : '');
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = iconSvg;
    btn.addEventListener('click', onClick);
    return btn;
}

import { getDataType } from './schema-registry';

export function getComponentCollections(): string[] {
    const dt = getDataType('component-collection');
    if (!dt) return ['General'];
    return dt.fields.map(f => f.key);
}

export type ComponentCollection = string;

const TABLE_COLUMNS = ['', 'ID', 'Display Name', 'Collection', 'Base Shape', 'Size (W×H)', 'Depth', 'Complex', ''];

function buildTableHead(): HTMLTableSectionElement {
    const thead = document.createElement('thead');
    const row = document.createElement('tr');
    for (const col of TABLE_COLUMNS) {
        const th = document.createElement('th');
        th.textContent = col;
        row.appendChild(th);
    }
    thead.appendChild(row);
    return thead;
}

function ensureComponent(id: string, def: ShapeDefinition, category: 'general' | 'user'): void {
    if (!componentStore.get(category, id)) {
        componentStore.save({
            id,
            name: def.displayName || id,
            category,
            shapeId: id,
            properties: {},
        });
    }
}

function buildGeneralComponentsSection(host: HTMLElement, rerender: () => void): void {
    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.textContent = 'General Components';
    host.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent = 'Product-level components available to all users.';
    host.appendChild(desc);

    const generalShapes = shapeStore.list('general');

    if (generalShapes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No general components yet. Promote components from User Components below.';
        host.appendChild(empty);
        return;
    }

    const table = document.createElement('table');
    table.className = 'nr-admin__table';
    table.appendChild(buildTableHead());

    const tbody = document.createElement('tbody');
    for (const stored of generalShapes) {
        const actions = document.createElement('div');
        actions.className = 'nr-admin__table-action-group';

        const editBtn = createActionBtn(ACTION_ICON_EDIT, 'Edit', () => {
            document.dispatchEvent(new CustomEvent('nextrack:navigate-to-shape', { detail: { shapeId: stored.id } }));
        });
        actions.appendChild(editBtn);

        const removeBtn = createActionBtn(ACTION_ICON_REMOVE, 'Demote to User Component', () => {
            if (!confirm(`Move "${stored.definition.displayName || stored.id}" back to User Components?`)) return;
            shapeStore.remove('general', stored.id);
            shapeStore.save('user', stored.id, stored.definition);
            const comp = componentStore.get('general', stored.id);
            if (comp) {
                componentStore.remove('general', stored.id);
                componentStore.save({ ...comp, category: 'user' });
            }
            rerender();
        });
        actions.appendChild(removeBtn);

        const deleteBtn = createActionBtn(ACTION_ICON_DELETE, 'Delete', () => {
            if (!confirm(`Delete general component "${stored.definition.displayName || stored.id}"?`)) return;
            shapeStore.remove('general', stored.id);
            componentStore.remove('general', stored.id);
            deleteShape(stored.id);
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            rerender();
        }, true);
        actions.appendChild(deleteBtn);

        tbody.appendChild(buildShapeRow(stored.id, stored.definition, actions, (value) => {
            stored.definition.collection = value === 'General' ? undefined : value;
            shapeStore.save('general', stored.id, stored.definition);
            if (ShapeRegistry[stored.id]) {
                ShapeRegistry[stored.id].collection = stored.definition.collection;
                saveRegistryToStorage();
            }
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
        }));
    }

    table.appendChild(tbody);
    host.appendChild(table);
}

function buildUserComponentsSection(host: HTMLElement, rerender: () => void): void {
    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.style.marginTop = '2rem';
    heading.textContent = 'User Components';
    host.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent = 'Your private components. Promote them to General to make them available to all users.';
    host.appendChild(desc);

    const generalIds = new Set(shapeStore.list('general').map(s => s.id));

    const userShapes = Object.entries(ShapeRegistry).filter(
        ([id]) => !BUILT_IN_SHAPE_IDS.has(id) && !generalIds.has(id)
    );

    if (userShapes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No user components. Create components in the Component Designer.';
        host.appendChild(empty);
        return;
    }

    const table = document.createElement('table');
    table.className = 'nr-admin__table';
    table.appendChild(buildTableHead());

    const tbody = document.createElement('tbody');
    for (const [id, def] of userShapes) {
        const actions = document.createElement('div');
        actions.className = 'nr-admin__table-action-group';

        const editBtn = createActionBtn(ACTION_ICON_EDIT, 'Edit', () => {
            document.dispatchEvent(new CustomEvent('nextrack:navigate-to-shape', { detail: { shapeId: id } }));
        });
        actions.appendChild(editBtn);

        const promoteBtn = createActionBtn(ACTION_ICON_PUBLISH, 'Promote to General Component', () => {
            shapeStore.save('general', id, def);
            ensureComponent(id, def, 'general');
            componentStore.remove('user', id);
            rerender();
        });
        actions.appendChild(promoteBtn);

        const deleteBtn = createActionBtn(ACTION_ICON_DELETE, 'Delete', () => {
            if (!confirm(`Delete user component "${def.displayName || id}"?`)) return;
            deleteShape(id);
            saveRegistryToStorage();
            shapeStore.remove('user', id);
            componentStore.remove('user', id);
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            rerender();
        }, true);
        actions.appendChild(deleteBtn);

        tbody.appendChild(buildShapeRow(id, def, actions, (value) => {
            def.collection = value === 'General' ? undefined : value;
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
        }));
    }

    table.appendChild(tbody);
    host.appendChild(table);
}

function renderUserSettings(container: HTMLElement): void {
    const h = document.createElement('h2');
    h.className = 'nr-admin__heading';
    h.textContent = 'User Settings';
    container.appendChild(h);
}

function matchesSearch(entry: IconCatalogEntry, term: string): boolean {
    if (!term) return true;
    const t = term.toLowerCase();
    return entry.label.toLowerCase().includes(t) || entry.id.toLowerCase().includes(t);
}

function renderIconConfig(container: HTMLElement): void {
    ensureFullCatalog();
    const h = document.createElement('h2');
    h.className = 'nr-admin__heading';
    h.textContent = 'Icon Configuration';
    container.appendChild(h);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent =
        'General Component Icons appear in the standard Component Editor and in Complex Shape. ' +
        'Additional Complex Shape Icons appear only in Complex Shape. ' +
        'Add more icons from the full Carbon library via search below.';
    container.appendChild(desc);

    // ── Import section — structured as Carbon tiles ─────────────────────────
    interface PackDef {
        id: string; label: string; accept: string;
        getCount: () => number;
        addFn: ((entries: Array<{ label: string; svg: string }>) => Promise<{ added: number; error?: string }>) | null;
        removeFn: (() => Promise<number>) | null;
    }

    const packs: PackDef[] = [
        { id: 'svg',   label: 'Custom SVG',  accept: '.svg,image/svg+xml', getCount: () => 0, addFn: null, removeFn: null },
        { id: 'aws',   label: 'AWS',         accept: '.zip,application/zip', getCount: getAwsIconCount,   addFn: addAwsIcons,   removeFn: removeAllAwsIcons },
        { id: 'gcp',   label: 'GCP',         accept: '.zip,application/zip', getCount: getGcpIconCount,   addFn: addGcpIcons,   removeFn: removeAllGcpIcons },
        { id: 'azure', label: 'Azure',       accept: '.zip,application/zip', getCount: getAzureIconCount, addFn: addAzureIcons, removeFn: removeAllAzureIcons },
    ];

    const importSection = document.createElement('div');
    importSection.className = 'nr-admin__import-section';

    const importTitle = document.createElement('h3');
    importTitle.className = 'nr-admin__import-title';
    importTitle.textContent = 'Import Icons';
    importSection.appendChild(importTitle);

    const importDesc = document.createElement('p');
    importDesc.className = 'nr-admin__import-desc';
    importDesc.textContent = 'Upload individual SVG files or vendor icon packs as ZIP archives.';
    importSection.appendChild(importDesc);

    const tileGrid = document.createElement('div');
    tileGrid.className = 'nr-admin__import-grid';

    const packRefs: Array<{ statusEl: HTMLElement; removeBtn: HTMLButtonElement; pack: PackDef }> = [];

    for (const pack of packs) {
        const tile = document.createElement('div');
        tile.className = 'nr-admin__import-tile';

        const tileLabel = document.createElement('div');
        tileLabel.className = 'nr-admin__import-tile-label';
        tileLabel.textContent = pack.label;
        tile.appendChild(tileLabel);

        const statusEl = document.createElement('div');
        statusEl.className = 'nr-admin__import-tile-status';
        const cnt = pack.getCount();
        const inUse = pack.id !== 'svg' ? countUsedBySource(pack.id) : 0;
        statusEl.textContent = cnt > 0 ? `${cnt} icons` + (inUse > 0 ? ` · ${inUse} in use` : '') : 'No icons';
        tile.appendChild(statusEl);

        const btnRow = document.createElement('div');
        btnRow.className = 'nr-admin__import-tile-actions';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = pack.accept;
        fileInput.style.display = 'none';
        fileInput.id = `nr-admin-upload-${pack.id}`;

        const uploadBtn = document.createElement('label');
        uploadBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
        uploadBtn.setAttribute('for', fileInput.id);
        uploadBtn.textContent = pack.id === 'svg' ? 'Upload SVG' : 'Upload ZIP';
        uploadBtn.setAttribute('role', 'button');
        uploadBtn.tabIndex = 0;
        uploadBtn.style.cursor = 'pointer';
        uploadBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            if (pack.id === 'svg') {
                const lbl = file.name.replace(/\.[^.]+$/, '');
                const reader = new FileReader();
                reader.onload = () => { addUploadedIcon(lbl, reader.result as string); renderSections(); };
                reader.readAsText(file);
            } else if (pack.addFn) {
                statusEl.textContent = 'Extracting…';
                try {
                    const buf = await file.arrayBuffer();
                    const unzipped = unzipSync(new Uint8Array(buf));
                    const entries: Array<{ label: string; svg: string }> = [];
                    for (const [path, data] of Object.entries(unzipped)) {
                        if (!path.endsWith('.svg') || path.startsWith('__MACOSX')) continue;
                        const name = path.split('/').pop()!.replace(/\.svg$/, '');
                        let svg = new TextDecoder().decode(data);
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(svg, 'image/svg+xml');
                        const svgEl = doc.querySelector('svg');
                        if (svgEl) {
                            if (!svgEl.getAttribute('viewBox')) {
                                const w = svgEl.getAttribute('width') || '80';
                                const hh = svgEl.getAttribute('height') || '80';
                                svgEl.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(hh)}`);
                            }
                            svgEl.removeAttribute('width');
                            svgEl.removeAttribute('height');
                            svg = new XMLSerializer().serializeToString(svgEl);
                        }
                        entries.push({ label: name, svg });
                    }
                    const result = await pack.addFn(entries);
                    statusEl.textContent = result.error || `${result.added} imported (${pack.getCount()} total)`;
                    removeBtn.style.display = pack.getCount() > 0 ? '' : 'none';
                    renderSections();
                } catch (e) {
                    statusEl.textContent = 'Import failed';
                    console.error(`[nextrack] ${pack.label} import failed:`, e);
                }
            }
            fileInput.value = '';
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'cds--btn cds--btn--danger--tertiary cds--btn--sm';
        removeBtn.textContent = 'Remove';
        removeBtn.style.display = (pack.removeFn && pack.getCount() > 0) ? '' : 'none';
        if (pack.id === 'svg') removeBtn.style.display = 'none';
        removeBtn.addEventListener('click', async () => {
            if (!pack.removeFn) return;
            const removed = await pack.removeFn();
            statusEl.textContent = `${removed} removed`;
            removeBtn.style.display = 'none';
            renderSections();
        });

        btnRow.appendChild(fileInput);
        btnRow.appendChild(uploadBtn);
        btnRow.appendChild(removeBtn);
        tile.appendChild(btnRow);
        tileGrid.appendChild(tile);

        packRefs.push({ statusEl, removeBtn, pack });
    }

    importSection.appendChild(tileGrid);

    const awsStatus = packRefs.find(p => p.pack.id === 'aws')!.statusEl;
    const awsRemoveBtn = packRefs.find(p => p.pack.id === 'aws')!.removeBtn;
    const gcpStatus = packRefs.find(p => p.pack.id === 'gcp')!.statusEl;
    const gcpRemoveBtn = packRefs.find(p => p.pack.id === 'gcp')!.removeBtn;
    const azureStatus = packRefs.find(p => p.pack.id === 'azure')!.statusEl;
    const azureRemoveBtn = packRefs.find(p => p.pack.id === 'azure')!.removeBtn;

    // Search input (sticky at the top of the content area).
    const searchWrap = document.createElement('div');
    searchWrap.className = 'nr-admin__search';
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'nr-admin__search-input';
    input.placeholder = 'Search all icons (e.g. "server", "cloud", "rack")';
    input.value = iconSearchTerm;
    input.setAttribute('aria-label', 'Search icons');
    searchWrap.appendChild(input);

    const sectionsHost = document.createElement('div');
    sectionsHost.className = 'nr-admin__sections';

    // Sections host + search go first, import section is embedded within vendor tabs
    container.appendChild(searchWrap);
    container.appendChild(sectionsHost);

    const renderSections = () => {
        sectionsHost.innerHTML = '';
        buildSections(sectionsHost);
    };

    buildCtx = { renderSections, importSection };

    let searchDebounce: number | null = null;
    input.addEventListener('input', () => {
        iconSearchTerm = input.value;
        if (searchDebounce !== null) window.clearTimeout(searchDebounce);
        searchDebounce = window.setTimeout(renderSections, 120);
    });

    renderSections();

    // Re-render when IndexedDB finishes loading vendor icons
    onCatalogChange(() => {
        renderSections();
        awsStatus.textContent = getAwsIconCount() > 0 ? `${getAwsIconCount()} AWS icons loaded` : '';
        awsRemoveBtn.style.display = getAwsIconCount() > 0 ? '' : 'none';
        gcpStatus.textContent = getGcpIconCount() > 0 ? `${getGcpIconCount()} GCP icons loaded` : '';
        gcpRemoveBtn.style.display = getGcpIconCount() > 0 ? '' : 'none';
        azureStatus.textContent = getAzureIconCount() > 0 ? `${getAzureIconCount()} Azure icons loaded` : '';
        azureRemoveBtn.style.display = getAzureIconCount() > 0 ? '' : 'none';
    });
}

function getUsedIconIds(): Set<string> {
    const used = new Set<string>();
    for (const def of Object.values(ShapeRegistry)) {
        if (def.icon) used.add(def.icon);
    }
    return used;
}

function countUsedBySource(source: string): number {
    const used = getUsedIconIds();
    return ICON_CATALOG.filter(i => i.source === source && used.has(i.id)).length;
}

let activeIconTab = 'general';

interface BuildContext {
    renderSections: () => void;
    importSection: HTMLElement;
}

let buildCtx: BuildContext | null = null;

function buildSections(host: HTMLElement): void {
    host.innerHTML = '';
    const cfg  = getAllConfig();
    const term = iconSearchTerm.trim();
    const vendorSources = new Set(['aws', 'gcp', 'azure']);

    const usedIds = getUsedIconIds();

    function buildInUseSection(icons: ReadonlyArray<IconCatalogEntry>): HTMLElement | null {
        const used = icons.filter(i => usedIds.has(i.id));
        if (used.length === 0) return null;
        const section = document.createElement('section');
        section.className = 'nr-admin__section';
        const head = document.createElement('div');
        head.className = 'nr-admin__section-head';
        const title = document.createElement('h3');
        title.className = 'nr-admin__section-title';
        title.textContent = 'In Use';
        head.appendChild(title);
        const cnt = document.createElement('span');
        cnt.className = 'nr-admin__section-count';
        cnt.textContent = String(used.length);
        head.appendChild(cnt);
        section.appendChild(head);
        const helper = document.createElement('p');
        helper.className = 'nr-admin__section-helper';
        helper.textContent = 'Currently assigned to components.';
        section.appendChild(helper);
        const grid = document.createElement('div');
        grid.className = 'nr-admin__icon-compact-grid';
        for (const icon of used) {
            const shapeName = Object.values(ShapeRegistry).find(d => d.icon === icon.id)?.displayName ?? '';
            grid.appendChild(buildTile(icon, {
                titleAction: shapeName ? `Used by ${shapeName}` : icon.label,
                onClick: null,
                showRemove: false,
            }));
        }
        section.appendChild(grid);
        return section;
    }

    function buildTabWithInUse(sourceFilter: (i: IconCatalogEntry) => boolean, sectionCfg: SectionConfig): HTMLElement {
        const wrap = document.createElement('div');
        const allForSource = ICON_CATALOG.filter(sourceFilter);
        const inUse = buildInUseSection(allForSource);
        if (inUse) wrap.appendChild(inUse);
        wrap.appendChild(buildSection(sectionCfg));
        return wrap;
    }

    // Tab definitions
    const tabs: Array<{ key: string; label: string; count?: number; build: () => HTMLElement }> = [
        {
            key: 'general', label: 'General',
            count: ICON_CATALOG.filter(i => cfg[i.id] === 'general' && !vendorSources.has(i.source)).length,
            build: () => buildTabWithInUse(
                i => cfg[i.id] === 'general' && !vendorSources.has(i.source),
                { title: 'General Component Icons', helper: 'Available in Component Editor and Complex Shape. Click to move to Complex Shape only. × removes from both pickers.',
                  icons: ICON_CATALOG.filter(i => cfg[i.id] === 'general' && !vendorSources.has(i.source) && matchesSearch(i, term)),
                  emptyText: term ? 'No matches.' : 'No icons in this section.', primaryTarget: 'complex-only', showRemove: true }),
        },
        {
            key: 'complex', label: 'Complex Shape',
            count: ICON_CATALOG.filter(i => cfg[i.id] === 'complex-only' && !vendorSources.has(i.source)).length,
            build: () => buildTabWithInUse(
                i => cfg[i.id] === 'complex-only' && !vendorSources.has(i.source),
                { title: 'Complex Shape Icons', helper: 'Available only in Complex Shape. Click to move to General.',
                  icons: ICON_CATALOG.filter(i => cfg[i.id] === 'complex-only' && !vendorSources.has(i.source) && matchesSearch(i, term)),
                  emptyText: term ? 'No matches.' : 'No icons in this section.', primaryTarget: 'general', showRemove: true }),
        },
        {
            key: 'grid-icons', label: 'Grid Icons',
            count: getGridIconCount(),
            build: () => {
                const wrap = document.createElement('div');
                // Upload row
                const uploadRow = document.createElement('div');
                uploadRow.className = 'nr-admin__section';
                uploadRow.style.marginBottom = '12px';
                const uploadHead = document.createElement('div');
                uploadHead.style.display = 'flex';
                uploadHead.style.alignItems = 'center';
                uploadHead.style.gap = '8px';
                uploadHead.style.marginBottom = '8px';
                const uploadLbl = document.createElement('span');
                uploadLbl.className = 'nr-admin__section-title';
                uploadLbl.textContent = 'Upload SVG';
                uploadHead.appendChild(uploadLbl);
                const gridFileInput = document.createElement('input');
                gridFileInput.type = 'file';
                gridFileInput.accept = '.svg,image/svg+xml';
                gridFileInput.style.display = 'none';
                const gridUploadBtn = document.createElement('label');
                gridUploadBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
                gridUploadBtn.textContent = 'Upload SVG';
                gridUploadBtn.style.cursor = 'pointer';
                gridUploadBtn.addEventListener('click', () => gridFileInput.click());
                gridFileInput.addEventListener('change', () => {
                    const file = gridFileInput.files?.[0];
                    if (!file) return;
                    const lbl = file.name.replace(/\.[^.]+$/, '');
                    const reader = new FileReader();
                    reader.onload = () => {
                        addGridIcon(lbl, reader.result as string);
                        buildCtx?.renderSections();
                    };
                    reader.readAsText(file);
                    gridFileInput.value = '';
                });
                uploadHead.appendChild(gridFileInput);
                uploadHead.appendChild(gridUploadBtn);
                uploadRow.appendChild(uploadHead);
                wrap.appendChild(uploadRow);

                // Icon grid with remove buttons
                const gridIcons = ICON_CATALOG.filter(i => i.source === 'grid-icon' && matchesSearch(i, term));
                if (gridIcons.length > 0) {
                    const grid = document.createElement('div');
                    grid.className = 'nr-admin__icon-compact-grid';
                    for (const icon of gridIcons) {
                        grid.appendChild(buildTile(icon, {
                            titleAction: icon.label,
                            onClick: null,
                            showRemove: true,
                            onRemove: () => { removeGridIcon(icon.id); buildCtx?.renderSections(); },
                        }));
                    }
                    wrap.appendChild(grid);
                } else {
                    const empty = document.createElement('p');
                    empty.className = 'nr-admin__section-helper';
                    empty.textContent = term ? 'No grid icons match.' : 'No grid icons uploaded yet. Use the button above to add SVG files.';
                    wrap.appendChild(empty);
                }
                return wrap;
            },
        },
        {
            key: 'aws', label: 'AWS',
            count: getAwsIconCount(),
            build: () => {
                const wrap = buildTabWithInUse(
                    i => i.source === 'aws',
                    { title: 'AWS Icons', helper: 'Imported from AWS icon pack.',
                      icons: ICON_CATALOG.filter(i => i.source === 'aws' && matchesSearch(i, term)),
                      emptyText: term ? 'No AWS icons match.' : 'No AWS icons loaded. Upload a ZIP using the import section below.', primaryTarget: null, showRemove: false });
                if (buildCtx?.importSection) wrap.appendChild(buildCtx.importSection);
                return wrap;
            },
        },
        {
            key: 'gcp', label: 'GCP',
            count: getGcpIconCount(),
            build: () => buildTabWithInUse(
                i => i.source === 'gcp',
                { title: 'GCP Icons', helper: 'Imported from GCP icon pack.',
                  icons: ICON_CATALOG.filter(i => i.source === 'gcp' && matchesSearch(i, term)),
                  emptyText: term ? 'No GCP icons match.' : 'No GCP icons loaded. Switch to the AWS tab to import vendor packs.', primaryTarget: null, showRemove: false }),
        },
        {
            key: 'azure', label: 'Azure',
            count: getAzureIconCount(),
            build: () => buildTabWithInUse(
                i => i.source === 'azure',
                { title: 'Azure Icons', helper: 'Imported from Azure icon pack.',
                  icons: ICON_CATALOG.filter(i => i.source === 'azure' && matchesSearch(i, term)),
                  emptyText: term ? 'No Azure icons match.' : 'No Azure icons loaded. Switch to the AWS tab to import vendor packs.', primaryTarget: null, showRemove: false }),
        },
        {
            key: 'carbon', label: 'Carbon Library',
            build: () => { ensureCarbonIcons(); return buildAvailableSection(getAllConfig(), term); },
        },
    ];

    // Contained full-width tabs
    const tabList = document.createElement('div');
    tabList.className = 'nr-admin__tabs';
    tabList.setAttribute('role', 'tablist');

    const tabPanel = document.createElement('div');
    tabPanel.className = 'nr-admin__tab-panel';

    for (const tab of tabs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-admin__tab' + (activeIconTab === tab.key ? ' nr-admin__tab--selected' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(activeIconTab === tab.key));

        const labelSpan = document.createElement('span');
        labelSpan.textContent = tab.label;
        btn.appendChild(labelSpan);

        if (tab.count != null && tab.count > 0) {
            const badge = document.createElement('span');
            badge.className = 'nr-admin__tab-badge';
            badge.textContent = String(tab.count);
            btn.appendChild(badge);
        }

        btn.addEventListener('click', () => {
            activeIconTab = tab.key;
            buildSections(host);
        });
        tabList.appendChild(btn);
    }

    host.appendChild(tabList);

    const activeTab = tabs.find(t => t.key === activeIconTab) ?? tabs[0];
    tabPanel.appendChild(activeTab.build());
    host.appendChild(tabPanel);
}

function buildAvailableSection(cfg: Record<string, IconScope>, term: string): HTMLElement {
    const section = document.createElement('section');
    section.className = 'nr-admin__section';

    const head = document.createElement('div');
    head.className = 'nr-admin__section-head';

    const title = document.createElement('h3');
    title.className = 'nr-admin__section-title';
    title.textContent = 'Available Icons';
    head.appendChild(title);
    section.appendChild(head);

    if (!term) {
        const hint = document.createElement('p');
        hint.className = 'nr-admin__section-helper';
        hint.textContent =
            'Type in the search box to browse the Carbon icon library and add icons. ' +
            'The library contains thousands of icons, so a search term is required.';
        section.appendChild(hint);
        return section;
    }

    // All catalog icons with scope 'none' that match the search term.
    const pool = ICON_CATALOG.filter(i =>
        cfg[i.id] === 'none' && matchesSearch(i, term)
    );

    const totalCount = pool.length;
    const visible = pool.slice(0, AVAILABLE_MAX);

    const count = document.createElement('span');
    count.className = 'nr-admin__section-count';
    count.textContent = totalCount > AVAILABLE_MAX
        ? `${visible.length} of ${totalCount}`
        : String(totalCount);
    head.appendChild(count);

    const helper = document.createElement('p');
    helper.className = 'nr-admin__section-helper';
    helper.textContent = totalCount > AVAILABLE_MAX
        ? `Showing ${AVAILABLE_MAX} of ${totalCount} matches. Refine your search to narrow further. Click an icon to add it to General Component Icons.`
        : 'Click an icon to add it to General Component Icons.';
    section.appendChild(helper);

    if (visible.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No matches. All matching icons are already in the sections above, or no icon matches this term.';
        section.appendChild(empty);
        return section;
    }

    const grid = document.createElement('div');
    grid.className = 'nr-admin__icon-compact-grid';

    for (const icon of visible) {
        grid.appendChild(buildTile(icon, {
            titleAction: 'Add to General Component Icons',
            onClick:     () => toggleAndRerender(icon.id, 'general'),
            showRemove:  false,
        }));
    }

    section.appendChild(grid);
    return section;
}

interface SectionConfig {
    title: string;
    helper: string;
    icons: ReadonlyArray<IconCatalogEntry>;
    emptyText: string;
    primaryTarget: IconScope | null;
    showRemove: boolean;
}

function buildSection(cfg: SectionConfig): HTMLElement {
    const section = document.createElement('section');
    section.className = 'nr-admin__section';

    const head = document.createElement('div');
    head.className = 'nr-admin__section-head';

    const title = document.createElement('h3');
    title.className = 'nr-admin__section-title';
    title.textContent = cfg.title;
    head.appendChild(title);

    const count = document.createElement('span');
    count.className = 'nr-admin__section-count';
    count.textContent = String(cfg.icons.length);
    head.appendChild(count);

    section.appendChild(head);

    const helper = document.createElement('p');
    helper.className = 'nr-admin__section-helper';
    helper.textContent = cfg.helper;
    section.appendChild(helper);

    if (cfg.icons.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = cfg.emptyText;
        section.appendChild(empty);
        return section;
    }

    const grid = document.createElement('div');
    grid.className = 'nr-admin__icon-compact-grid';

    for (const icon of cfg.icons) {
        if (cfg.primaryTarget === null) {
            grid.appendChild(buildTile(icon, {
                titleAction: icon.label,
                onClick:     null,
                showRemove:  false,
            }));
        } else {
            const targetLabel = cfg.primaryTarget === 'general'
                ? 'Move to General Component Icons'
                : 'Move to Additional Complex Shape Icons';
            grid.appendChild(buildTile(icon, {
                titleAction: targetLabel,
                onClick:     () => toggleAndRerender(icon.id, cfg.primaryTarget!),
                showRemove:  cfg.showRemove,
            }));
        }
    }

    section.appendChild(grid);
    return section;
}

interface TileConfig {
    titleAction: string;
    onClick:     (() => void) | null;
    showRemove:  boolean;
    onRemove?:   (() => void) | null;
}

function buildTile(icon: IconCatalogEntry, tcfg: TileConfig): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'nr-admin__icon-tile-wrap';

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'nr-admin__icon-tile';
    tile.setAttribute('aria-label', `${icon.label} — ${tcfg.titleAction}`);
    tile.title = `${icon.label} — ${tcfg.titleAction}`;

    const isVendor = icon.source === 'aws' || icon.source === 'gcp' || icon.source === 'azure';
    const thumb = document.createElement('span');
    thumb.className = 'nr-admin__icon-tile-thumb' + (isVendor ? ' nr-icon-color' : '');
    thumb.innerHTML = icon.svg;
    tile.appendChild(thumb);

    const label = document.createElement('span');
    label.className = 'nr-admin__icon-tile-label';
    label.textContent = icon.label;
    tile.appendChild(label);

    if (tcfg.onClick) tile.addEventListener('click', tcfg.onClick);
    else tile.style.cursor = 'default';
    wrap.appendChild(tile);

    if (tcfg.showRemove) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'nr-admin__icon-tile-remove';
        remove.setAttribute('aria-label', `Remove ${icon.label}`);
        remove.title = `Remove ${icon.label}`;
        remove.textContent = '×';
        remove.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tcfg.onRemove) tcfg.onRemove();
            else toggleAndRerender(icon.id, 'none');
        });
        wrap.appendChild(remove);
    }

    return wrap;
}

function toggleAndRerender(iconId: string, target: IconScope): void {
    setIconScope(iconId, target);
    if (!rootEl) return;
    const sectionsHost = rootEl.querySelector<HTMLDivElement>('.nr-admin__sections');
    if (!sectionsHost) return;
    sectionsHost.innerHTML = '';
    buildSections(sectionsHost);
}
