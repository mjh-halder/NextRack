/**
 * 2D icon rendering settings — per (vendor × mode) knobs that drive how the
 * icon is composed in the 2D view of the System Designer and Component
 * Designer. Both designers funnel through `icon2DHref` in utils.ts which
 * reads from here, so changing values in the admin tool updates every cell
 * instantly via the `nr-icon-rendering-change` event.
 *
 * The mental model is symmetric to color-derivation.ts:
 *   - `BAKED_VENDOR_RENDER_SETTINGS` ships compiled-in defaults.
 *   - The admin Icon Rendering panel persists user tweaks to localStorage.
 *   - `exportBakedIconRenderingCode()` emits a TS snippet you paste back
 *     into this file to promote the current tuning to a new baseline.
 */

export type IconVendor = 'carbon' | 'aws' | 'azure' | 'gcp';
export const ICON_VENDORS: IconVendor[] = ['carbon', 'aws', 'azure', 'gcp'];

export type IconMode = 'light' | 'dark';
export const ICON_MODES: IconMode[] = ['light', 'dark'];

/** How the icon body itself is tinted before compositing. */
export type IconTint =
    | 'original'      // keep the SVG's own colours
    | 'black'         // force to #000000 via feColorMatrix
    | 'white'         // force to #ffffff via feColorMatrix
    | string;         // hex literal — anything starting with '#'

export type BgShape = 'square' | 'circle' | 'octagon' | 'none';

export interface IconRenderSettings {
    /** Tint applied to the glyph paths. 'original' bypasses the filter. */
    iconTint: IconTint;
    /** Background fill colour — empty string means "no background". */
    bgColor: string;
    /** Shape of the background plate (when bgColor is set). */
    bgShape: BgShape;
    /** Corner radius in px for `square` backgrounds. */
    bgRadius: number;
    /**
     * Strip the vendor-shipped background panel from the source SVG before
     * compositing. Designed for AWS icons; harmless when no panel exists.
     */
    stripVendorBackground: boolean;
    /**
     * Linear scale applied to the icon image inside the 40×40 cell.
     * 1.0 = exact fit, >1 = bleeds past the cell (clipped by the wrapper).
     * Used to recover icons whose source SVG has internal padding.
     */
    oversize: number;
}

/**
 * BAKED PER-VENDOR DEFAULTS — committed values that ship with the app.
 * Mirrors color-derivation.ts: tweak them via the admin Icon Rendering
 * panel, hit "Export as code defaults", paste the snippet back here, commit.
 */
export const BAKED_VENDOR_RENDER_SETTINGS: Record<IconVendor, Record<IconMode, IconRenderSettings>> = {
    carbon: {
        light: { iconTint: 'original', bgColor: '',        bgShape: 'square', bgRadius: 0,  stripVendorBackground: false, oversize: 1.00 },
        dark:  { iconTint: 'white',    bgColor: '',        bgShape: 'square', bgRadius: 0,  stripVendorBackground: false, oversize: 1.00 },
    },
    aws: {
        light: { iconTint: 'original', bgColor: '',        bgShape: 'square', bgRadius: 0,  stripVendorBackground: false, oversize: 1.20 },
        dark:  { iconTint: 'original', bgColor: '',        bgShape: 'square', bgRadius: 4,  stripVendorBackground: false, oversize: 1.30 },
    },
    azure: {
        light: { iconTint: 'original', bgColor: '',        bgShape: 'square', bgRadius: 0,  stripVendorBackground: false, oversize: 1.00 },
        dark:  { iconTint: 'original', bgColor: '',        bgShape: 'square', bgRadius: 0,  stripVendorBackground: false, oversize: 1.00 },
    },
    gcp: {
        light: { iconTint: 'original', bgColor: '#f4f4f4', bgShape: 'square', bgRadius: 1.6, stripVendorBackground: false, oversize: 1.00 },
        dark:  { iconTint: 'original', bgColor: '#f4f4f4', bgShape: 'square', bgRadius: 2,   stripVendorBackground: false, oversize: 1.00 },
    },
};

// ── Live settings (localStorage-backed) ───────────────────────────────────

const STORAGE_KEY = 'nr-icon-rendering-v1';

type StoredShape = Partial<Record<IconVendor, Partial<Record<IconMode, Partial<IconRenderSettings>>>>>;

function readStore(): StoredShape {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        return raw ? (JSON.parse(raw) as StoredShape) : {};
    } catch {
        return {};
    }
}

function writeStore(store: StoredShape): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nr-icon-rendering-change'));
    }
}

export function getIconRenderSettings(vendor: IconVendor, mode: IconMode): IconRenderSettings {
    const baked = BAKED_VENDOR_RENDER_SETTINGS[vendor][mode];
    const store = readStore();
    const patch = store[vendor]?.[mode] ?? {};
    return { ...baked, ...patch };
}

export function setIconRenderSettings(vendor: IconVendor, mode: IconMode, patch: Partial<IconRenderSettings>): void {
    const store = readStore();
    if (!store[vendor]) store[vendor] = {};
    store[vendor]![mode] = { ...(store[vendor]![mode] ?? {}), ...patch };
    writeStore(store);
}

export function resetIconRenderSettings(vendor: IconVendor, mode?: IconMode): void {
    const store = readStore();
    if (!store[vendor]) return;
    if (mode) {
        delete store[vendor]![mode];
    } else {
        delete store[vendor];
    }
    writeStore(store);
}

export function isIconRenderingDirty(vendor: IconVendor, mode: IconMode): boolean {
    const baked = BAKED_VENDOR_RENDER_SETTINGS[vendor][mode];
    const live = getIconRenderSettings(vendor, mode);
    return (Object.keys(baked) as Array<keyof IconRenderSettings>).some(k => baked[k] !== live[k]);
}

