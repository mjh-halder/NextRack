import { dia, g, elementTools } from '@joint/core';
import { CenterBasedHeightControl, PyramidHeightControl, SizeControl, ProportionalSizeControl, CONNECT_TOOL_PRESET } from '../tools';
import { PORT_GROUPS, initPorts, updatePortPositions as syncPortPositions, PortView } from './ports';

export const ISOMETRIC_HEIGHT_KEY = 'isometric-height';
export const SIZE_KEY = 'size';
export const CONNECT_KEY = 'connect';

type ToolKeys = 'connect' | 'size' | 'isometric-height';

interface IsometricElementAttributes extends dia.Element.Attributes {
    defaultIsometricHeight: number;
    isometricHeight: number;
}

type Tools = {
    [key in ToolKeys]?: dia.ToolView
}

export enum View {
    Isometric = 'isometric',
    TwoDimensional = '2d',
}

export default class IsometricShape extends dia.Element<IsometricElementAttributes> {

    tools: Tools = {};

    private currentPortView: PortView = 'isometric';

    get taper(): number { return this.get('taper') ?? 0; }
    get twist(): number { return this.get('twist') ?? 0; }
    get scaleTopX(): number { return this.get('scaleTopX') ?? 1; }
    get scaleTopY(): number { return this.get('scaleTopY') ?? 1; }

    constructor(...args: any[]) {
        super(...args);
        if (this.usePorts()) {
            if (!this.get('ports')?.groups) {
                this.set('ports', { groups: PORT_GROUPS, items: [] }, { silent: true });
            }
            initPorts(this, this.currentPortView);
            this.on('change:size change:isometricHeight', () => this.updatePortPositions());
        }
        this.toggleView(View.Isometric);
    }

    protected usePorts(): boolean { return true; }

    protected updatePortPositions(): void {
        syncPortPositions(this, this.currentPortView);
    }

    get defaultIsometricHeight(): number {
        return this.get('isometricHeight') ?? 0;
    }

    get isometricHeight(): number {
        return this.get('isometricHeight') ?? this.defaultIsometricHeight;
    }

    get topX(): number {
        const rot = (this.get('shapeRotation') as number) ?? 0;
        return rot === 90 ? 0 : -this.isometricHeight;
    }

    get topY(): number {
        return -this.isometricHeight;
    }

    get topCenter(): g.Point {
        const { width, height } = this.size();
        const top = new g.Rect(this.topX, this.topY, width, height);

        return top.center();
    }

    resetIsometricHeight(): void {
        this.set('isometricHeight', this.get('defaultIsometricHeight'));
    }

    /**
     * Attaches interaction tools to this shape's view.
     *
     * @param paper  - The paper the shape is rendered on.
     * @param view   - Current view (isometric hides the height tool in 2D mode).
     * @param include - Optional whitelist of tool keys to show. When omitted all
     *                  tools are shown (component designer behaviour). Pass
     *                  `['connect']` in the system designer to suppress the
     *                  resize and height-drag handles.
     */
    addTools(paper: dia.Paper, view: View, include?: ToolKeys[]) {

        const tools = [];
        for (const [key, tool] of Object.entries(this.tools)) {
            if (view === View.TwoDimensional && key === ISOMETRIC_HEIGHT_KEY) continue;
            if (include && !include.includes(key as ToolKeys)) continue;
            tool.name = key;
            tools.push(tool);
        }

        const toolView = new dia.ToolsView({ name: 'controls', tools });
        this.findView(paper).addTools(toolView);
    }

    toggleView(view: View) {
        const isIsometric = view === View.Isometric;
        this.attr({
            '2d':  { display: isIsometric ? 'none' : 'block' },
            'iso': { display: isIsometric ? 'block' : 'none' },
        });
        this.currentPortView = isIsometric ? 'isometric' : '2d';
        if (this.usePorts()) this.updatePortPositions();
    }
}

