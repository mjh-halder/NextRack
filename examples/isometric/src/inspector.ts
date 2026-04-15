import { dia } from '@joint/core';
import IsometricShape from './shapes/isometric-shape';
import { ShapeRegistry } from './shapes/shape-registry';
import { PRIMARY_COLORS } from './colors';
const DEFAULT_ZONE_COLOR = '#0072c3';

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const LABEL_POSITIONS: Record<string, { x: string | number; y: string | number; textAnchor: string }> = {
    'top-left':     { x: 8,              y: 16,             textAnchor: 'start' },
    'top-right':    { x: 'calc(w - 8)',  y: 16,             textAnchor: 'end'   },
    'bottom-left':  { x: 8,              y: 'calc(h - 6)',  textAnchor: 'start' },
    'bottom-right': { x: 'calc(w - 8)', y: 'calc(h - 6)', textAnchor: 'end'   },
};

// --- Node metadata ---

export interface NodeMeta {
    name: string;
    kind: string;
    vendor: string;
    model: string;
    notes: string;
}

export const META_KEY = 'meta';

const EMPTY_NODE_META: NodeMeta = { name: '', kind: '', vendor: '', model: '', notes: '' };

const NODE_FIELDS: { key: keyof NodeMeta; label: string; multiline?: boolean }[] = [
    { key: 'name',   label: 'Name'   },
    { key: 'kind',   label: 'Kind'   },
    { key: 'vendor', label: 'Vendor' },
    { key: 'model',  label: 'Model'  },
    { key: 'notes',  label: 'Notes', multiline: true },
];

// --- Link metadata ---

export interface LinkMeta {
    bandwidth: string;
    medium: string;
    encryption: string;
}

export const LINK_META_KEY = 'linkMeta';

const EMPTY_LINK_META: LinkMeta = { bandwidth: '', medium: '', encryption: '' };

const LINK_FIELDS: { key: keyof LinkMeta; label: string; placeholder: string }[] = [
    { key: 'bandwidth',  label: 'Bandwidth',  placeholder: 'e.g. 10Gbps'  },
    { key: 'medium',     label: 'Medium',     placeholder: 'e.g. fiber'   },
    { key: 'encryption', label: 'Encryption', placeholder: 'e.g. TLS'     },
];

// --- Label position picker ---

interface LabelPositionPicker {
    row: HTMLElement;
    getValue(): string;
    setValue(pos: string): void;
}

// --- Panel ---

export interface PanelActions {
    onDelete: () => void;
    onDuplicate: () => void;
    onDuplicateZone: (frame: dia.Element) => void;
}

export class PropertyPanel {

    private el: HTMLElement;
    private titleEl: HTMLElement;

    private nodeSection: HTMLElement;
    private zoneSection: HTMLElement;
    private linkSection: HTMLElement;
    private duplicateBtn: HTMLButtonElement;
    private duplicateZoneBtn: HTMLButtonElement;
    private deleteBtn: HTMLButtonElement;

    private currentNode: IsometricShape | null = null;
    private currentLink: dia.Link | null = null;
    private currentZone: dia.Element | null = null;

    private nodeInputs = {} as Record<keyof NodeMeta, HTMLInputElement | HTMLTextAreaElement>;
    private nodeLabelHiddenEl!: HTMLInputElement;
    private zoneNameInput!: HTMLInputElement;
    private zoneLabelHiddenEl!: HTMLInputElement;
    private zoneColorSwatchBtns: Array<{ btn: HTMLButtonElement; color: string }> = [];
    private selectedZoneColor = DEFAULT_ZONE_COLOR;
    private zoneLabelPosPicker!: LabelPositionPicker;
    private linkInputs = {} as Record<keyof LinkMeta, HTMLInputElement>;

    constructor(el: HTMLElement, private actions: PanelActions) {
        this.el = el;
        this.build();
        this.hide();
    }

