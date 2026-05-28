import { dia } from '@joint/core';

/**
 * In 2D view the visible icon is a fixed 40×40 box centred inside the
 * element's full bounds. Labels orient to that visible block — not to the
 * element bounds — so the label-to-icon gap matches what the user sees in
 * isometric view.
 */
export const ICON_BOX_2D = 40;

/**
 * Recompute and apply `label` SVG attributes (x/y/textAnchor) for a component
 * based on its current `labelPosition`, `viewMode`, `labelDistance` and
 * `isometricHeight`. Called from the inspector when the user picks a position
 * or changes the distance, and from `toggleView` when iso/2D switches.
 *
 * Bails out for cells that have not had `labelPosition` set explicitly — these
 * keep whatever default the shape definition's SVG specifies.
 */
export function applyLabelPosition(cell: dia.Element): void {
    const value = cell.get('labelPosition') as string | undefined;
    if (!value) return;
    if (value === 'none') {
        cell.attr('label/display', 'none');
        return;
    }
    cell.attr('label/display', null);

    const viewMode = (cell.get('viewMode') as string) || 'iso';
    const gap = (cell.get('labelDistance') as number) ?? 10;
    const iH = (cell.get('isometricHeight') as number) || 0;

    let xLeft: string | number;
    let xRight: string | number;
    let yTop: string | number;
    let yBottom: string | number;
    let yMiddle: string | number;
    const xCenter = 'calc(w / 2)';

    if (viewMode === '2d') {
        const half = ICON_BOX_2D / 2;
        xLeft = `calc(w / 2 - ${half + gap})`;
        xRight = `calc(w / 2 + ${half + gap})`;
        yTop = `calc(h / 2 - ${half + gap})`;
        yBottom = `calc(h / 2 + ${half + gap})`;
        yMiddle = 'calc(h / 2)';
    } else {
        xLeft = -gap;
        xRight = `calc(w + ${gap})`;
        yTop = -iH - gap;
        yBottom = `calc(h + ${gap})`;
        yMiddle = `calc(h / 2 - ${iH / 2})`;
    }

    switch (value) {
        case 'bottom-right':
            cell.attr({ label: { x: xRight, y: yBottom, textAnchor: 'start' } }); break;
        case 'bottom-left':
            cell.attr({ label: { x: xLeft, y: yBottom, textAnchor: 'end' } }); break;
        case 'top-right':
            cell.attr({ label: { x: xRight, y: yTop, textAnchor: 'start' } }); break;
        case 'top-left':
            cell.attr({ label: { x: xLeft, y: yTop, textAnchor: 'end' } }); break;
        case 'top-center':
            cell.attr({ label: { x: xCenter, y: yTop, textAnchor: 'middle' } }); break;
        case 'middle-left':
            cell.attr({ label: { x: xLeft, y: yMiddle, textAnchor: 'end' } }); break;
        case 'middle-right':
            cell.attr({ label: { x: xRight, y: yMiddle, textAnchor: 'start' } }); break;
        case 'bottom-center':
            cell.attr({ label: { x: xCenter, y: yBottom, textAnchor: 'middle' } }); break;
    }
}
