/*
 * NextRack tool styling layer. Extracted per ADR-0006 Tier 2 so
 * src/tools/tools.ts stays byte-equivalent to the upstream demo and
 * carries no NextRack code.
 *
 * Provides:
 *   - Carbon icon path constants used in the NextRack markups
 *   - NextRack-styled SVG markups (square + per-axis size handles,
 *     isometric-height drag handle, connect-tool button) that replace
 *     the simpler upstream markups
 *   - NEXTRACK_CONNECT_TOOL_PRESET (mirrors CONNECT_TOOL_PRESET but
 *     references the NextRack connect markup)
 *   - NextrackCenterBasedHeightControl, NextrackProportionalSizeControl —
 *     subclasses of the upstream tool classes that override only
 *     `this.children` to point at the NextRack markups
 */

import { dia, util } from '@joint/core';
import { BG_COLOR } from '../theme';
import { HIGHLIGHT_COLOR } from '../nextrack-theme';
import { CenterBasedHeightControl } from './center-based-height-tool';
import { ProportionalSizeControl } from './proportional-size-tool';

// ── Carbon icon path data ───────────────────────────────────────────────────
// (viewBox 0 0 32 32; embedded inline so each markup stays a single SVG
// fragment without external <use href>)
const CARBON_NEXT_FILLED_PATH = 'M2,16A14,14,0,1,0,16,2,14,14,0,0,0,2,16Zm6-1H20.15L14.57,9.3926,16,8l8,8-8,8-1.43-1.4272L20.15,17H8Z';
const CARBON_ARROW_DOWN_RIGHT = 'M10 26 10 24 22.59 24 6 7.41 7.41 6 24 22.59 24 10 26 10 26 26 10 26z';
const CARBON_CARET_DOWN = 'M24 12 16 22 8 12z';

const SIZE = 6;
const CONNECT_TOOL_SIZE = 10;
const INTERACTIVE_BLUE = '#0f62fe';

// ── Size handles (square arrow + per-axis carets) ───────────────────────────

const SIZE_ICON_PX = 14;
const SIZE_ICON_HALF = SIZE_ICON_PX / 2;
const SIZE_ICON_SCALE = SIZE_ICON_PX / 32;

const CARET_PX = 23;
const CARET_HALF = CARET_PX / 2;
const CARET_SCALE = CARET_PX / 32;

export const NEXTRACK_SIZE_TOOL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="nwse-resize" opacity="0">
        <circle stroke="none" fill="transparent" r="${SIZE_ICON_HALF + 4}"/>
        <g pointer-events="none" transform="translate(${-SIZE_ICON_HALF},${-SIZE_ICON_HALF}) scale(${SIZE_ICON_SCALE})">
            <path d="${CARBON_ARROW_DOWN_RIGHT}" fill="${INTERACTIVE_BLUE}" stroke="none"/>
        </g>
    </g>
`;

export const NEXTRACK_SIZE_TOOL_VERTICAL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="ns-resize" opacity="0">
        <circle stroke="none" fill="transparent" r="${CARET_HALF + 4}"/>
        <g pointer-events="none" transform="translate(${-CARET_HALF},${-CARET_HALF}) scale(${CARET_SCALE})">
            <path d="${CARBON_CARET_DOWN}" fill="${INTERACTIVE_BLUE}" stroke="none"/>
        </g>
    </g>
`;

export const NEXTRACK_SIZE_TOOL_HORIZONTAL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" cursor="ew-resize" opacity="0">
        <circle stroke="none" fill="transparent" r="${CARET_HALF + 4}"/>
        <g pointer-events="none" transform="translate(${-CARET_HALF},${-CARET_HALF}) scale(${CARET_SCALE}) rotate(-90, 16, 16)">
            <path d="${CARBON_CARET_DOWN}" fill="${INTERACTIVE_BLUE}" stroke="none"/>
        </g>
    </g>
`;

// ── Isometric-height drag handle ────────────────────────────────────────────

export const NEXTRACK_ISOMETRIC_HEIGHT_TOOL_MARKUP: dia.MarkupJSON = util.svg`
    <g @selector="handle" fill="${HIGHLIGHT_COLOR}">
        <circle cursor="ns-resize" stroke="none" fill="#33334F" fill-opacity="0.3" r="${SIZE / 2}"/>
        <circle cursor="ns-resize" stroke="${BG_COLOR}" cx="-3" cy="-3" r="${SIZE / 2}"/>
    </g>
`;

// ── Connect tool — Next-Filled Carbon icon, no background ───────────────────

const CONNECT_ICON_PX = 16;
const CONNECT_ICON_HALF = CONNECT_ICON_PX / 2;
const CONNECT_ICON_SCALE = CONNECT_ICON_PX / 32;

export const NEXTRACK_CONNECT_TOOL_MARKUP = util.svg`
    <circle @selector="button" r="${CONNECT_ICON_HALF}" fill="${BG_COLOR}" cursor="pointer"/>
    <g @selector="icon" pointer-events="none" transform="rotate(-90) translate(${-CONNECT_ICON_HALF},${-CONNECT_ICON_HALF}) scale(${CONNECT_ICON_SCALE})">
        <path d="${CARBON_NEXT_FILLED_PATH}" fill="${HIGHLIGHT_COLOR}" stroke="none"/>
    </g>
`;

export const NEXTRACK_CONNECT_TOOL_PRESET = {
    magnet: 'base',
    useModelGeometry: true,
    x: '100%',
    y: -CONNECT_TOOL_SIZE,
    markup: NEXTRACK_CONNECT_TOOL_MARKUP,
};

// ── Subclasses that override only the markup used by the upstream tool ──────

export class NextrackCenterBasedHeightControl extends CenterBasedHeightControl {
    preinitialize() {
        super.preinitialize();
        this.children = NEXTRACK_ISOMETRIC_HEIGHT_TOOL_MARKUP;
    }
}

export class NextrackProportionalSizeControl extends ProportionalSizeControl {
    preinitialize() {
        super.preinitialize();
        this.children = NEXTRACK_SIZE_TOOL_MARKUP;
    }
}
