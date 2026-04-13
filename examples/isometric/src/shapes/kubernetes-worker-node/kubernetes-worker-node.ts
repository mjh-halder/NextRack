import { Model, Function } from '@joint/decorators';
import svg from './kubernetes-worker-node.svg';
import { CuboidShape } from '../isometric-shape';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 2,
    height: GRID_SIZE * 2
};

const defaultIsometricHeight = GRID_SIZE / 2;

@Model({
    attributes: {
        size: defaultSize,
        defaultSize,
        defaultIsometricHeight,
        isometricHeight: defaultIsometricHeight,
    },
    template: svg
})
export class KubernetesWorkerNode extends CuboidShape {

    // Points for the octagonal base (front face, 2D view)
    // Corners are cut at 25% of each dimension
    @Function()
    baseOctagonPoints(): string {
        const { width: w, height: h } = this.size();
        const cx = w * 0.25;
        const cy = h * 0.25;
        return `${cx},0 ${w - cx},0 ${w},${cy} ${w},${h - cy} ${w - cx},${h} ${cx},${h} 0,${h - cy} 0,${cy}`;
    }

    // Points for the top octagonal face, shifted by (-iH, -iH)
    @Function()
    topOctagonPoints(): string {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const cx = w * 0.25;
        const cy = h * 0.25;
        const tx = -iH;
        const ty = -iH;
        return [
            `${tx + cx},${ty}`,
            `${tx + w - cx},${ty}`,
            `${tx + w},${ty + cy}`,
            `${tx + w},${ty + h - cy}`,
            `${tx + w - cx},${ty + h}`,
            `${tx + cx},${ty + h}`,
            `${tx},${ty + h - cy}`,
            `${tx},${ty + cy}`,
        ].join(' ');
    }

    // The bottom-facing band: traces all bottom-visible faces of the octagonal prism.
    // Connects base vertices V6→V5→V4→V3 to top vertices T3→T4→T5→T6 and closes.
    // Same color as base so it reads as a continuous front body.
    @Function()
    frontPath(): string {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const cx = w * 0.25;
        const cy = h * 0.25;
        return [
            `M 0 ${h - cy}`,           // V6: left-bottom
            `L ${cx} ${h}`,             // V5: bottom-left flat
            `L ${w - cx} ${h}`,         // V4: bottom-right flat
            `L ${w} ${h - cy}`,         // V3: right-bottom
            `L ${w - iH} ${h - cy - iH}`, // T3: top right-bottom
            `L ${w - cx - iH} ${h - iH}`, // T4: top bottom-right flat
            `L ${cx - iH} ${h - iH}`,   // T5: top bottom-left flat
            `L ${-iH} ${h - cy - iH}`,  // T6: top left-bottom
            `Z`,
        ].join(' ');
    }

    // The right-facing face: connects the right-flat edge of base to corresponding top edge.
    @Function()
    sidePath(): string {
        const { width: w, height: h } = this.size();
        const iH = this.isometricHeight;
        const cy = h * 0.25;
        return [
            `M ${w} ${cy}`,             // V2: right-top
            `L ${w} ${h - cy}`,         // V3: right-bottom
            `L ${w - iH} ${h - cy - iH}`, // T3: top right-bottom
            `L ${w - iH} ${cy - iH}`,   // T2: top right-top
            `Z`,
        ].join(' ');
    }

    // Image position on the top face
    @Function()
    topXPosition(): number {
        return -this.isometricHeight;
    }

    @Function()
    topYPosition(): number {
        return -this.isometricHeight;
    }
}
