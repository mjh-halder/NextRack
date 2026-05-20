import { dia, shapes, linkTools, util } from '@joint/core';

const VTX_SIZE = 4;
const RECONNECT_HIT = 14;

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

export class Link extends shapes.standard.Link {
    defaults() {
        return {
            ...super.defaults,
            z: -1,
            type: 'Link',
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

    addTools(paper: dia.Paper) {
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
