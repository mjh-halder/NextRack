/*
 * NextRack DuctShape extracted from src/shapes/isometric-shape.ts per
 * ADR-0006.
 *
 * ── Duct (lying octagonal prism along model X) ────────────────────────────
 * Cross-section: octagon in the YZ-plane, projected via (X−Z, Y−Z).
 * Visible faces (camera ≈ −1,−1,−1): bottom, left, lower-left chamfer,
 * plus the two borderline chamfer faces (lower-right, upper-left).
 */

import { elementTools } from '@joint/core';
import { SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { NextrackSizeControl, NextrackCenterBasedHeightControl, NEXTRACK_CONNECT_TOOL_PRESET } from '../../tools';

export class DuctShape extends NextrackIsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackSizeControl({ defaultSize, constrainAxis: 'horizontal' }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private ductGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const c = Math.min(h, iH) * 0.28;

        // Octagon vertices in (Y, Z) space, bottom-left origin
        const oct: [number, number][] = [
            [c, 0], [h - c, 0], [h, c], [h, iH - c],
            [h - c, iH], [c, iH], [0, iH - c], [0, c],
        ];

        const near = oct.map(([y, z]) => ({ x: w - z, y: y - z }));
        const far  = oct.map(([y, z]) => ({ x: -z,    y: y - z }));

        return { near, far };
    }

    // Full outline: one closed polygon tracing the entire visible shape.
    // Goes through the protruding back edges then across the mantle to the
    // near end. Single stroke, no double lines, no crossing.
    get ductOutlinePath(): string {
        const { near: n, far: f } = this.ductGeometry();
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

    // Back shade: protruding back portion, fill only (no stroke).
    // The chord closure is invisible because the outline's stroke covers it.
    get ductBackShadePath(): string {
        const { far: f } = this.ductGeometry();
        return `M ${f[2].x} ${f[2].y} L ${f[3].x} ${f[3].y} L ${f[4].x} ${f[4].y} L ${f[5].x} ${f[5].y} Z`;
    }

    // Front face: full near octagon with fill + stroke for the end-cap edges.
    get ductFrontPath(): string {
        const { near } = this.ductGeometry();
        return 'M ' + near.map(p => `${p.x} ${p.y}`).join(' L ') + ' Z';
    }
}
