import { Model } from '@joint/decorators';
import { dia, elementTools } from '@joint/core';
import svg from './frame.svg';
import IsometricShape, { View, CONNECT_KEY } from '../isometric-shape';
import { FrameCornerControl, CONNECT_TOOL_PRESET } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 6,
    height: GRID_SIZE * 4,
};

@Model({
    attributes: {
        isFrame: true,
        z: -1,
        size: defaultSize,
    },
    template: svg,
})
export class Frame extends IsometricShape {

    override tools = {
        [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
    };

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

    // Frames render the same rect in both views; the paper matrix handles projection.
    override toggleView(_view: View) {
        // intentional no-op
    }

    // Returns the non-frame elements whose bounding-box center lies inside this frame.
    // Used by V1 validation and future zone logic.
    getContainedElements(graph: dia.Graph): dia.Element[] {
        const frameBBox = this.getBBox();
        return graph.getElements().filter((el) => {
            if (el === this || el.get('isFrame')) return false;
            return frameBBox.containsPoint(el.getBBox().center());
        });
    }
}
