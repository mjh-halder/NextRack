import { dia } from '@joint/core';

const LABEL_GAP = 78;
const labels = new Map<string, HTMLDivElement>();
let containerEl: HTMLElement | null = null;
let paperRef: dia.Paper | null = null;
let visible = true;

export function initCalloutLabels(canvas: HTMLElement, paper: dia.Paper): void {
    containerEl = document.createElement('div');
    containerEl.className = 'nr-callout-container';
    canvas.appendChild(containerEl);
    paperRef = paper;
}

export function setCalloutVisibility(show: boolean): void {
    visible = show;
    if (containerEl) containerEl.style.display = show ? '' : 'none';
}

export function syncCalloutLabel(cell: dia.Element): void {
    if (!containerEl || !paperRef) return;
    const id = cell.id as string;
    const enabled = !!cell.get('calloutLabel');

    if (!enabled) {
        removeCalloutLabel(id);
        return;
    }

    let el = labels.get(id);
    if (!el) {
        el = document.createElement('div');
        el.className = 'nr-callout';
        el.innerHTML =
            '<div class="nr-callout__line"></div>' +
            '<div class="nr-callout__card">' +
            '<div class="nr-callout__title"></div>' +
            '<div class="nr-callout__subtitle"></div>' +
            '</div>';
        containerEl.appendChild(el);
        labels.set(id, el);
    }

    const meta = cell.get('meta') as Record<string, unknown> | undefined;
    const title = String(meta?.calloutTitle || meta?.name || cell.attr('label/text') || '');
    const subtitle = String(meta?.calloutSubtitle || '');
    el.querySelector('.nr-callout__title')!.textContent = title;
    el.querySelector('.nr-callout__subtitle')!.textContent = subtitle;
    (el.querySelector('.nr-callout__subtitle') as HTMLElement).style.display = subtitle ? '' : 'none';

    const maxWidth = (cell.get('calloutWidth') as number) || 160;
    (el.querySelector('.nr-callout__card') as HTMLElement).style.maxWidth = maxWidth + 'px';

    const customGap = (cell.get('calloutDistance') as number) || LABEL_GAP;
    const lineEl = el.querySelector('.nr-callout__line') as HTMLElement;
    if (lineEl) lineEl.style.height = Math.max(8, customGap) + 'px';

    positionCallout(cell, el);
}

function positionCallout(cell: dia.Element, el: HTMLDivElement): void {
    if (!paperRef) return;
    const mx = paperRef.matrix();
    const bbox = cell.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    const topY = bbox.y;
    const iH = ((cell.get('isometricHeight') as number) || 0);
    const scale = Math.sqrt(mx.a * mx.a + mx.b * mx.b);
    const heightOffset = iH * scale;

    const sx = mx.a * centerX + mx.c * centerY + mx.e;
    const sy = mx.b * centerX + mx.d * topY + mx.f;

    // Anchor bottom of callout to the element's top point — container grows upward
    const anchorY = sy - heightOffset;
    el.style.left = sx + 'px';
    el.style.top = anchorY + 'px';
    el.style.transform = 'translateX(-50%) translateY(-100%)';
}

function removeCalloutLabel(id: string): void {
    const el = labels.get(id);
    if (el) {
        el.remove();
        labels.delete(id);
    }
}

export function refreshAllCallouts(): void {
    if (!paperRef || !visible) return;
    const graph = paperRef.model;
    labels.forEach((el, id) => {
        const cell = graph.getCell(id) as dia.Element | undefined;
        if (cell) positionCallout(cell, el);
    });
}

export function removeCallout(cellId: string): void {
    removeCalloutLabel(cellId);
}
