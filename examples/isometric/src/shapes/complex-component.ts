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
 * (rectangleFrontPath, topHexPath, svgSideFacesPath, etc.) produce the exact
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
    RectangleShape,
    CircleShape,
    CONNECT_KEY,
} from './isometric-shape';
import { Rectangle } from './rectangle/rectangle';           // proxy for rectangle baseShape
import { Circle } from './circle/circle';     // proxy for circle baseShape
import { Octagon } from './octagon/octagon';
import { SvgPolygonShape } from './svgpolygon/svg-polygon-shape';
import { ShapeLayer, IconEntry } from './shape-registry';
import { CONNECT_TOOL_PRESET } from '../tools';
import { GRID_SIZE, SHAPE_CELL_SIZE } from '../theme';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Fill/stroke resolution funnels through utils.resolveStyleColors so the
// SD's ComplexComponent render path uses the same dark/light rules as the
// CD's direct-instance path (utils.applyShapeStyle). See ADR-0004.

import { resolveStyleColors, icon2DHref, buildCompositeIconSvg } from '../utils';
import { resolveIconRender } from '../icon-resolver';
import { isDarkMode } from '../svg-inventory';

function fillFor(style: ShapeLayer['style'], kind: 'top' | 'side' | 'front'): string {
    const c = resolveStyleColors(style);
    return kind === 'top' ? c.top : kind === 'side' ? c.side : c.front;
}

function strokeFor(style: ShapeLayer['style']): string {
    return resolveStyleColors(style).stroke;
}

// ── Face descriptors ─────────────────────────────────────────────────────────

interface FaceDesc {
    element: 'path' | 'polygon' | 'ellipse' | 'rect';
    attrs: Record<string, string | number>;
}

/**
 * Build an off-graph proxy shape instance with the right dimensions/height so
 * we can call its geometry methods. Not added to any paper — used purely to
 * compute SVG path strings.
 */
function makeProxy(layer: ShapeLayer): IsometricShape {
    // Polygon-backed layers (drawn 'custom' or uploaded 'svgPolygon') render via
    // SvgPolygonShape, which consumes normalizedVerts.
    const isSvg = (layer.baseShape === 'custom' || layer.baseShape === 'svgPolygon')
        && !!(layer.normalizedVerts && layer.normalizedVerts.length >= 3);
    let proxy: IsometricShape;
    if (isSvg) {
        proxy = new SvgPolygonShape();
        (proxy as SvgPolygonShape).set('normalizedVerts', layer.normalizedVerts!);
        if (layer.lines && layer.lines.length > 0) {
            (proxy as SvgPolygonShape).set('lines', layer.lines);
        }
    } else {
        // Matches the mapping used by `createComplexLayers` for consistency.
        switch (layer.baseShape) {
            case 'circle':  proxy = new Circle();       break;
            case 'octagon':   proxy = new Octagon();        break;
            case 'hexahedron':
            case 'rectangle':
            default:          proxy = new Rectangle();         break;
        }
    }
    proxy.resize(layer.width, layer.height);
    proxy.set('isometricHeight', layer.depth);
    if (layer.cornerRadius !== undefined) proxy.set('cornerRadius', layer.cornerRadius);
    if (layer.chamferSize !== undefined) proxy.set('chamferSize', layer.chamferSize);
    if (layer.chamferStart) proxy.set('chamferStart', layer.chamferStart);
    if (layer.chamferBottomSize) proxy.set('chamferBottomSize', layer.chamferBottomSize);
    if (layer.chamferBottomStart) proxy.set('chamferBottomStart', layer.chamferBottomStart);
    if (layer.twist) proxy.set('twist', layer.twist);
    if (layer.scaleTopX !== undefined && layer.scaleTopX !== 1) proxy.set('scaleTopX', layer.scaleTopX);
    if (layer.scaleTopY !== undefined && layer.scaleTopY !== 1) proxy.set('scaleTopY', layer.scaleTopY);
    if (layer.shedRoofDrop) proxy.set('shedRoofDrop', layer.shedRoofDrop);
    if (layer.shedRoofDirection) proxy.set('shedRoofDirection', layer.shedRoofDirection);
    return proxy;
}

