import '../style.css';
import '@carbon/styles/css/styles.css';

import { panel, canvasEl, paletteEl, viewToggleContainerEl, designNameEl, fitToContent } from './system-designer';
import { panel as cdPanel, selectShape } from './component-designer';
import { initTopHeader, setCanvasActive } from './top-header';
import { initAdmin } from './admin';
import { bootstrapBundledVendorIcons } from './vendor-icon-bootstrap';
import { initDataModel } from './data-model';
import { initProductCatalog } from './product-catalog';
import { initKnowledgeBase, navigateToTopic } from './docs/knowledge-base';
import { initAppDesigner } from './app-designer';
import { initPlacementView, refreshPlacementView } from './placement-view';
import { graph as systemGraph } from './system-designer';
import { carbonIconToString, CarbonIcon } from './icons';
import Sun20 from '@carbon/icons/es/sun/20.js';
import Moon20 from '@carbon/icons/es/moon/20.js';
import PencilPictogram from '@carbon/pictograms/es/pencil/index.js';
import EnterpriseDesignPictogram from '@carbon/pictograms/es/enterprise--design--thinking--01/index.js';

// ---- Theme toggle (light: cds--white / dark: cds--g100) ----

const THEME_KEY = 'nr-theme';

// Moon — shown in light mode (click to switch to dark)
const MOON_SVG = carbonIconToString(Moon20 as CarbonIcon);
// Sun — shown in dark mode (click to switch to light)
const SUN_SVG = carbonIconToString(Sun20 as CarbonIcon);
export function applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('cds--g100', dark);
    document.documentElement.classList.toggle('cds--white', !dark);
    // Notify subscribers so they can refresh theme-dependent visuals
    // (shape fill/stroke, etc.).
    window.dispatchEvent(new CustomEvent('nr-theme-change', { detail: { dark } }));

    const btn = document.getElementById('nav-theme');
    if (btn) {
        const iconSvg = dark ? SUN_SVG : MOON_SVG;
        const existingSvg = btn.querySelector('svg');
        if (existingSvg) existingSvg.remove();
        btn.insertAdjacentHTML('afterbegin', iconSvg);
        const svg = btn.querySelector('svg');
        if (svg) svg.classList.add('nr-rail-icon');
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
}

const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(savedTheme === 'dark');

document.getElementById('nav-theme')?.addEventListener('click', () => {
    const nowDark = document.documentElement.classList.contains('cds--g100');
    const next = !nowDark;
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    applyTheme(next);
});

// ---- App-level view switching (System Designer ↔ Component Designer ↔ Admin) ----

const cdEl             = document.getElementById('component-designer')  as HTMLDivElement;
const appDesignerEl    = document.getElementById('app-designer')        as HTMLDivElement;
const placementViewEl  = document.getElementById('placement-view')      as HTMLDivElement;
const analysisViewEl   = document.getElementById('analysis-view')       as HTMLDivElement;
const catalogEl        = document.getElementById('product-catalog')     as HTMLDivElement;
const kbEl             = document.getElementById('knowledge-base')      as HTMLDivElement;
const adminEl          = document.getElementById('admin')               as HTMLDivElement;
const flyoutEl         = document.getElementById('nav-flyout')          as HTMLDivElement;

initAdmin(adminEl);
initDataModel(document.getElementById('data-model') as HTMLDivElement);
initProductCatalog(catalogEl);
initAppDesigner(appDesignerEl);
initPlacementView(placementViewEl, systemGraph);
initKnowledgeBase(kbEl);

// Seed empty vendor catalogs (AWS/GCP/Azure) from bundled ZIPs.
// Fire-and-forget: on completion, onCatalogChange refreshes both palettes.
void bootstrapBundledVendorIcons();

type AppView = 'grid' | 'apps' | 'placement' | 'components' | 'products' | 'analysis' | 'admin';
type EditorMode = 'just-draw' | 'full-architecture';

const EDITOR_MODE_KEY = 'nextrack-editor-mode';
let editorMode: EditorMode | null = null;
try { editorMode = localStorage.getItem(EDITOR_MODE_KEY) as EditorMode | null; } catch { /* */ }

function setEditorMode(mode: EditorMode): void {
    editorMode = mode;
    try { localStorage.setItem(EDITOR_MODE_KEY, mode); } catch { /* */ }
    applyEditorMode();
}

