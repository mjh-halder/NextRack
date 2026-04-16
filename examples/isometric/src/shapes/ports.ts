// Port configuration for IsometricShape connection points.
//
// A — 4 fixed ports at bbox edges (superseded by B).
// B — port positions projected to isometric face midpoints; recalculated on
//     view toggle, resize and height change.
// D — ports hidden by default; appear on element hover via CSS.
// C — (future) zone-based magnetic regions via custom connectionPoint.

import { dia } from '@joint/core';

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
    const positions = getPortPositions(w, h, iH, view);
    const items: dia.Element.Port[] = PORT_IDS
        .filter(id => !existing.has(id))
        .map(id => ({ id, group: id, args: positions[id] }));
    if (items.length > 0) shape.addPorts(items);
}

/** Update existing port positions (called on view toggle / resize / iH change). */
export function updatePortPositions(shape: dia.Element, view: PortView): void {
    const { width: w, height: h } = shape.size();
    const iH = (shape.get('isometricHeight') as number) ?? 0;
    const positions = getPortPositions(w, h, iH, view);
    for (const id of PORT_IDS) {
        shape.portProp(id, 'args', positions[id]);
    }
}

export type PortView = 'isometric' | '2d';

/**
 * Compute the four port positions. Positions are in MODEL SPACE (element-
 * local coordinates) on the rectangular bbox edges. The paper's isometric
 * transformation matrix projects them to the correct visual screen positions
 * automatically — no separate iso-specific offsets needed.
 */
export function getPortPositions(
    w: number, h: number, _iH: number, _view: PortView
): Record<string, { x: number; y: number }> {
    return {
        front: { x: w / 2, y: h },
        back:  { x: w / 2, y: 0 },
        left:  { x: 0,     y: h / 2 },
        right: { x: w,     y: h / 2 },
    };
}

export { PORT_RADIUS, PORT_COLOR };
