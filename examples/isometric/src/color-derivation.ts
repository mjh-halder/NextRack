/**
 * Central theme colour derivation. Every vendor / semantic colour is defined
 * by ONE base hex; the four shape-rendering tokens (light.fill, light.edge,
 * dark.fill, dark.edge) are derived from it via OKLCH so the hue / character
 * of the colour stays stable across the operations.
 *
 * Tunable per-theme via the admin Color Adjustment UI — every theme owns its
 * own `ColorDerivationSettings`. What the rest of the app consumes is the
 * RESULT (the four hex tokens) via `shape-capabilities.getThemeColors(theme)`.
 */

// ── OKLCH math (inline, no dependency) ─────────────────────────────────────
// Reference: Björn Ottosson, "A perceptual color space for image processing"
// (https://bottosson.github.io/posts/oklab/).

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return [
        parseInt(full.slice(0, 2), 16) / 255,
        parseInt(full.slice(2, 4), 16) / 255,
        parseInt(full.slice(4, 6), 16) / 255,
    ];
}

function rgbToHex(r: number, g: number, b: number): string {
    const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
}

function srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function linRgbToOklab(r: number, g: number, b: number): [number, number, number] {
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ];
}

function oklabToLinRgb(L: number, a: number, b: number): [number, number, number] {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
}

export function hexToOklch(hex: string): [number, number, number] {
    const rgb = hexToRgb(hex);
    const [r, g, b] = [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
    const [L, a, bb] = linRgbToOklab(r, g, b);
    const C = Math.sqrt(a * a + bb * bb);
    let H = (Math.atan2(bb, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return [L, C, H];
}

export function oklchToHex(L: number, C: number, H: number): string {
    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);
    const lin = oklabToLinRgb(L, a, b);
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    return rgbToHex(
        linearToSrgb(clamp01(lin[0])),
        linearToSrgb(clamp01(lin[1])),
        linearToSrgb(clamp01(lin[2])),
    );
}

const clampL = (L: number) => Math.max(0, Math.min(1, L));

// ── Settings ───────────────────────────────────────────────────────────────

export interface ColorDerivationSettings {
    lightFillLightnessDelta: number;
    darkFillLightnessDelta: number;
    lightEdgeLightnessDelta: number;
    darkEdgeLightnessDelta: number;
    lightChromaMultiplier: number;
    darkChromaMultiplier: number;
    neutralLightFillLightness: number;
    neutralDarkFillLightness: number;
    neutralLightEdgeDelta: number;
    neutralDarkEdgeDelta: number;
}

/** Keys we support per-theme tuning for. */
export type TunableTheme = 'default' | 'azure' | 'aws' | 'gcp';
export const TUNABLE_THEMES: TunableTheme[] = ['default', 'azure', 'aws', 'gcp'];

/**
 * BAKED PER-THEME DEFAULTS — committed values that ship with the app.
 *
 * The admin Color Adjustment tool is an internal developer tool: it auto-
 * saves to localStorage for live iteration (browser-local only) AND offers
 * an "Export as code defaults" button that prints a new version of this
 * block. To bake the current tuning into the app, paste the export back
 * here and commit. New browsers / new users will see the baked defaults
 * until they tweak the sliders themselves.
 */
export const BAKED_THEME_SETTINGS: Record<TunableTheme, ColorDerivationSettings> = {
    default: {
        lightFillLightnessDelta:   0.180,
        darkFillLightnessDelta:   -0.180,
        lightEdgeLightnessDelta:  -0.120,
        darkEdgeLightnessDelta:    0.120,
        lightChromaMultiplier:     0.900,
        darkChromaMultiplier:      0.700,
        neutralLightFillLightness: 0.800,
        neutralDarkFillLightness:  0.500,
        neutralLightEdgeDelta:    -0.150,
        neutralDarkEdgeDelta:      -0.150,
    },
    azure: {
        lightFillLightnessDelta:   0.300,
        darkFillLightnessDelta:   -0.150,
        lightEdgeLightnessDelta:  -0.150,
        darkEdgeLightnessDelta:    -0.100,
        lightChromaMultiplier:     0.150,
        darkChromaMultiplier:      0.200,
        neutralLightFillLightness: 0.900,
        neutralDarkFillLightness:  0.320,
        neutralLightEdgeDelta:    -0.200,
        neutralDarkEdgeDelta:      0.150,
    },
    aws: {
        lightFillLightnessDelta:   0.000,
        darkFillLightnessDelta:   -0.350,
        lightEdgeLightnessDelta:  -0.150,
        darkEdgeLightnessDelta:    -0.150,
        lightChromaMultiplier:     0.050,
        darkChromaMultiplier:      0.050,
        neutralLightFillLightness: 0.900,
        neutralDarkFillLightness:  0.320,
        neutralLightEdgeDelta:    -0.200,
        neutralDarkEdgeDelta:      0.150,
    },
    gcp: {
        lightFillLightnessDelta:   0.180,
        darkFillLightnessDelta:   -0.180,
        lightEdgeLightnessDelta:  -0.120,
        darkEdgeLightnessDelta:    0.120,
        lightChromaMultiplier:     0.900,
        darkChromaMultiplier:      0.700,
        neutralLightFillLightness: 0.850,
        neutralDarkFillLightness:  0.700,
        neutralLightEdgeDelta:    -0.150,
        neutralDarkEdgeDelta:      -0.100,
    },
};

/** @deprecated Use BAKED_THEME_SETTINGS[theme] instead. Kept for backward compat. */
export const DEFAULT_DERIVATION_SETTINGS: ColorDerivationSettings = BAKED_THEME_SETTINGS.default;

const STORAGE_KEY_PREFIX = 'nr-color-derivation-v2-';
const _settingsByTheme = new Map<TunableTheme, ColorDerivationSettings>();

function loadFor(theme: TunableTheme): ColorDerivationSettings {
    const baked = BAKED_THEME_SETTINGS[theme];
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PREFIX + theme) : null;
        if (!raw) return { ...baked };
        return { ...baked, ...JSON.parse(raw) };
    } catch { return { ...baked }; }
}

