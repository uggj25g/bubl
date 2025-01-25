import * as THREE from "three";
import * as coordinates from "./coordinates";

export class Player extends THREE.Group {
  mesh: THREE.Mesh;
  cubepos: coordinates.CubeCoordinates;

  constructor() {
    super();
    this.cubepos = new coordinates.CubeCoordinates();
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const geometry = new THREE.SphereGeometry(0.1);
    this.mesh = new THREE.Mesh(geometry, material);
    this.add(this.mesh);
  }

  public move(translation: coordinates.CubeCoordinates) {
    this.cubepos.add(translation);
    const coord = this.cubepos.to_planar_unit();
    this.position.x = coord.x;
    this.position.y = 1;
    this.position.z = coord.y;
  }
}
