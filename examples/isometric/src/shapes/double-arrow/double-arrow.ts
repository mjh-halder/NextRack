import { Model, Function } from '@joint/decorators';
import { dia, elementTools, g, util } from '@joint/core';
import svg from './double-arrow.svg';
import { View } from '../isometric-shape';
import NextrackIsometricShape from '../nextrack-isometric-shape';
import { FrameCornerControl } from '../../tools';
import { showDragTooltip } from '../../tools/drag-tooltip';
import { GRID_SIZE } from '../../theme';

const defaultSize = {
    width: GRID_SIZE * 8,
    height: GRID_SIZE * 3,
};

// Yellow diamond handles. Same visual treatment, different drag axes.
const SQ = 6;
const HIT = 14;
const YELLOW = '#f1c21b';

const BAR_HANDLE_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="ns-resize">
        <rect stroke="none" fill="transparent" x="${-HIT/2}" y="${-HIT/2}" width="${HIT}" height="${HIT}"/>
        <rect x="${-SQ/2}" y="${-SQ/2}" width="${SQ}" height="${SQ}" fill="${YELLOW}" stroke="#a56a00" stroke-width="0.5" rx="1" ry="1" transform="rotate(45)"/>
    </g>
`;

const ARROW_WIDTH_HANDLE_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="ew-resize">
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
        // Cursor reflects the visual drag direction: vertical drag in the
        // unrotated frame becomes horizontal once the arrow is on its side.
        const rot = (this.relatedView?.model.get('labelRotation') as number) || 0;
        const handle = this.el?.querySelector('g[joint-selector="handle"]') as SVGGElement | null;
        if (handle) handle.setAttribute('cursor', rot === 270 ? 'ew-resize' : 'ns-resize');
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
        // Snap the bar thickness to whole pixels (each side is dist, total = 2*dist).
        const distRaw = Math.max(0, Math.min(midY, midY - effectiveY));
        const totalPx = Math.round(distRaw * 2);
        const ratio = Math.max(0.1, Math.min(0.9, totalPx / height));
        view.model.set('barRatio', ratio);
        showDragTooltip(`${totalPx}px`);
    }
}

/**
 * Yellow diamond for the arrowhead width. Sits at horizontal mid on the
 * left arrowhead/bar boundary; dragging horizontally shrinks/grows BOTH
 * arrowheads symmetrically. Mirrors BarThicknessControl's rotation handling
 * so 270° elements behave correctly — the same swap we worked out for that
 * tool, just applied to the X-axis instead of the Y-axis.
 */
class ArrowWidthControl extends elementTools.Control {
    private _rotListener: (() => void) | null = null;

    preinitialize() {
        this.options.selector = 'base';
        this.children = ARROW_WIDTH_HANDLE_MARKUP;
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
        // Orthogonal to BarThicknessControl, so the cursors are swapped.
        const rot = (this.relatedView?.model.get('labelRotation') as number) || 0;
        const handle = this.el?.querySelector('g[joint-selector="handle"]') as SVGGElement | null;
        if (handle) handle.setAttribute('cursor', rot === 270 ? 'ns-resize' : 'ew-resize');
    }

    onRemove() {
        this._rotListener?.();
        this._rotListener = null;
    }

    protected getPosition(view: dia.ElementView): g.Point {
        const { width, height } = view.model.size();
        const aw = (view.model.get('arrowWidth') as number) ?? 0.2;
        const rot = (view.model.get('labelRotation') as number) || 0;
        if (rot === 270) {
            const cx = width / 2;
            const cy = height / 2;
            const tipX = width * aw;
            const dx = tipX - cx;
            const dy = 0 - cy; // top edge → -cy
            // Same rotation formula BarThicknessControl uses; local coords
            // that, after the element rotates 270°, end up at the visual
            // target (tipX, 0) i.e. top edge at the arrowhead-bar boundary.
            return new g.Point(cx + dy, cy - dx);
        }
        return new g.Point(width * aw, 0);
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point): void {
        const { width, height } = view.model.size();
        const rot = (view.model.get('labelRotation') as number) || 0;
        let effectiveX: number;
        if (rot === 270) {
            const cx = width / 2;
            const cy = height / 2;
            // Inverse of getPosition for the new top-edge anchor.
            effectiveX = cx + cy - coordinates.y;
        } else {
            effectiveX = coordinates.x;
        }
        // Snap arrowhead width to whole pixels.
        const tipPx = Math.max(Math.round(width * 0.05), Math.min(Math.round(width * 0.45), Math.round(effectiveX)));
        const ratio = tipPx / width;
        view.model.set('arrowWidth', ratio);
        showDragTooltip(`${tipPx}px`);
    }
}

@Model({
    attributes: {
        isArea: true,
        isDoubleArrow: true,
        z: -1,
        size: defaultSize,
        barRatio: 0.4,
        // Width of the arrowhead as a fraction of total length (per side).
        // 0.2 = each arrowhead occupies 20% of the shape's width.
        arrowWidth: 0.2,
        // Canonical style defaults so the inspector reads the same values
        // the SVG renders out-of-the-box. Without these, the inspector
        // would fall back to the Area defaults which don't match the
        // DoubleArrow's actual visuals.
        areaColor: '#525252',
        areaOpacity: 50,
        // Outline is off by default; the colour + thickness values are
        // kept so they're remembered when the user later enables an
        // outline style.
        outlineStyle: 'none',
        outlineColor: '#8d8d8d',
        outlineThickness: 2,
    },
    template: svg,
})
export class DoubleArrow extends NextrackIsometricShape {

    @Function()
    arrowPath(): string {
        const { width: w, height: h } = this.size();
        const ratio = (this.get('barRatio') as number) ?? 0.4;
        const aw = (this.get('arrowWidth') as number) ?? 0.2;
        const ax = w * aw;
        const bx = w * (1 - aw);
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
                new ArrowWidthControl(),
            ],
        });
        this.findView(paper).addTools(toolView);
    }

    // DoubleArrow IS connectable — it usually marks a flow / relation
    // between two things, so the hover-revealed port dots are useful.

    override toggleView(_view: View) {
        // same flat shape in both views
    }
}
