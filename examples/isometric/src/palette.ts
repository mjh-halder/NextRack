import { dia } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { Computer, Database, Firewall, Switch, Router, Frame, KubernetesWorkerNode } from './shapes';
import { META_KEY, NodeMeta } from './inspector';
import { GRID_SIZE } from './theme';

// Carbon overflow-menu icon (3 vertical dots)
const ICON_OVERFLOW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="16" height="16" aria-hidden="true"><circle cx="16" cy="8" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="16" cy="24" r="2"/></svg>`;

interface PaletteItem {
    label: string;
    kind: string;
    create: () => IsometricShape;
}

const PALETTE_ITEMS: PaletteItem[] = [
    { label: 'Firewall',             kind: 'firewall',               create: () => new Firewall()              },
    { label: 'Load Balancer',        kind: 'load-balancer',          create: () => new Switch()                },
    { label: 'Server',               kind: 'server',                 create: () => new Computer()              },
    { label: 'Storage',              kind: 'storage',                create: () => new Database()              },
    { label: 'Switch',               kind: 'switch',                 create: () => new Switch()                },
    { label: 'Router',               kind: 'router',                 create: () => new Router()                },
    { label: 'K8s Worker Node',      kind: 'kubernetes-worker-node', create: () => new KubernetesWorkerNode()  },
];

const CONTAINER_ITEMS: PaletteItem[] = [
    { label: 'Zone',          kind: 'zone',          create: () => new Frame()     },
];

// Stagger new elements so they don't land on top of each other
const BASE_X = 60;
const BASE_Y = 60;
const STAGGER = GRID_SIZE * 3;
const STAGGER_COLS = 4;

export type OnCreatedCallback = (shape: IsometricShape) => void;
export type OnMenuClickCallback = (anchor: HTMLElement) => void;

export class ComponentPalette {

    private el: HTMLElement;
    private graph: dia.Graph;
    private getView: () => View;
    private onCreated: OnCreatedCallback;
    private onMenuClick: OnMenuClickCallback;
    private placeCount = 0;

    constructor(
        el: HTMLElement,
        graph: dia.Graph,
        getView: () => View,
        onCreated: OnCreatedCallback,
        onMenuClick: OnMenuClickCallback
    ) {
        this.el = el;
        this.graph = graph;
        this.getView = getView;
        this.onCreated = onCreated;
        this.onMenuClick = onMenuClick;
        this.build();
    }

    private build() {
        // Panel header: product name + overflow menu trigger
        const header = document.createElement('div');
        header.className = 'nr-panel-header';

        const title = document.createElement('span');
        title.className = 'nr-panel-title';
        title.textContent = 'NextRack';

        const menuBtn = document.createElement('button');
        menuBtn.className = 'cds--btn cds--btn--ghost cds--btn--icon-only nr-panel-menu-btn';
        menuBtn.type = 'button';
        menuBtn.setAttribute('aria-label', 'Menu');
        menuBtn.title = 'Menu';
        menuBtn.innerHTML = ICON_OVERFLOW;
        menuBtn.addEventListener('click', () => this.onMenuClick(menuBtn));

        header.appendChild(title);
        header.appendChild(menuBtn);
        this.el.appendChild(header);

        this.el.appendChild(this.buildSection('Components', PALETTE_ITEMS));
        this.el.appendChild(this.buildSection('Containers', CONTAINER_ITEMS));
    }

    private buildSection(title: string, items: PaletteItem[]): DocumentFragment {
        const fragment = document.createDocumentFragment();

        const sectionLabel = document.createElement('p');
        sectionLabel.className = 'cds--side-nav__group-title nr-section-label';
        sectionLabel.textContent = title;
        fragment.appendChild(sectionLabel);

        const navList = document.createElement('ul');
        navList.className = 'cds--side-nav__items nr-nav-list';

        for (const item of items) {
            const li = document.createElement('li');
            li.className = 'cds--side-nav__item';

            const btn = document.createElement('button');
            btn.className = 'cds--side-nav__link nr-nav-link';
            btn.type = 'button';
            btn.setAttribute('data-kind', item.kind);

            const dot = document.createElement('span');
            dot.className = 'nr-kind-dot';
            dot.setAttribute('data-kind', item.kind);

            const labelEl = document.createElement('span');
            labelEl.className = 'cds--side-nav__link-text';
            labelEl.textContent = item.label;

            btn.appendChild(dot);
            btn.appendChild(labelEl);
            btn.addEventListener('click', () => this.addToGraph(item));
            li.appendChild(btn);
            navList.appendChild(li);
        }

        fragment.appendChild(navList);
        return fragment;
    }

    private addToGraph(item: PaletteItem) {
        const col = this.placeCount % STAGGER_COLS;
        const row = Math.floor(this.placeCount / STAGGER_COLS);
        const x = BASE_X + col * STAGGER;
        const y = BASE_Y + row * STAGGER;
        this.placeCount++;

        const shape = item.create();
        const meta: NodeMeta = { name: '', kind: item.kind, vendor: '', model: '', notes: '' };

        shape.position(x, y);
        shape.set(META_KEY, meta);
        shape.toggleView(this.getView());

        this.graph.addCell(shape);
        this.onCreated(shape);
    }
}
