import { dia, V } from '@joint/core';
import { cellNamespace } from './shapes';
import { View } from './shapes/isometric-shape';
import { transformationMatrix } from './utils';

const MINIMAP_W = 180;
const MINIMAP_H = 120;

let minimapPaper: dia.Paper;
let viewportRect: SVGRectElement;
let containerEl: HTMLDivElement;
let mainPaper: dia.Paper;
let currentView: View = View.Isometric;
let currentGridCount = 20;
let rafId = 0;

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
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        scrollToMinimapPoint(px, py);
    };

    overlaySvg.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        navigate(e);
    });
    window.addEventListener('mousemove', (e) => { if (dragging) navigate(e); });
    window.addEventListener('mouseup', () => { dragging = false; });

    window.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    graph.on('change add remove', scheduleUpdate);

    scheduleUpdate();
}

export function updateMinimapView(view: View, gridCount: number): void {
    currentView = view;
    currentGridCount = gridCount;
    scheduleUpdate();
}

function scheduleUpdate(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateMinimap();
    });
}

function updateMinimap(): void {
    if (!minimapPaper || !mainPaper) return;

    // Get the same base transformation the main paper uses (without zoom/scroll)
    const baseMx = transformationMatrix(currentView, 20, 0, currentGridCount);

    // Compute the bounding box of the grid area in screen space (at zoom=1)
    // The grid spans model coords (0,0) to (gridW, gridH)
    const gridW = currentGridCount * 20; // GRID_SIZE = 20
    const gridH = currentGridCount * 20;

    const corners = [
        applyMatrix(0, 0, baseMx),
        applyMatrix(gridW, 0, baseMx),
        applyMatrix(gridW, gridH, baseMx),
        applyMatrix(0, gridH, baseMx),
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x);
        maxY = Math.max(maxY, c.y);
    }

    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const pad = 10;

    const scaleX = (MINIMAP_W - pad * 2) / worldW;
    const scaleY = (MINIMAP_H - pad * 2) / worldH;
    const scale = Math.min(scaleX, scaleY);

    // Minimap matrix: shift world origin into minimap, then scale
    const mmMx = V.createSVGMatrix()
        .translate(
            pad + ((MINIMAP_W - pad * 2) - worldW * scale) / 2 - minX * scale,
            pad + ((MINIMAP_H - pad * 2) - worldH * scale) / 2 - minY * scale,
        )
        .scaleNonUniform(scale, scale)
        .multiply(baseMx);

    minimapPaper.matrix(mmMx);

    // Viewport rectangle: map screen corners through inverse main matrix → world,
    // then through minimap matrix → minimap pixels
    const mainMx = mainPaper.matrix();
    const mainInv = V.createSVGMatrix().multiply(mainMx).inverse();

    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 40;
    const sidebarW = 276;

    const vpScreenTL = { x: window.scrollX + sidebarW, y: window.scrollY + headerH };
    const vpScreenBR = { x: window.scrollX + window.innerWidth, y: window.scrollY + window.innerHeight };

    // Screen → model (world) coords
    const worldTL = applyMatrix(vpScreenTL.x, vpScreenTL.y, mainInv);
    const worldBR = applyMatrix(vpScreenBR.x, vpScreenBR.y, mainInv);

    // Model → minimap pixels via baseMx then minimap scale/translate
    const mmFullMx = minimapPaper.matrix();
    const mmInvBase = V.createSVGMatrix().multiply(baseMx).inverse();

    // world → base-transformed → minimap
    // But we need: screen-model coords → minimap pixels
    // screen-model (from mainInv) → paper-model: these are the same model space
    // paper-model → minimap: apply mmFullMx
    const mmTL = applyMatrix(worldTL.x, worldTL.y, mmFullMx);
    const mmBR = applyMatrix(worldBR.x, worldBR.y, mmFullMx);

    // For isometric view the viewport in model space is a parallelogram,
    // but approximating with a rect is good enough for the minimap
    const rx = Math.min(mmTL.x, mmBR.x);
    const ry = Math.min(mmTL.y, mmBR.y);
    const rr = Math.max(mmTL.x, mmBR.x);
    const rb = Math.max(mmTL.y, mmBR.y);

    viewportRect.setAttribute('x', String(Math.max(0, rx)));
    viewportRect.setAttribute('y', String(Math.max(0, ry)));
    viewportRect.setAttribute('width', String(Math.max(0, Math.min(MINIMAP_W, rr) - Math.max(0, rx))));
    viewportRect.setAttribute('height', String(Math.max(0, Math.min(MINIMAP_H, rb) - Math.max(0, ry))));
}

function applyMatrix(x: number, y: number, mx: SVGMatrix | DOMMatrix): { x: number; y: number } {
    return {
        x: mx.a * x + mx.c * y + mx.e,
        y: mx.b * x + mx.d * y + mx.f,
    };
}

function scrollToMinimapPoint(px: number, py: number): void {
    // Minimap pixel → model coords
    const mmMx = minimapPaper.matrix();
    const mmInv = V.createSVGMatrix().multiply(mmMx).inverse();
    const modelPt = applyMatrix(px, py, mmInv);

    // Model → main paper screen coords
    const mainMx = mainPaper.matrix();
    const screenPt = applyMatrix(modelPt.x, modelPt.y, mainMx);

    const headerH = (document.getElementById('top-header') as HTMLElement | null)?.offsetHeight ?? 40;
    const sidebarW = 276;
    const vpW = window.innerWidth - sidebarW;
    const vpH = window.innerHeight - headerH;

    window.scroll(
        Math.max(0, screenPt.x - sidebarW - vpW / 2),
        Math.max(0, screenPt.y - headerH - vpH / 2),
    );
}

export function showMinimap(): void {
    if (containerEl) {
        containerEl.style.display = '';
        scheduleUpdate();
    }
}

export function hideMinimap(): void {
    if (containerEl) containerEl.style.display = 'none';
}