interface NavGroup {
    id: string;
    label: string;
    items: { label: string; view: AppView; icon: string }[];
}

const FLYOUT_ICONS: Record<string, string> = {
    apps: '<svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M28.83,21.17,25,17.37l.67-.67a1,1,0,0,0,0-1.41l-6-6a1,1,0,0,0-1.41,0h0l-.79.79L10.71,3.29a1,1,0,0,0-1.41,0h0l-4,4-.12.15-4,6a1,1,0,0,0,.12,1.26l3,3a1,1,0,0,0,1.42,0L10,13.41l2.09,2.09-4.8,4.79a1,1,0,0,0,0,1.41l2,2A1,1,0,0,0,10,24a1,1,0,0,0,.52-.15l4.33-2.6,2.44,2.45a1,1,0,0,0,1.41,0h0l.67-.7,3.79,3.83a4,4,0,0,0,5.66-5.66ZM10,10.58l-5,5L3.29,13.87,6.78,8.63,10,5.41l6.09,6.09L13.5,14.08Zm8,11-2.84-2.84-5,3L9.42,21,19,11.41,23.59,16Zm9.42,3.83a2,2,0,0,1-2.83,0h0l-3.8-3.79,2.83-2.83,3.8,3.79a2,2,0,0,1,0,2.83Z"/></svg>',
    grid: '<svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M16,24a.9967.9967,0,0,1-.4741-.12l-13-7L3.4741,15.12,16,21.8643,28.5259,15.12l.9482,1.7607-13,7A.9967.9967,0,0,1,16,24Z"/><path d="M16,30a.9967.9967,0,0,1-.4741-.12l-13-7L3.4741,21.12,16,27.8643,28.5259,21.12l.9482,1.7607-13,7A.9967.9967,0,0,1,16,30Z"/><path d="M16,18a.9967.9967,0,0,1-.4741-.12l-13-7a1,1,0,0,1,0-1.7607l13-7a.9982.9982,0,0,1,.9482,0l13,7a1,1,0,0,1,0,1.7607l-13,7A.9967.9967,0,0,1,16,18ZM5.1094,10,16,15.8643,26.8906,10,16,4.1358Z"/></svg>',
    placement: '<svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M28,4H4A2,2,0,0,0,2,6V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4Zm0,22H12V20H10v6H4V17H20.1719l-3.586,3.5859L18,22l6-6-6-6-1.4141,1.4141L20.1719,15H4V6h6v6h2V6H28Z"/></svg>',
    components: '<svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M30,25v-2h-2.1c-.1-.6-.4-1.2-.7-1.8l1.5-1.5-1.4-1.4-1.5,1.5c-.5-.3-1.1-.6-1.8-.7v-2.1h-2v2.1c-.6.1-1.2.4-1.8.7l-1.5-1.5-1.4,1.4,1.5,1.5c-.3.5-.6,1.1-.7,1.8h-2.1v2h2.1c.1.6.4,1.2.7,1.8l-1.5,1.5,1.4,1.4,1.5-1.5c.5.3,1.1.6,1.8.7v2.1h2v-2.1c.6-.1,1.2-.4,1.8-.7l1.5,1.5,1.4-1.4-1.5-1.5c.3-.5.6-1.1.7-1.8h2.1ZM23,27c-1.7,0-3-1.3-3-3s1.3-3,3-3,3,1.3,3,3-1.3,3-3,3ZM21.4854,7.126L12.4858,2.126c-.3027-.168-.6689-.168-.9717,0L2.5142,7.126c-.3174.1763-.5142.5107-.5142.874v10c0,.3633.1968.6982.5142.874l9,5c.1514.084.3188.126.4858.126.1753,0,.3506-.0459.5073-.1377.3052-.1797.4927-.5078.4927-.8623v-9.4116l7-3.8891v4.3007h2v-6c0-.3633-.1973-.6978-.5146-.874ZM12,4.144l6.9411,3.8561-6.9411,3.8558-6.9409-3.856,6.9409-3.856h0ZM4,17.4111v-7.7117l7,3.8889v7.7124s-7-3.8896-7-3.8896Z"/></svg>',
    products: '<svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M26,2H8A2,2,0,0,0,6,4V8H4v2H6v5H4v2H6v5H4v2H6v4a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V4A2,2,0,0,0,26,2Zm0,26H8V24h2V22H8V17h2V15H8V10h2V8H8V4H26Z"/><path d="M14 8H22V10H14z"/><path d="M14 15H22V17H14z"/><path d="M14 22H22V24H14z"/></svg>',
    analysis: '<svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M4,2H2V28a2,2,0,0,0,2,2H30V28H4Z"/><path d="M30,9H23v2h3.59L19,18.59l-4.29-4.3a1,1,0,0,0-1.42,0L6,21.59,7.41,23,14,16.41l4.29,4.3a1,1,0,0,0,1.42,0L28,12.41V16h2Z"/></svg>',
};

