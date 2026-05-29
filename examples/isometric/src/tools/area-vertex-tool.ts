import { dia, elementTools, g, util } from '@joint/core';
import { GRID_SIZE } from '../theme';
import { showDragTooltip } from './drag-tooltip';

type Corner = 'tl' | 'tr' | 'br' | 'bl';
type CornerSpec = { style: string; radius: number };
type CornerMap = Partial<Record<Corner, CornerSpec>>;

// Filled black squares like Link waypoints / PowerPoint edit-points. Outer
// transparent rect is the larger hit target.
//
// JointJS' elementTools.Control requires the outer markup selector to be
// `handle`. The hover-gated opacity rule in style.css targets that selector,
// so we add an extra class (`nr-area-edit-handle`) and a matching CSS
// override keeps these handles permanently visible while in edit mode.
//
// Square size kept slightly smaller than the JointJS link waypoint circle
// (which uses r=6 → Ø12) so the two visually belong to the same family
// without being identical.
const HIT = 14;
const SQ = 5;

const VERTEX_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" class="nr-area-edit-handle" cursor="move">
        <rect stroke="none" fill="transparent" x="${-HIT/2}" y="${-HIT/2}" width="${HIT}" height="${HIT}"/>
        <rect class="nr-area-vertex" stroke="#ffffff" stroke-width="1" fill="#161616" x="${-SQ/2}" y="${-SQ/2}" width="${SQ}" height="${SQ}"/>
    </g>
`;

const MID_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" class="nr-area-edit-handle nr-area-edit-handle--mid" cursor="crosshair">
        <rect stroke="none" fill="transparent" x="${-HIT/2}" y="${-HIT/2}" width="${HIT}" height="${HIT}"/>
        <rect class="nr-area-vertex-mid" stroke="#ffffff" stroke-width="1" fill="#161616" fill-opacity="0.45" stroke-opacity="0.6" x="${-SQ/2}" y="${-SQ/2}" width="${SQ}" height="${SQ}"/>
    </g>
`;

