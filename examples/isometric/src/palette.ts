import { dia } from '@joint/core';
import { View } from './shapes/isometric-shape';
import IsometricShape from './shapes/nextrack-isometric-shape';
import { Frame, Area, DoubleArrow, GridLabel, Icon } from './shapes';
import { ComplexComponent } from './shapes/complex-component';
import { META_KEY, NodeMeta } from './inspector';
import { GRID_SIZE } from './nextrack-theme';
import { ShapeRegistry, BUILT_IN_SHAPE_IDS } from './shapes/shape-registry';
import './shape-store';
import { getPreviewFactory } from './shapes/shape-factories';
import { applyRegistryDefaults } from './nextrack-utils';
import { getPaletteIcon, getHitArea, getCompositeIsoHeight } from './shape-query';
import { carbonIconToString, CarbonIcon } from './icons';
import ChevronDown16 from '@carbon/icons/es/chevron--down/16.js';
import CaretRight16 from '@carbon/icons/es/caret--right/16.js';
import Area16 from '@carbon/icons/es/area/16.js';
import AreaCustom16 from '@carbon/icons/es/area--custom/16.js';
import ArrowsHorizontal16 from '@carbon/icons/es/arrows--horizontal/16.js';
import TextShortParagraph16 from '@carbon/icons/es/text--short-paragraph/16.js';
import Svg16 from '@carbon/icons/es/SVG/16.js';
import Search16 from '@carbon/icons/es/search/16.js';
import DragVertical16 from '@carbon/icons/es/drag--vertical/16.js';
import Add16 from '@carbon/icons/es/add/16.js';
import Minimize16 from '@carbon/icons/es/minimize/16.js';
import Maximize16 from '@carbon/icons/es/maximize/16.js';
import SettingsAdjust16 from '@carbon/icons/es/settings--adjust/16.js';
import SubVolume16 from '@carbon/icons/es/watson-health/sub-volume/16.js';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import { onCatalogChange } from './icon-catalog';
import { renderIcon } from './icon-renderer';
import { buildComponentPanel, formatLabel, ComponentTreeItem, setComponentViewMode, getComponentViewMode } from './component-tree';
import { listCanvases, CanvasRecord } from './canvas-store';

const ICON_ADD = carbonIconToString(Add16 as CarbonIcon);
const ICON_CANVAS = carbonIconToString(SubVolume16 as CarbonIcon);
const ICON_TRASH = carbonIconToString(TrashCan16 as CarbonIcon);

const ICON_CHEVRON_DOWN = carbonIconToString(ChevronDown16 as CarbonIcon);
// Tree toggle — filled right-pointing triangle.
// CSS rotates it 90° clockwise when aria-expanded="true" so it points downward.
const ICON_TREE_TOGGLE = carbonIconToString(CaretRight16 as CarbonIcon);
// Carbon "Area" icon used for zones in the element tree.
const ICON_TREE_ZONE = carbonIconToString(Area16 as CarbonIcon);
// Carbon "Search" icon used inside the palette search inputs.
const ICON_SEARCH = carbonIconToString(Search16 as CarbonIcon);
// Carbon "Drag Vertical" icon shown as a drag handle on zone rows.
const ICON_DRAG_VERTICAL = carbonIconToString(DragVertical16 as CarbonIcon);

interface PaletteItem {
    label: string;
    kind: string;
    create: () => IsometricShape;
    /** SVG markup to render in the palette/tree row. Resolved at item-build
     *  time via icon-renderer.renderIcon() — contains the original (possibly
     *  color-bearing) catalog SVG. */
    iconSvg?: string;
    /** Extra CSS class for the icon container (e.g. `nr-icon-color`).
     *  Comes from icon-renderer; opts vendor / uploaded icons out of the
     *  default `filter: brightness(0)` so they keep their original colors. */
    iconCssClass?: string;
}

const ICON_AREA_CUSTOM = carbonIconToString(AreaCustom16 as CarbonIcon);
const ICON_DOUBLE_ARROW = carbonIconToString(ArrowsHorizontal16 as CarbonIcon);
const ICON_TEXT_LABEL = carbonIconToString(TextShortParagraph16 as CarbonIcon);
const ICON_SVG = carbonIconToString(Svg16 as CarbonIcon);

const CONTAINER_ITEMS: PaletteItem[] = [
    { label: 'Zone', kind: 'zone', create: () => new Frame(), iconSvg: ICON_TREE_ZONE },
];

