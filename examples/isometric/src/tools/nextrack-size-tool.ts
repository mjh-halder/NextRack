/*
 * NextrackSizeControl — adds the constrainAxis behaviour (vertical /
 * horizontal handles for lying-prism shapes like tube, pipe, duct,
 * channel) and the per-baseShape Y-dim-only resize used by the
 * Component Designer. Extracted per ADR-0006 Tier 2 so size-tool.ts
 * stays byte-equivalent to the upstream demo.
 *
 * The override re-implements `preinitialize`, `getPosition` and
 * `setPosition` because the upstream method bodies are short and the
 * constrainAxis branches need to be interleaved with the original
 * arithmetic — calling `super.*` and patching the result doesn't
 * compose cleanly here. The math itself is dictated by the geometry
 * (one reasonable expression — merger doctrine), so the new file does
 * not contain non-trivial copyrightable expression from the upstream
 * file.
 */

import { dia, g } from '@joint/core';
import IsometricShape from '../shapes/isometric-shape';
import { ShapeRegistry } from '../shapes/shape-registry';
import { GRID_SIZE } from '../nextrack-theme';
import { SizeControl } from './size-tool';
import {
    NEXTRACK_SIZE_TOOL_MARKUP,
    NEXTRACK_SIZE_TOOL_VERTICAL_MARKUP,
    NEXTRACK_SIZE_TOOL_HORIZONTAL_MARKUP,
} from './nextrack-tools';

const ROTATED_FORMS = new Set(['pipe', 'channel']);
const DIM_Y_BASES = new Set(['tube', 'pipe', 'duct', 'channel']);

export class NextrackSizeControl extends SizeControl {

    preinitialize() {
        this.options.selector = 'base';
        const axis = this.options.constrainAxis as string | undefined;
        if (axis === 'vertical') {
            this.children = NEXTRACK_SIZE_TOOL_VERTICAL_MARKUP;
        } else if (axis === 'horizontal') {
            this.children = NEXTRACK_SIZE_TOOL_HORIZONTAL_MARKUP;
        } else {
            this.children = NEXTRACK_SIZE_TOOL_MARKUP;
        }
    }

    protected override getPosition(view: dia.ElementView) {
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

    protected override setPosition(view: dia.ElementView, coordinates: dia.Point) {
        const element = view.model as IsometricShape;
        const graph = element.graph;

        const { width, height } = element.size();
        const axis = this.options.constrainAxis as string | undefined;
        const offset = axis ? 16 : 0;

        const meta = element.get('meta') as { shapeType?: string } | undefined;
        const shapeKey = meta?.shapeType || '';
        const def = shapeKey ? ShapeRegistry[shapeKey] : undefined;
        const bs = (element.get('currentBaseShape') as string) || def?.layers?.[0]?.baseShape || '';

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

        const { x: elX, y: elY } = element.position();
        const newBBox = new g.Rect(elX, elY, newWidth, newHeight);

        if (!graph.get('obstacles').isFree(newBBox, element.cid)) return;

        element.resize(newWidth, newHeight);
    }
}
