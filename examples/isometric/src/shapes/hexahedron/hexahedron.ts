import { Model, Function } from '@joint/decorators';
import svg from './hexahedron.svg';
import { CuboidShape } from '../isometric-shape';
import { GRID_SIZE } from '../../theme';

// Hexahedron = regular cube: equal width, height and depth.
// Geometry is identical to a cuboid; the cube constraint (w === h === d)
// is enforced by the Shape Designer, not the rendering class.

const defaultSize = {
    width: GRID_SIZE * 2,
    height: GRID_SIZE * 2,
};

const defaultIsometricHeight = GRID_SIZE * 2;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg,
})
export class Hexahedron extends CuboidShape {

    @Function()
    topXPosition(): number {
        return this.topX;
    }

    @Function()
    topYPosition(): number {
        return this.topY;
    }
}
