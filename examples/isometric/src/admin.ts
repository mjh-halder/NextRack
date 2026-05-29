// Admin area: Carbon-style left side-nav with two views.
//   - Icon Configuration: three sections + search (general / complex-only / available pool).
//   - User Settings:      placeholder for now.
//
// Wiring: initAdmin() is called once from index.ts. show()/hide() are driven by
// the app-level view switcher in index.ts.

import { ICON_CATALOG, IconCatalogEntry, getIconById, addUploadedIcon, addAwsIcons, removeAllAwsIcons, getAwsIconCount, addGcpIcons, removeAllGcpIcons, getGcpIconCount, addAzureIcons, removeAllAzureIcons, getAzureIconCount, addDesignIcons, removeAllDesignIcons, getDesignIconCount, onCatalogChange, ensureFullCatalog, ensureCarbonIcons, extractSvgEntriesFromZip } from './icon-catalog';
import { renderIcon } from './icon-renderer';
import { carbonIconToString, CarbonIcon } from './icons';
import Edit16 from '@carbon/icons/es/edit/16.js';
import TrashCan16 from '@carbon/icons/es/trash-can/16.js';
import Upload16 from '@carbon/icons/es/upload/16.js';
import SubtractAlt16 from '@carbon/icons/es/subtract--alt/16.js';
import Download16 from '@carbon/icons/es/download/16.js';
import { getPaletteIcon } from './shape-query';

const ACTION_ICON_EDIT    = carbonIconToString(Edit16 as CarbonIcon);
const ACTION_ICON_DELETE  = carbonIconToString(TrashCan16 as CarbonIcon);
const ACTION_ICON_PUBLISH = carbonIconToString(Upload16 as CarbonIcon);
const ACTION_ICON_REMOVE  = carbonIconToString(SubtractAlt16 as CarbonIcon);
const ACTION_ICON_DOWNLOAD = carbonIconToString(Download16 as CarbonIcon);
import {
    getAllConfig,
    setIconScope,
    IconScope,
} from './icon-config';
import { ShapeRegistry, ShapeDefinition, BUILT_IN_SHAPE_IDS, deleteShape, saveRegistryToStorage, addShape } from './shapes/shape-registry';
import { shapeStore } from './shape-store';
import { componentStore, ComponentDefinition } from './component-store';
import { listInventory, removeFromInventory, isDarkMode, SvgInventoryEntry } from './svg-inventory';

type AdminView = 'icon-config' | 'component-library' | 'inventory' | 'data' | 'user-settings';

let rootEl: HTMLDivElement | null = null;
let currentView: AdminView = 'icon-config';

// Search term is module-scoped so re-renders don't lose it.
let iconSearchTerm = '';

// Cap rendered results in the "Available" section: the full Carbon set is
// 2.5k+ icons and rendering them all would stall the main thread.
const AVAILABLE_MAX = 300;

const NAV_ITEMS: Array<{ id: AdminView; label: string }> = [
    { id: 'icon-config',       label: 'Icon Configuration' },
    { id: 'component-library', label: 'Component Library' },
    { id: 'inventory',         label: 'SVG Inventory' },
    { id: 'data',              label: 'Data' },
    { id: 'user-settings',     label: 'User Settings' },
];

export function initAdmin(container: HTMLDivElement): void {
    rootEl = container;
    container.classList.add('nr-admin');

    const sideNav = document.createElement('nav');
    sideNav.className = 'nr-admin__side-nav';
    sideNav.setAttribute('aria-label', 'Admin navigation');

    for (const item of NAV_ITEMS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-admin__nav-item';
        btn.dataset.view = item.id;
        btn.textContent = item.label;
        btn.addEventListener('click', () => selectView(item.id));
        sideNav.appendChild(btn);
    }

    container.appendChild(sideNav);

    const contentEl = document.createElement('div');
    contentEl.className = 'nr-admin__content';
    contentEl.id = 'nr-admin-content';
    container.appendChild(contentEl);

    selectView(currentView);

    document.addEventListener('nextrack:inventory-changed', () => {
        if (currentView === 'inventory' && rootEl) {
            const contentEl = rootEl.querySelector<HTMLDivElement>('.nr-admin__content');
            if (contentEl) renderInventory(contentEl);
        }
    });
}

function selectView(view: AdminView): void {
    if (!rootEl) return;
    currentView = view;

    rootEl.querySelectorAll<HTMLButtonElement>('.nr-admin__nav-item').forEach(btn => {
        const active = btn.dataset.view === view;
        btn.classList.toggle('nr-admin__nav-item--selected', active);
        btn.setAttribute('aria-current', active ? 'page' : 'false');
    });

    // Move data-model element back to body if leaving Data view
    const dmEl = document.getElementById('data-model');
    if (dmEl && dmEl.parentElement?.classList.contains('nr-admin__content')) {
        dmEl.style.display = 'none';
        dmEl.style.position = '';
        dmEl.style.inset = '';
        dmEl.style.left = '';
        dmEl.style.top = '';
        document.body.appendChild(dmEl);
    }

    const contentEl = rootEl.querySelector<HTMLDivElement>('.nr-admin__content');
    if (!contentEl) return;
    contentEl.innerHTML = '';
    contentEl.style.padding = '';
    contentEl.style.position = '';
    contentEl.style.overflow = '';
    if (view === 'icon-config')       renderIconConfig(contentEl);
    if (view === 'component-library') renderComponentLibrary(contentEl);
    if (view === 'inventory')         renderInventory(contentEl);
    if (view === 'data')              renderDataView(contentEl);
    if (view === 'user-settings')     renderUserSettings(contentEl);
}

function renderDataView(container: HTMLElement): void {
    const dmEl = document.getElementById('data-model');
    if (!dmEl) return;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.padding = '0';
    dmEl.style.display = 'flex';
    dmEl.style.position = 'absolute';
    dmEl.style.inset = '0';
    dmEl.style.left = '0';
    dmEl.style.top = '0';
    container.appendChild(dmEl);
}

function renderComponentLibrary(container: HTMLElement): void {
    const host = document.createElement('div');
    container.appendChild(host);

    const render = () => {
        host.innerHTML = '';
        buildBackupSection(host, render);
        buildGeneralComponentsSection(host, render);
        buildUserComponentsSection(host, render);
    };
    render();
}

// ── Backup / Restore ─────────────────────────────────────────────────────────
//
// Two flows:
//   1. Export/Import JSON — non-developer backup. Download a JSON snapshot of
//      every non-built-in Shape, re-upload to restore after a localStorage
//      clear or a move to a different machine/browser.
//   2. Export as code — developer flow. Produces a TS snippet to paste into a
//      seed file so the Shapes ship in code and survive every reset.

function getUserShapeEntries(): Array<[string, ShapeDefinition]> {
    return Object.entries(ShapeRegistry).filter(([id]) => !BUILT_IN_SHAPE_IDS.has(id));
}

function downloadFile(filename: string, content: string, mime = 'application/json'): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function buildBackupSection(host: HTMLElement, rerender: () => void): void {
    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.textContent = 'Backup & Restore';
    host.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent = 'Components you build in the Component Designer live in your browser\'s localStorage. Clearing site data wipes them — back them up first.';
    host.appendChild(desc);

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.flexWrap = 'wrap';
    row.style.marginBottom = '16px';
    host.appendChild(row);

    const userShapes = getUserShapeEntries();
    const count = userShapes.length;

    // Export JSON
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    exportBtn.textContent = `Export ${count} component${count === 1 ? '' : 's'} (JSON)`;
    exportBtn.disabled = count === 0;
    exportBtn.addEventListener('click', () => {
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            shapes: Object.fromEntries(userShapes),
        };
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        downloadFile(`nextrack-shapes-${ts}.json`, JSON.stringify(payload, null, 2));
    });
    row.appendChild(exportBtn);

    // Import JSON
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    importBtn.textContent = 'Import (JSON)';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.style.display = 'none';
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const shapes: Record<string, ShapeDefinition> | undefined = parsed?.shapes ?? parsed;
            if (!shapes || typeof shapes !== 'object') {
                alert('Import failed: file does not contain a "shapes" object.');
                return;
            }
            let added = 0;
            let skipped = 0;
            for (const [id, def] of Object.entries(shapes)) {
                if (BUILT_IN_SHAPE_IDS.has(id)) { skipped++; continue; }
                if (ShapeRegistry[id] && !confirm(`Shape "${(def as ShapeDefinition).displayName || id}" already exists. Overwrite?`)) {
                    skipped++;
                    continue;
                }
                addShape(id, def as ShapeDefinition);
                added++;
            }
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            alert(`Imported ${added} component${added === 1 ? '' : 's'}${skipped > 0 ? `, ${skipped} skipped` : ''}.`);
            rerender();
        } catch (e) {
            alert(`Import failed: ${(e as Error).message}`);
        } finally {
            fileInput.value = '';
        }
    });
    row.appendChild(importBtn);
    row.appendChild(fileInput);

    // Export as code (developer flow — paste into a seed file).
    const codeBtn = document.createElement('button');
    codeBtn.type = 'button';
    codeBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    codeBtn.textContent = 'Export as code';
    codeBtn.title = 'Generate a TS snippet to paste into src/shape-seed.ts — components seeded in code survive every localStorage clear.';
    codeBtn.disabled = count === 0;
    row.appendChild(codeBtn);

    const codePanel = document.createElement('div');
    codePanel.style.display = 'none';
    codePanel.style.marginBottom = '16px';
    host.appendChild(codePanel);

    const codeHint = document.createElement('p');
    codeHint.style.fontSize = '12px';
    codeHint.style.color = 'var(--cds-text-helper, #6f6f6f)';
    codeHint.style.margin = '0 0 6px';
    codeHint.textContent = 'Paste this into src/shape-seed.ts (create the file if it doesn\'t exist) and import-then-call seedUserShapesFromCode() once on startup. Components seeded this way survive every localStorage clear.';
    codePanel.appendChild(codeHint);

    const codeArea = document.createElement('textarea');
    codeArea.readOnly = true;
    codeArea.spellcheck = false;
    codeArea.style.width = '100%';
    codeArea.style.minHeight = '320px';
    codeArea.style.fontFamily = 'monospace';
    codeArea.style.fontSize = '11px';
    codeArea.style.padding = '8px';
    codeArea.style.border = '1px solid var(--cds-border-subtle-01, #e0e0e0)';
    codeArea.style.borderRadius = '2px';
    codeArea.style.background = 'var(--cds-layer-01, #f4f4f4)';
    codePanel.appendChild(codeArea);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    copyBtn.textContent = 'Copy to clipboard';
    copyBtn.style.marginTop = '6px';
    copyBtn.addEventListener('click', () => {
        try {
            navigator.clipboard?.writeText(codeArea.value);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 1200);
        } catch { /* ignore */ }
    });
    codePanel.appendChild(copyBtn);

    codeBtn.addEventListener('click', () => {
        codeArea.value = buildSeedCode(userShapes);
        codePanel.style.display = '';
        codeArea.select();
    });
}