const NAV_GROUPS: NavGroup[] = [
    { id: 'design', label: 'Design', items: [
        { label: 'Architecture', view: 'grid', icon: FLYOUT_ICONS.grid },
        { label: 'Workloads', view: 'apps', icon: FLYOUT_ICONS.apps },
        { label: 'Placement', view: 'placement', icon: FLYOUT_ICONS.placement },
    ]},
    { id: 'catalogs', label: 'Catalogs', items: [
        { label: 'Components', view: 'components', icon: FLYOUT_ICONS.components },
        { label: 'Products', view: 'products', icon: FLYOUT_ICONS.products },
    ]},
    { id: 'analysis', label: 'Analysis', items: [
        { label: 'Analysis', view: 'analysis', icon: FLYOUT_ICONS.analysis },
    ]},
];

const JUST_DRAW_GROUPS: NavGroup[] = [
    { id: 'design', label: 'Design', items: [
        { label: 'Architecture', view: 'grid', icon: FLYOUT_ICONS.grid },
    ]},
    { id: 'catalogs', label: 'Catalogs', items: [
        { label: 'Components', view: 'components', icon: FLYOUT_ICONS.components },
    ]},
];

function getActiveNavGroups(): NavGroup[] {
    return editorMode === 'just-draw' ? JUST_DRAW_GROUPS : NAV_GROUPS;
}

let currentView: AppView = 'apps';
let openGroupId: string | null = null;

function applyEditorMode(): void {
    const groups = getActiveNavGroups();
    const activeGroupIds = new Set(groups.map(g => g.id));
    for (const btn of groupBtns) {
        const gid = btn.getAttribute('data-nav-group');
        (btn as HTMLElement).style.display = gid && activeGroupIds.has(gid) ? '' : 'none';
    }
    document.documentElement.classList.toggle('nr-mode-just-draw', editorMode === 'just-draw');
    closeFlyout();
    syncRailHighlight();
}

const CLOSE_ICON_SVG = `<svg class="nr-rail-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="20" height="20"><path d="M24 9.4L22.6 8 16 14.6 9.4 8 8 9.4 14.6 16 8 22.6 9.4 24 16 17.4 22.6 24 24 22.6 17.4 16 24 9.4z"/></svg>`;
const groupBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-nav-group]'));
const groupOriginalIcons = new Map<HTMLButtonElement, string>();
for (const btn of groupBtns) {
    groupOriginalIcons.set(btn, btn.innerHTML);
}

function getGroupForView(view: AppView): string | null {
    for (const g of getActiveNavGroups()) {
        if (g.items.some(i => i.view === view)) return g.id;
    }
    return null;
}

function syncRailHighlight(): void {
    const activeGroupId = getGroupForView(currentView);
    for (const btn of groupBtns) {
        const gid = btn.getAttribute('data-nav-group');
        btn.classList.toggle('nr-rail-item--active', gid === activeGroupId);
    }
}

function closeFlyout(): void {
    openGroupId = null;
    flyoutEl.classList.remove('nr-nav-flyout--open');
    for (const btn of groupBtns) {
        btn.classList.remove('nr-rail-item--expanded');
        btn.innerHTML = groupOriginalIcons.get(btn) || '';
    }
}

