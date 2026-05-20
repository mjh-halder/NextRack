import { Model, Function } from '@joint/decorators';
import { dia, elementTools, g, util } from '@joint/core';
import svg from './double-arrow.svg';
import IsometricShape, { View } from '../isometric-shape';
import { FrameCornerControl } from '../../tools';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 8,
    height: GRID_SIZE * 3,
};

// Yellow diamond handle for adjusting bar thickness
const SQ = 6;
const HIT = 14;
const YELLOW = '#f1c21b';

const BAR_HANDLE_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="ns-resize">
        <rect stroke="none" fill="transparent" x="${-HIT/2}" y="${-HIT/2}" width="${HIT}" height="${HIT}"/>
        <rect x="${-SQ/2}" y="${-SQ/2}" width="${SQ}" height="${SQ}" fill="${YELLOW}" stroke="#a56a00" stroke-width="0.5" rx="1" ry="1" transform="rotate(45)"/>
    </g>
`;

class BarThicknessControl extends elementTools.Control {
    private _rotListener: (() => void) | null = null;

    preinitialize() {
        this.options.selector = 'base';
        this.children = BAR_HANDLE_MARKUP;
    }

    update() {
        if (!this.childNodes) return;
        const proto = Object.getPrototypeOf(Object.getPrototypeOf(this));
        if (proto.update) proto.update.call(this);
        if (!this._rotListener && this.relatedView?.model) {
            const handler = () => { if (this.childNodes) this.update(); };
            this.relatedView.model.on('change:labelRotation', handler);
            this._rotListener = () => this.relatedView?.model.off('change:labelRotation', handler);
        }
    }

    onRemove() {
        this._rotListener?.();
        this._rotListener = null;
    }

    protected getPosition(view: dia.ElementView): g.Point {
        const { width, height } = view.model.size();
        const ratio = (view.model.get('barRatio') as number) ?? 0.4;
        const rot = (view.model.get('labelRotation') as number) || 0;
        if (rot === 270) {
            const cx = width / 2;
            const cy = height / 2;
            const barTop = height * (0.5 - ratio / 2);
            // Rotate point (width*0.5, barTop) by 270° around (cx, cy)
            const dx = width * 0.5 - cx;
            const dy = barTop - cy;
            return new g.Point(cx + dy, cy - dx);
        }
        const barTop = height * (0.5 - ratio / 2);
        return new g.Point(width * 0.5, barTop);
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point): void {
        const { width, height } = view.model.size();
        const rot = (view.model.get('labelRotation') as number) || 0;
        let effectiveY: number;
        if (rot === 270) {
            const cx = width / 2;
            const cy = height / 2;
            const dx = coordinates.x - cx;
            const dy = coordinates.y - cy;
            // Inverse rotate: map back to unrotated space
            effectiveY = cy + dx;
        } else {
            effectiveY = coordinates.y;
        }
        const midY = height / 2;
        const dist = Math.max(0, Math.min(midY, midY - effectiveY));
        const ratio = Math.max(0.1, Math.min(0.9, (dist * 2) / height));
        view.model.set('barRatio', Math.round(ratio * 20) / 20);
    }
}

@Model({
    attributes: {
        isArea: true,
        isDoubleArrow: true,
        z: -1,
        size: defaultSize,
        barRatio: 0.4,
    },
    template: svg,
})
export class DoubleArrow extends IsometricShape {

    @Function()
    arrowPath(): string {
        const { width: w, height: h } = this.size();
        const ratio = (this.get('barRatio') as number) ?? 0.4;
        const ax = w * 0.2;
        const bx = w * 0.8;
        const barTop = h * (0.5 - ratio / 2);
        const barBot = h * (0.5 + ratio / 2);
        const midY = h * 0.5;
        return [
            `M 0 ${midY}`,
            `L ${ax} 0`,
            `L ${ax} ${barTop}`,
            `L ${bx} ${barTop}`,
            `L ${bx} 0`,
            `L ${w} ${midY}`,
            `L ${bx} ${h}`,
            `L ${bx} ${barBot}`,
            `L ${ax} ${barBot}`,
            `L ${ax} ${h}`,
            'Z',
        ].join(' ');
    }

    override addTools(paper: dia.Paper, _view: View) {
        const toolView = new dia.ToolsView({
            name: 'controls',
            tools: [
                new FrameCornerControl({ corner: 'bottom-right' }),
                new FrameCornerControl({ corner: 'bottom-left' }),
                new FrameCornerControl({ corner: 'top-right' }),
                new FrameCornerControl({ corner: 'top-left' }),
                new BarThicknessControl(),
            ],
        });
        this.findView(paper).addTools(toolView);
    }

    protected override usePorts(): boolean { return false; }

    override toggleView(_view: View) {
        // same flat shape in both views
    }
}
