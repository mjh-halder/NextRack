import {
    getDataTypes,
    getDataType,
    addDataType,
    removeDataType,
    addField,
    updateField,
    removeField,
    DataTypeDefinition,
    FieldDefinition,
    FieldType,
} from './schema-registry';
import {
    getRecords,
    createRecord,
    deleteRecord,
    canCreate,
    canDelete,
    AppRecord,
} from './record-source';

import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Edit16 from '@carbon/icons/es/edit/16.js';
import Locked16 from '@carbon/icons/es/locked/16.js';

const ICON_TRASH  = carbonIconToString(TrashCan16 as CarbonIcon);
const ICON_EDIT   = carbonIconToString(Edit16 as CarbonIcon);
const ICON_LOCKED = carbonIconToString(Locked16 as CarbonIcon);

const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: 'text',    label: 'Text' },
    { value: 'number',  label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'select',  label: 'Select' },
];

type DataTab = 'types' | 'app-data';

let rootEl: HTMLDivElement | null = null;
let selectedTypeId: string | null = null;
let typeSearchTerm = '';
let recordSearchTerm = '';
let activeTab: DataTab = 'types';

export function initDataModel(container: HTMLDivElement): void {
    rootEl = container;
    container.classList.add('nr-dm');
    render();

    document.addEventListener('nextrack:schema-changed', () => {
        if (rootEl?.style.display !== 'none') render();
    });
}

// ---- Top-level render ----

function render(): void {
    if (!rootEl) return;
    rootEl.innerHTML = '';

    const tabBar = document.createElement('div');
    tabBar.className = 'nr-dm__tab-bar';
    tabBar.setAttribute('role', 'tablist');

    for (const tab of [
        { id: 'types' as DataTab, label: 'Data types' },
        { id: 'app-data' as DataTab, label: 'App data' },
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-dm__tab';
        btn.setAttribute('role', 'tab');
        btn.textContent = tab.label;
        if (tab.id === activeTab) {
            btn.classList.add('nr-dm__tab--active');
            btn.setAttribute('aria-selected', 'true');
        }
        btn.addEventListener('click', () => {
            activeTab = tab.id;
            render();
        });
        tabBar.appendChild(btn);
    }
    rootEl.appendChild(tabBar);

    const body = document.createElement('div');
    body.className = 'nr-dm__body';
    rootEl.appendChild(body);

    if (activeTab === 'types') {
        renderDataTypes(body);
    } else {
        renderAppData(body);
    }
}

// ========================================================================
// DATA TYPES TAB
// ========================================================================

function renderDataTypes(container: HTMLElement): void {
    const left = document.createElement('div');
    left.className = 'nr-dm__left';
    container.appendChild(left);

    const right = document.createElement('div');
    right.className = 'nr-dm__right';
    container.appendChild(right);

    buildTypeList(left, false);

    if (selectedTypeId) {
        const dt = getDataType(selectedTypeId);
        if (dt) {
            buildFieldList(right, dt);
        } else {
            selectedTypeId = null;
            buildEmptyRight(right, 'Select a data type to view its fields.');
        }
    } else {
        buildEmptyRight(right, 'Select a data type to view its fields.');
    }
}

function buildTypeList(container: HTMLElement, showRecordCount: boolean): void {
    const header = document.createElement('div');
    header.className = 'nr-dm__left-header';

    const title = document.createElement('h2');
    title.className = 'nr-dm__left-title';
    title.textContent = showRecordCount ? 'Entities' : 'Data Types';
    header.appendChild(title);
    container.appendChild(header);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'nr-dm__search';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'nr-dm__search-input';
    searchInput.placeholder = 'Filter...';
    searchInput.value = typeSearchTerm;
    searchInput.setAttribute('aria-label', 'Filter data types');
    searchInput.addEventListener('input', () => {
        typeSearchTerm = searchInput.value;
        render();
    });
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    const list = document.createElement('div');
    list.className = 'nr-dm__type-list';
    list.setAttribute('role', 'listbox');

    const types = getDataTypes();
    const term = typeSearchTerm.toLowerCase();
    const filtered = term
        ? types.filter(t => t.label.toLowerCase().includes(term) || t.id.toLowerCase().includes(term))
        : types;

    for (const dt of filtered) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'nr-dm__type-item';
        item.setAttribute('role', 'option');
        if (dt.id === selectedTypeId) {
            item.classList.add('nr-dm__type-item--selected');
            item.setAttribute('aria-selected', 'true');
        }
        item.addEventListener('click', () => {
            selectedTypeId = dt.id;
            recordSearchTerm = '';
            render();
        });

        const label = document.createElement('span');
        label.className = 'nr-dm__type-label';
        label.textContent = dt.label;
        item.appendChild(label);

        if (!showRecordCount && dt.system) {
            const badge = document.createElement('span');
            badge.className = 'nr-dm__badge nr-dm__badge--system';
            badge.textContent = 'Built-in';
            item.appendChild(badge);
        }

        const count = document.createElement('span');
        count.className = 'nr-dm__type-count';
        if (showRecordCount) {
            const records = getRecords(dt.id);
            count.textContent = String(records.length);
        } else {
            count.textContent = String(dt.fields.length);
        }
        item.appendChild(count);

        list.appendChild(item);
    }

    container.appendChild(list);

    if (!showRecordCount) {
        const addWrap = document.createElement('div');
        addWrap.className = 'nr-dm__add-type';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm nr-dm__add-type-btn';
        addBtn.textContent = 'New data type';
        addBtn.addEventListener('click', () => showNewTypeDialog());
        addWrap.appendChild(addBtn);
        container.appendChild(addWrap);
    }
}

