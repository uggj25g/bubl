import * as THREE from "three";
import * as T from '../../types';
import { HexagonMesh } from "./visual/hegaxon/flat";

const SIN60 = Math.sqrt(3) / 2;

const BASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffffff,
});

const HOVER_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
});

const FILLED_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xff0000,
});

const TRAIL_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xff00ff,
});

export type CubeCoordStr = T.CubeLocation;

export type Cell = {
  // location: T.CubeLocation;
  state: T.CellState;
};

export const BLANK_CELL: Cell = {
  state: T.CellState.BLANK,
};

export class CellManager {
  scene: THREE.Scene;
  map: HexMap;
  activeCells: Map<T.CubeLocation, VisualCell>;

  constructor(scene: THREE.Scene, map: HexMap) {
    this.scene = scene;
    this.map = map;
    this.activeCells = new Map<T.CubeLocation, VisualCell>();
    map.callbacks.push((l, c) => this.on_cell_changed(l, c));
  }

  private on_cell_changed(
    location: T.CubeLocation,
    cell: Cell | undefined,
  ): void {
    const existing = this.activeCells.get(location);
    if (!existing) {
      return;
    }
    existing.updateCell(cell || BLANK_CELL);
  }

  public get_cell(location: T.CubeLocation): VisualCell {
    const existing = this.activeCells.get(location);
    if (existing) {
      return existing;
    }
    const newCell = new VisualCell(
      location,
      this.map.get_cell(location) || BLANK_CELL,
    );
    this.activeCells.set(location, newCell);
    this.scene.add(newCell);
    return newCell;
  }
}

export class VisualCell extends THREE.Group {
  mesh: THREE.Mesh;
  location: T.CubeLocation;
  cell: Cell;
  hover: boolean;

  constructor(location: T.CubeLocation, cell: Cell) {
    super();
    this.location = location;
    this.mesh = new HexagonMesh();
    this.mesh.rotateX(Math.PI / 2);
    this.cell = cell;
    this.hover = false;
    this.add(this.mesh);
    this.updateObject();
  }

  public updateCell(cell: Cell) {
    this.cell = cell;
    this.updateObject();
  }

  private updateObject() {
    const coord = CubeCoordinates.from_string(this.location);
    const planar = coord.to_planar_unit();
    this.position.x = planar.x;
    this.position.z = planar.y;

    if (this.hover) {
      this.mesh.material = HOVER_MATERIAL;
    } else {
      if (this.cell.state == T.CellState.TRAIL) {
        this.mesh.material = TRAIL_MATERIAL;
      } else if (this.cell.state == T.CellState.FILLED) {
        this.mesh.material = FILLED_MATERIAL;
      } else {
        this.mesh.material = BASE_MATERIAL;
      }
    }
  }

  public setHover(value: boolean) {
    this.hover = value;
    this.updateObject();
  }
}

interface CellCallback {
  (location: T.CubeLocation, cell: Cell | undefined): void;
}

export class HexMap {
  map: Map<CubeCoordStr, Cell>;
  callbacks: CellCallback[];
  // TODO: callbacks when change happens, idk?

  constructor() {
    this.map = new Map<CubeCoordStr, Cell>();
    this.callbacks = [];
  }

  public get_cell(location: T.CubeLocation): Cell | undefined {
    // TODO(srudolfs): Each time we want to get a blank cell, we
    // end up constructing new objects? bad
    return this.map.get(location);
  }

  public setCell(location: T.CubeLocation, cell: Cell | undefined) {
    if (cell) {
      this.map.set(location, cell);
      this.callbacks.forEach((e) => e(location, cell));
      if (cell.state == T.CellState.TRAIL) {
        this.detectContour(location);
      }
    } else {
      this.map.delete(location);
      this.callbacks.forEach((e) => e(location, cell));
    }
  }

