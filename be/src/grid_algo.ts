import * as T from '../../types';
import * as G from './grid';

function cube_neigh(rootPos: T.CubeLocation): T.CubeLocation[] {
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
function cube_neigh_cells(rootPos: T.CubeLocation, grid: G.GCellInterimGrid): T.CubeLocation[] {
    return cube_neigh(rootPos).filter(pos => grid[pos] !== undefined);
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
