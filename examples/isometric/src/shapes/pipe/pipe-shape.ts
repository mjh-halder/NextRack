/*
 * NextRack PipeShape extracted from src/shapes/isometric-shape.ts per
 * ADR-0006.
 *
 * ── Pipe (horizontal circle along model Y — front to back) ──────────────
 * Circle in the XZ-plane: conic u²−2uv+2v²=R².  Same eigenvalues as the
 * tube (λ=(3±√5)/2), but the major axis is along (1, 1/φ) → rotation ≈ 31.72°.
 * Tangent lines parallel to model-Y touch at offset (±R√2, ±R/√2).
 */

import { elementTools } from '@joint/core';
import { SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { NextrackSizeControl, NextrackCenterBasedHeightControl, NEXTRACK_CONNECT_TOOL_PRESET } from '../../tools';
import { PHI, SQRT2 } from '../tube/tube-shape';

export const PIPE_ARC_ROTATION = (Math.atan(1 / PHI) * 180) / Math.PI;

export class PipeShape extends NextrackIsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackSizeControl({ defaultSize, constrainAxis: 'vertical' }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private pipeGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const R = iH / 2;
        const rx = PHI * R;
        const ry = R / PHI;
        const rot = PIPE_ARC_ROTATION;

        const s = R * SQRT2;
        const s2 = R / SQRT2;

        // Ellipse centres: 3D(w/2, y, R) → model(w/2−R, y−R)
        const ncx = w / 2 - R;
        const ncy = h - R;
        const fcx = w / 2 - R;
        const fcy = -R;

        // Right tangent (θ=−π/4): offset (+R√2, +R/√2)
        // Left tangent  (θ=3π/4): offset (−R√2, −R/√2)
        return {
            rx, ry, rot,
            nr: { x: ncx + s, y: ncy + s2 },
            nl: { x: ncx - s, y: ncy - s2 },
            fr: { x: fcx + s, y: fcy + s2 },
            fl: { x: fcx - s, y: fcy - s2 },
        };
    }

    get pipeBackArcPath(): string {
        const { rx, ry, rot, fl, fr } = this.pipeGeometry();
        return [
            `M ${fl.x} ${fl.y}`,
            `A ${rx} ${ry} ${rot} 0 1 ${fr.x} ${fr.y}`,
            'Z',
        ].join(' ');
    }

    get pipeBodyPath(): string {
        const { rx, ry, rot, nr, nl, fr, fl } = this.pipeGeometry();
        return [
            `M ${fl.x} ${fl.y}`,
            `L ${nl.x} ${nl.y}`,
            `L ${nr.x} ${nr.y}`,
            `L ${fr.x} ${fr.y}`,
            `A ${rx} ${ry} ${rot} 0 0 ${fl.x} ${fl.y}`,
            'Z',
        ].join(' ');
    }

    get pipeFrontEllipsePath(): string {
        const { rx, ry, rot, nr, nl } = this.pipeGeometry();
        return [
            `M ${nr.x} ${nr.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nl.x} ${nl.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nr.x} ${nr.y}`,
            'Z',
        ].join(' ');
    }
}
