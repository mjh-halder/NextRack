import { dia } from '@joint/core';
import IsometricShape from './shapes/isometric-shape';
import { ShapeRegistry } from './shapes/shape-registry';

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
        const { row: zoneLabelRow, input: zoneLabelInput } = this.buildCheckboxRow(
            'zone-label-hidden', 'Hide label'
        );
        this.zoneLabelHiddenEl = zoneLabelInput;
        this.zoneSection.appendChild(zoneLabelRow);
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

        // Save button
        const saveBar = document.createElement('div');
        saveBar.className = 'inspector-save-bar';
        const saveBtn = document.createElement('button');
        saveBtn.className = 'inspector-action-btn inspector-btn-primary';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => this.save());
        saveBar.appendChild(saveBtn);
        this.el.appendChild(saveBar);

        // Secondary action buttons
        const actionsEl = document.createElement('div');
        actionsEl.className = 'inspector-actions';

        this.duplicateBtn = document.createElement('button');
        this.duplicateBtn.className = 'inspector-action-btn inspector-btn-secondary';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateBtn.addEventListener('click', () => this.actions.onDuplicate());
        actionsEl.appendChild(this.duplicateBtn);

        this.duplicateZoneBtn = document.createElement('button');
        this.duplicateZoneBtn.className = 'inspector-action-btn inspector-btn-secondary';
        this.duplicateZoneBtn.textContent = 'Duplicate Zone';
        this.duplicateZoneBtn.addEventListener('click', () => {
            if (this.currentZone) this.actions.onDuplicateZone(this.currentZone);
        });
        actionsEl.appendChild(this.duplicateZoneBtn);

        this.deleteBtn = document.createElement('button');
        this.deleteBtn.className = 'inspector-action-btn inspector-btn-danger';
        this.deleteBtn.textContent = 'Delete';
        this.deleteBtn.addEventListener('click', () => this.actions.onDelete());
        actionsEl.appendChild(this.deleteBtn);

        this.el.appendChild(actionsEl);
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
        this.titleEl.textContent = 'Zone Properties';
        this.nodeSection.style.display = 'none';
        this.zoneSection.style.display = '';
        this.linkSection.style.display = 'none';
        this.duplicateBtn.style.display = 'none';
        this.duplicateZoneBtn.style.display = '';
        this.deleteBtn.style.display = 'none';
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
