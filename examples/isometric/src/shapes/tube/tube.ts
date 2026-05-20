import { Model, Function } from '@joint/decorators';
import svg from './tube.svg';
import { TubeShape } from '../isometric-shape';
import { GRID_SIZE } from '../../theme';

const defaultSize = { width: GRID_SIZE * 3, height: GRID_SIZE * 2 };
const defaultIsometricHeight = GRID_SIZE;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg,
})
export class Tube extends TubeShape {

    @Function()
    base2DPath(): string {
        const { width: w, height: h } = this.size();
        return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    }

    @Function()
    backArcPath(): string { return this.tubeBackArcPath; }

    @Function()
    bodyPath(): string { return this.tubeBodyPath; }

    @Function()
    frontEllipsePath(): string { return this.tubeFrontEllipsePath; }
}
