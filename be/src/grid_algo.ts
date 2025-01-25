import * as T from '../../types';
import * as G from './grid';

function cube_neigh(rootPos: G.CubeLocation): G.CubeLocation[] {
    return [
        { q: rootPos.q, r: rootPos.r - 1, s: rootPos.s + 1 },
        { q: rootPos.q, r: rootPos.r + 1, s: rootPos.s - 1 },
        { q: rootPos.q - 1, r: rootPos.r, s: rootPos.s + 1 },
        { q: rootPos.q + 1, r: rootPos.r, s: rootPos.s - 1 },
        { q: rootPos.q - 1, r: rootPos.r + 1, s: rootPos.s },
        { q: rootPos.q + 1, r: rootPos.r - 1, s: rootPos.s },
    ];
}
function cube_neigh_cells(rootPos: G.CubeLocation, grid: G.GCellInterimGrid): G.CubeLocation[] {
    return cube_neigh(rootPos).filter(pos => grid[G.cube_str(pos)] !== undefined);
}

function flood_trail(rootPos: G.CubeLocation, grid: G.GCellInterimGrid): Set<G.CubeLocation> {
    // let root = grid[G.cube_str(rootPos)];
    // assert(root.state === T.CellState.TRAIL);
    let queue = [rootPos];
    let seen = new Set<T.CubeLocation>([G.cube_str(rootPos)]);
    while (queue.length > 0) {
        let pos = queue.shift()!;
        for (let neigh of cube_neigh_cells(pos, grid)) {
            let neighK = G.cube_str(neigh);
            if (seen.has(neighK)) continue;
            let cell = grid[neighK];
            if (cell.state !== T.CellState.TRAIL) continue;
            seen.add(neighK);
            queue.push(neigh);
        }
    }
    return new Set(Array.from(seen).map(pos => G.str_cube(pos)));
}

/// Perform annihilation starting from the given cell.
///
/// Any neighboring TRAILs will be replaced with BLANK, regardless of which
/// player owns them.
export function annihilate(root: G.CubeLocation, grid: G.GCellInterimGrid) {
    // [1] for each neighboring path, perform flooding search of full trail
    // length
    let trails = new Set<G.CubeLocation>();
    for (let neigh of cube_neigh_cells(root, grid)) {
        let neighK = G.cube_str(neigh);
        let cell = grid[neighK];
        if (cell.state !== T.CellState.TRAIL) continue;
        for (let pos of flood_trail(neigh, grid)) {
            trails.add(pos);
        }
    }

    // [2] for all found trails, blankify
    for (let pos of trails) {
        let k = G.cube_str(pos);
        grid[k] = {
            location: pos,
            state: T.CellState.BLANK,
        };
    }
}