export function getDerivationSettings(theme: TunableTheme): ColorDerivationSettings {
    if (!_settingsByTheme.has(theme)) _settingsByTheme.set(theme, loadFor(theme));
    return _settingsByTheme.get(theme)!;
}

export function setDerivationSettings(theme: TunableTheme, patch: Partial<ColorDerivationSettings>): void {
    const next = { ...getDerivationSettings(theme), ...patch };
    _settingsByTheme.set(theme, next);
    try { localStorage.setItem(STORAGE_KEY_PREFIX + theme, JSON.stringify(next)); } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nr-color-derivation-change'));
    }
}

export function resetDerivationSettings(theme: TunableTheme): void {
    _settingsByTheme.set(theme, { ...BAKED_THEME_SETTINGS[theme] });
    try { localStorage.removeItem(STORAGE_KEY_PREFIX + theme); } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nr-color-derivation-change'));
    }
}

/** True iff the per-theme settings have been tweaked vs. the baked defaults. */
export function isDirty(theme: TunableTheme): boolean {
    const baked = BAKED_THEME_SETTINGS[theme];
    const live = getDerivationSettings(theme);
    return (Object.keys(baked) as Array<keyof ColorDerivationSettings>).some(k => baked[k] !== live[k]);
}

/**
 * Format the current per-theme settings as the TS literal to paste into
 * `BAKED_THEME_SETTINGS` in this file — that's how a developer commits a
 * new baseline.
 */
