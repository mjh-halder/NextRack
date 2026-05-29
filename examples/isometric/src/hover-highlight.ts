import { dia, highlighters } from '@joint/core';
import { SHAPE_CELL_SIZE } from './nextrack-theme';

const HOVER_ID = 'hover-ring';
const COLOR = '#4589ff';

let hoveredView: dia.CellView | null = null;

interface RingEntry { group: SVGElement; view: dia.CellView }
const selectMap = new Map<string, RingEntry>();
const connMap = new Map<string, RingEntry>();

const CONN_COLOR = '#8d8d8d';

function syncGroupToCell(g: SVGElement, cell: dia.Element): void {
    const { cx, cy } = getElementMetrics(cell);
    const origCx = parseFloat(g.getAttribute('data-ox') || String(cx));
    const origCy = parseFloat(g.getAttribute('data-oy') || String(cy));
    g.setAttribute('transform', `translate(${cx - origCx},${cy - origCy})`);
}

function stampOrigin(g: SVGElement, cx: number, cy: number): void {
    g.setAttribute('data-ox', String(cx));
    g.setAttribute('data-oy', String(cy));
}

/** Call on every pointermove to keep all rings in sync with their elements. */
export function syncAllRings(): void {
    selectMap.forEach((entry) => {
        if (entry.group && !entry.group.hasAttribute('data-embedded')) {
            syncGroupToCell(entry.group, entry.view.model as dia.Element);
        }
    });
    connMap.forEach((entry) => {
        if (entry.group) syncGroupToCell(entry.group, entry.view.model as dia.Element);
    });
}

function getElementMetrics(cell: dia.Element) {
    const { width, height } = cell.size();
    const { x, y } = cell.position();
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.max(width, height) / 2;
    return { cx, cy, r };
}

// ── Hover ───────��──────────────────────────��─────────────────────────────

export function applyHover(cellView: dia.CellView): void {
    if (hoveredView === cellView) return;
    clearHover();
    hoveredView = cellView;

    cellView.el.style.filter = 'brightness(1.1)';
}

export function clearHover(): void {
    if (hoveredView) {
        hoveredView.el.style.filter = '';
        try { highlighters.mask.remove(hoveredView, HOVER_ID); } catch { /* ok */ }
    }
    hoveredView = null;
}

// ── Selection ───────────────────���────────────────────────────────────────


function getVisualBounds(cell: dia.Element): { x: number; y: number; width: number; height: number } {
    const { width, height } = cell.size();
    const { x, y } = cell.position();
    // In 2D the shape collapses to a default-cell icon centered on the cell —
    // the selection outline follows that visual, not the underlying cell size.
    if (cell.get('viewMode') === '2d') {
        const G = SHAPE_CELL_SIZE;
        return { x: x + (width - G) / 2, y: y + (height - G) / 2, width: G, height: G };
    }
    const rot = (cell.get('labelRotation') as number) || 0;
    if (rot === 270 || rot === 90) {
        const cx = x + width / 2;
        const cy = y + height / 2;
        return { x: cx - height / 2, y: cy - width / 2, width: height, height: width };
    }
    return { x, y, width, height };
}

function syncSelectGroup(g: SVGElement, cell: dia.Element): void {
    const { x, y, width, height } = getVisualBounds(cell);
    const isEmbedded = g.hasAttribute('data-embedded');
    const ox = isEmbedded ? x - cell.position().x : x;
    const oy = isEmbedded ? y - cell.position().y : y;
    const pad = 2;
    const rects = g.querySelectorAll('rect');
    if (rects.length >= 2) {
        rects[0].setAttribute('x', String(ox - pad));
        rects[0].setAttribute('y', String(oy - pad));
        rects[0].setAttribute('width', String(width + pad * 2));
        rects[0].setAttribute('height', String(height + pad * 2));
        rects[1].setAttribute('x', String(ox - pad + 0.5));
        rects[1].setAttribute('y', String(oy - pad + 0.5));
        rects[1].setAttribute('width', String(width + pad * 2 - 1));
        rects[1].setAttribute('height', String(height + pad * 2 - 1));
    }
    if (rects.length >= 6) {
        const corners = [
            [ox - pad, oy - pad],
            [ox + width + pad, oy - pad],
            [ox - pad, oy + height + pad],
            [ox + width + pad, oy + height + pad],
        ];
        for (let i = 0; i < 4; i++) {
            rects[i + 2].setAttribute('x', String(corners[i][0] - SQ / 2));
            rects[i + 2].setAttribute('y', String(corners[i][1] - SQ / 2));
        }
    }
    if (!isEmbedded) {
        stampOrigin(g, x + width / 2, y + height / 2);
        g.removeAttribute('transform');
    }
}