function buildEmptyRight(container: HTMLElement, message: string): void {
    const msg = document.createElement('div');
    msg.className = 'nr-dm__empty';
    msg.textContent = message;
    container.appendChild(msg);
}

function buildFieldList(container: HTMLElement, dt: DataTypeDefinition): void {
    const header = document.createElement('div');
    header.className = 'nr-dm__right-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'nr-dm__right-title-row';

    const title = document.createElement('h2');
    title.className = 'nr-dm__right-title';
    title.textContent = dt.label;
    titleRow.appendChild(title);

    if (!dt.system) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'cds--btn cds--btn--danger--tertiary cds--btn--sm';
        deleteBtn.textContent = 'Delete type';
        deleteBtn.addEventListener('click', () => {
            if (!confirm(`Delete data type "${dt.label}"? This will remove all its fields.`)) return;
            removeDataType(dt.id);
            selectedTypeId = null;
            render();
        });
        titleRow.appendChild(deleteBtn);
    }

    header.appendChild(titleRow);

    if (dt.description) {
        const desc = document.createElement('p');
        desc.className = 'nr-dm__right-desc';
        desc.textContent = dt.description;
        header.appendChild(desc);
    }

    container.appendChild(header);

    const table = document.createElement('table');
    table.className = 'nr-dm__field-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const col of ['Field Name', 'Key', 'Type', 'Origin', '']) {
        const th = document.createElement('th');
        th.textContent = col;
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const field of dt.fields) {
        tbody.appendChild(buildFieldRow(dt.id, field));
    }
    table.appendChild(tbody);
    container.appendChild(table);

    const addRow = document.createElement('div');
    addRow.className = 'nr-dm__add-field';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    addBtn.textContent = 'New field';
    addBtn.addEventListener('click', () => showNewFieldDialog(dt.id));
    addRow.appendChild(addBtn);
    container.appendChild(addRow);
}

