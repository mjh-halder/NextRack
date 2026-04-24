// Admin area: Carbon-style left side-nav with two views.
//   - Icon Configuration: three sections + search (general / complex-only / available pool).
//   - User Settings:      placeholder for now.
//
// Wiring: initAdmin() is called once from index.ts. show()/hide() are driven by
// the app-level view switcher in index.ts.

import { ICON_CATALOG, IconCatalogEntry, getIconById, addUploadedIcon, addAwsIcons, removeAllAwsIcons, getAwsIconCount } from './icon-catalog';
import { unzipSync } from 'fflate';
import { carbonIconToString, CarbonIcon } from './icons';
import Edit16 from '@carbon/icons/es/edit/16.js';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Upload16 from '@carbon/icons/es/upload/16.js';
import SubtractAlt16 from '@carbon/icons/es/subtract--alt/16.js';

const ACTION_ICON_EDIT    = carbonIconToString(Edit16 as CarbonIcon);
const ACTION_ICON_DELETE  = carbonIconToString(TrashCan16 as CarbonIcon);
const ACTION_ICON_PUBLISH = carbonIconToString(Upload16 as CarbonIcon);
const ACTION_ICON_REMOVE  = carbonIconToString(SubtractAlt16 as CarbonIcon);
import {
    getAllConfig,
    setIconScope,
    IconScope,
} from './icon-config';
import { ShapeRegistry, ShapeDefinition, BUILT_IN_SHAPE_IDS, deleteShape, saveRegistryToStorage } from './shapes/shape-registry';
import { shapeStore } from './shape-store';
import { componentStore, ComponentDefinition } from './component-store';

type AdminView = 'icon-config' | 'component-library' | 'data' | 'user-settings';

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

    // Upload custom SVG icon
    const uploadRow = document.createElement('div');
    uploadRow.className = 'nr-admin__upload-row';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.svg,image/svg+xml';
    fileInput.style.display = 'none';
    fileInput.id = 'nr-admin-icon-upload';

    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const label = file.name.replace(/\.[^.]+$/, '');
        const reader = new FileReader();
        reader.onload = () => {
            addUploadedIcon(label, reader.result as string);
            renderSections();
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'nr-admin__upload-btn';
    uploadLabel.setAttribute('for', 'nr-admin-icon-upload');
    uploadLabel.textContent = 'Upload SVG Icon';
    uploadLabel.setAttribute('role', 'button');
    uploadLabel.tabIndex = 0;
    uploadLabel.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

    uploadRow.appendChild(fileInput);
    uploadRow.appendChild(uploadLabel);
    container.appendChild(uploadRow);

    // AWS icon pack upload
    const awsRow = document.createElement('div');
    awsRow.className = 'nr-admin__upload-row';
    awsRow.style.gap = '8px';

    const awsFileInput = document.createElement('input');
    awsFileInput.type = 'file';
    awsFileInput.accept = '.zip,application/zip';
    awsFileInput.style.display = 'none';
    awsFileInput.id = 'nr-admin-aws-upload';

    const awsStatus = document.createElement('span');
    awsStatus.className = 'nr-admin__aws-status';
    const awsCount = getAwsIconCount();
    awsStatus.textContent = awsCount > 0 ? `${awsCount} AWS icons loaded` : '';

    awsFileInput.addEventListener('change', async () => {
        const file = awsFileInput.files?.[0];
        if (!file) return;
        awsStatus.textContent = 'Extracting…';
        try {
            const buf = await file.arrayBuffer();
            const unzipped = unzipSync(new Uint8Array(buf));
            const entries: Array<{ label: string; svg: string }> = [];
            for (const [path, data] of Object.entries(unzipped)) {
                if (!path.endsWith('.svg')) continue;
                if (path.startsWith('__MACOSX')) continue;
                const name = path.split('/').pop()!.replace(/\.svg$/, '');
                let svg = new TextDecoder().decode(data);
                const parser = new DOMParser();
                const doc = parser.parseFromString(svg, 'image/svg+xml');
                const svgEl = doc.querySelector('svg');
                if (svgEl) {
                    if (!svgEl.getAttribute('viewBox')) {
                        const w = svgEl.getAttribute('width') || '80';
                        const h = svgEl.getAttribute('height') || '80';
                        svgEl.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
                    }
                    svgEl.removeAttribute('width');
                    svgEl.removeAttribute('height');
                    svg = new XMLSerializer().serializeToString(svgEl);
                }
                entries.push({ label: name, svg });
            }
            const added = addAwsIcons(entries);
            awsStatus.textContent = `${added} new icons imported (${getAwsIconCount()} total)`;
            renderSections();
        } catch (e) {
            awsStatus.textContent = 'Failed to extract ZIP';
            console.error('[nextrack] AWS ZIP import failed:', e);
        }
        awsFileInput.value = '';
    });

    const awsUploadLabel = document.createElement('label');
    awsUploadLabel.className = 'nr-admin__upload-btn';
    awsUploadLabel.setAttribute('for', 'nr-admin-aws-upload');
    awsUploadLabel.textContent = 'Upload AWS Icons (ZIP)';
    awsUploadLabel.setAttribute('role', 'button');
    awsUploadLabel.tabIndex = 0;
    awsUploadLabel.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') awsFileInput.click(); });

    const awsRemoveBtn = document.createElement('button');
    awsRemoveBtn.type = 'button';
    awsRemoveBtn.className = 'nr-admin__upload-btn nr-admin__upload-btn--danger';
    awsRemoveBtn.textContent = 'Remove all AWS Icons';
    awsRemoveBtn.style.display = awsCount > 0 ? '' : 'none';
    awsRemoveBtn.addEventListener('click', () => {
        const removed = removeAllAwsIcons();
        awsStatus.textContent = `${removed} AWS icons removed`;
        awsRemoveBtn.style.display = 'none';
        renderSections();
    });

    awsRow.appendChild(awsFileInput);
    awsRow.appendChild(awsUploadLabel);
    awsRow.appendChild(awsRemoveBtn);
    awsRow.appendChild(awsStatus);
    container.appendChild(awsRow);

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
    container.appendChild(searchWrap);

    const sectionsHost = document.createElement('div');
    sectionsHost.className = 'nr-admin__sections';
    container.appendChild(sectionsHost);

    const renderSections = () => {
        sectionsHost.innerHTML = '';
        buildSections(sectionsHost);
    };

    let searchDebounce: number | null = null;
    input.addEventListener('input', () => {
        iconSearchTerm = input.value;
        if (searchDebounce !== null) window.clearTimeout(searchDebounce);
        searchDebounce = window.setTimeout(renderSections, 120);
    });

    renderSections();
}

