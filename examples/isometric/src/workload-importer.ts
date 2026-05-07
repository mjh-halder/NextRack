import { createWorkload, saveWorkload, listWorkloads, WorkloadDefinition } from './app-store';
import * as XLSX from 'xlsx';

// ── Mapping configuration ──

interface MappableField {
    key: keyof WorkloadDefinition;
    label: string;
    required: boolean;
    numeric: boolean;
}

const MAPPABLE_FIELDS: MappableField[] = [
    { key: 'name',               label: 'Workload Name',         required: true,  numeric: false },
    { key: 'deploymentModel',    label: 'Workload Type',         required: false, numeric: false },
    { key: 'description',        label: 'Description',           required: false, numeric: false },
    { key: 'environment',        label: 'Environment',           required: false, numeric: false },
    { key: 'vCpuCores',          label: 'vCPU Cores',            required: true,  numeric: true  },
    { key: 'ramGB',              label: 'RAM (GB)',              required: true,  numeric: true  },
    { key: 'storageCapacityGB',  label: 'Storage (GB)',          required: true,  numeric: true  },
    { key: 'storageType',        label: 'Storage Type',          required: false, numeric: false },
    { key: 'operatingSystem',    label: 'Operating System',      required: false, numeric: false },
    { key: 'applicationServer',  label: 'Application / Service', required: false, numeric: false },
    { key: 'database',           label: 'Database Type',         required: false, numeric: false },
    { key: 'criticality',        label: 'Criticality',           required: false, numeric: false },
    { key: 'slaClass',           label: 'Availability Class',    required: false, numeric: false },
    { key: 'replicationLevel',   label: 'Replication Factor',    required: false, numeric: true  },
    { key: 'backupRequired',     label: 'Backup Required',       required: false, numeric: false },
    { key: 'rpo',                label: 'RPO',                   required: false, numeric: false },
    { key: 'rto',                label: 'RTO',                   required: false, numeric: false },
    { key: 'location',           label: 'Location / Site',       required: false, numeric: false },
    { key: 'owner',              label: 'Owner',                 required: false, numeric: false },
    { key: 'comments',           label: 'Comments',              required: false, numeric: false },
];

// ── State ──

type ImportStep = 'upload' | 'sheet' | 'mapping' | 'summary';

let overlayEl: HTMLDivElement | null = null;
let dialogEl: HTMLDivElement | null = null;
let bodyEl: HTMLDivElement | null = null;
let footerEl: HTMLDivElement | null = null;
let onCompleteCb: (() => void) | null = null;

let step: ImportStep = 'upload';
let workbook: XLSX.WorkBook | null = null;
let sheetNames: string[] = [];
let selectedSheet = '';
let excelHeaders: string[] = [];
let excelRows: string[][] = [];
let mapping: Record<string, string> = {}; // excelHeader → fieldKey
let validationResult: { valid: RowData[]; invalid: { row: number; errors: string[] }[] } | null = null;

interface RowData {
    [fieldKey: string]: string;
}

// ── Public API ──

export function showWorkloadImporter(onComplete: () => void): void {
    onCompleteCb = onComplete;
    step = 'upload';
    workbook = null;
    sheetNames = [];
    selectedSheet = '';
    excelHeaders = [];
    excelRows = [];
    mapping = {};
    validationResult = null;

    createShell();
    renderStep();
}

// ── Shell ──

function createShell(): void {
    if (overlayEl) overlayEl.remove();

    overlayEl = document.createElement('div');
    overlayEl.className = 'nr-wi__overlay';

    dialogEl = document.createElement('div');
    dialogEl.className = 'nr-wi__dialog';

    const header = document.createElement('div');
    header.className = 'nr-wi__header';

    const title = document.createElement('h2');
    title.className = 'nr-wi__title';
    title.textContent = 'Import Workloads from Excel';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'nr-wi__close';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);

    dialogEl.appendChild(header);

    bodyEl = document.createElement('div');
    bodyEl.className = 'nr-wi__body';
    dialogEl.appendChild(bodyEl);

    footerEl = document.createElement('div');
    footerEl.className = 'nr-wi__footer';
    dialogEl.appendChild(footerEl);

    overlayEl.appendChild(dialogEl);
    document.body.appendChild(overlayEl);
}