function buildFieldRow(typeId: string, field: FieldDefinition): HTMLTableRowElement {
    const tr = document.createElement('tr');
    if (field.system) tr.classList.add('nr-dm__field-row--system');

    const tdLabel = document.createElement('td');
    tdLabel.textContent = field.label;
    tr.appendChild(tdLabel);

    const tdKey = document.createElement('td');
    tdKey.className = 'nr-dm__field-key';
    tdKey.textContent = field.key;
    tr.appendChild(tdKey);

    const tdType = document.createElement('td');
    tdType.textContent = FIELD_TYPES.find(ft => ft.value === field.type)?.label ?? field.type;
    tr.appendChild(tdType);

    const tdOrigin = document.createElement('td');
    if (field.system) {
        const badge = document.createElement('span');
        badge.className = 'nr-dm__badge nr-dm__badge--system';
        badge.innerHTML = ICON_LOCKED + ' System';
        tdOrigin.appendChild(badge);
    } else {
        const badge = document.createElement('span');
        badge.className = 'nr-dm__badge nr-dm__badge--user';
        badge.textContent = 'Custom';
        tdOrigin.appendChild(badge);
    }
    tr.appendChild(tdOrigin);

    const tdActions = document.createElement('td');
    tdActions.className = 'nr-dm__field-actions';

    if (!field.system) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'nr-dm__icon-btn';
        editBtn.title = 'Edit field';
        editBtn.setAttribute('aria-label', `Edit ${field.label}`);
        editBtn.innerHTML = ICON_EDIT;
        editBtn.addEventListener('click', () => showEditFieldDialog(typeId, field));
        tdActions.appendChild(editBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'nr-dm__icon-btn nr-dm__icon-btn--danger';
        delBtn.title = 'Delete field';
        delBtn.setAttribute('aria-label', `Delete ${field.label}`);
        delBtn.innerHTML = ICON_TRASH;
        delBtn.addEventListener('click', () => {
            if (!confirm(`Delete field "${field.label}"?`)) return;
            removeField(typeId, field.key);
            render();
        });
        tdActions.appendChild(delBtn);
    }

    tr.appendChild(tdActions);
    return tr;
}

// ========================================================================
// APP DATA TAB
// ========================================================================

function renderAppData(container: HTMLElement): void {
    const left = document.createElement('div');
    left.className = 'nr-dm__left';
    container.appendChild(left);

    const right = document.createElement('div');
    right.className = 'nr-dm__right';
    container.appendChild(right);

    buildTypeList(left, true);

    if (selectedTypeId) {
        const dt = getDataType(selectedTypeId);
        if (dt) {
            buildRecordView(right, dt);
        } else {
            selectedTypeId = null;
            buildEmptyRight(right, 'Select a data type to view its records.');
        }
    } else {
        buildEmptyRight(right, 'Select a data type to view its records.');
    }
}