function snap(v: number): number {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function readVerts(model: dia.Element): [number, number][] {
    const raw = (model.get('normalizedVerts') as [number, number][]) ?? [];
    return raw.map(v => [v[0], v[1]] as [number, number]);
}

function vertexPixel(model: dia.Element, idx: number): g.Point {
    const verts = readVerts(model);
    const { width, height } = model.size();
    const [nx, ny] = verts[idx] ?? [0, 0];
    return new g.Point(nx * width, ny * height);
}

/**
 * One handle per vertex of an Area path. Drag moves the vertex; coordinates
 * snap to the main grid. Right-click on the handle deletes that vertex
 * (min 3 enforced — fewer would collapse the polygon).
 *
 * Tools are recreated by Area.addPathEditTools() after every mutation so the
 * handle count and positions stay in sync with `normalizedVerts`.
 */
export class AreaVertexControl extends elementTools.Control {

    preinitialize() {
        this.options.selector = 'body';
        this.children = VERTEX_MARKUP;
    }

    protected getPosition(view: dia.ElementView): g.Point {
        const idx: number = this.options.index ?? 0;
        return vertexPixel(view.model, idx);
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point): void {
        const model = view.model;
        const idx: number = this.options.index ?? 0;
        const verts = readVerts(model);
        if (idx < 0 || idx >= verts.length) return;
        const { width, height } = model.size();
        const x = Math.max(0, Math.min(width, snap(coordinates.x)));
        const y = Math.max(0, Math.min(height, snap(coordinates.y)));
        verts[idx] = [x / width, y / height];
        pathEditDragHappened = true;
        model.set('normalizedVerts', verts);
    }
}

/**
 * Midpoint handle between two consecutive vertices. Rendered semi-transparent
 * to suggest "potential vertex" (Figma convention). Dragging it inserts a
 * new vertex at the midpoint and moves it; releasing without movement still
 * leaves the new vertex in place (cheap to delete via right-click).
 *
 * Mid-drag flow:
 *   - on first setPosition we splice a new vertex into normalizedVerts at
 *     edgeIdx+1 and flag `midDragActive` so the system-designer's tool
 *     rebuilder skips the count-change rebuild that would otherwise destroy
 *     the DOM element still under pointer capture.
 *   - subsequent setPosition calls move that same index.
 *   - on mouseup we clear the flag and fire `nr-area-mid-drag-end` so the
 *     system-designer can finally rebuild the tool list with the new vertex
 *     count.
 */

let midDragActive = false;
export function isAreaMidDragActive(): boolean { return midDragActive; }

// Tracks whether the latest path-edit interaction (vertex move or mid-handle
// insert) actually involved a drag. Cleared by the consumer after each
// pointerup so the next pointerup starts fresh.
let pathEditDragHappened = false;
export function consumePathEditDragHappened(): boolean {
    const v = pathEditDragHappened;
    pathEditDragHappened = false;
    return v;
}

if (typeof document !== 'undefined') {
    document.addEventListener('mouseup', () => {
        if (!midDragActive) return;
        midDragActive = false;
        pathEditDragHappened = false;
        // Defer the rebuild dispatch to the next frame. If we ran it
        // synchronously inside this mouseup handler, the resulting
        // paper.removeTools() would destroy the DOM element that the
        // browser is still tracking pointer-capture on (the mid-handle).
        // The browser holds onto that ghost capture and silently routes
        // all subsequent pointer events into the void — paper sees no
        // element:pointerup, no blank:pointerdown, nothing. By waiting
        // a frame, the browser releases capture cleanly before we
        // remove the node.
        requestAnimationFrame(() => {
            document.dispatchEvent(new CustomEvent('nr-area-mid-drag-end'));
        });
    });
}

export class AreaEdgeMidControl extends elementTools.Control {

    private inserted = false;

    preinitialize() {
        this.options.selector = 'body';
        this.children = MID_MARKUP;
    }

    protected getPosition(view: dia.ElementView): g.Point {
        const edgeIdx: number = this.options.edgeIndex ?? 0;
        const verts = readVerts(view.model);
        const n = verts.length;
        if (n === 0) return new g.Point(0, 0);
        const a = verts[edgeIdx % n];
        const b = verts[(edgeIdx + 1) % n];
        const { width, height } = view.model.size();
        return new g.Point(((a[0] + b[0]) / 2) * width, ((a[1] + b[1]) / 2) * height);
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point): void {
        const model = view.model;
        const edgeIdx: number = this.options.edgeIndex ?? 0;
        const verts = readVerts(model);
        const { width, height } = model.size();
        const x = Math.max(0, Math.min(width, snap(coordinates.x)));
        const y = Math.max(0, Math.min(height, snap(coordinates.y)));
        const nx = x / width;
        const ny = y / height;
        if (!this.inserted) {
            midDragActive = true;
            verts.splice(edgeIdx + 1, 0, [nx, ny]);
            this.inserted = true;
        } else {
            verts[edgeIdx + 1] = [nx, ny];
        }
        pathEditDragHappened = true;
        model.set('normalizedVerts', verts);
    }

    protected resetPosition(): void {
        this.inserted = false;
    }
}

// ── Corner radius adjuster ─────────────────────────────────────────────────
//
// Yellow diamond per corner (PowerPoint convention, same colour scheme as
// DoubleArrow's bar-thickness handle). Drag along the diagonal toward the
// shape's centre to increase the corner radius; the inspector's stepper
// reacts via `change:areaCorners`.

const YELLOW = '#f1c21b';
const DIAMOND_SQ = 6;
const DIAMOND_HIT = 14;

const DIAMOND_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" class="nr-area-corner-radius-handle" cursor="nwse-resize">
        <rect stroke="none" fill="transparent" x="${-DIAMOND_HIT/2}" y="${-DIAMOND_HIT/2}" width="${DIAMOND_HIT}" height="${DIAMOND_HIT}"/>
        <rect x="${-DIAMOND_SQ/2}" y="${-DIAMOND_SQ/2}" width="${DIAMOND_SQ}" height="${DIAMOND_SQ}" fill="${YELLOW}" stroke="#a56a00" stroke-width="0.5" rx="1" ry="1" transform="rotate(45)"/>
    </g>
`;

// Where on the corner geometry the diamond sits, expressed as a fraction of
// the corner radius along the diagonal toward the shape's centre:
//   cut style     → midpoint of the chamfer line          → r * 0.5
//   rounded style → midpoint of the arc (where the diag meets the arc)
//                   = r - r/√2 = r * (1 - 1/√2) ≈ r * 0.2929
// Anchoring the diamond on the visible cut/round means dragging it 1 px
// inward moves the cut 1 px inward — what PowerPoint does.
const DIAG_OFFSET_CUT     = 0.5;
const DIAG_OFFSET_ROUNDED = 1 - 1 / Math.SQRT2;

function diagOffsetFor(style: string | undefined): number {
    return style === 'cut' ? DIAG_OFFSET_CUT : DIAG_OFFSET_ROUNDED;
}

// Inward unit vector at a polygon vertex (along the angle bisector).
// For a 90° vertex the bisector is the diagonal — same convention as the
// rectangle case, generalised to arbitrary 90° corners.
function vertexInwardAxes(
    prev: [number, number],
    curr: [number, number],
    next: [number, number],
): { ux: number; uy: number } {
    const ax = prev[0] - curr[0], ay = prev[1] - curr[1];
    const bx = next[0] - curr[0], by = next[1] - curr[1];
    const mA = Math.hypot(ax, ay) || 1;
    const mB = Math.hypot(bx, by) || 1;
    const ux = ax / mA + bx / mB;
    const uy = ay / mA + by / mB;
    const m = Math.hypot(ux, uy) || 1;
    return { ux: ux / m, uy: uy / m };
}

export class AreaCornerRadiusControl extends elementTools.Control {

    preinitialize() {
        this.options.selector = 'body';
        this.children = DIAMOND_MARKUP;
    }

    protected getPosition(view: dia.ElementView): g.Point {
        const { width: w, height: h } = view.model.size();
        const vertexIndex = this.options.vertexIndex as number | undefined;

        // Polygon mode: place diamond along the inward bisector at vertex i.
        if (vertexIndex != null) {
            const verts = (view.model.get('normalizedVerts') as [number, number][]) ?? [];
            const n = verts.length;
            if (n < 3 || vertexIndex < 0 || vertexIndex >= n) return new g.Point(0, 0);
            const pix = verts.map(([nx, ny]) => [nx * w, ny * h] as [number, number]);
            const curr = pix[vertexIndex];
            const prev = pix[(vertexIndex - 1 + n) % n];
            const next = pix[(vertexIndex + 1) % n];
            const { ux, uy } = vertexInwardAxes(prev, curr, next);
            const radii = (view.model.get('vertexCornerRadii') as number[]) ?? [];
            const r = radii[vertexIndex] ?? 0;
            const style = (view.model.get('areaCorners') as CornerMap)?.tl?.style;
            const k = diagOffsetFor(style);
            // 90° corner → diagonal length to the cut/round midpoint is r * k * √2.
            const d = r * k * Math.SQRT2;
            return new g.Point(curr[0] + ux * d, curr[1] + uy * d);
        }

        // Rectangle mode.
        const corner: Corner = this.options.corner ?? 'tl';
        const corners = (view.model.get('areaCorners') as CornerMap) ?? {};
        const spec = corners[corner];
        const r = spec?.radius ?? 0;
        const k = diagOffsetFor(spec?.style);
        const d = r * k;
        switch (corner) {
            case 'tl': return new g.Point(d,     d);
            case 'tr': return new g.Point(w - d, d);
            case 'br': return new g.Point(w - d, h - d);
            case 'bl': return new g.Point(d,     h - d);
        }
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point): void {
        const { width: w, height: h } = view.model.size();
        const vertexIndex = this.options.vertexIndex as number | undefined;

        // Polygon mode.
        if (vertexIndex != null) {
            const verts = (view.model.get('normalizedVerts') as [number, number][]) ?? [];
            const n = verts.length;
            if (n < 3 || vertexIndex < 0 || vertexIndex >= n) return;
            const pix = verts.map(([nx, ny]) => [nx * w, ny * h] as [number, number]);
            const curr = pix[vertexIndex];
            const prev = pix[(vertexIndex - 1 + n) % n];
            const next = pix[(vertexIndex + 1) % n];
            const { ux, uy } = vertexInwardAxes(prev, curr, next);
            // Project cursor onto the inward bisector.
            const dx = coordinates.x - curr[0];
            const dy = coordinates.y - curr[1];
            const d = Math.max(0, dx * ux + dy * uy);
            const style = (view.model.get('areaCorners') as CornerMap)?.tl?.style;
            const k = diagOffsetFor(style);
            // Inverse of getPosition formula: d = r * k * √2 → r = d / (k * √2).
            const lenP = Math.hypot(prev[0] - curr[0], prev[1] - curr[1]);
            const lenN = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
            const limit = Math.min(lenP, lenN) / 2;
            const r = Math.max(0, Math.min(limit, Math.round(d / (k * Math.SQRT2))));
            const prevRadii = (view.model.get('vertexCornerRadii') as number[]) ?? [];
            const nextRadii = prevRadii.slice();
            // Pad to current vertex count so the index lands correctly.
            while (nextRadii.length < n) nextRadii.push(0);
            nextRadii[vertexIndex] = r;
            view.model.set('vertexCornerRadii', nextRadii);
            showDragTooltip(`${r}px`);
            return;
        }

        // Rectangle mode.
        const corner: Corner = this.options.corner ?? 'tl';
        const prev = (view.model.get('areaCorners') as CornerMap) ?? {};
        const prevSpec = prev[corner] ?? { style: 'rounded', radius: 0 };
        const k = diagOffsetFor(prevSpec.style);
        let dx = 0, dy = 0;
        switch (corner) {
            case 'tl': dx = coordinates.x;     dy = coordinates.y;     break;
            case 'tr': dx = w - coordinates.x; dy = coordinates.y;     break;
            case 'br': dx = w - coordinates.x; dy = h - coordinates.y; break;
            case 'bl': dx = coordinates.x;     dy = h - coordinates.y; break;
        }
        const mean = (Math.max(0, dx) + Math.max(0, dy)) / 2;
        const limit = Math.max(0, Math.min(w, h) / 2);
        const r = Math.max(0, Math.min(limit, Math.round(mean / k)));
        const next: CornerMap = { ...prev, [corner]: { ...prevSpec, radius: r } };
        view.model.set('areaCorners', next);
        showDragTooltip(`${r}px`);
    }
}
