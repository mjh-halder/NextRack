import { dia } from '@joint/core';
import IsometricShape from './shapes/isometric-shape';
import { ShapeRegistry } from './shapes/shape-registry';
import { PRIMARY_COLORS } from './colors';
import { getCustomFields, getDataType, FieldDefinition } from './schema-registry';
import { getProductsByType, getProduct } from './product-catalog';
import { getCanvas, updateCanvas, CanvasRecord } from './canvas-store';
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
    shapeType: string;
    [key: string]: unknown;
}

export const META_KEY = 'meta';

const EMPTY_NODE_META: NodeMeta = { name: '', shapeType: '' };

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
    private currentLayerId: string | null = null;

    private layerSection!: HTMLElement;

    private nodeInputs: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};
    private nodeLabelHiddenEl!: HTMLInputElement;
    private nodeCustomContainer!: HTMLElement;
    private nodeCustomInputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
    private zoneNameInput!: HTMLInputElement;
    private zoneLabelHiddenEl!: HTMLInputElement;
    private zoneCustomContainer!: HTMLElement;
    private zoneCustomInputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
    private zoneColorSwatchBtns: Array<{ btn: HTMLButtonElement; color: string }> = [];
    private selectedZoneColor = DEFAULT_ZONE_COLOR;
    private zoneLabelPosPicker!: LabelPositionPicker;
    private linkInputs = {} as Record<keyof LinkMeta, HTMLInputElement>;
    private linkCustomContainer!: HTMLElement;
    private linkCustomInputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};

    constructor(el: HTMLElement, private actions: PanelActions) {
        this.el = el;
        this.build();
        this.hide();
    }

    private build() {
        this.titleEl = document.createElement('div');
        this.titleEl.className = 'inspector-title';
        this.el.appendChild(this.titleEl);

        // ---- Node section (rebuilt dynamically per componentType in show()) ----
        this.nodeSection = document.createElement('div');
        this.nodeSection.className = 'inspector-section';
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
        this.zoneCustomContainer = document.createElement('div');
        this.zoneCustomContainer.className = 'inspector-custom-fields';
        this.zoneSection.appendChild(this.zoneCustomContainer);
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
        this.linkCustomContainer = document.createElement('div');
        this.linkCustomContainer.className = 'inspector-custom-fields';
        this.linkSection.appendChild(this.linkCustomContainer);
        this.el.appendChild(this.linkSection);

        // ---- Layer section (rebuilt dynamically in showLayer()) ----
        this.layerSection = document.createElement('div');
        this.layerSection.className = 'inspector-section';
        this.el.appendChild(this.layerSection);

        // Auto-save: zone fields apply instantly.
        this.zoneNameInput.addEventListener('input', () => this.saveZone());
        this.zoneLabelHiddenEl.addEventListener('change', () => this.saveZone());

        // Auto-save: link fields apply instantly.
        for (const field of LINK_FIELDS) {
            this.linkInputs[field.key].addEventListener('input', () => this.saveLink());
        }

        // Action buttons — stacked vertically with uniform spacing. No Save.
        const actionsEl = document.createElement('div');
        actionsEl.className = 'inspector-actions';

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
        this.deleteBtn.addEventListener('click', () => {
            if (this.currentZone) {
                this.currentZone.remove();
                this.hide();
            } else {
                this.actions.onDelete();
            }
        });
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
                this.saveZone();
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

            btn.addEventListener('click', () => { selectedKey = pos.key; sync(); this.saveZone(); });
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

    private buildSelectRow(id: string, labelText: string, options: string[]): { row: HTMLElement; select: HTMLSelectElement } {
        const row = document.createElement('div');
        row.className = 'inspector-row';

        const label = document.createElement('label');
        label.textContent = labelText;
        label.htmlFor = `inspector-${id}`;
        row.appendChild(label);

        const select = document.createElement('select');
        select.id = `inspector-${id}`;
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— select —';
        select.appendChild(emptyOpt);
        for (const opt of options) {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            select.appendChild(el);
        }
        row.appendChild(select);

        return { row, select };
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
        const existing: Record<string, unknown> = this.currentNode.get(META_KEY) ?? {};
        const meta: Record<string, unknown> = { ...existing };

        if (this.nodeInputs.name) meta.name = this.nodeInputs.name.value;
        if (this.nodeInputs.notes) meta.notes = (this.nodeInputs.notes as HTMLTextAreaElement).value;

        // Only save editable (non-readonly) type fields
        for (const [key, input] of Object.entries(this.nodeCustomInputs)) {
            if (input.classList.contains('inspector-readonly')) continue;
            meta[key] = input.value;
        }

        this.currentNode.set(META_KEY, meta);
        const shapeKey = (meta.shapeType as string) || '';
        const productId = meta.productId as string;
        const product = productId ? getProduct(productId) : null;
        const displayLabel = (meta.name as string || '').trim()
            || (product ? String(product.values.name ?? '') : '')
            || ShapeRegistry[shapeKey]?.displayName
            || ShapeRegistry[shapeKey]?.componentType
            || '';
        this.currentNode.attr('label/text', displayLabel);
        this.currentNode.attr('label/display', this.nodeLabelHiddenEl.checked ? 'none' : null);
    }

    private saveZone() {
        if (!this.currentZone) return;
        const name = this.zoneNameInput.value.trim();
        this.currentZone.attr('label/text', name || 'Zone');
        this.currentZone.attr('label/display', this.zoneLabelHiddenEl.checked ? 'none' : null);

        const color = this.selectedZoneColor;
        this.currentZone.set('zoneColor', color);
        this.currentZone.attr('body/stroke', color);
        this.currentZone.attr('body/fill', hexToRgba(color, 0.08));
        this.currentZone.attr('label/fill', color);

        const selectedPos = this.zoneLabelPosPicker.getValue();
        this.currentZone.set('zoneLabelPosition', selectedPos);
        const pos = LABEL_POSITIONS[selectedPos];
        this.currentZone.attr('label/x', pos.x);
        this.currentZone.attr('label/y', pos.y);
        this.currentZone.attr('label/text-anchor', pos.textAnchor);

        const zoneMeta: Record<string, unknown> = {};
        for (const [key, input] of Object.entries(this.zoneCustomInputs)) {
            zoneMeta[key] = input.value;
        }
        this.currentZone.set('zoneMeta', zoneMeta);
    }

    private saveLink() {
        if (!this.currentLink) return;
        const meta: Record<string, unknown> = {
            bandwidth:  this.linkInputs.bandwidth.value,
            medium:     this.linkInputs.medium.value,
            encryption: this.linkInputs.encryption.value,
        };
        for (const [key, input] of Object.entries(this.linkCustomInputs)) {
            meta[key] = input.value;
        }
        this.currentLink.set(LINK_META_KEY, meta);
        updateLinkLabel(this.currentLink, meta as unknown as LinkMeta);
    }

    private buildCustomFields(
        container: HTMLElement,
        typeId: string,
        existingValues: Record<string, unknown>,
        saveFn: () => void,
    ): Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
        container.innerHTML = '';
        const fields = getCustomFields(typeId);
        const inputs: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = {};
        if (fields.length === 0) return inputs;

        for (const field of fields) {
            const row = document.createElement('div');
            row.className = 'inspector-row';
            const label = document.createElement('label');
            label.textContent = field.label;
            label.htmlFor = `inspector-custom-${typeId}-${field.key}`;
            row.appendChild(label);

            let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

            if (field.type === 'select' && field.options?.length) {
                input = document.createElement('select');
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '— select —';
                input.appendChild(emptyOpt);
                for (const opt of field.options) {
                    const el = document.createElement('option');
                    el.value = opt;
                    el.textContent = opt;
                    input.appendChild(el);
                }
            } else if (field.multiline) {
                input = document.createElement('textarea');
                (input as HTMLTextAreaElement).rows = 3;
            } else {
                input = document.createElement('input');
                (input as HTMLInputElement).type = field.type === 'number' ? 'number' : 'text';
            }

            input.id = `inspector-custom-${typeId}-${field.key}`;
            if (field.placeholder && 'placeholder' in input) input.placeholder = field.placeholder;
            input.value = String(existingValues[field.key] ?? '');
            input.addEventListener('input', saveFn);
            row.appendChild(input);
            container.appendChild(row);
            inputs[field.key] = input;
        }
        return inputs;
    }

    show(cell: IsometricShape) {
        this.currentNode = cell;
        this.currentLink = null;
        this.currentZone = null;
        const meta: Record<string, unknown> = cell.get(META_KEY) ?? { ...EMPTY_NODE_META };

        const shapeKey = (meta.shapeType as string) || '';
        const componentType = ShapeRegistry[shapeKey]?.componentType ?? '';
        const typeId = componentType.toLowerCase().replace(/\s+/g, '-');
        const typeDef = typeId ? getDataType(typeId) : null;

        // Rebuild node section dynamically
        this.nodeSection.innerHTML = '';
        this.nodeInputs = {} as Record<keyof NodeMeta, HTMLInputElement | HTMLTextAreaElement>;
        this.nodeCustomInputs = {};

        // Always show Name first
        const { row: nameRow, input: nameInput } = this.buildRow('node-name', 'Name', 'Name');
        this.nodeInputs.name = nameInput as HTMLInputElement;
        nameInput.value = String(meta.name ?? '');
        nameInput.addEventListener('input', () => this.saveNode());
        this.nodeSection.appendChild(nameRow);

        // Product selector + type-specific fields
        if (typeDef && componentType) {
            const products = getProductsByType(componentType);
            const selectedProductId = (meta.productId as string) || '';
            const selectedProduct = selectedProductId ? getProduct(selectedProductId) : null;

            // Product dropdown
            if (products.length > 0 || selectedProductId) {
                const { row: prodRow, select: prodSelect } = this.buildSelectRow(
                    'node-product', `${componentType} Product`,
                    products.map(p => String(p.values.name || p.id))
                );
                // Use product IDs as values
                prodSelect.innerHTML = '';
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '— none —';
                prodSelect.appendChild(emptyOpt);
                for (const p of products) {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = String(p.values.name || p.id);
                    if (p.id === selectedProductId) opt.selected = true;
                    prodSelect.appendChild(opt);
                }
                prodSelect.addEventListener('change', () => {
                    meta.productId = prodSelect.value;
                    this.saveNode();
                    this.show(cell);
                });
                this.nodeSection.appendChild(prodRow);
            }

            // Type fields — read-only if product is selected
            for (const field of typeDef.fields) {
                if (field.key === 'id' || field.key === 'name') continue;

                let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
                let row: HTMLElement;

                if (field.type === 'select' && field.options?.length) {
                    const r = this.buildSelectRow(`node-type-${field.key}`, field.label, field.options);
                    row = r.row;
                    input = r.select;
                } else if (field.multiline) {
                    const r = this.buildRow(`node-type-${field.key}`, field.label, field.placeholder || field.label, true);
                    row = r.row;
                    input = r.input;
                } else {
                    const r = this.buildRow(`node-type-${field.key}`, field.label, field.placeholder || field.label);
                    row = r.row;
                    input = r.input;
                    if (field.type === 'number') (input as HTMLInputElement).type = 'number';
                }

                if (selectedProduct) {
                    input.value = String(selectedProduct.values[field.key] ?? '');
                    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
                        input.readOnly = true;
                    } else {
                        input.disabled = true;
                    }
                    input.classList.add('inspector-readonly');
                } else {
                    input.value = String(meta[field.key] ?? '');
                    input.addEventListener('input', () => this.saveNode());
                }

                this.nodeSection.appendChild(row);
                this.nodeCustomInputs[field.key] = input;
            }
        }

        // Notes (always shown)
        const { row: notesRow, input: notesInput } = this.buildRow('node-notes', 'Notes', 'Notes', true);
        this.nodeInputs.notes = notesInput as HTMLTextAreaElement;
        notesInput.value = String(meta.notes ?? '');
        notesInput.addEventListener('input', () => this.saveNode());
        this.nodeSection.appendChild(notesRow);

        // Hide label checkbox
        const { row: nodeLabelRow, input: nodeLabelInput } = this.buildCheckboxRow(
            'node-label-hidden', 'Hide label'
        );
        this.nodeLabelHiddenEl = nodeLabelInput;
        this.nodeLabelHiddenEl.checked = cell.attr('label/display') === 'none';
        this.nodeLabelHiddenEl.addEventListener('change', () => this.saveNode());
        this.nodeSection.appendChild(nodeLabelRow);

        // Custom fields from schema registry
        const customContainer = document.createElement('div');
        customContainer.className = 'inspector-custom-fields';
        this.nodeSection.appendChild(customContainer);
        this.nodeCustomContainer = customContainer;
        const schemaCustom = this.buildCustomFields(customContainer, 'node', meta, () => this.saveNode());
        Object.assign(this.nodeCustomInputs, schemaCustom);

        this.titleEl.textContent = componentType ? `${componentType} Properties` : 'Node Properties';
        this.nodeSection.style.display = '';
        this.zoneSection.style.display = 'none';
        this.linkSection.style.display = 'none';
        this.layerSection.style.display = 'none';
        this.duplicateBtn.style.display = '';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateZoneBtn.style.display = 'none';
        this.deleteBtn.style.display = '';
        this.deleteBtn.textContent = 'Delete';
        this.el.classList.remove('inspector-hidden');
    }

    showZone(frame: dia.Element) {
        this.currentZone = frame;
        this.currentNode = null;
        this.currentLink = null;
        this.zoneNameInput.value = (frame.attr('label/text') as string | undefined) ?? '';
        this.zoneLabelHiddenEl.checked = frame.attr('label/display') === 'none';

        this.selectedZoneColor = (frame.get('zoneColor') as string | undefined) ?? DEFAULT_ZONE_COLOR;
        this.syncZoneColorSwatches();

        this.zoneLabelPosPicker.setValue((frame.get('zoneLabelPosition') as string | undefined) ?? 'top-left');
        this.zoneLabelPosPicker.row.style.display = this.zoneLabelHiddenEl.checked ? 'none' : '';

        const zoneMeta: Record<string, unknown> = frame.get('zoneMeta') ?? {};
        this.zoneCustomInputs = this.buildCustomFields(
            this.zoneCustomContainer, 'zone', zoneMeta, () => this.saveZone()
        );

        this.titleEl.textContent = 'Zone Properties';
        this.nodeSection.style.display = 'none';
        this.zoneSection.style.display = '';
        this.linkSection.style.display = 'none';
        this.duplicateBtn.style.display = 'none';
        this.duplicateZoneBtn.style.display = '';
        this.deleteBtn.style.display = '';
        this.deleteBtn.textContent = 'Delete Zone';
        this.el.classList.remove('inspector-hidden');
    }

    showLink(link: dia.Link) {
        this.currentLink = link;
        this.currentNode = null;
        this.currentZone = null;
        const meta: Record<string, unknown> = link.get(LINK_META_KEY) ?? { ...EMPTY_LINK_META };
        for (const field of LINK_FIELDS) {
            this.linkInputs[field.key].value = String(meta[field.key] ?? '');
        }
        this.linkCustomInputs = this.buildCustomFields(
            this.linkCustomContainer, 'connection', meta, () => this.saveLink()
        );
        this.titleEl.textContent = 'Connection';
        this.nodeSection.style.display = 'none';
        this.zoneSection.style.display = 'none';
        this.linkSection.style.display = '';
        this.duplicateBtn.style.display = 'none';
        this.duplicateZoneBtn.style.display = 'none';
        this.deleteBtn.style.display = 'none';
        this.el.classList.remove('inspector-hidden');
    }

    showLayer(canvasId: string, onUpdate?: () => void, onLayerTypeChange?: () => void) {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;
        this.currentLayerId = canvasId;

        const canvas = getCanvas(canvasId);
        if (!canvas) { this.hide(); return; }

        // Hide other sections
        this.nodeSection.style.display = 'none';
        this.zoneSection.style.display = 'none';
        this.linkSection.style.display = 'none';
        this.duplicateBtn.style.display = 'none';
        this.duplicateZoneBtn.style.display = 'none';
        this.deleteBtn.style.display = 'none';

        // Rebuild layer section
        this.layerSection.innerHTML = '';
        this.layerSection.style.display = '';

        // Layer title
        const { row: nameRow, input: nameInput } = this.buildRow(
            'layer-name', 'Layer Title', 'Layer title'
        );
        nameInput.value = canvas.name;
        nameInput.addEventListener('input', () => {
            updateCanvas(canvasId, { name: nameInput.value });
            onUpdate?.();
        });
        this.layerSection.appendChild(nameRow);

        // Layer type
        const layerTypeDt = getDataType('layer-type');
        const typeOptions = layerTypeDt
            ? layerTypeDt.fields.map(f => f.key)
            : ['Infrastructure', 'Workloads'];

        const { row: typeRow, select: typeSelect } = this.buildSelectRow(
            'layer-type', 'Layer Type', typeOptions
        );
        typeSelect.value = canvas.layerType || '';
        typeSelect.addEventListener('change', () => {
            updateCanvas(canvasId, { layerType: typeSelect.value });
            onLayerTypeChange?.();
        });
        this.layerSection.appendChild(typeRow);

        this.titleEl.textContent = 'Layer Properties';
        this.el.classList.remove('inspector-hidden');
    }

    hide() {
        this.currentNode = null;
        this.currentLink = null;
        this.currentZone = null;
        this.currentLayerId = null;
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