function buildRecordView(container: HTMLElement, dt: DataTypeDefinition): void {
    let records: AppRecord[];
    try {
        records = getRecords(dt.id);
    } catch (e) {
        const errEl = document.createElement('div');
        errEl.className = 'nr-dm__error';
        errEl.textContent = `Failed to load records: ${e instanceof Error ? e.message : String(e)}`;
        container.appendChild(errEl);
        return;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'nr-dm__right-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'nr-dm__right-title-row';

    const title = document.createElement('h2');
    title.className = 'nr-dm__right-title';
    title.textContent = dt.label;
    titleRow.appendChild(title);

    const countBadge = document.createElement('span');
    countBadge.className = 'nr-dm__record-count';
    countBadge.textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;
    titleRow.appendChild(countBadge);

    if (canCreate(dt.id)) {
        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
        newBtn.textContent = 'New entry';
        newBtn.addEventListener('click', () => {
            showNewRecordDialog(dt);
        });
        titleRow.appendChild(newBtn);
    }

    header.appendChild(titleRow);

    if (dt.description) {
        const desc = document.createElement('p');
        desc.className = 'nr-dm__right-desc';
        desc.textContent = dt.description;
        header.appendChild(desc);
    }

    container.appendChild(header);

    // Record search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'nr-dm__record-search';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'nr-dm__search-input';
    searchInput.placeholder = `Filter ${dt.label.toLowerCase()} records...`;
    searchInput.value = recordSearchTerm;
    searchInput.setAttribute('aria-label', `Filter ${dt.label} records`);
    searchInput.addEventListener('input', () => {
        recordSearchTerm = searchInput.value;
        render();
    });
    searchWrap.appendChild(searchInput);
    container.appendChild(searchWrap);

    // Pick columns: use schema fields, cap to a sensible subset
    const columns = pickColumns(dt);

    // Filter records
    const term = recordSearchTerm.toLowerCase();
    const filtered = term
        ? records.filter(r => {
            return Object.values(r.values).some(v =>
                String(v ?? '').toLowerCase().includes(term)
            );
        })
        : records;

    // Table
    const table = document.createElement('table');
    table.className = 'nr-dm__field-table nr-dm__record-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const col of columns) {
        const th = document.createElement('th');
        th.textContent = col.label;
        headRow.appendChild(th);
    }
    if (canDelete(dt.id)) {
        const th = document.createElement('th');
        th.textContent = '';
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columns.length + (canDelete(dt.id) ? 1 : 0);
        td.className = 'nr-dm__record-empty-cell';
        td.textContent = term
            ? 'No records match your filter.'
            : 'No records yet.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        for (const record of filtered) {
            const tr = document.createElement('tr');

            for (const col of columns) {
                const td = document.createElement('td');
                const val = record.values[col.key];
                if (val === undefined || val === null || val === '') {
                    td.textContent = '—';
                    td.className = 'nr-dm__record-cell--empty';
                } else if (typeof val === 'boolean') {
                    td.textContent = val ? 'Yes' : 'No';
                } else {
                    const s = String(val);
                    td.textContent = s.length > 80 ? s.slice(0, 77) + '...' : s;
                }
                tr.appendChild(td);
            }

            if (canDelete(dt.id)) {
                const tdActions = document.createElement('td');
                tdActions.className = 'nr-dm__field-actions';
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'nr-dm__icon-btn nr-dm__icon-btn--danger';
                delBtn.title = 'Delete';
                delBtn.setAttribute('aria-label', `Delete record ${record.id}`);
                delBtn.innerHTML = ICON_TRASH;
                delBtn.addEventListener('click', () => {
                    if (!confirm('Delete this record?')) return;
                    deleteRecord(dt.id, record.id);
                    render();
                });
                tdActions.appendChild(delBtn);
                tr.appendChild(tdActions);
            }

            tbody.appendChild(tr);
        }
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

interface ColumnDef {
    key: string;
    label: string;
}

const MAX_COLUMNS = 8;

function pickColumns(dt: DataTypeDefinition): ColumnDef[] {
    const cols: ColumnDef[] = [];

    // Always show ID first if we have real records (not enum types)
    const hasIdField = dt.fields.some(f => f.key === 'id');
    if (hasIdField) {
        cols.push({ key: 'id', label: 'ID' });
    }

    for (const field of dt.fields) {
        if (field.key === 'id') continue;
        if (cols.length >= MAX_COLUMNS) break;
        cols.push({ key: field.key, label: field.label });
    }

    return cols;
}

// ---- New Record Dialog ----

function showNewRecordDialog(dt: DataTypeDefinition): void {
    const overlay = createOverlay();
    const dialog = createDialog(`New ${dt.label}`);

    const form = document.createElement('div');
    form.className = 'nr-dm__dialog-form';

    const editableFields = dt.fields.filter(f => {
        if (f.key === 'id') return false;
        if (f.key === 'category') return false;
        return true;
    });

    const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};

    for (const field of editableFields) {
        if (field.type === 'select' && field.options?.length) {
            const { row, select } = buildDialogSelect(field.label, field.options.map(o => ({ value: o, label: o })));
            form.appendChild(row);
            inputs[field.key] = select;
        } else {
            const { row, input } = buildDialogField(field.label, field.placeholder ?? '');
            if (field.type === 'number') input.type = 'number';
            form.appendChild(row);
            inputs[field.key] = input;
        }
    }

    dialog.appendChild(form);

    const errEl = document.createElement('div');
    errEl.className = 'nr-dm__dialog-error';
    dialog.appendChild(errEl);

    const actions = document.createElement('div');
    actions.className = 'nr-dm__dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    actions.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', () => {
        const values: Record<string, unknown> = {};
        for (const [key, input] of Object.entries(inputs)) {
            values[key] = input.value;
        }
        const result = createRecord(dt.id, values);
        if (!result) {
            errEl.textContent = 'Could not create record for this type.';
            return;
        }
        overlay.remove();
        render();
    });
    actions.appendChild(createBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const firstInput = Object.values(inputs)[0];
    if (firstInput) firstInput.focus();
}

// ========================================================================
// DATA TYPES DIALOGS (unchanged)
// ========================================================================

