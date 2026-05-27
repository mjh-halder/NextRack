// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the icon-catalog so we can feed the resolver synthetic catalog entries
// without going through localStorage / IndexedDB.
vi.mock('./icon-catalog', () => {
    const entries: Record<string, { id: string; label: string; svg: string; svgMono?: string; source: string }> = {};
    return {
        getIconById: (id: string) => entries[id],
        freshenVendorSvgIds: (svg: string) => svg, // identity in tests
        __setCatalog: (e: typeof entries) => {
            for (const k of Object.keys(entries)) delete entries[k];
            Object.assign(entries, e);
        },
    };
});

import * as catalogMock from './icon-catalog';
import { resolveIconRender, type IconMode } from './icon-resolver';
import type { IconSurface } from './icon-rendering';
import type { IconEntry } from './shapes/shape-registry';

const setCatalog = (catalogMock as unknown as { __setCatalog: (e: Record<string, { id: string; label: string; svg: string; svgMono?: string; source: string }>) => void }).__setCatalog;

function ie(overrides: Partial<IconEntry> = {}): IconEntry {
    return {
        id: 'e1',
        iconId: 'i1',
        face: 'top',
        size: 4,
        offsetX: 0, offsetY: 0,
        skewX: 0, skewY: 0,
        bgEnabled: false,
        bgColor: '#000000',
        bgShape: 'square',
        bgSize: 4,
        bgRadius: 0,
        bgChamfer: 0.18,
        monochrome: false,
        adaptive: false,
        ...overrides,
    };
}

const SVG_CARBON   = '<svg>carbon</svg>';
const SVG_AWS      = '<svg>aws-color</svg>';
const SVG_AWS_MONO = '<svg>aws-mono</svg>';
const SVG_AZURE    = '<svg>azure</svg>';
const SVG_GCP      = '<svg>gcp</svg>';
const SVG_UPLOAD   = '<svg>upload</svg>';

beforeEach(() => {
    setCatalog({
        carbon:   { id: 'carbon',   label: 'C', svg: SVG_CARBON,                     source: 'carbon' },
        custom:   { id: 'custom',   label: 'X', svg: SVG_CARBON,                     source: 'custom' },
        aws:      { id: 'aws',      label: 'A', svg: SVG_AWS, svgMono: SVG_AWS_MONO, source: 'aws' },
        azure:    { id: 'azure',    label: 'Z', svg: SVG_AZURE,                      source: 'azure' },
        gcp:      { id: 'gcp',      label: 'G', svg: SVG_GCP,                        source: 'gcp' },
        uploaded: { id: 'uploaded', label: 'U', svg: SVG_UPLOAD,                     source: 'uploaded' },
    });
});

type Case = {
    name: string;
    iconId: string;
    surface: IconSurface;
    mode: IconMode;
    extra?: Partial<IconEntry>;
    expect: { tint: 'original' | string; bg: 'none' | string; svg?: string };
};