export function exportBakedThemeSettingsCode(): string {
    const fmt = (n: number) => n.toFixed(3);
    const themeBlock = (t: TunableTheme): string => {
        const s = getDerivationSettings(t);
        return [
            `    ${t}: {`,
            `        lightFillLightnessDelta:   ${fmt(s.lightFillLightnessDelta)},`,
            `        darkFillLightnessDelta:   ${fmt(s.darkFillLightnessDelta)},`,
            `        lightEdgeLightnessDelta:  ${fmt(s.lightEdgeLightnessDelta)},`,
            `        darkEdgeLightnessDelta:    ${fmt(s.darkEdgeLightnessDelta)},`,
            `        lightChromaMultiplier:     ${fmt(s.lightChromaMultiplier)},`,
            `        darkChromaMultiplier:      ${fmt(s.darkChromaMultiplier)},`,
            `        neutralLightFillLightness: ${fmt(s.neutralLightFillLightness)},`,
            `        neutralDarkFillLightness:  ${fmt(s.neutralDarkFillLightness)},`,
            `        neutralLightEdgeDelta:    ${fmt(s.neutralLightEdgeDelta)},`,
            `        neutralDarkEdgeDelta:      ${fmt(s.neutralDarkEdgeDelta)},`,
            `    },`,
        ].join('\n');
    };
    return [
        'export const BAKED_THEME_SETTINGS: Record<TunableTheme, ColorDerivationSettings> = {',
        ...TUNABLE_THEMES.map(themeBlock),
        '};',
    ].join('\n');
}

// ── Isometric face shading ─────────────────────────────────────────────────
//
// Light-from-above convention: from a single base hex we derive three OKLCH-
// shifted tones for the top / side / front faces, so isometric shapes read
// as three-dimensional instead of flat. Hue/chroma stay stable; only L is
// shifted, which preserves the colour character.

const FACE_SHADING_DELTAS = {
    top:   +0.10,
    side:   0.00,
    front: -0.10,
};

export interface FaceShades {
    top: string;
    side: string;
    front: string;
}

export function deriveFaceShades(baseHex: string): FaceShades {
    const [L, C, H] = hexToOklch(baseHex);
    return {
        top:   oklchToHex(clampL(L + FACE_SHADING_DELTAS.top),   C, H),
        side:  oklchToHex(clampL(L + FACE_SHADING_DELTAS.side),  C, H),
        front: oklchToHex(clampL(L + FACE_SHADING_DELTAS.front), C, H),
    };
}

// ── Theme colour token ─────────────────────────────────────────────────────

export interface ThemeColorToken {
    base: string;
    light: { fill: string; edge: string };
    dark:  { fill: string; edge: string };
}

export interface CreateThemeColorOptions {
    neutral?: boolean;
}

export function createThemeColor(
    base: string,
    opts: CreateThemeColorOptions = {},
    settings: ColorDerivationSettings = DEFAULT_DERIVATION_SETTINGS,
): ThemeColorToken {
    const s = settings;
    const [L, C, H] = hexToOklch(base);

    if (opts.neutral) {
        const lf = clampL(s.neutralLightFillLightness);
        const le = clampL(lf + s.neutralLightEdgeDelta);
        const df = clampL(s.neutralDarkFillLightness);
        const de = clampL(df + s.neutralDarkEdgeDelta);
        const tinyC = Math.min(C, 0.02);
        return {
            base,
            light: { fill: oklchToHex(lf, tinyC, H), edge: oklchToHex(le, tinyC, H) },
            dark:  { fill: oklchToHex(df, tinyC, H), edge: oklchToHex(de, tinyC, H) },
        };
    }

    const lf = clampL(L + s.lightFillLightnessDelta);
    const le = clampL(lf + s.lightEdgeLightnessDelta);
    const df = clampL(L + s.darkFillLightnessDelta);
    const de = clampL(df + s.darkEdgeLightnessDelta);
    const lC = Math.max(0, C * s.lightChromaMultiplier);
    const dC = Math.max(0, C * s.darkChromaMultiplier);
    return {
        base,
        light: { fill: oklchToHex(lf, lC, H), edge: oklchToHex(le, lC, H) },
        dark:  { fill: oklchToHex(df, dC, H), edge: oklchToHex(de, dC, H) },
    };
}