function showNewTypeDialog(): void {
    const overlay = createOverlay();
    const dialog = createDialog('New Data Type');

    const form = document.createElement('div');
    form.className = 'nr-dm__dialog-form';

    const { row: labelRow, input: labelInput } = buildDialogField('Label', 'e.g. Rack Unit');
    form.appendChild(labelRow);

    const { row: idRow, input: idInput } = buildDialogField('ID', 'e.g. rack-unit');
    form.appendChild(idRow);

    labelInput.addEventListener('input', () => {
        if (!idInput.dataset.edited) {
            idInput.value = labelInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
    });
    idInput.addEventListener('input', () => { idInput.dataset.edited = '1'; });

    const { row: descRow, input: descInput } = buildDialogField('Description', 'Optional description');
    form.appendChild(descRow);

    dialog.appendChild(form);

    const errEl = document.createElement('div');
    errEl.className = 'nr-dm__dialog-error';
    dialog.appendChild(errEl);

    const actions = document.createElement('div');
    actions.className = 'nr-dm__dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    actions.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', () => {
        const id = idInput.value.trim();
        const label = labelInput.value.trim();
        if (!id || !label) {
            errEl.textContent = 'Label and ID are required.';
            return;
        }
        if (getDataType(id)) {
            errEl.textContent = `A data type with ID "${id}" already exists.`;
            return;
        }
        addDataType(id, label, descInput.value.trim());
        selectedTypeId = id;
        overlay.remove();
        render();
    });
    actions.appendChild(createBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    labelInput.focus();
}

function showNewFieldDialog(typeId: string): void {
    const overlay = createOverlay();
    const dialog = createDialog('New Field');

    const form = document.createElement('div');
    form.className = 'nr-dm__dialog-form';

    const { row: labelRow, input: labelInput } = buildDialogField('Label', 'e.g. Serial Number');
    form.appendChild(labelRow);

    const { row: keyRow, input: keyInput } = buildDialogField('Key', 'e.g. serialNumber');
    form.appendChild(keyRow);

    labelInput.addEventListener('input', () => {
        if (!keyInput.dataset.edited) {
            keyInput.value = toCamelCase(labelInput.value);
        }
    });
    keyInput.addEventListener('input', () => { keyInput.dataset.edited = '1'; });

    const { row: typeRow, select: typeSelect } = buildDialogSelect('Type', FIELD_TYPES);
    form.appendChild(typeRow);

    const { row: placeholderRow, input: placeholderInput } = buildDialogField('Placeholder', 'Optional hint text');
    form.appendChild(placeholderRow);

    const optionsRow = document.createElement('div');
    optionsRow.className = 'nr-dm__dialog-row';
    optionsRow.style.display = 'none';
    const optionsLabel = document.createElement('label');
    optionsLabel.className = 'cds--label';
    optionsLabel.textContent = 'Options (comma-separated)';
    optionsRow.appendChild(optionsLabel);
    const optionsInput = document.createElement('input');
    optionsInput.type = 'text';
    optionsInput.className = 'nr-dm__dialog-input';
    optionsInput.placeholder = 'e.g. low, medium, high';
    optionsRow.appendChild(optionsInput);
    form.appendChild(optionsRow);

    typeSelect.addEventListener('change', () => {
        optionsRow.style.display = typeSelect.value === 'select' ? '' : 'none';
    });

    dialog.appendChild(form);

    const errEl = document.createElement('div');
    errEl.className = 'nr-dm__dialog-error';
    dialog.appendChild(errEl);

    const actions = document.createElement('div');
    actions.className = 'nr-dm__dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    actions.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', () => {
        const key = keyInput.value.trim();
        const label = labelInput.value.trim();
        const fieldType = typeSelect.value as FieldType;
        if (!key || !label) {
            errEl.textContent = 'Label and key are required.';
            return;
        }
        const dt = getDataType(typeId);
        if (dt?.fields.some(f => f.key === key)) {
            errEl.textContent = `A field with key "${key}" already exists.`;
            return;
        }
        const field: Omit<FieldDefinition, 'system'> = {
            key,
            label,
            type: fieldType,
            placeholder: placeholderInput.value.trim() || undefined,
        };
        if (fieldType === 'select') {
            field.options = optionsInput.value.split(',').map(o => o.trim()).filter(Boolean);
        }
        addField(typeId, field);
        overlay.remove();
        render();
    });
    actions.appendChild(createBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    labelInput.focus();
}

function showEditFieldDialog(typeId: string, field: FieldDefinition): void {
    const overlay = createOverlay();
    const dialog = createDialog('Edit Field');

    const form = document.createElement('div');
    form.className = 'nr-dm__dialog-form';

    const { row: labelRow, input: labelInput } = buildDialogField('Label', '');
    labelInput.value = field.label;
    form.appendChild(labelRow);

    const keyRow = document.createElement('div');
    keyRow.className = 'nr-dm__dialog-row';
    const keyLabel = document.createElement('label');
    keyLabel.className = 'cds--label';
    keyLabel.textContent = 'Key';
    keyRow.appendChild(keyLabel);
    const keyDisplay = document.createElement('span');
    keyDisplay.className = 'nr-dm__dialog-readonly';
    keyDisplay.textContent = field.key;
    keyRow.appendChild(keyDisplay);
    form.appendChild(keyRow);

    const { row: typeRow, select: typeSelect } = buildDialogSelect('Type', FIELD_TYPES);
    typeSelect.value = field.type;
    form.appendChild(typeRow);

    const { row: placeholderRow, input: placeholderInput } = buildDialogField('Placeholder', '');
    placeholderInput.value = field.placeholder ?? '';
    form.appendChild(placeholderRow);

    const optionsRow = document.createElement('div');
    optionsRow.className = 'nr-dm__dialog-row';
    optionsRow.style.display = field.type === 'select' ? '' : 'none';
    const optionsLabel = document.createElement('label');
    optionsLabel.className = 'cds--label';
    optionsLabel.textContent = 'Options (comma-separated)';
    optionsRow.appendChild(optionsLabel);
    const optionsInput = document.createElement('input');
    optionsInput.type = 'text';
    optionsInput.className = 'nr-dm__dialog-input';
    optionsInput.value = field.options?.join(', ') ?? '';
    optionsRow.appendChild(optionsInput);
    form.appendChild(optionsRow);

    typeSelect.addEventListener('change', () => {
        optionsRow.style.display = typeSelect.value === 'select' ? '' : 'none';
    });

    dialog.appendChild(form);

    const errEl = document.createElement('div');
    errEl.className = 'nr-dm__dialog-error';
    dialog.appendChild(errEl);

    const actions = document.createElement('div');
    actions.className = 'nr-dm__dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cds--btn cds--btn--secondary cds--btn--sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    actions.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
        const label = labelInput.value.trim();
        if (!label) {
            errEl.textContent = 'Label is required.';
            return;
        }
        const patch: Partial<Omit<FieldDefinition, 'key' | 'system'>> = {
            label,
            type: typeSelect.value as FieldType,
            placeholder: placeholderInput.value.trim() || undefined,
        };
        if (typeSelect.value === 'select') {
            patch.options = optionsInput.value.split(',').map(o => o.trim()).filter(Boolean);
        } else {
            patch.options = undefined;
        }
        updateField(typeId, field.key, patch);
        overlay.remove();
        render();
    });
    actions.appendChild(saveBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    labelInput.focus();
}

