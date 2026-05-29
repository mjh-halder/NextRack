/*
 * NextRack additions extracted from src/utils.ts as part of the MPL-2.0
 * compliance work documented in docs/adr/0006-mpl-extraction-strategy.md.
 *
 * Original JointJS demo functions (transformationMatrix, sortElements,
 * drawGrid, switchView, the Node interface and the topologicalSort helper)
 * remain in src/utils.ts under MPL-2.0. Everything in this file is NextRack
 * code and never existed in the upstream isometric demo.
 */

import { dia } from '@joint/core';
import { GRID_SIZE, SHAPE_CELL_SIZE } from './theme';
import type { ShapeStyle, ShapeDefinition, IconEntry } from './shapes/shape-registry';
import { isTextEntry } from './shapes/shape-registry';
import { getPaletteIcon } from './shape-query';
import { getIconById, stripAwsBackground } from './icon-catalog';
import { getIconRenderSettings, vendorForSource } from './icon-rendering';
import { resolveIconRender } from './icon-resolver';

/**
 * Generates a composite SVG with icon and background at absolute pixel sizes
 * within a fixed viewBox. Both are centered independently. The single source
 * of truth for icon composites — used by Component Designer (iso + 2D
 * preview) and by the System Designer's 2D renderer via {@link icon2DHref}.
 */
