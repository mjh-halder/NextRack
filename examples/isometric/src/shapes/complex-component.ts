/**
 * ComplexComponent — a single dia.Element that renders a multi-layer shape.
 *
 * The Shape Designer stores a complex shape as an array of ShapeLayer
 * definitions. In the System Designer we want the whole stack to behave as
 * ONE object: one cell, one bbox, one z-value, one drag target. This class
 * and its custom view make that happen.
 *
 * Geometry is derived at render time by reusing the existing IsometricShape
 * subclasses as off-graph proxies — their path-generator methods
 * (cuboidFrontPath, topHexPath, svgSideFacesPath, etc.) produce the exact
 * same SVG paths you see in the Shape Designer.
 *
 * Rendering is imperative: the view listens for layer/size/isometricHeight
 * changes and rebuilds the two layer groups (2D footprint group and iso face
 * group). Drag/translate is handled by JointJS as normal — the root <g>
 * transform is updated without touching the inner geometry.
 */

import { dia, elementTools } from '@joint/core';
import IsometricShape, {
    View,
    CuboidShape,
    CylinderShape,
    CONNECT_KEY,
} from './isometric-shape';
import { Computer } from './computer/computer';     // proxy for cuboid baseShape
import { Database } from './database/database';     // proxy for cylinder baseShape
import { Pyramid } from './pyramid/pyramid';
import { Octagon } from './octagon/octagon';
import { KubernetesWorkerNode } from './kubernetes-worker-node/kubernetes-worker-node';
import { SvgPolygonShape } from './svgpolygon/svg-polygon-shape';
import { ShapeLayer } from './shape-registry';
import { CONNECT_TOOL_PRESET } from '../tools';
import { GRID_SIZE } from '../theme';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Default palette (matches the SVG template defaults of existing shapes) ───

const STROKE     = '#333';
const FILL_TOP   = '#a8a8a8';
const FILL_SIDE  = '#c6c6c6';
const FILL_FRONT = '#e0e0e0';

function fillFor(style: ShapeLayer['style'], kind: 'top' | 'side' | 'front'): string {
    if (kind === 'top'   && style.topColor)   return style.topColor;
    if (kind === 'side'  && style.sideColor)  return style.sideColor;
    if (kind === 'front' && style.frontColor) return style.frontColor;
    return kind === 'top' ? FILL_TOP : kind === 'side' ? FILL_SIDE : FILL_FRONT;
}

function strokeFor(style: ShapeLayer['style']): string {
    return style.strokeColor || STROKE;
}

// ── Face descriptors ─────────────────────────────────────────────────────────

interface FaceDesc {
    element: 'path' | 'polygon' | 'ellipse';
    attrs: Record<string, string | number>;
}

/**
 * Build an off-graph proxy shape instance with the right dimensions/height so
 * we can call its geometry methods. Not added to any paper — used purely to
 * compute SVG path strings.
 */
function makeProxy(layer: ShapeLayer): IsometricShape {
    const isSvg = !!(layer.svgNormVerts && layer.svgNormVerts.length >= 3);
    let proxy: IsometricShape;
    if (isSvg) {
        proxy = new SvgPolygonShape();
        (proxy as SvgPolygonShape).set('normalizedVerts', layer.svgNormVerts!);
    } else {
        // Matches the mapping used by `createComplexLayers` for consistency.
        switch (layer.baseShape) {
            case 'cylinder':  proxy = new Database();       break;
            case 'pyramid':   proxy = new Pyramid();        break;
            case 'octagon':   proxy = new Octagon();        break;
            case 'hexahedron':
            case 'cuboid':
            default:          proxy = new Computer();       break;
        }
    }
    proxy.resize(layer.width, layer.height);
    proxy.set('isometricHeight', layer.depth);
    if (layer.cornerRadius !== undefined) proxy.set('cornerRadius', layer.cornerRadius);
    if (layer.chamferSize !== undefined) proxy.set('chamferSize', layer.chamferSize);
    return proxy;
}