// ========================================================================
// SHARED HELPERS
// ========================================================================

function createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'nr-dm__overlay';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    return overlay;
}

function createDialog(titleText: string): HTMLDivElement {
    const dialog = document.createElement('div');
    dialog.className = 'nr-dm__dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', titleText);

    const title = document.createElement('h3');
    title.className = 'nr-dm__dialog-title';
    title.textContent = titleText;
    dialog.appendChild(title);

    return dialog;
}

function buildDialogField(labelText: string, placeholder: string): { row: HTMLElement; input: HTMLInputElement } {
    const row = document.createElement('div');
    row.className = 'nr-dm__dialog-row';
    const label = document.createElement('label');
    label.className = 'cds--label';
    label.textContent = labelText;
    row.appendChild(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'nr-dm__dialog-input';
    input.placeholder = placeholder;
    row.appendChild(input);
    return { row, input };
}

function buildDialogSelect(labelText: string, options: { value: string; label: string }[]): { row: HTMLElement; select: HTMLSelectElement } {
    const row = document.createElement('div');
    row.className = 'nr-dm__dialog-row';
    const label = document.createElement('label');
    label.className = 'cds--label';
    label.textContent = labelText;
    row.appendChild(label);
    const select = document.createElement('select');
    select.className = 'nr-dm__dialog-input';
    for (const opt of options) {
        const el = document.createElement('option');
        el.value = opt.value;
        el.textContent = opt.label;
        select.appendChild(el);
    }
    row.appendChild(select);
    return { row, select };
}

function toCamelCase(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
        .replace(/[^a-zA-Z0-9]/g, '');
}