export function refreshSelect(cell: dia.Cell): void {
    const entry = selectMap.get(cell.id as string);
    if (entry?.group) syncSelectGroup(entry.group, cell as dia.Element);
}

const SQ = 5;

function buildSelectRects(g: SVGElement, ns: string, x: number, y: number, w: number, h: number, resizable: boolean, pad = 0): void {
    const outerRect = document.createElementNS(ns, 'rect');
    outerRect.setAttribute('x', String(x - pad));
    outerRect.setAttribute('y', String(y - pad));
    outerRect.setAttribute('width', String(w + pad * 2));
    outerRect.setAttribute('height', String(h + pad * 2));
    outerRect.setAttribute('fill', 'none');
    outerRect.setAttribute('stroke', '#000000');
    outerRect.setAttribute('stroke-width', '0.5');
    outerRect.setAttribute('rx', '1'); outerRect.setAttribute('ry', '1');
    g.appendChild(outerRect);

    const innerRect = document.createElementNS(ns, 'rect');
    innerRect.setAttribute('x', String(x - pad + 0.5));
    innerRect.setAttribute('y', String(y - pad + 0.5));
    innerRect.setAttribute('width', String(w + pad * 2 - 1));
    innerRect.setAttribute('height', String(h + pad * 2 - 1));
    innerRect.setAttribute('fill', 'none');
    innerRect.setAttribute('stroke', '#ffffff');
    innerRect.setAttribute('stroke-width', '0.5');
    innerRect.setAttribute('rx', '1'); innerRect.setAttribute('ry', '1');
    g.appendChild(innerRect);

    if (resizable) {
        const filterId = 'nr-sq-shadow';
        const svgRoot = g.closest('svg') ?? g.ownerSVGElement;
        if (svgRoot && !svgRoot.getElementById(filterId)) {
            let defs = svgRoot.querySelector('defs') as SVGDefsElement | null;
            if (!defs) { defs = document.createElementNS(ns, 'defs') as SVGDefsElement; svgRoot.insertBefore(defs, svgRoot.firstChild); }
            const filter = document.createElementNS(ns, 'filter');
            filter.setAttribute('id', filterId);
            filter.setAttribute('x', '-100%'); filter.setAttribute('y', '-100%');
            filter.setAttribute('width', '300%'); filter.setAttribute('height', '300%');
            const flood = document.createElementNS(ns, 'feFlood');
            flood.setAttribute('flood-color', '#000000');
            flood.setAttribute('flood-opacity', '0.45');
            flood.setAttribute('result', 'shadow-color');
            filter.appendChild(flood);
            const comp = document.createElementNS(ns, 'feComposite');
            comp.setAttribute('in', 'shadow-color'); comp.setAttribute('in2', 'SourceGraphic');
            comp.setAttribute('operator', 'in'); comp.setAttribute('result', 'shadow');
            filter.appendChild(comp);
            const blur = document.createElementNS(ns, 'feGaussianBlur');
            blur.setAttribute('in', 'shadow'); blur.setAttribute('stdDeviation', '1.2');
            blur.setAttribute('result', 'shadow-blur');
            filter.appendChild(blur);
            const offset = document.createElementNS(ns, 'feOffset');
            offset.setAttribute('in', 'shadow-blur'); offset.setAttribute('dx', '0'); offset.setAttribute('dy', '1');
            offset.setAttribute('result', 'shadow-offset');
            filter.appendChild(offset);
            const merge = document.createElementNS(ns, 'feMerge');
            const m1 = document.createElementNS(ns, 'feMergeNode'); m1.setAttribute('in', 'shadow-offset');
            const m2 = document.createElementNS(ns, 'feMergeNode'); m2.setAttribute('in', 'SourceGraphic');
            merge.appendChild(m1); merge.appendChild(m2);
            filter.appendChild(merge);
            defs.appendChild(filter);
        }
        const corners = [
            [x - pad, y - pad],
            [x + w + pad, y - pad],
            [x - pad, y + h + pad],
            [x + w + pad, y + h + pad],
        ];
        for (const [cx, cy] of corners) {
            const sq = document.createElementNS(ns, 'rect');
            sq.setAttribute('x', String(cx - SQ / 2));
            sq.setAttribute('y', String(cy - SQ / 2));
            sq.setAttribute('width', String(SQ));
            sq.setAttribute('height', String(SQ));
            sq.setAttribute('fill', '#ffffff');
            sq.setAttribute('stroke', '#8d8d8d');
            sq.setAttribute('stroke-width', '0.5');
            sq.setAttribute('rx', '1');
            sq.setAttribute('ry', '1');
            sq.setAttribute('filter', `url(#${filterId})`);
            sq.classList.add('nr-select-resize-square');
            g.appendChild(sq);
        }
    }
}

