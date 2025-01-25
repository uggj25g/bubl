import * as THREE from 'three';

export class HexagonShape extends THREE.Shape {
  constructor() {
    super();
    const size = 0.5;
    this.moveTo(0, 0 + size);
    for (let i = 1; i <= 6; i++) {
      this.lineTo(
        size * Math.sin((i * Math.PI) / 3),
        size * Math.cos((i * Math.PI) / 3)
      );
    }
  }
}