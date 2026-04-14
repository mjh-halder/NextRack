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

    /** Isometric top face: footprint shifted by (-iH, -iH). */
    @Function()
    topOctagonPath(): string {
        const iH = this.isometricHeight;
        const shifted = this.baseVertices().map(([x, y]) => [x - iH, y - iH] as [number, number]);
        return this.footprintPath(shifted, this.cornerRadius);
    }

    // ── Straight side faces ───────────────────────────────────────────────────
    // Hidden: V0-V1 (top), V1-V2 (upper-right), V6-V7 (left), V7-V0 (upper-left).

    /** V2→V3: right face (right-facing, medium gray) */
    @Function() rightFacePoints(): string   { return this.straightFacePoints(2, 3); }

    /** V3→V4: bottom-right diagonal (front-facing) */
    @Function() frontRightPoints(): string  { return this.straightFacePoints(3, 4); }

    /** V4→V5: bottom face (front-facing) */
    @Function() frontBottomPoints(): string { return this.straightFacePoints(4, 5); }

    /** V5→V6: bottom-left diagonal (front-facing) */
    @Function() frontLeftPoints(): string   { return this.straightFacePoints(5, 6); }

    // ── Corner side panels ────────────────────────────────────────────────────
    // V7, V0, V1 are fully hidden; not rendered.
    // V2 and V6 are boundary corners (one hidden edge, one visible).

    @Function() cornerV2Path(): string { return this.cornerFacePath(2); }
    @Function() cornerV3Path(): string { return this.cornerFacePath(3); }
    @Function() cornerV4Path(): string { return this.cornerFacePath(4); }
    @Function() cornerV5Path(): string { return this.cornerFacePath(5); }
    @Function() cornerV6Path(): string { return this.cornerFacePath(6); }

    @Function() topXPosition(): number { return this.topX; }
    @Function() topYPosition(): number { return this.topY; }
}
