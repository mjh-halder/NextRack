import { getDataType, FieldDefinition } from './schema-registry';
import { carbonIconToString, CarbonIcon } from './icons';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import OverflowMenuVertical16 from '@carbon/icons/es/overflow-menu--vertical/16.js';
import ArrowUp16 from '@carbon/icons/es/arrow--up/16.js';
import ArrowDown16 from '@carbon/icons/es/arrow--down/16.js';
import Save16 from '@carbon/icons/es/save/16.js';
import Download16 from '@carbon/icons/es/download/16.js';
import Copy16 from '@carbon/icons/es/copy/16.js';

const ICON_TRASH = carbonIconToString(TrashCan16 as CarbonIcon);
const ICON_COPY  = carbonIconToString(Copy16 as CarbonIcon);
const ICON_OVERFLOW = carbonIconToString(OverflowMenuVertical16 as CarbonIcon);
const ICON_SORT_ASC = carbonIconToString(ArrowUp16 as CarbonIcon);
const ICON_SORT_DESC = carbonIconToString(ArrowDown16 as CarbonIcon);
const ICON_SAVE = carbonIconToString(Save16 as CarbonIcon);
const ICON_DOWNLOAD = carbonIconToString(Download16 as CarbonIcon);

const STORAGE_KEY = 'nextrack-product-catalog-v1';

const COMPONENT_TYPES = ['Server', 'Firewall', 'Switch', 'Storage', 'NIC'];

export interface ProductEntry {
    id: string;
    componentType: string;
    values: Record<string, unknown>;
}

function readProducts(): ProductEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ProductEntry[];
    } catch { return []; }
}

function writeProducts(products: ProductEntry[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }
    catch { /* non-critical */ }
}

export function getProductsByType(componentType: string): ProductEntry[] {
    return readProducts().filter(p => p.componentType === componentType);
}

export function getProduct(id: string): ProductEntry | undefined {
    return readProducts().find(p => p.id === id);
}

export function saveProduct(entry: ProductEntry): void {
    const products = readProducts().filter(p => p.id !== entry.id);
    products.push(entry);
    writeProducts(products);
}

export function deleteProduct(id: string): void {
    writeProducts(readProducts().filter(p => p.id !== id));
}

// ---- UI ----

let rootEl: HTMLDivElement | null = null;
let selectedType: string = COMPONENT_TYPES[0];
let searchTerm = '';
let sortKey = '';
let sortDir: 'asc' | 'desc' = 'asc';

export function initProductCatalog(container: HTMLDivElement): void {
    rootEl = container;
    container.classList.add('nr-dm');
    render();
}

function render(): void {
    if (!rootEl) return;
    rootEl.innerHTML = '';

    const body = document.createElement('div');
    body.className = 'nr-dm__body';
    rootEl.appendChild(body);

    const left = document.createElement('div');
    left.className = 'nr-dm__left';
    body.appendChild(left);

    const right = document.createElement('div');
    right.className = 'nr-dm__right';
    body.appendChild(right);

    buildTypeList(left);
    buildProductList(right);
}

function buildTypeList(container: HTMLElement): void {
    const header = document.createElement('div');
    header.className = 'nr-dm__left-header';
    const title = document.createElement('h2');
    title.className = 'nr-dm__left-title';
    title.textContent = 'Component Types';
    header.appendChild(title);
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'nr-dm__type-list';
    list.setAttribute('role', 'listbox');

    for (const ct of COMPONENT_TYPES) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'nr-dm__type-item';
        item.setAttribute('role', 'option');
        if (ct === selectedType) {
            item.classList.add('nr-dm__type-item--selected');
            item.setAttribute('aria-selected', 'true');
        }
        item.addEventListener('click', () => {
            selectedType = ct;
            searchTerm = '';
            render();
        });

        const label = document.createElement('span');
        label.className = 'nr-dm__type-label';
        label.textContent = ct;
        item.appendChild(label);

        const count = document.createElement('span');
        count.className = 'nr-dm__type-count';
        count.textContent = String(getProductsByType(ct).length);
        item.appendChild(count);

        list.appendChild(item);
    }

    container.appendChild(list);
}

