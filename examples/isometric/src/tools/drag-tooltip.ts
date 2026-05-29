// Singleton floating tooltip shown while the user drags an on-canvas
// adjustment handle (yellow corner-radius diamonds, double-arrow bar &
// arrowhead handles). Tracks the cursor and renders the current value;
// theme (light/dark) is inherited via .cds--g100 in style.css.

let tooltipEl: HTMLDivElement | null = null;
let lastMouseX = 0;
let lastMouseY = 0;

function ensureListeners(): void {
    if (typeof document === 'undefined') return;
    if ((document as { __nrDragTooltipReady?: boolean }).__nrDragTooltipReady) return;
    (document as { __nrDragTooltipReady?: boolean }).__nrDragTooltipReady = true;
    document.addEventListener('mousemove', (e: MouseEvent) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        if (tooltipEl && tooltipEl.style.display !== 'none') position();
    });
    document.addEventListener('mouseup', () => hideDragTooltip());
}

function position(): void {
    if (!tooltipEl) return;
    tooltipEl.style.left = `${lastMouseX + 14}px`;
    tooltipEl.style.top  = `${lastMouseY - 28}px`;
}

export function showDragTooltip(text: string): void {
    ensureListeners();
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'nr-drag-value-tooltip';
        document.body.appendChild(tooltipEl);
    }
    tooltipEl.textContent = text;
    tooltipEl.style.display = '';
    position();
}

export function hideDragTooltip(): void {
    if (tooltipEl) tooltipEl.style.display = 'none';
}
