import IsometricShape from './isometric-shape';
import { Computer, Database, Firewall, Switch, Router, KubernetesWorkerNode } from './index';
import { Pyramid } from './pyramid/pyramid';
import { Hexagonal } from './hexagonal/hexagonal';
import { Octagon } from './octagon/octagon';

/** Maps built-in shape ids to their native JointJS class factory. */
export const SHAPE_FACTORIES: Record<string, () => IsometricShape> = {
    'firewall':               () => new Firewall(),
    'switch':                 () => new Switch(),
    'router':                 () => new Router(),
    'computer':               () => new Computer(),
    'database':               () => new Database(),
    'kubernetes-worker-node': () => new KubernetesWorkerNode(),
};

/** Maps built-in shape ids to their default form factor. */
export const BASE_SHAPE_BY_ID: Record<string, string> = {
    'firewall':               'cuboid',
    'switch':                 'cuboid',
    'router':                 'cylinder',
    'computer':               'cuboid',
    'database':               'cylinder',
    'kubernetes-worker-node': 'octagon',
};

/** Maps form factor names to representative preview factories. */
export const FORM_FACTOR_PREVIEWS: Record<string, () => IsometricShape> = {
    'cuboid':    () => new Computer(),
    'cylinder':  () => new Database(),
    'pyramid':   () => new Pyramid(),
    'hexagonal': () => new Hexagonal(),
    'octagon':   () => new Octagon(),
};

/**
 * Returns the right factory for a given shape id and base shape.
 * Uses the native class when the form factor matches the default,
 * otherwise falls back to the representative preview shape.
 */
export function getPreviewFactory(shapeId: string, baseShape: string): () => IsometricShape {
    if (baseShape === (BASE_SHAPE_BY_ID[shapeId] ?? 'cuboid')) {
        return SHAPE_FACTORIES[shapeId] ?? FORM_FACTOR_PREVIEWS[baseShape];
    }
    return FORM_FACTOR_PREVIEWS[baseShape] ?? SHAPE_FACTORIES[shapeId];
}
