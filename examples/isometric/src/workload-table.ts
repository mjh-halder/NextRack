import { getDataType, FieldDefinition } from './schema-registry';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import OverflowMenuVertical16 from '@carbon/icons/es/overflow-menu--vertical/16.js';
import ArrowUp16 from '@carbon/icons/es/arrow--up/16.js';
import ArrowDown16 from '@carbon/icons/es/arrow--down/16.js';
import Save16 from '@carbon/icons/es/save/16.js';
import Download16 from '@carbon/icons/es/download/16.js';

const ICON_TRASH = carbonIconToString(TrashCan16 as CarbonIcon);
const ICON_OVERFLOW = carbonIconToString(OverflowMenuVertical16 as CarbonIcon);
const ICON_SORT_ASC = carbonIconToString(ArrowUp16 as CarbonIcon);
const ICON_SORT_DESC = carbonIconToString(ArrowDown16 as CarbonIcon);
const ICON_SAVE = carbonIconToString(Save16 as CarbonIcon);
const ICON_DOWNLOAD = carbonIconToString(Download16 as CarbonIcon);

const STORAGE_PREFIX = 'nextrack-workload-';

export interface AppEntry {
    id: string;
    values: Record<string, unknown>;
}

function storageKey(canvasId: string): string {
    return STORAGE_PREFIX + canvasId;
}

function readEntries(canvasId: string): AppEntry[] {
    try {
        const raw = localStorage.getItem(storageKey(canvasId));
        if (!raw) return [];
        return JSON.parse(raw) as AppEntry[];
    } catch { return []; }
}

function writeEntries(canvasId: string, entries: AppEntry[]): void {
    try { localStorage.setItem(storageKey(canvasId), JSON.stringify(entries)); }
    catch { /* non-critical */ }
}

function saveEntry(canvasId: string, entry: AppEntry): void {
    const entries = readEntries(canvasId).filter(e => e.id !== entry.id);
    entries.push(entry);
    writeEntries(canvasId, entries);
}

function deleteEntry(canvasId: string, id: string): void {
    writeEntries(canvasId, readEntries(canvasId).filter(e => e.id !== id));
}

let containerEl: HTMLDivElement | null = null;
let currentCanvasId = '';
let searchTerm = '';
let sortKey = '';
let sortDir: 'asc' | 'desc' = 'asc';

export function initWorkloadTable(container: HTMLDivElement): void {
    containerEl = container;
}

export function showWorkloadTable(canvasId: string): void {
    currentCanvasId = canvasId;
    searchTerm = '';
    sortKey = '';
    renderTable();
}

export function hideWorkloadTable(): void {
    if (containerEl) {
        containerEl.style.display = 'none';
        containerEl.innerHTML = '';
    }
}

