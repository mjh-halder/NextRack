import { V, dia } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { GRID_COUNT, GRID_SIZE, SCALE, ISOMETRIC_SCALE, ROTATION_DEGREES } from './theme';
import { Link } from './shapes';
import type { ShapeStyle, ShapeDefinition, ShapeLayer } from './shapes/shape-registry';
import { SvgPolygonShape } from './shapes/svgpolygon/svg-polygon-shape';
import { FORM_FACTOR_PREVIEWS } from './shapes/shape-factories';

export const transformationMatrix = (view: View = View.Isometric, margin: number = 20, leftInset: number = 0, gridCount: number = GRID_COUNT) => {
    let matrix = V.createSVGMatrix().translate(margin + leftInset, margin);
    if (view === View.Isometric) {
        matrix = matrix
            .translate(gridCount * GRID_SIZE * SCALE * ISOMETRIC_SCALE, 0)
            .rotate(ROTATION_DEGREES)
            .skewX(-ROTATION_DEGREES)
            .scaleNonUniform(SCALE, SCALE * ISOMETRIC_SCALE);
    } else {
        matrix = matrix
            .scale(SCALE, SCALE);
    }
    return matrix;
}

export interface Node {
    el: dia.Element,
    behind: Node[],
    visited: boolean,
    depth?: number
}

const topologicalSort = (nodes: Node[]) => {
    let depth = 0;

    const visitNode = (node: Node) => {
        if (!node.visited) {
            node.visited = true;

            for (let i = 0; i < node.behind.length; ++i) {
                if (node.behind[i] == null) {
                    break;
                }
                else {
                    visitNode(node.behind[i]);
                    delete node.behind[i];
                }
            }

            node.depth = depth++;
            node.el.set('z', node.depth);
        }
    }

    for (let i = 0; i < nodes.length; ++i)
    {
        visitNode(nodes[i]);
    }
}

export const sortElements = (graph) => {
    const elements = graph.getElements();
    // Frames always stay at z = -1 (behind everything); exclude them from the
    // isometric topological sort so their z is never overwritten.
    //
    // Complex-component child layers overlap each other fully (same footprint),
    // which creates mutual "behind" edges the DFS then breaks arbitrarily —
    // producing Z-order flicker on every drag step. We exclude them from the
    // sort and re-anchor their z to the base's below so within-component paint
    // order is decided by DOM (= creation) order instead.
    const nodes: Node[] = elements
        .filter(el => !el.get('isFrame') && el.get('componentRole') !== 'child')
        .map(el => ({
            el: el,
            behind: [],
            visited: false
        }));

    for (let i = 0; i < nodes.length; ++i)
    {
        const a = nodes[i].el;
        const aBBox = a.getBBox();
        const aMax = aBBox.bottomRight();

        for (let j = 0; j < nodes.length; ++j)
        {
            if (i != j)
            {
                const b = nodes[j].el;
                const bBBox = b.getBBox();
                const bMin = bBBox.topLeft();

                if (bMin.x < aMax.x && bMin.y < aMax.y)
                {
                    nodes[i].behind.push(nodes[j]);
                }
            }
        }
    }

    topologicalSort(nodes);

    // Anchor each component's child layers to the base's z. Same-z siblings
    // paint in DOM order — Layer 0 was the last added to the graph so it stays
    // on top; layers N..1 below it keep their creation order underneath.
    for (const el of elements) {
        if (el.get('componentRole') !== 'child') continue;
        const parent = el.getParentCell();
        if (parent && !parent.isLink() && (parent as dia.Element).get('componentRole') === 'base') {
            el.set('z', parent.get('z'));
        }
    }

    return nodes;
}

export const drawGrid = (paper: dia.Paper, sizeX: number, step: number, color = '#e8e8e8', sizeY = sizeX) => {
    const gridData = [];
    for (let i = 0; i <= sizeY; i++) {
        gridData.push(`M 0,${i * step} ${sizeX * step},${i * step}`);
    }
    for (let i = 0; i <= sizeX; i++) {
        gridData.push(`M ${i * step},0 ${i * step},${sizeY * step}`);
    }
    const gridVEl = V('path').attr({
        'd': gridData.join(' '),
        'fill': 'none',
        'stroke': color,
        'class': 'nr-grid-lines'
    });
    gridVEl.appendTo(paper.getLayerNode(dia.Paper.Layers.BACK));
    return gridVEl;
}

