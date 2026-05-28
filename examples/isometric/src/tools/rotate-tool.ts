import { dia } from '@joint/core';
import { refreshSelect } from '../hover-highlight';

export function applyRotation(el: dia.Element, deg: number, paper?: dia.Paper): void {
    const { width, height } = el.size();
    const cx = width / 2;
    const cy = height / 2;
    el.set('labelRotation', deg);
    const tx = deg ? `rotate(${deg}, ${cx}, ${cy})` : null;
    el.attr('label/transform', tx);
    el.attr('body/transform', tx);
    refreshSelect(el);
    // elementTools.Control listens to position/size changes but not to
    // labelRotation, so the resize handles stay at the unrotated corners.
    // Re-render the toolView to pick up the new rotation.
    if (paper) {
        const view = paper.findViewByModel(el) as dia.ElementView | null;
        if (view && view.hasTools()) view.updateTools();
    }
}