/** All visible isometric faces for one layer, in painter's-algorithm order. */
function isoFacesForLayer(layer: ShapeLayer): FaceDesc[] {
    const proxy  = makeProxy(layer);
    const stroke = strokeFor(layer.style);
    const commonStroke = { stroke, 'stroke-linejoin': 'round' };

    if (proxy instanceof KubernetesWorkerNode) {
        return [
            { element: 'path',    attrs: { d: proxy.frontPath(),        fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path',    attrs: { d: proxy.sidePath(),         fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'polygon', attrs: { points: proxy.topOctagonPoints(), fill: fillFor(layer.style, 'top'), ...commonStroke } },
        ];
    }
    if (proxy instanceof SvgPolygonShape) {
        return [
            { element: 'path', attrs: { d: proxy.svgSideFacesPath(), fill: fillFor(layer.style, 'side'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.svgTopPath(),       fill: fillFor(layer.style, 'top'),  ...commonStroke } },
        ];
    }
    if (proxy instanceof Octagon) {
        return [
            { element: 'path', attrs: { d: proxy.frontLeftFacePath(),   fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.frontBottomFacePath(), fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.frontRightFacePath(),  fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.rightFacePath(),       fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cornerV6Path(), fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cornerV5Path(), fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cornerV4Path(), fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cornerV3Path(), fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cornerV2Path(), fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.topOctagonPath(), fill: fillFor(layer.style, 'top'), ...commonStroke } },
        ];
    }
    if (proxy instanceof Pyramid) {
        return [
            { element: 'polygon', attrs: { points: proxy.frontFacePoints(), fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'polygon', attrs: { points: proxy.sideFacePoints(),  fill: fillFor(layer.style, 'side'),  ...commonStroke } },
        ];
    }
    if (proxy instanceof CuboidShape) {
        return [
            { element: 'path', attrs: { d: proxy.baseCuboidPath(),     fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cuboidFrontPath(),    fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cuboidSidePath(),     fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cuboidCornerV1Path(), fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cuboidCornerV2Path(), fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.cuboidCornerV3Path(), fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.topCuboidPath(),      fill: fillFor(layer.style, 'top'),   ...commonStroke } },
        ];
    }
    if (proxy instanceof CylinderShape) {
        const { width: w, height: h } = proxy.size();
        const iH = proxy.isometricHeight;
        return [
            { element: 'ellipse', attrs: { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path',    attrs: { d: proxy.sideData, fill: fillFor(layer.style, 'side'), ...commonStroke } },
            { element: 'ellipse', attrs: { cx: w / 2 - iH, cy: h / 2 - iH, rx: w / 2, ry: h / 2, fill: fillFor(layer.style, 'top'), ...commonStroke } },
        ];
    }
    return [];
}

/** 2D footprint for one layer (used in the System Designer's 2D view). */
function twoDimFaceForLayer(layer: ShapeLayer): FaceDesc | null {
    const proxy  = makeProxy(layer);
    const stroke = strokeFor(layer.style);
    const common = { stroke, 'stroke-linejoin': 'round' };
    const fill   = fillFor(layer.style, 'front');

    if (proxy instanceof KubernetesWorkerNode) {
        return { element: 'polygon', attrs: { points: proxy.baseOctagonPoints(), fill, ...common } };
    }
    if (proxy instanceof CylinderShape) {
        const { width: w, height: h } = proxy.size();
        return { element: 'ellipse', attrs: { cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2, fill, ...common } };
    }
    if (proxy instanceof Pyramid) {
        return { element: 'polygon', attrs: { points: proxy.baseDiamondPoints(), fill, ...common } };
    }
    if (proxy instanceof SvgPolygonShape) {
        return { element: 'path', attrs: { d: proxy.svgBasePath(), fill, ...common } };
    }
    if (proxy instanceof Octagon) {
        return { element: 'path', attrs: { d: proxy.baseOctagonPath(), fill, ...common } };
    }
    if (proxy instanceof CuboidShape) {
        return { element: 'path', attrs: { d: proxy.baseCuboidPath(), fill, ...common } };
    }
    return null;
}

// ── Layer positioning ────────────────────────────────────────────────────────
//
// Each layer's local origin (top-left of its own bbox) sits at an offset from
// the ComplexComponent's origin. Matches the math in `createComplexLayers`.
function layerOriginIso(layer: ShapeLayer, baseLayer: ShapeLayer): { x: number; y: number } {
    // Component reference center = center of the base layer.
    const cx = baseLayer.width  / 2;
    const cy = baseLayer.height / 2;
    return {
        x: cx - layer.width  / 2 + layer.offsetX - layer.baseElevation,
        y: cy - layer.height / 2 + layer.offsetY - layer.baseElevation,
    };
}
function layerOrigin2D(layer: ShapeLayer, baseLayer: ShapeLayer): { x: number; y: number } {
    const cx = baseLayer.width  / 2;
    const cy = baseLayer.height / 2;
    return {
        x: cx - layer.width  / 2 + layer.offsetX,
        y: cy - layer.height / 2 + layer.offsetY,
    };
}

// ── Model ────────────────────────────────────────────────────────────────────

export const COMPLEX_COMPONENT_TYPE = 'nextrack.ComplexComponent';

interface ComplexComponentAttributes extends dia.Element.Attributes {
    layers: ShapeLayer[];
    /** Size of Layer 0 — the component's footprint used by bbox/collision. */
    size: { width: number; height: number };
    /** Isometric height of Layer 0. Included in the bbox for painter's sort. */
    isometricHeight: number;
    /** Icon data URL (composite icon + background baked in the Shape Designer). */
    iconHref: string;
    /** Rendered icon size in px (applied to width/height of the <image>). */
    iconSize: number;
    /** Face the icon lives on: 'top' (default) or 'front'. */
    iconFace: 'top' | 'front';
    /** Index of the layer carrying the icon. Defaults to 0 (main layer). */
    iconLayerIndex: number;
}

export class ComplexComponent extends IsometricShape {

    // Icons are rendered imperatively by the view at positions derived from
    // Layer 0's live geometry — they are NOT part of the attrs pipeline, so
    // applyRegistryDefaults's simple-shape icon math (which ignores layer
    // offsets) can't fight the view.
    override markup = [
        { tagName: 'rect',  selector: 'hitArea',    groupSelector: 'common' },
        { tagName: 'g',     selector: 'layers2D',   groupSelector: '2d'     },
        { tagName: 'g',     selector: 'layersISO',  groupSelector: 'iso'    },
        { tagName: 'text',  selector: 'label',      groupSelector: 'common' },
    ];

    override defaults(): Partial<ComplexComponentAttributes> {
        // dia.Element.prototype.defaults is defined at runtime (provides
        // position/size/angle). TS types don't expose it as a method on super.
        const parentDefaults = (dia.Element.prototype as any).defaults;
        const parent = typeof parentDefaults === 'function' ? parentDefaults.apply(this) : {};
        return {
            ...parent,
            type: COMPLEX_COMPONENT_TYPE,
            layers: [],
            size: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
            isometricHeight: GRID_SIZE,
            iconHref: '',
            iconSize: GRID_SIZE,
            iconFace: 'top',
            iconLayerIndex: 0,
            attrs: {
                hitArea: {
                    width: 'calc(w)', height: 'calc(h)',
                    fill: 'transparent', stroke: 'none',
                    magnet: true,
                },
                label: {
                    textAnchor: 'start',
                    textVerticalAnchor: 'middle',
                    fontFamily: 'sans-serif',
                    fontSize: 11,
                    fill: '#333',
                    stroke: '#fff',
                    strokeWidth: 3,
                    paintOrder: 'stroke',
                    x: 'calc(w + 10)',
                    y: 'calc(h + 10)',
                    text: '',
                },
            },
        };
    }

    constructor(...args: any[]) {
        super(...args);
        this.tools = {
            [CONNECT_KEY]: new elementTools.Connect(CONNECT_TOOL_PRESET),
        };
    }
}

// ── View ─────────────────────────────────────────────────────────────────────

export class ComplexComponentView extends dia.ElementView {

    override render(): this {
        super.render();
        this.listenTo(
            this.model,
            'change:layers change:size change:isometricHeight change:iconHref change:iconSize change:iconFace change:iconLayerIndex',
            this.rebuildLayers,
        );
        this.rebuildLayers();
        return this;
    }

    /** Replace the children of `layers2D` and `layersISO` with fresh DOM. */
    private rebuildLayers(): void {
        const layers = (this.model.get('layers') as ShapeLayer[] | undefined) ?? [];
        const iso2d = this.findNode('layers2D') as SVGGElement | null;
        const isoG  = this.findNode('layersISO') as SVGGElement | null;
        if (iso2d) iso2d.replaceChildren();
        if (isoG)  isoG.replaceChildren();
        if (layers.length === 0) return;

        const baseLayer = layers[0];
        const iconHref  = (this.model.get('iconHref') as string | undefined)  ?? '';
        const iconSize  = Number(this.model.get('iconSize')) || 0;
        const iconFace  = (this.model.get('iconFace') as 'top' | 'front' | undefined) ?? 'top';
        const iconLayerIdxRaw = Number(this.model.get('iconLayerIndex'));
        // Clamp against the current layer count so a stale or out-of-range
        // index (e.g. after a layer was removed) falls back to the main layer.
        const iconLayerIdx = Number.isFinite(iconLayerIdxRaw)
            && iconLayerIdxRaw >= 0
            && iconLayerIdxRaw < layers.length
                ? iconLayerIdxRaw
                : 0;

        // ISO group: Layer 0 (main) painted FIRST (behind), additional layers stacked
        // on top in array order. Icon is appended LAST inside the chosen layer's
        // group so it always paints above that layer's faces.
        if (isoG) {
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const { x, y } = layerOriginIso(layer, baseLayer);
                const g = document.createElementNS(SVG_NS, 'g');
                g.setAttribute('transform', `translate(${x} ${y})`);
                for (const face of isoFacesForLayer(layer)) appendFace(g, face);
                if (i === iconLayerIdx && iconHref && iconSize > 0) {
                    appendIcon(g, iconHref, iconSize, iconFace, layer, /*isIso=*/true);
                }
                isoG.appendChild(g);
            }
        }

        // 2D group: same forward order — main at the bottom, additional layers above.
        if (iso2d) {
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const face = twoDimFaceForLayer(layer);
                if (!face) continue;
                const { x, y } = layerOrigin2D(layer, baseLayer);
                const g = document.createElementNS(SVG_NS, 'g');
                g.setAttribute('transform', `translate(${x} ${y})`);
                appendFace(g, face);
                if (i === iconLayerIdx && iconHref && iconSize > 0) {
                    appendIcon(g, iconHref, iconSize, 'top', layer, /*isIso=*/false);
                }
                iso2d.appendChild(g);
            }
        }
    }
}

/**
 * Render the icon image inside a layer <g>, positioned relative to that layer's
 * own origin. The icon always lives on the Layer-0 group, so coordinates here
 * are Layer-0-local (x=0..layer.width, y=0..layer.height).
 *
 * For iconFace='top' in the isometric view, we shift by (-iH, -iH) to land on
 * the top face. For iconFace='front', we emit the same matrix transform the
 * existing simple-shape templates use.
 * In the 2D view we always centre on the base footprint (no iH shift).
 */
function appendIcon(
    group: SVGGElement,
    href: string,
    iconSize: number,
    iconFace: 'top' | 'front',
    layer: ShapeLayer,
    isIso: boolean,
): void {
    const el = document.createElementNS(SVG_NS, 'image');
    el.setAttribute('href', href);
    el.setAttribute('width', String(iconSize));
    el.setAttribute('height', String(iconSize));
    el.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    if (isIso && iconFace === 'front') {
        // Front-face placement — same local coords + matrix used by the
        // existing simple-shape templates (see applyRegistryDefaults).
        // Counter-rotate 180° around the icon's centre so it reads right-side
        // up; the projection matrix flips the y-axis.
        const localX = (layer.width - iconSize) / 2;
        const localY = (layer.depth - iconSize) / 2;
        const cx = localX + iconSize / 2;
        const cy = localY + iconSize / 2;
        el.setAttribute('x', String(localX));
        el.setAttribute('y', String(localY));
        el.setAttribute('transform', `matrix(1,0,-1,-1,0,${layer.height}) rotate(180,${cx},${cy})`);
    } else {
        const lift = isIso ? layer.depth : 0;
        el.setAttribute('x', String((layer.width  - iconSize) / 2 - lift));
        el.setAttribute('y', String((layer.height - iconSize) / 2 - lift));
    }
    group.appendChild(el);
}

function appendFace(g: SVGGElement, face: FaceDesc): void {
    const el = document.createElementNS(SVG_NS, face.element);
    for (const [k, v] of Object.entries(face.attrs)) {
        el.setAttribute(k, String(v));
    }
    g.appendChild(el);
}
