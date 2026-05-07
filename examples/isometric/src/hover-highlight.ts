import { dia, highlighters } from '@joint/core';

const HOVER_ID = 'hover-ring';
const COLOR = '#4589ff';
const COLOR_DARK = '#0f62fe';
const SEGMENT_COUNT = 6;
const GAP_PX = 6;
const STROKE_WIDTH = 1.8;
const BORDER_PX = 1;
const PAD = 17;
const SELECT_FADE_IN = 7;
const SELECT_FADE_OUT = 1;

let hoveredView: dia.CellView | null = null;
let hoveredCell: dia.Element | null = null;
let hoverGroup: SVGElement | null = null;
let hoveredZoneOrigFill: string | null = null;

interface RingEntry { group: SVGElement; view: dia.CellView }
const selectMap = new Map<string, RingEntry>();
const connMap = new Map<string, RingEntry>();
let selectDefsId = 0;

const CONN_COLOR = '#8d8d8d';
const CONN_COLOR_DARK = '#6f6f6f';

function buildDashArray(circumference: number): string {
    const totalGap = SEGMENT_COUNT * GAP_PX;
    const dash = (circumference - totalGap) / SEGMENT_COUNT;
    return `${dash} ${GAP_PX}`;
}

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
    if (hoverGroup && hoveredCell) syncGroupToCell(hoverGroup, hoveredCell);
    selectMap.forEach((entry) => {
        if (entry.group) syncGroupToCell(entry.group, entry.view.model as dia.Element);
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

    const cell = cellView.model as dia.Element;
    const isZone = !!cell.get('isFrame');

    if (isZone) {
        const { width, height } = cell.size();
        const { x, y } = cell.position();
        const paper = cellView.paper;
        if (!paper) return;

        const zoneColor = (cell.get('zoneColor') as string) || '#0072c3';
        const ns = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(ns, 'g');
        const filterId = `zone-hover-f-${++selectDefsId}`;
        const clipId = `zone-hover-c-${selectDefsId}`;

        const defs = document.createElementNS(ns, 'defs');

        const filter = document.createElementNS(ns, 'filter');
        filter.setAttribute('id', filterId);
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '140%');
        const blur = document.createElementNS(ns, 'feGaussianBlur');
        blur.setAttribute('in', 'SourceGraphic');
        blur.setAttribute('stdDeviation', '6');
        filter.appendChild(blur);
        defs.appendChild(filter);

        const clipPath = document.createElementNS(ns, 'clipPath');
        clipPath.setAttribute('id', clipId);
        const PAD_CLIP = 40;
        const outerRect = document.createElementNS(ns, 'rect');
        outerRect.setAttribute('x', String(x - PAD_CLIP));
        outerRect.setAttribute('y', String(y - PAD_CLIP));
        outerRect.setAttribute('width', String(width + PAD_CLIP * 2));
        outerRect.setAttribute('height', String(height + PAD_CLIP * 2));
        const innerRect = document.createElementNS(ns, 'rect');
        innerRect.setAttribute('x', String(x));
        innerRect.setAttribute('y', String(y));
        innerRect.setAttribute('width', String(width));
        innerRect.setAttribute('height', String(height));
        const clipRule = document.createElementNS(ns, 'path');
        clipRule.setAttribute('d',
            `M${x - PAD_CLIP},${y - PAD_CLIP}h${width + PAD_CLIP * 2}v${height + PAD_CLIP * 2}h${-(width + PAD_CLIP * 2)}Z` +
            `M${x},${y}v${height}h${width}v${-height}Z`
        );
        clipRule.setAttribute('clip-rule', 'evenodd');
        clipPath.appendChild(clipRule);
        defs.appendChild(clipPath);

        g.appendChild(defs);

        const glowRect = document.createElementNS(ns, 'rect');
        glowRect.setAttribute('x', String(x));
        glowRect.setAttribute('y', String(y));
        glowRect.setAttribute('width', String(width));
        glowRect.setAttribute('height', String(height));
        glowRect.setAttribute('fill', 'none');
        glowRect.setAttribute('stroke', zoneColor);
        glowRect.setAttribute('stroke-width', '4');
        glowRect.setAttribute('stroke-opacity', '0.3');
        glowRect.setAttribute('filter', `url(#${filterId})`);
        glowRect.setAttribute('clip-path', `url(#${clipId})`);
        g.appendChild(glowRect);

        hoveredZoneOrigFill = cell.attr('body/fill') as string;
        const rc = parseInt(zoneColor.slice(1, 3), 16);
        const gc = parseInt(zoneColor.slice(3, 5), 16);
        const bc = parseInt(zoneColor.slice(5, 7), 16);
        cell.attr('body/fill', `rgba(${rc}, ${gc}, ${bc}, 0.14)`);

        const cx = x + width / 2;
        const cy = y + height / 2;
        stampOrigin(g, cx, cy);
        const backLayer = paper.getLayerNode(dia.Paper.Layers.BACK);
        backLayer.appendChild(g);
        hoverGroup = g;
        hoveredCell = cell;
        return;
    }

    const { cx, cy, r } = getElementMetrics(cell);
    const hoverR = r + PAD;
    const circumference = 2 * Math.PI * hoverR;
    const totalGap = SEGMENT_COUNT * GAP_PX;
    const segLen = (circumference - totalGap) / SEGMENT_COUNT;

    const paper = cellView.paper;
    if (!paper) return;

    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('fill', 'none');
    g.style.transformOrigin = `${cx}px ${cy}px`;
    g.style.animation = 'nr-hover-spin 8s linear infinite';

    const halfW = STROKE_WIDTH / 2;
    const rOuter = hoverR + halfW;
    const rInner = hoverR - halfW;

    const bPad = BORDER_PX;
    const rOuterB = rOuter + bPad;
    const rInnerB = rInner - bPad;
    const anglePad = bPad / hoverR;

    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const startAngle = (i * (segLen + GAP_PX)) / hoverR;
        const endAngle = startAngle + segLen / hoverR;
        const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

        // Border path (slightly expanded)
        const bStart = startAngle - anglePad;
        const bEnd = endAngle + anglePad;
        const db = [
            `M${cx + rOuterB * Math.cos(bStart)},${cy + rOuterB * Math.sin(bStart)}`,
            `A${rOuterB},${rOuterB} 0 ${largeArc} 1 ${cx + rOuterB * Math.cos(bEnd)},${cy + rOuterB * Math.sin(bEnd)}`,
            `L${cx + rInnerB * Math.cos(bEnd)},${cy + rInnerB * Math.sin(bEnd)}`,
            `A${rInnerB},${rInnerB} 0 ${largeArc} 0 ${cx + rInnerB * Math.cos(bStart)},${cy + rInnerB * Math.sin(bStart)}`,
            'Z',
        ].join(' ');

        const border = document.createElementNS(ns, 'path');
        border.setAttribute('d', db);
        border.setAttribute('fill', COLOR_DARK);
        border.setAttribute('fill-opacity', '0.35');
        border.setAttribute('stroke', 'none');
        g.appendChild(border);

        // Fill path (exact size)
        const d = [
            `M${cx + rOuter * Math.cos(startAngle)},${cy + rOuter * Math.sin(startAngle)}`,
            `A${rOuter},${rOuter} 0 ${largeArc} 1 ${cx + rOuter * Math.cos(endAngle)},${cy + rOuter * Math.sin(endAngle)}`,
            `L${cx + rInner * Math.cos(endAngle)},${cy + rInner * Math.sin(endAngle)}`,
            `A${rInner},${rInner} 0 ${largeArc} 0 ${cx + rInner * Math.cos(startAngle)},${cy + rInner * Math.sin(startAngle)}`,
            'Z',
        ].join(' ');

        const seg = document.createElementNS(ns, 'path');
        seg.setAttribute('d', d);
        seg.setAttribute('fill', COLOR);
        seg.setAttribute('fill-opacity', '0.4');
        seg.setAttribute('stroke', 'none');
        g.appendChild(seg);
    }

    stampOrigin(g, cx, cy);
    const backLayer = paper.getLayerNode(dia.Paper.Layers.BACK);
    backLayer.appendChild(g);
    hoverGroup = g;
    hoveredCell = cell;
}