    private build() {
        this.titleEl = document.createElement('div');
        this.titleEl.className = 'inspector-title';
        this.el.appendChild(this.titleEl);

        // ---- Node section ----
        this.nodeSection = document.createElement('div');
        this.nodeSection.className = 'inspector-section';
        for (const field of NODE_FIELDS) {
            const { row, input } = this.buildRow(
                `node-${field.key}`, field.label, field.label, field.multiline
            );
            this.nodeInputs[field.key] = input as HTMLInputElement;
            this.nodeSection.appendChild(row);
        }
        const { row: nodeLabelRow, input: nodeLabelInput } = this.buildCheckboxRow(
            'node-label-hidden', 'Hide label'
        );
        this.nodeLabelHiddenEl = nodeLabelInput;
        this.nodeSection.appendChild(nodeLabelRow);
        this.el.appendChild(this.nodeSection);

        // ---- Zone section ----
        this.zoneSection = document.createElement('div');
        this.zoneSection.className = 'inspector-section';

        const { row: zoneNameRow, input: zoneNameInput } = this.buildRow(
            'zone-name', 'Zone Name', 'Zone Name'
        );
        this.zoneNameInput = zoneNameInput as HTMLInputElement;
        this.zoneSection.appendChild(zoneNameRow);

        // Hide label — appears directly after Zone Name
        const { row: zoneLabelRow, input: zoneLabelInput } = this.buildCheckboxRow(
            'zone-label-hidden', 'Hide label'
        );
        this.zoneLabelHiddenEl = zoneLabelInput;
        this.zoneSection.appendChild(zoneLabelRow);

        // Label position — hidden when Hide label is checked
        this.zoneLabelPosPicker = this.buildLabelPositionRow();
        this.zoneSection.appendChild(this.zoneLabelPosPicker.row);
        this.zoneLabelHiddenEl.addEventListener('change', () => {
            this.zoneLabelPosPicker.row.style.display = this.zoneLabelHiddenEl.checked ? 'none' : '';
        });

        this.zoneSection.appendChild(this.buildZoneColorRow());
        this.el.appendChild(this.zoneSection);

        // ---- Link section ----
        this.linkSection = document.createElement('div');
        this.linkSection.className = 'inspector-section';
        for (const field of LINK_FIELDS) {
            const { row, input } = this.buildRow(
                `link-${field.key}`, field.label, field.placeholder
            );
            this.linkInputs[field.key] = input as HTMLInputElement;
            this.linkSection.appendChild(row);
        }
        this.el.appendChild(this.linkSection);

        // Action buttons — stacked vertically with uniform spacing
        const actionsEl = document.createElement('div');
        actionsEl.className = 'inspector-actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => this.save());
        actionsEl.appendChild(saveBtn);

        this.duplicateBtn = document.createElement('button');
        this.duplicateBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateBtn.addEventListener('click', () => this.actions.onDuplicate());
        actionsEl.appendChild(this.duplicateBtn);

        this.duplicateZoneBtn = document.createElement('button');
        this.duplicateZoneBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
        this.duplicateZoneBtn.textContent = 'Duplicate Zone';
        this.duplicateZoneBtn.addEventListener('click', () => {
            if (this.currentZone) this.actions.onDuplicateZone(this.currentZone);
        });
        actionsEl.appendChild(this.duplicateZoneBtn);

        this.deleteBtn = document.createElement('button');
        this.deleteBtn.className = 'cds--btn cds--btn--danger--tertiary cds--btn--sm';
        this.deleteBtn.textContent = 'Delete';
        this.deleteBtn.addEventListener('click', () => this.actions.onDelete());
        actionsEl.appendChild(this.deleteBtn);

        this.el.appendChild(actionsEl);
    }

    private buildZoneColorRow(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'inspector-row';

        const label = document.createElement('label');
        label.className = 'cds--label';
        label.textContent = 'Color';
        wrapper.appendChild(label);

        const swatchRow = document.createElement('div');
        swatchRow.className = 'nr-inspector-swatch-row';

        this.zoneColorSwatchBtns = [];
        for (const color of PRIMARY_COLORS.filter(c => c.base !== '#161616')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = color.label;
            btn.setAttribute('aria-label', color.label);
            btn.setAttribute('aria-pressed', 'false');
            btn.className = 'nr-inspector-swatch-btn';
            btn.style.setProperty('--swatch-color', color.base);
            btn.addEventListener('click', () => {
                this.selectedZoneColor = color.base;
                this.syncZoneColorSwatches();
            });
            swatchRow.appendChild(btn);
            this.zoneColorSwatchBtns.push({ btn, color: color.base });
        }

        wrapper.appendChild(swatchRow);
        return wrapper;
    }

    private syncZoneColorSwatches() {
        for (const { btn, color } of this.zoneColorSwatchBtns) {
            const selected = color === this.selectedZoneColor;
            btn.classList.toggle('nr-inspector-swatch-btn--selected', selected);
            btn.setAttribute('aria-pressed', String(selected));
        }
    }