function close(): void {
    if (overlayEl) overlayEl.remove();
    overlayEl = null;
}

// ── Step rendering ──

function renderStep(): void {
    if (!bodyEl || !footerEl) return;
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';

    switch (step) {
        case 'upload':  renderUpload();  break;
        case 'sheet':   renderSheet();   break;
        case 'mapping': renderMapping(); break;
        case 'summary': renderSummary(); break;
    }
}

// ── Upload step ──

function renderUpload(): void {
    const zone = document.createElement('div');
    zone.className = 'nr-wi__dropzone';

    const hint = document.createElement('p');
    hint.className = 'nr-wi__dropzone-hint';
    hint.textContent = 'Click to select an Excel file (.xlsx, .xls)';
    zone.appendChild(hint);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => handleFile(fileInput.files));
    zone.appendChild(fileInput);

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('nr-wi__dropzone--active'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('nr-wi__dropzone--active'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('nr-wi__dropzone--active');
        handleFile(e.dataTransfer?.files || null);
    });

    bodyEl!.appendChild(zone);

    addFooterBtn('Cancel', 'cds--btn--secondary', close);
}

async function handleFile(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
        const buf = await file.arrayBuffer();
        workbook = XLSX.read(new Uint8Array(buf), { type: 'array' });
        sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
            alert('No sheets found in this file.');
            return;
        }

        if (sheetNames.length === 1) {
            selectedSheet = sheetNames[0];
            parseSheet();
            step = 'mapping';
        } else {
            selectedSheet = sheetNames[0];
            parseSheet();
            step = 'sheet';
        }
        renderStep();
    } catch (e) {
        alert('Could not read file. Please ensure it is a valid Excel file.');
    }
}

function parseSheet(): void {
    if (!workbook || !selectedSheet) return;
    const ws = workbook.Sheets[selectedSheet];
    const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (raw.length === 0) {
        excelHeaders = [];
        excelRows = [];
        return;
    }
    excelHeaders = raw[0].map((h: any) => String(h).trim());
    excelRows = raw.slice(1).filter(r => r.some((c: any) => String(c).trim() !== ''));
    mapping = autoMap(excelHeaders);
}

// ── Sheet selection step ──

function renderSheet(): void {
    const label = document.createElement('p');
    label.className = 'nr-wi__section-label';
    label.textContent = 'Select a sheet:';
    bodyEl!.appendChild(label);

    const group = document.createElement('div');
    group.className = 'nr-wi__radio-group';

    for (const name of sheetNames) {
        const row = document.createElement('label');
        row.className = 'nr-wi__radio-row';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'sheet';
        radio.value = name;
        radio.checked = name === selectedSheet;
        radio.addEventListener('change', () => {
            selectedSheet = name;
            parseSheet();
            renderSheetPreview();
        });
        row.appendChild(radio);

        const span = document.createElement('span');
        span.textContent = name;
        row.appendChild(span);

        group.appendChild(row);
    }
    bodyEl!.appendChild(group);

    const previewWrap = document.createElement('div');
    previewWrap.id = 'wi-sheet-preview';
    bodyEl!.appendChild(previewWrap);
    renderSheetPreview();

    addFooterBtn('Cancel', 'cds--btn--secondary', close);
    addFooterBtn('Next', 'cds--btn--primary', () => { step = 'mapping'; renderStep(); });
}

function renderSheetPreview(): void {
    const wrap = document.getElementById('wi-sheet-preview');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (excelHeaders.length === 0) {
        wrap.textContent = 'Sheet is empty.';
        return;
    }

    const label = document.createElement('p');
    label.className = 'nr-wi__section-label';
    label.textContent = `Preview (${excelRows.length} rows):`;
    wrap.appendChild(label);

    wrap.appendChild(buildPreviewTable(excelHeaders, excelRows.slice(0, 5)));
}

// ── Mapping step ──