export function applySelect(cellView: dia.CellView): void {
    const cellId = cellView.model.id as string;
    if (selectMap.has(cellId)) return;

    const cell = cellView.model as dia.Element;
    const paper = cellView.paper;
    if (!paper) return;

    // For regular components we want the outline inserted INTO the CELLS
    // layer, just before the cell view, so the shape paints over the
    // outline (no see-through edges). If the view isn't in CELLS yet —
    // typical right after graph.addCell() before JointJS mounts it —
    // defer to the next frame instead of falling back to FRONT.
    const isZone  = !!cell.get('isFrame');
    const isArea  = !!cell.get('isArea');
    const isIcon  = !!cell.get('isIcon');
    const isLabel = !!cell.get('isGridLabel');
    const isSpecialOverlay = isZone || isArea || isIcon || isLabel;
    if (!isSpecialOverlay) {
        const cellsLayer = paper.getLayerNode(dia.Paper.Layers.CELLS);
        if (cellView.el.parentNode !== cellsLayer) {
            requestAnimationFrame(() => applySelect(cellView));
            return;
        }
    }

    const { x, y, width, height } = getVisualBounds(cell);
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');

    const resizable = isZone || isArea || isLabel || isIcon;
    buildSelectRects(g, ns, x, y, width, height, resizable, 2);

    if (isZone) {
        const zoneColor = (cell.get('zoneColor') as string) || '#0072c3';
        g.setAttribute('data-zone-orig-fill', (cell.attr('body/fill') as string) || '');
        const rc = parseInt(zoneColor.slice(1, 3), 16);
        const gc2 = parseInt(zoneColor.slice(3, 5), 16);
        const bc = parseInt(zoneColor.slice(5, 7), 16);
        cell.attr('body/fill', `rgba(${rc}, ${gc2}, ${bc}, 0.12)`);
        g.setAttribute('data-zone-select', 'true');
    }

    // Make tool handles visible using the same class the hover system uses.
    // Defer to ensure tools added in the same frame are caught.
    const markToolsVisible = () => {
        paper.el.querySelectorAll('.joint-tools').forEach(el => el.classList.add('nr-tools--hover'));
    };
    markToolsVisible();
    requestAnimationFrame(markToolsVisible);

    g.setAttribute('pointer-events', 'none');

    if (isIcon) {
        // Embed inside the element's own SVG so it renders behind the icon image
        // but stays perfectly aligned. Rebuild rects in element-local coords.
        g.setAttribute('data-embedded', '1');
        g.innerHTML = '';
        const localX = x - cell.position().x;
        const localY = y - cell.position().y;
        buildSelectRects(g, ns, localX, localY, width, height, true, 2);
        cellView.el.insertBefore(g, cellView.el.firstChild);
    } else if (isZone || isArea) {
        stampOrigin(g, x + width / 2, y + height / 2);
        paper.getLayerNode(dia.Paper.Layers.FRONT).appendChild(g);
    } else {
        // Components: insert into CELLS layer just before the element so the
        // outline sits above areas/zones but behind other components.
        stampOrigin(g, x + width / 2, y + height / 2);
        const cellsLayer = paper.getLayerNode(dia.Paper.Layers.CELLS);
        if (cellView.el.parentNode === cellsLayer) {
            cellsLayer.insertBefore(g, cellView.el);
        } else {
            paper.getLayerNode(dia.Paper.Layers.FRONT).appendChild(g);
        }
    }
    selectMap.set(cellId, { group: g, view: cellView });
}

