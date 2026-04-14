import { dia } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { Frame } from './shapes';
import { META_KEY, NodeMeta } from './inspector';
import { GRID_SIZE } from './theme';
import { ShapeRegistry, BUILT_IN_SHAPE_IDS } from './shapes/shape-registry';
import { getPreviewFactory } from './shapes/shape-factories';
import { applyRegistryDefaults } from './utils';

// Carbon overflow-menu icon (3 vertical dots)
const ICON_OVERFLOW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="16" height="16" aria-hidden="true"><circle cx="16" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="16" cy="24" r="2"/></svg>`;
const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M8 11L3 6l.7-.7L8 9.6l4.3-4.3.7.7z"/></svg>`;

interface PaletteItem {
    label: string;
    kind: string;
    create: () => IsometricShape;
}

const CONTAINER_ITEMS: PaletteItem[] = [
    { label: 'Zone', kind: 'zone', create: () => new Frame() },
];

// Stagger new elements so they don't land on top of each other
const BASE_X = 60;
const BASE_Y = 60;
const STAGGER = GRID_SIZE * 3;
const STAGGER_COLS = 4;

export type OnCreatedCallback = (shape: IsometricShape) => void;
export type OnMenuClickCallback = (anchor: HTMLElement) => void;
export type OnTreeSelectCallback = (cellId: string) => void;

export class ComponentPalette {

    private el: HTMLElement;
    private graph: dia.Graph;
    private getView: () => View;
    private onCreated: OnCreatedCallback;
    private onMenuClick: OnMenuClickCallback;
    private onTreeSelect: OnTreeSelectCallback;
    private placeCount = 0;
    private listEl: HTMLElement;
    private elementTreeListEl: HTMLElement;
    private selectedTreeId: string | null = null;
    private treeItemEls = new Map<string, HTMLButtonElement>();

    constructor(
        el: HTMLElement,
        graph: dia.Graph,
        getView: () => View,
        onCreated: OnCreatedCallback,
        onMenuClick: OnMenuClickCallback,
        onTreeSelect: OnTreeSelectCallback
    ) {
        this.el = el;
        this.graph = graph;
        this.getView = getView;
        this.onCreated = onCreated;
        this.onMenuClick = onMenuClick;
        this.onTreeSelect = onTreeSelect;
        this.build();

        graph.on('add remove reset change:meta change:parent', () => this.refreshElementTree());
        document.addEventListener('nextrack:registry-changed', () => this.refresh());
    }

    /** Update tree selection highlight without triggering the onTreeSelect callback. */
    setTreeSelection(id: string | null) {
        if (this.selectedTreeId) {
            const prev = this.treeItemEls.get(this.selectedTreeId);
            if (prev) prev.classList.remove('nr-tree-item--selected');
        }
        this.selectedTreeId = id;
        if (id) {
            const el = this.treeItemEls.get(id);
            if (el) el.classList.add('nr-tree-item--selected');
        }
    }

    /** Rebuild only the component + container list when the registry changes. */
    refresh() {
        this.listEl.innerHTML = '';
        this.buildList();
    }

    /** Rebuild the element tree when the graph changes. */
    private refreshElementTree() {
        this.elementTreeListEl.innerHTML = '';
        this.treeItemEls.clear();
        this.buildElementTree();
        // Re-apply selection highlight if the element still exists
        if (this.selectedTreeId && this.treeItemEls.has(this.selectedTreeId)) {
            this.treeItemEls.get(this.selectedTreeId)!.classList.add('nr-tree-item--selected');
        } else {
            this.selectedTreeId = null;
        }
    }

    private build() {
        // Panel header: product name + overflow menu trigger
        const header = document.createElement('div');
        header.className = 'nr-panel-header';

        const title = document.createElement('span');
        title.className = 'nr-panel-title';
        title.textContent = 'System Designer';

        const menuBtn = document.createElement('button');
        menuBtn.className = 'cds--btn cds--btn--ghost cds--btn--icon-only nr-panel-menu-btn';
        menuBtn.type = 'button';
        menuBtn.setAttribute('aria-label', 'Menu');
        menuBtn.title = 'Menu';
        menuBtn.innerHTML = ICON_OVERFLOW;
        menuBtn.addEventListener('click', () => this.onMenuClick(menuBtn));

        header.appendChild(title);
        header.appendChild(menuBtn);
        this.el.appendChild(header);

        // Element Tree section (collapsible, max 35vh, sticky at top)
        this.elementTreeListEl = document.createElement('ul');
        this.elementTreeListEl.className = 'nr-palette-list';
        const treeSection = this.buildCollapsibleSection('Element Tree', this.elementTreeListEl, { bodyClass: 'nr-section-body--tree' });
        this.el.appendChild(treeSection);
        this.buildElementTree();

        // Components + Zoning sections (scrollable remainder)
        this.listEl = document.createElement('div');
        this.listEl.className = 'nr-palette-scrollable';
        this.el.appendChild(this.listEl);
        this.buildList();
    }

