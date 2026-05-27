// Central icon-render resolver.
//
// Every surface that paints a catalog icon (recognition trees/pickers, the 2D
// shape cell, the isometric face composite) routes through `resolveIconRender`
// here so the family/surface/theme/user-override matrix is decided in exactly
// one place. Family-level policy lives in `icon-rendering.ts`
// (`ICON_FAMILY_POLICIES`); admin-tunable per-vendor 2D knobs live in
// `BAKED_VENDOR_RENDER_SETTINGS`. This file just composes them.

import { getIconById, freshenVendorSvgIds, type IconCatalogEntry } from './icon-catalog';
import type { IconEntry } from './shapes/shape-registry';
import {
    ICON_FAMILY_POLICIES,
    familyForSource,
    vendorForSource,
    getIconRenderSettings,
    type IconSurface,
    type BgShape,
} from './icon-rendering';

export type { IconSurface } from './icon-rendering';
export type IconMode = 'light' | 'dark';

export interface IconRenderBackground {
    color: string;
    /** 'none' is never returned — null means "no background". */
    shape: Exclude<BgShape, 'none'>;
    radius: number;
    /** Octagon chamfer fraction (0..1). Only meaningful when shape === 'octagon'. */
    chamfer: number;
    /** 0..100. Always 100 for forced 2D backgrounds (2D ignores user opacity). */
    opacity: number;
}

export interface IconRenderDecision {
    /** SVG markup ready to embed (ID-freshened for vendors, mono-converted for AWS+mono). */
    glyphSvg: string;
    /**
     * How to tint the glyph:
     *  - 'original' → keep the SVG's own colours. Recognition surfaces add the
     *    `nr-icon-color` CSS class; 2D/ISO bypass the feColorMatrix tint.
     *  - hex string → uniform tint via feColorMatrix (2D/ISO). Recognition
     *    falls back to its CSS filter since per-entry overrides don't apply there.
     */
    glyphTint: 'original' | string;
    /** Background plate behind the glyph. null = no background. */
    background: IconRenderBackground | null;
    /** Whether `nr-icon-color` should be applied (recognition only). Derived from glyphTint. */
    keepOriginalColor: boolean;
}

/**
 * Resolve how a single IconEntry should be rendered on a given surface.
 *
 * Returns null only when both the icon AND the background are empty — i.e.
 * there is literally nothing to draw. Callers can use that as a "skip" signal.
 */
export function resolveIconRender(
    ie: IconEntry,
    surface: IconSurface,
    mode: IconMode,
): IconRenderDecision | null {
    const cat: IconCatalogEntry | undefined = ie.iconId ? getIconById(ie.iconId) : undefined;
    const hasGlyph = !!cat?.svg;
    const wantsBg = surface === 'isoFace' && !!ie.bgEnabled;
    if (!hasGlyph && !wantsBg) return null;

    const family = familyForSource(cat?.source);
    const policy = ICON_FAMILY_POLICIES[family];

    // ── Glyph SVG ─────────────────────────────────────────────────────────────
    const wantMono = surface === 'isoFace' && policy.supportsMonochrome && !!ie.monochrome;
    const sourceSvg = wantMono
        ? (cat?.svgMono ?? cat?.svg ?? '')
        : (cat?.svg ?? '');
    const glyphSvg = sourceSvg ? freshenVendorSvgIds(sourceSvg) : '';

    // ── Glyph tint ────────────────────────────────────────────────────────────
    // theme-mono follows the recognition CSS filter convention (brightness(0)
    // [+ invert(1) in dark]): black on light, white on dark.
    const themeMono = mode === 'dark' ? '#ffffff' : '#000000';
    let glyphTint: 'original' | string;
    if (surface === 'recognition') {
        // CONTEXT.md: recognition surfaces show the type-glyph, never the
        // styled IconEntry. No user overrides apply — family default only.
        glyphTint = policy.defaultTint.recognition === 'theme-mono' ? themeMono : 'original';
    } else if (wantMono) {
        // AWS+monochrome on ISO behaves like a Carbon glyph: theme-driven mono.
        glyphTint = themeMono;
    } else if (policy.supportsUserIconColor && ie.iconColor) {
        glyphTint = ie.iconColor;
    } else if (policy.defaultTint[surface] === 'theme-mono') {
        glyphTint = themeMono;
    } else {
        glyphTint = 'original';
    }

    // ── Background ────────────────────────────────────────────────────────────
    let background: IconRenderBackground | null = null;
    if (surface === 'isoFace') {
        if (policy.supportsIsoBackground && ie.bgEnabled) {
            background = {
                color:   ie.bgColor,
                shape:   ie.bgShape,
                radius:  ie.bgRadius,
                chamfer: ie.bgChamfer,
                opacity: ie.bgOpacity ?? 100,
            };
        }
    } else if (surface === 'grid2d') {
        // 2D ignores per-IconEntry bg fields entirely. The only 2D bg is the
        // forced family plate (currently: GCP's #f4f4f4 from vendor settings).
        if (policy.usesVendor2DBackground) {
            const v = getIconRenderSettings(vendorForSource(cat?.source), mode);
            if (v.bgColor && v.bgShape !== 'none') {
                const shape: Exclude<BgShape, 'none'> =
                    v.bgShape === 'octagon' ? 'octagon'
                    : v.bgShape === 'circle' ? 'circle'
                    : 'square';
                background = {
                    color:   v.bgColor,
                    shape,
                    radius:  v.bgRadius,
                    chamfer: 0.18,
                    opacity: 100, // 2D never honors user opacity, forced or otherwise
                };
            }
        }
    }
    // Recognition: background is always null.

    return {
        glyphSvg,
        glyphTint,
        background,
        keepOriginalColor: glyphTint === 'original',
    };
}
