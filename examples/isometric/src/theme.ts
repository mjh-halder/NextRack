export const GRID_SIZE = 20;
export const GRID_COUNT = 100;
/** Edge length of a single shape cell — two grid units. The 2D icon-only
 *  view collapses every shape to this footprint. */
export const SHAPE_CELL_SIZE = GRID_SIZE * 2;
// $support-caution-major — used for all dynamic editing tools (selection
// borders, zone resize handles, connect-tool icon).
export const HIGHLIGHT_COLOR = '#ff832b';
export const BG_COLOR = '#FFFFFF';
export const SCALE = 2;
export const ISOMETRIC_SCALE = 0.8602
export const ROTATION_DEGREES = 30;

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 3;