    private buildLabelPositionRow(): LabelPositionPicker {
        const POSITIONS = [
            { key: 'top-left',     label: 'Top left',     dot: 'tl' },
            { key: 'top-right',    label: 'Top right',    dot: 'tr' },
            { key: 'bottom-left',  label: 'Bottom left',  dot: 'bl' },
            { key: 'bottom-right', label: 'Bottom right', dot: 'br' },
        ];

        const row = document.createElement('div');
        row.className = 'inspector-row';

        const label = document.createElement('label');
        label.textContent = 'Label Position';
        row.appendChild(label);

        const picker = document.createElement('div');
        picker.className = 'nr-pos-picker';
        picker.setAttribute('role', 'group');
        picker.setAttribute('aria-label', 'Label position');

        let selectedKey = 'top-left';
        const entries: Array<{ btn: HTMLButtonElement; key: string }> = [];

        const sync = () => {
            for (const { btn, key } of entries) {
                const on = key === selectedKey;
                btn.classList.toggle('nr-pos-btn--selected', on);
                btn.setAttribute('aria-pressed', String(on));
            }
        };

        for (const pos of POSITIONS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'nr-pos-btn';
            btn.setAttribute('aria-label', pos.label);
            btn.setAttribute('aria-pressed', 'false');

            const dot = document.createElement('span');
            dot.className = `nr-pos-dot nr-pos-dot--${pos.dot}`;
            btn.appendChild(dot);

            btn.addEventListener('click', () => { selectedKey = pos.key; sync(); });
            picker.appendChild(btn);
            entries.push({ btn, key: pos.key });
        }

        row.appendChild(picker);
        sync();

        return {
            row,
            getValue: () => selectedKey,
            setValue: (pos: string) => {
                selectedKey = POSITIONS.some(p => p.key === pos) ? pos : 'top-left';
                sync();
            },
        };
    }

    private buildRow(id: string, labelText: string, placeholder: string, multiline = false) {
        const row = document.createElement('div');
        row.className = 'inspector-row';

        const label = document.createElement('label');
        label.textContent = labelText;
        label.htmlFor = `inspector-${id}`;
        row.appendChild(label);

        let input: HTMLInputElement | HTMLTextAreaElement;
        if (multiline) {
            input = document.createElement('textarea');
            (input as HTMLTextAreaElement).rows = 3;
        } else {
            input = document.createElement('input');
            (input as HTMLInputElement).type = 'text';
        }
        input.id = `inspector-${id}`;
        input.placeholder = placeholder;
        row.appendChild(input);

        return { row, input };
    }

    private buildCheckboxRow(id: string, labelText: string): { row: HTMLElement; input: HTMLInputElement } {
        const row = document.createElement('div');
        row.className = 'inspector-row';

        const wrapper = document.createElement('div');
        wrapper.className = 'cds--form-item cds--checkbox-wrapper';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `inspector-${id}`;
        input.className = 'cds--checkbox';
        input.name = id;

        const label = document.createElement('label');
        label.htmlFor = `inspector-${id}`;
        label.className = 'cds--checkbox-label';

        const span = document.createElement('span');
        span.className = 'cds--checkbox-label-text';
        span.textContent = labelText;

        label.appendChild(span);
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        row.appendChild(wrapper);

        return { row, input };
    }

    private save() {
        if (this.currentNode) this.saveNode();
        else if (this.currentZone) this.saveZone();
        else if (this.currentLink) this.saveLink();
    }

    private saveNode() {
        if (!this.currentNode) return;
        const meta: NodeMeta = {
            name:   this.nodeInputs.name.value,
            kind:   this.nodeInputs.kind.value,
            vendor: this.nodeInputs.vendor.value,
            model:  this.nodeInputs.model.value,
            notes:  (this.nodeInputs.notes as HTMLTextAreaElement).value,
        };
        this.currentNode.set(META_KEY, meta);
        const displayLabel = meta.name.trim()
            || ShapeRegistry[meta.kind]?.displayName
            || meta.kind;
        this.currentNode.attr('label/text', displayLabel);
        // null removes the display attr, restoring default visibility
        this.currentNode.attr('label/display', this.nodeLabelHiddenEl.checked ? 'none' : null);
    }

