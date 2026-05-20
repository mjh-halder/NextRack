import { Model } from '@joint/decorators';
import { dia } from '@joint/core';
import svg from './icon.svg';
import IsometricShape, { View } from '../isometric-shape';
import { FrameCornerControl } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 3,
    height: GRID_SIZE * 3,
};

@Model({
    attributes: {
        isIcon: true,
        z: -1,
        size: defaultSize,
    },
    template: svg,
})
export class Icon extends IsometricShape {

    override addTools(paper: dia.Paper, _view: View) {
        const toolView = new dia.ToolsView({
            name: 'controls',
            tools: [
                new FrameCornerControl({ corner: 'bottom-right' }),
                new FrameCornerControl({ corner: 'bottom-left' }),
                new FrameCornerControl({ corner: 'top-right' }),
                new FrameCornerControl({ corner: 'top-left' }),
            ],
        });
        this.findView(paper).addTools(toolView);
    }

    override toggleView(view: View) {
        const isIso = view === View.Isometric;
        this.attr({
            '2d': { display: isIso ? 'none' : 'block' },
            'iso': { display: isIso ? 'block' : 'none' },
        });
    }
}
