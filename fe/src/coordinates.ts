import * as THREE from "three";
import * as T from '../../types';
import { HexagonFlatGeometry, HexagonMesh } from "./visual/hegaxon/flat";


const SIN60 = Math.sqrt(3) / 2;

const BASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffffff,
});

const HOVER_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
});

const FILLED_MATERIALS: THREE.Material[] = [
  new THREE.MeshStandardMaterial({
    color: 0xff0000,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x0000ff,
  }),
];

const TRAIL_MATERIALS: THREE.Material[] = [
  new THREE.MeshStandardMaterial({
    color: 0xff8080,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x8080ff,
  }),
];

export const PLAYING_RADIUS = 30;

export type CubeCoordStr = T.CubeLocation;

export type Cell = {
  // location: T.CubeLocation;
  state: T.CellState;
  color?: T.Integer;
};

export const BLANK_CELL: Cell = {
  state: T.CellState.BLANK,
};

export class CellManager {
  scene: THREE.Scene;
  map: HexMap;
  activeCells: Map<T.CubeLocation, VisualCell>;
  currentCenter: T.CubeLocation;

  constructor(scene: THREE.Scene, map: HexMap) {
    this.scene = scene;
    this.map = map;
    this.currentCenter = "0,0,0"; // Starting center
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

  public subtractCube(a: CubeCoordinates, b: CubeCoordinates) {
    return new CubeCoordinates(a.q - b.q, a.r - b.r, a.s - b.s);
  }

  public cubeDistance(a: CubeCoordinates, b: CubeCoordinates) {
    const sub = this.subtractCube(a, b);
    return Math.abs(sub.q) + Math.abs(sub.r) + Math.abs(sub.s);
  }

  public setCenter(location: T.CubeLocation) {
    if (this.currentCenter === location) return;
    this.currentCenter = location;

    for_radius(this.currentCenter, PLAYING_RADIUS, (coord) => {
      const cell = this.get_cell(coord.to_string());
      cell.despawn = 3;
    });

    const markedForRemoval: T.CubeLocation[] = [];
    for (const [cellLocation, cell] of this.activeCells) {
      cell.despawn -= 1;
      if (cell.despawn <= 0) {
        markedForRemoval.push(cellLocation);
      }
    }
    for (const l of markedForRemoval) {
      this.scene.remove(this.activeCells.get(l)!);
      this.activeCells.delete(l);
    }
  }
}

export class VisualCell extends THREE.Group {
  mesh: THREE.Mesh;
  location: T.CubeLocation;
  cell: Cell;
  hover: boolean;

  // Each center change event will decay this for all tiles, unless those
  // found in the desired radius. If a tile reaches 0, it will be despawned.
  despawn: T.Integer;

  constructor(location: T.CubeLocation, cell: Cell) {
    super();
    this.location = location;
    this.mesh = new HexagonMesh();
    this.mesh.rotateX(Math.PI / 2);
    this.mesh.geometry = new HexagonFlatGeometry();
    this.cell = cell;
    this.hover = false;
    this.despawn = 2;
    this.add(this.mesh);
    this.updateObject();
  }

  public updateCell(cell: Cell) {
    this.cell = cell;
    if (cell.state !== T.CellState.BLANK) {
      this.hover = false;
    }
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
        this.mesh.material = TRAIL_MATERIALS[this.cell.color ?? 0];
        this.mesh.geometry = new HexagonFlatGeometry(0.5);
      } else if (this.cell.state == T.CellState.FILLED) {
        this.mesh.material = FILLED_MATERIALS[this.cell.color ?? 0];
        const defaultScale = 0.1;
        const filled = this.cell as T.CellFilled;
        const age = filled.age;
        const scale = defaultScale + (age / 2 ) * (1 - defaultScale);
        this.mesh.geometry = new HexagonFlatGeometry(
          scale
        )
      } else {
        this.mesh.material = BASE_MATERIAL;
        this.mesh.geometry = new HexagonFlatGeometry()
      }
    }
  }

  public setHover(value: boolean) {
    if (this.cell.state !== T.CellState.BLANK) {
      return;
    }
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
    } else {
      this.map.delete(location);
      this.callbacks.forEach((e) => e(location, cell));
    }
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

  public static RIGHT = new CubeCoordinates(1, 0, -1); // BOTTOM RIGHT
  public static BOTTOM_RIGHT = new CubeCoordinates(0, 1, -1); // DOWN
  public static BOTTOM_LEFT = new CubeCoordinates(-1, 1, 0); // LEFT
  public static LEFT = new CubeCoordinates(-1, 0, 1); // TOP LEFT
  public static TOP_LEFT = new CubeCoordinates(0, -1, 1); // UP
  public static TOP_RIGHT = new CubeCoordinates(1, -1, 0); // RIGHT

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

  public isZero(): boolean {
    return this.q == 0 && this.r == 0 && this.s == 0;
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

  public to_planar_unit3(): THREE.Vector3 {
    // Increasing Q - (-Y, +X) (120deg counter-clock from screen down)
    // Increasing R - (+Y) (0 deg, downwards in screen coords)
    // Increasing S - (-Y, -X) (120deg clockwise from screen down)
    let x = this.s / 2 - this.q / 2;
    let y = (this.q + this.s) * SIN60;
    return new THREE.Vector3(-x, 0, -y);
  }
}