// ── PolygonShape ──────────────────────────────────────────────────────────────
// Abstract base for polygon-based isometric shapes.
//
// Subclasses implement `baseVertices()` returning a clockwise [x,y][] footprint.
// All faces — base, top, straight sides, and curved corner strips — are derived
// from that single array plus `cornerRadius` and `isometricHeight`.
//
// The `cornerRadius` attribute is read reactively from the model; set it via
// `shape.set('cornerRadius', n)` to trigger an SVG re-render.

export abstract class PolygonShape extends IsometricShape {

    get cornerRadius(): number {
        return this.get('cornerRadius') ?? 0;
    }

    get chamferSize(): number {
        return this.get('chamferSize') ?? 0;
    }

    /** Fraction (0–1) of the isometric height at which the chamfer starts.
     *  0 = chamfer from base (legacy), 1 = chamfer only at top edge. */
    get chamferStart(): number {
        return this.get('chamferStart') ?? 0;
    }

    /** Override in each subclass: clockwise [x, y] vertices of the 2D footprint. */
    abstract baseVertices(): Array<[number, number]>;

    topVertices(): Array<[number, number]> {
        const base = this.baseVertices();
        const iH = this.isometricHeight;
        const { width: w, height: h } = this.size();
        const cx = w / 2;
        const cy = h / 2;
        const t = this.taper;
        const tw = this.twist * Math.PI / 180;
        const stx = this.scaleTopX;
        const sty = this.scaleTopY;
        const hasMod = t !== 0 || tw !== 0 || stx !== 1 || sty !== 1;
        const rot = (this.get('shapeRotation') as number) ?? 0;
        const dx = rot === 90 ? 0   : -iH;
        const dy = -iH;

        return base.map(([x, y]) => {
            let tx = x + dx;
            let ty = y + dy;
            if (hasMod) {
                let lx = x - cx;
                let ly = y - cy;
                lx *= stx * (1 - t);
                ly *= sty * (1 - t);
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

    /**
     * SVG path `d` for a chamfered (straight-bevel) polygon footprint.
     * At c=0 returns a plain closed polygon.  At c>0 each corner is replaced
     * with a single straight cut — no arcs.
     * Uses arcEntry / arcExit for clipping so side faces stay aligned.
     */
    protected chamferedFootprintPath(verts: Array<[number, number]>, c: number): string {
        const n = verts.length;
        if (c <= 0) {
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
    /** Intermediate vertices at chamferStart height — full cross-section shifted. */
    private midVertices(): Array<[number, number]> {
        const iH = this.isometricHeight;
        const cs = this.chamferStart;
        const shift = iH * cs;
        const rot = (this.get('shapeRotation') as number) ?? 0;
        const dx = rot === 90 ? 0 : -shift;
        return this.baseVertices().map(([x, y]) => [x + dx, y - shift] as [number, number]);
    }

    protected chamferedSideFacePath(i: number, j: number): string {
        const verts = this.baseVertices();
        const c  = this.chamferSize;
        const r  = this.cornerRadius;
        const cs = this.chamferStart;
        const topVerts = this.topVertices();
        const [tx0, ty0] = this.arcExit(topVerts, i, c);
        const [tx1, ty1] = this.arcEntry(topVerts, j, c);

        if (cs > 0) {
            const midVerts = this.midVertices();
            const [x0, y0]   = this.arcExit(verts, i, r);
            const [x1, y1]   = this.arcEntry(verts, j, r);
            const [mx0, my0] = this.arcExit(midVerts, i, r);
            const [mx1, my1] = this.arcEntry(midVerts, j, r);
            return `M ${x0} ${y0} L ${x1} ${y1} L ${mx1} ${my1} L ${tx1} ${ty1} L ${tx0} ${ty0} L ${mx0} ${my0} Z`;
        }

        const [x0, y0] = this.arcExit(verts, i, r);
        const [x1, y1] = this.arcEntry(verts, j, r);
        return `M ${x0} ${y0} L ${x1} ${y1} L ${tx1} ${ty1} L ${tx0} ${ty0} Z`;
    }

    protected chamferedCornerFacetPath(i: number): string {
        const c = this.chamferSize;
        if (c <= 0) return '';
        const r  = this.cornerRadius;
        const cs = this.chamferStart;
        const topVerts = this.topVertices();
        const [ax, ay] = this.arcEntry(topVerts, i, c);
        const [bx, by] = this.arcExit(topVerts, i, c);

        if (cs > 0) {
            const midVerts = this.midVertices();
            const [mex, mey] = this.arcEntry(midVerts, i, r);
            const [mxx, mxy] = this.arcExit(midVerts, i, r);
            return [
                `M ${ax} ${ay}`,
                `L ${bx} ${by}`,
                `L ${mxx} ${mxy}`,
                `L ${mex} ${mey}`,
                'Z',
            ].join(' ');
        }

        const verts = this.baseVertices();
        const baseEntry = this.arcEntry(verts, i, r);
        const baseExit = this.arcExit(verts, i, r);
        return [
            `M ${ax} ${ay}`,
            `L ${bx} ${by}`,
            `L ${baseExit[0]} ${baseExit[1]}`,
            `L ${baseEntry[0]} ${baseEntry[1]}`,
            'Z',
        ].join(' ');
    }
}

// ── CuboidShape ───────────────────────────────────────────────────────────────
// Extends PolygonShape so all faces — base, top, sides, corners — are derived
// from the same footprintPath / arcEntry / arcExit pipeline.
//
// Vertex layout (clockwise, SVG y-down):
//   V0=(0,0)  top-left   — hidden (between two hidden edges)
//   V1=(w,0)  top-right  — boundary (hidden top edge → visible right face)
//   V2=(w,h)  bot-right  — visible (between right face and front face)
//   V3=(0,h)  bot-left   — boundary (visible front face → hidden left edge)

export class CuboidShape extends PolygonShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new SizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
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

    /** 2D footprint / base outline — always uses cornerRadius, never chamfered. */
    baseCuboidPath(): string {
        return this.footprintPath(this.baseVertices(), this.cornerRadius);
    }

    /**
     * Isometric top face.
     * Chamfered when chamferSize > 0; falls back to cornerRadius otherwise.
     */
    topCuboidPath(): string {
        const tv = this.topVertices();
        if (this.chamferSize > 0) return this.chamferedFootprintPath(tv, this.chamferSize);
        return this.footprintPath(tv, this.cornerRadius);
    }

    /**
     * Front face (base edge V2→V3).
     * When chamferSize > 0 the top endpoints are derived from the chamfered top face.
     */
    cuboidFrontPath(): string {
        return this.chamferSize > 0 ? this.chamferedSideFacePath(2, 3) : this.straightFacePath(2, 3);
    }

    /**
     * Side face (base edge V1→V2).
     * When chamferSize > 0 the top endpoints are derived from the chamfered top face.
     */
    cuboidSidePath(): string {
        return this.chamferSize > 0 ? this.chamferedSideFacePath(1, 2) : this.straightFacePath(1, 2);
    }

    /**
     * Upper-corner facet at V1.
     * When chamferSize > 0: short vertical rectangle filling the chamfered corner gap.
     * Otherwise: curved arc strip (radius = cornerRadius).
     */
    cuboidCornerV1Path(): string {
        return this.chamferSize > 0 ? this.chamferedCornerFacetPath(1) : this.cornerFacePath(1);
    }

    /** Upper-corner facet at V2 (right-front junction). */
    cuboidCornerV2Path(): string {
        return this.chamferSize > 0 ? this.chamferedCornerFacetPath(2) : this.cornerFacePath(2);
    }

    /** Upper-corner facet at V3 (left-front junction). */
    cuboidCornerV3Path(): string {
        return this.chamferSize > 0 ? this.chamferedCornerFacetPath(3) : this.cornerFacePath(3);
    }
}

export class ProportionalCuboidShape extends CuboidShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new ProportionalSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
        }
    }
}

export class CylinderShape extends IsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new ProportionalSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
        }
    }

    get topEllipseRx(): number {
        const { width } = this.size();
        return (width / 2) * this.scaleTopX * (1 - this.taper);
    }

    get topEllipseRy(): number {
        const { height } = this.size();
        return (height / 2) * this.scaleTopY * (1 - this.taper);
    }

    get sideData(): string {
        const { width, height } = this.size();
        const iH = this.isometricHeight;
        const cx = width / 2;
        const cy = height / 2;
        const rot = (this.get('shapeRotation') as number) ?? 0;
        const dx = rot === 90 ? 0   : -iH;
        const dy = -iH;

        const baseRect = new g.Rect(0, 0, width, height);
        const baseDiagonal = new g.Line(baseRect.bottomLeft(), baseRect.topRight());
        const base = g.Ellipse.fromRect(baseRect);
        const [bottomLeftIntersection, bottomRightIntersection] = baseDiagonal.intersect(base);

        const trx = this.topEllipseRx;
        const try_ = this.topEllipseRy;
        const tcx = cx + dx;
        const tcy = cy + dy;
        const topEllipse = new g.Ellipse(new g.Point(tcx, tcy), trx, try_);
        const topDiag = new g.Line(
            new g.Point(tcx - trx, tcy + try_),
            new g.Point(tcx + trx, tcy - try_)
        );
        const topIntersections = topDiag.intersect(topEllipse);
        const topLeft = topIntersections?.[0] ?? new g.Point(tcx - trx, tcy);
        const topRight = topIntersections?.[1] ?? new g.Point(tcx + trx, tcy);

        return `
            M ${bottomLeftIntersection.x} ${bottomLeftIntersection.y}
            L ${topLeft.x} ${topLeft.y}
            L ${topRight.x} ${topRight.y}
            L ${bottomRightIntersection.x} ${bottomRightIntersection.y}
        `;
    }
}

