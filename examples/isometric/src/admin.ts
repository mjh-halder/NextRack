// Admin area: Carbon-style left side-nav with two views.
//   - Icon Configuration: three sections + search (general / complex-only / available pool).
//   - User Settings:      placeholder for now.
//
// Wiring: initAdmin() is called once from index.ts. show()/hide() are driven by
// the app-level view switcher in index.ts.

import { ICON_CATALOG, IconCatalogEntry, getIconById } from './icon-catalog';
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
import { ShapeRegistry, BUILT_IN_SHAPE_IDS, deleteShape, saveRegistryToStorage } from './shapes/shape-registry';
import { getServerShapes, publishShape, unpublishShape } from './server-shapes';

type AdminView = 'icon-config' | 'shape-registry' | 'user-settings';

let rootEl: HTMLDivElement | null = null;
let currentView: AdminView = 'icon-config';

// Search term is module-scoped so re-renders don't lose it.
let iconSearchTerm = '';

// Cap rendered results in the "Available" section: the full Carbon set is
// 2.5k+ icons and rendering them all would stall the main thread.
const AVAILABLE_MAX = 300;

const NAV_ITEMS: Array<{ id: AdminView; label: string }> = [
    { id: 'icon-config',    label: 'Icon Configuration' },
    { id: 'shape-registry', label: 'Shape Registry' },
    { id: 'user-settings',  label: 'User Settings' },
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

    const contentEl = rootEl.querySelector<HTMLDivElement>('.nr-admin__content');
    if (!contentEl) return;
    contentEl.innerHTML = '';
    if (view === 'icon-config')    renderIconConfig(contentEl);
    if (view === 'shape-registry') renderShapeRegistry(contentEl);
    if (view === 'user-settings')  renderUserSettings(contentEl);
}

function renderShapeRegistry(container: HTMLElement): void {
    const host = document.createElement('div');
    container.appendChild(host);

    const render = () => {
        host.innerHTML = '';
        buildLocalShapesSection(host, render);
        buildServerShapesSection(host, render);
    };
    render();
}

function buildShapeRow(
    id: string,
    def: import('./shapes/shape-registry').ShapeDefaults,
    actions: HTMLElement,
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

    const tdBase = document.createElement('td');
    tdBase.textContent = def.baseShape || '—';
    tr.appendChild(tdBase);

    const tdIcon = document.createElement('td');
    tdIcon.textContent = def.icon || '—';
    tdIcon.className = 'nr-admin__table-mono';
    tr.appendChild(tdIcon);

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

const SHAPE_TABLE_COLUMNS = ['', 'ID', 'Display Name', 'Base Shape', 'Icon', 'Size (W×H)', 'Depth', 'Complex', ''];

function buildTableHead(): HTMLTableSectionElement {
    const thead = document.createElement('thead');
    const row = document.createElement('tr');
    for (const col of SHAPE_TABLE_COLUMNS) {
        const th = document.createElement('th');
        th.textContent = col;
        row.appendChild(th);
    }
    thead.appendChild(row);
    return thead;
}

function buildLocalShapesSection(host: HTMLElement, rerender: () => void): void {
    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.textContent = 'Local Shapes';
    host.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent = 'Shapes stored in your browser. Publish them to the server to make them available to all users.';
    host.appendChild(desc);

    const serverIds = new Set(getServerShapes().map(e => e.id));

    const userShapes = Object.entries(ShapeRegistry).filter(
        ([id]) => !BUILT_IN_SHAPE_IDS.has(id)
    );

    if (userShapes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No user-defined shapes yet. Create shapes in the Component Designer.';
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

        const publishBtn = createActionBtn(
            ACTION_ICON_PUBLISH,
            serverIds.has(id) ? 'Update on server' : 'Publish to server',
            () => { publishShape(id, def); rerender(); },
        );
        actions.appendChild(publishBtn);

        const deleteBtn = createActionBtn(ACTION_ICON_DELETE, 'Delete', () => {
            if (!confirm(`Delete local shape "${def.displayName || id}"?`)) return;
            deleteShape(id);
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            rerender();
        }, true);
        actions.appendChild(deleteBtn);

        tbody.appendChild(buildShapeRow(id, def, actions));
    }

    table.appendChild(tbody);
    host.appendChild(table);
}

function buildServerShapesSection(host: HTMLElement, rerender: () => void): void {
    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.style.marginTop = '2rem';
    heading.textContent = 'Server Shapes';
    host.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent = 'Shapes published to the server. All users who open the application will see these shapes in their palette.';
    host.appendChild(desc);

    const serverShapes = getServerShapes();

    if (serverShapes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No shapes published to the server yet.';
        host.appendChild(empty);
        return;
    }

    const table = document.createElement('table');
    table.className = 'nr-admin__table';
    table.appendChild(buildTableHead());

    const tbody = document.createElement('tbody');
    for (const entry of serverShapes) {
        const actions = document.createElement('div');
        actions.className = 'nr-admin__table-action-group';

        const removeBtn = createActionBtn(ACTION_ICON_REMOVE, 'Remove from server', () => {
            if (!confirm(`Remove "${entry.defaults.displayName || entry.id}" from server?`)) return;
            unpublishShape(entry.id);
            rerender();
        }, true);
        actions.appendChild(removeBtn);

        tbody.appendChild(buildShapeRow(entry.id, entry.defaults, actions));
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

    // Sections host — re-rendered on search/toggle without rebuilding the search input.
    const sectionsHost = document.createElement('div');
    sectionsHost.className = 'nr-admin__sections';
    container.appendChild(sectionsHost);

    const renderSections = () => {
        sectionsHost.innerHTML = '';
        buildSections(sectionsHost);
    };

    // Debounce typing: re-render is O(n) on the full catalog, so avoid per-keystroke churn.
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
        cfg[i.id] === 'general' && matchesSearch(i, term)
    );
    const complexOnly = ICON_CATALOG.filter(i =>
        cfg[i.id] === 'complex-only' && matchesSearch(i, term)
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
    primaryTarget: IconScope;
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
        const targetLabel = cfg.primaryTarget === 'general'
            ? 'Move to General Component Icons'
            : 'Move to Additional Complex Shape Icons';
        grid.appendChild(buildTile(icon, {
            titleAction: targetLabel,
            onClick:     () => toggleAndRerender(icon.id, cfg.primaryTarget),
            showRemove:  cfg.showRemove,
        }));
    }

    section.appendChild(grid);
    return section;
}

interface TileConfig {
    titleAction: string;
    onClick:     () => void;
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

    tile.addEventListener('click', tcfg.onClick);
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
