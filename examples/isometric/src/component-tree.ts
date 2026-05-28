import { carbonIconToString, CarbonIcon } from './icons';
import Folder16 from '@carbon/icons/es/folder/16.js';
import FolderShared16 from '@carbon/icons/es/folder--shared/16.js';
import FolderAdd16 from '@carbon/icons/es/folder--add/16.js';
import Cube16 from '@carbon/icons/es/cube/16.js';
import CaretRight16 from '@carbon/icons/es/caret--right/16.js';
import Minimize16 from '@carbon/icons/es/minimize/16.js';
import Maximize16 from '@carbon/icons/es/maximize/16.js';
import SettingsAdjust16 from '@carbon/icons/es/settings--adjust/16.js';
import Add16 from '@carbon/icons/es/add/16.js';
import { listInventory } from './svg-inventory';

const ICON_FOLDER = carbonIconToString(Folder16 as CarbonIcon);
const ICON_FOLDER_SHARED = carbonIconToString(FolderShared16 as CarbonIcon);
const ICON_FOLDER_ADD = carbonIconToString(FolderAdd16 as CarbonIcon);
const ICON_CUBE = carbonIconToString(Cube16 as CarbonIcon);
const ICON_CARET  = carbonIconToString(CaretRight16 as CarbonIcon);

export const USER_CREATED_COLLECTION = 'User Created';

