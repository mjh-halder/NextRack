import { Model, Function } from '@joint/decorators';
import svg from './router.svg';
import { CylinderShape } from '../isometric-shape';
import { ShapeRegistry } from '../shape-registry';

const _routerEntry = ShapeRegistry['router'];
if (!_routerEntry) throw new Error('[nextrack] Built-in registry entry "router" is missing at startup — check module initialization order');
const { defaultSize, defaultIsometricHeight } = _routerEntry;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg
})

export class Router extends CylinderShape {

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


