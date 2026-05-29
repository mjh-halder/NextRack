/*
 * NextRack PolygonShape / RectangleShape / ProportionalRectangleShape
 * extracted from src/shapes/isometric-shape.ts per ADR-0006.
 *
 * These are NextRack-authored classes; the base IsometricShape they extend
 * remains in the original (MPL-2.0) file under src/shapes/isometric-shape.ts.
 */

import { elementTools } from '@joint/core';
import { SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { NextrackSizeControl, NextrackProportionalSizeControl, NextrackCenterBasedHeightControl, NEXTRACK_CONNECT_TOOL_PRESET } from '../../tools';

// ── PolygonShape ──────────────────────────────────────────────────────────────
// Abstract base for polygon-based isometric shapes.
//
// Subclasses implement `baseVertices()` returning a clockwise [x,y][] footprint.
// All faces — base, top, straight sides, and curved corner strips — are derived
// from that single array plus `cornerRadius` and `isometricHeight`.
//
// The `cornerRadius` attribute is read reactively from the model; set it via
// `shape.set('cornerRadius', n)` to trigger an SVG re-render.

export abstract class PolygonShape extends NextrackIsometricShape {

    get cornerRadius(): number {
        return this.get('cornerRadius') ?? 0;
    }

    get chamferSize(): number {
        return this.get('chamferSize') ?? 0;
    }

    /** Fraction (0–1) of the isometric height at which the top chamfer starts. */
    get chamferStart(): number {
        return this.get('chamferStart') ?? 0;
    }

    get chamferBottomSize(): number {
        return this.get('chamferBottomSize') ?? 0;
    }

    get chamferBottomStart(): number {
        return this.get('chamferBottomStart') ?? 0;
    }

    /** Override in each subclass: clockwise [x, y] vertices of the 2D footprint. */
    abstract baseVertices(): Array<[number, number]>;

    protected shedRoofDrops(): number[] {
        const drop = this.shedRoofDrop;
        const n = this.baseVertices().length;
        if (drop === 0 || n !== 4) return new Array(n).fill(0);
        const d = Math.min(drop, this.isometricHeight);
        const dir = this.shedRoofDirection;
        switch (dir) {
            case 'front': return [0, 0, d, d];
            case 'right': return [0, d, d, 0];
            case 'back':  return [d, d, 0, 0];
            case 'left':  return [d, 0, 0, d];
        }
    }

    topVertices(): Array<[number, number]> {
        const base = this.baseVertices();
        const iH = this.isometricHeight;
        const drops = this.shedRoofDrops();
        const { width: w, height: h } = this.size();
        const cx = w / 2;
        const cy = h / 2;
        const tw = this.twist * Math.PI / 180;
        const stx = this.scaleTopX;
        const sty = this.scaleTopY;
        const hasMod = tw !== 0 || stx !== 1 || sty !== 1;
        const rot = (this.get('shapeRotation') as number) ?? 0;

        return base.map(([x, y], i) => {
            const effH = iH - drops[i];
            const dx = rot === 90 ? 0 : -effH;
            const dy = -effH;
            let tx = x + dx;
            let ty = y + dy;
            if (hasMod) {
                let lx = x - cx;
                let ly = y - cy;
                lx *= stx;
                ly *= sty;
                if (tw !== 0) {
                    const cos = Math.cos(tw);
                    const sin = Math.sin(tw);
                    const rx = lx * cos - ly * sin;
                    const ry = lx * sin + ly * cos;
                    lx = rx;
                    ly = ry;
                }
                tx = cx + lx + dx;
                ty = cy + ly + dy;
            }
            return [tx, ty] as [number, number];
        });
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    // Clamp r so arcs at vertex i never overlap the adjacent arcs on the same edge.
    private effectiveR(verts: Array<[number, number]>, i: number, r: number): number {
        if (r <= 0) return 0;
        const n = verts.length;
        const prev = verts[(i + n - 1) % n];
        const curr = verts[i];
        const next = verts[(i + 1) % n];
        const inLen  = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
        const outLen = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
        return Math.min(r, inLen / 2, outLen / 2);
    }

    /** Point on the incoming edge at distance r from vertex i (arc entry point). */
    protected arcEntry(verts: Array<[number, number]>, i: number, r: number): [number, number] {
        const n = verts.length;
        const rE = this.effectiveR(verts, i, r);
        const prev = verts[(i + n - 1) % n];
        const curr = verts[i];
        const dx = curr[0] - prev[0];
        const dy = curr[1] - prev[1];
        const len = Math.hypot(dx, dy);
        // Degenerate edge (zero length, e.g. all top vertices collapsed to a
        // pyramid apex via scaleTopX=scaleTopY=0): no direction to step along,
        // return the vertex itself.
        if (len === 0) return [curr[0], curr[1]];
        return [curr[0] - dx / len * rE, curr[1] - dy / len * rE];
    }

    /** Point on the outgoing edge at distance r from vertex i (arc exit point). */
    protected arcExit(verts: Array<[number, number]>, i: number, r: number): [number, number] {
        const n = verts.length;
        const rE = this.effectiveR(verts, i, r);
        const curr = verts[i];
        const next = verts[(i + 1) % n];
        const dx = next[0] - curr[0];
        const dy = next[1] - curr[1];
        const len = Math.hypot(dx, dy);
        if (len === 0) return [curr[0], curr[1]];
        return [curr[0] + dx / len * rE, curr[1] + dy / len * rE];
    }

    // ── Path generators ───────────────────────────────────────────────────────

    /**
     * SVG path `d` for the rounded polygon footprint.
     * At r=0 produces a standard closed polygon path.
     * Clockwise winding → sweep-flag 1 for correct arc direction.
     */
    protected footprintPath(verts: Array<[number, number]>, r: number): string {
        const n = verts.length;
        if (r <= 0) {
            return 'M ' + verts.map(([x, y]) => `${x} ${y}`).join(' L ') + ' Z';
        }
        const firstExit = this.arcExit(verts, 0, r);
        let d = `M ${firstExit[0]} ${firstExit[1]}`;
        for (let k = 0; k < n; k++) {
            const j = (k + 1) % n;
            const [ex, ey] = this.arcEntry(verts, j, r);
            const [fx, fy] = this.arcExit(verts, j, r);
            d += ` L ${ex} ${ey} A ${r} ${r} 0 0 1 ${fx} ${fy}`;
        }
        return d + ' Z';
    }

    /**
     * `points` string for a straight parallelogram side face between edge i→j.
     * Start/end are arc-clipped so corner panels fit seamlessly between them.
     */
    protected straightFacePoints(i: number, j: number): string {
        const verts = this.baseVertices();
        const tVerts = this.topVertices();
        const r  = this.cornerRadius;
        const [x0, y0] = this.arcExit(verts, i, r);
        const [x1, y1] = this.arcEntry(verts, j, r);
        const [tx0, ty0] = this.arcExit(tVerts, i, r);
        const [tx1, ty1] = this.arcEntry(tVerts, j, r);
        return `${x0},${y0} ${x1},${y1} ${tx1},${ty1} ${tx0},${ty0}`;
    }

    protected straightFacePath(i: number, j: number): string {
        const verts = this.baseVertices();
        const tVerts = this.topVertices();
        const r  = this.cornerRadius;
        const [x0, y0] = this.arcExit(verts, i, r);
        const [x1, y1] = this.arcEntry(verts, j, r);
        const [tx0, ty0] = this.arcExit(tVerts, i, r);
        const [tx1, ty1] = this.arcEntry(tVerts, j, r);
        return `M ${x0} ${y0} L ${x1} ${y1} L ${tx1} ${ty1} L ${tx0} ${ty0} Z`;
    }

    protected cornerFacePath(i: number): string {
        const verts = this.baseVertices();
        const r  = this.cornerRadius;
        if (r <= 0) return '';
        const tVerts = this.topVertices();
        const [ax, ay] = this.arcEntry(verts, i, r);
        const [bx, by] = this.arcExit(verts, i, r);
        const [tax, tay] = this.arcEntry(tVerts, i, r);
        const [tbx, tby] = this.arcExit(tVerts, i, r);
        return [
            `M ${ax} ${ay}`,
            `L ${tax} ${tay}`,
            `A ${r} ${r} 0 0 1 ${tbx} ${tby}`,
            `L ${bx} ${by}`,
            `A ${r} ${r} 0 0 0 ${ax} ${ay}`,
            'Z',
        ].join(' ');
    }

    // ── Chamfer path generators ───────────────────────────────────────────────
    //
    // chamferedFootprintPath — straight-bevel polygon; called for the top face.
    // chamferedSideFacePath  — side face whose TOP endpoints come from the
    //                          chamfered top vertices.
    // chamferedCornerFacetPath — short vertical rectangular facet at each
    //                            chamfered upper corner.

    /** Project arbitrary base-plane vertices to the top plane (same shift as topVertices). */
    protected projectToTop(pts: Array<[number, number]>): Array<[number, number]> {
        const iH = this.isometricHeight;
        const rot = (this.get('shapeRotation') as number) ?? 0;
        const dx = rot === 90 ? 0 : -iH;
        const dy = -iH;
        return pts.map(([x, y]) => [x + dx, y + dy] as [number, number]);
    }

    /** Returns the chamfered polygon vertices as an ordered array. */
    protected chamferedVertices(verts: Array<[number, number]>, c: number): Array<[number, number]> {
        if (c <= 0) return [...verts];
        const n = verts.length;
        const result: Array<[number, number]> = [];
        for (let k = 0; k < n; k++) {
            result.push(this.arcExit(verts, k, c));
            result.push(this.arcEntry(verts, (k + 1) % n, c));
        }
        return result;
    }

    protected chamferedFootprintPath(verts: Array<[number, number]>, c: number): string {
        const n = verts.length;
        if (c === 0) {
            return 'M ' + verts.map(([x, y]) => `${x} ${y}`).join(' L ') + ' Z';
        }
        const firstExit = this.arcExit(verts, 0, c);
        let d = `M ${firstExit[0]} ${firstExit[1]}`;
        for (let k = 0; k < n; k++) {
            const j = (k + 1) % n;
            const [ex, ey] = this.arcEntry(verts, j, c);
            const [fx, fy] = this.arcExit(verts, j, c);
            d += ` L ${ex} ${ey} L ${fx} ${fy}`;
        }
        return d + ' Z';
    }

    /**
     * SVG path for a side face between base edge i→j when chamferSize > 0.
     *
     * Bottom endpoints: clipped by cornerRadius (unchanged from the unchambered case).
     * Top endpoints:    derived from the chamfered top face vertices, so the top
     *                   edge of each side face ends exactly at the chamfer-cut line.
     */
    /** Intermediate vertices at chamferStart height (from top) — full cross-section. */
    protected midVertices(): Array<[number, number]> {
        const iH = this.isometricHeight;
        const cs = this.chamferStart;
        const drops = this.shedRoofDrops();
        const rot = (this.get('shapeRotation') as number) ?? 0;
        return this.baseVertices().map(([x, y], i) => {
            const effH = iH - drops[i];
            const shift = effH * cs;
            const dx = rot === 90 ? 0 : -shift;
            return [x + dx, y - shift] as [number, number];
        });
    }

    /** Intermediate vertices at chamferBottomStart height (from bottom) — full cross-section. */
    protected midBottomVertices(): Array<[number, number]> {
        const iH = this.isometricHeight;
        const cbs = this.chamferBottomStart;
        const drops = this.shedRoofDrops();
        const shift = iH * cbs;
        const rot = (this.get('shapeRotation') as number) ?? 0;
        const dx = rot === 90 ? 0 : -shift;
        return this.baseVertices().map(([x, y]) => [x + dx, y - shift] as [number, number]);
    }

    protected chamferedSideFacePath(i: number, j: number): string {
        const verts = this.baseVertices();
        const c  = this.chamferSize;
        const cb = this.chamferBottomSize;
        const r  = this.cornerRadius;
        const cs = this.chamferStart;
        const cbs = this.chamferBottomStart;
        const topVerts = this.topVertices();
        const topR = c > 0 ? c : r;
        const botR = cb > 0 ? cb : r;

        // Bottom edge (base, possibly chamfered)
        const [x0, y0] = this.arcExit(verts, i, botR);
        const [x1, y1] = this.arcEntry(verts, j, botR);
        // Top edge (top, possibly chamfered)
        const [tx0, ty0] = this.arcExit(topVerts, i, topR);
        const [tx1, ty1] = this.arcEntry(topVerts, j, topR);

        // Build path bottom-up: base → mid-bottom → mid-top → top
        const leftPts: string[] = [];
        const rightPts: string[] = [];

        // Bottom
        leftPts.push(`${x0} ${y0}`);
        rightPts.push(`${x1} ${y1}`);

        // Mid-bottom transition (if bottom chamfer has start > 0)
        if (cb > 0 && cbs > 0) {
            const mbv = this.midBottomVertices();
            leftPts.push(`${this.arcExit(mbv, i, r).join(' ')}`);
            rightPts.push(`${this.arcEntry(mbv, j, r).join(' ')}`);
        }

        // Mid-top transition (if top chamfer has start > 0)
        if (c > 0 && cs > 0) {
            const mv = this.midVertices();
            leftPts.push(`${this.arcExit(mv, i, r).join(' ')}`);
            rightPts.push(`${this.arcEntry(mv, j, r).join(' ')}`);
        }

        // Top
        leftPts.push(`${tx0} ${ty0}`);
        rightPts.push(`${tx1} ${ty1}`);

        // Path: left side up, right side down
        let d = `M ${leftPts[0]}`;
        d += ` L ${rightPts[0]}`;
        for (let k = 1; k < rightPts.length; k++) d += ` L ${rightPts[k]}`;
        for (let k = leftPts.length - 1; k >= 1; k--) d += ` L ${leftPts[k]}`;
        return d + ' Z';
    }

    protected chamferedCornerFacetPath(i: number, position: 'top' | 'bottom' = 'top'): string {
        const r = this.cornerRadius;

        if (position === 'bottom') {
            const cb = this.chamferBottomSize;
            if (cb <= 0) return '';
            const cbs = this.chamferBottomStart;
            const verts = this.baseVertices();
            const n = verts.length;

            // Skip if either adjacent edge faces away from the viewer
            const prev = verts[(i + n - 1) % n];
            const curr = verts[i];
            const next = verts[(i + 1) % n];
            const inNormX = curr[1] - prev[1];
            const inNormY = -(curr[0] - prev[0]);
            const outNormX = next[1] - curr[1];
            const outNormY = -(next[0] - curr[0]);
            if ((inNormX + inNormY) < 0 || (outNormX + outNormY) < 0) return '';
            const [ax, ay] = this.arcEntry(verts, i, cb);
            const [bx, by] = this.arcExit(verts, i, cb);

            if (cbs > 0) {
                const mbv = this.midBottomVertices();
                const [mex, mey] = this.arcEntry(mbv, i, r);
                const [mxx, mxy] = this.arcExit(mbv, i, r);
                return `M ${ax} ${ay} L ${bx} ${by} L ${mxx} ${mxy} L ${mex} ${mey} Z`;
            }

            const topVerts = this.topVertices();
            const topR = this.chamferSize > 0 ? this.chamferSize : r;
            const topEntry = this.arcEntry(topVerts, i, topR);
            const topExit = this.arcExit(topVerts, i, topR);
            return `M ${ax} ${ay} L ${bx} ${by} L ${topExit[0]} ${topExit[1]} L ${topEntry[0]} ${topEntry[1]} Z`;
        }

        const c = this.chamferSize;
        if (c <= 0) return '';
        const cs = this.chamferStart;
        const topVerts = this.topVertices();
        const [ax, ay] = this.arcEntry(topVerts, i, c);
        const [bx, by] = this.arcExit(topVerts, i, c);

        if (cs > 0) {
            const midVerts = this.midVertices();
            const [mex, mey] = this.arcEntry(midVerts, i, r);
            const [mxx, mxy] = this.arcExit(midVerts, i, r);
            return `M ${ax} ${ay} L ${bx} ${by} L ${mxx} ${mxy} L ${mex} ${mey} Z`;
        }

        const botR = this.chamferBottomSize > 0 ? this.chamferBottomSize : r;
        const verts = this.baseVertices();
        const baseEntry = this.arcEntry(verts, i, botR);
        const baseExit = this.arcExit(verts, i, botR);
        return `M ${ax} ${ay} L ${bx} ${by} L ${baseExit[0]} ${baseExit[1]} L ${baseEntry[0]} ${baseEntry[1]} Z`;
    }
}

// ── RectangleShape ───────────────────────────────────────────────────────────────
// Extends PolygonShape so all faces — base, top, sides, corners — are derived
// from the same footprintPath / arcEntry / arcExit pipeline.
//
// Vertex layout (clockwise, SVG y-down):
//   V0=(0,0)  top-left   — hidden (between two hidden edges)
//   V1=(w,0)  top-right  — boundary (hidden top edge → visible right face)
//   V2=(w,h)  bot-right  — visible (between right face and front face)
//   V3=(0,h)  bot-left   — boundary (visible front face → hidden left edge)

export class RectangleShape extends PolygonShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        }
    }

    /** Clockwise rectangle footprint. */
    baseVertices(): Array<[number, number]> {
        const { width: w, height: h } = this.size();
        return [
            [0, 0],  // V0: top-left  (hidden)
            [w, 0],  // V1: top-right
            [w, h],  // V2: bot-right
            [0, h],  // V3: bot-left
        ];
    }

    /** Hit-area / interaction base — always full rectangle. */
    baseRectanglePath(): string {
        return this.footprintPath(this.baseVertices(), this.cornerRadius);
    }

    /** Isometric base — omitted when chamferBottomSize > 0 because the chamfer
     *  itself defines the bottom geometry; a separate base plate would leave
     *  visible artefacts at the chamfered corners. */
    baseRectanglePathIso(): string {
        if (this.chamferBottomSize > 0) return 'M 0 0 Z';
        return this.footprintPath(this.baseVertices(), this.cornerRadius);
    }

    /** Isometric top face. Chamfered when chamferSize > 0. */
    topRectanglePath(): string {
        const tv = this.topVertices();
        if (this.chamferSize > 0) return this.chamferedFootprintPath(tv, this.chamferSize);
        return this.footprintPath(tv, this.cornerRadius);
    }

    private hasChamfer(): boolean {
        return this.chamferSize > 0 || this.chamferBottomSize > 0;
    }

    rectangleFrontPath(): string {
        return this.hasChamfer() ? this.chamferedSideFacePath(2, 3) : this.straightFacePath(2, 3);
    }

    rectangleSidePath(): string {
        return this.hasChamfer() ? this.chamferedSideFacePath(1, 2) : this.straightFacePath(1, 2);
    }

    private rectangleCornerPath(i: number): string {
        if (!this.hasChamfer()) return this.cornerFacePath(i);
        const c = this.chamferSize;
        const cb = this.chamferBottomSize;
        let d = '';
        if (c > 0) {
            const f = this.chamferedCornerFacetPath(i, 'top');
            if (f) d += f;
        }
        if (cb > 0) {
            const f = this.chamferedCornerFacetPath(i, 'bottom');
            if (f) d += (d ? ' ' : '') + f;
        }
        return d || this.cornerFacePath(i);
    }

    rectangleCornerV1Path(): string { return this.rectangleCornerPath(1); }
    rectangleCornerV2Path(): string { return this.rectangleCornerPath(2); }
    rectangleCornerV3Path(): string { return this.rectangleCornerPath(3); }
}

export class ProportionalRectangleShape extends RectangleShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackProportionalSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        }
    }
}
