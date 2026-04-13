import { V, dia } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { GRID_COUNT, GRID_SIZE, SCALE, ISOMETRIC_SCALE, ROTATION_DEGREES } from './theme';
import { Link } from './shapes';

export const transformationMatrix = (view: View = View.Isometric, margin: number = 20, leftInset: number = 0, gridCount: number = GRID_COUNT) => {
    let matrix = V.createSVGMatrix().translate(margin + leftInset, margin);
    if (view === View.Isometric) {
        matrix = matrix
            .translate(gridCount * GRID_SIZE * SCALE * ISOMETRIC_SCALE, 0)
            .rotate(ROTATION_DEGREES)
            .skewX(-ROTATION_DEGREES)
            .scaleNonUniform(SCALE, SCALE * ISOMETRIC_SCALE);
    } else {
        matrix = matrix
            .scale(SCALE, SCALE);
    }
    return matrix;
}

export interface Node {
    el: dia.Element,
    behind: Node[],
    visited: boolean,
    depth?: number
}

const topologicalSort = (nodes: Node[]) => {
    let depth = 0;

    const visitNode = (node: Node) => {
        if (!node.visited) {
            node.visited = true;

            for (let i = 0; i < node.behind.length; ++i) {
                if (node.behind[i] == null) {
                    break;
                }
                else {
                    visitNode(node.behind[i]);
                    delete node.behind[i];
                }
            }

            node.depth = depth++;
            node.el.set('z', node.depth);
        }
    }

    for (let i = 0; i < nodes.length; ++i)
    {
        visitNode(nodes[i]);
    }
}

export const sortElements = (graph) => {
    const elements = graph.getElements();
    // Frames always stay at z = -1 (behind everything); exclude them from the
    // isometric topological sort so their z is never overwritten.
    const nodes: Node[] = elements
        .filter(el => !el.get('isFrame'))
        .map(el => ({
            el: el,
            behind: [],
            visited: false
        }));

    for (let i = 0; i < nodes.length; ++i)
    {
        const a = nodes[i].el;
        const aBBox = a.getBBox();
        const aMax = aBBox.bottomRight();

        for (let j = 0; j < nodes.length; ++j)
        {
            if (i != j)
            {
                const b = nodes[j].el;
                const bBBox = b.getBBox();
                const bMin = bBBox.topLeft();

                if (bMin.x < aMax.x && bMin.y < aMax.y)
                {
                    nodes[i].behind.push(nodes[j]);
                }
            }
        }
    }

    topologicalSort(nodes);

    return nodes;
}

export const drawGrid = (paper: dia.Paper, size: number, step: number, color = '#E0E0E0') => {
    const gridData = [];
    const j = size;
    for (let i = 0; i <= j; i++) {
        gridData.push(`M 0,${i * step} ${j * step},${i * step}`);
        gridData.push(`M ${i * step}, 0 ${i * step},${j * step}`);
    }
    const gridVEl = V('path').attr({
        'd': gridData.join(' '),
        'fill': 'none',
        'stroke': color
    });
    gridVEl.appendTo(paper.getLayerNode(dia.Paper.Layers.BACK));
    return gridVEl;
}

export const switchView = (paper: dia.Paper, view: View, selectedCell: IsometricShape | Link, leftInset: number = 0, gridCount: number = GRID_COUNT) => {
    paper.model.getElements().forEach((element: IsometricShape) => {
        element.toggleView(view);
    });
    if (view === View.Isometric) {
        sortElements(paper.model);
    }
    paper.matrix(transformationMatrix(view, 20, leftInset, gridCount));
    if (selectedCell) {
        selectedCell.addTools(paper, view);
    }
}
