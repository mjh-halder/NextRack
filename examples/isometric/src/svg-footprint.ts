/**
 * SVG footprint parser for the Component Designer's custom SVG layer feature.
 *
 * Extracts a closed polygon outline from an uploaded SVG file and returns
 * normalized [0..1] vertex coordinates that can be used as an isometric
 * shape footprint.
 *
 * Constraints enforced by this module:
 *  - Only <path>, <polygon>, <polyline>, and <rect> elements are inspected.
 *  - The element with the largest bounding-box area is selected.
 *  - <path> elements are sampled at 48 equidistant points via getTotalLength /
 *    getPointAtLength; curves are approximated as polygon vertices.
 *  - SVG transforms are ignored (MVP limitation).
 *  - The resulting vertices are normalized so the longest axis = 1.0 and the
 *    shorter axis < 1.0, both starting from 0. At render time the caller
 *    applies aspect-ratio-preserving letterbox scaling into the layer W×H box.
 */

export interface SvgParseResult {
    normVerts: [number, number][];
    error?: string;
}

const SAMPLE_COUNT = 48;

export function parseSvgFootprint(svgString: string): SvgParseResult {
    // ── 1. Parse the SVG document ─────────────────────────────────────────────
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    if (doc.querySelector('parsererror')) {
        return { normVerts: [], error: 'Invalid SVG: the file could not be parsed.' };
    }

    // ── 2. Collect candidate elements ─────────────────────────────────────────
    const pathEls    = Array.from(doc.querySelectorAll('path'));
    const polygonEls = Array.from(doc.querySelectorAll('polygon, polyline'));
    const rectEls    = Array.from(doc.querySelectorAll('rect'));

    if (pathEls.length + polygonEls.length + rectEls.length === 0) {
        return {
            normVerts: [],
            error: 'No usable elements found. SVG must contain a <path>, <polygon>, or <rect>.',
        };
    }

    // ── 3. Attach a hidden scratch SVG to the DOM (needed for path DOM methods) ─
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    tempSvg.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;' +
        'width:1px;height:1px;overflow:hidden;left:-9999px;top:-9999px;';
    document.body.appendChild(tempSvg);

    interface Candidate { points: [number, number][]; area: number; }
    const candidates: Candidate[] = [];

    try {
        // ── <path> elements — sampled via getTotalLength / getPointAtLength ──
        for (const el of pathEls) {
            const d = el.getAttribute('d');
            if (!d || !d.trim()) continue;

            const pathEl = document.createElementNS(
                'http://www.w3.org/2000/svg', 'path'
            ) as SVGPathElement;
            pathEl.setAttribute('d', d);
            tempSvg.appendChild(pathEl);

            let totalLen: number;
            let bbox: DOMRect;
            try {
                totalLen = pathEl.getTotalLength();
                bbox     = pathEl.getBBox();
            } catch {
                tempSvg.removeChild(pathEl);
                continue;
            }

            if (totalLen < 1 || bbox.width < 1 || bbox.height < 1) {
                tempSvg.removeChild(pathEl);
                continue;
            }

            const points: [number, number][] = [];
            for (let i = 0; i < SAMPLE_COUNT; i++) {
                const t  = (i / SAMPLE_COUNT) * totalLen;
                const pt = pathEl.getPointAtLength(t);
                points.push([pt.x, pt.y]);
            }

            candidates.push({ points, area: bbox.width * bbox.height });
            tempSvg.removeChild(pathEl);
        }

        // ── <polygon> / <polyline> — points parsed directly from attribute ──
        for (const el of polygonEls) {
            const pts = parsePointsAttribute(el.getAttribute('points') ?? '');
            if (pts.length < 3) continue;
            const bb = bboxOf(pts);
            if (bb.w < 1 || bb.h < 1) continue;
            candidates.push({ points: pts, area: bb.w * bb.h });
        }

        // ── <rect> — four corners from x/y/width/height attributes ──────────
        for (const el of rectEls) {
            const x = parseFloat(el.getAttribute('x')      ?? '0');
            const y = parseFloat(el.getAttribute('y')      ?? '0');
            const w = parseFloat(el.getAttribute('width')  ?? '0');
            const h = parseFloat(el.getAttribute('height') ?? '0');
            if (isNaN(w) || isNaN(h) || w < 1 || h < 1) continue;
            const pts: [number, number][] = [
                [x,     y    ],
                [x + w, y    ],
                [x + w, y + h],
                [x,     y + h],
            ];
            candidates.push({ points: pts, area: w * h });
        }

    } finally {
        document.body.removeChild(tempSvg);
    }

    if (candidates.length === 0) {
        return {
            normVerts: [],
            error: 'No usable geometry found. Use a simple closed-outline SVG.',
        };
    }

    // ── 4. Pick the largest element ───────────────────────────────────────────
    candidates.sort((a, b) => b.area - a.area);
    const best = candidates[0].points;

    // ── 5. Normalize: translate to origin, scale so max dimension = 1.0 ──────
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of best) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    const svgW = maxX - minX;
    const svgH = maxY - minY;
    if (svgW < 1 || svgH < 1) {
        return { normVerts: [], error: 'Shape bounding box is too small.' };
    }

    // Both axes start at 0; the longer axis reaches exactly 1.0.
    // The shorter axis reaches < 1.0 — letterbox offset is applied at render time.
    const scale = 1 / Math.max(svgW, svgH);
    const normVerts: [number, number][] = best.map(([x, y]) => [
        (x - minX) * scale,
        (y - minY) * scale,
    ]);

    return { normVerts };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePointsAttribute(s: string): [number, number][] {
    const nums = s.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    const result: [number, number][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
        result.push([nums[i], nums[i + 1]]);
    }
    return result;
}

function bboxOf(pts: [number, number][]): { w: number; h: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return { w: maxX - minX, h: maxY - minY };
}
