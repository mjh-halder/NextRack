import { dia } from '@joint/core';
import { refreshSelect } from '../hover-highlight';

export function applyRotation(el: dia.Element, deg: number): void {
    const { width, height } = el.size();
    const cx = width / 2;
    const cy = height / 2;
    el.set('labelRotation', deg);
    const tx = deg ? `rotate(${deg}, ${cx}, ${cy})` : null;
    el.attr('label/transform', tx);
    el.attr('body/transform', tx);
    refreshSelect(el);
}
