import { Model, Function } from '@joint/decorators';
import svg from './switch.svg';
import { ProportionalCuboidShape } from '../isometric-shape';
import { ShapeRegistry } from '../shape-registry';

const { defaultSize, defaultIsometricHeight } = ShapeRegistry['switch'];

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg
})
export class Switch extends ProportionalCuboidShape {

    @Function()
    topXPosition(): number {
        return this.topX;
    }

    @Function()
    topYPosition(): number {
        return this.topY;
    }

    @Function()
    topCenterX(): number {
        return this.topCenter.x;
    }

    @Function()
    topCenterY(): number {
        return this.topCenter.y;
    }

    @Function()
    baseCuboidPath(): string {
        return super.baseCuboidPath();
    }

    @Function()
    topCuboidPath(): string {
        return super.topCuboidPath();
    }

    @Function()
    cuboidFrontPath(): string {
        return super.cuboidFrontPath();
    }

    @Function()
    cuboidSidePath(): string {
        return super.cuboidSidePath();
    }

    @Function()
    cuboidCornerV1Path(): string {
        return super.cuboidCornerV1Path();
    }

    @Function()
    cuboidCornerV2Path(): string {
        return super.cuboidCornerV2Path();
    }

    @Function()
    cuboidCornerV3Path(): string {
        return super.cuboidCornerV3Path();
    }
}