const baseCases: Case[] = [
    // ── Carbon (line-art) ──────────────────────────────────────────────────
    { name: 'carbon recognition light → theme-mono black, no bg',
      iconId: 'carbon', surface: 'recognition', mode: 'light',
      expect: { tint: '#000000', bg: 'none' } },
    { name: 'carbon recognition dark → theme-mono white, no bg',
      iconId: 'carbon', surface: 'recognition', mode: 'dark',
      expect: { tint: '#ffffff', bg: 'none' } },
    { name: 'carbon grid2d light → black, no bg',
      iconId: 'carbon', surface: 'grid2d', mode: 'light',
      expect: { tint: '#000000', bg: 'none' } },
    { name: 'carbon grid2d dark → white, no bg',
      iconId: 'carbon', surface: 'grid2d', mode: 'dark',
      expect: { tint: '#ffffff', bg: 'none' } },
    { name: 'carbon isoFace light → black, no bg (bgEnabled off)',
      iconId: 'carbon', surface: 'isoFace', mode: 'light',
      expect: { tint: '#000000', bg: 'none' } },
    { name: 'carbon isoFace dark + user bg → white + user bg',
      iconId: 'carbon', surface: 'isoFace', mode: 'dark',
      extra: { bgEnabled: true, bgColor: '#222222', bgOpacity: 60 },
      expect: { tint: '#ffffff', bg: '#222222' } },

    // ── AWS (vendor colour, optional mono on ISO) ──────────────────────────
    { name: 'aws recognition light → original',
      iconId: 'aws', surface: 'recognition', mode: 'light',
      expect: { tint: 'original', bg: 'none', svg: SVG_AWS } },
    { name: 'aws recognition + monochrome=true → ignored, still original',
      iconId: 'aws', surface: 'recognition', mode: 'light',
      extra: { monochrome: true },
      expect: { tint: 'original', bg: 'none', svg: SVG_AWS } },
    { name: 'aws grid2d light → original (ignores monochrome)',
      iconId: 'aws', surface: 'grid2d', mode: 'dark',
      extra: { monochrome: true },
      expect: { tint: 'original', bg: 'none', svg: SVG_AWS } },
    { name: 'aws isoFace mono light → theme-mono black + svgMono',
      iconId: 'aws', surface: 'isoFace', mode: 'light',
      extra: { monochrome: true },
      expect: { tint: '#000000', bg: 'none', svg: SVG_AWS_MONO } },
    { name: 'aws isoFace mono dark → theme-mono white + svgMono',
      iconId: 'aws', surface: 'isoFace', mode: 'dark',
      extra: { monochrome: true },
      expect: { tint: '#ffffff', bg: 'none', svg: SVG_AWS_MONO } },
    { name: 'aws isoFace mono + iconColor user override → user override IGNORED for AWS',
      iconId: 'aws', surface: 'isoFace', mode: 'light',
      extra: { monochrome: true, iconColor: '#ff0000' },
      expect: { tint: '#000000', bg: 'none', svg: SVG_AWS_MONO } },
    { name: 'aws isoFace non-mono → original colors',
      iconId: 'aws', surface: 'isoFace', mode: 'dark',
      expect: { tint: 'original', bg: 'none', svg: SVG_AWS } },

    // ── Azure (locked) ─────────────────────────────────────────────────────
    { name: 'azure recognition → original',
      iconId: 'azure', surface: 'recognition', mode: 'light',
      expect: { tint: 'original', bg: 'none' } },
    { name: 'azure grid2d → original, no bg',
      iconId: 'azure', surface: 'grid2d', mode: 'dark',
      expect: { tint: 'original', bg: 'none' } },
    { name: 'azure isoFace → original, no user-bg accepted',
      iconId: 'azure', surface: 'isoFace', mode: 'dark',
      extra: { bgEnabled: true, bgColor: '#ff00ff', iconColor: '#ff0000', monochrome: true },
      expect: { tint: 'original', bg: 'none' } },

    // ── GCP (forced 2D bg, original everywhere else) ───────────────────────
    { name: 'gcp recognition → original, no bg',
      iconId: 'gcp', surface: 'recognition', mode: 'light',
      expect: { tint: 'original', bg: 'none' } },
    { name: 'gcp grid2d light → original + forced #f4f4f4',
      iconId: 'gcp', surface: 'grid2d', mode: 'light',
      expect: { tint: 'original', bg: '#f4f4f4' } },
    { name: 'gcp grid2d dark → original + forced #f4f4f4',
      iconId: 'gcp', surface: 'grid2d', mode: 'dark',
      expect: { tint: 'original', bg: '#f4f4f4' } },
    { name: 'gcp isoFace, no user bg → original, no bg',
      iconId: 'gcp', surface: 'isoFace', mode: 'light',
      expect: { tint: 'original', bg: 'none' } },
    { name: 'gcp isoFace, user bg on → original + user bg',
      iconId: 'gcp', surface: 'isoFace', mode: 'light',
      extra: { bgEnabled: true, bgColor: '#abcdef' },
      expect: { tint: 'original', bg: '#abcdef' } },

    // ── Uploaded (original + supports iconColor + supports iso bg) ────────
    { name: 'uploaded recognition → original',
      iconId: 'uploaded', surface: 'recognition', mode: 'light',
      expect: { tint: 'original', bg: 'none' } },
    { name: 'uploaded grid2d → original, no bg',
      iconId: 'uploaded', surface: 'grid2d', mode: 'light',
      expect: { tint: 'original', bg: 'none' } },
    { name: 'uploaded grid2d + iconColor → user tint',
      iconId: 'uploaded', surface: 'grid2d', mode: 'light',
      extra: { iconColor: '#ff8800' },
      expect: { tint: '#ff8800', bg: 'none' } },
    { name: 'uploaded isoFace + user bg → original + user bg',
      iconId: 'uploaded', surface: 'isoFace', mode: 'dark',
      extra: { bgEnabled: true, bgColor: '#112233', bgOpacity: 50 },
      expect: { tint: 'original', bg: '#112233' } },

    // ── Custom (line-art, mapped to carbon family) ─────────────────────────
    { name: 'custom grid2d dark → theme-mono white',
      iconId: 'custom', surface: 'grid2d', mode: 'dark',
      expect: { tint: '#ffffff', bg: 'none' } },
    { name: 'custom isoFace + iconColor → user tint',
      iconId: 'custom', surface: 'isoFace', mode: 'light',
      extra: { iconColor: '#33cc99' },
      expect: { tint: '#33cc99', bg: 'none' } },

    // ── Recognition ignores ALL per-entry overrides ───────────────────────
    { name: 'carbon recognition + iconColor → IGNORED, theme-mono wins',
      iconId: 'carbon', surface: 'recognition', mode: 'light',
      extra: { iconColor: '#ff00ff' },
      expect: { tint: '#000000', bg: 'none' } },
    { name: 'uploaded recognition + iconColor → IGNORED, original wins',
      iconId: 'uploaded', surface: 'recognition', mode: 'dark',
      extra: { iconColor: '#ff00ff' },
      expect: { tint: 'original', bg: 'none' } },
];

