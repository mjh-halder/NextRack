import { dia, elementTools, g } from '@joint/core';
import IsometricShape from '../shapes/isometric-shape';
import { ShapeRegistry } from '../shapes/shape-registry';
import { GRID_SIZE } from '../theme';
import { SIZE_TOOL_MARKUP, SIZE_TOOL_VERTICAL_MARKUP, SIZE_TOOL_HORIZONTAL_MARKUP } from './tools';

const ROTATED_FORMS = new Set(['pipe', 'channel']);
const DIM_Y_BASES = new Set(['tube', 'pipe', 'duct', 'channel']);

export class SizeControl extends elementTools.Control {

    preinitialize() {
        this.options.selector = 'base';
        const axis = this.options.constrainAxis as string | undefined;
        if (axis === 'vertical') {
            this.children = SIZE_TOOL_VERTICAL_MARKUP;
        } else if (axis === 'horizontal') {
            this.children = SIZE_TOOL_HORIZONTAL_MARKUP;
        } else {
            this.children = SIZE_TOOL_MARKUP;
        }
    }

    protected getPosition(view: dia.ElementView) {
        const { width, height } = view.model.size();
        const axis = this.options.constrainAxis as string | undefined;
        const offset = 16;
        if (axis === 'vertical') {
            return new g.Point(width / 2, height + offset);
        } else if (axis === 'horizontal') {
            return new g.Point(width + offset, height / 2);
        }
        return new g.Point(width, height);
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point) {

        const element = view.model as IsometricShape;
        const graph = element.graph;

        const { width, height } = element.size();
        const axis = this.options.constrainAxis as string | undefined;
        const offset = axis ? 16 : 0;

        const meta = element.get('meta') as { shapeType?: string } | undefined;
        const shapeKey = meta?.shapeType || '';
        const def = shapeKey ? ShapeRegistry[shapeKey] : undefined;
        const bs = (element.get('currentBaseShape') as string) || def?.baseShape || '';

        let newWidth: number;
        let newHeight: number;
        if (def?.dimYAdjustable && DIM_Y_BASES.has(bs)) {
            const isRotated = ROTATED_FORMS.has(bs);
            if (isRotated) {
                const yStep = Math.round((coordinates.y - height - offset) / GRID_SIZE);
                newWidth = width;
                newHeight = Math.max(GRID_SIZE, height + yStep * GRID_SIZE);
            } else {
                const xStep = Math.round((coordinates.x - width - offset) / GRID_SIZE);
                newWidth = Math.max(GRID_SIZE, width + xStep * GRID_SIZE);
                newHeight = height;
            }
        } else {
            const xStep = Math.round((coordinates.x - width) / GRID_SIZE);
            const yStep = Math.round((coordinates.y - height) / GRID_SIZE);
            newWidth = Math.max(GRID_SIZE, width + xStep * GRID_SIZE);
            newHeight = Math.max(GRID_SIZE, height + yStep * GRID_SIZE);
        }

        const { x: elX, y: elY } = element.position()
        const newBBox = new g.Rect(elX, elY, newWidth, newHeight);

        if (!graph.get('obstacles').isFree(newBBox, element.cid)) return;

        element.resize(newWidth, newHeight);
    }
}