export class PyramidShape extends IsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new ProportionalSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new PyramidHeightControl({ defaultIsometricHeight }),
        }
    }

    get topX(): number {
        const rot = (this.get('shapeRotation') as number) ?? 0;
        return rot === 90 ? this.size().width : this.size().width - this.isometricHeight;
    }

    get topY(): number {
        return this.size().height - this.isometricHeight;
    }
}

// ── Tube (horizontal cylinder / pipe) ─────────────────────────────────────
//
// A circle of radius R in the 3D YZ-plane projects into 2D model space as the
// conic 2u² − 2uv + v² = R².  Diagonalising the matrix [[2,−1],[−1,1]] gives
// eigenvalues λ = (3±√5)/2, semi-axes a = R/√λ₂ = φR, b = R/√λ₁ = R/φ and
// the major-axis direction (1, φ) → rotation = atan(φ) ≈ 58.28°.
//
// Tangent lines parallel to the tube axis (model-x) touch the ellipse at
// θ = −π/4 (bottom) and θ = 3π/4 (top), where the parametric form is:
//   u = −R sin θ,  v = R cos θ − R sin θ.
// These tangent points define where the mantle attaches to the end caps.

const PHI = (1 + Math.sqrt(5)) / 2;
const TUBE_ARC_ROTATION = (Math.atan(PHI) * 180) / Math.PI;
const SQRT2 = Math.SQRT2;