/**
 * Moves the DOM element matching `selector` to be the last child of `viewEl`
 * so it is painted above all other elements in the same cell view.
 * JointJS attr() only touches attributes, not DOM order, so icon elements
 * can fall behind face paths after incremental updates. One call per shape
 * after attr() is enough — it survives further attr()-only updates.
 */
export function raiseToFront(viewEl: Element, selector: string): void {
    const el = viewEl.querySelector(`[joint-selector="${selector}"]`);
    if (el && el !== viewEl.lastElementChild) {
        viewEl.appendChild(el);
    }
}

/**
 * Applies saved color overrides from the ShapeRegistry to a placed shape instance.
 * Only non-empty values are written; missing fields leave the SVG defaults intact.
 *
 * Selector-to-face mapping for cuboid-family shapes:
 *   top      → top face
 *   front    → front face (V2→V3)
 *   side     → right side face (V1→V2)
 *   cornerV1 → side-family corner at V1
 *   cornerV2 → side-family corner at V2
 *   cornerV3 → front-family corner at V3
 *
 * JointJS silently ignores attrs on selectors that don't exist in the shape markup,
 * so this is safe to call on any IsometricShape subclass.
 */
export function applyShapeStyle(shape: dia.Element, style: ShapeStyle): void {
    // Use the two-argument string form for every attr so JointJS parses '/' as
    // a path separator. The object form attr({key: val}) does a plain merge and
    // does NOT split '/' — literal key 'top/fill' would match no element.
    if (style.topColor) {
        shape.attr('top/fill', style.topColor);
    }
    if (style.frontColor) {
        shape.attr('front/fill',    style.frontColor);
        shape.attr('base/fill',     style.frontColor);
        shape.attr('cornerV3/fill', style.frontColor);
    }
    if (style.sideColor) {
        shape.attr('side/fill',    style.sideColor);
        shape.attr('cornerV1/fill', style.sideColor);
        shape.attr('cornerV2/fill', style.sideColor);
    }
    if (style.strokeColor) {
        for (const sel of ['top', 'front', 'side', 'base', 'cornerV1', 'cornerV2', 'cornerV3']) {
            shape.attr(`${sel}/stroke`, style.strokeColor);
        }
    }
}

/**
 * Applies all registry defaults to a shape instance — the single function
 * that makes the ShapeRegistry the authoritative source of truth.
 *
 * Called in two contexts:
 *   1. On placement (palette drop): paper is undefined; raiseToFront is skipped.
 *   2. On registry update (nextrack:registry-changed): paper is provided so
 *      icon DOM order is corrected after the attr() update.
 *
 * What is applied:
 *   - defaultSize       → shape.resize()
 *   - defaultIsometricHeight → shape.set('isometricHeight')
 *   - displayName       → label/text attr
 *   - style             → face fill/stroke attrs via applyShapeStyle()
 *   - iconHref + geometry → topIcon / topIcon2D image attrs
 *
 * What is intentionally NOT applied:
 *   - baseShape: changing the geometry class requires recreating the shape.
 *   - meta (name, kind, vendor …): instance-level data, set separately.
 */
