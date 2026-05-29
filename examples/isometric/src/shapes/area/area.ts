import { Model, Function } from '@joint/decorators';
import { dia } from '@joint/core';
import svg from './area.svg';
import IsometricShape, { View } from '../isometric-shape';
import { FrameCornerControl, AreaVertexControl, AreaEdgeMidControl, AreaCornerRadiusControl } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 6,
    height: GRID_SIZE * 4,
};

type CornerSpec = { style: string; radius: number };
type CornerMap = Partial<Record<'tl' | 'tr' | 'br' | 'bl', CornerSpec>>;

// Detect a ~90° vertex by checking the dot product of the two incoming
// edge vectors. Returns true within ~3° tolerance.
function isRightAngle(prev: [number, number], curr: [number, number], next: [number, number]): boolean {
    const ax = prev[0] - curr[0], ay = prev[1] - curr[1];
    const bx = next[0] - curr[0], by = next[1] - curr[1];
    const mA = Math.hypot(ax, ay), mB = Math.hypot(bx, by);
    if (mA < 1e-6 || mB < 1e-6) return false;
    const cos = (ax * bx + ay * by) / (mA * mB);
    return Math.abs(cos) < 0.05;
}

/** Indices of vertices whose interior angle is ~90° — eligible for cut/round. */
export function rightAngleVertices(verts: ReadonlyArray<[number, number]>): number[] {
    const n = verts.length;
    if (n < 3) return [];
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
        if (isRightAngle(verts[(i - 1 + n) % n], verts[i], verts[(i + 1) % n])) out.push(i);
    }
    return out;
}

@Model({
    attributes: {
        isArea: true,
        z: -1,
        size: defaultSize,
        // Empty = render as rectangle (default). Setting to >=3 points puts
        // the area in custom-polygon mode; coordinates are normalised 0..1
        // and scaled to size on render (same convention as SvgPolygonShape).
        normalizedVerts: [] as [number, number][],
        // Per-corner radius + style (rounded / cut) for rectangle mode.
        // Empty object means "no corners" → render as plain rectangle.
        areaCorners: {} as CornerMap,
        // Polygon mode: per-vertex corner radii (sparse-friendly array,
        // index aligned to normalizedVerts; 0/undefined = sharp corner).
        // Only 90° corners actually render with cut/round; others ignore.
        vertexCornerRadii: [] as number[],
    },
    template: svg,
})
export class Area extends IsometricShape {

    @Function()
    bodyPath(): string {
        const { width: w, height: h } = this.size();
        const verts = (this.get('normalizedVerts') as [number, number][]) ?? [];

        // Global style for corners. 'default' means: ignore all corner radii
        // (treat shape as if no corner rounding were configured).
        const globalStyle = (this.get('areaCorners') as CornerMap)?.tl?.style ?? 'default';

        // Custom polygon path: per-vertex rounded/cut at 90° corners only.
        if (verts.length >= 3) {
            const pix = verts.map(([nx, ny]) => [nx * w, ny * h] as [number, number]);
            const radii = (this.get('vertexCornerRadii') as number[]) ?? [];
            const n = pix.length;
            const parts: string[] = [];
            let startInX: number | null = null;
            let startInY: number | null = null;
            for (let i = 0; i < n; i++) {
                const prev = pix[(i - 1 + n) % n];
                const curr = pix[i];
                const next = pix[(i + 1) % n];
                const r = radii[i] ?? 0;
                const right = isRightAngle(prev, curr, next);
                const applyCorner = r > 0 && right && (globalStyle === 'rounded' || globalStyle === 'cut');
                if (applyCorner) {
                    const lenP = Math.hypot(prev[0] - curr[0], prev[1] - curr[1]);
                    const lenN = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
                    const rEff = Math.min(r, lenP / 2, lenN / 2);
                    const inX  = curr[0] + (prev[0] - curr[0]) / lenP * rEff;
                    const inY  = curr[1] + (prev[1] - curr[1]) / lenP * rEff;
                    const outX = curr[0] + (next[0] - curr[0]) / lenN * rEff;
                    const outY = curr[1] + (next[1] - curr[1]) / lenN * rEff;
                    // Convex (in CW SVG polygon) → cross < 0 → bow outward → sweep 1.
                    const cross = (prev[0] - curr[0]) * (next[1] - curr[1]) - (prev[1] - curr[1]) * (next[0] - curr[0]);
                    const sweep = cross < 0 ? 1 : 0;
                    if (i === 0) { parts.push(`M ${inX} ${inY}`); startInX = inX; startInY = inY; }
                    else parts.push(`L ${inX} ${inY}`);
                    if (globalStyle === 'cut') parts.push(`L ${outX} ${outY}`);
                    else                       parts.push(`A ${rEff} ${rEff} 0 0 ${sweep} ${outX} ${outY}`);
                } else {
                    if (i === 0) { parts.push(`M ${curr[0]} ${curr[1]}`); startInX = curr[0]; startInY = curr[1]; }
                    else parts.push(`L ${curr[0]} ${curr[1]}`);
                }
            }
            // Close back to the first point's entry coord (not the raw vertex)
            // so the last edge meets the first rounded corner cleanly.
            if (startInX != null) parts.push(`L ${startInX} ${startInY}`);
            parts.push('Z');
            return parts.join(' ');
        }

        // Rectangle mode.
        // Default style → ignore radii, render plain rectangle.
        if (globalStyle === 'default') return `M 0 0 H ${w} V ${h} H 0 Z`;
        const corners = (this.get('areaCorners') as CornerMap) ?? {};
        const rTL = corners.tl?.radius ?? 0, rTR = corners.tr?.radius ?? 0;
        const rBR = corners.br?.radius ?? 0, rBL = corners.bl?.radius ?? 0;
        if (rTL === 0 && rTR === 0 && rBR === 0 && rBL === 0) {
            return `M 0 0 H ${w} V ${h} H 0 Z`;
        }
        const sTL = corners.tl?.style ?? 'rounded', sTR = corners.tr?.style ?? 'rounded';
        const sBR = corners.br?.style ?? 'rounded', sBL = corners.bl?.style ?? 'rounded';
        const parts: string[] = [];
        if (rTL <= 0)               parts.push('M 0 0');
        else if (sTL === 'rounded') parts.push(`M 0 ${rTL} A ${rTL} ${rTL} 0 0 1 ${rTL} 0`);
        else                        parts.push(`M 0 ${rTL} L ${rTL} 0`);
        if (rTR <= 0)               parts.push(`H ${w}`);
        else if (sTR === 'rounded') parts.push(`H ${w - rTR} A ${rTR} ${rTR} 0 0 1 ${w} ${rTR}`);
        else                        parts.push(`H ${w - rTR} L ${w} ${rTR}`);
        if (rBR <= 0)               parts.push(`V ${h}`);
        else if (sBR === 'rounded') parts.push(`V ${h - rBR} A ${rBR} ${rBR} 0 0 1 ${w - rBR} ${h}`);
        else                        parts.push(`V ${h - rBR} L ${w - rBR} ${h}`);
        if (rBL <= 0)               parts.push('H 0');
        else if (sBL === 'rounded') parts.push(`H ${rBL} A ${rBL} ${rBL} 0 0 1 0 ${h - rBL}`);
        else                        parts.push(`H ${rBL} L 0 ${h - rBL}`);
        parts.push('Z');
        return parts.join(' ');
    }