/** All visible isometric faces for one layer, in painter's-algorithm order. */
function isoFacesForLayer(layer: ShapeLayer): FaceDesc[] {
    const proxy  = makeProxy(layer);
    const stroke = strokeFor(layer.style);
    const commonStroke = { stroke, 'stroke-linejoin': 'round' };

    if (proxy instanceof SvgPolygonShape) {
        const faces: FaceDesc[] = [
            { element: 'path', attrs: { d: proxy.svgSideFacesPath(), fill: fillFor(layer.style, 'side'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.svgTopPath(),       fill: fillFor(layer.style, 'top'),  ...commonStroke } },
        ];
        const linesD = proxy.linesPath();
        if (linesD) {
            faces.push({ element: 'path', attrs: { d: linesD, fill: 'none', stroke, 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } });
        }
        return faces;
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
    if (proxy instanceof RectangleShape) {
        return [
            { element: 'path', attrs: { d: proxy.baseRectanglePathIso(),  fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.rectangleFrontPath(),    fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.rectangleSidePath(),     fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.rectangleCornerV1Path(), fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.rectangleCornerV2Path(), fill: fillFor(layer.style, 'side'),  ...commonStroke } },
            { element: 'path', attrs: { d: proxy.rectangleCornerV3Path(), fill: fillFor(layer.style, 'front'), ...commonStroke } },
            { element: 'path', attrs: { d: proxy.topRectanglePath(),      fill: fillFor(layer.style, 'top'),   ...commonStroke } },
        ];
    }
    if (proxy instanceof CircleShape) {
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

// ── Layer positioning ────────────────────────────────────────────────────────
//
// Each layer's local origin (top-left of its own bbox) sits at an offset from
// the ComplexComponent's origin.
//
// When layers are arranged asymmetrically (e.g. layer 0 at offsetX=0, layer 1
// at offsetX=40), the union bbox is wider than any single layer and its
// centre sits OFF the shape origin. Without compensating, iso rendering
// shifts the layer union to the right of the element bbox — which the user
// perceives as the 2D icon being "off-centre" compared to iso. Subtract the
// bbox centre (in shape-coords) so the layer union is centred inside the
// element's bbox regardless of how lopsided the offsets are.
function shapeBboxCentre(layers: readonly ShapeLayer[]): { x: number; y: number } {
    const floors = layers.filter(l => l.baseElevation === 0);
    const considered = floors.length > 0 ? floors : layers;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const l of considered) {
        if (l.offsetX - l.width  / 2 < minX) minX = l.offsetX - l.width  / 2;
        if (l.offsetX + l.width  / 2 > maxX) maxX = l.offsetX + l.width  / 2;
        if (l.offsetY - l.height / 2 < minY) minY = l.offsetY - l.height / 2;
        if (l.offsetY + l.height / 2 > maxY) maxY = l.offsetY + l.height / 2;
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0 };
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function layerOriginIso(layer: ShapeLayer, modelW: number, modelH: number, layers: readonly ShapeLayer[]): { x: number; y: number } {
    const cx = modelW / 2;
    const cy = modelH / 2;
    // Single-layer shapes preserve user-set offset as-is (typing offsetX in
    // the inspector means "shift this single layer N px"). Multi-layer
    // shapes subtract the union-bbox centre so an asymmetric arrangement
    // still ends up centred inside the element bbox — without this, layer 1
    // at offsetX=40 + layer 0 at offsetX=0 would render with the cluster
    // skewed right of the element centre and the SD 2D icon (at bbox
    // centre) would appear offset from the iso main.
    const bbox = layers.length > 1 ? shapeBboxCentre(layers) : { x: 0, y: 0 };
    return {
        x: cx - layer.width  / 2 + (layer.offsetX - bbox.x) - layer.baseElevation,
        y: cy - layer.height / 2 + (layer.offsetY - bbox.y) - layer.baseElevation,
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
    /** Face the icon lives on: 'top' (default), 'front', or 'side'. */
    iconFace: 'top' | 'front' | 'side';
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
            simplified2D: false,
            attrs: {
                hitArea: {
                    width: 'calc(w)', height: 'calc(h)',
                    fill: 'transparent', stroke: 'none',
                    magnet: true,
                },
                label: {
                    // Default position: centred horizontally, just below the
                    // component footprint. `textVerticalAnchor: top` makes y
                    // the top of the text so the gap below the shape stays
                    // visually consistent regardless of fontSize.
                    textAnchor: 'middle',
                    textVerticalAnchor: 'top',
                    fontFamily: 'sans-serif',
                    fontSize: 11,
                    fill: '#333',
                    stroke: '#fff',
                    strokeWidth: 3,
                    paintOrder: 'stroke',
                    x: 'calc(w/2)',
                    y: 'calc(h + 6)',
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

    private onThemeChange = (): void => { this.rebuildLayers(); };

    override render(): this {
        super.render();
        this.listenTo(
            this.model,
            'change:layers change:size change:isometricHeight change:simplified2D change:viewMode',
            this.rebuildLayers,
        );
        // Theme-aware fills/strokes baked into face DOM ⇒ rebuild on toggle.
        // Same goes for the central color-derivation settings: vendor
        // presets resolve through createThemeColor at render time, so a
        // settings tweak needs a rebuild too.
        window.addEventListener('nr-theme-change', this.onThemeChange);
        window.addEventListener('nr-color-derivation-change', this.onThemeChange);
        window.addEventListener('nr-icon-rendering-change', this.onThemeChange);
        this.rebuildLayers();
        return this;
    }

    override remove(): this {
        window.removeEventListener('nr-theme-change', this.onThemeChange);
        window.removeEventListener('nr-color-derivation-change', this.onThemeChange);
        window.removeEventListener('nr-icon-rendering-change', this.onThemeChange);
        return super.remove();
    }

    /**
     * Repaint `layers2D` and `layersISO` based on the current `viewMode`. Only
     * the group for the active view gets DOM children — the other one is
     * emptied. This is stronger than relying on `display:none` toggling because
     * an emptied group has no faces, no icons, no hit-area, so a stale "ghost"
     * of the previous view can never show up via hover, port lookup or
     * selection-outline geometry.
     */
    private rebuildLayers(): void {
        const layers = (this.model.get('layers') as ShapeLayer[] | undefined) ?? [];
        const iso2d = this.findNode('layers2D') as SVGGElement | null;
        const isoG  = this.findNode('layersISO') as SVGGElement | null;
        if (iso2d) iso2d.replaceChildren();
        if (isoG)  isoG.replaceChildren();

        const isIso = (this.model.get('viewMode') as string) !== '2d';
        // Belt-and-braces: empty the inactive group AND hide it + block pointer
        // events, so nothing in the secondary layer's bbox area can trigger
        // hover, ports or selection — even if JointJS's attr-pipeline display
        // toggle hasn't been applied yet.
        if (iso2d) {
            iso2d.style.display = isIso ? 'none' : '';
            iso2d.style.pointerEvents = isIso ? 'none' : '';
        }
        if (isoG) {
            isoG.style.display = isIso ? '' : 'none';
            isoG.style.pointerEvents = isIso ? '' : 'none';
        }

        if (layers.length === 0) return;
        const { width: modelW, height: modelH } = this.model.size();

        if (isIso && isoG) {
            // ISO group: Layer 0 (main) painted FIRST (behind), additional layers stacked
            // on top in array order. Icon is appended LAST inside the chosen layer's
            // group so it always paints above that layer's faces.
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const { x, y } = layerOriginIso(layer, modelW, modelH, layers);
                const g = document.createElementNS(SVG_NS, 'g');
                g.setAttribute('transform', `translate(${x} ${y})`);
                for (const face of isoFacesForLayer(layer)) appendFace(g, face);
                appendLayerIcons(g, layer, true);
                isoG.appendChild(g);
            }
        }

        if (!isIso && iso2d) {
            // 2D: single 40×40 cell with the main icon, centred on the
            // element. No layer offset — even when secondary layers' offsets
            // skew the bbox to one side, the icon stays in the dead centre
            // of the element's bbox. This matches CD's 2D preview where every
            // layer stacks at canvas centre with all offsets ignored.
            const SIZE = SHAPE_CELL_SIZE;
            const mainIcon = findMainIcon(layers);
            const x = (modelW - SIZE) / 2;
            const y = (modelH - SIZE) / 2;
            const g = document.createElementNS(SVG_NS, 'g');
            g.setAttribute('transform', `translate(${x} ${y})`);
            const href2D = mainIcon ? icon2DHref(mainIcon) : '';
            if (href2D) {
                const img = document.createElementNS(SVG_NS, 'image');
                img.setAttribute('href', href2D);
                img.setAttribute('x', '0');
                img.setAttribute('y', '0');
                img.setAttribute('width', String(SIZE));
                img.setAttribute('height', String(SIZE));
                img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                g.appendChild(img);
            }
            iso2d.appendChild(g);
        }
    }
}


// Find the single "main" IconEntry across all layers — either the explicit
// isMain flag, or the first icon if none is flagged.
function findMainIcon(layers: ShapeLayer[]): IconEntry | null {
    for (const l of layers) {
        for (const ie of (l.icons ?? [])) if (ie.isMain) return ie;
    }
    for (const l of layers) {
        for (const ie of (l.icons ?? [])) if (ie.href) return ie;
    }
    return null;
}

// Find which layer currently owns the shape-wide main icon. Falls back to
// layer 0 when no `isMain` flag is set anywhere.
function findMainLayer(layers: ShapeLayer[]): ShapeLayer | undefined {
    return layers.find(l => l.icons?.some(e => e.isMain)) ?? layers[0];
}

/**
 * Build the IconEntry's composite SVG live, using the current theme. Mirrors
 * what CD's `applyIconToCurrentShape` does — both paths funnel through
 * `resolveIconRender` + `buildCompositeIconSvg`, so the SD's rendering of an
 * AWS-monochrome (or any theme-dependent) icon stays in sync with whatever
 * the theme is RIGHT NOW. The persisted `ie.href` is treated as a save-time
 * snapshot, not the live render source.
 */
function liveIconHref(ie: IconEntry, canvasPx: number): string {
    const mode: 'light' | 'dark' = isDarkMode() ? 'dark' : 'light';
    const decision = resolveIconRender(ie, 'isoFace', mode);
    if (!decision) return ie.href ?? '';
    let glyphSvg = decision.glyphSvg;
    if (glyphSvg) {
        const defaultGlyphColor = mode === 'dark' ? '#ffffff' : '#000000';
        glyphSvg = glyphSvg.replace(/currentColor/g, defaultGlyphColor);
    }
    const iconColor = decision.glyphTint === 'original' ? null : decision.glyphTint;
    const bg = decision.background;
    const iconPx = ie.size * GRID_SIZE;
    const bgPx = ie.bgSize * GRID_SIZE;
    const composite = buildCompositeIconSvg(
        glyphSvg || null,
        bg?.color ?? null,
        (bg?.shape ?? ie.bgShape),
        false,
        bg?.radius ?? ie.bgRadius,
        bg?.chamfer ?? ie.bgChamfer,
        'normal',
        false,
        canvasPx, iconPx, bgPx,
        iconColor,
        ie.iconOpacity ?? 100,
        bg?.opacity ?? 100,
    );
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(composite)}`;
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
    ie: IconEntry,
    iconSize: number,
    iconFace: 'top' | 'front' | 'side',
    layer: ShapeLayer,
    isIso: boolean,
): void {
    const el = document.createElementNS(SVG_NS, 'image');
    el.setAttribute('href', liveIconHref(ie, iconSize));
    el.setAttribute('width', String(iconSize));
    el.setAttribute('height', String(iconSize));
    el.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Per-entry offsets are in grid units; scale into pixels. Multiple icons
    // on the same face would otherwise overlap exactly (centered) and the
    // user would see only the top of the z-stack. Skew matches the CD
    // canvas's composite-SVG rendering for visual parity.
    const ox = (ie.offsetX ?? 0) * GRID_SIZE;
    const oy = (ie.offsetY ?? 0) * GRID_SIZE;
    const skTx = (ie.skewX || ie.skewY) ? ` skewX(${ie.skewX}) skewY(${ie.skewY})` : '';

    if (isIso && iconFace === 'front') {
        const localX = (layer.width - iconSize) / 2 + ox;
        const localY = (layer.depth - iconSize) / 2 + oy;
        el.setAttribute('x', String(localX));
        el.setAttribute('y', String(localY));
        // Non-mirroring map (det=+1) of the image rect onto the front face.
        el.setAttribute('transform', `matrix(1,0,1,1,${-layer.depth},${layer.height - layer.depth})${skTx}`);
    } else if (isIso && iconFace === 'side') {
        const localX = (layer.height - iconSize) / 2 + ox;
        const localY = (layer.depth - iconSize) / 2 + oy;
        const cx = localX + iconSize / 2;
        const cy = localY + iconSize / 2;
        el.setAttribute('x', String(localX));
        el.setAttribute('y', String(localY));
        el.setAttribute('transform', `matrix(0,1,-1,-1,${layer.width},0) rotate(180,${cx},${cy})${skTx}`);
    } else {
        const lift = isIso ? layer.depth : 0;
        el.setAttribute('x', String((layer.width  - iconSize) / 2 - lift + ox));
        el.setAttribute('y', String((layer.height - iconSize) / 2 - lift + oy));
        if (skTx) el.setAttribute('transform', skTx.trimStart());
    }
    group.appendChild(el);
}

function appendLayerIcons(g: SVGGElement, layer: ShapeLayer, isIso: boolean): void {
    const icons = layer.icons;
    if (!icons || icons.length === 0) return;
    // Iterate in reverse so icons higher in the entry list (lower index)
    // appear on TOP visually — the icon list in the Component Designer is
    // ordered top-to-bottom, and `applyIconToCurrentShape` uses the same
    // reverse iteration to keep CD and SD canvases consistent.
    for (let i = icons.length - 1; i >= 0; i--) {
        const ie = icons[i];
        // We previously skipped entries with no `ie.href`; now the composite
        // is rebuilt live, so the only meaningful skip is "no icon and no bg".
        if (!ie.iconId && !ie.bgEnabled) continue;
        const canvasPx = Math.max(ie.size, ie.bgSize) * GRID_SIZE;
        if (isIso) {
            appendIcon(g, ie, canvasPx, ie.face, layer, true);
        } else {
            const show2D = icons.length === 1 || ie.isMain;
            if (show2D) appendIcon(g, ie, canvasPx, 'top', layer, false);
        }
    }
}

function appendFace(g: SVGGElement, face: FaceDesc): void {
    const el = document.createElementNS(SVG_NS, face.element);
    for (const [k, v] of Object.entries(face.attrs)) {
        el.setAttribute(k, String(v));
    }
    g.appendChild(el);
}
