import { Model } from '@joint/decorators';
import { dia } from '@joint/core';
import svg from './area.svg';
import IsometricShape, { View } from '../isometric-shape';
import { FrameCornerControl } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 6,
    height: GRID_SIZE * 4,
};

@Model({
    attributes: {
        isArea: true,
        z: -1,
        size: defaultSize,
    },
    template: svg,
})
export class Area extends IsometricShape {

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

    override toggleView(_view: View) {
        // same rect in both views
    }
}
