import { Model, Function } from '@joint/decorators';
import svg from './hexahedron.svg';
import { RectangleShape } from '../isometric-shape';
import { defaultDimensionsFor } from '../shape-capabilities';

// Hexahedron = regular cube: equal width, height and depth.
// Geometry is identical to a rectangle; the cube constraint (w === h === d)
// is enforced by the Shape Designer, not the rendering class.

const _defaults = defaultDimensionsFor('hexahedron');
const defaultSize = { width: _defaults.width, height: _defaults.height };
const defaultIsometricHeight = _defaults.depth;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg,
})
export class Hexahedron extends RectangleShape {

    @Function()
    topXPosition(): number {
        return this.topX;
    }

    @Function()
    topYPosition(): number {
        return this.topY;
    }
}