    private saveZone() {
        if (!this.currentZone) return;
        const name = this.zoneNameInput.value.trim();
        this.currentZone.attr('label/text', name || 'Zone');
        this.currentZone.attr('label/display', this.zoneLabelHiddenEl.checked ? 'none' : null);

        // Apply color
        const color = this.selectedZoneColor;
        this.currentZone.set('zoneColor', color);
        this.currentZone.attr('body/stroke', color);
        this.currentZone.attr('body/fill', hexToRgba(color, 0.08));
        this.currentZone.attr('label/fill', color);

        // Apply label position
        const selectedPos = this.zoneLabelPosPicker.getValue();
        this.currentZone.set('zoneLabelPosition', selectedPos);
        const pos = LABEL_POSITIONS[selectedPos];
        this.currentZone.attr('label/x', pos.x);
        this.currentZone.attr('label/y', pos.y);
        this.currentZone.attr('label/text-anchor', pos.textAnchor);
    }

    private saveLink() {
        if (!this.currentLink) return;
        const meta: LinkMeta = {
            bandwidth:  this.linkInputs.bandwidth.value,
            medium:     this.linkInputs.medium.value,
            encryption: this.linkInputs.encryption.value,
        };
        this.currentLink.set(LINK_META_KEY, meta);
        updateLinkLabel(this.currentLink, meta);
    }

    show(cell: IsometricShape) {
        this.currentNode = cell;
        this.currentLink = null;
        this.currentZone = null;
        const meta: NodeMeta = cell.get(META_KEY) ?? { ...EMPTY_NODE_META };
        for (const field of NODE_FIELDS) {
            this.nodeInputs[field.key].value = meta[field.key];
        }
        this.nodeLabelHiddenEl.checked = cell.attr('label/display') === 'none';
        this.titleEl.textContent = 'Node Properties';
        this.nodeSection.style.display = '';
        this.zoneSection.style.display = 'none';
        this.linkSection.style.display = 'none';
        this.duplicateBtn.style.display = '';
        this.duplicateZoneBtn.style.display = 'none';
        this.deleteBtn.style.display = '';
        this.el.classList.remove('inspector-hidden');
    }

    showZone(frame: dia.Element) {
        this.currentZone = frame;
        this.currentNode = null;
        this.currentLink = null;
        this.zoneNameInput.value = (frame.attr('label/text') as string | undefined) ?? '';
        this.zoneLabelHiddenEl.checked = frame.attr('label/display') === 'none';

        // Restore saved color (fall back to default if never set)
        this.selectedZoneColor = (frame.get('zoneColor') as string | undefined) ?? DEFAULT_ZONE_COLOR;
        this.syncZoneColorSwatches();

        // Restore label position and sync its visibility with the hide-label state
        this.zoneLabelPosPicker.setValue((frame.get('zoneLabelPosition') as string | undefined) ?? 'top-left');
        this.zoneLabelPosPicker.row.style.display = this.zoneLabelHiddenEl.checked ? 'none' : '';

        this.titleEl.textContent = 'Zone Properties';
        this.nodeSection.style.display = 'none';
        this.zoneSection.style.display = '';
        this.linkSection.style.display = 'none';
        this.duplicateBtn.style.display = 'none';
        this.duplicateZoneBtn.style.display = '';
        this.deleteBtn.style.display = '';
        this.el.classList.remove('inspector-hidden');
    }

    showLink(link: dia.Link) {
        this.currentLink = link;
        this.currentNode = null;
        this.currentZone = null;
        const meta: LinkMeta = link.get(LINK_META_KEY) ?? { ...EMPTY_LINK_META };
        for (const field of LINK_FIELDS) {
            this.linkInputs[field.key].value = meta[field.key];
        }
        this.titleEl.textContent = 'Connection';
        this.nodeSection.style.display = 'none';
        this.zoneSection.style.display = 'none';
        this.linkSection.style.display = '';
        this.duplicateBtn.style.display = 'none';
        this.duplicateZoneBtn.style.display = 'none';
        this.deleteBtn.style.display = 'none';
        this.el.classList.remove('inspector-hidden');
    }

    hide() {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;
        this.el.classList.add('inspector-hidden');
    }
}

// Compact label on the link: "10Gbps / fiber" — cleared if both fields are empty.
function updateLinkLabel(link: dia.Link, meta: LinkMeta) {
    const parts = [meta.bandwidth, meta.medium].filter(Boolean);
    const text = parts.join(' / ');
    if (text) {
        link.labels([{
            position: 0.5,
            attrs: {
                text: { text, fontSize: 9, fill: '#555', fontFamily: 'sans-serif' },
                rect: { fill: 'white', stroke: 'none', rx: 2, ry: 2 }
            }
        }]);
    } else {
        link.labels([]);
    }
}
