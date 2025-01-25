import * as THREE from "three";
import * as T from '../../types';


const SIN60 = Math.sqrt(3) / 2;

export type CubeCoordStr = T.CubeLocation;

export type Cell = {
  location: T.CubeLocation;
  state: T.CellState;
};

export class HexMap {
  map: Map<CubeCoordStr, Cell>;

  // TODO: callbacks when change happens, idk?

  constructor() {
    this.map = new Map<CubeCoordStr, Cell>();
  }

  public get_cell(location: T.CubeLocation): Cell {
    // TODO(srudolfs): Each time we want to get a blank cell, we
    // end up constructing new objects? bad
    return (
      this.map.get(location) || {
        location: location,
        state: T.CellState.BLANK,
      }
    );
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

