// Single source of truth for all icons selectable in the Component Designer.
// Custom project assets are merged with the full @carbon/icons set so the
// Admin > Icon Configuration view can offer both pools from one catalog.

import cubeIconSvg from '../assets/cube-icon.svg';
import routerIconSvg from '../assets/router-icon.svg';
import switchIconSvg from '../assets/switch-icon.svg';
import k8sControlNodeIconSvg from '../assets/kubernetesControlNode-logo.svg';
import k8sWorkerNodeIconSvg from '../assets/kubernetesWorkerNode-logo.svg';
import virtualInstanceIconSvg from '../assets/virtualinstance-logo.svg';
import serverDnsSvg from '../assets/server--dns.svg';
import pipelinesSvg from '../assets/pipelines.svg';
import boxSvg from '../assets/box.svg';
import securitySvg from '../assets/security (1).svg';
import mediaLibrarySvg from '../assets/media--library--filled.svg';
import licenseSvg from '../assets/license.svg';
import apiSvg from '../assets/API--1.svg';
import sapSvg from '../assets/SAP.svg';
import vmwareSvg from '../assets/logo--vmware.svg';
import ansibleSvg from '../assets/logo--red-hat-ansible.svg';
import reactSvg from '../assets/logo--react.svg';
import pythonSvg from '../assets/logo--python.svg';
import openshiftSvg from '../assets/logo--openshift.svg';
import kubernetesSvg from '../assets/logo--kubernetes.svg';
import gitSvg from '../assets/logo--git.svg';
import virtualMachineSvg from '../assets/virtual-machine.svg';
import databaseSvg from '../assets/data--base.svg';
import objectStorageSvg from '../assets/object-storage.svg';
import bareMetalServerSvg from '../assets/ibm-cloud--bare-metal-server.svg';
import tuningSvg from '../assets/tuning.svg';
import aiAgentSvg from '../assets/ai-agent-invocation.svg';
import cubeSvg from '../assets/cube.svg';
import k8sControlPlaneSvg from '../assets/kubernetes--control-plane-node.svg';
import instanceVirtualSvg from '../assets/instance--virtual.svg';
import k8sWorkerNodeSvg from '../assets/kubernetes--worker-node.svg';

import { getCarbonIcons } from './carbon-icons-all';

export type IconSource = 'custom' | 'carbon' | 'uploaded' | 'aws' | 'gcp' | 'azure';

export interface IconCatalogEntry {
    id: string;
    label: string;
    svg: string;
    source: IconSource;
    bgColor?: string;
}

const CUSTOM_ICONS: ReadonlyArray<IconCatalogEntry> = [
    // Generic
    { id: 'cube',                  label: 'Cube',                  svg: cubeIconSvg,            source: 'custom' },
    { id: 'cube-alt',              label: 'Cube (alt)',            svg: cubeSvg,                source: 'custom' },
    { id: 'box',                   label: 'Box',                   svg: boxSvg,                 source: 'custom' },
    { id: 'license',               label: 'License',               svg: licenseSvg,             source: 'custom' },
    { id: 'tuning',                label: 'Tuning',                svg: tuningSvg,              source: 'custom' },
    { id: 'media-library',         label: 'Media Library',         svg: mediaLibrarySvg,        source: 'custom' },
    { id: 'pipelines',             label: 'Pipelines',             svg: pipelinesSvg,           source: 'custom' },
    { id: 'ai-agent',              label: 'AI Agent',              svg: aiAgentSvg,             source: 'custom' },
    // Network & Security
    { id: 'router',                label: 'Router',                svg: routerIconSvg,          source: 'custom' },
    { id: 'switch',                label: 'Switch',                svg: switchIconSvg,          source: 'custom' },
    { id: 'server-dns',            label: 'DNS Server',            svg: serverDnsSvg,           source: 'custom' },
    { id: 'security',              label: 'Security',              svg: securitySvg,            source: 'custom' },
    { id: 'api',                   label: 'API',                   svg: apiSvg,                 source: 'custom' },
    // Compute & Storage
    { id: 'virtual-machine',       label: 'Virtual Machine',       svg: virtualMachineSvg,      source: 'custom' },
    { id: 'instance-virtual',      label: 'Instance',              svg: instanceVirtualSvg,     source: 'custom' },
    { id: 'virtual-instance',      label: 'Virtual Instance',      svg: virtualInstanceIconSvg, source: 'custom' },
    { id: 'bare-metal-server',     label: 'Bare Metal Server',     svg: bareMetalServerSvg,     source: 'custom' },
    { id: 'database',              label: 'Database',              svg: databaseSvg,            source: 'custom' },
    { id: 'object-storage',        label: 'Object Storage',        svg: objectStorageSvg,       source: 'custom' },
    // Kubernetes
    { id: 'k8s-control-node',      label: 'K8s Control Node',      svg: k8sControlNodeIconSvg,  source: 'custom' },
    { id: 'k8s-control-plane',     label: 'K8s Control Plane',     svg: k8sControlPlaneSvg,     source: 'custom' },
    { id: 'k8s-worker-node',       label: 'K8s Worker Node',       svg: k8sWorkerNodeIconSvg,   source: 'custom' },
    { id: 'k8s-worker-node-alt',   label: 'K8s Worker (alt)',      svg: k8sWorkerNodeSvg,       source: 'custom' },
    { id: 'kubernetes',            label: 'Kubernetes',            svg: kubernetesSvg,          source: 'custom' },
    { id: 'openshift',             label: 'OpenShift',             svg: openshiftSvg,           source: 'custom' },
    // Platforms & Tools
    { id: 'vmware',                label: 'VMware',                svg: vmwareSvg,              source: 'custom' },
    { id: 'ansible',               label: 'Ansible',               svg: ansibleSvg,             source: 'custom' },
    { id: 'python',                label: 'Python',                svg: pythonSvg,              source: 'custom' },
    { id: 'react',                 label: 'React',                 svg: reactSvg,               source: 'custom' },
    { id: 'git',                   label: 'Git',                   svg: gitSvg,                 source: 'custom' },
    { id: 'sap',                   label: 'SAP',                   svg: sapSvg,                 source: 'custom' },
];