  private detectContour(newCellLocation: T.CubeLocation): void {
    console.log(`detect contour begin @ ${newCellLocation}`);

    const knownPaths = new Map<T.CubeLocation, T.CubeLocation[]>();
    knownPaths.set(newCellLocation, []);

    const bfs = (destination: T.CubeLocation): T.CubeLocation[][] => {
      const queue: T.CubeLocation[][] = [[destination]];
      const paths: T.CubeLocation[][] = [];

      while (queue.length > 0) {
        const path = queue[0];
        const last = path[path.length - 1];
        const coord = CubeCoordinates.from_string(last);

        if (path.length > 1) {
          const toLast = knownPaths.get(last);
          if (toLast) {
            // If the other path contains any other node from this path,
            // then it's invalid as it would involve visiting a cell twice
            const reversed = [...toLast].reverse().splice(1);
            const intersection = path.find(
              (e) => e != destination && reversed.find((r) => r == e) != null,
            );
            if (intersection != null) {
              console.log(
                `paths ${path} & ${reversed} did intersect at ${intersection} so it's not valid`,
              );
            } else {
              console.log(`found node with path ${toLast}, joining to ${path}`);
              // A path already exists, let's merge them together to get the final cycle
              // return [...path, ...reversed];
              paths.push([...path, ...reversed]);
              queue.splice(0, 1);
              continue;
            }
          } else {
            knownPaths.set(last, path);
          }
        }

        // Get unvisited neighbors
        let next: T.CubeLocation[] = [
          coord.translated(CubeCoordinates.RIGHT).to_string(),
          coord.translated(CubeCoordinates.BOTTOM_RIGHT).to_string(),
          coord.translated(CubeCoordinates.BOTTOM_LEFT).to_string(),
          coord.translated(CubeCoordinates.LEFT).to_string(),
          coord.translated(CubeCoordinates.TOP_LEFT).to_string(),
          coord.translated(CubeCoordinates.TOP_RIGHT).to_string(),
        ];
        // Filter out invalid paths
        next = next.filter((e) => {
          if (path.indexOf(e) >= 0) {
            console.log(`${e} already in path ${path}`);
            return false;
          }
          let cell = this.get_cell(e);
          if (!cell) return false;
          return cell.state != T.CellState.BLANK;
        });
        for (const n of next) {
          queue.push([...path, n]);
        }
        queue.splice(0, 1);
      }

      return paths;
    };

    const paths = bfs(newCellLocation);
    for (const p of paths) {
      console.log(`a path: ${p} with length ${p.length}`);
      for (const c of p) {
        this.setCell(c, {
          state: T.CellState.FILLED,
        });
      }
    }
    // console.log(`final path: ${path} with length ${path?.length}`);
  }
}

export function for_radius(
  center: T.CubeLocation,
  radius: number,
  callback: { (location: CubeCoordinates): void },
) {
  const c = CubeCoordinates.from_string(center);
  for (let q = -radius; q <= radius; q++) {
    const lower = Math.max(-radius, -q - radius);
    const upper = Math.min(radius, -q + radius);
    for (let r = lower; r <= upper; r++) {
      const s = -q - r;
      const coord = new CubeCoordinates(q, r, s);
      coord.add(c);
      callback(coord);
    }
  }
}

export class CubeCoordinates {
  q: number;
  r: number;
  s: number;

  public static RIGHT = new CubeCoordinates(1, 0, -1);
  public static BOTTOM_RIGHT = new CubeCoordinates(0, 1, -1);
  public static BOTTOM_LEFT = new CubeCoordinates(-1, 1, 0);
  public static LEFT = new CubeCoordinates(-1, 0, 1);
  public static TOP_LEFT = new CubeCoordinates(0, -1, 1);
  public static TOP_RIGHT = new CubeCoordinates(1, -1, 0);

  constructor(q: number = 0, r: number = 0, s: number = 0) {
    this.q = q;
    this.r = r;
    this.s = s;
    if (this.q + this.r + this.s != 0) {
      throw RangeError(`q+r+s must equal 0 (was ${this.q + this.r + this.s})`);
    }
  }

  public to_string(): CubeCoordStr {
    return T.cube(this.q, this.r, this.s);
  }

  public add(other: CubeCoordinates) {
    this.q += other.q;
    this.r += other.r;
    this.s += other.s;
  }

  public translated(other: CubeCoordinates): CubeCoordinates {
    return new CubeCoordinates(
      this.q + other.q,
      this.r + other.r,
      this.s + other.s,
    );
  }

  public static from_string(str: CubeCoordStr): CubeCoordinates {
    const seg = str.split(",").map((e) => e.trim());
    return new CubeCoordinates(
      parseInt(seg[0], 10),
      parseInt(seg[1], 10),
      parseInt(seg[2], 10),
    );
  }

  public to_planar_unit(): THREE.Vector2 {
    // Increasing Q - (-Y, +X) (120deg counter-clock from screen down)
    // Increasing R - (+Y) (0 deg, downwards in screen coords)
    // Increasing S - (-Y, -X) (120deg clockwise from screen down)
    let x = this.s / 2 - this.q / 2;
    let y = (this.q + this.s) * SIN60;
    return new THREE.Vector2(-x, -y);
  }
}