export function clearHover(): void {
    if (hoveredCell && hoveredCell.get('isFrame') && hoveredZoneOrigFill) {
        hoveredCell.attr('body/fill', hoveredZoneOrigFill);
        hoveredZoneOrigFill = null;
    }
    if (hoverGroup && hoverGroup.parentNode) {
        hoverGroup.parentNode.removeChild(hoverGroup);
    }
    hoverGroup = null;
    hoveredCell = null;

    if (hoveredView) {
        try { highlighters.mask.remove(hoveredView, HOVER_ID); } catch { /* ok */ }
    }
    hoveredView = null;
}

// ── Selection ───────────────────���────────────────────────────────────────

export function applySelect(cellView: dia.CellView): void {
    const cellId = cellView.model.id as string;
    if (selectMap.has(cellId)) return;

    const cell = cellView.model as dia.Element;
    const isZone = !!cell.get('isFrame');

    if (isZone) return;

    const paper = cellView.paper;
    if (!paper) return;

    const { cx, cy, r } = getElementMetrics(cell);
    const selectR = r + PAD - STROKE_WIDTH - 2;
    const uid = `sel-grad-${++selectDefsId}`;

    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');

    const defs = document.createElementNS(ns, 'defs');
    const gradient = document.createElementNS(ns, 'radialGradient');
    gradient.setAttribute('id', uid);
    gradient.setAttribute('cx', '50%');
    gradient.setAttribute('cy', '50%');
    gradient.setAttribute('r', '50%');

    const innerEdge = Math.max(0, (selectR - SELECT_FADE_IN) / selectR);
    const outerEdge = Math.max(0, (selectR - SELECT_FADE_OUT) / selectR);
    const strokeOpacity = 0.45;

    const stop1 = document.createElementNS(ns, 'stop');
    stop1.setAttribute('offset', '0');
    stop1.setAttribute('stop-color', COLOR);
    stop1.setAttribute('stop-opacity', '0');

    const stop2 = document.createElementNS(ns, 'stop');
    stop2.setAttribute('offset', String(innerEdge));
    stop2.setAttribute('stop-color', COLOR);
    stop2.setAttribute('stop-opacity', '0');

    const stop3 = document.createElementNS(ns, 'stop');
    stop3.setAttribute('offset', String(outerEdge));
    stop3.setAttribute('stop-color', COLOR);
    stop3.setAttribute('stop-opacity', String(strokeOpacity));

    const stop4 = document.createElementNS(ns, 'stop');
    stop4.setAttribute('offset', '1');
    stop4.setAttribute('stop-color', COLOR);
    stop4.setAttribute('stop-opacity', String(strokeOpacity));

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    gradient.appendChild(stop4);
    defs.appendChild(gradient);
    g.appendChild(defs);

    const outerRing = document.createElementNS(ns, 'circle');
    outerRing.setAttribute('cx', String(cx));
    outerRing.setAttribute('cy', String(cy));
    outerRing.setAttribute('r', String(selectR));
    outerRing.setAttribute('fill', `url(#${uid})`);
    outerRing.setAttribute('stroke', 'none');
    g.appendChild(outerRing);

    stampOrigin(g, cx, cy);
    const backLayer = paper.getLayerNode(dia.Paper.Layers.BACK);
    backLayer.appendChild(g);
    selectMap.set(cellId, { group: g, view: cellView });
}

