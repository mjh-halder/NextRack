import '../style.css';
import '@carbon/styles/css/styles.css';

import { panel, canvasEl, paletteEl, viewToggleContainerEl, designNameEl } from './system-designer';
import { panel as cdPanel } from './component-designer';

// ---- Theme toggle (light: cds--white / dark: cds--g100) ----

const THEME_KEY = 'nr-theme';

// Carbon moon icon — shown in light mode (click to switch to dark)
const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M13.502 5.414a15.075 15.075 0 0 0 0 21.17c5.98 5.979 15.956 5.988 21.916-.022a11.09 11.09 0 0 1-9.189-4.173 11.07 11.07 0 0 1-2.23-5.167A11.06 11.06 0 0 0 13.5 5.414z"/></svg>`;

// Carbon sun icon — shown in dark mode (click to switch to light)
const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M16 12a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0-2a6 6 0 1 0 0 12A6 6 0 0 0 16 10zm-1-7h2v4h-2zm0 21h2v4h-2zM4.22 5.64l1.42-1.42 2.82 2.83-1.42 1.41zM23.54 24.95l1.42-1.41 2.82 2.82-1.41 1.42zM3 15h4v2H3zm22 0h4v2h-4zM4.22 26.36l2.82-2.83 1.42 1.42-2.83 2.82zM23.54 7.05l2.83-2.83 1.41 1.42-2.82 2.82z"/></svg>`;

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

// ---- App-level view switching (System Designer ↔ Component Designer) ----

const navGridBtn   = document.getElementById('nav-grid')            as HTMLButtonElement;
const navShapesBtn = document.getElementById('nav-shapes')          as HTMLButtonElement;
const cdEl         = document.getElementById('component-designer')  as HTMLDivElement;

type AppView = 'grid' | 'shapes';

function setAppView(view: AppView) {
    const isGrid = view === 'grid';

    navGridBtn.classList.toggle('nr-rail-item--active', isGrid);
    navGridBtn.setAttribute('aria-current', isGrid ? 'page' : 'false');
    navShapesBtn.classList.toggle('nr-rail-item--active', !isGrid);
    navShapesBtn.setAttribute('aria-current', !isGrid ? 'page' : 'false');

    // System Designer elements
    canvasEl.style.display      = isGrid ? '' : 'none';
    paletteEl.style.display     = isGrid ? '' : 'none';
    viewToggleContainerEl.style.display = isGrid ? '' : 'none';
    // design-name is managed by applyNewDesign; only hide it when leaving grid view
    if (!isGrid) designNameEl.style.display = 'none';

    // Component Designer
    cdEl.setAttribute('aria-hidden', String(isGrid));
    cdEl.style.display = isGrid ? 'none' : 'flex';

    // Dismiss open inspectors on view switch
    if (!isGrid) panel.hide();
    if (isGrid) cdPanel.hide();
}

navGridBtn.addEventListener('click',   () => setAppView('grid'));
navShapesBtn.addEventListener('click', () => setAppView('shapes'));