describe('resolveIconRender — family/surface/mode/override matrix', () => {
    for (const c of baseCases) {
        it(c.name, () => {
            const d = resolveIconRender(ie({ iconId: c.iconId, ...(c.extra ?? {}) }), c.surface, c.mode);
            expect(d).not.toBeNull();
            expect(d!.glyphTint).toBe(c.expect.tint);
            if (c.expect.bg === 'none') {
                expect(d!.background).toBeNull();
            } else {
                expect(d!.background?.color).toBe(c.expect.bg);
            }
            if (c.expect.svg) expect(d!.glyphSvg).toBe(c.expect.svg);
            expect(d!.keepOriginalColor).toBe(c.expect.tint === 'original');
        });
    }

    it('returns null when no glyph and no background', () => {
        expect(resolveIconRender(ie({ iconId: '' }), 'isoFace', 'light')).toBeNull();
    });

    it('returns a decision for background-only on isoFace (no glyph)', () => {
        const d = resolveIconRender(
            ie({ iconId: '', bgEnabled: true, bgColor: '#aabbcc' }),
            'isoFace',
            'light',
        );
        expect(d).not.toBeNull();
        expect(d!.glyphSvg).toBe('');
        expect(d!.background?.color).toBe('#aabbcc');
    });

    it('2D ignores user bgOpacity (always 100 for forced bg)', () => {
        const d = resolveIconRender(
            ie({ iconId: 'gcp', bgOpacity: 30 }),
            'grid2d',
            'light',
        );
        expect(d!.background?.opacity).toBe(100);
    });

    it('isoFace honors user bgOpacity', () => {
        const d = resolveIconRender(
            ie({ iconId: 'carbon', bgEnabled: true, bgColor: '#123456', bgOpacity: 40 }),
            'isoFace',
            'light',
        );
        expect(d!.background?.opacity).toBe(40);
    });
});
