import { Model, Function } from '@joint/decorators';
import { elementTools } from '@joint/core';
import svg from './octagon.svg';
import { SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import { PolygonShape } from '../rectangle/rectangle-shape';
import { NextrackSizeControl, NextrackCenterBasedHeightControl, NEXTRACK_CONNECT_TOOL_PRESET } from '../../tools';
import { defaultDimensionsFor } from '../shape-capabilities';

const _defaults = defaultDimensionsFor('octagon');
const defaultSize = { width: _defaults.width, height: _defaults.height };
const defaultIsometricHeight = _defaults.depth;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg,
})
export class Octagon extends PolygonShape {

    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    /**
     * Clockwise footprint for the octagonal prism.
     * Corners are cut at 25% of each dimension.
     *
     *    V0 ──── V1
     *   /          \
     *  V7            V2
     *  |              |
     *  V6            V3
     *   \          /
     *    V5 ──── V4
     */
    baseVertices(): Array<[number, number]> {
        const { width: w, height: h } = this.size();
        const cx = w * 0.25;
        const cy = h * 0.25;
        return [
            [cx,     0      ],  // V0: top-left cut
            [w - cx, 0      ],  // V1: top-right cut
            [w,      cy     ],  // V2: right-top cut
            [w,      h - cy ],  // V3: right-bottom cut
            [w - cx, h      ],  // V4: bottom-right cut
            [cx,     h      ],  // V5: bottom-left cut
            [0,      h - cy ],  // V6: left-bottom cut
            [0,      cy     ],  // V7: left-top cut
        ];
    }

    @Function()
    baseOctagonPath(): string {
        return this.footprintPath(this.baseVertices(), this.cornerRadius);
    }

    @Function()
    baseOctagonPathIso(): string {
        const cb = this.chamferBottomSize;
        if (cb > 0) return this.chamferedFootprintPath(this.baseVertices(), cb);
        return this.footprintPath(this.baseVertices(), this.cornerRadius);
    }

    @Function()
    topOctagonPath(): string {
        const tv = this.topVertices();
        if (this.chamferSize > 0) return this.chamferedFootprintPath(tv, this.chamferSize);
        return this.footprintPath(tv, this.cornerRadius);
    }

    private _hasChamfer(): boolean { return this.chamferSize > 0 || this.chamferBottomSize > 0; }

    @Function() rightFacePath(): string      { return this._hasChamfer() ? this.chamferedSideFacePath(2, 3) : this.straightFacePath(2, 3); }
    @Function() frontRightFacePath(): string  { return this._hasChamfer() ? this.chamferedSideFacePath(3, 4) : this.straightFacePath(3, 4); }
    @Function() frontBottomFacePath(): string { return this._hasChamfer() ? this.chamferedSideFacePath(4, 5) : this.straightFacePath(4, 5); }
    @Function() frontLeftFacePath(): string   { return this._hasChamfer() ? this.chamferedSideFacePath(5, 6) : this.straightFacePath(5, 6); }

    private _cornerPath(i: number): string {
        if (!this._hasChamfer()) return this.cornerFacePath(i);
        const c = this.chamferSize;
        const cb = this.chamferBottomSize;
        let d = '';
        if (c > 0) { const f = this.chamferedCornerFacetPath(i, 'top'); if (f) d += f; }
        if (cb > 0) { const f = this.chamferedCornerFacetPath(i, 'bottom'); if (f) d += (d ? ' ' : '') + f; }
        return d || this.cornerFacePath(i);
    }

    @Function() cornerV2Path(): string { return this._cornerPath(2); }
    @Function() cornerV3Path(): string { return this._cornerPath(3); }
    @Function() cornerV4Path(): string { return this._cornerPath(4); }
    @Function() cornerV5Path(): string { return this._cornerPath(5); }
    @Function() cornerV6Path(): string { return this._cornerPath(6); }

    @Function() topXPosition(): number { return this.topX; }
    @Function() topYPosition(): number { return this.topY; }
}
