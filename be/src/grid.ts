import * as T from '../../types';
import { annihilate, fill, cube_neigh, cube_radius } from './grid_algo';
import { assert } from './util';

/// Grid will perform a Commit Tick (commit all queued changes) every
/// ... milliseconds
const GRID_COMMIT_TICK_RATE = 100;

/// Grid will perform a Time Decay Tick every ... Commit Ticks
const GRID_DECAY_PER_N_COMMIT_TICKS = 10;

/// A cell should fully decay from 1 to 0 in ... ticks (intervals of
/// GRID_COMMIT_TICK_TIME ms * GRID_DECAY_PER_N_COMMIT_TICKS)
const CELL_FILLED_MAX_AGE_TICKS = 10;

/// Grid will perform a Vacuum Tick every ... Commit Ticks
const GRID_VACUUM_PER_N_COMMIT_TICKS = 100;

const PLAYER_REVIVE_RADIUS = 2;

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

export type GCellGrid = Record<T.CubeLocation, GCell>;
export type GCellInterimGrid = Record<T.CubeLocation, GCell | GCellTombstone>;
export type GCell = GCellBlank | GCellTrail | GCellFilled;
export type GCellBlank = {
    location: CubeLocation,
    state: T.CellState.BLANK,
};
export type GCellTrail = {
    location: CubeLocation,
    state: T.CellState.TRAIL,
    ownerPlayerId: T.PlayerID,
    color: T.Integer,
    decaysIntoFilled: boolean,

    /// number of decay ticks remaining if owned by current player
    age: T.Integer,

    /// top age when cell entered TRAIL state – used for calculating float repr
    maxAge: T.Integer,
};
export type GCellFilled = {
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
            decaysIntoFilled: cell.decaysIntoFilled,
        };
    }
    }
}