function renderMapping(): void {
    const label = document.createElement('p');
    label.className = 'nr-wi__section-label';
    label.textContent = 'Map Excel columns to workload fields:';
    bodyEl!.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'nr-wi__mapping-grid';

    for (const field of MAPPABLE_FIELDS) {
        const row = document.createElement('div');
        row.className = 'nr-wi__mapping-row';

        const lbl = document.createElement('label');
        lbl.className = 'nr-wi__mapping-label';
        lbl.textContent = field.label + (field.required ? ' *' : '');
        row.appendChild(lbl);

        const select = document.createElement('select');
        select.className = 'nr-wi__mapping-select';

        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '\u2014 Skip \u2014';
        select.appendChild(emptyOpt);

        for (const h of excelHeaders) {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            const mapped = Object.entries(mapping).find(([, v]) => v === field.key);
            if (mapped && mapped[0] === h) opt.selected = true;
            select.appendChild(opt);
        }

        select.addEventListener('change', () => {
            Object.keys(mapping).forEach(k => { if (mapping[k] === field.key) delete mapping[k]; });
            if (select.value) mapping[select.value] = field.key;
        });

        row.appendChild(select);
        grid.appendChild(row);
    }

    bodyEl!.appendChild(grid);

    if (excelRows.length > 0) {
        const previewLabel = document.createElement('p');
        previewLabel.className = 'nr-wi__section-label';
        previewLabel.style.marginTop = '24px';
        previewLabel.textContent = 'Preview with mapped fields:';
        bodyEl!.appendChild(previewLabel);
        bodyEl!.appendChild(buildMappedPreview(3));
    }

    addFooterBtn('Cancel', 'cds--btn--secondary', close);
    if (sheetNames.length > 1) {
        addFooterBtn('Back', 'cds--btn--tertiary', () => { step = 'sheet'; renderStep(); });
    }
    addFooterBtn('Validate & Continue', 'cds--btn--primary', () => {
        validate();
        step = 'summary';
        renderStep();
    });
}

// ── Summary step ──

function renderSummary(): void {
    if (!validationResult) return;

    const { valid, invalid } = validationResult;
    const total = valid.length + invalid.length;

    const stats = document.createElement('div');
    stats.className = 'nr-wi__summary-stats';

    stats.appendChild(buildBadge(`${total} total`, 'nr-wi__badge'));
    stats.appendChild(buildBadge(`${valid.length} valid`, 'nr-wi__badge nr-wi__badge--success'));
    if (invalid.length > 0) {
        stats.appendChild(buildBadge(`${invalid.length} invalid`, 'nr-wi__badge nr-wi__badge--error'));
    }
    bodyEl!.appendChild(stats);

    if (invalid.length > 0) {
        const errLabel = document.createElement('p');
        errLabel.className = 'nr-wi__section-label';
        errLabel.textContent = 'Errors:';
        bodyEl!.appendChild(errLabel);

        const errList = document.createElement('div');
        errList.className = 'nr-wi__error-list';

        for (const item of invalid.slice(0, 50)) {
            const row = document.createElement('div');
            row.className = 'nr-wi__error-row';
            row.innerHTML = `<strong>Row ${item.row}:</strong> ${item.errors.join('; ')}`;
            errList.appendChild(row);
        }
        if (invalid.length > 50) {
            const more = document.createElement('div');
            more.className = 'nr-wi__error-row';
            more.textContent = `\u2026 and ${invalid.length - 50} more errors`;
            errList.appendChild(more);
        }
        bodyEl!.appendChild(errList);
    }

    addFooterBtn('Cancel', 'cds--btn--secondary', close);
    addFooterBtn('Back to Mapping', 'cds--btn--tertiary', () => { step = 'mapping'; renderStep(); });

    if (valid.length > 0) {
        addFooterBtn(`Import ${valid.length} Workload${valid.length !== 1 ? 's' : ''}`, 'cds--btn--primary', doImport);
    }
}

// ── Validation ──

