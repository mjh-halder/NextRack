/**
 * Shape reader facade.
 *
 * Pure read-only queries over a ShapeDefinition. Centralizes every "look past
 * the schema" call so the rest of the codebase never reaches into
 * `def.layers[0]` directly. See CONTEXT.md (Hit Area, IconEntry) for the
 * domain rules these functions enforce.
 *
 * No side effects, no JointJS dependency — every function is a pure
 * transformation of its ShapeDefinition argument.
 */

import type { ShapeDefinition, ShapeLayer, IconEntry } from './shapes/shape-registry';

/**
 * The single IconEntry that represents this Shape in the palette tile and
 * the 2D view. Picks the IconEntry with `isMain === true` across all Layers.
 * Falls back to the first IconEntry found in Layer order if no entry is
 * marked. Returns `undefined` only if the Shape has no IconEntries at all.
 *
 * CONTEXT.md: `isMain` is per-Shape — at most one IconEntry in a Shape has
 * it. Authoring chokepoints enforce uniqueness.
 */
export function getPaletteIcon(def: ShapeDefinition): IconEntry | undefined {
    const layers = def.layers ?? [];
    let firstFound: IconEntry | undefined;
    for (const layer of layers) {
        for (const icon of layer.icons ?? []) {
            if (icon.isMain) return icon;
            if (!firstFound) firstFound = icon;
        }
    }
    return firstFound;
}

/** Hit Area dimensions snap up to this pixel step in both dimensions. */
export const HIT_AREA_STEP = 10;

/**
 * The Shape's floor footprint as `{ width, height }`. Used for placement
 * collision, snapping, and label anchoring in the System Designer.
 *
 * Rule (CONTEXT.md, Hit Area):
 *   1. Explicit `def.hitAreaSize` if set.
 *   2. Single-Layer Shape  → that Layer's `width × height`.
 *   3. Multi-Layer Shape   → bounding box of Layers with `baseElevation === 0`.
 *   4. All Layers floating → bounding box of all Layers (degenerate fallback).
 *
 * Returned dimensions are always rounded **up** to the next multiple of
 * `HIT_AREA_STEP` (10px) — applies to every case above, including explicit
 * `hitAreaSize`.
 *
 * The bbox is computed in shape-center coordinates: each Layer's center sits
 * at `(offsetX, offsetY)` and spans `±width/2` × `±height/2`.
 */
export function getHitArea(def: ShapeDefinition): { width: number; height: number } {
    if (def.hitAreaSize) return snap(def.hitAreaSize);

    const layers = def.layers ?? [];
    if (layers.length === 0) return { width: 0, height: 0 };
    if (layers.length === 1) {
        const only = layers[0];
        return snap({ width: only.width, height: only.height });
    }

    const floorLayers = layers.filter(l => l.baseElevation === 0);
    const considered = floorLayers.length > 0 ? floorLayers : layers;
    return snap(boundingBox(considered));
}

function snap(size: { width: number; height: number }): { width: number; height: number } {
    return {
        width:  Math.ceil(size.width  / HIT_AREA_STEP) * HIT_AREA_STEP,
        height: Math.ceil(size.height / HIT_AREA_STEP) * HIT_AREA_STEP,
    };
}

/**
 * Total isometric height of the Shape — the highest point reached by any
 * Layer, measured in iso units above the floor plane. For each Layer, its
 * top is at `baseElevation + depth`; the composite height is the max.
 *
 * Used at instance-spawn to set the placed cell's `isometricHeight` (drives
 * painter's-sort z-order) and `defaultIsometricHeight` (the height tool's
 * default value).
 */
export function getCompositeIsoHeight(def: ShapeDefinition): number {
    const layers = def.layers ?? [];
    let max = 0;
    for (const l of layers) {
        const top = (l.baseElevation ?? 0) + (l.depth ?? 0);
        if (top > max) max = top;
    }
    return max;
}

function boundingBox(layers: readonly ShapeLayer[]): { width: number; height: number } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const l of layers) {
        const left   = l.offsetX - l.width  / 2;
        const right  = l.offsetX + l.width  / 2;
        const top    = l.offsetY - l.height / 2;
        const bottom = l.offsetY + l.height / 2;
        if (left   < minX) minX = left;
        if (right  > maxX) maxX = right;
        if (top    < minY) minY = top;
        if (bottom > maxY) maxY = bottom;
    }
    return { width: maxX - minX, height: maxY - minY };
}
