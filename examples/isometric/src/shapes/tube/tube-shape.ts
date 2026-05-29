/*
 * NextRack TubeShape extracted from src/shapes/isometric-shape.ts per
 * ADR-0006. PHI / SQRT2 are exported because PipeShape reuses them.
 *
 * ── Tube (horizontal circle / pipe) ─────────────────────────────────────
 *
 * A circle of radius R in the 3D YZ-plane projects into 2D model space as the
 * conic 2u² − 2uv + v² = R².  Diagonalising the matrix [[2,−1],[−1,1]] gives
 * eigenvalues λ = (3±√5)/2, semi-axes a = R/√λ₂ = φR, b = R/√λ₁ = R/φ and
 * the major-axis direction (1, φ) → rotation = atan(φ) ≈ 58.28°.
 *
 * Tangent lines parallel to the tube axis (model-x) touch the ellipse at
 * θ = −π/4 (bottom) and θ = 3π/4 (top), where the parametric form is:
 *   u = −R sin θ,  v = R cos θ − R sin θ.
 * These tangent points define where the mantle attaches to the end caps.
 */

import { elementTools } from '@joint/core';
import { SIZE_KEY, CONNECT_KEY, ISOMETRIC_HEIGHT_KEY } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { NextrackSizeControl, NextrackCenterBasedHeightControl, NEXTRACK_CONNECT_TOOL_PRESET } from '../../tools';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const TUBE_ARC_ROTATION = (Math.atan(PHI) * 180) / Math.PI;
export const SQRT2 = Math.SQRT2;

export class TubeShape extends NextrackIsometricShape {
    constructor(...args: any[]) {
        super(...args);
        const { defaultSize, defaultIsometricHeight } = this.attributes;
        this.tools = {
            [SIZE_KEY]: new NextrackSizeControl({ defaultSize, constrainAxis: 'horizontal' }),
            [CONNECT_KEY]: new elementTools.Connect(NEXTRACK_CONNECT_TOOL_PRESET),
            [ISOMETRIC_HEIGHT_KEY]: new NextrackCenterBasedHeightControl({ defaultIsometricHeight }),
        };
    }

    private tubeGeometry() {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const R = iH / 2;
        const rx = PHI * R;
        const ry = R / PHI;
        const rot = TUBE_ARC_ROTATION;

        const s = R / SQRT2;
        const s2 = R * SQRT2;

        // Ellipse centers in model space: 3D(x, h/2, R) → model(x − R, h/2 − R)
        const ncx = w - R;
        const ncy = h / 2 - R;
        const fcx = -R;
        const fcy = h / 2 - R;

        // Tangent points where body meets ellipses
        // Bottom tangent (θ = −π/4): offset (+s, +s2) from centre
        // Top tangent    (θ = 3π/4): offset (−s, −s2) from centre
        return {
            rx, ry, rot,
            nb: { x: ncx + s, y: ncy + s2 },
            nt: { x: ncx - s, y: ncy - s2 },
            fb: { x: fcx + s, y: fcy + s2 },
            ft: { x: fcx - s, y: fcy - s2 },
        };
    }

    // Back arc — the protruding left half of the far-end ellipse.
    // Closed via the chord ft→fb so the body (drawn on top) hides the seam.
    get tubeBackArcPath(): string {
        const { rx, ry, rot, fb, ft } = this.tubeGeometry();
        return [
            `M ${ft.x} ${ft.y}`,
            `A ${rx} ${ry} ${rot} 0 0 ${fb.x} ${fb.y}`,
            'Z',
        ].join(' ');
    }

    // Body — the mantle rectangle closed by the right half of the back ellipse.
    // The arc from fb→ft ensures a seamless tangential join at both ends.
    get tubeBodyPath(): string {
        const { rx, ry, rot, nb, nt, fb, ft } = this.tubeGeometry();
        return [
            `M ${ft.x} ${ft.y}`,
            `L ${nt.x} ${nt.y}`,
            `L ${nb.x} ${nb.y}`,
            `L ${fb.x} ${fb.y}`,
            `A ${rx} ${ry} ${rot} 0 1 ${ft.x} ${ft.y}`,
            'Z',
        ].join(' ');
    }

    // Front ellipse — full closed ellipse at the near end
    get tubeFrontEllipsePath(): string {
        const { rx, ry, rot, nb, nt } = this.tubeGeometry();
        return [
            `M ${nb.x} ${nb.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nt.x} ${nt.y}`,
            `A ${rx} ${ry} ${rot} 1 0 ${nb.x} ${nb.y}`,
            'Z',
        ].join(' ');
    }
}