// Drag state for the user-folder D&D system. `undefined` means no qualifying
// drag is active (either no drag at all, or a drag of a non-user-generated
// shape — those cannot be moved into user folders). `null` means the source
// shape is top-level inside "User Created"; a string is the source folder id.
let dragSourceFolderId: string | null | undefined = undefined;
const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`;

export interface ComponentTreeItem {
    id: string;
    label: string;
    iconSvg?: string;
    /** Extra CSS class modifier from icon-renderer (e.g. `nr-icon-color`). */
    iconCssClass?: string;
    collection: string;
    /**
     * If set (and `collection === 'User Created'`), the item is nested
     * inside the user-created folder with this id. Top-level items inside
     * "User Created" leave this unset.
     */
    userFolderId?: string;
    data?: unknown;
}

export interface UserFolderDescriptor {
    id: string;
    name: string;
}

export interface ComponentTreeConfig {
    items: ComponentTreeItem[];
    onSelect: (id: string, data?: unknown) => void;
    selectedId?: () => string | null;
    showCreateButton?: boolean;
    /** Legacy single-action handler. Used only if `onCreateComponent` is not provided. */
    onCreateClick?: () => void;
    /** Plus-button dropdown "New Component". When provided, plus-button opens a menu. */
    onCreateComponent?: () => void;
    /** Plus-button dropdown "New Folder". */
    onCreateFolder?: () => void;
    /** User-created folders that live under "User Created". Includes empty ones. */
    userFolders?: UserFolderDescriptor[];
    /** Context-menu action: rename a user folder. */
    onRenameUserFolder?: (folderId: string) => void;
    /** Context-menu action: delete a user folder. */
    onDeleteUserFolder?: (folderId: string) => void;
    /**
     * Drag-and-drop: move a user-generated Shape into the target user folder,
     * or to top-level inside "User Created" when `folderId` is null.
     */
    onMoveShapeToUserFolder?: (shapeId: string, folderId: string | null) => void;
    hideSearch?: boolean;
}

export function formatLabel(id: string): string {
    return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

type ViewMode = 'list' | 'svg';
let viewMode: ViewMode = 'list';

export function setComponentViewMode(mode: 'list' | 'svg'): void {
    viewMode = mode;
}

export function getComponentViewMode(): 'list' | 'svg' {
    return viewMode;
}

export function buildComponentPanel(
    container: HTMLElement,
    config: ComponentTreeConfig,
): {
    rebuild: () => void;
    setSearchTerm: (term: string) => void;
    updateLabel: (shapeId: string, newLabel: string) => void;
} {
    let scrollAreaRef: HTMLElement | null = null;
    let searchInputRef: HTMLInputElement | null = null;

    const rebuild = () => {
        renderPanel(container, config);
        scrollAreaRef = container.querySelector('.nr-palette-scroll');
        searchInputRef = container.querySelector('.nr-palette-search-input');
    };
    rebuild();
    return {
        rebuild,
        setSearchTerm: (term: string) => {
            if (searchInputRef) searchInputRef.value = term;
            if (scrollAreaRef) filterTree(scrollAreaRef, term);
        },
        // Surgically update the displayed label for a specific shape's row
        // without rebuilding the whole tree. Used to mirror in-progress name
        // typing in the Component Designer to the palette tree in real time.
        // No persistence; the registry is only updated on Save as before.
        updateLabel: (shapeId: string, newLabel: string) => {
            const rows = container.querySelectorAll<HTMLElement>(`[data-shape-id="${CSS.escape(shapeId)}"]`);
            rows.forEach(row => {
                row.title = newLabel;
                const labelSpan = row.querySelector<HTMLElement>('.nr-comp-tree__label');
                if (labelSpan) labelSpan.textContent = newLabel;
                const placeholder = row.querySelector<HTMLElement>('.nr-palette-svg-card__placeholder');
                if (placeholder) placeholder.textContent = (newLabel || ' ').charAt(0).toUpperCase();
            });
        },
    };
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

    const hasDropdownCreate = config.showCreateButton && (config.onCreateComponent || config.onCreateFolder);
    if (hasDropdownCreate) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'nr-palette-comp-header__add-btn';
        addBtn.title = 'Add';
        addBtn.setAttribute('aria-label', 'Add');
        addBtn.innerHTML = carbonIconToString(Add16 as CarbonIcon);
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const existing = document.querySelector('.nr-palette-ctx');
            if (existing) { existing.remove(); return; }

            const menu = document.createElement('div');
            menu.className = 'nr-palette-ctx';
            menu.setAttribute('role', 'menu');

            const entries: Array<{ label: string; icon: string; handler?: () => void }> = [
                { label: 'New Component', icon: ICON_CUBE,       handler: config.onCreateComponent },
                { label: 'New Folder',    icon: ICON_FOLDER_ADD, handler: config.onCreateFolder },
            ];
            for (const entry of entries) {
                if (!entry.handler) continue;
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'nr-ctx-menu__item';
                item.setAttribute('role', 'menuitem');
                const iconSpan = document.createElement('span');
                iconSpan.className = 'nr-ctx-menu__icon';
                iconSpan.innerHTML = entry.icon;
                iconSpan.setAttribute('aria-hidden', 'true');
                const labelSpan = document.createElement('span');
                labelSpan.className = 'nr-ctx-menu__label';
                labelSpan.textContent = entry.label;
                item.appendChild(iconSpan);
                item.appendChild(labelSpan);
                item.addEventListener('click', () => { menu.remove(); entry.handler!(); });
                menu.appendChild(item);
            }

            const rect = addBtn.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.left = rect.left + 'px';
            menu.style.top = rect.bottom + 2 + 'px';
            document.body.appendChild(menu);

            const dismiss = (ev: MouseEvent) => {
                if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('mousedown', dismiss); }
            };
            setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
        });
        header.appendChild(addBtn);
    } else if (config.showCreateButton && config.onCreateClick) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'nr-palette-comp-header__add-btn';
        addBtn.title = 'Create Component';
        addBtn.setAttribute('aria-label', 'Create Component');
        addBtn.innerHTML = carbonIconToString(Add16 as CarbonIcon);
        addBtn.addEventListener('click', config.onCreateClick);
        header.appendChild(addBtn);
    }

    if (config.hideSearch) header.classList.add('nr-palette-comp-header--no-border');
    container.appendChild(header);

    // Search
    const searchBox = document.createElement('div');
    searchBox.className = 'nr-palette-search';
    if (config.hideSearch) searchBox.style.display = 'none';
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
    const priority = (k: string) => k === USER_CREATED_COLLECTION ? 0 : k === 'General' ? 1 : 2;
    return Array.from(groups.keys()).sort((a, b) => {
        const pa = priority(a), pb = priority(b);
        if (pa !== pb) return pa - pb;
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
    const userFolders = config.userFolders ?? [];

    // Make sure "User Created" renders even if there are no shapes yet but
    // the user has created folders (so the folders are visible / can receive
    // drops).
    const collectionNames = new Set(sortedCollections(groups));
    if (userFolders.length > 0) collectionNames.add(USER_CREATED_COLLECTION);
    const orderedNames = sortedCollections(new Map(Array.from(collectionNames).map(n => [n, groups.get(n) ?? []])));

    for (const name of orderedNames) {
        const items = groups.get(name) ?? [];
        if (name === USER_CREATED_COLLECTION) {
            tree.appendChild(buildUserGeneratedFolder(items, userFolders, config, selectedId));
        } else {
            const leaves = items.map(item => buildLeaf(item, config.onSelect, selectedId));
            tree.appendChild(buildFolder(name, leaves, { folderKind: 'system' }));
        }
    }

    scrollArea.appendChild(tree);
}

interface BuildFolderOpts {
    folderKind: 'system' | 'user' | 'user-generated';
    folderId?: string;
    config?: ComponentTreeConfig;
}

function buildFolder(name: string, children: HTMLElement[], opts: BuildFolderOpts): HTMLElement {
    const li = document.createElement('li');
    li.className = 'nr-comp-tree__node nr-comp-tree__node--folder';
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-expanded', 'true');
    li.dataset.folderKind = opts.folderKind;
    if (opts.folderId) li.dataset.folderId = opts.folderId;

    const row = document.createElement('div');
    row.className = 'nr-comp-tree__row';

    const caretSpan = document.createElement('span');
    caretSpan.className = 'nr-comp-tree__caret';
    caretSpan.innerHTML = ICON_CARET;
    row.appendChild(caretSpan);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'nr-comp-tree__folder-icon';
    iconSpan.innerHTML = opts.folderKind === 'user' ? ICON_FOLDER_SHARED : ICON_FOLDER;
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

    // Drop target: user folders accept user-generated shapes (move into folder).
    // The "User Created" root accepts drops to move a shape back to top-level.
    if (opts.config?.onMoveShapeToUserFolder && (opts.folderKind === 'user' || opts.folderKind === 'user-generated')) {
        const targetFolderId = opts.folderKind === 'user' ? (opts.folderId ?? null) : null;
        attachUserFolderDropTarget(li, targetFolderId, opts.config.onMoveShapeToUserFolder);
    }

    // Context menu on user folders: Rename / Delete.
    if (opts.folderKind === 'user' && opts.folderId && opts.config) {
        const folderId = opts.folderId;
        const cfg = opts.config;
        row.addEventListener('contextmenu', (e: MouseEvent) => {
            if (!cfg.onRenameUserFolder && !cfg.onDeleteUserFolder) return;
            e.preventDefault();
            e.stopPropagation();
            openUserFolderContextMenu(e.clientX, e.clientY, folderId, cfg);
        });
    }

    return li;
}

function buildUserGeneratedFolder(
    items: ComponentTreeItem[],
    userFolders: UserFolderDescriptor[],
    config: ComponentTreeConfig,
    selectedId: string | null,
): HTMLElement {
    // Split items: those inside a user folder vs. top-level.
    const byFolder = new Map<string, ComponentTreeItem[]>();
    const topLevel: ComponentTreeItem[] = [];
    for (const item of items) {
        if (item.userFolderId) {
            let list = byFolder.get(item.userFolderId);
            if (!list) { list = []; byFolder.set(item.userFolderId, list); }
            list.push(item);
        } else {
            topLevel.push(item);
        }
    }

    // Children: user folders first (alphabetically), then top-level shapes.
    const children: HTMLElement[] = [];
    const sortedFolders = [...userFolders].sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of sortedFolders) {
        const folderItems = byFolder.get(folder.id) ?? [];
        const leaves = folderItems.map(item => buildLeaf(item, config.onSelect, selectedId));
        children.push(buildFolder(folder.name, leaves, {
            folderKind: 'user',
            folderId: folder.id,
            config,
        }));
    }
    for (const item of topLevel) {
        children.push(buildLeaf(item, config.onSelect, selectedId));
    }

    return buildFolder(USER_CREATED_COLLECTION, children, {
        folderKind: 'user-generated',
        config,
    });
}

function attachUserFolderDropTarget(
    el: HTMLElement,
    targetFolderId: string | null,
    onMove: (shapeId: string, folderId: string | null) => void,
): void {
    // A move is a no-op (and should not highlight) when the source shape
    // already lives in this exact target — or when the active drag is not a
    // user-generated shape at all.
    const isNoOp = () =>
        dragSourceFolderId === undefined || dragSourceFolderId === targetFolderId;

    el.addEventListener('dragover', (e: DragEvent) => {
        if (!e.dataTransfer) return;
        const types = Array.from(e.dataTransfer.types || []);
        if (!types.includes('application/x-nextrack-shape')) return;
        if (isNoOp()) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        // Only one node may be highlighted at a time — drop nested-folder
        // bubbling artefacts (e.g. "User Created" + the inner user folder
        // simultaneously) by clearing all other highlighted nodes first.
        document.querySelectorAll('.nr-comp-tree__node--drop-target').forEach(n => {
            if (n !== el) n.classList.remove('nr-comp-tree__node--drop-target');
        });
        el.classList.add('nr-comp-tree__node--drop-target');
    });
    el.addEventListener('dragleave', (e: DragEvent) => {
        // Only clear when leaving the element entirely (not just moving to a child).
        if (!el.contains(e.relatedTarget as Node)) {
            el.classList.remove('nr-comp-tree__node--drop-target');
        }
    });
    el.addEventListener('drop', (e: DragEvent) => {
        if (!e.dataTransfer) return;
        const shapeId = e.dataTransfer.getData('application/x-nextrack-shape');
        if (!shapeId) return;
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('nr-comp-tree__node--drop-target');
        if (isNoOp()) return;
        onMove(shapeId, targetFolderId);
    });
}

function openUserFolderContextMenu(
    x: number, y: number, folderId: string, config: ComponentTreeConfig,
): void {
    const existing = document.querySelector('.nr-palette-ctx');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'nr-palette-ctx';
    menu.setAttribute('role', 'menu');

    const entries: Array<{ label: string; handler?: (id: string) => void; danger?: boolean }> = [
        { label: 'Rename', handler: config.onRenameUserFolder },
        { label: 'Delete', handler: config.onDeleteUserFolder, danger: true },
    ];
    for (const entry of entries) {
        if (!entry.handler) continue;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'nr-ctx-menu__item' + (entry.danger ? ' nr-ctx-menu__item--danger' : '');
        item.setAttribute('role', 'menuitem');
        const labelSpan = document.createElement('span');
        labelSpan.className = 'nr-ctx-menu__label';
        labelSpan.textContent = entry.label;
        item.appendChild(labelSpan);
        item.addEventListener('click', () => { menu.remove(); entry.handler!(folderId); });
        menu.appendChild(item);
    }

    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);

    const dismiss = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('mousedown', dismiss); }
    };
    setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
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
        iconSpan.className = 'nr-palette-item-icon' + (item.iconCssClass ? ' ' + item.iconCssClass : '');
        iconSpan.innerHTML = item.iconSvg;
        iconSpan.setAttribute('aria-hidden', 'true');
        row.appendChild(iconSpan);
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'nr-comp-tree__label';
    labelSpan.textContent = item.label;
    row.appendChild(labelSpan);

    row.addEventListener('click', () => onSelect(item.id, item.data));

    row.draggable = true;
    row.addEventListener('dragstart', (e: DragEvent) => {
        if (!e.dataTransfer) return;
        e.stopPropagation();
        e.dataTransfer.setData('application/x-nextrack-shape', item.id);
        e.dataTransfer.setData('text/plain', item.label);
        e.dataTransfer.effectAllowed = 'copyMove';
        // Track where the dragged shape currently lives so drop targets can
        // skip themselves on no-op moves.
        if (item.collection === USER_CREATED_COLLECTION) {
            dragSourceFolderId = item.userFolderId ?? null;
        } else {
            dragSourceFolderId = undefined;
        }
    });
    row.addEventListener('dragend', () => {
        dragSourceFolderId = undefined;
        document.querySelectorAll('.nr-comp-tree__node--drop-target').forEach(n => {
            n.classList.remove('nr-comp-tree__node--drop-target');
        });
    });

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

        card.draggable = true;
        card.addEventListener('dragstart', (e: DragEvent) => {
            if (!e.dataTransfer) return;
            e.stopPropagation();
            e.dataTransfer.setData('application/x-nextrack-shape', item.id);
            e.dataTransfer.setData('text/plain', item.label);
            e.dataTransfer.effectAllowed = 'copyMove';
        });

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

    // Show/hide empty message
    let existing = root.querySelector('.nr-palette-empty-msg');
    let anyVisible = false;
    root.querySelectorAll<HTMLElement>('.nr-comp-tree__node--leaf, .nr-palette-svg-card').forEach(el => {
        if (el.style.display !== 'none') anyVisible = true;
    });
    if (t && !anyVisible) {
        if (!existing) {
            existing = document.createElement('div');
            existing.className = 'nr-palette-empty-msg';
            existing.textContent = 'No results';
            root.appendChild(existing);
        }
        (existing as HTMLElement).style.display = '';
    } else if (existing) {
        (existing as HTMLElement).style.display = 'none';
    }
}
