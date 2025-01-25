import * as T from '../../types';

// const GRID_TICK_RATE = 500;

export class Grid {
    cells: T.CellGrid;

    constructor() {
        this.cells = Object.create(null);
    }

    set(location: T.CubeLocation, cell: T.Cell) {
        // TODO queue for commit instead
        if (cell.state === T.CellState.BLANK) {
            delete this.cells[location];
        } else {
            this.cells[location] = cell;
        }
    }

    // commit() {}
}

const grid = new Grid();

// setInterval(() => {
//     grid.commit();
// }, GRID_TICK_RATE);

export default grid;