function openFlyout(groupId: string): void {
    const groups = getActiveNavGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // In just-draw mode with single-item groups, navigate directly without flyout
    if (editorMode === 'just-draw' && group.items.length === 1) {
        setAppView(group.items[0].view);
        closeFlyout();
        return;
    }
    openGroupId = groupId;

    flyoutEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'nr-nav-flyout__title';
    title.textContent = group.label;
    flyoutEl.appendChild(title);

    for (const item of group.items) {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'nr-nav-flyout__item';
        if (item.view === currentView) link.classList.add('nr-nav-flyout__item--active');
        link.innerHTML = `<span class="nr-nav-flyout__item-icon">${item.icon}</span><span>${item.label}</span>`;
        link.addEventListener('click', () => {
            setAppView(item.view);
            closeFlyout();
        });
        flyoutEl.appendChild(link);
    }

    flyoutEl.classList.add('nr-nav-flyout--open');
    for (const btn of groupBtns) {
        const isThis = btn.getAttribute('data-nav-group') === groupId;
        btn.classList.toggle('nr-rail-item--expanded', isThis);
        btn.innerHTML = isThis ? CLOSE_ICON_SVG : (groupOriginalIcons.get(btn) || '');
    }
}

for (const btn of groupBtns) {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gid = btn.getAttribute('data-nav-group')!;
        if (openGroupId === gid) closeFlyout();
        else openFlyout(gid);
    });
}

document.addEventListener('mousedown', (e) => {
    if (openGroupId && !flyoutEl.contains(e.target as Node) &&
        !groupBtns.some(b => b.contains(e.target as Node))) {
        closeFlyout();
    }
}, true);

function setAppView(view: AppView) {
    currentView = view;
    syncRailHighlight();

    const isGrid       = view === 'grid';
    const isApps       = view === 'apps';
    const isPlacement  = view === 'placement';
    const isComponents = view === 'components';
    const isProducts   = view === 'products';
    const isAnalysis   = view === 'analysis';
    const isAdmin      = view === 'admin';

    // System Designer elements
    canvasEl.style.display      = isGrid ? '' : 'none';
    paletteEl.style.display     = isGrid ? '' : 'none';
    viewToggleContainerEl.style.display = isGrid ? '' : 'none';
    (document.getElementById('minimap') as HTMLElement).style.display = isGrid ? '' : 'none';
    (document.getElementById('resource-bar') as HTMLElement).style.display = isGrid ? '' : 'none';
    (document.getElementById('layout-bar') as HTMLElement).style.display = 'none';
    (document.getElementById('zoom-control') as HTMLElement).style.display = isGrid ? '' : 'none';
    (document.getElementById('element-table-btn') as HTMLElement).style.display = isGrid ? '' : 'none';
    if (isGrid) {
        requestAnimationFrame(() => fitToContent());
    }
    if (!isGrid) {
        designNameEl.style.display = 'none';
        (document.getElementById('workload-table') as HTMLElement).style.display = 'none';
    }

    // Component Designer
    cdEl.setAttribute('aria-hidden', String(!isComponents));
    cdEl.style.display = isComponents ? 'flex' : 'none';
    if (isComponents) cdPanel.resetSelection();

    // App Designer (Workloads)
    appDesignerEl.setAttribute('aria-hidden', String(!isApps));
    appDesignerEl.style.display = isApps ? 'block' : 'none';

    // Placement
    placementViewEl.setAttribute('aria-hidden', String(!isPlacement));
    placementViewEl.style.display = isPlacement ? 'flex' : 'none';
    if (isPlacement) refreshPlacementView();

    // Product Catalog
    catalogEl.setAttribute('aria-hidden', String(!isProducts));
    catalogEl.style.display = isProducts ? 'flex' : 'none';

    // Analysis
    analysisViewEl.setAttribute('aria-hidden', String(!isAnalysis));
    analysisViewEl.style.display = isAnalysis ? 'block' : 'none';

    // Knowledge Base (hidden, accessible via docs links)
    kbEl.setAttribute('aria-hidden', 'true');
    kbEl.style.display = 'none';

    // Admin
    adminEl.setAttribute('aria-hidden', String(!isAdmin));
    adminEl.style.display = isAdmin ? 'flex' : 'none';

    // Dismiss open inspectors on view switch
    if (!isGrid)       panel.hide();
    if (!isComponents) cdPanel.hide();

    setCanvasActive(isGrid || isComponents);
}

// ── Switcher menu (top-right, opens Admin) ──

interface SwitcherSection {
    label: string;
    items: { text: string; action?: () => void }[];
}

