import { dia } from '@joint/core';

const FILE_NAME = 'nextrack-diagram.json';

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