let carbonEntriesCache: IconCatalogEntry[] | null = null;

function getCarbonEntries(): ReadonlyArray<IconCatalogEntry> {
    if (!carbonEntriesCache) {
        carbonEntriesCache = getCarbonIcons().map(ic => ({
            id:     ic.id,
            label:  ic.label,
            svg:    ic.svg,
            source: 'carbon' as const,
        }));
    }
    return carbonEntriesCache;
}

const STATIC_CATALOG: ReadonlyArray<IconCatalogEntry> = [...CUSTOM_ICONS];

// ── Uploaded icons (persisted in localStorage) ────────────────────────────────

const UPLOADED_STORAGE_KEY = 'nr-uploaded-icons-v1';

interface StoredUploadedIcon {
    id: string;
    label: string;
    svg: string;
}

function readUploadedIcons(): StoredUploadedIcon[] {
    try {
        const raw = localStorage.getItem(UPLOADED_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeUploadedIcons(icons: StoredUploadedIcon[]): void {
    try {
        localStorage.setItem(UPLOADED_STORAGE_KEY, JSON.stringify(icons));
    } catch (e) {
        console.error('[nextrack] Failed to save uploaded icons:', e);
    }
}

// ── SVG minification for storage ─────────────────────────────────────────────

function minifySvg(svg: string): string {
    return svg
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s*([=])\s*/g, '$1')
        .trim();
}

// ── IndexedDB vendor icon storage ────────────────────────────────────────────
// localStorage has a ~5-10MB limit which is too small for large icon packs.
// IndexedDB has no practical limit and works synchronously via a warm cache.

const IDB_NAME = 'nextrack-icons';
const IDB_VERSION = 1;
const IDB_STORE = 'vendor-icons';

interface VendorIconRecord {
    id: string;
    label: string;
    svg: string;
    source: string;
    bgColor?: string;
}

let idbCache: Map<string, VendorIconRecord[]> = new Map();
let idbReady = false;

function openIdb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbLoadAll(): Promise<void> {
    try {
        const db = await openIdb();
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const all: VendorIconRecord[] = await new Promise((res, rej) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
        db.close();
        idbCache.clear();
        for (const rec of all) {
            const list = idbCache.get(rec.source) ?? [];
            list.push(rec);
            idbCache.set(rec.source, list);
        }
        // Migrate from localStorage if present
        for (const [key, source] of [['nr-aws-icons-v1', 'aws'], ['nr-gcp-icons-v1', 'gcp'], ['nr-azure-icons-v1', 'azure']] as const) {
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw) as Array<{ id: string; label: string; svg: string; bgColor?: string }>;
                    if (parsed.length > 0 && !(idbCache.get(source)?.length)) {
                        await idbWriteSource(source, parsed.map(p => ({ ...p, source })));
                        idbCache.set(source, parsed.map(p => ({ ...p, source })));
                    }
                    localStorage.removeItem(key);
                } catch { /* ignore migration errors */ }
            }
        }
        idbReady = true;
    } catch (e) {
        console.error('[nextrack] IndexedDB load failed, falling back to empty cache:', e);
        idbReady = true;
    }
}

