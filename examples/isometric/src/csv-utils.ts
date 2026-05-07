// RFC 4180 CSV serialization/deserialization — no external dependencies.

function escapeField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

export interface CsvColumn {
    key: string;
    label: string;
}

export function toCSV(columns: CsvColumn[], rows: Array<Record<string, unknown>>): string {
    const header = columns.map(c => escapeField(c.label)).join(',');
    const lines = rows.map(row =>
        columns.map(c => {
            const v = row[c.key];
            return escapeField(v != null ? String(v) : '');
        }).join(',')
    );
    return [header, ...lines].join('\r\n');
}

export function fromCSV(csv: string): { headers: string[]; rows: Array<Record<string, string>> } {
    const result: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < csv.length; i++) {
        const ch = csv[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < csv.length && csv[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(current);
                current = '';
            } else if (ch === '\r') {
                // skip, handle \n
            } else if (ch === '\n') {
                row.push(current);
                current = '';
                result.push(row);
                row = [];
            } else {
                current += ch;
            }
        }
    }
    row.push(current);
    if (row.length > 1 || row[0] !== '') result.push(row);

    if (result.length === 0) return { headers: [], rows: [] };
    const headers = result[0];
    const rows = result.slice(1).map(r => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
        return obj;
    });
    return { headers, rows };
}

export function downloadCSV(csv: string, filename: string): void {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function uploadCSV(callback: (result: { headers: string[]; rows: Array<Record<string, string>> }) => void): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            callback(fromCSV(text));
        };
        reader.readAsText(file);
    });
    input.click();
}

export function coerceValue(raw: string, fieldType: string, options?: string[]): unknown {
    const trimmed = raw.trim();
    if (trimmed === '') return '';
    switch (fieldType) {
        case 'number': {
            const n = parseFloat(trimmed);
            return isNaN(n) ? trimmed : n;
        }
        case 'boolean': {
            const lower = trimmed.toLowerCase();
            if (lower === 'true' || lower === 'yes' || lower === '1') return true;
            if (lower === 'false' || lower === 'no' || lower === '0') return false;
            return trimmed;
        }
        case 'select': {
            if (options && options.includes(trimmed)) return trimmed;
            return trimmed;
        }
        default:
            return trimmed;
    }
}