function validate(): void {
    const valid: RowData[] = [];
    const invalid: { row: number; errors: string[] }[] = [];

    const requiredKeys = MAPPABLE_FIELDS.filter(f => f.required).map(f => f.key);
    const numericKeys = MAPPABLE_FIELDS.filter(f => f.numeric).map(f => f.key);
    const reverseMap: Record<string, string> = {};
    for (const [header, key] of Object.entries(mapping)) {
        reverseMap[key] = header;
    }

    const unmappedRequired = requiredKeys.filter(k => !reverseMap[k]);

    for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i];
        const errors: string[] = [];
        const data: RowData = {};

        for (const [header, fieldKey] of Object.entries(mapping)) {
            const colIdx = excelHeaders.indexOf(header);
            if (colIdx < 0) continue;
            const val = String(row[colIdx] ?? '').trim();
            data[fieldKey] = val;
        }

        for (const rk of unmappedRequired) {
            const f = MAPPABLE_FIELDS.find(m => m.key === rk);
            errors.push(`${f?.label || rk} is not mapped`);
        }

        for (const rk of requiredKeys) {
            if (reverseMap[rk] && !data[rk]) {
                const f = MAPPABLE_FIELDS.find(m => m.key === rk);
                errors.push(`${f?.label || rk} is empty`);
            }
        }

        for (const nk of numericKeys) {
            if (data[nk] !== undefined && data[nk] !== '') {
                const n = parseFloat(data[nk]);
                if (isNaN(n) || n < 0) {
                    const f = MAPPABLE_FIELDS.find(m => m.key === nk);
                    errors.push(`${f?.label || nk} is not a valid number`);
                }
            }
        }

        if (errors.length > 0) {
            invalid.push({ row: i + 2, errors });
        } else {
            valid.push(data);
        }
    }

    validationResult = { valid, invalid };
}

// ── Import ──

function doImport(): void {
    if (!validationResult) return;
    for (const row of validationResult.valid) {
        const wl = createWorkload(row['name'] || 'Imported Workload');
        for (const [key, val] of Object.entries(row)) {
            if (key !== 'name' && key !== 'id') {
                (wl as any)[key] = String(val);
            }
        }
        saveWorkload(wl);
    }
    close();
    if (onCompleteCb) onCompleteCb();
}

// ── Auto-mapping ──

function autoMap(headers: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    const used = new Set<string>();

    for (const header of headers) {
        const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const f of MAPPABLE_FIELDS) {
            if (used.has(f.key)) continue;
            const l = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (h.includes(l) || l.includes(h) || matchKeywords(h, f.key)) {
                result[header] = f.key;
                used.add(f.key);
                break;
            }
        }
    }
    return result;
}

function matchKeywords(header: string, key: string): boolean {
    const keywords: Record<string, string[]> = {
        name: ['name', 'workload', 'system'],
        vCpuCores: ['vcpu', 'cpu', 'cores', 'cpucore'],
        ramGB: ['ram', 'memory', 'mem'],
        storageCapacityGB: ['storage', 'disk', 'capacity'],
        replicationLevel: ['replica', 'replication'],
        operatingSystem: ['os', 'operating'],
        deploymentModel: ['type', 'model', 'deployment'],
        environment: ['env', 'environment'],
        criticality: ['critical', 'criticality', 'priority'],
        slaClass: ['sla', 'availability'],
        location: ['location', 'site', 'datacenter', 'dc'],
        owner: ['owner', 'responsible'],
        database: ['database', 'db'],
    };
    const kws = keywords[key];
    return kws ? kws.some(kw => header.includes(kw)) : false;
}

// ── Helpers ──

function addFooterBtn(text: string, cls: string, handler: () => void): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cds--btn ${cls} cds--btn--sm`;
    btn.textContent = text;
    btn.addEventListener('click', handler);
    footerEl!.appendChild(btn);
}

function buildBadge(text: string, cls: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    return span;
}

function buildPreviewTable(headers: string[], rows: string[][]): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'nr-wi__preview-wrap';

    const table = document.createElement('table');
    table.className = 'nr-wi__preview';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const h of headers) {
        const th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of rows) {
        const tr = document.createElement('tr');
        for (let i = 0; i < headers.length; i++) {
            const td = document.createElement('td');
            td.textContent = String(row[i] ?? '');
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
}

function buildMappedPreview(maxRows: number): HTMLElement {
    const mappedHeaders: string[] = [];
    const fieldKeys: string[] = [];

    for (const f of MAPPABLE_FIELDS) {
        const header = Object.entries(mapping).find(([, v]) => v === f.key)?.[0];
        if (header) {
            mappedHeaders.push(f.label);
            fieldKeys.push(header);
        }
    }

    const rows: string[][] = [];
    for (let i = 0; i < Math.min(maxRows, excelRows.length); i++) {
        const row: string[] = [];
        for (const header of fieldKeys) {
            const colIdx = excelHeaders.indexOf(header);
            row.push(colIdx >= 0 ? String(excelRows[i][colIdx] ?? '') : '');
        }
        rows.push(row);
    }

    return buildPreviewTable(mappedHeaders, rows);
}