function buildSeedCode(entries: Array<[string, ShapeDefinition]>): string {
    const body = entries.map(([id, def]) => `    ${JSON.stringify(id)}: ${JSON.stringify(def, null, 4).replace(/\n/g, '\n    ')},`).join('\n');
    return [
        '// Auto-generated by the Admin "Export as code" action. Paste / commit',
        '// to seed user components in code so they survive every localStorage',
        '// clear. Call seedUserShapesFromCode() once on app startup (e.g. from',
        '// index.ts, right after loadRegistryFromStorage()).',
        '',
        'import { ShapeDefinition, ShapeRegistry, addShape, saveRegistryToStorage } from \'./shapes/shape-registry\';',
        '',
        'export const SEEDED_USER_SHAPES: Record<string, ShapeDefinition> = {',
        body,
        '};',
        '',
        'export function seedUserShapesFromCode(): void {',
        '    let touched = false;',
        '    for (const [id, def] of Object.entries(SEEDED_USER_SHAPES)) {',
        '        // Only seed when the registry doesn\'t already have a (possibly',
        '        // edited) copy — never clobber user changes made after this',
        '        // file was generated.',
        '        if (!ShapeRegistry[id]) {',
        '            addShape(id, def);',
        '            touched = true;',
        '        }',
        '    }',
        '    if (touched) saveRegistryToStorage();',
        '}',
    ].join('\n');
}

