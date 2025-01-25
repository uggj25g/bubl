import * as T from '../../types';
import * as G from './grid';

export const cube_add = (a: G.CubeLocation, b: G.CubeLocation) =>
    G.cube(a.q + b.q, a.r + b.r, a.s + b.s);

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
    // [1] for each neighboring path, perform flooding search of full trail
    // length
    let trails = new Set<T.CubeLocation>();
    for (let neigh of cube_neigh_cells(root, grid)) {
        let cell = grid[neigh];
        if (cell.state !== T.CellState.TRAIL) continue;
        for (let pos of flood_trail(neigh, grid)) {
            trails.add(G.cube_str(pos));
        }
    }

    // [2] for all found trails, blankify
    for (let pos of trails) {
        grid[pos] = {
            location: G.str_cube(pos),
            state: T.CellState.BLANK,
        };
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
