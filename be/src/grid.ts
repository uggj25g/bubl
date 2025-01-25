import * as T from '../../types';

const GRID_TICK_RATE = 100;

type Queue = T.CellGrid & { _count: number };
const newQueue = (): Queue => {
    let queue = Object.create(null);
    Object.defineProperty(queue, '_count', {
        enumerable: false,
        writable: true,
    });
    queue._count = 0;
    return queue;
}

export class Grid {
    cells: T.CellGrid;
    queue: Queue;

    onupdate?: (diff: T.CellGrid) => void;

    constructor() {
        this.cells = Object.create(null);
        this.queue = newQueue();
        this.onupdate = undefined;
    }

    set(location: T.CubeLocation, cell: T.Cell) {
        this.queue[location] = cell;
        this.queue._count += 1;
    }

    commit() {
        if (this.queue._count === 0) return;

        for (let [locationKey, cell] of Object.entries(this.queue)) {
            if (typeof cell === 'number') continue;
            let location = locationKey as T.CubeLocation;

            if (cell.state === T.CellState.BLANK) {
                delete this.cells[location];
            } else {
                this.cells[location] = cell;
            }
        }

        this.onupdate?.(this.queue);
        this.queue = newQueue();
    }
}

const grid = new Grid();

setInterval(() => {
    grid.commit();
}, GRID_TICK_RATE);

export default grid;
