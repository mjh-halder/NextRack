// Icon rendering — single source of truth for recognition surfaces.
//
// Across the app there are several places that show a catalog icon outside
// the actual canvas: component-tree leaves (CD palette + SD palette + SD
// element tree), the icon picker grid in the Component Designer popup, and
// the icons list preview in that same popup. Each of these used to have its
// own ad-hoc logic for "is this a vendor icon, should we filter it, should
// we apply monochrome, should we add a colored tile" — with subtle drift
// between the sites that produced fragile rendering.
//
// This module collapses that logic into one function. The rules:
//
//   - Vendor icons (AWS / Azure / GCP) and uploaded icons render in their
//     ORIGINAL colors. The CSS class `nr-icon-color` opts the rendered SVG
//     out of the default `filter: brightness(0)` tint. The icon's own SVG
//     content (including any branded backplate it contains, e.g. the AWS
//     orange tile) is what the user sees.
//
//   - Carbon and custom icons are line art designed to be tinted. They get
//     no special class — the default `filter: brightness(0)` (plus
//     `invert(1)` in dark mode) themes them automatically.
//
//   - The per-IconEntry `monochrome` flag is IGNORED on every recognition
//     surface. It is purely a rendering choice for the baked icon on a
//     shape (handled by `applyIconToCurrentShape` for the Component
//     Designer canvas and by the spawn / re-bake paths in the System
//     Designer). On lists/trees/pickers, the user always sees the icon as
//     itself.
//
// Canvas baking is NOT handled by this module — that path produces
// composite SVGs with per-face transforms and is genuinely different work.
// It lives in `applyIconToCurrentShape` and the System Designer's
// `applyRegistryDefaults` path.

import { getIconById } from './icon-catalog';
import { resolveIconRender } from './icon-resolver';
import type { IconEntry } from './shapes/shape-registry';

export type IconSurface = 'tree' | 'picker' | 'list' | 'palette';

export interface IconRenderResult {
    /** SVG markup to inject via `element.innerHTML`. */
    html: string;
    /** CSS class modifier to add to the container (e.g. `nr-icon-color`).
     *  Empty string when no modifier applies. */
    cssClass: string;
}

/** A bare IconEntry shell carrying only `iconId` — enough for recognition
 *  surfaces since the resolver ignores all per-entry overrides there. */
function bareEntry(iconId: string): IconEntry {
    return {
        id: '', iconId,
        face: 'top',
        size: 1, offsetX: 0, offsetY: 0,
        skewX: 0, skewY: 0,
        bgEnabled: false, bgColor: '', bgShape: 'square',
        bgSize: 1, bgRadius: 0, bgChamfer: 0.18,
        monochrome: false, adaptive: false,
    };
}

/**
 * Resolve how a catalog icon should appear on a recognition surface.
 * Returns `null` if the iconId is empty or unknown.
 *
 * All real decisions (vendor-original vs theme-mono) are delegated to the
 * central resolver in `icon-resolver.ts`. This wrapper exists only to map
 * the resolver's structured output to the recognition-surface API
 * (`{ html, cssClass }`).
 */
export function renderIcon(iconId: string | null | undefined, _surface: IconSurface): IconRenderResult | null {
    if (!iconId) return null;
    const entry = getIconById(iconId);
    if (!entry || !entry.svg) return null;
    // Mode is irrelevant for recognition output (the CSS filter switches it)
    // — but we still need to pass one. 'light' is fine: glyphTint either
    // resolves to 'original' (→ nr-icon-color class) or to theme-mono
    // (→ no class, default CSS filter handles theming).
    const decision = resolveIconRender(bareEntry(iconId), 'recognition', 'light');
    if (!decision) return null;
    return {
        html: decision.glyphSvg,
        cssClass: decision.keepOriginalColor ? 'nr-icon-color' : '',
    };
}