const DESIGN_ITEMS: PaletteItem[] = [
    { label: 'Area', kind: 'area', create: () => new Area(), iconSvg: ICON_AREA_CUSTOM },
    { label: 'Double Arrow', kind: 'double-arrow', create: () => new DoubleArrow(), iconSvg: ICON_DOUBLE_ARROW },
    { label: 'Label', kind: 'grid-label', create: () => new GridLabel(), iconSvg: ICON_TEXT_LABEL },
    { label: 'Icon', kind: 'icon', create: () => new Icon(), iconSvg: ICON_SVG },
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
    private getViewportCenter: (() => { x: number; y: number }) | null = null;
    private onCreated: OnCreatedCallback;
    private onTreeSelect: OnTreeSelectCallback;
    private placeCount = 0;
    private listEl: HTMLElement;
    private elementTreeListEl: HTMLUListElement;
    private selectedTreeId: string | null = null;
    private treeItemEls = new Map<string, HTMLLIElement>();
    private treeViewport: HTMLDivElement | null = null;
    // Drag-and-drop state for element-tree reordering.
    private dragCellId: string | null = null;
    // Search filter state.
    private treeSearchTerm = '';
    private componentSearchTerm = '';
    // Callback fired when a zone should be highlighted in the canvas during
    // element-tree drag-drop (zoneId = highlight, null = clear).
    private onZoneDropHighlight: ((zoneId: string | null) => void) | null = null;
    private treeCollapseBtn: HTMLButtonElement | null = null;
    private getActiveZone: (() => Frame | null) | null = null;
    private onTreeContextMenu: ((cellId: string, clientX: number, clientY: number) => void) | null = null;
    private onCanvasSwitch: ((id: string) => void) | null = null;
    private onCanvasCreate: (() => void) | null = null;
    private onCanvasDelete: ((id: string) => void) | null = null;
    private canvasPickerBtn: HTMLButtonElement | null = null;
    private canvasLabelEl: HTMLSpanElement | null = null;
    private activeCanvasId = '';
    private componentPanelHandle: { rebuild: () => void; setSearchTerm: (term: string) => void } | null = null;
    private componentPanelEl: HTMLDivElement | null = null;

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

        graph.on('add remove reset change:meta change:parent change:z', () => this.refreshElementTree());
        document.addEventListener('nextrack:registry-changed', () => this.refresh());
        onCatalogChange(() => { this.refresh(); this.refreshElementTree(); });
    }

    /** Update tree selection highlight without triggering the onTreeSelect callback.
     *  Also scrolls the tree viewport so the selected item is visible. */
    setTreeSelection(id: string | null) {
        this.clearTreeSelection();
        this.selectedTreeId = id;
        if (id) {
            const el = this.treeItemEls.get(id);
            if (el) {
                el.classList.add('nr-tree-element--selected');
                this.scrollTreeToItem(el);
            }
        }
    }

    setTreeMultiSelection(ids: string[]) {
        this.clearTreeSelection();
        this.selectedTreeId = ids[0] || null;
        for (const id of ids) {
            const el = this.treeItemEls.get(id);
            if (el) el.classList.add('nr-tree-element--selected');
        }
    }

    private clearTreeSelection() {
        this.treeItemEls.forEach(el => el.classList.remove('nr-tree-element--selected'));
        this.selectedTreeId = null;
    }

    /** Register a callback invoked when an element-tree drag-drop operation
     *  wants to highlight (or clear) a target zone on the canvas. */
    setZoneDropHighlightCallback(cb: (zoneId: string | null) => void): void {
        this.onZoneDropHighlight = cb;
    }

    setActiveZoneGetter(fn: () => Frame | null): void {
        this.getActiveZone = fn;
    }

    setViewportCenterCallback(cb: () => { x: number; y: number }): void {
        this.getViewportCenter = cb;
    }

    setTreeContextMenuCallback(cb: (cellId: string, clientX: number, clientY: number) => void): void {
        this.onTreeContextMenu = cb;
    }

    setCanvasCallbacks(
        onSwitch: (id: string) => void,
        onCreate: () => void,
        onDelete: (id: string) => void,
    ): void {
        this.onCanvasSwitch = onSwitch;
        this.onCanvasCreate = onCreate;
        this.onCanvasDelete = onDelete;
    }

    private toggleCanvasPopover(): void {
        const existing = this.el.querySelector('.nr-canvas-popover');
        if (existing) { existing.remove(); this.canvasPickerBtn?.setAttribute('aria-expanded', 'false'); return; }

        const popover = document.createElement('div');
        popover.className = 'nr-canvas-popover';
        popover.setAttribute('role', 'listbox');

        for (const c of listCanvases()) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'nr-canvas-popover-item';
            if (c.id === this.activeCanvasId) item.classList.add('nr-canvas-popover-item--selected');
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(c.id === this.activeCanvasId));

            const icon = document.createElement('span');
            icon.className = 'nr-tree-icon';
            icon.innerHTML = ICON_CANVAS;
            item.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'nr-tree-label';
            label.textContent = c.name;
            item.appendChild(label);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'nr-canvas-popover-delete';
            deleteBtn.title = `Delete ${c.name}`;
            deleteBtn.setAttribute('aria-label', `Delete ${c.name}`);
            deleteBtn.innerHTML = ICON_TRASH;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popover.remove();
                this.canvasPickerBtn?.setAttribute('aria-expanded', 'false');
                this.onCanvasDelete?.(c.id);
            });
            item.appendChild(deleteBtn);

            item.addEventListener('click', () => {
                popover.remove();
                this.canvasPickerBtn?.setAttribute('aria-expanded', 'false');
                if (c.id !== this.activeCanvasId) {
                    this.activeCanvasId = c.id;
                    if (this.canvasLabelEl) this.canvasLabelEl.textContent = c.name;
                    this.onCanvasSwitch?.(c.id);
                }
            });
            popover.appendChild(item);
        }

        // Position below the picker button
        this.canvasPickerBtn?.setAttribute('aria-expanded', 'true');
        this.canvasPickerBtn?.after(popover);

        // Close on click outside
        const closeOnOutside = (e: MouseEvent) => {
            if (!popover.contains(e.target as Node) && e.target !== this.canvasPickerBtn) {
                popover.remove();
                this.canvasPickerBtn?.setAttribute('aria-expanded', 'false');
                document.removeEventListener('mousedown', closeOnOutside, true);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeOnOutside, true), 0);
    }

    refreshCanvasDropdown(activeId: string): void {
        this.activeCanvasId = activeId;
        if (!this.canvasLabelEl) return;
        const canvas = listCanvases().find(c => c.id === activeId);
        this.canvasLabelEl.textContent = canvas?.name ?? activeId;
    }

    /** Scroll the tree viewport so the given <li> is visible. */
    private scrollTreeToItem(li: HTMLElement): void {
        if (!this.treeViewport) return;
        // Expand all collapsed parent zones so the item becomes visible
        let parent = li.parentElement;
        while (parent && parent !== this.elementTreeListEl) {
            if (parent.tagName === 'LI' && parent.getAttribute('aria-expanded') === 'false') {
                parent.setAttribute('aria-expanded', 'true');
                const children = parent.querySelector<HTMLElement>('.nr-tree-children');
                if (children) children.style.display = '';
            }
            parent = parent.parentElement;
        }
        // Also ensure the Element Tree section itself is expanded
        const treeSection = this.elementTreeListEl.closest('.nr-palette-section');
        if (treeSection?.classList.contains('nr-palette-section--collapsed')) {
            treeSection.classList.remove('nr-palette-section--collapsed');
            const heading = treeSection.querySelector('.nr-section-header');
            if (heading) heading.setAttribute('aria-expanded', 'true');
        }
        requestAnimationFrame(() => {
            li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }

    /** Rebuild only the component + container list when the registry changes. */
    refresh() {
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
        this.applyTreeSearchFilter();
    }

    private build() {
        // Layer section heading
        const layerHeading = document.createElement('div');
        layerHeading.className = 'nr-section-header nr-section-header--static';
        const layerHeadingLabel = document.createElement('span');
        layerHeadingLabel.textContent = 'Selected Layer';
        layerHeading.appendChild(layerHeadingLabel);
        this.el.appendChild(layerHeading);

        // Canvas picker row — looks like a tree row with a popover
        const pickerRow = document.createElement('div');
        pickerRow.className = 'nr-canvas-picker';

        this.canvasPickerBtn = document.createElement('button');
        this.canvasPickerBtn.type = 'button';
        this.canvasPickerBtn.className = 'nr-canvas-picker-btn';
        this.canvasPickerBtn.setAttribute('aria-haspopup', 'listbox');
        this.canvasPickerBtn.setAttribute('aria-expanded', 'false');

        const iconSpan = document.createElement('span');
        iconSpan.className = 'nr-tree-icon';
        iconSpan.innerHTML = ICON_CANVAS;
        this.canvasPickerBtn.appendChild(iconSpan);

        this.canvasLabelEl = document.createElement('span');
        this.canvasLabelEl.className = 'nr-tree-label';
        this.canvasLabelEl.textContent = 'Canvas';
        this.canvasPickerBtn.appendChild(this.canvasLabelEl);

        const chevron = document.createElement('span');
        chevron.className = 'nr-canvas-picker-chevron';
        chevron.innerHTML = ICON_CHEVRON_DOWN;
        this.canvasPickerBtn.appendChild(chevron);

        this.canvasPickerBtn.addEventListener('click', () => this.toggleCanvasPopover());
        pickerRow.appendChild(this.canvasPickerBtn);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'nr-canvas-add-btn';
        addBtn.title = 'New canvas';
        addBtn.setAttribute('aria-label', 'New canvas');
        addBtn.innerHTML = ICON_ADD;
        addBtn.addEventListener('click', () => { this.onCanvasCreate?.(); });
        pickerRow.appendChild(addBtn);

        this.el.appendChild(pickerRow);

        // Search Elements input — filters the element tree below.
        const treeSearchBox = document.createElement('div');
        treeSearchBox.className = 'nr-palette-search';
        const treeSearchIcon = document.createElement('span');
        treeSearchIcon.className = 'nr-palette-search-icon';
        treeSearchIcon.innerHTML = ICON_SEARCH;
        treeSearchIcon.setAttribute('aria-hidden', 'true');
        const treeSearch = document.createElement('input');
        treeSearch.type = 'search';
        treeSearch.className = 'nr-palette-search-input';
        treeSearch.placeholder = 'Search elements';
        treeSearch.setAttribute('aria-label', 'Search elements');
        treeSearch.addEventListener('input', () => {
            this.treeSearchTerm = treeSearch.value;
            this.applyTreeSearchFilter();
            this.componentPanelHandle?.setSearchTerm(treeSearch.value);
        });
        treeSearchBox.appendChild(treeSearchIcon);
        treeSearchBox.appendChild(treeSearch);
        this.el.appendChild(treeSearchBox);

        // Element Tree section (collapsible, max 35vh, sticky at top).
        // The tree lives inside a custom-scrollbar wrapper so the scrollbar
        // is permanently visible regardless of OS scrollbar auto-hide.
        this.elementTreeListEl = document.createElement('ul');
        this.elementTreeListEl.className = 'nr-tree';
        this.elementTreeListEl.setAttribute('role', 'tree');
        this.elementTreeListEl.setAttribute('aria-label', 'Element Tree');

        const treeViewport = document.createElement('div');
        treeViewport.className = 'nr-tree-scroll-viewport';
        treeViewport.appendChild(this.elementTreeListEl);
        this.treeViewport = treeViewport;

        const treeWrap = document.createElement('div');
        treeWrap.className = 'nr-tree-scroll-wrap';
        treeWrap.appendChild(treeViewport);

        const scrollTrack = document.createElement('div');
        scrollTrack.className = 'nr-tree-scroll-track';
        const scrollThumb = document.createElement('div');
        scrollThumb.className = 'nr-tree-scroll-thumb';
        scrollTrack.appendChild(scrollThumb);
        treeWrap.appendChild(scrollTrack);

        const treeSection = this.buildCollapsibleSection('Element Tree', treeWrap, { bodyClass: 'nr-section-body--tree' });
        treeSection.classList.add('nr-palette-section--tree');

        // Add collapse/expand all button to the Element Tree header
        let treeAllExpanded = true;
        this.treeCollapseBtn = document.createElement('button');
        const treeCollapseBtn = this.treeCollapseBtn;
        treeCollapseBtn.type = 'button';
        treeCollapseBtn.className = 'nr-section-collapse-btn';
        treeCollapseBtn.title = 'Collapse all';
        treeCollapseBtn.setAttribute('aria-label', 'Collapse all');
        treeCollapseBtn.innerHTML = carbonIconToString(Minimize16 as CarbonIcon);
        treeCollapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            treeAllExpanded = !treeAllExpanded;
            this.elementTreeListEl.querySelectorAll<HTMLLIElement>('[aria-expanded]').forEach(li => {
                li.setAttribute('aria-expanded', String(treeAllExpanded));
                const children = li.querySelector<HTMLElement>('.nr-tree-children');
                if (children) children.style.display = treeAllExpanded ? '' : 'none';
            });
            treeCollapseBtn.innerHTML = treeAllExpanded
                ? carbonIconToString(Minimize16 as CarbonIcon)
                : carbonIconToString(Maximize16 as CarbonIcon);
            treeCollapseBtn.title = treeAllExpanded ? 'Collapse all' : 'Expand all';
        });
        const treeSectionHeader = treeSection.querySelector('.nr-section-header');
        if (treeSectionHeader) {
            treeSectionHeader.insertBefore(treeCollapseBtn, treeSectionHeader.querySelector('.nr-section-chevron'));
        }

        this.el.appendChild(treeSection);
        this.buildElementTree();

        // Sync the custom thumb with viewport scroll position + content size.
        let lastThumbH = 0;
        let lastTrackH = 0;
        const updateThumb = () => {
            const vh = treeViewport.clientHeight;
            const ch = treeViewport.scrollHeight;
            lastTrackH = vh;
            if (ch <= vh || vh === 0) {
                // Content fits — show a full-track thumb so the strip stays visible.
                lastThumbH = vh;
                scrollThumb.style.height = '100%';
                scrollThumb.style.top    = '0';
                return;
            }
            const ratio    = vh / ch;
            const thumbH   = Math.max(20, Math.round(vh * ratio));
            const maxScroll = ch - vh;
            const maxTop    = vh - thumbH;
            const top       = maxScroll === 0 ? 0 : Math.round((treeViewport.scrollTop / maxScroll) * maxTop);
            lastThumbH = thumbH;
            scrollThumb.style.height = `${thumbH}px`;
            scrollThumb.style.top    = `${top}px`;
        };
        treeViewport.addEventListener('scroll', updateThumb);
        new ResizeObserver(updateThumb).observe(treeViewport);
        new MutationObserver(updateThumb).observe(this.elementTreeListEl, { childList: true, subtree: true });
        requestAnimationFrame(updateThumb);

        // Suppress row hover highlights while scrolling so the visual state
        // doesn't strobe as rows shift under a stationary cursor. Reset
        // shortly after the last scroll event.
        let scrollIdleTimer: number | null = null;
        treeViewport.addEventListener('scroll', () => {
            treeViewport.classList.add('nr-tree-scrolling');
            if (scrollIdleTimer !== null) window.clearTimeout(scrollIdleTimer);
            scrollIdleTimer = window.setTimeout(() => {
                treeViewport.classList.remove('nr-tree-scrolling');
                scrollIdleTimer = null;
            }, 150);
        });

        // Drag the thumb to scroll. Movement in track-px → movement in
        // content-px scaled by (content / viewport).
        scrollThumb.addEventListener('mousedown', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            const startY      = evt.clientY;
            const startScroll = treeViewport.scrollTop;
            scrollThumb.classList.add('nr-tree-scroll-thumb--dragging');
            const onMove = (e: MouseEvent) => {
                const trackUsable = lastTrackH - lastThumbH;
                if (trackUsable <= 0) return;
                const maxScroll = treeViewport.scrollHeight - treeViewport.clientHeight;
                const dy = e.clientY - startY;
                treeViewport.scrollTop = Math.max(0, Math.min(maxScroll, startScroll + (dy * maxScroll) / trackUsable));
            };
            const onUp = () => {
                scrollThumb.classList.remove('nr-tree-scroll-thumb--dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',   onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });

        // Click on the track jumps the viewport so the thumb centres under the cursor.
        scrollTrack.addEventListener('mousedown', (evt: MouseEvent) => {
            if (evt.target === scrollThumb) return; // thumb has its own handler
            evt.preventDefault();
            const rect = scrollTrack.getBoundingClientRect();
            const y    = evt.clientY - rect.top;
            const maxScroll = treeViewport.scrollHeight - treeViewport.clientHeight;
            const trackUsable = lastTrackH - lastThumbH;
            if (trackUsable <= 0) return;
            const target = ((y - lastThumbH / 2) / trackUsable) * maxScroll;
            treeViewport.scrollTop = Math.max(0, Math.min(maxScroll, target));
        });

        // Component panel (shared tree/grid with header & search)
        this.componentPanelEl = document.createElement('div');
        this.componentPanelEl.className = 'nr-palette-scrollable';

        const compScrollWrap = document.createElement('div');
        compScrollWrap.className = 'nr-tree-scroll-wrap';
        compScrollWrap.style.flex = '1';
        compScrollWrap.style.minHeight = '0';

        this.componentPanelEl.style.cssText = 'min-height:0;max-height:45vh;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-ms-overflow-style:none;padding-right:4px;';

        const compTrack = document.createElement('div');
        compTrack.className = 'nr-tree-scroll-track';
        const compThumb = document.createElement('div');
        compThumb.className = 'nr-tree-scroll-thumb';
        compTrack.appendChild(compThumb);

        compScrollWrap.appendChild(this.componentPanelEl);
        compScrollWrap.appendChild(compTrack);

        const compSection = this.buildCollapsibleSection('Components', compScrollWrap);
        compSection.classList.add('nr-palette-section--components');
        compSection.style.minHeight = '0';
        compSection.style.display = 'flex';
        compSection.style.flexDirection = 'column';

        // Add collapse-all and view-switcher buttons to the section header
        const compSectionHeader = compSection.querySelector('.nr-section-header')!;
        const compChevron = compSectionHeader.querySelector('.nr-section-chevron')!;

        let compAllExpanded = true;
        const compCollapseBtn = document.createElement('button');
        compCollapseBtn.type = 'button';
        compCollapseBtn.className = 'nr-section-collapse-btn';
        compCollapseBtn.title = 'Collapse all';
        compCollapseBtn.setAttribute('aria-label', 'Collapse all');
        compCollapseBtn.innerHTML = carbonIconToString(Minimize16 as CarbonIcon);
        compCollapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            compAllExpanded = !compAllExpanded;
            this.componentPanelEl!.querySelectorAll<HTMLElement>('.nr-comp-tree__node--folder, .nr-palette-section').forEach(el => {
                el.setAttribute('aria-expanded', String(compAllExpanded));
                el.classList.toggle('nr-palette-section--collapsed', !compAllExpanded);
            });
            compCollapseBtn.innerHTML = compAllExpanded
                ? carbonIconToString(Minimize16 as CarbonIcon)
                : carbonIconToString(Maximize16 as CarbonIcon);
            compCollapseBtn.title = compAllExpanded ? 'Collapse all' : 'Expand all';
        });

        const compViewBtn = document.createElement('button');
        compViewBtn.type = 'button';
        compViewBtn.className = 'nr-section-collapse-btn';
        compViewBtn.title = 'View options';
        compViewBtn.setAttribute('aria-label', 'View options');
        compViewBtn.innerHTML = carbonIconToString(SettingsAdjust16 as CarbonIcon);
        compViewBtn.addEventListener('click', (e) => {
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
                item.className = 'nr-ctx-menu__item' + (getComponentViewMode() === mode.key ? ' nr-ctx-menu__item--active' : '');
                item.setAttribute('role', 'menuitem');
                const label = document.createElement('span');
                label.className = 'nr-ctx-menu__label';
                label.textContent = mode.label;
                item.appendChild(label);
                item.addEventListener('click', () => {
                    menu.remove();
                    setComponentViewMode(mode.key);
                    this.buildList();
                });
                menu.appendChild(item);
            }

            const rect = compViewBtn.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.left = rect.left + 'px';
            menu.style.top = rect.bottom + 2 + 'px';
            document.body.appendChild(menu);

            const dismiss = (ev: MouseEvent) => {
                if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener('mousedown', dismiss); }
            };
            setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
        });

        compSectionHeader.insertBefore(compViewBtn, compChevron);
        compSectionHeader.insertBefore(compCollapseBtn, compChevron);

        this.el.appendChild(compSection);

        const updateCompThumb = () => {
            const vh = this.componentPanelEl!.clientHeight;
            const ch = this.componentPanelEl!.scrollHeight;
            if (ch <= vh || vh === 0) {
                compThumb.style.height = '100%';
                compThumb.style.top = '0';
                compTrack.style.opacity = '0';
                return;
            }
            compTrack.style.opacity = '1';
            const ratio = vh / ch;
            const thumbH = Math.max(20, Math.round(vh * ratio));
            const maxScroll = ch - vh;
            const maxTop = vh - thumbH;
            const top = maxScroll === 0 ? 0 : Math.round((this.componentPanelEl!.scrollTop / maxScroll) * maxTop);
            compThumb.style.height = `${thumbH}px`;
            compThumb.style.top = `${top}px`;
        };
        this.componentPanelEl.addEventListener('scroll', updateCompThumb);
        new ResizeObserver(updateCompThumb).observe(this.componentPanelEl);
        requestAnimationFrame(updateCompThumb);

        // Zoning section below the component panel
        this.listEl = document.createElement('div');
        this.el.appendChild(this.listEl);

        this.buildList();
    }

    /** Hide tree rows whose label doesn't match. Zones stay visible if any
        descendant matches. */
    private applyTreeSearchFilter(): void {
        const term = this.treeSearchTerm.trim().toLowerCase();
        const filterUl = (ul: HTMLUListElement): boolean => {
            let anyVisible = false;
            const lis = Array.from(ul.children) as HTMLElement[];
            for (const li of lis) {
                if (li.classList.contains('nr-tree-element')) {
                    const lbl = li.querySelector<HTMLElement>('.nr-tree-label')?.textContent ?? '';
                    const match = !term || lbl.toLowerCase().includes(term);
                    li.style.display = match ? '' : 'none';
                    if (match) anyVisible = true;
                } else if (li.classList.contains('nr-tree-zone')) {
                    const lbl = li.querySelector<HTMLElement>('.nr-tree-row .nr-tree-label')?.textContent ?? '';
                    const ownMatch = !term || lbl.toLowerCase().includes(term);
                    const childUl  = li.querySelector<HTMLUListElement>(':scope > .nr-tree-children');
                    const childMatch = childUl ? filterUl(childUl) : false;
                    const visible = ownMatch || childMatch;
                    li.style.display = visible ? '' : 'none';
                    if (visible) anyVisible = true;
                }
            }
            return anyVisible;
        };
        const anyVisible = filterUl(this.elementTreeListEl);

        let emptyMsg = this.elementTreeListEl.querySelector('.nr-palette-empty-msg') as HTMLElement;
        if (term && !anyVisible) {
            if (!emptyMsg) {
                emptyMsg = document.createElement('li');
                emptyMsg.className = 'nr-palette-empty-msg';
                emptyMsg.textContent = 'No results';
                this.elementTreeListEl.appendChild(emptyMsg);
            }
            emptyMsg.style.display = '';
        } else if (emptyMsg) {
            emptyMsg.style.display = 'none';
        }
    }

    private applyComponentSearchFilter(): void {
        // Component tree filtering is handled by the shared component-tree module.
        // This only needs to filter the flat Zoning section.
        const term = this.componentSearchTerm.trim().toLowerCase();
        this.listEl.querySelectorAll<HTMLElement>('.nr-palette-item').forEach(btn => {
            const lbl = btn.querySelector<HTMLElement>('.nr-palette-item-label')?.textContent
                     ?? btn.textContent ?? '';
            const match = !term || lbl.toLowerCase().includes(term);
            const li = btn.closest('li');
            if (li) (li as HTMLElement).style.display = match ? '' : 'none';
        });
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

        if (this.treeCollapseBtn) {
            this.treeCollapseBtn.style.display = rootFrames.length > 0 ? '' : 'none';
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

        const hasChildren = childFrames.length > 0 || childElements.length > 0;

        const li = document.createElement('li');
        li.className = 'nr-tree-zone' + (hasChildren ? '' : ' nr-tree-zone--empty');
        li.setAttribute('role', 'treeitem');
        li.setAttribute('aria-expanded', hasChildren ? 'true' : 'false');

        const row = document.createElement('div');
        row.className = 'nr-tree-row';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'nr-tree-drag-handle';
        dragHandle.innerHTML = ICON_DRAG_VERTICAL;
        dragHandle.setAttribute('aria-hidden', 'true');

        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'nr-tree-toggle';
        if (hasChildren) {
            toggleSpan.innerHTML = ICON_TREE_TOGGLE;
        } else {
            toggleSpan.classList.add('nr-tree-toggle--empty');
        }

        const iconSpan = document.createElement('span');
        iconSpan.className = 'nr-tree-icon';
        iconSpan.innerHTML = ICON_TREE_ZONE;
        iconSpan.setAttribute('aria-hidden', 'true');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'nr-tree-label';
        labelSpan.textContent = zoneLabel;
        labelSpan.title = zoneLabel;

        row.appendChild(toggleSpan);
        row.appendChild(iconSpan);
        row.appendChild(labelSpan);
        row.appendChild(dragHandle);
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
            if (!hasChildren) return;
            const expanded = li.getAttribute('aria-expanded') === 'true';
            li.setAttribute('aria-expanded', String(!expanded));
            childrenUl.style.display = expanded ? 'none' : '';
            // When opening a zone, scroll so the children area is visible.
            if (!expanded && childrenUl.children.length > 0) {
                requestAnimationFrame(() => this.scrollTreeToItem(childrenUl.lastElementChild as HTMLElement));
            }
        });
        row.addEventListener('contextmenu', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            this.onTreeContextMenu?.(String(frame.id), evt.clientX, evt.clientY);
        });

        this.attachRowDragHandlers(row, frame);

        parentUl.appendChild(li);
    }

    private appendTreeItem(cell: dia.Element, parentUl: HTMLUListElement) {
        const meta = cell.get('meta') as { name?: string; shapeType?: string } | undefined;
        const shapeKey = meta?.shapeType ?? '';
        const label = meta?.name?.trim()
            || (cell.attr('label/text') as string | undefined)
            || ShapeRegistry[shapeKey]?.displayName
            || shapeKey
            || 'Element';
        // Use the Shape-wide Main IconEntry (CONTEXT.md: isMain is per-Shape),
        // matching the Components palette below. Querying `layers[0].icons[0]`
        // here previously meant the Element Tree and the Components section
        // could show DIFFERENT icons for the same Shape whenever `isMain` was
        // set on something other than the first IconEntry of the first Layer.
        const def = shapeKey ? ShapeRegistry[shapeKey] : undefined;
        const iconId = (cell.prop('meta/icon') as string | undefined)
            || (def ? getPaletteIcon(def)?.iconId : undefined);

        const li = document.createElement('li');
        li.className = 'nr-tree-element';
        li.setAttribute('role', 'treeitem');

        const row = document.createElement('div');
        row.className = 'nr-tree-row';

        let iconSvgHtml: string | null = null;
        let iconCssClass = '';
        const rendered = renderIcon(iconId, 'tree');
        if (rendered) {
            iconSvgHtml = rendered.html;
            iconCssClass = rendered.cssClass;
        } else if (cell.get('isDoubleArrow')) {
            iconSvgHtml = ICON_DOUBLE_ARROW;
        } else if (cell.get('isArea')) {
            iconSvgHtml = ICON_AREA_CUSTOM;
        }
        if (iconSvgHtml) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'nr-tree-icon' + (iconCssClass ? ' ' + iconCssClass : '');
            iconSpan.innerHTML = iconSvgHtml;
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
        row.addEventListener('contextmenu', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            this.onTreeSelect(String(cell.id));
            this.onTreeContextMenu?.(String(cell.id), evt.clientX, evt.clientY);
        });

        this.attachElementDragHandlers(row, cell);

        parentUl.appendChild(li);
        this.treeItemEls.set(String(cell.id), li);
    }

    /**
     * Drag handlers for ZONE rows. Zones can be reordered among siblings
     * (same parent) and can also receive element drops (component transfer).
     */
    private attachRowDragHandlers(row: HTMLElement, cell: dia.Cell): void {
        row.setAttribute('draggable', 'true');
        const cellId = String(cell.id);

        row.addEventListener('dragstart', (evt: DragEvent) => {
            this.dragCellId = cellId;
            if (evt.dataTransfer) {
                evt.dataTransfer.effectAllowed = 'move';
                evt.dataTransfer.setData('text/plain', cellId);
            }
            row.classList.add('nr-tree-row--dragging');
        });

        row.addEventListener('dragend', () => {
            this.dragCellId = null;
            row.classList.remove('nr-tree-row--dragging');
            this.clearDropIndicators();
            this.onZoneDropHighlight?.(null);
        });

        row.addEventListener('dragover', (evt: DragEvent) => {
            if (!this.dragCellId || this.dragCellId === cellId) return;
            const dragged = this.graph.getCell(this.dragCellId);
            if (!dragged) return;

            // Element drag — three zones along the row height:
            //   top 25%    → extract to root (drop ABOVE zone)
            //   middle 50% → enter zone
            //   bottom 25% → extract to root (drop BELOW zone)
            if (!dragged.get('isFrame')) {
                evt.preventDefault();
                if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
                const rect = row.getBoundingClientRect();
                const dy = evt.clientY - rect.top;
                this.clearDropIndicators();
                if (dy < rect.height * 0.25) {
                    row.classList.add('nr-tree-row--drop-above');
                    this.onZoneDropHighlight?.(null);
                } else if (dy > rect.height * 0.75) {
                    row.classList.add('nr-tree-row--drop-below');
                    this.onZoneDropHighlight?.(null);
                } else {
                    row.classList.add('nr-tree-row--drop-into');
                    this.onZoneDropHighlight?.(cellId);
                }
                return;
            }

            // Zone → zone reorder (same parent only).
            if (!this.canReorderInto(this.dragCellId, cellId)) return;
            evt.preventDefault();
            if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
            const rect = row.getBoundingClientRect();
            const above = (evt.clientY - rect.top) < rect.height / 2;
            this.clearDropIndicators();
            row.classList.add(above ? 'nr-tree-row--drop-above' : 'nr-tree-row--drop-below');
        });

        row.addEventListener('dragleave', () => {
            row.classList.remove('nr-tree-row--drop-above', 'nr-tree-row--drop-below', 'nr-tree-row--drop-into');
            this.onZoneDropHighlight?.(null);
        });

        row.addEventListener('drop', (evt: DragEvent) => {
            if (!this.dragCellId || this.dragCellId === cellId) return;
            const dragged = this.graph.getCell(this.dragCellId);
            if (!dragged) return;
            evt.preventDefault();
            evt.stopPropagation();

            if (!dragged.get('isFrame')) {
                // Element drop — top/bottom = extract to root, middle = enter zone.
                const rect = row.getBoundingClientRect();
                const dy = evt.clientY - rect.top;
                if (dy < rect.height * 0.25 || dy > rect.height * 0.75) {
                    this.extractToRoot(this.dragCellId);
                } else {
                    this.transferToZone(this.dragCellId, cellId);
                }
            } else if (this.canReorderInto(this.dragCellId, cellId)) {
                // Zone → zone: reorder.
                const rect = row.getBoundingClientRect();
                const above = (evt.clientY - rect.top) < rect.height / 2;
                this.reorderSiblings(this.dragCellId, cellId, above ? 'before' : 'after');
            }

            this.clearDropIndicators();
            this.onZoneDropHighlight?.(null);
            this.dragCellId = null;
        });
    }

    /**
     * Drag handlers for ELEMENT (non-zone) rows. Elements can be dragged
     * onto zones but cannot be reordered among themselves. No drag-handle
     * icon is shown — the entire row is the grip.
     */
    private attachElementDragHandlers(row: HTMLElement, cell: dia.Cell): void {
        row.setAttribute('draggable', 'true');
        const cellId = String(cell.id);

        row.addEventListener('dragstart', (evt: DragEvent) => {
            this.dragCellId = cellId;
            if (evt.dataTransfer) {
                evt.dataTransfer.effectAllowed = 'move';
                evt.dataTransfer.setData('text/plain', cellId);
            }
            row.classList.add('nr-tree-row--dragging');
        });

        row.addEventListener('dragend', () => {
            this.dragCellId = null;
            row.classList.remove('nr-tree-row--dragging');
            this.clearDropIndicators();
        });

        // Element rows do NOT accept drops — no dragover/drop handlers.
    }

    private clearDropIndicators(): void {
        this.elementTreeListEl.querySelectorAll('.nr-tree-row--drop-above, .nr-tree-row--drop-below, .nr-tree-row--drop-into')
            .forEach(el => el.classList.remove('nr-tree-row--drop-above', 'nr-tree-row--drop-below', 'nr-tree-row--drop-into'));
    }

    /** Reorder only makes sense when source and target share the same parent. */
    private canReorderInto(draggedId: string, targetId: string): boolean {
        const dragged = this.graph.getCell(draggedId);
        const target  = this.graph.getCell(targetId);
        if (!dragged || !target) return false;
        const draggedParent = dragged.getParentCell()?.id ?? null;
        const targetParent  = target.getParentCell()?.id  ?? null;
        return draggedParent === targetParent;
    }

    private reorderSiblings(draggedId: string, targetId: string, position: 'before' | 'after'): void {
        const dragged = this.graph.getCell(draggedId);
        const target  = this.graph.getCell(targetId);
        if (!dragged || !target) return;
        const targetZ = (target.get('z') as number | undefined) ?? 0;
        dragged.set('z', position === 'before' ? targetZ - 0.001 : targetZ + 0.001);
    }

    /** Move an element into a zone: unembed from current parent, embed into
        the target zone, and reposition to the zone's lower-left corner. */
    private transferToZone(elementId: string, zoneId: string): void {
        const element = this.graph.getCell(elementId) as dia.Element | null;
        const zone    = this.graph.getCell(zoneId)    as Frame      | null;
        if (!element || !zone) return;
        // Already in this zone? Nothing to do.
        if (element.getParentCell()?.id === zone.id) return;

        const currentParent = element.getParentCell();
        if (currentParent) (currentParent as dia.Element).unembed(element);
        zone.embed(element);

        // Place at the lower-left corner of the zone with one grid-unit padding.
        const { x: zx, y: zy } = zone.position();
        const { height: zh }   = zone.size();
        const { height: eh }   = (element as dia.Element).size();
        const pad = GRID_SIZE;
        (element as dia.Element).position(zx + pad, zy + zh - eh - pad);
    }

    /**
     * Detach an element from its current zone so it lives at the top level
     * (no parent). Position is left where it is on the canvas — the user
     * may want to move it later. Used by the tree's drop-above/drop-below
     * gestures to lift elements out of a zone.
     */
    private extractToRoot(elementId: string): void {
        const element = this.graph.getCell(elementId) as dia.Element | null;
        if (!element) return;
        const currentParent = element.getParentCell();
        if (currentParent) (currentParent as dia.Element).unembed(element);
    }

    private buildList() {
        // Build component tree items with PaletteItem as data payload
        const items: ComponentTreeItem[] = Object.entries(ShapeRegistry)
            .filter(([id]) => !BUILT_IN_SHAPE_IDS.has(id))
            .map(([id, defaults]) => {
                const layer0 = defaults.layers?.[0];
                const catIconId = getPaletteIcon(defaults)?.iconId;
                const rendered = renderIcon(catIconId, 'palette');
                const paletteItem: PaletteItem = {
                    label: defaults.displayName ?? formatLabel(id),
                    kind: id,
                    create: () => getPreviewFactory(id, layer0?.baseShape ?? 'rectangle')(),
                    iconSvg: rendered?.html,
                    iconCssClass: rendered?.cssClass,
                };
                return {
                    id,
                    label: paletteItem.label,
                    iconSvg: paletteItem.iconSvg,
                    iconCssClass: paletteItem.iconCssClass,
                    collection: defaults.collection || 'User Created',
                    data: paletteItem,
                };
            });

        this.componentPanelHandle = buildComponentPanel(this.componentPanelEl!, {
            items,
            onSelect: (_id: string, data?: unknown) => {
                this.addToGraph(data as PaletteItem);
            },
            showCreateButton: false,
            hideSearch: true,
        });

        // Remove the internal "Components" header — the collapsible section provides it
        this.componentPanelEl!.querySelectorAll('.nr-palette-comp-header').forEach(h => h.remove());

        this.listEl.innerHTML = '';
        const zoningSection = this.buildSection('Zoning', CONTAINER_ITEMS, true);
        zoningSection.classList.add('nr-palette-section--zoning');
        this.listEl.appendChild(zoningSection);
        const designSection = this.buildSection('Design', DESIGN_ITEMS, true);
        designSection.classList.add('nr-palette-section--design');
        this.listEl.appendChild(designSection);
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
                iconSpan.className = 'nr-palette-item-icon' + (item.iconCssClass ? ' ' + item.iconCssClass : '');
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
        const center = this.getViewportCenter?.() ?? { x: BASE_X, y: BASE_Y };
        const col = this.placeCount % STAGGER_COLS;
        const row = Math.floor(this.placeCount / STAGGER_COLS);
        const x = center.x + (col - STAGGER_COLS / 2) * STAGGER;
        const y = center.y + row * STAGGER;
        this.placeCount++;

        const defaults = ShapeRegistry[item.kind];
        const view = this.getView();
        // meta.name from displayName so the new element starts named (Inspector
        // input, label, element tree all consistent — same rule as the SD
        // drop handler).
        const meta: NodeMeta = { name: defaults?.displayName ?? '', shapeType: item.kind, serverId: '', notes: '' };

        // ComplexComponent is required for multi-Layer OR multi-Icon shapes:
        // a single-image `topIcon` attr can carry one icon only. Same predicate
        // as the drop handler — keeps the two spawn paths in sync.
        const baseLayer = defaults?.layers?.[0];
        const needsComplex = (defaults?.layers?.length ?? 0) > 1 || (baseLayer?.icons?.length ?? 0) > 1;
        if (needsComplex && baseLayer) {
            const cc = new ComplexComponent();
            const haSize = getHitArea(defaults!);
            cc.resize(haSize.width, haSize.height);
            const isoH = getCompositeIsoHeight(defaults!);
            cc.set('isometricHeight',        isoH);
            cc.set('defaultIsometricHeight', isoH);
            cc.set('defaultSize',            haSize);
            // Copy the layer definitions into the cell — deep-clone so edits to
            // the registry later don't mutate placed instances.
            cc.set('layers', defaults!.layers!.map(l => ({ ...l, style: { ...l.style } })));

            cc.position(x, y);
            cc.set(META_KEY, meta);

            // Label — standard attr pipeline.
            const displayLabel = defaults!.displayName && !meta.name.trim()
                ? defaults!.displayName : '';
            if (displayLabel) cc.attr('label/text', displayLabel);

            if (defaults!.defaultRotation) cc.set('shapeRotation', defaults!.defaultRotation);

            cc.toggleView(view);
            this.graph.addCell(cc);
            this.embedIntoActiveZone(cc);
            this.onCreated(cc);
            return;
        }

        // Single-layer shape.
        const shape = item.create();
        if (defaults) {
            applyRegistryDefaults(shape, defaults);
        }
        shape.position(x, y);
        shape.set(META_KEY, meta);

        if (shape.get('isDoubleArrow')) {
            const count = this.graph.getElements().filter(e => e.get('isDoubleArrow')).length;
            shape.attr('label/text', `Double Arrow ${count + 1}`);
        } else if (shape.get('isArea')) {
            const count = this.graph.getElements().filter(e => e.get('isArea') && !e.get('isDoubleArrow')).length;
            shape.attr('label/text', `Area ${count + 1}`);
        }
        if (baseLayer?.baseShape) shape.set('currentBaseShape', baseLayer.baseShape);
        shape.toggleView(view);

        this.graph.addCell(shape);
        this.embedIntoActiveZone(shape);
        this.onCreated(shape);
    }

    /** If a zone is currently selected on the canvas, embed the new element
     *  into it and reposition to the zone's lower-left corner. */
    embedIntoActiveZone(element: IsometricShape): void {
        const zone = this.getActiveZone?.() ?? null;
        if (!zone) return;
        zone.embed(element);
        const { x: zx, y: zy } = zone.position();
        const { height: zh }   = zone.size();
        const { height: eh }   = element.size();
        const pad = GRID_SIZE;
        element.position(zx + pad, zy + zh - eh - pad);
    }
}
