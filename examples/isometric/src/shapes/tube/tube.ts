import { Model, Function } from '@joint/decorators';
import svg from './tube.svg';
import { TubeShape } from './tube-shape';
import { defaultDimensionsFor } from '../shape-capabilities';

const _defaults = defaultDimensionsFor('tube');
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
