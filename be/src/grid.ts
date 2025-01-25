import * as T from '../../types';

const GRID_COMMIT_TICK_RATE = 100;
const GRID_DECAY_TICK_RATE = 500;
const CELL_FILLED_MAX_AGE_SECONDS = 20;

const CELL_FILLED_MAX_AGE_TICKS = CELL_FILLED_MAX_AGE_SECONDS * 1000 / GRID_DECAY_TICK_RATE;
const CELL_DECAY_PER_TICK = 1 / CELL_FILLED_MAX_AGE_TICKS;

export type CubeLocation = { q: T.Integer, r: T.Integer, s: T.Integer };
export const cube = (q: T.Integer, r: T.Integer, s: T.Integer) => ({ q, r, s });
export const cube_eq = (a: CubeLocation, b: CubeLocation) =>
    a.q === b.q && a.r === b.r && a.s === b.s;
export const cube_str = (pos: CubeLocation): T.CubeLocation => `${pos.q},${pos.r},${pos.s}`;
export const str_cube = (pos: T.CubeLocation): CubeLocation => {
    let [q, r, s] = pos.split(',').map(x => parseInt(x));
    return cube(q, r, s);
};

export const cube_is_valid = (x: CubeLocation) => x.q + x.r + x.s === 0;
export const cube_is_adjacent = (a: CubeLocation, b: CubeLocation) => {
    let diffs = [
        a.q - b.q,
        a.r - b.r,
        a.s - b.s,
    ];
    diffs.sort();
    return diffs[0] === -1 && diffs[1] === 0 && diffs[2] === 1;
};

// type Cell = CellTrail | CellFilled;
// type CellTrail = {
//     state: T.CellState.TRAIL,
//     ownerPlayerId: T.Integer,
//     color: T.Integer,

// };
// type CellFilled = {
//     state: T.CellState.FILLED,
//     color: T.Integer,

//     /// number of DECAY ticks remaining
//     age: number,
// };

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

    filled: Set<T.CubeLocation>;

    constructor() {
        this.cells = Object.create(null);
        this.queue = newQueue();
        this.onupdate = undefined;

        this.filled = new Set();
    }

    get cellGrid(): T.CellGrid {
        return this.cells;
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

            if (cell.state === T.CellState.FILLED) {
                this.filled.add(location);
            } else if ((location in this.cells) && this.cells[location].state === T.CellState.FILLED) {
                this.filled.delete(location);
            }

            if (cell.state === T.CellState.BLANK) {
                delete this.cells[location];
            } else {
                this.cells[location] = cell;
            }

        }

        this.onupdate?.(this.queue);
        this.queue = newQueue();
    }

    decay() {
        if (this.filled.size === 0) return;

        let touched = Object.create(null) as T.CellGrid;
        for (let location of this.filled) {
            let cell = this.cells[location] as T.CellFilled;
            cell.age -= CELL_DECAY_PER_TICK;
            if (cell.age <= 0) {
                touched[location] = {
                    state: T.CellState.BLANK,
                } as T.CellBlank;
                delete this.cells[location];
                this.filled.delete(location);
            } else {
                touched[location] = cell;
                // touched[location] = this.cells[location] = {
                //     state: T.CellState.FILLED,
                //     color: cell.color,
                //     age: cell.age,
                // } as T.CellFilled;
            }
        }

        this.onupdate?.(touched);
    }
}

const grid = new Grid();

setInterval(() => {
    grid.commit();
}, GRID_COMMIT_TICK_RATE);

setInterval(() => {
    grid.decay();
}, GRID_DECAY_TICK_RATE);

export default grid;
