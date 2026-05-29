/*
 * NextrackObstacles — composes filter-then-delegate over the upstream
 * Obstacles class. Extracted per ADR-0006 Tier 2 so obstacles.ts stays
 * byte-equivalent to the upstream demo and carries no NextRack code.
 *
 * Two NextRack adjustments:
 *   1. Grid size: upstream Obstacles sizes itself by theme.GRID_COUNT (25);
 *      NextRack uses a 100-cell canvas, so we resize after super() and call
 *      reset() to rebuild the grid.
 *   2. Cell filter: upstream skips only link cells; NextRack additionally
 *      ignores Frame backgrounds, Area annotations, GridLabel text, and the
 *      child layers of a ComplexComponent (so child layers don't double-
 *      mark the parent's footprint).
 *
 * The cell-aware methods (addCell / removeCell / updateCellPosition /
 * updateCellSize) are overridden by composition only — the NextRack filter
 * runs first, then delegates to the upstream implementation. No upstream
 * method bodies are reproduced here.
 */

import { dia } from '@joint/core';
import Obstacles from './obstacles';
import { GRID_COUNT as NEXTRACK_GRID_COUNT } from './nextrack-theme';

export default class NextrackObstacles extends Obstacles {

    constructor(graph: dia.Graph) {
        super(graph);
        // Upstream sized the grid at theme.GRID_COUNT (25). Resize to the
        // NextRack canvas size and rebuild.
        this.size = NEXTRACK_GRID_COUNT;
        this.reset();
        this.update();
    }

    protected override addCell(cell: dia.Cell) {
        if (this.shouldIgnoreCell(cell)) return;
        super.addCell(cell);
    }

    protected override removeCell(cell: dia.Cell) {
        if (this.shouldIgnoreCell(cell)) return;
        super.removeCell(cell);
    }

    protected override updateCellPosition(cell: dia.Cell) {
        if (this.shouldIgnoreCell(cell)) return;
        super.updateCellPosition(cell);
    }

    protected override updateCellSize(cell: dia.Cell) {
        if (this.shouldIgnoreCell(cell)) return;
        super.updateCellSize(cell);
    }

    private shouldIgnoreCell(cell: dia.Cell): boolean {
        return Boolean(
            cell.get('isFrame') ||
            cell.get('isArea') ||
            cell.get('isGridLabel') ||
            cell.get('componentRole') === 'child'
        );
    }
}