function buildProductList(container: HTMLElement): void {
    const typeId = selectedType.toLowerCase().replace(/\s+/g, '-');
    const typeDef = getDataType(typeId);

    const products = getProductsByType(selectedType);

    // Header area (title + subtitle)
    const header = document.createElement('div');
    header.className = 'nr-dt__header';

    const title = document.createElement('h2');
    title.className = 'nr-dt__title';
    title.textContent = `${selectedType} Products`;
    header.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'nr-dt__subtitle';
    subtitle.textContent = `${products.length} product${products.length !== 1 ? 's' : ''} in catalog`;
    header.appendChild(subtitle);

    container.appendChild(header);

    // Toolbar (search + add + batch overlay)
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
        render();
    });
    toolbarActions.appendChild(searchInput);

    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'cds--btn cds--btn--primary nr-dt__add-btn';
    newBtn.textContent = 'Add new';
    newBtn.addEventListener('click', () => {
        const id = 'product-' + Date.now().toString(36);
        const values: Record<string, unknown> = { name: '' };
        saveProduct({ id, componentType: selectedType, values });
        render();
    });
    toolbarActions.appendChild(newBtn);

    toolbar.appendChild(toolbarActions);

    container.appendChild(toolbar);

    const columns = typeDef
        ? typeDef.fields.filter(f => f.key !== 'id')
        : [{ key: 'name', label: 'Name', type: 'text' as const, system: true }];

    const term = searchTerm.toLowerCase();
    let filtered = term
        ? products.filter(p => Object.values(p.values).some(v => String(v ?? '').toLowerCase().includes(term)))
        : [...products];

    if (sortKey) {
        filtered.sort((a, b) => {
            const av = String(a.values[sortKey] ?? '').toLowerCase();
            const bv = String(b.values[sortKey] ?? '').toLowerCase();
            const cmp = av.localeCompare(bv, undefined, { numeric: true });
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }

    // Selection state
    const selected = new Set<string>();
    const rowCheckboxes: HTMLInputElement[] = [];

    // Batch actions overlay (inside toolbar)
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

    const batchDuplicateBtn = document.createElement('button');
    batchDuplicateBtn.type = 'button';
    batchDuplicateBtn.className = 'nr-dt__batch-btn';
    batchDuplicateBtn.innerHTML = `Duplicate<span class="nr-dt__batch-btn-icon">${ICON_COPY}</span>`;
    batchDuplicateBtn.addEventListener('click', () => {
        selected.forEach(id => {
            const src = getProduct(id);
            if (!src) return;
            const clone: ProductEntry = {
                id: 'product-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                componentType: src.componentType,
                values: { ...src.values, name: (src.values.name ?? '') + ' (copy)' },
            };
            saveProduct(clone);
        });
        selected.clear();
        render();
    });
    batchActions.appendChild(batchDuplicateBtn);

    const batchDeleteBtn = document.createElement('button');
    batchDeleteBtn.type = 'button';
    batchDeleteBtn.className = 'nr-dt__batch-btn';
    batchDeleteBtn.innerHTML = `Delete<span class="nr-dt__batch-btn-icon">${ICON_TRASH}</span>`;
    batchDeleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete ${selected.size} product${selected.size !== 1 ? 's' : ''}?`)) return;
        selected.forEach(id => deleteProduct(id));
        render();
    });
    batchActions.appendChild(batchDeleteBtn);

    const batchCancelBtn = document.createElement('button');
    batchCancelBtn.type = 'button';
    batchCancelBtn.className = 'nr-dt__batch-btn nr-dt__batch-btn--cancel';
    batchCancelBtn.textContent = 'Cancel';
    batchCancelBtn.addEventListener('click', () => {
        selected.clear();
        syncSelection();
    });
    batchActions.appendChild(batchCancelBtn);

    batchBar.appendChild(batchActions);
    toolbar.appendChild(batchBar);

    // DataTable
    const tableWrap = document.createElement('div');
    tableWrap.className = 'nr-dt';

    const table = document.createElement('table');
    table.className = 'nr-dt__table';

    // Header
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const thCheckbox = document.createElement('th');
    thCheckbox.className = 'nr-dt__th nr-dt__th--checkbox';
    const selectAllWrap = document.createElement('div');
    selectAllWrap.className = 'nr-dt__checkbox-wrap';
    const selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.setAttribute('aria-label', 'Select all');
    selectAllCb.addEventListener('change', () => {
        if (selectAllCb.checked) {
            for (const p of filtered) selected.add(p.id);
        } else {
            selected.clear();
        }
        syncSelection();
    });
    selectAllWrap.appendChild(selectAllCb);
    thCheckbox.appendChild(selectAllWrap);
    headRow.appendChild(thCheckbox);

    for (const col of columns) {
        const th = document.createElement('th');
        th.className = 'nr-dt__th nr-dt__th--sortable';
        const thBtn = document.createElement('button');
        thBtn.type = 'button';
        thBtn.className = 'nr-dt__sort-btn';
        thBtn.textContent = col.label;
        if (sortKey === col.key) {
            const arrow = document.createElement('span');
            arrow.className = 'nr-dt__sort-icon';
            arrow.innerHTML = sortDir === 'asc' ? ICON_SORT_ASC : ICON_SORT_DESC;
            thBtn.appendChild(arrow);
            th.classList.add('nr-dt__th--sorted');
        }
        thBtn.addEventListener('click', () => {
            if (sortKey === col.key) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortKey = col.key;
                sortDir = 'asc';
            }
            render();
        });
        th.appendChild(thBtn);
        headRow.appendChild(th);
    }
    const thActions = document.createElement('th');
    thActions.className = 'nr-dt__th nr-dt__th--actions';
    headRow.appendChild(thActions);
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    const totalCols = columns.length + 2;

    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = totalCols;
        td.className = 'nr-dt__empty';
        td.textContent = term ? 'No products match your filter.' : 'No products yet. Click "Add" to create one.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        for (const product of filtered) {
            const tr = document.createElement('tr');
            tr.className = 'nr-dt__row';

            const tdCb = document.createElement('td');
            tdCb.className = 'nr-dt__cell nr-dt__cell--checkbox';
            const cbWrap = document.createElement('div');
            cbWrap.className = 'nr-dt__checkbox-wrap';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.productId = product.id;
            cb.setAttribute('aria-label', `Select ${product.values.name || product.id}`);
            cb.addEventListener('change', () => {
                if (cb.checked) selected.add(product.id);
                else selected.delete(product.id);
                syncSelection();
            });
            rowCheckboxes.push(cb);
            cbWrap.appendChild(cb);
            tdCb.appendChild(cbWrap);
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

                input.value = String(product.values[col.key] ?? '');
                input.addEventListener('change', () => {
                    product.values[col.key] = input.value;
                    saveProduct(product);
                });
                td.appendChild(input);
                tr.appendChild(td);
            }

            const tdActions = document.createElement('td');
            tdActions.className = 'nr-dt__cell nr-dt__cell--actions';
            const overflowBtn = document.createElement('button');
            overflowBtn.type = 'button';
            overflowBtn.className = 'nr-dt__overflow-btn';
            overflowBtn.title = 'Actions';
            overflowBtn.setAttribute('aria-label', 'Row actions');
            overflowBtn.innerHTML = ICON_OVERFLOW;
            overflowBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showRowMenu(overflowBtn, product);
            });
            tdActions.appendChild(overflowBtn);
            tr.appendChild(tdActions);

            tbody.appendChild(tr);
        }
    }

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);

    function syncSelection() {
        const count = selected.size;
        const active = count > 0;
        batchBar.classList.toggle('nr-dt__batch--active', active);
        toolbar.classList.toggle('nr-dt__toolbar--batch-active', active);
        batchCount.textContent = `${count} item${count !== 1 ? 's' : ''} selected`;
        selectAllCb.checked = filtered.length > 0 && count === filtered.length;
        selectAllCb.indeterminate = count > 0 && count < filtered.length;
        for (const cb of rowCheckboxes) {
            cb.checked = selected.has(cb.dataset.productId ?? '');
        }
    }

    function showRowMenu(anchor: HTMLElement, product: ProductEntry) {
        document.querySelectorAll('.nr-dt__row-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'nr-dt__row-menu';

        const deleteItem = document.createElement('button');
        deleteItem.type = 'button';
        deleteItem.className = 'nr-dt__row-menu-item nr-dt__row-menu-item--danger';
        deleteItem.textContent = 'Delete';
        deleteItem.addEventListener('click', () => {
            menu.remove();
            deleteProduct(product.id);
            render();
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