function restoreSelectState(entry: RingEntry): void {
    if (!entry.group) return;
    entry.view.paper?.el.querySelectorAll('.joint-tools.nr-tools--hover').forEach(el => {
        el.classList.remove('nr-tools--hover');
    });
    const origFill = entry.group.getAttribute('data-zone-orig-fill');
    if (origFill !== null) {
        const cell = entry.view.model as dia.Element;
        cell.attr('body/fill', origFill || null);
    }
}

function removeRingEntry(entry: RingEntry, cellId: string, maskPrefix: string): void {
    restoreSelectState(entry);
    if (entry.group && entry.group.parentNode) {
        entry.group.parentNode.removeChild(entry.group);
    }
    try { highlighters.mask.remove(entry.view, `${maskPrefix}-${cellId}`); } catch { /* ok */ }
}

export function clearSelectFor(cellView: dia.CellView): void {
    const cellId = cellView.model.id as string;
    const entry = selectMap.get(cellId);
    if (!entry) return;
    removeRingEntry(entry, cellId, 'select-ring');
    selectMap.delete(cellId);
}

export function clearSelect(): void {
    selectMap.forEach((entry, cellId) => removeRingEntry(entry, cellId, 'select-ring'));
    selectMap.clear();
}

/**
 * Recolour the selection outline of a given cell (Area path-edit mode uses
 * this to turn the outline red instead of stacking a second red stroke on
 * the shape body). Pass `null` to restore the default black/white outline.
 *
 * Also hides the white resize squares while accented — they would conflict
 * visually with the vertex/midpoint handles of the path-edit tools.
 */
export function setSelectOutlineAccent(cellId: string, color: string | null): void {
    const entry = selectMap.get(cellId);
    if (!entry?.group) return;
    const rects = entry.group.querySelectorAll<SVGRectElement>(':scope > rect');
    // Convention: rect[0] = outer (black 0.5), rect[1] = inner (white 0.5).
    const [outer, inner] = [rects[0], rects[1]];
    if (color) {
        if (outer) { outer.setAttribute('stroke', color); outer.setAttribute('stroke-width', '1.5'); }
        if (inner) inner.setAttribute('stroke', color);
    } else {
        if (outer) { outer.setAttribute('stroke', '#000000'); outer.setAttribute('stroke-width', '0.5'); }
        if (inner) inner.setAttribute('stroke', '#ffffff');
    }
    entry.group.querySelectorAll<SVGRectElement>('.nr-select-resize-square').forEach(sq => {
        sq.style.display = color ? 'none' : '';
    });
}

// ── Connection highlights (grey select rings) ───────────────────────────

export function applyConnHighlight(cellView: dia.CellView): void {
    const cellId = cellView.model.id as string;
    if (connMap.has(cellId)) return;

    const cell = cellView.model as dia.Element;
    const paper = cellView.paper;
    if (!paper) return;

    if (cell.get('isFrame')) {
        const zoneId = `conn-ring-${cellId}`;
        highlighters.mask.add(cellView, 'body', zoneId, {
            layer: dia.Paper.Layers.BACK,
            attrs: {
                'stroke': CONN_COLOR,
                'stroke-width': 1,
                'fill': 'none',
            },
        });
        connMap.set(cellId, { group: null!, view: cellView });
        return;
    }

    const { width, height } = cell.size();
    const { x, y } = cell.position();
    const pad = 4;
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');

    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', String(x - pad));
    rect.setAttribute('y', String(y - pad));
    rect.setAttribute('width', String(width + pad * 2));
    rect.setAttribute('height', String(height + pad * 2));
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', CONN_COLOR);
    rect.setAttribute('stroke-width', '1');
    g.appendChild(rect);

    stampOrigin(g, x + width / 2, y + height / 2);
    const backLayer = paper.getLayerNode(dia.Paper.Layers.BACK);
    backLayer.appendChild(g);
    connMap.set(cellId, { group: g, view: cellView });
}

export function clearConnHighlights(): void {
    connMap.forEach((entry, cellId) => removeRingEntry(entry, cellId, 'conn-ring'));
    connMap.clear();
}
