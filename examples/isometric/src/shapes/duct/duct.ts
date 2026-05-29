import { Model, Function } from '@joint/decorators';
import svg from './duct.svg';
import { DuctShape } from './duct-shape';
import { defaultDimensionsFor } from '../shape-capabilities';

const _defaults = defaultDimensionsFor('duct');
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
export class Duct extends DuctShape {

    @Function()
    base2DPath(): string {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const c = Math.min(h, iH) * 0.28;
        return [
            `M ${c} 0`, `L ${w - c} 0`,
            `L ${w} ${c}`, `L ${w} ${h - c}`,
            `L ${w - c} ${h}`, `L ${c} ${h}`,
            `L 0 ${h - c}`, `L 0 ${c}`,
            'Z',
        ].join(' ');
    }

    @Function()
    outlinePath(): string { return this.ductOutlinePath; }

    @Function()
    backShadePath(): string { return this.ductBackShadePath; }

    @Function()
    frontPath(): string { return this.ductFrontPath; }
}