function removeRingEntry(entry: RingEntry, cellId: string, maskPrefix: string): void {
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

// ── Connection highlights (grey select rings) ───────────────────────────

export function applyConnHighlight(cellView: dia.CellView): void {
    const cellId = cellView.model.id as string;
    if (connMap.has(cellId)) return;

    const cell = cellView.model as dia.Element;
    const paper = cellView.paper;
    if (!paper) return;

    const isZone = !!cell.get('isFrame');
    if (isZone) {
        const zoneId = `conn-ring-${cellId}`;
        highlighters.mask.add(cellView, 'body', zoneId, {
            layer: dia.Paper.Layers.BACK,
            attrs: {
                'stroke': CONN_COLOR,
                'stroke-width': 2.5,
                'stroke-opacity': '0.5',
                'fill': CONN_COLOR,
                'fill-opacity': '0.03',
            },
        });
        connMap.set(cellId, { group: null!, view: cellView });
        return;
    }

    const { cx, cy, r } = getElementMetrics(cell);
    const selectR = r + PAD - STROKE_WIDTH - 2;
    const uid = `conn-grad-${++selectDefsId}`;

    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');

    const defs = document.createElementNS(ns, 'defs');
    const gradient = document.createElementNS(ns, 'radialGradient');
    gradient.setAttribute('id', uid);
    gradient.setAttribute('cx', '50%');
    gradient.setAttribute('cy', '50%');
    gradient.setAttribute('r', '50%');

    const innerEdge = Math.max(0, (selectR - SELECT_FADE_IN) / selectR);
    const outerEdge = Math.max(0, (selectR - SELECT_FADE_OUT) / selectR);

    const stop1 = document.createElementNS(ns, 'stop');
    stop1.setAttribute('offset', '0');
    stop1.setAttribute('stop-color', CONN_COLOR);
    stop1.setAttribute('stop-opacity', '0');

    const stop2 = document.createElementNS(ns, 'stop');
    stop2.setAttribute('offset', String(innerEdge));
    stop2.setAttribute('stop-color', CONN_COLOR);
    stop2.setAttribute('stop-opacity', '0');

    const stop3 = document.createElementNS(ns, 'stop');
    stop3.setAttribute('offset', String(outerEdge));
    stop3.setAttribute('stop-color', CONN_COLOR);
    stop3.setAttribute('stop-opacity', '0.35');

    const stop4 = document.createElementNS(ns, 'stop');
    stop4.setAttribute('offset', '1');
    stop4.setAttribute('stop-color', CONN_COLOR);
    stop4.setAttribute('stop-opacity', '0.35');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    gradient.appendChild(stop4);
    defs.appendChild(gradient);
    g.appendChild(defs);

    const outerRing = document.createElementNS(ns, 'circle');
    outerRing.setAttribute('cx', String(cx));
    outerRing.setAttribute('cy', String(cy));
    outerRing.setAttribute('r', String(selectR));
    outerRing.setAttribute('fill', `url(#${uid})`);
    outerRing.setAttribute('stroke', 'none');
    g.appendChild(outerRing);

    stampOrigin(g, cx, cy);
    const backLayer = paper.getLayerNode(dia.Paper.Layers.BACK);
    backLayer.appendChild(g);
    connMap.set(cellId, { group: g, view: cellView });
}

export function clearConnHighlights(): void {
    connMap.forEach((entry, cellId) => removeRingEntry(entry, cellId, 'conn-ring'));
    connMap.clear();
}