async function idbWriteSource(source: string, records: VendorIconRecord[]): Promise<boolean> {
    try {
        const db = await openIdb();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        // Delete existing records for this source
        const all: VendorIconRecord[] = await new Promise((res, rej) => {
            const req = store.getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
        });
        for (const rec of all) {
            if (rec.source === source) store.delete(rec.id);
        }
        for (const rec of records) store.put(rec);
        await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
        db.close();
        idbCache.set(source, records);
        return true;
    } catch (e) {
        console.error(`[nextrack] Failed to write ${source} icons to IndexedDB:`, e);
        return false;
    }
}

function readVendorIcons(source: string): VendorIconRecord[] {
    return idbCache.get(source) ?? [];
}

// ── Vendor icon public API (AWS / GCP / Azure) ──────────────────────────────

interface StoredAwsIcon {
    id: string;
    label: string;
    svg: string;
    bgColor?: string;
}

let awsSanitizeCounter = 0;

function sanitizeAwsSvg(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const el = doc.querySelector('svg');
    if (!el) return svg;

    // Namespace all IDs to avoid collisions when multiple SVGs are in the DOM.
    const prefix = `_aws${awsSanitizeCounter++}_`;
    const idMap = new Map<string, string>();
    el.querySelectorAll('[id]').forEach(node => {
        const old = node.getAttribute('id')!;
        const scoped = prefix + old;
        idMap.set(old, scoped);
        node.setAttribute('id', scoped);
    });
    if (idMap.size > 0) {
        const refRe = /url\(#([^)]+)\)/g;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
        let n: Node | null = walker.currentNode;
        while (n) {
            if (n instanceof Element) {
                for (const attr of Array.from(n.attributes)) {
                    if (attr.value.includes('url(#')) {
                        attr.value = attr.value.replace(refRe, (_m, id) => {
                            const mapped = idMap.get(id);
                            return mapped ? `url(#${mapped})` : `url(#${id})`;
                        });
                    }
                    if (attr.name === 'href' || attr.name === 'xlink:href') {
                        if (attr.value.startsWith('#') && idMap.has(attr.value.slice(1))) {
                            attr.value = '#' + idMap.get(attr.value.slice(1));
                        }
                    }
                }
            }
            n = walker.nextNode();
        }
    }

    // Inline all CSS rules from <style> blocks into the matching elements,
    // then remove the <style> blocks so they can't leak into the global page CSS.
    el.querySelectorAll('style').forEach(styleEl => {
        const text = styleEl.textContent ?? '';
        // Split into individual rules: "selectors { props }"
        const ruleRe = /([^{}]+)\{([^}]+)\}/g;
        let m: RegExpExecArray | null;
        while ((m = ruleRe.exec(text)) !== null) {
            const selectorGroup = m[1].trim();
            const props = m[2].trim();
            // Handle comma-separated selectors: ".cls-1, .cls-3"
            for (const sel of selectorGroup.split(',')) {
                const s = sel.trim();
                if (!s.startsWith('.')) continue;
                const cls = s.slice(1);
                el.querySelectorAll(`.${cls}`).forEach(target => {
                    const existing = target.getAttribute('style') || '';
                    target.setAttribute('style', existing + (existing ? ';' : '') + props);
                    target.classList.remove(cls);
                });
            }
        }
        styleEl.remove();
    });

    // Remove background rects (common AWS pattern: full-size rect as first child)
    el.querySelectorAll('rect').forEach(r => {
        const id = (r.getAttribute('id') || '').toLowerCase();
        const dn = (r.getAttribute('data-name') || '').toLowerCase();
        const w = r.getAttribute('width') || '';
        const h = r.getAttribute('height') || '';
        const isFullSize = (w === '80' && h === '80') ||
                           (w === '48' && h === '48') ||
                           (w === '32' && h === '32');
        if (id.includes('transparent') || dn.includes('transparent') || isFullSize) {
            r.remove();
        }
    });

    return new XMLSerializer().serializeToString(el);
}

