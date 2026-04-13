import { dia } from '@joint/core';
import IsometricShape from './shapes/isometric-shape';

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
}

export class PropertyPanel {

    private el: HTMLElement;
    private titleEl: HTMLElement;

    private nodeSection: HTMLElement;
    private linkSection: HTMLElement;
    private duplicateBtn: HTMLButtonElement;

    private currentNode: IsometricShape | null = null;
    private currentLink: dia.Link | null = null;

    private nodeInputs = {} as Record<keyof NodeMeta, HTMLInputElement | HTMLTextAreaElement>;
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

        // Node fields
        this.nodeSection = document.createElement('div');
        this.nodeSection.className = 'inspector-section';
        for (const field of NODE_FIELDS) {
            const { row, input } = this.buildRow(
                `node-${field.key}`, field.label, field.label, field.multiline
            );
            this.nodeInputs[field.key] = input as HTMLInputElement;
            input.addEventListener('input', () => this.saveNode());
            this.nodeSection.appendChild(row);
        }
        this.el.appendChild(this.nodeSection);

        // Link fields
        this.linkSection = document.createElement('div');
        this.linkSection.className = 'inspector-section';
        for (const field of LINK_FIELDS) {
            const { row, input } = this.buildRow(
                `link-${field.key}`, field.label, field.placeholder
            );
            this.linkInputs[field.key] = input as HTMLInputElement;
            input.addEventListener('input', () => this.saveLink());
            this.linkSection.appendChild(row);
        }
        this.el.appendChild(this.linkSection);

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'inspector-actions';

        this.duplicateBtn = document.createElement('button');
        this.duplicateBtn.className = 'inspector-action-btn inspector-btn-secondary';
        this.duplicateBtn.textContent = 'Duplicate';
        this.duplicateBtn.addEventListener('click', () => this.actions.onDuplicate());
        actions.appendChild(this.duplicateBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'inspector-action-btn inspector-btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => this.actions.onDelete());
        actions.appendChild(deleteBtn);

        this.el.appendChild(actions);
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
        const meta: NodeMeta = cell.get(META_KEY) ?? { ...EMPTY_NODE_META };
        for (const field of NODE_FIELDS) {
            this.nodeInputs[field.key].value = meta[field.key];
        }
        this.titleEl.textContent = 'Node Properties';
        this.nodeSection.style.display = '';
        this.linkSection.style.display = 'none';
        this.duplicateBtn.style.display = '';
        this.el.classList.remove('inspector-hidden');
    }

    showLink(link: dia.Link) {
        this.currentLink = link;
        this.currentNode = null;
        const meta: LinkMeta = link.get(LINK_META_KEY) ?? { ...EMPTY_LINK_META };
        for (const field of LINK_FIELDS) {
            this.linkInputs[field.key].value = meta[field.key];
        }
        this.titleEl.textContent = 'Connection';
        this.nodeSection.style.display = 'none';
        this.linkSection.style.display = '';
        this.duplicateBtn.style.display = 'none';
        this.el.classList.remove('inspector-hidden');
    }

    hide() {
        this.currentNode = null;
        this.currentLink = null;
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