export class TubeShape extends IsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new SizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private tubeGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const R = iH / 2;
        const rx = PHI * R;
        const ry = R / PHI;
        const rot = TUBE_ARC_ROTATION;

        const s = R / SQRT2;
        const s2 = R * SQRT2;

        // Ellipse centers in model space: 3D(x, h/2, R) → model(x − R, h/2 − R)
        const ncx = w - R;
        const ncy = h / 2 - R;
        const fcx = -R;
        const fcy = h / 2 - R;

        // Tangent points where body meets ellipses
        // Bottom tangent (θ = −π/4): offset (+s, +s2) from centre
        // Top tangent    (θ = 3π/4): offset (−s, −s2) from centre
        return {
            rx, ry, rot,
            nb: { x: ncx + s, y: ncy + s2 },
            nt: { x: ncx - s, y: ncy - s2 },
            fb: { x: fcx + s, y: fcy + s2 },
            ft: { x: fcx - s, y: fcy - s2 },
        };
    }

    // Back arc — the protruding left half of the far-end ellipse.
    // Closed via the chord ft→fb so the body (drawn on top) hides the seam.
    get tubeBackArcPath(): string {
        const { rx, ry, rot, fb, ft } = this.tubeGeometry();
        return [
            `M ${ft.x} ${ft.y}`,
            `A ${rx} ${ry} ${rot} 0 0 ${fb.x} ${fb.y}`,
            'Z',
        ].join(' ');
    }

    // Body — the mantle rectangle closed by the right half of the back ellipse.
    // The arc from fb→ft ensures a seamless tangential join at both ends.
    get tubeBodyPath(): string {
        const { rx, ry, rot, nb, nt, fb, ft } = this.tubeGeometry();
        return [
            `M ${ft.x} ${ft.y}`,
            `L ${nt.x} ${nt.y}`,
            `L ${nb.x} ${nb.y}`,
            `L ${fb.x} ${fb.y}`,
            `A ${rx} ${ry} ${rot} 0 1 ${ft.x} ${ft.y}`,
            'Z',
        ].join(' ');
    }

    // Front ellipse — full closed ellipse at the near end
    get tubeFrontEllipsePath(): string {
        const { rx, ry, rot, nb, nt } = this.tubeGeometry();
        return [
            `M ${nb.x} ${nb.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nt.x} ${nt.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nb.x} ${nb.y}`,
            'Z',
        ].join(' ');
    }
}