/** Strips the large colored background from an AWS icon, leaving only the glyph paths. */
export function stripAwsBackground(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const el = doc.querySelector('svg');
    if (!el) return svg;
    const vb = el.getAttribute('viewBox');
    const vbMatch = vb?.match(/[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
    const svgW = vbMatch ? parseFloat(vbMatch[1]) : 80;
    const svgH = vbMatch ? parseFloat(vbMatch[2]) : 80;
    // Remove rects and paths that cover the full viewBox (the category background)
    el.querySelectorAll('rect, path').forEach(node => {
        if (node.tagName === 'rect') {
            const w = parseFloat(node.getAttribute('width') || '0');
            const h = parseFloat(node.getAttribute('height') || '0');
            if (w >= svgW && h >= svgH) node.remove();
        } else {
            const d = node.getAttribute('d') || '';
            // Simple heuristic: full-coverage paths like "M0,0H80V80H0Z"
            if (/^M\s*0[\s,]+0[\s,]*[HhVv]/.test(d) && d.length < 40) node.remove();
        }
    });
    return new XMLSerializer().serializeToString(el);
}

/** Extracts the background fill color from an AWS icon SVG (the large rect/path). */
export function extractAwsBgColor(svg: string): string | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const el = doc.querySelector('svg');
    if (!el) return null;

    // Build a class→fill map from <style> blocks
    const classColors: Record<string, string> = {};
    el.querySelectorAll('style').forEach(s => {
        const text = s.textContent ?? '';
        const re = /([^{}]+)\{([^}]+)\}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const fillMatch = m[2].match(/fill:\s*([^;}\s]+)/);
            if (!fillMatch) continue;
            for (const sel of m[1].split(',')) {
                const t = sel.trim();
                if (t.startsWith('.')) classColors[t.slice(1)] = fillMatch[1];
            }
        }
    });

    function luminance(hex: string): number {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    function resolveGradient(ref: string): string | null {
        const idMatch = ref.match(/url\(#([^)]+)\)/);
        if (!idMatch) return null;
        const grad = el.querySelector(`#${CSS.escape(idMatch[1])}`);
        if (!grad) return null;
        const stops = Array.from(grad.querySelectorAll('stop'));
        if (stops.length === 0) return null;
        let darkest: string | null = null;
        let darkestLum = 2;
        for (const stop of stops) {
            const c = stop.getAttribute('stop-color');
            if (!c || !c.startsWith('#') || c.length < 7) continue;
            const l = luminance(c);
            if (l < darkestLum) { darkestLum = l; darkest = c; }
        }
        return darkest;
    }

    function getFillFromElement(target: Element): string | null {
        const fill = target.getAttribute('fill');
        if (fill && fill !== 'none') {
            if (fill.startsWith('url(')) return resolveGradient(fill);
            return fill;
        }
        const style = target.getAttribute('style') || '';
        const sm = style.match(/fill:\s*([^;]+)/);
        if (sm) {
            const v = sm[1].trim();
            if (v !== 'none') return v.startsWith('url(') ? resolveGradient(v) : v;
        }
        const cls = target.getAttribute('class') || '';
        for (const c of cls.split(/\s+/)) {
            if (classColors[c] && classColors[c] !== 'none') return classColors[c];
        }
        return null;
    }

    function getFill(node: Element): string | null {
        const direct = getFillFromElement(node);
        if (direct) return direct;
        // Check parent <g> for inherited fill
        const parent = node.parentElement;
        if (parent && parent.tagName === 'g') return getFillFromElement(parent);
        return null;
    }

    const vb = el.getAttribute('viewBox');
    const vbMatch = vb?.match(/[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
    const svgW = vbMatch ? parseFloat(vbMatch[1]) : 80;
    const svgH = vbMatch ? parseFloat(vbMatch[2]) : 80;
    // Check rects and paths that cover the full viewBox
    for (const node of Array.from(el.querySelectorAll('rect, path'))) {
        if (node.tagName === 'rect') {
            const w = parseFloat(node.getAttribute('width') || '0');
            const h = parseFloat(node.getAttribute('height') || '0');
            if (w >= svgW * 0.9 && h >= svgH * 0.9) {
                const c = getFill(node);
                if (c) return c;
            }
        } else {
            const d = node.getAttribute('d') || '';
            if (/^M\s*0[\s,]+0[\s,]*[HhVv]/.test(d) && d.length < 40) {
                const c = getFill(node);
                if (c) return c;
            }
        }
    }
    // Fallback: first non-white, non-none fill found on any large element
    for (const node of Array.from(el.querySelectorAll('rect, path, polygon, circle'))) {
        const c = getFillFromElement(node);
        if (c && c !== '#fff' && c !== '#FFF' && c !== '#ffffff' && c !== '#FFFFFF' && c !== 'white') return c;
    }
    return null;
}

export async function addAwsIcons(entries: Array<{ label: string; svg: string }>): Promise<{ added: number; error?: string }> {
    const stored = readVendorIcons('aws');
    const existing = new Set(stored.map(s => s.label));
    let added = 0;
    for (const e of entries) {
        if (existing.has(e.label)) continue;
        stored.push({ id: `aws:${e.label}`, label: e.label, svg: minifySvg(e.svg), source: 'aws' });
        added++;
    }
    const ok = await idbWriteSource('aws', stored);
    if (!ok) return { added, error: 'Failed to save icons to database.' };
    rebuildCatalog();
    return { added };
}

export async function removeAllAwsIcons(): Promise<number> {
    const count = readVendorIcons('aws').length;
    await idbWriteSource('aws', []);
    rebuildCatalog();
    return count;
}

export function getAwsIconCount(): number {
    return readVendorIcons('aws').length;
}

export async function addGcpIcons(entries: Array<{ label: string; svg: string }>): Promise<{ added: number; error?: string }> {
    const stored = readVendorIcons('gcp');
    const existing = new Set(stored.map(s => s.label));
    let added = 0;
    for (const e of entries) {
        if (existing.has(e.label)) continue;
        stored.push({ id: `gcp:${e.label}`, label: e.label, svg: minifySvg(e.svg), source: 'gcp' });
        added++;
    }
    const ok = await idbWriteSource('gcp', stored);
    if (!ok) return { added, error: 'Failed to save icons to database.' };
    rebuildCatalog();
    return { added };
}

export async function removeAllGcpIcons(): Promise<number> {
    const count = readVendorIcons('gcp').length;
    await idbWriteSource('gcp', []);
    rebuildCatalog();
    return count;
}

export function getGcpIconCount(): number {
    return readVendorIcons('gcp').length;
}

export async function addAzureIcons(entries: Array<{ label: string; svg: string }>): Promise<{ added: number; error?: string }> {
    const stored = readVendorIcons('azure');
    const existing = new Set(stored.map(s => s.label));
    let added = 0;
    for (const e of entries) {
        if (existing.has(e.label)) continue;
        stored.push({ id: `azure:${e.label}`, label: e.label, svg: minifySvg(e.svg), source: 'azure' });
        added++;
    }
    const ok = await idbWriteSource('azure', stored);
    if (!ok) return { added, error: 'Failed to save icons to database.' };
    rebuildCatalog();
    return { added };
}

export async function removeAllAzureIcons(): Promise<number> {
    const count = readVendorIcons('azure').length;
    await idbWriteSource('azure', []);
    rebuildCatalog();
    return count;
}

export function getAzureIconCount(): number {
    return readVendorIcons('azure').length;
}

// ── Catalog rebuild ──────────────────────────────────────────────────────────

type CatalogListener = () => void;
const catalogListeners = new Set<CatalogListener>();

// Cache sanitized SVGs so we don't re-parse on every rebuild
const sanitizeCache = new Map<string, { svg: string; bgColor?: string }>();

function getSanitized(rec: VendorIconRecord): { svg: string; bgColor?: string } {
    let cached = sanitizeCache.get(rec.id);
    if (!cached) {
        const svg = sanitizeAwsSvg(rec.svg);
        const bgColor = rec.source === 'aws' ? (rec.bgColor || extractAwsBgColor(rec.svg) || undefined) : undefined;
        cached = { svg, bgColor };
        sanitizeCache.set(rec.id, cached);
    }
    return cached;
}

let fullCatalogBuilt = false;

function rebuildCatalog(): void {
    const uploaded: IconCatalogEntry[] = readUploadedIcons().map(u => ({
        id: u.id,
        label: u.label,
        svg: u.svg,
        source: 'uploaded' as const,
    }));

    // On first load: only sanitize icons that are actually used by shapes.
    // Full catalog is built lazily when the user opens the icon picker or admin.
    const usedIconIds = new Set<string>();
    try {
        const { ShapeRegistry } = require('./shapes/shape-registry');
        for (const def of Object.values(ShapeRegistry) as Array<{ icon?: string }>) {
            if (def.icon) usedIconIds.add(def.icon);
        }
    } catch { /* ignore if registry not loaded yet */ }

    // Also include icons from shapes stored in localStorage (user-created components)
    try {
        for (const key of ['nextrack-shapes-general-v1', 'nextrack-shapes-user-v1']) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const shapes = JSON.parse(raw) as Array<{ definition?: { icon?: string } }>;
            for (const s of shapes) {
                if (s.definition?.icon) usedIconIds.add(s.definition.icon);
            }
        }
    } catch { /* ignore */ }

    // If any used icon is not yet in STATIC_CATALOG or vendor cache, it may be a
    // Carbon icon.  Load the Carbon library so those shapes get their icons.
    if (!carbonEntriesCache && usedIconIds.size > 0) {
        const knownIds = new Set(STATIC_CATALOG.map(i => i.id));
        idbCache.forEach(records => { for (const r of records) knownIds.add(r.id); });
        let needCarbon = false;
        usedIconIds.forEach(id => { if (!knownIds.has(id)) needCarbon = true; });
        if (needCarbon) getCarbonEntries();
    }

    const vendorEntries: IconCatalogEntry[] = [];
    idbCache.forEach((records, source) => {
        for (const rec of records) {
            if (!fullCatalogBuilt && !usedIconIds.has(rec.id)) {
                // Defer: add a lightweight stub (label + id only, no SVG parsing)
                vendorEntries.push({
                    id: rec.id,
                    label: rec.label,
                    svg: '',
                    source: source as IconSource,
                });
                continue;
            }
            const { svg, bgColor } = getSanitized(rec);
            vendorEntries.push({
                id: rec.id,
                label: rec.label,
                svg,
                source: source as IconSource,
                bgColor,
            });
        }
    });

    ICON_CATALOG.length = 0;
    ICON_CATALOG.push(...STATIC_CATALOG, ...uploaded, ...vendorEntries);
    if (carbonEntriesCache) ICON_CATALOG.push(...carbonEntriesCache);
    ICON_BY_ID.clear();
    for (const i of ICON_CATALOG) ICON_BY_ID.set(i.id, i);
    catalogListeners.forEach(l => l());
}

/** Ensure all vendor icon SVGs are sanitized (fast). Call before opening the icon picker. */
export function ensureFullCatalog(): void {
    if (fullCatalogBuilt) return;
    fullCatalogBuilt = true;
    rebuildCatalog();
}

/** Load the full Carbon icon library into the catalog (slow, ~500ms). Call only when the user needs Carbon icons. */
export function ensureCarbonIcons(): void {
    if (carbonEntriesCache !== null) return;
    getCarbonEntries();
    rebuildCatalog();
}

export function addUploadedIcon(label: string, svg: string): string {
    const id = `uploaded:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stored = readUploadedIcons();
    stored.push({ id, label, svg });
    writeUploadedIcons(stored);
    rebuildCatalog();
    return id;
}

export function removeUploadedIcon(id: string): void {
    const stored = readUploadedIcons().filter(u => u.id !== id);
    writeUploadedIcons(stored);
    rebuildCatalog();
}

export function onCatalogChange(listener: CatalogListener): () => void {
    catalogListeners.add(listener);
    return () => catalogListeners.delete(listener);
}

// ── Public catalog + lookup ───────────────────────────────────────────────────

export const ICON_CATALOG: IconCatalogEntry[] = [];
const ICON_BY_ID: Map<string, IconCatalogEntry> = new Map();
rebuildCatalog();

// Auto-load IndexedDB vendor icons on module init — rebuilds catalog when ready
idbLoadAll().then(() => rebuildCatalog()).catch(() => {});

export function getIconById(id: string): IconCatalogEntry | undefined {
    const entry = ICON_BY_ID.get(id);
    if (entry && !entry.svg && !fullCatalogBuilt) {
        // Lazily resolve a deferred stub by rebuilding the full catalog
        fullCatalogBuilt = true;
        rebuildCatalog();
        return ICON_BY_ID.get(id);
    }
    return entry;
}
