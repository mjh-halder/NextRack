import { carbonIconToString, CarbonIcon } from './icons';
import Folder16 from '@carbon/icons/es/folder/16.js';
import CaretRight16 from '@carbon/icons/es/caret--right/16.js';
import Minimize16 from '@carbon/icons/es/minimize/16.js';
import Maximize16 from '@carbon/icons/es/maximize/16.js';
import SettingsAdjust16 from '@carbon/icons/es/settings--adjust/16.js';
import Add16 from '@carbon/icons/es/add/16.js';
import { listInventory } from './svg-inventory';

const ICON_FOLDER = carbonIconToString(Folder16 as CarbonIcon);
const ICON_CARET  = carbonIconToString(CaretRight16 as CarbonIcon);
const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`;

export interface ComponentTreeItem {
    id: string;
    label: string;
    iconSvg?: string;
    collection: string;
    data?: unknown;
}

export interface ComponentTreeConfig {
    items: ComponentTreeItem[];
    onSelect: (id: string, data?: unknown) => void;
    selectedId?: () => string | null;
    showCreateButton?: boolean;
    onCreateClick?: () => void;
}

export function formatLabel(id: string): string {
    return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

type ViewMode = 'list' | 'svg';
let viewMode: ViewMode = 'list';

export function buildComponentPanel(
    container: HTMLElement,
    config: ComponentTreeConfig,
): { rebuild: () => void } {
    const rebuild = () => renderPanel(container, config);
    rebuild();
    return { rebuild };
}

function renderPanel(container: HTMLElement, config: ComponentTreeConfig): void {
    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'nr-palette-comp-header';

    const title = document.createElement('span');
    title.className = 'nr-palette-comp-header__title';
    title.textContent = 'Components';
    header.appendChild(title);

    // Collapse/expand
    let allExpanded = true;
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'nr-palette-comp-header__icon-btn';
    collapseBtn.title = 'Collapse all';
    collapseBtn.setAttribute('aria-label', 'Collapse all');
    collapseBtn.innerHTML = carbonIconToString(Minimize16 as CarbonIcon);

    // View options
    const overflowBtn = document.createElement('button');
    overflowBtn.type = 'button';
    overflowBtn.className = 'nr-palette-comp-header__icon-btn';
    overflowBtn.title = 'View options';
    overflowBtn.setAttribute('aria-label', 'View options');
    overflowBtn.innerHTML = carbonIconToString(SettingsAdjust16 as CarbonIcon);

    header.appendChild(collapseBtn);
    header.appendChild(overflowBtn);

    if (config.showCreateButton && config.onCreateClick) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'nr-palette-comp-header__add-btn';
        addBtn.title = 'Create Component';
        addBtn.setAttribute('aria-label', 'Create Component');
        addBtn.innerHTML = carbonIconToString(Add16 as CarbonIcon);
        addBtn.addEventListener('click', config.onCreateClick);
        header.appendChild(addBtn);
    }

    container.appendChild(header);

    // Search
    const searchBox = document.createElement('div');
    searchBox.className = 'nr-palette-search';
    const searchIcon = document.createElement('span');
    searchIcon.className = 'nr-palette-search-icon';
    searchIcon.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M15 14.3L10.7 10c1.9-2.3 1.6-5.8-.7-7.7S4.2.7 2.3 3 .7 8.8 3 10.7c2 1.7 5 1.7 7 0l4.3 4.3.7-.7zM2 6.5C2 4 4 2 6.5 2S11 4 11 6.5 9 11 6.5 11 2 9 2 6.5z"/></svg>';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'nr-palette-search-input';
    searchInput.placeholder = 'Search components';
    searchInput.setAttribute('aria-label', 'Search components');
    searchBox.appendChild(searchIcon);
    searchBox.appendChild(searchInput);
    container.appendChild(searchBox);

    // Scroll area
    const scrollArea = document.createElement('div');
    scrollArea.className = 'nr-palette-scroll';

    const groups = groupByCollection(config.items);

    if (viewMode === 'svg') {
        buildSvgView(scrollArea, groups, config);
    } else {
        buildTreeView(scrollArea, groups, config);
    }

    container.appendChild(scrollArea);

    // Wire search
    searchInput.addEventListener('input', () => {
        filterTree(scrollArea, searchInput.value);
    });

    // Wire collapse/expand
    collapseBtn.addEventListener('click', () => {
        allExpanded = !allExpanded;
        scrollArea.querySelectorAll<HTMLElement>('.nr-comp-tree__node--folder, .nr-palette-section').forEach(el => {
            el.setAttribute('aria-expanded', String(allExpanded));
            el.classList.toggle('nr-palette-section--collapsed', !allExpanded);
        });
        collapseBtn.innerHTML = allExpanded
            ? carbonIconToString(Minimize16 as CarbonIcon)
            : carbonIconToString(Maximize16 as CarbonIcon);
        collapseBtn.title = allExpanded ? 'Collapse all' : 'Expand all';
    });

    // Wire view switcher
    overflowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const existing = document.querySelector('.nr-palette-ctx');
        if (existing) { existing.remove(); return; }

        const menu = document.createElement('div');
        menu.className = 'nr-palette-ctx';
        menu.setAttribute('role', 'menu');

        for (const mode of [
            { key: 'list' as const, label: 'Folder View' },
            { key: 'svg' as const, label: 'Tile View' },
        ]) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'nr-ctx-menu__item' + (viewMode === mode.key ? ' nr-ctx-menu__item--active' : '');
            item.setAttribute('role', 'menuitem');
            const label = document.createElement('span');
            label.className = 'nr-ctx-menu__label';
            label.textContent = mode.label;
            item.appendChild(label);
            item.addEventListener('click', () => {
                menu.remove();
                viewMode = mode.key;
                renderPanel(container, config);
            });
            menu.appendChild(item);
        }

        const rect = overflowBtn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = rect.left + 'px';
        menu.style.top = rect.bottom + 2 + 'px';
        document.body.appendChild(menu);

        const dismiss = (ev: MouseEvent) => {
            if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('mousedown', dismiss); }
        };
        setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
    });
}

// ── Data grouping ──

function groupByCollection(items: ComponentTreeItem[]): Map<string, ComponentTreeItem[]> {
    const groups = new Map<string, ComponentTreeItem[]>();
    for (const item of items) {
        let list = groups.get(item.collection);
        if (!list) { list = []; groups.set(item.collection, list); }
        list.push(item);
    }
    return groups;
}

function sortedCollections(groups: Map<string, ComponentTreeItem[]>): string[] {
    return Array.from(groups.keys()).sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        return a.localeCompare(b);
    });
}

// ── Tree view ──

function buildTreeView(
    scrollArea: HTMLElement,
    groups: Map<string, ComponentTreeItem[]>,
    config: ComponentTreeConfig,
): void {
    const tree = document.createElement('ul');
    tree.className = 'nr-comp-tree';
    tree.setAttribute('role', 'tree');

    const selectedId = config.selectedId?.() ?? null;

    for (const name of sortedCollections(groups)) {
        const items = groups.get(name)!;
        const leaves = items.map(item => buildLeaf(item, config.onSelect, selectedId));
        tree.appendChild(buildFolder(name, leaves));
    }

    scrollArea.appendChild(tree);
}

function buildFolder(name: string, children: HTMLElement[]): HTMLElement {
    const li = document.createElement('li');
    li.className = 'nr-comp-tree__node nr-comp-tree__node--folder';
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-expanded', 'true');

    const row = document.createElement('div');
    row.className = 'nr-comp-tree__row';

    const caretSpan = document.createElement('span');
    caretSpan.className = 'nr-comp-tree__caret';
    caretSpan.innerHTML = ICON_CARET;
    row.appendChild(caretSpan);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'nr-comp-tree__folder-icon';
    iconSpan.innerHTML = ICON_FOLDER;
    row.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'nr-comp-tree__label';
    labelSpan.textContent = name;
    row.appendChild(labelSpan);

    const countSpan = document.createElement('span');
    countSpan.className = 'nr-comp-tree__count';
    countSpan.textContent = String(children.length);
    row.appendChild(countSpan);

    li.appendChild(row);

    const childList = document.createElement('ul');
    childList.className = 'nr-comp-tree__children';
    childList.setAttribute('role', 'group');
    for (const child of children) childList.appendChild(child);
    li.appendChild(childList);

    row.addEventListener('click', () => {
        const expanded = li.getAttribute('aria-expanded') === 'true';
        li.setAttribute('aria-expanded', String(!expanded));
    });

    return li;
}

function buildLeaf(
    item: ComponentTreeItem,
    onSelect: (id: string, data?: unknown) => void,
    selectedId: string | null,
): HTMLElement {
    const li = document.createElement('li');
    li.className = 'nr-comp-tree__node nr-comp-tree__node--leaf';
    li.setAttribute('role', 'treeitem');

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'nr-comp-tree__row nr-comp-tree__row--leaf';
    if (item.id === selectedId) row.classList.add('nr-comp-tree__row--selected');
    row.dataset.shapeId = item.id;
    row.title = item.label;

    if (item.iconSvg) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'nr-palette-item-icon';
        iconSpan.innerHTML = item.iconSvg;
        iconSpan.setAttribute('aria-hidden', 'true');
        row.appendChild(iconSpan);
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'nr-comp-tree__label';
    labelSpan.textContent = item.label;
    row.appendChild(labelSpan);

    row.addEventListener('click', () => onSelect(item.id, item.data));

    li.appendChild(row);
    return li;
}

// ── SVG grid view ──

function buildSvgView(
    scrollArea: HTMLElement,
    groups: Map<string, ComponentTreeItem[]>,
    config: ComponentTreeConfig,
): void {
    const selectedId = config.selectedId?.() ?? null;

    for (const name of sortedCollections(groups)) {
        const items = groups.get(name)!;
        const grid = buildSvgGrid(items, config.onSelect, selectedId);
        scrollArea.appendChild(buildCollapsibleSection(name, grid, name !== sortedCollections(groups)[0]));
    }
}

function buildSvgGrid(
    items: ComponentTreeItem[],
    onSelect: (id: string, data?: unknown) => void,
    selectedId: string | null,
): HTMLElement {
    const inv = listInventory();
    const invMap = new Map(inv.map(e => [e.componentId, e]));
    const grid = document.createElement('div');
    grid.className = 'nr-palette-svg-grid';

    for (const item of items) {
        const entry = invMap.get(item.id);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'nr-palette-svg-card' + (item.id === selectedId ? ' nr-palette-svg-card--selected' : '');
        card.title = item.label;

        if (entry) {
            const lightWrap = document.createElement('div');
            lightWrap.className = 'nr-admin__inventory-svg--light';
            lightWrap.innerHTML = entry.svgLight ?? '';
            const darkWrap = document.createElement('div');
            darkWrap.className = 'nr-admin__inventory-svg--dark';
            darkWrap.innerHTML = entry.svgDark ?? entry.svgLight ?? '';
            card.appendChild(lightWrap);
            card.appendChild(darkWrap);
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'nr-palette-svg-card__placeholder';
            placeholder.textContent = item.label.charAt(0).toUpperCase();
            card.appendChild(placeholder);
        }

        card.dataset.shapeId = item.id;
        card.addEventListener('click', () => onSelect(item.id, item.data));
        grid.appendChild(card);
    }
    return grid;
}

function buildCollapsibleSection(title: string, body: HTMLElement, separator: boolean): HTMLElement {
    const section = document.createElement('div');
    section.className = 'nr-palette-section' + (separator ? ' nr-palette-section--separated' : '');

    const headerBtn = document.createElement('button');
    headerBtn.className = 'nr-section-header';
    headerBtn.type = 'button';
    headerBtn.setAttribute('aria-expanded', 'true');

    const labelSpan = document.createElement('span');
    labelSpan.textContent = title;

    const chevronSpan = document.createElement('span');
    chevronSpan.className = 'nr-section-chevron';
    chevronSpan.innerHTML = ICON_CHEVRON_DOWN;

    headerBtn.appendChild(labelSpan);
    headerBtn.appendChild(chevronSpan);

    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'nr-section-body';
    bodyWrapper.appendChild(body);

    headerBtn.addEventListener('click', () => {
        const collapsed = section.classList.toggle('nr-palette-section--collapsed');
        headerBtn.setAttribute('aria-expanded', String(!collapsed));
    });

    section.appendChild(headerBtn);
    section.appendChild(bodyWrapper);
    return section;
}

// ── Search filtering ──

export function filterTree(root: HTMLElement, term: string): void {
    const t = term.trim().toLowerCase();

    // Filter tree leaves
    root.querySelectorAll<HTMLElement>('.nr-comp-tree__node--leaf').forEach(leaf => {
        const lbl = leaf.querySelector<HTMLElement>('.nr-comp-tree__label')?.textContent ?? '';
        const match = !t || lbl.toLowerCase().includes(t);
        leaf.style.display = match ? '' : 'none';
    });

    // Auto-show/hide tree folders
    root.querySelectorAll<HTMLElement>('.nr-comp-tree__node--folder').forEach(folder => {
        let hasVisible = false;
        folder.querySelectorAll<HTMLElement>('.nr-comp-tree__node--leaf').forEach(c => {
            if (c.style.display !== 'none') hasVisible = true;
        });
        folder.style.display = hasVisible ? '' : 'none';
        if (t && hasVisible) folder.setAttribute('aria-expanded', 'true');
    });

    // Filter SVG cards
    root.querySelectorAll<HTMLElement>('.nr-palette-svg-card').forEach(card => {
        const name = (card.title || card.textContent || '').toLowerCase();
        const match = !t || name.includes(t);
        card.style.display = match ? '' : 'none';
    });

    // Auto-show/hide SVG grid sections
    root.querySelectorAll<HTMLElement>('.nr-palette-section').forEach(section => {
        const body = section.querySelector<HTMLElement>('.nr-section-body');
        if (!body) return;
        let visibleCount = 0;
        body.querySelectorAll<HTMLElement>('.nr-palette-svg-card').forEach(card => {
            if (card.style.display !== 'none') visibleCount++;
        });
        if (visibleCount === 0 && !section.querySelector('.nr-comp-tree')) {
            section.style.display = (!t || visibleCount > 0) ? '' : 'none';
        }
    });
}
