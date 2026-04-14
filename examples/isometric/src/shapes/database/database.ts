import { Model, Function } from '@joint/decorators';
import svg from './database.svg';
import { CylinderShape } from '../isometric-shape';
import { ShapeRegistry } from '../shape-registry';

const _databaseEntry = ShapeRegistry['database'];
if (!_databaseEntry) throw new Error('[nextrack] Built-in registry entry "database" is missing at startup — check module initialization order');
const { defaultSize, defaultIsometricHeight } = _databaseEntry;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg
})
export class Database extends CylinderShape {

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
}


