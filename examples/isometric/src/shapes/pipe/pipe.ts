import { Model, Function } from '@joint/decorators';
import svg from './pipe.svg';
import { PipeShape } from './pipe-shape';
import { defaultDimensionsFor } from '../shape-capabilities';

const _defaults = defaultDimensionsFor('pipe');
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
export class Pipe extends PipeShape {

    @Function()
    base2DPath(): string {
        const { width: w, height: h } = this.size();
        return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    }

    @Function()
    backArcPath(): string { return this.pipeBackArcPath; }

    @Function()
    bodyPath(): string { return this.pipeBodyPath; }

    @Function()
    frontEllipsePath(): string { return this.pipeFrontEllipsePath; }
}