    override addTools(paper: dia.Paper, _view: View) {
        const tools: dia.ToolView[] = [
            new FrameCornerControl({ corner: 'bottom-right' }),
            new FrameCornerControl({ corner: 'bottom-left' }),
            new FrameCornerControl({ corner: 'top-right' }),
            new FrameCornerControl({ corner: 'top-left' }),
        ];
        // Corner-radius diamonds only when an actual corner style is chosen.
        // 'default' means "no corner modification" → no diamonds either.
        const style = (this.get('areaCorners') as CornerMap)?.tl?.style;
        const showDiamonds = style === 'rounded' || style === 'cut';
        const verts = (this.get('normalizedVerts') as [number, number][]) ?? [];
        if (showDiamonds) {
            if (verts.length < 3) {
                tools.push(
                    new AreaCornerRadiusControl({ corner: 'tl' }) as dia.ToolView,
                    new AreaCornerRadiusControl({ corner: 'tr' }) as dia.ToolView,
                    new AreaCornerRadiusControl({ corner: 'br' }) as dia.ToolView,
                    new AreaCornerRadiusControl({ corner: 'bl' }) as dia.ToolView,
                );
            } else {
                for (const i of rightAngleVertices(verts)) {
                    tools.push(new AreaCornerRadiusControl({ vertexIndex: i }) as dia.ToolView);
                }
            }
        }
        const toolView = new dia.ToolsView({ name: 'controls', tools });
        this.findView(paper).addTools(toolView);
    }

    /**
     * Path-edit tools: one vertex handle per point + one semi-transparent
     * midpoint handle per edge. Called from the system designer's right-click
     * → "Edit Path" action. Re-invoked after every mutation so the handle
     * count stays in sync with `normalizedVerts`.
     */
    addPathEditTools(paper: dia.Paper) {
        if (((this.get('normalizedVerts') as [number, number][]) ?? []).length < 3) {
            this.set('normalizedVerts', [[0, 0], [1, 0], [1, 1], [0, 1]]);
        }
        const verts = this.get('normalizedVerts') as [number, number][];
        const tools: dia.ToolView[] = [];
        for (let i = 0; i < verts.length; i++) {
            tools.push(new AreaVertexControl({ index: i }) as dia.ToolView);
        }
        for (let i = 0; i < verts.length; i++) {
            tools.push(new AreaEdgeMidControl({ edgeIndex: i }) as dia.ToolView);
        }
        const toolView = new dia.ToolsView({ name: 'path-edit', tools });
        this.findView(paper).addTools(toolView);
    }

    override toggleView(_view: View) {
        // same rect in both views
    }
}
