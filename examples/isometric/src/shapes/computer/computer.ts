import { Model, Function } from '@joint/decorators';
import svg from './computer.svg';
import { CuboidShape } from '../isometric-shape';
import { ShapeRegistry } from '../shape-registry';

const { defaultSize, defaultIsometricHeight } = ShapeRegistry['computer'];

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg
})
export class Computer extends CuboidShape {

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
