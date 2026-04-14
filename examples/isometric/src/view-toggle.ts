export type ToggleView = 'isometric' | '2d';

interface ToggleOption {
    view: ToggleView;
    label: string;
}

const OPTIONS: ToggleOption[] = [
    { view: 'isometric', label: 'Isometric' },
    { view: '2d',        label: '2D'        },
];

export class ViewToggle {
    private readonly segBtns = new Map<ToggleView, HTMLButtonElement>();
    private _value: ToggleView;
    private readonly onChange: (view: ToggleView) => void;

    constructor(container: HTMLElement, initial: ToggleView, onChange: (view: ToggleView) => void) {
        this._value = initial;
        this.onChange = onChange;

        // ── Segmented control — radio-group pattern ───────────────────────────
        const segWrapper = document.createElement('div');
        segWrapper.className = 'nr-seg-control';
        // radio-group pattern: roving tabindex, aria-checked per segment
        segWrapper.setAttribute('role', 'radiogroup');
        segWrapper.setAttribute('aria-label', 'View mode');

        for (const opt of OPTIONS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-seg-btn';
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-label', `${opt.label} view`);
            btn.textContent = opt.label;
            btn.addEventListener('click', () => this.setValue(opt.view));
            this.segBtns.set(opt.view, btn);
            segWrapper.appendChild(btn);
        }

        // Keyboard: left/right arrow moves between segments (radio-group roving tabindex)
        segWrapper.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const views = OPTIONS.map(o => o.view);
            const idx = views.indexOf(this._value);
            const next = e.key === 'ArrowRight'
                ? views[(idx + 1) % views.length]
                : views[(idx - 1 + views.length) % views.length];
            this.setValue(next);
            this.segBtns.get(next)?.focus();
        });

        container.appendChild(segWrapper);

        this.sync();
    }

    get value(): ToggleView {
        return this._value;
    }

    setValue(view: ToggleView): void {
        if (this._value === view) return;
        this._value = view;
        this.sync();
        this.onChange(view);
    }

    private sync(): void {
        this.segBtns.forEach((btn, view) => {
            const active = view === this._value;
            btn.classList.toggle('nr-seg-btn--selected', active);
            btn.setAttribute('aria-checked', String(active));
            // Roving tabindex: only the active segment is in the tab order
            btn.tabIndex = active ? 0 : -1;
        });
    }
}