export type GQueue = {
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

export type GCellAction = GCellBlank | GCellTrail | GCellFilled
    | GCellTombstone | GCellRevive;
export type GCellTombstone = {
    location: CubeLocation,
    state: 'tombstone',
    originalColor: T.Integer,
    lastPlayer: T.PlayerID,
};
export type GCellRevive = {
    location: CubeLocation,
    state: 'revive',
};

export type GExtent = {
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
        let current = (this.#queue[location] ?? this.#cells[location]) as GCell | GCellTombstone | undefined;

        switch (current?.state) {
        case 'tombstone': {
            // noop - tombstone already enqueued, we don't need another one
            break;
        }
        case T.CellState.TRAIL: {
            if (current.color === color) {
                // take over teammate's trail only if own energy is greater
                if (current.maxAge < age) {
                    this.#queue[location] = {
                        state: T.CellState.TRAIL,
                        location: current.location,
                        color,
                        age,
                        maxAge: age,
                        ownerPlayerId,
                        decaysIntoFilled: current.decaysIntoFilled,
                    };
                }
            } else {
                // annihilate other color trails
                this.#queue[location] = {
                    state: 'tombstone',
                    location: str_cube(location),
                    originalColor: current.color!,
                    lastPlayer: ownerPlayerId,
                };
            }
            break;
        }
        case T.CellState.FILLED: {
            if (current.color === color) {
                // mark as trail revertible to filled
                this.#queue[location] = {
                    state: T.CellState.TRAIL,
                    location: str_cube(location),
                    color,
                    age,
                    maxAge: age,
                    ownerPlayerId,
                    decaysIntoFilled: true,
                };
            }
            // otherwise owned by other color, do not touch
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
                decaysIntoFilled: false,
            };
            break;
        }
        }

        this.#queue._count += 1;
    }

    // @ts-ignore unused... FOR NOW
    #setFilled(location: T.CubeLocation, color: T.Integer) {
        this.#cells[location] = {
            state: T.CellState.FILLED,
            location: str_cube(location),
            color: color,
            age: CELL_FILLED_MAX_AGE_TICKS,
        } as GCellFilled;
        this.filled.add(location);
    }

    /// reduce decay for cells in a radius around player
    reviveAround(location: T.CubeLocation, color: T.Integer) {
        for (let pos of cube_radius(location, PLAYER_REVIVE_RADIUS)) {
            if (this.#queue[pos] !== undefined) continue;
            let curr = this.#cells[pos];
            if (
                ! curr
                || curr.state !== T.CellState.FILLED
                || curr.color !== color
            ) {
                continue;
            }

            this.#queue[pos] = { location: str_cube(pos), state: 'revive' };
        }
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
                this.#queue[location] =
                    upd.decaysIntoFilled
                    ? {
                        state: T.CellState.FILLED,
                        location: upd.location,
                        color: upd.color,
                        age: CELL_FILLED_MAX_AGE_TICKS, // TODO[paulsn] is valid?
                    }
                    : {
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

        let interim = this.#cells as GCellInterimGrid;

        // TODO[paulsn] O(6N)

        let potentialConnections = new Set<[T.CubeLocation, color: T.Integer]>();

        // [1] trail growth WITHOUT connections
        for (let [locationKey, action] of Object.entries(this.#queue)) {
            if (typeof action === 'number') continue; // locationKey === '_count', actually unreachable
            if (action.state !== T.CellState.TRAIL) continue; // TODO[paulsn] O(4N)

            let location = locationKey as T.CubeLocation;
            let existing = interim[location];
            if (
                existing
                && existing.state === T.CellState.TRAIL
                && existing.color !== action.color
            ) {
                // will need to annihilate
                this.#queue[location] = {
                    state: 'tombstone',
                    location: existing.location,
                    originalColor: existing.color,
                    lastPlayer: action.ownerPlayerId,
                };
                continue;
            }
            if (
                existing
                && existing.state !== T.CellState.TRAIL
                && ! action.decaysIntoFilled
            ) {
                // filled cells cannot become part of the trail
                continue;
            }

            interim[location] = action;
            this.#updates![location] = gcellToTcell(action);
            if (existing?.state === T.CellState.FILLED) {
                this.filled.delete(location);
            }

            let neighTrails = cube_neigh(location)
                .filter((loc2) => {
                    let cell = this.#queue[loc2] ?? interim[loc2] as GCell;
                    if (cell === undefined) return false;
                    if (cell.state !== T.CellState.TRAIL) return false;
                    if (cell.color !== action.color) return false;
                    return true;
                })
                .length;
            if (neighTrails > 1) {
                potentialConnections.add([location, action.color]);
            }
        }

        // [2] annihilation
        for (let [locationKey, action] of Object.entries(this.#queue)) {
            if (typeof action === 'number') continue; // locationKey === '_count', actually unreachable
            if (action.state !== 'tombstone') continue; // TODO[paulsn] O(4N)

            let location = locationKey as T.CubeLocation;
            let annihilated = annihilate(location, interim);
            console.log('[grid] annihilated!', annihilated.size);
            for (let pos of annihilated) {
                delete interim[pos];
                this.#updates![pos] = { state: T.CellState.BLANK };
            }
            delete interim[location];
            this.#updates![location] = { state: T.CellState.BLANK };
        }

        // [3] trail connection
        for (let [conn, color] of potentialConnections) {
            let trail = fill(conn, color, interim);
            if (trail !== null) {
                // 0 represents prefilled cells that don't contribute to score
                let scorePerPlayer = Object.create(null) as Record<T.PlayerID, T.Integer>;
                for (let pos of trail) {
                    let cell = interim[pos];
                    assert(cell.state === T.CellState.TRAIL && cell.color === color);
                    let owner = cell.decaysIntoFilled
                        ? 0
                        : cell.ownerPlayerId;
                    scorePerPlayer[owner] = (scorePerPlayer[owner] ?? 0) + 1;
                }

                // TODO[paulsn] not actually safe to use full annihilate here
                // since it will also destroy opponents' trails that are only
                // touching due to its flood fill nature
                // EMERGENT: ... or maybe that's actually a feature?
                for (let pos of annihilate(conn, interim)) {
                    let cell = interim[pos];
                    assert(cell.state === T.CellState.TRAIL);
                    if (
                        cell.color === color
                        && cell.decaysIntoFilled
                    )
                    delete interim[pos];
                    this.#updates![pos] = { state: T.CellState.BLANK };
                }

                for (let pos of trail) {
                    interim[pos] = {
                        state: T.CellState.FILLED,
                        location: str_cube(pos),
                        color,
                        age: CELL_FILLED_MAX_AGE_TICKS, // TODO?
                    };
                    this.#updates![pos] = gcellToTcell(interim[pos]);
                    this.filled.add(pos);
                }
            }
        }

        // [4] trail decay
        for (let [locationKey, action] of Object.entries(this.#queue)) {
            if (typeof action === 'number') continue; // locationKey === '_count', actually unreachable
            if (action.state !== T.CellState.BLANK) continue; // TODO[paulsn] O(4N)

            let location = locationKey as T.CubeLocation;
            let current = interim[location];
            // cell was filled before decay
            if (current && current.state !== T.CellState.TRAIL) continue;

            delete interim[location];
            this.#updates![location] = { state: T.CellState.BLANK };
        }
        // [4.b] trail decay into filled
        for (let [locationKey, action] of Object.entries(this.#queue)) {
            if (typeof action === 'number') continue; // locationKey === '_count', actually unreachable
            if (action.state !== T.CellState.FILLED) continue; // TODO[paulsn] O(4N)

            let location = locationKey as T.CubeLocation;
            interim[location] = action;
            this.#updates![location] = gcellToTcell(action);
            this.filled.add(location);
        }

        // [5] revive
        for (let [locationKey, action] of Object.entries(this.#queue)) {
            if (typeof action === 'number') continue;
            if (action.state !== 'revive') continue; // TODO[paulsn] O(5N)

            let location = locationKey as T.CubeLocation;
            if (interim[location].state !== T.CellState.FILLED) continue;
            interim[location].age = CELL_FILLED_MAX_AGE_TICKS;
        }

        this.#queue = newQueue();
        // by this point, tombstones are no longer in here
        this.#cells = interim as GCellGrid;
    }

    decay(_tick: number) {
        if (this.filled.size === 0) return;
        if (this.#updates === null) this.#updates = Object.create(null);

        for (let location of this.filled) {
            let cell = this.#cells[location] as GCellFilled;
            if (!cell) {
                // ???
                this.filled.delete(location);
                continue;
            }
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
        if (this.#queue._count > 0) {
            this.#queue = newQueue();
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
