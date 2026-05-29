import { Model } from '@joint/decorators';
import { dia } from '@joint/core';
import svg from './grid-label.svg';
import { View } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { FrameCornerControl } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 2,
    height: GRID_SIZE,
};

@Model({
    attributes: {
        isGridLabel: true,
        z: -1,
        size: defaultSize,
        labelFontSize: 14,
    },
    template: svg,
})
export class GridLabel extends NextrackIsometricShape {

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
        // same text in both views
    }

    autoSize(paper: dia.Paper): void {
        const view = this.findView(paper);
        if (!view) return;
        const textEl = view.el.querySelector('[joint-selector="label"]') as SVGTextElement | null;
        if (!textEl) return;
        const bbox = textEl.getBBox();
        this.resize(Math.max(GRID_SIZE / 2, bbox.width + 2), Math.max(GRID_SIZE / 2, bbox.height + 2));
    }
}
