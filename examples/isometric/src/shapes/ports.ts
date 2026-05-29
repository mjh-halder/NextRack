// Port configuration for IsometricShape connection points.
//
// A — 4 fixed ports at bbox edges (superseded by B).
// B — port positions projected to isometric face midpoints; recalculated on
//     view toggle, resize and height change.
// D — ports hidden by default; appear on element hover via CSS.
// C — (future) zone-based magnetic regions via custom connectionPoint.
//
// ADR-0005: Port LOGICAL positions (= routing anchors) are at the cell-bbox
// edge midpoints in BOTH iso and 2D. In 2D the VISIBLE portBody circle is
// translated inward via SVG transform so it appears on the centered 40×40
// icon — see docs/adr/0005-connection-anchor-and-stub.md. The stub connector
// fills the visible gap between the marker and the routing endpoint.

import { dia } from '@joint/core';
import { SHAPE_CELL_SIZE } from '../theme';

const PORT_RADIUS = 3;
const PORT_COLOR  = 'rgba(0, 0, 0, 0.25)';

const PORT_MARKUP: dia.MarkupJSON = [{
    tagName: 'circle',
    selector: 'portBody',
    attributes: {
        r: PORT_RADIUS,
        fill: PORT_COLOR,
        stroke: 'none',
        magnet: 'true',
        cursor: 'crosshair',
    },
}];

// All groups use 'absolute' layout so we can set exact x/y per port
// and update them on view-toggle / resize / height-change.
const ABSOLUTE_LAYOUT = { name: 'absolute' as const };

export const PORT_GROUPS: Record<string, dia.Element.PortGroup> = {
    front: { position: ABSOLUTE_LAYOUT, markup: PORT_MARKUP, attrs: { portBody: { fill: PORT_COLOR } } },
    back:  { position: ABSOLUTE_LAYOUT, markup: PORT_MARKUP, attrs: { portBody: { fill: PORT_COLOR } } },
    left:  { position: ABSOLUTE_LAYOUT, markup: PORT_MARKUP, attrs: { portBody: { fill: PORT_COLOR } } },
    right: { position: ABSOLUTE_LAYOUT, markup: PORT_MARKUP, attrs: { portBody: { fill: PORT_COLOR } } },
};

export const PORT_IDS = ['front', 'back', 'left', 'right'] as const;

/** Add the four connection ports with positions for the given view + geometry.
 *  Skips ports that already exist (e.g. on a cloned shape). */
export function initPorts(shape: dia.Element, view: PortView): void {
    const existing = new Set(shape.getPorts().map(p => p.id));
    const { width: w, height: h } = shape.size();
    const iH = (shape.get('isometricHeight') as number) ?? 0;
    const rotation = (shape.get('labelRotation') as number) || 0;
    const positions = getPortPositions(w, h, iH, view, rotation);
    const transforms = getPortMarkerTransforms(w, h, view);
    const items: dia.Element.Port[] = PORT_IDS
        .filter(id => !existing.has(id))
        .map(id => ({
            id,
            group: id,
            args: positions[id],
            attrs: { portBody: { transform: transforms[id] } },
        }));
    if (items.length > 0) shape.addPorts(items);
}

/** Update existing port positions (called on view toggle / resize / iH /
 *  labelRotation change). */
export function updatePortPositions(shape: dia.Element, view: PortView): void {
    const { width: w, height: h } = shape.size();
    const iH = (shape.get('isometricHeight') as number) ?? 0;
    const rotation = (shape.get('labelRotation') as number) || 0;
    const positions = getPortPositions(w, h, iH, view, rotation);
    const transforms = getPortMarkerTransforms(w, h, view);
    for (const id of PORT_IDS) {
        shape.portProp(id, 'args', positions[id]);
        shape.portProp(id, 'attrs/portBody/transform', transforms[id]);
    }
}

export type PortView = 'isometric' | '2d';

/**
 * Compute the four port positions. Positions are in MODEL SPACE (element-
 * local coordinates) on the cell-bbox edge midpoints — identical in iso and
 * 2D. The paper's isometric transformation matrix projects them to the
 * correct visual screen positions automatically.
 *
 * Per ADR-0005 the ports anchor at the (Hit Area ≈ cell-bbox) edges in both
 * views. The `view` parameter is retained for caller signature compatibility
 * but no longer branches the geometry; the visible icon-to-port gap in 2D is
 * filled by the link-side stub connector, not by collapsing the port box.
 *
 * The `rotation` parameter (`labelRotation` attribute, degrees) keeps the
 * ports aligned with the visually rotated body.
 */
export function getPortPositions(
    w: number, h: number, _iH: number, _view: PortView, rotation = 0,
): Record<string, { x: number; y: number }> {
    const base = {
        front: { x: w / 2, y: h },
        back:  { x: w / 2, y: 0 },
        left:  { x: 0,     y: h / 2 },
        right: { x: w,     y: h / 2 },
    };
    if (!rotation) return base;
    // Rotate around the cell centre to track the visual body transform.
    const cx = w / 2;
    const cy = h / 2;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const out: Record<string, { x: number; y: number }> = {};
    for (const [key, p] of Object.entries(base)) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        out[key] = {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos,
        };
    }
    return out;
}

/**
 * SVG transform on portBody per port so the VISIBLE marker circle is
 * displayed at the 40×40 icon edge in 2D view — independent of the port's
 * logical position (= routing anchor) which stays at the cell-bbox edge.
 *
 * In iso view the transform is empty (marker at logical position). In 2D
 * each marker is translated inward toward the cell center by half the
 * "stub length" along the relevant axis.
 *
 * For each port, "inward" is the direction from the port toward the cell
 * centre. Rotation of the cell (`labelRotation`) is NOT applied to the
 * transform — for non-rotated cells (the common case) this is exact; for
 * rotated cells the marker may visually drift, accepted as a minor corner
 * case.
 */
export function getPortMarkerTransforms(
    w: number, h: number, view: PortView,
): Record<string, string> {
    if (view !== '2d') return { front: '', back: '', left: '', right: '' };
    const stubX = Math.max(0, w / 2 - SHAPE_CELL_SIZE / 2);
    const stubY = Math.max(0, h / 2 - SHAPE_CELL_SIZE / 2);
    return {
        front: `translate(0, ${-stubY})`,
        back:  `translate(0, ${stubY})`,
        left:  `translate(${stubX}, 0)`,
        right: `translate(${-stubX}, 0)`,
    };
}

export { PORT_RADIUS, PORT_COLOR };