/**
 * Format the current per-vendor settings as the TS literal to paste into
 * `BAKED_VENDOR_RENDER_SETTINGS` in this file.
 */
export function exportBakedIconRenderingCode(): string {
    const fmtStr = (s: string) => JSON.stringify(s);
    const fmtNum = (n: number) => n.toFixed(2);
    const fmtBool = (b: boolean) => (b ? 'true' : 'false');
    const modeBlock = (vendor: IconVendor, mode: IconMode): string => {
        const s = getIconRenderSettings(vendor, mode);
        return `        ${mode}: { iconTint: ${fmtStr(s.iconTint)}, bgColor: ${fmtStr(s.bgColor)}, bgShape: ${fmtStr(s.bgShape)}, bgRadius: ${s.bgRadius}, stripVendorBackground: ${fmtBool(s.stripVendorBackground)}, oversize: ${fmtNum(s.oversize)} },`;
    };
    const vendorBlock = (vendor: IconVendor): string => [
        `    ${vendor}: {`,
        modeBlock(vendor, 'light'),
        modeBlock(vendor, 'dark'),
        '    },',
    ].join('\n');
    return [
        'export const BAKED_VENDOR_RENDER_SETTINGS: Record<IconVendor, Record<IconMode, IconRenderSettings>> = {',
        ...ICON_VENDORS.map(vendorBlock),
        '};',
    ].join('\n');
}

/**
 * Map a catalog `IconSource` to the configurable vendor bucket. Sources that
 * don't have their own bucket (custom, design, uploaded) inherit Carbon's
 * mono treatment because they're line art designed to be tinted.
 */
export function vendorForSource(source: string | undefined | null): IconVendor {
    if (source === 'aws' || source === 'azure' || source === 'gcp') return source;
    return 'carbon';
}

// ── Icon Family policies ──────────────────────────────────────────────────────
//
// The Family is the semantic bucket the resolver uses. It is broader than
// `IconVendor` (which only drives admin-tunable 2D render settings): it pairs
// every catalog source with a Policy declaring which user-overrides apply on
// which surface. Edited rarely — change behaviour here, not at render sites.

export type IconFamily = 'carbon' | 'aws' | 'azure' | 'gcp' | 'uploaded' | 'design';

export type IconTintMode = 'original' | 'theme-mono';

export type IconSurface = 'recognition' | 'grid2d' | 'isoFace';

export interface IconFamilyPolicy {
    /** Default glyph tint per surface when no user override applies. */
    defaultTint: Record<IconSurface, IconTintMode>;
    /**
     * When true, the 2D resolver reads `getIconRenderSettings(vendor, mode).bgColor`
     * and uses it as a forced background (e.g. GCP's #f4f4f4 plate). The
     * per-IconEntry bg fields stay ignored in 2D regardless.
     */
    usesVendor2DBackground: boolean;
    /** Honors `IconEntry.monochrome` on isoFace. AWS only today. */
    supportsMonochrome: boolean;
    /** Honors per-IconEntry bgEnabled/bgColor/bgOpacity on isoFace. */
    supportsIsoBackground: boolean;
    /** Honors per-IconEntry iconColor as a tint override. */
    supportsUserIconColor: boolean;
}

export const ICON_FAMILY_POLICIES: Record<IconFamily, IconFamilyPolicy> = {
    carbon: {
        defaultTint: { recognition: 'theme-mono', grid2d: 'theme-mono', isoFace: 'theme-mono' },
        usesVendor2DBackground: false,
        supportsMonochrome: false, // carbon IS mono by nature; no toggle needed
        supportsIsoBackground: true,
        supportsUserIconColor: true,
    },
    aws: {
        defaultTint: { recognition: 'original', grid2d: 'original', isoFace: 'original' },
        usesVendor2DBackground: false,
        supportsMonochrome: true,
        supportsIsoBackground: true,
        supportsUserIconColor: false, // tinting AWS originals is not a product mode; mono is
    },
    azure: {
        defaultTint: { recognition: 'original', grid2d: 'original', isoFace: 'original' },
        usesVendor2DBackground: false,
        supportsMonochrome: false,
        supportsIsoBackground: false,
        supportsUserIconColor: false,
    },
    gcp: {
        defaultTint: { recognition: 'original', grid2d: 'original', isoFace: 'original' },
        usesVendor2DBackground: true, // the #f4f4f4 plate lives in BAKED_VENDOR_RENDER_SETTINGS.gcp
        supportsMonochrome: false,
        supportsIsoBackground: true,
        supportsUserIconColor: false,
    },
    uploaded: {
        defaultTint: { recognition: 'original', grid2d: 'original', isoFace: 'original' },
        usesVendor2DBackground: false,
        supportsMonochrome: false,
        supportsIsoBackground: true,
        supportsUserIconColor: true,
    },
    // Design Icons: bundled + admin-imported monochrome SVGs for the System
    // Designer Icon element. Treated like Carbon — theme-tinted everywhere so
    // black source SVGs render dark in light mode and light in dark mode.
    design: {
        defaultTint: { recognition: 'theme-mono', grid2d: 'theme-mono', isoFace: 'theme-mono' },
        usesVendor2DBackground: false,
        supportsMonochrome: false,
        supportsIsoBackground: true,
        supportsUserIconColor: true,
    },
};

export function familyForSource(source: string | undefined | null): IconFamily {
    switch (source) {
        case 'aws':      return 'aws';
        case 'azure':    return 'azure';
        case 'gcp':      return 'gcp';
        case 'uploaded': return 'uploaded';
        case 'design':   return 'design';
        case 'carbon':
        case 'custom':
        default:         return 'carbon';
    }
}
