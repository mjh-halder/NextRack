import { dia, shapes } from '@joint/core';
import { graph as systemGraph } from './system-designer';
import { listWorkloads } from './app-store';
import { listAssignments, assignWorkload, unassignWorkload } from './cluster-store';

let paper: dia.Paper | null = null;
let graph: dia.Graph | null = null;
let containerEl: HTMLDivElement | null = null;
let animFrameId: number | null = null;

const CLUSTER_WIDTH = 140;
const CLUSTER_HEIGHT = 60;
const WORKLOAD_WIDTH = 120;
const WORKLOAD_HEIGHT = 40;

export function initClusterView(container: HTMLDivElement): void {
    containerEl = container;
}

export function refreshClusterView(): void {
    if (!containerEl) return;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

    // Defer to next frame so container has computed dimensions
    requestAnimationFrame(() => {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const w = containerEl.clientWidth || 800;
        const h = containerEl.clientHeight || 600;

        graph = new dia.Graph({}, { cellNamespace: shapes });
        paper = new dia.Paper({
            el: containerEl,
            model: graph,
            width: w,
            height: h,
            gridSize: 1,
            async: false,
            interactive: { elementMove: true, linkMove: false, addLinkFromMagnet: false },
            defaultConnector: { name: 'smooth' },
            cellViewNamespace: shapes,
        });

        buildGraph();
        runForceLayout(300);

        paper.on('element:pointerup', (_cellView, evt) => {
            const el = _cellView.model;
            if (el.get('nodeType') !== 'workload') return;
            handleDrop(el, evt);
        });
    });
}

// ── Graph construction ──

function isDark(): boolean {
    return document.documentElement.classList.contains('cds--g100');
}

function buildGraph(): void {
    if (!graph) return;
    graph.clear();

    const frames = systemGraph.getCells().filter(c => c.get('isFrame'));
    const workloads = listWorkloads();
    const assignments = listAssignments();

    if (frames.length === 0 && workloads.length === 0) {
        if (containerEl) {
            const msg = document.createElement('div');
            msg.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-size:0.875rem;color:#525252;font-family:IBM Plex Sans,sans-serif;';
            msg.textContent = 'Create zones in System Designer and workloads in the Workload Designer to see them here.';
            containerEl.appendChild(msg);
        }
        return;
    }

    const dark = isDark();
    const cx = (containerEl?.clientWidth ?? 800) / 2;
    const cy = (containerEl?.clientHeight ?? 600) / 2;

    // Create cluster nodes
    for (const frame of frames) {
        const name = frame.attr('label/text') as string || 'Zone';
        const el = new shapes.standard.Rectangle({
            id: 'cluster-' + frame.id,
            size: { width: CLUSTER_WIDTH, height: CLUSTER_HEIGHT },
            position: { x: cx + (Math.random() - 0.5) * 200, y: cy + (Math.random() - 0.5) * 200 },
            attrs: {
                body: {
                    fill: dark ? '#262626' : '#f4f4f4',
                    stroke: '#0f62fe',
                    strokeWidth: 2,
                    rx: 6,
                    ry: 6,
                },
                label: {
                    text: name,
                    fontSize: 13,
                    fontWeight: '600',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    fill: dark ? '#f4f4f4' : '#161616',
                },
            },
        });
        el.set('nodeType', 'cluster');
        el.set('frameId', frame.id);
        graph.addCell(el);
    }

    // Create workload nodes
    for (const wl of workloads) {
        const el = new shapes.standard.Rectangle({
            id: 'workload-' + wl.id,
            size: { width: WORKLOAD_WIDTH, height: WORKLOAD_HEIGHT },
            position: { x: cx + (Math.random() - 0.5) * 400, y: cy + (Math.random() - 0.5) * 400 },
            attrs: {
                body: {
                    fill: dark ? '#393939' : '#e0e0e0',
                    stroke: dark ? '#525252' : '#c6c6c6',
                    strokeWidth: 1,
                    rx: 4,
                    ry: 4,
                },
                label: {
                    text: wl.name || 'Workload',
                    fontSize: 12,
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    fill: dark ? '#f4f4f4' : '#161616',
                },
            },
        });
        el.set('nodeType', 'workload');
        el.set('workloadId', wl.id);
        graph.addCell(el);
    }

    // Create assignment links
    for (const a of assignments) {
        const sourceId = 'workload-' + a.workloadId;
        const targetId = 'cluster-' + a.clusterId;
        if (!graph.getCell(sourceId) || !graph.getCell(targetId)) continue;

        const link = new shapes.standard.Link({
            source: { id: sourceId },
            target: { id: targetId },
            attrs: {
                line: {
                    stroke: '#8d8d8d',
                    strokeWidth: 1.5,
                    targetMarker: { type: 'path', d: '' },
                },
            },
        });
        graph.addCell(link);
    }
}

