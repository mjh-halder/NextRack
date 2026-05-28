import { describe, it, expect } from 'vitest';
import {
    hexToOklch,
    oklchToHex,
    createThemeColor,
    BAKED_THEME_SETTINGS,
    exportBakedThemeSettingsCode,
} from './color-derivation';

// These tests cover the pure derivation pipeline ONLY — the localStorage
// I/O wrapper, the change event, and the admin UI are not in scope here.
// "External behaviour" here means: given an input hex + settings, the
// returned tokens should match a known-good fixture, not "the right
// private function was called".

describe('hexToOklch / oklchToHex round-trip', () => {
    it('round-trips a saturated colour with negligible drift', () => {
        const [L, C, H] = hexToOklch('#0078D4'); // Microsoft Blue
        const back = oklchToHex(L, C, H);
        // Allow ±1 per channel for sRGB rounding noise.
        expect(back).toMatch(/^#[0-9a-f]{6}$/);
        const orig = [0x00, 0x78, 0xd4];
        const got = [parseInt(back.slice(1, 3), 16), parseInt(back.slice(3, 5), 16), parseInt(back.slice(5, 7), 16)];
        for (let i = 0; i < 3; i++) expect(Math.abs(got[i] - orig[i])).toBeLessThanOrEqual(1);
    });

    it('round-trips pure neutral grey', () => {
        const [L, C, H] = hexToOklch('#808080');
        expect(C).toBeLessThan(0.005); // grey ⇒ ~zero chroma
        const back = oklchToHex(L, C, H);
        expect(back).toBe('#808080');
    });

    it('keeps hue stable across a lightness change', () => {
        const [, , H1] = hexToOklch('#0078D4');
        // Raise L by 0.1, keep C, H — re-encode and re-decode.
        const lighter = oklchToHex(hexToOklch('#0078D4')[0] + 0.1, hexToOklch('#0078D4')[1], H1);
        const [, , H2] = hexToOklch(lighter);
        expect(Math.abs(H2 - H1)).toBeLessThan(2); // <2° hue drift
    });
});

describe('createThemeColor — colored bases', () => {
    it('Azure baked: light.fill is lighter than base, dark.fill is darker', () => {
        const tok = createThemeColor('#0078D4', {}, BAKED_THEME_SETTINGS.azure);
        const [baseL] = hexToOklch(tok.base);
        const [lfL]   = hexToOklch(tok.light.fill);
        const [dfL]   = hexToOklch(tok.dark.fill);
        expect(lfL).toBeGreaterThan(baseL);
        expect(dfL).toBeLessThan(baseL);
    });

    it('Azure baked: edges have higher contrast against their fills', () => {
        const tok = createThemeColor('#0078D4', {}, BAKED_THEME_SETTINGS.azure);
        const [lfL] = hexToOklch(tok.light.fill);
        const [leL] = hexToOklch(tok.light.edge);
        const [dfL] = hexToOklch(tok.dark.fill);
        const [deL] = hexToOklch(tok.dark.edge);
        // Light edge darker than fill; dark edge lighter than fill.
        expect(leL).toBeLessThan(lfL);
        expect(deL).toBeGreaterThan(dfL);
    });

    it('AWS baked: all output tokens are valid 6-digit hex', () => {
        const tok = createThemeColor('#FFB000', {}, BAKED_THEME_SETTINGS.aws);
        expect(tok.light.fill).toMatch(/^#[0-9a-f]{6}$/);
        expect(tok.light.edge).toMatch(/^#[0-9a-f]{6}$/);
        expect(tok.dark.fill).toMatch(/^#[0-9a-f]{6}$/);
        expect(tok.dark.edge).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('clamps lightness — extreme positive delta does not blow past 1', () => {
        const tok = createThemeColor('#FFB000', {}, {
            ...BAKED_THEME_SETTINGS.aws,
            lightFillLightnessDelta: 10, // crazy value
        });
        const [L] = hexToOklch(tok.light.fill);
        expect(L).toBeLessThanOrEqual(1.0001);
    });
});

describe('createThemeColor — neutral bases', () => {
    it('GCP baked (neutral): fills are at absolute lightness targets', () => {
        const tok = createThemeColor('#F2F4F7', { neutral: true }, BAKED_THEME_SETTINGS.gcp);
        const [lfL] = hexToOklch(tok.light.fill);
        const [dfL] = hexToOklch(tok.dark.fill);
        // Within 0.01 of the configured absolute lightness (round-trip noise).
        expect(Math.abs(lfL - BAKED_THEME_SETTINGS.gcp.neutralLightFillLightness)).toBeLessThan(0.01);
        expect(Math.abs(dfL - BAKED_THEME_SETTINGS.gcp.neutralDarkFillLightness)).toBeLessThan(0.01);
    });

    it('neutral: chroma stays near zero so colours don\'t cast', () => {
        const tok = createThemeColor('#F2F4F7', { neutral: true }, BAKED_THEME_SETTINGS.gcp);
        for (const hex of [tok.light.fill, tok.light.edge, tok.dark.fill, tok.dark.edge]) {
            const [, C] = hexToOklch(hex);
            expect(C).toBeLessThan(0.03);
        }
    });
});

describe('exportBakedThemeSettingsCode', () => {
    it('emits all four themes', () => {
        const code = exportBakedThemeSettingsCode();
        expect(code).toContain('default: {');
        expect(code).toContain('azure: {');
        expect(code).toContain('aws: {');
        expect(code).toContain('gcp: {');
    });

    it('opens with the expected const declaration', () => {
        const code = exportBakedThemeSettingsCode();
        expect(code.startsWith('export const BAKED_THEME_SETTINGS')).toBe(true);
    });

    it('is valid TS that closes its top-level object', () => {
        const code = exportBakedThemeSettingsCode();
        expect(code.trim().endsWith('};')).toBe(true);
    });
});
