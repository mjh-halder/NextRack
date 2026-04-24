import { dia, g, highlighters } from '@joint/core';
import IsometricShape from './shapes/isometric-shape';
import { COMPLEX_COMPONENT_TYPE } from './shapes/complex-component';
import { HIGHLIGHT_COLOR } from './theme';

const HIGHLIGHT_ID = 'area-select';

interface AreaSelectOptions {
    paper: dia.Paper;
    graph: dia.Graph;
    canvasEl: HTMLDivElement;
    resolveComponentBase: (cell: dia.Element) => dia.Element;
    onSelectionChange: (cells: dia.Cell[]) => void;
    onGroupMoveEnd?: (cells: dia.Cell[]) => void;
}

export class AreaSelect {

    private paper: dia.Paper;
    private graph: dia.Graph;
    private resolveComponentBase: (cell: dia.Element) => dia.Element;
    private onSelectionChange: (cells: dia.Cell[]) => void;
    private onGroupMoveEnd: (cells: dia.Cell[]) => void;

    private selected: Set<dia.Cell> = new Set();
    private bandEl: HTMLDivElement | null = null;
    private dragging = false;
    private startClientX = 0;
    private startClientY = 0;
    private endClientX = 0;
    private endClientY = 0;

    private groupMoving = false;
    private groupMoveAnchor: dia.Element | null = null;
    private groupMoveStartPositions: Map<string, { x: number; y: number }> = new Map();
    private groupMoveLastPos: { x: number; y: number } = { x: 0, y: 0 };

    constructor(opts: AreaSelectOptions) {
        this.paper = opts.paper;
        this.graph = opts.graph;
        this.resolveComponentBase = opts.resolveComponentBase;
        this.onSelectionChange = opts.onSelectionChange;
        this.onGroupMoveEnd = opts.onGroupMoveEnd ?? (() => {});
        this.attach();
    }

    get selection(): dia.Cell[] {
        const result: dia.Cell[] = [];
        this.selected.forEach(c => result.push(c));
        return result;
    }

    get hasSelection(): boolean {
        return this.selected.size > 0;
    }

    isSelected(cell: dia.Cell): boolean {
        return this.selected.has(cell);
    }

    toggle(cell: dia.Cell): void {
        if (cell.isLink()) return;
        const resolved = this.resolveComponentBase(cell as dia.Element);
        if (this.selected.has(resolved)) {
            this.selected.delete(resolved);
            const view = this.paper.findViewByModel(resolved);
            if (view) highlighters.mask.remove(view, HIGHLIGHT_ID);
        } else {
            this.selected.add(resolved);
            this.addHighlight(resolved);
        }
        this.onSelectionChange(this.selection);
    }

    clear(): void {
        this.selected.forEach(cell => {
            const view = this.paper.findViewByModel(cell);
            if (view) highlighters.mask.remove(view, HIGHLIGHT_ID);
        });
        this.selected.clear();
        this.onSelectionChange([]);
    }

    deleteSelection(): void {
        const cells = this.selection;
        this.clear();
        cells.forEach(cell => {
            if (cell.graph) {
                const embedded = (cell as dia.Element).getEmbeddedCells();
                if (embedded) embedded.forEach(c => c.remove());
                cell.remove();
            }
        });
    }

