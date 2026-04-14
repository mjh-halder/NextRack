import { dia, elementTools, g, util } from '@joint/core';
import { GRID_SIZE, HIGHLIGHT_COLOR } from '../theme';

const S = 5;    // visual L-handle size
const H = 8;    // transparent hit-area half-size
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
        const { width, height } = model.size();
        const { x: elX, y: elY } = model.position();
        const corner: Corner = this.options.corner ?? 'bottom-right';

        let newW: number, newH: number, newX: number, newY: number;

        switch (corner) {
            case 'bottom-right': {
                // Right and bottom edges move; top-left corner is fixed.
                const dx = Math.round((coordinates.x - width)  / GRID_SIZE);
                const dy = Math.round((coordinates.y - height) / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  + dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height + dy * GRID_SIZE);
                newX = elX;
                newY = elY;
                break;
            }
            case 'bottom-left': {
                // Left and bottom edges move; top-right corner is fixed.
                const dx = Math.round(coordinates.x / GRID_SIZE);
                const dy = Math.round((coordinates.y - height) / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  - dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height + dy * GRID_SIZE);
                newX = elX + (width - newW);   // shift so right edge stays put
                newY = elY;
                break;
            }
            case 'top-right': {
                // Right and top edges move; bottom-left corner is fixed.
                const dx = Math.round((coordinates.x - width) / GRID_SIZE);
                const dy = Math.round(coordinates.y / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  + dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height - dy * GRID_SIZE);
                newX = elX;
                newY = elY + (height - newH);  // shift so bottom edge stays put
                break;
            }
            case 'top-left': {
                // Left and top edges move; bottom-right corner is fixed.
                const dx = Math.round(coordinates.x / GRID_SIZE);
                const dy = Math.round(coordinates.y / GRID_SIZE);
                newW = Math.max(MIN_SIZE, width  - dx * GRID_SIZE);
                newH = Math.max(MIN_SIZE, height - dy * GRID_SIZE);
                newX = elX + (width  - newW);  // shift so right edge stays put
                newY = elY + (height - newH);  // shift so bottom edge stays put
                break;
            }
        }

        // Single atomic set to avoid two separate change events.
        model.set({
            position: { x: newX, y: newY },
            size: { width: newW, height: newH },
        });
    }
}
