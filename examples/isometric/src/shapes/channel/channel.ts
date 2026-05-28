import { Model, Function } from '@joint/decorators';
import svg from './channel.svg';
import { ChannelShape } from '../isometric-shape';
import { defaultDimensionsFor } from '../shape-capabilities';

const _defaults = defaultDimensionsFor('channel');
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
export class Channel extends ChannelShape {

    @Function()
    base2DPath(): string {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const c = Math.min(w, iH) * 0.28;
        return [
            `M ${c} 0`, `L ${w - c} 0`,
            `L ${w} ${c}`, `L ${w} ${h - c}`,
            `L ${w - c} ${h}`, `L ${c} ${h}`,
            `L 0 ${h - c}`, `L 0 ${c}`,
            'Z',
        ].join(' ');
    }

    @Function()
    outlinePath(): string { return this.channelOutlinePath; }

    @Function()
    frontPath(): string { return this.channelFrontPath; }
}
