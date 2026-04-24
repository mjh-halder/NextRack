import { Model, Function } from '@joint/decorators';
import { elementTools } from '@joint/core';
import svg from './svg-polygon.svg';
import { PolygonShape, SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import { SizeControl, CenterBasedHeightControl, CONNECT_TOOL_PRESET } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize           = { width: GRID_SIZE * 2, height: GRID_SIZE * 2 };
const defaultIsometricHeight = GRID_SIZE / 2;

/**
 * A JointJS shape whose isometric footprint is defined by normalized polygon
 * vertices derived from an uploaded SVG outline.
 *
 * Normalized vertices (stored as the `normalizedVerts` model attribute) have
 * coordinates in [0..1] space where the longest axis reaches exactly 1.0.
 * At render time, `baseVertices()` maps them into the current layer's pixel
 * width × height using aspect-ratio-preserving letterbox scaling.
 *
 * All visible side faces are combined into a single compound SVG path
 * (`svgSideFacesPath`), giving a uniform single-color side appearance.
 * Corner radius is not supported for this shape type.
 */
@Model({
    attributes: {
        size:                   defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight:        defaultIsometricHeight,
        normalizedVerts:        [] as [number, number][],
    },
    template: svg,
})
export class SvgPolygonShape extends PolygonShape {

    constructor(...args: any[]) {
        super(...args);
        const { defaultSize: ds, defaultIsometricHeight: dih } = this.attributes;
        this.tools = {
            [SIZE_KEY]:             new SizeControl({ defaultSize: ds }),
            [CONNECT_KEY]:          new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight: dih }),
        };
    }

    /**
     * Returns the polygon vertices in pixel space, derived from `normalizedVerts`.
     *
     * The polygon is letterbox-scaled to fit inside the layer's width × height
     * bounding box while preserving the original SVG aspect ratio.
     * Both axes are centered within the box.
     *
     * Falls back to a rectangle when no vertices are stored.
     */
    baseVertices(): Array<[number, number]> {
        const normVerts = (this.get('normalizedVerts') ?? []) as [number, number][];
        const { width: w, height: h } = this.size();

        if (normVerts.length < 3) {
            // Fallback: axis-aligned rectangle matching the current size
            return [[0, 0], [w, 0], [w, h], [0, h]];
        }

        // Find the bounding box of the normalized verts (origin is at 0,0 after
        // normalization, so we only need the max extents).
        let maxNX = 0;
        let maxNY = 0;
        for (const [nx, ny] of normVerts) {
            if (nx > maxNX) maxNX = nx;
            if (ny > maxNY) maxNY = ny;
        }
        if (maxNX === 0 || maxNY === 0) return [[0, 0], [w, 0], [w, h], [0, h]];

        // Letterbox: uniform scale so the polygon fits inside w×h while
        // preserving its aspect ratio.  Center the shorter axis.
        const scale = Math.min(w / maxNX, h / maxNY);
        const ox    = (w - maxNX * scale) / 2;
        const oy    = (h - maxNY * scale) / 2;

        return normVerts.map(([nx, ny]) => [nx * scale + ox, ny * scale + oy] as [number, number]);
    }

    /** 2D footprint / hit area — closed polygon, no corner radius. */
    @Function()
    svgBasePath(): string {
        return this.footprintPath(this.baseVertices(), 0);
    }

    /**
     * Isometric top face — same polygon shifted up by (-iH, -iH).
     * Reactive on `[size, isometricHeight, normalizedVerts]`.
     */
    @Function()
    svgTopPath(): string {
        const tv = this.topVertices();
        if (this.chamferSize > 0) return this.chamferedFootprintPath(tv, this.chamferSize);
        return this.footprintPath(tv, this.cornerRadius);
    }

    @Function()
    svgSideFacesPath(): string {
        const verts = this.baseVertices();
        const tVerts = this.topVertices();
        const n     = verts.length;
        const c     = this.chamferSize;
        const r     = this.cornerRadius;
        const cs    = this.chamferStart;
        const parts: string[] = [];

        for (let i = 0; i < n; i++) {
            const j         = (i + 1) % n;
            const [x0, y0]  = verts[i];
            const [x1, y1]  = verts[j];

            const normX = y1 - y0;
            const normY = -(x1 - x0);
            if (normX + normY <= 0) continue;

            if (c > 0) {
                parts.push(this.chamferedSideFacePath(i, j));
                const facet = this.chamferedCornerFacetPath(j);
                if (facet) parts.push(facet);
            } else {
                const [bx0, by0] = r > 0 ? this.arcExit(verts, i, r) : [x0, y0];
                const [bx1, by1] = r > 0 ? this.arcEntry(verts, j, r) : [x1, y1];
                const [tx0, ty0] = r > 0 ? this.arcExit(tVerts, i, r) : tVerts[i];
                const [tx1, ty1] = r > 0 ? this.arcEntry(tVerts, j, r) : tVerts[j];
                parts.push(
                    `M ${bx0} ${by0} L ${bx1} ${by1}` +
                    ` L ${tx1} ${ty1} L ${tx0} ${ty0} Z`
                );
                if (r > 0) {
                    const cf = this.cornerFacePath(j);
                    if (cf) parts.push(cf);
                }
            }
        }

        return parts.length > 0 ? parts.join(' ') : 'M 0 0';
    }
}