export function applyRegistryDefaults(
    shape: dia.Element,
    defaults: ShapeDefinition,
    paper?: dia.Paper
): void {
    // ── Dimensions ───────────────────────────────────────────────────────────
    if (defaults.defaultSize) {
        shape.resize(defaults.defaultSize.width, defaults.defaultSize.height);
    }
    if (defaults.defaultIsometricHeight != null) {
        shape.set('isometricHeight', defaults.defaultIsometricHeight);
    }
    if (defaults.cornerRadius != null) {
        shape.set('cornerRadius', defaults.cornerRadius);
    }
    if (defaults.chamferSize != null) {
        shape.set('chamferSize', defaults.chamferSize);
    }

    // ── Label ────────────────────────────────────────────────────────────────
    // Do not overwrite a user-set name with the registry default.
    if (defaults.displayName && !(shape.get('meta') as { name?: string } | undefined)?.name?.trim()) {
        shape.attr('label/text', defaults.displayName);
    }

    // ── Colors ───────────────────────────────────────────────────────────────
    if (defaults.style) {
        applyShapeStyle(shape, defaults.style);
    }

    // ── Icon ─────────────────────────────────────────────────────────────────
    if (defaults.iconHref) {
        const iconPx = (defaults.iconSize ?? 1) * GRID_SIZE;
        const w = defaults.defaultSize?.width  ?? GRID_SIZE;
        const h = defaults.defaultSize?.height ?? GRID_SIZE;
        const iH = defaults.defaultIsometricHeight ?? 0;
        const x2D = (w - iconPx) / 2;
        const y2D = (h - iconPx) / 2;

        let topIconAttrs: Record<string, unknown>;
        if (defaults.iconFace === 'front') {
            const localX = (w - iconPx) / 2;
            const localY = (iH - iconPx) / 2;
            // Counter-rotate the icon content so it reads right-side up on
            // the front face — the projection matrix below flips the y-axis.
            const cx = localX + iconPx / 2;
            const cy = localY + iconPx / 2;
            topIconAttrs = {
                href:      defaults.iconHref,
                x:         localX,
                y:         localY,
                width:     iconPx,
                height:    iconPx,
                transform: `matrix(1,0,-1,-1,0,${h}) rotate(180,${cx},${cy})`,
            };
        } else {
            topIconAttrs = {
                href:      defaults.iconHref,
                x:         -iH + (w - iconPx) / 2,
                y:         -iH + (h - iconPx) / 2,
                width:     iconPx,
                height:    iconPx,
                transform: null,
            };
        }

        shape.attr({
            topIcon:   topIconAttrs,
            topIcon2D: { href: defaults.iconHref, x: x2D, y: y2D, width: iconPx, height: iconPx },
        });

        if (paper) {
            const view = paper.findViewByModel(shape);
            if (view) {
                raiseToFront(view.el, 'topIcon');
                raiseToFront(view.el, 'topIcon2D');
            }
        }
    } else {
        // Explicitly clear the icon when registry has none saved.
        shape.attr({
            topIcon:   { href: '', width: 0, height: 0 },
            topIcon2D: { href: '', width: 0, height: 0 },
        });
    }
}

/**
 * Build the shape stack for a complex component.
 * Each ShapeLayer becomes its own IsometricShape, positioned relative to (baseX, baseY)
 * which is the top-left of Layer 0. Returns shapes in layer order (index 0 = base).
 * Geometry, dimensions, style, and positioning are applied; label/icon/meta are left
 * for the caller so it can apply them to Layer 0 only.
 */
export function createComplexLayers(
    layers: ShapeLayer[],
    baseX: number,
    baseY: number,
    view: View
): IsometricShape[] {
    if (layers.length === 0) return [];
    const baseLayer = layers[0];
    const bx = baseX + baseLayer.width  / 2;
    const by = baseY + baseLayer.height / 2;

    const shapes: IsometricShape[] = [];
    for (const layer of layers) {
        const isSvg = !!(layer.svgNormVerts && layer.svgNormVerts.length >= 3);
        const shape: IsometricShape = isSvg
            ? new SvgPolygonShape()
            : (FORM_FACTOR_PREVIEWS[layer.baseShape] ?? FORM_FACTOR_PREVIEWS['cuboid'])();
        if (isSvg && layer.svgNormVerts) {
            (shape as SvgPolygonShape).set('normalizedVerts', layer.svgNormVerts);
        }
        shape.resize(layer.width, layer.height);
        shape.set('isometricHeight',        layer.depth);
        shape.set('defaultIsometricHeight', layer.depth);
        shape.set('defaultSize',            { width: layer.width, height: layer.height });
        if (layer.cornerRadius !== undefined) shape.set('cornerRadius', layer.cornerRadius);
        if (layer.chamferSize !== undefined) shape.set('chamferSize', layer.chamferSize);

        const elev = view === View.Isometric ? layer.baseElevation : 0;
        shape.position(
            bx - layer.width  / 2 + layer.offsetX - elev,
            by - layer.height / 2 + layer.offsetY - elev
        );
        shape.toggleView(view);

        if (layer.style.topColor || layer.style.frontColor || layer.style.sideColor || layer.style.strokeColor) {
            applyShapeStyle(shape, layer.style);
        }
        shapes.push(shape);
    }
    return shapes;
}

export const switchView = (paper: dia.Paper, view: View, selectedCell: IsometricShape | Link, leftInset: number = 0, gridCount: number = GRID_COUNT) => {
    paper.model.getElements().forEach((element: IsometricShape) => {
        element.toggleView(view);
    });
    if (view === View.Isometric) {
        sortElements(paper.model);
    }
    paper.matrix(transformationMatrix(view, 20, leftInset, gridCount));
    if (selectedCell) {
        selectedCell.addTools(paper, view);
    }
}
