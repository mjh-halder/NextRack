import { Model, Function } from '@joint/decorators';
import svg from './rectangle.svg';
import { RectangleShape } from '../isometric-shape';
import { defaultDimensionsFor } from '../shape-capabilities';

const _defaults = defaultDimensionsFor('rectangle');
const defaultSize = { width: _defaults.width, height: _defaults.height };
const defaultIsometricHeight = _defaults.depth;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg
})
export class Rectangle extends RectangleShape {

    @Function()
    baseRectanglePath(): string {
        return super.baseRectanglePath();
    }

    @Function()
    baseRectanglePathIso(): string {
        return super.baseRectanglePathIso();
    }

    @Function()
    topRectanglePath(): string {
        return super.topRectanglePath();
    }

    @Function()
    rectangleFrontPath(): string {
        return super.rectangleFrontPath();
    }

    @Function()
    rectangleSidePath(): string {
        return super.rectangleSidePath();
    }

    @Function()
    rectangleCornerV1Path(): string {
        return super.rectangleCornerV1Path();
    }

    @Function()
    rectangleCornerV2Path(): string {
        return super.rectangleCornerV2Path();
    }

    @Function()
    rectangleCornerV3Path(): string {
        return super.rectangleCornerV3Path();
    }
}
