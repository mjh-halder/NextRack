/*
 * NextRack CircleShape extracted from src/shapes/isometric-shape.ts per
 * ADR-0006. The base IsometricShape it extends remains in the original
 * (MPL-2.0) file under src/shapes/isometric-shape.ts.
 */

import { g, elementTools } from '@joint/core';
import { SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { NextrackProportionalSizeControl, NextrackCenterBasedHeightControl, NEXTRACK_CONNECT_TOOL_PRESET } from '../../tools';

export class CircleShape extends NextrackIsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackProportionalSizeControl({ defaultSize }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        }
    }

    get topEllipseRx(): number {
        const { width } = this.size();
        return (width / 2) * this.scaleTopX;
    }

    get topEllipseRy(): number {
        const { height } = this.size();
        return (height / 2) * this.scaleTopY;
    }

    get sideData(): string {
        const { width, height } = this.size();
        const iH = this.isometricHeight;
        const cx = width / 2;
        const cy = height / 2;
        const rot = (this.get('shapeRotation') as number) ?? 0;
        const dx = rot === 90 ? 0   : -iH;
        const dy = -iH;

        const baseRect = new g.Rect(0, 0, width, height);
        const baseDiagonal = new g.Line(baseRect.bottomLeft(), baseRect.topRight());
        const base = g.Ellipse.fromRect(baseRect);
        const [bottomLeftIntersection, bottomRightIntersection] = baseDiagonal.intersect(base);

        const trx = this.topEllipseRx;
        const try_ = this.topEllipseRy;
        const tcx = cx + dx;
        const tcy = cy + dy;
        const topEllipse = new g.Ellipse(new g.Point(tcx, tcy), trx, try_);
        const topDiag = new g.Line(
            new g.Point(tcx - trx, tcy + try_),
            new g.Point(tcx + trx, tcy - try_)
        );
        const topIntersections = topDiag.intersect(topEllipse);
        const topLeft = topIntersections?.[0] ?? new g.Point(tcx - trx, tcy);
        const topRight = topIntersections?.[1] ?? new g.Point(tcx + trx, tcy);

        return `
            M ${bottomLeftIntersection.x} ${bottomLeftIntersection.y}
            L ${topLeft.x} ${topLeft.y}
            L ${topRight.x} ${topRight.y}
            L ${bottomRightIntersection.x} ${bottomRightIntersection.y}
        `;
    }
}
