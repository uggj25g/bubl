import * as THREE from "three";

const BASE_COLOR = 0xFFFFFFF;

const AMB_BASE_INTENSITY = 0.7;
const DIR_BASE_INTENSITY = 1;

export class AmbientLight extends THREE.AmbientLight {
  constructor() {
    super(BASE_COLOR, AMB_BASE_INTENSITY);
  }
}

export class DirectionalLight extends THREE.DirectionalLight {
  constructor() {
    super(BASE_COLOR, DIR_BASE_INTENSITY);
    this.position.set(-30, 50, 30);
    this.castShadow = true;
  }
}