import * as T from '../../types';

/// Grid will perform a Commit Tick (commit all queued changes) every
/// ... milliseconds
const GRID_COMMIT_TICK_RATE = 100;

/// Grid will perform a Time Decay Tick every ... Commit Ticks
const GRID_DECAY_PER_N_COMMIT_TICKS = 10;

/// A cell should fully decay from 1 to 0 in ... ticks (intervals of
/// GRID_COMMIT_TICK_TIME ms * GRID_DECAY_PER_N_COMMIT_TICKS)
const CELL_FILLED_MAX_AGE_TICKS = 200;

/// Grid will perform a Vacuum Tick every ... Commit Ticks
const GRID_VACUUM_PER_N_COMMIT_TICKS = 100;

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
    ownerPlayerId: T.PlayerID,
    color: T.Integer,

    /// number of decay ticks remaining if owned by current player
    age: T.Integer,

    /// top age when cell entered TRAIL state – used for calculating float repr
    maxAge: T.Integer,
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
            age: cell.age / cell.maxAge,
            ownerPlayer: cell.ownerPlayerId,
        };
    }
    }
}


type GQueue = {
    [location: T.CubeLocation]: GCellAction,
    _count: number,
};
const newQueue = (): GQueue => {
    let queue = Object.create(null);
    Object.defineProperty(queue, '_count', {
        enumerable: false,
        writable: true,
    });
    queue._count = 0;
    return queue;
}

type GCellAction = GCellBlank | GCellTrail | GCellTombstone;
type GCellTombstone = {
    location: CubeLocation,
    state: 'tombstone',
    originalColor: T.Integer,
};

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
    #updates: T.CellGrid | null = null;
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

    setTrail(location: T.CubeLocation, color: T.Integer, ownerPlayerId: T.PlayerID, age: T.Integer) {
        let needIncrement = ! (location in this.#queue);

        switch (this.#queue[location]?.state) {
        case 'tombstone': {
            // noop - tombstone already enqueued, we don't need another one
            break;
        }
        case T.CellState.TRAIL: {
            this.#queue[location] = {
                state: 'tombstone',
                location: str_cube(location),
                originalColor: this.#queue[location].color!,
            };
            break;
        }
        case T.CellState.BLANK: // fallthrough
        case undefined: {
            this.#queue[location] = {
                state: T.CellState.TRAIL,
                location: str_cube(location),
                color: color,
                age: age,
                maxAge: age,
                ownerPlayerId: ownerPlayerId,
            };
            break;
        }
        }

        if (needIncrement) {
            this.#queue._count += 1;
        }
    }

    #setFilled(location: T.CubeLocation, color: T.Integer) {
        this.#cells[location] = {
            state: T.CellState.FILLED,
            location: str_cube(location),
            color: color,
            age: CELL_FILLED_MAX_AGE_TICKS,
        } as GCellFilled;
        this.filled.add(location);
    }

    /// **mutates** locations by removing nodes that will decay on next commit,
    /// and nodes that are no longer TRAIL or are owned by a different player
    decayTrail(ownerId: T.PlayerID, locations: Set<T.CubeLocation>) {
        for (let location of locations) {
            if (location in this.#queue) {
                /* An update is being queued in parallel to decay. This means
                one of these:

                - A friendly has stepped on the trail, absorbing its ownership.
                  Decay shouldn't happen due to owner change.

                - Owner has stepped on the cell again. This resets its age, so
                  there's no point to apply decay.

                - BUG: Owner is moving so fast that two trail decays have been
                  enqueued within the same tick. TODO, should decay enqueued
                  trails with accelerated rate if it doesn't match current
                  location?

                - An opponent has stepped on the trail, causing it to
                  annihilate. Decay could cause annihilation to be cancelled.

                  (TODO[paulsn] maybe this _should_ happen to ensure fairness –
                  annihilation shouldn't happen if you step on the last cell
                  of the trail that's about to decay fully?)

                In any case, trail decay is not appropriate anymore. */
                continue;
            }

            let upd = this.#cells[location];
            if (
                upd === undefined // cell has already been decayed via other means
                || upd.state !== T.CellState.TRAIL
                || upd.ownerPlayerId !== ownerId
            ) {
                locations.delete(location);
                continue;
            }

            let newAge = upd.age - 1;
            if (newAge <= 0) {
                this.#queue[location] = {
                    state: T.CellState.BLANK,
                    location: upd.location,
                };
                locations.delete(location);
                continue;
            }
            this.#queue[location] = { ...upd, age: newAge };
        }
    }

    commit(_tick: number) {
        if (this.#queue._count === 0) return;
        if (this.#updates === null) this.#updates = Object.create(null);

        for (let [locationKey, cell] of Object.entries(this.#queue)) {
            if (typeof cell === 'number') continue; // locationKey ===  '_count'
            let location = locationKey as T.CubeLocation;

            if (this.filled.has(location)) {
                this.filled.delete(location);
            }

            switch (cell.state) {
            case T.CellState.BLANK: {
                delete this.#cells[location];
                this.#updates![location] = gcellToTcell(cell);
                break;
            }
            case T.CellState.TRAIL: {
                // TODO attempt trail -> filled conversion
                // TODO apply annihilation if already filled
                this.#cells[location] = cell;
                this.#updates![location] = gcellToTcell(cell);
                break;
            }
            case 'tombstone': {
                // TODO[paulsn] annihilate, mark all trails as blanked
                break;
            }
            }
        }

        this.#queue = newQueue();
    }

    decay(_tick: number) {
        if (this.filled.size === 0) return;
        if (this.#updates === null) this.#updates = Object.create(null);

        for (let location of this.filled) {
            let cell = this.#cells[location] as GCellFilled;
            cell.age -= 1;
            if (cell.age <= 0) {
                this.#updates![location] = { state: T.CellState.BLANK };
                delete this.#cells[location];
                this.filled.delete(location);
            } else {
                this.#updates![location] = gcellToTcell(cell);
            }
        }
    }

    vacuum(_tick: number) {
        let extent = newExtent();
        for (let gcell of Object.values(this.#cells)) {
            extent.extend(gcell.location);
        }
        this.#extent = extent.finalize();
        console.log('[grid] updated extent: %s', this.#extent);
    }

    flush(_tick: number) {
        if (this.#updates !== null) {
            this.onupdate?.(this.#updates);
            this.#updates = null;
        }
    }
}

const grid = new Grid();

let tick = 0;
setInterval(() => {
    tick = tick + 1;
    grid.commit(tick);
    if (tick % GRID_DECAY_PER_N_COMMIT_TICKS === 0) {
        grid.decay(tick);
    }
    if (tick % GRID_VACUUM_PER_N_COMMIT_TICKS === 0) {
        grid.vacuum(tick);
    }
    grid.flush(tick);
}, GRID_COMMIT_TICK_RATE);

export default grid;
