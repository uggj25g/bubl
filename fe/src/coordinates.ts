import * as THREE from "three";

export class CubeCoordinates {
  q: number;
  r: number;
  s: number;

  constructor(q: number = 0, r: number = 0, s: number = 0) {
    this.q = q;
    this.r = r;
    this.s = s;
  }

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
