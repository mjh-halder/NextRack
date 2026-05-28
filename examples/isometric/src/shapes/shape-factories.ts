import IsometricShape from './isometric-shape';
import { Rectangle, Circle } from './index';
import { Octagon } from './octagon/octagon';
import { Tube } from './tube/tube';
import { Pipe } from './pipe/pipe';
import { Duct } from './duct/duct';
import { Channel } from './channel/channel';
import { SvgPolygonShape } from './svgpolygon/svg-polygon-shape';

const DEFAULT_CUSTOM_VERTS: [number, number][] = [
    [0, 0], [1, 0], [1, 1], [0, 1],
];

/** Maps built-in shape ids to their native JointJS class factory. */
export const SHAPE_FACTORIES: Record<string, () => IsometricShape> = {
    'rectangle':   () => new Rectangle(),
    'circle': () => new Circle(),
};

/** Maps built-in shape ids to their default form factor. */
export const BASE_SHAPE_BY_ID: Record<string, string> = {
    'rectangle':   'rectangle',
    'circle': 'circle',
};

/** Maps form factor names to representative preview factories. Includes
 *  the legacy aliases `hexahedron` (→ rectangle) and `svgPolygon` (→ custom)
 *  so old saved Shapes with those base-shape values still resolve. */
export const FORM_FACTOR_PREVIEWS: Record<string, () => IsometricShape> = {
    'rectangle':  () => new Rectangle(),
    'circle':     () => new Circle(),
    'tube':       () => new Tube(),
    'pipe':       () => new Pipe(),
    'duct':       () => new Duct(),
    'channel':    () => new Channel(),
    'octagon':    () => new Octagon(),
    'custom':     () => { const s = new SvgPolygonShape(); s.set('normalizedVerts', DEFAULT_CUSTOM_VERTS); return s; },
    'hexahedron': () => new Rectangle(),
    'svgPolygon': () => { const s = new SvgPolygonShape(); s.set('normalizedVerts', DEFAULT_CUSTOM_VERTS); return s; },
};

/**
 * Returns the right factory for a given shape id and base shape.
 * Uses the native class when the form factor matches the default,
 * otherwise falls back to the representative preview shape. Final fallback
 * is the Rectangle preview so callers never receive undefined.
 */
export function getPreviewFactory(shapeId: string, baseShape: string): () => IsometricShape {
    if (baseShape === (BASE_SHAPE_BY_ID[shapeId] ?? 'rectangle')) {
        return SHAPE_FACTORIES[shapeId] ?? FORM_FACTOR_PREVIEWS[baseShape] ?? FORM_FACTOR_PREVIEWS.rectangle;
    }
    return FORM_FACTOR_PREVIEWS[baseShape] ?? SHAPE_FACTORIES[shapeId] ?? FORM_FACTOR_PREVIEWS.rectangle;
}
