import * as THREE from "three";

type CubeCoordStr = string;

export class HexMap {
  map: Map<CubeCoordStr, number>;

  // TODO: callbacks when change happens, idk?

  constructor() {
    this.map = new Map<CubeCoordStr, number>();
    this.map.set("0,0,0", 1);
    this.map.set("1,-1,0", 1);
    this.map.set("-1,1,0", 1);
    this.map.set("0,1,-1", 1);
    this.map.set("0,-1,1", 1);
  }
}

export class CubeCoordinates {
  q: number;
  r: number;
  s: number;

  constructor(q: number = 0, r: number = 0, s: number = 0) {
    this.q = q;
    this.r = r;
    this.s = s;
  }

  public to_string(): CubeCoordStr {
    return `${this.q},${this.r},${this.s}`;
  }

  public static from_string(str: CubeCoordStr): CubeCoordinates {
    const seg = str.split(",").map((e) => e.trim());
    return new CubeCoordinates(
      parseInt(seg[0], 10),
      parseInt(seg[1], 10),
      parseInt(seg[2], 10),
    );
  }

  // Tostring methods

  public to_planar_unit(): THREE.Vector2 {
    // Increasing Q - (-Y, +X) (120deg counter-clock from screen down)
    // Increasing R - (+Y) (0 deg, downwards in screen coords)
    // Increasing S - (-Y, -X) (120deg clockwise from screen down)
    // TODO: Figure out the trigonometry tomorrow
    let x = 0;
    let y = this.r;
    return new THREE.Vector2(x, y);
  }
}