function initSwitcherMenu(): void {
    const headerEl = document.getElementById('top-header') as HTMLElement;

    const wrap = document.createElement('div');
    wrap.className = 'nr-header-switcher';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nr-header-switcher__btn';
    btn.title = 'Menu';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="20" height="20"><path d="M14 4H18V8H14z"/><path d="M4 4H8V8H4z"/><path d="M24 4H28V8H24z"/><path d="M14 14H18V18H14z"/><path d="M4 14H8V18H4z"/><path d="M24 14H28V18H24z"/><path d="M14 24H18V28H14z"/><path d="M4 24H8V28H4z"/><path d="M24 24H28V28H24z"/></svg>`;

    const panel = document.createElement('nav');
    panel.className = 'nr-switcher-panel';

    const GRID_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="20" height="20"><path d="M14 4H18V8H14z"/><path d="M4 4H8V8H4z"/><path d="M24 4H28V8H24z"/><path d="M14 14H18V18H14z"/><path d="M4 14H8V18H4z"/><path d="M24 14H28V18H24z"/><path d="M14 24H18V28H14z"/><path d="M4 24H8V28H4z"/><path d="M24 24H28V28H24z"/></svg>`;
    const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="20" height="20"><path d="M24 9.4L22.6 8 16 14.6 9.4 8 8 9.4 14.6 16 8 22.6 9.4 24 16 17.4 22.6 24 24 22.6 17.4 16 24 9.4z"/></svg>`;

    function isOpen() { return panel.classList.contains('nr-switcher-panel--open'); }

    function togglePanel() {
        const opening = !isOpen();
        panel.classList.toggle('nr-switcher-panel--open', opening);
        btn.innerHTML = opening ? CLOSE_ICON : GRID_ICON;
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
    });

    document.addEventListener('mousedown', (e) => {
        if (!wrap.contains(e.target as Node) && isOpen()) {
            panel.classList.remove('nr-switcher-panel--open');
            btn.innerHTML = GRID_ICON;
        }
    }, true);

    const sections: SwitcherSection[] = [
        {
            label: 'Application',
            items: [
                { text: 'Settings', action: () => { togglePanel(); setAppView('admin'); } },
            ],
        },
        {
            label: 'Resources',
            items: [
                { text: 'Knowledge Base', action: () => { togglePanel(); kbEl.setAttribute('aria-hidden', 'false'); kbEl.style.display = 'flex'; } },
            ],
        },
    ];

    const list = document.createElement('ul');
    list.className = 'nr-switcher-list';

    for (const section of sections) {
        const dividerLi = document.createElement('li');
        dividerLi.className = 'nr-switcher-divider';
        const dividerSpan = document.createElement('span');
        dividerSpan.textContent = section.label;
        dividerLi.appendChild(dividerSpan);
        list.appendChild(dividerLi);

        for (const item of section.items) {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'nr-switcher-link';
            link.setAttribute('role', 'button');
            link.tabIndex = 0;
            link.textContent = item.text;
            if (item.action) {
                link.addEventListener('click', item.action);
            }
            li.appendChild(link);
            list.appendChild(li);
        }
    }

    panel.appendChild(list);

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    headerEl.appendChild(wrap);
}

document.addEventListener('nextrack:navigate-to-shape', ((e: CustomEvent<{ shapeId: string }>) => {
    setAppView('components');
    requestAnimationFrame(() => selectShape(e.detail.shapeId));
}) as EventListener);

document.addEventListener('nextrack:open-docs', ((e: CustomEvent<{ topic: string }>) => {
    navigateToTopic(e.detail.topic);
}) as EventListener);

document.addEventListener('nextrack:focus-cluster', (() => {
    setAppView('grid');
}) as EventListener);

// ── Mode selection modal ─────────────────────────────────────────────────────
function showModeModal(): void {
    const overlay = document.createElement('div');
    overlay.className = 'nr-mode-modal__overlay';

    const dialog = document.createElement('div');
    dialog.className = 'nr-mode-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const heading = document.createElement('h2');
    heading.className = 'nr-mode-modal__heading';
    heading.textContent = 'What are you here to do?';
    dialog.appendChild(heading);

    const cards = document.createElement('div');
    cards.className = 'nr-mode-modal__cards';

    const DRAW_ICON = carbonIconToString(PencilPictogram as CarbonIcon).replace('width="64"', 'width="48"').replace('height="64"', 'height="48"');
    const ARCH_ICON = carbonIconToString(EnterpriseDesignPictogram as CarbonIcon).replace('width="64"', 'width="48"').replace('height="64"', 'height="48"');

    for (const opt of [
        { mode: 'just-draw' as EditorMode, title: 'Just Draw', desc: 'Simple diagramming — jump straight to the canvas.', icon: DRAW_ICON },
        { mode: 'full-architecture' as EditorMode, title: 'Modeling', desc: 'Full modeling with workloads, placement, and catalogs.', icon: ARCH_ICON },
    ]) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'nr-mode-modal__card';

        const iconEl = document.createElement('div');
        iconEl.className = 'nr-mode-modal__card-icon';
        iconEl.innerHTML = opt.icon;

        const titleEl = document.createElement('div');
        titleEl.className = 'nr-mode-modal__card-title';
        titleEl.textContent = opt.title;

        const descEl = document.createElement('div');
        descEl.className = 'nr-mode-modal__card-desc';
        descEl.textContent = opt.desc;

        const actionBtn = document.createElement('div');
        actionBtn.className = 'nr-mode-modal__card-btn';
        actionBtn.textContent = opt.title;

        card.appendChild(iconEl);
        card.appendChild(titleEl);
        card.appendChild(descEl);
        card.appendChild(actionBtn);

        card.addEventListener('click', () => {
            overlay.remove();
            setEditorMode(opt.mode);
            setAppView(opt.mode === 'just-draw' ? 'grid' : 'grid');
        });

        cards.appendChild(card);
    }

    dialog.appendChild(cards);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

// ── Mode switch button in top header ────────────────────────────────────────
const modeSwitchBtn = document.createElement('button');
modeSwitchBtn.type = 'button';
modeSwitchBtn.id = 'nr-mode-switch';
modeSwitchBtn.className = 'nr-mode-switch-btn';
modeSwitchBtn.innerHTML = '<svg viewBox="0 0 32 32" fill="currentColor" width="16" height="16"><path d="M28,10H22V6a2,2,0,0,0-2-2H12a2,2,0,0,0-2,2v4H4A2,2,0,0,0,2,12V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V12A2,2,0,0,0,28,10ZM12,6h8v4H12ZM4,26V12H28V26Z"/></svg>';
modeSwitchBtn.title = 'Switch editor mode';
modeSwitchBtn.addEventListener('click', () => {
    showModeModal();
});
document.getElementById('top-header')?.appendChild(modeSwitchBtn);

// ── Startup ─────────────────────────────────────────────────────────────────
if (!editorMode) {
    showModeModal();
    // Don't set a view yet — modal will handle it
} else {
    applyEditorMode();
    setAppView(editorMode === 'just-draw' ? 'grid' : 'grid');
}

// Dev shortcut
const devBtn = document.createElement('button');
devBtn.type = 'button';
devBtn.textContent = 'Dev → Modifiers';
devBtn.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:99999;padding:4px 10px;font-size:11px;background:#0f62fe;color:#fff;border:none;cursor:pointer;opacity:0.7;font-family:IBM Plex Sans,sans-serif;';
devBtn.addEventListener('click', () => {
    setAppView('components');
    const { ShapeRegistry, BUILT_IN_SHAPE_IDS } = require('./shapes/shape-registry');
    const targetId = ShapeRegistry['default_setter'] ? 'default_setter'
        : Object.keys(ShapeRegistry).filter((id: string) => !BUILT_IN_SHAPE_IDS.has(id))[0];
    if (targetId) {
        selectShape(targetId);
        setTimeout(() => {
            const inspector = document.getElementById('cd2-inspector');
            if (!inspector) return;
            const items = inspector.querySelectorAll('.cds--accordion__item');
            items.forEach((item) => {
                const title = item.querySelector('.cds--accordion__title');
                const isModifiers = title && title.textContent === 'Modifiers';
                if (isModifiers) {
                    item.classList.add('cds--accordion__item--active');
                    const heading = item.querySelector('.cds--accordion__heading');
                    if (heading) heading.setAttribute('aria-expanded', 'true');
                    const content = item.querySelector('.cds--accordion__content') as HTMLElement | null;
                    if (content) content.style.display = '';
                    item.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }, 100);
    }
});
document.body.appendChild(devBtn);

// ---- Top header ----

initTopHeader(
    document.getElementById('top-header') as HTMLDivElement,
    designNameEl,
);

initSwitcherMenu();
