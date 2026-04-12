import { dia } from '@joint/core';
import IsometricShape, { View } from './shapes/isometric-shape';
import { Computer, Database, Firewall, Switch, Router } from './shapes';
import { META_KEY, NodeMeta } from './inspector';
import { GRID_SIZE } from './theme';

interface PaletteItem {
    label: string;
    kind: string;
    create: () => IsometricShape;
}

const PALETTE_ITEMS: PaletteItem[] = [
    { label: 'Firewall',      kind: 'firewall',      create: () => new Firewall()  },
    { label: 'Load Balancer', kind: 'load-balancer', create: () => new Switch()    },
    { label: 'Server',        kind: 'server',        create: () => new Computer()  },
    { label: 'Storage',       kind: 'storage',       create: () => new Database()  },
    { label: 'Switch',        kind: 'switch',        create: () => new Switch()    },
    { label: 'Router',        kind: 'router',        create: () => new Router()    },
];

// Stagger new elements so they don't land on top of each other
const BASE_X = 60;
const BASE_Y = 60;
const STAGGER = GRID_SIZE * 3;
const STAGGER_COLS = 4;

export type OnCreatedCallback = (shape: IsometricShape) => void;

export class ComponentPalette {

    private el: HTMLElement;
    private graph: dia.Graph;
    private getView: () => View;
    private onCreated: OnCreatedCallback;
    private placeCount = 0;

    constructor(
        el: HTMLElement,
        graph: dia.Graph,
        getView: () => View,
        onCreated: OnCreatedCallback
    ) {
        this.el = el;
        this.graph = graph;
        this.getView = getView;
        this.onCreated = onCreated;
        this.build();
    }

    private build() {
        const title = document.createElement('div');
        title.className = 'palette-title';
        title.textContent = 'Components';
        this.el.appendChild(title);

        for (const item of PALETTE_ITEMS) {
            const btn = document.createElement('button');
            btn.className = 'palette-item';
            btn.setAttribute('data-kind', item.kind);

            const dot = document.createElement('span');
            dot.className = 'palette-item-dot';
            btn.appendChild(dot);

            const label = document.createElement('span');
            label.textContent = item.label;
            btn.appendChild(label);

            btn.addEventListener('click', () => this.addToGraph(item));
            this.el.appendChild(btn);
        }
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
