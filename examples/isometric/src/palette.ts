import { dia } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { Frame } from './shapes';
import { ComplexComponent } from './shapes/complex-component';
import { META_KEY, NodeMeta } from './inspector';
import { GRID_SIZE } from './theme';
import { ShapeRegistry, BUILT_IN_SHAPE_IDS } from './shapes/shape-registry';
import { getPreviewFactory } from './shapes/shape-factories';
import { applyRegistryDefaults } from './utils';
import { carbonIconToString, CarbonIcon } from './icons';
import ChevronDown16 from '@carbon/icons/es/chevron--down/16.js';
import CaretRight16 from '@carbon/icons/es/caret--right/16.js';
import Area16 from '@carbon/icons/es/area/16.js';
import { getIconById } from './icon-catalog';

const ICON_CHEVRON_DOWN = carbonIconToString(ChevronDown16 as CarbonIcon);
// Tree toggle — filled right-pointing triangle.
// CSS rotates it 90° clockwise when aria-expanded="true" so it points downward.
const ICON_TREE_TOGGLE = carbonIconToString(CaretRight16 as CarbonIcon);
// Carbon "Area" icon used for zones in the element tree.
const ICON_TREE_ZONE = carbonIconToString(Area16 as CarbonIcon);

interface PaletteItem {
    label: string;
    kind: string;
    create: () => IsometricShape;
    /** Optional raw SVG markup rendered as a leading icon. */
    iconSvg?: string;
}

const CONTAINER_ITEMS: PaletteItem[] = [
    { label: 'Zone', kind: 'zone', create: () => new Frame(), iconSvg: ICON_TREE_ZONE },
];

// Stagger new elements so they don't land on top of each other
const BASE_X = 60;
const BASE_Y = 60;
const STAGGER = GRID_SIZE * 3;
const STAGGER_COLS = 4;

export type OnCreatedCallback = (shape: IsometricShape) => void;
export type OnTreeSelectCallback = (cellId: string) => void;

export class ComponentPalette {

    private el: HTMLElement;
    private graph: dia.Graph;
    private getView: () => View;
    private onCreated: OnCreatedCallback;
    private onTreeSelect: OnTreeSelectCallback;
    private placeCount = 0;
    private listEl: HTMLElement;
    private elementTreeListEl: HTMLUListElement;
    private selectedTreeId: string | null = null;
    private treeItemEls = new Map<string, HTMLLIElement>();

    constructor(
        el: HTMLElement,
        graph: dia.Graph,
        getView: () => View,
        onCreated: OnCreatedCallback,
        onTreeSelect: OnTreeSelectCallback
    ) {
        this.el = el;
        this.graph = graph;
        this.getView = getView;
        this.onCreated = onCreated;
        this.onTreeSelect = onTreeSelect;
        this.build();

        graph.on('add remove reset change:meta change:parent', () => this.refreshElementTree());
        document.addEventListener('nextrack:registry-changed', () => this.refresh());
    }

    /** Update tree selection highlight without triggering the onTreeSelect callback. */
    setTreeSelection(id: string | null) {
        if (this.selectedTreeId) {
            const prev = this.treeItemEls.get(this.selectedTreeId);
            if (prev) prev.classList.remove('nr-tree-element--selected');
        }
        this.selectedTreeId = id;
        if (id) {
            const el = this.treeItemEls.get(id);
            if (el) el.classList.add('nr-tree-element--selected');
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
            this.treeItemEls.get(this.selectedTreeId)!.classList.add('nr-tree-element--selected');
        } else {
            this.selectedTreeId = null;
        }
    }

    private build() {
        // Panel header: product name
        const header = document.createElement('div');
        header.className = 'nr-panel-header';

        const title = document.createElement('span');
        title.className = 'nr-panel-title';
        title.textContent = 'System Designer';

        header.appendChild(title);
        this.el.appendChild(header);

        // Element Tree section (collapsible, max 35vh, sticky at top)
        this.elementTreeListEl = document.createElement('ul');
        this.elementTreeListEl.className = 'nr-tree';
        this.elementTreeListEl.setAttribute('role', 'tree');
        this.elementTreeListEl.setAttribute('aria-label', 'Element Tree');
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

        // Root-level frames: frames with no parent frame
        const rootFrames = allElements.filter(
            e => e.get('isFrame') && !e.getParentCell()?.get('isFrame')
        ) as Frame[];

        // Root-level non-frame elements: not embedded inside any frame, and
        // not the internal child layers of a complex component.
        const rootElements = allElements.filter(
            e => !e.get('isFrame')
                && e.get('componentRole') !== 'child'
                && !e.getParentCell()?.get('isFrame')
        );

        for (const frame of rootFrames) {
            this.appendZoneNode(frame, this.elementTreeListEl);
        }
        for (const cell of rootElements) {
            this.appendTreeItem(cell, this.elementTreeListEl);
        }

        if (this.elementTreeListEl.children.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'nr-tree-empty';
            empty.textContent = 'No elements';
            this.elementTreeListEl.appendChild(empty);
        }
    }

