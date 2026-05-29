import { V, dia } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { GRID_COUNT, GRID_SIZE, SCALE, ISOMETRIC_SCALE, ROTATION_DEGREES } from './theme';
import { Link } from './shapes';
import { applyShapeFillOpacity } from './nextrack-utils';

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
    //
    // Complex-component child layers overlap each other fully (same footprint),
    // which creates mutual "behind" edges the DFS then breaks arbitrarily —
    // producing Z-order flicker on every drag step. We exclude them from the
    // sort and re-anchor their z to the base's below so within-component paint
    // order is decided by DOM (= creation) order instead.
    const nodes: Node[] = elements
        .filter(el => !el.get('isFrame') && !el.get('isArea') && !el.get('isGridLabel') && el.get('componentRole') !== 'child')
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

    // Anchor each component's child layers to the base's z. Same-z siblings
    // paint in DOM order — Layer 0 was the last added to the graph so it stays
    // on top; layers N..1 below it keep their creation order underneath.
    for (const el of elements) {
        if (el.get('componentRole') !== 'child') continue;
        const parent = el.getParentCell();
        if (parent && !parent.isLink() && (parent as dia.Element).get('componentRole') === 'base') {
            el.set('z', parent.get('z'));
        }
    }

    return nodes;
}

export const drawGrid = (paper: dia.Paper, sizeX: number, step: number, color = '#e8e8e8', sizeY = sizeX, opacity = 1) => {
    const gridData = [];
    for (let i = 0; i <= sizeY; i++) {
        gridData.push(`M 0,${i * step} ${sizeX * step},${i * step}`);
    }
    for (let i = 0; i <= sizeX; i++) {
        gridData.push(`M ${i * step},0 ${i * step},${sizeY * step}`);
    }
    const gridVEl = V('path').attr({
        'd': gridData.join(' '),
        'fill': 'none',
        'stroke': color,
        'stroke-opacity': String(opacity),
        'class': 'nr-grid-lines'
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
    // Re-apply custom fill-opacity after the view re-render — toggleView()
    // resets the SVG attrs that applyShapeFillOpacity writes directly to
    // the DOM, so without this opacity silently snaps back to 1 on every
    // 2D↔Iso switch.
    requestAnimationFrame(() => {
        paper.model.getElements().forEach((element) => {
            const op = (element.get('shapeOpacity') as number | undefined);
            if (op == null || op >= 100) return;
            const cellView = paper.findViewByModel(element);
            if (cellView) applyShapeFillOpacity(cellView, op / 100);
        });
    });
}
