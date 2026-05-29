/*
 * NextRack theme constants. Layered on top of the upstream theme.ts (which
 * is kept byte-equivalent to the original demo per ADR-0006 Tier 1).
 *
 * Re-exports the upstream constants we still use unchanged (GRID_SIZE,
 * BG_COLOR, SCALE, ISOMETRIC_SCALE, ROTATION_DEGREES), overrides the two
 * that NextRack tunes (GRID_COUNT, HIGHLIGHT_COLOR), and adds NextRack's
 * own constants (SHAPE_CELL_SIZE, MIN_ZOOM, MAX_ZOOM).
 *
 * NextRack code should import theme constants from here. The upstream
 * theme.ts is read only by the few MPL-inherited files that still use it
 * (utils.ts, etc.) — they see the upstream values, which is correct for
 * default-parameter purposes.
 */

export { GRID_SIZE, BG_COLOR, SCALE, ISOMETRIC_SCALE, ROTATION_DEGREES } from './theme';

import { GRID_SIZE } from './theme';

// Override: NextRack canvas is 100×100 grid units (upstream demo had 25).
export const GRID_COUNT = 100;

// Override: $support-caution-major — used for all dynamic editing tools
// (selection borders, zone resize handles, connect-tool icon).
export const HIGHLIGHT_COLOR = '#ff832b';

// Edge length of a single shape cell — two grid units. The 2D icon-only
// view collapses every shape to this footprint.
export const SHAPE_CELL_SIZE = GRID_SIZE * 2;

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 3;
