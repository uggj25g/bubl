import * as T from '../../types';

const GRID_COMMIT_TICK_RATE = 100;
const GRID_DECAY_TICK_RATE = 500;
const GRID_VACUUM_RATE = 10000;
const CELL_FILLED_MAX_AGE_SECONDS = 20;

const CELL_FILLED_MAX_AGE_TICKS = CELL_FILLED_MAX_AGE_SECONDS * 1000 / GRID_DECAY_TICK_RATE;

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

type GCellGrid = Record<T.CubeLocation, GCell>;
type GCell = GCellBlank | GCellTrail | GCellFilled;
type GCellBlank = {
    location: CubeLocation,
    state: T.CellState.BLANK,
};
type GCellTrail = {
    location: CubeLocation,
    state: T.CellState.TRAIL,
    ownerPlayerId: T.Integer,
    color: T.Integer,

};
type GCellFilled = {
    location: CubeLocation,
    state: T.CellState.FILLED,
    color: T.Integer,

    /// number of DECAY ticks remaining
    age: number,
};

function gcellToTcell(cell: GCell): T.Cell {
    switch (cell.state) {
    case T.CellState.BLANK: {
        return cell;
    }
    case T.CellState.FILLED: {
        return {
            state: cell.state,
            color: cell.color,
            age: cell.age / CELL_FILLED_MAX_AGE_TICKS,
        };
    }
    case T.CellState.TRAIL: {
        return {
            state: cell.state,
            color: cell.color,
            age: 1, // TODO[paulsn]
            ownerPlayer: cell.ownerPlayerId,
        };
    }
    }
}


type GQueue = GCellGrid & { _count: number };
const newQueue = (): GQueue => {
    let queue = Object.create(null);
    Object.defineProperty(queue, '_count', {
        enumerable: false,
        writable: true,
    });
    queue._count = 0;
    return queue;
}

type GExtent = {
    q: [min: T.Integer, max: T.Integer],
    r: [min: T.Integer, max: T.Integer],
    s: [min: T.Integer, max: T.Integer],
    toString(): string;
};
interface GExtentCalc {
    extend(pos: CubeLocation): void;
    finalize(): GExtent;
}
const newExtent = (): GExtentCalc => {
    let any = false;
    let ext: GExtent = {
        q: [0, 0],
        r: [0, 0],
        s: [0, 0],
        toString() {
            return `q:${this.q[0]}..${this.q[1]}`
                + ` r:${this.r[0]}..${this.r[1]}`
                + ` s:${this.s[0]}..${this.s[1]}`;
        },
    };

    const extend = (pos: CubeLocation) => {
        if ( ! any) {
            ext.q = [pos.q, pos.q];
            ext.r = [pos.r, pos.r];
            ext.s = [pos.s, pos.s];
            any = true;
            return;
        }

        ext.q[0] = Math.min(ext.q[0], pos.q);
        ext.q[1] = Math.max(ext.q[1], pos.q);
        ext.r[0] = Math.min(ext.r[0], pos.r);
        ext.r[1] = Math.max(ext.r[1], pos.r);
        ext.s[0] = Math.min(ext.s[0], pos.s);
        ext.s[1] = Math.max(ext.s[1], pos.s);
    };

    const finalize = () => ext;

    return { extend, finalize };
}

export class Grid {
    #cells: GCellGrid;
    #queue: GQueue;
    #extent: GExtent;
    filled: Set<T.CubeLocation>;

    onupdate?: (diff: T.CellGrid) => void;

    constructor() {
        this.#cells = Object.create(null);
        this.#queue = newQueue();
        this.#extent = newExtent().finalize();
        this.filled = new Set();
    }

    get cellGrid(): T.CellGrid {
        let grid: T.CellGrid = Object.create(null);

        for (let [locationKey, gcell] of Object.entries(this.#cells)) {
            let location = locationKey as T.CubeLocation;
            grid[location] = gcellToTcell(gcell);
        }

        return grid;
    }

    get extent() {
        return this.#extent;
    }

    setBlank(location: T.CubeLocation) {
        this.#queue[location] = {
            state: T.CellState.BLANK,
            location: str_cube(location),
        };
        this.#queue._count += 1;
    }

    setFilled(location: T.CubeLocation, color: T.Integer) {
        this.#queue[location] = {
            state: T.CellState.FILLED,
            location: str_cube(location),
            color: color,
            age: CELL_FILLED_MAX_AGE_TICKS,
        };
        this.#queue._count += 1;
    }

    setTrail(location: T.CubeLocation, color: T.Integer, ownerPlayerId: T.Integer) {
        this.#queue[location] = {
            state: T.CellState.TRAIL,
            location: str_cube(location),
            color: color,
            ownerPlayerId: ownerPlayerId,
        };
        this.#queue._count += 1;
    }

    commit() {
        if (this.#queue._count === 0) return;

        let updated = Object.create(null) as T.CellGrid;
        for (let [locationKey, cell] of Object.entries(this.#queue)) {
            if (typeof cell === 'number') continue;
            let location = locationKey as T.CubeLocation;

            if (cell.state === T.CellState.FILLED) {
                this.filled.add(location);
            } else if (this.filled.has(location)) {
                this.filled.delete(location);
            }

            if (cell.state === T.CellState.BLANK) {
                delete this.#cells[location];
            } else {
                this.#cells[location] = cell;
            }

            updated[location] = gcellToTcell(cell);

        }

        this.onupdate?.(updated);
        this.#queue = newQueue();
    }

    decay() {
        if (this.filled.size === 0) return;

        let touched = Object.create(null) as T.CellGrid;
        for (let location of this.filled) {
            let cell = this.#cells[location] as GCellFilled;
            cell.age -= 1;
            if (cell.age <= 0) {
                touched[location] = { state: T.CellState.BLANK };
                delete this.#cells[location];
                this.filled.delete(location);
            } else {
                touched[location] = gcellToTcell(cell);
            }
        }

        this.onupdate?.(touched);
    }

    vacuum() {
        let extent = newExtent();
        for (let gcell of Object.values(this.#cells)) {
            extent.extend(gcell.location);
        }
        this.#extent = extent.finalize();
        console.log('[grid] updated extent: %s', this.#extent);
    }
}

const grid = new Grid();

setInterval(() => {
    grid.commit();
}, GRID_COMMIT_TICK_RATE);

setInterval(() => {
    grid.decay();
}, GRID_DECAY_TICK_RATE);

setInterval(() => {
    grid.vacuum();
}, GRID_VACUUM_RATE);

export default grid;