    /** Builds a collapsible section with a clickable header and chevron. */
    private buildCollapsibleSection(title: string, bodyContent: HTMLElement, options: { separator?: boolean; bodyClass?: string } = {}): HTMLElement {
        const section = document.createElement('div');
        section.className = 'nr-palette-section' + (options.separator ? ' nr-palette-section--separated' : '');

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

        const body = document.createElement('div');
        body.className = 'nr-section-body' + (options.bodyClass ? ' ' + options.bodyClass : '');
        body.appendChild(bodyContent);

        headerBtn.addEventListener('click', () => {
            const collapsed = section.classList.toggle('nr-palette-section--collapsed');
            headerBtn.setAttribute('aria-expanded', String(!collapsed));
        });

        section.appendChild(headerBtn);
        section.appendChild(body);
        return section;
    }

    private buildElementTree() {
        const allElements = this.graph.getElements();
        const frames = allElements.filter(e => e.get('isFrame')) as Frame[];
        const nonFrames = allElements.filter(e => !e.get('isFrame'));
        const assignedIds = new Set<string>();

        // 1. Zones with their embedded children
        for (const frame of frames) {
            const zoneLabel = (frame.attr('label/text') as string | undefined)?.trim() || 'Zone';
            const frameLi = document.createElement('li');
            const frameBtn = document.createElement('button');
            frameBtn.className = 'nr-tree-item nr-tree-item--zone';
            frameBtn.type = 'button';
            frameBtn.textContent = zoneLabel;
            frameBtn.title = zoneLabel;
            // Zones are not inspector targets; no click handler needed yet
            frameLi.appendChild(frameBtn);
            this.elementTreeListEl.appendChild(frameLi);

            const children = nonFrames.filter(e => e.getParentCell()?.id === frame.id);
            for (const child of children) {
                this.appendTreeItem(child, true);
                assignedIds.add(String(child.id));
            }
        }

        // 2. Unassigned elements at root level
        for (const cell of nonFrames.filter(e => !assignedIds.has(String(e.id)))) {
            this.appendTreeItem(cell, false);
        }

        if (this.elementTreeListEl.children.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'nr-tree-empty';
            empty.textContent = 'No elements';
            this.elementTreeListEl.appendChild(empty);
        }
    }

    private appendTreeItem(cell: dia.Element, indented: boolean) {
        const meta = cell.get('meta') as { name?: string; kind?: string } | undefined;
        const label = meta?.name?.trim()
            || (cell.attr('label/text') as string | undefined)
            || meta?.kind
            || 'Element';
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = indented ? 'nr-tree-item nr-tree-item--child' : 'nr-tree-item';
        btn.type = 'button';
        btn.textContent = label;
        btn.title = label;
        btn.addEventListener('click', () => this.onTreeSelect(String(cell.id)));
        li.appendChild(btn);
        this.elementTreeListEl.appendChild(li);
        this.treeItemEls.set(String(cell.id), btn);
    }

    private buildList() {
        const componentItems: PaletteItem[] = Object.entries(ShapeRegistry).filter(([id]) => !BUILT_IN_SHAPE_IDS.has(id)).map(([id, defaults]) => ({
            label: defaults.displayName ?? id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            kind: id,
            create: () => getPreviewFactory(id, defaults.baseShape ?? 'cuboid')(),
        }));

        this.listEl.appendChild(this.buildSection('Components', componentItems, false));
        this.listEl.appendChild(this.buildSection('Zoning', CONTAINER_ITEMS, true));
    }

    private buildSection(title: string, items: PaletteItem[], separator: boolean): HTMLElement {
        const list = document.createElement('ul');
        list.className = 'nr-palette-list';

        for (const item of items) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'nr-palette-item';
            btn.type = 'button';
            btn.textContent = item.label;
            btn.addEventListener('click', () => this.addToGraph(item));
            li.appendChild(btn);
            list.appendChild(li);
        }

        return this.buildCollapsibleSection(title, list, { separator });
    }

    private addToGraph(item: PaletteItem) {
        const col = this.placeCount % STAGGER_COLS;
        const row = Math.floor(this.placeCount / STAGGER_COLS);
        const x = BASE_X + col * STAGGER;
        const y = BASE_Y + row * STAGGER;
        this.placeCount++;

        const shape = item.create();
        const meta: NodeMeta = { name: '', kind: item.kind, vendor: '', model: '', notes: '' };

        // Apply all registry defaults (dimensions, label, colors, icon) in one call.
        const defaults = ShapeRegistry[item.kind];
        if (defaults) {
            applyRegistryDefaults(shape, defaults);
        }

        shape.position(x, y);
        shape.set(META_KEY, meta);
        shape.toggleView(this.getView());

        this.graph.addCell(shape);
        this.onCreated(shape);
    }
}
