import { dia } from '@joint/core';

interface AtomicCommand {
    type: 'add' | 'remove' | 'change';
    cellJson: Record<string, unknown>;
    prev?: Record<string, unknown>;
}

type Command = AtomicCommand[];

const MAX_STACK = 100;

let undoStack: Command[] = [];
let redoStack: Command[] = [];
let recording = true;
let batchDepth = 0;
let pendingBatch: AtomicCommand[] = [];

let graph: dia.Graph;

export function initUndoRedo(g: dia.Graph): void {
    graph = g;

    graph.on('add', (cell: dia.Cell) => {
        if (!recording) return;
        push({ type: 'add', cellJson: cell.toJSON() });
    });

    graph.on('remove', (cell: dia.Cell) => {
        if (!recording) return;
        push({ type: 'remove', cellJson: cell.toJSON() });
    });

    graph.on('change', (cell: dia.Cell) => {
        if (!recording) return;
        if (!(cell instanceof dia.Cell) || cell === (graph as unknown)) return;
        try {
            const prev = cell.previousAttributes();
            const curr = cell.toJSON();
            if (JSON.stringify(prev) === JSON.stringify(curr)) return;
            push({ type: 'change', cellJson: curr, prev: { ...prev, id: cell.id } as Record<string, unknown> });
        } catch {
            // skip non-serializable changes (e.g. obstacles)
        }
    });

    graph.on('batch:start', () => { batchDepth++; });
    graph.on('batch:stop', () => {
        batchDepth--;
        if (batchDepth <= 0) {
            batchDepth = 0;
            flushBatch();
        }
    });
}

function push(cmd: AtomicCommand): void {
    if (batchDepth > 0) {
        pendingBatch.push(cmd);
    } else {
        undoStack.push([cmd]);
        if (undoStack.length > MAX_STACK) undoStack.shift();
        redoStack = [];
    }
}

function flushBatch(): void {
    if (pendingBatch.length === 0) return;
    undoStack.push(pendingBatch);
    if (undoStack.length > MAX_STACK) undoStack.shift();
    redoStack = [];
    pendingBatch = [];
}

export function undo(): void {
    if (batchDepth > 0) flushBatch();
    const cmd = undoStack.pop();
    if (!cmd) return;

    recording = false;
    const reversed: AtomicCommand[] = [];

    for (let i = cmd.length - 1; i >= 0; i--) {
        const atom = cmd[i];
        switch (atom.type) {
            case 'add': {
                const cell = graph.getCell(atom.cellJson.id as string);
                if (cell) {
                    const snap = cell.toJSON();
                    cell.remove();
                    reversed.push({ type: 'remove', cellJson: snap });
                }
                break;
            }
            case 'remove': {
                graph.addCell(atom.cellJson as dia.Cell.JSON);
                reversed.push({ type: 'add', cellJson: atom.cellJson });
                break;
            }
            case 'change': {
                if (!atom.prev) break;
                const cell = graph.getCell(atom.prev.id as string);
                if (cell) {
                    const snap = cell.toJSON();
                    cell.set(atom.prev);
                    reversed.push({ type: 'change', cellJson: atom.prev, prev: snap });
                }
                break;
            }
        }
    }

    redoStack.push(reversed);
    recording = true;
}

export function redo(): void {
    if (batchDepth > 0) flushBatch();
    const cmd = redoStack.pop();
    if (!cmd) return;

    recording = false;
    const reversed: AtomicCommand[] = [];

    for (let i = cmd.length - 1; i >= 0; i--) {
        const atom = cmd[i];
        switch (atom.type) {
            case 'remove': {
                const cell = graph.getCell(atom.cellJson.id as string);
                if (cell) {
                    const snap = cell.toJSON();
                    cell.remove();
                    reversed.push({ type: 'add', cellJson: snap });
                }
                break;
            }
            case 'add': {
                graph.addCell(atom.cellJson as dia.Cell.JSON);
                reversed.push({ type: 'remove', cellJson: atom.cellJson });
                break;
            }
            case 'change': {
                if (!atom.prev) break;
                const cell = graph.getCell(atom.prev.id as string);
                if (cell) {
                    const snap = cell.toJSON();
                    cell.set(atom.prev);
                    reversed.push({ type: 'change', cellJson: atom.prev, prev: snap });
                }
                break;
            }
        }
    }

    undoStack.push(reversed);
    recording = true;
}

export function canUndo(): boolean {
    return undoStack.length > 0;
}

export function canRedo(): boolean {
    return redoStack.length > 0;
}

export function clearHistory(): void {
    undoStack = [];
    redoStack = [];
    pendingBatch = [];
    batchDepth = 0;
}
