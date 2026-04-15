import { dia, linkTools, util } from '@joint/core';
import { BG_COLOR, GRID_SIZE, HIGHLIGHT_COLOR } from '../theme';

const SIZE = 6;
const CONNECT_TOOL_SIZE = 10;
const ARROWHEAD_TOOL_SIZE = 15;

// Carbon icon path data (viewBox 0 0 32 32) — embedded inline so the tool
// markup stays a single SVG fragment. See @carbon/icons/es/{connect,close}/16.
const CARBON_CONNECT_PATH = 'M23,16a7,7,0,0,0-4.18,1.39L14.6,13.17A6.86,6.86,0,0,0,16,9a7,7,0,1,0-2.81,5.59l4.21,4.22A7,7,0,1,0,23,16ZM4,9a5,5,0,1,1,5,5A5,5,0,0,1,4,9Z';
const CARBON_CLOSE_PATH   = 'M17.4141 16 24 9.4141 22.5859 8 16 14.5859 9.4143 8 8 9.4141 14.5859 16 8 22.5859 9.4143 24 16 17.4141 22.5859 24 24 22.5859 17.4141 16z';

export const ISOMETRIC_HEIGHT_TOOL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" fill="${HIGHLIGHT_COLOR}">
        <circle cursor="ns-resize" stroke="none" fill="#33334F" fill-opacity="0.3" r="${SIZE / 2}"/>
        <circle cursor="ns-resize" stroke="${BG_COLOR}" cx="-3" cy="-3" r="${SIZE / 2}"/>
    </g>
    <rect @selector="extras" pointer-events="none" fill="none" stroke="${HIGHLIGHT_COLOR}" stroke-dasharray="1,1" rx="1" ry="1"/>
`;

export const SIZE_TOOL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="nwse-resize" >
        <rect stroke="none" fill="transparent" width="${SIZE}" height="${SIZE}"/>
        <path d="M 0 5 5 5 5 0" fill="${HIGHLIGHT_COLOR}" stroke="none" />
    </g>
    <rect @selector="extras" pointer-events="none" fill="none" stroke="${HIGHLIGHT_COLOR}" stroke-dasharray="1,1" rx="1" ry="1"/>
`;

// Icon is scaled from Carbon's 32×32 viewBox to the CONNECT_TOOL_SIZE button.
// scale = CONNECT_TOOL_SIZE / 32 = 10/32 = 0.3125
export const CONNECT_TOOL_MARKUP = util.svg`
    <rect @selector="button" fill="${HIGHLIGHT_COLOR}" cursor="pointer" width="${CONNECT_TOOL_SIZE}" height="${CONNECT_TOOL_SIZE}"/>
    <g @selector="icon" pointer-events="none" transform="scale(${CONNECT_TOOL_SIZE / 32})">
        <path d="${CARBON_CONNECT_PATH}" fill="#FFFFFF" stroke="none"/>
    </g>
`;

export const CONNECT_TOOL_PRESET = {
    magnet: 'base',
    useModelGeometry: true,
    x: '100%',
    y: -CONNECT_TOOL_SIZE,
    markup: CONNECT_TOOL_MARKUP
}

export class TargetArrowHeadTool extends linkTools.TargetArrowhead {
    constructor() {
        super({
            tagName: 'rect',
            attributes: {
                'width': ARROWHEAD_TOOL_SIZE,
                'height': ARROWHEAD_TOOL_SIZE,
                'x': -ARROWHEAD_TOOL_SIZE / 2,
                'y': -ARROWHEAD_TOOL_SIZE / 2,
                'fill': HIGHLIGHT_COLOR,
                'stroke': HIGHLIGHT_COLOR,
                'fill-opacity': 0.2,
                'stroke-width': 2,
                'stroke-dasharray': '4,2',
                'cursor': 'move',
                'class': 'target-arrowhead',
            }
        });
    }
}

export class RemoveTool extends linkTools.Remove {
    constructor() {
        // Circle button radius is 7 (diameter 14). Carbon close is 32×32 viewBox
        // and should occupy ~10px inside the button → scale = 10/32 = 0.3125,
        // then translate by -5,-5 to centre it on the circle's (0,0) origin.
        const iconScale  = 10 / 32;
        const iconOffset = -5;
        super({
            distance: - 2.5 * GRID_SIZE,
            markup: util.svg`
                <circle @selector="button" r="7" fill="${HIGHLIGHT_COLOR}" stroke="${BG_COLOR}" cursor="pointer"/>
                <g @selector="icon" pointer-events="none" transform="translate(${iconOffset},${iconOffset}) scale(${iconScale})">
                    <path d="${CARBON_CLOSE_PATH}" fill="#FFFFFF" stroke="none"/>
                </g>
            `
        })
    }
}
