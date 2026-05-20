import { dia, V } from '@joint/core';
import { cellNamespace } from './shapes';
import { View } from './shapes/isometric-shape';
import { transformationMatrix } from './utils';

const MINIMAP_W = 180;
const MINIMAP_H = 120;
const GRID_SIZE = 20;
const SIDEBAR_INSET = 276;

let minimapPaper: dia.Paper;
let viewportRect: SVGRectElement;
let containerEl: HTMLDivElement;
let mainPaper: dia.Paper;
let currentView: View = View.Isometric;
let currentGridCount = 20;
let rafId = 0;

// Base matrix (zoom=1) — stable reference for the minimap
let baseMxCached: SVGMatrix;
// Minimap matrix — maps model space to minimap pixels
let mmMxCached: SVGMatrix | null = null;

function pt(x: number, y: number, mx: DOMMatrix | SVGMatrix): { x: number; y: number } {
    return { x: mx.a * x + mx.c * y + mx.e, y: mx.b * x + mx.d * y + mx.f };
}

let onNavigateCb: (() => void) | null = null;

export function setMinimapNavigateCallback(cb: () => void): void {
    onNavigateCb = cb;
}

export function initMinimap(
    container: HTMLDivElement,
    graph: dia.Graph,
    paper: dia.Paper,
): void {
    containerEl = container;
    mainPaper = paper;
    container.classList.add('nr-minimap');

    const paperWrap = document.createElement('div');
    paperWrap.className = 'nr-minimap__paper';
    container.appendChild(paperWrap);

    minimapPaper = new dia.Paper({
        el: paperWrap,
        model: graph,
        interactive: false,
        async: true,
        autoFreeze: true,
        cellViewNamespace: cellNamespace,
        width: MINIMAP_W,
        height: MINIMAP_H,
    });

    const style = document.createElement('style');
    style.textContent = '.nr-minimap .joint-port { display: none; } .nr-minimap text { display: none; }';
    container.appendChild(style);

    const overlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlaySvg.classList.add('nr-minimap__overlay');
    overlaySvg.setAttribute('width', String(MINIMAP_W));
    overlaySvg.setAttribute('height', String(MINIMAP_H));

    viewportRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    viewportRect.classList.add('nr-minimap__viewport');
    overlaySvg.appendChild(viewportRect);
    container.appendChild(overlaySvg);

    let dragging = false;
    const navigate = (e: MouseEvent) => {
        const rect = overlaySvg.getBoundingClientRect();
        panToMinimapPoint(e.clientX - rect.left, e.clientY - rect.top);
    };
    overlaySvg.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = true; navigate(e); });
    window.addEventListener('mousemove', (e) => { if (dragging) navigate(e); });
    window.addEventListener('mouseup', () => { dragging = false; });

    window.addEventListener('scroll', scheduleViewportUpdate);
    window.addEventListener('resize', scheduleViewportUpdate);
    graph.on('change add remove', scheduleViewportUpdate);

    rebuildMinimapMatrix();
    scheduleViewportUpdate();
}

export function updateMinimapView(view: View, gridCount: number): void {
    currentView = view;
    currentGridCount = gridCount;
    rebuildMinimapMatrix();
    scheduleViewportUpdate();
}

export function scheduleMinimapUpdate(): void {
    rebuildMinimapMatrix();
    scheduleViewportUpdate();
}

function scheduleViewportUpdate(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; updateViewportRect(); });
}

function rebuildMinimapMatrix(): void {
    if (!minimapPaper) return;

    baseMxCached = transformationMatrix(currentView, GRID_SIZE, SIDEBAR_INSET, currentGridCount);
    const gw = currentGridCount * GRID_SIZE;
    const gh = currentGridCount * GRID_SIZE;

    const corners = [pt(0, 0, baseMxCached), pt(gw, 0, baseMxCached), pt(gw, gh, baseMxCached), pt(0, gh, baseMxCached)];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
    }

    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;
    const pad = 6;
    const scale = Math.min((MINIMAP_W - pad * 2) / worldW, (MINIMAP_H - pad * 2) / worldH);

    mmMxCached = V.createSVGMatrix()
        .translate(
            pad + ((MINIMAP_W - pad * 2) - worldW * scale) / 2 - minX * scale,
            pad + ((MINIMAP_H - pad * 2) - worldH * scale) / 2 - minY * scale,
        )
        .scaleNonUniform(scale, scale)
        .multiply(baseMxCached);

    minimapPaper.matrix(mmMxCached);
}

function updateViewportRect(): void {
    if (!mmMxCached || !mainPaper) return;

    const mainMx = mainPaper.matrix();
    const mainInv = V.createSVGMatrix().multiply(mainMx).inverse();

    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 40;

    // The visible area in client (screen) coordinates
    const vpL = window.scrollX + SIDEBAR_INSET;
    const vpT = window.scrollY + headerH;
    const vpR = window.scrollX + window.innerWidth;
    const vpB = window.scrollY + window.innerHeight;

    // Screen page coords → model space → minimap pixels
    const mTL = pt(vpL, vpT, mainInv);
    const mTR = pt(vpR, vpT, mainInv);
    const mBL = pt(vpL, vpB, mainInv);
    const mBR = pt(vpR, vpB, mainInv);

    const pTL = pt(mTL.x, mTL.y, mmMxCached);
    const pTR = pt(mTR.x, mTR.y, mmMxCached);
    const pBL = pt(mBL.x, mBL.y, mmMxCached);
    const pBR = pt(mBR.x, mBR.y, mmMxCached);

    const xs = [pTL.x, pTR.x, pBL.x, pBR.x];
    const ys = [pTL.y, pTR.y, pBL.y, pBR.y];

    viewportRect.setAttribute('x', String(Math.min(...xs)));
    viewportRect.setAttribute('y', String(Math.min(...ys)));
    viewportRect.setAttribute('width', String(Math.max(1, Math.max(...xs) - Math.min(...xs))));
    viewportRect.setAttribute('height', String(Math.max(1, Math.max(...ys) - Math.min(...ys))));
}

function panToMinimapPoint(px: number, py: number): void {
    if (!mmMxCached) return;

    // Minimap pixel → model coords
    const mmInv = V.createSVGMatrix().multiply(mmMxCached).inverse();
    const targetModel = pt(px, py, mmInv);

    // We want this model point to be at the center of the visible viewport.
    // Instead of scrolling (which is limited by page bounds), translate the paper matrix.
    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 40;
    const vpCenterX = window.scrollX + SIDEBAR_INSET + (window.innerWidth - SIDEBAR_INSET) / 2;
    const vpCenterY = window.scrollY + headerH + (window.innerHeight - headerH) / 2;

    const mainMx = mainPaper.matrix();

    // Where does the target model point currently appear on screen?
    const currentScreen = pt(targetModel.x, targetModel.y, mainMx);

    // Shift the paper matrix so the target appears at viewport center
    const dx = vpCenterX - currentScreen.x;
    const dy = vpCenterY - currentScreen.y;

    mainPaper.matrix(
        V.createSVGMatrix()
            .translate(dx, dy)
            .multiply(mainMx)
    );

    scheduleViewportUpdate();
    onNavigateCb?.();
}

export function showMinimap(): void {
    if (containerEl) containerEl.style.display = '';
}

export function hideMinimap(): void {
    if (containerEl) containerEl.style.display = 'none';
}
