import * as T from '../../types';
import * as G from './grid';

export const cube_add = (a: G.CubeLocation, b: G.CubeLocation) =>
    G.cube(a.q + b.q, a.r + b.r, a.s + b.s);
export const cube_mul = (a: G.CubeLocation, scalar: number) =>
    G.cube(a.q * scalar, a.r * scalar, a.s * scalar);

export function cube_neigh(rootPos: T.CubeLocation): T.CubeLocation[] {
    let pos = G.str_cube(rootPos);
    return [
        { q: pos.q, r: pos.r - 1, s: pos.s + 1 },
        { q: pos.q, r: pos.r + 1, s: pos.s - 1 },
        { q: pos.q - 1, r: pos.r, s: pos.s + 1 },
        { q: pos.q + 1, r: pos.r, s: pos.s - 1 },
        { q: pos.q - 1, r: pos.r + 1, s: pos.s },
        { q: pos.q + 1, r: pos.r - 1, s: pos.s },
    ].map(pos => G.cube_str(pos));
}
export function cube_neigh_cells(rootPos: T.CubeLocation, grid: G.GCellInterimGrid): T.CubeLocation[] {
    return cube_neigh(rootPos).filter(pos => grid[pos] !== undefined);
}

export function cube_radius(rootPos: T.CubeLocation, radius: number): T.CubeLocation[] {
    let re = [] as T.CubeLocation[];
    let pos = G.str_cube(rootPos);
    for (let q = -radius; q <= radius; q += 1) {
        let lower = Math.max(-radius, -q - radius);
        let upper = Math.max(radius, -q + radius);
        for (let r = lower; r <= upper; r += 1) {
            let s = -q - r;
            let diff = G.cube(q, r, s);
            let pos2 = cube_add(pos, diff);
            re.push(G.cube_str(pos2));
        }
    }
    return re;
}

function flood_trail(rootPos: T.CubeLocation, grid: G.GCellInterimGrid): Set<G.CubeLocation> {
    // let root = grid[G.cube_str(rootPos)];
    // assert(root.state === T.CellState.TRAIL);
    let queue = [rootPos];
    let seen = new Set<T.CubeLocation>([rootPos]);
    while (queue.length > 0) {
        let pos = queue.shift()!;
        for (let neigh of cube_neigh_cells(pos, grid)) {
            if (seen.has(neigh)) continue;
            let cell = grid[neigh];
            if (cell.state !== T.CellState.TRAIL) continue;
            seen.add(neigh);
            queue.push(neigh);
        }
    }
    return new Set(Array.from(seen).map(pos => G.str_cube(pos)));
}

/// Perform annihilation starting from the given cell.
///
/// Any neighboring TRAILs will be replaced with BLANK, regardless of which
/// player owns them.
///
/// Returns set of blanked positions.
export function annihilate(root: T.CubeLocation, grid: G.GCellInterimGrid): Set<T.CubeLocation> {
    // for each neighboring path, perform flooding search of full trail length
    let trails = new Set<T.CubeLocation>();
    for (let neigh of cube_neigh_cells(root, grid)) {
        let cell = grid[neigh];
        if (cell.state !== T.CellState.TRAIL) continue;
        for (let pos of flood_trail(neigh, grid)) {
            trails.add(G.cube_str(pos));
        }
    }

    return trails;
}

/// Find a shortest fill path starting from a leaf cell.
export function fill(root: T.CubeLocation, color: T.Integer, grid: G.GCellInterimGrid): null | T.CubeLocation[] {
    let queue = [[root]];
    let shortestPath = [] as T.CubeLocation[];
    let iters = 1000;

    while (queue.length > 0) {
        if (iters-- <= 0) break;
        let path = queue.shift()!;
        let last = path[path.length - 1];

        let next = cube_neigh(last);

        // Allow only paths with at least length 4
        if (path.length >= 4) {
            for (let n of next) {
                if (n === root && n !== last) {
                    shortestPath = path;
                    break;
                }
            }
        }
        if (shortestPath.length > 0) {
            // We definitely won't find any shorter path than this by doing BFS
            return shortestPath;
        }

        const notInPath = next.filter((pos) => {
            if ( ! (pos in grid)) return false;
            if (path.indexOf(pos) !== -1) return false;
            return true;
        });
        const nextTrail = notInPath.filter((pos) => {
            return grid[pos]?.state === T.CellState.TRAIL
                && grid[pos].color === color;
        });
        for (let pos of nextTrail) {
            let newPath = [...path, pos];
            queue.push(newPath);
        }
    }

    return null;
}

//#region Extent calculation


export type GExtent = {
    q: [min: T.Integer, max: T.Integer],
    r: [min: T.Integer, max: T.Integer],
    s: [min: T.Integer, max: T.Integer],
    toString(): string;
};
interface GExtentCalc {
    extend(pos: G.CubeLocation): void;
    finalize(): GExtent;
}
export const newExtent = (): GExtentCalc => {
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

    const extend = (pos: G.CubeLocation) => {
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

//#endextent