    /** Recursively builds a tree zone node for a frame and its children. */
    private appendZoneNode(frame: Frame, parentUl: HTMLUListElement) {
        const zoneLabel = (frame.attr('label/text') as string | undefined)?.trim() || 'Zone';
        const embeds = frame.getEmbeddedCells();
        const childFrames = embeds.filter(e => e.get('isFrame')) as Frame[];
        const childElements = embeds.filter(
            e => !e.get('isFrame') && !e.isLink() && e.get('componentRole') !== 'child'
        ) as dia.Element[];

        const li = document.createElement('li');
        li.className = 'nr-tree-zone';
        li.setAttribute('role', 'treeitem');
        li.setAttribute('aria-expanded', 'true');

        const row = document.createElement('div');
        row.className = 'nr-tree-row';

        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'nr-tree-toggle';
        toggleSpan.innerHTML = ICON_TREE_TOGGLE;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'nr-tree-label';
        labelSpan.textContent = zoneLabel;
        labelSpan.title = zoneLabel;

        row.appendChild(toggleSpan);
        row.appendChild(labelSpan);
        li.appendChild(row);

        const childrenUl = document.createElement('ul');
        childrenUl.className = 'nr-tree-children';
        childrenUl.setAttribute('role', 'group');

        for (const childFrame of childFrames) {
            this.appendZoneNode(childFrame, childrenUl);
        }
        for (const child of childElements) {
            this.appendTreeItem(child, childrenUl);
        }

        li.appendChild(childrenUl);

        row.addEventListener('click', () => {
            const expanded = li.getAttribute('aria-expanded') === 'true';
            li.setAttribute('aria-expanded', String(!expanded));
            childrenUl.style.display = expanded ? 'none' : '';
        });

        parentUl.appendChild(li);
    }

    private appendTreeItem(cell: dia.Element, parentUl: HTMLUListElement) {
        const meta = cell.get('meta') as { name?: string; kind?: string } | undefined;
        const label = meta?.name?.trim()
            || (cell.attr('label/text') as string | undefined)
            || meta?.kind
            || 'Element';
        // Tree shows the raw catalog icon (no composite background) for a
        // cleaner, Carbon-style list appearance.
        const iconId = meta?.kind ? ShapeRegistry[meta.kind]?.icon : undefined;
        const iconSvg = iconId ? getIconById(iconId)?.svg : undefined;

        const li = document.createElement('li');
        li.className = 'nr-tree-element';
        li.setAttribute('role', 'treeitem');

        const row = document.createElement('div');
        row.className = 'nr-tree-row';

        if (iconSvg) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'nr-tree-icon';
            iconSpan.innerHTML = iconSvg;
            iconSpan.setAttribute('aria-hidden', 'true');
            row.appendChild(iconSpan);
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = 'nr-tree-label';
        labelSpan.textContent = label;
        labelSpan.title = label;

        row.appendChild(labelSpan);
        li.appendChild(row);

        row.addEventListener('click', () => this.onTreeSelect(String(cell.id)));

        parentUl.appendChild(li);
        this.treeItemEls.set(String(cell.id), li);
    }

    private buildList() {
        const componentItems: PaletteItem[] = Object.entries(ShapeRegistry).filter(([id]) => !BUILT_IN_SHAPE_IDS.has(id)).map(([id, defaults]) => ({
            label: defaults.displayName ?? id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            kind: id,
            create: () => getPreviewFactory(id, defaults.baseShape ?? 'cuboid')(),
            iconSvg: defaults.icon ? getIconById(defaults.icon)?.svg : undefined,
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

            if (item.iconSvg) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'nr-palette-item-icon';
                iconSpan.innerHTML = item.iconSvg;
                iconSpan.setAttribute('aria-hidden', 'true');
                btn.appendChild(iconSpan);
            }

            const labelSpan = document.createElement('span');
            labelSpan.className = 'nr-palette-item-label';
            labelSpan.textContent = item.label;
            btn.appendChild(labelSpan);

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

        const defaults = ShapeRegistry[item.kind];
        const view = this.getView();
        const meta: NodeMeta = { name: '', kind: item.kind, vendor: '', model: '', notes: '' };

        // Complex shape: one cell (ComplexComponent) that renders all layers
        // internally. One bbox, one z, one drag target — no embedding, no
        // sibling-layer painter ambiguity.
        if (defaults?.complexShape && defaults.layers?.length) {
            const baseLayer = defaults.layers[0];
            const cc = new ComplexComponent();
            cc.resize(baseLayer.width, baseLayer.height);
            cc.set('isometricHeight',        baseLayer.depth);
            cc.set('defaultIsometricHeight', baseLayer.depth);
            cc.set('defaultSize',            { width: baseLayer.width, height: baseLayer.height });
            // Copy the layer definitions into the cell — deep-clone so edits to
            // the registry later don't mutate placed instances.
            cc.set('layers', defaults.layers.map(l => ({ ...l, style: { ...l.style } })));

            cc.position(x, y);
            cc.set(META_KEY, meta);

            // Label — standard attr pipeline.
            const displayLabel = defaults.displayName && !meta.name.trim()
                ? defaults.displayName : '';
            if (displayLabel) cc.attr('label/text', displayLabel);

            // Icon — stored as model attrs; the view renders it imperatively on
            // Layer 0 using the actual layer geometry (respects offsetX/offsetY/
            // baseElevation), which avoids the "floats next to the shape" issue
            // that the generic applyRegistryDefaults formula causes for layers
            // with non-zero offsets.
            if (defaults.iconHref) {
                cc.set('iconHref', defaults.iconHref);
                cc.set('iconSize', (defaults.iconSize ?? 1) * GRID_SIZE);
                cc.set('iconFace', defaults.iconFace ?? 'top');
                cc.set('iconLayerIndex', defaults.iconLayerIndex ?? 0);
            }

            cc.toggleView(view);
            this.graph.addCell(cc);
            this.onCreated(cc);
            return;
        }

        // Simple shape (unchanged).
        const shape = item.create();
        if (defaults) {
            applyRegistryDefaults(shape, defaults);
        }
        shape.position(x, y);
        shape.set(META_KEY, meta);
        shape.toggleView(view);

        this.graph.addCell(shape);
        this.onCreated(shape);
    }
}
