import { Model, Function } from '@joint/decorators';
import { elementTools } from '@joint/core';
import svg from './octagon.svg';
import { PolygonShape, SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import { SizeControl, CenterBasedHeightControl, CONNECT_TOOL_PRESET } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 2,
    height: GRID_SIZE * 2,
};

const defaultIsometricHeight = GRID_SIZE / 2;

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
            [SIZE_KEY]: new SizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
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

    /** 2D / hit-area footprint path (rounded when cornerRadius > 0). */
    @Function()
    baseOctagonPath(): string {
        return this.footprintPath(this.baseVertices(), this.cornerRadius);
    }

    @Function()
    topOctagonPath(): string {
        const tv = this.topVertices();
        if (this.chamferSize > 0) return this.chamferedFootprintPath(tv, this.chamferSize);
        return this.footprintPath(tv, this.cornerRadius);
    }

    @Function() rightFacePath(): string    { return this.chamferSize > 0 ? this.chamferedSideFacePath(2, 3) : this.straightFacePath(2, 3); }
    @Function() frontRightFacePath(): string { return this.chamferSize > 0 ? this.chamferedSideFacePath(3, 4) : this.straightFacePath(3, 4); }
    @Function() frontBottomFacePath(): string { return this.chamferSize > 0 ? this.chamferedSideFacePath(4, 5) : this.straightFacePath(4, 5); }
    @Function() frontLeftFacePath(): string  { return this.chamferSize > 0 ? this.chamferedSideFacePath(5, 6) : this.straightFacePath(5, 6); }

    @Function() cornerV2Path(): string { return this.chamferSize > 0 ? this.chamferedCornerFacetPath(2) : this.cornerFacePath(2); }
    @Function() cornerV3Path(): string { return this.chamferSize > 0 ? this.chamferedCornerFacetPath(3) : this.cornerFacePath(3); }
    @Function() cornerV4Path(): string { return this.chamferSize > 0 ? this.chamferedCornerFacetPath(4) : this.cornerFacePath(4); }
    @Function() cornerV5Path(): string { return this.chamferSize > 0 ? this.chamferedCornerFacetPath(5) : this.cornerFacePath(5); }
    @Function() cornerV6Path(): string { return this.chamferSize > 0 ? this.chamferedCornerFacetPath(6) : this.cornerFacePath(6); }

    @Function() topXPosition(): number { return this.topX; }
    @Function() topYPosition(): number { return this.topY; }
}