function buildInventoryCard(entry: SvgInventoryEntry, container: HTMLElement): HTMLElement {
    const svgLight = entry.svgLight ?? (entry as any).svg ?? '';
    const svgDark  = entry.svgDark  ?? svgLight;

    const card = document.createElement('div');
    card.className = 'nr-admin__inventory-card';

    const preview = document.createElement('div');
    preview.className = 'nr-admin__inventory-preview';

    const lightWrap = document.createElement('div');
    lightWrap.className = 'nr-admin__inventory-svg--light';
    lightWrap.innerHTML = svgLight;
    const darkWrap = document.createElement('div');
    darkWrap.className = 'nr-admin__inventory-svg--dark';
    darkWrap.innerHTML = svgDark;

    preview.appendChild(lightWrap);
    preview.appendChild(darkWrap);
    card.appendChild(preview);

    const label = document.createElement('div');
    label.className = 'nr-admin__inventory-label';
    label.textContent = entry.displayName;
    label.title = entry.displayName;
    card.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'nr-admin__inventory-actions';

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'nr-admin__inventory-icon-btn';
    dlBtn.title = 'Download';
    dlBtn.setAttribute('aria-label', 'Download');
    dlBtn.innerHTML = ACTION_ICON_DOWNLOAD;
    dlBtn.addEventListener('click', () => {
        const svg = isDarkMode() ? svgDark : svgLight;
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = entry.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    actions.appendChild(dlBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'nr-admin__inventory-icon-btn nr-admin__inventory-icon-btn--danger';
    delBtn.title = 'Remove';
    delBtn.setAttribute('aria-label', 'Remove');
    delBtn.innerHTML = ACTION_ICON_DELETE;
    delBtn.addEventListener('click', () => {
        removeFromInventory(entry.componentId);
        renderInventory(container);
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
}

function renderInventory(container: HTMLElement): void {
    container.innerHTML = '';

    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.textContent = 'SVG Inventory';
    container.appendChild(heading);

    const entries = listInventory();
    if (entries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No SVGs in inventory yet.';
        container.appendChild(empty);
        return;
    }

    const groups = new Map<string, SvgInventoryEntry[]>();
    for (const entry of entries) {
        const col = entry.collection || 'General';
        if (!groups.has(col)) groups.set(col, []);
        groups.get(col)!.push(entry);
    }

    groups.forEach((items, col) => {
        const section = document.createElement('div');
        section.className = 'nr-admin__inventory-section';

        const title = document.createElement('h3');
        title.className = 'nr-admin__inventory-section-title';
        title.textContent = col;
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'nr-admin__inventory-grid';

        for (const entry of items) {
            grid.appendChild(buildInventoryCard(entry, container));
        }

        section.appendChild(grid);
        container.appendChild(section);
    });
}

function buildShapeRow(
    id: string,
    def: ShapeDefinition,
    actions: HTMLElement,
    onCollectionChange?: (value: string) => void,
): HTMLTableRowElement {
    const tr = document.createElement('tr');

    const tdThumb = document.createElement('td');
    tdThumb.className = 'nr-admin__table-thumb';
    const catId = getPaletteIcon(def)?.iconId;
    if (catId) {
        const rendered = renderIcon(catId, 'tree');
        if (rendered) {
            tdThumb.innerHTML = rendered.html;
            if (rendered.cssClass) tdThumb.classList.add(rendered.cssClass);
        }
    }
    tr.appendChild(tdThumb);

    const tdId = document.createElement('td');
    tdId.textContent = id;
    tdId.className = 'nr-admin__table-mono';
    tr.appendChild(tdId);

    const tdName = document.createElement('td');
    tdName.textContent = def.displayName || '—';
    tr.appendChild(tdName);

    const tdCollection = document.createElement('td');
    if (onCollectionChange) {
        const select = document.createElement('select');
        select.className = 'nr-admin__table-select';
        for (const col of getComponentCollections()) {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col;
            if ((def.collection || 'General') === col) opt.selected = true;
            select.appendChild(opt);
        }
        select.addEventListener('change', () => onCollectionChange(select.value));
        tdCollection.appendChild(select);
    } else {
        tdCollection.textContent = def.collection || 'General';
    }
    tr.appendChild(tdCollection);

    const layer0 = def.layers?.[0];

    const tdBase = document.createElement('td');
    tdBase.textContent = layer0?.baseShape || '—';
    tr.appendChild(tdBase);

    const tdSize = document.createElement('td');
    const w = Math.round(layer0?.width ?? 0);
    const h = Math.round(layer0?.height ?? 0);
    tdSize.textContent = `${w}×${h}`;
    tr.appendChild(tdSize);

    const tdDepth = document.createElement('td');
    tdDepth.textContent = String(Math.round(layer0?.depth ?? 0));
    tr.appendChild(tdDepth);

    const tdComplex = document.createElement('td');
    const layerCount = def.layers?.length ?? 0;
    tdComplex.textContent = layerCount > 1 ? `Yes (${layerCount} layers)` : 'No';
    tr.appendChild(tdComplex);

    const tdActions = document.createElement('td');
    tdActions.className = 'nr-admin__table-actions';
    tdActions.appendChild(actions);
    tr.appendChild(tdActions);

    return tr;
}

function createActionBtn(iconSvg: string, label: string, onClick: () => void, danger = false): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nr-admin__table-btn' + (danger ? ' nr-admin__table-btn--danger' : '');
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = iconSvg;
    btn.addEventListener('click', onClick);
    return btn;
}

import { getDataType } from './schema-registry';

export function getComponentCollections(): string[] {
    const dt = getDataType('component-collection');
    if (!dt) return ['General'];
    return dt.fields.map(f => f.key);
}

export type ComponentCollection = string;

const TABLE_COLUMNS = ['', 'ID', 'Display Name', 'Collection', 'Base Shape', 'Size (W×H)', 'Depth', 'Complex', ''];

function buildTableHead(): HTMLTableSectionElement {
    const thead = document.createElement('thead');
    const row = document.createElement('tr');
    for (const col of TABLE_COLUMNS) {
        const th = document.createElement('th');
        th.textContent = col;
        row.appendChild(th);
    }
    thead.appendChild(row);
    return thead;
}

function ensureComponent(id: string, def: ShapeDefinition, category: 'general' | 'user'): void {
    if (!componentStore.get(category, id)) {
        componentStore.save({
            id,
            name: def.displayName || id,
            category,
            shapeId: id,
            properties: {},
        });
    }
}

function buildGeneralComponentsSection(host: HTMLElement, rerender: () => void): void {
    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.textContent = 'General Components';
    host.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent = 'Product-level components available to all users.';
    host.appendChild(desc);

    const generalShapes = shapeStore.list('general');

    if (generalShapes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No general components yet. Promote components from User Components below.';
        host.appendChild(empty);
        return;
    }

    const table = document.createElement('table');
    table.className = 'nr-admin__table';
    table.appendChild(buildTableHead());

    const tbody = document.createElement('tbody');
    for (const stored of generalShapes) {
        const actions = document.createElement('div');
        actions.className = 'nr-admin__table-action-group';

        const editBtn = createActionBtn(ACTION_ICON_EDIT, 'Edit', () => {
            document.dispatchEvent(new CustomEvent('nextrack:navigate-to-shape', { detail: { shapeId: stored.id } }));
        });
        actions.appendChild(editBtn);

        const removeBtn = createActionBtn(ACTION_ICON_REMOVE, 'Demote to User Component', () => {
            if (!confirm(`Move "${stored.definition.displayName || stored.id}" back to User Components?`)) return;
            shapeStore.remove('general', stored.id);
            shapeStore.save('user', stored.id, stored.definition);
            const comp = componentStore.get('general', stored.id);
            if (comp) {
                componentStore.remove('general', stored.id);
                componentStore.save({ ...comp, category: 'user' });
            }
            rerender();
        });
        actions.appendChild(removeBtn);

        const deleteBtn = createActionBtn(ACTION_ICON_DELETE, 'Delete', () => {
            if (!confirm(`Delete general component "${stored.definition.displayName || stored.id}"?`)) return;
            shapeStore.remove('general', stored.id);
            componentStore.remove('general', stored.id);
            deleteShape(stored.id);
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            rerender();
        }, true);
        actions.appendChild(deleteBtn);

        tbody.appendChild(buildShapeRow(stored.id, stored.definition, actions, (value) => {
            stored.definition.collection = value === 'General' ? undefined : value;
            shapeStore.save('general', stored.id, stored.definition);
            if (ShapeRegistry[stored.id]) {
                ShapeRegistry[stored.id].collection = stored.definition.collection;
                saveRegistryToStorage();
            }
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
        }));
    }

    table.appendChild(tbody);
    host.appendChild(table);
}

function buildUserComponentsSection(host: HTMLElement, rerender: () => void): void {
    const heading = document.createElement('h2');
    heading.className = 'nr-admin__heading';
    heading.style.marginTop = '2rem';
    heading.textContent = 'User Components';
    host.appendChild(heading);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent = 'Your private components. Promote them to General to make them available to all users.';
    host.appendChild(desc);

    const generalIds = new Set(shapeStore.list('general').map(s => s.id));

    const userShapes = Object.entries(ShapeRegistry).filter(
        ([id]) => !BUILT_IN_SHAPE_IDS.has(id) && !generalIds.has(id)
    );

    if (userShapes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No user components. Create components in the Component Designer.';
        host.appendChild(empty);
        return;
    }

    const table = document.createElement('table');
    table.className = 'nr-admin__table';
    table.appendChild(buildTableHead());

    const tbody = document.createElement('tbody');
    for (const [id, def] of userShapes) {
        const actions = document.createElement('div');
        actions.className = 'nr-admin__table-action-group';

        const editBtn = createActionBtn(ACTION_ICON_EDIT, 'Edit', () => {
            document.dispatchEvent(new CustomEvent('nextrack:navigate-to-shape', { detail: { shapeId: id } }));
        });
        actions.appendChild(editBtn);

        const promoteBtn = createActionBtn(ACTION_ICON_PUBLISH, 'Promote to General Component', () => {
            shapeStore.save('general', id, def);
            ensureComponent(id, def, 'general');
            componentStore.remove('user', id);
            rerender();
        });
        actions.appendChild(promoteBtn);

        const deleteBtn = createActionBtn(ACTION_ICON_DELETE, 'Delete', () => {
            if (!confirm(`Delete user component "${def.displayName || id}"?`)) return;
            deleteShape(id);
            saveRegistryToStorage();
            shapeStore.remove('user', id);
            componentStore.remove('user', id);
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            rerender();
        }, true);
        actions.appendChild(deleteBtn);

        tbody.appendChild(buildShapeRow(id, def, actions, (value) => {
            def.collection = value === 'General' ? undefined : value;
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
        }));
    }

    table.appendChild(tbody);
    host.appendChild(table);
}

function renderUserSettings(container: HTMLElement): void {
    const h = document.createElement('h2');
    h.className = 'nr-admin__heading';
    h.textContent = 'User Settings';
    container.appendChild(h);
    renderColorAdjustmentSection(container);
    renderIconRenderingSection(container);
}

// ── Color Adjustment (live tuning of the theme colour derivation) ──────────
// Per-theme tuning UI: pick Default / AWS / GCP / Azure → tweak sliders for
// just that theme. The result (the four hex tokens) is what the rest of the
// app consumes; the derivation parameters are internal to this UI.

function renderColorAdjustmentSection(container: HTMLElement): void {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const cd = require('./color-derivation') as typeof import('./color-derivation');
    const sc = require('./shapes/shape-capabilities') as typeof import('./shapes/shape-capabilities');
    /* eslint-enable @typescript-eslint/no-require-imports */

    type ThemeKey = import('./color-derivation').TunableTheme;
    type Settings = import('./color-derivation').ColorDerivationSettings;

    const THEMES: Array<{ key: ThemeKey; label: string }> = [
        { key: 'default', label: 'Default' },
        { key: 'aws',     label: 'AWS (Amazon Yellow)' },
        { key: 'gcp',     label: 'GCP (Google Neutral)' },
        { key: 'azure',   label: 'Azure (Microsoft Blue)' },
    ];

    let activeTheme: ThemeKey = 'default';

    const wrap = document.createElement('section');
    wrap.style.marginTop = '24px';
    wrap.style.padding = '16px';
    wrap.style.border = '1px solid var(--cds-border-subtle-01, #e0e0e0)';
    wrap.style.borderRadius = '2px';

    const title = document.createElement('h3');
    title.textContent = 'Color Adjustment';
    title.style.margin = '0 0 4px';
    wrap.appendChild(title);

    const sub = document.createElement('p');
    sub.style.margin = '0 0 16px';
    sub.style.fontSize = '12px';
    sub.style.color = 'var(--cds-text-helper, #6f6f6f)';
    sub.textContent = 'Pick a theme, then tune its OKLCH-based derivation parameters. The resulting hex tokens are stored per theme and consumed by the rest of the app — the derivation logic itself is just the tuning tool here.';
    wrap.appendChild(sub);

    // ── Theme switcher ─────────────────────────────────────────────────
    const switcher = document.createElement('div');
    switcher.style.display = 'flex';
    switcher.style.gap = '4px';
    switcher.style.marginBottom = '16px';
    const switcherBtns: Partial<Record<ThemeKey, HTMLButtonElement>> = {};
    for (const t of THEMES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cds--btn cds--btn--sm ' + (t.key === activeTheme ? 'cds--btn--primary' : 'cds--btn--tertiary');
        btn.textContent = t.label;
        btn.addEventListener('click', () => {
            activeTheme = t.key;
            for (const [k, b] of Object.entries(switcherBtns)) {
                if (!b) continue;
                b.className = 'cds--btn cds--btn--sm ' + (k === activeTheme ? 'cds--btn--primary' : 'cds--btn--tertiary');
            }
            refreshKnobs();
            refreshActivePreview();
        });
        switcherBtns[t.key] = btn;
        switcher.appendChild(btn);
    }
    wrap.appendChild(switcher);

    // ── Base hex display ───────────────────────────────────────────────
    const baseRow = document.createElement('div');
    baseRow.style.fontSize = '12px';
    baseRow.style.margin = '0 0 12px';
    baseRow.style.color = 'var(--cds-text-secondary, #525252)';
    wrap.appendChild(baseRow);

    // ── Slider grid for the active theme ───────────────────────────────
    interface Knob { key: keyof Settings; label: string; min: number; max: number; step: number; neutralOnly?: boolean; coloredOnly?: boolean }
    const knobs: Knob[] = [
        { key: 'lightFillLightnessDelta',   label: 'Light Mode Fill Adjustment',  min: -0.5, max: 0.5, step: 0.01, coloredOnly: true },
        { key: 'darkFillLightnessDelta',    label: 'Dark Mode Fill Adjustment',   min: -0.5, max: 0.5, step: 0.01, coloredOnly: true },
        { key: 'lightEdgeLightnessDelta',   label: 'Light Mode Edge Contrast',    min: -0.5, max: 0.5, step: 0.01, coloredOnly: true },
        { key: 'darkEdgeLightnessDelta',    label: 'Dark Mode Edge Contrast',     min: -0.5, max: 0.5, step: 0.01, coloredOnly: true },
        { key: 'lightChromaMultiplier',     label: 'Chroma Adjustment Light',     min:  0,   max: 2,   step: 0.05, coloredOnly: true },
        { key: 'darkChromaMultiplier',      label: 'Chroma Adjustment Dark',      min:  0,   max: 2,   step: 0.05, coloredOnly: true },
        { key: 'neutralLightFillLightness', label: 'Neutral Light Fill Lightness',min:  0,   max: 1,   step: 0.01, neutralOnly: true },
        { key: 'neutralDarkFillLightness',  label: 'Neutral Dark Fill Lightness', min:  0,   max: 1,   step: 0.01, neutralOnly: true },
        { key: 'neutralLightEdgeDelta',     label: 'Neutral Light Edge Delta',    min: -0.5, max: 0.5, step: 0.01, neutralOnly: true },
        { key: 'neutralDarkEdgeDelta',      label: 'Neutral Dark Edge Delta',     min: -0.5, max: 0.5, step: 0.01, neutralOnly: true },
    ];

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr auto auto';
    grid.style.gap = '6px 12px';
    grid.style.alignItems = 'center';
    grid.style.marginBottom = '16px';
    wrap.appendChild(grid);

    const knobRows: Map<Knob['key'], { row: HTMLElement[]; input: HTMLInputElement; valueEl: HTMLSpanElement }> = new Map();
    for (const k of knobs) {
        const lbl = document.createElement('label');
        lbl.textContent = k.label;
        lbl.style.fontSize = '12px';
        grid.appendChild(lbl);

        const range = document.createElement('input');
        range.type = 'range';
        range.min = String(k.min); range.max = String(k.max); range.step = String(k.step);
        range.style.width = '200px';
        range.addEventListener('input', () => {
            cd.setDerivationSettings(activeTheme, { [k.key]: parseFloat(range.value) } as Partial<Settings>);
            knobRows.get(k.key)!.valueEl.textContent = parseFloat(range.value).toFixed(2);
            refreshActivePreview();
            refreshStatus();
        });
        grid.appendChild(range);

        const valEl = document.createElement('span');
        valEl.style.fontFamily = 'monospace';
        valEl.style.fontSize = '12px';
        valEl.style.minWidth = '40px';
        valEl.style.textAlign = 'right';
        grid.appendChild(valEl);

        knobRows.set(k.key, { row: [lbl, range, valEl], input: range, valueEl: valEl });
    }

    // ── Persistence indicator + action row ─────────────────────────────
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.alignItems = 'center';
    actionRow.style.gap = '8px';
    actionRow.style.flexWrap = 'wrap';
    actionRow.style.marginBottom = '20px';

    const statusEl = document.createElement('span');
    statusEl.style.fontSize = '12px';
    statusEl.style.padding = '4px 8px';
    statusEl.style.borderRadius = '2px';
    statusEl.style.fontWeight = '500';
    actionRow.appendChild(statusEl);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    resetBtn.textContent = 'Reset this theme to baked defaults';
    resetBtn.addEventListener('click', () => {
        cd.resetDerivationSettings(activeTheme);
        refreshKnobs();
        refreshActivePreview();
        refreshStatus();
    });
    actionRow.appendChild(resetBtn);

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    exportBtn.textContent = 'Export as code defaults';
    exportBtn.title = 'Produces a TypeScript snippet to paste into BAKED_THEME_SETTINGS in color-derivation.ts';
    actionRow.appendChild(exportBtn);

    wrap.appendChild(actionRow);

    // Hidden code-export panel that pops in when "Export" is clicked.
    const exportPanel = document.createElement('div');
    exportPanel.style.display = 'none';
    exportPanel.style.marginBottom = '20px';
    const exportHint = document.createElement('p');
    exportHint.style.fontSize = '12px';
    exportHint.style.color = 'var(--cds-text-helper, #6f6f6f)';
    exportHint.style.margin = '0 0 6px';
    exportHint.textContent = 'Paste this into src/color-derivation.ts (replace the BAKED_THEME_SETTINGS block) to commit the current tuning as the new app baseline. Auto-save to localStorage stays — this is the developer-side commit step.';
    const exportArea = document.createElement('textarea');
    exportArea.readOnly = true;
    exportArea.spellcheck = false;
    exportArea.style.width = '100%';
    exportArea.style.minHeight = '320px';
    exportArea.style.fontFamily = 'monospace';
    exportArea.style.fontSize = '11px';
    exportArea.style.padding = '8px';
    exportArea.style.border = '1px solid var(--cds-border-subtle-01, #e0e0e0)';
    exportArea.style.borderRadius = '2px';
    exportArea.style.background = 'var(--cds-layer-01, #f4f4f4)';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    copyBtn.textContent = 'Copy to clipboard';
    copyBtn.style.marginTop = '6px';
    copyBtn.addEventListener('click', () => {
        try { navigator.clipboard?.writeText(exportArea.value); copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 1200); }
        catch { /* ignore */ }
    });
    exportPanel.appendChild(exportHint);
    exportPanel.appendChild(exportArea);
    exportPanel.appendChild(copyBtn);
    wrap.appendChild(exportPanel);

    exportBtn.addEventListener('click', () => {
        exportArea.value = cd.exportBakedThemeSettingsCode();
        exportPanel.style.display = '';
        exportArea.select();
    });

    function refreshStatus(): void {
        const anyDirty = (['default', 'azure', 'aws', 'gcp'] as ThemeKey[]).some(t => cd.isDirty(t));
        if (anyDirty) {
            statusEl.textContent = 'Modified — auto-saved to localStorage (commit via Export to bake into app defaults)';
            statusEl.style.background = 'rgba(255, 176, 0, 0.15)';
            statusEl.style.color = 'var(--cds-text-primary, #161616)';
        } else {
            statusEl.textContent = 'In sync with baked code defaults';
            statusEl.style.background = 'rgba(36, 161, 72, 0.15)';
            statusEl.style.color = 'var(--cds-text-primary, #161616)';
        }
    }

    // ── Active-theme preview ───────────────────────────────────────────
    const activePreview = document.createElement('div');
    activePreview.style.marginBottom = '24px';
    wrap.appendChild(activePreview);

    // ── Resulting tokens for ALL themes (summary) ──────────────────────
    const summaryTitle = document.createElement('h4');
    summaryTitle.textContent = 'Resulting hex tokens — all themes';
    summaryTitle.style.margin = '16px 0 8px';
    summaryTitle.style.fontSize = '13px';
    wrap.appendChild(summaryTitle);

    const summaryWrap = document.createElement('div');
    summaryWrap.style.fontFamily = 'monospace';
    summaryWrap.style.fontSize = '11px';
    summaryWrap.style.background = 'var(--cds-layer-01, #f4f4f4)';
    summaryWrap.style.padding = '12px';
    summaryWrap.style.borderRadius = '2px';
    summaryWrap.style.whiteSpace = 'pre';
    wrap.appendChild(summaryWrap);

    function refreshKnobs(): void {
        const def = sc.SEMANTIC_COLOR_BASES[activeTheme];
        const isNeutral = !!def?.options?.neutral;
        baseRow.textContent = `Base: ${def?.base ?? '(none)'} · ${isNeutral ? 'neutral (uses absolute lightness)' : 'colored (uses relative deltas)'}`;
        const settings = cd.getDerivationSettings(activeTheme);
        for (const k of knobs) {
            const row = knobRows.get(k.key)!;
            const visible = (k.coloredOnly && !isNeutral) || (k.neutralOnly && isNeutral);
            for (const el of row.row) (el as HTMLElement).style.display = visible ? '' : 'none';
            row.input.value = String(settings[k.key]);
            row.valueEl.textContent = settings[k.key].toFixed(2);
        }
    }

    function refreshActivePreview(): void {
        activePreview.replaceChildren();
        const def = sc.SEMANTIC_COLOR_BASES[activeTheme];
        if (!def) return;
        const settings = cd.getDerivationSettings(activeTheme);
        const tok = cd.createThemeColor(def.base, def.options, settings);
        activePreview.appendChild(buildActivePreviewBlock(activeTheme, tok));
        refreshSummary();
    }

    function buildActivePreviewBlock(theme: ThemeKey, tok: import('./color-derivation').ThemeColorToken): HTMLElement {
        const block = document.createElement('div');
        block.style.display = 'flex';
        block.style.gap = '16px';
        block.style.alignItems = 'flex-start';
        block.style.flexWrap = 'wrap';

        // Light + dark big mini-previews
        block.appendChild(buildMiniPreview(tok.light.fill, tok.light.edge, '#ffffff', 'Light mode', theme));
        block.appendChild(buildMiniPreview(tok.dark.fill,  tok.dark.edge,  '#262626', 'Dark mode', theme));

        // Hex swatch column
        const swCol = document.createElement('div');
        swCol.style.display = 'grid';
        swCol.style.gridTemplateColumns = 'auto auto';
        swCol.style.gap = '6px 10px';
        swCol.style.alignItems = 'center';
        const addRow = (label: string, hex: string) => {
            const sw = document.createElement('div');
            sw.style.width = '36px'; sw.style.height = '24px';
            sw.style.background = hex;
            sw.style.border = '1px solid rgba(0,0,0,0.18)';
            sw.style.borderRadius = '2px';
            swCol.appendChild(sw);
            const t = document.createElement('div');
            t.style.fontFamily = 'monospace';
            t.style.fontSize = '12px';
            t.textContent = `${label}  ${hex}`;
            swCol.appendChild(t);
        };
        addRow('base       ', tok.base);
        addRow('light.fill ', tok.light.fill);
        addRow('light.edge ', tok.light.edge);
        addRow('dark.fill  ', tok.dark.fill);
        addRow('dark.edge  ', tok.dark.edge);
        const lShades = cd.deriveFaceShades(tok.light.fill);
        const dShades = cd.deriveFaceShades(tok.dark.fill);
        addRow('light.top  ', lShades.top);
        addRow('light.side ', lShades.side);
        addRow('light.front', lShades.front);
        addRow('dark.top   ', dShades.top);
        addRow('dark.side  ', dShades.side);
        addRow('dark.front ', dShades.front);
        block.appendChild(swCol);

        return block;
    }

    function buildMiniPreview(fill: string, edge: string, bg: string, label: string, theme: ThemeKey): HTMLElement {
        void theme;
        const card = document.createElement('div');
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.gap = '6px';
        const box = document.createElement('div');
        box.style.width = '220px';
        box.style.height = '160px';
        box.style.background = bg;
        box.style.borderRadius = '2px';
        box.style.display = 'flex';
        box.style.alignItems = 'center';
        box.style.justifyContent = 'center';
        // Tiny isometric cuboid: top brightest, side mid, front darkest —
        // matches the light-from-above shading applied to real shapes.
        const shades = cd.deriveFaceShades(fill);
        box.innerHTML = `<svg viewBox="0 0 200 140" width="180" height="130">
            <!-- top face -->
            <polygon points="100,15 175,55 100,95 25,55"
                     fill="${shades.top}" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>
            <!-- front face -->
            <polygon points="25,55 100,95 100,135 25,95"
                     fill="${shades.front}" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>
            <!-- side face -->
            <polygon points="175,55 100,95 100,135 175,95"
                     fill="${shades.side}" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>`;
        const cap = document.createElement('div');
        cap.textContent = label;
        cap.style.fontSize = '12px';
        cap.style.fontWeight = '500';
        cap.style.color = 'var(--cds-text-secondary, #525252)';
        card.appendChild(box); card.appendChild(cap);
        return card;
    }

    function refreshSummary(): void {
        const lines: string[] = [];
        for (const t of THEMES) {
            const def = sc.SEMANTIC_COLOR_BASES[t.key];
            if (!def) continue;
            const settings = cd.getDerivationSettings(t.key);
            const tok = cd.createThemeColor(def.base, def.options, settings);
            lines.push(
                `${t.label}`,
                `  base       ${tok.base}`,
                `  light.fill ${tok.light.fill}      light.edge ${tok.light.edge}`,
                `  dark.fill  ${tok.dark.fill}      dark.edge  ${tok.dark.edge}`,
                ``,
            );
        }
        summaryWrap.textContent = lines.join('\n').trimEnd();
    }

    refreshKnobs();
    refreshActivePreview();
    refreshStatus();
    container.appendChild(wrap);
}

function matchesSearch(entry: IconCatalogEntry, term: string): boolean {
    if (!term) return true;
    const t = term.toLowerCase();
    return entry.label.toLowerCase().includes(t) || entry.id.toLowerCase().includes(t);
}

function renderIconConfig(container: HTMLElement): void {
    ensureFullCatalog();
    const h = document.createElement('h2');
    h.className = 'nr-admin__heading';
    h.textContent = 'Icon Configuration';
    container.appendChild(h);

    const desc = document.createElement('p');
    desc.className = 'nr-admin__desc';
    desc.textContent =
        'General Component Icons appear in the standard Component Editor and in Complex Shape. ' +
        'Additional Complex Shape Icons appear only in Complex Shape. ' +
        'Add more icons from the full Carbon library via search below.';
    container.appendChild(desc);

    // ── Import section — structured as Carbon tiles ─────────────────────────
    interface PackDef {
        id: string; label: string; accept: string;
        getCount: () => number;
        addFn: ((entries: Array<{ label: string; svg: string }>) => Promise<{ added: number; error?: string }>) | null;
        removeFn: (() => Promise<number>) | null;
    }

    const packs: PackDef[] = [
        { id: 'svg',    label: 'Custom SVG',   accept: '.svg,image/svg+xml',   getCount: () => 0,            addFn: null,             removeFn: null },
        { id: 'design', label: 'Design Icons', accept: '.zip,application/zip', getCount: getDesignIconCount, addFn: addDesignIcons,   removeFn: removeAllDesignIcons },
        { id: 'aws',    label: 'AWS',          accept: '.zip,application/zip', getCount: getAwsIconCount,    addFn: addAwsIcons,      removeFn: removeAllAwsIcons },
        { id: 'gcp',    label: 'GCP',          accept: '.zip,application/zip', getCount: getGcpIconCount,    addFn: addGcpIcons,      removeFn: removeAllGcpIcons },
        { id: 'azure',  label: 'Azure',        accept: '.zip,application/zip', getCount: getAzureIconCount,  addFn: addAzureIcons,    removeFn: removeAllAzureIcons },
    ];

    const importSection = document.createElement('div');
    importSection.className = 'nr-admin__import-section';

    const importTitle = document.createElement('h3');
    importTitle.className = 'nr-admin__import-title';
    importTitle.textContent = 'Import Icons';
    importSection.appendChild(importTitle);

    const importDesc = document.createElement('p');
    importDesc.className = 'nr-admin__import-desc';
    importDesc.textContent = 'Upload individual SVG files or vendor icon packs as ZIP archives.';
    importSection.appendChild(importDesc);

    const tileGrid = document.createElement('div');
    tileGrid.className = 'nr-admin__import-grid';

    const packRefs: Array<{ statusEl: HTMLElement; removeBtn: HTMLButtonElement; pack: PackDef }> = [];

    for (const pack of packs) {
        const tile = document.createElement('div');
        tile.className = 'nr-admin__import-tile';

        const tileLabel = document.createElement('div');
        tileLabel.className = 'nr-admin__import-tile-label';
        tileLabel.textContent = pack.label;
        tile.appendChild(tileLabel);

        const statusEl = document.createElement('div');
        statusEl.className = 'nr-admin__import-tile-status';
        const cnt = pack.getCount();
        const inUse = pack.id !== 'svg' ? countUsedBySource(pack.id) : 0;
        statusEl.textContent = cnt > 0 ? `${cnt} icons` + (inUse > 0 ? ` · ${inUse} in use` : '') : 'No icons';
        tile.appendChild(statusEl);

        const btnRow = document.createElement('div');
        btnRow.className = 'nr-admin__import-tile-actions';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = pack.accept;
        fileInput.style.display = 'none';
        fileInput.id = `nr-admin-upload-${pack.id}`;

        const uploadBtn = document.createElement('label');
        uploadBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
        uploadBtn.setAttribute('for', fileInput.id);
        uploadBtn.textContent = pack.id === 'svg' ? 'Upload SVG' : 'Upload ZIP';
        uploadBtn.setAttribute('role', 'button');
        uploadBtn.tabIndex = 0;
        uploadBtn.style.cursor = 'pointer';
        uploadBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            if (pack.id === 'svg') {
                const lbl = file.name.replace(/\.[^.]+$/, '');
                const reader = new FileReader();
                reader.onload = () => { addUploadedIcon(lbl, reader.result as string); renderSections(); };
                reader.readAsText(file);
            } else if (pack.addFn) {
                statusEl.textContent = 'Extracting…';
                try {
                    const buf = await file.arrayBuffer();
                    const entries = extractSvgEntriesFromZip(buf);
                    const result = await pack.addFn(entries);
                    statusEl.textContent = result.error || `${result.added} imported (${pack.getCount()} total)`;
                    removeBtn.style.display = pack.getCount() > 0 ? '' : 'none';
                    renderSections();
                } catch (e) {
                    statusEl.textContent = 'Import failed';
                    console.error(`[nextrack] ${pack.label} import failed:`, e);
                }
            }
            fileInput.value = '';
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'cds--btn cds--btn--danger--tertiary cds--btn--sm';
        removeBtn.textContent = 'Remove';
        removeBtn.style.display = (pack.removeFn && pack.getCount() > 0) ? '' : 'none';
        if (pack.id === 'svg') removeBtn.style.display = 'none';
        removeBtn.addEventListener('click', async () => {
            if (!pack.removeFn) return;
            const removed = await pack.removeFn();
            statusEl.textContent = `${removed} removed`;
            removeBtn.style.display = 'none';
            renderSections();
        });

        btnRow.appendChild(fileInput);
        btnRow.appendChild(uploadBtn);
        btnRow.appendChild(removeBtn);
        tile.appendChild(btnRow);
        tileGrid.appendChild(tile);

        packRefs.push({ statusEl, removeBtn, pack });
    }

    importSection.appendChild(tileGrid);

    const awsStatus = packRefs.find(p => p.pack.id === 'aws')!.statusEl;
    const awsRemoveBtn = packRefs.find(p => p.pack.id === 'aws')!.removeBtn;
    const gcpStatus = packRefs.find(p => p.pack.id === 'gcp')!.statusEl;
    const gcpRemoveBtn = packRefs.find(p => p.pack.id === 'gcp')!.removeBtn;
    const azureStatus = packRefs.find(p => p.pack.id === 'azure')!.statusEl;
    const azureRemoveBtn = packRefs.find(p => p.pack.id === 'azure')!.removeBtn;

    // Search input (sticky at the top of the content area).
    const searchWrap = document.createElement('div');
    searchWrap.className = 'nr-admin__search';
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'nr-admin__search-input';
    input.placeholder = 'Search all icons (e.g. "server", "cloud", "rack")';
    input.value = iconSearchTerm;
    input.setAttribute('aria-label', 'Search icons');
    searchWrap.appendChild(input);

    const sectionsHost = document.createElement('div');
    sectionsHost.className = 'nr-admin__sections';

    // Sections host + search go first, import section is embedded within vendor tabs
    container.appendChild(searchWrap);
    container.appendChild(sectionsHost);

    const renderSections = () => {
        sectionsHost.innerHTML = '';
        buildSections(sectionsHost);
    };

    buildCtx = { renderSections, importSection };

    let searchDebounce: number | null = null;
    input.addEventListener('input', () => {
        iconSearchTerm = input.value;
        if (searchDebounce !== null) window.clearTimeout(searchDebounce);
        searchDebounce = window.setTimeout(renderSections, 120);
    });

    renderSections();

    // Re-render when IndexedDB finishes loading vendor icons
    onCatalogChange(() => {
        renderSections();
        awsStatus.textContent = getAwsIconCount() > 0 ? `${getAwsIconCount()} AWS icons loaded` : '';
        awsRemoveBtn.style.display = getAwsIconCount() > 0 ? '' : 'none';
        gcpStatus.textContent = getGcpIconCount() > 0 ? `${getGcpIconCount()} GCP icons loaded` : '';
        gcpRemoveBtn.style.display = getGcpIconCount() > 0 ? '' : 'none';
        azureStatus.textContent = getAzureIconCount() > 0 ? `${getAzureIconCount()} Azure icons loaded` : '';
        azureRemoveBtn.style.display = getAzureIconCount() > 0 ? '' : 'none';
    });
}

function getUsedIconIds(): Set<string> {
    const used = new Set<string>();
    for (const def of Object.values(ShapeRegistry)) {
        for (const layer of def.layers ?? []) {
            for (const ie of layer.icons ?? []) {
                if (ie.iconId) used.add(ie.iconId);
            }
        }
    }
    return used;
}

function countUsedBySource(source: string): number {
    const used = getUsedIconIds();
    return ICON_CATALOG.filter(i => i.source === source && used.has(i.id)).length;
}

let activeIconTab = 'general';

interface BuildContext {
    renderSections: () => void;
    importSection: HTMLElement;
}

let buildCtx: BuildContext | null = null;

function buildSections(host: HTMLElement): void {
    host.innerHTML = '';
    const cfg  = getAllConfig();
    const term = iconSearchTerm.trim();
    const vendorSources = new Set(['aws', 'gcp', 'azure', 'design']);

    const usedIds = getUsedIconIds();

    function buildInUseSection(icons: ReadonlyArray<IconCatalogEntry>): HTMLElement | null {
        const used = icons.filter(i => usedIds.has(i.id));
        if (used.length === 0) return null;
        const section = document.createElement('section');
        section.className = 'nr-admin__section';
        const head = document.createElement('div');
        head.className = 'nr-admin__section-head';
        const title = document.createElement('h3');
        title.className = 'nr-admin__section-title';
        title.textContent = 'In Use';
        head.appendChild(title);
        const cnt = document.createElement('span');
        cnt.className = 'nr-admin__section-count';
        cnt.textContent = String(used.length);
        head.appendChild(cnt);
        section.appendChild(head);
        const helper = document.createElement('p');
        helper.className = 'nr-admin__section-helper';
        helper.textContent = 'Currently assigned to components.';
        section.appendChild(helper);
        const grid = document.createElement('div');
        grid.className = 'nr-admin__icon-compact-grid';
        for (const icon of used) {
            const shapeName = Object.values(ShapeRegistry).find(d =>
                d.layers?.some(l => l.icons?.some(ie => ie.iconId === icon.id))
            )?.displayName ?? '';
            grid.appendChild(buildTile(icon, {
                titleAction: shapeName ? `Used by ${shapeName}` : icon.label,
                onClick: null,
                showRemove: false,
            }));
        }
        section.appendChild(grid);
        return section;
    }

    function buildTabWithInUse(sourceFilter: (i: IconCatalogEntry) => boolean, sectionCfg: SectionConfig): HTMLElement {
        const wrap = document.createElement('div');
        const allForSource = ICON_CATALOG.filter(sourceFilter);
        const inUse = buildInUseSection(allForSource);
        if (inUse) wrap.appendChild(inUse);
        wrap.appendChild(buildSection(sectionCfg));
        return wrap;
    }

    // Tab definitions
    const tabs: Array<{ key: string; label: string; count?: number; build: () => HTMLElement }> = [
        {
            key: 'general', label: 'General',
            count: ICON_CATALOG.filter(i => cfg[i.id] === 'general' && !vendorSources.has(i.source)).length,
            build: () => buildTabWithInUse(
                i => cfg[i.id] === 'general' && !vendorSources.has(i.source),
                { title: 'General Component Icons', helper: 'Available in Component Editor and Complex Shape. Click to move to Complex Shape only. × removes from both pickers.',
                  icons: ICON_CATALOG.filter(i => cfg[i.id] === 'general' && !vendorSources.has(i.source) && matchesSearch(i, term)),
                  emptyText: term ? 'No matches.' : 'No icons in this section.', primaryTarget: 'complex-only', showRemove: true }),
        },
        {
            key: 'complex', label: 'Complex Shape',
            count: ICON_CATALOG.filter(i => cfg[i.id] === 'complex-only' && !vendorSources.has(i.source)).length,
            build: () => buildTabWithInUse(
                i => cfg[i.id] === 'complex-only' && !vendorSources.has(i.source),
                { title: 'Complex Shape Icons', helper: 'Available only in Complex Shape. Click to move to General.',
                  icons: ICON_CATALOG.filter(i => cfg[i.id] === 'complex-only' && !vendorSources.has(i.source) && matchesSearch(i, term)),
                  emptyText: term ? 'No matches.' : 'No icons in this section.', primaryTarget: 'general', showRemove: true }),
        },
        {
            key: 'design', label: 'Design Icons',
            count: getDesignIconCount(),
            build: () => {
                const wrap = buildTabWithInUse(
                    i => i.source === 'design',
                    { title: 'Design Icons', helper: 'Monochrome SVGs for the System Designer Icon element. Theme-tinted automatically (dark in light mode, light in dark mode). Import a ZIP pack via the import section below.',
                      icons: ICON_CATALOG.filter(i => i.source === 'design' && matchesSearch(i, term)),
                      emptyText: term ? 'No design icons match.' : 'No design icons loaded. Upload a ZIP using the import section below.', primaryTarget: null, showRemove: false });
                if (buildCtx?.importSection) wrap.appendChild(buildCtx.importSection);
                return wrap;
            },
        },
        {
            key: 'aws', label: 'AWS',
            count: getAwsIconCount(),
            build: () => {
                const wrap = buildTabWithInUse(
                    i => i.source === 'aws',
                    { title: 'AWS Icons', helper: 'Imported from AWS icon pack.',
                      icons: ICON_CATALOG.filter(i => i.source === 'aws' && matchesSearch(i, term)),
                      emptyText: term ? 'No AWS icons match.' : 'No AWS icons loaded. Upload a ZIP using the import section below.', primaryTarget: null, showRemove: false });
                if (buildCtx?.importSection) wrap.appendChild(buildCtx.importSection);
                return wrap;
            },
        },
        {
            key: 'gcp', label: 'GCP',
            count: getGcpIconCount(),
            build: () => buildTabWithInUse(
                i => i.source === 'gcp',
                { title: 'GCP Icons', helper: 'Imported from GCP icon pack.',
                  icons: ICON_CATALOG.filter(i => i.source === 'gcp' && matchesSearch(i, term)),
                  emptyText: term ? 'No GCP icons match.' : 'No GCP icons loaded. Switch to the AWS tab to import vendor packs.', primaryTarget: null, showRemove: false }),
        },
        {
            key: 'azure', label: 'Azure',
            count: getAzureIconCount(),
            build: () => buildTabWithInUse(
                i => i.source === 'azure',
                { title: 'Azure Icons', helper: 'Imported from Azure icon pack.',
                  icons: ICON_CATALOG.filter(i => i.source === 'azure' && matchesSearch(i, term)),
                  emptyText: term ? 'No Azure icons match.' : 'No Azure icons loaded. Switch to the AWS tab to import vendor packs.', primaryTarget: null, showRemove: false }),
        },
        {
            key: 'carbon', label: 'Carbon Library',
            build: () => { ensureCarbonIcons(); return buildAvailableSection(getAllConfig(), term); },
        },
    ];

    // Contained full-width tabs
    const tabList = document.createElement('div');
    tabList.className = 'nr-admin__tabs';
    tabList.setAttribute('role', 'tablist');

    const tabPanel = document.createElement('div');
    tabPanel.className = 'nr-admin__tab-panel';

    for (const tab of tabs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nr-admin__tab' + (activeIconTab === tab.key ? ' nr-admin__tab--selected' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(activeIconTab === tab.key));

        const labelSpan = document.createElement('span');
        labelSpan.textContent = tab.label;
        btn.appendChild(labelSpan);

        if (tab.count != null && tab.count > 0) {
            const badge = document.createElement('span');
            badge.className = 'nr-admin__tab-badge';
            badge.textContent = String(tab.count);
            btn.appendChild(badge);
        }

        btn.addEventListener('click', () => {
            activeIconTab = tab.key;
            buildSections(host);
        });
        tabList.appendChild(btn);
    }

    host.appendChild(tabList);

    const activeTab = tabs.find(t => t.key === activeIconTab) ?? tabs[0];
    tabPanel.appendChild(activeTab.build());
    host.appendChild(tabPanel);
}

function buildAvailableSection(cfg: Record<string, IconScope>, term: string): HTMLElement {
    const section = document.createElement('section');
    section.className = 'nr-admin__section';

    const head = document.createElement('div');
    head.className = 'nr-admin__section-head';

    const title = document.createElement('h3');
    title.className = 'nr-admin__section-title';
    title.textContent = 'Available Icons';
    head.appendChild(title);
    section.appendChild(head);

    if (!term) {
        const hint = document.createElement('p');
        hint.className = 'nr-admin__section-helper';
        hint.textContent =
            'Type in the search box to browse the Carbon icon library and add icons. ' +
            'The library contains thousands of icons, so a search term is required.';
        section.appendChild(hint);
        return section;
    }

    // All catalog icons with scope 'none' that match the search term.
    const pool = ICON_CATALOG.filter(i =>
        cfg[i.id] === 'none' && matchesSearch(i, term)
    );

    const totalCount = pool.length;
    const visible = pool.slice(0, AVAILABLE_MAX);

    const count = document.createElement('span');
    count.className = 'nr-admin__section-count';
    count.textContent = totalCount > AVAILABLE_MAX
        ? `${visible.length} of ${totalCount}`
        : String(totalCount);
    head.appendChild(count);

    const helper = document.createElement('p');
    helper.className = 'nr-admin__section-helper';
    helper.textContent = totalCount > AVAILABLE_MAX
        ? `Showing ${AVAILABLE_MAX} of ${totalCount} matches. Refine your search to narrow further. Click an icon to add it to General Component Icons.`
        : 'Click an icon to add it to General Component Icons.';
    section.appendChild(helper);

    if (visible.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = 'No matches. All matching icons are already in the sections above, or no icon matches this term.';
        section.appendChild(empty);
        return section;
    }

    const grid = document.createElement('div');
    grid.className = 'nr-admin__icon-compact-grid';

    for (const icon of visible) {
        grid.appendChild(buildTile(icon, {
            titleAction: 'Add to General Component Icons',
            onClick:     () => toggleAndRerender(icon.id, 'general'),
            showRemove:  false,
        }));
    }

    section.appendChild(grid);
    return section;
}

interface SectionConfig {
    title: string;
    helper: string;
    icons: ReadonlyArray<IconCatalogEntry>;
    emptyText: string;
    primaryTarget: IconScope | null;
    showRemove: boolean;
}

function buildSection(cfg: SectionConfig): HTMLElement {
    const section = document.createElement('section');
    section.className = 'nr-admin__section';

    const head = document.createElement('div');
    head.className = 'nr-admin__section-head';

    const title = document.createElement('h3');
    title.className = 'nr-admin__section-title';
    title.textContent = cfg.title;
    head.appendChild(title);

    const count = document.createElement('span');
    count.className = 'nr-admin__section-count';
    count.textContent = String(cfg.icons.length);
    head.appendChild(count);

    section.appendChild(head);

    const helper = document.createElement('p');
    helper.className = 'nr-admin__section-helper';
    helper.textContent = cfg.helper;
    section.appendChild(helper);

    if (cfg.icons.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'nr-admin__section-empty';
        empty.textContent = cfg.emptyText;
        section.appendChild(empty);
        return section;
    }

    const grid = document.createElement('div');
    grid.className = 'nr-admin__icon-compact-grid';

    for (const icon of cfg.icons) {
        if (cfg.primaryTarget === null) {
            grid.appendChild(buildTile(icon, {
                titleAction: icon.label,
                onClick:     null,
                showRemove:  false,
            }));
        } else {
            const targetLabel = cfg.primaryTarget === 'general'
                ? 'Move to General Component Icons'
                : 'Move to Additional Complex Shape Icons';
            grid.appendChild(buildTile(icon, {
                titleAction: targetLabel,
                onClick:     () => toggleAndRerender(icon.id, cfg.primaryTarget!),
                showRemove:  cfg.showRemove,
            }));
        }
    }

    section.appendChild(grid);
    return section;
}

interface TileConfig {
    titleAction: string;
    onClick:     (() => void) | null;
    showRemove:  boolean;
    onRemove?:   (() => void) | null;
}

function buildTile(icon: IconCatalogEntry, tcfg: TileConfig): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'nr-admin__icon-tile-wrap';

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'nr-admin__icon-tile';
    tile.setAttribute('aria-label', `${icon.label} — ${tcfg.titleAction}`);
    tile.title = `${icon.label} — ${tcfg.titleAction}`;

    const isVendor = icon.source === 'aws' || icon.source === 'gcp' || icon.source === 'azure';
    const thumb = document.createElement('span');
    thumb.className = 'nr-admin__icon-tile-thumb' + (isVendor ? ' nr-icon-color' : '');
    thumb.innerHTML = icon.svg;
    tile.appendChild(thumb);

    const label = document.createElement('span');
    label.className = 'nr-admin__icon-tile-label';
    label.textContent = icon.label;
    tile.appendChild(label);

    if (tcfg.onClick) tile.addEventListener('click', tcfg.onClick);
    else tile.style.cursor = 'default';
    wrap.appendChild(tile);

    if (tcfg.showRemove) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'nr-admin__icon-tile-remove';
        remove.setAttribute('aria-label', `Remove ${icon.label}`);
        remove.title = `Remove ${icon.label}`;
        remove.textContent = '×';
        remove.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tcfg.onRemove) tcfg.onRemove();
            else toggleAndRerender(icon.id, 'none');
        });
        wrap.appendChild(remove);
    }

    return wrap;
}

