import { Model, Function } from '@joint/decorators';
import svg from './circle.svg';
import { CircleShape } from '../isometric-shape';
import { defaultDimensionsFor } from '../shape-capabilities';

const _defaults = defaultDimensionsFor('circle');
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
export class Circle extends CircleShape {

    @Function()
    topImageXPosition(): number {
        return this.topX;
    }

    @Function()
    topImageYPosition(): number {
        return this.topY;
    }

    @Function()
    getSideData(): string {
        return this.sideData;
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
    topRx(): number {
        return this.topEllipseRx;
    }

    @Function()
    topRy(): number {
        return this.topEllipseRy;
    }
}
