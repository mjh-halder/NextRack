import { dia, elementTools, g, util } from '@joint/core';
import { GRID_SIZE, HIGHLIGHT_COLOR } from '../theme';

const S = 8;    // visual L-handle size
const H = 12;   // transparent hit-area half-size
const MIN_SIZE = GRID_SIZE * 2;

type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

// Each markup draws an L-shape that points inward toward the element centre,
// with a transparent hit area sized for comfortable interaction.

const BR_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="nwse-resize">
        <rect stroke="none" fill="transparent" width="${H}" height="${H}"/>
        <path d="M 0 ${S} ${S} ${S} ${S} 0" fill="${HIGHLIGHT_COLOR}" stroke="none"/>
    </g>
    <rect @selector="extras" pointer-events="none" fill="none" stroke="${HIGHLIGHT_COLOR}" stroke-dasharray="1,1" rx="1" ry="1"/>
`;

const BL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="nesw-resize">
        <rect stroke="none" fill="transparent" width="${H}" height="${H}" x="${-H}"/>
        <path d="M 0 ${S} ${-S} ${S} ${-S} 0" fill="${HIGHLIGHT_COLOR}" stroke="none"/>
    </g>
    <rect @selector="extras" pointer-events="none" fill="none" stroke="${HIGHLIGHT_COLOR}" stroke-dasharray="1,1" rx="1" ry="1"/>
`;

const TR_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="nesw-resize">
        <rect stroke="none" fill="transparent" width="${H}" height="${H}" y="${-H}"/>
        <path d="M 0 ${-S} ${S} ${-S} ${S} 0" fill="${HIGHLIGHT_COLOR}" stroke="none"/>
    </g>
    <rect @selector="extras" pointer-events="none" fill="none" stroke="${HIGHLIGHT_COLOR}" stroke-dasharray="1,1" rx="1" ry="1"/>
`;

const TL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="nwse-resize">
        <rect stroke="none" fill="transparent" width="${H}" height="${H}" x="${-H}" y="${-H}"/>
        <path d="M 0 ${-S} ${-S} ${-S} ${-S} 0" fill="${HIGHLIGHT_COLOR}" stroke="none"/>
    </g>
    <rect @selector="extras" pointer-events="none" fill="none" stroke="${HIGHLIGHT_COLOR}" stroke-dasharray="1,1" rx="1" ry="1"/>
`;

/**
 * Resize handle for Frame zones. Instantiate one per corner and pass the
 * `corner` option. Each instance places its handle at the correct corner and
 * applies the appropriate resize math (moving position + size together so the
 * opposite corner stays fixed).
 */
export class FrameCornerControl extends elementTools.Control {

    static getSiblingZones: ((primary: dia.Element) => dia.Element[]) | null = null;

    private siblingStart: Map<string, { x: number; y: number; w: number; h: number }> = new Map();
    private primaryStart: { w: number; h: number } | null = null;

    preinitialize() {
        this.options.selector = 'body';
        const corner: Corner = this.options.corner ?? 'bottom-right';
        switch (corner) {
            case 'bottom-right': this.children = BR_MARKUP; break;
            case 'bottom-left':  this.children = BL_MARKUP; break;
            case 'top-right':    this.children = TR_MARKUP; break;
            case 'top-left':     this.children = TL_MARKUP; break;
        }
    }

    protected getPosition(view: dia.ElementView): g.Point {
        const { width, height } = view.model.size();
        const corner: Corner = this.options.corner ?? 'bottom-right';
        switch (corner) {
            case 'bottom-right': return new g.Point(width,  height);
            case 'bottom-left':  return new g.Point(0,      height);
            case 'top-right':    return new g.Point(width,  0);
            case 'top-left':     return new g.Point(0,      0);
        }
    }

    protected setPosition(view: dia.ElementView, coordinates: dia.Point): void {
        const model = view.model;
        const corner: Corner = this.options.corner ?? 'bottom-right';

        if (!this.primaryStart) {
            const { width, height } = model.size();
            this.primaryStart = { w: width, h: height };
            this.siblingStart.clear();
            const siblings = FrameCornerControl.getSiblingZones?.(model) ?? [];
            for (const sib of siblings) {
                const s = sib.size();
                const p = sib.position();
                this.siblingStart.set(String(sib.id), { x: p.x, y: p.y, w: s.width, h: s.height });
            }
        }

        const { width, height } = model.size();
        const { x: elX, y: elY } = model.position();

        let newW: number, newH: number, newX: number, newY: number;

        switch (corner) {
            case 'bottom-right': {
                const dx = Math.round((coordinates.x - width)  / GRID_SIZE);
                const dy = Math.round((coordinates.y - height) / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  + dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height + dy * GRID_SIZE);
                newX = elX;
                newY = elY;
                break;
            }
            case 'bottom-left': {
                const dx = Math.round(coordinates.x / GRID_SIZE);
                const dy = Math.round((coordinates.y - height) / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  - dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height + dy * GRID_SIZE);
                newX = elX + (width - newW);
                newY = elY;
                break;
            }
            case 'top-right': {
                const dx = Math.round((coordinates.x - width) / GRID_SIZE);
                const dy = Math.round(coordinates.y / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  + dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height - dy * GRID_SIZE);
                newX = elX;
                newY = elY + (height - newH);
                break;
            }
            case 'top-left': {
                const dx = Math.round(coordinates.x / GRID_SIZE);
                const dy = Math.round(coordinates.y / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  - dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height - dy * GRID_SIZE);
                newX = elX + (width  - newW);
                newY = elY + (height - newH);
                break;
            }
        }

        model.set({
            position: { x: newX, y: newY },
            size: { width: newW, height: newH },
        });

        const dw = newW - this.primaryStart.w;
        const dh = newH - this.primaryStart.h;
        this.siblingStart.forEach((start, id) => {
            const sib = model.graph?.getCell(id) as dia.Element | undefined;
            if (!sib) return;
            const sibW = Math.max(MIN_SIZE, start.w + dw);
            const sibH = Math.max(MIN_SIZE, start.h + dh);
            let sibX = start.x;
            let sibY = start.y;
            if (corner === 'bottom-left' || corner === 'top-left') {
                sibX = start.x + (start.w - sibW);
            }
            if (corner === 'top-right' || corner === 'top-left') {
                sibY = start.y + (start.h - sibH);
            }
            sib.set({
                position: { x: sibX, y: sibY },
                size: { width: sibW, height: sibH },
            });
        });
    }

    protected resetPosition() {
        this.primaryStart = null;
        this.siblingStart.clear();
    }
}