function renderTable(): void {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    containerEl.style.display = 'block';

    const typeDef = getDataType('application');
    const columns = typeDef
        ? typeDef.fields.filter(f => f.key !== 'id')
        : [{ key: 'name', label: 'Name', type: 'text' as const, system: true }];

    let entries = readEntries(currentCanvasId);

    const term = searchTerm.toLowerCase();
    if (term) {
        entries = entries.filter(e =>
            Object.values(e.values).some(v => String(v ?? '').toLowerCase().includes(term))
        );
    }
    if (sortKey) {
        entries.sort((a, b) => {
            const av = String(a.values[sortKey] ?? '').toLowerCase();
            const bv = String(b.values[sortKey] ?? '').toLowerCase();
            const cmp = av.localeCompare(bv, undefined, { numeric: true });
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }

    const allEntries = readEntries(currentCanvasId);

    // Header
    const header = document.createElement('div');
    header.className = 'nr-dt__header';
    const title = document.createElement('h2');
    title.className = 'nr-dt__title';
    title.textContent = 'Applications';
    header.appendChild(title);
    const subtitle = document.createElement('p');
    subtitle.className = 'nr-dt__subtitle';
    subtitle.textContent = `${allEntries.length} application${allEntries.length !== 1 ? 's' : ''}`;
    header.appendChild(subtitle);
    containerEl.appendChild(header);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'nr-dt__toolbar';

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'nr-dt__toolbar-actions';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'nr-dt__search';
    searchInput.placeholder = 'Filter...';
    searchInput.value = searchTerm;
    searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value;
        renderTable();
    });
    toolbarActions.appendChild(searchInput);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'cds--btn cds--btn--primary nr-dt__add-btn';
    addBtn.textContent = 'Add new';
    addBtn.addEventListener('click', () => {
        const id = 'app-' + Date.now().toString(36);
        saveEntry(currentCanvasId, { id, values: { name: '' } });
        renderTable();
    });
    toolbarActions.appendChild(addBtn);
    toolbar.appendChild(toolbarActions);

    // Batch bar
    const selected = new Set<string>();
    const rowCheckboxes: HTMLInputElement[] = [];

    const batchBar = document.createElement('div');
    batchBar.className = 'nr-dt__batch';

    const batchCount = document.createElement('span');
    batchCount.className = 'nr-dt__batch-count';
    batchBar.appendChild(batchCount);

    const batchActions = document.createElement('div');
    batchActions.className = 'nr-dt__batch-actions';

    const batchSaveBtn = document.createElement('button');
    batchSaveBtn.type = 'button';
    batchSaveBtn.className = 'nr-dt__batch-btn';
    batchSaveBtn.innerHTML = `Save<span class="nr-dt__batch-btn-icon">${ICON_SAVE}</span>`;
    batchActions.appendChild(batchSaveBtn);

    const batchDownloadBtn = document.createElement('button');
    batchDownloadBtn.type = 'button';
    batchDownloadBtn.className = 'nr-dt__batch-btn';
    batchDownloadBtn.innerHTML = `Download<span class="nr-dt__batch-btn-icon">${ICON_DOWNLOAD}</span>`;
    batchActions.appendChild(batchDownloadBtn);

    const batchDeleteBtn = document.createElement('button');
    batchDeleteBtn.type = 'button';
    batchDeleteBtn.className = 'nr-dt__batch-btn';
    batchDeleteBtn.innerHTML = `Delete<span class="nr-dt__batch-btn-icon">${ICON_TRASH}</span>`;
    batchDeleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete ${selected.size} application${selected.size !== 1 ? 's' : ''}?`)) return;
        selected.forEach(id => deleteEntry(currentCanvasId, id));
        renderTable();
    });
    batchActions.appendChild(batchDeleteBtn);

    const batchCancelBtn = document.createElement('button');
    batchCancelBtn.type = 'button';
    batchCancelBtn.className = 'nr-dt__batch-btn nr-dt__batch-btn--cancel';
    batchCancelBtn.textContent = 'Cancel';
    batchCancelBtn.addEventListener('click', () => { selected.clear(); syncSelection(); });
    batchActions.appendChild(batchCancelBtn);

    batchBar.appendChild(batchActions);
    toolbar.appendChild(batchBar);

    containerEl.appendChild(toolbar);

    // Table
    const tableWrap = document.createElement('div');
    tableWrap.className = 'nr-dt';
    const table = document.createElement('table');
    table.className = 'nr-dt__table';

    // Thead
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const thCb = document.createElement('th');
    thCb.className = 'nr-dt__th nr-dt__th--checkbox';
    const cbWrap = document.createElement('div');
    cbWrap.className = 'nr-dt__checkbox-wrap';
    const selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.setAttribute('aria-label', 'Select all');
    selectAllCb.addEventListener('change', () => {
        if (selectAllCb.checked) entries.forEach(e => selected.add(e.id));
        else selected.clear();
        syncSelection();
    });
    cbWrap.appendChild(selectAllCb);
    thCb.appendChild(cbWrap);
    headRow.appendChild(thCb);

    for (const col of columns) {
        const th = document.createElement('th');
        th.className = 'nr-dt__th nr-dt__th--sortable';
        const sortBtn = document.createElement('button');
        sortBtn.type = 'button';
        sortBtn.className = 'nr-dt__sort-btn';
        sortBtn.textContent = col.label;
        if (sortKey === col.key) {
            const arrow = document.createElement('span');
            arrow.className = 'nr-dt__sort-icon';
            arrow.innerHTML = sortDir === 'asc' ? ICON_SORT_ASC : ICON_SORT_DESC;
            sortBtn.appendChild(arrow);
            th.classList.add('nr-dt__th--sorted');
        }
        sortBtn.addEventListener('click', () => {
            if (sortKey === col.key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortKey = col.key; sortDir = 'asc'; }
            renderTable();
        });
        th.appendChild(sortBtn);
        headRow.appendChild(th);
    }

    const thActions = document.createElement('th');
    thActions.className = 'nr-dt__th nr-dt__th--actions';
    headRow.appendChild(thActions);
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Tbody
    const tbody = document.createElement('tbody');
    const totalCols = columns.length + 2;

    if (entries.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = totalCols;
        td.className = 'nr-dt__empty';
        td.textContent = term ? 'No applications match your filter.' : 'No applications yet. Click "Add new" to create one.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        for (const entry of entries) {
            const tr = document.createElement('tr');
            tr.className = 'nr-dt__row';

            const tdCb = document.createElement('td');
            tdCb.className = 'nr-dt__cell nr-dt__cell--checkbox';
            const rCbWrap = document.createElement('div');
            rCbWrap.className = 'nr-dt__checkbox-wrap';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.entryId = entry.id;
            cb.addEventListener('change', () => {
                if (cb.checked) selected.add(entry.id);
                else selected.delete(entry.id);
                syncSelection();
            });
            rowCheckboxes.push(cb);
            rCbWrap.appendChild(cb);
            tdCb.appendChild(rCbWrap);
            tr.appendChild(tdCb);

            for (const col of columns) {
                const td = document.createElement('td');
                td.className = 'nr-dt__cell';
                let input: HTMLInputElement | HTMLSelectElement;
                if (col.type === 'select' && (col as FieldDefinition).options?.length) {
                    input = document.createElement('select');
                    input.className = 'nr-dt__input';
                    const emptyOpt = document.createElement('option');
                    emptyOpt.value = '';
                    emptyOpt.textContent = '';
                    input.appendChild(emptyOpt);
                    for (const opt of (col as FieldDefinition).options!) {
                        const el = document.createElement('option');
                        el.value = opt;
                        el.textContent = opt;
                        input.appendChild(el);
                    }
                } else {
                    input = document.createElement('input');
                    input.type = col.type === 'number' ? 'number' : 'text';
                    input.className = 'nr-dt__input';
                }
                input.value = String(entry.values[col.key] ?? '');
                input.addEventListener('change', () => {
                    entry.values[col.key] = input.value;
                    saveEntry(currentCanvasId, entry);
                });
                td.appendChild(input);
                tr.appendChild(td);
            }

            const tdActions = document.createElement('td');
            tdActions.className = 'nr-dt__cell nr-dt__cell--actions';
            const overflowBtn = document.createElement('button');
            overflowBtn.type = 'button';
            overflowBtn.className = 'nr-dt__overflow-btn';
            overflowBtn.innerHTML = ICON_OVERFLOW;
            overflowBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showRowMenu(overflowBtn, entry);
            });
            tdActions.appendChild(overflowBtn);
            tr.appendChild(tdActions);

            tbody.appendChild(tr);
        }
    }

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    containerEl.appendChild(tableWrap);

    function syncSelection() {
        const count = selected.size;
        const active = count > 0;
        batchBar.classList.toggle('nr-dt__batch--active', active);
        toolbar.classList.toggle('nr-dt__toolbar--batch-active', active);
        batchCount.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        selectAllCb.checked = entries.length > 0 && count === entries.length;
        selectAllCb.indeterminate = count > 0 && count < entries.length;
        for (const c of rowCheckboxes) {
            c.checked = selected.has(c.dataset.entryId ?? '');
        }
    }

    function showRowMenu(anchor: HTMLElement, entry: AppEntry) {
        document.querySelectorAll('.nr-dt__row-menu').forEach(m => m.remove());
        const menu = document.createElement('div');
        menu.className = 'nr-dt__row-menu';
        const deleteItem = document.createElement('button');
        deleteItem.type = 'button';
        deleteItem.className = 'nr-dt__row-menu-item nr-dt__row-menu-item--danger';
        deleteItem.textContent = 'Delete';
        deleteItem.addEventListener('click', () => {
            menu.remove();
            deleteEntry(currentCanvasId, entry.id);
            renderTable();
        });
        menu.appendChild(deleteItem);
        anchor.parentElement!.style.position = 'relative';
        anchor.parentElement!.appendChild(menu);
        const close = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node) && e.target !== anchor) {
                menu.remove();
                document.removeEventListener('mousedown', close, true);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', close, true), 0);
    }
}