export function buildCompositeIconSvg(
    iconSvg: string | null,
    bgColor: string | null,
    bgShape: 'circle' | 'square' | 'octagon',
    applyWhiteFilter = true,
    bgRadius = 6,
    bgChamfer = 0.18,
    padding: 'normal' | 'compact' | 'tight' | 'none' = 'normal',
    clipToShape = false,
    canvasPx = 64,
    iconPx = 64,
    bgPx = 64,
    iconColor: string | null = null,
    iconOpacity = 100,
    bgOpacity = 100,
): string {
    const S = canvasPx;

    // Background — absolute size, centered
    const bgOff = (S - bgPx) / 2;
    let shapeEl = '';
    if (bgShape === 'circle') {
        shapeEl = `<circle cx="${bgOff + bgPx / 2}" cy="${bgOff + bgPx / 2}" r="${bgPx / 2}"`;
    } else if (bgShape === 'octagon') {
        const c = bgPx * bgChamfer;
        shapeEl = `<polygon points="${bgOff + c},${bgOff} ${bgOff + bgPx - c},${bgOff} ${bgOff + bgPx},${bgOff + c} ${bgOff + bgPx},${bgOff + bgPx - c} ${bgOff + bgPx - c},${bgOff + bgPx} ${bgOff + c},${bgOff + bgPx} ${bgOff},${bgOff + bgPx - c} ${bgOff},${bgOff + c}"`;
    } else {
        shapeEl = `<rect x="${bgOff}" y="${bgOff}" width="${bgPx}" height="${bgPx}" rx="${bgRadius}"`;
    }
    const bgOpStr = bgOpacity < 100 ? ` opacity="${(bgOpacity / 100).toFixed(2)}"` : '';
    const bgEl = bgColor !== null ? `${shapeEl} fill="${bgColor}"${bgOpStr}/>` : '';

    // Icon — absolute size, centered independently (skip if no icon SVG)
    if (iconSvg) {
        const iconOff = (S - iconPx) / 2;
        const padFrac = padding === 'none' ? 0 : padding === 'compact' ? 6 / 64 : padding === 'tight' ? 3 / 64 : 13 / 64;
        const pad = iconPx * padFrac;
        const iconInner = iconPx - 2 * pad;
        const iconX = iconOff + pad;
        const iconY = iconOff + pad;

        let defsParts = '';
        let filterAttr = '';
        if (iconColor) {
            const r = parseInt(iconColor.slice(1, 3), 16) / 255;
            const g = parseInt(iconColor.slice(3, 5), 16) / 255;
            const b = parseInt(iconColor.slice(5, 7), 16) / 255;
            defsParts += `<filter id="nr-tint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} 0 0 0 1 0"/></filter>`;
            filterAttr = ' filter="url(#nr-tint)"';
        } else if (applyWhiteFilter) {
            defsParts += `<filter id="nr-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`;
            filterAttr = ' filter="url(#nr-white)"';
        }
        if (clipToShape) {
            defsParts += `<clipPath id="nr-icon-clip">${shapeEl}/></clipPath>`;
        }
        const defs = defsParts ? `<defs>${defsParts}</defs>` : '';
        const clipAttr = clipToShape ? ' clip-path="url(#nr-icon-clip)"' : '';
        const iconOpStr = iconOpacity < 100 ? ` opacity="${(iconOpacity / 100).toFixed(2)}"` : '';
        const iconHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" overflow="hidden">${defs}${bgEl}<image href="${iconHref}" x="${iconX}" y="${iconY}" width="${iconInner}" height="${iconInner}" preserveAspectRatio="xMidYMid meet"${filterAttr}${clipAttr}${iconOpStr}/></svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" overflow="hidden">${bgEl}</svg>`;
}

/**
 * Build a composite SVG for a TEXT-mode icon entry: same background plumbing
 * as `buildCompositeIconSvg`, but a `<text>` element instead of `<image>`.
 *
 * The text fills the canvas the same way an icon does:
 *   - font-size scales down with length so 1–3 chars stay legible
 *   - centred via text-anchor + dominant-baseline
 *   - fill = explicit colour or `currentColor` (= theme-tinted by the
 *     consuming surface, same chokepoint Carbon icons use)
 * Font-family is fixed to IBM Plex Sans (Carbon).
 */
export function buildTextIconSvg(
    text: string,
    bgColor: string | null,
    bgShape: 'circle' | 'square' | 'octagon',
    bgRadius = 6,
    bgChamfer = 0.18,
    canvasPx = 64,
    bgPxX = 64,
    textColor = 'currentColor',
    fontWeight: 'normal' | 'bold' = 'bold',
    bgOpacity = 100,
    textOpacity = 100,
    bgPxY?: number,
    textPx?: number,
): string {
    const S = canvasPx;
    const safeText = (text || '').slice(0, 3);
    const bgW = bgPxX;
    const bgH = bgPxY ?? bgPxX; // independent axes; default square
    // Text glyph size, independent of bg + canvas — so the Size slider
    // controls text size even when bg is large. Defaults to canvas so
    // existing callers that don't pass it see the previous behaviour.
    const TEXT_S = textPx ?? S;

    // Background — independent X/Y axes (text-mode use case).
    const bgOffX = (S - bgW) / 2;
    const bgOffY = (S - bgH) / 2;
    let shapeEl = '';
    if (bgShape === 'circle') {
        // Circle becomes an ellipse when the axes differ — keeps the X/Y
        // sliders meaningful instead of silently dropping one axis.
        shapeEl = `<ellipse cx="${bgOffX + bgW / 2}" cy="${bgOffY + bgH / 2}" rx="${bgW / 2}" ry="${bgH / 2}"`;
    } else if (bgShape === 'octagon') {
        const cx = bgW * bgChamfer;
        const cy = bgH * bgChamfer;
        shapeEl = `<polygon points="${bgOffX + cx},${bgOffY} ${bgOffX + bgW - cx},${bgOffY} ${bgOffX + bgW},${bgOffY + cy} ${bgOffX + bgW},${bgOffY + bgH - cy} ${bgOffX + bgW - cx},${bgOffY + bgH} ${bgOffX + cx},${bgOffY + bgH} ${bgOffX},${bgOffY + bgH - cy} ${bgOffX},${bgOffY + cy}"`;
    } else {
        shapeEl = `<rect x="${bgOffX}" y="${bgOffY}" width="${bgW}" height="${bgH}" rx="${bgRadius}"`;
    }
    const bgOpStr = bgOpacity < 100 ? ` opacity="${(bgOpacity / 100).toFixed(2)}"` : '';
    const bgEl = bgColor !== null ? `${shapeEl} fill="${bgColor}"${bgOpStr}/>` : '';

    // Heuristic that keeps 1–3-char glyphs comfortably inside an 80% inset
    // of the requested TEXT box: a single bold letter renders at ~0.7em
    // wide in IBM Plex; for longer strings we shrink so the natural width
    // still fits.
    const len = Math.max(1, safeText.length);
    const fontSize = Math.min(TEXT_S * 0.7, (TEXT_S * 0.8) / (len * 0.55));
    const textOpStr = textOpacity < 100 ? ` opacity="${(textOpacity / 100).toFixed(2)}"` : '';

    // SVG escape: only & < > matter inside element content.
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" overflow="hidden">${bgEl}<text x="${S / 2}" y="${S / 2}" text-anchor="middle" dominant-baseline="central" font-family="IBM Plex Sans, sans-serif" font-weight="${fontWeight}" font-size="${fontSize.toFixed(2)}" fill="${textColor}"${textOpStr}>${esc(safeText)}</text></svg>`;
}

/**
 * Wrap `buildTextIconSvg` with the same theme/background plumbing the icon
 * path uses, then return a data-URI ready for `<image href>`. Honoured by
 * both `icon2DHref` (2D surface) and `liveIconHref` (isoFace surface).
 */
function buildTextIconHref(ie: IconEntry, canvasPx: number, surface: 'grid2d' | 'isoFace'): string {
    const isDark = typeof document !== 'undefined'
        && document.documentElement.classList.contains('cds--g100');
    // User override wins; otherwise theme-tint (dark in light mode, light
    // in dark mode) so plain black source SVGs … err, plain text glyphs
    // stay legible on either background.
    const textColor = ie.iconColor && ie.iconColor.length > 0
        ? ie.iconColor
        : (isDark ? '#ffffff' : '#161616');

    const bgEnabled = ie.bgEnabled;
    const bgColor   = bgEnabled ? ie.bgColor : null;
    const bgShape   = ie.bgShape;
    const bgRadius  = ie.bgRadius;
    const bgChamfer = ie.bgChamfer;
    // 2D ignores the per-entry bgOpacity (mirrors how icon2DHref does it
    // for icons — resolver-enforced). isoFace honours it.
    const bgOpacity = surface === 'grid2d' ? 100 : (ie.bgOpacity ?? 100);

    // Bg Size X/Y are stored in real pixels; legacy `bgSize` is GU and
    // needs the × GRID_SIZE conversion as a fallback.
    const bgPxRawX = ie.bgSizeX ?? ie.bgSize * GRID_SIZE;
    const bgPxRawY = ie.bgSizeY ?? ie.bgSize * GRID_SIZE;
    const bgPxX = surface === 'isoFace' ? bgPxRawX : canvasPx;
    const bgPxY = surface === 'isoFace' ? bgPxRawY : canvasPx;
    const textPx = surface === 'isoFace' ? ie.size * GRID_SIZE : canvasPx;
    const svg = buildTextIconSvg(
        ie.textContent ?? '',
        bgColor,
        bgShape,
        bgRadius,
        bgChamfer,
        canvasPx,
        bgPxX,
        textColor,
        ie.fontWeight ?? 'bold',
        bgOpacity,
        ie.iconOpacity ?? 100,
        bgPxY,
        textPx,
    );
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 2D-view icon URL — the single composite path used by the System Designer,
 * the Component Designer, and ComplexComponent.
 *
 * All policy decisions (family default tint, forced GCP plate, user iconColor
 * override) live in the central resolver. This function is the thin adapter
 * that turns the resolver's structured decision into a buildCompositeIconSvg
 * call plus the 2D-specific transforms (currentColor replacement, vendor-bg
 * stripping, oversize). The per-IconEntry `bgEnabled / bgColor / bgOpacity`
 * fields are deliberately ignored here — they are isoFace authoring choices.
 */
export function icon2DHref(ie: IconEntry): string {
    if (isTextEntry(ie)) return buildTextIconHref(ie, SHAPE_CELL_SIZE, 'grid2d');
    if (!ie.iconId) return ie.href ?? '';
    const cat = getIconById(ie.iconId);
    if (!cat?.svg) return ie.href ?? '';

    const isDark = typeof document !== 'undefined'
        && document.documentElement.classList.contains('cds--g100');
    const mode = isDark ? 'dark' : 'light';

    const decision = resolveIconRender(ie, 'grid2d', mode);
    if (!decision) return ie.href ?? '';

    // Admin-tunable per-vendor 2D knobs (oversize, stripVendorBackground)
    // remain Vendor-keyed — they are presentation knobs, not Family policy.
    const settings = getIconRenderSettings(vendorForSource(cat.source), mode);

    // Strip the vendor-shipped backplate when the admin opts in (currently a
    // no-op for baked defaults; left as an Admin escape hatch for AWS icons
    // with intrusive backgrounds). Done on the resolver's already-freshened
    // SVG so IDs stay unique.
    let glyphSvg = decision.glyphSvg;
    if (settings.stripVendorBackground && glyphSvg) {
        glyphSvg = stripAwsBackground(glyphSvg);
    }
    // Carbon (and other mono) icons ship with fill="currentColor". When the
    // SVG is loaded through an <image href="data:..."> the embedded document
    // has no colour context, so currentColor falls back to a browser default
    // (commonly invisible-on-white). Resolve it here so the 'original' tint
    // is actually visible — concrete tints get rewritten by the feColorMatrix.
    const defaultGlyphColor = isDark ? '#ffffff' : '#000000';
    if (glyphSvg) glyphSvg = glyphSvg.replace(/currentColor/g, defaultGlyphColor);

    const iconColor = decision.glyphTint === 'original' ? null : decision.glyphTint;
    const bg = decision.background;

    const S = SHAPE_CELL_SIZE;
    // `iconPx` carries the oversize so the glyph can bleed past the 40×40 cell.
    const iconPx = S * settings.oversize;
    const svg = buildCompositeIconSvg(
        glyphSvg,
        bg?.color ?? null,
        (bg?.shape ?? 'square'),
        false,                          // applyWhiteFilter: replaced by glyphTint
        bg?.radius ?? 6,
        bg?.chamfer ?? 0.18,
        'none',
        false,
        S, iconPx, S,
        iconColor,
        ie.iconOpacity ?? 100,
        100,                            // 2D ignores user bgOpacity (resolver-enforced)
    );
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Live opacity update without rebuilding the grid path. Used by the SD
// display-settings hub while scrubbing the Opacity stepper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setGridOpacity = (gridVEl: any, opacity: number): void => {
    if (gridVEl) gridVEl.attr('stroke-opacity', String(opacity));
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

// Template-default colors used as fallbacks when no per-layer / per-mode color
// is set. Follows the light-from-above convention: top is the brightest face,
// front the darkest. Concrete layer colours are derived from a single base via
// `deriveFaceShades` in `color-derivation.ts`; these fallbacks are only used
// when no per-layer style is set.
export const STYLE_TEMPLATE_DEFAULTS = {
    top:    '#e0e0e0',
    side:   '#c6c6c6',
    front:  '#a8a8a8',
    // Must match the literal `#333` in every shape's SVG template — the
    // dark-mode CSS rewrites only `[stroke="#333"]`, so the fallback has to
    // hit that selector exactly.
    stroke: '#333',
};

/**
 * Resolve per-mode colors from a layer's style. Single source of truth — both
 * `applyShapeStyle` (CD direct-instance path) and `complex-component.ts`'s
 * `fillFor`/`strokeFor` (SD ComplexComponent path) must funnel through here
 * so light/dark mode stays consistent across both render paths.
 */
export function resolveStyleColors(style: ShapeStyle): { top: string; front: string; side: string; stroke: string } {
    const isDark = typeof document !== 'undefined'
        && document.documentElement.classList.contains('cds--g100');
    return {
        top:    (isDark ? style.topColorDark    : style.topColor)    || STYLE_TEMPLATE_DEFAULTS.top,
        front:  (isDark ? style.frontColorDark  : style.frontColor)  || STYLE_TEMPLATE_DEFAULTS.front,
        side:   (isDark ? style.sideColorDark   : style.sideColor)   || STYLE_TEMPLATE_DEFAULTS.side,
        stroke: (isDark ? style.strokeColorDark : style.strokeColor) || STYLE_TEMPLATE_DEFAULTS.stroke,
    };
}

/**
 * Apply fill-opacity to every face element of a shape's view, leaving stroke
 * fully opaque. CSS `opacity` on the view root affects both fill and stroke
 * — that's the wrong knob for "fade the surfaces".
 *
 * Skips the hitArea rect, label text, icon image and SELECT outline group.
 */
export function applyShapeFillOpacity(view: dia.CellView, opacity: number): void {
    if (!view || !view.el) return;
    const op = String(Math.max(0, Math.min(1, opacity)));
    view.el.querySelectorAll<SVGElement>('path, polygon, ellipse, rect').forEach(el => {
        const sel = el.getAttribute('joint-selector') || '';
        if (sel === 'hitArea') return;
        if (el.closest('[data-zone-select], [data-embedded]')) return;
        el.setAttribute('fill-opacity', op);
    });
}

export function applyShapeStyle(shape: dia.Element, style: ShapeStyle): void {
    // Use the two-argument string form for every attr so JointJS parses '/' as
    // a path separator. The object form attr({key: val}) does a plain merge and
    // does NOT split '/' — literal key 'top/fill' would match no element.
    //
    // attrs are ALWAYS written (even when the resolved color is undefined ⇒
    // template default) so a Light/Dark theme toggle resets any colors that
    // were stamped on the SVG by the previous mode. Otherwise switching
    // Dark → Light would leave the dark-mode fill stuck on the element.
    const { top, front, side, stroke } = resolveStyleColors(style);

    shape.attr('top/fill', top);
    // Tube/pipe: body mantle. Duct/channel: outline mantle.
    shape.attr('body/fill', top);
    shape.attr('outline/fill', top);

    // Front-facing selectors include octagon-specific frontLeft/frontBottom/
    // frontRight and corner panels cornerV4/V5/V6.
    shape.attr('front/fill',       front);
    shape.attr('frontLeft/fill',   front);
    shape.attr('frontBottom/fill', front);
    shape.attr('frontRight/fill',  front);
    shape.attr('cornerV3/fill',    front);
    shape.attr('cornerV4/fill',    front);
    shape.attr('cornerV5/fill',    front);
    shape.attr('cornerV6/fill',    front);
    shape.attr('frontEllipse/fill', front);
    shape.attr('frontFace/fill',    front);
    const isTubeDuct = shape.attr('body/d') || shape.attr('outline/d');
    if (!isTubeDuct) {
        shape.attr('base/fill', front);
        shape.attr('baseIso/fill', front);
    }

    shape.attr('side/fill',    side);
    shape.attr('cornerV1/fill', side);
    shape.attr('cornerV2/fill', side);
    shape.attr('backArc/fill', side);

    const strokeSels = isTubeDuct
        ? ['body', 'frontEllipse', 'backArc', 'outline', 'frontFace']
        : ['top', 'front', 'frontLeft', 'frontBottom', 'frontRight', 'side',
           'base', 'baseIso',
           'cornerV1', 'cornerV2', 'cornerV3', 'cornerV4', 'cornerV5', 'cornerV6',
           'lines'];
    for (const sel of strokeSels) {
        shape.attr(`${sel}/stroke`, stroke);
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
    // Detect ComplexComponent by the presence of a `layers` array attribute —
    // the regular IsometricShape never sets that. A Shape with multi-Layer
    // OR single-Layer-multi-Icon is rendered through ComplexComponentView,
    // which manages dimensions/icons via its own change:layers handler.
    // applyRegistryDefaults's single-layer path would clobber that setup, so
    // we stop after Shape-level concerns (label, rotation) for those cells.
    const isComplexComponent = Array.isArray(shape.get('layers'));
    const onlyLayer = isComplexComponent ? undefined : defaults.layers?.[0];

    // ── Shape-level: label & rotation ────────────────────────────────────────
    if (defaults.defaultRotation) shape.set('shapeRotation', defaults.defaultRotation);
    if (defaults.simplified2D !== undefined) shape.set('simplified2D', defaults.simplified2D);
    if (defaults.displayName && !(shape.get('meta') as { name?: string } | undefined)?.name?.trim()) {
        shape.attr('label/text', defaults.displayName);
    }
    // Default label position: centred horizontally, just below the footprint.
    // The per-shape SVG templates ship with text-anchor="left" + x=calc(w+10)
    // (a top-right-of-shape anchor) — overwrite those here so every placed
    // component lands at bottom-middle regardless of which shape SVG it uses.
    shape.attr('label/textAnchor', 'middle');
    shape.attr('label/textVerticalAnchor', 'top');
    shape.attr('label/x', 'calc(w/2)');
    shape.attr('label/y', 'calc(h + 6)');

    if (isComplexComponent) return;

    // ── Single-Layer: the lone Layer IS the Shape. Apply its dimensions,
    //    style, and icon to the JointJS shape directly.
    if (onlyLayer) {
        shape.resize(onlyLayer.width, onlyLayer.height);
        shape.set('isometricHeight', onlyLayer.depth);
        if (onlyLayer.cornerRadius != null) shape.set('cornerRadius', onlyLayer.cornerRadius);
        if (onlyLayer.chamferSize != null) shape.set('chamferSize', onlyLayer.chamferSize);
        if (onlyLayer.chamferStart != null) shape.set('chamferStart', onlyLayer.chamferStart);
        if (onlyLayer.normalizedVerts) shape.set('normalizedVerts', onlyLayer.normalizedVerts);
        if (onlyLayer.twist != null) shape.set('twist', onlyLayer.twist);
        if (onlyLayer.scaleTopX != null) shape.set('scaleTopX', onlyLayer.scaleTopX);
        if (onlyLayer.scaleTopY != null) shape.set('scaleTopY', onlyLayer.scaleTopY);
        if (onlyLayer.style) applyShapeStyle(shape, onlyLayer.style);
    }

    // ── Icon: the Shape's representative IconEntry (CONTEXT.md: isMain).
    const icon = getPaletteIcon(defaults);
    if (icon?.href && onlyLayer) {
        const iconPx = (icon.size ?? 1) * GRID_SIZE;
        const w = onlyLayer.width;
        const h = onlyLayer.height;
        const iH = onlyLayer.depth;
        // 2D view always renders the icon at the default cell size, centered
        // in the shape bounds — no frame, regardless of the iso footprint.
        const icon2DPx = SHAPE_CELL_SIZE;
        const x2D = (w - icon2DPx) / 2;
        const y2D = (h - icon2DPx) / 2;

        let topIconAttrs: Record<string, unknown>;
        if (icon.face === 'front') {
            const localX = (w - iconPx) / 2;
            const localY = (iH - iconPx) / 2;
            const cx = localX + iconPx / 2;
            const cy = localY + iconPx / 2;
            topIconAttrs = {
                href:      icon.href,
                x:         localX,
                y:         localY,
                width:     iconPx,
                height:    iconPx,
                transform: `matrix(1,0,1,1,${-iH},${h - iH})`,
            };
        } else if (icon.face === 'side') {
            const localX = (h - iconPx) / 2;
            const localY = (iH - iconPx) / 2;
            const cx = localX + iconPx / 2;
            const cy = localY + iconPx / 2;
            topIconAttrs = {
                href:      icon.href,
                x:         localX,
                y:         localY,
                width:     iconPx,
                height:    iconPx,
                transform: `matrix(0,1,-1,-1,${w},0) rotate(180,${cx},${cy})`,
            };
        } else {
            topIconAttrs = {
                href:      icon.href,
                x:         -iH + (w - iconPx) / 2,
                y:         -iH + (h - iconPx) / 2,
                width:     iconPx,
                height:    iconPx,
                transform: null,
            };
        }

        shape.set('effectiveIconFace', icon.face ?? 'top');
        shape.attr({
            topIcon:   topIconAttrs,
            topIcon2D: { href: icon2DHref(icon), x: x2D, y: y2D, width: icon2DPx, height: icon2DPx },
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
