import { dia, shapes, linkTools } from '@joint/core';
import { TargetArrowHeadTool, RemoveTool } from '../../tools';

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
                        'd': 'M 3 -4 L -3 0 L 3 4 z',
                        'fill': 'context-stroke',
                        'stroke': 'context-stroke'
                    }
                },
                wrapper: {
                    connection: true,
                    strokeWidth: 10,
                    strokeLinejoin: 'round'
                }
            }
        };
    }

    addTools(paper: dia.Paper) {
        this.findView(paper).addTools(new dia.ToolsView({
            name: 'link-tools',
            tools: [
                // Drag any orthogonal segment to move the bend point
                new linkTools.Segments(),
                // Click a segment to add a waypoint; drag to move; double-click to remove
                new linkTools.Vertices({ snapRadius: 10 }),
                new TargetArrowHeadTool(),
                new RemoveTool(),
            ]
        }));
    }
}
