/*
 * NextrackLink — overrides the upstream Link's visual styling and tool
 * preset. Extracted per ADR-0006 Tier 2 so link.ts stays byte-equivalent
 * to the upstream demo and carries no NextRack code.
 *
 * Visual changes:
 *   - Thinner line (1 px) with a larger arrow head + invisible 20-px
 *     wrapper for easier picking
 *   - Square (rect) vertex handles instead of the default circle
 *
 * Tool change: source + target reconnection handles plus snap-radius
 * vertices, replacing the upstream TargetArrowHeadTool + RemoveTool pair.
 */

import { dia, linkTools, util } from '@joint/core';
import { Link } from './link';

const VTX_SIZE = 4;
const RECONNECT_HIT = 14;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RECONNECT_MARKUP: dia.MarkupJSON = util.svg`
    <circle r="${RECONNECT_HIT / 2}" fill="transparent" stroke="none" cursor="move"/>
`;

const SquareVertexHandle = ((linkTools.Vertices as any).VertexHandle as any).extend({
    tagName: 'rect',
    attributes: {
        'width': VTX_SIZE,
        'height': VTX_SIZE,
        'fill': '#000000',
        'stroke': '#ffffff',
        'stroke-width': 0.5,
        'cursor': 'move',
    },
    position(x: number, y: number) {
        this.vel.attr({ x: x - VTX_SIZE / 2, y: y - VTX_SIZE / 2 });
    },
});

export class NextrackLink extends Link {
    override defaults() {
        return {
            ...super.defaults(),
            attrs: {
                line: {
                    connection: true,
                    stroke: '#333333',
                    strokeWidth: 1,
                    strokeLinejoin: 'round',
                    targetMarker: {
                        'type': 'path',
                        'd': 'M 6 -4 L 0 0 L 6 4 z',
                        'fill': 'context-stroke',
                        'stroke': 'context-stroke'
                    }
                },
                wrapper: {
                    connection: true,
                    stroke: 'transparent',
                    fill: 'none',
                    strokeWidth: 20,
                    strokeLinejoin: 'round'
                }
            }
        };
    }

    override addTools(paper: dia.Paper) {
        this.findView(paper).addTools(new dia.ToolsView({
            name: 'link-tools',
            tools: [
                new linkTools.Vertices({ snapRadius: 10, handleClass: SquareVertexHandle as any }),
                new linkTools.TargetArrowhead({ tagName: 'circle', attributes: { r: RECONNECT_HIT / 2, fill: 'transparent', stroke: 'none', cursor: 'move' } }),
                new linkTools.SourceArrowhead({ tagName: 'circle', attributes: { r: RECONNECT_HIT / 2, fill: 'transparent', stroke: 'none', cursor: 'move' } }),
            ]
        }));
    }
}
