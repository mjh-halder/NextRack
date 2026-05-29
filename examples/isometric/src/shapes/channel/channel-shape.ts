/*
 * NextRack ChannelShape extracted from src/shapes/isometric-shape.ts per
 * ADR-0006.
 *
 * ── Channel (lying octagonal prism along model Y — front to back) ─────────
 * Cross-section: octagon in the XZ-plane, projected via (X−Z, Y−Z).
 * Same visible faces as duct (camera symmetry in X/Y): bottom, left,
 * lower-left chamfer, plus borderline lower-right and upper-left chamfers.
 */

import { elementTools } from '@joint/core';
import { SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { NextrackSizeControl, NextrackCenterBasedHeightControl, NEXTRACK_CONNECT_TOOL_PRESET } from '../../tools';

export class ChannelShape extends NextrackIsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackSizeControl({ defaultSize, constrainAxis: 'vertical' }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private channelGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const c = Math.min(w, iH) * 0.28;

        // Octagon vertices in (X, Z) space
        const oct: [number, number][] = [
            [c, 0], [w - c, 0], [w, c], [w, iH - c],
            [w - c, iH], [c, iH], [0, iH - c], [0, c],
        ];

        // Project: 3D(X, Y, Z) → model(X−Z, Y−Z)
        const near = oct.map(([x, z]) => ({ x: x - z, y: h - z }));
        const far  = oct.map(([x, z]) => ({ x: x - z, y: -z }));

        return { near, far };
    }

    get channelOutlinePath(): string {
        const { near: n, far: f } = this.channelGeometry();
        return [
            `M ${f[5].x} ${f[5].y}`,
            `L ${f[4].x} ${f[4].y}`,
            `L ${f[3].x} ${f[3].y}`,
            `L ${f[2].x} ${f[2].y}`,
            `L ${n[2].x} ${n[2].y}`,
            `L ${n[1].x} ${n[1].y}`,
            `L ${n[0].x} ${n[0].y}`,
            `L ${n[7].x} ${n[7].y}`,
            `L ${n[6].x} ${n[6].y}`,
            `L ${n[5].x} ${n[5].y}`,
            'Z',
        ].join(' ');
    }

    get channelFrontPath(): string {
        const { near } = this.channelGeometry();
        return 'M ' + near.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
    }
}
