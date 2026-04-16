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
        return -this.isometricHeight;
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

    /**
     * Bevel cut applied to the TOP face corners.
     * The side faces' upper endpoints are derived from the chamfered top vertices,
     * and short vertical rectangular facets fill the upper corner gaps.
     * 0 = sharp corners everywhere.
     */
    get chamferSize(): number {
        return this.get('chamferSize') ?? 0;
    }

    /** Override in each subclass: clockwise [x, y] vertices of the 2D footprint. */
    abstract baseVertices(): Array<[number, number]>;

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
        const r  = this.cornerRadius;
        const iH = this.isometricHeight;
        const [x0, y0] = this.arcExit(verts, i, r);
        const [x1, y1] = this.arcEntry(verts, j, r);
        return `${x0},${y0} ${x1},${y1} ${x1 - iH},${y1 - iH} ${x0 - iH},${y0 - iH}`;
    }

    /**
     * SVG path `d` for a straight parallelogram side face between edge i→j.
     * Same geometry as straightFacePoints but as a path for use with <path d="">.
     */
    protected straightFacePath(i: number, j: number): string {
        const verts = this.baseVertices();
        const r  = this.cornerRadius;
        const iH = this.isometricHeight;
        const [x0, y0] = this.arcExit(verts, i, r);
        const [x1, y1] = this.arcEntry(verts, j, r);
        return `M ${x0} ${y0} L ${x1} ${y1} L ${x1 - iH} ${y1 - iH} L ${x0 - iH} ${y0 - iH} Z`;
    }

    /**
     * SVG path `d` for the curved corner strip extruded from vertex i.
     * Returns '' when r=0 — the <path> element renders nothing.
     */
    protected cornerFacePath(i: number): string {
        const verts = this.baseVertices();
        const r  = this.cornerRadius;
        if (r <= 0) return '';
        const iH = this.isometricHeight;
        const [ax, ay] = this.arcEntry(verts, i, r);
        const [bx, by] = this.arcExit(verts, i, r);
        // Outline: entry → entry_top → (arc CW) → exit_top → exit → (arc CCW back) → close
        return [
            `M ${ax} ${ay}`,
            `L ${ax - iH} ${ay - iH}`,
            `A ${r} ${r} 0 0 1 ${bx - iH} ${by - iH}`,
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
    protected chamferedSideFacePath(i: number, j: number): string {
        const verts = this.baseVertices();
        const c  = this.chamferSize;
        const r  = this.cornerRadius;
        const iH = this.isometricHeight;
        const topVerts = verts.map(([x, y]) => [x - iH, y - iH] as [number, number]);
        const [x0, y0]   = this.arcExit(verts, i, r);
        const [x1, y1]   = this.arcEntry(verts, j, r);
        const [tx0, ty0] = this.arcExit(topVerts, i, c);
        const [tx1, ty1] = this.arcEntry(topVerts, j, c);
        return `M ${x0} ${y0} L ${x1} ${y1} L ${tx1} ${ty1} L ${tx0} ${ty0} Z`;
    }

    /**
     * SVG path for the short vertical rectangular facet at chamfered upper corner i.
     *
     * The two top vertices are the chamfer-cut endpoints on the top face at corner i.
     * The two bottom vertices are those points translated DOWN by (+iH, +iH), which
     * lands them exactly on the corresponding base-vertex clip points.
     *
     * Returns '' when chamferSize = 0 — the <path> renders nothing.
     */
    protected chamferedCornerFacetPath(i: number): string {
        const verts = this.baseVertices();
        const c = this.chamferSize;
        if (c <= 0) return '';
        const iH = this.isometricHeight;
        const topVerts = verts.map(([x, y]) => [x - iH, y - iH] as [number, number]);
        const [ax, ay] = this.arcEntry(topVerts, i, c);
        const [bx, by] = this.arcExit(topVerts, i, c);
        return [
            `M ${ax} ${ay}`,
            `L ${bx} ${by}`,
            `L ${bx + iH} ${by + iH}`,
            `L ${ax + iH} ${ay + iH}`,
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
        const iH = this.isometricHeight;
        const shifted = this.baseVertices().map(([x, y]) => [x - iH, y - iH] as [number, number]);
        if (this.chamferSize > 0) return this.chamferedFootprintPath(shifted, this.chamferSize);
        return this.footprintPath(shifted, this.cornerRadius);
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

    get sideData(): string {
        const { width, height } = this.size();
        const baseRect = new g.Rect(0, 0, width, height);

        const baseDiagonal = new g.Line(baseRect.bottomLeft(), baseRect.topRight());
        const base = g.Ellipse.fromRect(baseRect);
        const [bottomLeftIntersection, bottomRightIntersection] = baseDiagonal.intersect(base);

        const topLeftIntersection = bottomLeftIntersection.clone().translate(-this.isometricHeight, -this.isometricHeight);
        const topRightIntersection = topLeftIntersection.reflection(this.topCenter);

        return `
            M ${bottomLeftIntersection.x} ${bottomLeftIntersection.y}
            L ${topLeftIntersection.x} ${topLeftIntersection.y}
            L ${topRightIntersection.x} ${topRightIntersection.y}
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
        return this.size().width - this.isometricHeight;
    }

    get topY(): number {
        return this.size().height - this.isometricHeight;
    }
}