// ── Pipe (horizontal cylinder along model Y — front to back) ──────────────
// Circle in the XZ-plane: conic u²−2uv+2v²=R².  Same eigenvalues as the
// tube (λ=(3±√5)/2), but the major axis is along (1, 1/φ) → rotation ≈ 31.72°.
// Tangent lines parallel to model-Y touch at offset (±R√2, ±R/√2).

const PIPE_ARC_ROTATION = (Math.atan(1 / PHI) * 180) / Math.PI;

export class PipeShape extends IsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new SizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private pipeGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const R = iH / 2;
        const rx = PHI * R;
        const ry = R / PHI;
        const rot = PIPE_ARC_ROTATION;

        const s = R * SQRT2;
        const s2 = R / SQRT2;

        // Ellipse centres: 3D(w/2, y, R) → model(w/2−R, y−R)
        const ncx = w / 2 - R;
        const ncy = h - R;
        const fcx = w / 2 - R;
        const fcy = -R;

        // Right tangent (θ=−π/4): offset (+R√2, +R/√2)
        // Left tangent  (θ=3π/4): offset (−R√2, −R/√2)
        return {
            rx, ry, rot,
            nr: { x: ncx + s, y: ncy + s2 },
            nl: { x: ncx - s, y: ncy - s2 },
            fr: { x: fcx + s, y: fcy + s2 },
            fl: { x: fcx - s, y: fcy - s2 },
        };
    }

    get pipeBackArcPath(): string {
        const { rx, ry, rot, fl, fr } = this.pipeGeometry();
        return [
            `M ${fl.x} ${fl.y}`,
            `A ${rx} ${ry} ${rot} 0 1 ${fr.x} ${fr.y}`,
            'Z',
        ].join(' ');
    }

    get pipeBodyPath(): string {
        const { rx, ry, rot, nr, nl, fr, fl } = this.pipeGeometry();
        return [
            `M ${fl.x} ${fl.y}`,
            `L ${nl.x} ${nl.y}`,
            `L ${nr.x} ${nr.y}`,
            `L ${fr.x} ${fr.y}`,
            `A ${rx} ${ry} ${rot} 0 0 ${fl.x} ${fl.y}`,
            'Z',
        ].join(' ');
    }

    get pipeFrontEllipsePath(): string {
        const { rx, ry, rot, nr, nl } = this.pipeGeometry();
        return [
            `M ${nr.x} ${nr.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nl.x} ${nl.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nr.x} ${nr.y}`,
            'Z',
        ].join(' ');
    }
}

