import { dia } from '@joint/core';
import { GRID_SIZE } from './nextrack-theme';
import type { DisplayMeta } from './canvas-store';

const FILE_NAME = 'nextrack-diagram.json';
const DEFAULT_DESIGN_KEY = 'nextrack-default-design-v1';

export function saveGraph(graph: dia.Graph, display?: DisplayMeta): void {
    const data = {
        meta: {
            gridSize: GRID_SIZE,
            gridCountX: display?.gridCountX,
            gridCountY: display?.gridCountY,
            gridVisible: display?.gridVisible,
            gridOpacity: display?.gridOpacity,
            gridCellPitch: display?.gridCellPitch,
            version: 1,
            exportedAt: new Date().toISOString(),
        },
        cells: graph.getCells().map(cell => cell.toJSON()),
    };
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
export function saveDefaultDesign(graph: dia.Graph, display?: DisplayMeta): void {
    try {
        const data = {
            meta: {
                gridSize: GRID_SIZE,
                gridCountX: display?.gridCountX,
                gridCountY: display?.gridCountY,
                gridVisible: display?.gridVisible,
                gridOpacity: display?.gridOpacity,
                gridCellPitch: display?.gridCellPitch,
                version: 1,
            },
            cells: graph.getCells().map(cell => cell.toJSON()),
        };
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
    onLoaded: (display?: DisplayMeta) => void
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
                const m = json.meta ?? {};
                const display: DisplayMeta = {
                    gridCountX: m.gridCountX,
                    gridCountY: m.gridCountY,
                    gridVisible: m.gridVisible,
                    gridOpacity: m.gridOpacity,
                    gridCellPitch: m.gridCellPitch,
                };
                onLoaded(display);
            } catch (err) {
                console.error('[nextrack] Failed to load diagram:', err);
            }
        };
        reader.readAsText(file);
    });
    input.click();
}
