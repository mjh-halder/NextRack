import { dia } from '@joint/core';

const FILE_NAME = 'nextrack-diagram.json';
const DEFAULT_DESIGN_KEY = 'nextrack-default-design-v1';

export function saveGraph(graph: dia.Graph): void {
    // graph.toJSON() includes all graph-level Backbone attributes (e.g. the
    // runtime `obstacles` instance stored via graph.set('obstacles', ...)),
    // which contain circular references and must not be serialized.
    // Serialize only the cells, which is the format graph.fromJSON() expects.
    const data = { cells: graph.getCells().map(cell => cell.toJSON()) };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
}

/** Persist the current graph as the startup default in localStorage. */
export function saveDefaultDesign(graph: dia.Graph): void {
    try {
        const data = { cells: graph.getCells().map(cell => cell.toJSON()) };
        localStorage.setItem(DEFAULT_DESIGN_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('[nextrack] Failed to save default design:', e);
    }
}

/**
 * Load the default design from localStorage into the graph.
 * Returns true if a default was found and loaded, false otherwise.
 */
export function loadDefaultDesign(graph: dia.Graph): boolean {
    try {
        const raw = localStorage.getItem(DEFAULT_DESIGN_KEY);
        if (!raw) return false;
        const json = JSON.parse(raw);
        graph.fromJSON(json);
        return true;
    } catch (e) {
        console.error('[nextrack] Failed to load default design:', e);
        return false;
    }
}

export function loadGraph(
    graph: dia.Graph,
    onLoaded: () => void
): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target!.result as string);
                graph.fromJSON(json);
                onLoaded();
            } catch (err) {
                console.error('[nextrack] Failed to load diagram:', err);
            }
        };
        reader.readAsText(file);
    });
    input.click();
}
