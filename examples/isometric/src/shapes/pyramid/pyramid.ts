import { Model, Function } from '@joint/decorators';
import svg from './pyramid.svg';
import { PyramidShape } from '../isometric-shape';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 2,
    height: GRID_SIZE * 2,
};

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
export class Pyramid extends PyramidShape {

    // Bottom-facing triangular face (front-left in isometric view)
    @Function()
    frontFacePoints(): string {
        const { width: w, height: h } = this.size();
        return `0,${h} ${w},${h} ${this.topX},${this.topY}`;
    }

    // Right-facing triangular face (front-right in isometric view)
    @Function()
    sideFacePoints(): string {
        const { width: w } = this.size();
        const { height: h } = this.size();
        return `${w},${h} ${w},0 ${this.topX},${this.topY}`;
    }

    // Diamond footprint shown in 2D view (pyramid seen from above)
    @Function()
    baseDiamondPoints(): string {
        const { width: w, height: h } = this.size();
        return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
    }
}
