import { Model, Function } from '@joint/decorators';
import { elementTools } from '@joint/core';
import svg from './hexagonal.svg';
import { PolygonShape, SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import { ProportionalSizeControl, CenterBasedHeightControl, CONNECT_TOOL_PRESET } from '../../tools';
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
export class Hexagonal extends PolygonShape {

    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new ProportionalSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new CenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    /**
     * Clockwise footprint for the hexagonal prism.
     *
     *   V0 ──── V1
     *  /          \
     * V5            V2
     *  \          /
     *   V4 ──── V3
     */
    baseVertices(): Array<[number, number]> {
        const { width: w, height: h } = this.size();
        const cx = w * 0.25;
        return [
            [cx,     0  ],  // V0: top-left
            [w - cx, 0  ],  // V1: top-right
            [w,      h/2],  // V2: right
            [w - cx, h  ],  // V3: bottom-right
            [cx,     h  ],  // V4: bottom-left
            [0,      h/2],  // V5: left
        ];
    }

    /** 2D / hit-area footprint path (rounded when cornerRadius > 0). */
    @Function()
    baseHexPath(): string {
        return this.footprintPath(this.baseVertices(), this.cornerRadius);
    }

    @Function()
    topHexPath(): string {
        return this.footprintPath(this.topVertices(), this.cornerRadius);
    }

    // ── Straight side faces ───────────────────────────────────────────────────
    // Hidden faces (V5→V0, V0→V1) are not rendered.

    /** V1→V2: upper-right diagonal (right-facing) */
    @Function() upperRightFacePoints(): string { return this.straightFacePoints(1, 2); }

    /** V2→V3: lower-right diagonal (right-facing) */
    @Function() lowerRightFacePoints(): string { return this.straightFacePoints(2, 3); }

    /** V3→V4: bottom-right face (front-facing) */
    @Function() bottomRightFacePoints(): string { return this.straightFacePoints(3, 4); }

    /** V4→V5: bottom-left diagonal (front-facing) */
    @Function() bottomLeftFacePoints(): string  { return this.straightFacePoints(4, 5); }

    // ── Corner side panels ────────────────────────────────────────────────────
    // V0 is fully hidden (between two hidden edges); not rendered.
    // V1 and V5 are boundary corners (one hidden edge, one visible).

    @Function() cornerV1Path(): string { return this.cornerFacePath(1); }
    @Function() cornerV2Path(): string { return this.cornerFacePath(2); }
    @Function() cornerV3Path(): string { return this.cornerFacePath(3); }
    @Function() cornerV4Path(): string { return this.cornerFacePath(4); }
    @Function() cornerV5Path(): string { return this.cornerFacePath(5); }

    @Function() topXPosition(): number { return this.topX; }
    @Function() topYPosition(): number { return this.topY; }
}