function toggleAndRerender(iconId: string, target: IconScope): void {
    setIconScope(iconId, target);
    if (!rootEl) return;
    const sectionsHost = rootEl.querySelector<HTMLDivElement>('.nr-admin__sections');
    if (!sectionsHost) return;
    sectionsHost.innerHTML = '';
    buildSections(sectionsHost);
}

// ── Icon Rendering (per vendor × per mode 2D composition tuning) ───────────
//
// Mirrors renderColorAdjustmentSection's UX: pick a vendor, tweak the two
// modes side-by-side, see the result live on a sample tile, save to local-
// Storage, export as code defaults.

const DEMO_GLYPHS: Record<import('./icon-rendering').IconVendor, string> = {
    // Carbon — line glyph, designed to be tinted.
    carbon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="none" stroke="#000" stroke-width="2" d="M16 4 L28 11 L28 22 L16 29 L4 22 L4 11 Z M16 4 L16 29 M4 11 L28 22 M28 11 L4 22"/></svg>',
    // AWS — orange panel + dark-blue cube glyph. The dark glyph stays visible
    // even when the user toggles "Strip vendor bg", so the effect of every
    // option is observable in the preview.
    aws: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#FF9900"/><g fill="#232F3E"><path d="M40 18 L60 28 L40 38 L20 28 Z"/><path d="M20 28 L20 52 L40 62 L40 38 Z"/><path d="M60 28 L60 52 L40 62 L40 38 Z" fill-opacity="0.75"/></g></svg>',
    // Azure — a coloured fill icon (square + accent), already self-coloured.
    azure: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#0078D4" d="M14 4 L4 24 L10 24 L18 9 Z"/><path fill="#50E6FF" d="M18 9 L28 24 L14 24 L18 16 L14 14 Z"/></svg>',
    // GCP — multi-coloured (the classic 4-tone Google look).
    gcp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="10" r="5" fill="#4285F4"/><circle cx="10" cy="20" r="5" fill="#34A853"/><circle cx="22" cy="20" r="5" fill="#FBBC05"/><circle cx="16" cy="26" r="3" fill="#EA4335"/></svg>',
};

