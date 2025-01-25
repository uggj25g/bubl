import * as THREE from 'three';

export class HexagonShape extends THREE.Shape {
  constructor() {
    super();
    const size = 0.5;
    const centerX = 0;
    const centerY = 0;
    this.moveTo(centerX, centerY + size);
    for (let i = 1; i <= 6; i++) {
      this.lineTo(
        centerX + size * Math.sin((i * Math.PI) / 3),
        centerY + size * Math.cos((i * Math.PI) / 3)
      );
    }
  }
}