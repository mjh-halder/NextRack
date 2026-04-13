import '../style.css';
import '@carbon/styles/css/styles.css';

import { panel, canvasEl, paletteEl, buttonEl, designNameEl } from './system-designer';
import './component-designer';

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
    buttonEl.style.display      = isGrid ? '' : 'none';
    // design-name is managed by applyNewDesign; only hide it when leaving grid view
    if (!isGrid) designNameEl.style.display = 'none';

    // Component Designer
    cdEl.setAttribute('aria-hidden', String(isGrid));
    cdEl.style.display = isGrid ? 'none' : 'flex';

    // Dismiss any open inspector when leaving System Designer
    if (!isGrid) panel.hide();
}

navGridBtn.addEventListener('click',   () => setAppView('grid'));
navShapesBtn.addEventListener('click', () => setAppView('shapes'));