function renderIconRenderingSection(container: HTMLElement): void {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const ir = require('./icon-rendering') as typeof import('./icon-rendering');
    const u  = require('./utils')          as typeof import('./utils');
    /* eslint-enable @typescript-eslint/no-require-imports */

    type Vendor = import('./icon-rendering').IconVendor;
    type Mode   = import('./icon-rendering').IconMode;

    const VENDORS: Array<{ key: Vendor; label: string }> = [
        { key: 'carbon', label: 'Carbon' },
        { key: 'aws',    label: 'AWS' },
        { key: 'azure',  label: 'Azure' },
        { key: 'gcp',    label: 'GCP' },
    ];

    let activeVendor: Vendor = 'carbon';

    const wrap = document.createElement('section');
    wrap.style.marginTop = '24px';
    wrap.style.padding = '16px';
    wrap.style.border = '1px solid var(--cds-border-subtle-01, #e0e0e0)';
    wrap.style.borderRadius = '2px';

    const title = document.createElement('h3');
    title.textContent = 'Icon Rendering';
    title.style.margin = '0 0 4px';
    wrap.appendChild(title);

    const sub = document.createElement('p');
    sub.style.margin = '0 0 16px';
    sub.style.fontSize = '12px';
    sub.style.color = 'var(--cds-text-helper, #6f6f6f)';
    sub.textContent = 'Pick a vendor, then tune how its icons look in light and dark mode in the 2D view. Settings auto-save to localStorage; export the snippet when you want to commit a new baseline.';
    wrap.appendChild(sub);

    const tip = document.createElement('p');
    tip.style.margin = '0 0 16px';
    tip.style.fontSize = '11px';
    tip.style.color = 'var(--cds-text-helper, #6f6f6f)';
    tip.innerHTML = '<strong>Icon tint:</strong> "Original" keeps the source SVG\'s own colours (use for vendor logos). "Black"/"White" forces a flat tint (use for mono line art). "Custom" lets you pick a specific hex.';
    wrap.appendChild(tip);

    // ── Vendor switcher ───────────────────────────────────────────────
    const switcher = document.createElement('div');
    switcher.style.display = 'flex';
    switcher.style.gap = '4px';
    switcher.style.marginBottom = '16px';
    const switcherBtns: Partial<Record<Vendor, HTMLButtonElement>> = {};
    for (const v of VENDORS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cds--btn cds--btn--sm ' + (v.key === activeVendor ? 'cds--btn--primary' : 'cds--btn--tertiary');
        btn.textContent = v.label;
        btn.addEventListener('click', () => {
            activeVendor = v.key;
            for (const [k, b] of Object.entries(switcherBtns)) {
                if (!b) continue;
                b.className = 'cds--btn cds--btn--sm ' + (k === activeVendor ? 'cds--btn--primary' : 'cds--btn--tertiary');
            }
            refreshAll();
        });
        switcherBtns[v.key] = btn;
        switcher.appendChild(btn);
    }
    wrap.appendChild(switcher);

    // ── Two columns: Light + Dark, each with preview + knobs ──────────
    const columns = document.createElement('div');
    columns.style.display = 'grid';
    columns.style.gridTemplateColumns = '1fr 1fr';
    columns.style.gap = '16px';
    columns.style.marginBottom = '16px';
    wrap.appendChild(columns);

    interface ModeRefs {
        previewBox: HTMLDivElement;
        tintSelect: HTMLSelectElement;
        tintHexRow: HTMLDivElement;
        tintHex: HTMLInputElement;
        bgEnable: HTMLInputElement;
        bgColor: HTMLInputElement;
        bgShape: HTMLSelectElement;
        bgRadius: HTMLInputElement;
        bgRadiusValue: HTMLSpanElement;
        stripBg: HTMLInputElement;
        oversize: HTMLInputElement;
        oversizeValue: HTMLSpanElement;
    }
    const refs: Partial<Record<Mode, ModeRefs>> = {};

    function buildModeColumn(mode: Mode): HTMLElement {
        const col = document.createElement('div');
        col.style.padding = '12px';
        col.style.background = mode === 'dark' ? '#262626' : '#f4f4f4';
        col.style.color = mode === 'dark' ? '#f4f4f4' : '#161616';
        col.style.borderRadius = '2px';
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.gap = '10px';

        const hdr = document.createElement('div');
        hdr.style.fontWeight = '600';
        hdr.style.fontSize = '13px';
        hdr.textContent = mode === 'dark' ? 'Dark mode' : 'Light mode';
        col.appendChild(hdr);

        // Preview box
        const previewBox = document.createElement('div');
        previewBox.style.height = '88px';
        previewBox.style.display = 'flex';
        previewBox.style.alignItems = 'center';
        previewBox.style.justifyContent = 'center';
        previewBox.style.background = mode === 'dark' ? '#161616' : '#ffffff';
        previewBox.style.border = '1px dashed ' + (mode === 'dark' ? '#525252' : '#c6c6c6');
        col.appendChild(previewBox);

        // Knobs
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '120px 1fr';
        grid.style.gap = '6px 8px';
        grid.style.alignItems = 'center';
        grid.style.fontSize = '12px';
        col.appendChild(grid);

        function addLabel(text: string): void {
            const l = document.createElement('label');
            l.textContent = text;
            grid.appendChild(l);
        }

        // Icon tint
        addLabel('Icon tint');
        const tintSelect = document.createElement('select');
        for (const v of ['original', 'black', 'white', 'custom']) {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
            tintSelect.appendChild(opt);
        }
        grid.appendChild(tintSelect);

        addLabel('Custom tint');
        const tintHexRow = document.createElement('div');
        tintHexRow.style.display = 'flex';
        tintHexRow.style.gap = '6px';
        tintHexRow.style.alignItems = 'center';
        const tintHex = document.createElement('input');
        tintHex.type = 'color';
        tintHexRow.appendChild(tintHex);
        grid.appendChild(tintHexRow);

        // Background enable + colour
        addLabel('Background');
        const bgWrap = document.createElement('div');
        bgWrap.style.display = 'flex';
        bgWrap.style.gap = '6px';
        bgWrap.style.alignItems = 'center';
        const bgEnable = document.createElement('input');
        bgEnable.type = 'checkbox';
        bgWrap.appendChild(bgEnable);
        const bgColor = document.createElement('input');
        bgColor.type = 'color';
        bgWrap.appendChild(bgColor);
        grid.appendChild(bgWrap);

        // BG shape
        addLabel('Background shape');
        const bgShape = document.createElement('select');
        for (const s of ['square', 'circle', 'octagon']) {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
            bgShape.appendChild(opt);
        }
        grid.appendChild(bgShape);

        // BG radius
        addLabel('Background radius');
        const radiusWrap = document.createElement('div');
        radiusWrap.style.display = 'flex';
        radiusWrap.style.gap = '6px';
        radiusWrap.style.alignItems = 'center';
        const bgRadius = document.createElement('input');
        bgRadius.type = 'range';
        bgRadius.min = '0'; bgRadius.max = '20'; bgRadius.step = '1';
        radiusWrap.appendChild(bgRadius);
        const bgRadiusValue = document.createElement('span');
        bgRadiusValue.style.fontFamily = 'monospace';
        radiusWrap.appendChild(bgRadiusValue);
        grid.appendChild(radiusWrap);

        // Strip vendor background
        addLabel('Strip vendor bg');
        const stripBg = document.createElement('input');
        stripBg.type = 'checkbox';
        grid.appendChild(stripBg);

        // Oversize
        addLabel('Icon oversize');
        const oversizeWrap = document.createElement('div');
        oversizeWrap.style.display = 'flex';
        oversizeWrap.style.gap = '6px';
        oversizeWrap.style.alignItems = 'center';
        const oversize = document.createElement('input');
        oversize.type = 'range';
        oversize.min = '0.8'; oversize.max = '1.5'; oversize.step = '0.02';
        oversizeWrap.appendChild(oversize);
        const oversizeValue = document.createElement('span');
        oversizeValue.style.fontFamily = 'monospace';
        oversizeWrap.appendChild(oversizeValue);
        grid.appendChild(oversizeWrap);

        refs[mode] = {
            previewBox, tintSelect, tintHexRow, tintHex,
            bgEnable, bgColor, bgShape, bgRadius, bgRadiusValue,
            stripBg, oversize, oversizeValue,
        };

        // Wiring
        const onChange = () => {
            const s = refs[mode]!;
            const tintVal = s.tintSelect.value;
            const tint: import('./icon-rendering').IconTint =
                tintVal === 'custom' ? s.tintHex.value : (tintVal as 'original' | 'black' | 'white');
            s.tintHexRow.style.display = tintVal === 'custom' ? '' : 'none';
            const patch: Partial<import('./icon-rendering').IconRenderSettings> = {
                iconTint: tint,
                bgColor: s.bgEnable.checked ? s.bgColor.value : '',
                bgShape: s.bgShape.value as import('./icon-rendering').BgShape,
                bgRadius: parseInt(s.bgRadius.value, 10),
                stripVendorBackground: s.stripBg.checked,
                oversize: parseFloat(s.oversize.value),
            };
            ir.setIconRenderSettings(activeVendor, mode, patch);
            s.bgRadiusValue.textContent = patch.bgRadius! + 'px';
            s.oversizeValue.textContent = patch.oversize!.toFixed(2);
            renderPreview(mode);
            refreshStatus();
        };

        [tintSelect, tintHex, bgEnable, bgColor, bgShape, stripBg].forEach(el => el.addEventListener('input', onChange));
        bgRadius.addEventListener('input', onChange);
        oversize.addEventListener('input', onChange);

        return col;
    }

    columns.appendChild(buildModeColumn('light'));
    columns.appendChild(buildModeColumn('dark'));

    // ── Status + actions ──────────────────────────────────────────────
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.alignItems = 'center';
    actionRow.style.gap = '8px';
    actionRow.style.flexWrap = 'wrap';
    actionRow.style.marginBottom = '12px';
    const statusEl = document.createElement('span');
    statusEl.style.fontSize = '12px';
    statusEl.style.padding = '4px 8px';
    statusEl.style.borderRadius = '2px';
    statusEl.style.fontWeight = '500';
    actionRow.appendChild(statusEl);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'cds--btn cds--btn--tertiary cds--btn--sm';
    resetBtn.textContent = 'Reset this vendor to baked defaults';
    resetBtn.addEventListener('click', () => {
        ir.resetIconRenderSettings(activeVendor);
        refreshAll();
    });
    actionRow.appendChild(resetBtn);

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'cds--btn cds--btn--primary cds--btn--sm';
    exportBtn.textContent = 'Export as code defaults';
    exportBtn.title = 'Produces a TypeScript snippet to paste into BAKED_VENDOR_RENDER_SETTINGS in icon-rendering.ts';
    actionRow.appendChild(exportBtn);
    wrap.appendChild(actionRow);

    const exportPanel = document.createElement('div');
    exportPanel.style.display = 'none';
    const exportHint = document.createElement('p');
    exportHint.style.fontSize = '12px';
    exportHint.style.color = 'var(--cds-text-helper, #6f6f6f)';
    exportHint.style.margin = '0 0 6px';
    exportHint.textContent = 'Paste this into src/icon-rendering.ts (replace the BAKED_VENDOR_RENDER_SETTINGS block).';
    const exportArea = document.createElement('textarea');
    exportArea.readOnly = true;
    exportArea.style.width = '100%';
    exportArea.style.minHeight = '180px';
    exportArea.style.fontFamily = 'monospace';
    exportArea.style.fontSize = '11px';
    exportPanel.appendChild(exportHint);
    exportPanel.appendChild(exportArea);
    wrap.appendChild(exportPanel);

    exportBtn.addEventListener('click', () => {
        exportArea.value = ir.exportBakedIconRenderingCode();
        exportPanel.style.display = '';
        exportArea.focus();
        exportArea.select();
    });

    container.appendChild(wrap);

    // ── Renderers ─────────────────────────────────────────────────────
    function renderPreview(mode: Mode): void {
        const s = refs[mode]; if (!s) return;
        const settings = ir.getIconRenderSettings(activeVendor, mode);
        const rawGlyph = DEMO_GLYPHS[activeVendor];
        const glyph = settings.stripVendorBackground
            ? stripDemoBackground(rawGlyph) // re-use the AWS stripper via dynamic require
            : rawGlyph;
        const tintHex = (() => {
            const t = settings.iconTint;
            if (t === 'original') return null;
            if (t === 'black') return '#000000';
            if (t === 'white') return '#ffffff';
            return t.startsWith('#') ? t : null;
        })();
        const bg = settings.bgColor || null;
        const shape = settings.bgShape === 'none' ? 'square' : settings.bgShape;
        const size = 80;  // preview cell size
        const iconPx = size * settings.oversize;
        const svg = u.buildCompositeIconSvg(
            glyph, bg, shape as 'square' | 'circle' | 'octagon', false,
            settings.bgRadius, 0.18, 'none', false,
            size, iconPx, size,
            tintHex, 100, 100,
        );
        s.previewBox.innerHTML = svg;
    }

    function syncKnobsFromSettings(mode: Mode): void {
        const s = refs[mode]; if (!s) return;
        const settings = ir.getIconRenderSettings(activeVendor, mode);
        const tint = settings.iconTint;
        if (tint === 'original' || tint === 'black' || tint === 'white') {
            s.tintSelect.value = tint;
            s.tintHexRow.style.display = 'none';
        } else {
            s.tintSelect.value = 'custom';
            s.tintHex.value = typeof tint === 'string' && tint.startsWith('#') ? tint : '#000000';
            s.tintHexRow.style.display = '';
        }
        s.bgEnable.checked = !!settings.bgColor;
        s.bgColor.value = settings.bgColor || '#ffffff';
        s.bgShape.value = settings.bgShape === 'none' ? 'square' : settings.bgShape;
        s.bgRadius.value = String(settings.bgRadius);
        s.bgRadiusValue.textContent = settings.bgRadius + 'px';
        s.stripBg.checked = settings.stripVendorBackground;
        s.oversize.value = String(settings.oversize);
        s.oversizeValue.textContent = settings.oversize.toFixed(2);
    }

    function refreshStatus(): void {
        const dirty = ir.isIconRenderingDirty(activeVendor, 'light') || ir.isIconRenderingDirty(activeVendor, 'dark');
        if (dirty) {
            statusEl.textContent = '● localStorage override (not in code)';
            statusEl.style.background = '#fff8e1';
            statusEl.style.color = '#8a6d3b';
        } else {
            statusEl.textContent = '● matches baked defaults';
            statusEl.style.background = '#e0f7e9';
            statusEl.style.color = '#0e6027';
        }
    }

    function refreshAll(): void {
        for (const mode of ir.ICON_MODES) {
            syncKnobsFromSettings(mode);
            renderPreview(mode);
        }
        refreshStatus();
    }

    refreshAll();
}

// Inline copy of the AWS-strip routine adapted for inline demo SVGs in the
// admin preview — keeps the preview self-contained even when the real
// catalog hasn't loaded.
function stripDemoBackground(svg: string): string {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const ic = require('./icon-catalog') as typeof import('./icon-catalog');
    /* eslint-enable @typescript-eslint/no-require-imports */
    try { return ic.stripAwsBackground(svg); } catch { return svg; }
}