// ── Force-directed layout ──

interface NodeState {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fixed: boolean;
    width: number;
    height: number;
}

function runForceLayout(iterations: number): void {
    if (!graph || !containerEl) return;

    const elements = graph.getElements();
    const links = graph.getLinks();

    const cx = containerEl.clientWidth / 2;
    const cy = containerEl.clientHeight / 2;

    const nodes: NodeState[] = elements.map(el => {
        const pos = el.position();
        const size = el.size();
        return {
            id: el.id as string,
            x: pos.x + size.width / 2,
            y: pos.y + size.height / 2,
            vx: 0,
            vy: 0,
            fixed: false,
            width: size.width,
            height: size.height,
        };
    });

    const nodeMap = new Map(nodes.map((n, i) => [n.id, i]));

    const edges = links.map(l => ({
        source: nodeMap.get(l.source().id as string) ?? -1,
        target: nodeMap.get(l.target().id as string) ?? -1,
    })).filter(e => e.source >= 0 && e.target >= 0);

    const repulsion = 8000;
    const attraction = 0.005;
    const gravity = 0.02;
    const damping = 0.85;

    let step = 0;
    const tick = () => {
        if (step >= iterations) { animFrameId = null; return; }

        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].fixed) continue;
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = repulsion / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                nodes[i].vx += fx;
                nodes[i].vy += fy;
                nodes[j].vx -= fx;
                nodes[j].vy -= fy;
            }
        }

        for (const edge of edges) {
            const s = nodes[edge.source];
            const t = nodes[edge.target];
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = dist * attraction;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            s.vx += fx;
            s.vy += fy;
            t.vx -= fx;
            t.vy -= fy;
        }

        for (const node of nodes) {
            if (node.fixed) continue;
            node.vx += (cx - node.x) * gravity;
            node.vy += (cy - node.y) * gravity;
            node.vx *= damping;
            node.vy *= damping;
            node.x += node.vx;
            node.y += node.vy;
        }

        for (const node of nodes) {
            const el = graph!.getCell(node.id) as dia.Element;
            if (el) el.position(node.x - node.width / 2, node.y - node.height / 2);
        }

        step++;
        animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
}

// ── Drop detection ──

function handleDrop(workloadEl: dia.Element, _evt: dia.Event): void {
    if (!graph) return;

    const wlId = workloadEl.get('workloadId') as string;
    const wlPos = workloadEl.position();
    const wlCenter = { x: wlPos.x + WORKLOAD_WIDTH / 2, y: wlPos.y + WORKLOAD_HEIGHT / 2 };

    let targetClusterId: string | null = null;

    const clusters = graph.getElements().filter(el => el.get('nodeType') === 'cluster');
    for (const cluster of clusters) {
        const pos = cluster.position();
        const size = cluster.size();
        if (
            wlCenter.x >= pos.x && wlCenter.x <= pos.x + size.width &&
            wlCenter.y >= pos.y && wlCenter.y <= pos.y + size.height
        ) {
            targetClusterId = cluster.get('frameId') as string;
            break;
        }
    }

    // Remove existing link for this workload
    const existingLinks = graph.getLinks().filter(l => l.source().id === workloadEl.id);
    for (const link of existingLinks) link.remove();

    if (targetClusterId) {
        assignWorkload(wlId, targetClusterId);
        const link = new shapes.standard.Link({
            source: { id: workloadEl.id },
            target: { id: 'cluster-' + targetClusterId },
            attrs: {
                line: {
                    stroke: '#8d8d8d',
                    strokeWidth: 1.5,
                    targetMarker: { type: 'path', d: '' },
                },
            },
        });
        graph.addCell(link);
    } else {
        unassignWorkload(wlId);
    }
}
