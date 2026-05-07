import { Model, Function } from '@joint/decorators';
import svg from './pipe.svg';
import { PipeShape } from '../isometric-shape';
import { GRID_SIZE } from '../../theme';

const defaultSize = { width: GRID_SIZE * 2, height: GRID_SIZE * 3 };
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
export class Pipe extends PipeShape {

    @Function()
    base2DPath(): string {
        const { width: w, height: h } = this.size();
        const r = w / 2;
        return [
            `M 0 ${r}`,
            `A ${r} ${r} 0 0 1 ${w} ${r}`,
            `L ${w} ${h - r}`,
            `A ${r} ${r} 0 0 1 0 ${h - r}`,
            'Z',
        ].join(' ');
    }

    @Function()
    backArcPath(): string { return this.pipeBackArcPath; }

    @Function()
    bodyPath(): string { return this.pipeBodyPath; }

    @Function()
    frontEllipsePath(): string { return this.pipeFrontEllipsePath; }
}
