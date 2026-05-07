import { Model, Function } from '@joint/decorators';
import { elementTools } from '@joint/core';
import svg from './svg-polygon.svg';
import { PolygonShape, SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import { SizeControl, CenterBasedHeightControl, CONNECT_TOOL_PRESET } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize           = { width: GRID_SIZE * 2, height: GRID_SIZE * 2 };
const defaultIsometricHeight = GRID_SIZE / 2;

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

    // ── Multi-path helpers ───────────────────────────────────────────────

    private allNormPaths(): [number, number][][] {
        const raw = this.get('normalizedVerts') ?? [];
        if (raw.length === 0) return [[[0, 0], [1, 0], [1, 1], [0, 1]]];
        if (typeof raw[0][0] === 'number') {
            return [raw as [number, number][]];
        }
        return raw as [number, number][][];
    }

    private allBasePaths(): Array<Array<[number, number]>> {
        const paths = this.allNormPaths();
        const { width: w, height: h } = this.size();

        let maxNX = 0;
        let maxNY = 0;
        for (const path of paths) {
            for (const [nx, ny] of path) {
                if (nx > maxNX) maxNX = nx;
                if (ny > maxNY) maxNY = ny;
            }
        }
        if (maxNX === 0 || maxNY === 0) return [[[0, 0], [w, 0], [w, h], [0, h]]];

        const scale = Math.min(w / maxNX, h / maxNY);
        const ox = (w - maxNX * scale) / 2;
        const oy = (h - maxNY * scale) / 2;

        return paths.map(normPath => {
            if (normPath.length < 3) return [[0, 0], [w, 0], [w, h], [0, h]] as [number, number][];
            return normPath.map(([nx, ny]) => [nx * scale + ox, ny * scale + oy] as [number, number]);
        });
    }

    private baseToTop(base: Array<[number, number]>): Array<[number, number]> {
        const iH = this.get('isometricHeight') as number ?? 0;
        const { width: w, height: h } = this.size();
        const cx = w / 2;
        const cy = h / 2;
        const t = this.taper;
        const tw = this.twist * Math.PI / 180;
        const stx = this.scaleTopX;
        const sty = this.scaleTopY;
        const hasMod = t !== 0 || tw !== 0 || stx !== 1 || sty !== 1;
        const rot = (this.get('shapeRotation') as number) ?? 0;
        const dx = rot === 90 ? 0 : -iH;
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

    private sideFacesForPath(verts: Array<[number, number]>, tVerts: Array<[number, number]>): string {
        const n = verts.length;
        const r = this.cornerRadius;
        const parts: string[] = [];

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const [x0, y0] = verts[i];
            const [x1, y1] = verts[j];

            const normX = y1 - y0;
            const normY = -(x1 - x0);
            if (normX + normY <= 0) continue;

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
        return parts.join(' ');
    }

    // ── Public API ───────────────────────────────────────────────────────

    baseVertices(): Array<[number, number]> {
        return this.allBasePaths()[0];
    }

    @Function()
    svgBasePath(): string {
        const all = this.allBasePaths();
        return all.map(verts => this.footprintPath(verts, 0)).join(' ');
    }

    @Function()
    svgTopPath(): string {
        const all = this.allBasePaths();
        const c = this.chamferSize;
        const r = this.cornerRadius;

        return all.map((verts, idx) => {
            const tv = idx === 0 ? this.topVertices() : this.baseToTop(verts);
            if (c > 0 && idx === 0) return this.chamferedFootprintPath(tv, c);
            return this.footprintPath(tv, r);
        }).join(' ');
    }

    @Function()
    svgSideFacesPath(): string {
        const all = this.allBasePaths();
        const c = this.chamferSize;
        const parts: string[] = [];

        for (let idx = 0; idx < all.length; idx++) {
            const verts = all[idx];
            const tVerts = idx === 0 ? this.topVertices() : this.baseToTop(verts);

            if (c > 0 && idx === 0) {
                const n = verts.length;
                for (let i = 0; i < n; i++) {
                    const j = (i + 1) % n;
                    const [x0, y0] = verts[i];
                    const [x1, y1] = verts[j];
                    const normX = y1 - y0;
                    const normY = -(x1 - x0);
                    if (normX + normY <= 0) continue;
                    parts.push(this.chamferedSideFacePath(i, j));
                    const facet = this.chamferedCornerFacetPath(j);
                    if (facet) parts.push(facet);
                }
            } else {
                const s = this.sideFacesForPath(verts, tVerts);
                if (s) parts.push(s);
            }
        }

        return parts.length > 0 ? parts.join(' ') : 'M 0 0';
    }
}
