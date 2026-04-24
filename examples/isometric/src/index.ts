import '../style.css';
import '@carbon/styles/css/styles.css';

import { panel, canvasEl, paletteEl, viewToggleContainerEl, designNameEl } from './system-designer';
import { panel as cdPanel, selectShape } from './component-designer';
import { initTopHeader } from './top-header';
import { initAdmin } from './admin';
import { initDataModel } from './data-model';
import { initProductCatalog } from './product-catalog';
import { initKnowledgeBase, navigateToTopic } from './docs/knowledge-base';
import { initAppDesigner } from './app-designer';
import { carbonIconToString, CarbonIcon } from './icons';
import Sun20 from '@carbon/icons/es/sun/20.js';
import Moon20 from '@carbon/icons/es/moon/20.js';
import Settings20 from '@carbon/icons/es/settings/20.js';

// ---- Theme toggle (light: cds--white / dark: cds--g100) ----

const THEME_KEY = 'nr-theme';

// Moon — shown in light mode (click to switch to dark)
const MOON_SVG = carbonIconToString(Moon20 as CarbonIcon);
// Sun — shown in dark mode (click to switch to light)
const SUN_SVG = carbonIconToString(Sun20 as CarbonIcon);
const SETTINGS_SVG = carbonIconToString(Settings20 as CarbonIcon);

function applyTheme(dark: boolean) {
    document.documentElement.classList.toggle('cds--g100', dark);
    document.documentElement.classList.toggle('cds--white', !dark);

    const btn = document.getElementById('nav-theme');
    if (btn) {
        btn.innerHTML      = dark ? SUN_SVG  : MOON_SVG;
        btn.title          = dark ? 'Switch to light mode' : 'Switch to dark mode';
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

const navGridBtn      = document.getElementById('nav-grid')            as HTMLButtonElement;
const navShapesBtn    = document.getElementById('nav-shapes')          as HTMLButtonElement;
const navAppsBtn      = document.getElementById('nav-apps')            as HTMLButtonElement;
const navCatalogBtn   = document.getElementById('nav-catalog')         as HTMLButtonElement;
const navDocsBtn      = document.getElementById('nav-docs')            as HTMLButtonElement;
const navAdminBtn     = document.getElementById('nav-admin')           as HTMLButtonElement;
const cdEl            = document.getElementById('component-designer')  as HTMLDivElement;
const appDesignerEl   = document.getElementById('app-designer')        as HTMLDivElement;
const catalogEl       = document.getElementById('product-catalog')     as HTMLDivElement;
const kbEl            = document.getElementById('knowledge-base')      as HTMLDivElement;
const adminEl         = document.getElementById('admin')               as HTMLDivElement;

navAdminBtn.innerHTML = SETTINGS_SVG;

initAdmin(adminEl);
initDataModel(document.getElementById('data-model') as HTMLDivElement);
initProductCatalog(catalogEl);
initAppDesigner(appDesignerEl);
initKnowledgeBase(kbEl);

type AppView = 'grid' | 'shapes' | 'apps' | 'catalog' | 'docs' | 'admin';

function setAppView(view: AppView) {
    const isGrid    = view === 'grid';
    const isShapes  = view === 'shapes';
    const isApps    = view === 'apps';
    const isCatalog = view === 'catalog';
    const isDocs    = view === 'docs';
    const isAdmin   = view === 'admin';

    navGridBtn.classList.toggle('nr-rail-item--active', isGrid);
    navGridBtn.setAttribute('aria-current', isGrid ? 'page' : 'false');
    navShapesBtn.classList.toggle('nr-rail-item--active', isShapes);
    navShapesBtn.setAttribute('aria-current', isShapes ? 'page' : 'false');
    navAppsBtn.classList.toggle('nr-rail-item--active', isApps);
    navAppsBtn.setAttribute('aria-current', isApps ? 'page' : 'false');
    navCatalogBtn.classList.toggle('nr-rail-item--active', isCatalog);
    navCatalogBtn.setAttribute('aria-current', isCatalog ? 'page' : 'false');
    navDocsBtn.classList.toggle('nr-rail-item--active', isDocs);
    navDocsBtn.setAttribute('aria-current', isDocs ? 'page' : 'false');
    navAdminBtn.classList.toggle('nr-rail-item--active', isAdmin);
    navAdminBtn.setAttribute('aria-current', isAdmin ? 'page' : 'false');

    // System Designer elements
    canvasEl.style.display      = isGrid ? '' : 'none';
    paletteEl.style.display     = isGrid ? '' : 'none';
    viewToggleContainerEl.style.display = isGrid ? '' : 'none';
    (document.getElementById('minimap') as HTMLElement).style.display = isGrid ? '' : 'none';
    (document.getElementById('resource-bar') as HTMLElement).style.display = isGrid ? '' : 'none';
    (document.getElementById('layout-bar') as HTMLElement).style.display = isGrid ? '' : 'none';
    (document.getElementById('zoom-control') as HTMLElement).style.display = isGrid ? '' : 'none';
    if (!isGrid) {
        designNameEl.style.display = 'none';
        (document.getElementById('workload-table') as HTMLElement).style.display = 'none';
    }

    // Component Designer
    cdEl.setAttribute('aria-hidden', String(!isShapes));
    cdEl.style.display = isShapes ? 'flex' : 'none';

    // App Designer
    appDesignerEl.setAttribute('aria-hidden', String(!isApps));
    appDesignerEl.style.display = isApps ? 'flex' : 'none';

    // Product Catalog
    catalogEl.setAttribute('aria-hidden', String(!isCatalog));
    catalogEl.style.display = isCatalog ? 'flex' : 'none';

    // Knowledge Base
    kbEl.setAttribute('aria-hidden', String(!isDocs));
    kbEl.style.display = isDocs ? 'flex' : 'none';

    // Admin
    adminEl.setAttribute('aria-hidden', String(!isAdmin));
    adminEl.style.display = isAdmin ? 'flex' : 'none';

    // Dismiss open inspectors on view switch
    if (!isGrid)   panel.hide();
    if (!isShapes) cdPanel.hide();
}

navGridBtn.addEventListener('click',      () => setAppView('grid'));
navShapesBtn.addEventListener('click',    () => setAppView('shapes'));
navAppsBtn.addEventListener('click',      () => setAppView('apps'));
navCatalogBtn.addEventListener('click',   () => setAppView('catalog'));
navDocsBtn.addEventListener('click',      () => setAppView('docs'));
navAdminBtn.addEventListener('click',     () => setAppView('admin'));

document.addEventListener('nextrack:navigate-to-shape', ((e: CustomEvent<{ shapeId: string }>) => {
    selectShape(e.detail.shapeId);
    setAppView('shapes');
}) as EventListener);

document.addEventListener('nextrack:open-docs', ((e: CustomEvent<{ topic: string }>) => {
    navigateToTopic(e.detail.topic);
    setAppView('docs');
}) as EventListener);

// ---- Top header ----

initTopHeader(
    document.getElementById('top-header') as HTMLDivElement,
    designNameEl,
);
