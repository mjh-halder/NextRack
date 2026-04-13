import { dia, elementTools, g } from '@joint/core';
import { GRID_SIZE } from '../theme';
import { SIZE_TOOL_MARKUP } from './tools';

// Like SizeControl, but without the obstacle-free check —
// frames are not registered as obstacles and must resize freely.
export class FrameSizeControl extends elementTools.Control {

    preinitialize() {
        this.options.selector = 'body';
        this.children = SIZE_TOOL_MARKUP;
    }

    protected getPosition(view: dia.ElementView) {
        const { width, height } = view.model.size();
        return new g.Point(width, height);
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point) {
        const { width, height } = view.model.size();
        const dx = Math.round((coordinates.x - width) / GRID_SIZE);
        const dy = Math.round((coordinates.y - height) / GRID_SIZE);
        const newWidth  = Math.max(GRID_SIZE * 2, width  + dx * GRID_SIZE);
        const newHeight = Math.max(GRID_SIZE * 2, height + dy * GRID_SIZE);
        view.model.resize(newWidth, newHeight);
    }
}
