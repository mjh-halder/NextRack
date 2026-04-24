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

import { CARBON_ICONS } from './carbon-icons-all';

export type IconSource = 'custom' | 'carbon' | 'uploaded' | 'aws';

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

const CARBON_ENTRIES: ReadonlyArray<IconCatalogEntry> = CARBON_ICONS.map(ic => ({
    id:     ic.id,     // already namespaced 'carbon:<name>'
    label:  ic.label,
    svg:    ic.svg,
    source: 'carbon' as const,
}));

const STATIC_CATALOG: ReadonlyArray<IconCatalogEntry> = [...CUSTOM_ICONS, ...CARBON_ENTRIES];

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

// ── AWS icons (persisted in localStorage) ────────────────────────────────────

const AWS_STORAGE_KEY = 'nr-aws-icons-v1';

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

    // Remove transparent/empty background rects (common AWS pattern)
    el.querySelectorAll('rect').forEach(r => {
        const id = (r.getAttribute('id') || '').toLowerCase();
        const dn = (r.getAttribute('data-name') || '').toLowerCase();
        const style = r.getAttribute('style') || '';
        const fill = r.getAttribute('fill') || '';
        const isFillNone = style.includes('fill') && style.includes('none') || fill === 'none';
        const isFullSize = (r.getAttribute('width') === '80' && r.getAttribute('height') === '80') ||
                           (r.getAttribute('width') === '48' && r.getAttribute('height') === '48') ||
                           (r.getAttribute('width') === '32' && r.getAttribute('height') === '32');
        if (id.includes('transparent') || dn.includes('transparent') ||
            (isFillNone && isFullSize)) {
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

function readAwsIcons(): StoredAwsIcon[] {
    try {
        const raw = localStorage.getItem(AWS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeAwsIcons(icons: StoredAwsIcon[]): void {
    try {
        localStorage.setItem(AWS_STORAGE_KEY, JSON.stringify(icons));
    } catch (e) {
        console.error('[nextrack] Failed to save AWS icons:', e);
    }
}

export function addAwsIcons(entries: Array<{ label: string; svg: string }>): number {
    const stored = readAwsIcons();
    const existing = new Set(stored.map(s => s.label));
    let added = 0;
    for (const e of entries) {
        if (existing.has(e.label)) continue;
        stored.push({ id: `aws:${e.label}`, label: e.label, svg: e.svg });
        added++;
    }
    writeAwsIcons(stored);
    rebuildCatalog();
    return added;
}

export function removeAllAwsIcons(): number {
    const count = readAwsIcons().length;
    writeAwsIcons([]);
    rebuildCatalog();
    return count;
}

export function getAwsIconCount(): number {
    return readAwsIcons().length;
}

// ── Catalog rebuild ──────────────────────────────────────────────────────────

type CatalogListener = () => void;
const catalogListeners = new Set<CatalogListener>();

function rebuildCatalog(): void {
    const uploaded: IconCatalogEntry[] = readUploadedIcons().map(u => ({
        id: u.id,
        label: u.label,
        svg: u.svg,
        source: 'uploaded' as const,
    }));
    const aws: IconCatalogEntry[] = readAwsIcons().map(a => ({
        id: a.id,
        label: a.label,
        svg: sanitizeAwsSvg(a.svg),
        source: 'aws' as const,
        bgColor: a.bgColor || extractAwsBgColor(a.svg) || undefined,
    }));
    ICON_CATALOG.length = 0;
    ICON_CATALOG.push(...STATIC_CATALOG, ...uploaded, ...aws);
    ICON_BY_ID.clear();
    for (const i of ICON_CATALOG) ICON_BY_ID.set(i.id, i);
    catalogListeners.forEach(l => l());
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

export function getIconById(id: string): IconCatalogEntry | undefined {
    return ICON_BY_ID.get(id);
}