// ── Duct (lying octagonal prism along model X) ────────────────────────────
// Cross-section: octagon in the YZ-plane, projected via (X−Z, Y−Z).
// Visible faces (camera ≈ −1,−1,−1): bottom, left, lower-left chamfer,
// plus the two borderline chamfer faces (lower-right, upper-left).

export class DuctShape extends IsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new SizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private ductGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const c = Math.min(h, iH) * 0.28;

        // Octagon vertices in (Y, Z) space, bottom-left origin
        const oct: [number, number][] = [
            [c, 0], [h - c, 0], [h, c], [h, iH - c],
            [h - c, iH], [c, iH], [0, iH - c], [0, c],
        ];

        const near = oct.map(([y, z]) => ({ x: w - z, y: y - z }));
        const far  = oct.map(([y, z]) => ({ x: -z,    y: y - z }));

        return { near, far };
    }

    // Full outline: one closed polygon tracing the entire visible shape.
    // Goes through the protruding back edges then across the mantle to the
    // near end. Single stroke, no double lines, no crossing.
    get ductOutlinePath(): string {
        const { near: n, far: f } = this.ductGeometry();
        return [
            `M ${f[5].x} ${f[5].y}`,
            `L ${f[4].x} ${f[4].y}`,
            `L ${f[3].x} ${f[3].y}`,
            `L ${f[2].x} ${f[2].y}`,
            `L ${n[2].x} ${n[2].y}`,
            `L ${n[1].x} ${n[1].y}`,
            `L ${n[0].x} ${n[0].y}`,
            `L ${n[7].x} ${n[7].y}`,
            `L ${n[6].x} ${n[6].y}`,
            `L ${n[5].x} ${n[5].y}`,
            'Z',
        ].join(' ');
    }

    // Back shade: protruding back portion, fill only (no stroke).
    // The chord closure is invisible because the outline's stroke covers it.
    get ductBackShadePath(): string {
        const { far: f } = this.ductGeometry();
        return `M ${f[2].x} ${f[2].y} L ${f[3].x} ${f[3].y} L ${f[4].x} ${f[4].y} L ${f[5].x} ${f[5].y} Z`;
    }

    // Front face: full near octagon with fill + stroke for the end-cap edges.
    get ductFrontPath(): string {
        const { near } = this.ductGeometry();
        return 'M ' + near.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
    }
}

// ── Channel (lying octagonal prism along model Y — front to back) ─────────
// Cross-section: octagon in the XZ-plane, projected via (X−Z, Y−Z).
// Same visible faces as duct (camera symmetry in X/Y): bottom, left,
// lower-left chamfer, plus borderline lower-right and upper-left chamfers.

export class ChannelShape extends IsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new SizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private channelGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const c = Math.min(w, iH) * 0.28;

        // Octagon vertices in (X, Z) space
        const oct: [number, number][] = [
            [c, 0], [w - c, 0], [w, c], [w, iH - c],
            [w - c, iH], [c, iH], [0, iH - c], [0, c],
        ];

        // Project: 3D(X, Y, Z) → model(X−Z, Y−Z)
        const near = oct.map(([x, z]) => ({ x: x - z, y: h - z }));
        const far  = oct.map(([x, z]) => ({ x: x - z, y: -z }));

        return { near, far };
    }

    get channelOutlinePath(): string {
        const { near: n, far: f } = this.channelGeometry();
        return [
            `M ${f[5].x} ${f[5].y}`,
            `L ${f[4].x} ${f[4].y}`,
            `L ${f[3].x} ${f[3].y}`,
            `L ${f[2].x} ${f[2].y}`,
            `L ${n[2].x} ${n[2].y}`,
            `L ${n[1].x} ${n[1].y}`,
            `L ${n[0].x} ${n[0].y}`,
            `L ${n[7].x} ${n[7].y}`,
            `L ${n[6].x} ${n[6].y}`,
            `L ${n[5].x} ${n[5].y}`,
            'Z',
        ].join(' ');
    }

    get channelFrontPath(): string {
        const { near } = this.channelGeometry();
        return 'M ' + near.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
    }
}