    private attach(): void {
        this.paper.on('blank:pointerdown', (evt: dia.Event) => {
            if (!evt.shiftKey) return;
            evt.stopPropagation();
            this.clear();
            this.dragging = true;
            this.startClientX = evt.clientX;
            this.startClientY = evt.clientY;
            this.createBand();
        });

        this.paper.on('blank:pointermove', (evt: dia.Event) => {
            if (!this.dragging) return;
            evt.stopPropagation();
            this.updateBand(evt.clientX, evt.clientY);
        });

        this.paper.on('blank:pointerup', () => {
            if (!this.dragging) return;
            this.dragging = false;
            this.finishSelection();
            this.removeBand();
        });

        // ── Group move ──────────────────────────────────────────────────
        this.paper.on('element:pointerdown', (elementView: dia.ElementView) => {
            if (!this.hasSelection) return;
            const model = this.resolveComponentBase(elementView.model);
            if (!this.selected.has(model)) return;
            this.groupMoving = true;
            this.groupMoveAnchor = model;
            const anchorPos = model.position();
            this.groupMoveLastPos = { x: anchorPos.x, y: anchorPos.y };
            this.groupMoveStartPositions.clear();
            this.selected.forEach(cell => {
                if (cell.isLink()) return;
                const el = cell as dia.Element;
                const pos = el.position();
                this.groupMoveStartPositions.set(String(el.id), { x: pos.x, y: pos.y });
            });
        });

        this.paper.on('element:pointermove', (elementView: dia.ElementView) => {
            if (!this.groupMoving || !this.groupMoveAnchor) return;
            const model = this.resolveComponentBase(elementView.model);
            if (model !== this.groupMoveAnchor) return;

            const pos = model.position();
            const dx = pos.x - this.groupMoveLastPos.x;
            const dy = pos.y - this.groupMoveLastPos.y;
            if (dx === 0 && dy === 0) return;
            this.groupMoveLastPos = { x: pos.x, y: pos.y };

            this.selected.forEach(cell => {
                if (cell.isLink() || cell === model) return;
                if (this.isParentSelected(cell)) return;
                const el = cell as dia.Element;
                el.translate(dx, dy);
            });
        });

        this.paper.on('element:pointerup', () => {
            if (!this.groupMoving) return;
            this.groupMoving = false;
            this.groupMoveAnchor = null;
            this.groupMoveStartPositions.clear();
            this.onGroupMoveEnd(this.selection);
        });
    }

    private createBand(): void {
        const el = document.createElement('div');
        el.className = 'nr-area-select-band';
        el.style.left = this.startClientX + 'px';
        el.style.top = this.startClientY + 'px';
        el.style.width = '0';
        el.style.height = '0';
        document.body.appendChild(el);
        this.bandEl = el;
    }

    private updateBand(clientX: number, clientY: number): void {
        this.endClientX = clientX;
        this.endClientY = clientY;
        if (!this.bandEl) return;
        const x = Math.min(this.startClientX, clientX);
        const y = Math.min(this.startClientY, clientY);
        const w = Math.abs(clientX - this.startClientX);
        const h = Math.abs(clientY - this.startClientY);
        this.bandEl.style.left = x + 'px';
        this.bandEl.style.top = y + 'px';
        this.bandEl.style.width = w + 'px';
        this.bandEl.style.height = h + 'px';
    }

    private removeBand(): void {
        if (!this.bandEl) return;
        this.bandEl.remove();
        this.bandEl = null;
    }

    private finishSelection(): void {
        const cx1 = Math.min(this.startClientX, this.endClientX);
        const cy1 = Math.min(this.startClientY, this.endClientY);
        const cw = Math.abs(this.endClientX - this.startClientX);
        const ch = Math.abs(this.endClientY - this.startClientY);
        if (cw < 5 || ch < 5) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const localRect = (this.paper as any).clientToLocalRect(cx1, cy1, cw, ch) as g.Rect;

        const elements = this.graph.getElements();
        const seen = new Set<string>();

        elements.forEach(element => {
            if (element.get('componentRole') === 'child') return;
            const resolved = this.resolveComponentBase(element);
            const id = String(resolved.id);
            if (seen.has(id)) return;
            const bbox = resolved.getBBox();
            if (!localRect.intersect(bbox)) return;
            seen.add(id);
            this.selected.add(resolved);
            this.addHighlight(resolved);
        });

        this.onSelectionChange(this.selection);
    }

    private isParentSelected(cell: dia.Cell): boolean {
        const parent = (cell as dia.Element).getParentCell?.();
        return !!parent && this.selected.has(parent);
    }

    private highlightSelector(cell: dia.Cell): string {
        if (cell.get('isFrame')) return 'body';
        if (cell.get('type') === COMPLEX_COMPONENT_TYPE) return 'hitArea';
        return 'base';
    }

    private addHighlight(cell: dia.Cell): void {
        const view = this.paper.findViewByModel(cell);
        if (!view) return;
        const isZone = !!cell.get('isFrame');
        highlighters.mask.add(view, this.highlightSelector(cell), HIGHLIGHT_ID, {
            layer: dia.Paper.Layers.BACK,
            attrs: isZone
                ? { stroke: HIGHLIGHT_COLOR, 'stroke-width': 1.5, 'stroke-dasharray': '4,3', 'stroke-opacity': 0.6 }
                : { stroke: HIGHLIGHT_COLOR, 'stroke-width': 3, 'stroke-dasharray': '6,3' },
        });
    }
}
