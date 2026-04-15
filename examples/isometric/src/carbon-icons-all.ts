// Eagerly load every 32 px Carbon icon from @carbon/icons/es via webpack's
// require.context. This pulls the entire icon set into the bundle (Option A:
// user-chosen). Each module default-exports a CarbonIcon descriptor that we
// render once to an SVG string for cheap downstream reuse.

import { carbonIconToString, CarbonIcon } from './icons';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = (require as any).context('@carbon/icons/es', true, /\/32\.js$/);

export interface CarbonIconEntry {
    id: string;     // namespaced catalog id, e.g. 'carbon:server--rack'
    name: string;   // raw Carbon name, e.g. 'server--rack'
    label: string;  // friendly label for UI
    svg: string;    // pre-rendered SVG string
}

export const CARBON_ID_PREFIX = 'carbon:';

function formatLabel(name: string): string {
    return name
        .replace(/--/g, ' ')
        .replace(/-/g, ' ')
        .split(' ')
        .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
        .trim();
}

function loadAll(): CarbonIconEntry[] {
    const out: CarbonIconEntry[] = [];
    const keys: string[] = ctx.keys();
    for (const key of keys) {
        const match = key.match(/^\.\/(.+)\/32\.js$/);
        if (!match) continue;
        const name = match[1];
        const mod = ctx(key);
        const icon: CarbonIcon = mod && mod.default ? mod.default : mod;
        if (!icon || !icon.elem) continue;
        out.push({
            id:    CARBON_ID_PREFIX + name,
            name,
            label: formatLabel(name),
            svg:   carbonIconToString(icon),
        });
    }
    // Stable alphabetical order by label for predictable search/scroll behaviour.
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

export const CARBON_ICONS: ReadonlyArray<CarbonIconEntry> = loadAll();