function buildSections(host: HTMLElement): void {
    const cfg  = getAllConfig();
    const term = iconSearchTerm.trim();

    const general = ICON_CATALOG.filter(i =>
        cfg[i.id] === 'general' && i.source !== 'aws' && matchesSearch(i, term)
    );
    const complexOnly = ICON_CATALOG.filter(i =>
        cfg[i.id] === 'complex-only' && i.source !== 'aws' && matchesSearch(i, term)
    );
    const awsIcons = ICON_CATALOG.filter(i =>
        i.source === 'aws' && matchesSearch(i, term)
    );

    host.appendChild(buildSection({
        title: 'General Component Icons',
        helper: 'Available in Component Editor and Complex Shape. Click to move to Additional Complex Shape Icons. × removes from both pickers.',
        icons: general,
        emptyText: term ? 'No matches in this section.' : 'No icons currently in this section.',
        primaryTarget: 'complex-only',
        showRemove: true,
    }));

    host.appendChild(buildSection({
        title: 'Additional Complex Shape Icons',
        helper: 'Available only in Complex Shape. Click to move to General Component Icons. × removes from both pickers.',
        icons: complexOnly,
        emptyText: term ? 'No matches in this section.' : 'No icons currently in this section.',
        primaryTarget: 'general',
        showRemove: true,
    }));

    if (awsIcons.length > 0 || getAwsIconCount() > 0) {
        host.appendChild(buildSection({
            title: `AWS Icons (${getAwsIconCount()})`,
            helper: 'Imported from AWS icon pack. Managed separately — use "Remove all AWS Icons" above to clear.',
            icons: awsIcons,
            emptyText: term ? 'No AWS icons match the search.' : 'No AWS icons loaded.',
            primaryTarget: null,
            showRemove: false,
        }));
    }

    host.appendChild(buildAvailableSection(cfg, term));
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
}

function buildTile(icon: IconCatalogEntry, tcfg: TileConfig): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'nr-admin__icon-tile-wrap';

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'nr-admin__icon-tile';
    tile.setAttribute('aria-label', `${icon.label} — ${tcfg.titleAction}`);
    tile.title = `${icon.label} — ${tcfg.titleAction}`;

    const thumb = document.createElement('span');
    thumb.className = 'nr-admin__icon-tile-thumb';
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
        remove.setAttribute('aria-label', `Remove ${icon.label} from picker`);
        remove.title = `Remove ${icon.label} from picker`;
        remove.textContent = '×';
        remove.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAndRerender(icon.id, 'none');
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
