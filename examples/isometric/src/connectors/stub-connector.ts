// ADR-0005 — Link-owned 2D stub.
//
// JointJS connector that prepends/appends a straight "stub" segment to a
// link path when the connection's endpoint sits on a Component port outside
// the visible 40×40 icon. The stub fills the gap between the port (Hit Area
// edge midpoint, per ports.ts) and the icon edge so the line appears to
// emerge from the icon rather than from empty space.
//
// In isometric view the class flag `nr-2d-icons-only` is absent and this
// connector reduces to the standard straight-segment path. In 2D, the stub
// length per end is derived from the source/target cell bbox: stub exists
// only on the axis where bbox dimension > 40.

import { connectors, dia, g } from '@joint/core';
import { SHAPE_CELL_SIZE } from '../theme';

const TWO_D_CLASS = 'nr-2d-icons-only';

export function stubConnector(
    this: dia.LinkView | unknown,
    sourcePoint: dia.Point,
    targetPoint: dia.Point,
    routePoints: dia.Point[],
    args?: { raw?: boolean },
    linkView?: dia.LinkView,
): string | g.Path {
    const raw = args?.raw === true;
    const points: dia.Point[] = [sourcePoint, ...routePoints, targetPoint];

    // JointJS sometimes invokes the connector as a method on the LinkView
    // (passing `this`) and sometimes passes linkView explicitly as the 5th
    // argument. Accept both.
    const view = linkView ?? (this as dia.LinkView | undefined);

    if (view && view.paper?.el.classList.contains(TWO_D_CLASS)) {
        const link = view.model;
        const srcPort = link.source().port;
        const tgtPort = link.target().port;

        const srcCell = (view as { sourceView?: { model: dia.Element } }).sourceView?.model;
        const tgtCell = (view as { targetView?: { model: dia.Element } }).targetView?.model;

        const srcStub = (srcCell && srcPort) ? computeStub(sourcePoint, srcCell) : null;
        const tgtStub = (tgtCell && tgtPort) ? computeStub(targetPoint, tgtCell) : null;

        if (srcStub) points.unshift(srcStub);
        if (tgtStub) points.push(tgtStub);
    }

    return buildPath(points, raw);
}

function computeStub(portPoint: dia.Point, cell: dia.Element): dia.Point | null {
    const bbox = cell.getBBox();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const iconHalf = SHAPE_CELL_SIZE / 2;
    const eps = 0.5;

    if (bbox.width > SHAPE_CELL_SIZE) {
        if (Math.abs(portPoint.x - bbox.x) < eps) {
            return { x: cx - iconHalf, y: portPoint.y };
        }
        if (Math.abs(portPoint.x - (bbox.x + bbox.width)) < eps) {
            return { x: cx + iconHalf, y: portPoint.y };
        }
    }
    if (bbox.height > SHAPE_CELL_SIZE) {
        if (Math.abs(portPoint.y - bbox.y) < eps) {
            return { x: portPoint.x, y: cy - iconHalf };
        }
        if (Math.abs(portPoint.y - (bbox.y + bbox.height)) < eps) {
            return { x: portPoint.x, y: cy + iconHalf };
        }
    }
    return null;
}

function buildPath(points: dia.Point[], raw: boolean): string | g.Path {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
    }
    return raw ? new g.Path(d) : d;
}

// Register on JointJS's runtime connectors namespace so `{ name: 'stub' }`
// resolves both for paper defaults and per-link overrides.
(connectors as unknown as Record<string, unknown>).stub = stubConnector;
